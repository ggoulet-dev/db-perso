// Mise en texte française des lignes, coups et conditions. Pur : utilisé par l'UI, testé ici.
import { ELEMENT_LABELS, STATS } from './stats';
import type { ConditionExtraKey, ConditionKey, HitElement, SlotKind, StatKey } from './stats';
import type { Condition, Hit, Line } from './dataset';

export const SLOT_LABELS: Record<SlotKind, string> = {
  hat: 'Chapeau',
  cloak: 'Cape',
  amulet: 'Amulette',
  ring: 'Anneau',
  belt: 'Ceinture',
  boots: 'Bottes',
  weapon: 'Arme',
  shield: 'Bouclier',
  pet: 'Familier',
  mount: 'Monture',
  dofus: 'Dofus et trophées',
};

const CONDITION_EXTRA_LABELS: Record<ConditionExtraKey, string> = {
  setBonus: 'Bonus de panoplies',
  subscriber: 'Être abonné',
  alignmentLevel: "Niveau d'alignement",
  level: 'Niveau',
  kamas: 'Kamas',
};

const HIT_ELEMENT_LABELS: Record<HitElement, string> = { ...ELEMENT_LABELS, best: 'meilleur élément' };

export function formatRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min} à ${max}`;
}

/** « 81 à 130 Vitalité », « 1 PA », « 2 à 3% Critique », « -40 à -11 Force ». */
export function formatLine(line: Line): string {
  const def: { label: string; percent?: boolean } = STATS[line.stat];
  return `${formatRange(line.min, line.max)}${def.percent ? '' : ' '}${def.label}`;
}

/** « 5 à 10 (dommages Terre) », « -1 PA », « Repousse de 2 cases ». */
export function formatHit(hit: Hit): string {
  const range = formatRange(hit.min, hit.max);
  const element = hit.element ? ` ${HIT_ELEMENT_LABELS[hit.element]}` : '';
  const loss = hit.min === hit.max ? `-${hit.min}` : `-${hit.min} à -${hit.max}`;
  const cells = hit.max > 1 ? 'cases' : 'case';
  switch (hit.kind) {
    case 'damage': return `${range} (dommages${element})`;
    case 'steal': return `${range} (vol${element})`;
    case 'heal': return `${range} (soins${element})`;
    case 'apLoss': return `${loss} PA`;
    case 'mpLoss': return `${loss} PM`;
    case 'mpSteal': return `${range} (vol PM)`;
    case 'push': return `Repousse de ${range} ${cells}`;
    case 'pull': return `Attire de ${range} ${cells}`;
    case 'advance': return `Avance de ${range} ${cells}`;
    case 'kamasSteal': return `${range} (vol de kamas)`;
  }
}

export function conditionKeyLabel(key: ConditionKey): string {
  return key in STATS ? STATS[key as StatKey].label : CONDITION_EXTRA_LABELS[key as ConditionExtraKey];
}

export function formatConditionTest(test: Extract<Condition, { kind: 'test' }>): string {
  if (test.key === 'subscriber' && test.operator === '=') {
    return test.value === 1 ? 'Être abonné' : 'Ne pas être abonné';
  }
  return `${conditionKeyLabel(test.key)} ${test.operator} ${test.value}`;
}

/** Fusionne les groupes imbriqués de même nature : and(and(a, b), c) → and(a, b, c). */
export function flattenCondition(condition: Condition): Condition {
  if (condition.kind === 'test') return condition;
  const children = condition.children
    .map(flattenCondition)
    .flatMap((child) => (child.kind === condition.kind ? child.children : [child]));
  return children.length === 1 ? children[0]! : { kind: condition.kind, children };
}

export type GameTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'spell' | 'item'; id: number; name: string };

const TEMPLATE = /\{\{(spell|item),(\d+)(?:,\d+)?::(.*?)\}\}/g;

/**
 * Retire le balisage Unity des textes du jeu (`<color=…>`, `<b>`, `<sprite name="…">`).
 * Une icône est suivie de son libellé dans le texte, sauf `tour` qui le remplace.
 */
export function stripGameMarkup(text: string): string {
  return text
    .replace(/<sprite name="tour">/g, 'tour(s)')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Découpe un texte du jeu sur ses gabarits `{{spell,ID,N::Nom}}` et `{{item,ID::Nom}}`, balisage retiré. */
export function parseGameText(text: string): GameTextPart[] {
  const parts: GameTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TEMPLATE)) {
    if (match.index > last) parts.push({ kind: 'text', text: stripGameMarkup(text.slice(last, match.index)) });
    parts.push({ kind: match[1] as 'spell' | 'item', id: Number(match[2]), name: stripGameMarkup(match[3]!) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: stripGameMarkup(text.slice(last)) });
  return parts;
}
