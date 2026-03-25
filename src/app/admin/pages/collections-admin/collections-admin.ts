import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminCollectionRow, AdminDataService } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-collections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collections-admin.html',
})
export class CollectionsAdmin {
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  rows = signal<AdminCollectionRow[]>([]);

  constructor() {
    this.adminData.getCollections().subscribe((rows) => this.rows.set(rows));
  }

  setStatus(id: string, status: AdminCollectionRow['status']) {
    this.adminData.updateCollectionStatus(id, status);
  }
}
