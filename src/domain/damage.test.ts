import { describe, expect, it } from 'vitest';
import { applyResistances, criticalCounterpart, spellDamage, weaponDamage, type AttackerStats } from './damage';
import type { Hit, Weapon } from './dataset';
import type { EffectRef, SpellEffect, SpellLevel } from './spells';

const attacker: AttackerStats = {
  effective: { neutral: 900, earth: 900, fire: 400, water: 100, air: 1000 },
  fixed: { neutral: 50, earth: 50, fire: 30, water: 10, air: 100 },
  critDamage: 40,
  pctWeapon: 10,
  pctSpells: 20,
  pctMelee: 15,
  pctRanged: 5,
  critical: 30,
};
const weapon: Weapon = { apCost: 4, minRange: 1, maxRange: 1, critProbability: 5, critBonus: 3, maxCastPerTurn: 1 };
const hits: Hit[] = [
  { kind: 'damage', element: 'neutral', min: 10, max: 20 },
  { kind: 'steal', element: 'water', min: 5, max: 5 },
  { kind: 'apLoss', element: null, min: 1, max: 1 },
];

const REFS = new Map<number, EffectRef>([
  [98, { characteristic: 0, elementId: 4, isInPercent: false, category: 2, useDice: true, active: false, description: '#1{{~1~2 à }}#2 dommages Air' }],
  [5, { characteristic: 0, elementId: -1, isInPercent: false, category: 2, useDice: false, active: false, description: 'Repousse de #1 case{{~ps}}' }],
  [2822, { characteristic: 0, elementId: -1, isInPercent: false, category: 2, useDice: true, active: false, description: '#1{{~1~2 à }}#2 dommages du meilleur élément' }],
]);
const effect = (effectId: number, diceNum: number, diceSide: number): SpellEffect => ({
  effectId, element: REFS.get(effectId)!.elementId, diceNum, diceSide, value: 0, duration: 0, targetMask: 'A', triggers: 'I', zone: { shape: 80, param1: 1, param2: 0 },
});
const level = (effects: SpellEffect[], criticalEffects: SpellEffect[], cc = 10): SpellLevel => ({
  id: 1, grade: 1, minPlayerLevel: 1, apCost: 3, minRange: 1, range: 6, rangeCanBeBoosted: true, criticalHitProbability: cc,
  maxCastPerTurn: 2, maxCastPerTarget: 1, castInLine: false, castInDiagonal: false, castTestLos: true, effects, criticalEffects,
});

