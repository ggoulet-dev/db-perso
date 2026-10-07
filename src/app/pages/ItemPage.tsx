import { Link, useParams } from 'react-router-dom';
import { useDataset } from '../../data';
import { formatHit, SLOT_LABELS } from '../../domain/format';
import { ConditionTree, ItemIcon, LineList, WeaponStats } from '../components';
import { listPath } from '../listState';

export function ItemPage() {
  const { id } = useParams();
  const dataset = useDataset();
  const item = dataset.itemById.get(Number(id));

  if (!item) {
    return (
      <section>
        <h1>Objet introuvable</h1>
        <p>Aucun objet n° {id} dans les données.</p>
        <Link to={listPath()}>← Objets</Link>
      </section>
    );
  }

  const type = dataset.typeById.get(item.typeId);
  const set = item.setId === null ? undefined : dataset.setById.get(item.setId);

  return (
    <article className="sheet">
      <nav className="breadcrumb">
        <Link to={listPath()}>← Objets</Link>
      </nav>
      <header className="sheet-header">
        <ItemIcon iconId={item.iconId} size={128} />
        <div>
          <h1>{item.name}</h1>
          <p className="subtitle">
            {type?.name || `Type ${item.typeId}`}
            {item.slot && SLOT_LABELS[item.slot] !== type?.name ? ` (${SLOT_LABELS[item.slot]})` : ''} · niveau {item.level} · {item.pods} pods · n° {item.id}
            {item.slot === null && <span className="badge">hors joueur</span>}
          </p>
          {set && (
            <p>
              Panoplie : <Link to={`/panoplies/${set.id}`}>{set.name}</Link>
            </p>
          )}
        </div>
      </header>
      {item.description && <p className="description">{item.description}</p>}

      <div className="columns">
        <div>
          <section className="card">
            <h2>Effets</h2>
            <LineList lines={item.lines} texts={item.texts} />
          </section>
          {(item.weapon || item.hits.length > 0) && (
            <section className="card">
              <h2>Arme</h2>
              {item.hits.length > 0 && (
                <ul className="lines hits">
                  {item.hits.map((hit, i) => (
                    <li key={i}>{formatHit(hit)}</li>
                  ))}
                </ul>
              )}
              {item.weapon && <WeaponStats weapon={item.weapon} />}
            </section>
          )}
        </div>
        <div>
          <section className="card">
            <h2>Conditions</h2>
            {item.conditions ? <ConditionTree condition={item.conditions} /> : <p className="muted">Aucune.</p>}
          </section>
          {set && (
            <section className="card">
              <h2>
                <Link to={`/panoplies/${set.id}`}>{set.name}</Link>
              </h2>
              <ul className="piece-list">
                {set.itemIds.map((pieceId) => {
                  const piece = dataset.itemById.get(pieceId);
                  if (!piece) return null;
                  return (
                    <li key={pieceId} className={pieceId === item.id ? 'current' : undefined}>
                      <ItemIcon iconId={piece.iconId} shown={32} />
                      {pieceId === item.id ? piece.name : <Link to={`/objets/${pieceId}`}>{piece.name}</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="card">
            <h2>Recette</h2>
            {item.recipe.length === 0 ? (
              <p className="muted">Pas de recette.</p>
            ) : (
              <ul className="piece-list">
                {item.recipe.map(({ itemId, quantity }, i) => {
                  const ingredient = dataset.itemById.get(itemId);
                  return (
                    <li key={i}>
                      <span className="qty">{quantity} ×</span>
                      {ingredient ? (
                        <>
                          <ItemIcon iconId={ingredient.iconId} shown={32} />
                          <Link to={`/objets/${itemId}`}>{ingredient.name}</Link>
                        </>
                      ) : (
                        <span className="muted">ressource n° {itemId}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
