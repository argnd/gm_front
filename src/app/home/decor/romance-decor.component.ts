import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceValue, isHighStat, statValue } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const HEART_THRESHOLD = 30;
const HEART_RANGE = 29;
const GIFT_THRESHOLD = 30;
const GIFT_STEP = 13;
const GIFT_MAX = 6;
const GIFT_RESUME = 59;
const GIFT_RESUME_RANGE = 41;

@Component({
  selector: 'app-decor-romance',
  templateUrl: './romance-decor.component.html',
  styleUrl: './romance-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--gift-scale]': 'giftScale()',
    'aria-hidden': 'true',
  },
})
export class RomanceDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly stage = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < GIFT_THRESHOLD) return 0;
    return Math.min(GIFT_MAX, 1 + Math.floor((romance - GIFT_THRESHOLD) / GIFT_STEP));
  });

  protected readonly giftScale = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    const first = Math.max(0, Math.min(1, (romance - GIFT_THRESHOLD) / HEART_RANGE));
    const resumed = Math.max(0, Math.min(1, (romance - GIFT_RESUME) / GIFT_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly hearts = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < HEART_THRESHOLD) return [];

    const beating = isHighStat(statValue(this.stats(), 'Health'));
    const progress = Math.min(1, (romance - HEART_THRESHOLD) / HEART_RANGE);
    const count = Math.round(8 + 6 * progress);
    const flock: {
      face: boolean;
      beating: boolean;
      style: Record<string, string>;
      beat: Record<string, string>;
    }[] = [];

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('heart', index, slot);
      const width = 13 + rand(5) * 11;
      flock.push({
        face: index % 3 === 0,
        beating,
        style: {
          left: pct((index + rand(0)) / count),
          top: pct(0.05 + rand(1) * 0.9),
          '--drift': px(-45 + rand(2) * 90),
          '--lift': px(90 + rand(3) * 110),
          '--peak': (0.45 + rand(4) * 0.35).toFixed(3),
          width: px(width),
          height: px(width * (22 / 24)),
          'animation-duration': secs(13 + rand(6) * 11),
          'animation-delay': secs(-rand(7) * 24),
        },
        beat: {
          'animation-duration': secs(1.2 + rand(8) * 0.6),
          'animation-delay': secs(-rand(9) * 2),
        },
      });
    }

    return flock;
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
