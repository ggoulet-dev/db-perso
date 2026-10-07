import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage, stuffRepository, useBreeds, useDataset } from '../../data';
import type { StuffSummary } from '../../data/stuffRepository';
import { migrateBuild } from '../../domain/build/migrate';
import { SLOT_LABELS, type Build } from '../../domain/build/types';
import { compareBuilds, sortStatDiffs, type SlotSide, type StatDiff, type StatSort } from '../../domain/compare';
import type { Breed } from '../../domain/rules';
import { ItemIcon } from '../components';
import { collator } from '../listState';
import { piecesLabel, signed } from '../stuff/labels';

type Side = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; build: Build } | { status: 'error'; message: string };

const SORT_LABELS: Record<StatSort, string> = { panel: 'Ordre du panneau', importance: 'Importance', delta: 'Plus grand écart' };

function useBuildSide(id: string): Side {
  const [side, setSide] = useState<Side>({ status: 'idle' });
  useEffect(() => {
    if (!id) {
      setSide({ status: 'idle' });
      return;
    }
    let active = true;
    setSide({ status: 'loading' });
    stuffRepository.get(id).then(
      (raw) => {
        if (!active) return;
        if (raw === null) setSide({ status: 'error', message: `Le stuff « ${id} » n'existe pas.` });
        else {
          try {
            setSide({ status: 'ready', build: migrateBuild(raw) });
          } catch (error) {
            setSide({ status: 'error', message: errorMessage(error) });
          }
        }
      },
      (error: unknown) => active && setSide({ status: 'error', message: errorMessage(error) }),
    );
    return () => {
      active = false;
    };
  }, [id]);
  return side;
}

function Delta({ value }: { value: number }) {
  return <span className={`delta${value > 0 ? ' up' : value < 0 ? ' down' : ''}`}>{value === 0 ? '=' : signed(value)}</span>;
}

