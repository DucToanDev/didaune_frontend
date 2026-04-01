import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  combineLatest,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  Amenity,
  Category,
  City,
  Database,
  District,
  ExternalLocation,
  HomePageData,
  Place,
  PlaceReview,
  User,
  Ward,
} from '../models/app.models';
import { PROVINCE_MAPPINGS } from '../config/location-api.config';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';
import {
  AMENITY_CONFIG,
  CATEGORY_CONFIG,
} from '../config/place-taxonomy.config';
import { buildUiAvatarUrl } from '../utils/avatar.utils';
import { LocationApiService } from './location-api.service';
import { PlaceMapperService } from './place-mapper.service';

interface ApiProvince {
  code: number;
  name: string;
  wards?: Ward[];
}

interface BackendApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface BackendAuthPayload {
  user: BackendUser;
  token?: string;
  token_type?: string;
}

interface BackendUser {
  id: number | string;
  name: string;
  email: string;
  avatar_url?: string | null;
  bio?: string | null;
  membership_tier?: string | null;
  points?: number | null;
  role?: string | null;
}

const DEFAULT_USER: User = {
  id: 'guest',
  name: 'Khach',
  email: '',
  avatar: buildUiAvatarUrl('Khach', 'f97316', 'ffffff', 128),
  bio: '',
  membership: 'Guest',
  points: 0,
  role: null,
};

type StoredReviewDraft = Pick<
  PlaceReview,
  'place_slug' | 'rating' | 'comment' | 'images'
>;

type PendingAuthAction =
  | {
      type: 'favorite';
      slug: string;
    }
  | {
      type: 'review';
      placeSlug: string;
    }
  | {
      type: 'planner-ai';
    }
  | {
      type: 'planner-manual';
    };

interface ProtectedAuthPrompt {
  mode: 'login' | 'register';
  title: string;
  description: string;
  confirmText: string;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private locationApi = inject(LocationApiService);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  private provinceApiUrl = 'https://provinces.open-api.vn/api/v2/';
  private favoritesStorageKey = 'didaune_favorites';
  private reviewsStorageKey = 'didaune_reviews';
  private userStorageKey = 'didaune_user';
  private authTokenStorageKey = 'didaune_auth_token';
  private coordinatesStorageKey = 'didaune_coordinates';
  private recentViewedStorageKey = 'didaune_recent_viewed';
  private pendingAuthActionStorageKey = 'didaune_pending_auth_action';
  private postLoginRedirectStorageKey = 'didaune_post_login_redirect';
  private adminBypassEmails = ['tranthienvu215@gmail.com'];

  currentCityId = signal('hcm');
  currentDistrictId = signal('all');
  currentWardCode = signal('');
  currentWardName = signal('');
  searchQuery = signal('');
  selectedCategoryId = signal('all');
  selectedAmenityId = signal('all');
  sortOption = signal<'popular' | 'rating' | 'name' | 'new'>('popular');
  mobileSidebarOpen = signal(false);
  authModalRequest = signal<'login' | 'register' | null>(null);
  protectedAuthPrompt = signal<ProtectedAuthPrompt | null>(null);
  currentCoordinates = signal<{ lat: number; lng: number } | null>(
    this.readStorage<{ lat: number; lng: number } | null>(
      this.coordinatesStorageKey,
      null,
    ),
  );

  favoriteSlugs = signal<string[]>(
    this.readStorage<string[]>(this.favoritesStorageKey, []),
  );
  recentViewedSlugs = signal<string[]>(
    this.readStorage<string[]>(this.recentViewedStorageKey, []),
  );
  internalReviews = signal<PlaceReview[]>(
    this.readStorage<PlaceReview[]>(this.reviewsStorageKey, []),
  );
  currentUser = signal<User>(
    this.readStorage<User>(this.userStorageKey, DEFAULT_USER),
  );
  backendError = signal<string | null>(null);
  private favoriteSlugs$ = toObservable(this.favoriteSlugs).pipe(
    startWith(this.favoriteSlugs()),
  );
  private recentViewedSlugs$ = toObservable(this.recentViewedSlugs).pipe(
    startWith(this.recentViewedSlugs()),
  );
  private internalReviews$ = toObservable(this.internalReviews).pipe(
    startWith(this.internalReviews()),
  );
  private categories$ = of(CATEGORY_CONFIG).pipe(shareReplay(1));
  private amenities$ = of(AMENITY_CONFIG).pipe(shareReplay(1));

