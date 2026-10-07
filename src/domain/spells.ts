// Sorts de classe (public/data/spells.json, DofusDB + valeurs de la release) : index, grades, texte et nature des effets.
import { parseGameText } from './format';
import { ELEMENTS, type Element } from './stats';

export interface SpellZone {
  shape: number;
  param1: number;
  param2: number;
}

/** Effet d'un niveau de sort : #1 = diceNum, #2 = diceSide (0 = valeur unique), #3 = value. */
export interface SpellEffect {
  effectId: number;
  /** -1 sans élément, 0 neutre, 1 terre, 2 feu, 3 eau, 4 air. */
  element: number;
  diceNum: number;
  diceSide: number;
  value: number;
  duration: number;
  targetMask: string;
  triggers: string;
  zone: SpellZone;
}

export interface SpellLevel {
  id: number;
  grade: number;
  minPlayerLevel: number;
  apCost: number;
  minRange: number;
  range: number;
  rangeCanBeBoosted: boolean;
  criticalHitProbability: number;
  maxCastPerTurn: number;
  maxCastPerTarget: number;
  castInLine: boolean;
  castInDiagonal: boolean;
  castTestLos: boolean;
  effects: SpellEffect[];
  /** Vide quand le sort ne peut pas faire de coup critique. */
  criticalEffects: SpellEffect[];
}

export interface Spell {
  id: number;
  breedId: number;
  name: string;
  description: string;
  img: string;
  levels: SpellLevel[];
}

/** Référentiel DofusDB `effects`, par effectId. */
export interface EffectRef {
  characteristic: number;
  elementId: number;
  isInPercent: boolean;
  category: number;
  useDice: boolean;
  active: boolean;
  /** Gabarit Ankama : « #1{{~1~2 à }}#2 dommages Air ». */
  description: string;
}

export interface SpellsFile {
  source: string;
  fetchedAt: string;
  levelValues: { release: string; overridden: number; fromDofusDbOnly: number };
  effects: Record<string, EffectRef>;
  spells: Spell[];
}

/** Ce que spells.ts lit d'une classe de breeds.json. */
export interface BreedSpellIds {
  id: number;
  name?: string;
  spellIds: number[];
  /** Paires [sort de base, variante]. */
  spellVariants?: Array<[number, number]>;
}

export interface SpellPair {
  base: Spell;
  variant: Spell | null;
}

export interface SpellBook {
  release: string;
  effects: ReadonlyMap<number, EffectRef>;
  spellById: ReadonlyMap<number, Spell>;
  /** Sorts de la classe dans l'ordre de breeds.json, chacun avec sa variante. */
  pairsOf(breedId: number): SpellPair[];
}

export function createSpellBook(file: SpellsFile, breeds: readonly BreedSpellIds[]): SpellBook {
  const effects = new Map(Object.entries(file.effects).map(([id, ref]) => [Number(id), ref]));
  const spellById = new Map(file.spells.map((spell) => [spell.id, spell]));
  const pairs = new Map(breeds.map((breed) => [breed.id, spellPairs(breed, spellById)]));
  return { release: file.levelValues.release, effects, spellById, pairsOf: (breedId) => pairs.get(breedId) ?? [] };
}

/** Chargement par une fonction fournie (fetch côté app) : le domaine ne lit ni disque ni réseau. */
export async function loadSpellBook(fetchJson: (name: string) => Promise<unknown>): Promise<SpellBook> {
  const [spells, breeds] = await Promise.all([fetchJson('spells.json'), fetchJson('breeds.json')]);
  return createSpellBook(spells as SpellsFile, (breeds as { breeds: BreedSpellIds[] }).breeds);
}

export function spellPairs(breed: BreedSpellIds, spellById: ReadonlyMap<number, Spell>): SpellPair[] {
  const variantOf = new Map<number, number>();
  for (const [a, b] of breed.spellVariants ?? []) {
    variantOf.set(a, b);
    variantOf.set(b, a);
  }
  const out: SpellPair[] = [];
  for (const id of breed.spellIds) {
    const base = spellById.get(id);
    if (!base) continue;
    const variantId = variantOf.get(id);
    out.push({ base, variant: (variantId !== undefined && spellById.get(variantId)) || null });
  }
  return out;
}

/** Grade le plus haut accessible à ce niveau de personnage ; null avant le premier. */
export function levelFor(spell: Spell, characterLevel: number): SpellLevel | null {
  let best: SpellLevel | null = null;
  for (const level of spell.levels) {
    if (level.minPlayerLevel <= characterLevel && (!best || level.grade > best.grade)) best = level;
  }
  return best;
}

/** Bonus de dégâts de base par charge : effet 293 qui vise le sort lui-même (Flèche Glacée +5, Flèche d'Immobilisation +2). */
export function chargeBonus(spell: Spell, level: SpellLevel): number {
  return level.effects.find((e) => e.effectId === 293 && e.diceNum === spell.id)?.value ?? 0;
}

