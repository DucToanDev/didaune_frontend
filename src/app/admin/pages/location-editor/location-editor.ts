import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AdminAuthService } from '../../../core/services/admin/admin-auth.service';
import { AdminDataService, AdminLocationRow } from '../../../core/services/admin/admin-data.service';

@Component({
  selector: 'app-admin-location-editor',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './location-editor.html',
})
export class LocationEditorAdmin {
  private route = inject(ActivatedRoute);
  private adminData = inject(AdminDataService);
  adminAuth = inject(AdminAuthService);

  row = signal<AdminLocationRow | undefined>(undefined);

  quickChecks = computed(() => {
    const place = this.row()?.place;

    if (!place) {
      return [];
    }

    return [
      { label: 'Cover image', done: Boolean(place.image) },
      { label: 'Gallery', done: place.gallery.length > 2 },
      { label: 'Area mapping moi', done: Boolean(place.area_name) },
      { label: 'Phone / website', done: Boolean(place.phone || place.website) },
      { label: 'Coordinates', done: Boolean(place.latitude && place.longitude) },
      { label: 'Owner / partner', done: Boolean(place.owner_name) },
    ];
  });

  constructor() {
    this.route.params.subscribe((params) => {
      const slug = params['slug'];
      if (!slug) {
        return;
      }
      this.adminData.getLocationBySlug(slug).subscribe((row) => this.row.set(row));
    });
  }

  setStatus(status: AdminLocationRow['status']) {
    const row = this.row();
    if (!row) {
      return;
    }

    this.adminData.updateLocationStatus(row.place.slug, status);
  }
}
