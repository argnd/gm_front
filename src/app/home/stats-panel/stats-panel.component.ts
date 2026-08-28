import { Component, EventEmitter, Input, Output, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { Stat, Ambiance } from '../../models/turn.model';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';
import {
  AMBIANCE_KEYS,
  AMBIANCE_LABELS,
  AMBIANCE_MAX,
  AMBIANCE_THRESHOLDS,
  AmbianceKey,
  STAT_GLYPHS,
  STAT_LABELS,
  STAT_SCALE,
  STAT_SIGNATURES,
  ambianceValue,
  clamp01,
  isHighStat,
  tierOf,
} from '../ambiance/ambiance.engine';

type AmbianceRow = {
  key: AmbianceKey;
  label: string;
  value: number;
  tier: number;
};

@Component({
  selector: 'app-stats-panel',
  imports: [NgComponentOutlet],
  templateUrl: './stats-panel.component.html',
  styleUrl: './stats-panel.component.scss',
})
export class StatsPanelComponent {
  @Input() statsEntries: Stat[] = [];
  @Input() ambiance: Ambiance | null = null;
  @Input() signatures: Stat[] = [];
  @Input() disabled = false;
  @Output() randomize = new EventEmitter<void>();

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  protected readonly thresholds = AMBIANCE_THRESHOLDS;
  protected readonly ambianceMax = AMBIANCE_MAX;

  get ambianceRows(): AmbianceRow[] {
    if (!this.ambiance) return [];

    return AMBIANCE_KEYS.map((key) => {
      const value = ambianceValue(this.ambiance, key);
      return { key, label: AMBIANCE_LABELS[key], value, tier: tierOf(value) };
    });
  }

  protected label(name: string): string {
    return STAT_LABELS[name] ?? name;
  }

  protected glyph(name: string): string {
    return STAT_GLYPHS[name] ?? '◆';
  }

  protected signature(name: string): string {
    return STAT_SIGNATURES[name] ?? '';
  }

  protected fill(value: number): string {
    return `${(clamp01(value / STAT_SCALE) * 100).toFixed(1)}%`;
  }

  protected ambianceFill(value: number): string {
    return `${(clamp01(value / AMBIANCE_MAX) * 100).toFixed(1)}%`;
  }

  protected isHigh(value: number): boolean {
    return isHighStat(value);
  }
}
