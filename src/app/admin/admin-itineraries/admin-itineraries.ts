import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { PaginationMeta } from '../../core/models/app.models';
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
  pagination = signal<PaginationMeta>({
    current_page: 1, per_page: 10, total: 0, last_page: 1, from: null, to: null,
  });

  showGenerateForm = signal(false);
  generating = signal(false);
  generateError = signal('');
  expandedId = signal<number | null>(null);

  // Generate form
  genDays = signal(2);
  genCity = signal('Hồ Chí Minh');
  genBudget = signal<number | null>(null);
  genTravelMode = signal('motorbike');
  genTripStyle = signal('balanced');
  genCompanion = signal('solo');

  metrics = computed(() => {
    const items = this.itineraries();
    const avgDays = items.length > 0 ? (items.reduce((s, i) => s + i.days, 0) / items.length).toFixed(1) : '0';
    const totalKm = items.reduce((s, i) => {
      const km = parseFloat(i.overview?.total_travel_distance_km || '0');
      return s + (isNaN(km) ? 0 : km);
    }, 0);
    const models = new Set(items.map(i => i.ai_model).filter(Boolean));
    return [
      { label: 'Tổng lịch trình', value: this.pagination().total.toLocaleString('vi-VN'), note: `Trang ${this.pagination().current_page}/${this.pagination().last_page}`, icon: 'fa-route', variant: 'sky' },
      { label: 'Số ngày TB', value: avgDays, note: 'Trung bình trang hiện tại', icon: 'fa-calendar-days', variant: 'green' },
      { label: 'Tổng km', value: totalKm.toFixed(1) + ' km', note: 'Trang hiện tại', icon: 'fa-road', variant: 'orange' },
      { label: 'AI Models', value: models.size.toString(), note: [...models].join(', ') || 'N/A', icon: 'fa-brain', variant: 'violet' },
    ];
  });

  topModels = computed(() => rankBy(this.itineraries(), (i) => i.ai_model || 'unknown'));
  weekBars = computed(() => weekdayBars(this.itineraries()));

  ngOnInit() {
    this.loadData();
  }

  loadData(page = 1) {
    this.loading.set(true);
    this.itineraryApi
      .fetchItinerariesPaginated(page, 10)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.itineraries.set(result.data);
        this.pagination.set(result.meta);
      });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page) return;
    this.loadData(page);
  }

  toggleExpand(id: number) {
    this.expandedId.update((v) => (v === id ? null : id));
  }

  deleteItinerary(id: number) {
    if (!confirm('Xóa lịch trình này?')) return;
    this.itineraryApi.deleteItinerary(id).subscribe(() => {
      this.itineraries.update((list) => list.filter((i) => i.id !== id));
    });
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
          this.loadData(1);
        },
        error: (err) => {
          this.generateError.set(err.error?.message || 'Tạo thất bại');
        },
      });
  }
}
