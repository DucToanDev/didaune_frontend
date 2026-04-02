import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  EMPTY,
  Observable,
  catchError,
  expand,
  map,
  reduce,
  shareReplay,
  throwError,
} from 'rxjs';
import {
  HomePageData,
  PaginatedPlacesResult,
  Place,
} from '../models/app.models';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';
import { PROVINCE_MAPPINGS } from '../config/location-api.config';
import { BackendLocation, PlaceMapperService } from './place-mapper.service';

interface BackendApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface BackendPaginationLink {
  url: string | null;
  label: string;
  active: boolean;
}

interface BackendPaginated<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  links: BackendPaginationLink[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

interface BackendFavorite {
  location?: BackendLocation | null;
}

interface BackendImportResponse {
  success: boolean;
  message: string;
  data?: {
    imported?: number;
    created?: number;
    skipped?: number;
    batch_id?: string | null;
    file_name?: string | null;
  } | null;
}

interface BackendHomeHero {
  province_code: number | null;
  ward_code: number | null;
  total_places: number;
  district_count: number;
  ward_count: number;
}

interface BackendHomeSummary {
  id?: string;
  icon?: string;
  color?: string;
  name: string;
  count: number;
}

interface BackendHomePayload {
  hero: BackendHomeHero;
  featured_places: BackendLocation[];
  trending_places: BackendLocation[];
  new_places: BackendLocation[];
  nearby_places: BackendLocation[];
  demand_categories: BackendHomeSummary[];
  top_categories: BackendHomeSummary[];
  top_areas: BackendHomeSummary[];
}

export interface OwnerLocationSubmissionPayload {
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  name: string;
  category: 'cafe' | 'hotel' | 'homestay' | 'restaurant' | 'travel';
  city?: string | null;
  district?: string | null;
  ward?: string | null;
  address?: string | null;
  description?: string | null;
  price_range?: string | null;
  website?: string | null;
  google_maps_link?: string | null;
  main_image?: File | null;
  gallery_images?: File[];
  amenities?: string[];
}

export interface UpdateLocationPayload {
  name?: string;
  description?: string | null;
  main_category?: string | null;
  full_address?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  price_range?: string | null;
  phone?: string | null;
  website?: string | null;
  google_maps_link?: string | null;
  featured_image?: string | null;
  status?: string | null;
  is_temporarily_closed?: boolean;
  is_permanently_closed?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LocationApiService {
  private http = inject(HttpClient);
  private mapper = inject(PlaceMapperService);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;
  private allLocationsCache = new Map<string, Observable<Place[]>>();

  fetchAllLocations(cityId: string, wardCode: string): Observable<Place[]> {
    const cacheKey = `${cityId}:${wardCode}`;
    const cached = this.allLocationsCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const request$ = this.fetchLocationPage(cityId, wardCode, 1).pipe(
      expand((response) =>
        response.data.current_page < response.data.last_page
          ? this.fetchLocationPage(
              cityId,
              wardCode,
              response.data.current_page + 1,
            )
          : EMPTY,
      ),
      map((response) => response.data.data),
      reduce((all, pageData) => [...all, ...pageData], [] as BackendLocation[]),
      map((locations) =>
        locations.map((location, index, source) =>
          this.mapper.normalizeBackendLocation(
            location,
            index,
            source.length,
            cityId,
          ),
        ),
      ),
      shareReplay(1),
      catchError((error) => {
        this.allLocationsCache.delete(cacheKey);
        return throwError(() => error);
      }),
    );

    this.allLocationsCache.set(cacheKey, request$);
    return request$;
  }

  fetchLocationsPaginated(options: {
    cityId: string;
    search?: string;
    wardCode?: string;
    wardName?: string;
    districtName?: string;
    areaId?: string;
    categoryId?: string;
    amenityId?: string;
    sort?: 'popular' | 'rating' | 'name' | 'new';
    page?: number;
    perPage?: number;
  }): Observable<PaginatedPlacesResult> {
    const {
      cityId,
      search = '',
      wardCode = '',
      wardName = '',
      districtName = '',
      areaId = 'all',
      categoryId = 'all',
      amenityId = 'all',
      sort = 'popular',
      page = 1,
      perPage = 12,
    } = options;

    let params = new HttpParams()
      .set('per_page', String(perPage))
      .set('page', String(page));

    const provinceCode = this.getProvinceCodeByCityId(cityId);

    if (provinceCode) {
      params = params.set('province_code', String(provinceCode));
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (wardCode) {
      params = params.set('ward_code', wardCode);
    } else if (wardName.trim()) {
      params = params.set('ward', wardName.trim());
    }

    if (districtName.trim()) {
      params = params.set('district', districtName.trim());
    } else if (areaId && areaId !== 'all') {
      params = params.set('district', areaId);
    }

    if (categoryId && categoryId !== 'all') {
      params = params.set('category', categoryId);
    }

    if (amenityId && amenityId !== 'all') {
      params = params.set('amenity', amenityId);
    }

    const backendSort =
      sort === 'popular' ? 'reviews_count' : sort === 'new' ? 'latest' : sort;
    params = params.set('sort', backendSort);

    return this.http
      .get<BackendApiEnvelope<BackendPaginated<BackendLocation>>>(
        `${this.apiBaseUrl}/locations`,
        {
          params,
        },
      )
      .pipe(
        map((response) => ({
          data: response.data.data.map((location, index, source) =>
            this.mapper.normalizeBackendLocation(
              location,
              index,
              source.length,
              cityId,
            ),
          ),
          meta: {
            current_page: response.data.current_page,
            per_page: response.data.per_page,
            total: response.data.total,
            last_page: response.data.last_page,
            from: response.data.from,
            to: response.data.to,
          },
        })),
      );
  }

  fetchHomeData(
    cityId: string,
    wardCode: string,
    search: string,
    coordinates: { lat: number; lng: number } | null,
  ): Observable<HomePageData> {
    let params = new HttpParams();
    const provinceCode = this.getProvinceCodeByCityId(cityId);

    if (provinceCode) {
      params = params.set('province_code', String(provinceCode));
    }

    if (wardCode) {
      params = params.set('ward_code', wardCode);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (coordinates) {
      params = params
        .set('lat', String(coordinates.lat))
        .set('lng', String(coordinates.lng));
    }

    return this.http
      .get<
        BackendApiEnvelope<BackendHomePayload>
      >(`${this.apiBaseUrl}/home`, { params })
      .pipe(
        map((response) => ({
          hero: response.data.hero,
          featured_places: response.data.featured_places.map(
            (location, index, source) =>
              this.mapper.normalizeBackendLocation(
                location,
                index,
                source.length,
                cityId,
              ),
          ),
          trending_places: response.data.trending_places.map(
            (location, index, source) =>
              this.mapper.normalizeBackendLocation(
                location,
                index,
                source.length,
                cityId,
              ),
          ),
          new_places: response.data.new_places.map((location, index, source) =>
            this.mapper.normalizeBackendLocation(
              location,
              index,
              source.length,
              cityId,
            ),
          ),
          nearby_places: response.data.nearby_places.map(
            (location, index, source) =>
              this.mapper.normalizeBackendLocation(
                location,
                index,
                source.length,
                cityId,
              ),
          ),
          demand_categories: response.data.demand_categories,
          top_categories: response.data.top_categories,
          top_areas: response.data.top_areas,
        })),
      );
  }

  getPlaceBySlug(slug: string): Observable<Place> {
    return this.http
      .get<
        BackendApiEnvelope<BackendLocation> | BackendLocation
      >(`${this.apiBaseUrl}/locations/slug/${slug}`)
      .pipe(
        map((response) => {
          const location = 'data' in response ? response.data : response;
          return this.mapper.normalizeBackendLocation(location, 0, 1);
        }),
      );
  }

  getPlaceById(id: string, fallbackCityId = 'hcm'): Observable<Place> {
    return this.http
      .get<
        BackendApiEnvelope<BackendLocation>
      >(`${this.apiBaseUrl}/locations/${id}`)
      .pipe(
        map((response) =>
          this.mapper.normalizeBackendLocation(
            response.data,
            0,
            1,
            fallbackCityId,
          ),
        ),
      );
  }

  updateLocation(
    id: string,
    payload: UpdateLocationPayload,
    fallbackCityId = 'hcm',
  ): Observable<Place> {
    return this.http
      .patch<
        BackendApiEnvelope<BackendLocation>
      >(`${this.apiBaseUrl}/locations/${id}`, payload)
      .pipe(
        map((response) =>
          this.mapper.normalizeBackendLocation(
            response.data,
            0,
            1,
            fallbackCityId,
          ),
        ),
      );
  }

  fetchTrendingLocations(cityId = 'hcm'): Observable<Place[]> {
    return this.http
      .get<
        BackendApiEnvelope<BackendLocation[]>
      >(`${this.apiBaseUrl}/locations/trending`)
      .pipe(
        map((response) =>
          response.data.map((location, index, source) =>
            this.mapper.normalizeBackendLocation(
              location,
              index,
              source.length,
              cityId,
            ),
          ),
        ),
      );
  }

  fetchNearbyLocations(
    lat: number,
    lng: number,
    radius = 5,
    cityId = 'hcm',
  ): Observable<Place[]> {
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lng', String(lng))
      .set('radius', String(radius));

    return this.http
      .get<BackendApiEnvelope<BackendLocation[]>>(
        `${this.apiBaseUrl}/locations/nearby`,
        {
          params,
        },
      )
      .pipe(
        map((response) =>
          response.data.map((location, index, source) =>
            this.mapper.normalizeBackendLocation(
              location,
              index,
              source.length,
              cityId,
            ),
          ),
        ),
      );
  }

  importLocations(
    file: File,
    truncate = false,
  ): Observable<BackendImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('truncate', truncate ? 'true' : 'false');

    return this.http.post<BackendImportResponse>(
      `${this.apiBaseUrl}/locations/import`,
      formData,
    );
  }

  deleteLocation(
    id: string,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiBaseUrl}/locations/${id}`,
    );
  }

  deleteImportBatch(batchId: string): Observable<{
    success: boolean;
    message: string;
    data?: { deleted_count?: number; import_batch_id?: string | null };
  }> {
    return this.http.delete<{
      success: boolean;
      message: string;
      data?: { deleted_count?: number; import_batch_id?: string | null };
    }>(`${this.apiBaseUrl}/locations/import-batches/${batchId}`);
  }

  fetchFavoriteSlugs(userId: number): Observable<string[]> {
    return this.http
      .get<
        BackendApiEnvelope<BackendFavorite[]>
      >(`${this.apiBaseUrl}/users/${userId}/favorites`)
      .pipe(
        map((response) =>
          response.data
            .map((favorite) => favorite.location?.slug)
            .filter((slug): slug is string => Boolean(slug)),
        ),
      );
  }

  addFavorite(userId: number, locationId: string): Observable<unknown> {
    return this.http.post(`${this.apiBaseUrl}/users/${userId}/favorites`, {
      location_id: locationId,
    });
  }

  removeFavorite(userId: number, locationId: string): Observable<unknown> {
    return this.http.delete(
      `${this.apiBaseUrl}/users/${userId}/favorites/${locationId}`,
    );
  }

  submitOwnerLocation(payload: OwnerLocationSubmissionPayload): Observable<{
    success: boolean;
    message: string;
    data?: { id: string; status: string; created_at: string };
  }> {
    const formData = new FormData();

    formData.append('contact_name', payload.contact_name);
    formData.append('contact_phone', payload.contact_phone);
    formData.append('name', payload.name);
    formData.append('category', payload.category);

    if (payload.contact_email) {
      formData.append('contact_email', payload.contact_email);
    }

    if (payload.city) {
      formData.append('city', payload.city);
    }

    if (payload.district) {
      formData.append('district', payload.district);
    }

    if (payload.ward) {
      formData.append('ward', payload.ward);
    }

    if (payload.address) {
      formData.append('address', payload.address);
    }

    if (payload.description) {
      formData.append('description', payload.description);
    }

    if (payload.price_range) {
      formData.append('price_range', payload.price_range);
    }

    if (payload.website) {
      formData.append('website', payload.website);
    }

    if (payload.google_maps_link) {
      formData.append('google_maps_link', payload.google_maps_link);
    }

    if (payload.main_image) {
      formData.append('main_image', payload.main_image);
    }

    payload.gallery_images?.forEach((file) => {
      formData.append('gallery_images[]', file, file.name);
    });

    payload.amenities?.forEach((item) => {
      formData.append('amenities[]', item);
    });

    return this.http.post<{
      success: boolean;
      message: string;
      data?: { id: string; status: string; created_at: string };
    }>(`${this.apiBaseUrl}/owner/location-submissions`, formData);
  }

  private fetchLocationPage(
    cityId: string,
    wardCode: string,
    page: number,
  ): Observable<BackendApiEnvelope<BackendPaginated<BackendLocation>>> {
    let params = new HttpParams()
      .set('per_page', '50')
      .set('page', String(page));
    const provinceCode = this.getProvinceCodeByCityId(cityId);

    if (provinceCode) {
      params = params.set('province_code', String(provinceCode));
    }

    if (wardCode) {
      params = params.set('ward_code', wardCode);
    }

    return this.http.get<BackendApiEnvelope<BackendPaginated<BackendLocation>>>(
      `${this.apiBaseUrl}/locations`,
      { params },
    );
  }

  private getProvinceCodeByCityId(cityId: string): number | undefined {
    return PROVINCE_MAPPINGS.find((mapping) => mapping.id === cityId)
      ?.provinceCode;
  }
}
