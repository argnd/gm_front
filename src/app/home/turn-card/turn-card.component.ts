import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  Type,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { SpeechService } from '../../core/speech.service';
import { Turn } from '../../models/turn.model';
import { AMBIANCE_KEYS, AMBIANCE_LABELS, STAT_LABELS } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

// One turn of the story: the player's action, the GM's answer, and what that turn changed.
// Only the latest card is expanded; older ones collapse to keep the column readable.

// A single change, shown only when it is non-zero
type Delta = {
  label: string;
  from: number;
  to: number;
  delta: number;
};

@Component({
  selector: 'app-turn-card',
  imports: [NgComponentOutlet],
  templateUrl: './turn-card.component.html',
  styleUrl: './turn-card.component.scss',
})
export class TurnCardComponent implements OnChanges {
  @Input({ required: true }) turn!: Turn;
  @Input() index = 0;
  @Input() isLast = false;

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  collapsed = signal(true);

  protected readonly speech = inject(SpeechService);

  constructor() {
    // A card destroyed mid-reading must stop its own narration, and only its own
    inject(DestroyRef).onDestroy(() => this.speech.stopIf(this.speechId));
  }

  // Identifies this card within the shared speech service, which only plays one at a time
  protected get speechId(): string {
    return `turn-${this.index}`;
  }

  protected toggleSpeech(event: Event): void {
    // The whole card is clickable to collapse it: the speech button must not do both
    event.stopPropagation();
    this.speech.toggle(this.speechId, this.turn.answer);
  }

  // Iterates over the *before* stats: a stat the GM did not send back is unchanged, not
  // missing, so it falls back to its own starting value and gets filtered out
  get statDeltas(): Delta[] {
    const after = this.turn.newstats;
    if (!after) return [];

    return this.turn.stats
      .map((stat) => {
        const updated = after.find((entry) => entry.name === stat.name);
        const to = updated ? Number(updated.value) : Number(stat.value);
        const from = Number(stat.value);
        return {
          label: STAT_LABELS[stat.name] ?? stat.name,
          from,
          to,
          delta: to - from,
        };
      })
      .filter((entry) => entry.delta !== 0);
  }

  get ambianceDeltas(): Delta[] {
    const after = this.turn.newAmbiance;
    if (!after) return [];

    return AMBIANCE_KEYS.map((key) => ({
      label: AMBIANCE_LABELS[key],
      from: this.turn.ambiance[key],
      to: after[key],
      delta: after[key] - this.turn.ambiance[key],
    })).filter((entry) => entry.delta !== 0);
  }

  // A card that stops being the latest collapses on its own, which is what makes the
  // story scroll down to a single open turn as the game advances
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isLast']) {
      this.collapsed.set(!this.isLast);
    }
  }

  toggle(): void {
    this.collapsed.update((v) => !v);
    // Collapsing hides the text being read: stop the narration rather than let it run blind
    if (this.collapsed()) {
      this.speech.stopIf(this.speechId);
    }
  }
}
