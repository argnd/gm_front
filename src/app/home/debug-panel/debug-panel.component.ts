import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Ambiance, AnswerPayload, DEFAULT_AMBIANCE, Stat } from '../../models/turn.model';
import {
  AMBIANCE_KEYS,
  AMBIANCE_LABELS,
  AMBIANCE_MAX,
  AMBIANCE_MAX_TOTAL,
  AMBIANCE_THRESHOLDS,
  AmbianceKey,
  AmbianceState,
  STAT_HIGH_THRESHOLD,
  STAT_LABELS,
  ambianceTotal,
  ambianceValue,
  isHighStat,
  isLowStat,
  resolveAmbianceState,
  tierOf,
} from '../ambiance/ambiance.engine';
import { SpeechService } from '../../core/speech.service';
import { DebugHistoryComponent } from '../debug-history/debug-history.component';

// Development tool: forces the game state without going through the backend, and shows
// what actually travels over the wire. Emits outputs only — it owns no game state, so
// anything it does is exactly what a real turn would do.

const STAT_SLIDER_MAX = 12; // above the nominal scale on purpose, to test overflow
const PRESET_VALUES = [0, 29, 59, 89] as const; // just under each tier threshold

type DebugTab = 'ambiance' | 'rendu' | 'echanges';

type StatePreset = { key: AmbianceState; label: string; ambiance: Ambiance };

// One entry per reachable state, so every decor can be viewed in one click. Values are
// chosen to land squarely inside their tier, away from threshold edges.
const STATE_PRESETS: StatePreset[] = [
  { key: 'neutral', label: 'Neutre', ambiance: { romance: 10, adventure: 10, other: 10 } },
  { key: 'romance-1', label: '1R', ambiance: { romance: 45, adventure: 10, other: 10 } },
  { key: 'adventure-1', label: '1A', ambiance: { romance: 10, adventure: 45, other: 10 } },
  { key: 'other-1', label: '1O', ambiance: { romance: 10, adventure: 10, other: 45 } },
  { key: 'romance-2', label: '2R', ambiance: { romance: 65, adventure: 10, other: 10 } },
  { key: 'adventure-2', label: '2A', ambiance: { romance: 10, adventure: 65, other: 10 } },
  { key: 'other-2', label: '2O', ambiance: { romance: 10, adventure: 10, other: 65 } },
  { key: 'romance-3', label: '3R', ambiance: { romance: 90, adventure: 5, other: 5 } },
  { key: 'adventure-3', label: '3A', ambiance: { romance: 5, adventure: 90, other: 5 } },
  { key: 'other-3', label: '3O', ambiance: { romance: 5, adventure: 5, other: 90 } },
  {
    key: 'romance-1-adventure-1',
    label: '1R + 1A',
    ambiance: { romance: 40, adventure: 35, other: 10 },
  },
  { key: 'romance-1-other-1', label: '1R + 1O', ambiance: { romance: 40, adventure: 10, other: 35 } },
  {
    key: 'adventure-1-other-1',
    label: '1A + 1O',
    ambiance: { romance: 10, adventure: 40, other: 35 },
  },
  {
    key: 'romance-1-adventure-1-other-1',
    label: '1R + 1A + 1O',
    ambiance: { romance: 33, adventure: 33, other: 33 },
  },
  {
    key: 'romance-2-adventure-1',
    label: '2R + 1A',
    ambiance: { romance: 60, adventure: 35, other: 5 },
  },
  { key: 'romance-2-other-1', label: '2R + 1O', ambiance: { romance: 60, adventure: 5, other: 35 } },
  {
    key: 'adventure-2-romance-1',
    label: '2A + 1R',
    ambiance: { romance: 35, adventure: 60, other: 5 },
  },
  {
    key: 'adventure-2-other-1',
    label: '2A + 1O',
    ambiance: { romance: 5, adventure: 60, other: 35 },
  },
  { key: 'other-2-romance-1', label: '2O + 1R', ambiance: { romance: 35, adventure: 5, other: 60 } },
  {
    key: 'other-2-adventure-1',
    label: '2O + 1A',
    ambiance: { romance: 5, adventure: 35, other: 60 },
  },
];

