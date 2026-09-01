import {
  Component,
  ElementRef,
  OnDestroy,
  Type,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  AMBIANCE_DECOR,
  AmbianceDecorData,
  AmbianceDecorSlot,
} from './decor/ambiance-decor';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { GameStateService } from '../core/game-state.service';
import { Stat, Ambiance, DEFAULT_AMBIANCE, Turn, AnswerPayload } from '../models/turn.model';
import {
  ACTION_COPY,
  AUTO_TURN,
  AmbianceState,
  MAX_TURNS,
  STAT_NAMES,
  STAT_RELICS,
  STAT_ROLL,
  StatRelic,
  ambianceClasses,
  ambianceVars,
  dominantKey,
  highStats,
  isHighStat,
  isLowStat,
  lowStats,
  resolveAmbianceState,
} from './ambiance/ambiance.engine';
import { FxLayerComponent } from './ambiance/fx-layer.component';
import { PlayFieldDirective } from './ambiance/play-field.directive';
import { FireflyComponent } from './firefly/firefly.component';
import { NavbarComponent } from './navbar/navbar.component';
import { StatsPanelComponent } from './stats-panel/stats-panel.component';
import { ObjectsPanelComponent } from './objects-panel/objects-panel.component';
import { RollsPanelComponent } from './rolls-panel/rolls-panel.component';
import { DebugPanelComponent } from './debug-panel/debug-panel.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { TurnCardComponent } from './turn-card/turn-card.component';
import { SuggestionPanelComponent } from './suggestion-panel/suggestion-panel.component';
import { AdventureOverOverlayComponent } from './adventure-over-overlay/adventure-over-overlay.component';

// Orchestrator of a game. Owns every piece of state (stats, objects, ambiance, history),
// talks to the backend, persists locally and distributes the current decor to its slots.
//
// It deliberately holds no staging logic: it resolves the ambiance state, loads the
// matching decor component and hands each slot the raw ambiance. Thresholds and evolution
// curves belong to the decor components themselves.

const ADVENTURE_OVER_DELAY_MS = 4_000; // time the end overlay stays up before the reset
const DECOR_VANISH_MS = 420;
const ROLLS_HIDDEN_STATES: ReadonlySet<AmbianceState> = new Set([
  'romance-1',
  'romance-2',
  'romance-3',
  'romance-2-adventure-1',
  'romance-2-other-1',
]);

