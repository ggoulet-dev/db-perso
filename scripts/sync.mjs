#!/usr/bin/env node
// Synchronise l'équipement et les panoplies de Dofus 3 depuis l'API dofusdude vers data/.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const API = 'https://api.dofusdu.de';
const CHANNELS = ['dofus3', 'dofus3beta'];
const LANGS = ['fr', 'en', 'es', 'de', 'pt'];
const DATA_DIR = new URL('../data/', import.meta.url);
// En dessous, on considère que l'extraction côté dofusdude a régressé (cf. 3.7.1.0 sans effets).
const MIN_COVERAGE = 0.95;

// Les listes /all omettent conditions et parent_set : on passe par la liste paginée sans limite.
const ITEM_FIELDS = [
  'recipe', 'description', 'conditions', 'effects', 'is_weapon', 'pods', 'parent_set',
  'critical_hit_probability', 'critical_hit_bonus', 'max_cast_per_turn', 'ap_cost', 'range',
];

const { values: args } = parseArgs({
  options: {
    channel: { type: 'string', default: 'dofus3' },
    lang: { type: 'string', default: 'fr' },
  },
});

if (!CHANNELS.includes(args.channel)) fail(`--channel doit valoir ${CHANNELS.join(' ou ')}.`);
if (!LANGS.includes(args.lang)) fail(`--lang doit valoir ${LANGS.join(', ')}.`);

const base = `/${args.channel}/v1`;

const version = await getJson(`${base}/meta/version`);
console.log(`Canal ${args.channel}, version ${version.version} (maj ${version.update_stamp})`);

const { items: equipment } = await getJson(`${base}/${args.lang}/items/equipment`, {
  'page[size]': '-1',
  'fields[item]': ITEM_FIELDS.join(','),
});
const { sets } = await getJson(`${base}/${args.lang}/sets`, {
  'page[size]': '-1',
  'fields[set]': 'effects,equipment_ids',
});

const equipmentCoverage = ratio(equipment, (item) => item.effects?.length > 0);
const setCoverage = ratio(
  sets.filter((set) => !set.contains_cosmetics_only),
  (set) => Object.values(set.effects ?? {}).some((bonuses) => bonuses?.length > 0),
);

for (const [label, value] of [['des équipements ont des effets', equipmentCoverage], ['des panoplies ont des bonus', setCoverage]]) {
  if (value < MIN_COVERAGE) {
    const hint = args.channel === 'dofus3' ? ' Réessaie avec --channel dofus3beta.' : '';
    fail(`Seulement ${percent(value)} ${label} sur ${args.channel} ${version.version} : données incomplètes, rien n'a été écrit.${hint}`);
  }
}

const meta = {
  source: API,
  channel: args.channel,
  lang: args.lang,
  game_version: version.version,
  release: version.release,
  update_stamp: version.update_stamp,
  synced_at: new Date().toISOString(),
  counts: { equipment: equipment.length, sets: sets.length },
  coverage: { equipment_effects: equipmentCoverage, set_bonuses: setCoverage },
};

await mkdir(DATA_DIR, { recursive: true });
await writeAtomic('equipment.json', JSON.stringify(equipment));
await writeAtomic('sets.json', JSON.stringify(sets));
await writeAtomic('meta.json', `${JSON.stringify(meta, null, 2)}\n`);

console.log(`${equipment.length} équipements (${percent(equipmentCoverage)} avec effets), ${sets.length} panoplies (${percent(setCoverage)} avec bonus) → data/`);

async function getJson(path, params) {
  const url = `${API}${path}${params ? `?${new URLSearchParams(params)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) fail(`${res.status} ${res.statusText} sur ${url}`);
  return res.json();
}

async function writeAtomic(name, content) {
  const target = new URL(name, DATA_DIR);
  const tmp = new URL(`${name}.tmp`, DATA_DIR);
  await writeFile(tmp, content);
  await rename(tmp, target);
}

function ratio(list, predicate) {
  return list.length ? list.filter(predicate).length / list.length : 0;
}

function percent(value) {
  return `${(value * 100).toFixed(1)} %`;
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}
