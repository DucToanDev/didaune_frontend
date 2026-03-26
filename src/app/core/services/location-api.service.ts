import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
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
  amenities?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class LocationApiService {
  private http = inject(HttpClient);
  private mapper = inject(PlaceMapperService);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  fetchAllLocations(cityId: string, wardCode: string): Observable<Place[]> {
    return this.fetchLocationPage(cityId, wardCode, 1).pipe(
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
    );
  }

  fetchLocationsPaginated(options: {
    cityId: string;
    wardCode?: string;
    wardName?: string;
    areaId?: string;
    categoryId?: string;
    amenityId?: string;
    search?: string;
    sort?: 'popular' | 'rating' | 'name' | 'new';
    page?: number;
    perPage?: number;
  }): Observable<PaginatedPlacesResult> {
    const {
      cityId,
      wardCode = '',
      wardName = '',
      areaId = 'all',
      categoryId = 'all',
      amenityId = 'all',
      search = '',
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

    if (wardCode) {
      params = params.set('ward_code', wardCode);
    } else if (wardName.trim()) {
      params = params.set('ward', wardName.trim());
    }

    if (areaId && areaId !== 'all') {
      params = params.set('district', areaId);
    }

    if (categoryId && categoryId !== 'all') {
      params = params.set('category', categoryId);
    }

    if (amenityId && amenityId !== 'all') {
      params = params.set('amenity', amenityId);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
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
    return this.http.post<{
      success: boolean;
      message: string;
      data?: { id: string; status: string; created_at: string };
    }>(`${this.apiBaseUrl}/owner/location-submissions`, payload);
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
