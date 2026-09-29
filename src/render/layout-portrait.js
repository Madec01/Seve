// Disposition « portrait » de la scène (téléphone tenu droit), en pixels du monde (tuiles de 16 px).
//
// Le monde fait 14 tuiles de large ; les colonnes 0 et 13 sont de la forêt, que la caméra peut
// rogner : la partie « essentielle » (champ, bâtiments, enclos) tient dans les 12 colonnes du
// milieu (x 1 à 12). La hauteur dépend du niveau : les bandes des investissements absents du
// niveau (vaches, chambre d'hôte…) sont retirées, le monde se resserre.
//
// Les parcelles font 2 × 2 tuiles (32 px) : cultures et terre sont dessinées à l'échelle ×2.
// Quand la grille du niveau est plus large que haute (6 × 4 par exemple), elle est affichée
// transposée (4 colonnes × 6 lignes à l'écran) pour tenir dans la largeur du téléphone ; les
// index restent ceux du cœur de jeu (index = ligne × gridCols + colonne), seule la position à
// l'écran change.
//
// Plan (x → droite, y → bas, en tuiles ; grille 6 × 4, tous les investissements) :
//
//   y 0-1    forêt ──────────────────────────────
//   y 2      lisière (arbres, buissons)
//   y 3-8    pré des vaches (clôture x 2-7) │ grange (x 8-10)
//   y 9      seau de lait, foin
//   y 10-14  poulailler (cabane x 1-2, cour x 3-7) │ moutons (x 8-12)
//   y 15     foin, abreuvoir des moutons
//   y 16-31  champ clôturé (x 2-11), ruches à gauche (x 1), portail en bas (x 7)
//   y 32     panneaux solaires (x 5-6), chemin du portail (x 7)
//   y 33-35  puits (x 1), maison (x 2-5) │ chemin │ chambre d'hôte (x 8-11), jardin
//   y 36     chemins vers la route
//   y 37-38  route ──────────────────────────────
//   y 39     étal au bord de la route (x 8-11)
//   y 40-41  forêt ──────────────────────────────

import { TILE } from './atlas.js';
import { seededRandom, px, sprinklerHeads, makeQueries } from './layout-common.js';

export const PORTRAIT_COLS = 14;
const COLS = PORTRAIT_COLS;
const PLOT_TILES = 2; // côté d'une parcelle, en tuiles
const MAIN_PATH_X = 7;
const USABLE_X0 = 1; // première / dernière colonne utilisable (hors forêt)
const USABLE_X1 = COLS - 2;

/**
 * @param level  objet niveau (src/data/levels.js) : gridCols, gridRows, availableInvestments,
 *               modifiers.noSprinkler, id.
 */
