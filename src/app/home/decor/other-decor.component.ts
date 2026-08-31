import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceValue, isLowStat, statValue } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const SCRAP_THRESHOLD = 30;
const SCRAP_RANGE = 29;
const EMBLEM_THRESHOLD = 30;
const EMBLEM_STEP = 13;
const EMBLEM_MAX = 6;
const EMBLEM_RESUME = 59;
const EMBLEM_RESUME_RANGE = 41;

@Component({
  selector: 'app-decor-other',
  templateUrl: './other-decor.component.html',
  styleUrl: './other-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--emblem-scale]': 'emblemScale()',
    'aria-hidden': 'true',
  },
})
export class OtherDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly stage = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < EMBLEM_THRESHOLD) return 0;
    return Math.min(EMBLEM_MAX, 1 + Math.floor((other - EMBLEM_THRESHOLD) / EMBLEM_STEP));
  });

  protected readonly emblemScale = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    const first = Math.max(0, Math.min(1, (other - EMBLEM_THRESHOLD) / SCRAP_RANGE));
    const resumed = Math.max(0, Math.min(1, (other - EMBLEM_RESUME) / EMBLEM_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly scraps = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return [];

    const jittery = isLowStat(statValue(this.stats(), 'INT'));
    const progress = Math.min(1, (other - SCRAP_THRESHOLD) / SCRAP_RANGE);
    const count = Math.round(8 + 6 * progress);
    const litter: {
      jittery: boolean;
      style: Record<string, string>;
      spin: Record<string, string>;
    }[] = [];

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('scrap', index, slot);
      const size = 11 + rand(5) * 7;
      const x = (index + rand(0)) / count;
      const style: Record<string, string> = {
        left: pct(x),
        top: pct(rand(1) * 0.85),
        '--drift': px(-50 + rand(2) * 100),
        '--lift': px(-(110 + rand(3) * 100)),
        '--peak': (0.35 + rand(4) * 0.3).toFixed(3),
        width: px(size),
        height: px(size),
        'animation-duration': secs(14 + rand(6) * 10),
        'animation-delay': secs(-rand(7) * 24),
      };

      if (jittery) {
        const tremble = 1.7 + rand(9) * 1.4;
        style['animation-duration'] = `${secs(14 + rand(6) * 10)}, ${secs(tremble)}`;
        style['animation-delay'] = `${secs(-rand(7) * 24)}, ${secs(-rand(10) * tremble)}`;
      }

      litter.push({
        jittery,
        style,
        spin: {
          'animation-duration': secs(7 + rand(8) * 5),
        },
      });
    }

    return litter;
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
