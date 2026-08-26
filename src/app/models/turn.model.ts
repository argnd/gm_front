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

/**
 * Extracts a leading JSON stats array from an IA answer string.
 * The IA is expected to prefix its narrative with a JSON array of Stat objects.
 * Returns the parsed stats and the narrative with the JSON prefix removed.
 */
export function extractStatsFromAnswer(answer: string): { stats: Stat[] | null; cleanAnswer: string } {
  const trimmed = answer.trimStart();

  // Support ```json ... ``` fenced code block
  const fenceMatch = trimmed.match(/^```json\s*([\s\S]*?)\s*```\s*/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (!Array.isArray(parsed)) return { stats: null, cleanAnswer: answer };
      return {
        stats: parsed as Stat[],
        cleanAnswer: trimmed.slice(fenceMatch[0].length).trimStart(),
      };
    } catch {
      return { stats: null, cleanAnswer: answer };
    }
  }

  // Fallback: bare JSON array at the start
  if (!trimmed.startsWith('[')) {
    return { stats: null, cleanAnswer: answer };
  }

  let depth = 0;
  let end = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '[') depth++;
    else if (trimmed[i] === ']') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) return { stats: null, cleanAnswer: answer };

  try {
    const parsed = JSON.parse(trimmed.slice(0, end + 1));
    if (!Array.isArray(parsed)) return { stats: null, cleanAnswer: answer };
    return {
      stats: parsed as Stat[],
      cleanAnswer: trimmed.slice(end + 1).trimStart(),
    };
  } catch {
    return { stats: null, cleanAnswer: answer };
  }
}
