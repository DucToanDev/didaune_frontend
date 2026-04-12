import { Directive, ElementRef, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appDragScroll]',
  standalone: true,
})
export class DragScrollDirective {
  @HostBinding('style.cursor') protected get cursor(): string {
    return this.isDragging ? 'grabbing' : 'grab';
  }

  @HostBinding('style.userSelect') protected get userSelect(): string {
    return this.isDragging ? 'none' : '';
  }

  @HostBinding('style.scrollBehavior') protected scrollBehavior = 'smooth';
  private isDragging = false;
  private pointerId: number | null = null;
  private startX = 0;
  private startScrollLeft = 0;
  private dragDistance = 0;
  private suppressClick = false;

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  @HostListener('pointerdown', ['$event'])
  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    if (this.isInteractiveTarget(event.target)) {
      this.resetDragState();
      return;
    }

    const element = this.elementRef.nativeElement;

    this.isDragging = true;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startScrollLeft = element.scrollLeft;
    this.dragDistance = 0;
    this.suppressClick = false;
    this.scrollBehavior = 'auto';

    element.setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  protected onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || this.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.startX;
    this.dragDistance = Math.max(this.dragDistance, Math.abs(deltaX));
    this.elementRef.nativeElement.scrollLeft = this.startScrollLeft - deltaX;

    if (this.dragDistance > 6) {
      this.suppressClick = true;
    }
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  protected onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) {
      return;
    }

    const element = this.elementRef.nativeElement;

    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    this.isDragging = false;
    this.pointerId = null;
    this.scrollBehavior = 'smooth';
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    if (!this.isDragging) {
      return;
    }

    this.resetDragState();
  }

  @HostListener('click', ['$event'])
  protected onClick(event: MouseEvent): void {
    if (!this.suppressClick) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.suppressClick = false;
  }

  @HostListener('dragstart', ['$event'])
  protected onDragStart(event: DragEvent): void {
    event.preventDefault();
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        'a, button, input, textarea, select, option, label, [role="button"], [data-no-drag-scroll]',
      ),
    );
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.pointerId = null;
    this.dragDistance = 0;
    this.suppressClick = false;
    this.scrollBehavior = 'smooth';
  }
}
