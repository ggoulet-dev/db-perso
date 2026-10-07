import type { Dataset, Item } from '../dataset';
import { MAIN_STATS, SCROLL_MAX } from '../rules';
import { STATS } from '../stats';
import { SLOT_KEYS, SLOT_KIND, SLOT_LABELS, type Build, type Roll, type SlotKey } from './types';

export type BuildIssueCode = 'missingItem' | 'wrongSlot' | 'rollMismatch' | 'level' | 'scrolls' | 'caracs';

export interface BuildIssue {
  code: BuildIssueCode;
  slot?: SlotKey;
  message: string;
}

/** Un jet ne vaut que si sa ligne existe encore et porte la même stat. */
export function rollMatches(roll: Roll, item: Item): boolean {
  return item.lines[roll.line]?.stat === roll.stat;
}

export function rollMismatchMessage(slot: SlotKey, item: Item, roll: Roll): string {
  return `${SLOT_LABELS[slot]} (${item.name}) : le jet ${STATS[roll.stat].label} de la ligne ${roll.line + 1} ne correspond plus à l'objet, remis au jet parfait.`;
}

export function validateBuild(build: Build, dataset: Pick<Dataset, 'itemById'>): BuildIssue[] {
  const issues: BuildIssue[] = [];
  const { level } = build.character;
  if (!Number.isInteger(level) || level < 1 || level > 200) {
    issues.push({ code: 'level', message: `Niveau ${level} hors de 1–200.` });
  }
  for (const stat of MAIN_STATS) {
    const scroll = build.caracs.scrolls[stat];
    if (scroll < 0 || scroll > SCROLL_MAX) {
      issues.push({ code: 'scrolls', message: `Parchemins ${STATS[stat].label} : ${scroll} hors de 0–${SCROLL_MAX}.` });
    }
    if (build.caracs.base[stat] < 0) {
      issues.push({ code: 'caracs', message: `${STATS[stat].label} de base négative.` });
    }
  }
  for (const slot of SLOT_KEYS) {
    const entry = build.slots[slot];
    if (!entry) continue;
    const item = dataset.itemById.get(entry.itemId);
    if (!item) {
      issues.push({ code: 'missingItem', slot, message: `${SLOT_LABELS[slot]} : ${entry.itemName} (${entry.itemId}) absent des données.` });
      continue;
    }
    if (item.slot !== SLOT_KIND[slot]) {
      issues.push({ code: 'wrongSlot', slot, message: `${SLOT_LABELS[slot]} : ${item.name} ne se porte pas à cet emplacement.` });
    }
    for (const roll of entry.rolls) {
      if (!rollMatches(roll, item)) issues.push({ code: 'rollMismatch', slot, message: rollMismatchMessage(slot, item, roll) });
    }
  }
  return issues;
}

/**
 * À l'ouverture sous une autre version de données : retire les jets dont la ligne a changé
 * (ils repassent au jet parfait), rafraîchit les noms et note la nouvelle `dataVersion`.
 */
export function revalidateBuild(build: Build, dataset: Pick<Dataset, 'itemById' | 'meta'>): { build: Build; issues: BuildIssue[] } {
  const issues = validateBuild(build, dataset);
  const slots = { ...build.slots };
  for (const slot of SLOT_KEYS) {
    const entry = slots[slot];
    const item = entry && dataset.itemById.get(entry.itemId);
    if (!entry || !item) continue;
    slots[slot] = { ...entry, itemName: item.name, rolls: entry.rolls.filter((roll) => rollMatches(roll, item)) };
  }
  return { build: { ...build, slots, dataVersion: dataset.meta.gameVersion }, issues };
}
