import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { attackerFromBuild, criticalCounterpart, spellDamage, weaponDamage, type AttackDamage, type Range } from '../src/domain/damage';
import { createDataset, type DatasetMeta, type ItemSet, type ItemsFile } from '../src/domain/dataset';
import { computeBuild } from '../src/domain/engine';
import { importDofusbook } from '../src/domain/import/dofusbook';
import type { BreedsFile } from '../src/domain/rules';
import { chargeBonus, createSpellBook, type SpellsFile } from '../src/domain/spells';

// Stuffs construits comme dans test/import-dofusbook.test.ts : réponse API complète + notre dataset, qui y redonnent
// exactement les totaux du fixture compact. Le fixture compact (fonctions de dofusbook-acceptance) n'a ni coups ni
// critique d'arme : il sert ici à contrôler les stats et les coups lus dans notre dataset.

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

const { types, items } = readJson<ItemsFile>('../public/data/items.json');
const dataset = createDataset({ meta: readJson<DatasetMeta>('../public/data/meta.json'), types, items, sets: readJson<ItemSet[]>('../public/data/sets.json') });
const breedsFile = readJson<BreedsFile & { breeds: Array<{ spellVariants: Array<[number, number]> }> }>('../public/data/breeds.json');
const book = createSpellBook(readJson<SpellsFile>('../public/data/spells.json'), breedsFile.breeds);

interface Pair { normal: [number, number]; crit: [number, number] }
interface WeaponReference {
  stuff: number;
  context: Record<string, number | string>;
  lines: Array<{ line: string } & Pair>;
  probabiliteCC: string;
  moyenne?: { degatsParTour: number; parPA: number; regenParTour: number };
}
interface Reference {
  weapon: WeaponReference[];
  spellsCraWithStuff23428650: { context: Record<string, number>; lines: string[] };
}
interface CompactFixture {
  items: Array<{ slot: string; official: number; weapon?: { cc_bonus: number; cc_hits: number }; effects: Array<[string, string, number, number]> }>;
  stuff: { stuffFm: { weapon?: string | null; steal?: string | null } };
  expectedTotals: Record<string, unknown>;
}

const reference = readJson<Reference>('./fixtures/dofusbook/damage-reference.json');

function stuff(id: number) {
  const [entry] = importDofusbook(readJson<unknown>(`./fixtures/dofusbook/api/stuff-${id}.json`), { dataset, breeds: breedsFile.breeds });
  if (!entry?.ok) throw new Error(`import du stuff ${id} : ${entry?.ok === false ? entry.error : 'vide'}`);
  const result = computeBuild(entry.build, dataset, breedsFile.breeds);
  return { build: entry.build, result, attacker: attackerFromBuild(result), compact: readJson<CompactFixture>(`./fixtures/dofusbook/stuff-${id}.json`) };
}

const pair = (r: Range | null): [number, number] | null => (r ? [r.min, r.max] : null);
const pairs = (d: AttackDamage) => ({ normal: pair(d.normal), crit: pair(d.critical) });

// Moyennes de la Pelle relevées sur DofusBook avec le fixture, non reportées dans damage-reference.json.
const PELLE_AVERAGE = { degatsParTour: 1006, parPA: 335, regenParTour: 205 };

