import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminDataService, AdminImportBatch } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-imports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './imports-admin.html',
})
export class ImportsAdmin {
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  batches = signal<AdminImportBatch[]>([]);

  constructor() {
    this.adminData.getImportBatches().subscribe((batches) => this.batches.set(batches));
  }

  setStatus(id: string, status: AdminImportBatch['status']) {
    this.adminData.updateImportStatus(id, status);
  }
}
