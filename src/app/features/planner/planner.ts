import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { UserApiService } from '../../core/services/user-api.service';
import { ToastService } from '../../core/services/toast.service';
import { buildUiAvatarUrl } from '../../core/utils/avatar.utils';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError,
  finalize,
} from 'rxjs';
import { PlannerTripForm } from './shared/planner-trip-form';

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
  locationId?: string;
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

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PlannerTripForm],
  templateUrl: './planner.html',
  styleUrl: './planner.css',
})
export class Planner implements AfterViewInit, OnDestroy {
  @ViewChild('dateRangeInput')
  private dateRangeInput?: ElementRef<HTMLInputElement>;

  private locationApi = inject(LocationApiService);
  private dataService = inject(DataService);
  private itineraryApi = inject(ItineraryApiService);
  private userApi = inject(UserApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private datePicker: FlatpickrInstance | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  readonly itineraryId = signal<number | null>(null);
  readonly isCreateMode = computed(() => this.itineraryId() === null);
  readonly pageHeading = computed(() =>
    this.isCreateMode() ? 'Táº¡o lá»‹ch trÃ¬nh' : 'Chá»‰nh sá»­a chuyáº¿n Ä‘i',
  );
  readonly saveLabel = computed(() =>
    this.isCreateMode() ? 'Táº¡o chuyáº¿n Ä‘i' : 'LÆ°u chuyáº¿n Ä‘i',
  );
  loadingItinerary = signal(false);
  saving = signal(false);
  formErrors = signal<Record<string, string[]>>({});
  generalError = signal<string | null>(null);

  tripTitle = signal('');
  tripDescription = signal('');
  coverPreviewUrl = signal('');
  inviteModalOpen = signal(false);
  inviteEmail = signal('');
  itineraryType = signal<'manual' | 'ai'>('manual');
  tripBudget = signal<number | null>(null);
  selectedInsertDay = signal(1);
  addingMember = signal(false);

  // -- Date --
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
    if (!start && !end) return 'Chá»n khoáº£ng ngÃ y cho chuyáº¿n Ä‘i';
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
        label: `NgÃ y ${dayNumber}`,
        stops: [],
      });
    });

    this.stops().forEach((stop, globalIndex) => {
      const normalizedDay = Math.min(
        Math.max(stop.dayNumber || 1, 1),
        this.availableDays().length,
      );
      const day = grouped.get(normalizedDay);
      if (!day) return;

      const previousStop = day.stops.at(-1)?.stop ?? null;
      day.stops.push({
        stop: { ...stop, dayNumber: normalizedDay },
        globalIndex,
        travelMinutesFromPrevious: previousStop
          ? this.estimateTravelMinutes(previousStop, stop)
          : null,
        travelDistanceKmFromPrevious: previousStop
          ? this.estimateDistanceKm(previousStop, stop)
          : null,
      });
    });

    return Array.from(grouped.values()).filter((day) => day.stops.length > 0);
  });

  displayedBudget = computed(() => this.tripBudget() ?? this.totalCost());
  // -- Cost --
  totalCost = computed(() =>
    this.stops().reduce((sum, stop) => sum + (stop.cost || 0), 0),
  );

  // -- Undo --
  deletedStop = signal<{ stop: PlannerStop; index: number } | null>(null);
  showUndoToast = signal(false);
  private undoTimeout: ReturnType<typeof setTimeout> | null = null;

  // -- Drag & Drop --
  dragIndex = signal<number | null>(null);

  costDrafts = signal<Record<string, string>>({});

  private buildOwnerMember(): PlannerMember | null {
    const currentUser = this.dataService.currentUser();
    const parsedId = Number(currentUser.id);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      return null;
    }

    const name = currentUser.name?.trim() || currentUser.email?.trim() || 'Ban';
    return {
      id: currentUser.email?.trim().toLowerCase() || String(parsedId),
      name,
      avatar: currentUser.avatar || buildUiAvatarUrl(name),
      isOnline: true,
    };
  }

  private mergeMembersWithOwner(members: PlannerMember[]): PlannerMember[] {
    const ownerMember = this.buildOwnerMember();
    if (!ownerMember) {
      return members;
    }

    const ownerId = ownerMember.id.trim().toLowerCase();
    const filteredMembers = members.filter((member) => member.id.trim().toLowerCase() !== ownerId);
    return [ownerMember, ...filteredMembers];
  }

  isOwnerMember(memberId: string): boolean {
    const ownerMember = this.buildOwnerMember();
    return !!ownerMember && ownerMember.id.trim().toLowerCase() === memberId.trim().toLowerCase();
  }
  // -- Search Place Modal --
  searchModalOpen = signal(false);
  searchQuery = signal('');
  searchResults = signal<Place[]>([]);
  searchLoading = signal(false);
  private searchSubject = new Subject<string>();

  // -- Nearby & Trending --
  nearbyPlaces = signal<Place[]>([]);
  nearbyLoading = signal(false);
  trendingPlaces = signal<Place[]>([]);
  trendingLoading = signal(false);
  locationDenied = signal(false);

  members = signal<PlannerMember[]>([]);

  stops = signal<PlannerStop[]>([]);

  constructor() {
    const routeId = this.route.snapshot.paramMap.get('id');
    this.itineraryId.set(routeId ? Number(routeId) : null);

    if (!this.itineraryId()) {
      this.members.set(this.mergeMembersWithOwner([]));
    }

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
            .pipe(catchError(() => of({ data: [], meta: {} })));
        }),
      )
      .subscribe((result) => {
        const places = Array.isArray(result)
          ? result
          : ((result as any).data ?? []);
        this.searchResults.set(places);
        this.searchLoading.set(false);
      });

    if (this.itineraryId()) {
      this.loadItinerary(this.itineraryId() as number);
    }
  }

  ngAfterViewInit() {
    this.initDatePicker();
  }

  ngOnDestroy() {
    this.datePicker?.destroy();
  }

  // -- Cover --
  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.compressImage(file, 1200, 0.7).then((compressed) => {
      this.coverPreviewUrl.set(compressed);
    });
  }

  private compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = String(e.target?.result ?? '');
      };
      reader.readAsDataURL(file);
    });
  }

  // -- Invite --
  openInviteModal() {
    this.inviteModalOpen.set(true);
  }

  closeInviteModal() {
    this.inviteModalOpen.set(false);
    this.inviteEmail.set('');
  }

  sendInvite() {
    const email = this.inviteEmail().trim().toLowerCase();
    if (!email) {
      this.toast.warning('Vui lÃ²ng nháº­p email báº¡n Ä‘á»“ng hÃ nh.');
      return;
    }

    if (this.addingMember()) {
      return;
    }

    const currentUser = this.dataService.currentUser();
    if (currentUser.email?.trim().toLowerCase() === email) {
      this.toast.warning('KhÃ´ng thá»ƒ thÃªm chÃ­nh báº¡n báº±ng email nÃ y.');
      return;
    }

    if (this.members().some((member) => member.id === email)) {
      this.toast.warning('Báº¡n Ä‘á»“ng hÃ nh nÃ y Ä‘Ã£ cÃ³ trong lá»‹ch trÃ¬nh.');
      return;
    }

    this.addingMember.set(true);
    this.userApi
      .fetchUsersPaginated({ search: email, page: 1, perPage: 10 })
      .pipe(
        catchError(() =>
          of({
            data: [],
            meta: {
              current_page: 1,
              per_page: 10,
              total: 0,
              last_page: 1,
              from: null,
              to: null,
            },
          }),
        ),
      )
      .subscribe((response) => {
        this.addingMember.set(false);
        const matchedUser = response.data.find(
          (user) => user.email?.trim().toLowerCase() === email,
        );

        if (!matchedUser) {
          this.toast.error('Email nÃ y khÃ´ng tá»“n táº¡i trong há»‡ thá»‘ng.');
          return;
        }

        this.members.update((members) => [
          ...this.mergeMembersWithOwner([
            ...members,
            {
              id: matchedUser.email.trim().toLowerCase(),
              name:
                matchedUser.full_name?.trim() ||
                matchedUser.name?.trim() ||
                matchedUser.email,
              avatar:
                matchedUser.avatar_url ||
                buildUiAvatarUrl(
                  matchedUser.full_name?.trim() ||
                    matchedUser.name?.trim() ||
                    matchedUser.email,
                  'e2e8f0',
                  '334155',
                ),
              isOnline: false,
            },
          ]),
        ]);
        this.toast.success('ÄÃ£ thÃªm báº¡n Ä‘á»“ng hÃ nh.');
        this.closeInviteModal();
      });
  }

  removeMember(memberId: string) {
    if (this.isOwnerMember(memberId)) {
      this.toast.warning('KhÃ´ng thá»ƒ xÃ³a ngÆ°á»i táº¡o lá»‹ch trÃ¬nh.');
      return;
    }

    this.members.update((members) =>
      this.mergeMembersWithOwner(
        members.filter((member) => member.id.trim().toLowerCase() !== memberId.trim().toLowerCase()),
      ),
    );
    this.toast.success('ÄÃ£ xÃ³a báº¡n Ä‘á»“ng hÃ nh.');
  }

  // -- Search Place Modal --
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
        .fetchNearbyLocations(
          coords.lat,
          coords.lng,
          5,
          this.dataService.currentCityId(),
        )
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
        image:
          place.image ||
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300',
        startTime: '10:00',
        endTime: '11:30',
        note: '',
        category,
        cost: 0,
        dayNumber: this.availableDays()[0] ?? 1,
        locationId: place.id,
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
        name: 'Äiá»ƒm dá»«ng má»›i',
        district: 'ThÃªm khu vá»±c',
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
      stops.map((s) =>
        s.id === stopId
          ? { ...s, startTime: this.normalizeTimeValue(value) }
          : s,
      ),
    );
  }

  updateStopEndTime(stopId: string, value: string) {
    this.stops.update((stops) =>
      stops.map((s) =>
        s.id === stopId ? { ...s, endTime: this.normalizeTimeValue(value) } : s,
      ),
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

  getStopCostInputValue(stopId: string, cost: number): string {
    const draft = this.costDrafts()[stopId];
    if (draft !== undefined) {
      return draft;
    }

    return cost > 0 ? this.formatCurrency(cost) : '';
  }

  onStopCostInput(stopId: string, value: string) {
    const digits = value.replace(/\D/g, '');
    const parsedValue = digits ? Number(digits) : 0;

    this.costDrafts.update((drafts) => ({
      ...drafts,
      [stopId]: digits ? this.formatCurrency(parsedValue) : '',
    }));
    this.updateStopCost(stopId, parsedValue);
  }

  onStopCostBlur(stopId: string) {
    const stop = this.stops().find((item) => item.id === stopId);
    const formattedValue = stop && stop.cost > 0 ? this.formatCurrency(stop.cost) : '';

    this.costDrafts.update((drafts) => ({
      ...drafts,
      [stopId]: formattedValue,
    }));
  }

  updateStopDay(stopId: string, value: number) {
    this.stops.update((stops) =>
      stops.map((s) =>
        s.id === stopId ? { ...s, dayNumber: Number(value) || 1 } : s,
      ),
    );
  }

  // -- Drag & Drop --
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

  // -- Save --
  saveTrip() {
    const validationMessage = this.validateManualTripForm();
    if (validationMessage) {
      this.toast.warning(validationMessage);
      return;
    }

    this.saving.set(true);
    const payload = this.buildPayload();
    const request$ = this.isCreateMode()
      ? this.itineraryApi.createItinerary(payload)
      : this.itineraryApi.updateItinerary(
          this.itineraryId() as number,
          payload,
        );

    request$
      .pipe(
        catchError((err) => {
          console.error('Save Trip Error:', err);
          this.toast.error('Lưu lịch trình thất bại');
          return of(null);
        }),
        finalize(() => this.saving.set(false)),
      )
      .subscribe((result) => {
        if (!result) return;

        this.itineraryId.set(result.id);
        this.toast.success(
          this.isCreateMode()
            ? 'Đã tạo lịch trình thành công'
            : 'Đã lưu thay đổi lịch trình',
        );
        this.router.navigate(['/planner', result.id, 'edit']);
      });
  }

  private validateManualTripForm(): string | null {
    if (!this.tripTitle().trim()) {
      return 'Vui lòng nhập tên lịch trình';
    }

    if (!this.startDate() || !this.endDate()) {
      return 'Vui lòng chọn ngày bắt đầu và ngày kết thúc';
    }

    if (this.tripDays() <= 0) {
      return 'Ngày kết thúc phải sau hoặc trùng ngày bắt đầu';
    }

    const tripBudget = this.tripBudget();
    if (tripBudget !== null && tripBudget < 0) {
      return 'Ngân sách không được âm';
    }

    const stops = this.stops();
    if (!stops.length) {
      return 'Vui lòng thêm ít nhất 1 điểm dừng';
    }

    for (const stop of stops) {
      if (!stop.name.trim()) {
        return 'Tên điểm dừng không được để trống';
      }

      if (stop.cost < 0) {
        return `Chi phí của "${stop.name}" không được âm`;
      }

      const startMinutes = this.toMinutes(stop.startTime);
      const endMinutes = this.toMinutes(stop.endTime);

      if (startMinutes === null || endMinutes === null) {
        return `Thời gian của "${stop.name}" không hợp lệ`;
      }

      if (endMinutes < startMinutes) {
        return `Giờ kết thúc của "${stop.name}" phải sau giờ bắt đầu`;
      }
    }

    return null;
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('vi-VN');
  }

  formatCurrencyVnd(value: number): string {
    return `${this.formatCurrency(value)} đ`;
  }

  formatTravelTime(minutes: number | null): string {
    if (!minutes || minutes <= 0) return 'Đang cập nhật';
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes
      ? `${hours} giờ ${remainingMinutes} phút`
      : `${hours} giờ`;
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

  getDisplayIndexForDay(index: number): number {
    const stops = this.stops();
    const currentStop = stops[index];
    if (!currentStop) {
      return index + 1;
    }

    let displayIndex = 0;
    for (let currentIndex = 0; currentIndex <= index; currentIndex += 1) {
      if (stops[currentIndex]?.dayNumber === currentStop.dayNumber) {
        displayIndex += 1;
      }
    }

    return displayIndex;
  }

  getDayLabel(dayNumber: number): string {
    return `NgÃ y ${dayNumber}`;
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
        this.itineraryType.set(itinerary.itinerary_type ?? 'manual');
        this.startDate.set(itinerary.start_date || '');
        this.endDate.set(itinerary.end_date || '');
        this.members.set(
          this.mergeMembersWithOwner(
            (itinerary.members || []).map((member, index) => ({
              id: member.id || `member-${index + 1}`,
              name: member.name,
              avatar:
                member.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=e2e8f0&color=334155`,
              isOnline: Boolean(member.is_online),
            })),
          ),
        );
        this.stops.set(
          (itinerary.items || []).map((item, index) => ({
            id: String(item.id),
            name:
              item.activity_title ||
              item.location?.name ||
              `Äiá»ƒm dá»«ng ${index + 1}`,
            district: item.location?.full_address || '',
            image:
              item.location?.image ||
              this.coverPreviewUrl() ||
              'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=300',
            startTime: this.getSafeTimeValue(item.start_time, '09:00'),
            endTime: this.getSafeEndTimeValue(
              item.end_time,
              this.getSafeTimeValue(item.start_time, '09:00'),
            ),
              note: item.note || '',
              category: 'sightseeing',
              cost: Number(item.estimated_cost || 0),
              dayNumber: item.day_number || 1,
              locationId: item.location_id || undefined,
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
      itinerary_type: this.itineraryType(),
      start_date: this.startDate() || null,
      end_date: this.endDate() || null,
      days: Math.max(this.tripDays(), 1),
      budget: this.totalCost(),
      members: this.members().map((member) => ({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        is_online: (member.isOnline ? 1 : 0) as any,
      })),
      items: this.stops().map((stop, index) => ({
        day_number: stop.dayNumber,
        start_time: stop.startTime || null,
        end_time: stop.endTime || null,
        location_id: stop.locationId || null,
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
    return Number.isNaN(date.getTime())
      ? value
      : this.dateFormatter.format(date);
  }

  private normalizeTimeValue(value: string): string {
    const rawValue = value.trim();
    if (!rawValue) {
      return '';
    }

    const normalized = rawValue.replace(/\s+/g, ' ');
    const timeWithMinutes =
      normalized.match(/(\d{1,2})\s*[:h.]\s*(\d{1,2})/i) ||
      normalized.match(/^(\d{1,2})(?::(\d{1,2}))$/);
    const hourOnly = normalized.match(/\b(\d{1,2})\b/);
    const match = timeWithMinutes
      ? [timeWithMinutes[0], timeWithMinutes[1], timeWithMinutes[2]]
      : hourOnly
        ? [hourOnly[0], hourOnly[1], '0']
        : null;

    if (!match) {
      return '';
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2] ?? '0');
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return '';
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private getSafeTimeValue(
    value: string | null | undefined,
    fallback: string,
  ): string {
    return this.normalizeTimeValue(value ?? '') || fallback;
  }

  private getSafeEndTimeValue(
    value: string | null | undefined,
    startTime: string,
  ): string {
    const normalizedEnd = this.normalizeTimeValue(value ?? '');
    const startMinutes = this.toMinutes(startTime) ?? 540;
    const endMinutes = this.toMinutes(normalizedEnd);

    if (endMinutes !== null && endMinutes >= startMinutes) {
      return normalizedEnd;
    }

    const fallbackEndMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
    const hours = Math.floor(fallbackEndMinutes / 60);
    const minutes = fallbackEndMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private toMinutes(value: string): number | null {
    const normalized = this.normalizeTimeValue(value);
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  }

  private estimateTravelMinutes(from: PlannerStop, to: PlannerStop): number {
    const distance = this.estimateDistanceKm(from, to);
    if (distance === null) return 15;
    return Math.max(5, Math.round((distance / 25) * 60));
  }

  private estimateDistanceKm(
    from: PlannerStop,
    to: PlannerStop,
  ): number | null {
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
    const cats = [...place.categories, ...place.source_categories].map((c) =>
      c.toLowerCase(),
    );
    if (cats.some((c) => c.includes('hotel') || c.includes('homestay')))
      return 'hotel';
    if (
      cats.some(
        (c) =>
          c.includes('restaurant') ||
          c.includes('cafe') ||
          c.includes('coffee'),
      )
    )
      return 'food';
    if (
      cats.some(
        (c) =>
          c.includes('shop') || c.includes('store') || c.includes('market'),
      )
    )
      return 'shopping';
    return 'sightseeing';
  }

  private formatTimeForBackend(time: string | null): string | null {
    if (!time) return null;
    // Ensure format HH:mm (truncate seconds if present)
    return time.split(':').slice(0, 2).join(':');
  }

  private formatTimeForDisplay(time: string | null): string | null {
    if (!time) return null;
    // Ensure format HH:mm
    return time.split(':').slice(0, 2).join(':');
  }
}

