import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { Place } from '../../core/models/app.models';
import {
  ItineraryApiService,
  AdminItinerary,
} from '../../core/services/itinerary-api.service';
import { LocationApiService } from '../../core/services/location-api.service';
import { UserApiService, AdminUser } from '../../core/services/user-api.service';
import { AdminHeader } from '../shared/admin-header/admin-header';
import { MetricCard } from '../shared/metric-card/metric-card';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminHeader, MetricCard],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome implements OnInit {
  private locationApi = inject(LocationApiService);
  private itineraryApi = inject(ItineraryApiService);
  private userApi = inject(UserApiService);

  loading = signal(false);

  totalLocations = signal(0);
  totalItineraries = signal(0);
  totalUsers = signal(0);
  trendingPlaces = signal<Place[]>([]);
  recentItineraries = signal<AdminItinerary[]>([]);
  recentUsers = signal<AdminUser[]>([]);

  metrics = computed(() => [
    {
      label: 'Địa điểm',
      value: this.totalLocations().toLocaleString('vi-VN'),
      note: 'Tổng trên hệ thống',
      icon: 'fa-location-dot',
      variant: 'sky',
    },
    {
      label: 'Lịch trình AI',
      value: this.totalItineraries().toLocaleString('vi-VN'),
      note: 'Đã tạo bằng Gemini',
      icon: 'fa-route',
      variant: 'violet',
    },
    {
      label: 'Người dùng',
      value: this.totalUsers().toLocaleString('vi-VN'),
      note: 'Đã đăng ký',
      icon: 'fa-users',
      variant: 'green',
    },
    {
      label: 'Trending',
      value: this.trendingPlaces().length.toLocaleString('vi-VN'),
      note: 'Địa điểm nổi bật',
      icon: 'fa-fire-flame-curved',
      variant: 'orange',
    },
  ]);

  readonly quickLinks = [
    {
      label: 'Quản lý địa điểm',
      note: 'CRUD, import JSON, filter',
      icon: 'fa-location-dot',
      route: '/admin/locations',
    },
    {
      label: 'Đóng góp địa điểm',
      note: 'Duyệt ảnh, duyệt nội dung, cập nhật trạng thái',
      icon: 'fa-square-plus',
      route: '/admin/location-submissions',
    },
    {
      label: 'Lịch trình AI',
      note: 'Tạo, xem, xóa lịch trình',
      icon: 'fa-route',
      route: '/admin/itineraries',
    },
    {
      label: 'Người dùng',
      note: 'CRUD, phân quyền, trạng thái',
      icon: 'fa-users',
      route: '/admin/users',
    },
  ];

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);

    forkJoin({
      locations: this.locationApi
        .fetchLocationsPaginated({ cityId: 'hcm', perPage: 1 })
        .pipe(catchError(() => of(null))),
      trending: this.locationApi.fetchTrendingLocations().pipe(catchError(() => of([]))),
      itineraries: this.itineraryApi
        .fetchItinerariesPaginated(1, 5)
        .pipe(catchError(() => of(null))),
      users: this.userApi.fetchUsersPaginated({ perPage: 5 }).pipe(catchError(() => of(null))),
    }).subscribe({
      next: (result) => {
        if (result.locations) {
          this.totalLocations.set(result.locations.meta.total);
        }
        this.trendingPlaces.set(result.trending);
        if (result.itineraries) {
          this.totalItineraries.set(result.itineraries.meta.total);
          this.recentItineraries.set(result.itineraries.data);
        }
        if (result.users) {
          this.totalUsers.set(result.users.meta.total);
          this.recentUsers.set(result.users.data);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
