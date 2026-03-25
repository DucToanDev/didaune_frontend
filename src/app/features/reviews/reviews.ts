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

    this.dataService.submitReview({
      place_slug: place.slug,
      rating: this.rating(),
      comment: content || 'Trai nghiem tot, minh muon quay lai.',
      images: [],
    });

    this.router.navigate(['/detail', place.slug]);
  }
}
