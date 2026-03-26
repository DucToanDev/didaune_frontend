import { Routes } from '@angular/router';
import { AdminHome } from './admin/admin-home/admin-home';
import { AdminInsights } from './admin/admin-insights/admin-insights';
import { AdminItineraries } from './admin/admin-itineraries/admin-itineraries';
import { AdminLocations } from './admin/admin-locations/admin-locations';
import { AdminPartners } from './admin/admin-partners/admin-partners';
import { AdminShell } from './admin/admin-shell/admin-shell';
import { Discover } from './features/discover/discover';
import { Detail } from './features/detail/detail';
import { Favorite } from './features/favorite/favorite';
import { Home } from './features/home/home';
import { List } from './features/list/list';
import { MapPage } from './features/map-page/map-page';
import { Planner } from './features/planner/planner';
import { PartnerRegister } from './features/partner-register/partner-register';
import { Profile } from './features/profile/profile';
import { Reviews } from './features/reviews/reviews';
import { UserShell } from './layout/user-shell';

export const routes: Routes = [
  {
    path: 'admin',
    component: AdminShell,
    children: [
      { path: '', component: AdminHome, title: 'Admin Dashboard' },
      { path: 'itineraries', component: AdminItineraries, title: 'Admin Itineraries' },
      { path: 'insights', component: AdminInsights, title: 'Admin AI Insights' },
      { path: 'locations', component: AdminLocations, title: 'Admin Locations' },
      { path: 'partners', component: AdminPartners, title: 'Admin Partners' },
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
      { path: 'partner/register', component: PartnerRegister, title: 'Dang ky doi tac' },
      { path: 'favorite', component: Favorite, title: 'Yeu thich' },
      { path: 'detail/:slug', component: Detail, title: 'Chi tiet' },
      { path: 'profile', component: Profile, title: 'Ho so' },
      { path: 'reviews/:slug', component: Reviews, title: 'Danh gia' },
    ],
  },
  { path: '**', redirectTo: '' },
];
