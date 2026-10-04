// La Vallée vivante, lot V4 « Les cigognes », sur la carte de la ferme (docs/VALLEE.md § 18.4, § 18.7, § 18.10 ; contrat :
// docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V4 », « Ce que RENDER et UI consomment ») : les 4 cloches de
// verre des légendes devant la Grainothèque (vide, semis, en fleur, mûre avec une étincelle), la roue puis le nid de
// cigognes sur la cheminée de la maison (le couple qui claque du bec, les cigogneaux, le nid neigé l'hiver), les passages
// (2 cigognes qui planent, le vol en V des grues), les vers luisants (indice, visiteur qui attend « ? », lueurs des soirs
// d'été le long des haies), le cerf à la lisière (soir d'automne), le loriot au verger (été), l'arc-en-ciel du matin qui
// suit une pluie, une biche à la lisière de la vieille forêt ; et la forêt de la carte en 4 états (couche fixe).
//
// Repères : layout.valley.cloches, layout.valley.nest, layout.valley.library, layout.valley.spots / animalAnchors
// (src/render/layout-career.js), layout.orchards, layout.wildBands.
//
// Purs (testés par tests/valley4-ui.test.js) :
//   clocheRects(library), CLOCHE_DX, nestAnchor(houseLevel), NEST_ANCHORS (ré-exportés de layout-career.js)
//   clocheSpriteName(entry, abs) → 'legend.cloche' | 'legend.<id>.0|1|2' ; clocheStage(entry, abs) → -1 (vide) | 0 | 1 | 2
//   nestSpriteName(state) → null | 'stork.wheel' | 'stork.nest.pair' | 'stork.nest.chicks' | 'stork.nest.snow'
//   glowSpots(hedges, absDay, max = 24) → [{ x, y, ph }] (px, le long du pied des haies ; hachage pur du jour)
//   flyoverPath(kind, absDay) → null | { kind, start (avancée du jour), dur (s, ≤ 20), yFrac, dir (± 1), count }
//   rainbowBands(radius) → [{ color, r }] (5 arcs) ; forestTileName(state, tx, ty, season) → null | nom de tuile
//
// createStorksActors(effects) → actors
//   setImages(images), setReducedMotion(on), sync(game, layout, { time, dayProgress }), update(dt)
//   collect(push)                      cloches, roue / nid, cerf, loriot, vers luisants (indice et « ? »), biche
//   drawOverlay(c, layout, view)       passages (cigognes, grues), étincelles des légendes mûres
//   drawSky(c, view)                   arc-en-ciel (fixe), au-dessus de tout le monde visible
//   drawGlow(c, ox, oy, dayProgress)   lueurs des vers luisants (après l'assombrissement du soir)
//   drawForestTile(c, sheets, tx, ty, season) → bool    (couche fixe) une tuile de forêt feuillue / vieille / fougères
//   hitTest(wx, wy, { minWorld })      { type: 'seedLibrary', tab: 'legends', legendId } (cloche mûre ou à semer) |
//                                      { type: 'storkNest' } | { type: 'visitor', id: 'glowworms' } | null
//   itemRect(kind, id)                 'cloche' (legendId | index) | 'storkNest' | 'visitor' ('glowworms') | 'library'
//   forestState, hasNest, clear(), shift(dx, dy), stats()
// Rien sans la partie « storks » (state.career.valley.v ≥ 4, parts.storks / places / heritage). Mouvements réduits : rien
// ne traverse le ciel, lueurs fixes, couple immobile. Planche valley4 facultative : replis dessinés par le code.