// --- Texte -----------------------------------------------------------------

export interface RenderOptions {
  /** Nom d'un sort cité par un modificateur (« #1 : +5 dégâts de base », #1 = id du sort). */
  spellName?: (spellId: number) => string | undefined;
}

/** Valeurs d'un effet : #2 n'existe que si le dé a une borne haute distincte. */
export function effectParams(effect: Pick<SpellEffect, 'diceNum' | 'diceSide' | 'value'>): { p1: number; p2: number | null; p3: number } {
  return { p1: effect.diceNum, p2: effect.diceSide > effect.diceNum ? effect.diceSide : null, p3: effect.value };
}

/** Rendu du gabarit Ankama : #1 #2 #3, {{~1~2 texte}} (si #1 et #2), {{~ps}} (pluriel), {{~zs}} (pluriel de zéro). */
export function renderEffect(effect: SpellEffect, ref: EffectRef | undefined, options: RenderOptions = {}): string {
  if (!ref) return `Effet ${effect.effectId}`;
  const { p1, p2, p3 } = effectParams(effect);
  const top = p2 ?? p1;
  // « #1 : … » vise un sort par son id, y compris hors de la catégorie 3 (effets 1036, 1045).
  const namesSpell = ref.category === 3 || ref.description.startsWith('#1 :');
  const first = namesSpell ? (options.spellName?.(p1) ?? String(p1)) : String(p1);
  const text = ref.description
    .replace(/\{\{~1~2([^}]*)\}\}/g, (_, text: string) => (p2 === null ? '' : text))
    .replace(/\{\{~p([^}]*)\}\}/g, (_, text: string) => (Math.abs(top) > 1 ? text : ''))
    .replace(/\{\{~z([^}]*)\}\}/g, (_, text: string) => (top === 0 ? text : ''))
    .replace(/#([123])/g, (_, n: string) => (n === '1' ? first : n === '2' ? (p2 === null ? '' : String(p2)) : String(p3)));
  return parseGameText(text).map((part) => (part.kind === 'text' ? part.text : part.name)).join('').trim();
}

// --- Nature des effets -------------------------------------------------------

export type EffectKind = 'damage' | 'steal' | 'heal' | 'other';

/** `best` / `worst` : meilleur ou pire élément du lanceur, choisi en combat. */
export type EffectElement = Element | 'best' | 'worst';

export interface EffectClass {
  kind: EffectKind;
  element: EffectElement | null;
  /** Jet de dés élémentaire que la formule de dégâts sait calculer (dégâts et vols ; soins hors périmètre). */
  computable: boolean;
}

const ELEMENT_BY_WORD: Record<string, EffectElement> = {
  Neutre: 'neutral', Terre: 'earth', Feu: 'fire', Eau: 'water', Air: 'air',
  'du meilleur élément': 'best', 'du pire élément': 'worst',
};
const KIND_BY_WORD: Record<string, EffectKind> = { dommages: 'damage', vol: 'steal', soins: 'heal' };

// Jets « X à Y dommages|vol|soins <élément> ». La catégorie 2 seule ne suffit pas : poussées et déplacements en sont aussi.
const VALUE_PATTERN = /^#1\{\{~1~2 à \}\}#2 (dommages|vol|soins) (Neutre|Terre|Feu|Eau|Air|du meilleur élément|du pire élément)$/;

/** Nature d'un effet d'après le référentiel (catégorie, dés, gabarit, élément). */
export function classifyEffect(ref: EffectRef | undefined): EffectClass {
  if (!ref) return { kind: 'other', element: null, computable: false };
  const match = ref.category === 2 && ref.useDice ? VALUE_PATTERN.exec(ref.description) : null;
  if (match) {
    const word = ELEMENT_BY_WORD[match[2]!]!;
    const kind = KIND_BY_WORD[match[1]!]!;
    // L'élément du référentiel prime ; le texte départage « meilleur / pire élément » (elementId -1 ou 5).
    const element = word === 'best' || word === 'worst' ? word : (ELEMENTS[ref.elementId] ?? word);
    return { kind, element, computable: kind !== 'heal' };
  }
  // « Soin : x% des PV max », « Soin sur l'attaquant : x% des dommages ».
  if (/^Soin (:|sur )/.test(ref.description)) return { kind: 'heal', element: null, computable: false };
  // Dégâts en % (PV du lanceur, PV érodés, dommages subis, PM restants) : hors formule.
  if (ref.category === 2 && /^(Dommages|#1\{\{~1~2 à \}\}#2 dommages )/.test(ref.description)) {
    return { kind: 'damage', element: ELEMENTS[ref.elementId] ?? null, computable: false };
  }
  return { kind: 'other', element: null, computable: false };
}
