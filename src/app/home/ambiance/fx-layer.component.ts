import { Component, Type, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import fx from '../../content/fx.json';
import { Stat } from '../../models/turn.model';
import { isHighStat, isLowStat, statValue } from './ambiance.engine';
import { FieldMaskService } from './field-mask.service';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';
import { BackdropComponent } from '../backdrop/backdrop.component';

// Full-page ambient layer, behind the interface and inert to the pointer. Holds the
// permanent base (felt grain, dust, vignette), the stat-driven effects (Mana runes, Gold
// flakes and their low-stat counterparts) and the `fx` slot of the current decor.
//
// Particles are plain DOM elements animated by CSS: their geometry is computed once here
// and handed over as inline custom properties, so nothing is recomputed per frame.

// One particle: pre-baked inline styles, plus a glyph for the rune effects
type Fleck = {
  glyph?: string;
  style: Record<string, string>;
};

const RUNES = fx.runes;

@Component({
  selector: 'app-fx-layer',
  imports: [NgComponentOutlet, BackdropComponent],
  templateUrl: './fx-layer.component.html',
  styleUrl: './fx-layer.component.scss',
  host: { class: 'gm-fx', 'aria-hidden': 'true' },
})
export class FxLayerComponent {
  readonly stats = input<readonly Stat[]>([]);

  protected readonly fieldRects = inject(FieldMaskService).rects;

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  // Permanent, ambiance-independent: the grain that keeps the page from feeling flat
  protected readonly dustSinking = computed(() => this.hasLow('AGI'));

  protected readonly dust = computed(() => {
    const sinking = this.dustSinking();
    return build(11, 'dust', (rand) => ({
      style: {
        left: pct(rand(0)),
        top: pct(rand(1)),
        '--drift': px(-40 + rand(2) * 80),
        '--lift': px(sinking ? -(50 + rand(3) * 90) : 60 + rand(3) * 120),
        '--peak': (0.1 + rand(4) * 0.16).toFixed(3),
        width: px(2 + rand(5) * 2),
        height: px(2 + rand(5) * 2),
        'animation-duration': secs(sinking ? 40 + rand(6) * 26 : 26 + rand(6) * 22),
        'animation-delay': secs(-rand(7) * 30),
      },
    }));
  });

  protected readonly windTrails = computed(() =>
    build(this.hasHigh('AGI') ? 5 : 0, 'wind', (rand) => ({
      style: {
        left: pct(-0.1 + rand(0) * 0.3),
        top: pct(0.08 + rand(1) * 0.8),
        width: px(60 + rand(2) * 80),
        '--dash': px(700 + rand(3) * 700),
        '--peak': (0.25 + rand(4) * 0.25).toFixed(3),
        'animation-duration': secs(8 + rand(5) * 7),
        'animation-delay': secs(-rand(6) * 15),
      },
    })),
  );

  // Stat-driven effects. A count of 0 empties the array, which collapses the @if in the
  // template and destroys the nodes — effects are never merely hidden.
  protected readonly runes = computed(() =>
    build(this.hasHigh('Mana') ? RUNES.length : 0, 'rune', (rand, index) => ({
      glyph: RUNES[index],
      style: {
        '--radius': px(300 + rand(0) * 260),
        'animation-duration': secs(34 + rand(1) * 26),
        'animation-delay': secs(-index * 6),
        'font-size': px(20 + rand(2) * 16),
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

  // Low Gold: dull motes sinking (negative --lift), the mirror image of the flakes above.
  // Stratified placement — one per 1/14th of the width — avoids visible clumping.
  protected readonly fallingMotes = computed(() =>
    build(this.hasLow('Gold') ? 14 : 0, 'mote', (rand, index) => ({
      style: {
        left: pct((index + rand(0)) / 14),
        top: pct(rand(1) * 0.85),
        '--drift': px(-30 + rand(2) * 60),
        '--lift': px(-(70 + rand(3) * 90)),
        '--peak': (0.25 + rand(4) * 0.2).toFixed(3),
        width: px(3 + rand(5) * 3),
        height: px(3 + rand(5) * 3),
        'animation-duration': secs(16 + rand(6) * 12),
        'animation-delay': secs(-rand(7) * 24),
      },
    })),
  );

  // Low Mana: the same runes, but lying dead along the bottom edge instead of orbiting
  protected readonly fallenRunes = computed(() =>
    build(this.hasLow('Mana') ? RUNES.length : 0, 'fallen', (rand, index) => ({
      glyph: RUNES[index],
      style: {
        left: pct((index + 0.1 + rand(0) * 0.8) / RUNES.length),
        bottom: px(5 + rand(1) * 14),
        '--tilt': `${Math.round(-80 + rand(2) * 160)}deg`,
        'font-size': px(13 + rand(3) * 9),
        opacity: (0.14 + rand(4) * 0.16).toFixed(3),
      },
    })),
  );

  private hasHigh(name: string): boolean {
    return isHighStat(statValue(this.stats(), name));
  }

  private hasLow(name: string): boolean {
    return isLowStat(statValue(this.stats(), name));
  }
}

// `rand(slot)` hands out an independent value per particle and per property, so tweaking
// one axis of an effect does not reshuffle the others
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

// FNV-1a over "salt:index:slot". Deterministic on purpose: Math.random would redraw the
// whole scatter on every recompute of the signal, making the effects visibly jump.
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
