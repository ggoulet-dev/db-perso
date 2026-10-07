import { useEffect, useState } from 'react';
import type { Breed, BreedsFile } from '../domain/rules';

// Un seul chargement par session, même quand StrictMode monte deux fois.
let pending: Promise<Breed[]> | null = null;

async function loadBreeds(): Promise<Breed[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/breeds.json`);
  if (!response.ok) throw new Error(`breeds.json : HTTP ${response.status}`);
  const file = (await response.json()) as BreedsFile;
  return file.breeds;
}

export type BreedsState = { status: 'loading' } | { status: 'ready'; breeds: Breed[] } | { status: 'error'; message: string };

export function useBreeds(): BreedsState {
  const [state, setState] = useState<BreedsState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    pending ??= loadBreeds();
    pending.then(
      (breeds) => active && setState({ status: 'ready', breeds }),
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
