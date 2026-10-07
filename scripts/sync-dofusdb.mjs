#!/usr/bin/env node
// Synchronise les classes (breeds) et leurs sorts vers public/data/ : structure et noms depuis DofusDB, valeurs des niveaux de sorts depuis la dernière release dofusdude/dofus3-main.
import { mkdir, rename, writeFile } from 'node:fs/promises';

const API = 'https://api.dofusdb.fr';
const RELEASES = 'https://api.github.com/repos/dofusdude/dofus3-main/releases';
const OUT_DIR = new URL('../public/data/', import.meta.url);
const EXPECTED_BREEDS = 19;
const BATCH = 50;

const STAT_COSTS = {
  vitality: 'statsPointsForVitality',
  wisdom: 'statsPointsForWisdom',
  strength: 'statsPointsForStrength',
  intelligence: 'statsPointsForIntelligence',
  chance: 'statsPointsForChance',
  agility: 'statsPointsForAgility',
};

const { data, total } = await getJson('/breeds', { $limit: '50', '$sort[id]': '1' });
if (total !== EXPECTED_BREEDS || data.length !== total) {
  fail(`${total} classes reçues (${data.length} lues), ${EXPECTED_BREEDS} attendues : rien n'a été écrit.`);
}

const breeds = data.map((breed) => {
  const statCosts = Object.fromEntries(
    Object.entries(STAT_COSTS).map(([stat, field]) => {
      const tiers = breed[field];
      if (!Array.isArray(tiers) || !tiers.length) fail(`classe ${breed.id} : ${field} absent.`);
      return [stat, tiers];
    }),
  );
  return {
    id: breed.id,
    name: breed.shortName?.fr ?? `Classe ${breed.id}`,
    statCosts,
    spellIds: breed.breedSpellsId ?? [],
    img: breed.img ?? null,
  };
});

// Dofus 3 : chaque emplacement de sort a deux variantes ; breedSpellsId n'en liste qu'une.
const variants = await getAll('/spell-variants', ['id', 'breedId', 'spellIds']);
for (const breed of breeds) {
  breed.spellVariants = variants.filter((variant) => variant.breedId === breed.id).map((variant) => variant.spellIds);
}

const breedOfSpell = new Map(
  breeds.flatMap((breed) => [...breed.spellIds, ...breed.spellVariants.flat()].map((id) => [id, breed.id])),
);
const rawSpells = await getByIds('/spells', [...breedOfSpell.keys()], ['id', 'name', 'description', 'img', 'spellLevels']);
const dbLevels = await getByIds('/spell-levels', rawSpells.flatMap((spell) => spell.spellLevels ?? []));

// DofusDB peut avoir une version de retard : les valeurs chiffrées viennent des données du jeu en ligne.
const release = await latestRelease();
const liveLevels = await loadReleaseLevels(release);
const rawLevels = dbLevels.map((level) => withLiveValues(level, liveLevels.get(level.id)));
const overridden = dbLevels.filter((level) => liveLevels.has(level.id)).length;
const levelsById = new Map(rawLevels.map((level) => [level.id, level]));

const effectIds = new Set(rawLevels.flatMap((level) => [...level.effects, ...level.criticalEffect].map((effect) => effect.effectId)));
const rawEffects = await getByIds('/effects', [...effectIds]);
const effects = Object.fromEntries(
  rawEffects.map((effect) => [effect.id, {
    characteristic: effect.characteristic,
    elementId: effect.elementId,
    isInPercent: effect.isInPercent,
    category: effect.category,
    useDice: effect.useDice,
    active: effect.active,
    description: effect.description?.fr ?? '',
  }]),
);

const spells = rawSpells.map((spell) => ({
  id: spell.id,
  breedId: breedOfSpell.get(spell.id),
  name: spell.name?.fr ?? `Sort ${spell.id}`,
  description: spell.description?.fr ?? '',
  img: spell.img ?? null,
  levels: (spell.spellLevels ?? []).map((id) => {
    const level = levelsById.get(id);
    if (!level) fail(`niveau de sort ${id} (sort ${spell.id}) introuvable.`);
    return {
      id: level.id,
      grade: level.grade,
      minPlayerLevel: level.minPlayerLevel,
      apCost: level.apCost,
      minRange: level.minRange,
      range: level.range,
      rangeCanBeBoosted: level.rangeCanBeBoosted,
      criticalHitProbability: level.criticalHitProbability,
      maxCastPerTurn: level.maxCastPerTurn,
      maxCastPerTarget: level.maxCastPerTarget,
      castInLine: level.castInLine,
      castInDiagonal: level.castInDiagonal,
      castTestLos: level.castTestLos,
      effects: level.effects.map(toSpellEffect),
      criticalEffects: level.criticalEffect.map(toSpellEffect),
    };
  }),
}));

