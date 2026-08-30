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
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
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
  // Everything heard since the last start(), the chunk still being revised included
  readonly spokenText = signal('');
  readonly error = signal<string | null>(null);

  private recognition: SpeechRecognition | null = null;

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

    this.spokenText.set('');
    this.error.set(null);

    recognition.onresult = (event) => {
      // Rebuilt from the whole list on every event rather than appended to. The engine
      // re-sends results it has already delivered — often the entire session, with
      // resultIndex back at zero — so appending would repeat them, and repeat the
      // repetitions on the next event.
      //
      // The list itself can also carry the same utterance twice, which mobile engines do
      // and desktop ones do not: once as a provisional result and once as its own final,
      // or the same final twice after the engine has restarted itself (Android ignores
      // `continuous`). Consecutive entries saying the same thing are therefore folded into
      // one, keeping the longer — a provisional result is a prefix of the final it becomes.
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const transcript = event.results[index][0].transcript.trim();
        if (!transcript) {
          continue;
        }
        const previous = parts.at(-1);
        if (previous !== undefined && sameUtterance(previous, transcript)) {
          if (transcript.length > previous.length) {
            parts[parts.length - 1] = transcript;
          }
          continue;
        }
        parts.push(transcript);
      }
      this.spokenText.set(parts.join(' '));
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

// Two neighbouring results are the same utterance when one is the beginning of the other:
// that covers a provisional result sitting next to its own final, which adds capitalisation
// and punctuation but no words. The cost of the rule is that a player genuinely repeating
// themselves — "non, non" said as two separate results — is heard once.
function sameUtterance(left: string, right: string): boolean {
  const start = comparable(left);
  const end = comparable(right);
  if (!start || !end) return false;
  return start.startsWith(end) || end.startsWith(start);
}

// Case, spacing and trailing punctuation are exactly what differs between a provisional
// result and the final it becomes, so none of them may weigh in the comparison
function comparable(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?…]+$/g, '')
    .trim();
}
