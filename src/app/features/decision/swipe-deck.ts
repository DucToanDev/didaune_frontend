import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  animate,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { DecisionService } from '../../core/services/decision.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Category,
  City,
} from '../../core/models/app.models';
import {
  MatchEventPayload,
  RecentDecisionRoom,
  SwipeCard,
} from '../../core/models/decision.models';
import { MatchOverlayComponent } from './match-overlay/match-overlay';
import Swal from 'sweetalert2';

type SwipeDirection = 'left' | 'right' | null;
type RoomSurveyFilters = {
  cityId: string;
  categories: string[];
};
type RecentRoomsTab = 'all' | 'created' | 'joined';

@Component({
  selector: 'app-swipe-deck',
  standalone: true,
  imports: [CommonModule, FormsModule, MatchOverlayComponent],
  templateUrl: './swipe-deck.html',
  animations: [
    trigger('cardSwipe', [
      state('center', style({ transform: 'translateX(0) rotate(0)', opacity: 1 })),
      state('swipeRight', style({ transform: 'translateX(150%) rotate(25deg)', opacity: 0 })),
      state('swipeLeft', style({ transform: 'translateX(-150%) rotate(-25deg)', opacity: 0 })),
      transition('center => swipeRight', [
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)'),
      ]),
      transition('center => swipeLeft', [
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)'),
      ]),
      transition('void => center', [
        style({ transform: 'scale(0.85) translateY(40px)', opacity: 0 }),
        animate('350ms cubic-bezier(0, 0, 0.2, 1)'),
      ]),
    ]),
    trigger('feedbackPulse', [
      transition(':enter', [
        animate('400ms ease-out', keyframes([
          style({ transform: 'scale(0.3)', opacity: 0, offset: 0 }),
          style({ transform: 'scale(1.25)', opacity: 1, offset: 0.5 }),
          style({ transform: 'scale(1)', opacity: 1, offset: 1 }),
        ])),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 })),
      ]),
    ]),
  ],
})
export class SwipeDeckComponent implements OnInit, OnDestroy {
  private decisionService = inject(DecisionService);
  private dataService = inject(DataService);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  readonly roomAvatarLimit = 4;
  private surveyFilters = signal<RoomSurveyFilters | null>(null);
  private cityOptions = signal<City[]>([]);
  private categoryOptions = signal<Category[]>([]);

  cards = signal<SwipeCard[]>([]);
  loading = signal(false);
  roomJoined = signal(false);
  roomCodeInput = signal('');
  roomCode = signal<string | null>(null);
  roomMembersCount = signal<number>(0);
  error = signal<string | null>(null);
  recentRooms = signal<RecentDecisionRoom[]>([]);
  copiedRoomCode = signal<string | null>(null);
  activeRecentRoomsTab = signal<RecentRoomsTab>('all');

  dragDeltaX = signal(0);
  isDragging = signal(false);
  swipeState = signal<'center' | 'swipeLeft' | 'swipeRight'>('center');
  swipeDirection = signal<SwipeDirection>(null);
  isAnimating = signal(false);

  matchData = signal<MatchEventPayload | null>(null);
  showMatch = signal(false);

  currentCard = computed(() => this.cards()[0] ?? null);
  nextCard = computed(() => this.cards()[1] ?? null);
  cardsRemaining = computed(() => this.cards().length);
  isEmpty = computed(
    () => !this.loading() && this.cards().length === 0 && this.roomJoined(),
  );
  hasRecentRooms = computed(() => this.recentRooms().length > 0);
  createdRoomsCount = computed(
    () => this.recentRooms().filter((room) => room.origin === 'created').length,
  );
  joinedRoomsCount = computed(
    () => this.recentRooms().filter((room) => room.origin === 'joined').length,
  );
  filteredRecentRooms = computed(() => {
    const tab = this.activeRecentRoomsTab();
    const rooms = this.recentRooms();

    if (tab === 'created') {
      return rooms.filter((room) => room.origin === 'created');
    }

    if (tab === 'joined') {
      return rooms.filter((room) => room.origin === 'joined');
    }

    return rooms;
  });