@Component({
  selector: 'app-home',
  imports: [
    NgComponentOutlet,
    FxLayerComponent,
    PlayFieldDirective,
    FireflyComponent,
    NavbarComponent,
    StatsPanelComponent,
    ObjectsPanelComponent,
    RollsPanelComponent,
    DebugPanelComponent,
    ChatInputComponent,
    TurnCardComponent,
    SuggestionPanelComponent,
    AdventureOverOverlayComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly gameState = inject(GameStateService);

  protected readonly maxTurns = MAX_TURNS;

  protected readonly prompt = signal('');
  // Last backend answer, i.e. the story as currently displayed
  protected readonly conversation = signal<AnswerPayload | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  // What was *sent*, kept for the debug panel only — never persisted
  protected readonly halfturns = signal<AnswerPayload[]>([]);
  // One entry per completed round trip; its length is the number of turns played
  protected readonly turns = signal<AnswerPayload[]>([]);
  // Maps rather than arrays: the backend returns whole stats/objects lists and updating by
  // name avoids reconciling two arrays by index
  protected readonly stats = signal<Map<string, number>>(buildRandomStats());
  protected readonly objects = signal<Map<string, string>>(new Map());
  protected readonly ambiance = signal<Ambiance>(DEFAULT_AMBIANCE);
  protected readonly adventureOver = signal(false);
  // Live styling knobs driven by the debug panel; no effect on the game itself
  protected readonly debugSurfaceOpacity = signal(100);
  protected readonly debugBorderOpacity = signal(100);
  protected readonly debugShadowOpacity = signal(100);
  protected readonly debugFieldDim = signal(25);
  protected readonly debugFieldFeather = signal(40);
  protected readonly debugMotionScale = signal(100);

  protected readonly statsEntries = computed(() =>
    Array.from(this.stats().entries()).map(([name, value]) => ({ name, value })),
  );

  protected readonly objectsEntries = computed(() =>
    Array.from(this.objects().entries()).map(([name, description]) => ({ name, description })),
  );

  // Every roll of the whole game, most recent first.
  protected readonly rollEntries = computed(() => {
    const last = this.turns().at(-1);
    if (!last) return [];
    return last.turns
      .flatMap((turn, index) => (turn.diceRolls ?? []).map((roll) => ({ roll, turn: index + 1 })))
      .reverse();
  });

  // The story is split in two: the latest turn is always shown, the rest sits behind the
  // collapsible history. Both are wrapped in arrays so the template can use one @for.
  protected readonly latestTurnEntries = computed(() => {
    const turns = this.conversation()?.turns ?? [];
    const last = turns.at(-1);
    return last ? [{ turn: last, index: turns.length - 1 }] : [];
  });

  protected readonly historyEntries = computed(() =>
    (this.conversation()?.turns ?? [])
      .slice(0, -1)
      .map((turn, index) => ({ turn, index }))
      .reverse(),
  );

  protected readonly historyCollapsed = signal(true);

  protected readonly controlsDisabled = computed(() => this.loading() || this.adventureOver());

  protected readonly dominant = computed(() => dominantKey(this.ambiance()) ?? 'neutral');

  protected readonly pageClasses = computed(() =>
    ambianceClasses(this.ambiance(), this.statsEntries()),
  );

  protected readonly pageVars = computed(() => ambianceVars(this.ambiance()));

  protected readonly signatureStats = computed(() => highStats(this.statsEntries()));

  protected readonly lowSignatureStats = computed(() => lowStats(this.statsEntries()));

  protected readonly actionCopy = computed(() => ACTION_COPY[this.dominant()]);

  protected readonly ambianceState = computed(() => resolveAmbianceState(this.ambiance()));

  protected readonly rollsPanelVisible = computed(
    () => !ROLLS_HIDDEN_STATES.has(this.ambianceState()),
  );

  protected readonly decorComponent = signal<Type<unknown> | null>(null);

  protected readonly decorVanishing = signal(false);

  private decorSwapTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly gmPage = viewChild<ElementRef<HTMLElement>>('gmPage');

  // Raw data handed to every slot: each decor state derives its own thresholds from it
  protected readonly decorData = computed<AmbianceDecorData>(() => ({
    ambiance: this.ambiance(),
    stats: this.statsEntries(),
  }));

  constructor() {
    // Resolves the state to its decor component. Swapping the component is what destroys
    // the previous state's animations — they are never merely hidden.
    effect(() => {
      const state = this.ambianceState();
      const loader = AMBIANCE_DECOR[state];

      if (this.decorSwapTimer !== null) {
        clearTimeout(this.decorSwapTimer);
        this.decorSwapTimer = null;
      }

      const swapTo = (component: Type<unknown> | null) => {
        if (untracked(this.decorComponent) === null) {
          this.decorVanishing.set(false);
          this.decorComponent.set(component);
          return;
        }
        this.decorVanishing.set(true);
        this.decorSwapTimer = setTimeout(() => {
          this.decorSwapTimer = null;
          this.decorVanishing.set(false);
          if (this.ambianceState() === state) {
            this.decorComponent.set(component);
          }
        }, DECOR_VANISH_MS * this.motionScale());
      };

      if (!loader) {
        if (untracked(this.decorComponent) === null) {
          this.decorVanishing.set(false);
          return;
        }
        swapTo(null);
        return;
      }

      loader().then((component) => {
        // Race guard: two fast ambiance changes resolve their imports in any order, and a
        // late arrival must not overwrite the decor of the state now in force
        if (this.ambianceState() !== state) return;
        if (component === untracked(this.decorComponent)) {
          this.decorVanishing.set(false);
          return;
        }
        swapTo(component);
      });
    });

    this.restoreGameState();
    this.applyStatRelics();
  }

  // Inputs for one NgComponentOutlet: the same decor component, told which slot it renders
  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }

  private motionScale(): number {
    const el = untracked(this.gmPage)?.nativeElement;
    if (!el) return 1;
    const scale = Number.parseFloat(getComputedStyle(el).getPropertyValue('--motion-scale'));
    return Number.isFinite(scale) && scale >= 0 ? scale : 1;
  }

  protected readonly turnsPlayed = computed(() => this.turns().length);

  protected readonly trailMarkers = computed(() => {
    const played = this.turnsPlayed();
    return Array.from({ length: MAX_TURNS }, (_, index) => index < played);
  });

  private adventureOverTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.adventureOverTimer !== null) {
      clearTimeout(this.adventureOverTimer);
    }
    if (this.decorSwapTimer !== null) {
      clearTimeout(this.decorSwapTimer);
    }
  }

  protected submitTurn(): void {
    this.sendTurn(this.prompt(), true);
  }

  // "Auto" button: plays a canned action so the player can let the story run on its own.
  // Leaves the draft untouched, since the player did not write this turn.
  protected submitAutoTurn(): void {
    this.sendTurn(AUTO_TURN.message, false);
  }

  // Builds the next turn from the current state and appends it to the history before
  // sending the whole thing: the backend is stateless and re-reads the story every time.
  private sendTurn(text: string, clearPrompt: boolean): void {
    if (this.controlsDisabled()) return;

    const sanitizedText = sanitizeText(text);

    if (!sanitizedText) {
      this.error.set('Écrivez une action avant de l’envoyer.');
      return;
    }

    const currentStats: Stat[] = Array.from(this.stats().entries()).map(([name, value]) => ({
      name,
      value,
    }));
    const currentAmbiance = this.ambiance();

    const lastApiResponse = this.turns().at(-1);

    const newTurn: Turn = {
      text: sanitizedText,
      stats: currentStats,
      ambiance: currentAmbiance,
      objects: this.objectsEntries(),
      answer: '',
      newstats: null,
      newAmbiance: null,
      newObjects: null,
      diceRolls: null,
      // The GM's free-form memory and the story status are carried forward from the
      // previous turn's `new*` fields: the front never interprets them, only relays them
      extra: lastApiResponse?.turns.at(-1)?.newExtra ?? null,
      newExtra: null,
      story: lastApiResponse?.turns.at(-1)?.story ?? null,
      precognition: null,
    };

    const payload: AnswerPayload = {
      turns: lastApiResponse ? [...lastApiResponse.turns, newTurn] : [newTurn],
    };

    this.error.set(null);
    this.loading.set(true);
    this.halfturns.update((prev) => [...prev, payload]);

    this.api
      .post<AnswerPayload>('/answer', payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.conversation.set(data);
          this.turns.update((prev) => [...prev, data]);
          this.updateStats(data);
          if (clearPrompt) {
            this.prompt.set('');
            const accountId = this.auth.accountId();
            if (accountId !== null) {
              this.gameState.saveDraft(accountId, '');
            }
          }

          // Past the turn limit the adventure ends and persistence is handled by
          // triggerAdventureOver, which only keeps the carry-over
          if (this.turns().length >= MAX_TURNS) {
            this.triggerAdventureOver();
          } else {
            this.persistGameState();
          }
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Impossible d’envoyer l’action au Maître du Jeu.');
        },
      });
  }

  protected updatePrompt(value: string): void {
    this.prompt.set(value);
    const accountId = this.auth.accountId();
    if (accountId !== null) {
      this.gameState.saveDraft(accountId, value);
    }
    if (this.error()) {
      this.error.set(null);
    }
  }

  protected toggleHistory(): void {
    this.historyCollapsed.update((v) => !v);
  }

  // Full restart: a new character and an empty story, save included
  protected randomizeStats(): void {
    this.stats.set(buildRandomStats());
    this.objects.set(new Map());
    this.ambiance.set(DEFAULT_AMBIANCE);
    this.turns.set([]);
    this.halfturns.set([]);
    this.conversation.set(null);
    this.error.set(null);
    this.applyStatRelics();
    this.clearGameState();
  }

  // Debug panel entry points: force a state without going through the backend
  protected overrideAmbiance(ambiance: Ambiance): void {
    this.ambiance.set(ambiance);
  }

  protected overrideStats(stats: Stat[]): void {
    this.stats.set(new Map(stats.map((stat) => [stat.name, stat.value])));
    this.applyStatRelics();
  }

  protected previewAdventureOver(): void {
    if (this.adventureOver()) return;
    this.adventureOver.set(true);
    if (this.adventureOverTimer !== null) {
      clearTimeout(this.adventureOverTimer);
    }
    this.adventureOverTimer = setTimeout(() => {
      this.adventureOver.set(false);
      this.adventureOverTimer = null;
    }, ADVENTURE_OVER_DELAY_MS);
  }

  private triggerAdventureOver(): void {
    this.adventureOver.set(true);
    // The character (stats/objects/ambiance) carries over to the next adventure;
    // persist that carry-over so a reload matches the in-session behavior
    this.persistCarryOverState();

    if (this.adventureOverTimer !== null) {
      clearTimeout(this.adventureOverTimer);
    }

    this.adventureOverTimer = setTimeout(() => {
      this.turns.set([]);
      this.halfturns.set([]);
      this.conversation.set(null);
      this.adventureOver.set(false);
      this.adventureOverTimer = null;
    }, ADVENTURE_OVER_DELAY_MS);
  }

  private restoreGameState(): void {
    const accountId = this.auth.accountId();
    if (accountId === null) return;

    const draft = this.gameState.loadDraft(accountId);
    if (draft !== null) {
      this.prompt.set(draft);
    }

    const saved = this.gameState.load(accountId);
    if (!saved) return;

    this.turns.set(saved.turns);
    this.halfturns.set(saved.halfturns);
    this.conversation.set(saved.conversation);
    this.stats.set(new Map(saved.stats));
    this.objects.set(new Map(saved.objects));
    this.ambiance.set(saved.ambiance);
  }

  private persistGameState(): void {
    const accountId = this.auth.accountId();
    if (accountId === null) return;

    this.gameState.save(accountId, {
      turns: this.turns(),
      // halfturns is debug-only data and doubles the snapshot size — not persisted
      halfturns: [],
      conversation: this.conversation(),
      stats: Array.from(this.stats().entries()),
      objects: Array.from(this.objects().entries()),
      ambiance: this.ambiance(),
    });
  }

  // Snapshot with no story: only what survives into the next adventure
  private persistCarryOverState(): void {
    const accountId = this.auth.accountId();
    if (accountId === null) return;

    this.gameState.save(accountId, {
      turns: [],
      halfturns: [],
      conversation: null,
      stats: Array.from(this.stats().entries()),
      objects: Array.from(this.objects().entries()),
      ambiance: this.ambiance(),
    });
  }

  private clearGameState(): void {
    const accountId = this.auth.accountId();
    if (accountId !== null) {
      this.gameState.clear(accountId);
    }
  }

  // Applies the last turn's `new*` fields. Each is optional: a field the GM left out means
  // "unchanged", never "reset".
  private updateStats(data: AnswerPayload): void {
    const latestTurn = data.turns.at(-1);
    if (!latestTurn) return;

    // Merged into the existing map rather than replacing it, and truncated because the
    // model sometimes answers with a decimal
    const updated = new Map(this.stats());
    for (const stat of latestTurn.newstats ?? []) {
      updated.set(stat.name, Math.trunc(Number(stat.value)));
    }
    this.stats.set(updated);
    if (latestTurn.newAmbiance) {
      this.ambiance.set(latestTurn.newAmbiance);
    }
    if (latestTurn.newObjects) {
      this.objects.set(
        new Map(latestTurn.newObjects.map((object) => [object.name, object.description])),
      );
    }
    this.applyStatRelics();
  }

  private applyStatRelics(): void {
    const value = this.stats().get('INT') ?? 0;
    const relics = STAT_RELICS['INT'];
    const updated = new Map(this.objects());
    let changed = reconcileRelic(updated, relics.high, isHighStat(value));
    changed = reconcileRelic(updated, relics.low, isLowStat(value)) || changed;

    if (changed) {
      this.objects.set(updated);
    }
  }
}

function reconcileRelic(objects: Map<string, string>, relic: StatRelic, wanted: boolean): boolean {
  if (wanted && !objects.has(relic.name)) {
    const pick = Math.floor(Math.random() * relic.descriptions.length);
    objects.set(relic.name, relic.descriptions[pick]);
    return true;
  }
  if (!wanted && objects.has(relic.name)) {
    objects.delete(relic.name);
    return true;
  }
  return false;
}

// Starting roll. Some stats have their own floor (Health in particular) so a character
// cannot open the adventure already doomed.
function buildRandomStats(): Map<string, number> {
  return new Map(
    STAT_NAMES.map((name): [string, number] => {
      const min = STAT_ROLL.minimums[name] ?? STAT_ROLL.min;
      return [name, min + Math.floor(Math.random() * (STAT_ROLL.max - min + 1))];
    }),
  );
}

// Normalizes the player's text before it reaches the prompt: strips angle brackets and
// control characters, collapses whitespace. This is prompt hygiene, not XSS protection —
// Angular already escapes anything it renders.
function sanitizeText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
