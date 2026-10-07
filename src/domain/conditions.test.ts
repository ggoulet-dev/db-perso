import { describe, expect, it } from 'vitest';
import { evaluateCondition, type ConditionContext } from './conditions';
import type { Condition } from './dataset';
import type { ConditionKey } from './stats';

const test = (key: ConditionKey, operator: '<' | '>' | '=', value: number): Condition => ({ kind: 'test', key, operator, value });
const ctx = (stats: Record<string, number>, extra: Partial<ConditionContext> = {}): ConditionContext => ({
  stat: (key) => stats[key] ?? 0,
  setBonusCount: 0,
  subscriber: false,
  ...extra,
});

describe('evaluateCondition', () => {
  it('opérateurs stricts sur entiers', () => {
    expect(evaluateCondition(test('strength', '>', 249), ctx({ strength: 250 })).status).toBe('remplie');
    expect(evaluateCondition(test('strength', '>', 249), ctx({ strength: 249 })).status).toBe('non remplie');
    expect(evaluateCondition(test('ap', '<', 12), ctx({ ap: 12 })).status).toBe('non remplie');
  });

  it('abonnement et bonus de panoplies lus dans le contexte', () => {
    expect(evaluateCondition(test('subscriber', '=', 1), ctx({}, { subscriber: true })).status).toBe('remplie');
    expect(evaluateCondition(test('setBonus', '<', 2), ctx({}, { setBonusCount: 2 })).status).toBe('non remplie');
  });

  it('logique à trois valeurs : une inconnue ne rend jamais une condition fausse', () => {
    const unknown = test('kamas', '>', 49999);
    const yes = test('ap', '>', 0);
    const no = test('ap', '<', 0);
    const c = ctx({ ap: 7 });
    expect(evaluateCondition({ kind: 'and', children: [unknown, yes] }, c).status).toBe('non évaluée');
    expect(evaluateCondition({ kind: 'and', children: [unknown, no] }, c).status).toBe('non remplie');
    expect(evaluateCondition({ kind: 'or', children: [unknown, yes] }, c).status).toBe('remplie');
    expect(evaluateCondition({ kind: 'or', children: [unknown, no] }, c).status).toBe('non évaluée');
  });

  it('rend chaque feuille avec sa valeur comparée', () => {
    const result = evaluateCondition({ kind: 'or', children: [test('ap', '<', 12), test('level', '<', 6)] }, ctx({ ap: 12 }));
    expect(result.tests).toEqual([
      { test: test('ap', '<', 12), status: 'non remplie', actual: 12 },
      { test: test('level', '<', 6), status: 'non évaluée' },
    ]);
  });
});
