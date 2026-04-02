import {
  Component,
  computed,
  signal,
  inject,
  OnInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { City, Place, Ward } from '../../../core/models/app.models';
import { DataService } from '../../../core/services/data.service';
import { LocationApiService } from '../../../core/services/location-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router } from '@angular/router';
import { BACKEND_API_CONFIG } from '../../../core/config/backend-api.config';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
            }) => void;
          }) => {
            callback: (response: {
              access_token?: string;
              error?: string;
            }) => void;
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
    FB?: {
      init: (config: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { accessToken?: string };
          status?: string;
        }) => void,
        options?: { scope?: string },
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  public dataService = inject(DataService);
  private locationApi = inject(LocationApiService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  cities = signal<City[]>([]);
  wards = signal<Ward[]>([]);
  authModalOpen = signal(false);
  authMode = signal<'login' | 'register'>('login');
  mobileSearchOpen = signal(false);
  desktopSearchOpen = signal(false);
  wardQuery = signal('');
  wardDropdownOpen = signal(false);
  authName = signal('');
  authEmail = signal(this.dataService.currentUser().email);
  authPassword = signal('');
  authConfirmPassword = signal('');
  authError = signal('');
  authSubmitting = signal(false);
  apiSearchSuggestions = signal<Place[]>([]);
  recentViewedPlaces = signal<Place[]>([]);
  private googleSdkPromise: Promise<void> | null = null;
  private facebookSdkPromise: Promise<void> | null = null;
  private googleTokenClient: {
    callback: (response: { access_token?: string; error?: string }) => void;
    requestAccessToken: (options?: { prompt?: string }) => void;
  } | null = null;
  private searchOpen$ = toObservable(
    computed(() => this.desktopSearchOpen() || this.mobileSearchOpen()),
  ).pipe(
    startWith(this.desktopSearchOpen() || this.mobileSearchOpen()),
    distinctUntilChanged(),
  );
  private cityId$ = toObservable(this.dataService.currentCityId).pipe(
    startWith(this.dataService.currentCityId()),
    distinctUntilChanged(),
  );
  private searchQuery$ = toObservable(this.dataService.searchQuery).pipe(
    startWith(this.dataService.searchQuery()),
    map((value) => value.trim()),
    debounceTime(250),
    distinctUntilChanged(),
  );
  private recentViewedCount$ = toObservable(
    computed(() => this.recentViewedPlaces().length),
  ).pipe(
    startWith(this.recentViewedPlaces().length),
    distinctUntilChanged(),
  );

  constructor() {
    effect(() => {
      const mode = this.dataService.authModalRequest();

      if (!mode) {
        return;
      }

      this.openAuthModal(mode);
      this.dataService.clearAuthModalRequest();
    });

    effect(() => {
      const authError = this.authError();

      if (!authError) {
        return;
      }

      this.toastService.error(authError);
    });
  }
  filteredWards = computed(() => {
    const query = this.wardQuery().trim().toLowerCase();

    if (!query) {
      return this.wards();
    }

    return this.wards().filter((ward) =>
      ward.name.toLowerCase().includes(query),
    );
  });
  searchSuggestions = computed(() => {
    const query = this.dataService.searchQuery().trim().toLowerCase();
    const recent = this.recentViewedPlaces();
    const recentSlugs = new Set(recent.map((place) => place.slug));
    const suggestions = this.apiSearchSuggestions();

    if (query) {
      const recentMatches = recent.filter((place) =>
        this.matchesPlaceQuery(place, query),
      );
      const apiMatches = suggestions.filter(
        (place) =>
          !recentSlugs.has(place.slug) && this.matchesPlaceQuery(place, query),
      );

      return [...recentMatches, ...apiMatches].slice(0, 10);
    }

    if (recent.length) {
      return recent.slice(0, 10);
    }

    return suggestions.slice(0, 10);
  });
  searchSuggestionTitle = computed(() => {
    const query = this.dataService.searchQuery().trim();
    const city =
      this.cities().find((item) => item.id === this.dataService.currentCityId())
        ?.name ?? 'Hồ Chí Minh';

    if (query) {
      return `Gợi ý cho "${query}"`;
    }

    return this.recentViewedPlaces().length ? '' : `Top quán tại ${city}`;
  });

  ngOnInit() {
    this.preloadSocialAuth();
    this.wardQuery.set(this.dataService.currentWardName());
    this.dataService.getCities().subscribe((data) => this.cities.set(data));
    this.loadWards(this.dataService.currentCityId());
    this.dataService
      .getRecentlyViewedPlaces(5)
      .subscribe((places) => this.recentViewedPlaces.set(places));
    this.setupSearchSuggestions();
  }

  onCityChange(event: any) {
    const cityId = event.target.value;

    this.dataService.currentCityId.set(cityId);
    this.dataService.currentDistrictId.set('all');
    this.dataService.currentWardCode.set('');
    this.dataService.currentWardName.set('');
    this.wardQuery.set('');
    this.wardDropdownOpen.set(false);
    this.loadWards(cityId);
  }

  onWardInput(event: any) {
    const value = event.target.value.trim();
    this.wardQuery.set(value);
    this.wardDropdownOpen.set(true);

    if (!value) {
      this.dataService.currentWardCode.set('');
      this.dataService.currentWardName.set('');
      return;
    }

    const matchedWard = this.wards().find(
      (ward) => ward.name.toLowerCase() === value.toLowerCase(),
    );

    this.dataService.currentWardCode.set(
      matchedWard ? String(matchedWard.code) : '',
    );
    this.dataService.currentWardName.set(matchedWard ? matchedWard.name : '');
  }

  onWardFocus() {
    this.wardDropdownOpen.set(true);
  }

  onWardBlur() {
    setTimeout(() => {
      this.wardDropdownOpen.set(false);

      if (!this.dataService.currentWardCode()) {
        this.wardQuery.set(this.dataService.currentWardName());
      }
    }, 150);
  }

  selectWard(ward: Ward) {
    this.wardQuery.set(ward.name);
    this.dataService.currentWardCode.set(String(ward.code));
    this.dataService.currentWardName.set(ward.name);
    this.wardDropdownOpen.set(false);
  }

  onSearchChange(event: any) {
    this.dataService.searchQuery.set(event.target.value);
    this.desktopSearchOpen.set(true);
  }

  onSearchFocus() {
    this.desktopSearchOpen.set(true);
  }

  onSearchBlur() {
    setTimeout(() => this.desktopSearchOpen.set(false), 150);
  }

  onSearchEnter() {
    const firstSuggestion = this.searchSuggestions()[0];

    if (firstSuggestion && this.dataService.searchQuery().trim()) {
      this.openSuggestion(firstSuggestion);
      return;
    }

    this.desktopSearchOpen.set(false);
    this.mobileSearchOpen.set(false);
    this.router.navigate(['/discover']);
  }

  selectSuggestion(place: Place) {
    this.openSuggestion(place);
  }

  useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        this.dataService.setCurrentCoordinates(coordinates);
        this.router.navigate(['/']);
      },
      () => {
        this.dataService.setCurrentCoordinates(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  clearSearch() {
    this.dataService.searchQuery.set('');
    this.desktopSearchOpen.set(false);
  }

  handleAvatarClick() {
    if (this.dataService.isAuthenticated()) {
      this.router.navigate(['/profile']);
      return;
    }

    this.openAuthModal('login');
  }

  openAuthModal(mode: 'login' | 'register' = 'login') {
    const currentUser = this.dataService.currentUser();
    const isAuthenticated = this.dataService.isAuthenticated();

    this.authMode.set(mode);
    this.authName.set(isAuthenticated ? currentUser.name : '');
    this.authEmail.set(isAuthenticated ? currentUser.email : '');
    this.authPassword.set('');
    this.authConfirmPassword.set('');
    this.authError.set('');
    this.authSubmitting.set(false);
    this.authModalOpen.set(true);
  }

  closeAuthModal() {
    this.authModalOpen.set(false);
  }

  setAuthMode(mode: 'login' | 'register') {
    this.authMode.set(mode);
    this.authPassword.set('');
    this.authConfirmPassword.set('');
    this.authError.set('');
  }

  toggleMobileSearch() {
    this.mobileSearchOpen.update((open) => !open);
  }

  closeMobileSearch() {
    this.mobileSearchOpen.set(false);
  }

  toggleMobileSidebar() {
    this.dataService.mobileSidebarOpen.update((open) => !open);
  }

  submitAuth() {
    const mode = this.authMode();
    const name = this.authName().trim();
    const email = this.authEmail().trim();
    const password = this.authPassword().trim();
    const confirmPassword = this.authConfirmPassword().trim();

    if (!email) {
      this.authError.set('Vui lòng nhập email.');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.authError.set('Email không đúng định dạng.');
      return;
    }

    if (!password) {
      this.authError.set('Vui lòng nhập mật khẩu.');
      return;
    }

    if (mode === 'register' && !name) {
      this.authError.set('Vui lòng nhập họ và tên.');
      return;
    }

    if (!email) {
      this.authError.set('Vui lòng nhập email.');
      return;
    }

    if (!password) {
      this.authError.set('Vui lòng nhập mật khẩu.');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      this.authError.set('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      this.authError.set('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.authError.set('');
    this.authSubmitting.set(true);

    const request$ =
      mode === 'login'
        ? this.dataService.login(email, password)
        : this.dataService.register(name, email, password);

    request$.pipe(finalize(() => this.authSubmitting.set(false))).subscribe({
      next: () => {
        this.toastService.success(
          mode === 'login' ? 'Đăng nhập thành công.' : 'Đăng ký thành công.',
        );
        this.dataService.resumePendingAuthAction();
        this.authModalOpen.set(false);
        this.handlePostAuthRedirect();
      },
      error: (error) => {
        this.authError.set(
          this.resolveAuthError(
            error,
            mode === 'login'
              ? 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
              : 'Đăng ký thất bại. Vui lòng thử lại.',
          ),
        );
      },
    });
  }

  loginWithGoogle() {
    if (!BACKEND_API_CONFIG.googleClientId) {
      this.authError.set('Chưa cấu hình Google Client ID ở frontend.');
      return;
    }

    this.authError.set('');
    this.authSubmitting.set(true);

    this.loadGoogleSdk()
      .then(() => {
        if (!this.googleTokenClient) {
          throw new Error('google_client_not_ready');
        }

        this.googleTokenClient.callback = (response) => {
          if (!response.access_token || response.error) {
            this.authSubmitting.set(false);
            this.authError.set('Đăng nhập Google thất bại. Vui lòng thử lại.');
            return;
          }

          this.finishSocialLogin(
            this.dataService.loginWithGoogle(response.access_token),
            'Đăng nhập Google thất bại. Vui lòng thử lại.',
          );
        };

        this.googleTokenClient.requestAccessToken({ prompt: 'select_account' });
      })
      .catch(() => {
        this.authSubmitting.set(false);
        this.authError.set('Không tải được SDK Google. Vui lòng thử lại.');
      });
  }

  loginWithFacebook() {
    if (!BACKEND_API_CONFIG.facebookAppId) {
      this.authError.set('Chưa cấu hình Facebook App ID ở frontend.');
      return;
    }

    this.authError.set('');
    this.authSubmitting.set(true);

    this.loadFacebookSdk()
      .then(() => {
        if (!window.FB) {
          throw new Error('facebook_sdk_not_ready');
        }

        window.FB.login(
          (response) => {
            const accessToken = response.authResponse?.accessToken;

            if (!accessToken) {
              this.authSubmitting.set(false);
              this.authError.set('Đăng nhập Facebook đã bị hủy hoặc thất bại.');
              return;
            }

            this.finishSocialLogin(
              this.dataService.loginWithFacebook(accessToken),
              'Đăng nhập Facebook thất bại. Vui lòng thử lại.',
            );
          },
          { scope: 'public_profile,email' },
        );
      })
      .catch(() => {
        this.authSubmitting.set(false);
        this.authError.set('Không tải được SDK Facebook. Vui lòng thử lại.');
      });
  }

  private loadWards(cityId: string, preferredWardName = '') {
    this.dataService.getWardsByCityId(cityId).subscribe((data) => {
      this.wards.set(data);

      if (preferredWardName) {
        this.wardQuery.set(preferredWardName);
        return;
      }

      const currentWardCode = this.dataService.currentWardCode();
      const selectedWard = data.find(
        (ward) => String(ward.code) === currentWardCode,
      );

      this.wardQuery.set(
        selectedWard?.name ?? this.dataService.currentWardName(),
      );
    });
  }

  private setupSearchSuggestions() {
    combineLatest([
      this.cityId$,
      this.searchQuery$,
      this.searchOpen$,
      this.recentViewedCount$,
    ])
      .pipe(
        switchMap(([cityId, search, searchOpen, recentViewedCount]) => {
          if (!searchOpen && !search) {
            return of([] as Place[]);
          }

          if (!search && recentViewedCount > 0) {
            return of([] as Place[]);
          }

          return this.locationApi
            .fetchLocationsPaginated({
              cityId,
              search,
              sort: 'popular',
              page: 1,
              perPage: 10,
            })
            .pipe(
              map((result) => result.data),
              catchError(() => of([] as Place[])),
            );
        }),
      )
      .subscribe((places) => this.apiSearchSuggestions.set(places));
  }

  private openSuggestion(place: Place) {
    this.dataService.searchQuery.set(place.name);
    this.desktopSearchOpen.set(false);
    this.mobileSearchOpen.set(false);
    this.router.navigate(['/detail', place.slug]);
  }

  private matchesPlaceQuery(place: Place, query: string): boolean {
    const searchable = [
      place.name,
      place.address,
      place.description,
      place.district_name,
      place.ward_name,
      ...place.category_labels,
      ...place.highlights,
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  }

  private preloadSocialAuth() {
    if (BACKEND_API_CONFIG.googleClientId) {
      void this.loadGoogleSdk();
    }

    if (BACKEND_API_CONFIG.facebookAppId) {
      void this.loadFacebookSdk();
    }
  }

  private loadGoogleSdk(): Promise<void> {
    if (this.googleSdkPromise) {
      return this.googleSdkPromise;
    }

    this.googleSdkPromise = new Promise<void>((resolve, reject) => {
      const initializeClient = () => {
        const factory = window.google?.accounts?.oauth2?.initTokenClient;

        if (!factory) {
          reject(new Error('google_sdk_missing'));
          return;
        }

        if (!this.googleTokenClient) {
          this.googleTokenClient = factory({
            client_id: BACKEND_API_CONFIG.googleClientId,
            scope: 'openid email profile',
            callback: () => undefined,
          });
        }

        resolve();
      };

      if (window.google?.accounts?.oauth2) {
        initializeClient();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-social-sdk="google"]',
      );

      if (existingScript) {
        existingScript.addEventListener('load', initializeClient, {
          once: true,
        });
        existingScript.addEventListener(
          'error',
          () => reject(new Error('google_sdk_load_failed')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['socialSdk'] = 'google';
      script.addEventListener('load', initializeClient, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error('google_sdk_load_failed')),
        { once: true },
      );
      document.head.appendChild(script);
    });

    return this.googleSdkPromise;
  }

  private loadFacebookSdk(): Promise<void> {
    if (this.facebookSdkPromise) {
      return this.facebookSdkPromise;
    }

    this.facebookSdkPromise = new Promise<void>((resolve, reject) => {
      const initFacebook = () => {
        if (!window.FB) {
          reject(new Error('facebook_sdk_missing'));
          return;
        }

        window.FB.init({
          appId: BACKEND_API_CONFIG.facebookAppId,
          cookie: true,
          xfbml: false,
          version: 'v23.0',
        });
        resolve();
      };

      if (window.FB) {
        initFacebook();
        return;
      }

      window.fbAsyncInit = initFacebook;

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-social-sdk="facebook"]',
      );

      if (existingScript) {
        existingScript.addEventListener(
          'error',
          () => reject(new Error('facebook_sdk_load_failed')),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.dataset['socialSdk'] = 'facebook';
      script.addEventListener(
        'error',
        () => reject(new Error('facebook_sdk_load_failed')),
        { once: true },
      );
      document.head.appendChild(script);
    });

    return this.facebookSdkPromise;
  }

  private finishSocialLogin(
    request$: ReturnType<DataService['loginWithGoogle']>,
    fallbackMessage: string,
  ) {
    request$.pipe(finalize(() => this.authSubmitting.set(false))).subscribe({
      next: () => {
        this.toastService.success('Đăng nhập thành công.');
        this.dataService.resumePendingAuthAction();
        this.authModalOpen.set(false);
        this.handlePostAuthRedirect();
      },
      error: (error) => {
        this.authError.set(this.resolveAuthError(error, fallbackMessage));
      },
    });
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private resolveAuthError(error: unknown, fallbackMessage: string): string {
    const apiError = error as {
      error?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };
    const validationMessage = apiError?.error?.errors
      ? Object.values(apiError.error.errors).flat()[0]
      : null;

    if (typeof validationMessage === 'string') {
      return this.translateAuthError(validationMessage);
    }

    if (typeof apiError?.error?.message === 'string') {
      return this.translateAuthError(apiError.error.message);
    }

    return fallbackMessage;
  }

  private translateAuthError(message: string): string {
    const normalizedMessage = message.trim().toLowerCase();

    const exactMessages: Record<string, string> = {
      'the given data was invalid.': 'Dữ liệu không hợp lệ.',
      'the email has already been taken.': 'Email này đã được sử dụng.',
      'the email field is required.': 'Vui lòng nhập email.',
      'the email must be a valid email address.': 'Email không đúng định dạng.',
      'the password field is required.': 'Vui lòng nhập mật khẩu.',
      'the password confirmation does not match.':
        'Mật khẩu xác nhận không khớp.',
      'the name field is required.': 'Vui lòng nhập họ và tên.',
      'invalid credentials': 'Email hoặc mật khẩu không đúng.',
      unauthorized: 'Bạn không có quyền thực hiện thao tác này.',
    };

    if (exactMessages[normalizedMessage]) {
      return exactMessages[normalizedMessage];
    }

    if (normalizedMessage.includes('already been taken')) {
      return 'Thông tin này đã được sử dụng.';
    }

    if (normalizedMessage.includes('must be a valid email address')) {
      return 'Email không đúng định dạng.';
    }

    if (normalizedMessage.includes('field is required')) {
      return 'Vui lòng nhập đầy đủ thông tin bắt buộc.';
    }

    return message;
  }

  private handlePostAuthRedirect() {
    const redirectUrl = this.dataService.consumePostLoginRedirect();

    if (!redirectUrl) {
      return;
    }

    if (redirectUrl.startsWith('/admin') && !this.dataService.hasAdminRole()) {
      this.authError.set('Tài khoản của bạn chưa có quyền vào khu vực admin.');
      return;
    }

    this.router.navigateByUrl(redirectUrl);
  }
}
