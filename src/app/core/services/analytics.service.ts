import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { BACKEND_API_CONFIG } from '../config/backend-api.config';
import { DataService } from './data.service';

interface AnalyticsPayload {
  visitor_id: string;
  session_id: string;
  user_id?: number;
  event_name: string;
  path?: string;
  page_title?: string;
  referrer?: string;
  language?: string;
  timezone?: string;
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
  metadata?: Record<string, unknown>;
  occurred_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private dataService = inject(DataService);
  private apiBaseUrl = BACKEND_API_CONFIG.baseUrl;

  private visitorStorageKey = 'didaune_visitor_id';
  private sessionStorageKey = 'didaune_session_id';
  private sessionLastSeenStorageKey = 'didaune_session_last_seen_at';
  private sessionTimeoutMs = 30 * 60 * 1000;

  trackPageView(path: string, pageTitle?: string) {
    this.trackEvent('page_view', {
      path,
      page_title: pageTitle,
    });
  }

  trackEvent(
    eventName: string,
    options?: {
      path?: string;
      page_title?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const payload = this.buildPayload(eventName, options);

    if (!payload) {
      return;
    }

    this.http
      .post(`${this.apiBaseUrl}/analytics/events`, payload)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private buildPayload(
    eventName: string,
    options?: {
      path?: string;
      page_title?: string;
      metadata?: Record<string, unknown>;
    }
  ): AnalyticsPayload | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const visitorId = this.getOrCreateVisitorId();
    const sessionId = this.getOrCreateSessionId();
    const userId = this.getAuthenticatedUserId();

    return {
      visitor_id: visitorId,
      session_id: sessionId,
      user_id: userId ?? undefined,
      event_name: eventName,
      path: options?.path ?? window.location.pathname,
      page_title: options?.page_title,
      referrer: document.referrer || undefined,
      language: navigator.language || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
      screen_width: window.screen?.width,
      screen_height: window.screen?.height,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      metadata: options?.metadata,
      occurred_at: new Date().toISOString(),
    };
  }

  private getAuthenticatedUserId(): number | null {
    if (!this.dataService.isAuthenticated()) {
      return null;
    }

    const parsed = Number(this.dataService.currentUser().id);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private getOrCreateVisitorId(): string {
    const existingVisitorId = window.localStorage.getItem(this.visitorStorageKey);

    if (existingVisitorId) {
      return existingVisitorId;
    }

    const visitorId = this.generateId('vst');
    window.localStorage.setItem(this.visitorStorageKey, visitorId);
    return visitorId;
  }

  private getOrCreateSessionId(): string {
    const now = Date.now();
    const existingSessionId = window.sessionStorage.getItem(this.sessionStorageKey);
    const lastSeenAt = Number(window.sessionStorage.getItem(this.sessionLastSeenStorageKey) || 0);
    const isExpired = !lastSeenAt || now - lastSeenAt > this.sessionTimeoutMs;

    const sessionId = !existingSessionId || isExpired
      ? this.generateId('ssn')
      : existingSessionId;

    window.sessionStorage.setItem(this.sessionStorageKey, sessionId);
    window.sessionStorage.setItem(this.sessionLastSeenStorageKey, String(now));

    return sessionId;
  }

  private generateId(prefix: string): string {
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now()}${Math.random().toString(36).slice(2, 12)}`;

    return `${prefix}_${randomPart}`;
  }
}
