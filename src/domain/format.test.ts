import { describe, expect, it } from 'vitest';
import type { Condition } from './dataset';
import { flattenCondition, formatConditionTest, formatHit, formatLine, parseGameText, stripGameMarkup } from './format';

describe('format', () => {
  it('écrit les lignes fixes, en intervalle, en pourcentage et en malus', () => {
    expect(formatLine({ stat: 'ap', min: 1, max: 1 })).toBe('1 PA');
    expect(formatLine({ stat: 'vitality', min: 201, max: 250 })).toBe('201 à 250 Vitalité');
    expect(formatLine({ stat: 'critical', min: 2, max: 3 })).toBe('2 à 3% Critique');
    expect(formatLine({ stat: 'strength', min: -40, max: -11 })).toBe('-40 à -11 Force');
  });

  it('écrit les coups d’arme', () => {
    expect(formatHit({ kind: 'damage', element: 'earth', min: 5, max: 10 })).toBe('5 à 10 (dommages Terre)');
    expect(formatHit({ kind: 'steal', element: 'best', min: 3, max: 6 })).toBe('3 à 6 (vol meilleur élément)');
    expect(formatHit({ kind: 'apLoss', element: null, min: 1, max: 1 })).toBe('-1 PA');
    expect(formatHit({ kind: 'push', element: null, min: 2, max: 2 })).toBe('Repousse de 2 cases');
  });

  it('remplace les gabarits de sort et d’objet par leur nom', () => {
    expect(parseGameText('{{spell,8395,1::Pourpre Profond}} :\n• effet')).toEqual([
      { kind: 'spell', id: 8395, name: 'Pourpre Profond' },
      { kind: 'text', text: ' :\n• effet' },
    ]);
    expect(parseGameText('porteurs du {{item,23408::Dorigami}} et {{spell,1,2::<color=#ebc>Téléfrag</color>}}')).toEqual([
      { kind: 'text', text: 'porteurs du ' },
      { kind: 'item', id: 23408, name: 'Dorigami' },
      { kind: 'text', text: ' et ' },
      { kind: 'spell', id: 1, name: 'Téléfrag' },
    ]);
  });

  it('retire le balisage Unity en gardant le texte', () => {
    expect(stripGameMarkup('25 à 28 dommages Air (% <sprite name="PM">PM restants)')).toBe('25 à 28 dommages Air (% PM restants)');
    expect(stripGameMarkup('10% <sprite name="PV"> PV du lanceur')).toBe('10% PV du lanceur');
    expect(stripGameMarkup('Flèche : -1 <sprite name="tour"> de relance')).toBe('Flèche : -1 tour(s) de relance');
    expect(stripGameMarkup('<b>État Peinture :</b> <color=#ebc304>actif</color>')).toBe('État Peinture : actif');
  });

  it('aplatit les groupes de même nature et garde les ou imbriqués', () => {
    const test = (key: 'strength' | 'intelligence' | 'agility' | 'ap' | 'mp', operator: '<' | '>', value: number) =>
      ({ kind: 'test', key, operator, value }) as const;
    // Forme des Dagues du Dragoeuf (8414).
    const dagues: Condition = {
      kind: 'and',
      children: [
        { kind: 'and', children: [{ kind: 'and', children: [test('strength', '>', 89), test('intelligence', '>', 89)] }, test('agility', '>', 89)] },
        { kind: 'or', children: [test('ap', '<', 12), test('mp', '<', 6)] },
      ],
    };
    expect(flattenCondition(dagues)).toEqual({
      kind: 'and',
      children: [
        test('strength', '>', 89),
        test('intelligence', '>', 89),
        test('agility', '>', 89),
        { kind: 'or', children: [test('ap', '<', 12), test('mp', '<', 6)] },
      ],
    });
    expect(formatConditionTest(test('strength', '>', 89))).toBe('Force > 89');
    expect(formatConditionTest({ kind: 'test', key: 'setBonus', operator: '<', value: 2 })).toBe('Bonus de panoplies < 2');
  });
});
