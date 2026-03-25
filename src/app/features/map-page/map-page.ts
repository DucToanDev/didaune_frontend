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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap;
  fitBounds(bounds: [[number, number], [number, number]], options?: { padding?: [number, number] }): LeafletMap;
  remove(): void;
}

interface LeafletMarker {
  addTo(map: LeafletMap): LeafletMarker;
  bindPopup(content: string): LeafletMarker;
  bindTooltip(
    content: string,
    options?: { direction?: string; offset?: [number, number]; opacity?: number; sticky?: boolean }
  ): LeafletMarker;
  remove(): void;
  on(event: string, handler: () => void): LeafletMarker;
}

interface LeafletTileLayer {
  addTo(map: LeafletMap): LeafletTileLayer;
}

interface LeafletNamespace {
  map(element: HTMLElement, options?: { zoomControl?: boolean }): LeafletMap;
  tileLayer(
    urlTemplate: string,
    options?: { attribution?: string; maxZoom?: number }
  ): LeafletTileLayer;
  marker(latLng: [number, number]): LeafletMarker;
}

type PaginationItem = number | 'ellipsis';

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
})
export class MapPage implements AfterViewInit {
  private readonly pageSize = 12;
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  public dataService = inject(DataService);

  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  places = signal<Place[]>([]);
  selectedPlace = signal<Place | null>(null);
  currentPage = signal(1);
  private leafletReady = signal(false);
  private map?: LeafletMap;
  private markers: LeafletMarker[] = [];

  filteredPlaces = computed(() => {
    const cityId = this.dataService.currentCityId();
    const wardCode = this.dataService.currentWardCode().trim();
    const wardName = this.dataService.currentWardName().trim().toLowerCase();
    const query = this.dataService.searchQuery().trim().toLowerCase();
    return this.places().filter((place) => {
      const matchCity = place.city_id === cityId;
      const matchWard =
        !wardName || !!wardCode || place.ward_name.toLowerCase().includes(wardName);
      const searchable = [
        place.name,
        place.address,
        place.description,
        place.district_name,
        ...place.category_labels,
      ]
        .join(' ')
        .toLowerCase();
      const matchQuery = !query || searchable.includes(query);

      return matchCity && matchWard && matchQuery;
    });
  });

  geocodedPlaces = computed(() =>
    this.filteredPlaces().filter(
      (place) => place.latitude !== undefined && place.longitude !== undefined
    )
  );

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPlaces().length / this.pageSize))
  );

  paginatedPlaces = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredPlaces().slice(start, start + this.pageSize);
  });

  paginatedGeocodedPlaces = computed(() =>
    this.paginatedPlaces().filter(
      (place) => place.latitude !== undefined && place.longitude !== undefined
    )
  );

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

    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  });

  constructor() {
    this.dataService.getPlaces().subscribe((places) => this.places.set(places));

    effect(() => {
      if (!this.leafletReady()) {
        return;
      }

      this.renderMarkers(this.paginatedGeocodedPlaces());
    });

    effect(() => {
      const totalPages = this.totalPages();
      const currentPage = this.currentPage();

      if (currentPage > totalPages) {
        this.currentPage.set(1);
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    await this.ensureLeafletLoaded();

    const leaflet = window.L;
    const container = this.mapContainer?.nativeElement;

    if (!leaflet || !container) {
      return;
    }

    this.map = leaflet.map(container, { zoomControl: true }).setView([10.7769, 106.7009], 12);

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);

    this.leafletReady.set(true);

    this.destroyRef.onDestroy(() => {
      this.clearMarkers();
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

  private renderMarkers(places: Place[]) {
    if (!this.map || !window.L) {
      return;
    }

    this.clearMarkers();

    if (!places.length) {
      this.selectedPlace.set(null);
      this.map.setView([10.7769, 106.7009], 12);
      return;
    }

    if (!this.selectedPlace()) {
      this.selectedPlace.set(places[0]);
    }

    const bounds: [number, number][] = [];

    this.markers = places.map((place) => {
      const lat = place.latitude as number;
      const lng = place.longitude as number;
      bounds.push([lat, lng]);

      const marker = window.L!.marker([lat, lng])
        .addTo(this.map!)
        .bindTooltip(this.escapeHtml(place.name), {
          direction: 'top',
          offset: [0, -14],
          opacity: 0.95,
          sticky: true,
        })
        .bindPopup(this.buildPopup(place))
        .on('click', () => this.selectPlace(place));

      return marker;
    });

    if (bounds.length === 1) {
      this.map.setView(bounds[0], 15);
      return;
    }

    const latitudes = bounds.map((point) => point[0]);
    const longitudes = bounds.map((point) => point[1]);
    this.map.fitBounds(
      [
        [Math.min(...latitudes), Math.min(...longitudes)],
        [Math.max(...latitudes), Math.max(...longitudes)],
      ],
      { padding: [32, 32] }
    );
  }

  private clearMarkers() {
    for (const marker of this.markers) {
      marker.remove();
    }

    this.markers = [];
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

  private async ensureLeafletLoaded(): Promise<void> {
    if (window.L) {
      return;
    }

    this.ensureLeafletStyles();

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-leaflet-script="true"]');

      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Leaflet failed to load.')), {
          once: true,
        });
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
