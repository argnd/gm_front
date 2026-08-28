import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { FieldMaskService } from './field-mask.service';

@Directive({ selector: '[gmPlayField]' })
export class PlayFieldDirective {
  constructor() {
    const element = inject(ElementRef).nativeElement as HTMLElement;
    const fields = inject(FieldMaskService);

    fields.register(element);
    inject(DestroyRef).onDestroy(() => fields.unregister(element));
  }
}
