import { Injectable } from '@angular/core';
import {
  Amenity,
  Category,
  ExternalLocation,
  Place,
  PlaceReview,
} from '../models/app.models';
import { PROVINCE_MAPPINGS } from '../config/location-api.config';
import { AMENITY_CONFIG, CATEGORY_CONFIG } from '../config/place-taxonomy.config';

export interface BackendLocationCategory {
  category_name: string;
}

export interface BackendLocationImage {
  id?: string;
  image_url: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

export interface BackendLocationReviewImage {
  image_url: string;
}

export interface BackendLocationReview {
  id: string;
  reviewer_name: string | null;
  reviewer_avatar_url?: string | null;
  reviewer_profile?: string | null;
  rating: number | null;
  review_text: string | null;
  published_at: string | null;
  is_local_guide?: boolean;
  review_images?: BackendLocationReviewImage[];
}

export interface BackendLocationHour {
  day: string;
  times: string[];
}

export interface BackendLocationOwnerPost {
  id: string;
  post_text?: string | null;
  link?: string | null;
  published_at?: string | null;
}

export interface BackendLocationCompetitor {
  name: string;
  suggested_link?: string | null;
  reviews_count?: number | null;
  rating?: number | null;
  main_category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BackendLocationExternalLink {
  link_type: string;
  url: string | null;
}

export interface BackendLocation {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  main_category?: string | null;
  full_address?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  normalized_ward?: string | null;
  rating?: string | number | null;
  reviews_count?: number | null;
  price_range?: string | null;
  website?: string | null;
  phone?: string | null;
  google_maps_link?: string | null;
  menu_link?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  distance?: string | number | null;
  featured_image?: string | null;
  can_claim?: boolean;
  is_temporarily_closed?: boolean;
  is_permanently_closed?: boolean;
  raw_payload?: Record<string, unknown> | null;
  hours?: BackendLocationHour[];
  categories?: BackendLocationCategory[];
  images?: BackendLocationImage[];
  reviews?: BackendLocationReview[];
  owner_posts?: BackendLocationOwnerPost[];
  competitors?: BackendLocationCompetitor[];
  external_links?: BackendLocationExternalLink[];
}

@Injectable({
  providedIn: 'root',
})
export class PlaceMapperService {
  normalizeBackendLocation(
    location: BackendLocation,
    index: number,
    totalCount: number,
    fallbackCityId?: string
  ): Place {
    const rawPayload = location.raw_payload ?? {};
    const sourceCategories =
      location.categories?.map((category) => category.category_name) ??
      this.readStringArray(rawPayload['categories']);
    const images = [
      ...(location.images?.map((image) => image.image_url) ?? []),
      location.featured_image ?? null,
    ].filter((image, imageIndex, array): image is string => Boolean(image) && array.indexOf(image) === imageIndex);
    const gallery = images.map((image, imageIndex) => ({
      id: `${location.id}-${imageIndex}`,
      url: image,
    }));
    const reviews = (location.reviews ?? []).map((review) => ({
      id: review.id,
      place_slug: location.slug,
      source: 'external' as const,
      user_name: review.reviewer_name ?? 'Khach hang',
      avatar:
        review.reviewer_avatar_url ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer_name ?? 'Khach')}&background=e2e8f0&color=0f172a`,
      rating: review.rating ?? 0,
      comment: review.review_text?.trim() || 'Khach hang chua de lai noi dung.',
      created_at: review.published_at ?? new Date().toISOString(),
      images: (review.review_images ?? []).map((image) => image.image_url),
      reviewer_profile: review.reviewer_profile ?? null,
      is_local_guide: review.is_local_guide ?? false,
    }));
    const categoryIds = this.mapCategoriesFromSource(
      `${location.main_category ?? ''} ${sourceCategories.join(' ')} ${location.description ?? ''}`
    );
    const amenityIds = this.mapAmenitiesFromSource(
      `${location.description ?? ''} ${sourceCategories.join(' ')}`
    );
    const reviewCount = location.reviews_count ?? reviews.length;
    const score = (Number(location.rating ?? 0) || 0) * 100 + reviewCount;
    const hotThreshold = Math.max(3, Math.floor(totalCount * 0.4));
    const directHours = Array.isArray(location.hours) ? location.hours : [];
    const rawHours = directHours.length
      ? directHours
      : Array.isArray(rawPayload['hours'])
        ? rawPayload['hours']
        : [];
    const hours = rawHours
      .map((item) => ({
        day: typeof item?.day === 'string' ? item.day : '',
        times: Array.isArray(item?.times)
          ? item.times.filter((time: unknown): time is string => typeof time === 'string')
          : [],
      }))
      .filter((item) => item.day);
    const externalLinks = location.external_links ?? [];
    const reservationsLink =
      externalLinks.find((link) => link.link_type === 'reservation')?.url ?? null;

    return {
      id: location.id,
      name: location.name,
      slug: location.slug,
      city_id: this.resolveCityId(location.city, fallbackCityId),
      area_id: this.slugify(location.ward || location.district || location.city || location.name),
      area_name: location.ward || location.district || location.city || location.name,
      district_id: this.slugify(location.district || location.city || location.name),
      district_name: location.district || location.city || 'Khac',
      ward_name: location.ward || location.normalized_ward || location.district || 'Khac',
      city_name: location.city || 'Khac',
      address: location.full_address || location.name,
      image:
        images[0] ??
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1200',
      gallery,
      rating: Number(location.rating ?? 0) || 0,
      review_count: reviewCount,
      price_range: this.normalizePriceRange(location.price_range),
      categories: categoryIds,
      category_labels: categoryIds.map((categoryId) => this.getCategoryLabel(categoryId)),
      source_categories: sourceCategories,
      amenities: amenityIds,
      amenity_labels: amenityIds.map((amenityId) => this.getAmenityLabel(amenityId)),
      is_hot: index < hotThreshold || score >= 420,
      is_new: (location.owner_posts?.length ?? 0) > 0,
      description: this.normalizeDescription(location.description, location.name),
      status: this.buildStatus({
        status: null,
        is_temporarily_closed: Boolean(location.is_temporarily_closed),
        is_permanently_closed: Boolean(location.is_permanently_closed),
      }),
      phone: location.phone ?? null,
      website: location.website ?? null,
      google_maps_link: location.google_maps_link ?? null,
      menu_link: location.menu_link ?? null,
      reservations_link: reservationsLink,
      latitude: this.toNumber(location.latitude),
      longitude: this.toNumber(location.longitude),
      distance_km: this.toNumber(location.distance) ?? null,
      hours,
      highlights: sourceCategories.slice(0, 5),
      owner_name: this.readOwnerName(rawPayload),
      owner_posts: (location.owner_posts ?? []).slice(0, 3).map((post) => ({
        id: post.id,
        text: post.post_text ?? null,
        link: post.link ?? null,
        published_at: post.published_at ?? null,
        image: null,
      })),
      competitors: (location.competitors ?? []).slice(0, 4).map((competitor) => ({
        name: competitor.name,
        suggested_link: competitor.suggested_link ?? null,
        reviews: competitor.reviews_count ?? undefined,
        rating: competitor.rating ?? undefined,
        main_category: competitor.main_category ?? undefined,
        latitude: this.toNumber(competitor.latitude),
        longitude: this.toNumber(competitor.longitude),
      })),
      reviews,
      can_claim: Boolean(location.can_claim),
      is_temporarily_closed: Boolean(location.is_temporarily_closed),
      is_permanently_closed: Boolean(location.is_permanently_closed),
    };
  }

  normalizeExternalLocation(
    location: ExternalLocation,
    index: number,
    totalCount: number,
    categories: Category[],
    amenities: Amenity[]
  ): Place {
    const districtName = this.extractDistrictName(location);
    const areaName = location.detailed_address?.ward?.trim() || districtName || 'Khu vuc khac';
    const categoryIds = this.mapCategories(location, categories);
    const amenityIds = this.mapAmenities(location, amenities);
    const images = [
      ...(location.featured_images ?? []),
      ...(location.images ?? []),
      ...(location.featured_image ? [location.featured_image] : []),
    ].filter((image, imageIndex, array) => Boolean(image) && array.indexOf(image) === imageIndex);
    const gallery = images.map((image, imageIndex) => ({
      id: `${location.place_id}-${imageIndex}`,
      url: image,
    }));
    const reviews = this.mapExternalReviews(location);
    const reviewCount = location.reviews ?? reviews.length;
    const score = (location.rating ?? 0) * 100 + reviewCount;
    const hotThreshold = Math.max(3, Math.floor(totalCount * 0.4));

    return {
      id: location.place_id,
      name: location.name,
      slug: this.slugify(location.name),
      city_id: 'hcm',
      area_id: this.slugify(areaName),
      area_name: areaName,
      district_id: this.slugify(districtName || 'ho-chi-minh'),
      district_name: districtName || 'Ho Chi Minh',
      ward_name: areaName,
      city_name: location.detailed_address?.city?.trim() ?? 'Ho Chi Minh',
      address: location.address?.trim() ?? location.name,
      image:
        images[0] ??
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1200',
      gallery,
      rating: location.rating ?? 0,
      review_count: reviewCount,
      price_range: this.normalizePriceRange(location.price_range),
      categories: categoryIds,
      category_labels: categoryIds.map((categoryId) => this.getCategoryLabel(categoryId)),
      source_categories: location.categories ?? [],
      amenities: amenityIds,
      amenity_labels: amenityIds.map((amenityId) => this.getAmenityLabel(amenityId)),
      is_hot: index < hotThreshold || score >= 420,
      is_new: (location.owner_posts?.length ?? 0) > 0,
      description: this.normalizeDescription(location.description, location.name),
      status: this.buildStatus(location),
      phone: location.phone ?? null,
      website: location.website ?? null,
      google_maps_link: location.link ?? null,
      menu_link: location.menu?.link ?? null,
      reservations_link: location.reservations?.link ?? null,
      latitude: location.coordinates?.latitude,
      longitude: location.coordinates?.longitude,
      distance_km: null,
      hours: location.hours ?? [],
      highlights: this.buildHighlights(location),
      owner_name: location.owner?.name ?? null,
      owner_posts: (location.owner_posts ?? []).slice(0, 3).map((post, postIndex) => ({
        id: post.post_id ?? `${location.place_id}-post-${postIndex}`,
        text: post.post_text ?? null,
        link: post.link ?? null,
        published_at: post.published_at ?? null,
        image: post.images?.[0] ?? null,
      })),
      competitors: (location.competitors ?? []).slice(0, 4).map((competitor) => ({
        name: competitor.name,
        suggested_link: competitor.suggested_link,
        reviews: competitor.reviews,
        rating: competitor.rating,
        main_category: competitor.main_category,
        latitude: competitor.coordinates?.latitude,
        longitude: competitor.coordinates?.longitude,
      })),
      reviews,
      can_claim: Boolean(location.can_claim),
      is_temporarily_closed: Boolean(location.is_temporarily_closed),
      is_permanently_closed: Boolean(location.is_permanently_closed),
    };
  }

  private mapExternalReviews(location: ExternalLocation): PlaceReview[] {
    const reviews = [...(location.detailed_reviews ?? []), ...(location.featured_reviews ?? [])];
    const seenIds = new Set<string>();

    return reviews
      .filter((review) => {
        if (seenIds.has(review.review_id)) {
          return false;
        }

        seenIds.add(review.review_id);
        return true;
      })
      .slice(0, 8)
      .map((review) => ({
        id: review.review_id,
        place_slug: this.slugify(location.name),
        source: 'external',
        user_name: review.name,
        avatar:
          review.avatar_link ??
          `https://ui-avatars.com/api/?name=${encodeURIComponent(review.name)}&background=e2e8f0&color=0f172a`,
        rating: review.rating,
        comment: review.review_text?.trim() ?? 'Khach hang chua de lai noi dung.',
        created_at: review.published_at_date ?? new Date().toISOString(),
        images: (review.review_photos ?? []).slice(0, 4).map((photo) => photo.url),
        reviewer_profile: review.reviewer_profile ?? null,
        is_local_guide: review.is_local_guide ?? false,
      }));
  }

