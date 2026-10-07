/** Ids DofusBook tirés d'une saisie libre : « 23428650, 23428299 » ou des slugs « 23428650-mon-stuff ». */
export function parseStuffIds(text: string): number[] {
  const ids = [...text.matchAll(/(?:^|[^\d])(\d{3,})(?=$|[^\d])/g)].map((m) => Number(m[1]));
  return [...new Set(ids)];
}

/**
 * Script à coller dans la console de Chrome sur dofusbook.net, connecté : une requête toutes les 2 s,
 * puis `copy()` (utilitaire de la console DevTools) met le tableau JSON dans le presse-papiers.
 */
export function dofusbookExportScript(ids: readonly number[], visibility: 'private' | 'public'): string {
  return `// DofusBook perso : export de mes stuffs (usage personnel, une requête toutes les 2 s).
(async () => {
  const ids = ${JSON.stringify(ids.length ? ids : [0])};
  const out = [];
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    const res = await fetch('/api/stuffs/dofus/${visibility}/' + id, { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn('Stuff ' + id + ' : HTTP ' + res.status);
      continue;
    }
    out.push(await res.json());
    console.log('Stuff ' + id + ' récupéré (' + (i + 1) + '/' + ids.length + ')');
  }
  window.dofusbookExport = out;
  copy(JSON.stringify(out));
  console.log(out.length + ' stuff(s) copié(s) dans le presse-papiers (aussi dans window.dofusbookExport).');
})();
`;
}
