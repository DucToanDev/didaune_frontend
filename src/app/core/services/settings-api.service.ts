import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';

interface BackendApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AdminSettingField {
  name: string;
  label: string;
  type: string;
  sensitive?: boolean;
  value: string;
}

export interface AdminSettingGroup {
  key: string;
  label: string;
  description: string;
  fields: AdminSettingField[];
}

interface AdminSettingsResponse {
  api_key: string;
  model: string;
  base_url: string;
  groups: AdminSettingGroup[];
}

@Injectable({
  providedIn: 'root',
})
export class SettingsApiService {
  private http = inject(HttpClient);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  fetchSettings(): Observable<AdminSettingGroup[]> {
    return this.http
      .get<BackendApiEnvelope<AdminSettingsResponse>>(`${this.apiBaseUrl}/ai-settings`)
      .pipe(map((response) => response.data.groups));
  }

  updateSettings(payload: Record<string, string>): Observable<AdminSettingGroup[]> {
    return this.http
      .patch<BackendApiEnvelope<AdminSettingsResponse>>(`${this.apiBaseUrl}/ai-settings`, payload)
      .pipe(map((response) => response.data.groups));
  }
}
