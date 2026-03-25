import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDataService, AdminReportRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports-admin.html',
})
export class ReportsAdmin {
  private adminData = inject(AdminDataService);

  rows = signal<AdminReportRow[]>([]);

  constructor() {
    this.adminData.getReports().subscribe((rows) => this.rows.set(rows));
  }
}
