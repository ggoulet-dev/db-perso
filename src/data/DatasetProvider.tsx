import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Dataset } from '../domain/dataset';
import { loadDataset } from './load';

const DatasetContext = createContext<Dataset | null>(null);

// Un seul chargement par session, même quand StrictMode monte deux fois.
let pending: Promise<Dataset> | null = null;

type State = { status: 'loading' } | { status: 'ready'; dataset: Dataset } | { status: 'error'; message: string };

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    pending ??= loadDataset();
    pending.then(
      (dataset) => active && setState({ status: 'ready', dataset }),
      (error: unknown) => {
        pending = null;
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') return <p className="status">Chargement des données…</p>;
  if (state.status === 'error') {
    return (
      <div className="status error">
        <p>Impossible de charger les données : {state.message}</p>
        <button type="button" onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }
  return <DatasetContext.Provider value={state.dataset}>{children}</DatasetContext.Provider>;
}

export function useDataset(): Dataset {
  const dataset = useContext(DatasetContext);
  if (!dataset) throw new Error('useDataset doit être appelé sous <DatasetProvider>.');
  return dataset;
}
