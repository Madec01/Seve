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

game.update(dtSeconds);        // fait avancer le temps (secondes DE JEU × vitesse) ; déclenche les aubes, fermages, etc.
                               // l'interface passe dt réel × GAME_SECONDS_PER_REAL_SECOND (rythme : 1 jour = 36 s réelles à ×1)
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
- **Messages** (`toasts.js`) : au-dessus des onglets et de la feuille ouverte, jamais sur la barre du haut ; ils ne captent **jamais** les touchers : un message qui propose une action (`onClick`) porte un bouton « Voir » (`actionLabel` : « Répondre », « Recharger »…), seul élément touchable. **Au plus deux messages à la fois** (`MAX_VISIBLE`) : les plus anciens (d'abord ceux qui ne proposent rien d'important) s'effacent et restent dans l'historique ; une pastille « +N messages » (`#toast-more`, ≥ 48 px) ouvre la feuille « Messages » (`toasts.setMoreHandler(fn)`, branché par `main.js` ; mesures : `toasts.stats()`). *(QA du lot 3, 2026-10-02 : au début d'une saison de carrière, quatre messages couvraient la bande de la maison et captaient le toucher.)* *(2026-10-03)* Tri « important / info » et réglage « Messages à l'écran » : voir « Rythme, personnages et messages ». Le **bandeau** (titre du niveau, saison, avertissements) se pose sous la barre du haut, en dessous d'elle et des feuilles (z-index), et s'efface dès qu'une bulle ou un rappel du tutoriel s'affiche en haut (`toasts.hideBanner()`).
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
- Rendu pixel art : `imageSmoothingEnabled = false`, zoom entier (seul un pincement en cours passe par un zoom fractionnaire, sans flou : voir « Zoom de la scène »), canvas redimensionné à la fenêtre.
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
  Le rendu fait marcher le personnage vers `target` **au pas, en temps réel**, puis joue l'action jusqu'à `doneAt` ; s'il
  ne peut pas y arriver à temps sans courir, il coupe par un fondu (voir « Rythme et personnages », 2026-10-03).
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

- `SPEEDS = [0, 0.5, 1, 2, 4]` (`src/data/balance.js`) ; `game.actions.setSpeed(0.5)` → un jour dure 40 s de jeu, soit 72 s
  réelles (rythme 2026-10-03 : `REAL_DAY_SECONDS` = 36).
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
  Montré après les fenêtres (bilan de saison), au plus un toutes les 25 s à l'écran (à ×4 une journée dure 9 s), toujours
  noté dans les messages ; interrupteur « Résumé du matin » dans la feuille Messages. *(2026-10-03)* Affiché seulement
  avec « Messages à l'écran : Tous » (ou quand le jeu attend en pause) ; sinon il attend derrière la cloche. Il regroupe
  les nouvelles de la veille qui ne se sont pas affichées : « Hier aussi : 12 récoltes de l'équipe (+46), 3 produits
  vendus, 1 naissance. 2 autres nouvelles dans les messages. » (`todo.digest(e)`, branché par `toasts.setDigest`). Option « pause chaque matin »
  (`autoPaused`) : le résumé le dit et reste 7 s (sinon un petit message « Pause du matin »).
- **« Où en étais-je ? »** (E6) : `app.todo.showResume(game)` à la reprise depuis le menu (« Continuer le niveau »,
  « Ma ferme » → Continuer) : ferme / niveau, date, argent, fermage ou charges (couvert ou manque), état du champ, les
  3 choses à faire ; bouton `#resume-ok` « Reprendre » (fenêtre `resume`, la partie est en pause). Remplace les messages
  « Partie reprise » (`careerUI.bind(game, { quiet })`).
- **Messages** (A9) : `toasts.setLogger(fn)` (main.js → `app.messages.add`) : chaque message montré et chaque bandeau
  sont notés (50 derniers, jour de jeu et heure) ; `show({ log: false })` pour les refus d'action (« Il manque… ») ;
  un message mis à jour (`key`) remplace sa ligne ; *(2026-10-03)* une répétition (même titre, même jour, parmi les 5
  dernières lignes) devient « Titre ×N ». Messages importants (alerte, gel, action à toucher, erreur) ≥ 5 s à l'écran,
  infos 3 s (4,2 s au plus). Feuille `messages` : depuis la cloche, le menu Pause (`#pause-messages`) et le Carnet
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
| `pinchZoom` | `true` | « Loupe de l'interface » : viewport sans `user-scalable=no` (zoom de la PAGE sur les barres et les fiches ; la scène garde `touch-action: none` et son propre zoom, voir « Zoom de la scène ») |
| `vibration` | `true` | `app.vibrate` ; motifs : toucher 8–12 ms, erreur `[30,40,30]`, alerte de saison `[15,80,15,80,15]` |
| `a11yOffered` | `false` | la fenêtre du premier lancement a été montrée (ou fermée par le joueur) |
| `speed` | `1` | vitesse préférée (0,5 accepté) |
| `messages` | `'important'` | « Messages à l'écran » : `'all'` · `'important'` · `'none'` → `toasts.setMode` (voir « Rythme, personnages et messages ») |

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
    // (QA du lot 3) semer À LA MAIN la culture d'une commande non gardée la garde d'office (orderKept { auto: true },
    // champ d'état facultatif `order.autoKept = true`, `orderInfo.autoKept`) ; keepOrder(id, false) l'efface.
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
| `orderKept` | `{ orderId, clientId, clientName, cropId, auto: true, plotIndex? }` | *(QA du lot 3)* gardée d'office au semis de sa culture : étiquette « Gardée : Lili » sur la parcelle, punaise rouge, mention dans la feuille |
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

### Écarts et précisions (livraison CORE, 2026-10-02)

Tout le contrat est livré ; ce qui suit précise ou s'écarte de ce qui est écrit plus haut (aucun nom ni forme du contrat
n'est retiré, seulement des champs **ajoutés**).

- **Fichiers en plus** : `src/core/variety-effects.js` (lecture pure des effets en cours : cartes, objets du colporteur,
  thème ; aucune dépendance vers le cœur, pour que `farm.js`, `economy.js`, `trees.js`, `surprises.js`, `processing.js`
  et les modules de carrière le lisent sans cycle d'imports) ; `src/core/career/variety-host.js` (hôte de carrière,
  livraisons depuis le grenier, compteurs de l'année, **sans** enregistrement : `runtime.js` et `game.js` l'importent
  sans changer l'ordre des extensions). L'extension `variety` est enregistrée explicitement par `extensions.js`, en
  **dernier** (ordre : surprises, staff, events, quests, animals, machines, work, variety) : la quête de Joseph passe
  avant le tableau pour les récoltes. Modifiés en plus de la liste : `src/core/processing.js` (carte « recette » des
  niveaux), `src/core/career/storage.js` (ventes du grenier comptées pour le défi « Bon marché »),
  `src/data/career/events.js` (`RANDOM_EVENT_RULES.chanceWithVariety = 0.1`).
- **Atelier d'abord** (§ 16.2.4 du game design) : une récolte qu'un atelier **allumé avec une place libre** transforme
  part à l'atelier, même si une commande ou une caisse l'attend (le contrat disait « comptée avant `tryProcessHarvest` »).
  `query.plot(i).claim` vaut alors `null` et `orderInfo.note` = « L'atelier passe d'abord ». Sinon, ordre du contrat.
- **Point d'accroche `harvest`** : le résultat `{ divert, sell, label }` porte aussi `claimed` (copié dans `harvested`) et
  `after()`, appelé par `runtime.js` **après** l'événement `harvested` (ordre : `harvested`, puis `orderProgress` /
  `cartProgress`, `orderDone`, `crateFull`). Les géants (niveaux et carrière) comptent 4 unités, à la main seulement.
- **Requêtes (champs ajoutés)** : place vide de `query.orders()` : `{ empty, text, delivered?, clientId?, clientName? }`
  (coche du jour) ; `orderInfo.day` ; `cartInfo.base` ; `query.cards()` : `pending` (cartes « prochaine fois ») et, pour
  chaque carte en cours, `season` et `current` (effet actif maintenant) ; `query.challenges().next.kept` ;
  `merchantInfo.daysUntil` et, pour un sachet, `cropId` et `seeds` ; `query.variety()` : `freeSows`, `theme`.
  `query.career.charges().season` et `finance().nextBill` : `reduced` (ristourne).
- **État (champs ajoutés)** : `variety.board.done` (livraisons du jour, vidé à l'aube), `variety.fertilizer` (engrais du
  colporteur des niveaux : `{ left, growth }`), `variety.yearBase` (carrière : compteurs au dernier bilan),
  `variety.challenges.next.kept`, `variety.season.medals` ; carte « almanach » : `{ id: 'almanac', season: null, until }`.
  `state.career.theme` : `dairyPlace` et `rod` (cadeaux de l'année) quand ils existent.
- **Événements (ajouts)** : `themeShower { plots, text }` (averse de l'année des grenouilles) ; `purchased` avec
  `gift: true` (ruche, poules offertes) ou `used: true` (poulailler, ruche d'occasion) ; `orderRemoved.clientId` et
  `text` (retrait de saison) ; `billPaid.reduced` ; `cartDeparted.horse` ; `merchantLeft.text`. Carrière : l'ordre du soir
  est `cartDeparted`, `challengesJudged`, `cardsOffered`, `challengesOffered`, puis `billPaid` (tout se passe dans
  `evening`, avant les charges de saison) ; niveaux : ordre du contrat.
- **Le choix d'une carte se fait après l'aube** de la nouvelle saison (la fenêtre de fin de saison s'ouvre quand le jour
  suivant a commencé) : une carte « saison » vaut donc pour la saison en cours ; « Un cheval de renfort » double la
  charrette **déjà arrivée** (sinon la prochaine) ; la bourse vaut 12 + 4 × saisons jouées (niveaux).
- **Carrière** : la carte `hen` donne deux poules tout de suite (`kind: 'now'`, pas de revenu `cardHen`) ;
  `dawn.varietyWatered` est rempli par `runtime.js` (après le point d'accroche `water`) ; aucun événement au hasard le jour
  de la fête du thème ; « Plus tard » sur le visiteur du thème = `declineOffer` (il repart sans cadeau) — l'interface peut
  aussi simplement fermer la fiche (l'offre attend jusqu'à la fin de la saison). La pêche (canne de Firmin) est × 1,5.
- **Générateur** : « se sème aujourd'hui » = hors serre (saison du jour) ; une charrette n'a que des caisses de cultures
  différentes (moins de caisses s'il y a moins de cultures faisables) ; caisse ou commande de fruits : au plus 2 paniers
  par arbre adulte. Défi « Aux petits soins » : pas les arbres ; défi « Bon marché » : ventes de récoltes **et** du
  grenier (carrière).
- **Réglages après simulation** (`src/data/variety.js` et `src/data/career/themes.js` font foi ; tableau complet :
  game design § 16.10.1) : taux des commandes × 1,05 (poids 6), × 1,1 (3), × 1,15 (1) ; plafond de taille
  ⌊parcelles / 2⌋ ; charrette 5 % + 5 % ; cartes : bourse 12 + 4 × saison (carrière 20 + 10 × rang), engrais + 8 %, poule
  3 pièces, arrosoir magique 3 parcelles (carrière 4), affiche + 4 %, recette et foin + 10 %, sachet 3 graines (carrière 6),
  défrichage de carrière − 25 % (`CARD_VALUES.clearing.careerFactor` ; le champ d'état garde son nom `clearingHalf`) ;
  défis plus exigeants (voir `CHALLENGES`) ; médailles de carrière `careerCoins` 4 / 8 × rang (`MEDALS`) ; sachets de
  graines rares de carrière : 8 semis ; averse de l'année des grenouilles : 15 %. Seuils d'étoiles Détente recalculés
  (`src/data/difficulty.js`, § 13.3).
- **Simulation** : `tools/simulate.js --variety …`, `--compare-variety`, `--stars` (seuils suggérés) ; les décisions des
  joueurs simulés sont exportées (`varietyChoices`, `varietyDay`, `sowRare`) et réutilisées par
  `tools/simulate-career.js` (`--variety …`, `--compare-variety`).

## Lot 3 — rendu et interface (UI/RENDER, 2026-10-02)

Code contre le contrat ci-dessus (« Lot 3 — contrats »). Tout est gardé par `state.variety` : en Classique (clé
absente) rien n'est dessiné, aucune ligne « À faire », aucune section, aucun badge. Un sprite du lot 3 absent → repli
dessiné (canvas) ou icône de la planche de l'interface (`spriteAny`). Mouvements réduits respectés partout.
Styles : **`css/variety.css`** (ajoutée à `CSS_FILES`). Tests : `tests/lot3-render.test.js`.

```
src/ui/variety.js          createVariety(app) → app.variety : onEvent, frame, reset, openBoard, openCart, openMerchant,
                           openCards, openChallenges, openTheme, onHit(hit), seasonPages(ev), seasonSummary(ev),
                           todoItems(game), statsSection(game), agendaSections(ui), yearLines(report), pendingChoice(game),
                           plotRows(plot), seedChips(crop), enabled(game), debugState()
src/render/variety-actors.js  varietySpots(layout) (pur) ; createVarietyActors(effects) : sync, onEvent, update,
                           collect(push) (objets triés par profondeur avec la scène), hitTest(wx, wy, slop), clear, shift
src/render/scene.js        acteurs du lot 3 dans les deux modes ; layout.variety posé à la première synchronisation ;
                           hitTest + { type: 'villageBoard' | 'cart' | 'merchant' | 'themeVisitor', offerId } ;
                           scene.varietySpots(), scene.varietyStats() ; images de repli (entrée e.img : alpha, miroir)
src/main.js                app.variety ; onGameEvent → app.variety.onEvent ; planche « lot3 » facultative au chargement
                           (OPTIONAL_SHEETS : le jeu démarre sans elle) ; __debug.variety (alias __debug.lot3)
```

- **Scène** : panneau du village (2 × 2 tuiles) au bord du chemin sous le portail du champ (portrait et paysage : à
  droite du portail, sinon à gauche ; la ligne du haut peut chevaucher la clôture ; jamais sur une parcelle, un chemin,
  un bâtiment ni un emplacement de décor — vérifié pour les 12 niveaux et la carrière) ; carrière : bande de la maison,
  à droite du chemin du champ de départ. 0 à 3 feuilles (`board.note`, `.kept`, `.done` le jour de la livraison, d'après
  `query.orders()` et `slot.delivered`), petit saut de la feuille sur `orderProgress` / `orderDone` (+ étincelles,
  « +N »). Charrette garée sur la route à droite (l'âne regarde à droite : elle arrive par la gauche en ~2 s, repart à
  droite), caisses devant elle (`crate.empty`, `crate.<culture>` quand pleine, étincelles sur `crateFull`). Roulotte de
  Basile sur la route à gauche (`merchant.wagon.1` auvent ouvert une fois garée), Basile debout à côté. Visiteur unique
  du thème (carrière) près du panneau tant que son offre est ouverte (toucher → sa fiche) ; stand `fair.theme.<id>` le
  jour de la fête du thème ; poule voyageuse (carte `hen`, sprite `animal.chicken`) dans la cour ; gouttes sur les
  parcelles arrosées par l'arrosoir (`dawn.varietyWatered`). Textes flottants « → Lili » / « → charrette » au-dessus
  de la parcelle récoltée. Mouvements réduits : fondus, aucun trajet, la poule ne marche pas. Toucher : en plein d'abord,
  la tolérance du doigt (≥ 48 px) seulement après les parcelles et les bâtiments.
- **Feuilles** (pause pendant la lecture, contenus « vivants » reconstruits seulement si la requête a changé) :
  « Le tableau du village » (3 cartes ≥ 96 px : portrait 48 px, prénom et métier, phrase, lignes « 2 / 5 carottes » avec
  barre lue, prime « +19 », « Garder » (punaise, `aria-pressed`), « ✕ » 48 × 48 lu « Pas pour moi », « Livrer depuis le
  grenier (3) » en carrière ; carte « merci » d'une commande livrée ; « ↻ Autres demandes (gratuit) » / « … : demain ») ;
  « La charrette du marché » (une rangée par caisse, « Charger (2) » en carrière, primes au départ) ; « Basile le
  colporteur » (tuiles ≥ 72 px, confirmation au-delà de la moitié de l'argent, « Vendu ») ; « Un cadeau pour la saison »
  (2 grandes cartes, effets en cours) ; « Les défis de … » (cartes ≥ 72 px, 3 pastilles de médaille, « Garder ») ;
  thème de l'année (carrière).
- **Fin de saison** : niveaux — `dialogs.seasonEnd` affiche la ligne de la charrette et les médailles de la saison,
  puis enchaîne (fenêtre remplacée, `replace`) les pages `app.variety.seasonPages()` : « Un cadeau pour la saison » puis
  « Les défis de … », chacune avec « Plus tard » (le choix attend : pastille sur l'onglet Bilan, ligne « À faire »
  discrète). Victoire : même résumé. Carrière (pas de fenêtre de fin de saison) : fenêtre courte « Fin de … » ouverte par
  `app.variety.frame()` après `cardsOffered` / `challengesOffered`, quand aucune autre fenêtre n'est ouverte.
- **Ailleurs** : section « Le village » en tête du Bilan (niveaux) et de l'Agenda du Carnet (carrière) : thème,
  cadeau en attente, tableau, charrette, défis, colporteur, effets en cours, graines rares ; « À faire maintenant » :
  la commande la plus avancée (« Lili attend 2 carottes »), livraison / chargement depuis le grenier, charrette,
  Basile (veille et jours de passage), cadeau et défis à choisir (priorités basses : jamais de relance insistante) ;
  résumé du matin : nouvelles commandes, charrette arrivée, Basile (veille, arrivée), arrosoir ; feuille des graines :
  « Rare · 4 graines », « Offert », « Commande » ; fiche de parcelle : « À la récolte : → Lili (3 / 5) » ; barre du
  haut : « −20 % » sur le fermage réduit (`nextBill.reduced`) ; bilans : postes « Surprises » et « Le village ».
  Bilan annuel de la carrière : compteurs du village et « L'an prochain : … ! ».
- **Récompenses** : `cartDeparted.ecus`, `challengeMedal.ecus` → `progression.careerEcus` ; `merchantBought.cosmeticId`,
  `cardPicked.gift`, `offerResolved.gift` (thème) → `unlockCosmetic` (ou `ecusIfOwned`). `DECOR_SPRITES` : les trois
  décors du lot ; `decor.js` dit où les trouver.
- **Sons** (synth existant) : `chime` commande livrée, `fanfare` charrette pleine et médaille d'or, `pop` caisse pleine,
  `reveal` carte gardée, `magic` Basile ; bruit de papier (`page`) quand une récolte part à une commande.
- **Débogage** (`?debug=1`) : `__debug.variety` (= `__debug.lot3`) `.{ on(), state(), trigger(kind, arg), board(), cart(),
  merchant(), cards(), challenges(), theme(id), medal(id, n), fill(slot), open(kind), seasonEnd(), point(kind), ui(),
  stats() }` — `trigger` et ses raccourcis passent par `actions.triggerVariety` du cœur ; `fill(slot)` remplit une
  commande par de vraies récoltes à la main.

### Corrections après la QA (2026-10-02)

- **Défis** (`src/core/variety.js`) : `challengePossible` = condition du défi **et** `challengeTargets(...) !== null` ;
  `challengeTargets` rend des paliers strictement croissants, ou `null` quand un plafond (`challengeCap` : cultures
  récoltables / semables de la saison, nombre de caisses) les écraserait ; `minTarget` (données) : bronze minimal
  (2 pour « Potager varié » et « Semeur curieux »). Règle : game design § 16.5.
- **Gardée d'office** : `autoKeepOrders(host, cropId, plotIndex)` appelé par `plant` (niveaux) et `runtime.plant`
  (carrière, `by === 'player'` seulement) ; événement `orderKept`.
- **Messages** : deux au plus, pastille « +N », boutons d'action seuls touchables (voir « Messages (`toasts.js`) »).
- **Visiteur du thème** : `varietySpots().visitor` à **gauche** du panneau (le stand de fête recule d'une tuile) ; ligne
  « À faire » « Un visiteur vous attend : … » qui amène la vue sur lui (`scene.focusWorld`) et l'entoure ;
  `app.worldPageRect(r)` (main.js).

### Intégration CORE ↔ UI/RENDER (2026-10-02)

- `triggerVariety('medal', { challengeId, medal })` (débogage, cœur) : défi proposé de la saison en cours, gardé s'il
  reste une place, compteurs amenés au palier `medal` (1 à 3), puis `checkMedals` (récompense, statistiques,
  `challengeMedal`). Refus : `'Pas de défis cette saison.'`, `'Ce défi n'est pas proposé.'`, `'Deux défis au plus.'`.
  C'est le chemin de `__debug.variety.medal(id, n)`.
- Textes des défis : `{s}` = marque du pluriel selon `{n}` (« Remplir 1 caisse », « Remplir 2 caisses »).
- `harvested` : avec `claimed` (lot 3), `src/render/effects.js` montre les pièces (récolte vendue) et laisse l'étiquette
  « → Lili » / « → charrette » à `variety-actors.js` (une par destination toutes les 0,9 s) ; sans `claimed`,
  `diverted` (texte du cœur, « → Joseph ») est affiché tel quel.
- Interface : `themeShower` → résumé du matin, gouttes sur `plots` ; `purchased.gift` / `used` → « offerte » /
  « d'occasion » ; la roulotte, la charrette et le visiteur du thème se touchent dès leur apparition (aussi pendant
  leur trajet) ; fenêtre courte de la carrière titrée d'après la saison qui se termine (connue le soir).
- Débogage : `__debug.variety.point('visitor')` (visiteur du thème).

## Lot 4 — contrats (CORE · ART · UI/RENDER, conception 2026-10-03)

Album de la ferme (D1), lanternes de fin d'année (D3), « aider sans remplacer » en carrière (F1), fêtes participatives
(C6), hiver vivant (C8). Règles chiffrées et contenus (cases, anecdotes, histoires, barèmes) : `docs/GAME_DESIGN.md`
§ 17. Ce qui suit fixe les **noms, formes et comportements** que les trois paquets se promettent ; tout est **ajouté**
(rien du contrat existant n'est retiré ni renommé, sauf les quelques chiffres de carrière listés au § « Données »). Tant
que CORE n'a pas livré, UI/RENDER simulent les requêtes avec des objets factices de la même forme ; tant qu'ART n'a pas
livré, RENDER/UI dessinent un repli (`canDraw`, `spriteAny`, comme aux lots 2 et 3).

### Règles communes

- **Parité Classique** : `createGame` en Classique sans option `cozy` ne crée **ni** `state.cozy` (clé absente), **ni**
  flux aléatoire, **ni** événement, **ni** champ de requête nouveau — **sauf** `query.achievementContext().weather`
  (lecture de `state.weather.today`, sans effet ; sert à l'album). `tests/parity.test.js` et `tools/capture-parity.js`
  inchangés et verts. Toute règle du lot est gardée par `state.cozy` (et `state.cozy.parts.<partie>`).
- **L'album n'est pas dans l'état de la partie** : il vit dans la progression (`progress.album`), calculé par
  `src/core/album.js` à partir du contexte de la partie (`query.achievementContext()`, `query.summary()`,
  `query.career.yearReport()`) et de la progression. Il se remplit donc aussi en Classique sans toucher à la partie.
- **Aléatoire** : un flux **nouveau**, `state.rng.cozy` (`hashSeed(seed, 'cozy')`), créé seulement quand le lot est actif :
  cachettes et objet doré de la chasse (9 nombres par chasse), trouvaille d'hiver (5 nombres à **chaque** aube d'hiver,
  qu'il y ait de la place ou non), oiseau de la mangeoire (1 nombre à chaque aube qui suit un remplissage), villageois des
  paniers (3 nombres). Météo, marché, maladie, `career`, `staff`, `events`, `quality`, `surprise`, `sky`, `orders`,
  `variety` tirent **le même nombre** de nombres qu'avant. Les règles F1 ne tirent rien.
- **Pur** : `src/data/{album,cozy}.js`, `src/core/{album,lanterns,cozy}.js`, `src/core/career/{cozy,handwork}.js`
  n'importent ni DOM ni horloge (`now` passé en argument dans la progression, comme `unlockAchievements`).
- **Jour absolu** : `absDay(state)` de `src/core/surprises.js` ; **produit cette année** : compteurs `state.cozy.year`
  (niveaux : depuis le début de la partie ; carrière : depuis le dernier bilan annuel).
- Actions : `{ ok: true, … }` ou `{ ok: false, reason }` (texte français). Identifiants en anglais, textes en français.

### Fichiers

```
src/data/album.js           (nouveau, pur) ALBUM_VERSION, ALBUM_PAGES (11 pages, 124 cases : id, name, icon, mode
                            'all' | 'dc' | 'career', hint, text, stamps, check), ALBUM_EXTRA_REWARDS (page dorée, page des
                            géants, page des grandes années), ALBUM_COMPLETE_REWARD, STORIES (12 : id, title, lines[3]),
                            RESERVED_PAGE_IDS = ['heirlooms', 'wildlife'] (lot 5), textes
src/data/cozy.js            (nouveau, pur) COZY_VERSION, COZY_PARTS, LANTERN_CRITERIA (5 : id, name, color, icon),
                            LANTERN_RULES { levels, career } (mesures, points, paliers), LANTERN_REWARDS,
                            FETES (calendrier niveaux / carrière : id, engine, seasonId, day | 'last', rank, levels, career,
                            name, texts), FETE_ENGINES (chasse : count 8 ; marmite : max 3 ; etal : slots 5 ; paniers : 3 × 2),
                            FETE_REWARDS (niveaux ; carrière × careerFactor(rang) = 1 + 0,5 × (rang − 1)), SOUP_CROPS,
                            STAND_POINTS, RIBBONS, BASKET_LIKES (produit aimé de chaque client), THEME_FETE_GAMES (9),
                            SEED_FAIR (pack 8, discount 0,25, perCrop 4, max 20), WINTER_FINDS, TRACES (chance 0,4),
                            BIRDS (8 : poids, minFills), FEEDER, STORY (day 3, ecus 1), F1 { handBonus 1.25,
                            machineDelay 2, staffDelay 4, weedFine 0.01, weedGold 0.003, migrateRipeBack 4 }, COZY_HINTS
src/data/achievements.js    + COZY_ACHIEVEMENTS (12, category 'cozy', écus seulement) ; ALL_ACHIEVEMENTS les inclut
src/data/cosmetics.js       + 21 décors `found: true`, price 0 : 15 de l'album (scarecrow.flower, can.golden, barrow.giant,
                            jam.shelf, weathervane.pig, sundial, lantern.fairy, pump.village, bunting.post, arch.fete,
                            woodpile, heron.wood, rocking.chair : 'small' ; herbarium : 'large') et 6 des lanternes
                            (lantern.green, lantern.blue, lantern.pink, lantern.yellow, lantern.orange : 'small' ;
                            lantern.grand : 'large')
src/data/career/career.js   HAND_BONUS 1.1 → 1.25 (lu aussi par F1.handBonus : une seule source, career.js fait foi)
src/data/career/lots.js     greenhouse : rank 3 → 2, cost 800 → 500, sans `phase` ; pond : rank 4 → 3, cost 400 → 300, sans `phase`
src/data/career/buildings.js, animals.js   duckPond et duck : rang 4 → 3
src/data/career/events.js   CALENDAR_EVENTS : `seedFair` passe au **dernier jour de l'hiver** (`seasonId: 'winter',
                            day: 'last'`, plus de `seedFactor` : c'est la foire du lot 4) ; nouvelle entrée `springFete`
                            (printemps, jour 3, rang 1, sans facteur) ; `christmasMarket` : rang 2 → 1 (facteurs gardés au rang 2)
src/data/career/staff.js, machines.js, descriptions.js   textes du jardinier, de la moissonneuse, de la cueilleuse, de la serre
src/data/difficulty.js      seuils d'étoiles Détente recalculés après simulation (§ 13.3)
src/core/album.js           (nouveau, pur, côté progression) faits, vérification, pages, récompenses, rattrapage
src/core/lanterns.js        (nouveau, pur) lanternsFor(facts, mode, level?) → valeurs des 5 critères
src/core/cozy.js            (nouveau, partagé niveaux / carrière) état, activation, migration, vérification ; aube et soir ;
                            moteurs des fêtes ; hiver ; compteurs de l'année ; faits des lanternes ; requêtes
src/core/career/handwork.js (nouveau, pur, sans enregistrement) F1 : ripeAt, helpersMayHarvest, désherbage, prime
src/core/career/cozy.js     (nouveau) extension de carrière id 'cozy' (points d'accroche ci-dessous), enregistrée en
                            DERNIER par extensions.js (après variety)
src/core/career/extensions.js  + l'enregistrement de cozyExtension (après varietyExtension)
tests/album.test.js, tests/lanterns.test.js, tests/cozy.test.js, tests/cozy-career.test.js, tests/f1.test.js,
tests/cozy-migration.test.js  (nouveaux)
assets/sprites/generate-lot4.py → assets/sprites/lot4.png + bloc « // <lot4:auto> » d'atlas.js  (ART)
src/ui/album.js, src/ui/cozy.js, css/cozy.css  (UI ; css/cozy.css ajoutée à CSS_FILES de tools/build.js)
src/render/cozy-actors.js   (RENDER : objets cachés, trouvailles d'hiver, traces, mangeoire et oiseau, porte-lanternes,
                            fenêtre de la veillée, stands des fêtes, maire et Lili)
```

Modifiés (CORE) : `src/core/{game,stats,progression,surprises,variety}.js`, `src/storage.js`,
`src/core/career/{runtime,work,machines,events,save,land}.js`, `tools/{simulate,simulate-career,sim-career-staff}.js`,
`tests/career-helpers.js` (carrières de test créées avec `cozy: false` par défaut, comme `surprises` et `variety`).

### Activation et options

```js
createGame({ levelId, seed, perks, difficulty, surprises, variety, cozy })
//   cozy : undefined → activé si difficulty !== 'classique' (clé ABSENTE en Classique)
//          true → toutes les parties ; false → state.cozy = null (gardé tel quel à la reprise)
//          { lanterns, fetes, winter, decor } → parties à true (absentes = true) ;
//          decor = { placed: n, path: bool, fence: bool } : résumé du décor de la progression AU LANCEMENT
//          (critère « beauté » des niveaux ; copié dans state.cozy.decor comme les bonus permanents)
createCareer({ …, cozy })   // défaut true ; même forme + partie helpers (F1) ; le décor est lu dans state.career.cosmetics
game.cozy                   // booléen (accesseur, comme game.surprises / game.variety)
```

`COZY_PARTS = ['lanterns', 'fetes', 'winter', 'helpers']` (`helpers` : carrière seulement).

### État (`state.cozy`, `null` ou absent quand c'est désactivé)

```js
state.cozy = {
  v: 1,
  parts: { lanterns: true, fetes: true, winter: true, helpers: true },
  decor: { placed: 0, path: false, fence: false },     // niveaux : copie au lancement ; carrière : non utilisé
  year: {                                   // compteurs de l'année (lanternes, fêtes)
    since: 1,                               // jour absolu du début du comptage
    partial: false,                         // l'année a commencé avant le lot 4 (migration)
    harvests: 0, hand: 0, cared: 0, handBonus: 0,       // carrière : hand = à la main ; niveaux : hand = harvests
    produced: { crops: {}, products: {}, animal: {} },  // id → n : « ce que la ferme a produit cette année »
    fine: {}, gold: {}, giants: {},                     // cropId → n (badges de qualité des fêtes)
    fetes: {},                              // feteId → { engine, score, ribbon?, ladles?, eggs?, hearts?, day }
    hearts: 0, story: false, feederDays: 0, birds: {}, finds: 0,
    quests: 0, visitor: false, patrimonyStart: 0,       // carrière
    animalCollected: 0,                     // carrière : valeur ramassée (abris) ; la perte est work.year.lostAnimals
  },
  fete: null | {                            // fête du jour (null hors fête)
    id, engine: 'chasse' | 'marmite' | 'etal' | 'paniers' | 'foire', themeId: null | themeId, day,
    hidden: null | [{ u /* 0..1, cachette */, gold: bool, found: null | 'player' | 'village' }],   // chasse (8)
    villagers: null | [clientId, clientId, clientId],   // paniers
    done: false, result: null | { score, ribbon?, ladles?, hearts?, amount, ecus, items },
  },
  stand: null | { year, ribbon, score },    // carrière : stand de la fête des récoltes, gardé pour le comice
  winter: {
    finds: [{ id, kind, u, day }],          // 3 au plus
    traces: [{ kind, u, day }],             // traces du jour (jour de neige)
    feeder: { filledDay: 0, bird: null | { id, day } },
    storyDay: 0,                            // jour absolu où la veillée devient possible (0 : pas cet hiver)
    nextId: 1,
  },
  seedBank: {},                             // carrière : cropId → semis prépayés (foire aux graines)
  lanterns: null | { history: [{ year, values: [5], total, partial }] },   // carrière : 10 dernières années
  stats: {                                  // cumul de la partie (niveaux) ou de la carrière : album, succès
    eggs: 0, eggsGold: 0, eggsAll: 0, fetes: {}, ribbons: { green: 0, blue: 0, gold: 0 }, ladles3: 0, hearts: 0,
    finds: {}, traces: {}, birds: {}, fish: {}, seedPacks: 0, handPicked: 0, handBonus: 0, weeded: 0,
    themesPlayed: {},                       // themeId → fêtes de thème jouées (tampon 🎪 de l'album)
  },                                        // (les histoires de Joseph se comptent dans la progression : progress.album.stories)
}
// Carrière, parcelles (seulement avec parts.helpers) : ripeAt (jour absolu de la maturité, sur une parcelle mûre ;
// effacé quand elle ne l'est plus) ; weeded: true (culture en pousse désherbée ; effacé par clearPlot).
```

`checkCozy(state) → null | 'problème'` (appelé par `checkState` des niveaux et par `check` de l'extension) : version,
identifiants connus (fêtes, moteurs, trouvailles, oiseaux, clients, cultures, produits), entiers ≥ 0, `0 ≤ u < 1`,
8 objets cachés au plus, 3 trouvailles au plus, 3 villageois, `seedBank` entiers ≥ 0, `ripeAt` ≤ jour absolu.

### Déroulé (niveaux : `src/core/game.js` ; carrière : extension `cozy` + `runtime.js`)

**Aube** (niveaux), après les étapes du lot 3 (`varietyDawn`) : `cozyDawn(host, { newSeason }) → events` :
1. nouvelle saison d'hiver : mangeoire posée, `winter.storyDay` = jour absolu du 3ᵉ jour d'hiver ; fin de l'hiver (niveaux :
   sans objet ; carrière : printemps) : trouvailles et traces effacées ;
2. **fêtes** : veille d'une fête du calendrier → `feteSoon` ; jour d'une fête → `state.cozy.fete` créée (chasse : 9 tirages
   `cozy`), `feteStarted` ;
3. **hiver** (parts.winter, saison d'hiver) : 5 tirages `cozy` ; une trouvaille ajoutée s'il y a moins de 3 trouvailles ;
   un jour de neige, une trace avec 40 % ; `winterFind` ; si la mangeoire a été remplie la veille : 1 tirage, oiseau du
   jour, `feederBird` ; au 3ᵉ jour d'hiver : `storyReady`.
Les événements du lot sont émis après ceux du lot 3.

**Soir** (niveaux), dans `endOfDay`, avant la charrette et le fermage : jour de fête → objets cachés non trouvés
« trouvés par le village » (pièces versées), `feteEnded` ; `state.cozy.fete = null` à l'aube suivante. **Dernier soir de
l'année** : après `billPaid` et `challengesJudged`, **avant** `victory` : `lanternsLit` (valeurs dans
`state.result.lanterns` et `summary.cozy.lanterns`). Faillite (Détente, rare) : `lanternsLit` avant `bankrupt` aussi.

**Pendant la journée** : récolte (compteurs `year.harvests`, `hand`, `cared`, `produced`, `fine`/`gold`/`giants`) ; produits
vendus et revenus des animaux (`produced.products` / `produced.animal` : niveaux : `eggs` si un poulailler a rapporté,
`milk` si une vache ou une chèvre, `wool` à la tonte) ; actions des fêtes et de l'hiver.

**Carrière** (extension `cozy`, enregistrée après `variety`) :
- `seasonStart` → point 1 ; `springFete` / fêtes du calendrier et du thème (lues dans `CALENDAR_EVENTS` et le thème du
  lot 3) → point 2 ; `dawnEvents` → point 3 ;
- `dawn` (fin de l'aube) → **F1** : `ripeAt` posé sur chaque parcelle qui vient de mûrir (`handwork.markRipe(state)`),
  effacé sur les autres ;
- `evening` → fin de fête (`feteEnded`) ; **dernier jour de l'automne** : le comice (extension `events`) lit
  `state.cozy.stand` (bonus + 25 % / + 50 % d'un prix d'épreuve) ;
- `yearEnd` → lanternes de l'année (`lanternsFor(cozyFacts(state), 'career')`), `report.cozy = { lanterns, fetes,
  winter, handPicked, handBonus }`, `lanternsLit` (avant l'événement `yearEnd`), historique, compteurs remis à zéro,
  `year.patrimonyStart` = patrimoine du bilan.
- Ordre du dernier soir d'hiver (carrière) : `feteEnded` (foire), lot 3 (charrette, défis, cartes), charges, puis le bilan
  (`lanternsLit`, `yearEnd`).

### F1 — aider sans remplacer (carrière, `src/core/career/handwork.js`)

```js
markRipe(state)                              // aube : ripeAt = absDay pour toute parcelle mûre qui n'en a pas ; efface sinon
helpersMayHarvest(state, i, who)             // who : 'machine' | 'staff' → bool
//   true si : pas de parts.helpers (ancien comportement) ; ou absDay − ripeAt ≥ F1.machineDelay (3) / F1.staffDelay (4) ;
//   ou dernier jour de l'automne et la culture gèlerait demain (hors serre) ; le géant garde la règle du lot 2
//   (giantOpenToHelpers, 3 aubes) et n'est pas concerné par ripeAt.
weedable(state, i) / weed(api, i, staff)     // culture en pousse, pas un arbre, pas encore désherbée → weeded = true
weedQualityBonus(plot) → { fine: 0.01, gold: 0.003 } | null   // lu par rollQuality (src/core/surprises.js), à la main seulement
```

- `src/core/career/machines.js` (`eligible`, `harvest` et `pick`) et `src/core/career/work.js` (`gardenAction`,
  `harvest`) appellent `helpersMayHarvest`. Ordre des passes du jardinier : `['chase', 'water', 'weed', 'sow',
  'harvest']` ; tâche `weed` (même durée qu'une action, 1 XP, événement `weeded { plotIndex, by }`, `taskDone { kind:
  'weed' }`).
- `runtime.js` : `HAND_BONUS` (1,25) ; `harvested` gagne `handBonus` (pièces de la prime à la main, comprises dans
  `amount`) et `waited` (aubes depuis la maturité) ; compteurs `cozy.year.hand`, `handBonus`, `cozy.stats.handPicked`.
- Comice (`src/core/career/events.js`) : les épreuves `harvest` / `harvests` ne comptent que les récoltes `by ===
  'player'` quand `state.cozy?.parts.helpers` ; prix : + 25 % (ruban bleu) / + 50 % (rosette d'or) d'un prix d'épreuve si
  `state.cozy.stand.year` = année du comice ; `contestAwarded` gagne `standBonus`.
- Migration : à `migrate`, parcelles déjà mûres → `ripeAt = absDay − F1.migrateRipeBack` (4).

### Actions (`game.actions.*`, les deux modes, seulement quand c'est activé)

```js
feteFind(index)               → { ok, index, gold, amount, found /* par le joueur */, total }      // chasse (œufs, lampions…)
    // refus : 'Pas de chasse aujourd'hui.' ; 'Objet inconnu.' ; 'Déjà trouvé !'
cookSoup(items)               → { ok, ladles, amount, ecus, text }        // items : [{ kind: 'crop', id }] × 1..3
    // refus : 'Pas de soupe aujourd'hui.' ; 'Déjà goûtée : merci !' ; 'De 1 à 3 légumes différents.' ;
    //         '{Nom} : pas récolté cette année.' ; '{Nom} : pas dans cette soupe.'
presentStand(items)           → { ok, score, ribbon: 'green' | 'blue' | 'gold', amount, ecus, detail: [{ item, points }] }
    // items : [{ kind: 'crop' | 'product' | 'animal', id }] × 1..5 (6 au Grand marché), tous différents
    // refus : 'Pas de stand aujourd'hui.' ; 'Déjà présenté : bravo !' ; 'De 1 à 5 produits différents.' ;
    //         '{Nom} : pas produit cette année.'
giveBaskets(baskets)          → { ok, hearts, perBasket: [n, n, n], amount, ecus }   // [[item, item?] × 3]
    // refus : 'Pas de paniers aujourd'hui.' ; 'Déjà offerts : merci !' ; 'Un produit au moins dans chaque panier.' ;
    //         'Un même produit une seule fois.' ; '{Nom} : pas produit cette année.'
buySeedPack(cropId)           → { ok, cropId, seeds, cost, bank }        // CARRIÈRE, foire aux graines
    // refus : 'La foire aux graines n'est pas aujourd'hui.' ; 'Ce sachet n'est pas proposé.' ;
    //         '4 sachets au plus par culture.' ; '20 sachets au plus.' ; notEnoughMoney(n)
pickWinterFind(findId)        → { ok, kind, name, amount }               // refus : 'Rien à ramasser ici.'
fillFeeder()                  → { ok }                                    // refus : 'La mangeoire sort en hiver.' ; 'Déjà remplie aujourd'hui.'
hearStory()                   → { ok }                                    // refus : 'Pas de veillée en ce moment.' ; 'Déjà écoutée cet hiver.'
triggerCozy(kind, arg?)       → { ok, … }   // DÉBOGAGE / tests : 'fete' (id), 'winter', 'bird' (id), 'trace' (kind),
                                            //   'story', 'lanterns', 'ripe' (carrière : ripeAt reculé de arg aubes)
// Modifiées :
plant(i, cropId)   // carrière : la réserve de graines d'abord (coût 0) → planted + { fromBank: true, bankLeft }
harvest(i)         // carrière : + handBonus, waited
```

Les récompenses en **pièces** sont versées par le cœur (niveaux : statistique `cozyIncome`, année et saison, créée
seulement quand il y en a, comptée dans `summary.net` ; carrière : poste `fetes` du bilan, et `other` pour l'hiver) ; les
**écus** et l'histoire sont versés par l'interface via la progression (comme les médailles du lot 3).

### Requêtes

```js
query.cozy() → null | { enabled: true, parts, fete: query.fete(), upcoming: [{ id, name, engine, seasonId, day, daysUntil, text }],
  winter: query.winter(), lanterns: query.lanterns(), seedBank: [{ cropId, name, icon, n }], stats }
query.fete() → null | feteInfo
  feteInfo = { id, name, engine, themeId, icon /* 'icon.fete' ou 'icon.theme.<id>' */, text, rules: [texte], day, done, result,
    hidden: null | { kind: 'egg' | 'lampion' | 'frog' | 'lantern', items: [{ index, u, gold, found }], foundByPlayer, total },
    choices: null | [itemInfo],       // marmite, etal, paniers : ce que la ferme a produit cette année (filtré par le moteur)
    max: null | n,                    // 3 (marmite), 5 ou 6 (etal), 2 par panier
    villagers: null | [{ clientId, name, portrait /* 'portrait.client.<id>' */, likes: [{ kind, id, icon }] }],
    stalls: null | [{ id, name, packs: [{ cropId, name, icon, seeds, price, bought, canBuy, reason }] }] }   // foire
  itemInfo = { kind: 'crop' | 'product' | 'animal', id, name, icon, quality: 'normal' | 'fine' | 'gold', giant, star, homemade }
query.fetePreview(items) → { score?, ladles?, ribbon?, hearts?, amount }   // pur : aperçu en direct avant de valider
query.winter() → null | { finds: [{ id, kind, name, icon, u }], traces: [{ kind, name, icon, u }],
  feeder: { here, canFill, filledToday, bird: null | { id, name, icon } }, story: { available, heard } }
query.lanterns() → null | { criteria: [{ id, name, icon, color, measure /* texte court */, value, lit /* 1..4 */,
  next: null | { need, text } }], total, partial }          // l'année en cours (aperçu « Bilan », Carnet)
query.plot(i)            // carrière : + ripeAt, wait: null | { machineIn, staffIn } (aubes avant l'équipe ; 0 = déjà),
                         //   handValue, helperValue, weeded
query.plantableCrops()   // carrière : + bank (semis prépayés)
query.summary()          // + cozy : { year (compteurs), stats, lanterns? }
query.achievementContext()   // + weather (TOUS modes) ; + surprisesStats (state.surprises.stats) ; + cozy (stats, year) ;
                             //   carrière : career + { pets, species: [id], animalProducts: { id: n }, fish: { id: n } }
query.career.yearReport()    // + cozy (voir « Déroulé »)
```

### Événements (seulement quand c'est activé)

| Type | Données | Pour |
|---|---|---|
| `feteSoon` | `{ id, name, engine, day, text }` | veille : bandeau, résumé du matin, conseil `cozy.fete` |
| `feteStarted` | `{ fete: feteInfo, text }` | décor de fête, objets cachés, ligne « À faire » |
| `feteFound` | `{ index, kind, gold, amount, found, total }` | saut de l'objet, confettis, note qui monte |
| `feteDone` | `{ id, engine, score?, ladles?, ribbon?, hearts?, amount, ecus, text }` | pièces vers le compteur, ruban, maire ; écus → progression |
| `feteEnded` | `{ id, helped: { n, amount }, text }` | soir : « Lili a trouvé les 3 derniers œufs pour vous ! » |
| `seedPackBought` | `{ cropId, seeds, cost, bank }` | sachet qui saute dans la boîte |
| `winterFind` | `{ finds: [{ id, kind, u }], trace: null \| { kind, u } }` | aube d'hiver : étincelle en lisière, trace sur la neige |
| `winterPicked` | `{ id, kind, name, amount }` | trouvaille qui saute dans le panier |
| `feederFilled` / `feederBird` | `{}` / `{ bird: { id, name }, first }` | graines qui tombent / oiseau sur la mangeoire |
| `storyReady` / `storyHeard` | `{ text }` / `{}` | fenêtre éclairée ; l'interface choisit l'histoire (progression) |
| `lanternsLit` | `{ year, values: [5], total, criteria: [lanternCriterion], partial }` | page « Les lanternes de l'année » ; porte-lanternes ; progression |
| `weeded` | `{ plotIndex, by }` | touffe arrachée (jardinier) |
| `harvested` | + `handBonus`, `waited` (carrière) | texte flottant « +31 ♥ » (prime en vert) |
| `contestAwarded` | + `standBonus` (carrière) | ligne « Stand du comice : +150 » |

### Progression (`src/core/progression.js` + `src/core/album.js`, purs)

```js
progress.album = { found: { [caseId]: { at, src: 'levels' | 'career' | 'retro' } }, stamps: { [caseId]: [stamp] },
                   claimed: [rewardId], seen: [caseId], stories: 0, retroDone: false }
//   caseId = '<pageId>.<id>' (ex. 'garden.carrot', 'sky.fog') ; stamp : 'gold' | 'giant' | 'fete' | 'visitor' | 'best'
//   rewardId = pageId, 'garden.gold', 'garden.giant', 'years.stamps', 'complete'
progress.lanterns = { levels: { [levelId]: { best: [5], total, at } }, career: { best: [5], total, years }, firsts: [criterionId], grand: false }
progress.lifetime.cozy = { handPicked: 0, eggsAll: 0, ribbonsGold: 0, birds: {}, fetes: 0 }

albumFacts(ctx, progress) → facts                 // contexte de partie (ou null) + progression → faits lisibles par les cases
checkAlbum(progress, ctx) → { cases: [caseId], stamps: [{ caseId, stamp }] }   // nouveautés (rien d'écrit)
recordAlbum(progress, found, now, src) → { progress, cases, stamps }
albumPages(progress, mode?) → [{ id, name, icon, found, total, done, cases: [{ id, caseId, name, icon, found, at, stamps,
  text /* si trouvée */, hint /* sinon */, modeNote, isNew }], rewards: [{ id, ecus, cosmeticId, ready, claimed }] }]
claimAlbumReward(progress, rewardId) → { ok, progress, rewards: { ecus, cosmeticId, already } } | { ok: false, reason }
    // refus : 'Page pas encore complète.' ; 'Déjà reçu.'
markAlbumSeen(progress, caseIds) → progress
albumRetro(progress, { levelSave, careerSave }) → { progress, cases }   // § 17.1.4 ; une seule fois (retroDone)
recordLanterns(progress, { mode, levelId?, values, total, partial }, now)
  → { progress, rewards: { ecus, cosmetics: [id], newBest }, achievements: [id] }
recordStory(progress, now) → { progress, story: { id, title, lines }, first, ecus }
// recordRunEnd : summary.cozy → lifetime.cozy, puis checkAlbum / recordAlbum (src 'levels') ;
// recordCareerYear : report.cozy idem (src 'career') ; checkAchievements évalue aussi les succès 'cozy'.
```

Types de condition des cases (`check.type`, lus dans `facts`) : `cropHarvested`, `cropGold`, `cropGiant`, `productSold`,
`animalProduct`, `animalOwned`, `pet`, `weather`, `specialWeather`, `surprise`, `find`, `forage`, `wish`, `client`,
`merchantMet`, `theme`, `themeFete`, `themeVisitor`, `fete`, `feteBest`, `comice`, `contest`, `cartFull`, `goldMedal`,
`winterFind`, `trace`, `bird`, `fish`, `story`. Le lot 3 ajoute **un compteur** : `variety.stats.merchantVisits` (passages
de Basile, pour `merchantMet`).

`storage.js` : `loadProgress()` normalise (album, lanternes, `lifetime.cozy`) ; au premier chargement sans `album`, il
lit les sauvegardes de la partie de niveau et de la carrière (sans les modifier) et appelle `albumRetro` ;
`albumMigration()` renvoie une seule fois `{ cases: [caseId] }` (message « N cases retrouvées »), sinon `null`.

### Migration et sauvegardes

- **Niveaux** : `STATE_VERSION` reste 2. `migrateState` : `s.cozy === undefined && s.difficulty === 'detente' && s.rng` →
  `newCozyState({ partial: true })` + flux `cozy` ; fête du jour : seulement si l'aube de reprise la crée ; Classique : rien.
  `s.cozy` présent → `completeCozy` (champs ajoutés plus tard).
- **Carrière** : extension `cozy` — `init` (création) et `migrate` (chargement) : `state.cozy` absent → activé (comme les
  surprises et la variété) avec `year.partial = true`, `ripeAt` des parcelles mûres reculé de 4 aubes, réserve vide ;
  `CAREER_VERSION` inchangée (champs ajoutés, vérifiés par `check` et `save.js` pour `ripeAt` / `weeded`).
- **Progression** : pas de changement de `schema` (champs ajoutés par `normalizeProgress`) ; rattrapage une fois.
- Tests : `tests/career-helpers.js` crée ses carrières avec `cozy: false` par défaut ; `tests/cozy-migration.test.js` :
  aller-retours, Détente / Classique / carrière, `checkCozy`, rattrapage de l'album depuis une progression et des
  sauvegardes réelles du lot 3 (fixtures).

### Points d'accroche et fournisseurs de carrière (ajouts, CORE)

- `CALENDAR_EVENTS[].day` accepte `'last'` (dernier jour de la saison, quelle que soit sa durée).
- L'extension `cozy` utilise : `seasonStart`, `dawnEvents`, `dawn`, `evening`, `yearEnd`, `actions`, `queries`,
  `init` / `migrate` / `check` ; fournisseur existant `seedFactor` **non** utilisé (la foire est une boutique).
- Lus directement (gardés par `state.cozy?.parts.helpers`) : `handwork.helpersMayHarvest` dans `machines.js` et
  `work.js` ; `weedQualityBonus` dans `surprises.js` (`rollQuality`) ; `HAND_BONUS` dans `runtime.js`.
- `src/core/career/events.js` : pêche → `state.cozy.stats.fish[fishId]` (album) ; comice → récoltes à la main et
  `standBonus` ; `christmasMarket` dès le rang 1 pour la fête, facteurs de prix au rang 2 comme avant.

### Simulation

- `tools/simulate.js` : `--cozy on | off | lanterns,fetes,winter` (défaut : selon le mode), `--compare-cozy` (sans → avec,
  même graine : revenu, argent final, victoires, ★★★, gains des fêtes et de l'hiver, écus), `--lanterns` (répartition
  1 / 2 / 3 / 4 par critère et total médian, par robot). Robots humains et `optimal` : comportements du § 17.8 du game
  design, par l'API publique et leurs propres tirages ; exporter `cozyDay(game, me, P, spend)` pour la carrière. Robots
  scriptés de la parité (Classique) inchangés.
- `tools/simulate-career.js` : `--cozy …`, `--compare-cozy`, **`--compare-f1`** (tableau : `handsOff` bénéfice des ans 4 à
  7 ; tranquille : revenu par année, rang médian, Domaine, part à la main, gestes par jour ; `automator` : Domaine et
  patrimoine à l'an 10 ; débutant : rang 3 à l'an 5) ; nouvelle stratégie **`handsOff`** (= `idle` avec `idleFrom: 4`) ;
  le tranquille récolte d'abord à la main ce qui est mûr (terrain le plus mûr d'abord) et fait ses achats sans dépenser
  ses gestes de champ ; le débutant suit la ligne « À faire » des champs mûrs. `tools/sim-career-staff.js` : serre au rang
  2 dans la liste d'envies du tranquille, mare au rang 3.
- Après réglage : seuils d'étoiles Détente (`src/data/difficulty.js`, § 13.3), paliers des lanternes (`src/data/cozy.js`),
  tableaux du § 17.8 remplis avec les résultats.

### Ce que RENDER et UI consomment

**RENDER** (`src/render/*`) :
- Disposition : `layout.cozy = { hideSpots: [{ x, y, w, h }] (≥ 16 cachettes : pieds de buissons et d'arbres, coins de
  clôture, arrière des bâtiments, bord de forêt, panneau, puits ; jamais sur une parcelle ni un chemin), edgeSpots: [{ x,
  y }] (≥ 8 en lisière, haies, fossés), traceSpots: [{ x, y }], feeder: rect (cour / bande de la maison), lanternRack:
  rect (perron), storyWindow: rect (fenêtre de la maison), feteStall: rect (près du panneau du village) }`. Absent si le
  lot est désactivé (rien n'est dessiné en Classique, porte-lanternes compris). Carrière : cachettes dans la bande de la maison, le champ de départ et les terrains achetés voisins.
- `cozySpot(u, spots, taken) → index` (pur, exporté, testé) : la cachette d'un objet = `⌊u × spots.length⌋`, puis la
  suivante libre ; même résultat pour un même `layout` (déterministe).
- `scene.hitTest` : + `{ type: 'feteItem', index }`, `{ type: 'winterFind', id }`, `{ type: 'feeder' }`, `{ type:
  'storyWindow' }`, `{ type: 'lanternRack' }` (cibles tolérantes ≥ 48 px ; en **mode fête**, seuls `feteItem` et le
  défilement répondent : `scene.setFeteMode(on)`).
- Scène : objets cachés (`fete.egg.*`, `fete.lampion*`, `fete.frog*`, `fete.lantern*`) qui dépassent de leur cachette et
  se dandinent toutes les ~4 s ; `scene.focusWorld` pour l'indice ; le soir de la chasse, Lili (`npc.lili`) passe
  ramasser les derniers ; stand du jour (`fete.pot`, `fete.stand`, `fete.basket`, `fete.seedstall`) près du panneau ;
  le maire (`npc.mayor`) marche jusqu'au stand sur `feteDone` (étal) ; trouvailles d'hiver en lisière (étincelle),
  traces sur la neige (jusqu'au soir) ; mangeoire (`feeder`, `feeder.full` après remplissage) et oiseau du jour
  (`bird.<id>`, 2 images) ; fenêtre éclairée (`window.lit`) tant que la veillée est possible ; porte-lanternes
  (`lantern.rack` + `lantern.<critère>.on/off`, brillent le soir) : niveaux → meilleur résultat du niveau
  (`scene.setLanterns(values)` appelé par l'UI depuis la progression), carrière → `state.cozy.lanterns.history` (dernière
  année) ; carrière F1 : badge `badge.waiting` sur les parcelles mûres qui attendent, jardinier accroupi + `fx.weeds` sur
  `weeded`. Mouvements réduits : pas de dandinement (étincelle fixe), apparitions en fondu, aucun trajet.
- Nouvelle planche `lot4` dans `SHEETS` et `assets.js` (facultative, comme `lot3`) ; `DECOR_SPRITES` : les 21 décors.

**UI** (`src/ui/*`, `css/cozy.css`, `src/main.js`) :
- `src/ui/album.js` : `createAlbum(app) → app.album = { open(pageId?), onDawn(game), onRunEnd(res), badge(), reset() }` :
  4ᵉ onglet « Album » de la grange (`grange.js`), entrée « L'album » du menu de partie (pause), feuille haute des pages
  (grille 3 colonnes, cases 104 × 120 px, ‹ › 48 × 48, points de page), fiche d'une case, bouton « Recevoir », message
  « Album : … ✓ » (un par aube), pastille, rattrapage au démarrage (« N cases retrouvées »).
- `src/ui/cozy.js` : `createCozy(app) → app.cozy = { onEvent, frame, reset, openFete(), enterFeteMode(), leaveFeteMode(),
  openWinter(), openStory(), lanternPage(ev), todoItems(game), morningLines(ev), plotRows(plot), seedChips(crop),
  onHit(hit), enabled(game) }` : feuilles « La chasse aux œufs » (et variantes), « La soupe du village », « Le stand de la
  ferme », « Les paniers de Noël », « La foire aux graines », « La veillée » ; **mode fête** (pause `fete`, barre
  « 🥚 3 / 8 · Indice · Terminer » à la place des onglets, `scene.setFeteMode(true)`) ; aperçu en direct
  (`query.fetePreview`) ; page « Les lanternes de l'année » de la victoire et du bilan annuel (`dialogs.js`) ; cartes du
  choix du niveau « 🏮 13 / 20 » ; section « Les lanternes » du Carnet et aperçu `query.lanterns()` dans le Bilan.
- F1 : fiche de parcelle (`field.js`) « À la main : 31 · par l'équipe : 25 », « Vous attend · la moissonneuse passera
  dans 1 jour », « Désherbée par Lucie » ; ligne « À faire » « Le Haut-Champ : 12 parcelles mûres vous attendent (+25 %
  à la main) » ; résumé du matin « Hier : 34 récoltes à la main (+86 de prime) » ; feuille des graines « Réserve : 16 ».
- Récompenses : `feteDone.ecus` → `progression.careerEcus` ; `lanternsLit` → `progression.recordLanterns` (écus,
  décors) ; `storyHeard` → `progression.recordStory` (histoire affichée, écu) ; album à chaque aube (`checkAlbum` /
  `recordAlbum`, même règle que les succès : partie en cours seulement) et à la fin (`recordRunEnd` / `recordCareerYear`).
- `createGame({ cozy: { decor: app.progression.decorSummary() } })` (niveaux).
- Conseils « première fois » : `cozy.album`, `cozy.fete`, `cozy.winter`, `cozy.lanterns`, `cozy.helpers`, `cozy.seedFair`
  (textes dans `COZY_HINTS`).
- Sons (synth existant) : `pop` objet trouvé, `chime` soupe et paniers, `fanfare` rosette d'or et 8 œufs, `reveal` lanterne,
  `magic` veillée ; gazouillis : `synth.play('chirp')` (nouveau son synthétisé, 3 notes aiguës brèves) ; aucun fichier son.
- Débogage (`?debug=1`) : `__debug.cozy.{ on(), state(), fete(id), find(i), soup(ids), stand(items), baskets(b), winter(),
  bird(id), story(), lanterns(), ripe(n), album(), albumAll() }` (passent par `actions.triggerCozy` et les actions
  publiques ; `albumAll` remplit l'album de la progression de test).

### Sprites (paquet ART : planche `assets/sprites/lot4.png`, `assets/sprites/generate-lot4.py`, bloc `// <lot4:auto>`)

Même méthode que `generate-lot3.py` (palette Kenney, contour sombre, lumière en haut à gauche ; tuiles de 16 px).
Tailles : **16 × 16** sauf mention. Les cases d'album réutilisent les sprites existants (cultures `crop.<id>.icon`,
produits `product.<id>`, animaux, `icon.weather.<id>`, surprises et trouvailles du lot 2, portraits du lot 3) : seuls
les manquants sont dessinés ici.

| Nom(s) | Taille | Description |
|---|---|---|
| `album.cover` | 32 × 32 | couverture de l'album : cuir vert, coins dorés, fleur séchée pressée |
| `icon.album` | 16 × 16 | petit livre vert à feuille pressée (menu, onglet) |
| `album.page.<id>` (garden, homemade, animals, sky, luck, village, years, fetes, edge, feeder, stories) | 16 × 16 | onglets de page : carotte, pot de confiture, poule, soleil et nuage, trèfle, maisonnette, calendrier, fanion, branche de houx, mésange, bougie |
| `album.empty` | 16 × 16 | cadre pointillé crème avec « ? » (repli d'une silhouette) |
| `album.stamp.gold`, `album.stamp.giant`, `album.stamp.fete`, `album.stamp.visitor`, `album.stamp.best` | 16 × 16 | tampons ronds encrés : étoile dorée, losange vert, chapiteau, enveloppe, médaille |
| `album.ribbon` | 16 × 16 | ruban « page complète » (rouge, queue fourchue) |
| `product.wool`, `product.milk` (si absents) | 16 × 16 | pelote de laine blanche ; bidon de lait |
| `fish.gudgeon`, `fish.roach`, `fish.perch`, `fish.trout`, `fish.pike` (si absents) | 16 × 16 | goujon gris tacheté, gardon aux yeux rouges, perche rayée, truite tachetée, brochet allongé |
| `winter.deadwood`, `winter.pinecone`, `winter.holly`, `winter.chestnut`, `winter.blewit`, `winter.mistletoe` | 16 × 16 | fagot de bois mort, pommes de pin, branche de houx à boules rouges, bogue ouverte et châtaignes, pieds-bleus (champignons violets), touffe de gui à baies blanches ; dessinés posés sur la neige (ombre bleutée) |
| `track.hare`, `track.deer`, `track.fox` | 16 × 16 | empreintes dans la neige (gris-bleu, semi-transparentes) : lièvre (2 grandes devant, 2 petites), chevreuil (2 sabots en cœur), renard (ligne droite) |
| `bird.<id>`, `bird.<id>.1` (greatTit, blueTit, robin, sparrow, chaffinch, bullfinch, nuthatch, woodpecker) | 16 × 16 | 8 oiseaux de profil, posés ; 2ᵉ image : tête baissée (il picore) |
| `feeder`, `feeder.full` | 16 × 32 | mangeoire en bois sur poteau, petit toit enneigé ; avec graines visibles |
| `window.lit` | 16 × 16 | fenêtre éclairée, lueur chaude orangée, rideaux (posée sur la maison) |
| `story.vignette` | 48 × 32 | Joseph au coin du feu dans son fauteuil, chat roulé en boule, bouilloire |
| `icon.story`, `icon.winter`, `icon.feeder`, `icon.seedbank`, `icon.fete`, `icon.hand` | 16 × 16 | bougie et livre ; flocon et brin de houx ; mangeoire ; boîte en fer à biscuits ; fanion ; main et petit cœur vert |
| `fete.egg.0` … `fete.egg.3`, `fete.egg.gold`, `fete.egg.shell` | 16 × 16 | œufs peints (rose rayé, bleu à pois, jaune zigzag, vert à fleurs), œuf doré brillant, coquilles éclatées (effet) |
| `fete.lampion`, `fete.lampion.lit`, `fete.lantern`, `fete.lantern.lit`, `fete.frog`, `fete.frog.1` | 16 × 16 | lampion de papier éteint / allumé ; lanterne d'hiver éteinte / allumée ; grenouille verte assise / en saut |
| `fete.pot`, `fete.pot.1` | 32 × 32 | grande marmite noire sur trépied et feu de bois ; 2ᵉ image : vapeur et bulles |
| `icon.ladle` | 16 × 16 | louche en bois |
| `fete.stand` | 32 × 32 | étal en bois à auvent rayé vert et blanc, 5 cagettes vides |
| `ribbon.green`, `ribbon.blue`, `ribbon.gold` | 16 × 16 | rubans de concours : vert, bleu, rosette dorée à deux queues |
| `fete.basket`, `fete.basket.full` | 16 × 16 | panier d'osier vide à nœud rouge ; plein (légumes qui dépassent) |
| `fete.seedstall` | 32 × 32 | étal de la foire aux graines : sachets kraft suspendus à une ficelle, ardoise « −25 % » |
| `seedpack.generic` | 16 × 16 | sachet de graines kraft à étiquette blanche (icône d'un sachet de la foire) |
| `npc.mayor`, `npc.mayor.walk` | 16 × 16 | M. le maire, écharpe tricolore, carnet ; debout, en marche |
| `npc.lili`, `npc.lili.walk` | 16 × 16 | la petite Lili, couettes, panier ; debout, en marche |
| `lantern.rack` | 32 × 32 | porte-lanternes en bois sur le perron : 5 montants, 4 crochets chacun |
| `lantern.<crit>.on`, `lantern.<crit>.off` (variety, care, neighbours, beauty, prosperity) | 8 × 8 | petite lanterne accrochée, verre vert / bleu / rose / jaune / orange, allumée (halo) ou éteinte |
| `icon.crit.<crit>` (mêmes id), `icon.lantern.on`, `icon.lantern.off` | 16 × 16 | pictos des critères (trois feuilles, goutte et cœur, deux maisons et cœur, fleur, pile de pièces) ; lanterne allumée / éteinte pour les lignes de l'interface |
| `fx.weeds`, `fx.weeds.1` | 16 × 16 | touffe d'herbe folle ; arrachée qui s'envole (désherbage) |
| `badge.waiting` | 8 × 8 | petit cœur vert « vous attend » (parcelle mûre que l'équipe laisse au joueur) |
| `decor.scarecrow.flower`, `decor.can.golden`, `decor.barrow.giant`, `decor.jam.shelf`, `decor.weathervane.pig`, `decor.sundial`, `decor.lantern.fairy`, `decor.pump.village`, `decor.bunting.post`, `decor.arch.fete`, `decor.woodpile`, `decor.heron.wood`, `decor.rocking.chair` | 16 × 16 | décors de l'album : épouvantail couronné de fleurs, arrosoir doré, brouette portant une citrouille géante, étagère de pots de confiture, girouette au cochon, cadran solaire de pierre, lanterne des fées (lueur verte), pompe à eau en fonte, mât à guirlandes, petite arche de fête fleurie, tas de bûches, héron en bois sculpté, fauteuil à bascule |
| `decor.herbarium` | 32 × 32 | le grand herbier : petit kiosque vitré, plantes séchées en cadres |
| `decor.lantern.green`, `.blue`, `.pink`, `.yellow`, `.orange` | 16 × 16 | lanternes de critère sur poteau (couleur du verre) |
| `decor.lantern.grand` | 32 × 32 | le grand lampion : lanterne de papier à cinq couleurs sur un mât |

`CREDITS.md` : planche dessinée pour le jeu, style Kenney (CC0), comme `lot3.png`.

### Découpage en 3 paquets parallèles

| Paquet | Possède (seul à modifier) | Livre | Attend |
|---|---|---|---|
| **CORE** | `src/data/{album,cozy}.js`, `src/data/achievements.js` (succès du lot), `src/data/cosmetics.js` (21 décors), `src/data/career/{career,lots,buildings,animals,events,staff,machines,descriptions}.js` (chiffres et textes ci-dessus), `src/data/difficulty.js` (seuils), `src/core/{album,lanterns,cozy}.js`, `src/core/career/{cozy,handwork}.js`, `src/core/career/extensions.js` (1 ligne), modifications de `src/core/{game,stats,progression,surprises,variety}.js`, `src/storage.js`, `src/core/career/{runtime,work,machines,events,save,land}.js`, `tools/{simulate,simulate-career,sim-career-staff}.js`, `tests/*` (nouveaux et `career-helpers.js`) | état, actions, requêtes, événements, progression et album ci-dessus ; simulation et réglage (F1, fêtes, hiver, lanternes, étoiles) ; tableaux du § 17.8 et seuils du § 13.3 | rien (commence par un `createGame({ cozy })` qui ne fait rien, parité verte, puis ajoute chaque partie ; F1 en premier pour lancer la simulation de carrière) |
| **ART** | `assets/sprites/generate-lot4.py`, `assets/sprites/lot4.png`, bloc `// <lot4:auto>` d'`atlas.js`, `CREDITS.md` | planche et noms du tableau des sprites ; planche de contrôle × 6 | rien |
| **UI/RENDER** | `src/ui/*` (nouveaux `album.js`, `cozy.js`), `css/cozy.css`, `tools/build.js` (ligne `CSS_FILES` seulement), `src/main.js`, `src/index.template.html`, `src/render/*` (hors bloc `lot4:auto`), nouveau `src/render/cozy-actors.js` | album, feuilles et mode fête, hiver, pages des lanternes, lignes F1, scène, hit-test, animations, conseils, débogage ; vérification au doigt | CORE : API (factices de même forme en attendant) ; ART : sprites (repli `canDraw` / `spriteAny`) |

Points de contact : (1) **CORE → UI/RENDER** : formes `feteInfo`, `itemInfo`, `query.winter()`, `query.lanterns()`,
`albumPages()`, l'ordre des événements de l'aube et du soir (`feteEnded` avant le fermage ; `lanternsLit` avant
`victory` / `yearEnd`), les types de `hitTest` (figés ici ; tout écart est noté par CORE dans une section « Écarts »
sous ce contrat) ; (2) **ART → RENDER/UI** : noms du tableau des sprites (aucun renommage sans prévenir) ; (3) **CORE ↔
ART** : identifiants des pages et cases, oiseaux, trouvailles, traces, fêtes, objets cachés, décors, critères (figés ici
et dans le § 17 du game design) ; (4) **RENDER ↔ CORE** : `u` (0..1) → cachette par `cozySpot` (RENDER seul connaît les
cachettes ; le cœur ne vérifie que l'index) ; (5) intégration par le chef de projet : `node --test tests/` (parité
comprise), `node tools/simulate.js --compare-cozy` et `--lanterns`, `node tools/simulate-career.js --compare-f1` et
`--compare-cozy`, `node tools/build.js`, vérification au doigt (Pixel 7, 360 × 740 : cibles ≥ 48 px, textes ≥ 14 px,
aucun débordement ; un niveau Détente joué en entier avec les 4 fêtes, l'hiver et les lanternes ; une année de carrière
avec la foire, F1 visible, comice et stand ; l'album ouvert dans la grange et en partie ; une partie Classique qui
remplit l'album sans rien changer d'autre), `JOURNAL.md`, sauvegarde `backup/…` avant et après le lot.

### Écarts et précisions (livraison CORE, 2026-10-03)

Section tenue par le paquet CORE **pendant** la livraison (UI/RENDER et ART travaillent en parallèle) : tout ce qui
précise ou s'écarte du contrat ci-dessus. Aucun nom ni forme du contrat n'est retiré ; seulement des champs **ajoutés**,
sauf mention contraire.

- **Récompenses déjà dans la progression renvoyée** : `claimAlbumReward`, `recordLanterns` et `recordStory` ajoutent
  eux-mêmes les écus (et débloquent les décors) dans la progression qu'ils renvoient, comme `unlockAchievements` et
  `recordRunEnd` : l'interface enregistre la progression renvoyée et **n'ajoute pas** les écus une seconde fois
  (`rewards.ecus` sert à l'affichage). Seuls `feteDone.ecus` (fêtes) passent par `progression.careerEcus` (ou
  `recordCareerEcus`), comme au lot 3.
- **Progression** (`src/core/progression.js`, ré-exporte `src/core/album.js`) : `checkAlbum`, `recordAlbum`, `albumPages`,
  `claimAlbumReward`, `markAlbumSeen`, `albumRetro`, `recordStory`, `recordLanterns` (contrat) ; en plus :
  `recordAlbumDawn(progress, ctx, now, src)` (aube : nouveautés écrites + succès « Album et fêtes » → `{ progress, cases,
  stamps, achievements, rewards: { ecus } }`), `albumOverview(progress)` (`{ found, total, pagesDone, pages, complete:
  { id, name, ready, claimed, ecus, cosmeticId }, newCount, claimable, stories }` — la récompense « album complet » n'est
  dans aucune page), `albumClaimable(progress)` (récompenses prêtes), `retroText(n)` (« 23 cases de l'album retrouvées
  dans vos anciennes parties »), `levelLanterns(progress, levelId)` (`{ best, total }` | null, cartes « 🏮 13 / 20 »),
  `decorSummary(progress)` (`{ placed, path, fence }` pour `createGame({ cozy: { decor } })`), `cozyAchievementList(p, ctx)`
  (catégorie « Album et fêtes », même forme que `careerAchievementList`), `defaultLanterns()`.
  `recordRunEnd(p, run)` et `recordCareerYear(p, run)` acceptent `run.context` (= `query.achievementContext()` de la fin)
  pour l'album et renvoient en plus `album: { cases, stamps }`. Une progression **neuve** a `album.retroDone = true` ; une
  progression lue **sans** `album` a `retroDone = false` (rattrapage au chargement, `src/storage.js`, `albumMigration()`).
- **`albumPages(progress, mode)`** : `mode` = `'classique' | 'detente' | 'career'` ; chaque case a en plus `src`,
  `stampsPossible` ; `hint` est l'indice **sans** suffixe, `modeNote` le suffixe à afficher (« À découvrir dans Ma ferme »,
  « En Détente ou dans Ma ferme ») ; chaque récompense a `name` (et `stamps` pour les pages en plus).
- **Décors** : **20** décors `found: true` (le contrat dit 21 mais en nomme 20) : les 14 de l'album (13 petits +
  `herbarium`, grand) et les 6 des lanternes (5 petits + `lantern.grand`, grand).
- **`query.achievementContext()`** : `weather` (tous modes, contrat) ; avec les surprises : `surprisesStats`,
  `specialWeather` (météo spéciale du jour ; carrière : l'arc-en-ciel de l'événement) ; avec le lot 4 : `cozy = { stats
  (cumul de la partie / de la carrière), pending (pas encore compté dans la progression), year, contestGoals (épreuves du
  concours du niveau 12 réussies) }` ; avec la variété : `variety.ordersByClient`, `variety.merchantVisits`,
  `variety.pending` (`{ ordersDone, cartsFull, gold }` pas encore comptés). Carrière (avec le lot 4) : `career.pets`,
  **`career.speciesIds`** (le contrat disait `species`, mais `career.species` existe déjà : c'est le **nombre** d'espèces lu
  par le succès « L'arche »), `animalProducts`, `fish`, `themes`, `themeVisitors`, `themesPlayed`, `contestGoalsMet`.
- **État** (ajouts) : `state.cozy.lit` (niveaux : lanternes allumées au dernier soir, aussi dans `state.result.lanterns`) ;
  `state.cozy.statsBase` (carrière : cumuls au dernier bilan) ; `year.animalLost` (perte dans les abris pleins : la
  perte de `work.year` est remise à zéro par l'extension des employés avant le bilan du lot 4) ; `year.base = { orders,
  crates, quests }` (compteurs au début de l'année) ; `winter.feeder.fills` (remplissages de l'hiver, oiseaux rares) et
  `winter.feeder.here` (mangeoire sortie) ; `stats.best` (tampon 🏅), `stats.giants` (géants récoltés à la main),
  `stats.animal`, `stats.themeVisitors`, `stats.handCrops` (carrière : récoltes à la main par culture, comice F1-5) ;
  `fete.ended` (soir passé) ; parcelle `weededBy` (nom du jardinier, fiche « Désherbée par Lucie »). `state.career.cosmetics`
  accepte `path` / `fence` (`createCareer({ cosmetics: { decor, path, fence } })`, critère « beauté »).
- **Prime à la main** : `HAND_BONUS` = 1,25 dans `src/data/career/career.js` ; une carrière **sans** le lot 4
  (`cozy: false`, tests) garde `HAND_BONUS_LEGACY` = 1,1 (`handBonusOf(state)` de `handwork.js`).
- **Événements** : `feteDone` d'une chasse seulement quand les 8 objets sont trouvés par le joueur (sinon `feteFound` puis
  `feteEnded` le soir) ; `weeded { plotIndex, by: staffId, name }` ; `lanternsLit` (niveaux) porte `levelId` ;
  `contestAwarded.ribbon` en plus de `standBonus` ; `planted.fromBank` / `bankLeft` (réserve de la foire).
  **Carrière, dernier soir d'hiver** : l'extension `cozy` étant enregistrée après `variety`, `feteEnded` (foire) arrive
  **après** les événements du lot 3 (charrette, défis, cartes), puis charges, `lanternsLit`, `yearEnd`.
- **Requêtes** : `query.cozy()` a en plus `lit` (niveaux) et `history` (carrière, 10 dernières années) ;
  `query.plantableCrops()` (carrière, lot 4 actif) a **toujours** `bank` (0 sans réserve) ; `query.plot(i)` (carrière, F1)
  a `ripeAt`, `wait`, `helperValue`, `weeded`, `weededBy` (et `handValue`, `handBonus` existants : 1,25) ;
  `feteInfo.icon` d'une fête de thème : `icon.theme.<id>` ; `query.winter().story.day`.
- **Fêtes des thèmes** : `id` = `theme.<themeId>`, nom et texte dans `THEME_FETE_GAMES` (`src/data/cozy.js`) ; si une
  fête du calendrier et la fête du thème tombaient le même jour, celle du calendrier passe d'abord (jamais avec les dates
  actuelles). La foire aux graines n'existe qu'en carrière ; le sachet de Basile (petits pois) va dans
  `state.variety.rare` (semis à la main), les autres sachets dans `state.cozy.seedBank`.
- **Beauté (carrière)** : « embellissement » = au moins un décor posé au coin d'un terrain acheté (emplacements
  `lotN.corner`) : 2 points.
- **Calendrier de carrière** : `CALENDAR_EVENTS[].day` peut valoir `'last'` (`festivalDay(state, f)` de
  `src/core/career/events.js` le résout) ; `factorsRank` (marché de Noël : la fête dès le rang 1, ses facteurs de prix au
  rang 2) ; nouvelle entrée `springFete`. Les tests de carrière d'avant le lot 4 suivent ce calendrier (fichiers de test
  mis à jour).

## Lot 4 — rendu et interface (UI/RENDER, 2026-10-03)

Code contre le contrat ci-dessus (« Lot 4 — contrats ») et ses « Écarts et précisions ». Tout ce qui vient de la
partie est gardé par `state.cozy` : en Classique (clé absente) rien n'est dessiné (ni porte-lanternes, ni mangeoire),
aucune ligne « À faire », aucune section ; **seul l'album** (progression permanente) se remplit et se consulte. Un
sprite du lot 4 absent → repli dessiné (canvas) ou petit dessin de remplacement (`czIcon` : emoji décoratif, caché aux
lecteurs d'écran). Styles : **`css/cozy.css`** (ajoutée à `CSS_FILES`). Tests : `tests/lot4-render.test.js`.

```
src/render/cozy-actors.js  cozySpots(layout), cozySpot(u, spots, taken), placeItems(items, spots), waitingPlots(state)
                           (purs) ; createCozyActors(effects) : sync, onEvent, update, collect(push), drawOverlay(c,
                           layout), drawGlow(c, ox, oy, dayProgress, weather), hitTest(wx, wy, slop, { feteMode,
                           minWorld }), itemRect(kind, id), setFeteMode, setLanterns, sing, clear, shift, spots, stats
src/render/scene.js        acteurs du lot 4 dans les deux modes (layout.cozy posé à la première synchronisation) ;
                           hitTest + feteItem | winterFind | feeder | storyWindow | lanternRack | feteStall ; mode fête
                           exclusif ; scene.setFeteMode, feteMode, setLanterns, cozySpots, cozyStats, cozyItemRect,
                           cozySing ; décors « grands » (2 × 2) hors mare ; repli des décors sans planche ; mare gelée
src/render/atlas.js        DECOR_SPRITES : les 20 décors « trouvés » (alias decor.<id> seulement si le sprite existe)
src/ui/cozy.js             createCozy(app) → app.cozy (voir l'en-tête du fichier)
src/ui/album.js            createAlbum(app) → app.album : available, open(pageId), tabContent, onDawn, snapshot,
                           announceSince, announce, badge, boot, pages, fillAll
src/main.js                app.album, app.cozy, app.storage ; onGameEvent → app.cozy.onEvent ; aube → app.album.onDawn ;
                           planche « lot4 » facultative ; createGame({ cozy: { decor } }) en Détente seulement ;
                           recordRunEnd({ context }) ; « L'album » dans le menu de pause ; __debug.cozy (= __debug.lot4)
```

- **Repères** (px du monde, déterministes) : cachettes au pied des buissons et des arbres (le décor est dans la couche
  fixe : l'objet dépasse à son pied), coins de la clôture du champ, puits, panneau de la ferme, côté de la maison, bord
  de forêt (≥ 16) ; lisière (tuiles libres voisines de la forêt, ≥ 8) ; traces (en plein pré) ; mangeoire 16 × 32
  (deux tuiles libres près de la maison) ; porte-lanternes 32 × 32 (perron : contre la façade, sans couvrir la porte
  ni un chemin ; lanternes à x = 1 + 6 m, y = 3 + 7 r) ; fenêtre de la veillée (sur la maison, hors de la colonne de
  la porte) ; stand 32 × 32 près du panneau du village (la ligne du haut peut chevaucher la clôture du champ, comme le
  panneau). Carrière : bande de la maison et champ de départ.
- **Dessin** : objets cachés triés par profondeur, dandinement toutes les ~4 s (mouvements réduits : immobiles),
  saut + confettis + « +2 » à la trouvaille (doré : couronne d'étincelles) ; lampions et lanternes allumés restent et
  brillent le soir ; stand du jour (sauf fête de thème : le stand `fair.theme.<id>` du lot 3) ; maire sur `feteDone`
  (étal), Lili sur `feteEnded` (aidé) ; trouvailles avec étincelle toutes les ~3 s ; traces (`icon` de la requête) ;
  mangeoire (pleine le jour du remplissage, graines qui tombent), oiseau qui picore et saute quand il chante ; porte-
  lanternes **dès qu'il y a un résultat** (niveaux : `progress.lanterns.levels[id].best`, donné par l'interface ;
  carrière : `state.cozy.lanterns.history`) ; badge `badge.waiting` sur les parcelles qui ont `ripeAt` (F1).
- **Toucher** : en plein d'abord, puis la tolérance du doigt après les parcelles ; cibles agrandies jusqu'à 48 px CSS
  (`minWorld = 48 × dpr / zoom`) ; en mode fête, seuls les objets pas encore trouvés (le plus proche du doigt).
- **Mode fête** (`app.cozy.enterFeteMode`) : feuilles fermées, pause `fete`, `body.in-fete` (onglets cachés, ligne
  « À faire » cachée), barre `#cz-fetebar` (compteur lu, « Indice », « Terminer »), annonce de la fête retirée
  (`toasts.hide(node)`, nouveau) ; sortie quand une fenêtre s'ouvre, quand la fête change, quand tout est trouvé.
- **Feuilles** (`openLive` : contenu reconstruit quand la requête change ; choix locaux gardés par fête) : chasse,
  soupe, stand, paniers, foire, hiver, veillée, lanternes ; aperçu `fetePreview` ; refus du cœur en message sans
  historique. Phrase des villageois : `result.text` du cœur, sinon une phrase selon le résultat.
- **Lanternes** : `lanternsLit` → `recordLanterns` (sauf `preview` du débogage : la page s'ouvre seule, rien n'est
  enregistré) ; victoire / faillite : bouton « Les lanternes » → page (remplace la fenêtre) avec les mêmes boutons de
  fin ; carrière : bloc dans la fenêtre du bilan annuel (`app.cozy.yearBlock`) ; Bilan (aperçu `query.lanterns()`),
  Carnet › Bilan (`lanternSection` : colonnes des années), cartes de niveaux (`levelBadge`).
- **Album** : vérifié à chaque aube d'une partie en cours (`recordAlbumDawn`, succès compris), et au bilan de fin
  (diff des cases trouvées avant / après `recordRunEnd` / `recordCareerYear`, qui reçoivent `context`) ; un message
  « Album : … ✓ » par aube, les autres dans l'historique ; `markAlbumSeen` à l'affichage d'une page (le badge
  « Nouveau » reste pendant cette ouverture) ; récompense « album complet » d'après `albumOverview` ; rattrapage :
  `storage.albumMigration()` au démarrage (message « N cases retrouvées… », bouton « Voir » → grange › Album).
- **F1** : `plotRows` (valeur à la main / par l'équipe ; « Vous attend » avec l'aide qui travaille vraiment sur le
  terrain : moissonneuse ou cueilleuse allumée, jardinier — `query.career.machines()` / `staff()`) ; ligne « À faire »
  `cz-ripe` (`replaces: 'harvest'`, nouveau dans `todo.js`) ; résumé du matin (récoltes à la main de la veille, comptées
  sur `harvested.handBonus`) ; texte du jardinier dans la fiche d'un employé ; « Stand du comice : +N »
  (`contestAwarded.standBonus`).
- **Sons** : `pop` (objet, trouvaille), `gold` (œuf doré), `fanfare` (8 œufs, rosette d'or, récompense de page),
  `chime` (soupe, paniers), `reveal` (lanternes), `magic` (veillée), **`chirp`** (nouveau, `src/audio/synth.js`).
- **Débogage** (`?debug=1`) : `__debug.cozy` / `__debug.lot4` `.{ on(), state(), trigger(kind, arg), fete(id),
  winter(), bird(id), trace(kind), story(), lanterns(), ripe(n), find(i), soup(ids), stand(items), baskets(b),
  open(kind), feteMode(on), hint(), album(), albumAll(), point(kind, id), ui(), stats() }`.
- **F1 (réglage)** : `F1.machineDelay` = **3** (moissonneuse et cueilleuse à la 3ᵉ aube ; le contrat disait 2 — levier
  n° 2 du § 17.8 du game design, voir § 17.3.3), `F1.staffDelay` = 4. Les textes (descriptions des machines et du
  jardinier, conseil `cozy.helpers`) sont **calculés** à partir de `F1` et `HAND_BONUS` : l'interface doit lire
  `query.plot(i).wait` / `F1` / `handBonus` plutôt qu'écrire « 2 jours » ou « +25 % » en dur. La **prime à la main est
  payée tout de suite même quand la récolte part au grenier, à l'atelier ou à une commande non vendue**
  (`harvested.amount` = la prime + la qualité dans ces cas, `harvested.handBonus` = la prime).
- **Lanternes** : chaque critère a en plus `steps` (les 3 paliers) ; la variété des niveaux a `k`. Barèmes finaux :
  `LANTERN_RULES` de `src/data/cozy.js` (game design § 17.2.1).
- **Simulation** : `tools/simulate.js` exporte `COZY_STYLES`, `SIM_DECOR`, `parseCozy`, `cozyDay(game, me, P, spend?,
  keep?)` (tirage propre `me.cozyRnd`, pour que les autres décisions restent identiques avec ou sans le lot),
  `lanternStats` ; `--cozy`, `--compare-cozy`, `--lanterns`. `tools/simulate-career.js` : stratégie `handsOff`,
  `--cozy`, `--compare-cozy`, `--compare-f1` (+ « même ferme laissée seule » : `handsOffSameFarm()`), `--lanterns` ;
  `playCareer({ cozy, keepGame })` ; robot tranquille corrigé (achats avant les champs, sans gestes de champ ; récolte à la
  main d'abord avec F1) ; serre (rang 2), mare (rang 3) et 2 canards dans les envies du tranquille et de l'appliqué ;
  décor des robots `SIM_CAREER_DECOR`.
- **Seuils d'étoiles Détente** recalculés (`src/data/difficulty.js`, game design § 13.3).

### Intégration CORE ↔ UI/RENDER et QA au doigt (2026-10-03)

Écarts finaux du cœur vérifiés dans l'interface (moissonneuse et cueilleuse à 3 aubes lues dans `query.plot(i).wait`,
prime à la main payée aussi vers le grenier / l'atelier, `HAND_BONUS_LEGACY`, `career.speciesIds`, récompenses déjà
créditées par `claimAlbumReward` / `recordLanterns` / `recordStory`, ordre du dernier soir d'hiver, 20 décors,
pièces des fêtes × `careerFactor(rang)`, récolte immédiate du dernier jour d'automne). Changements de contrat :

- **`query.plot(i).wait`** (carrière, F1) = `{ machineIn, staffIn, machine, freeze }` : `machineIn` est `null` sans
  moissonneuse (cueilleuse pour un arbre) **allumée sur ce terrain**, `staffIn` est `null` sans jardinier qui couvre le
  terrain (`lotId` du terrain ou `'all'`) ; `machine` : `'harvester' | 'fruitPicker' | null` ; `freeze` : dernier jour de
  l'automne, la culture gèlerait demain (l'équipe la rentre aujourd'hui). Aides : `harvestHelpers(state, i)` de `handwork.js` (pur). La fiche « Vous attend · la moissonneuse passera dans N jours » n'apparaît que
  s'il y a une aide ; le conseil `cozy.helpers` aussi.
- **`fete.result`** : + `text` (phrase des villageois : chasse complète, soupe, stand, paniers), `perBasket` (paniers),
  `detail` (stand ; `query.fete().result.detail[].item` a `name` et `icon`). Le résultat d'une action garde sa forme
  (+ `text` pour `presentStand` et `giveBaskets`).
- **Paniers d'une petite ferme** : il faut autant de paniers garnis que de produits différents de l'année (3 au plus) ;
  un panier vide reçoit « Joyeux Noël ! » (0 ♥, pas de pièces pour lui). Refus : « Récoltez ou produisez quelque chose,
  et revenez faire les paniers ! », « 2 paniers garnis au moins. », « Deux produits au plus par panier. ».
- **Accords** : refus « Carotte : pas récoltée cette année. », « Confiture de fraises : pas produite… », « Œufs : pas
  produits… » ; chasse des grenouilles / lanternes : « cachées », « les 8 dernières grenouilles », lampions et lanternes
  « allumés » ; lanternes : « Encore 1 culture ou produit / 2 cultures ou produits », « 1 382 pièces » ; soin de
  carrière « 21 % de soin cette année » ; « Pommes » (et non « Pommier ») sur les étals et dans les paniers.
- **Messages** : sur une feuille haute, la pastille « +N messages » est masquée et les « Voir » ne captent plus le doigt
  (ils couvraient « Chercher les œufs », « Goûter la soupe ») ; sur les feuilles des fêtes et de l'hiver, seuls les refus
  s'affichent ; pendant le mode fête, pas de pastille ; sur les fenêtres de fin (saison, bilan annuel, rang, victoire,
  faillite : `body[data-dialog]`), les messages attendent dans l'historique. Option `toasts.show({ keepTouch })` (mise à
  jour du jeu) pour rester touchable partout. Pastille au singulier : « +1 message ».
- Feuilles des fêtes : le nom n'est plus répété sous le titre ; boutons `.cz-go` sans `min-width` (débordaient à 150 %
  sur 360 px) ; badges de qualité, « Nouveau » et tampons vides de l'album à 14 px.

## Zoom de la scène (pincer, boutons + / −, 2026-10-03)

Seule la ferme (le canevas) grossit. Trois zooms à ne pas confondre : **taille du texte** (`textScale`, 100–150 %,
`src/ui/a11y.js`), **loupe de l'interface** (`pinchZoom` : zoom de la page par le navigateur, sur les barres et les
fiches), **zoom de la scène** (ici, sur le canevas seulement).

```
src/render/camera-zoom.js  PUR (testé : tests/zoom.test.js)
  zoomBounds({ base, bandW, bandH, worldW, worldH, career }) → { min, max, base }
      min = « toute la ferme visible » mais ≥ ⌈40 %⌉ du défaut (Niveaux) / ⌈50 %⌉ (Carrière), ≤ défaut ;
      max = max(défaut + 1, ⌊défaut × 2,5⌋) — Pixel 7 : 2…12 (défaut 5), carrière 3…12
  clampZoom, snapZoom (entier), stepZoom(z, ±1), pinchZoom(z0, d0, d) (élastique 5 % aux bornes),
  anchorScroll(base, zoom, w, s), zoomRatio / zoomFromRatio (préférence = rapport au défaut),
  staticRegion({ worldX0, worldX1, worldH, minZoom, devW, devH, bandCx }) → couche fixe indépendante du zoom
src/render/scene.js
  setZoom(z | null | 'in' | 'out', { x, y, animate }), beginZoomGesture(), zoomGestureTo(z0, d0, d, x, y, wx, wy),
  endZoomGesture({ x, y, animate }), zoomInfo() → { zoom, base, min, max, isDefault, ratio, gesture, animating,
  canIn, canOut }, setZoomRatio(r)
src/ui/gestures.js   pincement (pointeurs tactiles suivis : 2 doigts → geste d'un doigt annulé, zoom autour du milieu
                     des doigts qui suit les doigts), double toucher sans cible (≤ 320 ms, ≤ 36 px) → zoom par défaut,
                     Ctrl + molette → un cran au pointeur (≤ 1 / 110 ms)
src/ui/zoom.js       createZoomControls(app) → { frame(), changed(), root, stored(mode) } = app.zoomUI ; frame() dans la
                     boucle de main.js après careerUI.frame()
```

- **Caméra** : `computeCamera` calcule le zoom par défaut comme avant (`zoomBase`), puis `zoom = userZ` (entier hors
  geste ; fractionnaire pendant le pincement et l'animation de pose de 0,2 s). `userZ = null` = défaut : **rendu
  identique à avant**. Changement d'écran : `userZ` suit le rapport au nouveau défaut.
- **Défilement** : zoomé, le centre de la vue va de `x0 + demi-vue` à `x1 − demi-vue` (bords du monde), en plus de
  la plage de la carte 2D ; vertical inchangé (monde centré s'il tient). Le défilement reste dans la ferme.
- **Tampons** : zoomé en Niveaux, la vue passe en **mode fenêtré** (comme la carrière : vue = l'écran, couche fixe =
  tout le monde) ; en mode fenêtré la couche fixe est `staticRegion(...)` (monde + marges pour le plus petit zoom
  permis), la vue est dimensionnée par le zoom entier inférieur. La couche fixe n'est redessinée que si sa géométrie
  change (`staticGeo`) : un pincement ne reconstruit rien (60 i/s mesurées) ; `buildStatic` (Niveaux) sait dessiner
  en mode fenêtré.
- **Exactitude** : `hitTest` → `screenToWorld` au zoom courant ; tolérances du doigt en px CSS (`TOUCH_SLOP_CSS × dpr /
  zoom`, `minWorld = 48 × dpr / zoom`) ; tout ce qui se place sur la scène lit `worldToScreen` / `viewRect`
  (`app.plotPageRect`, anneaux, pièces volantes, tutoriel, mini-carte `getMinimap` → cadre de la vue).
- **Boutons** `#zoom-controls` (`#zoom-in`, `#zoom-out`, `#zoom-reset` « 1:1 » seulement hors défaut), 48 × 48 px,
  `z-index` 18 ; à droite au-dessus de `--inset-bottom + --todo-h` ; `[data-minimap=shown|collapsed]` : à gauche de la
  mini-carte (et de son bouton « Cacher ») ; `html.left-handed` : à gauche ; grand écran : en bas à droite de la
  scène, à gauche du panneau ouvert. Cachés sous une feuille (téléphone), une fenêtre, une bulle, au menu.
- **Place des messages** : `frame()` publie la hauteur occupée depuis le bas de l'écran par la colonne de zoom (comptée
  avec « 1:1 », 3 × 48 + 2 × 4 px) et la mini-carte (cadre, boutons, ou bouton « Carte ») : `--float-reserve` sur
  `<html>` et `body.has-float-ui` ; `#toasts` se pose au-dessus (`css/guidance.css`), plafonné sous la barre du haut.
  Les messages ne recouvrent ni les boutons, ni la mini-carte, ni la ligne « À faire » (droitier comme gaucher).
- **Mouvement réduit** (`reducedMotion` ou `html.reduced-motion`) : `setZoom` et la fin du pincement posent le zoom
  sans animation.
- **Préférence** : `localStorage` `une-annee-a-la-ferme.zoom` = `{ levels?: r, career?: r }` (rapport au défaut ; absent =
  défaut), enregistrée quand le zoom se pose, appliquée (`setZoomRatio`) une fois par partie et par mode après le
  premier `scene.render` ; au menu (ferme de démonstration), zoom par défaut.
- **Débogage** : `__app.scene.zoomInfo()`, `__app.scene.setZoom(8)`.

## Vallée vivante — contrats du lot V1 (CORE · ART · UI/RENDER, conception 2026-10-03)

« La boîte en fer » : variétés anciennes (graines, planches d'essai, fixation, traits), aménagements nature, habitants
(recettes, venue, observation, services), étapes de la vallée, chapitres de Joseph, cueillette des haies, étal de la
foire, 2 pages d'album. Règles chiffrées et contenus : **`docs/VALLEE.md`** (§ 2 à § 10 ; résumé : `docs/GAME_DESIGN.md`
§ 18). Ce qui suit fixe les **noms, formes et comportements** que les trois paquets se promettent ; tout est **ajouté**
(rien du contrat existant n'est retiré ni renommé). Tant que CORE n'a pas livré, UI/RENDER simulent les requêtes avec
des objets factices de la même forme ; tant qu'ART n'a pas livré, RENDER/UI dessinent un repli (`canDraw`, `spriteAny`).

### Règles communes

- **Carrière seulement.** Tout est gardé par `state.career?.valley` (et `state.career.valley.parts.<partie>`). Une partie
  de niveau n'a pas `state.career` : **aucun** code nouveau n'y passe, aucun flux, aucun champ de requête ; les fichiers
  partagés touchés (`farm.js`, `surprises.js`, `cozy.js`) ne lisent la Vallée que derrière ce garde. `tests/parity.test.js`,
  `tools/capture-parity.js` et `node tools/simulate.js` inchangés et verts.
- **Aléatoire** : un flux **nouveau**, `state.rng.valley` (`hashSeed(seed, 'valley')`), créé par l'extension (`init` /
  `migrate`). Tirages fixes : **à chaque aube** une fois la Vallée commencée, 1 nombre par espèce de `SPECIES` (12, dans
  l'ordre des données, qu'elle soit candidate ou non) ; en été et en automne à partir de l'étape 2, **3 nombres** pour la
  cueillette des haies (chance, sorte, emplacement), qu'il y ait de la place ou non ; **1 nombre** par bocal ouvert
  (`openJar`) ; **1 nombre** à l'aube de la foire aux graines (sachet de l'étal). Météo, marché, `career`, `staff`,
  `events`, `quality`, `surprise`, `sky`, `orders`, `variety`, `cozy` tirent **le même nombre** de nombres qu'avant (les
  services changent des seuils ou des poids, jamais le nombre de tirages).
- **Pur** : `src/data/career/valley.js`, `src/core/career/{valley,heirlooms,habitat}.js` n'importent ni DOM ni horloge.
- **Jour absolu** `absDay(state)` et **saison absolue** `seasonAbs(state)` (lot 3). Durée des saisons 7, 10 ou 14 : les
  temps de la Vallée sont exprimés en saisons ou en aubes (jamais en jours de 7).
- Actions : `{ ok: true, … }` ou `{ ok: false, reason }` (texte français). Identifiants en anglais, textes en français.

### Fichiers

```
src/data/career/valley.js    (nouveau, pur) VALLEY_VERSION, VALLEY_PARTS ['seeds', 'wildlife'], VALLEY_START { rank: 2 },
                             SEED_RULES { jarSeeds 3, boxSeeds 3, handSeeds 2, fixHand 6, fixedSeedFactor 1.25, graftPerBasket 1 },
                             TRAITS (7 : id, name, icon, text, effet chiffré : early 0.15, dry { dry: 1, heat: 0.75 },
                               hardy { winterGrowth: 0.5 }, fine { fine: 0.04, gold: 0.01 }, tasty 0.10, bee { minPlots: 2,
                               perHive: 1 }, giant 2), VARIETIES (12 : id, cropId, name, trait, label, anecdote, icon, ripe,
                               tint), JOSEPH_BOX { varieties: ['bouleDOr', 'coeurDeBoeuf', 'rougeVifDEtampes'], seeds 3,
                               freeHedge: 'start.hedgeL', lines[3] }, NATURE_ITEMS (8 : id, name, icon, price { base, step,
                               max? }, rank, needs?, text, beauty 1), NATURE_SPOTS (par type de terrain → genres
                               d'emplacement), FALLOW { growth 0.10, growthStage4 0.20 }, SPECIES (12 : id, name, icon,
                               seasons, recipe [{ kind, n }], spotKind, service { kind, value, seasons? }, hint, anecdote,
                               firstMet?), ARRIVAL { visibleChance 0.5, maxWait 3, onePerDawn: true }, STAGES (6 : n, id,
                               name, signs, reward { ecus, boon?, cosmeticId? }, chapter { title, lines[3] }), HEDGE_FINDS (4 :
                               id, name, icon, seasons, coins, weight ; chance 0.5, max 3), FAIR_STALL { base 60, perRank 30 },
                               VALLEY_HINTS, textes
src/core/career/heirlooms.js (nouveau, pur, sans enregistrement) varietyOf(plot), traitOf(plot), isTrial(state, plot),
                             growthFactorOf(state, plot), dryGrowthOf(state, plot, crop, heat), survivesFrost(state, plot),
                             winterGrowthOf(state, plot), qualityBonusOf(state, plot, byHand), giantFactorOf(state, plots),
                             priceFactorOf(plot), seedCostOf(state, varietyId), canHelpersSow(state, varietyId),
                             planVariety(plan value) — lus par farm.js, surprises.js, runtime.js, work.js, machines.js
src/core/career/habitat.js   (nouveau, pur) habitatCounts(state), recipeStatus(state, speciesId), speciesSpot(state, id),
                             valleyServices(state), signsOfLife(state), stageFor(signs), nextHint(state), naturePrice(state, kind),
                             spotsOf(state, kind?) (identifiants d'emplacements des terrains possédés, cf. NATURE_SPOTS)
src/core/career/valley.js    (nouveau) extension de carrière id 'valley' (points d'accroche ci-dessous), enregistrée en
                             DERNIER par extensions.js (après cozy)
src/core/career/extensions.js  + registerCareerExtension(valleyExtension) (après cozyExtension)
src/data/album.js            + pages `heirlooms` « Graines anciennes » (12 cases, mode 'career', check { type: 'heirloomFixed',
                             id }) et `wildlife` « Les habitants de la ferme » (12, { type: 'wildlifeInstalled', id }) ;
                             RESERVED_PAGE_IDS garde ses deux identifiants (pages maintenant remplies)
src/core/album.js            + faits `heirloomFixed`, `wildlifeInstalled` (lus dans ctx.career.valley)
src/data/achievements.js     + VALLEY_ACHIEVEMENTS (7, category 'career', écus seulement) ; ALL_ACHIEVEMENTS les inclut
src/data/cosmetics.js        + 3 décors found: true, price 0 : seed.cabinet, nestbox.painted ('small'), valley.linden ('large')
src/data/cozy.js             LANTERN_RULES.career.beautyPoints + { nature: 1, natureMax: 6 } ; paliers de beauté recalibrés
tests/valley.test.js, tests/valley-seeds.test.js, tests/valley-habitat.test.js, tests/valley-migration.test.js (nouveaux)
assets/sprites/generate-valley1.py → assets/sprites/valley1.png + bloc « // <valley1:auto> » d'atlas.js   (ART)
src/ui/career/valley.js, css/valley.css   (UI ; css/valley.css ajoutée à CSS_FILES de tools/build.js)
src/render/valley-actors.js  (RENDER : aménagements, bêtes, indices, cueillette, boîte, planches d'essai, jachères, lisière)
```

Modifiés (CORE, branches gardées par `state.career?.valley`) : `src/core/farm.js` (pousse par parcelle : précoce, sobre,
rustique, sol reposé ; gel ; `clearPlot` efface `variety`, `rested`), `src/core/surprises.js` (`qualityChances` +
`qualityBonusOf` + services ; chance de géant + lièvre et trait géante), `src/core/cozy.js` (trouvailles d'hiver : 4 à la
fois avec le rouge-gorge, pièces × 2 avec l'écureuil), `src/core/career/{runtime,work,machines,events,animals,land,save}.js`,
`tools/{simulate-career,sim-career-staff}.js`, `tests/career-helpers.js` (carrières de test avec `valley: false` par
défaut, comme `surprises`, `variety`, `cozy`).

### Activation et options

```js
createCareer({ …, valley })   // défaut true ; false → state.career.valley = null (gardé tel quel à la reprise)
                              // { seeds, wildlife } → parties à true (absentes = true) — tests et simulation
game.valley                   // booléen (accesseur, comme game.cozy)
```

La Vallée **commence** (`started`) à la première aube où `state.career.rank ≥ VALLEY_START.rank` (2). Avant, l'état existe
(`started: null`) mais rien ne se passe ni ne s'affiche (requête `valley()` → `{ started: null, startsAtRank: 2 }`).

### État (`state.career.valley`, `null` quand c'est désactivé)

```js
state.career.valley = {
  v: 1,
  parts: { seeds: true, wildlife: true },
  started: null | { year, day, abs },        // boîte de Joseph reçue
  stage: 0,                                  // 0..5, jamais en baisse
  chapters: { read: [stageN] },              // chapitres lus (0 = la boîte) ; non lus → ligne « À faire »
  spent: 0,                                  // pièces dépensées (patrimoine : 100 %, fournisseur patrimony)
  jars: { opened: 0 },                       // nombre de bocaux de state.career.heirlooms déjà ouverts (dans l'ordre)
  seeds: { [varietyId]: n },                 // graines gardées (gratuites), avant comme après fixation
  varieties: { [varietyId]: { from: 'box'|'jar'|'fair'|'jay', got: abs, hand: 0, fixedAt: null | abs } },
  nature: { [spotId]: { kind, at: abs } },   // aménagements posés (spotId = '<lotId>.<slot>', ex. 'lot3.hedgeL')
  reserve: { [kind]: n },                    // aménagements retirés par un réaménagement, à replacer gratuitement
  bought: { [kind]: n },                     // nombre ACHETÉ (prix croissants ; la haie offerte n'y compte pas)
  species: { [speciesId]: { state: 'hint' | 'visible' | 'installed', since: abs, spotId: null | spotId, at?: abs } },
  finds: [{ id, kind, spotId, day }],        // cueillette des haies, 3 au plus
  jayYear: 0,                                // année du dernier bocal du geai
  fair: null | { year, varietyId, price, bought: false },   // étal « La grainothèque du pays » de la foire de l'année
  year: { hand: 0, seedsSaved: 0, fixed: 0, installed: 0, placed: 0, finds: 0, jars: 0, base?: … },   // bilan de l'année
  stats: { hand: 0, seedsSaved: 0, observed: 0, placed: 0, jars: 0, fallows: 0, finds: {} },        // cumul : album, succès
  nextId: 1,
}
// Parcelles (carrière, Vallée active) :
//   variety: varietyId      culture semée d'une variété ancienne (p.cropId = la culture) ; effacé par clearPlot
//   lastVariety: varietyId  variété de la dernière récolte (plan « même culture ») ; gardé
//   fallow: seasonAbs       jachère fleurie jusqu'au soir du dernier jour de cette saison (p.cropId = null)
//   rested: true            sol reposé (après une jachère) : la prochaine culture pousse + FALLOW.growth ; effacé à sa récolte
// Arbre isolé : nature['lot5.tree'] = { kind: 'loneTree', at } — adulte quand seasonAbs − saison(at) ≥ 2 (jeune à 1).
```

`check(state) → null | 'problème'` (extension ; `save.js` vérifie les champs de parcelle) : version, identifiants connus
(variétés, traits, aménagements, emplacements ↔ terrains possédés et genre compatible, espèces, trouvailles), entiers ≥ 0,
`jars.opened ≤ heirlooms.length`, `stage` = au plus `stageFor(signsOfLife)`, 3 trouvailles au plus, `variety` sur une
parcelle dont `cropId` = la culture de la variété, `fallow` sur une parcelle sans culture.

### Emplacements (`NATURE_SPOTS`, le cœur ne connaît que les identifiants)

| Terrain (type) | Emplacements (`<lotId>.<slot>`) |
|---|---|
| tout terrain possédé sauf `home` (champ de départ `start` et basse-cour `yard` compris) | `hedgeL`, `hedgeR` (genre `hedge`) |
| `field` (dont `start`) | `strip` (`strip`) ; `start` seulement : `hotel` (`insectHotel`) |
| `meadow` | `nest` (`nestbox`), `pile` (`woodpile`), `tree` (`loneTree`) |
| `orchard` | `nest`, `pile`, `hotel` |
| `workshops` | `hotel` |
| `wild` (friche) | `pile`, `tree` |
| `pond` | `reeds` (`reeds`) |
| `yard` | `nest`, `pile` |
| `home` | `nest` ; `owl` (`owlbox`, seulement si le grenier est construit) |
| `greenhouse` | (les haies seulement) |

Un réaménagement (`developLot`) garde `hedgeL` / `hedgeR` ; les autres aménagements du terrain passent dans `reserve`
(événement `natureReserved`). Les recettes comptent aussi : `pond` (terrain mare), `orchard` (un verger), `wildGround`
(terrain en friche ou parcelle en jachère), `bigShelter` (étable, écurie, bergerie ou chèvrerie construite), `treeAdult`
(chêne isolé adulte ou pommier adulte), `flowers` (bandes fleuries + jachères + parcelles mellifères en pousse),
`cropsGrowing` (cultures différentes en pousse dans les champs).

### Déroulé (extension `valley`, enregistrée après `cozy`)

- **`dawnEvents`** (après la météo, flux `valley`) :
  1. pas commencée et rang ≥ 2 → **début** : `started`, graines de la boîte, haie offerte (`start.hedgeL`, si libre ;
     sinon le premier emplacement de haie libre), `valleyStarted` ;
  2. **saison nouvelle** : jachères échues (`fallow < seasonAbs`) → `fallow` effacé, `rested = true` (`fallowEnded`) ;
     1ᵉʳ jour d'automne : geai installé et `jayYear < année` → un bocal ajouté à `state.career.heirlooms` (`{ cropId, lotId:
     'home', year, day, from: 'jay' }`, culture tirée au moment de l'ouverture), `jayYear = année`, `jayGift` ;
     dernier jour d'hiver (foire aux graines, `seedFair` du lot 4) : étal tiré (1 nombre) → `fair` ;
  3. **espèces** (12 nombres) : pour chaque espèce non installée, dans l'ordre des données — `visible` : rien ;
     `hint` : nombre < 0,5 ou `abs − since ≥ maxWait − 1` → `visible` (emplacement `speciesSpot`), `speciesVisible` ;
     sans état : recette remplie et saison d'arrivée, et aucune autre espèce passée à `hint` cette aube → `hint`
     (`speciesHint { id, spotId, text }`) ;
  4. **cueillette des haies** (étape ≥ 2, été ou automne ; 3 nombres) : si moins de 3 trouvailles et une haie posée,
     chance 0,5 → une trouvaille de saison sur une haie (`hedgeFinds`).
- **`dawn`** (fin de l'aube) : étape (`stageFor(signsOfLife)`, jamais en baisse) → `valleyStage { n, name, reward,
  chapter }` (écus versés par l'interface ; décor de l'étape 5 débloqué par la progression).
- **`incomes`** : trait mellifère (≥ 2 parcelles mellifères en pousse, hors hiver) → `{ source: 'valleyBees', amount: min(
  ruches, …) × 1, kind: 'valley', key: 'honey' }`.
- **`evening`** : dernier soir d'une saison : rien ne part (les bêtes `visible` attendent, les trouvailles des haies restent
  jusqu'à la fin de l'automne, effacées au 1ᵉʳ jour d'hiver).
- **`yearEnd`** : `report.valley = { stage, year: {…}, installed: [id], fixed: [id] }`, compteurs `year` remis à zéro.
- **Fournisseurs** : `effects(state, 'growthBonus')` (bourdons 0,03 hors hiver ; grenouilles 0,10 les jours de pluie ou
  d'orage) ; `effects(state, 'animalBonus')` (hirondelles 0,05 au printemps et en été ; **clé nouvelle**, lue par
  `animals.js`) ; `effects(state, 'touristBonus')` (paon-du-jour 0,15 ; **clé nouvelle**, lue par `events.js`) ;
  `patrimony(state)` → `valley.spent` (100 %) ; `unlocks(rank)` → aménagements du rang (rang 2 : haie, bande, nichoir, tas,
  hôtel, nichoir à chouette ; rang 3 : chêne, berges).
- **Lus directement** (gardés par `state.career?.valley`) :
  - `runtime.js` — récolte (normale et géant) : `harvestAmount` × `priceFactorOf(p)` (savoureuse) ; une parcelle à
    `variety` ne va **jamais au grenier** (`wouldStore` faux) ; **avant `clearPlot`**, `valleyHarvest(api, plotIndex, by)`
    (exporté par `valley.js`) : à la main → `seeds[v] += handSeeds`, `hand += 1`, fixation à `fixHand` (`heirloomFixed`),
    événement `heirloomHarvest` ; `p.lastVariety = v` ; arbre : un greffon par panier. Plantation : action `sowHeirloom` ;
    `plant` (culture ordinaire) sur une jachère l'arrête, sans sol reposé (`fallowCancelled`). `plantableCrops(i)` : + `heirlooms` ; `query.plot(i)` : + `variety`, `fallow`, `rested`.
  - `work.js`, `machines.js` (semis) : jamais sur une parcelle en `fallow` ; plan `'heirloom:<id>'` ou `'same'` avec
    `lastVariety` **fixée** → semis de la variété (prix `seedCostOf`, graines gardées d'abord) ; une variété **non fixée**
    n'est jamais semée par l'équipe ni le semoir (plan `'same'` → la culture ordinaire).
  - `farm.js` : pousse × `growthFactorOf(p)` (précoce 1,15 ; sol reposé 1,10 / 1,20) ; pousse sans arrosage
    `dryGrowthOf` (sobre) ; `applyFrost` épargne `survivesFrost(p)` (rustique, hors serre) ; en hiver, pousse ×
    `winterGrowthOf(p)` (0,5) ; `clearPlot` efface `variety` et `rested`.
  - `surprises.js` : `qualityChances` + `qualityBonusOf(state, p, byHand)` (généreuse ; hérisson à la main ; coccinelles,
    étape 3 pour tous) ; chance de géant + 0,015 (lièvre) et × 2 si les 4 parcelles sont d'une variété géante.
  - `events.js` (carrière) : poids des corbeaux × 0,5 (chouette) ; valeur des poissons × 1,25 (libellules) ; touristes ×
    (1 + `touristBonus`).
  - `cozy.js` : trouvailles d'hiver : 4 à la fois (rouge-gorge), pièces × 2 (écureuil).
  - Lanternes (beauté, carrière) : `nature` = aménagements posés (6 au plus).

### Actions (`game.actions.career.*`, seulement quand la Vallée est commencée)

```js
openJar()                          → { ok, index, varietyId, name, trait, seeds, isNew, label, cropId }
    // le plus ancien bocal pas encore ouvert ; refus : 'Aucun bocal à ouvrir.'
sowHeirloom(plotIndex, varietyId)  → { ok, plotIndex, varietyId, cropId, cost, fromSeeds, seedsLeft, fallowCancelled }
    // refus : 'Variété inconnue.' ; 'Parcelle inexistante.' ; 'Cette parcelle n'est pas libre.' ;
    //   '{Culture} ne se sème pas en {saison}.' ; 'Plus de graines de {nom} : récoltez-en une à la main.' (non fixée) ;
    //   notEnoughMoney(n) (fixée) ; pommier : 'Un greffon se plante dans un verger.'
sowFallow(plotIndex)               → { ok, plotIndex, until /* seasonAbs */ }
    // refus : 'Une jachère se fait sur une parcelle de champ vide.' ; 'Déjà en jachère.'
placeNature(spotId, kind?)         → { ok, spotId, kind, cost, fromReserve }
    // refus : 'Emplacement inconnu.' ; 'Déjà aménagé.' ; 'Cet aménagement ne va pas ici.' ; 'Rang N requis' ;
    //   'Construisez d'abord le grenier.' ; notEnoughMoney(n)
observe(speciesId)                 → { ok, speciesId, name, service: { kind, value, text }, first: true }
    // refus : 'Rien à observer ici.' (pas visible) ; 'Déjà installé.'
pickHedgeFind(findId)              → { ok, kind, name, amount }               // refus : 'Rien à cueillir ici.'
buyFairHeirloom()                  → { ok, varietyId, seeds, cost }           // dernier jour d'hiver
    // refus : 'La foire aux graines n'est pas aujourd'hui.' ; 'Déjà acheté cette année.' ; 'Toutes les variétés du pays sont
    //   déjà chez vous.' ; notEnoughMoney(n)
readChapter(n)                     → { ok, chapter: { n, title, lines } }     // refus : 'Chapitre inconnu.'
triggerValley(kind, arg?)          → { ok, … }   // DÉBOGAGE / tests : 'start', 'jar' (cropId), 'seeds' (varietyId, n),
                                                 //   'fix' (varietyId), 'visible' (speciesId), 'install' (id), 'stage' (n),
                                                 //   'finds', 'fair', 'tree' (spotId → adulte)
// Modifiées : plant(i, cropId) sur une jachère l'arrête (→ planted + fallowCancelled: true) ;
//   setPlan(lotId, seasonId, 'heirloom:<id>') accepté pour une variété fixée ; developLot → natureReserved.
```

Dépenses : `api.spend('valley', cost)` (poste « La Vallée » du bilan, `SPENT_LABELS.valley`) et `valley.spent += cost` ;
cueillette : `api.earn('valley', amount)` (`INCOME_LABELS.valley`), × `careerFactor(rang)` comme les fêtes.

### Requêtes (`game.query.career.*`)

```js
valley() → null | { started: null, startsAtRank: 2 } | {
  started, parts,
  stage: { n, name, signs, next: null | { n, name, signs }, vignette: 'valley.stage.<n>', reward },
  hint: null | { kind: 'observe' | 'jar' | 'trial' | 'recipe' | 'seeds' | 'stage' | 'chapter', text, icon,
                 target: null | { type: 'species' | 'plot' | 'spot' | 'lot' | 'nature', id } },
  chapters: [{ n, title, lines, read, available }],
  jars: { pending, list: [{ index, cropId, label, from }] },
  varieties: [varietyInfo], species: [speciesInfo], nature: { items: [natureInfo], free: n },
  finds: [{ id, kind, name, icon, spotId }],
  fair: null | { varietyId, name, icon, trait, seeds, price, canBuy, reason },
  services: [{ id /* espèce, étape ou trait */, text }],
  year, stats, spent }
  varietyInfo = { id, cropId, name, icon, ripeIcon, trait: { id, name, icon, text }, state: 'unknown' | 'seeds' | 'fixed',
                  seeds, hand, need, label, anecdote /* connue */, hint /* inconnue */, growing, seedCost /* fixée */ }
  speciesInfo = { id, name, icon, seasons, state: 'unknown' | 'hint' | 'visible' | 'installed', inSeason,
                  recipe: [{ kind, n, have, ok, text }], service: { kind, value, text }, spotId, where /* « près de la haie
                  du Haut-Champ » */, hint, anecdote /* installée */, firstMet /* « Déjà vu à la mangeoire » */ }
  natureInfo  = { kind, name, icon, text, price, rank, locked, reason, placed, freeSpots, reserve }
valleySpots(kind?) → [{ spotId, lotId, lotName, slot, kind, placed: null | kind, free, price, canPlace, reason }]   // mode aménagement
valleyAnimals() → [{ id, spotId, state: 'hint' | 'visible' | 'resident' }]   // rendu : indices, bêtes à voir, habitants du jour
    // 'resident' : installée, en saison, présente aujourd'hui = hachage pur (absDay, id) — sans flux aléatoire, 6 au plus
query.plot(i)          // carrière : + variety: null | { id, name, icon, trait, trial, hand, need, seedsOnHand: 2 },
                       //   fallow: null | { until, text }, rested
query.plantableCrops(i?)   // carrière : + heirlooms: [{ varietyId, cropId, name, icon, trait, seeds, fixed, cost, canSow, reason }]
                           //   + fallow: { canSow, reason } (ligne « Jachère fleurie »)
query.achievementContext() // carrière : career.valley = { fixed: [id], installed: [id], stage, jars, hand }
query.career.yearReport()  // + valley
query.career.lot(id)       // + nature: [{ spotId, slot, kind, placed }]
```

### Événements (seulement quand la Vallée est active)

| Type | Données | Pour |
|---|---|---|
| `valleyStarted` | `{ box: [{ varietyId, name, seeds }], hedge: spotId, chapter: { lines } }` | fenêtre « La boîte en fer », boîte sur le perron, haie qui pousse, conseil `valley.box` |
| `jarOpened` | `{ index, varietyId, name, trait, seeds, isNew, label }` | couvercle qui saute, étiquette complétée |
| `heirloomSown` | `{ plotIndex, varietyId, fromSeeds, seedsLeft }` | étiquette de la planche d'essai |
| `heirloomHarvest` | `{ plotIndex, varietyId, seeds, hand, need, by }` | « + 2 graines » (texte flottant), barre de fixation |
| `heirloomFixed` | `{ varietyId, name, trait }` | message « … est sauvée ! », album, conseil `valley.fixed` |
| `naturePlaced` / `natureReserved` | `{ spotId, kind, cost, fromReserve }` / `{ lotId, kinds: [kind] }` | l'aménagement pousse (fondu) / message |
| `fallowSown` / `fallowEnded` | `{ plotIndex, until }` / `{ plots: [index] }` | fleurs sur la parcelle / « sol reposé » |
| `speciesHint` | `{ id, spotId, text }` | résumé du matin, indice dessiné à l'emplacement |
| `speciesVisible` | `{ id, spotId, where }` | bête + étincelle, ligne « À faire » |
| `speciesInstalled` | `{ id, name, service, first }` | fenêtre d'observation, album, succès |
| `valleyStage` | `{ n, name, reward, chapter: { title, lines } }` | lisière, ambiance, écus et décor (progression), chapitre à lire |
| `hedgeFinds` / `hedgePicked` | `{ finds: [{ id, kind, spotId }] }` / `{ id, kind, name, amount }` | étincelle sur la haie / panier |
| `jayGift` | `{ index }` | message « Le geai a oublié un bocal au pied du chêne » |
| `fairHeirloomBought` | `{ varietyId, seeds, cost }` | sachet qui saute |
| `harvested` | + `variety`, `seeds` (carrière) | texte flottant |
| `planted` | + `variety`, `fallowCancelled` | — |

### Progression (album et succès)

- `albumFacts` lit `ctx.career.valley.fixed` / `installed` (types `heirloomFixed`, `wildlifeInstalled`). Les deux pages
  sont en mode `'career'` (« À découvrir dans Ma ferme » dans les niveaux) ; récompenses : 30 écus + `seed.cabinet` /
  30 écus + `nestbox.painted`. Rien à rattraper.
- `VALLEY_ACHIEVEMENTS` : `valleyBox`, `firstSaved`, `seedKeeper`, `firstNeighbour`, `welcomingFarm`, `valleySings`,
  `seedHands` (conditions : `careerValley { key, n }` sur `ctx.career.valley` ; 155 écus).
- Écus des étapes (`valleyStage.reward.ecus`) → `progression.careerEcus` (comme `feteDone`) ; décor de l'étape 5
  (`valley.linden`) débloqué par `recordValleyStage(progress, n)` (nouveau, pur) qui renvoie la progression à jour.

### Migration et sauvegardes

- Extension `valley` — `init` (création) et `migrate` (chargement) : `state.career.valley` absent → créé (`started:
  null`, `jars.opened: 0`) + flux `valley` ; carrière au rang ≥ 2 : la boîte à la première aube ; bocaux déjà trouvés à
  ouvrir. `CAREER_VERSION` inchangée ; `save.js` accepte `variety`, `lastVariety`, `fallow`, `rested` sur les parcelles.
- `v` de `state.career.valley` : 1 (le V2 complète en 2, etc. ; rien n'est retiré).
- Progression : pages et succès ajoutés par `normalizeProgress` (schéma inchangé).
- Tests : `tests/career-helpers.js` crée ses carrières avec `valley: false` par défaut ; `tests/valley-migration.test.js` :
  aller-retours, carrière d'avant la Vallée (lots 3 et 4, avec bocaux), rang 1 / rang 3, `check`, parité des niveaux.

### Simulation

- `tools/simulate-career.js` : `--valley on | off | seeds,wildlife` (défaut : on), **`--compare-valley`** (sans → avec, même
  graine : revenu par année, rang médian, Domaine, dépenses de la Vallée, nouveautés par saison, collection par année
  (variétés fixées, habitants, étape), gestes par jour, part à la main, `handsOff`, `automator`, débutant), `--years 20`
  pour les cibles d'ensemble ; comportements des robots : `docs/VALLEE.md` § 12.4, par l'API publique et un tirage propre
  (`me.valleyRnd`) pour que les autres décisions restent identiques avec ou sans la Vallée ; `--lanterns` (beauté).
- Après réglage : `SEED_RULES`, services, prix, paliers de beauté, tableaux de `docs/VALLEE.md` § 12 remplis.

### Ce que RENDER et UI consomment

**RENDER** (`src/render/*`) :
- Disposition : `layout.valley = { spots: { [spotId]: { x, y, w, h, kind } } (un rectangle pour **chaque** identifiant que
  `valleySpots()` peut renvoyer : haies = colonne x 0 / x 13 du bloc, lignes 0 à 9 ; bande fleurie = la ligne sous les
  parcelles, dans la clôture ; nichoir, tas, hôtel, chêne, berges, nichoir à chouette = tuiles libres du gabarit), box:
  rect (perron, sans couvrir la porte ni le porte-lanternes), animalAnchors: { [spotId]: { x, y } } }`. Test : aucun
  emplacement ne chevauche une parcelle, un chemin, un bâtiment, une ruche, un emplacement de décor (`lotN.corner`) ni l'aire
  des machines ; tous ≥ 48 px CSS une fois agrandis pour le doigt.
- Scène : haies en autotuile par saison (fleurs au printemps, baies à l'automne, nues en hiver) ; bandes fleuries par saison ;
  aménagements ; chêne selon son âge ; parcelles en jachère (`nature.fallow.<saison>`) ; étiquette `valley.label` sur les
  planches d'essai ; dessin mûr et icône des variétés (`heirloom.<id>.4`, repli : la culture teintée par `tint`) ; bêtes
  (`wild.<id>`, 2 images) : `visible` avec étincelle « ? », `resident` en promenade douce (6 au plus) ; indices
  (`wild.hint.*`) le jour de `speciesHint` ; trouvailles des haies (étincelle) ; boîte en fer sur le perron.
- **Lisière selon l'étape** : `scene.setValleyStage(n)` — fleurs sur les tuiles de forêt qui bordent la ferme (étapes 2 et
  4), oiseaux qui traversent le ciel (`fx.birds` : 0, 1, 2, 3, 4, 5 vols par minute de l'étape 0 à 5), papillons l'été
  (étape ≥ 3) ; mouvements réduits : rien ne traverse, fleurs fixes.
- `scene.hitTest` : + `{ type: 'wildlife', id }` (bête `visible`), `{ type: 'hedgeFind', id }`, `{ type: 'valleyBox' }`,
  `{ type: 'natureSpot', spotId }` (seulement en mode aménagement : `scene.setValleyPlacing(kind | null)`, qui fait pulser
  les emplacements libres du genre ; seuls ces cibles et le défilement répondent).
- `getMinimap` : en mode aménagement, point sur les terrains qui ont un emplacement libre.
- **Zoom de la scène** (section « Zoom de la scène » ci-dessus) : bêtes, trouvailles, boîte et emplacements passent par
  `screenToWorld` / `worldToScreen` au zoom courant, cibles agrandies à `minWorld = 48 × dpr / zoom` ; en mode aménagement,
  les boutons + / − restent utiles (dézoomer pour voir tous les emplacements, zoomer pour viser).
- Nouvelle planche `valley1` dans `SHEETS` et `assets.js` (facultative, comme `lot4`) ; `DECOR_SPRITES` : les 3 décors.

**UI** (`src/ui/career/valley.js`, `css/valley.css`, `src/main.js`) :
- `createValley(app) → app.valley = { open(tab?), openJar(), enterPlacing(kind), leavePlacing(), onEvent, onHit(hit),
  todoItems(game), morningLines(ev), plotRows(plot), seedRows(crops), lotSection(lot), yearBlock(report), frame(), reset() }`.
- Fiche « La Vallée » (feuille haute, pause pendant la lecture) : en-tête (vignette, étape, signes de vie lus), carte « Le
  prochain indice », segments **Graines · Habitants · Aménager** (maquettes : `docs/VALLEE.md` § 10). Entrées : boîte du
  perron, carte « La Vallée » en tête du Carnet › Ferme, ligne « À faire », menu de partie.
- Mode aménagement (comme le mode décoration : `body.in-valley-place`, barre `#vl-placebar` « 🌿 Haie champêtre · 280 ·
  Touchez un emplacement · Terminer » à la place des onglets) ; petite feuille de confirmation.
- Fenêtres : « La boîte en fer » (`valleyStarted`), ouverture d'un bocal, observation (`speciesInstalled`), chapitre
  (`readChapter`) ; section « Nature » de la fiche d'un terrain ; lignes de la fiche de parcelle ; section « Graines
  anciennes » et ligne « Jachère fleurie » de la feuille des graines (« Semer partout » avec un stock) ; choix d'une variété
  fixée dans le plan de culture ; étal « La grainothèque du pays » dans la feuille de la foire (lot 4) ; bloc du bilan
  annuel.
- Ligne « À faire » (`vl-observe`, `vl-jar`, `vl-trial`, `vl-chapter`) ; résumé du matin (indices, graines gardées hier).
- Récompenses : `valleyStage.reward.ecus` → `progression.careerEcus` ; `recordValleyStage` ; album à chaque aube (règle du
  lot 4).
- Conseils « première fois » : `valley.box`, `valley.jar`, `valley.trial`, `valley.nature`, `valley.species`,
  `valley.fixed`, `valley.fallow`, `valley.stage` (textes dans `VALLEY_HINTS`).
- Sons (synth existant) : `pop` bocal et cueillette, `chime` variété sauvée, `magic` chapitre, `reveal` étape, **`chirp`**
  (lot 4) bête observée ; aucun fichier son en V1.
- Débogage (`?debug=1`) : `__debug.valley.{ on(), state(), start(), jar(cropId), seeds(id, n), fix(id), visible(id),
  install(id), stage(n), finds(), fair(), tree(spotId), place(kind), point(kind, id) }` (passent par `triggerValley` et les
  actions publiques).

### Sprites (paquet ART : planche `assets/sprites/valley1.png`, `assets/sprites/generate-valley1.py`, bloc `// <valley1:auto>`)

Même méthode que `generate-lot4.py` (palette Kenney, contour sombre (63, 38, 49), lumière en haut à gauche ; tuiles de
16 px). Tailles : **16 × 16** sauf mention. Les cultures de base, Joseph (`portrait.joseph`), le bocal (`item.heirloom`,
`find.seedjar`), le hérisson et le renard du lot 2, le rouge-gorge du lot 4 (`bird.robin`) sont **réutilisés** quand ils
conviennent ; seuls les manquants sont dessinés ici.

| Nom(s) | Taille | Description |
|---|---|---|
| `heirloom.<id>.icon` (jauneDuDoubs, bouleDOr, rougeDeBordeaux, milanDePontoise, coeurDeBoeuf, grandRouxBasque, soleilDOr, vitelotte, reineDesVallees, rondeDeNice, rougeVifDEtampes, calvilleBlanc) | 16 × 16 | icônes : carotte jaune pâle ; navet doré ; gerbe de blé roux ; chou de Milan vert sombre cloqué ; grosse tomate côtelée rouge sombre ; épi de maïs roux-orangé ; tournesol à cœur brun et pétales or vif ; pomme de terre violette allongée ; petites fraises des bois coniques ; courgette ronde vert pâle ; citrouille aplatie rouge-orangé côtelée ; pomme jaune-vert côtelée |
| `heirloom.<id>.4` (les 11 cultures) | 16 × 16 | stade mûr sur la parcelle (même cadrage que `crop.<id>.4`, couleurs de la variété) |
| `heirloom.rougeVifDEtampes.giant` | 32 × 32 | citrouille géante rouge vif, côtes marquées |
| `heirloom.calvilleBlanc.fruit` | 16 × 16 | pommes jaune-vert côtelées, posées par-dessus le pommier adulte (`tree.apple.*`) |
| `wild.<id>`, `wild.<id>.1` (robin, hedgehog, ladybird, bumblebee, butterfly, swallow, tawnyOwl, frog, dragonfly, hare, squirrel, jay) | 16 × 16 | 2 images, regard vers la gauche : rouge-gorge (si `bird.robin` ne suffit pas), hérisson qui trottine, trio de coccinelles sur une feuille, bourdon rayé ailes floues, paon-du-jour ailes ouvertes / fermées, hirondelle en vol (ailes en faux), chouette hulotte brune aux yeux noirs (yeux ouverts / clignés), grenouille rousse assise / sautant, libellule bleue ailes en croix, lièvre aux longues oreilles assis / bondissant, écureuil roux queue en panache, geai à la tache bleue sur l'aile |
| `wild.hint.tracks`, `wild.hint.feather`, `wild.hint.eggs`, `wild.hint.nuts`, `wild.hint.note` | 16 × 16 | indices : empreintes dans l'herbe ; plume bleue ; grappe d'œufs de grenouille dans l'eau ; noisettes rongées ; petite note de musique (chant, hululement, bourdonnement) |
| `nature.hedge.<saison>.top`, `.mid`, `.bot` (spring, summer, autumn, winter) | 16 × 16 | haie champêtre verticale (aubépine, noisetier, églantier) : fleurs blanches et roses au printemps, vert dense l'été, baies rouges et noires à l'automne, branches nues givrées l'hiver ; 3 tuiles qui se raccordent (haut, milieu répétable, bas) |
| `nature.strip.<saison>`, `nature.strip.<saison>.1` | 16 × 16 | bande fleurie horizontale répétable (2 variantes) : coquelicots et bleuets ; marguerites ; asters mauves ; graines sèches dorées |
| `nature.nestbox` | 16 × 16 | nichoir en bois sur poteau, trou rond, petit toit |
| `nature.owlbox` | 16 × 16 | grande caisse-nichoir accrochée sous un pignon, ouverture carrée |
| `nature.woodpile` | 16 × 16 | bûches moussues et pierres sèches empilées |
| `nature.insectHotel` | 16 × 32 | petite maison à toit de bois, tiroirs de tiges creuses, pommes de pin et briques percées |
| `nature.reeds`, `.reeds.1`, `.reeds.2` | 16 × 16 | roseaux et iris jaunes en bord d'eau (3 variantes à poser sur l'autotuile de la mare) |
| `nature.oak.sapling`, `nature.oak.young` | 16 × 16 · 16 × 32 | jeune plant tuteuré ; jeune chêne |
| `nature.oak.<saison>` (spring, summer, autumn, winter) | 32 × 48 | chêne adulte isolé : vert tendre, vert profond, roux et glands, nu sous la neige |
| `nature.fallow.<saison>` | 32 × 32 | parcelle en jachère fleurie (dessinée sur la terre labourée) : coquelicots ; phacélie bleue ; trèfle et marguerites ; couvert vert sous le givre |
| `nature.edge.flowers.0` … `.2` | 16 × 16 | fleurs sauvages à poser sur les tuiles de lisière de la forêt (étapes 2 et 4) |
| `hedgefind.blackberry`, `.elderflower`, `.sloe`, `.hazelnut` | 16 × 16 | grappe de mûres ; ombelle de fleurs de sureau ; prunelles bleu-noir ; noisettes dans leur collerette |
| `valley.box`, `valley.box.open` | 16 × 16 | boîte à biscuits en fer cabossée, peinte de fleurs passées ; ouverte, sachets de papier dedans |
| `valley.label` | 8 × 8 | petite étiquette de bois plantée (planche d'essai) |
| `seedpack.heirloom` | 16 × 16 | sachet de papier kraft fermé d'une ficelle rouge, dessin de graine |
| `story.box` | 48 × 32 | vignette : Joseph ouvre la boîte en fer sur la table de la cuisine, sachets et vieille photo |
| `valley.stage.0` … `.5` | 96 × 48 | la même vallée vue de loin, du gris-brun (champs nus, ruisseau sec, arbres morts) au vert vivant (haies, fleurs, oiseaux) : une vignette par étape |
| `icon.valley`, `icon.signs` | 16 × 16 | feuille de tilleul et petit oiseau ; jeune pousse dans un cercle (signes de vie) |
| `icon.trait.<id>` (early, dry, hardy, fine, tasty, bee, giant) | 16 × 16 | horloge ; goutte barrée ; flocon ; étoile ; cœur ; abeille ; losange (lisibles en niveaux de gris) |
| `icon.nature.<kind>` (hedge, strip, nestbox, owlbox, woodpile, insectHotel, loneTree, reeds, fallow) | 16 × 16 | pictos des aménagements pour l'interface |
| `fx.birds`, `fx.birds.1` · `fx.butterfly`, `fx.butterfly.1` | 16 × 16 · 8 × 8 | vol de 3 oiseaux en silhouette (2 images) ; papillon (2 images) |
| `album.page.heirlooms`, `album.page.wildlife` | 16 × 16 | onglets de page : sachet de graines ; empreinte de hérisson |
| `decor.seed.cabinet`, `decor.nestbox.painted` | 16 × 16 | semainier à graines (petit meuble à tiroirs étiquetés) ; nichoir peint de fleurs |
| `decor.valley.linden` | 32 × 32 | le tilleul de la vallée : grand tilleul en fleurs, banc à son pied |
| `icon.ach.<id>` (valleyBox, firstSaved, seedKeeper, firstNeighbour, welcomingFarm, valleySings, seedHands) | 16 × 16 | icônes des 7 succès (+ versions grisées par le code) |

`CREDITS.md` : planche dessinée pour le jeu, style Kenney (CC0), comme `lot4.png`.

### Découpage en 3 paquets parallèles

| Paquet | Possède (seul à modifier) | Livre | Attend |
|---|---|---|---|
| **CORE** | `src/data/career/valley.js`, `src/core/career/{valley,heirlooms,habitat}.js`, `src/core/career/extensions.js` (1 ligne), `src/data/{album,achievements,cosmetics,cozy}.js` (ajouts ci-dessus), `src/core/album.js`, `src/core/progression.js` (`recordValleyStage`), modifications de `src/core/{farm,surprises,cozy}.js` et `src/core/career/{runtime,work,machines,events,animals,land,save}.js`, `tools/{simulate-career,sim-career-staff}.js`, `tests/*` (nouveaux et `career-helpers.js`) | état, actions, requêtes, événements, progression ; simulation et réglage ; tableaux de `docs/VALLEE.md` § 12 | rien (commence par une extension qui ne fait rien, parité verte, puis : graines → traits → aménagements → espèces → étapes) |
| **ART** | `assets/sprites/generate-valley1.py`, `assets/sprites/valley1.png`, bloc `// <valley1:auto>` d'`atlas.js`, `CREDITS.md` | planche et noms du tableau des sprites ; planche de contrôle × 6 | rien |
| **UI/RENDER** | `src/ui/*` (nouveau `src/ui/career/valley.js`), `css/valley.css`, `tools/build.js` (ligne `CSS_FILES` seulement), `src/main.js`, `src/index.template.html`, `src/render/*` (hors bloc `valley1:auto`), nouveau `src/render/valley-actors.js` | fiche « La Vallée », mode aménagement, fenêtres, lignes des fiches existantes, scène, lisière, hit-test, conseils, débogage ; vérification au doigt | CORE : API (factices de même forme en attendant) ; ART : sprites (repli `canDraw` / `spriteAny`) |

Points de contact : (1) **CORE → UI/RENDER** : formes `varietyInfo`, `speciesInfo`, `natureInfo`, `valleySpots()`,
`valleyAnimals()`, `query.plot(i).variety` / `.fallow`, l'ordre des événements de l'aube (`valleyStarted`, `fallowEnded`,
`jayGift`, `speciesHint` / `speciesVisible`, `hedgeFinds`, puis `valleyStage` en fin d'aube), les types de `hitTest` (figés
ici ; tout écart est noté par CORE dans une section « Écarts » sous ce contrat) ; (2) **ART → RENDER/UI** : noms du
tableau des sprites ; (3) **CORE ↔ ART** : identifiants des variétés, traits, aménagements, espèces, trouvailles, étapes,
décors (figés ici et dans `docs/VALLEE.md`) ; (4) **RENDER ↔ CORE** : identifiants d'emplacements `<lotId>.<slot>` (le cœur
les liste par `NATURE_SPOTS`, RENDER seul connaît leur position ; test commun : chaque identifiant a un rectangle) ;
(5) intégration par le chef de projet : `node --test tests/` (parité comprise), `node tools/simulate-career.js
--compare-valley` et `--lanterns`, `node tools/simulate.js` (identique), `node tools/build.js`, vérification au doigt
(Pixel 7, 360 × 740 : cibles ≥ 48 px, textes ≥ 14 px ; une carrière d'avant la Vallée reprise au rang 3 avec des bocaux ;
la boîte, un bocal ouvert, une planche d'essai fixée, une haie et un tas de bois posés, le rouge-gorge observé, une
jachère, une étape et son chapitre ; une partie de niveau Classique identique), `JOURNAL.md`, sauvegarde `backup/…` avant
et après le lot.

### Aperçu des lots suivants (contrats à écrire au début de chaque lot)

- **V2 « Le troc et les croisements »** — *contrats écrits : section « Vallée vivante — contrats du lot V2 » (plus bas),
  qui remplace cet aperçu (Grainothèque dans la bande de la maison, croisements déterministes, flux `valley2`)* :
  `state.career.valley.v = 2` ; bâtiment `seedLibrary` (5 niveaux, sur un
  emplacement de pré, de basse-cour ou de cour des ateliers : `build(lotId, slot, 'seedLibrary')`) ; `swaps` (troc :
  `actions.career.swapSeeds(clientId, varietyId)`), `CLIENT_VARIETIES` (12), `CROSSES` (table fixe, 11 variétés croisées
  nommées d'après `farmName`, 2 traits), règle de voisinage dans le cœur (`crossCheck` à la récolte à la main, flux
  `valley`), trait `scented` (l'atelier garde `variety` dans ses places), 4 habitants (`wildBee`, `blackbird`, `lizard`,
  `bat`) et l'aménagement `batbox` ; pages d'album `swaps`, `crosses`, `wildlife2` ; épreuve du comice, point du stand,
  quête de Joseph ; planche `valley2.png`.
- **V3 « Le ruisseau »** : `state.career.valley.places = { [placeId]: { step, startedAt, readyAt } }` (6 lieux, 4 étapes),
  `actions.career.startWorks(placeId)` ; `state.career.valley.wilds = { [cellId]: { kind: 'wood' | 'marsh' | 'meadow',
  at } }` pour les **terres sauvages** (cases de forêt de `grid()`, seulement à 16 terrains), `actions.career.rewild(col,
  row, kind)` ; nouvelle vue plein écran `src/ui/career/valley-view.js` + `src/render/valley-view.js` (canevas en portrait,
  panorama en couches, défilement vertical, cibles des lieux) ; cultures-arbres `VALLEY_TREES` (cerisier, poirier, reinette)
  **hors de `CROPS`** ; 10 habitants de la vallée ; étapes 6 et 7 ; thème `valley` (lot 3) ; pages `valleyWild`, `places` ;
  planche `valley3.png`.
- **V4 « Les cigognes »** : légendes (`LEGENDS`, 3ᵉ génération, melon de la mère de Joseph), visiteurs rarissimes, étape
  8, forêt de la carte en 4 états (RENDER), ambiance sonore en couches (sons CC0), « avant / après » au bilan (vignettes
  composées par RENDER), page `legends` ; aucun effet sur le revenu ; planche `valley4.png`.

### Écarts et précisions (livraison CORE V1)

Section tenue par le paquet CORE **pendant** la livraison (UI/RENDER et ART travaillent en parallèle) : tout ce qui
précise ou s'écarte du contrat ci-dessus. Aucun nom ni forme du contrat n'est retiré ; seulement des champs **ajoutés**,
sauf mention contraire. Chiffres réglés : `src/data/career/valley.js` et `docs/VALLEE.md` § 12.

**Fichiers et enregistrement**
- `src/core/career/valley.js` ne s'enregistre pas lui-même : `extensions.js` l'importe et l'enregistre **après** `cozy`
  (comme `variety` et `cozy`). Exporte aussi `valleyHarvest`, `valleySow`, `heirloomSeedCost`, `valleyPlotExtras`,
  `valleyPlantable`, `valleyAchievementContext`, `lotNature`, `careerValleyYear`, `enableCareerValley`, `checkValley`.
- `src/core/career/heirlooms.js` : en plus du contrat, `valleyOf`, `valleyStarted`, `partOn`, `seasonAbs`,
  `isFixed`, `speciesInstalled`, `stageOf`, `giantBonusOf`, `fixedSeedCost(prixDuJour)`, services lus par les modules
  partagés (`winterFindsMax`, `winterCoinsFactor`, `crowWeightFactor`, `fishFactor`, `touristBonusOf`,
  `animalBonusOf`, `growthBonusOf`). `priceFactorOf(state, plot)` prend l'état (contrat : `priceFactorOf(plot)`).
  `seedCostOf` du contrat = `heirloomSeedCost(api, varietyId)` (valley.js : il lui faut le prix du jour de la culture).
- `src/core/career/habitat.js` : en plus, `spotDef`, `whereText`, `spotLabel`, `ofLot`, `loneTreeStage`,
  `reserveLotNature`, `fallowPlots`, `beePlotsGrowing`, `installedSpecies`, `fixedVarieties`, `natureBeauty`,
  `seasonsText`, `inSeason`, `granaryBuilt`.
- Fichiers partagés touchés en plus de la liste : `src/core/career/crew.js` (`sowChoice` : jamais sur une jachère ;
  variété fixée → `'heirloom:<id>'`), `src/core/career/handwork.js` (une variété rustique ne « gèlerait » pas le dernier
  jour d'automne), `src/core/game.js` (`game.valley`, lignes de `plantableCrops`, `achievementContext`).

**Règles précisées**
- **Semis** : `api.plant(i, 'heirloom:<id>', { by })` sème une variété (plan de culture, semoir, jardiniers) ; une
  variété ancienne se sème **quel que soit le rang** de sa culture (la citrouille de la boîte au rang 2). Graines gardées
  d'abord (gratuit, équipe comprise), sinon (fixée) prix de la culture × 1,25 (greffon : jeune plant × 1,25). Le semis
  ne prend ni la réserve de la foire ni un semis offert.
- **Récolte à la main après fixation** : ne rend **plus** de graine (une variété sauvée a des graines illimitées en
  vente ; celles déjà gardées restent gratuites) mais compte toujours pour « Les mains dans les graines »
  (`heirloomHarvest` n'est plus émis). L'équipe et les machines ne gardent **jamais** de graine. *(Lecture du § 3.4 :
  « graines illimitées au prix × 1,25, les graines déjà gardées restent gratuites » ; sans cela, une variété sauvée
  donnerait des semis gratuits à vie, contre la rareté voulue au § 12.3.)*
- **Réglages de la simulation** (`src/data/career/valley.js`, détail : `docs/VALLEE.md` § 12.7) : fixation à **7**
  récoltes à la main (`SEED_RULES.fixHand`) ; `ARRIVAL.hintChance` **0,2** : recette remplie et saison d'arrivée → 20 %
  par aube que la bête s'annonce (le nombre de l'espèce, déjà tiré : aucun tirage de plus) ; recettes : bourdons 3 coins
  fleuris, paon-du-jour **2** bandes fleuries, hirondelles + **2 nichoirs**, grenouille + **3** haies, lièvre + **4**
  haies, écureuil + **5** haies, geai + **4** haies ; « cultures différentes » (paon-du-jour) : champs, serre **et
  verger**, une variété ancienne comptant à part de sa culture. Lanternes (carrière) : variété 11 / 16 / 18, beauté
  14 / 19 / 21.
- **Rustique** : le « cours hors saison × 1,25 » d'hiver est déjà le `OFF_SEASON_FACTOR` de la carrière (le maïs ne se
  sème pas l'hiver) : aucun facteur en plus.
- **Sobre** : `query.plot(i)` d'une variété sobre (hors canicule) : `needsWater: false`, `action: null` au lieu de
  `'water'`.
- **Bocal du geai** : `cropId` choisi **sans tirage** à l'aube (première variété pas encore obtenue de la saison
  suivante) ; l'ouverture tire comme les autres bocaux.
- **Étal de la foire** : tiré au dernier jour d'hiver **même sans le lot 4** (fêtes désactivées) ; `fair.varietyId`
  vaut `null` quand toutes les variétés sont chez vous ; l'achat est une dépense de la Vallée (patrimoine 100 %).
- **Habitants** : avec `parts.wildlife === false`, aucun des 12 nombres n'est tiré. Une espèce passée à `hint` va
  jusqu'à `visible` même si sa recette n'est plus remplie (jachère finie). `speciesSpot` peut renvoyer un emplacement
  **libre** du terrain préféré (hirondelles près de l'abri, grenouille au bord de la mare) : RENDER a un ancrage pour
  chaque identifiant de `valleySpots()`.
- **Cueillette des haies** : effacée à l'aube du 1ᵉʳ jour d'hiver (dans `dawnEvents`, pas au soir).
- **Beauté (lanternes)** : `beautyPoints.nature` 1 (`natureMax` 6) + `beautyPoints.butterfly` 1 (paon-du-jour).
- **Album** : « L'album complet » reste les **11 pages du lot 4** (`ALBUM_COMPLETE_PAGES` ; succès « Album complet »
  aussi) : les 2 pages de la Vallée ont leur propre récompense, rien de déjà prêt ne se perd. `albumOverview().pages`
  = 13, `total` = 148.
- **Succès** : `careerAchievementList` renvoie les 17 succès de carrière **puis** les 7 de la Vallée (24).
- **Progression** : `recordValleyStage(progress, n)` → `{ progress, rewards: { cosmeticId, already } }` (décor de l'étape,
  `progress.career.valleyStage` = meilleure étape) ; les écus de l'étape passent par `recordCareerEcus`.

**Formes (champs ajoutés)**
- `query.career.valley()` : `stage.total` (24), `nature.placed`, `fixed: [id]`, `installed: [id]` ; `hint.kind` peut
  valoir `'chapter'` (ordre : bête à voir, chapitre, bocal, planche mûre, recette, graines, étape) ; `hint.target`
  `{ type: 'nature', id: 'fallow' }` (jachère) ou `{ type: 'lot', id: null }` (il faut un terrain : mare, verger…).
  `varietyInfo` : `tint`, `from`, `tree`, `unit` ('graine' | 'greffon') ; `name` d'une variété inconnue = le nom de la
  culture (pas de révélation). `speciesInfo` : `seasonsText`, `recipeOk`, `hintIcon`. `natureInfo` : `bought` ; `locked`
  n'est vrai que pour le rang, le grenier ou la mare (pas l'argent : `reason`). `fair` : `stall`, `bought`.
- `query.career.valleySpots(kind)` : `label` (« Le Haut-Champ, côté gauche »), `stage` du chêne posé.
- `query.career.valleyAnimals()` : `hintIcon` pour un indice.
- `query.plot(i).variety` : `ripeIcon`, `tint`, `unit` ; `fallow.text` ; `query.plantableCrops(i)` : `heirlooms` et
  `fallow` sont des **propriétés du tableau** renvoyé (pas copiées par `JSON.stringify`) ; lignes `icon`, `trial`, `tree` ;
  `fallow.growth`.
- `query.career.yearReport().valley` (et `report.valley`) : `{ started, stage, stageName, signs, year, installed, fixed,
  natureTotal }`.
- `query.achievementContext().career.valley` : `started` en plus.
- Événements : `valleyStarted.hedgeLine` ; `heirloomHarvest.tree` ; `heirloomFixed.text` ; `heirloomSown.by` ;
  `speciesHint.icon` ; `speciesVisible.name` ; `speciesInstalled.anecdote`, `.spotId` ; `hedgePicked.spotId` ;
  `jayGift.text` ; `fairHeirloomBought.name` ; `harvest()` renvoie aussi `fixed`. Ordre à la récolte : `harvested`, puis
  `heirloomHarvest`, puis `heirloomFixed`. `developLot` renvoie `natureReserved: [kind]` quand il y en a.
- `triggerValley(kind, arg, arg2)` : `'seeds'` prend `(varietyId, n)` ; `'stage'` fixe des variétés puis installe des
  habitants jusqu'au palier (l'étape reste cohérente avec les signes de vie).

## Vallée V1 — rendu et interface (UI/RENDER, 2026-10-03)

Code contre le contrat « Vallée vivante — contrats du lot V1 » et ses « Écarts et précisions (livraison CORE V1) ».
Carrière seulement : tout est gardé par `state.career.valley` (et `started` pour la scène) ; en Niveaux, rien (seules
les 2 pages d'album se voient dans la grange). Un sprite de `valley1` absent → repli dessiné (scène) ou emoji décoratif
caché aux lecteurs d'écran (`vIcon`). Planche `valley1` facultative au démarrage (`OPTIONAL_SHEETS` de `main.js`).
Styles : **`css/valley.css`** (dans `CSS_FILES`). Tests : `tests/valley-render.test.js`.

```
src/render/layout-career.js  careerValleySpots({ bands, house, storage, free, H }) (pur, exporté) →
                             layout.valley = { spots: { [spotId]: { x, y, w, h, kind } }, box, animalAnchors, reserved }
src/render/valley-actors.js  purs : oakStage, hedgeTileName, stripTileName, oakSpriteName, fallowSpriteName,
                             edgeFlowersOn, birdsPerMinute, butterfliesOn, edgeTiles, findRect, growRect ;
                             createValleyActors(effects) : sync, onEvent, update, drawGround, collect, drawOverlay,
                             hitTest, itemRect, setStage, setPlacing, placingSpots, clear, shift, stats
src/render/scene.js          setValleyStage(n), setValleyPlacing(kind | null), valleyPlacing, valleyItemRect(kind, id),
                             valleySpots(), valleyStats() ; hitTest + wildlife | hedgeFind | valleyBox | natureSpot ;
                             heirloom.<id>.<étape> pour une parcelle à variété ; points de la mini-carte en mode aménagement
src/render/cozy-actors.js    occupation : emplacements et boîte de la Vallée (quand `layout.valley.reserved`)
src/render/atlas.js          DECOR_SPRITES : seed.cabinet, nestbox.painted, valley.linden
src/ui/career/valley.js      createValley(app) → app.valley (voir l'en-tête du fichier)
src/main.js                  app.valley ; onGameEvent (carrière) → app.valley.onEvent ; frame, reset ; menu de pause
                             « La Vallée » ; Échap quitte le mode aménagement ; __debug.valley
src/ui/{field,gestures,todo,grange,album,cozy}.js, src/ui/career/{lots,journal,windows,util}.js   points d'accroche
```

- **Emplacements** (tuiles du bloc, `ox` = colonne du bloc, `y0` = sa première ligne) : haies `hedgeL` / `hedgeR` sur
  les colonnes de lisière x 0 / x 13, lignes 0 à 9 (champ de départ : 12 lignes, toute la clôture) ; bande fleurie
  (`strip`) au pied de la clôture du champ, x 2 à 6 (à gauche du portail, loin de la moissonneuse garée) ; champ de
  départ : hôtel (1 × 2) en x 1, lignes 9-10 (sous les ruches) ; pré et basse-cour : tas en (1, 1), nichoir en (6, 1)
  (entre les bâtiments) ; pré : chêne 2 × 2 « au milieu » de l'enclos de gauche (3 × 2 tuiles une fois adulte, la
  couronne déborde vers le haut) ; verger : nichoir (4, 3), tas (10, 7), hôtel (10, 1) ; ateliers : hôtel (11, 1) ;
  friche : tas (3, 7), chêne (7, 3) ; mare : berges = rangée du haut (3 à 10, ligne 1), roseaux dessinés aussi sur les
  côtés ; maison : nichoir sur la première tuile libre à droite de l'allée du champ (la mangeoire et le porte-lanternes
  du lot 4 restent à gauche, au-dessus du toit), nichoir à chouette sous le pignon du grenier (sur le bâtiment, par
  conception), **boîte en fer** sur une tuile libre contre la façade, à droite de la maison. Les tuiles de la maison et
  de la friche sont réservées avant le décor quand `career.valley` existe (`reserved`) : aucun arbre ne pousse dessus ;
  les fermes sans Vallée gardent exactement leur décor.
- **Ancrages des bêtes** : côté intérieur d'une haie (mi-hauteur), sur la bande ou la berge, à côté d'un nichoir, d'un
  tas, d'un hôtel ou au pied du chêne ; plusieurs bêtes au même endroit se décalent. Habitant du jour : aller-retour de
  ± 12 px avec des pauses (dessins regardant à gauche, retournés vers la droite) ; oiseaux et insectes un peu en l'air.
- **Dessin** : au sol (après les parcelles) jachères (`nature.fallow.<saison>`), bandes, berges, indices du matin ;
  triés avec la scène : haies (tuile par tuile), nichoirs, tas, hôtels, chênes, trouvailles, boîte, bêtes ; au-dessus :
  lisière fleurie (`edgeTiles` : tuiles de forêt voisines du sol, une sur ~3, déterministe), étiquettes `valley.label`,
  « ? » des bêtes qui attendent, cœurs à l'installation, emplacements du mode aménagement (contour pointillé épais + « + »,
  remplissage clair qui pulse ; lisible sans la couleur), oiseaux (`fx.birds`), papillons (`fx.butterfly`). Pose d'un
  aménagement : fondu de 0,9 s + étincelles + terre ; récolte à la main d'une variété : « +2 graines · 4/7 » ; variété
  sauvée : gerbe dorée « Sauvée ! ». Seul ce qui est près de la vue est dessiné.
- **Toucher** (au zoom courant, `screenToWorld`) : en carrière, après les personnages, la bête qui attend, la trouvaille
  et la boîte sont cherchées avec leur cible agrandie (`minWorld = 48 × dpr / zoom`) **avant** les parcelles et les
  enclos (une bête au bord d'un enclos reste touchable) ; mode aménagement : seuls les emplacements libres du genre choisi
  répondent (le défilement, le pincement et les boutons + / − restent).
- **Fiche « La Vallée »** (`openLive`, feuille haute, pause de lecture) : vignette `valley.stage.<n>` × 3 (× 2 sur petit
  écran), « Étape n · nom », rangée de signes de vie lue (« 6 signes de vie sur 11 »), le prochain indice (un seul,
  bouton : Aller voir · Écouter Joseph · Ouvrir · Voir · Semer · Aménager · Jachère · La carte), segments ; Graines :
  bocaux à ouvrir, étal de la foire (dernier jour d'hiver), une ligne ≥ 72 px par variété (silhouette grise et « À
  retrouver… », barre de fixation à segments lue, « Sauvée ✓ ») → fiche de la variété (grand dessin, anecdote, trait
  expliqué, « Semer » vers la première parcelle libre qui convient) ; Habitants : recette en lignes cochées (✓ / ✗ et
  « 1 / 2 »), saison, état (indice, « Vous attend près de… » + Aller voir, « Installé ✓ — service ») et « Ce que la
  vallée vous rend » ; Aménager : une carte par aménagement (prix ou « gratuit (à replacer) », emplacements libres,
  verrou « Rang 3 »…) → mode aménagement, et la jachère fleurie ; en bas, les récits de Joseph (relire).
- **Fenêtres** : « La boîte en fer » (file d'attente : s'ouvre quand aucune fenêtre, feuille, conseil, tutoriel, mode
  fête ou décoration n'est affiché ; trois lignes qui apparaissent, les trois variétés, la haie de Joseph ; « Merci,
  Joseph » lit le chapitre 0 et montre la boîte du perron par un conseil) ; bocal (étiquette à demi effacée →
  « Ouvrir le bocal » → la variété, son trait, ses graines → Semer / Bocal suivant / Plus tard) ; observation (feuille
  basse, la bête recentrée au-dessus : « Le hérisson s'installe ! », anecdote, service, « ✓ Album », « Bienvenue, petit
  hérisson ! » ≥ 56 px ; accords : les coccinelles s'installent…) ; chapitre (vignette de l'étape, trois lignes,
  bienfait de l'étape, « Merci, Joseph »).
- **Étapes** : `valleyStage` → écus (`careerEcus`), `recordValleyStage` (décor de l'étape 5), `scene.setValleyStage`,
  message important « La vallée : … » avec « Écouter », note du matin, conseil `valley.stage`. L'étape de la scène suit
  aussi l'état à chaque image (reprise d'une partie).
- **Messages** : importants — bête venue (« Voir » ; retiré quand elle s'installe), variété sauvée (« Voir »), étape,
  aménagements à replacer, geai, cueillette ramassée, sachet de la foire ; infos — planche d'essai semée (« il reste 2
  graines »). Résumé du matin : indices (`speciesHint.text`), « Hier : 4 graines anciennes gardées », sol reposé,
  cueillette des haies, boîte de Joseph.
- **Fiches existantes** : parcelle (titre « Navet Boule d'or mûre », « Variété ancienne (planche d'essai) », trait en
  pictogramme et en mot, « À la main : + 2 graines » + barre ; jachère : `fallow.text` ; sol reposé) ; feuille des
  graines (section « Graines anciennes » en tête, badge « Planche d'essai : récoltez-la à la main », raison quand on ne
  peut pas semer ; « Jachère fleurie (gratuit) » ; « Semer partout » sème la variété jusqu'au bout du stock — ou de
  l'argent, une fois sauvée — puis s'arrête) ; terrain (section « Nature » : chaque emplacement, ✓ ou « Planter ·
  280 ») ; plan de culture (rubrique « Variétés sauvées », valeur `heirloom:<id>`, libellé dans la fiche du terrain) ;
  bilan annuel (« La vallée cette année ») ; Carnet › Ferme (carte « La Vallée », pastille quand quelque chose attend) ;
  Carnet › Bilan (cumul, dépenses au patrimoine) ; grange › Succès (« La Vallée · n / 7 ») ; postes `valley` du bilan.
- **Débogage** (`?debug=1`) : `__debug.valley.{ on(), state(), start(), jar(cropId), seeds(id, n), fix(id), visible(id),
  install(id), stage(n), finds(), fair(), tree(spotId), place(kind, spotId?), open(tab), placing(kind | null),
  point(kind, id), ui(), stats() }`.

### Intégration et vérification du lot V1 (2026-10-03)

- **Accords** (`src/data/career/valley.js`) : chaque variété porte `g` (genre du nom : `'m'` pour le navet, le blé, le
  chou, le maïs, le tournesol ; `'f'` sinon), chaque habitant `the` (« Les coccinelles »), `g` et `pl` ;
  `agreeWith(x, mot)` et `savedText(x)` (« Navet Boule d'or est sauvé ! »). Requêtes : `varietyInfo.g`,
  `query.plot(i).variety.g`, `speciesInfo.{ the, g, pl, seasonsWhen }` ; `habitat.js` : `seasonsWhen(saisons)` (« du
  printemps à l'automne »), `comesText(espèce)` (« elles viennent »). Indices, refus (« Déjà installées. »), fiche, scène
  (« Sauvé ! ») et feuille des graines accordés. Hors Vallée, `src/ui/field.js` accorde aussi « mûr / mûre » avec la
  culture (« Navet mûr », « Gèlera avant d'être mûr »).
- **Rien ne se perd** (`heirlooms.js` `returnTrialSeed(state, p)`, appelé avant `clearPlot` par `applyFrost`,
  `applyRot` (`farm.js`), `removeTree` (`game.js`) et `developLot` (`land.js`), gardé par `state.career?.valley`) : une
  planche d'essai perdue sans récolte rend sa graine (ou son greffon) ; une variété sauvée, rien. Aucun tirage en plus ;
  la simulation de carrière bouge un peu (§ 12.7 de `docs/VALLEE.md`), les niveaux pas du tout (parité 400 / 400).
- **Bug corrigé** : réaménager un terrain dont une parcelle était en jachère fleurie laissait `fallow` sur une parcelle
  sans terrain (`env: null`), sauvegarde refusée au chargement (« Vallée (jachère) ») ; `developLot` efface maintenant
  `variety`, `fallow` et `rested` des parcelles retirées.
- **Messages et feuilles** (`src/ui/toasts.js`, règle générale) : sur téléphone, pendant qu'une feuille est ouverte, les
  messages (sauf refus et système) passent à l'historique et **attendent** ; ceux déjà affichés quand une feuille s'ouvre
  se retirent et attendent aussi ; à la fermeture, les deux plus récents (moins de 45 s, ceux qui proposent une action
  d'abord) s'affichent, la pastille « +N » signale le reste. `holdsOnSheet`, `pickHeld`, `HOLD_MAX_AGE` (purs, testés) ;
  `toasts.forget(key)` (bête observée entre-temps). Même règle en mode aménagement (`body.in-valley-place`) et sur la
  fenêtre de fin de saison à cartes (`v-season`, CSS). Écran large : inchangé.
- **Le prochain indice** : tant que rien n'est semé (juste après la boîte de Joseph), « N graines de … attendent d'être
  semées » passe avant les recettes ; l'onglet Graines montre d'abord les variétés en main, puis les sauvées, puis celles à
  retrouver. Refus « Plus de graines de … pour l'instant : chaque récolte à la main d'une planche d'essai en rend 2. »
- **Texte à 150 % sur 360 px** : puces de la feuille des graines, cartes d'aménagement, lignes des habitants, libellé du
  plan de culture et boutons d'achat (`.btn--buy`) vont à la ligne ou s'abrègent au lieu de déborder.
- **Étal de la foire** : un greffon pour le Calville (« 3 greffons »), sachet rangé « dans la boîte en fer » (la
  grainothèque est un bâtiment du V2) ; fiche d'une parcelle sauvée sans la ligne « + 2 graines gardées » (plus de graine
  après fixation).

## Rythme, personnages et messages (2026-10-03)

Retours du joueur (téléphone, surtout en carrière) : « les notifs prennent beaucoup de place, et même en ×1 les jours
passent trop vite, ou du moins on reçoit beaucoup de notifs » ; « en ×1 les personnages semblent accélérés, comme déjà
en ×4 ». Mesures et corrections : JOURNAL.md (2026-10-03).

### Rythme en temps réel

```
src/data/balance.js   DAY_SECONDS = 20 (secondes DE JEU par jour, inchangé : règles, sauvegardes, simulateurs, parité)
                      REAL_DAY_SECONDS = 36, GAME_SECONDS_PER_REAL_SECOND = 20 / 36
src/main.js           frame() : g.update(dt réel × GAME_SECONDS_PER_REAL_SECOND) (partie et ferme du menu)
```

- ×½ : 72 s · ×1 : 36 s · ×2 : 18 s · ×4 : 9 s par jour (mesuré au doigt, Pixel 7). Le rendu reçoit toujours `dt` en
  secondes réelles. `__debug.skipDays` (et tout code de test qui appelle `game.update(DAY_SECONDS)`) n'est pas concerné.
- Textes : guide (« Le temps ») et tutoriel citent `REAL_DAY_SECONDS`.

### Personnages

- **Décor en temps réel** (animaux, chat et chien, promeneurs, visiteurs 26 px/s, Joseph 24 px/s, fermier 30 px/s) :
  aucune dépendance à la vitesse du jeu. Cadence des pas liée à la distance parcourue (jamais « +x par image »).
- **Fermier** (`scene.js`, `updateFarmer`) : pas de 30 px monde/s (avant 44, ×3 sur les longs trajets en carrière :
  250 px CSS/s) ; ×1,25 sur les longs trajets ; au-delà de `FARMER_JUMP` (150 px) de chemin, **raccourci doux**
  (`farmerShortcut` : fondu de 0,22 s, réapparition à 26 px du but, fondu d'entrée) ; il ne suit plus que les gestes
  du joueur (`helperTouched` : les gestes `by` ≠ `'player'` — employés, machines, aides — sont ignorés ; avant, en
  carrière, il courait après chaque geste de l'équipe).
- **Employés** (`career-actors.js`, `walkToward`) : ils ne sont plus placés d'après l'horloge du jeu
  (`startAt → doneAt`, 64 px par seconde de jeu, plus 0,6 px de « pas » par image : jusqu'à 20 bascules de pose par
  seconde) mais **marchent vers leur cible** au pas (`STAFF_WALK` = 22 px monde/s réelles, ≈ 42 px CSS/s), un peu plus
  vif quand l'heure presse (×`STAFF_HURRY` = 1,4 au plus), avec une accélération modérée aux vitesses rapides
  (`paceFactor` : ×1,25 à ×2, ×1,5 à ×4). Cible trop loin (retard > `JUMP_DIST` = 64 px ; un employé un peu en retard continue au pas) :
  **raccourci doux** (fondu, réapparition à `JUMP_LAND` px du but). La pose « travail » se joue une fois arrivé, tant que
  la tâche dure. `env.speed` est passé par `scene.renderCareer` à `actors.update(dt, env)`.
- Machines : passages toujours à l'heure du jeu (travail) ; cadence des roues plafonnée en temps réel.
- **Mouvements réduits** : employés posés à leur tâche, fermier tout de suite à destination (sans trajet ni fondu).
- Mesures : `scene.actorProbe()` (positions, poses, opacité, raccourcis ; `cssPerWorld`) et `actors.probe()`.

### Messages

```
src/ui/toasts.js   priorityOf(o, kind) → 'always' | 'important' | 'info' ; visibleIn(mode, prio) ; MESSAGE_MODES
                   show({ …, prio?, digest? 'vente|ventes', digestN? }) → nœud, ou null si non affiché
                   setMode(mode, { active }) ; get mode ; setDigest(fn) ; stats() → { visible, hidden, quiet, mode }
src/ui/messages.js modePicker() (options « Messages », feuille Messages) ; répétitions « Titre ×N »
src/ui/todo.js     digest(e) ; résumé du matin : « Hier aussi : … » (récoltes de l'équipe comptées sur `harvested` by ≠ joueur)
src/storage.js     settings.messages = 'important' (défaut) | 'all' | 'none'
```

- **Important** (à lire maintenant) : action ou choix (`onClick` : offres, quêtes, vœu…), refus (`log: false`),
  alertes (`error`, `warn`, `frost` : corbeaux, abri plein, découvert, gel), conseil « fermage en danger »
  (`maybeLowMoneyHint`), réponse à un geste du joueur (fête terminée, trouvaille, mangeoire, instructions).
  **Info** (peut attendre) : ventes, récoltes au grenier, naissances, pêche, charges payées, mensualité, sol fatigué,
  succès, cases d'album, commandes livrées, charrette, colporteur, carnet, comice annoncé, fête du jour (déjà annoncée
  par le bandeau de la veille et la ligne « À faire »)… `prio` explicite aux points d'appel quand la règle automatique
  ne suffit pas. **Always** : refus (`error` + `log: false`) et messages du système (`keepTouch` : mise à jour).
- Réglage : **Tous** (tout s'affiche, comme avant) · **Importants** (défaut : les infos vont à l'historique et au résumé
  du matin) · **Aucun** (seuls les refus et le système). Au menu (hors partie), tout s'affiche. Les bandeaux (saison,
  avertissement du fermage, fête de demain) ne sont pas concernés. Lecteurs d'écran : les messages affichés gardent
  `role=status` / `alert` ; les infos non affichées ne sont pas annoncées (elles sont dans l'historique).
- Forme : une ligne pour une info (titre · texte, « … »), deux lignes au plus pour un message important ou une action ;
  ≈ 40 px de haut (avant ≈ 63) ; police 14 px ; deux messages au plus (`MAX_VISIBLE`) ; info 3 s, important 5 s
  (7 s au plus). Styles : `css/guidance.css` (« Messages compacts »).

## Vallée vivante — contrats du lot V2 (CORE · ART · UI/RENDER, conception 2026-10-03)

« Le troc et les croisements » : la Grainothèque (5 niveaux), le troc de graines avec les 12 clients du tableau, 12
variétés du village, 11 variétés croisées au nom de la ferme, le trait Parfumée, 4 habitants et le nichoir à
chauves-souris, 4 récits de Joseph, « Revoir la boîte », 3 pages d'album, 6 succès. Règles chiffrées et contenus :
**`docs/VALLEE.md` § 16** (résumé : `docs/GAME_DESIGN.md` § 18). Ce contrat **s'ajoute** à « Vallée vivante — contrats du
lot V1 » et à ses « Écarts et précisions » : rien n'y est retiré ni renommé ; seuls des champs, des données et des
branches sont ajoutés. Tant que CORE n'a pas livré, UI/RENDER simulent les requêtes avec des objets factices de même
forme ; tant qu'ART n'a pas livré, repli dessiné (`canDraw`, `spriteAny`, `vIcon`).

### Règles communes (en plus de celles du V1)

- **Carrière seulement**, gardé par `state.career?.valley` **et** `valley.parts.heritage` (nouvelle partie, absente = vraie).
  Une partie de niveau n'a pas `state.career` : aucun code nouveau n'y passe. Fichiers partagés touchés (`cozy.js`,
  `farm.js` via `heirlooms.js`) : seulement derrière ce garde. `tests/parity.test.js`, `tools/capture-parity.js --check`
  (400 / 400) et `node tools/simulate.js` (sortie identique octet pour octet) inchangés.
- **Aléatoire** : un flux **nouveau, `state.rng.valley2`** (`hashSeed(seed, 'valley2')`), créé par l'extension `valley`
  (`init` / `migrate`). Tirages fixes : **à chaque aube** une fois la Vallée commencée, si `parts.heritage` et
  `parts.wildlife` : **4 nombres**, un par espèce de `SPECIES_V2` (dans l'ordre des données, candidate ou non). **Rien
  d'autre** : troc, croisements, Grainothèque, récits sont déterministes. Le flux `valley` du V1 tire **exactement** les
  mêmes nombres qu'avant (12 espèces de `SPECIES`, 3 pour les haies, 1 par bocal, 1 pour l'étal) ; `orders`, `variety`,
  `events`, `cozy`, `quality`, `surprise`, `sky`, `staff`, `career`, météo et marché : inchangés (les services du V2
  changent des seuils, jamais un nombre de tirages ; le merle élargit le plafond de la cueillette après les 3 tirages
  déjà faits).
- **Ordre des données = ordre des tirages** : `VARIETIES` (12) et `SPECIES` (12) du V1 **ne changent pas** ; les nouvelles
  données vivent à côté (`VILLAGE_VARIETIES`, `CROSSES`, `SPECIES_V2`) et sont réunies dans des tables `ALL_*` pour les
  lectures (identifiant → définition).
- **Pur** : `src/data/career/heritage.js` et `src/core/career/heritage.js` n'importent ni DOM ni horloge ;
  `src/data/career/heritage.js` n'importe pas `valley.js` (pas d'import circulaire : c'est `valley.js` qui l'importe).
- Temps en saisons ou en aubes (2ᵉ jour de la saison, dernier jour d'hiver), jamais en jours de 7.
- Actions : `{ ok: true, … }` ou `{ ok: false, reason }` (français). Identifiants en anglais, textes en français, accords
  par `g` / `pl` (règle du V1).

### Fichiers

```
src/data/career/heritage.js  (nouveau, pur)
    SEED_LIBRARY { name: 'La Grainothèque', siteRank: 3, levels: [5 × { level, name, price, rank, circle?, handSeeds?,
      fixHand?, crossNeed?, fixedSeedFactor?, touristBonus?, vignette: 'library.<n>', unlocks: [texte] }] }
      // 1 « La remise aux graines » 2000 r3 circle 1 · 2 « La petite grainothèque » 5000 r4 circle 2 handSeeds 3 ·
      // 3 « La grainothèque » 10000 r5 circle 3 fixHand 5 · 4 « Le jardin d'essai » 16000 r5 crossNeed 2 ·
      // 5 « La grainothèque vivante » 25000 r6 fixedSeedFactor 1, touristBonus 0.15
    VILLAGE_VARIETIES (12 : id, cropId, name, g, trait, clientId, label « De la part de … », anecdote, icon
      'heirloom.<id>.icon', ripe 'heirloom.<id>.4', tint, group 'village')
    TROC { seeds: 3, favBonus: 1, seasonDay: 2, order: [12 × { clientId, varietyId, circle, needs?: 'orchard' }],
      lines: { [clientId]: { offer, thanks, garden /* écho des mercis */ } }, crossThanks: '… {farm} …' }
    CROSSES (11 : id 'cross<Culture>', cropId, parents: [paysId, villageId], traits: [t1, t2], text, tint, icon, ripe,
      group 'cross')
    CROSS_RULES { need: 3, wildBeeFactor: 2, seeds: 3 }      // need au niveau 4 : SEED_LIBRARY.levels[3].crossNeed
    SPECIES_V2 (4 : wildBee, blackbird, lizard, bat — même forme que SPECIES : the, g, pl, seasons, recipe, spotKinds,
      service { kind: 'crossFactor' | 'hedgeFindsMax' | 'heatGrowth' | 'staffSummer', value, seasons?, text }, hint,
      hintIcon, anecdote, spotLot?)
    STORIES (4 : id 'heritage0'…'heritage3', title, vignette, lines[3], when: 'rank3' | 'library1' | 'firstCross' |
      'library5')
    HERITAGE_HINTS (conseils : valley.library, valley.troc, valley.pair, valley.cross, valley.scented), HERITAGE_TEXTS
    ofFarm(name) → « de la Ferme des Tilleuls » | « du Moulin » | « d'Arcy » | « de Chez Martin »
    crossName(cross, farmName) → « Tomate de la Ferme des Tilleuls »
src/data/career/valley.js    VALLEY_VERSION 2 ; VALLEY_PARTS ['seeds', 'wildlife', 'heritage'] ;
    TRAITS + { id: 'scented', name: 'Parfumée', icon: 'icon.trait.scented', text, product: 0.15 } ;
    NATURE_ITEMS + { id: 'batbox', name: 'Nichoir à chauves-souris', price { base 100, step 50 }, rank 4, beauty 1 } ;
    NATURE_SPOTS + { slot: 'bat', kind: 'batbox' } sur home (« sous l'avant-toit de la maison »), orchard (« dans un
      vieux pommier »), workshops (« sous l'avant-toit ») ; RECIPE_TEXTS / RECIPE_NATURE + batbox ;
    ALL_VARIETIES (35 = VARIETIES + VILLAGE_VARIETIES + CROSSES, champ `group` 'pays' | 'village' | 'cross'),
    ALL_VARIETIES_BY_ID, varietyTraits(x) → [traitId] (une variété du V1 : [trait] ; croisée : traits),
    ALL_SPECIES (16), ALL_SPECIES_BY_ID, SIGNS_ALL (51) ; VARIETIES, SPECIES, SIGNS_V1, VARIETY_OF_CROP inchangés
src/core/career/heritage.js  (nouveau, pur, sans enregistrement)
    heritageOn(state), libraryLevel(state), libraryEffects(state) → { level, circle, handSeeds, fixHand, crossNeed,
      fixedSeedFactor, touristBonus }, libraryInfo(state), nextTrocClient(state, from: 'season' | 'fair'),
    trocGifts(state, clientId) → [{ varietyId, fav }], swapInfo(state), plotNeighbours(state, i) → [index] (même terrain,
      même `env`, |Δcol| + |Δrow| = 1 ; col = cell % cols, cols 4 pour champ et serre), crossOfCrop(cropId),
    partnerOf(varietyId) → { crossId, partnerId } | null, crossState(state, cropId), crossLinks(state) → [{ a, b, cropId,
      meet, need }], pairPlots(state, cropId) → [{ plotIndex, partnerPlot }], boxInfo(state), storiesInfo(state),
    farmDisplayName(state)
src/core/career/heirlooms.js varietyOf / isFixed / planVariety lisent ALL_VARIETIES_BY_ID ; + traitsOf(plot) → [trait],
    hasTrait(state, plot, id) ; traitOf(plot) gardé (= premier trait) ; toutes les règles de trait passent par hasTrait
    (précoce, sobre, rustique, généreuse, savoureuse, mellifère, géante) ; + scentedFactorOf(state, plot) (1,15 | 1),
    handSeedsOf(state), fixHandOf(state), fixedSeedCost(base, state) (facteur du niveau 5), hedgeFindsMaxOf(state, base)
    (merle : 4), staffNeverTiredOf(state) (pipistrelle, été) ; growthBonusOf + lézard (canicule 0,10) ; touristBonusOf +
    Grainothèque N5 (0,15) ; speciesInstalled lit ALL_SPECIES_BY_ID
src/core/career/habitat.js   habitatCounts + batbox ; installedSpecies / fixedVarieties / signsOfLife sur ALL_* ;
    speciesSpot pour SPECIES_V2 ; nextHint : ordre du § 16.9.4 (troc, paire, Grainothèque) ; natureBeauty + batbox
src/core/career/valley.js    extension 'valley' (même id, même place : après cozy) : V2 dans dawnEvents, valleyHarvest,
    valleySow, actions, requêtes, check, migrate (détail ci-dessous)
src/core/career/runtime.js   récolte d'une variété partie à l'atelier : yieldFactor × scentedFactorOf(p)
src/core/career/staff.js     moodOf : jamais 'tired' l'été si staffNeverTiredOf(state)
src/core/cozy.js             standPointsOf (carrière, gardé) : + STAND_POINTS.heirloom (1) si item.kind 'crop' et
                             item.id ∈ valley.year.heirloomCrops ; src/data/cozy.js : STAND_POINTS.heirloom = 1
src/core/game.js             plantableCrops (lignes V2, `pair`), achievementContext (career.valley + swaps, crosses, library)
src/data/album.js            + pages `swaps` « Le troc du village » (12, check { type: 'swapDone', id: clientId }, tampon
                             '♥'), `crosses` « Les variétés de la ferme » (11, { type: 'heirloomFixed', id: crossId }),
                             `wildlife2` « Les habitants (suite) » (4, { type: 'wildlifeInstalled', id }) — mode 'career'
src/core/album.js            + fait `swapDone` (ctx.career.valley.swaps) ; heirloomFixed / wildlifeInstalled sur ALL_*
src/data/achievements.js     + HERITAGE_ACHIEVEMENTS (6, catégorie 'career', écus) ; ALL_ACHIEVEMENTS les inclut
src/data/cosmetics.js        + 3 décors found: true, price 0 : swap.basket (small), cross.sign (small), lizard.wall (small)
tools/simulate-career.js     robots V2 (VALLEY_STYLES + champs V2), --valley seeds,wildlife (= V1 seul), --compare-valley2
tests/valley2.test.js, tests/valley2-troc.test.js, tests/valley2-cross.test.js, tests/valley2-migration.test.js (nouveaux)
assets/sprites/generate-valley2.py → assets/sprites/valley2.png + bloc « // <valley2:auto> » d'atlas.js   (ART)
src/ui/career/heritage.js    (UI, nouveau) fiche « La Grainothèque », feuille du troc, popup du croisement, mode paire,
                             récits, « Revoir la boîte » ; css/valley.css (règles V2 ajoutées, pas de fichier de plus)
src/render/valley-actors.js  (RENDER) Grainothèque et panneau, sachet du tableau, abeille des paires, mode paire,
                             nichoir à chauves-souris, habitants du V2
```

### Activation et options

```js
createCareer({ …, valley })   // défaut true ; { seeds, wildlife, heritage } → absentes = true
                              // { heritage: false } : le V1 exactement (aucun tirage valley2, aucune règle V2)
game.valley                   // inchangé (booléen)
```

Le V2 est « ouvert » dès que la Vallée est commencée (`started`) et `parts.heritage` ; le troc et les croisements
demandent aussi `parts.seeds`, les 4 habitants `parts.wildlife`. Panneau de la Grainothèque et récit `heritage0` : première
aube au rang ≥ `SEED_LIBRARY.siteRank` (3).

### État (`state.career.valley`, champs ajoutés ; `v: 2`)

```js
state.career.valley = {
  v: 2,
  parts: { seeds: true, wildlife: true, heritage: true },
  // … tous les champs du V1 …
  library: null | { level: 1..5, builtAt: abs, levelAt: abs },   // Grainothèque
  site: false,                     // panneau visible (rang 3 atteint une fois, Vallée commencée)
  troc: null | { clientId, since: abs, from: 'season' | 'fair' },  // proposition en attente (une au plus, sans limite)
  trocSeason: -1,                  // saison absolue de la dernière proposition « de saison » (une par saison)
  trocFairYear: 0,                 // année de la dernière proposition « de la foire »
  swaps: { [clientId]: { given: varietyId, got: varietyId, seeds, fav: bool, at: abs } },   // une fois par voisin
  crosses: { [cropId]: { meet: n, foundAt: null | abs } },  // créé à la première rencontre ; jamais en baisse
  stories: { available: [storyId], read: [storyId] },
  // varieties / seeds : + variétés du village (from: 'swap') et croisées (from: 'cross') ; FROM + 'swap', 'cross'
  // species : + wildBee, blackbird, lizard, bat (mêmes états 'hint' | 'visible' | 'installed')
  // nature : + emplacements '<lotId>.bat' (kind 'batbox') ; bought / reserve : + batbox
  year: { …, swaps: 0, meets: 0, crosses: 0, heirloomCrops: [cropId] },   // heirloomCrops : stand de la fête
  stats: { …, swaps: 0, meets: 0, crosses: 0, pairs: 0 },
}
// Parcelles : variety / lastVariety peuvent valoir un identifiant de ALL_VARIETIES (cropId = celui de la variété).
// Plan de culture : 'heirloom:<id>' accepté pour toute variété SAUVÉE de ALL_VARIETIES (pas pour le pommier).
```

`check(state)` (V2) : `v` entier 1..2 ; `parts.heritage` booléen ; `library` (niveau 1..5, entiers) ; `troc.clientId`
connu, pas déjà échangé ; `swaps` : clients connus, `given` sauvée (variété connue), `got` = la variété du voisin ;
`crosses` : cultures de `CROSSES`, `meet` entier ≥ 0, `foundAt` null ou entier, et variété croisée présente dans
`varieties` si `foundAt` ; `stories` : identifiants connus, `read ⊂ available` ; identifiants de variétés et d'espèces
sur les tables `ALL_*` ; `year.heirloomCrops` cultures connues ; `finds` : au plus `hedgeFindsMaxOf(state, 3)` (4 avec le merle). Une
sauvegarde V1 (`v: 1`) reste valide.

### Déroulé (extension `valley`)

- **`dawnEvents`** — après les étapes du V1 (`valleyStarted`, `fallowEnded`, `jayGift`, étal, espèces du V1, cueillette),
  dans cet ordre :
  1. **site** : rang ≥ 3 et `site` faux → `site = true`, récit `heritage0` disponible → `storyAvailable { id }` ;
  2. **troc** (si `parts.seeds`, aucun `troc` en attente, au moins une variété sauvée, et un voisin restant) — dernier jour
     d'hiver et `trocFairYear < année` → `nextTrocClient(state, 'fair')`, `trocFairYear = année` ; sinon 2ᵉ jour de la
     saison, `library` et `trocSeason < seasonAbs` → `nextTrocClient(state, 'season')`, `trocSeason = seasonAbs` ;
     → `troc = { clientId, since, from }`, `trocOffered` ;
  3. **habitants du V2** (si `parts.wildlife`) : 4 nombres `valley2` ; même automate que le V1 (`hint` → `visible` → on
     touche) ; une seule venue annoncée par aube **toutes espèces confondues** (aucune si une espèce du V1 s'est annoncée
     ce matin) ; événements `speciesHint`, `speciesVisible` (mêmes formes).
- **`dawn`** (fin de l'aube) : étape (`stageFor(signsOfLife)` sur les 51 signes, paliers du V1 inchangés) → `valleyStage`.
- **`yearEnd`** : `report.valley` + `swaps`, `crosses`, `libraryLevel`, `meets` de l'année ; `year` remis à zéro.
- **Fournisseurs** : `effects('touristBonus')` + 0,15 au niveau 5 ; `patrimony` → `valley.spent` (Grainothèque et
  nichoirs compris, 100 %) ; `unlocks(rank)` + `{ kind: 'valley', id: 'seedLibrary', name: 'La Grainothèque' }` au rang 3,
  `{ kind: 'nature', id: 'batbox' }` au rang 4.
- **`valleyHarvest(api, plotIndex, by)`** (avant `clearPlot`, comme au V1) :
  - toutes récoltes : `year.heirloomCrops` ∪ cropId ;
  - à la main : graines `handSeedsOf(state)` (2, 3 au niveau 2 ; greffon : 1), fixation à `fixHandOf(state)` (7, 5 au
    niveau 3) — une variété qui atteint le nouveau seuil **par un achat de niveau** est sauvée à sa prochaine récolte à la
    main (aucune fixation « en silence ») ;
  - **rencontre** (à la main, `parts.seeds`, culture de `CROSSES`, croisée pas encore trouvée) : si une voisine
    (`plotNeighbours`) porte l'autre parent (`p.variety === partnerId`, `cropId` présent) → `meet += 1 × (osmie ? 2 :
    1)` → `crossMeeting` ; `meet ≥ libraryEffects.crossNeed` (3, 2 au niveau 4) → `foundAt`, variété croisée ajoutée
    (`from: 'cross'`), `seeds += CROSS_RULES.seeds`, récit `heritage2` disponible la première fois → `crossFound` ;
  - ordre des événements à la récolte : `harvested`, `heirloomHarvest`, `heirloomFixed`, `crossMeeting`, `crossFound`.
- **Lus directement** (gardés) : `farm.js` / `surprises.js` par `heirlooms.js` (traits en liste) ; `runtime.js` (Parfumée :
  `tryProcessHarvest(…, yieldFactor × scentedFactorOf(p))`) ; `staff.js` (pipistrelle) ; `events.js` (touristes via
  `touristBonusOf`) ; `cozy.js` (stand : `heirloomCrops`) ; `valley.js` lui-même (cueillette des haies : plafond
  `hedgeFindsMaxOf(state, HEDGE_FIND_RULES.max)`, après les 3 tirages habituels).

### Actions (`game.actions.career.*`, Vallée commencée)

```js
buildSeedLibrary()                 → { ok, level, name, cost, unlocks: [texte], story: null | storyId }
    // construit (niveau 1) ou agrandit d'un niveau ; refus : 'La Vallée commence au rang 2.' ; 'Rang N requis' ;
    //   'La grainothèque est déjà au plus haut.' ; notEnoughMoney(n) ; 'Grainothèque désactivée.' (heritage ou seeds off)
swapSeeds(varietyId)               → { ok, clientId, clientName, given: { varietyId, name }, got: { varietyId, name,
                                       seeds, unit }, fav, thanks }
    // refus : 'Aucun troc en attente.' ; 'Variété inconnue.' ; 'Cette variété n'est pas encore sauvée.' ;
    //   '{Voisin} a déjà cette variété : c'est la sienne.'  (aucun coût, aucune graine retirée)
sowPair(plotIndex, cropId)         → { ok, plots: [plotIndex, partnerPlot], varieties: [villageId, paysId], cost,
                                       fromSeeds: [bool, bool] }
    // parent du village sur plotIndex, parent du pays sur la première voisine vide (droite, gauche, dessous, dessus) ;
    //   chaque semis suit valleySow (graines gardées d'abord, sinon variété sauvée au prix de la graine) ; ATOMIQUE
    //   (tout est vérifié avant de semer) ; refus : 'Culture sans croisement.' ; 'Ce croisement est déjà trouvé.' ;
    //   'Cette parcelle n'est pas libre.' ; 'Il faut une parcelle libre juste à côté.' ; refus de valleySow
    //   (« Plus de graines de … pour l'instant… », saison, argent)
readStory(id)                      → { ok, story: { id, title, lines, vignette } }   // refus : 'Récit inconnu.'
triggerValley(kind, arg, arg2)     // + 'site', 'library' (n), 'troc' (clientId), 'swap' (clientId : troc fait avec la
                                   //   première variété sauvée), 'meet' (cropId, n), 'cross' (cropId : trouvée) ;
                                   //   'visible' / 'install' / 'seeds' / 'fix' acceptent les identifiants du V2
// Modifiées : sowHeirloom(i, id) et setPlan(lot, saison, 'heirloom:<id>') acceptent ALL_VARIETIES ;
//   placeNature(spotId, 'batbox') ; observe(id) accepte SPECIES_V2.
```

Dépenses : `spendValley(api, cost)` (poste « La Vallée », `valley.spent`, patrimoine 100 %). Le troc et les récits ne
coûtent ni ne rapportent rien.

### Requêtes (`game.query.career.*`)

```js
valley() → V1 + {
  heritage: bool,
  library: { level /* 0 = pas construite */, name, site, vignette, effects: [texte], next: null | { level, name, price,
             rank, canBuild, reason, unlocks: [texte] } },
  troc: null | trocInfo,
  swaps: { done, total: 12, list: [{ clientId, clientName, clientTitle, portrait, varietyId, varietyName, icon, done,
           given: null | { varietyId, name }, fav, circle, locked: null | texte }] },
  crosses: [{ cropId, id, name /* « ? » tant qu'elle n'est pas trouvée */, icon, parents: [{ varietyId, name, icon, have,
              fixed }], traits: [traitInfo], meet, need, found, fixed, linked /* une paire pousse */, canPair, reason }],
  box: { title, vignette, lines: [3], hedgeLine, hedge: null | { spotId, label }, varieties: [{ varietyId, name, icon,
         trait, state, seeds, hand, need }] },
  stories: [{ id, title, vignette, lines, available, read }],
  // varieties : 35 entrées, + group, traits: [traitInfo] (trait = traits[0]), clientId (village), cross: null |
  //   { cropId, partnerId, partnerName, meet, need, found } ; name d'une croisée trouvée = crossName(…) ; inconnue : '?'
  // species : 16 entrées, + group 'v1' | 'v2' ; stage.total = 51
}
trocInfo = { clientId, clientName, clientTitle, portrait, from, text /* sa proposition */, varietyId, varietyName, icon,
             traits, seeds, unit, gifts: [{ varietyId, name, icon, traits, group, fav, seedsBack }], favText }
valleyCrossLinks() → [{ a, b, cropId, meet, need }]      // rendu : abeille entre deux parents voisins (au plus 12)
valleyPairPlots(cropId) → [{ plotIndex, partnerPlot }]  // mode paire : parcelles vides avec une voisine vide
valleyAnimals()          // + habitants du V2 (6 dessinés au plus au total, règle du V1)
valleySpots(kind?)       // + emplacements 'bat'
query.plot(i).variety    // + group, traits: [traitInfo], cross: null | { partnerId, partnerName, meet, need, linked }
query.plantableCrops(i).heirlooms   // lignes des 35 variétés obtenues ; + group, traits, pair: null | { canPair, reason }
query.achievementContext().career.valley   // + swaps: [clientId], crossesFound: [id], library: n, installed (16)
query.career.yearReport().valley           // + swaps, crosses, libraryLevel, meets
```

### Événements (Vallée active, V2 ouvert)

| Type | Données | Pour |
|---|---|---|
| `storyAvailable` | `{ id, title }` | ligne « À faire », message « Joseph a quelque chose à vous dire » |
| `seedLibraryBuilt` | `{ level, name, cost, unlocks, story }` | le bâtiment change (fondu), son `reveal`, conseil `valley.library` |
| `trocOffered` | `{ clientId, clientName, varietyId, varietyName, text, from }` | sachet épinglé au tableau, message important « Voir », résumé du matin, conseil `valley.troc` |
| `seedSwapped` | `{ clientId, clientName, given, got, fav, thanks }` | sachet qui glisse, merci du voisin, album |
| `crossMeeting` | `{ cropId, plotIndex, partnerPlot, meet, need }` | texte flottant « + 1 rencontre · 2 / 3 » |
| `crossFound` | `{ varietyId, cropId, name, traits, parents, seeds, story }` | sachet doré, popup, son `chime`, conseil `valley.cross` |
| `pairSown` | `{ plots, varieties, cost }` | étiquettes des deux planches, conseil `valley.pair` |
| `speciesHint` / `speciesVisible` / `speciesInstalled` | formes du V1, identifiants du V2 | comme au V1 |
| `heirloomFixed`, `heirloomHarvest`, `heirloomSown`, `naturePlaced` | formes du V1, identifiants du V2 | comme au V1 |

### Progression (album et succès)

- Pages `swaps` (récompense 25 écus + `swap.basket`), `crosses` (40 écus + `cross.sign`), `wildlife2` (20 écus +
  `lizard.wall`) ; « L'album complet » reste les 11 pages du lot 4 ; `albumOverview().pages` = 16, `total` = 175.
- `HERITAGE_ACHIEVEMENTS` (catégorie « Carrière », `careerValley { key, n }`) : `firstSwap` Premier troc (10),
  `villageSeeds` Les graines du village — 12 trocs (30), `firstCross` Un nom pour une graine (15), `farmHeritage`
  L'héritage de la ferme — 11 croisées sauvées (40), `livingLibrary` La grainothèque vivante — niveau 5 (30),
  `valleyFriends` Les habitants (suite) — les 4 du V2 (20) ; 145 écus. `careerAchievementList` : 17 + 7 + 6 = 30.
- Pages et succès ajoutés par `normalizeProgress` (schéma inchangé, rien à rattraper).

### Migration et sauvegardes

- `migrate` : `state.career.valley` en `v: 1` → `completeValley` ajoute `library: null`, `site: false`, `troc: null`,
  `trocSeason: -1`, `trocFairYear: 0`, `swaps: {}`, `crosses: {}`, `stories: { available: [], read: [] }`, compteurs
  `year` / `stats` ; `parts.heritage = true` ; `v = 2` ; `state.rng.valley2` créé. Rien n'est retiré ni réinterprété.
- Ancienne carrière au rang ≥ 3 : panneau et récit `heritage0` à la première aube ; troc de la foire au prochain dernier
  jour d'hiver (dès une variété sauvée). `state.career.valley === null` : reste `null`.
- `CAREER_VERSION` inchangée ; `save.js` (via `checkValley`) accepte les identifiants du V2 sur les parcelles.
- Tests : aller-retour V1 → V2 → sauvegarde → chargement ; carrière V1 de l'intégration (`090ec5c`) reprise ;
  `{ heritage: false }` donne exactement les tirages et l'état du V1 sur 10 ans (empreinte de l'état comparée) ;
  parité des niveaux.

### Simulation

- `tools/simulate-career.js` : `--valley seeds,wildlife` (V1 seul), **`--compare-valley2`** (V1 seul → V1 + V2, même
  graine : revenu, rangs, Domaine, dépenses du V2, argent en caisse aux ans 10 et 14, nouveautés par saison (ans 2 à 10
  et 6 à 10), collection par année (trocs, croisements trouvés, variétés sauvées par groupe, niveau de Grainothèque,
  habitants), gestes par jour, part à la main, `handsOff`, `automator`, débutant, part des semis de l'appliqué) ;
  `--compare-valley` garde son sens (sans la Vallée → avec toute la Vallée).
- Nouveautés comptées : celles du V1 + `seedLibraryBuilt`, `trocOffered`, `seedSwapped`, `crossFound` (les habitants et
  les variétés du V2 passent par `speciesHint`, `speciesInstalled`, `heirloomFixed`).
- Robots : `docs/VALLEE.md` § 16.12.5, par l'API publique et `me.valleyRnd`.
- Après réglage : `SEED_LIBRARY`, `CROSS_RULES`, `TROC`, recettes du V2, et les tableaux de `docs/VALLEE.md` § 16.12
  remplis (section « Résultats », comme le § 12.7).

### Ce que RENDER et UI consomment

**RENDER** (`src/render/*`) :
- Disposition : `layout.valley.library = { x, y, w, h }` (2 × 2 tuiles de la bande de la maison, **réservées** avant le
  décor quand `career.valley` existe, comme la boîte en fer) ; `layout.valley.spots` + les emplacements `bat` (un
  rectangle pour chaque identifiant de `valleySpots()`) ; ancrages des 4 habitants. Test : aucun chevauchement (maison,
  grenier, étal, puits, panneaux, mangeoire, porte-lanternes, boîte, nichoirs, aire des machines), cibles ≥ 48 px CSS.
- Scène : Grainothèque `library.<n>` (ou panneau `library.site` si `site` et niveau 0 ; rien avant) ; sachet `troc.pin`
  sur le tableau du village quand `valley().troc` ; abeille `fx.pollen` entre les paires de `valleyCrossLinks()` (au plus
  12 ; mouvements réduits : point fixe) ; sachet doré `seedpack.cross` qui saute au `crossFound` ; dessins mûrs et icônes
  des 23 variétés (`heirloom.<id>.4`, repli : la culture teintée par `tint`) ; géants `heirloom.<id>.giant` (chou du
  village, chou et citrouille croisés) ; `nature.batbox` ; `wild.<id>` des 4 habitants ; visiteurs devant la porte au
  niveau 5 (décor).
- `scene.hitTest` : + `{ type: 'seedLibrary' }` (bâtiment ou panneau), `{ type: 'pairPlot', plotIndex }` (seulement en
  mode paire : `scene.setPairPlacing(cropId | null)`, qui fait pulser les parcelles de `valleyPairPlots(cropId)` ; seuls
  ces cibles, le défilement, le pincement et les boutons + / − répondent). Le sachet du tableau garde le hit
  `villageBoard` existant.
- Nouvelle planche `valley2` dans `SHEETS` et `assets.js` (facultative, `OPTIONAL_SHEETS`) ; `DECOR_SPRITES` : 3 décors.

**UI** (`src/ui/career/heritage.js`, `src/ui/career/valley.js`, `src/ui/variety.js`, `css/valley.css`) :
- `createHeritage(app) → app.heritage = { openLibrary(tab?), openTroc(), openCross(cropId), enterPair(cropId),
  leavePair(), pairing, openStory(id), openBox(), onEvent, onHit(hit), todoItems(game), boardCard(game) /* carte « Troc »
  du tableau */, plotRows(plot), seedRows(rows), yearLines(report), frame(), reset() }` ; `app.valley` appelle
  `app.heritage` pour la carte de l'onglet Graines, les groupes, « Revoir la boîte » et les récits.
- Écrans : `docs/VALLEE.md` § 16.9 (fiche de la Grainothèque à segments L'étagère · Croisements · Troc ; feuille du troc ;
  popup du croisement ; mode paire avec barre `#vl-pairbar` « Semer la paire · Tomate · Touchez une parcelle ·
  Terminer » ; fenêtre de la boîte reconstruite par `valley().box`, qui ne se ferme plus d'un toucher dehors).
- Tableau du village (`src/ui/variety.js`, `openBoard`) : carte `app.heritage.boardCard(game)` en tête quand un troc
  attend (rien sinon ; aucune autre modification du tableau) ; écho des mercis (`TROC.lines[clientId].garden`, une fois
  sur trois par hachage de l'identifiant de la commande).
- Ligne « À faire » : `vl-troc`, `vl-story` ; résumé du matin ; messages (`trocOffered` important avec « Voir » ;
  `crossFound` et `seedLibraryBuilt` importants ; `crossMeeting`, `pairSown` infos) ; conseils « première fois »
  `HERITAGE_HINTS` ; sons existants (`pop` troc, `chime` croisement, `reveal` niveau, `magic` récit, `chirp` habitant).
- Débogage (`?debug=1`) : `__debug.valley` + `site()`, `library(n)`, `troc(clientId)`, `swap(clientId)`, `meet(cropId,
  n)`, `cross(cropId)`, `pair(cropId)`, `box()`, `story(id)`.

### Sprites (paquet ART : planche `assets/sprites/valley2.png`, `assets/sprites/generate-valley2.py`, bloc `// <valley2:auto>`)

Même méthode que `generate-valley1.py` (palette Kenney, contour sombre (63, 38, 49), lumière en haut à gauche, tuiles de
16 px). **16 × 16** sauf mention. Réutilisés : portraits des clients (`portrait.client.<id>`), `portrait.joseph`,
`seedpack.heirloom`, `wild.hint.note` / `.feather` / `.tracks`, `valley.box`, `story.box`.

| Nom(s) | Taille | Description |
|---|---|---|
| `heirloom.<id>.icon` (carotteViolette, marteauDesVertus, barbuDuRoussillon, coeurDeBoeufDesVertus, noireDeCrimee, blancDesLandes, veloursRouge, bleueDArtois, madameMoutot, blancheDeVirginie, galeuseDEysines, apiEtoile) | 16 × 16 | carotte violette au cœur orange ; navet long blanc à collet violet ; gerbe de blé doré aux longues barbes ; chou pointu vert tendre ; tomate côtelée brun-noir à épaules vertes ; épi de maïs blanc crème ; tournesol à pétales rouge sombre veloutés ; pomme de terre bleu-violet coupée (chair bleue) ; grosse fraise ronde rouge vif ; courgette ronde blanc-vert pâle ; citrouille saumon couverte de petites bosses ; petite pomme rouge et jaune à cinq côtes en étoile |
| `heirloom.<id>.4` (les 11 cultures du village) | 16 × 16 | stade mûr sur la parcelle (cadrage de `crop.<id>.4`, couleurs de la variété) |
| `heirloom.apiEtoile.fruit` | 16 × 16 | petites pommes étoilées posées sur le pommier adulte |
| `heirloom.<crossId>.icon`, `heirloom.<crossId>.4` (crossCarrot … crossPumpkin) | 16 × 16 | les 11 croisées, mélange visible des deux parents (carotte orangée au cœur pourpre ; navet doré allongé ; blé roux barbu ; chou cloqué pointu ; tomate côtelée presque noire ; épi roux et blanc mêlé ; tournesol or au cœur velours ; pomme de terre marbrée violet-bleu ; petite fraise conique très rouge ; courgette ronde pâle ; citrouille rouge vif galeuse) ; **petit sceau doré** dans le coin bas droit des icônes |
| `heirloom.coeurDeBoeufDesVertus.giant`, `heirloom.crossCabbage.giant`, `heirloom.crossPumpkin.giant` | 32 × 32 | chou pointu géant ; chou croisé géant ; citrouille croisée géante |
| `library.site` | 32 × 32 | coin d'herbe tondue, piquets et ficelle, panneau de bois « ? » (emplacement de la Grainothèque) |
| `library.1` … `library.5` | 32 × 32 | remise de pierre sèche à porte bleue → + auvent, tresses de maïs, banc → maison de pierre, enseigne « Grainothèque » → + jardin d'essai clos, ruche en paille → + rosier grimpant, porte ouverte (lisibles à 2 × 2 tuiles) |
| `library.window` | 16 × 16 | fenêtre aux bocaux qui brillent (superposée le soir, facultative) |
| `troc.pin` | 16 × 16 | sachet kraft épinglé d'une punaise rouge (sur le tableau du village) |
| `seedpack.village` · `seedpack.cross` | 16 × 16 | sachet à fleurs fermé d'une ficelle bleue ; sachet doré à l'étoile |
| `jar.empty` · `jar.glass` | 16 × 16 | bocal vide (silhouette des variétés à trouver) ; reflet de verre posé sur une icône (l'étagère) |
| `shelf.wood` | 16 × 16 | planche d'étagère (autotuile horizontale, fond de la vitrine) |
| `wild.wildBee`, `.1` · `wild.blackbird`, `.1` · `wild.lizard`, `.1` · `wild.bat`, `.1` | 16 × 16 | osmie rousse et noire (posée / en vol) ; merle noir au bec jaune (chantant / sautillant) ; lézard gris-brun sur une pierre (immobile / queue qui bouge) ; pipistrelle brune (ailes ouvertes / repliée) |
| `wild.hint.mud`, `wild.hint.tail`, `wild.hint.moon` | 16 × 16 | bouchons de terre au bout de tiges creuses ; petite queue qui file entre deux pierres ; croissant de lune et petite ombre ailée |
| `nature.batbox`, `icon.nature.batbox` | 16 × 16 | caisse plate de bois sombre, fente en bas, sur un mur ; picto |
| `icon.trait.scented` | 16 × 16 | petite fleur et trois traits ondulés (lisible en niveaux de gris) |
| `icon.library`, `icon.swap`, `icon.cross` | 16 × 16 | petite maison de pierre à bocal ; deux sachets et deux flèches en rond ; deux fleurs reliées par une abeille |
| `fx.pollen`, `fx.pollen.1` | 8 × 8 | petite abeille / points de pollen dorés (2 images) |
| `story.library`, `story.cross`, `story.library5` | 48 × 32 | vignettes : Joseph montre un coin d'herbe derrière la maison ; deux fleurs côte à côte et une abeille au soleil ; la grainothèque fleurie et des visiteurs |
| `album.page.swaps`, `album.page.crosses`, `album.page.wildlife2` | 16 × 16 | onglets : deux sachets ; sceau doré ; plume de merle |
| `decor.swap.basket`, `decor.cross.sign`, `decor.lizard.wall` | 16 × 16 | panier d'osier plein de sachets ; enseigne de bois « Ferme semencière » ; muret de pierres sèches et son lézard |
| `icon.ach.<id>` (firstSwap, villageSeeds, firstCross, farmHeritage, livingLibrary, valleyFriends) | 16 × 16 | icônes des 6 succès (versions grisées par le code) |

`CREDITS.md` : planche dessinée pour le jeu, style Kenney (CC0), comme `valley1.png`.

### Découpage en 3 paquets parallèles

| Paquet | Possède (seul à modifier) | Livre | Attend |
|---|---|---|---|
| **CORE** | `src/data/career/{heritage,valley}.js`, `src/core/career/{heritage,heirlooms,habitat,valley,runtime,staff}.js`, `src/core/{cozy,game,album}.js` (ajouts gardés), `src/data/{album,achievements,cosmetics,cozy}.js`, `tools/{simulate-career,sim-career-staff}.js`, `tests/*` | état, actions, requêtes, événements, progression, migration ; simulation et réglage ; § 16.12 de `docs/VALLEE.md` rempli | rien (commence par `heritage: false` = V1 exact, empreinte vérifiée, puis : données → traits en liste → Grainothèque → troc → croisements → habitants → récits) |
| **ART** | `assets/sprites/generate-valley2.py`, `assets/sprites/valley2.png`, bloc `// <valley2:auto>` d'`atlas.js`, `CREDITS.md` | planche et noms du tableau ; planche de contrôle × 6 | rien |
| **UI/RENDER** | `src/ui/*` (nouveau `src/ui/career/heritage.js`), `css/valley.css`, `src/main.js`, `src/index.template.html`, `src/render/*` (hors bloc `valley2:auto`) | fiche de la Grainothèque, troc, croisement, mode paire, récits, « Revoir la boîte », lignes des fiches existantes, carte du tableau, scène, hit-test, conseils, débogage ; vérification au doigt | CORE : API (factices en attendant) ; ART : sprites (repli) |

Points de contact : (1) **CORE → UI/RENDER** : formes `trocInfo`, `valley().library / swaps / crosses / box / stories`,
`valleyCrossLinks()`, `valleyPairPlots()`, `query.plot(i).variety.cross`, `plantableCrops().heirlooms[].pair`, l'ordre
des événements (aube : `storyAvailable`, `trocOffered`, habitants du V2 après ceux du V1 ; récolte : `harvested` →
`heirloomHarvest` → `heirloomFixed` → `crossMeeting` → `crossFound`), les hits `seedLibrary` / `pairPlot` (figés ici ;
écarts notés par CORE dans « Écarts et précisions (livraison CORE V2) ») ; (2) **ART → RENDER/UI** : noms du tableau des
sprites ; (3) **CORE ↔ ART** : identifiants des 23 variétés, des 4 espèces, de `batbox`, des récits, décors, succès
(figés ici et au § 16 de `docs/VALLEE.md`) ; (4) **RENDER ↔ CORE** : voisinage des parcelles (même règle col / row que
`query.plot(i)` ; test commun : chaque paire de `valleyCrossLinks()` est dessinée côte à côte), emplacements `bat` et
rectangle de la Grainothèque ; (5) intégration (chef de projet) : sauvegarde `backup/avant-vallee-v2-…` (faite), `node
--test tests/`, `node tools/simulate-career.js --compare-valley2` et `--compare-valley`, `node tools/simulate.js`
(identique), `node tools/capture-parity.js --check`, `node tools/build.js`, vérification au doigt (Pixel 7 et 360 × 740 :
une carrière V1 reprise au rang 3 → récit et panneau, Grainothèque construite et agrandie, troc de la foire puis de
saison au tableau, paire semée, deux rencontres et un croisement, variété du village sauvée, « Revoir la boîte », un
habitant du V2 observé, nichoir à chauves-souris posé ; mouvements réduits, texte à 150 % ; une partie de niveau
Classique identique), `JOURNAL.md`, sauvegarde `backup/vallee-v2-…` à la fin.
