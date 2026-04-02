import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PaginationMeta } from '../models/app.models';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';

interface BackendApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface BackendPaginated<T> {
  current_page: number;
  data: T[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface AdminLocationSubmission {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  name: string;
  category: string;
  city: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  description: string | null;
  price_range: string | null;
  website: string | null;
  google_maps_link: string | null;
  main_image_url: string | null;
  gallery_images_json: string[] | null;
  amenities_json: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  approved_location_id: string | null;
  approved_location_slug: string | null;
  submitted_ip: string | null;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LocationSubmissionApiService {
  private http = inject(HttpClient);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  fetchSubmissionsPaginated(options: {
    search?: string;
    status?: string;
    category?: string;
    contactEmail?: string;
    page?: number;
    perPage?: number;
  } = {}): Observable<{ data: AdminLocationSubmission[]; meta: PaginationMeta }> {
    const {
      search = '',
      status = '',
      category = '',
      contactEmail = '',
      page = 1,
      perPage = 12,
    } = options;

    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (status) {
      params = params.set('status', status);
    }

    if (category) {
      params = params.set('category', category);
    }

    if (contactEmail.trim()) {
      params = params.set('contact_email', contactEmail.trim());
    }

    return this.http
      .get<BackendApiEnvelope<BackendPaginated<AdminLocationSubmission>>>(
        `${this.apiBaseUrl}/admin/location-submissions`,
        { params },
      )
      .pipe(
        map((response) => ({
          data: response.data.data,
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

  fetchApprovedSubmissionsByEmail(
    contactEmail: string,
    perPage = 8,
  ): Observable<AdminLocationSubmission[]> {
    return this.fetchSubmissionsPaginated({
      contactEmail,
      status: 'approved',
      page: 1,
      perPage,
    }).pipe(map((response) => response.data));
  }

  getSubmission(id: string): Observable<AdminLocationSubmission> {
    return this.http
      .get<BackendApiEnvelope<AdminLocationSubmission>>(
        `${this.apiBaseUrl}/admin/location-submissions/${id}`,
      )
      .pipe(map((response) => response.data));
  }

  updateSubmission(
    id: string,
    payload: { status: 'pending' | 'approved' | 'rejected'; admin_note?: string | null },
  ): Observable<AdminLocationSubmission> {
    return this.http
      .patch<BackendApiEnvelope<AdminLocationSubmission>>(
        `${this.apiBaseUrl}/admin/location-submissions/${id}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }
}
