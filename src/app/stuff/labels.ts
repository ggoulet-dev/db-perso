import { SLOT_LABELS, type SlotKey } from '../../domain/build/types';
import type { Dataset } from '../../domain/dataset';
import type { StatSource } from '../../domain/engine';
import { STATS, type StatKey } from '../../domain/stats';

export const STAT_KEYS = Object.keys(STATS) as StatKey[];

export function statLabel(stat: StatKey): string {
  return STATS[stat].label;
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function sourceLabel(source: StatSource, dataset: Pick<Dataset, 'itemById' | 'setById'>, names: Partial<Record<SlotKey, string>> = {}): string {
  switch (source.kind) {
    case 'base':
      return 'Base';
    case 'caracs':
      return 'Caracs (points)';
    case 'scrolls':
      return 'Parchemins';
    case 'derived':
      return `Dérivé de ${statLabel(source.from)}`;
    case 'slot': {
      const name = dataset.itemById.get(source.itemId)?.name ?? names[source.slot] ?? `Objet ${source.itemId}`;
      return `${SLOT_LABELS[source.slot]} : ${name}${source.exo ? ' (exo)' : ''}`;
    }
    case 'set':
      return `${dataset.setById.get(source.setId)?.name ?? `Panoplie ${source.setId}`} (${source.pieces} pièces)`;
    case 'extra':
      return `Bonus : ${source.label}`;
  }
}

export function piecesLabel(n: number): string {
  return `${n} pièce${n > 1 ? 's' : ''}`;
}
