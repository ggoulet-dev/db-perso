import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataset } from '../../data';
import { SLOT_KIND, SLOT_LABELS, type SlotKey } from '../../domain/build/types';
import { normalizeText, type Item } from '../../domain/dataset';
import { ItemIcon } from '../components';
import { collator } from '../listState';

const SHOWN = 60;

interface Props {
  slot: SlotKey;
  level: number;
  currentItemId: number | null;
  onPick(item: Item): void;
  onCancel?: () => void;
}

export function ItemPicker({ slot, level, currentItemId, onPick, onCancel }: Props) {
  const dataset = useDataset();
  const [query, setQuery] = useState('');

  const candidates = useMemo(
    () =>
      (dataset.itemsBySlot.get(SLOT_KIND[slot]) ?? [])
        .filter((item) => item.level <= level)
        .sort((a, b) => b.level - a.level || collator.compare(a.name, b.name))
        .map((item) => ({ item, name: normalizeText(item.name) })),
    [dataset, slot, level],
  );

  const matches = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    return words.length === 0 ? candidates : candidates.filter(({ name }) => words.every((word) => name.includes(word)));
  }, [candidates, query]);

  return (
    <div className="picker">
      <div className="picker-head">
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
          placeholder={`Rechercher : ${SLOT_LABELS[slot].toLowerCase()} de niveau ≤ ${level}`}
          aria-label="Rechercher un objet"
        />
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
      <p className="muted small">
        {matches.length} objet{matches.length > 1 ? 's' : ''} compatible{matches.length > 1 ? 's' : ''}
        {matches.length > SHOWN && ` — ${SHOWN} premiers affichés, affinez la recherche`}
      </p>
      <ul className="picker-list">
        {matches.slice(0, SHOWN).map(({ item }) => {
          const set = item.setId === null ? undefined : dataset.setById.get(item.setId);
          return (
            <li key={item.id} className={item.id === currentItemId ? 'current' : undefined}>
              <button type="button" className="picker-item" onClick={() => onPick(item)}>
                <ItemIcon iconId={item.iconId} shown={36} />
                <span>
                  <strong>{item.name}</strong>
                  <span className="muted small">
                    Niv. {item.level}
                    {set && ` · ${set.name}`}
                  </span>
                </span>
              </button>
              <Link to={`/objets/${item.id}`} className="small">
                fiche
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
