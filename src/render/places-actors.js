// La Vallée vivante (lot V3 « Le ruisseau ») sur la carte de la ferme (docs/VALLEE.md § 17.8 et § 17.9 ; contrat :
// docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V3 », « Ce que RENDER et UI consomment ») : le poteau « Vers la
// vallée » au bord de la route, les terres sauvages (bloc de 14 × 11 tuiles sans clôture qui reprend en 3 états selon sa
// sorte : bois, marais, prairie), les forêts qu'on peut confier (forêt plus claire + petit poteau à feuille), le mode
// terres sauvages (cases possibles qui pulsent : pointillé épais + pousse dans un cercle, lisible sans la couleur), les
// visiteurs des terres reprises (hachage du jour, 1 par bloc, 3 dans la vue au plus) et les clairières fleuries de
// l'étape 7.
//
// Repères : layout.wildBands, layout.wildable, layout.valley.signpost (src/render/layout-career.js).
//
// Purs (testés par tests/valley3-render.test.js) :
//   wildGroundName(kind, x, y), wildObjects(band) → [{ name, x, y, w, h, kind }] (px, tirés par tileHash, sans flux),
//   wildVisitor(band, day, installed) → id | null, clearingTiles(layout) → [{ x, y, v }]
//
// createPlacesActors(effects) → actors
//   setImages(images), setReducedMotion(on), sync(game, layout, { time, day }), update(dt), onEvent(type, payload, layout)
//   drawStaticGround(c, layout, season, sheets)   (couche fixe) sol et objets des terres sauvages, sous la forêt
//   drawStaticOver(c, layout, season, sheets)     (couche fixe) forêts à confier (plus claires + poteau), clairières
//   collect(push)                                  poteau « Vers la vallée », visiteurs des terres reprises
//   drawOverlay(c, layout)                         mode terres sauvages : cases possibles qui pulsent
//   hitTest(wx, wy, { minWorld })                  { type: 'valleyView' } | (mode) { type: 'wildCell', cellId } | null
//   setWildPlacing(on), wildPlacing, eligible(), itemRect(kind, id), clear(), shift(dx, dy), stats()
// Rien sans state.career.valley ; le poteau seulement quand la vue est ouverte (view.open). Mouvements réduits : rien ne
// bouge, apparitions directes. Planche valley3 facultative : replis dessinés.