describe('dégâts d\'arme DofusBook', () => {
  it.each(reference.weapon.map((w) => [w.stuff, w] as const))('stuff %i : 20 bornes, soins, critique et moyennes', (id, ref) => {
    const { build, result, attacker, compact } = stuff(id);
    const ctx = ref.context;

    // Stats du contexte = celles du moteur.
    expect(attacker.critical).toBe(ctx.critiqueTotal);
    expect(attacker.critDamage).toBe(ctx.doCritique);
    expect(attacker.pctWeapon).toBe(ctx.pctDoArmes);
    expect(result.totals.power).toBe(ctx.puissance);

    // Arme lue dans notre dataset = arme du fixture compact.
    const slot = build.slots.ar!;
    const item = dataset.itemById.get(slot.itemId)!;
    const fixtureWeapon = compact.items.find((i) => i.slot === 'ar')!;
    expect(item.id).toBe(fixtureWeapon.official);
    expect(item.weapon).toMatchObject({ critProbability: ctx.weaponCcRate, critBonus: ctx.weaponCcHits });
    expect(fixtureWeapon.weapon).toMatchObject({ cc_bonus: ctx.weaponCcRate, cc_hits: ctx.weaponCcHits });
    const hitDice = item.hits.filter((h) => h.kind === 'damage' || h.kind === 'steal').map((h) => [h.min, h.max]);
    expect(hitDice).toEqual(fixtureWeapon.effects.filter(([, type]) => type === 'D').map(([, , a, b]) => [a, b]));

    const malusPct = ctx.malusAffiche ? Number.parseInt(String(ctx.malusAffiche), 10) : Number(ctx.malus ?? 0);
    const damage = weaponDamage(item, attacker, { fm: build.weaponFm ?? null, malusPct })!;

    const lines = ref.lines.filter((l) => l.line !== 'total' && l.line !== 'soin (vol)');
    expect(damage.lines.map((l) => ({ normal: pair(l.normal), crit: pair(l.critical) }))).toEqual(lines.map(({ normal, crit }) => ({ normal, crit })));
    const total = ref.lines.find((l) => l.line === 'total')!;
    expect(pairs(damage)).toEqual({ normal: total.normal, crit: total.crit });
    const heal = ref.lines.find((l) => l.line === 'soin (vol)')!;
    expect({ normal: pair(damage.heal), crit: pair(damage.critHeal) }).toEqual({ normal: heal.normal, crit: heal.crit });

    expect(`${damage.critChance} %`).toBe(ref.probabiliteCC);
    const average = ref.moyenne ?? PELLE_AVERAGE;
    expect(damage.average).toEqual({ perCast: average.degatsParTour, perAp: average.parPA, healPerCast: average.regenParTour, perTurn: average.degatsParTour });
  });

  it('Pelle : la FM df-100 / va-100 vient de l\'import, le % mêlée du stuff n\'est pas appliqué', () => {
    const { build, attacker } = stuff(23428299);
    expect(build.weaponFm).toEqual({ damage: { element: 'fire', value: 100 }, steal: { element: 'air', value: 100 } });
    expect(attacker.pctMelee).toBe(2);
    const item = dataset.itemById.get(build.slots.ar!.itemId)!;
    const damage = weaponDamage(item, attacker, { fm: build.weaponFm ?? null, malusPct: 10 })!;
    expect(damage.lines.map((l) => [l.kind, l.element])).toEqual([['damage', 'fire'], ['steal', 'air']]);
    expect(damage.unverified).toHaveLength(3);
  });
});

/** « Flèche Glacée|Niveau 133|AE|426 - 467|481 - 536 CC|1 charge|… » → nom, niveau, groupes de paires. */
function parseSpellLine(text: string) {
  const [name, levelText, ...rest] = text.split('|');
  const groups: Array<{ label: string; pairs: Pair[] }> = [];
  let pending: [number, number][] = [];
  let crits: [number, number][] = [];
  let label = 'base';
  const flush = () => {
    if (pending.length) {
      const group = groups.find((g) => g.label === label) ?? groups[groups.push({ label, pairs: [] }) - 1]!;
      group.pairs.push(...pending.map((normal, i) => ({ normal, crit: crits[i]! })));
    }
    pending = [];
    crits = [];
  };
  for (const cell of rest) {
    if (cell.startsWith('ID ')) break;
    const range = /^(\d+) - (\d+)( CC)?$/.exec(cell);
    if (range) {
      const value: [number, number] = [Number(range[1]), Number(range[2])];
      if (range[3]) crits.push(value);
      else {
        if (crits.length) flush();
        pending.push(value);
      }
    } else if (/^\d+ charges?$/.test(cell)) {
      flush();
      label = cell;
    }
  }
  flush();
  return { name: name!, level: Number(levelText!.replace('Niveau ', '')), groups };
}