  private mapCategories(location: ExternalLocation, categories: Category[]): string[] {
    const source = `${location.main_category ?? ''} ${(location.categories ?? []).join(' ')} ${
      location.description ?? ''
    }`.toLowerCase();
    const categoryIds = new Set<string>(['cafe']);

    if (source.includes('bar') || source.includes('lounge') || source.includes('restaurant')) {
      categoryIds.add('date');
      categoryIds.add('group');
    }

    if (
      source.includes('art') ||
      source.includes('view') ||
      source.includes('dog') ||
      source.includes('koi') ||
      source.includes('decor')
    ) {
      categoryIds.add('photo');
    }

    if (
      source.includes('quiet') ||
      source.includes('study') ||
      source.includes('work') ||
      source.includes('espresso')
    ) {
      categoryIds.add('work');
    }

    if (source.includes('beer') || source.includes('group') || source.includes('pub')) {
      categoryIds.add('group');
    }

    if (source.includes('romantic') || source.includes('atmosphere')) {
      categoryIds.add('date');
    }

    return categories
      .map((category) => category.id)
      .filter((categoryId) => categoryIds.has(categoryId));
  }

  private mapAmenities(location: ExternalLocation, amenities: Amenity[]): string[] {
    const source = `${location.description ?? ''} ${(location.categories ?? []).join(' ')} ${
      location.review_keywords?.map((keyword) => keyword.keyword).join(' ') ?? ''
    }`.toLowerCase();
    const amenityIds = new Set<string>();

    if (source.includes('wifi')) amenityIds.add('wifi');
    if (source.includes('quiet') || source.includes('yen tinh') || source.includes('work')) amenityIds.add('quiet');
    if (source.includes('music') || source.includes('beer') || source.includes('acoustic')) amenityIds.add('music');
    if (source.includes('outdoor') || source.includes('terrace') || source.includes('koi')) amenityIds.add('outdoor');
    if (source.includes('parking') || source.includes('airport') || source.includes('car')) amenityIds.add('parking');
    if (location.hours?.some((hour) => hour.times.some((time) => time.includes('23:00')))) amenityIds.add('late');

    return amenities
      .map((amenity) => amenity.id)
      .filter((amenityId) => amenityIds.has(amenityId));
  }

