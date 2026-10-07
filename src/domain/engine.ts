import { rollMatches, rollMismatchMessage } from './build/validate';
import { SLOT_KEYS, SLOT_LABELS, type Build, type Exo, type SlotKey } from './build/types';
import { evaluateCondition, type ConditionResult } from './conditions';
import type { Dataset, Item, SetBonus } from './dataset';
import {
  CAPS,
  DEFAULT_STAT_COSTS,
  ELEMENTAL_STATS,
  MAIN_STATS,
  availablePoints,
  baseStats,
  caracCost,
  derivedFromCaracs,
  hitPoints,
  type Breed,
  type MainStat,
} from './rules';
import { ELEMENTS, STATS, type Element, type StatKey } from './stats';

export type StatSource =
  | { kind: 'base' }
  | { kind: 'caracs' }
  | { kind: 'scrolls' }
  | { kind: 'derived'; from: MainStat }
  | { kind: 'slot'; slot: SlotKey; itemId: number; exo: boolean }
  | { kind: 'set'; setId: number; pieces: number }
  | { kind: 'extra'; label: string };

export interface Contribution {
  source: StatSource;
  value: number;
}

export interface LineResult {
  line: number;
  stat: StatKey;
  min: number;
  max: number;
  value: number;
  /** Jet saisi (sinon jet parfait). */
  rolled: boolean;
  /** Au-delà du jet parfait. */
  over: boolean;
}

export interface SlotResult {
  slot: SlotKey;
  itemId: number;
  /** null : objet absent des données, ignoré dans les totaux. */
  item: Item | null;
  lines: LineResult[];
  exos: Exo[];
  condition: ConditionResult | null;
}

export interface ActiveSet {
  setId: number;
  name: string;
  /** Objets distincts équipés de cette panoplie. */
  pieces: number;
  itemIds: number[];
  bonus: SetBonus | null;
}

export type WarningCode =
  | 'points'
  | 'resPctCap'
  | 'apCap'
  | 'mpCap'
  | 'rangeCap'
  | 'exoCap'
  | 'duplicate'
  | 'missingItem'
  | 'rollMismatch'
  | 'condition'
  | 'unknownBreed';

export interface BuildWarning {
  code: WarningCode;
  message: string;
  slot?: SlotKey;
  stat?: StatKey;
}

export interface BuildResult {
  /** Valeurs finales par stat, dérivés des caracs compris (Initiative, Tacle…). */
  totals: Record<StatKey, number>;
  /** Contributions non nulles, dans l'ordre de calcul. */
  breakdown: Record<StatKey, Contribution[]>;
  derived: {
    hp: number;
    /** Dommages de l'élément + Dommages génériques, comme DofusBook les affiche. */
    shownDamage: Record<Element, number>;
    /** Carac + Puissance. */
    effectiveForDamage: Record<(typeof ELEMENTAL_STATS)[number], number>;
    /** % de résistance plafonnés (règle non vérifiée). */
    resPctCapped: Record<Element, number>;
  };
  points: { spent: number; available: number; byStat: Record<MainStat, number> };
  sets: ActiveSet[];
  slots: Partial<Record<SlotKey, SlotResult>>;
  warnings: BuildWarning[];
}

export const ELEMENT_DAMAGE: Record<Element, StatKey> = {
  neutral: 'dmgNeutral',
  earth: 'dmgEarth',
  fire: 'dmgFire',
  water: 'dmgWater',
  air: 'dmgAir',
};

export const ELEMENT_RES_PCT: Record<Element, StatKey> = {
  neutral: 'resPctNeutral',
  earth: 'resPctEarth',
  fire: 'resPctFire',
  water: 'resPctWater',
  air: 'resPctAir',
};

const STAT_KEYS = Object.keys(STATS) as StatKey[];

export type EngineDataset = Pick<Dataset, 'itemById' | 'setById'>;

