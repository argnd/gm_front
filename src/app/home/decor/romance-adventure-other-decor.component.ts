import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceValue, isHighStat, isLowStat, statValue } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

const HEART_THRESHOLD = 30;
const HEART_RANGE = 29;
const GIFT_THRESHOLD = 30;
const GIFT_RANGE = 29;
const BIRD_RANGE = 70;
const LEAF_THRESHOLD = 30;
const LEAF_RANGE = 29;
const FLAG_THRESHOLD = 30;
const FLAG_RANGE = 29;
const SCRAP_THRESHOLD = 30;
const SCRAP_RANGE = 29;
const EMBLEM_THRESHOLD = 30;
const EMBLEM_RANGE = 29;
const BOOK_STEP = 10;

@Component({
  selector: 'app-decor-romance-adventure-other',
  templateUrl: './romance-adventure-other-decor.component.html',
  styleUrl: './romance-adventure-other-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--gift-scale]': 'giftScale()',
    '[style.--flag-scale]': 'flagScale()',
    '[style.--emblem-scale]': 'emblemScale()',
    'aria-hidden': 'true',
  },
})
export class RomanceAdventureOtherDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly giftScale = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    const first = Math.max(0, Math.min(1, (romance - GIFT_THRESHOLD) / GIFT_RANGE));
    return (0.85 + 0.45 * first).toFixed(3);
  });

  protected readonly flagScale = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    const first = Math.max(0, Math.min(1, (adventure - FLAG_THRESHOLD) / FLAG_RANGE));
    return (0.85 + 0.45 * first).toFixed(3);
  });

  protected readonly emblemScale = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    const first = Math.max(0, Math.min(1, (other - EMBLEM_THRESHOLD) / EMBLEM_RANGE));
    return (0.85 + 0.45 * first).toFixed(3);
  });

  protected readonly hearts = computed(() => {
    const romance = ambianceValue(this.ambiance(), 'romance');
    if (romance < HEART_THRESHOLD) return [];

    const beating = isHighStat(statValue(this.stats(), 'Health'));
    const progress = Math.min(1, (romance - HEART_THRESHOLD) / HEART_RANGE);
    const count = Math.round((8 + 6 * progress) / 3);
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

  protected readonly leaves = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < LEAF_THRESHOLD) return [];

    const gusty = isHighStat(statValue(this.stats(), 'AGI'));
    const progress = Math.min(1, (adventure - LEAF_THRESHOLD) / LEAF_RANGE);
    const count = Math.round((8 + 6 * progress) / 3);
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

  protected readonly scraps = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return [];

    const jittery = isLowStat(statValue(this.stats(), 'INT'));
    const progress = Math.min(1, (other - SCRAP_THRESHOLD) / SCRAP_RANGE);
    const count = Math.round((8 + 6 * progress) / 3);
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
      approach: `translate(${(56 * closeness).toFixed(1)}px, 0) rotate(${(7 * closeness).toFixed(1)}deg)`,
    };
  });

  protected readonly campfire = computed(
    () => ambianceValue(this.ambiance(), 'adventure') >= LEAF_THRESHOLD,
  );

  protected readonly bookPile = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return null;

    const count = 2 + Math.floor((other - SCRAP_THRESHOLD) / BOOK_STEP);
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

    return { books, perch: `translate(45 ${top.toFixed(1)})` };
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
