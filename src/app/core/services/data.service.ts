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
import { AMENITY_CONFIG, CATEGORY_CONFIG } from '../config/place-taxonomy.config';
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

interface BackendUser {
  id: number | string;
  name: string;
  email: string;
  avatar_url?: string | null;
  bio?: string | null;
  membership_tier?: string | null;
  points?: number | null;
}

const DEFAULT_USER: User = {
  id: 'guest',
  name: 'Khach',
  email: '',
  avatar: 'https://ui-avatars.com/api/?name=Khach&background=e2e8f0&color=475569&size=128',
  bio: '',
  membership: 'Guest',
  points: 0,
};

type StoredReviewDraft = Pick<PlaceReview, 'place_slug' | 'rating' | 'comment' | 'images'>;

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private locationApi = inject(LocationApiService);
  private placeMapper = inject(PlaceMapperService);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;
  private fallbackDataUrl = 'assets/data/db.json';
  private fallbackExternalDataUrl = 'cafe-in-ho-chi-minh-city-ho-chi-minh-city-vietnam.json';
  private provinceApiUrl = 'https://provinces.open-api.vn/api/v2/';
  private favoritesStorageKey = 'didaune_favorites';
  private reviewsStorageKey = 'didaune_reviews';
  private userStorageKey = 'didaune_user';
  private coordinatesStorageKey = 'didaune_coordinates';
  private recentViewedStorageKey = 'didaune_recent_viewed';

  currentCityId = signal('hcm');
  currentDistrictId = signal('all');
  currentWardCode = signal('');
  currentWardName = signal('');
  searchQuery = signal('');
  selectedCategoryId = signal('all');
  selectedAmenityId = signal('all');
  sortOption = signal<'popular' | 'rating' | 'name' | 'new'>('popular');
  currentCoordinates = signal<{ lat: number; lng: number } | null>(
    this.readStorage<{ lat: number; lng: number } | null>(this.coordinatesStorageKey, null)
  );

  favoriteSlugs = signal<string[]>(this.readStorage<string[]>(this.favoritesStorageKey, []));
  recentViewedSlugs = signal<string[]>(this.readStorage<string[]>(this.recentViewedStorageKey, []));
  internalReviews = signal<PlaceReview[]>(
    this.readStorage<PlaceReview[]>(this.reviewsStorageKey, [])
  );
  currentUser = signal<User>(this.readStorage<User>(this.userStorageKey, DEFAULT_USER));
  private favoriteSlugs$ = toObservable(this.favoriteSlugs).pipe(
    startWith(this.favoriteSlugs())
  );
  private recentViewedSlugs$ = toObservable(this.recentViewedSlugs).pipe(
    startWith(this.recentViewedSlugs())
  );
  private internalReviews$ = toObservable(this.internalReviews).pipe(
    startWith(this.internalReviews())
  );

  private db$ = this.http.get<Database>(this.fallbackDataUrl).pipe(shareReplay(1));
  private externalLocations$ = this.http
    .get<ExternalLocation[]>(this.fallbackExternalDataUrl)
    .pipe(shareReplay(1));

  private categories$ = of(CATEGORY_CONFIG).pipe(shareReplay(1));
  private amenities$ = of(AMENITY_CONFIG).pipe(shareReplay(1));

  private cities$ = this.http.get<ApiProvince[]>(this.provinceApiUrl).pipe(
    map((provinces) => {
      const provinceMap = new Map(provinces.map((province) => [province.code, province]));

      return PROVINCE_MAPPINGS
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((mapping) => {
          const province = provinceMap.get(mapping.provinceCode);
          return province ? { id: mapping.id, name: province.name } : null;
        })
        .filter((city): city is City => city !== null);
    }),
    catchError(() => this.db$.pipe(map((db) => db.cities))),
    shareReplay(1)
  );

  private fallbackPlaces$ = combineLatest([
    this.externalLocations$,
    this.categories$,
    this.amenities$,
  ]).pipe(
    map(([locations, categories, amenities]) =>
      locations.map((location, index, source) =>
        this.placeMapper.normalizeExternalLocation(
          location,
          index,
          source.length,
          categories,
          amenities
        )
      )
    ),
    catchError(() =>
      this.db$.pipe(
        map((db) =>
          db.places.map((place) => ({
            ...place,
            id: String(place.id),
            area_id: this.slugify(place.address),
            area_name: place.address,
            district_name: place.address,
            ward_name: '',
            city_name: db.cities.find((city) => city.id === place.city_id)?.name ?? '',
            gallery: [{ id: `${place.slug}-cover`, url: place.image }],
            category_labels: place.categories,
            source_categories: place.categories,
            amenity_labels: place.amenities,
            description: place.name,
            status: 'Dang mo cua',
            phone: null,
            website: null,
            google_maps_link: null,
            menu_link: null,
            reservations_link: null,
            latitude: undefined,
            longitude: undefined,
            distance_km: null,
            hours: [],
            highlights: [],
            owner_name: null,
            owner_posts: [],
            competitors: [],
            reviews: [],
            can_claim: false,
            is_temporarily_closed: false,
            is_permanently_closed: false,
          }))
        )
      )
    ),
    shareReplay(1)
  );

  private places$ = combineLatest([
    toObservable(this.currentCityId).pipe(startWith(this.currentCityId())),
    toObservable(this.currentWardCode).pipe(startWith(this.currentWardCode())),
  ]).pipe(
    switchMap(([cityId, wardCode]) =>
      this.locationApi.fetchAllLocations(cityId, wardCode).pipe(
        catchError(() => this.fallbackPlaces$)
      )
    ),
    shareReplay(1)
  );

  private districts$ = this.places$.pipe(
    map((places) =>
      this.uniqueDistricts(
        places.map((place) => ({
          id: place.district_id,
          city_id: place.city_id,
          name: place.district_name,
        }))
      )
    ),
    shareReplay(1)
  );

  private homeData$ = combineLatest([
    toObservable(this.currentCityId).pipe(startWith(this.currentCityId())),
    toObservable(this.currentWardCode).pipe(startWith(this.currentWardCode())),
    toObservable(this.searchQuery).pipe(startWith(this.searchQuery())),
    toObservable(this.currentCoordinates).pipe(startWith(this.currentCoordinates())),
  ]).pipe(
    switchMap(([cityId, wardCode, search, coordinates]) =>
      this.locationApi.fetchHomeData(cityId, wardCode, search, coordinates).pipe(
        catchError(() =>
          combineLatest([this.getHotPlaces(), this.getCategories(), this.getAreaOptions()]).pipe(
            map(([hotPlaces, categories, areas]) => ({
              hero: {
                province_code: this.getProvinceCodeByCityId(cityId) ?? null,
                ward_code: wardCode ? Number(wardCode) : null,
                total_places: hotPlaces.length,
                district_count: areas.length,
                ward_count: 0,
              },
              featured_places: hotPlaces.slice(0, 8),
              trending_places: hotPlaces.slice(0, 8),
              new_places: hotPlaces.slice(0, 8),
              nearby_places: hotPlaces.slice(0, 6),
              demand_categories: categories.slice(0, 5).map((category) => ({
                id: category.id,
                name: category.name,
                icon: category.icon,
                color: category.color,
                count: 0,
              })),
              top_categories: categories.slice(0, 5).map((category) => ({
                name: category.name,
                count: 0,
              })),
              top_areas: areas.slice(0, 6).map((area) => ({
                name: area.name,
                count: 0,
              })),
            }))
          )
        )
      )
    ),
    shareReplay(1)
  );

  constructor() {}

  getDb(): Observable<Database> {
    return this.db$;
  }

  getPlaces(): Observable<Place[]> {
    return this.places$;
  }

  getHotPlaces(): Observable<Place[]> {
    return this.getPlaces().pipe(
      map((places) => [...places].filter((place) => place.is_hot).slice(0, 6))
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

    return this.http.get<ApiProvince>(`${this.provinceApiUrl}p/${provinceCode}?depth=2`).pipe(
      map((province) => province.wards ?? []),
      catchError(() => of([]))
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
          }))
        )
      ),
      shareReplay(1)
    );
  }

  getDistrictsByCity(cityId: string): Observable<District[]> {
    return this.getDistricts().pipe(
      map((districts) => districts.filter((district) => district.city_id === cityId))
    );
  }

  getPlaceBySlug(slug: string): Observable<Place | undefined> {
    return this.locationApi.getPlaceBySlug(slug).pipe(
      catchError(() =>
        this.getPlaces().pipe(map((places) => places.find((place) => place.slug === slug)))
      )
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
                candidate.categories.some((category) => place.categories.includes(category)))
          )
          .slice(0, 4)
      )
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

        const saved = internalReviews.filter((review) => review.place_slug === slug);
        return [...saved, ...place.reviews].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
    );
  }

  getMergedReviews(place: Place): Observable<PlaceReview[]> {
    return this.internalReviews$.pipe(
      map((internalReviews) => {
        const saved = internalReviews.filter((review) => review.place_slug === place.slug);
        return [...saved, ...place.reviews].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
    );
  }

  getFavoritePlaces(): Observable<Place[]> {
    return combineLatest([
      this.getPlaces(),
      this.favoriteSlugs$,
    ]).pipe(
      map(([places, favoriteSlugs]) => places.filter((place) => favoriteSlugs.includes(place.slug)))
    );
  }

  getRecentlyViewedPlaces(limit = 8): Observable<Place[]> {
    return combineLatest([
      this.getPlaces(),
      this.recentViewedSlugs$,
    ]).pipe(
      map(([places, recentViewedSlugs]) => {
        const placeMap = new Map(places.map((place) => [place.slug, place]));

        return recentViewedSlugs
          .map((slug) => placeMap.get(slug))
          .filter((place): place is Place => Boolean(place))
          .slice(0, limit);
      })
    );
  }

  recordRecentlyViewed(place: Place) {
    const nextSlugs = [place.slug, ...this.recentViewedSlugs().filter((slug) => slug !== place.slug)]
      .slice(0, 8);

    this.recentViewedSlugs.set(nextSlugs);
    this.writeStorage(this.recentViewedStorageKey, nextSlugs);
  }

  toggleFavorite(slug: string) {
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
          })
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
        ((Number.isFinite(parsedId) && parsedId > 0) || (typeof user.id === 'string' && user.id !== 'guest'))
    );
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
      .post<BackendApiEnvelope<BackendUser>>(`${this.apiBaseUrl}/auth/login`, {
        email,
        password,
      })
      .pipe(
        map((response) => this.mapBackendUserToUser(response.data)),
        tap((user) => this.persistCurrentUser(user))
      );
  }

  register(name: string, email: string, password: string): Observable<User> {
    return this.http
      .post<BackendApiEnvelope<BackendUser>>(`${this.apiBaseUrl}/auth/register`, {
        name,
        email,
        password,
        password_confirmation: password,
      })
      .pipe(
        map((response) => this.mapBackendUserToUser(response.data)),
        tap((user) => this.persistCurrentUser(user))
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
    return CATEGORY_CONFIG.find((category) => category.id === categoryId)?.name ?? categoryId;
  }

  getAmenityLabel(amenityId: string): string {
    return AMENITY_CONFIG.find((amenity) => amenity.id === amenityId)?.name ?? amenityId;
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

  private getProvinceCodeByCityId(cityId: string): number | undefined {
    return PROVINCE_MAPPINGS.find((mapping) => mapping.id === cityId)?.provinceCode;
  }

  private getBackendUserId(): number {
    const parsed = Number(this.currentUser().id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : BACKEND_API_CONFIG.defaultUserId;
  }

  private mapBackendUserToUser(user: BackendUser): User {
    const name = user.name?.trim() || DEFAULT_USER.name;

    return {
      id: String(user.id),
      name,
      email: user.email?.trim() || DEFAULT_USER.email,
      avatar:
        user.avatar_url?.trim() ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          name
        )}&background=f97316&color=fff&size=128`,
      bio: user.bio?.trim() || DEFAULT_USER.bio,
      membership: user.membership_tier?.trim() || DEFAULT_USER.membership,
      points: typeof user.points === 'number' ? user.points : DEFAULT_USER.points,
    };
  }

  private persistCurrentUser(user: User) {
    this.currentUser.set(user);
    this.writeStorage(this.userStorageKey, user);
    this.refreshFavoritesFromApi();
  }
}
