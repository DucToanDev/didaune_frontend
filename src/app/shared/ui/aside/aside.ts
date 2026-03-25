import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../core/services/data.service';
import { Router, RouterModule } from '@angular/router';

interface PrimaryCategoryItem {
  id: 'cafe' | 'hotel' | 'restaurant' | 'travel';
  label: string;
  icon: string;
  query: string;
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
    { id: 'cafe', label: 'Caffe', icon: 'fa-mug-hot', query: 'cafe' },
    { id: 'hotel', label: 'Hotel / Homestay', icon: 'fa-bed', query: 'hotel homestay' },
    { id: 'restaurant', label: 'Nhà hàng', icon: 'fa-utensils', query: 'nhà hàng' },
    { id: 'travel', label: 'Du lịch', icon: 'fa-map', query: 'du lịch' },
  ];

  onCategoryClick(catId: string) {
    this.dataService.selectedCategoryId.set(catId);
    this.router.navigate(['/discover']);
  }

  onPrimaryCategoryClick(category: PrimaryCategoryItem) {
    this.dataService.currentDistrictId.set('all');
    this.dataService.selectedAmenityId.set('all');
    this.dataService.sortOption.set('popular');

    if (category.id === 'cafe') {
      this.dataService.selectedCategoryId.set('cafe');
      this.dataService.searchQuery.set('');
      this.router.navigate(['/discover']);
      return;
    }

    this.dataService.selectedCategoryId.set('all');
    this.dataService.searchQuery.set(category.query);
    this.router.navigate(['/list']);
  }
}
