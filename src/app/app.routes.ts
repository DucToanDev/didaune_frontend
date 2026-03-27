import { Routes } from '@angular/router';
import { Discover } from './features/discover/discover';
import { Detail } from './features/detail/detail';
import { Favorite } from './features/favorite/favorite';
import { Home } from './features/home/home';
import { MapPage } from './features/map-page/map-page';
import { Planner } from './features/planner/planner';
import { PartnerRegister } from './features/partner-register/partner-register';
import { Profile } from './features/profile/profile';
import { Reviews } from './features/reviews/reviews';
import { UserShell } from './layout/user-shell';

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
      { path: 'planner', component: Planner, title: 'Lên lịch trình AI' },
      { path: 'partner/register', component: PartnerRegister, title: 'Đăng ký đối tác' },
      { path: 'favorite', component: Favorite, title: 'Yêu thích' },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiết' },
      { path: 'profile', component: Profile, title: 'Hồ sơ' },
      { path: 'reviews/:slug', component: Reviews, title: 'Đánh giá' },
    ],
  },
  { path: '**', redirectTo: '' },
];
