import { createBuild, SLOT_KEYS, SLOT_KIND, SLOT_LABELS, type Build, type SlotEntry, type SlotKey, type WeaponElementFm } from '../build/types';
import { normalizeText, type Dataset, type Item } from '../dataset';
import { dofusbookCode } from '../dofusbook-codes';
import type { MainStat } from '../rules';
import { STATS, type Element, type StatKey } from '../stats';

/**
 * Import d'une réponse de `GET https://www.dofusbook.net/api/stuffs/dofus/{public|private}/{id}`
 * (PLAN §4, DOFUS.md §10.3–10.5). Validation manuelle : le fichier vient de l'utilisateur.
 */

export interface DofusbookImportOptions {
  dataset: Pick<Dataset, 'items' | 'itemById' | 'meta'>;
  /** Classes connues : une classe absente est signalée. */
  breeds?: ReadonlyArray<{ id: number }>;
  /** Identifiants de stuffs déjà pris. */
  takenIds?: Iterable<string>;
  now?: string;
}

/** `official` : trouvé par id Ankama ; `nameLevel` : repli nom + niveau ; `missing` : emplacement laissé vide. */
export type ItemResolution = 'official' | 'nameLevel' | 'missing';

export interface ImportedItem {
  slot: SlotKey;
  dofusbookId: number;
  name: string;
  official: number | null;
  itemId: number | null;
  resolution: ItemResolution;
  note?: string;
}

export interface UnmappedLine {
  /** Où la ligne a été lue (`stuffFmItem.a1`, `stuffFm.fm`…). */
  where: string;
  code: string;
  value: unknown;
  reason: string;
}

export interface DofusbookImportReport {
  stuffId: number;
  name: string;
  resolved: ImportedItem[];
  fallback: ImportedItem[];
  missing: ImportedItem[];
  unmapped: UnmappedLine[];
  assumptions: string[];
  warnings: string[];
}

export type DofusbookImportEntry =
  | { ok: true; index: number; build: Build; report: DofusbookImportReport }
  | { ok: false; index: number; stuffId: number | null; name: string | null; error: string };

const API_URL = 'https://www.dofusbook.net/api/stuffs/dofus/private/{id}';
const STUFF_ONLY_ERROR =
  `Ce fichier ne contient que l'objet « stuff », sans « items » : il faut la réponse complète de ${API_URL} ` +
  `(ou public/{id}). stuffItem ne donne que des ids DofusBook ; seul items[].official permet de retrouver les objets.`;

const CARAC_CODES: Record<string, MainStat> = { vi: 'vitality', sa: 'wisdom', fo: 'strength', in: 'intelligence', ch: 'chance', ag: 'agility' };

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objet JSON, éventuellement encodé en chaîne ; PHP sérialise un objet vide en `[]`. */
function asRecord(value: unknown): Rec | null {
  if (isRecord(value)) return value;
  if (Array.isArray(value) && value.length === 0) return {};
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return undefined;
}

function isSlotKey(key: string): key is SlotKey {
  return (SLOT_KEYS as readonly string[]).includes(key);
}

function slugFor(name: string, used: Set<string>): string {
  const slug =
    normalizeText(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'stuff';
  let id = slug;
  for (let n = 2; used.has(id); n++) id = `${slug}-${n}`;
  used.add(id);
  return id;
}

class EntryError extends Error {}

/** Accepte une réponse, un tableau de réponses ou leur texte JSON ; une entrée par stuff, réussie ou non. */
export function importDofusbook(input: unknown, options: DofusbookImportOptions): DofusbookImportEntry[] {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return [{ ok: false, index: 0, stuffId: null, name: null, error: 'Fichier illisible : ce n\'est pas du JSON valide.' }];
    }
  }
  const responses = Array.isArray(data) ? data : [data];
  if (responses.length === 0) {
    return [{ ok: false, index: 0, stuffId: null, name: null, error: 'Le fichier contient un tableau vide : aucun stuff à importer.' }];
  }
  const used = new Set(options.takenIds ?? []);
  const now = options.now ?? new Date().toISOString();
  return responses.map((response, index): DofusbookImportEntry => {
    try {
      const { build, report } = importOne(response, options, used, now);
      return { ok: true, index, build, report };
    } catch (error) {
      if (!(error instanceof EntryError)) throw error;
      const stuff = isRecord(response) ? (asRecord(response.stuff) ?? response) : null;
      const name = typeof stuff?.name === 'string' ? stuff.name : null;
      const prefix = responses.length > 1 ? `Stuff n° ${index + 1}${name ? ` (${name})` : ''} : ` : '';
      return { ok: false, index, stuffId: num(stuff?.id) ?? null, name, error: prefix + error.message };
    }
  });
}

