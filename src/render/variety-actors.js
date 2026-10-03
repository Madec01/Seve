// Lot 3 « Variété » dans la scène (docs/ARCHITECTURE.md, « Lot 3 — contrats », « Ce que RENDER et UI consomment ») :
// tableau du village et ses feuilles de commande, charrette du marché et ses caisses, roulotte de Basile le
// colporteur, visiteur unique de l'année à thème (carrière), stand de la fête du thème, poule voyageuse (carte).
//
// varietySpots(layout) → { board, cart, crates: [rect × 4], merchant, merchantNpc, wagon, henArea, visitor, fair }
//   (px du monde, pur : aucune dépendance au DOM ; testé par tests/lot3-render.test.js). Portrait des niveaux :
//   panneau au bord du chemin sous le portail du champ, charrette garée sur la route à droite, roulotte sur la route à
//   gauche (près de la maison) ; paysage : mêmes repères ; carrière : bande de la maison, à droite du chemin du champ
//   de départ, route en bas de la bande.
//
// createVarietyActors(effects) → actors
//   setImages(images), setReducedMotion(on)
//   sync(game, layout, { time })   état durable (state.variety, requêtes lues au plus 4 fois par seconde)
//   onEvent(type, payload, layout) cartArrived, cartDeparted, cartProgress, crateFull, merchantArrived, merchantLeft,
//                                  orderProgress, orderKept, orderDone, offer (visiteur du thème), dawn (arrosoir), harvested
//   update(dt)
//   collect(push)                  objets triés par profondeur avec le reste de la scène :
//                                  push(name | null, x, y, sortY, { img, flipX, alpha })
//   hitTest(wx, wy, slop)          { type: 'villageBoard' } | { type: 'cart' } | { type: 'merchant' } |
//                                  { type: 'themeVisitor', offerId } | null
//   spots(), clear(), shift(dx, dy), stats()
//
// Rien n'est dessiné sans state.variety (Classique). Un sprite du lot 3 absent (planche pas encore chargée) → repli
// dessiné une fois sur un petit canvas. Mouvements réduits : apparitions et départs en fondu, aucun trajet.

import { TILE, SPRITES } from './atlas.js';
import { canDraw } from './effects.js';

const OUTLINE = '#3f2631';
const ARRIVE_S = 2.1; // trajet de la charrette et de la roulotte (s)
const FADE_S = 0.6;
const CLIENT_LOOKS = 3; // npc.visitor.1..3

// ── Disposition (pure) ─────────────────────────────────────────────────────────────
function tileRect(r) {
  return r ? { x: r.x, y: r.y, w: r.w || 1, h: r.h || 1 } : null;
}

/** Rectangles (tuiles) à éviter pour poser le panneau. */
function obstacles(layout) {
  const list = [];
  const add = (r) => {
    if (r && Number.isFinite(r.x) && Number.isFinite(r.y)) list.push(tileRect(r));
  };
  const T = TILE;
  for (const d of layout.decorSlots || []) add({ x: d.tx ?? Math.floor(d.x / T), y: d.ty ?? Math.floor(d.y / T), w: d.tw ?? Math.max(1, Math.round(d.w / T)), h: d.th ?? Math.max(1, Math.round(d.h / T)) });
  add(layout.house);
  add(layout.well);
  for (const p of layout.props || []) add({ x: p.x, y: p.y, w: 1, h: 1 });
  if (layout.sign && Number.isFinite(layout.sign.x)) add(layout.sign);
  const home = layout.home;
  if (home) {
    for (const k of ['house', 'storage', 'well', 'stand', 'waterTower', 'tractor']) add(home[k]);
    for (const s of home.solar || []) add({ x: s.x, y: s.y, w: 1, h: 1 });
  }
  // (Vallée V2) La Grainothèque réservée (2 × 2) : le panneau du village ne la recouvre jamais.
  const lib = layout.valley?.reserved ? layout.valley.library : null;
  if (lib) add({ x: Math.floor(lib.x / T), y: Math.floor(lib.y / T), w: Math.round(lib.w / T), h: Math.round(lib.h / T) });
  const slots = layout.slots || {};
  const avail = layout.available instanceof Set ? layout.available : new Set();
  if (!layout.career && typeof layout.slotTiles === 'function') {
    for (const id of Object.keys(slots)) {
      if (!avail.has(id) && id !== 'roadsideStand') continue;
      let t = null;
      try {
        t = layout.slotTiles(id, 99);
      } catch {
        t = null;
      }
      add(t);
      if (slots[id]?.sign) add({ x: slots[id].sign.x, y: slots[id].sign.y, w: 1, h: 1 });
    }
  }
  if (slots.sprinkler?.sign) add({ x: slots.sprinkler.sign.x, y: slots.sprinkler.sign.y, w: 1, h: 1 });
  return list;
}

