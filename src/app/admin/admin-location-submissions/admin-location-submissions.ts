import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { BACKEND_API_CONFIG } from '../../core/config/backend-api.config';
import {
  AdminLocationSubmission,
  LocationSubmissionApiService,
} from '../../core/services/location-submission-api.service';
import { PaginationMeta } from '../../core/models/app.models';
import { ToastService } from '../../core/services/toast.service';
import { AdminHeader } from '../shared/admin-header/admin-header';
import { DetailPanel } from '../shared/detail-panel/detail-panel';

@Component({
  selector: 'app-admin-location-submissions',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeader, DetailPanel],
  templateUrl: './admin-location-submissions.html',
  styleUrl: './admin-location-submissions.css',
})
export class AdminLocationSubmissions implements OnInit {
  private api = inject(LocationSubmissionApiService);
  private toast = inject(ToastService);
  private readonly backendOrigin = BACKEND_API_CONFIG.baseUrl.replace(/\/api$/, '');

  loading = signal(false);
  saving = signal(false);
  submissions = signal<AdminLocationSubmission[]>([]);
  selectedSubmission = signal<AdminLocationSubmission | null>(null);
  search = signal('');
  statusFilter = signal('');
  categoryFilter = signal('');
  adminNote = signal('');
  pagination = signal<PaginationMeta>({
    current_page: 1,
    per_page: 12,
    total: 0,
    last_page: 1,
    from: null,
    to: null,
  });

  readonly pendingCount = computed(
    () => this.submissions().filter((item) => item.status === 'pending').length,
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(page = 1): void {
    this.loading.set(true);
    this.api
      .fetchSubmissionsPaginated({
        search: this.search(),
        status: this.statusFilter(),
        category: this.categoryFilter(),
        page,
        perPage: 12,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.submissions.set(result.data);
        this.pagination.set(result.meta);
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().last_page) return;
    this.loadData(page);
  }

  openDetail(submission: AdminLocationSubmission): void {
    this.selectedSubmission.set(submission);
    this.adminNote.set(submission.admin_note ?? '');
  }

  closeDetail(): void {
    this.selectedSubmission.set(null);
    this.adminNote.set('');
  }

  updateStatus(status: 'approved' | 'rejected' | 'pending'): void {
    const submission = this.selectedSubmission();
    if (!submission) return;

    this.saving.set(true);
    this.api
      .updateSubmission(submission.id, {
        status,
        admin_note: this.adminNote().trim() || null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.submissions.update((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.selectedSubmission.set(updated);
          this.toast.success(this.buildStatusMessage(status));
        },
        error: (error) => {
          this.toast.error(
            error?.error?.message ?? 'Không cập nhật được trạng thái đóng góp.',
          );
        },
      });
  }

  statusLabel(status: string): string {
    if (status === 'approved') return 'Đã duyệt';
    if (status === 'rejected') return 'Đã từ chối';
    return 'Chờ duyệt';
  }

  categoryLabel(category: string): string {
    const map: Record<string, string> = {
      cafe: 'Cafe',
      hotel: 'Hotel',
      homestay: 'Homestay',
      restaurant: 'Nhà hàng',
      travel: 'Du lịch',
    };

    return map[category] ?? category;
  }

  galleryImages(submission: AdminLocationSubmission | null): string[] {
    return (submission?.gallery_images_json ?? []).map((image) =>
      this.resolveImageUrl(image),
    );
  }

  imageUrl(path: string | null | undefined): string {
    return this.resolveImageUrl(path);
  }

  private resolveImageUrl(path: string | null | undefined): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.backendOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildStatusMessage(status: 'approved' | 'rejected' | 'pending'): string {
    if (status === 'approved') {
      return 'Đã duyệt đóng góp địa điểm.';
    }

    if (status === 'rejected') {
      return 'Đã từ chối đóng góp địa điểm.';
    }

    return 'Đã chuyển đóng góp về chờ duyệt.';
  }
}
