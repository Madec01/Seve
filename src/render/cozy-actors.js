// Lot 4 « Collection & enjeux doux » dans la scène (docs/ARCHITECTURE.md, « Lot 4 — contrats », « Ce que RENDER et
// UI consomment ») : objets cachés des fêtes (œufs, lampions, grenouilles, lanternes), stand du jour (marmite, étal,
// paniers, foire aux graines), M. le maire et la petite Lili, trouvailles d'hiver en lisière, traces dans la neige,
// mangeoire et oiseau du jour, fenêtre éclairée de la veillée, porte-lanternes du perron, badge « vous attend » des
// parcelles mûres (carrière, F1), touffe arrachée du désherbage, prime « à la main » en vert.
//
// cozySpots(layout) → { hideSpots: [{ x, y, w, h }] (≥ 16), edgeSpots: [{ x, y }] (≥ 8), traceSpots: [{ x, y }] (≥ 8),
//   feeder: rect (16 × 32), lanternRack: rect (32 × 32), storyWindow: rect (16 × 16), feteStall: rect (32 × 32) }
//   (px du monde, pur, déterministe : même résultat pour une même disposition ; testé par tests/lot4-render.test.js).
//   Jamais sur une parcelle ni un chemin. Carrière : bande de la maison et champ de départ.
// cozySpot(u, spots, taken) → index : ⌊u × spots.length⌋, puis la suivante libre (taken : Set d'index).
//
// createCozyActors(effects) → actors
//   setImages(images), setReducedMotion(on)
//   sync(game, layout, { time })   état durable (state.cozy ; requêtes lues au plus 4 fois par seconde)
//   onEvent(type, payload, layout) feteStarted, feteFound, feteDone, feteEnded, winterFind, winterPicked, feederFilled,
//                                  feederBird, storyReady, storyHeard, lanternsLit, weeded, harvested, seedPackBought
//   update(dt)
//   collect(push)                  objets triés par profondeur avec la scène : push(name | null, x, y, sortY, opts)
//   drawOverlay(c)                 au-dessus des objets (badges « vous attend », herbes du désherbage)
//   drawGlow(c, ox, oy, dayProgress, weather)   lueurs du soir (lanternes du perron, fenêtre de la veillée, lampions)
//   hitTest(wx, wy, slop, { feteMode, minWorld })  { type: 'feteItem', index } | { type: 'winterFind', id } |
//                                  { type: 'feeder' } | { type: 'storyWindow' } | { type: 'lanternRack' } |
//                                  { type: 'feteStall' } | null ; en mode fête : seulement feteItem
//   setFeteMode(on), setLanterns(values | null), itemRect(kind, id), spots(), clear(), shift(dx, dy), stats()
//
// Rien n'est dessiné sans state.cozy (Classique) : ni porte-lanternes, ni mangeoire. Un sprite du lot 4 absent (planche
// pas encore chargée) → repli dessiné une fois sur un petit canvas. Mouvements réduits : pas de dandinement (étincelle
// fixe), apparitions en fondu, aucun trajet.

import { TILE, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';
import { varietySpots } from './variety-actors.js';

const OUTLINE = '#3f2631';
const T = TILE;
const CRITERIA = ['variety', 'care', 'neighbours', 'beauty', 'prosperity'];
const CRIT_COLORS = { variety: '#7cc955', care: '#63aff3', neighbours: '#f28fb8', beauty: '#fddc00', prosperity: '#f2a03d' };
const TREEISH = new Set(['tree', 'treeTall', 'pine', 'pineTall', 'bush', 'berry', 'appleTree', 'rocks', 'rocksBig', 'stump', 'log', 'fern']);
const WALK_S = 2.4;
const FADE_S = 0.6;
const INFO_S = 0.25;

// ── Disposition (pure) ─────────────────────────────────────────────────────────────
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tuiles occupées (bâtiments, puits, accessoires, emplacements de décor, parcelles, panneaux, lot 3). */
function occupancy(layout) {
  const set = new Set();
  const decor = new Set();
  const key = (x, y) => `${x},${y}`;
  const mark = (r, into = set) => {
    if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) return;
    const w = r.w || 1;
    const h = r.h || 1;
    for (let y = r.y; y < r.y + h; y++) for (let x = r.x; x < r.x + w; x++) into.add(key(x, y));
  };
  const markPx = (r) => {
    if (!r) return;
    const x0 = Math.floor(r.x / T);
    const y0 = Math.floor(r.y / T);
    const x1 = Math.ceil((r.x + r.w) / T);
    const y1 = Math.ceil((r.y + r.h) / T);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set.add(key(x, y));
  };
  mark(layout.house);
  mark(layout.well);
  for (const p of layout.props || []) mark({ x: p.x, y: p.y, w: 1, h: 1 });
  if (layout.sign && Number.isFinite(layout.sign.x)) mark({ x: layout.sign.x, y: layout.sign.y, w: layout.sign.w || 3, h: 1 });
  for (const d of layout.decorSlots || []) {
    const r = { x: d.tx ?? Math.floor(d.x / T), y: d.ty ?? Math.floor(d.y / T), w: d.tw ?? Math.max(1, Math.round(d.w / T)), h: d.th ?? Math.max(1, Math.round(d.h / T)) };
    mark(r, decor);
  }
  for (const p of layout.plots || []) if (!p.retired) markPx(p);
  const fence = layout.field?.fence;
  if (fence) mark(fence);
  const home = layout.home;
  if (home) {
    for (const k of ['house', 'storage', 'well', 'stand', 'waterTower', 'tractor']) mark(home[k]);
    for (const s of home.solar || []) mark({ x: s.x, y: s.y, w: 1, h: 1 });
  }
  for (const f of layout.fences || []) mark(f.rect || f);
  for (const g of layout.greenhouses || []) mark(g.rect || g);
  for (const p of layout.ponds || []) mark(p.rect || p.water || p);
  const slots = layout.slots || {};
  for (const [id, s] of Object.entries(slots)) {
    if (!s) continue;
    if (layout.career) {
      mark(s.building);
      mark(s.pen);
    } else if (typeof layout.slotTiles === 'function') {
      let t = null;
      try {
        t = layout.slotTiles(id, 99);
      } catch {
        t = null;
      }
      mark(t);
    }
    if (s.sign && Number.isFinite(s.sign.x)) mark({ x: s.sign.x, y: s.sign.y, w: 1, h: 1 });
  }
  for (const h of layout.hives || []) mark({ x: h.x, y: h.y, w: 1, h: 1 });
  // (Vallée vivante) Emplacements nature et boîte en fer (seulement quand la Vallée existe : les autres fermes gardent
  // leurs cachettes).
  if (layout.valley?.reserved) {
    for (const r of Object.values(layout.valley.spots || {})) markPx(r);
    markPx(layout.valley.box);
    markPx(layout.valley.library); // (V2) la Grainothèque
  }
  // Lot 3 : panneau du village, charrette et caisses, roulotte (repères calculés par variety-actors.js).
  try {
    const v = varietySpots(layout);
    markPx(v.board);
  } catch {
    /* disposition incomplète (tests) */
  }
  return { set, decor, key };
}

/** Bornes (tuiles) où chercher les repères : partie essentielle, au-dessus de la route ; carrière : maison + champ de départ. */
function bounds(layout) {
  const ess = layout.essential || { x: 0, y: 0, w: layout.width || 14 * T, h: layout.height || 20 * T };
  const x0 = Math.round(ess.x / T);
  const x1 = Math.round((ess.x + ess.w) / T) - 1;
  const roadY = layout.home?.roadY ?? layout.roadY ?? Math.floor((layout.height || 20 * T) / T) - 4;
  let y0 = 2;
  if (layout.career) {
    const f = layout.fieldRect || { y: (roadY - 20) * T };
    y0 = Math.max(0, Math.floor(f.y / T) - 1);
  }
  return { x0: Math.max(0, x0), x1, y0, y1: roadY - 1 };
}

/**
 * Repères du lot 4 (px du monde). Les mêmes pour une disposition donnée.
 * @param layout disposition de src/render/layout*.js (niveaux paysage / portrait, carrière)
 */
