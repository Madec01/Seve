// La Vallée vivante (lot V1 « La boîte en fer ») dans la scène de la carrière (docs/VALLEE.md § 4 à § 10 ; contrat :
// docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V1 », « Ce que RENDER et UI consomment ») : aménagements nature
// posés sur leurs emplacements (haies raccordées par saison, bandes fleuries, nichoirs, nichoir à chouette, tas de bois,
// hôtels à insectes, chêne qui grandit, berges plantées), parcelles en jachère fleurie, étiquette des planches d'essai,
// bêtes (indice du matin, bête qui ATTEND avec une étincelle « ? », habitants en promenade douce), cueillette des haies,
// boîte en fer du perron, emplacements qui pulsent en mode aménagement, lisière fleurie, oiseaux et papillons selon l'étape.
//
// Repères : layout.valley (src/render/layout-career.js, careerValleySpots) — { spots: { [spotId]: rect }, box, animalAnchors }.
//
// Purs (testés par tests/valley-render.test.js) :
//   oakStage(state, entry) → 'sapling' | 'young' | 'adult'
//   hedgeTileName(season, row, h), stripTileName(season, k), oakSpriteName(stage, season), fallowSpriteName(season)
//   edgeFlowersOn(stage, season), birdsPerMinute(stage, reduced), butterfliesOn(stage, season, reduced)
//   edgeTiles(layout) → [{ x, y, v }] (px, tuiles de forêt voisines du sol de la ferme, une sur ~3, déterministe)
//   findRect(spotRect, findId) → rect (px) d'une trouvaille sur sa haie
//   growRect(r, minWorld) → rect agrandi pour le doigt
//
// createValleyActors(effects) → actors
//   setImages(images), setReducedMotion(on), setStage(n), setPlacing(kind | null), placing
//   sync(game, layout, { time })      état (state.career.valley) et requêtes (au plus 4 fois par seconde)
//   onEvent(type, payload, layout)    naturePlaced, speciesHint, speciesVisible, speciesInstalled, hedgeFinds, hedgePicked,
//                                     heirloomHarvest, heirloomFixed, heirloomSown, jarOpened, valleyStarted, fallowSown,
//                                     fallowEnded, valleyStage, harvested
//   update(dt)
//   drawGround(c, layout, view)       au sol, après les parcelles : jachères, bandes fleuries, berges, indices
//   collect(push)                     objets triés avec la scène : haies, nichoirs, tas, hôtels, chênes, bêtes, boîte
//   drawOverlay(c, layout)            étiquettes, « ? », emplacements du mode aménagement, lisière, oiseaux, papillons
//   hitTest(wx, wy, slop, { minWorld }) { type: 'wildlife', id } | { type: 'hedgeFind', id } | { type: 'valleyBox' } |
//                                     { type: 'natureSpot', spotId } (mode aménagement : SEULEMENT celles-ci) | null
//   itemRect(kind, id), placingSpots(), clear(), shift(dx, dy), stats()
//
// Rien n'est dessiné sans state.career.valley commencée. Sprite absent (planche valley1 facultative) → repli dessiné une
// fois sur un petit canvas. Mouvements réduits : rien ne traverse le ciel, fleurs et bêtes immobiles, apparitions en fondu.

import { TILE, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';
import { VARIETIES_BY_ID } from '../data/career/valley.js';

const T = TILE;
const OUTLINE = '#3f2631';
const INFO_S = 0.25;
const GROW_S = 0.9;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const WILD_COLORS = {
  robin: ['#a0603a', '#e0663a'], hedgehog: ['#7a5a40', '#c9a27a'], ladybird: ['#d8322a', '#2a2026'], bumblebee: ['#e8b82a', '#2a2026'],
  butterfly: ['#d8562a', '#3a5ac8'], swallow: ['#2a3a6a', '#f2ece0'], tawnyOwl: ['#8a5a32', '#e8d0a0'], frog: ['#b8763a', '#6a8a3a'],
  dragonfly: ['#3a8ae8', '#a8e0f8'], hare: ['#a8865a', '#e8d8b8'], squirrel: ['#c8582a', '#f0c890'], jay: ['#b88a6a', '#3a6ae8'],
};

// ── Purs ─────────────────────────────────────────────────────────────────────────────

function hash(a, b = 0) {
  let h = 2166136261 >>> 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296;
}

/** Stade d'un chêne isolé posé (jeune arbre après 1 saison, adulte après 2 ; saisons absolues). */
export function oakStage(state, entry) {
  if (!entry || !state?.time || !state.career) return 'sapling';
  const L = state.career.seasonLength || 7;
  const now = (state.time.year - 1) * 4 + state.time.seasonIndex;
  const age = now - Math.floor(((entry.at || 1) - 1) / L);
  return age >= 2 ? 'adult' : age >= 1 ? 'young' : 'sapling';
}

/** Tuile d'une haie verticale de h tuiles (haut, milieu répétable, bas). */
export function hedgeTileName(season, row, h) {
  const part = h <= 1 ? 'mid' : row === 0 ? 'top' : row === h - 1 ? 'bot' : 'mid';
  return `nature.hedge.${SEASONS.includes(season) ? season : 'summer'}.${part}`;
}

/** Tuile d'une bande fleurie (2 variantes alternées). */
export function stripTileName(season, k) {
  const s = SEASONS.includes(season) ? season : 'summer';
  return k % 2 ? `nature.strip.${s}.1` : `nature.strip.${s}`;
}

export function oakSpriteName(stage, season) {
  if (stage === 'sapling') return 'nature.oak.sapling';
  if (stage === 'young') return 'nature.oak.young';
  return `nature.oak.${SEASONS.includes(season) ? season : 'summer'}`;
}

export function fallowSpriteName(season) {
  return `nature.fallow.${SEASONS.includes(season) ? season : 'summer'}`;
}

/** Fleurs sur la lisière : étape 2 au printemps ; étape 4 (et 5) toute la belle saison. */
export function edgeFlowersOn(stage, season) {
  if (stage >= 4) return season !== 'winter';
  if (stage >= 2) return season === 'spring';
  return false;
}

/** Vols d'oiseaux par minute : 0, 1, 2, 3, 4, 5 de l'étape 0 à 5 ; rien en mouvements réduits. */
export function birdsPerMinute(stage, reduced = false) {
  if (reduced) return 0;
  return Math.max(0, Math.min(5, Math.floor(stage || 0)));
}

/** Papillons dans la scène l'été à partir de l'étape 3 (mouvements réduits : aucun). */
export function butterfliesOn(stage, season, reduced = false) {
  return !reduced && stage >= 3 && season === 'summer';
}

/** Tuiles de forêt voisines (4 voisins) d'une tuile de sol de la ferme : une sur ~3 porte des fleurs (px). */
export function edgeTiles(layout) {
  const out = [];
  if (!layout || typeof layout.isForest !== 'function') return out;
  const x0 = Math.floor((layout.x0 ?? 0) / T);
  const x1 = Math.floor((layout.x1 ?? layout.width ?? 0) / T);
  const rows = Math.floor((layout.height || 0) / T);
  const roadY = layout.roadY ?? -99;
  for (let ty = 2; ty < rows - 2; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      if (!layout.isForest(tx, ty)) continue;
      let ground = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < x0 || nx >= x1 || ny === roadY || ny === roadY + 1) continue;
        if (!layout.isForest(nx, ny)) {
          ground = true;
          break;
        }
      }
      if (!ground) continue;
      const u = hash(tx, ty);
      if (u < 0.36) out.push({ x: tx * T, y: ty * T, v: Math.floor(u * 1000) % 3 });
    }
  }
  return out;
}

