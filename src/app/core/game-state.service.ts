import { Injectable } from '@angular/core';
import { Ambiance, AnswerPayload } from '../models/turn.model';

const GAME_KEY_PREFIX = 'gm_game_';
const DRAFT_KEY_PREFIX = 'gm_draft_';

export interface StoredGameState {
  turns: AnswerPayload[];
  halfturns: AnswerPayload[];
  conversation: AnswerPayload | null;
  stats: [string, number][];
  objects: [string, string][];
  ambiance: Ambiance;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  save(accountId: string, state: StoredGameState): void {
    try {
      localStorage.setItem(GAME_KEY_PREFIX + accountId, JSON.stringify(state));
    } catch {
      // Storage full or unavailable: the previous snapshot stays as the restore point
      console.warn('[GameState] Save failed (storage full?) — previous snapshot kept.');
    }
  }

  load(accountId: string): StoredGameState | null {
    const key = GAME_KEY_PREFIX + accountId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      const state = JSON.parse(raw) as StoredGameState;
      const valid =
        Array.isArray(state.turns) &&
        Array.isArray(state.halfturns) &&
        Array.isArray(state.stats) &&
        Array.isArray(state.objects) &&
        typeof state.ambiance === 'object' &&
        state.ambiance !== null;
      if (!valid) {
        // A corrupt snapshot must degrade to a fresh game, not brick /home on every load
        localStorage.removeItem(key);
        return null;
      }
      return state;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  clear(accountId: string): void {
    localStorage.removeItem(GAME_KEY_PREFIX + accountId);
    localStorage.removeItem(DRAFT_KEY_PREFIX + accountId);
  }

  saveDraft(accountId: string, draft: string): void {
    try {
      if (draft) {
        localStorage.setItem(DRAFT_KEY_PREFIX + accountId, draft);
      } else {
        localStorage.removeItem(DRAFT_KEY_PREFIX + accountId);
      }
    } catch {
      /* ignore */
    }
  }

  loadDraft(accountId: string): string | null {
    return localStorage.getItem(DRAFT_KEY_PREFIX + accountId);
  }
}
