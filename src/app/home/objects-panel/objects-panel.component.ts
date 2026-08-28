import { Component, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { GameObject } from '../../models/turn.model';

@Component({
  selector: 'app-objects-panel',
  imports: [NgComponentOutlet],
  templateUrl: './objects-panel.component.html',
  styleUrl: './objects-panel.component.scss',
})
export class ObjectsPanelComponent {
  readonly objects = input<readonly GameObject[]>([]);

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorStage = input(0);
}
