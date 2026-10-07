/** Ids DofusBook tirés d'une saisie libre : « 23428650, 23428299 » ou des slugs « 23428650-mon-stuff ». */
export function parseStuffIds(text: string): number[] {
  const ids = [...text.matchAll(/(?:^|[^\d])(\d{3,})(?=$|[^\d])/g)].map((m) => Number(m[1]));
  return [...new Set(ids)];
}

/**
 * Script à coller dans la console de Chrome sur dofusbook.net, connecté : une requête toutes les 2 s,
 * puis `copy()` (utilitaire de la console DevTools) met le tableau JSON dans le presse-papiers.
 * La route `private` n'est pas authentifiée par les cookies (401) mais par `Authorization: Bearer <JWT>`,
 * le JWT que la SPA garde dans `localStorage.token` (DOFUS.md §10.3).
 */
export function dofusbookExportScript(ids: readonly number[], visibility: 'private' | 'public'): string {
  return `// DofusBook perso : export de mes stuffs (usage personnel, une requête toutes les 2 s).
(async () => {
  const ids = ${JSON.stringify(ids.length ? ids : [0])};
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('Non connecté : aucun token DofusBook dans localStorage. Se connecter sur dofusbook.net puis relancer.');
    return;
  }
  const headers = { Accept: 'application/json', Authorization: 'Bearer ' + token, 'x-lang': 'fr' };
  const out = [];
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
    const res = await fetch('/api/stuffs/dofus/${visibility}/' + id, { headers });
    if (res.status === 401) {
      console.error('Stuff ' + id + ' : HTTP 401, token expiré ou invalide. Recharger dofusbook.net (ou se reconnecter) puis relancer.');
      break;
    }
    if (!res.ok) {
      console.warn('Stuff ' + id + ' : HTTP ' + res.status);
      continue;
    }
    out.push(await res.json());
    console.log('Stuff ' + id + ' récupéré (' + (i + 1) + '/' + ids.length + ')');
  }
  if (out.length === 0) {
    console.error('Aucun stuff récupéré : rien n\\'a été copié.');
    return;
  }
  window.dofusbookExport = out;
  copy(JSON.stringify(out));
  console.log(out.length + ' stuff(s) copié(s) dans le presse-papiers (aussi dans window.dofusbookExport).');
})();
`;
}
