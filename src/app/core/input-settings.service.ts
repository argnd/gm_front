import { Injectable, signal } from '@angular/core';

// How the Enter key behaves in the console: a line break, or a send. It lives here rather
// than in the chat input so the navbar switch and the field read the same state without
// the home having to relay it, and it is remembered across sessions — a typing habit that
// would be tedious to set again on every reload.
const ENTER_SENDS_KEY = 'gm_enter_sends';

@Injectable({ providedIn: 'root' })
export class InputSettingsService {
  readonly enterSends = signal(this.restore());

  setEnterSends(value: boolean): void {
    this.enterSends.set(value);
    try {
      localStorage.setItem(ENTER_SENDS_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  // Anything other than the stored "on" reads as off, so a corrupt or absent value
  // degrades to the line break the field has always done
  private restore(): boolean {
    try {
      return localStorage.getItem(ENTER_SENDS_KEY) === '1';
    } catch {
      return false;
    }
  }
}
