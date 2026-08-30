import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { FieldMaskService } from './field-mask.service';

// Marks an element as a readable surface: its rectangle is published to FieldMaskService,
// which the FX layer turns into an SVG mask so weather particles fade over the interface
// instead of fighting the text. Unregisters on destroy, or a stale rect would keep dimming
// an area nothing occupies any more.
@Directive({ selector: '[gmPlayField]' })
export class PlayFieldDirective {
  constructor() {
    const element = inject(ElementRef).nativeElement as HTMLElement;
    const fields = inject(FieldMaskService);

    fields.register(element);
    inject(DestroyRef).onDestroy(() => fields.unregister(element));
  }
}
