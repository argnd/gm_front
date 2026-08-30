// Exchange contract with the GM backend (POST /answer).
// A turn carries both the before state (stats/ambiance/objects) and the after state
// (new*): the front sends the whole history on every request, so the backend stays
// stateless and any turn can be replayed or inspected in isolation.
import rules from '../content/rules.json';

export type Stat = {
  name: string;
  value: number;
};

export type GameObject = {
  name: string;
  description: string;
};

// The three narrative axes, 0-100 each with a shared budget (sum <= 100), which is what
// makes a maxed-out axis mutually exclusive with the others.
export type Ambiance = {
  romance: number;
  adventure: number;
  other: number;
};

export const DEFAULT_AMBIANCE: Ambiance = rules.defaultAmbiance;

export type DiceRoll = {
  /** Dice notation without the modifier, e.g. "1d20", "2d6" */
  dice: string;
  /** What the roll is for, displayable as-is */
  label: string;
  /** Related stat name ("AGI"…) to reuse glyphs/colors, or null */
  stat: string | null;
  /** Result of each individual die */
  rolls: number[];
  /** Bonus/malus applied (can be negative) */
  modifier: number;
  /** Sum of rolls + modifier, precomputed by the backend */
  total: number;
  /** Threshold to beat, or null for a purely narrative roll */
  difficulty: number | null;
  /** Outcome, or null when there is no threshold */
  success: boolean | null;
};

export type StoryStatus = 'ongoing' | 'failure' | 'success';

export type Turn = {
  /** The player's action text */
  text: string;
  /** Character stats at the start of this turn */
  stats: Stat[];
  /** Ambiance at the start of this turn */
  ambiance: Ambiance;
  /** Objects held at the start of this turn */
  objects: GameObject[] | null;
  /** The GM's narrative response */
  answer: string;
  /** Character stats after applying this turn's effects */
  newstats: Stat[] | null;
  /** Ambiance after applying this turn's effects */
  newAmbiance: Ambiance | null;
  /** Objects held after applying this turn's effects */
  newObjects: GameObject[] | null;
  /** Dice rolls resolved by the GM during this turn */
  diceRolls: DiceRoll[] | null;
  /** Free-form JSON block */
  extra: Record<string, unknown> | null;
  /** Free-form JSON memory returned by the GM after this turn */
  newExtra: Record<string, unknown> | null;
  /** State of the adventure after this turn */
  story: StoryStatus | null;
  /** Glimpses of what may come next */
  precognition: string[] | null;
};

// One request/response envelope: `turns` is the full history, the last entry being the
// turn currently being resolved.
export type AnswerPayload = {
  turns: Turn[];
};