import { TILE, SPRITES, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';
import { tileHash } from './layout-common.js';
import { WILD_KINDS_BY_ID } from '../data/career/places.js';

const T = TILE;
const OUTLINE = '#3f2631';
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const KIND_SALT = { wood: 101, marsh: 113, grassland: 127 };
const VISITORS = { wood: ['roeDeer', 'jay', 'squirrel'], marsh: ['heron', 'frog', 'dragonfly'], grassland: ['hare', 'skylark', 'butterfly'] };
/** Visiteurs qui sont des habitants de la vallée : seulement une fois installés. */
const NEEDS_INSTALLED = new Set(['roeDeer', 'heron', 'skylark']);
const VISITOR_COLORS = { roeDeer: ['#b8683a', '#f0d8b8'], jay: ['#b88a6a', '#3a6ae8'], squirrel: ['#c8582a', '#f0c890'], heron: ['#8a96a0', '#f0f0f0'], frog: ['#6a9a3a', '#b8763a'], dragonfly: ['#3a8ae8', '#a8e0f8'], hare: ['#a8865a', '#e8d8b8'], skylark: ['#8a6a4a', '#e8d8b0'], butterfly: ['#d8562a', '#3a5ac8'] };
const GROUND = { wood: ['#6a5034', '#7a5e3e'], marsh: ['#5a6a4a', '#4e6650'], grassland: ['#8ab050', '#9cc060'] };

// ── Purs ─────────────────────────────────────────────────────────────────────────────

export function wildGroundName(kind, x, y) {
  const k = WILD_KINDS_BY_ID[kind] ? kind : 'wood';
  return tileHash(x, y, KIND_SALT[k]) < 0.5 ? `wildland.${k}.ground` : `wildland.${k}.ground.1`;
}

/** Tuiles intérieures d'un bloc (les colonnes de lisière restent à la forêt, sauf continuité : la couche fixe les recouvre). */
function interior(band) {
  const x0 = Math.round(band.rect.x / T) + 1;
  const y0 = Math.round(band.rect.y / T);
  return { x0, y0, x1: x0 + 11, y1: y0 + 10 };
}

/** Objets d'une terre sauvage selon sa sorte et son état (0 jeune terre, 1 qui reprend, 2 reprise) : px du monde. */
export function wildObjects(band) {
  const out = [];
  if (!band?.rect) return out;
  const kind = WILD_KINDS_BY_ID[band.kind] ? band.kind : 'wood';
  const st = Math.max(0, Math.min(2, Math.floor(band.stage || 0)));
  const { x0, y0, x1, y1 } = interior(band);
  const salt = KIND_SALT[kind] + 7;
  const sign = band.sign || { x: x0, y: y1 - 1 };
  const taken = new Set([`${sign.x},${sign.y}`]);
  const free = (x, y, w = 1, h = 1) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (taken.has(`${i},${j}`) || i < x0 || i >= x1 || j < y0 || j >= y1) return false;
    return true;
  };
  const take = (x, y, w = 1, h = 1) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) taken.add(`${i},${j}`);
  };
  const put = (name, x, y, w = 1, h = 1, dy = 0) => {
    if (!free(x, y, w, h)) return false;
    take(x, y, w, h);
    out.push({ name, x: x * T, y: y * T + dy, w: w * T, h: h * T, kind });
    return true;
  };
  if (kind === 'marsh') {
    // Mares (32 × 32) en premier, à des places fixes du bloc.
    const pools = st === 0 ? [] : st === 1 ? [[x0 + 2, y0 + 2], [x0 + 7, y0 + 6]] : [[x0 + 1, y0 + 1], [x0 + 5, y0 + 4], [x0 + 8, y0 + 1], [x0 + 3, y0 + 7]];
    for (const [x, y] of pools) put('wildland.marsh.pool', x, y, 2, 2);
  }
  if (kind === 'wood' && st === 2) {
    // Grands chênes (2 × 3) sur une trame lâche.
    for (let y = y0; y <= y1 - 3; y += 4) for (let x = x0 + ((y - y0) % 8 ? 2 : 0); x <= x1 - 2; x += 4) if (tileHash(x, y, salt) < 0.62) put('nature.oak.summer', x, y, 2, 3);
  }
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!free(x, y)) continue;
      const h = tileHash(x, y, salt);
      let name = null;
      let tall = false;
      if (kind === 'wood') {
        if (st === 0) name = h < 0.12 ? 'wildland.wood.sprout' : null;
        else if (st === 1) name = h < 0.09 ? 'wildland.wood.hazel' : h < 0.15 ? 'wildland.wood.birch' : h < 0.3 ? 'wildland.wood.sprout' : null;
        else name = h < 0.12 ? 'wildland.wood.birch' : h < 0.24 ? 'wildland.wood.hazel' : h < 0.3 ? 'wildland.wood.sprout' : null;
        tall = name === 'wildland.wood.birch';
      } else if (kind === 'marsh') {
        if (st === 0) name = h < 0.12 ? 'wildland.marsh.puddle' : h < 0.2 ? 'nature.reeds' : null;
        else if (st === 1) name = h < 0.12 ? 'wildland.marsh.iris' : h < 0.26 ? 'nature.reeds.1' : h < 0.32 ? 'wildland.marsh.puddle' : null;
        else name = h < 0.15 ? 'wildland.marsh.iris' : h < 0.42 ? (h < 0.3 ? 'nature.reeds' : 'nature.reeds.2') : null;
      } else {
        if (st === 0) name = h < 0.1 ? 'wildland.grassland.tall' : null;
        else if (st === 1) name = h < 0.12 ? 'wildland.grassland.daisies' : h < 0.3 ? 'wildland.grassland.tall' : h < 0.38 ? 'wildland.grassland.tall.1' : null;
        else name = h < 0.06 ? 'wildland.grassland.bush' : h < 0.2 ? 'wildland.grassland.daisies' : h < 0.45 ? (h < 0.33 ? 'wildland.grassland.tall' : 'wildland.grassland.tall.1') : null;
      }
      if (!name) continue;
      if (tall) {
        if (y - 1 >= y0 && free(x, y - 1)) put(name, x, y - 1, 1, 2);
        continue;
      }
      put(name, x, y);
    }
  }
  return out;
}

