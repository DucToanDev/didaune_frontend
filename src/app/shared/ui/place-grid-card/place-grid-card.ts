import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
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
}
