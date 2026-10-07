import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { copyOfBuild, errorMessage, stuffIdFor, stuffRepository, useBreeds, useDataset } from '../../data';
import type { StuffSummary } from '../../data/stuffRepository';
import { migrateBuild } from '../../domain/build/migrate';
import { createBuild } from '../../domain/build/types';
import { collator } from '../listState';

type RowMode = { id: string; kind: 'rename'; name: string } | { id: string; kind: 'delete' } | null;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function StuffListPage() {
  const dataset = useDataset();
  const breeds = useBreeds();
  const navigate = useNavigate();
  const [stuffs, setStuffs] = useState<StuffSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [mode, setMode] = useState<RowMode>(null);

  const refresh = useCallback(async () => {
    try {
      setStuffs(await stuffRepository.list());
    } catch (e) {
      setError(`Impossible de lister les stuffs : ${errorMessage(e)}. Le serveur Vite (npm run dev) est-il lancé ?`);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const takenIds = () => (stuffs ?? []).map((s) => s.id);

  function create(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim() || 'Nouveau stuff';
    void run(async () => {
      const id = stuffIdFor(name, takenIds());
      await stuffRepository.save(createBuild({ id, name, dataVersion: dataset.meta.gameVersion }));
      navigate(`/stuffs/${id}`);
    });
  }

  function duplicate(summary: StuffSummary) {
    void run(async () => {
      const raw = await stuffRepository.get(summary.id);
      if (!raw) throw new Error(`« ${summary.name} » n'existe plus.`);
      await stuffRepository.save(copyOfBuild(migrateBuild(raw), takenIds()));
      await refresh();
    });
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    void run(async () => {
      const raw = await stuffRepository.get(id);
      if (!raw) throw new Error('Ce stuff n’existe plus.');
      await stuffRepository.save({ ...migrateBuild(raw), name: trimmed, updatedAt: new Date().toISOString() });
      setMode(null);
      await refresh();
    });
  }

  function remove(id: string) {
    void run(async () => {
      await stuffRepository.remove(id);
      setMode(null);
      await refresh();
    });
  }

  const breedName = (breedId: number | null | undefined) =>
    breedId == null ? 'Sans classe' : breeds.status === 'ready' ? (breeds.breeds.find((b) => b.id === breedId)?.name ?? `Classe ${breedId}`) : '…';

  const sorted = stuffs ? [...stuffs].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || collator.compare(a.name, b.name)) : null;

  return (
    <section>
      <h1>Mes stuffs</h1>
      <form className="toolbar card" onSubmit={create}>
        <label className="grow">
          <span className="muted">Nom du nouveau stuff</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nouveau stuff" maxLength={120} />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          Créer
        </button>
      </form>

      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

      {sorted === null ? (
        !error && <p className="status">Chargement des stuffs…</p>
      ) : sorted.length === 0 ? (
        <p className="muted">Aucun stuff pour l’instant.</p>
      ) : (
        <table className="item-table stuff-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Classe</th>
              <th className="num">Niveau</th>
              <th>Données</th>
              <th>Modifié</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((stuff) => (
              <tr key={stuff.id}>
                <td>
                  {mode?.id === stuff.id && mode.kind === 'rename' ? (
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename(stuff.id, mode.name);
                      }}
                    >
                      <input
                        autoFocus
                        value={mode.name}
                        maxLength={120}
                        aria-label="Nouveau nom"
                        onChange={(e) => setMode({ ...mode, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setMode(null)}
                      />
                      <button type="submit" disabled={busy || !mode.name.trim()}>
                        Enregistrer
                      </button>
                      <button type="button" onClick={() => setMode(null)}>
                        Annuler
                      </button>
                    </form>
                  ) : (
                    <>
                      <Link to={`/stuffs/${stuff.id}`}>{stuff.name}</Link>
                      {stuff.sourceKind === 'dofusbook' && <span className="badge">DofusBook</span>}
                    </>
                  )}
                </td>
                <td>{breedName(stuff.breedId)}</td>
                <td className="num">{stuff.level ?? '—'}</td>
                <td>
                  {stuff.dataVersion ?? '—'}
                  {stuff.dataVersion && stuff.dataVersion !== dataset.meta.gameVersion && (
                    <span className="badge warn" title={`Sera revalidé sous ${dataset.meta.gameVersion} à l’ouverture`}>
                      à revalider
                    </span>
                  )}
                </td>
                <td>{formatDate(stuff.updatedAt)}</td>
                <td className="actions">
                  {mode?.id === stuff.id && mode.kind === 'delete' ? (
                    <span className="confirm">
                      Supprimer « {stuff.name} » ?
                      <button type="button" className="danger" disabled={busy} onClick={() => remove(stuff.id)}>
                        Supprimer
                      </button>
                      <button type="button" onClick={() => setMode(null)}>
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" disabled={busy} onClick={() => setMode({ id: stuff.id, kind: 'rename', name: stuff.name })}>
                        Renommer
                      </button>
                      <button type="button" disabled={busy} onClick={() => duplicate(stuff)}>
                        Dupliquer
                      </button>
                      <button type="button" disabled={busy} onClick={() => setMode({ id: stuff.id, kind: 'delete' })}>
                        Supprimer
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