const inside = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** Le carré 2 × 2 (tuiles) en (tx, ty) est-il libre ? La ligne du haut peut chevaucher la clôture du champ. */
function freeBox(layout, obs, tx, ty, fence, xMin, xMax) {
  if (tx < xMin || tx + 1 > xMax) return false;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (typeof layout.isPath === 'function' && layout.isPath(x, y, true)) return false;
      if (obs.some((r) => inside(r, x, y))) return false;
      if (fence && inside(fence, x, y) && !(dy === 0 && y === fence.y + fence.h - 1)) return false;
    }
  }
  return true;
}

/**
 * Repères du lot 3 (px du monde). Les mêmes pour une disposition donnée : calculés une fois par disposition.
 * @param layout disposition de src/render/layout*.js (niveaux paysage / portrait, carrière)
 */
export function varietySpots(layout) {
  const T = TILE;
  const career = !!(layout.career || layout.mode === 'career');
  const ess = layout.essential || { x: 0, y: 0, w: layout.width || 32 * T, h: layout.height || 20 * T };
  const xMinT = Math.round(ess.x / T);
  const xMaxT = Math.round((ess.x + ess.w) / T) - 1;
  const obs = obstacles(layout);
  const fence = layout.field?.fence || null;
  let roadY;
  let cands;
  if (career) {
    const H = layout.home?.y0 ?? 0;
    roadY = layout.home?.roadY ?? H + 8;
    const px7 = 7;
    cands = [[px7 + 1, H + 1], [px7 - 3, H + 1], [px7 + 1, H + 2], [px7 + 2, H + 1], [px7 - 4, H + 2], [px7 + 3, H + 3]];
  } else {
    roadY = layout.roadY ?? 17;
    const gate = layout.field?.gate || { x: layout.mainPathX ?? 15, y: (fence ? fence.y + fence.h - 1 : 9) };
    const g = gate.x;
    const gy = gate.y;
    cands = [[g + 2, gy], [g - 3, gy], [g + 2, gy + 1], [g - 3, gy + 1], [g + 3, gy], [g - 4, gy], [g + 2, gy + 2], [g - 3, gy + 2], [g + 1, gy + 1]];
  }
  let pick = cands.find(([x, y]) => freeBox(layout, obs, x, y, career ? null : fence, xMinT, xMaxT));
  if (!pick) pick = cands.find(([x]) => x >= xMinT && x + 1 <= xMaxT) || cands[0];
  const board = { x: pick[0] * T, y: pick[1] * T, w: 2 * T, h: 2 * T };

  // Route : la charrette se gare à droite, la roulotte à gauche (près de la maison).
  const roadPx = roadY * T;
  const right = ess.x + ess.w;
  const cart = { x: right - 3 * T, y: roadPx, w: 2 * T, h: 2 * T };
  const crates = [];
  for (let i = 0; i < 4; i++) crates.push({ x: cart.x - (i + 1) * T - 2, y: roadPx + T - 1, w: T, h: T });
  const wagon = { x: ess.x + Math.round(T * 0.25), y: roadPx, w: 2 * T, h: 2 * T };
  const merchantNpc = { x: wagon.x + 2 * T + 3, y: roadPx + 15 };
  const merchant = { x: wagon.x, y: wagon.y, w: merchantNpc.x + 13 - wagon.x, h: 2 * T };

  // Cour devant la maison (poule voyageuse) ; visiteur et stand de fête près du panneau.
  const h = layout.house || layout.home?.house;
  const henArea = h ? { x: h.x * T, y: (h.y + h.h) * T + 2, w: Math.max(3, h.w + 2) * T, h: T - 2 } : { x: ess.x + T, y: roadPx - 2 * T, w: 4 * T, h: T };
  // Le visiteur attend à GAUCHE du panneau : à droite, il tombait sous la mini-carte de la carrière (en bas à
  // droite de l'écran) tant qu'on ne faisait pas défiler (QA du lot 3) ; le stand de fête se pousse un peu plus loin.
  const visitor = { x: board.x - T - 4, y: board.y + board.h - 15 };
  const fair = { x: board.x - 3 * T, y: board.y + T };
  return { board, cart, crates, merchant, merchantNpc, wagon, henArea, visitor, fair, roadY };
}

