import { Component, computed, input } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { ambianceTotal } from '../ambiance/ambiance.engine';
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
  readonly ambiance = input<Ambiance | null>(null);
  readonly stats = input<readonly Stat[]>([]);

  protected readonly stage = computed(() => {
    const value = this.ambiance();
    if (!value) return 0;
    return Math.max(0, Math.min(3, Math.floor(ambianceTotal(value) / 10) - 5));
  });
}
