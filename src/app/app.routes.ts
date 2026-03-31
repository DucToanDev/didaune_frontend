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

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: '',
    component: UserShell,
    children: [
      { path: '', component: Home, title: 'Trang chủ' },
      { path: 'discover', component: Discover, title: 'Khám phá địa điểm' },
      { path: 'list', redirectTo: 'discover' },
      { path: 'map', component: MapPage, title: 'Bản đồ địa điểm' },
      { path: 'planner', component: PlannerList, title: 'Lịch trình của bạn' },
      { path: 'planner/new', redirectTo: 'planner/new/manual', pathMatch: 'full' },
      { path: 'planner/new/ai', component: PlannerCreateAi, title: 'Tạo lịch trình bằng AI' },
      { path: 'planner/new/manual', component: Planner, title: 'Tạo lịch trình thủ công' },
      { path: 'planner/edit', redirectTo: 'planner' },
      { path: 'planner/:id/edit', component: Planner, title: 'Chỉnh sửa chuyến đi' },
      { path: 'partner/register', component: PartnerRegister, title: 'Đăng ký đối tác' },
      { path: 'favorite', component: Favorite, title: 'Yêu thích', canActivate: [requireAuth] },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiết' },
      { path: 'profile', component: Profile, title: 'Hồ sơ', canActivate: [requireAuth] },
      { path: 'reviews/:slug', component: Reviews, title: 'Đánh giá' },
    ],
  },
  { path: '**', redirectTo: '' },
];
