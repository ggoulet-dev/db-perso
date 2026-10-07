import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBuild, SLOT_KIND, type Build, type SlotEntry, type SlotKey } from '../src/domain/build/types';
import { createDataset, type DatasetMeta, type Item, type ItemSet, type ItemsFile, type Line } from '../src/domain/dataset';
import { dofusbookCode, dofusbookStat } from '../src/domain/dofusbook-codes';
import { computeBuild, type BuildResult, type EngineDataset } from '../src/domain/engine';
import type { BreedsFile, MainStat } from '../src/domain/rules';
import { STATS, type StatKey } from '../src/domain/stats';

interface FixtureItem {
  slot: SlotKey;
  official: number;
  name: string;
  effects: Array<[code: string, type: string, a: number, b: number]>;
}

interface Fixture {
  stuff: {
    id: number;
    name: string;
    character_class: number;
    character_level: number;
    stuffCarac: Record<string, number>;
    stuffFm: { fm: Record<string, number> };
    stuffFmItem: Record<string, Record<string, number>> | null;
  };
  items: FixtureItem[];
  activeSetBonuses: Array<{ id: number; name: string; pieces: number; effects: Array<[string, number]> }>;
  expectedTotals: Record<string, number | Record<string, unknown>>;
}

const FIXTURES = ['stuff-23428650', 'stuff-23428299'] as const;
// Points dépensés recalculés à la main : 495 + 498 (Féca), 423 + 1 + 570 (Huppermage).
const POINTS_SPENT: Record<(typeof FIXTURES)[number], number> = { 'stuff-23428650': 993, 'stuff-23428299': 994 };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

const { types, items } = readJson<ItemsFile>('../public/data/items.json');
const dataset = createDataset({
  meta: readJson<DatasetMeta>('../public/data/meta.json'),
  types,
  items,
  sets: readJson<ItemSet[]>('../public/data/sets.json'),
});
const { breeds } = readJson<BreedsFile>('../public/data/breeds.json');

const CARAC_CODES: Record<string, MainStat> = { vi: 'vitality', sa: 'wisdom', fo: 'strength', in: 'intelligence', ch: 'chance', ag: 'agility' };

function stat(code: string): StatKey {
  const key = dofusbookStat(code);
  if (!key) throw new Error(`code DofusBook ${code} non traduit`);
  return key;
}

/** DofusBook stocke un malus avec min = la valeur la plus proche de 0 ; chez nous max = meilleur jet. */
function fixtureLines(item: FixtureItem): Line[] {
  return item.effects
    .filter(([code, type]) => {
      if (!dofusbookCode(code)) throw new Error(`${item.name} : code DofusBook ${code} inconnu`);
      return type === 'E';
    })
    .map(([code, , a, b]) => ({ stat: stat(code), min: Math.min(a, b), max: Math.max(a, b) }));
}

/** Panoplie d'un objet selon notre dataset : seule source de l'appartenance, absente du fixture. */
function setIdOf(itemId: number): number | null {
  return dataset.itemById.get(itemId)?.setId ?? dataset.sets.find((set) => set.itemIds.includes(itemId))?.id ?? null;
}

/** Dataset fait uniquement des objets et des paliers actifs du fixture. */
function fixtureDataset(fixture: Fixture): EngineDataset {
  const fixtureItems: Item[] = fixture.items.map((fi) => ({
    id: fi.official,
    name: fi.name,
    level: 200,
    typeId: 0,
    slot: SLOT_KIND[fi.slot],
    iconId: 0,
    setId: setIdOf(fi.official),
    pods: 0,
    description: '',
    lines: fixtureLines(fi),
    hits: [],
    texts: [],
    weapon: null,
    conditions: null,
    recipe: [],
  }));
  const setIds = new Set(fixtureItems.flatMap((item) => (item.setId === null ? [] : [item.setId])));
  const sets: ItemSet[] = [...setIds].map((id) => {
    const active = fixture.activeSetBonuses.find((set) => set.id === id);
    return {
      id,
      name: active?.name ?? '',
      level: 0,
      itemIds: dataset.setById.get(id)?.itemIds ?? [],
      bonuses: active
        ? [{ pieces: active.pieces, lines: active.effects.map(([code, value]) => ({ stat: stat(code), min: value, max: value })), texts: [] }]
        : [],
    };
  });
  return { itemById: new Map(fixtureItems.map((item) => [item.id, item])), setById: new Map(sets.map((set) => [set.id, set])) };
}

