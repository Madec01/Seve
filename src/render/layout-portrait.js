// Disposition « portrait » de la scène (téléphone tenu droit), en pixels du monde (tuiles de 16 px).
//
// Le monde fait 14 tuiles de large ; les colonnes 0 et 13 sont de la forêt, que la caméra peut
// rogner : la partie « essentielle » (champ, bâtiments, enclos) tient dans les 12 colonnes du
// milieu (x 1 à 12). La hauteur dépend du niveau : les bandes des investissements absents du
// niveau (vaches, chambre d'hôte…) sont retirées, le monde se resserre.
//
// Les parcelles font 2 × 2 tuiles (32 px) : cultures et terre sont dessinées à l'échelle ×2.
// Quand la grille du niveau est plus large que haute (6 × 4 par exemple), elle est affichée
// tournée (4 colonnes × 6 lignes à l'écran) pour tenir dans la largeur du téléphone. Les index
// restent ceux du cœur de jeu (index = ligne × gridCols + colonne) ; seule la position à l'écran
// change : les parcelles ouvertes au départ forment un bloc compact, centré dans le champ (4 × 3
// au niveau 1, dans l'ordre de lecture du cœur), et les parcelles à acheter l'entourent
// (placeVisualCells).
//
// Plan (x → droite, y → bas, en tuiles ; bandes de haut en bas, chacune retirée si le niveau ne
// propose pas ce qu'elle contient) :
//
//   y 0-1    forêt ──────────────────────────────
//   y 2      lisière (arbres, buissons)
//   7 lignes pré des vaches (clôture x 2-7) │ grange (x 8-10), puis seau de lait, foin
//   6 lignes (v3) enclos des chèvres (x 2-6) │ fromagerie (x 8-10)
//   6 lignes poulailler (cabane x 1-2, cour x 3-7) │ moutons (x 8-12), puis foin, abreuvoir
//   champ    champ clôturé, ruches à gauche (x 1), portail en bas (x 7) ; coin haut-gauche : décor
//   5 lignes (v3) ateliers : confitures (x 2-4) │ chemin │ four à pain (x 8-9), moulin (x 10-12)
//   1 ligne  panneaux solaires (x 4-5), chemin du portail (x 7)
//   3 lignes maison (x 1-4), puits (x 5), tonneau (x 6) │ chemin │ chambre d'hôte (x 8-11), jardin
//   1 ligne  devant la maison (décors du perron et de la cour), jardin de la chambre d'hôte
//   1 ligne  bord de la route : décors, panneau de la ferme (x 4-6) au pied du chemin
//   2 lignes route ──────────────────────────────
//   1 ligne  étal au bord de la route (x 8-11)
//   2 lignes forêt ──────────────────────────────

import { TILE } from './atlas.js';
import { seededRandom, px, sprinklerHeads, makeQueries, findFreeArea, decorSlot, levelTheme, pickDeco } from './layout-common.js';
import { initialUnlockedIndices } from '../core/farm.js';

export const PORTRAIT_COLS = 14;
const COLS = PORTRAIT_COLS;
const PLOT_TILES = 2; // côté d'une parcelle, en tuiles
const MAIN_PATH_X = 7;
const USABLE_X0 = 1; // première / dernière colonne utilisable (hors forêt)
const USABLE_X1 = COLS - 2;

/**
 * Place chaque parcelle du cœur (index) dans une case de la grille affichée (vCols × vRows).
 * Les parcelles ouvertes au départ occupent un rectangle centré (le plus large et le mieux centré
 * possible), rempli dans l'ordre de lecture du cœur (ligne, puis colonne) ; les autres remplissent
 * les cases restantes, de haut en bas. Sans rectangle exact, les cases les plus proches du centre.
 * @returns {Array<{vcol, vrow}>} indexé par index de parcelle
 */