function importOne(raw: unknown, options: DofusbookImportOptions, used: Set<string>, now: string): { build: Build; report: DofusbookImportReport } {
  if (!isRecord(raw)) throw new EntryError('ce n\'est pas un objet JSON.');
  // Enveloppe `{source, data}` vue sur d'autres routes de l'API.
  const response = !('stuff' in raw) && isRecord(raw.data) && 'stuff' in raw.data ? raw.data : raw;
  const stuff = asRecord(response.stuff);
  if (!stuff) {
    if ('stuffItem' in response) throw new EntryError(STUFF_ONLY_ERROR);
    throw new EntryError(`ni « stuff » ni « items » : ce n'est pas une réponse de ${API_URL}.`);
  }
  if (!Array.isArray(response.items)) throw new EntryError(STUFF_ONLY_ERROR);
  const stuffItem = asRecord(stuff.stuffItem);
  if (!stuffItem) throw new EntryError('« stuff.stuffItem » absent ou illisible : emplacements inconnus.');
  const stuffId = num(stuff.id);
  if (stuffId === undefined) throw new EntryError('« stuff.id » absent ou non numérique.');

  const { dataset } = options;
  const name = typeof stuff.name === 'string' && stuff.name.trim() ? stuff.name.trim() : `Stuff DofusBook ${stuffId}`;
  const report: DofusbookImportReport = { stuffId, name, resolved: [], fallback: [], missing: [], unmapped: [], assumptions: [], warnings: [] };
  const unmapped = (where: string, code: string, value: unknown, reason: string) => report.unmapped.push({ where, code, value, reason });
  const deduced = new Map<string, StatKey>();
  const statOf = (code: string): { stat: StatKey } | { reason: string } => {
    const entry = dofusbookCode(code);
    if (!entry) return { reason: 'code DofusBook inconnu' };
    if (entry.kind !== 'stat') return { reason: entry.kind === 'hit' ? 'ligne de coup d\'arme, pas une stat' : 'ligne de texte, pas une stat' };
    if (entry.status === 'déduit') deduced.set(code, entry.stat);
    return { stat: entry.stat };
  };

  // Personnage
  const breedId = num(stuff.character_class);
  if (breedId === undefined) report.warnings.push('Classe absente (character_class) : coûts des caracs communs à toutes les classes.');
  else if (options.breeds && !options.breeds.some((b) => b.id === breedId)) report.warnings.push(`Classe ${breedId} inconnue de nos données.`);
  let level = num(stuff.character_level);
  if (level === undefined || !Number.isInteger(level) || level < 1 || level > 200) {
    report.warnings.push(`Niveau ${String(stuff.character_level)} illisible ou hors de 1–200 : niveau 200 retenu.`);
    level = 200;
  }

  const build = createBuild({ id: slugFor(name, used), name, dataVersion: dataset.meta.gameVersion, breedId: breedId ?? null, level, now });

  // Caracs
  const caracs = asRecord(stuff.stuffCarac);
  if (!caracs) report.warnings.push('stuffCarac absent : caracs et parchemins à 0.');
  for (const [key, value] of Object.entries(caracs ?? {})) {
    const match = /^(base|scroll)_(.+)$/.exec(key);
    if (!match) continue;
    const [, kind, code] = match as unknown as [string, 'base' | 'scroll', string];
    const carac = CARAC_CODES[code];
    if (!carac) {
      unmapped('stuffCarac', key, value, 'carac inconnue');
      continue;
    }
    const n = num(value);
    if (n === undefined || n < 0) {
      report.warnings.push(`stuffCarac.${key} = ${JSON.stringify(value)} illisible : 0 retenu.`);
      continue;
    }
    build.caracs[kind === 'base' ? 'base' : 'scrolls'][carac] = n;
  }

  // FM globale
  const stuffFm = asRecord(stuff.stuffFm) ?? {};
  const globalFm = asRecord(stuffFm.fm) ?? asRecord(response.fmGlobal) ?? parseCodeValueLists(stuffFm.caracs, stuffFm.values);
  for (const [code, value] of Object.entries(globalFm)) {
    const n = num(value);
    const mapped = statOf(code);
    if (n === undefined) unmapped('stuffFm.fm', code, value, 'valeur non numérique');
    else if ('reason' in mapped) unmapped('stuffFm.fm', code, value, mapped.reason);
    else build.extras.push({ label: 'FM globale DofusBook', stat: mapped.stat, value: n });
  }

  // FM élémentaire d'arme
  const damage = weaponElement(stuffFm.weapon !== undefined ? stuffFm.weapon : response.fmWeapon, 'damage', 'stuffFm.weapon', unmapped);
  const steal = weaponElement(stuffFm.steal !== undefined ? stuffFm.steal : response.fmStealWeapon, 'steal', 'stuffFm.steal', unmapped);
  if (damage || steal) build.weaponFm = { damage, steal };
  const heal = stuffFm.heal !== undefined ? stuffFm.heal : response.fmHealWeapon;
  if (heal !== null && heal !== undefined && heal !== '') unmapped('stuffFm.heal', 'heal', heal, 'format de la FM de soin d\'arme inconnu');

  // FM par objet : stuffFmItem fait foi, fmItems en secours
  const fmByStuff = asRecord(stuff.stuffFmItem);
  const fmByRoot = asRecord(response.fmItems);
  const fmItems = fmByStuff && Object.keys(fmByStuff).length ? fmByStuff : (fmByRoot ?? {});
  if (fmByStuff && fmByRoot && Object.keys(fmByRoot).length && !sameFm(fmByStuff, fmByRoot)) {
    report.warnings.push('stuffFmItem et fmItems diffèrent : stuffFmItem retenu.');
  }
  for (const key of Object.keys(fmItems)) {
    if (!isSlotKey(key)) unmapped('stuffFmItem', key, fmItems[key], 'emplacement inconnu');
  }

  // Objets
  const itemsById = new Map<number, Rec>();
  for (const entry of response.items) {
    const id = isRecord(entry) ? num(entry.id) : undefined;
    if (id !== undefined && !itemsById.has(id)) itemsById.set(id, entry as Rec);
  }
  for (const [key, value] of Object.entries(stuffItem)) {
    if (!isSlotKey(key) && value !== null) unmapped('stuffItem', key, value, 'emplacement inconnu');
  }
  for (const slot of SLOT_KEYS) {
    const fm = asRecord(fmItems[slot]) ?? {};
    const dofusbookId = num(stuffItem[slot]);
    if (dofusbookId === undefined || dofusbookId === 0) {
      for (const [code, value] of Object.entries(fm)) unmapped(`stuffFmItem.${slot}`, code, value, 'FM sur un emplacement vide');
      continue;
    }
    const resolved = resolveItem(slot, dofusbookId, itemsById.get(dofusbookId), dataset);
    report[resolved.info.resolution === 'official' ? 'resolved' : resolved.info.resolution === 'nameLevel' ? 'fallback' : 'missing'].push(resolved.info);
    const { item } = resolved;
    if (!item) {
      for (const [code, value] of Object.entries(fm)) unmapped(`stuffFmItem.${slot}`, code, value, 'objet introuvable');
      continue;
    }
    if (item.slot !== SLOT_KIND[slot]) report.warnings.push(`${SLOT_LABELS[slot]} : ${item.name} ne se porte normalement pas à cet emplacement.`);
    const entry: SlotEntry = { itemId: item.id, itemName: item.name, rolls: [], exos: [] };
    for (const [code, value] of Object.entries(fm)) {
      const n = num(value);
      const mapped = statOf(code);
      if (n === undefined) {
        unmapped(`stuffFmItem.${slot}`, code, value, 'valeur non numérique');
        continue;
      }
      if ('reason' in mapped) {
        unmapped(`stuffFmItem.${slot}`, code, value, mapped.reason);
        continue;
      }
      const lines = item.lines.flatMap((line, index) => (line.stat === mapped.stat ? [index] : []));
      const [first] = lines;
      if (first === undefined) {
        entry.exos.push({ stat: mapped.stat, value: n });
        continue;
      }
      entry.rolls.push({ line: first, stat: mapped.stat, value: n });
      if (lines.length > 1) {
        report.warnings.push(`${SLOT_LABELS[slot]} (${item.name}) : ${lines.length} lignes ${STATS[mapped.stat].label}, la FM (${n}) est appliquée à la première.`);
      }
    }
    build.slots[slot] = entry;
  }

  report.assumptions.push(
    `Objets lus dans nos données (${dataset.meta.gameVersion}) via items[].official ; les effets décrits dans items[] ne sont pas utilisés.`,
    'Lignes sans FM : jet parfait (max), comme DofusBook.',
    'stuffCarac : base_* = valeur de carac visée (pas des points), scroll_* = parchemins.',
    'FM par objet : code présent sur l\'objet = valeur absolue de la ligne (over possible) ; code absent = exo.',
    'Panoplies recalculées à partir de nos données ; « cloths » est ignoré.',
  );
  if (build.extras.length) report.assumptions.push('FM globale (stuffFm.fm) ajoutée aux bonus hors objet.');
  if (build.weaponFm) report.assumptions.push('FM élémentaire d\'arme enregistrée sans effet sur les totaux : son effet sur les coups n\'est pas vérifié.');
  for (const [code, stat] of deduced) report.assumptions.push(`Code « ${code} » traduit en ${STATS[stat].label} : correspondance déduite, non confirmée.`);

  build.source = {
    kind: 'dofusbook',
    stuffId,
    importedAt: now,
    unmapped: report.unmapped.map((u) => `${u.where}.${u.code}=${JSON.stringify(u.value)}`),
  };
  return { build, report };
}

