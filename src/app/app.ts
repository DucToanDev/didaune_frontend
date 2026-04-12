import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { DataService } from './core/services/data.service';
import { AnalyticsService } from './core/services/analytics.service';
import { filter, startWith } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private dataService = inject(DataService);
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private locationPromptStorageKey = 'didaune_location_prompted';
  private lastUserRefreshAt = 0;
  private userRefreshCooldownMs = 60000;
  protected readonly title = signal('frontend');

  ngOnInit(): void {
    this.requestLocationOnEntry();
    this.trackPageViews();
    this.refreshCurrentUserSession();
    this.syncCurrentUserOnFocus();
  }

  private trackPageViews() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith({ urlAfterRedirects: this.router.url } as NavigationEnd)
      )
      .subscribe((event) => {
        this.analytics.trackPageView(
          event.urlAfterRedirects,
          typeof document !== 'undefined' ? document.title : undefined
        );
      });
  }

  private requestLocationOnEntry() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    if (this.dataService.currentCoordinates()) {
      return;
    }

    if (window.sessionStorage.getItem(this.locationPromptStorageKey) === '1') {
      return;
    }

    window.sessionStorage.setItem(this.locationPromptStorageKey, '1');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.dataService.setCurrentCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        this.dataService.setCurrentCoordinates(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  private refreshCurrentUserSession(force = false) {
    if (!this.dataService.isAuthenticated()) {
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastUserRefreshAt < this.userRefreshCooldownMs) {
      return;
    }

    this.lastUserRefreshAt = now;
    this.dataService.refreshCurrentUser().subscribe();
  }

  private syncCurrentUserOnFocus() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const refreshCurrentUser = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      this.refreshCurrentUserSession();
    };

    window.addEventListener('focus', refreshCurrentUser);
    document.addEventListener('visibilitychange', refreshCurrentUser);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', refreshCurrentUser);
      document.removeEventListener('visibilitychange', refreshCurrentUser);
    });
  }
}
