import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceTotal } from '../ambiance/ambiance.engine';
import { AmbianceDecorSlot } from './ambiance-decor';

// Decor for the `neutral` state (every axis below the first threshold). Instantiated once
// per slot, the `slot` input selecting which fragment of the scene this instance draws.
//
// Two evolution mechanics coexist here, both keyed on the ambiance *total*: the blooming
// cycle scattered across the interface advances by steps (`stage`), while the pollen ramps
// up continuously (`pollen`). Both are recomputed from the raw ambiance, never handed down
// by the home.

const POLLEN_THRESHOLD = 20; // below this, no pollen at all
const POLLEN_RANGE = 67; // total span over which the grain count ramps up

@Component({
  selector: 'app-decor-neutral',
  templateUrl: './neutral-decor.component.html',
  styleUrl: './neutral-decor.component.scss',
  host: {
    // The host carries its own slot as a class, which is how the stylesheet gives each
    // slot its position without the layout knowing anything about the decor
    '[class]': '"decor-" + slot()',
    'aria-hidden': 'true',
  },
})
export class NeutralDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  // Blooming step, 0 to 3: one extra flower per 10 points of total from 60 upwards
  // (60/70/80). Clamped on both ends so an off-scale total cannot produce a missing stage.
  protected readonly stage = computed(() => {
    const value = this.ambiance();
    if (!value) return 0;
    return Math.max(0, Math.min(3, Math.floor(ambianceTotal(value) / 10) - 5));
  });

  // Continuous ramp: 8 grains at the threshold, 22 at the top of the range. Returning an
  // empty array below the threshold destroys the nodes rather than hiding them.
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
      // Stratified: one grain per 1/count slice, jittered inside it. The 1.25 exponent
      // then leans the whole scatter left, where the flora lives.
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

// Same deterministic FNV-1a as the FX layer: the scatter must stay put across recomputes,
// otherwise every ambiance change would teleport every grain
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
