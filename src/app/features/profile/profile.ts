import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { User } from '../../core/models/app.models';
import { BACKEND_API_CONFIG } from '../../core/config/backend-api.config';
import { DataService } from '../../core/services/data.service';
import { SeoService } from '../../core/services/seo.service';
import {
  AdminItinerary,
  ItineraryApiService,
} from '../../core/services/itinerary-api.service';
import {
  AdminLocationSubmission,
  LocationSubmissionApiService,
} from '../../core/services/location-submission-api.service';
import { ToastService } from '../../core/services/toast.service';
import { UserApiService } from '../../core/services/user-api.service';
import { DEFAULT_PLACE_IMAGE } from '../../core/utils/place-display.utils';

interface ProfileAddedPlace {
  id: string;
  name: string;
  slug: string | null;
  image: string;
  contextLabel: string;
}

interface ProfileItineraryItem {
  id: number;
  title: string;
  coverImage: string;
  dateLabel: string;
  sourceLabel: string;
  stopsLabel: string;
  activityDate: string | null;
  relation: 'owner' | 'invited';
  relationLabel: string;
  destinationLabel: string;
  places: ProfileAddedPlace[];
}

interface ActivityMonth {
  label: string;
  value: number;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  public dataService = inject(DataService);
  private router = inject(Router);
  private itineraryApi = inject(ItineraryApiService);
  private locationSubmissionApi = inject(LocationSubmissionApiService);
  private userApi = inject(UserApiService);
  private toast = inject(ToastService);
  private seo = inject(SeoService);
  private readonly backendOrigin = BACKEND_API_CONFIG.baseUrl.replace(/\/api$/, '');

  user = computed<User>(() => this.dataService.currentUser());
  favoritesCount = signal(0);
  itinerariesLoading = signal(true);
  itineraries = signal<ProfileItineraryItem[]>([]);
  addedPlacesLoading = signal(true);
  addedPlacesFromSubmissions = signal<ProfileAddedPlace[]>([]);
  logoutSubmitting = signal(false);
  profileEditMode = signal(false);
  profileSaving = signal(false);
  logoutError = signal('');
  profileNameInput = signal('');
  profileEmailInput = signal('');
  profilePhoneInput = signal('');
  profileMembershipInput = signal('');
  profileBioInput = signal('');
  activeTab = signal<'gioi-thieu' | 'yeu-thich' | 'lich-trinh' | 'danh-gia'>(
    'gioi-thieu',
  );