export function computeBuild(build: Build, dataset: EngineDataset, breeds: readonly Breed[] = []): BuildResult {
  const totals = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as Record<StatKey, number>;
  const breakdown = Object.fromEntries(STAT_KEYS.map((key) => [key, []])) as unknown as Record<StatKey, Contribution[]>;
  const warnings: BuildWarning[] = [];
  const add = (stat: StatKey, value: number, source: StatSource) => {
    if (value === 0) return;
    totals[stat] += value;
    breakdown[stat].push({ source, value });
  };

  const { level, breedId, subscriber } = build.character;
  for (const [stat, value] of Object.entries(baseStats(level)) as Array<[StatKey, number]>) add(stat, value, { kind: 'base' });
  for (const stat of MAIN_STATS) {
    add(stat, build.caracs.base[stat], { kind: 'caracs' });
    add(stat, build.caracs.scrolls[stat], { kind: 'scrolls' });
  }

  // Objets
  const slots: Partial<Record<SlotKey, SlotResult>> = {};
  const equipped: Array<{ slot: SlotKey; item: Item }> = [];
  for (const slot of SLOT_KEYS) {
    const entry = build.slots[slot];
    if (!entry) continue;
    const item = dataset.itemById.get(entry.itemId) ?? null;
    slots[slot] = { slot, itemId: entry.itemId, item, lines: [], exos: entry.exos, condition: null };
    if (!item) {
      warnings.push({ code: 'missingItem', slot, message: `${SLOT_LABELS[slot]} : ${entry.itemName} (${entry.itemId}) absent des données, ignoré.` });
      continue;
    }
    equipped.push({ slot, item });
    const rolls = new Map<number, number>();
    for (const roll of entry.rolls) {
      if (rollMatches(roll, item)) rolls.set(roll.line, roll.value);
      else warnings.push({ code: 'rollMismatch', slot, stat: roll.stat, message: rollMismatchMessage(slot, item, roll) });
    }
    const source: StatSource = { kind: 'slot', slot, itemId: item.id, exo: false };
    slots[slot]!.lines = item.lines.map((line, index) => {
      const rolled = rolls.get(index);
      const value = rolled ?? line.max;
      add(line.stat, value, source);
      return { line: index, stat: line.stat, min: line.min, max: line.max, value, rolled: rolled !== undefined, over: value > line.max };
    });
    for (const exo of entry.exos) add(exo.stat, exo.value, { kind: 'slot', slot, itemId: item.id, exo: true });
  }

  const seen = new Map<number, SlotKey>();
  for (const { slot, item } of equipped) {
    const first = seen.get(item.id);
    if (first) {
      warnings.push({ code: 'duplicate', slot, message: `${item.name} est porté deux fois (${SLOT_LABELS[first]}, ${SLOT_LABELS[slot]}) : règle non vérifiée, la panoplie ne le compte qu'une fois.` });
    } else seen.set(item.id, slot);
  }

  // Panoplies : objets distincts, palier exact
  const sets: ActiveSet[] = [];
  const bySet = new Map<number, Set<number>>();
  for (const { item } of equipped) {
    if (item.setId === null) continue;
    const ids = bySet.get(item.setId) ?? new Set<number>();
    ids.add(item.id);
    bySet.set(item.setId, ids);
  }
  for (const [setId, ids] of bySet) {
    const set = dataset.setById.get(setId);
    const pieces = ids.size;
    const bonus = set?.bonuses.find((b) => b.pieces === pieces) ?? null;
    sets.push({ setId, name: set?.name ?? `Panoplie ${setId}`, pieces, itemIds: [...ids], bonus });
    for (const line of bonus?.lines ?? []) add(line.stat, line.max, { kind: 'set', setId, pieces });
  }

  for (const extra of build.extras) add(extra.stat, extra.value, { kind: 'extra', label: extra.label });

  // Dérivés : sur les caracs finales
  const caracs = Object.fromEntries(MAIN_STATS.map((stat) => [stat, totals[stat]])) as Record<MainStat, number>;
  for (const { stat, from, value } of derivedFromCaracs(caracs)) add(stat, value, { kind: 'derived', from });

  // Points de caracs
  const breed = breedId === null ? undefined : breeds.find((b) => b.id === breedId);
  if (breedId !== null && !breed) {
    warnings.push({ code: 'unknownBreed', message: `Classe ${breedId} inconnue : coûts des caracs communs à toutes les classes.` });
  }
  const costs = breed?.statCosts ?? DEFAULT_STAT_COSTS;
  const byStat = Object.fromEntries(MAIN_STATS.map((stat) => [stat, caracCost(build.caracs.base[stat], costs[stat])])) as Record<MainStat, number>;
  const spent = MAIN_STATS.reduce((sum, stat) => sum + byStat[stat], 0);
  const available = availablePoints(level);
  if (spent > available) {
    warnings.push({ code: 'points', message: `${spent} points de caracs dépensés pour ${available} disponibles.` });
  }

  // Plafonds : avertissements seulement
  for (const element of ELEMENTS) {
    const stat = ELEMENT_RES_PCT[element];
    if (totals[stat] > CAPS.resPct) {
      warnings.push({ code: 'resPctCap', stat, message: `${STATS[stat].label} : ${totals[stat]} %, plafonné à ${CAPS.resPct} % en combat (règle non vérifiée).` });
    }
  }
  const caps: Array<[WarningCode, StatKey, number]> = [['apCap', 'ap', CAPS.ap], ['mpCap', 'mp', CAPS.mp], ['rangeCap', 'range', CAPS.range]];
  for (const [code, stat, cap] of caps) {
    if (totals[stat] > cap) {
      warnings.push({ code, stat, message: `${STATS[stat].label} : ${totals[stat]}, au-delà du plafond de ${cap} (règle non vérifiée).` });
    }
  }
  for (const stat of ['ap', 'mp', 'range'] as const) {
    const exoSlots = equipped.filter(({ slot }) => build.slots[slot]!.exos.some((exo) => exo.stat === stat && exo.value > 0)).map(({ slot }) => slot);
    if (exoSlots.length > 1) {
      warnings.push({ code: 'exoCap', stat, message: `${STATS[stat].label} : ${exoSlots.length} exos (${exoSlots.map((slot) => SLOT_LABELS[slot]).join(', ')}), un seul compte en jeu (règle non vérifiée).` });
    }
  }

  // Conditions, sur les totaux finaux
  const setBonusCount = sets.filter((set) => set.pieces >= 2).length;
  const context = { stat: (key: StatKey) => totals[key], setBonusCount, subscriber };
  for (const { slot, item } of equipped) {
    if (!item.conditions) continue;
    const result = evaluateCondition(item.conditions, context);
    slots[slot]!.condition = result;
    if (result.status === 'non remplie') {
      warnings.push({ code: 'condition', slot, message: `${SLOT_LABELS[slot]} : conditions de ${item.name} non remplies.` });
    }
  }

  return {
    totals,
    breakdown,
    derived: {
      hp: hitPoints(level, totals.vitality),
      shownDamage: Object.fromEntries(ELEMENTS.map((e) => [e, totals[ELEMENT_DAMAGE[e]] + totals.damage])) as Record<Element, number>,
      effectiveForDamage: Object.fromEntries(ELEMENTAL_STATS.map((s) => [s, totals[s] + totals.power])) as BuildResult['derived']['effectiveForDamage'],
      resPctCapped: Object.fromEntries(ELEMENTS.map((e) => [e, Math.min(totals[ELEMENT_RES_PCT[e]], CAPS.resPct)])) as Record<Element, number>,
    },
    points: { spent, available, byStat },
    sets,
    slots,
    warnings,
  };
}
