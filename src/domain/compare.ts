import { SLOT_KEYS, type Build, type SlotEntry, type SlotKey } from './build/types';
import { computeBuild, ELEMENT_RES_PCT, type ActiveSet, type BuildResult, type EngineDataset } from './engine';
import { ELEMENTAL_STATS, MAIN_STATS, type Breed, type MainStat } from './rules';
import { ELEMENTS, ELEMENT_LABELS, STATS, type Element, type StatKey } from './stats';

export type CompareSection = 'Général' | 'Caractéristiques' | 'Tacle, fuite, esquives et retraits' | 'Dommages' | 'Résistances';

/** Ligne affichée : mêmes clés que le panneau de résultats de l'éditeur (`hp`, `shown-<élément>`, sinon la StatKey). */
export interface CompareRowDef {
  key: string;
  label: string;
  section: CompareSection;
  percent: boolean;
  /** Plus grand = plus important ; sert au tri « importance ». */
  importance: number;
  value: (result: BuildResult) => number;
}

const RES_FIXED: Record<Element, StatKey> = {
  neutral: 'resFixedNeutral',
  earth: 'resFixedEarth',
  fire: 'resFixedFire',
  water: 'resFixedWater',
  air: 'resFixedAir',
};

// Ordre de priorité indicatif d'un joueur qui compare deux stuffs : PA/PM/PO d'abord, puis vie et caracs.
const IMPORTANCE: Partial<Record<string, number>> = {
  ap: 100, mp: 95, range: 90, hp: 85, vitality: 84,
  strength: 80, intelligence: 80, chance: 80, agility: 80, power: 79,
  critical: 75, damage: 74, 'shown-neutral': 73, 'shown-earth': 73, 'shown-fire': 73, 'shown-water': 73, 'shown-air': 73,
  dmgPctSpells: 72, dmgPctWeapon: 72, dmgPctMelee: 71, dmgPctRanged: 71, dmgCritical: 70,
  resPctNeutral: 65, resPctEarth: 65, resPctFire: 65, resPctWater: 65, resPctAir: 65,
  resPctMelee: 64, resPctRanged: 64, resPctSpells: 63, resPctWeapon: 63,
  resFixedNeutral: 60, resFixedEarth: 60, resFixedFire: 60, resFixedWater: 60, resFixedAir: 60,
  summons: 58, wisdom: 57, apReduction: 55, mpReduction: 55, apParry: 54, mpParry: 54, lock: 53, dodge: 53,
  heals: 50, initiative: 45, dmgPushback: 44, resPushback: 43, resCritical: 43,
  dmgTraps: 30, powerTraps: 30, dmgReflected: 30, prospecting: 20, pods: 10,
};

function statRow(section: CompareSection, key: StatKey, label: string = STATS[key].label): CompareRowDef {
  const def = STATS[key] as { label: string; percent?: boolean };
  return { key, label, section, percent: def.percent ?? false, importance: IMPORTANCE[key] ?? 0, value: (r) => r.totals[key] };
}

/** Les lignes du panneau de résultats, dans son ordre. */
export const COMPARE_ROWS: readonly CompareRowDef[] = [
  { key: 'hp', label: 'Points de vie', section: 'Général', percent: false, importance: IMPORTANCE.hp!, value: (r) => r.derived.hp },
  statRow('Général', 'ap'),
  statRow('Général', 'mp'),
  statRow('Général', 'range', 'PO'),
  statRow('Général', 'initiative'),
  statRow('Général', 'critical'),
  statRow('Général', 'summons'),
  statRow('Général', 'heals'),
  statRow('Général', 'prospecting'),
  statRow('Général', 'pods'),
  statRow('Caractéristiques', 'vitality'),
  statRow('Caractéristiques', 'wisdom'),
  ...ELEMENTAL_STATS.map((key) => statRow('Caractéristiques', key)),
  statRow('Caractéristiques', 'power'),
  ...(['lock', 'dodge', 'apParry', 'mpParry', 'apReduction', 'mpReduction'] as const).map((key) => statRow('Tacle, fuite, esquives et retraits', key)),
  statRow('Dommages', 'damage', 'Dommages (tous éléments)'),
  ...ELEMENTS.map((element): CompareRowDef => ({
    key: `shown-${element}`,
    label: `Dommages ${ELEMENT_LABELS[element]}`,
    section: 'Dommages',
    percent: false,
    importance: IMPORTANCE[`shown-${element}`]!,
    value: (r) => r.derived.shownDamage[element],
  })),
  statRow('Dommages', 'dmgCritical', 'Dommages critiques'),
  statRow('Dommages', 'dmgPushback', 'Dommages de poussée'),
  statRow('Dommages', 'dmgPctWeapon', '% Dommages d’armes'),
  statRow('Dommages', 'dmgPctSpells', '% Dommages aux sorts'),
  statRow('Dommages', 'dmgPctMelee', '% Dommages mêlée'),
  statRow('Dommages', 'dmgPctRanged', '% Dommages distance'),
  statRow('Dommages', 'dmgTraps', 'Dommages aux pièges'),
  statRow('Dommages', 'powerTraps', 'Puissance aux pièges'),
  statRow('Dommages', 'dmgReflected', 'Dommages renvoyés'),
  ...ELEMENTS.flatMap((element) => [statRow('Résistances', RES_FIXED[element]), statRow('Résistances', ELEMENT_RES_PCT[element])]),
  statRow('Résistances', 'resCritical', 'Résistance critiques'),
  statRow('Résistances', 'resPushback', 'Résistance poussée'),
  statRow('Résistances', 'resPctMelee'),
  statRow('Résistances', 'resPctRanged'),
  statRow('Résistances', 'resPctWeapon'),
  statRow('Résistances', 'resPctSpells'),
];

