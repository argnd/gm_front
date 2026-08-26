import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Stat, Ambiance } from '../../models/turn.model';

@Component({
  selector: 'app-stats-panel',
  templateUrl: './stats-panel.component.html',
  styleUrl: './stats-panel.component.scss',
})
export class StatsPanelComponent {
  @Input() statsEntries: Stat[] = [];
  @Input() ambiance: Ambiance | null = null;
  @Input() disabled = false;
  @Output() randomize = new EventEmitter<void>();

  get ambianceEntries(): { label: string; value: number }[] {
    if (!this.ambiance) return [];
    return [
      { label: 'Romance', value: this.ambiance.romance },
      { label: 'Adventure', value: this.ambiance.adventure },
      { label: 'Other', value: this.ambiance.other },
    ];
  }
}
