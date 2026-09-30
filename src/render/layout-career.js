// Disposition de la scène du mode Carrière (docs/CARRIERE.md § 2.1 et § 2.4), en pixels du monde
// (tuiles de 16 px). Aucune dépendance au DOM : testable sous Node.
//
// Le monde est une colonne de 14 tuiles de large (x 0 et x 13 : forêt, que la caméra peut rogner ;
// x 1 à 12 utiles) qui GRANDIT VERS LE HAUT : la maison et la route restent en bas (près du pouce),
// chaque terrain acheté repousse la forêt d'une bande de 11 lignes. Parcelles de 2 × 2 tuiles, comme
// la disposition portrait des niveaux.
//
//   y (tuiles, de haut en bas)
//   ┌──────────────────────────────┐
//   │ forêt (2 lignes)             │
//   │ TERRAIN À VENDRE (11 lignes) │ ← forêt assombrie ; lisière et grand panneau « À vendre » en bas
//   ├──────────────────────────────┤
//   │ terrain n … terrain 1        │ ← 11 lignes chacun : contenu (lignes 0-9) + allée (ligne 10)
//   ├──────────────────────────────┤
//   │ la basse-cour (11 lignes)    │ ← emplacement 0 (poulailler) │ emplacement 1
//   ├──────────────────────────────┤
//   │ le champ de départ (13)      │ ← clôture 10 × 12 (4 × 4 parcelles) + allée
//   ├──────────────────────────────┤
//   │ la maison (16 lignes)        │ ← maison │ chemin │ grenier / silo ; perron ; route ; étal,
//   │                              │   château d'eau ; forêt (2 lignes)
//   └──────────────────────────────┘
//
// Chemins : une « épine » verticale en x 12 relie la route à tous les terrains ; chaque terrain a une
// allée horizontale sur sa dernière ligne (panneau du terrain en x 1, machines garées à droite). Les
// employés suivent allée → épine → allée (route()), sans recherche de chemin.
//
// createCareerLayout(level, { career, plots, investments? }) → objet de même forme que les dispositions
// des niveaux (plots, plotRect, plotCenter, fieldRect, house, well, decorSlots, farmerHome,
// routeToField, isPath, isForest, essential, investmentRect, investmentAnchor, hitTest, hitTestNear…)
// plus, pour la carrière (contrat « Rendu (RENDER) » de docs/ARCHITECTURE.md) :
//   lots          [{ id, index, type, name, rect (px), sign: { x, y } (tuiles), forSale, lane (ligne) }]
//   slots         { [buildingId]: { building (tuiles), pen (tuiles) | null, sign, anchor (px), lotId, slot,
//                   kind, sprite, level } }
//   emptySlots    [{ lotId, slot, rect (tuiles), sign }]
//   machineParking { [key]: { x, y, w, h (px, coin haut-gauche), sprite, id, lotId } }
//   hives, solar  emplacements (tuiles) des ruches et des panneaux solaires
//   sprinklers    { [lotId]: { heads: [{ x, y }] (tuiles), level } }
//   route(a, b)   points (px) pour aller de a à b par les allées
//   hitTestCareer(wx, wy, state, slop) → voir scene.hitTest
//
// Carte 2D (Carrière v2) : chaque terrain est un bloc de 14 × 11 tuiles aux coordonnées de grille
// (lot.col, lot.row) : colonne 0 = la colonne d'origine (x 0 à 13), colonne c = x 14c à 14c + 13
// (négatif à gauche : les coordonnées de la colonne 0 ne bougent jamais) ; ligne 1.. vers le haut,
// ligne 0 = à côté de la basse-cour. La maison (basse-cour, champ de départ, maison) reste en
// colonne 0 ligne 0, taille inchangée. Terrains à vendre voisins (query.career.grid(), option
// `grid`) : forêt assombrie + grand panneau ; ailleurs, forêt dense. Chemins : épine verticale (x 12
// du bloc) dans chaque colonne, allées prolongées d'un bloc à son voisin de la même ligne, chemin qui
// descend jusqu'à la route pour les terrains de la ligne 0. Sans terrain de côté : exactement la
// colonne d'avant (mêmes coordonnées, même décor).
//   x0, x1        bords du monde (px ; x0 ≤ 0)
//   grid          { cMin, cMax, rMax, rowTop, rowBottom, x0Tiles, colsTiles, rowY(r) }
//   saleBands     terrains à vendre (bandes), saleBand = le premier (compatibilité)
//   bandAt(wy, wx?) bloc sous un point (wx absent : colonne 0)

import { TILE, SPRITES } from './atlas.js';
import { seededRandom, tileHash, px, sprinklerHeads, decorSlot, inRect, distToRect, pickDeco } from './layout-common.js';
import { LOT_PRICES, LOT_NAMES, FIRST_LOT_INDEX, lotIdFor } from '../data/career/lots.js';

export const CAREER_COLS = 14;
const COLS = CAREER_COLS;
const T = TILE;
const SPINE_X = 12; // épine : chemin vertical de la route au dernier terrain
const LOT_ROWS = 11; // terrain acheté : 10 lignes de contenu + 1 ligne d'allée
const START_ROWS = 13; // champ de départ : clôture de 12 lignes + allée
const HOME_ROWS = 16; // maison, perron, route, étal, forêt
const TOP_FOREST = 2;
const MAX_LOTS = LOT_PRICES.length;
const PLOT_TILES = 2;
export const MAX_ANIMALS_DRAWN = 6; // animaux dessinés au plus par abri (docs/CARRIERE.md § 2.5)

/** Nombre de lignes du monde pour n terrains achetés (forêt, terrain à vendre, maison…). */
export function careerWorldRows(bought) {
  const forSale = bought < MAX_LOTS ? LOT_ROWS : 1;
  return TOP_FOREST + forSale + LOT_ROWS * bought + LOT_ROWS + START_ROWS + HOME_ROWS;
}

// ── Sprites des bâtiments (partagés avec la scène) ─────────────────────────────────────
const WORKSHOP_SPRITES = {
  jamWorkshop: 'building.jamworkshop',
  dairy: 'building.dairy',
  mill: 'building.windmill.body',
  cannery: 'building.cannery',
  spinningMill: 'building.spinningMill',
};
export const SHELTER_ANIMAL = {
  coop: 'hen', sheepfold: 'sheep', goatShed: 'goat', cowshed: 'cow', pigsty: 'pig', hutch: 'rabbit', stable: 'horse', duckPond: 'duck',
};
export const WORKSHOP_IDS = Object.keys(WORKSHOP_SPRITES);

const has = (name) => !!SPRITES[name];

/**
 * Nom du sprite d'un bâtiment de carrière à un niveau (null : dessiné autrement — serre, mare, étal niv. 1).
 * @param opts { domain: true } → manoir au fanion doré (rang 6)
 */
export function careerBuildingSprite(id, level = 1, opts = {}) {
  const lv = Math.max(1, level | 0);
  switch (id) {
    case 'house': {
      const n = Math.min(5, lv);
      return n === 5 && opts.domain && has('building.house.5.flag') ? 'building.house.5.flag' : `building.house.${n}`;
    }
    case 'storage': return `building.storage.${Math.min(3, lv)}`;
    case 'roadsideStand': return lv >= 3 ? 'building.stand.3' : lv === 2 ? 'building.stand.2' : null;
    case 'guestHouse': return lv >= 3 ? 'building.guestHouse.3' : lv === 2 ? 'building.guestHouse.2' : 'building.house.red';
    case 'greenhouse':
    case 'duckPond': return null;
    default:
      if (WORKSHOP_SPRITES[id]) return WORKSHOP_SPRITES[id];
      for (let k = Math.min(3, lv); k >= 1; k--) if (has(`building.${id}.${k}`)) return `building.${id}.${k}`;
      return 'building.shed';
  }
}