  reviewsCount = computed(() => this.dataService.internalReviews().length);
  recentReviews = computed(() => this.dataService.internalReviews().slice(0, 3));
  recentAddedPlaces = computed<ProfileAddedPlace[]>(() => {
    if (this.addedPlacesFromSubmissions().length) {
      return this.addedPlacesFromSubmissions();
    }

    const seen = new Set<string>();
    const places: ProfileAddedPlace[] = [];

    for (const itinerary of this.itineraries()) {
      for (const place of itinerary.places) {
        if (seen.has(place.id)) {
          continue;
        }

        seen.add(place.id);
        places.push(place);

        if (places.length >= 4) {
          return places;
        }
      }
    }

    return places;
  });
  recentItineraries = computed(() => this.itineraries().slice(0, 3));
  heroCoverImage = computed(
    () => this.recentItineraries()[0]?.coverImage || DEFAULT_PLACE_IMAGE,
  );
  displayName = computed(
    () => this.user().full_name?.trim() || this.user().name?.trim() || 'Khách',
  );
  averageRating = computed(() => {
    const reviews = this.dataService.internalReviews();

    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return Math.round((total / reviews.length) * 100) / 100;
  });
  profileScore = computed(() =>
    Math.min(
      100,
      28 +
        this.favoritesCount() * 6 +
        this.recentItineraries().length * 12 +
        this.reviewsCount() * 8,
    ),
  );
  accountStatusLabel = computed(() => {
    const user = this.user();

    if (user.id === 'guest' || !user.email) {
      return 'Khách';
    }

    if (user.is_active === false) {
      return 'Chưa kích hoạt';
    }

    return 'Đang hoạt động';
  });
  lastLoginLabel = computed(() => {
    const raw = this.user().last_login_at;

    if (!raw) {
      return 'Chưa có dữ liệu';
    }

    const parsed = new Date(raw);

    if (Number.isNaN(parsed.getTime())) {
      return 'Chưa có dữ liệu';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  });
  monthlyActivity = computed<ActivityMonth[]>(() => {
    const months = this.createLastEightMonths();
    const activityMap = new Map(months.map((month) => [month.key, 0]));

    for (const review of this.dataService.internalReviews()) {
      const key = this.resolveMonthKey(review.created_at);

      if (key && activityMap.has(key)) {
        activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
      }
    }

    for (const itinerary of this.itineraries()) {
      const key = this.resolveMonthKey(itinerary.activityDate);

      if (key && activityMap.has(key)) {
        activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
      }
    }

    return months.map((month) => ({
      label: month.label,
      value: activityMap.get(month.key) ?? 0,
    }));
  });
  maxMonthlyActivity = computed(() =>
    Math.max(...this.monthlyActivity().map((item) => item.value), 1),
  );

  constructor() {
    this.seo.setPage({
      title: 'Hồ sơ',
      description: 'Quản lý thông tin và hoạt động tài khoản.',
      path: '/profile',
      noindex: true,
    });

    effect(() => {
      const user = this.user();

      this.profileNameInput.set(user.full_name?.trim() || user.name || '');
      this.profileEmailInput.set(user.email || '');
      this.profilePhoneInput.set(user.phone || '');
      this.profileMembershipInput.set(user.membership || 'Thành viên');
      this.profileBioInput.set(user.bio || '');
    });

  }

  ngOnInit() {
    this.dataService
      .getFavoritePlaces()
      .subscribe((favorites) => this.favoritesCount.set(favorites.length));

    this.itineraryApi
      .fetchAllItineraries(50)
      .pipe(
        catchError(() => of([] as AdminItinerary[])),
        finalize(() => this.itinerariesLoading.set(false)),
      )
      .subscribe((items) => {
        this.itineraries.set(
          items
            .map((item) => this.mapItinerary(item))
            .filter((item): item is ProfileItineraryItem => item !== null),
        );
      });

    const currentEmail = this.user().email?.trim();

    if (currentEmail) {
      this.locationSubmissionApi
        .fetchApprovedSubmissionsByEmail(currentEmail, 8)
        .pipe(
          catchError(() => of([] as AdminLocationSubmission[])),
          finalize(() => this.addedPlacesLoading.set(false)),
        )
        .subscribe((items) => {
          this.addedPlacesFromSubmissions.set(
            items.slice(0, 4).map((item) => this.mapSubmissionPlace(item)),
          );
        });
    } else {
      this.addedPlacesLoading.set(false);
    }
  }

  setActiveTab(tab: 'gioi-thieu' | 'yeu-thich' | 'lich-trinh' | 'danh-gia') {
    this.activeTab.set(tab);
  }

  enableProfileEdit() {
    this.profileEditMode.set(true);
  }

  saveProfile() {
    const userId = Number(this.user().id);
    const fullName = this.profileNameInput().trim();
    const email = this.profileEmailInput().trim();
    const phone = this.profilePhoneInput().trim();
    const bio = this.profileBioInput().trim();

    if (!Number.isFinite(userId) || userId <= 0) {
      this.toast.warning('Không tìm thấy tài khoản hợp lệ để cập nhật.');
      return;
    }

    if (!fullName) {
      this.toast.warning('Vui lòng nhập họ và tên.');
      return;
    }

    if (!email) {
      this.toast.warning('Vui lòng nhập email.');
      return;
    }

    this.profileSaving.set(true);

    this.userApi
      .updateUser(userId, {
        name: fullName,
        full_name: fullName,
        email,
        phone: phone || null,
        bio: bio || null,
      })
      .pipe(finalize(() => this.profileSaving.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.dataService.updateCurrentUser({
            name: updatedUser.name?.trim() || fullName,
            full_name: updatedUser.full_name?.trim() || fullName,
            email: updatedUser.email?.trim() || email,
            phone: updatedUser.phone?.trim() || null,
            bio: updatedUser.bio?.trim() || '',
            membership:
              updatedUser.membership_tier?.trim() ||
              this.profileMembershipInput().trim() ||
              this.user().membership,
            role: updatedUser.role?.trim() || null,
            is_active: updatedUser.is_active,
            last_login_at: updatedUser.last_login_at ?? null,
          });
          this.profileEditMode.set(false);
          this.toast.success('Đã cập nhật thông tin cá nhân.');
        },
        error: () => {
          this.toast.error('Cập nhật thông tin thất bại.');
        },
      });
  }