/** `stuffFm.caracs = "pm,po"`, `values = "1,1"`. */
function parseCodeValueLists(codes: unknown, values: unknown): Rec {
  if (typeof codes !== 'string' || typeof values !== 'string' || !codes.trim()) return {};
  const vs = values.split(',');
  return Object.fromEntries(codes.split(',').map((code, i) => [code.trim(), vs[i]?.trim()]));
}

function sameFm(a: Rec, b: Rec): boolean {
  const norm = (r: Rec) => Object.fromEntries(SLOT_KEYS.map((slot) => [slot, asRecord(r[slot]) ?? {}]));
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** « df-100 » : code de coup d'arme DofusBook + valeur. */
function weaponElement(
  raw: unknown,
  kind: 'damage' | 'steal',
  where: string,
  unmapped: (where: string, code: string, value: unknown, reason: string) => void,
): WeaponElementFm | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const match = typeof raw === 'string' ? /^([a-z]+)-(\d+)$/.exec(raw.trim()) : null;
  if (!match) {
    unmapped(where, String(raw), raw, 'format attendu « code-valeur » (ex. df-100)');
    return null;
  }
  const [, code, value] = match as unknown as [string, string, string];
  const entry = dofusbookCode(code);
  if (entry?.kind !== 'hit' || entry.hit !== kind || entry.element === null || entry.element === 'best') {
    unmapped(where, code, raw, kind === 'damage' ? 'pas un code de dommages élémentaires d\'arme' : 'pas un code de vol élémentaire d\'arme');
    return null;
  }
  return { element: entry.element as Element, value: Number(value) };
}

