import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';
import {
  DecisionApiResponse,
  DecisionRoom,
  DecisionRoomOrigin,
  MatchEventPayload,
  RecentDecisionRoom,
  SwipePayload,
  SwipeResult,
  SwipeCard,
} from '../models/decision.models';
import { Place } from '../models/app.models';
import { DataService } from './data.service';

interface DecisionPlacesFilters {
  city_id?: string;
  category?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class DecisionService implements OnDestroy {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private dataService = inject(DataService);

  private apiBase = BACKEND_API_CONFIG.baseUrl;
  private sessionStorageKey = 'didaune_decision_session_id';
  private activeRoomStorageKey = 'didaune_active_decision_room_code';
  private recentRoomsStorageKey = 'didaune_recent_decision_rooms';

  private readonly POLL_INTERVAL_MS = 3000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp: string | null = null;
  private processedMatchIds = new Set<string>();
  private isPollingMatches = false;
  private isPollingPresence = false;
  private pollingBlockedUntil = 0;
  private currentRoomCode: string | null = null;
  private joinRetryBlockedUntilByCode = new Map<string, number>();

  private matchSubject = new Subject<MatchEventPayload>();
  match$ = this.matchSubject.asObservable();
  private roomInvalidatedSubject = new Subject<string>();
  roomInvalidated$ = this.roomInvalidatedSubject.asObservable();

  private roomSubject = new BehaviorSubject<DecisionRoom | null>(null);
  room$ = this.roomSubject.asObservable();

  private recentRoomsSubject = new BehaviorSubject<RecentDecisionRoom[]>(
    this.readRecentRooms(),
  );
  recentRooms$ = this.recentRoomsSubject.asObservable();

  private cardsSubject = new BehaviorSubject<SwipeCard[]>([]);
  cards$ = this.cardsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  getSessionId(): string {
    let sessionId = sessionStorage.getItem(this.sessionStorageKey);
    if (!sessionId) {
      sessionId = 'sess_' + crypto.randomUUID();
      sessionStorage.setItem(this.sessionStorageKey, sessionId);
    }
    return sessionId;
  }

  getStoredActiveRoomCode(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const value = window.sessionStorage.getItem(this.activeRoomStorageKey);
    return value ? value.trim().toUpperCase() : null;
  }

  private buildHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    if (!this.dataService.isAuthenticated()) {
      headers = headers.set('X-Session-Id', this.getSessionId());
    }
    return headers;
  }

