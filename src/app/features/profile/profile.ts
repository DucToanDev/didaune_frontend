import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
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
  private router = inject(Router);

  favoritesCount = signal(0);
  reviewsCount = computed(() => this.dataService.internalReviews().length);
  user = computed<User>(() => this.dataService.currentUser());
  logoutSubmitting = signal(false);
  logoutError = signal('');

  recentReviews = computed(() => this.dataService.internalReviews().slice(0, 3));

  constructor() {
    this.dataService.getFavoritePlaces().subscribe((favorites) => this.favoritesCount.set(favorites.length));
  }

  logout() {
    this.logoutError.set('');
    this.logoutSubmitting.set(true);

    this.dataService.logout()
      .pipe(finalize(() => this.logoutSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: () => {
          this.logoutError.set('Dang xuat that bai. Vui long thu lai.');
        },
      });
  }
}
