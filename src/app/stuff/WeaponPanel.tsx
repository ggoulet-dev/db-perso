import { Link } from 'react-router-dom';
import type { Build, WeaponElementFm, WeaponFm } from '../../domain/build/types';
import { attackerFromBuild, weaponDamage, type DamageLine } from '../../domain/damage';
import type { Hit } from '../../domain/dataset';
import type { BuildResult } from '../../domain/engine';
import { formatHit, formatRange } from '../../domain/format';
import { ELEMENTS, ELEMENT_LABELS, type Element } from '../../domain/stats';
import { WeaponStats } from '../components';
import { damageOptions, DamageSettingsPanel, ElementDot, formatDamage, Unverified, UnverifiedList, type DamageSettings } from '../damage/DamageSettings';
import { NumberField } from './NumberField';

interface Props {
  build: Build;
  result: BuildResult;
  update(recipe: (build: Build) => Build): void;
  settings: DamageSettings;
  onSettings(settings: DamageSettings): void;
}

const FM_ROWS: Array<{ key: keyof WeaponFm; label: string }> = [
  { key: 'damage', label: 'Dommages' },
  { key: 'steal', label: 'Vol' },
];

function withWeaponFm(build: Build, fm: WeaponFm): Build {
  const { weaponFm: _, ...rest } = build;
  return fm.damage || fm.steal ? { ...rest, weaponFm: fm } : rest;
}

function lineLabel(line: DamageLine, hit: Hit | undefined): string {
  const kind = line.kind === 'damage' ? 'Dommages' : 'Vol';
  const origin = hit?.element === 'best' || hit?.element === null ? 'meilleur élément' : hit && hit.element !== line.element ? `${ELEMENT_LABELS[hit.element]} d'origine` : null;
  return `${formatRange(line.dice.min, line.dice.max)} ${kind} ${ELEMENT_LABELS[line.element]}${origin ? ` (${origin})` : ''}`;
}

/** Onglet Arme : coups, FM élémentaire et dégâts calculés comme DofusBook. */
export function WeaponPanel({ build, result, update, settings, onSettings }: Props) {
  const entry = build.slots.ar;
  const item = result.slots.ar?.item ?? null;
  const fm = build.weaponFm;
  const attacker = attackerFromBuild(result);
  const damage = item ? weaponDamage(item, attacker, { ...damageOptions(settings), fm: fm ?? null }) : null;
  const otherHits = item?.hits.filter((h) => h.kind !== 'damage' && h.kind !== 'steal') ?? [];

  const setFm = (key: keyof WeaponFm, value: WeaponElementFm | null) =>
    update((b) => withWeaponFm(b, { damage: b.weaponFm?.damage ?? null, steal: b.weaponFm?.steal ?? null, [key]: value }));

  return (
    <>
      <section className="card">
        <h2>
          Arme{item && <> : <Link to={`/objets/${item.id}`}>{item.name}</Link></>}
        </h2>
        {!entry ? (
          <p className="muted">Aucune arme équipée : choisissez-en une dans l'onglet Équipement.</p>
        ) : !item ? (
          <p className="muted">Objet {entry.itemId} absent des données : coups inconnus.</p>
        ) : !item.weapon ? (
          <p className="muted">Pas de caractéristiques d'arme dans les données : dégâts incalculables.</p>
        ) : !damage || damage.lines.length === 0 ? (
          <p className="muted">Aucun coup de dégâts ni de vol.</p>
        ) : (
          <>
            <table className="grid-table damage-table">
              <thead>
                <tr>
                  <th>Coup</th>
                  <th className="num">Normal</th>
                  <th className="num">Critique</th>
                </tr>
              </thead>
              <tbody>
                {damage.lines.map((line) => (
                  <tr key={line.index}>
                    <td>
                      <ElementDot element={line.element} />
                      {lineLabel(line, item.hits[line.index])}
                    </td>
                    <td className="num">{formatDamage(line.normal)}</td>
                    <td className="num" title={line.critDice ? `Jet critique ${formatRange(line.critDice.min, line.critDice.max)}` : undefined}>
                      {formatDamage(line.critical)}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num">{formatDamage(damage.normal)}</td>
                  <td className="num">{formatDamage(damage.critical)}</td>
                </tr>
                {damage.lines.some((l) => l.kind === 'steal') && (
                  <tr>
                    <td>Soins (vol)</td>
                    <td className="num">{formatDamage(damage.heal)}</td>
                    <td className="num">{formatDamage(damage.critHeal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <dl className="facts">
              <dt>Coup critique</dt>
              <dd>
                {damage.critChance} %{' '}
                <span className="muted">
                  ({item.weapon.critProbability} % de l'arme + {attacker.critical} Critique, max. 100)
                </span>
              </dd>
              <dt>Moyenne par coup</dt>
              <dd>{damage.average.perCast}</dd>
              <dt>Moyenne par PA</dt>
              <dd>
                {damage.average.perAp} <span className="muted">({damage.apCost} PA)</span>
              </dd>
              <dt>Soins moyens par coup</dt>
              <dd>{damage.average.healPerCast}</dd>
            </dl>
            <UnverifiedList items={damage.unverified} />
          </>
        )}
        {item && otherHits.length > 0 && (
          <p className="muted small">Autres effets du coup, non calculés : {otherHits.map(formatHit).join(', ')}.</p>
        )}
        {item?.weapon && <WeaponStats weapon={item.weapon} />}

        <h4>
          FM élémentaire <Unverified />
        </h4>
        <ul className="edit-list">
          {FM_ROWS.map(({ key, label }) => {
            const current = fm?.[key] ?? null;
            return (
              <li key={key}>
                <span className="grow">{label}</span>
                <select
                  aria-label={`Élément de la FM ${label.toLowerCase()}`}
                  value={current?.element ?? ''}
                  onChange={(e) => {
                    const element = e.target.value as Element | '';
                    setFm(key, element === '' ? null : { element, value: current?.value ?? 100 });
                  }}
                >
                  <option value="">— Aucune —</option>
                  {ELEMENTS.map((element) => (
                    <option key={element} value={element}>
                      {ELEMENT_LABELS[element]}
                    </option>
                  ))}
                </select>
                {current && (
                  <NumberField value={current.value} min={0} onChange={(value) => setFm(key, { ...current, value })} aria-label={`Valeur de la FM ${label.toLowerCase()}`} />
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          Enregistrée avec le stuff. Traitée comme une conversion totale de l'élément des lignes de dommages ou de vol ; la valeur est conservée mais
          sans effet sur le calcul.
        </p>
      </section>
      <DamageSettingsPanel settings={settings} onChange={onSettings} weapon />
    </>
  );
}
