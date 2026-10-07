import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export type StuffDoc = { id: string; [key: string]: unknown };

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

export class StuffError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ID_LENGTH = 100;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export function isValidStuffId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= MAX_ID_LENGTH && ID_RE.test(id);
}

function assertId(id: string): void {
  if (!isValidStuffId(id)) throw new StuffError(400, `Identifiant de stuff invalide : « ${id} » (attendu : [a-z0-9-])`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNotFound(err: unknown): boolean {
  return isRecord(err) && err.code === 'ENOENT';
}

export function summarize(doc: Record<string, unknown>, id: string): StuffSummary {
  const s: StuffSummary = {
    id,
    name: typeof doc.name === 'string' ? doc.name : id,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : null,
  };
  if (typeof doc.createdAt === 'string') s.createdAt = doc.createdAt;
  if (typeof doc.dataVersion === 'string') s.dataVersion = doc.dataVersion;
  const character = doc.character;
  if (isRecord(character)) {
    if (typeof character.breedId === 'number' || character.breedId === null) s.breedId = character.breedId;
    if (typeof character.level === 'number') s.level = character.level;
  }
  if (isRecord(doc.source) && typeof doc.source.kind === 'string') s.sourceKind = doc.source.kind;
  return s;
}

/** Stockage « un fichier JSON par stuff » dans `dir`, indépendant de tout serveur. */
export function createStuffStore(dir: string) {
  const fileOf = (id: string) => path.join(dir, `${id}.json`);

  async function get(id: string): Promise<StuffDoc> {
    assertId(id);
    let raw: string;
    try {
      raw = await readFile(fileOf(id), 'utf8');
    } catch (err) {
      if (isNotFound(err)) throw new StuffError(404, `Stuff introuvable : ${id}`);
      throw err;
    }
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch {
      throw new StuffError(500, `Fichier stuffs/${id}.json illisible (JSON invalide)`);
    }
    if (!isRecord(doc)) throw new StuffError(500, `Fichier stuffs/${id}.json : objet JSON attendu`);
    return { ...doc, id };
  }

  async function list(): Promise<StuffSummary[]> {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
    const out: StuffSummary[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -'.json'.length);
      if (!isValidStuffId(id)) continue;
      try {
        out.push(summarize(await get(id), id));
      } catch {
        // Un fichier abîmé ne doit pas masquer les autres stuffs.
      }
    }
    return out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id));
  }

  async function save(id: string, doc: unknown): Promise<StuffDoc> {
    assertId(id);
    if (!isRecord(doc)) throw new StuffError(400, 'Le corps doit être un objet JSON');
    if (doc.id !== undefined && doc.id !== id) {
      throw new StuffError(400, `L'id du corps (« ${String(doc.id)} ») ne correspond pas à l'URL (« ${id} »)`);
    }
    const stored: StuffDoc = { id, ...doc };
    await mkdir(dir, { recursive: true });
    const target = fileOf(id);
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(tmp, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return stored;
  }

  async function remove(id: string): Promise<void> {
    assertId(id);
    try {
      await rm(fileOf(id));
    } catch (err) {
      if (isNotFound(err)) throw new StuffError(404, `Stuff introuvable : ${id}`);
      throw err;
    }
  }

  return { dir, get, list, save, remove };
}

export type StuffStore = ReturnType<typeof createStuffStore>;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new StuffError(413, 'Corps de requête trop volumineux');
    chunks.push(buf);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new StuffError(400, 'Corps de requête : JSON invalide');
  }
}

const PREFIX = '/api/stuffs';

/** Middleware Connect : GET /api/stuffs, GET/PUT/DELETE /api/stuffs/:id. */
export function createStuffsMiddleware(store: StuffStore) {
  return async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): Promise<void> => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '');
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return next();
    const method = req.method ?? 'GET';
    try {
      if (pathname === PREFIX) {
        if (method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return sendJson(res, 405, { error: 'Méthode non autorisée' });
        }
        return sendJson(res, 200, await store.list());
      }
      let id: string;
      try {
        id = decodeURIComponent(pathname.slice(PREFIX.length + 1));
      } catch {
        throw new StuffError(400, 'Identifiant de stuff mal encodé');
      }
      assertId(id);
      switch (method) {
        case 'GET':
          return sendJson(res, 200, await store.get(id));
        case 'PUT':
          return sendJson(res, 200, await store.save(id, await readJsonBody(req)));
        case 'DELETE':
          await store.remove(id);
          res.statusCode = 204;
          return void res.end();
        default:
          res.setHeader('Allow', 'GET, PUT, DELETE');
          return sendJson(res, 405, { error: 'Méthode non autorisée' });
      }
    } catch (err) {
      if (err instanceof StuffError) return sendJson(res, err.status, { error: err.message });
      console.error('[stuffs]', err);
      return sendJson(res, 500, { error: 'Erreur interne du stockage des stuffs' });
    }
  };
}

/** Plugin Vite : expose le dossier `stuffs/` en dev et en preview. */
export function stuffsPlugin(options: { dir?: string } = {}): Plugin {
  let store: StuffStore | undefined;
  const middleware = (root: string) => {
    store ??= createStuffStore(path.resolve(root, options.dir ?? 'stuffs'));
    return createStuffsMiddleware(store);
  };
  return {
    name: 'dofusbook-stuffs',
    configureServer(server) {
      server.middlewares.use(middleware(server.config.root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(server.config.root));
    },
  };
}
