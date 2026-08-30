import { Injectable, computed, signal } from '@angular/core';
import { SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { GameStateService } from './game-state.service';

// Session authority for the whole app. The session is deliberately short and never
// renewed: it lives as long as the Google ID token behind it, then the user signs in
// again. Nothing is lost in the meantime — the game save is client-side and survives.

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1h, the lifetime of the Google ID token
const SESSION_KEY = 'gm_session'; // localStorage, and the cross-tab sync channel

interface StoredSession {
  user: SocialUser;
  loginTime: number;
}

interface GoogleIdApi {
  cancel: () => void;
  disableAutoSelect: () => void;
}

// The raw GIS global, reached directly where the wrapper library is not enough.
// Null until the async Google script has loaded.
function googleIdApi(): GoogleIdApi | null {
  const google = (globalThis as { google?: { accounts?: { id?: GoogleIdApi } } }).google;
  return google?.accounts?.id ?? null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<SocialUser | null>(null);
  readonly isLoggedIn = signal(false);
  readonly accountId = computed(() => this.user()?.id ?? null);

  private loginTime = 0;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private socialAuth: SocialAuthService,
    private router: Router,
    private gameState: GameStateService,
  ) {
    // Restore session synchronously before the guard ever runs
    this.restoreSession();

    this.socialAuth.authState.subscribe((user) => {
      if (!user?.idToken) return;

      // A different account is a different game save entirely, so it gets its own path
      const current = this.user();
      if (current !== null && this.isLoggedIn() && current.id !== user.id) {
        this.switchAccount(user);
      } else {
        this.completeLogin(user);
      }
    });

    // Keeps every open tab on the same session: login and sign-out propagate
    window.addEventListener('storage', (event) => this.onStorageEvent(event));
  }

  getIdToken(): string | null {
    return this.user()?.idToken ?? null;
  }

  // Deliberate sign-out: also wipes the local save, unlike a lapse
  signOut(): void {
    const accountId = this.accountId();
    if (accountId !== null) {
      this.gameState.clear(accountId);
    }
    this.endSession(true);
  }

  // Session ended without the user asking (the hour elapsed, or the backend rejected the
  // token): the save is kept so signing back in resumes the game
  sessionLapsed(): void {
    this.endSession(false);
  }

  private completeLogin(user: SocialUser): void {
    this.user.set(user);
    this.isLoggedIn.set(true);
    this.loginTime = Date.now();
    this.persistSession();
    this.armExpiryTimer();
    this.leaveLoginPage();
  }

  private leaveLoginPage(): void {
    if (this.router.url.startsWith('/login')) {
      this.router.navigate(['/home']);
    }
  }

  private switchAccount(user: SocialUser): void {
    const session: StoredSession = { user, loginTime: Date.now() };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
    // Full reload: simplest way to rebind every per-account state to the new account
    window.location.reload();
  }

  private endSession(manual: boolean): void {
    this.clearExpiryTimer();
    localStorage.removeItem(SESSION_KEY);
    this.loginTime = 0;
    this.user.set(null);
    this.isLoggedIn.set(false);
    googleIdApi()?.cancel();
    if (manual) {
      // Direct GIS call: the lib's signOut rejects when no credential arrived this page-load,
      // and disableAutoSelect must run so a deliberate sign-out is not undone by auto sign-in
      googleIdApi()?.disableAutoSelect();
      this.socialAuth.signOut().catch(() => {});
    }
    this.router.navigate(['/login']);
  }

  // Fires only in the *other* tabs, never in the one that wrote the key
  private onStorageEvent(event: StorageEvent): void {
    if (event.key !== SESSION_KEY) return;

    // Key removed elsewhere = sign-out or lapse: follow it, but without re-running the GIS
    // teardown, which the originating tab already did
    if (event.newValue === null) {
      if (this.isLoggedIn()) {
        this.clearExpiryTimer();
        this.loginTime = 0;
        this.user.set(null);
        this.isLoggedIn.set(false);
        this.router.navigate(['/login']);
      }
      return;
    }

    try {
      const session: StoredSession = JSON.parse(event.newValue);
      if (!this.isLoggedIn() || session.user.id === this.accountId()) {
        this.loginTime = session.loginTime;
        this.user.set(session.user);
        this.isLoggedIn.set(true);
        this.armExpiryTimer();
        this.leaveLoginPage();
      } else {
        // Another account took over in a sibling tab: reload rather than hot-swap state
        window.location.reload();
      }
    } catch {
      /* ignore */
    }
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const session: StoredSession = JSON.parse(raw);

      if (Date.now() - session.loginTime < SESSION_DURATION_MS) {
        this.loginTime = session.loginTime;
        this.user.set(session.user);
        this.isLoggedIn.set(true);
        this.armExpiryTimer();
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private persistSession(): void {
    const user = this.user();
    if (user === null) return;

    const session: StoredSession = { user, loginTime: this.loginTime };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }

  private armExpiryTimer(): void {
    this.clearExpiryTimer();
    const delay = Math.max(this.loginTime + SESSION_DURATION_MS - Date.now(), 0);
    this.expiryTimer = setTimeout(() => this.sessionLapsed(), delay);
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
