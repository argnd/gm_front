import { Injectable, computed, signal } from '@angular/core';
import { SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';
import { GameStateService } from './game-state.service';

// Session authority for the whole app. Two independent lifetimes are juggled here:
// the Google ID token (short-lived, renewed silently through One Tap) and our own 24h
// session (a sliding window refreshed by user activity). A dead token never signs the
// user out — only the window lapsing, or an explicit sign-out, does.

// Kill switch: set to false to disable One Tap / auto sign-in when debugging login issues
export const SILENT_AUTH_ENABLED = true;

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h sliding window from last activity
const SESSION_KEY = 'gm_session'; // localStorage, and the cross-tab sync channel
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // renew this early so no request races expiry
const FORCED_RENEWAL_TIMEOUT_MS = 15 * 1000; // past this, a pending renewal resolves to null
const SILENT_RENEWAL_RETRY_MS = 5 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000; // cap localStorage writes on every request
const MIN_RENEWAL_DELAY_MS = 5 * 1000; // floor, so an already-expired token cannot busy-loop
const MAX_SILENT_RENEWAL_ATTEMPTS = 3;
const GIS_READY_POLL_MS = 500;

interface StoredSession {
  user: SocialUser;
  loginTime: number;
  lastActivity: number;
}

interface GoogleIdApi {
  prompt: () => void;
  cancel: () => void;
  disableAutoSelect: () => void;
}

// The raw GIS global, reached directly where the wrapper library is not enough.
// Null until the async Google script has loaded, hence the polling in promptWhenReady().
function googleIdApi(): GoogleIdApi | null {
  const google = (globalThis as { google?: { accounts?: { id?: GoogleIdApi } } }).google;
  return google?.accounts?.id ?? null;
}

// Decodes the JWT payload for its `exp` only, to schedule the renewal — this is not a
// signature check, the backend remains the one that validates the token.
function readTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<SocialUser | null>(null);
  readonly isLoggedIn = signal(false);
  readonly accountId = computed(() => this.user()?.id ?? null);

  private loginTime = 0;
  private lastActivity = 0;
  private lastSessionWrite = 0;
  private silentRenewalFailures = 0;

  private expiryTimer: ReturnType<typeof setTimeout> | null = null; // 24h window lapse
  private renewalTimer: ReturnType<typeof setTimeout> | null = null; // next silent renewal
  private renewalTimeout: ReturnType<typeof setTimeout> | null = null; // give-up on the current one
  // A single in-flight renewal shared by every caller, so a burst of 401s produces one prompt
  private pendingRenewal: Promise<string | null> | null = null;
  private resolveRenewal: ((token: string | null) => void) | null = null;

  constructor(
    private socialAuth: SocialAuthService,
    private router: Router,
    private gameState: GameStateService,
  ) {
    // Restore session synchronously before the guard ever runs
    this.restoreSession();

    // Fires on sign-in events from GIS, including silent One Tap renewals
    this.socialAuth.authState.subscribe((user) => {
      if (!user?.idToken) return;

      // Same account = a refreshed token; a different one = the user picked another
      // account in the Google chooser, which is a different game save entirely
      const current = this.user();
      if (current !== null && this.isLoggedIn()) {
        if (current.id === user.id) {
          this.applyRenewal(user);
        } else {
          this.switchAccount(user);
        }
      } else {
        this.completeLogin(user);
      }
    });

    // Keeps every open tab on the same session: login, sign-out and renewals propagate
    window.addEventListener('storage', (event) => this.onStorageEvent(event));
  }

  getIdToken(): string | null {
    return this.user()?.idToken ?? null;
  }

  touchActivity(): void {
    if (!this.isLoggedIn()) return;

    this.lastActivity = Date.now();
    if (this.lastActivity - this.lastSessionWrite >= ACTIVITY_WRITE_THROTTLE_MS) {
      this.persistSession();
    }
    this.armExpiryTimer();
  }

  // Never signs the user out by itself: a failed renewal only resolves to null
  forceRenewToken(): Promise<string | null> {
    if (!SILENT_AUTH_ENABLED || !this.isLoggedIn()) {
      return Promise.resolve(null);
    }
    if (this.pendingRenewal !== null) {
      return this.pendingRenewal;
    }

    this.pendingRenewal = new Promise<string | null>((resolve) => {
      this.resolveRenewal = resolve;
      this.renewalTimeout = setTimeout(() => this.abandonRenewal(), FORCED_RENEWAL_TIMEOUT_MS);
      this.promptWhenReady();
    }).finally(() => {
      this.pendingRenewal = null;
    });

    return this.pendingRenewal;
  }

  // The GIS script loads async: wait for it within the renewal timeout instead of failing outright
  private promptWhenReady(): void {
    if (this.resolveRenewal === null) return;

    const api = googleIdApi();
    if (api !== null) {
      api.prompt();
      return;
    }
    setTimeout(() => this.promptWhenReady(), GIS_READY_POLL_MS);
  }

  // Deliberate sign-out: also wipes the local save, unlike a lapse
  signOut(): void {
    const accountId = this.accountId();
    if (accountId !== null) {
      this.gameState.clear(accountId);
    }
    this.endSession(true);
  }

  // Session ended without the user asking (window lapsed, or renewal exhausted after a
  // 401): the save is kept so signing back in resumes the game
  sessionLapsed(): void {
    this.endSession(false);
  }

  private completeLogin(user: SocialUser): void {
    this.user.set(user);
    this.isLoggedIn.set(true);
    this.loginTime = Date.now();
    this.lastActivity = this.loginTime;
    this.silentRenewalFailures = 0;
    this.persistSession();
    this.armExpiryTimer();
    this.settleRenewal(user.idToken ?? null);
    this.scheduleSilentRenewal();
    this.leaveLoginPage();
  }

  private applyRenewal(user: SocialUser): void {
    // A renewal refreshes the token, not the 24h activity window
    this.user.set(user);
    this.silentRenewalFailures = 0;
    this.persistSession();
    this.settleRenewal(user.idToken ?? null);
    this.scheduleSilentRenewal();
    this.leaveLoginPage();
  }

  private leaveLoginPage(): void {
    if (this.router.url.startsWith('/login')) {
      this.router.navigate(['/home']);
    }
  }

  private switchAccount(user: SocialUser): void {
    const now = Date.now();
    const session: StoredSession = { user, loginTime: now, lastActivity: now };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
    // Full reload: simplest way to rebind every per-account state to the new account
    window.location.reload();
  }

  private endSession(manual: boolean): void {
    this.clearTimers();
    this.settleRenewal(null);
    localStorage.removeItem(SESSION_KEY);
    this.loginTime = 0;
    this.lastActivity = 0;
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

  // Arms the next renewal a margin before the token expires. Called after every token
  // change, so the timer always reflects the token currently held.
  private scheduleSilentRenewal(): void {
    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
    if (!SILENT_AUTH_ENABLED || !this.isLoggedIn()) return;

    const token = this.getIdToken();
    const expiry = token !== null ? readTokenExpiry(token) : null;
    const delay =
      expiry === null
        ? MIN_RENEWAL_DELAY_MS
        : Math.max(expiry - Date.now() - TOKEN_REFRESH_MARGIN_MS, MIN_RENEWAL_DELAY_MS);
    this.renewalTimer = setTimeout(() => this.attemptSilentRenewal(), delay);
  }

  private attemptSilentRenewal(): void {
    if (!this.isLoggedIn()) return;

    this.forceRenewToken().then((token) => {
      if (token !== null || !this.isLoggedIn()) return;

      // Retry a few times, then leave it to the 401 path; never sign out from here.
      // Capped because prompt() may be visible (multi-account chooser) — no endless popups.
      this.silentRenewalFailures++;
      if (this.silentRenewalFailures < MAX_SILENT_RENEWAL_ATTEMPTS) {
        this.armRenewalRetry();
      }
    });
  }

  private armRenewalRetry(): void {
    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer);
    }
    this.renewalTimer = setTimeout(() => this.attemptSilentRenewal(), SILENT_RENEWAL_RETRY_MS);
  }

  // The prompt lives in a hidden host, so one waiting on a click would hang there unseen:
  // close it before giving up, leaving GIS in a clean state for the next attempt
  private abandonRenewal(): void {
    googleIdApi()?.cancel();
    this.settleRenewal(null);
  }

  // Single exit point for a pending renewal: cancels the give-up timer and resolves the
  // shared promise exactly once, whatever the outcome
  private settleRenewal(token: string | null): void {
    if (this.renewalTimeout !== null) {
      clearTimeout(this.renewalTimeout);
      this.renewalTimeout = null;
    }
    const resolve = this.resolveRenewal;
    this.resolveRenewal = null;
    resolve?.(token);
  }

  // Fires only in the *other* tabs, never in the one that wrote the key
  private onStorageEvent(event: StorageEvent): void {
    if (event.key !== SESSION_KEY) return;

    // Key removed elsewhere = sign-out or lapse: follow it, but without re-running the GIS
    // teardown, which the originating tab already did
    if (event.newValue === null) {
      if (this.isLoggedIn()) {
        this.clearTimers();
        this.settleRenewal(null);
        this.loginTime = 0;
        this.lastActivity = 0;
        this.user.set(null);
        this.isLoggedIn.set(false);
        this.router.navigate(['/login']);
      }
      return;
    }

    try {
      const session: StoredSession = JSON.parse(event.newValue);
      if (!this.isLoggedIn() || session.user.id === this.accountId()) {
        // Login or token renewal from another tab: adopt it, but never regress to a staler token
        const incoming = session.user.idToken ?? null;
        const incomingExp = incoming !== null ? readTokenExpiry(incoming) : null;
        const currentToken = this.getIdToken();
        const currentExp = currentToken !== null ? readTokenExpiry(currentToken) : null;
        const fresher = currentExp === null || (incomingExp !== null && incomingExp >= currentExp);

        this.loginTime = session.loginTime;
        this.lastActivity = Math.max(session.lastActivity, this.lastActivity);
        if (!this.isLoggedIn() || fresher) {
          this.user.set(session.user);
          this.silentRenewalFailures = 0;
          if (incoming !== null) {
            // Unblocks a renewal pending in this tab (e.g. a 401 retry waiting on One Tap)
            this.settleRenewal(incoming);
          }
        }
        this.isLoggedIn.set(true);
        this.armExpiryTimer();
        this.scheduleSilentRenewal();
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

      if (Date.now() - session.lastActivity < SESSION_DURATION_MS) {
        this.loginTime = session.loginTime;
        this.lastActivity = Date.now(); // opening the app counts as activity
        this.user.set(session.user);
        this.isLoggedIn.set(true);
        this.persistSession();
        this.armExpiryTimer();
        this.scheduleSilentRenewal();
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

    const session: StoredSession = {
      user,
      loginTime: this.loginTime,
      lastActivity: this.lastActivity,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      this.lastSessionWrite = Date.now();
    } catch {
      /* ignore */
    }
  }

  // Re-arms rather than fires when activity moved the deadline while the timer was
  // pending: that is what makes the 24h window slide instead of being absolute
  private armExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
    }
    const delay = Math.max(this.lastActivity + SESSION_DURATION_MS - Date.now(), 0);
    this.expiryTimer = setTimeout(() => {
      if (Date.now() - this.lastActivity >= SESSION_DURATION_MS) {
        this.sessionLapsed();
      } else {
        this.armExpiryTimer();
      }
    }, delay);
  }

  private clearTimers(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer);
      this.renewalTimer = null;
    }
  }
}
