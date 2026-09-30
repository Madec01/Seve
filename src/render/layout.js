// Disposition de la scène, en « pixels du monde » (tuiles de 16 px), pour un niveau donné.
//
// Le monde fait 32 × 20 tuiles (512 × 320 px) : seule la taille du champ change. Tout ce qui dépasse
// du monde (bandes autour, à l'écran) est de la forêt, sauf la route qui traverse la scène de part en
// part. (v3) Quand un niveau propose à la fois les vaches et les chèvres (ou le moulin), une bande de
// 6 lignes s'ajoute en haut (monde de 32 × 26) : enclos des chèvres + fromagerie à gauche, moulin et
// four à pain à droite ; tout le reste descend de 6 lignes. Sans vaches, les chèvres prennent le pré
// des vaches et la fromagerie la place de la grange. L'atelier de confitures se pose sous le champ,
// à droite du chemin.
//
// Plan (x → droite, y → bas, en tuiles) :
//
//   y 0-1   forêt ────────────────────────────────────────────────────────────────
//   y 2-8   poulailler + cour │        champ clôturé (grille ancrée en bas,       │ vaches : pré + grange
//   y 9     ruches (fleurs)   │        portail au milieu du bas)                   │
//   y 10-14 maison + panneaux │  chambre d'hôte + jardin │ chemin │               │ moutons : pré + foin
//   y 15-16 puits, sentier    │                          │ chemin │ étal (route)
//   y 17-18 route ─────────────────────────────────────────────────────────────────
//   y 19    forêt (cimes)
//
// createLayout(level) → objet décrit plus bas ; hitTest(worldX, worldY, owned?) et plotRect(i).
// Aucune dépendance au DOM.

import { TILE } from './atlas.js';
import { seededRandom, tileHash, px, sprinklerHeads, makeQueries, findFreeArea, decorSlot, levelTheme, pickDeco } from './layout-common.js';
import { createPortraitLayout } from './layout-portrait.js';

export const WORLD_COLS = 32;
export const WORLD_ROWS = 20;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;
const BAND_ROWS = 6; // (v3) bande du haut : chèvres, fromagerie, moulin

const MAIN_PATH_X = 15; // chemin du portail du champ jusqu'à la route
const FIELD_CENTER_X = 16;

export { seededRandom, tileHash };

/**
 * @param level  objet niveau (src/data/levels.js) : gridCols, gridRows, availableInvestments,
 *               modifiers.noSprinkler, id.
 */
