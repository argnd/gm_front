import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Ambiance, AnswerPayload, DEFAULT_AMBIANCE, Stat } from '../../models/turn.model';
import {
  AMBIANCE_KEYS,
  AMBIANCE_LABELS,
  AMBIANCE_MAX,
  AMBIANCE_MAX_TOTAL,
  AMBIANCE_THRESHOLDS,
  AmbianceKey,
  STAT_HIGH_THRESHOLD,
  STAT_LABELS,
  ambianceTotal,
  ambianceValue,
  isHighStat,
  tierOf,
} from '../ambiance/ambiance.engine';
import { DebugHistoryComponent } from '../debug-history/debug-history.component';

const STAT_SLIDER_MAX = 12;
const PRESET_VALUES = [0, 30, 60, 95] as const;

type DebugTab = 'ambiance' | 'echanges';

@Component({
  selector: 'app-debug-panel',
  imports: [DebugHistoryComponent],
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss',
  host: {
    '(focusout)': 'onFocusOut($event)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class DebugPanelComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);
  readonly halfturns = input<AnswerPayload[]>([]);
  readonly turns = input<AnswerPayload[]>([]);

  readonly ambianceChange = output<Ambiance>();
  readonly statsChange = output<Stat[]>();

  protected readonly keys = AMBIANCE_KEYS;
  protected readonly labels = AMBIANCE_LABELS;
  protected readonly statLabels = STAT_LABELS;
  protected readonly thresholds = AMBIANCE_THRESHOLDS;
  protected readonly presets = PRESET_VALUES;
  protected readonly ambianceMax = AMBIANCE_MAX;
  protected readonly maxTotal = AMBIANCE_MAX_TOTAL;
  protected readonly statMax = STAT_SLIDER_MAX;
  protected readonly highThreshold = STAT_HIGH_THRESHOLD;

  protected readonly tab = signal<DebugTab>('ambiance');

  protected readonly total = computed(() => ambianceTotal(this.current()));

  protected readonly remaining = computed(() => AMBIANCE_MAX_TOTAL - this.total());

  protected selectTab(tab: DebugTab): void {
    this.tab.set(tab);
  }

  protected valueOf(key: AmbianceKey): number {
    return ambianceValue(this.ambiance(), key);
  }

  protected tierOf(key: AmbianceKey): number {
    return tierOf(this.valueOf(key));
  }

  protected isHigh(value: number): boolean {
    return isHighStat(value);
  }

  protected budgetFor(key: AmbianceKey): number {
    const current = this.current();
    const others = AMBIANCE_KEYS.filter((other) => other !== key).reduce(
      (sum, other) => sum + current[other],
      0,
    );
    return AMBIANCE_MAX_TOTAL - others;
  }

  protected onAmbianceInput(key: AmbianceKey, event: Event): void {
    const capped = Math.min(clamp(readNumber(event)), this.budgetFor(key));
    (event.target as HTMLInputElement).value = String(capped);
    this.ambianceChange.emit({ ...this.current(), [key]: capped });
  }

  protected onStatInput(name: string, event: Event): void {
    const value = Math.round(readNumber(event));
    this.statsChange.emit(
      this.stats().map((stat) => (stat.name === name ? { name, value } : { ...stat })),
    );
  }

  protected applyPreset(key: AmbianceKey, raw: number): void {
    const current = this.current();
    const target = clamp(raw);
    const others = AMBIANCE_KEYS.filter((other) => other !== key);
    const othersTotal = others.reduce((sum, other) => sum + current[other], 0);
    const next: Ambiance = { ...current, [key]: target };
    let budget = AMBIANCE_MAX_TOTAL - target;

    if (othersTotal > budget) {
      others.forEach((other, index) => {
        const share =
          index === others.length - 1
            ? budget
            : Math.min(budget, Math.round((current[other] / othersTotal) * budget));
        next[other] = share;
        budget -= share;
      });
    }

    this.ambianceChange.emit(next);
  }

  protected resetAmbiance(): void {
    this.ambianceChange.emit({ ...DEFAULT_AMBIANCE });
  }

  protected liftStats(): void {
    this.setAllStats(9);
  }

  protected lowerStats(): void {
    this.setAllStats(3);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    // relatedTarget null = clic dans une zone non focusable : le clic hors panneau
    // est déjà géré par onDocumentPointerDown, un clic interne ne doit pas replier.
    if (!(next instanceof Node)) return;
    if (this.host.nativeElement.contains(next)) return;

    this.collapse();
  }

  protected onDocumentPointerDown(event: PointerEvent): void {
    const target = event.target;
    if (target instanceof Node && this.host.nativeElement.contains(target)) return;

    this.collapse();
  }

  private collapse(): void {
    const details = this.host.nativeElement.querySelector('details');
    if (details) details.open = false;
  }

  private setAllStats(value: number): void {
    this.statsChange.emit(this.stats().map((stat) => ({ name: stat.name, value })));
  }

  private current(): Ambiance {
    const value = this.ambiance();
    return value ? { ...value } : { ...DEFAULT_AMBIANCE };
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(AMBIANCE_MAX, Math.max(0, Math.round(value)));
}

function readNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}
