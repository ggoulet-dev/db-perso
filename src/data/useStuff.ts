import { useCallback, useEffect, useRef, useState } from 'react';
import { BuildFormatError, migrateBuild } from '../domain/build/migrate';
import type { Build } from '../domain/build/types';
import { revalidateBuild, type BuildIssue } from '../domain/build/validate';
import type { Dataset } from '../domain/dataset';
import { errorMessage, stuffRepository } from './stuffs';

const SAVE_DELAY_MS = 600;

export type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready' };

export type SaveState = { status: 'saved' } | { status: 'pending' } | { status: 'saving' } | { status: 'error'; message: string };

/** Changements constatés à l'ouverture sous une autre version des données. */
export interface Revalidation {
  from: string;
  to: string;
  issues: BuildIssue[];
}

export interface StuffHandle {
  load: LoadState;
  build: Build | null;
  save: SaveState;
  revalidation: Revalidation | null;
  update(recipe: (build: Build) => Build): void;
  /** Enregistre tout de suite ; la promesse se résout quand les PUT en cours sont terminés. */
  flush(): Promise<void>;
  dismissRevalidation(): void;
}

/** Ouvre un stuff, le revalide si la version des données a changé et l'enregistre automatiquement. */
export function useStuff(id: string, dataset: Pick<Dataset, 'itemById' | 'meta'>): StuffHandle {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [build, setBuild] = useState<Build | null>(null);
  const [save, setSave] = useState<SaveState>({ status: 'saved' });
  const [revalidation, setRevalidation] = useState<Revalidation | null>(null);

  const latest = useRef<Build | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Les PUT partent l'un après l'autre : un ancien état ne peut pas écraser un plus récent.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const doc = latest.current;
    if (!dirty.current || !doc) return chain.current.then(() => undefined);
    dirty.current = false;
    setSave({ status: 'saving' });
    chain.current = chain.current.then(() =>
      stuffRepository.save(doc).then(
        () => {
          if (!dirty.current) setSave({ status: 'saved' });
        },
        (error: unknown) => {
          dirty.current = true;
          setSave({ status: 'error', message: errorMessage(error) });
        },
      ),
    );
    return chain.current.then(() => undefined);
  }, []);

  const schedule = useCallback(() => {
    dirty.current = true;
    setSave({ status: 'pending' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  const update = useCallback(
    (recipe: (build: Build) => Build) => {
      const current = latest.current;
      if (!current) return;
      const next = { ...recipe(current), updatedAt: new Date().toISOString() };
      latest.current = next;
      setBuild(next);
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    let active = true;
    setLoad({ status: 'loading' });
    stuffRepository.get(id).then(
      (raw) => {
        if (!active) return;
        if (raw === null) {
          setLoad({ status: 'missing' });
          return;
        }
        let opened: Build;
        try {
          opened = migrateBuild(raw);
        } catch (error) {
          setLoad({ status: 'error', message: error instanceof BuildFormatError ? error.message : errorMessage(error) });
          return;
        }
        const version = dataset.meta.gameVersion;
        if (opened.dataVersion !== version) {
          const result = revalidateBuild(opened, dataset);
          setRevalidation({ from: opened.dataVersion, to: version, issues: result.issues });
          opened = result.build;
          dirty.current = true;
        }
        latest.current = opened;
        setBuild(opened);
        setLoad({ status: 'ready' });
        if (dirty.current) schedule();
      },
      (error: unknown) => active && setLoad({ status: 'error', message: errorMessage(error) }),
    );
    return () => {
      active = false;
    };
  }, [id, dataset, schedule]);

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const dismissRevalidation = useCallback(() => setRevalidation(null), []);

  return { load, build, save, revalidation, update, flush, dismissRevalidation };
}