import { TILE, SPRITES, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';
import { tileHash } from './layout-common.js';
import { CLOCHE_DX, NEST_ANCHORS, clocheRects, nestAnchor } from './layout-career.js';

export { CLOCHE_DX, NEST_ANCHORS, clocheRects, nestAnchor };

const T = TILE;
const OUTLINE = '#3f2631';
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const LEGEND_ORDER = Object.freeze(['motherMelon', 'millEinkorn', 'farmMarvel', 'storkPea']);
const INFO_S = 0.25;
const MAX_GLOW = 24;

// ── Purs ─────────────────────────────────────────────────────────────────────────────

function hash01(a, b = 0) {
  let h = 2166136261 >>> 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296;
}

/** Stade d'une cloche : -1 vide (ou légende endormie), 0 semis, 1 en fleur (à mi-pousse), 2 mûre. */
export function clocheStage(entry, abs) {
  if (!entry) return -1;
  if (entry.ripe) return 2;
  const total = Math.max(1, (entry.readyAt ?? 0) - (entry.sownAt ?? 0));
  const k = ((abs ?? 0) - (entry.sownAt ?? 0)) / total;
  if (Number.isFinite(entry.readyAt) && abs >= entry.readyAt) return 2;
  return k >= 0.5 ? 1 : 0;
}

/** Sprite d'une cloche (état cloches[id] du cœur). */
export function clocheSpriteName(id, entry, abs) {
  const st = clocheStage(entry, abs);
  return st < 0 ? 'legend.cloche' : `legend.${id}.${st}`;
}

/** Sprite du nid selon valleyScenery().nest (null : rien sur la cheminée). */
export function nestSpriteName(nest) {
  if (!nest || !nest.state) return null;
  if (nest.state === 'pair') return 'stork.nest.pair';
  if (nest.state === 'chicks') return 'stork.nest.chicks';
  if (nest.state === 'snow') return 'stork.nest.snow';
  return 'stork.wheel';
}

/**
 * Lueurs des vers luisants le long du pied des haies (px du monde) : 24 au plus, réparties entre les haies, positions
 * tirées par un hachage pur du jour (elles changent un peu chaque soir, jamais d'une image à l'autre).
 * @param hedges [{ x, y, w, h }] rectangles des haies posées (px)
 */
export function glowSpots(hedges, absDay, max = MAX_GLOW) {
  const list = (hedges || []).filter((r) => r && r.w > 0 && r.h > 0);
  if (!list.length) return [];
  const per = Math.max(1, Math.floor(max / list.length));
  const out = [];
  list.forEach((r, i) => {
    for (let k = 0; k < per && out.length < max; k++) {
      const u = hash01(`${absDay}`, `g${i}.${k}`);
      const v = hash01(`${absDay}`, `h${i}.${k}`);
      // Au pied de la haie, un peu de part et d'autre (la haie est une colonne de tuiles).
      const x = Math.round(r.x + (v < 0.5 ? -3 - v * 6 : r.w + 1 + (v - 0.5) * 6));
      const y = Math.round(r.y + 4 + u * Math.max(1, r.h - 8));
      out.push({ x, y, ph: hash01(i, k) * Math.PI * 2 });
    }
  });
  return out;
}

/**
 * Un passage du jour (cigognes ou grues) : une fois par jour, à une heure tirée du jour (hachage pur), une traversée
 * droite de l'écran en ≤ 20 s. null si aucun passage.
 */
export function flyoverPath(kind, absDay) {
  if (kind !== 'storks' && kind !== 'cranes') return null;
  const u = hash01(absDay, kind);
  const v = hash01(kind, absDay);
  return {
    kind,
    start: Math.round((0.2 + u * 0.45) * 1000) / 1000,
    dur: kind === 'cranes' ? 18 : 16,
    yFrac: Math.round((0.12 + v * 0.26) * 1000) / 1000,
    dir: v < 0.5 ? -1 : 1,
    count: kind === 'cranes' ? 1 : 2,
  };
}

/** Les 5 arcs de l'arc-en-ciel (du plus grand au plus petit), 2 px chacun. */
export function rainbowBands(radius) {
  const colors = ['#e8483a', '#f29a3a', '#f2d23a', '#6ac05a', '#4a8ae8'];
  return colors.map((color, i) => ({ color, r: Math.max(4, Math.round(radius) - i * 2) }));
}

const MIXED = ['forest.mixed.oak', 'forest.mixed.beech', 'forest.mixed.birch', 'forest.mixed.cherry'];
const DECIDUOUS = [0, 0.2, 0.4, 0.6];

/**
 * Tuile de forêt feuillue (ou vieille, ou fougères à l'état 3) pour une tuile pleine de la forêt de la carte, ou null
 * (la forêt d'avant). Déterministe (tileHash), une tuile sur 5 à l'état 1, deux à l'état 2, trois à l'état 3.
 */
export function forestTileName(state, tx, ty, season = 'summer') {
  const n = Math.max(0, Math.min(3, Math.floor(state || 0)));
  if (!n) return null;
  if (tileHash(tx, ty, 401) >= DECIDUOUS[n]) return null;
  const h = tileHash(tx, ty, 409);
  if (n === 3) {
    if (h < 0.12) return h < 0.06 ? 'forest.old.0' : 'forest.old.1';
    if (h < 0.2) return 'forest.fern';
  }
  const name = MIXED[Math.floor(tileHash(tx, ty, 419) * MIXED.length) % MIXED.length];
  if (name === 'forest.mixed.cherry' && season === 'spring') return 'forest.mixed.cherry.bloom';
  return name;
}

// ── Replis dessinés ─────────────────────────────────────────────────────────────────

function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (draw) draw(g);
  return c;
}
const R = (g, x, y, w, h, color) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};

const LEGEND_COLORS = { motherMelon: ['#9aa88a', '#f2a03a'], millEinkorn: ['#7ab84a', '#e8c04a'], farmMarvel: ['#5aa040', '#e8483a'], storkPea: ['#6ac05a', '#9ad06a'] };

