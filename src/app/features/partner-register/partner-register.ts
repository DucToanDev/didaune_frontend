import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import {
  LocationApiService,
  OwnerLocationSubmissionPayload,
} from '../../core/services/location-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SeoService } from '../../core/services/seo.service';

type CategoryId = OwnerLocationSubmissionPayload['category'];

@Component({
  selector: 'app-partner-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './partner-register.html',
  styleUrl: './partner-register.css',
})
export class PartnerRegister {
  private readonly allowedImageTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/jpg',
  ]);
  private readonly maxImageSize = 5 * 1024 * 1024;
  private readonly maxGalleryImages = 12;
  private fb = inject(FormBuilder);
  private api = inject(LocationApiService);
  private route = inject(ActivatedRoute);
  private dataService = inject(DataService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);

  submitting = signal(false);
  submitted = signal(false);
  submissionId = signal<string | null>(null);
  mainImageFile = signal<File | null>(null);
  galleryImageFiles = signal<File[]>([]);

  categories: Array<{ id: CategoryId; label: string; icon: string }> = [
    { id: 'cafe', label: 'Cafe', icon: 'fa-mug-hot' },
    { id: 'hotel', label: 'Hotel', icon: 'fa-bed' },
    { id: 'homestay', label: 'Homestay', icon: 'fa-house' },
    { id: 'restaurant', label: 'Nhà hàng', icon: 'fa-utensils' },
    { id: 'travel', label: 'Du lịch', icon: 'fa-map-location-dot' },
  ];

  form = this.fb.nonNullable.group({
    contact_name: ['', [Validators.required, Validators.maxLength(255)]],
    contact_phone: ['', [Validators.required, Validators.maxLength(30)]],
    contact_email: ['', [Validators.email, Validators.maxLength(255)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['cafe' as CategoryId, [Validators.required]],
    city: ['', [Validators.maxLength(255)]],
    district: ['', [Validators.maxLength(255)]],
    ward: ['', [Validators.maxLength(255)]],
    address: ['', [Validators.maxLength(1000)]],
    description: ['', [Validators.maxLength(5000)]],
    price_range: ['', [Validators.maxLength(120)]],
    website: ['', [Validators.maxLength(2000)]],
    google_maps_link: ['', [Validators.maxLength(2000)]],
    amenities_text: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    this.seo.setPage({
      title: 'Dong gop dia diem',
      description: 'Gui thong tin dia diem de duoc duyet.',
      path: '/partner/register',
      noindex: true,
    });

    const initialName = this.route.snapshot.queryParamMap.get('name') ?? '';
    const initialCategory =
      this.route.snapshot.queryParamMap.get('category') ?? 'cafe';
    const currentUser = this.dataService.currentUser();

    this.form.patchValue({
      contact_name:
        currentUser.full_name?.trim() || currentUser.name?.trim() || '',
      contact_phone: currentUser.phone?.trim() || '',
      contact_email: currentUser.email?.trim() || '',
      name: initialName,
      category: this.normalizeCategory(initialCategory),
    });
  }

  onMainImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.mainImageFile.set(null);
      return;
    }

    const validationMessage = this.validateImageFile(file);

    if (validationMessage) {
      input.value = '';
      this.mainImageFile.set(null);
      this.toast.warning(validationMessage);
      return;
    }

    this.mainImageFile.set(file);
  }

  onGalleryImagesChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      this.galleryImageFiles.set([]);
      return;
    }

    if (files.length > this.maxGalleryImages) {
      input.value = '';
      this.galleryImageFiles.set([]);
      this.toast.warning(
        `Chỉ được tải tối đa ${this.maxGalleryImages} ảnh thumbnail.`,
      );
      return;
    }

    const invalidFile = files.find((file) => this.validateImageFile(file));

    if (invalidFile) {
      input.value = '';
      this.galleryImageFiles.set([]);
      this.toast.warning(
        this.validateImageFile(invalidFile) ?? 'Ảnh không hợp lệ.',
      );
      return;
    }

    this.galleryImageFiles.set(files);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      this.showValidationToast();
      return;
    }

    if (this.mainImageFile()) {
      const message = this.validateImageFile(this.mainImageFile()!);

      if (message) {
        this.toast.warning(message);
        return;
      }
    }

    if (this.galleryImageFiles().length > this.maxGalleryImages) {
      this.toast.warning(
        `Chỉ được tải tối đa ${this.maxGalleryImages} ảnh thumbnail.`,
      );
      return;
    }

    const invalidGalleryImage = this.galleryImageFiles().find((file) =>
      this.validateImageFile(file),
    );

    if (invalidGalleryImage) {
      this.toast.warning(
        this.validateImageFile(invalidGalleryImage) ??
          'Ảnh thumbnail không hợp lệ.',
      );
      return;
    }

    this.submitting.set(true);

    const value = this.form.getRawValue();
    const website = this.normalizeOptionalUrl(value.website);
    const googleMapsLink = this.normalizeOptionalUrl(value.google_maps_link);
    const payload: OwnerLocationSubmissionPayload = {
      contact_name: value.contact_name.trim(),
      contact_phone: value.contact_phone.trim(),
      contact_email: value.contact_email.trim() || null,
      name: value.name.trim(),
      category: value.category,
      city: value.city.trim() || null,
      district: null,
      ward: value.ward.trim() || null,
      address: value.address.trim() || null,
      description: value.description.trim() || null,
      price_range: value.price_range.trim() || null,
      website,
      google_maps_link: googleMapsLink,
      main_image: this.mainImageFile(),
      gallery_images: this.galleryImageFiles(),
      amenities: value.amenities_text
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    };

    this.api.submitOwnerLocation(payload).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.submissionId.set(response.data?.id ?? null);
        this.toast.success('Đã gửi đóng góp địa điểm.');
      },
      error: (error) => {
        this.submitting.set(false);
        this.toast.error(this.resolveSubmitError(error));
      },
    });
  }

  private showValidationToast(): void {
    if (this.form.controls.contact_name.invalid) {
      this.toast.warning('Vui lòng nhập tên người đóng góp.');
      return;
    }

    if (this.form.controls.contact_phone.invalid) {
      this.toast.warning('Vui lòng nhập số điện thoại hợp lệ.');
      return;
    }

    if (this.form.controls.contact_email.invalid) {
      this.toast.warning('Email không đúng định dạng.');
      return;
    }

    if (this.form.controls.name.invalid) {
      this.toast.warning('Vui lòng nhập tên địa điểm.');
      return;
    }

    if (this.form.controls.category.invalid) {
      this.toast.warning('Vui lòng chọn danh mục.');
      return;
    }

    if (this.form.controls.website.invalid) {
      this.toast.warning('Website quá dài.');
      return;
    }

    if (this.form.controls.google_maps_link.invalid) {
      this.toast.warning('Link Google Maps quá dài.');
      return;
    }

    if (this.mainImageFile()) {
      const message = this.validateImageFile(this.mainImageFile()!);

      if (message) {
        this.toast.warning(message);
        return;
      }
    }

    if (this.galleryImageFiles().length > this.maxGalleryImages) {
      this.toast.warning(
        `Chỉ được tải tối đa ${this.maxGalleryImages} ảnh thumbnail.`,
      );
      return;
    }

    this.toast.warning('Vui lòng kiểm tra lại thông tin.');
  }

  private validateImageFile(file: File): string | null {
    if (!this.allowedImageTypes.has(file.type)) {
      return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.';
    }

    if (file.size > this.maxImageSize) {
      return 'Mỗi ảnh chỉ được tối đa 5MB.';
    }

    return null;
  }

  private resolveSubmitError(error: any): string {
    const backendErrors = error?.error?.errors;

    if (backendErrors && typeof backendErrors === 'object') {
      const firstError = Object.values(backendErrors)
        .flat()
        .find((message): message is string => typeof message === 'string');

      if (firstError) {
        return this.translateBackendError(firstError);
      }
    }

    return this.translateBackendError(
      error?.error?.message ?? 'Không gửi được. Vui lòng thử lại.',
    );
  }

  private normalizeCategory(input: string): CategoryId {
    if (
      input === 'hotel' ||
      input === 'homestay' ||
      input === 'restaurant' ||
      input === 'travel'
    ) {
      return input;
    }

    return 'cafe';
  }

  private normalizeOptionalUrl(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  private translateBackendError(message: string): string {
    const normalized = message.trim();

    const translations: Record<string, string> = {
      'The given data was invalid.': 'Dữ liệu không hợp lệ.',
      'The website must be a valid URL.':
        'Website phải là một đường dẫn hợp lệ.',
      'The google maps link must be a valid URL.':
        'Link Google Maps phải là một đường dẫn hợp lệ.',
    };

    return translations[normalized] ?? normalized;
  }
}
