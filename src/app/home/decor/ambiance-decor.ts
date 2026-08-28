import { Type } from '@angular/core';
import { AmbianceKey } from '../ambiance/ambiance.engine';
import { NeutralDecorComponent } from './neutral-decor.component';

export type AmbianceDecorSlot =
  | 'head'
  | 'foot'
  | 'field-bloom-left'
  | 'field-bloom-right'
  | 'answer';

export const AMBIANCE_DECOR: Partial<Record<AmbianceKey | 'neutral', Type<unknown>>> = {
  neutral: NeutralDecorComponent,
};