/** FM par objet : valeur absolue si la ligne existe, exo sinon ; FM globale en extras. */
function fixtureBuild(fixture: Fixture, data: EngineDataset): Build {
  const { stuff } = fixture;
  const build = createBuild({ id: String(stuff.id), name: stuff.name, dataVersion: '3.7', breedId: stuff.character_class, level: stuff.character_level });
  for (const [code, carac] of Object.entries(CARAC_CODES)) {
    build.caracs.base[carac] = stuff.stuffCarac[`base_${code}`] ?? 0;
    build.caracs.scrolls[carac] = stuff.stuffCarac[`scroll_${code}`] ?? 0;
  }
  build.extras = Object.entries(stuff.stuffFm.fm).map(([code, value]) => ({ label: 'FM globale', stat: stat(code), value }));
  for (const fi of fixture.items) {
    const item = data.itemById.get(fi.official);
    if (!item) throw new Error(`${fi.name} (${fi.official}) introuvable`);
    const entry: SlotEntry = { itemId: item.id, itemName: item.name, rolls: [], exos: [] };
    for (const [code, value] of Object.entries(stuff.stuffFmItem?.[fi.slot] ?? {})) {
      const key = stat(code);
      const line = item.lines.findIndex((l) => l.stat === key);
      if (line >= 0) entry.rolls.push({ line, stat: key, value });
      else entry.exos.push({ stat: key, value });
    }
    build.slots[fi.slot] = entry;
  }
  return build;
}

const EFFECTIVE: Record<string, 'strength' | 'intelligence' | 'chance' | 'agility'> = {
  force: 'strength',
  intelligence: 'intelligence',
  chance: 'chance',
  agilite: 'agility',
};
const SHOWN_DAMAGE = { doNeutre: 'neutral', doTerre: 'earth', doFeu: 'fire', doEau: 'water', doAir: 'air' } as const;
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

/** Valeurs affichées par DofusBook, lues dans le résultat du moteur. */
function shown(result: BuildResult): Record<string, number> {
  const out: Record<string, number> = { pdv: result.derived.hp };
  for (const [key, element] of Object.entries(SHOWN_DAMAGE)) out[key] = result.derived.shownDamage[element];
  for (const [key, statKey] of Object.entries(TOTAL_KEYS)) out[key] = result.totals[statKey];
  for (const [key, carac] of Object.entries(EFFECTIVE)) out[`effectif.${key}`] = result.derived.effectiveForDamage[carac];
  return out;
}

function expected(fixture: Fixture): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(fixture.expectedTotals)) {
    if (typeof value === 'number') out[key] = value;
  }
  const effective = fixture.expectedTotals._effectiveStatsShownForDamage as Record<string, unknown>;
  for (const key of Object.keys(EFFECTIVE)) out[`effectif.${key}`] = effective[key] as number;
  return out;
}

/** Contribution d'un objet par stat, jets parfaits et FM de l'emplacement appliquée. */
function itemContribution(lines: Line[], fm: Record<string, number>): Map<StatKey, number> {
  const values = lines.map((line) => ({ stat: line.stat, value: line.max }));
  for (const [code, value] of Object.entries(fm)) {
    const key = stat(code);
    const line = values.find((l) => l.stat === key);
    if (line) line.value = value;
    else values.push({ stat: key, value });
  }
  const out = new Map<StatKey, number>();
  for (const { stat: key, value } of values) out.set(key, (out.get(key) ?? 0) + value);
  return out;
}