  private cities$ = this.http.get<ApiProvince[]>(this.provinceApiUrl).pipe(
    map((provinces) => {
      const provinceMap = new Map(
        provinces.map((province) => [province.code, province]),
      );

      return PROVINCE_MAPPINGS.slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((mapping) => {
          const province = provinceMap.get(mapping.provinceCode);
          return province ? { id: mapping.id, name: province.name } : null;
        })
        .filter((city): city is City => city !== null);
    }),
    catchError(() => of([])),
    shareReplay(1),
  );

  private places$ = combineLatest([
    toObservable(this.currentCityId).pipe(startWith(this.currentCityId())),
    toObservable(this.currentWardCode).pipe(startWith(this.currentWardCode())),
  ]).pipe(
    switchMap(([cityId, wardCode]) =>
      this.locationApi.fetchAllLocations(cityId, wardCode).pipe(
        tap(() => this.backendError.set(null)),
        catchError(() => {
          this.backendError.set(
            'Không kết nối được tới backend. Vui lòng kiểm tra API và thử lại.',
          );
          return of([] as Place[]);
        }),
      ),
    ),
    shareReplay(1),
  );

  private districts$ = this.places$.pipe(
    map((places) =>
      this.uniqueDistricts(
        places.map((place) => ({
          id: place.district_id,
          city_id: place.city_id,
          name: place.district_name,
        })),
      ),
    ),
    shareReplay(1),
  );

  private homeData$ = combineLatest([
    toObservable(this.currentCityId).pipe(startWith(this.currentCityId())),
    toObservable(this.currentWardCode).pipe(startWith(this.currentWardCode())),
    toObservable(this.searchQuery).pipe(startWith(this.searchQuery())),
    toObservable(this.currentCoordinates).pipe(
      startWith(this.currentCoordinates()),
    ),
  ]).pipe(
    switchMap(([cityId, wardCode, search, coordinates]) =>
      this.locationApi
        .fetchHomeData(cityId, wardCode, search, coordinates)
        .pipe(
          tap(() => this.backendError.set(null)),
          catchError(() => {
            this.backendError.set(
              'Không kết nối được tới backend. Vui lòng kiểm tra API và thử lại.',
            );
            return of(this.createEmptyHomeData(cityId, wardCode));
          }),
        ),
    ),
    shareReplay(1),
  );

  constructor() {}

  getDb(): Observable<Database> {
    return of({
      cities: [],
      districts: [],
      categories: CATEGORY_CONFIG,
      amenities: AMENITY_CONFIG,
      places: [],
      users: [],
      reviews: [],
    });
  }

  getPlaces(): Observable<Place[]> {
    return this.places$;
  }

  getHotPlaces(): Observable<Place[]> {
    return this.getPlaces().pipe(
      map((places) => [...places].filter((place) => place.is_hot).slice(0, 6)),
    );
  }

  getHomeData(): Observable<HomePageData> {
    return this.homeData$;
  }

  getCategories(): Observable<Category[]> {
    return this.categories$;
  }

  getAmenities(): Observable<Amenity[]> {
    return this.amenities$;
  }

  getCities(): Observable<City[]> {
    return this.cities$;
  }

  getWardsByCityId(cityId: string): Observable<Ward[]> {
    const provinceCode = this.getProvinceCodeByCityId(cityId);

    if (!provinceCode) {
      return of([]);
    }

    return this.http
      .get<ApiProvince>(`${this.provinceApiUrl}p/${provinceCode}?depth=2`)
      .pipe(
        map((province) => province.wards ?? []),
        catchError(() => of([])),
      );
  }

  getDistricts(): Observable<District[]> {
    return this.districts$;
  }

