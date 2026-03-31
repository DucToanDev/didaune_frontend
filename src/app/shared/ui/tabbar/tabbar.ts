import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './tabbar.html',
  styleUrl: './tabbar.css',
})
export class Tabbar {
  private router = inject(Router);
  dataService = inject(DataService);

  openProfileOrAuth(event: Event) {
    if (this.dataService.isAuthenticated()) {
      return;
    }

    event.preventDefault();
    this.dataService.requestProtectedAuthModal('login');
  }

  openFavoriteOrAuth(event: Event) {
    if (this.dataService.isAuthenticated()) {
      return;
    }

    event.preventDefault();
    this.dataService.requestProtectedAuthModal('login');
  }
}
