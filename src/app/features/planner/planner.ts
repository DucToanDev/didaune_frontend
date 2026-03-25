import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  Place,
  PlaceItineraryDay,
  PlaceItineraryOverview,
  PlaceItineraryStop,
} from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { BACKEND_API_CONFIG } from '../../core/config/backend-api.config';

interface BackendItineraryMarker {
  location_id: string;
  name: string;
  lat: number;
  lng: number;
}

interface BackendItineraryItem {
  id: number;
  day_number: number;
  start_time: string | null;
  end_time: string | null;
  activity_title: string;
  activity_type?: string | null;
  note: string | null;
  transport_mode: string | null;
  estimated_cost: string | null;
  travel_minutes_from_previous?: number | null;
  travel_distance_km_from_previous?: string | null;
  location: {
    slug: string;
  } | null;
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
    preferences_json: {
      tags?: string[];
      trip_style?: string | null;
      companion_type?: string | null;
      energy_level?: string | null;
    };
    overview?: PlaceItineraryOverview;
    day_summaries?: BackendItineraryDay[];
    map_markers?: BackendItineraryMarker[];
    items: BackendItineraryItem[];
  };
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
  preferences_json: {
    tags?: string[];
    trip_style?: string | null;
    companion_type?: string | null;
    energy_level?: string | null;
  };
  overview: PlaceItineraryOverview | null;
  day_summaries: PlaceItineraryDay[];
  map_markers: BackendItineraryMarker[];
  items: PlaceItineraryStop[];
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

  itineraryByDay = computed(() => this.generated()?.day_summaries ?? []);
  markerCount = computed(() => this.generated()?.map_markers.length ?? 0);

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
      trip_style: this.tripStyleForMood(),
      companion_type: this.companionTypeForMood(),
      energy_level: this.energyLevelForTime(),
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
      });
  }

  private mapGeneratedItinerary(data: BackendItineraryResponse['data']) {
    const slugs = data.items
      .map((item) => item.location?.slug)
      .filter((slug): slug is string => Boolean(slug));

    this.dataService.getPlaces().subscribe((places) => {
      const placeMap = new Map(places.map((place) => [place.slug, place]));
      const items = data.items.map((item) => this.mapStop(item, placeMap));
      const daySummaries = (data.day_summaries ?? []).map((day) => ({
        ...day,
        items: day.items.map((item) => this.mapStop(item, placeMap)),
      }));

      this.generated.set({
        id: data.id,
        title: data.title,
        destination_city: data.destination_city,
        days: data.days,
        budget: data.budget,
        travel_mode: data.travel_mode,
        start_time: data.start_time,
        end_time: data.end_time,
        preferences_json: data.preferences_json,
        overview: data.overview ?? null,
        day_summaries: daySummaries,
        map_markers: data.map_markers ?? [],
        items,
      });
      this.loading.set(false);
    });
  }

  private mapStop(
    item: BackendItineraryItem,
    placeMap: Map<string, Place>
  ): PlaceItineraryStop {
    return {
      id: item.id,
      day_number: item.day_number,
      start_time: item.start_time,
      end_time: item.end_time,
      activity_title: item.activity_title,
      activity_type: item.activity_type ?? null,
      note: item.note,
      transport_mode: item.transport_mode,
      estimated_cost: item.estimated_cost,
      travel_minutes_from_previous: item.travel_minutes_from_previous ?? null,
      travel_distance_km_from_previous: item.travel_distance_km_from_previous ?? null,
      location: item.location?.slug ? placeMap.get(item.location.slug) ?? null : null,
    };
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

  private tripStyleForMood(): string {
    const mapping = {
      date: 'romantic',
      work: 'focused',
      photo: 'check-in',
      group: 'social',
    } as const;

    return mapping[this.mood()];
  }

  private companionTypeForMood(): string {
    const mapping = {
      date: 'couple',
      work: 'solo',
      photo: 'friends',
      group: 'group',
    } as const;

    return mapping[this.mood()];
  }

  private energyLevelForTime(): string {
    const mapping = {
      morning: 'balanced',
      afternoon: 'relaxed',
      night: 'high',
    } as const;

    return mapping[this.timeOfDay()];
  }

  private cityLabelForApi(): string {
    const cityId = this.dataService.currentCityId();
    return this.cityOptions().find((city) => city.id === cityId)?.label ?? 'Ho Chi Minh';
  }
}
