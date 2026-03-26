import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { Place } from '../../core/models/app.models';
import { ItineraryApiService } from '../../core/services/itinerary-api.service';
import { LocationApiService } from '../../core/services/location-api.service';

@Component({
  selector: 'app-admin-insights',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-insights.html',
  styleUrl: './admin-insights.css',
})
export class AdminInsights {
  private itineraryApi = inject(ItineraryApiService);
  private locationApi = inject(LocationApiService);

  itineraries = signal<any[]>([]);
  trendingPlaces = signal<Place[]>([]);
  loading = signal(false);
  errorMessage = signal('');

  metrics = computed(() => {
    const items = this.itineraries();
    const total = items.length;
    const avgDays = total ? items.reduce((sum, item) => sum + item.days, 0) / total : 0;
    const avgBudget = total
      ? items.reduce((sum, item) => sum + Number(item.budget ?? 0), 0) / total
      : 0;
    const totalDistance = items.reduce(
      (sum, item) => sum + Number(item.overview?.total_travel_distance_km ?? 0),
      0
    );
    const promptCoverage = total
      ? Math.round((items.filter((item) => item.raw_prompt).length / total) * 100)
      : 0;

    return [
      {
        label: 'Tong lich trinh da tao',
        value: total.toLocaleString('vi-VN'),
        note: 'Lay tu /api/itineraries',
        icon: 'fa-route',
        tone: 'bg-orange-50 text-orange-500',
      },
      {
        label: 'So ngay trung binh',
        value: avgDays.toFixed(1),
        note: `${Math.round(avgBudget).toLocaleString('vi-VN')}d / lich trinh`,
        icon: 'fa-calendar-days',
        tone: 'bg-sky-50 text-sky-600',
      },
      {
        label: 'Tong km AI route',
        value: `${totalDistance.toFixed(1)} km`,
        note: 'Cong tu overview.total_travel_distance_km',
        icon: 'fa-road',
        tone: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Prompt coverage',
        value: `${promptCoverage}%`,
        note: 'Ban ghi co raw_prompt',
        icon: 'fa-brain',
        tone: 'bg-violet-50 text-violet-600',
      },
    ];
  });

  topModels = computed(() => this.rankBy((item) => item.ai_model || 'Unknown'));
  topCities = computed(() => this.rankBy((item) => item.destination_city || 'Khac'));
  topTripStyles = computed(() => this.rankBy((item) => item.preferences_json?.trip_style || 'Khac'));
  topCompanions = computed(() => this.rankBy((item) => item.preferences_json?.companion_type || 'Khac'));
  topTravelModes = computed(() => this.rankBy((item) => item.travel_mode || 'Khac'));

  recentPrompts = computed(() =>
    this.itineraries()
      .filter((item) => item.raw_prompt)
      .sort((a, b) => this.dateValue(b.created_at) - this.dateValue(a.created_at))
      .slice(0, 4)
  );

  recentRuns = computed(() =>
    [...this.itineraries()]
      .sort((a, b) => this.dateValue(b.created_at) - this.dateValue(a.created_at))
      .slice(0, 6)
  );

  weekdayBars = computed(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const item of this.itineraries()) {
      if (!item.created_at) {
        continue;
      }
      const day = new Date(item.created_at).getDay();
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
    this.loadInsights();
  }

  loadInsights() {
    this.loading.set(true);
    this.errorMessage.set('');

    this.itineraryApi
      .fetchAllItineraries()
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tai duoc du lieu AI insights.');
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((items) => this.itineraries.set(items));

    this.locationApi
      .fetchTrendingLocations('hcm')
      .pipe(catchError(() => of([])))
      .subscribe((places) => this.trendingPlaces.set(places.slice(0, 5)));
  }

  private rankBy(getter: (item: any) => string) {
    const counts = new Map<string, number>();

    for (const item of this.itineraries()) {
      const key = getter(item);
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
