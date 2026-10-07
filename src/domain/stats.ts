// Importé tel quel par scripts/build-data.mjs (type stripping de Node 22) :
// syntaxe effaçable uniquement, aucun import à l'exécution.

export const STATS = {
  ap: { label: 'PA' },
  mp: { label: 'PM' },
  range: { label: 'Portée' },
  vitality: { label: 'Vitalité' },
  wisdom: { label: 'Sagesse' },
  strength: { label: 'Force' },
  intelligence: { label: 'Intelligence' },
  chance: { label: 'Chance' },
  agility: { label: 'Agilité' },
  initiative: { label: 'Initiative' },
  prospecting: { label: 'Prospection' },
  pods: { label: 'Pods' },
  summons: { label: 'Invocations' },
  critical: { label: '% Critique', percent: true },
  heals: { label: 'Soins' },
  power: { label: 'Puissance' },
  powerTraps: { label: 'Puissance Pièges' },
  lock: { label: 'Tacle' },
  dodge: { label: 'Fuite' },
  apParry: { label: 'Esquive PA' },
  mpParry: { label: 'Esquive PM' },
  apReduction: { label: 'Retrait PA' },
  mpReduction: { label: 'Retrait PM' },
  damage: { label: 'Dommages' },
  dmgNeutral: { label: 'Dommages Neutre' },
  dmgEarth: { label: 'Dommages Terre' },
  dmgFire: { label: 'Dommages Feu' },
  dmgWater: { label: 'Dommages Eau' },
  dmgAir: { label: 'Dommages Air' },
  dmgCritical: { label: 'Dommages Critiques' },
  dmgPushback: { label: 'Dommages Poussée' },
  dmgTraps: { label: 'Dommages Pièges' },
  dmgReflected: { label: 'Dommages Renvoyés' },
  dmgPctMelee: { label: '% Dommages mêlée', percent: true },
  dmgPctRanged: { label: '% Dommages distance', percent: true },
  dmgPctWeapon: { label: "% Dommages d'armes", percent: true },
  dmgPctSpells: { label: '% Dommages aux sorts', percent: true },
  resPctNeutral: { label: '% Résistance Neutre', percent: true },
  resPctEarth: { label: '% Résistance Terre', percent: true },
  resPctFire: { label: '% Résistance Feu', percent: true },
  resPctWater: { label: '% Résistance Eau', percent: true },
  resPctAir: { label: '% Résistance Air', percent: true },
  resPctMelee: { label: '% Résistance mêlée', percent: true },
  resPctRanged: { label: '% Résistance distance', percent: true },
  resPctWeapon: { label: "% Résistance armes", percent: true },
  resPctSpells: { label: '% Résistance sorts', percent: true },
  resFixedNeutral: { label: 'Résistance Neutre' },
  resFixedEarth: { label: 'Résistance Terre' },
  resFixedFire: { label: 'Résistance Feu' },
  resFixedWater: { label: 'Résistance Eau' },
  resFixedAir: { label: 'Résistance Air' },
  resCritical: { label: 'Résistance Critiques' },
  resPushback: { label: 'Résistance Poussée' },
} as const satisfies Record<string, { label: string; percent?: boolean }>;

export type StatKey = keyof typeof STATS;

