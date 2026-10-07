// Dégâts d'arme et de sort. Une seule formule, celle de DofusBook, retrouvée exactement sur
// test/fixtures/dofusbook/damage-reference.json : elle remplace les deux implémentations dafous / guidedofus du PLAN §2.8.
import type { WeaponFm } from './build/types';
import type { Hit, Weapon } from './dataset';
import type { BuildResult } from './engine';
import { classifyEffect, type EffectElement, type EffectRef, type SpellEffect, type SpellLevel } from './spells';
import { ELEMENT_LABELS, ELEMENTS, type Element } from './stats';

/** Maîtrise d'arme « normale » de DofusBook, ajoutée à la Puissance pour une arme. */
export const WEAPON_SKILL = 300;

/** Stats de l'attaquant utiles aux dégâts, lues dans le résultat de computeBuild. */
export interface AttackerStats {
  /** Carac de l'élément + Puissance (Force pour neutre et terre). */
  effective: Record<Element, number>;
  /** Dommages de l'élément + Dommages génériques. */
  fixed: Record<Element, number>;
  critDamage: number;
  pctWeapon: number;
  pctSpells: number;
  pctMelee: number;
  pctRanged: number;
  /** % Critique. */
  critical: number;
}

export function attackerFromBuild(result: BuildResult): AttackerStats {
  const e = result.derived.effectiveForDamage;
  const t = result.totals;
  return {
    effective: { neutral: e.strength, earth: e.strength, fire: e.intelligence, water: e.chance, air: e.agility },
    fixed: { ...result.derived.shownDamage },
    critDamage: t.dmgCritical,
    pctWeapon: t.dmgPctWeapon,
    pctSpells: t.dmgPctSpells,
    pctMelee: t.dmgPctMelee,
    pctRanged: t.dmgPctRanged,
    critical: t.critical,
  };
}

export interface TargetResistances {
  fixed: Partial<Record<Element, number>>;
  pct: Partial<Record<Element, number>>;
}

export interface DamageOptions {
  /** Arme seulement, WEAPON_SKILL par défaut. */
  weaponSkill?: number;
  /** Malus % saisi à la main (origine du « malus 10 % » de DofusBook non déterminée). */
  malusPct?: number;
  /** Non vérifié : % mêlée ou distance ajouté au % dommages d'armes / de sorts. DofusBook ne l'applique pas par défaut. */
  distance?: 'melee' | 'ranged' | null;
  /** Non vérifié : résistances fixes puis %, après la formule DofusBook. */
  target?: TargetResistances | null;
  /** Non vérifié : lancers par tour (≤ maxCastPerTurn), multiplie la moyenne d'un lancer. 1 par défaut, comme DofusBook. */
  castsPerTurn?: number;
}

export interface Range {
  min: number;
  max: number;
}

export interface DamageLine {
  kind: 'damage' | 'steal';
  element: Element;
  /** Index dans `hits` de l'arme ou dans `effects` du niveau de sort. */
  index: number;
  dice: Range;
  critDice: Range | null;
  normal: Range;
  critical: Range | null;
  /** Soin du vol : moitié de chaque ligne, arrondie à l'inférieur. */
  heal: Range | null;
  critHeal: Range | null;
}

/** Total d'un coup ou d'un lancer et ses moyennes. */
export interface DamageTotal {
  normal: Range;
  critical: Range | null;
  heal: Range;
  critHeal: Range | null;
  /** Moyennes d'un lancer : normale × (1 − p) + critique × p, arrondies ; perTurn = perCast × castsPerTurn. */
  average: { perCast: number; perAp: number; healPerCast: number; perTurn: number };
}

interface DamageDetail {
  lines: DamageLine[];
  /** Probabilité de critique en %, 0 si l'attaque ne peut pas faire de critique. */
  critChance: number;
  apCost: number;
  /** Hypothèses non vérifiées en jeu ni sur DofusBook, actives dans ce calcul. */
  unverified: string[];
}

