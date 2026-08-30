import { computed, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';

// Reads a GM answer aloud, either through the Web Speech API or, when the superior voice is
// on, through the backend narration (POST /speech). Only one utterance chain plays at a
// time; `speakingId` is the id of the turn card currently speaking, or null.
const CHUNK_MAX_LENGTH = 220; // most engines truncate or stall on very long utterances
const RATE_MIN = 0.5;
const RATE_MAX = 2;
// Synthesized answers are kept around so that re-listening to a turn does not spend tokens
// a second time. Each one weighs a couple of megabytes, hence the very small ceiling.
const CACHE_MAX = 6;

export type SpeechVoice = {
  name: string;
  lang: string;
};

export type PremiumVoice = {
  name: string;
  label: string;
};

// Gemini prebuilt voices, hand-picked among those that suit a narrator. The names are fixed
// by the model, not by us: a voice retired upstream would start failing here.
export const PREMIUM_VOICES: readonly PremiumVoice[] = [
  { name: 'Kore', label: 'Kore — ferme' },
  { name: 'Charon', label: 'Charon — posée' },
  { name: 'Sulafat', label: 'Sulafat — chaleureuse' },
  { name: 'Gacrux', label: 'Gacrux — mûre' },
  { name: 'Algieba', label: 'Algieba — douce' },
  { name: 'Enceladus', label: 'Enceladus — soufflée' },
  { name: 'Algenib', label: 'Algenib — rocailleuse' },
  { name: 'Achernar', label: 'Achernar — feutrée' },
  { name: 'Puck', label: 'Puck — enjouée' },
  { name: 'Fenrir', label: 'Fenrir — exaltée' },
];

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private readonly api = inject(ApiService);

  readonly speakingId = signal<string | null>(null);
  // Set while the backend synthesizes: unlike the local engine, the superior voice takes
  // several seconds before the first sound comes out
  readonly loadingId = signal<string | null>(null);
  readonly localAvailable = signal(false);
  readonly voices = signal<readonly SpeechVoice[]>([]);
  readonly voiceName = signal<string | null>(null);
  readonly rate = signal(1);

  readonly premium = signal(false);
  readonly premiumVoices = PREMIUM_VOICES;
  readonly premiumVoice = signal(PREMIUM_VOICES[0].name);

  // The superior voice needs nothing from the machine, so it makes reading available even
  // where no local French voice is installed
  readonly available = computed(() => this.premium() || this.localAvailable());

  private localVoices: SpeechSynthesisVoice[] = [];
  // Bumped on every stop(): callbacks from a cancelled chain compare against it and
  // no-op, so a stale onend cannot clear the id of a newly started reading
  private generation = 0;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private request: Subscription | null = null;
  private readonly cache = new Map<string, Blob>();

  constructor() {
    if (!('speechSynthesis' in window)) return;
    this.refreshVoices();
    // Voices arrive asynchronously and can change while the app runs (OS voice installed)
    window.speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
  }

  toggle(id: string, text: string): void {
    if (this.speakingId() === id || this.loadingId() === id) {
      this.stop();
    } else {
      this.speak(id, text);
    }
  }

  stopIf(id: string): void {
    if (this.speakingId() === id || this.loadingId() === id) {
      this.stop();
    }
  }

  stop(): void {
    this.generation++;
    this.speakingId.set(null);
    this.loadingId.set(null);
    this.request?.unsubscribe();
    this.request = null;
    this.releaseAudio();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  setVoice(name: string): void {
    if (this.localVoices.some((voice) => voice.name === name)) {
      this.voiceName.set(name);
    }
  }

  setPremium(value: boolean): void {
    if (this.premium() === value) return;
    // The two engines have nothing in common: a reading under way cannot be handed over
    this.stop();
    this.premium.set(value);
  }

  setPremiumVoice(name: string): void {
    if (PREMIUM_VOICES.some((voice) => voice.name === name)) {
      this.premiumVoice.set(name);
    }
  }

  setRate(value: number): void {
    if (!Number.isFinite(value)) return;
    const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, value));
    this.rate.set(rate);
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
  }

  private speak(id: string, text: string): void {
    this.stop();
    if (this.premium()) {
      this.speakPremium(id, text);
    } else {
      this.speakLocal(id, text);
    }
  }

  // Asks the backend for the narration, then plays what it returns. A failure — quota,
  // network, backend without the endpoint — falls back to the local engine rather than
  // leaving the reader with nothing.
  private speakPremium(id: string, text: string): void {
    const voice = this.premiumVoice();
    const key = `${voice}|${text}`;
    const generation = this.generation;

    const cached = this.cache.get(key);
    if (cached) {
      this.play(id, cached, generation);
      return;
    }

    this.loadingId.set(id);
    this.request = this.api
      .postBlob(`/speech?voice=${encodeURIComponent(voice)}`, { text })
      .subscribe({
        next: (blob) => {
          if (this.generation !== generation) return;
          this.remember(key, blob);
          this.loadingId.set(null);
          this.play(id, blob, generation);
        },
        error: (error) => {
          if (this.generation !== generation) return;
          console.warn('[SpeechService] Superior narration failed, falling back', error);
          this.loadingId.set(null);
          this.speakLocal(id, text);
        },
      });
  }

  private speakLocal(id: string, text: string): void {
    const voice = this.currentVoice();
    if (voice === null) return;

    const chunks = splitText(text);
    if (!chunks.length) return;

    const generation = this.generation;
    const rate = this.rate();
    const settle = () => {
      if (this.generation === generation) {
        this.speakingId.set(null);
      }
    };

    // Chunks are queued in one go: the engine plays them back to back, and only the last
    // one clears the speaking state
    this.speakingId.set(id);
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      utterance.onerror = settle;
      if (index === chunks.length - 1) {
        utterance.onend = settle;
      }
      window.speechSynthesis.speak(utterance);
    });
  }

  private play(id: string, blob: Blob, generation: number): void {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.playbackRate = this.rate();

    const settle = () => {
      if (this.generation !== generation) return;
      this.releaseAudio();
      this.speakingId.set(null);
    };
    audio.onended = settle;
    audio.onerror = settle;

    this.audio = audio;
    this.audioUrl = url;
    this.speakingId.set(id);
    audio.play().catch(settle);
  }

  private releaseAudio(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }

  // Plain insertion-order eviction: the oldest narration goes first, which in a game read
  // in order is also the one least likely to be played again
  private remember(key: string, blob: Blob): void {
    this.cache.set(key, blob);
    while (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  private currentVoice(): SpeechSynthesisVoice | null {
    return this.localVoices.find((voice) => voice.name === this.voiceName()) ?? null;
  }

  private refreshVoices(): void {
    const voices = window.speechSynthesis.getVoices();
    // French only (the game is written in French) and local only: remote voices send the
    // narration to a cloud service and stutter on long texts
    this.localVoices = voices.filter(
      (voice) => voice.localService && voice.lang.toLowerCase().startsWith('fr'),
    );
    this.voices.set(this.localVoices.map((voice) => ({ name: voice.name, lang: voice.lang })));
    if (!this.localVoices.some((voice) => voice.name === this.voiceName())) {
      const fallback = this.localVoices.find((voice) => voice.default) ?? this.localVoices[0];
      this.voiceName.set(fallback?.name ?? null);
    }
    this.localAvailable.set(this.localVoices.length > 0);
    // Losing the local voices only interrupts a local reading: the superior one does not
    // depend on them
    if (!this.localVoices.length && !this.premium() && this.speakingId() !== null) {
      this.stop();
    }
  }
}

// Splits on sentence boundaries first so the prosody stays natural, and only falls back to
// a blind cut for a sentence longer than the chunk limit
function splitText(text: string): string[] {
  const sentences = text.match(/[^.!?…\n]+[.!?…]*\s*/g) ?? [];
  const chunks: string[] = [];
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (trimmed.length <= CHUNK_MAX_LENGTH) {
      chunks.push(trimmed);
      continue;
    }
    for (let index = 0; index < trimmed.length; index += CHUNK_MAX_LENGTH) {
      chunks.push(trimmed.slice(index, index + CHUNK_MAX_LENGTH));
    }
  }
  return chunks;
}