/** Taille (tuiles) d'un sprite, { w: 1, h: 1 } s'il est inconnu. */
function tilesOf(name) {
  const s = name && SPRITES[name];
  return s ? { w: s.w || 1, h: s.h || 1 } : { w: 1, h: 1 };
}

/** Sprite d'une machine garée (null : dessinée autrement — arroseurs, convoyeur). */
export function machineSprite(id) {
  switch (id) {
    case 'tractor': return 'machine.tractor.l';
    case 'seeder': return 'machine.seeder';
    case 'harvester': return 'machine.harvester';
    case 'fruitPicker': return 'machine.fruitPicker';
    case 'collector': return 'machine.collector';
    case 'waterTower': return 'machine.waterTower';
    default: return null;
  }
}

/**
 * Clé qui change quand la disposition doit être reconstruite : terrains (types, emplacements),
 * niveaux des bâtiments, machines, nombre de parcelles, terrain à vendre.
 */
export function careerLayoutKey(state) {
  const c = state?.career;
  if (!c) return '';
  let k = `${c.lotsBought}|${state.plots?.length || 0}|`;
  for (const l of c.lots || []) k += `${l.id}:${l.type}:${l.slots ? l.slots.join(',') : ''}${Number.isFinite(l.col) || Number.isFinite(l.row) ? `@${l.col},${l.row}` : ''};`;
  k += '|';
  for (const [id, b] of Object.entries(c.buildings || {})) k += `${id}:${b?.level || 0}:${b?.lotId}:${b?.slot};`;
  k += '|';
  for (const [key, m] of Object.entries(c.machines || {})) if (m) k += `${key}:${m.id}:${m.lotId}:${m.level || 1};`;
  k += `|${c.rank >= 6 ? 'D' : ''}`;
  return k;
}

/** Clé de la grille (query.career.grid()) : terrains à vendre et positions. '' sans grille. */
export function careerGridKey(grid) {
  if (!grid || !Array.isArray(grid.lots)) return '';
  let k = '';
  for (const e of grid.lots) if (e) k += `${e.id}@${e.col},${e.row}${e.owned ? 'o' : ''};`;
  return k;
}

const FIXED_IDS = new Set(['home', 'start', 'yard']);
const num = (v) => (Number.isFinite(v) ? v : null);

/**
 * Terrains possédés (avec leur case) et terrains à vendre, depuis l'état et la grille du cœur.
 * Sans grille (cœur d'avant la carte 2D) : colonne 0, ligne = ordre d'achat, un terrain à vendre au-dessus.
 */
export function careerGridCells(career, grid) {
  const lotsState = Array.isArray(career?.lots) ? career.lots : [];
  const gl = grid && Array.isArray(grid.lots) ? grid.lots.filter(Boolean) : null;
  const byId = new Map((gl || []).map((e) => [e.id, e]));
  const taken = new Set(['0,0']);
  const owned = [];
  const bought = lotsState.filter((l) => l.index >= FIRST_LOT_INDEX).sort((a, b) => a.index - b.index);
  for (const l of bought) {
    const g = byId.get(l.id);
    const col = num(l.col) ?? num(g?.col) ?? 0;
    const row = num(l.row) ?? num(g?.row) ?? (l.index - FIRST_LOT_INDEX + 1);
    const key = `${col},${row}`;
    if (row < 0 || taken.has(key)) continue; // case invalide ou déjà prise : pas dessiné
    taken.add(key);
    owned.push({ lot: l, col, row });
  }
  const cands = [];
  if (gl) {
    for (const e of gl) {
      if (e.owned || FIXED_IDS.has(e.id) || lotsState.some((l) => l.id === e.id)) continue;
      const col = num(e.col);
      const row = num(e.row);
      if (col === null || row === null || row < 0) continue;
      const key = `${col},${row}`;
      if (taken.has(key)) continue;
      taken.add(key);
      cands.push({ id: e.id, col, row, name: e.name || '', price: num(e.price), buyable: e.buyable !== false, lockedReason: e.lockedReason || null, lockedByRank: e.lockedByRank ?? null, index: num(e.index) });
    }
  } else if (bought.length < MAX_LOTS) {
    const n = bought.length;
    const top = owned.filter((o) => o.col === 0).reduce((m, o) => Math.max(m, o.row), 0);
    if (!taken.has(`0,${top + 1}`)) cands.push({ id: lotIdFor(FIRST_LOT_INDEX + n), col: 0, row: top + 1, name: LOT_NAMES[n] || '', price: LOT_PRICES[n] ?? null, buyable: true, lockedReason: null, lockedByRank: null, index: FIRST_LOT_INDEX + n });
  }
  return { owned, cands };
}

/**
 * @param level  niveau de carrière (careerLevel) : seul `id`/`rank` servent (graine du décor)
 * @param opts   { career: state.career, plots: state.plots, investments?: state.investments }
 */
