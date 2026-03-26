import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';
import { Router, RouterModule } from '@angular/router';

interface PrimaryCategoryItem {
  id: 'cafe' | 'hotel' | 'homestay' | 'restaurant' | 'travel';
  label: string;
  icon: string;
}

@Component({
  selector: 'app-aside',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './aside.html',
  styleUrl: './aside.css',
})
export class Aside {
  public dataService = inject(DataService);
  private router = inject(Router);

  primaryCategories: PrimaryCategoryItem[] = [
    { id: 'cafe', label: 'Cafe', icon: 'fa-mug-hot' },
    { id: 'hotel', label: 'Hotel', icon: 'fa-bed' },
    { id: 'homestay', label: 'Homestay', icon: 'fa-house' },
    { id: 'restaurant', label: 'Nhà hàng', icon: 'fa-utensils' },
    { id: 'travel', label: 'Du lịch', icon: 'fa-map-location-dot' },
  ];

  onCategoryClick(catId: string) {
    this.dataService.selectedCategoryId.set(catId);
    this.dataService.searchQuery.set('');
    this.dataService.mobileSidebarOpen.set(false);
    this.router.navigate(['/discover']);
  }

  onPrimaryCategoryClick(category: PrimaryCategoryItem) {
    this.dataService.currentDistrictId.set('all');
    this.dataService.selectedAmenityId.set('all');
    this.dataService.sortOption.set('popular');
    this.dataService.selectedCategoryId.set(category.id);
    this.dataService.searchQuery.set('');
    this.dataService.mobileSidebarOpen.set(false);
    this.router.navigate(['/discover']);
  }

  closeMobileSidebar() {
    this.dataService.mobileSidebarOpen.set(false);
  }
}
