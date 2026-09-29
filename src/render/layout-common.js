// Outils communs aux deux dispositions de la scène (paysage : layout.js, portrait :
// layout-portrait.js) : hasard déterministe, conversions de rectangles, et requêtes
// (rectangle d'une parcelle, d'un investissement, test de toucher…) construites à partir
// des emplacements décrits par chaque disposition. Aucune dépendance au DOM.

import { TILE } from './atlas.js';

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

/** Rectangle en tuiles → rectangle en pixels du monde. */
export const px = (r) => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });
export const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
export const union = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Boîte englobante (tuiles) des k premières tuiles d'une liste. */
export function boundsOf(list, k) {
  const n = Math.max(1, Math.min(list.length, k));
  let r = { x: list[0].x, y: list[0].y, w: 1, h: 1 };
  for (let i = 1; i < n; i++) r = union(r, { x: list[i].x, y: list[i].y, w: 1, h: 1 });
  return r;
}

/** Distance (px) d'un point à un rectangle (0 à l'intérieur). */
export function distToRect(r, x, y) {
  const dx = x < r.x ? r.x - x : x >= r.x + r.w ? x - (r.x + r.w) : 0;
  const dy = y < r.y ? r.y - y : y >= r.y + r.h ? y - (r.y + r.h) : 0;
  return Math.hypot(dx, dy);
}

/**
 * Têtes d'arrosage automatique dans les marges haute et basse du champ (tuiles), 6 au plus,
 * en évitant le portail. Même logique pour les deux dispositions.
 * @param gx, gy   première tuile des parcelles ; tw, th : largeur / hauteur des parcelles (tuiles)
 */
export function sprinklerHeads(gx, gy, tw, th, gate) {
  const out = [];
  const top = gy - 1;
  const bottom = gy + th;
  const left = gx + (tw >= 4 ? 1 : 0);
  const right = gx + tw - 1 - (tw >= 4 ? 1 : 0);
  const mid = gx + Math.floor(tw / 2) - (tw % 2 === 0 ? 1 : 0);
  const cand = [
    { x: left, y: top }, { x: right, y: top },
    { x: left, y: bottom }, { x: right, y: bottom },
    { x: mid, y: top }, { x: Math.min(right, mid + 1 + (tw % 2 === 0 ? 1 : 0)), y: bottom },
  ];
  const seen = new Set();
  for (const t of cand) {
    if (t.x === gate.x && t.y === bottom) t.x = t.x - 1 >= gx ? t.x - 1 : t.x + 1;
    const k = `${t.x},${t.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  while (out.length < 6) out.push(out[out.length % Math.max(1, out.length)]);
  return out;
}

/**
 * Requêtes communes, à partir de la description d'une disposition.
 * @param d  { plots, slots, available, field: { fence, gate }, width, height, solarExtendUp }
 *           slots : emplacements en tuiles (voir layout.js) ; plots : [{ index, x, y, w, h }] en px.
 */
export function makeQueries(d) {
  const { plots, slots, available, field } = d;
  const { fence, gate } = field;

  // Zone d'un emplacement (tuiles) selon le nombre possédé (0 = panneau seul).
  function slotTiles(id, n = 99) {
    const s = slots[id];
    if (!s) return null;
    if (n <= 0) return { x: s.sign.x, y: s.sign.y, w: 1, h: 1 };
    switch (id) {
      case 'chickenCoop': return union(s.shed, s.fence);
      case 'beehive': return boundsOf(s.hives, n);
      case 'cow': return union(s.barn, s.fence);
      case 'sheep': return s.extras && s.extrasInArea ? union(s.fence, s.extras) : s.fence;
      case 'roadsideStand': return s.area;
      case 'solarPanel': {
        const b = boundsOf(s.units, Math.min(2, n));
        const up = d.solarExtendUp || 0;
        return { x: b.x, y: b.y - up, w: b.w, h: b.h + up };
      }
      case 'guestHouse': return s.house;
      case 'sprinkler': return null; // plusieurs têtes : voir hitTest
      default: return null;
    }
  }

  function plotRect(index) {
    const p = plots[index];
    return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
  }

  /** Centre (px) d'une parcelle. */
  function plotCenter(index) {
    const p = plots[index];
    return p ? { x: p.x + p.w / 2, y: p.y + p.h / 2 } : null;
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
    if (!s) return { x: d.width / 2, y: d.height / 2 };
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

  function plotAt(wx, wy) {
    for (const p of plots) {
      if (wx >= p.x && wy >= p.y && wx < p.x + p.w && wy < p.y + p.h) return p.index;
    }
    return -1;
  }

  /**
   * Ce qui se trouve sous un point du monde.
   * @param owned  facultatif : { id: nombre possédé } (ex. game.state.investments). Sans lui,
   *               toutes les zones comptent ; avec lui, un emplacement non acheté ne réagit que
   *               sur son panneau « à vendre ».
   * @returns {type:'plot', index} | {type:'investment', id} | null
   */
  function hitTest(wx, wy, owned) {
    const pi = plotAt(wx, wy);
    if (pi >= 0) return { type: 'plot', index: pi };
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
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
    }
    return null;
  }

  /**
   * Test de toucher tolérant (doigt) : d'abord le test exact ; sinon la parcelle la plus proche
   * à moins de `slop` px du monde (allées, clôture du champ) ; sinon un investissement dont la
   * zone, élargie de `slop`, contient le point.
   */
  function hitTestNear(wx, wy, owned, slop = 4) {
    const exact = hitTest(wx, wy, owned);
    if (exact) return exact;
    let best = -1;
    let bestD = Infinity;
    for (const p of plots) {
      const dd = distToRect(p, wx, wy);
      if (dd < bestD) { bestD = dd; best = p.index; }
    }
    if (best >= 0 && bestD <= slop) return { type: 'plot', index: best };
    const count = (id) => (owned ? owned[id] || 0 : 99);
    let bestId = null;
    bestD = Infinity;
    for (const id of Object.keys(slots)) {
      if (!available.has(id)) continue;
      const rects = [];
      if (id === 'sprinkler') {
        const n = count(id);
        const k = n > 0 ? slots.sprinkler.perLevel[Math.min(2, n - 1)] : 0;
        if (k === 0) rects.push(px({ x: slots.sprinkler.sign.x, y: slots.sprinkler.sign.y, w: 1, h: 1 }));
        for (let i = 0; i < k; i++) rects.push(px({ x: slots.sprinkler.units[i].x, y: slots.sprinkler.units[i].y, w: 1, h: 1 }));
      } else {
        const t = slotTiles(id, count(id));
        if (t) rects.push(px(t));
      }
      for (const r of rects) {
        const dd = distToRect(r, wx, wy);
        if (dd <= slop * 1.5 && dd < bestD) { bestD = dd; bestId = id; }
      }
    }
    return bestId ? { type: 'investment', id: bestId } : null;
  }

  return { slotTiles, plotRect, plotCenter, investmentRect, investmentAnchor, hitTest, hitTestNear, plotAt };
}
