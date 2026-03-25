import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminDataService, AdminLocationRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './locations.html',
})
export class LocationsAdmin {
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  rows = signal<AdminLocationRow[]>([]);
  query = signal('');
  status = signal<'all' | 'published' | 'needs_review' | 'draft'>('all');

  filteredRows = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.rows().filter((row) => {
      const matchStatus = this.status() === 'all' || row.status === this.status();
      const searchText = [
        row.place.name,
        row.place.area_name,
        row.place.district_name,
        row.place.description,
      ]
        .join(' ')
        .toLowerCase();
      const matchQuery = !query || searchText.includes(query);

      return matchStatus && matchQuery;
    });
  });

  constructor() {
    this.adminData.getAdminLocations().subscribe((rows) => this.rows.set(rows));
  }

  setStatus(slug: string, status: AdminLocationRow['status']) {
    this.adminData.updateLocationStatus(slug, status);
  }
}
