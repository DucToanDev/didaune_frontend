import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { PaginationMeta } from '../../../core/models/app.models';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (meta().last_page > 1) {
      <div class="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm text-slate-500">
          Trang {{ meta().current_page }} / {{ meta().last_page }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="pageChange.emit(meta().current_page - 1)"
            [disabled]="meta().current_page <= 1"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Truoc
          </button>
          @for (page of pageNumbers(); track page) {
            <button
              type="button"
              (click)="page !== -1 ? pageChange.emit(page) : null"
              [disabled]="page === -1"
              [class]="
                page === meta().current_page
                  ? 'bg-slate-900 text-white border-slate-900'
                  : page === -1
                    ? 'bg-transparent border-transparent text-slate-400'
                    : 'bg-white border-slate-200 text-slate-600'
              "
              class="min-w-10 rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              {{ page === -1 ? '...' : page }}
            </button>
          }
          <button
            type="button"
            (click)="pageChange.emit(meta().current_page + 1)"
            [disabled]="meta().current_page >= meta().last_page"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>
    }
  `,
})
export class Pagination {
  meta = input.required<PaginationMeta>();
  pageChange = output<number>();

  pageNumbers = computed(() => {
    const totalPages = this.meta().last_page;
    const currentPage = this.meta().current_page;

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, -1, totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
  });
}
