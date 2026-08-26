export type Stat = {
  name: string;
  value: number;
};

export type Turn = {
  /** The player's action text */
  text: string;
  /** Character stats at the start of this turn */
  stats: Stat[];
  /** The GM's narrative response */
  answer: string;
  /** Character stats after applying this turn's effects */
  newstats: Stat[];
};

export type AnswerPayload = {
  turns: Turn[];
};