export function cozySpots(layout) {
  const occ = occupancy(layout);
  const B = bounds(layout);
  const isPath = (x, y) => (typeof layout.isPath === 'function' ? !!layout.isPath(x, y, true) : false);
  const isForest = (x, y) => (typeof layout.isForest === 'function' ? !!layout.isForest(x, y) : false);
  const inB = (x, y) => x >= B.x0 && x <= B.x1 && y >= B.y0 && y <= B.y1;
  const free = (x, y) => inB(x, y) && !occ.set.has(occ.key(x, y)) && !occ.decor.has(occ.key(x, y)) && !isPath(x, y) && !isForest(x, y);

  // ── Cachettes (pieds des buissons et des arbres, coins de clôture, puits, panneau, maison, lisière) ──
  const hides = [];
  const seen = new Set();
  const addHide = (tx, ty, dx = 0, dy = 0, need = true) => {
    const k = `${tx},${ty}`;
    if (seen.has(k) || !inB(tx, ty)) return;
    if (isPath(tx, ty) || occ.set.has(k)) return;
    if (need && (occ.decor.has(k) || isForest(tx, ty))) return;
    seen.add(k);
    hides.push({ x: tx * T + dx, y: ty * T + dy, w: T, h: T, tx, ty });
  };
  for (const d of layout.deco || []) {
    if (!TREEISH.has(d.kind)) continue;
    const tx = d.tx ?? Math.floor(d.x / T);
    const ty = d.ty ?? Math.floor(d.y / T);
    // L'objet dépasse au pied du buisson, un peu sur le côté (le buisson est dans la couche fixe, dessous).
    addHide(tx, ty, hash(tx, ty, 3) < 0.5 ? 5 : -4, 6, false);
  }
  const fence = layout.field?.fence;
  if (fence) {
    addHide(fence.x - 1, fence.y + fence.h - 1, 4, 2);
    addHide(fence.x + fence.w, fence.y + fence.h - 1, -4, 2);
    addHide(fence.x - 1, fence.y, 4, 4);
    addHide(fence.x + fence.w, fence.y, -4, 4);
  }
  const well = layout.well || layout.home?.well;
  if (well) {
    addHide(well.x + 1, well.y + (well.h || 1) - 1, -5, 4);
    addHide(well.x - 1, well.y + (well.h || 1) - 1, 5, 4);
  }
  if (layout.sign && Number.isFinite(layout.sign.x)) {
    addHide(layout.sign.x - 1, layout.sign.y, 6, 2);
    addHide(layout.sign.x + (layout.sign.w || 3), layout.sign.y, -6, 2);
  }
  const house = layout.house || layout.home?.house;
  if (house) {
    addHide(house.x + house.w, house.y + 1, -6, 2);
    addHide(house.x + house.w, house.y + house.h - 1, -6, 4);
  }
  // Bord de forêt : tuiles libres voisines de la forêt.
  for (let y = B.y0; y <= B.y1; y++) {
    for (let x = B.x0; x <= B.x1; x++) {
      if (!free(x, y)) continue;
      if (isForest(x, y - 1) || isForest(x - 1, y) || isForest(x + 1, y)) {
        if (hash(x, y, 11) < 0.34) addHide(x, y, 0, 3);
      }
    }
  }
  // Pas assez de cachettes : tuiles libres, dans un ordre fixe (mélange déterministe).
  if (hides.length < 16) {
    const rest = [];
    for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) if (free(x, y) && !seen.has(`${x},${y}`)) rest.push([x, y, hash(x, y, 17)]);
    rest.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of rest) {
      if (hides.length >= 16) break;
      addHide(x, y, 0, 3);
    }
  }
  hides.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  const hideSpots = hides.map(({ x, y, w, h }) => ({ x, y, w, h }));

  // ── Lisière (trouvailles d'hiver) : tuiles libres voisines de la forêt, rangée du haut, bords ──
  const edges = [];
  const eSeen = new Set();
  const addEdge = (x, y) => {
    const k = `${x},${y}`;
    if (eSeen.has(k) || !free(x, y)) return;
    eSeen.add(k);
    edges.push({ x: x * T, y: y * T, tx: x, ty: y });
  };
  for (let y = B.y0; y <= B.y1; y++) {
    for (let x = B.x0; x <= B.x1; x++) {
      if (!free(x, y)) continue;
      const nearForest = isForest(x, y - 1) || isForest(x - 1, y) || isForest(x + 1, y) || isForest(x, y + 1);
      if (nearForest || x === B.x0 || x === B.x1) addEdge(x, y);
    }
  }
  if (edges.length < 8) {
    const rest = [];
    for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) if (free(x, y) && !eSeen.has(`${x},${y}`)) rest.push([x, y, hash(x, y, 23)]);
    rest.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of rest) {
      if (edges.length >= 8) break;
      addEdge(x, y);
    }
  }
  // Une sur deux au plus près l'une de l'autre : les trouvailles restent lisibles.
  edges.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  let edgeSpots = edges.filter((e, i) => i % 2 === 0 || edges.length < 16).map(({ x, y }) => ({ x, y }));
  if (edgeSpots.length < 8) edgeSpots = edges.map(({ x, y }) => ({ x, y }));

  // ── Traces dans la neige : en plein champ libre ──
  const traces = [];
  for (let y = B.y0; y <= B.y1; y++) for (let x = B.x0; x <= B.x1; x++) if (free(x, y) && !eSeen.has(`${x},${y}`)) traces.push([x, y, hash(x, y, 29)]);
  traces.sort((a, b) => a[2] - b[2]);
  let traceSpots = traces.slice(0, 12).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([x, y]) => ({ x: x * T, y: y * T }));
  if (traceSpots.length < 8) traceSpots = traceSpots.concat(edgeSpots.slice(0, 8 - traceSpots.length));

  // ── Mangeoire (16 × 32) : près de la maison, deux tuiles libres l'une sur l'autre ──
  const hx = house ? house.x + house.w / 2 : (B.x0 + B.x1) / 2;
  const hy = house ? house.y + house.h : B.y1;
  let feeder = null;
  let best = Infinity;
  for (let y = B.y0 + 1; y <= B.y1; y++) {
    for (let x = B.x0; x <= B.x1; x++) {
      if (!free(x, y) || !free(x, y - 1)) continue;
      if (hides.some((s) => s.tx === x && (s.ty === y || s.ty === y - 1))) continue;
      const d = Math.abs(x + 0.5 - hx) * 1.2 + Math.abs(y - hy) + (x < hx ? 0.4 : 0);
      if (d < best) {
        best = d;
        feeder = { x: x * T, y: (y - 1) * T, w: T, h: 2 * T };
      }
    }
  }
  if (!feeder) feeder = { x: (B.x0 + 1) * T, y: (B.y1 - 2) * T, w: T, h: 2 * T };

  // ── Porte-lanternes (32 × 32) : sur le perron (contre la façade), sans couvrir la porte ni un chemin ──
  let lanternRack = null;
  if (house) {
    const door = house.door || { x: house.x + Math.floor(house.w / 2), y: house.y + house.h - 1 };
    const porch = house.y + house.h;
    let bestR = Infinity;
    for (let by = porch; by <= Math.min(B.y1, porch + 2); by++) {
      for (let bx = B.x0; bx <= B.x1 - 1; bx++) {
        let score = Math.abs(bx + 1 - (house.x + 1)) + (by - porch) * 3;
        let ok = true;
        for (let dy = -1; dy <= 0 && ok; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const x = bx + dx;
            const y = by + dy;
            const k = `${x},${y}`;
            if (isPath(x, y) || (x === door.x && y >= door.y)) ok = false;
            else if (dy === 0 && (occ.set.has(k) || isForest(x, y))) ok = false;
            else if (dy === -1 && occ.set.has(k)) {
              const onHouse = x >= house.x && x < house.x + house.w && y >= house.y && y < house.y + house.h;
              if (!onHouse) score += 6;
            } else if (occ.decor.has(k)) score += dy === 0 ? 4 : 1;
          }
        }
        if (ok && score < bestR) {
          bestR = score;
          lanternRack = { x: bx * T, y: (by - 1) * T, w: 2 * T, h: 2 * T };
        }
      }
    }
  }
  if (!lanternRack) lanternRack = { x: feeder.x + T, y: feeder.y, w: 2 * T, h: 2 * T };

  // ── Fenêtre de la veillée : sur la maison, pas dans la colonne de la porte ──
  let storyWindow = { x: (B.x0 + 1) * T, y: (B.y1 - 3) * T, w: T, h: T };
  if (house) {
    const doorX = house.door?.x ?? -1;
    const wx = house.x + house.w - 1 !== doorX ? house.x + house.w - 1 : house.x;
    storyWindow = { x: wx * T, y: (house.y + Math.max(0, house.h - 2)) * T, w: T, h: T };
  }

  // ── Stand des fêtes (32 × 32) : près du panneau du village ──
  let feteStall = null;
  try {
    const v = varietySpots(layout);
    const bx = Math.round(v.board.x / T);
    const by = Math.round(v.board.y / T);
    const cands = [[bx + 2, by], [bx + 3, by], [bx - 2, by], [bx - 3, by], [bx + 2, by + 1], [bx - 2, by + 1], [bx, by + 2], [bx + 2, by - 2]];
    // Comme le panneau du village : la ligne du haut peut chevaucher la clôture du bas du champ.
    const fz = layout.field?.fence;
    const onBoard = (x, y) => x >= bx && x < bx + Math.round(v.board.w / T) && y >= by && y < by + Math.round(v.board.h / T);
    const onFenceBottom = (x, y) => !!fz && y === fz.y + fz.h - 1 && x >= fz.x && x < fz.x + fz.w && !isPath(x, y) && !occ.decor.has(`${x},${y}`) && !onBoard(x, y);
    const top = (x, y) => free(x, y) || onFenceBottom(x, y);
    const box = (x, y) => top(x, y) && top(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1);
    for (const [x, y] of cands) {
      if (box(x, y)) {
        feteStall = { x: x * T, y: y * T, w: 2 * T, h: 2 * T };
        break;
      }
    }
    if (!feteStall) {
      // Plus loin : le carré 2 × 2 libre le plus proche du panneau.
      let bd = Infinity;
      for (let y = Math.max(B.y0, by - 6); y <= Math.min(B.y1 - 1, by + 6); y++) {
        for (let x = B.x0; x <= B.x1 - 1; x++) {
          if (!box(x, y)) continue;
          const d = Math.abs(x - bx) + Math.abs(y - by) * 1.3;
          if (d < bd) {
            bd = d;
            feteStall = { x: x * T, y: y * T, w: 2 * T, h: 2 * T };
          }
        }
      }
    }
    if (!feteStall) feteStall = { x: v.fair.x, y: v.fair.y - T, w: 2 * T, h: 2 * T };
  } catch {
    feteStall = { x: (B.x0 + 2) * T, y: (B.y1 - 2) * T, w: 2 * T, h: 2 * T };
  }
  return { hideSpots, edgeSpots, traceSpots, feeder, lanternRack, storyWindow, feteStall };
}

