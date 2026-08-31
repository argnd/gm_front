import { Component, computed, input } from '@angular/core';
import { Ambiance } from '../../models/turn.model';
import {
  AMBIANCE_KEYS,
  AMBIANCE_MAX_TOTAL,
  ambianceTotal,
  ambianceValue,
} from '../ambiance/ambiance.engine';

const BASE_COLOR = { r: 132, g: 148, b: 184 };
const HUE_COLORS = {
  romance: { r: 255, g: 111, b: 159 },
  adventure: { r: 255, g: 160, b: 74 },
  other: { r: 125, g: 143, b: 212 },
} as const;

@Component({
  selector: 'app-backdrop',
  templateUrl: './backdrop.component.html',
  styleUrl: './backdrop.component.scss',
  host: {
    'aria-hidden': 'true',
    '[style.--bd-tint]': 'tint()',
    '[style.--bd-glow]': 'glow()',
    '[style.--bd-shade]': 'shade()',
  },
})
export class BackdropComponent {
  readonly ambiance = input<Ambiance | null>(null);

  protected readonly tint = computed(() => {
    const value = this.ambiance();
    const total = value ? ambianceTotal(value) : 0;
    const baseWeight = Math.max(0, 1 - total / AMBIANCE_MAX_TOTAL);
    let r = BASE_COLOR.r * baseWeight;
    let g = BASE_COLOR.g * baseWeight;
    let b = BASE_COLOR.b * baseWeight;
    let weightSum = baseWeight;

    for (const key of AMBIANCE_KEYS) {
      const weight = ambianceValue(value, key) / AMBIANCE_MAX_TOTAL;
      r += HUE_COLORS[key].r * weight;
      g += HUE_COLORS[key].g * weight;
      b += HUE_COLORS[key].b * weight;
      weightSum += weight;
    }

    return `rgb(${Math.round(r / weightSum)}, ${Math.round(g / weightSum)}, ${Math.round(b / weightSum)})`;
  });

  protected readonly glow = computed(() => {
    const value = this.ambiance();
    const total = value ? ambianceTotal(value) : 0;
    return Math.min(1, total / AMBIANCE_MAX_TOTAL).toFixed(3);
  });

  protected readonly shade = computed(() =>
    (ambianceValue(this.ambiance(), 'other') / AMBIANCE_MAX_TOTAL).toFixed(3),
  );
}
