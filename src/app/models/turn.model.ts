import rules from '../content/rules.json';

export type Stat = {
  name: string;
  value: number;
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
  /** The GM's narrative response */
  answer: string;
  /** Character stats after applying this turn's effects */
  newstats: Stat[] | null;
  /** Ambiance after applying this turn's effects */
  newAmbiance: Ambiance | null;
  /** Dice rolls resolved by the GM during this turn */
  diceRolls: DiceRoll[] | null;
  /** Free-form JSON block */
  extra: Record<string, unknown> | null;
};

export type AnswerPayload = {
  turns: Turn[];
};

/**
 * Extracts a leading JSON block from an IA answer string.
 * Supports three formats:
 *   - New object format: { "stats": [...], "ambiance": {...} }
 *   - Legacy array format: [{ "name": "...", "value": ... }, ...]
 *   - Either of the above wrapped in a ```json ... ``` fence
 * Returns the parsed stats, ambiance, and the narrative with the JSON prefix removed.
 */
export function extractStatsFromAnswer(answer: string): {
  stats: Stat[] | null;
  ambiance: Ambiance | null;
  cleanAnswer: string;
} {
  const trimmed = answer.trimStart();
  const none = { stats: null, ambiance: null, cleanAnswer: answer };

  // Support ```json ... ``` fenced code block
  const fenceMatch = trimmed.match(/^```json\s*([\s\S]*?)\s*```\s*/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      const cleanAnswer = trimmed.slice(fenceMatch[0].length).trimStart();
      return extractFromParsed(parsed, cleanAnswer) ?? none;
    } catch {
      return none;
    }
  }

  // Bare JSON object { stats, ambiance }
  if (trimmed.startsWith('{')) {
    const end = findMatchingClose(trimmed, '{', '}');
    if (end !== -1) {
      try {
        const parsed = JSON.parse(trimmed.slice(0, end + 1));
        const result = extractFromParsed(parsed, trimmed.slice(end + 1).trimStart());
        if (result) return result;
      } catch {
        /* fall through */
      }
    }
  }

  // Legacy: bare JSON array at the start
  if (!trimmed.startsWith('[')) return none;

  const end = findMatchingClose(trimmed, '[', ']');
  if (end === -1) return none;

  try {
    const parsed = JSON.parse(trimmed.slice(0, end + 1));
    if (!Array.isArray(parsed)) return none;
    return {
      stats: parsed as Stat[],
      ambiance: null,
      cleanAnswer: trimmed.slice(end + 1).trimStart(),
    };
  } catch {
    return none;
  }
}

function extractFromParsed(
  parsed: unknown,
  cleanAnswer: string,
): { stats: Stat[] | null; ambiance: Ambiance | null; cleanAnswer: string } | null {
  if (Array.isArray(parsed)) {
    return { stats: parsed as Stat[], ambiance: null, cleanAnswer };
  }
  if (parsed && typeof parsed === 'object' && 'stats' in parsed) {
    const obj = parsed as Record<string, unknown>;
    return {
      stats: Array.isArray(obj['stats']) ? (obj['stats'] as Stat[]) : null,
      ambiance: isAmbiance(obj['ambiance']) ? obj['ambiance'] : null,
      cleanAnswer,
    };
  }
  return null;
}

function isAmbiance(value: unknown): value is Ambiance {
  return (
    !!value &&
    typeof value === 'object' &&
    'romance' in value &&
    'adventure' in value &&
    'other' in value
  );
}

function findMatchingClose(str: string, open: string, close: string): number {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === open) depth++;
    else if (str[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
