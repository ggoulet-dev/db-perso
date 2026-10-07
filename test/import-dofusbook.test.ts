import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateBuild } from '../src/domain/build/migrate';
import { createDataset, type DatasetMeta, type Item, type ItemSet, type ItemsFile } from '../src/domain/dataset';
import { computeBuild, type BuildResult } from '../src/domain/engine';
import { importDofusbook, type DofusbookImportEntry } from '../src/domain/import/dofusbook';
import type { BreedsFile } from '../src/domain/rules';
import type { StatKey } from '../src/domain/stats';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

const { types, items } = readJson<ItemsFile>('../public/data/items.json');
const meta = readJson<DatasetMeta>('../public/data/meta.json');
const dataset = createDataset({ meta, types, items, sets: readJson<ItemSet[]>('../public/data/sets.json') });
const { breeds } = readJson<BreedsFile>('../public/data/breeds.json');
const NOW = '2026-10-06T12:00:00.000Z';
const options = { dataset, breeds, now: NOW };

interface CompactFixture {
  activeSetBonuses: Array<{ id: number; pieces: number }>;
  expectedTotals: Record<string, number | Record<string, number>>;
}
type ApiResponse = { stuff: Record<string, unknown>; items: Array<Record<string, unknown>> } & Record<string, unknown>;

const TOTAL_KEYS: Record<string, StatKey> = {
  prospection: 'prospecting', pa: 'ap', pm: 'mp', po: 'range', initiative: 'initiative', critique: 'critical',
  invocations: 'summons', soins: 'heals', vitalite: 'vitality', sagesse: 'wisdom', force: 'strength',
  intelligence: 'intelligence', chance: 'chance', agilite: 'agility', puissance: 'power', fuite: 'dodge',
  esquivePA: 'apParry', esquivePM: 'mpParry', pods: 'pods', tacle: 'lock', retraitPA: 'apReduction',
  retraitPM: 'mpReduction', doCritique: 'dmgCritical', doPoussee: 'dmgPushback', pctDoArmes: 'dmgPctWeapon',
  pctDoSorts: 'dmgPctSpells', pctDoMelee: 'dmgPctMelee', pctDoDistance: 'dmgPctRanged', dommages: 'damage',
  reNeutre: 'resFixedNeutral', pctReNeutre: 'resPctNeutral', reTerre: 'resFixedEarth', pctReTerre: 'resPctEarth',
  reFeu: 'resFixedFire', pctReFeu: 'resPctFire', reEau: 'resFixedWater', pctReEau: 'resPctWater',
  reAir: 'resFixedAir', pctReAir: 'resPctAir', reCritique: 'resCritical', rePoussee: 'resPushback',
  pctReMelee: 'resPctMelee', pctReDistance: 'resPctRanged', pctReArmes: 'resPctWeapon',
};
const SHOWN_DAMAGE = { doNeutre: 'neutral', doTerre: 'earth', doFeu: 'fire', doEau: 'water', doAir: 'air' } as const;
const EFFECTIVE = { force: 'strength', intelligence: 'intelligence', chance: 'chance', agilite: 'agility' } as const;

function shown(result: BuildResult): Record<string, number> {
  const out: Record<string, number> = { pdv: result.derived.hp };
  for (const [key, element] of Object.entries(SHOWN_DAMAGE)) out[key] = result.derived.shownDamage[element];
  for (const [key, stat] of Object.entries(TOTAL_KEYS)) out[key] = result.totals[stat];
  for (const [key, carac] of Object.entries(EFFECTIVE)) out[`effectif.${key}`] = result.derived.effectiveForDamage[carac];
  return out;
}

function expected(fixture: CompactFixture): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(fixture.expectedTotals)) if (typeof value === 'number') out[key] = value;
  const effective = fixture.expectedTotals._effectiveStatsShownForDamage as Record<string, number>;
  for (const key of Object.keys(EFFECTIVE)) out[`effectif.${key}`] = effective[key]!;
  return out;
}

function ok(entries: DofusbookImportEntry[]) {
  expect(entries.map((e) => (e.ok ? 'ok' : e.error))).toEqual(entries.map(() => 'ok'));
  return entries.flatMap((e) => (e.ok ? [e] : []));
}

const api = (name: string) => readJson<ApiResponse>(`./fixtures/dofusbook/api/${name}.json`);

describe.each(['23428650', '23428299'])('import de la réponse API du stuff %s', (id) => {
  const compact = readJson<CompactFixture>(`./fixtures/dofusbook/stuff-${id}.json`);

  it('redonne exactement tous les totaux DofusBook avec nos données', () => {
    const [entry] = ok(importDofusbook(api(`stuff-${id}`), options));
    const { build, report } = entry!;
    expect(report.missing).toEqual([]);
    expect(report.fallback).toEqual([]);
    expect(report.resolved).toHaveLength(16);
    expect(report.unmapped).toEqual([]);
    expect(build.source).toEqual({ kind: 'dofusbook', stuffId: Number(id), importedAt: NOW, unmapped: [] });

    const result = computeBuild(migrateBuild(JSON.parse(JSON.stringify(build))), dataset, breeds);
    expect(shown(result)).toEqual(expected(compact));
    const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;
    expect(result.sets.filter((s) => s.bonus).map(({ setId, pieces }) => ({ id: setId, pieces })).sort(byId))
      .toEqual(compact.activeSetBonuses.map(({ id: setId, pieces }) => ({ id: setId, pieces })).sort(byId));
    expect(result.warnings).toEqual([]);
  });
});

