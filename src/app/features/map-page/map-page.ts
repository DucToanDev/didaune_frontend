import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Place } from '../../core/models/app.models';
import { CATEGORY_CONFIG } from '../../core/config/place-taxonomy.config';
import { DataService } from '../../core/services/data.service';
import { calculateDistanceKm } from '../../core/utils/geo.utils';

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  fitBounds(
    bounds: [[number, number], [number, number]],
    options?: { padding?: [number, number] },
  ): LeafletMap;
  getZoom(): number;
  on(event: string, handler: () => void): LeafletMap;
  remove(): void;
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(content: string): LeafletMarker;
  bindTooltip(
    content: string,
    options?: {
      direction?: string;
      offset?: [number, number];
      opacity?: number;
      sticky?: boolean;
    },
  ): LeafletMarker;
  remove(): void;
  on(event: string, handler: () => void): LeafletMarker;
}

interface LeafletIcon {
  options?: {
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    tooltipAnchor?: [number, number];
  };
}

interface LeafletCircle {
  addTo(map: LeafletMap): LeafletCircle;
  remove(): void;
  setRadius(radius: number): LeafletCircle;
  setStyle(style: { opacity?: number; fillOpacity?: number }): LeafletCircle;
}

interface LeafletTileLayer {
  addTo(map: LeafletMap): LeafletTileLayer;
}

interface LeafletNamespace {
  map(element: HTMLElement, options?: { zoomControl?: boolean }): LeafletMap;
  tileLayer(
    urlTemplate: string,
    options?: { attribution?: string; maxZoom?: number },
  ): LeafletTileLayer;
  marker(
    latLng: [number, number],
    options?: { icon?: LeafletIcon },
  ): LeafletMarker;
  divIcon(options?: {
    className?: string;
    html?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
    popupAnchor?: [number, number];
    tooltipAnchor?: [number, number];
  }): LeafletIcon;
  circle(
    latLng: [number, number],
    options?: {
      radius?: number;
      color?: string;
      weight?: number;
      opacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      dashArray?: string;
    },
  ): LeafletCircle;
}

type PaginationItem = number | 'ellipsis';

interface NearbyCategorySummary {
  id: string;
  name: string;
  count: number;
}

interface MapMarkerCluster {
  type: 'single' | 'cluster';
  lat: number;
  lng: number;
  category: string | null;
  places: Place[];
}

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
})
export class MapPage implements AfterViewInit {
  private readonly pageSize = 12;
  private readonly nearbyRadiusKm = 5;
  private readonly nearbyRadiusMeters = 5000;
  private readonly markerClusterMaxZoom = 13;
  private readonly markerCategoryPriority = [
    'cafe',
    'restaurant',
    'hotel',
    'homestay',
    'travel',
    'date',
    'group',
    'work',
    'photo',
  ];
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  public dataService = inject(DataService);

  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  places = signal<Place[]>([]);
  selectedPlace = signal<Place | null>(null);
  currentPage = signal(1);
  selectedNearbyCategory = signal('all');
  mapSearchQuery = signal('');
  selectedMapCategory = signal('all');
  mapFilterOpen = signal(false);
  locating = signal(false);
  currentMapZoom = signal(12);
  private leafletReady = signal(false);
  private map?: LeafletMap;
  private markers: LeafletMarker[] = [];
  private userRadiusCircle?: LeafletCircle;
  private userScanCircle?: LeafletCircle;
  private scanTimer?: ReturnType<typeof setInterval>;

  filteredPlaces = computed(() => {
    const cityId = this.dataService.currentCityId();
    const wardCode = this.dataService.currentWardCode().trim();
    const wardName = this.dataService.currentWardName().trim().toLowerCase();
    return this.places().filter((place) => {
      const matchCity = place.city_id === cityId;
      const matchWard =
        !wardName ||
        !!wardCode ||
        place.ward_name.toLowerCase().includes(wardName);

      return matchCity && matchWard;
    });
  });

