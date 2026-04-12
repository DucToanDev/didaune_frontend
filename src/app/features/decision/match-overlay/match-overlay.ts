import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, keyframes } from '@angular/animations';
import { MatchEventPayload } from '../../../core/models/decision.models';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

@Component({
  selector: 'app-match-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-overlay.html',
  styleUrl: './match-overlay.css',
  animations: [
    trigger('overlayFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ opacity: 0 })),
      ]),
    ]),
    trigger('cardBounce', [
      transition(':enter', [
        animate('700ms 200ms cubic-bezier(0.34, 1.56, 0.64, 1)', keyframes([
          style({ transform: 'scale(0) rotate(-15deg)', opacity: 0, offset: 0 }),
          style({ transform: 'scale(1.1) rotate(2deg)', opacity: 1, offset: 0.7 }),
          style({ transform: 'scale(1) rotate(0)', opacity: 1, offset: 1 }),
        ])),
      ]),
    ]),
    trigger('titlePop', [
      transition(':enter', [
        animate('600ms 400ms cubic-bezier(0.34, 1.56, 0.64, 1)', keyframes([
          style({ transform: 'scale(0) translateY(30px)', opacity: 0, offset: 0 }),
          style({ transform: 'scale(1.15) translateY(-5px)', opacity: 1, offset: 0.65 }),
          style({ transform: 'scale(1) translateY(0)', opacity: 1, offset: 1 }),
        ])),
      ]),
    ]),
  ],
})
export class MatchOverlayComponent implements OnInit, OnDestroy {
  matchData = input.required<MatchEventPayload>();
  close = output<void>();

  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('confettiCanvas');
  private animationId = 0;
  private confettiPieces: ConfettiPiece[] = [];

  readonly confettiColors = [
    '#ff6b9d', '#c850c0', '#6c63ff', '#22c55e',
    '#fbbf24', '#f97316', '#06b6d4', '#e11d48',
  ];

  ngOnInit(): void {
    // Tạo confetti sau khi render
    requestAnimationFrame(() => this.startConfetti());
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('match-overlay')) {
      this.onClose();
    }
  }

  // ── Canvas Confetti ────────────────────────────────
  private startConfetti(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;

    // Tạo particles
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      w: number;
      h: number;
      color: string;
      angle: number;
      angularVelocity: number;
      gravity: number;
      opacity: number;
    }[] = [];

    const count = 150;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvasEl.width,
        y: Math.random() * canvasEl.height * -1 - 20,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 2,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 3,
        color: this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)],
        angle: Math.random() * Math.PI * 2,
        angularVelocity: (Math.random() - 0.5) * 0.2,
        gravity: 0.08 + Math.random() * 0.06,
        opacity: 1,
      });
    }

    let frameCount = 0;
    const maxFrames = 300; // ~5 giây rồi dừng

    const render = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      frameCount++;

      for (const p of particles) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.angularVelocity;
        p.vx *= 0.99;

        if (frameCount > maxFrames - 60) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (frameCount < maxFrames) {
        this.animationId = requestAnimationFrame(render);
      }
    };

    this.animationId = requestAnimationFrame(render);
  }
}