  private mapCategoriesFromSource(source: string): string[] {
    return this.mapSourceToIds(source, CATEGORY_CONFIG.map((category) => category.id), true);
  }

  private mapAmenitiesFromSource(source: string): string[] {
    return this.mapSourceToIds(source, AMENITY_CONFIG.map((amenity) => amenity.id), false);
  }

  private mapSourceToIds(source: string, ids: string[], includeCafeDefault: boolean): string[] {
    const normalized = source.toLowerCase();
    const matches = new Set<string>(includeCafeDefault ? ['cafe'] : []);

    if (normalized.includes('bar') || normalized.includes('restaurant') || normalized.includes('nha hang')) {
      matches.add('date');
      matches.add('group');
    }

    if (
      normalized.includes('work') ||
      normalized.includes('study') ||
      normalized.includes('quiet') ||
      normalized.includes('yen tinh')
    ) {
      matches.add('work');
      matches.add('quiet');
    }

    if (
      normalized.includes('view') ||
      normalized.includes('decor') ||
      normalized.includes('koi') ||
      normalized.includes('art')
    ) {
      matches.add('photo');
      matches.add('outdoor');
    }

    if (normalized.includes('wifi')) matches.add('wifi');
    if (normalized.includes('music')) matches.add('music');
    if (normalized.includes('parking')) matches.add('parking');
    if (normalized.includes('23:00')) matches.add('late');

    return ids.filter((id) => matches.has(id));
  }