export type AttackDamage = DamageDetail & DamageTotal;

export interface SpellDamage extends DamageDetail {
  /** null quand des lignes s'excluent (état, cible alliée…) : leur somme ne serait pas un lancer réel. */
  total: DamageTotal | null;
  /** Raison de l'absence de total, à afficher. */
  noTotal: string | null;
}

export interface DamageContext {
  weapon: boolean;
  attacker: AttackerStats;
  options: DamageOptions;
}

/** ⌊(⌊base × mult⌋ + fixes [+ Do Critique]) × (1 + %) × (1 − malus)⌋, en entiers pour éviter les erreurs d'arrondi. */
export function damageValue(base: number, element: Element, critical: boolean, ctx: DamageContext): number {
  const { attacker: a, options: o } = ctx;
  const mult = 100 + a.effective[element] + (ctx.weapon ? (o.weaponSkill ?? WEAPON_SKILL) : 0);
  const flat = Math.floor((base * mult) / 100) + a.fixed[element] + (critical ? a.critDamage : 0);
  const distance = o.distance === 'melee' ? a.pctMelee : o.distance === 'ranged' ? a.pctRanged : 0;
  const pct = (ctx.weapon ? a.pctWeapon : a.pctSpells) + distance;
  const value = Math.floor((flat * (100 + pct) * (100 - (o.malusPct ?? 0))) / 10000);
  return Math.max(0, o.target ? applyResistances(value, element, o.target) : value);
}

/** Non vérifié : résistances fixes soustraites, puis %. */
export function applyResistances(damage: number, element: Element, target: TargetResistances): number {
  const fixed = target.fixed[element] ?? 0;
  const pct = target.pct[element] ?? 0;
  return Math.max(0, Math.floor(((damage - fixed) * (100 - pct)) / 100));
}

export function stealHeal(damage: number): number {
  return Math.floor(damage / 2);
}

export function critChance(baseRate: number, critical: number): number {
  return Math.max(0, Math.min(100, baseRate + critical));
}

/** Non vérifié : meilleur (ou pire) élément = celui qui donne le plus (ou le moins) de dégâts sur ce jet. */
function pickElement(choice: 'best' | 'worst', dice: Range, ctx: DamageContext): Element {
  const score = (e: Element) => damageValue(dice.min, e, false, ctx) + damageValue(dice.max, e, false, ctx);
  let pick: Element = ELEMENTS[0];
  for (const e of ELEMENTS) {
    if (choice === 'best' ? score(e) > score(pick) : score(e) < score(pick)) pick = e;
  }
  return pick;
}

function line(kind: DamageLine['kind'], element: Element, index: number, dice: Range, critDice: Range | null, ctx: DamageContext): DamageLine {
  const value = (r: Range, crit: boolean): Range => ({ min: damageValue(r.min, element, crit, ctx), max: damageValue(r.max, element, crit, ctx) });
  const normal = value(dice, false);
  const critical = critDice && value(critDice, true);
  const half = (r: Range): Range => ({ min: stealHeal(r.min), max: stealHeal(r.max) });
  return {
    kind, element, index, dice, critDice, normal, critical,
    heal: kind === 'steal' ? half(normal) : null,
    critHeal: kind === 'steal' && critical ? half(critical) : null,
  };
}

const sum = (ranges: Range[]): Range => ranges.reduce((acc, r) => ({ min: acc.min + r.min, max: acc.max + r.max }), { min: 0, max: 0 });

/** Moyenne d'un lancer, ×2 pour rester en entiers jusqu'à l'arrondi final. */
function average(normal: Range, critical: Range | null, chance: number): number {
  const p = critical ? chance : 0;
  const n = normal.min + normal.max;
  const c = critical ? critical.min + critical.max : 0;
  return (n * (100 - p) + c * p) / 200;
}