/** Cachette d'un objet : ⌊u × n⌋, puis la suivante libre (même résultat pour une même disposition). */
export function cozySpot(u, spots, taken = new Set()) {
  const n = Array.isArray(spots) ? spots.length : Number(spots) || 0;
  if (n <= 0) return -1;
  const v = Number.isFinite(u) ? Math.min(0.999999, Math.max(0, u)) : 0;
  const start = Math.floor(v * n);
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (!taken.has(i)) return i;
  }
  return start;
}

/** Index des cachettes de tous les objets (dans l'ordre de leurs index : positions stables). */
export function placeItems(items, spots) {
  const taken = new Set();
  const out = [];
  for (const it of items || []) {
    const i = cozySpot(it.u, spots, taken);
    taken.add(i);
    out.push(i);
  }
  return out;
}

/** Aubes depuis la maturité → la parcelle attend-elle le joueur ? (F1 : badge « vous attend »). */
export function waitingPlots(state) {
  const out = [];
  if (!state?.cozy?.parts?.helpers) return out;
  (state.plots || []).forEach((p, i) => {
    if (p && Number.isFinite(p.ripeAt) && p.cropId) out.push(i);
  });
  return out;
}

// ── Replis dessinés (une fois, sur de petits canvas) ─────────────────────────────────
function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  return c;
}
function R(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}
function pix(g, map, colors, ox = 0, oy = 0) {
  map.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      if (ch !== '.' && colors[ch]) R(g, ox + x, oy + y, 1, 1, colors[ch]);
    }
  });
}

const EGG = ['......OO......', '.....OAAO.....', '....OAAAAO....', '...OABBBBAO...', '...OAAAAAAO...', '..OABBBBBBAO..', '..OAAAAAAAAO..', '..OAAAAAAAAO..', '...OAAAAAAO...', '....OOOOOO....'];
const EGG_COLORS = [
  { A: '#f6a5c0', B: '#e2668f' },
  { A: '#9fd2f5', B: '#3b8fd0' },
  { A: '#fde58a', B: '#e2a524' },
  { A: '#a8e38d', B: '#4f9a45' },
];
const FIND_COLORS = {
  deadwood: ['#8a5a2b', '#b8794a'],
  pinecone: ['#7a4a26', '#a3703a'],
  holly: ['#2e6b34', '#d43d3d'],
  chestnut: ['#6d3f1f', '#c58747'],
  blewit: ['#7d5fb5', '#c3b0e8'],
  mistletoe: ['#5f9e4a', '#f6f3e8'],
};
const BIRD_COLORS = {
  greatTit: ['#f2d34a', '#2a2a2a'], blueTit: ['#f2d34a', '#3b8fd0'], robin: ['#a3703a', '#e2663b'], sparrow: ['#a3703a', '#6d4b27'],
  chaffinch: ['#c98a6a', '#5a7fa8'], bullfinch: ['#e86a7a', '#2a2a2a'], nuthatch: ['#7fa1c0', '#e2a56c'], woodpecker: ['#2a2a2a', '#d43d3d'],
};