/** Trouvaille d'une haie : une tuile de la haie, choisie par l'identifiant (stable). */
export function findRect(r, id) {
  if (!r) return null;
  const rows = Math.max(1, Math.round(r.h / T));
  const k = rows <= 3 ? 0 : 1 + Math.floor(hash(id, 'find') * (rows - 2));
  return { x: r.x, y: r.y + k * T, w: T, h: T };
}

export function growRect(r, minWorld = 0) {
  const ex = Math.max(0, (minWorld - r.w) / 2);
  const ey = Math.max(0, (minWorld - r.h) / 2);
  return { x: r.x - ex, y: r.y - ey, w: r.w + 2 * ex, h: r.h + 2 * ey };
}

// ── Replis dessinés ───────────────────────────────────────────────────────────────────

function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
const R = (g, x, y, w, h, color) => {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
};
const SEASON_FLOWER = { spring: '#ffffff', summer: '#e8f0a0', autumn: '#c8283a', winter: '#e8f4ff' };
const SEASON_LEAF = { spring: '#6cbf4a', summer: '#3f8a34', autumn: '#7a8a34', winter: '#8a7a6a' };

const FALLBACK = {
  hedge: (season, part) =>
    makeCanvas(16, 16, (g) => {
      R(g, 2, part === 'top' ? 3 : 0, 12, part === 'bot' ? 14 : 16 - (part === 'top' ? 3 : 0), OUTLINE);
      R(g, 3, part === 'top' ? 4 : 0, 10, part === 'bot' ? 12 : 16 - (part === 'top' ? 4 : 0), SEASON_LEAF[season] || '#3f8a34');
      g.fillStyle = SEASON_FLOWER[season] || '#fff';
      for (const [x, y] of [[5, 6], [10, 9], [7, 12], [11, 4]]) g.fillRect(x, y, 1, 1);
    }),
  strip: (season, k) =>
    makeCanvas(16, 16, (g) => {
      R(g, 0, 10, 16, 5, SEASON_LEAF[season] || '#3f8a34');
      const cols = season === 'spring' ? ['#e83a2a', '#4a7ae8'] : season === 'summer' ? ['#ffffff', '#f2d23a'] : season === 'autumn' ? ['#a86ad8', '#c88ae8'] : ['#d8b86a', '#a8884a'];
      for (let i = 0; i < 5; i++) R(g, 1 + i * 3 + (k % 2), 8 + ((i + k) % 3), 2, 2, cols[i % 2]);
    }),
  nestbox: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 7, 8, 2, 8, '#6a4a32');
      R(g, 4, 3, 8, 7, OUTLINE);
      R(g, 5, 4, 6, 5, '#b8824a');
      R(g, 3, 2, 10, 2, '#8a4a2a');
      R(g, 7, 5, 2, 2, OUTLINE);
    }),
  owlbox: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 2, 3, 12, 11, OUTLINE);
      R(g, 3, 4, 10, 9, '#a8743a');
      R(g, 6, 6, 4, 4, OUTLINE);
    }),
  woodpile: () =>
    makeCanvas(16, 16, (g) => {
      R(g, 1, 9, 14, 6, OUTLINE);
      R(g, 2, 10, 12, 4, '#8a5a32');
      for (const [x, y] of [[3, 11], [7, 11], [11, 11], [5, 8], [9, 8]]) R(g, x, y, 2, 2, '#d8b07a');
      R(g, 4, 6, 8, 3, '#8a8a8a');
    }),
  insectHotel: () =>
    makeCanvas(16, 32, (g) => {
      R(g, 2, 8, 12, 22, OUTLINE);
      R(g, 3, 9, 10, 20, '#b8824a');
      R(g, 1, 5, 14, 4, '#8a4a2a');
      for (let y = 11; y < 28; y += 4) for (let x = 4; x < 12; x += 3) R(g, x, y, 2, 2, '#5a3a22');
    }),
  oak: (stage, season) => {
    if (stage === 'sapling') return makeCanvas(16, 16, (g) => { R(g, 7, 6, 2, 9, '#6a4a32'); R(g, 4, 3, 8, 5, SEASON_LEAF[season] || '#4f9a45'); });
    if (stage === 'young') return makeCanvas(16, 32, (g) => { R(g, 7, 16, 2, 15, '#6a4a32'); R(g, 2, 4, 12, 14, OUTLINE); R(g, 3, 5, 10, 12, SEASON_LEAF[season] || '#4f9a45'); });
    return makeCanvas(32, 48, (g) => {
      R(g, 13, 26, 6, 21, '#5a3a22');
      R(g, 2, 3, 28, 26, OUTLINE);
      R(g, 3, 4, 26, 24, season === 'winter' ? '#8a7a6a' : season === 'autumn' ? '#c86a2a' : SEASON_LEAF[season] || '#3f8a34');
    });
  },
  reeds: (k) =>
    makeCanvas(16, 16, (g) => {
      for (let i = 0; i < 4; i++) R(g, 2 + i * 4 + (k % 2), 4 + ((i + k) % 3), 1, 12, '#4f8a34');
      R(g, 6 + k, 3, 2, 2, '#f2d23a');
    }),
  fallow: (season) =>
    makeCanvas(32, 32, (g) => {
      R(g, 2, 3, 28, 26, season === 'winter' ? '#5a7a4a' : '#5f9a45');
      const cols = season === 'spring' ? ['#e83a2a'] : season === 'summer' ? ['#7a7ae8'] : season === 'autumn' ? ['#ffffff', '#f2d23a'] : ['#e8f4ff'];
      for (let i = 0; i < 18; i++) R(g, 4 + Math.floor(hash(i, season) * 24), 5 + Math.floor(hash(season, i) * 22), 2, 2, cols[i % cols.length]);
    }),
  animal: (id, frame) =>
    makeCanvas(16, 16, (g) => {
      const [a, b] = WILD_COLORS[id] || ['#8a6a4a', '#e8d8b8'];
      const dy = frame ? -1 : 0;
      R(g, 3, 8 + dy, 10, 6, OUTLINE);
      R(g, 4, 9 + dy, 8, 4, a);
      R(g, 2, 7 + dy, 4, 4, OUTLINE);
      R(g, 3, 8 + dy, 2, 2, b);
      R(g, 3, 8 + dy, 1, 1, OUTLINE);
    }),
  hint: (icon) =>
    makeCanvas(16, 16, (g) => {
      const c = /feather/.test(icon) ? '#3a6ae8' : /eggs/.test(icon) ? '#2a3a2a' : /nuts/.test(icon) ? '#a8743a' : /note/.test(icon) ? '#fff3b0' : '#6a4a32';
      for (const [x, y] of [[4, 11], [8, 9], [11, 12], [6, 13]]) R(g, x, y, 2, 2, c);
    }),
  find: (kind) =>
    makeCanvas(16, 16, (g) => {
      const c = kind === 'blackberry' ? '#3a1a3a' : kind === 'elderflower' ? '#fff8e0' : kind === 'sloe' ? '#3a4a8a' : '#a8743a';
      for (const [x, y] of [[6, 6], [9, 6], [7, 9], [10, 9], [8, 12]]) { R(g, x - 1, y - 1, 4, 4, OUTLINE); R(g, x, y, 2, 2, c); }
    }),
  box: (open) =>
    makeCanvas(16, 16, (g) => {
      R(g, 2, 6, 12, 9, OUTLINE);
      R(g, 3, 7, 10, 7, '#7a8aa8');
      R(g, 5, 9, 2, 2, '#e8a0b8');
      R(g, 9, 10, 2, 2, '#f2d23a');
      if (open) { R(g, 3, 2, 10, 3, '#9aaac8'); R(g, 4, 5, 3, 3, '#e8d0a0'); R(g, 8, 4, 3, 4, '#d8b88a'); } else R(g, 2, 5, 12, 2, '#9aaac8');
    }),
  label: () =>
    makeCanvas(8, 8, (g) => {
      R(g, 3, 4, 2, 4, '#6a4a32');
      R(g, 0, 0, 8, 5, OUTLINE);
      R(g, 1, 1, 6, 3, '#e8c88a');
    }),
  question: () =>
    makeCanvas(9, 11, (g) => {
      R(g, 0, 0, 9, 9, OUTLINE);
      R(g, 1, 1, 7, 7, '#fffbe8');
      R(g, 3, 9, 3, 2, OUTLINE);
      g.fillStyle = OUTLINE;
      for (const [x, y] of [[3, 2], [4, 2], [5, 2], [5, 3], [4, 4], [4, 6]]) g.fillRect(x, y, 1, 1);
    }),
  bird: (f) =>
    makeCanvas(16, 16, (g) => {
      g.fillStyle = '#2a2026';
      for (const [bx, by] of [[3, 6], [9, 4], [10, 10]]) {
        if (f) { g.fillRect(bx, by, 1, 1); g.fillRect(bx + 1, by + 1, 1, 1); g.fillRect(bx + 2, by, 1, 1); } else { g.fillRect(bx, by + 1, 1, 1); g.fillRect(bx + 1, by, 1, 1); g.fillRect(bx + 2, by + 1, 1, 1); }
      }
    }),
  butterfly: (f) =>
    makeCanvas(8, 8, (g) => {
      R(g, 3, 2, 1, 4, '#2a2026');
      if (f) { R(g, 1, 2, 2, 3, '#e8783a'); R(g, 4, 2, 2, 3, '#e8783a'); } else { R(g, 2, 2, 1, 3, '#e8783a'); R(g, 4, 2, 1, 3, '#e8783a'); }
    }),
  flower: (v) =>
    makeCanvas(16, 16, (g) => {
      const c = ['#ffffff', '#f2d23a', '#e87aa8'][v % 3];
      for (const [x, y] of [[3, 10], [8, 12], [12, 9], [6, 6]]) { R(g, x, y, 2, 2, c); R(g, x, y + 2, 1, 2, '#3f8a34'); }
    }),
};

