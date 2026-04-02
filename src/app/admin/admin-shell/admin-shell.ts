import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  sidebarOpen = signal(true);
  mobileSidebarOpen = signal(false);

  readonly menus = [
    { label: 'Tổng quan', icon: 'fa-solid fa-gauge', route: '/admin' },
    { label: 'Địa điểm', icon: 'fa-location-dot', route: '/admin/locations' },
    {
      label: 'Đóng góp địa điểm',
      icon: 'fa-square-plus',
      route: '/admin/location-submissions',
    },
    { label: 'Lịch trình', icon: 'fa-route', route: '/admin/itineraries' },
    { label: 'Người dùng', icon: 'fa-users', route: '/admin/users' },
  ];

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update((v) => !v);
  }
}
