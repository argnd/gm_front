import { Component, Type, inject, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [NgComponentOutlet],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorStage = input(0);
}
