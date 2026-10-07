// Importé par scripts/build-data.mjs (type stripping de Node 22) : imports de types uniquement.
import type { ConditionKey, HitElement, HitKind, SlotKind, StatKey, TextTag } from './stats';

export const DATASET_SCHEMA = 1;

/** Ligne calculable. Valeur fixe : min = max. Malus : min = -40, max = -11 (max = meilleur jet). */
export interface Line {
  stat: StatKey;
  min: number;
  max: number;
}

/** Coup d'arme. Valeurs en absolu (« -1 PA » → apLoss 1). */
export interface Hit {
  kind: HitKind;
  element: HitElement | null;
  min: number;
  max: number;
}

/** Ligne d'affichage seul : texte du jeu tel quel. */
export interface TextLine {
  tag: TextTag;
  text: string;
  /** Pour `spellModifier` : id du sort modifié. */
  spellId?: number;
}

export type Condition =
  | { kind: 'and' | 'or'; children: Condition[] }
  | { kind: 'test'; key: ConditionKey; operator: '<' | '>' | '='; value: number };

export interface Weapon {
  apCost: number;
  minRange: number;
  maxRange: number;
  /** Brut dofusdude, sémantique non tranchée (30 sur des armes bas niveau, 5 sur d'autres). */
  critProbability: number;
  critBonus: number;
  maxCastPerTurn: number;
}

export interface Ingredient {
  itemId: number;
  quantity: number;
}

export interface Item {
  id: number;
  name: string;
  level: number;
  typeId: number;
  /** null = hors joueur (compagnon, percepteur, outil…), masqué par défaut. */
  slot: SlotKind | null;
  iconId: number;
  setId: number | null;
  pods: number;
  description: string;
  /** Lignes calculables, dans l'ordre du jeu : les jets d'un stuff s'indexent dessus. */
  lines: Line[];
  hits: Hit[];
  texts: TextLine[];
  weapon: Weapon | null;
  conditions: Condition | null;
  recipe: Ingredient[];
}

export interface ItemType {
  id: number;
  name: string;
  slot: SlotKind | null;
}

export interface SetBonus {
  pieces: number;
  lines: Line[];
  texts: TextLine[];
}

export interface ItemSet {
  id: number;
  name: string;
  level: number;
  /** Pièces présentes dans le dataset (les cosmétiques sont écartés). */
  itemIds: number[];
  /** Triés par nombre de pièces croissant ; seuls les paliers qui donnent quelque chose. */
  bonuses: SetBonus[];
}

export interface DatasetMeta {
  schema: number;
  source: string;
  channel: string;
  lang: string;
  gameVersion: string;
  syncedAt: string;
  counts: {
    items: number;
    playerItems: number;
    excludedItems: number;
    sets: number;
    droppedSets: number;
    ignoredSetItemIds: number;
  };
}

/** Contenu de public/data/items.json. */
export interface ItemsFile {
  types: ItemType[];
  items: Item[];
}

export interface RawDataset {
  meta: DatasetMeta;
  types: ItemType[];
  items: Item[];
  sets: ItemSet[];
}

export interface Dataset extends RawDataset {
  itemById: ReadonlyMap<number, Item>;
  setById: ReadonlyMap<number, ItemSet>;
  typeById: ReadonlyMap<number, ItemType>;
  itemsBySlot: ReadonlyMap<SlotKind, Item[]>;
  /** Objets dont le nom contient tous les mots de la requête, accents et casse ignorés. */
  search(query: string): Item[];
}

const ICON_BASE = 'https://api.dofusdu.de/dofus3/v1/img/item';

export function itemIconUrl(iconId: number, size: 64 | 128 = 64): string {
  return `${ICON_BASE}/${iconId}-${size}.png`;
}

/** Minuscules sans accents ; œ et æ n'ont pas de décomposition Unicode, d'où le remplacement explicite. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function createDataset(raw: RawDataset): Dataset {
  const itemById = new Map(raw.items.map((item) => [item.id, item]));
  const setById = new Map(raw.sets.map((set) => [set.id, set]));
  const typeById = new Map(raw.types.map((type) => [type.id, type]));
  const itemsBySlot = new Map<SlotKind, Item[]>();
  for (const item of raw.items) {
    if (!item.slot) continue;
    const list = itemsBySlot.get(item.slot);
    if (list) list.push(item);
    else itemsBySlot.set(item.slot, [item]);
  }
  const names = raw.items.map((item) => normalizeText(item.name));

  return {
    ...raw,
    itemById,
    setById,
    typeById,
    itemsBySlot,
    search(query) {
      const words = normalizeText(query).split(/\s+/).filter(Boolean);
      if (words.length === 0) return raw.items;
      return raw.items.filter((_, i) => words.every((word) => names[i]!.includes(word)));
    },
  };
}
