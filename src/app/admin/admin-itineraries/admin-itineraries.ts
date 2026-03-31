import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import {
  AdminItinerary,
  GenerateItineraryPayload,
  ItineraryApiService,
} from '../../core/services/itinerary-api.service';
import { AdminHeader } from '../shared/admin-header/admin-header';
import { MetricCard } from '../shared/metric-card/metric-card';
import { rankBy, weekdayBars } from '../shared/admin-utils';

@Component({
  selector: 'app-admin-itineraries',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminHeader, MetricCard],
  templateUrl: './admin-itineraries.html',
  styleUrl: './admin-itineraries.css',
})
export class AdminItineraries implements OnInit {
  private itineraryApi = inject(ItineraryApiService);

  loading = signal(false);
  itineraries = signal<AdminItinerary[]>([]);
  currentPage = signal(1);
  perPage = signal(10);

  showGenerateForm = signal(false);
  generating = signal(false);
  generateError = signal('');
  expandedId = signal<number | null>(null);
  duplicateLoadingId = signal<number | null>(null);

  search = signal('');
  cityFilter = signal('all');
  modelFilter = signal('all');
  sourceFilter = signal<'all' | 'ai' | 'manual'>('all');

  // Generate form
  genDays = signal(2);
  genCity = signal('Hồ Chí Minh');
  genBudget = signal<number | null>(null);
  genTravelMode = signal('motorbike');
  genTripStyle = signal('balanced');
  genCompanion = signal('solo');

  filteredItineraries = computed(() => {
    const searchValue = this.search().trim().toLowerCase();

    return this.itineraries().filter((item) => {
      const matchesSearch =
        !searchValue ||
        item.title.toLowerCase().includes(searchValue) ||
        (item.destination_city ?? '').toLowerCase().includes(searchValue) ||
        (item.ai_model ?? '').toLowerCase().includes(searchValue);
      const matchesCity =
        this.cityFilter() === 'all' || (item.destination_city ?? '') === this.cityFilter();
      const matchesModel =
        this.modelFilter() === 'all' || (item.ai_model ?? 'unknown') === this.modelFilter();
      const matchesSource =
        this.sourceFilter() === 'all' || (item.itinerary_type ?? 'manual') === this.sourceFilter();

      return matchesSearch && matchesCity && matchesModel && matchesSource;
    });
  });