  getAreaOptions(): Observable<District[]> {
    return this.getPlaces().pipe(
      map((places) =>
        this.uniqueDistricts(
          places.map((place) => ({
            id: place.area_id,
            city_id: place.city_id,
            name: place.area_name,
          })),
        ),
      ),
      shareReplay(1),
    );
  }

  getDistrictsByCity(cityId: string): Observable<District[]> {
    return this.getDistricts().pipe(
      map((districts) =>
        districts.filter((district) => district.city_id === cityId),
      ),
    );
  }

  getPlaceBySlug(slug: string): Observable<Place | undefined> {
    return this.locationApi.getPlaceBySlug(slug).pipe(
      tap(() => this.backendError.set(null)),
      catchError(() => {
        this.backendError.set(
          'Không kết nối được tới backend. Vui lòng kiểm tra API và thử lại.',
        );
        return of(undefined);
      }),
    );
  }

  getRelatedPlaces(place: Place): Observable<Place[]> {
    return this.getPlaces().pipe(
      map((places) =>
        places
          .filter(
            (candidate) =>
              candidate.slug !== place.slug &&
              (candidate.district_id === place.district_id ||
                candidate.categories.some((category) =>
                  place.categories.includes(category),
                )),
          )
          .slice(0, 4),
      ),
    );
  }

  getReviewsByPlaceSlug(slug: string): Observable<PlaceReview[]> {
    return combineLatest([
      this.getPlaceBySlug(slug),
      this.internalReviews$,
    ]).pipe(
      map(([place, internalReviews]) => {
        if (!place) {
          return [];
        }

        const saved = internalReviews.filter(
          (review) => review.place_slug === slug,
        );
        return [...saved, ...place.reviews].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }),
    );
  }

  getMergedReviews(place: Place): Observable<PlaceReview[]> {
    return this.internalReviews$.pipe(
      map((internalReviews) => {
        const saved = internalReviews.filter(
          (review) => review.place_slug === place.slug,
        );
        return [...saved, ...place.reviews].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }),
    );
  }

  getFavoritePlaces(): Observable<Place[]> {
    return combineLatest([this.getPlaces(), this.favoriteSlugs$]).pipe(
      map(([places, favoriteSlugs]) =>
        places.filter((place) => favoriteSlugs.includes(place.slug)),
      ),
    );
  }

  getRecentlyViewedPlaces(limit = 8): Observable<Place[]> {
    return combineLatest([this.getPlaces(), this.recentViewedSlugs$]).pipe(
      map(([places, recentViewedSlugs]) => {
        const placeMap = new Map(places.map((place) => [place.slug, place]));

        return recentViewedSlugs
          .map((slug) => placeMap.get(slug))
          .filter((place): place is Place => Boolean(place))
          .slice(0, limit);
      }),
    );
  }

  recordRecentlyViewed(place: Place) {
    const nextSlugs = [
      place.slug,
      ...this.recentViewedSlugs().filter((slug) => slug !== place.slug),
    ].slice(0, 8);

    this.recentViewedSlugs.set(nextSlugs);
    this.writeStorage(this.recentViewedStorageKey, nextSlugs);
  }

  toggleFavorite(slug: string) {
    if (!this.isAuthenticated()) {
      this.requestAuthForAction({
        type: 'favorite',
        slug,
      });
      return;
    }

    this.getPlaceBySlug(slug).subscribe((place) => {
      if (!place) {
        return;
      }

      const isFavorite = this.favoriteSlugs().includes(slug);
      const userId = this.getBackendUserId();

      const request$ = isFavorite
        ? this.locationApi.removeFavorite(userId, place.id)
        : this.locationApi.addFavorite(userId, place.id);

      request$
        .pipe(
          map(() => {
            const next = isFavorite
              ? this.favoriteSlugs().filter((item) => item !== slug)
              : [...this.favoriteSlugs(), slug];

            this.favoriteSlugs.set([...new Set(next)]);
            this.writeStorage(this.favoritesStorageKey, this.favoriteSlugs());
          }),
          catchError(() => {
            const next = isFavorite
              ? this.favoriteSlugs().filter((item) => item !== slug)
              : [...this.favoriteSlugs(), slug];

            this.favoriteSlugs.set([...new Set(next)]);
            this.writeStorage(this.favoritesStorageKey, this.favoriteSlugs());
            return of(null);
          }),
        )
        .subscribe();
    });
  }

