import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chargeBonus, classifyEffect, createSpellBook, levelFor, renderEffect, type BreedSpellIds, type SpellsFile } from './spells';

function readPublic<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

const file = readPublic<SpellsFile>('spells.json');
const { breeds } = readPublic<{ breeds: BreedSpellIds[] }>('breeds.json');
const book = createSpellBook(file, breeds);

function spell(id: number) {
  const found = book.spellById.get(id);
  if (!found) throw new Error(`sort ${id} absent`);
  return found;
}

/** Nature des effets du dernier grade, dans l'ordre. */
function kinds(id: number) {
  return spell(id).levels.at(-1)!.effects.map((e) => {
    const { kind, element, computable } = classifyEffect(book.effects.get(e.effectId));
    return kind === 'other' ? 'other' : `${kind} ${element}${computable ? '' : ' (hors formule)'}`;
  });
}

describe('sorts', () => {
  it('chaque classe a ses sorts groupés par paire de variantes, dans l\'ordre de breeds.json', () => {
    for (const breed of breeds) {
      const pairs = book.pairsOf(breed.id);
      expect(pairs.map((p) => p.base.id)).toEqual(breed.spellIds);
      expect(pairs.every((p) => p.variant && p.variant.breedId === breed.id)).toBe(true);
    }
    expect(book.pairsOf(9)[0]!.base.name).toBe('Flèche de Recul');
    expect(book.pairsOf(9)[0]!.variant?.name).toBe('Flèche Éclatante');
    expect(book.release).toBe('3.7.1.0');
  });

  it('grade applicable : le plus haut dont le niveau minimal est atteint', () => {
    const glacee = spell(32435);
    expect([0, 1, 66, 67, 132, 133, 200].map((lvl) => levelFor(glacee, lvl)?.grade ?? null)).toEqual([null, 1, 1, 2, 2, 3, 3]);
  });

  it('rend les effets depuis le gabarit de description', () => {
    const render = (id: number, index: number) => {
      const level = spell(id).levels.at(-1)!;
      const effect = level.effects[index]!;
      return renderEffect(effect, book.effects.get(effect.effectId), { spellName: (sid) => book.spellById.get(sid)?.name });
    };
    expect(render(32426, 0)).toBe('25 à 28 dommages Air');
    expect(render(32426, 1)).toBe('Repousse de 2 cases');
    expect(render(32443, 1)).toBe('Repousse de 1 case'); // dés 1/1 : valeur unique
    expect(render(32435, 0)).toBe('-2 PA');
    expect(render(32435, 3)).toBe('Flèche Glacée : +5 dégâts de base');
    expect(render(32459, 1)).toBe('-60 Dommages');
    expect(render(32436, 0)).toBe('Vole 1 PM');
  });

  it('ne laisse ni balisage ni gabarit dans le texte des effets', () => {
    const leftovers = [...book.spellById.values()].flatMap((s) =>
      s.levels.flatMap((level) => [...level.effects, ...level.criticalEffects])
        .map((effect) => renderEffect(effect, book.effects.get(effect.effectId), { spellName: (sid) => book.spellById.get(sid)?.name }))
        .filter((text) => /<[^>]*>|\{\{/.test(text)));
    expect(leftovers).toEqual([]);
  });

  it('classe dégâts, vols et soins sur des sorts réels', () => {
    expect(kinds(32426)).toEqual(['damage air', 'other']); // Flèche de Recul
    expect(kinds(32449)).toEqual(['steal fire', 'other']); // Flèche Éclatante
    expect(kinds(32433)).toEqual(['other', 'steal air', 'other', 'damage air']); // Flèche Persécutrice
    expect(kinds(32436)).toEqual(['other', 'damage water', 'other']); // Flèche d'Immobilisation : vol de PM = autre
    expect(kinds(31111)).toEqual(['steal fire', 'heal fire (hors formule)', 'other']); // Pics du Prespic
    expect(kinds(31114)).toEqual(['damage best', 'other', 'other']); // Fouet
    expect(kinds(12858).slice(0, 2)).toEqual(['heal best (hors formule)', 'damage best']); // Tout ou Rien
  });

  it('l\'élément d\'un effet de dégâts / vol / soin est celui du référentiel, partout', () => {
    for (const s of file.spells) {
      for (const level of s.levels) {
        for (const e of [...level.effects, ...level.criticalEffects]) {
          const ref = book.effects.get(e.effectId)!;
          const { element, computable } = classifyEffect(ref);
          if (!computable || element === 'best' || element === 'worst') continue;
          expect(e.element, `${s.name} effet ${e.effectId}`).toBe(ref.elementId);
          expect(['neutral', 'earth', 'fire', 'water', 'air'][e.element]).toBe(element);
        }
      }
    }
    // Catégorie 2 sans jet élémentaire : poussées et déplacements = autres ; dégâts et soins en % = hors formule.
    const of = (ids: number[]) => ids.map((id) => classifyEffect(book.effects.get(id)));
    expect(of([5, 6, 1041, 1042, 77, 84, 1048, 1061]).map((c) => c.kind)).toEqual(Array(8).fill('other'));
    expect(of([89, 279, 1092, 1118, 1223, 1013, 1016])).toEqual([
      ...Array(4).fill({ kind: 'damage', element: 'neutral', computable: false }),
      { kind: 'damage', element: null, computable: false },
      { kind: 'damage', element: 'air', computable: false },
      { kind: 'damage', element: 'earth', computable: false },
    ]);
    expect(of([1109, 2020, 2973, 786, 178, 1159]).map((c) => c.kind)).toEqual(['heal', 'heal', 'heal', 'heal', 'other', 'other']);
  });

  it('bonus par charge : effet 293 qui vise le sort lui-même', () => {
    const glacee = spell(32435);
    const immo = spell(32436);
    expect(chargeBonus(glacee, levelFor(glacee, 200)!)).toBe(5);
    expect(chargeBonus(immo, levelFor(immo, 200)!)).toBe(2);
    expect(chargeBonus(spell(32426), spell(32426).levels[0]!)).toBe(0);
  });
});