// ── Replis dessinés (une fois, sur de petits canvas) ─────────────────────────────────
function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g);
  return c;
}

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

const FALLBACK = {
  board: () =>
    makeCanvas(32, 32, (g) => {
      rect(g, 5, 18, 3, 13, OUTLINE);
      rect(g, 24, 18, 3, 13, OUTLINE);
      rect(g, 6, 18, 1, 12, '#8a5a2b');
      rect(g, 25, 18, 1, 12, '#8a5a2b');
      rect(g, 1, 8, 30, 17, OUTLINE);
      rect(g, 2, 9, 28, 15, '#f2c98a');
      rect(g, 2, 14, 28, 1, '#dcae6c');
      rect(g, 2, 19, 28, 1, '#dcae6c');
      rect(g, 0, 2, 32, 7, OUTLINE);
      rect(g, 1, 3, 30, 5, '#c0503f');
      rect(g, 1, 3, 30, 1, '#e2665b');
    }),
  note: (kind) =>
    makeCanvas(16, 16, (g) => {
      rect(g, 3, 2, 10, 12, OUTLINE);
      rect(g, 4, 3, 8, 10, '#fff8e8');
      rect(g, 5, 6, 6, 1, '#b8a58a');
      rect(g, 5, 8, 6, 1, '#b8a58a');
      rect(g, 5, 10, 4, 1, '#b8a58a');
      if (kind === 'kept') {
        rect(g, 7, 1, 3, 3, OUTLINE);
        rect(g, 8, 2, 1, 1, '#e2443b');
      }
      if (kind === 'done') {
        rect(g, 5, 9, 2, 2, '#3f9b3a');
        rect(g, 7, 10, 2, 2, '#3f9b3a');
        rect(g, 9, 6, 2, 4, '#3f9b3a');
      }
    }),
  cart: (frame) =>
    makeCanvas(32, 32, (g) => {
      // Caisse de la charrette (à gauche), âne gris (à droite, regard vers la droite).
      rect(g, 1, 12, 18, 10, OUTLINE);
      rect(g, 2, 13, 16, 8, '#b8794a');
      rect(g, 2, 16, 16, 1, '#8a5a2b');
      const wy = 20 + (frame ? 1 : 0);
      rect(g, 4, wy, 8, 8, OUTLINE);
      rect(g, 5, wy + 1, 6, 6, '#d9a066');
      rect(g, 7, wy + 3, 2, 2, OUTLINE);
      rect(g, 17, 18, 6, 1, OUTLINE);
      rect(g, 21, 15, 9, 8, OUTLINE);
      rect(g, 22, 16, 7, 6, '#8d99a6');
      rect(g, 27, 10, 4, 8, OUTLINE);
      rect(g, 28, 11, 2, 6, '#8d99a6');
      rect(g, 27, 7, 1, 4, OUTLINE);
      const leg = frame ? 1 : 0;
      rect(g, 22 + leg, 22, 2, 6, OUTLINE);
      rect(g, 27 - leg, 22, 2, 6, OUTLINE);
    }),
  crate: (full) =>
    makeCanvas(16, 16, (g) => {
      rect(g, 2, 6, 12, 9, OUTLINE);
      rect(g, 3, 7, 10, 7, '#c58747');
      rect(g, 3, 10, 10, 1, '#8a5a2b');
      if (full) {
        rect(g, 3, 3, 10, 5, OUTLINE);
        rect(g, 4, 4, 3, 3, '#e2665b');
        rect(g, 7, 4, 3, 3, '#7cc955');
        rect(g, 10, 4, 2, 3, '#ffb600');
      }
    }),
  wagon: (open) =>
    makeCanvas(32, 32, (g) => {
      rect(g, 2, 9, 28, 15, OUTLINE);
      rect(g, 3, 10, 26, 13, '#5f9e4a');
      rect(g, 6, 13, 6, 7, '#a3703a');
      rect(g, 15, 12, 10, 5, open ? '#fff1d2' : '#a3703a');
      rect(g, 1, 3, 30, 7, OUTLINE);
      for (let x = 2; x < 30; x += 4) {
        rect(g, x, 4, 2, 5, '#e2665b');
        rect(g, x + 2, 4, 2, 5, '#fff1d2');
      }
      for (const wx of [5, 20]) {
        rect(g, wx, 21, 8, 8, OUTLINE);
        rect(g, wx + 1, 22, 6, 6, '#d9a066');
        rect(g, wx + 3, 24, 2, 2, OUTLINE);
      }
      rect(g, 29, 11, 2, 3, '#fddc00');
    }),
  npc: (walk) =>
    makeCanvas(16, 16, (g) => {
      rect(g, 3, 1, 10, 3, OUTLINE);
      rect(g, 4, 2, 8, 1, '#6d4b27');
      rect(g, 5, 4, 6, 4, OUTLINE);
      rect(g, 6, 5, 4, 3, '#f5c08a');
      rect(g, 4, 8, 8, 5, OUTLINE);
      rect(g, 5, 9, 6, 3, '#3b6891');
      rect(g, 11, 8, 3, 5, '#a3703a');
      rect(g, 5 + (walk ? 1 : 0), 13, 2, 3, OUTLINE);
      rect(g, 9 - (walk ? 1 : 0), 13, 2, 3, OUTLINE);
    }),
};

