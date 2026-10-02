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
    career/                mode Carrière (voir « Mode Carrière — contrats » et « livraison CORE-A ») :
                           career.js (createCareer / loadCareer), runtime.js (journée, actions, requêtes),
                           level.js (careerLevel), effects.js, land.js, buildings.js, ranks.js, market.js,
                           storage.js (grenier), save.js, registry.js + extensions.js (points d'accroche)
    data/career/           (dans src/data/) career.js, lots.js, buildings.js, ranks.js
  render/                  dessin canvas
    assets.js              chargement des images/sons (promesses)
    atlas.js               sprites nommés → {image, x, y, w, h}
    scene.js               dessin de la ferme (sol, champ, bâtiments, animaux, décor)
    effects.js             particules (pluie, neige, feuilles, pièces), lumière du jour, teintes de saison ;
                           (lot 2) récolte qui saute, étincelles de qualité, géant, météos spéciales
    lot2-actors.js         (lot 2) fée, renard, coffre, hérisson, chouette, trouvailles du défrichage
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
    juice.js               (lot 2) récolte « juteuse » : pièces qui volent au compteur, notes qui montent, total
    lot2.js                (lot 2) messages, sons, récompenses, fenêtres « Faites un vœu » et « Trouvailles »
    career/                mode Carrière : menu « Ma ferme », création, Acheter, carte, terrains, équipe, Carnet,
                           offres, fenêtres (voir « Mode Carrière — interface livrée »)
  audio/
    audio.js               musique (fondus), ambiances, effets sonores, volumes
    synth.js               (lot 2) sons synthétisés (marimba pentatonique, scintillements, fanfare…)
  storage.js               localStorage (partie, carrière + copie de secours, progression, options) avec try/catch
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


## Mode Carrière — livraison CORE-A (socle, 2026-09-30)

Le squelette tourne : `createCareer()` enchaîne les années (7, 10 ou 14 jours par saison) avec terrains,
aménagements, bâtiments à niveaux, cultures, animaux (provisoires), ateliers, grenier, charges de saison,
coups durs, rangs et sauvegarde. Tout est gardé par `state.mode === 'career'` ; la parité des niveaux est verte.
Tests : `tests/career-{core,land,buildings,save}.test.js` (48), outils communs `tests/career-helpers.js`
(`newCareer`, `goTo`, `skipYear`, `setRank`, `withExtension`, `tendAll`) réutilisables par CORE-B/C.

### Fichiers (en plus de la liste du contrat)

```
src/core/career/registry.js    points d'accroche et fournisseurs des lots CORE-B / CORE-C (registerCareerExtension)
src/core/career/extensions.js  la liste des modules d'extension chargés (UNE ligne d'import par module : seul fichier partagé)
src/core/career/effects.js     économie de base : charges de saison, effets cumulés, revenus et charges de l'aube (sans cycle avec economy.js)
src/core/career/level.js       careerLevel(state), cropsForRank, josephLoanConfig (réexporté par career.js)
src/core/career/runtime.js     déroulé de la journée de carrière, actions et requêtes game.*.career, `api` des extensions
tools/simulate-career.js       squelette du simulateur (casual, optimal) — CORE-C l'étend
```

Modifiés (branches `state.mode === 'career'` seulement) : `game.js` (niveau recalculable, délégation au moteur),
`farm.js` (serre, prix de carrière, champ de départ), `economy.js` (`investmentOf`, `rentFor` → charges de saison,
`effectTotal`), `calendar.js` (années continues), `processing.js` ⚠ (hors liste CORE-A : places des ateliers à
5 niveaux et artisan, prix des produits les jours de fête), `progression.js`, `storage.js`, `achievements.js`.

### Création, niveau, état

```js
createCareer({ seed, difficulty = 'detente', farmName, farmerGender = 'fermier' | 'fermiere', outfit = 'outfit.classic',
               seasonLength = 7 | 10 | 14, cosmetics: { decor } })   // difficulté ou durée inconnue → erreur ; nom, genre, tenue invalides → défauts
loadCareer(saved.state)          // migrateCareer + checkCareerState ; erreur (code 'newer' si version plus récente)
careerMetaOf(game)               // { farmName, year, seasonId, day, rank, rankName, title, difficulty, patrimony, seasonLength, farmerGender, status }
game.mode === 'career'           // 'levels' pour une partie de niveau
game.level                       // ACCESSEUR : careerLevel(state), recalculé à chaque aube et après chaque action réussie
game.refreshLevel()              // carrière seulement : après une modification directe de l'état (débogage, tests)
```

- `careerLevel(state)` : forme d'un niveau (`id: 'career'`, `rank`, `crops` du rang, `availableInvestments`,
  `investmentsById` (animaux, ruches, panneaux + ateliers des niveaux pour les recettes), `seasonLengths: [L,L,L,L]`,
  `seasonCharge`, `rents: null`, `weather` du niveau 1, nombres de la difficulté, `neighbourLoan` (plafond
  max(100, 100 % des charges), × 2 à 4 ♥, supplément 0 à 6 ♥), `modifiers` neutres).
- **Durée des saisons** : coûts et gains quotidiens inchangés ; charges de saison × durée / 7 (`seasonScale`). Les prix
  des terrains et bâtiments ne changent pas. ⚠ Intégration : seuils de patrimoine des rangs × 2 / × 3,5
  (`patrimonyScale`), objectifs comptés × durée / 7 (`objectiveTargetFor`) — voir « Mode Carrière — intégration ».
- `state` : `version: 2`, `mode: 'career'`, `levelId: 'career'`, `time.year`, `perks: {}` (aucun bonus en carrière),
  `rng.career / .staff / .events`. `state.career` = forme du contrat **plus** `farmerGender`, `outfit`, `seasonLength`,
  `yearStats: { incomeBy, spentBy, cropIncome }` (bilan de l'année, remis à zéro au bilan), `paid: { buildings,
  machines, animals }` (patrimoine), `assetLog: [{ kind: 'animal'|'machine', id, key?, price, year, day }]` (vente
  de secours), `bestPatrimony`, `lifetime.handPicked`, `lifetime.cropsInSeason: { 'tomato@winter': n }`,
  `buildings[id].paid`, `lots[k].special`, `joseph.loansRepaid`.
- Parcelles : `lot`, `env` (`null` = parcelle retirée par un réaménagement : gardée à son index, réutilisée si le
  terrain redevient un champ), `cell` (position dans le terrain : `col = cell % 4` (verger : 3), `row`), `crow`,
  `crowPenalty` (corbeau non chassé : −50 % à la récolte, posé par CORE-C). Verger : arbres seulement ; champs et
  serre : pas d'arbre ; serre : toutes les cultures en toute saison, ni gel ni pluie ni canicule, pousse × 0,5 en
  hiver (niv. 1-2), × 1,1 toute l'année (niv. 3, chauffage 3 par jour d'hiver).
- Terrains fixes : `home` (type `home` : maison, grenier, étal), `start` (`field`, 16 parcelles dont 12 ouvertes,
  4 à 40 + 10 × n), `yard` (`yard` : poulailler offert à l'emplacement 0, emplacement 1 libre). Terrains achetés
  `lot3`… en friche (`wild`), puis aménagés. Les abris et la chambre d'hôte se posent sur un pré **ou** la basse-cour.
- Animaux : `DEFAULT_ANIMALS` (`src/data/career/buildings.js`, chiffres du § 5, **provisoires**) — les animaux de
  CORE-B (`investments` d'une extension) les remplacent, même id. Prix `base + pas × possédés`, abri obligatoire
  (« L'étable est pleine : améliorez-la. »), 80 au plus. Ateliers : bâtiments (niveau = `state.investments[id]`,
  miroir lu par `processing.js`).

### Actions et requêtes (écarts et ajouts)

- ⚠ Événement `lotDeveloped` : `{ lotId, lotType, cost, plots }` (**`lotType`** et non `type` : le champ `type`
  écraserait le type de l'événement pour les abonnés `on('*')`).
- `game.actions.career` : `buyLot, developLot, build, upgradeBuilding` (construit aussi le grenier et l'étal, bande de
  la maison), `setPlan, setStorageMode, sellStock(cropId = null, n?), renameLot` ; les actions de CORE-B/C du
  contrat (`buyMachine`, `hire`, `collect`, `acceptQuest`…) répondent `{ ok: false, reason: 'Bientôt disponible.' }`
  tant que leur extension ne les fournit pas. Chaque action réussie recalcule le niveau puis vérifie les rangs.
- `game.actions.harvest(i)` en carrière → `{ ok, amount, cropId, tree, processed, stored, handPicked, crowPenalty,
  loanRepayment? }` ; ordre : commande / quête (point d'accroche `harvest`) → atelier → grenier → vente.
- `game.query.career` : contrat + `building(id)` (même ligne que `buildings()`, avec `nextRank`, `nextName`,
  `nextEffects`) ; `buildings()` = bande de la maison (même non construits : niveau 0) + bâtiments construits ;
  `lots()` de bas en haut (maison d'abord), le terrain à vendre en dernier (`forSale`, `canBuy`, `reason`,
  `chargeIncrease`, `lockedByRank`, `special`) ; `summary()` a aussi `farmName, farmerGender, outfit, seasonLength,
  dayOfYear, money, bestPatrimony, paused` ; `charges()` a `dailyTotal` et `season.{ base, lots, scale, seasonId }` ;
  `yearReport(year?)` : année en cours (sans argument) ou historique ; `stock().lines[].unitPrice` (prix du jour,
  sans « à la main »).
- `query.plot(i)` en carrière : aussi `lotType, cell, crowPenalty, handValue` (valeur si récoltée à la main).
- `query.investments()` en carrière : animaux, ruches, panneaux (verrouillés compris, `lockedByRank`, `shelter`,
  `collect`). `query.finance()` : `nextBill` = charges de saison ; `loan: null`.
- `query.achievementContext()` en carrière : `levelId: 'career'`, `stars: 0`, `perksActive: false`,
  `availableInvestments: []`, et `career` (contrat + `animals`, `stockCapacity`, `bestYearNet`, `houseLevel`).
- Événements en plus : `hardship { stage: 'overdraft'|'rescueSold'|'recovered', money, since? }` (`recovered` :
  l'argent est remonté à 50 — employés et machines reprennent) ; `seasonWarning.yearEnd` ; `neighbourLoan.career` ;
  `stockSold.lines: [{ cropId, count, amount }]` ; `loanRepayment.source: 'stock'` ; `harvested.diverted` ;
  `bankrupt { career: true, year, rank, patrimony, farmName, archive }` (Classique ; `archive` est l'entrée à passer
  à `storage.clearCareer({ archive })`) ; `seasonStart.year` ; `dawn.year`.
- Rescue sale : animaux puis machines (une machine part avec ses améliorations) à 50 % du prix payé, du plus récent
  au plus ancien, jusqu'à revenir à 0, **avant** le paiement des charges (le découvert qui suit est d'au plus une
  saison de charges). Jamais terrains, bâtiments, arbres ni employés.

### Rangs (réglage après simulation)

⚠ Deux objectifs changés par rapport au § 1.5 (simulation, joueur tranquille) : rang 2 **« Faire 80 récoltes »**
(id `harvests`, au lieu de 100 : il en fait ≈ 85 la première année) ; rang 3 **« Vendre 20 produits transformés »**
(id `products`, au lieu de 30 : au rang 2 seul l'atelier de confitures transforme). Seuils de patrimoine inchangés.
⚠ Réglage de CORE-C après la simulation complète (employés, machines, événements ; voir « livraison CORE-C ») :
rang 2 **« Faire 60 récoltes »** (le joueur tranquille ramasse aussi les abris et répond aux visiteurs : ≈ 75 récoltes
la 1re année) ; seuil du rang 6 **100 000** (au lieu de 70 000 : Domaine vers l'année 9 pour le joueur tranquille).
L'objectif « 20 produits transformés » est gardé : le blocage venait du robot (plan sans fraises pour la confiturerie).
⚠ Intégration : 15 produits (le débutant restait bloqué au rang 2), avec un conseil dans le Carnet.

### Points d'accroche pour CORE-B et CORE-C (`src/core/career/registry.js`)

Un module d'extension s'enregistre à l'import (`registerCareerExtension(ext)`) ; ajouter son import dans
`src/core/career/extensions.js`. Forme complète de `ext` en tête de `registry.js`. Résumé :

| Point d'accroche | Quand | Rôle attendu |
|---|---|---|
| `init(state)` / `migrate(state)` / `check(state)` | createCareer / loadCareer | compléter et vérifier SES champs de `state.career` |
| `hooks.seasonStart(api, { seasonId, seasonIndex, year })` | aube, nouvelle saison (après le gel) | candidats, naissances de lapins, quête de Joseph, fête |
| `hooks.dawnEvents(api, { seasonId, weather })` | aube, après la météo | événements au hasard, truffes |
| `hooks.water(api, { weather }) → [plotIndex]` | aube, étape 7 | arroseurs, château d'eau, serre |
| `hooks.afterProcessing(api)` | aube, après les ateliers | convoyeur |
| `hooks.incomes(api, { seasonId, weather, lastDayOfSeason, milkToDairy }) → [{ source, amount, kind, key }]` | aube, étape 9 | balades, touristes… (`key` : poste du bilan) |
| `hooks.charges(api, { money, seasonId, estimate }) → [{ source, amount }]` | aube, étape 10 (et `query.career.charges()` avec `estimate: true`) | salaires (`wages`), carburant (`fuel`). **Sans effet de bord** : le cœur prélève ; `wages`/`fuel` ignorés si l'argent est négatif |
| `hooks.dawn(api, { seasonId, newSeason, incomes, charges })` | fin de l'aube | humeur, niveaux, planification des tâches du jour |
| `hooks.tick(api, from, to)` | pendant la journée, tranches (from, to] en secondes | tâches des employés (`doneAt`), passages des machines |
| `hooks.evening(api, { seasonId, lastDayOfSeason, lastDayOfYear })` | début de la fin de journée, avant les charges | comice (dernier jour d'automne), offres qui expirent |
| `hooks.yearEnd(api, { year, report })` | fin d'année, avant l'événement `yearEnd` | compléter le bilan, remettre le calendrier des fêtes |
| `hooks.harvest(api, { plotIndex, cropId, amount, by }) → null \| { divert: true, label }` | avant la vente d'une récolte | commande d'un visiteur, quête (la récolte est mise de côté) |
| `providers.effects(state, key)` | somme | `priceBonus` (vendeur, charrette de Joseph), `growthBonus`, `chargeReduction` |
| `providers.extraPlaces(state, buildingId)` | somme | artisan |
| `providers.priceFactor(state, { kind: 'crop'\|'product'\|'stock', id })` / `seedFactor(state, cropId)` | produit | fêtes, foire aux semis |
| `providers.patrimony(state)` / `lotPrice(state, lot)` / `objective(state, obj)` / `unlocks(rank)` | — | valeur en plus, « verger de Joseph », objectif calculé ailleurs, déblocages affichés |
| `investments: [...]`, `flags: { collectAnimals: true }` | — | animaux de CORE-B ; production à ramasser (le cœur ne paie plus les animaux à l'aube) |
| `actions(api)`, `queries(api)` | création de la partie | ajoutées à `game.actions.career` (enveloppées : fin de partie, flush, rangs) / `game.query.career` (remplacent les valeurs par défaut) |

`api` (un par partie) : `state`, `level`, `crops`, `push(type, payload)`, `fail(reason)`, `notEnoughMoney(n)`,
`changeMoney(delta)`, `earn(key, amount)` (argent + bilan + statistiques), `spend(key, amount, { asset, log })`
(`asset: 'machines'` pour le patrimoine, `log: { kind: 'machine', id, key }` pour la vente de secours), `account`,
`repayJoseph(amount, source)`, `rng('career'|'staff'|'events')`, `seasonId()`, `playing()`, `isPaused()` (coup dur :
employés au chômage technique, machines à carburant arrêtées), `seedCost(cropId)`, `plant(i, cropId, { by })`,
`water(i, { by })`, `harvest(i, { by: 'staff'|'machine' })` (sans le bonus « à la main »), `harvestAmount(i, by)`,
`lot(id)`, `lotPlots(id)`, `refreshLevel()` (après un changement d'amitié de Joseph…), `checkRanks()`, `patrimony()`,
`staffCapacity()`, `storageCapacity()`, `shelterCapacity(id)`, `wouldStore(cropId)`, `addStock(cropId, n)`,
`sellStock(cropId, n, reason)`, `stockUsed()`, `offSeason(cropId)`.

Ce que le cœur attend des extensions dans l'état (déjà créé avec ses valeurs par défaut) : `staff` (longueur =
employés, objectif du rang 3/5), `machines[key] = { id, lotId, level, on, workedDay }`, `joseph.hearts` (4 ♥ / 6 ♥ :
prêt), `joseph.questsDone` (objectif du rang 4), `lifetime.contestsWon` (rang 6, succès), `lifetime.truffles`.

### Sauvegarde et progression

- `storage.js` : `saveCareer(serialized, meta)`, `loadCareer() → { state, meta, savedAt, schema } | null`,
  `loadCareerBackup()`, `careerMeta()`, `clearCareer({ archive })` (archive puis efface la carrière et sa copie) ;
  copie de secours = la sauvegarde précédente si elle se relit (`migrateCareer` + `checkCareerState`) et date d'un
  autre jour de jeu que la copie actuelle ; `resetProgress()` efface aussi la carrière.
- `progression.js` : `progress.career = { started, bestRank, bestYear, years, archive }` ; `recordCareerStart(p)`
  (succès « Première pierre ») ; `recordCareerYear(p, { year, rank, net, report, career? })` → écus
  `ecusForCareerYear` (10 + 3 × rang + min(20, ⌊bénéfice / 1 000⌋) + 10 avec le Manoir), récoltes et produits de
  l'année ajoutés aux cumuls, `bestYear = year + 1` ; `recordCareerRank(p, rank)` (20 × rang écus) ;
  `archiveCareer(p, entry)` ; `careerAchievementList(p, ctx)`.
- ⚠ Succès : `ACHIEVEMENTS` reste la liste des niveaux (26) et `achievementList` aussi ; `CAREER_ACHIEVEMENTS` (17,
  440 écus, `category: 'career'`, sans étoile) et `ALL_ACHIEVEMENTS` (43, parcourue par `checkAchievements`,
  `unlockAchievements`, `getAchievement`) ; `careerAchievementList` pour la section « Carrière » de la grange.

### Simulation (`tools/simulate-career.js`)

`node tools/simulate-career.js [--strategy casual|optimal] [--runs 20] [--years 10] [--difficulty classique]
[--season 14] [--assume-objectives] [--trace --seed 3] [--json]` ; exporte `playCareer(opts)` et
`simulateCareer(opts)`. Sans CORE-B/C, les objectifs « employés », « quêtes » et « comice » ne se remplissent pas
(rang plafonné à 2) : `--assume-objectives` les suppose remplis pour mesurer le rythme du patrimoine.


## Mode Carrière — livraison CORE-B (machines, employés, animaux, tâches, 2026-09-30)

Quatre extensions enregistrées (`src/core/career/extensions.js`, une ligne chacune) : `animals`, `machines`,
`staff`, `work`. Tout passe par les points d'accroche de CORE-A (`registry.js`) ; aucune ligne des niveaux ne change.
Tests : `tests/career-{animals,machines,staff,tasks}.test.js` (51), outils `tests/career-crew-helpers.js`.

### Fichiers

```
src/data/career/animals.js    CAREER_ANIMALS (8, remplacent DEFAULT_ANIMALS, mêmes ids) : product, productName, collect,
                              truffles, breeding, rides, traction ; COLLECT.capDays = 3
src/data/career/machines.js   MACHINES (8) : scope 'lot' | 'shelter' | 'farm', lotTypes, levels [{ cost, rank, capacity,
                              requires: null | 'puller' | 'tractor', text }], fuel, upkeep, passes, kind, step ; machineKey()
src/data/career/staff.js      JOBS (4), TRAITS (7, ids = icônes icon.career.trait.*), MOODS, XP_LEVELS, WAGE,
                              GARDENER_ACTIONS, WORK (heures, durées, bonus), XP_GAIN, ARTISAN_PLACES, CANDIDATES