function optionNotes(ctx: DamageContext): string[] {
  const o = ctx.options;
  const notes: string[] = [];
  if (o.malusPct) notes.push(`Malus de ${o.malusPct} % saisi à la main (origine non déterminée).`);
  if (o.distance) notes.push(`% dommages ${o.distance === 'melee' ? 'mêlée' : 'distance'} ajouté au % dommages ${ctx.weapon ? "d'armes" : 'aux sorts'}.`);
  if (o.target) notes.push('Résistances de la cible : fixes puis %.');
  const skill = o.weaponSkill ?? WEAPON_SKILL;
  if (ctx.weapon && skill !== WEAPON_SKILL) notes.push(`Maîtrise d'arme ${skill} au lieu de ${WEAPON_SKILL}.`);
  return notes;
}

const canCrit = (lines: DamageLine[]) => lines.length > 0 && lines.every((l) => l.critical);

function total(lines: DamageLine[], p: number, apCost: number, ctx: DamageContext, unverified: string[]): DamageTotal {
  const crit = canCrit(lines);
  const normal = sum(lines.map((l) => l.normal));
  const critical = crit ? sum(lines.map((l) => l.critical!)) : null;
  const steals = lines.filter((l) => l.kind === 'steal');
  const heal = sum(steals.map((l) => l.heal!));
  const critHeal = crit ? sum(steals.map((l) => l.critHeal!)) : null;
  const raw = average(normal, critical, p);
  const casts = ctx.options.castsPerTurn ?? 1;
  if (casts !== 1) unverified.push(`${casts} lancers par tour : moyenne d'un lancer multipliée.`);
  return {
    normal,
    critical,
    heal,
    critHeal,
    average: {
      perCast: Math.round(raw),
      perAp: apCost > 0 ? Math.round(raw / apCost) : 0,
      healPerCast: Math.round(average(heal, critHeal, p)),
      perTurn: Math.round(raw * casts),
    },
  };
}

/**
 * Un coup d'arme : lignes de dégâts et de vol (les autres effets sont ignorés), critique = jet + bonus critique de l'arme.
 * FM élémentaire : conversion totale de l'élément des lignes de dégâts (`damage`) ou de vol (`steal`), valeur ignorée.
 */
export function weaponDamage(
  item: { hits: readonly Hit[]; weapon: Weapon | null },
  attacker: AttackerStats,
  options: DamageOptions & { fm?: WeaponFm | null } = {},
): AttackDamage | null {
  const weapon = item.weapon;
  if (!weapon) return null;
  const ctx: DamageContext = { weapon: true, attacker, options };
  const unverified: string[] = [];
  const lines: DamageLine[] = [];
  item.hits.forEach((hit, index) => {
    if (hit.kind !== 'damage' && hit.kind !== 'steal') return;
    const fm = hit.kind === 'damage' ? options.fm?.damage : options.fm?.steal;
    const dice = { min: hit.min, max: hit.max };
    let element: Element;
    if (fm) {
      element = fm.element;
      unverified.push(`FM élémentaire ${ELEMENT_LABELS[fm.element]} ${fm.value} : ligne de ${hit.kind === 'damage' ? 'dégâts' : 'vol'} entièrement convertie.`);
    } else if (hit.element === 'best' || hit.element === null) {
      element = pickElement('best', dice, ctx);
      unverified.push(`Meilleur élément choisi sur les dégâts : ${ELEMENT_LABELS[element]}.`);
    } else element = hit.element;
    const critDice = { min: hit.min + weapon.critBonus, max: hit.max + weapon.critBonus };
    lines.push(line(hit.kind, element, index, dice, critDice, ctx));
  });
  const p = canCrit(lines) ? critChance(weapon.critProbability, attacker.critical) : 0;
  unverified.push(...optionNotes(ctx));
  return { lines, critChance: p, apCost: weapon.apCost, ...total(lines, p, weapon.apCost, ctx, unverified), unverified };
}

const signature = (e: SpellEffect) => [e.effectId, e.targetMask, e.triggers, e.duration, e.zone.shape, e.zone.param1, e.zone.param2].join('|');

