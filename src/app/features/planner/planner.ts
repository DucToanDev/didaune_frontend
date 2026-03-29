import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import flatpickr from 'flatpickr';
import type { Instance as FlatpickrInstance } from 'flatpickr/dist/types/instance';
import { Vietnamese } from 'flatpickr/dist/l10n/vn';
import { Place } from '../../core/models/app.models';
import { ItineraryApiService } from '../../core/services/itinerary-api.service';
import { LocationApiService } from '../../core/services/location-api.service';
import { DataService } from '../../core/services/data.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';

type StopCategory = 'food' | 'sightseeing' | 'hotel' | 'shopping';

interface PlannerStop {
  id: string;
  name: string;
  district: string;
  image: string;
  startTime: string;
  endTime: string;
  note: string;
  category: StopCategory;
  cost: number;
  dayNumber: number;
  latitude?: number;
  longitude?: number;
  placeSlug?: string;
}

interface PlannerMember {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
}

interface GroupedPlannerDay {
  dayNumber: number;
  label: string;
  stops: Array<{
    stop: PlannerStop;
    globalIndex: number;
    travelMinutesFromPrevious: number | null;
    travelDistanceKmFromPrevious: number | null;
  }>;
}

const CATEGORY_META: Record<StopCategory, { icon: string; label: string; color: string }> = {
  food: { icon: '🍜', label: 'Ăn uống', color: 'bg-orange-50 text-orange-600' },
  sightseeing: { icon: '🏖️', label: 'Tham quan', color: 'bg-sky-50 text-sky-600' },
  hotel: { icon: '🏨', label: 'Nghỉ ngơi', color: 'bg-violet-50 text-violet-600' },
  shopping: { icon: '🛍️', label: 'Mua sắm', color: 'bg-pink-50 text-pink-600' },
};

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './planner.html',
  styleUrl: './planner.css',
})
export class Planner implements AfterViewInit, OnDestroy {
  @ViewChild('dateRangeInput') private dateRangeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('timePickerInput') private timePickerInput?: ElementRef<HTMLInputElement>;

