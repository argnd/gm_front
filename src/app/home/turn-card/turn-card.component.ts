import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { Turn } from '../../models/turn.model';

@Component({
  selector: 'app-turn-card',
  templateUrl: './turn-card.component.html',
  styleUrl: './turn-card.component.scss',
})
export class TurnCardComponent implements OnChanges {
  @Input({ required: true }) turn!: Turn;
  @Input() index = 0;
  @Input() isLast = false;

  collapsed = signal(true);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isLast']) {
      this.collapsed.set(!this.isLast);
    }
  }

  toggle(): void {
    this.collapsed.update(v => !v);
  }
}
