# Dofus : base de connaissances pour le scraper DofusBook

Collecté le **2026-10-06**. Ce jour-là, la mise à jour 3.7 sort et DofusBook est déjà en données 3.7.

**Fiabilité des sources**
- **Constaté** : observé directement, dans l'API DofusBook (inspectée dans un navigateur), l'API DofusDB ou l'API dofusdude.
- **Sources secondaires** : le reste vient de sites communautaires (JOL, Millenium, Gamosaurus, Breakflip, Guidactik, next-stage). dofus.com (403) et le wiki Fandom (402) n'ont pas pu être lus.
- **Mentions** : « non vérifié » signale ce qui n'a pas été confirmé. « déduit » signale une interprétation de nom de champ.

---

## 0. L'essentiel pour le scraper

- **DofusBook a une API JSON interne**, `https://www.dofusbook.net/api/...`. Depuis un navigateur, elle répond **sans cookies d'authentification** pour les données publiques (constaté). Pas besoin de parser le HTML : le front est une SPA Vue.
- **Cloudflare** bloque tout client HTTP hors navigateur, **API comprise** (constaté) :
  - `curl`, avec ou sans User-Agent de navigateur, reçoit 403 sur `/`, `/sitemap.xml`, `/api/bootstrap`, `/api/items/…` et `/api/stuffs/…/public/latest`.
  - Un scraper devrait donc passer par un vrai navigateur (headless ou non).
- **Les CGU interdisent l'extraction sans accord écrit** (§11) : copier, reproduire ou extraire le site ou son contenu est interdit sans accord écrit préalable de Dofusbook.
  - `robots.txt` n'interdit que `/admin/`.
  - **Demander l'accord de DofusBook avant tout scraping à grande échelle.**
- **Clé de jointure** : `items[].official` (DofusBook) = `ankama_id` (dofusdude) = `id` (DofusDB). Vérifié sur le Disque de Culbutœuf : 6744 côté DofusBook, 32236 partout ailleurs.
- **Ne pas scraper DofusBook pour les données de jeu.** Objets, panoplies et effets sont disponibles via des API ouvertes (§11). Le seul contenu propre à DofusBook, ce sont les **stuffs créés par les utilisateurs**.

---

## 1. Versions du jeu

| Jeu | État (oct. 2026) | Base d'objets |
|---|---|---|
| **Dofus 3** (Unity) | Le jeu principal. Bêta le 2024-08-13, sortie le 2024-12-03. | Héritée de Dofus 2. |
| Dofus 2 (Flash/AIR) | **Fermé** le 2024-12-03. Les serveurs ont migré en 3.0, il n'y a pas de coexistence. | Devenue celle de Dofus 3. |
| **Dofus Touch** | Mobile, lancé en 2016, toujours actif (MàJ 1.68 citée, non datée). | Séparée ? *non vérifié* |
| **Dofus Retro** | Version 1.29, client et serveurs séparés. | Séparée (jeu distinct). |

- Sur Retro, une contradiction : Wikipedia EN date les serveurs de 2016, Wikipedia FR de 2019.
- DofusBook gère les trois jeux sous les clés `dofus`, `touch` et `retro` (constaté dans le bundle JS et dans les compteurs `dofus_stuff_count`, `touch_craft_count`, `retro_craft_count`).

**Mises à jour récentes**
- **3.5** (2026-03-03) :
  - L'élevage devient un métier.
  - Montures niveau 1 à 200, sans certificats ni enclos privés.
  - Songes infinis.
  - « Roue du chaos » au Kolizéum.
  - Panoplies liées aux montures, set Armutin.
- **3.6** : date et contenu *non vérifiés*. La roadmap annonçait un rework Cra et une refonte du tutoriel.
- **3.7** (2026-10-06, bêta depuis le 2026-09-17) :
  - Bestiaire refondu.
  - Élevage : stabulation de 500.
  - 5 nouveaux trophées, légendaires renforcés.
  - Équilibrage Cra, Xélor, Sadida, Pandawa (les deux derniers selon une seule source).
  - Pas de nouvelle zone.
- **3.8** (annoncée pour décembre 2026) : nouvelle classe **Bellaphones** et zone « Source ». *Annonce, non vérifié.*
- **Saisons 2026**, chacune liée à un Dofus primordial :
  - Émeraude (janv.-fév.)
  - Turquoise (mars-avr.)
  - Pourpre (mai-juin)
  - Ocre (juil.-août)
  - Ivoire (sept.-oct.)
  - Ébène (nov.-déc.)
- **Numérotation 2025** (3.1 à 3.4) : incohérente selon les sources. Exemple : Osamodas est dans la « 3.1 » ou dans la « 3.2 » selon les articles du 22 juillet 2025.

> Conséquence pour le scraper : les stats des objets changent d'un patch à l'autre, et le « migrateur d'objets » (2.72) les modifie rétroactivement. **Versionner les données.** DofusBook expose `maj` (version des données) et `items[].changed` (par ex. `"3.6"`).

Sources : fr.wikipedia.org/wiki/Dofus · journaldugeek.com (2024-12-02) · gamewave.fr (3.5) · jeuxend.com et dofuspourlesnoobs.com (3.7) · guidactik.com (roadmap 2026) · breakflip.com (roadmap 2025) · gamosaurus.com/?p=219365 (migrateur).

