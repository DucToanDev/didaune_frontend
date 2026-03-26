import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { City, Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { AdminItinerary, ItineraryApiService } from '../../core/services/itinerary-api.service';
import { LocationApiService } from '../../core/services/location-api.service';

interface AdminMetric {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone: string;
}

interface RankedItem {
  label: string;
  count: number;
}

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome {
  private dataService = inject(DataService);
  private locationApi = inject(LocationApiService);
  private itineraryApi = inject(ItineraryApiService);

  cities = signal<City[]>([]);
  selectedCityId = signal('hcm');

  loading = signal(false);
  nearbyLoading = signal(false);
  errorMessage = signal('');
  nearbyMessage = signal('');
  selectedCoordinates = signal<{ lat: number; lng: number } | null>(null);

  allLocations = signal<Place[]>([]);
  trendingPlaces = signal<Place[]>([]);
  nearbyPlaces = signal<Place[]>([]);
  itineraries = signal<AdminItinerary[]>([]);

  metrics = computed<AdminMetric[]>(() => {
    const locations = this.allLocations();
    const itineraries = this.itineraries();
    const claimable = locations.filter((place) => place.can_claim).length;
    const activeOwners = locations.filter((place) => place.owner_posts.length > 0).length;
    const totalDistance = itineraries.reduce(
      (sum, itinerary) => sum + Number(itinerary.overview?.total_travel_distance_km ?? 0),
      0
    );

    return [
      {
        label: 'Tong dia diem',
        value: locations.length.toLocaleString('vi-VN'),
        note: `${claimable.toLocaleString('vi-VN')} co the claim`,
        icon: 'fa-map-location-dot',
        tone: 'bg-sky-50 text-sky-600',
      },
      {
        label: 'Doi tac dang hoat dong',
        value: activeOwners.toLocaleString('vi-VN'),
        note: `${locations.filter((place) => place.owner_name || place.owner_id).length.toLocaleString('vi-VN')} co owner`,
        icon: 'fa-store',
        tone: 'bg-orange-50 text-orange-500',
      },
      {
        label: 'AI itineraries',
        value: itineraries.length.toLocaleString('vi-VN'),
        note: `${this.uniqueModels().length} model dang xuat hien`,
        icon: 'fa-brain',
        tone: 'bg-violet-50 text-violet-600',
      },
      {
        label: 'Tong km AI route',
        value: `${totalDistance.toFixed(1)} km`,
        note: `${this.latestItineraries().length} ban ghi moi nhat`,
        icon: 'fa-road',
        tone: 'bg-emerald-50 text-emerald-600',
      },
    ];
  });

  apiCards = computed(() => [
    {
      label: 'Locations',
      route: '/admin/locations',
      note: '/api/locations, /trending, /nearby, /{id}',
      icon: 'fa-map-pin',
    },
    {
      label: 'Partners',
      route: '/admin/partners',
      note: 'Phan tich tu owner_name, can_claim, owner_posts',
      icon: 'fa-handshake',
    },
    {
      label: 'Itineraries',
      route: '/admin/itineraries',
      note: '/api/itineraries, /generate, PATCH, DELETE',
      icon: 'fa-route',
    },
    {
      label: 'AI Insights',
      route: '/admin/insights',
      note: 'Tong hop trend tu itinerary va trending places',
      icon: 'fa-chart-line',
    },
  ]);

  partnerCandidates = computed(() =>
    [...this.allLocations()]
      .filter((place) => place.can_claim || place.owner_posts.length > 0)
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 5)
  );

  latestItineraries = computed(() =>
    [...this.itineraries()]
      .sort((a, b) => this.dateValue(b.updated_at || b.created_at) - this.dateValue(a.updated_at || a.created_at))
      .slice(0, 5)
  );

  topCategories = computed(() => this.rankLocations((place) => place.category_labels[0] || 'Khac'));
  topDistricts = computed(() => this.rankLocations((place) => place.district_name || 'Khac'));
  uniqueModels = computed(() =>
    Array.from(new Set(this.itineraries().map((item) => item.ai_model || 'Unknown')))
  );

  weekdayBars = computed(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const itinerary of this.itineraries()) {
      if (!itinerary.created_at) {
        continue;
      }
      const day = new Date(itinerary.created_at).getDay();
      counts[day] += 1;
    }
    const max = Math.max(...counts, 1);
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return counts.map((count, index) => ({
      label: labels[index],
      count,
      height: `${Math.max(18, (count / max) * 100)}%`,
    }));
  });

  constructor() {
    this.bootstrap();
  }

  bootstrap() {
    this.dataService.getCities().subscribe((cities) => this.cities.set(cities));
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      locations: this.locationApi.fetchAllLocations(this.selectedCityId(), ''),
      trending: this.locationApi.fetchTrendingLocations(this.selectedCityId()),
      itineraries: this.itineraryApi.fetchAllItineraries(),
    })
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tai duoc admin overview tu API.');
          return of({
            locations: [],
            trending: [],
            itineraries: [],
          });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        this.allLocations.set(result.locations);
        this.trendingPlaces.set(result.trending.slice(0, 6));
        this.itineraries.set(result.itineraries);
      });
  }

  onCityChange(cityId: string) {
    this.selectedCityId.set(cityId);
    this.nearbyPlaces.set([]);
    this.nearbyMessage.set('');
    this.selectedCoordinates.set(null);
    this.loadDashboard();
  }

  requestNearby() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.nearbyMessage.set('Trinh duyet hien tai khong ho tro dinh vi.');
      return;
    }

    this.nearbyLoading.set(true);
    this.nearbyMessage.set('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        this.selectedCoordinates.set(coordinates);
        this.locationApi
          .fetchNearbyLocations(coordinates.lat, coordinates.lng, 5, this.selectedCityId())
          .pipe(
            catchError(() => {
              this.nearbyMessage.set('Khong lay duoc nearby locations tu API.');
              return of([]);
            }),
            finalize(() => this.nearbyLoading.set(false))
          )
          .subscribe((places) => {
            this.nearbyPlaces.set(places.slice(0, 5));
            if (!places.length) {
              this.nearbyMessage.set('Khong tim thay dia diem nearby trong ban kinh 5 km.');
            }
          });
      },
      () => {
        this.nearbyLoading.set(false);
        this.nearbyMessage.set('Khong lay duoc vi tri hien tai.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  private rankLocations(getter: (place: Place) => string): RankedItem[] {
    const counts = new Map<string, number>();

    for (const place of this.allLocations()) {
      const key = getter(place);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private dateValue(value: string | null) {
    return value ? new Date(value).getTime() : 0;
  }
}
