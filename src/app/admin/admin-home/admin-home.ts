import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

interface AdminMetric {
  label: string;
  value: string;
  note: string;
  icon: string;
  iconClass: string;
}

interface PartnerRequest {
  type: string;
  name: string;
  meta: string;
  status: 'pending' | 'review';
}

interface TrendItem {
  label: string;
  value: number;
  barClass: string;
}

interface ReviewItem {
  name: string;
  time: string;
  rating: number;
  content: string;
  avatar: string;
}

interface PotentialPartner {
  name: string;
  city: string;
  visits: string;
}

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome {
  activeMenu = signal('overview');

  readonly metrics: AdminMetric[] = [
    {
      label: 'Tong dia diem',
      value: '1,284',
      note: '+12% thang nay',
      icon: 'fa-map-marker-alt',
      iconClass: 'bg-blue-50 text-blue-500',
    },
    {
      label: 'Doi tac moi',
      value: '48',
      note: 'Dang cho duyet: 5',
      icon: 'fa-users',
      iconClass: 'bg-orange-50 text-orange-500',
    },
    {
      label: 'AI Itineraries',
      value: '8,502',
      note: '+24% hieu suat',
      icon: 'fa-brain',
      iconClass: 'bg-purple-50 text-purple-500',
    },
    {
      label: 'Review moi',
      value: '312',
      note: 'Can phan hoi',
      icon: 'fa-comment-dots',
      iconClass: 'bg-pink-50 text-pink-500',
    },
  ];

  readonly partnerRequests: PartnerRequest[] = [
    {
      type: 'Cafe',
      name: 'The Minimalist Coffee',
      meta: 'Quan 1, TP.HCM • Dang ky 2h truoc',
      status: 'pending',
    },
    {
      type: 'Bar',
      name: 'Neon Sunset Lounge',
      meta: 'Thao Dien, Quan 2 • Dang ky 5h truoc',
      status: 'review',
    },
  ];

  readonly trends: TrendItem[] = [
    { label: 'Vibe Neo-Brutalism', value: 78, barClass: 'bg-orange-500' },
    { label: 'Hen ho lang man', value: 62, barClass: 'bg-blue-400' },
  ];

  readonly chartBars = [40, 60, 45, 85, 70, 55, 90];

  readonly reviews: ReviewItem[] = [
    {
      name: 'Hoang Nam',
      time: '5 phut truoc',
      rating: 4,
      content:
        'Khong gian o day rat hop de hen ho, AI goi y lich trinh cuc chuan va de di theo.',
      avatar: 'https://ui-avatars.com/api/?name=User+A&background=e2e8f0',
    },
  ];

  readonly potentialPartners: PotentialPartner[] = [
    {
      name: 'May Lang Thang Cafe',
      city: 'Da Lat',
      visits: '1.2k',
    },
  ];

  readonly menus = [
    { id: 'overview', label: 'Tong quan', icon: 'fa-th-large' },
    { id: 'locations', label: 'Dia diem', icon: 'fa-map-marker-alt', route: '/admin/locations' },
    { id: 'partners', label: 'Doi tac', icon: 'fa-store', route: '/admin/partners' },
    { id: 'reviews', label: 'Danh gia', icon: 'fa-star' },
    { id: 'insights', label: 'AI Insights', icon: 'fa-magic' },
  ];
}
