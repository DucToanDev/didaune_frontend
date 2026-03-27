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

export interface AdminUser {
  id: number;
  name: string;
  full_name: string | null;
  username: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
  auth_provider: string | null;
  membership_tier: string | null;
  points: number;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role?: string | null;
  membership_tier?: string | null;
  points?: number;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string | null;
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role?: string | null;
  membership_tier?: string | null;
  points?: number;
  is_active?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UserApiService {
  private http = inject(HttpClient);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  fetchUsersPaginated(options: {
    search?: string;
    role?: string;
    isActive?: boolean | null;
    page?: number;
    perPage?: number;
  } = {}): Observable<{ data: AdminUser[]; meta: PaginationMeta }> {
    const { search = '', role = '', isActive = null, page = 1, perPage = 12 } = options;

    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    if (role) {
      params = params.set('role', role);
    }

    if (isActive !== null) {
      params = params.set('is_active', isActive ? '1' : '0');
    }

    return this.http
      .get<BackendApiEnvelope<BackendPaginated<AdminUser>>>(`${this.apiBaseUrl}/users`, { params })
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

  getUser(id: number): Observable<AdminUser> {
    return this.http
      .get<BackendApiEnvelope<AdminUser>>(`${this.apiBaseUrl}/users/${id}`)
      .pipe(map((response) => response.data));
  }

  createUser(payload: CreateUserPayload): Observable<AdminUser> {
    return this.http
      .post<BackendApiEnvelope<AdminUser>>(`${this.apiBaseUrl}/users`, payload)
      .pipe(map((response) => response.data));
  }

  updateUser(id: number, payload: UpdateUserPayload): Observable<AdminUser> {
    return this.http
      .patch<BackendApiEnvelope<AdminUser>>(`${this.apiBaseUrl}/users/${id}`, payload)
      .pipe(map((response) => response.data));
  }

  deleteUser(id: number): Observable<unknown> {
    return this.http.delete<BackendApiEnvelope<unknown>>(`${this.apiBaseUrl}/users/${id}`);
  }
}