const FALLBACK = {
  cloche: (id, st) =>
    makeCanvas(8, 12, (g) => {
      R(g, 0, 10, 8, 2, '#a8683a');
      if (st >= 0) {
        const [leaf, fruit] = LEGEND_COLORS[id] || ['#6ac05a', '#e8c04a'];
        R(g, 3, 8 - st, 2, 2 + st, leaf);
        if (st >= 1) R(g, st === 2 ? 2 : 3, 4, st === 2 ? 4 : 2, st === 2 ? 3 : 2, st === 2 ? fruit : '#f2e05a');
      }
      g.fillStyle = 'rgba(220,240,255,0.45)';
      g.fillRect(1, 2, 6, 8);
      R(g, 2, 1, 4, 1, '#5a88a8');
      R(g, 1, 2, 1, 8, '#5a88a8');
      R(g, 6, 2, 1, 8, '#5a88a8');
      R(g, 2, 2, 1, 2, '#ffffff');
    }),
  wheel: () =>
    makeCanvas(24, 12, (g) => {
      R(g, 11, 6, 2, 6, '#6a4a32');
      R(g, 2, 3, 20, 4, OUTLINE);
      R(g, 3, 4, 18, 2, '#b8864a');
    }),
  nest: (kind) =>
    makeCanvas(24, 20, (g) => {
      R(g, 11, 14, 2, 6, '#6a4a32');
      R(g, 1, 9, 22, 6, OUTLINE);
      R(g, 2, 10, 20, 4, '#8a6a42');
      if (kind === 'snow') R(g, 2, 9, 20, 2, '#f4f8fb');
      if (kind === 'pair') {
        for (const x of [6, 14]) {
          R(g, x, 1, 3, 9, '#f4f4f0');
          R(g, x - 2, 2, 2, 1, '#d8382a');
          R(g, x + 1, 6, 2, 3, '#202020');
        }
      }
      if (kind === 'chicks') {
        R(g, 6, 1, 3, 9, '#f4f4f0');
        R(g, 4, 2, 2, 1, '#d8382a');
        for (const x of [12, 15, 18]) R(g, x, 6, 2, 3, '#c8c8c0');
      }
    }),
  stork: (frame) =>
    makeCanvas(32, 16, (g) => {
      const up = frame ? 1 : 0;
      R(g, 2, 7 - up, 12, 2, '#202020');
      R(g, 18, 7 - up, 12, 2, '#202020');
      R(g, 6, 6, 20, 3, '#f4f4f0');
      R(g, 2, 7, 4, 1, '#d8382a');
      R(g, 26, 8, 5, 1, '#d8382a');
    }),
  flock: (frame) =>
    makeCanvas(48, 16, (g) => {
      g.fillStyle = '#4a4a5a';
      const pts = [[4, 2], [10, 5], [16, 8], [22, 11], [28, 8], [34, 5], [40, 2]];
      for (const [x, y] of pts) {
        g.fillRect(x, y + (frame ? 1 : 0), 3, 1);
        g.fillRect(x + 1, y + 1 - (frame ? 1 : 0), 1, 1);
      }
    }),
  deer: () =>
    makeCanvas(32, 32, (g) => {
      R(g, 8, 14, 16, 8, '#a8582a');
      R(g, 6, 8, 5, 8, '#a8582a');
      for (const x of [9, 12, 19, 22]) R(g, x, 22, 2, 8, '#6a3a1a');
      R(g, 4, 2, 1, 7, '#e8d0a0');
      R(g, 9, 2, 1, 7, '#e8d0a0');
    }),
  oriole: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 4, 7, 8, 5, OUTLINE);
      R(g, 5, 8, 6, 3, '#f2c81a');
      R(g, 8, 8, 3, 2, '#202020');
      R(g, 3, 9, 2, 1, '#d87a3a');
    }),
  glowworm: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 7, 6, 1, 9, '#5a9a3a');
      R(g, 5, 12, 5, 2, '#3a3a2a');
      R(g, 9, 12, 2, 2, '#d8f87a');
    }),
  glow: (f) =>
    makeCanvas(8, 8, (g) => {
      R(g, 3, 3, 2, 2, f ? '#d8ff8a' : '#b8ec5a');
      if (f) {
        R(g, 3, 2, 2, 1, 'rgba(216,255,138,0.6)');
        R(g, 2, 3, 1, 2, 'rgba(216,255,138,0.6)');
      }
    }),
  halo: () =>
    makeCanvas(16, 16, (g) => {
      const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grd.addColorStop(0, 'rgba(210,255,120,0.75)');
      grd.addColorStop(0.45, 'rgba(170,240,80,0.28)');
      grd.addColorStop(1, 'rgba(150,230,60,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 16, 16);
    }),
  hint: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 7, 6, 1, 9, '#5a9a3a');
      R(g, 8, 13, 2, 2, '#b8ec5a');
    }),
  question: () =>
    makeCanvas(9, 11, (g) => {
      R(g, 0, 0, 9, 9, OUTLINE);
      R(g, 1, 1, 7, 7, '#fffbe8');
      R(g, 3, 9, 3, 2, OUTLINE);
      g.fillStyle = OUTLINE;
      for (const [x, y] of [[3, 2], [4, 2], [5, 2], [5, 3], [4, 4], [4, 6]]) g.fillRect(x, y, 1, 1);
    }),
  doe: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 4, 7, 9, 5, '#b8683a');
      R(g, 2, 3, 4, 6, '#b8683a');
      for (const x of [5, 11]) R(g, x, 12, 1, 4, '#6a3a1a');
    }),
  sparkle: () =>
    makeCanvas(5, 5, (g) => {
      R(g, 2, 0, 1, 5, '#fff6b0');
      R(g, 0, 2, 5, 1, '#fff6b0');
      R(g, 2, 2, 1, 1, '#ffffff');
    }),
};

