import { WEAPON_SKILL, type DamageOptions, type Range } from '../../domain/damage';
import { ELEMENTS, ELEMENT_LABELS, type Element } from '../../domain/stats';
import { NumberField } from '../stuff/NumberField';

/** Options de calcul saisies dans l'éditeur, communes aux onglets Arme et Sorts ; non enregistrées avec le stuff. */
export interface DamageSettings {
  weaponSkill: number;
  malusPct: number;
  distance: 'melee' | 'ranged' | null;
  resFixed: Record<Element, number>;
  resPct: Record<Element, number>;
}

const zeros = (): Record<Element, number> => ({ neutral: 0, earth: 0, fire: 0, water: 0, air: 0 });

export const DEFAULT_DAMAGE_SETTINGS: DamageSettings = {
  weaponSkill: WEAPON_SKILL,
  malusPct: 0,
  distance: null,
  resFixed: zeros(),
  resPct: zeros(),
};

/** Le domaine signale toute cible passée comme non vérifiée : une cible sans résistance n'est donc pas passée. */
export function damageOptions(s: DamageSettings): DamageOptions {
  const hasTarget = ELEMENTS.some((e) => s.resFixed[e] !== 0 || s.resPct[e] !== 0);
  return {
    weaponSkill: s.weaponSkill,
    malusPct: s.malusPct,
    distance: s.distance,
    target: hasTarget ? { fixed: { ...s.resFixed }, pct: { ...s.resPct } } : null,
  };
}

export function formatDamage(r: Range | null): string {
  if (!r) return '—';
  return r.min === r.max ? String(r.min) : `${r.min} – ${r.max}`;
}

export function Unverified() {
  return <span className="badge warn">non vérifié</span>;
}

export function UnverifiedList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="unverified">
      <strong>Hypothèses non vérifiées dans ce calcul :</strong>
      <ul>
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

export function ElementDot({ element }: { element: Element }) {
  return <span className={`element-dot el-${element}`} title={ELEMENT_LABELS[element]} aria-hidden="true" />;
}

interface Props {
  settings: DamageSettings;
  onChange(settings: DamageSettings): void;
  /** Affiche la maîtrise d'arme (onglet Arme). */
  weapon: boolean;
}

export function DamageSettingsPanel({ settings, onChange, weapon }: Props) {
  const set = (patch: Partial<DamageSettings>) => onChange({ ...settings, ...patch });
  const setRes = (key: 'resFixed' | 'resPct', element: Element, value: number) => set({ [key]: { ...settings[key], [element]: value } });
  const hasRes = ELEMENTS.some((e) => settings.resFixed[e] !== 0 || settings.resPct[e] !== 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Options de calcul</h2>
        <span className="card-tools">
          <button type="button" onClick={() => onChange(DEFAULT_DAMAGE_SETTINGS)}>
            Réinitialiser
          </button>
        </span>
      </div>
      <div className="field-row">
        {weapon && (
          <label>
            Maîtrise d'arme
            <select value={settings.weaponSkill} onChange={(e) => set({ weaponSkill: Number(e.target.value) })}>
              <option value={0}>Aucune</option>
              <option value={WEAPON_SKILL}>Normale ({WEAPON_SKILL})</option>
            </select>
          </label>
        )}
        <label title="Malus appliqué à la fin du calcul ; DofusBook en affiche un sans que son origine soit connue">
          Malus %
          <NumberField className="narrow" value={settings.malusPct} min={0} max={100} onChange={(malusPct) => set({ malusPct })} aria-label="Malus en %" />
        </label>
        <label>
          <span>
            Type de dégâts <Unverified />
          </span>
          <select
            value={settings.distance ?? ''}
            onChange={(e) => set({ distance: e.target.value === '' ? null : (e.target.value as 'melee' | 'ranged') })}
          >
            <option value="">Sans % mêlée ni distance</option>
            <option value="melee">Mêlée</option>
            <option value="ranged">Distance</option>
          </select>
        </label>
      </div>
      {weapon && settings.weaponSkill !== WEAPON_SKILL && <p className="muted small">Seule la maîtrise normale ({WEAPON_SKILL}) est vérifiée sur DofusBook.</p>}

      <h4>
        Résistances de la cible <Unverified />
      </h4>
      <table className="grid-table res-table">
        <thead>
          <tr>
            <th>Élément</th>
            <th className="num">Fixes</th>
            <th className="num">%</th>
          </tr>
        </thead>
        <tbody>
          {ELEMENTS.map((element) => (
            <tr key={element}>
              <td>
                <ElementDot element={element} />
                {ELEMENT_LABELS[element]}
              </td>
              <td className="num">
                <NumberField
                  className="narrow"
                  value={settings.resFixed[element]}
                  onChange={(v) => setRes('resFixed', element, v)}
                  aria-label={`Résistance fixe ${ELEMENT_LABELS[element]}`}
                />
              </td>
              <td className="num">
                <NumberField
                  className="narrow"
                  value={settings.resPct[element]}
                  min={-100}
                  max={100}
                  onChange={(v) => setRes('resPct', element, v)}
                  aria-label={`Résistance % ${ELEMENT_LABELS[element]}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        {hasRes
          ? 'Appliquées après la formule DofusBook : fixes soustraites, puis %.'
          : 'Cible sans résistance, comme sur DofusBook.'}
      </p>
    </section>
  );
}
