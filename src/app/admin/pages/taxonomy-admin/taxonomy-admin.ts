import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDataService, AdminTaxonomyRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-taxonomy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './taxonomy-admin.html',
})
export class TaxonomyAdmin {
  private adminData = inject(AdminDataService);

  rows = signal<AdminTaxonomyRow[]>([]);

  constructor() {
    this.adminData.getTaxonomyRows().subscribe((rows) => this.rows.set(rows));
  }
}
