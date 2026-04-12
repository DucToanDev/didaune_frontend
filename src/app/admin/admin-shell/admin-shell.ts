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
    { label: 'Tong quan', icon: 'fa-gauge', route: '/admin' },
    { label: 'Dia diem', icon: 'fa-location-dot', route: '/admin/locations' },
    {
      label: 'Dong gop dia diem',
      icon: 'fa-square-plus',
      route: '/admin/location-submissions',
    },
    { label: 'Lich trinh', icon: 'fa-route', route: '/admin/itineraries' },
    { label: 'Nguoi dung', icon: 'fa-users', route: '/admin/users' },
    { label: 'Settings', icon: 'fa-gear', route: '/admin/settings' },
  ];

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update((v) => !v);
  }
}
