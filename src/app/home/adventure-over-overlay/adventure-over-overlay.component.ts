import { Component, Input, Type, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { AmbianceDecorSlot, AmbianceDecorData, EMPTY_DECOR_DATA } from '../decor/ambiance-decor';

// End-of-adventure curtain, shown for a few seconds before the home resets the story.
// Purely a display: the reset itself is timed by the home.
@Component({
  selector: 'app-adventure-over-overlay',
  imports: [NgComponentOutlet],
  templateUrl: './adventure-over-overlay.component.html',
  styleUrl: './adventure-over-overlay.component.scss',
})
export class AdventureOverOverlayComponent {
  @Input() visible = false;

  readonly decor = input<Type<unknown> | null>(null);
  readonly decorData = input<AmbianceDecorData>(EMPTY_DECOR_DATA);

  protected decorInputs(slot: AmbianceDecorSlot): Record<string, unknown> {
    return { slot, ...this.decorData() };
  }
}
