# Plan de réalisation — DofusBook perso

Rédigé le 2026-10-06 à partir de `DOFUS.md`, `scripts/sync.mjs` et d'un examen direct de `data/equipment.json` / `data/sets.json` (dump dofusdude `dofus3beta` 3.7.3.3). Tout chiffre ci-dessous marqué « constaté » a été vérifié ce jour sur ces données ou sur les API ; le reste est signalé « non vérifié ».

## État au 2026-10-06 : phases 0 à 3 implémentées et vérifiées

- Lancer : `fnm use 22 && npm run dev`. Données : `npm run data` (objets) et `npm run sync-dofusdb` (classes et sorts).
- **Phases 0 à 3 livrées** : 102 tests verts et build OK. Chaque phase a été vérifiée de trois façons (critères, vrai navigateur, revue adverse), puis une vérification transversale de bout en bout a été faite.
- **Vérité terrain** dans `test/fixtures/dofusbook/` :
  - 2 vrais stuffs : tous leurs totaux sont retrouvés exactement ;
  - dégâts d'arme : 20 bornes exactes ;
  - 13 sorts Crâ : exacts.
- **Décisions prises en cours de route**, qui remplacent le texte ci-dessous là où il diffère :
  - §2.2 : stockage en fichiers via plugin Vite. C'était le défaut ; l'utilisateur n'a pas tranché.
  - Classe de référence : Crâ.
  - §2.8 : **une seule formule de dégâts**, celle de DofusBook, reconstituée et vérifiée (`DOFUS.md` §10.5). Les implémentations dafous et guidedofus ne sont pas écrites.
  - « Fixture de combat réel » : remplacée par les références relevées sur DofusBook.
  - §1 : `critical_hit_probability` est un pourcentage, confirmé sur deux armes (Arc 20, Pelle 5).
  - Données :
    - objets : canal `dofus3beta` 3.7.3.3, parce que le canal `dofus3` n'a pas d'effets ;
    - classes, noms de sorts et variantes : DofusDB ;
    - valeurs des sorts : release `dofus3-main` 3.7.1.0, car DofusDB avait une version de retard sur le Crâ.
