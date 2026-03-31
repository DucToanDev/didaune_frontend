import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import { Vietnamese } from 'flatpickr/dist/l10n/vn';

@Component({
  selector: 'app-planner-trip-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './planner-trip-form.html',
  styles: [`
    :host {
      display: block;
    }

    .custom-shadow {
      box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
    }
    .ai-label {
      display: block;
      margin-bottom: 5px;
      font-family: 'Inter', sans-serif;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #64748b;
    }
  `],
})
export class PlannerTripForm implements AfterViewInit, OnDestroy {
  @ViewChild('dateRangeInput') private dateRangeInput?: ElementRef<HTMLInputElement>;

  heading = input('Thông tin chuyến đi');
  descriptionHint = input(
    'Nhập thông tin cơ bản trước, sau đó bạn có thể bổ sung thêm quán và lịch trình chi tiết.',
  );
  title = input('');
  description = input('');
  coverPreviewUrl = input('');
  startDate = input('');
  endDate = input('');
  showTitleWarning = input(false);

  titleChange = output<string>();
  descriptionChange = output<string>();
  coverChange = output<string>();
  startDateChange = output<string>();
  endDateChange = output<string>();

  private datePicker: FlatpickrInstance | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  constructor() {
    effect(() => {
      const datePicker = this.datePicker;
      if (!datePicker) {
        return;
      }

      const nextRange = [this.startDate(), this.endDate()].filter(Boolean);
      const currentRange = datePicker.selectedDates.map((value) => this.toIsoDate(value));

      if (nextRange.join('|') !== currentRange.join('|')) {
        datePicker.setDate(nextRange, false, 'Y-m-d');
      }
    });
  }

  ngAfterViewInit() {
    const input = this.dateRangeInput?.nativeElement;
    if (!input) {
      return;
    }

    this.datePicker = flatpickr(input, {
      mode: 'range',
      locale: Vietnamese,
      dateFormat: 'Y-m-d',
      defaultDate: [this.startDate(), this.endDate()].filter(Boolean),
      disableMobile: true,
      monthSelectorType: 'static',
      nextArrow: '<i class="fa-solid fa-chevron-right"></i>',
      prevArrow: '<i class="fa-solid fa-chevron-left"></i>',
      onChange: (selectedDates) => {
        const [start, end] = selectedDates;
        this.startDateChange.emit(start ? this.toIsoDate(start) : '');
        this.endDateChange.emit(end ? this.toIsoDate(end) : '');
      },
    });
  }

  ngOnDestroy() {
    this.datePicker?.destroy();
  }

  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.coverChange.emit(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
  }

  openDatePicker() {
    this.datePicker?.open();
  }

  tripDays(): number {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) {
      return 0;
    }

    const diff = new Date(end).getTime() - new Date(start).getTime();
    return diff >= 0 ? Math.ceil(diff / 86_400_000) + 1 : 0;
  }

  dateRangeLabel(): string {
    const start = this.startDate();
    const end = this.endDate();

    if (!start && !end) {
      return 'Chọn khoảng ngày cho chuyến đi';
    }

    if (start && !end) {
      return this.formatDisplayDate(start);
    }

    return `${this.formatDisplayDate(start)} - ${this.formatDisplayDate(end)}`;
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDisplayDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : this.dateFormatter.format(date);
  }
}
