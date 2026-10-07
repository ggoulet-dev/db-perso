import type { MainStat } from '../rules';
import type { Element, SlotKind, StatKey } from '../stats';

export const BUILD_SCHEMA_VERSION = 1;

/** Codes d'emplacement de DofusBook, repris tels quels. */
export const SLOT_KEYS = ['ch', 'ca', 'am', 'a1', 'a2', 'ce', 'bo', 'ar', 'br', 'fa', 'mo', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

export const SLOT_KIND: Record<SlotKey, SlotKind> = {
  ch: 'hat',
  ca: 'cloak',
  am: 'amulet',
  a1: 'ring',
  a2: 'ring',
  ce: 'belt',
  bo: 'boots',
  ar: 'weapon',
  br: 'shield',
  fa: 'pet',
  mo: 'mount',
  d1: 'dofus',
  d2: 'dofus',
  d3: 'dofus',
  d4: 'dofus',
  d5: 'dofus',
  d6: 'dofus',
};

export const SLOT_LABELS: Record<SlotKey, string> = {
  ch: 'Chapeau',
  ca: 'Cape',
  am: 'Amulette',
  a1: 'Anneau 1',
  a2: 'Anneau 2',
  ce: 'Ceinture',
  bo: 'Bottes',
  ar: 'Arme',
  br: 'Bouclier',
  fa: 'Familier',
  mo: 'Monture',
  d1: 'Dofus 1',
  d2: 'Dofus 2',
  d3: 'Dofus 3',
  d4: 'Dofus 4',
  d5: 'Dofus 5',
  d6: 'Dofus 6',
};

/** Jet d'une ligne : `line` = index dans `item.lines`, `stat` sert à détecter un objet modifié. */
export interface Roll {
  line: number;
  stat: StatKey;
  value: number;
}

export interface Exo {
  stat: StatKey;
  value: number;
}

export interface SlotEntry {
  /** ankama_id */
  itemId: number;
  /** Instantané pour l'affichage si l'objet disparaît du dataset. */
  itemName: string;
  /** Ligne absente = jet parfait. */
  rolls: Roll[];
  /** Stats absentes de l'objet. */
  exos: Exo[];
}

/** Bonus hors objet : FM globale importée, bonbon, bonus de guilde… */
export interface Extra {
  label: string;
  stat: StatKey;
  value: number;
}

export interface BuildCharacter {
  breedId: number | null;
  level: number;
  subscriber: boolean;
}

export interface BuildCaracs {
  /** Valeur de carac visée (pas les points dépensés). */
  base: Record<MainStat, number>;
  /** 0..100 */
  scrolls: Record<MainStat, number>;
}

export interface BuildSource {
  kind: 'dofusbook';
  stuffId: number;
  importedAt: string;
  unmapped: string[];
}

/** FM élémentaire d'arme (DofusBook `stuffFm.weapon` / `steal`, ex. « df-100 ») : effet sur les coups non vérifié. */
export interface WeaponElementFm {
  element: Element;
  value: number;
}

export interface WeaponFm {
  damage: WeaponElementFm | null;
  steal: WeaponElementFm | null;
}

export interface Build {
  schemaVersion: typeof BUILD_SCHEMA_VERSION;
  /** Slug, = nom de fichier. */
  id: string;
  name: string;
  /** Version de jeu avec laquelle le stuff a été validé en dernier (ex. « 3.7.3.3 »). */
  dataVersion: string;
  character: BuildCharacter;
  caracs: BuildCaracs;
  slots: Record<SlotKey, SlotEntry | null>;
  extras: Extra[];
  /** Ignorée par le moteur des totaux ; servira aux coups d'arme (phase 3). */
  weaponFm?: WeaponFm;
  notes?: string;
  source?: BuildSource;
  createdAt: string;
  updatedAt: string;
}

export function zeroCaracs(): Record<MainStat, number> {
  return { vitality: 0, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0 };
}

export function emptySlots(): Record<SlotKey, SlotEntry | null> {
  return Object.fromEntries(SLOT_KEYS.map((key) => [key, null])) as Record<SlotKey, SlotEntry | null>;
}

export function createBuild(init: { id: string; name: string; dataVersion: string; now?: string } & Partial<BuildCharacter>): Build {
  const now = init.now ?? new Date().toISOString();
  return {
    schemaVersion: BUILD_SCHEMA_VERSION,
    id: init.id,
    name: init.name,
    dataVersion: init.dataVersion,
    character: { breedId: init.breedId ?? null, level: init.level ?? 200, subscriber: init.subscriber ?? true },
    caracs: { base: zeroCaracs(), scrolls: zeroCaracs() },
    slots: emptySlots(),
    extras: [],
    createdAt: now,
    updatedAt: now,
  };
}
