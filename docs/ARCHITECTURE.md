# Architecture — « Une année à la ferme »

HTML + CSS + JavaScript (modules ES natifs), **sans dépendance ni compilation**. Canvas 2D pour la scène, DOM/CSS pour l'interface. Servi en HTTP statique (`python3 -m http.server`).

## Arborescence

```
index.html                 page unique (canvas + conteneurs d'interface)
css/style.css              styles de l'interface (police Pixelify Sans, bordures Kenney en border-image)
src/
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
  ui/                      interface DOM
    hud.js, shop.js, dialogs.js, tooltip.js, tutorial.js, menu.js …
  audio/
    audio.js               musique (fondus), ambiances, effets sonores, volumes
  storage.js               localStorage (partie, progression, options) avec try/catch
assets/
  sprites/                 packs Kenney (Tiny Farm, Tiny Town, UI Pack Pixel Adventure)
  audio/music/             Sirental (ogg)
  audio/sfx/               Kenney + Freesound
  audio/ambience/          Freesound (oiseaux, pluie, vent)
  fonts/                   Pixelify Sans (OFL)
tests/                     tests Node : `node --test tests/` (tests/index.js charge les *.test.js) ou `node --test`
tools/simulate.js          simulation d'équilibrage (joueurs-robots par niveau)
```

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
- `loadGame()` lève une erreur si l'objet est invalide, d'une autre version (`STATE_VERSION`) ou d'un niveau inconnu. Les données de niveau ne sont pas copiées dans la sauvegarde : elles sont relues dans `src/data/` au chargement.

## Règles de code

- `src/core` et `src/data` n'importent jamais le DOM ni `window` ; tout l'aléatoire passe par `rng.js` (graine dans l'état → parties reproductibles, tests déterministes).
- L'état est **uniquement** modifié par `game.update()` et `game.actions.*`.
- Les textes affichés au joueur sont en français ; les identifiants (`carrot`, `chickenCoop`…) en anglais.
- Rendu pixel art : `imageSmoothingEnabled = false`, zoom entier, canvas redimensionné à la fenêtre.
- Chemins relatifs uniquement (le jeu doit fonctionner dans un sous-dossier, ex. GitHub Pages).