  cardTransform = computed(() => {
    const dx = this.dragDeltaX();
    const rotate = dx * 0.12;
    return `translateX(${dx}px) rotate(${rotate}deg)`;
  });

  likeOpacity = computed(() => Math.min(Math.max(this.dragDeltaX() / 120, 0), 1));
  dislikeOpacity = computed(() => Math.min(Math.max(-this.dragDeltaX() / 120, 0), 1));

  private startX = 0;
  private startY = 0;
  private isHorizontalSwipe: boolean | null = null;

  ngOnInit(): void {
    this.decisionService.match$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        this.matchData.set(payload);
        this.showMatch.set(true);
      });

    this.decisionService.cards$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cards) => this.cards.set(cards));

    this.decisionService.room$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((room) => {
        this.roomJoined.set(!!room);
        this.roomCode.set(room?.code ?? null);
        this.roomMembersCount.set(room?.members_count ?? 0);
      });

    this.decisionService.recentRooms$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rooms) => this.recentRooms.set(rooms));

    this.decisionService.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.loading.set(value));

    this.decisionService.error$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.error.set(value));

    this.decisionService.roomInvalidated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        this.toast.error(message);
      });

    this.dataService.getCities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cities) => this.cityOptions.set(cities));

    this.dataService.getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categories) => this.categoryOptions.set(categories));

    this.restoreActiveRoom();
  }

  ngOnDestroy(): void {
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
  }

  async createRoom(): Promise<void> {
    const survey = await this.openCreateRoomSurvey();
    if (!survey) {
      return;
    }
    this.surveyFilters.set(survey);

    this.decisionService
      .createRoom()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadPlaces(survey),
      });
  }

  joinRoom(codeOverride?: string): void {
    const code = (codeOverride ?? this.roomCodeInput()).trim().toUpperCase();
    if (!code) {
      return;
    }

    this.roomCodeInput.set(code);

    this.decisionService
      .joinRoom(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.surveyFilters.set(null);
          this.loadPlaces();
        },
      });
  }

  joinRecentRoom(room: RecentDecisionRoom): void {
    this.joinRoom(room.code);
  }

  loadPlaces(filtersOverride?: RoomSurveyFilters): void {
    const filters = filtersOverride ?? this.surveyFilters();
    const category = filters?.categories.length ? filters.categories.join(',') : '';

    this.decisionService
      .getPlaces({
        limit: 20,
        city_id: filters?.cityId || 'hcm',
        category,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  backToLobby(): void {
    this.decisionService.clearActiveRoom();
    this.roomCodeInput.set('');
    this.cards.set([]);
    this.showMatch.set(false);
    this.matchData.set(null);
    this.surveyFilters.set(null);
    this.resetCardState();
  }

  private restoreActiveRoom(): void {
    const storedCode = this.decisionService.getStoredActiveRoomCode();
    if (!storedCode) {
      return;
    }

    this.joinRoom(storedCode);
  }

  copyRoomCode(code: string | null = this.roomCode()): void {
    if (!code) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => undefined);
    }

    this.copiedRoomCode.set(code);

    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }

    this.copyResetTimer = setTimeout(() => {
      this.copiedRoomCode.set(null);
      this.copyResetTimer = null;
    }, 1800);
  }

  async removeRecentRoom(code: string, event?: Event): Promise<void> {
    event?.stopPropagation();

    const result = await this.toast.confirm({
      title: `Xoa phong ${code}?`,
      text: 'Phong se bi xoa trong he thong. Cac thanh vien dang trong phong se bi vang ra.',
      confirmButtonText: 'Xoa phong',
      cancelButtonText: 'Huy',
      icon: 'warning',
    });

    if (!result.isConfirmed) {
      return;
    }

    this.decisionService
      .deleteRoom(code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Da xoa phong.');
        },
        error: (err) => {
          this.toast.error(err?.message || 'Xoa phong that bai.');
        },
      });
  }

  onPointerDown(event: PointerEvent): void {
    if (this.isAnimating()) return;
    this.isDragging.set(true);
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.isHorizontalSwipe = null;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (this.isHorizontalSwipe === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      this.isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
    }

    if (this.isHorizontalSwipe === false) return;

    event.preventDefault();
    this.dragDeltaX.set(dx);

    if (dx > 40) {
      this.swipeDirection.set('right');
    } else if (dx < -40) {
      this.swipeDirection.set('left');
    } else {
      this.swipeDirection.set(null);
    }
  }

  onPointerUp(): void {
    if (!this.isDragging()) return;
    this.isDragging.set(false);

    const dx = this.dragDeltaX();
    const threshold = 100;

    if (dx > threshold) {
      this.confirmSwipe('right');
    } else if (dx < -threshold) {
      this.confirmSwipe('left');
    } else {
      this.dragDeltaX.set(0);
      this.swipeDirection.set(null);
    }
  }

  swipeViaButton(direction: 'left' | 'right'): void {
    if (this.isAnimating() || !this.currentCard()) return;
    this.confirmSwipe(direction);
  }

  private confirmSwipe(direction: 'left' | 'right'): void {
    const card = this.currentCard();
    if (!card || this.isAnimating()) return;

    this.isAnimating.set(true);
    this.swipeDirection.set(direction);
    this.swipeState.set(direction === 'right' ? 'swipeRight' : 'swipeLeft');

    const type = direction === 'right' ? 'like' : 'dislike';

    this.decisionService
      .sendSwipe(card.place.id, type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => this.resetCardState(),
      });
  }

  onSwipeAnimationDone(): void {
    if (this.swipeState() === 'center') return;

    const card = this.currentCard();
    if (card) {
      this.decisionService.removeCard(card.place.id);
      this.cards.update((list) => list.slice(1));
    }

    this.resetCardState();
  }

  private resetCardState(): void {
    this.swipeState.set('center');
    this.swipeDirection.set(null);
    this.dragDeltaX.set(0);
    this.isAnimating.set(false);
  }

  closeMatch(): void {
    this.showMatch.set(false);
    this.matchData.set(null);
  }

  formatRecentRoomDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  roomOriginLabel(room: RecentDecisionRoom): string {
    return room.origin === 'created' ? 'Ban tao' : 'Da tham gia';
  }

  roomMembersLabel(count: number): string {
    return `${count || 1} thanh vien`;
  }

  roomAvatarSlots(room: RecentDecisionRoom): number[] {
    const knownAvatarCount = (room.member_avatars ?? []).filter((avatar) =>
      typeof avatar === 'string' && avatar.trim().length > 0,
    ).length;
    const total = knownAvatarCount > 0
      ? Math.min(knownAvatarCount, this.roomAvatarLimit)
      : 1;
    return Array.from({ length: Math.min(total, this.roomAvatarLimit) }, (_, index) => index);
  }

  roomAvatarInitial(room: RecentDecisionRoom, index: number): string {
    const seed = `${room.code}-${index}`;
    const codePointSum = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return alphabet[codePointSum % alphabet.length];
  }

  roomAvatarBackground(room: RecentDecisionRoom, index: number): string {
    const seed = `${room.code}-${index}`;
    const codePointSum = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const hue = codePointSum % 360;
    return `linear-gradient(135deg, hsl(${hue} 78% 58%), hsl(${(hue + 36) % 360} 72% 44%))`;
  }

  roomAvatarUrl(room: RecentDecisionRoom, index: number): string | null {
    const avatar = room.member_avatars?.[index];
    if (!avatar || typeof avatar !== 'string') {
      return null;
    }
    const normalized = avatar.trim();
    return normalized ? normalized : null;
  }

  roomAvatarOverflow(room: RecentDecisionRoom): number {
    const knownAvatarCount = (room.member_avatars ?? []).filter((avatar) =>
      typeof avatar === 'string' && avatar.trim().length > 0,
    ).length;
    if (knownAvatarCount <= this.roomAvatarLimit) {
      return 0;
    }
    return knownAvatarCount - this.roomAvatarLimit;
  }

  isRoomCodeCopied(code: string | null): boolean {
    return !!code && this.copiedRoomCode() === code;
  }

  setRecentRoomsTab(tab: RecentRoomsTab): void {
    this.activeRecentRoomsTab.set(tab);
  }

  trackByPlace(_: number, card: SwipeCard): string {
    return card.place.id;
  }

  trackByRoomCode(_: number, room: RecentDecisionRoom): string {
    return room.code;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private async openCreateRoomSurvey(): Promise<RoomSurveyFilters | null> {
    const cityOptions = this.cityOptions().length
      ? this.cityOptions()
      : [
          { id: 'hcm', name: 'TP Ho Chi Minh' },
          { id: 'hn', name: 'Ha Noi' },
          { id: 'dn', name: 'Da Nang' },
        ];
    const categoryOptions = this.categoryOptions().slice(0, 12);
    const previous = this.surveyFilters();

    const html = `
      <div style="text-align:left;display:grid;gap:12px;margin-top:8px">
        <div>
          <label for="decision-city" style="display:block;font-weight:700;margin-bottom:6px">Lay dia diem o dau?</label>
          <select id="decision-city" class="swal2-input" style="margin:0;width:100%">
            ${cityOptions
              .map(
                (city) =>
                  `<option value="${this.escapeHtml(city.id)}">${this.escapeHtml(city.name)}</option>`,
              )
              .join('')}
          </select>
        </div>
        <div>
          <p style="font-weight:700;margin:0 0 8px 0">Danh muc nao? (chon nhieu)</p>
          <div style="max-height:220px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;padding:10px;display:grid;gap:8px">
            ${categoryOptions
              .map(
                (category) => `
                  <label style="display:flex;gap:8px;align-items:center;font-size:14px">
                    <input type="checkbox" name="decision-category" value="${this.escapeHtml(category.name)}" />
                    <span>${this.escapeHtml(category.name)}</span>
                  </label>
                `,
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    const result = await Swal.fire<RoomSurveyFilters>({
      title: 'Khoi tao room',
      html,
      showCancelButton: true,
      confirmButtonText: 'Tao phong',
      cancelButtonText: 'Huy',
      focusConfirm: false,
      confirmButtonColor: '#ea580c',
      didOpen: () => {
        const cityEl = document.getElementById('decision-city') as HTMLSelectElement | null;
        if (cityEl) {
          cityEl.value = previous?.cityId || cityOptions[0]?.id || 'hcm';
        }

        const selectedCategories = new Set(previous?.categories || []);
        document
          .querySelectorAll<HTMLInputElement>('input[name="decision-category"]')
          .forEach((checkbox) => {
            checkbox.checked = selectedCategories.has(checkbox.value);
          });
      },
      preConfirm: () => {
        const cityEl = document.getElementById('decision-city') as HTMLSelectElement | null;
        const cityId = cityEl?.value?.trim() || '';
        const categories = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[name="decision-category"]:checked'),
        )
          .map((checkbox) => checkbox.value.trim())
          .filter((item) => !!item);

        if (!cityId) {
          Swal.showValidationMessage('Vui long chon thanh pho.');
          return undefined;
        }
        if (!categories.length) {
          Swal.showValidationMessage('Vui long chon it nhat 1 danh muc.');
          return undefined;
        }

        return { cityId, categories };
      },
    });

    return result.isConfirmed ? result.value ?? null : null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