export function createPortraitLayout(level) {
  const T = TILE;
  const cols = Math.max(1, Math.min(8, level.gridCols || 6));
  const rows = Math.max(1, Math.min(5, level.gridRows || 4));
  const available = new Set(
    (level.availableInvestments || []).filter((id) => !(id === 'sprinkler' && level.modifiers?.noSprinkler)),
  );
  const has = (id) => available.has(id);

  // Grille affichée : transposée si elle est plus large que haute.
  const transposed = cols > rows;
  const vCols = transposed ? rows : cols;
  const vRows = transposed ? cols : rows;

  let y = 3; // lignes 0-1 : forêt ; ligne 2 : lisière

  // ── Vaches : pré + grange ─────────────────────────────────────────────────────────
  const cowY = y;
  const cow = {
    fence: { x: 2, y: cowY, w: 6, h: 6 },
    pen: { x: 3, y: cowY + 1, w: 4, h: 4 },
    barn: { x: 8, y: cowY, w: 3, h: 6 },
    sign: { x: 4, y: cowY + 2 },
  };
  if (has('cow')) y += 7; // 6 lignes + l'avant de la grange

  // ── Poulailler et moutons ─────────────────────────────────────────────────────────
  const penY = y;
  const chickenCoop = {
    shed: { x: 1, y: penY + 1, w: 2, h: 3 },
    fence: { x: 3, y: penY, w: 5, h: 5 },
    pen: { x: 4, y: penY + 1, w: 3, h: 3 },
    gate: null,
    sign: { x: 5, y: penY + 2 },
    perUnit: 3, // poules par poulailler
  };
  const sheep = {
    fence: { x: 8, y: penY, w: 5, h: 5 },
    pen: { x: 9, y: penY + 1, w: 3, h: 3 },
    extras: { x: 9, y: penY + 5, w: 4, h: 1 },
    extrasInArea: true,
    sign: { x: 10, y: penY + 2 },
  };
  const hasPens = has('chickenCoop') || has('sheep');
  if (hasPens) y += 6; // 5 lignes + foin / abreuvoir

  // ── Champ ─────────────────────────────────────────────────────────────────────────
  const fw = vCols * PLOT_TILES + 2;
  const fh = vRows * PLOT_TILES + 4; // marge d'une ligne en haut et en bas (arroseurs)
  const fx = Math.floor((COLS - fw) / 2);
  const fy = y;
  const fence = { x: fx, y: fy, w: fw, h: fh };
  const gx = fx + 1;
  const gy = fy + 2;
  let gateX = MAIN_PATH_X;
  if (gateX <= fence.x) gateX = fence.x + 1;
  if (gateX >= fence.x + fence.w - 1) gateX = fence.x + fence.w - 2;
  const gate = { x: gateX, y: fence.y + fence.h - 1 };
  const field = { gx, gy, cols, rows, fence, gate, vCols, vRows, transposed };
  y += fh;

  const plots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vc = transposed ? r : c;
      const vr = transposed ? c : r;
      plots.push({
        index: r * cols + c, col: c, row: r, vcol: vc, vrow: vr,
        x: (gx + vc * PLOT_TILES) * T, y: (gy + vr * PLOT_TILES) * T, w: PLOT_TILES * T, h: PLOT_TILES * T,
      });
    }
  }
  const byVisual = new Map(plots.map((p) => [`${p.vcol},${p.vrow}`, p.index]));

  const sprinklerTiles = sprinklerHeads(gx, gy, vCols * PLOT_TILES, vRows * PLOT_TILES, gate);

  // Ruches : à gauche du champ s'il y a la place, sinon sur la lisière du haut.
  const sideL = fx - USABLE_X0; // colonnes libres à gauche du champ
  const fieldMid = fy + Math.floor(fh / 2);
  let hives;
  let hiveBed;
  if (sideL >= 1) {
    const xh = USABLE_X0 + Math.floor((sideL - 1) / 2);
    hives = [{ x: xh, y: fieldMid - 2 }, { x: xh, y: fieldMid }, { x: xh, y: fieldMid + 2 }];
    hiveBed = { x: Math.max(USABLE_X0, xh - 1), y: fieldMid - 3, w: Math.min(fx - 1, xh + 1) - Math.max(USABLE_X0, xh - 1) + 1, h: 7 };
  } else {
    hives = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }];
    hiveBed = { x: 1, y: 2, w: 5, h: 1 };
  }

  // ── Maison, puits, panneaux solaires, chambre d'hôte ──────────────────────────────
  const yb = y; // ligne juste sous le champ
  const house = { x: 2, y: yb + 1, w: 4, h: 3, door: { x: 4, y: yb + 3 } };
  const well = { x: 1, y: yb + 2, w: 1, h: 2 };
  const guest = { x: 8, y: yb + 1, w: 4, h: 3, door: { x: 10, y: yb + 3 } };
  const ROAD_Y = yb + 5; // route : 2 lignes
  const standY = ROAD_Y + 2;
  const ROWS = ROAD_Y + 5; // étal, puis 2 lignes de forêt

  // Panneau « à vendre » de l'arrosage : à droite du coin bas du champ, sinon sous le champ.
  let sprinklerSign = { x: fence.x + fence.w, y: fence.y + fence.h - 1 };
  if (sprinklerSign.x > USABLE_X1) sprinklerSign = { x: gate.x + 1, y: yb };

  const slots = {
    chickenCoop,
    beehive: {
      hives,
      area: hiveBed,
      sign: hives[1],
    },
    cow,
    sheep,
    roadsideStand: {
      cart: { x: 9, y: standY },
      crates: [{ x: 8, y: standY }, { x: 10, y: standY }, { x: 11, y: standY }],
      area: { x: 8, y: standY, w: 4, h: 1 },
      sign: { x: 9, y: standY },
    },
    sprinkler: {
      units: sprinklerTiles,
      perLevel: [2, 4, 6],
      sign: sprinklerSign,
    },
    solarPanel: {
      units: [{ x: 5, y: yb }, { x: 6, y: yb }],
      area: { x: 5, y: yb, w: 2, h: 1 },
      sign: { x: 5, y: yb },
    },
    guestHouse: {
      house: guest,
      garden: { x: 8, y: yb + 4, w: 5, h: 1 },
      sign: { x: 9, y: yb + 2 },
    },
  };

  // Accessoires des emplacements (px ; dessinés quand l'emplacement est acheté).
  {
    const e = sheep.extras;
    sheep.props = [
      { name: 'hay', sheet: 'season', x: e.x * T, y: e.y * T - 1 },
      { name: 'hay.tied', sheet: 'season', x: (e.x + 1) * T, y: e.y * T + 1 },
      { name: 'trough.wood.water', sheet: 'season', x: (e.x + 2) * T, y: e.y * T },
    ];
    const b = cow.barn;
    cow.props = [
      { name: 'bucket.milk', sheet: 'season', x: b.x * T - 2, y: (b.y + b.h) * T - 2 },
      { name: 'hay.tied', sheet: 'season', x: (b.x + 3) * T - 2, y: (b.y + b.h) * T - 4 },
    ];
    const s = chickenCoop.shed;
    chickenCoop.props = [{ name: 'egg', sheet: 'base', x: s.x * T + 1, y: (s.y + s.h) * T - 3 }];
  }

  // ── Chemins (masque de tuiles) ───────────────────────────────────────────────────
  const pathSet = new Set();
  const addPath = (x, yy) => pathSet.add(`${x},${yy}`);
  for (let yy = gate.y + 1; yy < ROAD_Y; yy++) addPath(MAIN_PATH_X, yy); // portail → route
  for (let yy = house.door.y + 1; yy < ROAD_Y; yy++) addPath(house.door.x, yy); // maison → route
  const guestPath = new Set();
  for (let yy = guest.door.y + 1; yy < ROAD_Y; yy++) guestPath.add(`${guest.door.x},${yy}`); // chambre d'hôte → route

  function isPath(tx, ty, withGuest = false) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return true;
    const k = `${tx},${ty}`;
    return pathSet.has(k) || (withGuest && guestPath.has(k));
  }

  function isForest(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return false;
    if (ty <= 1 || ty >= ROWS - 2) return true;
    return tx <= 0 || tx >= COLS - 1;
  }

  // ── Occupation (pour le décor) ───────────────────────────────────────────────────
  const occ = new Uint8Array(COLS * ROWS);
  const mark = (r, pad = 0) => {
    for (let yy = r.y - pad; yy < r.y + r.h + pad; yy++) {
      for (let x = r.x - pad; x < r.x + r.w + pad; x++) {
        if (x >= 0 && yy >= 0 && x < COLS && yy < ROWS) occ[yy * COLS + x] = 1;
      }
    }
  };
  const one = (x, yy) => mark({ x, y: yy, w: 1, h: 1 });
  mark(fence);
  mark({ x: fence.x, y: fence.y + fence.h, w: fence.w, h: 1 }); // devant le champ
  mark(house);
  mark({ x: house.x, y: house.y + house.h, w: house.w, h: 1 });
  mark(well);
  one(well.x, well.y - 1);
  const props = [
    { name: 'barrel', x: 6, y: yb + 3, dy: 1 },
    { name: 'bucket.water', x: 6, y: yb + 2, dx: 1, dy: 2 },
  ];
  for (const p of props) one(p.x, p.y);
  one(sprinklerSign.x, sprinklerSign.y);
  if (has('cow')) {
    mark(cow.fence);
    mark(cow.barn);
    mark({ x: cow.barn.x - 1, y: cow.barn.y + cow.barn.h, w: 5, h: 1 });
  }
  if (has('chickenCoop')) {
    mark(chickenCoop.shed);
    mark(chickenCoop.fence);
    one(chickenCoop.shed.x, chickenCoop.shed.y + chickenCoop.shed.h);
  }
  if (has('sheep')) {
    mark(sheep.fence);
    mark(sheep.extras);
  }
  if (has('beehive')) mark(hiveBed);
  mark(slots.roadsideStand.area);
  mark(slots.solarPanel.area);
  if (has('guestHouse')) {
    mark(guest);
    mark(slots.guestHouse.garden);
    mark({ x: guest.x + guest.w, y: guest.y, w: 1, h: guest.h });
  }
  for (const k of [...pathSet, ...guestPath]) {
    const [x, yy] = k.split(',').map(Number);
    one(x, yy);
  }
  const free = (x, yy) => x >= USABLE_X0 && yy >= 2 && x <= USABLE_X1 && yy < ROWS - 2 && yy !== ROAD_Y && yy !== ROAD_Y + 1 && !occ[yy * COLS + x];

  // ── Décor fixe (graine du niveau) ─────────────────────────────────────────────────
  const deco = [];
  const rnd = seededRandom(0x9047 + (level.id || 1) * 577 + cols * 31 + rows);
  const take = (x, yy) => { occ[yy * COLS + x] = 1; };
  // Parterre de fleurs autour des ruches (sol).
  if (has('beehive')) {
    for (let yy = hiveBed.y; yy < hiveBed.y + hiveBed.h; yy++) {
      for (let x = hiveBed.x; x < hiveBed.x + hiveBed.w; x++) {
        if (!hives.some((h) => h.x === x && h.y === yy)) deco.push({ kind: 'flowerbed', x: x * T, y: yy * T, tx: x, ty: yy });
      }
    }
  }
  // Lisières gauche/droite : grands arbres pour adoucir la coupe nette de la forêt.
  for (let yy = 3; yy < ROWS - 2; yy++) {
    for (const x of [USABLE_X0, USABLE_X1]) {
      if (free(x, yy) && free(x, yy - 1) && rnd() < 0.5) {
        deco.push({ kind: 'treeTall', x: x * T + (x === USABLE_X0 ? -3 : 3), y: yy * T, tx: x, ty: yy });
        take(x, yy);
        take(x, yy - 1);
      }
    }
  }
  // Sous la forêt du haut : quelques arbres.
  for (let x = USABLE_X0; x <= USABLE_X1; x++) {
    if (free(x, 2) && rnd() < 0.35) {
      deco.push({ kind: rnd() < 0.5 ? 'tree' : 'bush', x: x * T, y: 2 * T, tx: x, ty: 2 });
      take(x, 2);
    }
  }
  // Semis aléatoire (un peu plus dense que le paysage : il y a moins de place libre).
  for (let yy = 2; yy < ROWS - 2; yy++) {
    for (let x = USABLE_X0; x <= USABLE_X1; x++) {
      if (!free(x, yy)) continue;
      const r = rnd();
      let kind = null;
      if (r < 0.07 && free(x, yy - 1) && yy > 2) kind = 'treeTall';
      else if (r < 0.14) kind = 'tree';
      else if (r < 0.19) kind = 'bush';
      else if (r < 0.215) kind = 'berry';
      else if (r < 0.24) kind = 'rocks';
      else if (r < 0.25) kind = 'rocksBig';
      else if (r < 0.26) kind = 'stump';
      else if (r < 0.27) kind = 'log';
      else if (r < 0.29) kind = 'mushrooms';
      else if (r < 0.32) kind = 'fern';
      else if (r < 0.34) kind = 'weeds';
      if (!kind) continue;
      const jx = Math.floor(rnd() * 5) - 2;
      const jy = Math.floor(rnd() * 3) - 1;
      deco.push({ kind, x: x * T + jx, y: yy * T + jy, tx: x, ty: yy });
      take(x, yy);
      if (kind === 'treeTall') take(x, yy - 1);
    }
  }
  // Jardin de la chambre d'hôte (visible seulement si achetée) : fleurs et haie.
  const gardenFlowers = [{ x: 8, y: yb + 4 }, { x: 9, y: yb + 4 }, { x: 12, y: yb + 2 }, { x: 12, y: yb + 3 }, { x: 12, y: yb + 4 }];
  const gardenBushes = [{ x: 12, y: yb + 1 }, { x: 11, y: yb + 4 }];
  const gardenPlants = [{ x: 8, y: yb + 4, dx: 2, dy: -2 }, { x: 12, y: yb + 3, dx: -1, dy: 1 }];

  // ── Fermier : maison, et trajet jusqu'au champ ───────────────────────────────────
  const farmerHome = { x: house.door.x * T + 8, y: (house.door.y + 1) * T + 12 };
  const routeToField = [
    { x: house.door.x * T + 8, y: ROAD_Y * T + 10 },
    { x: MAIN_PATH_X * T + 8, y: ROAD_Y * T + 10 },
    { x: gate.x * T + 8, y: gate.y * T + 12 },
    { x: gate.x * T + 8, y: (gate.y - 1) * T + 12 },
  ];

  // ── Requêtes ─────────────────────────────────────────────────────────────────────
  const WORLD_W = COLS * T;
  const WORLD_H = ROWS * T;
  const q = makeQueries({ plots, slots, available, field, width: WORLD_W, height: WORLD_H, solarExtendUp: 0 });

  /** Voisines (même ligne à l'écran) d'une parcelle : index à gauche / à droite, ou -1. */
  function plotNeighbors(index) {
    const p = plots[index];
    if (!p) return { left: -1, right: -1 };
    return {
      left: byVisual.get(`${p.vcol - 1},${p.vrow}`) ?? -1,
      right: byVisual.get(`${p.vcol + 1},${p.vrow}`) ?? -1,
    };
  }

  return {
    TILE,
    cols: COLS,
    rows: ROWS,
    width: WORLD_W,
    height: WORLD_H,
    level,
    available,
    field,
    plots,
    house,
    well,
    props,
    slots,
    slotIds: Object.keys(slots),
    roadY: ROAD_Y,
    mainPathX: MAIN_PATH_X,
    deco,
    garden: { flowers: gardenFlowers, bushes: gardenBushes, plants: gardenPlants },
    farmerHome,
    routeToField,
    isPath,
    isForest,
    mode: 'portrait',
    plotSize: PLOT_TILES * T,
    plotScale: PLOT_TILES,
    transposed,
    // Partie à toujours garder visible en largeur (px du monde) : les colonnes hors forêt.
    essential: { x: USABLE_X0 * T, y: 0, w: (USABLE_X1 - USABLE_X0 + 1) * T, h: WORLD_H },
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
