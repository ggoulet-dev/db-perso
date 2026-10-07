import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOFUSDUDE_EFFECTS, DOFUSDUDE_ITEM_TYPES, conditionKeyOf } from './stats';

const RAW = new URL('../../data/equipment.json', import.meta.url);
const RAW_SETS = new URL('../../data/sets.json', import.meta.url);

interface RawCondition {
  condition?: { element: { id: number } };
  children?: RawCondition[];
}

function conditionIds(node: RawCondition | undefined, out: Set<number>): Set<number> {
  if (node?.condition) out.add(node.condition.element.id);
  for (const child of node?.children ?? []) conditionIds(child, out);
  return out;
}

// data/ est gitignoré : ces tests tournent là où le dump brut a été synchronisé.
describe.skipIf(!existsSync(RAW))('table dofusdude contre le dump brut', () => {
  const equipment = JSON.parse(readFileSync(RAW, 'utf8')) as Array<{
    type: { id: number };
    effects?: Array<{ type: { id: number } }>;
    conditions?: RawCondition;
  }>;

  it('classe chaque type d’objet (emplacement ou hors joueur)', () => {
    const unknown = [...new Set(equipment.map((item) => item.type.id))].filter((id) => !Object.hasOwn(DOFUSDUDE_ITEM_TYPES, id));
    expect(unknown).toEqual([]);
  });

  const player = equipment.filter((item) => DOFUSDUDE_ITEM_TYPES[item.type.id] != null);

  it('couvre tous les type.id d’effets des objets joueur', () => {
    const ids = new Set(player.flatMap((item) => (item.effects ?? []).map((effect) => effect.type.id)));
    expect([...ids].filter((id) => !DOFUSDUDE_EFFECTS[id])).toEqual([]);
  });

  it('couvre tous les éléments de conditions des objets joueur', () => {
    const ids = new Set<number>();
    for (const item of player) conditionIds(item.conditions, ids);
    expect([...ids].filter((id) => conditionKeyOf(id) === undefined)).toEqual([]);
  });

  it('couvre tous les type.id des bonus de panoplies', () => {
    const sets = JSON.parse(readFileSync(RAW_SETS, 'utf8')) as Array<{
      effects?: Record<string, Array<{ type: { id: number } }> | null>;
    }>;
    const ids = new Set(sets.flatMap((set) => Object.values(set.effects ?? {}).flatMap((effects) => (effects ?? []).map((e) => e.type.id))));
    expect([...ids].filter((id) => !DOFUSDUDE_EFFECTS[id])).toEqual([]);
  });
});
