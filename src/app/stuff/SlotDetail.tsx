import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDataset } from '../../data';
import { SLOT_LABELS, type Build, type Exo, type Roll, type SlotEntry, type SlotKey } from '../../domain/build/types';
import type { ConditionResult, ConditionStatus, TestResult } from '../../domain/conditions';
import type { Condition } from '../../domain/dataset';
import type { SlotResult } from '../../domain/engine';
import { flattenCondition, formatConditionTest, formatRange } from '../../domain/format';
import type { StatKey } from '../../domain/stats';
import { GameText, ItemIcon } from '../components';
import { StatSelect } from './ExtrasPanel';
import { statLabel } from './labels';
import { NumberField } from './NumberField';

interface Props {
  slot: SlotKey;
  entry: SlotEntry;
  result: SlotResult | undefined;
  update(recipe: (build: Build) => Build): void;
  onChangeItem(): void;
}

const STATUS_CLASS: Record<ConditionStatus, string> = { remplie: 'ok', 'non remplie': 'bad', 'non évaluée': 'unknown' };

export function ConditionBadge({ status }: { status: ConditionStatus }) {
  return <span className={`badge cond-${STATUS_CLASS[status]}`}>{status}</span>;
}

// Appelée comme fonction, pas comme composant : un double rendu (StrictMode) décalerait `next`.
function renderCondition(node: Condition, next: () => TestResult | undefined): ReactNode {
  if (node.kind === 'test') {
    const test = next();
    return (
      <span className={test ? `cond-leaf cond-${STATUS_CLASS[test.status]}` : 'cond-leaf'}>
        {formatConditionTest(node)}
        {test && (
          <span className="muted small">
            {' '}
            ({test.actual === undefined ? 'non évaluée' : `actuel : ${test.actual}`})
          </span>
        )}
      </span>
    );
  }
  const join = node.kind === 'and' ? 'et' : 'ou';
  return (
    <ul className={`cond-group cond-${node.kind}`}>
      {node.children.map((child, i) => (
        <li key={i}>
          {i > 0 && <span className="cond-join">{join} </span>}
          {renderCondition(child, next)}
        </li>
      ))}
    </ul>
  );
}

/** Arbre de conditions avec le statut de chaque test ; `tests` suit l'ordre des feuilles. */
export function EvaluatedCondition({ condition, result }: { condition: Condition; result: ConditionResult }) {
  let index = 0;
  const next = () => result.tests[index++];
  return (
    <div className="cond-tree">
      {renderCondition(flattenCondition(condition), next)}
    </div>
  );
}

