#!/usr/bin/env node
// Normalise le dump dofusdude de data/ en dataset compact dans public/data/.
// Seul endroit qui connaît le format dofusdude ; les tables vivent dans src/domain/stats.ts.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { DOFUSDUDE_EFFECTS, DOFUSDUDE_ITEM_TYPES, conditionKeyOf } from '../src/domain/stats.ts';
import { DATASET_SCHEMA } from '../src/domain/dataset.ts';

const DATA_DIR = new URL('../data/', import.meta.url);
const OUT_DIR = new URL('../public/data/', import.meta.url);
const ICON_RE = /\/img\/item\/(\d+)-64\.png$/;
const OPERATORS = new Set(['<', '>', '=']);

const errors = [];
const inverted = [];

const meta = await readJson('meta.json');
const equipment = await readJson('equipment.json');
const rawSets = await readJson('sets.json');

await checkMetaElements();

const items = [];
const types = new Map();
for (const raw of equipment) {
  const where = `objet ${raw.ankama_id} « ${raw.name} »`;
  if (!Object.hasOwn(DOFUSDUDE_ITEM_TYPES, raw.type.id)) {
    errors.push(`${where} : type d'objet ${raw.type.id} « ${raw.type.name} » absent de DOFUSDUDE_ITEM_TYPES (emplacement ou hors joueur ?)`);
    continue;
  }
  const slot = DOFUSDUDE_ITEM_TYPES[raw.type.id];
  const strict = slot !== null;
  if (!types.has(raw.type.id)) types.set(raw.type.id, { id: raw.type.id, name: raw.type.name, slot });

  const iconMatch = ICON_RE.exec(raw.image_urls?.icon ?? '');
  if (!iconMatch) errors.push(`${where} : URL d'icône inattendue ${raw.image_urls?.icon}`);
  const iconId = Number(iconMatch?.[1] ?? 0);

  const { lines, hits, texts } = convertEffects(raw.effects ?? [], where, strict);
  items.push({
    id: raw.ankama_id,
    name: raw.name,
    level: raw.level,
    typeId: raw.type.id,
    slot,
    iconId,
    setId: raw.parent_set?.id ?? null,
    pods: raw.pods ?? 0,
    description: raw.description ?? '',
    lines,
    hits,
    texts,
    weapon: raw.is_weapon
      ? {
          apCost: raw.ap_cost,
          minRange: raw.range.min,
          maxRange: raw.range.max,
          critProbability: raw.critical_hit_probability,
          critBonus: raw.critical_hit_bonus,
          maxCastPerTurn: raw.max_cast_per_turn,
        }
      : null,
    conditions: raw.conditions ? convertCondition(raw.conditions, where, strict) : null,
    recipe: (raw.recipe ?? []).map((r) => ({ itemId: r.item_ankama_id, quantity: r.quantity })),
  });
}
items.sort((a, b) => a.id - b.id);
const itemById = new Map(items.map((item) => [item.id, item]));
if (itemById.size !== items.length) errors.push('ankama_id en double dans equipment.json');

const sets = [];
let droppedSets = 0;
let ignoredSetItemIds = 0;
for (const raw of rawSets) {
  const where = `panoplie ${raw.ankama_id} « ${raw.name} »`;
  // Les ids absents du dump sont des cosmétiques, pas une perte de données.
  const itemIds = raw.equipment_ids.filter((id) => itemById.has(id));
  ignoredSetItemIds += raw.equipment_ids.length - itemIds.length;
  if (itemIds.length === 0) {
    droppedSets++;
    continue;
  }
  const bonuses = [];
  for (const [pieces, effects] of Object.entries(raw.effects ?? {})) {
    if (!effects?.length) continue;
    const { lines, hits, texts } = convertEffects(effects, `${where} (${pieces} pièces)`, true);
    if (hits.length) errors.push(`${where} : coup d'arme dans un bonus de panoplie`);
    bonuses.push({ pieces: Number(pieces), lines, texts });
  }
  bonuses.sort((a, b) => a.pieces - b.pieces);
  sets.push({ id: raw.ankama_id, name: raw.name, level: raw.level, itemIds, bonuses });
}
sets.sort((a, b) => a.id - b.id);
const setIds = new Set(sets.map((set) => set.id));
for (const item of items) {
  if (item.setId !== null && !setIds.has(item.setId)) errors.push(`objet ${item.id} : panoplie ${item.setId} introuvable`);
}

if (errors.length) {
  console.error(`build-data : ${errors.length} erreur(s), rien n'a été écrit.`);
  for (const error of errors.slice(0, 30)) console.error(`  - ${error}`);
  if (errors.length > 30) console.error(`  … et ${errors.length - 30} autres`);
  process.exit(1);
}

const playerItems = items.filter((item) => item.slot !== null).length;
const outMeta = {
  schema: DATASET_SCHEMA,
  source: meta.source,
  channel: meta.channel,
  lang: meta.lang,
  gameVersion: meta.game_version,
  syncedAt: meta.synced_at,
  counts: {
    items: items.length,
    playerItems,
    excludedItems: items.length - playerItems,
    sets: sets.length,
    droppedSets,
    ignoredSetItemIds,
  },
};

await mkdir(OUT_DIR, { recursive: true });
const sortedTypes = [...types.values()].sort((a, b) => a.id - b.id);
await writeAtomic('items.json', `{"types":${jsonRows(sortedTypes)},\n"items":${jsonRows(items)}}\n`);
await writeAtomic('sets.json', `${jsonRows(sets)}\n`);
await writeAtomic('meta.json', `${JSON.stringify(outMeta, null, 2)}\n`);

