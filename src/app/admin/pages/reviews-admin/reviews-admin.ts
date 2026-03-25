import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminDataService, AdminReviewRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews-admin.html',
})
export class ReviewsAdmin {
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  rows = signal<AdminReviewRow[]>([]);
  filter = signal<'all' | 'approved' | 'pending' | 'flagged'>('all');

  filteredRows = computed(() =>
    this.rows().filter((row) => this.filter() === 'all' || row.moderationStatus === this.filter())
  );

  constructor() {
    this.adminData.getAdminReviews().subscribe((rows) => this.rows.set(rows));
  }

  setModerationStatus(reviewId: string, status: AdminReviewRow['moderationStatus']) {
    this.adminData.updateReviewStatus(reviewId, status);
  }
}
