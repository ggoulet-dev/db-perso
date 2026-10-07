import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBuild, type Build, type SlotEntry, type SlotKey } from './build/types';
import { compareBuilds, sortStatDiffs } from './compare';
import { createDataset, type DatasetMeta, type ItemSet, type ItemsFile } from './dataset';
import type { BreedsFile } from './rules';

function readPublic<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

const { types, items } = readPublic<ItemsFile>('items.json');
const dataset = createDataset({ meta: readPublic<DatasetMeta>('meta.json'), types, items, sets: readPublic<ItemSet[]>('sets.json') });
const { breeds } = readPublic<BreedsFile>('breeds.json');

function entry(itemId: number, patch: Partial<SlotEntry> = {}): SlotEntry {
  return { itemId, itemName: dataset.itemById.get(itemId)?.name ?? '', rolls: [], exos: [], ...patch };
}

function build(slots: Partial<Record<SlotKey, SlotEntry>>): Build {
  const b = createBuild({ id: 'test', name: 'test', dataVersion: dataset.meta.gameVersion, breedId: 1, level: 200, now: '2026-10-06T00:00:00.000Z' });
  Object.assign(b.slots, slots);
  b.caracs.base.agility = 100;
  return b;
}

const compare = (a: Build, b: Build) => compareBuilds(a, b, dataset, breeds);
const changed = (result: ReturnType<typeof compare>) => Object.fromEntries(result.stats.filter((s) => s.delta !== 0).map((s) => [s.key, s.delta]));

describe('compareBuilds', () => {
  it('deux builds identiques : aucun delta', () => {
    const stuff = build({ a1: entry(32234), ar: entry(32235), br: entry(32236), a2: entry(359) });
    const result = compare(stuff, structuredClone(stuff));
    expect(result.stats.every((s) => s.delta === 0)).toBe(true);
    expect(result.slots.filter((s) => s.status !== 'empty').map((s) => [s.slot, s.status, s.tuned])).toEqual([
      ['a1', 'same', false],
      ['a2', 'same', false],
      ['ar', 'same', false],
      ['br', 'same', false],
    ]);
    expect(result.sets.diff).toEqual([{ setId: 1045, name: expect.any(String), piecesA: 3, piecesB: 3 }]);
    expect(result.caracs.every((c) => c.base.delta === 0 && c.scrolls.delta === 0)).toBe(true);
    expect(result.points.spent.delta).toBe(0);
  });

  it('changer un anneau : deltas calculés à la main', () => {
    // Anneau Rak : Vitalité 20, Chance 11, Dommages Eau 1 ; L'Ecaliseur : Vitalité 20, Chance 15, Dommages 2
    const result = compare(build({ a1: entry(346) }), build({ a1: entry(359) }));
    expect(changed(result)).toEqual({
      chance: 4,
      initiative: 4, // Chance entre dans l'Initiative ; Prospection : ⌊11/10⌋ = ⌊15/10⌋
      damage: 2,
      'shown-neutral': 2,
      'shown-earth': 2,
      'shown-fire': 2,
      'shown-water': 1, // 1 + 0 → 0 + 2
      'shown-air': 2,
    });
    expect(result.slots.find((s) => s.slot === 'a1')).toMatchObject({ status: 'different', a: { itemId: 346 }, b: { itemId: 359 } });
    // Égalité d'écart : ordre du panneau (Initiative est dans « Général »)
    expect(sortStatDiffs(result.stats, 'delta').slice(0, 2).map((s) => s.key)).toEqual(['initiative', 'chance']);
    expect(result.stats.find((s) => s.key === 'chance')).toMatchObject({ a: 11, b: 15 });
  });

  it('stuff contre sa copie modifiée (un jet changé) : un seul delta', () => {
    const stuff = build({ a1: entry(32234), ar: entry(32235), br: entry(32236) });
    const copy = structuredClone(stuff);
    // Anneau de Culbutœuf, ligne 9 : Dommages Poussée 11 à 15, jet parfait 15
    copy.slots.a1!.rolls = [{ line: 9, stat: 'dmgPushback', value: 12 }];
    const result = compare(stuff, copy);
    expect(result.stats.filter((s) => s.delta !== 0)).toEqual([expect.objectContaining({ key: 'dmgPushback', delta: -3 })]);
    expect(result.slots.find((s) => s.slot === 'a1')).toMatchObject({ status: 'same', tuned: true });
  });

  it('tri par importance : PA avant Pods', () => {
    const result = compare(build({}), build({}));
    const keys = sortStatDiffs(result.stats, 'importance').map((s) => s.key);
    expect(keys[0]).toBe('ap');
    expect(keys.indexOf('pods')).toBeGreaterThan(keys.indexOf('vitality'));
  });
});
