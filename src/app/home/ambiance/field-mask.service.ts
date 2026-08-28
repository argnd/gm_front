import { Injectable, signal } from '@angular/core';

export type FieldRect = { x: number; y: number; w: number; h: number };

@Injectable({ providedIn: 'root' })
export class FieldMaskService {
  private readonly elements = new Set<HTMLElement>();
  private observer: ResizeObserver | null = null;
  private watching = false;
  private frame = 0;

  readonly rects = signal<readonly FieldRect[]>([]);

  register(element: HTMLElement): void {
    if (this.elements.has(element)) return;
    this.elements.add(element);
    this.ensureWatchers();
    this.observer?.observe(element);
    this.schedule();
  }

  unregister(element: HTMLElement): void {
    if (!this.elements.delete(element)) return;
    this.observer?.unobserve(element);
    this.schedule();
  }

  private ensureWatchers(): void {
    if (this.watching || typeof window === 'undefined') return;
    this.watching = true;

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(document.body);
    }

    window.addEventListener('resize', () => this.schedule(), { passive: true });
    window.addEventListener('scroll', () => this.schedule(), { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  private schedule(): void {
    if (this.frame || typeof requestAnimationFrame === 'undefined') return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.measure();
    });
  }

  private measure(): void {
    const next: FieldRect[] = [];
    for (const element of this.elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      next.push({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      });
    }

    const current = this.rects();
    if (
      current.length === next.length &&
      current.every((rect, index) => {
        const other = next[index];
        return rect.x === other.x && rect.y === other.y && rect.w === other.w && rect.h === other.h;
      })
    ) {
      return;
    }

    this.rects.set(next);
  }
}
