import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, stuffRepository, useBreeds, useDataset } from '../../data';
import { SLOT_LABELS } from '../../domain/build/types';
import { importDofusbook, type DofusbookImportEntry, type ImportedItem } from '../../domain/import/dofusbook';
import type { Breed } from '../../domain/rules';
import { dofusbookExportScript, parseStuffIds } from '../dofusbookScript';

interface Input {
  label: string;
  text: string;
}

type Created = { id: string; name: string } | { error: string; name: string };

export function ImportPage() {
  const dataset = useDataset();
  const breedsState = useBreeds();
  const breeds = breedsState.status === 'ready' ? breedsState.breeds : undefined;
  const [takenIds, setTakenIds] = useState<string[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [input, setInput] = useState<Input | null>(null);
  const [pasted, setPasted] = useState('');
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[] | null>(null);

  useEffect(() => {
    stuffRepository.list().then(
      (list) => setTakenIds(list.map((s) => s.id)),
      (error: unknown) => setListError(`Impossible de lister les stuffs existants : ${errorMessage(error)}. Le serveur Vite (npm run dev) est-il lancé ?`),
    );
  }, []);

  const entries = useMemo(
    () => (input && takenIds ? importDofusbook(input.text, { dataset, breeds, takenIds }) : null),
    [input, takenIds, dataset, breeds],
  );
  const chosen = entries?.filter((e): e is Extract<DofusbookImportEntry, { ok: true }> => e.ok && !excluded.has(e.index)) ?? [];

  function load(next: Input) {
    setInput(next);
    setExcluded(new Set());
    setCreated(null);
    setReadError(null);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      load({ label: file.name, text: await file.text() });
    } catch (error) {
      setReadError(`Lecture de ${file.name} impossible : ${errorMessage(error)}`);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  }

  async function create() {
    if (!input || chosen.length === 0) return;
    setBusy(true);
    const indexes = new Set(chosen.map((e) => e.index));
    const results: Created[] = [];
    try {
      // Ids recalculés sur la liste du moment : un PUT remplacerait sans prévenir un stuff du même id.
      const fresh = (await stuffRepository.list()).map((s) => s.id);
      const again = importDofusbook(input.text, { dataset, breeds, takenIds: fresh });
      for (const entry of again) {
        if (!entry.ok || !indexes.has(entry.index)) continue;
        try {
          await stuffRepository.save(entry.build);
          results.push({ id: entry.build.id, name: entry.build.name });
        } catch (error) {
          results.push({ name: entry.build.name, error: errorMessage(error) });
        }
      }
      setTakenIds([...fresh, ...results.flatMap((r) => ('id' in r ? [r.id] : []))]);
    } catch (error) {
      results.push({ name: 'Liste des stuffs', error: errorMessage(error) });
    }
    setCreated(results);
    setInput(null);
    setBusy(false);
  }

  return (
    <section className="import-page">
      <h1>Import DofusBook</h1>
      <p>
        Fichier attendu : la réponse complète de <code>GET https://www.dofusbook.net/api/stuffs/dofus/private/&#123;id&#125;</code> (ou{' '}
        <code>public/&#123;id&#125;</code>), ou un tableau de ces réponses. Rien n’est enregistré avant d’avoir relu le rapport.
      </p>

      <ExportScript />

      {listError && (
        <p className="banner error" role="alert">
          {listError}
        </p>
      )}

      <div className="card">
        <div
          className={`drop-zone${dragging ? ' active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p>Déposer un fichier .json ici</p>
          <label className="file-button">
            <span>ou choisir un fichier…</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <form
          className="paste-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (pasted.trim()) load({ label: 'Texte collé', text: pasted });
          }}
        >
          <label>
            <span className="muted">… ou coller le JSON</span>
            <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} spellCheck={false} placeholder='[{"stuff": {…}, "items": […]}]' />
          </label>
          <button type="submit" disabled={!pasted.trim()}>
            Analyser le texte
          </button>
        </form>
        {readError && <p className="banner error">{readError}</p>}
      </div>

      {created && <CreatedList created={created} />}

      {input && !takenIds && !listError && <p className="status">Chargement des stuffs existants…</p>}

      {input && entries && (
        <>
          <div className="card-head">
            <h2>
              Rapport : {input.label}
              <span className="muted small">
                {' '}
                ({entries.length} stuff{entries.length > 1 ? 's' : ''})
              </span>
            </h2>
            <span className="card-tools">
              <button type="button" onClick={() => setInput(null)}>
                Annuler
              </button>
              <button type="button" className="primary" disabled={busy || chosen.length === 0} onClick={() => void create()}>
                {busy ? 'Création…' : `Créer ${chosen.length} stuff${chosen.length > 1 ? 's' : ''}`}
              </button>
            </span>
          </div>
          {breedsState.status === 'error' && <p className="banner warn">Classes non chargées : la classe importée n’est pas vérifiée.</p>}
          {entries.map((entry) =>
            entry.ok ? (
              <ReportCard
                key={entry.index}
                entry={entry}
                breeds={breeds}
                selected={!excluded.has(entry.index)}
                showToggle={entries.length > 1}
                onToggle={(on) =>
                  setExcluded((prev) => {
                    const next = new Set(prev);
                    if (on) next.delete(entry.index);
                    else next.add(entry.index);
                    return next;
                  })
                }
              />
            ) : (
              <div key={entry.index} className="banner error">
                <p>
                  <strong>{entry.name ?? (entries.length > 1 ? `Stuff n° ${entry.index + 1}` : 'Import impossible')}</strong>
                </p>
                <p>{entry.error}</p>
              </div>
            ),
          )}
        </>
      )}
    </section>
  );
}

function CreatedList({ created }: { created: Created[] }) {
  const ok = created.filter((c) => 'id' in c).length;
  return (
    <div className={`banner ${ok === created.length ? 'info' : 'warn'}`}>
      <p>
        {ok} stuff{ok > 1 ? 's' : ''} créé{ok > 1 ? 's' : ''} :
      </p>
      <ul>
        {created.map((c, i) => (
          <li key={i}>
            {'id' in c ? (
              <Link to={`/stuffs/${c.id}`}>{c.name}</Link>
            ) : (
              <>
                {c.name} : échec ({c.error})
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemRows({ items }: { items: ImportedItem[] }) {
  return (
    <ul className="import-items">
      {items.map((item) => (
        <li key={item.slot}>
          <span className="muted">{SLOT_LABELS[item.slot]} :</span> {item.itemId ? <Link to={`/objets/${item.itemId}`}>{item.name || `Objet ${item.itemId}`}</Link> : item.name || `id DofusBook ${item.dofusbookId}`}
          {item.note && <span className="muted small"> — {item.note}</span>}
        </li>
      ))}
    </ul>
  );
}

interface ReportCardProps {
  entry: Extract<DofusbookImportEntry, { ok: true }>;
  breeds: Breed[] | undefined;
  selected: boolean;
  showToggle: boolean;
  onToggle(on: boolean): void;
}

function ReportCard({ entry, breeds, selected, showToggle, onToggle }: ReportCardProps) {
  const { build, report: r } = entry;
  const breedId = build.character.breedId;
  const breed = breedId === null ? 'Sans classe' : (breeds?.find((b) => b.id === breedId)?.name ?? `Classe ${breedId}`);

  return (
    <section className={`card report${selected ? '' : ' excluded'}`}>
      <div className="card-head">
        <h3>
          {showToggle && <input type="checkbox" checked={selected} onChange={(e) => onToggle(e.target.checked)} aria-label={`Importer ${r.name}`} />} {r.name}
        </h3>
        <span className="muted small">
          DofusBook n° {r.stuffId} · {breed} niveau {build.character.level} · <code>stuffs/{build.id}.json</code>
        </span>
      </div>

      <p className="report-counts">
        <span className="badge cond-ok">{r.resolved.length} trouvés</span>
        <span className={`badge${r.fallback.length ? ' warn' : ''}`}>{r.fallback.length} par repli nom + niveau</span>
        <span className={`badge${r.missing.length ? ' cond-bad' : ''}`}>{r.missing.length} introuvables</span>
        <span className={`badge${r.unmapped.length ? ' warn' : ''}`}>{r.unmapped.length} lignes non traduites</span>
        {build.weaponFm && <span className="badge">FM élémentaire d’arme</span>}
        {build.extras.length > 0 && <span className="badge">FM globale : {build.extras.length} ligne{build.extras.length > 1 ? 's' : ''}</span>}
      </p>

      {r.warnings.length > 0 && (
        <div className="banner warn">
          <ul>
            {r.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {r.missing.length > 0 && (
        <>
          <h4>Introuvables (emplacement laissé vide)</h4>
          <ItemRows items={r.missing} />
        </>
      )}
      {r.fallback.length > 0 && (
        <>
          <h4>Retrouvés par nom + niveau</h4>
          <ItemRows items={r.fallback} />
        </>
      )}
      {r.unmapped.length > 0 && (
        <>
          <h4>Lignes non traduites</h4>
          <table className="grid-table unmapped">
            <thead>
              <tr>
                <th>Où</th>
                <th>Code</th>
                <th>Valeur</th>
                <th>Raison</th>
              </tr>
            </thead>
            <tbody>
              {r.unmapped.map((u, i) => (
                <tr key={i}>
                  <td>
                    <code>{u.where}</code>
                  </td>
                  <td>
                    <code>{u.code}</code>
                  </td>
                  <td>
                    <code>{JSON.stringify(u.value)}</code>
                  </td>
                  <td>{u.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <details>
        <summary>Objets trouvés par id Ankama ({r.resolved.length})</summary>
        <ItemRows items={r.resolved} />
      </details>
      <details open>
        <summary>Hypothèses ({r.assumptions.length})</summary>
        <ul className="assumptions">
          {r.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function ExportScript() {
  const [idsText, setIdsText] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const ids = parseStuffIds(idsText);
  const script = dofusbookExportScript(ids, visibility);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(script);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <details className="card export-script">
      <summary>
        <h2 className="inline">Exporter mes stuffs depuis DofusBook</h2>
      </summary>
      <p className="muted">
        Script réservé à un usage personnel, sur ses propres stuffs : les CGU de DofusBook interdisent l’extraction à grande échelle, d’où une seule requête
        toutes les 2 secondes.
      </p>
      <ol>
        <li>Se connecter sur dofusbook.net, ouvrir la console de Chrome (Cmd + Option + J).</li>
        <li>Coller le script ci-dessous et valider : le tableau JSON est copié dans le presse-papiers (<code>copy()</code> n’existe que dans la console DevTools).</li>
        <li>Revenir ici et le coller dans la zone de texte, ou l’enregistrer dans un fichier .json.</li>
      </ol>
      <div className="toolbar">
        <label className="grow">
          <span className="muted">Ids des stuffs (ou URL / slugs « 23428650-mon-stuff »)</span>
          <input value={idsText} onChange={(e) => setIdsText(e.target.value)} placeholder="23428650, 23428299" />
        </label>
        <label>
          <span className="muted">Route</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}>
            <option value="private">private (mes stuffs, connecté)</option>
            <option value="public">public</option>
          </select>
        </label>
      </div>
      {ids.length === 0 && <p className="muted small">Aucun id saisi : le script contient un id 0 à remplacer.</p>}
      <pre className="script">
        <code>{script}</code>
      </pre>
      <button type="button" onClick={() => void copyScript()}>
        {copyState === 'copied' ? 'Copié' : 'Copier le script'}
      </button>
      {copyState === 'failed' && <span className="muted small"> Copie refusée par le navigateur : sélectionner le texte et le copier à la main.</span>}
    </details>
  );
}
