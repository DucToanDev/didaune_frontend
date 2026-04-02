import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import {
  Category,
  City,
  PaginationMeta,
  Place,
} from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import {
  LocationApiService,
  UpdateLocationPayload,
} from '../../core/services/location-api.service';
import { ToastService } from '../../core/services/toast.service';
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
  private dataService = inject(DataService);
  private toast = inject(ToastService);

  loading = signal(false);
  saving = signal(false);
  places = signal<Place[]>([]);
  cities = signal<City[]>([]);
  categories = signal<Category[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 12,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });

  search = signal('');
  selectedCityId = signal('all');
  selectedCategory = signal('all');
  selectedSort = signal<'popular' | 'rating' | 'name' | 'new'>('new');
  perPage = signal(12);

  importFile = signal<File | null>(null);
  importTruncate = signal(false);
  importLoading = signal(false);
  importMessage = signal('');
  latestImportBatchId = signal<string | null>(null);
  latestImportFileName = signal('');
  latestImportCount = signal<number | null>(null);
  expandedSourcePlaceId = signal<string | null>(null);
  deletingLocationId = signal<string | null>(null);
  deletingBatchId = signal<string | null>(null);

  selectedPlace = signal<Place | null>(null);
  editMode = signal(false);

  formName = signal('');
  formCategory = signal('');
  formAddress = signal('');
  formWard = signal('');
  formDistrict = signal('');
  formCity = signal('');
  formDescription = signal('');
  formPhone = signal('');
  formWebsite = signal('');
  formGoogleMaps = signal('');
  formPriceRange = signal('');
  formImage = signal('');
  formStatus = signal('');
  formTemporaryClosed = signal(false);
  formPermanentClosed = signal(false);

  activeMetrics = computed(() => {
    const p = this.places();
    return [
      {
        label: 'Tổng kết kết quả',
        value: this.pagination().total.toLocaleString('vi-VN'),
        note: `Trang ${this.pagination().current_page}/${this.pagination().last_page}`,
        icon: 'fa-layer-group',
        variant: 'sky',
      },
      {
        label: 'Đang mở cửa',
        value: p
          .filter((x) => !x.is_permanently_closed && !x.is_temporarily_closed)
          .length.toString(),
        note: 'Trong trang hiện tại',
        icon: 'fa-door-open',
        variant: 'green',
      },
      {
        label: 'Có chủ sở hữu',
        value: p.filter((x) => x.owner_name).length.toString(),
        note: 'Đã có owner',
        icon: 'fa-user-tie',
        variant: 'violet',
      },
      {
        label: 'Cần claim',
        value: p.filter((x) => x.can_claim).length.toString(),
        note: 'Có thể liên hệ đối tác',
        icon: 'fa-bullhorn',
        variant: 'orange',
      },
    ];
  });

  filteredPlaces = computed(() => {
    return this.places();
  });

  visiblePages = computed(() => {
    const current = this.pagination().current_page;
    const last = this.pagination().last_page;
    const start = Math.max(1, current - 2);
    const end = Math.min(last, current + 2);
    const pages: number[] = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  });

  ngOnInit() {
    this.dataService.getCities().subscribe((data) => this.cities.set(data));
    this.dataService
      .getCategories()
      .subscribe((data) => this.categories.set(data));
    this.loadData();
  }

  loadData(page = 1) {
    this.loading.set(true);
    this.locationApi
      .fetchLocationsPaginated({
        cityId: this.selectedCityId(),
        search: this.search(),
        categoryId: this.selectedCategory(),
        sort: this.selectedSort(),
        page,
        perPage: this.perPage(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.places.set(result.data);
        this.pagination.set(result.meta);
        this.expandedSourcePlaceId.update((current) =>
          result.data.some((place) => place.id === current) ? current : null,
        );
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
    this.editMode.set(false);
    this.patchEditForm(place);
  }

  closeDetail() {
    this.selectedPlace.set(null);
    this.editMode.set(false);
  }

  startEdit() {
    const place = this.selectedPlace();
    if (!place) return;
    this.patchEditForm(place);
    this.editMode.set(true);
  }

  cancelEdit() {
    const place = this.selectedPlace();
    if (!place) return;
    this.patchEditForm(place);
    this.editMode.set(false);
  }

  saveEdit() {
    const place = this.selectedPlace();
    if (!place || this.saving()) return;

    const payload: UpdateLocationPayload = {
      name: this.formName().trim(),
      main_category: this.formCategory().trim() || null,
      full_address: this.formAddress().trim() || null,
      ward: this.formWard().trim() || null,
      district: this.formDistrict().trim() || null,
      city: this.formCity().trim() || null,
      description: this.formDescription().trim() || null,
      phone: this.formPhone().trim() || null,
      website: this.formWebsite().trim() || null,
      google_maps_link: this.formGoogleMaps().trim() || null,
      price_range: this.formPriceRange().trim() || null,
      featured_image: this.formImage().trim() || null,
      status: this.formStatus().trim() || null,
      is_temporarily_closed: this.formTemporaryClosed(),
      is_permanently_closed: this.formPermanentClosed(),
    };

    this.saving.set(true);
    this.locationApi
      .updateLocation(place.id, payload, place.city_id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe((updatedPlace) => {
        this.places.update((list) =>
          list.map((item) => (item.id === updatedPlace.id ? updatedPlace : item)),
        );
        this.selectedPlace.set(updatedPlace);
        this.editMode.set(false);
      });
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
          this.latestImportBatchId.set(res.data?.batch_id?.trim() || null);
          this.latestImportFileName.set(res.data?.file_name?.trim() || file.name);
          this.latestImportCount.set(res.data?.imported ?? null);

          if (res.data?.batch_id) {
            this.toast.success(
              `Đã import ${res.data.imported ?? 0} địa điểm từ ${res.data.file_name ?? file.name}.`,
            );
          }

          this.loadData(1);
        },
        error: (err) => {
          this.importMessage.set(err.error?.message || 'Import thất bại');
          this.toast.error(err.error?.message || 'Import thất bại.');
        },
      });
  }

  deleteLatestImportBatch() {
    const batchId = this.latestImportBatchId();

    if (!batchId) {
      this.toast.warning('Chưa có batch import nào để xóa.');
      return;
    }

    this.deleteImportBatchById(batchId, this.latestImportFileName() || batchId);
  }

  deletePlace(place: Place) {
    if (
      this.deletingLocationId() === place.id ||
      !window.confirm(`Xóa địa điểm "${place.name}"?`)
    ) {
      return;
    }

    this.deletingLocationId.set(place.id);
    this.locationApi
      .deleteLocation(place.id)
      .pipe(finalize(() => this.deletingLocationId.set(null)))
      .subscribe({
        next: (response) => {
          if (this.selectedPlace()?.id === place.id) {
            this.closeDetail();
          }

          this.toast.success(response.message || 'Đã xóa địa điểm.');
          this.loadData(this.pagination().current_page);
        },
        error: () => {
          this.toast.error('Không xóa được địa điểm.');
        },
      });
  }

  deleteImportBatch(place: Place) {
    const batchId = place.import_batch_id?.trim();

    if (!batchId) {
      this.toast.warning('Địa điểm này không thuộc file import nào.');
      return;
    }

    this.deleteImportBatchById(
      batchId,
      place.import_file_name?.trim() || batchId,
    );
  }

  exportCsv() {
    const header = [
      'id',
      'name',
      'address',
      'district',
      'city',
      'categories',
      'rating',
      'review_count',
      'owner_name',
      'status',
      'latitude',
      'longitude',
    ];
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

    this.downloadFile('\uFEFF' + csv, 'admin-locations.csv', 'text/csv;charset=utf-8');
  }

  exportJson() {
    this.downloadFile(
      JSON.stringify(this.filteredPlaces(), null, 2),
      'admin-locations.json',
      'application/json;charset=utf-8',
    );
  }

  private patchEditForm(place: Place) {
    this.formName.set(place.name ?? '');
    this.formCategory.set(place.category_labels[0] ?? place.categories[0] ?? '');
    this.formAddress.set(place.address ?? '');
    this.formWard.set(place.ward_name ?? '');
    this.formDistrict.set(place.district_name ?? '');
    this.formCity.set(place.city_name ?? '');
    this.formDescription.set(place.description ?? '');
    this.formPhone.set(place.phone ?? '');
    this.formWebsite.set(place.website ?? '');
    this.formGoogleMaps.set(place.google_maps_link ?? '');
    this.formPriceRange.set(place.price_range ?? '');
    this.formImage.set(place.image ?? '');
    this.formStatus.set(place.status ?? '');
    this.formTemporaryClosed.set(place.is_temporarily_closed);
    this.formPermanentClosed.set(place.is_permanently_closed);
  }

  sourceLabel(place: Place): string {
    if (place.import_file_name?.trim()) {
      return place.import_file_name.trim();
    }

    if (place.source === 'user_submission') {
      return 'Đóng góp người dùng';
    }

    if (place.source === 'import_json') {
      return 'Import JSON';
    }

    if (place.source === 'google_maps') {
      return 'Google Maps';
    }

    return 'Thủ công';
  }

  toggleSourceDetails(place: Place, event?: Event) {
    event?.stopPropagation();
    this.expandedSourcePlaceId.update((current) =>
      current === place.id ? null : place.id,
    );
  }

  isSourceDetailsOpen(place: Place): boolean {
    return this.expandedSourcePlaceId() === place.id;
  }

  canDeleteBatch(place: Place): boolean {
    return Boolean(place.import_batch_id?.trim());
  }

  hasLatestImportBatch(): boolean {
    return Boolean(this.latestImportBatchId());
  }

  private deleteImportBatchById(batchId: string, label: string) {
    if (
      this.deletingBatchId() === batchId ||
      !window.confirm(`Xóa toàn bộ địa điểm thuộc file import "${label}"?`)
    ) {
      return;
    }

    this.deletingBatchId.set(batchId);
    this.locationApi
      .deleteImportBatch(batchId)
      .pipe(finalize(() => this.deletingBatchId.set(null)))
      .subscribe({
        next: (response) => {
          if (this.selectedPlace()?.import_batch_id === batchId) {
            this.closeDetail();
          }

          if (this.latestImportBatchId() === batchId) {
            this.latestImportBatchId.set(null);
            this.latestImportFileName.set('');
            this.latestImportCount.set(null);
          }

          this.toast.success(response.message || 'Đã xóa dữ liệu theo file import.');
          this.loadData(1);
        },
        error: () => {
          this.toast.error('Không xóa được dữ liệu theo file import.');
        },
      });
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
