import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { Stat, Turn, AnswerPayload, extractStatsFromAnswer } from '../models/turn.model';
import { NavbarComponent } from './navbar/navbar.component';
import { StatsPanelComponent } from './stats-panel/stats-panel.component';
import { ChatInputComponent } from './chat-input/chat-input.component';
import { TurnCardComponent } from './turn-card/turn-card.component';
import { AdventureOverOverlayComponent } from './adventure-over-overlay/adventure-over-overlay.component';
import { DebugHistoryComponent } from './debug-history/debug-history.component';

const STAT_NAMES = ['Health', 'Mana', 'STR', 'AGI', 'INT', 'Gold'] as const;
const MAX_TURNS = 20;
const ADVENTURE_OVER_DELAY_MS = 4_000;

@Component({
  selector: 'app-home',
  imports: [
    NavbarComponent,
    StatsPanelComponent,
    ChatInputComponent,
    TurnCardComponent,
    AdventureOverOverlayComponent,
    DebugHistoryComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly prompt = signal('');
  protected readonly conversation = signal<AnswerPayload | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly halfturns = signal<AnswerPayload[]>([]);
  protected readonly turns = signal<AnswerPayload[]>([]);
  protected readonly stats = signal<Map<string, number>>(buildRandomStats());
  protected readonly adventureOver = signal(false);

  protected readonly statsEntries = computed(() =>
    Array.from(this.stats().entries()).map(([name, value]) => ({ name, value })),
  );

  protected readonly reversedTurns = computed(() => [...(this.conversation()?.turns ?? [])].reverse());

  protected readonly controlsDisabled = computed(() => this.loading() || this.adventureOver());

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
      this.error.set('Please enter a message before sending.');
      return;
    }

    const currentStats: Stat[] = Array.from(this.stats().entries()).map(
      ([name, value]) => ({ name, value }),
    );

    const newTurn: Turn = {
      text: sanitizedText,
      stats: currentStats,
      answer: '',
      newstats: currentStats,
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
          const processed = processPayload(data);
          this.conversation.set(processed);
          this.turns.update((prev) => [...prev, processed]);
          this.updateStats(processed);
          this.prompt.set('');

          if (this.turns().length > MAX_TURNS) {
            this.triggerAdventureOver();
          }
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to send the message to /answer');
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
    this.turns.set([]);
    this.halfturns.set([]);
    this.conversation.set(null);
    this.error.set(null);
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
    for (const stat of latestTurn.newstats) {
      updated.set(stat.name, Math.trunc(Number(stat.value)));
    }
    this.stats.set(updated);
  }
}

function processPayload(payload: AnswerPayload): AnswerPayload {
  return {
    ...payload,
    turns: payload.turns.map(turn => {
      const { stats, cleanAnswer } = extractStatsFromAnswer(turn.answer);
      return {
        ...turn,
        answer: cleanAnswer,
        newstats: stats ?? turn.newstats,
      };
    }),
  };
}

function buildRandomStats(): Map<string, number> {
  return new Map(STAT_NAMES.map((name) => [name, Math.floor(Math.random() * 11)]));
}

function sanitizeText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
