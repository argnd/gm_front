import { Component, Input } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { AnswerPayload } from '../../models/turn.model';

// Raw JSON of both directions of the exchange: `halfturns` is what was sent, `turns` what
// came back. Kept side by side to diff the contract against the backend at a glance.
@Component({
  selector: 'app-debug-history',
  imports: [JsonPipe],
  templateUrl: './debug-history.component.html',
  styleUrl: './debug-history.component.scss',
})
export class DebugHistoryComponent {
  @Input() halfturns: AnswerPayload[] = [];
  @Input() turns: AnswerPayload[] = [];
}
