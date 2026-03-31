import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ItineraryApiService } from '../../core/services/itinerary-api.service';
import { DataService } from '../../core/services/data.service';
import { PlannerTripForm } from '../planner/shared/planner-trip-form';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-planner-create-ai',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PlannerTripForm],
  templateUrl: './planner-create-ai.html',
  styles: [`
    :host {
      display: block;
    }

    .custom-shadow {
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
    }

    /* ── CTA shimmer ── */


    /* ── Loading spinner ── */
    .ai-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.65s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Warning slide-in ── */
    .ai-slide-in {
      animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Shared input styles ── */
    .ai-label {
      display: block;
      margin-bottom: 5px;
      font-family: 'Inter', sans-serif;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
    }

    .ai-input {
      width: 100%;
      border-radius: 0.75rem;
      border: 1.5px solid #e2e8f0;
      background-color: #f8fafc;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    }

    .ai-input:focus {
      border-color: #f97316;
      box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
      background-color: #fff;
    }

    .ai-input::placeholder {
      color: #cbd5e1;
      font-weight: 500;
    }

    /* ── Number input spinners ── */
    input[type='number']::-webkit-inner-spin-button,
    input[type='number']::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    input[type='number'] {
      -moz-appearance: textfield;
    }
  `],
})
export class PlannerCreateAi {
  private readonly plannerDraftStorageKey = 'didaune-planner-ai-draft';
  private itineraryApi = inject(ItineraryApiService);
  private dataService = inject(DataService);
  private router = inject(Router);
  private toast = inject(ToastService);

  saving = signal(false);
  showTitleWarning = signal(false);

  tripTitle = signal('');
  tripDescription = signal('');
  coverPreviewUrl = signal('');
  startDate = signal('');
  endDate = signal('');

  peopleCount = signal(2);
  estimatedBudget = signal<number | null>(null);
  destinationCity = signal('');
  desiredPlaces = signal('');
  travelMode = signal('car');
  tripStyle = signal('balanced');
  energyLevel = signal('balanced');
  companionType = signal('couple');
  preferencesInput = signal('cafe, ăn uống, chill');
  extraNotes = signal('');

