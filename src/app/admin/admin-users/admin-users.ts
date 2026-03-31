import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { PaginationMeta } from '../../core/models/app.models';
import { AdminUser, UserApiService } from '../../core/services/user-api.service';
import { AdminHeader } from '../shared/admin-header/admin-header';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeader],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers implements OnInit {
  private userApi = inject(UserApiService);

  loading = signal(false);
  users = signal<AdminUser[]>([]);
  pagination = signal<PaginationMeta>({
    current_page: 1, per_page: 12, total: 0, last_page: 1, from: null, to: null,
  });

  search = signal('');
  roleFilter = signal('');
  activeFilter = signal<boolean | null>(null);
  selectedUserIds = signal<number[]>([]);
  bulkRole = signal('user');
  bulkLoading = signal(false);

  // Create/Edit modal
  showModal = signal(false);
  editingUser = signal<AdminUser | null>(null);
  saving = signal(false);
  formName = signal('');
  formEmail = signal('');
  formPassword = signal('');
  formRole = signal('user');
  formActive = signal(true);

  ngOnInit() {
    this.loadData();
  }

  loadData(page = 1) {
    this.loading.set(true);
    this.userApi
      .fetchUsersPaginated({
        search: this.search(),
        role: this.roleFilter(),
        isActive: this.activeFilter(),
        page,
        perPage: 12,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((result) => {
        this.users.set(result.data);
        this.pagination.set(result.meta);
        this.selectedUserIds.set([]);
      });
  }

  onSearch() {
    this.loadData(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.pagination().last_page) return;
    this.loadData(page);
  }

  openCreate() {
    this.editingUser.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formRole.set('user');
    this.formActive.set(true);
    this.showModal.set(true);
  }

  openEdit(user: AdminUser) {
    this.editingUser.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPassword.set('');
    this.formRole.set(user.role || 'user');
    this.formActive.set(user.is_active);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveUser() {
    this.saving.set(true);
    const editing = this.editingUser();

    if (editing) {
      this.userApi
        .updateUser(editing.id, {
          name: this.formName(),
          email: this.formEmail(),
          password: this.formPassword() || null,
          role: this.formRole(),
          is_active: this.formActive(),
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.showModal.set(false);
            this.loadData(this.pagination().current_page);
          },
        });
    } else {
      this.userApi
        .createUser({
          name: this.formName(),
          email: this.formEmail(),
          password: this.formPassword(),
          role: this.formRole(),
          is_active: this.formActive(),
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.showModal.set(false);
            this.loadData(1);
          },
        });
    }
  }

  deleteUser(user: AdminUser) {
    if (!confirm(`Xóa người dùng "${user.name}"?`)) return;
    this.userApi.deleteUser(user.id).subscribe(() => {
      this.users.update((list) => list.filter((u) => u.id !== user.id));
      this.selectedUserIds.update((list) => list.filter((id) => id !== user.id));
    });
  }

  isSelected(userId: number) {
    return this.selectedUserIds().includes(userId);
  }

  allSelectedOnPage() {
    return this.users().length > 0 && this.users().every((user) => this.isSelected(user.id));
  }

  toggleSelection(userId: number, checked: boolean) {
    this.selectedUserIds.update((selected) => {
      if (checked) {
        return [...new Set([...selected, userId])];
      }

      return selected.filter((id) => id !== userId);
    });
  }

  toggleSelectPage(checked: boolean) {
    if (checked) {
      this.selectedUserIds.set(this.users().map((user) => user.id));
      return;
    }

    this.selectedUserIds.set([]);
  }

  applyBulkActive(isActive: boolean) {
    const ids = this.selectedUserIds();
    if (!ids.length) return;

    this.bulkLoading.set(true);
    forkJoin(ids.map((id) => this.userApi.updateUser(id, { is_active: isActive })))
      .pipe(finalize(() => this.bulkLoading.set(false)))
      .subscribe(() => {
        this.loadData(this.pagination().current_page);
      });
  }

  applyBulkRole() {
    const ids = this.selectedUserIds();
    if (!ids.length) return;

    this.bulkLoading.set(true);
    forkJoin(ids.map((id) => this.userApi.updateUser(id, { role: this.bulkRole() })))
      .pipe(finalize(() => this.bulkLoading.set(false)))
      .subscribe(() => {
        this.loadData(this.pagination().current_page);
      });
  }
}
