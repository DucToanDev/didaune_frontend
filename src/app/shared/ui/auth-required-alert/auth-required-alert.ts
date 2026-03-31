import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-auth-required-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-required-alert.html',
  styles: [`
    :host {
      display: contents;
    }

    .auth-required-alert__overlay {
      animation: auth-required-fade-in 220ms ease-out;
    }

    .auth-required-alert__card {
      transform-origin: center;
      animation: auth-required-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
      will-change: transform, opacity;
    }

    .auth-required-alert__icon {
      animation: auth-required-icon-in 420ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .auth-required-alert__actions button {
      transition:
        transform 180ms ease,
        background-color 180ms ease,
        box-shadow 180ms ease,
        color 180ms ease;
    }

    .auth-required-alert__actions button:hover {
      transform: translateY(-1px);
    }

    @keyframes auth-required-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes auth-required-card-in {
      from {
        opacity: 0;
        transform: translateY(18px) scale(0.94);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes auth-required-icon-in {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.88);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `],
})
export class AuthRequiredAlert {
  public dataService = inject(DataService);
}
