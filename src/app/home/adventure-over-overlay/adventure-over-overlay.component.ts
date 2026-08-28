import { Component, Input, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';

@Component({
  selector: 'app-adventure-over-overlay',
  imports: [NgComponentOutlet],
  templateUrl: './adventure-over-overlay.component.html',
  styleUrl: './adventure-over-overlay.component.scss',
})
export class AdventureOverOverlayComponent {
  @Input() visible = false;

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorStage = input(0);
}