const missing = [...breedOfSpell.keys()].filter((id) => !spells.some((spell) => spell.id === id));
if (missing.length) fail(`${missing.length} sorts de classe introuvables (${missing.slice(0, 5).join(', ')}…) : rien n'a été écrit.`);

const fetchedAt = new Date().toISOString();
await mkdir(OUT_DIR, { recursive: true });
await writeAtomic('breeds.json', { source: API, fetchedAt, breeds });
const levelValues = { release: release.tag, overridden, fromDofusDbOnly: dbLevels.length - overridden };
await writeAtomic('spells.json', { source: API, fetchedAt, levelValues, effects, spells });

console.log(`${breeds.length} classes, ${spells.length} sorts, ${rawLevels.length} niveaux (${overridden} aux valeurs ${release.tag}), ${rawEffects.length} types d'effets → public/data/`);

async function latestRelease() {
  const res = await fetch(`${RELEASES}/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) fail(`${res.status} ${res.statusText} sur ${RELEASES}/latest`);
  const { tag_name: tag, assets } = await res.json();
  const asset = assets.find((candidate) => candidate.name === 'spell_levels.json');
  if (!asset) fail(`la release ${tag} de dofus3-main n'a pas de spell_levels.json.`);
  return { tag, url: asset.browser_download_url };
}

// Format Unity sérialisé : references.RefIds[].data, tableaux enveloppés dans { Array: [...] }.
async function loadReleaseLevels({ tag, url }) {
  const res = await fetch(url);
  if (!res.ok) fail(`${res.status} ${res.statusText} sur spell_levels.json (${tag})`);
  const { references } = await res.json();
  return new Map(references.RefIds.map(({ data }) => [data.id, data]));
}

function withLiveValues(level, live) {
  if (!live) return level;
  const effectsOf = (list) => (list?.Array ?? []).map((effect) => ({
    effectId: effect.actionId,
    effectElement: effect.effectElement,
    diceNum: effect.diceNum,
    diceSide: effect.diceSide,
    value: effect.value,
    duration: effect.duration,
    targetMask: effect.targetMask,
    triggers: effect.triggers,
    zoneDescr: effect.zoneDescr,
  }));
  return {
    ...level,
    grade: live.grade,
    minPlayerLevel: live.minPlayerLevel,
    apCost: live.apCost,
    minRange: live.minRange,
    range: live.range,
    criticalHitProbability: live.criticalHitProbability,
    maxCastPerTurn: live.maxCastPerTurn,
    maxCastPerTarget: live.maxCastPerTarget,
    effects: effectsOf(live.effects),
    criticalEffect: effectsOf(live.criticalEffect),
  };
}

function toSpellEffect(effect) {
  return {
    effectId: effect.effectId,
    element: effect.effectElement,
    diceNum: effect.diceNum,
    diceSide: effect.diceSide,
    value: effect.value,
    duration: effect.duration,
    targetMask: effect.targetMask,
    triggers: effect.triggers,
    zone: effect.zoneDescr ? { shape: effect.zoneDescr.shape, param1: effect.zoneDescr.param1, param2: effect.zoneDescr.param2 } : null,
  };
}

async function getByIds(path, ids, select) {
  const rows = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const params = new URLSearchParams({ $limit: String(BATCH) });
    for (const id of ids.slice(i, i + BATCH)) params.append('id[$in][]', String(id));
    for (const field of select ?? []) params.append('$select[]', field);
    const { data } = await getJson(path, params);
    rows.push(...data);
  }
  return rows;
}

async function getAll(path, select) {
  const rows = [];
  for (let skip = 0; ; skip += BATCH) {
    const params = new URLSearchParams({ $limit: String(BATCH), $skip: String(skip), '$sort[id]': '1' });
    for (const field of select) params.append('$select[]', field);
    const { data, total } = await getJson(path, params);
    rows.push(...data);
    if (!data.length || rows.length >= total) return rows;
  }
}

async function writeAtomic(name, payload) {
  const tmp = new URL(`${name}.tmp`, OUT_DIR);
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  await rename(tmp, new URL(name, OUT_DIR));
}

async function getJson(path, params) {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  if (!res.ok) fail(`${res.status} ${res.statusText} sur ${url}`);
  return res.json();
}

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}
