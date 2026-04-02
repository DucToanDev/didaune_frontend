import { Routes } from '@angular/router';
import { AdminShell } from './admin-shell/admin-shell';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminShell,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin-home/admin-home').then((m) => m.AdminHome),
        title: 'Tổng quan — Admin',
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./admin-locations/admin-locations').then((m) => m.AdminLocations),
        title: 'Quản lý địa điểm — Admin',
      },
      {
        path: 'location-submissions',
        loadComponent: () =>
          import('./admin-location-submissions/admin-location-submissions').then(
            (m) => m.AdminLocationSubmissions,
          ),
        title: 'Đóng góp địa điểm — Admin',
      },
      {
        path: 'itineraries',
        loadComponent: () =>
          import('./admin-itineraries/admin-itineraries').then((m) => m.AdminItineraries),
        title: 'Lịch trình AI — Admin',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin-users/admin-users').then((m) => m.AdminUsers),
        title: 'Quản lý người dùng — Admin',
      },
    ],
  },
];
