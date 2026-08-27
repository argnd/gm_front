import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { Turn } from '../../models/turn.model';
import { AMBIANCE_KEYS, AMBIANCE_LABELS, STAT_LABELS } from '../ambiance/ambiance.engine';

type Delta = {
  label: string;
  from: number;
  to: number;
  delta: number;
};

@Component({
  selector: 'app-turn-card',
  templateUrl: './turn-card.component.html',
  styleUrl: './turn-card.component.scss',
})
export class TurnCardComponent implements OnChanges {
  @Input({ required: true }) turn!: Turn;
  @Input() index = 0;
  @Input() isLast = false;

  collapsed = signal(true);

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isLast']) {
      this.collapsed.set(!this.isLast);
    }
  }

  toggle(): void {
    this.collapsed.update((v) => !v);
  }
}
