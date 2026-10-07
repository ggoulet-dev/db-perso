import { Link, useParams } from 'react-router-dom';
import { useDataset } from '../../data';
import { ItemIcon, LineList } from '../components';
import { listPath } from '../listState';

export function SetPage() {
  const { id } = useParams();
  const dataset = useDataset();
  const set = dataset.setById.get(Number(id));

  if (!set) {
    return (
      <section>
        <h1>Panoplie introuvable</h1>
        <p>Aucune panoplie n° {id} dans les données.</p>
        <Link to={listPath()}>← Objets</Link>
      </section>
    );
  }

  const pieces = set.itemIds.flatMap((itemId) => dataset.itemById.get(itemId) ?? []);

  return (
    <article className="sheet">
      <nav className="breadcrumb">
        <Link to={listPath()}>← Objets</Link>
      </nav>
      <header>
        <h1>{set.name}</h1>
        <p className="subtitle">
          Panoplie · niveau {set.level} · {pieces.length} pièce{pieces.length > 1 ? 's' : ''} · n° {set.id} ·{' '}
          <Link to={`/objets?set=${set.id}&hj=1`}>voir dans la liste</Link>
        </p>
      </header>

      <section className="card">
        <h2>Pièces</h2>
        <ul className="piece-grid">
          {pieces.map((piece) => (
            <li key={piece.id}>
              <Link to={`/objets/${piece.id}`} className="piece">
                <ItemIcon iconId={piece.iconId} />
                <span>
                  <strong>{piece.name}</strong>
                  <span className="muted">
                    {dataset.typeById.get(piece.typeId)?.name} · niveau {piece.level}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Bonus</h2>
        {set.bonuses.length === 0 ? (
          <p className="muted">Aucun bonus.</p>
        ) : (
          <div className="bonus-grid">
            {set.bonuses.map((bonus) => (
              <div key={bonus.pieces}>
                <h3>{bonus.pieces} pièces</h3>
                <LineList lines={bonus.lines} texts={bonus.texts} />
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
