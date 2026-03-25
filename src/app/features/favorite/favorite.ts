import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-favorite',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './favorite.html',
  styleUrl: './favorite.css',
})
export class Favorite {
  public dataService = inject(DataService);

  favorites = signal<Place[]>([]);

  groupedByDistrict = computed(() => {
    const mapByDistrict = new Map<string, Place[]>();

    for (const place of this.favorites()) {
      const current = mapByDistrict.get(place.district_name) ?? [];
      current.push(place);
      mapByDistrict.set(place.district_name, current);
    }

    return [...mapByDistrict.entries()].map(([district, places]) => ({ district, places }));
  });

  constructor() {
    this.dataService.getFavoritePlaces().subscribe((favorites) => this.favorites.set(favorites));
  }

  removeFavorite(event: Event, slug: string) {
    event.preventDefault();
    event.stopPropagation();
    this.dataService.toggleFavorite(slug);
  }
}