/** Visiteur du jour d'une terre reprise (hachage pur du jour et de la case) ; null si personne aujourd'hui. */
export function wildVisitor(band, day, installed = () => false) {
  if (!band || (band.stage || 0) < 2) return null;
  const list = (VISITORS[band.kind] || VISITORS.wood).filter((id) => !NEEDS_INSTALLED.has(id) || installed(id));
  if (!list.length) return null;
  const h = tileHash(Math.floor(day || 0), String(band.cellId || '').length * 31 + (band.col || 0) * 7 + (band.row || 0) * 13, 211);
  if (h < 0.25) return null;
  return list[Math.floor(h * 997) % list.length];
}

/** Clairières fleuries (étape 7) : tuiles de forêt qui bordent le sol de la ferme, une sur ~6 (déterministe). */
export function clearingTiles(layout) {
  const out = [];
  if (!layout?.grid || typeof layout.isForest !== 'function') return out;
  const G = layout.grid;
  const x0 = G.x0Tiles - 1;
  const x1 = G.x0Tiles + G.colsTiles;
  for (let ty = G.rowTop - 1; ty < G.homeBottom - 2; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!layout.isForest(tx, ty)) continue;
      const nearGround = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !layout.isForest(tx + dx, ty + dy) && !layout.isPath?.(tx + dx, ty + dy));
      if (!nearGround) continue;
      const h = tileHash(tx, ty, 77);
      if (h < 1 / 6) out.push({ x: tx * T, y: ty * T, v: Math.floor(h * 18) % 3 });
    }
  }
  return out;
}

// ── Replis dessinés ──────────────────────────────────────────────────────────────────

