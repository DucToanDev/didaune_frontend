import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Category, District, Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './discover.html',
  styleUrl: './discover.css',
})
export class Discover {
  public dataService = inject(DataService);

  places = signal<Place[]>([]);
  categories = signal<Category[]>([]);
  areaOptions = signal<District[]>([]);
  areas = computed(() =>
    this.areaOptions().filter((area) => area.city_id === this.dataService.currentCityId())
  );

  filteredPlaces = computed(() => {
    const categoryId = this.dataService.selectedCategoryId();
    const areaId = this.dataService.currentDistrictId();
    const amenityId = this.dataService.selectedAmenityId();
    const wardCode = this.dataService.currentWardCode().trim();
    const wardName = this.dataService.currentWardName().trim().toLowerCase();
    const sorted = this.sortPlaces(
      this.places().filter((place) => {
        const byCity = place.city_id === this.dataService.currentCityId();
        const byArea = areaId === 'all' || place.area_id === areaId;
        const byCategory = categoryId === 'all' || place.categories.includes(categoryId);
        const byAmenity = amenityId === 'all' || place.amenities.includes(amenityId);
        const byWard = !wardName || !!wardCode || place.ward_name.toLowerCase().includes(wardName);
        return byCity && byArea && byCategory && byAmenity && byWard;
      })
    );

    return sorted;
  });

  trendingPlaces = computed(() => this.filteredPlaces().slice(0, 3));
  latestPlaces = computed(() => this.sortPlaces([...this.filteredPlaces()], 'new').slice(0, 4));

  constructor() {
    this.dataService.getPlaces().subscribe((places) => this.places.set(places));
    this.dataService.getCategories().subscribe((categories) => this.categories.set(categories));
    this.dataService.getAreaOptions().subscribe((areas) => this.areaOptions.set(areas));
  }

  setCategory(categoryId: string) {
    this.dataService.selectedCategoryId.set(categoryId);
  }

  setArea(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.dataService.currentDistrictId.set(value);
  }

  setSort(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'popular' | 'rating' | 'name' | 'new';
    this.dataService.sortOption.set(value);
  }

  toggleFavorite(event: Event, slug: string) {
    event.stopPropagation();
    event.preventDefault();
    this.dataService.toggleFavorite(slug);
  }

  private sortPlaces(
    places: Place[],
    sortBy: 'popular' | 'rating' | 'name' | 'new' = this.dataService.sortOption()
  ) {
    return [...places].sort((first, second) => {
      if (sortBy === 'rating') {
        return second.rating - first.rating;
      }

      if (sortBy === 'name') {
        return first.name.localeCompare(second.name);
      }

      if (sortBy === 'new') {
        return Number(second.is_new) - Number(first.is_new) || second.review_count - first.review_count;
      }

      return second.review_count - first.review_count || second.rating - first.rating;
    });
  }
}
