import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import {
  ambianceValue,
  isHighStat,
  isLowStat,
  resolveAmbianceState,
  statValue,
} from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const HEART_THRESHOLD = 30;
const HEART_RANGE = 29;
const GIFT_THRESHOLD = 30;
const GIFT_STEP = 13;
const GIFT_MAX = 6;
const GIFT_RESUME = 59;
const GIFT_RESUME_RANGE = 41;
const BIRD_RANGE = 70;
const BIRD_SNUGGLE = 90;
const SCRAP_THRESHOLD = 30;
const SCRAP_RANGE = 29;
const EMBLEM_THRESHOLD = 30;
const EMBLEM_STEP = 13;
const EMBLEM_MAX = 6;
const EMBLEM_RESUME = 59;
const EMBLEM_RESUME_RANGE = 41;
const BOOK_STEP = 10;
const BOOK_MAX = 8;
const BOOK_OPEN = 90;

@Component({
  selector: 'app-decor-romance-other',
  templateUrl: './romance-other-decor.component.html',
  styleUrl: './romance-other-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--gift-scale]': 'giftScale()',
    '[style.--emblem-scale]': 'emblemScale()',
    'aria-hidden': 'true',
  },
})
export class RomanceOtherDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly state = computed(() => resolveAmbianceState(this.ambiance()));

  protected readonly romanceStage = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < GIFT_THRESHOLD) return 0;
    return Math.min(GIFT_MAX, 1 + Math.floor((romance - GIFT_THRESHOLD) / GIFT_STEP));
  });

  protected readonly otherStage = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < EMBLEM_THRESHOLD) return 0;
    return Math.min(EMBLEM_MAX, 1 + Math.floor((other - EMBLEM_THRESHOLD) / EMBLEM_STEP));
  });

  protected readonly giftScale = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    const first = Math.max(0, Math.min(1, (romance - GIFT_THRESHOLD) / HEART_RANGE));
    const resumed = Math.max(0, Math.min(1, (romance - GIFT_RESUME) / GIFT_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly emblemScale = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    const first = Math.max(0, Math.min(1, (other - EMBLEM_THRESHOLD) / SCRAP_RANGE));
    const resumed = Math.max(0, Math.min(1, (other - EMBLEM_RESUME) / EMBLEM_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly hearts = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < HEART_THRESHOLD) return [];

    const beating = isHighStat(statValue(this.stats(), 'Health'));
    const progress = Math.min(1, (romance - HEART_THRESHOLD) / HEART_RANGE);
    const count = Math.round((8 + 6 * progress) / 2);
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

  protected readonly scraps = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return [];

    const jittery = isLowStat(statValue(this.stats(), 'INT'));
    const progress = Math.min(1, (other - SCRAP_THRESHOLD) / SCRAP_RANGE);
    const count = Math.round((8 + 6 * progress) / 2);
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

  protected readonly lovebirds = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < HEART_THRESHOLD) return null;

    const closeness = Math.min(1, (romance - HEART_THRESHOLD) / BIRD_RANGE);
    return {
      snuggled: romance >= BIRD_SNUGGLE,
      approach: `translate(${(56 * closeness).toFixed(1)}px, 0) rotate(${(7 * closeness).toFixed(1)}deg)`,
    };
  });

  protected readonly bookPile = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return null;

    const count = Math.min(BOOK_MAX, 2 + Math.floor((other - SCRAP_THRESHOLD) / BOOK_STEP));
    const books: {
      transform: string;
      rectX: string;
      rectY: string;
      rectW: string;
      rectH: string;
      markShift: string;
      mark: number;
    }[] = [];
    let top = 106;

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('book', index, slot);
      const width = 42 + rand(0) * 16;
      const height = 9 + rand(1) * 3.5;
      top -= height;
      books.push({
        transform: `translate(${(41 + rand(2) * 8).toFixed(1)} ${(top + height / 2).toFixed(1)}) rotate(${(-3 + rand(3) * 6).toFixed(1)})`,
        rectX: (-width / 2).toFixed(1),
        rectY: (-height / 2).toFixed(1),
        rectW: width.toFixed(1),
        rectH: height.toFixed(1),
        markShift: `translate(${(width / 2 - 6).toFixed(1)} 0)`,
        mark: index % 6,
      });
    }

    const open = other >= BOOK_OPEN;
    const pages: { style: Record<string, string> }[] = [];

    if (open) {
      for (let index = 0; index < 3; index++) {
        const rand = (slot: number) => noise('page', index, slot);
        pages.push({
          style: {
            left: pct(0.3 + rand(0) * 0.4),
            bottom: px(110 - top + 6 + rand(1) * 8),
            '--drift': px(-16 + rand(2) * 32),
            '--lift': px(40 + rand(3) * 30),
            '--peak': (0.35 + rand(4) * 0.25).toFixed(3),
            width: px(5 + rand(5) * 2.5),
            height: px(6 + rand(5) * 2.5),
            'animation-duration': secs(4 + rand(6) * 2.5),
            'animation-delay': secs(-rand(7) * 6),
          },
        });
      }
    }

    return {
      books,
      open,
      openAt: `translate(45 ${(top - 3).toFixed(1)})`,
      pages,
    };
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
