import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceValue, isHighStat, statValue } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const LEAF_THRESHOLD = 30;
const LEAF_RANGE = 29;
const FLAG_THRESHOLD = 30;
const FLAG_STEP = 13;
const FLAG_MAX = 6;
const FLAG_RESUME = 59;
const FLAG_RESUME_RANGE = 41;
const FIRE_RANGE = 70;
const FIRE_FLAMES = 60;
const FIRE_BLAZE = 90;

@Component({
  selector: 'app-decor-adventure',
  templateUrl: './adventure-decor.component.html',
  styleUrl: './adventure-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--flag-scale]': 'flagScale()',
    'aria-hidden': 'true',
  },
})
export class AdventureDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly stage = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < FLAG_THRESHOLD) return 0;
    return Math.min(FLAG_MAX, 1 + Math.floor((adventure - FLAG_THRESHOLD) / FLAG_STEP));
  });

  protected readonly flagScale = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    const first = Math.max(0, Math.min(1, (adventure - FLAG_THRESHOLD) / LEAF_RANGE));
    const resumed = Math.max(0, Math.min(1, (adventure - FLAG_RESUME) / FLAG_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly leaves = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < LEAF_THRESHOLD) return [];

    const gusty = isHighStat(statValue(this.stats(), 'AGI'));
    const progress = Math.min(1, (adventure - LEAF_THRESHOLD) / LEAF_RANGE);
    const count = Math.round(8 + 6 * progress);
    const drift: {
      gusty: boolean;
      style: Record<string, string>;
      spin: Record<string, string>;
    }[] = [];

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('leaf', index, slot);
      const size = 10 + rand(5) * 6;
      const x = (index + rand(0)) / count;
      const style: Record<string, string> = {
        left: pct(x),
        top: pct(rand(1) * 0.85),
        '--drift': px(60 + rand(2) * 80),
        '--lift': px(-(120 + rand(3) * 100)),
        '--peak': (0.4 + rand(4) * 0.3).toFixed(3),
        width: px(size),
        height: px(size),
        'animation-duration': secs(14 + rand(6) * 10),
        'animation-delay': secs(-rand(7) * 24),
      };

      if (gusty) {
        const flutter = 7 + rand(9) * 6;
        style['animation-duration'] = `${secs(14 + rand(6) * 10)}, ${secs(flutter)}`;
        style['animation-delay'] = `${secs(-rand(7) * 24)}, ${secs(-rand(10) * flutter)}`;
      }

      drift.push({
        gusty,
        style,
        spin: {
          'animation-duration': secs(5 + rand(8) * 4),
        },
      });
    }

    return drift;
  });

  protected readonly campfire = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < LEAF_THRESHOLD) return null;

    const growth = Math.min(1, (adventure - LEAF_THRESHOLD) / FIRE_RANGE);
    const tier = adventure >= FIRE_BLAZE ? 3 : adventure >= FIRE_FLAMES ? 2 : 1;
    const sparks: { style: Record<string, string> }[] = [];

    if (tier >= 3) {
      for (let index = 0; index < 6; index++) {
        const rand = (slot: number) => noise('spark', index, slot);
        sparks.push({
          style: {
            left: pct(0.32 + rand(0) * 0.36),
            bottom: px(26 + rand(1) * 10),
            '--drift': px(-12 + rand(2) * 24),
            '--lift': px(36 + rand(3) * 40),
            '--peak': (0.45 + rand(4) * 0.3).toFixed(3),
            width: px(2 + rand(5) * 1.5),
            height: px(2 + rand(5) * 1.5),
            'animation-duration': secs(2.4 + rand(6) * 1.8),
            'animation-delay': secs(-rand(7) * 4),
          },
        });
      }
    }

    return { tier, scale: (0.8 + 0.5 * growth).toFixed(3), sparks };
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
