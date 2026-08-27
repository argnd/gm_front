import { Ambiance, Stat } from '../../models/turn.model';

export type AmbianceKey = 'romance' | 'adventure' | 'other';
export type Tier = 0 | 1 | 2 | 3;

export const AMBIANCE_KEYS: readonly AmbianceKey[] = ['romance', 'adventure', 'other'];
export const AMBIANCE_THRESHOLDS = [30, 60, 90] as const;
export const AMBIANCE_MAX = 100;
export const AMBIANCE_MAX_TOTAL = 100;

export const STAT_HIGH_THRESHOLD = 8;
export const STAT_LOW_THRESHOLD = 3;
export const STAT_SCALE = 10;

export const AMBIANCE_LABELS: Record<AmbianceKey, string> = {
  romance: 'Romance',
  adventure: 'Aventure',
  other: 'Autre',
};

export const STAT_LABELS: Record<string, string> = {
  Health: 'Vitalité',
  Mana: 'Mana',
  STR: 'Force',
  AGI: 'Agilité',
  INT: 'Esprit',
  Gold: 'Or',
};

export const STAT_GLYPHS: Record<string, string> = {
  Health: '❤',
  Mana: '✦',
  STR: '⛊',
  AGI: '➤',
  INT: '✧',
  Gold: '◈',
};

export const STAT_SIGNATURES: Record<string, string> = {
  Health: 'Le souffle bat si fort qu’il résonne dans la pièce.',
  Mana: 'Des runes tournent lentement autour de vous.',
  STR: 'Le sol se fend sous votre poids.',
  AGI: 'L’air se déchire sur votre passage.',
  INT: 'Des lignes de savoir relient chaque chose.',
  Gold: 'Une poussière d’or ne retombe jamais tout à fait.',
};

export type ActionCopy = {
  label: string;
  placeholder: string;
  submit: string;
};

export const ACTION_COPY: Record<AmbianceKey | 'neutral', ActionCopy> = {
  neutral: {
    label: 'Votre action',
    placeholder: 'Que faites-vous ?',
    submit: 'Jouer',
  },
  romance: {
    label: 'Votre geste',
    placeholder: 'Que dites-vous, que laissez-vous paraître ?',
    submit: 'Oser',
  },
  adventure: {
    label: 'Votre manœuvre',
    placeholder: 'Que tentez-vous, et à quel prix ?',
    submit: 'Engager',
  },
  other: {
    label: 'Votre choix',
    placeholder: 'Où va votre attention ?',
    submit: 'Poursuivre',
  },
};

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
  };

  for (const key of AMBIANCE_KEYS) {
    const tier = tierOf(ambianceValue(ambiance, key));
    classes[`amb-${key}-${tier}`] = tier > 0;
    classes[`amb-dominant-${key}`] = dominant === key;
  }

  for (const stat of stats) {
    classes[`stat-${statSlug(stat.name)}-high`] = isHighStat(stat.value);
  }

  classes['stat-health-low'] = statValue(stats, 'Health') < STAT_LOW_THRESHOLD;

  return classes;
}

export function ambianceVars(
  ambiance: Ambiance | null,
  stats: readonly Stat[],
): Record<string, string> {
  const vars: Record<string, string> = {};
  let dominant = 0;

  for (const key of AMBIANCE_KEYS) {
    const value = ambianceValue(ambiance, key);
    dominant = Math.max(dominant, value);
    vars[`--${key}`] = (value / AMBIANCE_MAX).toFixed(3);
    vars[`--${key}-band`] = bandProgress(value).toFixed(3);
  }

  vars['--dominant'] = (dominant / AMBIANCE_MAX).toFixed(3);

  for (const stat of stats) {
    vars[`--stat-${statSlug(stat.name)}`] = clamp01(stat.value / STAT_SCALE).toFixed(3);
  }

  return vars;
}

export function ambianceTotal(ambiance: Ambiance): number {
  return AMBIANCE_KEYS.reduce((sum, key) => sum + ambianceValue(ambiance, key), 0);
}