describe('dégâts', () => {
  it('arme : maîtrise, % armes, critique = jet + bonus et Do Critique ; les autres coups sont ignorés', () => {
    const d = weaponDamage({ hits, weapon }, attacker)!;
    // neutre : ⌊10 × 13⌋ = 130 + 50 = 180 × 1,1 = 198 ; critique ⌊13 × 13⌋ + 50 + 40 = 259 × 1,1 = 284
    expect(d.lines.map((l) => [l.kind, l.element, l.normal, l.critical])).toEqual([
      ['damage', 'neutral', { min: 198, max: 341 }, { min: 284, max: 427 }],
      ['steal', 'water', { min: 38, max: 38 }, { min: 99, max: 99 }],
    ]);
    expect(d.heal).toEqual({ min: 19, max: 19 });
    expect(d.critChance).toBe(35);
    expect(d.unverified).toEqual([]);
    expect(weaponDamage({ hits, weapon: null }, attacker)).toBeNull();
  });

  it('FM élémentaire : conversion totale de l\'élément, signalée non vérifiée', () => {
    const d = weaponDamage({ hits, weapon }, attacker, { fm: { damage: { element: 'air', value: 100 }, steal: null } })!;
    expect(d.lines.map((l) => l.element)).toEqual(['air', 'water']);
    expect(d.unverified).toHaveLength(1);
  });

  it('options non vérifiées : % mêlée ajouté au % armes, malus en entiers, résistances fixes puis %', () => {
    const plain = weaponDamage({ hits, weapon }, attacker)!.lines[0]!.normal.min;
    const melee = weaponDamage({ hits, weapon }, attacker, { distance: 'melee' })!;
    expect(melee.lines[0]!.normal.min).toBe(Math.floor((180 * 125) / 100));
    expect(melee.unverified).toHaveLength(1);
    expect(weaponDamage({ hits, weapon }, attacker, { weaponSkill: 400 })!.unverified).toEqual(["Maîtrise d'arme 400 au lieu de 300."]);
    // 400 × 1,1 × 0,9 en flottants donne 395,99… ou 396,00…1 selon l'ordre : le calcul entier donne 396.
    expect(weaponDamage({ hits: [{ kind: 'damage', element: 'neutral', min: 0, max: 0 }], weapon }, { ...attacker, fixed: { ...attacker.fixed, neutral: 400 } }, { malusPct: 10 })!.normal.min).toBe(396);
    expect(applyResistances(200, 'fire', { fixed: { fire: 20 }, pct: { fire: 25 } })).toBe(135);
    expect(applyResistances(10, 'fire', { fixed: { fire: 20 }, pct: {} })).toBe(0);
    expect(weaponDamage({ hits, weapon }, attacker, { target: { fixed: { neutral: 8 }, pct: { neutral: 50 } } })!.lines[0]!.normal.min).toBe(Math.floor((plain - 8) / 2));
  });

  it('sort : pas de maîtrise, % sorts, charges, et pas de critique sans criticalEffects', () => {
    const lvl = level([effect(98, 10, 12), effect(5, 2, 0)], [effect(98, 13, 15), effect(5, 2, 0)]);
    const d = spellDamage(lvl, REFS, attacker);
    // ⌊10 × 11⌋ + 100 = 210 × 1,2 = 252
    expect(d.lines).toHaveLength(1);
    expect([d.total!.normal, d.total!.critical, d.critChance]).toEqual([{ min: 252, max: 278 }, { min: 339, max: 366 }, 40]);
    expect(spellDamage(lvl, REFS, attacker, { baseBonus: 2 }).total!.normal.min).toBe(Math.floor((12 * 11 + 100) * 1.2));
    const noCrit = spellDamage(level([effect(98, 10, 12)], [], 0), REFS, attacker);
    expect([noCrit.total!.critical, noCrit.critChance, noCrit.total!.average.perCast]).toEqual([null, 0, 265]);
    const twice = spellDamage(level([effect(98, 10, 12)], [], 0), REFS, attacker, { castsPerTurn: 2 });
    expect([twice.total!.average.perCast, twice.total!.average.perTurn, twice.unverified.length]).toEqual([265, 530, 1]);
  });

  it('meilleur élément : celui qui donne le plus de dégâts, signalé non vérifié', () => {
    const d = spellDamage(level([effect(2822, 10, 10)], [effect(2822, 12, 12)]), REFS, attacker);
    expect(d.lines[0]!.element).toBe('air');
    expect(d.unverified).toEqual(['Meilleur élément choisi sur les dégâts : Air.']);
  });

  it('effet critique apparié par effectId quand les listes diffèrent', () => {
    const lvl = level([effect(5, 1, 0), effect(98, 1, 2), effect(98, 3, 4)], [effect(98, 2, 3), effect(98, 5, 6)]);
    expect([0, 1, 2].map((i) => criticalCounterpart(lvl, i)?.diceNum ?? null)).toEqual([null, 2, 5]);
  });

  it('effet critique apparié d\'abord par signature quand les listes ne sont pas rangées pareil', () => {
    const onState = { ...effect(98, 16, 0), targetMask: 'A,*E1' };
    const lvl = level([effect(98, 8, 20), { ...onState, diceNum: 12 }], [{ ...onState }, effect(98, 10, 23)]);
    expect([0, 1].map((i) => criticalCounterpart(lvl, i)?.diceNum)).toEqual([10, 16]);
  });

  it('lignes qui s\'excluent (état, cible alliée) : pas de total ni de moyenne', () => {
    const ally = { ...effect(98, 10, 12), targetMask: 'a,e256' };
    const d = spellDamage(level([effect(98, 10, 12), ally], [effect(98, 13, 15), ally]), REFS, attacker, { castsPerTurn: 2 });
    expect(d.lines).toHaveLength(2);
    expect([d.total, typeof d.noTotal, d.unverified]).toEqual([null, 'string', []]);
  });
});
