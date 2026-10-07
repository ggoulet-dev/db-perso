import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataset } from '../../data';
import { SLOT_KEYS, SLOT_LABELS, type Build, type SlotKey } from '../../domain/build/types';
import { ELEMENT_DAMAGE, ELEMENT_RES_PCT, type BuildResult } from '../../domain/engine';
import { CAPS, ELEMENTAL_STATS, unverifiedRules } from '../../domain/rules';
import { ELEMENTS, ELEMENT_LABELS, STATS, type Element, type StatKey } from '../../domain/stats';
import { LineList } from '../components';
import { piecesLabel, signed, sourceLabel, statLabel } from './labels';
import { ConditionBadge } from './SlotDetail';

const RES_FIXED: Record<Element, StatKey> = {
  neutral: 'resFixedNeutral',
  earth: 'resFixedEarth',
  fire: 'resFixedFire',
  water: 'resFixedWater',
  air: 'resFixedAir',
};

interface Part {
  label: string;
  value: number;
}

interface Row {
  key: string;
  label: string;
  value: number;
  parts: Part[];
  note?: string;
}

function StatRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const tooltip = row.parts.map((p) => `${p.label} : ${signed(p.value)}`).join('\n');
  return (
    <>
      <tr className={`stat-row${row.value === 0 ? ' zero' : ''}${row.value < 0 ? ' negative' : ''}`}>
        <td>
          <button type="button" className="row-toggle" onClick={() => setOpen(!open)} title={tooltip || 'Aucune source'} aria-expanded={open} disabled={row.parts.length === 0}>
            {row.parts.length > 0 && <span className="caret">{open ? '▾' : '▸'}</span>}
            {row.label}
          </button>
        </td>
        <td className="num strong">
          {row.value}
        </td>
      </tr>
      {row.note && (
        <tr className="stat-note">
          <td colSpan={2}>{row.note}</td>
        </tr>
      )}
      {open && (
        <tr className="stat-parts">
          <td colSpan={2}>
            <ul>
              {row.parts.map((part, i) => (
                <li key={i}>
                  <span>{part.label}</span>
                  <span className="num">
                    {signed(part.value)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="stat-section">
      <h3>{title}</h3>
      <table className="stat-table">
        <tbody>
          {rows.map((row) => (
            <StatRow key={row.key} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsPanel({ build, result }: { build: Build; result: BuildResult }) {
  const dataset = useDataset();
  const names = Object.fromEntries(SLOT_KEYS.flatMap((slot) => (build.slots[slot] ? [[slot, build.slots[slot]!.itemName]] : []))) as Partial<Record<SlotKey, string>>;
  const { totals, breakdown, derived } = result;

  const partsOf = (stat: StatKey, prefix = ''): Part[] => {
    // Le moteur ajoute les lignes non nulles d'un objet dans l'ordre de item.lines : un curseur par emplacement les retrouve.
    const cursor = new Map<SlotKey, number>();
    return breakdown[stat].flatMap((c): Part[] => {
      const label = `${prefix}${sourceLabel(c.source, dataset, names)}`;
      if (c.source.kind !== 'slot') return [{ label, value: c.value }];
      const { slot } = c.source;
      const name = result.slots[slot]?.item?.name ?? names[slot] ?? `Objet ${c.source.itemId}`;
      if (c.source.exo) return [{ label: `${prefix}exo ${statLabel(stat)} ${SLOT_LABELS[slot]} : ${name}`, value: c.value }];
      const lines = result.slots[slot]?.lines.filter((line) => line.stat === stat && line.value !== 0) ?? [];
      const index = cursor.get(slot) ?? 0;
      cursor.set(slot, index + 1);
      const line = lines[index];
      if (!line?.over) return [{ label, value: c.value }];
      const parts: Part[] = [{ label: `${prefix}over ${name}`, value: line.value - line.max }];
      if (line.max !== 0) parts.unshift({ label: `${label} (jet parfait)`, value: line.max });
      return parts;
    });
  };
  const stat = (key: StatKey, label: string = STATS[key].label, note?: string): Row => ({ key, label, value: totals[key], parts: partsOf(key), note });

  const hpBase = derived.hp - totals.vitality;
  const general: Row[] = [
    { key: 'hp', label: 'Points de vie', value: derived.hp, parts: [{ label: `Base (50 + 5 × niveau ${build.character.level})`, value: hpBase }, { label: 'Vitalité', value: totals.vitality }] },
    stat('ap'),
    stat('mp'),
    stat('range', 'PO'),
    stat('initiative'),
    stat('critical'),
    stat('summons'),
    stat('heals'),
    stat('prospecting'),
    stat('pods'),
  ];

  const caracs: Row[] = [
    stat('vitality'),
    stat('wisdom'),
    ...ELEMENTAL_STATS.map((key) =>
      stat(key, STATS[key].label, totals.power !== 0 ? `${STATS[key].label} + Puissance : ${derived.effectiveForDamage[key]}` : undefined),
    ),
    stat('power'),
  ];

  const mobility: Row[] = [stat('lock'), stat('dodge'), stat('apParry'), stat('mpParry'), stat('apReduction'), stat('mpReduction')];

  const damage: Row[] = [
    stat('damage', 'Dommages (tous éléments)'),
    ...ELEMENTS.map((element) => ({
      key: `shown-${element}`,
      label: `Dommages ${ELEMENT_LABELS[element]}`,
      value: derived.shownDamage[element],
      parts: [...partsOf(ELEMENT_DAMAGE[element]), ...partsOf('damage', 'Dommages · ')],
    })),
    stat('dmgCritical', 'Dommages critiques'),
    stat('dmgPushback', 'Dommages de poussée'),
    stat('dmgPctWeapon', '% Dommages d’armes'),
    stat('dmgPctSpells', '% Dommages aux sorts'),
    stat('dmgPctMelee', '% Dommages mêlée'),
    stat('dmgPctRanged', '% Dommages distance'),
    stat('dmgTraps', 'Dommages aux pièges'),
    stat('powerTraps', 'Puissance aux pièges'),
    stat('dmgReflected', 'Dommages renvoyés'),
  ];

  const resistances: Row[] = ELEMENTS.flatMap((element) => {
    const pct = ELEMENT_RES_PCT[element];
    const raw = totals[pct];
    return [
      stat(RES_FIXED[element]),
      stat(pct, undefined, raw > CAPS.resPct ? `Plafonné à ${derived.resPctCapped[element]} % en combat (règle non vérifiée)` : undefined),
    ];
  });
  resistances.push(
    stat('resCritical', 'Résistance critiques'),
    stat('resPushback', 'Résistance poussée'),
    stat('resPctMelee'),
    stat('resPctRanged'),
    stat('resPctWeapon'),
    stat('resPctSpells'),
  );

  const conditions = SLOT_KEYS.flatMap((slot) => {
    const res = result.slots[slot];
    return res?.condition && res.item ? [{ slot, item: res.item, status: res.condition.status }] : [];
  });
  const rules = unverifiedRules();

  return (
    <div className="results">
      <section className="card">
        <h2>Totaux</h2>
        <p className="muted small">Cliquer sur une ligne (ou la survoler) pour voir le détail par source.</p>
        <div className="stat-sections">
          <Section title="Général" rows={general} />
          <Section title="Caractéristiques" rows={caracs} />
          <Section title="Tacle, fuite, esquives et retraits" rows={mobility} />
          <Section title="Dommages" rows={damage} />
          <Section title="Résistances" rows={resistances} />
        </div>
      </section>

      <section className="card">
        <h2>Avertissements</h2>
        {result.warnings.length === 0 ? (
          <p className="muted">Aucun.</p>
        ) : (
          <ul className="warnings">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Panoplies actives</h2>
        {result.sets.length === 0 ? (
          <p className="muted">Aucune pièce de panoplie équipée.</p>
        ) : (
          [...result.sets]
            .sort((a, b) => b.pieces - a.pieces)
            .map((set) => (
              <div key={set.setId} className="set-block">
                <h3>
                  <Link to={`/panoplies/${set.setId}`}>{set.name}</Link> <span className="muted small">{piecesLabel(set.pieces)}</span>
                </h3>
                {set.bonus ? <LineList lines={set.bonus.lines} texts={set.bonus.texts} /> : <p className="muted small">Pas de bonus à {piecesLabel(set.pieces)}.</p>}
              </div>
            ))
        )}
      </section>

      {conditions.length > 0 && (
        <section className="card">
          <h2>Conditions des objets</h2>
          <ul className="cond-summary">
            {conditions.map(({ slot, item, status }) => (
              <li key={slot}>
                <span>
                  {SLOT_LABELS[slot]} : <Link to={`/objets/${item.id}`}>{item.name}</Link>
                </span>
                <ConditionBadge status={status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <details>
          <summary>
            <h2 className="inline">Règles non vérifiées ({rules.length})</h2>
          </summary>
          <ul className="rules">
            {rules.map((rule) => (
              <li key={rule.key}>
                <strong>{rule.label}</strong> : {rule.formula}
                <br />
                <span className="muted small">Source : {rule.source}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