export function ComparePage() {
  const dataset = useDataset();
  const breeds = useBreeds();
  const [params, setParams] = useSearchParams();
  const idA = params.get('a') ?? '';
  const idB = params.get('b') ?? '';
  const [stuffs, setStuffs] = useState<StuffSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    stuffRepository.list().then(
      (list) => setStuffs([...list].sort((x, y) => collator.compare(x.name, y.name))),
      (error: unknown) => setListError(`Impossible de lister les stuffs : ${errorMessage(error)}`),
    );
  }, []);

  const sideA = useBuildSide(idA);
  const sideB = useBuildSide(idB);

  const choose = (key: 'a' | 'b', id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set(key, id);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const swap = () => setParams({ ...(idB && { a: idB }), ...(idA && { b: idA }) }, { replace: true });

  const picker = (key: 'a' | 'b', id: string, label: string) => (
    <label className="grow">
      <span className="muted">{label}</span>
      <select value={id} onChange={(e) => choose(key, e.target.value)}>
        <option value="">— Choisir un stuff —</option>
        {id && stuffs && !stuffs.some((s) => s.id === id) && <option value={id}>{id}</option>}
        {stuffs?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section>
      <h1>Comparaison</h1>
      <div className="toolbar card compare-pickers">
        {picker('a', idA, 'Stuff A')}
        <button type="button" onClick={swap} disabled={!idA && !idB} title="Inverser A et B">
          ⇄
        </button>
        {picker('b', idB, 'Stuff B')}
      </div>
      {listError && (
        <p className="banner error" role="alert">
          {listError}
        </p>
      )}
      {[sideA, sideB].map((side, i) =>
        side.status === 'error' ? (
          <p key={i} className="banner error">
            Stuff {i === 0 ? 'A' : 'B'} : {side.message}
          </p>
        ) : null,
      )}
      {breeds.status === 'error' && <p className="banner error">Impossible de charger les classes : {breeds.message}</p>}

      {sideA.status === 'ready' && sideB.status === 'ready' && breeds.status === 'ready' ? (
        <Comparison a={sideA.build} b={sideB.build} breeds={breeds.breeds} dataset={dataset} />
      ) : (
        (sideA.status === 'loading' || sideB.status === 'loading' || breeds.status === 'loading') && <p className="status">Chargement…</p>
      )}
      {(!idA || !idB) && <p className="muted">Choisir deux stuffs à comparer. Depuis l’éditeur, « Comparer à une copie » duplique le stuff et ouvre directement la comparaison.</p>}
    </section>
  );
}

function SideCell({ side }: { side: SlotSide | null }) {
  const dataset = useDataset();
  if (!side) return <span className="muted">—</span>;
  const item = dataset.itemById.get(side.itemId);
  return (
    <span className="compare-item">
      {item && <ItemIcon iconId={item.iconId} shown={28} />}
      {item ? <Link to={`/objets/${item.id}`}>{side.name}</Link> : side.name}
    </span>
  );
}

function Comparison({ a, b, breeds, dataset }: { a: Build; b: Build; breeds: Breed[]; dataset: ReturnType<typeof useDataset> }) {
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [sort, setSort] = useState<StatSort>('panel');
  const comparison = useMemo(() => compareBuilds(a, b, dataset, breeds), [a, b, dataset, breeds]);

  const rows = sortStatDiffs(comparison.stats, sort).filter((row) => !onlyDiff || row.delta !== 0);
  const slots = comparison.slots.filter((s) => s.status !== 'empty' && (!onlyDiff || s.status === 'different' || s.tuned));
  const sets = comparison.sets.diff.filter((s) => !onlyDiff || s.piecesA !== s.piecesB);
  const caracs = comparison.caracs.filter((c) => !onlyDiff || c.base.delta !== 0 || c.scrolls.delta !== 0);
  const { points } = comparison;

  const statRow = (row: StatDiff) => (
    <tr key={row.key}>
      <td>{row.label}</td>
      <td className="num">{row.a}</td>
      <td className="num">{row.b}</td>
      <td className="num">
        <Delta value={row.delta} />
      </td>
    </tr>
  );

  return (
    <>
      <div className="toolbar card">
        <label className="checkbox">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Seulement les différences
        </label>
        <label>
          <span className="muted">Tri des stats</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as StatSort)}>
            {(Object.keys(SORT_LABELS) as StatSort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare-grid">
        <section className="card">
          <h2>Stats</h2>
          {rows.length === 0 ? (
            <p className="muted">Aucune différence de stats.</p>
          ) : (
            <table className="grid-table compare-table">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th className="num">
                    <Link to={`/stuffs/${a.id}`}>A</Link>
                  </th>
                  <th className="num">
                    <Link to={`/stuffs/${b.id}`}>B</Link>
                  </th>
                  <th className="num">B − A</th>
                </tr>
              </thead>
              <tbody>
                {sort === 'panel'
                  ? rows.map((row, i) => (
                      <Fragment key={row.key}>
                        {rows[i - 1]?.section !== row.section && (
                          <tr className="section-row">
                            <th colSpan={4}>{row.section}</th>
                          </tr>
                        )}
                        {statRow(row)}
                      </Fragment>
                    ))
                  : rows.map(statRow)}
              </tbody>
            </table>
          )}
        </section>

        <div>
          <section className="card">
            <h2>Stuffs</h2>
            <dl className="facts">
              <dt>A</dt>
              <dd>
                <Link to={`/stuffs/${a.id}`}>{a.name}</Link>
              </dd>
              <dt>B</dt>
              <dd>
                <Link to={`/stuffs/${b.id}`}>{b.name}</Link>
              </dd>
            </dl>
            {a.id === b.id && <p className="muted small">Le même stuff des deux côtés.</p>}
          </section>

          <section className="card">
            <h2>Objets</h2>
            {slots.length === 0 ? (
              <p className="muted">{onlyDiff ? 'Mêmes objets avec les mêmes jets.' : 'Aucun objet équipé.'}</p>
            ) : (
              <table className="grid-table compare-slots">
                <thead>
                  <tr>
                    <th>Emplacement</th>
                    <th>A</th>
                    <th>B</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.slot} className={slot.status === 'different' ? 'changed' : undefined}>
                      <td>
                        {SLOT_LABELS[slot.slot]}
                        {slot.tuned && <span className="badge warn">jets ou exos différents</span>}
                      </td>
                      <td>
                        <SideCell side={slot.a} />
                      </td>
                      <td>
                        {slot.status === 'same' ? <span className="muted">{slot.tuned ? 'même objet' : 'identique'}</span> : <SideCell side={slot.b} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Panoplies actives</h2>
            {sets.length === 0 ? (
              <p className="muted">{comparison.sets.diff.length === 0 ? 'Aucune panoplie des deux côtés.' : 'Mêmes panoplies, mêmes paliers.'}</p>
            ) : (
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Panoplie</th>
                    <th className="num">A</th>
                    <th className="num">B</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((set) => (
                    <tr key={set.setId}>
                      <td>
                        <Link to={`/panoplies/${set.setId}`}>{set.name}</Link>
                      </td>
                      <td className="num">{set.piecesA ? piecesLabel(set.piecesA) : '—'}</td>
                      <td className="num">{set.piecesB ? piecesLabel(set.piecesB) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Caracs</h2>
            {caracs.length === 0 ? (
              <p className="muted">Mêmes caracs et parchemins.</p>
            ) : (
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Carac</th>
                    <th className="num">A</th>
                    <th className="num">B</th>
                    <th className="num">Parch. A</th>
                    <th className="num">Parch. B</th>
                  </tr>
                </thead>
                <tbody>
                  {caracs.map((c) => (
                    <tr key={c.stat}>
                      <td>{c.label}</td>
                      <td className="num">{c.base.a}</td>
                      <td className="num">
                        {c.base.b} {c.base.delta !== 0 && <Delta value={c.base.delta} />}
                      </td>
                      <td className="num">{c.scrolls.a}</td>
                      <td className="num">
                        {c.scrolls.b} {c.scrolls.delta !== 0 && <Delta value={c.scrolls.delta} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted small">
              Points dépensés : {points.spent.a} / {points.available.a} (A), {points.spent.b} / {points.available.b} (B).
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
