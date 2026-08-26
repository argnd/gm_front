import { Component, Input } from '@angular/core';
import { Turn } from '../../models/turn.model';

@Component({
  selector: 'app-turn-card',
  templateUrl: './turn-card.component.html',
  styleUrl: './turn-card.component.scss',
})
export class TurnCardComponent {
  @Input({ required: true }) turn!: Turn;
  @Input() index = 0;
}
