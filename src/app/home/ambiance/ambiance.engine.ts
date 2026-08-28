import { Ambiance, Stat } from '../../models/turn.model';
import copy from '../../content/copy.json';
import rules from '../../content/rules.json';

export type AmbianceKey = 'romance' | 'adventure' | 'other';
export type Tier = 0 | 1 | 2 | 3;

export type AmbianceState =
  | 'neutral'
  | 'romance-1'
  | 'adventure-1'
  | 'other-1'
  | 'romance-2'
  | 'adventure-2'
  | 'other-2'
  | 'romance-3'
  | 'adventure-3'
  | 'other-3'
  | 'romance-1-adventure-1'
  | 'romance-1-other-1'
  | 'adventure-1-other-1'
  | 'romance-1-adventure-1-other-1'
  | 'romance-2-adventure-1'
  | 'romance-2-other-1'
  | 'adventure-2-romance-1'
  | 'adventure-2-other-1'
  | 'other-2-romance-1'
  | 'other-2-adventure-1';

export const AMBIANCE_KEYS: readonly AmbianceKey[] = ['romance', 'adventure', 'other'];
export const AMBIANCE_THRESHOLDS = rules.ambiance.thresholds as [number, number, number];
export const AMBIANCE_MAX = rules.ambiance.max;
export const AMBIANCE_MAX_TOTAL = rules.ambiance.maxTotal;

export const STAT_NAMES: readonly string[] = rules.statNames;
export const MAX_TURNS = rules.maxTurns;

export const STAT_HIGH_THRESHOLD = rules.stats.highThreshold;
export const STAT_LOW_THRESHOLD = rules.stats.lowThreshold;
export const STAT_SCALE = rules.stats.scale;

export const STAT_ROLL: { min: number; max: number; minimums: Record<string, number> } =
  rules.statRoll;

export const AMBIANCE_LABELS: Record<AmbianceKey, string> = copy.ambianceLabels;

export const STAT_LABELS: Record<string, string> = copy.statLabels;

export const STAT_GLYPHS: Record<string, string> = copy.statGlyphs;

export const STAT_SIGNATURES: Record<string, string> = copy.statSignatures;

export type ActionCopy = {
  label: string;
  placeholder: string;
  submit: string;
};

export const ACTION_COPY: Record<AmbianceKey | 'neutral', ActionCopy> = copy.actionCopy;

export const ACTION_HINTS: Record<AmbianceKey | 'neutral', string[]> = copy.actionHints;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function tierOf(value: number): Tier {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe >= AMBIANCE_THRESHOLDS[2]) return 3;
  if (safe >= AMBIANCE_THRESHOLDS[1]) return 2;
  if (safe >= AMBIANCE_THRESHOLDS[0]) return 1;
  return 0;
}

export function bandProgress(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  const tier = tierOf(safe);
  if (tier === 3)
    return clamp01((safe - AMBIANCE_THRESHOLDS[2]) / (AMBIANCE_MAX - AMBIANCE_THRESHOLDS[2]));
  const floor = tier === 0 ? 0 : AMBIANCE_THRESHOLDS[tier - 1];
  return clamp01((safe - floor) / (AMBIANCE_THRESHOLDS[tier] - floor));
}

export function ambianceValue(ambiance: Ambiance | null, key: AmbianceKey): number {
  const raw = ambiance ? ambiance[key] : 0;
  return Number.isFinite(raw) ? Math.min(AMBIANCE_MAX, Math.max(0, raw)) : 0;
}

export function dominantKey(ambiance: Ambiance | null): AmbianceKey | null {
  let best: AmbianceKey | null = null;
  let bestValue = 0;

  for (const key of AMBIANCE_KEYS) {
    const value = ambianceValue(ambiance, key);
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }

  return bestValue >= AMBIANCE_THRESHOLDS[0] ? best : null;
}

export function resolveAmbianceState(ambiance: Ambiance | null): AmbianceState {
  const entries = AMBIANCE_KEYS.map((key) => {
    const value = ambianceValue(ambiance, key);
    return { key, value, tier: tierOf(value) };
  }).sort(
    (a, b) => b.value - a.value || AMBIANCE_KEYS.indexOf(a.key) - AMBIANCE_KEYS.indexOf(b.key),
  );

  const [first, second] = entries;

  if (first.tier === 0) return 'neutral';
  if (first.tier === 3) return `${first.key}-3`;
  if (first.tier === 2) {
    if (second.tier >= 1) {
      return `${first.key}-2-${second.key}-1` as AmbianceState;
    }
    return `${first.key}-2`;
  }

  const active = AMBIANCE_KEYS.filter(
    (key) => entries.find((entry) => entry.key === key)!.tier >= 1,
  );
  if (active.length === 1) return `${active[0]}-1`;
  if (active.length === 2) return `${active[0]}-1-${active[1]}-1` as AmbianceState;
  return 'romance-1-adventure-1-other-1';
}

export function statSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function statValue(stats: readonly Stat[], name: string): number {
  const found = stats.find((stat) => stat.name === name);
  return found && Number.isFinite(found.value) ? found.value : 0;
}

export function isHighStat(value: number): boolean {
  return value > STAT_HIGH_THRESHOLD;
}

export function highStats(stats: readonly Stat[]): Stat[] {
  return stats.filter((stat) => isHighStat(stat.value));
}

export function ambianceClasses(
  ambiance: Ambiance | null,
  stats: readonly Stat[],
): Record<string, boolean> {
  const dominant = dominantKey(ambiance);
  const classes: Record<string, boolean> = {
    'amb-neutral': dominant === null,
    [`amb-state-${resolveAmbianceState(ambiance)}`]: true,
  };

  for (const key of AMBIANCE_KEYS) {
    const tier = tierOf(ambianceValue(ambiance, key));
    classes[`amb-${key}-${tier}`] = tier > 0;
    classes[`amb-dominant-${key}`] = dominant === key;
  }

  for (const stat of stats) {
    classes[`stat-${statSlug(stat.name)}-high`] = isHighStat(stat.value);
  }

  return classes;
}

export function ambianceVars(ambiance: Ambiance | null): Record<string, string> {
  const vars: Record<string, string> = {};
  let dominant = 0;

  for (const key of AMBIANCE_KEYS) {
    const value = ambianceValue(ambiance, key);
    dominant = Math.max(dominant, value);
    vars[`--${key}`] = (value / AMBIANCE_MAX).toFixed(3);
    vars[`--${key}-band`] = bandProgress(value).toFixed(3);
  }

  vars['--dominant'] = (dominant / AMBIANCE_MAX).toFixed(3);

  return vars;
}

export function ambianceTotal(ambiance: Ambiance): number {
  return AMBIANCE_KEYS.reduce((sum, key) => sum + ambianceValue(ambiance, key), 0);
}