// ── Acteurs ───────────────────────────────────────────────────────────────────────────

export function createValleyActors(effects) {
  let images = null;
  let reduced = false;
  let time = 0;
  let enabled = false;
  let infoT = -1;
  let stage = 0;
  let placing = null;
  let lastLayout = null;
  let edges = [];
  let view = { x: 0, y: 0, w: 1e9, h: 1e9 };
  let drawn = 0;
  const cache = new Map();
  const info = {
    season: 'spring', nature: [], animals: [], finds: [], fallow: [], trials: [], boxPending: false, started: false,
    placingSpots: [], stageN: 0,
  };
  const grows = new Map(); // spotId → âge (s)
  const picks = []; // { kind, x, y, t }
  const installs = []; // { x, y, t } (petits cœurs)
  const birds = []; // { x, y, vx, t, f }
  const flies = []; // papillons { x, y, t, ph }
  let birdClock = 0;
  let lastSpark = 0;
  let lastHarvestPlot = null;

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
  const spotsOf = (layout = lastLayout) => layout?.valley?.spots || {};
  const anchorOf = (spotId, layout = lastLayout) => layout?.valley?.animalAnchors?.[spotId] || (layout?.farmerHome ? { x: layout.farmerHome.x + 22, y: layout.farmerHome.y } : null);
  const inView = (x, y, w, h) => x + w >= view.x - 32 && x <= view.x + view.w + 32 && y + h >= view.y - 48 && y <= view.y + view.h + 32;

  function readInfo(game) {
    const st = game.state;
    const v = st.career.valley;
    info.started = !!v.started;
    info.season = SEASONS[((st.time?.seasonIndex ?? 0) % 4 + 4) % 4];
    info.stageN = v.stage || 0;
    info.nature = Object.entries(v.nature || {}).map(([spotId, n]) => ({ spotId, kind: n.kind, oak: n.kind === 'loneTree' ? oakStage(st, n) : null }));
    info.finds = (v.finds || []).map((f) => ({ id: f.id, kind: f.kind, spotId: f.spotId }));
    info.animals = (typeof game.query.career?.valleyAnimals === 'function' ? safe(() => game.query.career.valleyAnimals(), []) : []) || [];
    info.fallow = [];
    info.trials = [];
    (st.plots || []).forEach((p, i) => {
      if (!p || !p.env) return;
      if (p.fallow !== undefined && !p.cropId) info.fallow.push(i);
      if (p.variety && p.cropId && !v.varieties?.[p.variety]?.fixedAt) info.trials.push(i);
    });
    const pendingJars = Math.max(0, (st.career.heirlooms || []).length - (v.jars?.opened || 0));
    const unread = Array.from({ length: (v.stage || 0) + 1 }, (_, n) => n).some((n) => !(v.chapters?.read || []).includes(n));
    info.boxPending = pendingJars > 0 || unread;
    info.placingSpots = placing && typeof game.query.career?.valleySpots === 'function' ? (safe(() => game.query.career.valleySpots(placing), []) || []).filter((s) => s.free) : [];
  }

  function sync(game, layout, opts = {}) {
    if (opts.time !== undefined) time = opts.time;
    const v = game?.state?.career?.valley;
    enabled = !!v && !!v.started;
    if (!enabled) {
      if (lastLayout) clear();
      return;
    }
    if (layout !== lastLayout) {
      lastLayout = layout;
      edges = edgeTiles(layout);
    }
    if (infoT >= 0 && time - infoT < INFO_S) return;
    infoT = time;
    readInfo(game);
  }

  function animalRect(a, k = 0) {
    const p = anchorOf(a.spotId);
    if (!p) return null;
    return { x: Math.round(p.x - 8 + (k % 3) * 10 - (k ? 6 : 0)), y: Math.round(p.y - 15), w: T, h: T };
  }

  function itemRect(kind, id) {
    const sp = spotsOf();
    if (kind === 'natureSpot' || kind === 'spot') return sp[id] ? { ...sp[id] } : null;
    if (kind === 'valleyBox') return lastLayout?.valley?.box ? { ...lastLayout.valley.box } : null;
    if (kind === 'hedgeFind') {
      const f = info.finds.find((x) => x.id === id);
      return f ? findRect(sp[f.spotId], f.id) : null;
    }
    if (kind === 'wildlife') {
      const list = info.animals.filter((a) => a.state !== 'hint');
      const k = list.findIndex((a) => a.id === id);
      if (k < 0) return null;
      return animalRect(list[k], sameSpotIndex(list, k));
    }
    return null;
  }

  function sameSpotIndex(list, k) {
    let n = 0;
    for (let i = 0; i < k; i++) if (list[i].spotId === list[k].spotId) n++;
    return n;
  }

  // ── Événements ────────────────────────────────────────────────────────────────
  function plotRect(layout, i) {
    return Number.isInteger(i) ? safe(() => layout.plotRect(i), null) : null;
  }

  function onEvent(type, p = {}, layout) {
    if (!layout) return;
    const sp = layout.valley?.spots || {};
    switch (type) {
      case 'naturePlaced': {
        grows.set(p.spotId, 0);
        const r = sp[p.spotId];
        if (r) {
          effects.sparkle?.(r, Math.min(24, 6 + Math.round((r.w * r.h) / 64)), 'gold', 0.1);
          effects.dirt?.(r.x + r.w / 2, r.y + r.h - 2, 8, 1);
        }
        infoT = -1;
        break;
      }
      case 'valleyStarted': {
        if (p.hedge) grows.set(p.hedge, 0);
        const b = layout.valley?.box;
        if (b) effects.sparkle?.(b, 12, 'gold', 0.2);
        infoT = -1;
        break;
      }
      case 'speciesHint':
      case 'speciesVisible':
      case 'hedgeFinds':
      case 'jarOpened':
      case 'fallowEnded':
      case 'heirloomSown':
      case 'fairHeirloomBought':
      case 'jayGift':
        infoT = -1;
        if (type === 'speciesVisible') {
          const a = anchorOf(p.spotId, layout);
          if (a) effects.sparkle?.({ x: a.x - 8, y: a.y - 16, w: 16, h: 14 }, 8, 'gold', 0.1);
        }
        if (type === 'hedgeFinds') for (const f of p.finds || []) { const r = findRect(sp[f.spotId], f.id); if (r) effects.sparkle?.(r, 5, 'gold', 0.2); }
        if (type === 'jarOpened' || type === 'jayGift') { const b = layout.valley?.box; if (b) effects.sparkle?.(b, 8, 'gold', 0); }
        break;
      case 'speciesInstalled': {
        const a = anchorOf(p.spotId, layout);
        if (a) {
          installs.push({ x: a.x, y: a.y - 18, t: 0 });
          effects.sparkle?.({ x: a.x - 10, y: a.y - 18, w: 20, h: 16 }, reduced ? 6 : 14, 'gold', 0);
        }
        infoT = -1;
        break;
      }
      case 'hedgePicked': {
        const r = findRect(sp[p.spotId], p.id);
        if (r) {
          picks.push({ kind: p.kind, x: r.x, y: r.y, t: 0 });
          effects.sparkle?.(r, 6, 'gold', 0);
          if (p.amount) effects.floatText?.(r.x + 8, r.y - 4, `+${p.amount}`, undefined, { pop: true, life: 1.5 });
        }
        info.finds = info.finds.filter((f) => f.id !== p.id);
        infoT = -1;
        break;
      }
      case 'harvested':
        if (Number.isInteger(p.plotIndex)) lastHarvestPlot = p.plotIndex;
        break;
      case 'heirloomHarvest': {
        const r = plotRect(layout, p.plotIndex);
        if (r && p.seeds > 0) effects.floatText?.(r.x + r.w / 2, r.y - 14, `+${p.seeds} ${p.tree ? (p.seeds > 1 ? 'greffons' : 'greffon') : p.seeds > 1 ? 'graines' : 'graine'} · ${Math.min(p.hand, p.need)}/${p.need}`, '#c8f08a', { icon: false, life: 1.9, delay: 0.3 });
        lastHarvestPlot = p.plotIndex;
        infoT = -1;
        break;
      }
      case 'heirloomFixed': {
        const r = plotRect(layout, lastHarvestPlot);
        if (r) {
          effects.burst?.(r.x + r.w / 2, r.y + r.h / 2, reduced ? 8 : 20, 'gold', 44, 0.4, 1);
          effects.floatText?.(r.x + r.w / 2, r.y - 26, VARIETIES_BY_ID[p.varietyId]?.g === 'm' ? 'Sauvé !' : 'Sauvée !', '#ffd23a', { icon: false, life: 2.2, delay: 0.6, pop: true });
        }
        infoT = -1;
        break;
      }
      case 'fallowSown': {
        const r = plotRect(layout, p.plotIndex);
        if (r) effects.sparkle?.(r, 8, 'gold', 0);
        infoT = -1;
        break;
      }
      case 'valleyStage':
        stage = Math.max(stage, p.n || 0);
        if (!reduced) for (let k = 0; k < 2; k++) spawnBirds(k * 0.8);
        infoT = -1;
        break;
      default:
        break;
    }
  }

  function spawnBirds(delay = 0) {
    if (birds.length > 6) return;
    const fromLeft = Math.random() < 0.5;
    const y = view.y + 20 + Math.random() * Math.max(40, view.h * 0.5);
    birds.push({ x: fromLeft ? view.x - 20 : view.x + view.w + 4, y, vx: (fromLeft ? 1 : -1) * (26 + Math.random() * 10), t: -delay, f: 0 });
  }

  // ── Animation ─────────────────────────────────────────────────────────────────
  function update(dt) {
    time += dt;
    if (!enabled) return;
    for (const [k, a] of grows) {
      const n = a + dt;
      if (n > GROW_S) grows.delete(k);
      else grows.set(k, n);
    }
    for (let i = picks.length - 1; i >= 0; i--) if ((picks[i].t += dt) > 0.9) picks.splice(i, 1);
    for (let i = installs.length - 1; i >= 0; i--) if ((installs[i].t += dt) > 1.6) installs.splice(i, 1);
    // Oiseaux : `stage` vols par minute (aucun en mouvements réduits).
    const rate = birdsPerMinute(stage, reduced);
    if (rate > 0) {
      birdClock += dt;
      if (birdClock > 60 / rate) {
        birdClock = 0;
        spawnBirds(0);
      }
    } else birds.length = 0;
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      b.t += dt;
      if (b.t < 0) continue;
      b.x += b.vx * dt;
      b.y += Math.sin(b.t * 1.4) * 4 * dt;
      if (b.x < view.x - 60 || b.x > view.x + view.w + 60) birds.splice(i, 1);
    }
    // Papillons l'été (étape ≥ 3) : quelques-uns qui voltigent dans la vue.
    if (butterfliesOn(stage, info.season, reduced)) {
      while (flies.length < 3) flies.push({ x: view.x + Math.random() * view.w, y: view.y + 30 + Math.random() * Math.max(30, view.h - 60), t: 0, ph: Math.random() * 6 });
      for (const f of flies) {
        f.t += dt;
        f.x += Math.sin(f.t * 0.7 + f.ph) * 10 * dt;
        f.y += Math.cos(f.t * 0.9 + f.ph) * 7 * dt;
        if (f.x < view.x - 20 || f.x > view.x + view.w + 20 || f.y < view.y - 20 || f.y > view.y + view.h + 20) {
          f.x = view.x + Math.random() * view.w;
          f.y = view.y + 30 + Math.random() * Math.max(30, view.h - 60);
        }
      }
    } else flies.length = 0;
    // Étincelle discrète : bêtes qui attendent, trouvailles, boîte avec quelque chose dedans (toutes les ~2,5 s).
    if (time - lastSpark > 2.5) {
      lastSpark = time;
      const waiting = info.animals.filter((a) => a.state === 'visible');
      for (const a of waiting) {
        const r = itemRect('wildlife', a.id);
        if (r) effects.sparkle?.({ x: r.x, y: r.y - 4, w: 16, h: 10 }, reduced ? 1 : 3, 'gold', 0);
      }
      for (const f of info.finds) {
        const r = findRect(spotsOf()[f.spotId], f.id);
        if (r) effects.sparkle?.({ x: r.x + 3, y: r.y + 2, w: 10, h: 8 }, reduced ? 1 : 2, 'gold', 0.3);
      }
      const b = lastLayout?.valley?.box;
      if (b && info.boxPending) effects.sparkle?.(b, reduced ? 1 : 3, 'gold', 0.5);
    }
  }

  // ── Dessin ─────────────────────────────────────────────────────────────────────
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

  const growAlpha = (spotId) => {
    if (!grows.has(spotId)) return 1;
    const a = grows.get(spotId) / (reduced ? 0.3 : GROW_S);
    return Math.max(0.05, Math.min(1, a));
  };

  /** Au sol (après les parcelles) : jachères, bandes fleuries, berges, indices du matin. */
  function drawGround(c, layout, v) {
    if (v) view = v;
    if (!enabled) return;
    const sp = layout.valley?.spots || {};
    const s = info.season;
    for (const i of info.fallow) {
      const r = plotRect(layout, i);
      if (!r || !inView(r.x, r.y, r.w, r.h)) continue;
      const name = fallowSpriteName(s);
      if (has(name)) drawSprite(c, images, name, r.x, r.y, r.w > 32 ? { scale: Math.floor(r.w / 32) } : undefined);
      else drawImg(c, null, () => fallback('fallow', s), r.x, r.y);
    }
    for (const n of info.nature) {
      const r = sp[n.spotId];
      if (!r || !inView(r.x, r.y, r.w, r.h)) continue;
      const a = growAlpha(n.spotId);
      if (n.kind === 'strip') {
        const k = Math.round(r.w / T);
        for (let i = 0; i < k; i++) drawImg(c, stripTileName(s, i), () => fallback('strip', s, i), r.x + i * T, r.y, a);
      } else if (n.kind === 'reeds') {
        const k = Math.round(r.w / T);
        for (let i = 0; i < k; i++) {
          const v2 = (i + Math.round(r.x / T)) % 3;
          drawImg(c, v2 ? `nature.reeds.${v2}` : 'nature.reeds', () => fallback('reeds', v2), r.x + i * T, r.y + 4, a);
        }
        // Les deux côtés de la mare (sous la berge du haut).
        for (let j = 1; j <= 3; j++) {
          drawImg(c, `nature.reeds.${j % 3 || ''}`.replace(/\.$/, ''), () => fallback('reeds', j), r.x - T, r.y + j * T + 2, a);
          drawImg(c, `nature.reeds.${(j + 1) % 3 || ''}`.replace(/\.$/, ''), () => fallback('reeds', j + 1), r.x + r.w, r.y + j * T + 2, a);
        }
      }
    }
    // Indices du matin (traces, plume, œufs, noisettes, note) : au sol, à l'emplacement.
    for (const an of info.animals) {
      if (an.state !== 'hint') continue;
      const p = anchorOf(an.spotId, layout);
      if (!p || !inView(p.x - 8, p.y - 16, 16, 16)) continue;
      const name = an.hintIcon || 'wild.hint.tracks';
      drawImg(c, name, () => fallback('hint', name), p.x - 8, p.y - 14, 0.92);
    }
  }

  function collect(push) {
    drawn = 0;
    if (!enabled || !lastLayout) return;
    const sp = spotsOf();
    const s = info.season;
    const P = (name, fb, x, y, sortY, opts = {}) => {
      if (!inView(x, y, 48, 48)) return;
      drawn += 1;
      if (name && has(name)) push(name, Math.round(x), Math.round(y), sortY, opts);
      else if (fb) {
        const img = typeof fb === 'function' ? fb() : fb;
        if (img) push(null, Math.round(x), Math.round(y), sortY, { ...opts, img });
      }
    };
    for (const n of info.nature) {
      const r = sp[n.spotId];
      if (!r) continue;
      const alpha = growAlpha(n.spotId);
      const o = alpha < 1 ? { alpha } : {};
      switch (n.kind) {
        case 'hedge': {
          const h = Math.round(r.h / T);
          for (let row = 0; row < h; row++) {
            const name = hedgeTileName(s, row, h);
            const part = name.split('.').pop();
            P(name, () => fallback('hedge', s, part), r.x, r.y + row * T, r.y + row * T + T - 1, o);
          }
          break;
        }
        case 'nestbox':
          P('nature.nestbox', () => fallback('nestbox'), r.x, r.y, r.y + T - 1, o);
          break;
        case 'owlbox':
          P('nature.owlbox', () => fallback('owlbox'), r.x, r.y, r.y + 3 * T, o);
          break;
        case 'woodpile':
          P('nature.woodpile', () => fallback('woodpile'), r.x, r.y, r.y + T - 2, o);
          break;
        case 'insectHotel':
          P('nature.insectHotel', () => fallback('insectHotel'), r.x, r.y, r.y + r.h - 1, o);
          break;
        case 'loneTree': {
          const st = n.oak || 'sapling';
          const name = oakSpriteName(st, s);
          const cx = r.x + r.w / 2;
          const by = r.y + r.h;
          if (st === 'adult') P(name, () => fallback('oak', st, s), cx - 16, by - 48, by - 1, o);
          else if (st === 'young') P(name, () => fallback('oak', st, s), cx - 8, by - 32, by - 1, o);
          else P(name, () => fallback('oak', st, s), cx - 8, by - 16, by - 1, o);
          break;
        }
        default:
          break;
      }
    }
    // Trouvailles des haies (et celles qu'on vient de cueillir, petit saut).
    for (const f of info.finds) {
      const r = findRect(sp[f.spotId], f.id);
      if (!r) continue;
      const bob = reduced ? 0 : Math.sin(time * 2 + r.y) > 0.8 ? -1 : 0;
      P(`hedgefind.${f.kind}`, () => fallback('find', f.kind), r.x + (/hedgeL$/.test(f.spotId) ? 3 : -3), r.y + bob, r.y + T + 0.5);
    }
    for (const pk of picks) {
      const dy = reduced ? 0 : -Math.sin(Math.min(1, pk.t / 0.6) * Math.PI) * 12;
      P(`hedgefind.${pk.kind}`, () => fallback('find', pk.kind), pk.x, pk.y + dy, pk.y + T + 0.5, { alpha: Math.max(0, 1 - pk.t / 0.9) });
    }
    // Boîte en fer du perron.
    const b = lastLayout.valley?.box;
    if (b && info.started) P(info.boxPending ? 'valley.box.open' : 'valley.box', () => fallback('box', info.boxPending ? 1 : 0), b.x, b.y, b.y + T - 1);
    // Bêtes : qui attendent (étincelle « ? »), habitants du jour en promenade douce.
    const list = info.animals.filter((a) => a.state !== 'hint');
    list.forEach((a, k) => {
      const r = animalRect(a, sameSpotIndex(list, k));
      if (!r) return;
      let x = r.x;
      let y = r.y;
      let frame = 0;
      let flip = false;
      if (a.state === 'visible') {
        if (!reduced) frame = Math.floor(time * 1.6 + k) % 4 === 0 ? 1 : 0;
      } else if (!reduced) {
        // Promenade : aller-retour de ±12 px avec des pauses, pas lié à la distance.
        const ph = (time * 0.18 + hash(a.id) * 7) % 2;
        const u = ph < 1 ? ph : 2 - ph;
        const eased = Math.max(0, Math.min(1, (u - 0.15) / 0.7));
        x = r.x - 12 + Math.round(eased * 24);
        const moving = u > 0.15 && u < 0.85;
        flip = ph < 1; // va vers la droite (les dessins regardent à gauche)
        frame = moving && Math.floor(time * 4) % 2 ? 1 : 0;
        if (a.id === 'swallow' || a.id === 'dragonfly' || a.id === 'butterfly' || a.id === 'bumblebee') y -= 6 + Math.round(Math.sin(time * 2 + k) * 2);
      }
      P(frame ? `wild.${a.id}.1` : `wild.${a.id}`, () => fallback('animal', a.id, frame), x, y, y + T - 1, flip ? { flipX: true } : {});
    });
  }

  /** Au-dessus : étiquettes des planches d'essai, « ? », cœurs, emplacements à poser, lisière, oiseaux, papillons. */
  function drawOverlay(c, layout) {
    if (!enabled) return;
    // Lisière fleurie (sur les tuiles de forêt voisines de la ferme).
    if (edgeFlowersOn(stage, info.season)) {
      for (const e of edges) {
        if (!inView(e.x, e.y, T, T)) continue;
        drawImg(c, `nature.edge.flowers.${e.v}`, () => fallback('flower', e.v), e.x, e.y, 1);
      }
    }
    for (const i of info.trials) {
      const r = plotRect(layout, i);
      if (!r || !inView(r.x, r.y, r.w, r.h)) continue;
      drawImg(c, 'valley.label', () => fallback('label'), r.x + r.w - 9, r.y + r.h - 10);
    }
    const list = info.animals.filter((a) => a.state !== 'hint');
    list.forEach((a, k) => {
      if (a.state !== 'visible') return;
      const r = animalRect(a, sameSpotIndex(list, k));
      if (!r) return;
      const bob = reduced ? 0 : Math.round(Math.sin(time * 3 + k) * 1.5);
      drawImg(c, null, () => fallback('question'), r.x + 4, r.y - 12 + bob);
    });
    for (const h of installs) {
      const a = Math.max(0, 1 - h.t / 1.6);
      c.globalAlpha = a;
      c.fillStyle = '#ff6a8a';
      const dy = reduced ? 0 : -h.t * 14;
      for (const [dx, oy] of [[-6, 0], [5, -4], [0, -9]]) {
        const x = Math.round(h.x + dx);
        const y = Math.round(h.y + oy + dy);
        c.fillRect(x, y, 2, 2);
        c.fillRect(x + 3, y, 2, 2);
        c.fillRect(x, y + 1, 5, 2);
        c.fillRect(x + 1, y + 3, 3, 1);
        c.fillRect(x + 2, y + 4, 1, 1);
      }
      c.globalAlpha = 1;
    }
    // Mode aménagement : les emplacements libres pulsent (contour pointillé épais, lisible sans la couleur).
    if (placing) {
      const sp = layout.valley?.spots || {};
      const pulse = reduced ? 0.85 : 0.55 + 0.45 * Math.abs(Math.sin(time * 3));
      for (const s0 of info.placingSpots) {
        const r = sp[s0.spotId];
        if (!r || !inView(r.x, r.y, r.w, r.h)) continue;
        const x = Math.round(r.x);
        const y = Math.round(r.y);
        c.globalAlpha = 0.42 * pulse;
        c.fillStyle = '#fff3b0';
        c.fillRect(x, y, r.w, r.h);
        c.globalAlpha = pulse;
        for (let d = 0; d < r.w; d += 4) {
          c.fillStyle = OUTLINE;
          c.fillRect(x + d, y, 2, 2);
          c.fillRect(x + d, y + r.h - 2, 2, 2);
          c.fillStyle = '#fffbe8';
          c.fillRect(x + d + 2, y, 2, 1);
          c.fillRect(x + d + 2, y + r.h - 1, 2, 1);
        }
        for (let d = 0; d < r.h; d += 4) {
          c.fillStyle = OUTLINE;
          c.fillRect(x, y + d, 2, 2);
          c.fillRect(x + r.w - 2, y + d, 2, 2);
          c.fillStyle = '#fffbe8';
          c.fillRect(x, y + d + 2, 1, 2);
          c.fillRect(x + r.w - 1, y + d + 2, 1, 2);
        }
        // Petit « + » au centre.
        const cx = x + Math.floor(r.w / 2);
        const cy = y + Math.floor(r.h / 2);
        c.fillStyle = OUTLINE;
        c.fillRect(cx - 3, cy - 1, 7, 3);
        c.fillRect(cx - 1, cy - 3, 3, 7);
        c.fillStyle = '#fffbe8';
        c.fillRect(cx - 2, cy, 5, 1);
        c.fillRect(cx, cy - 2, 1, 5);
        c.globalAlpha = 1;
      }
    }
    for (const b of birds) {
      if (b.t < 0) continue;
      const f = Math.floor(b.t * 5) % 2;
      drawImg(c, f ? 'fx.birds.1' : 'fx.birds', () => fallback('bird', f), b.x, b.y, 1, b.vx > 0 ? { flipX: true } : undefined);
    }
    for (const fl of flies) {
      const f = Math.floor(fl.t * 6) % 2;
      drawImg(c, f ? 'fx.butterfly.1' : 'fx.butterfly', () => fallback('butterfly', f), fl.x, fl.y, 1);
    }
  }

  // ── Toucher ───────────────────────────────────────────────────────────────────
  function hitTest(wx, wy, slop = 0, opts = {}) {
    if (!enabled || !lastLayout) return null;
    const minWorld = opts.minWorld || 0;
    const within = (r, s) => r && wx >= r.x - s && wy >= r.y - s && wx < r.x + r.w + s && wy < r.y + r.h + s;
    const targets = [];
    if (placing) {
      const sp = spotsOf();
      for (const s0 of info.placingSpots) if (sp[s0.spotId]) targets.push([growRect(sp[s0.spotId], minWorld), { type: 'natureSpot', spotId: s0.spotId }]);
    } else {
      const list = info.animals.filter((a) => a.state !== 'hint');
      list.forEach((a, k) => {
        if (a.state !== 'visible') return;
        const r = animalRect(a, sameSpotIndex(list, k));
        if (r) targets.push([growRect({ x: r.x - 2, y: r.y - 12, w: 20, h: 28 }, minWorld), { type: 'wildlife', id: a.id }]);
      });
      for (const f of info.finds) {
        const r = findRect(spotsOf()[f.spotId], f.id);
        if (r) targets.push([growRect(r, minWorld), { type: 'hedgeFind', id: f.id }]);
      }
      const b = lastLayout.valley?.box;
      if (b && info.started) targets.push([growRect(b, minWorld), { type: 'valleyBox' }]);
    }
    const pick = (lst) => {
      let best = null;
      let bd = Infinity;
      for (const [r, h] of lst) {
        const d = (wx - (r.x + r.w / 2)) ** 2 + (wy - (r.y + r.h / 2)) ** 2;
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      return best;
    };
    const hits = targets.filter(([r]) => within(r, 0));
    if (hits.length) return pick(hits);
    if (slop > 0) {
      const near = targets.filter(([r]) => within(r, slop));
      if (near.length) return pick(near);
    }
    return null;
  }

  function clear() {
    grows.clear();
    picks.length = 0;
    installs.length = 0;
    birds.length = 0;
    flies.length = 0;
    info.nature = [];
    info.animals = [];
    info.finds = [];
    info.fallow = [];
    info.trials = [];
    info.placingSpots = [];
    info.started = false;
    infoT = -1;
    lastLayout = null;
    edges = [];
  }

  function shift(dx, dy) {
    for (const p of picks) {
      p.x += dx;
      p.y += dy;
    }
    for (const h of installs) {
      h.x += dx;
      h.y += dy;
    }
    for (const b of birds) {
      b.x += dx;
      b.y += dy;
    }
    for (const f of flies) {
      f.x += dx;
      f.y += dy;
    }
  }

  return {
    setImages(imgs) {
      images = imgs;
      cache.clear();
    },
    setReducedMotion(on) {
      reduced = !!on;
      if (reduced) {
        birds.length = 0;
        flies.length = 0;
      }
    },
    setStage(n) {
      stage = Math.max(0, Math.min(5, Math.floor(Number(n) || 0)));
    },
    get stage() {
      return stage;
    },
    setPlacing(kind) {
      placing = kind || null;
      infoT = -1;
    },
    get placing() {
      return placing;
    },
    placingSpots: () => info.placingSpots.map((s) => ({ ...s })),
    sync,
    onEvent,
    update,
    drawGround,
    collect,
    drawOverlay,
    hitTest,
    itemRect,
    clear,
    shift,
    stats: () => ({
      enabled,
      drawn,
      stage,
      placing,
      season: info.season,
      nature: info.nature.length,
      animals: info.animals.map((a) => ({ id: a.id, state: a.state, spotId: a.spotId })),
      finds: info.finds.map((f) => f.id),
      fallow: info.fallow.length,
      trials: info.trials.length,
      boxPending: info.boxPending,
      placingSpots: info.placingSpots.length,
      edges: edges.length,
      birds: birds.length,
      butterflies: flies.length,
    }),
  };
}
