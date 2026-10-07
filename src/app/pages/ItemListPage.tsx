import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDataset } from '../../data';
import type { Item } from '../../domain/dataset';
import { SLOT_LABELS } from '../../domain/format';
import type { SlotKind } from '../../domain/stats';
import { ItemIcon } from '../components';
import { collator, rememberListSearch } from '../listState';

const PAGE_SIZE = 50;

type SortKey = 'name' | 'level' | 'type';
const SORT_KEYS: readonly SortKey[] = ['name', 'level', 'type'];

function readInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ItemListPage() {
  const dataset = useDataset();
  const [params, setParams] = useSearchParams();

  const query = params.get('q') ?? '';
  const category = params.get('cat') ?? '';
  const minLevel = readInt(params.get('min'));
  const maxLevel = readInt(params.get('max'));
  const setId = readInt(params.get('set'));
  const showAll = params.get('hj') === '1';
  const sortParam = params.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'level';
  const descending = (params.get('dir') ?? (sort === 'level' ? 'desc' : 'asc')) === 'desc';

  useEffect(() => {
    rememberListSearch(params.toString());
  }, [params]);

  function update(patch: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace });
  }

  const typeOptions = useMemo(
    () =>
      dataset.types
        .filter((type) => showAll || type.slot !== null)
        .map((type) => ({ id: type.id, name: type.name || `Type ${type.id}`, outside: type.slot === null }))
        .sort((a, b) => collator.compare(a.name, b.name)),
    [dataset, showAll],
  );

  const setOptions = useMemo(
    () => [...dataset.sets].sort((a, b) => collator.compare(a.name, b.name)),
    [dataset],
  );

  const results = useMemo(() => {
    const [catKind, catValue] = category.split(':');
    const matchesCategory = (item: Item) =>
      catKind === 'slot' ? item.slot === catValue : catKind === 'type' ? item.typeId === Number(catValue) : true;
    const typeName = (item: Item) => dataset.typeById.get(item.typeId)?.name ?? '';
    const filtered = dataset
      .search(query)
      .filter(
        (item) =>
          (showAll || item.slot !== null) &&
          matchesCategory(item) &&
          (minLevel === null || item.level >= minLevel) &&
          (maxLevel === null || item.level <= maxLevel) &&
          (setId === null || item.setId === setId),
      );
    const sign = descending ? -1 : 1;
    return filtered.sort((a, b) => {
      const primary =
        sort === 'level' ? a.level - b.level : sort === 'type' ? collator.compare(typeName(a), typeName(b)) : 0;
      return sign * primary || (sort === 'name' ? sign : 1) * collator.compare(a.name, b.name);
    });
  }, [dataset, query, category, minLevel, maxLevel, setId, showAll, sort, descending]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, readInt(params.get('page')) ?? 1), pageCount);
  const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  function sortBy(key: SortKey) {
    const nextDescending = key === sort ? !descending : key === 'level';
    update({ sort: key, dir: nextDescending ? 'desc' : 'asc' });
  }

  function sortHeader(key: SortKey, label: string) {
    const arrow = sort === key ? (descending ? ' ▼' : ' ▲') : '';
    return (
      <th aria-sort={sort === key ? (descending ? 'descending' : 'ascending') : undefined}>
        <button type="button" className="sort" onClick={() => sortBy(key)}>
          {label}
          {arrow}
        </button>
      </th>
    );
  }

  const pager = (
    <div className="pager">
      <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
        ← Précédent
      </button>
      <span>
        Page {page} / {pageCount}
      </span>
      <button type="button" disabled={page >= pageCount} onClick={() => update({ page: String(page + 1) })}>
        Suivant →
      </button>
    </div>
  );

  return (
    <section>
      <h1>Objets</h1>
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label className="grow">
          Nom
          <input
            type="search"
            value={query}
            placeholder="ex. culbutoeuf"
            onChange={(event) => update({ q: event.target.value }, true)}
          />
        </label>
        <label>
          Type
          <select value={category} onChange={(event) => update({ cat: event.target.value })}>
            <option value="">Tous</option>
            <optgroup label="Emplacements">
              {(Object.keys(SLOT_LABELS) as SlotKind[]).map((slot) => (
                <option key={slot} value={`slot:${slot}`}>
                  {SLOT_LABELS[slot]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Types">
              {typeOptions.map((type) => (
                <option key={type.id} value={`type:${type.id}`}>
                  {type.name}
                  {type.outside ? ' (hors joueur)' : ''}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          Niveau min
          <input
            type="number"
            min={1}
            max={200}
            value={params.get('min') ?? ''}
            onChange={(event) => update({ min: event.target.value }, true)}
          />
        </label>
        <label>
          Niveau max
          <input
            type="number"
            min={1}
            max={200}
            value={params.get('max') ?? ''}
            onChange={(event) => update({ max: event.target.value }, true)}
          />
        </label>
        <label className="grow">
          Panoplie
          <select value={setId ?? ''} onChange={(event) => update({ set: event.target.value })}>
            <option value="">Toutes</option>
            {setOptions.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.level})
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => {
              const outsideType =
                category.startsWith('type:') && dataset.typeById.get(Number(category.slice(5)))?.slot === null;
              update({ hj: event.target.checked ? '1' : null, ...(!event.target.checked && outsideType ? { cat: null } : {}) });
            }}
          />
          Afficher les objets hors joueur
        </label>
        <button type="button" onClick={() => setParams(new URLSearchParams())}>
          Réinitialiser
        </button>
      </form>

      <p className="muted">
        {results.length} objet{results.length > 1 ? 's' : ''}
      </p>

      {results.length > 0 && (
        <>
          {pageCount > 1 && pager}
          <table className="item-table">
            <thead>
              <tr>
                <th aria-label="Image" />
                {sortHeader('name', 'Nom')}
                {sortHeader('type', 'Type')}
                {sortHeader('level', 'Niveau')}
                <th>Panoplie</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const set = item.setId === null ? undefined : dataset.setById.get(item.setId);
                return (
                  <tr key={item.id}>
                    <td className="icon-cell">
                      <Link to={`/objets/${item.id}`} tabIndex={-1}>
                        <ItemIcon iconId={item.iconId} shown={40} />
                      </Link>
                    </td>
                    <td>
                      <Link to={`/objets/${item.id}`}>{item.name}</Link>
                      {item.slot === null && <span className="badge">hors joueur</span>}
                    </td>
                    <td>{dataset.typeById.get(item.typeId)?.name || `Type ${item.typeId}`}</td>
                    <td className="num">{item.level}</td>
                    <td>{set && <Link to={`/panoplies/${set.id}`}>{set.name}</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageCount > 1 && pager}
        </>
      )}
    </section>
  );
}
