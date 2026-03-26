import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import {
  Category,
  District,
  PaginationMeta,
  Place,
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
  areaOptions = signal<District[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 100,
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
  filteredPlaces = computed(() => this.places());
  latestPlaces = computed(() => this.filteredPlaces().slice(0, 4));
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
      return [
        1,
        -1,
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      -1,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      -1,
      totalPages,
    ];
  });

  constructor() {
    this.dataService
      .getCategories()
      .subscribe((categories) => this.categories.set(categories));
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
      toObservable(this.dataService.currentDistrictId).pipe(
        startWith(this.dataService.currentDistrictId()),
      ),
      toObservable(this.dataService.selectedCategoryId).pipe(
        startWith(this.dataService.selectedCategoryId()),
      ),
      toObservable(this.dataService.sortOption).pipe(
        startWith(this.dataService.sortOption()),
      ),
      toObservable(computed(() => this.pagination().current_page)).pipe(
        startWith(this.pagination().current_page),
      ),
    ])
      .pipe(
        switchMap(([cityId, wardCode, areaId, categoryId, sort, page]) => {
          this.loading.set(true);
          return this.locationApi.fetchLocationsPaginated({
            cityId,
            wardCode: wardCode.trim(),
            areaId,
            categoryId,
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

  setArea(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.dataService.currentDistrictId.set(value);
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
