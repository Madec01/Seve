# Architecture — « Une année à la ferme »

HTML + CSS + JavaScript (modules ES natifs), **sans dépendance à l'exécution**. Canvas 2D pour la scène, DOM/CSS pour l'interface. Servi en HTTP statique (`python3 -m http.server`, GitHub Pages). Pour la publication, `node tools/build.js` réunit les modules et les styles en deux fichiers à empreinte (voir « Construction et publication »).

## Arborescence

```
index.html                 page publiée (GÉNÉRÉE par tools/build.js depuis src/index.template.html)
dev.html                   même page, modules de src/ non empaquetés (GÉNÉRÉE, pour déboguer)
dist/                      GÉNÉRÉ : game.<empreinte>.js (+ .map), game.<empreinte>.css, build.json
sw.js                      service worker (bloc PRECACHE généré par tools/build.js)
css/fonts.css, style.css   police « Ferme » et styles de l'interface (bordures Kenney en border-image)
package.json               dépendance de développement : esbuild (construction seulement)
src/
  index.template.html      modèle de la page (marqueurs {{PRELOAD}}, {{BOOT}}, {{STYLES}})
  loader.js                chargeur + garde-fou de démarrage (script classique recopié dans la page)
  version.js               assetUrl(chemin) → « chemin?v=<empreinte> » (table écrite dans le paquet)
  main.js                  point d'entrée : chargement des ressources, boucle, câblage core ↔ rendu ↔ UI ↔ audio
  data/                    données pures (aucune logique d'état)
    crops.js               cultures
    investments.js         investissements
    levels.js              niveaux (contraintes, fermages, météo, seuils d'étoiles) — nombres du mode classique
    difficulty.js          modes de difficulté (détente par défaut, classique) : levelFor(id, mode)
    balance.js             constantes globales (durée d'un jour, charges de base…)
  core/                    logique pure, sans DOM, testée sous Node
    rng.js                 générateur pseudo-aléatoire à graine (mulberry32, flux météo / marché / maladie)
    game.js                createGame() / loadGame() : état, update(dt), actions, requêtes, événements
    calendar.js            jours, saisons, fin d'année
    farm.js                parcelles, pousse, arrosage, gel, maladie, arrosage automatique, prix de récolte
    economy.js             investissements, revenus, charges, prêt, fermage
    weather.js             tirage de la météo
    market.js              cours du « marché fou »
    stats.js               statistiques et bilans (summary)
    neighbour.js           prêt du voisin (filet de sécurité du mode détente)
    events.js              émetteur d'événements
  render/                  dessin canvas
    assets.js              chargement des images/sons (promesses)
    atlas.js               sprites nommés → {image, x, y, w, h}
    scene.js               dessin de la ferme (sol, champ, bâtiments, animaux, décor)
    effects.js             particules (pluie, neige, feuilles, pièces), lumière du jour, teintes de saison
    layout.js              positions des éléments de la scène (grille du champ, emplacements des bâtiments) + hit-testing
  ui/                      interface DOM (téléphone en portrait d'abord, voir « Interface » plus bas)
    hud.js                 barre du haut (2 lignes) : argent + saison, météo, fermage, bouton de vitesse
    tabbar.js              onglets du bas : Ferme · Acheter · Bilan · Menu
    sheets.js              feuilles du bas (une à la fois) + swipeToClose (aussi utilisé par les fenêtres)
    gestures.js            gestes sur la scène : toucher, appui long, glisser (série / défilement), souris, molette
    field.js               feuilles du champ : graines, ouverture, fiche parcelle, fiche bâtiment
    panel.js               contenus « Acheter » (cartes) et « Bilan »
    dialogs.js             fenêtres : menu, niveaux, options, crédits, pause, fin de saison, victoire, faillite, concours
    grange.js, decor.js, hints.js, buildings.js, progress.js, v3.js   contenu v3 (voir « Interface »)
    tutorial.js            tutoriel du niveau 1 (bulles ancrées en haut ou en bas en portrait)
    toasts.js, tooltip.js, icons.js, text.js, dom.js
  audio/
    audio.js               musique (fondus), ambiances, effets sonores, volumes
  storage.js               localStorage (partie, progression, options) avec try/catch
assets/
  sprites/                 packs Kenney (Tiny Farm, Tiny Town, UI Pack Pixel Adventure)
  audio/music/             Sirental (ogg)
  audio/sfx/               Kenney + Freesound
  audio/ambience/          Freesound (oiseaux, pluie, vent)
  fonts/                   Jersey Ferme (Jersey 15 retouchée, OFL)
tests/                     tests Node : `node --test tests/` (tests/index.js charge les *.test.js) ou `node --test`
tools/simulate.js          simulation d'équilibrage (joueurs-robots par niveau)
tools/build.js             construction de la version publiée (voir plus bas)
```

## Construction et publication

GitHub Pages sert chaque fichier avec `Cache-Control: max-age=600` et n'a pas d'étape de construction. Avec des modules et des styles aux noms fixes, un téléphone qui recharge juste après une mise en ligne recevait la nouvelle page mais gardait des modules ou styles de l'ancienne version dans son cache HTTP (Chrome ne revalide que la page au rechargement) : versions mélangées, jeu bloqué sur l'écran de chargement. D'où :

- **`node tools/build.js`** (à lancer avant chaque commit ; `--check` vérifie sans écrire) :
  1. empreinte SHA-256 de chaque ressource de `assets/` (sauf captures, scripts, licences, police source) ;
  2. `src/main.js` et tous ses modules → **un seul fichier** `dist/game.<empreinte>.js` (esbuild, IIFE, Chrome 90+, minifié, carte des sources renvoyant vers `src/`). La table `{ chemin: empreinte }` des ressources y est écrite (`globalThis.__FERME_ASSETS__`) : `assetUrl()` (`src/version.js`) ajoute `?v=<empreinte>` aux images (`loadImage`) et aux sons (`audio.js`) ;
  3. `css/fonts.css` + `css/style.css` → **un seul fichier** `dist/game.<empreinte>.css`, `url()` réécrites en `../assets/…?v=<empreinte>` ;
  4. `src/index.template.html` → `index.html` (config `window.__FERME_BUILD__ = { id, js: { src, sha, size }, css }`, chargeur `src/loader.js` recopié dans la page, préchargement des polices versionnées) et `dev.html` ;
  5. bloc `PRECACHE` de `sw.js` : `[chemin, empreinte, taille, 'core'|'lazy']`, `VERSION` = identifiant de la version ;
  6. `dist/build.json` : identifiant, fichiers, empreintes des sources (lues par `tests/build.test.js`, qui échoue si la version publiée est périmée), et les 5 dernières versions : leurs paquets restent dans `dist/`, pour qu'une page encore en cache (navigateur, CDN) trouve toujours SES fichiers.
- **Garantie** : une page `index.html`, quelle que soit sa version, ne désigne que des fichiers de sa version (noms ou `?v=` à empreinte). Un mélange est impossible, même avec un cache HTTP ou un CDN en retard.
- **Chargeur** (`src/loader.js`, script classique dans la page, sans fichier séparé) : télécharge le paquet avec `fetch` en flux (la jauge avance dès le premier octet : 40 % pour le paquet, 60 % pour images/police/sons de l'accueil), vérifie son SHA-256, puis l'exécute (`<script>` avec `//# sourceURL`) une fois la page lue et la feuille de style chargée. Échec (réseau, fichier tronqué, 404) : 3 nouveaux essais (1 s, 2,5 s, 5 s) avec `?r=n` et `cache: 'reload'` ; idem pour la feuille de style. Garde-fou : erreur de script, `__bootFail(err)`, ou aucun progrès pendant 20 s → nouvelle version du service worker activée et un seul rechargement (repère `ferme.bootRecovery` en sessionStorage), sinon message d'erreur réel, bouton « Réparer le jeu » et zone « Détails » (version, adresse, service worker, navigateur, écran, journal horodaté du chargement, première ligne de la pile). `?r=…` est retiré de l'adresse ; `index.html?dev=1` ouvre `dev.html`.
- **Réparer** (`window.__repairGame()`, `pwa.repairApp()`) : désinscrit le service worker, supprime les caches `ferme-*`, retélécharge la page (`./`, `index.html`) puis chaque fichier qu'elle désigne avec `fetch(…, { cache: 'reload' })` (le cache HTTP est rafraîchi), puis recharge avec `?r=<heure>` (20 s au plus). Le localStorage n'est pas touché.
- **Démarrage léger** : seuls 6 petits effets sonores sont attendus (4 s au plus) ; musiques, ambiances et autres effets se téléchargent ensuite en fond, deux à la fois, musique du menu d'abord. Images : 2 nouveaux essais (`?…&r=n`) avant d'abandonner.
- **Service worker** (`sw.js`) : installation = fichiers « core » seulement (page, paquet, police, images, icônes, manifeste : ~0,3 Mo, vérifiés par SHA-256) ; les sons (« lazy ») sont rangés au premier usage, vérifiés, dans le seul format utilisé. Navigation vers la page du jeu : **réseau d'abord** (`cache: 'no-cache'`, donc revalidée), page de la version installée si hors ligne ou au bout de 5 s. Fichiers précachés : cache d'abord, sauf si `?v=` ne correspond pas à l'empreinte en cache (page d'une autre version) → réseau. Le nouveau service worker s'active tout seul (`skipWaiting`) — sans risque, tout le code est dans un seul fichier déjà exécuté — et nettoie les anciens caches ; `pwa.js` compare alors la version de la page (`__FERME_BUILD__.id`) à la sienne et, si la page est plus ancienne, affiche « Nouvelle version disponible — toucher pour recharger ».
- **Développement** : `dev.html` (ou `index.html?dev=1`) charge `src/main.js` et `css/*.css` sans paquet ni service worker ; `?nosw` désactive le service worker sur `index.html`.

## Contrat du cœur de jeu (`src/core/game.js`)

```js
import { createGame, loadGame } from './core/game.js';

const game = createGame({ levelId: 1, seed: 12345 });   // nouvelle partie (mode « détente » par défaut, voir plus bas)
const game2 = loadGame(savedObject);                     // reprise (objet issu de game.serialize())

game.update(dtSeconds);        // fait avancer le temps selon la vitesse ; déclenche les aubes, fermages, etc.
game.on(type, handler);        // abonnement aux événements ; renvoie une fonction de désabonnement
game.state;                    // état complet, objet JSON pur (lecture seule pour le reste du code)
game.serialize();              // copie JSON de l'état (sauvegarde)

// Actions : renvoient { ok: true, ... } ou { ok: false, reason: 'texte français lisible' }
game.actions.plant(plotIndex, cropId);
game.actions.water(plotIndex);
game.actions.harvest(plotIndex);
game.actions.unlockPlot(plotIndex);
game.actions.buyInvestment(investmentId);      // achat d'une unité ou du niveau suivant
game.actions.setSpeed(0 | 1 | 2 | 4);          // 0 = pause

// Requêtes d'affichage (pures)
game.query.plot(plotIndex);        // { unlocked, unlockCost, cropId, stage 0..4, progress 0..1, daysLeft, watered, mature, fatigue }
game.query.plantableCrops();       // cultures plantables aujourd'hui, avec prix courant
game.query.investments();          // [{ id, owned, max, nextCost, canBuy, reason }]
game.query.forecast();             // { today, tomorrow } météo
game.query.finance();              // { money, dailyIncome, dailyCharges, net, nextBill: { amount, daysLeft }, loan }
game.query.calendar();             // { day, dayOfSeason, seasonIndex, seasonId, seasonLength, dayProgress 0..1, totalDays }
```