function mk(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
const p = (g, color, x, y, w = 1, h = 1) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};
function blob(g, color, cx, cy, r) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}
const FALLBACK = {
  ground: (kind, v) => mk(16, 16, (g) => {
    const [a, b] = GROUND[kind] || GROUND.wood;
    p(g, v ? b : a, 0, 0, 16, 16);
    for (let k = 0; k < 9; k++) p(g, v ? a : b, (k * 7 + v * 3) % 15, (k * 5 + 2) % 15, 2, 1);
    if (kind === 'marsh') p(g, '#7aa0b0', 3 + v * 6, 9, 5, 2);
  }),
  sprout: () => mk(16, 16, (g) => { p(g, '#3d8a3c', 7, 8, 2, 6); p(g, '#7ac050', 4, 7, 4, 2); p(g, '#7ac050', 9, 6, 4, 2); }),
  hazel: () => mk(16, 16, (g) => { p(g, '#6a4a32', 7, 9, 2, 6); blob(g, OUTLINE, 8, 7, 6); blob(g, '#6aa040', 8, 6, 5); p(g, '#c89a5e', 5, 5, 2, 2); }),
  birch: () => mk(16, 32, (g) => { p(g, OUTLINE, 6, 12, 4, 20); p(g, '#f2f2ea', 7, 12, 2, 20); p(g, '#3a3a3a', 7, 18, 1, 1); p(g, '#3a3a3a', 8, 24, 1, 1); blob(g, OUTLINE, 8, 8, 7); blob(g, '#9ad06a', 8, 7, 6); }),
  oak: () => mk(32, 48, (g) => { p(g, '#5a3a26', 13, 30, 6, 18); blob(g, OUTLINE, 16, 18, 15); blob(g, '#3f8a3a', 16, 17, 14); blob(g, '#5aa848', 11, 12, 6); }),
  puddle: () => mk(16, 16, (g) => { blob(g, '#4a7a9a', 8, 10, 4); p(g, '#9ad0f0', 6, 9, 3, 1); p(g, '#6a8a3a', 2, 4, 1, 6); p(g, '#6a8a3a', 13, 3, 1, 7); }),
  pool: () => mk(32, 32, (g) => { blob(g, OUTLINE, 16, 16, 14); blob(g, '#3a7ab8', 16, 16, 13); p(g, '#9ad0f0', 9, 11, 7, 1); p(g, '#9ad0f0', 18, 20, 5, 1); }),
  iris: () => mk(16, 16, (g) => { p(g, '#3d8a3c', 7, 6, 1, 9); p(g, '#3d8a3c', 9, 8, 1, 7); p(g, '#f2c81a', 5, 4, 4, 3); p(g, '#f2c81a', 8, 6, 3, 2); }),
  reeds: (v) => mk(16, 16, (g) => { for (let k = 0; k < 4; k++) { p(g, v ? '#c8a84a' : '#6a8a3a', 3 + k * 3, 4 + (k % 2) * 2, 1, 11); p(g, '#7a5232', 3 + k * 3, 3 + (k % 2) * 2, 1, 2); } }),
  tall: (v) => mk(16, 16, (g) => { for (let k = 0; k < 5; k++) p(g, v ? '#9ac05a' : '#7ab04a', 2 + k * 3, 5 + (k % 2) * 3, 1, 10 - (k % 2) * 3); }),
  daisies: () => mk(16, 16, (g) => { for (const [x, y] of [[3, 5], [9, 3], [12, 10], [5, 11]]) { p(g, '#ffffff', x, y, 3, 3); p(g, '#f2c81a', x + 1, y + 1, 1, 1); } }),
  bush: () => mk(16, 16, (g) => { blob(g, OUTLINE, 8, 9, 6); blob(g, '#4a8a3a', 8, 8, 5); p(g, '#e8607a', 5, 6, 2, 2); p(g, '#e8607a', 10, 9, 2, 2); }),
  sign: () => mk(16, 16, (g) => { p(g, '#6a4a32', 7, 6, 2, 10); p(g, OUTLINE, 3, 2, 10, 6); p(g, '#7ac050', 4, 3, 8, 4); p(g, '#3d8a3c', 7, 4, 2, 2); }),
  offer: () => mk(16, 16, (g) => {
    for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; if (a % 2) p(g, '#f2fbe8', Math.round(8 + Math.cos(t) * 6), Math.round(8 + Math.sin(t) * 6), 1, 1); }
    p(g, '#3d8a3c', 7, 7, 2, 5); p(g, '#9ad06a', 4, 6, 3, 2); p(g, '#9ad06a', 9, 5, 3, 2);
  }),
  clearing: (v) => mk(16, 16, (g) => { blob(g, '#7ac050', 8, 9, 5); const c = ['#ffffff', '#f2c81a', '#e8607a'][v % 3]; p(g, c, 5, 7, 2, 2); p(g, c, 10, 10, 2, 2); p(g, c, 8, 5, 1, 1); }),
  signpost: () => mk(16, 32, (g) => {
    p(g, OUTLINE, 6, 8, 4, 24); p(g, '#8a5a32', 7, 8, 2, 24);
    p(g, OUTLINE, 1, 6, 14, 8); p(g, '#c89a5e', 2, 7, 11, 6); p(g, '#c89a5e', 13, 8, 2, 4); p(g, OUTLINE, 15, 9, 1, 2);
    p(g, '#5a3a22', 4, 9, 6, 1); p(g, '#5a3a22', 4, 11, 4, 1);
    p(g, '#5aa040', 4, 28, 8, 4);
  }),
  visitor: (id, f) => mk(16, 16, (g) => { const [a, b] = VISITOR_COLORS[id] || ['#8a6a4a', '#e8d8b0']; blob(g, OUTLINE, 8, 10 - f, 5); blob(g, a, 8, 10 - f, 4); blob(g, b, 6, 9 - f, 2); p(g, OUTLINE, 5, 8 - f, 1, 1); }),
};
const FB_OF = {
  'wildland.wood.sprout': ['sprout'], 'wildland.wood.hazel': ['hazel'], 'wildland.wood.birch': ['birch'], 'nature.oak.summer': ['oak'],
  'wildland.marsh.puddle': ['puddle'], 'wildland.marsh.pool': ['pool'], 'wildland.marsh.iris': ['iris'], 'nature.reeds': ['reeds', 0], 'nature.reeds.1': ['reeds', 0], 'nature.reeds.2': ['reeds', 1],
  'wildland.grassland.tall': ['tall', 0], 'wildland.grassland.tall.1': ['tall', 1], 'wildland.grassland.daisies': ['daisies'], 'wildland.grassland.bush': ['bush'],
};

