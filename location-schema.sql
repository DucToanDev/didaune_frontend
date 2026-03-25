CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255),
  full_name varchar(255),
  username varchar(100) UNIQUE,
  phone varchar(50),
  avatar_url text,
  bio text,
  role varchar(50) NOT NULL DEFAULT 'user',
  auth_provider varchar(50) DEFAULT 'local',
  provider_user_id varchar(255),
  membership_tier varchar(50),
  points int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(50) NOT NULL,
  source_place_id varchar(255) UNIQUE,
  source_cid varchar(255),
  source_data_id varchar(255),
  source_kgmid varchar(255),
  name varchar(255) NOT NULL,
  slug varchar(255) NOT NULL UNIQUE,
  description text,
  primary_type varchar(100) NOT NULL,
  main_category varchar(255),
  status varchar(100),
  rating numeric(3,2),
  reviews_count int NOT NULL DEFAULT 0,
  price_level varchar(100),
  price_range varchar(100),
  website varchar(500),
  phone varchar(50),
  phone_international varchar(50),
  google_maps_link text,
  reviews_link text,
  menu_link text,
  menu_source varchar(255),
  featured_image text,
  image_count int NOT NULL DEFAULT 0,
  full_address text,
  street varchar(255),
  ward varchar(255),
  district varchar(255),
  city varchar(255),
  state_or_province varchar(255),
  postal_code varchar(50),
  country_code varchar(10),
  plus_code varchar(50),
  latitude numeric(10,7),
  longitude numeric(10,7),
  timezone varchar(100),
  owner_id varchar(255),
  owner_name varchar(255),
  owner_link text,
  can_claim boolean NOT NULL DEFAULT false,
  is_spending_on_ads boolean NOT NULL DEFAULT false,
  is_temporarily_closed boolean NOT NULL DEFAULT false,
  is_permanently_closed boolean NOT NULL DEFAULT false,
  is_rental boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  category_name varchar(255) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  UNIQUE (location_id, category_name)
);

CREATE TABLE IF NOT EXISTS location_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  group_key varchar(100) NOT NULL,
  group_name varchar(255),
  attribute_key varchar(100),
  attribute_name varchar(255) NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS location_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  day_label varchar(50) NOT NULL,
  open_time time,
  close_time time,
  segment_order smallint NOT NULL DEFAULT 1,
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE (location_id, day_of_week, segment_order),
  CHECK (day_of_week BETWEEN 1 AND 7)
);

CREATE TABLE IF NOT EXISTS location_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_type varchar(50),
  source varchar(100),
  source_ref_id varchar(255),
  width int,
  height int,
  published_at timestamptz,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS location_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  review_source varchar(20) NOT NULL,
  external_review_id varchar(255),
  reviewer_name varchar(255),
  reviewer_external_id varchar(255),
  reviewer_profile text,
  reviewer_avatar_url text,
  rating numeric(2,1),
  review_text text,
  original_language varchar(20),
  translated_text text,
  translated_language varchar(20),
  review_origin varchar(50),
  published_at timestamptz,
  owner_response_text text,
  owner_response_at timestamptz,
  total_reviews_by_reviewer int,
  total_photos_by_reviewer int,
  is_local_guide boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, external_review_id),
  CHECK (review_source IN ('external', 'internal'))
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  folder_name varchar(100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, location_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash varchar(255) NOT NULL,
  user_agent text,
  ip_address varchar(100),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_review_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES location_reviews(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  width int,
  height int
);

CREATE TABLE IF NOT EXISTS location_owner_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  external_post_id varchar(255),
  post_text text,
  link text,
  call_to_action varchar(255),
  published_at timestamptz,
  raw_payload jsonb
);

CREATE TABLE IF NOT EXISTS location_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  main_category varchar(255),
  rating numeric(3,2),
  reviews_count int NOT NULL DEFAULT 0,
  suggested_link text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  raw_payload jsonb
);

CREATE TABLE IF NOT EXISTS location_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  link_type varchar(100) NOT NULL,
  title varchar(255),
  provider varchar(255),
  url text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_user_id ON users(provider_user_id);

CREATE INDEX IF NOT EXISTS idx_locations_primary_type ON locations(primary_type);
CREATE INDEX IF NOT EXISTS idx_locations_main_category ON locations(main_category);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_district ON locations(district);
CREATE INDEX IF NOT EXISTS idx_locations_ward ON locations(ward);
CREATE INDEX IF NOT EXISTS idx_locations_rating ON locations(rating);
CREATE INDEX IF NOT EXISTS idx_locations_reviews_count ON locations(reviews_count);
CREATE INDEX IF NOT EXISTS idx_locations_lat_lng ON locations(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_location_categories_location_id ON location_categories(location_id);
CREATE INDEX IF NOT EXISTS idx_location_categories_category_name ON location_categories(category_name);

CREATE INDEX IF NOT EXISTS idx_location_attributes_location_id ON location_attributes(location_id);
CREATE INDEX IF NOT EXISTS idx_location_attributes_group_key ON location_attributes(group_key);
CREATE INDEX IF NOT EXISTS idx_location_attributes_attribute_name ON location_attributes(attribute_name);

CREATE INDEX IF NOT EXISTS idx_location_hours_location_id ON location_hours(location_id);

CREATE INDEX IF NOT EXISTS idx_location_images_location_id ON location_images(location_id);
CREATE INDEX IF NOT EXISTS idx_location_images_image_type ON location_images(image_type);

CREATE INDEX IF NOT EXISTS idx_location_reviews_location_id ON location_reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_location_reviews_user_id ON location_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_location_reviews_review_source ON location_reviews(review_source);
CREATE INDEX IF NOT EXISTS idx_location_reviews_external_review_id ON location_reviews(external_review_id);
CREATE INDEX IF NOT EXISTS idx_location_reviews_published_at ON location_reviews(published_at);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_location_id ON user_favorites(location_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_location_review_images_review_id ON location_review_images(review_id);

CREATE INDEX IF NOT EXISTS idx_location_owner_posts_location_id ON location_owner_posts(location_id);
CREATE INDEX IF NOT EXISTS idx_location_owner_posts_external_post_id ON location_owner_posts(external_post_id);
CREATE INDEX IF NOT EXISTS idx_location_owner_posts_published_at ON location_owner_posts(published_at);

CREATE INDEX IF NOT EXISTS idx_location_competitors_location_id ON location_competitors(location_id);
CREATE INDEX IF NOT EXISTS idx_location_competitors_name ON location_competitors(name);

CREATE INDEX IF NOT EXISTS idx_location_external_links_location_id ON location_external_links(location_id);
CREATE INDEX IF NOT EXISTS idx_location_external_links_link_type ON location_external_links(link_type);
