import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminDataService, AdminPartnerRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-partners',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './partners-admin.html',
})
export class PartnersAdmin {
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  rows = signal<AdminPartnerRow[]>([]);

  constructor() {
    this.adminData.getPartnerRequests().subscribe((rows) => this.rows.set(rows));
  }

  setStatus(id: string, status: AdminPartnerRow['status']) {
    this.adminData.updatePartnerStatus(id, status);
  }
}
