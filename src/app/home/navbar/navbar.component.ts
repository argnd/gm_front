import { Component, DestroyRef, Type, inject, input, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { InputSettingsService } from '../../core/input-settings.service';
import { SpeechService } from '../../core/speech.service';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

// Tolerance around the top of the document: the bar is considered "at the top" within this
// margin, so a pixel of momentum left over from a scroll does not keep it hidden.
const TOP_PX = 8;

// Top bar: identity and sign-out. Injects AuthService directly rather than taking inputs,
// since it is the only consumer of that state in the page.
//
// Visibility depends on the scroll position alone, not on its direction: the bar slides
// away as soon as the page leaves the top, and comes back only once the reader is back at
// the very top. It stays `position: sticky`, so hiding is a pure transform — the element
// keeps its place in the flow and nothing below it ever reflows.
@Component({
  selector: 'app-navbar',
  imports: [NgComponentOutlet],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  host: {
    '[class.is-hidden]': 'hidden()',
    // A keyboard user tabbing into the bar must not be sent to an off-screen control
    '(focusin)': 'reveal()',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly speech = inject(SpeechService);
  protected readonly inputSettings = inject(InputSettingsService);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected readonly hidden = signal(false);

  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (typeof window === 'undefined') return;

    // A reload can restore a scrolled position, so settle the state before any event
    this.update();
    const onScroll = () => this.schedule();
    window.addEventListener('scroll', onScroll, { passive: true });

    destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      if (this.frame) {
        cancelAnimationFrame(this.frame);
      }
    });
  }

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  protected reveal(): void {
    this.hidden.set(false);
  }

  protected onPremiumChange(event: Event): void {
    this.speech.setPremium((event.target as HTMLInputElement).checked);
  }

  protected onEnterSendsChange(event: Event): void {
    this.inputSettings.setEnterSends((event.target as HTMLInputElement).checked);
  }

  // Coalesces a burst of scroll events into one decision per frame
  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }

  // Position only: leaving the top hides the bar, returning to the top brings it back.
  // Scrolling up part of the way deliberately changes nothing.
  private update(): void {
    this.hidden.set(window.scrollY > TOP_PX);
  }
}
