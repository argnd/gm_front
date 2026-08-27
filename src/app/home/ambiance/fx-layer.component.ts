import { Component, computed, input } from '@angular/core';
import fx from '../../content/fx.json';
import { Ambiance, Stat } from '../../models/turn.model';
import {
  AmbianceKey,
  ambianceValue,
  bandProgress,
  isHighStat,
  statValue,
  tierOf,
} from './ambiance.engine';

type Fleck = {
  glyph?: string;
  style: Record<string, string>;
};

const RUNES = fx.runes;
const PETALS_PER_TIER = fx.perTier.petals;
const EMBERS_PER_TIER = fx.perTier.embers;
const MOTES_PER_TIER = fx.perTier.motes;

@Component({
  selector: 'app-fx-layer',
  templateUrl: './fx-layer.component.html',
  styleUrl: './fx-layer.component.scss',
  host: { class: 'gm-fx', 'aria-hidden': 'true' },
})
export class FxLayerComponent {
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly romanceTier = computed(() => this.tier('romance'));
  protected readonly adventureTier = computed(() => this.tier('adventure'));
  protected readonly otherTier = computed(() => this.tier('other'));

  protected readonly dust = computed(() =>
    build(11, 'dust', (rand) => ({
      style: {
        left: pct(rand(0)),
        top: pct(rand(1)),
        '--drift': px(-40 + rand(2) * 80),
        '--lift': px(60 + rand(3) * 120),
        '--peak': (0.1 + rand(4) * 0.16).toFixed(3),
        width: px(2 + rand(5) * 2),
        height: px(2 + rand(5) * 2),
        'animation-duration': secs(26 + rand(6) * 22),
        'animation-delay': secs(-rand(7) * 30),
      },
    })),
  );

  protected readonly petals = computed(() => {
    const tier = this.romanceTier();
    const peak = 0.3 + this.band('romance') * 0.4;
    return build(PETALS_PER_TIER[tier], 'petal', (rand) => ({
      style: {
        left: pct(rand(0)),
        '--drift': px(-90 + rand(1) * 180),
        '--peak': (peak * (0.55 + rand(2) * 0.45)).toFixed(3),
        width: px(7 + rand(3) * 9),
        height: px(9 + rand(4) * 11),
        'animation-duration': secs(11 + rand(5) * 12),
        'animation-delay': secs(-rand(6) * 20),
      },
    }));
  });

  protected readonly embers = computed(() => {
    const tier = this.adventureTier();
    const peak = 0.35 + this.band('adventure') * 0.45;
    return build(EMBERS_PER_TIER[tier], 'ember', (rand) => ({
      style: {
        left: pct(rand(0)),
        '--drift': px(-70 + rand(1) * 140),
        '--peak': (peak * (0.5 + rand(2) * 0.5)).toFixed(3),
        width: px(2 + rand(3) * 4),
        height: px(2 + rand(3) * 4),
        'animation-duration': secs(7 + rand(4) * 9),
        'animation-delay': secs(-rand(5) * 14),
      },
    }));
  });

  protected readonly streaks = computed(() =>
    build(this.adventureTier() >= 2 ? 6 : 0, 'streak', (rand) => ({
      style: {
        top: pct(rand(0)),
        '--peak': (0.12 + rand(1) * 0.2).toFixed(3),
        width: px(120 + rand(2) * 220),
        'animation-duration': secs(5 + rand(3) * 6),
        'animation-delay': secs(-rand(4) * 12),
      },
    })),
  );

  protected readonly motes = computed(() => {
    const tier = this.otherTier();
    const peak = 0.16 + this.band('other') * 0.2;
    return build(MOTES_PER_TIER[tier], 'mote', (rand) => ({
      style: {
        left: pct(rand(0)),
        top: pct(rand(1)),
        '--drift': px(-60 + rand(2) * 120),
        '--lift': px(80 + rand(3) * 160),
        '--peak': (peak * (0.5 + rand(4) * 0.5)).toFixed(3),
        width: px(3 + rand(5) * 4),
        height: px(3 + rand(5) * 4),
        'animation-duration': secs(22 + rand(6) * 20),
        'animation-delay': secs(-rand(7) * 30),
      },
    }));
  });

  protected readonly runes = computed(() =>
    build(this.hasHigh('Mana') ? RUNES.length : 0, 'rune', (rand, index) => ({
      glyph: RUNES[index],
      style: {
        '--radius': px(150 + rand(0) * 150),
        'animation-duration': secs(34 + rand(1) * 26),
        'animation-delay': secs(-index * 6),
        'font-size': px(20 + rand(2) * 16),
      },
    })),
  );

  protected readonly gusts = computed(() =>
    build(this.hasHigh('AGI') ? 6 : 0, 'gust', (rand) => ({
      style: {
        top: pct(rand(0) * 0.9),
        '--peak': (0.16 + rand(1) * 0.22).toFixed(3),
        width: px(180 + rand(2) * 260),
        'animation-duration': secs(2.4 + rand(3) * 2.6),
        'animation-delay': secs(-rand(4) * 6),
      },
    })),
  );

  protected readonly goldFlakes = computed(() =>
    build(this.hasHigh('Gold') ? 16 : 0, 'gold', (rand) => ({
      style: {
        left: pct(rand(0)),
        top: pct(rand(1)),
        '--drift': px(-50 + rand(2) * 100),
        '--lift': px(70 + rand(3) * 130),
        '--peak': (0.3 + rand(4) * 0.45).toFixed(3),
        width: px(3 + rand(5) * 4),
        height: px(3 + rand(5) * 4),
        'animation-duration': secs(14 + rand(6) * 14),
        'animation-delay': secs(-rand(7) * 20),
      },
    })),
  );

  protected readonly leyNodes = computed(() =>
    build(this.hasHigh('INT') ? 14 : 0, 'ley', (rand) => ({
      style: {
        left: pct(rand(0)),
        top: pct(rand(1)),
        'animation-duration': secs(3 + rand(2) * 5),
        'animation-delay': secs(-rand(3) * 8),
        width: px(3 + rand(4) * 3),
        height: px(3 + rand(4) * 3),
      },
    })),
  );

  protected readonly vitalHigh = computed(() => this.hasHigh('Health'));
  protected readonly strHigh = computed(() => this.hasHigh('STR'));
  protected readonly intHigh = computed(() => this.hasHigh('INT'));

  private tier(key: AmbianceKey): number {
    return tierOf(ambianceValue(this.ambiance(), key));
  }

  private band(key: AmbianceKey): number {
    return bandProgress(ambianceValue(this.ambiance(), key));
  }

  private hasHigh(name: string): boolean {
    return isHighStat(statValue(this.stats(), name));
  }
}

function build(
  count: number,
  salt: string,
  make: (rand: (slot: number) => number, index: number) => Fleck,
): Fleck[] {
  const flecks: Fleck[] = [];
  for (let index = 0; index < count; index++) {
    flecks.push(make((slot) => noise(salt, index, slot), index));
  }
  return flecks;
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