src/data/career/names.js      FIRST_NAMES (40 prénoms, 20 f / 20 m : les 24 du § 7.1 + 16), genderOf, LOOK (64 apparences),
                              lookId(look) (= lookKey de l'atlas), validLook
src/core/career/crew.js       outils communs (sans enregistrement) : absDay, state.career.work, pausedOf, keeperBonus,
                              gardenerDuration / actionsPerDay, effectiveLevel (cheval / tracteur), serpentin, sowChoice
src/core/career/animals.js    extension « animals » : production à ramasser, collect / collectAll, naissances, truffes,
                              tonte, balades ; exporte collectShelter(api, id, by)
src/core/career/machines.js   extension « machines » : achat / amélioration / interrupteur, aube (semoir, arroseurs,
                              château d'eau), convoyeur, passages (startPass, doRunStep), carburant et entretien
src/core/career/staff.js      extension « staff » : candidats, embauche, renvoi, affectation, congés, salaires, humeur,
                              expérience, artisan (places), vendeur (bonus) ; exporte cheerStaff(api) (fête : CORE-C)
src/core/career/work.js       extension « work » : moteur des tâches (point d'accroche tick), workPlan()
tools/sim-career-staff.js     robots : staffDecisions(game, me) (utilisé par simulate-career.js), crewDay, automatedLots
```

### État (en plus du contrat)

- `state.career.staff[k]` : contrat + `look.gender` ('m' | 'f', suit le prénom), `leaveDays`, `hiredDay`, `suggestedJob`,
  `plan: { round, queue }` (tournées du soigneur), `year: { actions, harvests, watered, sown, crows, collected, sold,
  xp, wages, daysWorked }`. `lotId` : id de terrain, `'all'` (jardinier, soigneur) ou `'home'` (vendeur). `xp` peut être
  décimal (« Vif » × 1,5). `joyUntilDay` : jour absolu (joyeux tant que jour < joyUntilDay).
- `state.career.candidates[k]` : `{ id: 'c<n>', name, look, trait, level, xp, wage, suggestedJob }` ; ids de candidats et
  d'employés tirés du même compteur `nextStaffId` (`c3` → `s4`). 3 candidats dès la création (flux `staff`).
- `state.career.machines[key]` : contrat + `usedDay`, `used` (capacité du jour), `buildingId` (collecteur). Clés :
  `<id>@<lotId>`, `collector@<abri>` (⚠ par abri, pas par terrain), `tractor` / `waterTower` / `conveyor` (terrain
  `'home'`).
- `state.career.work = { day, runs: [passage], fuel: { [jour]: { [key]: carburant } }, stats, year }` ; passage =
  `{ key, id, lotId, kind, puller, startAt, endAt, plots: [{ index, at, done, ok }] }`. `stats` / `year` : actions des
  employés et des machines, produits animaux perdus (abri plein), ramassages par `player | keeper | collector`,
  salaires et carburant de l'année (simulation).
- Jour absolu : `absDay(state) = (year − 1) × 4 × seasonLength + day`.

### Actions (`game.actions.career.*`)

| Action | Retour | Notes |
|---|---|---|
| `collect(buildingId)` | `{ ok, amount }` | abri construit, production > 0 |
| `collectAll()` | `{ ok, amount, count }` | ajout : glisser sur les abris |
| `buyMachine(id, place?)` | `{ ok, key, cost, level }` | `place` : terrain (machines de terrain), abri **ou** terrain (collecteur : 1er abri libre du terrain), rien (ferme) |
| `upgradeMachine(id \| key, place?)` | `{ ok, key, level, cost }` | niveau 2 : rang 4 (arroseurs : rang 2) |
| `setMachine(id \| key, place, on)` | `{ ok, key, on }` | aussi `setMachine('tractor', false)` ou `setMachine(key, on)` |
| `hire(candidateId, job?, lotId?)` | `{ ok, staffId, staff }` | ⚠ affectation directe possible (sinon sans métier : repos à la maison, salaire payé) |
| `fire(staffId)` · `assign(staffId, job, lotId)` · `setLeave(staffId, on)` · `setTeamLeave(on)` | `{ ok, … }` | `assign(id, null)` : sans métier ; vendeur : `lotId` ignoré (`'home'`) |

### Requêtes (`game.query.career.*`)

- `machines()` : contrat + `scope, lotName, buildingId, working, why` (raison de l'arrêt : éteinte, coup dur, pas de
  cheval…), `effectiveLevel, puller ('horse'|'tractor'|null), capacity (null = tout le terrain), usedToday, workedToday,
  nextRank, nextText, text, upkeep, coverage` (arroseurs : parcelles couvertes), `passes, run` (passage en cours).
  `machine(key)` : une ligne.
- `machineCatalog()` : contrat + `scope` (⚠ `'shelter'` pour le collecteur), `lockedByRank, fuel, upkeep, phase, levels,
  places: [{ place, lotId, buildingId, name, key, owned, canBuy, reason }], owned`.
- `machineWork()` : passages en cours (copie de `work.runs`, pour reprendre l'animation après un chargement).
- `staff()` : contrat + `gender, levelXp, status ('working'|'leave'|'noMoney'|'unassigned'), assignable: [{ job, name,
  lots: [{ lotId, name, type }] }]` ; `staffMember(id)` ; `candidates()` : contrat + `wages` (salaires par jour) ;
  `jobs()`, `traits()` (textes).
- `shelters()` / `shelter(id)` : `{ buildingId, name, level, lotId, slot, animalId, animalName, count, capacity, product,
  productName, collect, pending, dailyValue, cap, pendingDays, full, keeperBonus, lastCollected, collector, keepers }`
  (bulle de ramassage : `product` → sprite `product.<id>`, `pending` → montant).
- `workPlan()` : `[{ staffId, name, look, job, lotId, status, mood, actionsToday, task, tool }]` ; `tool` : sprite
  `tool.<can|basket|seedbag|pail|hoe>` tenu ; `workClock()` : `{ elapsed, day, daySeconds }`.

### Tâches et animation (lu par RENDER)

- `task = { kind, target, from, startAt, doneAt, lotId }` en secondes écoulées dans la journée (`state.time.elapsed`).
  Le rendu fait marcher le personnage de `from` vers `target` (par exemple pendant les 60 premiers % de la tâche) puis
  joue l'action jusqu'à `doneAt` ; à ×4 le temps de jeu va 4 fois plus vite, rien à faire de plus.
- `kind` : `harvest | pick | water | sow | chase` (jardinier), `collect` (soigneur), `craft` (artisan), `sell` (vendeur),
  `idle` (attente sur place : flâner près de la cible), `home` (retour à la maison) ; `task: null` : à la maison.
- `target` / `from` : `{ type: 'plot', plotIndex, lotId }` · `{ type: 'building', buildingId, lotId }` ·
  `{ type: 'lot', lotId }` · `{ type: 'home', lotId: 'home' }`.
- Jardinier : de 15 % (« Matinal » 5 %) à 85 % du jour ; durée d'une action = 70 % du jour ÷ actions (14 / 18 / 22 / 26 /
  30 × humeur × Costaud × tracteur × « tous » 0,8). Priorité : corbeau (via `chaseCrowAt` de CORE-C) > récolte >
  arrosage > semis (plan, `sowChoice`) ; sinon `idle`. Deux employés ne visent jamais la même parcelle ; une parcelle
  prise par un passage de machine est réservée. **Machines avant employés** : pas de récolte (semis) sur un terrain où
  la moissonneuse / cueilleuse (le semoir) passera encore aujourd'hui ; ensuite, il fait le reste.
- Soigneur : tournées à 25 %, 55 %, 85 % (3 % du jour par abri) ; artisan : séances de 10 % à tour de rôle dans les
  ateliers de sa cour ; vendeur : grenier (4 %) puis étal (15 %), vend si cours ≥ 1,15 − 0,02 × (niv. − 1), hors saison
  ou jour de fête (fournisseur `priceFactor` de `stock` > 1, raison `fair`).
- Action faite à `doneAt` si elle est encore utile ; sinon `taskDone.result.ok = false`, pas d'expérience.
- Événements : `taskStarted { staffId, kind, target, from, startAt, doneAt, lotId, job }`,
  `taskDone { staffId, kind, target, startAt, doneAt, result: { ok, amount?, cropId?, … } }`.
- Machines : `machineWorked { key, id, lotId, kind, plots: [{ index, at }], fuel, puller, startAt, endAt, dawn?,
  buildingId?, amount?, moved?, count? }` au départ du passage (moissonneuse, semoir : rang par rang en serpentin, une
  parcelle toutes les 1,2 % / 1 % du jour, chacune traitée à son `at` ; aube et arroseurs : `at: 0`) ;
  **ajout** `machineRunDone { key, id, lotId, kind, count }` à la fin du passage (retour au garage).
- Un grand `dt` et beaucoup de petits donnent exactement la même partie (tests) ; sauvegarde possible en pleine tâche ou
  en plein passage.

### Règles chiffrées (données, réglables)

- Salaires 8 + 3 × (niv. − 1) (« Économe » −2), payés à l'aube (point d'accroche `charges`, source `wages`) pour chaque
  employé pas en congé, à partir de l'aube qui suit l'embauche ; rien pendant un coup dur (`idleReason: 'noMoney'`).
- Expérience : jardinier 1 par action utile, soigneur 2 par abri ramassé non vide, artisan 2 par produit vendu à l'aube
  par un atelier de sa cour, vendeur 1 par 10 pièces ; niveaux 100 / 300 / 700 / 1 500 ; `staffLevelUp.text`.
- Humeur : joyeux 7 jours après un congé ≥ 2 jours ou `cheerStaff` (fête du village, appelé par CORE-C) ; las après
  21 jours de travail d'affilée (28 dès la grande maison), jamais pour « Fidèle » ; ±10 % d'actions.
- Artisan : places + 1 / + 1 / + 2 / + 2 / + 2 (fournisseur `extraPlaces`, meilleur artisan de la cour, pas en congé) ;
  niv. 5 : produits de sa cour × 1,1 (fournisseur `priceFactor`, `kind: 'product'`). Quand la capacité baisse (départ,
  congé), les produits en cours sont tassés ; ce qui ne tient plus est vendu en l'état (`processingSoldRaw`, raison
  `artisan`) — la sauvegarde reste valide.
- Vendeur : fournisseur `effects('priceBonus')` = 0,02 × niveau (+ 0,03 « Bavard »), un seul vendeur compte.
- Soigneur : production des abris de ses terrains × (1 + 0,05 × niveau (+ 0,05 « Ami des bêtes »)), le meilleur compte.
- Animaux : production ajoutée à `buildings[abri].pending` à l'étape 9 (moins le lait parti à la fromagerie) ; plafond
  3 jours (`COLLECT.capDays`), surplus perdu (`shelterFull { buildingId, lost, pending, cap }`) ; tonte payée à l'aube
  du dernier jour de saison (le drapeau `collectAnimals` fait sauter la tonte de CORE-A : c'est CORE-B qui la paie) ;
  truffes au point d'accroche `dawnEvents` (flux `career`) ; naissances au `seasonStart` ; balades (+8, poste `guests`).
- Machines : carburant noté le jour du travail et payé à l'aube suivante (un jour de travail = au moins une parcelle) ;
  tracteur : 4 les jours où il tire une machine ; entretien (source `upkeep`) : arroseurs 1 (même éteints, 0 avec le
  château d'eau allumé), convoyeur 1 (allumé). Coup dur : semoir, moissonneuse, cueilleuse, tracteur à l'arrêt.
- Niveau effectif : niv. 2 « tracteur » sans tracteur → niv. 1 avec un cheval ; niv. 1 « cheval ou tracteur » → cheval
  d'abord (pas de carburant de tracteur), sinon tracteur.
- Plan « même culture » : la dernière culture récoltée sur la parcelle si elle se sème encore, **sinon la plus rentable
  sûre de la saison** (⚠ précision : parcelle neuve, changement de saison) ; culture choisie qui gèlerait → la plus
  rentable qui résiste ; jamais sans l'argent de la graine.

### Écarts au contrat (à connaître)

- Collecteur par **abri** (`collector@coop`), `scope: 'shelter'` dans le catalogue.
- `hire(candidateId, job?, lotId?)` accepte l'affectation ; `setMachine` accepte une clé.
- `workPlan()` renvoie plus que `{ staffId, task, pos? }` (pas de `pos` : le rendu calcule la position).
- Nouveaux événements : `shelterFull`, `machineRunDone`, `staffAssigned { staffId, job, lotId }`, `staffLeave { staffId,
  on }` ; `truffleFound { count, amount, stored, buildingId }` ; `animalBorn { …, buildingId, total }`.
- Paused (chômage technique) n'enlève pas les places de l'artisan (seuls le congé et le départ les enlèvent).
- CORE-A : deux assertions de `tests/career-core.test.js` et une de `tests/career-save.test.js` décrivaient l'état
  « avant CORE-B » (œufs payés à l'aube, `hire` « Bientôt disponible ») : mises à jour (œufs ramassés).

### Simulation

`tools/sim-career-staff.js` exporte `staffDecisions(game, me)` (chargé automatiquement par `simulate-career.js` de
CORE-C) : employés sans affectation remis au travail ; cheval (écurie) pour tirer semoir et moissonneuse avant le
tracteur ; machines niv. 2 avec le tracteur ; collecteur du poulailler et cueilleuse (rang 3), château d'eau (rang 5) ;
réserve de 2 saisons de charges + 14 jours de salaires. Aussi `crewDay` (robot autonome complet) et `automatedLots`.

## Mode Carrière — interface livrée (lot UI, 2026-09-30)

```
src/ui/career/index.js     createCareerUI(app) → app.careerUI : active(), bind(game, { resumed, created }), unbind(),
                           onGameEvent(ev), processPending(), openTab(id), activeTab(), onHit(hit, { long }),
                           onPlotTap(i) (corbeau), open.{shop,map,lot,buildOptions,plan,building,storage,team,
                           employee,hire,journal,charges,quest,offer}, q(name, défaut, ...args), act(name, ...args)
src/ui/career/menu.js      careerMenuButtons(app, btn) (menu principal), openNewFarm(app, { replacing })
src/ui/career/shop.js      Acheter (sections repliables) ; buildingCard, effectsText, requiresText
src/ui/career/lots.js      carte, fiche de terrain, construire sur un emplacement, plan de culture d'une saison
src/ui/career/buildings.js fiche de bâtiment, « Grenier et marché » (marketSection)
src/ui/career/staff.js     équipe, fiche d'un employé, candidats
src/ui/career/journal.js   Carnet (Ferme · Bilan · Marché · Agenda · Joseph), fiche des charges
src/ui/career/events.js    cartes d'offre (forme offerInfo de CORE-C) et de quête
src/ui/career/windows.js   fenêtres en file : faillite → prêt → vente de secours → coup dur → rang → bilan annuel,
                           puis le bandeau de la saison ; intro (3 bulles de Joseph), au revoir d'un employé
src/ui/career/util.js      icônes (icon.career.*, portraits, blasons), boutons d'achat, barres, sections repliables
```

- **Feuilles vivantes** : une feuille de carrière est reconstruite (au plus une fois par image, après chaque événement)
  seulement si son HTML change, et jamais pendant qu'un doigt est posé dessus. Requêtes protégées (`q`) : requête
  absente ou en erreur → valeur par défaut ; actions (`act`) : refus → message d'erreur, réussite → vibration.
- **main.js** : `wire(game)` envoie les événements de carrière à `app.careerUI.onGameEvent` (les messages des niveaux
  ne servent que pour `frost`, `harvested`, produits, prêt de Joseph, concours) ; `processPending()` de carrière :
  remise des prix du comice (`contestAwarded`, titre « Comice agricole »), puis `careerUI.processPending()`.
  `save()` → `storage.saveCareer(state, careerMetaOf(game))` (aube, gros achats via `app.saveNow`, bilan, arrière-plan).
  `startRun(game, { resumed, created })` : en carrière, pas de panneau des niveaux ni de tutoriel ; `app.tabbar.setTabs(CAREER_TABS)`.
  `app.startCareer(opts, { archiveExisting })` (+ `recordCareerStart`), `app.continueCareer()` (copie de secours
  proposée si illisible ; code `newer` : message, rien n'est effacé), `app.restartCareer()` (archive puis création),
  `app.careerEnded(ev)` (faillite Classique : `storage.clearCareer({ archive: ev.archive })`), `app.savedCareerInfo()`.
  `app.revealLot(lotId, sheetId)` → `scene.focusLot` (le terrain reste visible au-dessus de sa feuille) ;
  `scene.setCareer(on)` à la création de la scène, au lancement et après lotBought / lotDeveloped / buildingBuilt /
  buildingUpgraded / rankUp. `body.is-career` (styles), `body.has-dialog` (les messages passent sous les fenêtres).
- **Barre du haut** (`hud.js`, `#hud.is-career`) : « An N · j/L », charges de saison, case `#hud-rank` (blason +
  progression moyenne patrimoine / objectifs → Carnet) ; fiches « Argent » et « Charges » propres à la carrière.
- **Onglets** (`tabbar.js`) : `setTabs(list | null)`, `setLocked(id, on)` ; carrière : `farm, buy, staff, journal, menu`.
- **Gestes** (`gestures.js`) : les cibles `lotSign` (avec `slot` : emplacement vide → construire), `lotForSale`,
  `shelter` (ramasser, sinon fiche), `building`, `machine`, `employee`, `pond` (pêcher), `crow`, `joseph` vont à
  `careerUI.onHit` ; appui long → fiche ; toucher d'une parcelle marquée d'un corbeau → `chaseCrow`.
- **Progression** (`progress.js`) : `careerStart()`, `careerYear(run)`, `careerRank(rank)` (succès annoncés),
  `careerAchievementList(ctx)` (grange, section « Ma ferme (carrière) » + anciennes fermes archivées).
- **Conseils** (`hints.js`) : `career.start`, `collect`, `lotForSale`, `plan`, `hire`, `leave`, `machine`, `storage`,
  `quest`, `crows`, `yearEnd` (`who: 'joseph'` : portrait de Joseph).
- **Débogage** : `__debug.career()`, `careerStart(opts)`, `careerSkipYears(n)`, `careerRank(n)`, `careerMoney(n)`,
  `careerEvent(id)` (→ `actions.career.triggerEvent`), `lotPoint(id)`.
- Pas encore fait : « Suivre le tutoriel » en carrière, modifier le décor propre à la carrière (`career.cosmetics.decor` :
  pas d'action du cœur ; il est affiché depuis l'intégration), ramassage en série (`collectAll`). (Ferme de carrière
  derrière le menu : faite à l'intégration.)

## Mode Carrière — livraison RENDER (scène, 2026-09-30)

- `src/render/layout-career.js` (pur) : `createCareerLayout(level, { career, plots, investments })`, choisi par la scène
  quand `game.state.mode === 'career'` (pas par `createLayout`). Même forme que les dispositions des niveaux (`plots`
  à l'index du cœur, `plotRect`, `fieldRect` = champ de départ, `house`, `decorSlots` aux ids v3…) + `lots` (de haut en
  bas : terrain à vendre, terrains achetés, `yard`, `start`, `home` ; `rect` px, `sign` tuiles, `lane`), `slots[buildingId]`
  (`building`, `pen`, `anchor`, `bubble`, `kind`, `sprite`), `emptySlots`, `machineParking[key]`, `hives`, `sprinklers`,
  `route(a, b)`, `hitTestCareer(wx, wy, state, slop)`, `hitRect(hit)`. `careerLayoutKey(state)` : la scène reconstruit
  quand elle change (terrains, bâtiments, niveaux, machines, parcelles, rang 6) ; `careerWorldRows(n)` = 53 + 11 n.
- `src/render/career-actors.js` : lit `state.career.staff[].task` (cibles `{ type: 'plot'|'building'|'lot'|'home' }`),
  `state.career.work.runs` (passages, `puller`), `state.plots[].crow`, `state.career.quest`, `events.offers`,
  `events.active`, `events.today`, `pets`, `buildings[].pending`. Rien n'est modifié.
- Scène : `focusLot(lotId, { animate, align })`, `focusHouse(opts)`, `focusBuilding(id, opts)`, `lotRect(id)`,
  `lotScreenRect(id)`, `setCareer(on)` (facultatif : la reconstruction est automatique), `careerStats()`, `careerMode` ;
  `hitTest` → `lotSign` (+ `slot` : emplacement libre), `lotForSale`, `shelter` (abri, enclos ou bulle), `building`,
  `machine` (garée), `employee`, `pond`, `crow` (prioritaire sur la parcelle), `joseph`, `visitor { offerId, kind }`,
  `investment` (ruche, panneau), `plot`. Les événements de carrière passés à `onEvent` sont traités après la
  reconstruction de la disposition (positions à jour).
- Tampon fenêtré en carrière (vue = écran, couche fixe = tout le monde) ; mode Niveaux inchangé au pixel près.

## Mode Carrière — livraison CORE-C (événements vivants, Joseph, comice, simulation, 2026-09-30)

Deux extensions (`registerCareerExtension`), une ligne d'import chacune dans `src/core/career/extensions.js` :
`events` (fêtes, comice, événements au hasard, offres, corbeaux, pêche) et `quests` (quêtes et amitié de Joseph).
Tout vit dans `state.career` (sauvegardé tel quel) ; tous les tirages passent par le flux `events` ; aucune règle
n'est lue par une partie de niveau. Tests : `tests/career-{events,quests,show,simulate}.test.js`.

### Fichiers

```
src/data/career/events.js    CALENDAR_EVENTS (4 fêtes), CONTEST + CONTEST_GOAL_POOL (comice), RANDOM_EVENT_RULES,
                             RANDOM_EVENTS (8, poids), VISITOR, TOURISTS, CROWS, RAINBOW, DEW, MERCHANT_ITEMS, PETS,
                             JOSEPH_GIFT, FISH
src/data/career/quests.js    QUEST_RANK, QUEST_TEMPLATES (5), QUEST_REWARD, EGG_VALUE, MAX_HEARTS, JOSEPH_HEARTS
                             (paliers 2/4/6/8/10), JOSEPH_ORCHARD, JOSEPH_CART, JOSEPH_LINES (répliques de Joseph)
src/core/career/events.js    extension « events » ; exporte dayIndex, festivalToday/Tomorrow, contestInfo,
                             chaseCrowAt(api, i, by), eggsCountable, cropPlural, baseCropPrice…
src/core/career/quests.js    extension « quests » ; exporte addHeart(api, reason), questInfo, productPlural
tools/simulate-career.js     robots casual / novice / optimal / idle / automator, --matrix
```

### État (en plus du contrat)

```js
state.career.events = { active, offers, calendarDone, fishedDay /* jour absolu */, lastKind,
  today: null | 'seedFair' | 'villageFete' | 'harvestFestival' | 'christmasMarket',   // fête du jour
  nextOfferId, eggs /* œufs ramassés (cumul) */, eggSeen, fertilizer: null | { lotId, left, growth },
  year: { visitors, visitorIncome, tourists, touristIncome, crowsChased, crowsMissed, fish, fishIncome, gifts, events } }
active = { id, kind /* id de RANDOM_EVENTS */, day, endDay /* jours absolus */, data }
offers[k] = { id: 'offer7', kind: 'visitor' | 'merchant' | 'pet', day, endDay, accepted, delivered, data }
state.career.contest = null | { year, rank, goals: [{ id, type, label, target, base, cropIds?, productIds?, tree?,
  notified }], judgeDay, prizePerGoal, judged, result: null | { goalsMet, amount, all, goals } }
state.career.quest = null | { id, templateId, type, need: { type, id, n }, progress, accepted, offeredDay, endDay,
  base, value, what, text, reward: { money, ecus, hearts } }
state.career.joseph = { hearts, questsDone, gifts, loansRepaid (CORE-A), loanHearts, festivalHeartYear, onceDone,
  orchardDone, nextQuestId, questsThisYear, ecusThisYear, heartLog }
state.career.pets = { cat, dog }
```

« Jour absolu » = `(année − 1) × 4 × durée des saisons + jour de l'année` (même règle que `absDay` de CORE-B).

### Déroulé

- **seasonStart** : été (rang ≥ 2) → annonce du comice (3 épreuves possibles et distinctes, `contestAnnounced`) ;
  chaque saison (rang ≥ 2, pas de quête en cours) → quête de Joseph (`questOffered`).
- **dawnEvents** (après la météo) : œufs ramassés observés ; engrais ; pénalité des corbeaux non chassés
  (`plot.crowPenalty`, fin de l'événement) ; fête du jour (`festival`, `events.today`, `cheerStaff` de CORE-B le jour
  de la fête du village) ; tirage du jour (30 %, jamais les 3 premiers jours ni un jour de fête, jamais deux fois le
  même d'affilée, un seul actif) ; +1 ♥ à la fête des récoltes si une quête est acceptée ; quêtes « passives ».
- **tick** : 3 passages des touristes (30 %, 55 %, 80 % du jour) ; œufs ; quêtes passives ; cœur du prêt remboursé.
- **incomes** : chambre d'hôte × 2 le jour de la fête du village (poste `guests`, source `festival`).
- **evening** : offres échues (`offerResolved { outcome: 'expired' }` ; ce qui a été mis de côté est payé au prix
  normal) ; comice jugé le soir du dernier jour d'automne, avant les charges (`contestAwarded`) ; quête échue le soir
  du dernier jour de la saison (`questExpired`).
- **harvest** : récolte mise de côté pour un visiteur (commande acceptée, même culture) puis pour Joseph (quête
  « culture » ou « fruits ») → `harvested.diverted` = « → Mme Leblanc » / « → Joseph ».
- **yearEnd** : `report.events` (compteurs, fêtes, comice), `report.joseph` et `report.questEcus` ; calendrier remis
  à zéro.
- **Fournisseurs** : `priceFactor` (fête du village : récoltes × 1,25 ; fête des récoltes : tout × 1,15 ; marché de
  Noël : produits × 1,5, grenier × 1,25) ; `seedFactor` (foire aux semis × 0,75, semoir compris) ;
  `effects('growthBonus')` (arc-en-ciel + 0,1) ; `effects('priceBonus')` (charrette de Joseph + 0,05 à 10 ♥) ;
  `lotPrice` (verger de Joseph à 8 ♥ : terrain suivant à moitié prix) ; `objective(quests)` ; `unlocks(2)`.

### Actions (`game.actions.career.*`)

```js
chaseCrow(plotIndex) → { ok, plotIndex }             // crowChased { plotIndex, by: 'player' }
fish() → { ok, amount, fishId, name }                  // mare ; une fois par jour ; fishCaught
acceptOffer(offerId, lotId?) / declineOffer(offerId) / deliverOffer(offerId)
   // visiteur : accepter (offerAccepted), livrer du grenier (offerProgress, puis offerResolved 'delivered')
   // marchand : acheter (engrais : lotId optionnel, sinon le champ le plus semé ; 2 poules ; ruche) ; animal perdu
acceptQuest() → { ok, quest, line } / declineQuest() → { ok, line } / deliverQuest() → { ok, delivered, done }
buyLot()        // ⚠ remplace celui de CORE-A (même résultat) : « Le verger de Joseph » est aménagé tout de suite
                // (verger, 4 pommiers adultes, lotDeveloped { gift: 'josephOrchard' }, josephOrchard) → + lotType
triggerEvent(id) // débogage (__debug.careerEvent) et tests : lance un événement si sa condition est remplie
```

### Requêtes (`game.query.career.*`)

```js
events() → { today, tomorrow /* fête : { id, name, text, icon, seasonId, day, factors, seedFactor } */,
  active: null | { id, kind, name, icon, day, endDay, text, data },
  offers: [offerInfo], calendar: [{ id, name, text, icon, seasonId, day, rank, locked, today, done, daysUntil }],
  contest, fishing: { pond, fishedToday }, fertilizer, pets, crows: [plotIndex] }
offerInfo = { id, kind, title, icon, text, detail, acceptLabel, declineLabel, accepted, daysLeft, endDay, data,
  // visiteur : delivered, n, inStock, canDeliver, reward ; marchand : price, canAccept }
contest() → null | { name, year, rank, goals: [{ id, label, target, progress, done }], prizePerGoal, bonusAll,
  maxPrize, daysLeft, judged, result }
festival() → fête du jour ou null
quest() → null | { id, templateId, type, text, what, need, progress, left, reward: { money, ecus, hearts },
  daysLeft, accepted, canDeliver, inStock, line, portrait }
joseph() → { hearts, maxHearts, questsDone, nextGift, tiers: [{ hearts, id, name, text, reached }],
  orchard: { offered, done }, cart, title, portrait, quest, loan /* forme de finance().neighbourLoan */ }
```

### Événements (ajouts et formes)

| Type | Données |
|---|---|
| `festival` | `{ id, name, text, icon, seasonId, day }` (aube du jour de fête) |
| `careerEvent` / `careerEventEnded` | `{ id, kind, name, icon, text, data }` / `{ id, kind, reason: 'ended'\|'chased'\|'delivered'\|'declined'\|'expired'\|'accepted'\|'replaced', data }` (corbeaux : `data.penalized`) |
| `offer` / `offerAccepted` / `offerProgress` / `offerResolved` | `{ offerId, kind, data: offerInfo }` / idem / `{ offerId, delivered, n, fromStock? }` / `{ offerId, kind, outcome, amount?, … }` |
| `crow` / `crowChased` | `{ plots }` / `{ plotIndex, by }` |
| `touristsPassed` | `{ amount, pass, passes }` |
| `fishCaught` | `{ fishId, name, amount }` |
| `contestAnnounced` / `contestProgress` / `contestAwarded` | `{ career: true, year, goals, prizePerGoal }` / `{ career: true, goalId, label, progress, target, done }` / `{ career: true, year, amount, goalsMet, goals, all, contestsWon }` |
| `questOffered` / `questProgress` / `questDone` / `questExpired` | `{ quest: questInfo, line? }` ; `questDone` + `amount, ecus, hearts` ; `questExpired` + `accepted, declined?, amount` |
| `josephHeart` | `{ hearts, reason: 'quest'\|'loan'\|'festival', line, unlock: null \| { id, name, text, line }, gift? }` |
| `josephOrchard` | `{ lotId, trees, line }` |

### Règles chiffrées (réglées par la simulation)

- Fêtes : foire aux semis (printemps j. 3), fête du village (été j. 4), fête des récoltes (automne j. 2), marché de
  Noël (hiver j. 4, rang ≥ 2) ; mêmes jours quelle que soit la durée des saisons.
- Comice : prix 100 × rang par épreuve + autant si les 3 sont réussies, × 2 au rang 6 ; épreuves : citrouilles
  (4 + rang), produits (6 + 3 × rang), fromages (2 + rang), fruits (4 + 2 × rang), œufs ramassés (10 × rang, seulement
  avec le ramassage de CORE-B), truffes (rang ; ≥ assez de cochons), stock (15 × rang, grenier ≥ 1,5 × la cible),
  et toujours possibles : récoltes (30 + 15 × rang), tomates (6 + 2 × rang), pommes de terre (6 + 3 × rang).
- Au hasard (poids) : visiteur 30 (4 à 7 récoltes, 3 à 5 si ≥ 40 pièces, × 1,5, 2 jours), touristes 15
  (5 × (1 + attrait) × 3 ; attrait = chambre d'hôte, chevaux, mare), corbeaux 15 (1 à 3 parcelles, ≥ 12 semées, hors
  hiver, −50 %), arc-en-ciel 10 (+10 % de pousse), rosée 10, marchand 10 (engrais 150 : +0,25 jour de pousse × 3
  aubes sur un champ ; 2 poules 40 ; ruche 40), animal perdu 5, cadeau de Joseph 5 (≥ 2 ♥ : 8 parcelles semées
  gratuitement, sinon 30 pièces). Pêche : 5 à 40 pièces.
- Quêtes : culture (6 + 2 × rang, récompense 1,5 × valeur), produit (4 + rang, 0,5 × valeur : déjà vendus), œufs
  (8 × rang, 1,5 × 2 par œuf), fruits (4 + rang, 1,5 ×), pommiers (2, une fois, 1,5 × prix des plants) ; + 3 écus
  et +1 ♥.

### Écarts au contrat (à connaître)

- ⚠ Les **écus des quêtes** ne sont pas versés par le cœur (la progression est hors de la partie) : `questDone.ecus`
  (3) et `yearEnd.report.questEcus`. ✓ Intégration : l'interface les verse à `questDone` (`recordCareerEcus`) ;
  `report.questEcus` n'est qu'un rappel affiché au bilan (`recordCareerYear` ne les ajoute pas).
- `buyLot` est remplacé par l'extension « quests » (même comportement, + verger de Joseph).
- Épreuve « œufs » : œufs **ramassés** (baisse de la valeur en attente du poulailler et de la mare, 1 œuf = la
  production d'un animal pour un jour) ; retirée du tirage sans le lot CORE-B. Quête « œufs » : idem.
- Quêtes « produit » et « œufs » : comptées sans détourner les ventes (il n'y a pas de point d'accroche sur la vente
  d'un produit) ; la récompense ajoute la moitié de la valeur (produits) — total ≈ 1,5 × comme les autres.
- Nouveaux événements : `festival`, `touristsPassed`, `offerAccepted`, `offerProgress`, `contestAnnounced`,
  `josephOrchard`. `contestAwarded` et `contestProgress` portent `career: true` (ne pas les confondre avec le
  concours du niveau 12).
- Employés : `cheerStaff(api)` de CORE-B est appelé le jour de la fête du village ; les jardiniers chassent les
  corbeaux eux-mêmes (`chaseCrowAt` exporté pour eux).

### Simulation (`tools/simulate-career.js`)

`node tools/simulate-career.js [--strategy casual,novice,optimal,idle,automator] [--runs 20] [--years 10]
[--difficulty classique] [--season 7|10|14] [--matrix] [--assume-objectives] [--trace --seed 3] [--json]` ;
exporte `playCareer`, `simulateCareer`, `loadStaffHelper`, `STRATEGIES`, `CAREER_PROFILES`. Les décisions d'équipe et
de machines de CORE-B (`tools/sim-career-staff.js`, `staffDecisions`) sont chargées automatiquement. Budget de gestes
par jour (glisser : 1 + 0,25 par parcelle ; semer partout : 3 ; ramasser, chasser, pêcher : 1 ; offre ou quête : 2 ;
achat : 3) : casual 7-11, novice 4-8, optimal ≤ 40. Résultats : `docs/CARRIERE.md` § 13.4.

## Mode Carrière — intégration (2026-09-30)

Corrections et réglages après l'assemblage des cinq lots (tests : `tests/career-integration.test.js`).

- **Écus des quêtes** : `progression.recordCareerEcus(p, n) → { progress, rewards: { ecus } }` (borné à 0..1000) ;
  `app.progression.careerEcus(n)` appelé par `careerUI` à `questDone`. Le bilan annuel rappelle les quêtes réussies,
  les écus déjà gagnés et l'amitié (`report.joseph`, `report.questEcus`).
- **Durée des saisons** (`src/data/career/career.js`) : `PATRIMONY_SCALE = { 7: 1, 10: 2, 14: 3.5 }`,
  `patrimonyScale(L)` (seuils arrondis à la centaine par `rankThreshold` ; 7 jours : exactement les données) ;
  `DAY_COUNTED_OBJECTIVES = ['harvests', 'productsSold']`, `objectiveTargetFor(obj, L)` (× L / 7, arrondi à 5).
  `ranks.js` : `objectiveTarget(state, obj)`, `objectiveLabel(state, obj)` (« {n} » dans le libellé des données →
  cible de la carrière) ; `summary().nextRank.objectives[]` porte `label` accordé, `target` de la carrière et `tip`
  (conseil facultatif, affiché dans le Carnet sous un objectif non rempli). Objectif `products` : 15.
- **Meilleur patrimoine** : posé dès `createCareer` (archive d'une ferme vendue tout de suite).
- **Performances** (grande ferme, 7 employés, 23 machines) : `careerAnimals()` / `careerInvestments()` /
  `getCareerInvestment()` en cache (tableaux figés, invalidés quand une extension est enregistrée ou retirée) ;
  prévision de la barre du haut en O(parcelles) (`plantableCrops` une fois) ; en carrière, barre du haut recalculée au
  plus 4 fois par seconde (`scheduleRefresh`), feuilles vivantes et pastilles au plus 4 fois par seconde sur les
  événements du jeu (`scheduleSoft` ; tout de suite après un toucher), animation de l'argent relancée sans lecture de
  mise en page (plus de `offsetWidth` à chaque pièce gagnée par l'équipe) ; sons des actions de l'équipe et des
  machines (`by` ≠ `'player'`) à 22 % du volume, au plus un toutes les 1,4 s.
- **Scène** : `visitor { offerId, kind }` → carte de l'offre (sinon la première offre, sinon l'Agenda) ; la scène reçoit
  le nom, la tenue et le décor de la carrière (`app.applyCosmetics`, aussi derrière le menu) ; `__debug.lotPoint`
  convertit le panneau (en tuiles) en px.
- **Menu principal** : derrière le menu, une copie de la ferme de carrière chargée de sa sauvegarde (`createAttractGame`,
  vit à ×1, jamais enregistrée), sinon la ferme de démonstration du niveau 1 (`createDemoGame`).
- **Interface** : pas de pastille sur l'onglet Équipe verrouillé ; « Sur … » des machines passe à la ligne
  (`.stat--wide > b`) ; pluriels « choux », « pommes de terre » (`cropPlural`, `cropCount`).
- **Simulation** : `--matrix --seasons 7,10,14 --difficulties detente,classique` (une partie de la matrice) ; robot
  casual de `tools/sim-career-staff.js` : au plus 2 terrains de plus arrosés et 2 de plus mécanisés par an.


## Carrière v2 — carte 2D (contrat du cœur, 2026-09-30)

Retours d'un vrai joueur : agrandir la ferme **sur les côtés** (pas seulement vers le haut). Les terrains sont des
**blocs d'une grille** autour de la ferme de départ. `CAREER_VERSION = 2` (migration automatique des carrières v1).

### Grille et identifiants (`src/data/career/lots.js`)

- Case `(col, row)` : `col` −2 … 2 (0 = la colonne d'origine, négatif = à gauche), `row` 0 … 6 vers le haut
  (`LOT_GRID = { cols: [-2, 2], rows: [0, 6], home: { col: 0, row: 0 }, blockCols: 14, blockRows: 11, homeRows: 40,
  topForest: 2, legacyRows: 12 }`). La **ferme de départ** (maison, champ de départ, basse-cour : `home`, `start`,
  `yard`) occupe la case (0, 0) ; sa taille ne change pas. Rangée 0 : terrains de côté, à gauche et à droite de la ferme.
- Identifiant d'une case : `lotIdAt(col, row)` — colonne 0 : `lot${row + 2}` (**les anciens identifiants** : `lot3` =
  rangée 1…) ; côtés : `lot${row + 2}w${-col}` (ouest) / `lot${row + 2}e${col}` (est), ex. `lot2w1` = (−1, 0),
  `lot5e2` = (2, 3). `lotCellOf(id) → { col, row } | null`, `inLotGrid(col, row)`, `lotNameAt(col, row)` (noms fixes :
  `LOT_NAMES` pour la colonne 0, `SIDE_LOT_NAMES` pour les côtés, tous différents).
- `state.career.lots[k]` : + `col`, `row` (entiers ; ferme de départ : 0, 0). `index` = **ordre d'achat** (3, 4, …),
  plus la rangée. Un terrain acheté ne bouge jamais.

### Achat

- **À vendre** (« lisière ») : une case de la grille, libre, qui **touche par un côté** un terrain possédé ou la ferme
  de départ. Au départ : (0, 1) `lot3`, (−1, 0) `lot2w1`, (1, 0) `lot2e1`. Plus de lisière quand la ferme a
  `MAX_LOTS` terrains.
- **Achetable** (`buyable`) : sur la lisière **et** le rang permet un terrain de plus (`MAX_LOTS_BY_RANK` = 1, 3, 6,
  9, 12, **16** aux rangs 1 à 6 ; `MAX_LOTS = 16`). L'argent n'est pas compté (`canBuy` = achetable + assez d'argent).
- **Prix** : selon le nombre de terrains déjà possédés, quelle que soit la case : `LOT_PRICES` = 250, 400, 600, 900,
  1 300, 1 900, 2 700, 3 800, 5 300, 7 400, 10 000, 14 000, **18 500, 24 000, 30 000, 37 000** (total 158 050) ;
  +15 de charges de saison par terrain (Détente ; +25 Classique), inchangé. Le verger de Joseph (8 ♥) : moitié prix
  sur toute la lisière, pour le prochain achat.
- `actions.career.buyLot(lotId?)` → `{ ok, lotId, index, col, row, cost }` (+ `special`, `lotType` pour le verger de
  Joseph). Sans argument : le terrain proposé (`nextLot()`). Refus : « Terrain inconnu. » (hors grille),
  « Ce terrain est déjà à vous. », « Ce terrain ne touche pas encore votre ferme. », « Rang N requis », « Pas assez
  d'argent… », « Tous les terrains sont achetés. ».
- Événement `lotBought { lotId, index, col, row, cost, name }`.

### Requêtes

```js
lots() → [ // possédés (ordre d'achat : home, start, yard, puis achats), PUIS la lisière à vendre
  { id, index, col, row, fixed /* home/start/yard */, owned, bought, forSale, buyable, canBuy, lockedReason, reason,
    lockedByRank, price /* payé, ou prix de vente */, basePrice?, special?, chargeIncrease?, type /* null à vendre */,
    typeName, name, developCost, plots, slots, buildings, machines, staff, plan } ]
lot(id)                       // un terrain possédé OU à vendre (même forme)
nextLot() → null | vente      // le terrain proposé : colonne la plus proche du centre, puis le plus bas, puis la gauche
grid() → { cols: [min, max], rows: [min, max],  // étendue MONTRÉE : ferme + possédés + lisière (verrouillée comprise)
           home: { col: 0, row: 0 }, bounds: { cols: [-2, 2], rows: [0, 6] },
           block: { cols: 14, rows: 11, homeRows: 40, topForest: 2 },
           lots: lots(),
           cells: [{ col, row, id, name, type, state: 'home' | 'owned' | 'buyable' | 'locked' | 'forest' }] }
           // cells : toute la grille (mini-carte), de la rangée la plus haute à la plus basse, de gauche à droite
```

### Géométrie du monde (pour le rendu)

- Tuile 16 px. Un bloc = **14 × 11 tuiles** (224 × 176 px) : 12 utiles, x 0 et x 13 forêt ou haie ; 10 lignes de
  contenu + l'allée (ligne 10).
- Largeur du monde = `(cols[1] − cols[0] + 1) × 14` tuiles sur l'étendue de `grid()` (lisière comprise, montrée en forêt
  + panneau « À vendre ») ; colonne `c` à x = `14 × c` tuiles (négatif à gauche : la colonne 0 ne bouge pas).
- Hauteur : `topForest (2) + rows[1] × 11 + homeRows (40)` tuiles. Rangée `r ≥ 1` : `y = 2 + (rows[1] − r) × 11`.
  Rangée 0 = la bande de la ferme de départ (40 lignes : basse-cour 11, champ de départ 13, maison et route 16) ; un
  terrain de côté en rangée 0 occupe ses **11 premières lignes** (à côté de la basse-cour, juste sous la rangée 1 de sa
  colonne) ; dessous, à côté du champ et de la maison : décor (forêt, route prolongée).
- Anciennes carrières : colonne 0 jusqu'à la rangée 12 (`legacyRows`) : `rows[1]` peut dépasser 6.

### Sauvegarde et migration

- `checkCareerState` : `lots[k].index === k` ; ferme de départ en (0, 0) ; chaque terrain acheté : identifiant =
  `lotIdAt(col, row)`, case dans la grille (ou colonne 0 jusqu'à la rangée 12 pour une ancienne carrière), case libre,
  et **touche** la ferme ou un terrain acheté avant lui. Décor `lotN(w|e)K.corner` accepté.
- `migrateCareer` v1 → v2 : terrains achetés → `col 0`, `row = index − 2` (même identifiant, même image) ; ferme de
  départ → (0, 0). Les anciennes carrières au rang 6 peuvent acheter jusqu'à 4 terrains de plus, sur les côtés.

## Carrière v2 — rythme tranquille des quêtes et des commandes (2026-09-30)

Retours : « trop de quêtes en peu de temps », « une saison pour planter 10 patates, j'ai oublié d'appuyer sur pause,
c'était déjà trop tard ». Choix : **Joseph propose de lui-même, rarement, et le délai ne court qu'après « Accepter »**
(le plus reposant : rien n'est raté si on ne regarde pas ; on peut aussi lui demander un service quand on a envie).

- `QUEST_PACE = { seasonsBetweenOffers: 2, offerSeasons: 2, minSeasons: 2, growthFactor: 3, marginDays: 2,
  reminders: [3, 1] }` (`src/data/career/quests.js`).
- **Une seule quête à la fois.** Proposition au début d'une saison (rang ≥ 2) si aucune quête et au moins 2 saisons
  depuis la précédente proposition (`joseph.lastOfferSeason`, saison absolue = `(année − 1) × 4 + saison`).
- **Proposition** (`accepted: false`) : aucun compte à rebours ; elle attend jusqu'au soir du dernier jour de la
  saison SUIVANTE (`quest.offerEndDay`), puis Joseph la retire gentiment : événement `questWithdrawn { quest, line }`
  (pas de `questExpired`).
- **Délai** (à l'acceptation, `questDeadline(state, q)`) : au moins `max(2 × durée de saison, 3 × pousse + 2)` jours
  (pousse : la culture ; produit : culture + jours d'atelier ; œufs : n ÷ pondeuses), arrondi au **soir du dernier
  jour** de la saison où il tombe (« jusqu'à la fin de l'hiver »). Saisons de 7 jours : 14 à 20 jours (citrouilles : 23 à
  29) ; 14 jours : 28 à 41.
  `quest.acceptedDay`, `quest.endDay`. Le temps ne passe pas en pause (vitesse 0 : `update` ne fait rien).
- **Rappels** : `questReminder { quest, daysLeft: 3 | 1, line }` à l'aube, une fois chacun (`quest.reminded`).
- **Échec doux** : `questExpired { quest, accepted: true, amount, line }` — ce qui a été mis de côté est payé au prix
  normal, aucune pénalité, aucun cœur perdu ; réplique « Ce n'est pas grave du tout ! Merci d'avoir essayé… ».
- **Taille** (`QUEST_TEMPLATES[].n = { base, perRank, jitter, capPerPlot?, capPerTree?, min? }`) :
  `base + perRank × (rang − 2) + tirage 0..jitter`, plafonnée par la ferme (culture : ½ des parcelles de champ ouvertes,
  au moins 3 ; fruits : 2 par arbre). Culture 4-5 au rang 2, 12-13 au rang 6 ; produits 2-3 → 6-7 ; œufs 6-8 → 22-24 ;
  fruits 3-4 → 7-8 ; pommiers 2. Culture d'une quête : semable cette saison **et** la suivante, pousse ≤ durée de saison.
- **Demander un service** : `actions.career.askQuest() → { ok, quest | null, line }` (rang ≥ 2, pas de quête en cours,
  une fois par jour ; refus : « Rang 2 requis », « Joseph attend déjà votre réponse. », « Une quête de Joseph est déjà
  en cours. », « … repassez demain. ») ; `questOffered.asked = true`.
- `quest()` : + `endDay`, `deadline` (« la fin de l'hiver »), `deadlineText` (« Jusqu'à la fin de l'hiver »),
  `offerDaysLeft` / `offerEndDay` (proposition : jours avant qu'elle parte ; `null` une fois acceptée). Pour une
  proposition, `daysLeft` = le délai qu'on aurait en acceptant aujourd'hui. `acceptQuest().line` dit l'échéance.
- `joseph().ask = { canAsk, reason, nextOfferInSeasons, seasonsBetweenOffers }` (Carnet : bouton « Demander un
  service » et « Joseph repassera dans N saisons »).
- **Commandes de visiteurs** : tirage du jour 0,3 → **0,15** ; poids visiteur 30 → 20, corbeaux 15 → 10, marchand
  10 → 8 ; commande de **5 jours** (7 en saisons de 14 jours : `visitorDays(state)`) au lieu de 2 ; 3 à 5 récoltes (2 à 4
  si chères) ; seulement une culture qu'on peut avoir à temps (au grenier, déjà semée, ou pousse ≤ jours − 1) ;
  **une seule commande à la fois** ; rappel `offerReminder { offerId, kind, daysLeft: 1, data, text }` la veille du
  dernier jour d'une commande acceptée. Au plus une quête + une commande ouvertes. Fêtes inchangées.
- Migration (quête d'une carrière v1) : `offerEndDay` = fin de la saison suivante ; quête acceptée : échéance =
  max(ancienne, délai d'aujourd'hui) (jamais raccourcie) ; `joseph.lastOfferSeason` = la saison en cours.

## Carrière v2 — « Ce que fait ce bâtiment » (fiches, 2026-09-30)

`src/data/career/descriptions.js` (pur) : pour chaque bâtiment (maison, grenier, étal, serre, chambre d'hôte, 8 abris,
3 ateliers), machine (8), animal (8), aménagement de la ferme (ruche, panneau) et aménagement de terrain (7) :
`role` (une phrase « À quoi ça sert »), `tips` (conseils) ; lignes **calculées à partir des données** :
`effectLines(kind, id, level)` (capacité, places et produits des ateliers, revenus par saison, entretien, carburant,
traction…), `describe(kind, id, level) → { kind, id, role, tips, effectLines, nextEffectLines, levels: [{ level, name,
cost, rank, lines }] }`, `aboutFields(kind, id, level)`, `DESCRIBED` (ids décrits par genre).

Champs ajoutés aux requêtes (`role`, `tips`, `effectLines` = niveau actuel, ou niveau 1 si pas encore construit,
`nextEffectLines` = niveau suivant ou `null`, `levelLines` = tous les niveaux) :

- `buildings()` / `building(id)` (bâtiment) ; `shelters()` / `shelter(id)` (abri, + `animalAbout` = description de
  l'animal) ; `machines()` / `machine(key)` (niveau de la machine) et `machineCatalog()` (niveau 1) ;
  `query.investments()` en carrière (animaux, ruche, panneau : `role`, `tips`, `effectLines`, `levelLines: []`) ;
  `lotTypes(lotId)` (aménagements : `role`, `tips`, `effectLines`).
- `query.career.about(kind, id, level?) → describe(...) + { level }` avec `kind` ∈ `'building' | 'machine' | 'animal'
  | 'item' | 'lotType'` ; sans `level` : le niveau possédé (bâtiment, meilleure machine), sinon 1.
- Tests : `tests/career-about.test.js` (chaque identifiant décrit, lignes par niveau, requêtes).

## Carrière v2 — carte 2D : rendu (RENDER, 2026-09-30)

Retour de joueur : agrandir la ferme **sur les côtés** et une **mini-carte**. Le cœur (lot CORE) place chaque terrain
sur une case `(lot.col, lot.row)` et donne `query.career.grid()` ; le rendu en fait un monde 2D.

- **Monde** (`src/render/layout-career.js`, pur) : un bloc de 14 × 11 tuiles par case ; colonne `c` = tuiles
  `14c … 14c + 13` (**x négatif à gauche** : les coordonnées de la colonne 0 ne bougent jamais) ; ligne `r ≥ 1` au-dessus
  de la basse-cour, ligne 0 à côté d'elle ; la ferme de départ (basse-cour, champ de départ, maison) reste en colonne 0.
  `createCareerLayout(level, { career, plots, investments, grid })` ; `grid` = `query.career.grid()` (facultatif).
  Terrains à vendre (`grid.lots` non possédés) : forêt assombrie du bloc + grand panneau (prix / cadenas écrits par la
  scène, à jour 4 fois par seconde) ; toute autre case : forêt dense. Chemins : épine (x 12 du bloc) par suite de
  terrains d'une colonne, jusqu'à la route pour la ligne 0 ; allées prolongées d'un bloc à son voisin de la même ligne.
  `route(a, b)` : colonne 0 comme avant, sinon plus court chemin sur les allées (en cache).
  Nouveaux champs : `x0`, `x1` (px), `grid { cMin, cMax, rMax, rowTop, rowBottom, x0Tiles, colsTiles, rowY(r), roadY,
  homeBottom }`, `saleBands` (`saleBand` = le premier), `lots[].col/row/ox` (+ `price`, `buyable`, `lockedReason`,
  `lockedByRank` des terrains à vendre), `bandAt(wy, wx?)`. `careerGridCells(career, grid)`, `careerGridKey(grid)`.
- **Sans grille** (cœur d'avant) ou **ancienne carrière** en colonne : disposition **identique** à la précédente
  (vérifié : parcelles, décor, chemins, forêt, cibles, trajets ; mode Niveaux identique au pixel près, captures
  déterministes).
- **Caméra** (`scene.js`) : zoom inchangé (une colonne de 12 tuiles utiles = la largeur du téléphone) ; défilement
  horizontal du centre de la colonne la plus à gauche à celui de la plus à droite (bords du monde sur grand écran).
  Couche fixe = tout le monde (≈ 1 120 × 2 250 px pour 5 colonnes), vue = l'écran ; parcelles et objets hors de la
  vue non dessinés. API : `scrollBy(dx, dy)`, `fling(vx, vy)`, `setScroll(x, y)` (un argument : vertical, comme
  avant), `getScroll()` / `maxScroll()` → `{ x, y }` (valent `y` dans un calcul), `focusLot` (les deux axes),
  `focusWorld(wx, wy, { animate })`, `viewRect()`, `getMinimap({ w, h, ctx?, x?, y? })`, `minimapToWorld(mx, my)`,
  `minimapLotAt(mx, my)`. `actors.markers()` (employés, Joseph, visiteurs).
- **Ce que l'interface doit faire** : glisser en 2D (`scrollBy(-dx, -dy)` au lieu de `scrollBy(-dy)` en carrière,
  `fling(vx, vy)`), un petit canevas de mini-carte (ex. 96 × 132 px CSS × dpr, en bas à droite au-dessus des onglets)
  redessiné à chaque image par `getMinimap({ w, h, ctx })` (fond en cache : ≈ 0,15 ms) ; toucher la mini-carte →
  `minimapToWorld` puis `focusWorld(x, y, { animate: true })` (ou `minimapLotAt` → fiche du terrain).
- **Aperçu** : `tools/scene-preview.html?career=1&stage=8&sides=6&minimap=1` (glisser en 2D, toucher la mini-carte) ;
  `sides=N` achète N terrains de côté (grille simulée si le cœur n'a pas `grid()`), `scrollx=px`.
- Tests : `tests/career-render-layout.test.js` (blocs, cases, cibles des côtés, forêt, allées reliées, trajets).

## Carrière v2 — interface (UI, 2026-09-30)

- **Gestes** (`src/ui/gestures.js`) : en carrière (`scene.careerMode`), glisser = `scrollBy(dx, dy)` et `fling(vx, vy)` ;
  verrou d'axe au départ (angle < ≈ 23° d'un axe) ; un glissé parti d'une parcelle ne fait une série
  (arroser / récolter) que si cette parcelle a cette action, sinon il fait défiler. Molette : `deltaX` ou Maj + molette
  = horizontal. `canScroll()` regarde `maxScroll().x` et `.y`. Niveaux : chemin d'avant (un axe).
- **Mini-carte** (`src/ui/career/minimap.js`) : `createMinimap(app, { active, openLot, openMap })` →
  `{ frame(), setHidden(v), hidden, shown, root }` ; `#minimap` (fixe, `z-index` 18, au-dessus de `--inset-bottom`),
  canevas `w × h` CSS × `devicePixelRatio`, `scene.getMinimap({ w, h, ctx })` à chaque image (appelé par
  `careerUI.frame()` depuis la boucle de `main.js`, après `scene.render`). Visible seulement en carrière, sans feuille,
  fenêtre, bulle (`hints.active`, `tutorial.active`) ni décoration. Choix « cachée » : `localStorage`
  `une-annee-a-la-ferme.minimap` (`hidden` / `shown`). Toucher → `minimapToWorld` + `focusWorld(animate)`, glisser →
  `focusWorld(animate: false)`, appui long → `minimapLotAt` → `open.lot`, sinon `open.map`.
- **careerUI** : + `frame()`, `minimap`, `buyLot(lotId)` (achète ce terrain, ouvre sa fiche, `revealLot` deux images
  plus tard, après la reconstruction de la disposition), `showLot(lotId)` (ferme la feuille, `focusLot` animé) ; le
  contexte `ui` des contenus a aussi `buyLot`, `showLot`, `minimap`, `mapHere`. `onHit('lotForSale')` ouvre la fiche de
  `hit.lotId`. Messages : `questReminder`, `questWithdrawn`, `offerReminder`, `questExpired` (doux), `questOffered.asked`
  (pas de message : la feuille s'ouvre).
- **Carte des terrains** (`mapContent`, `src/ui/career/lots.js`) : grille `grid().cells` (+ `lots()` pour les
  anciennes carrières au-delà de la rangée 6), boutons `#c-cell-<lotId>` (`.is-home | .is-owned.t-<type> |
  .is-buyable | .is-locked | .is-forest`, `.is-here` = terrain au centre de la vue à l'ouverture, `lotInView(app)` via
  `scene.viewRect()` + `layout.bandAt`), puis listes « À vendre » / « Vos terrains ». `lotWhere(lot)` (util) : place d'un
  terrain en mots.
- **Fiches** : `aboutSection(about, { app, kind, key, level, levels, next, tips, title })`, `nextLines(lines, title)`,
  `levelsFold(app, key, levels, current)` (`foldSection`, état retenu d'une reconstruction à l'autre), `roleLine(role)`
  (`src/ui/career/util.js`) ; lus sur `building(id)` / `about(kind, id)` / `investments()` / `lotTypes()` /
  `machineCatalog()` / `machines()`. `buildingCard(ui, b, { lines: true })` : lignes du niveau suivant au-dessus du
  bouton. `src/ui/buildings.js` (fiche d'atelier) et `field.openInvestmentInfo` ajoutent la section en carrière ;
  `field.openBuilding(id)` d'un atelier de carrière (absent d'`investments()`) ouvre `careerUI.open.building(id)`.
- **Ateliers de carrière** (2026-09-30) : `query.career.building(id).processing` = `workshopInfo(state, id, level)`
  (`src/core/career/buildings.js`) → `{ level, places, basePlaces, extraPlaces (artisan), nextPlaces, on, used, upkeep,
  source: 'harvest'|'animal', recipes: [{ input, inputName, productId, productName, days, value, active, minLevel, maxLevel }] }`.
  `query.processing()[].name` = nom de carrière ; `setProcessing` / `sellProcessing` identiques aux niveaux ; en carrière, une
  vente en l'état (joueur, charges) s'ajoute aussi à `yearStats.incomeBy.other`. La fiche de carrière d'un atelier
  (`src/ui/career/buildings.js`) réutilise `workshopControls(proc, source, id, actions, { sellHint })`, `recipesSection`,
  `confirmSellRaw(app, id, proc)` de `src/ui/buildings.js` (ids `#bld-switch`, `#bld-sellraw`).
- **Quêtes** (`src/ui/career/events.js`) : `questTimeFacts(quest)` (proposition : `deadline` + `daysLeft` « si vous
  acceptez », `offerDaysLeft` ; acceptée : `deadlineText`, « plus que N jours », « demain soir », « ce soir »),
  `askJosephBlock(ui)` (`#c-ask-joseph`, `joseph().ask`, `actions.career.askQuest()`).

## Lot 1 — confort (cœur et rendu, 2026-10-02)

Feuille de route : `docs/analyse/0-SYNTHESE.md` (A2, A6, A7, F2 et bugs de l'annexe B de
`1-analyse-du-jeu.md`). Tout est facultatif côté interface : sans appel, le jeu se comporte comme avant
(le mode classique rejoue à l'identique, `tests/parity.test.js`). Tests : `tests/comfort.test.js`.

### Vitesse douce ×½ (A2)

- `SPEEDS = [0, 0.5, 1, 2, 4]` (`src/data/balance.js`) ; `game.actions.setSpeed(0.5)` → un jour dure 40 s.
  Sauvegardé / rechargé comme les autres vitesses (niveaux et carrière). `loadSettings` (UI) doit accepter 0.5.

### Option « pause chaque matin » (A2)

- `game.setOption('autoPauseDawn', true | false)` (aussi `game.actions.setOption`) → `{ ok, name, value }` ou
  `{ ok: false, reason }` (option inconnue, valeur non booléenne). `game.options()` → `{ autoPauseDawn }`
  (défauts compris ; `GAME_OPTIONS` dans `balance.js`). Logique : `src/core/options.js`.
- Effet : juste après chaque aube (niveaux et carrière), la vitesse passe à 0, le jour commence au matin
  (`time.elapsed = 0`) et un grand `dt` n'enchaîne pas les jours suivants. Événement **`autoPaused`**
  `{ day, seasonId, previousSpeed }`, émis après `dawn` (et `seasonWarning`) : l'interface met à jour le bouton de
  vitesse et peut proposer « Reprendre » (`setSpeed(previousSpeed)`).
- Sauvegarde : `state.options` n'existe qu'après le premier `setOption` (état inchangé sinon) ; vérifié au
  chargement (`checkOptions` : objet, valeurs du bon type ; une option inconnue d'une version future est ignorée).
- C'est une option **de la partie** (sauvegardée avec elle) : l'interface la règle au lancement / chargement
  depuis ses réglages (`storage.js`) si elle veut un réglage global.

### « Tout ramasser » (F2)

- `game.actions.collectAll()` (tous modes) ; en carrière = `game.actions.career.collectAll()`.
  → `{ ok: true, total, amount /* = total */, count, byShelter: [{ buildingId, name, amount }] }` ;
  rien à ramasser (ou partie de niveau, sans abri) : `{ ok: false, reason, total: 0, amount: 0, count: 0,
  byShelter: [] }` sans aucun effet. Chaque abri émet toujours `collected` (avec `all: true`).

### Charges détaillées (bug « Panneaux solaires +−5 », « Entretien » en double)

- `query.career.charges().daily` : **une ligne par poste** (l'entretien des machines est fusionné avec celui des
  animaux et bâtiments) ; chaque ligne `{ source, amount ≥ 0, label }` ; les panneaux solaires ont
  `credit: true` et un montant **positif** (à afficher « +5 », déjà déduit de `dailyTotal`). `dailyTotal` est
  inchangé. Les interfaces existantes (`hud.js`, `career/journal.js`) affichent donc correctement « +5 » ;
  elles peuvent utiliser `label` (« Entretien (animaux, bâtiments, machines) »).

### Déblocages de rang (bug « niv. 2 (niv. 2) »)

- `unlocksFor(rank)` (`src/core/career/ranks.js`, utilisé par `rankUp.unlocks` et `summary().nextRank.unlocks`) :
  tous les niveaux d'un même bâtiment débloqués au même rang → **une seule ligne**
  `{ kind: 'building', id, level /* le premier */, levels: [1, 2, 3], name: 'Atelier de confitures (niv. 1 à 3)' }`.
  Noms : `buildingUnlockName(b, levels)`, `levelsLabel(levels)` (« niv. 2 », « niv. 2 et 3 », « niv. 1 à 3 »).

### Accords en français (`src/data/french.js`)

- `nounPlural(nom)` (cheval → chevaux, chou → choux, pomme de terre → pommes de terre, cour des ateliers → cours des
  ateliers), `countNoun(n, nom)` (« 1 parcelle », « 3 chevaux »), `nounGender(groupe)` ('f' | 'm'),
  `agree(groupe, n, mot)` (« 5 pommes de terre, payées »). `cropMass(cropId)` (`career/events.js`) : « de blé »,
  « de choux ». Corrigés : visiteur (« payées »), cadeau de Joseph (« 8 parcelles de choux »), « Au plus 3 cours des
  ateliers », « Loge jusqu'à 2 chevaux ». L'événement `crow` porte un `text` accordé (« Un corbeau dans les champs :
  touchez-le pour le chasser. ») : l'interface l'affiche (`src/ui/career/index.js`, cas `crow`).

### Rendu : mouvements réduits (A6)

- `scene.setReducedMotion(bool)` (et `scene.reducedMotion`) ; transmis à `effects.setReducedMotion` et
  `actors.setReducedMotion`. Effet : orage sans voile blanc plein écran (léger assombrissement à 14 %, qui
  s'estompe lentement, jamais de double éclair) ; pas de brume de chaleur ; pas de tremblement (arbre arraché) ni
  d'apparition « ressort » (bâtiments, animaux, employés) ; cultures immobiles ; moitié moins de particules (pluie,
  neige, feuilles, pièces, gouttes…) ; textes flottants qui montent de 3 px au lieu de 14 ; défilements sans
  animation. **Câblé** (`src/ui/a11y.js` `applySceneA11y`) : option « Réduire les animations » ou
  `prefers-reduced-motion` (écouteur `change`), à chaque création de scène (`resizeScene`) et à chaque partie.

### Rendu : parcelles lisibles (A7, sans la couleur)

- **Goutte** (forme de goutte, contour sombre) en haut à droite d'une parcelle **à arroser aujourd'hui**
  (`query.plot(i).action === 'water'` : rien quand elle est arrosée, qu'il pleut ou que les arroseurs sont passés) ;
  **pastille cochée ✓** sur une culture **mûre** (`action === 'harvest'`, pommiers compris). Dessinées au-dessus du
  fermier et des objets ; relues à chaque nouveau jour / météo. `scene.setPlotHints(false)` les masque (défaut
  `true`) ; cachées en mode décoration.
- **Graine tout juste semée** : une pousse à deux feuilles bien contourée (toujours affichée).
- **Terre arrosée** : plus sombre (voile + taches d'humidité) et deux reflets clairs : texture en plus de la teinte.
- **Fermier** : en portrait, il se place au coin bas-droit de la parcelle travaillée, tourné vers elle (il ne cache
  plus la culture).
- Vérifié avec simulation de daltonisme (deutéranopie, protanopie, tritanopie, niveaux de gris) : goutte, coche,
  pousse et terre humide restent distinctes.
- Aperçu : `tools/scene-preview.html?reduced=1&hints=0`.

### Personnages

- **Fermière** (`farmer.fermiere.outfit.N[.nohat]`, `playerSprite(outfit, { female: true })`) : nattes à rubans roses
  et fleur au chapeau (`assets/sprites/generate-career.py`, `HAT_FP` / `NOHAT_FP`) ; elle ne ressemble plus au
  fermier à la création.
- **Joseph** : `josephPortrait(expr)` (`src/render/atlas.js`, 'content' | 'surprised' | 'proud' | 'happy') →
  `portrait.joseph[.expr]` (32 × 32). **Câblé** : le tutoriel des niveaux utilise `joseph()` (`src/ui/career/util.js`)
  comme la carrière.

## Lot 1 — confort (interface : guidage, 2026-10-02)

Feuille de route : `docs/analyse/0-SYNTHESE.md` (E2, E5, E6, A9, F2 côté interface, conseils à contretemps, bug [42]).
Styles : **`css/guidance.css`** (ajoutée à `CSS_FILES` de `tools/build.js`, donc au paquet et à `dev.html`).

```
src/ui/todo.js        createTodo(app) → app.todo : items(game?) → [{ id, prio, text, short, icon(), go() }] (le plus
                      utile d'abord), tick() (boucle de main.js ; recalcul ≤ 4 fois/s, seulement si visible),
                      onEvent(ev, game), reset(game), showResume(game), morningToggle(), focusPlots(indexes), ring(rects),
                      collectAll(), reserve() (place gardée en bas de la scène), visible
src/ui/messages.js    createMessages(app) → app.messages : add(entry), list(), unread, markRead(), clear(), open(),
                      onChange(fn) ; bellIcon(cls) (cloche en pixels, SVG)
src/ui/guide.js       openGuide(app, { topic }) (= app.openGuide), guideContent(app), GUIDE_SECTIONS, GLOSSARY
src/ui/guide-prefs.js readPrefs() / writePrefs(patch) : localStorage `une-annee-a-la-ferme.guidance` { morning, sowAll }
```

- **Ligne « À faire maintenant »** (`#todo`, E2) : posée au-dessus des onglets sur toute la largeur (`bottom:
  --inset-bottom + 6px`), `#todo-main` (≥ 52 px : icône, « À FAIRE », texte sur 2 lignes au plus, chevron),
  `#todo-collect` (« Tout ramasser », carrière, ≥ 2 abris à ramasser et la ligne parle d'autre chose), `#todo-bell`
  (messages, pastille du nombre de non-lus). Cachée pendant une fenêtre, une feuille (téléphone), une bulle de conseil,
  le tutoriel (sauf son attente de l'hiver), la décoration, le téléphone tourné. `body.has-todo`, `--todo-h` ; les
  messages (`#toasts`) et la mini-carte remontent au-dessus d'elle. **Place réservée** : `main.js` ajoute
  `app.todo.reserve()` à `insets.bottom` passé à la scène pendant toute la partie (la scène ne saute pas quand la
  ligne se cache un instant) ; la variable CSS `--inset-bottom` reste le haut des onglets (feuilles, messages).
  Priorités (plus petit = plus important) : corbeaux 10 · fermage / charges qui manquent dans ≤ 3 jours 15–25 ·
  proposition d'un visiteur 30 · abri plein 32 · demande de Joseph 34 · livrable depuis le grenier 36–37 · récolter 40 ·
  ramasser 45 · arroser 50 (sans les terrains arrosés par une machine ou un employé) · semer 55 (si une graine est
  abordable) · terrain à vendre (argent ≥ prix + charges de saison) 70 · concours 72 · commande / quête en cours 75–76 ·
  achat abordable (niveaux) 78 · objectif du rang / étoiles de l'année 90. Toucher : la vue va sur la parcelle la plus
  proche du centre (`scene.focusPlot`, `bottom` = place couverte) et un anneau doré entoure les parcelles (1,9 s) ;
  semer ouvre les graines ; offre, quête, terrain, Carnet, fiche du fermage, boutique s'ouvrent.
- **Corbeaux** : à l'événement `crow`, la vue va sur la parcelle visée (sans feuille ni fenêtre ouverte) ; message
  du cœur (`ev.text`, accordé) ; la ligne « À faire » les met en tête.
- **Résumé du matin** (E5) : à chaque aube (sauf la première), « Bonjour ! Jour N » + « Hier : +46 pièces.
  Aujourd'hui : 3 parcelles à récolter, une proposition (M. Garnier). » (3 choses au plus, ni objectif ni étoiles).
  Montré après les fenêtres (bilan de saison), au plus un toutes les 25 s à l'écran (à ×4 une journée dure 5 s), toujours
  noté dans les messages ; interrupteur « Résumé du matin » dans la feuille Messages. Option « pause chaque matin »
  (`autoPaused`) : le résumé le dit et reste 7 s (sinon un petit message « Pause du matin »).
- **« Où en étais-je ? »** (E6) : `app.todo.showResume(game)` à la reprise depuis le menu (« Continuer le niveau »,
  « Ma ferme » → Continuer) : ferme / niveau, date, argent, fermage ou charges (couvert ou manque), état du champ, les
  3 choses à faire ; bouton `#resume-ok` « Reprendre » (fenêtre `resume`, la partie est en pause). Remplace les messages
  « Partie reprise » (`careerUI.bind(game, { quiet })`).
- **Messages** (A9) : `toasts.setLogger(fn)` (main.js → `app.messages.add`) : chaque message montré et chaque bandeau
  sont notés (50 derniers, jour de jeu et heure) ; `show({ log: false })` pour les refus d'action (« Il manque… ») ;
  un message mis à jour (`key`) remplace sa ligne. Messages importants (alerte, gel, action à toucher, succès, erreur)
  ≥ 5 s à l'écran. Feuille `messages` : depuis la cloche, le menu Pause (`#pause-messages`) et le Carnet
  (`#c-j-messages`) ; un message qui proposait une action garde un bouton « Voir ». Effacés à chaque partie.
- **Guide de la ferme** (E5, A10) : feuille `guide`, sections repliables (gestes, temps, ligne « À faire », cultures,
  argent et fermage / ma ferme, animaux, équipe et machines, visiteurs et Joseph, **mots de la ferme** : fermage =
  loyer de la ferme, charges, entretien, patrimoine, cours…, conseils de Joseph) ; phrases de 25 mots au plus
  (`tests/guidance.test.js`). Depuis le menu Pause (`#pause-guide`, injecté par `main.js` après `dialogs.pauseMenu()`)
  et le Carnet (`#c-j-guide`).
- **Tout ramasser** (F2) : bouton `#todo-collect` et ligne « À faire » → `careerUI.act('collectAll')` (message groupé
  « Tout ramassé : N abris ») ; **glisser** en partant d'un abri qui a des produits ramasse chaque abri traversé, et un
  glissé de récolte qui passe sur un abri le ramasse aussi (`gestures.js`, `g.collected`).
- **Conseils** (`hints.js`) : `HINTS[id].relevant(app)` (faux → jamais montré, compté comme vu : `career.hire` si un
  employé est déjà embauché, `career.lotForSale` si un terrain est acheté, `career.leave` si l'équipe est déjà en
  congé) ; feuille ouverte (téléphone) : un conseil n'apparaît (ou ne reste) que si sa cible est **dans** la feuille,
  sinon il attend la fermeture ; cible dans une feuille sans place au-dessus : la bulle passe sur la feuille sans couvrir
  la cible ; cible `{ rect: () => rect }`. « La forêt à vendre » vient à l'aube où le premier terrain devient abordable
  (≥ 80 % du prix), vers l'onglet « Acheter » (plus en ouvrant la boutique) ; nouveau `career.collectAll`.
- **« Semer partout »** : le choix est retenu (`guide-prefs`, `sowAll`) ; `app.plantAll` demande confirmation
  (`dialogs.confirm`) quand la dépense dépasse la moitié de l'argent (renvoie alors une promesse).
- **Bugs** : feuille de terrain vide après « Nouveau rang ! » [42] — `careerUI.processPending` rouvre la fiche du terrain
  acheté quand toutes les fenêtres sont fermées, et `main.js` retire `is-visible` d'une feuille fermée dans la même
  image (cause : `sheets.open` pose `is-visible` dans un `requestAnimationFrame` qui passe après la fermeture) ; bandeau
  d'une partie de niveau resté dans `.banner-titles` : `toasts.clearAll()` vide aussi le bandeau.
- **Câblé dans main.js pour les autres lots** : `app.applySceneA11y()` à chaque nouvelle scène, `app.applyA11y()` dans
  `updateSettings`, `app.sheets.releasePause()` quand le joueur relance le temps (clavier), hauteur zoomée
  (`viewportHeight`), préchargement des cadres foncés, portrait de Joseph dans le tutoriel des niveaux.
- **Débogage** : `__debug.todo()` (liste de la ligne « À faire »), `__debug.messages()`.

## Lot 1 — confort (interface : accessibilité et réglages, 2026-10-02)

Feuille de route : `docs/analyse/0-SYNTHESE.md` A1, A3, A4, A5, A8, A11 (+ A2, A6, A7 côté interface) ;
`docs/analyse/4-accessibilite.md` § 5. Tests : `tests/a11y-settings.test.js`.

```
src/ui/a11y.js   applyA11y(app)            tous les réglages (classes de <html>, viewport, scène, partie) ;
                                           = app.applyA11y(), appelé par app.updateSettings et au démarrage
                 applySceneA11y(app)       scene.setReducedMotion(app.reducedMotion()), scene.setPlotHints(plotHints) ;
                                           = app.applySceneA11y(), appelé à chaque nouvelle scène et par hud.bind
                 applyGameA11y(app)        game.actions.setOption('autoPauseDawn', settings.autoPauseDawn) (hud.bind)
                 initA11y(app)             une fois (createHud, microtâche) : écouteur prefers-reduced-motion,
                                           hauteur d'écran pendant le zoom, MutationObserver (grand écran → vitesse en haut)
                 speedCycle(settings)      [0.5, 1, 2, 4] avec slowSpeed, sinon [1, 2, 4] (la pause vient après)
                 nextSpeed(sp, settings)   vitesse suivante au toucher du bouton ; speedText(0.5) = « ×½ »
                 pauseOnSheetActive(app)   'on' / 'off', ou 'auto' = tout sauf le mode Classique
src/ui/sheets.js pause de lecture : raison de pause 'sheet' (pushPause / popPause) tant qu'une feuille est ouverte
                 (sauf panneau rangé à droite en grand écran, ou opts.pauses === false) ; releasePause() (le joueur
                 relance le temps : levée jusqu'à la fermeture), syncPause(), isPausing()
src/ui/tabbar.js setDock(node | null, side 'start' | 'end'), dockNode() : le bouton de vitesse (#hud-speed, même nœud)
                 rangé au bout de la barre d'onglets (option « Vitesse et pause en bas », à gauche pour gaucher)
src/ui/hud.js    prévision du fermage : glyphe (.bill-glyph[data-glyph=ok|warn|danger], dessiné en CSS) + mot
                 (.bill-word : couvert / juste / danger / payé / impayé) + aria-label « Prévision : … » ;
                 syncDock() ; bouton de vitesse : « ×½ », icône pause sur fond bleu (le rouge = danger)
src/ui/dialogs.js section « Accessibilité » des options (textSizePicker, a11yToggles) ; a11yWelcome() : fenêtre
                 « Bienvenue ! » au premier lancement (taille du texte + 5 interrupteurs), une seule fois
                 (settings.a11yOffered) ; jamais sous navigator.webdriver sauf ?welcome
```

**Réglages** (`src/storage.js`, `DEFAULT_SETTINGS`, clé `une-annee-a-la-ferme.settings`, vérifiés par `loadSettings`) :

| Clé | Défaut | Effet |
|---|---|---|
| `textScale` | `1` | 1 · 1,15 · 1,3 · 1,5 : `--text-scale`, `html[data-text-scale]` (toute l'interface en rem ; plafonds en px dans la barre du haut et les titres de fenêtres à 130–150 %) |
| `readableFont` | `false` | `html.font-readable` : police « Lisible » (Atkinson Hyperlegible, OFL, `assets/fonts/`) |
| `highContrast` | `false` | `html.high-contrast` : contours, fonds plus foncés, palette d'états bleu / orange / vermillon |
| `pauseOnSheet` | `'auto'` | `'auto'` (oui en Détente) · `'on'` · `'off'` |
| `slowSpeed` | `false` | ×½ dans le cycle du bouton ; une **nouvelle partie** commence alors à ×½ (`main.js`, `speedCycle(settings)[0]`) |
| `autoPauseDawn` | `false` | `game.setOption('autoPauseDawn')` à chaque partie et à chaque changement ; jamais pour la ferme de fond du menu |
| `reducedMotion` | `false` | `html.reduced-motion` + `scene.setReducedMotion` (ou préférence du système) |
| `plotHints` | `true` | `scene.setPlotHints` (goutte « à arroser », coche « mûre ») |
| `controlsBottom` | `false` | `html.controls-bottom`, vitesse dans la barre d'onglets |
| `leftHanded` | `false` | `html.left-handed` : vitesse à gauche (en haut comme en bas), ligne « À faire » en miroir |
| `pinchZoom` | `true` | viewport sans `user-scalable=no` (la scène garde `touch-action: none`) |
| `vibration` | `true` | `app.vibrate` ; motifs : toucher 8–12 ms, erreur `[30,40,30]`, alerte de saison `[15,80,15,80,15]` |
| `a11yOffered` | `false` | la fenêtre du premier lancement a été montrée (ou fermée par le joueur) |
| `speed` | `1` | vitesse préférée (0,5 accepté) |

- **Application** : au démarrage (`createHud` → `initA11y`, avant « Commencer »), à chaque `app.updateSettings`,
  à chaque partie (`hud.bind` → `applyGameA11y` + `applySceneA11y`) et à chaque nouvelle scène (`resizeScene`).
- **Contrastes** (A4) : sprites foncés `assets/sprites/ui/*-deep.png` et `button-blue.png` (variables `--img-btn-*`,
  `--img-slot-wood`, `--img-ribbon`, `--img-banner`), texte crème ≥ 5:1 ; textes de l'interface ≥ 14 px (exceptions :
  étiquettes de la carte de carrière, raccourcis clavier).
- **Tutoriel au grand texte** (`src/ui/tutorial.js`, `positionPortrait`) : si la bulle ne tient ni au-dessus ni
  au-dessous de la parcelle visée, la scène défile (`scene.focusPlot(i, { bottom: hauteur de la bulle })`), puis, si
  cela ne suffit pas, la bulle se réduit en rappel compact (l'anneau reste sur la parcelle) ; le rappel (`placePill`)
  passe en bas, au-dessus des onglets, s'il couvrirait la cible. Le texte « bouton de
  vitesse en haut à droite » suit l'option (en bas / à gauche).
- **Feuilles** (`sheets.js`) : `is-visible` n'est posé que si la feuille est toujours ouverte à l'image suivante
  (cause du bug [42], en plus du garde-fou de `main.js`).

---

## Lot 2 — contrats (CORE · RENDER · UI, 2026-10-02)

Qualité des récoltes (B2), légumes géants (B3), surprises de l'aube (B4), météos spéciales (B5), trouvailles au
défrichage (B6). Règles chiffrées : `docs/GAME_DESIGN.md`, « Lot 2 — surprises ». Principe F1 : **la qualité dorée
n'existe que pour une récolte faite à la main** (machines et salariés : « belle » au plus), le géant se récolte à la main.

### Fichiers

- `src/data/surprises.js` (pur) : chances de qualité, géants, surprises, météos spéciales, vœux, trouvailles, textes.
- `src/core/surprises.js` (pur, partagé niveaux / carrière) : tirages, soins des parcelles, géants, cueillette,
  effets des météos, vœux, trouvailles. Appelé par `game.js` (niveaux) et `career/runtime.js` (carrière).
- `src/core/career/surprises.js` : extension de carrière (`id: 'surprises'`) : prix × 1,2 de l'heure dorée
  (`priceFactor`), puits des trouvailles (`water`), sauvegarde (`init` / `migrate` / `check`).

### Activation

- `createGame({ …, surprises })` : défaut **`true` en Détente, `false` en Classique** (parité des niveaux 1 à 8 :
  rien ne change en Classique, ni l'état projeté ni les événements). `createCareer({ …, surprises })` : défaut `true`.
- `game.surprises` (booléen). Sauvegardes anciennes : Détente et carrière → activées à la reprise, Classique → non.
- Flux aléatoires **nouveaux** (`state.rng.quality`, `state.rng.surprise`, `state.rng.sky`), créés seulement quand
  c'est activé : météo, marché, maladie et événements de carrière tirent exactement les mêmes nombres qu'avant.

### État (`state.surprises`, `null` quand c'est désactivé)

```js
{
  v: 1,
  sky: { today: null | specialId, tomorrow: null | specialId },   // météo spéciale (en plus de weather.today)
  fox: null | { until },          // carrière : renard installé (jour absolu inclus) → pas de corbeaux
  hedgehog: null | { until },     // niveaux à maladie : hérisson → aucune pourriture
  luck: null | { until },         // vœu « chance » : chances de qualité × 2
  wish: null | { day, options: [boonId, boonId, boonId] },   // vœu à faire (étoile filante)
  wells: [lotId],                 // carrière : terrains avec un vieux puits (arrosés chaque aube)
  found: { owl: bool, statue: bool },
  lastDay: 0,                     // jour absolu de la dernière surprise de l'aube
  stats: { fine: {cropId: n}, gold: {cropId: n}, giants: {cropId: n}, surprises: {kind: n},
           weathers: {specialId: n}, finds: {kind: n}, forage: n, wishes: n },   // pour l'album (lot 4)
}
```

Jour absolu : `state.time.day` (niveaux), `(année − 1) × 4 × durée + jour` (carrière). Carrière :
`state.career.heirlooms = [{ cropId, lotId, year, day }]` (bocaux de graines anciennes, pour « La Vallée vivante »).

Champs optionnels d'une parcelle (seulement quand c'est activé) :
- `care: { sown, dry, rotated, wetEnd }` : jour de semis, jours « à arroser » passés sans eau, rotation (culture
  différente de la dernière récolte sur cette parcelle), arrosée le jour où elle a mûri ;
- `giant: anchorIndex` : sur les 4 parcelles d'un géant (ancre = parcelle en haut à gauche dans la grille du cœur) ;
  `giantSince` (jour absolu de la fusion) sur l'ancre seulement ;
- `forage: { kind: 'mushroom' | 'ring', value, until }` : champignons à cueillir sur une parcelle VIDE.

### Actions

- `game.actions.harvest(i)` (inchangée) : résultat et événement `harvested` ont en plus, quand c'est activé,
  `quality: 'normal' | 'fine' | 'gold'`, `qualityBonus` (pièces en plus, déjà comprises dans `amount`),
  `qualityMultiplier` (1 · 1,5 · 2). Sur une parcelle d'un géant : récolte tout le géant (4 parcelles vidées),
  `giant: { anchor, plots: [4], cropId }`, `amount` = 6 × la valeur d'une parcelle, puis `giantHarvested`.
  Carrière : un géant attend le joueur 3 jours (`GIANT.handDays`, jour de fusion : `giantSince` sur l'ancre) ;
  ensuite salariés et machines peuvent le récolter sans la prime (4 × leur valeur d'une parcelle, `handPicked: false`).
  Sur une parcelle vide avec `forage` : cueillette → `{ ok, amount, forage: kind }`, événement `foragePicked`.
- `game.actions.makeWish(boonId)` → `{ ok, boon, amount? }` | `{ ok: false, reason }` ; événement `wishGranted`.
- `game.actions.triggerSurprise(id)` (débogage `__debug`, tests) : lance une surprise de l'aube tout de suite si elle
  est possible → `{ ok, surprise }` + événement `surprise`.
- Carrière : `game.actions.career.buyLot(lotId?)` renvoie aussi `finds: [...]` (mêmes objets que l'événement `finds`).
- Une parcelle avec `forage` ne se sème pas à la main (« Cueillez d'abord les champignons. ») ; un salarié ou une machine
  qui y sème les ramasse pour vous (payés, `foragePicked { …, by }`) ; la cueillette elle-même (`harvest`) est à la main.

### Requêtes

- `query.plot(i)` (ajouts quand c'est activé) : `quality: { fine, gold }` (chances de la prochaine récolte À LA MAIN,
  0..1), `care: { wateredEveryDay, bees, rotation }`, `giant: null | { anchor, plots, isAnchor, cropId }`,
  `forage: null | { kind, value, daysLeft }` ; `action` vaut `'harvest'` sur une parcelle vide qui a `forage` ;
  `harvestValue` d'une parcelle de géant = valeur du géant entier.
- `query.forecast()` : en plus `special: { today, tomorrow }` (ids ci-dessous ou `null`).
- `query.surprises()` → `null` (désactivé) ou `{ enabled, sky, fox, hedgehog, luck, wish: null | { day, options:
  [{ id, name, text, icon }] }, wells, heirlooms, giants: [{ anchor, plots, cropId, value }], forage: [{ plotIndex,
  kind, value, daysLeft }], stats }`.

### Événements (seulement quand c'est activé)

| Type | Données | Pour |
|---|---|---|
| `harvested` | + `quality`, `qualityBonus`, `qualityMultiplier` ; géant : `giant` | étincelle (belle : argentée, dorée : or), son |
| `giant` | `{ anchor, plots: [4], cropId, cropName, value }` | à l'aube : fusion en légume géant (sprite `crop.<id>.giant`, 2×2) |
| `giantHarvested` | `{ anchor, plots, cropId, cropName, amount, by }` | grande fête (confettis, son) |
| `surprise` | `{ kind, title, text, icon, … }` (voir plus bas) | message de l'aube + animation |
| `specialWeather` | `{ id, name, text, icon }` | à l'aube du jour spécial |
| `forage` | `{ kind: 'mushroom' | 'ring', plots: [index], text }` | champignons apparus (brouillard, cercle de fées) |
| `foragePicked` | `{ plotIndex, kind, amount }` | cueillette |
| `wish` | `{ day, options: [{ id, name, text, icon }], text }` | fenêtre « Faites un vœu » (3 boutons → `makeWish`) |
| `wishGranted` | `{ id, name, text, amount?, plots? }` | message |
| `finds` | `{ lotId, lotName, finds: [{ kind, title, text, icon, … }] }` | carrière : après `lotBought` |
| `weather` | + `special: { today, tomorrow }` | icône de prévision |

`surprise.kind` : `'fairy'` (`plots`, `center` : cultures mûries d'un coup, carré 3×3), `'fox'` (`until`, `days` ;
carrière), `'chest'` (`amount` pièces OU `ecus`), `'hedgehog'` (`until`, `days` ; niveaux à maladie), `'owl'`
(`cosmeticId: 'owl.carved'`, `ecusIfOwned`), `'ring'` (`plotIndex`, `value`).
`finds[].kind` : `'chest'` (`amount` OU `ecus`), `'well'` (`lotId`), `'statue'` (`cosmeticId: 'statue.small'`,
`ecusIfOwned`), `'coins'` (`amount`), `'seedjar'` (`cropId`, `cropName`), `'lamb'` (`animal: 'sheep' | 'hen'`
ou `amount` si aucun abri n'a de place).
Météos spéciales (`id`, icône `icon.weather.<id>`) : `'warmrain'` (sur une pluie : pousse × 1,5 ce jour),
`'fog'` (sur un temps nuageux : champignons sur des parcelles vides), `'shootingstar'` (nuit claire : vœu le
lendemain matin), `'goldenhour'` (soleil : ventes de récoltes × 1,2 ce jour), `'rainbow'` (après la pluie : pousse
+10 % ; en carrière c'est l'événement « arc-en-ciel » déjà existant, montré comme `special.today = 'rainbow'`).

### À faire côté interface / rendu

- **Écus** : `surprise.ecus`, `finds[].ecus` → `progression.recordCareerEcus(p, ecus)` (vaut pour les deux modes).
- **Décors trouvés** : `cosmeticId` → `progression.unlockCosmetic(p, id)` → `{ ok, progress, already }` ; si `already`,
  verser `ecusIfOwned` écus. Les objets `found: true` de `src/data/cosmetics.js` (`owl.carved`, `statue.small`)
  ne s'achètent pas (`buyCosmetic` refuse : « Cet objet se trouve à la ferme. ») : boutique « Trouvé à la ferme ».
- **Géant et grille portrait** : le carré est cherché dans la grille DU CŒUR (`gridCols` des niveaux ; `cell` et
  largeur du terrain en carrière : 4 colonnes). En portrait (niveaux), les cases visuelles du bloc de départ gardent
  l'ordre de lecture ; si les 4 parcelles ne sont pas voisines à l'écran, dessiner le géant sur la case de l'ancre.
- **Sprites attendus** (lot ART) : `crop.<id>.giant` (2×2 parcelles), `quality.fine`, `quality.gold`, `fairy`, `fox`,
  `chest.old`, `hedgehog`, `owl.carved`, `mushroom.ring`, `icon.weather.{warmrain,fog,shootingstar,goldenhour,rainbow}`,
  `find.{chest,well,statue,coins,seedjar,lostlamb}` ; champignons de cueillette : `mushroom.ring` (cercle) et
  `mushrooms` (petits champignons du brouillard). Décors trouvés posés dans la ferme : `owl.carved` et
  `statue.small` (ids de cosmétiques, à relier aux sprites `owl.carved` / `find.statue` dans la table des décors).

### Écarts et précisions (livraison CORE, 2026-10-02)

- Argent des surprises dans les niveaux : statistique `surpriseIncome` (année et saison), créée seulement quand il y
  en a (le bilan du mode Classique reste identique) ; comptée dans `summary.net`. Carrière : poste `other` du bilan.
- Pas de météo spéciale ni de surprise pendant les 4 premiers jours (tutoriel, premiers gestes) ; une surprise au
  plus tous les 3 jours.
- Les trouvailles sont tirées dans `buyLot` (`src/core/career/land.js`) : elles valent aussi pour « le verger de
  Joseph » (action `buyLot` de l'extension des quêtes).

## Lot 2 — rendu, son et interface (RENDER/UI, 2026-10-02)

Code contre le contrat ci-dessus (« Lot 2 — contrats »). Tout est gardé : un sprite du lot 2 absent (`canDraw`) ou
des surprises désactivées (Classique) → le jeu se comporte comme avant. Mouvements réduits (lot 1) respectés partout.
Styles : **`css/lot2.css`** (ajoutée à `CSS_FILES`). Tests : `tests/lot2-render.test.js`.

```
src/audio/synth.js     createSynth(ctx, destination) → { note(step, {when, volume}), play(name, opts), voices }
                       comboMidi(step) : mi 4 + un degré pentatonique (do ré mi sol la) par parcelle, sol 6 au plus,
                       puis alternance des deux notes du haut ; sons 'belle' | 'gold' | 'fanfare' | 'thud' | 'splash' |
                       'pop' | 'chime' | 'magic' | 'wish' | 'reveal'. Compresseur doux en sortie (aucune saturation :
                       12 notes à 70 ms + dorée → crête 0,33 ; 30 notes à 30 ms + fanfare → 0,40), 42 oscillateurs au plus.
src/audio/audio.js     audio.note(step, opts), audio.tone(name, { volume, delay, throttle }) : sur le bus des effets
                       (volume du joueur, muet), rien avant le déverrouillage ; audio.synthVoices (mesures)
src/render/effects.js  canDraw(images, name), qualityOf(payload) ('normal' | 'fine' | 'gold', noms tolérants),
                       giantRect(layout, plots, anchor) (union des 4 parcelles si voisines à l'écran, sinon l'ancre) ;
                       effects.setCoinFlight(on), harvestPop, burst, ring, badge, qualityFx, giantFx, nudge,
                       cameraNudge(out), rainbowAlpha() ; env.special (météo spéciale) ; stats() + rings, stars
src/render/lot2-actors.js  createLot2Actors(effects) : sync(game, layout, { day, dayProgress }), onEvent('surprise' |
                       'forage' | 'foragePicked' | 'finds'), update, draw, clear, shift, stats
src/render/scene.js    géants (pv.giant), cueillette (pv.forage), acteurs du lot 2, fxState.special =
                       state.surprises.sky.today, arc-en-ciel aussi dans les niveaux, secousse douce ; scene.lot2Stats()
src/ui/juice.js        createJuice(app) → app.juice : onEvent, frame(dt), swipeStart(), swipeEnd(), reset(), stats()
src/ui/lot2.js         createLot2(app) → app.lot2 : onEvent, frame(), reset(), openWish(game), openFinds(ev),
                       specialIcon(id, cls) ; récompenses (écus, décors trouvés)
src/ui/hud.js          holdMoney(hold, ms), releaseMoney(hold), catchCoin() ; icône et nom de la météo spéciale
src/ui/todo.js         morningNote(text) : ligne en tête du prochain résumé du matin (2 au plus)
```

- **Récolte juteuse (B1)** : la culture mûre (fantôme du sprite) s'écrase (0–25 %), s'étire en sautant (25–60 %) puis
  rétrécit et s'efface (0,36 s), feuilles et terre ; 1 à 3 pièces (nœuds DOM réutilisés, `#fx-layer`, z-index 21 :
  au-dessus de la barre du haut, sous les feuilles) partent 0,12 s après et filent en courbe jusqu'à l'icône du compteur ;
  le compteur **attend leur arrivée** (`holdMoney`, 1,4 s au plus) et fait un petit bond doré à chaque prise (« +N » sous
  le compteur après 0,62 s). Au sol, la gerbe de pièces est réduite à 2 (`setCoinFlight(true)`, posé par `main.js`).
  Note marimba qui monte à chaque parcelle d'une série (glissé ou touchers rapprochés) ; la série retombe après 1 s
  sans récolte (0,38 s après le lever du doigt) ; total « +46 » (gros, apparition « ressort ») au-dessus de la dernière
  parcelle si ≥ 2 parcelles. Vibration de `gestures.js` (8–12 ms) ; dorée : `[14, 50, 22]`. Semis : bouffée de terre en
  anneau + bruit sourd ; arrosage : anneau d'eau + éclaboussure. Seulement pour le joueur (`by` absent ou `'player'`) :
  l'équipe et les machines gardent l'ancien rendu discret. Cueillette (`foragePicked`) : même plaisir.
- **Qualité (B2)** : belle → couronne d'étincelles argentées, onde claire, badge `quality.fine`, son « belle » ; dorée →
  étincelles d'or, onde dorée, badge `quality.gold` (repli : étoile dessinée), arpège + clochette, texte « +N » doré ;
  message pour la **première dorée de chaque culture** (`localStorage` `une-annee-a-la-ferme.lot2.firsts`, par mode).
- **Géants (B3)** : `crop.<id>.giant` à l'échelle entière la plus grande qui tient dans le carré (portrait : ×2), ombre,
  petit souffle toutes les ~3,5 s, scintillement, une seule pastille « mûre » ; fusion (`giant`) : étincelles + onde,
  message, ligne du matin ; récolte : grand saut, confettis, couronne, secousse douce de la vue (1–2 px du monde,
  0,32 s, jamais en mouvements réduits), fanfare, vibration, message.
- **Surprises (B4)** : fée (boucles en huit au-dessus du carré mûri, traînée d'étincelles, onde finale), renard (entre
  par le côté du champ, ≤ 4 s, s'assoit au pied de la clôture / près de la maison en carrière, dort le soir, tant que
  `state.surprises.fox`), coffre (tombe près de la maison, éclat, s'ouvre : pièces ou écus), hérisson (se promène dans
  le champ tant que `hedgehog`), chouette sculptée (près de la maison toute la journée), cercle de fées (étincelles ; le
  cercle est la cueillette dessinée par la scène). Chacune : message avec son dessin, son (carillon, magie, arpège),
  ligne du résumé du matin, récompenses (écus → `careerEcus`, décor → `unlockCosmetic` ou `ecusIfOwned`).
- **Météos spéciales (B5)** : pluie chaude (gouttes dorées, lumière chaude), brouillard (deux nappes tramées qui dérivent,
  texture 128 × 128 créée une fois), heure dorée (étalonnage chaud toute la journée), arc-en-ciel (sprite
  `effect.rainbow`, niveaux et carrière), étoiles filantes le soir (crépuscule bleu-violet, traînées `star.shooting.*`
  par-dessus l'étalonnage). Barre du haut : icône `icon.weather.<id>` (repli : icône de base + petit signe) et nom ;
  infobulle avec l'effet. Vœu : fenêtre « Faites un vœu » (ciel animé, 3 vœux du cœur → `makeWish`), ouverte quand rien
  d'autre n'est ouvert (pause pendant la lecture) ; fermée sans choisir → message « Votre vœu attend » qui la rouvre.
- **Trouvailles (B6, carrière)** : pendant le défrichage, chaque trouvaille sort d'une souche (`land.stump.find`) et saute
  (`find.*`) ; puis carte « Une trouvaille ! » (liste animée, bouton « Merveilleux ! ») ~2,6 s après l'achat.
- **Débogage** (`?debug=1`) : `__debug.lot2.{ enable(), forceQuality(i, q), matureAll(cropId), harvest(i, q), giant(cropId),
  surprise(kind), weather(id, { tomorrow, dayProgress }), wish(), finds(lotId, kinds), swipe(ms, q), stats() }` ;
  `onGameEvent(ev, game)` (main.js) est la réaction commune à tout événement du cœur. `surprise(kind)` passe
  uniquement par `actions.triggerSurprise` du cœur (→ `{ ok: false, reason }` si elle est impossible aujourd'hui :
  renard hors carrière, hérisson sans maladie, chouette déjà trouvée) ; `wish()` par `newWish` du cœur ;
  `giant`, `weather` et `finds` restent des aides de visuel (le cœur n'a pas d'action pour eux).
- **Intégration (2026-10-02)** : `game.surprises` (booléen, getter de l'objet partie) ; la barre du haut lit
  `query.forecast().special` (arc-en-ciel de carrière compris) ; fiche de la parcelle (`src/ui/field.js`) : chances
  de la prochaine récolte à la main et soins (`query.plot().quality` / `care`, fiche seulement), géant, cueillette
  (« Cueillir (+N) ») ; décors trouvés : `DECOR_SPRITES['owl.carved'] = 'owl.carved'`,
  `DECOR_SPRITES['statue.small'] = 'find.statue'` ; tuile de boutique `is-tofind` « À trouver à la ferme » tant que
  l'objet n'est pas possédé (`unlockFlow` refuse), « Trouvé à la ferme » ensuite ; messages et carte des trouvailles
  disent le gain réel (déjà possédé → « +5 écus à la place ») ; résumé du matin : gain de la surprise.
- **Mesures** (Pixel 7 émulé) : glissé de 12–24 parcelles à 60 i/s (médiane 16,7 ms, 95e centile 16,8 ms), aucune
  erreur de console ; carrière : glissé, surprises et 10 jours sans erreur.

## Lot 3 — contrats (CORE · ART · UI/RENDER, conception 2026-10-02)

Tableau du village (C1), cadeau de fin de saison (C2), charrette du marché (C3), défis de saison (C4), années à thème
de la carrière (C5), jour du colporteur et graines rares (C7). Règles chiffrées : `docs/GAME_DESIGN.md` § 16. Ce qui
suit fixe les **noms, formes et comportements** que les trois paquets se promettent ; tout est **ajouté** (rien du
contrat existant n'est retiré ni renommé). Tant que CORE n'a pas livré, UI/RENDER simulent les requêtes avec des objets
factices de la même forme ; tant qu'ART n'a pas livré, RENDER/UI dessinent un repli (`canDraw`, comme au lot 2).

### Règles communes

- **Parité Classique** : `createGame` en Classique sans option `variety` ne crée **ni** `state.variety` (clé absente,
  pas `null`), **ni** flux aléatoire, **ni** événement, **ni** champ de requête nouveau (`plantableCrops`, `plot`,
  `forecast`, `summary` identiques) : `tests/parity.test.js` et `tools/capture-parity.js` inchangés et verts. Toute règle
  du lot est gardée par `state.variety` (et par `state.variety.parts.<partie>`).
- **Aléatoire** : deux flux **nouveaux**, créés seulement quand la variété est active : `state.rng.orders`
  (`hashSeed(seed, 'orders')` : commandes du tableau et relances) et `state.rng.variety` (`hashSeed(seed, 'variety')` :
  charrette, cartes, défis, étal du colporteur, thèmes, averses de l'année des grenouilles). Météo, marché, maladie,
  `career`, `staff`, `events`, `quality`, `surprise`, `sky` tirent **le même nombre** de nombres qu'avant à chaque étape
  (les seuils de certains tirages changent avec un thème ou une carte, jamais le nombre de tirages).
- **Pur** : `src/data/variety.js`, `src/data/career/themes.js`, `src/core/requests.js`, `src/core/variety.js`,
  `src/core/career/{variety,themes}.js` n'importent ni DOM ni horloge.
- **Jour absolu** : `absDay(state)` de `src/core/surprises.js` (niveaux : `time.day` ; carrière : `(année − 1) × 4 ×
  durée + jour`). **Saison absolue** : `seasonAbs(state)` = `(année − 1) × 4 + seasonIndex` (niveaux : `seasonIndex`).
- Actions : `{ ok: true, … }` ou `{ ok: false, reason }` (texte français). Textes des données en français.

### Fichiers

```
src/data/variety.js          (nouveau, pur) VARIETY_VERSION, VARIETY_PARTS, BOARD, ORDER_RATES, ORDER_SIZES, ORDER_TWO_LINES,
                             FEASIBLE_WEIGHTS, CLIENTS (12), CART, CARDS (16), CHALLENGES (12), MEDALS, MERCHANT,
                             MERCHANT_ITEMS, VARIETY_HINTS, textes
src/data/career/themes.js    (nouveau, pur) THEME_RULES, THEMES (9) : vedette, effets, fête, visiteur, rang, textes
src/data/crops.js            + RARE_CROPS (pea, melon, leek ; champ rare: true), isRareCrop(id) ; getCrop(id) les trouve aussi.
                             ⚠ CROPS, BASE_CROPS et l'ordre des cultures NE CHANGENT PAS (le marché de carrière, les
                             trouvailles et « Herbier complet » parcourent CROPS : y ajouter une culture changerait leurs tirages)
src/data/cosmetics.js        + 'lantern.peddler', 'weathervane.rooster', 'sign.magazine' (category 'small', price 0, found: true)
src/core/requests.js         (nouveau, partagé niveaux / carrière) générateur « faisable cette saison », tableau, charrette,
                             récoltes comptées, livraison depuis le grenier
src/core/variety.js          (nouveau, partagé) état, activation, migration, vérification ; étapes de l'aube et du soir ;
                             cartes, défis, colporteur, graines rares ; effets (varietyEffect) ; requêtes
src/core/career/variety.js   (nouveau) extension de carrière id 'variety' (points d'accroche, fournisseurs, actions de grenier)
src/core/career/themes.js    (nouveau) années à thème : tirage, effets (themeFactor), fête, visiteur
src/core/career/extensions.js  + import './variety.js';
tests/requests.test.js, tests/variety.test.js, tests/variety-career.test.js, tests/variety-migration.test.js  (nouveaux)
assets/sprites/generate-lot3.py → assets/sprites/lot3.png + bloc « // <lot3:auto> » d'atlas.js  (ART)
src/ui/variety.js, css/variety.css  (UI ; css/variety.css ajoutée à CSS_FILES de tools/build.js)
src/render/variety-actors.js  (RENDER : charrette, roulotte, colporteur, visiteur du thème, poule voyageuse)
```

### Activation et options

```js
createGame({ levelId, seed, perks, difficulty, surprises, variety })
//   variety : undefined → activée si difficulty !== 'classique' (clé ABSENTE en Classique)
//             true → toutes les parties ; false → state.variety = null (gardé tel quel à la reprise)
//             { board, cards, cart, challenges, merchant } → seulement les parties à true (absentes = true)
createCareer({ …, surprises, variety })   // défaut true ; même forme ; partie en plus : themes
game.variety            // booléen (accesseur, comme game.surprises)
```

`VARIETY_PARTS = ['board', 'cards', 'cart', 'challenges', 'merchant', 'themes']` (`themes` : carrière seulement).

### État (`state.variety`, `null` ou absent quand c'est désactivé)

```js
state.variety = {
  v: 1,
  parts: { board: true, cards: true, cart: true, challenges: true, merchant: true, themes: true },
  nextId: 1,                                   // identifiants 'o7' (commandes), 'c3' (charrettes)
  board: {
    slots: [order | null, order | null, order | null],
    startDay: 1,                               // jour absolu du premier remplissage (niveau 1 : 5)
    rerollDay: 0,                              // jour absolu de la dernière relance (une par jour)
    yesterday: [cropId],                       // cultures demandées hier (poids × 0,5)
  },
  // order = { id, clientId, day /* jour absolu d'affichage */, lines: [{ cropId, n, got }], rate /* 1.2..1.6 */,
  //           kept: false, base: 0 /* Σ valeur de base des unités comptées */, fromStock: 0 }
  cart: null | { id, season /* saison absolue */, crates: [{ cropId, n, got }], base: 0, departDay, horse: false },
  cards: {
    offer: null | { season /* saison où l'effet s'applique */, options: [cardId, cardId] },
    active: [{ id, season, until /* jour absolu inclus */, data? }],   // cartes « saison » en cours ou à venir
    last: null | [cardId, cardId],
    pending: { freePlot: false, clearingHalf: false, rentFactor: 1, chargeFactor: 1, cartFactor: 1 },   // cartes « prochaine fois »
  },
  challenges: {
    season: null | seasonAbs,                  // saison des défis proposés
    options: [challengeId × 3], kept: [challengeId],   // 2 au plus
    targets: { [challengeId]: [bronze, silver, gold] },
    medals: { [challengeId]: 0 | 1 | 2 | 3 },
    next: null | { season, options, targets }, // défis proposés le soir pour la saison suivante
    last: null | [challengeId × 3],
  },
  season: { abs, harvests: 0, sales: 0, harvested: {}, sown: {}, care: 0, quality: 0, orders: 0, crates: 0,
            products: 0, apples: 0, animals: 0, collect: 0 },   // compteurs de la saison en cours (défis)
  merchant: null | { season, soonDay, arriveDay, leaveDay, announced: false, stall: [{ itemId, price, sold: false, data? }] },
  rare: { pea: 0, melon: 0, leek: 0 },         // graines rares restantes (semis gratuits)
  freeSows: { [cropId]: n },                   // semis offerts d'une culture ordinaire (visiteurs de thème)
  owned: { copperCan: false, almanac: false, horseshoe: false },
  stats: { ordersDone: 0, ordersPremium: 0, ordersByClient: {}, carts: 0, cartsFull: 0, cratesFull: 0, cartPremium: 0,
           cardsPicked: {}, cardIncome: 0, medals: { bronze: 0, silver: 0, gold: 0 }, medalCoins: 0, medalEcus: 0,
           merchantSpent: 0, merchantBought: {}, rareSown: {}, rareHarvested: {} },   // pour l'album (lot 4)
}
// Carrière seulement (extension 'variety', partie themes) :
state.career.theme = { year /* année du thème en cours */, id: null | themeId, next: null | themeId, bag: [themeId],
  festivalDone: false, visitor: null | { offerId, done: false }, history: [{ year, id }] }
// Parcelles : aucun champ nouveau. Plantation d'une graine rare : p.cropId = 'pea' | 'melon' | 'leek' (getCrop les connaît).
```

`checkVariety(state) → null | 'problème'` (appelé par `checkState` des niveaux et par `check` de l'extension) : version,
identifiants connus (clients, cultures, cartes, défis, objets, thèmes), `0 ≤ got ≤ n`, 3 places, 2 défis gardés au plus,
jours entiers ≥ 0, `rare`/`freeSows` entiers ≥ 0.

### Déroulé (niveaux : `src/core/game.js` ; carrière : extension + `runtime.js`)

**Aube** (niveaux), après l'étape 6 (marché) et la fin des surprises du lot 2 (`surprisesDawnEnd`) :
`varietyDawn(state, ctx) → events` :
1. effets des cartes échus (`until < aujourd'hui`) retirés (`cardEnded`) ;
2. nouvelle saison : `season` remis à zéro ; défis : `next` devient la saison courante (sinon tirage, 1re saison) ;
   **charrette** (`cartArrived`) ; commandes gardées devenues impossibles retirées (`orderRemoved { reason: 'withdrawn' }`,
   prime des unités données) ;
3. **colporteur** : veille → `merchantSoon` ; jour d'arrivée → étal tiré, `merchantArrived` ;
4. **tableau** : à partir de `board.startDay`, commandes non gardées et pas commencées remplacées, places vides remplies
   (`ordersRenewed { reason: 'dawn' }`).
Étape 7 : après l'arrosage automatique, `varietyWater(state, level, today) → [plotIndex]` (arrosoir magique : 4 ;
arrosoir de cuivre : 3 ; parcelles semées, non mûres, non arrosées, qui en ont besoin aujourd'hui, les moins avancées
d'abord) → `dawn.varietyWatered`. Étape 9 : revenu `{ source: 'cardHen', amount: 4, owned: 1, kind: 'card' }` (carte
`hen`) ; revenus quotidiens des animaux × 1,15 (carte `hay`, arrondi, pas la tonte). Les événements du lot sont émis
après `dawn` (après ceux du lot 2).

**Soir** (niveaux), dans `endOfDay` :
- jour de départ du colporteur : `merchantLeft` (étal vidé) ;
- dernier jour de la saison, **avant** la vente en l'état et le fermage : **départ de la charrette** (prime payée,
  `cartDeparted`) ;
- fermage : montant × `cards.pending.rentFactor` (0,8 avec la carte `landlord`, puis remis à 1) — `rentFor` le lit,
  `query.finance().nextBill.amount` aussi ;
- après `billPaid` (pas de faillite) : défis jugés (`challengesJudged`) ; si ce n'est pas la dernière saison :
  `cardsOffered` puis `challengesOffered` (saison suivante) ; dernière saison : `challengesJudged` avant `victory`.

**Pendant la journée** : récolte (ci-dessous), plantation (graines rares, semis offerts), compteurs des défis (`season`)
mis à jour par les actions et l'aube ; médaille atteinte → `challengeMedal` tout de suite (pièces versées par le cœur,
écus par l'interface).

**Carrière** (extension `variety`, ordre d'enregistrement après `events`, `quests`, `surprises`) :
`seasonStart` (étape 2 de l'aube) → points 1 et 2 ci-dessus, fête et visiteur du thème du jour ; `dawnEvents` → points 3
et 4, averse de l'année des grenouilles ; `water` → arrosoirs (6 / 4 parcelles) ; `incomes` → `hay` (+15 % de la
production des abris, poste `animals`), thème des abeilles (+50 % des ruches) et du tourisme (+25 % chambre d'hôte) ;
`harvest` → récolte comptée (ci-dessous) ; `evening` → départ du colporteur, et le **dernier jour de la saison** : départ
de la charrette, défis jugés, `cardsOffered` et `challengesOffered` (avant les charges de saison) ; `yearEnd` → tirage du
thème suivant (`themeAnnounced`), `report.variety` ; nouveau `seasonStart` du printemps → `themeStarted`.

### Récolte comptée (commandes, charrette)

`claimHarvest(state, level, { plotIndex, cropId, units = 1, by }) → null | { kind: 'order' | 'cart', id, label, … }` :
seulement si `by === 'player'` (niveaux : toujours) ; ordre (1) quête de Joseph (carrière, son point d'accroche, inchangé)
→ (2) commandes du tableau (la plus avancée, puis la plus ancienne) → (3) caisse de la charrette. Un géant compte pour
4 unités (réparties dans cet ordre, le reste est vendu normalement).

- **Niveaux** (`game.js`, action `harvest`) : après le tirage de qualité, avant `tryProcessHarvest` : si la récolte est
  comptée, elle n'est **pas** transformée ; `amount = raw + qualityBonus` (payée tout de suite) ; `harvested.claimed = {
  kind, id, label }` ; puis `orderProgress` / `cartProgress` (et `orderDone`, `crateFull`).
- **Carrière** : le point d'accroche `harvest` peut renvoyer **`{ divert: true, sell: true, label }`** (nouveau champ
  `sell`) : `runtime.js` saute alors l'atelier et le grenier **et paie** la valeur (prime « à la main » et qualité
  comprises) comme une vente ; sans `sell`, comportement d'avant (rien payé : visiteurs, quêtes). `harvested.diverted`
  = label (« → Lili ») et `harvested.claimed`.
- Valeur de base d'une unité (prime) : `baseUnitValue(state, level, cropId)` = `round2(sellPrice × level.cropPriceFactor ×
  modifiers.rawPriceFactor)` (sans étal, cours, fête, « à la main », qualité). `order.base += …` à chaque unité ; prime à
  la livraison = `round(base × (rate − 1))` ; charrette : `round(base × 0,10)` (+ `round(base × 0,10)` et 2 écus si tout
  est plein ; × 2 avec `horse`).
- Argent du lot (niveaux) : statistique `varietyIncome` (année et saison, créée seulement quand il y en a ; comptée dans
  `summary.net`) ; `summary.variety = { orderPremium, cartPremium, cardIncome, medalCoins, merchantSpent, ordersDone,
  cratesFull, medals }`. Carrière : postes du bilan `orders`, `cart`, `cards`, `medals` (revenus) et `merchant` (dépenses ;
  achats d'animaux et de ruches comptés aussi au patrimoine comme d'habitude).

### Actions (`game.actions.*`, les deux modes)

```js
keepOrder(orderId, keep = true)      → { ok, order: orderInfo }
    // refus : 'Commande inconnue.' ; keep = false sur une commande commencée : 'Une commande commencée reste gardée.'
declineOrder(orderId)                → { ok, premium }        // orderRemoved { reason: 'declined', premium } ; prime des unités données
rerollOrders()                       → { ok, replaced }       // ordersRenewed { reason: 'reroll' }
    // refus : 'Une seule relance par jour : revenez demain.' ; 'Toutes les commandes sont gardées.'
deliverOrder(orderId)                → { ok, delivered, done, amount, premium? }   // CARRIÈRE : depuis le grenier
    // niveaux : 'Les commandes se remplissent quand vous récoltez.' ; 'Rien au grenier pour cette commande.'
loadCart(crateIndex)                 → { ok, loaded, full, amount }               // CARRIÈRE : depuis le grenier
pickCard(cardId)                     → { ok, card: cardInfo, amount?, gift? }     // cardPicked
    // refus : 'Pas de cadeau à choisir.' ; 'Cette carte n'est pas proposée.' ; carte devenue impossible (plus de place
    // pour la ruche…) : 'Plus possible : choisissez l'autre carte.'
keepChallenge(challengeId, keep = true) → { ok, kept: [ids] }
    // refus : 'Défi inconnu.' ; 'Deux défis au plus.' ; keep = false : 'Ce défi a déjà une médaille.'
buyFromMerchant(itemId, arg?)        → { ok, item, cost, cosmeticId?, ecusIfOwned?, heirloom? }   // merchantBought
    // arg : carrière, engrais → lotId (sinon le champ le plus semé) ; refus : 'Le colporteur n'est pas là.' ;
    // 'Déjà vendu.' ; notEnoughMoney(n) ; 'Le poulailler est plein.' ; 'Plus de place pour une ruche.'
triggerVariety(kind, arg?)           → { ok, … }   // DÉBOGAGE / tests : 'cart' | 'merchant' | 'cards' | 'challenges' | 'board' | 'theme'
// Modifiées :
plant(i, cropId)   // graine rare : il faut rare[cropId] > 0 (sinon 'Plus de graines rares : le colporteur en vend.'),
                   // coût 0, rare[cropId]−1 ; semis offert (freeSows) : coût 0 ; planted + { rare?, free?, seedsLeft }
harvest(i)         // + claimed (voir plus haut)
// Carrière : setPlan(lotId, seasonId, cropId rare) → 'Les graines rares se sèment à la main.' ; semoir et jardiniers
// ne sèment jamais une graine rare ni un semis offert. acceptOffer(offerId) accepte aussi le visiteur du thème
// (offer.kind = 'themeVisitor') : cadeau appliqué, offerResolved { outcome: 'accepted', gift }.
```

### Requêtes

```js
query.variety() → null | { enabled: true, parts, board: query.orders(), cart: query.cart(), cards: query.cards(),
  challenges: query.challenges(), merchant: query.merchant(), rare: [{ cropId, name, seeds, sowable }],
  owned, effects: [{ id, name, icon, text, until, daysLeft }], stats,
  calendar: [{ kind: 'merchant' | 'cartDeparture' | 'themeFestival' | 'themeVisitor', day, daysUntil, text }] }
query.orders() → { slots: [orderInfo | { empty: true, text }], canReroll, rerollReason, startsIn /* jours avant le début, niveau 1 */ }
  orderInfo = { id, clientId, clientName, clientTitle, portrait /* 'portrait.client.<id>' */, text, thanks,
    lines: [{ cropId, cropName, icon /* 'crop.<id>.icon' */, n, got, left, inStock /* carrière */ }],
    rate, ratePct, premium /* si complète */, premiumSoFar, kept, started, canDeliver, deliverCount, note }
query.cart() → null | { id, crates: [{ cropId, cropName, icon, n, got, full, inStock, canLoad }], departDay, daysLeft
  /* 0 = ce soir */, departText /* « Part ce soir » / « Part le soir du 7ᵉ jour » */, premiumNow, premiumFull, ecusFull, horse }
query.cards() → { offer: null | { season, seasonName, options: [cardInfo, cardInfo] }, active: [cardInfo + { until, daysLeft }] }
  cardInfo = { id, name, icon /* 'icon.card.<id>' */, text, kind: 'now' | 'season' | 'next', value? }
query.challenges() → null | { season, seasonName, options: [challengeInfo × 3], kept, canKeepMore,
  next: null | { season, seasonName, options: [challengeInfo × 3] } }
  challengeInfo = { id, name, icon /* 'icon.challenge.<id>' */, text, progress, targets: [b, s, g], medal: 0..3, kept,
    locked /* a une médaille */, rewards: [{ medal, ecus, coins }] }
query.merchant() → null | { here, soon, arriveDay, leaveDay, daysLeft, name: 'Basile le colporteur',
  portrait: 'portrait.merchant', line, stall: [{ itemId, name, icon /* 'item.<id>' ou 'seedbag.<crop>' */, text, price,
  sold, canBuy, reason, unique, cosmeticId? }] }
query.plot(i)          // + claim: null | { kind: 'order' | 'cart' | 'quest', id, label: '→ Lili', got, n }
query.plantableCrops() // + lignes des graines rares possédées : { …, rare: true, seedsLeft, seedCost: 0 } ;
                       //   + free: n (semis offerts) ; + requested: true (culture demandée au tableau ou à la charrette)
query.forecast()       // afterTomorrow aussi avec la carte almanac ou l'almanach du colporteur (même champ que le bonus)
query.finance()        // nextBill.amount tient compte de la carte landlord ; nextBill.reduced: true
query.summary()        // + variety (voir plus haut)
query.achievementContext()   // + variety: { ordersDone, cartsFull, medals, rareHarvested }
// Carrière :
query.career.theme() → null | { year, id, name, icon /* 'icon.theme.<id>' */, text, star: { kind: 'crop' | 'product',
  ids, names, factor: 1.25 }, effects: [texte], festival: { name, seasonId, day, daysUntil, done },
  visitor: { name, portrait /* 'portrait.theme.<id>' */, seasonId, day, done, offerId }, next: null | { id, name } }
query.career.events()  // calendar : + { kind: 'themeFestival' | 'merchant', … } ; offers : + kind 'themeVisitor'
query.career.yearReport()  // + variety (compteurs de l'année) et nextTheme
```

### Événements (seulement quand c'est activé)

| Type | Données | Pour |
|---|---|---|
| `ordersRenewed` | `{ reason: 'dawn' \| 'reroll' \| 'start', slots: [orderInfo \| null], added }` | feuilles du panneau, résumé du matin |
| `orderProgress` | `{ orderId, clientName, cropId, got, n, label, plotIndex?, fromStock? }` | texte flottant « → Lili », bruit de papier |
| `orderDone` | `{ orderId, clientId, clientName, thanks, premium, units }` | pièces vers le compteur, message du client, coche sur le panneau |
| `orderRemoved` | `{ orderId, clientName, reason: 'declined' \| 'withdrawn', premium }` | message doux |
| `cartArrived` | `{ cart: cartInfo, text }` | charrette qui arrive, message, conseil `variety.cart` |
| `cartProgress` / `crateFull` | `{ crateIndex, cropId, got, n, plotIndex?, fromStock? }` / `{ crateIndex, cropId }` | caisse qui se remplit |
| `cartDeparted` | `{ units, base, premium, allFull, ecus, crates: [{ cropId, n, got }], text }` | charrette qui s'en va, ligne de la fin de saison ; écus → progression |
| `cardsOffered` | `{ season, seasonName, options: [cardInfo, cardInfo] }` | page « Un cadeau pour la saison » de la fin de saison |
| `cardPicked` / `cardEnded` | `{ card, amount?, gift? }` / `{ id, name }` | son, animation ; message de fin d'effet discret |
| `challengesOffered` | `{ season, seasonName, options: [challengeInfo × 3] }` | page « Les défis de … » |
| `challengeMedal` | `{ challengeId, name, medal: 'bronze' \| 'silver' \| 'gold', ecus, coins }` | message doré, médaille ; écus → progression |
| `challengesJudged` | `{ season, results: [{ challengeId, medal }] }` | fin de saison |
| `merchantSoon` / `merchantArrived` / `merchantLeft` | `{ arriveDay, text }` / `{ merchant: merchantInfo, text }` / `{ sold }` | annonce, roulotte, toast « Voir » |
| `merchantBought` | `{ itemId, name, price, cosmeticId?, ecusIfOwned?, heirloom? }` | décor → `unlockCosmetic` (sinon `ecusIfOwned` écus) |
| `themeAnnounced` / `themeStarted` | `{ year, theme: themeInfo }` | bilan annuel (« L'an prochain… »), bandeau du printemps |
| `festival` | + `theme: true` (fête de l'année à thème) | comme les autres fêtes |
| `offer` / `offerResolved` | `kind: 'themeVisitor'` | visiteur unique du thème |
| `harvested` | + `claimed: { kind, id, label }` | |
| `planted` | + `rare`, `free`, `seedsLeft` | badge « Rare » |
| `dawn` | + `varietyWatered: [index]` ; `incomes[]` : `source: 'cardHen'` | gouttes, texte flottant |

### Migration et sauvegardes

- **Niveaux** : `STATE_VERSION` reste 2. `migrateState` : `s.variety === undefined && s.difficulty === 'detente' &&
  s.rng` → `newVarietyState()` + flux (`completeVariety`) ; le tableau se remplit à l'aube suivante (`board.startDay` =
  jour suivant), pas de charrette ni de défis avant la saison suivante, cartes à la fin de la saison en cours. Classique :
  rien. `s.variety` présent → `completeVariety` (champs ajoutés plus tard).
- **Carrière** : extension `variety` — `init` (création) et `migrate` (chargement) : `state.variety` absent → activé (comme
  les surprises) ; `state.career.theme = { year: année en cours, id: null, … }` (pas de thème pour l'année en cours) ;
  offres `visitor` et `merchant` en cours gardées jusqu'à leur fin (le tirage ne les propose plus). `CAREER_VERSION` ne
  change pas (champs ajoutés, vérifiés par `check`).
- **Progression** (`progression.js`, `normalizeProgress`) : `progress.lifetime.variety = { orders: 0, cartsFull: 0,
  medals: { bronze: 0, silver: 0, gold: 0 }, rare: {} }`, ajouté par `recordRunEnd` (depuis `summary.variety`) et
  `recordCareerYear` (depuis `report.variety`) ; aucune autre clé, pas de changement de `schema`.
- Tests : `tests/career-helpers.js` crée ses carrières avec `variety: false` par défaut (comme `surprises`) : les tests
  existants de carrière restent valables tels quels ; `tests/variety-migration.test.js` vérifie les aller-retours, la
  migration Détente / Classique / carrière et `checkVariety`.

### Points d'accroche et fournisseurs de carrière (ajouts à `registry.js` / `runtime.js`, CORE)

- Résultat du point d'accroche `harvest` : `{ divert: true, sell: true, label }` (voir « Récolte comptée »).
- Nouveau fournisseur `seasonChargeFactor(state) → number` (produit) : charges de saison × 0,8 (carte `landlord` en
  carrière, une fois).
- Fournisseurs existants utilisés : `priceFactor` (vedette du thème × 1,25 ; carte `poster` récoltes × 1,05 ; carte
  `recipe` produits × 1,15 ; fêtes du thème ; année des lumières : produits × 1,15 en hiver), `seedFactor` (carte
  `seedFair` × 0,5 les 3 premiers jours ; thème des géants : citrouille × 0,8 ; thème du pain : blé × 0,8),
  `effects('growthBonus')` (carte `fertilizer` + 0,1), `extraPlaces(state, 'dairy')` (+1 : visiteur du thème du fromage).
- Lus directement (gardés par `state.variety` / `state.career.theme`) : `src/core/surprises.js` (chances de qualité × 2
  avec `clover`, + 1 point / 0,3 point avec `horseshoe` ; chance des géants × 2 année des géants ; heure dorée × 0,5
  année des grenouilles) ; `src/core/career/events.js` (avec `parts.board` : poids du visiteur 0 ; `parts.merchant` :
  poids du marchand 0 ; tirage du jour `RANDOM_EVENT_RULES.chanceWithVariety = 0.10` ; thème du tourisme : touristes
  poids × 2 et × 1,5 par passage ; grenouilles : corbeaux poids × 0,5 ; pêche × 1,5 avec la canne de Firmin) ;
  `src/core/career/market.js` (année des grands marchés : bornes 0,7 – 1,45) ; `src/core/trees.js` (année des vergers :
  fruits × 1,2 par aube, carrière seulement) ; `src/core/economy.js` (niveaux : `rentFor` × `rentFactor`, revenus des
  animaux × 1,15, revenu de la poule voyageuse) ; `src/core/farm.js` (niveaux : récoltes × 1,05 avec `poster`, pousse
  + 0,1 avec `fertilizer`, prix des graines × 0,5 avec `seedFair`, `plotUnlockCost` = 0 avec `clearing`) ;
  `src/core/career/land.js` (aménagement suivant × 0,5 avec `clearing`) ; `src/core/career/buildings.js` / `animals.js`
  (ruche ou poules offertes : mêmes règles de place que l'achat, sans le prix).

### Simulation

- `tools/simulate.js` : `--variety on | off | board,cards,cart,challenges,merchant` (défaut : selon le mode) et
  `--compare-variety` (sans → avec, même graine ; colonnes : revenu, argent final, victoires, ★★★, et gain par partie :
  tableau, cartes, charrette, médailles, colporteur). Robots humains (`casual`, `novice`) et `optimal` : comportements du
  § 16.10 du game design, **par l'API publique** et avec leur propre tirage (jamais les flux du jeu) ; robots scriptés
  de la parité (Classique) : inchangés. Les robots `careless` / `balanced` / `investor` en Détente : première carte,
  deux premiers défis, n'achètent rien au colporteur.
- `tools/simulate-career.js` : mêmes options (+ `themes`), `--compare-variety` (revenu par année, rang médian, Domaine,
  sollicitations par semaine).
- Après réglage : seuils d'étoiles Détente recalculés (`src/data/difficulty.js`, tableau du § 13.3 et note « Lot 3 »),
  tableaux du § 16.10 remplis avec les résultats.

### Ce que RENDER et UI consomment

**RENDER** (`src/render/*`) :
- Disposition : `layout.variety = { board: rect, cart: rect, crates: [rect × 4], merchant: rect, merchantNpc: point }`
  (portrait des niveaux : panneau au bord du chemin sous le portail du champ, charrette sur le chemin, roulotte près de
  la maison ; paysage : mêmes repères autour de la maison et du chemin ; carrière : bande de la maison, près de la boîte
  aux lettres et de la route). Absents si la variété est désactivée (rien dessiné en Classique).
- `scene.hitTest` : + `{ type: 'villageBoard' }`, `{ type: 'cart' }`, `{ type: 'merchant' }` (cibles tolérantes ≥ 48 px).
- Scène : panneau avec 0 à 3 feuilles (`board.note`, `board.note.kept` si gardée, `board.note.done` le jour d'une
  livraison) lues dans `query.orders()` ; charrette présente tant que `state.variety.cart` existe, caisses devant elle
  (`crate.empty` ou `crate.<cropId>` quand pleine) ; roulotte et Basile entre `arriveDay` et `leaveDay` ; animations sur
  `cartArrived` (la charrette arrive par le chemin, ~2 s), `cartDeparted` (elle part), `merchantArrived` / `merchantLeft`
  (la roulotte arrive / repart), `orderDone` (petite coche qui saute sur le panneau) ; poule voyageuse (carte `hen`, sprite
  de poule existant) dans la cour ; décor de la fête du thème (`fair.theme.<id>` + guirlandes existantes) ; visiteur du
  thème qui marche jusqu'au portail (`npc.visitor.*` existants) ; graines rares : `crop.<id>.0..4` et géants. Mouvements
  réduits : apparitions en fondu, aucun trajet.
- Nouvelle planche `lot3` dans `SHEETS` et `assets.js` ; `DECOR_SPRITES` : `lantern.peddler`, `weathervane.rooster`,
  `sign.magazine`.

**UI** (`src/ui/*`, `css/variety.css`, `src/main.js`) :
- `src/ui/variety.js` : `createVariety(app) → app.variety = { onEvent, openBoard(), openCart(), openMerchant(),
  openCards(), openChallenges(), seasonPages(ev), reset() }` ; feuilles « Le tableau du village », « La charrette du
  marché », « Basile le colporteur », « Un cadeau pour la saison », « Les défis de … » (formes au § 16 du game design ;
  cartes ≥ 72 px, boutons ≥ 48 px, textes ≥ 14 px, portraits 48 px).
- Fenêtre de fin de saison (`dialogs.js`) en pages : Bilan (existant) + ligne de la charrette + médailles → « Un cadeau
  pour la saison » (2 cartes) → « Les défis de … » (3 défis, garder 1 ou 2) ; « Plus tard » sur chaque page (pastilles
  ensuite). Le soir du dernier jour, l'ordre des événements est `cartDeparted`, `billPaid`, `challengesJudged`,
  `cardsOffered`, `challengesOffered` : la fenêtre se construit à partir de `billPaid` et des événements du même soir.
- Bilan (niveaux, `panel.js`) et Carnet (carrière, Agenda) : sections Tableau, Charrette, Défis, Cadeau en attente,
  Effets en cours, Colporteur (date), Thème de l'année (carrière).
- Feuille des graines (`field.js`) : lignes des graines rares (« Rare · 4 graines », coût 0), badges « Commande » et
  « Offert » ; fiche de parcelle : `claim` (« À la récolte : → Lili (3 / 5) »).
- Ligne « À faire maintenant » et résumé du matin (`todo.js`) : commande la plus avancée, arrivée de la charrette,
  colporteur (veille et jour), cadeau ou défis à choisir.
- Barre du haut : après-demain (`forecast().afterTomorrow`) avec l'almanach ; fermage réduit (« −20 % »).
- Récompenses : `cartDeparted.ecus`, `challengeMedal.ecus` → `app.progression.careerEcus(n)` (vaut pour les deux modes,
  comme au lot 2) ; `merchantBought.cosmeticId` (et `offerResolved.gift.cosmeticId` du thème du tourisme) →
  `unlockCosmetic` ou `ecusIfOwned`.
- Conseils « première fois » (`hints.js`) : `variety.board`, `variety.cart`, `variety.cards`, `variety.challenges`,
  `variety.merchant`, `variety.rare`, `career.theme` (textes dans `VARIETY_HINTS`).
- Sons : `synth.js` existant (`chime` livraison, `fanfare` charrette pleine et or, `pop` caisse pleine, `reveal` cartes,
  `magic` colporteur) ; aucun nouveau fichier son requis.
- Débogage (`?debug=1`) : `__debug.variety.{ state(), board(), fill(slot), cart(), merchant(), cards(), challenges(),
  theme(id), medal(id, n) }` (passent par `actions.triggerVariety` et les actions publiques).

### Sprites (paquet ART : planche `assets/sprites/lot3.png`, `assets/sprites/generate-lot3.py`, bloc `// <lot3:auto>`)

Même méthode que `generate-lot2.py` (palette Kenney, contour sombre 2 px, lumière en haut à gauche ; tuiles de 16 px).
Tailles : **16 × 16** sauf mention **32 × 32** (2 × 2 tuiles).

| Nom(s) | Taille | Description |
|---|---|---|
| `board.village` | 32 × 32 | panneau d'affichage du village : deux poteaux, petit toit de bardeaux, planche claire |
| `board.note`, `board.note.kept`, `board.note.done` | 16 × 16 | feuille de commande épinglée (à poser sur le panneau, 3 places) ; avec punaise rouge ; avec tampon vert « ✓ » |
| `cart.market`, `cart.market.1` | 32 × 32 | charrette du marché à ridelles tirée par un âne gris, de profil ; 2e image (roues et pattes décalées) pour le trajet |
| `crate.apple`, `crate.pea`, `crate.melon`, `crate.leek` | 16 × 16 | cagettes pleines manquantes (les autres `crate.<culture>` existent ; `crate.apple` seulement si absente) |
| `merchant.wagon`, `merchant.wagon.1` | 32 × 32 | roulotte du colporteur (bois peint, auvent rayé rouge et crème, lanterne) ; 2e image : auvent ouvert avec l'étal |
| `npc.merchant`, `npc.merchant.walk` | 16 × 16 | Basile : grand chapeau, gilet, sac à dos ; debout, en marche |
| `crop.pea.1` … `crop.pea.4`, `crop.melon.1` … `.4`, `crop.leek.1` … `.4` | 16 × 16 | étapes de pousse (l'étape 0 = graines semées communes) : petits pois (rames et gousses), melon (feuilles rampantes, melon jaune-vert), poireau (fût blanc, feuilles bleu-vert) |
| `crop.<id>.icon`, `crop.<id>.dead`, `crop.<id>.icon.gold`, `seedbag.<id>`, `sack.<id>` (id = pea, melon, leek) | 16 × 16 | icône de récolte, plant fané, icône dorée (lot 2), sachet de graines, grand sac |
| `crop.pea.giant`, `crop.melon.giant`, `crop.leek.giant` | 32 × 32 | légumes géants (lot 2) |
| `portrait.client.<id>` (rose, paulo, lili, garnier, chevalier, fabre, perrin, maire, odette, leon, morel, twins) | 32 × 32 | portraits des 12 clients (style `portrait.joseph`) : fleuriste à fleur au chapeau, boulanger enfariné, fillette à couettes et lapin, instituteur à lunettes, aubergiste au tablier, vieux pêcheur à casquette, musicienne au violon, maire à écharpe tricolore, grand-mère au chignon, facteur à casquette et sacoche, couturière au mètre ruban, jumeaux côte à côte |
| `portrait.merchant` | 32 × 32 | Basile le colporteur, souriant, chapeau à plume |
| `portrait.theme.<id>` (margot, anselme, journalist, gaspard, firmin, mathis, jeanne, wholesaler, northpeddler) | 32 × 32 | visiteurs uniques des thèmes : apicultrice voilée, fromager à béret, journaliste à appareil photo, jardinier à médaille, vieux pêcheur barbu, pépiniériste au plant, meunière enfarinée, grossiste à chapeau melon, colporteur du Nord en manteau de fourrure |
| `icon.board`, `icon.cart`, `icon.cards`, `icon.challenge`, `icon.merchant`, `icon.theme`, `icon.rare` | 16 × 16 | icônes d'onglets et de sections (style de `assets/sprites/ui/icons.png`) |
| `icon.card.<id>` (purse, seedFair, fertilizer, hen, watering, clover, poster, landlord, bees, crier, cartHorse, clearing, seedBag, recipe, hay, almanac) | 16 × 16 | bourse, sachets « −50 % », sac d'engrais, poule, arrosoir étoilé, trèfle, affiche, clé et pièce, essaim, crieur à cloche, fer et cheval, pelle et souche, sachet doré, livre de recettes, botte de foin, almanach |
| `icon.challenge.<id>` (harvests, sales, variety, sowing, care, quality, orders, crates, products, apples, animals, collect) | 16 × 16 | panier, pièces, trois légumes, graine, goutte et cœur, étincelle, feuille épinglée, cagette, pot de confiture, panier de pommes, poule, œufs |
| `medal.bronze`, `medal.silver`, `medal.gold`, `medal.empty` | 16 × 16 | médailles à ruban ; emplacement vide (contour pointillé) |
| `item.<id>` (fertilizer, usedCoop, hens, usedHive, copperCan, almanac, horseshoe, lantern, weathervane, heirloom) | 16 × 16 | objets du colporteur (les sachets de graines utilisent `seedbag.<culture>`) |
| `icon.theme.<id>` (bees, cheese, tourism, giants, frogs, orchard, bread, markets, lights) | 16 × 16 | abeille, meule, appareil photo, citrouille géante, grenouille, pomme, pain, balance, lampion |
| `fair.theme.<id>` (mêmes id) | 16 × 16 | petit stand de la fête du thème (pots de miel, meules, lampions, etc.) posé près de la maison |
| `lantern.peddler`, `weathervane.rooster`, `sign.magazine` | 16 × 16 | décors trouvés : lanterne de colporteur sur poteau, girouette au coq, panneau « Vu dans le magazine » |

`CREDITS.md` : planche dessinée pour le jeu, style Kenney (CC0), comme `lot2.png`.

### Découpage en 3 paquets parallèles

| Paquet | Possède (seul à modifier) | Livre | Attend |
|---|---|---|---|
| **CORE** | `src/data/variety.js`, `src/data/career/themes.js`, `src/data/crops.js` (RARE_CROPS), `src/data/cosmetics.js` (3 décors), `src/data/difficulty.js` (seuils), `src/core/{requests,variety}.js`, `src/core/career/{variety,themes}.js`, `src/core/career/extensions.js` (1 ligne), modifications de `src/core/{game,economy,farm,surprises,trees,stats,progression}.js` et `src/core/career/{runtime,registry,events,market,machines,work,land,buildings,animals}.js`, `tools/simulate.js`, `tools/simulate-career.js`, `tests/*` (nouveaux et `career-helpers.js`) | état, actions, requêtes, événements ci-dessus ; simulation et réglage ; tableaux du § 16.10 et seuils du § 13.3 | rien (commence par un `createGame({ variety })` qui ne fait rien, parité verte, puis ajoute chaque partie) |
| **ART** | `assets/sprites/generate-lot3.py`, `assets/sprites/lot3.png`, bloc `// <lot3:auto>` d'`atlas.js`, `CREDITS.md` | planche et noms du tableau des sprites ; planche de contrôle ×6 | rien |
| **UI/RENDER** | `src/ui/*` (nouveau `variety.js`), `css/variety.css`, `tools/build.js` (ligne `CSS_FILES` seulement), `src/main.js`, `src/index.template.html`, `src/render/*` (hors bloc `lot3:auto`), nouveau `src/render/variety-actors.js` | feuilles, pages de fin de saison, sections, scène, hit-test, animations, conseils, débogage ; vérification au doigt | CORE : API (factices de même forme en attendant) ; ART : sprites (repli `canDraw`) |

Points de contact : (1) **CORE → UI/RENDER** : formes `orderInfo`, `cartInfo`, `cardInfo`, `challengeInfo`,
`merchantInfo`, `themeInfo` et l'ordre des événements du soir (figés ici ; tout écart est noté par CORE dans une section
« Écarts » sous ce contrat) ; (2) **ART → RENDER/UI** : noms du tableau des sprites (aucun renommage sans prévenir) ;
(3) **CORE ↔ ART** : identifiants des cultures rares, clients, cartes, défis, objets, thèmes (figés ici) ; (4) intégration
par le chef de projet : `node --test tests/` (parité comprise), `node tools/simulate.js --compare-variety`,
`node tools/simulate-career.js --compare-variety`, `node tools/build.js`, vérification au doigt (Pixel 7, 360 × 740 :
cibles ≥ 48 px, textes ≥ 14 px, aucun débordement ; une année de niveau Détente et une année de carrière avec tableau,
charrette, cadeau, défis, colporteur et thème), `JOURNAL.md`, sauvegarde `backup/…` avant et après le lot.