### Événements émis

| Type | Données | Usage |
|---|---|---|
| `dawn` | `{ day, seasonId, weather, incomes: [{source, amount}], charges }` | textes flottants, coq, sauvegarde |
| `seasonStart` | `{ seasonId, seasonIndex }` | musique, décor |
| `seasonWarning` | `{ nextSeasonId, daysLeft, frost: bool }` | bandeau d'avertissement |
| `frost` | `{ lostPlots: [index] }` | message, son |
| `billPaid` | `{ amount, seasonId, summary }` | écran de fin de saison |
| `bankrupt` | `{ amountDue, money, summary }` | écran de faillite |
| `victory` | `{ money, stars, summary }` | écran de victoire |
| `planted` / `watered` / `harvested` | `{ plotIndex, cropId, amount? }` | sons, particules |
| `purchased` | `{ investmentId, owned }` | son, apparition dans la scène |
| `plotUnlocked` | `{ plotIndex }` | son |
| `weather` | `{ today, tomorrow }` | ambiance, particules |
| `rot` | `{ plotIndex, cropId }` | niveau pluvieux |
| `moneyChanged` | `{ money, delta }` | HUD |

`status` dans l'état : `'playing' | 'bankrupt' | 'victory'`. `update()` ne fait plus rien hors de `'playing'`.

### Précisions sur le contrat

