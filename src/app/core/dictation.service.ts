import { Injectable, signal } from '@angular/core';

// Dictation through the browser's own recognition engine. Nothing is uploaded by the app
// itself; what the engine does with the audio is the browser's business (Chrome sends it
// to a Google service, which is why Firefox, having no engine, simply gets no button).
const LANG = 'fr-FR';

// Reported only when the player can act on it. `no-speech` and `aborted` fire routinely
// during a normal dictation — a pause, a stop — and saying so would be noise.
const MESSAGES: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorisez l’accès dans le navigateur.',
  'service-not-allowed': 'Micro refusé : autorisez l’accès dans le navigateur.',
  'audio-capture': 'Aucun micro détecté.',
  network: 'Service de reconnaissance injoignable.',
};

// The Web Speech API is not in TypeScript's DOM library: what the service uses of it is
// declared here rather than pulling a package in for four interfaces.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

// Read at every call rather than captured once: nothing guarantees the global is the same
// object later, and a stale reference would outlive the engine it points at
function engine(): SpeechRecognitionConstructor | null {
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

@Injectable({ providedIn: 'root' })
export class DictationService {
  readonly available = signal(engine() !== null);
  readonly listening = signal(false);
  // Everything heard since the last start(), the chunk still being revised included. The
  // engine rewrites its own tail until it settles, so the whole text is rebuilt on every
  // event instead of being appended to.
  readonly spokenText = signal('');
  readonly error = signal<string | null>(null);

  private recognition: SpeechRecognition | null = null;
  // The part the engine has committed to; the rest of spokenText is still provisional
  private settled = '';

  toggle(): void {
    if (this.listening()) {
      this.stop();
    } else {
      this.start();
    }
  }

  start(): void {
    if (this.listening()) return;

    const Engine = engine();
    if (Engine === null) {
      this.available.set(false);
      return;
    }

    const recognition = new Engine();
    recognition.lang = LANG;
    // Keeps the microphone open across pauses: a player thinking mid-sentence should not
    // have to click again
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    this.settled = '';
    this.spokenText.set('');
    this.error.set(null);

    recognition.onresult = (event) => {
      let pending = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) {
          this.settled = join(this.settled, result[0].transcript);
        } else {
          pending = join(pending, result[0].transcript);
        }
      }
      this.spokenText.set(join(this.settled, pending));
    };

    recognition.onerror = (event) => {
      const message = MESSAGES[event.error];
      if (message) {
        this.error.set(message);
      }
    };

    recognition.onend = () => {
      this.listening.set(false);
      this.recognition = null;
    };

    this.recognition = recognition;
    this.listening.set(true);
    try {
      recognition.start();
    } catch {
      // Thrown when an engine is already running, which only happens if a previous session
      // never delivered its onend
      this.listening.set(false);
      this.recognition = null;
    }
  }

  stop(): void {
    if (!this.listening()) return;
    // Set here rather than waiting for onend: the button has to answer the click at once
    this.listening.set(false);
    this.recognition?.stop();
    this.recognition = null;
  }
}

// Chunks come with inconsistent leading and trailing spaces depending on the engine, so
// they are normalised to exactly one space between them
function join(left: string, right: string): string {
  const start = left.trim();
  const end = right.trim();
  if (!start) return end;
  if (!end) return start;
  return `${start} ${end}`;
}
