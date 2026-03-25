import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  AdminDataService,
  AdminImportBatch,
  AdminKpi,
  AdminLocationRow,
  AdminPartnerRow,
  AdminReportRow,
} from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
})
export class DashboardAdmin {
  private adminData = inject(AdminDataService);

  kpis = signal<AdminKpi[]>([]);
  locations = signal<AdminLocationRow[]>([]);
  partners = signal<AdminPartnerRow[]>([]);
  imports = signal<AdminImportBatch[]>([]);
  reports = signal<AdminReportRow[]>([]);

  constructor() {
    this.adminData.kpis$.subscribe((kpis) => this.kpis.set(kpis));
    this.adminData.getAdminLocations().subscribe((locations) => this.locations.set(locations.slice(0, 5)));
    this.adminData.getPartnerRequests().subscribe((partners) => this.partners.set(partners.slice(0, 4)));
    this.adminData.getImportBatches().subscribe((imports) => this.imports.set(imports));
    this.adminData.getReports().subscribe((reports) => this.reports.set(reports));
  }
}
