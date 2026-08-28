import { Component, input } from '@angular/core';
import { AmbianceDecorSlot } from './ambiance-decor';

@Component({
  selector: 'app-decor-neutral',
  templateUrl: './neutral-decor.component.html',
  styleUrl: './neutral-decor.component.scss',
  host: {
    '[class]': '"decor-" + slot()',
    'aria-hidden': 'true',
  },
})
export class NeutralDecorComponent {
  readonly slot = input.required<AmbianceDecorSlot>();
  readonly stage = input(0);
}
