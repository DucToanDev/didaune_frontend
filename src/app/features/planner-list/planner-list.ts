import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  AdminItinerary,
  ItineraryApiService,
} from '../../core/services/itinerary-api.service';
import { DEFAULT_PLACE_IMAGE } from '../../core/utils/place-display.utils';
import { ToastService } from '../../core/services/toast.service';
import { PaginationMeta } from '../../core/models/app.models';
import { Pagination } from '../../admin/shared/pagination/pagination';
import { DataService } from '../../core/services/data.service';
import { SeoService } from '../../core/services/seo.service';

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
  imports: [CommonModule, RouterModule, Pagination],
  templateUrl: './planner-list.html',
})
export class PlannerList {
  private itineraryApi = inject(ItineraryApiService);
  private toast = inject(ToastService);
  readonly dataService = inject(DataService);
  private seo = inject(SeoService);
  private readonly perPage = 8;

  loading = signal(true);
  trips = signal<PlannerListItem[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: this.perPage,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });

  tripCountLabel = computed(() => `${this.trips().length} ban luu`);

  constructor() {
    this.seo.setPage({
      title: 'Lịch trình',
      description: 'Danh sách lịch trình của bạn.',
      path: '/planner',
      noindex: true,
    });

    if (!this.dataService.isAuthenticated()) {
      this.loading.set(false);
      return;
    }

    this.loadTrips();
  }

  openLogin() {
    this.dataService.requestProtectedAuthModal('login');
  }

  loadTrips(page = 1) {
    this.loading.set(true);
    this.itineraryApi
      .fetchItinerariesPaginated(page, this.perPage)
      .pipe(
        catchError(() =>
          of({
            data: [] as AdminItinerary[],
            meta: {
              current_page: 1,
              per_page: this.perPage,
              total: 0,
              last_page: 1,
              from: null,
              to: null,
            },
          }),
        ),
      )
      .subscribe((result) => {
        this.trips.set(result.data.map((item) => this.mapTrip(item)));
        this.pagination.set(result.meta);
        this.loading.set(false);
      });
  }

  goToPage(page: number) {
    if (
      page < 1 ||
      page > this.pagination().last_page ||
      page === this.pagination().current_page
    ) {
      return;
    }

    this.loadTrips(page);
  }

  async deleteTrip(event: Event, tripId: string) {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = await this.toast.confirm({
      title: 'Xóa lịch trình này?',
      text: 'Hành động này không thể hoàn tác.',
      confirmButtonText: 'Xóa',
    });

    if (!confirmed.isConfirmed) {
      return;
    }

    this.itineraryApi
      .deleteItinerary(Number(tripId))
      .pipe(
        catchError(() => {
          this.toast.error('Xóa lịch trình thất bại');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }

        const currentPage = this.pagination().current_page;
        const remainingTrips = this.trips().filter(
          (trip) => trip.id !== tripId,
        );
        if (remainingTrips.length === 0 && currentPage > 1) {
          this.loadTrips(currentPage - 1);
        } else {
          this.loadTrips(currentPage);
        }
        this.toast.success('Đã xóa lịch trình');
      });
  }

  private mapTrip(item: AdminItinerary): PlannerListItem {
    return {
      id: String(item.id),
      title: item.title,
      date: item.start_date ?? item.created_at?.slice(0, 10) ?? 'Đang cập nhật',
      source: item.itinerary_type === 'ai' ? 'ai' : 'manual',
      coverImage: this.resolveCoverImage(item),
      stopsLabel: `${item.items?.length ?? 0} địa điểm`,
      budgetLabel: item.budget
        ? `~${Number(item.budget).toLocaleString('vi-VN')}đ`
        : undefined,
    };
  }

  private resolveCoverImage(item: AdminItinerary): string {
    return item.cover_image || DEFAULT_PLACE_IMAGE;
  }

  onImageError(event: Event) {
    const image = event.target as HTMLImageElement | null;
    if (!image || image.src.endsWith(DEFAULT_PLACE_IMAGE)) {
      return;
    }

    image.src = DEFAULT_PLACE_IMAGE;
  }
}
