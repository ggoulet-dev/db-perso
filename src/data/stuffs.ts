import type { Build } from '../domain/build/types';
import { normalizeText } from '../domain/dataset';
import { createHttpStuffRepository, isValidStuffId } from './stuffRepository';

export const stuffRepository = createHttpStuffRepository<Build>();

/** Identifiant de fichier lisible tiré du nom, rendu unique parmi `taken`. */
export function stuffIdFor(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug =
    normalizeText(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'stuff';
  let id = slug;
  for (let n = 2; used.has(id) || !isValidStuffId(id); n++) id = `${slug}-${n}`;
  return id;
}

/** Copie indépendante d'un stuff, sous un nouvel id tiré de « nom (copie) ». */
export function copyOfBuild(source: Build, taken: Iterable<string>, now = new Date().toISOString()): Build {
  const name = `${source.name} (copie)`;
  return { ...structuredClone(source), id: stuffIdFor(name, taken), name, createdAt: now, updatedAt: now };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