  isFavorite(slug: string): boolean {
    return this.favoriteSlugs().includes(slug);
  }

  isAuthenticated(): boolean {
    const user = this.currentUser();
    const parsedId = Number(user.id);

    return Boolean(
      user.email &&
      ((Number.isFinite(parsedId) && parsedId > 0) ||
        (typeof user.id === 'string' && user.id !== 'guest')),
    );
  }

  hasAdminRole(): boolean {
    const currentEmail = this.currentUser().email?.trim().toLowerCase();
    if (currentEmail && this.adminBypassEmails.includes(currentEmail)) {
      return true;
    }

    const currentRole = this.currentUser().role?.trim().toLowerCase();
    if (this.isAdminLikeRole(currentRole)) {
      return true;
    }

    const tokenClaims = this.readTokenClaims();
    const roleClaim = tokenClaims?.['role'];
    const role = typeof roleClaim === 'string' ? roleClaim.toLowerCase() : null;
    if (this.isAdminLikeRole(role)) {
      return true;
    }

    const roles = tokenClaims?.['roles'];
    if (Array.isArray(roles)) {
      return roles.some((item) => this.isAdminLikeRole(String(item).toLowerCase()));
    }

    const permissions = tokenClaims?.['permissions'];
    if (Array.isArray(permissions)) {
      return permissions.some((item) => String(item).toLowerCase().includes('admin'));
    }

    return false;
  }

  submitReview(review: StoredReviewDraft) {
    const currentUser = this.currentUser();
    const nextReview: PlaceReview = {
      id: `local-${Date.now()}`,
      place_slug: review.place_slug,
      source: 'internal',
      user_name: currentUser.name,
      avatar: currentUser.avatar,
      rating: review.rating,
      comment: review.comment,
      created_at: new Date().toISOString(),
      images: review.images,
      reviewer_profile: null,
      is_local_guide: false,
    };

    const nextReviews = [nextReview, ...this.internalReviews()];
    this.internalReviews.set(nextReviews);
    this.writeStorage(this.reviewsStorageKey, nextReviews);
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<BackendApiEnvelope<BackendUser | BackendAuthPayload>>(
        `${this.apiBaseUrl}/auth/login`,
        {
          email,
          password,
        },
      )
      .pipe(
        map((response) => this.extractAuthPayload(response.data)),
        tap(({ user, token }) => {
          this.persistCurrentUser(user);
          this.persistAuthToken(token);
        }),
        map(({ user }) => user),
      );
  }

  loginWithGoogle(accessToken: string): Observable<User> {
    return this.http
      .post<BackendApiEnvelope<BackendAuthPayload>>(
        `${this.apiBaseUrl}/auth/google`,
        {
          access_token: accessToken,
        },
      )
      .pipe(
        map((response) => this.extractAuthPayload(response.data)),
        tap(({ user, token }) => {
          this.persistCurrentUser(user);
          this.persistAuthToken(token);
        }),
        map(({ user }) => user),
      );
  }

  loginWithFacebook(accessToken: string): Observable<User> {
    return this.http
      .post<BackendApiEnvelope<BackendAuthPayload>>(
        `${this.apiBaseUrl}/auth/facebook`,
        {
          access_token: accessToken,
        },
      )
      .pipe(
        map((response) => this.extractAuthPayload(response.data)),
        tap(({ user, token }) => {
          this.persistCurrentUser(user);
          this.persistAuthToken(token);
        }),
        map(({ user }) => user),
      );
  }

  logout(): Observable<void> {
    const token = this.getAuthToken();

    if (!token) {
      this.clearAuthSession();
      return of(void 0);
    }

    return this.http
      .post<BackendApiEnvelope<unknown>>(`${this.apiBaseUrl}/auth/logout`, {})
      .pipe(
        tap(() => this.clearAuthSession()),
        map(() => void 0),
        catchError((error) => {
          if (error?.status === 401) {
            this.clearAuthSession();
            return of(void 0);
          }

          return throwError(() => error);
        }),
      );
  }

