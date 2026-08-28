import { Component, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DiceRoll } from '../../models/turn.model';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

export type RollEntry = {
  roll: DiceRoll;
  turn: number;
};

@Component({
  selector: 'app-rolls-panel',
  imports: [NgComponentOutlet],
  templateUrl: './rolls-panel.component.html',
  styleUrl: './rolls-panel.component.scss',
})
export class RollsPanelComponent {
  readonly rolls = input<readonly RollEntry[]>([]);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }
}
