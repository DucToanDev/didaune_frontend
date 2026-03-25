import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, map, of, shareReplay } from 'rxjs';
import { DataService } from '../data.service';
import { Place, PlaceReview, User } from '../../models/app.models';

export interface AdminKpi {
  label: string;
  value: string;
  delta: string;
  tone: string;
}

export interface AdminLocationRow {
  place: Place;
  status: 'published' | 'needs_review' | 'draft';
  completeness: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'content_admin' | 'super_admin';
  reviews: number;
  favorites: number;
  status: 'active' | 'flagged';
}

export interface AdminPartnerRow {
  id: string;
  placeName: string;
  ownerName: string;
  district: string;
  status: 'pending' | 'verified' | 'rejected' | 'active';
  source: string;
}

export interface AdminImportBatch {
  id: string;
  source: string;
  importedAt: string;
  records: number;
  status: 'completed' | 'review' | 'failed';
  issues: number;
}

export interface AdminTaxonomyRow {
  id: string;
  name: string;
  type: 'category' | 'amenity' | 'collection_tag';
  usage: number;
  accent: string;
}

export interface AdminCollectionRow {
  id: string;
  title: string;
  count: number;
  theme: string;
  status: 'published' | 'draft';
}

export interface AdminReportRow {
  id: string;
  title: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface AdminReviewRow {
  review: PlaceReview;
  placeName: string;
  moderationStatus: 'approved' | 'pending' | 'flagged';
}

type AdminLocationStatus = AdminLocationRow['status'];
type AdminReviewStatus = AdminReviewRow['moderationStatus'];
type AdminPartnerStatus = AdminPartnerRow['status'];
type AdminImportStatus = AdminImportBatch['status'];
type AdminCollectionStatus = AdminCollectionRow['status'];

interface AdminMutableState {
  locationStatuses: Record<string, AdminLocationStatus>;
  reviewStatuses: Record<string, AdminReviewStatus>;
  partnerStatuses: Record<string, AdminPartnerStatus>;
  importStatuses: Record<string, AdminImportStatus>;
  collectionStatuses: Record<string, AdminCollectionStatus>;
}

const ADMIN_STATE_STORAGE_KEY = 'didaune_admin_state';

@Injectable({
  providedIn: 'root',
})
export class AdminDataService {
  private dataService = inject(DataService);
  private adminState = signal<AdminMutableState>(this.readState());

  private places$ = this.dataService.getPlaces().pipe(shareReplay(1));
  private categories$ = this.dataService.getCategories().pipe(shareReplay(1));
  private amenities$ = this.dataService.getAmenities().pipe(shareReplay(1));
  private db$ = this.dataService.getDb().pipe(shareReplay(1));
  private adminState$ = toObservable(this.adminState);

  readonly kpis$: Observable<AdminKpi[]> = combineLatest([
    this.places$,
    this.getAdminUsers(),
    this.getAdminReviews(),
    this.getPartnerRequests(),
  ]).pipe(
    map(([places, users, reviews, partners]) => [
      {
        label: 'Dia diem dang live',
        value: String(places.length),
        delta: `${places.filter((place) => place.is_new).length} moi cap nhat`,
        tone: 'from-orange-500 to-rose-500',
      },
      {
        label: 'Nguoi dung',
        value: String(users.length),
        delta: `${users.filter((user) => user.status === 'flagged').length} can xem`,
        tone: 'from-sky-500 to-cyan-500',
      },
      {
        label: 'Review',
        value: String(reviews.length),
        delta: `${reviews.filter((review) => review.moderationStatus !== 'approved').length} cho duyet`,
        tone: 'from-emerald-500 to-teal-500',
      },
      {
        label: 'Partner claims',
        value: String(partners.length),
        delta: `${partners.filter((partner) => partner.status === 'pending').length} pending`,
        tone: 'from-violet-500 to-fuchsia-500',
      },
    ]),
    shareReplay(1)
  );

  getAdminLocations(): Observable<AdminLocationRow[]> {
    return combineLatest([this.places$, this.adminState$]).pipe(
      map(([places, adminState]) =>
        places
          .map((place) => {
            const completeness = this.calculateCompleteness(place);
            const derivedStatus: AdminLocationStatus =
              completeness < 70 ? 'needs_review' : place.is_new ? 'draft' : 'published';
            return {
              place,
              completeness,
              status: adminState.locationStatuses[place.slug] ?? derivedStatus,
            } satisfies AdminLocationRow;
          })
          .sort((a, b) => b.completeness - a.completeness)
      ),
      shareReplay(1)
    );
  }

  getLocationBySlug(slug: string): Observable<AdminLocationRow | undefined> {
    return this.getAdminLocations().pipe(
      map((locations) => locations.find((location) => location.place.slug === slug))
    );
  }

