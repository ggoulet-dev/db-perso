import type { SlotKind } from '../../domain/stats';

// Silhouettes des emplacements vides, tracées sur une grille 32×32 au trait, à la place d'un « + » anonyme.
const PATHS: Record<SlotKind, string> = {
  hat: 'M5 24.5 Q16 30 27 24.5 M9.5 24 C10.5 17.5 13.5 11.5 17.5 4.5 C19 11 22 17.5 23.5 24 M10.5 21 Q17 23.5 23 21',
  cloak: 'M10.5 7 C12.5 10 19.5 10 21.5 7 L27.5 27.5 Q16 24.5 4.5 27.5 Z M10.5 7 Q16 3.5 21.5 7 M16 10 L16.5 10.5',
  amulet: 'M7 5 C7 15 11.5 20 16 20 C20.5 20 25 15 25 5 M16 20 L19.5 24 L16 28.5 L12.5 24 Z',
  ring: 'M24.5 20 A8.5 8.5 0 1 1 7.5 20 A8.5 8.5 0 1 1 24.5 20 M16 4 L20.5 8 L16 12 L11.5 8 Z',
  belt: 'M4 12 H28 V20 H4 Z M12 9 H20 V23 H12 Z M16 12 V20 M8 16 H8.5 M23.5 16 H24',
  boots: 'M10 4 H20 V16 L26 21 Q29 23.5 28 27.5 H10 Z M10 23.5 H27.5 M13 8 H17',
  weapon: 'M16 3 L19 8 V19 H13 V8 Z M9 19 H23 M16 19 V27 M13.5 27.5 H18.5 M16 8 V17',
  shield: 'M16 4 C20 7 24 8 28 8 V15 C28 22 23 27 16 29 C9 27 4 22 4 15 V8 C8 8 12 7 16 4 Z M16 9 V24',
  pet: 'M22 21.5 A6 5 0 1 1 10 21.5 A6 5 0 1 1 22 21.5 M9.9 13.5 A2.3 2.3 0 1 1 5.3 13.5 A2.3 2.3 0 1 1 9.9 13.5 M15 8 A2.3 2.3 0 1 1 10.4 8 A2.3 2.3 0 1 1 15 8 M21.6 8 A2.3 2.3 0 1 1 17 8 A2.3 2.3 0 1 1 21.6 8 M26.7 13.5 A2.3 2.3 0 1 1 22.1 13.5 A2.3 2.3 0 1 1 26.7 13.5',
  mount: 'M8 27.5 V14 A8 8 0 0 1 24 14 V27.5 M5 27.5 H11 M21 27.5 H27 M12 11 H12.5 M20 11 H20.5 M9 18 H9.5 M23 18 H23.5',
  dofus: 'M16 3 C22 3 26 11 26 18 C26 25 21.5 29 16 29 C10.5 29 6 25 6 18 C6 11 10 3 16 3 Z M11.5 10.5 C10.5 12.5 10 14.5 10 17',
};

export function SlotGlyph({ kind, size = 30 }: { kind: SlotKind; size?: number }) {
  return (
    <svg
      className="slot-glyph"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