  logout() {
    this.logoutError.set('');
    this.logoutSubmitting.set(true);

    this.dataService
      .logout()
      .pipe(finalize(() => this.logoutSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: () => {
          this.logoutError.set('Đăng xuất thất bại. Vui lòng thử lại.');
        },
      });
  }

  private mapItinerary(item: AdminItinerary): ProfileItineraryItem | null {
    const relation = this.resolveItineraryRelation(item);

    if (!relation) {
      return null;
    }

    const activityDate = item.start_date ?? item.created_at ?? null;

    return {
      id: item.id,
      title: item.title,
      coverImage: item.cover_image || DEFAULT_PLACE_IMAGE,
      dateLabel: activityDate?.slice(0, 10) ?? 'Đang cập nhật',
      sourceLabel: item.itinerary_type === 'ai' ? 'AI' : 'Thủ công',
      stopsLabel: `${item.items?.length ?? 0} điểm dừng`,
      activityDate,
      relation,
      relationLabel: relation === 'owner' ? 'Chủ sở hữu' : 'Được mời',
      destinationLabel: item.destination_city?.trim() || 'Đang cập nhật điểm đến',
      places: (item.items ?? [])
        .map((entry, index) => {
          const location = entry.location;

          if (!location) {
            return null;
          }

          return {
            id: location.slug?.trim() || String(location.id || `${item.id}-${index}`),
            name: location.name?.trim() || entry.activity_title || 'Địa điểm',
            slug: location.slug?.trim() || null,
            image: location.image?.trim() || DEFAULT_PLACE_IMAGE,
            contextLabel: item.title,
          } as ProfileAddedPlace;
        })
        .filter((place): place is ProfileAddedPlace => place !== null),
    };
  }

  private resolveItineraryRelation(
    item: AdminItinerary,
  ): 'owner' | 'invited' | null {
    const currentUser = this.user();
    const currentId = Number(currentUser.id);
    const currentEmail = currentUser.email?.trim().toLowerCase() || '';

    if (Number.isFinite(currentId) && item.user_id === currentId) {
      return 'owner';
    }

    const isInvited = (item.members ?? []).some((member) => {
      const memberId = member.id?.trim().toLowerCase() || '';
      const memberName = member.name?.trim().toLowerCase() || '';

      return Boolean(
        (currentEmail &&
          (memberId === currentEmail || memberName === currentEmail)) ||
          (Number.isFinite(currentId) && memberId === String(currentId)),
      );
    });

    return isInvited ? 'invited' : null;
  }

  private createLastEightMonths() {
    const formatter = new Intl.DateTimeFormat('vi-VN', { month: 'short' });
    const now = new Date();

    return Array.from({ length: 8 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (7 - index), 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: formatter.format(date).replace('.', ''),
      };
    });
  }

  private resolveMonthKey(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  }

  private mapSubmissionPlace(item: AdminLocationSubmission): ProfileAddedPlace {
    return {
      id: item.id,
      name: item.name?.trim() || 'Địa điểm đã thêm',
      slug: item.approved_location_slug?.trim() || null,
      image: this.resolveImageUrl(item.main_image_url) || DEFAULT_PLACE_IMAGE,
      contextLabel: item.address?.trim() || item.city?.trim() || 'Địa điểm bạn đã đóng góp',
    };
  }

  private resolveImageUrl(path: string | null | undefined): string {
    if (!path) {
      return '';
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.backendOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
