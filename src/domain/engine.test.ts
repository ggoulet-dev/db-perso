import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBuild, type Build, type SlotEntry, type SlotKey } from './build/types';
import { createDataset, type DatasetMeta, type ItemSet, type ItemsFile } from './dataset';
import { computeBuild } from './engine';
import { caracCost, DEFAULT_STAT_COSTS, type BreedsFile } from './rules';
import type { StatKey } from './stats';

function readPublic<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

const { types, items } = readPublic<ItemsFile>('items.json');
const dataset = createDataset({ meta: readPublic<DatasetMeta>('meta.json'), types, items, sets: readPublic<ItemSet[]>('sets.json') });
const { breeds } = readPublic<BreedsFile>('breeds.json');

function entry(itemId: number, patch: Partial<SlotEntry> = {}): SlotEntry {
  return { itemId, itemName: dataset.itemById.get(itemId)?.name ?? '', rolls: [], exos: [], ...patch };
}

function build(slots: Partial<Record<SlotKey, SlotEntry>>, extras: Array<[StatKey, number]> = []): Build {
  const b = createBuild({ id: 'test', name: 'test', dataVersion: dataset.meta.gameVersion, breedId: 1, level: 200, now: '2026-10-06T00:00:00.000Z' });
  Object.assign(b.slots, slots);
  b.extras = extras.map(([stat, value]) => ({ label: 'test', stat, value }));
  return b;
}

const compute = (b: Build) => computeBuild(b, dataset, breeds);
const codes = (b: Build) => compute(b).warnings.map((w) => w.code);

