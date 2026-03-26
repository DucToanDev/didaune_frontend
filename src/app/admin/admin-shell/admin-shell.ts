import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  readonly menus = [
    { label: 'Tong quan', icon: 'fa-th-large', route: '/admin' },
    { label: 'Dia diem', icon: 'fa-map-marker-alt', route: '/admin/locations' },
    { label: 'Doi tac', icon: 'fa-store', route: '/admin/partners' },
    { label: 'Lich trinh', icon: 'fa-route', route: '/admin/itineraries' },
    { label: 'AI Insights', icon: 'fa-magic', route: '/admin/insights' },
  ];
}
