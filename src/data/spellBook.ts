import { useEffect, useState } from 'react';
import { loadSpellBook, type SpellBook } from '../domain/spells';
import { fetchJson } from './load';

// Chargé à la demande (page Sorts, onglet Sorts), une seule fois par session.
let pending: Promise<SpellBook> | null = null;

export type SpellBookState = { status: 'loading' } | { status: 'ready'; book: SpellBook } | { status: 'error'; message: string };

export function useSpellBook(): SpellBookState {
  const [state, setState] = useState<SpellBookState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    pending ??= loadSpellBook((name) => fetchJson<unknown>(name));
    pending.then(
      (book) => active && setState({ status: 'ready', book }),
      (error: unknown) => {
        pending = null;
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}
