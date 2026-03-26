import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { Category, City, PaginationMeta, Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { LocationApiService } from '../../core/services/location-api.service';

type PartnerView = 'all' | 'owned' | 'claimable' | 'active';

@Component({
  selector: 'app-admin-partners',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-partners.html',
  styleUrl: './admin-partners.css',
})
export class AdminPartners {
  private dataService = inject(DataService);
  private locationApi = inject(LocationApiService);

  cities = signal<City[]>([]);
  categories = signal<Category[]>([]);
  locations = signal<Place[]>([]);
  selectedPlace = signal<Place | null>(null);
  highlightedPartners = signal<Place[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 12,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });

  cityId = signal('hcm');
  categoryId = signal('all');
  search = signal('');
  partnerView = signal<PartnerView>('all');
  sort = signal<'latest' | 'reviews_count' | 'rating'>('reviews_count');

  loading = signal(false);
  detailLoading = signal(false);
  highlightsLoading = signal(false);
  errorMessage = signal('');
  detailError = signal('');

  partnerLocations = computed(() => {
    const mode = this.partnerView();
    const locations = this.locations();

    if (mode === 'owned') {
      return locations.filter((place) => Boolean(place.owner_id || place.owner_name));
    }

    if (mode === 'claimable') {
      return locations.filter((place) => place.can_claim);
    }

    if (mode === 'active') {
      return locations.filter((place) => place.owner_posts.length > 0);
    }

    return locations;
  });

  metrics = computed(() => {
    const items = this.partnerLocations();
    return [
      {
        label: 'Tong diem doi tac',
        value: this.pagination().total.toLocaleString('vi-VN'),
        note: 'Theo bo loc hien tai',
        icon: 'fa-store',
        tone: 'bg-orange-50 text-orange-500',
      },
      {
        label: 'Da co chu',
        value: items.filter((place) => Boolean(place.owner_id || place.owner_name)).length.toLocaleString('vi-VN'),
        note: 'Co du lieu owner',
        icon: 'fa-user-tie',
        tone: 'bg-sky-50 text-sky-600',
      },
      {
        label: 'Can claim',
        value: items.filter((place) => place.can_claim).length.toLocaleString('vi-VN'),
        note: 'Co the tiep can doi tac',
        icon: 'fa-bullhorn',
        tone: 'bg-amber-50 text-amber-600',
      },
      {
        label: 'Dang hoat dong',
        value: items.filter((place) => place.owner_posts.length > 0).length.toLocaleString('vi-VN'),
        note: 'Co owner posts',
        icon: 'fa-signal',
        tone: 'bg-emerald-50 text-emerald-600',
      },
    ];
  });

  constructor() {
    this.bootstrap();
  }

  bootstrap() {
    this.dataService.getCities().subscribe((cities) => this.cities.set(cities));
    this.dataService.getCategories().subscribe((categories) => this.categories.set(categories));
    this.fetchPartners();
    this.fetchHighlightedPartners();
  }

  fetchPartners(page = this.pagination().current_page) {
    this.loading.set(true);
    this.errorMessage.set('');

    this.locationApi
      .fetchLocationsPaginated({
        cityId: this.cityId(),
        search: this.search().trim(),
        categoryId: this.categoryId(),
        sort: this.sort() === 'reviews_count' ? 'popular' : this.sort() === 'latest' ? 'new' : 'rating',
        page,
        perPage: this.pagination().per_page,
      })
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tai duoc du lieu doi tac.');
          return of({
            data: [],
            meta: {
              current_page: 1,
              per_page: this.pagination().per_page,
              total: 0,
              last_page: 1,
              from: null,
              to: null,
            },
          });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        this.locations.set(result.data);
        this.pagination.set(result.meta);

        const currentSelected = this.selectedPlace();
        if (currentSelected && !result.data.some((place) => place.id === currentSelected.id)) {
          this.selectedPlace.set(null);
        }
      });
  }

  fetchHighlightedPartners() {
    this.highlightsLoading.set(true);

    this.locationApi
      .fetchTrendingLocations(this.cityId())
      .pipe(
        catchError(() => of([])),
        finalize(() => this.highlightsLoading.set(false))
      )
      .subscribe((places) => {
        const candidates = places.filter((place) => place.can_claim || place.owner_posts.length > 0);
        this.highlightedPartners.set(candidates.slice(0, 6));
      });
  }

  reloadFilters() {
    this.pagination.update((meta) => ({ ...meta, current_page: 1 }));
    this.fetchPartners(1);
    this.fetchHighlightedPartners();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page || page === this.pagination().current_page) {
      return;
    }

    this.fetchPartners(page);
  }

  openPartner(place: Place) {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.selectedPlace.set(place);

    this.locationApi
      .getPlaceById(place.id, this.cityId())
      .pipe(
        catchError(() => {
          this.detailError.set('Khong tai duoc chi tiet doi tac.');
          return of(place);
        }),
        finalize(() => this.detailLoading.set(false))
      )
      .subscribe((detail) => this.selectedPlace.set(detail));
  }

  closeDetail() {
    this.selectedPlace.set(null);
    this.detailError.set('');
  }
}
