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
  selector: 'app-decor-adventure-other',
  templateUrl: './adventure-other-decor.component.html',
  styleUrl: './adventure-other-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    '[style.--flag-scale]': 'flagScale()',
    '[style.--emblem-scale]': 'emblemScale()',
    'aria-hidden': 'true',
  },
})
export class AdventureOtherDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly state = computed(() => resolveAmbianceState(this.ambiance()));

  protected readonly healthHigh = computed(() => isHighStat(statValue(this.stats(), 'Health')));
  protected readonly healthLow = computed(() => isLowStat(statValue(this.stats(), 'Health')));
  protected readonly manaHigh = computed(() => isHighStat(statValue(this.stats(), 'Mana')));
  protected readonly manaLow = computed(() => isLowStat(statValue(this.stats(), 'Mana')));
  protected readonly strHigh = computed(() => isHighStat(statValue(this.stats(), 'STR')));
  protected readonly strLow = computed(() => isLowStat(statValue(this.stats(), 'STR')));
  protected readonly agiHigh = computed(() => isHighStat(statValue(this.stats(), 'AGI')));
  protected readonly agiLow = computed(() => isLowStat(statValue(this.stats(), 'AGI')));
  protected readonly intHigh = computed(() => isHighStat(statValue(this.stats(), 'INT')));
  protected readonly intLow = computed(() => isLowStat(statValue(this.stats(), 'INT')));
  protected readonly goldHigh = computed(() => isHighStat(statValue(this.stats(), 'Gold')));
  protected readonly adventureLeads = computed(() => this.state() === 'adventure-2-other-1');
  protected readonly otherLeads = computed(() => this.state() === 'other-2-adventure-1');

  protected readonly adventureStage = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < FLAG_THRESHOLD) return 0;
    return Math.min(FLAG_MAX, 1 + Math.floor((adventure - FLAG_THRESHOLD) / FLAG_STEP));
  });

  protected readonly otherStage = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < EMBLEM_THRESHOLD) return 0;
    return Math.min(EMBLEM_MAX, 1 + Math.floor((other - EMBLEM_THRESHOLD) / EMBLEM_STEP));
  });

  protected readonly flagScale = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    const first = Math.max(0, Math.min(1, (adventure - FLAG_THRESHOLD) / LEAF_RANGE));
    const resumed = Math.max(0, Math.min(1, (adventure - FLAG_RESUME) / FLAG_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly emblemScale = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    const first = Math.max(0, Math.min(1, (other - EMBLEM_THRESHOLD) / SCRAP_RANGE));
    const resumed = Math.max(0, Math.min(1, (other - EMBLEM_RESUME) / EMBLEM_RESUME_RANGE));
    return (0.85 + 0.45 * first + 0.4 * resumed).toFixed(3);
  });

  protected readonly leaves = computed(() => {
    const adventure = ambianceValue(this.ambiance(), 'adventure');
    if (adventure < LEAF_THRESHOLD) return [];

    const gusty = this.agiHigh();
    const sluggish = this.agiLow();
    const jittery = this.intLow();
    const progress = Math.min(1, (adventure - LEAF_THRESHOLD) / LEAF_RANGE);
    const count = Math.round((8 + 6 * progress) / 2);
    const drift: {
      gusty: boolean;
      jittery: boolean;
      style: Record<string, string>;
      spin: Record<string, string>;
    }[] = [];

    for (let index = 0; index < count; index++) {
      const rand = (slot: number) => noise('leaf', index, slot);
      const size = 10 + rand(5) * 6;
      const x = (index + rand(0)) / count;
      const fall = secs((14 + rand(6) * 10) * (sluggish ? 1.5 : 1));
      const style: Record<string, string> = {
        left: pct(x),
        top: pct(rand(1) * 0.85),
        '--drift': px(sluggish ? 0 : 60 + rand(2) * 80),
        '--lift': px(-(120 + rand(3) * 100)),
        '--peak': (0.4 + rand(4) * 0.3).toFixed(3),
        width: px(size),
        height: px(size),
        'animation-duration': fall,
        'animation-delay': secs(-rand(7) * 24),
      };

      if (gusty) {
        const flutter = 7 + rand(9) * 6;
        style['animation-duration'] = `${fall}, ${secs(flutter)}`;
        style['animation-delay'] = `${secs(-rand(7) * 24)}, ${secs(-rand(10) * flutter)}`;
      }

      if (jittery) {
        const tremble = 1.7 + rand(9) * 1.4;
        style['animation-duration'] = `${fall}, ${secs(tremble)}`;
        style['animation-delay'] = `${secs(-rand(7) * 24)}, ${secs(-rand(10) * tremble)}`;
      }

      drift.push({
        gusty,
        jittery,
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

    const jittery = this.intLow();
    const lucid = this.intHigh();
    const spinPace = this.agiHigh() ? 0.5 : 1;
    const progress = Math.min(1, (other - SCRAP_THRESHOLD) / SCRAP_RANGE);
    const count = Math.round((8 + 6 * progress) / 2);
    const litter: {
      jittery: boolean;
      lucid: boolean;
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
        lucid,
        style,
        spin: {
          'animation-duration': secs((7 + rand(8) * 5) * spinPace),
        },
      });
    }

    return litter;
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

  protected readonly bookPile = computed(() => {
    const other = ambianceValue(this.ambiance(), 'other');
    if (other < SCRAP_THRESHOLD) return null;

    const count = Math.min(BOOK_MAX, 2 + Math.floor((other - SCRAP_THRESHOLD) / BOOK_STEP));
    const thick = this.strHigh() && this.otherLeads() ? 1.3 : 1;
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
      const height = (9 + rand(1) * 3.5) * thick;
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
