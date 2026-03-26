import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LocationApiService,
  OwnerLocationSubmissionPayload,
} from '../../core/services/location-api.service';

type CategoryId = OwnerLocationSubmissionPayload['category'];

@Component({
  selector: 'app-partner-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './partner-register.html',
  styleUrl: './partner-register.css',
})
export class PartnerRegister {
  private fb = inject(FormBuilder);
  private api = inject(LocationApiService);
  private route = inject(ActivatedRoute);

  submitting = signal(false);
  submitted = signal(false);
  submitError = signal<string | null>(null);
  submissionId = signal<string | null>(null);

  categories: Array<{ id: CategoryId; label: string; icon: string }> = [
    { id: 'cafe', label: 'Cafe', icon: 'fa-mug-hot' },
    { id: 'hotel', label: 'Hotel', icon: 'fa-bed' },
    { id: 'homestay', label: 'Homestay', icon: 'fa-house' },
    { id: 'restaurant', label: 'Nha hang', icon: 'fa-utensils' },
    { id: 'travel', label: 'Du lich', icon: 'fa-map-location-dot' },
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
    const initialName = this.route.snapshot.queryParamMap.get('name') ?? '';
    const initialCategory = this.route.snapshot.queryParamMap.get('category') ?? 'cafe';

    this.form.patchValue({
      name: initialName,
      category: this.normalizeCategory(initialCategory),
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    const value = this.form.getRawValue();
    const payload: OwnerLocationSubmissionPayload = {
      contact_name: value.contact_name.trim(),
      contact_phone: value.contact_phone.trim(),
      contact_email: value.contact_email.trim() || null,
      name: value.name.trim(),
      category: value.category,
      city: value.city.trim() || null,
      district: value.district.trim() || null,
      ward: value.ward.trim() || null,
      address: value.address.trim() || null,
      description: value.description.trim() || null,
      price_range: value.price_range.trim() || null,
      website: value.website.trim() || null,
      google_maps_link: value.google_maps_link.trim() || null,
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
      },
      error: (error) => {
        this.submitting.set(false);
        this.submitError.set(error?.error?.message ?? 'Khong gui duoc. Vui long thu lai.');
      },
    });
  }

  private normalizeCategory(input: string): CategoryId {
    if (input === 'hotel' || input === 'homestay' || input === 'restaurant' || input === 'travel') {
      return input;
    }

    return 'cafe';
  }
}

