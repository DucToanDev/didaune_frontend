import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { User } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import {
  AdminItinerary,
  ItineraryApiService,
} from '../../core/services/itinerary-api.service';
import { DEFAULT_PLACE_IMAGE } from '../../core/utils/place-display.utils';

interface ProfileItineraryItem {
  id: number;
  title: string;
  coverImage: string;
  dateLabel: string;
  sourceLabel: string;
  stopsLabel: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  public dataService = inject(DataService);
  private router = inject(Router);
  private itineraryApi = inject(ItineraryApiService);

  favoritesCount = signal(0);
  reviewsCount = computed(() => this.dataService.internalReviews().length);
  user = computed<User>(() => this.dataService.currentUser());
  logoutSubmitting = signal(false);
  logoutError = signal('');
  itinerariesLoading = signal(true);
  itineraries = signal<ProfileItineraryItem[]>([]);
  itineraryCount = signal(0);

  recentReviews = computed(() => this.dataService.internalReviews().slice(0, 3));

  constructor() {
    this.dataService.getFavoritePlaces().subscribe((favorites) => this.favoritesCount.set(favorites.length));
    this.itineraryApi
      .fetchItinerariesPaginated(1, 4)
      .pipe(
        catchError(() =>
          of({
            data: [] as AdminItinerary[],
            meta: {
              current_page: 1,
              per_page: 4,
              total: 0,
              last_page: 1,
              from: null,
              to: null,
            },
          }),
        ),
        finalize(() => this.itinerariesLoading.set(false)),
      )
      .subscribe((result) => {
        this.itineraries.set(result.data.map((item) => this.mapItinerary(item)));
        this.itineraryCount.set(result.meta.total);
      });
  }

  logout() {
    this.logoutError.set('');
    this.logoutSubmitting.set(true);

    this.dataService.logout()
      .pipe(finalize(() => this.logoutSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: () => {
          this.logoutError.set('Dang xuat that bai. Vui long thu lai.');
        },
      });
  }

  private mapItinerary(item: AdminItinerary): ProfileItineraryItem {
    return {
      id: item.id,
      title: item.title,
      coverImage: item.cover_image || DEFAULT_PLACE_IMAGE,
      dateLabel: item.start_date ?? item.created_at?.slice(0, 10) ?? 'Đang cập nhật',
      sourceLabel: item.itinerary_type === 'ai' ? 'AI' : 'Thủ công',
      stopsLabel: `${item.items?.length ?? 0} điểm dừng`,
    };
  }
}
