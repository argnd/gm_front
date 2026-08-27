import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACTION_COPY, ActionCopy } from '../ambiance/ambiance.engine';

@Component({
  selector: 'app-chat-input',
  imports: [FormsModule],
  templateUrl: './chat-input.component.html',
  styleUrl: './chat-input.component.scss',
})
export class ChatInputComponent {
  @Input() prompt = '';
  @Input() copy: ActionCopy = ACTION_COPY['neutral'];
  @Input() disabled = false;
  @Input() loading = false;
  @Output() promptChange = new EventEmitter<string>();
  @Output() submit = new EventEmitter<void>();
}
