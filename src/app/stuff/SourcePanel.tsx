import type { BuildSource } from '../../domain/build/types';

/** Route publique du front DofusBook (DOFUS.md §10.2), non vérifiée pour un stuff privé. */
export function dofusbookStuffUrl(stuffId: number): string {
  return `https://www.dofusbook.net/fr/equipement/${stuffId}/snapshot`;
}

export function SourcePanel({ source }: { source: BuildSource }) {
  const date = new Date(source.importedAt);
  return (
    <section className="card source-card">
      <h2>Source</h2>
      <p>
        Importé de DofusBook (stuff n° {source.stuffId})
        {!Number.isNaN(date.getTime()) && <> le {date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</>}
        {' · '}
        <a href={dofusbookStuffUrl(source.stuffId)} target="_blank" rel="noreferrer" title="Lien déduit des routes du front DofusBook">
          Voir sur DofusBook
        </a>
      </p>
      {source.unmapped.length === 0 ? (
        <p className="muted small">Toutes les lignes ont été traduites.</p>
      ) : (
        <details>
          <summary>
            {source.unmapped.length} ligne{source.unmapped.length > 1 ? 's' : ''} non traduite{source.unmapped.length > 1 ? 's' : ''} (ignorée
            {source.unmapped.length > 1 ? 's' : ''} dans les totaux)
          </summary>
          <ul className="unmapped-list">
            {source.unmapped.map((line, i) => (
              <li key={i}>
                <code>{line}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
