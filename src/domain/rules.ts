import type { StatKey } from './stats';

/** `dofusbook` : retrouvé exactement sur les totaux de stuffs DofusBook (test/fixtures/dofusbook) ; rien n'est vérifié en jeu. */
export type RuleStatus = 'dofusbook' | 'non vérifié';

export interface Rule {
  label: string;
  /** Formule ou valeur, lisible par l'utilisateur. */
  formula: string;
  status: RuleStatus;
  source: string;
}

export const MAIN_STATS = ['vitality', 'wisdom', 'strength', 'intelligence', 'chance', 'agility'] as const;
export type MainStat = (typeof MAIN_STATS)[number];
export const ELEMENTAL_STATS = ['strength', 'intelligence', 'chance', 'agility'] as const satisfies readonly MainStat[];

/** Paliers DofusDB `statsPointsFor*` : [valeur de base à partir de laquelle, coût en points par unité]. */
export type StatCostTiers = ReadonlyArray<readonly [number, number, ...number[]]>;

/** Classe telle que l'écrit scripts/sync-dofusdb.mjs dans public/data/breeds.json. */
export interface Breed {
  id: number;
  name: string;
  statCosts: Record<MainStat, StatCostTiers>;
  spellIds: number[];
  img: string | null;
}

export interface BreedsFile {
  source: string;
  fetchedAt: string;
  breeds: Breed[];
}

const FIXTURES = 'stuffs DofusBook 23428650 et 23428299 (test/fixtures/dofusbook)';

export const BASE = {
  hp: 50,
  hpPerLevel: 5,
  apHighLevel: 7,
  apLowLevel: 6,
  apLevelThreshold: 100,
  mp: 3,
  range: 0,
  summons: 1,
  critical: 0,
  prospecting: 100,
  pods: 1000,
} as const;

export const CAPS = { resPct: 50, ap: 12, mp: 6, range: 9 } as const;
export const POINTS_PER_LEVEL = 5;
export const SCROLL_MAX = 100;

/** Paliers communs aux 19 classes (constaté dans breeds.json) : repli quand la classe n'est pas choisie. */
export const DEFAULT_STAT_COSTS: Record<MainStat, StatCostTiers> = {
  vitality: [[0, 1]],
  wisdom: [[0, 3]],
  strength: [[0, 1], [100, 2], [200, 3], [300, 4]],
  intelligence: [[0, 1], [100, 2], [200, 3], [300, 4]],
  chance: [[0, 1], [100, 2], [200, 3], [300, 4]],
  agility: [[0, 1], [100, 2], [200, 3], [300, 4]],
};

export const RULES = {
  hp: { label: 'Points de vie', formula: '50 + 5 × niveau + Vitalité', status: 'dofusbook', source: FIXTURES },
  apBase: { label: 'PA de base (niveau ≥ 100)', formula: '7', status: 'dofusbook', source: FIXTURES },
  apBaseLow: { label: 'PA de base (niveau < 100)', formula: '6', status: 'non vérifié', source: 'aucun stuff DofusBook sous le niveau 100 examiné' },
  mpBase: { label: 'PM de base', formula: '3', status: 'dofusbook', source: FIXTURES },
  rangeBase: { label: 'Portée de base', formula: '0', status: 'dofusbook', source: FIXTURES },
  summonsBase: { label: 'Invocations de base', formula: '1', status: 'dofusbook', source: FIXTURES },
  criticalBase: { label: '% Critique de base', formula: '0', status: 'dofusbook', source: FIXTURES },
  initiative: { label: 'Initiative', formula: 'Force + Intelligence + Chance + Agilité + bonus', status: 'dofusbook', source: FIXTURES },
  prospecting: { label: 'Prospection', formula: '100 + ⌊Chance / 10⌋ + bonus', status: 'dofusbook', source: FIXTURES },
  pods: { label: 'Pods', formula: '1000 + 5 × Force + bonus', status: 'dofusbook', source: FIXTURES },
  lockDodge: { label: 'Tacle et Fuite', formula: '⌊Agilité / 10⌋ + bonus', status: 'dofusbook', source: FIXTURES },
  parryReduction: { label: 'Esquive et Retrait PA/PM', formula: '⌊Sagesse / 10⌋ + bonus', status: 'dofusbook', source: FIXTURES },
  shownDamage: { label: 'Dommages affichés par élément', formula: 'Dommages de l\'élément + Dommages (génériques)', status: 'dofusbook', source: FIXTURES },
  effectiveStat: { label: 'Carac affichée pour les dégâts', formula: 'carac + Puissance', status: 'dofusbook', source: FIXTURES },
  caracCost: { label: 'Coût des caracs', formula: 'paliers de la classe appliqués à la valeur de base seule ; parchemins hors paliers', status: 'dofusbook', source: `${FIXTURES} : 265 → 495 pts, 266 → 498 pts` },
  points: { label: 'Points de caracs disponibles', formula: '5 × (niveau − 1)', status: 'dofusbook', source: '995 au niveau 200' },
  perfectRoll: { label: 'Jet par défaut', formula: 'jet parfait : max pour un bonus, le plus proche de 0 pour un malus', status: 'dofusbook', source: FIXTURES },
  resPctCap: { label: 'Plafond des résistances %', formula: '50 % (avertissement seulement)', status: 'non vérifié', source: 'source non officielle' },
  apMpRangeCaps: { label: 'Plafonds PA / PM / PO', formula: '12 / 6 / 9 (avertissement seulement)', status: 'non vérifié', source: 'sources de 2011' },
  exoCap: { label: 'Exos PA / PM / PO', formula: 'un seul exo compte par stat (avertissement seulement)', status: 'non vérifié', source: 'sources de 2011' },
  scrollMax: { label: 'Parchemins par carac', formula: '100 au plus', status: 'non vérifié', source: 'valeur de DofusBook, plafond non vérifié en jeu' },
  setCount: { label: 'Pièces de panoplie', formula: 'objets distincts équipés ; deux exemplaires du même objet comptent une fois', status: 'non vérifié', source: 'PLAN §2.6' },
  conditionBase: { label: 'Évaluation des conditions', formula: 'sur les totaux finaux du stuff, objet compris (convention des outils de build)', status: 'non vérifié', source: 'le jeu vérifie à l’équipement, dans l’ordre' },
  setBonusCondition: { label: 'Condition « Bonus de panoplies »', formula: 'nombre de panoplies dont au moins 2 pièces sont équipées', status: 'non vérifié', source: 'interprétation' },
} as const satisfies Record<string, Rule>;

