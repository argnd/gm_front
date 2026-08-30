import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App {
  // Eagerly initialize AuthService so it subscribes to auth state at startup.
  // Injected but never read: the side effects of its constructor are the point.
  private auth = inject(AuthService);
}
