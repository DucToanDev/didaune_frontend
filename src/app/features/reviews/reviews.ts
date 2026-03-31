import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Place } from '../../core/models/app.models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class Reviews {
  private readonly reviewDraftStoragePrefix = 'didaune-review-draft-';
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public dataService = inject(DataService);

  place = signal<Place | undefined>(undefined);
  rating = signal(5);
  comment = signal('');
  selectedTags = signal<string[]>(['Wifi tot']);

  quickTags = [
    'Wifi tot',
    'Yen tinh',
    'Nuoc ngon',
    'View dep',
    'Nhac hay',
    'Phu hop hen ho',
  ];

  constructor() {
    this.route.params.subscribe((params) => {
      const slug = params['slug'];

      if (!slug) {
        return;
      }

      this.restoreDraft(slug);
      this.dataService.getPlaceBySlug(slug).subscribe((place) => this.place.set(place));
    });
  }

  setRating(value: number) {
    this.rating.set(value);
  }

  toggleTag(tag: string) {
    this.selectedTags.set(
      this.selectedTags().includes(tag)
        ? this.selectedTags().filter((item) => item !== tag)
        : [...this.selectedTags(), tag]
    );
  }

  submit() {
    const place = this.place();

    if (!place) {
      return;
    }

    const content = [this.comment().trim(), ...this.selectedTags()].filter(Boolean).join(' | ');

    if (!this.dataService.isAuthenticated()) {
      this.persistDraft(place.slug);
      this.dataService.requestAuthForAction({
        type: 'review',
        placeSlug: place.slug,
      });
      return;
    }

    this.dataService.submitReview({
      place_slug: place.slug,
      rating: this.rating(),
      comment: content || 'Trai nghiem tot, minh muon quay lai.',
      images: [],
    });

    this.clearDraft(place.slug);
    this.router.navigate(['/detail', place.slug]);
  }

  private persistDraft(placeSlug: string) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(
      `${this.reviewDraftStoragePrefix}${placeSlug}`,
      JSON.stringify({
        rating: this.rating(),
        comment: this.comment(),
        selectedTags: this.selectedTags(),
      }),
    );
  }

  private restoreDraft(placeSlug: string) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    const rawValue = sessionStorage.getItem(
      `${this.reviewDraftStoragePrefix}${placeSlug}`,
    );
    if (!rawValue) {
      return;
    }

    try {
      const draft = JSON.parse(rawValue) as {
        rating?: number;
        comment?: string;
        selectedTags?: string[];
      };

      this.rating.set(draft.rating ?? 5);
      this.comment.set(draft.comment ?? '');
      this.selectedTags.set(draft.selectedTags?.length ? draft.selectedTags : []);
    } catch {
      this.clearDraft(placeSlug);
    }
  }

  private clearDraft(placeSlug: string) {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(`${this.reviewDraftStoragePrefix}${placeSlug}`);
  }
}