describe('computeBuild', () => {
  it('panoplie Culbutœuf complète : bonus 3 pièces appliqué', () => {
    const result = compute(build({ a1: entry(32234), ar: entry(32235), br: entry(32236) }));
    expect(result.sets).toMatchObject([{ setId: 1045, pieces: 3, bonus: { pieces: 3 } }]);
    expect(result.breakdown.critical).toEqual([{ source: { kind: 'set', setId: 1045, pieces: 3 }, value: 18 }]);
    // 7 de base + 1 du bonus de panoplie
    expect(result.totals.ap).toBe(8);
  });

  it('deux anneaux identiques : une seule pièce de panoplie et un avertissement', () => {
    const result = compute(build({ a1: entry(32234), a2: entry(32234) }));
    expect(result.sets).toMatchObject([{ setId: 1045, pieces: 1, bonus: null }]);
    expect(result.warnings.map((w) => w.code)).toContain('duplicate');
  });

  it('malus « -40 à -11 Force » : jet parfait -11, jet saisi respecté', () => {
    // Baguette des Limbes : ligne 3 = Force -40 à -11
    expect(compute(build({ ar: entry(180) })).slots.ar?.lines[3]).toMatchObject({ stat: 'strength', value: -11, over: false });
    const rolled = compute(build({ ar: entry(180, { rolls: [{ line: 3, stat: 'strength', value: -40 }] }) }));
    expect(rolled.totals.strength).toBe(-40);
  });

  it('over : un jet au-delà du max est compté et signalé', () => {
    const result = compute(build({ br: entry(32236, { rolls: [{ line: 0, stat: 'vitality', value: 260 }] }) }));
    expect(result.slots.br?.lines[0]).toMatchObject({ value: 260, rolled: true, over: true });
    expect(result.totals.vitality).toBe(260);
  });

  it('exo : stat absente de l’objet ajoutée avec sa source', () => {
    const result = compute(build({ br: entry(32236, { exos: [{ stat: 'mp', value: 1 }] }) }));
    expect(result.totals.mp).toBe(4);
    expect(result.breakdown.mp).toContainEqual({ source: { kind: 'slot', slot: 'br', itemId: 32236, exo: true }, value: 1 });
  });

  it('jet dont la ligne ne correspond plus : ignoré et signalé', () => {
    const result = compute(build({ br: entry(32236, { rolls: [{ line: 0, stat: 'agility', value: 1 }] }) }));
    expect(result.slots.br?.lines[0]?.value).toBe(250);
    expect(result.warnings.map((w) => w.code)).toEqual(['rollMismatch']);
  });

  it('Obstructeur mineur « Bonus de panoplies < 2 » : rempli sans panoplie, non rempli avec deux', () => {
    expect(compute(build({ d1: entry(16182) })).slots.d1?.condition?.status).toBe('remplie');

    // Ogivol (chapeau + cape) et Culbutœuf (anneau + bouclier) : deux panoplies à 2 pièces
    const result = compute(build({ d1: entry(16182), ch: entry(13130), ca: entry(13131), a1: entry(32234), br: entry(32236) }));
    expect(result.sets.filter((s) => s.pieces >= 2)).toHaveLength(2);
    expect(result.slots.d1?.condition?.status).toBe('non remplie');
    expect(result.warnings.map((w) => w.code)).toContain('condition');
  });

  it('Dagues du Dragoeuf : and de caracs > 89 et or PA < 12 / PM < 6, sur les totaux finaux', () => {
    const caracs: Array<[StatKey, number]> = [['strength', 50], ['intelligence', 50], ['agility', 50]];
    // L'arme donne 40 dans chaque carac et 1 PA : 90 > 89, PA 8
    expect(compute(build({ ar: entry(8414) }, caracs)).slots.ar?.condition?.status).toBe('remplie');
    expect(compute(build({ ar: entry(8414) }, [['strength', 49], ...caracs.slice(1)])).slots.ar?.condition?.status).toBe('non remplie');
    // PA 12 mais PM 5 : le « ou » tient encore
    expect(compute(build({ ar: entry(8414) }, [...caracs, ['ap', 4]])).slots.ar?.condition?.status).toBe('remplie');
    expect(compute(build({ ar: entry(8414) }, [...caracs, ['ap', 4], ['mp', 3]])).slots.ar?.condition?.status).toBe('non remplie');
  });

  it('PA < 12 strict : 11 rempli, 12 non rempli', () => {
    // Baguette des Limbes : PA < 12 et PM < 6 et Sagesse > 99 ; elle donne 1 PA, 1 PM, 40 Sagesse
    const wisdom: [StatKey, number] = ['wisdom', 60];
    expect(compute(build({ ar: entry(180) }, [wisdom, ['ap', 3]])).slots.ar?.condition?.status).toBe('remplie');
    expect(compute(build({ ar: entry(180) }, [wisdom, ['ap', 4]])).slots.ar?.condition?.status).toBe('non remplie');
  });

  it('condition sur les kamas : non évaluée, sans avertissement', () => {
    const shield = dataset.items.find((i) => i.name === 'Bouclier Fi\'Squale')!;
    const result = compute(build({ br: entry(shield.id) }));
    expect(result.slots.br?.condition?.status).toBe('non évaluée');
    expect(result.warnings).toEqual([]);
  });

  it('plafonds 12 PA / 6 PM / 9 PO et 50 % de résistance : avertissements au-delà seulement', () => {
    expect(codes(build({}, [['ap', 5], ['mp', 3], ['range', 9], ['resPctFire', 50]]))).toEqual([]);
    expect(codes(build({}, [['ap', 6], ['mp', 4], ['range', 10], ['resPctFire', 51]]))).toEqual(['resPctCap', 'apCap', 'mpCap', 'rangeCap']);
    expect(compute(build({}, [['resPctFire', 51]])).derived.resPctCapped.fire).toBe(50);
  });

  it('deux exos PA : avertissement « un seul exo compte » ; exos PA et PM sur deux objets : aucun', () => {
    const apExo = { exos: [{ stat: 'ap' as const, value: 1 }] };
    expect(codes(build({ a1: entry(32234, apExo), br: entry(32236, apExo) }))).toContain('exoCap');
    expect(codes(build({ a1: entry(32234, apExo), br: entry(32236, { exos: [{ stat: 'mp', value: 1 }] }) }))).not.toContain('exoCap');
  });

  it('caracs : coût par paliers sur la base seule, parchemins hors paliers, points disponibles', () => {
    expect(caracCost(265, DEFAULT_STAT_COSTS.strength)).toBe(495);
    expect(caracCost(266, DEFAULT_STAT_COSTS.chance)).toBe(498);
    expect(caracCost(100, DEFAULT_STAT_COSTS.wisdom)).toBe(300);

    const b = build({});
    b.caracs.base.strength = 265;
    b.caracs.scrolls.strength = 100;
    const result = compute(b);
    expect(result.points).toMatchObject({ spent: 495, available: 995 });
    expect(result.totals.strength).toBe(365);
    expect(result.totals.pods).toBe(1000 + 5 * 365);

    b.caracs.base.vitality = 501;
    expect(codes(b)).toEqual(['points']);
  });

  it('PA de base : 7 à partir du niveau 100, 6 avant', () => {
    const b = build({});
    expect(compute(b).totals.ap).toBe(7);
    b.character.level = 99;
    expect(compute(b).totals.ap).toBe(6);
    expect(compute(b).derived.hp).toBe(50 + 5 * 99);
  });
});
