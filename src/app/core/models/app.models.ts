export interface City {
  id: string;
  name: string;
}

export interface District {
  id: string;
  city_id: string;
  name: string;
}

export interface Ward {
  code: number;
  name: string;
  province_code: number;
  division_type?: string;
  codename?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Amenity {
  id: string;
  name: string;
  icon: string;
}

export interface PlaceHour {
  day: string;
  times: string[];
}

export interface PlaceGalleryImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
  caption?: string | null;
}

export interface PlaceOwnerPost {
  id: string;
  text: string | null;
  link: string | null;
  published_at: string | null;
  image?: string | null;
}

export interface PlaceCompetitor {
  name: string;
  suggested_link?: string | null;
  reviews?: number;
  rating?: number;
  main_category?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlaceReview {
  id: string;
  place_slug: string;
  source: 'external' | 'internal';
  user_name: string;
  avatar: string;
  rating: number;
  comment: string;
  created_at: string;
  images: string[];
  reviewer_profile?: string | null;
  is_local_guide?: boolean;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  area_id: string;
  area_name: string;
  district_id: string;
  district_name: string;
  ward_name: string;
  city_name: string;
  address: string;
  image: string;
  gallery: PlaceGalleryImage[];
  rating: number;
  review_count: number;
  price_range: string;
  categories: string[];
  category_labels: string[];
  source_categories: string[];
  amenities: string[];
  amenity_labels: string[];
  is_hot: boolean;
  is_new: boolean;
  discount?: string;
  description: string;
  status: string;
  phone?: string | null;
  website?: string | null;
  google_maps_link?: string | null;
  menu_link?: string | null;
  reservations_link?: string | null;
  latitude?: number;
  longitude?: number;
  distance_km?: number | null;
  hours: PlaceHour[];
  highlights: string[];
  owner_name?: string | null;
  owner_posts: PlaceOwnerPost[];
  competitors: PlaceCompetitor[];
  reviews: PlaceReview[];
  can_claim: boolean;
  is_temporarily_closed: boolean;
  is_permanently_closed: boolean;
}

export interface HomeHero {
  province_code: number | null;
  ward_code: number | null;
  total_places: number;
  district_count: number;
  ward_count: number;
}

export interface HomeCategorySummary {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  count: number;
}

export interface HomeAreaSummary {
  name: string;
  count: number;
}

export interface HomePageData {
  hero: HomeHero;
  featured_places: Place[];
  trending_places: Place[];
  new_places: Place[];
  nearby_places: Place[];
  demand_categories: HomeCategorySummary[];
  top_categories: HomeCategorySummary[];
  top_areas: HomeAreaSummary[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  membership: string;
  points: number;
}

export interface Review extends PlaceReview {
  user_id?: string;
  place_id?: string;
}

export interface ExternalLocationReviewKeyword {
  keyword: string;
  count: number;
}

export interface ExternalLocationReviewPhoto {
  id: string;
  url: string;
  caption?: string | null;
  width?: number;
  height?: number;
}

export interface ExternalLocationReview {
  review_id: string;
  review_link?: string;
  name: string;
  reviewer_profile?: string;
  rating: number;
  review_text?: string | null;
  avatar_link?: string;
  published_at?: string;
  published_at_date?: string;
  is_local_guide?: boolean;
  review_photos?: ExternalLocationReviewPhoto[];
}

export interface ExternalLocationHour {
  day: string;
  times: string[];
}

export interface ExternalLocation {
  place_id: string;
  name: string;
  description?: string | null;
  link?: string | null;
  reviews?: number;
  rating?: number;
  categories?: string[];
  main_category?: string | null;
  address?: string | null;
  price_range?: string | null;
  website?: string | null;
  phone?: string | null;
  can_claim?: boolean;
  featured_image?: string | null;
  images?: string[];
  featured_images?: string[];
  review_keywords?: ExternalLocationReviewKeyword[];
  featured_reviews?: ExternalLocationReview[];
  detailed_reviews?: ExternalLocationReview[];
  owner?: {
    name?: string | null;
  };
  owner_posts?: Array<{
    post_id?: string;
    post_text?: string | null;
    link?: string | null;
    published_at?: string | null;
    images?: string[];
  }>;
  competitors?: Array<{
    name: string;
    suggested_link?: string;
    reviews?: number;
    rating?: number;
    main_category?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
  hours?: ExternalLocationHour[];
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  detailed_address?: {
    ward?: string | null;
    state?: string | null;
    city?: string | null;
  };
  menu?: {
    link?: string | null;
  };
  reservations?: {
    link?: string | null;
  };
  status?: string | null;
  is_temporarily_closed?: boolean;
  is_permanently_closed?: boolean;
}

export interface Database {
  cities: City[];
  districts: District[];
  categories: Category[];
  amenities: Amenity[];
  places: Place[];
  users: User[];
  reviews: Review[];
}
