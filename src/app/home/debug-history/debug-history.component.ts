import { Component, Input } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { AnswerPayload } from '../../models/turn.model';

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
