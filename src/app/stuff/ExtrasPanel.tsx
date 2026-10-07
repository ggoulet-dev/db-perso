import type { Build, Extra } from '../../domain/build/types';
import type { StatKey } from '../../domain/stats';
import { STAT_KEYS, statLabel } from './labels';
import { NumberField } from './NumberField';

interface Props {
  build: Build;
  update(recipe: (build: Build) => Build): void;
}

export function StatSelect({ value, onChange, exclude, label }: { value: StatKey | ''; onChange(stat: StatKey): void; exclude?: ReadonlySet<StatKey>; label: string }) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as StatKey)}>
      {value === '' && <option value="">— Stat —</option>}
      {STAT_KEYS.filter((stat) => stat === value || !exclude?.has(stat)).map((stat) => (
        <option key={stat} value={stat}>
          {statLabel(stat)}
        </option>
      ))}
    </select>
  );
}

export function ExtrasPanel({ build, update }: Props) {
  const setExtras = (recipe: (extras: Extra[]) => Extra[]) => update((b) => ({ ...b, extras: recipe(b.extras) }));
  const patch = (index: number, change: Partial<Extra>) => setExtras((extras) => extras.map((extra, i) => (i === index ? { ...extra, ...change } : extra)));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Bonus hors objets</h2>
        <button type="button" onClick={() => setExtras((extras) => [...extras, { label: 'FM globale', stat: 'vitality', value: 0 }])}>
          Ajouter un bonus
        </button>
      </div>
      {build.extras.length === 0 ? (
        <p className="muted">FM globale, bonbon, bonus de guilde… : aucun pour l’instant.</p>
      ) : (
        <ul className="edit-list">
          {build.extras.map((extra, index) => (
            <li key={index}>
              <input value={extra.label} aria-label="Libellé" onChange={(e) => patch(index, { label: e.target.value })} />
              <StatSelect value={extra.stat} label="Stat" onChange={(stat) => patch(index, { stat })} />
              <NumberField value={extra.value} onChange={(value) => patch(index, { value })} aria-label="Valeur" />
              <button type="button" onClick={() => setExtras((extras) => extras.filter((_, i) => i !== index))}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
