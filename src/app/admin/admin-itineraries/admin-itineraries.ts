import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import {
  AdminItinerary,
  GenerateItineraryPayload,
  ItineraryApiService,
  UpdateItineraryPayload,
} from '../../core/services/itinerary-api.service';

type CompanionType = 'solo' | 'couple' | 'friends' | 'group' | 'family';
type EnergyLevel = 'low' | 'balanced' | 'high';
type TripStyle = 'relaxed' | 'focused' | 'romantic' | 'check-in' | 'adventure' | 'social';

interface GenerateFormState {
  title: string;
  destination_city: string;
  days: number;
  budget: number;
  travel_mode: string;
  start_time: string;
  end_time: string;
  preferences: string;
  trip_style: TripStyle;
  companion_type: CompanionType;
  energy_level: EnergyLevel;
}

interface EditFormState {
  title: string;
  destination_city: string;
  days: number;
  budget: number;
  travel_mode: string;
  start_time: string;
  end_time: string;
  preferences: string;
  trip_style: string;
  companion_type: string;
  energy_level: string;
}

@Component({
  selector: 'app-admin-itineraries',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-itineraries.html',
  styleUrl: './admin-itineraries.css',
})
export class AdminItineraries {
  private itineraryApi = inject(ItineraryApiService);

  itineraries = signal<AdminItinerary[]>([]);
  selectedItinerary = signal<AdminItinerary | null>(null);
  currentPage = signal(1);
  perPage = signal(10);
  total = signal(0);
  lastPage = signal(1);

  search = signal('');
  selectedCity = signal('all');
  selectedModel = signal('all');
  loading = signal(false);
  detailLoading = signal(false);
  generating = signal(false);
  saving = signal(false);
  deleting = signal(false);
  errorMessage = signal('');
  detailError = signal('');
  successMessage = signal('');

  generateForm = signal<GenerateFormState>({
    title: '',
    destination_city: 'Ho Chi Minh',
    days: 1,
    budget: 1200000,
    travel_mode: 'motorbike',
    start_time: '09:00',
    end_time: '21:00',
    preferences: 'Quan ca phe, check-in',
    trip_style: 'relaxed' as TripStyle,
    companion_type: 'solo' as CompanionType,
    energy_level: 'balanced' as EnergyLevel,
  });

  editForm = signal<EditFormState>({
    title: '',
    destination_city: '',
    days: 1,
    budget: 0,
    travel_mode: '',
    start_time: '',
    end_time: '',
    preferences: '',
    trip_style: 'relaxed',
    companion_type: 'solo',
    energy_level: 'balanced',
  });

  filteredItineraries = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const city = this.selectedCity();
    const model = this.selectedModel();

    return this.itineraries().filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        (item.destination_city ?? '').toLowerCase().includes(keyword) ||
        (item.ai_model ?? '').toLowerCase().includes(keyword);

      const matchesCity = city === 'all' || (item.destination_city ?? 'Khac') === city;
      const matchesModel = model === 'all' || (item.ai_model ?? 'Unknown') === model;