describe('sorts Crâ DofusBook avec les stats du stuff 23428650', () => {
  const { attacker, result } = stuff(23428650);
  const { context, lines } = reference.spellsCraWithStuff23428650;
  const spells = book.pairsOf(9).flatMap((p) => [p.base, ...(p.variant ? [p.variant] : [])]);

  it('le contexte relevé est celui du moteur', () => {
    expect(attacker.effective).toMatchObject({ earth: context.force! + context.puissance!, fire: context.intelligence! + context.puissance!, water: context.chance! + context.puissance!, air: context.agilite! + context.puissance! });
    expect(attacker.fixed).toEqual({ neutral: context.doNeutre, earth: context.doTerre, fire: context.doFeu, water: context.doEau, air: context.doAir });
    expect([attacker.critDamage, attacker.pctSpells, attacker.pctRanged, attacker.critical]).toEqual([context.doCritique, context.pctDoSorts, context.pctDoDistance, context.critiqueTotal]);
    expect(result.totals.power).toBe(context.puissance);
  });

  it.each(lines.map((text) => [text.split('|')[0]!, text] as const))('%s', (_, text) => {
    const parsed = parseSpellLine(text);
    const spell = spells.find((s) => s.name === parsed.name)!;
    expect(spell, parsed.name).toBeDefined();
    const level = spell.levels.find((l) => l.minPlayerLevel === parsed.level)!;
    expect(level).toBeDefined();
    expect(`ID ${spell.id}`).toBe(text.split('|').find((c) => c.startsWith('ID ')));
    expect(`${level.apCost} PA`).toBe(text.split('|').find((c) => c.endsWith(' PA')));

    const damage = spellDamage(level, book.effects, attacker);
    expect(`${damage.critChance}% CC tot`).toBe(text.split('|').find((c) => c.endsWith('CC tot')));

    // Paires attendues : une par ligne de dégâts ou de vol, suivie de son soin pour un vol.
    const computed = damage.lines.flatMap((l) => [
      { normal: pair(l.normal), crit: pair(l.critical) },
      ...(l.kind === 'steal' ? [{ normal: pair(l.heal), crit: pair(l.critHeal) }] : []),
    ]);
    const [base, ...charges] = parsed.groups;
    expect(computed[0], 'première paire').toEqual(base!.pairs[0]);
    expect(computed).toEqual(base!.pairs);

    // « N charge(s) » : dégâts de base + N × bonus par charge (effet 293 sur le sort lui-même).
    for (const group of charges) {
      const n = Number.parseInt(group.label, 10);
      const charged = spellDamage(level, book.effects, attacker, { baseBonus: n * chargeBonus(spell, level) });
      expect(charged.lines.map((l) => ({ normal: pair(l.normal), crit: pair(l.critical) })), group.label).toEqual(group.pairs);
    }
  });
  // Non vérifiés ici : les nombres isolés après « AE » avec « N case(s) » (dégâts de poussée, pas des effets de sort),
  // le libellé « Dans 1 tour » de Flèche Persécutrice (effet différé non lisible dans les effets) et « Cumul : N »
  // (nombre maximal de charges, absent de spells.json).
});

describe('sorts réels hors fixture', () => {
  const attacker = stuff(23428650).attacker;
  const spell = (id: number) => book.spellById.get(id)!;

  it('Rekop : critique de la ligne 43 (8 à 20 Air) = 10 à 23, pas la ligne d\'état rangée au même rang', () => {
    const level = spell(12853).levels[0]!;
    expect(criticalCounterpart(level, 43)).toMatchObject({ effectId: 98, diceNum: 10, diceSide: 23, targetMask: 'a,A' });
    expect(criticalCounterpart(level, 44)).toMatchObject({ diceNum: 16, targetMask: 'a,A,*E5486' });
    expect(spellDamage(level, book.effects, attacker).total).toBeNull();
  });

  it('Ronce : ligne ennemie et ligne alliée exclusives, pas de total', () => {
    const level = spell(13516).levels.find((l) => l.minPlayerLevel === 132)!;
    const damage = spellDamage(level, book.effects, attacker);
    expect(damage.lines).toHaveLength(2);
    expect(damage.total).toBeNull();
  });
});
