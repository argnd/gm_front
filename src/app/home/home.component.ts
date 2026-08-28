import { Component, OnDestroy, Type, computed, effect, inject, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import {
  AMBIANCE_DECOR,
  AmbianceDecorData,
  AmbianceDecorSlot,
} from './decor/ambiance-decor';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { Stat, Ambiance, DEFAULT_AMBIANCE, Turn, AnswerPayload } from '../models/turn.model';
import {
  ACTION_COPY,
  MAX_TURNS,
  STAT_NAMES,
  STAT_ROLL,
  ambianceClasses,
  ambianceVars,
  dominantKey,
  highStats,
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
import { AdventureOverOverlayComponent } from './adventure-over-overlay/adventure-over-overlay.component';

const ADVENTURE_OVER_DELAY_MS = 4_000;

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
    AdventureOverOverlayComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly maxTurns = MAX_TURNS;

  protected readonly prompt = signal('');
  protected readonly conversation = signal<AnswerPayload | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly halfturns = signal<AnswerPayload[]>([]);
  protected readonly turns = signal<AnswerPayload[]>([]);
  protected readonly stats = signal<Map<string, number>>(buildRandomStats());
  protected readonly objects = signal<Map<string, string>>(new Map());
  protected readonly ambiance = signal<Ambiance>(DEFAULT_AMBIANCE);
  protected readonly adventureOver = signal(false);
  protected readonly debugSurfaceOpacity = signal(100);
  protected readonly debugBorderOpacity = signal(100);
  protected readonly debugShadowOpacity = signal(100);
  protected readonly debugFieldDim = signal(25);
  protected readonly debugFieldFeather = signal(40);

  protected readonly statsEntries = computed(() =>
    Array.from(this.stats().entries()).map(([name, value]) => ({ name, value })),
  );

  protected readonly objectsEntries = computed(() =>
    Array.from(this.objects().entries()).map(([name, description]) => ({ name, description })),
  );

  protected readonly rollEntries = computed(() => {
    const last = this.turns().at(-1);
    if (!last) return [];
    return last.turns
      .flatMap((turn, index) => (turn.diceRolls ?? []).map((roll) => ({ roll, turn: index + 1 })))
      .reverse();
  });

  protected readonly reversedTurns = computed(() =>
    [...(this.conversation()?.turns ?? [])].reverse(),
  );

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

  protected readonly decorComponent = signal<Type<unknown> | null>(null);

  protected readonly decorData = computed<AmbianceDecorData>(() => ({
    ambiance: this.ambiance(),
    stats: this.statsEntries(),
  }));

  constructor() {
    effect(() => {
      const state = this.ambianceState();
      const loader = AMBIANCE_DECOR[state];
      if (!loader) {
        this.decorComponent.set(null);
        return;
      }
      loader().then((component) => {
        if (this.ambianceState() === state) {
          this.decorComponent.set(component);
        }
      });
    });
  }

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
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
  }

  protected submitTurn(): void {
    if (this.controlsDisabled()) return;

    const sanitizedText = sanitizeText(this.prompt());

    if (!sanitizedText) {
      this.error.set('Écrivez une action avant de l’envoyer.');
      return;
    }

    const currentStats: Stat[] = Array.from(this.stats().entries()).map(([name, value]) => ({
      name,
      value,
    }));
    const currentAmbiance = this.ambiance();

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
      extra: null,
    };

    const lastApiResponse = this.turns().at(-1);
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
          this.prompt.set('');

          if (this.turns().length > MAX_TURNS) {
            this.triggerAdventureOver();
          }
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Impossible d’envoyer l’action au Maître du Jeu.');
        },
      });
  }

  protected updatePrompt(value: string): void {
    this.prompt.set(value);
    if (this.error()) {
      this.error.set(null);
    }
  }

  protected randomizeStats(): void {
    this.stats.set(buildRandomStats());
    this.objects.set(new Map());
    this.ambiance.set(DEFAULT_AMBIANCE);
    this.turns.set([]);
    this.halfturns.set([]);
    this.conversation.set(null);
    this.error.set(null);
  }

  protected overrideAmbiance(ambiance: Ambiance): void {
    this.ambiance.set(ambiance);
  }

  protected overrideStats(stats: Stat[]): void {
    this.stats.set(new Map(stats.map((stat) => [stat.name, stat.value])));
  }

  private triggerAdventureOver(): void {
    this.adventureOver.set(true);

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

  private updateStats(data: AnswerPayload): void {
    const latestTurn = data.turns.at(-1);
    if (!latestTurn) return;

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
  }
}

function buildRandomStats(): Map<string, number> {
  return new Map(
    STAT_NAMES.map((name): [string, number] => {
      const min = STAT_ROLL.minimums[name] ?? STAT_ROLL.min;
      return [name, min + Math.floor(Math.random() * (STAT_ROLL.max - min + 1))];
    }),
  );
}

function sanitizeText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
