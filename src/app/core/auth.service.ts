import { Injectable, signal } from '@angular/core';
import { SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';

const SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_KEY = 'gm_session';

interface StoredSession {
  user: SocialUser;
  loginTime: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<SocialUser | null>(null);
  readonly isLoggedIn = signal(false);

  private sessionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private socialAuth: SocialAuthService, private router: Router) {
    // Restore session synchronously before the guard ever runs
    this.restoreSession();

    // Only fires on actual sign-in events from GIS (not on refresh)
    this.socialAuth.authState.subscribe((user) => {
      if (user) {
        this.storeSession(user);
        this.user.set(user);
        this.isLoggedIn.set(true);
        this.startSessionTimer();
        this.router.navigate(['/home']);
      }
    });
  }

  getIdToken(): string | null {
    return this.user()?.idToken ?? null;
  }

  signOut(): void {
    this.clearSessionTimer();
    sessionStorage.removeItem(SESSION_KEY);
    this.user.set(null);
    this.isLoggedIn.set(false);
    this.socialAuth.signOut().catch(() => {});
    this.router.navigate(['/login']);
  }

  private restoreSession(): void {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      const session: StoredSession = JSON.parse(raw);
      const elapsed = Date.now() - session.loginTime;

      if (elapsed < SESSION_DURATION_MS) {
        this.user.set(session.user);
        this.isLoggedIn.set(true);
        // Resume timer for the remaining time, not a full 10 min
        const remaining = SESSION_DURATION_MS - elapsed;
        this.sessionTimer = setTimeout(() => this.signOut(), remaining);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  private storeSession(user: SocialUser): void {
    const session: StoredSession = { user, loginTime: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  private startSessionTimer(): void {
    this.clearSessionTimer();
    this.sessionTimer = setTimeout(() => this.signOut(), SESSION_DURATION_MS);
  }

  private clearSessionTimer(): void {
    if (this.sessionTimer !== null) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }
}




