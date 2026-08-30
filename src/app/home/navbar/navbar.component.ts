import { Component, Type, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

// Top bar: identity and sign-out. Injects AuthService directly rather than taking inputs,
// since it is the only consumer of that state in the page.
@Component({
  selector: 'app-navbar',
  imports: [NgComponentOutlet],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }
}