describe('import DofusBook', () => {
  it('lit la FM élémentaire d\'arme et la FM par objet', () => {
    const [{ build }] = ok(importDofusbook(api('stuff-23428299'), options)) as [Extract<DofusbookImportEntry, { ok: true }>];
    expect(build.weaponFm).toEqual({ damage: { element: 'fire', value: 100 }, steal: { element: 'air', value: 100 } });
    expect(build.slots.a1?.rolls).toEqual([{ line: 4, stat: 'critical', value: 7 }]);
    expect(build.slots.a1?.exos).toEqual([{ stat: 'mp', value: 1 }]);
    expect(build.slots.d6?.exos).toEqual([{ stat: 'damage', value: 20 }]);
    expect(migrateBuild(JSON.parse(JSON.stringify(build))).weaponFm).toEqual(build.weaponFm);
  });

  it('un tableau de deux réponses donne deux stuffs aux ids distincts', () => {
    const entries = ok(importDofusbook(api('stuffs-array') as unknown, { ...options, takenIds: ['bram-pelle-xa'] }));
    expect(entries.map((e) => e.build.source?.stuffId)).toEqual([23428650, 23428299]);
    expect(entries.map((e) => e.build.id)).toEqual(['terre-eau-lvl-200-ret-pm', 'bram-pelle-xa-2']);
  });

  it('un code inconnu finit dans source.unmapped et dans le rapport', () => {
    const response = api('stuff-23428650');
    response.stuff.stuffFm = { ...(response.stuff.stuffFm as object), fm: { pm: 1, po: 1, pvr: 3 } };
    response.stuff.stuffFmItem = { a1: { zzz: 5, vi: 240 } };
    const [{ build, report }] = ok(importDofusbook(response, options)) as [Extract<DofusbookImportEntry, { ok: true }>];
    expect(build.source?.unmapped).toEqual(['stuffFm.fm.pvr=3', 'stuffFmItem.a1.zzz=5']);
    expect(report.unmapped.map((u) => u.reason)).toEqual(['code DofusBook inconnu', 'code DofusBook inconnu']);
    expect(build.extras.map((e) => e.stat)).toEqual(['mp', 'range']);
    expect(build.slots.a1?.rolls).toEqual([{ line: 0, stat: 'vitality', value: 240 }]);
  });

  it('un official absent de nos données passe par le repli nom + niveau', () => {
    const response = api('stuff-23428650');
    const shield = response.items.find((item) => item.official === 32236)!;
    shield.official = 999999999;
    const [{ build, report }] = ok(importDofusbook(response, options)) as [Extract<DofusbookImportEntry, { ok: true }>];
    expect(build.slots.br?.itemId).toBe(32236);
    expect(report.fallback).toMatchObject([{ slot: 'br', resolution: 'nameLevel', itemId: 32236, official: 999999999 }]);

    shield.name = 'Disque inexistant';
    const [{ build: empty, report: missing }] = ok(importDofusbook(response, options)) as [Extract<DofusbookImportEntry, { ok: true }>];
    expect(empty.slots.br).toBeNull();
    expect(missing.missing).toMatchObject([{ slot: 'br', name: 'Disque inexistant', resolution: 'missing' }]);
  });

  it('une FM sur une stat présente sur plusieurs lignes vise la première et le signale', () => {
    const ring: Item = {
      id: 1, name: 'Anneau double', level: 200, typeId: 0, slot: 'ring', iconId: 0, setId: null, pods: 0, description: '',
      lines: [{ stat: 'strength', min: 1, max: 10 }, { stat: 'vitality', min: 1, max: 10 }, { stat: 'vitality', min: 1, max: 5 }],
      hits: [], texts: [], weapon: null, conditions: null, recipe: [],
    };
    const tiny = createDataset({ meta, types: [], items: [ring], sets: [] });
    const response = {
      stuff: { id: 7, name: 'Double', character_class: 1, character_level: 200, stuffItem: { a1: 55 }, stuffFmItem: { a1: { vi: 12 } } },
      items: [{ id: 55, official: 1, name: 'Anneau double', level: 200 }],
    };
    const [{ build, report }] = ok(importDofusbook(response, { dataset: tiny, now: NOW })) as [Extract<DofusbookImportEntry, { ok: true }>];
    expect(build.slots.a1?.rolls).toEqual([{ line: 1, stat: 'vitality', value: 12 }]);
    expect(report.warnings.join('\n')).toMatch(/2 lignes Vitalité.*première/);
  });

  it('un fichier « stuff seul » donne une erreur explicite', () => {
    const [entry] = importDofusbook(readFileSync(new URL('./fixtures/dofusbook/api/stuff-only-23428299.json', import.meta.url), 'utf8'), options);
    expect(entry).toMatchObject({ ok: false, stuffId: 23428299, name: 'Bram Pelle Xa' });
    expect(entry!.ok ? '' : entry!.error).toMatch(/réponse complète.*items\[\]\.official/);
    expect(importDofusbook('{pas du json', options)[0]).toMatchObject({ ok: false, error: expect.stringMatching(/JSON valide/) });
  });
});
