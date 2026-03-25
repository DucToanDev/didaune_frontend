import { Component, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminAuthService, AdminCapability } from '../../../core/services/admin/admin-auth.service';

@Component({
  selector: 'app-admin-shell-nav',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  templateUrl: './shell-nav.html',
})
export class ShellNav {
  adminAuth = inject(AdminAuthService);

  sections = [
    {
      title: 'Control',
      items: [
        { label: 'Tổng quan', icon: 'fa-chart-pie', link: '/admin', capability: 'dashboard.view' as AdminCapability },
        { label: 'Địa điểm', icon: 'fa-store', link: '/admin/locations', capability: 'locations.manage' as AdminCapability },
        { label: 'Đánh giá', icon: 'fa-star-half-stroke', link: '/admin/reviews', capability: 'reviews.manage' as AdminCapability },
        { label: 'Người dùng', icon: 'fa-users', link: '/admin/users', capability: 'users.manage' as AdminCapability },
      ],
    },
    {
      title: 'Operations',
      items: [
        { label: 'Đối tác', icon: 'fa-handshake', link: '/admin/partners', capability: 'partners.manage' as AdminCapability },
        { label: 'Nhập liệu', icon: 'fa-file-import', link: '/admin/imports', capability: 'imports.manage' as AdminCapability },
        { label: 'Phân loại', icon: 'fa-tags', link: '/admin/taxonomy', capability: 'taxonomy.manage' as AdminCapability },
        { label: 'Bộ sưu tập', icon: 'fa-layer-group', link: '/admin/collections', capability: 'collections.manage' as AdminCapability },
        { label: 'Báo cáo', icon: 'fa-triangle-exclamation', link: '/admin/reports', capability: 'reports.view' as AdminCapability },
      ],
    },
  ];
}