---

## 2. Progression

- **Niveau max : 200.**
- **Niveaux Oméga** au-delà, sans limite.
  - L'XP alimente une jauge.
  - Les récompenses sont cosmétiques ou utilitaires : +5 pods, +1 place HDV et +1 place marchand par niveau, ornements, auras tous les 100 niveaux.
  - Aucun gain de puissance.
  - Source JOL de 2017 ; *non revérifié pour Dofus 3*.
  - Aucun système « paragon » trouvé.
- **5 points de capital par niveau**, soit **995 points** au niveau 200 (constaté : `threshold.vi.max = 995` dans DofusBook).
- **Coût des caractéristiques** (constaté dans `bootstrap.threshold` de DofusBook, données 3.7) :

| Carac | Paliers (points investis → coût par point) | Max atteignable avec 995 points |
|---|---|---|
| Vitalité | 1 pour 1 | 995 |
| Sagesse | 3 pour 1 | 331 |
| Force / Intelligence / Chance / Agilité | 0-100 : 1, 100-200 : 2, 200-300 : 3, 300+ : 4 | 398 |

- **Parchemins** : jusqu'à **+100 par carac** (constaté : `stuffCarac.scroll_*` = 100 sur un stuff 200).
- *Non vérifié* :
  - le cas Sacrieur (coût différent sur Retro) ;
  - les règles de restat ;
  - les points de sort par niveau.

Sources : DofusBook `/api/bootstrap` (2026-10-06) · dofus.jeuxonline.info/article/14592 (Oméga, 2017) · next-stage.fr (2026-03).

---

## 3. Classes

**19 classes** (constaté dans `bootstrap.classes` de DofusBook). Une 20e, Bellaphones, est annoncée pour la 3.8.

| id DofusBook | Classe | Archétype (sources secondaires) |
|---|---|---|
| 1 | Féca | protecteur, armures |
| 2 | Osamodas | invocateur |
| 3 | Enutrof | trésor/prospection, débuffs à distance |
| 4 | Sram | assassin, pièges, invisibilité |
| 5 | Xélor | maître du temps (PA, téléportation) |
| 6 | Ecaflip | hasard |
| 7 | Eniripsa | soigneur |
| 8 | Iop | guerrier mêlée |
| 9 | Crâ | archer distance |
| 10 | Sadida | poupées, entraves |
| 11 | Sacrieur | berserker, se renforce en subissant |
| 12 | Pandawa | potions, placement d'alliés et d'ennemis |
| 13 | Roublard | bombes |
| 14 | Zobal | masques, rôle variable |
| 15 | Steamer | tourelles |
| 16 | Eliotrope | portails |
| 17 | Huppermage | combine les 4 éléments |
| 18 | Ouginak | bestial, rage |
| **20** | Forgelance | lance, attaque et défense |

- L'id 19 n'existe pas chez DofusBook.
- Champs d'une classe : `id`, `name`, `long_name`, `title`, `description`, `roles`, `male_*`/`female_*` (look, couleurs, taille).
- Éléments typiques par classe : *non vérifié*. Les builds sont multi-éléments ; se fier aux `tags` des stuffs.

Sources : DofusBook `/api/bootstrap` · kamasv.com (rôles) · fr.wikipedia.org/wiki/Dofus.

---

## 4. Caractéristiques et combat

**Caractéristiques principales et éléments**

| Caractéristique | Élément de dégâts |
|---|---|
| Force | Terre **et** Neutre |
| Intelligence | Feu |
| Chance | Eau |
| Agilité | Air |

Vitalité et Sagesse complètent les six caractéristiques principales.

**Caractéristiques secondaires**
- PA, PM, Portée, Invocations, Initiative, Prospection, Pods
- Puissance, Critique (%), Soins
- Tacle, Fuite, Esquive et Retrait PA/PM
- Dommages : fixes, par élément, critiques, poussée, pièges
- Résistances fixes et % par élément, résistances critiques et poussée
- % dommages et % résistances sorts, armes, mêlée, distance
- Liste exhaustive avec les codes DofusBook : §10.4.

**Règles connues**
- **Résistance % plafonnée à 50 %** pour les joueurs.
  - L'excédent sert de réserve contre les réductions de résistance.
  - Les résistances fixes ne sont pas plafonnées et s'appliquent avant le %.
  - Source : dofusfashionista.gg (non officiel, non daté).
- **Limites d'équipement** : 12 PA, 6 PM, 9 PO.
  - Source de 2011 (patch 2.3.4), *non revérifié pour Dofus 3*.
  - Même source : un seul exo PA/PM/PO compte.
- **Dofus 3.0** : les boucliers perdent leurs % de dommages (armes, sorts, mêlée, distance). Ces bonus passent sur une nouvelle famille de trophées niveau 150, avec une ligne bonus et une ligne malus.
- Valeurs de base (PA, PM, pods, initiative) et formules de tacle, fuite et esquive : *non vérifiées*.

**Formule de dégâts : les deux sources se contredisent**
- dafous.app, qui annonce la « formule officielle » pour Unity :
  `Base × (1 + (Carac + Puissance + %Dommages + %Sorts + %Mêlée|Distance) / 100) + Dommages fixes`, puis résistances, puis critique.
