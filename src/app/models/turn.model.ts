import rules from '../content/rules.json';

export type Stat = {
  name: string;
  value: number;
};

export type GameObject = {
  name: string;
  description: string;
};

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
};

export type AnswerPayload = {
  turns: Turn[];
};
