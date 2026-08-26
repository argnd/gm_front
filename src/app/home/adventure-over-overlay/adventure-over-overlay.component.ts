import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-adventure-over-overlay',
  templateUrl: './adventure-over-overlay.component.html',
  styleUrl: './adventure-over-overlay.component.scss',
})
export class AdventureOverOverlayComponent {
  @Input() visible = false;
}
