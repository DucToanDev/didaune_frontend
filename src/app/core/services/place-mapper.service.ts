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
import { buildUiAvatarUrl } from '../utils/avatar.utils';

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
  call_to_action?: string | null;
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
  title?: string | null;
  provider?: string | null;
  url: string | null;
}

export interface BackendLocationAmenity {
  name?: string | null;
  enabled?: boolean | null;
}

interface BackendRawPayloadAboutOption {
  name?: string | null;
  enabled?: boolean | null;
}

interface BackendRawPayloadAboutGroup {
  id?: string | null;
  name?: string | null;
  options?: BackendRawPayloadAboutOption[] | null;
}

export interface BackendLocationBookingPlatform {
  name?: string | null;
  price?: string | null;
  price_with_tax?: string | null;
  link?: string | null;
  is_official_website?: boolean | null;
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
  price?: string | null;
  price_range?: string | null;
  website?: string | null;
  phone?: string | null;
  google_maps_link?: string | null;
  menu_link?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  distance?: string | number | null;
  featured_image?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  can_claim?: boolean;
  is_temporarily_closed?: boolean;
  is_permanently_closed?: boolean;
  hotel_stars?: number | null;
  sleeps?: number | null;
  bedrooms?: number | null;
  beds?: number | null;
  bathrooms?: number | string | null;
  min_nights?: number | null;
  checkin_time?: string | null;
  checkout_time?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  closed_on?: string | null;
  most_popular_times?: string | null;
  popular_times?: string | null;
  amenities_json?: BackendLocationAmenity[] | null;
  booking_platforms_json?: BackendLocationBookingPlatform[] | null;
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
  private readonly travelKeywords = [
    'travel',
    'du lich',
    'tour',
    'attraction',
    'tourist',
    'tourism',
    'sightseeing',
    'hop on hop off',
    'diem thu hut khach du lich',
    'diem den du lich',
    'tham quan',
    'nha dieu hanh du lich',
    'dai ly du lich',
    'du lich bang xe buyt',
    'museum',
    'bao tang',
    'park',
    'beach',
    'landmark',
    'temple',
    'di tich',
    'diem moc lich su',
    'heritage',
  ];

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
      ...(this.readImageUrls(rawPayload['featured_images']) ?? []),
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
      user_name: review.reviewer_name ?? 'Khách hàng',
      avatar:
        review.reviewer_avatar_url ??
        buildUiAvatarUrl(review.reviewer_name ?? 'Khach', 'e2e8f0', '0f172a'),
      rating: review.rating ?? 0,
      comment: review.review_text?.trim() || 'Khách hàng chưa để lại nội dung.',
      created_at: review.published_at ?? new Date().toISOString(),
      images: (review.review_images ?? []).map((image) => image.image_url),
      reviewer_profile: review.reviewer_profile ?? null,
      is_local_guide: review.is_local_guide ?? false,
    }));
    const primaryCategorySource = `${location.main_category ?? ''} ${sourceCategories.join(' ')}`;
    const tagCategorySource = `${location.name ?? ''} ${location.description ?? ''} ${primaryCategorySource}`;
    const categoryIds = this.mapCategoriesFromBackendLocation(
      location,
      rawPayload,
      [location.main_category ?? '', ...sourceCategories],
      primaryCategorySource,
      tagCategorySource,
    );
    const amenityOptions = this.readAmenityOptions(location, rawPayload);
    const amenityIds = this.resolveAmenityIds(
      amenityOptions,
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
    const bookingPlatforms = this.readBookingPlatforms(location, rawPayload);

    const normalizedPlace: Place = {
      id: location.id,
      name: location.name,
      slug: location.slug,
      city_id: this.resolveCityId(location.city, fallbackCityId),
      area_id: this.slugify(location.ward || location.district || location.city || location.name),
      area_name: location.ward || location.district || location.city || location.name,
      district_id: this.slugify(location.district || location.city || location.name),
      district_name: location.district || location.city || 'Khác',
      ward_name: location.ward || location.normalized_ward || location.district || 'Khác',
      city_name: location.city || 'Khác',
      address: location.full_address || location.name,
      image:
        images[0] ??
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=1200',
      gallery,
      rating: Number(location.rating ?? 0) || 0,
      review_count: reviewCount,
      price: this.normalizePrice(location.price, bookingPlatforms, location.price_range),
      price_range: this.normalizePriceRange(location.price_range),
      categories: categoryIds,
      category_labels: categoryIds.map((categoryId) => this.getCategoryLabel(categoryId)),
      source_categories: sourceCategories,
      amenities: amenityIds,
      amenity_labels: amenityIds.map((amenityId) => this.getAmenityLabel(amenityId)),
      amenity_options: amenityOptions,
      booking_platforms: bookingPlatforms,
      hotel_stars: this.toNumber(location.hotel_stars) ?? null,
      sleeps: this.toNumber(location.sleeps) ?? null,
      bedrooms: this.toNumber(location.bedrooms) ?? null,
      beds: this.toNumber(location.beds) ?? null,
      bathrooms: this.toNumber(location.bathrooms) ?? null,
      min_nights: this.toNumber(location.min_nights) ?? null,
      checkin_time: location.checkin_time ?? this.readString(rawPayload['checkin_time']),
      checkout_time: location.checkout_time ?? this.readString(rawPayload['checkout_time']),
      checkin_date: location.checkin_date ?? this.readString(rawPayload['checkin_date']),
      checkout_date: location.checkout_date ?? this.readString(rawPayload['checkout_date']),
      closed_on: location.closed_on ?? this.readString(rawPayload['closed_on']),
      most_popular_times: location.most_popular_times ?? this.readString(rawPayload['most_popular_times']),
      popular_times: location.popular_times ?? this.readString(rawPayload['popular_times']),
      is_hot: index < hotThreshold || score >= 420,
      is_new: (location.owner_posts?.length ?? 0) > 0,
      description: this.normalizeDescription(location.description, location.name, categoryIds),
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
      owner_id: this.readString(location.owner_id) ?? this.readOwnerId(rawPayload),
      owner_name: location.owner_name ?? this.readOwnerName(rawPayload),
      owner_posts: (location.owner_posts ?? []).slice(0, 3).map((post) => ({
        id: post.id,
        text: post.post_text ?? null,
        link: post.link ?? null,
        published_at: post.published_at ?? null,
        image: null,
        call_to_action: post.call_to_action ?? null,
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

    if (this.normalizeSearchText(location.name).includes('song anh')) {
      console.log('[place-mapper][backend]', {
        name: location.name,
        main_category: location.main_category,
        source_categories: sourceCategories,
        mapped_categories: normalizedPlace.categories,
        mapped_category_labels: normalizedPlace.category_labels,
      });
    }

    return normalizedPlace;
  }

  normalizeExternalLocation(
    location: ExternalLocation,
    index: number,
    totalCount: number,
    categories: Category[],
    amenities: Amenity[]
  ): Place {
    const districtName = this.extractDistrictName(location);
    const areaName = location.detailed_address?.ward?.trim() || districtName || 'Khu vực khác';
    const primaryCategorySource = `${location.main_category ?? ''} ${(location.categories ?? []).join(' ')}`;
    const tagCategorySource = `${location.name} ${location.description ?? ''} ${primaryCategorySource}`;
    const categoryIds = this.inferCategoryIds(
      [location.main_category ?? '', ...(location.categories ?? [])],
      primaryCategorySource,
      tagCategorySource,
      categories.map((category) => category.id)
    );
    const amenityOptions = (location.amenities ?? []).map((item) => ({
      name: item?.name?.trim() || 'Tiện ích',
      enabled: Boolean(item?.enabled),
    }));
    const amenityIds = this.resolveAmenityIds(
      amenityOptions,
      `${location.description ?? ''} ${(location.categories ?? []).join(' ')} ${
        location.review_keywords?.map((keyword) => keyword.keyword).join(' ') ?? ''
      }`,
      amenities
    );
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

    const normalizedPlace: Place = {
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
      price: this.normalizePrice(location.price, location.booking_platforms ?? [], location.price_range),
      price_range: this.normalizePriceRange(location.price_range),
      categories: categoryIds,
      category_labels: categoryIds.map((categoryId) => this.getCategoryLabel(categoryId)),
      source_categories: location.categories ?? [],
      amenities: amenityIds,
      amenity_labels: amenityIds.map((amenityId) => this.getAmenityLabel(amenityId)),
      amenity_options: amenityOptions,
      booking_platforms: (location.booking_platforms ?? []).map((platform) => ({
        name: platform.name?.trim() || 'Booking',
        price: platform.price ?? null,
        price_with_tax: platform.price_with_tax ?? null,
        link: platform.link ?? null,
        is_official_website: Boolean(platform.is_official_website),
      })),
      hotel_stars: location.hotel_stars ?? null,
      sleeps: location.sleeps ?? null,
      bedrooms: location.bedrooms ?? null,
      beds: location.beds ?? null,
      bathrooms: location.bathrooms ?? null,
      min_nights: location.min_nights ?? null,
      checkin_time: location.checkin_time ?? null,
      checkout_time: location.checkout_time ?? null,
      checkin_date: location.checkin_date ?? null,
      checkout_date: location.checkout_date ?? null,
      closed_on: location.closed_on ?? null,
      most_popular_times: location.most_popular_times ?? null,
      popular_times: location.popular_times ?? null,
      is_hot: index < hotThreshold || score >= 420,
      is_new: (location.owner_posts?.length ?? 0) > 0,
      description: this.normalizeDescription(location.description, location.name, categoryIds),
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
      owner_id: location.owner?.id ?? null,
      owner_name: location.owner?.name ?? null,
      owner_posts: (location.owner_posts ?? []).slice(0, 3).map((post, postIndex) => ({
        id: post.post_id ?? `${location.place_id}-post-${postIndex}`,
        text: post.post_text ?? null,
        link: post.link ?? null,
        published_at: post.published_at ?? null,
        image: post.images?.[0] ?? null,
        call_to_action: this.callToActionLabel(post.call_to_action ?? null),
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

    if (this.normalizeSearchText(location.name).includes('song anh')) {
      console.log('[place-mapper][external]', {
        name: location.name,
        main_category: location.main_category,
        source_categories: location.categories ?? [],
        mapped_categories: normalizedPlace.categories,
        mapped_category_labels: normalizedPlace.category_labels,
      });
    }

    return normalizedPlace;
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
          buildUiAvatarUrl(review.name, 'e2e8f0', '0f172a'),
        rating: review.rating,
        comment: review.review_text?.trim() ?? 'Khách hàng chưa để lại nội dung.',
        created_at: review.published_at_date ?? new Date().toISOString(),
        images: (review.review_photos ?? []).slice(0, 4).map((photo) => photo.url),
        reviewer_profile: review.reviewer_profile ?? null,
        is_local_guide: review.is_local_guide ?? false,
      }));
  }

  private mapCategoriesFromSource(source: string): string[] {
    return this.inferCategoryIds(
      [source],
      source,
      source,
      CATEGORY_CONFIG.map((category) => category.id),
    );
  }

  private mapCategoriesFromBackendLocation(
    location: BackendLocation,
    rawPayload: Record<string, unknown>,
    primaryLabels: string[],
    primarySource: string,
    tagSource: string,
  ): string[] {
    const normalizedPrimary = this.normalizeSearchText(primarySource);
    const normalizedTag = this.normalizeSearchText(tagSource);
    const matches = new Set<string>();
    const primaryCategoryId =
      this.resolvePrimaryCategoryFromOrderedLabels(primaryLabels) ??
      this.resolvePrimaryCategoryFromBackendLocation(
      location,
      rawPayload,
      normalizedPrimary
    );

    if (primaryCategoryId) {
      matches.add(primaryCategoryId);
    } else {
      matches.add('travel');
    }

    if (this.includesAny(normalizedTag, ['romantic', 'date', 'couple', 'hen ho', 'lounge', 'cocktail', 'wine'])) {
      matches.add('date');
    }

    if (this.includesAny(normalizedTag, ['group', 'family', 'friends', 'party', 'bbq', 'lau', 'pub', 'beer'])) {
      matches.add('group');
    }

    if (this.includesAny(normalizedTag, ['work', 'study', 'cowork', 'wifi', 'quiet', 'yen tinh'])) {
      matches.add('work');
    }

    if (this.includesAny(normalizedTag, ['photo', 'check in', 'check-in', 'decor', 'view', 'art', 'studio', 'song ao'])) {
      matches.add('photo');
    }

    return CATEGORY_CONFIG.map((category) => category.id).filter((id) => matches.has(id));
  }

  private inferCategoryIds(
    primaryLabels: string[],
    primarySource: string,
    tagSource: string,
    ids: string[],
  ): string[] {
    const normalizedPrimary = this.normalizeSearchText(primarySource);
    const normalizedTag = this.normalizeSearchText(tagSource);
    const matches = new Set<string>();

    const primaryCategoryId =
      this.resolvePrimaryCategoryFromOrderedLabels(primaryLabels) ??
      this.resolvePrimaryCategory(normalizedPrimary);

    if (primaryCategoryId) {
      matches.add(primaryCategoryId);
    } else {
      matches.add('travel');
    }

    if (this.includesAny(normalizedTag, ['romantic', 'date', 'couple', 'hen ho', 'lounge', 'cocktail', 'wine'])) {
      matches.add('date');
    }

    if (this.includesAny(normalizedTag, ['group', 'family', 'friends', 'party', 'bbq', 'lau', 'pub', 'beer'])) {
      matches.add('group');
    }

    if (this.includesAny(normalizedTag, ['work', 'study', 'cowork', 'wifi', 'quiet', 'yen tinh'])) {
      matches.add('work');
    }

    if (this.includesAny(normalizedTag, ['photo', 'check in', 'check-in', 'decor', 'view', 'art', 'studio', 'song ao'])) {
      matches.add('photo');
    }

    return ids.filter((id) => matches.has(id));
  }

  private resolvePrimaryCategory(source: string): string | null {
    if (this.includesAny(source, ['homestay', 'guest house', 'guesthouse', 'hostel', 'villa', 'bungalow', 'apartment rental', 'apartment', 'rental'])) {
      return 'homestay';
    }

    if (this.includesAny(source, ['hotel', 'resort', 'motel', 'lodging'])) {
      return 'hotel';
    }

    if (this.includesAny(source, ['restaurant', 'nha hang', 'quan an', 'food', 'eatery', 'bistro', 'buffet', 'brunch', 'bua nua buoi', 'tiem an'])) {
      return 'restaurant';
    }

    if (this.includesAny(source, ['cafe', 'coffee shop', 'coffee', 'ca phe', 'quan ca phe', 'tiem banh', 'bakery', 'patisserie', 'espresso', 'tra sua', 'tea house'])) {
      return 'cafe';
    }

    if (this.includesAny(source, this.travelKeywords)) {
      return 'travel';
    }

    return null;
  }

  private resolvePrimaryCategoryFromOrderedLabels(labels: string[]): string | null {
    const resolvedByLabel: string[] = [];
    const normalizedLabels = labels
      .map((label) => this.normalizeSearchText(label))
      .filter((label) => Boolean(label));

    for (const normalizedLabel of normalizedLabels) {
      const resolved = this.resolvePrimaryCategory(normalizedLabel);

      if (resolved) {
        resolvedByLabel.push(resolved);
      }
    }

    const firstResolved = resolvedByLabel[0] ?? null;

    if (!firstResolved) {
      return null;
    }

    const hasFoodLikeLabel = resolvedByLabel.includes('restaurant') || resolvedByLabel.includes('cafe');
    const hasStayLikeLabel = resolvedByLabel.includes('hotel') || resolvedByLabel.includes('homestay');
    const mainLabel = normalizedLabels[0] ?? '';
    const mainResolved = this.resolvePrimaryCategory(mainLabel);

    if (mainResolved === 'restaurant' || mainResolved === 'cafe') {
      return mainResolved;
    }

    if ((mainResolved === 'hotel' || mainResolved === 'homestay') && !hasFoodLikeLabel) {
      return mainResolved;
    }

    if (hasFoodLikeLabel && hasStayLikeLabel) {
      if (resolvedByLabel.includes('restaurant')) {
        return 'restaurant';
      }

      return 'cafe';
    }

    if (firstResolved === 'cafe' && resolvedByLabel.includes('restaurant')) {
      return 'restaurant';
    }

    return firstResolved;
  }

  private resolvePrimaryCategoryFromBackendLocation(
    location: BackendLocation,
    rawPayload: Record<string, unknown>,
    normalizedSource: string
  ): string | null {
    const hasAccommodationFields =
      this.toNumber(location.hotel_stars) !== undefined ||
      this.toNumber(location.sleeps) !== undefined ||
      this.toNumber(location.bedrooms) !== undefined ||
      this.toNumber(location.beds) !== undefined ||
      this.toNumber(location.bathrooms) !== undefined ||
      this.toNumber(location.min_nights) !== undefined ||
      Boolean(this.readString(location.checkin_time)) ||
      Boolean(this.readString(location.checkout_time)) ||
      Boolean(this.readString(location.checkin_date)) ||
      Boolean(this.readString(location.checkout_date)) ||
      Array.isArray(location.booking_platforms_json) ||
      Array.isArray(rawPayload['booking_platforms']);
    const hasFoodSignals = this.includesAny(normalizedSource, [
      'restaurant',
      'nha hang',
      'quan an',
      'food',
      'eatery',
      'bistro',
      'buffet',
      'brunch',
      'bua nua buoi',
      'tiem an',
      'cafe',
      'coffee shop',
      'coffee',
      'ca phe',
      'quan ca phe',
      'tiem banh',
      'bakery',
      'patisserie',
      'espresso',
      'tea house',
    ]);

    if (
      this.includesAny(normalizedSource, [
        'homestay',
        'guest house',
        'guesthouse',
        'hostel',
        'villa',
        'bungalow',
        'apartment rental',
        'apartment',
        'rental',
        'nha nghi',
        'can ho dich vu',
      ])
    ) {
      if (hasFoodSignals && !hasAccommodationFields) {
        return null;
      }

      return 'homestay';
    }

    if (
      this.includesAny(normalizedSource, [
        'hotel',
        'khach san',
        'resort',
        'motel',
        'lodging',
        'accommodation',
        'luu tru',
      ])
    ) {
      if (hasFoodSignals && !hasAccommodationFields) {
        return null;
      }

      return 'hotel';
    }

    if (hasAccommodationFields) {
      if (this.includesAny(normalizedSource, ['villa', 'apartment', 'guest house', 'guesthouse', 'hostel', 'homestay'])) {
        return 'homestay';
      }

      return 'hotel';
    }

    return this.resolvePrimaryCategory(normalizedSource);
  }

  private includesAny(source: string, keywords: string[]): boolean {
    return keywords.some((keyword) => source.includes(keyword));
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveAmenityIds(
    amenityOptions: Array<{ name: string; enabled: boolean }>,
    source: string,
    amenities: Amenity[] = AMENITY_CONFIG
  ): string[] {
    const amenityIds = new Set<string>();
    const normalizedOptionText = amenityOptions
      .filter((item) => item.enabled)
      .map((item) => item.name.toLowerCase())
      .join(' ');
    const combinedSource = `${source} ${normalizedOptionText}`.toLowerCase();

    if (combinedSource.includes('wifi')) amenityIds.add('wifi');
    if (combinedSource.includes('quiet') || combinedSource.includes('yen tinh') || combinedSource.includes('work')) amenityIds.add('quiet');
    if (combinedSource.includes('music') || combinedSource.includes('beer') || combinedSource.includes('acoustic')) amenityIds.add('music');
    if (combinedSource.includes('outdoor') || combinedSource.includes('terrace') || combinedSource.includes('koi') || combinedSource.includes('garden')) amenityIds.add('outdoor');
    if (combinedSource.includes('parking') || combinedSource.includes('airport') || combinedSource.includes('car')) amenityIds.add('parking');
    if (combinedSource.includes('23:00') || combinedSource.includes('24/7') || combinedSource.includes('24h')) amenityIds.add('late');

    return amenities
      .map((amenity) => amenity.id)
      .filter((amenityId) => amenityIds.has(amenityId));
  }

  private buildHighlights(location: ExternalLocation): string[] {
    const keywordHighlights = (location.review_keywords ?? [])
      .slice(0, 5)
      .map((keyword) => keyword.keyword.replace(/_/g, ' '));
    const categoryHighlights = (location.categories ?? []).slice(0, 3);
    const combined = [...keywordHighlights, ...categoryHighlights].filter(Boolean);

    return [...new Set(combined)].slice(0, 6);
  }

  private normalizeDescription(
    description: string | null | undefined,
    name: string,
    categories: string[]
  ): string {
    if (description?.trim()) {
      return description.trim().replace(/\s+/g, ' ');
    }

    if (categories.includes('hotel') || categories.includes('homestay')) {
      return `${name} là điểm lưu trú đang được nhiều người quan tâm với thông tin giá, tiện ích và lịch trình dễ dàng theo dõi.`;
    }

    if (categories.includes('restaurant')) {
      return `${name} là địa điểm ăn uống đang được cộng đồng tìm kiếm nhiều và phù hợp để lên kế hoạch khám phá.`;
    }

    if (categories.includes('travel')) {
      return `${name} là điểm du lịch đang được cộng đồng chú ý, phù hợp để khám phá và đưa vào lịch trình.`;
    }

    return `${name} là một địa điểm đang được cộng đồng quan tâm và có thể đưa vào hành trình khám phá của bạn.`;
  }

  private buildStatus(location: {
    status?: string | null;
    is_temporarily_closed?: boolean;
    is_permanently_closed?: boolean;
  }): string {
    if (location.is_permanently_closed) return 'Đã đóng cửa';
    if (location.is_temporarily_closed) return 'Tạm đóng cửa';
    return location.status?.trim() || 'Đang mở cửa';
  }

  private normalizePriceRange(priceRange: string | null | undefined): string {
    if (!priceRange?.trim()) {
      return 'Đang cập nhật';
    }

    return priceRange.replace(/N D/g, 'VND').replace(/\s+/g, ' ').trim();
  }

  private normalizePrice(
    price: string | null | undefined,
    bookingPlatforms: Array<{ price?: string | null }> = [],
    priceRange?: string | null
  ): string {
    const direct = this.readString(price);

    if (direct) {
      return direct;
    }

    const fromBooking = bookingPlatforms.find((platform) => this.readString(platform.price))?.price;

    if (fromBooking) {
      return fromBooking;
    }

    if (priceRange?.trim()) {
      return this.normalizePriceRange(priceRange);
    }

    return 'Đang cập nhật';
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

  private readImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && typeof (item as { link?: unknown }).link === 'string') {
          return (item as { link: string }).link;
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));
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

  private readOwnerId(rawPayload: Record<string, unknown>): string | null {
    const owner = rawPayload['owner'];

    if (!owner || typeof owner !== 'object' || owner === null) {
      return null;
    }

    const ownerId = (owner as { id?: unknown }).id;

    if (typeof ownerId === 'string' && ownerId.trim()) {
      return ownerId.trim();
    }

    if (typeof ownerId === 'number' && Number.isFinite(ownerId)) {
      return String(ownerId);
    }

    return null;
  }

  private readAmenityOptions(
    location: BackendLocation,
    rawPayload: Record<string, unknown>
  ): Array<{ name: string; enabled: boolean }> {
    const source = Array.isArray(location.amenities_json)
      ? location.amenities_json
      : Array.isArray(rawPayload['amenities'])
        ? rawPayload['amenities']
        : [];

    const directOptions = source
      .map((item) => {
        const name = item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
          ? (item as { name: string }).name.trim()
          : '';
        const enabled = item && typeof item === 'object'
          ? Boolean((item as { enabled?: unknown }).enabled)
          : false;

        return {
          name: name || 'Tiện ích',
          enabled,
        };
      })
      .filter((item) => Boolean(item.name));

    const allowedGroupIds = new Set([
      'amenities',
      'atmosphere',
      'highlights',
      'offerings',
      'service_options',
      'dining_options',
    ]);
    const merged = new Map<string, { name: string; enabled: boolean }>();

    for (const item of directOptions) {
      merged.set(this.normalizeSearchText(item.name), item);
    }

    for (const group of this.readAboutGroups(rawPayload)) {
      const groupId = this.readString(group.id)?.toLowerCase() ?? '';

      if (!allowedGroupIds.has(groupId)) {
        continue;
      }

      for (const option of group.options ?? []) {
        const optionName = this.readString(option.name);

        if (!optionName) {
          continue;
        }

        const key = this.normalizeSearchText(optionName);
        const enabled = option.enabled !== false;
        const existing = merged.get(key);

        if (!existing) {
          merged.set(key, { name: optionName, enabled });
          continue;
        }

        if (enabled && !existing.enabled) {
          merged.set(key, { ...existing, enabled: true });
        }
      }
    }

    return [...merged.values()];
  }

  private readBookingPlatforms(
    location: BackendLocation,
    rawPayload: Record<string, unknown>
  ): Array<{
    name: string;
    price?: string | null;
    price_with_tax?: string | null;
    link?: string | null;
    is_official_website?: boolean;
  }> {
    const source = Array.isArray(location.booking_platforms_json)
      ? location.booking_platforms_json
      : Array.isArray(rawPayload['booking_platforms'])
        ? rawPayload['booking_platforms']
        : [];

    return source.reduce<Array<{ name: string; price?: string | null; price_with_tax?: string | null; link?: string | null; is_official_website?: boolean }>>((platforms, item) => {
      if (!item || typeof item !== 'object') {
        return platforms;
      }

      const platform = item as Record<string, unknown>;
      platforms.push({
        name: this.readString(platform['name']) || 'Booking',
        price: this.readString(platform['price']),
        price_with_tax: this.readString(platform['price_with_tax']),
        link: this.readString(platform['link']),
        is_official_website: Boolean(platform['is_official_website']),
      });

      return platforms;
    }, []);
  }

  private readAboutGroups(rawPayload: Record<string, unknown>): BackendRawPayloadAboutGroup[] {
    const about = rawPayload['about'];

    if (!Array.isArray(about)) {
      return [];
    }

    return about.filter(
      (item): item is BackendRawPayloadAboutGroup =>
        Boolean(item) && typeof item === 'object'
    );
  }

  private readString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return null;
  }

  private callToActionLabel(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === 'object') {
      const text = this.readString((value as { text?: unknown }).text);
      const link = this.readString((value as { link?: unknown }).link);

      if (text && link) {
        return `${text} � ${link}`;
      }

      return text ?? link;
    }

    return null;
  }
}

