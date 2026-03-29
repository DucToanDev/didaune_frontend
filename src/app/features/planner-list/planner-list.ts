import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AdminItinerary, ItineraryApiService } from '../../core/services/itinerary-api.service';

interface PlannerListItem {
  id: string;
  title: string;
  date: string;
  source: 'ai' | 'manual';
  coverImage: string;
  stopsLabel: string;
  budgetLabel?: string;
}

@Component({
  selector: 'app-planner-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './planner-list.html',
})
export class PlannerList {
  private itineraryApi = inject(ItineraryApiService);

  loading = signal(true);
  trips = signal<PlannerListItem[]>([]);

  tripCountLabel = computed(() => `${this.trips().length} ban luu`);

  constructor() {
    this.itineraryApi
      .fetchItinerariesPaginated(1, 20)
      .pipe(catchError(() => of({ data: [] as AdminItinerary[], meta: null })))
      .subscribe((result) => {
        this.trips.set(result.data.map((item) => this.mapTrip(item)));
        this.loading.set(false);
      });
  }

  private mapTrip(item: AdminItinerary): PlannerListItem {
    const fallbackImage =
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=200';

    return {
      id: String(item.id),
      title: item.title,
      date: item.start_date ?? item.created_at?.slice(0, 10) ?? 'Dang cap nhat',
      source: item.itinerary_type === 'ai' ? 'ai' : 'manual',
      coverImage: item.cover_image || fallbackImage,
      stopsLabel: `${item.items?.length ?? 0} dia diem`,
      budgetLabel: item.budget ? `~${Number(item.budget).toLocaleString('vi-VN')}d` : undefined,
    };
  }
}
