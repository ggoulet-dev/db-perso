import { describe, expect, it } from 'vitest';
import type { Dataset, Item } from '../dataset';
import { BuildFormatError, migrateBuild } from './migrate';
import { createBuild } from './types';
import { revalidateBuild } from './validate';

const shield: Item = {
  id: 32236, name: 'Disque de Culbutœuf', level: 200, typeId: 87, slot: 'shield', iconId: 0, setId: null, pods: 0,
  description: '', lines: [{ stat: 'vitality', min: 201, max: 250 }, { stat: 'strength', min: 41, max: 60 }],
  hits: [], texts: [], weapon: null, conditions: null, recipe: [],
};
const dataset = { itemById: new Map([[shield.id, shield]]), meta: { gameVersion: '3.7.4.0' } } as unknown as Pick<Dataset, 'itemById' | 'meta'>;

describe('stuff : migration et revalidation', () => {
  it('migrateBuild complète un fichier édité à la main et refuse un schéma futur', () => {
    const stored = JSON.parse(JSON.stringify(createBuild({ id: 'a', name: 'A', dataVersion: '3.7.3.3' })));
    delete stored.slots.d6;
    delete stored.caracs.scrolls.agility;
    const build = migrateBuild(stored);
    expect(build.slots.d6).toBeNull();
    expect(build.caracs.scrolls.agility).toBe(0);
    expect(() => migrateBuild({ ...stored, schemaVersion: 99 })).toThrow(BuildFormatError);
  });

  it('revalidateBuild remet au jet parfait un jet dont la ligne a changé', () => {
    const build = createBuild({ id: 'a', name: 'A', dataVersion: '3.7.3.3' });
    build.slots.br = {
      itemId: 32236, itemName: 'ancien nom', exos: [],
      rolls: [{ line: 0, stat: 'vitality', value: 230 }, { line: 1, stat: 'chance', value: 50 }],
    };
    const { build: next, issues } = revalidateBuild(build, dataset);
    expect(next.slots.br?.rolls).toEqual([{ line: 0, stat: 'vitality', value: 230 }]);
    expect(next.slots.br?.itemName).toBe('Disque de Culbutœuf');
    expect(next.dataVersion).toBe('3.7.4.0');
    expect(issues.map((i) => i.code)).toEqual(['rollMismatch']);
  });
});