export function createLayout(level, opts = {}) {
  if (opts.mode === 'portrait') return createPortraitLayout(level);
  const cols = Math.max(1, Math.min(8, level.gridCols || 6));
  const rows = Math.max(1, Math.min(5, level.gridRows || 4));
  const available = new Set(
    (level.availableInvestments || []).filter((id) => !(id === 'sprinkler' && level.modifiers?.noSprinkler)),
  );
  const has = (id) => available.has(id);
  const theme = levelTheme(level);
  // (v3) Bande du haut : seulement si chèvres/fromagerie ET vaches, ou moulin.
  const band = ((has('goat') || has('dairy')) && has('cow')) || has('mill');
  const BY = band ? BAND_ROWS : 0;
  const ROWS_N = WORLD_ROWS + BY;
  const WH = ROWS_N * TILE;
  const ROAD_Y = 17 + BY; // route : 2 lignes
  const FIELD_BOTTOM_ROW = 8 + BY; // dernière ligne de parcelles (grille ancrée en bas)

  // ── Champ ─────────────────────────────────────────────────────────────────────────
  const gx = FIELD_CENTER_X - Math.ceil(cols / 2);
  const gy = FIELD_BOTTOM_ROW + 1 - rows;
  const fence = { x: gx - 1, y: gy - 2, w: cols + 2, h: rows + 4 }; // marge d'une ligne en haut et en bas
  let gateX = MAIN_PATH_X;
  if (gateX <= fence.x) gateX = fence.x + 1;
  if (gateX >= fence.x + fence.w - 1) gateX = fence.x + fence.w - 2;
  const gate = { x: gateX, y: fence.y + fence.h - 1 };
  const field = { gx, gy, cols, rows, fence, gate };

  const plots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      plots.push({ index: r * cols + c, col: c, row: r, x: (gx + c) * TILE, y: (gy + r) * TILE, w: TILE, h: TILE });
    }
  }

  // ── Bâtiments et emplacements fixes (tuiles) ──────────────────────────────────────
  const house = { x: 3, y: 11 + BY, w: 4, h: 3, door: { x: 5, y: 13 + BY } };
  const well = { x: 1, y: 12 + BY, w: 1, h: 2 };

  // Arrosage automatique : têtes dans les marges haute et basse du champ, selon le niveau (2/4/6).
  const sprinklerTiles = sprinklerHeads(gx, gy, cols, rows, gate);

  const slots = {
    chickenCoop: {
      shed: { x: 1, y: 4 + BY, w: 2, h: 3 },
      fence: { x: 3, y: 3 + BY, w: 6, h: 5 },
      pen: { x: 4, y: 4 + BY, w: 4, h: 3 },
      gate: null,
      sign: { x: 5, y: 5 + BY },
      perUnit: 3, // poules par poulailler
    },
    beehive: {
      hives: [{ x: 2, y: 9 + BY }, { x: 3, y: 9 + BY }, { x: 4, y: 9 + BY }],
      area: { x: 1, y: 8 + BY, w: 5, h: 2 },
      sign: { x: 3, y: 9 + BY },
    },
    cow: {
      barn: { x: 28, y: 3 + BY, w: 3, h: 6 },
      fence: { x: 22, y: 3 + BY, w: 6, h: 6 },
      pen: { x: 23, y: 4 + BY, w: 4, h: 4 },
      sign: { x: 24, y: 5 + BY },
    },
    sheep: {
      fence: { x: 22, y: 10 + BY, w: 6, h: 5 },
      pen: { x: 23, y: 11 + BY, w: 4, h: 3 },
      extras: { x: 28, y: 11 + BY, w: 3, h: 3 },
      sign: { x: 24, y: 12 + BY },
    },
    roadsideStand: {
      cart: { x: 19, y: 16 + BY },
      crates: [{ x: 18, y: 16 + BY }, { x: 20, y: 16 + BY }, { x: 21, y: 16 + BY }],
      area: { x: 18, y: 16 + BY, w: 4, h: 1 },
      sign: { x: 19, y: 16 + BY },
    },
    sprinkler: {
      units: sprinklerTiles,
      perLevel: [2, 4, 6],
      sign: { x: fence.x + fence.w, y: fence.y + fence.h - 1 }, // juste à droite du coin bas du champ
    },
    solarPanel: {
      units: [{ x: 7, y: 13 + BY }, { x: 8, y: 13 + BY }],
      area: { x: 7, y: 13 + BY, w: 2, h: 1 },
      sign: { x: 7, y: 13 + BY },
    },
    guestHouse: {
      house: { x: 10, y: 12 + BY, w: 4, h: 3, door: { x: 12, y: 14 + BY } },
      garden: { x: 9, y: 15 + BY, w: 5, h: 2 },
      sign: { x: 11, y: 13 + BY },
    },
  };
  // (v3) Chèvres et fromagerie : bande du haut, ou pré et grange des vaches si le niveau n'en a pas.
  if (has('goat')) {
    slots.goat = band
      ? { fence: { x: 2, y: 2, w: 6, h: 5 }, pen: { x: 3, y: 3, w: 4, h: 3 }, sign: { x: 4, y: 4 } }
      : { fence: { x: 22, y: 3, w: 6, h: 6 }, pen: { x: 23, y: 4, w: 4, h: 4 }, sign: { x: 24, y: 5 } };
  }
  if (has('dairy')) {
    slots.dairy = band
      ? { building: { x: 8, y: 3, w: 3, h: 3 }, sign: { x: 9, y: 4 } }
      : { building: { x: 28, y: 4, w: 3, h: 3 }, sign: { x: 29, y: 5 } };
  }
  if (has('mill')) {
    slots.mill = band
      ? { building: { x: 22, y: 2, w: 3, h: 4 }, bakery: { x: 25, y: 4, w: 2, h: 2 }, sign: { x: 23, y: 4 } }
      : { building: { x: 9, y: 3 + BY, w: 3, h: 4 }, bakery: null, sign: { x: 10, y: 5 + BY } };
  }
  if (has('jamWorkshop')) slots.jamWorkshop = { building: { x: 17, y: 12 + BY, w: 3, h: 3 }, sign: { x: 18, y: 13 + BY } };
  // Le panneau « à vendre » de l'arrosage ne doit pas tomber sur le pré des vaches ou le chemin.
  if (slots.sprinkler.sign.x >= 22) slots.sprinkler.sign = { x: fence.x - 1, y: fence.y + fence.h - 1 };

  // ── Chemins (masque de tuiles) ───────────────────────────────────────────────────
  const pathSet = new Set();
  const addPath = (x, y) => pathSet.add(`${x},${y}`);
  for (let y = gate.y + 1; y < ROAD_Y; y++) addPath(MAIN_PATH_X, y); // portail → route
  for (let y = house.door.y + 1; y < ROAD_Y; y++) addPath(house.door.x, y); // maison → route
  const gh = slots.guestHouse.house;
  const guestPath = new Set();
  for (let x = gh.door.x; x < MAIN_PATH_X; x++) guestPath.add(`${x},${gh.door.y + 1}`); // chambre d'hôte → chemin

  /**
   * true si la tuile (même hors du monde) est un chemin ou la route.
   * @param withGuest  inclure le sentier de la chambre d'hôte (quand elle est construite)
   */
  function isPath(tx, ty, withGuest = false) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return true;
    const k = `${tx},${ty}`;
    return pathSet.has(k) || (withGuest && guestPath.has(k));
  }

  /** true si la tuile (même hors du monde) est de la forêt. */
  function isForest(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return false;
    if (ty <= 1 || ty >= ROWS_N - 1) return true;
    return tx <= 0 || tx >= WORLD_COLS - 1;
  }

  // ── Occupation (pour le décor) ───────────────────────────────────────────────────
  const occ = new Uint8Array(WORLD_COLS * ROWS_N);
  const mark = (r, pad = 0) => {
    for (let y = r.y - pad; y < r.y + r.h + pad; y++) {
      for (let x = r.x - pad; x < r.x + r.w + pad; x++) {
        if (x >= 0 && y >= 0 && x < WORLD_COLS && y < ROWS_N) occ[y * WORLD_COLS + x] = 1;
      }
    }
  };
  mark(fence);
  mark({ x: fence.x, y: fence.y + fence.h, w: fence.w, h: 1 }); // devant le portail
  mark(house);
  mark({ x: house.x, y: house.y + house.h, w: house.w, h: 1 });
  mark(well);
  // Accessoires fixes autour de la maison
  const props = [
    { name: 'barrel', x: 2, y: 13 + BY, dy: 1 },
    { name: 'bucket.water', x: 2, y: 14 + BY, dx: 2, dy: -3 },
  ];
  for (const p of props) mark({ x: p.x, y: p.y, w: 1, h: 1 });
  if (has('chickenCoop')) {
    mark(slots.chickenCoop.shed);
    mark(slots.chickenCoop.fence);
  }
  if (has('beehive')) mark(slots.beehive.area);
  if (has('cow')) {
    mark(slots.cow.barn);
    mark({ x: slots.cow.barn.x, y: slots.cow.barn.y + slots.cow.barn.h, w: 3, h: 1 });
    mark(slots.cow.fence);
  }
  if (has('sheep')) {
    mark(slots.sheep.fence);
    mark(slots.sheep.extras);
  }
  if (has('roadsideStand')) mark({ x: 17, y: 15 + BY, w: 6, h: 2 }); // étal et ses abords
  else mark({ x: 17, y: 16 + BY, w: 5, h: 1 });
  if (has('solarPanel')) {
    mark(slots.solarPanel.area);
    mark({ x: 7, y: 12 + BY, w: 2, h: 1 });
  }
  if (slots.goat) mark(slots.goat.fence);
  for (const id of ['dairy', 'jamWorkshop']) if (slots[id]) mark({ ...slots[id].building, h: slots[id].building.h + 1 });
  if (slots.mill) {
    mark({ ...slots.mill.building, h: slots.mill.building.h + 1 });
    if (slots.mill.bakery) mark({ ...slots.mill.bakery, h: 3 });
  }
  if (has('guestHouse')) {
    mark(gh);
    mark(slots.guestHouse.garden);
    for (const k of guestPath) {
      const [x, y] = k.split(',').map(Number);
      mark({ x, y, w: 1, h: 1 });
    }
  }
  if (has('sprinkler')) mark({ x: slots.sprinkler.sign.x, y: slots.sprinkler.sign.y, w: 1, h: 1 });
  for (const k of pathSet) {
    const [x, y] = k.split(',').map(Number);
    mark({ x, y, w: 1, h: 1 });
  }
  const free = (x, y) => x >= 1 && y >= 2 && x < WORLD_COLS - 1 && y < ROAD_Y && !occ[y * WORLD_COLS + x];

  // ── (v3) Emplacements de décoration ─────────────────────────────────────────────
  const sign = { x: 12, y: 16 + BY, w: 3, h: 1 }; // panneau de la ferme, 3 tuiles
  const decorSlots = [];
  // force : emplacement sur une ligne réservée (devant la maison, jardin) mais libre.
  const addSlot = (id, x, y, kind = 'small', w = 1, h = 1, force = false) => {
    if (!force) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!free(i, j)) return;
    decorSlots.push(decorSlot(id, kind, x, y, w, h));
    mark({ x, y, w, h });
  };
  addSlot('sign', sign.x, sign.y, 'sign', 3, 1, true);
  addSlot('porch.left', house.door.x - 1, house.y + house.h, 'small', 1, 1, true);
  addSlot('porch.right', house.door.x + 1, house.y + house.h, 'small', 1, 1, true);
  addSlot('yard.1', 1, 15 + BY);
  addSlot('yard.2', 7, 15 + BY);
  // Devant le portail : la ligne est réservée (marquée) ; on la libère pour ses deux emplacements.
  for (const dx of [-1, 1]) {
    const gx2 = gate.x + dx;
    const gy2 = gate.y + 1;
    decorSlots.push(decorSlot(dx < 0 ? 'gate.left' : 'gate.right', 'small', gx2, gy2));
  }
  addSlot('road.1', 3, 16 + BY);
  addSlot('road.2', 24, 16 + BY);
  addSlot('road.3', 27, 16 + BY);
  if (!sprinklerTiles.some((t) => t.x === gx && t.y === gy - 1)) decorSlots.push(decorSlot('field.corner', 'small', gx, gy - 1));
  {
    const spot = findFreeArea(free, { x0: 1, y0: 2, x1: WORLD_COLS - 2, y1: ROAD_Y - 1 }, 2, 2, { x: house.x + 2, y: house.y });
    if (spot) addSlot('pond', spot.x, spot.y, 'large', 2, 2);
  }

  // ── Décor fixe (graine du niveau) ─────────────────────────────────────────────────
  // kind : 'tree' (1×1), 'treeTall' (1×2, ancré en bas), 'bush', 'berry', 'rocks', 'rocksBig',
  //        'stump', 'log', 'mushrooms', 'fern', 'weeds', 'flowers' (tuile de sol), 'tufts' (sol)
  const deco = [];
  const rnd = seededRandom(0x5eed + (level.id || 1) * 977);
  const take = (x, y) => { occ[y * WORLD_COLS + x] = 1; };
  // Lisières gauche/droite : grands arbres pour adoucir la coupe nette de la forêt.
  for (let y = 3; y < ROAD_Y - 1; y++) {
    for (const x of [1, WORLD_COLS - 2]) {
      if (free(x, y) && free(x, y - 1) && rnd() < 0.55) {
        deco.push({ kind: theme === 'mountain' ? 'pineTall' : 'treeTall', x: x * TILE + (x === 1 ? -3 : 3), y: y * TILE, tx: x, ty: y });
        take(x, y);
        take(x, y - 1);
      }
    }
  }
  // Sous la forêt du haut : quelques arbres.
  for (let x = 1; x < WORLD_COLS - 1; x++) {
    if (free(x, 2) && rnd() < 0.3) {
      const k0 = rnd() < 0.5 ? 'tree' : 'bush';
      deco.push({ kind: theme === 'mountain' && k0 === 'tree' ? 'pine' : k0, x: x * TILE, y: 2 * TILE, tx: x, ty: 2 });
      take(x, 2);
    }
  }
  // Parterre de fleurs autour des ruches (sol).
  for (let y = 8 + BY; y <= 10 + BY; y++) {
    for (let x = 1; x <= 6; x++) {
      const isHive = y === 9 + BY && x >= 2 && x <= 4;
      if (!isHive && !(x === house.x && y === 10)) deco.push({ kind: 'flowerbed', x: x * TILE, y: y * TILE, tx: x, ty: y });
    }
  }
  // Semis aléatoire.
  for (let y = 2; y < ROAD_Y; y++) {
    for (let x = 1; x < WORLD_COLS - 1; x++) {
      if (!free(x, y)) continue;
      const kind = pickDeco(rnd(), theme, free(x, y - 1));
      if (!kind) continue;
      const jx = Math.floor(rnd() * 5) - 2;
      const jy = Math.floor(rnd() * 3) - 1;
      deco.push({ kind, x: x * TILE + jx, y: y * TILE + jy, tx: x, ty: y });
      take(x, y);
      if (kind === 'treeTall' || kind === 'pineTall') take(x, y - 1);
    }
  }
  // Jardin de la chambre d'hôte (visible seulement si achetée) : fleurs et haie.
  const gardenFlowers = [{ x: 9, y: 15 + BY }, { x: 10, y: 15 + BY }, { x: 11, y: 15 + BY }, { x: 10, y: 16 + BY }, { x: 11, y: 16 + BY }];
  const gardenBushes = [{ x: 9, y: 13 + BY }, { x: 9, y: 14 + BY }, { x: 9, y: 16 + BY }];
  const gardenPlants = [{ x: 10, y: 15 + BY, dx: 2, dy: -2 }, { x: 11, y: 15 + BY, dx: -1, dy: 1 }];

  // ── Fermier : maison, et trajet jusqu'au champ ───────────────────────────────────
  const T = TILE;
  const farmerHome = { x: house.door.x * T + 8, y: (house.door.y + 1) * T + 12 };
  const routeToField = [
    { x: house.door.x * T + 8, y: ROAD_Y * T + 10 },
    { x: MAIN_PATH_X * T + 8, y: ROAD_Y * T + 10 },
    { x: gate.x * T + 8, y: gate.y * T + 12 },
    { x: gate.x * T + 8, y: (gate.y - 1) * T + 12 },
  ];

  // ── Accessoires des emplacements (px ; dessinés quand l'emplacement est acheté) ─────
  // sheet : 'season' (planches de la saison) ou 'base' (planches d'origine).
  {
    const e = slots.sheep.extras;
    slots.sheep.props = [
      { name: 'hay', sheet: 'season', x: e.x * T, y: e.y * T },
      { name: 'hay.tied', sheet: 'season', x: (e.x + 1) * T, y: e.y * T + 2 },
      { name: 'trough.wood.water', sheet: 'season', x: e.x * T + 4, y: (e.y + 2) * T - 2 },
    ];
    const b = slots.cow.barn;
    slots.cow.props = [
      { name: 'bucket.milk', sheet: 'season', x: b.x * T - 2, y: (b.y + b.h) * T - 2 },
      { name: 'hay.tied', sheet: 'season', x: (b.x + 2) * T + 2, y: (b.y + b.h) * T - 1 },
    ];
    const s = slots.chickenCoop.shed;
    slots.chickenCoop.props = [{ name: 'egg', sheet: 'base', x: s.x * T + 1, y: (s.y + s.h) * T - 3 }];
  }

  // ── Requêtes ─────────────────────────────────────────────────────────────────────
  const q = makeQueries({ plots, slots, available, field, width: WORLD_W, height: WH, solarExtendUp: 1 });

  /** Voisines (même ligne à l'écran) d'une parcelle : index à gauche / à droite, ou -1. */
  function plotNeighbors(index) {
    const c = index % cols;
    return { left: c > 0 ? index - 1 : -1, right: c < cols - 1 ? index + 1 : -1 };
  }

  return {
    TILE,
    cols: WORLD_COLS,
    rows: ROWS_N,
    width: WORLD_W,
    height: WH,
    level,
    available,
    field,
    plots,
    house,
    well,
    props,
    slots,
    decorSlots,
    sign,
    slotIds: Object.keys(slots),
    roadY: ROAD_Y,
    mainPathX: MAIN_PATH_X,
    deco,
    garden: { flowers: gardenFlowers, bushes: gardenBushes, plants: gardenPlants },
    farmerHome,
    routeToField,
    isPath,
    isForest,
    mode: 'landscape',
    theme,
    plotSize: TILE, // côté d'une parcelle (px du monde)
    plotScale: 1, // échelle de dessin des cultures et de la terre
    transposed: false,
    // Partie à toujours garder visible (px du monde) : ici tout le monde.
    essential: { x: 0, y: 0, w: WORLD_W, h: WH },
    fieldRect: px(fence),
    plotNeighbors,
    slotTiles: q.slotTiles,
    plotRect: q.plotRect,
    plotCenter: q.plotCenter,
    investmentRect: q.investmentRect,
    investmentAnchor: q.investmentAnchor,
    hitTest: q.hitTest,
    hitTestNear: q.hitTestNear,
  };
}
