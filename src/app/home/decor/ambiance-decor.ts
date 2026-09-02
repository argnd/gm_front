import { Type } from '@angular/core';
import { Ambiance, Stat } from '../../models/turn.model';
import { AmbianceState } from '../ambiance/ambiance.engine';

// Contract between the home layout and the per-state decor components.
//
// One ambiance state = one decor component, rendered once per slot. A slot is a hook the
// layout offers; the component decides, from its own `slot` input, what to draw there and
// renders nothing for the slots it does not use. The base layout must hold up with no
// decor at all, so a missing state degrades to a bare page rather than a broken one.
export type AmbianceDecorSlot =
  | 'head'
  | 'foot'
  | 'field-bloom-left'
  | 'field-bloom-right'
  | 'answer'
  | 'answer-end'
  | 'stage'
  | 'navbar'
  | 'stats'
  | 'objects'
  | 'rolls'
  | 'trail'
  | 'overlay'
  | 'fx';

// The raw game state handed to every decor component. Deliberately raw: each state
// computes its own thresholds and ramps from it, so no evolution formula lives in the home.
export type AmbianceDecorData = {
  ambiance: Ambiance | null;
  stats: readonly Stat[];
};

export const EMPTY_DECOR_DATA: AmbianceDecorData = { ambiance: null, stats: [] };

// Registry of implemented states. Dynamic imports keep unbuilt states out of the bundle,
// and a state absent from this map simply renders nothing — adding one is a single line.
export const AMBIANCE_DECOR: Partial<Record<AmbianceState, () => Promise<Type<unknown>>>> = {
  neutral: () => import('./neutral-decor.component').then((m) => m.NeutralDecorComponent),
  'romance-1': () => import('./romance-decor.component').then((m) => m.RomanceDecorComponent),
  'romance-2': () => import('./romance-decor.component').then((m) => m.RomanceDecorComponent),
  'romance-3': () => import('./romance-decor.component').then((m) => m.RomanceDecorComponent),
  'adventure-1': () => import('./adventure-decor.component').then((m) => m.AdventureDecorComponent),
  'adventure-2': () => import('./adventure-decor.component').then((m) => m.AdventureDecorComponent),
  'adventure-3': () => import('./adventure-decor.component').then((m) => m.AdventureDecorComponent),
  'other-1': () => import('./other-decor.component').then((m) => m.OtherDecorComponent),
  'other-2': () => import('./other-decor.component').then((m) => m.OtherDecorComponent),
  'other-3': () => import('./other-decor.component').then((m) => m.OtherDecorComponent),
  'romance-1-adventure-1': () =>
    import('./romance-adventure-decor.component').then((m) => m.RomanceAdventureDecorComponent),
  'romance-2-adventure-1': () =>
    import('./romance-adventure-decor.component').then((m) => m.RomanceAdventureDecorComponent),
  'adventure-2-romance-1': () =>
    import('./romance-adventure-decor.component').then((m) => m.RomanceAdventureDecorComponent),
  'romance-1-other-1': () =>
    import('./romance-other-decor.component').then((m) => m.RomanceOtherDecorComponent),
  'romance-2-other-1': () =>
    import('./romance-other-decor.component').then((m) => m.RomanceOtherDecorComponent),
  'other-2-romance-1': () =>
    import('./romance-other-decor.component').then((m) => m.RomanceOtherDecorComponent),
  'adventure-1-other-1': () =>
    import('./adventure-other-decor.component').then((m) => m.AdventureOtherDecorComponent),
  'adventure-2-other-1': () =>
    import('./adventure-other-decor.component').then((m) => m.AdventureOtherDecorComponent),
  'other-2-adventure-1': () =>
    import('./adventure-other-decor.component').then((m) => m.AdventureOtherDecorComponent),
  'romance-1-adventure-1-other-1': () =>
    import('./romance-adventure-other-decor.component').then(
      (m) => m.RomanceAdventureOtherDecorComponent,
    ),
};