export const ELEMENTS = ['neutral', 'earth', 'fire', 'water', 'air'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_LABELS: Record<Element, string> = {
  neutral: 'Neutre',
  earth: 'Terre',
  fire: 'Feu',
  water: 'Eau',
  air: 'Air',
};

/** Nature d'un coup d'arme (effets `is_active`). */
export type HitKind =
  | 'damage' | 'steal' | 'heal' | 'apLoss' | 'mpLoss' | 'mpSteal'
  | 'push' | 'pull' | 'advance' | 'kamasSteal';

/** `best` = meilleur élément du porteur. */
export type HitElement = Element | 'best';

/** `spell` : passif de Dofus/trophée avec gabarit `{{spell,id,niveau::Nom}}` ; `spellModifier` : bonus de sort, valeur seulement dans le texte. */
export type TextTag = 'spell' | 'spellModifier' | 'other';

/** Ce qu'une condition d'équipement peut tester au-delà des stats. */
export type ConditionExtraKey = 'setBonus' | 'subscriber' | 'alignmentLevel' | 'level' | 'kamas';
export type ConditionKey = StatKey | ConditionExtraKey;

export type SlotKind =
  | 'hat' | 'cloak' | 'amulet' | 'ring' | 'belt' | 'boots'
  | 'weapon' | 'shield' | 'pet' | 'mount' | 'dofus';

/**
 * Entrée de la table dofusdude. La clé est le `type.id` des effets et le `element.id` des
 * conditions, qui est l'index dans `GET /{canal}/v1/meta/elements` ; `metaName` est le nom
 * attendu à cet index (null : index absent du tableau, constaté en 3.7.3.3).
 */
export type DofusdudeEntry =
  | { metaName: string | null; kind: 'stat'; stat: StatKey }
  | { metaName: string | null; kind: 'hit'; hit: HitKind; element: HitElement | null }
  | { metaName: string | null; kind: 'text'; tag: TextTag }
  | { metaName: string | null; kind: 'condition'; key: ConditionExtraKey };

export const DOFUSDUDE_EFFECTS: Record<number, DofusdudeEntry> = {
  // Stats calculables
  8: { metaName: 'MP', kind: 'stat', stat: 'mp' },
  9: { metaName: 'Vitality', kind: 'stat', stat: 'vitality' },
  10: { metaName: 'Wisdom', kind: 'stat', stat: 'wisdom' },
  12: { metaName: 'AP', kind: 'stat', stat: 'ap' },
  13: { metaName: 'Intelligence', kind: 'stat', stat: 'intelligence' },
  14: { metaName: 'Fire Resistance', kind: 'stat', stat: 'resFixedFire' },
  15: { metaName: 'Earth Resistance', kind: 'stat', stat: 'resFixedEarth' },
  16: { metaName: '% Air Resistance', kind: 'stat', stat: 'resPctAir' },
  17: { metaName: '% Water Resistance', kind: 'stat', stat: 'resPctWater' },
  22: { metaName: 'Chance', kind: 'stat', stat: 'chance' },
  24: { metaName: 'Initiative', kind: 'stat', stat: 'initiative' },
  25: { metaName: 'Prospecting', kind: 'stat', stat: 'prospecting' },
  26: { metaName: 'Lock', kind: 'stat', stat: 'lock' },
  27: { metaName: 'Water Damage', kind: 'stat', stat: 'dmgWater' },
  28: { metaName: 'Summons', kind: 'stat', stat: 'summons' },
  29: { metaName: '% Critical', kind: 'stat', stat: 'critical' },
  30: { metaName: 'Damage', kind: 'stat', stat: 'damage' },
  31: { metaName: 'Range', kind: 'stat', stat: 'range' },
  32: { metaName: 'Power', kind: 'stat', stat: 'power' },
  33: { metaName: 'Neutral Resistance', kind: 'stat', stat: 'resFixedNeutral' },
  34: { metaName: '% Neutral Resistance', kind: 'stat', stat: 'resPctNeutral' },
  36: { metaName: 'Agility', kind: 'stat', stat: 'agility' },
  37: { metaName: '% Fire Resistance', kind: 'stat', stat: 'resPctFire' },
  38: { metaName: 'Critical Damage', kind: 'stat', stat: 'dmgCritical' },
  39: { metaName: 'MP Parry', kind: 'stat', stat: 'mpParry' },
  40: { metaName: '% Melee Damage', kind: 'stat', stat: 'dmgPctMelee' },
  41: { metaName: '% Weapon Damage', kind: 'stat', stat: 'dmgPctWeapon' },
  45: { metaName: 'Strength', kind: 'stat', stat: 'strength' },
  46: { metaName: 'Critical Resistance', kind: 'stat', stat: 'resCritical' },
  47: { metaName: 'Air Damage', kind: 'stat', stat: 'dmgAir' },
  48: { metaName: 'Earth Damage', kind: 'stat', stat: 'dmgEarth' },
  49: { metaName: 'Neutral Damage', kind: 'stat', stat: 'dmgNeutral' },
  50: { metaName: 'MP Reduction', kind: 'stat', stat: 'mpReduction' },
  59: { metaName: 'Dodge', kind: 'stat', stat: 'dodge' },
  60: { metaName: 'Air Resistance', kind: 'stat', stat: 'resFixedAir' },
  61: { metaName: 'Fire Damage', kind: 'stat', stat: 'dmgFire' },
  62: { metaName: 'Pushback Damage', kind: 'stat', stat: 'dmgPushback' },
  63: { metaName: '% Earth Resistance', kind: 'stat', stat: 'resPctEarth' },
  64: { metaName: 'AP Reduction', kind: 'stat', stat: 'apReduction' },
  65: { metaName: '% Melee Resistance', kind: 'stat', stat: 'resPctMelee' },
  70: { metaName: 'Pushback Resistance', kind: 'stat', stat: 'resPushback' },
  71: { metaName: '% Ranged Damage', kind: 'stat', stat: 'dmgPctRanged' },
  75: { metaName: 'AP Parry', kind: 'stat', stat: 'apParry' },
  82: { metaName: 'Water Resistance', kind: 'stat', stat: 'resFixedWater' },
  93: { metaName: '% Spell Damage', kind: 'stat', stat: 'dmgPctSpells' },
  106: { metaName: 'Power (traps)', kind: 'stat', stat: 'powerTraps' },
  108: { metaName: '% Ranged Resistance', kind: 'stat', stat: 'resPctRanged' },
  112: { metaName: 'Trap Damage', kind: 'stat', stat: 'dmgTraps' },
  121: { metaName: 'Heal', kind: 'stat', stat: 'heals' },
  220: { metaName: 'Pod', kind: 'stat', stat: 'pods' },
  248: { metaName: 'reflected damage', kind: 'stat', stat: 'dmgReflected' },

  // Coups d'arme
  179: { metaName: 'AP (Active)', kind: 'hit', hit: 'apLoss', element: null },
  189: { metaName: 'Air Damage (Active)', kind: 'hit', hit: 'damage', element: 'air' },
  193: { metaName: 'Fire steal (Active)', kind: 'hit', hit: 'steal', element: 'fire' },
  194: { metaName: 'Earth damage (Active)', kind: 'hit', hit: 'damage', element: 'earth' },
  195: { metaName: 'Neutral damage (Active)', kind: 'hit', hit: 'damage', element: 'neutral' },
  198: { metaName: 'Fire damage (Active)', kind: 'hit', hit: 'damage', element: 'fire' },
  203: { metaName: 'Water steal (Active)', kind: 'hit', hit: 'steal', element: 'water' },
  214: { metaName: 'Water damage (Active)', kind: 'hit', hit: 'damage', element: 'water' },
  221: { metaName: 'Earth steal (Active)', kind: 'hit', hit: 'steal', element: 'earth' },
  223: { metaName: 'Neutral steal (Active)', kind: 'hit', hit: 'steal', element: 'neutral' },
  224: { metaName: 'Air steal (Active)', kind: 'hit', hit: 'steal', element: 'air' },
  225: { metaName: 'Pushes back cell (Active)', kind: 'hit', hit: 'push', element: null },
  233: { metaName: 'Steals MP (Active)', kind: 'hit', hit: 'mpSteal', element: null },
  238: { metaName: 'MP (Active)', kind: 'hit', hit: 'mpLoss', element: null },
  241: { metaName: 'Steals kamas (Active)', kind: 'hit', hit: 'kamasSteal', element: null },
  250: { metaName: 'best-element damage (Active)', kind: 'hit', hit: 'damage', element: 'best' },
  253: { metaName: 'Attracts by cell (Active)', kind: 'hit', hit: 'pull', element: null },
  257: { metaName: 'Fire heals (Active)', kind: 'hit', hit: 'heal', element: 'fire' },
  258: { metaName: 'best-element steal (Active)', kind: 'hit', hit: 'steal', element: 'best' },
  259: { metaName: 'Advances by cell (Active)', kind: 'hit', hit: 'advance', element: null },
  277: { metaName: null, kind: 'hit', hit: 'heal', element: 'neutral' },

  // Affichage seul (dont des lignes que les drapeaux dofusdude feraient passer pour calculables)
  0: { metaName: 'Exchangeable:', kind: 'text', tag: 'other' },
  35: { metaName: 'Title:', kind: 'text', tag: 'other' },
  81: { metaName: 'Linked to the character', kind: 'text', tag: 'other' },
  83: { metaName: 'Cooperative crafting impossible', kind: 'text', tag: 'other' },
  84: { metaName: 'Received on', kind: 'text', tag: 'other' },
  92: { metaName: 'Hunting weapon', kind: 'text', tag: 'other' },
  98: { metaName: 'Emote', kind: 'text', tag: 'other' },
  101: { metaName: "Someone's following you!", kind: 'text', tag: 'other' },
  117: { metaName: 'Changes appearance', kind: 'text', tag: 'other' },
  119: { metaName: 'Changes speech', kind: 'text', tag: 'other' },
  123: { metaName: 'Number of victims:', kind: 'text', tag: 'other' },
  145: { metaName: 'Add a temporary spell', kind: 'text', tag: 'other' },
  163: { metaName: '-special spell-', kind: 'text', tag: 'spell' },
  166: { metaName: 'Max.', kind: 'text', tag: 'other' },
  191: { metaName: '/', kind: 'text', tag: 'other' },
  196: { metaName: "What's inside?", kind: 'text', tag: 'other' },
  251: { metaName: 'Size: %', kind: 'text', tag: 'other' },
  261: { metaName: 'Fertile', kind: 'text', tag: 'other' },
  204: { metaName: ': modifiable Range', kind: 'text', tag: 'spellModifier' },
  205: { metaName: ': line of sight off', kind: 'text', tag: 'spellModifier' },
  207: { metaName: ': - AP', kind: 'text', tag: 'spellModifier' },
  208: { metaName: ': + Maximum Range', kind: 'text', tag: 'spellModifier' },
  209: { metaName: ': straight-line casting off', kind: 'text', tag: 'spellModifier' },
  226: { metaName: ': +% Critical', kind: 'text', tag: 'spellModifier' },
  227: { metaName: ': - cooldown', kind: 'text', tag: 'spellModifier' },
  240: { metaName: ': occupied cell needed off', kind: 'text', tag: 'spellModifier' },
  243: { metaName: ': + base damage', kind: 'text', tag: 'spellModifier' },
  245: { metaName: ': + Damage', kind: 'text', tag: 'spellModifier' },
  275: { metaName: ': - Minimum Range', kind: 'text', tag: 'spellModifier' },
  278: { metaName: null, kind: 'text', tag: 'spellModifier' },
  279: { metaName: null, kind: 'text', tag: 'spellModifier' },

  // Conditions qui ne sont pas des stats
  55: { metaName: 'Alignment level', kind: 'condition', key: 'alignmentLevel' },
  72: { metaName: 'Set bonus', kind: 'condition', key: 'setBonus' },
  200: { metaName: 'Be level {0} or higher', kind: 'condition', key: 'level' },
  237: { metaName: 'Kamas', kind: 'condition', key: 'kamas' },
  252: { metaName: 'Be subscribed', kind: 'condition', key: 'subscriber' },
};

/**
 * `type.id` d'objet dofusdude → emplacement. `null` = hors joueur (masqué par défaut).
 * Un type absent de cette table fait échouer build-data.
 */
export const DOFUSDUDE_ITEM_TYPES: Record<number, SlotKind | null> = {
  27: 'hat', // Chapeau
  43: 'cloak', // Cape
  33: 'amulet', // Amulette
  17: 'ring', // Anneau
  58: 'belt', // Ceinture
  45: 'boots', // Bottes
  87: 'shield', // Bouclier
  80: 'weapon', // Épée
  39: 'weapon', // Arc
  93: 'weapon', // Dague
  65: 'weapon', // Baguette
  125: 'weapon', // Bâton
  42: 'weapon', // Marteau
  52: 'weapon', // Pelle
  73: 'weapon', // Hache
  163: 'weapon', // Faux
  111: 'weapon', // Lance
  199: 'weapon', // Pioche
  1: 'pet', // Familier
  180: 'pet', // Montilier (emplacement `fa` chez DofusBook)
  255: 'mount', // Dragodinde
  253: 'mount', // Muldo
  256: 'mount', // Volkorne
  177: 'dofus', // Dofus
  23: 'dofus', // Trophée
  124: 'dofus', // Prysmaradite (emplacement Dofus non vérifié en Dofus 3)
  157: null, // Compagnon
  105: null, // Outil
  182: null, // Arme magique
  212: null, // sans nom
  102: null, // Fers de Percepteur
  78: null, // Tunique de Percepteur
  161: null, // Bannière de Percepteur
  81: null, // Poignards de Percepteur
  79: null, // Cuirasses de Percepteur
  190: null, // Coffres de Percepteur
  193: null, // Sacoches de Percepteur
};

/** Clé de condition pour un `element.id` dofusdude, ou undefined si inconnu. */
export function conditionKeyOf(id: number): ConditionKey | undefined {
  const entry = DOFUSDUDE_EFFECTS[id];
  if (entry?.kind === 'stat') return entry.stat;
  if (entry?.kind === 'condition') return entry.key;
  return undefined;
}
