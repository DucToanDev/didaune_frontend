import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { Place } from '../../../core/models/app.models';
import { getSuggestedHours } from '../../../core/utils/place-display.utils';

@Component({
  selector: 'app-place-grid-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './place-grid-card.html',
  host: {
    class: 'block h-full',
  },
})
export class PlaceGridCardComponent {
  private router = inject(Router);

  place = input.required<Place>();
  isFavorite = input(false);
  categoryLimit = input(1);

  favoriteToggle = output<string>();

  readonly suggestedHours = computed(() => getSuggestedHours(this.place()));
  readonly visibleCategoryLabels = computed(() =>
    this.place().category_labels.slice(0, this.categoryLimit()),
  );

  onFavoriteClick(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteToggle.emit(this.place().slug);
  }

  openDetail(event: Event) {
    const slug = this.place().slug?.trim();

    if (!slug) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    void this.router.navigate(['/detail', slug]);
  }
}
