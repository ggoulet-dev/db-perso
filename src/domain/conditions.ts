import type { Condition } from './dataset';
import type { ConditionKey, StatKey } from './stats';

export type ConditionStatus = 'remplie' | 'non remplie' | 'non évaluée';

export interface ConditionContext {
  /** Totaux finaux du stuff. */
  stat(key: StatKey): number;
  /** Nombre de panoplies avec au moins 2 pièces équipées (interprétation non vérifiée). */
  setBonusCount: number;
  subscriber: boolean;
}

type ConditionTest = Extract<Condition, { kind: 'test' }>;

export interface TestResult {
  test: ConditionTest;
  status: ConditionStatus;
  /** Valeur comparée, absente si non évaluée. */
  actual?: number;
}

export interface ConditionResult {
  status: ConditionStatus;
  /** Feuilles de l'arbre dans l'ordre, pour l'affichage. */
  tests: TestResult[];
}

// Alignement, kamas et « Être niveau {0} ou plus » (posé avec `<`) : jamais jugés faux.
const NOT_EVALUATED: ReadonlySet<ConditionKey> = new Set<ConditionKey>(['alignmentLevel', 'kamas', 'level']);

function actualValue(key: ConditionKey, ctx: ConditionContext): number | undefined {
  if (NOT_EVALUATED.has(key)) return undefined;
  if (key === 'setBonus') return ctx.setBonusCount;
  if (key === 'subscriber') return ctx.subscriber ? 1 : 0;
  return ctx.stat(key as StatKey);
}

function compare(actual: number, operator: ConditionTest['operator'], value: number): boolean {
  if (operator === '<') return actual < value;
  if (operator === '>') return actual > value;
  return actual === value;
}

function evaluate(node: Condition, ctx: ConditionContext, tests: TestResult[]): ConditionStatus {
  if (node.kind === 'test') {
    const actual = actualValue(node.key, ctx);
    const status: ConditionStatus = actual === undefined ? 'non évaluée' : compare(actual, node.operator, node.value) ? 'remplie' : 'non remplie';
    tests.push(actual === undefined ? { test: node, status } : { test: node, status, actual });
    return status;
  }
  const statuses = node.children.map((child) => evaluate(child, ctx, tests));
  // Logique à trois valeurs : une inconnue ne tranche que si rien d'autre ne le fait.
  const decisive: ConditionStatus = node.kind === 'and' ? 'non remplie' : 'remplie';
  if (statuses.includes(decisive)) return decisive;
  if (statuses.includes('non évaluée')) return 'non évaluée';
  return node.kind === 'and' ? 'remplie' : 'non remplie';
}

export function evaluateCondition(condition: Condition, ctx: ConditionContext): ConditionResult {
  const tests: TestResult[] = [];
  return { status: evaluate(condition, ctx, tests), tests };
}
