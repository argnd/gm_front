import { Component, DestroyRef, inject, signal } from '@angular/core';
import introPrompts from '../../content/intro-prompts-draft.json';

type IntroPrompt = {
  theme: string;
  title: string;
  content: string;
};

// Offers a ready-made opening for players who do not know how to start. Copying the text
// is all it does — it never writes into the console itself.
const PROMPTS: IntroPrompt[] = introPrompts;

@Component({
  selector: 'app-suggestion-panel',
  templateUrl: './suggestion-panel.component.html',
  styleUrl: './suggestion-panel.component.scss',
})
export class SuggestionPanelComponent {
  protected readonly suggestion = signal<IntroPrompt>(randomPrompt(null));
  protected readonly copied = signal(false);

  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
    });
  }

  protected randomize(): void {
    this.suggestion.set(randomPrompt(this.suggestion()));
    this.copied.set(false);
  }

  protected copy(): void {
    navigator.clipboard?.writeText(this.suggestion().content).then(() => {
      // Transient confirmation; the pending timer is replaced so repeated clicks restart
      // the delay instead of cutting it short
      this.copied.set(true);
      if (this.copyTimer !== null) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(false), 1600);
    });
  }
}

// Redraws until the suggestion actually changes: landing on the same one would read as a
// broken button. The length guard keeps a single-entry pool from looping forever.
function randomPrompt(current: IntroPrompt | null): IntroPrompt {
  let next = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  while (PROMPTS.length > 1 && next === current) {
    next = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }
  return next;
}