/**
 * Effet critique correspondant : même rang parmi les effets de même signature (effectId, cible, déclencheurs, durée, zone),
 * sinon même rang parmi les effets de même effectId. Les deux listes ne sont pas toujours rangées dans le même ordre.
 */
export function criticalCounterpart(level: SpellLevel, index: number): SpellEffect | null {
  const effect = level.effects[index];
  if (!effect) return null;
  const sameRank = (same: (e: SpellEffect) => boolean) => {
    const occurrence = level.effects.slice(0, index).filter(same).length;
    return level.criticalEffects.filter(same)[occurrence] ?? null;
  };
  const key = signature(effect);
  return sameRank((e) => signature(e) === key) ?? sameRank((e) => e.effectId === effect.effectId);
}

/** La ligne touche un ennemi sans condition : masque avec « A » et aucun critère d'état, de monstre ou de PV (jeton chiffré). */
export function hitsEnemyUnconditionally(targetMask: string): boolean {
  const tokens = targetMask.split(',');
  return tokens.includes('A') && !tokens.some((t) => /\d/.test(t));
}

function diceOf(effect: SpellEffect, bonus: number): Range {
  return { min: effect.diceNum + bonus, max: Math.max(effect.diceNum, effect.diceSide) + bonus };
}

/**
 * Un lancer de sort : lignes de dégâts et de vol du niveau, critique par `criticalEffects`.
 * `baseBonus` : dégâts de base ajoutés aux dés (charges × chargeBonus).
 * Pas de total quand une ligne est conditionnelle ou ne vise pas les ennemis : ces lignes s'excluent (cible alliée ou ennemie,
 * état du lanceur ou de la cible) et leur somme ne correspond à aucun lancer.
 */
export function spellDamage(
  level: SpellLevel,
  effects: ReadonlyMap<number, EffectRef>,
  attacker: AttackerStats,
  options: DamageOptions & { baseBonus?: number } = {},
): SpellDamage {
  const ctx: DamageContext = { weapon: false, attacker, options };
  const unverified: string[] = [];
  const bonus = options.baseBonus ?? 0;
  const lines: DamageLine[] = [];
  level.effects.forEach((effect, index) => {
    const cls = classifyEffect(effects.get(effect.effectId));
    if (!cls.computable || (cls.kind !== 'damage' && cls.kind !== 'steal')) return;
    const dice = diceOf(effect, bonus);
    const crit = criticalCounterpart(level, index);
    const element = concreteElement(cls.element, dice, ctx, unverified);
    lines.push(line(cls.kind, element, index, dice, crit && diceOf(crit, bonus), ctx));
  });
  unverified.push(...optionNotes(ctx));
  const p = level.criticalEffects.length && canCrit(lines) ? critChance(level.criticalHitProbability, attacker.critical) : 0;
  const detail = { lines, critChance: p, apCost: level.apCost, unverified };
  const exclusive = lines.length > 1 && lines.some((l) => !hitsEnemyUnconditionally(level.effects[l.index]!.targetMask));
  if (exclusive) {
    const noTotal = 'Pas de total ni de moyenne : certaines lignes dépendent d\'un état, d\'une cible précise ou ne visent pas les ennemis, elles ne s\'appliquent pas toutes au même lancer.';
    return { ...detail, total: null, noTotal };
  }
  if (lines.length > 1) unverified.push('Total et moyennes : somme de toutes les lignes (zones, déclencheurs et effets différés compris).');
  return { ...detail, total: total(lines, p, level.apCost, ctx, unverified), noTotal: null };
}

function concreteElement(element: EffectElement | null, dice: Range, ctx: DamageContext, unverified: string[]): Element {
  if (element !== 'best' && element !== 'worst' && element !== null) return element;
  const choice = element ?? 'best';
  const picked = pickElement(choice, dice, ctx);
  unverified.push(`${choice === 'best' ? 'Meilleur' : 'Pire'} élément choisi sur les dégâts : ${ELEMENT_LABELS[picked]}.`);
  return picked;
}
