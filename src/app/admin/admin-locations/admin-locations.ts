import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { Place, PaginationMeta } from '../../core/models/app.models';
import { LocationApiService } from '../../core/services/location-api.service';
import { AdminHeader } from '../shared/admin-header/admin-header';
import { MetricCard } from '../shared/metric-card/metric-card';

@Component({
  selector: 'app-admin-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminHeader, MetricCard],
  templateUrl: './admin-locations.html',
  styleUrl: './admin-locations.css',
})
export class AdminLocations implements OnInit {
  private locationApi = inject(LocationApiService);

  loading = signal(false);
  places = signal<Place[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1, per_page: 12, total: 0, last_page: 1, from: null, to: null,
  });

  // Filters
  search = signal('');
  selectedCityId = signal('hcm');
  districtText = signal('');
  selectedCategory = signal('all');
  selectedSort = signal<'popular' | 'rating' | 'name' | 'new'>('new');
  perPage = signal(12);
  partnerFilter = signal<'all' | 'has_owner' | 'can_claim'>('all');

  // Import
  importFile = signal<File | null>(null);
  importTruncate = signal(false);
  importLoading = signal(false);
  importMessage = signal('');

  // Detail panel
  selectedPlace = signal<Place | null>(null);

  activeMetrics = computed(() => {
    const p = this.places();
    return [
      { label: 'Tổng kết quả', value: this.pagination().total.toLocaleString('vi-VN'), note: `Trang ${this.pagination().current_page}/${this.pagination().last_page}`, icon: 'fa-layer-group', variant: 'sky' },
      { label: 'Đang mở cửa', value: p.filter(x => !x.is_permanently_closed && !x.is_temporarily_closed).length.toString(), note: 'Trong trang hiện tại', icon: 'fa-door-open', variant: 'green' },
      { label: 'Có chủ sở hữu', value: p.filter(x => x.owner_name).length.toString(), note: 'Đã có owner', icon: 'fa-user-tie', variant: 'violet' },
      { label: 'Cần claim', value: p.filter(x => x.can_claim).length.toString(), note: 'Có thể liên hệ đối tác', icon: 'fa-bullhorn', variant: 'orange' },
    ];
  });

  filteredPlaces = computed(() => {
    let result = this.places();
    const filter = this.partnerFilter();
    if (filter === 'has_owner') result = result.filter(p => p.owner_name);
    if (filter === 'can_claim') result = result.filter(p => p.can_claim);
    return result;
  });

  ngOnInit() {
    this.loadData();
  }

  loadData(page = 1) {
    this.loading.set(true);
    this.locationApi
      .fetchLocationsPaginated({
        cityId: this.selectedCityId(),
        search: this.search(),
        wardName: this.districtText(),
        categoryId: this.selectedCategory(),
        sort: this.selectedSort(),
        page,
        perPage: this.perPage(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.places.set(result.data);
        this.pagination.set(result.meta);
      });
  }

  onSearch() {
    this.loadData(1);
  }

  onFiltersChange() {
    this.loadData(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page) return;
    this.loadData(page);
  }

  selectPlace(place: Place) {
    this.selectedPlace.set(place);
  }

  closeDetail() {
    this.selectedPlace.set(null);
  }

  onImportFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
  }

  doImport() {
    const file = this.importFile();
    if (!file) return;
    this.importLoading.set(true);
    this.importMessage.set('');
    this.locationApi
      .importLocations(file, this.importTruncate())
      .pipe(finalize(() => this.importLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.importMessage.set(res.message);
          this.loadData(1);
        },
        error: (err) => {
          this.importMessage.set(err.error?.message || 'Import thất bại');
        },
      });
  }

  deletePlace(place: Place) {
    // Backend doesn't have DELETE /locations — just remove from list locally
    this.places.update(list => list.filter(p => p.id !== place.id));
  }

  exportCsv() {
    const header = ['id', 'name', 'address', 'district', 'city', 'categories', 'rating', 'review_count', 'owner_name', 'status', 'latitude', 'longitude'];
    const rows = this.filteredPlaces().map((place) => [
      place.id,
      place.name,
      place.address,
      place.district_name,
      place.city_name,
      place.category_labels.join(', '),
      place.rating,
      place.review_count,
      place.owner_name ?? '',
      place.status,
      place.latitude ?? '',
      place.longitude ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    this.downloadFile(csv, 'admin-locations.csv', 'text/csv;charset=utf-8');
  }

  exportJson() {
    this.downloadFile(
      JSON.stringify(this.filteredPlaces(), null, 2),
      'admin-locations.json',
      'application/json;charset=utf-8',
    );
  }

  private downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