// ── Acteurs ────────────────────────────────────────────────────────────────────────
export function createVarietyActors(effects) {
  let images = null;
  let reduced = false;
  let time = 0;
  let lastLayout = null;
  let sp = null; // repères (varietySpots)
  let enabled = false;
  let infoT = -1;
  const info = { board: false, slots: [], cart: null, merchantHere: false, hen: false, visitor: null, fair: null };
  const cart = { on: false, mode: 'gone', t: 0, x: 0, alpha: 1, crates: [], pending: false };
  const wagon = { on: false, mode: 'gone', t: 0, x: 0, alpha: 1, pending: false };
  const hen = { x: 0, y: 0, tx: 0, ty: 0, wait: 0, facing: 1, on: false };
  const lastLabels = new Map(); // étiquette « → Lili » → instant du dernier affichage
  const visitorA = { on: false, x: 0, t: 0, from: 0, offerId: null, look: 1 };
  const hops = [0, 0, 0]; // feuille de commande qui saute (livrée)
  const doneSlots = new Map(); // place → jour de la livraison
  let dayKey = '';
  const cache = new Map(); // replis dessinés
  let drawn = 0;

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

  function readInfo(game) {
    const v = game.state.variety;
    const parts = v.parts || {};
    info.board = parts.board !== false && !!v.board;
    const orders = info.board && typeof game.query.orders === 'function' ? safe(() => game.query.orders(), null) : null;
    info.slots = (orders?.slots || []).map((s) => (s && !s.empty && s.id ? { id: s.id, kept: !!(s.kept || s.started) } : null));
    (orders?.slots || []).forEach((s, i) => {
      if (s?.delivered) doneSlots.set(i, dayKey);
    });
    info.startsIn = orders?.startsIn || 0;
    const c = typeof game.query.cart === 'function' ? safe(() => game.query.cart(), null) : null;
    info.cart = c ? { crates: (c.crates || []).map((k) => ({ cropId: k.cropId, full: !!k.full, got: k.got || 0, n: k.n || 1 })) } : v.cart ? { crates: (v.cart.crates || []).map((k) => ({ cropId: k.cropId, full: k.got >= k.n, got: k.got, n: k.n })) } : null;
    const m = typeof game.query.merchant === 'function' ? safe(() => game.query.merchant(), null) : null;
    info.merchantHere = !!m?.here;
    const cards = typeof game.query.cards === 'function' ? safe(() => game.query.cards(), null) : null;
    info.hen = game.mode !== 'career' && !!(cards?.active || []).some((x) => x.id === 'hen' && x.current !== false && (x.daysLeft === undefined || x.daysLeft >= 0));
    const t = game.mode === 'career' && typeof game.query.career?.theme === 'function' ? safe(() => game.query.career.theme(), null) : null;
    const vis = t?.visitor;
    const offers = vis && vis.offerId && !vis.done ? safe(() => game.query.career.events?.()?.offers || [], []) : [];
    const offer = offers.find((o) => (o.offerId ?? o.id) === vis?.offerId || o.kind === 'themeVisitor');
    info.visitor = offer ? { offerId: offer.offerId ?? offer.id, portrait: vis.portrait } : null;
    info.fair = t?.id && t.festival && t.festival.daysUntil === 0 && !t.festival.done ? t.id : null;
  }

  // ── État durable ──────────────────────────────────────────────────────────────
  function sync(game, layout, opts = {}) {
    if (opts.time !== undefined) time = opts.time;
    enabled = !!game?.state?.variety;
    if (!enabled) {
      if (cart.on || wagon.on) clear();
      return;
    }
    if (layout !== lastLayout) {
      lastLayout = layout;
      sp = varietySpots(layout);
      layout.variety = { board: sp.board, cart: sp.cart, crates: sp.crates, merchant: sp.merchant, merchantNpc: sp.merchantNpc };
      if (cart.mode === 'parked') cart.x = sp.cart.x;
      if (wagon.mode === 'parked') wagon.x = sp.wagon.x;
    }
    if (infoT >= 0 && time - infoT < 0.25) return;
    infoT = time;
    const t = game.state.time || {};
    const key = `${t.year || 0}|${t.day || 0}`;
    if (key !== dayKey) {
      dayKey = key;
      for (const [slot, d] of doneSlots) if (d !== key) doneSlots.delete(slot);
    }
    readInfo(game);
    // Charrette : présente tant que state.variety.cart existe.
    if (info.cart && !cart.on) {
      cart.on = true;
      if (cart.pending && !reduced) {
        cart.mode = 'arriving';
        cart.t = 0;
        cart.x = sp.cart.x - (lastLayout.essential ? lastLayout.essential.w : 200) * 0.75 - 40; // l'âne regarde à droite : il arrive par la gauche
        cart.startX = cart.x;
        cart.alpha = 1;
      } else {
        cart.mode = cart.pending ? 'fadein' : 'parked';
        cart.t = 0;
        cart.x = sp.cart.x;
      }
      cart.pending = false;
    } else if (!info.cart && cart.on && cart.mode !== 'leaving' && cart.mode !== 'fadeout') {
      cart.on = false;
      startLeave(cart);
    }
    if (info.cart) cart.crates = info.cart.crates;
    // Roulotte : entre le jour d'arrivée et le soir du départ.
    if (info.merchantHere && !wagon.on) {
      wagon.on = true;
      if (wagon.pending && !reduced) {
        wagon.mode = 'arriving';
        wagon.t = 0;
        wagon.x = sp.wagon.x - 70;
        wagon.startX = wagon.x;
        wagon.alpha = 1;
      } else {
        wagon.mode = wagon.pending ? 'fadein' : 'parked';
        wagon.t = 0;
        wagon.x = sp.wagon.x;
      }
      wagon.pending = false;
    } else if (!info.merchantHere && wagon.on && wagon.mode !== 'leaving' && wagon.mode !== 'fadeout') {
      wagon.on = false;
      startLeave(wagon, -1);
    }
    // Poule voyageuse.
    if (info.hen && !hen.on) {
      hen.on = true;
      hen.x = sp.henArea.x + sp.henArea.w / 2;
      hen.y = sp.henArea.y + sp.henArea.h / 2;
      hen.tx = hen.x;
      hen.ty = hen.y;
    } else if (!info.hen) hen.on = false;
    // Visiteur unique du thème : il attend près du panneau tant que son offre est ouverte.
    if (info.visitor && !visitorA.on) {
      visitorA.on = true;
      visitorA.offerId = info.visitor.offerId;
      visitorA.look = 1 + (String(info.visitor.offerId).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % CLIENT_LOOKS);
      visitorA.t = visitorA.walk && !reduced ? 0 : 1;
      visitorA.from = sp.visitor.x + 60;
    } else if (!info.visitor) visitorA.on = false;
  }

  function startLeave(o, dir = 1) {
    if (reduced) {
      o.mode = 'fadeout';
      o.t = 0;
    } else {
      o.mode = 'leaving';
      o.t = 0;
      o.dir = dir;
    }
  }

  // ── Événements ────────────────────────────────────────────────────────────────
  function plotTop(layout, i) {
    const r = Number.isInteger(i) ? safe(() => layout.plotRect(i), null) : null;
    return r ? { x: r.x + r.w / 2, y: r.y + 2 } : null;
  }

  function onEvent(type, p = {}, layout) {
    if (!layout) return;
    if (layout !== lastLayout && enabled) {
      lastLayout = layout;
      sp = varietySpots(layout);
    }
    const s = sp || varietySpots(layout);
    switch (type) {
      case 'cartArrived':
        cart.pending = true;
        infoT = -1;
        break;
      case 'cartDeparted':
        infoT = -1;
        if (cart.on) {
          cart.on = false;
          startLeave(cart);
        }
        if (p.allFull) effects.sparkle?.(s.cart, 16, 'gold', 0);
        break;
      case 'merchantArrived':
        wagon.pending = true;
        infoT = -1;
        break;
      case 'merchantLeft':
        infoT = -1;
        if (wagon.on) {
          wagon.on = false;
          startLeave(wagon, -1);
        }
        break;
      case 'orderProgress':
      case 'cartProgress': {
        if (p.fromStock) break;
        const at = plotTop(layout, p.plotIndex);
        const label = type === 'cartProgress' ? '→ charrette' : p.label || (p.clientName ? `→ ${p.clientName}` : '→ commande');
        // Récolte en série : une seule étiquette par destination toutes les 0,9 s (sinon les textes se chevauchent).
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const seen = lastLabels.get(label);
        if (at && !(seen !== undefined && now - seen < 900)) {
          lastLabels.set(label, now);
          effects.floatText?.(at.x, at.y - 6, label, '#fff1d2', { icon: false, life: 1.6, delay: 0.25 });
        }
        if (type === 'orderProgress') {
          const i = info.slots.findIndex((x) => x && x.id === p.orderId);
          if (i >= 0) hops[i] = Math.max(hops[i], 0.35);
        }
        break;
      }
      case 'crateFull': {
        const r = s.crates[p.crateIndex];
        if (r) {
          effects.sparkle?.(r, 10, 'gold', 0.1);
          if (!reduced) effects.ring?.(r.x + 8, r.y + 12, 3, 12, '#fff3b0', 0.45, 0.05, 0.45, 1);
        }
        infoT = -1;
        break;
      }
      case 'orderKept': {
        // Semis de la culture d'une commande : gardée d'office (punaise rouge sur le panneau, petite étiquette).
        const i = info.slots.findIndex((x) => x && x.id === p.orderId);
        if (i >= 0) hops[i] = Math.max(hops[i], 0.6);
        const at = plotTop(layout, p.plotIndex);
        if (at && p.clientName) effects.floatText?.(at.x, at.y - 6, `Gardée : ${p.clientName}`, '#fff1d2', { icon: false, life: 1.6, delay: 0.15 });
        infoT = -1;
        break;
      }
      case 'orderDone': {
        const i = info.slots.findIndex((x) => x && x.id === p.orderId);
        if (i >= 0) {
          doneSlots.set(i, dayKey);
          hops[i] = 1;
        }
        const b = s.board;
        effects.sparkle?.({ x: b.x + 2, y: b.y + 6, w: b.w - 4, h: 16 }, 12, 'gold', 0.05);
        if (p.premium) effects.floatText?.(b.x + b.w / 2, b.y - 2, `+${p.premium}`, undefined, { delay: 0.2, pop: true });
        infoT = -1;
        break;
      }
      case 'ordersRenewed':
        infoT = -1;
        break;
      case 'offer':
        if (p.kind === 'themeVisitor' || p.offer?.kind === 'themeVisitor') {
          visitorA.walk = true;
          infoT = -1;
        }
        break;
      case 'themeShower':
      case 'dawn': {
        const list = type === 'themeShower' ? p.plots : p.varietyWatered;
        if (Array.isArray(list)) {
          for (const i of list) {
            const r = safe(() => layout.plotRect(i), null);
            if (r) effects.droplets?.(r.x + r.w / 2, r.y + r.h / 2, reduced ? 4 : 8, layout.plotScale || 1);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Animation ─────────────────────────────────────────────────────────────────
  function stepMover(o, target, dt, dir = 1) {
    o.t += dt;
    if (o.mode === 'arriving') {
      const k = Math.min(1, o.t / ARRIVE_S);
      const e = 1 - (1 - k) ** 2.4;
      o.x = o.startX + (target - o.startX) * e;
      if (k >= 1) {
        o.mode = 'parked';
        o.x = target;
      }
    } else if (o.mode === 'leaving') {
      const k = Math.min(1, o.t / ARRIVE_S);
      o.x = target + (o.dir || dir) * k * k * 160;
      o.alpha = 1 - Math.max(0, (k - 0.6) / 0.4);
      if (k >= 1) o.mode = 'gone';
    } else if (o.mode === 'fadein') {
      o.alpha = Math.min(1, o.t / FADE_S);
      o.x = target;
      if (o.alpha >= 1) o.mode = 'parked';
    } else if (o.mode === 'fadeout') {
      o.alpha = 1 - Math.min(1, o.t / FADE_S);
      if (o.alpha <= 0) o.mode = 'gone';
    } else if (o.mode === 'parked') {
      o.alpha = 1;
      o.x = target;
    }
  }

  function update(dt) {
    time += dt;
    if (!enabled || !sp) return;
    stepMover(cart, sp.cart.x, dt, 1);
    if (cart.mode === 'arriving' || cart.mode === 'leaving') {
      if (Math.random() < dt * 6) effects.dirt?.(cart.x + 8, sp.cart.y + 28, 1, 1);
    }
    stepMover(wagon, sp.wagon.x, dt, -1);
    for (let i = 0; i < 3; i++) hops[i] = Math.max(0, hops[i] - dt * 1.6);
    if (hen.on) {
      if (hen.wait > 0) hen.wait -= dt;
      else {
        const dx = hen.tx - hen.x;
        const dy = hen.ty - hen.y;
        const d = Math.hypot(dx, dy);
        if (d < 1 || reduced) {
          hen.wait = 1 + Math.random() * 2.5;
          const a = sp.henArea;
          hen.tx = a.x + Math.random() * a.w;
          hen.ty = a.y + Math.random() * a.h;
          if (reduced) {
            hen.x = hen.tx;
            hen.y = hen.ty;
          }
        } else {
          const v = Math.min(d, dt * 14);
          hen.x += (dx / d) * v;
          hen.y += (dy / d) * v;
          hen.facing = dx >= 0 ? 1 : -1;
        }
      }
    }
    if (visitorA.on && visitorA.t < 1) visitorA.t = Math.min(1, visitorA.t + dt / ARRIVE_S);
  }

  // ── Dessin (trié avec la scène) ──────────────────────────────────────────────
  function collect(push) {
    drawn = 0;
    if (!enabled || !sp) return;
    const P = (name, fb, x, y, sortY, opts = {}) => {
      drawn += 1;
      if (name && has(name)) push(name, Math.round(x), Math.round(y), sortY, opts);
      else if (fb) push(null, Math.round(x), Math.round(y), sortY, { ...opts, img: fb });
    };
    // Panneau du village et ses feuilles.
    if (info.board) {
      const b = sp.board;
      P('board.village', fallback('board'), b.x, b.y, b.y + b.h - 2);
      const offs = [0, 8, 16];
      info.slots.forEach((s, i) => {
        const done = doneSlots.has(i);
        if (!s && !done) return;
        const kind = done ? 'done' : s.kept ? 'kept' : 'note';
        const name = kind === 'note' ? 'board.note' : `board.note.${kind}`;
        const hop = reduced ? 0 : Math.sin(Math.min(1, hops[i]) * Math.PI) * 3 * Math.min(1, hops[i] * 2);
        P(name, fallback('note', kind), b.x + offs[i], b.y + 9 - hop, b.y + b.h - 1.9 + i * 0.01);
      });
      if (info.fair) P(`fair.theme.${info.fair}`, null, sp.fair.x, sp.fair.y, sp.fair.y + TILE);
    }
    // Charrette et caisses.
    if (cart.mode !== 'gone') {
      const moving = cart.mode === 'arriving' || cart.mode === 'leaving';
      const frame = moving && Math.floor(time * 6) % 2 ? 1 : 0;
      const alpha = cart.alpha ?? 1;
      const flip = cart.mode === 'leaving' && (cart.dir || 1) < 0;
      P(frame ? 'cart.market.1' : 'cart.market', fallback('cart', frame), cart.x, sp.cart.y - (moving && frame ? 1 : 0), sp.cart.y + sp.cart.h - 1, { alpha, flipX: flip });
      if (cart.mode === 'parked' || cart.mode === 'fadein') {
        (cart.crates || []).forEach((k, i) => {
          const r = sp.crates[i];
          if (!r) return;
          const full = !!k.full;
          const name = full ? (SPRITES[`crate.${k.cropId}`] ? `crate.${k.cropId}` : 'crate.empty') : 'crate.empty';
          P(name, fallback('crate', full ? 1 : 0), r.x, r.y, r.y + r.h - 1, { alpha });
        });
      }
    }
    // Roulotte et Basile.
    if (wagon.mode !== 'gone') {
      const alpha = wagon.alpha ?? 1;
      const parked = wagon.mode === 'parked' || wagon.mode === 'fadein';
      P(parked ? 'merchant.wagon.1' : 'merchant.wagon', fallback('wagon', parked ? 1 : 0), wagon.x, sp.wagon.y, sp.wagon.y + sp.wagon.h - 1, { alpha });
      if (parked) {
        const n = sp.merchantNpc;
        const bob = reduced ? 0 : Math.sin(time * 2.4) > 0.6 ? -1 : 0;
        P('npc.merchant', fallback('npc', 0), n.x, n.y - 15 + bob, n.y + 1, { alpha, flipX: true });
      }
    }
    // Poule voyageuse (carte « Une poule voyageuse »).
    if (hen.on) {
      const peck = hen.wait > 0 && !reduced && Math.sin(time * 9) > 0.7 ? 1 : 0;
      P('animal.chicken', null, hen.x - 8, hen.y - 14 + peck, hen.y + 1, { flipX: hen.facing < 0 });
    }
    // Visiteur unique du thème.
    if (visitorA.on) {
      const v = sp.visitor;
      const k = 1 - (1 - visitorA.t) ** 2;
      const x = visitorA.t >= 1 ? v.x : visitorA.from + (v.x - visitorA.from) * k;
      const walking = visitorA.t < 1;
      const base = `npc.visitor.${visitorA.look}`;
      const name = walking && Math.floor(time * 6) % 2 && SPRITES[`${base}.walk`] ? `${base}.walk` : base;
      P(name, fallback('npc', walking ? 1 : 0), x, v.y - 15, v.y + 1, { flipX: walking });
    }
  }

  // ── Toucher ───────────────────────────────────────────────────────────────────
  function hitTest(wx, wy, slop = 0) {
    if (!enabled || !sp) return null;
    const within = (r, s) => r && wx >= r.x - s && wy >= r.y - s && wx < r.x + r.w + s && wy < r.y + r.h + s;
    const targets = [];
    // En route vers sa place (« arriving ») aussi : l'animation s'arrête quand le jeu est en pause, et la roulotte
    // ou la charrette doivent rester touchables à leur place.
    const here = (m) => m === 'parked' || m === 'fadein' || m === 'arriving';
    if (here(wagon.mode)) targets.push([sp.merchant, { type: 'merchant' }]);
    if (here(cart.mode)) {
      const c = sp.cart;
      const crates = (cart.crates || []).length;
      const x0 = crates ? sp.crates[Math.min(3, crates - 1)].x : c.x;
      targets.push([{ x: x0, y: c.y, w: c.x + c.w - x0, h: c.h }, { type: 'cart' }]);
    }
    if (visitorA.on) targets.push([{ x: sp.visitor.x, y: sp.visitor.y - 15, w: 16, h: 17 }, { type: 'themeVisitor', offerId: visitorA.offerId }]);
    if (info.board) targets.push([sp.board, { type: 'villageBoard' }]);
    for (const [r, hit] of targets) if (within(r, 0)) return hit;
    if (slop > 0) for (const [r, hit] of targets) if (within(r, slop)) return hit;
    return null;
  }

  function clear() {
    cart.on = false;
    cart.mode = 'gone';
    cart.pending = false;
    wagon.on = false;
    wagon.mode = 'gone';
    wagon.pending = false;
    hen.on = false;
    visitorA.on = false;
    visitorA.walk = false;
    doneSlots.clear();
    hops.fill(0);
    infoT = -1;
    lastLayout = null;
    sp = null;
  }

  function shift(dx, dy) {
    if (sp) {
      for (const k of ['board', 'cart', 'merchant', 'wagon', 'henArea']) {
        sp[k].x += dx;
        sp[k].y += dy;
      }
      for (const r of sp.crates) {
        r.x += dx;
        r.y += dy;
      }
      for (const k of ['merchantNpc', 'visitor', 'fair']) {
        sp[k].x += dx;
        sp[k].y += dy;
      }
    }
    cart.x += dx;
    wagon.x += dx;
    hen.x += dx;
    hen.y += dy;
    hen.tx += dx;
    hen.ty += dy;
  }

  return {
    setImages(imgs) {
      images = imgs;
      cache.clear();
    },
    setReducedMotion(on) {
      reduced = !!on;
    },
    sync,
    onEvent,
    update,
    collect,
    hitTest,
    clear,
    shift,
    spots: () => sp,
    stats: () => ({ enabled, drawn, cart: cart.mode, wagon: wagon.mode, hen: hen.on, visitor: visitorA.on, slots: info.slots.map((s) => (s ? (s.kept ? 'kept' : 'note') : null)), done: [...doneSlots.keys()], spots: sp }),
  };
}
