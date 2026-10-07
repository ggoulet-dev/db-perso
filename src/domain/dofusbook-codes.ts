import type { HitElement, HitKind, StatKey } from './stats';

/** `confirmé` : vu sur une fiche rendue ou retrouvé dans les totaux des stuffs de référence ; `déduit` : cohérent mais jamais vérifié. */
export type CodeStatus = 'confirmé' | 'déduit';

/** Codes d'effets DofusBook (`bootstrap.effects`, DOFUS.md §10.4). Le type DofusBook est E (stat), D/U (coup d'arme), O (texte). */
export type DofusbookCode =
  | { kind: 'stat'; stat: StatKey; status: CodeStatus }
  | { kind: 'hit'; hit: HitKind; element: HitElement | null; status: CodeStatus }
  | { kind: 'text'; tag: 'spell' | 'attitude'; status: CodeStatus };

const stat = (s: StatKey, status: CodeStatus = 'confirmé'): DofusbookCode => ({ kind: 'stat', stat: s, status });
const hit = (h: HitKind, element: HitElement | null): DofusbookCode => ({ kind: 'hit', hit: h, element, status: 'déduit' });

export const DOFUSBOOK_CODES: Record<string, DofusbookCode> = {
  // Caracs
  vi: stat('vitality'),
  fo: stat('strength'),
  in: stat('intelligence'),
  ch: stat('chance'),
  ag: stat('agility'),
  sa: stat('wisdom'),
  pu: stat('power'),
  // Combat
  pa: stat('ap'),
  pm: stat('mp'),
  po: stat('range'),
  ic: stat('summons'),
  cc: stat('critical'),
  so: stat('heals'),
  ii: stat('initiative'),
  pp: stat('prospecting'),
  pd: stat('pods', 'déduit'),
  // Mobilité
  ta: stat('lock'),
  fu: stat('dodge'),
  rpa: stat('apReduction'),
  rpm: stat('mpReduction'),
  epa: stat('apParry'),
  epm: stat('mpParry'),
  // Dommages
  dmg: stat('damage'),
  dnf: stat('dmgNeutral'),
  dtf: stat('dmgEarth'),
  dff: stat('dmgFire'),
  def: stat('dmgWater'),
  daf: stat('dmgAir'),
  dc: stat('dmgCritical'),
  dp: stat('dmgPushback'),
  pi: stat('dmgTraps', 'déduit'),
  pip: stat('powerTraps', 'déduit'),
  ds: stat('dmgPctSpells'),
  dw: stat('dmgPctWeapon'),
  dm: stat('dmgPctMelee'),
  dd: stat('dmgPctRanged', 'déduit'),
  // Résistances
  rnp: stat('resPctNeutral'),
  rtp: stat('resPctEarth'),
  rfp: stat('resPctFire'),
  rep: stat('resPctWater'),
  rap: stat('resPctAir'),
  rn: stat('resFixedNeutral', 'déduit'),
  rt: stat('resFixedEarth'),
  rf: stat('resFixedFire'),
  re: stat('resFixedWater', 'déduit'),
  ra: stat('resFixedAir'),
  rc: stat('resCritical'),
  rp: stat('resPushback'),
  rd: stat('resPctRanged'),
  rm: stat('resPctMelee', 'déduit'),
  rw: stat('resPctWeapon', 'déduit'),
  rs: stat('resPctSpells', 'déduit'),
  // Coups d'arme
  dn: hit('damage', 'neutral'),
  dt: hit('damage', 'earth'),
  df: hit('damage', 'fire'),
  de: hit('damage', 'water'),
  da: hit('damage', 'air'),
  vn: hit('steal', 'neutral'),
  vt: hit('steal', 'earth'),
  vf: hit('steal', 'fire'),
  ve: hit('steal', 'water'),
  va: hit('steal', 'air'),
  pac: hit('apLoss', null),
  // Affichage seul (valeur = id de sort / d'attitude)
  sp: { kind: 'text', tag: 'spell', status: 'confirmé' },
  at: { kind: 'text', tag: 'attitude', status: 'déduit' },
};

export function dofusbookCode(code: string): DofusbookCode | undefined {
  return Object.hasOwn(DOFUSBOOK_CODES, code) ? DOFUSBOOK_CODES[code] : undefined;
}

export function dofusbookStat(code: string): StatKey | undefined {
  const entry = dofusbookCode(code);
  return entry?.kind === 'stat' ? entry.stat : undefined;
}
