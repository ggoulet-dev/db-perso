import { MAIN_STATS } from '../rules';
import { ELEMENTS } from '../stats';
import { BUILD_SCHEMA_VERSION, SLOT_KEYS, type Build, type WeaponElementFm, type WeaponFm } from './types';

type RawBuild = Record<string, unknown> & { schemaVersion: number };

/** `MIGRATIONS[n]` fait passer un stuff du schéma n au schéma n + 1. */
export const MIGRATIONS: Record<number, (build: RawBuild) => RawBuild> = {};

export class BuildFormatError extends Error {}

/** Lit un stuff stocké (fichier JSON) et le porte au schéma courant. */
export function migrateBuild(raw: unknown): Build {
  if (typeof raw !== 'object' || raw === null || typeof (raw as RawBuild).schemaVersion !== 'number') {
    throw new BuildFormatError('Stuff illisible : schemaVersion absent.');
  }
  let build = raw as RawBuild;
  if (build.schemaVersion > BUILD_SCHEMA_VERSION) {
    throw new BuildFormatError(`Stuff au schéma ${build.schemaVersion}, plus récent que l'app (${BUILD_SCHEMA_VERSION}).`);
  }
  while (build.schemaVersion < BUILD_SCHEMA_VERSION) {
    const step = MIGRATIONS[build.schemaVersion];
    if (!step) throw new BuildFormatError(`Aucune migration depuis le schéma ${build.schemaVersion}.`);
    build = step(build);
  }
  return normalize(build as unknown as Build);
}

// Tolère un fichier édité à la main auquel il manque des emplacements ou des caracs.
function normalize(build: Build): Build {
  if (typeof build.id !== 'string' || typeof build.character !== 'object' || typeof build.caracs !== 'object') {
    throw new BuildFormatError('Stuff illisible : id, character ou caracs absent.');
  }
  const slots = { ...build.slots };
  for (const key of SLOT_KEYS) slots[key] ??= null;
  const base = { ...build.caracs.base };
  const scrolls = { ...build.caracs.scrolls };
  for (const stat of MAIN_STATS) {
    base[stat] ??= 0;
    scrolls[stat] ??= 0;
  }
  const out: Build = { ...build, slots, caracs: { base, scrolls }, extras: build.extras ?? [] };
  const weaponFm = normalizeWeaponFm(build.weaponFm);
  if (weaponFm) out.weaponFm = weaponFm;
  else delete out.weaponFm;
  return out;
}

function normalizeElementFm(raw: unknown): WeaponElementFm | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { element, value } = raw as Record<string, unknown>;
  if (!(ELEMENTS as readonly unknown[]).includes(element) || typeof value !== 'number' || !Number.isFinite(value)) return null;
  return { element: element as WeaponElementFm['element'], value };
}

// Champ optionnel : une valeur illisible est retirée plutôt que de rendre le stuff inutilisable.
function normalizeWeaponFm(raw: unknown): WeaponFm | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { damage, steal } = raw as Record<string, unknown>;
  const fm = { damage: normalizeElementFm(damage), steal: normalizeElementFm(steal) };
  return fm.damage || fm.steal ? fm : undefined;
}
