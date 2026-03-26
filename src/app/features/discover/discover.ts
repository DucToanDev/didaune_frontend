import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import {
  Amenity,
  Category,
  City,
  District,
  PaginationMeta,
  Place,
  Ward,
} from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { LocationApiService } from '../../core/services/location-api.service';
import { combineLatest, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './discover.html',
  styleUrl: './discover.css',
})
export class Discover {
  public dataService = inject(DataService);
  private locationApi = inject(LocationApiService);

  places = signal<Place[]>([]);
  categories = signal<Category[]>([]);
  amenities = signal<Amenity[]>([]);
  cities = signal<City[]>([]);
  areaOptions = signal<District[]>([]);
  wards = signal<Ward[]>([]);
  wardQuery = signal(this.dataService.currentWardName());
  sortMenuOpen = signal(false);
  mobileFilterOpen = signal(false);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 50,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });
  loading = signal(true);
  areas = computed(() =>
    this.areaOptions().filter(
      (area) => area.city_id === this.dataService.currentCityId(),
    ),
  );
  filteredPlaces = computed(() => {
    const amenityId = this.dataService.selectedAmenityId();
    const places = this.places();

    if (!amenityId || amenityId === 'all') {
      return places;
    }

    return places.filter((place) => place.amenities.includes(amenityId));
  });
  latestPlaces = computed(() => this.filteredPlaces().slice(0, 4));
  pageNumbers = computed(() => {
    const totalPages = this.pagination().last_page;
    const currentPage = this.pagination().current_page;

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, -1, totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [1, -1, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, -1, currentPage, -1, totalPages];
  });

  constructor() {
    this.dataService.getCities().subscribe((cities) => this.cities.set(cities));
    this.dataService
      .getWardsByCityId(this.dataService.currentCityId())
      .subscribe((wards) => {
        this.wards.set(wards);
        const selectedWard = wards.find(
          (ward) => String(ward.code) === this.dataService.currentWardCode(),
        );
        this.wardQuery.set(selectedWard?.name ?? this.dataService.currentWardName());
      });
    this.dataService
      .getCategories()
      .subscribe((categories) => this.categories.set(categories));
    this.dataService
      .getAmenities()
      .subscribe((amenities) => this.amenities.set(amenities));
    this.dataService
      .getAreaOptions()
      .subscribe((areas) => this.areaOptions.set(areas));

    combineLatest([
      toObservable(this.dataService.currentCityId).pipe(
        startWith(this.dataService.currentCityId()),
      ),
      toObservable(this.dataService.currentWardCode).pipe(
        startWith(this.dataService.currentWardCode()),
      ),
      toObservable(this.dataService.currentWardName).pipe(
        startWith(this.dataService.currentWardName()),
      ),
      toObservable(this.dataService.currentDistrictId).pipe(
        startWith(this.dataService.currentDistrictId()),
      ),
      toObservable(this.dataService.selectedCategoryId).pipe(
        startWith(this.dataService.selectedCategoryId()),
      ),
      toObservable(this.dataService.searchQuery).pipe(
        startWith(this.dataService.searchQuery()),
      ),
      toObservable(this.dataService.sortOption).pipe(
        startWith(this.dataService.sortOption()),
      ),
      toObservable(this.dataService.selectedAmenityId).pipe(
        startWith(this.dataService.selectedAmenityId()),
      ),
      toObservable(computed(() => this.pagination().current_page)).pipe(
        startWith(this.pagination().current_page),
      ),
    ])
      .pipe(
        switchMap(([cityId, wardCode, wardName, areaId, categoryId, search, sort, amenityId, page]) => {
          this.loading.set(true);
          return this.locationApi.fetchLocationsPaginated({
            cityId,
            wardCode: wardCode.trim(),
            wardName,
            areaId,
            categoryId,
            amenityId,
            search,
            sort,
            page,
            perPage: this.pagination().per_page,
          });
        }),
      )
      .subscribe((result) => {
        this.places.set(result.data);
        this.pagination.set(result.meta);
        this.loading.set(false);
      });
  }

  setCategory(categoryId: string) {
    this.dataService.selectedCategoryId.set(categoryId);
    this.goToPage(1);
  }

  setCategoryFromEvent(event: Event) {
    this.setCategory((event.target as HTMLSelectElement).value);
  }

  setCity(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.dataService.currentCityId.set(value);
    this.dataService.currentDistrictId.set('all');
    this.dataService.currentWardCode.set('');
    this.dataService.currentWardName.set('');
    this.wardQuery.set('');
    this.dataService.getWardsByCityId(value).subscribe((wards) => this.wards.set(wards));
    this.goToPage(1);
  }

  setArea(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.dataService.currentDistrictId.set(value);
    this.goToPage(1);
  }

  setWard(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();
    const selectedWard = this.wards().find(
      (ward) => ward.name.toLowerCase() === value.toLowerCase(),
    );

    this.wardQuery.set(value);
    this.dataService.currentWardCode.set(selectedWard ? String(selectedWard.code) : '');
    this.dataService.currentWardName.set(selectedWard?.name ?? value);
    this.goToPage(1);
  }

  setSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.dataService.searchQuery.set(value);
    this.goToPage(1);
  }

  setSort(event: Event) {
    const value = (event.target as HTMLSelectElement).value as
      | 'popular'
      | 'rating'
      | 'name'
      | 'new';
    this.dataService.sortOption.set(value);
    this.goToPage(1);
  }

  setSortOption(value: 'popular' | 'rating' | 'name' | 'new') {
    this.dataService.sortOption.set(value);
    this.sortMenuOpen.set(false);
    this.goToPage(1);
  }

  toggleSortMenu() {
    this.sortMenuOpen.update((open) => !open);
  }

  toggleMobileFilter() {
    this.mobileFilterOpen.update((open) => !open);
  }

  closeMobileFilter() {
    this.mobileFilterOpen.set(false);
  }

  setAmenity(amenityId: string) {
    this.dataService.selectedAmenityId.set(amenityId);
    this.goToPage(1);
  }

  toggleFavorite(event: Event, slug: string) {
    event.stopPropagation();
    event.preventDefault();
    this.dataService.toggleFavorite(slug);
  }

  getSuggestedHours(place: Place): string {
    const firstHour = place.hours.find((hour) => hour.times.length > 0);

    if (!firstHour) {
      return 'Chưa cập nhật';
    }

    return firstHour.times[0] ?? 'Chưa cập nhật';
  }

  goToPage(page: number) {
    const lastPage = this.pagination().last_page;
    const nextPage = Math.min(Math.max(page, 1), Math.max(lastPage, 1));

    if (nextPage === this.pagination().current_page) {
      return;
    }

    this.pagination.update((current) => ({
      ...current,
      current_page: nextPage,
    }));
  }

  goToPreviousPage() {
    this.goToPage(this.pagination().current_page - 1);
  }

  goToNextPage() {
    this.goToPage(this.pagination().current_page + 1);
  }
}
