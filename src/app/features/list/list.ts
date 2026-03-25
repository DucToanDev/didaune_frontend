import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Amenity, Category, District, Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './list.html',
  styleUrl: './list.css',
})
export class List {
  public dataService = inject(DataService);

  places = signal<Place[]>([]);
  categories = signal<Category[]>([]);
  areaOptions = signal<District[]>([]);
  areas = computed(() =>
    this.areaOptions().filter((area) => area.city_id === this.dataService.currentCityId())
  );
  amenities = signal<Amenity[]>([]);

  filteredPlaces = computed(() => {
    const query = this.dataService.searchQuery().trim().toLowerCase();
    const areaId = this.dataService.currentDistrictId();
    const categoryId = this.dataService.selectedCategoryId();
    const amenityId = this.dataService.selectedAmenityId();
    const wardCode = this.dataService.currentWardCode().trim();
    const wardName = this.dataService.currentWardName().trim().toLowerCase();

    const results = this.places().filter((place) => {
      const matchCity = place.city_id === this.dataService.currentCityId();
      const matchArea = areaId === 'all' || place.area_id === areaId;
      const matchCategory = categoryId === 'all' || place.categories.includes(categoryId);
      const matchAmenity = amenityId === 'all' || place.amenities.includes(amenityId);
      const matchWard =
        !wardName || !!wardCode || place.ward_name.toLowerCase().includes(wardName);
      const searchable = [
        place.name,
        place.address,
        place.description,
        place.district_name,
        ...place.highlights,
        ...place.category_labels,
      ]
        .join(' ')
        .toLowerCase();
      const matchQuery = !query || searchable.includes(query);

      return matchCity && matchArea && matchCategory && matchAmenity && matchWard && matchQuery;
    });

    return [...results].sort((first, second) => {
      if (this.dataService.sortOption() === 'rating') {
        return second.rating - first.rating;
      }

      if (this.dataService.sortOption() === 'name') {
        return first.name.localeCompare(second.name);
      }

      if (this.dataService.sortOption() === 'new') {
        return Number(second.is_new) - Number(first.is_new) || second.review_count - first.review_count;
      }

      return second.review_count - first.review_count || second.rating - first.rating;
    });
  });

  constructor() {
    this.dataService.getPlaces().subscribe((places) => this.places.set(places));
    this.dataService.getCategories().subscribe((categories) => this.categories.set(categories));
    this.dataService.getAreaOptions().subscribe((areas) => this.areaOptions.set(areas));
    this.dataService.getAmenities().subscribe((amenities) => this.amenities.set(amenities));
  }

  onDistrictChange(event: Event) {
    this.dataService.currentDistrictId.set((event.target as HTMLSelectElement).value);
  }

  onCategoryChange(event: Event) {
    this.dataService.selectedCategoryId.set((event.target as HTMLSelectElement).value);
  }

  onAmenityChange(event: Event) {
    this.dataService.selectedAmenityId.set((event.target as HTMLSelectElement).value);
  }

  onSortChange(event: Event) {
    this.dataService.sortOption.set(
      (event.target as HTMLSelectElement).value as 'popular' | 'rating' | 'name' | 'new'
    );
  }

  clearSearch() {
    this.dataService.searchQuery.set('');
  }

  removeDistrictFilter() {
    this.dataService.currentDistrictId.set('all');
  }

  removeCategoryFilter() {
    this.dataService.selectedCategoryId.set('all');
  }

  removeAmenityFilter() {
    this.dataService.selectedAmenityId.set('all');
  }

  clearAllFilters() {
    this.dataService.resetFilters();
  }

  toggleFavorite(event: Event, slug: string) {
    event.preventDefault();
    event.stopPropagation();
    this.dataService.toggleFavorite(slug);
  }
}