  placesWithinRadius = computed(() => {
    const coordinates = this.dataService.currentCoordinates();

    if (
      !coordinates ||
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng)
    ) {
      return this.filteredPlaces();
    }

    return this.places().filter((place) => {
      if (
        typeof place.latitude !== 'number' ||
        typeof place.longitude !== 'number' ||
        !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude)
      ) {
        return false;
      }

      const distanceKm = calculateDistanceKm(
        coordinates.lat,
        coordinates.lng,
        place.latitude,
        place.longitude,
      );

      return Number.isFinite(distanceKm) && distanceKm <= this.nearbyRadiusKm;
    });
  });

  filteredByNearbyCategory = computed(() => {
    const selectedCategory = this.selectedNearbyCategory();

    if (selectedCategory === 'all') {
      return this.placesWithinRadius();
    }

    return this.placesWithinRadius().filter((place) =>
      place.categories.includes(selectedCategory),
    );
  });

  mapCategories = CATEGORY_CONFIG.filter((category) =>
    this.markerCategoryPriority.includes(category.id),
  );

  filteredMapPlaces = computed(() => {
    const categoryId = this.selectedMapCategory();
    const search = this.mapSearchQuery().trim().toLowerCase();

    return this.filteredByNearbyCategory().filter((place) => {
      const matchCategory =
        categoryId === 'all' || place.categories.includes(categoryId);

      if (!matchCategory) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchTarget = [
        place.name,
        place.address,
        place.district_name,
        place.city_name,
        ...place.category_labels,
      ]
        .join(' ')
        .toLowerCase();

      return searchTarget.includes(search);
    });
  });

  geocodedPlaces = computed(() =>
    this.filteredMapPlaces().filter(
      (place) => place.latitude !== undefined && place.longitude !== undefined,
    ),
  );

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredMapPlaces().length / this.pageSize)),
  );

  paginatedPlaces = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredMapPlaces().slice(start, start + this.pageSize);
  });

  paginatedGeocodedPlaces = computed(() =>
    this.paginatedPlaces().filter(
      (place) => place.latitude !== undefined && place.longitude !== undefined,
    ),
  );

  nearbyCategorySummaries = computed<NearbyCategorySummary[]>(() => {
    const coordinates = this.dataService.currentCoordinates();

    if (!coordinates) {
      return [];
    }

    if (
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng)
    ) {
      return [];
    }

    const primaryCategoryIds = [
      'cafe',
      'hotel',
      'homestay',
      'restaurant',
      'travel',
    ];
    const counter = new Map<string, number>();

    for (const place of this.placesWithinRadius()) {
      if (
        typeof place.latitude !== 'number' ||
        typeof place.longitude !== 'number' ||
        !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude)
      ) {
        continue;
      }

      const distanceKm = calculateDistanceKm(
        coordinates.lat,
        coordinates.lng,
        place.latitude,
        place.longitude,
      );

      if (!Number.isFinite(distanceKm) || distanceKm > this.nearbyRadiusKm) {
        continue;
      }

      const matched = place.categories.filter((categoryId) =>
        primaryCategoryIds.includes(categoryId),
      );

      const uniqueMatched = [...new Set(matched)];

      for (const categoryId of uniqueMatched) {
        counter.set(categoryId, (counter.get(categoryId) ?? 0) + 1);
      }
    }

    return [...counter.entries()]
      .map(([id, count]) => ({
        id,
        name: this.dataService.getCategoryLabel(id),
        count,
      }))
      .sort((first, second) => second.count - first.count);
  });

  paginationItems = computed<PaginationItem[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    if (current <= 3) {
      return [1, 2, 3, 4, 'ellipsis', total];
    }

    if (current >= total - 2) {
      return [1, 'ellipsis', total - 3, total - 2, total - 1, total];
    }

    return [
      1,
      'ellipsis',
      current - 1,
      current,
      current + 1,
      'ellipsis',
      total,
    ];
  });

  constructor() {
    this.dataService.getPlaces().subscribe((places) => this.places.set(places));

    effect(() => {
      if (!this.leafletReady()) {
        return;
      }

      const places = this.geocodedPlaces();
      untracked(() => this.renderMarkers(places, true));
    });

    effect(() => {
      if (!this.leafletReady()) {
        return;
      }

      this.renderNearbyRadiusScan();
    });

    effect(() => {
      const totalPages = this.totalPages();
      const currentPage = this.currentPage();

      if (currentPage > totalPages) {
        this.currentPage.set(1);
      }
    });

    effect(() => {
      this.mapSearchQuery();
      this.selectedMapCategory();
      this.currentPage.set(1);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.ensureLeafletLoaded();

    const leaflet = window.L;
    const container = this.mapContainer?.nativeElement;

    if (!leaflet || !container) {
      return;
    }

    this.map = leaflet
      .map(container, { zoomControl: true })
      .setView([10.7769, 106.7009], 12);
    this.currentMapZoom.set(this.map.getZoom());
    this.map.on('zoomend', () => {
      this.currentMapZoom.set(this.map?.getZoom() ?? 12);
      this.renderMarkers(this.geocodedPlaces(), false);
    });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);

    this.leafletReady.set(true);
    this.tryAutoLocateIfPermissionGranted();

    this.destroyRef.onDestroy(() => {
      this.clearMarkers();
      this.clearNearbyRadiusScan();
      this.map?.remove();
      this.map = undefined;
    });
  }

  openPlace(place: Place) {
    this.router.navigate(['/detail', place.slug]);
  }

  selectPlace(place: Place) {
    this.selectedPlace.set(place);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.currentPage.set(page);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage() - 1);
  }

  setNearbyCategory(categoryId: string) {
    this.selectedNearbyCategory.set(categoryId);
    this.currentPage.set(1);
  }

  updateMapSearchQuery(value: string) {
    this.mapSearchQuery.set(value);
  }

  toggleMapFilter() {
    this.mapFilterOpen.update((open) => !open);
  }

  setMapCategory(categoryId: string) {
    this.selectedMapCategory.set(categoryId);
    this.mapFilterOpen.set(false);
  }

  private renderMarkers(places: Place[], fitToBounds: boolean) {
    if (!this.map || !window.L) {
      return;
    }

    this.clearMarkers();

    if (!places.length) {
      this.selectedPlace.set(null);
      return;
    }

    const selected = untracked(() => this.selectedPlace());
    if (selected && !places.some((place) => place.slug === selected.slug)) {
      this.selectedPlace.set(null);
    }

    const bounds: [number, number][] = [];
    const markerClusters = this.buildMarkerClusters(places);

    this.markers = markerClusters.map((cluster) => {
      bounds.push([cluster.lat, cluster.lng]);

      if (cluster.type === 'cluster') {
        return window
          .L!.marker([cluster.lat, cluster.lng], {
            icon: this.buildClusterMarkerIcon(cluster),
          })
          .addTo(this.map!)
          .bindTooltip(
            `${this.escapeHtml(
              this.dataService.getCategoryLabel(cluster.category ?? 'all'),
            )}: ${cluster.places.length} địa điểm`,
            {
              direction: 'top',
              offset: [0, -14],
              opacity: 0.95,
              sticky: true,
            },
          )
          .on('click', () => {
            this.selectedPlace.set(cluster.places[0] ?? null);
            this.map?.setView(
              [cluster.lat, cluster.lng],
              Math.min(this.currentMapZoom() + 2, 16),
            );
          });
      }

      const place = cluster.places[0];
      const markerIcon = this.buildMarkerIcon(place);

      return window
        .L!.marker([cluster.lat, cluster.lng], { icon: markerIcon })
        .addTo(this.map!)
        .bindTooltip(this.escapeHtml(place.name), {
          direction: 'top',
          offset: [0, -14],
          opacity: 0.95,
          sticky: true,
        })
        .on('click', () => this.selectPlace(place));
    });

    if (bounds.length === 1) {
      if (fitToBounds) {
        this.map.setView(bounds[0], 15);
      }
      return;
    }

    if (!fitToBounds) {
      return;
    }

    const latitudes = bounds.map((point) => point[0]);
    const longitudes = bounds.map((point) => point[1]);
    this.map.fitBounds(
      [
        [Math.min(...latitudes), Math.min(...longitudes)],
        [Math.max(...latitudes), Math.max(...longitudes)],
      ],
      { padding: [32, 32] },
    );
  }

  requestCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    this.locating.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.dataService.setCurrentCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        this.locating.set(false);
      },
      () => {
        this.dataService.setCurrentCoordinates(null);
        this.locating.set(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  get nearbyTotalPlaces(): number {
    return this.nearbyCategorySummaries().reduce(
      (total, category) => total + category.count,
      0,
    );
  }

  get filteredTotalPlaces(): number {
    return this.filteredMapPlaces().length;
  }

  get pageFrom(): number {
    if (!this.filteredTotalPlaces) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get pageTo(): number {
    if (!this.filteredTotalPlaces) {
      return 0;
    }

    return Math.min(
      this.currentPage() * this.pageSize,
      this.filteredTotalPlaces,
    );
  }

  private clearMarkers() {
    for (const marker of this.markers) {
      marker.remove();
    }

    this.markers = [];
  }

  private buildMarkerIcon(place: Place): LeafletIcon {
    const category = this.getMarkerCategory(place);
    const config = CATEGORY_CONFIG.find((item) => item.id === category);
    const iconClass = config?.icon ?? 'fa-location-dot';
    const categoryLabel =
      config?.name ?? place.category_labels[0] ?? 'Địa điểm';
    const markerClass = category
      ? `marker-${this.escapeHtml(category)}`
      : 'marker-default';

    return window.L!.divIcon({
      className: 'map-place-marker-wrapper',
      html: `
        <div class="map-place-marker ${markerClass}" aria-label="${this.escapeHtml(categoryLabel)}">
          <span class="map-place-marker__icon">
            <i class="fa-solid ${this.escapeHtml(iconClass)}" aria-hidden="true"></i>
          </span>
        </div>
      `,
      iconSize: [38, 50],
      iconAnchor: [19, 50],
      popupAnchor: [0, -42],
      tooltipAnchor: [0, -40],
    });
  }

  private getMarkerCategory(place: Place): string | null {
    for (const categoryId of this.markerCategoryPriority) {
      if (place.categories.includes(categoryId)) {
        return categoryId;
      }
    }

    return place.categories[0] ?? null;
  }

  private buildClusterMarkerIcon(cluster: MapMarkerCluster): LeafletIcon {
    const visual = this.getMarkerVisualConfig(
      cluster.category,
      cluster.places[0]?.category_labels[0],
    );

    return window.L!.divIcon({
      className: 'map-place-marker-wrapper',
      html: `
        <div class="map-place-marker map-place-marker--cluster ${visual.markerClass}" aria-label="${this.escapeHtml(visual.label)}">
          <span class="map-place-marker__icon">
            <i class="fa-solid ${this.escapeHtml(visual.iconClass)}" aria-hidden="true"></i>
          </span>
          <span class="map-place-marker__count">${cluster.places.length}</span>
        </div>
      `,
      iconSize: [52, 64],
      iconAnchor: [26, 64],
      popupAnchor: [0, -42],
      tooltipAnchor: [0, -48],
    });
  }

  private getMarkerVisualConfig(category: string | null, fallbackLabel?: string) {
    const config = CATEGORY_CONFIG.find((item) => item.id === category);

    return {
      iconClass: config?.icon ?? 'fa-location-dot',
      markerClass: category
        ? `marker-${this.escapeHtml(category)}`
        : 'marker-default',
      label: config?.name ?? fallbackLabel ?? 'Địa điểm',
    };
  }

  private buildMarkerClusters(places: Place[]): MapMarkerCluster[] {
    if (this.currentMapZoom() > this.markerClusterMaxZoom) {
      return places.map((place) => ({
        type: 'single' as const,
        lat: place.latitude as number,
        lng: place.longitude as number,
        category: this.getMarkerCategory(place),
        places: [place],
      }));
    }

    const cellSize = this.getClusterCellSize(this.currentMapZoom());
    const clusterMap = new Map<string, Place[]>();

    for (const place of places) {
      const category = this.getMarkerCategory(place) ?? 'default';
      const latBucket = Math.round((place.latitude as number) / cellSize);
      const lngBucket = Math.round((place.longitude as number) / cellSize);
      const key = `${category}:${latBucket}:${lngBucket}`;
      const bucket = clusterMap.get(key) ?? [];
      bucket.push(place);
      clusterMap.set(key, bucket);
    }

    return [...clusterMap.values()].map((bucket) => {
      const lat =
        bucket.reduce((sum, place) => sum + (place.latitude as number), 0) /
        bucket.length;
      const lng =
        bucket.reduce((sum, place) => sum + (place.longitude as number), 0) /
        bucket.length;

      return {
        type: bucket.length > 1 ? ('cluster' as const) : ('single' as const),
        lat,
        lng,
        category: this.getMarkerCategory(bucket[0]),
        places: bucket,
      };
    });
  }

  private getClusterCellSize(zoom: number): number {
    if (zoom <= 9) {
      return 0.12;
    }

    if (zoom === 10) {
      return 0.08;
    }

    if (zoom === 11) {
      return 0.045;
    }

    if (zoom === 12) {
      return 0.025;
    }

    return 0.015;
  }

  private renderNearbyRadiusScan() {
    if (!this.map || !window.L) {
      return;
    }

    this.clearNearbyRadiusScan();

    const coordinates = this.dataService.currentCoordinates();

    if (
      !coordinates ||
      !Number.isFinite(coordinates.lat) ||
      !Number.isFinite(coordinates.lng)
    ) {
      return;
    }

    const center: [number, number] = [coordinates.lat, coordinates.lng];

    this.userRadiusCircle = window.L.circle(center, {
      radius: this.nearbyRadiusMeters,
      color: '#0ea5e9',
      weight: 2,
      opacity: 0.55,
      fillColor: '#0ea5e9',
      fillOpacity: 0.1,
    }).addTo(this.map);

    this.userScanCircle = window.L.circle(center, {
      radius: 250,
      color: '#22d3ee',
      weight: 2,
      opacity: 0.9,
      fillColor: '#22d3ee',
      fillOpacity: 0.12,
      dashArray: '6 6',
    }).addTo(this.map);

    this.map.setView(center, 13);

    let radius = 250;
    this.scanTimer = setInterval(() => {
      if (!this.userScanCircle) {
        return;
      }

      radius += 180;

      if (radius > this.nearbyRadiusMeters) {
        radius = 250;
      }

      const progress = radius / this.nearbyRadiusMeters;
      const opacity = Math.max(0.15, 0.95 - progress * 0.8);
      const fillOpacity = Math.max(0.03, 0.18 - progress * 0.14);

      this.userScanCircle.setRadius(radius);
      this.userScanCircle.setStyle({
        opacity,
        fillOpacity,
      });
    }, 80);
  }

  private clearNearbyRadiusScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = undefined;
    }

    this.userRadiusCircle?.remove();
    this.userRadiusCircle = undefined;

    this.userScanCircle?.remove();
    this.userScanCircle = undefined;
  }

  private buildPopup(place: Place): string {
    const image = place.image;
    const categories = place.category_labels.slice(0, 2).join(' · ');

    return `
      <div style="width: 220px; font-family: Arial, sans-serif;">
        <img src="${image}" alt="${this.escapeHtml(place.name)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 14px;" />
        <div style="padding-top: 10px;">
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.35;">
            ${this.escapeHtml(place.name)}
          </div>
          <div style="margin-top: 4px; font-size: 13px; color: #64748b; line-height: 1.45;">
            ${this.escapeHtml(place.address)}
          </div>
          <div style="margin-top: 8px; font-size: 13px; font-weight: 600; color: #ea580c;">
            ${place.rating.toFixed(1)} ★
          </div>
          <div style="margin-top: 6px; font-size: 12px; color: #475569;">
            ${this.escapeHtml(categories || place.city_name)}
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async tryAutoLocateIfPermissionGranted() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const permissionsApi = navigator.permissions;

    if (!permissionsApi?.query) {
      return;
    }

    try {
      const status = await permissionsApi.query({
        name: 'geolocation' as PermissionName,
      });

      if (status.state === 'granted') {
        this.requestCurrentLocation();
      }
    } catch {
      // Ignore permission API failures and keep manual location button as fallback.
    }
  }





  private async ensureLeafletLoaded(): Promise<void> {
    if (window.L) {
      return;
    }

    this.ensureLeafletStyles();

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-leaflet-script="true"]',
      );

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Leaflet failed to load.')),
          {
            once: true,
          },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.dataset['leafletScript'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Leaflet failed to load.'));
      document.body.appendChild(script);
    });
  }

  private ensureLeafletStyles() {
    const existing = document.querySelector('link[data-leaflet-style="true"]');

    if (existing) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.dataset['leafletStyle'] = 'true';
    document.head.appendChild(link);
  }
}
