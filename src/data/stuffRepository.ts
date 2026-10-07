/** Résumé d'un stuff pour les listes ; les champs optionnels n'existent que s'ils sont présents dans le fichier. */
export type StuffSummary = {
  id: string;
  name: string;
  updatedAt: string | null;
  createdAt?: string;
  dataVersion?: string;
  breedId?: number | null;
  level?: number;
  sourceKind?: string;
};

/**
 * Stockage des stuffs, indépendant du support : l'implémentation HTTP (fichiers via le serveur Vite)
 * peut être remplacée par une implémentation IndexedDB sans toucher aux appelants (PLAN §2.2).
 */
export interface StuffRepository<T extends { id: string }> {
  list(): Promise<StuffSummary[]>;
  /** `null` si le stuff n'existe pas. */
  get(id: string): Promise<T | null>;
  /** Crée ou remplace ; renvoie le document tel qu'enregistré. */
  save(doc: T): Promise<T>;
  /** Sans effet si le stuff n'existe pas. */
  remove(id: string): Promise<void>;
}

export class StuffRepositoryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'StuffRepositoryError';
    this.status = status;
  }
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidStuffId(id: string): boolean {
  return id.length <= 100 && ID_RE.test(id);
}

async function errorFrom(res: Response): Promise<StuffRepositoryError> {
  let message = `HTTP ${res.status}`;
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string') {
      message = (body as { error: string }).error;
    }
  } catch {
    // corps non JSON : on garde le code HTTP
  }
  return new StuffRepositoryError(res.status, message);
}

export function createHttpStuffRepository<T extends { id: string }>(
  baseUrl = '/api/stuffs',
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): StuffRepository<T> {
  const urlOf = (id: string) => {
    if (!isValidStuffId(id)) throw new StuffRepositoryError(400, `Identifiant de stuff invalide : « ${id} »`);
    return `${baseUrl}/${encodeURIComponent(id)}`;
  };

  return {
    async list() {
      const res = await fetchImpl(baseUrl);
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as StuffSummary[];
    },
    async get(id) {
      const res = await fetchImpl(urlOf(id));
      if (res.status === 404) return null;
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as T;
    },
    async save(doc) {
      const res = await fetchImpl(urlOf(doc.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (!res.ok) throw await errorFrom(res);
      return (await res.json()) as T;
    },
    async remove(id) {
      const res = await fetchImpl(urlOf(id), { method: 'DELETE' });
      if (res.status === 404) return;
      if (!res.ok) throw await errorFrom(res);
    },
  };
}