export type RuleKey = keyof typeof RULES;

export function unverifiedRules(): Array<Rule & { key: RuleKey }> {
  return (Object.entries(RULES) as Array<[RuleKey, Rule]>)
    .filter(([, rule]) => rule.status === 'non vérifié')
    .map(([key, rule]) => ({ key, ...rule }));
}

export function baseAp(level: number): number {
  return level >= BASE.apLevelThreshold ? BASE.apHighLevel : BASE.apLowLevel;
}

/** Valeurs de départ avant caracs et équipement. */
export function baseStats(level: number): Partial<Record<StatKey, number>> {
  return {
    ap: baseAp(level),
    mp: BASE.mp,
    range: BASE.range,
    summons: BASE.summons,
    critical: BASE.critical,
    prospecting: BASE.prospecting,
    pods: BASE.pods,
  };
}

export function hitPoints(level: number, vitality: number): number {
  return BASE.hp + BASE.hpPerLevel * level + vitality;
}

/** Bonus dérivés des caracs finales, à ajouter aux totaux des stats concernées. */
export function derivedFromCaracs(caracs: Record<MainStat, number>): Array<{ stat: StatKey; from: MainStat; value: number }> {
  const agility = Math.floor(caracs.agility / 10);
  const wisdom = Math.floor(caracs.wisdom / 10);
  return [
    ...ELEMENTAL_STATS.map((from) => ({ stat: 'initiative' as const, from, value: caracs[from] })),
    { stat: 'prospecting', from: 'chance', value: Math.floor(caracs.chance / 10) },
    { stat: 'pods', from: 'strength', value: 5 * caracs.strength },
    { stat: 'lock', from: 'agility', value: agility },
    { stat: 'dodge', from: 'agility', value: agility },
    { stat: 'apParry', from: 'wisdom', value: wisdom },
    { stat: 'mpParry', from: 'wisdom', value: wisdom },
    { stat: 'apReduction', from: 'wisdom', value: wisdom },
    { stat: 'mpReduction', from: 'wisdom', value: wisdom },
  ];
}

/** Points dépensés pour porter une carac de 0 à `value` (valeur de base, parchemins exclus). */
export function caracCost(value: number, tiers: StatCostTiers): number {
  let cost = 0;
  for (let i = 0; i < tiers.length; i++) {
    const [start, perUnit] = tiers[i]!;
    const end = tiers[i + 1]?.[0] ?? Infinity;
    if (value <= start) break;
    cost += (Math.min(value, end) - start) * perUnit;
  }
  return cost;
}

export function availablePoints(level: number): number {
  return POINTS_PER_LEVEL * Math.max(0, level - 1);
}