/** Recoloration d'une tuile feuillue pour l'automne (roux et or) ou l'hiver (branches nues). */
function recolorSeason(src, season) {
  const w = src.width;
  const h = src.height;
  const cv = makeCanvas(w, h);
  if (!cv) return src;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const data = g.getImageData(0, 0, w, h);
  const d = data.data;
  const AUT = [[122, 58, 34], [184, 88, 42], [216, 134, 46], [232, 184, 58]];
  const WIN = [[78, 66, 60], [104, 92, 84], [134, 124, 116], [160, 152, 146]];
  const pal = season === 'autumn' ? AUT : WIN;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i];
    const gg = d[i + 1];
    const b = d[i + 2];
    if (gg > r + 8 && gg >= b) {
      const lum = (r + gg + b) / 3;
      const k = Math.max(0, Math.min(3, Math.floor(lum / 64)));
      d[i] = pal[k][0];
      d[i + 1] = pal[k][1];
      d[i + 2] = pal[k][2];
    }
  }
  g.putImageData(data, 0, 0);
  return cv;
}

// ── Acteurs ──────────────────────────────────────────────────────────────────────────

export function createStorksActors(effects) {
  let images = null;
  let reduced = false;
  let enabled = false;
  let lastLayout = null;
  let time = 0;
  let infoT = -1;
  const cache = new Map();
  const tileCache = new Map();
  const info = {
    on: false, abs: 0, season: 'spring', dayProgress: 0.5, library: 0, legends: {}, cloches: {}, scenery: null, nestShown: false,
    animals: [], hedges: [], forestState: 0, orchard: null, deerAt: null, doeAt: null,
  };
  const sparks = []; // étincelles des cloches mûres
  let flight = null; // { kind, t, dur, dir, yFrac, count }
  let flownKey = '';
  let clatter = 0; // s restantes du claquement de bec (couple sur le nid)
  let clatterIn = 3;
  let drawn = 0;
  let forceForest = null; // (débogage) état de la forêt imposé

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
  /** Le V4 est-il actif dans cette carrière (lecture de l'état, comme storksOn du cœur) ? */
  function storksOnState(st) {
    const v = st?.career?.valley;
    if (!v || !v.started) return false;
    const p = v.parts || {};
    return (v.v || 1) >= 4 && p.storks !== false && p.places !== false && p.heritage !== false;
  }

  // ── Synchronisation ─────────────────────────────────────────────────────────
  function sync(game, layout, opts = {}) {
    lastLayout = layout;
    time = opts.time ?? time;
    const st = game?.state;
    enabled = !!(game && game.mode === 'career' && storksOnState(st));
    if (!enabled) {
      info.on = false;
      info.scenery = null;
      info.forestState = 0;
      return;
    }
    info.on = true;
    if (opts.dayProgress !== undefined) info.dayProgress = opts.dayProgress;
    if (infoT >= 0 && time - infoT < INFO_S) return;
    infoT = time;
    const v = st.career.valley;
    info.abs = (st.time.year - 1) * 4 * st.career.seasonLength + st.time.day;
    info.season = SEASONS[((st.time.seasonIndex ?? 0) % 4 + 4) % 4];
    info.library = Math.max(0, Math.floor(v.library?.level || 0));
    info.legends = v.legends || {};
    info.cloches = v.cloches || {};
    info.scenery = typeof game.query.career?.valleyScenery === 'function' ? safe(() => game.query.career.valleyScenery(), null) : null;
    info.forestState = forceForest ?? info.scenery?.forestState ?? 0;
    // La roue paraît après le chapitre 8 (« Merci, Joseph ») ; ensuite elle reste.
    info.nestShown = !!(v.stork?.farmSince || (v.chapters?.read || []).includes(8));
    const all = typeof game.query.career?.valleyAnimals === 'function' ? safe(() => game.query.career.valleyAnimals(), []) || [] : [];
    info.animals = all.filter((a) => a.visitor);
    const spots = layout?.valley?.spots || {};
    info.hedges = Object.entries(v.nature || {}).filter(([, n]) => n?.kind === 'hedge').map(([id]) => spots[id]).filter(Boolean);
    const o = (layout?.orchards || [])[0];
    info.orchard = o?.rect ? { x: (o.rect.x + 3) * T, y: (o.rect.y + 1) * T } : null;
    // Le cerf : au bord d'une terre sauvage « bois », sinon à la lisière gauche d'une haie de la ferme (dans la forêt).
    const wood = (layout?.wildBands || []).find((b) => b.kind === 'wood' && b.rect);
    if (wood) info.deerAt = { x: wood.rect.x + 2 * T, y: wood.rect.y + wood.rect.h - 3 * T };
    else {
      const hl = Object.entries(spots).filter(([id, r]) => /hedgeL$/.test(id) && r).map(([, r]) => r).sort((a, b) => a.y - b.y)[0];
      info.deerAt = hl ? { x: hl.x - 26, y: hl.y + Math.round(hl.h / 2) } : null;
    }
    // La biche de la vieille forêt (état 3) : une tuile de lisière, un jour sur trois.
    info.doeAt = null;
    if (info.forestState >= 3 && hash01(info.abs, 'doe') < 0.34 && typeof layout?.isForest === 'function') {
      const hl = Object.entries(spots).filter(([id, r]) => /hedgeR$/.test(id) && r).map(([, r]) => r);
      const pick = hl[Math.floor(hash01(info.abs, 'doeAt') * hl.length)];
      if (pick) info.doeAt = { x: pick.x + T + 6, y: pick.y + Math.floor(pick.h / 3) };
    }
    // Passage du jour (cigognes ou grues) : une fois, quand l'heure tirée est passée.
    const fly = flyoverPath(info.scenery?.flyover, info.abs);
    const key = `${info.abs}|${fly?.kind || '-'}`;
    if (fly && !reduced && flownKey !== key && info.dayProgress >= fly.start && info.dayProgress < fly.start + 0.25) {
      flownKey = key;
      flight = { ...fly, t: 0 };
    }
    if (!fly) flownKey = key;
  }

  function update(dt) {
    if (!enabled) return;
    const d = Math.max(0, Math.min(0.1, dt || 0));
    if (flight) {
      flight.t += d;
      if (flight.t >= flight.dur) flight = null;
    }
    if (!reduced && info.scenery?.nest?.state === 'pair') {
      if (clatter > 0) clatter -= d;
      else if ((clatterIn -= d) <= 0) {
        clatter = 1.3;
        clatterIn = 5 + hash01(time, 'cl') * 6;
      }
    } else clatter = 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      sparks[i].t += d;
      if (sparks[i].t > 1) sparks.splice(i, 1);
    }
  }

  // ── Dessin ──────────────────────────────────────────────────────────────────
  function P(push, name, fb, x, y, sortY, opts = {}) {
    drawn += 1;
    if (name && has(name)) return push(name, Math.round(x), Math.round(y), sortY, opts);
    const img = typeof fb === 'function' ? fb() : fb;
    if (img) return push('', Math.round(x), Math.round(y), sortY, { ...opts, img });
    return null;
  }

  function clocheList() {
    const rects = lastLayout?.valley?.cloches || [];
    if (!rects.length || info.library < 1) return [];
    return LEGEND_ORDER.map((id, i) => ({ id, i, rect: rects[i], entry: info.legends[id] ? info.cloches[id] || null : null, awake: !!info.legends[id] })).filter((c) => c.rect);
  }

  function collect(push) {
    drawn = 0;
    if (!enabled || !lastLayout) return;
    // Cloches des légendes (par-dessus le bas de la Grainothèque).
    const lib = lastLayout.valley?.library;
    for (const c of clocheList()) {
      const st = clocheStage(c.entry, info.abs);
      const name = clocheSpriteName(c.id, c.entry, info.abs);
      P(push, name, () => fallback('cloche', c.id, st), c.rect.x, c.rect.y, (lib ? lib.y + lib.h : c.rect.y + c.rect.h) - 0.5 + c.i * 0.01);
    }
    // Roue et nid sur la cheminée (le pied du sprite au haut de la cheminée).
    const nest = lastLayout.valley?.nest;
    const sc = info.scenery;
    if (nest && sc?.nest && info.nestShown) {
      const name = nestSpriteName(sc.nest);
      const isWheel = name === 'stork.wheel';
      const w = 24;
      const h = isWheel ? 12 : 20;
      const x = nest.x - 12;
      const y = nest.y - h;
      const sortY = nest.houseRect.y + nest.houseRect.h + 0.2;
      const kind = isWheel ? 'wheel' : sc.nest.state;
      if (clatter > 0 && name === 'stork.nest.pair' && has(name) && images) {
        // Claquement de bec : le haut du sprite (les têtes) monte d'un pixel, par à-coups.
        const up = Math.floor(clatter * 8) % 2;
        P(push, name, null, x, y, sortY);
        if (up) {
          const s = SPRITES[name];
          const cv = cache.get('clatterTop') || makeCanvas(w, 9);
          cache.set('clatterTop', cv);
          if (cv) {
            const g = cv.getContext('2d');
            g.clearRect(0, 0, w, 9);
            g.drawImage(images[s.sheet], s.col * T, s.row * T, w, 9, 0, 0, w, 9);
            push('', Math.round(x), Math.round(y - 1), sortY + 0.01, { img: cv });
          }
        }
      } else P(push, name, () => fallback(isWheel ? 'wheel' : 'nest', kind), x, y, sortY);
    }
    if (sc) {
      const dusk = info.dayProgress >= 0.6;
      // Le cerf, le soir d'automne, au bord du bois (regard vers la gauche : retourné s'il est à gauche de la ferme).
      if (sc.deer && dusk && info.deerAt) {
        const f = !reduced && Math.sin(time * 0.5) > 0.85 ? 1 : 0;
        P(push, f && has('visitor.redDeer.1') ? 'visitor.redDeer.1' : 'visitor.redDeer', () => fallback('deer'), info.deerAt.x - 16, info.deerAt.y - 30, info.deerAt.y + 1, { flipX: true });
      }
      // Le loriot, l'été, en haut d'un pommier du verger.
      if (sc.oriole && info.orchard) {
        const f = !reduced && Math.sin(time * 1.7) > 0.6 ? 1 : 0;
        P(push, f && has('visitor.oriole.1') ? 'visitor.oriole.1' : 'visitor.oriole', () => fallback('oriole'), info.orchard.x, info.orchard.y - 6, info.orchard.y + 40);
      }
    }
    // La biche à la lisière de la vieille forêt.
    if (info.doeAt) P(push, has('wild.roeDeer') ? 'wild.roeDeer' : null, () => fallback('doe'), info.doeAt.x, info.doeAt.y - 16, info.doeAt.y, {});
    // Vers luisants : indice du matin, puis visiteur qui attend (« ? » dessiné par drawOverlay).
    const anchors = lastLayout.valley?.animalAnchors || {};
    for (const a of info.animals) {
      const p = anchors[a.spotId];
      if (!p) continue;
      if (a.state === 'hint') P(push, has(a.hintIcon) ? a.hintIcon : 'visitor.hint.glow', () => fallback('hint'), p.x - 8, p.y - 12, p.y - 0.5);
      else if (a.state === 'visible') P(push, 'visitor.glowworms', () => fallback('glowworm'), p.x - 8, p.y - 15, p.y + 0.5);
    }
  }

  function drawImg(c, name, fb, x, y, alpha = 1, opts) {
    if (alpha <= 0) return;
    if (alpha !== 1) c.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (name && has(name)) drawSprite(c, images, name, Math.round(x), Math.round(y), opts);
    else {
      const img = fb ? (typeof fb === 'function' ? fb() : fb) : null;
      if (img) {
        if (opts?.flipX) {
          c.save();
          c.translate(Math.round(x) + img.width, Math.round(y));
          c.scale(-1, 1);
          c.drawImage(img, 0, 0);
          c.restore();
        } else c.drawImage(img, Math.round(x), Math.round(y));
      }
    }
    if (alpha !== 1) c.globalAlpha = 1;
  }

  function drawOverlay(c, layout, view) {
    if (!enabled || !layout) return;
    // Étincelles des légendes mûres (fixes en mouvements réduits).
    for (const cl of clocheList()) {
      if (clocheStage(cl.entry, info.abs) !== 2) continue;
      const on = reduced ? true : Math.sin(time * 3 + cl.i * 1.7) > 0.3;
      if (on) drawImg(c, null, () => fallback('sparkle'), cl.rect.x + 5, cl.rect.y - 1);
    }
    // « ? » au-dessus des vers luisants qui attendent.
    const anchors = layout.valley?.animalAnchors || {};
    for (const a of info.animals) {
      if (a.state !== 'visible') continue;
      const p = anchors[a.spotId];
      if (!p) continue;
      const bob = reduced ? 0 : Math.round(Math.sin(time * 3) * 1.5);
      drawImg(c, null, () => fallback('question'), p.x - 4, p.y - 28 + bob);
    }
    // Passages (au-dessus de la partie visible du monde).
    if (flight && view && !reduced) {
      const k = flight.t / flight.dur;
      const frame = Math.floor(time * (flight.kind === 'cranes' ? 3 : 2)) % 2;
      const span = view.w + 120;
      const x = flight.dir > 0 ? view.x - 60 + k * span : view.x + view.w + 60 - k * span;
      const y = view.y + Math.round(view.h * flight.yFrac);
      if (flight.kind === 'cranes') {
        drawImg(c, frame ? 'visitor.crane.flock.1' : 'visitor.crane.flock', () => fallback('flock', frame), x - 24, y, 1, flight.dir > 0 ? { flipX: true } : undefined);
      } else {
        for (let i = 0; i < flight.count; i++) {
          const dy = i * 14 + Math.round(Math.sin(time * 0.8 + i) * 3);
          const dx = i * -26 * flight.dir;
          drawImg(c, (frame + i) % 2 ? 'visitor.whiteStork.fly.1' : 'visitor.whiteStork.fly', () => fallback('stork', (frame + i) % 2), x + dx - 16, y + dy, 1, flight.dir > 0 ? { flipX: true } : undefined);
        }
      }
    }
  }

  /** Arc-en-ciel du matin qui suit une pluie (5 arcs, alpha 0,35, fixe ; s'efface vers midi). */
  function drawSky(c, view) {
    if (!enabled || !view || !info.scenery?.rainbow) return;
    const a = info.dayProgress < 0.35 ? 0.35 : Math.max(0, 0.35 * (1 - (info.dayProgress - 0.35) / 0.2));
    if (a <= 0) return;
    const radius = Math.max(40, Math.round(view.w * 0.42));
    const key = `rainbow|${radius}`;
    let cv = cache.get(key);
    if (!cv) {
      cv = makeCanvas(radius * 2 + 2, radius + 2, (g) => {
        for (const b of rainbowBands(radius)) {
          g.fillStyle = b.color;
          for (let dx = -b.r; dx <= b.r; dx++) {
            const yy = Math.round(Math.sqrt(Math.max(0, b.r * b.r - dx * dx)));
            g.fillRect(radius + 1 + dx, radius + 1 - yy, 1, 2);
          }
        }
      });
      cache.set(key, cv);
    }
    if (!cv) return;
    c.globalAlpha = a;
    c.drawImage(cv, Math.round(view.x + view.w / 2 - radius - 1), Math.round(view.y + view.h * 0.08));
    c.globalAlpha = 1;
  }

  /** Lueurs des vers luisants (soirs d'été, visiteur vu) : halos additifs + points, après l'assombrissement du soir. */
  function drawGlow(c, ox, oy, dayProgress) {
    if (!enabled || !info.scenery?.glow || (dayProgress ?? info.dayProgress) < 0.75) return;
    const pts = glowSpots(info.hedges, info.abs);
    if (!pts.length) return;
    const halo = fallback('halo');
    const prev = c.globalCompositeOperation;
    c.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(time * 2.2 + p.ph);
      if (tw <= 0.1) continue;
      c.globalAlpha = tw;
      if (halo) c.drawImage(halo, Math.round(p.x + ox - 8), Math.round(p.y + oy - 8));
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = prev;
    for (const p of pts) {
      const f = reduced ? 1 : Math.sin(time * 2.2 + p.ph) > 0.2 ? 1 : 0;
      drawImg(c, f ? 'fx.glow.1' : 'fx.glow', () => fallback('glow', f), p.x + ox - 4, p.y + oy - 4);
    }
  }

  /** (Couche fixe) Tuile pleine de forêt feuillue / vieille / fougères ; renvoie vrai si elle a été dessinée. */
  function drawForestTile(c, sheets, tx, ty, season) {
    const name = forestTileName(info.forestState, tx, ty, season);
    if (!name || !canDraw(sheets, name)) return false;
    if (season === 'autumn' || season === 'winter') {
      const key = `${name}|${season}`;
      let cv = tileCache.get(key);
      if (cv === undefined) {
        const src = makeCanvas(T, T, (g) => drawSprite(g, sheets, name, 0, 0));
        cv = src ? recolorSeason(src, season) : null;
        tileCache.set(key, cv);
      }
      if (cv) {
        c.drawImage(cv, tx * T, ty * T);
        return true;
      }
    }
    drawSprite(c, sheets, name, tx * T, ty * T);
    return true;
  }

  // ── Toucher ───────────────────────────────────────────────────────────────────
  const grow = (r, m) => {
    if (!r) return null;
    const w = Math.max(r.w, m);
    const h = Math.max(r.h, m);
    return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h };
  };
  const inside = (r, x, y) => r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

  function nestRect() {
    const nest = lastLayout?.valley?.nest;
    if (!nest || !info.scenery?.nest || !info.nestShown) return null;
    const h = info.scenery.nest.state === 'wheel' ? 12 : 20;
    return { x: nest.x - 12, y: nest.y - h, w: 24, h };
  }
  function glowRect() {
    const a = info.animals.find((x) => x.state === 'visible');
    const p = a ? lastLayout?.valley?.animalAnchors?.[a.spotId] : null;
    return p ? { x: p.x - 8, y: p.y - 16, w: 16, h: 16 } : null;
  }

  function hitTest(wx, wy, opts = {}) {
    if (!enabled || !lastLayout) return null;
    const m = opts.minWorld || 0;
    const g = glowRect();
    if (g && inside(grow(g, m), wx, wy)) return { type: 'visitor', id: 'glowworms' };
    // Une cloche mûre ou à semer : la Grainothèque s'ouvre sur le segment « Légendes ».
    const list = clocheList();
    const want = list.filter((c) => c.awake && (clocheStage(c.entry, info.abs) === 2 || !c.entry));
    if (want.length) {
      const zone = list.reduce((a, c) => (a ? { x: Math.min(a.x, c.rect.x), y: Math.min(a.y, c.rect.y), w: Math.max(a.x + a.w, c.rect.x + c.rect.w) - Math.min(a.x, c.rect.x), h: c.rect.h } : { ...c.rect }), null);
      if (zone && inside(grow(zone, m), wx, wy)) {
        let best = want[0];
        let bd = Infinity;
        for (const c of want) {
          const d = Math.abs(wx - (c.rect.x + c.rect.w / 2));
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
        return { type: 'seedLibrary', tab: 'legends', legendId: best.id };
      }
    }
    const n = nestRect();
    if (n && inside(grow(n, m), wx, wy)) return { type: 'storkNest' };
    return null;
  }

  function itemRect(kind, id) {
    if (!lastLayout) return null;
    if (kind === 'storkNest') return nestRect();
    if (kind === 'visitor' && (id === 'glowworms' || id == null)) return glowRect();
    if (kind === 'cloche') {
      const rects = lastLayout.valley?.cloches || [];
      const i = typeof id === 'number' ? id : Math.max(0, LEGEND_ORDER.indexOf(id));
      return rects[i] ? { ...rects[i] } : null;
    }
    if (kind === 'cloches') {
      const rects = lastLayout.valley?.cloches || [];
      if (!rects.length) return null;
      const a = rects[0];
      const b = rects[rects.length - 1];
      return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h };
    }
    return null;
  }

  function onEvent(type, payload) {
    if (!enabled || !lastLayout) return;
    if (type === 'legendRipe' || type === 'legendSown' || type === 'legendHarvested') {
      infoT = -1;
      const i = LEGEND_ORDER.indexOf(payload?.id);
      const r = (lastLayout.valley?.cloches || [])[i];
      if (r && !reduced) effects?.sparkle?.({ x: r.x, y: r.y, w: r.w, h: r.h }, type === 'legendHarvested' ? 10 : 6, 'gold', 0);
    }
    if (type === 'storksArrived' || type === 'storkWheelPlaced' || type === 'storkChicks' || type === 'storksLeft' || type === 'chapterRead' || type === 'valleyStage') infoT = -1;
    if (type === 'storksArrived' && payload?.where === 'farm' && !reduced) {
      flight = { ...flyoverPath('storks', info.abs), t: 0 };
    }
  }

  return {
    setImages(i) {
      images = i;
      cache.clear();
      tileCache.clear();
    },
    setReducedMotion(on) {
      reduced = !!on;
      if (reduced) {
        flight = null;
        clatter = 0;
      }
    },
    sync,
    update,
    collect,
    drawOverlay,
    drawSky,
    drawGlow,
    drawForestTile,
    hitTest,
    itemRect,
    onEvent,
    /** (Débogage) Impose un état de la forêt (0..3) ; null : celui du jeu. */
    forceForest(n) {
      forceForest = n === null || n === undefined ? null : Math.max(0, Math.min(3, Math.floor(n)));
      infoT = -1;
    },
    /** Re-lit l'état à la prochaine image (événement du jeu, débogage). */
    touch() {
      infoT = -1;
    },
    get forestState() {
      return enabled ? info.forestState : 0;
    },
    get hasNest() {
      return enabled && !!info.scenery?.nest && info.nestShown;
    },
    get enabled() {
      return enabled;
    },
    clear() {
      flight = null;
      sparks.length = 0;
      infoT = -1;
    },
    shift() {
      infoT = -1;
    },
    stats: () => ({
      enabled, forestState: info.forestState, library: info.library, cloches: clocheList().map((c) => ({ id: c.id, stage: clocheStage(c.entry, info.abs), awake: c.awake })),
      nest: info.scenery?.nest || null, nestShown: info.nestShown, flight: flight ? { kind: flight.kind, t: Math.round(flight.t * 10) / 10 } : null,
      scenery: info.scenery, glow: info.scenery?.glow ? glowSpots(info.hedges, info.abs).length : 0, visitors: info.animals.map((a) => ({ id: a.id, state: a.state, spotId: a.spotId })), drawn,
    }),
  };
}
