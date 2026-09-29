// Disposition de la scène, en « pixels du monde » (tuiles de 16 px), pour un niveau donné.
//
// Le monde fait toujours 32 × 20 tuiles (512 × 320 px), quel que soit le niveau : seule la taille
// du champ change. Tout ce qui dépasse du monde (bandes autour, à l'écran) est de la forêt, sauf la
// route qui traverse la scène de part en part.
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

export const WORLD_COLS = 32;
export const WORLD_ROWS = 20;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;

const ROAD_Y = 17; // route : lignes 17 et 18
const MAIN_PATH_X = 15; // chemin du portail du champ jusqu'à la route
const FIELD_BOTTOM_ROW = 8; // dernière ligne de parcelles (grille ancrée en bas)
const FIELD_CENTER_X = 16;

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage entier → [0, 1) d'une position de tuile (décor stable, sans scintillement). */
export function tileHash(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const px = (r) => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });
const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
const union = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/**
 * @param level  objet niveau (src/data/levels.js) : gridCols, gridRows, availableInvestments,
 *               modifiers.noSprinkler, id.
 */
export function createLayout(level) {
  const cols = Math.max(1, Math.min(8, level.gridCols || 6));
  const rows = Math.max(1, Math.min(5, level.gridRows || 4));
  const available = new Set(
    (level.availableInvestments || []).filter((id) => !(id === 'sprinkler' && level.modifiers?.noSprinkler)),
  );

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
  const house = { x: 3, y: 11, w: 4, h: 3, door: { x: 5, y: 13 } };
  const well = { x: 1, y: 12, w: 1, h: 2 };

  // Arrosage automatique : têtes dans les marges haute et basse du champ, selon le niveau (2/4/6).
  const sprinklerTiles = [];
  {
    const top = gy - 1;
    const bottom = gy + rows;
    const left = gx + (cols >= 4 ? 1 : 0);
    const right = gx + cols - 1 - (cols >= 4 ? 1 : 0);
    const mid = gx + Math.floor(cols / 2) - (cols % 2 === 0 ? 1 : 0);
    const cand = [
      { x: left, y: top }, { x: right, y: top },
      { x: left, y: bottom }, { x: right, y: bottom },
      { x: mid, y: top }, { x: Math.min(right, mid + 1 + (cols % 2 === 0 ? 1 : 0)), y: bottom },
    ];
    // Évite le portail et les doublons.
    const seen = new Set();
    for (const t of cand) {
      if (t.x === gate.x && t.y === bottom) t.x = t.x - 1 >= gx ? t.x - 1 : t.x + 1;
      const k = `${t.x},${t.y}`;
      if (!seen.has(k)) {
        seen.add(k);
        sprinklerTiles.push(t);
      }
    }
    while (sprinklerTiles.length < 6) sprinklerTiles.push(sprinklerTiles[sprinklerTiles.length % Math.max(1, sprinklerTiles.length)]);
  }

  const slots = {
    chickenCoop: {
      shed: { x: 1, y: 4, w: 2, h: 3 },
      fence: { x: 3, y: 3, w: 6, h: 5 },
      pen: { x: 4, y: 4, w: 4, h: 3 },
      gate: null,
      sign: { x: 5, y: 5 },
      perUnit: 3, // poules par poulailler
    },
    beehive: {
      hives: [{ x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 9 }],
      area: { x: 1, y: 8, w: 5, h: 2 },
      sign: { x: 3, y: 9 },
    },
    cow: {
      barn: { x: 28, y: 3, w: 3, h: 6 },
      fence: { x: 22, y: 3, w: 6, h: 6 },
      pen: { x: 23, y: 4, w: 4, h: 4 },
      sign: { x: 24, y: 5 },
    },
    sheep: {
      fence: { x: 22, y: 10, w: 6, h: 5 },
      pen: { x: 23, y: 11, w: 4, h: 3 },
      extras: { x: 28, y: 11, w: 3, h: 3 },
      sign: { x: 24, y: 12 },
    },
    roadsideStand: {
      cart: { x: 19, y: 16 },
      crates: [{ x: 18, y: 16 }, { x: 20, y: 16 }, { x: 21, y: 16 }],
      area: { x: 18, y: 16, w: 4, h: 1 },
      sign: { x: 19, y: 16 },
    },
    sprinkler: {
      units: sprinklerTiles,
      perLevel: [2, 4, 6],
      sign: { x: fence.x + fence.w, y: fence.y + fence.h - 1 }, // juste à droite du coin bas du champ
    },
    solarPanel: {
      units: [{ x: 7, y: 13 }, { x: 8, y: 13 }],
      area: { x: 7, y: 13, w: 2, h: 1 },
      sign: { x: 7, y: 13 },
    },
    guestHouse: {
      house: { x: 10, y: 12, w: 4, h: 3, door: { x: 12, y: 14 } },
      garden: { x: 9, y: 15, w: 5, h: 2 },
      sign: { x: 11, y: 13 },
    },
  };
  // Le panneau « à vendre » de l'arrosage ne doit pas tomber sur le pré des vaches ou le chemin.
  if (slots.sprinkler.sign.x >= 22) slots.sprinkler.sign = { x: fence.x - 1, y: fence.y + fence.h - 1 };

  // Zone d'un emplacement (tuiles) selon le nombre possédé (0 = panneau seul).
  function slotTiles(id, n = 99) {
    const s = slots[id];
    if (!s) return null;
    if (n <= 0) return { x: s.sign.x, y: s.sign.y, w: 1, h: 1 };
    switch (id) {
      case 'chickenCoop': return union(s.shed, s.fence);
      case 'beehive': {
        const k = Math.min(s.hives.length, n);
        return { x: s.hives[0].x, y: s.hives[0].y, w: k, h: 1 };
      }
      case 'cow': return union(s.barn, s.fence);
      case 'sheep': return s.fence;
      case 'roadsideStand': return s.area;
      case 'solarPanel': return { x: s.units[0].x, y: s.units[0].y - 1, w: Math.min(2, n), h: 2 };
      case 'guestHouse': return s.house;
      case 'sprinkler': return null; // plusieurs têtes : voir hitTest
      default: return null;
    }
  }

  // ── Chemins (masque de tuiles) ───────────────────────────────────────────────────
  const pathSet = new Set();
  const addPath = (x, y) => pathSet.add(`${x},${y}`);
  for (let y = gate.y + 1; y < ROAD_Y; y++) addPath(MAIN_PATH_X, y); // portail → route
  for (let y = house.door.y + 1; y < ROAD_Y; y++) addPath(house.door.x, y); // maison → route
  const gh = slots.guestHouse.house;
  for (let x = gh.door.x; x < MAIN_PATH_X; x++) addPath(x, gh.door.y + 1); // chambre d'hôte → chemin

  /** true si la tuile (même hors du monde) est un chemin ou la route. */
  function isPath(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return true;
    return pathSet.has(`${tx},${ty}`);
  }

  /** true si la tuile (même hors du monde) est de la forêt. */
  function isForest(tx, ty) {
    if (ty === ROAD_Y || ty === ROAD_Y + 1) return false;
    if (ty <= 1 || ty >= WORLD_ROWS - 1) return true;
    return tx <= 0 || tx >= WORLD_COLS - 1;
  }

  // ── Occupation (pour le décor) ───────────────────────────────────────────────────
  const occ = new Uint8Array(WORLD_COLS * WORLD_ROWS);
  const mark = (r, pad = 0) => {
    for (let y = r.y - pad; y < r.y + r.h + pad; y++) {
      for (let x = r.x - pad; x < r.x + r.w + pad; x++) {
        if (x >= 0 && y >= 0 && x < WORLD_COLS && y < WORLD_ROWS) occ[y * WORLD_COLS + x] = 1;
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
    { name: 'barrel', x: 2, y: 13, dy: 1 },
    { name: 'bucket.water', x: 2, y: 14, dx: 2, dy: -3 },
  ];
  for (const p of props) mark({ x: p.x, y: p.y, w: 1, h: 1 });
  mark(slots.chickenCoop.shed);
  mark(slots.chickenCoop.fence);
  mark(slots.beehive.area);
  mark(slots.cow.barn);
  mark({ x: slots.cow.barn.x, y: slots.cow.barn.y + slots.cow.barn.h, w: 3, h: 1 });
  mark(slots.cow.fence);
  mark(slots.sheep.fence);
  mark(slots.sheep.extras);
  mark({ x: 17, y: 15, w: 6, h: 2 }); // étal et ses abords
  mark(slots.solarPanel.area);
  mark({ x: 7, y: 12, w: 2, h: 1 });
  mark(gh);
  mark(slots.guestHouse.garden);
  mark({ x: slots.sprinkler.sign.x, y: slots.sprinkler.sign.y, w: 1, h: 1 });
  for (const k of pathSet) {
    const [x, y] = k.split(',').map(Number);
    mark({ x, y, w: 1, h: 1 });
  }
  const free = (x, y) => x >= 1 && y >= 2 && x < WORLD_COLS - 1 && y < ROAD_Y && !occ[y * WORLD_COLS + x];

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
        deco.push({ kind: 'treeTall', x: x * TILE + (x === 1 ? -3 : 3), y: y * TILE, tx: x, ty: y });
        take(x, y);
        take(x, y - 1);
      }
    }
  }
  // Sous la forêt du haut : quelques arbres.
  for (let x = 1; x < WORLD_COLS - 1; x++) {
    if (free(x, 2) && rnd() < 0.3) {
      deco.push({ kind: rnd() < 0.5 ? 'tree' : 'bush', x: x * TILE, y: 2 * TILE, tx: x, ty: 2 });
      take(x, 2);
    }
  }
  // Parterre de fleurs autour des ruches (sol).
  for (let y = 8; y <= 10; y++) {
    for (let x = 1; x <= 6; x++) {
      const isHive = y === 9 && x >= 2 && x <= 4;
      if (!isHive && !(x === house.x && y === 10)) deco.push({ kind: 'flowerbed', x: x * TILE, y: y * TILE, tx: x, ty: y });
    }
  }
  // Semis aléatoire.
  for (let y = 2; y < ROAD_Y; y++) {
    for (let x = 1; x < WORLD_COLS - 1; x++) {
      if (!free(x, y)) continue;
      const r = rnd();
      let kind = null;
      if (r < 0.07 && free(x, y - 1)) kind = 'treeTall';
      else if (r < 0.13) kind = 'tree';
      else if (r < 0.17) kind = 'bush';
      else if (r < 0.19) kind = 'berry';
      else if (r < 0.215) kind = 'rocks';
      else if (r < 0.225) kind = 'rocksBig';
      else if (r < 0.235) kind = 'stump';
      else if (r < 0.245) kind = 'log';
      else if (r < 0.265) kind = 'mushrooms';
      else if (r < 0.29) kind = 'fern';
      else if (r < 0.31) kind = 'weeds';
      if (!kind) continue;
      const jx = Math.floor(rnd() * 5) - 2;
      const jy = Math.floor(rnd() * 3) - 1;
      deco.push({ kind, x: x * TILE + jx, y: y * TILE + jy, tx: x, ty: y });
      take(x, y);
      if (kind === 'treeTall') take(x, y - 1);
    }
  }
  // Jardin de la chambre d'hôte (visible seulement si achetée) : fleurs et haie.
  const gardenFlowers = [{ x: 9, y: 15 }, { x: 10, y: 15 }, { x: 11, y: 15 }];
  const gardenBushes = [{ x: 9, y: 13 }, { x: 9, y: 14 }];
  const gardenFence = { y: 16, x0: 9, x1: 13 };

  // ── Fermier : maison, et trajet jusqu'au champ ───────────────────────────────────
  const T = TILE;
  const farmerHome = { x: house.door.x * T + 8, y: (house.door.y + 1) * T + 12 };
  const routeToField = [
    { x: house.door.x * T + 8, y: ROAD_Y * T + 10 },
    { x: MAIN_PATH_X * T + 8, y: ROAD_Y * T + 10 },
    { x: gate.x * T + 8, y: gate.y * T + 12 },
    { x: gate.x * T + 8, y: (gate.y - 1) * T + 12 },
  ];

  // ── Requêtes ─────────────────────────────────────────────────────────────────────
  function plotRect(index) {
    const p = plots[index];
    return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
  }

  /** Rectangle (px) d'un investissement pour n unités possédées (défaut : zone complète). */
  function investmentRect(id, n = 99) {
    if (id === 'sprinkler') {
      const k = n <= 0 ? 0 : slots.sprinkler.perLevel[Math.min(2, n - 1)];
      if (k === 0) return px({ x: slots.sprinkler.sign.x, y: slots.sprinkler.sign.y, w: 1, h: 1 });
      return px({ x: fence.x, y: fence.y, w: fence.w, h: fence.h });
    }
    const t = slotTiles(id, n);
    return t ? px(t) : null;
  }

  /** Point (px) au-dessus d'un investissement, pour les textes flottants. */
  function investmentAnchor(id, n = 99) {
    const s = slots[id];
    if (!s) return { x: WORLD_W / 2, y: WORLD_H / 2 };
    let r;
    switch (id) {
      case 'chickenCoop': r = px(s.shed); break;
      case 'cow': r = px(s.barn); break;
      case 'sheep': r = px(s.pen); break;
      case 'beehive': r = px(slotTiles(id, n > 0 ? n : 3)); break;
      case 'roadsideStand': r = px({ x: s.cart.x, y: s.cart.y, w: 1, h: 1 }); break;
      case 'solarPanel': r = px(slotTiles(id, n > 0 ? n : 2)); break;
      case 'guestHouse': r = px(s.house); break;
      case 'sprinkler': r = px({ x: gate.x, y: fence.y, w: 1, h: 1 }); break;
      default: r = investmentRect(id, n);
    }
    return { x: r.x + (r.w >> 1), y: r.y - 2 };
  }

  /** Centre (px) d'une parcelle. */
  function plotCenter(index) {
    const p = plots[index];
    return p ? { x: p.x + 8, y: p.y + 8 } : null;
  }

  /**
   * Ce qui se trouve sous un point du monde.
   * @param owned  facultatif : { id: nombre possédé } (ex. game.state.investments). Sans lui,
   *               toutes les zones comptent ; avec lui, un emplacement non acheté ne réagit que
   *               sur son panneau « à vendre ».
   * @returns {type:'plot', index} | {type:'investment', id} | null
   */
  function hitTest(wx, wy, owned) {
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    if (tx >= gx && tx < gx + cols && ty >= gy && ty < gy + rows) {
      return { type: 'plot', index: (ty - gy) * cols + (tx - gx) };
    }
    const count = (id) => (owned ? owned[id] || 0 : 99);
    if (available.has('sprinkler')) {
      const n = count('sprinkler');
      const k = n > 0 ? slots.sprinkler.perLevel[Math.min(2, n - 1)] : 0;
      for (let i = 0; i < k; i++) {
        const u = slots.sprinkler.units[i];
        if (u.x === tx && u.y === ty) return { type: 'investment', id: 'sprinkler' };
      }
      if (n === 0 && slots.sprinkler.sign.x === tx && slots.sprinkler.sign.y === ty) {
        return { type: 'investment', id: 'sprinkler' };
      }
    }
    for (const id of Object.keys(slots)) {
      if (id === 'sprinkler' || !available.has(id)) continue;
      const t = slotTiles(id, count(id));
      if (t && inRect(t, tx, ty)) return { type: 'investment', id };
      // Toit des bâtiments : la zone cliquable inclut aussi les pixels au-dessus.
    }
    return null;
  }

  return {
    TILE,
    cols: WORLD_COLS,
    rows: WORLD_ROWS,
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
    roadY: ROAD_Y,
    mainPathX: MAIN_PATH_X,
    deco,
    garden: { flowers: gardenFlowers, bushes: gardenBushes, fence: gardenFence },
    farmerHome,
    routeToField,
    isPath,
    isForest,
    plotRect,
    plotCenter,
    investmentRect,
    investmentAnchor,
    hitTest,
  };
}
