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
  for (const l of c.lots || []) k += `${l.id}:${l.type}:${l.slots ? l.slots.join(',') : ''};`;
  k += '|';
  for (const [id, b] of Object.entries(c.buildings || {})) k += `${id}:${b?.level || 0}:${b?.lotId}:${b?.slot};`;
  k += '|';
  for (const [key, m] of Object.entries(c.machines || {})) if (m) k += `${key}:${m.id}:${m.lotId}:${m.level || 1};`;
  k += `|${c.rank >= 6 ? 'D' : ''}`;
  return k;
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
  const bought = lotsState.filter((l) => l.index >= FIRST_LOT_INDEX).sort((a, b) => a.index - b.index);
  const nBought = bought.length;
  const forSale = nBought < MAX_LOTS;

  // ── Bandes (de haut en bas) ─────────────────────────────────────────────────────────
  const bands = [];
  let y = TOP_FOREST;
  let saleBand = null;
  if (forSale) {
    const index = FIRST_LOT_INDEX + nBought;
    saleBand = { id: lotIdFor(index), index, type: 'forSale', name: LOT_NAMES[nBought] || '', y0: y, rows: LOT_ROWS, forSale: true };
    bands.push(saleBand);
    y += LOT_ROWS;
  } else {
    y += 1; // lisière au-dessus du dernier terrain
  }
  for (let k = nBought - 1; k >= 0; k--) {
    const l = bought[k];
    bands.push({ id: l.id, index: l.index, type: l.type || 'wild', name: l.name || '', y0: y, rows: LOT_ROWS, lot: l });
    y += LOT_ROWS;
  }
  const yardLot = lotsState.find((l) => l.id === 'yard') || { id: 'yard', index: 2, type: 'yard', slots: [null, null], name: 'La basse-cour' };
  const yard = { id: 'yard', index: 2, type: 'yard', name: yardLot.name, y0: y, rows: LOT_ROWS, lot: yardLot };
  bands.push(yard);
  y += LOT_ROWS;
  const startLot = lotsState.find((l) => l.id === 'start') || { id: 'start', index: 1, type: 'field', name: 'Le champ de départ' };
  const start = { id: 'start', index: 1, type: 'field', name: startLot.name, y0: y, rows: START_ROWS, lot: startLot, start: true };
  bands.push(start);
  y += START_ROWS;
  const homeLot = lotsState.find((l) => l.id === 'home') || { id: 'home', index: 0, type: 'home', name: 'La maison' };
  const home = { id: 'home', index: 0, type: 'home', name: homeLot.name, y0: y, rows: HOME_ROWS, lot: homeLot };
  bands.push(home);
  y += HOME_ROWS;
  const ROWS = y;
  const WORLD_W = COLS * T;
  const WORLD_H = ROWS * T;
  for (const b of bands) b.lane = b.type === 'home' ? b.y0 + 6 : b.y0 + b.rows - 1;
  const bandById = new Map(bands.map((b) => [b.id, b]));
  const bandAtRow = (ty) => bands.find((b) => ty >= b.y0 && ty < b.y0 + b.rows) || null;

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
  const topOwned = bands.find((b) => !b.forSale);
  const spineTop = topOwned ? topOwned.y0 : yard.y0;
  for (let yy = spineTop; yy < ROAD_Y; yy++) addPath(SPINE_X, yy);
  for (const b of bands) {
    if (b.forSale || b.type === 'home') continue;
    for (let x = 2; x <= SPINE_X; x++) addPath(x, b.lane);
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

  function isForest(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return false;
    if (ty < TOP_FOREST) return true;
    if (ty >= ROWS - 2) return true;
    if (tx <= 0 || tx >= COLS - 1) return true;
    if (saleBand && ty >= saleBand.y0 && ty < saleBand.y0 + saleBand.rows - 1) return true;
    return false;
  }

  // ── Occupation (décor) ────────────────────────────────────────────────────────────
  const occ = new Uint8Array(COLS * ROWS);
  const mark = (r) => {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && yy >= 0 && x < COLS && yy < ROWS) occ[yy * COLS + x] = 1;
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
    const penX = left ? 1 : 7;
    const penW = left ? 6 : 5;
    const lvl = Math.max(1, buildingsState[buildingId]?.level || 1);
    const sprite = careerBuildingSprite(buildingId, lvl);
    const st = tilesOf(sprite);
    const bx = penX + Math.max(0, Math.floor((penW - st.w) / 2));
    const building = { x: Math.min(bx, 12 - st.w), y: band.y0 + 3 - st.h, w: st.w, h: st.h };
    const guest = buildingId === 'guestHouse';
    const pen = guest ? null : { x: penX, y: band.y0 + 3, w: penW, h: 7 };
    const anchor = { x: (building.x + building.w / 2) * T, y: building.y * T };
    // Bulle de ramassage : à droite du toit (reste dans le terrain, ne cache pas celui du dessus).
    const bubble = { x: Math.min((12 - 1) * T - 20, (building.x + building.w) * T - 6), y: building.y * T - 2 };
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
    const s = { x: 1, y: band.lane };
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
    if (band.forSale) {
      lotEntries.push({ id: band.id, index: band.index, type: null, name: band.name, forSale: true, rect: px({ x: 0, y: y0, w: COLS, h: band.rows }), sign: { x: 6, y: y0 + band.rows - 2 }, lane: band.lane, band });
      continue;
    }
    if (band.type === 'home') {
      lotEntries.push({ id: band.id, index: 0, type: 'home', name: band.name, forSale: false, rect: px({ x: 0, y: y0, w: COLS, h: 10 }), sign: null, lane: band.lane, band });
      continue;
    }
    const sign = addLotSign(band);
    lotEntries.push({ id: band.id, index: band.index, type: band.type, name: band.name, forSale: false, rect: px({ x: 0, y: y0, w: COLS, h: band.rows }), sign, lane: band.lane, band });
    const type = band.type;
    if (band.start) {
      // Champ de départ : clôture 10 × 12, marges haute et basse (arroseurs), portail en bas au milieu.
      const fence = { x: 2, y: y0, w: 10, h: 12 };
      const gate = { x: 7, y: y0 + 11 };
      fences.push({ rect: fence, gateX: gate.x, kind: 'field', field: true });
      band.fence = fence;
      band.gate = gate;
      fieldPlots(band, 3, y0 + 2);
      sprinklers.start = { heads: sprinklerHeads(3, y0 + 2, 8, 8, gate) };
      hives.push({ x: 1, y: y0 + 3, lotId: 'start' }, { x: 1, y: y0 + 7, lotId: 'start' });
      parkingSpots.start = { seeder: { x: 3, y: band.lane }, harvester: { x: 8, y: band.lane - 1 } };
      mark({ x: 1, y: y0, w: 11, h: START_ROWS });
      continue;
    }
    if (type === 'field') {
      const fence = { x: 2, y: y0, w: 10, h: 10 };
      fences.push({ rect: fence, gateX: 7, kind: 'field', field: true });
      band.fence = fence;
      band.gate = { x: 7, y: y0 + 9 };
      fieldPlots(band, 3, y0 + 1);
      sprinklers[band.id] = { heads: [{ x: 4, y: y0 }, { x: 9, y: y0 }, { x: 6, y: y0 + 9 }, { x: 6, y: y0 }, { x: 3, y: y0 + 9 }, { x: 10, y: y0 + 9 }], onFence: true };
      hives.push({ x: 1, y: y0 + 2, lotId: band.id }, { x: 1, y: y0 + 6, lotId: band.id });
      parkingSpots[band.id] = { seeder: { x: 3, y: band.lane }, harvester: { x: 8, y: band.lane - 1 } };
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'orchard') {
      const fence = { x: 1, y: y0, w: 11, h: 10 };
      fences.push({ rect: fence, gateX: 7, kind: 'orchard' });
      orchards.push({ rect: { x: 2, y: y0 + 1, w: 9, h: 8 }, lotId: band.id });
      for (const i of plotsByLot.get(band.id) || []) {
        const p = statePlots[i];
        const cell = Number.isInteger(p.cell) ? p.cell : 0;
        const col = cell % 3;
        const row = Math.floor(cell / 3) % 3;
        placePlot(i, [2, 5, 8][col], y0 + [1, 4, 7][row], band, col, row);
        if (p.env === null) plots[i].retired = true;
      }
      parkingSpots[band.id] = { fruitPicker: { x: 9, y: band.lane - 1 } };
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'greenhouse') {
      const gh = { x: 2, y: y0 + 1, w: 10, h: 7, lotId: band.id, level: Math.max(1, levelOf('greenhouse') || 1) };
      greenhouses.push(gh);
      for (const i of plotsByLot.get(band.id) || []) {
        const p = statePlots[i];
        const cell = Number.isInteger(p.cell) ? p.cell : 0;
        const col = cell % 4;
        const row = Math.floor(cell / 4) % 2;
        placePlot(i, 3 + col * PLOT_TILES, y0 + 3 + row * PLOT_TILES, band, col, row);
        if (p.env === null) plots[i].retired = true;
      }
      slots.greenhouse = { building: { x: 2, y: y0 + 1, w: 10, h: 2 }, pen: null, sign: { x: 1, y: band.lane }, anchor: { x: 7 * T, y: (y0 + 1) * T }, lotId: band.id, slot: null, kind: 'greenhouse', sprite: null, level: gh.level };
      sprinklers[band.id] = { heads: [{ x: 4, y: y0 + 7 }, { x: 9, y: y0 + 7 }, { x: 6, y: y0 + 7 }, { x: 8, y: y0 + 7 }], inGreenhouse: true };
      parkingSpots[band.id] = { seeder: { x: 3, y: band.lane } };
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'pond') {
      const water = { x: 3, y: y0 + 2, w: 8, h: 5 };
      const dock = { x: 6, y: y0 + 6, w: 3, h: 1 };
      ponds.push({ water, dock, lotId: band.id });
      const lvl = Math.max(1, levelOf('duckPond') || 1);
      slots.duckPond = { building: water, pen: water, sign: { x: 1, y: band.lane }, anchor: { x: (water.x + 2) * T, y: water.y * T }, bubble: { x: (water.x + 1) * T, y: (water.y - 1) * T - 8 }, lotId: band.id, slot: null, kind: 'pond', sprite: null, level: lvl, animal: 'duck', water, dock };
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'workshops') {
      const area = { x: 1, y: y0 + 1, w: 11, h: 9 };
      cobbles.push(area);
      conveyors.push({ y: y0 + 8, x0: 1, x1: 11, lotId: band.id });
      const ls = band.lot?.slots || [null, null];
      for (let s = 0; s < 2; s++) {
        const bid = ls[s];
        if (bid) {
          const sprite = careerBuildingSprite(bid, buildingsState[bid]?.level || 1);
          const st = tilesOf(sprite);
          const bx = s === 0 ? 2 : 8;
          const building = { x: bx, y: y0 + 6 - st.h, w: st.w, h: st.h };
          const entry = { building, pen: null, sign: { x: bx + 1, y: y0 + 5 }, anchor: { x: (bx + st.w / 2) * T, y: building.y * T }, lotId: band.id, slot: s, kind: 'workshop', sprite, level: buildingsState[bid]?.level || 1 };
          if (bid === 'mill') entry.bakery = { x: s === 0 ? 5 : 6, y: y0 + 4, w: 2, h: 2 };
          slots[bid] = entry;
        } else {
          emptySlots.push({ lotId: band.id, slot: s, rect: { x: s === 0 ? 1 : 7, y: y0 + 1, w: s === 0 ? 6 : 5, h: 7 }, sign: { x: s === 0 ? 3 : 9, y: y0 + 5 } });
        }
      }
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
    } else if (type === 'meadow' || type === 'yard') {
      const ls = band.lot?.slots || [null, null];
      for (let s = 0; s < 2; s++) {
        const bid = ls[s];
        if (bid) slotBuilding(band, s, bid);
        else {
          const r = { x: s === 0 ? 1 : 7, y: y0, w: s === 0 ? 6 : 5, h: 10 };
          emptySlots.push({ lotId: band.id, slot: s, rect: r, sign: { x: r.x + Math.floor(r.w / 2), y: y0 + 4 } });
          mark(r);
        }
      }
    } else {
      // Friche (ou type inconnu) : herbes hautes, souches, fleurs sauvages.
      wilds.push({ rect: { x: 1, y: y0, w: 11, h: 10 }, lotId: band.id, seed: band.index });
      mark({ x: 1, y: y0, w: 11, h: LOT_ROWS });
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
  if (saleBand) mark({ x: 5, y: saleBand.y0 + saleBand.rows - 2, w: 4, h: 2 });

  // ── Emplacements de décoration (identifiants communs aux niveaux) ───────────────────
  const free = (x, yy) => x >= 1 && x <= 11 && yy >= TOP_FOREST && yy < ROWS - 2 && yy !== ROAD_Y && yy !== ROAD_Y + 1 && !occ[yy * COLS + x] && !isForest(x, yy);
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
  const take = (x, yy) => { occ[yy * COLS + x] = 1; };
  for (let yy = TOP_FOREST; yy < ROWS - 2; yy++) {
    for (const x of [1, 11]) {
      if (free(x, yy) && free(x, yy - 1) && rnd() < 0.45) {
        deco.push({ kind: 'treeTall', x: x * T + (x === 1 ? -3 : 3), y: yy * T, tx: x, ty: yy });
        take(x, yy);
        take(x, yy - 1);
      }
    }
  }
  for (let yy = TOP_FOREST; yy < ROWS - 2; yy++) {
    for (let x = 1; x <= 11; x++) {
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
        if (spot.x > 11) spot = { x: p.x + p.w - 2, y: p.y + 1 };
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

  /** Bande (terrain) d'un point du monde (px). */
  function bandAt(wy) {
    return bandAtRow(Math.floor(wy / T));
  }

  /**
   * Trajet (points px) de a à b par les allées : dans un même terrain, ligne droite ; sinon allée du
   * terrain de départ → épine → allée du terrain d'arrivée. Le dernier point est b.
   */
  function route(a, b) {
    const ba = bandAt(a.y);
    const bb = bandAt(b.y);
    if (!ba || !bb || ba === bb) return [{ x: b.x, y: b.y }];
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
    if (s.kind === 'greenhouse') return { x: 2, y: s.building.y, w: 10, h: 7 };
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
        add(px({ x: 2, y: s.building.y, w: 10, h: 2 }), { type: 'building', buildingId: id });
        add(px({ x: 2, y: s.building.y + 6, w: 10, h: 1 }), { type: 'building', buildingId: id });
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
    // 7. Terrain à vendre (toute la bande)
    if (saleBand) add(px({ x: 0, y: saleBand.y0, w: COLS, h: saleBand.rows }), { type: 'lotForSale', lotId: saleBand.id });
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
      case 'lotForSale': return saleBand ? px({ x: 5, y: saleBand.y0 + saleBand.rows - 2, w: 4, h: 2 }) : null;
      default: return null;
    }
  }

  const startFence = start.fence || { x: 2, y: start.y0, w: 10, h: 12 };
  const field = { gx: 3, gy: start.y0 + 2, cols: 4, rows: 4, fence: startFence, gate: startGate, vCols: 4, vRows: 4, transposed: false };

  return {
    TILE,
    cols: COLS,
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