  private locationApi = inject(LocationApiService);
  private dataService = inject(DataService);
  private itineraryApi = inject(ItineraryApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private datePicker: FlatpickrInstance | null = null;
  private timePicker: FlatpickrInstance | null = null;
  private activeTimeTarget: { stopId: string; field: 'start' | 'end' } | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  readonly categoryMeta = CATEGORY_META;
  readonly categoryKeys: StopCategory[] = ['food', 'sightseeing', 'hotel', 'shopping'];
  readonly itineraryId = signal<number | null>(null);
  readonly isCreateMode = computed(() => this.itineraryId() === null);
  readonly pageHeading = computed(() => (this.isCreateMode() ? 'Tao lich trinh' : 'Chinh sua chuyen di'));
  readonly saveLabel = computed(() => (this.isCreateMode() ? 'Tao chuyen di' : 'Luu chuyen di'));
  loadingItinerary = signal(false);
  saving = signal(false);

  tripTitle = signal('Chuyến đi cuối tuần');
  tripDescription = signal('Hẹn hò nhẹ nhàng, thêm vài điểm chill và một bữa brunch đẹp.');
  coverPreviewUrl = signal('');
  inviteModalOpen = signal(false);
  inviteEmail = signal('');

  // ── Date ──
  startDate = signal('');
  endDate = signal('');

  tripDays = computed(() => {
    const s = this.startDate();
    const e = this.endDate();
    if (!s || !e) return 0;
    const diff = new Date(e).getTime() - new Date(s).getTime();
    return diff > 0 ? Math.ceil(diff / 86_400_000) + 1 : 0;
  });

  dateRangeLabel = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (!start && !end) return 'Chon khoang ngay cho chuyen di';
    if (start && !end) return this.formatDisplayDate(start);
    return `${this.formatDisplayDate(start)} - ${this.formatDisplayDate(end)}`;
  });

  availableDays = computed(() => {
    const days = Math.max(this.tripDays(), 1);
    return Array.from({ length: days }, (_, index) => index + 1);
  });

  groupedDays = computed<GroupedPlannerDay[]>(() => {
    const grouped = new Map<number, GroupedPlannerDay>();

    this.availableDays().forEach((dayNumber) => {
      grouped.set(dayNumber, {
        dayNumber,
        label: `Ngay ${dayNumber}`,
        stops: [],
      });
    });

    this.stops().forEach((stop, globalIndex) => {
      const normalizedDay = Math.min(Math.max(stop.dayNumber || 1, 1), this.availableDays().length);
      const day = grouped.get(normalizedDay);
      if (!day) return;

      const previousStop = day.stops.at(-1)?.stop ?? null;
      day.stops.push({
        stop: { ...stop, dayNumber: normalizedDay },
        globalIndex,
        travelMinutesFromPrevious: previousStop ? this.estimateTravelMinutes(previousStop, stop) : null,
        travelDistanceKmFromPrevious: previousStop ? this.estimateDistanceKm(previousStop, stop) : null,
      });
    });

    return Array.from(grouped.values()).filter((day) => day.stops.length > 0);
  });

  // ── Cost ──
  totalCost = computed(() =>
    this.stops().reduce((sum, stop) => sum + (stop.cost || 0), 0),
  );

  // ── Undo ──
  deletedStop = signal<{ stop: PlannerStop; index: number } | null>(null);
  showUndoToast = signal(false);
  private undoTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Drag & Drop ──
  dragIndex = signal<number | null>(null);

  // ── Save validation ──
  showTitleWarning = signal(false);

  // ── Search Place Modal ──
  searchModalOpen = signal(false);
  searchQuery = signal('');
  searchResults = signal<Place[]>([]);
  searchLoading = signal(false);
  private searchSubject = new Subject<string>();

  // ── Nearby & Trending ──
  nearbyPlaces = signal<Place[]>([]);
  nearbyLoading = signal(false);
  trendingPlaces = signal<Place[]>([]);
  trendingLoading = signal(false);
  locationDenied = signal(false);

  members = signal<PlannerMember[]>([
    {
      id: 'owner',
      name: 'Toàn',
      avatar: 'https://ui-avatars.com/api/?name=Toan&background=f97316&color=fff',
      isOnline: true,
    },
  ]);

  stops = signal<PlannerStop[]>([
    {
      id: '1',
      name: 'The Hidden Oasis',
      district: 'Quận 12, TP.HCM',
      image:
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=300',
      startTime: '08:30',
      endTime: '10:00',
      note: '',
      category: 'food',
      cost: 0,
      dayNumber: 1,
    },
  ]);

  constructor() {
    const routeId = this.route.snapshot.paramMap.get('id');
    this.itineraryId.set(routeId ? Number(routeId) : null);

    this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query.trim()) {
            return of([]);
          }
          this.searchLoading.set(true);
          return this.locationApi
            .fetchLocationsPaginated({
              cityId: this.dataService.currentCityId(),
              search: query,
              perPage: 10,
            })
            .pipe(
              catchError(() => of({ data: [], meta: {} })),
            );
        }),
      )
      .subscribe((result) => {
        const places = Array.isArray(result) ? result : (result as any).data ?? [];
        this.searchResults.set(places);
        this.searchLoading.set(false);
      });

    if (this.itineraryId()) {
      this.loadItinerary(this.itineraryId() as number);
    }
  }

  ngAfterViewInit() {
    this.initDatePicker();
    this.initTimePicker();
  }

  ngOnDestroy() {
    this.datePicker?.destroy();
    this.timePicker?.destroy();
  }

  // ── Cover ──
  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.coverPreviewUrl.set(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
  }

  // ── Invite ──
  openInviteModal() {
    this.inviteModalOpen.set(true);
  }

  closeInviteModal() {
    this.inviteModalOpen.set(false);
    this.inviteEmail.set('');
  }

  sendInvite() {
    const email = this.inviteEmail().trim();
    if (!email) return;

    const name = email.split('@')[0] || 'Bạn mới';
    this.members.update((m) => [
      ...m,
      {
        id: Math.random().toString(36).slice(2, 10),
        name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e2e8f0&color=334155`,
        isOnline: false,
      },
    ]);
    this.closeInviteModal();
  }

  // ── Search Place Modal ──
  openSearchModal() {
    this.searchModalOpen.set(true);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.loadNearbyPlaces();
    this.loadTrendingPlaces();
  }

  private loadNearbyPlaces() {
    const coords = this.dataService.currentCoordinates();
    if (coords) {
      this.nearbyLoading.set(true);
      this.locationApi
        .fetchNearbyLocations(coords.lat, coords.lng, 5, this.dataService.currentCityId())
        .pipe(catchError(() => of([])))
        .subscribe((places) => {
          this.nearbyPlaces.set(places.slice(0, 8));
          this.nearbyLoading.set(false);
        });
    } else {
      this.requestLocation();
    }
  }

  private loadTrendingPlaces() {
    this.trendingLoading.set(true);
    this.locationApi
      .fetchTrendingLocations(this.dataService.currentCityId())
      .pipe(catchError(() => of([])))
      .subscribe((places) => {
        this.trendingPlaces.set(places.slice(0, 8));
        this.trendingLoading.set(false);
      });
  }

  requestLocation() {
    if (!navigator.geolocation) {
      this.locationDenied.set(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.dataService.setCurrentCoordinates(coords);
        this.loadNearbyPlaces();
      },
      () => {
        this.locationDenied.set(true);
      },
    );
  }

  openDatePicker() {
    this.datePicker?.open();
  }

  openTimePicker(stopId: string, field: 'start' | 'end', value: string) {
    this.activeTimeTarget = { stopId, field };
    this.timePicker?.setDate(value || '09:00', false, 'H:i');
    this.timePicker?.open();
  }

  closeSearchModal() {
    this.searchModalOpen.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  onSearchInput(query: string) {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  addPlaceAsStop(place: Place) {
    const category = this.guessCategory(place);
    this.stops.update((stops) => [
      ...stops,
      {
        id: Math.random().toString(36).slice(2, 10),
        name: place.name,
        district: place.area_name || place.district_name || '',
        image: place.image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300',
        startTime: '10:00',
        endTime: '11:30',
        note: '',
        category,
        cost: 0,
        dayNumber: this.availableDays()[0] ?? 1,
        latitude: place.latitude,
        longitude: place.longitude,
        placeSlug: place.slug,
      },
    ]);
    this.closeSearchModal();
  }

  addEmptyStop() {
    this.stops.update((stops) => [
      ...stops,
      {
        id: Math.random().toString(36).slice(2, 10),
        name: 'Địa điểm mới',
        district: 'Thêm khu vực',
        image:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300',
        startTime: '10:00',
        endTime: '11:30',
        note: '',
        category: 'sightseeing',
        cost: 0,
        dayNumber: this.availableDays()[0] ?? 1,
      },
    ]);
  }

  isPlaceAlreadyAdded(slug: string): boolean {
    return this.stops().some((s) => s.placeSlug === slug);
  }

  removeStop(stopId: string) {
    const stops = this.stops();
    const index = stops.findIndex((s) => s.id === stopId);
    if (index === -1) return;

    const removed = stops[index];
    this.deletedStop.set({ stop: removed, index });
    this.stops.update((s) => s.filter((x) => x.id !== stopId));

    this.showUndoToast.set(true);
    if (this.undoTimeout) clearTimeout(this.undoTimeout);
    this.undoTimeout = setTimeout(() => {
      this.showUndoToast.set(false);
      this.deletedStop.set(null);
    }, 5000);
  }

  undoDelete() {
    const deleted = this.deletedStop();
    if (!deleted) return;

    this.stops.update((stops) => {
      const copy = [...stops];
      copy.splice(deleted.index, 0, deleted.stop);
      return copy;
    });

    this.showUndoToast.set(false);
    this.deletedStop.set(null);
    if (this.undoTimeout) clearTimeout(this.undoTimeout);
  }

  updateStopStartTime(stopId: string, value: string) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, startTime: value } : s)),
    );
  }

  updateStopEndTime(stopId: string, value: string) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, endTime: value } : s)),
    );
  }

  updateStopNote(stopId: string, value: string) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, note: value } : s)),
    );
  }

  updateStopCategory(stopId: string, value: StopCategory) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, category: value } : s)),
    );
  }

  updateStopCost(stopId: string, value: number) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, cost: value || 0 } : s)),
    );
  }

  updateStopDay(stopId: string, value: number) {
    this.stops.update((stops) =>
      stops.map((s) => (s.id === stopId ? { ...s, dayNumber: Number(value) || 1 } : s)),
    );
  }

  // ── Drag & Drop ──
  onDragStart(event: DragEvent, index: number) {
    this.dragIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    const fromIndex = this.dragIndex();
    if (fromIndex === null || fromIndex === toIndex) return;

    this.stops.update((stops) => {
      const copy = [...stops];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    this.dragIndex.set(null);
  }

  onDragEnd() {
    this.dragIndex.set(null);
  }

  // ── Save ──
  saveTrip() {
    if (!this.tripTitle().trim()) {
      this.showTitleWarning.set(true);
      setTimeout(() => this.showTitleWarning.set(false), 3000);
      return;
    }

    this.saving.set(true);
    const payload = this.buildPayload();
    const request$ = this.isCreateMode()
      ? this.itineraryApi.createItinerary(payload)
      : this.itineraryApi.updateItinerary(this.itineraryId() as number, payload);

    request$
      .pipe(
        catchError(() => {
          this.saving.set(false);
          return of(null);
        }),
      )
      .subscribe((result) => {
        this.saving.set(false);
        if (!result) return;

        this.itineraryId.set(result.id);
        this.router.navigate(['/planner', result.id, 'edit']);
      });
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('vi-VN');
  }

  formatTravelTime(minutes: number | null): string {
    if (!minutes || minutes <= 0) return 'Dang cap nhat';
    if (minutes < 60) return `${minutes} phut`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours} gio ${remainingMinutes} phut` : `${hours} gio`;
  }

  formatTravelDistance(distanceKm: number | null): string {
    if (distanceKm === null || Number.isNaN(distanceKm)) return '';
    return `${distanceKm.toFixed(1)} km`;
  }

  shouldShowDayHeading(index: number): boolean {
    if (index === 0) return true;
    const stops = this.stops();
    return stops[index - 1]?.dayNumber !== stops[index]?.dayNumber;
  }

  shouldShowTravelBlock(index: number): boolean {
    if (index === 0) return false;
    const stops = this.stops();
    return stops[index - 1]?.dayNumber === stops[index]?.dayNumber;
  }

  getDayLabel(dayNumber: number): string {
    return `Ngay ${dayNumber}`;
  }

  getTravelMinutesForIndex(index: number): number | null {
    if (!this.shouldShowTravelBlock(index)) return null;
    const stops = this.stops();
    return this.estimateTravelMinutes(stops[index - 1], stops[index]);
  }

  getTravelDistanceForIndex(index: number): number | null {
    if (!this.shouldShowTravelBlock(index)) return null;
    const stops = this.stops();
    return this.estimateDistanceKm(stops[index - 1], stops[index]);
  }

  private loadItinerary(id: number) {
    this.loadingItinerary.set(true);
    this.itineraryApi
      .getItinerary(id)
      .pipe(
        catchError(() => {
          this.loadingItinerary.set(false);
          return of(null);
        }),
      )
      .subscribe((itinerary) => {
        this.loadingItinerary.set(false);
        if (!itinerary) return;

        this.tripTitle.set(itinerary.title || '');
        this.tripDescription.set(itinerary.description || '');
        this.coverPreviewUrl.set(itinerary.cover_image || '');
        this.startDate.set(itinerary.start_date || '');
        this.endDate.set(itinerary.end_date || '');
        this.members.set(
          (itinerary.members || []).map((member, index) => ({
            id: member.id || `member-${index + 1}`,
            name: member.name,
            avatar:
              member.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=e2e8f0&color=334155`,
            isOnline: Boolean(member.is_online),
          })),
        );
        this.stops.set(
          (itinerary.items || []).map((item, index) => ({
            id: String(item.id),
            name: item.activity_title || item.location?.name || `Diem dung ${index + 1}`,
            district: item.location?.full_address || '',
            image: this.coverPreviewUrl() || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300',
            startTime: item.start_time || '09:00',
            endTime: item.end_time || '10:00',
            note: item.note || '',
            category: 'sightseeing',
            cost: Number(item.estimated_cost || 0),
            dayNumber: item.day_number || 1,
            latitude: item.location?.latitude || undefined,
            longitude: item.location?.longitude || undefined,
            placeSlug: item.location?.slug,
          })),
        );
      });
  }

  private buildPayload() {
    return {
      title: this.tripTitle().trim(),
      description: this.tripDescription().trim() || null,
      cover_image: this.coverPreviewUrl() || null,
      itinerary_type: 'manual' as const,
      start_date: this.startDate() || null,
      end_date: this.endDate() || null,
      days: Math.max(this.tripDays(), 1),
      budget: this.totalCost(),
      members: this.members().map((member) => ({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        is_online: member.isOnline,
      })),
      items: this.stops().map((stop, index) => ({
        day_number: stop.dayNumber,
        start_time: stop.startTime || null,
        end_time: stop.endTime || null,
        location_id: null,
        activity_title: stop.name,
        activity_type: stop.category,
        note: stop.note || null,
        estimated_cost: stop.cost || 0,
        travel_minutes_from_previous: this.getTravelMinutesForIndex(index),
        travel_distance_km_from_previous: this.getTravelDistanceForIndex(index),
        sort_order: index + 1,
      })),
    };
  }

  private initDatePicker() {
    const input = this.dateRangeInput?.nativeElement;
    if (!input) return;

    this.datePicker?.destroy();
    this.datePicker = flatpickr(input, {
      mode: 'range',
      locale: Vietnamese,
      dateFormat: 'Y-m-d',
      defaultDate: this.getDefaultDateRange(),
      disableMobile: true,
      monthSelectorType: 'static',
      nextArrow: '<i class="fa-solid fa-chevron-right"></i>',
      prevArrow: '<i class="fa-solid fa-chevron-left"></i>',
      onChange: (selectedDates) => {
        const [start, end] = selectedDates;
        this.startDate.set(start ? this.toIsoDate(start) : '');
        this.endDate.set(end ? this.toIsoDate(end) : '');
      },
    });
  }

  private initTimePicker() {
    const input = this.timePickerInput?.nativeElement;
    if (!input) return;

    this.timePicker?.destroy();
    this.timePicker = flatpickr(input, {
      locale: Vietnamese,
      enableTime: true,
      noCalendar: true,
      time_24hr: true,
      dateFormat: 'H:i',
      disableMobile: true,
      minuteIncrement: 15,
      onChange: (selectedDates, dateStr) => {
        if (!this.activeTimeTarget || !dateStr) return;
        const { stopId, field } = this.activeTimeTarget;
        if (field === 'start') {
          this.updateStopStartTime(stopId, dateStr);
        } else {
          this.updateStopEndTime(stopId, dateStr);
        }
      },
      onClose: () => {
        this.activeTimeTarget = null;
      },
    });
  }

  private getDefaultDateRange(): string[] {
    return [this.startDate(), this.endDate()].filter(Boolean) as string[];
  }

  private toIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDisplayDate(value: string): string {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : this.dateFormatter.format(date);
  }

  private estimateTravelMinutes(from: PlannerStop, to: PlannerStop): number {
    const distance = this.estimateDistanceKm(from, to);
    if (distance === null) return 15;
    return Math.max(5, Math.round((distance / 25) * 60));
  }

  private estimateDistanceKm(from: PlannerStop, to: PlannerStop): number | null {
    if (
      from.latitude == null ||
      from.longitude == null ||
      to.latitude == null ||
      to.longitude == null
    ) {
      return null;
    }

    const earthRadiusKm = 6371;
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLng = this.toRadians(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private guessCategory(place: Place): StopCategory {
    const cats = [...place.categories, ...place.source_categories].map((c) => c.toLowerCase());
    if (cats.some((c) => c.includes('hotel') || c.includes('homestay'))) return 'hotel';
    if (cats.some((c) => c.includes('restaurant') || c.includes('cafe') || c.includes('coffee'))) return 'food';
    if (cats.some((c) => c.includes('shop') || c.includes('store') || c.includes('market'))) return 'shopping';
    return 'sightseeing';
  }
}

