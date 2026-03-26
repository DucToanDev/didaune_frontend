import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { City, Place, Ward } from '../../../core/models/app.models';
import { DataService } from '../../../core/services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  public dataService = inject(DataService);
  private router = inject(Router);

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
  places = signal<Place[]>([]);
  recentViewedPlaces = signal<Place[]>([]);
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
    const cityPlaces = this.places()
      .filter((place) => place.city_id === this.dataService.currentCityId())
      .sort(
        (first, second) =>
          second.review_count - first.review_count || second.rating - first.rating,
      );

    if (query) {
      const recentMatches = recent.filter((place) =>
        this.matchesPlaceQuery(place, query),
      );
      const cityMatches = cityPlaces.filter(
        (place) =>
          !recentSlugs.has(place.slug) && this.matchesPlaceQuery(place, query),
      );

      return [...recentMatches, ...cityMatches].slice(0, 10);
    }

    if (recent.length) {
      const fallback = cityPlaces.filter((place) => !recentSlugs.has(place.slug));
      return [...recent.slice(0, 5), ...fallback.slice(0, 5)].slice(0, 10);
    }

    return cityPlaces.slice(0, 10);
  });
  searchSuggestionTitle = computed(() => {
    const query = this.dataService.searchQuery().trim();
    const city =
      this.cities().find((item) => item.id === this.dataService.currentCityId())
        ?.name ?? 'Hồ Chí Minh';

    if (query) {
      return `Gợi ý cho "${query}"`;
    }

    return this.recentViewedPlaces().length
      ? ''
      : `Top quán tại ${city}`;
  });

  ngOnInit() {
    this.wardQuery.set(this.dataService.currentWardName());
    this.dataService.getCities().subscribe((data) => this.cities.set(data));
    this.loadWards(this.dataService.currentCityId());
    this.dataService.getPlaces().subscribe((places) => this.places.set(places));
    this.dataService
      .getRecentlyViewedPlaces(5)
      .subscribe((places) => this.recentViewedPlaces.set(places));
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
    this.router.navigate(['/list']);
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

    if (mode === 'register' && !name) {
      this.authError.set('Vui lòng nhập họ và tên.');
      return;
    }

    if (!email) {
      this.authError.set('Vui long nhap email.');
      return;
    }

    if (!password) {
      this.authError.set('Vui long nhap mat khau.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      this.authError.set('Mat khau xac nhan khong khop.');
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
        this.authModalOpen.set(false);
      },
      error: (error) => {
        const apiMessage =
          error?.error?.message ||
          (typeof error?.error?.errors === 'object'
            ? Object.values(error.error.errors).flat()[0]
            : null);

        this.authError.set(
          typeof apiMessage === 'string'
            ? apiMessage
            : mode === 'login'
              ? 'Dang nhap that bai. Vui long kiem tra lai thong tin.'
              : 'Dang ky that bai. Vui long thu lai.',
        );
      },
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
}
