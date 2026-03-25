import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { BACKEND_API_CONFIG } from '../../core/config/backend-api.config';

interface PlannerItineraryItem {
  id: number;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  activity_title: string;
  note: string | null;
  transport_mode: string | null;
  estimated_cost: string | null;
  location: Place | null;
}

interface PlannerItinerary {
  id: number;
  title: string;
  destination_city: string | null;
  days: number;
  budget: string | null;
  travel_mode: string | null;
  start_time: string | null;
  end_time: string | null;
  preferences_json: string[];
  items: PlannerItineraryItem[];
}

interface BackendItineraryItem {
  id: number;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  activity_title: string;
  note: string | null;
  transport_mode: string | null;
  estimated_cost: string | null;
  location: {
    slug: string;
  } | null;
}

interface BackendItineraryResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    title: string;
    destination_city: string | null;
    days: number;
    budget: string | null;
    travel_mode: string | null;
    start_time: string | null;
    end_time: string | null;
    preferences_json: string[];
    items: BackendItineraryItem[];
  };
}

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planner.html',
  styleUrl: './planner.css',
})
export class Planner {
  private http = inject(HttpClient);
  public dataService = inject(DataService);

  mood = signal<'date' | 'work' | 'photo' | 'group'>('date');
  budget = signal<'low' | 'medium' | 'high'>('medium');
  timeOfDay = signal<'morning' | 'afternoon' | 'night'>('afternoon');

  days = signal(1);
  travelMode = signal('motorbike');
  cityOptions = signal([
    { id: 'hcm', label: 'Ho Chi Minh' },
    { id: 'hn', label: 'Ha Noi' },
    { id: 'dl', label: 'Da Lat' },
  ]);

  loading = signal(false);
  errorMessage = signal('');
  generated = signal<PlannerItinerary | null>(null);

  itineraryByDay = computed(() => {
    const grouped = new Map<number, PlannerItineraryItem[]>();

    for (const item of this.generated()?.items ?? []) {
      const current = grouped.get(item.day_number) ?? [];
      current.push(item);
      grouped.set(item.day_number, current);
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({ day, items }));
  });

  setMood(value: 'date' | 'work' | 'photo' | 'group') {
    this.mood.set(value);
  }

  setBudget(value: 'low' | 'medium' | 'high') {
    this.budget.set(value);
  }

  setTime(value: 'morning' | 'afternoon' | 'night') {
    this.timeOfDay.set(value);
  }

  generateItinerary() {
    this.loading.set(true);
    this.errorMessage.set('');

    const payload = {
      destination_city: this.cityLabelForApi(),
      days: this.days(),
      budget: this.budgetValue(),
      travel_mode: this.travelMode(),
      start_time: this.timeWindow().start,
      end_time: this.timeWindow().end,
      preferences: this.preferencesForMood(),
    };

    this.http
      .post<BackendItineraryResponse>(
        `${BACKEND_API_CONFIG.baseUrl}/itineraries/generate`,
        payload
      )
      .pipe(
        catchError((error) => {
          this.errorMessage.set(
            error?.error?.message || 'Khong the tao lich trinh AI luc nay.'
          );
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe((response) => {
        if (!response?.data) {
          return;
        }

        this.mapGeneratedItinerary(response.data);
        this.loading.set(false);
      });
  }

  private mapGeneratedItinerary(data: BackendItineraryResponse['data']) {
    const slugs = data.items
      .map((item) => item.location?.slug)
      .filter((slug): slug is string => Boolean(slug));

    if (!slugs.length) {
      this.generated.set({
        ...data,
        items: data.items.map((item) => ({
          ...item,
          location: null,
        })),
      });
      return;
    }

    this.dataService.getPlaces().subscribe((places) => {
      const placeMap = new Map(places.map((place) => [place.slug, place]));

      this.generated.set({
        ...data,
        items: data.items.map((item) => ({
          ...item,
          location: item.location?.slug ? placeMap.get(item.location.slug) ?? null : null,
        })),
      });
    });
  }

  private budgetValue(): number {
    if (this.budget() === 'low') {
      return 500000;
    }

    if (this.budget() === 'high') {
      return 2000000;
    }

    return 1200000;
  }

  private timeWindow() {
    if (this.timeOfDay() === 'morning') {
      return { start: '08:00', end: '14:00' };
    }

    if (this.timeOfDay() === 'night') {
      return { start: '17:00', end: '23:00' };
    }

    return { start: '12:00', end: '22:00' };
  }

  private preferencesForMood(): string[] {
    const mapping: Record<typeof this.mood extends () => infer T ? T & string : string, string[]> = {
      date: ['Hen ho', 'Nha hang', 'check-in'],
      work: ['Quan ca phe', 'Lam viec', 'Yen tinh'],
      photo: ['Quan ca phe', 'check-in', 'Song ao'],
      group: ['Quan ca phe', 'Nha hang', 'Tu tap'],
    };

    return mapping[this.mood()] ?? ['Quan ca phe'];
  }

  private cityLabelForApi(): string {
    const cityId = this.dataService.currentCityId();
    return this.cityOptions().find((city) => city.id === cityId)?.label ?? 'Ho Chi Minh';
  }
}