- guidedofus.com (version inconnue) :
  `(Base × (100 + Carac + Puissance) / 100 + Dommages fixes) × (1 − %Rés)`, résistances fixes soustraites avant le %.
- Les deux s'opposent sur la place des % sorts, mêlée et distance et sur l'ordre fixe / %.
- Formules des soins et du critique : *non vérifiées*.
- Piste pour trancher : dofus.com/fr/mmorpg/tutoriels (dommages et résistances), lisible dans un navigateur.

Sources : dofus.jeuxonline.info/article/2187 · dofusfashionista.gg/guides/resistance-explained · dafous.app/en/calculateur-degats · dofus.jeuxonline.info/actualite/30454 (2011) · dofus.jeuxonline.info/actualite/64730 (3.0).

---

## 5. Équipement

**Emplacements d'un stuff** (constaté : clés de `stuff.stuffItem` chez DofusBook, chaque valeur étant un id d'objet DofusBook)

| Clé | Emplacement |
|---|---|
| `ch` | Coiffe (chapeau) |
| `ca` | Cape |
| `am` | Amulette |
| `a1`, `a2` | Anneaux |
| `ce` | Ceinture |
| `bo` | Bottes |
| `ar` | Arme |
| `br` | Bouclier |
| `fa` | Familier / montilier |
| `mo` | Monture |
| `d1` … `d6` | Dofus, trophées, prysmaradite |

**Règles** (sources secondaires, souvent Dofus 2.x)
- Impossible de porter deux Dofus identiques ou deux trophées identiques. Le mineur, le normal et le majeur d'un même trophée se cumulent.
- Les trophées ne se forgemagent pas. Il en existe aux niveaux 50, 100 et 150.
- Certains trophées ont pour condition « Bonus de panoplie < 2 » : une condition peut donc porter sur un compteur de panoplie.
- La prysmaradite occupe un emplacement Dofus. *Non vérifié pour Dofus 3.*
- Depuis la 3.5, les montures s'équipent directement, sans certificat.
- Équiper un familier ou un montilier demande d'être abonné.
- Interdiction de porter deux fois le même anneau de panoplie : *non vérifié*.

**Catégories d'objets DofusBook** (constaté dans `bootstrap.categories` ; libellés déduits des codes)

| Groupe | Catégories (`id=code`) |
|---|---|
| `cloths` (pièces de panoplie) | 12 am, 13 an, 14 br, 15 ce, 16 ch, 17 ca, 19 bo, 22 fa, 99 ar |
| `items` | 12 am, 13 an, 14 br, 15 ce, 16 ch, 17 ca, 19 bo, 20 do (Dofus), 21 tr (trophée), 22 fa (familier), 23 mo (monture), 24 mt (montilier ?), 25 mu (muldo ?), 26 vo (volkorne ?), 27 ap, 28 al, 29 co, 30 hr, 31 pr (prysmaradite ?) |
| `weapons` | 1 ar arc, 2 ba bâton, 3 bn baguette, 4 da dague, 5 ep épée, 6 fx faux, 7 ha hache, 8 ma marteau, 9 pe pelle, 10 pi pioche, 32 la lance |

Les codes `ap`, `al`, `co` et `hr` sont *non identifiés* (apparat ? costume ? harnachement ?).

> ⚠️ Le code `ar` désigne l'*arme* dans `stuffItem` et dans la catégorie 99, mais l'*arc* dans la catégorie 1 des armes. Distinguer les objets par `category_id` (et `category_type`), jamais par `category_name`.

**Panoplies**
- Les bonus dépendent du nombre de pièces portées.
  - DofusBook : `cloths[].effects[]` avec `count` (nombre de pièces) et `value`.
  - dofusdude : `effects` est un dictionnaire `"nb pièces" → [Effect]`.
- Champs DofusBook utiles : `count_item`, `count_ring`, `count_item_no_ring`, `bonus` (par ex. `"fo-ch-ag"`), `cannot_craft`.
- **Dofus 3.0** :
  - Panoplies rééquilibrées : les niveaux 1 à 110 harmonisés avec du PA/PM, les niveaux 190 à 200 relevés.
  - Retour du drop d'équipement sur 12 panoplies.
- Panoplies de classe : *non vérifié*.

**Lignes d'effets**
- Un objet a des jets **min–max** par ligne (DofusBook : `effects[].min/max`). Un « jet parfait » met toutes les lignes au maximum.
- Malus : *non vérifié*. Probablement des valeurs négatives.
- **Conditions d'équipement** : arbre booléen chez dofusdude (`ConditionNode` : `relation` and|or, `children`, `is_operand`, `condition`). Chez DofusBook : `items[].constraints[]`.

**Armes** (DofusBook `items[].weapon`, constaté)
- Champs :
  - coût et portée : `pa_cost`, `po_min`, `po_max` ;
  - critique : `cc_rate`, `cc_bonus`, `cc_hits` ;
  - frappes : `hits_count`, `hits_lines` ;
  - autres : `one_hand`, `incarnation`, `etheral`, `shushette`.