function diffInto(delta: Map<StatKey, number>, after: Map<StatKey, number>, before: Map<StatKey, number>): string[] {
  const changed: string[] = [];
  for (const key of new Set([...after.keys(), ...before.keys()])) {
    const d = (after.get(key) ?? 0) - (before.get(key) ?? 0);
    if (d === 0) continue;
    delta.set(key, (delta.get(key) ?? 0) + d);
    changed.push(`${STATS[key].label} ${d > 0 ? '+' : ''}${d}`);
  }
  return changed;
}

describe.each(FIXTURES)('stuff DofusBook %s', (name) => {
  const fixture = readJson<Fixture>(`./fixtures/dofusbook/${name}.json`);

  it('les objets du fixture redonnent exactement tous les totaux de DofusBook', () => {
    const data = fixtureDataset(fixture);
    const result = computeBuild(fixtureBuild(fixture, data), data, breeds);

    expect(shown(result)).toEqual(expected(fixture));
    const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;
    expect(result.sets.filter((set) => set.bonus).map(({ setId, pieces }) => ({ id: setId, pieces })).sort(byId))
      .toEqual(fixture.activeSetBonuses.map(({ id, pieces }) => ({ id, pieces })).sort(byId));
    expect(result.points).toMatchObject({ spent: POINTS_SPENT[name], available: 995 });
    expect(result.warnings).toEqual([]);
  });

  it('résolus dans notre dataset, les objets ne diffèrent que par des lignes expliquées', () => {
    const missing = fixture.items.filter((fi) => !dataset.itemById.has(fi.official)).map((fi) => `${fi.name} (${fi.official})`);
    expect(missing, 'objets introuvables par official').toEqual([]);

    const fixtureData = fixtureDataset(fixture);
    const reference = computeBuild(fixtureBuild(fixture, fixtureData), fixtureData, breeds);
    const actual = computeBuild(fixtureBuild(fixture, dataset), dataset, breeds);

    // Écart attendu par stat, calculé sur les définitions d'objets et de paliers, sans le moteur.
    const delta = new Map<StatKey, number>();
    const explanations: string[] = [];
    for (const fi of fixture.items) {
      const fm = fixture.stuff.stuffFmItem?.[fi.slot] ?? {};
      const changed = diffInto(delta, itemContribution(dataset.itemById.get(fi.official)!.lines, fm), itemContribution(fixtureLines(fi), fm));
      if (changed.length) explanations.push(`${fi.slot} ${fi.name} : ${changed.join(', ')}`);
    }
    for (const active of fixture.activeSetBonuses) {
      const ours = dataset.setById.get(active.id)?.bonuses.find((b) => b.pieces === active.pieces)?.lines ?? [];
      const theirs = active.effects.map(([code, value]) => ({ stat: stat(code), min: value, max: value }));
      const changed = diffInto(delta, itemContribution(ours, {}), itemContribution(theirs, {}));
      if (changed.length) explanations.push(`${active.name} (${active.pieces} pièces) : ${changed.join(', ')}`);
    }

    const explainedBuild = fixtureBuild(fixture, fixtureData);
    explainedBuild.extras.push(...[...delta].map(([key, value]) => ({ label: 'écart de données', stat: key, value })));
    const explained = shown(computeBuild(explainedBuild, fixtureData, breeds));

    const want = expected(fixture);
    const got = shown(actual);
    const rows = Object.keys(want)
      .filter((key) => got[key] !== want[key])
      .map((key) => ({ total: key, dofusbook: want[key], dataset: got[key], explique: explained[key] === got[key] }));
    if (rows.length) {
      console.log(`${name} — écarts avec notre dataset ${dataset.meta.gameVersion} :\n  ${explanations.join('\n  ')}`);
      console.table(rows);
    }

    expect(reference.sets.map((s) => [s.setId, s.pieces])).toEqual(actual.sets.map((s) => [s.setId, s.pieces]));
    expect(rows.filter((row) => !row.explique), 'écarts non expliqués par une différence de lignes').toEqual([]);
  });
});
