import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Place, PlaceAmenityOption, PlaceReview } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';
import { ImageLightbox } from '../../shared/ui/image-lightbox/image-lightbox';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ImageLightbox],
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class Detail {
  private initialReviewLimit = 6;
  private route = inject(ActivatedRoute);
  public dataService = inject(DataService);

  place = signal<Place | undefined>(undefined);
  reviews = signal<PlaceReview[]>([]);
  relatedPlaces = signal<Place[]>([]);
  visibleReviewCount = signal(this.initialReviewLimit);

  // Lightbox state
  lightboxOpen = signal(false);
  lightboxImages = signal<string[]>([]);
  lightboxIndex = signal(0);
  expandedReviews = new Set<number>();

  galleryUrls = computed(() => {
    const p = this.place();
    if (!p) return [];
    const urls = p.gallery.map((g) => g.url).filter(Boolean);
    if (!urls.length && p.image) return [p.image];
    return urls;
  });

  enabledAmenityOptions = computed(() =>
    (this.place()?.amenity_options ?? []).filter((item) => item.enabled).slice(0, 12)
  );

  displayedAmenities = computed<PlaceAmenityOption[]>(() => {
    const enabled = this.enabledAmenityOptions();

    if (enabled.length) {
      return enabled;
    }

    return (this.place()?.amenity_labels ?? []).map((name) => ({ name, enabled: true }));
  });

  bookingPlatforms = computed(() => (this.place()?.booking_platforms ?? []).slice(0, 4));
  canShowClaimButton = computed(() => {
    const place = this.place();
    const userId = this.dataService.currentUser()?.id;

    if (!place?.can_claim || !place.owner_id || !userId) {
      return false;
    }

    return String(place.owner_id).trim() === String(userId).trim();
  });

  stayFacts = computed(() => {
    const p = this.place();

    if (!p) {
      return [];
    }

    const facts = [
      p.hotel_stars ? `${p.hotel_stars} sao` : null,
      p.bedrooms ? `${p.bedrooms} phong ngu` : null,
      p.beds ? `${p.beds} giuong` : null,
      p.bathrooms ? `${p.bathrooms} phong tam` : null,
      p.sleeps ? `${p.sleeps} khach` : null,
      p.min_nights ? `Toi thieu ${p.min_nights} dem` : null,
    ].filter((item): item is string => Boolean(item));

    return facts;
  });

  constructor() {
    this.route.params.subscribe((params) => {
      const slug = params['slug'];

      if (!slug) {
        return;
      }

      this.dataService.getPlaceBySlug(slug).subscribe((place) => {
        this.place.set(place);
        this.reviews.set([]);
        this.relatedPlaces.set([]);
        this.visibleReviewCount.set(this.initialReviewLimit);

        if (!place) {
          return;
        }

        this.dataService.recordRecentlyViewed(place);
        this.dataService.getMergedReviews(place).subscribe((reviews) => this.reviews.set(reviews));
        this.dataService
          .getRelatedPlaces(place)
          .subscribe((relatedPlaces) => this.relatedPlaces.set(relatedPlaces));
      });
    });
  }

  toggleFavorite(event: Event, slug: string) {
    event.preventDefault();
    event.stopPropagation();
    this.dataService.toggleFavorite(slug);
  }

  visibleReviews() {
    return this.reviews().slice(0, this.visibleReviewCount());
  }

  canShowMoreReviews() {
    return this.reviews().length > this.visibleReviewCount();
  }

  showMoreReviews() {
    this.visibleReviewCount.update((count) => count + this.initialReviewLimit);
  }

  openLightbox(images: string[], index: number) {
    this.lightboxImages.set(images);
    this.lightboxIndex.set(index);
    this.lightboxOpen.set(true);
  }

  closeLightbox() {
    this.lightboxOpen.set(false);
  }
}