  getAuthToken(): string | null {
    return this.readStorage<string | null>(this.authTokenStorageKey, null);
  }

  register(name: string, email: string, password: string): Observable<User> {
    return this.http
      .post<BackendApiEnvelope<BackendUser | BackendAuthPayload>>(
        `${this.apiBaseUrl}/auth/register`,
        {
          name,
          email,
          password,
          password_confirmation: password,
        },
      )
      .pipe(
        map((response) => this.extractAuthPayload(response.data)),
        tap(({ user, token }) => {
          this.persistCurrentUser(user);
          this.persistAuthToken(token);
        }),
        map(({ user }) => user),
      );
  }

  upsertCurrentUser(user: Partial<User>) {
    const nextUser: User = {
      ...this.currentUser(),
      ...user,
      id: user.id ?? this.currentUser().id,
      name: user.name?.trim() || this.currentUser().name,
      email: user.email?.trim() || this.currentUser().email,
    };

    this.persistCurrentUser(nextUser);
  }

  getCategoryLabel(categoryId: string): string {
    return (
      CATEGORY_CONFIG.find((category) => category.id === categoryId)?.name ??
      categoryId
    );
  }

  getAmenityLabel(amenityId: string): string {
    return (
      AMENITY_CONFIG.find((amenity) => amenity.id === amenityId)?.name ??
      amenityId
    );
  }

  resetFilters() {
    this.currentDistrictId.set('all');
    this.currentWardCode.set('');
    this.currentWardName.set('');
    this.selectedCategoryId.set('all');
    this.selectedAmenityId.set('all');
    this.sortOption.set('popular');
  }

  setCurrentCoordinates(coordinates: { lat: number; lng: number } | null) {
    this.currentCoordinates.set(coordinates);
    this.writeStorage(this.coordinatesStorageKey, coordinates);
  }

  requestAuthModal(mode: 'login' | 'register' = 'login') {
    this.authModalRequest.set(mode);
  }

  requestProtectedAuthModal(mode: 'login' | 'register' = 'login') {
    this.protectedAuthPrompt.set({
      mode,
      title: 'Cần đăng nhập',
      description: 'Bạn cần đăng nhập để tiếp tục sử dụng chức năng này.',
      confirmText: mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập',
    });
  }

  requestAuthForAction(
    action: PendingAuthAction,
    mode: 'login' | 'register' = 'login',
  ) {
    this.writeSessionStorage(this.pendingAuthActionStorageKey, action);
    this.requestProtectedAuthModal(mode);
  }

  clearAuthModalRequest() {
    this.authModalRequest.set(null);
  }

  confirmProtectedAuthPrompt() {
    const prompt = this.protectedAuthPrompt();
    if (!prompt) {
      return;
    }

    this.protectedAuthPrompt.set(null);
    this.requestAuthModal(prompt.mode);
  }

  dismissProtectedAuthPrompt() {
    this.protectedAuthPrompt.set(null);
  }

  resumePendingAuthAction() {
    const action = this.readSessionStorage<PendingAuthAction | null>(
      this.pendingAuthActionStorageKey,
      null,
    );

    if (!action) {
      return;
    }

    this.removeSessionStorage(this.pendingAuthActionStorageKey);

    if (action.type === 'favorite') {
      this.toggleFavorite(action.slug);
    }
  }

  setPostLoginRedirect(url: string) {
    this.writeStorage(this.postLoginRedirectStorageKey, url);
  }

  consumePostLoginRedirect(): string | null {
    const redirectUrl = this.readStorage<string | null>(
      this.postLoginRedirectStorageKey,
      null,
    );

    if (redirectUrl) {
      this.removeStorage(this.postLoginRedirectStorageKey);
    }

    return redirectUrl;
  }

  private refreshFavoritesFromApi() {
    const userId = this.getBackendUserId();

    this.locationApi
      .fetchFavoriteSlugs(userId)
      .pipe(catchError(() => of(this.favoriteSlugs())))
      .subscribe((slugs) => {
        this.favoriteSlugs.set([...new Set(slugs)]);
        this.writeStorage(this.favoritesStorageKey, this.favoriteSlugs());
      });
  }