- **Déroulé d'une journée** (détaillé en tête de `src/core/game.js`) : quand un jour s'achève, le fermage est payé s'il s'agit du dernier jour de la saison (sinon faillite), puis vient l'aube du jour suivant : pousse (d'après l'arrosage et la météo de la veille) → remise à zéro de l'arrosage → nouveau jour (`seasonStart`, `frost` au 1er jour d'hiver) → météo → maladie (`rot`) → la pluie arrose → marché → arrosage automatique → revenus → charges → prêt → `weather`, `dawn`, `moneyChanged`, puis `seasonWarning`. Un grand `dt` enchaîne plusieurs journées dans l'ordre ; tous les événements sont émis de façon synchrone, une fois l'état cohérent (un gestionnaire peut appeler des actions).
- Après le fermage d'hiver, `billPaid` est émis **puis** `victory`. En fin de partie, `state.time.elapsed` vaut `DAY_SECONDS` (soir du dernier jour) et `state.result` résume l'issue.
- `on('*', handler)` reçoit tous les événements, sous la forme `{ type, ...données }`.
- Champs en plus du contrat (compatibles) :
  - `dawn` : `chargesDetail: [{source: 'farm'|'water'|'loan', amount}]`, `sprinkled: [index]`, `net` ; chaque revenu a aussi `owned` et `kind: 'daily'|'shearing'` (tonte). `state.lastDawn` garde la dernière aube.
  - `planted` : `fatigue`, `watered` (semé sous la pluie) ; `watered` : `amount` = coût de l'arrosage ; `harvested` : `fatigue` ; `purchased` / `plotUnlocked` : `cost` ; `frost` : `lost: [{plotIndex, cropId}]` ; `bankrupt` : `seasonId`.
  - `summary` (billPaid / bankrupt / victory) : totaux de l'année `harvestIncome, investmentIncome, charges, waterSpent, loanPaid, rentsPaid, seedsSpent, investmentsSpent, plotsSpent, cropsPlanted, cropsHarvested {cropId: n}, cropsLost {frost, rot}, totalHarvested, net`, plus `season` (mêmes totaux pour la saison qui s'achève), `seasonId, day, startMoney, money, investments`, et `amount` / `amountDue` / `stars` selon l'événement.
  - `query.plot(i)` : aussi `index, col, row, cropName, willFreeze` (gèlera avant maturité), `harvestValue` (si mûre), `action: 'plant'|'water'|'harvest'|'unlock'|null` (effet d'un clic). `query.plots()` renvoie toutes les parcelles.
  - `query.plantableCrops(plotIndex?)` : `[{ id, name, seedCost, basePrice, marketMultiplier, sellPrice, profit, growDays, daysToMature, frostHardy, fatigue, willFreeze, canAfford }]` ; `sellPrice` = prix de récolte actuel (cours × étal, × fatigue du sol si `plotIndex` est donné).
  - `query.investments()` : aussi `name, description, kind ('unit'|'upgrade'), income` (saison en cours), `incomeBySeason, upkeep, effects` (`waterPlots` : `null` = toutes les parcelles).
  - `query.finance()` : `nextBill` a aussi `seasonId` (`daysLeft` = jours restant après aujourd'hui, 0 = ce soir) ; `loan` = `{ payment, every, nextInDays, paymentsLeft, remaining }` ou `null` ; aussi `priceBonus, waterCost`.
  - `query.calendar()` : aussi `seasonName, daysLeftInSeason`. `query.forecast()` renvoie des identifiants (`'sunny'`, `'rain'`…, noms dans `WEATHER_TYPES` de `balance.js`).
  - `query.level()` (données du niveau) et `query.summary()` (bilan à l'instant) ; `game.level` = données du niveau.
- `loadGame()` lève une erreur si l'objet est invalide, d'une autre version (`STATE_VERSION`), d'un niveau inconnu ou de structure incohérente (calendrier, météo, parcelles, investissements, marché, aléatoire, statistiques : vérifiés par `checkState`) ; l'interface efface alors la sauvegarde au lieu de proposer « Continuer ». `update(dt)` ignore un `dt` négatif, nul, `NaN` ou infini. Les données de niveau ne sont pas copiées dans la sauvegarde : elles sont relues dans `src/data/` au chargement.

## Interface (docs/MOBILE.md)

Mise en page : la scène (`#stage`, canvas) occupe **tout l'écran** ; par-dessus, `#hud` (barre du haut, 2 lignes, marges `safe-area`), `#tabbar` (onglets en bas, ≥ 56 px) et `#sheet-layer` (feuilles du bas). `main.js` mesure la barre du haut et les onglets (ResizeObserver, `offsetHeight`) et appelle `scene.setInsets({ top, bottom, left, right })` ; la hauteur utile vient de `visualViewport` (variable CSS `--app-h`, barre d'adresse de Chrome Android). Variables CSS publiées : `--inset-top`, `--inset-bottom`, `--sheet-h` (hauteur de la feuille ouverte : les messages se placent au-dessus).

- **Portrait (téléphone)** : disposition par défaut. Téléphone tenu à l'horizontale (écran tactile, hauteur < 520 px) : `body.is-rotated`, écran « Tournez votre téléphone », partie en pause (raison `rotate`).
- **Grand écran en paysage** (largeur ≥ 900 px et plus large que haut) : `body.layout-wide` ; les onglets sont déplacés dans la barre du haut, les feuilles « Acheter » / « Bilan » (et les fiches) se rangent à droite sans fond (`insets.right` transmis à la scène) ; souris : survol = infobulle, clic = action, molette = défilement ; clavier : Espace, 1/2/3, B (acheter), N (bilan), F (ferme), M (son), Échap, 1..9 dans les graines.
- **Feuilles du bas** (`sheets.js`) : une seule à la fois (`app.sheets.open({ id, title, icon, content, kind: 'panel'|'popup', tall })`), fermeture par ✕, glissement vers le bas (poignée, en-tête, ou contenu déjà en haut), toucher sur le fond (ce toucher ne fait rien d'autre), Échap. Les fiches de parcelle / bâtiment / barre du haut ne sont reconstruites que si leur contenu change (un toucher en cours ne tombe jamais sur un bouton remplacé). **La parcelle touchée reste visible** : `main.js` passe la hauteur de la feuille à `scene.setOverlay(px)` (la scène peut alors défiler au-delà du bas du monde, dans la forêt) puis appelle `scene.focusPlot(i, { animate: true })` (défilement animé) ; à la fermeture (`setOverlay(0)`), la vue revient en douceur là où elle était. Une feuille « popup » laisse toujours ~150 px de scène au-dessus d'elle. Le tutoriel fait de même pour la parcelle entourée.
- **Champ en portrait** (`layout-portrait.js`, `placeVisualCells`) : les index des parcelles sont ceux du cœur ; seule leur case à l'écran change. Les parcelles ouvertes au départ forment un bloc compact centré (4 × 3 au niveau 1, dans l'ordre de lecture du cœur), les parcelles à acheter l'entourent : herbe plus sombre, pointillés clairs, et une pièce (« à vendre ») sur celles qui touchent le potager ouvert.
- **Messages** (`toasts.js`) : au-dessus des onglets et de la feuille ouverte, jamais sur la barre du haut ; ils ne captent pas les touchers (sauf ceux qui proposent une action, ex. « Nouvelle version… »). Le **bandeau** (titre du niveau, saison, avertissements) se pose sous la barre du haut, en dessous d'elle et des feuilles (z-index), et s'efface dès qu'une bulle ou un rappel du tutoriel s'affiche en haut (`toasts.hideBanner()`).
- **Fenêtres** (`dialogs.js`) : en portrait, hautes feuilles qui montent du bas (ruban de titre, ✕ à sa droite, boutons pleine largeur en bas, défilement interne) ; fermables aussi par glissement et par un toucher sur le fond sombre ; centrées sur grand écran.
- **Politique des gestes** (`gestures.js`) : toucher bref sur une parcelle = action immédiate selon son état (vide → graines ; semée non arrosée → arroser ; mûre → récolter ; friche → ouvrir ; déjà arrosée → fiche) ; toucher un bâtiment → sa fiche ; appui long (450 ms) → fiche de la parcelle ou du bâtiment ; glisser en partant d'une parcelle → arroser / récolter en série (le trajet est échantillonné) ; glisser ailleurs → `scene.scrollBy` puis `scene.fling` (élan) ; deuxième doigt → geste annulé. Cible tolérante : `scene.hitTest(x, y, { touch: true })`. Le bandeau de saison ne capte pas les touchers.
- **Règles tactiles** : cibles ≥ 48 × 48 px, texte ≥ 14 px (12 px pour les mentions secondaires), argent 20 px, `touch-action: manipulation` partout (none sur le canvas), pas de sélection ni de menu contextuel, `overscroll-behavior: none`, `user-scalable=no`, retour `:active`, vibration courte optionnelle (`app.vibrate`, option « Vibrer au toucher »).
- **Application** : `src/pwa.js` (service worker, mise à jour → message « Nouvelle version disponible », installation → bouton « Installer le jeu » du menu et des options, écran allumé pendant la partie → option « Garder l'écran allumé », orientation portrait dans l'appli installée). Arrière-plan : sauvegarde, menu de pause, audio suspendu (repris au retour ou au prochain toucher). **Chargeur et garde-fou de démarrage** (`src/loader.js`, recopié dans `index.html`) : voir « Construction et publication ». `main.js` lui transmet sa progression (`window.__bootProgress(0..1)`), `window.__bootOk()` (écran « Prêt ! ») ou `window.__bootFail(err)`. Bouton « Réparer le jeu (vider le cache) » des options → `pwa.repairApp()` → `window.__repairGame()` ; le localStorage (progression, partie) est gardé.
- **Contenu v3 (lot UI)** : `src/ui/v3.js` charge au démarrage les modules v3 du cœur (progression, bonus, succès, cosmétiques, produits) par import dynamique (inclus dans le paquet par esbuild) ; `src/ui/progress.js` (`app.progression`) tient la progression courante (lecture / écriture par `storage.js`, logique dans `progression.js`) : bonus, succès (vérifiés à chaque aube et après achat / récolte, annoncés par un message doré), fin de partie (`recordRunEnd` : victoire, faillite, abandon par « Recommencer » ou nouvelle partie par-dessus une sauvegarde), écus, cosmétiques, conseils vus. `createGame({ perks: app.progression.runPerks() })`. Chaque appel au cœur v3 est vérifié (`typeof … === 'function'`) : sans lui, l'interface reste celle de la v2.
  - `grange.js` : fenêtre « La grange » (onglets segmentés Bonus · Succès · Ma ferme), depuis le menu principal (pastille dorée : étoile à dépenser ou succès pas encore vu — mémoire d'interface `une-annee-a-la-ferme.ui`), la fin d'année (`app.openGrangeFromEnd`) et le choix du niveau.
  - `buildings.js` : fiche d'un atelier (`app.field.openBuilding(id)`, ouverte aussi par le toucher du bâtiment) et lignes de recette partagées avec les cartes « Acheter » (sections quand le niveau propose un atelier).
  - `decor.js` : mode décoration (`app.decor.enter({ fromMenu })`, pause `decor`, `body.in-decor`, barre `#decorbar` à la place des onglets, `scene.setDecorMode(true)`) ; `gestures.js` n'y transmet que les cibles `decorSlot` / `sign` / `farmer` à `app.decor.onHit` ; feuilles d'emplacement, nom de la ferme (validation française, 18 caractères), tenue, allées, clôture ; `app.applyCosmetics()` → `scene.setCosmetics(...)` à chaque changement et à chaque création de scène.
  - `hints.js` : conseils « première fois » (couche `#hints` au-dessus des fenêtres, bulle du tutoriel réutilisée, pause `hint`, file d'attente ; au menu seulement sur le menu principal).
  - Fin de journée : `contestAwarded` → fenêtre de remise des prix, puis bilan de saison ; messages groupés par image (récoltes parties à l'atelier, produits vendus à l'aube).
- **Débogage** (`?debug=1`) : `__debug.plotPoint(i)`, `investmentPoint(id)`, `skipDays(n)`, `start(id)`, `insets()`, `progress()`, `setProgress(p)`, `grange(tab)`, `decor()` ; `?nosw` : sans service worker ; `?debug=1&autostart` : passe l'écran « Commencer » ; `dev.html` : modules non empaquetés.

## Règles de code

- `src/core` et `src/data` n'importent jamais le DOM ni `window` ; tout l'aléatoire passe par `rng.js` (graine dans l'état → parties reproductibles, tests déterministes).
- L'état est **uniquement** modifié par `game.update()` et `game.actions.*`.
- Les textes affichés au joueur sont en français ; les identifiants (`carrot`, `chickenCoop`…) en anglais.
- Rendu pixel art : `imageSmoothingEnabled = false`, zoom entier, canvas redimensionné à la fenêtre.
- Chemins relatifs uniquement (le jeu doit fonctionner dans un sous-dossier, ex. GitHub Pages).

---

## v3 — Contrats pour les trois lots (CORE · UI · RENDER)

> Conception : `docs/GAME_DESIGN.md` § 12. Ce qui suit fixe les **noms, formes et comportements** que les trois lots se promettent, pour travailler en parallèle. Tout ajout est **compatible** avec le contrat v2 ci-dessus (rien n'est retiré ni renommé). Tant que CORE n'a pas livré, UI et RENDER peuvent simuler ces requêtes avec des objets factices de la même forme.

### Nouveaux fichiers

```
src/data/products.js       recettes de transformation (PRODUCTS, getProduct, productsFor(buildingId, level))
src/data/perks.js          bonus permanents (PERKS, PERK_TIERS, getPerk)
src/data/achievements.js   succès (ACHIEVEMENTS, getAchievement) : conditions en données
src/data/cosmetics.js      décorations, allées, clôtures, tenues (COSMETICS, DECOR_SLOTS, DEFAULT_COSMETICS, DEFAULT_FARM_NAME, FARM_NAME_MAX)
src/core/trees.js          pommiers : croissance, fruits, dormance, récolte, arrachage
src/core/processing.js     ateliers : places, entrée des récoltes et du lait, avancement, ventes, vente en l'état
src/core/perks.js          lecture des bonus d'une partie : perkValue(state, key)
src/core/contest.js        concours du niveau 12 : progression des épreuves, remise des prix
src/core/progression.js    progression permanente PURE (étoiles, bonus, succès, écus, cosmétiques, cumuls)
src/ui/grange.js           « La grange aux souvenirs » (onglets Bonus · Succès · Ma ferme)
src/ui/decor.js            mode décoration (barre, feuilles d'emplacement, nom, tenue)
src/ui/hints.js            conseils « première fois » (bulle + « Compris »)
src/ui/buildings.js        fiche d'un atelier (interrupteur, places, vendre en l'état)
tools/capture-parity.js    capture des résultats v2 (niveaux 1 à 8) avant toute modification du cœur
tests/fixtures/parity-v2.json, tests/parity.test.js, tests/trees.test.js, tests/processing.test.js,
tests/perks.test.js, tests/contest.test.js, tests/progression.test.js, tests/migration.test.js
```

### Données (formes exactes)

**Cultures** (`crops.js`) — nouveaux champs facultatifs (absents = comportement v2) :

```js
{ id, name, seasons, growDays, seedCost, sellPrice, frostHardy,
  kind: 'crop' | 'tree',            // défaut 'crop'
  dryGrowth: 1,                     // pomme de terre : pousse non arrosée (défaut GROWTH.dry = 0.5)
  dryHeatwaveGrowth: 0.5,           // pomme de terre : pousse non arrosée en canicule (défaut 0)
  // arbres seulement :
  fruitDays: 3, fruitSeasons: ['summer', 'autumn'], needsWater: false }
export const BASE_CROPS = ['carrot','turnip','wheat','cabbage','tomato','corn','sunflower'];
export const NEW_CROPS  = ['potato','strawberry','zucchini','pumpkin','apple'];
```

Ordre de `CROPS` : les 7 d'origine d'abord, puis `potato, strawberry, zucchini, pumpkin, apple`.

**Investissements** (`investments.js`) — `ALL_INVESTMENTS` de `levels.js` reste la liste des 8 d'origine (niveaux 1 à 8). Ajouts :

```js
category: 'animal' | 'crop' | 'processing' | 'utility'   // pour les sections de l'onglet Acheter
effects.milk: true                                         // vache (sans autre changement), chèvre
effects.processing: { places: [2, 3, 4], source: 'harvest' | 'animal' }
requiresAny: ['cow', 'goat']                               // fromagerie : au moins un des deux possédé
// nouveaux ids : 'goat' (unit), 'jamWorkshop', 'dairy', 'mill' (upgrade)
```

**Produits** (`products.js`) :

```js
{ id: 'strawberryJam', name: 'Confiture de fraises', building: 'jamWorkshop', source: 'harvest', input: 'strawberry', days: 2, value: 46 }
{ id: 'appleJuice',    name: 'Jus de pomme',         building: 'jamWorkshop', source: 'harvest', input: 'apple',      days: 1, value: 44 }
{ id: 'cowCheese',     name: 'Fromage de vache',     building: 'dairy',       source: 'animal',  input: 'cow',        days: 2, value: 30 }
{ id: 'goatCheese',    name: 'Fromage de chèvre',    building: 'dairy',       source: 'animal',  input: 'goat',       days: 2, value: 20 }
{ id: 'flour',         name: 'Farine',               building: 'mill',        source: 'harvest', input: 'wheat',      days: 1, value: 28, maxLevel: 2 }
{ id: 'bread',         name: 'Pain',                 building: 'mill',        source: 'harvest', input: 'wheat',      days: 2, value: 44, minLevel: 3 }
// recipeFor(buildingId, buildingLevel, input) → produit actif ou null
```

**Niveaux** (`levels.js`) — `crops` devient une liste explicite partout (`BASE_CROPS` pour 1 à 8). Nouveaux champs, avec défauts dans `level()` / `BASE_MODIFIERS` : `startTrees: []`, `contest: null`, `modifiers.rawPriceFactor: 1`, `modifiers.pollination: false`. Concours :

```js
contest: { deadlineDay: 21, prizePerGoal: 120, bonusAll: 120, goals: [
  { id: 'pumpkins', label: 'Citrouilles géantes', type: 'harvest', cropId: 'pumpkin', target: 6 },
  { id: 'terroir',  label: 'Étal du terroir',     type: 'productsSold', target: 12 },
  { id: 'cheese',   label: 'Fromage de la ferme', type: 'productsSold', productIds: ['cowCheese', 'goatCheese'], target: 3 } ] }
```

**Bonus** (`perks.js`) :

```js
PERK_TIERS = [{ tier: 1, starsRequired: 0 }, { tier: 2, starsRequired: 8 }, { tier: 3, starsRequired: 18 }];
{ id, name, description, tier, costs: [2, 3] /* un prix par rang */, effect: { key, values: [15, 30] /* par rang */ } }
// clés d'effet (valeurs équilibrées : voir src/data/perks.js) : forecastDays (almanac: 1), startMoney (10/15), seedFactor (0.95), springRentFactor (0.95),
// growthBonus (0.05), investmentFactor (0.95), plotDiscount (5), upkeepReduction (1), productBonus (0.05),
// priceBonus (0.03), extraPlaces (1), treeDiscount (10), treeGrowReduction (2), frostRefund (true), extraCrops (NEW_CROPS)
```

**Succès** (`achievements.js`) : `{ id, name, description, reward: { stars: 0|1, ecus }, check: { type, ...params } }`. Types de condition (évalués dans `progression.js`) : `lifetimeHarvests {n}`, `lifetimeCropSet {cropIds}`, `seasonHarvestIncome {n}`, `winNoLoss {minLevel}`, `yearHarvest {cropId, n}`, `adultTrees {n}`, `owned {id, n}`, `ownedTogether {ids}`, `ownAllInLevel`, `zeroCharges`, `lifetimeProducts {n}`, `anyProductSold {productIds?}`, `yearProducts {productIds, n}`, `levelsWon {ids}`, `threeStars {n}`, `threeStarsAll`, `yearEndMoney {n}`, `closeCall {n}`, `purist {minLevel}`, `winNoInvestment {minLevel}`, `decorationsPlaced {n}`.

**Cosmétiques** (`cosmetics.js`) : `{ id, name, category: 'small'|'large'|'path'|'fence'|'outfit', price, isDefault? }` ; `DECOR_SLOTS = [{ id: 'porch.left', name: 'Devant la maison, à gauche', kind: 'small' }, …, { id: 'pond', kind: 'large' }]` (ids du § 12.7 de la conception) ; `DEFAULT_COSMETICS = { farmName: 'Ferme des Tilleuls', outfit: 'outfit.classic', path: 'path.dirt', fence: 'fence.wood', decor: {}, owned: ['outfit.classic','path.dirt','fence.wood'] }`.

### État de partie v2 (`STATE_VERSION = 2`)

```js
state.perks = { [perkId]: rank }            // copiés au lancement ; {} = aucun bonus (jeu v2)
state.plots[i].fruit = 0                    // arbres : jours de fruits accumulés (0 pour une culture)
state.plots[i].insured = false              // « Assurance gel » : semée à temps (voir « Écarts du lot CORE »)
                                            // arbre : cropId 'apple', growth = maturité de l'arbre (0 → growDays effectif)
state.processing = {                        // une entrée par atelier possédé (créée au 1er achat, on: true)
  [buildingId]: { on: true, places: [ null | { productId, input, source: 'harvest'|'animal',
                                              daysLeft, rawValue, yieldFactor } ] } }
                                            // places.length = capacité (niveau + bonus Artisan) ; amélioration → nulls ajoutés
state.contest = null | { awarded: false, result: null | { goalsMet: [goalId], amount } }
stats (year et season), nouveaux champs : productIncome, productsSold: { [productId]: n }, rawSales,
  frostRefund, contestPrize, minMoneyAfterRent (null tant qu'aucun fermage payé)
```

- `buildSummary().net` inclut `productIncome + rawSales + frostRefund + contestPrize`.
- Parité : avec `perks = {}` sur un niveau 1 à 8, aucune nouvelle règle ne s'applique et **aucun tirage aléatoire** supplémentaire n'est fait (pas de nouveau flux ; l'almanach lit la météo d'après-demain en tirant sur une **copie** du flux `weather` avec la saison du jour + 2, sans modifier `state.rng`).
- `loadGame()` : `migrateState(saved)` transforme une v1 en v2 (champs ci-dessus à leurs valeurs vides) ; `checkState` vérifie aussi `perks` (ids et rangs connus), `fruit`, `processing` (bâtiments possédés, places ≤ capacité, produits connus), `contest`.

### createGame

```js
createGame({ levelId, seed, perks = {}, difficulty = 'detente' })
  // perks : progression.runPerks(progress) ({} si l'interrupteur est éteint)
  // difficulty : progression.runDifficulty(progress) — 'detente' | 'classique' (voir « Modes de difficulté »)
```

Effets appliqués à la création : argent de départ + `startMoney` ; pommiers de `level.startTrees` plantés adultes ; `state.processing = {}`, `state.contest` si le niveau en a un. Liste des cultures de la partie : `level.crops` (+ `NEW_CROPS` avec `seedMerchant`, dans l'ordre de `CROPS`).

### Actions (ajouts)

```js
game.actions.plant(i, 'apple')           // pommier : coût seedCost − treeDiscount ; saisons de plantation ; pas en hiver
game.actions.harvest(i)                  // → { ok, amount, cropId, tree: bool,
                                         //     processed: null | { buildingId, productId, placeIndex } }
                                         //   amount = 0 si la récolte part à l'atelier
game.actions.removeTree(i)               // → { ok } ; parcelle vidée, lastHarvested = null
game.actions.setProcessing(buildingId, on)   // → { ok, on }
game.actions.sellProcessing(buildingId)  // → { ok, amount, count } ; vend les places au prix brut
game.actions.water(i)                    // arbre : refus « Le pommier n'a pas besoin d'eau. » ;
                                         // pomme de terre hors canicule : refus « Pas besoin : elle pousse sans arrosage. »
```

### Requêtes (ajouts)

```js
game.query.plot(i) → { ...v2,
  kind: 'crop' | 'tree' | null,
  tree: null | { stage: 'sapling'|'young'|'adult', growth, growDays, adultInDays,
                 fruit, fruitDays, fruitReady, fruitDaysLeft, fruitStage: 0..3,
                 dormant /* hiver */, blossom /* printemps, adulte */, harvestsLeftEstimate },
  needsWater,                         // false pour arbre et pomme de terre hors canicule
  processTarget: null | { buildingId, productId, productName, value, hasRoom } }
  // action : arbre → 'harvest' si fruitReady, sinon null ; stage 0..4 reste défini pour les cultures
game.query.plantableCrops(i?) → [{ ...v2, kind, seedCost /* après bonus */,
  product: null | { buildingId, productId, name, value, days, owned /* atelier possédé */ },
  tree: null | { fruitDays, fruitSeasons, basketPrice, harvestsBeforeYearEnd },
  noWater /* pomme de terre */, sowAll /* false pour l'arbre */ }]
game.query.investments() → [{ ...v2, category, nextCost /* après Marchandage */, requiresAny,
  processing: null | { level, places, nextPlaces, on, used, recipes: [{ input, inputName, productId, productName, days, value, active }] } }]
game.query.processing() → [{ buildingId, name, level, on, capacity,
  places: [null | { productId, productName, input, daysLeft, days, value /* vente prévue */, rawValue }],
  value /* somme des ventes prévues */, rawValue /* somme en l'état */ }]
game.query.contest() → null | { deadlineDay, daysLeft, awarded, prizePerGoal, bonusAll,
  goals: [{ id, label, target, progress, done }], potentialPrize }
game.query.perks() → [{ id, name, rank, description }]          // bonus de cette partie
game.query.forecast() → { today, tomorrow, afterTomorrow /* null sans Almanach */ }
game.query.finance() → { ...v2, processingValue, processingRawValue, rentAutoSell /* true si le filet de sécurité vendra ce soir */ }
game.query.achievementContext() → { levelId, status, day, seasonId, money, perksActive, stats: { year, season },
  investments, availableInvestments, adultTrees, dailyCharges }
```

### Événements (ajouts)

| Type | Données |
|---|---|
| `harvested` | v2 + `tree: bool`, `processed: null \| { buildingId, productId, placeIndex }` |
| `processingStarted` | `{ buildingId, placeIndex, productId, input, source: 'harvest'\|'animal', plotIndex? }` |
| `productSold` | `{ buildingId, productId, amount, placeIndex }` (aube, étape 8) |
| `processingSoldRaw` | `{ buildingId, amount, count, reason: 'player'\|'rent'\|'yearEnd' }` |
| `processingToggled` | `{ buildingId, on }` |
| `treeRemoved` | `{ plotIndex }` |
| `contestProgress` | `{ goalId, progress, target, done }` (à chaque changement) |
| `contestAwarded` | `{ amount, goalsMet: [goalId], goals }` (soir du jour limite, avant le fermage) |
| `frost` | v2 + `refund` (Assurance gel, 0 sinon) |
| `rot` | v2 + `tree: bool` (pommes mûres perdues, l'arbre reste) |
| `dawn` | `incomes[].kind` : `'daily' \| 'shearing' \| 'processed' \| 'refund'` ; `processed` porte `productId` ; le lait parti à la fromagerie **n'apparaît pas** dans les revenus (`milkToDairy: [{ animalId, count }]` en plus) |
| `purchased` | v2 ; pour un atelier, `state.processing[id]` existe déjà quand l'événement part |

Ordre de l'aube et de la fin de journée : § 12.2 de la conception (`src/core/game.js` met à jour son en-tête).

### Progression permanente (`src/core/progression.js`, pur, testé sous Node)

Objet de progression (sérialisé tel quel par `storage.js`, clé `une-annee-a-la-ferme.progress`) :

```js
{ schema: 2,
  levels: { [id]: { stars, bestMoney, completed, played } },
  perks: { [perkId]: rank }, perksEnabled: true,
  achievements: { [id]: { at /* horodatage */ } },
  lifetime: { harvests, cropsHarvested: { [cropId]: n }, productsSold: { [productId]: n },
              yearsWon, yearsLost, rentsPaid },
  ecus: 0,
  cosmetics: { farmName, outfit, path, fence, decor: { [slotId]: itemId }, owned: [itemId] },
  hintsSeen: [hintId] }
```

```js
PROGRESS_SCHEMA = 2
normalizeProgress(raw) → progress            // v1 → v2, champs abîmés → défauts, références inconnues ignorées
starsEarned(p) / starsSpent(p) / starsAvailable(p)
perkList(p) → [{ id, name, description, tier, rank, maxRank, nextCost, unlocked, canBuy, reason }]
buyPerk(p, perkId) → { ok, progress } | { ok: false, reason }        // renvoie un NOUVEL objet
refundPerks(p) → progress
setPerksEnabled(p, bool) → progress
runPerks(p) → { [perkId]: rank }               // {} si perksEnabled est faux
isLevelUnlocked(p, levelId) → bool             // 1 toujours ; n si n − 1 terminé
checkAchievements(p, ctx | null) → [achievementId]   // nouveaux succès remplis (ctx = query.achievementContext(), + runStats)
unlockAchievements(p, ids) → { progress, rewards: { stars, ecus } }
achievementList(p, ctx | null) → [{ id, name, description, reward, done, at, progress: null | { value, target } }]
recordRunEnd(p, { levelId, outcome: 'victory'|'bankrupt'|'abandon', stars, money, summary, perksActive })
  → { progress, rewards: { ecus, newStars, newBest, firstTime }, achievements: [id] }
  // met à jour levels, lifetime (cumul de la partie), écus, puis évalue et débloque les succès
buyCosmetic(p, itemId) → { ok, progress } | { ok: false, reason }
placeDecor(p, slotId, itemId | null) → { ok, progress } | { ok: false, reason }   // objet possédé et du bon type
setPath(p, itemId) / setFence(p, itemId) / setOutfit(p, itemId) → { ok, progress }
setFarmName(p, text) → progress                // espaces retirés, 1..18 caractères, sinon nom par défaut
markHint(p, hintId) → progress
ecusForRun({ outcome, stars, money }) → n      // 10 + 5 × étoiles + min(20, ⌊money/100⌋) ; faillite 3 ; abandon 0
```

`storage.js` : `loadProgress()` → `normalizeProgress(read())` ; `saveProgress(p)` ; `isLevelUnlocked` devient une enveloppe de `progression.js` ; `resetProgress()` inchangé (tout effacer). (`recordVictory` a été retiré à l'intégration : il ne comptait ni les cumuls ni les succès ; toute fin de partie passe par `progression.recordRunEnd`, via `src/ui/progress.js`.)

### Écarts et ajouts du lot CORE (livré le 2026-09-30)

Tout est **compatible** avec le contrat ci-dessus (ajouts seulement), sauf les deux points marqués ⚠.

- ⚠ **« Ferme économe »** (`frugal`) : clé d'effet `upkeepReduction` (1) au lieu de `farmChargeReduction` — elle réduit l'**entretien des animaux et bâtiments** (jamais en dessous de 0), plus les 5 pièces de la ferme (réglage : le robot insouciant, sans investissement, n'en profitait qu'à lui seul).
- ⚠ **« Assurance gel »** : ne rembourse que les cultures **semées à temps** (elles avaient le temps de mûrir avant le gel au moment du semis). Nouveau champ de parcelle `state.plots[i].insured` (booléen, `false` partout sans le bonus ; remis à `false` quand la parcelle se vide ; migration v1 → `false`).
- **Semencier** : sans effet aux niveaux 9 à 12 (nouveau champ de niveau `seedMerchant`, `true` par défaut, `false` pour 9 à 12). La liste des cultures d'une partie : `gameCrops(level, perks)` de `src/core/perks.js` (l'interface devrait l'utiliser plutôt que `level.crops` + `NEW_CROPS`).
- **Arboriste** : deux effets ; `effect` = `treeDiscount`, et `extraEffects: [{ key: 'treeGrowReduction', values: [2] }]` (`perkEffects(perk)` renvoie les deux).
- **Statistiques** : aussi `bestSeasonHarvestIncome` (meilleures ventes de récoltes d'une saison de l'année ; succès « Saison dorée », qui sinon se perdrait au changement de saison).
- **Requêtes** : `plot(i).processTarget.on` ; `plot(i)` d'un arbre : `stage` 1 (jeune plant), 2 (jeune arbre), 3 (adulte), 4 (pommes mûres), `daysLeft` = `tree.fruitDaysLeft` (`null` : plus de pommes d'ici la fin de l'année) ; `plantableCrops()` : pour l'arbre, `daysToMature` = jours avant le premier panier (`null` s'il n'y en aura pas), `growDays` = jours pour être adulte (après « Arboriste »), `profit` = paniers attendus × prix − plant, `tree.adultInDays` ; `investments()[].processing.recipes[].minLevel` ; `contest().result` ; `achievementContext().stars`.
- **Actions** : `sellProcessing` sur un atelier vide → `{ ok: false, reason: 'Rien à vendre : l'atelier est vide.' }` ; `removeTree` sur une parcelle sans arbre → `{ ok: false, reason: "Il n'y a pas d'arbre ici." }`.
- **Sauvegarde** : `migrateState` est exporté par `game.js` ; une sauvegarde v1 d'un niveau > 8 est refusée.
- **Progression** : en plus, `defaultProgress()`, `migrateProgress(raw, now?) → { progress, retroactive, rewards, migrated }`, `cleanFarmName(text)` ; les fonctions qui horodatent (`unlockAchievements`, `recordRunEnd`) acceptent un dernier argument `now`. `recordRunEnd(...).rewards` a aussi `achievementStars` et `achievementEcus`. `run` accepte aussi `adultTrees`, `investments`, `availableInvestments`, `dailyCharges` (sinon ces succès se vérifient à l'aube). **Ne pas** passer à `checkAchievements` le contexte d'une partie déjà enregistrée par `recordRunEnd` (ses chiffres seraient comptés deux fois dans les cumuls).
- **Intégration (UI)** : `src/ui/progress.js` — `checkGame(game)` ne passe le contexte d'une partie à `checkAchievements` que si elle est **en cours** (`status === 'playing'`) ; une partie terminée (déjà comptée par `recordRunEnd`) ou l'absence de partie → vérification sur la progression seule (ctx `null`, ex. « Jolie ferme » en quittant le mode décoration depuis le menu). `checkBoot()` renvoie aussi les succès de `storage.progressMigration()` (message « N succès débloqués grâce à vos anciennes parties »). Mode décoration : `app.revealDecorSlot(id, sheetId)` (`main.js`) appelle `scene.focusDecorSlot` après `setOverlay` pour garder l'emplacement, le panneau ou le fermier visible au-dessus de sa feuille ; `app.revealInvestment(id, sheetId)` fait de même pour la fiche d'un bâtiment avec `scene.focusRect(rect)` (rectangle en px du monde, ajouté à la scène). Icônes : `icons.js` utilise `productSprite`, `decorSprite` et `outfitSprite` de l'atlas.
- **storage.js** : `loadProgress()` d'une progression v1 la migre, débloque les succès des anciennes parties, l'enregistre ; `progressMigration()` renvoie une seule fois `{ retroactive: [id], rewards }` pour le message « 3 succès débloqués grâce à vos anciennes parties » (sinon `null`).
- **Simulation** : `tools/simulate.js` exporte `playOne(levelId, seed, strategy, perks)`, `simulate()`, `resolvePerks()` ; options `--perks`, `--compare-perks`, `--levels a-b`. `tools/capture-parity.js` : `--check` (parité), `--v1-saves <dossier du code v2>` (sauvegardes v1 réelles pour `tests/migration.test.js`).

### Contrat du rendu (lot RENDER)

- **Dispositions** (`layout-portrait.js`, `layout.js`) : nouveaux emplacements d'investissement `goat`, `dairy`, `jamWorkshop`, `mill` (même forme que les autres : zone, `sign`, `investmentRect`, `investmentAnchor`, présence selon `level.availableInvestments`, bande retirée si absente). En portrait : bande « chèvres + fromagerie » sous le pré des vaches, bande « ateliers » (atelier de confitures à gauche, moulin à droite, 4 tuiles de haut) entre le champ et la maison ; en paysage, le monde peut grandir en hauteur si les nouveaux bâtiments ne tiennent pas dans 32 × 20.
- `layout.decorSlots = [{ id, kind: 'small'|'large'|'sign', x, y, w, h }]` (px du monde) avec les ids de `DECOR_SLOTS` ; un emplacement sans place dans un niveau est simplement absent.
- **Scène** (ajouts à `createScene`) :

```js
scene.setCosmetics({ farmName, outfit, path, fence, decor })   // relu à chaque changement ; redessine les couches en cache
scene.setDecorMode(on)                  // repères « + » sur les emplacements, fermier et panneau touchables
scene.hitTest(x, y, opts) → v2 | { type: 'decorSlot', id } | { type: 'sign' } | { type: 'farmer' }   // ces 3 types seulement en mode décoration
scene.onEvent('harvested' { processed }) // vol de l'icône du produit de la parcelle vers le bâtiment
scene.onEvent('productSold')             // « +46 » au-dessus du bâtiment
```

- La scène lit `game.state.plots` (arbres : `cropId === 'apple'`, `growth`, `fruit`) et `game.query.processing()` (places occupées, `on`) ; elle ne modifie rien. Arbre : sprite choisi par étape (`sapling`/`young`/`adult`) et saison (`blossom` printemps, `summer`, `autumn`, `bare` hiver) ; fruits dessinés à partir de `fruitStage ≥ 2`.
- **Noms de sprites** (atlas) : `crop.<id>.<0..4>`, `crop.<id>.icon`, `seed.<id>` ; `tree.apple.<sapling|young>`, `tree.apple.adult.<spring|summer|autumn|winter>`, `tree.apple.fruit` ; `goat` (+ variantes d'animation comme `sheep`) ; `product.<productId>` (le fromage de chèvre peut réutiliser la meule, teintée) ; `building.<jamWorkshop|dairy|mill>` ; `decor.<itemId>` ; `fence.<picket|stone|hedge>.*`, `path.stone.*` ; `farmer.<outfitId>.*` ; `icon.perk.<id>`, `icon.ach.<id>`. L'UI les obtient par `sprite(name)` / `spriteURL(name)` d'`icons.js` (déjà en place) : RENDER fournit l'atlas, UI ne dessine rien elle-même.
- Le nom de la ferme est écrit sur le panneau avec la police « Ferme », à l'échelle entière, tronqué avec « … » s'il ne tient pas.

### Découpage et frontières

| Lot | Possède (seul à modifier) | Livre aux autres | Attend des autres |
|---|---|---|---|
| **CORE** | `src/data/*`, `src/core/*`, `src/storage.js`, `tests/*`, `tools/simulate.js`, `tools/capture-parity.js` | données, actions, requêtes, événements et `progression.js` ci-dessus ; tableaux chiffrés du § 12 mis à jour après équilibrage | rien (commence par la capture de parité) |
| **UI** | `src/ui/*`, `css/style.css`, `src/main.js`, `src/index.template.html` | appels `scene.setCosmetics`, `setDecorMode`, gestion des nouveaux `hitTest` | CORE : API ci-dessus ; RENDER : sprites et API de scène ci-dessus (factices en attendant) |
| **RENDER** | `src/render/*`, `assets/sprites/*` (intégration), `tools/atlas-preview.html` | atlas, dispositions, scène | CORE : forme de `state.plots`, `query.processing()`, ids ; agent graphique : planches |

Règles communes : aucun lot ne modifie les fichiers d'un autre (une demande passe par le chef de projet) ; `index.html`, `dev.html`, `dist/` restent générés (`node tools/build.js`) ; textes du jeu en français, identifiants en anglais ; `node --test tests/` vert à chaque livraison.

## Modes de difficulté et prêt du voisin (rééquilibrage « détente », 2026-09-30)

Retour du joueur : faillite quasi inévitable dès le niveau 1, au premier fermage, en jouant tranquillement
à ×1. Tout l'équilibrage avait été fait avec des robots qui arrosent, récoltent et replantent chaque parcelle
chaque jour. Le jeu a désormais deux modes ; les règles et les chiffres sont dans `docs/GAME_DESIGN.md` § 13.

### Données (`src/data/difficulty.js`, pur)

```js
DIFFICULTY_IDS = ['detente', 'classique']
DEFAULT_DIFFICULTY = 'detente'          // nouvelles parties
LEGACY_DIFFICULTY = 'classique'         // parties sauvegardées avant les modes
DIFFICULTIES[id] = { id, name, short, description, dailyCharge, cropPriceFactor, dryGrowth, dryHeatwaveGrowth,
                     neighbourLoan: null | { maxShare, minCover, surcharge, repayShare, cushion },
                     levels: { [levelId]: { startMoney, rents, starThresholds, modifiers?, description? } } }
isDifficulty(id) / getDifficulty(id)
levelFor(levelId, difficulty = 'detente') → niveau du mode (même objet à chaque appel ; null si inconnu)
levelsFor(difficulty) → les 12 niveaux du mode (sélection des niveaux : fermages, départ, seuils d'étoiles)
```

- `getLevel(id)` (`src/data/levels.js`) renvoie toujours les données **classiques** ; chaque niveau y porte aussi
  `difficulty: 'classique'`, `dailyCharge: 5`, `cropPriceFactor: 1`, `dryGrowth: 0.5`, `dryHeatwaveGrowth: 0`,
  `neighbourLoan: null`. Le cœur lit ces champs sur le niveau de la partie (`levelFor`), jamais les constantes.
- Un mode ne change que des nombres : cultures, investissements, grille, saisons, météo et contraintes
  (`modifiers`) restent ceux du niveau (seule exception : la mensualité du crédit du niveau 7, avec sa description).

### État et sauvegarde

```js
state.difficulty = 'detente' | 'classique'
state.neighbourLoan = null /* classique */ | { debt, borrowed, repaid, forgiven, loans }
  // debt : reste dû (supplément compris) ; borrowed : total prêté ; repaid : total remboursé ;
  // forgiven : effacé en fin d'année ; loans : nombre de prêts reçus
```

- `STATE_VERSION` reste **2** (champs ajoutés). `migrateState` : sauvegarde sans `difficulty` (v1, ou v2 d'avant
  les modes) → `'classique'` et `neighbourLoan: null` — une partie en cours garde les règles avec lesquelles elle
  a commencé. `checkState` refuse un mode inconnu, un prêt abîmé, un prêt en classique ou son absence en détente.
- Parité : en mode classique, tout se joue exactement comme avant (`tests/parity.test.js`, fixture inchangée ;
  `playParity` et `playSim` passent `difficulty: 'classique'`).

### Actions, requêtes, événements (ajouts)

```js
game.difficulty                      // 'detente' | 'classique'
game.query.difficulty() → { id, name, description }
game.query.level()                   // niveau DU MODE (fermages, départ, seuils d'étoiles, description du mode)
game.query.finance().neighbourLoan → null /* classique */ | {
  debt, borrowed, repaid, loans,     // voir state.neighbourLoan
  available,                         // aucune dette en cours (le voisin peut prêter)
  wouldLend,                         // si le fermage de la saison tombait maintenant avec l'argent actuel :
                                     //   0 = l'argent suffit ; n = Joseph prêterait n pièces (manque + coussin) ;
                                     //   null = il ne peut pas (dette en cours, ou manque > maxMissing) → FAILLITE
  maxMissing,                        // manque maximal couvert pour le fermage de la saison
  surcharge, repayShare, cushion, maxShare, minCover }
game.actions.repayNeighbour(amount?) → { ok, amount, remaining } | { ok: false, reason }
  // rembourse tout ce qu'on peut (ou au plus `amount`) ; refus : mode classique, rien à rembourser, pas d'argent
game.actions.harvest(i) → { ...v3, loanRepayment? }   // présent seulement quand le voisin a pris sa part
```

| Événement | Données | Quand |
|---|---|---|
| `neighbourLoan` | `{ amount, debt, missing, rent, seasonId, surcharge, repayShare }` | soir du fermage, **avant** `billPaid` (`amount` = manque + coussin ; `debt` = ce qu'on doit ; `surcharge` = debt − amount) |
| `loanRepayment` | `{ amount, remaining, source: 'harvest' \| 'product' \| 'player' \| 'yearEnd' }` | chaque remboursement (récolte vendue : juste après `harvested` ; produits : après `dawn`) |
| `loanRepaid` | `{ total, borrowed, loans, source, forgiven? }` | dette soldée (fin d'année : toujours, avec `forgiven`) |
| `loanForgiven` | `{ amount }` | fin d'année : ce que Joseph efface (l'argent ne suffisait pas) |
| `harvested` | v3 + `loanRepayment` (si > 0) | |
| `bankrupt` | v3 + `neighbourDebt` (détente seulement) ; `state.result.neighbourDebt` aussi | |
| `dawn` | `chargesDetail` peut contenir `{ source: 'neighbour', amount }` (part des produits vendus ce matin, comptée dans `charges`) | |

- `summary` (billPaid / bankrupt / victory / `query.summary()`) : en détente, `neighbourLoan: { debt, borrowed,
  repaid, forgiven, loans }` ; `net` de l'année inclut `borrowed − repaid` (pas celui de la saison).
- Fin d'année (détente) : après `billPaid` d'hiver → (`loanRepayment` 'yearEnd') → (`loanForgiven`) → `loanRepaid`
  → `victory`. L'argent final n'est jamais rendu négatif par le voisin.

### Progression (`src/core/progression.js`)

```js
progress.difficulty = 'detente' | 'classique'     // mode des NOUVELLES parties ; défaut 'detente' (aussi pour
                                                  // une progression d'avant les modes)
runDifficulty(p) → 'detente' | 'classique'        // à passer à createGame({ difficulty })
setDifficulty(p, id) → { ok, progress } | { ok: false, reason }
```

Une seule fiche par niveau (`levels[id]`), quel que soit le mode : étoiles et record gardent le meilleur.

### À faire côté interface (lot UI, non fait ici)

1. **Choix du mode** : réglage « Difficulté » (Détente / Classique, avec `DIFFICULTIES[id].description`) dans les
   options ou la sélection des niveaux ; `setDifficulty` + `saveProgress` ; `createGame({ levelId, seed, perks,
   difficulty: progression.runDifficulty(progress) })` dans `main.js` (aujourd'hui `createGame({ levelId, seed, perks })`
   donne déjà la détente par défaut). Afficher le mode de la partie en cours (`game.query.difficulty().name`), par
   exemple dans le bandeau du niveau et le menu pause.
2. **Sélection des niveaux** (`dialogs.js`) : lire départ, fermages et seuils d'étoiles dans `levelsFor(mode)` (ou
   `levelFor(id, mode)`) au lieu de `LEVELS` / `getLevel` ; pendant une partie, toujours `game.level`.
   L'étiquette « Récoltes −25 % » (niveau 9) lit `modifiers.rawPriceFactor`, inchangé par le mode : c'est voulu.
3. **Prêt du voisin** (Joseph, le voisin du tutoriel) :
   - événement `neighbourLoan` : message ou petite fenêtre « Joseph vous avance {amount} pièces pour le fermage.
     Vous lui rendrez {debt} pièces : la moitié de vos ventes lui revient jusqu'au remboursement. » ; puis le bilan
     de fin de saison comme d'habitude (`billPaid` suit) ;
   - `loanRepayment` : texte flottant discret « −n pour Joseph » (sources `harvest` / `product`) ; `loanRepaid` :
     message « Dette envers Joseph remboursée ! » (fin d'année : « Joseph efface le reste de la dette » si
     `forgiven > 0`) ;
   - barre du haut / fiche du fermage : si `finance().neighbourLoan.debt > 0`, afficher la dette ; couleur du fermage :
     rouge seulement si `wouldLend === null` et l'argent ne suffit pas (faillite réelle), sinon orange « Joseph
     aidera » quand `wouldLend > 0` ;
   - bouton facultatif « Rembourser Joseph » (`actions.repayNeighbour()`) dans la fiche du fermage ;
   - écran de faillite : si `neighbourDebt > 0`, expliquer « Vous deviez encore {neighbourDebt} pièces à Joseph :
     il ne pouvait plus vous aider » ; sinon, si le mode est détente, « Il manquait trop : Joseph avance au plus
     {maxMissing} pièces ».
4. **Tutoriel** (`tutorial.js`, étape « Investir ») : il conseille le poulailler dès 70 pièces, soit tout de suite
   (on en a 160 au départ) — la simulation « novice » montre que c'est la principale cause de fonds vides au
   printemps. Suggestion : conseiller le poulailler après le premier fermage, ou seulement si l'argent restant
   couvre le fermage (`money − 70 ≥ finance().nextBill.amount`). Le texte « Un an pour… » peut rester ;
   l'étape « L'hiver approche » lit `game.level.rents[3]` (déjà le chiffre du mode).

### Interface livrée (lot UI, 2026-09-30)

Les quatre points ci-dessus sont faits :

- `src/ui/progress.js` : `difficulty()` (= `runDifficulty`) et `setDifficulty(id)` ; `main.js` : `app.difficulty()`,
  `app.setDifficulty(id)`, `createGame({ levelId, seed, perks, difficulty: app.difficulty() })` (aussi pour
  « Recommencer », « Réessayer », « Rejouer » : le mode choisi pour les nouvelles parties). La ferme de démonstration
  du menu reste en détente.
- `dialogs.js` : `difficultySwitch(onChange)` (groupe radio de deux boutons ≥ 60 px, `#diff-detente`, `#diff-classique`)
  en tête de la sélection des niveaux et des Options ; `levelCards(mode)` lit `levelFor(id, mode)` (départ, fermages,
  objectifs) ; `modeBadge(id)` dans le menu pause ; `neighbourLoan(ev, { onClose })` (fenêtre `neighbour-loan`,
  avant le bilan de saison, qui reçoit `extra.loan`) ; `detenteNotice({ savedClassique })` (message unique, clé
  `detenteNotice` de la mémoire d'interface `une-annee-a-la-ferme.ui`, seulement si le joueur avait déjà joué) ;
  faillite : raison liée à Joseph (`ev.neighbourDebt`, `finance().neighbourLoan.maxMissing`) ; victoire :
  `loanBlock(summary.neighbourLoan)` ; `summaryLines` du bilan de l'année ajoute « Prêté par Joseph » / « Rendu à Joseph »
  (le `net` de l'année les inclut).
- `hud.js` : `projection()` rend aussi `neighbourShare` (part de Joseph sur les récoltes et produits à venir),
  `lend`, `loanBlocked` et l'état `'loan'` (manque couvert par Joseph : classe `is-warn is-loan`, jamais
  `is-urgent`) ; `stateText(p)` ; fiche « Argent » : dette + bouton `#info-repay` (→ `app.openNeighbour()`).
  L'état `'loan'` est calculé sur la **prévision** (`nextBill.amount − projected ≤ maxMissing` et `available`), pas
  seulement sur `wouldLend` (argent actuel) : les récoltes à venir comptent.
- `panel.js` (Bilan) : ligne du mode, section `#stats-neighbour` (dette : `#repay-20|50|100`, `#repay-all` →
  `app.repayNeighbour(amount)` ; sans dette : rappel du plafond) ; `focusNeighbour()`.
- `main.js` : `pending.loan` ; messages `loanRepayment` (sources `harvest`/`product` cumulées dans un seul toast à clé
  `neighbour-repay`, mis à jour — `toasts.show({ key })` ; source `player` : message de confirmation), `loanRepaid`
  (hors fin d'année) ; conseil doux `maybeLowMoneyHint` (aube, ≤ 3 jours avant le fermage, une fois par saison) ;
  étiquette du mode dans `savedRunInfo().label` (sauvegarde sans `difficulty` → Classique) et dans le bandeau de début.
- `tutorial.js` : poulailler conseillé si `money ≥ coût + fermage de la saison` ; textes d'arrosage via
  `waterEffect(level)` (`text.js`, qui a aussi `weatherHint(id, level)` et `difficultyName(id)`).
- `panel.js` : l'entretien de la ferme lit `level.dailyCharge` (2 en détente).


---

## Mode Carrière — contrats (conception 2026-09-30)

> Conception : `docs/CARRIERE.md`. Ce qui suit fixe les **noms, formes et comportements** que les lots CORE-A, CORE-B, CORE-C, UI, RENDER et ART se promettent (découpage : `docs/CARRIERE.md` § 14). Tout est **ajouté** : rien du contrat des niveaux n'est retiré ni renommé. Tant qu'un lot n'a pas livré, les autres simulent ses requêtes avec des objets factices de la même forme.

### Règles communes

- **Parité** : toute règle de carrière est gardée par `state.mode === 'career'`. Une partie de niveau (`state.mode` absent ou `'levels'`) ne passe par **aucun** nouveau code, ne crée aucun nouveau flux aléatoire, ne lit aucune donnée de `src/data/career/`. `createRngState` ne change pas ; les flux de carrière (`career`, `staff`, `events`) sont ajoutés à `state.rng` par `createCareer` (`hashSeed(seed, 'career')`…). `tests/parity.test.js` et `node tools/simulate.js` restent identiques.
- `src/core/career/*` et `src/data/career/*` sont **purs** (aucun DOM, aucune horloge : les dates viennent de l'interface).
- Textes en français, identifiants en anglais. Les actions renvoient `{ ok: true, ... }` ou `{ ok: false, reason }`.

### Nouveaux fichiers

```
src/data/career/career.js     constantes (CAREER_VERSION, DIFFICULTY_CAREER, charges, MAX_*), cultures par rang
src/data/career/lots.js       prix des terrains, noms, types d'aménagement (LOT_TYPES), gabarits logiques (parcelles, emplacements)
src/data/career/buildings.js  bâtiments à niveaux (house, storage, greenhouse, roadsideStand, guestHouse, abris, ateliers niv. 4-5)
src/data/career/ranks.js      RANKS (seuils, objectifs, déblocages, titres)
src/data/career/animals.js    animaux de carrière (hen, rabbit, duck, goat, cow, sheep, pig, horse) : forme d'investissement
src/data/career/machines.js   MACHINES
src/data/career/staff.js      JOBS, TRAITS, XP_LEVELS, salaires ; names.js : prénoms, apparences
src/data/career/events.js     CALENDAR_EVENTS, RANDOM_EVENTS (poids, conditions), CONTEST_GOAL_POOL
src/data/career/quests.js     QUEST_TEMPLATES, JOSEPH_HEARTS (paliers)
src/core/career/career.js     createCareer(), loadCareer(), careerLevel(state), hooks appelés par game.js
src/core/career/land.js       terrains : achat, aménagement, réaménagement, création des parcelles
src/core/career/buildings.js  construction, amélioration, capacités
src/core/career/ranks.js      patrimoine, objectifs, passage de rang
src/core/career/market.js     cours de carrière, hors saison, jours de fête, prix de vente
src/core/career/storage.js    grenier : mise en réserve, ventes, filet de sécurité
src/core/career/animals.js    production à ramasser, plafond, naissances, truffes, balades
src/core/career/machines.js   passages des machines, carburant
src/core/career/staff.js      candidats, embauche, niveaux, humeur, congés, chômage technique
src/core/career/work.js       tâches des employés dans la journée (planification, exécution à doneAt)
src/core/career/events.js     calendrier, comice (s'appuie sur contest.js), événements au hasard, offres
src/core/career/quests.js     quêtes et amitié de Joseph
src/core/career/save.js       CAREER_SCHEMA, migrateCareer(), checkCareerState()
src/render/layout-career.js   disposition en colonne à partir des terrains
src/render/career-actors.js   employés, machines en mouvement, corbeaux, bulles
src/ui/career/*.js            menu, nouvelle ferme, carte, terrain, équipe, carnet, offres, bilan annuel
tools/simulate-career.js      simulation de carrière
assets/sprites/generate-career.py → assets/sprites/career.png (bloc « // <career:auto> » d'atlas.js)
tests/career-*.test.js
```

### Création, chargement, sauvegarde

```js
import { createCareer, loadCareer } from './core/career/career.js';
const game = createCareer({ seed, difficulty = 'detente', farmName, cosmetics? });
const game2 = loadCareer(saved.state);        // migre (migrateCareer) puis vérifie (checkCareerState) ; lève une erreur sinon
game.mode === 'career'
// Même interface que createGame : update(dt), on(type, h), state, serialize(), actions, query, level
```

- `game.level` / `query.level()` = `careerLevel(state)` : un objet **de même forme qu'un niveau** (recalculé après chaque achat de terrain, de bâtiment ou passage de rang) : `id: 'career'`, `crops` (par rang), `availableInvestments` (animaux, ruches, panneaux, étal, chambre d'hôte, ateliers débloqués), `investmentsById` (données de carrière : `src/data/career/animals.js` + bâtiments), `seasonLengths: [7,7,7,7]`, `weather` (table douce des niveaux), `dailyCharge`, `cropPriceFactor`, `dryGrowth`, `dryHeatwaveGrowth`, `neighbourLoan` (plafond de carrière), `rents: null` (remplacés par `seasonCharge`), `modifiers` (défauts).
- **Accès aux investissements** : `economy.js` gagne `investmentOf(level, id)` = `level.investmentsById?.[id] ?? getInvestment(id)` ; `game.js`, `economy.js`, `processing.js` l'utilisent partout où ils lisaient `getInvestment(id)` (niveaux : même objet → parité).
- **Stockage** (`storage.js`, CORE-A) :

```js
saveCareer(serialized, meta)   // clé une-annee-a-la-ferme.career : { schema: 1, savedAt, meta, state } ; copie la précédente sauvegarde valide dans « .career.bak » (au plus une fois par jour de jeu)
loadCareer() → { state, meta } | null        // lecture seule (la validation est faite par loadCareer du cœur)
loadCareerBackup() → { state, meta } | null
careerMeta() → meta | null                    // pour le menu, sans charger la partie
clearCareer({ archive })                      // archive dans progress.career.archive puis efface
// meta = { farmName, year, seasonId, day, rank, difficulty, patrimony }
```

- **Progression** (`progression.js`) : `progress.career = { started, bestRank, bestYear, years, archive: [{ farmName, years, rank, patrimony, endedBy }] }` (défaut `{ started: false, bestRank: 0, bestYear: 0, years: 0, archive: [] }`, `normalizeProgress` le complète) ; `recordCareerYear(p, { year, rank, net, report }) → { progress, rewards: { ecus }, achievements }` (écus du bilan annuel, cumuls `lifetime`, succès) ; `recordCareerRank(p, rank) → { progress, rewards }` ; `checkAchievements(p, ctx)` accepte `ctx.career` (= `query.career.achievementContext()`) ; nouveaux types de condition : `careerStarted`, `careerLots {n}`, `careerRank {n}`, `careerStaff {n}`, `careerStaffLevel {n}`, `careerMachine {id?}`, `careerCropInSeason {cropId, seasonId}`, `careerSpecies {n}`, `careerTruffles {n}`, `careerHearts {n}`, `careerContestAll`, `careerYear {n}`, `careerStock {n}`, `careerYearNet {n}`. Chaque succès de carrière porte `category: 'career'` et `reward.stars: 0`.

### État de carrière

```js
state.mode = 'career'
state.time.year = 1                         // day repart à 1 chaque printemps
state.rng.career / .staff / .events         // flux propres à la carrière
state.plots[i].lot = 'start' | 'lot3' …     // terrain de la parcelle (carrière seulement)
state.plots[i].env = 'field' | 'greenhouse' | 'orchard'
state.plots[i].crow = false                 // corbeau posé (événement)
state.investments = { hen: 2, cow: 0, …, beehive: 0, solarPanel: 0 }   // unités d'animaux et aménagements
state.processing                            // v3, inchangé (capacité = niveau + artisan)
state.career = {
  version: 1, farmName, difficulty,
  rank: 1, objectives: { [objectiveId]: true },
  lots: [{ id, index /* 0 = maison, 1 = champ de départ, 2 = basse-cour, 3.. = terrains */, type, pricePaid,
           developPaid, slots: [null | buildingId, null | buildingId], plan: { spring, summer, autumn, winter }, name }],
  lotsBought: 0,
  buildings: { [buildingId]: { level, lotId, slot, pending: 0 /* valeur à ramasser (abris) */, lastCollected } },
  machines: { [key /* 'seeder@lot3' ou 'tractor' */]: { id, lotId, level, on, workedDay } },
  staff: [{ id, name, look: { outfit, hat, tint }, trait, job: null|'gardener'|'keeper'|'artisan'|'seller',
            lotId: null|'all'|lotId, level, xp, wage, mood: 'joyful'|'content'|'tired', streak, joyUntilDay,
            onLeave, idleReason: null|'noMoney', actionsToday, task: null|{ kind, target, startAt, doneAt, from } }],
  candidates: [{ id, name, look, trait, level, suggestedJob }], candidatesDay, nextStaffId,
  stock: { [cropId]: n }, storageMode: 'never'|'low'|'always',
  events: { active: null|{ id, kind, day, endDay, data }, offers: [...], calendarDone: [eventId], fishedDay, lastKind },
  contest: null | (forme v3 de state.contest, pour le comice de l'année),
  quest: null | { id, templateId, need: { type, id, n }, progress, reward, endDay, accepted },
  joseph: { hearts, questsDone, gifts: [] },
  pets: { cat: false, dog: false },
  hardship: null | { stage: 'overdraft'|'rescueSold', since: { year, day } },
  history: [{ year, net, incomeBy, spentBy, rank, patrimony }],
  lifetime: { harvests, productsSold, truffles, questsDone, contestsWon },
  cosmetics: { decor: { [slotId]: itemId } },
}
```

`checkCareerState` vérifie tout (identifiants connus, niveaux ≤ max, capacités, parcelles ↔ terrains, employés ≤ capacité de la maison…). `state.status` reste `'playing'` (Classique : `'bankrupt'` à la faillite ; jamais `'victory'`).

### Déroulé d'une journée (ajouts, carrière seulement)

Fin de journée, dernier jour de la saison : (automne) jugement du comice → ateliers vendus en l'état si besoin → **stock vendu si besoin** (`stockSold`) → Joseph (plafond de carrière) → **charges de saison** (`billPaid` avec `career: true`, `amount` = charges) ou coup dur (`hardship`) / vente de secours (`rescueSale`) / faillite (Classique) → (hiver) **fin d'année** : `yearEnd { year, report }`, `state.time.year++`, `stats.year` remis à zéro, historique ; pas de `victory`.

Aube (entre les étapes des niveaux) : 2. début de saison → naissances des lapins, nouveaux candidats, quête de Joseph, fête du jour ; 3 bis. événement au hasard (`careerEvent`) et truffes ; 7. arrosage : **arroseurs par terrain** (remplacent `sprinkler`), château d'eau, serre ; semoir (1er passage) ; 8. ateliers (+ convoyeur) ; 9. production des animaux **ajoutée à `buildings[abri].pending`** (plafond 3 jours) au lieu d'être payée (lait vers la fromagerie : inchangé) ; tonte ; balades ; 10. charges : + salaires (employés au travail), + carburant des machines de la veille, chauffage de la serre ; jamais de salaire ni de carburant si l'argent est négatif (`idleReason: 'noMoney'`).

Pendant la journée (`update`) : à 30 % moissonneuse, cueilleuse ; 35 % semoir ; 40 % et 80 % collecteurs ; de 15 % à 85 % tâches des employés (chacune appliquée quand `elapsed ≥ doneAt`). Un grand `dt` exécute tout dans l'ordre chronologique (tâches, passages, fin de journée, aube). Offres et commandes expirent à leur `endDay`.

### Actions (carrière : `game.actions.career.*`)

```js
buyLot()                                   // le terrain suivant → { ok, lotId, cost }
developLot(lotId, type)                    // 'field'|'meadow'|'orchard'|'workshops'|'pond'|'greenhouse' → { ok, cost, plots: [index] }
build(lotId, slot, buildingId)             // abri, chambre d'hôte, atelier sur un emplacement → { ok, cost }
upgradeBuilding(buildingId)                // house, storage, greenhouse, roadsideStand, abris, ateliers… → { ok, level, cost }
buyMachine(machineId, lotId?)  / upgradeMachine(machineId, lotId?) / setMachine(machineId, lotId, on)
setPlan(lotId, seasonId, cropId | 'same' | null)
collect(buildingId) → { ok, amount }       // ramasser un abri
chaseCrow(plotIndex) → { ok }
fish() → { ok, amount, fishId }
hire(candidateId) / fire(staffId) / assign(staffId, job, lotId|'all'|null) / setLeave(staffId, on) / setTeamLeave(on)
setStorageMode(mode) / sellStock(cropId | null /* tout */, n?) → { ok, amount, count }
acceptOffer(offerId) / declineOffer(offerId) / deliverOffer(offerId)     // visiteurs, marchand, adoption
acceptQuest() / declineQuest() / deliverQuest()                          // depuis le grenier
renameLot(lotId, text)                                                  // phase B
// inchangées et valables en carrière : plant, water, harvest (→ + handPicked: true, stored?, crowPenalty?),
// removeTree, setProcessing, sellProcessing, setSpeed, repayNeighbour, unlockPlot (champ de départ)
// buyInvestment(id) : animaux (refus « L'étable est pleine : améliorez-la. »), ruches, panneaux
```

### Requêtes (carrière : `game.query.career.*`)

```js
summary() → { year, seasonId, day, rank, rankName, title, patrimony, nextRank: null | { rank, name, patrimony,
             objectives: [{ id, label, done, progress, target }], unlocks: [{ kind, id, name }] }, difficulty, hardship }
lots() → [{ id, index, type, name, bought, forSale, price, developCost, lockedByRank, rect? /* rendu */,
            plots: [index], slots: [{ buildingId, level } | null], machines: [key], staff: [staffId], plan }]
lot(id)                                    // idem, un seul
nextLot() → null | { id, index, name, price, chargeIncrease, canBuy, reason }
lotTypes(lotId) → [{ type, name, cost, canDevelop, reason, max, count }]
buildings() → [{ id, name, level, maxLevel, nextCost, canUpgrade, reason, effects, lotId, slot,
                 animals?: { id, count, capacity }, pending?, pendingDays?, full? }]
buildOptions(lotId, slot) → [{ buildingId, name, cost, canBuild, reason }]
machines() → [{ key, id, name, lotId, level, maxLevel, on, nextCost, fuel, requires, canUpgrade, reason }]
machineCatalog() → [{ id, name, scope: 'lot'|'farm', lotTypes, cost, rank, canBuy, reason, compatibleLots }]
staff() → [{ ...state.career.staff[i], jobName, lotName, actionsPerDay, nextLevelXp, moodName, traitName, traitText }]
candidates() → { list: [...], nextInDays, capacity, count, canHire, reason }
stock() → { capacity, used, mode, lines: [{ cropId, name, n, unitPrice, total, multiplier, offSeason }], value }
market() → { [cropId]: { multiplier, offSeason, fair } }
events() → { today: null | calendarEvent, active: null | {...}, offers: [...], calendar: [{ id, name, seasonId, day, done, daysUntil }],
             contest: null | (forme de query.contest() v3) }
quest() → null | { id, text, need, progress, reward, daysLeft, accepted, canDeliver }
joseph() → { hearts, nextGift: null | { hearts, text }, loan /* = finance().neighbourLoan */ }
charges() → { daily: [{ source: 'farm'|'upkeep'|'wages'|'fuel'|'heating'|'solar', amount }], season: { amount, daysLeft, perLot } }
yearReport(year?) → { year, net, incomeBy: {...}, spentBy: {...}, bestCrop, rank, ecus?, achievements? }
history() → state.career.history
achievementContext() → { rank, lots, staffCount, maxStaffLevel, machines, species, truffles, hearts, contestAll, year, stock, yearNet, cropsInSeason }
workPlan() → [{ staffId, task, pos? }]      // lu par le rendu pour les employés
// query.plot(i) en carrière : + lot, env, crow, handBonus (1,1), storeTarget (grenier), offSeason, marketMultiplier
```

### Événements (ajouts)

| Type | Données |
|---|---|
| `lotBought` | `{ lotId, index, cost }` |
| `lotDeveloped` | `{ lotId, type, cost, plots: [index] }` |
| `buildingBuilt` / `buildingUpgraded` | `{ buildingId, level, lotId, slot, cost }` |
| `machineBought` / `machineUpgraded` / `machineToggled` | `{ key, id, lotId, level, on? }` |
| `machineWorked` | `{ key, id, lotId, kind: 'water'\|'sow'\|'harvest'\|'pick'\|'collect', plots: [{ index, at /* elapsed */ }], fuel }` |
| `taskStarted` / `taskDone` | `{ staffId, kind, target, startAt, doneAt, result? }` (rendu : trajet et animation) |
| `staffHired` / `staffLeft` / `staffLevelUp` / `staffMood` | `{ staffId, … }` |
| `candidatesRenewed` | `{ count }` |
| `collected` | `{ buildingId, amount, by: 'player'\|'keeper'\|'collector' }` |
| `animalBorn` | `{ animalId, count }` · `truffleFound` `{ amount }` · `fishCaught` `{ fishId, amount }` |
| `stored` / `stockSold` | `{ cropId, n, plotIndex? }` / `{ amount, count, reason: 'player'\|'seller'\|'charges'\|'fair' }` |
| `careerEvent` / `careerEventEnded` | `{ id, kind, data }` |
| `offer` / `offerResolved` | `{ offerId, kind, data }` / `{ offerId, outcome: 'accepted'\|'declined'\|'delivered'\|'expired', amount? }` |
| `crow` / `crowChased` | `{ plots: [index] }` / `{ plotIndex, by }` |
| `questOffered` / `questProgress` / `questDone` / `questExpired` | `{ quest }` |
| `josephHeart` | `{ hearts, gift? }` |
| `rankUp` | `{ rank, name, title, unlocks, ecus }` |
| `hardship` / `rescueSale` | `{ stage, money }` / `{ sold: [{ kind, id, amount }], total }` |
| `yearEnd` | `{ year, report }` (après `billPaid` d'hiver ; l'interface met en pause et affiche le bilan) |
| `billPaid` | v3 + `career: true`, `detail: { base, perLot, lots }` |
| `harvested` | v3 + `handPicked`, `stored`, `crowPenalty`, `by: 'player'\|'staff'\|'machine'` |
| `dawn` | `incomes[].kind` + `'tourists'\|'rides'\|'truffle'\|'passersby'` ; `chargesDetail` + `'wages'\|'fuel'\|'heating'` |

### Rendu (RENDER)

```js
createLayout(level, { career: state.career })   // mode carrière → layout-career.js
layout.lots = [{ id, index, type, rect /* px monde */, sign: { x, y }, forSale }]
layout.slots[buildingId] = { building: rect, pen: rect, sign, anchor }       // abris, ateliers, maison, grenier…
layout.machineParking[key] = { x, y }
layout.plots (index du cœur, jamais renumérotés), layout.decorSlots (ids v3 dans la bande de la maison)
scene.setCareer(on)                           // reconstruit la disposition si les terrains changent (lotDeveloped, buildingBuilt…)
scene.focusLot(lotId, { animate })            // Carte → « Aller »
scene.hitTest(x, y, opts) → niveaux | { type: 'lotSign', lotId } | { type: 'lotForSale' } | { type: 'shelter', buildingId }
                           | { type: 'building', buildingId } | { type: 'machine', key } | { type: 'employee', staffId }
                           | { type: 'pond' } | { type: 'crow', plotIndex }
scene.onEvent('taskStarted' | 'machineWorked' | 'collected' | 'lotBought' | 'rankUp' | …)   // animations
```

- La scène lit `game.state`, `query.career.lots()`, `buildings()`, `workPlan()` ; elle ne modifie rien.
- Noms de sprites : `docs/CARRIERE.md` § 11 (planche `career`) ; l'UI les obtient par `sprite(name)` / `spriteURL(name)` d'`icons.js` (portraits `portrait.staff.<look>`, `portrait.joseph`, icônes `icon.career.*`, `icon.ach.<id>`). Apparence d'un employé → nom : `staffSprite(look, pose)` et `staffPortrait(look)` exportés par `atlas.js`.

### Interface (UI)

- `main.js` : `app.startCareer({ farmName, difficulty })`, `app.continueCareer()`, sauvegarde de la carrière (aube, arrière-plan, achats, `yearEnd`), une seule partie active à la fois (la partie de niveau est enregistrée avant d'ouvrir la carrière, et inversement) ; `yearEnd` → pause + bilan annuel → `progression.recordCareerYear` ; `rankUp` → fenêtre + `recordCareerRank`.
- Onglets de carrière : `tabbar.js` reçoit une configuration (`['farm','buy','staff','journal','menu']`) ; les onglets des niveaux ne changent pas.
- Nouveaux conseils : identifiants `career.*` (`docs/CARRIERE.md` § 10.8).
- Débogage (`?debug=1`) : `__debug.career()` (état), `careerSkipYears(n)`, `careerRank(n)`, `careerMoney(n)`, `careerEvent(id)`.

### Découpage et frontières

| Lot | Possède (seul à modifier) | Livre | Attend |
|---|---|---|---|
| **CORE-A** | `src/core/{game,farm,economy,calendar,neighbour,progression}.js`, `src/storage.js`, `src/data/achievements.js`, `src/data/career/{career,lots,buildings,ranks}.js`, `src/core/career/{career,land,buildings,ranks,market,storage,save}.js`, `tests/career-{core,land,buildings,save}.test.js` | jalon « squelette » (`createCareer` qui enchaîne les années), hooks d'aube / de journée / de fin de journée appelés par `game.js` (`careerHooks.{dawn,tick,evening,yearEnd}`), actions et requêtes ci-dessus | rien |
| **CORE-B** | `src/data/career/{machines,staff,animals,names}.js`, `src/core/career/{machines,staff,work,animals}.js`, `tests/career-{machines,staff,animals}.test.js` | fonctions branchées sur les hooks de CORE-A | CORE-A : squelette |
| **CORE-C** | `src/data/career/{events,quests}.js`, `src/core/career/{events,quests}.js`, `tools/simulate-career.js`, `tests/career-{events,quests,simulate}.test.js` | événements, quêtes, simulation, tableaux chiffrés de `docs/CARRIERE.md` après équilibrage | CORE-A/B |
| **UI** | `src/ui/*` (dont `src/ui/career/*`), `css/style.css`, `src/main.js`, `src/index.template.html` | écrans et câblage | CORE : API ; RENDER : scène ; ART : sprites (factices en attendant) |
| **RENDER** | `src/render/*` (dont `layout-career.js`, `career-actors.js`), hors bloc `<career:auto>` d'`atlas.js` | disposition, scène, hit-test | CORE : formes d'état et requêtes ; ART : planche |
| **ART** | `assets/sprites/generate-career.py`, `assets/sprites/career.png`, bloc `<career:auto>` d'`atlas.js`, nouveaux sons dans `assets/audio/sfx/`, `CREDITS.md` | planche et noms du § 11 | — |

Règles : aucun lot ne modifie les fichiers d'un autre (demande au chef de projet) ; `index.html`, `dev.html`, `dist/` générés par `node tools/build.js` ; la planche `career.png` doit être ajoutée au chargement des images par RENDER (`assets.js`) ; `node --test tests/` vert (parité comprise) à chaque livraison.
