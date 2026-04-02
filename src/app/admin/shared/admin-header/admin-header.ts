import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-page-header">
      <div class="aph-left">
        <!-- <div class="aph-crumbs">
          <a routerLink="/admin" class="aph-crumb-link">Admin</a>
          <i *ngIf="breadcrumb()" class="fa-solid fa-chevron-right aph-crumb-sep"></i>
          <span *ngIf="breadcrumb()" class="aph-crumb-current">{{ breadcrumb() }}</span>
        </div> -->
        <h1 class="aph-title">{{ title() }}</h1>
      </div>
      <div class="aph-actions">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .admin-page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .aph-crumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .aph-crumb-link {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .aph-crumb-link:hover { color: #f97316; }
    .aph-crumb-sep { font-size: 8px; color: #cbd5e1; }
    .aph-crumb-current {
      font-size: 12px;
      font-weight: 700;
      color: #f97316;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .aph-title {
      font-size: 26px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -.02em;
      line-height: 1.15;
      margin: 0;
    }
    .aph-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  `],
})
export class AdminHeader {
  title = input.required<string>();
  breadcrumb = input('');
}