const FALLBACK = {
  egg: (i, gold) =>
    makeCanvas(16, 16, (g) => {
      const c = gold ? { O: OUTLINE, A: '#ffd23a', B: '#fff3b0' } : { O: OUTLINE, ...EGG_COLORS[i % 4] };
      pix(g, EGG, c, 1, 5);
      if (gold) R(g, 6, 7, 1, 1, '#ffffff');
    }),
  lampion: (lit, kind) =>
    makeCanvas(16, 16, (g) => {
      R(g, 7, 0, 2, 3, OUTLINE);
      const body = kind === 'lantern' ? (lit ? '#ffe28a' : '#8d99a6') : lit ? '#ff8a5a' : '#c0503f';
      R(g, 3, 3, 10, 10, OUTLINE);
      R(g, 4, 4, 8, 8, body);
      R(g, 4, 6, 8, 1, kind === 'lantern' ? '#5a6470' : '#8a2f26');
      R(g, 4, 9, 8, 1, kind === 'lantern' ? '#5a6470' : '#8a2f26');
      if (lit) R(g, 6, 7, 4, 2, '#fff3b0');
      R(g, 6, 13, 4, 2, OUTLINE);
    }),
  frog: (jump) =>
    makeCanvas(16, 16, (g) => {
      const y = jump ? 4 : 7;
      R(g, 3, y, 10, 6, OUTLINE);
      R(g, 4, y + 1, 8, 4, '#5fb43f');
      R(g, 4, y - 1, 3, 3, OUTLINE);
      R(g, 9, y - 1, 3, 3, OUTLINE);
      R(g, 5, y, 1, 1, '#ffffff');
      R(g, 10, y, 1, 1, '#ffffff');
      R(g, 2, y + 5, 3, 2, OUTLINE);
      R(g, 11, y + 5, 3, 2, OUTLINE);
    }),
  find: (kind) =>
    makeCanvas(16, 16, (g) => {
      const [a, b] = FIND_COLORS[kind] || ['#8a5a2b', '#c58747'];
      R(g, 2, 12, 12, 2, 'rgba(120,140,190,0.35)');
      if (kind === 'deadwood') {
        R(g, 2, 8, 12, 5, OUTLINE);
        R(g, 3, 9, 10, 1, b);
        R(g, 3, 11, 10, 1, a);
      } else if (kind === 'holly' || kind === 'mistletoe') {
        R(g, 3, 5, 10, 7, OUTLINE);
        R(g, 4, 6, 8, 5, a);
        R(g, 6, 7, 2, 2, b);
        R(g, 9, 8, 2, 2, b);
      } else if (kind === 'blewit') {
        R(g, 3, 5, 10, 4, OUTLINE);
        R(g, 4, 6, 8, 2, a);
        R(g, 7, 9, 2, 4, OUTLINE);
        R(g, 7, 9, 1, 3, b);
      } else {
        R(g, 4, 6, 8, 7, OUTLINE);
        R(g, 5, 7, 6, 5, a);
        R(g, 6, 8, 2, 2, b);
      }
    }),
  track: (kind) =>
    makeCanvas(16, 16, (g) => {
      const c = 'rgba(96,112,150,0.55)';
      if (kind === 'deer') {
        for (const [x, y] of [[4, 2], [9, 6], [4, 10]]) {
          R(g, x, y, 1, 3, c);
          R(g, x + 2, y, 1, 3, c);
        }
      } else if (kind === 'fox') {
        for (const y of [1, 5, 9, 13]) R(g, 7, y, 2, 2, c);
      } else {
        R(g, 3, 2, 2, 4, c);
        R(g, 8, 2, 2, 4, c);
        R(g, 5, 9, 2, 2, c);
        R(g, 6, 12, 2, 2, c);
      }
    }),
  bird: (id, peck) =>
    makeCanvas(16, 16, (g) => {
      const [body, head] = BIRD_COLORS[id] || ['#a3703a', '#6d4b27'];
      R(g, 4, 7, 8, 5, OUTLINE);
      R(g, 5, 8, 6, 3, body);
      const hy = peck ? 7 : 4;
      R(g, 9, hy, 5, 4, OUTLINE);
      R(g, 10, hy + 1, 3, 2, head);
      R(g, 14, hy + 2, 1, 1, '#e2a524');
      R(g, 2, 8, 3, 2, OUTLINE);
      R(g, 6, 12, 1, 2, OUTLINE);
      R(g, 9, 12, 1, 2, OUTLINE);
    }),
  feeder: (full) =>
    makeCanvas(16, 32, (g) => {
      R(g, 7, 14, 2, 18, OUTLINE);
      R(g, 7, 14, 1, 17, '#8a5a2b');
      R(g, 1, 4, 14, 4, OUTLINE);
      R(g, 2, 5, 12, 2, '#c0503f');
      R(g, 1, 4, 14, 1, '#f6f8ff');
      R(g, 2, 8, 12, 6, OUTLINE);
      R(g, 3, 9, 10, 4, '#b8794a');
      if (full) {
        R(g, 3, 9, 10, 2, '#e2c27a');
        R(g, 5, 9, 1, 1, '#a3703a');
        R(g, 9, 10, 1, 1, '#a3703a');
      }
    }),
  window: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 3, 3, 10, 10, OUTLINE);
      R(g, 4, 4, 8, 8, '#ffcf6a');
      R(g, 4, 4, 8, 2, '#fff3b0');
      R(g, 7, 4, 2, 8, '#a3703a');
      R(g, 4, 7, 8, 1, '#a3703a');
    }),
  rack: () =>
    makeCanvas(32, 32, (g) => {
      R(g, 1, 3, 30, 3, OUTLINE);
      R(g, 2, 4, 28, 1, '#b8794a');
      for (let c = 0; c < 5; c++) {
        const x = 3 + c * 6;
        R(g, x, 6, 1, 23, '#6d4b27');
      }
      R(g, 0, 28, 32, 3, OUTLINE);
      R(g, 1, 29, 30, 1, '#8a5a2b');
    }),
  lantern: (crit, on) =>
    makeCanvas(8, 8, (g) => {
      R(g, 3, 0, 2, 1, OUTLINE);
      R(g, 1, 1, 6, 6, OUTLINE);
      R(g, 2, 2, 4, 4, on ? CRIT_COLORS[crit] || '#fddc00' : '#5a5560');
      if (on) R(g, 3, 3, 2, 2, '#fff8d8');
      R(g, 3, 7, 2, 1, OUTLINE);
    }),
  pot: (frame) =>
    makeCanvas(32, 32, (g) => {
      R(g, 4, 26, 4, 5, OUTLINE);
      R(g, 24, 26, 4, 5, OUTLINE);
      R(g, 10, 28, 12, 3, '#e2663b');
      R(g, 12, 27, 8, 2, '#ffb600');
      R(g, 5, 14, 22, 13, OUTLINE);
      R(g, 6, 15, 20, 11, '#3a3440');
      R(g, 6, 15, 20, 2, '#d9a066');
      if (frame) {
        R(g, 10, 6, 2, 6, 'rgba(255,255,255,0.7)');
        R(g, 17, 3, 2, 8, 'rgba(255,255,255,0.6)');
      } else {
        R(g, 13, 8, 2, 5, 'rgba(255,255,255,0.6)');
        R(g, 20, 6, 2, 6, 'rgba(255,255,255,0.5)');
      }
    }),
  stand: () =>
    makeCanvas(32, 32, (g) => {
      R(g, 2, 2, 28, 8, OUTLINE);
      for (let x = 3; x < 29; x += 4) {
        R(g, x, 3, 2, 6, '#5fb43f');
        R(g, x + 2, 3, 2, 6, '#f6f3e8');
      }
      R(g, 3, 10, 2, 20, OUTLINE);
      R(g, 27, 10, 2, 20, OUTLINE);
      R(g, 2, 20, 28, 8, OUTLINE);
      R(g, 3, 21, 26, 6, '#c58747');
      for (let k = 0; k < 5; k++) R(g, 4 + k * 5, 18, 4, 3, '#8a5a2b');
    }),
  basket: (full) =>
    makeCanvas(16, 16, (g) => {
      R(g, 3, 4, 10, 2, OUTLINE);
      R(g, 2, 7, 12, 7, OUTLINE);
      R(g, 3, 8, 10, 5, '#d9a066');
      R(g, 3, 10, 10, 1, '#a3703a');
      R(g, 7, 6, 2, 2, '#d43d3d');
      if (full) {
        R(g, 4, 5, 3, 3, '#e2663b');
        R(g, 8, 4, 3, 3, '#7cc955');
      }
    }),
  seedstall: () =>
    makeCanvas(32, 32, (g) => {
      R(g, 2, 4, 28, 2, OUTLINE);
      for (let k = 0; k < 5; k++) {
        R(g, 4 + k * 5, 6, 4, 6, OUTLINE);
        R(g, 5 + k * 5, 7, 2, 4, '#d9b27a');
      }
      R(g, 3, 6, 2, 24, OUTLINE);
      R(g, 27, 6, 2, 24, OUTLINE);
      R(g, 2, 20, 28, 8, OUTLINE);
      R(g, 3, 21, 26, 6, '#a3703a');
      R(g, 8, 14, 16, 6, OUTLINE);
      R(g, 9, 15, 14, 4, '#3a3440');
    }),
  npc: (who, walk) =>
    makeCanvas(16, 16, (g) => {
      const mayor = who === 'mayor';
      R(g, 5, 1, 6, 6, OUTLINE);
      R(g, 6, 2, 4, 4, '#f5c08a');
      if (!mayor) {
        R(g, 3, 2, 2, 4, '#c58747');
        R(g, 11, 2, 2, 4, '#c58747');
      } else R(g, 5, 1, 6, 2, '#6d6d6d');
      R(g, 4, 7, 8, 6, OUTLINE);
      R(g, 5, 8, 6, 4, mayor ? '#3b4a6b' : '#e2668f');
      if (mayor) {
        R(g, 5, 9, 2, 3, '#3b6891');
        R(g, 7, 9, 2, 3, '#f6f3e8');
        R(g, 9, 9, 2, 3, '#d43d3d');
      } else R(g, 11, 9, 4, 3, '#d9a066');
      R(g, 5 + (walk ? 1 : 0), 13, 2, 3, OUTLINE);
      R(g, 9 - (walk ? 1 : 0), 13, 2, 3, OUTLINE);
    }),
  badge: () =>
    makeCanvas(8, 8, (g) => {
      pix(g, ['.OO.OO..', 'OGGOGGO.', 'OGLGGGO.', 'OGGGGGO.', '.OGGGO..', '..OGO...', '...O....'], { O: OUTLINE, G: '#5fb43f', L: '#c8f0a8' });
    }),
  weeds: (gone) =>
    makeCanvas(16, 16, (g) => {
      const y = gone ? 2 : 6;
      R(g, 5, y + 2, 1, 6, '#4f9a45');
      R(g, 7, y, 1, 8, '#5fb43f');
      R(g, 9, y + 1, 1, 7, '#4f9a45');
      R(g, 11, y + 3, 1, 5, '#86cf62');
      if (!gone) R(g, 4, 13, 9, 1, '#6d4b27');
    }),
};