  readonly tripDays = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) {
      return 0;
    }

    const diff = new Date(end).getTime() - new Date(start).getTime();
    return diff >= 0 ? Math.ceil(diff / 86_400_000) + 1 : 0;
  });

  constructor() {
    this.restoreDraft();
  }

  generateTrip() {
    const validationMessage = this.validateTripForm();
    if (validationMessage) {
      this.showTitleWarning.set(!this.tripTitle().trim());
      setTimeout(() => this.showTitleWarning.set(false), 3000);
      this.toast.warning(validationMessage);
      return;
    }

    if (!this.dataService.isAuthenticated()) {
      this.persistDraft();
      this.dataService.requestAuthForAction({
        type: 'planner-ai',
      });
      return;
    }

    this.saving.set(true);
    this.itineraryApi
      .generateItinerary({
        title: this.tripTitle().trim(),
        description: this.buildAiDescription(),
        cover_image: this.coverPreviewUrl() || null,
        itinerary_type: 'ai',
        destination_city: this.destinationCity().trim() || null,
        start_date: this.startDate() || null,
        end_date: this.endDate() || null,
        days: Math.max(this.tripDays(), 1),
        budget: this.estimatedBudget(),
        travel_mode: this.travelMode(),
        trip_style: this.tripStyle(),
        companion_type: this.companionType(),
        energy_level: this.energyLevel(),
        preferences: this.getPreferenceTags(),
      })
      .pipe(
        catchError(() => {
          this.saving.set(false);
          this.toast.error('Tạo lịch trình AI thất bại');
          return of(null);
        }),
      )
      .subscribe((result) => {
        this.saving.set(false);
        if (!result) {
          return;
        }

        this.clearDraft();
        this.persistPlannerSeed(result.id);
        this.toast.success('Đã tạo lịch trình AI');
        this.router.navigate(['/planner', result.id, 'edit']);
      });
  }

  private validateTripForm(): string | null {
    if (!this.tripTitle().trim()) {
      return 'Vui lòng nhập tên lịch trình';
    }

    if (!this.startDate() || !this.endDate()) {
      return 'Vui lòng chọn ngày bắt đầu và ngày kết thúc';
    }

    if (this.tripDays() <= 0) {
      return 'Ngày kết thúc phải sau hoặc trùng ngày bắt đầu';
    }

    if (!this.destinationCity().trim()) {
      return 'Vui lòng nhập địa điểm muốn tới';
    }

    if (!Number.isFinite(this.peopleCount()) || this.peopleCount() < 1) {
      return 'Số người phải lớn hơn hoặc bằng 1';
    }

    if (this.estimatedBudget() !== null && (this.estimatedBudget() as number) < 0) {
      return 'Chi phí ước tính không được âm';
    }

    return null;
  }

  private getPreferenceTags(): string[] {
    return this.preferencesInput()
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private buildAiDescription(): string {
    const tripDays = Math.max(this.tripDays(), 1);
    const budget = this.estimatedBudget();
    const budgetLabel = budget ? `${budget.toLocaleString('vi-VN')} VND` : 'khong gioi han ro rang';
    const preferences = this.getPreferenceTags();

    const sections = [
      this.tripDescription().trim(),
      `Thong tin chuyen di: ${tripDays} ngay, ${this.peopleCount()} nguoi, dia diem uu tien ${this.destinationCity().trim() || 'linh hoat'}.`,
      `Ngan sach tong du kien cho ca nhom va toan chuyen di: ${budgetLabel}. Hay lap lich trinh va uoc tinh chi phi hop ly voi quy mo nhom nay, khong tao ke hoach qua re so voi ngan sach neu nguoi dung da nhap ngan sach cao.`,
      `Phuong tien di chuyen: ${this.travelModeLabel()}. Kieu chuyen di: ${this.tripStyleLabel()}. Nhip do: ${this.energyLevelLabel()}. Dong hanh: ${this.companionTypeLabel()}.`,
      this.desiredPlaces().trim() ? `Dia diem muon toi hoac muon ghe: ${this.desiredPlaces().trim()}.` : '',
      preferences.length ? `So thich uu tien: ${preferences.join(', ')}.` : '',
      'Yeu cau chi phi: moi ngay va moi diem dung nen co chi phi du kien thuc te; tong cac diem dung can gan voi ngan sach tong the, tranh truong hop ngan sach rat cao nhung tong lich trinh chi vai tram nghin hoac vai trieu.',
      this.extraNotes().trim() ? `Yeu cau them: ${this.extraNotes().trim()}.` : '',
    ].filter(Boolean);

    return sections.join('\n');
  }

  private travelModeLabel(): string {
    switch (this.travelMode()) {
      case 'motorbike':
        return 'xe may';
      case 'walking':
        return 'di bo';
      case 'mixed':
        return 'linh hoat';
      default:
        return 'o to';
    }
  }

  private tripStyleLabel(): string {
    switch (this.tripStyle()) {
      case 'relaxed':
        return 'nhe nhang';
      case 'packed':
        return 'di nhieu';
      default:
        return 'can bang';
    }
  }

  private energyLevelLabel(): string {
    switch (this.energyLevel()) {
      case 'low':
        return 'thu thai';
      case 'high':
        return 'nang dong';
      default:
        return 'linh hoat';
    }
  }

  private companionTypeLabel(): string {
    switch (this.companionType()) {
      case 'friends':
        return 'ban be';
      case 'family':
        return 'gia dinh';
      case 'solo':
        return 'mot minh';
      default:
        return 'cap doi';
    }
  }

  private persistPlannerSeed(itineraryId: number) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(
      `planner-seed-${itineraryId}`,
      JSON.stringify({
        description: this.tripDescription().trim(),
        coverImage: this.coverPreviewUrl() || '',
        budget: this.estimatedBudget(),
      }),
    );
  }

  private persistDraft() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(
      this.plannerDraftStorageKey,
      JSON.stringify({
        tripTitle: this.tripTitle(),
        tripDescription: this.tripDescription(),
        coverPreviewUrl: this.coverPreviewUrl(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        peopleCount: this.peopleCount(),
        estimatedBudget: this.estimatedBudget(),
        destinationCity: this.destinationCity(),
        desiredPlaces: this.desiredPlaces(),
        travelMode: this.travelMode(),
        tripStyle: this.tripStyle(),
        energyLevel: this.energyLevel(),
        companionType: this.companionType(),
        preferencesInput: this.preferencesInput(),
        extraNotes: this.extraNotes(),
      }),
    );
  }

  private restoreDraft() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const rawValue = localStorage.getItem(this.plannerDraftStorageKey);
    if (!rawValue) {
      return;
    }

    try {
      const draft = JSON.parse(rawValue) as {
        tripTitle?: string;
        tripDescription?: string;
        coverPreviewUrl?: string;
        startDate?: string;
        endDate?: string;
        peopleCount?: number;
        estimatedBudget?: number | null;
        destinationCity?: string;
        desiredPlaces?: string;
        travelMode?: string;
        tripStyle?: string;
        energyLevel?: string;
        companionType?: string;
        preferencesInput?: string;
        extraNotes?: string;
      };

      this.tripTitle.set(draft.tripTitle ?? '');
      this.tripDescription.set(draft.tripDescription ?? '');
      this.coverPreviewUrl.set(draft.coverPreviewUrl ?? '');
      this.startDate.set(draft.startDate ?? '');
      this.endDate.set(draft.endDate ?? '');
      this.peopleCount.set(draft.peopleCount ?? 2);
      this.estimatedBudget.set(draft.estimatedBudget ?? null);
      this.destinationCity.set(draft.destinationCity ?? '');
      this.desiredPlaces.set(draft.desiredPlaces ?? '');
      this.travelMode.set(draft.travelMode ?? 'car');
      this.tripStyle.set(draft.tripStyle ?? 'balanced');
      this.energyLevel.set(draft.energyLevel ?? 'balanced');
      this.companionType.set(draft.companionType ?? 'couple');
      this.preferencesInput.set(draft.preferencesInput ?? 'cafe, ăn uống, chill');
      this.extraNotes.set(draft.extraNotes ?? '');
    } catch {
      this.clearDraft();
    }
  }

  private clearDraft() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.plannerDraftStorageKey);
  }
}
