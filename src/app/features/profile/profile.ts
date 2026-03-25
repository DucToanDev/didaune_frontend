import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { User } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  public dataService = inject(DataService);

  favoritesCount = signal(0);
  reviewsCount = computed(() => this.dataService.internalReviews().length);
  user = computed<User>(() => this.dataService.currentUser());

  recentReviews = computed(() => this.dataService.internalReviews().slice(0, 3));

  constructor() {
    this.dataService.getFavoritePlaces().subscribe((favorites) => this.favoritesCount.set(favorites.length));
  }
}