export interface StatDiff {
  key: string;
  label: string;
  section: CompareSection;
  percent: boolean;
  importance: number;
  /** Position dans le panneau de résultats. */
  order: number;
  a: number;
  b: number;
  /** b − a */
  delta: number;
}

export type StatSort = 'panel' | 'importance' | 'delta';

/** `importance` : priorité de la stat puis écart ; `delta` : plus grand écart absolu d'abord. Tri stable, nouvelle liste. */
export function sortStatDiffs(rows: readonly StatDiff[], by: StatSort): StatDiff[] {
  const sorted = [...rows];
  if (by === 'panel') return sorted.sort((x, y) => x.order - y.order);
  if (by === 'delta') return sorted.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.order - y.order);
  return sorted.sort((x, y) => y.importance - x.importance || Math.abs(y.delta) - Math.abs(x.delta) || x.order - y.order);
}

export type SlotDiffStatus = 'same' | 'different' | 'empty';

export interface SlotSide {
  itemId: number;
  name: string;
}

export interface SlotDiff {
  slot: SlotKey;
  /** `same` : même objet des deux côtés ; `empty` : vide des deux côtés ; sinon `different` (un côté peut être vide). */
  status: SlotDiffStatus;
  a: SlotSide | null;
  b: SlotSide | null;
  /** Même objet mais jets ou exos différents. */
  tuned: boolean;
}

export interface SetDiff {
  setId: number;
  name: string;
  /** 0 = panoplie absente de ce côté. */
  piecesA: number;
  piecesB: number;
}

export interface CaracDiff {
  stat: MainStat;
  label: string;
  base: { a: number; b: number; delta: number };
  scrolls: { a: number; b: number; delta: number };
}

export interface BuildComparison {
  a: BuildResult;
  b: BuildResult;
  /** Ordre du panneau ; voir `sortStatDiffs`. */
  stats: StatDiff[];
  slots: SlotDiff[];
  sets: { a: ActiveSet[]; b: ActiveSet[]; diff: SetDiff[] };
  caracs: CaracDiff[];
  points: {
    spent: { a: number; b: number; delta: number };
    available: { a: number; b: number; delta: number };
  };
}

const pair = (a: number, b: number) => ({ a, b, delta: b - a });

function sideOf(entry: SlotEntry | null, result: BuildResult, slot: SlotKey): SlotSide | null {
  if (!entry) return null;
  return { itemId: entry.itemId, name: result.slots[slot]?.item?.name ?? entry.itemName };
}

function sameTuning(x: SlotEntry, y: SlotEntry): boolean {
  const rolls = (e: SlotEntry) => JSON.stringify([...e.rolls].sort((p, q) => p.line - q.line).map((r) => [r.line, r.stat, r.value]));
  const exos = (e: SlotEntry) => JSON.stringify([...e.exos].map((x) => [x.stat, x.value]).sort());
  return rolls(x) === rolls(y) && exos(x) === exos(y);
}

export function compareBuilds(a: Build, b: Build, dataset: EngineDataset, breeds: readonly Breed[] = []): BuildComparison {
  const ra = computeBuild(a, dataset, breeds);
  const rb = computeBuild(b, dataset, breeds);

  const stats = COMPARE_ROWS.map((row, order): StatDiff => {
    const va = row.value(ra);
    const vb = row.value(rb);
    return { key: row.key, label: row.label, section: row.section, percent: row.percent, importance: row.importance, order, a: va, b: vb, delta: vb - va };
  });

  const slots = SLOT_KEYS.map((slot): SlotDiff => {
    const ea = a.slots[slot];
    const eb = b.slots[slot];
    const side = { a: sideOf(ea, ra, slot), b: sideOf(eb, rb, slot) };
    if (!ea && !eb) return { slot, status: 'empty', ...side, tuned: false };
    if (ea && eb && ea.itemId === eb.itemId) return { slot, status: 'same', ...side, tuned: !sameTuning(ea, eb) };
    return { slot, status: 'different', ...side, tuned: false };
  });

  const setIds = [...new Set([...ra.sets, ...rb.sets].map((s) => s.setId))];
  const setDiff = setIds.map((setId): SetDiff => {
    const sa = ra.sets.find((s) => s.setId === setId);
    const sb = rb.sets.find((s) => s.setId === setId);
    return { setId, name: (sa ?? sb)!.name, piecesA: sa?.pieces ?? 0, piecesB: sb?.pieces ?? 0 };
  });

  const caracs = MAIN_STATS.map((stat): CaracDiff => ({
    stat,
    label: STATS[stat].label,
    base: pair(a.caracs.base[stat], b.caracs.base[stat]),
    scrolls: pair(a.caracs.scrolls[stat], b.caracs.scrolls[stat]),
  }));

  return {
    a: ra,
    b: rb,
    stats,
    slots,
    sets: { a: ra.sets, b: rb.sets, diff: setDiff },
    caracs,
    points: { spent: pair(ra.points.spent, rb.points.spent), available: pair(ra.points.available, rb.points.available) },
  };
}
