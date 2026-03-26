import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { PaginationMeta, PlaceItineraryOverview } from '../models/app.models';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';

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
  first_page_url?: string;
  from: number | null;
  last_page: number;
  last_page_url?: string;
  links?: BackendPaginationLink[];
  next_page_url?: string | null;
  path?: string;
  per_page: number;
  prev_page_url?: string | null;
  to: number | null;
  total: number;
}

export interface AdminItineraryLocation {
  id: string;
  name: string;
  slug: string;
  main_category?: string | null;
  full_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_link?: string | null;
}

export interface AdminItineraryItem {
  id: number;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  location_id?: string | null;
  activity_title: string;
  activity_type?: string | null;
  note: string | null;
  transport_mode: string | null;
  estimated_cost: string | null;
  travel_minutes_from_previous?: number | null;
  travel_distance_km_from_previous?: string | null;
  sort_order?: number;
  location: AdminItineraryLocation | null;
}

export interface AdminItineraryDay {
  day_number: number;
  date: string | null;
  theme: string | null;
  summary: string | null;
  estimated_cost: string | null;
  travel_minutes: number;
  travel_distance_km: string | null;
  items_count: number;
  items: AdminItineraryItem[];
}

export interface AdminItineraryPreferences {
  tags?: string[];
  trip_style?: string | null;
  companion_type?: string | null;
  energy_level?: string | null;
  max_distance_km_per_day?: number | null;
  must_include_location_ids?: string[];
}

export interface AdminItinerary {
  id: number;
  user_id: number | null;
  title: string;
  destination_city: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number;
  budget: string | null;
  travel_mode: string | null;
  start_time: string | null;
  end_time: string | null;
  preferences_json: AdminItineraryPreferences;
  preferences: AdminItineraryPreferences;
  ai_model: string | null;
  overview: PlaceItineraryOverview | null;
  day_summaries: AdminItineraryDay[];
  map_markers: Array<{
    location_id: string;
    name: string;
    slug?: string;
    main_category?: string | null;
    full_address?: string | null;
    lat: number;
    lng: number;
    google_maps_link?: string | null;
  }>;
  items: AdminItineraryItem[];
  raw_prompt: string | null;
  raw_ai_response: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GenerateItineraryPayload {
  user_id?: number | null;
  title?: string | null;
  destination_city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days: number;
  budget?: number | null;
  travel_mode?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  preferences?: string[];
  trip_style?: string | null;
  companion_type?: string | null;
  energy_level?: string | null;
  max_distance_km_per_day?: number | null;
  must_include_location_ids?: string[];
}

export interface UpdateItineraryPayload extends GenerateItineraryPayload {}

@Injectable({
  providedIn: 'root',
})
export class ItineraryApiService {
  private http = inject(HttpClient);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  fetchItinerariesPaginated(page = 1, perPage = 10): Observable<{ data: AdminItinerary[]; meta: PaginationMeta }> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    return this.http
      .get<BackendApiEnvelope<BackendPaginated<BackendItinerary>>>(`${this.apiBaseUrl}/itineraries`, {
        params,
      })
      .pipe(
        map((response) => ({
          data: response.data.data.map((item) => this.mapItinerary(item)),
          meta: {
            current_page: response.data.current_page,
            per_page: response.data.per_page,
            total: response.data.total,
            last_page: response.data.last_page,
            from: response.data.from,
            to: response.data.to,
          },
        }))
      );
  }

  fetchAllItineraries(perPage = 50): Observable<AdminItinerary[]> {
    return this.fetchItinerariesPage(1, perPage).pipe(
      expand((response) =>
        response.data.current_page < response.data.last_page
          ? this.fetchItinerariesPage(response.data.current_page + 1, perPage)
          : EMPTY
      ),
      map((response) => response.data.data),
      reduce((all, pageData) => [...all, ...pageData], [] as BackendItinerary[]),
      map((items) => items.map((item) => this.mapItinerary(item)))
    );
  }

  getItinerary(id: number): Observable<AdminItinerary> {
    return this.http
      .get<BackendApiEnvelope<BackendItinerary>>(`${this.apiBaseUrl}/itineraries/${id}`)
      .pipe(map((response) => this.mapItinerary(response.data)));
  }

