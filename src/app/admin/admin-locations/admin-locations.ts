import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import {
  Category,
  City,
  PaginationMeta,
  Place,
  Ward,
} from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { LocationApiService } from '../../core/services/location-api.service';

@Component({
  selector: 'app-admin-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-locations.html',
  styleUrl: './admin-locations.css',
})
export class AdminLocations {
  private dataService = inject(DataService);
  private locationApi = inject(LocationApiService);

  cities = signal<City[]>([]);
  wards = signal<Ward[]>([]);
  categories = signal<Category[]>([]);
  places = signal<Place[]>([]);
  trendingPlaces = signal<Place[]>([]);
  nearbyPlaces = signal<Place[]>([]);
  selectedPlace = signal<Place | null>(null);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 12,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });

  search = signal('');
  cityId = signal('hcm');
  wardCode = signal('');
  district = signal('');
  categoryId = signal('all');
  sort = signal<'latest' | 'reviews_count' | 'rating'>('latest');
  perPage = signal(12);
  radiusKm = signal(5);
  importTruncate = signal(false);
  importFileName = signal('');

  loading = signal(false);
  detailLoading = signal(false);
  trendingLoading = signal(false);
  nearbyLoading = signal(false);
  importing = signal(false);

  errorMessage = signal('');
  detailError = signal('');
  importMessage = signal('');
  nearbyMessage = signal('');
  selectedCoordinates = signal<{ lat: number; lng: number } | null>(null);

  activeMetrics = computed(() => {
    const places = this.places();
    return [
      {
        label: 'Tong ket qua',
        value: this.pagination().total.toLocaleString('vi-VN'),
        note: `${this.pagination().current_page}/${this.pagination().last_page} trang`,
        icon: 'fa-layer-group',
        tone: 'bg-sky-50 text-sky-600',
      },
      {
        label: 'Dang mo cua',
        value: places
          .filter((place) => !place.is_permanently_closed && !place.is_temporarily_closed)
          .length.toLocaleString('vi-VN'),
        note: 'Trong trang hien tai',
        icon: 'fa-door-open',
        tone: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Can claim',
        value: places.filter((place) => place.can_claim).length.toLocaleString('vi-VN'),
        note: 'Co the giao cho doi tac',
        icon: 'fa-store',
        tone: 'bg-orange-50 text-orange-500',
      },
      {
        label: 'Review TB',
        value:
          places.length > 0
            ? (
                places.reduce((sum, place) => sum + place.review_count, 0) / places.length
              ).toFixed(0)
            : '0',
        note: 'Moi dia diem / trang',
        icon: 'fa-comment-dots',
        tone: 'bg-violet-50 text-violet-600',
      },
    ];
  });

  pageNumbers = computed(() => {
    const totalPages = this.pagination().last_page;
    const currentPage = this.pagination().current_page;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, -1, totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
  });

  constructor() {
    this.bootstrap();
  }

  bootstrap() {
    this.dataService.getCities().subscribe((cities) => this.cities.set(cities));
    this.dataService.getCategories().subscribe((categories) => this.categories.set(categories));
    this.loadWards(this.cityId());
    this.fetchLocations();
    this.fetchTrending();
  }

  fetchLocations(page = this.pagination().current_page) {
    this.loading.set(true);
    this.errorMessage.set('');

    const city = this.cityId();
    const ward = this.wardCode().trim();
    const district = this.district().trim();
    const categoryId = this.categoryId();
    const sort = this.sort();
    const perPage = this.perPage();
    this.locationApi
      .fetchLocationsPaginated({
        cityId: city,
        search: this.search().trim(),
        wardCode: ward,
        areaId: district || 'all',
        categoryId,
        sort: sort === 'reviews_count' ? 'popular' : sort === 'latest' ? 'new' : 'rating',
        page,
        perPage,
      })
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tai duoc danh sach dia diem.');
          return of({
            data: [],
            meta: {
              current_page: 1,
              per_page: perPage,
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
        this.places.set(result.data);
        this.pagination.set(result.meta);

        const currentSelected = this.selectedPlace();
        if (currentSelected && !result.data.some((place) => place.id === currentSelected.id)) {
          this.selectedPlace.set(null);
        }
      });
  }

  fetchTrending() {
    this.trendingLoading.set(true);

    this.locationApi
      .fetchTrendingLocations(this.cityId())
      .pipe(
        catchError(() => of([])),
        finalize(() => this.trendingLoading.set(false))
      )
      .subscribe((places) => this.trendingPlaces.set(places.slice(0, 6)));
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
          .fetchNearbyLocations(coordinates.lat, coordinates.lng, this.radiusKm(), this.cityId())
          .pipe(
            catchError(() => {
              this.nearbyMessage.set('Khong lay duoc danh sach nearby tu API.');
              return of([]);
            }),
            finalize(() => this.nearbyLoading.set(false))
          )
          .subscribe((places) => {
            this.nearbyPlaces.set(places);
            if (!places.length) {
              this.nearbyMessage.set('Khong tim thay dia diem nao trong ban kinh da chon.');
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

  onCityChange(value: string) {
    this.cityId.set(value);
    this.wardCode.set('');
    this.district.set('');
    this.pagination.update((meta) => ({ ...meta, current_page: 1 }));
    this.loadWards(value);
    this.fetchLocations(1);
    this.fetchTrending();
  }

  onFiltersChange() {
    this.pagination.update((meta) => ({ ...meta, current_page: 1 }));
    this.fetchLocations(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page || page === this.pagination().current_page) {
      return;
    }

    this.fetchLocations(page);
  }

  openDetail(place: Place) {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.selectedPlace.set(place);

    this.locationApi
      .getPlaceById(place.id, this.cityId())
      .pipe(
        catchError(() => {
          this.detailError.set('Khong tai duoc chi tiet day du cua dia diem.');
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

  onImportFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.importFileName.set('');
      return;
    }

    this.importFileName.set(file.name);
  }

  importLocations(input: HTMLInputElement) {
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.importMessage.set('Hay chon file JSON truoc khi import.');
      return;
    }

    this.importing.set(true);
    this.importMessage.set('');

    this.locationApi
      .importLocations(file, this.importTruncate())
      .pipe(
        catchError((error) => {
          this.importMessage.set(error?.error?.message || 'Import that bai.');
          return of(null);
        }),
        finalize(() => this.importing.set(false))
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        this.importMessage.set(response.message || 'Import thanh cong.');
        input.value = '';
        this.importFileName.set('');
        this.fetchLocations(1);
        this.fetchTrending();
      });
  }

  private loadWards(cityId: string) {
    this.dataService.getWardsByCityId(cityId).subscribe((wards) => this.wards.set(wards));
  }
}