for (const line of inverted) console.warn(`attention : ${line}`);
console.log(
  `${items.length} objets (${playerItems} joueur, ${items.length - playerItems} hors joueur), ` +
    `${sets.length} panoplies (${droppedSets} cosmétiques écartées) → public/data/ (${meta.channel} ${meta.game_version})`,
);

// Le type.id dofusdude est un index dans meta/elements : on vérifie que chaque index porte encore le nom attendu.
async function checkMetaElements() {
  const url = `${meta.source}/${meta.channel}/v1/meta/elements`;
  let elements;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    elements = await res.json();
  } catch (error) {
    fail(`impossible de lire ${url} (${error.message}) : la table type.id → stat ne peut pas être vérifiée.`);
  }
  const mismatches = [];
  for (const [id, entry] of Object.entries(DOFUSDUDE_EFFECTS)) {
    const actual = elements[Number(id)] ?? null;
    if (actual !== entry.metaName) {
      mismatches.push(`  - index ${id} : attendu ${JSON.stringify(entry.metaName)}, obtenu ${JSON.stringify(actual)}`);
    }
  }
  if (mismatches.length) {
    fail(`meta/elements a changé (${url}) : les type.id ont pu glisser, mets à jour DOFUSDUDE_EFFECTS.\n${mismatches.join('\n')}`);
  }
}

function convertEffects(effects, where, strict) {
  const lines = [];
  const hits = [];
  const texts = [];
  for (const effect of effects) {
    const { id, name } = effect.type;
    const entry = DOFUSDUDE_EFFECTS[id];
    if (!entry) {
      if (strict) errors.push(`${where} : type d'effet ${id} « ${name} » absent de DOFUSDUDE_EFFECTS (« ${effect.formatted} »)`);
      texts.push({ tag: 'other', text: effect.formatted });
      continue;
    }
    if ((entry.kind === 'hit') !== effect.type.is_active) {
      errors.push(`${where} : type d'effet ${id} classé « ${entry.kind} » mais is_active=${effect.type.is_active}`);
    }
    if (entry.kind === 'stat') {
      if (!isCalculable(effect)) errors.push(`${where} : type d'effet ${id} classé « stat » mais non calculable selon dofusdude`);
      const [min, max] = bounds(effect, where);
      lines.push({ stat: entry.stat, min, max });
    } else if (entry.kind === 'hit') {
      const [a, b] = bounds(effect, where).map(Math.abs);
      hits.push({ kind: entry.hit, element: entry.element, min: Math.min(a, b), max: Math.max(a, b) });
    } else if (entry.kind === 'text') {
      texts.push(entry.tag === 'spellModifier'
        ? { tag: entry.tag, text: effect.formatted, spellId: effect.int_minimum }
        : { tag: entry.tag, text: effect.formatted });
    } else {
      errors.push(`${where} : type d'effet ${id} réservé aux conditions`);
    }
  }
  return { lines, hits, texts };
}

// Règles de PLAN §1 ; la table reste l'autorité, ceci n'en est que le contrôle de cohérence.
function isCalculable(effect) {
  return !effect.type.is_meta && !effect.type.is_active
    && !(effect.ignore_int_min && effect.ignore_int_max)
    && !effect.type.name.startsWith(':');
}

// ignore_int_max : valeur fixe = int_minimum. Malus : min = -40, max = -11.
function bounds(effect, where) {
  if (effect.ignore_int_max) return [effect.int_minimum, effect.int_minimum];
  if (effect.int_minimum > effect.int_maximum) {
    inverted.push(`${where} : bornes inversées « ${effect.formatted} » (${effect.int_minimum} > ${effect.int_maximum}), remises dans l'ordre`);
    return [effect.int_maximum, effect.int_minimum];
  }
  return [effect.int_minimum, effect.int_maximum];
}

function convertCondition(node, where, strict) {
  if (node.is_operand) {
    const { operator, int_value: value, element } = node.condition;
    const key = conditionKeyOf(element.id);
    if (!key || !OPERATORS.has(operator)) {
      if (strict) errors.push(`${where} : condition inconnue ${element.id} « ${element.name} » ${operator} ${value}`);
      return null;
    }
    return { kind: 'test', key, operator, value };
  }
  if (node.relation !== 'and' && node.relation !== 'or') {
    if (strict) errors.push(`${where} : relation de condition inconnue « ${node.relation} »`);
    return null;
  }
  const children = node.children.map((child) => convertCondition(child, where, strict)).filter(Boolean);
  return children.length ? { kind: node.relation, children } : null;
}

// Une ligne par enregistrement : fichiers versionnés, diffs lisibles.
function jsonRows(rows) {
  return `[\n${rows.map((row) => JSON.stringify(row)).join(',\n')}\n]`;
}

async function readJson(name) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA_DIR), 'utf8'));
  } catch (error) {
    fail(`lecture de data/${name} impossible (${error.message}) : lance d'abord npm run sync:beta.`);
  }
}

async function writeAtomic(name, content) {
  const target = new URL(name, OUT_DIR);
  const tmp = new URL(`${name}.tmp`, OUT_DIR);
  await writeFile(tmp, content);
  await rename(tmp, target);
}

function fail(message) {
  console.error(`build-data : ${message}`);
  process.exit(1);
}