      return matchesKeyword && matchesCity && matchesModel;
    });
  });

  metrics = computed(() => {
    const items = this.itineraries();
    const totalBudget = items.reduce((sum, item) => sum + Number(item.budget ?? 0), 0);
    const totalDays = items.reduce((sum, item) => sum + item.days, 0);
    const avgBudget = items.length ? totalBudget / items.length : 0;
    const avgDays = items.length ? totalDays / items.length : 0;
    const uniqueModels = new Set(items.map((item) => item.ai_model || 'Unknown')).size;
    const generatedToday = items.filter((item) => this.isToday(item.created_at)).length;

    return [
      {
        label: 'Tong lich trinh',
        value: this.total().toLocaleString('vi-VN'),
        note: `${this.currentPage()}/${this.lastPage()} trang`,
        icon: 'fa-route',
        tone: 'bg-orange-50 text-orange-500',
      },
      {
        label: 'AI models',
        value: uniqueModels.toLocaleString('vi-VN'),
        note: 'Dang duoc backend su dung',
        icon: 'fa-robot',
        tone: 'bg-sky-50 text-sky-600',
      },
      {
        label: 'Budget trung binh',
        value: `${Math.round(avgBudget).toLocaleString('vi-VN')}d`,
        note: `${avgDays.toFixed(1)} ngay / lich trinh`,
        icon: 'fa-wallet',
        tone: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Moi hom nay',
        value: generatedToday.toLocaleString('vi-VN'),
        note: 'Theo created_at',
        icon: 'fa-sparkles',
        tone: 'bg-violet-50 text-violet-600',
      },
    ];
  });

  uniqueCities = computed(() =>
    Array.from(
      new Set(this.itineraries().map((item) => item.destination_city || 'Khac'))
    ).sort()
  );

  uniqueModels = computed(() =>
    Array.from(new Set(this.itineraries().map((item) => item.ai_model || 'Unknown'))).sort()
  );

  constructor() {
    this.fetchItineraries();
  }

  fetchItineraries(page = this.currentPage()) {
    this.loading.set(true);
    this.errorMessage.set('');

    this.itineraryApi
      .fetchItinerariesPaginated(page, this.perPage())
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tai duoc danh sach lich trinh.');
          return of({
            data: [],
            meta: {
              current_page: 1,
              per_page: this.perPage(),
              total: 0,
              last_page: 1,
              from: null,
              to: null,
            },
          });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        this.itineraries.set(result.data);
        this.currentPage.set(result.meta.current_page);
        this.perPage.set(result.meta.per_page);
        this.total.set(result.meta.total);
        this.lastPage.set(result.meta.last_page);

        const selected = this.selectedItinerary();
        if (selected && !result.data.some((item) => item.id === selected.id)) {
          this.selectedItinerary.set(null);
        }
      });
  }

  reloadList() {
    this.fetchItineraries(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) {
      return;
    }

    this.fetchItineraries(page);
  }

  openDetail(itinerary: AdminItinerary) {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.selectedItinerary.set(itinerary);

    this.itineraryApi
      .getItinerary(itinerary.id)
      .pipe(
        catchError((error) => {
          this.detailError.set(error?.error?.message || 'Khong tai duoc chi tiet lich trinh.');
          return of(itinerary);
        }),
        finalize(() => this.detailLoading.set(false))
      )
      .subscribe((detail) => {
        this.selectedItinerary.set(detail);
        this.hydrateEditForm(detail);
      });
  }

  closeDetail() {
    this.selectedItinerary.set(null);
    this.detailError.set('');
  }

  updateGenerateField<K extends keyof GenerateFormState>(key: K, value: GenerateFormState[K]) {
    this.generateForm.update((form) => ({ ...form, [key]: value }));
  }

  updateEditField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    this.editForm.update((form) => ({ ...form, [key]: value }));
  }

  generateItinerary() {
    this.generating.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.itineraryApi
      .generateItinerary(this.buildGeneratePayload())
      .pipe(
        catchError((error) => {
          this.errorMessage.set(error?.error?.message || 'Khong tao duoc lich trinh moi.');
          return of(null);
        }),
        finalize(() => this.generating.set(false))
      )
      .subscribe((itinerary) => {
        if (!itinerary) {
          return;
        }

        this.successMessage.set('Da tao lich trinh moi tu API Gemini.');
        this.fetchItineraries(1);
        this.openDetail(itinerary);
      });
  }

  saveMetadata() {
    const itinerary = this.selectedItinerary();
    if (!itinerary) {
      return;
    }

    this.saving.set(true);
    this.detailError.set('');
    this.successMessage.set('');

    this.itineraryApi
      .updateItinerary(itinerary.id, this.buildUpdatePayload())
      .pipe(
        catchError((error) => {
          this.detailError.set(error?.error?.message || 'Khong cap nhat duoc metadata.');
          return of(null);
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe((updated) => {
        if (!updated) {
          return;
        }

        this.selectedItinerary.set(updated);
        this.hydrateEditForm(updated);
        this.successMessage.set('Da cap nhat metadata lich trinh.');
        this.fetchItineraries(this.currentPage());
      });
  }

  deleteSelected() {
    const itinerary = this.selectedItinerary();
    if (!itinerary || typeof window === 'undefined') {
      return;
    }

    const confirmed = window.confirm(`Xoa lich trinh "${itinerary.title}"?`);
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.detailError.set('');
    this.successMessage.set('');

    this.itineraryApi
      .deleteItinerary(itinerary.id)
      .pipe(
        catchError((error) => {
          this.detailError.set(error?.error?.message || 'Khong xoa duoc lich trinh.');
          return of(null);
        }),
        finalize(() => this.deleting.set(false))
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }

        this.successMessage.set(response.message || 'Da xoa lich trinh.');
        this.closeDetail();
        this.fetchItineraries(this.currentPage());
      });
  }

  private hydrateEditForm(itinerary: AdminItinerary) {
    this.editForm.set({
      title: itinerary.title,
      destination_city: itinerary.destination_city || '',
      days: itinerary.days,
      budget: Number(itinerary.budget ?? 0),
      travel_mode: itinerary.travel_mode || '',
      start_time: this.normalizeTime(itinerary.start_time),
      end_time: this.normalizeTime(itinerary.end_time),
      preferences: (itinerary.preferences_json.tags ?? []).join(', '),
      trip_style: itinerary.preferences_json.trip_style || 'relaxed',
      companion_type: itinerary.preferences_json.companion_type || 'solo',
      energy_level: itinerary.preferences_json.energy_level || 'balanced',
    });
  }

  private buildGeneratePayload(): GenerateItineraryPayload {
    const form = this.generateForm();
    return {
      title: form.title || null,
      destination_city: form.destination_city || null,
      days: Number(form.days),
      budget: Number(form.budget),
      travel_mode: form.travel_mode || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      preferences: this.parseTags(form.preferences),
      trip_style: form.trip_style,
      companion_type: form.companion_type,
      energy_level: form.energy_level,
    };
  }

  private buildUpdatePayload(): UpdateItineraryPayload {
    const form = this.editForm();
    return {
      title: form.title || null,
      destination_city: form.destination_city || null,
      days: Number(form.days),
      budget: Number(form.budget),
      travel_mode: form.travel_mode || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      preferences: this.parseTags(form.preferences),
      trip_style: form.trip_style || null,
      companion_type: form.companion_type || null,
      energy_level: form.energy_level || null,
    };
  }

  private parseTags(value: string): string[] {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private normalizeTime(value: string | null): string {
    return value ? value.slice(0, 5) : '';
  }

  private isToday(value: string | null): boolean {
    if (!value) {
      return false;
    }

    const date = new Date(value);
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }
}
