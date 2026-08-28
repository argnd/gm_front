import { Component, Type, computed, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import fx from '../../content/fx.json';
import { Stat } from '../../models/turn.model';
import { isHighStat, isLowStat, statValue } from './ambiance.engine';
import { FieldMaskService } from './field-mask.service';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

type Fleck = {
  glyph?: string;
  style: Record<string, string>;
};

const RUNES = fx.runes;

@Component({
  selector: 'app-fx-layer',
  imports: [NgComponentOutlet],
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