  pagedItineraries = computed(() => {
    const start = (this.currentPage() - 1) * this.perPage();
    return this.filteredItineraries().slice(start, start + this.perPage());
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItineraries().length / this.perPage())),
  );

  pageSummary = computed(() => {
    const total = this.filteredItineraries().length;
    if (!total) {
      return { from: 0, to: 0, total: 0 };
    }

    const from = (this.currentPage() - 1) * this.perPage() + 1;
    const to = Math.min(this.currentPage() * this.perPage(), total);
    return { from, to, total };
  });

  metrics = computed(() => {
    const items = this.filteredItineraries();
    const avgDays = items.length > 0 ? (items.reduce((s, i) => s + i.days, 0) / items.length).toFixed(1) : '0';
    const totalKm = items.reduce((s, i) => {
      const km = parseFloat(i.overview?.total_travel_distance_km || '0');
      return s + (isNaN(km) ? 0 : km);
    }, 0);
    const models = new Set(items.map(i => i.ai_model).filter(Boolean));
    return [
      { label: 'Tổng lịch trình', value: items.length.toLocaleString('vi-VN'), note: `Trang ${this.currentPage()}/${this.totalPages()}`, icon: 'fa-route', variant: 'sky' },
      { label: 'Số ngày TB', value: avgDays, note: 'Trung bình trang hiện tại', icon: 'fa-calendar-days', variant: 'green' },
      { label: 'Tổng km', value: totalKm.toFixed(1) + ' km', note: 'Trang hiện tại', icon: 'fa-road', variant: 'orange' },
      { label: 'AI Models', value: models.size.toString(), note: [...models].join(', ') || 'N/A', icon: 'fa-brain', variant: 'violet' },
    ];
  });

  topModels = computed(() => rankBy(this.itineraries(), (i) => i.ai_model || 'unknown'));
  weekBars = computed(() => weekdayBars(this.itineraries()));
  cityOptions = computed(() =>
    [...new Set(this.itineraries().map((item) => item.destination_city).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b))),
  );
  modelOptions = computed(() =>
    [...new Set(this.itineraries().map((item) => item.ai_model || 'unknown'))]
      .sort((a, b) => a.localeCompare(b)),
  );

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.itineraryApi
      .fetchAllItineraries(50)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.itineraries.set(result);
        this.currentPage.set(1);
      });
  }

  applyFilters() {
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  toggleExpand(id: number) {
    this.expandedId.update((v) => (v === id ? null : id));
  }

  deleteItinerary(id: number) {
    if (!confirm('Xóa lịch trình này?')) return;
    this.itineraryApi.deleteItinerary(id).subscribe(() => {
      this.itineraries.update((list) => list.filter((i) => i.id !== id));
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    });
  }

  duplicateItinerary(itinerary: AdminItinerary) {
    this.duplicateLoadingId.set(itinerary.id);
    this.itineraryApi
      .createItinerary({
        title: `${itinerary.title} (copy)`,
        description: itinerary.description,
        cover_image: itinerary.cover_image,
        itinerary_type: itinerary.itinerary_type ?? 'manual',
        destination_city: itinerary.destination_city,
        start_date: itinerary.start_date,
        end_date: itinerary.end_date,
        days: itinerary.days,
        budget: itinerary.budget ? Number(itinerary.budget) : null,
        travel_mode: itinerary.travel_mode,
        start_time: itinerary.start_time,
        end_time: itinerary.end_time,
        preferences: itinerary.preferences?.tags ?? [],
        trip_style: itinerary.preferences?.trip_style ?? null,
        companion_type: itinerary.preferences?.companion_type ?? null,
        energy_level: itinerary.preferences?.energy_level ?? null,
        max_distance_km_per_day: itinerary.preferences?.max_distance_km_per_day ?? null,
        must_include_location_ids: itinerary.preferences?.must_include_location_ids ?? [],
        members: itinerary.members ?? [],
        items: itinerary.items.map((item, index) => ({
          day_number: item.day_number,
          start_time: item.start_time,
          end_time: item.end_time,
          location_id: item.location_id ?? null,
          activity_title: item.activity_title,
          activity_type: item.activity_type ?? null,
          note: item.note ?? null,
          transport_mode: item.transport_mode ?? null,
          estimated_cost: item.estimated_cost ? Number(item.estimated_cost) : null,
          travel_minutes_from_previous: item.travel_minutes_from_previous ?? null,
          travel_distance_km_from_previous: item.travel_distance_km_from_previous
            ? Number(item.travel_distance_km_from_previous)
            : null,
          sort_order: item.sort_order ?? index + 1,
        })),
      })
      .pipe(finalize(() => this.duplicateLoadingId.set(null)))
      .subscribe((created) => {
        this.itineraries.update((list) => [created, ...list]);
        this.currentPage.set(1);
      });
  }

  exportItinerary(itinerary: AdminItinerary) {
    const payload = JSON.stringify(itinerary, null, 2);
    const filename = `${this.slugify(itinerary.title || `itinerary-${itinerary.id}`)}.json`;
    this.downloadFile(payload, filename, 'application/json;charset=utf-8');
  }

  generateItinerary() {
    this.generating.set(true);
    this.generateError.set('');
    const payload: GenerateItineraryPayload = {
      days: this.genDays(),
      destination_city: this.genCity(),
      budget: this.genBudget(),
      travel_mode: this.genTravelMode(),
      trip_style: this.genTripStyle(),
      companion_type: this.genCompanion(),
    };
    this.itineraryApi
      .generateItinerary(payload)
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: () => {
          this.showGenerateForm.set(false);
          this.loadData();
        },
        error: (err) => {
          this.generateError.set(err.error?.message || 'Tạo thất bại');
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

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