@Component({
  selector: 'app-debug-panel',
  imports: [DebugHistoryComponent],
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss',
  host: {
    // Two complementary ways of closing the panel — see onFocusOut
    '(focusout)': 'onFocusOut($event)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
})
export class DebugPanelComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly speech = inject(SpeechService);

  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);
  readonly halfturns = input<AnswerPayload[]>([]);
  readonly turns = input<AnswerPayload[]>([]);

  readonly ambianceChange = output<Ambiance>();
  readonly statsChange = output<Stat[]>();
  readonly surfaceOpacityChange = output<number>();
  readonly borderOpacityChange = output<number>();
  readonly shadowOpacityChange = output<number>();
  readonly fieldDimChange = output<number>();
  readonly fieldFeatherChange = output<number>();

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

  protected readonly statePresets = STATE_PRESETS;

  protected readonly currentState = computed(() => resolveAmbianceState(this.ambiance()));

  protected readonly surfaceOpacity = signal(100);
  protected readonly borderOpacity = signal(100);
  protected readonly shadowOpacity = signal(100);
  protected readonly fieldDim = signal(25);
  protected readonly fieldFeather = signal(40);

  // Budget left over the three axes: shown so the sliders' ceiling is legible
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

  protected isLow(value: number): boolean {
    return isLowStat(value);
  }

  // Ceiling for one axis: whatever the other two leave of the shared total
  protected budgetFor(key: AmbianceKey): number {
    const current = this.current();
    const others = AMBIANCE_KEYS.filter((other) => other !== key).reduce(
      (sum, other) => sum + current[other],
      0,
    );
    return AMBIANCE_MAX_TOTAL - others;
  }

  protected onAmbianceInput(key: AmbianceKey, event: Event): void {
    // The slider is written back so its knob visibly stops at the budget instead of
    // drifting away from the value actually emitted
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

  // Forces one axis to a value and, if that busts the budget, shrinks the other two
  // proportionally so their ratio is preserved. The last axis takes whatever is left
  // rather than its own rounded share, so the total lands exactly on the budget.
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

  // Shortcuts straddling the high/low thresholds, to check the stat-driven staging
  protected liftStats(): void {
    this.setAllStats(9);
  }

  protected lowerStats(): void {
    this.setAllStats(3);
  }

  protected drainStats(): void {
    this.setAllStats(1);
  }

  protected onStateSelect(event: Event): void {
    const key = (event.target as HTMLSelectElement).value;
    const preset = STATE_PRESETS.find((entry) => entry.key === key);
    if (preset) this.ambianceChange.emit({ ...preset.ambiance });
  }

  protected setStat(name: string, value: number): void {
    this.statsChange.emit(
      this.stats().map((stat) => (stat.name === name ? { name, value } : { ...stat })),
    );
  }

  // Rendering knobs: each keeps a local copy for its own slider and emits the value, which
  // the home turns into a custom property on the page
  protected onSurfaceOpacity(event: Event): void {
    this.applySurfaceOpacity(Math.round(readNumber(event)));
  }

  protected applySurfaceOpacity(value: number): void {
    this.surfaceOpacity.set(value);
    this.surfaceOpacityChange.emit(value);
  }

  protected onBorderOpacity(event: Event): void {
    this.applyBorderOpacity(Math.round(readNumber(event)));
  }

  protected applyBorderOpacity(value: number): void {
    this.borderOpacity.set(value);
    this.borderOpacityChange.emit(value);
  }

  protected onShadowOpacity(event: Event): void {
    this.applyShadowOpacity(Math.round(readNumber(event)));
  }

  protected applyShadowOpacity(value: number): void {
    this.shadowOpacity.set(value);
    this.shadowOpacityChange.emit(value);
  }

  protected onFieldDim(event: Event): void {
    this.applyFieldDim(Math.round(readNumber(event)));
  }

  protected applyFieldDim(value: number): void {
    this.fieldDim.set(value);
    this.fieldDimChange.emit(value);
  }

  protected onFieldFeather(event: Event): void {
    this.applyFieldFeather(Math.round(readNumber(event)));
  }

  protected applyFieldFeather(value: number): void {
    this.fieldFeather.set(value);
    this.fieldFeatherChange.emit(value);
  }

  protected onVoiceSelect(event: Event): void {
    this.speech.setVoice((event.target as HTMLSelectElement).value);
  }

  protected onSpeechRate(event: Event): void {
    this.applySpeechRate(readNumber(event));
  }

  protected applySpeechRate(value: number): void {
    this.speech.setRate(value);
  }

  // Closes the panel when focus leaves it — the keyboard half of the pair, covering Tab
  // and Escape, which never produce a pointer event
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

  // Open/closed state lives in the native <details>, not in a signal: driven straight
  // through the DOM so the browser keeps handling the summary toggle on its own
  private collapse(): void {
    const details = this.host.nativeElement.querySelector('details');
    if (details) details.open = false;
  }

  private setAllStats(value: number): void {
    this.statsChange.emit(this.stats().map((stat) => ({ name: stat.name, value })));
  }

  // Always a copy: the emitted objects are mutated while budgets are redistributed and
  // must never alias the home's own ambiance
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
