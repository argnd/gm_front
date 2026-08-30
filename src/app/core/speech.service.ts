import { Injectable, signal } from '@angular/core';

// Reads a GM answer aloud through the Web Speech API. Only one utterance chain plays at a
// time; `speakingId` is the id of the turn card currently speaking, or null.
const CHUNK_MAX_LENGTH = 220; // most engines truncate or stall on very long utterances
const RATE_MIN = 0.5;
const RATE_MAX = 2;

export type SpeechVoice = {
  name: string;
  lang: string;
};

@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly speakingId = signal<string | null>(null);
  readonly available = signal(false);
  readonly voices = signal<readonly SpeechVoice[]>([]);
  readonly voiceName = signal<string | null>(null);
  readonly rate = signal(1);

  private localVoices: SpeechSynthesisVoice[] = [];
  // Bumped on every stop(): callbacks from a cancelled chain compare against it and
  // no-op, so a stale onend cannot clear the id of a newly started reading
  private generation = 0;

  constructor() {
    if (!('speechSynthesis' in window)) return;
    this.refreshVoices();
    // Voices arrive asynchronously and can change while the app runs (OS voice installed)
    window.speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices());
  }

  toggle(id: string, text: string): void {
    if (this.speakingId() === id) {
      this.stop();
    } else {
      this.speak(id, text);
    }
  }

  stopIf(id: string): void {
    if (this.speakingId() === id) {
      this.stop();
    }
  }

  stop(): void {
    this.generation++;
    this.speakingId.set(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  setVoice(name: string): void {
    if (this.localVoices.some((voice) => voice.name === name)) {
      this.voiceName.set(name);
    }
  }

  setRate(value: number): void {
    if (!Number.isFinite(value)) return;
    this.rate.set(Math.min(RATE_MAX, Math.max(RATE_MIN, value)));
  }

  private speak(id: string, text: string): void {
    this.stop();
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
    this.available.set(this.localVoices.length > 0);
    if (!this.localVoices.length && this.speakingId() !== null) {
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
