import { Component, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { GameObject } from '../../models/turn.model';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

@Component({
  selector: 'app-objects-panel',
  imports: [NgComponentOutlet],
  templateUrl: './objects-panel.component.html',
  styleUrl: './objects-panel.component.scss',
})
export class ObjectsPanelComponent {
  readonly objects = input<readonly GameObject[]>([]);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }
}
