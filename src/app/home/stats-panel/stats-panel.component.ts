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
  STAT_SIGNATURES_LOW,
  ambianceValue,
  clamp01,
  isHighStat,
  isLowStat,
  statSlug,
  tierOf,
} from '../ambiance/ambiance.engine';

// Character sheet: the six stats and the three ambiance axes. Reads everything through the
// engine (labels, glyphs, thresholds) so no game value is hardcoded in the template.

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
  @Input() lowSignatures: Stat[] = [];
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

  protected slug(name: string): string {
    return statSlug(name);
  }

  // Flavour lines shown only when a stat sits above or below its threshold
  protected signature(name: string): string {
    return STAT_SIGNATURES[name] ?? '';
  }

  protected signatureLow(name: string): string {
    return STAT_SIGNATURES_LOW[name] ?? '';
  }

  // Gauge widths. Clamped because the backend can send a value beyond the nominal scale
  // and a bar wider than its track would break the panel's layout.
  protected fill(value: number): string {
    return `${(clamp01(value / STAT_SCALE) * 100).toFixed(1)}%`;
  }

  protected ambianceFill(value: number): string {
    return `${(clamp01(value / AMBIANCE_MAX) * 100).toFixed(1)}%`;
  }

  protected isHigh(value: number): boolean {
    return isHighStat(value);
  }

  protected isLow(value: number): boolean {
    return isLowStat(value);
  }
}