  private uniqueDistricts(districts: District[]): District[] {
    const mapById = new Map<string, District>();

    for (const district of districts) {
      mapById.set(district.id, district);
    }

    return [...mapById.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private readStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
      return fallback;
    }

    const value = window.localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private writeStorage<T>(key: string, value: T) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }

  private removeStorage(key: string) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(key);
  }

  private readSessionStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
      return fallback;
    }

    const value = window.sessionStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private writeSessionStorage<T>(key: string, value: T) {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(key, JSON.stringify(value));
  }

  private removeSessionStorage(key: string) {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.removeItem(key);
  }

  private createEmptyHomeData(cityId: string, wardCode: string): HomePageData {
    return {
      hero: {
        province_code: this.getProvinceCodeByCityId(cityId) ?? null,
        ward_code: wardCode ? Number(wardCode) : null,
        total_places: 0,
        district_count: 0,
        ward_count: 0,
      },
      featured_places: [],
      trending_places: [],
      new_places: [],
      nearby_places: [],
      demand_categories: [],
      top_categories: [],
      top_areas: [],
    };
  }

  private getProvinceCodeByCityId(cityId: string): number | undefined {
    return PROVINCE_MAPPINGS.find((mapping) => mapping.id === cityId)
      ?.provinceCode;
  }

  private getBackendUserId(): number {
    const parsed = Number(this.currentUser().id);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : BACKEND_API_CONFIG.defaultUserId;
  }

  private mapBackendUserToUser(user: BackendUser): User {
    const name = user.name?.trim() || DEFAULT_USER.name;

    return {
      id: String(user.id),
      name,
      email: user.email?.trim() || DEFAULT_USER.email,
      avatar:
        user.avatar_url?.trim() ||
        buildUiAvatarUrl(name, 'f97316', 'fff', 128),
      bio: user.bio?.trim() || DEFAULT_USER.bio,
      membership: user.membership_tier?.trim() || DEFAULT_USER.membership,
      points:
        typeof user.points === 'number' ? user.points : DEFAULT_USER.points,
      role: user.role?.trim() || null,
    };
  }

  private extractAuthPayload(payload: BackendUser | BackendAuthPayload): {
    user: User;
    token: string | null;
  } {
    if ('user' in payload) {
      return {
        user: this.mapBackendUserToUser(payload.user),
        token: payload.token ?? null,
      };
    }

    return {
      user: this.mapBackendUserToUser(payload),
      token: null,
    };
  }

  private persistCurrentUser(user: User) {
    this.currentUser.set(user);
    this.writeStorage(this.userStorageKey, user);
    this.refreshFavoritesFromApi();
  }

  private persistAuthToken(token: string | null) {
    if (!token) {
      return;
    }

    this.writeStorage(this.authTokenStorageKey, token);

    const tokenRole = this.extractRoleFromToken(token);
    if (tokenRole && this.currentUser().role !== tokenRole) {
      this.persistCurrentUser({
        ...this.currentUser(),
        role: tokenRole,
      });
    }
  }

  private readTokenClaims(): Record<string, unknown> | null {
    const token = this.getAuthToken();
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private extractRoleFromToken(token: string): string | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    try {
      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const decoded = atob(padded);
      const payload = JSON.parse(decoded) as Record<string, unknown>;
      const role = payload['role'];
      if (typeof role === 'string' && role.trim()) {
        return role.trim();
      }
      const roles = payload['roles'];
      if (Array.isArray(roles)) {
        const adminRole = roles.find((item) => typeof item === 'string');
        return typeof adminRole === 'string' ? adminRole.trim() : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private isAdminLikeRole(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'super_admin';
  }

  private clearAuthSession() {
    this.currentUser.set(DEFAULT_USER);
    this.favoriteSlugs.set([]);
    this.writeStorage(this.userStorageKey, DEFAULT_USER);
    this.writeStorage(this.favoritesStorageKey, []);
    this.removeStorage(this.authTokenStorageKey);
  }
}
