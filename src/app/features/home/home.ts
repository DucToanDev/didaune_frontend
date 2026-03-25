import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Category,
  City,
  HomeAreaSummary,
  HomeCategorySummary,
  HomeHero,
  Place,
  Ward,
} from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  public dataService = inject(DataService);
  private router = inject(Router);

  featuredPlaces = signal<Place[]>([]);
  trendingPlaces = signal<Place[]>([]);
  newPlaces = signal<Place[]>([]);
  nearbyPlaces = signal<Place[]>([]);
  recentViewedPlaces = signal<Place[]>([]);
  categories = signal<Category[]>([]);
  cities = signal<City[]>([]);
  wards = signal<Ward[]>([]);
  topCategories = signal<HomeCategorySummary[]>([]);
  demandCategories = signal<HomeCategorySummary[]>([]);
  topAreas = signal<HomeAreaSummary[]>([]);
  selectedHomeCategory = signal('cafe');
  quickMenuExpanded = signal(false);
  hero = signal<HomeHero>({
    province_code: null,
    ward_code: null,
    total_places: 0,
    district_count: 0,
    ward_count: 0,
  });
  wardQuery = signal(this.dataService.currentWardName());
  wardDropdownOpen = signal(false);
  loading = signal(true);

  filteredWards = computed(() => {
    const query = this.wardQuery().trim().toLowerCase();

    if (!query) {
      return this.wards();
    }

    return this.wards().filter((ward) => ward.name.toLowerCase().includes(query));
  });

  homeCategoryOptions = computed(() =>
    this.categories().filter((category) =>
      ['cafe', 'hotel', 'homestay', 'restaurant', 'travel'].includes(category.id)
    )
  );

  collapsedQuickMenuOptions = computed(() => {
    const selectedId = this.selectedHomeCategory();
    return this.homeCategoryOptions().filter((category) => category.id !== selectedId);
  });

  filteredFeaturedPlaces = computed(() =>
    this.filterPlacesByHomeCategory(this.featuredPlaces())
  );

  filteredTrendingPlaces = computed(() =>
    this.filterPlacesByHomeCategory(this.trendingPlaces())
  );

  filteredNearbyPlaces = computed(() =>
    this.filterPlacesByHomeCategory(this.nearbyPlaces())
  );

  filteredRecentViewedPlaces = computed(() =>
    this.filterPlacesByHomeCategory(this.recentViewedPlaces())
  );

  marqueeCategories = computed(() => {
    const categories = this.topCategories();
    return categories.length ? [...categories, ...categories] : [];
  });

  marqueeAreas = computed(() => {
    const areas = this.topAreas();
    return areas.length ? [...areas, ...areas] : [];
  });

  suggestedPlaces = computed(() =>
    this.shufflePlaces(this.filteredFeaturedPlaces().filter((place) => place.rating >= 4)).slice(0, 8),
  );

  displayLocationLabel = computed(() => {
    const city = this.cities().find((item) => item.id === this.dataService.currentCityId());
    return city?.name ?? 'Ho Chi Minh';
  });

  suggestionLocationLabel = computed(() => {
    const wardName = this.dataService.currentWardName().trim();
    return wardName || displayCityLabel(this.displayLocationLabel());
  });

  activeHomeCategory = computed(() => {
    const selectedId = this.selectedHomeCategory();
    return this.homeCategoryOptions().find((category) => category.id === selectedId) ?? null;
  });

  activeHomeCategoryLabel = computed(() => this.activeHomeCategory()?.name ?? 'Ca phe');

  activeHomeCategoryIcon = computed(() => this.activeHomeCategory()?.icon ?? 'fa-mug-hot');

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    this.dataService.getCities().subscribe((data) => this.cities.set(data));
    this.dataService.getCategories().subscribe((data) => this.categories.set(data));
    this.dataService
      .getRecentlyViewedPlaces()
      .subscribe((places) => this.recentViewedPlaces.set(places));
    this.dataService.getWardsByCityId(this.dataService.currentCityId()).subscribe((data) => {
      this.wards.set(data);
      const selectedWard = data.find(
        (ward) => String(ward.code) === this.dataService.currentWardCode(),
      );
      this.wardQuery.set(selectedWard?.name ?? this.dataService.currentWardName());
    });

    this.dataService.getHomeData().subscribe((data) => {
      this.hero.set(data.hero);
      this.featuredPlaces.set(data.featured_places);
      this.trendingPlaces.set(data.trending_places);
      this.newPlaces.set(data.new_places);
      this.nearbyPlaces.set(data.nearby_places);
      this.demandCategories.set(
        data.demand_categories.map((category) => ({
          ...category,
          name: this.getDemandCategoryDisplayName(category.name, category.id),
        })),
      );
      this.topCategories.set(data.top_categories);
      this.topAreas.set(data.top_areas);
      this.loading.set(false);
    });
  }

  onCityChange(event: Event) {
    const cityId = (event.target as HTMLSelectElement).value;

    this.dataService.currentCityId.set(cityId);
    this.dataService.currentDistrictId.set('all');
    this.dataService.currentWardCode.set('');
    this.dataService.currentWardName.set('');
    this.wardQuery.set('');
    this.wardDropdownOpen.set(false);

    this.dataService.getWardsByCityId(cityId).subscribe((data) => this.wards.set(data));
  }

  onWardInput(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim();

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

    this.dataService.currentWardCode.set(matchedWard ? String(matchedWard.code) : '');
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

  openQuickMenu() {
    this.quickMenuExpanded.set(true);
  }

  closeQuickMenu() {
    this.quickMenuExpanded.set(false);
  }

  toggleQuickMenu(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.quickMenuExpanded.update((value) => !value);
  }

  setHomeCategory(categoryId: string) {
    this.selectedHomeCategory.set(categoryId);
    this.quickMenuExpanded.set(false);
  }

  exploreActiveCategory() {
    this.dataService.selectedCategoryId.set(this.selectedHomeCategory());
    this.dataService.searchQuery.set('');
    this.router.navigate(['/discover']);
  }

  onCategoryClick(categoryName: string) {
    this.dataService.selectedCategoryId.set('all');
    this.dataService.searchQuery.set(categoryName);
    this.router.navigate(['/discover']);
  }

  private filterPlacesByHomeCategory(places: Place[]): Place[] {
    const categoryId = this.selectedHomeCategory();
    return places.filter((place) => place.categories.includes(categoryId));
  }

  private shufflePlaces(places: Place[]): Place[] {
    const shuffled = [...places];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }

  getCategoryIcon(categoryName: string): string {
    const normalized = categoryName.toLowerCase();

    if (normalized.includes('cafe') || normalized.includes('ca phe')) {
      return 'fa-mug-hot';
    }

    if (normalized.includes('nha hang') || normalized.includes('restaurant')) {
      return 'fa-utensils';
    }

    if (normalized.includes('bar') || normalized.includes('pub')) {
      return 'fa-martini-glass-citrus';
    }

    if (normalized.includes('tra') || normalized.includes('tea')) {
      return 'fa-leaf';
    }

    if (normalized.includes('banh') || normalized.includes('bakery')) {
      return 'fa-cake-candles';
    }

    if (normalized.includes('check') || normalized.includes('anh') || normalized.includes('art')) {
      return 'fa-camera-retro';
    }

    return 'fa-compass';
  }

  getCategoryTone(index: number): string {
    const tones = [
      'from-orange-400/20 to-amber-300/10 text-orange-600',
      'from-rose-400/20 to-pink-300/10 text-rose-600',
      'from-sky-400/20 to-cyan-300/10 text-sky-600',
      'from-emerald-400/20 to-lime-300/10 text-emerald-600',
      'from-violet-400/20 to-fuchsia-300/10 text-violet-600',
      'from-slate-400/20 to-slate-200/10 text-slate-700',
    ];

    return tones[index % tones.length];
  }

  onAreaClick(areaName: string) {
    this.dataService.currentDistrictId.set('all');
    this.dataService.searchQuery.set(areaName);
    this.router.navigate(['/list']);
  }

  toggleFavorite(event: Event, slug: string) {
    event.preventDefault();
    event.stopPropagation();
    this.dataService.toggleFavorite(slug);
  }

  getSuggestedHours(place: Place): string | null {
    const firstHour = place.hours.find((hour) => hour.times.length > 0);

    if (!firstHour) {
      return null;
    }

    return firstHour.times[0] ?? null;
  }

  hasSuggestedHours(place: Place): boolean {
    return Boolean(this.getSuggestedHours(place));
  }

  formatDistanceKm(place: Place): string {
    const distanceKm = this.resolveDistanceKm(place);

    if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) {
      return 'Gan ban';
    }

    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }

    return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`;
  }

  private resolveDistanceKm(place: Place): number | null {
    if (typeof place.distance_km === 'number' && !Number.isNaN(place.distance_km)) {
      return place.distance_km;
    }

    const coordinates = this.dataService.currentCoordinates();

    if (
      !coordinates ||
      typeof place.latitude !== 'number' ||
      Number.isNaN(place.latitude) ||
      typeof place.longitude !== 'number' ||
      Number.isNaN(place.longitude)
    ) {
      return null;
    }

    return this.calculateDistanceKm(
      coordinates.lat,
      coordinates.lng,
      place.latitude,
      place.longitude,
    );
  }

  private calculateDistanceKm(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(toLat - fromLat);
    const dLng = this.toRadians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(fromLat)) *
      Math.cos(this.toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private getDemandCategoryDisplayName(name: string, id?: string): string {
    const normalized = (id || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes('cafe') || normalized.includes('ca phe')) {
      return 'Quán cà phê';
    }

    if (normalized.includes('hen ho') || normalized.includes('date')) {
      return 'Hẹn hò';
    }

    if (normalized.includes('tu tap') || normalized.includes('group')) {
      return 'Tụ tập';
    }

    if (normalized.includes('lam viec') || normalized.includes('work')) {
      return 'Làm việc';
    }

    if (normalized.includes('song ao') || normalized.includes('photo')) {
      return 'Sống ảo';
    }

    if (normalized.includes('food') || normalized.includes('an uong')) {
      return 'Ăn uống';
    }

    if (normalized.includes('view')) {
      return 'View đẹp';
    }

    if (normalized.includes('quiet') || normalized.includes('yen tinh')) {
      return 'Yên tĩnh';
    }

    return name;
  }
}

function displayCityLabel(cityName: string): string {
  if (!cityName.trim()) {
    return 'TP. Hồ Chí Minh';
  }

  if (
    cityName.toLowerCase().includes('ho chi minh') ||
    cityName.toLowerCase().includes('ho-chi-minh')
  ) {
    return 'TP. Hồ Chí Minh';
  }

  if (cityName.toLowerCase().includes('ha noi') || cityName.toLowerCase().includes('ha-noi')) {
    return 'TP. Hà Nội';
  }

  return cityName;
}





