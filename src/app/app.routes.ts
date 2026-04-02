import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { Discover } from './features/discover/discover';
import { Detail } from './features/detail/detail';
import { Favorite } from './features/favorite/favorite';
import { Home } from './features/home/home';
import { MapPage } from './features/map-page/map-page';
import { Planner } from './features/planner/planner';
import { PlannerCreateAi } from './features/planner-create-ai/planner-create-ai';
import { PlannerList } from './features/planner-list/planner-list';
import { PartnerRegister } from './features/partner-register/partner-register';
import { Profile } from './features/profile/profile';
import { Reviews } from './features/reviews/reviews';
import { Contact } from './features/contact/contact';
import { Policy } from './features/policy/policy';
import { DataService } from './core/services/data.service';
import { UserShell } from './layout/user-shell';

const requireAuth = () => {
  const dataService = inject(DataService);
  const router = inject(Router);

  if (dataService.isAuthenticated()) {
    return true;
  }

  dataService.requestProtectedAuthModal('login');
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
      { path: '', component: Home, title: 'Trang chá»§' },
      { path: 'discover', component: Discover, title: 'KhÃ¡m phÃ¡ Ä‘á»‹a Ä‘iá»ƒm' },
      { path: 'list', redirectTo: 'discover' },
      { path: 'map', component: MapPage, title: 'Báº£n Ä‘á»“ Ä‘á»‹a Ä‘iá»ƒm' },
      { path: 'planner', component: PlannerList, title: 'Lá»‹ch trÃ¬nh cá»§a báº¡n' },
      { path: 'planner/new', redirectTo: 'planner/new/manual', pathMatch: 'full' },
      { path: 'planner/new/ai', component: PlannerCreateAi, title: 'Táº¡o lá»‹ch trÃ¬nh báº±ng AI' },
      { path: 'planner/new/manual', component: Planner, title: 'Táº¡o lá»‹ch trÃ¬nh thá»§ cÃ´ng' },
      { path: 'planner/edit', redirectTo: 'planner' },
      { path: 'planner/:id/edit', component: Planner, title: 'Chá»‰nh sá»­a chuyáº¿n Ä‘i' },
      {
        path: 'partner/register',
        component: PartnerRegister,
        title: 'ÄÃ³ng gÃ³p Ä‘á»‹a Ä‘iá»ƒm',
        canActivate: [requireAuth],
      },
      { path: 'favorite', component: Favorite, title: 'YÃªu thÃ­ch', canActivate: [requireAuth] },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiáº¿t' },
      { path: 'profile', component: Profile, title: 'Há»“ sÆ¡', canActivate: [requireAuth] },
      { path: 'reviews/:slug', component: Reviews, title: 'ÄÃ¡nh giÃ¡' },
      { path: 'contact', component: Contact, title: 'LiÃªn há»‡' },
      { path: 'policy', component: Policy, title: 'Chinh sach' },
    ],
  },
  { path: '**', redirectTo: '' },
];