- Les lignes de dégâts sont des effets de type `"D"`, par exemple `dn` 34-41 et `ve` 7-9 (libellés déduits : dommages neutre, vol eau).

Sources : DofusBook API · dofus.jeuxonline.info/article/3261 et /13994 · dofus.jeuxonline.info/actualite/64730 · github.com/dofusdude/dofusdude-py (docs `Equipment`, `Weapon`, `Effect`, `EquipmentSet`, `ConditionNode`).

---

## 6. Forgemagie et finitions

- **Runes** à trois paliers : base, **Pa** (= 3 runes de base), **Ra** (= 3 Pa).
  - Chaque rune a une puissance et un poids, par exemple Vi poids 1, Ra Pod puissance 100 poids 25.
  - Source JOL 2017, chiffres à recouper.
  - Une source affirme qu'il n'existe pas de Pa/Ra pour PA, PM et PO.
- **Puits** : le poids perdu moins le poids posé. Il absorbe les pertes suivantes. Résultats possibles : succès critique, neutre ou échec critique. Modèle de 2017, *non revérifié en 3.x*.
- **Over** : dépasser le jet maximum, avec une densité d'over d'environ 101 au maximum (exemple : 505 Vitalité).
- **Exo** : ajouter une ligne absente, typiquement PA, PM ou PO. Un seul exo PA/PM/PO est pris en compte.
- **Transcendance** :
  - Rune à 100 % de réussite, obtenue dans les Songes.
  - L'objet ne doit avoir ni over ni exo.
  - Elle **verrouille l'objet** contre toute forgemagie future.
- **Corruption** (introduite en 2.49) : un bonus et un malus, 100 % de réussite, verrouillage. *Non vérifié en Dofus 3.*
- **Migrateur d'objets** (2.72) : modifie toutes les copies existantes d'un objet et peut supprimer overs et transcendances.
- **Chez DofusBook** :
  - FM globale : `stuffFm` (par ex. `{"pm":1,"po":1}`).
  - FM par objet : `stuffFmItem` et `fmItems`.
  - FM d'arme : `fmWeapon`, `fmStealWeapon`, `fmHealWeapon`.
  - Flag `items[].cannot_fm`.

Sources : dofus.jeuxonline.info/article/3736 (2017) · next-stage.fr/?p=234201 (2026-03) · millenium.org/guide/316947 (2.49) · gamosaurus.com/?p=219365.

---

## 7. Familiers, montures, Dofus et trophées

- **Familiers** :
  - Niveaux 1 à 100, bonus évolutifs.
  - Depuis 2.48 : plus de PV ni de repas horaires, ils se nourrissent de ressources qui donnent de l'XP.
  - *Source à reconfirmer.*
- **Montiliers** : sans niveaux, ils accélèrent le déplacement. Leur classification entre monture et familier est ambiguë selon les sources.
- **Montures** (3.5) :
  - Trois types : Dragodinde, Muldo, Volkorne.
  - Niveaux 1 à 200.
  - Vitalité plafonnée à 300 au niveau 100 et à 400 au niveau 200.
  - Plus d'énergie ni de fatigue.
  - Certains guides décrivent encore les jauges endurance, maturité et amour : c'est obsolète.
- **Dofus** (œufs) :
  - Niveaux cités : Cawotte 60, Dolmanax et Kaliptus 100, Pourpre 110, Ocre et Turquoise 160, Ébène et Vulbis 180. *Non revérifié.*
  - Primordiaux : Émeraude, Ivoire, Ocre, Pourpre, Turquoise, plus Ébène selon les sources.
  - Les Dofus sont rééquilibrés par patch : en 3.5, Émeraude, Ébène, Ratrapry et Prysmaru ont changé.
- **Trophées** : refondus en 3.7, avec 5 nouveaux.
- **Légendaires** : flag `items[].legendary` chez DofusBook, renforcés en 3.7. Un système de rareté générale : *non vérifié*.

Sources : gamewave.fr et guidactik.com (3.5) · jeuxend.com (3.7) · next-stage.fr/?p=236958 (familiers, extrait) · dofus.jeuxonline.info/article/3261.

---

## 8. Serveurs et économie

- **Serveurs Dofus 3** (constaté dans `bootstrap.servers` de DofusBook, `value` = id) :

| id | Serveur | Type |
|---|---|---|
| 1 | Imagiro | fr |
| 3 | Orukam | fr |
| 4 | Hell Mina | fr |
| 5 | Tylezia | fr |
| 6 | Tal Kasha | international |
| 7 | Draconiros | monocompte (abonnement requis) |
| 8 | Ombre | épique (mort définitive, XP et butin ×3) |

- Les serveurs Héroïques n'existent plus.
- **Temporis** : serveurs saisonniers temporaires. Un Temporis est annoncé pour décembre 2025, mais une source de mai 2026 en juge le retour peu probable : *contradiction*.
- **Monnaies** : kamas (jeu) et **Ogrines** (premium, abonnement).
- **Métiers** : 19 selon Wikipedia FR (6 de récolte, 6 de craft, 7 artisanaux). La liste n'a pas été obtenue. L'élevage est un métier depuis la 3.5. DofusBook expose `bootstrap.jobs`.

Sources : DofusBook `/api/bootstrap` · next-stage.fr/2026/05 (serveurs) · fr.wikipedia.org/wiki/Dofus.

