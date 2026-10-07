export const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

// Dernière recherche de la liste, pour que « ← Objets » depuis une fiche retrouve les filtres.
let lastListSearch = '';

export function rememberListSearch(search: string): void {
  lastListSearch = search;
}

export function listPath(): string {
  return lastListSearch ? `/objets?${lastListSearch}` : '/objets';
}
