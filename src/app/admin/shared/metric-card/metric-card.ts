import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="metric-card" [class]="variant()">
      <div class="metric-icon-wrap">
        <i [class]="'fa-solid ' + icon()"></i>
      </div>
      <div class="metric-body">
        <span class="metric-label">{{ label() }}</span>
        <span class="metric-value">{{ value() }}</span>
        <span *ngIf="note()" class="metric-note">{{ note() }}</span>
      </div>
    </div>
  `,
  styles: [`
    .metric-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 20px;
      border-radius: 20px;
      background: #fff;
      border: 1px solid #f1f5f9;
      transition: box-shadow 200ms, transform 200ms;
    }
    .metric-card:hover {
      box-shadow: 0 8px 24px rgba(15,23,42,.06);
      transform: translateY(-2px);
    }
    .metric-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 14px;
      font-size: 16px;
      flex-shrink: 0;
    }
    .metric-body { display: flex; flex-direction: column; min-width: 0; }
    .metric-label {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: #94a3b8;
      line-height: 1;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
      margin-top: 6px;
      letter-spacing: -.02em;
    }
    .metric-note {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* variants */
    .sky .metric-icon-wrap    { background: #e0f2fe; color: #0284c7; }
    .orange .metric-icon-wrap { background: #fff7ed; color: #ea580c; }
    .green .metric-icon-wrap  { background: #dcfce7; color: #16a34a; }
    .violet .metric-icon-wrap { background: #ede9fe; color: #7c3aed; }
    .amber .metric-icon-wrap  { background: #fef3c7; color: #d97706; }
    .rose .metric-icon-wrap   { background: #ffe4e6; color: #e11d48; }
  `],
})
export class MetricCard {
  label = input.required<string>();
  value = input.required<string>();
  note = input('');
  icon = input('fa-chart-simple');
  variant = input('sky');
}
