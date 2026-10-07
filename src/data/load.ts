import { createDataset, DATASET_SCHEMA } from '../domain/dataset';
import type { Dataset, DatasetMeta, ItemSet, ItemsFile } from '../domain/dataset';

export async function fetchJson<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!response.ok) throw new Error(`${name} : HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function loadDataset(): Promise<Dataset> {
  const [meta, itemsFile, sets] = await Promise.all([
    fetchJson<DatasetMeta>('meta.json'),
    fetchJson<ItemsFile>('items.json'),
    fetchJson<ItemSet[]>('sets.json'),
  ]);
  if (meta.schema !== DATASET_SCHEMA) {
    throw new Error(`Schéma de données ${meta.schema}, attendu ${DATASET_SCHEMA} : relancer « npm run build-data ».`);
  }
  return createDataset({ meta, types: itemsFile.types, items: itemsFile.items, sets });
}