---

## 9. Contenu (repères)

- Donjons, quêtes, Songes (infinis depuis la 3.5), raids de guilde (saison Ocre 2026).
- PvP : Kolizéum (roue du chaos en 3.5), AvA (révision prévue en 2025), alignements (*non vérifié*).
- DofusBook expose `bootstrap.areas` et `bootstrap.subareas` (zones), ainsi que les sorts (`/encyclopedie/sorts/:classId`).

---

## 10. DofusBook : fonctionnement technique

Tout ce qui suit a été constaté le 2026-10-06 dans un navigateur, sauf mention contraire.

### 10.1 Généralités
- **Fan-site** indépendant d'Ankama (CGU §1.1), consacré à l'univers de DOFUS.
- Langues : `fr`, `es`, `en`.
- Le site existerait depuis plus de 10 ans (extrait de recherche Gamosaurus, non vérifié).
- Fonctions :
  - stuffs privés et publics, dossiers ;
  - encyclopédie : objets, armes, panoplies, cosmétiques, sorts ;
  - outils : `cacminator`, `bombminator`, `panominator`, `stuffminator` (comparateur), `skinator`, `dofus-stuffer` ;
  - pages communauté et membres.
- **Technique** :
  - SPA **Vue** + Vite (`/desktop/assets/index-desktop-*.js`).
  - Les URL HTML sont préfixées par `/desktop/{lang}/`.
  - Publicité (Venatus) et Google Analytics.
- **Protection** : Cloudflare.
  - Hors navigateur, `curl` reçoit 403 sur `/` et sur l'API, et un défi sur `/sitemap.xml`.
  - `robots.txt` (dernière modification le 2026-10-04) : `User-agent: *` / `Disallow: /admin/`, sans Crawl-delay ni Sitemap.
- **CGU §11** : extraction et reproduction interdites sans accord écrit (voir §0).

### 10.2 Routes du front (`/desktop/:lang(fr|es|en)/…`)
- `encyclopedie/objet/:itemId`, par ex. `encyclopedie/objet/6744-disque-de-culbutoeuf`
- `encyclopedie/panoplie/:clothId`, `encyclopedie/sorts/:classId`, `encyclopedie/:category`
- `equipement/stuffs-publics`, `equipement/mes-stuffs`
- `equipement/private/:stuffId/{objets|arme|sorts|boosts|simulation|copie}` : stuffs de l'utilisateur. Le `stuffId` est un slug `"{id}-{nom}"`.
- `equipement/:stuffId/snapshot` : stuff public. Les autres sous-pages (`objets`, `arme`…) sont *déduites*.
- `membre/:userSlug/{profil|equipements|atelier|skins}`
- `outils/{cacminator|bombminator|panominator/:clothId?|stuffminator/:id1/:id2|skinator/:skinId|dofus-stuffer}`
- `cgu`, `confidentialite`, `devblog`, `guides`

### 10.3 API JSON (`https://www.dofusbook.net/api/`, `{game}` ∈ `dofus|touch|retro`)

| Endpoint | Sans auth | Contenu |
|---|---|---|
| `GET bootstrap` | ✅ | référentiels : `classes`, `categories`, `effects`, `maj`, `servers`, `threshold`, `badges`, `areas`, `subareas`, `jobs` |
| `GET stuffs/{game}/public/latest` | ✅ | `{rows: [stuff résumé], items: [objets référencés]}` |
| `GET stuffs/{game}/public/{id}` | ✅ | stuff complet (voir ci-dessous) |
| `GET stuffs/{game}/public/list/{…}` | ? | liste paginée, paramètres *non vérifiés* |
| `GET items/{game}/{id}` | ✅ | `{source, data: objet}` |
| `items/{game}/search/{category}` | ? | recherche dans l'encyclopédie, méthode et paramètres *non vérifiés* |
| `search/{game}/stuffs` | ? | recherche de stuffs (GET sans paramètres → 500, POST `{}` → 404, format *non vérifié*) |
| `stuffs/{game}/private/…`, `favorites`, `folders`, `boosts/stuff/{id}` | ❌ | espace de l'utilisateur connecté |

- **Routes `private`** : authentification par header `Authorization: Bearer <JWT>`, pas par les cookies (`fetch` depuis la page avec `credentials: 'include'` → 401, constaté le 2026-10-07). La SPA garde le JWT dans `localStorage.token` et l'envoie via axios avec un header `x-lang`. `GET stuffs/{game}/private/` (sans id) liste les stuffs de l'utilisateur.

- Des réponses portent `source: "cache"` ou `"database"`.
- `cf-cache-status: DYNAMIC` sur `stuffs/dofus/public/latest` (seul endpoint vérifié) : réponse non mise en cache par Cloudflare.
- Rate limit : *non vérifié*.

