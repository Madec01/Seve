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
    levels.js              niveaux (contraintes, fermages, météo, seuils d'étoiles)
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
    dialogs.js             fenêtres : menu, niveaux, options, crédits, pause, fin de saison, victoire, faillite
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

const game = createGame({ levelId: 1, seed: 12345 });   // nouvelle partie
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
- **Débogage** (`?debug=1`) : `__debug.plotPoint(i)`, `investmentPoint(id)`, `skipDays(n)`, `start(id)`, `insets()` ; `?nosw` : sans service worker ; `?debug=1&autostart` : passe l'écran « Commencer » ; `dev.html` : modules non empaquetés.

## Règles de code

- `src/core` et `src/data` n'importent jamais le DOM ni `window` ; tout l'aléatoire passe par `rng.js` (graine dans l'état → parties reproductibles, tests déterministes).
- L'état est **uniquement** modifié par `game.update()` et `game.actions.*`.
- Les textes affichés au joueur sont en français ; les identifiants (`carrot`, `chickenCoop`…) en anglais.
- Rendu pixel art : `imageSmoothingEnabled = false`, zoom entier, canvas redimensionné à la fenêtre.
- Chemins relatifs uniquement (le jeu doit fonctionner dans un sous-dossier, ex. GitHub Pages).