  createRoom(): Observable<DecisionRoom> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<DecisionApiResponse<DecisionRoom>>(
        `${this.apiBase}/rooms/create`,
        {},
        { headers: this.buildHeaders() },
      )
      .pipe(
        map((res) => res.data),
        tap((room) => this.activateRoom(room, 'created')),
        catchError((err) => {
          const message =
            err?.error?.message || 'Khong the tao phong. Thu lai sau.';
          this.errorSubject.next(message);
          return throwError(() => new Error(message));
        }),
        finalize(() => this.loadingSubject.next(false)),
      );
  }

  joinRoom(code: string): Observable<DecisionRoom> {
    const normalizedCode = code.trim().toUpperCase();
    const blockedUntil = this.joinRetryBlockedUntilByCode.get(normalizedCode) ?? 0;
    const now = Date.now();
    if (blockedUntil > now) {
      const waitSeconds = Math.ceil((blockedUntil - now) / 1000);
      const message = `Dang bi gioi han. Thu lai sau ${waitSeconds} giay.`;
      this.errorSubject.next(message);
      return throwError(() => new Error(message));
    }

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .post<DecisionApiResponse<DecisionRoom>>(
        `${this.apiBase}/rooms/join`,
        { code: normalizedCode },
        { headers: this.buildHeaders() },
      )
      .pipe(
        map((res) => res.data),
        tap((room) => this.activateRoom(room, 'joined')),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 429) {
            const retryAfterMs = this.getRetryAfterMs(err);
            this.joinRetryBlockedUntilByCode.set(
              normalizedCode,
              Date.now() + retryAfterMs,
            );
          }

          const message =
            err?.error?.message || 'Khong the tham gia phong. Thu lai sau.';
          this.errorSubject.next(message);
          return throwError(() => new Error(message));
        }),
        finalize(() => this.loadingSubject.next(false)),
      );
  }

  deleteRoom(code: string): Observable<void> {
    const normalizedCode = code.trim().toUpperCase();

    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http
      .delete<DecisionApiResponse<null>>(
        `${this.apiBase}/rooms/${normalizedCode}`,
        { headers: this.buildHeaders() },
      )
      .pipe(
        map(() => void 0),
        tap(() => {
          this.removeRecentRoom(normalizedCode);
          if (this.currentRoomCode === normalizedCode) {
            this.clearActiveRoom();
          }
        }),
        catchError((err: HttpErrorResponse) => {
          const message = err?.error?.message || 'Khong the xoa phong. Thu lai sau.';
          this.errorSubject.next(message);
          return throwError(() => new Error(message));
        }),
        finalize(() => this.loadingSubject.next(false)),
      );
  }

  getPlaces(filters?: DecisionPlacesFilters): Observable<SwipeCard[]> {
    this.errorSubject.next(null);

    return this.fetchPlaces(filters).pipe(
      tap((cards) => this.cardsSubject.next(cards)),
    );
  }

  sendSwipe(
    placeId: string,
    type: 'like' | 'dislike',
  ): Observable<SwipeResult> {
    const roomCode = this.currentRoomCode;
    if (!roomCode) {
      return throwError(() => new Error('Chua tham gia phong nao.'));
    }

    const payload: SwipePayload = {
      room_code: roomCode,
      place_id: placeId,
      type,
    };

    return this.http
      .post<DecisionApiResponse<SwipeResult>>(
        `${this.apiBase}/swipes`,
        payload,
        { headers: this.buildHeaders() },
      )
      .pipe(
        map((res) => res.data),
        tap((result) => {
          if (result.matched && result.match && result.match.place) {
            const matchEvent: MatchEventPayload = {
              room_id: result.match.room_id,
              room_code: this.currentRoomCode || '',
              place: result.match.place,
              matched_at: result.match.created_at,
            };

            const matchKey = result.match.place.id;
            this.processedMatchIds.add(matchKey);

            this.zone.run(() => {
              this.matchSubject.next(matchEvent);
            });
          }
        }),
        catchError((err) => {
          this.handleRoomInvalidError(err, roomCode);
          const message =
            err?.error?.message || 'Khong the gui luot quet. Thu lai sau.';
          this.errorSubject.next(message);
          return throwError(() => new Error(message));
        }),
      );
  }

  private startPolling(roomCode: string): void {
    this.stopPolling();
    this.lastPollTimestamp = new Date().toISOString();
    this.isPollingMatches = false;
    this.isPollingPresence = false;
    this.pollingBlockedUntil = 0;

    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => {
        if (Date.now() < this.pollingBlockedUntil) {
          return;
        }
        this.checkForMatches(roomCode);
        this.checkRoomPresence(roomCode);
      }, this.POLL_INTERVAL_MS);
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private checkForMatches(roomCode: string): void {
    if (this.isPollingMatches) {
      return;
    }

    this.isPollingMatches = true;

    const params: Record<string, string> = {};
    if (this.lastPollTimestamp) {
      params['since'] = this.lastPollTimestamp;
    }

    this.http
      .get<DecisionApiResponse<MatchEventPayload[]>>(
        `${this.apiBase}/rooms/${roomCode}/matches`,
        {
          params,
          headers: this.buildHeaders(),
        },
      )
      .pipe(
        finalize(() => {
          this.isPollingMatches = false;
        }),
      )
      .subscribe({
        next: (res) => {
          if (res.data && res.data.length > 0) {
            this.lastPollTimestamp = new Date().toISOString();

            for (const match of res.data) {
              const matchKey = match.place.id;
              if (!this.processedMatchIds.has(matchKey)) {
                this.processedMatchIds.add(matchKey);
                this.zone.run(() => {
                  this.matchSubject.next(match);
                });
              }
            }
          }
        },
        error: (err: HttpErrorResponse) => {
          this.handlePollingThrottle(err);
          this.handleRoomInvalidError(err, roomCode);
          if (err.status !== 429) {
            console.warn('[DecisionService] Match poll failed:', err?.message);
          }
        },
      });
  }

  private checkRoomPresence(roomCode: string): void {
    if (this.isPollingPresence) {
      return;
    }

    this.isPollingPresence = true;

    this.http
      .get<DecisionApiResponse<DecisionRoom>>(
        `${this.apiBase}/rooms/${roomCode}/presence`,
        { headers: this.buildHeaders() },
      )
      .pipe(
        finalize(() => {
          this.isPollingPresence = false;
        }),
      )
      .subscribe({
        next: (res) => {
          const room = res.data;
          if (!room || this.currentRoomCode !== room.code) {
            return;
          }

          this.roomSubject.next(room);
          this.syncRecentRoomPresence(room);
        },
        error: (err: HttpErrorResponse) => {
          this.handlePollingThrottle(err);
          this.handleRoomInvalidError(err, roomCode);
        },
      });
  }

  removeCard(placeId: string): void {
    const updated = this.cardsSubject.value.filter(
      (card) => card.place.id !== placeId,
    );
    this.cardsSubject.next(updated);
  }

  clearActiveRoom(): void {
    this.stopPolling();
    this.currentRoomCode = null;
    this.lastPollTimestamp = null;
    this.isPollingMatches = false;
    this.isPollingPresence = false;
    this.processedMatchIds.clear();
    this.roomSubject.next(null);
    this.cardsSubject.next([]);
    this.errorSubject.next(null);
    this.clearStoredActiveRoomCode();
  }

  removeRecentRoom(code: string): void {
    const normalizedCode = code.trim().toUpperCase();
    const updated = this.recentRoomsSubject
      .value.filter((room) => room.code !== normalizedCode);

    this.recentRoomsSubject.next(updated);
    this.writeRecentRooms(updated);
  }

  private extractVibeTags(place: Place): string[] {
    const tags: string[] = [];

    if (place.category_labels?.length) {
      tags.push(...place.category_labels.slice(0, 2));
    }

    if (place.rating >= 4.5) {
      tags.push('Danh gia cao');
    }

    if (place.price_range) {
      tags.push(place.price_range);
    }

    if (place.amenity_labels?.length) {
      tags.push(
        ...place.amenity_labels
          .filter((amenity) => !tags.includes(amenity))
          .slice(0, 2),
      );
    }

    return tags.slice(0, 5);
  }

  private activateRoom(
    room: DecisionRoom,
    origin: DecisionRoomOrigin,
  ): void {
    this.roomSubject.next(room);
    this.currentRoomCode = room.code;
    this.processedMatchIds.clear();
    this.cardsSubject.next([]);
    this.storeActiveRoomCode(room.code);
    this.rememberRoom(room, origin);
    this.startPolling(room.code);
    this.checkRoomPresence(room.code);
  }

  private fetchPlaces(filters?: DecisionPlacesFilters): Observable<SwipeCard[]> {
    const normalizedFilters = this.normalizePlaceFilters(filters);

    this.loadingSubject.next(true);

    return this.http
      .get<DecisionApiResponse<Place[]>>(`${this.apiBase}/rooms/places`, {
        params: {
          room_code: this.currentRoomCode || '',
          city_id: normalizedFilters.city_id,
          category: normalizedFilters.category,
          limit: String(normalizedFilters.limit),
        },
        headers: this.buildHeaders(),
      })
      .pipe(
        map((res) =>
          res.data.map((place) => ({
            place,
            vibeTags: this.extractVibeTags(place),
          })),
        ),
        catchError((err) => {
          this.handleRoomInvalidError(err, this.currentRoomCode);
          const message =
            err?.error?.message || 'Khong the tai danh sach dia diem.';
          this.errorSubject.next(message);
          return of([]);
        }),
        finalize(() => this.loadingSubject.next(false)),
      );
  }

  private handleRoomInvalidError(
    err: unknown,
    roomCode: string | null | undefined,
  ): void {
    if (!roomCode || !this.currentRoomCode || this.currentRoomCode !== roomCode) {
      return;
    }

    if (!this.isRoomGoneError(err)) {
      return;
    }

    const message = 'Phong nay da bi xoa hoac khong con ton tai.';
    this.removeRecentRoom(roomCode);
    this.clearActiveRoom();
    this.errorSubject.next(message);
    this.roomInvalidatedSubject.next(message);
  }

  private isRoomGoneError(err: unknown): boolean {
    const httpErr = err as Partial<HttpErrorResponse> | null;
    const status = httpErr?.status;
    return status === 404 || status === 410;
  }

  private handlePollingThrottle(err: HttpErrorResponse): void {
    if (err.status !== 429) {
      return;
    }

    const waitMs = this.getRetryAfterMs(err, 20_000);
    this.pollingBlockedUntil = Math.max(this.pollingBlockedUntil, Date.now() + waitMs);
  }

  private getRetryAfterMs(err: HttpErrorResponse, fallbackMs = 15_000): number {
    const retryAfterHeader = err.headers?.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }

    return fallbackMs;
  }

  private normalizePlaceFilters(
    filters?: DecisionPlacesFilters,
  ): Required<DecisionPlacesFilters> {
    return {
      city_id: filters?.city_id || 'hcm',
      category: filters?.category || '',
      limit: filters?.limit || 20,
    };
  }

  private rememberRoom(
    room: DecisionRoom,
    origin: DecisionRoomOrigin,
  ): void {
    const nextRoom: RecentDecisionRoom = {
      code: room.code,
      status: room.status,
      created_at: room.created_at,
      members_count: room.members_count,
      origin,
      last_used_at: new Date().toISOString(),
      member_avatars: this.extractRoomMemberAvatars(room),
    };

    const updated = [
      nextRoom,
      ...this.recentRoomsSubject.value.filter(
        (item) => item.code !== nextRoom.code,
      ),
    ].slice(0, 8);

    this.recentRoomsSubject.next(updated);
    this.writeRecentRooms(updated);
  }

  private syncRecentRoomPresence(room: DecisionRoom): void {
    const updated = this.recentRoomsSubject.value.map((item) =>
      item.code === room.code
        ? {
            ...item,
            members_count: room.members_count,
            member_avatars: this.extractRoomMemberAvatars(room),
            last_used_at: new Date().toISOString(),
          }
        : item,
    );

    this.recentRoomsSubject.next(updated);
    this.writeRecentRooms(updated);
  }

  private extractRoomMemberAvatars(room: DecisionRoom): string[] {
    const fromDirectList = Array.isArray(room.member_avatars)
      ? room.member_avatars
          .map((avatar) => (typeof avatar === 'string' ? avatar.trim() : ''))
          .filter((avatar) => !!avatar)
      : [];

    if (fromDirectList.length > 0) {
      return fromDirectList;
    }

    const fromMembers = Array.isArray(room.members)
      ? room.members
          .map((member) => {
            const avatar = member?.avatar || member?.avatar_url || '';
            return typeof avatar === 'string' ? avatar.trim() : '';
          })
          .filter((avatar) => !!avatar)
      : [];

    if (fromMembers.length > 0) {
      return fromMembers;
    }

    const currentUserAvatar = this.dataService.currentUser().avatar?.trim();
    return currentUserAvatar ? [currentUserAvatar] : [];
  }

  private readRecentRooms(): RecentDecisionRoom[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const rawValue = window.localStorage.getItem(this.recentRoomsStorageKey);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item): item is RecentDecisionRoom => {
        const memberAvatarsValid =
          !('member_avatars' in item) ||
          item.member_avatars === undefined ||
          (Array.isArray(item.member_avatars) &&
            item.member_avatars.every(
              (avatar: unknown) => typeof avatar === 'string',
            ));

        return (
          typeof item?.code === 'string' &&
          typeof item?.status === 'string' &&
          typeof item?.created_at === 'string' &&
          typeof item?.members_count === 'number' &&
          typeof item?.origin === 'string' &&
          typeof item?.last_used_at === 'string' &&
          memberAvatarsValid
        );
      });
    } catch {
      return [];
    }
  }

  private writeRecentRooms(value: RecentDecisionRoom[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      this.recentRoomsStorageKey,
      JSON.stringify(value),
    );
  }

  private storeActiveRoomCode(code: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(
      this.activeRoomStorageKey,
      code.trim().toUpperCase(),
    );
  }

  private clearStoredActiveRoomCode(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(this.activeRoomStorageKey);
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.matchSubject.complete();
    this.roomSubject.complete();
    this.cardsSubject.complete();
    this.loadingSubject.complete();
    this.errorSubject.complete();
  }
}
