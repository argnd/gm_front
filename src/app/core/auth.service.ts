import { Injectable, signal } from '@angular/core';
import { SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<SocialUser | null>(null);
  readonly isLoggedIn = signal(false);

  constructor(private socialAuth: SocialAuthService, private router: Router) {
    this.socialAuth.authState.subscribe((user) => {
      this.user.set(user);
      this.isLoggedIn.set(!!user);
      if (user) {
        this.router.navigate(['/home']);
      }
    });
  }

  signOut(): void {
    this.socialAuth.signOut().then(() => {
      this.user.set(null);
      this.isLoggedIn.set(false);
      this.router.navigate(['/login']);
    });
  }
}