  getAdminReviews(): Observable<AdminReviewRow[]> {
    return combineLatest([this.places$, this.adminState$]).pipe(
      map(([places, adminState]) =>
        places
          .flatMap((place) =>
            place.reviews.map((review) => {
              const derivedStatus: AdminReviewStatus =
                review.source === 'internal'
                  ? 'pending'
                  : review.comment.length < 40
                    ? 'flagged'
                    : 'approved';

              return {
                review,
                placeName: place.name,
                moderationStatus: adminState.reviewStatuses[review.id] ?? derivedStatus,
              } satisfies AdminReviewRow;
            })
          )
          .sort(
            (a, b) =>
              new Date(b.review.created_at).getTime() -
              new Date(a.review.created_at).getTime()
          )
      ),
      shareReplay(1)
    );
  }

  getAdminUsers(): Observable<AdminUserRow[]> {
    return combineLatest([this.db$, this.places$]).pipe(
      map(([db, places]) => {
        const placeReviews = places.flatMap((place) => place.reviews);
        const baseUsers: AdminUserRow[] = db.users.map((user, index) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: (index === 0 ? 'super_admin' : 'user') as AdminUserRow['role'],
          reviews: placeReviews.filter((review) => review.user_name === user.name).length,
          favorites: index === 0 ? 6 : 2,
          status: 'active' as AdminUserRow['status'],
        }));

        return [
          ...baseUsers,
          {
            id: 'moderator-1',
            name: 'Lan Moderator',
            email: 'moderator@didaune.vn',
            role: 'moderator',
            reviews: 14,
            favorites: 11,
            status: 'active',
          },
          {
            id: 'content-1',
            name: 'Khanh Content',
            email: 'content@didaune.vn',
            role: 'content_admin',
            reviews: 4,
            favorites: 8,
            status: 'flagged',
          },
        ] satisfies AdminUserRow[];
      }),
      shareReplay(1)
    );
  }

  getPartnerRequests(): Observable<AdminPartnerRow[]> {
    return combineLatest([this.places$, this.adminState$]).pipe(
      map(([places, adminState]) =>
        places.slice(0, 6).map((place, index) => {
          const status: AdminPartnerRow['status'] =
            index % 4 === 0
              ? 'pending'
              : index % 4 === 1
                ? 'verified'
                : index % 4 === 2
                  ? 'active'
                  : 'rejected';

          return {
            id: `partner-${index + 1}`,
            placeName: place.name,
            ownerName: place.owner_name || `Chu quan ${index + 1}`,
            district: place.district_name,
            status: adminState.partnerStatuses[`partner-${index + 1}`] ?? status,
            source: index % 2 === 0 ? 'Claim form' : 'Import owner data',
          } satisfies AdminPartnerRow;
        })
      ),
      shareReplay(1)
    );
  }

  getImportBatches(): Observable<AdminImportBatch[]> {
    return this.adminState$.pipe(
      map((adminState) =>
        [
          {
            id: 'batch-hcm-cafe-01',
            source: 'cafe-in-ho-chi-minh-city-ho-chi-minh-city-vietnam.json',
            importedAt: '2026-03-21T10:20:00Z',
            records: 10,
            status: adminState.importStatuses['batch-hcm-cafe-01'] ?? 'completed',
            issues: 2,
          },
          {
            id: 'batch-partner-claims',
            source: 'owner-claims.csv',
            importedAt: '2026-03-20T08:00:00Z',
            records: 18,
            status: adminState.importStatuses['batch-partner-claims'] ?? 'review',
            issues: 5,
          },
          {
            id: 'batch-image-refresh',
            source: 'image-refresh-api',
            importedAt: '2026-03-19T13:15:00Z',
            records: 42,
            status: adminState.importStatuses['batch-image-refresh'] ?? 'failed',
            issues: 12,
          },
        ] satisfies AdminImportBatch[]
      ),
      shareReplay(1)
    );
  }

  getTaxonomyRows(): Observable<AdminTaxonomyRow[]> {
    return combineLatest([this.categories$, this.amenities$, this.places$]).pipe(
      map(([categories, amenities, places]) => {
        const categoryRows = categories.map((category) => ({
          id: category.id,
          name: category.name,
          type: 'category' as const,
          usage: places.filter((place) => place.categories.includes(category.id)).length,
          accent: category.color,
        }));
        const amenityRows = amenities.map((amenity) => ({
          id: amenity.id,
          name: amenity.name,
          type: 'amenity' as const,
          usage: places.filter((place) => place.amenities.includes(amenity.id)).length,
          accent: 'text-slate-600',
        }));
        const collectionRows: AdminTaxonomyRow[] = [
          {
            id: 'deadline',
            name: 'Cay deadline',
            type: 'collection_tag',
            usage: places.filter((place) => place.categories.includes('work')).length,
            accent: 'text-emerald-500',
          },
          {
            id: 'date-night',
            name: 'Date night',
            type: 'collection_tag',
            usage: places.filter((place) => place.categories.includes('date')).length,
            accent: 'text-rose-500',
          },
        ];

        return [...categoryRows, ...amenityRows, ...collectionRows];
      }),
      shareReplay(1)
    );
  }

  getCollections(): Observable<AdminCollectionRow[]> {
    return combineLatest([this.places$, this.adminState$]).pipe(
      map(([places, adminState]) =>
        [
          {
            id: 'collection-work',
            title: 'Cay deadline xuyen dem',
            count: places.filter((place) => place.categories.includes('work')).length,
            theme: 'Focus / study',
            status: adminState.collectionStatuses['collection-work'] ?? ('published' as const),
          },
          {
            id: 'collection-date',
            title: 'Hen ho dep va chill',
            count: places.filter((place) => place.categories.includes('date')).length,
            theme: 'Date / romance',
            status: adminState.collectionStatuses['collection-date'] ?? ('published' as const),
          },
          {
            id: 'collection-photo',
            title: 'Song ao co gu',
            count: places.filter((place) => place.categories.includes('photo')).length,
            theme: 'Photo / visual',
            status: adminState.collectionStatuses['collection-photo'] ?? ('draft' as const),
          },
        ] satisfies AdminCollectionRow[]
      ),
      shareReplay(1)
    );
  }

  updateLocationStatus(slug: string, status: AdminLocationStatus) {
    this.updateState({
      locationStatuses: {
        ...this.adminState().locationStatuses,
        [slug]: status,
      },
    });
  }

  updateReviewStatus(reviewId: string, status: AdminReviewStatus) {
    this.updateState({
      reviewStatuses: {
        ...this.adminState().reviewStatuses,
        [reviewId]: status,
      },
    });
  }

  updatePartnerStatus(id: string, status: AdminPartnerStatus) {
    this.updateState({
      partnerStatuses: {
        ...this.adminState().partnerStatuses,
        [id]: status,
      },
    });
  }

  updateImportStatus(id: string, status: AdminImportStatus) {
    this.updateState({
      importStatuses: {
        ...this.adminState().importStatuses,
        [id]: status,
      },
    });
  }

  updateCollectionStatus(id: string, status: AdminCollectionStatus) {
    this.updateState({
      collectionStatuses: {
        ...this.adminState().collectionStatuses,
        [id]: status,
      },
    });
  }

  getReports(): Observable<AdminReportRow[]> {
    return this.places$.pipe(
      map((places) => {
        const missingWard = places.filter((place) => !place.area_name).length;
        const missingCoords = places.filter(
          (place) => place.latitude === undefined || place.longitude === undefined
        ).length;
        const lowCompleteness = places.filter(
          (place) => this.calculateCompleteness(place) < 70
        ).length;
        const noOwner = places.filter((place) => !place.owner_name).length;

        return [
          {
            id: 'report-ward',
            title: 'Chua map phuong moi',
            count: missingWard,
            severity: (missingWard > 0 ? 'high' : 'low') as AdminReportRow['severity'],
            description: 'Can review lai mapping dia gioi sau sap nhap.',
          },
          {
            id: 'report-coords',
            title: 'Thieu toa do',
            count: missingCoords,
            severity: (missingCoords > 0 ? 'medium' : 'low') as AdminReportRow['severity'],
            description: 'Khong the dua vao map va spatial join neu thieu lat/lng.',
          },
          {
            id: 'report-quality',
            title: 'Ho so dia diem thieu du lieu',
            count: lowCompleteness,
            severity: (lowCompleteness > 2 ? 'high' : 'medium') as AdminReportRow['severity'],
            description: 'Can bo sung anh, so dien thoai, menu link, hoac owner data.',
          },
          {
            id: 'report-owner',
            title: 'Chua gan partner',
            count: noOwner,
            severity: 'medium' as AdminReportRow['severity'],
            description: 'Nhung dia diem nay chua co owner/partner relation ro rang.',
          },
        ] satisfies AdminReportRow[];
      }),
      shareReplay(1)
    );
  }

  private calculateCompleteness(place: Place): number {
    const checks = [
      Boolean(place.description),
      Boolean(place.gallery.length),
      Boolean(place.address),
      Boolean(place.area_name),
      Boolean(place.google_maps_link),
      Boolean(place.website),
      Boolean(place.phone),
      Boolean(place.reviews.length),
      Boolean(place.latitude !== undefined && place.longitude !== undefined),
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  private updateState(partial: Partial<AdminMutableState>) {
    const nextState = {
      ...this.adminState(),
      ...partial,
    };

    this.adminState.set(nextState);
    this.writeState(nextState);
  }

  private readState(): AdminMutableState {
    if (typeof window === 'undefined') {
      return this.defaultState();
    }

    const value = window.localStorage.getItem(ADMIN_STATE_STORAGE_KEY);
    if (!value) {
      return this.defaultState();
    }

    try {
      return {
        ...this.defaultState(),
        ...(JSON.parse(value) as Partial<AdminMutableState>),
      };
    } catch {
      return this.defaultState();
    }
  }

  private writeState(state: AdminMutableState) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ADMIN_STATE_STORAGE_KEY, JSON.stringify(state));
  }

  private defaultState(): AdminMutableState {
    return {
      locationStatuses: {},
      reviewStatuses: {},
      partnerStatuses: {},
      importStatuses: {},
      collectionStatuses: {},
    };
  }
}