  generateItinerary(payload: GenerateItineraryPayload): Observable<AdminItinerary> {
    return this.http
      .post<BackendApiEnvelope<BackendItinerary>>(`${this.apiBaseUrl}/itineraries/generate`, payload)
      .pipe(map((response) => this.mapItinerary(response.data)));
  }

  updateItinerary(id: number, payload: UpdateItineraryPayload): Observable<AdminItinerary> {
    return this.http
      .patch<BackendApiEnvelope<BackendItinerary>>(`${this.apiBaseUrl}/itineraries/${id}`, payload)
      .pipe(map((response) => this.mapItinerary(response.data)));
  }

  deleteItinerary(id: number): Observable<BackendApiEnvelope<unknown>> {
    return this.http.delete<BackendApiEnvelope<unknown>>(`${this.apiBaseUrl}/itineraries/${id}`);
  }

  private fetchItinerariesPage(page: number, perPage: number) {
    const params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    return this.http.get<BackendApiEnvelope<BackendPaginated<BackendItinerary>>>(
      `${this.apiBaseUrl}/itineraries`,
      { params }
    );
  }

  private mapItinerary(item: BackendItinerary): AdminItinerary {
    return {
      id: item.id,
      user_id: item.user_id,
      title: item.title,
      destination_city: item.destination_city,
      start_date: item.start_date,
      end_date: item.end_date,
      days: item.days,
      budget: item.budget,
      travel_mode: item.travel_mode,
      start_time: item.start_time,
      end_time: item.end_time,
      preferences_json: item.preferences_json ?? {},
      preferences: item.preferences ?? item.preferences_json ?? {},
      ai_model: item.ai_model,
      overview: item.overview ?? null,
      day_summaries: (item.day_summaries ?? []).map((day) => ({
        ...day,
        items: (day.items ?? []).map((entry) => this.mapItem(entry)),
      })),
      map_markers: item.map_markers ?? [],
      items: (item.items ?? []).map((entry) => this.mapItem(entry)),
      raw_prompt: item.raw_prompt,
      raw_ai_response: item.raw_ai_response,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };
  }

  private mapItem(item: BackendItineraryItem): AdminItineraryItem {
    return {
      id: item.id,
      day_number: item.day_number,
      start_time: item.start_time,
      end_time: item.end_time,
      location_id: item.location_id,
      activity_title: item.activity_title,
      activity_type: item.activity_type,
      note: item.note,
      transport_mode: item.transport_mode,
      estimated_cost: item.estimated_cost,
      travel_minutes_from_previous: item.travel_minutes_from_previous,
      travel_distance_km_from_previous: item.travel_distance_km_from_previous,
      sort_order: item.sort_order,
      location: item.location ?? null,
    };
  }
}

interface BackendItineraryLocation {
  id: string;
  name: string;
  slug: string;
  main_category?: string | null;
  full_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_link?: string | null;
}

interface BackendItineraryItem {
  id: number;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  location_id?: string | null;
  activity_title: string;
  activity_type?: string | null;
  note: string | null;
  transport_mode: string | null;
  estimated_cost: string | null;
  travel_minutes_from_previous?: number | null;
  travel_distance_km_from_previous?: string | null;
  sort_order?: number;
  location: BackendItineraryLocation | null;
}

interface BackendItineraryDay {
  day_number: number;
  date: string | null;
  theme: string | null;
  summary: string | null;
  estimated_cost: string | null;
  travel_minutes: number;
  travel_distance_km: string | null;
  items_count: number;
  items: BackendItineraryItem[];
}

interface BackendItinerary {
  id: number;
  user_id: number | null;
  title: string;
  destination_city: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number;
  budget: string | null;
  travel_mode: string | null;
  start_time: string | null;
  end_time: string | null;
  preferences_json?: AdminItineraryPreferences;
  preferences?: AdminItineraryPreferences;
  ai_model: string | null;
  overview?: PlaceItineraryOverview | null;
  day_summaries?: BackendItineraryDay[];
  map_markers?: Array<{
    location_id: string;
    name: string;
    slug?: string;
    main_category?: string | null;
    full_address?: string | null;
    lat: number;
    lng: number;
    google_maps_link?: string | null;
  }>;
  items?: BackendItineraryItem[];
  raw_prompt: string | null;
  raw_ai_response: string | null;
  created_at: string | null;
  updated_at: string | null;
}
