import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Stat } from '../../models/turn.model';

@Component({
  selector: 'app-stats-panel',
  templateUrl: './stats-panel.component.html',
  styleUrl: './stats-panel.component.scss',
})
export class StatsPanelComponent {
  @Input() statsEntries: Stat[] = [];
  @Input() disabled = false;
  @Output() randomize = new EventEmitter<void>();
}
