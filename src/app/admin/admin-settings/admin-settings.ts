import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AdminSettingGroup,
  SettingsApiService,
} from '../../core/services/settings-api.service';
import { AdminHeader } from '../shared/admin-header/admin-header';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeader],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.css',
})
export class AdminSettings implements OnInit {
  private settingsApi = inject(SettingsApiService);

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  groups = signal<AdminSettingGroup[]>([]);
  form = signal<Record<string, string>>({});
  visibleFields = signal<Record<string, boolean>>({});

  fieldCount = computed(() =>
    this.groups().reduce((total, group) => total + group.fields.length, 0),
  );

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.error.set('');

    this.settingsApi
      .fetchSettings()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.form.set(this.buildForm(groups));
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Khong the tai settings.');
        },
      });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.settingsApi
      .updateSettings(this.form())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (groups) => {
          this.groups.set(groups);
          this.form.set(this.buildForm(groups));
          this.success.set('Da cap nhat settings thanh cong.');
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'Khong the luu settings.');
        },
      });
  }

  updateField(name: string, value: string) {
    this.form.update((current) => ({
      ...current,
      [name]: value,
    }));
  }

  toggleFieldVisibility(name: string) {
    this.visibleFields.update((current) => ({
      ...current,
      [name]: !current[name],
    }));
  }

  inputType(groupKey: string, name: string, type: string, sensitive?: boolean) {
    if (!sensitive) {
      return type === 'url' ? 'url' : 'text';
    }

    return this.visibleFields()[`${groupKey}:${name}`] ? 'text' : 'password';
  }

  private buildForm(groups: AdminSettingGroup[]) {
    return groups.reduce<Record<string, string>>((carry, group) => {
      group.fields.forEach((field) => {
        carry[field.name] = field.value ?? '';
      });

      return carry;
    }, {});
  }
}
