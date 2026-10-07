import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { copyOfBuild, errorMessage, stuffRepository, useBreeds, useDataset, useStuff } from '../../data';
import type { SaveState, StuffHandle } from '../../data/useStuff';
import type { Breed } from '../../domain/rules';
import { computeBuild } from '../../domain/engine';
import { CaracsPanel } from '../stuff/CaracsPanel';
import { CharacterPanel } from '../stuff/CharacterPanel';
import { ExtrasPanel } from '../stuff/ExtrasPanel';
import { ResultsPanel } from '../stuff/ResultsPanel';
import { SlotsPanel } from '../stuff/SlotsPanel';
import { SourcePanel } from '../stuff/SourcePanel';
import { SpellsTab } from '../stuff/SpellsTab';
import { WeaponPanel } from '../stuff/WeaponPanel';
import { DEFAULT_DAMAGE_SETTINGS, type DamageSettings } from '../damage/DamageSettings';

type Tab = 'stuff' | 'weapon' | 'spells';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'stuff', label: 'Équipement' },
  { key: 'weapon', label: 'Arme' },
  { key: 'spells', label: 'Sorts' },
];

const SAVE_LABELS: Record<Exclude<SaveState['status'], 'error'>, string> = {
  saved: 'Enregistré',
  pending: 'Modifications en attente…',
  saving: 'Enregistrement…',
};

function SaveIndicator({ save, retry }: { save: SaveState; retry(): void }) {
  if (save.status === 'error') {
    return (
      <span className="save-state error" role="alert">
        Échec de l’enregistrement : {save.message}{' '}
        <button type="button" onClick={retry}>
          Réessayer
        </button>
      </span>
    );
  }
  return <span className={`save-state ${save.status}`}>{SAVE_LABELS[save.status]}</span>;
}

export function StuffEditorPage() {
  const { id = '' } = useParams();
  const breeds = useBreeds();
  if (breeds.status === 'loading') return <p className="status">Chargement des classes…</p>;
  if (breeds.status === 'error') return <p className="status error">Impossible de charger les classes : {breeds.message}</p>;
  // Un stuff = une instance : changer d'id repart d'un état propre.
  return <StuffEditor key={id} id={id} breeds={breeds.breeds} />;
}

function StuffEditor({ id, breeds }: { id: string; breeds: Breed[] }) {
  const dataset = useDataset();
  const stuff = useStuff(id, dataset);
  const { build, load } = stuff;
  const result = useMemo(() => (build ? computeBuild(build, dataset, breeds) : null), [build, dataset, breeds]);
  const navigate = useNavigate();
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('stuff');
  // Options de dégâts partagées par les onglets Arme et Sorts, le temps de la session.
  const [damageSettings, setDamageSettings] = useState<DamageSettings>(DEFAULT_DAMAGE_SETTINGS);

  async function compareWithCopy() {
    if (!build) return;
    setCopying(true);
    setCopyError(null);
    try {
      // La comparaison relit l'original : il doit être enregistré avant d'y aller.
      await stuff.flush();
      const copy = copyOfBuild(build, (await stuffRepository.list()).map((s) => s.id));
      await stuffRepository.save(copy);
      navigate(`/comparer?a=${encodeURIComponent(build.id)}&b=${encodeURIComponent(copy.id)}`);
    } catch (error) {
      setCopyError(`Copie impossible : ${errorMessage(error)}`);
      setCopying(false);
    }
  }

  if (load.status === 'loading') return <p className="status">Ouverture du stuff…</p>;
  if (load.status === 'missing') {
    return (
      <section>
        <h1>Stuff introuvable</h1>
        <p>
          Aucun fichier <code>stuffs/{id}.json</code>. <Link to="/stuffs">Retour à mes stuffs</Link>
        </p>
      </section>
    );
  }
  if (load.status === 'error') {
    return (
      <section>
        <h1>Stuff illisible</h1>
        <p className="banner error">{load.message}</p>
        <Link to="/stuffs">Retour à mes stuffs</Link>
      </section>
    );
  }
  if (!build || !result) return null;

  return (
    <section className="editor">
      <div className="editor-head">
        <Link to="/stuffs" className="muted">
          ← Mes stuffs
        </Link>
        <input
          className="title-input"
          value={build.name}
          maxLength={120}
          aria-label="Nom du stuff"
          onChange={(e) => {
            const name = e.target.value;
            stuff.update((b) => ({ ...b, name }));
          }}
          onBlur={() => !build.name.trim() && stuff.update((b) => ({ ...b, name: 'Sans nom' }))}
        />
        <SaveIndicator save={stuff.save} retry={stuff.flush} />
        <span className="muted small">
          Données {build.dataVersion} · <code>stuffs/{build.id}.json</code>
        </span>
        <span className="card-tools">
          <Link to={`/comparer?a=${encodeURIComponent(build.id)}`}>Comparer…</Link>
          <button type="button" onClick={() => void compareWithCopy()} disabled={copying} title="Duplique ce stuff puis ouvre la comparaison avec la copie">
            {copying ? 'Copie…' : 'Comparer à une copie'}
          </button>
        </span>
      </div>
      {copyError && (
        <p className="banner error" role="alert">
          {copyError}
        </p>
      )}

      <RevalidationBanner stuff={stuff} />

      <div className="editor-grid">
        <div className="editor-main">
          <div className="tabs" role="tablist" aria-label="Sections du stuff">
            {TABS.map(({ key, label }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'current' : undefined} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'stuff' && (
            <>
              {build.source && <SourcePanel source={build.source} />}
              <CharacterPanel build={build} breeds={breeds} update={stuff.update} />
              <SlotsPanel build={build} result={result} breed={breeds.find((b) => b.id === build.character.breedId)} update={stuff.update} />
              <CaracsPanel build={build} result={result} update={stuff.update} />
              <ExtrasPanel build={build} update={stuff.update} />
            </>
          )}
          {tab === 'weapon' && (
            <WeaponPanel build={build} result={result} update={stuff.update} settings={damageSettings} onSettings={setDamageSettings} />
          )}
          {tab === 'spells' && (
            <SpellsTab build={build} result={result} breeds={breeds} settings={damageSettings} onSettings={setDamageSettings} />
          )}
        </div>
        <aside className="editor-side">
          <ResultsPanel build={build} result={result} />
        </aside>
      </div>
    </section>
  );
}

function RevalidationBanner({ stuff }: { stuff: StuffHandle }) {
  const { revalidation } = stuff;
  if (!revalidation) return null;
  return (
    <div className={`banner ${revalidation.issues.length ? 'warn' : 'info'}`}>
      <p>
        Stuff validé sous les données {revalidation.from || '(inconnues)'}, revalidé sous {revalidation.to}
        {revalidation.issues.length === 0 ? ' : aucun changement.' : ' :'}
      </p>
      {revalidation.issues.length > 0 && (
        <ul>
          {revalidation.issues.map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={stuff.dismissRevalidation}>
        Compris
      </button>
    </div>
  );
}