function resolveItem(
  slot: SlotKey,
  dofusbookId: number,
  raw: Rec | undefined,
  dataset: Pick<Dataset, 'items' | 'itemById'>,
): { item: Item | null; info: ImportedItem } {
  const name = typeof raw?.name === 'string' ? raw.name : '';
  const official = num(raw?.official) ?? null;
  const base = { slot, dofusbookId, name, official };
  if (!raw) {
    return { item: null, info: { ...base, itemId: null, resolution: 'missing', note: `id DofusBook ${dofusbookId} absent de items[]` } };
  }
  const byOfficial = official === null ? undefined : dataset.itemById.get(official);
  if (byOfficial) return { item: byOfficial, info: { ...base, itemId: byOfficial.id, resolution: 'official' } };

  const why = official === null ? 'official absent' : `official ${official} absent de nos données`;
  const level = num(raw.level);
  const wanted = normalizeText(name);
  const candidates = name ? dataset.items.filter((item) => normalizeText(item.name) === wanted && (level === undefined || item.level === level)) : [];
  const fitting = candidates.filter((item) => item.slot === SLOT_KIND[slot]);
  const pool = fitting.length ? fitting : candidates;
  const [found] = pool;
  if (!found) {
    return { item: null, info: { ...base, itemId: null, resolution: 'missing', note: `${why} ; aucun objet « ${name} »${level === undefined ? '' : ` de niveau ${level}`}` } };
  }
  const ambiguity = pool.length > 1 ? ` ; ${pool.length} objets possibles, le premier (${found.id}) est retenu` : '';
  return { item: found, info: { ...base, itemId: found.id, resolution: 'nameLevel', note: `${why} ; retrouvé par nom${level === undefined ? '' : ' + niveau'}${ambiguity}` } };
}
