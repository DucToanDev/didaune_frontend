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
    path: '',
    component: UserShell,
    children: [
      { path: '', component: Home, title: 'Trang chu' },
      { path: 'discover', component: Discover, title: 'Kham pha dia diem' },
      { path: 'list', redirectTo: 'discover' },
      { path: 'map', component: MapPage, title: 'Ban do dia diem' },
      { path: 'planner', component: Planner, title: 'Len lich trinh AI' },
      { path: 'partner/register', component: PartnerRegister, title: 'Dang ky doi tac' },
      { path: 'favorite', component: Favorite, title: 'Yeu thich' },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiet' },
      { path: 'profile', component: Profile, title: 'Ho so' },
      { path: 'reviews/:slug', component: Reviews, title: 'Danh gia' },
    ],
  },
  { path: '**', redirectTo: '' },
];
