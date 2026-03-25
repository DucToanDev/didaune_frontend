import { Routes } from '@angular/router';
import { AdminShell } from './admin/layout/admin-shell';
import { CollectionsAdmin } from './admin/pages/collections-admin/collections-admin';
import { DashboardAdmin } from './admin/pages/dashboard/dashboard';
import { AdminForbidden } from './admin/pages/forbidden/forbidden';
import { ImportsAdmin } from './admin/pages/imports-admin/imports-admin';
import { AdminLogin } from './admin/pages/login/login';
import { LocationEditorAdmin } from './admin/pages/location-editor/location-editor';
import { LocationsAdmin } from './admin/pages/locations/locations';
import { PartnersAdmin } from './admin/pages/partners-admin/partners-admin';
import { ReportsAdmin } from './admin/pages/reports-admin/reports-admin';
import { ReviewsAdmin } from './admin/pages/reviews-admin/reviews-admin';
import { TaxonomyAdmin } from './admin/pages/taxonomy-admin/taxonomy-admin';
import { UsersAdmin } from './admin/pages/users-admin/users-admin';
import { Discover } from './features/discover/discover';
import { Detail } from './features/detail/detail';
import { Favorite } from './features/favorite/favorite';
import { Home } from './features/home/home';
import { List } from './features/list/list';
import { MapPage } from './features/map-page/map-page';
import { Planner } from './features/planner/planner';
import { Profile } from './features/profile/profile';
import { Reviews } from './features/reviews/reviews';
import { adminAuthGuard, adminGuestGuard, adminRoleGuard } from './core/guards/admin-auth.guard';
import { UserShell } from './layout/user-shell';

export const routes: Routes = [
  {
    path: 'admin/login',
    component: AdminLogin,
    canActivate: [adminGuestGuard],
    title: 'Admin Login',
  },
  {
    path: 'admin/forbidden',
    component: AdminForbidden,
    canActivate: [adminAuthGuard],
    title: 'Admin Forbidden',
  },
  {
    path: 'admin',
    component: AdminShell,
    canActivate: [adminAuthGuard],
    children: [
      { path: '', component: DashboardAdmin, title: 'Admin Dashboard' },
      {
        path: 'locations',
        component: LocationsAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Locations',
      },
      {
        path: 'locations/:slug',
        component: LocationEditorAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Location Editor',
      },
      {
        path: 'reviews',
        component: ReviewsAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['moderator', 'content_admin', 'super_admin'] },
        title: 'Admin Reviews',
      },
      {
        path: 'users',
        component: UsersAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['super_admin'] },
        title: 'Admin Users',
      },
      {
        path: 'partners',
        component: PartnersAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Partners',
      },
      {
        path: 'imports',
        component: ImportsAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['super_admin'] },
        title: 'Admin Imports',
      },
      {
        path: 'taxonomy',
        component: TaxonomyAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Taxonomy',
      },
      {
        path: 'collections',
        component: CollectionsAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Collections',
      },
      {
        path: 'reports',
        component: ReportsAdmin,
        canActivate: [adminRoleGuard],
        data: { roles: ['content_admin', 'super_admin'] },
        title: 'Admin Reports',
      },
    ],
  },
  {
    path: '',
    component: UserShell,
    children: [
      { path: '', component: Home, title: 'Trang chu' },
      { path: 'discover', component: Discover, title: 'Kham pha dia diem' },
      { path: 'list', component: List, title: 'Ket qua tim kiem' },
      { path: 'map', component: MapPage, title: 'Ban do dia diem' },
      { path: 'planner', component: Planner, title: 'Len lich trinh AI' },
      { path: 'favorite', component: Favorite, title: 'Yeu thich' },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiet' },
      { path: 'profile', component: Profile, title: 'Ho so' },
      { path: 'reviews/:slug', component: Reviews, title: 'Danh gia' },
    ],
  },
  { path: '**', redirectTo: '' },
];
