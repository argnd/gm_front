import { Type } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { AmbianceState } from '../ambiance/ambiance.engine';

export type AmbianceDecorSlot =
  | 'head'
  | 'foot'
  | 'field-bloom-left'
  | 'field-bloom-right'
  | 'answer'
  | 'navbar'
  | 'stats'
  | 'objects'
  | 'rolls'
  | 'trail'
  | 'overlay'
  | 'fx';

export type AmbianceDecorData = {
  ambiance: Ambiance | null;
  stats: readonly Stat[];
};

export const EMPTY_DECOR_DATA: AmbianceDecorData = { ambiance: null, stats: [] };

export const AMBIANCE_DECOR: Partial<Record<AmbianceState, () => Promise<Type<unknown>>>> = {
  neutral: () => import('./neutral-decor.component').then((m) => m.NeutralDecorComponent),
};