  private buildHighlights(location: ExternalLocation): string[] {
    const keywordHighlights = (location.review_keywords ?? [])
      .slice(0, 5)
      .map((keyword) => keyword.keyword.replace(/_/g, ' '));
    const categoryHighlights = (location.categories ?? []).slice(0, 3);
    const combined = [...keywordHighlights, ...categoryHighlights].filter(Boolean);

    return [...new Set(combined)].slice(0, 6);
  }

  private normalizeDescription(description: string | null | undefined, name: string): string {
    if (description?.trim()) {
      return description.trim().replace(/\s+/g, ' ');
    }

    return `${name} la mot dia diem dang duoc cong dong quan tam, phu hop de cafe, hen ho va kham pha khong gian moi.`;
  }

  private buildStatus(location: {
    status?: string | null;
    is_temporarily_closed?: boolean;
    is_permanently_closed?: boolean;
  }): string {
    if (location.is_permanently_closed) return 'Da dong cua';
    if (location.is_temporarily_closed) return 'Tam dong cua';
    return location.status?.trim() || 'Dang mo cua';
  }

  private normalizePriceRange(priceRange: string | null | undefined): string {
    if (!priceRange?.trim()) {
      return 'Dang cap nhat';
    }

    return priceRange.replace(/N D/g, 'VND').replace(/\s+/g, ' ').trim();
  }

  private extractDistrictName(location: ExternalLocation): string {
    return (
      location.detailed_address?.state?.trim() ||
      location.detailed_address?.ward?.trim() ||
      location.address?.split(',').slice(-2, -1)[0]?.trim() ||
      'Ho Chi Minh'
    );
  }

  private getCategoryLabel(categoryId: string): string {
    return CATEGORY_CONFIG.find((category) => category.id === categoryId)?.name ?? categoryId;
  }

  private getAmenityLabel(amenityId: string): string {
    return AMENITY_CONFIG.find((amenity) => amenity.id === amenityId)?.name ?? amenityId;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private resolveCityId(cityName?: string | null, fallbackCityId?: string): string {
    const normalized = this.slugify(cityName ?? '');
    const match = PROVINCE_MAPPINGS.find((mapping) => {
      if (mapping.id === 'hcm') return normalized.includes('ho-chi-minh');
      if (mapping.id === 'hn') return normalized.includes('ha-noi');
      if (mapping.id === 'dl') return normalized.includes('da-lat') || normalized.includes('lam-dong');
      return false;
    });

    return match?.id ?? fallbackCityId ?? 'hcm';
  }

  private toNumber(value: string | number | null | undefined): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private readOwnerName(rawPayload: Record<string, unknown>): string | null {
    const owner = rawPayload['owner'];

    if (!owner || typeof owner !== 'object' || owner === null) {
      return null;
    }

    return typeof (owner as { name?: unknown }).name === 'string'
      ? ((owner as { name: string }).name ?? null)
      : null;
  }
}