export function placeVisualCells(level, vCols, vRows) {
  const cols = level.gridCols;
  const rows = level.gridRows;
  const n = cols * rows;
  let open = [];
  try {
    open = initialUnlockedIndices(level).filter((i) => i >= 0 && i < n);
  } catch {
    open = [];
  }
  const readOrder = (a, b) => Math.floor(a / cols) - Math.floor(b / cols) || (a % cols) - (b % cols);
  open.sort(readOrder);
  const openSet = new Set(open);
  const rest = [];
  for (let i = 0; i < n; i++) if (!openSet.has(i)) rest.push(i);

  // Rectangle du bloc ouvert : centrage exact en largeur d'abord, puis en hauteur, puis carré.
  let best = null;
  for (let w = 1; w <= vCols; w++) {
    if (open.length % w) continue;
    const h = open.length / w;
    if (h > vRows) continue;
    const score = ((vCols - w) % 2) * 4 + ((vRows - h) % 2) + Math.abs(Math.log(w / h)) * 2;
    if (!best || score < best.score) best = { w, h, score };
  }
  const cells = [];
  for (let r = 0; r < vRows; r++) for (let c = 0; c < vCols; c++) cells.push({ vcol: c, vrow: r });
  const key = (c) => c.vrow * vCols + c.vcol;
  let openCells;
  if (open.length && best) {
    const x0 = Math.floor((vCols - best.w) / 2);
    const y0 = Math.ceil((vRows - best.h) / 2); // plutôt vers le portail (en bas)
    openCells = [];
    for (let r = 0; r < best.h; r++) for (let c = 0; c < best.w; c++) openCells.push({ vcol: x0 + c, vrow: y0 + r });
  } else {
    const cx = (vCols - 1) / 2;
    const cy = (vRows - 1) / 2;
    openCells = [...cells]
      .sort((a, b) => Math.hypot(a.vcol - cx, a.vrow - cy) - Math.hypot(b.vcol - cx, b.vrow - cy) || key(a) - key(b))
      .slice(0, open.length)
      .sort((a, b) => key(a) - key(b));
  }
  const used = new Set(openCells.map(key));
  const freeCells = cells.filter((c) => !used.has(key(c)));
  const out = new Array(n);
  open.forEach((i, k) => { out[i] = openCells[k]; });
  rest.forEach((i, k) => { out[i] = freeCells[k]; });
  return out;
}

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
  const theme = levelTheme(level);

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

  // ── (v3) Chèvres : enclos + fromagerie ─────────────────────────────────────────────
  const goatY = y;
  const goat = {
    fence: { x: 2, y: goatY, w: 5, h: 5 },
    pen: { x: 3, y: goatY + 1, w: 3, h: 3 },
    sign: { x: 4, y: goatY + 2 },
  };
  const dairy = {
    building: { x: 8, y: goatY + 1, w: 3, h: 3 },
    sign: { x: 9, y: goatY + 2 },
  };
  if (has('goat') || has('dairy')) y += 6; // 5 lignes + une ligne de passage

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
  const place = placeVisualCells({ ...level, gridCols: cols, gridRows: rows }, vCols, vRows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { vcol: vc, vrow: vr } = place[r * cols + c];
      plots.push({
        index: r * cols + c, col: c, row: r, vcol: vc, vrow: vr,
        x: (gx + vc * PLOT_TILES) * T, y: (gy + vr * PLOT_TILES) * T, w: PLOT_TILES * T, h: PLOT_TILES * T,
      });
    }
  }
  const byVisual = new Map(plots.map((p) => [`${p.vcol},${p.vrow}`, p.index]));

  const sprinklerTiles = sprinklerHeads(gx, gy, vCols * PLOT_TILES, vRows * PLOT_TILES, gate);
  const gateRow = fence.y + fence.h; // ligne juste sous la clôture (décors du portail)

  // ── (v3) Ateliers : confitures à gauche, moulin (et son four à pain) à droite ─────
  const ws = y;
  const jamWorkshop = {
    building: { x: 2, y: ws + 1, w: 3, h: 3 },
    sign: { x: 3, y: ws + 2 },
  };
  const mill = {
    building: { x: 10, y: ws, w: 3, h: 4 },
    bakery: { x: 8, y: ws + 2, w: 2, h: 2 },
    sign: { x: 11, y: ws + 2 },
  };
  if (has('jamWorkshop') || has('mill')) y += 5;

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
  const yb = y; // ligne juste sous le champ (ou sous les ateliers)
  const house = { x: 1, y: yb + 1, w: 4, h: 3, door: { x: 3, y: yb + 3 } };
  const well = { x: 5, y: yb + 2, w: 1, h: 2 };
  const guest = { x: 8, y: yb + 1, w: 4, h: 3, door: { x: 10, y: yb + 3 } };
  const porchY = yb + 4; // devant la maison
  const roadsideY = yb + 5; // bord de la route (panneau de la ferme)
  const ROAD_Y = yb + 6; // route : 2 lignes
  const standY = ROAD_Y + 2;
  const ROWS = ROAD_Y + 5; // étal, puis 2 lignes de forêt

  // Panneau « à vendre » de l'arrosage : à droite du coin bas du champ, sinon sous le champ.
  let sprinklerSign = { x: fence.x + fence.w, y: fence.y + fence.h - 1 };
  if (sprinklerSign.x > USABLE_X1) sprinklerSign = { x: gate.x + 2, y: yb };

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
      units: [{ x: 4, y: yb }, { x: 5, y: yb }],
      area: { x: 4, y: yb, w: 2, h: 1 },
      sign: { x: 4, y: yb },
    },
    guestHouse: {
      house: guest,
      garden: { x: 8, y: yb + 4, w: 5, h: 1 },
      sign: { x: 9, y: yb + 2 },
    },
  };
  // (v3) Emplacements présents seulement si le niveau les propose (bandes retirées sinon).
  if (has('goat')) slots.goat = goat;
  if (has('dairy')) slots.dairy = dairy;
  if (has('jamWorkshop')) slots.jamWorkshop = jamWorkshop;
  if (has('mill')) slots.mill = mill;

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
    { name: 'bucket.water', x: 6, y: yb + 2, dx: 1, dy: 3 },
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
  if (has('goat')) mark(goat.fence);
  if (has('dairy')) mark({ x: dairy.building.x, y: dairy.building.y, w: 3, h: 4 });
  if (has('jamWorkshop')) mark({ x: jamWorkshop.building.x, y: jamWorkshop.building.y, w: 3, h: 4 });
  if (has('mill')) {
    mark({ x: mill.building.x, y: mill.building.y, w: 3, h: 5 });
    mark({ x: mill.bakery.x, y: mill.bakery.y, w: 2, h: 3 });
  }
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

  // ── (v3) Emplacements de décoration (identifiants communs à tous les niveaux) ──────
  const sign = { x: 4, y: roadsideY, w: 3, h: 1 }; // panneau de la ferme, 3 tuiles (le nom doit se lire)
  const decorSlots = [];
  // force : emplacement sur une ligne réservée (devant la maison, devant le portail) mais libre.
  const addSlot = (id, x, yy, kind = 'small', w = 1, h = 1, force = false) => {
    if (!force) for (let j = yy; j < yy + h; j++) for (let i = x; i < x + w; i++) if (!free(i, j)) return;
    decorSlots.push(decorSlot(id, kind, x, yy, w, h));
    mark({ x, y: yy, w, h });
  };
  addSlot('sign', sign.x, sign.y, 'sign', 3, 1);
  addSlot('porch.left', house.door.x - 1, porchY, 'small', 1, 1, true);
  addSlot('porch.right', house.door.x + 1, porchY, 'small', 1, 1, true);
  addSlot('yard.1', 5, porchY);
  addSlot('yard.2', 6, porchY);
  addSlot('gate.left', gate.x - 1, gateRow, 'small', 1, 1, true);
  addSlot('gate.right', gate.x + 1, gateRow, 'small', 1, 1, true);
  addSlot('road.1', 1, roadsideY);
  addSlot('road.2', 8, roadsideY);
  addSlot('road.3', 12, roadsideY);
  // Coin haut-gauche du champ, dans la marge de la clôture (libre des arroseurs).
  if (!sprinklerTiles.some((t) => t.x === gx && t.y === gy - 1)) {
    decorSlots.push(decorSlot('field.corner', 'small', gx, gy - 1));
  }
  {
    const spot = findFreeArea(free, { x0: USABLE_X0, y0: 2, x1: USABLE_X1, y1: ROWS - 3 }, 2, 2, { x: house.x + 2, y: house.y });
    if (spot) addSlot('pond', spot.x, spot.y, 'large', 2, 2);
  }

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
        deco.push({ kind: theme === 'mountain' ? 'pineTall' : 'treeTall', x: x * T + (x === USABLE_X0 ? -3 : 3), y: yy * T, tx: x, ty: yy });
        take(x, yy);
        take(x, yy - 1);
      }
    }
  }
  // Sous la forêt du haut : quelques arbres.
  for (let x = USABLE_X0; x <= USABLE_X1; x++) {
    if (free(x, 2) && rnd() < 0.35) {
      const k0 = rnd() < 0.5 ? 'tree' : 'bush';
      deco.push({ kind: theme === 'mountain' && k0 === 'tree' ? 'pine' : k0, x: x * T, y: 2 * T, tx: x, ty: 2 });
      take(x, 2);
    }
  }
  // Semis aléatoire (un peu plus dense que le paysage : il y a moins de place libre).
  for (let yy = 2; yy < ROWS - 2; yy++) {
    for (let x = USABLE_X0; x <= USABLE_X1; x++) {
      if (!free(x, yy)) continue;
      const kind = pickDeco(rnd(), theme, free(x, yy - 1) && yy > 2);
      if (!kind) continue;
      const jx = Math.floor(rnd() * 5) - 2;
      const jy = Math.floor(rnd() * 3) - 1;
      deco.push({ kind, x: x * T + jx, y: yy * T + jy, tx: x, ty: yy });
      take(x, yy);
      if (kind === 'treeTall' || kind === 'pineTall') take(x, yy - 1);
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
    mode: 'portrait',
    theme,
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
