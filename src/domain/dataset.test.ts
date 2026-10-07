import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDataset, normalizeText, type DatasetMeta, type ItemSet, type ItemsFile } from './dataset';

function readPublic<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

const { types, items } = readPublic<ItemsFile>('items.json');
const dataset = createDataset({
  meta: readPublic<DatasetMeta>('meta.json'),
  types,
  items,
  sets: readPublic<ItemSet[]>('sets.json'),
});

function item(id: number) {
  const found = dataset.itemById.get(id);
  if (!found) throw new Error(`objet ${id} absent du dataset`);
  return found;
}

describe('dataset normalisé', () => {
  it('Disque de Culbutœuf : exactement les 10 lignes calculables de DofusBook', () => {
    const disque = item(32236);
    expect(disque.slot).toBe('shield');
    expect(disque.iconId).toBe(82561);
    expect([...disque.lines].sort((a, b) => a.stat.localeCompare(b.stat))).toEqual(
      [
        { stat: 'vitality', min: 201, max: 250 },
        { stat: 'strength', min: 41, max: 60 },
        { stat: 'chance', min: 41, max: 60 },
        { stat: 'agility', min: 41, max: 60 },
        { stat: 'wisdom', min: 31, max: 40 },
        { stat: 'range', min: 1, max: 1 },
        { stat: 'prospecting', min: 11, max: 15 },
        { stat: 'dmgPushback', min: 16, max: 25 },
        { stat: 'resPctEarth', min: 4, max: 7 },
        { stat: 'resPctFire', min: 9, max: 12 },
      ].sort((a, b) => a.stat.localeCompare(b.stat)),
    );
    expect(disque.hits).toEqual([]);
    expect(disque.texts).toEqual([]);
  });

  it('panoplie 1045 : 3 pièces, bonus à 2 et 3 pièces', () => {
    const set = dataset.setById.get(1045);
    expect(set?.itemIds).toEqual([32234, 32235, 32236]);
    expect(set?.bonuses.map((bonus) => bonus.pieces)).toEqual([2, 3]);
    expect(set?.bonuses[1]?.lines).toContainEqual({ stat: 'ap', min: 1, max: 1 });
    expect(item(32236).setId).toBe(1045);
  });

  it('Dagues du Dragoeuf : condition and/or imbriquée conservée', () => {
    const test = (key: string, operator: string, value: number) => ({ kind: 'test', key, operator, value });
    expect(item(8414).conditions).toEqual({
      kind: 'and',
      children: [
        {
          kind: 'and',
          children: [
            { kind: 'and', children: [test('strength', '>', 89), test('intelligence', '>', 89)] },
            test('agility', '>', 89),
          ],
        },
        { kind: 'or', children: [test('ap', '<', 12), test('mp', '<', 6)] },
      ],
    });
    expect(item(8414).hits).toContainEqual({ kind: 'damage', element: 'earth', min: 5, max: 10 });
  });

  it('un malus « -40 à -11 Force » garde min = -40, max = -11', () => {
    expect(item(180).lines).toContainEqual({ stat: 'strength', min: -40, max: -11 });
  });

  it('recherche sans accents ni casse : « culbutoeuf » trouve 32236', () => {
    expect(normalizeText('Disque de Culbutœuf')).toBe('disque de culbutoeuf');
    expect(dataset.search('culbutoeuf').map((found) => found.id)).toContain(32236);
    expect(dataset.search('DISQUE culbutoeuf').map((found) => found.id)).toEqual([32236]);
  });

  it('index par emplacement : les objets hors joueur en sont absents', () => {
    expect(dataset.itemsBySlot.get('shield')).toContain(item(32236));
    const indexed = [...dataset.itemsBySlot.values()].reduce((n, list) => n + list.length, 0);
    expect(indexed).toBe(dataset.meta.counts.playerItems);
  });
});
