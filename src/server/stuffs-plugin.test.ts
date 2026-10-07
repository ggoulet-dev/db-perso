import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStuffStore, isValidStuffId, StuffError, type StuffStore } from './stuffs-plugin';

let dir: string;
let store: StuffStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'stuffs-'));
  store = createStuffStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const sample = (id: string, updatedAt: string) => ({
  id,
  name: `Stuff ${id}`,
  dataVersion: '3.7.3.3',
  character: { breedId: 9, level: 200, subscriber: true },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt,
  slots: {},
});

describe('createStuffStore', () => {
  it('sauvegarde en JSON indenté puis relit le stuff', async () => {
    const doc = sample('cra-terre', '2026-10-06T10:00:00.000Z');
    await store.save('cra-terre', doc);
    const raw = await readFile(path.join(dir, 'cra-terre.json'), 'utf8');
    expect(raw).toBe(`${JSON.stringify(doc, null, 2)}\n`);
    expect(await store.get('cra-terre')).toEqual(doc);
    expect(await readdir(dir)).toEqual(['cra-terre.json']);
  });

  it('remplace un stuff existant', async () => {
    await store.save('a', sample('a', '2026-10-01T00:00:00.000Z'));
    await store.save('a', { ...sample('a', '2026-10-02T00:00:00.000Z'), name: 'Renommé' });
    expect((await store.get('a')).name).toBe('Renommé');
  });

  it('liste les résumés, plus récent en premier, en ignorant les fichiers étrangers ou abîmés', async () => {
    await store.save('ancien', sample('ancien', '2026-10-01T00:00:00.000Z'));
    await store.save('recent', sample('recent', '2026-10-05T00:00:00.000Z'));
    await writeFile(path.join(dir, 'casse.json'), '{ pas du json');
    await writeFile(path.join(dir, 'notes.txt'), 'x');
    expect(await store.list()).toEqual([
      {
        id: 'recent',
        name: 'Stuff recent',
        updatedAt: '2026-10-05T00:00:00.000Z',
        createdAt: '2026-10-01T00:00:00.000Z',
        dataVersion: '3.7.3.3',
        breedId: 9,
        level: 200,
      },
      expect.objectContaining({ id: 'ancien' }),
    ]);
  });

  it('renvoie une liste vide si le dossier n’existe pas', async () => {
    expect(await createStuffStore(path.join(dir, 'absent')).list()).toEqual([]);
  });

  it('supprime un stuff et signale 404 ensuite', async () => {
    await store.save('a', sample('a', '2026-10-01T00:00:00.000Z'));
    await store.remove('a');
    expect(await store.list()).toEqual([]);
    await expect(store.get('a')).rejects.toMatchObject({ status: 404 });
    await expect(store.remove('a')).rejects.toMatchObject({ status: 404 });
  });

  it('refuse un corps dont l’id diffère de celui demandé', async () => {
    await expect(store.save('a', sample('b', 'x'))).rejects.toMatchObject({ status: 400 });
  });

  it.each(['', '../secret', '..', 'a/b', 'A', 'cra_terre', 'é', '-a', 'a-', 'a.json', 'x'.repeat(101)])(
    'refuse l’id invalide %j',
    async (id) => {
      expect(isValidStuffId(id)).toBe(false);
      await expect(store.save(id, { id })).rejects.toBeInstanceOf(StuffError);
      await expect(store.get(id)).rejects.toMatchObject({ status: 400 });
      await expect(store.remove(id)).rejects.toMatchObject({ status: 400 });
    },
  );
});
