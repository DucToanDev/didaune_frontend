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
        title: 'Tong quan - Admin',
      },
      {
        path: 'locations',
        loadComponent: () =>
          import('./admin-locations/admin-locations').then((m) => m.AdminLocations),
        title: 'Quan ly dia diem - Admin',
      },
      {
        path: 'location-submissions',
        loadComponent: () =>
          import('./admin-location-submissions/admin-location-submissions').then(
            (m) => m.AdminLocationSubmissions,
          ),
        title: 'Dong gop dia diem - Admin',
      },
      {
        path: 'itineraries',
        loadComponent: () =>
          import('./admin-itineraries/admin-itineraries').then((m) => m.AdminItineraries),
        title: 'Lich trinh AI - Admin',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin-users/admin-users').then((m) => m.AdminUsers),
        title: 'Quan ly nguoi dung - Admin',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./admin-settings/admin-settings').then((m) => m.AdminSettings),
        title: 'Settings - Admin',
      },
    ],
  },
];
