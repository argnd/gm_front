import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceTotal } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const POLLEN_THRESHOLD = 20;
const POLLEN_RANGE = 67;

@Component({
  selector: 'app-decor-neutral',
  templateUrl: './neutral-decor.component.html',
  styleUrl: './neutral-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    'aria-hidden': 'true',
  },
})
export class NeutralDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly stage = computed(() => {
    const value = this.ambiance();
    if (!value) return 0;
    return Math.max(0, Math.min(3, Math.floor(ambianceTotal(value) / 10) - 5));
  });

  protected readonly pollen = computed(() => {
    const value = this.ambiance();
    const total = value ? ambianceTotal(value) : 0;
    if (total < POLLEN_THRESHOLD) return [];

    const progress = Math.min(1, (total - POLLEN_THRESHOLD) / POLLEN_RANGE);
    const count = Math.round(8 + 14 * progress);
    const peakBase = 0.14 + 0.2 * progress;
    const grains: { style: Record<string, string> }[] = [];

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('pollen', index, slot);
      const spread = (index + rand(0)) / count;
      grains.push({
        style: {
          left: pct(Math.pow(spread, 1.25)),
          top: pct(rand(1)),
          '--drift': px(-50 + rand(2) * 100),
          '--lift': px(90 + rand(3) * 160),
          '--peak': (peakBase * (0.6 + rand(4) * 0.4)).toFixed(3),
          width: px(2 + rand(5) * 2),
          height: px(2 + rand(5) * 2),
          'animation-duration': secs(30 + rand(6) * 20),
          'animation-delay': secs(-rand(7) * 40),
        },
      });
    }

    return grains;
  });
}

function noise(salt: string, index: number, slot: number): number {
  let hash = 2166136261;
  const seed = `${salt}:${index}:${slot}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function px(value: number): string {
  return `${value.toFixed(1)}px`;
}

function secs(value: number): string {
  return `${value.toFixed(2)}s`;
}
