import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
      (click)="closed.emit()"
    >
      <aside
        class="admin-detail-slide h-full w-full overflow-y-auto bg-white shadow-2xl"
        [class]="panelClass()"
        (click)="$event.stopPropagation()"
      >
        <div class="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur-md">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-500">
                {{ subtitle() }}
              </p>
              <h2 class="mt-2 text-[22px] font-black leading-tight text-slate-900">{{ heading() }}</h2>
              <p *ngIf="description()" class="mt-1 text-sm text-slate-500">{{ description() }}</p>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all duration-200 hover:bg-rose-100 hover:text-rose-600"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div class="p-6">
          <ng-content></ng-content>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .admin-detail-slide {
      animation: detailSlide 240ms cubic-bezier(0.2, 0, 0, 1);
    }

    @keyframes detailSlide {
      from {
        transform: translateX(32px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `],
})
export class DetailPanel {
  subtitle = input('');
  heading = input('');
  description = input('');
  panelClass = input('max-w-2xl');
  closed = output<void>();
}