// ── Acteurs ──────────────────────────────────────────────────────────────────────────

export function createPlacesActors(effects) {
  let images = null;
  let reduced = false;
  let time = 0;
  let enabled = false;
  let lastLayout = null;
  let wildPlacing = false;
  let eligible = [];
  let infoT = -1;
  let signFade = null; // âge (s) du poteau qui vient d'être planté
  let view = { open: false, stage: 0, day: 0, installed: new Set() };
  let drawn = 0;
  const cache = new Map();

  const has = (name) => canDraw(images, name);
  function fb(key, ...args) {
    const k = `${key}|${args.join(',')}`;
    if (!cache.has(k)) cache.set(k, FALLBACK[key](...args));
    return cache.get(k);
  }
  function draw(c, name, fbImg, x, y, alpha = 1, opts) {
    if (alpha <= 0) return;
    if (alpha !== 1) c.globalAlpha = alpha;
    if (name && has(name)) drawSprite(c, images, name, Math.round(x), Math.round(y), opts);
    else if (fbImg) c.drawImage(fbImg, Math.round(x), Math.round(y));
    if (alpha !== 1) c.globalAlpha = 1;
  }
  const seasonOak = (season) => `nature.oak.${SEASONS.includes(season) ? season : 'summer'}`;

  function sync(game, layout, opts = {}) {
    if (opts.time !== undefined) time = opts.time;
    lastLayout = layout;
    const v = game?.state?.career?.valley;
    enabled = !!v;
    if (!enabled) return;
    view.open = !!v.view?.open;
    view.stage = v.stage || 0;
    view.day = opts.day ?? view.day;
    if (infoT >= 0 && time - infoT < 0.25) return;
    infoT = time;
    const sp = v.species || {};
    view.installed = new Set(Object.entries(sp).filter(([, s]) => s && (s.state === 'installed' || s === 'installed')).map(([id]) => id));
    if (wildPlacing) {
      let list = [];
      try {
        list = game.query.career?.valley?.()?.wilds?.eligible || [];
      } catch {
        list = [];
      }
      eligible = Array.isArray(list) ? list.slice() : [];
    }
  }

  function update(dt) {
    if (signFade !== null) {
      signFade += dt;
      if (signFade > 1.2) signFade = null;
    }
  }

  function onEvent(type, payload = {}, layout) {
    const L = layout || lastLayout;
    if (!L) return;
    if (type === 'valleyViewOpened') {
      signFade = reduced ? null : 0;
      const r = L.valley?.signpost;
      if (r && !reduced) effects?.sparkle?.({ x: r.x - 4, y: r.y, w: r.w + 8, h: r.h }, 14, 'gold', 0.1);
    } else if (type === 'wildLandGiven' || type === 'wildLandGrown') {
      const r = typeof L.wildRect === 'function' ? L.wildRect(payload.cellId) : null;
      if (r && !reduced) {
        effects?.sparkle?.({ x: r.x + T, y: r.y + T, w: r.w - 2 * T, h: r.h - 2 * T }, type === 'wildLandGiven' ? 26 : 18, 'gold', 0);
        if (type === 'wildLandGiven') for (let k = 0; k < 6; k++) effects?.dirt?.(r.x + T * 2 + k * T * 1.8, r.y + r.h / 2, 5, 1);
      }
    }
  }

  // ── Couche fixe ────────────────────────────────────────────────────────────────
  function drawStaticGround(c, layout, season) {
    if (!layout?.wildBands?.length) return;
    for (const b of layout.wildBands) {
      const { x0, y0, x1, y1 } = interior(b);
      const kind = WILD_KINDS_BY_ID[b.kind] ? b.kind : 'wood';
      // Le sol de la terre (colonnes de lisière comprises : la forêt les recouvre quand il le faut).
      for (let y = y0; y < y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (kind === 'grassland' && b.stage >= 1) continue; // l'herbe de la ferme suffit, l'herbe haute pousse dessus
          const name = wildGroundName(kind, x, y);
          draw(c, name, fb('ground', kind, name.endsWith('.1') ? 1 : 0), x * T, y * T);
        }
      }
      for (const o of wildObjects(b)) {
        const name = o.name === 'nature.oak.summer' ? seasonOak(season) : o.name;
        const f = FB_OF[o.name] || ['sprout'];
        draw(c, name, fb(...f), o.x, o.y);
      }
      draw(c, 'wildland.sign', fb('sign'), b.sign.x * T, b.sign.y * T);
    }
  }

  function drawStaticOver(c, layout) {
    if (!layout) return;
    // Forêts qu'on peut confier : un peu plus claires, et le petit poteau à feuille en bas à gauche.
    for (const w of layout.wildable || []) {
      c.fillStyle = 'rgba(206,244,170,0.12)';
      c.fillRect(w.rect.x + T, w.rect.y, w.rect.w - 2 * T, w.rect.h);
      draw(c, 'wildland.offer', fb('offer'), w.sign.x * T, w.sign.y * T);
    }
    // Étape 7 : clairières fleuries sur la forêt qui borde la ferme.
    if (view.stage >= 7) for (const t of clearingTiles(layout)) draw(c, `forest.clearing.${t.v}`, fb('clearing', t.v), t.x, t.y);
  }

  // ── Objets triés avec la scène ───────────────────────────────────────────────────
  function collect(push, viewRect) {
    drawn = 0;
    if (!enabled || !lastLayout) return;
    const r = lastLayout.valley?.signpost;
    if (r && view.open) {
      const a = signFade === null ? 1 : Math.min(1, signFade / 0.9);
      if (has('view.signpost')) push('view.signpost', r.x, r.y, r.y + r.h - 1, a < 1 ? { alpha: a } : {});
      else if (fb('signpost')) push('', r.x, r.y, r.y + r.h - 1, { img: fb('signpost'), alpha: a });
      drawn += 1;
    }
    // Visiteurs des terres reprises (décor ; 3 dans la vue au plus).
    let n = 0;
    for (const b of lastLayout.wildBands || []) {
      if (n >= 3) break;
      const id = wildVisitor(b, view.day, (sid) => view.installed.has(sid));
      if (!id) continue;
      const vx = b.rect.x + T * (3 + Math.floor(tileHash(view.day, b.col, 9) * 7));
      const vy = b.rect.y + T * (3 + Math.floor(tileHash(view.day, b.row, 10) * 5));
      if (viewRect && (vx < viewRect.x - 32 || vx > viewRect.x + viewRect.w + 32 || vy < viewRect.y - 32 || vy > viewRect.y + viewRect.h + 32)) continue;
      const frame = reduced ? 0 : Math.floor(time * 1.6 + b.col) % 2;
      const dx = reduced ? 0 : Math.round(Math.sin(time * 0.6 + b.row) * 10);
      const name = frame && has(`wild.${id}.1`) ? `wild.${id}.1` : `wild.${id}`;
      if (has(name)) push(name, vx + dx, vy, vy + T - 1, dx < 0 ? { flipX: true } : {});
      else if (fb('visitor', id, frame)) push('', vx + dx, vy, vy + T - 1, { img: fb('visitor', id, frame) });
      n += 1;
      drawn += 1;
    }
  }

  function dashed(c, r, pulse) {
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    c.globalAlpha = 0.25 * pulse;
    c.fillStyle = '#d8f8c0';
    c.fillRect(x, y, r.w, r.h);
    c.globalAlpha = 1;
    for (let d = 0; d < r.w; d += 8) {
      c.fillStyle = OUTLINE;
      c.fillRect(x + d, y, 5, 3);
      c.fillRect(x + d, y + r.h - 3, 5, 3);
      c.fillStyle = '#eafbe0';
      c.fillRect(x + d + 1, y + 1, 3, 1);
      c.fillRect(x + d + 1, y + r.h - 2, 3, 1);
    }
    for (let d = 0; d < r.h; d += 8) {
      c.fillStyle = OUTLINE;
      c.fillRect(x, y + d, 3, 5);
      c.fillRect(x + r.w - 3, y + d, 3, 5);
      c.fillStyle = '#eafbe0';
      c.fillRect(x + 1, y + d + 1, 1, 3);
      c.fillRect(x + r.w - 2, y + d + 1, 1, 3);
    }
    // Pousse dans un cercle, au centre (lisible sans la couleur).
    const cx = x + Math.floor(r.w / 2) - 16;
    const cy = y + Math.floor(r.h / 2) - 16;
    c.fillStyle = OUTLINE;
    blob(c, OUTLINE, cx + 16, cy + 16, 15);
    blob(c, pulse > 0.7 ? '#f2fbe8' : '#d8f0c8', cx + 16, cy + 16, 13);
    draw(c, 'wildland.offer', null, cx + 8, cy + 8);
    if (!has('wildland.offer')) {
      c.fillStyle = '#3d8a3c';
      c.fillRect(cx + 15, cy + 12, 3, 12);
      c.fillStyle = '#5aa040';
      c.fillRect(cx + 9, cy + 11, 6, 4);
      c.fillRect(cx + 18, cy + 9, 6, 4);
    }
  }

  function drawOverlay(c, layout) {
    if (!enabled || !wildPlacing) return;
    const L = layout || lastLayout;
    const pulse = reduced ? 1 : 0.65 + 0.35 * Math.sin(time * 4);
    for (const id of eligible) {
      const r = typeof L?.wildRect === 'function' ? L.wildRect(id) : null;
      if (!r) continue;
      dashed(c, { x: r.x + T, y: r.y + 2, w: r.w - 2 * T, h: r.h - 4 }, pulse);
    }
  }

  // ── Toucher ──────────────────────────────────────────────────────────────────────
  const inside = (r, x, y) => r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const grow = (r, m) => {
    const w = Math.max(r.w, m);
    const h = Math.max(r.h, m);
    return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
  };
  function hitTest(wx, wy, opts = {}) {
    if (!enabled || !lastLayout) return null;
    if (wildPlacing) {
      // Mode terres sauvages : seulement les cases possibles (tout le bloc).
      for (const id of eligible) {
        const r = typeof lastLayout.wildRect === 'function' ? lastLayout.wildRect(id) : null;
        if (r && inside(r, wx, wy)) return { type: 'wildCell', cellId: id };
      }
      return null;
    }
    const r = lastLayout.valley?.signpost;
    if (r && view.open && inside(grow(r, opts.minWorld || 0), wx, wy)) return { type: 'valleyView' };
    return null;
  }

  function itemRect(kind, id) {
    if (!lastLayout) return null;
    if (kind === 'signpost' || kind === 'valleyView') return lastLayout.valley?.signpost ? { ...lastLayout.valley.signpost } : null;
    if (kind === 'wildCell' || kind === 'wildLand') return typeof lastLayout.wildRect === 'function' ? lastLayout.wildRect(id) : null;
    if (kind === 'wildSign') {
      const b = (lastLayout.wildBands || []).find((x) => x.cellId === id) || (lastLayout.wildable || []).find((x) => x.cellId === id);
      return b ? { x: b.sign.x * T, y: b.sign.y * T, w: T, h: T } : null;
    }
    return null;
  }

  return {
    setImages(imgs) {
      images = imgs;
      cache.clear();
    },
    setReducedMotion(on) {
      reduced = !!on;
      if (reduced) signFade = null;
    },
    sync,
    update,
    onEvent,
    drawStaticGround,
    drawStaticOver,
    collect,
    drawOverlay,
    hitTest,
    itemRect,
    setWildPlacing(on) {
      wildPlacing = !!on;
      infoT = -1;
      if (!wildPlacing) eligible = [];
    },
    get wildPlacing() {
      return wildPlacing;
    },
    eligible: () => eligible.slice(),
    clear() {
      lastLayout = null;
      eligible = [];
      signFade = null;
      infoT = -1;
    },
    shift() {},
    stats: () => ({
      enabled,
      drawn,
      signpost: !!(view.open && lastLayout?.valley?.signpost),
      wildPlacing,
      eligible: eligible.length,
      wildBands: (lastLayout?.wildBands || []).map((b) => ({ cellId: b.cellId, kind: b.kind, stage: b.stage })),
      wildable: (lastLayout?.wildable || []).length,
      stage: view.stage,
      sprites: has('view.signpost'),
    }),
  };
}

export { SPRITES };