// ── Acteurs ────────────────────────────────────────────────────────────────────────
export function createCozyActors(effects) {
  let images = null;
  let reduced = false;
  let time = 0;
  let enabled = false;
  let lastLayout = null;
  let sp = null; // repères (cozySpots)
  let infoT = -1;
  let feteMode = false;
  let levelLanterns = null; // niveaux : meilleur résultat du niveau (scene.setLanterns)
  const info = {
    career: false, season: 'spring', parts: {}, fete: null, items: [], itemSpots: [], kind: 'egg',
    winter: null, finds: [], findSpots: [], traces: [], traceSpots: [], feeder: false, feederFull: false, bird: null,
    story: false, rack: null, waiting: [], stall: null,
  };
  const jumps = new Map(); // index → âge (s) de l'objet trouvé qui saute
  const picks = new Map(); // id de trouvaille → { kind, x, y, t }
  const weedsFx = []; // { x, y, t }
  const seeds = { t: -1 }; // graines qui tombent de la mangeoire
  const walker = { who: null, t: 0, mode: 'gone', x0: 0, x1: 0, y: 0, stay: 0, alpha: 1 };
  const cache = new Map();
  let drawn = 0;
  let birdSing = 0;
  let lastFindSparkle = 0;

  const has = (name) => canDraw(images, name);
  function fallback(key, ...args) {
    const k = `${key}|${args.join(',')}`;
    if (!cache.has(k)) cache.set(k, FALLBACK[key](...args));
    return cache.get(k);
  }
  function safe(fn, d = null) {
    try {
      const v = fn();
      return v === undefined ? d : v;
    } catch {
      return d;
    }
  }

  function ensureSpots(layout) {
    if (layout !== lastLayout || !sp) {
      lastLayout = layout;
      sp = cozySpots(layout);
      layout.cozy = { hideSpots: sp.hideSpots, edgeSpots: sp.edgeSpots, traceSpots: sp.traceSpots, feeder: sp.feeder, lanternRack: sp.lanternRack, storyWindow: sp.storyWindow, feteStall: sp.feteStall };
      relayItems();
    }
  }

  function relayItems() {
    if (!sp) return;
    info.itemSpots = placeItems(info.items, sp.hideSpots);
    info.findSpots = placeItems(info.finds, sp.edgeSpots);
    info.traceSpots = placeItems(info.traces, sp.traceSpots);
  }

  function readInfo(game) {
    const st = game.state;
    const cz = st.cozy;
    info.career = game.mode === 'career' || st.mode === 'career';
    info.parts = cz.parts || {};
    info.season = safe(() => game.query.calendar().seasonId, 'spring');
    const fete = typeof game.query.fete === 'function' ? safe(() => game.query.fete(), null) : null;
    info.fete = fete;
    const hid = fete?.hidden;
    const items = hid?.items || (cz.fete?.hidden || []).map((h, index) => ({ index, u: h.u, gold: !!h.gold, found: h.found || null }));
    info.kind = hid?.kind || (fete?.engine === 'chasse' || cz.fete?.engine === 'chasse' ? 'egg' : 'egg');
    const sig = items.map((x) => `${x.u}`).join('|');
    if (sig !== info.itemSig) {
      info.itemSig = sig;
      info.items = items.map((x, i) => ({ index: x.index ?? i, u: x.u, gold: !!x.gold, found: x.found || null }));
      if (sp) info.itemSpots = placeItems(info.items, sp.hideSpots);
    } else {
      for (const x of items) {
        const it = info.items.find((y) => y.index === (x.index ?? -1));
        if (it) it.found = x.found || null;
      }
    }
    const engine = fete?.engine || cz.fete?.engine || null;
    info.stall = engine && engine !== 'chasse' && !(fete?.themeId || cz.fete?.themeId) ? engine : null;
    const w = typeof game.query.winter === 'function' ? safe(() => game.query.winter(), null) : null;
    info.winter = w;
    const finds = w?.finds || (cz.winter?.finds || []).map((f) => ({ id: f.id, kind: f.kind, u: f.u }));
    const fsig = finds.map((f) => `${f.id}:${f.u}`).join('|');
    if (fsig !== info.findSig) {
      info.findSig = fsig;
      info.finds = finds.map((f) => ({ id: f.id, kind: f.kind, u: f.u }));
      if (sp) info.findSpots = placeItems(info.finds, sp.edgeSpots);
    }
    const traces = w?.traces || cz.winter?.traces || [];
    const tsig = traces.map((t) => `${t.kind}:${t.u}`).join('|');
    if (tsig !== info.traceSig) {
      info.traceSig = tsig;
      info.traces = traces.map((t) => ({ kind: t.kind, u: t.u, icon: t.icon || null }));
      if (sp) info.traceSpots = placeItems(info.traces, sp.traceSpots);
    }
    const fd = w?.feeder;
    info.feeder = fd ? !!fd.here : info.parts.winter !== false && info.season === 'winter' && !!cz.winter;
    info.feederFull = fd ? !!fd.filledToday : false;
    info.bird = fd?.bird?.id || cz.winter?.feeder?.bird?.id || null;
    info.story = !!w?.story?.available && !w?.story?.heard;
    // Porte-lanternes : carrière → l'année passée ; niveaux → meilleur résultat du niveau (donné par l'interface).
    if (info.career) {
      const hist = cz.lanterns?.history || [];
      info.rack = hist.length ? hist[hist.length - 1].values : null;
    } else info.rack = levelLanterns;
    info.waiting = info.career ? waitingPlots(st) : [];
  }

  // ── État durable ──────────────────────────────────────────────────────────────
  function sync(game, layout, opts = {}) {
    if (opts.time !== undefined) time = opts.time;
    enabled = !!game?.state?.cozy;
    if (!enabled) {
      if (sp) clear();
      return;
    }
    ensureSpots(layout);
    if (infoT >= 0 && time - infoT < INFO_S) return;
    infoT = time;
    readInfo(game);
  }

  // ── Événements ────────────────────────────────────────────────────────────────
  function plotTop(layout, i) {
    const r = Number.isInteger(i) ? safe(() => layout.plotRect(i), null) : null;
    return r ? { x: r.x + r.w / 2, y: r.y + 2, r } : null;
  }

  function itemRect(kind, id) {
    if (!sp) return null;
    if (kind === 'feteItem') {
      const k = info.items.findIndex((x) => x.index === id);
      const s = k >= 0 ? sp.hideSpots[info.itemSpots[k]] : null;
      return s ? { x: s.x, y: s.y, w: s.w, h: s.h } : null;
    }
    if (kind === 'winterFind') {
      const k = info.finds.findIndex((x) => x.id === id);
      const s = k >= 0 ? sp.edgeSpots[info.findSpots[k]] : null;
      return s ? { x: s.x, y: s.y, w: T, h: T } : null;
    }
    if (kind === 'feeder') return { ...sp.feeder };
    if (kind === 'storyWindow') return { ...sp.storyWindow };
    if (kind === 'lanternRack') return { ...sp.lanternRack };
    if (kind === 'feteStall') return { ...sp.feteStall };
    return null;
  }

  function onEvent(type, p = {}, layout) {
    if (!layout) return;
    if (enabled) ensureSpots(layout);
    switch (type) {
      case 'feteStarted':
      case 'feteSoon':
      case 'feteDone':
      case 'seedPackBought':
      case 'winterFind':
      case 'storyReady':
      case 'storyHeard':
      case 'lanternsLit':
        infoT = -1;
        if (type === 'feteDone' && p.engine === 'etal') startWalker('mayor', 6);
        if (type === 'winterFind' && sp && p.finds?.length) {
          const idx = placeItems(p.finds, sp.edgeSpots);
          const r = sp.edgeSpots[idx[idx.length - 1]];
          if (r) effects.sparkle?.({ x: r.x, y: r.y, w: T, h: T }, 6, 'ice', 0.2);
        }
        if (type === 'storyReady' && sp) effects.sparkle?.(sp.storyWindow, 6, 'gold', 0.2);
        if (type === 'lanternsLit' && sp) effects.sparkle?.(sp.lanternRack, 14, 'gold', 0.1);
        break;
      case 'feteFound': {
        const r = itemRect('feteItem', p.index);
        if (r) {
          jumps.set(p.index, 0);
          const cx = r.x + 8;
          const cy = r.y + 8;
          effects.confetti?.({ x: r.x - 4, y: r.y - 4, w: 24, h: 8 }, reduced ? 6 : 14, 0);
          if (p.gold) effects.burst?.(cx, cy, 14, 'gold', 40, 0, 1);
          else effects.sparkle?.(r, 6, 'gold', 0);
          if (p.amount) effects.floatText?.(cx, r.y - 4, `+${p.amount}`, p.gold ? '#ffd23a' : undefined, { pop: true, life: 1.6 });
        }
        const it = info.items.find((x) => x.index === p.index);
        if (it) it.found = 'player';
        infoT = -1;
        break;
      }
      case 'feteEnded':
        infoT = -1;
        if (p.helped?.n > 0) startWalker('lili', 3);
        break;
      case 'winterPicked': {
        const r = itemRect('winterFind', p.id);
        if (r) {
          picks.set(p.id, { kind: p.kind, x: r.x, y: r.y, t: 0 });
          effects.sparkle?.(r, 6, 'gold', 0);
          if (p.amount) effects.floatText?.(r.x + 8, r.y - 4, `+${p.amount}`, undefined, { pop: true, life: 1.5 });
        }
        infoT = -1;
        break;
      }
      case 'feederFilled':
        seeds.t = 0;
        infoT = -1;
        if (sp) effects.sparkle?.({ x: sp.feeder.x, y: sp.feeder.y + 6, w: 16, h: 10 }, 4, 'gold', 0);
        break;
      case 'feederBird':
        infoT = -1;
        if (sp) effects.sparkle?.({ x: sp.feeder.x - 2, y: sp.feeder.y - 6, w: 20, h: 10 }, p.first ? 10 : 4, 'gold', 0.1);
        break;
      case 'weeded': {
        const at = plotTop(layout, p.plotIndex);
        if (at) weedsFx.push({ x: at.r.x + at.r.w / 2 - 8, y: at.r.y + at.r.h / 2 - 10, t: 0 });
        if (weedsFx.length > 12) weedsFx.shift();
        break;
      }
      case 'harvested':
        if (p.handBonus > 0 && (!p.by || p.by === 'player')) {
          const at = plotTop(layout, p.plotIndex);
          if (at) effects.floatText?.(at.x, at.y - 18, `+${p.handBonus} ♥`, '#8ee06a', { icon: false, life: 1.7, delay: 0.18 });
        }
        if (Number.isInteger(p.plotIndex)) {
          const k = info.waiting.indexOf(p.plotIndex);
          if (k >= 0) info.waiting.splice(k, 1);
        }
        break;
      default:
        break;
    }
  }

  function startWalker(who, stay) {
    if (!sp) return;
    const target = who === 'mayor' ? sp.feteStall : sp.lanternRack;
    walker.who = who;
    walker.t = 0;
    walker.stay = stay;
    walker.y = who === 'mayor' ? target.y + target.h - 2 : target.y + target.h + 10;
    walker.x1 = who === 'mayor' ? target.x - 12 : target.x + 24;
    walker.x0 = walker.x1 - 70;
    walker.mode = reduced ? 'fadein' : 'walkin';
    walker.alpha = reduced ? 0 : 1;
  }

  // ── Animation ─────────────────────────────────────────────────────────────────
  function update(dt) {
    time += dt;
    if (!enabled) return;
    for (const [k, v] of jumps) {
      const a = v + dt;
      if (a > 1.2) jumps.delete(k);
      else jumps.set(k, a);
    }
    for (const [k, v] of picks) {
      v.t += dt;
      if (v.t > 0.9) picks.delete(k);
    }
    for (let i = weedsFx.length - 1; i >= 0; i--) {
      weedsFx[i].t += dt;
      if (weedsFx[i].t > 1.4) weedsFx.splice(i, 1);
    }
    if (seeds.t >= 0) {
      seeds.t += dt;
      if (seeds.t > 1.2) seeds.t = -1;
    }
    if (birdSing > 0) birdSing = Math.max(0, birdSing - dt);
    if (walker.mode !== 'gone') {
      walker.t += dt;
      if (walker.mode === 'walkin' && walker.t >= WALK_S) {
        walker.mode = 'stay';
        walker.t = 0;
      } else if (walker.mode === 'fadein') {
        walker.alpha = Math.min(1, walker.t / FADE_S);
        if (walker.alpha >= 1) {
          walker.mode = 'stay';
          walker.t = 0;
        }
      } else if (walker.mode === 'stay' && walker.t >= walker.stay) {
        walker.mode = reduced ? 'fadeout' : 'walkout';
        walker.t = 0;
      } else if (walker.mode === 'walkout' && walker.t >= WALK_S) walker.mode = 'gone';
      else if (walker.mode === 'fadeout') {
        walker.alpha = 1 - Math.min(1, walker.t / FADE_S);
        if (walker.alpha <= 0) walker.mode = 'gone';
      }
    }
    // Étincelle discrète sur les trouvailles d'hiver (toutes les ~3 s, l'une après l'autre).
    if (sp && info.finds.length && time - lastFindSparkle > 3) {
      lastFindSparkle = time;
      const k = Math.floor(time / 3) % info.finds.length;
      const s = sp.edgeSpots[info.findSpots[k]];
      if (s) effects.sparkle?.({ x: s.x + 3, y: s.y + 2, w: 10, h: 8 }, reduced ? 1 : 2, 'ice', 0);
    }
  }

  // ── Dessin (trié avec la scène) ──────────────────────────────────────────────
  function itemSprite(it, k) {
    const kind = info.kind;
    if (kind === 'lampion' || kind === 'lantern') {
      const lit = !!it.found;
      const name = kind === 'lampion' ? (lit ? 'fete.lampion.lit' : 'fete.lampion') : lit ? 'fete.lantern.lit' : 'fete.lantern';
      return { name, fb: () => fallback('lampion', lit ? 1 : 0, kind) };
    }
    if (kind === 'frog') {
      const jump = jumps.has(it.index) || (!reduced && Math.floor(time * 0.25 + k * 0.3) % 4 === 0 && (time * 0.25 + k * 0.3) % 1 < 0.15);
      return { name: jump ? 'fete.frog.1' : 'fete.frog', fb: () => fallback('frog', jump ? 1 : 0) };
    }
    const name = it.gold ? 'fete.egg.gold' : `fete.egg.${it.index % 4}`;
    return { name, fb: () => fallback('egg', it.index % 4, it.gold ? 1 : 0) };
  }

  function collect(push) {
    drawn = 0;
    if (!enabled || !sp) return;
    const P = (name, fb, x, y, sortY, opts = {}) => {
      drawn += 1;
      if (name && has(name)) push(name, Math.round(x), Math.round(y), sortY, opts);
      else if (fb) {
        const img = typeof fb === 'function' ? fb() : fb;
        if (img) push(null, Math.round(x), Math.round(y), sortY, { ...opts, img });
      }
    };
    // Objets cachés des fêtes : ceux qui restent (et, pour les lampions et les lanternes, ceux qu'on a allumés).
    const keepLit = info.kind === 'lampion' || info.kind === 'lantern';
    info.items.forEach((it, k) => {
      const s = sp.hideSpots[info.itemSpots[k]];
      if (!s) return;
      const jumping = jumps.has(it.index);
      if (it.found && !keepLit && !jumping) return;
      if (it.found === 'village' && !keepLit) return;
      const spr = itemSprite(it, k);
      let dx = 0;
      let dy = 0;
      let alpha = 1;
      if (jumping && !keepLit) {
        const a = jumps.get(it.index);
        if (reduced) alpha = Math.max(0, 1 - a / 0.8);
        else {
          dy = -Math.sin(Math.min(1, a / 0.7) * Math.PI) * 14 - Math.max(0, a - 0.7) * 30;
          alpha = Math.max(0, 1 - Math.max(0, a - 0.5) / 0.6);
        }
      } else if (!it.found && !reduced) {
        // Petit dandinement toutes les ~4 s (décalé d'un objet à l'autre).
        const ph = (time + k * 0.53) % 4;
        if (ph < 0.5) dx = Math.sin(ph * 25) > 0 ? 1 : -1;
      }
      P(spr.name, spr.fb, s.x + dx, s.y + dy, s.y + 9 + k * 0.001, { alpha });
    });
    // Stand du jour près du panneau (marmite, étal, paniers, foire aux graines).
    if (info.stall) {
      const r = sp.feteStall;
      const sy = r.y + r.h - 1;
      if (info.stall === 'marmite') {
        const f = !reduced && Math.floor(time * 2) % 2 ? 1 : 0;
        P(f ? 'fete.pot.1' : 'fete.pot', () => fallback('pot', f), r.x, r.y, sy);
      } else if (info.stall === 'etal') P('fete.stand', () => fallback('stand'), r.x, r.y, sy);
      else if (info.stall === 'paniers') {
        const done = !!info.fete?.done;
        for (let k = 0; k < 3; k++) P(done ? 'fete.basket.full' : 'fete.basket', () => fallback('basket', done ? 1 : 0), r.x + k * 9 - 2, r.y + 14 + (k % 2) * 2, sy + k * 0.01);
      } else if (info.stall === 'foire') P('fete.seedstall', () => fallback('seedstall'), r.x, r.y, sy);
    }
    // Trouvailles d'hiver en lisière, et celles qu'on vient de ramasser (petit saut).
    info.finds.forEach((f, k) => {
      const s = sp.edgeSpots[info.findSpots[k]];
      if (!s || picks.has(f.id)) return;
      P(`winter.${f.kind}`, () => fallback('find', f.kind), s.x, s.y, s.y + 8 + k * 0.001);
    });
    for (const [, v] of picks) {
      const a = v.t;
      const dy = reduced ? 0 : -Math.sin(Math.min(1, a / 0.6) * Math.PI) * 12;
      P(`winter.${v.kind}`, () => fallback('find', v.kind), v.x, v.y + dy, v.y + 9, { alpha: Math.max(0, 1 - a / 0.9) });
    }
    // Mangeoire et oiseau du jour.
    if (info.feeder) {
      const f = sp.feeder;
      const full = info.feederFull || seeds.t >= 0;
      P(full ? 'feeder.full' : 'feeder', () => fallback('feeder', full ? 1 : 0), f.x, f.y, f.y + f.h - 1);
      if (info.bird) {
        const peck = !reduced && (Math.floor(time * 1.6) % 3 === 0 || birdSing > 0) ? 1 : 0;
        const hop = birdSing > 0 && !reduced ? -Math.abs(Math.sin(time * 14)) * 2 : 0;
        P(peck ? `bird.${info.bird}.1` : `bird.${info.bird}`, () => fallback('bird', info.bird, peck), f.x + 1, f.y - 6 + hop, f.y + f.h - 0.5);
      }
    }
    // Porte-lanternes (niveaux : meilleur résultat ; carrière : l'année passée) : dès les premières lanternes.
    if (info.rack) {
      const r = sp.lanternRack;
      const sy = r.y + r.h - 1;
      P('lantern.rack', () => fallback('rack'), r.x, r.y, sy);
      const vals = info.rack || [0, 0, 0, 0, 0];
      CRITERIA.forEach((crit, c) => {
        for (let row = 0; row < 4; row++) {
          const on = (vals[c] || 0) > 3 - row;
          const name = `lantern.${crit}.${on ? 'on' : 'off'}`;
          P(name, () => fallback('lantern', crit, on ? 1 : 0), r.x + 1 + c * 6, r.y + 3 + row * 7, sy + 0.01 + c * 0.001 + row * 0.0001);
        }
      });
    }
    // Fenêtre éclairée de la veillée.
    if (info.story) {
      const w = sp.storyWindow;
      P('window.lit', () => fallback('window'), w.x, w.y, w.y + T + 40);
    }
    // M. le maire (stand) ou Lili (le soir de la chasse).
    if (walker.mode !== 'gone') {
      let x = walker.x1;
      let walking = false;
      if (walker.mode === 'walkin') {
        const k = Math.min(1, walker.t / WALK_S);
        x = walker.x0 + (walker.x1 - walker.x0) * (1 - (1 - k) ** 2);
        walking = true;
      } else if (walker.mode === 'walkout') {
        const k = Math.min(1, walker.t / WALK_S);
        x = walker.x1 + 80 * k * k;
        walking = true;
      }
      const base = walker.who === 'mayor' ? 'npc.mayor' : 'npc.lili';
      const step = walking && Math.floor(time * 6) % 2 ? 1 : 0;
      const alpha = walker.mode === 'fadein' || walker.mode === 'fadeout' ? walker.alpha : walker.mode === 'walkout' ? Math.max(0, 1 - walker.t / WALK_S) : 1;
      P(step ? `${base}.walk` : base, () => fallback('npc', walker.who, step), x, walker.y - 15, walker.y + 1, { alpha });
    }
  }

  // ── Au-dessus des objets ─────────────────────────────────────────────────────
  function drawImg(c, name, fb, x, y, alpha = 1) {
    if (alpha !== 1) c.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (name && has(name)) drawSprite(c, images, name, Math.round(x), Math.round(y));
    else {
      const img = fb ? (typeof fb === 'function' ? fb() : fb) : null;
      if (img) c.drawImage(img, Math.round(x), Math.round(y));
    }
    if (alpha !== 1) c.globalAlpha = 1;
  }

  function drawOverlay(c, layout) {
    if (!enabled || !sp) return;
    // Traces dans la neige (au sol, jusqu'au soir).
    info.traces.forEach((t, k) => {
      const s = sp.traceSpots[info.traceSpots[k]];
      const k0 = String(t.kind || '').replace(/Track$/, '');
      if (s) drawImg(c, t.icon || `track.${k0}`, () => fallback('track', k0), s.x, s.y, 0.9);
    });
    // Badge « vous attend » des parcelles mûres (F1).
    if (info.waiting.length && layout) {
      const bob = reduced ? 0 : Math.sin(time * 2) > 0.7 ? -1 : 0;
      for (const i of info.waiting) {
        const r = safe(() => layout.plotRect(i), null);
        if (!r) continue;
        drawImg(c, 'badge.waiting', () => fallback('badge'), r.x + 1, r.y + 1 + bob);
      }
    }
    // Touffes arrachées par le jardinier.
    for (const w of weedsFx) {
      const gone = w.t > 0.45;
      const dy = gone && !reduced ? -(w.t - 0.45) * 22 : 0;
      drawImg(c, gone ? 'fx.weeds.1' : 'fx.weeds', () => fallback('weeds', gone ? 1 : 0), w.x, w.y + dy, gone ? Math.max(0, 1 - (w.t - 0.45) / 0.95) : 1);
    }
    // Graines qui tombent de la mangeoire.
    if (seeds.t >= 0 && info.feeder) {
      const f = sp.feeder;
      c.fillStyle = '#e2c27a';
      for (let k = 0; k < 6; k++) {
        const t = seeds.t - k * 0.08;
        if (t < 0) continue;
        const y = f.y + 14 + t * t * 40;
        if (y > f.y + f.h + 2) continue;
        c.fillRect(Math.round(f.x + 3 + ((k * 5) % 10)), Math.round(y), 1, 1);
      }
    }
  }

  /** Disque « en escalier » (pas d'anticrénelage). */
  function glowDisc(c, cx, cy, r, color, a) {
    c.globalAlpha = a;
    c.fillStyle = color;
    c.beginPath();
    for (let yy = -r; yy <= r; yy++) {
      const hw = Math.floor(Math.sqrt(r * r - yy * yy));
      c.rect(cx - hw, cy + yy, hw * 2 + 1, 1);
    }
    c.fill();
  }

  function drawGlow(c, ox, oy, dayProgress, weather) {
    if (!enabled || !sp) return;
    const dark = weather === 'storm' ? 0.7 : weather === 'rain' || weather === 'snow' ? 0.4 : 0;
    const k = Math.max(dark, dayProgress > 0.7 ? Math.min(1, (dayProgress - 0.7) / 0.12) : 0);
    if (k <= 0.02) return;
    c.save();
    c.translate(ox, oy);
    c.globalCompositeOperation = 'lighter';
    const flick = reduced ? 1 : 0.88 + 0.12 * Math.sin(time * 7);
    if (info.rack) {
      const r = sp.lanternRack;
      CRITERIA.forEach((crit, col) => {
        for (let row = 0; row < 4; row++) {
          if (!((info.rack[col] || 0) > 3 - row)) continue;
          glowDisc(c, r.x + 1 + col * 6 + 4, r.y + 3 + row * 7 + 4, 4, CRIT_COLORS[crit], 0.16 * k * flick);
        }
      });
    }
    if (info.story) {
      const w = sp.storyWindow;
      glowDisc(c, w.x + 8, w.y + 8, 10, '#ffcf6a', 0.12 * k * flick);
      glowDisc(c, w.x + 8, w.y + 8, 5, '#ffe7a8', 0.16 * k);
    }
    if (info.kind === 'lampion' || info.kind === 'lantern') {
      info.items.forEach((it, i) => {
        if (!it.found) return;
        const s = sp.hideSpots[info.itemSpots[i]];
        if (s) glowDisc(c, s.x + 8, s.y + 8, 8, info.kind === 'lantern' ? '#ffe28a' : '#ff9a6a', 0.14 * k * flick);
      });
    }
    c.globalAlpha = 1;
    c.restore();
  }

  // ── Toucher ───────────────────────────────────────────────────────────────────
  function hitTest(wx, wy, slop = 0, opts = {}) {
    if (!enabled || !sp) return null;
    const minWorld = opts.minWorld || 0;
    const grow = (r) => {
      const ex = Math.max(0, (minWorld - r.w) / 2);
      const ey = Math.max(0, (minWorld - r.h) / 2);
      return { x: r.x - ex, y: r.y - ey, w: r.w + 2 * ex, h: r.h + 2 * ey };
    };
    const within = (r, s) => r && wx >= r.x - s && wy >= r.y - s && wx < r.x + r.w + s && wy < r.y + r.h + s;
    const targets = [];
    info.items.forEach((it, k) => {
      if (it.found) return;
      const s = sp.hideSpots[info.itemSpots[k]];
      if (s) targets.push([grow(s), { type: 'feteItem', index: it.index }]);
    });
    if (!opts.feteMode) {
      info.finds.forEach((f, k) => {
        const s = sp.edgeSpots[info.findSpots[k]];
        if (s && !picks.has(f.id)) targets.push([grow({ x: s.x, y: s.y, w: T, h: T }), { type: 'winterFind', id: f.id }]);
      });
      if (info.feeder) targets.push([grow({ x: sp.feeder.x - 2, y: sp.feeder.y - 6, w: 20, h: sp.feeder.h + 6 }), { type: 'feeder' }]);
      if (info.story) targets.push([grow(sp.storyWindow), { type: 'storyWindow' }]);
      if (info.stall) targets.push([sp.feteStall, { type: 'feteStall' }]);
      if (info.rack) targets.push([sp.lanternRack, { type: 'lanternRack' }]);
    }
    // Le plus proche du doigt d'abord (objets voisins agrandis qui se chevauchent).
    const hits = targets.filter(([r]) => within(r, 0));
    const pick = (list) => {
      let best = null;
      let bd = Infinity;
      for (const [r, h] of list) {
        const d = (wx - (r.x + r.w / 2)) ** 2 + (wy - (r.y + r.h / 2)) ** 2;
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      return best;
    };
    if (hits.length) return pick(hits);
    if (slop > 0) {
      const near = targets.filter(([r]) => within(r, slop));
      if (near.length) return pick(near);
    }
    return null;
  }

  function clear() {
    jumps.clear();
    picks.clear();
    weedsFx.length = 0;
    seeds.t = -1;
    walker.mode = 'gone';
    info.items = [];
    info.itemSig = '';
    info.finds = [];
    info.findSig = '';
    info.traces = [];
    info.traceSig = '';
    info.fete = null;
    info.stall = null;
    info.feeder = false;
    info.bird = null;
    info.story = false;
    info.rack = null;
    info.waiting = [];
    infoT = -1;
    lastLayout = null;
    sp = null;
  }

  function shift(dx, dy) {
    if (!sp) return;
    for (const list of [sp.hideSpots, sp.edgeSpots, sp.traceSpots]) {
      for (const r of list) {
        r.x += dx;
        r.y += dy;
      }
    }
    for (const k of ['feeder', 'lanternRack', 'storyWindow', 'feteStall']) {
      sp[k].x += dx;
      sp[k].y += dy;
    }
    for (const [, v] of picks) {
      v.x += dx;
      v.y += dy;
    }
    for (const w of weedsFx) {
      w.x += dx;
      w.y += dy;
    }
    walker.x0 += dx;
    walker.x1 += dx;
    walker.y += dy;
  }

  return {
    setImages(imgs) {
      images = imgs;
      cache.clear();
    },
    setReducedMotion(on) {
      reduced = !!on;
    },
    setFeteMode(on) {
      feteMode = !!on;
    },
    get feteMode() {
      return feteMode;
    },
    /** Niveaux : valeurs [5] du meilleur résultat du niveau (porte-lanternes), ou null (tout éteint). */
    setLanterns(values) {
      levelLanterns = Array.isArray(values) && values.length === 5 ? values.map((v) => Math.max(0, Math.min(4, v | 0))) : null;
      if (!info.career) info.rack = levelLanterns;
    },
    /** Le joueur touche l'oiseau : il chante (petit saut). */
    sing() {
      birdSing = 1.2;
    },
    sync,
    onEvent,
    update,
    collect,
    drawOverlay,
    drawGlow,
    hitTest,
    itemRect,
    clear,
    shift,
    spots: () => sp,
    stats: () => ({
      enabled,
      drawn,
      feteMode,
      items: info.items.map((x, k) => ({ index: x.index, found: x.found, spot: info.itemSpots[k] })),
      kind: info.kind,
      stall: info.stall,
      finds: info.finds.map((f) => f.id),
      traces: info.traces.length,
      feeder: info.feeder,
      bird: info.bird,
      story: info.story,
      rack: info.rack,
      waiting: info.waiting.length,
      walker: walker.mode,
      spots: sp ? { hide: sp.hideSpots.length, edge: sp.edgeSpots.length, trace: sp.traceSpots.length } : null,
    }),
  };
}