export function createCareerLayout(level, opts = {}) {
  const career = opts.career || { lots: [], buildings: {}, machines: {}, lotsBought: 0 };
  const statePlots = opts.plots || [];
  const lotsState = Array.isArray(career.lots) ? career.lots : [];
  const buildingsState = career.buildings || {};
  const machinesState = career.machines || {};
  const { owned: ownedCells, cands } = careerGridCells(career, opts.grid || null);

  // ── Grille : colonnes et lignes couvertes ───────────────────────────────────────────
  let cMin = 0;
  let cMax = 0;
  let rMax = 0;
  for (const o of [...ownedCells, ...cands]) {
    cMin = Math.min(cMin, o.col);
    cMax = Math.max(cMax, o.col);
    rMax = Math.max(rMax, o.row);
  }
  const X0 = cMin * COLS; // première colonne de tuiles du monde (≤ 0)
  const WT = (cMax - cMin + 1) * COLS; // largeur du monde (tuiles)
  const topExtra = cands.some((c) => c.row === rMax) ? 0 : 1; // lisière au-dessus du dernier terrain
  const rowTop = TOP_FOREST + topExtra;
  const rowY = (r) => rowTop + (rMax - r) * LOT_ROWS;

  // ── Bandes (blocs), de haut en bas puis de gauche à droite ──────────────────────────
  const bands = [];
  const cell = new Map(); // « col,row » → bande
  const cellsAt = new Map();
  for (const o of ownedCells) cellsAt.set(`${o.col},${o.row}`, { owned: o });
  for (const c of cands) cellsAt.set(`${c.col},${c.row}`, { cand: c });
  const yardLot = lotsState.find((l) => l.id === 'yard') || { id: 'yard', index: 2, type: 'yard', slots: [null, null], name: 'La basse-cour' };
  const yard = { id: 'yard', index: 2, type: 'yard', name: yardLot.name, y0: rowY(0), rows: LOT_ROWS, lot: yardLot, col: 0, row: 0, ox: 0 };
  const saleBands = [];
  for (let r = rMax; r >= 0; r--) {
    for (let c = cMin; c <= cMax; c++) {
      let band = null;
      if (r === 0 && c === 0) band = yard;
      else {
        const at = cellsAt.get(`${c},${r}`);
        if (!at) continue;
        if (at.cand) {
          const k = at.cand;
          band = { id: k.id, index: k.index ?? -1, type: 'forSale', name: k.name, y0: rowY(r), rows: LOT_ROWS, forSale: true, col: c, row: r, ox: c * COLS, cand: k };
          saleBands.push(band);
        } else {
          const l = at.owned.lot;
          band = { id: l.id, index: l.index, type: l.type || 'wild', name: l.name || '', y0: rowY(r), rows: LOT_ROWS, lot: l, col: c, row: r, ox: c * COLS };
        }
      }
      bands.push(band);
      cell.set(`${c},${r}`, band);
    }
  }
  const saleBand = saleBands.find((b) => b.col === 0) || saleBands[0] || null;
  let y = yard.y0 + LOT_ROWS;
  const startLot = lotsState.find((l) => l.id === 'start') || { id: 'start', index: 1, type: 'field', name: 'Le champ de départ' };
  const start = { id: 'start', index: 1, type: 'field', name: startLot.name, y0: y, rows: START_ROWS, lot: startLot, start: true, col: 0, row: 0, ox: 0 };
  bands.push(start);
  y += START_ROWS;
  const homeLot = lotsState.find((l) => l.id === 'home') || { id: 'home', index: 0, type: 'home', name: 'La maison' };
  const home = { id: 'home', index: 0, type: 'home', name: homeLot.name, y0: y, rows: HOME_ROWS, lot: homeLot, col: 0, row: 0, ox: 0 };
  bands.push(home);
  y += HOME_ROWS;
  const ROWS = y;
  const WORLD_W = WT * T;
  const WORLD_H = ROWS * T;
  for (const b of bands) b.lane = b.type === 'home' ? b.y0 + 6 : b.y0 + b.rows - 1;
  const ownedAt = (c, r) => {
    const b = cell.get(`${c},${r}`);
    return !!b && !b.forSale;
  };
  const rowBottom = yard.y0 + LOT_ROWS; // bas de la ligne 0 (haut du champ de départ)
  /** Bande sous une tuile (null : forêt, route, hors du monde). */
  function bandAtTile(tx, ty) {
    if (ty >= rowBottom) {
      if (tx < 0 || tx >= COLS) return null;
      return ty < home.y0 ? start : ty < ROWS ? home : null;
    }
    if (ty < rowY(rMax)) return null;
    const r = rMax - Math.floor((ty - rowY(rMax)) / LOT_ROWS);
    return cell.get(`${Math.floor(tx / COLS)},${r}`) || null;
  }

  // ── Maison : bâtiments de la bande (taille selon le niveau) ──────────────────────────
  const H = home.y0;
  const ROAD_Y = H + 8;
  const levelOf = (id) => buildingsState[id]?.level || 0;
  const domain = (career.rank || 1) >= 6;
  const houseLevel = Math.max(1, levelOf('house') || 1);
  const houseSprite = careerBuildingSprite('house', houseLevel, { domain });
  const hs = tilesOf(houseSprite);
  const house = { x: 1, y: H + 6 - hs.h, w: hs.w, h: hs.h, sprite: houseSprite, level: houseLevel };
  house.door = { x: house.x + Math.floor(hs.w / 2) - (hs.w % 2 === 0 ? 1 : 0), y: H + 5 };
  const storageLevel = levelOf('storage');
  const storageSprite = storageLevel > 0 ? careerBuildingSprite('storage', storageLevel) : null;
  const ss = storageSprite ? tilesOf(storageSprite) : { w: 2, h: 3 };
  const storage = { x: 12 - ss.w, y: H + 6 - ss.h, w: ss.w, h: ss.h, sprite: storageSprite, level: storageLevel };
  // Puits : à droite de la maison s'il y a la place, sinon sous la route.
  let well;
  if (house.x + house.w <= 6) well = { x: house.x + house.w, y: H + 4, w: 1, h: 2 };
  else well = { x: 6, y: H + 10, w: 1, h: 2 };
  const standLevel = levelOf('roadsideStand');
  const standSprite = careerBuildingSprite('roadsideStand', standLevel);
  const stTiles = standSprite ? tilesOf(standSprite) : { w: 4, h: 1 };
  const stand = { x: standLevel >= 3 ? 7 : 8, y: H + 10, w: stTiles.w, h: stTiles.h, sprite: standSprite, level: standLevel };
  stand.cart = { x: 9, y: H + 10 };
  stand.crates = [{ x: 8, y: H + 10 }, { x: 10, y: H + 10 }, { x: 11, y: H + 10 }];
  if (standLevel <= 1) { stand.x = 8; stand.w = 4; stand.h = 1; }
  const waterTowerSpot = { x: 2, y: H + 10, w: 2, h: 4 };
  const tractorSpot = { x: 9, y: H + 6, w: 2, h: 2 };
  const solar = [{ x: 2, y: H }, { x: 3, y: H }, { x: 4, y: H }, { x: 5, y: H }];

  // ── Chemins (masque) ──────────────────────────────────────────────────────────────
  const pathSet = new Set();
  const addPath = (x, yy) => pathSet.add(`${x},${yy}`);
  // Épines : dans chaque colonne, une par suite de terrains possédés l'un au-dessus de l'autre, du haut
  // du plus haut jusqu'à l'allée du plus bas — ou jusqu'à la route s'il est sur la ligne 0 (colonne 0 :
  // la basse-cour, comme avant).
  for (let c = cMin; c <= cMax; c++) {
    let r = 0;
    while (r <= rMax) {
      if (!ownedAt(c, r)) { r++; continue; }
      const low = r;
      while (r + 1 <= rMax && ownedAt(c, r + 1)) r++;
      const high = r;
      r++;
      if (low === high && low > 0) continue; // terrain seul : son allée suffit
      const x = c * COLS + SPINE_X;
      const yEnd = low === 0 ? ROAD_Y : cell.get(`${c},${low}`).lane + 1;
      for (let yy = rowY(high); yy < yEnd; yy++) addPath(x, yy);
    }
  }
  for (const b of bands) {
    if (b.forSale || b.type === 'home') continue;
    for (let x = b.ox + 2; x <= b.ox + SPINE_X; x++) addPath(x, b.lane);
  }
  // Allées d'un terrain à son voisin de droite (même ligne) : à travers la lisière.
  for (let r = 0; r <= rMax; r++) {
    for (let c = cMin; c < cMax; c++) {
      if (!ownedAt(c, r) || !ownedAt(c + 1, r)) continue;
      const lane = cell.get(`${c},${r}`).lane;
      for (const x of [c * COLS + 13, (c + 1) * COLS, (c + 1) * COLS + 1]) addPath(x, lane);
    }
  }
  for (let yy = H; yy < ROAD_Y; yy++) addPath(7, yy); // champ de départ → route
  for (let yy = house.door.y + 1; yy < ROAD_Y; yy++) addPath(house.door.x, yy); // maison → route
  for (let x = Math.min(house.door.x, 7); x <= SPINE_X; x++) addPath(x, home.lane); // perron → épine
  const extraPaths = new Set(); // sentiers des chambres d'hôte (ajoutés plus bas)

  function isPath(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return true;
    const k = `${tx},${ty}`;
    return pathSet.has(k) || extraPaths.has(k);
  }

  const forestMemo = new Int8Array(WT * ROWS).fill(-1);
  function isForest(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return false;
    if (ty < TOP_FOREST) return true;
    if (ty >= ROWS - 2) return true;
    if (tx < X0 || tx >= X0 + WT) return true;
    const m = (ty * WT) + tx - X0;
    let v = forestMemo[m];
    if (v < 0) v = forestMemo[m] = forestAt(tx, ty) ? 1 : 0;
    return v === 1;
  }
  function forestAt(tx, ty) {
    if (pathSet.has(`${tx},${ty}`)) return false; // allée qui traverse une lisière
    const lx = tx - Math.floor(tx / COLS) * COLS;
    if (lx <= 0 || lx >= COLS - 1) return true;
    if (ty < rowTop) return !ownedAt(Math.floor(tx / COLS), rMax); // lisière du haut
    const b = bandAtTile(tx, ty);
    if (!b) return true;
    if (b.forSale && ty < b.y0 + b.rows - 1) return true;
    return false;
  }

  // ── Occupation (décor) ────────────────────────────────────────────────────────────
  const occ = new Uint8Array(WT * ROWS);
  const mark = (r) => {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let x = r.x; x < r.x + r.w; x++) if (x >= X0 && yy >= 0 && x < X0 + WT && yy < ROWS) occ[yy * WT + x - X0] = 1;
    }
  };
  const one = (x, yy) => mark({ x, y: yy, w: 1, h: 1 });

  // ── Parcelles, clôtures, emplacements ─────────────────────────────────────────────
  const plots = [];
  const fences = []; // { rect (tuiles), gateX|null, kind: 'field'|'pen'|'orchard' }
  const slots = {};
  const emptySlots = [];
  const lotSigns = [];
  const hives = []; // emplacements possibles des ruches (tuiles), dans l'ordre
  const sprinklers = {};
  const greenhouses = [];
  const ponds = [];
  const cobbles = [];
  const wilds = [];
  const orchards = [];
  const conveyors = [];
  const parkingSpots = {}; // lotId → { seeder, harvester, fruitPicker }
  const lotEntries = [];

  function slotBuilding(band, slotIdx, buildingId) {
    const left = slotIdx === 0;
    const ox = band.ox;
    const penX = ox + (left ? 1 : 7);
    const penW = left ? 6 : 5;
    const lvl = Math.max(1, buildingsState[buildingId]?.level || 1);
    const sprite = careerBuildingSprite(buildingId, lvl);
    const st = tilesOf(sprite);
    const bx = penX + Math.max(0, Math.floor((penW - st.w) / 2));
    const building = { x: Math.min(bx, ox + 12 - st.w), y: band.y0 + 3 - st.h, w: st.w, h: st.h };
    const guest = buildingId === 'guestHouse';
    const pen = guest ? null : { x: penX, y: band.y0 + 3, w: penW, h: 7 };
    const anchor = { x: (building.x + building.w / 2) * T, y: building.y * T };
    // Bulle de ramassage : à droite du toit (reste dans le terrain, ne cache pas celui du dessus).
    const bubble = { x: Math.min((ox + 12 - 1) * T - 20, (building.x + building.w) * T - 6), y: building.y * T - 2 };
    const entry = {
      building, pen, sign: { x: penX + Math.floor(penW / 2), y: band.y0 + 5 }, anchor, bubble, lotId: band.id, slot: slotIdx,
      kind: guest ? 'guest' : WORKSHOP_SPRITES[buildingId] ? 'workshop' : 'shelter', sprite, level: lvl, animal: SHELTER_ANIMAL[buildingId] || null,
    };
    if (guest) {
      entry.garden = { x: penX, y: band.y0 + 3, w: penW, h: 6 };
      const doorX = building.x + Math.floor(building.w / 2);
      entry.door = { x: doorX, y: band.y0 + 2 };
      for (let yy = band.y0 + 3; yy < band.lane; yy++) extraPaths.add(`${doorX},${yy}`);
      // Jardin : parterres de fleurs le long du sentier, massifs, un banc.
      const g = entry.garden;
      entry.gardenDeco = [];
      for (let yy = g.y + 1; yy < g.y + g.h - 1; yy++) {
        for (const x of [doorX - 1, doorX + 1]) if (x > g.x && x < g.x + g.w - 1 && (yy + x) % 3 !== 0) entry.gardenDeco.push({ kind: 'flowers', x, y: yy });
      }
      entry.gardenDeco.push({ kind: 'bush', x: g.x + (doorX - g.x > 2 ? 0 : g.w - 1), y: g.y + 1 });
      entry.gardenDeco.push({ kind: 'bush', x: g.x + g.w - 1, y: g.y + 4 });
      entry.gardenDeco.push({ kind: 'bench', x: doorX + 2 < g.x + g.w ? doorX + 2 : doorX - 2, y: g.y + 3 });
    } else {
      fences.push({ rect: pen, gateX: penX + Math.floor(penW / 2), kind: 'pen' });
      // Abreuvoir / foin dans l'enclos.
      entry.props = [];
      const a = entry.animal;
      if (a === 'hen' || a === 'duck') entry.props.push({ name: 'trough.metal.feed', x: (pen.x + 1) * T, y: (pen.y + 5) * T + 2 });
      else if (a === 'rabbit') entry.props.push({ name: 'hay', x: (pen.x + 1) * T, y: (pen.y + 5) * T });
      else if (a) {
        entry.props.push({ name: 'trough.wood.water', x: (pen.x + 1) * T, y: (pen.y + 5) * T + 2 });
        if (a === 'sheep' || a === 'cow' || a === 'horse' || a === 'goat') entry.props.push({ name: 'hay.tied', x: (pen.x + pen.w - 2) * T, y: (pen.y + 1) * T });
      }
    }
    slots[buildingId] = entry;
    mark({ x: penX, y: band.y0, w: penW, h: 10 });
  }

  function addLotSign(band) {
    const s = { x: band.ox + 1, y: band.lane };
    lotSigns.push({ lotId: band.id, ...s });
    one(s.x, s.y);
    return s;
  }

  function placePlot(i, x, yy, band, col, row) {
    plots[i] = { index: i, x: x * T, y: yy * T, w: PLOT_TILES * T, h: PLOT_TILES * T, lot: band.id, col, row, vcol: col, vrow: row + band.index * 100, retired: false };
  }

  // Parcelles par terrain : index du cœur, position par `cell`.
  const plotsByLot = new Map();
  statePlots.forEach((p, i) => {
    const id = p?.lot || 'start';
    if (!plotsByLot.has(id)) plotsByLot.set(id, []);
    plotsByLot.get(id).push(i);
  });

  function fieldPlots(band, gx, gy) {
    for (const i of plotsByLot.get(band.id) || []) {
      const p = statePlots[i];
      const cell = Number.isInteger(p.cell) ? p.cell : 0;
      const col = cell % 4;
      const row = Math.floor(cell / 4) % 4;
      placePlot(i, gx + col * PLOT_TILES, gy + row * PLOT_TILES, band, col, row);
      if (p.env === null) plots[i].retired = true;
    }
  }

  for (const band of bands) {
    const y0 = band.y0;
    const ox = band.ox;
    const cr = { col: band.col, row: band.row, ox };
    if (band.forSale) {
      const k = band.cand;
      lotEntries.push({ id: band.id, index: band.index, type: null, name: band.name, forSale: true, rect: px({ x: ox, y: y0, w: COLS, h: band.rows }), sign: { x: ox + 6, y: y0 + band.rows - 2 }, lane: band.lane, ...cr, price: k.price, buyable: k.buyable, lockedReason: k.lockedReason, lockedByRank: k.lockedByRank, band });
      continue;
    }
    if (band.type === 'home') {
      lotEntries.push({ id: band.id, index: 0, type: 'home', name: band.name, forSale: false, rect: px({ x: 0, y: y0, w: COLS, h: 10 }), sign: null, lane: band.lane, ...cr, band });
      continue;
    }
    const sign = addLotSign(band);
    lotEntries.push({ id: band.id, index: band.index, type: band.type, name: band.name, forSale: false, rect: px({ x: ox, y: y0, w: COLS, h: band.rows }), sign, lane: band.lane, ...cr, band });
    const type = band.type;
    if (band.start) {
      // Champ de départ : clôture 10 × 12, marges haute et basse (arroseurs), portail en bas au milieu.
      const fence = { x: ox + 2, y: y0, w: 10, h: 12 };
      const gate = { x: ox + 7, y: y0 + 11 };
      fences.push({ rect: fence, gateX: gate.x, kind: 'field', field: true });
      band.fence = fence;
      band.gate = gate;
      fieldPlots(band, ox + 3, y0 + 2);
      sprinklers.start = { heads: sprinklerHeads(ox + 3, y0 + 2, 8, 8, gate) };
      hives.push({ x: ox + 1, y: y0 + 3, lotId: 'start' }, { x: ox + 1, y: y0 + 7, lotId: 'start' });
      parkingSpots.start = { seeder: { x: ox + 3, y: band.lane }, harvester: { x: ox + 8, y: band.lane - 1 } };
      mark({ x: ox + 1, y: y0, w: 11, h: START_ROWS });
      continue;
    }
    if (type === 'field') {
      const fence = { x: ox + 2, y: y0, w: 10, h: 10 };
      fences.push({ rect: fence, gateX: ox + 7, kind: 'field', field: true });
      band.fence = fence;
      band.gate = { x: ox + 7, y: y0 + 9 };
      fieldPlots(band, ox + 3, y0 + 1);
      sprinklers[band.id] = { heads: [{ x: ox + 4, y: y0 }, { x: ox + 9, y: y0 }, { x: ox + 6, y: y0 + 9 }, { x: ox + 6, y: y0 }, { x: ox + 3, y: y0 + 9 }, { x: ox + 10, y: y0 + 9 }], onFence: true };
      hives.push({ x: ox + 1, y: y0 + 2, lotId: band.id }, { x: ox + 1, y: y0 + 6, lotId: band.id });
      parkingSpots[band.id] = { seeder: { x: ox + 3, y: band.lane }, harvester: { x: ox + 8, y: band.lane - 1 } };
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'orchard') {
      const fence = { x: ox + 1, y: y0, w: 11, h: 10 };
      fences.push({ rect: fence, gateX: ox + 7, kind: 'orchard' });
      orchards.push({ rect: { x: ox + 2, y: y0 + 1, w: 9, h: 8 }, lotId: band.id });
      for (const i of plotsByLot.get(band.id) || []) {
        const p = statePlots[i];
        const cell = Number.isInteger(p.cell) ? p.cell : 0;
        const col = cell % 3;
        const row = Math.floor(cell / 3) % 3;
        placePlot(i, ox + [2, 5, 8][col], y0 + [1, 4, 7][row], band, col, row);
        if (p.env === null) plots[i].retired = true;
      }
      parkingSpots[band.id] = { fruitPicker: { x: ox + 9, y: band.lane - 1 } };
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'greenhouse') {
      const gh = { x: ox + 2, y: y0 + 1, w: 10, h: 7, lotId: band.id, level: Math.max(1, levelOf('greenhouse') || 1) };
      greenhouses.push(gh);
      for (const i of plotsByLot.get(band.id) || []) {
        const p = statePlots[i];
        const cell = Number.isInteger(p.cell) ? p.cell : 0;
        const col = cell % 4;
        const row = Math.floor(cell / 4) % 2;
        placePlot(i, ox + 3 + col * PLOT_TILES, y0 + 3 + row * PLOT_TILES, band, col, row);
        if (p.env === null) plots[i].retired = true;
      }
      slots.greenhouse = { building: { x: ox + 2, y: y0 + 1, w: 10, h: 2 }, pen: null, sign: { x: ox + 1, y: band.lane }, anchor: { x: (ox + 7) * T, y: (y0 + 1) * T }, lotId: band.id, slot: null, kind: 'greenhouse', sprite: null, level: gh.level };
      sprinklers[band.id] = { heads: [{ x: ox + 4, y: y0 + 7 }, { x: ox + 9, y: y0 + 7 }, { x: ox + 6, y: y0 + 7 }, { x: ox + 8, y: y0 + 7 }], inGreenhouse: true };
      parkingSpots[band.id] = { seeder: { x: ox + 3, y: band.lane } };
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'pond') {
      const water = { x: ox + 3, y: y0 + 2, w: 8, h: 5 };
      const dock = { x: ox + 6, y: y0 + 6, w: 3, h: 1 };
      ponds.push({ water, dock, lotId: band.id });
      const lvl = Math.max(1, levelOf('duckPond') || 1);
      slots.duckPond = { building: water, pen: water, sign: { x: ox + 1, y: band.lane }, anchor: { x: (water.x + 2) * T, y: water.y * T }, bubble: { x: (water.x + 1) * T, y: (water.y - 1) * T - 8 }, lotId: band.id, slot: null, kind: 'pond', sprite: null, level: lvl, animal: 'duck', water, dock };
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'workshops') {
      const area = { x: ox + 1, y: y0 + 1, w: 11, h: 9 };
      cobbles.push(area);
      conveyors.push({ y: y0 + 8, x0: ox + 1, x1: ox + 11, lotId: band.id });
      const ls = band.lot?.slots || [null, null];
      for (let s = 0; s < 2; s++) {
        const bid = ls[s];
        if (bid) {
          const sprite = careerBuildingSprite(bid, buildingsState[bid]?.level || 1);
          const st = tilesOf(sprite);
          const bx = ox + (s === 0 ? 2 : 8);
          const building = { x: bx, y: y0 + 6 - st.h, w: st.w, h: st.h };
          const entry = { building, pen: null, sign: { x: bx + 1, y: y0 + 5 }, anchor: { x: (bx + st.w / 2) * T, y: building.y * T }, lotId: band.id, slot: s, kind: 'workshop', sprite, level: buildingsState[bid]?.level || 1 };
          if (bid === 'mill') entry.bakery = { x: ox + (s === 0 ? 5 : 6), y: y0 + 4, w: 2, h: 2 };
          slots[bid] = entry;
        } else {
          emptySlots.push({ lotId: band.id, slot: s, rect: { x: ox + (s === 0 ? 1 : 7), y: y0 + 1, w: s === 0 ? 6 : 5, h: 7 }, sign: { x: ox + (s === 0 ? 3 : 9), y: y0 + 5 } });
        }
      }
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'meadow' || type === 'yard') {
      const ls = band.lot?.slots || [null, null];
      for (let s = 0; s < 2; s++) {
        const bid = ls[s];
        if (bid) slotBuilding(band, s, bid);
        else {
          const r = { x: ox + (s === 0 ? 1 : 7), y: y0, w: s === 0 ? 6 : 5, h: 10 };
          emptySlots.push({ lotId: band.id, slot: s, rect: r, sign: { x: r.x + Math.floor(r.w / 2), y: y0 + 4 } });
          mark(r);
        }
      }
    } else {
      // Friche (ou type inconnu) : herbes hautes, souches, fleurs sauvages.
      wilds.push({ rect: { x: ox + 1, y: y0, w: 11, h: 10 }, lotId: band.id, seed: band.index });
      mark({ x: ox + 1, y: y0, w: 11, h: LOT_ROWS });
    }
  }
  // Parcelles sans terrain connu (sauvegarde étrange) : rangées à l'écart, jamais touchables.
  for (let i = 0; i < statePlots.length; i++) {
    if (!plots[i]) plots[i] = { index: i, x: -64, y: -64, w: PLOT_TILES * T, h: PLOT_TILES * T, lot: statePlots[i]?.lot || null, col: 0, row: 0, vcol: -1, vrow: -1 - i, retired: true };
  }

  // Bande de la maison : occupation.
  mark(house);
  mark({ x: house.x, y: house.y + house.h, w: house.w, h: 1 });
  mark(storage);
  mark(well);
  mark(stand);
  mark(waterTowerSpot);
  mark({ x: tractorSpot.x, y: tractorSpot.y, w: 2, h: 2 });
  for (const s of solar) one(s.x, s.y);
  for (const k of [...pathSet, ...extraPaths]) {
    const [x, yy] = k.split(',').map(Number);
    one(x, yy);
  }
  for (const sb of saleBands) mark({ x: sb.ox + 5, y: sb.y0 + sb.rows - 2, w: 4, h: 2 });

  // ── Emplacements de décoration (identifiants communs aux niveaux) ───────────────────
  const free = (x, yy) => {
    const lx = x - Math.floor(x / COLS) * COLS;
    return lx >= 1 && lx <= 11 && x >= X0 && x < X0 + WT && yy >= TOP_FOREST && yy < ROWS - 2 && yy !== ROAD_Y && yy !== ROAD_Y + 1 && !occ[yy * WT + x - X0] && !isForest(x, yy);
  };
  const signRect = { x: 4, y: H + 7, w: 3, h: 1 };
  const decorSlots = [];
  const addSlot = (id, x, yy, kind = 'small', w = 1, h = 1, force = false) => {
    if (!force) for (let j = yy; j < yy + h; j++) for (let i = x; i < x + w; i++) if (!free(i, j)) return;
    decorSlots.push(decorSlot(id, kind, x, yy, w, h));
    mark({ x, y: yy, w, h });
  };
  addSlot('sign', signRect.x, signRect.y, 'sign', 3, 1, true);
  addSlot('porch.left', house.door.x - 1, H + 6, 'small', 1, 1, true);
  addSlot('porch.right', house.door.x + 1, H + 6, 'small', 1, 1, true);
  addSlot('yard.1', 1, H + 6, 'small', 1, 1, house.door.x - 1 !== 1);
  addSlot('yard.2', 6, H + 6, 'small', 1, 1, house.door.x + 1 !== 6);
  addSlot('gate.left', 6, H, 'small', 1, 1, true);
  addSlot('gate.right', 8, H, 'small', 1, 1, true);
  addSlot('road.1', 1, H + 7, 'small', 1, 1, true);
  addSlot('road.2', 2, H + 7, 'small', 1, 1, house.door.x !== 2);
  addSlot('road.3', 11, H + 7, 'small', 1, 1, true);
  if (start.fence) decorSlots.push(decorSlot('field.corner', 'small', 3, start.y0 + 1));
  addSlot('pond', 4, H + 11, 'large', 2, 2, true);

  // ── Décor fixe (graine du niveau) ─────────────────────────────────────────────────
  const deco = [];
  const rnd = seededRandom(0xca7ee + (career.farmName ? [...String(career.farmName)].reduce((a, ch) => a + ch.charCodeAt(0), 0) : 0));
  const take = (x, yy) => { occ[yy * WT + x - X0] = 1; };
  // Colonne 0 d'abord (même tirage qu'avant la carte 2D), puis les colonnes de côté.
  const decoCols = [0];
  for (let c = cMin; c <= cMax; c++) if (c !== 0) decoCols.push(c);
  for (const dc of decoCols) {
  const dox = dc * COLS;
  for (let yy = TOP_FOREST; yy < ROWS - 2; yy++) {
    for (const x0 of [1, 11]) {
      const x = dox + x0;
      if (free(x, yy) && free(x, yy - 1) && rnd() < 0.45) {
        deco.push({ kind: 'treeTall', x: x * T + (x0 === 1 ? -3 : 3), y: yy * T, tx: x, ty: yy });
        take(x, yy);
        take(x, yy - 1);
      }
    }
  }
  for (let yy = TOP_FOREST; yy < ROWS - 2; yy++) {
    for (let x = dox + 1; x <= dox + 11; x++) {
      if (!free(x, yy)) continue;
      const kind = pickDeco(rnd(), 'default', free(x, yy - 1) && yy > TOP_FOREST);
      if (!kind) continue;
      const jx = Math.floor(rnd() * 5) - 2;
      const jy = Math.floor(rnd() * 3) - 1;
      deco.push({ kind, x: x * T + jx, y: yy * T + jy, tx: x, ty: yy });
      take(x, yy);
      if (kind === 'treeTall') take(x, yy - 1);
    }
  }
  }
  const props = [
    { name: 'barrel', x: 6, y: H + 3, dy: 1 },
  ];
  if (!(house.x + house.w <= 6)) props.length = 0;

  // ── Machines garées ────────────────────────────────────────────────────────────────
  const machineParking = {};
  const collectors = {};
  const shelterIds = Object.keys(slots).filter((id) => slots[id].kind === 'shelter' || slots[id].kind === 'pond');
  for (const [key, m] of Object.entries(machinesState)) {
    if (!m || !m.id) continue;
    const id = m.id;
    const sprite = machineSprite(id);
    const size = sprite ? tilesOf(sprite) : { w: 1, h: 1 };
    let spot = null;
    if (id === 'tractor') spot = tractorSpot;
    else if (id === 'waterTower') spot = waterTowerSpot;
    else if (id === 'seeder' || id === 'harvester' || id === 'fruitPicker') spot = parkingSpots[m.lotId]?.[id] || null;
    else if (id === 'collector') {
      const sid = m.buildingId || m.shelterId || m.target || shelterIds.find((s) => slots[s].lotId === m.lotId && !collectors[s]) || null;
      const sl = sid && slots[sid];
      if (sl) {
        collectors[sid] = key;
        const p = sl.pen || sl.building;
        spot = { x: sl.building.x + sl.building.w, y: sl.building.y + sl.building.h - 1 };
        if (spot.x - Math.floor(spot.x / COLS) * COLS > 11) spot = { x: p.x + p.w - 2, y: p.y + 1 };
      }
    }
    if (!spot || !sprite) continue;
    machineParking[key] = { x: spot.x * T, y: spot.y * T, w: size.w * T, h: size.h * T, sprite, id, lotId: m.lotId || null, key };
  }

  // ── Personnages : maison du fermier et trajets ───────────────────────────────────────
  const farmerHome = { x: house.door.x * T + 8, y: (H + 6) * T + 12 };
  const startGate = start.gate || { x: 7, y: start.y0 + 11 };
  const routeToField = [
    { x: house.door.x * T + 8, y: (H + 6) * T + 10 },
    { x: 7 * T + 8, y: (H + 6) * T + 10 },
    { x: 7 * T + 8, y: start.lane * T + 10 },
    { x: startGate.x * T + 8, y: startGate.y * T + 12 },
    { x: startGate.x * T + 8, y: (startGate.y - 1) * T + 12 },
  ];

  /** Bande (terrain) d'un point du monde (px) ; sans wx : colonne 0 (compatibilité). */
  function bandAt(wy, wx) {
    const tx = wx === undefined || wx === null ? 7 : Math.floor(wx / T);
    return bandAtTile(tx, Math.floor(wy / T));
  }

  /** Trajet d'avant la carte 2D (colonne 0) : allée du départ → épine → allée d'arrivée. */
  function routeCol0(a, b, ba, bb) {
    const sx = SPINE_X * T + 8;
    const la = ba.lane * T + 10;
    const lb = bb.lane * T + 10;
    const out = [];
    if (Math.abs(a.y - la) > 2) out.push({ x: a.x, y: la });
    out.push({ x: sx, y: la });
    out.push({ x: sx, y: lb });
    if (Math.abs(b.y - lb) > 2) out.push({ x: b.x, y: lb });
    out.push({ x: b.x, y: b.y });
    return out;
  }

  /** Tuile de chemin la plus proche d'un point : sur l'allée de son terrain, sinon la plus proche. */
  function pathTileNear(p, band) {
    const tx = Math.floor(p.x / T);
    if (band) {
      const ly = band.lane;
      for (let d = 0; d < COLS; d++) {
        for (const x of d ? [tx - d, tx + d] : [tx]) if (isPath(x, ly) && x >= X0 && x < X0 + WT) return { x, y: ly };
      }
    }
    const ty = Math.floor(p.y / T);
    let best = null;
    let bd = Infinity;
    const scan = (k) => {
      const [x, yy] = k.split(',').map(Number);
      const d = Math.abs(x - tx) + Math.abs(yy - ty);
      if (d < bd) { bd = d; best = { x, y: yy }; }
    };
    for (const k of pathSet) scan(k);
    if (ty >= ROAD_Y - 1 && ty <= ROAD_Y + 2) scan(`${Math.max(X0, Math.min(X0 + WT - 1, tx))},${ROAD_Y}`);
    return best;
  }

  /** Plus court chemin (tuiles) sur les allées, compressé aux virages. Cache par couple de tuiles. */
  const routeCache = new Map();
  function pathTiles(sa, sb) {
    const key = `${sa.x},${sa.y}>${sb.x},${sb.y}`;
    if (routeCache.has(key)) return routeCache.get(key);
    const idx = (x, yy) => yy * WT + x - X0;
    const prev = new Int32Array(WT * ROWS).fill(-1);
    const start = idx(sa.x, sa.y);
    const goal = idx(sb.x, sb.y);
    prev[start] = start;
    const queue = [start];
    for (let qi = 0; qi < queue.length && prev[goal] < 0; qi++) {
      const cur = queue[qi];
      const cx = (cur % WT) + X0;
      const cy = Math.floor(cur / WT);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < X0 || nx >= X0 + WT || ny < 0 || ny >= ROWS) continue;
        const n = idx(nx, ny);
        if (prev[n] >= 0 || !isPath(nx, ny)) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    let out = null;
    if (prev[goal] >= 0) {
      const tiles = [];
      for (let k = goal; ; k = prev[k]) {
        tiles.push({ x: (k % WT) + X0, y: Math.floor(k / WT) });
        if (k === start) break;
      }
      tiles.reverse();
      out = [tiles[0]];
      for (let i = 1; i < tiles.length - 1; i++) {
        const p0 = tiles[i - 1];
        const p2 = tiles[i + 1];
        if (p0.x !== p2.x && p0.y !== p2.y) out.push(tiles[i]); // virage
      }
      if (tiles.length > 1) out.push(tiles[tiles.length - 1]);
    }
    if (routeCache.size > 400) routeCache.clear();
    routeCache.set(key, out);
    return out;
  }

  /**
   * Trajet (points px) de a à b par les allées : dans un même terrain, ligne droite ; dans la colonne 0,
   * allée du terrain de départ → épine → allée du terrain d'arrivée ; sinon le plus court chemin sur les
   * allées (épines, allées prolongées, route). Le dernier point est b.
   */
  function route(a, b) {
    const ba = bandAt(a.y, a.x);
    const bb = bandAt(b.y, b.x);
    if (ba && bb && ba === bb) return [{ x: b.x, y: b.y }];
    if (ba && bb && ba.col === 0 && bb.col === 0) return routeCol0(a, b, ba, bb);
    // Hors de tout terrain (forêt, route) dans la colonne 0 : ligne droite, comme avant la carte 2D.
    const inCol0 = (p) => p.x >= 0 && p.x < COLS * T;
    if ((!ba || !bb) && ((cMin === 0 && cMax === 0) || (inCol0(a) && inCol0(b)))) return [{ x: b.x, y: b.y }];
    const sa = pathTileNear(a, ba);
    const sb = pathTileNear(b, bb);
    const tiles = sa && sb ? pathTiles(sa, sb) : null;
    if (!tiles) return [{ x: b.x, y: b.y }];
    const pt = (t) => ({ x: t.x * T + 8, y: t.y * T + 10 });
    const out = [];
    const first = pt(tiles[0]);
    if (Math.abs(a.y - first.y) > 2) out.push({ x: a.x, y: first.y });
    for (const t of tiles) out.push(pt(t));
    const last = out[out.length - 1];
    if (Math.abs(b.y - last.y) > 2) out.push({ x: b.x, y: last.y });
    out.push({ x: b.x, y: b.y });
    return out;
  }

  // ── Requêtes ─────────────────────────────────────────────────────────────────────
  const HOME_BUILDINGS = { house, storage, roadsideStand: stand };

  function plotRect(index) {
    const p = plots[index];
    return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
  }
  function plotCenter(index) {
    const p = plots[index];
    return p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : null;
  }
  function plotNeighbors() {
    return { left: -1, right: -1 };
  }

  /** Rectangle (tuiles) d'un bâtiment de carrière (maison, grenier, étal, abri, atelier, serre, mare). */
  function buildingTiles(id) {
    if (HOME_BUILDINGS[id]) {
      const b = HOME_BUILDINGS[id];
      return { x: b.x, y: b.y, w: b.w, h: b.h };
    }
    const s = slots[id];
    if (!s) return null;
    if (s.kind === 'greenhouse') return { x: s.building.x, y: s.building.y, w: 10, h: 7 };
    return s.pen ? unionTiles(s.building, s.pen) : s.garden ? unionTiles(s.building, s.garden) : s.building;
  }

  const ANIMAL_SHELTER = Object.fromEntries(Object.entries(SHELTER_ANIMAL).map(([k, v]) => [v, k]));

  function investmentRect(id, n = 99) {
    if (id === 'beehive') {
      const k = Math.max(1, Math.min(hives.length, n));
      if (!hives.length) return null;
      let r = { x: hives[0].x, y: hives[0].y, w: 1, h: 1 };
      for (let i = 1; i < k; i++) r = unionTiles(r, { x: hives[i].x, y: hives[i].y, w: 1, h: 1 });
      return px(r);
    }
    if (id === 'solarPanel') return px({ x: solar[0].x, y: solar[0].y, w: Math.max(1, Math.min(4, n)), h: 1 });
    if (id === 'chickenCoop') id = 'coop';
    if (ANIMAL_SHELTER[id]) id = ANIMAL_SHELTER[id];
    const t = buildingTiles(id);
    if (t) return px(t);
    const lot = lotEntries.find((l) => l.id === id);
    return lot ? { ...lot.rect } : null;
  }

  function investmentAnchor(id, n = 99) {
    if (id === 'chickenCoop') id = 'coop';
    if (ANIMAL_SHELTER[id]) id = ANIMAL_SHELTER[id];
    if (HOME_BUILDINGS[id]) {
      const b = HOME_BUILDINGS[id];
      return { x: (b.x + b.w / 2) * T, y: b.y * T - 2 };
    }
    if (slots[id]) return { x: slots[id].anchor.x, y: slots[id].anchor.y - 2 };
    if (id === 'beehive' || id === 'solarPanel') {
      const r = investmentRect(id, n);
      if (r) return { x: r.x + (r.w >> 1), y: r.y - 2 };
    }
    return { x: (house.x + house.w / 2) * T, y: house.y * T - 2 };
  }

  /** Emplacement (tuiles) de la k-ième ruche (null au-delà des places). */
  function hiveTile(k) {
    return hives[k] || null;
  }

  /**
   * Ce qui se trouve sous un point du monde (hors personnages et machines en mouvement : voir la scène).
   * @param st     game.state (ruches, panneaux) ou null
   * @param slop   tolérance (px du monde) pour le doigt
   */
  function hitTestCareer(wx, wy, st, slop = 0) {
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    // 1. Parcelles
    for (const p of plots) {
      if (p.retired) continue;
      if (wx >= p.x && wy >= p.y && wx < p.x + p.w && wy < p.y + p.h) return { type: 'plot', index: p.index };
    }
    const cands = [];
    const add = (r, hit, pri = 0) => cands.push({ r, hit, pri });
    // 2. Machines garées
    for (const [key, m] of Object.entries(machineParking)) add({ x: m.x, y: m.y, w: m.w, h: m.h }, { type: 'machine', key }, 1);
    // 3. Bâtiments de la maison
    add(px(house), { type: 'building', buildingId: 'house' });
    add(px(storage), { type: 'building', buildingId: 'storage' });
    add(px({ x: stand.x, y: stand.y, w: stand.w, h: Math.max(1, stand.h) }), { type: 'building', buildingId: 'roadsideStand' });
    // 4. Abris, ateliers, chambre d'hôte, serre, mare
    for (const [id, s] of Object.entries(slots)) {
      if (s.kind === 'pond') {
        add(px(s.dock), { type: 'pond', buildingId: id, lotId: s.lotId });
        add(px(s.water), { type: 'pond', buildingId: id, lotId: s.lotId });
        continue;
      }
      if (s.kind === 'greenhouse') {
        add(px({ x: s.building.x, y: s.building.y, w: 10, h: 2 }), { type: 'building', buildingId: id });
        add(px({ x: s.building.x, y: s.building.y + 6, w: 10, h: 1 }), { type: 'building', buildingId: id });
        continue;
      }
      const type = s.kind === 'shelter' ? 'shelter' : 'building';
      add(px(s.building), { type, buildingId: id }, 1);
      if (s.bakery) add(px(s.bakery), { type, buildingId: id });
      if (s.pen) add(px(s.pen), { type, buildingId: id });
      if (s.garden) add(px(s.garden), { type, buildingId: id });
    }
    // 5. Ruches et panneaux solaires possédés
    const nHives = Math.min(hives.length, st?.investments?.beehive || 0);
    for (let k = 0; k < nHives; k++) add(px({ x: hives[k].x, y: hives[k].y, w: 1, h: 1 }), { type: 'investment', id: 'beehive' });
    const nSolar = Math.min(4, st?.investments?.solarPanel || 0);
    for (let k = 0; k < nSolar; k++) add(px({ x: solar[k].x, y: solar[k].y, w: 1, h: 1 }), { type: 'investment', id: 'solarPanel' });
    // 6. Panneaux des terrains, emplacements libres
    for (const s of lotSigns) add(px({ x: s.x, y: s.y - 1, w: 1, h: 2 }), { type: 'lotSign', lotId: s.lotId }, 1);
    for (const e of emptySlots) add(px(e.rect), { type: 'lotSign', lotId: e.lotId, slot: e.slot });
    for (const w of wilds) add(px(w.rect), { type: 'lotSign', lotId: w.lotId });
    // Enclos du verger, champ (hors parcelles) : fiche du terrain
    // 7. Terrains à vendre (tout le bloc)
    for (const sb of saleBands) add(px({ x: sb.ox, y: sb.y0, w: COLS, h: sb.rows }), { type: 'lotForSale', lotId: sb.id });
    let best = null;
    let bestD = Infinity;
    for (const c of cands) {
      if (inRect(c.r, wx, wy)) {
        // Exact : priorité aux petites cibles (machine, bâtiment) sur les grandes zones (enclos).
        const d = -c.pri * 1e6 + c.r.w * c.r.h;
        if (d < bestD) { bestD = d; best = c.hit; }
      }
    }
    if (best) return best;
    if (slop <= 0) return null;
    // Tolérance du doigt : la parcelle la plus proche, sinon la cible la plus proche.
    let bi = -1;
    bestD = Infinity;
    for (const p of plots) {
      if (p.retired) continue;
      const d = distToRect(p, wx, wy);
      if (d < bestD) { bestD = d; bi = p.index; }
    }
    if (bi >= 0 && bestD <= slop) return { type: 'plot', index: bi };
    bestD = Infinity;
    for (const c of cands) {
      const d = distToRect(c.r, wx, wy);
      if (d <= slop * 1.5 && d < bestD) { bestD = d; best = c.hit; }
    }
    void tx;
    void ty;
    return best;
  }

  /** Compatibilité avec la forme des niveaux : { type: 'plot' } | { type: 'investment' } | … */
  function hitTest(wx, wy, owned) {
    return hitTestCareer(wx, wy, owned ? { investments: owned } : null, 0);
  }
  function hitTestNear(wx, wy, owned, slop = 4) {
    return hitTestCareer(wx, wy, owned ? { investments: owned } : null, slop);
  }

  /** Rectangle (px) d'une cible de hitTest (surbrillance). */
  function hitRect(hit) {
    if (!hit) return null;
    switch (hit.type) {
      case 'plot': return plotRect(hit.index);
      case 'investment': return investmentRect(hit.id, 99);
      case 'building':
      case 'shelter': {
        const t = buildingTiles(hit.buildingId);
        return t ? px(t) : null;
      }
      case 'machine': {
        const m = machineParking[hit.key];
        return m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
      }
      case 'pond': {
        const p = slots[hit.buildingId || 'duckPond'];
        return p ? px(unionTiles(p.water, p.dock)) : null;
      }
      case 'lotSign': {
        if (hit.slot !== undefined) {
          const e = emptySlots.find((s) => s.lotId === hit.lotId && s.slot === hit.slot);
          if (e) return px(e.rect);
        }
        const s = lotSigns.find((l) => l.lotId === hit.lotId);
        return s ? px({ x: s.x, y: s.y, w: 1, h: 1 }) : null;
      }
      case 'lotForSale': {
        const sb = saleBands.find((b) => b.id === hit.lotId) || saleBand;
        return sb ? px({ x: sb.ox + 5, y: sb.y0 + sb.rows - 2, w: 4, h: 2 }) : null;
      }
      default: return null;
    }
  }

  const startFence = start.fence || { x: 2, y: start.y0, w: 10, h: 12 };
  const field = { gx: 3, gy: start.y0 + 2, cols: 4, rows: 4, fence: startFence, gate: startGate, vCols: 4, vRows: 4, transposed: false };

  return {
    TILE,
    cols: WT,
    rows: ROWS,
    width: WORLD_W,
    height: WORLD_H,
    level,
    available: new Set(),
    field,
    plots,
    house,
    well,
    props,
    slots,
    decorSlots,
    sign: signRect,
    slotIds: [],
    roadY: ROAD_Y,
    mainPathX: 7,
    spineX: SPINE_X,
    deco,
    garden: { flowers: [], bushes: [], plants: [] },
    farmerHome,
    routeToField,
    isPath,
    isForest,
    mode: 'career',
    career: true,
    theme: 'default',
    plotSize: PLOT_TILES * T,
    plotScale: PLOT_TILES,
    transposed: false,
    essential: { x: T, y: 0, w: 12 * T, h: WORLD_H },
    fieldRect: px(startFence),
    homeRect: px({ x: 0, y: H, w: COLS, h: 14 }),
    plotNeighbors,
    plotRect,
    plotCenter,
    investmentRect,
    investmentAnchor,
    hitTest,
    hitTestNear,
    hitTestCareer,
    hitRect,
    buildingTiles,
    // ── Carrière ──
    lots: lotEntries.map(({ band, ...l }) => l),
    bands,
    saleBand,
    saleBands,
    x0: X0 * T,
    x1: X0 * T + WORLD_W,
    grid: { cMin, cMax, rMax, rowTop, rowBottom, x0Tiles: X0, colsTiles: WT, rowY, roadY: ROAD_Y, homeBottom: ROWS },
    home: { house, storage, stand, well, solar, waterTower: waterTowerSpot, tractor: tractorSpot, y0: H, roadY: ROAD_Y, lane: home.lane },
    start,
    fences,
    emptySlots,
    lotSigns,
    hives,
    hiveTile,
    solar,
    sprinklers,
    greenhouses,
    ponds,
    cobbles,
    wilds,
    orchards,
    conveyors,
    machineParking,
    collectors,
    route,
    bandAt,
    lotRect(id) {
      const l = lotEntries.find((e) => e.id === id);
      return l ? { ...l.rect } : null;
    },
  };
}

function unionTiles(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export { tileHash };
