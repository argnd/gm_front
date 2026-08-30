import { Component, DestroyRef, ElementRef, effect, inject, viewChild } from '@angular/core';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { LoginFx } from './fx/login-fx';
import { ConstellationField } from './fx/constellation-field';
import { WispField } from './fx/wisp-field';
import { ShootingStars } from './fx/shooting-star';

@Component({
  selector: 'app-login',
  imports: [GoogleSigninButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly sky = viewChild<ElementRef<HTMLCanvasElement>>('sky');
  private fxCanvas: HTMLCanvasElement | null = null;
  private fxTeardown: (() => void) | null = null;

  constructor() {
    // Restarts the engine whenever the canvas element itself changes, and only then: the
    // effect re-runs on any signal read, so comparing against the current canvas is what
    // keeps it from tearing down and rebuilding the scenes for nothing.
    // Scene order is paint order — wisps sit behind the constellation, streaks on top.
    effect(() => {
      const canvas = this.sky()?.nativeElement ?? null;
      if (canvas === this.fxCanvas) {
        return;
      }
      this.fxTeardown?.();
      this.fxCanvas = canvas;
      this.fxTeardown = canvas
        ? new LoginFx(canvas, [
            new WispField(),
            new ConstellationField(),
            new ShootingStars(),
          ]).start()
        : null;
    });

    inject(DestroyRef).onDestroy(() => this.fxTeardown?.());
  }
}