**Stuff complet** (`stuffs/dofus/public/{id}`)
- `stuff` :
  - identité : `id`, `slug`, `short_url`, `name`, `description`, `markdown` ;
  - personnage : `character_class` (id de classe), `character_gender`, `character_level` ;
  - classement : `tags` (par ex. `"ter"`), `allowed_classes`, `visible` ;
  - dates : `created_at`, `updated_at` ;
  - équipement : `stuffItem` (emplacements → id d'objet DofusBook, §5) ;
  - caractéristiques : `stuffCarac` (`base_vi/sa/fo/in/ch/ag` et `scroll_*`) ;
  - forgemagie : `stuffFm`, `stuffFmItem` ;
  - autres : `skin`, `stat`, `folder`.
- Au niveau racine :
  - `user` : profil public de l'auteur ;
  - `items` : objets équipés, détaillés ;
  - `cloths` : panoplies actives et leurs bonus ;
  - `fmGlobal`, `fmWeapon`, `fmStealWeapon`, `fmHealWeapon`, `fmItems`, `stuffStats`.

**Objet** (`items[]` ou `items/{game}/{id}` → `data`)
- Identifiants : `id` (DofusBook), **`official` (id Ankama)**, `picture`, `slug`.
- Description : `name`, `level`, `category_id`, `category_name`, `category_type` (`E` = équipement, `W` = arme), `subcategory_*`.
- Panoplie : `cloth_id`, `cloth_name`.
- Flags : `legendary`, `cannot_fm`, `choose_effect`, `give_boost`.
- Version : `added`, `changed` (par ex. `"3.6"`).
- Effets : `effects[]` = `{id, name (code), type, min, max, spell, spellDesc, emote, title}`.
- Autres : `constraints[]`, `ingredients[]` (recette : `{id, name, picture, count}`), `tags`, `weapon` (§5), `skin`.

### 10.4 Codes d'effets DofusBook (`bootstrap.effects` ; `main` = 23 caracs principales, `normal` = 82, `hit` = 11 lignes d'arme)

- **Confirmés** sur une fiche rendue, ou par recalcul exact des totaux de deux stuffs de référence (`test/fixtures/dofusbook/`) :
  - Caracs : `vi` Vitalité, `fo` Force, `in` Intelligence, `ch` Chance, `ag` Agilité, `sa` Sagesse, `pu` Puissance.
  - Combat : `pa` PA, `pm` PM, `po` Portée, `ic` Invocations, `cc` % Critique, `so` Soins, `ii` Initiative, `pp` Prospection.
  - Mobilité : `ta` Tacle, `fu` Fuite, `rpa`/`rpm` Retrait PA/PM, `epa`/`epm` Esquive PA/PM.
  - Dommages : `dnf dtf dff def daf` = dommages fixes Neutre, Terre, Feu, Eau, Air ; `dmg` = Dommages (génériques, ajoutés à chaque élément) ; `dc` Do Critique ; `dp` Do Poussée.
  - Pourcentages de dommages : `ds` sorts, `dw` armes, `dm` mêlée.
  - Résistances : `rnp rtp rfp rep rap` = % résistance ; `rt rf ra` = résistance fixe ; `rc` Ré Critique ; `rp` Ré Poussée ; `rd` % Ré Distance.
- **Déduits** de façon cohérente :
  - `dd` % dommages distance ; `rs rw rm` % résistance sorts, armes, mêlée ; `rn re` résistance fixe Neutre, Eau ; `pd` Pods.
  - Lignes d'arme (type `D`) : `dn dt df de da` = dommages Neutre à Air ; `vn vt vf ve va` = vol de vie par élément. `pac` (type `U`) = retrait de PA d'arme.
  - Pièges : `pi`/`pip` = dommages pièges fixe / %.
- **Inconnus** : `dme`, `pvr`, `vpm`, `pmc`, `pou`, `pmj`, `rv`, `pnp…pap`, `pnf…paf` (peut-être des résistances PvP ?), `pb`, `chs`.
- **Lignes texte** (type `O`) : `sp` = sort/passif (valeur = id de sort), `at` = attitude.

### 10.5 Règles de calcul appliquées par DofusBook (déduites de deux stuffs, totaux retrouvés exactement)

- **PV** = 50 + 5 × niveau + Vitalité.
- **Valeurs de base** : PA 7 (au niveau 200), PM 3, PO 0, Invocations 1, Critique 0, Prospection 100.
- **Dérivées** :
  - Initiative = Force + Intelligence + Chance + Agilité + bonus.
  - Prospection = 100 + ⌊Chance/10⌋ + bonus.
  - Pods = 1000 + 5 × Force + bonus.
  - Tacle et Fuite = ⌊Agilité/10⌋ + bonus.
  - Retrait et Esquive PA/PM = ⌊Sagesse/10⌋ + bonus.
- **Stat effective pour les dégâts** affichée = carac + Puissance.
- **Caracs** : `stuffCarac.base_*` est une valeur de carac, pas des points. Le coût par paliers se calcule sur la base seule ; les parchemins sont hors paliers (493 + 498 = 993 points ≤ 995 sur le stuff Féca).
- **Jet par défaut = jet parfait** : le max pour un bonus, la valeur la plus proche de 0 pour un malus. DofusBook stocke un malus avec `min` = la valeur la plus proche de 0.
- **FM par objet** (`stuffFmItem`, identique à `fmItems`) : `{emplacement: {code: valeur}}`.
  - Code présent sur l'objet : valeur **absolue** de la ligne (jet, over possible).
  - Code absent : **exo** ajouté.
- **FM globale** (`stuffFm.fm`, par ex. `{"pm":1,"po":1}`) : s'ajoute aux totaux.
- **FM élémentaire d'arme** : `stuffFm.weapon` / `steal` au format `"<code>-<valeur>"`, par ex. `df-100`. Effet sur les coups *non vérifié*.
- **Panoplies dans la réponse API** : `cloths[].effects` ne contient que le palier actif.
- Ces règles sont celles de DofusBook 3.7, **pas vérifiées en jeu**. PA de base sous le niveau 100 : *non vérifié*.
- **Formule de dégâts de DofusBook** : retrouvée exactement sur 20 bornes d'arme et sur le sort Flèche de Recul. Elle tranche entre les deux formules du §4. Données dans `test/fixtures/dofusbook/damage-reference.json`.
  - `mult = (100 + carac de l'élément + Puissance [+ maîtrise d'arme 300]) / 100`.
  - Coup normal : `⌊(⌊base × mult⌋ + dommages fixes de l'élément + Dommages) × (1 + % dommages) × (1 − malus)⌋`.
  - Coup critique d'arme : `base + cc_hits`, avec Do Critique ajouté aux fixes.
  - Coup critique de sort : dés de `criticalEffect` (DofusDB).
  - Soin d'un vol de vie : la moitié des dégâts.
  - Probabilité de critique : CC de l'arme ou du sort + Critique, plafonnée à 100 %.
  - Place du % mêlée/distance et origine d'un « malus 10 % » sur une pelle : *non déterminées*.
- **Ids de sorts** : ceux qu'affiche DofusBook (ex. 32426) sont les ids DofusDB `/spells/{id}` listés dans `breeds.breedSpellsId`. Le Sacrieur a les mêmes paliers de caracs que les autres classes (DofusDB `breeds`).
- Identifiants numériques : 10 à 100 pour les dommages et le vol, 130 à 240 pour les caracs, 520 à 560 pour les résistances fixes, 470 à 510 pour les %, etc.
- **Pour lever les ambiguïtés**, deux pistes :
  - comparer les objets via `official` avec les effets typés de dofusdude ou DofusDB ;
  - lire une fiche DofusBook où le code apparaît.

---

## 11. Sources de données alternatives

| Source | Accès | Version au 2026-10-06 | Remarques |
|---|---|---|---|
| **dofusdude** (`api.dofusdu.de`) | API JSON ouverte, Swagger sur docs.dofusdu.de | **3.7.1.0** (mise à jour le jour même) | Routes `/dofus3/v1/{lang}/items/equipment/{ankama_id}`, etc. Clients générés (py, js, ts, rs, go, java, cs). Serveur : github.com/dofusdude/doduapi. |
| **DofusDB** (`api.dofusdb.fr`) | API Feathers.js ouverte (`$limit`, `$skip`, filtres en query) | 3.6.12.16 (une version de retard) | `items` : 21 776 entrées, `item-sets` : 931. Champs bruts du client (`possibleEffects`, `criterions`, `itemSetId`, `dropMonsterIds`…). Front SPA sur dofusdb.fr. |
| **doduda** (github.com/dofusdude/doduda) | CLI qui télécharge et dépaquette les assets du client (GPL-3.0) | actif | Dumps automatiques : github.com/dofusdude/dofus3-main et dofus3-beta. |
| Encyclopédie Ankama (dofus.com/fr/mmorpg/encyclopedie) | HTML | ? | 403 CloudFront pour curl, aucune API publique connue. |
| DDC (dofusdude) | — | archivé le 2025-01-04 | Anciennes données Dofus 2. |

- Les noms « dofapi », « dofus-datacenter » et « dofus-unity data » ne correspondent à aucun projet trouvé.

### 11.1 dofusdude en détail (spec : github.com/dofusdude/api-docs, `openapi-3.0.yaml`, lue le 2026-10-06)

**Généralités**
- Base `https://api.dofusdu.de/{game}/v1/{lang}/…`, sans clé.
  - `game` : `dofus3`, `dofus3beta`, `dofus2`.
  - `lang` : `fr`, `en`, `es`, `pt`, `de`.
- Mise à jour automatique moins de 10 min après chaque version du jeu.

**Ressources**
- Familles : `items/equipment`, `items/resources`, `items/consumables`, `items/quest`, `items/cosmetics`, `mounts`, `sets`.
- Chaque famille a quatre formes :
  - liste paginée ;
  - `/all` (tout en une requête) ;
  - `/{ankama_id}` (détail) ;
  - `/search?query=` (recherche plein texte tolérante aux fautes).
- Recherche globale : `/{lang}/search`.
- Méta : `meta/version`, `meta/elements` (effets et éléments de condition), `meta/items/types`.
- Almanax : `dofus3/v1/{lang}/almanax[/{date}]`.
- Webhooks Discord (Almanax, RSS, Twitter).

**Paramètres de requête**
- Pagination : `page[number]`, `page[size]` (`-1` désactive la pagination).
- Tri : `sort[level]`.
- Champs : `fields[item|set|mount]` ajoute des champs aux entrées de liste.
- Filtres :
  - niveau : `filter[min_level]`, `filter[max_level]` ;
  - type : `filter[type.name_id]` ;
  - famille de monture : `filter[family.id]`, `filter[family.name]` ;
  - panoplies : `filter[min_highest_equipment_level]`, `filter[max_highest_equipment_level]`, `filter[contains_cosmetics]`, `filter[contains_cosmetics_only]` ;
  - Almanax : `filter[bonus_type]` ;
  - recherche globale : `filter[search_index]`.

**Contenu d'un objet**
- `ankama_id`, `name`, `description`, `type`, `level`, `pods`, `image_urls` (icône, sd).
- `recipe`, `parent_set`, `is_weapon`.
- `effects` (min/max par ligne) et `conditions` (arbre and/or).
- Pour une arme : `ap_cost`, `range`, critique.

**⚠️ Anomalie constatée le 2026-10-06 sur `dofus3` (version 3.7.1.0, mise à jour le jour même)**
- Les objets renvoyés n'ont **ni `effects` ni `conditions`**. Testé sur le Disque de Culbutœuf, l'Anneau Lunaire et l'Épée de Boisaille.
- Le canal `dofus3beta` (3.7.3.3) et DofusDB (3.6.12.16) ont bien les 10 effets du Disque de Culbutœuf.
- Probablement une régression d'extraction liée à la 3.7. Aucune issue ouverte sur doduapi ce jour-là.
- Vérifier la présence des effets avant d'ingérer les données.

### 11.2 Releases `dofus3-main` (générées par doduda) et images des objets

- **Une release GitHub par version du jeu** : github.com/dofusdude/dofus3-main/releases. Tags `3.7.1.0`, `3.6.12.16`, etc.
- **Données JSON** :
  - brutes : `items.json`, `item_sets.json`, `effects.json`, `characteristics.json`, `breeds.json`, `spells.json`, `spell_levels.json`, `recipes.json`, `monsters.json` ;
  - textes : `fr.json` et les autres langues ;
  - mappées, plus simples : `MAPPED_ITEMS.json`, `MAPPED_SETS.json`, `MAPPED_RECIPES.json`.
- **Images** :
  - objets : `items_images_64.tar.gz` (64 Mo), `items_images_128.tar.gz` (166 Mo) ;
  - cosmétiques : `cosmetic_images_*` ;
  - icônes de caractéristiques : `statistics_images_48/96` ;
  - têtes de classe : `class_head_images_*` ;
  - sorts : `spell_images_48/96`.
- **Images en ligne** sans téléchargement : `https://api.dofusdu.de/dofus3/v1/img/item/{iconId}-64.png` (ou `-128.png`).
  - Les tailles 256 et plus renvoient 404.
- **Clé d'image** : `iconId` (jeu et dofusdude) = `picture` chez DofusBook. Vérifié : 82561 pour le Disque de Culbutœuf.
- **Release 3.7.1.0 (constaté le 2026-10-06)** :
  - `MAPPED_ITEMS.json` a des `effects` vides pour les **17 377 objets**. C'est la même régression que l'API.
  - `items.json` (format Unity : `references.RefIds[].data`, effets référencés par `rid`) contient bien les `possibleEffects`, par exemple 10 effets pour 32236.
  - Le bug vient donc du mapping, pas de l'extraction.
- **Sorts** : `spell_levels.json` de la release 3.7.1.0 (format Unity, effets dans `effects.Array[]` avec `actionId` = id d'effet) donne les dés de la version en jeu.
  - DofusDB (3.6.12) avait encore les valeurs d'avant le rééquilibrage Crâ de la 3.7 : 4 sorts Crâ sur 13 différaient de DofusBook.
  - `scripts/sync-dofusdb.mjs` prend donc noms, variantes (`/spell-variants`) et structure sur DofusDB, et les valeurs chiffrées des niveaux sur la release.
  - Résultat : 13 sorts Crâ sur 13 identiques à DofusBook.
- **Contournements** :
  - utiliser la release `3.6.12.16` : son `MAPPED_ITEMS.json` a bien des effets (10 103 objets sur 17 064, ressources comprises), vérifié le 2026-10-06 ;
  - utiliser le canal API `dofus3beta` (3.7.3.3) ;
  - mapper soi-même depuis `items.json` ;
  - attendre le correctif.
- Outils de build tiers (Dofus Lab, d2builder) : *non recherchés*.

---

## 12. Contradictions et points ouverts

- **Formule de dégâts** : deux versions incompatibles (§4).
- **Plafonds 12 PA / 6 PM / 9 PO et exo unique** : source de 2011, à confirmer pour Dofus 3.
- **Corruption** : toujours présente en Dofus 3 ? *Non vérifié.*
- **Dofus Touch** : base d'objets séparée ou non ? DofusBook la traite comme un jeu distinct (`touch`).
- **Codes d'effets et de catégories DofusBook inconnus** : listés en §5 et §10.4.
- **Recherche de stuffs DofusBook** : format de requête de `search/{game}/stuffs` et pagination de `public/list` non relevés. Il faut observer l'onglet Network lors d'une recherche dans le navigateur.
- **Numérotation des MàJ 2025** (3.1 à 3.4) et contenu de la 3.6 : incohérents ou introuvables.
- **Temporis** : retour en décembre 2025 annoncé, puis jugé improbable en mai 2026.
