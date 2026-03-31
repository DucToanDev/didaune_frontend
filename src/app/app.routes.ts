import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { Discover } from './features/discover/discover';
import { Detail } from './features/detail/detail';
import { Favorite } from './features/favorite/favorite';
import { Home } from './features/home/home';
import { MapPage } from './features/map-page/map-page';
import { Planner } from './features/planner/planner';
import { PlannerList } from './features/planner-list/planner-list';
import { PartnerRegister } from './features/partner-register/partner-register';
import { Profile } from './features/profile/profile';
import { Reviews } from './features/reviews/reviews';
import { DataService } from './core/services/data.service';
import { UserShell } from './layout/user-shell';

const requireAuth = () => {
  const dataService = inject(DataService);
  const router = inject(Router);

  if (dataService.isAuthenticated()) {
    return true;
  }

  dataService.requestAuthModal('login');
  return router.createUrlTree(['/']);
};

const requireAdmin = () => {
  const dataService = inject(DataService);
  const router = inject(Router);

  if (!dataService.isAuthenticated()) {
    dataService.setPostLoginRedirect('/admin');
    dataService.requestAuthModal('login');
    return router.createUrlTree(['/']);
  }

  if (dataService.hasAdminRole()) {
    return true;
  }

  return router.createUrlTree(['/']);
};

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.adminRoutes),
    canActivate: [requireAdmin],
  },
  {
    path: '',
    component: UserShell,
    children: [
      { path: '', component: Home, title: 'Trang chu' },
      { path: 'discover', component: Discover, title: 'Kham pha dia diem' },
      { path: 'list', redirectTo: 'discover' },
      { path: 'map', component: MapPage, title: 'Ban do dia diem' },
      { path: 'planner', component: PlannerList, title: 'Lich trinh cua ban' },
      { path: 'planner/new', component: Planner, title: 'Tao lich trinh' },
      { path: 'planner/edit', redirectTo: 'planner' },
      { path: 'planner/:id/edit', component: Planner, title: 'Chinh sua chuyen di' },
      { path: 'partner/register', component: PartnerRegister, title: 'Dang ky doi tac' },
      { path: 'favorite', component: Favorite, title: 'Yeu thich', canActivate: [requireAuth] },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiet' },
      { path: 'profile', component: Profile, title: 'Ho so', canActivate: [requireAuth] },
      { path: 'reviews/:slug', component: Reviews, title: 'Danh gia' },
    ],
  },
  { path: '**', redirectTo: '' },
];
