import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  AfterViewChecked,
  ViewChild,
  input,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-lightbox.html',
  styleUrl: './image-lightbox.css',
})
export class ImageLightbox implements AfterViewChecked {
  images = input<string[]>([]);
  startIndex = input(0);
  isOpen = input(false);

  @Output() close = new EventEmitter<void>();

  @ViewChild('lightboxOverlay') overlayRef?: ElementRef<HTMLElement>;

  currentIndex = signal(0);
  private needsFocus = false;
  private touchStartX = 0;

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.currentIndex.set(this.startIndex());
        this.needsFocus = true;
      }
    });
  }

  ngAfterViewChecked() {
    if (this.needsFocus && this.overlayRef) {
      this.overlayRef.nativeElement.focus();
      this.needsFocus = false;
    }
  }

  prev() {
    this.currentIndex.update((i) => (i > 0 ? i - 1 : this.images().length - 1));
  }

  next() {
    this.currentIndex.update((i) => (i < this.images().length - 1 ? i + 1 : 0));
  }

  goTo(index: number) {
    this.currentIndex.set(index);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('lightbox-overlay') ||
        (event.target as HTMLElement).classList.contains('lightbox-image-container')) {
      this.close.emit();
    }
  }

  onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        this.close.emit();
        break;
      case 'ArrowLeft':
        this.prev();
        break;
      case 'ArrowRight':
        this.next();
        break;
    }
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    const diff = event.changedTouches[0].clientX - this.touchStartX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.prev();
      } else {
        this.next();
      }
    }
  }
}
