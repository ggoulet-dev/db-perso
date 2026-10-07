import type { Build } from '../../domain/build/types';
import type { Breed } from '../../domain/rules';
import { collator } from '../listState';
import { NumberField } from './NumberField';

interface Props {
  build: Build;
  breeds: readonly Breed[];
  update(recipe: (build: Build) => Build): void;
}

export function CharacterPanel({ build, breeds, update }: Props) {
  const { breedId, level, subscriber } = build.character;
  const setCharacter = (patch: Partial<Build['character']>) => update((b) => ({ ...b, character: { ...b.character, ...patch } }));
  const sorted = [...breeds].sort((a, b) => collator.compare(a.name, b.name));
  return (
    <section className="card">
      <h2>Personnage</h2>
      <div className="field-row">
        <label>
          <span className="muted">Classe</span>
          <select value={breedId ?? ''} onChange={(e) => setCharacter({ breedId: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">— Aucune —</option>
            {sorted.map((breed) => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted">Niveau</span>
          <NumberField value={level} min={1} max={200} onChange={(n) => setCharacter({ level: n })} className="narrow" />
        </label>
        <label className="check">
          <input type="checkbox" checked={subscriber} onChange={(e) => setCharacter({ subscriber: e.target.checked })} />
          Abonné
        </label>
      </div>
    </section>
  );
}