export function SlotDetail({ slot, entry, result, update, onChangeItem }: Props) {
  const dataset = useDataset();
  const item = result?.item ?? null;
  const set = item?.setId == null ? undefined : dataset.setById.get(item.setId);
  const [exoStat, setExoStat] = useState<StatKey | ''>('');
  const [exoValue, setExoValue] = useState(1);

  const setEntry = (recipe: (entry: SlotEntry) => SlotEntry) =>
    update((b) => {
      const current = b.slots[slot];
      return current ? { ...b, slots: { ...b.slots, [slot]: recipe(current) } } : b;
    });
  const remove = () => update((b) => ({ ...b, slots: { ...b.slots, [slot]: null } }));

  const header = (
    <div className="slot-head">
      {item && <ItemIcon iconId={item.iconId} shown={56} />}
      <div className="grow">
        <h3>
          {SLOT_LABELS[slot]} : {item ? <Link to={`/objets/${item.id}`}>{item.name}</Link> : entry.itemName}
        </h3>
        {item && (
          <p className="muted small">
            Niveau {item.level} · {dataset.typeById.get(item.typeId)?.name ?? `Type ${item.typeId}`}
            {set && (
              <>
                {' · '}
                <Link to={`/panoplies/${set.id}`}>{set.name}</Link>
              </>
            )}
          </p>
        )}
      </div>
      <span className="card-tools">
        <button type="button" onClick={onChangeItem}>
          Changer d’objet
        </button>
        <button type="button" onClick={remove}>
          Retirer
        </button>
      </span>
    </div>
  );

  if (!item || !result) {
    return (
      <div className="slot-detail">
        {header}
        <p className="banner error">Objet {entry.itemId} absent des données {dataset.meta.gameVersion} : ignoré dans les totaux.</p>
      </div>
    );
  }

  const setRoll = (line: number, stat: StatKey, value: number, max: number) =>
    setEntry((e) => {
      const rolls: Roll[] = e.rolls.filter((roll) => roll.line !== line);
      // Le jet parfait n'est pas stocké : une ligne sans jet vaut son max.
      if (value !== max) rolls.push({ line, stat, value });
      return { ...e, rolls: rolls.sort((a, b) => a.line - b.line) };
    });
  const allMax = () => setEntry((e) => ({ ...e, rolls: [] }));
  const allMin = () =>
    setEntry((e) => ({
      ...e,
      rolls: item.lines.flatMap((line, index) => (line.min === line.max ? [] : [{ line: index, stat: line.stat, value: line.min }])),
    }));
  const setExos = (recipe: (exos: Exo[]) => Exo[]) => setEntry((e) => ({ ...e, exos: recipe(e.exos) }));

  const taken = new Set<StatKey>([...item.lines.map((line) => line.stat), ...entry.exos.map((exo) => exo.stat)]);

  return (
    <div className="slot-detail">
      {header}

      <div className="card-head">
        <h4>Jets</h4>
        {item.lines.length > 0 && (
          <span className="card-tools">
            <button type="button" onClick={allMax}>
              Tout au max
            </button>
            <button type="button" onClick={allMin}>
              Tout au min
            </button>
          </span>
        )}
      </div>
      {item.lines.length === 0 ? (
        <p className="muted">Aucune ligne de stat.</p>
      ) : (
        <table className="grid-table rolls">
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.line} className={line.max < 0 ? 'negative' : undefined}>
                <td>{statLabel(line.stat)}</td>
                <td className="num muted">{formatRange(line.min, line.max)}</td>
                <td className="num">
                  <NumberField value={line.value} onChange={(value) => setRoll(line.line, line.stat, value, line.max)} aria-label={`Jet ${statLabel(line.stat)}`} />
                </td>
                <td>
                  {line.over && <span className="badge warn">over</span>}
                  {line.value < line.min && <span className="badge warn">sous le min</span>}
                  {!line.over && line.value === line.max && line.min !== line.max && <span className="badge">parfait</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {item.texts.length > 0 && (
        <ul className="lines">
          {item.texts.map((text, i) => (
            <li key={i} className={`text-line text-${text.tag}`}>
              <GameText text={text.text} />
            </li>
          ))}
        </ul>
      )}

      <h4>Exos</h4>
      {entry.exos.length > 0 && (
        <ul className="edit-list">
          {entry.exos.map((exo, index) => (
            <li key={index}>
              <span className="grow">{statLabel(exo.stat)}</span>
              <NumberField value={exo.value} onChange={(value) => setExos((exos) => exos.map((x, i) => (i === index ? { ...x, value } : x)))} aria-label={`Exo ${statLabel(exo.stat)}`} />
              <button type="button" onClick={() => setExos((exos) => exos.filter((_, i) => i !== index))}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="edit-list add-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (exoStat === '' || taken.has(exoStat)) return;
          setExos((exos) => [...exos, { stat: exoStat, value: exoValue }]);
          setExoStat('');
        }}
      >
        <StatSelect value={exoStat} exclude={taken} onChange={setExoStat} label="Stat de l’exo" />
        <NumberField value={exoValue} onChange={setExoValue} aria-label="Valeur de l’exo" />
        <button type="submit" disabled={exoStat === '' || taken.has(exoStat)}>
          Ajouter l’exo
        </button>
      </form>

      {item.conditions && result.condition && (
        <>
          <h4>
            Conditions <ConditionBadge status={result.condition.status} />
          </h4>
          <EvaluatedCondition condition={item.conditions} result={result.condition} />
          <p className="muted small">Évaluées sur les totaux finaux du stuff, objet compris.</p>
        </>
      )}
    </div>
  );
}
