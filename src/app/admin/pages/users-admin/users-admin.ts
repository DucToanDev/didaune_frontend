import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminDataService, AdminUserRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users-admin.html',
})
export class UsersAdmin {
  private adminData = inject(AdminDataService);

  rows = signal<AdminUserRow[]>([]);

  constructor() {
    this.adminData.getAdminUsers().subscribe((rows) => this.rows.set(rows));
  }
}