- **Écarts connus, non bloquants** :
  - Forme `private` de l'API DofusBook : non observée. L'import est testé sur des réponses publiques reconstruites.
  - Calcul des dégâts, options laissées « non vérifié » : % mêlée/distance, maîtrise critique, origine du malus 10 %, ordre d'application des résistances, « par tour » avec plusieurs lancers.
  - Affichage des sorts :
    - états affichés « État N » ;
    - invocations affichées par id de monstre ;
    - modificateur de sort d'id 0 affiché « 0 : ».
  - Code :
    - lignes de stats dupliquées entre `ResultsPanel` et `compare.ts` (identiques aujourd'hui, aucun test ne les tient alignées) ;
    - contrôle `meta/elements` seulement dans `build-data` (réseau), pas dans `npm test`.

## 0. Cadre

- App **locale, mono-utilisateur**, lancée par `npm run dev`. Pas de compte, pas de stuffs publics, pas de communauté, pas de rendu du personnage.
- Reproduit l'essentiel de dofusbook.net : encyclopédie (objets, armes, panoplies), éditeur de stuff (jets, exos/overs, caracs, parchemins), totaux et bonus de panoplie, conditions d'équipement, comparaison, import de ses propres stuffs exportés à la main, puis sorts et dégâts.
- Données de jeu : dofusdude (déjà en place), DofusDB en complément pour classes et sorts. **Aucun scraping de DofusBook** : l'import ne lit que des fichiers JSON que l'utilisateur a sauvegardés lui-même depuis son navigateur.

## 1. Ce que les données disent vraiment (constaté le 2026-10-06)

Ces constats conditionnent plusieurs choix d'architecture plus bas.

- **4 101 équipements**, 37 types dofusdude. Parmi eux, des types hors stuff joueur à exclure de l'éditeur : Compagnon (52), 7 types « Percepteur » (211), Outil (31), Arme magique (6), type 212 sans nom (5). Les montures (Dragodinde 68, Muldo 120, Volkorne 120) sont dans `equipment` avec des effets, donc exploitables pour l'emplacement `mo`.
- **102 types d'effets distincts**. Le champ `type.id` est l'**index dans le tableau `GET /meta/elements`** de dofusdude (0 = « Exchangeable: », 9 = Vitality, 10 = Wisdom, 12 = AP, 13 = Intelligence, 45 = Strength…). C'est l'espace d'identifiants propre à dofusdude, pas celui d'Ankama (DofusDB : effet 125 → caractéristique 11 pour la Vitalité). Les `condition.element.id` utilisent le **même** index (45 Force, 12 PA, 72 Bonus de panoplies).
- Trois familles de lignes d'effets :
  - **calculables** : `is_meta=false`, `is_active=false`, pas `ignore_int_min && ignore_int_max`, nom ne commençant pas par `:`. `ignore_int_max=true` signifie valeur fixe = `int_minimum` (« 1 PA »). Les malus existent en intervalle (« -40 à -11 Force », min = -40, max = -11) et en valeur fixe (« -300 Initiative »).
  - **lignes d'arme** (`is_active=true`, ids 179–277 : « dommages Neutre », « vol Eau », « soins Feu », « -1 PA »…) : ce sont les coups de l'arme, pas des bonus de stats.
  - **affichage seul** : `-special spell-` (id 163, 587 occurrences : passifs des Dofus/trophées, texte avec gabarit `{{spell,8395,1::Pourpre Profond}}`), modificateurs de sorts (ids 204–279, 95 objets : `int_minimum` est un **id de sort**, la valeur numérique n'existe que dans `formatted`), Titre, Attitude, Échangeable, Lié, Fertile.
- **425 objets ont deux lignes numériques du même type** (deux lignes « dommages Neutre » sur une arme, deux modificateurs de sorts). Un jet ne peut donc pas être identifié par sa stat seule.
- **Armes** : 769, champs `ap_cost`, `range {min,max}`, `critical_hit_probability`, `critical_hit_bonus`, `max_cast_per_turn`. La sémantique de `critical_hit_probability` est **incohérente en apparence** : 30 sur l'Épée de Boisaille (niv. 7, 438 armes ont « 30 ») contre 5 sur l'Épée Maudite du Saigneur Guerrier (niv. 200). Probablement un héritage « 1/30 » contre un « 5 % », à trancher avec `weapon.cc_rate` de DofusBook sur un stuff importé. Valeurs aberrantes d'`ap_cost` (42, 20, 0) uniquement sur les types hors joueur.
- **Conditions** : 264 objets, arbre and/or de profondeur ≤ 3, 40 nœuds `or`, opérateurs `<`, `>`, `=`. Éléments : Force/Intel/Agi/Chance/Vita/Sagesse, PA, PM, « Bonus de panoplies » (73 occurrences, trophées : `< 2`), « Être abonné » (8), « Niveau d'alignement » (2), « Kamas » (1), « Être niveau {0} ou plus » (1).
- **Panoplies** : 937, dont **416 purement cosmétiques** (`contains_cosmetics_only`, `effects` vide). 1 812 des 3 637 `equipment_ids` ne sont pas dans `equipment.json` : ce sont les cosmétiques, pas une perte de données. `parent_set` est cohérent (0 incohérence). Bonus par nombre de pièces `effects["2"]…["8"]`, `"1"` vaut `null`.
- **23 objets sans effets** (objets de niveau 1 : capes d'alignement, chapeaux de mariage…). C'est le 0,56 % manquant de `meta.json`, pas une régression.
- **Images** : `image_urls.icon` suit le motif `…/img/item/{iconId}-64.png` sur les 4 101 objets, mais l'URL embarque le canal (`dofus3beta`).
- **dofusdude canal `dofus3`** (3.7.1.0, réactualisé aujourd'hui 16 h 29) renvoie **toujours** les objets sans `effects` ni `conditions`. `dofus3beta` reste la seule source utilisable.
- **DofusDB** : `breeds` (19, ids 1–18 et 20 : identiques aux ids de classe DofusBook) expose `statsPointsForStrength` etc. au format `[[0,1],[100,2],[200,3],[300,4]]`, Vitalité `[[0,1]]`, Sagesse `[[0,3]]` : exactement les paliers constatés chez DofusBook. `breedSpellsId` liste 22 ids de sorts par classe. `spell-levels` donne `apCost`, `minRange`, `range`, `criticalHitProbability`, `maxCastPerTurn`, `castInLine`, `castTestLos`, et `effects[]`/`criticalEffect[]` avec `effectId` (Ankama), `effectElement`, `diceNum`/`diceSide` (= min/max). Le référentiel `effects/{id}` donne `characteristic`, `elementId`, `isInPercent`, `oppositeId`, `description` (gabarit `#1{{~1~2 à }}#2 Vitalité`).
- Node : fnm a 18.20.8 (actif), 20.20.0, 22.22.0, 24.x. Vite récent exige Node ≥ 20.19 ou ≥ 22.12 : un `.node-version` à `22` règle la question.

## 2. Décisions d'architecture

Chaque décision : le choix, pourquoi, et ce qui la ferait basculer.

### 2.1 Stack

**TypeScript + React + Vite + Vitest, un seul package, pas de backend ni de base de données.** C'est la pile de ses autres projets ; un outil perso ne justifie rien de plus. `react-router` pour les pages, état React simple (un contexte pour le dataset, un hook par stuff ouvert). CSS au choix de l'utilisateur (ce qu'il emploie ailleurs). Tests Vitest **sur le domaine uniquement** (`src/domain`), pas de tests d'UI.

Bascule : aucune prévue. Si un jour il veut l'ouvrir depuis un autre appareil, c'est le stockage (2.2) qui change, pas la stack.

### 2.2 Stockage des stuffs : fichiers JSON sur disque, écrits par le serveur de dev

**Un fichier par stuff dans `stuffs/*.json`, lu et écrit via un plugin Vite** (`configureServer` + `configurePreviewServer`) qui expose `GET/PUT/DELETE /api/stuffs/:id` et `GET /api/stuffs`. Une soixantaine de lignes, aucune dépendance, écriture atomique (tmp + rename).

Pourquoi : les stuffs sont la seule donnée qui a de la valeur (tout le reste se régénère). En fichiers, ils sont lisibles, versionnés par git, sauvegardables, modifiables à la main, et l'import DofusBook écrit simplement un fichier de plus. `localStorage`/IndexedDB se vident avec les données du site et ne se diffent pas.

Coût : l'app ne fonctionne qu'avec `npm run dev` (ou `vite preview`), pas en `index.html` statique. Pour un outil perso lancé depuis le terminal, c'est acceptable. `localStorage` reste réservé aux préférences d'UI (filtres, dernier stuff ouvert).

Bascule : s'il veut l'ouvrir sans serveur (fichier statique, téléphone), on remplace l'implémentation de l'interface `StuffRepository` par IndexedDB + export/import JSON. Se tromper coûte peu dans les deux sens : la migration est un export/import.

### 2.3 Pipeline de données et versions

**`scripts/sync.mjs` reste tel quel** (son garde-fou à 95 % est le bon). On ajoute **`scripts/build-data.mjs`** qui normalise `data/*.json` (bruts, 10 Mo) en un dataset compact dans `public/data/` (objets, panoplies, classes ; estimé 2–3 Mo), chargé par `fetch` au démarrage et mis en cache par le navigateur. `npm run data` enchaîne les deux.

`build-data` est le seul endroit qui connaît le format dofusdude. Il :
- convertit chaque effet en `Line` interne via la **table `type.id` → `StatKey`** (2.4) et **échoue bruyamment** si un `type.id` rencontré sur un type d'objet joueur n'est pas dans la table, ou si `GET /meta/elements[id]` ne porte plus le nom attendu (l'index peut glisser entre versions de dofusdude) ;
- classe les lignes en calculables / coups d'arme / texte (règles de §1) ;
- dérive l'emplacement (`slotKind`) depuis `type.id` par liste blanche, et marque « hors joueur » le reste ;
- extrait `iconId` de l'URL d'image (2.7) ;
- ignore les `equipment_ids` de panoplies absents du dump (cosmétiques) ;
- écrit `public/data/meta.json` avec `game_version`, `channel`, `synced_at`, `schema` et le nombre d'objets exclus.

Versions : le dataset normalisé est **versionné dans git** (c'est la seule façon de garder les anciennes valeurs : dofusdude ne sert que la version courante, les releases GitHub `dofus3-main` servent de secours). `data/` brut est gitignoré sauf `meta.json`. Chaque stuff enregistre la `dataVersion` avec laquelle il a été validé en dernier ; à l'ouverture sous une version plus récente, l'app revalide (2.5) et affiche ce qui a changé.

Le dépôt n'est pas encore un dépôt git : `git init` fait partie de la phase 0.

Bascule : si le canal `dofus3` redevient sain, `npm run sync` suffit ; le plan ne dépend pas du canal. Si dofusdude disparaît, `build-data` prend en entrée `MAPPED_ITEMS.json` des releases GitHub (même informations, format différent) : un adaptateur de plus, le reste de l'app ne bouge pas.

### 2.4 Modèle de stats : un `StatKey` interne comme pivot

**Une énumération interne d'environ 60 clés** (`vitality`, `wisdom`, `strength`, `ap`, `mp`, `range`, `resPctEarth`, `resFixedFire`, `dmgPctSpells`, `pods`…) et **trois tables d'adaptation** : dofusdude `type.id` → `StatKey` (objets, panoplies, conditions), Ankama `characteristic`/`effectId` via DofusDB → `StatKey` (sorts, phase 3), codes DofusBook (`vi`, `fo`, `rtp`…) → `StatKey` (import, phase 2) en portant le statut **confirmé / déduit** de `DOFUS.md` §10.4.

Pourquoi : aucune source n'a d'identifiants stables et communs. Un pivot interne isole le moteur des trois formats et permet à chaque table d'être testée seule contre des fixtures.

Les éléments de dégâts (`neutral | earth | fire | water | air`) et les natures de coups d'arme (`damage | steal | heal | apLoss | mpLoss | mpSteal | push | pull…`) sont des énumérations à part, dérivées des types `is_active`.

### 2.5 Modèle d'un stuff

```ts
type Build = {
  schemaVersion: 1;
  id: string;                        // slug, = nom de fichier
  name: string;
  dataVersion: string;               // version de jeu validée en dernier (ex. "3.7.3.3")
  character: { breedId: number | null; level: number; subscriber: boolean };
  caracs: {
    base: Record<MainStat, number>;    // valeur de carac visée (pas les points), coût calculé via la table de classe
    scrolls: Record<MainStat, number>; // 0..100
  };
  slots: Record<SlotKey, SlotEntry | null>; // ch ca am a1 a2 ce bo ar br fa mo d1 d2 d3 d4 d5 d6
  extras: Array<{ label: string; stat: StatKey; value: number }>; // bonus hors objet : exo global importé, bonbon, bonus de guilde…
  notes?: string;
  source?: { kind: 'dofusbook'; stuffId: number; importedAt: string; unmapped: string[] };
  createdAt: string; updatedAt: string;
};

type SlotEntry = {
  itemId: number;                    // ankama_id
  itemName: string;                  // instantané pour l'affichage si l'objet disparaît du dataset
  rolls: Array<{ line: number; stat: StatKey; value: number }>; // ligne = index dans item.lines ; absent = max
  exos: Array<{ stat: StatKey; value: number }>;                // lignes absentes de l'objet
};
```

Choix qui comptent :
- **Les jets sont indexés par ligne**, en portant la `stat` pour vérification, parce que 425 objets ont des lignes de même type (§1). Lors d'un changement de `dataVersion`, si `item.lines[line].stat !== roll.stat`, le jet est remis au max et signalé.
- **Jet par défaut = max (jet parfait)**, comme DofusBook ; raccourcis « tout au max / tout au min ». **Over** = `value > max`, affiché comme tel sans plafond dur (la densité d'over ≈ 101 n'est pas vérifiée). **Exo** = stat absente de l'objet.
- Les caracs stockent la **valeur visée**, pas les points, parce que c'est ce que l'utilisateur raisonne ; le coût en points se calcule et se compare à `5 × (niveau − 1)` (995 au niveau 200, constaté).
- `extras` évite d'inventer un objet porteur pour `stuffFm` global de DofusBook et couvre les boosts.
- Migrations de schéma dans `src/domain/build/migrate.ts`, appliquées au chargement.

### 2.6 Moteur de calcul

Fonction pure `computeBuild(build, dataset): BuildResult` en six étapes, chacune testée :

1. **Base de classe/niveau** : constantes (PA, PM, PV de base et par niveau, prospection, pods, invocations, initiative). **Non vérifiées pour Dofus 3** : elles vivent dans `src/domain/rules.ts`, chacune avec `{ value, verified: false, source }`, et l'UI affiche un panneau « Règles non vérifiées » qui les liste. Elles se vérifient en comparant un stuff importé à `stuffStats` de DofusBook (phase 2).
2. **Caracs** : valeur visée → points via la table `statsPointsFor*` de la classe (DofusDB, 2.3), + parchemins. Alerte si le total dépasse les points disponibles. **Non vérifié** : le palier de coût se lit-il sur la valeur de base seule ou sur base + parchemins ? Le 398 de `DOFUS.md` suppose zéro parchemin ; la réponse change tous les coûts d'un personnage parcheminé. Entrée de `rules.ts` avec `verified: false`, tranchée en phase 2 en comparant les points que DofusBook affiche sur un stuff parcheminé importé.
3. **Objets** : somme des `lines` avec jets, plus exos, plus `extras`.
4. **Panoplies** : pièces distinctes par panoplie (par `itemId`) parmi les objets équipés → `set.effects[count]`. Deux anneaux identiques comptent une fois ; l'interdiction de porter deux fois le même anneau de panoplie est **non vérifiée** : avertissement, pas blocage. Idem pour deux Dofus/trophées identiques. Hors périmètre de la phase 1 : l'exclusivité arme à deux mains / bouclier (le champ n'est pas dans ce que `sync.mjs` récupère ; DofusBook a `one_hand`, DofusDB `twoHanded` ; la règle elle-même est non vérifiée en Dofus 3).
5. **Dérivés** : PV, initiative, prospection, pods, tacle/fuite, esquive/retrait depuis les caracs — formules **non vérifiées**, dans `rules.ts`, marquées dans l'UI.
6. **Plafonds et conditions** :
   - résistances % : afficher brut et plafonné à 50 % (règle de source non officielle) ; PA 12 / PM 6 / PO 9 et « un seul exo PA/PM/PO compte » : sources de 2011, **avertissements** seulement ;
   - conditions : évaluateur de l'arbre and/or sur les **totaux finaux du stuff, objet compris** (convention des outils de build ; le jeu vérifie à l'équipement, ce qui dépend de l'ordre — non reproductible, signalé comme convention). `>` et `<` sont stricts sur entiers (`Force > 249` ⇔ ≥ 250). « Bonus de panoplies » = nombre de panoplies avec ≥ 2 pièces (**interprétation à vérifier**). « Être abonné » lit `character.subscriber`. Alignement, kamas, niveau : rendus « non évalué », jamais faux.

Le résultat porte pour chaque stat : total, décomposition (base, caracs, parchemins, par emplacement, par panoplie, extras) et la liste des avertissements. La comparaison de deux stuffs (phase 2) n'est qu'une différence de deux `BuildResult`.

### 2.7 Images

**Stocker `iconId`, construire l'URL au rendu** : `https://api.dofusdu.de/dofus3/v1/img/item/{iconId}-64.png` (`-128` pour la fiche), une seule constante. Les URL du dump sont liées au canal `dofus3beta` et changeraient à chaque bascule de canal. Dépendance en ligne assumée (décision prise) ; une image de remplacement si 404. Si un jour il veut du hors-ligne : mise en cache disque par le même plugin Vite, sans toucher à l'app.

### 2.8 Formule de dégâts : branchable, pas tranchée dans le plan

Les deux sources de `DOFUS.md` §4 se contredisent sur la place des % dommages (sorts/armes/mêlée/distance) et sur l'ordre résistances fixes / résistances %. **Le plan ne choisit pas** : `src/domain/damage.ts` expose une signature unique `damage(hit, attackerStats, targetResists, flags): { min, max, critMin, critMax }` et **deux implémentations nommées** (`dafous`, `guidedofus`). Par défaut `dafous` (annoncée « officielle Unity »), étiquetée **« non vérifié »** dans l'UI, avec un sélecteur. La vérification se fait avant ou pendant la phase 3 : lire les tutoriels dommages/résistances de dofus.com dans un navigateur, puis une capture de combat réelle transformée en fixture Vitest. Dès que la fixture tranche, l'autre implémentation est supprimée.

### 2.9 Structure du code

```
.node-version                 # 22
package.json                  # dev, build, test, sync, sync:beta, build-data, data (= sync + build-data)
scripts/sync.mjs              # existant, inchangé
scripts/build-data.mjs        # normalisation dofusdude → public/data/ (phase 0)
scripts/sync-dofusdb.mjs      # classes (phase 1), sorts + niveaux + référentiel effects (phase 3)
data/                         # dumps bruts (gitignoré sauf meta.json)
public/data/                  # dataset normalisé, versionné : items.json, sets.json, breeds.json, meta.json, (spells.json)
stuffs/                       # un JSON par stuff, versionné
src/domain/                   # TS pur, sans React, couvert par Vitest
  stats.ts                    # StatKey, Element, tables d'adaptation dofusdude / Ankama / DofusBook
  dataset.ts                  # types Item, Line, Hit, Set, Breed ; index par id et par slot ; recherche
  rules.ts                    # constantes et formules avec statut verified/non vérifié
  build/{types,migrate,validate}.ts
  engine.ts                   # computeBuild
  conditions.ts               # évaluateur de l'arbre
  import/dofusbook.ts         # phase 2
  damage.ts                   # phase 3
  spells.ts                   # phase 3
src/data/                     # chargement de public/data, contexte React, repository des stuffs (fetch /api/stuffs)
src/app/                      # pages : encyclopédie, objet, panoplie, mes stuffs, éditeur, comparaison, import, sorts ; composants
src/server/stuffs-plugin.ts   # plugin Vite : CRUD sur stuffs/*.json
test/fixtures/                # objets, panoplies et stuffs de référence (JSON extraits du dataset)
```

Règle : rien dans `src/domain` n'importe React ni ne lit le disque. L'UI est fine ; la valeur est dans le domaine et ses tests.

## 3. Phases

Quatre phases livrables, chacune utilisable seule. Les critères de « fini » sont vérifiables à la main ou par un test.

### Phase 0 — « Voir les items » (encyclopédie)

Contenu :
- `git init`, `.gitignore`, `.node-version`, scaffold Vite + React + TS + Vitest, `package.json` complété (les scripts `sync` existants restent).
- `scripts/build-data.mjs` et les tables `type.id → StatKey`, `type.id → slotKind`, classification des lignes. Tests : la table couvre tous les `type.id` rencontrés sur les types joueur ; `meta/elements[id]` correspond.
- Chargement du dataset, index, recherche plein texte simple (nom normalisé sans accents).
- Pages : liste des objets avec filtres (type/emplacement, niveau min–max, panoplie, texte) et tri ; fiche objet (lignes calculables en min–max, lignes texte avec gabarit `{{spell,…::Nom}}` rendu en nom de sort, stats d'arme, conditions rendues en arbre lisible, recette avec ids, image) ; fiche panoplie (pièces, bonus par nombre de pièces). Objets « hors joueur » masqués par défaut, affichables.

Fini quand :
- `npm run data` régénère `public/data/` depuis `data/` et échoue sur un type d'effet inconnu ;
- la fiche du Disque de Culbutœuf (32236) montre ses 10 lignes avec les mêmes valeurs que DofusBook, sa panoplie (1045) montre ses 3 pièces et ses bonus 2/3 pièces ;
- les Dagues du Dragoeuf (8414) affichent leur condition and/or imbriquée telle que le jeu la présente ;
- `npm test` est vert.

### Phase 1 — Éditeur de stuff et moteur

Contenu :
- `sync-dofusdb.mjs` : `breeds` (19) → `public/data/breeds.json` (ids, noms, tables de coût des caracs).
- Plugin Vite `/api/stuffs`, `StuffRepository`, page « Mes stuffs » (créer, dupliquer, renommer, supprimer).
- Éditeur : 17 emplacements, sélecteur d'objet filtré par emplacement et niveau, classe/niveau/abonné, caracs (valeur visée → points dépensés / disponibles) et parchemins, jets par ligne (défaut max, tout max / tout min), `extras`.
- `computeBuild` complet (2.6) : totaux, décomposition, bonus de panoplie actifs, avertissements (plafonds, doublons, points), conditions par objet (remplie / non remplie / non évaluée) ; panneau « Règles non vérifiées ».
- Sauvegarde automatique, revalidation à l'ouverture si `dataVersion` a changé.

Fini quand :
- fixtures Vitest : panoplie Culbutœuf complète (bonus 3 pièces appliqué), Obstructeur mineur (condition « Bonus de panoplies < 2 » vraie puis fausse), Dagues du Dragoeuf (and/or), un objet à malus (« -40 à -11 Force » : jet min/max dans le bon sens), un jet over, un exo ;
- un stuff saisi à la main dans l'app et le même stuff saisi sur DofusBook donnent les **mêmes totaux** pour les stats issues des objets, caracs, parchemins et panoplies (les écarts restants sur PV/initiative/pods isolent les constantes de `rules.ts` à corriger) ;
- fermer et rouvrir l'app conserve les stuffs ; le fichier `stuffs/<id>.json` est lisible.

### Phase 2 — Forgemagie fine, comparaison, import DofusBook

Contenu :
- Exos et overs par objet avec libellés explicites dans la décomposition ; lignes d'arme affichées dans l'éditeur (pas encore de dégâts).
- Comparaison de deux stuffs côte à côte avec deltas par stat (équivalent du stuffminator), y compris « ce stuff contre sa copie modifiée ».
- Import DofusBook (§4) : dépôt d'un fichier JSON, rapport d'import (objets résolus, lignes non mappées, hypothèses), création d'un stuff avec `source`.

Fini quand :
- un **vrai export** de l'utilisateur s'importe et donne les mêmes totaux que la page DofusBook correspondante pour les stats objets/panoplies/caracs ; les lignes non mappées sont listées, pas perdues ;
- `rules.ts` a été confronté à `stuffStats` de cet export et les constantes de base réglées ou laissées explicitement « non vérifiées » ;
- la sémantique de `critical_hit_probability` est tranchée par comparaison avec `weapon.cc_rate` sur une arme importée.

### Phase 3 — Sorts et dégâts

Contenu :
- `sync-dofusdb.mjs` étendu : pour chaque classe, `breedSpellsId` → `spells` (≈ 420 sorts, pas les 17 067) → `spell-levels` (grades) → référentiel `effects` (petit). Sortie `public/data/spells.json`.
- Page sorts par classe : PA, portée, critique, lancers par tour, lignes d'effets rendues depuis `effects.description` + `diceNum/diceSide`.
- Table Ankama `effectId` → `{ nature, élément }` construite depuis le référentiel (`elementId`, `characteristic`) et **vérifiée sur deux ou trois sorts connus** avant usage.
- `damage.ts` branchable (2.8) : dégâts par coup d'arme et par effet de dégâts/vol de sort, min/max/critique, par élément, avec résistances de cible saisies. Soins et autres effets hors périmètre.

Fini quand :
- la fixture de combat réel (capture) est verte avec l'implémentation retenue, l'autre est supprimée, l'étiquette « non vérifié » disparaît ;
- pour un sort de dégâts de sa classe, l'app affiche les mêmes dégâts que ceux observés en jeu sur une cible à résistances connues.

## 4. Import DofusBook : ce qui est connu et ce qui manque

Entrée attendue : la **réponse complète** de `GET /api/stuffs/dofus/{public|private}/{id}` (`stuff` + `items[]` + `cloths` + `fm*` + `stuffStats`). Elle peut être sauvegardée depuis l'onglet Réseau ou avec le script console de la conversation, en mettant `private` dans le chemin pour ses propres stuffs (connecté, les cookies partent automatiquement). Seule la forme **publique** a été observée ; la forme `private` est **non vérifiée**. Un objet `stuff` seul ne suffit pas : `stuffItem` ne contient que des ids DofusBook, et c'est `items[].official` (= `ankama_id`, vérifié sur 6744 → 32236) qui permet la résolution.

Correspondances :
- `stuffItem.{ch ca am a1 a2 ce bo ar br fa mo d1..d6}` → nos `SlotKey`, identiques ;
- `items[].official` → `itemId`. Si absent ou introuvable dans le dataset : repli par nom + niveau (6 noms seulement sont dupliqués dans le dump), sinon emplacement laissé vide avec le nom en commentaire dans le rapport ;
- `character_class` → `breedId` (ids identiques, constaté), `character_level` → `level` ;
- `stuffCarac.base_*` / `scroll_*` → `caracs` : **à trancher sur l'export** si `base_*` est la valeur de carac ou les points investis (`threshold.vi.max = 995` ne distingue pas les deux pour la Vitalité) ;
- `stuffFm` global (`{"pm":1,"po":1}`) → `extras` ;
- codes d'effets DofusBook → `StatKey` via la table de `DOFUS.md` §10.4 (10 codes confirmés, le reste déduit, une vingtaine inconnus) ; tout code inconnu va dans `source.unmapped` et dans le rapport ;
- `stuffFmItem` / `fmItems` (FM par objet) et les jets par ligne : **format non documenté dans le dépôt**. L'import ne les traite qu'après lecture d'un export réel ; en attendant, les jets sont au max et c'est dit dans le rapport.

## 5. Risques et points non vérifiés

| Risque | Effet | Parade prévue |
|---|---|---|
| Régression dofusdude `dofus3` (toujours sans effets aujourd'hui) | pas de données « release » | garde-fou de `sync.mjs` ; `dofus3beta` ; adaptateur releases GitHub si besoin |
| `type.id` dofusdude = index de `meta/elements`, susceptible de glisser | lignes mal typées silencieusement | `build-data` vérifie id → nom et échoue sinon |
| URL d'images liées au canal | images cassées à chaque bascule | stocker `iconId`, URL construite |
| `critical_hit_probability` incohérent (30 vs 5) | taux critique faux | tranché contre `weapon.cc_rate` en phase 2 |
| Constantes de base et formules dérivées non vérifiées (PA/PM/PV/initiative/prospection/pods, tacle/fuite/esquive) | totaux faux sur ces stats | `rules.ts` avec statut, panneau UI, calage sur `stuffStats` en phase 2 |
| Palier de coût des caracs lu sur la base seule ou sur base + parchemins | coût en points faux sur un personnage parcheminé | `rules.ts` non vérifié ; tranché sur les points affichés par DofusBook pour un stuff parcheminé importé |
| Plafonds 50 % rés., 12 PA / 6 PM / 9 PO, exo unique (sources 2011 / non officielles) | avertissements erronés | avertissements, jamais blocages |
| Base d'évaluation des conditions (totaux finaux, objet compris) et sens de « Bonus de panoplies » | condition mal jugée | signalé comme convention ; vérifiable en jeu sur un trophée |
| Deux anneaux / Dofus / trophées identiques, cumul mineur/normal/majeur | compte de panoplie ou doublon mal géré | avertissements ; règle marquée non vérifiée |
| Table codes DofusBook → `StatKey` majoritairement « déduite » | import faux sur une ligne | statut porté par la table, rapport d'import, comparaison des totaux avec DofusBook |
| Format de `stuffFmItem` / `fmItems` et des jets inconnu | import partiel | attendre un export réel ; jets au max par défaut, dit explicitement |
| Données en bêta (3.7.3.3) alors que DofusBook suit le live (3.7.x) | écart de valeurs pris à tort pour un bug dans les critères « mêmes valeurs que DofusBook » | comparaison concluante seulement si `meta.json` indique le canal `dofus3`, ou si l'objet comparé est vérifié identique entre les deux versions |
| Formule de dégâts contradictoire | dégâts faux | implémentation branchable, étiquette, fixture de combat réel |
| Mapping Ankama `effectId` → élément pour les sorts | sorts mal typés | vérifié sur sorts connus avant usage |
| Modificateurs de sorts (ids 204–279) non calculables (valeur seulement dans `formatted`) | bonus de sort ignorés dans les dégâts | affichés en texte ; hors périmètre du calcul, dit dans l'UI |

## 6. Hypothèses sur lesquelles tout repose

- L'export manuel de l'utilisateur est la réponse JSON complète de l'API DofusBook (avec `items[].official`), pas un extrait HTML ni le seul objet `stuff`. Si ce n'est pas le cas, l'import de la phase 2 doit être repensé autour de ce qu'il peut réellement sauvegarder.
- dofusdude (`dofus3beta` aujourd'hui) reste disponible et conserve la forme `effects[].type.{id,name}` / `conditions` ; les releases GitHub `dofus3-main` sont le plan B.
- Les paliers de coût des caracs de DofusDB `breeds.statsPointsFor*` sont ceux du jeu pour toutes les classes (le cas Sacrieur n'a pas été regardé ; il tombera de la donnée s'il y est encodé).
- Les ids de classe DofusBook et Ankama coïncident (constaté pour les 19).
- L'utilisateur accepte que l'app tourne derrière `npm run dev` et que les stuffs vivent en fichiers dans le dépôt.
- L'ordre des lignes d'effets d'un objet est stable d'une version de données à l'autre pour un objet inchangé (sinon la revalidation des jets réinitialise plus de lignes que nécessaire : gênant, pas destructeur).
