import { Component, input } from '@angular/core';
import { GameObject } from '../../models/turn.model';

@Component({
  selector: 'app-objects-panel',
  templateUrl: './objects-panel.component.html',
  styleUrl: './objects-panel.component.scss',
})
export class ObjectsPanelComponent {
  readonly objects = input<readonly GameObject[]>([]);
}
