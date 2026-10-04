// La vue de la vallée (Vallée vivante, lot V3 « Le ruisseau », docs/VALLEE.md § 17.3 ; contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V3 », « Ce que RENDER et UI consomment »).
//
// Un panorama vertical de 192 × 432 px du monde (tuiles de 16 px), zoom entier qui remplit la largeur (× 5 sur le Pixel 7
// et sur 360 × 740), marges latérales prolongées par le bord du dessin, défilement vertical au doigt (élan léger, pas de
// pincement). De haut (le loin) en bas (le près) : ciel et collines, le bois de la Combe et le verger conservatoire,
// l'étang du moulin et la prairie des Coquelicots, la ferme en petit, le bocage du chemin creux, le chemin du village ;
// le Ru des Saules descend en ruban de la source du bois jusqu'en bas à gauche.
//
// Purs (testés par tests/valley3-render.test.js) :
//   VIEW_W, VIEW_H, PLACE_RECTS, MILL_RECT, FARM_RECT, PONTOON_RECT, BENCH_RECT, MUSHROOM_SPOTS, ANIMAL_ANCHORS
//   viewLayout({ cssW, cssH, dpr, insetTop, insetBottom }) → { zoom, worldW, worldH, x0 (px CSS), top (px CSS),
//       places: { [id]: rect }, mill, river, pontoon, farm, bench, mushroomSpots, animalAnchors, scrollMax (px CSS),
//       dev: { w, h, x0, top, avail } (px de l'appareil), cssW, cssH, dpr }
//   placeSpriteName(id, step), millSpriteName(brookStep, frame), farmSpriteName(tier), sproutCount(progress)
//   viewTargets(layout, view) → [{ rect (monde, agrandi ≥ 48 px CSS pour les petites cibles), hit, group, order }]
//   pickViewTarget(targets, wx, wy) → hit | null   (bête qui attend, champignon, ponton, Joseph, puis les lieux dans
//       l'ordre moulin, étang, verger, prairie, bois, la ferme, le ruisseau, le bocage ; deux petites cibles qui se
//       chevauchent : la plus proche du doigt)
//
// createValleyView(canvas, images, { reducedMotion }) → {
//   render(view /* query.career.valleyView() */, dt), resize(layout), scrollBy(dyCss), fling(vyCss), stopFling(),
//   scrollTo(placeId | { x, y, w, h }, { animate }), setOverlay(bottomCss), hitTest(cssX, cssY), placeRect(id) (px CSS),
//   targetRect(hit) (px CSS), setImages(images), setReducedMotion(on), layout, scroll, stats()
// }
// Mouvements réduits : rien ne bouge (eau fixe, bêtes posées, pas d'oiseaux ni de brume qui passe), changements directs.
//
// (Lot V4 « Les cigognes », docs/VALLEE.md § 18.3, § 18.5, § 18.7) VIEW_ANCHORS_V4 (px du monde, pied des dessins) :
// steeple (sommet du clocher, en bas à droite), crane (prairie), redDeer (lisière du bois), oriole (verger), beaver (près
// du ruisseau), glowView (prairie) ; visiteurs (indice du matin, halte avec « ? », visiteurs déjà vus en décor), couple
// de cigognes sur le clocher, barrage du castor, fenêtres du village le soir, Joseph et Hélène assis sur le banc, teinte
// du soir (aplat doré) ; hitTest + { type: 'visitor', id } et { type: 'bench' } ; défilement automatique :
// setAuto({ mode: 'credits' | 'contemplate', from?, to?, duration?, speed? }) / stopAuto(), autoPaused, setTint(alpha),
// listener() → { y, h } (centre de la partie visible, px du monde : écoute du paysage sonore), worldCenterY().
//   Purs : VIEW_ANCHORS_V4, BEAVER_DAM_RECT, VILLAGE_LIGHTS, visitorRect(id, anchor), visitorSpriteName(id, frame),
//   viewSoundSpots(), autoTarget(layout, mode).
// Sprites de la planche `valley3` (facultative) ; sans elle, repli dessiné par le code (aplats et petits motifs).

import { TILE, SPRITES, drawSprite } from './atlas.js';
import { canDraw } from './effects.js';
import { expandHitCss } from './camera-zoom.js';
import { buildSeasonSheets } from './assets.js';
import { VALLEY_SPECIES_BY_ID } from '../data/career/places.js';

export const VIEW_W = 192;
export const VIEW_H = 432;
export const PLACE_IDS = ['brook', 'combe', 'poppies', 'millpond', 'bocage', 'oldOrchard'];
/** Cadrage commun (px du monde) : ART dessine chaque lieu à cette taille, RENDER le pose ici. */
export const PLACE_RECTS = Object.freeze({
  brook: { x: 24, y: 120, w: 64, h: 312 },
  combe: { x: 0, y: 40, w: 96, h: 96 },
  oldOrchard: { x: 112, y: 56, w: 80, h: 80 },
  millpond: { x: 8, y: 160, w: 80, h: 64 },
  poppies: { x: 112, y: 156, w: 80, h: 80 },
  bocage: { x: 0, y: 320, w: 192, h: 64 },
});
export const MILL_RECT = Object.freeze({ x: 80, y: 168, w: 32, h: 48 });
export const FARM_RECT = Object.freeze({ x: 72, y: 256, w: 48, h: 48 });
export const PONTOON_RECT = Object.freeze({ x: 54, y: 226, w: 16, h: 16 });
export const BENCH_RECT = Object.freeze({ x: 144, y: 138, w: 32, h: 16 });
export const HELENE_PATH = Object.freeze([{ x: 128, y: 300 }, { x: 160, y: 296 }, { x: 176, y: 306 }]);
/** Cinq emplacements de champignons dans le bois de la Combe (coin haut-gauche, 16 × 16). */
export const MUSHROOM_SPOTS = Object.freeze([
  { x: 10, y: 108 }, { x: 34, y: 118 }, { x: 58, y: 100 }, { x: 74, y: 70 }, { x: 16, y: 66 },
]);
/** Où chaque habitant de la vallée attend (centre bas du dessin, px du monde). */
export const ANIMAL_ANCHORS = Object.freeze({
  kingfisher: { x: 46, y: 146 },
  crayfish: { x: 50, y: 316 },
  otter: { x: 78, y: 224 },
  heron: { x: 30, y: 200 },
  blackWoodpecker: { x: 66, y: 64 },
  roeDeer: { x: 88, y: 132 },
  salamander: { x: 24, y: 130 },
  skylark: { x: 148, y: 172 },
  hoopoe: { x: 178, y: 222 },
  littleOwl: { x: 150, y: 346 },
});
/** Lieu de chaque habitant (repli quand la requête ne le dit pas). */
const ANIMAL_PLACE = { kingfisher: 'brook', crayfish: 'brook', otter: 'millpond', heron: 'millpond', blackWoodpecker: 'combe', roeDeer: 'combe', salamander: 'combe', skylark: 'poppies', hoopoe: 'poppies', littleOwl: 'bocage' };
const PLACE_ANCHOR = { brook: { x: 52, y: 280 }, combe: { x: 48, y: 96 }, poppies: { x: 152, y: 200 }, millpond: { x: 44, y: 196 }, bocage: { x: 120, y: 352 }, oldOrchard: { x: 152, y: 100 } };
const HIT_ORDER = ['mill', 'millpond', 'oldOrchard', 'poppies', 'combe', 'farm', 'brook', 'bocage'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const OUTLINE = '#3f2631';
const FADE_S = 1.2;
const WILD_COLORS = {
  kingfisher: ['#2a7ad8', '#e8823a'], crayfish: ['#8a8a8a', '#f0f0e8'], otter: ['#7a5232', '#c8a07a'], heron: ['#8a96a0', '#f0f0f0'],
  blackWoodpecker: ['#202020', '#d8282a'], roeDeer: ['#b8683a', '#f0d8b8'], salamander: ['#202020', '#f2c81a'], skylark: ['#8a6a4a', '#e8d8b0'],
  hoopoe: ['#e09a6a', '#202020'], littleOwl: ['#8a6a4a', '#f2d23a'],
};
// ── (V4) Les visiteurs rares, le clocher, le banc ───────────────────────────────────

/** Pied (centre bas) de chaque visiteur dans la vue, px du monde (le clocher : pied du dessin `stork.steeple`). */
export const VIEW_ANCHORS_V4 = Object.freeze({
  steeple: { x: 172, y: 410 },
  crane: { x: 150, y: 216 },
  redDeer: { x: 16, y: 156 },
  oriole: { x: 170, y: 82 },
  beaver: { x: 70, y: 308 },
  glowView: { x: 132, y: 228 },
});
/** Le barrage du castor (32 × 16) en travers du ruisseau, près du castor. */
export const BEAVER_DAM_RECT = Object.freeze({ x: 38, y: 294, w: 32, h: 16 });
/** Fenêtres du village (16 × 16), posées sur les maisons près du clocher (le soir). */
export const VILLAGE_LIGHTS = Object.freeze([{ x: 139, y: 406 }, { x: 176, y: 410 }]);
/** Taille des dessins des visiteurs (le clocher et le cerf sont plus grands). */
const VISITOR_SIZE = { whiteStork: [16, 24], crane: [16, 16], redDeer: [32, 32], oriole: [16, 16], beaver: [16, 16], glowworms: [16, 16] };
const VISITOR_ANCHOR = { whiteStork: 'steeple', crane: 'crane', redDeer: 'redDeer', oriole: 'oriole', beaver: 'beaver', glowworms: 'glowView' };

/** Rectangle (monde) d'un visiteur posé sur son ancre (le clocher : le dessin du sommet du clocher, avec le couple). */
export function visitorRect(id, anchor = null) {
  const a = VIEW_ANCHORS_V4[anchor || VISITOR_ANCHOR[id]] || VIEW_ANCHORS_V4.crane;
  const [w, h] = VISITOR_SIZE[id] || [16, 16];
  return { x: Math.round(a.x - w / 2), y: Math.round(a.y - h), w, h };
}

/** Sprite d'un visiteur (2 images ; les cigognes du clocher : le dessin du sommet du clocher). */
export function visitorSpriteName(id, frame = 0) {
  if (id === 'whiteStork') return 'stork.steeple';
  if (id === 'glowworms') return 'visitor.glowworms';
  return frame ? `visitor.${id}.1` : `visitor.${id}`;
}

/** Places des sons des visiteurs dans la vue (ctx.spots de natureScape, src/audio/soundscape.js). */
export function viewSoundSpots() {
  const out = {};
  for (const [k, a] of Object.entries(VIEW_ANCHORS_V4)) out[k] = { x: a.x, y: a.y - 8 };
  return out;
}

const MUSH_COLORS = { cep: ['#7a4a2a', '#e8d8b8'], chanterelle: ['#f0b030', '#f6d070'], hedgehogMushroom: ['#e8d8b0', '#c8b890'] };

// ── Purs ─────────────────────────────────────────────────────────────────────────────

/**
 * Disposition de la vue pour un écran (px CSS) : zoom entier ≥ 3 (⌊largeur de l'appareil / 192⌋), monde centré en largeur,
 * sous le ruban du haut (insetTop) et au-dessus de la barre du bas (insetBottom) ; défilement si le monde dépasse.
 */
export function viewLayout({ cssW = 412, cssH = 915, dpr = 1, insetTop = 0, insetBottom = 0 } = {}) {
  const d = Number(dpr) > 0 ? Number(dpr) : 1;
  const devW = Math.max(1, Math.round(cssW * d));
  const devH = Math.max(1, Math.round(cssH * d));
  const zoom = Math.max(3, Math.floor(devW / VIEW_W));
  const x0Dev = Math.round((devW - VIEW_W * zoom) / 2);
  const topDev = Math.round(insetTop * d);
  const avail = Math.max(1, devH - topDev - Math.round(insetBottom * d));
  const worldDevH = VIEW_H * zoom;
  const scrollMaxDev = Math.max(0, worldDevH - avail);
  // Monde plus court que la place : centré verticalement.
  const topCentered = scrollMaxDev === 0 ? topDev + Math.round((avail - worldDevH) / 2) : topDev;
  const places = {};
  for (const [id, r] of Object.entries(PLACE_RECTS)) places[id] = { ...r };
  return {
    zoom,
    worldW: VIEW_W,
    worldH: VIEW_H,
    x0: x0Dev / d,
    top: topCentered / d,
    places,
    mill: { ...MILL_RECT },
    river: { ...PLACE_RECTS.brook },
    pontoon: { ...PONTOON_RECT },
    farm: { ...FARM_RECT },
    bench: { ...BENCH_RECT },
    mushroomSpots: MUSHROOM_SPOTS.map((p) => ({ ...p, w: 16, h: 16 })),
    animalAnchors: Object.fromEntries(Object.entries(ANIMAL_ANCHORS).map(([k, v]) => [k, { ...v }])),
    scrollMax: scrollMaxDev / d,
    dev: { w: devW, h: devH, x0: x0Dev, top: topCentered, avail },
    cssW,
    cssH,
    dpr: d,
    insetTop,
    insetBottom,
  };
}

export const placeSpriteName = (id, step) => `place.${id}.${Math.max(0, Math.floor(step || 0))}`;
export const millSpriteName = (brookStep, frame = 0) => (brookStep >= 4 ? (frame ? 'place.mill.1.a' : 'place.mill.1') : 'place.mill.0');
export const farmSpriteName = (tier) => `view.farm.${Math.max(1, Math.min(4, Math.floor(tier || 1)))}`;
/** Pousses vertes posées sur un lieu en reprise : 1 au début, 5 à la fin. */
export const sproutCount = (progress) => Math.max(1, Math.min(5, 1 + Math.floor((Number(progress) || 0) * 5)));

/** Rectangle (monde) d'une bête de la vallée : 16 × 16 posé sur son ancrage (plusieurs au même endroit : décalées). */
export function animalRect(id, k = 0) {
  const a = ANIMAL_ANCHORS[id] || PLACE_ANCHOR[ANIMAL_PLACE[id]] || { x: 96, y: 280 };
  return { x: Math.round(a.x - 8 + k * 12), y: Math.round(a.y - 16), w: 16, h: 16 };
}

/** Cibles de la vue (px du monde), agrandies pour le doigt (≥ 48 px CSS) quand elles sont petites. */
export function viewTargets(layout, view) {
  const L = layout || viewLayout();
  const grow = (r) => expandHitCss(r, L.zoom, L.dpr, 48);
  const out = [];
  if (!view) return out;
  const anim = view.animals || [];
  anim.forEach((a, i) => {
    if (a.state !== 'visible') return;
    const k = anim.slice(0, i).filter((b) => b.state === 'visible' && (b.placeId || ANIMAL_PLACE[b.id]) === (a.placeId || ANIMAL_PLACE[a.id]) && !ANIMAL_ANCHORS[a.id]).length;
    out.push({ rect: grow(animalRect(a.id, k)), hit: { type: 'viewAnimal', id: a.id }, group: 0 });
  });
  for (const m of view.mushrooms || []) {
    const s = MUSHROOM_SPOTS[m.spot] || MUSHROOM_SPOTS[0];
    out.push({ rect: grow({ x: s.x, y: s.y, w: 16, h: 16 }), hit: { type: 'mushroom', id: m.id }, group: 0 });
  }
  if (view.river && (view.river.step ?? 0) >= 2) out.push({ rect: grow(PONTOON_RECT), hit: { type: 'river' }, group: 0 });
  // (V4) Visiteurs rares qui font halte (le couple du clocher compris) ; le banc habité.
  for (const x of view.visitors || []) {
    if (x.state !== 'visible') continue;
    out.push({ rect: grow(visitorRect(x.id, x.anchor)), hit: { type: 'visitor', id: x.id }, group: 0 });
  }
  const bench = view.bench || null;
  if (bench && (bench.joseph || bench.helene)) out.push({ rect: grow(BENCH_RECT), hit: { type: 'bench' }, group: 0 });
  else if (view.joseph) out.push({ rect: grow(BENCH_RECT), hit: { type: 'joseph' }, group: 0 });
  HIT_ORDER.forEach((id, order) => {
    if (id === 'mill') out.push({ rect: { ...MILL_RECT }, hit: { type: 'place', id: 'brook' }, group: 1, order });
    else if (id === 'farm') out.push({ rect: { ...FARM_RECT }, hit: { type: 'farm' }, group: 1, order });
    else out.push({ rect: { ...PLACE_RECTS[id] }, hit: { type: 'place', id }, group: 1, order });
  });
  return out;
}

const inside = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export function pickViewTarget(targets, wx, wy) {
  let best = null;
  let bd = Infinity;
  for (const t of targets) {
    if (t.group !== 0 || !inside(t.rect, wx, wy)) continue;
    const d = (wx - (t.rect.x + t.rect.w / 2)) ** 2 + (wy - (t.rect.y + t.rect.h / 2)) ** 2;
    if (d < bd) {
      bd = d;
      best = t.hit;
    }
  }
  if (best) return best;
  let bo = Infinity;
  for (const t of targets) {
    if (t.group !== 1 || !inside(t.rect, wx, wy)) continue;
    if (t.order < bo) {
      bo = t.order;
      best = t.hit;
    }
  }
  return best;
}

/** Abscisse (px du monde, relative au lieu) du ruisseau de repli à la hauteur y (relative). */
export function brookCenter(y) {
  return 32 + Math.round(14 * Math.sin(y * 0.034) + 5 * Math.sin(y * 0.11));
}

function hash(a, b = 0) {
  let h = 2166136261 >>> 0;
  const s = `${a}|${b}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 4294967296;
}

// ── Replis dessinés (planche valley3 absente) ─────────────────────────────────────────

const PAL = {
  spring: { grass: '#7cc45a', grass2: '#94d46a', dark: '#4f9a44', sky: '#bfe4f6', hill: '#8fb2d8', hill2: '#a9c6e4', path: '#d8b47a' },
  summer: { grass: '#5fae48', grass2: '#76c05a', dark: '#3d8a3c', sky: '#a8daf4', hill: '#7d9fcc', hill2: '#9ab8de', path: '#d2a86c' },
  autumn: { grass: '#b4a44a', grass2: '#c8b45a', dark: '#8a6a32', sky: '#d8e2ea', hill: '#9aa6c0', hill2: '#b4bed2', path: '#c89a5e' },
  winter: { grass: '#e6eef4', grass2: '#f4f8fb', dark: '#b8c8d6', sky: '#e8eef2', hill: '#b8c4d4', hill2: '#ccd6e2', path: '#d8d0c8' },
};

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function ctx2d(cv) {
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  return c;
}
function px(c, color, x, y, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), w, h);
}
function blob(c, color, cx, cy, r) {
  c.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function tree(c, x, y, r, crown, trunk = '#6a4a32') {
  px(c, trunk, x - 1, y, 2, Math.max(3, Math.round(r * 0.8)));
  blob(c, OUTLINE, x, y - r + 1, r + 1);
  blob(c, crown, x, y - r, r);
  blob(c, 'rgba(255,255,255,0.18)', x - Math.round(r / 3), y - r - Math.round(r / 3), Math.max(1, Math.round(r / 3)));
}

function drawBgFallback(c, season) {
  const P = PAL[season] || PAL.summer;
  px(c, P.sky, 0, 0, VIEW_W, 44);
  // Collines bleues au loin
  for (let x = 0; x < VIEW_W; x++) {
    const h1 = 18 + Math.round(6 * Math.sin(x * 0.05) + 4 * Math.sin(x * 0.13));
    const h2 = 10 + Math.round(5 * Math.sin(x * 0.07 + 1.3));
    px(c, P.hill2, x, 44 - h1, 1, h1);
    px(c, P.hill, x, 44 - h2, 1, h2);
  }
  px(c, P.grass, 0, 40, VIEW_W, VIEW_H - 40);
  for (let y = 40; y < VIEW_H; y += 3) for (let x = (y * 7) % 5; x < VIEW_W; x += 6) if (hash(x, y) < 0.35) px(c, P.grass2, x, y, 1, 1);
  if (season === 'spring') for (let k = 0; k < 90; k++) px(c, '#ffffff', hash(k, 1) * VIEW_W, 44 + hash(k, 2) * 380, 1, 1);
  if (season === 'autumn') for (let k = 0; k < 90; k++) px(c, hash(k, 3) < 0.5 ? '#d8782a' : '#e8b83a', hash(k, 1) * VIEW_W, 44 + hash(k, 2) * 380, 1, 1);
  // Chemins de terre entre les lieux
  px(c, P.path, 96, 44, 14, 110);
  px(c, P.path, 92, 140, 100, 12);
  px(c, P.path, 90, 236, 102, 14);
  px(c, P.path, 92, 300, 8, 24);
  // Le chemin du village et le clocher
  px(c, P.path, 0, 398, VIEW_W, 12);
  px(c, '#b8a088', 168, 384, 10, 16);
  px(c, '#8a4a3a', 166, 378, 14, 6);
  px(c, '#6a6a7a', 171, 368, 4, 10);
  px(c, OUTLINE, 172, 364, 2, 4);
}

function drawBrookFallback(c, step, r) {
  const dry = step <= 0;
  const w = step <= 0 ? 7 : step === 1 ? 3 : step === 2 ? 8 : 11;
  for (let y = 0; y < r.h; y++) {
    const cx = r.x + brookCenter(y);
    const bed = Math.max(w, 8);
    px(c, dry ? '#c8b896' : '#b8a888', cx - bed - 1, r.y + y, bed * 2 + 2, 1);
    if (!dry) {
      px(c, step >= 3 ? '#2f6fae' : '#4a90c8', cx - w, r.y + y, w * 2, 1);
      if ((y + step * 3) % 9 === 0) px(c, '#d8f0ff', cx - Math.round(w / 2), r.y + y, 2, 1);
    }
    if (dry && hash(y, 5) < 0.35) px(c, '#f2eee4', cx - 4 + Math.round(hash(y, 6) * 8), r.y + y, 2, 1);
  }
  if (step >= 2) {
    for (let k = 0; k < 6; k++) {
      const y = 20 + k * 48;
      const cx = r.x + brookCenter(y);
      tree(c, cx + (k % 2 ? 16 : -16), r.y + y, step >= 3 ? 7 : 4, step >= 3 ? '#5a9a3a' : '#7ab84a');
    }
  }
  if (step >= 4) {
    const y = 214;
    const cx = r.x + brookCenter(y);
    px(c, OUTLINE, cx - 15, r.y + y - 1, 30, 8);
    px(c, '#a8a098', cx - 14, r.y + y, 28, 6);
    px(c, '#d0c8bc', cx - 14, r.y + y, 28, 2);
  }
}

function drawCombeFallback(c, step, r, season) {
  const P = PAL[season] || PAL.summer;
  if (step <= 0) {
    px(c, '#9a7a52', r.x + 4, r.y + 6, r.w - 8, r.h - 10);
    for (let k = 0; k < 22; k++) {
      const x = r.x + 8 + hash(k, 11) * (r.w - 16);
      const y = r.y + 10 + hash(k, 12) * (r.h - 20);
      if (k % 3) px(c, '#5a3a22', x, y, 4, 3);
      else blob(c, '#6a5a3a', x, y, 3);
    }
    return;
  }
  px(c, P.dark, r.x + 2, r.y + 4, r.w - 4, r.h - 6);
  const n = step === 1 ? 14 : step === 2 ? 12 : 9;
  for (let k = 0; k < n; k++) {
    const x = r.x + 10 + hash(k, 21) * (r.w - 20);
    const y = r.y + 18 + hash(k, 22) * (r.h - 26);
    if (step === 1) {
      px(c, '#c8a878', x, y - 6, 1, 7);
      blob(c, '#7ab84a', x + 2, y - 4, 2);
    } else if (step === 2) {
      if (k % 2) {
        px(c, '#f0f0e8', x, y - 6, 2, 9);
        blob(c, season === 'autumn' ? '#e8b83a' : '#9ad06a', x + 1, y - 8, 4);
      } else tree(c, x, y, 5, season === 'autumn' ? '#c8782a' : '#5aa040');
    } else tree(c, x, y, 9, season === 'autumn' ? '#b8682a' : season === 'winter' ? '#8a9aa8' : '#3a7a34', '#5a3a26');
  }
}

function drawOrchardFallback(c, step, r, season) {
  for (let k = 0; k < 6; k++) {
    const x = r.x + 14 + (k % 3) * 26;
    const y = r.y + 30 + Math.floor(k / 3) * 34;
    const crown = step >= 2 && season === 'spring' ? (k % 2 ? '#f6d0e0' : '#ffffff') : step <= 0 ? '#8a9a6a' : season === 'autumn' ? '#b89a3a' : season === 'winter' ? '#a8b0b8' : '#5aa040';
    tree(c, x, y, step <= 0 ? 7 : 6, crown, step <= 0 ? '#5a4030' : '#6a4a32');
    if (step >= 1) px(c, '#ffffff', x + 3, y + 2, 3, 2);
    if (step >= 2 && season !== 'winter') for (let j = 0; j < 3; j++) px(c, '#e8483a', x - 4 + j * 3, y - 6 + (j % 2) * 3, 1, 1);
  }
  if (step <= 0) for (let k = 0; k < 30; k++) px(c, '#c8b86a', r.x + hash(k, 31) * r.w, r.y + hash(k, 32) * r.h, 1, 2);
  if (step >= 3) {
    px(c, '#8a5a32', r.x + 54, r.y + 66, 16, 4);
    px(c, '#f2e8d0', r.x + 6, r.y + 64, 12, 8);
    px(c, OUTLINE, r.x + 11, r.y + 72, 2, 6);
  }
}

function drawPondFallback(c, step, r) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2 - 4;
  const ry = r.h / 2 - 5;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    px(c, step <= 0 ? '#8a6a46' : '#3a7ab8', cx - w, cy + dy, w * 2, 1);
  }
  if (step <= 0) {
    for (let k = 0; k < 16; k++) px(c, '#5a4030', cx - rx + hash(k, 41) * rx * 2, cy - ry + 3 + hash(k, 42) * (ry * 2 - 6), 5, 1);
    for (let k = 0; k < 8; k++) px(c, '#c8b07a', r.x + 4 + k * 9, r.y + r.h - 8, 1, 6);
    return;
  }
  px(c, '#9ad0f0', cx - 10, cy - 6, 8, 1);
  if (step >= 2) for (let k = 0; k < 5; k++) blob(c, '#4a9a3a', cx - rx + 8 + k * 12, cy + (k % 2 ? 4 : -4), 2), px(c, '#ffffff', cx - rx + 8 + k * 12, cy + (k % 2 ? 4 : -4), 1, 1);
  if (step >= 2) px(c, '#8a5a32', r.x + 6, r.y + 4, 10, 3);
  const reeds = step >= 3 ? 22 : 8;
  for (let k = 0; k < reeds; k++) px(c, step >= 3 ? '#d8b04a' : '#7a9a4a', r.x + 2 + hash(k, 43) * (r.w - 4), r.y + (k % 2 ? 2 : r.h - 9), 1, 7);
}

function drawMillFallback(c, brookStep, frame, r) {
  const ruin = brookStep < 4;
  px(c, OUTLINE, r.x + 7, r.y + 13, 22, 34);
  px(c, ruin ? '#9a9088' : '#d8c8a8', r.x + 8, r.y + 14, 20, 32);
  px(c, ruin ? '#6a5a50' : '#b8483a', r.x + 6, r.y + 8, 24, 7);
  if (ruin) px(c, '#3a2a2a', r.x + 14, r.y + 8, 6, 4);
  px(c, '#5a3a2a', r.x + 15, r.y + 36, 6, 10);
  // Roue
  const wx = r.x + 4;
  const wy = r.y + 32;
  blob(c, OUTLINE, wx, wy, 8);
  blob(c, ruin ? '#6a5a4a' : '#8a5a32', wx, wy, 7);
  blob(c, '#3a2a22', wx, wy, 2);
  const a = (frame ? 0.4 : 0) + (ruin ? 0.2 : 0);
  for (let k = 0; k < (ruin ? 3 : 6); k++) {
    const t = a + (k * Math.PI) / 3;
    px(c, '#c8a878', wx + Math.round(Math.cos(t) * 6), wy + Math.round(Math.sin(t) * 6), 2, 2);
  }
}

function drawPoppiesFallback(c, step, r, season) {
  const base = step <= 0 ? '#d8c060' : season === 'winter' ? '#e6eef4' : season === 'autumn' ? '#b8a84a' : '#7ac050';
  px(c, base, r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  if (step <= 0) {
    for (let k = 0; k < 18; k++) px(c, '#a8a090', r.x + 4 + hash(k, 51) * (r.w - 8), r.y + 4 + hash(k, 52) * (r.h - 8), 2, 2);
    return;
  }
  const flowers = step === 1 ? 10 : step === 2 ? 46 : 40;
  for (let k = 0; k < flowers; k++) {
    const col = step >= 3 && k % 3 === 0 ? '#b46ac8' : step >= 2 && k % 4 === 0 ? '#4a6ad8' : step >= 2 ? '#e8283a' : '#f2f2f2';
    if (season === 'winter') break;
    px(c, col, r.x + 4 + hash(k, 53) * (r.w - 8), r.y + 4 + hash(k, 54) * (r.h - 8), 2, 2);
  }
  if (step >= 3) for (let k = 0; k < 4; k++) px(c, '#8a5a32', r.x + 8 + k * 20, r.y + r.h - 16, 2, 10);
}

function drawBocageFallback(c, step, r, season) {
  px(c, '#c8a46a', r.x, r.y + 24, r.w, 16);
  px(c, '#b0884e', r.x, r.y + 30, r.w, 3);
  if (step <= 0) {
    px(c, '#b89a6a', r.x, r.y + 14, r.w, 10);
    px(c, '#b89a6a', r.x, r.y + 40, r.w, 10);
    return;
  }
  const hedge = season === 'winter' ? '#8a9a8a' : season === 'autumn' ? '#9a7a3a' : '#3d8a3c';
  const big = step >= 2 ? 6 : 3;
  for (let x = 4; x < r.w; x += step >= 2 ? 9 : 14) {
    blob(c, hedge, r.x + x, r.y + 16, big);
    blob(c, hedge, r.x + x + 4, r.y + 46, big);
    if (step >= 2 && season !== 'winter' && hash(x, 61) < 0.4) px(c, season === 'spring' ? '#ffffff' : '#c8283a', r.x + x, r.y + 14, 1, 1);
  }
  if (step >= 3) for (let k = 0; k < 4; k++) {
    const x = r.x + 22 + k * 46;
    px(c, '#6a4a32', x - 2, r.y + 4, 5, 14);
    blob(c, season === 'winter' ? '#a8b0b8' : '#8ab05a', x, r.y + 4, 6);
  }
}

function drawFarmFallback(c, tier, r) {
  const t = Math.max(1, Math.min(4, tier || 1));
  if (t >= 4) for (let x = 0; x < r.w; x += 4) blob(c, '#3d8a3c', r.x + x, r.y + 2, 2), blob(c, '#3d8a3c', r.x + x, r.y + r.h - 2, 2);
  // Champs en damier
  const n = t === 1 ? 1 : t === 2 ? 4 : 6;
  for (let k = 0; k < n; k++) px(c, k % 2 ? '#c8a050' : '#8a6a3a', r.x + 4 + (k % 3) * 13, r.y + 26 + Math.floor(k / 3) * 9, 12, 8);
  px(c, OUTLINE, r.x + 13, r.y + 7, 18, 15);
  px(c, '#f2e2c8', r.x + 14, r.y + 10, 16, 11);
  px(c, t >= 4 ? '#7a4aa8' : '#b8483a', r.x + 12, r.y + 6, 20, 5);
  px(c, '#5a3a2a', r.x + 20, r.y + 15, 4, 6);
  if (t >= 2) px(c, '#a8483a', r.x + 33, r.y + 10, 10, 11);
  if (t >= 3) blob(c, '#3a7ab8', r.x + 40, r.y + 40, 4);
  if (t >= 4) px(c, '#f2c23a', r.x + 30, r.y + 1, 1, 6), px(c, '#f2c23a', r.x + 31, r.y + 1, 4, 3);
}

function drawWorksFallback(c, x, y) {
  px(c, '#8a5a32', x + 2, y + 10, 2, 16);
  px(c, '#8a5a32', x + 26, y + 10, 2, 16);
  px(c, '#e8e0d0', x + 3, y + 12, 24, 1);
  px(c, OUTLINE, x + 9, y + 5, 14, 9);
  px(c, '#c89a5e', x + 10, y + 6, 12, 7);
  px(c, '#6a6a6a', x + 18, y + 20, 8, 5);
  px(c, OUTLINE, x + 17, y + 25, 2, 2);
}

function drawSproutFallback(c, x, y) {
  px(c, '#3d8a3c', x + 7, y + 8, 2, 6);
  px(c, '#7ac050', x + 4, y + 7, 4, 2);
  px(c, '#7ac050', x + 9, y + 6, 4, 2);
}

function drawAnimalFallback(c, id, x, y, frame) {
  const [a, b] = WILD_COLORS[id] || ['#8a6a4a', '#e8d8b0'];
  blob(c, OUTLINE, x + 8, y + 10 - frame, 5);
  blob(c, a, x + 8, y + 10 - frame, 4);
  blob(c, b, x + 6, y + 9 - frame, 2);
  px(c, OUTLINE, x + 5, y + 8 - frame, 1, 1);
}

function drawMushFallback(c, kind, x, y) {
  const [cap, stem] = MUSH_COLORS[kind] || MUSH_COLORS.cep;
  px(c, stem, x + 6, y + 9, 4, 5);
  blob(c, OUTLINE, x + 8, y + 8, 5);
  blob(c, cap, x + 8, y + 7, 4);
  px(c, 'rgba(255,255,255,0.5)', x + 6, y + 5, 2, 1);
}

function drawPontoonFallback(c, r) {
  px(c, OUTLINE, r.x + 1, r.y + 5, 14, 7);
  px(c, '#b8844e', r.x + 2, r.y + 6, 12, 5);
  px(c, '#8a5a32', r.x + 2, r.y + 11, 2, 4);
  px(c, '#8a5a32', r.x + 12, r.y + 11, 2, 4);
  px(c, '#6a4a32', r.x + 9, r.y, 1, 7);
  px(c, '#e8e0d0', r.x + 10, r.y + 1, 4, 1);
}

function drawBenchFallback(c, r) {
  px(c, OUTLINE, r.x + 3, r.y + 5, 26, 6);
  px(c, '#a8784a', r.x + 4, r.y + 6, 24, 4);
  px(c, '#6a4a32', r.x + 6, r.y + 10, 2, 5);
  px(c, '#6a4a32', r.x + 24, r.y + 10, 2, 5);
}

function drawPersonFallback(c, x, y, coat, frame) {
  px(c, OUTLINE, x + 5, y + 2, 6, 6);
  px(c, '#f0c8a0', x + 6, y + 3, 4, 4);
  px(c, OUTLINE, x + 4, y + 7, 8, 7);
  px(c, coat, x + 5, y + 8, 6, 5);
  px(c, '#3a3a4a', x + 5 + (frame ? 1 : 0), y + 13, 2, 3);
  px(c, '#3a3a4a', x + 9 - (frame ? 1 : 0), y + 13, 2, 3);
}

// ── Vue ─────────────────────────────────────────────────────────────────────────────

export function createValleyView(canvas, images, opts = {}) {
  let imgs = images || null;
  let reduced = !!opts.reducedMotion;
  let layout = viewLayout({ cssW: canvas?.clientWidth || 412, cssH: canvas?.clientHeight || 915, dpr: 1 });
  const ctx = canvas ? ctx2d(canvas) : null;
  const world = makeCanvas(VIEW_W, VIEW_H);
  const wctx = ctx2d(world);
  const stat = makeCanvas(VIEW_W, VIEW_H);
  const sctx = ctx2d(stat);
  const tintCache = new Map();
  let staticKey = '';
  let scroll = 0; // px CSS
  let flingV = 0; // px CSS / s
  let scrollAnim = null; // { from, to, t, dur }
  let overlay = 0; // px CSS couverts en bas par une feuille
  let time = 0;
  let lastView = null;
  const known = {}; // placeId → étape vue (fondus)
  const fades = []; // { id, from, to, t }
  const sparks = []; // { x, y, t }
  let drawn = 0;
  // (V4) Teinte du soir, défilement automatique (générique, contemplation).
  let tint = 0;
  let auto = null; // { mode, from, to, dur, t, speed, dir }
  let autoPaused = false;

  const has = (name) => canDraw(imgs, name);
  let seasonSets = null;
  /** Planches de saison (src/render/assets.js, en cache par jeu d'images : celles de la scène). */
  function seasonSet(season) {
    if (!imgs) return imgs;
    if (!seasonSets) {
      try {
        seasonSets = buildSeasonSheets(imgs);
      } catch {
        seasonSets = {};
      }
    }
    return seasonSets[season] || imgs;
  }
  const seasonOf = (v) => (SEASONS.includes(v?.season) ? v.season : 'summer');
  const maxScroll = () => layout.scrollMax + Math.max(0, overlay);

  function resize(l) {
    layout = l || layout;
    if (canvas) {
      if (canvas.width !== layout.dev.w) canvas.width = layout.dev.w;
      if (canvas.height !== layout.dev.h) canvas.height = layout.dev.h;
      if (canvas.style) {
        canvas.style.width = `${layout.cssW}px`;
        canvas.style.height = `${layout.cssH}px`;
      }
      if (ctx) ctx.imageSmoothingEnabled = false;
    }
    scroll = Math.max(0, Math.min(maxScroll(), scroll));
  }

  /** Sprite teinté selon la saison (lieux dessinés en été ; givre l'hiver). */
  function tinted(name, season) {
    const key = `${name}|${season}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const s = SPRITES[name];
    const w = Math.round((s.w || 1) * TILE);
    const h = Math.round((s.h || 1) * TILE);
    const cv = makeCanvas(w, h);
    const c = ctx2d(cv);
    // Lieux dessinés en été : tirés des planches de saison (herbe recolorée comme sur la ferme) ; givre posé ici l'hiver.
    drawSprite(c, seasonSet(season), name, 0, 0);
    if (season === 'winter') {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(226,236,248,0.28)';
      c.fillRect(0, 0, w, h);
      {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        for (let k = 0; k < Math.round((w * h) / 90); k++) c.fillRect(Math.floor(hash(name, k) * w), Math.floor(hash(k, name) * h), 1, 1);
      }
      c.globalCompositeOperation = 'source-over';
    }
    tintCache.set(key, cv);
    return cv;
  }

  function drawPlace(c, id, step, season, r) {
    const name = placeSpriteName(id, step);
    if (has(name)) {
      c.drawImage(tinted(name, season), r.x, r.y);
      return;
    }
    if (id === 'brook') drawBrookFallback(c, step, r);
    else if (id === 'combe') drawCombeFallback(c, step, r, season);
    else if (id === 'oldOrchard') drawOrchardFallback(c, step, r, season);
    else if (id === 'millpond') drawPondFallback(c, step, r);
    else if (id === 'poppies') drawPoppiesFallback(c, step, r, season);
    else if (id === 'bocage') drawBocageFallback(c, step, r, season);
    if (season === 'winter' && id !== 'brook') {
      c.fillStyle = 'rgba(240,246,252,0.35)';
      c.fillRect(r.x, r.y, r.w, r.h);
    }
  }

  function placeStep(v, id) {
    return Math.max(0, Math.floor((v.places || []).find((p) => p.id === id)?.step || 0));
  }

  function staticKeyOf(v) {
    const pl = (v.places || []).map((p) => `${p.id}:${p.step}:${p.works ? sproutCount(p.progress) : '-'}`).join(',');
    return `${seasonOf(v)}|${pl}|${v.farmTier || 1}|${v.river?.step ?? 0}|${!!imgs}|${v.beaverDam ? 'D' : ''}`;
  }

  function buildStatic(v) {
    const season = seasonOf(v);
    const c = sctx;
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    const bg = `view.bg.${season}`;
    if (has(bg)) drawSprite(c, imgs, bg, 0, 0);
    else drawBgFallback(c, season);
    // Ordre : les lieux du haut, puis le ruisseau (il passe devant l'étang), puis le bocage (le ruisseau passe dessous :
    // la bande du ruisseau y est transparente), la ferme.
    for (const id of ['combe', 'oldOrchard', 'millpond', 'poppies']) drawPlace(c, id, placeStep(v, id), season, PLACE_RECTS[id]);
    drawPlace(c, 'brook', placeStep(v, 'brook'), season, PLACE_RECTS.brook);
    drawPlace(c, 'bocage', placeStep(v, 'bocage'), season, PLACE_RECTS.bocage);
    const farm = farmSpriteName(v.farmTier);
    if (has(farm)) drawSprite(c, seasonSet(season), farm, FARM_RECT.x, FARM_RECT.y);
    else drawFarmFallback(c, v.farmTier, FARM_RECT);
    // Ponton (dès que le ruisseau chante).
    if ((v.river?.step ?? placeStep(v, 'brook')) >= 2) {
      if (has('view.pontoon')) drawSprite(c, imgs, 'view.pontoon', PONTOON_RECT.x, PONTOON_RECT.y);
      else drawPontoonFallback(c, PONTOON_RECT);
    }
    if (has('view.bench')) drawSprite(c, imgs, 'view.bench', BENCH_RECT.x, BENCH_RECT.y);
    else drawBenchFallback(c, BENCH_RECT);
    // (V4) Le barrage du castor, toute l'année une fois le castor vu.
    if (v.beaverDam) {
      if (has('view.beaverDam')) drawSprite(c, seasonSet(season), 'view.beaverDam', BEAVER_DAM_RECT.x, BEAVER_DAM_RECT.y);
      else {
        px(c, OUTLINE, BEAVER_DAM_RECT.x + 2, BEAVER_DAM_RECT.y + 6, 28, 6);
        px(c, '#8a5a32', BEAVER_DAM_RECT.x + 3, BEAVER_DAM_RECT.y + 7, 26, 4);
        blob(c, '#6a4a32', BEAVER_DAM_RECT.x + 26, BEAVER_DAM_RECT.y + 6, 5);
      }
    }
    // Chantiers en cours : panneau et pousses (nombre de pousses = progression).
    for (const p of v.places || []) {
      if (!p.works) continue;
      const r = PLACE_RECTS[p.id];
      if (!r) continue;
      const wx = p.id === 'brook' ? r.x + 18 : p.id === 'bocage' ? r.x + 84 : r.x + Math.round(r.w / 2) - 16;
      const wy = p.id === 'brook' ? r.y + 150 : p.id === 'bocage' ? r.y + 2 : r.y + Math.round(r.h / 2) - 18;
      if (has('place.works')) drawSprite(c, imgs, 'place.works', wx, wy);
      else drawWorksFallback(c, wx, wy);
      const n = sproutCount(p.progress);
      for (let k = 0; k < n; k++) {
        const sx = r.x + 6 + Math.floor(hash(p.id, k) * Math.max(8, r.w - 22));
        const sy = (p.id === 'brook' ? r.y + 130 : r.y + 6) + Math.floor(hash(k, p.id) * Math.max(8, Math.min(r.h, 80) - 22));
        if (has('place.sprouts')) drawSprite(c, imgs, 'place.sprouts', sx, sy);
        else drawSproutFallback(c, sx, sy);
      }
    }
  }

  function noteSteps(v) {
    const first = !lastView;
    for (const p of v.places || []) {
      const was = known[p.id];
      if (!first && was !== undefined && p.step > was && !reduced) {
        fades.push({ id: p.id, from: was, to: p.step, t: 0 });
        const r = PLACE_RECTS[p.id];
        if (r) for (let k = 0; k < 12; k++) sparks.push({ x: r.x + hash(p.id, k + 9) * r.w, y: r.y + hash(k + 9, p.id) * Math.min(r.h, 120), t: -k * 0.06 });
      }
      known[p.id] = p.step;
    }
    lastView = v;
  }

  function drawFrame(v, dt) {
    const season = seasonOf(v);
    const c = wctx;
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    c.drawImage(stat, 0, 0);
    drawn = 1;
    const frame = reduced ? 0 : Math.floor(time * 2) % 2;
    // Eau qui coule (2 images ; mouvements réduits : fixe).
    const bStep = placeStep(v, 'brook');
    if (bStep >= 1 && !reduced) {
      const r = PLACE_RECTS.brook;
      for (let k = 0; k < 7; k++) {
        const y = ((k * 46 + Math.floor(time * 18)) % (r.h - 16)) + 4;
        const cx = r.x + brookCenter(y) - 8;
        if (has('fx.ripple')) drawSprite(c, imgs, frame ? 'fx.ripple.1' : 'fx.ripple', cx, r.y + y);
        else px(c, 'rgba(230,248,255,0.85)', cx + 6, r.y + y, 3, 1);
      }
    }
    // Moulin (roue qui tourne une fois le ruisseau à l'étape 4).
    const mill = millSpriteName(bStep, bStep >= 4 ? frame : 0);
    if (has(mill)) drawSprite(c, seasonSet(season), mill, MILL_RECT.x, MILL_RECT.y);
    else drawMillFallback(c, bStep, bStep >= 4 ? frame : 0, MILL_RECT);
    // Fondus d'une étape à l'autre : l'ancien état s'efface (1,2 s).
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      f.t += dt;
      const r = PLACE_RECTS[f.id];
      const a = 1 - f.t / FADE_S;
      if (a <= 0 || !r) {
        fades.splice(i, 1);
        continue;
      }
      c.globalAlpha = a;
      drawPlace(c, f.id, f.from, season, r);
      c.globalAlpha = 1;
    }
    // Champignons
    for (const m of v.mushrooms || []) {
      const s = MUSHROOM_SPOTS[m.spot] || MUSHROOM_SPOTS[0];
      const name = `find.${m.kind}`;
      if (has(name)) drawSprite(c, imgs, name, s.x, s.y);
      else drawMushFallback(c, m.kind, s.x, s.y);
      if (!reduced && Math.sin(time * 3 + m.spot) > 0.7) px(c, '#fff8c0', s.x + 12, s.y + 2, 1, 1);
    }
    // Habitants : indice au sol, bête qui attend (« ? »), habitants installés qui passent (4 au plus).
    const anim = v.animals || [];
    let residents = 0;
    anim.forEach((a, i) => {
      const k = anim.slice(0, i).filter((b) => b.state === a.state && !ANIMAL_ANCHORS[a.id]).length;
      const r = animalRect(a.id, k);
      if (a.state === 'hint') {
        const hint = a.hintIcon || VALLEY_SPECIES_BY_ID[a.id]?.hintIcon || 'wild.hint.tracks';
        if (has(hint)) drawSprite(c, imgs, hint, r.x, r.y + 4);
        else px(c, '#5a4030', r.x + 5, r.y + 12, 2, 2), px(c, '#5a4030', r.x + 9, r.y + 9, 2, 2);
        return;
      }
      if (a.state === 'resident') {
        if (residents >= 4) return;
        residents += 1;
      }
      const name = `wild.${a.id}`;
      const bob = a.state === 'resident' && !reduced ? Math.round(Math.sin(time * 1.3 + i) * 6) : 0;
      if (has(name)) drawSprite(c, imgs, frame && has(`${name}.1`) ? `${name}.1` : name, r.x + bob, r.y);
      else drawAnimalFallback(c, a.id, r.x + bob, r.y, frame);
      if (a.state === 'visible') {
        const up = reduced ? 0 : Math.round(Math.sin(time * 4) * 1.5);
        px(c, OUTLINE, r.x + 4, r.y - 13 + up, 9, 10);
        px(c, '#fff3b0', r.x + 5, r.y - 12 + up, 7, 8);
        px(c, OUTLINE, r.x + 7, r.y - 11 + up, 3, 1);
        px(c, OUTLINE, r.x + 9, r.y - 10 + up, 1, 2);
        px(c, OUTLINE, r.x + 8, r.y - 8 + up, 1, 1);
        px(c, OUTLINE, r.x + 8, r.y - 6 + up, 1, 1);
      }
    });
    // (V4) Joseph et Hélène assis sur le banc (après l'épilogue, ou Joseph qui attend pour l'épilogue / un récit).
    const bench = v.bench || null;
    const seated = !!(bench && (bench.joseph || bench.helene));
    if (seated) {
      const jx = BENCH_RECT.x + 4;
      const hx = BENCH_RECT.x + 14;
      const sy = BENCH_RECT.y - 7;
      if (bench.helene) {
        if (has('view.helene.seated')) drawSprite(c, imgs, 'view.helene.seated', hx, sy);
        else drawPersonFallback(c, hx, sy, '#3a7a4a', 0);
      }
      if (bench.joseph) {
        if (has('view.joseph.seated')) drawSprite(c, imgs, 'view.joseph.seated', jx, sy);
        else drawPersonFallback(c, jx, sy, '#4a6a9a', 0);
        if (bench.joseph === 'epilogue' || bench.joseph === 'story') {
          const up = reduced ? 0 : Math.round(Math.sin(time * 3) * 1.5);
          px(c, OUTLINE, jx + 4, sy - 11 + up, 9, 8);
          px(c, '#ffffff', jx + 5, sy - 10 + up, 7, 6);
          px(c, OUTLINE, jx + 6, sy - 8 + up, 1, 1), px(c, OUTLINE, jx + 8, sy - 8 + up, 1, 1), px(c, OUTLINE, jx + 10, sy - 8 + up, 1, 1);
        }
      }
    }
    // Joseph sur le banc du belvédère (un récit l'attend).
    if (v.joseph && !seated) {
      const jx = BENCH_RECT.x + 8;
      const jy = BENCH_RECT.y - 6;
      if (has('npc.joseph')) drawSprite(c, imgs, 'npc.joseph', jx, jy);
      else drawPersonFallback(c, jx, jy, '#4a6a9a', 0);
      const up = reduced ? 0 : Math.round(Math.sin(time * 3) * 1.5);
      px(c, OUTLINE, jx + 4, jy - 11 + up, 9, 8);
      px(c, '#ffffff', jx + 5, jy - 10 + up, 7, 6);
      px(c, OUTLINE, jx + 6, jy - 8 + up, 1, 1), px(c, OUTLINE, jx + 8, jy - 8 + up, 1, 1), px(c, OUTLINE, jx + 10, jy - 8 + up, 1, 1);
    }
    // Hélène se promène (décor ; mouvements réduits : jumelles levées, immobile).
    if (v.helene && !(bench && bench.helene)) {
      const P = HELENE_PATH;
      const t = reduced ? 0.5 : (Math.sin(time * 0.25) + 1) / 2;
      const seg = Math.min(P.length - 2, Math.floor(t * (P.length - 1)));
      const u = t * (P.length - 1) - seg;
      const hx = Math.round(P[seg].x + (P[seg + 1].x - P[seg].x) * u);
      const hy = Math.round(P[seg].y + (P[seg + 1].y - P[seg].y) * u);
      const name = reduced || Math.sin(time * 0.7) > 0.6 ? 'view.helene.1' : 'view.helene';
      if (has(name)) drawSprite(c, imgs, name, hx, hy - 16);
      else drawPersonFallback(c, hx, hy - 16, '#3a7a4a', frame);
    }
    drawV4(c, v, frame);
    // Brume du matin et vols d'oiseaux (étape ≥ 6).
    if ((v.stage || 0) >= 6) {
      if (reduced) {
        c.fillStyle = 'rgba(255,255,255,0.10)';
        c.fillRect(0, 44, VIEW_W, 30);
      } else {
        for (let k = 0; k < 4; k++) {
          const x = ((k * 70 + time * 6) % (VIEW_W + 40)) - 40;
          if (has('fx.mist')) {
            c.globalAlpha = 0.55;
            drawSprite(c, imgs, 'fx.mist', x, 50 + k * 22);
            c.globalAlpha = 1;
          } else {
            c.fillStyle = 'rgba(255,255,255,0.22)';
            c.fillRect(Math.round(x), 54 + k * 22, 32, 6);
          }
        }
        const bx = ((time * 22) % (VIEW_W + 60)) - 30;
        if (has('fx.birds')) drawSprite(c, imgs, 'fx.birds', bx, 12);
        else for (let k = 0; k < 3; k++) px(c, OUTLINE, bx + k * 7, 14 + (k % 2) * 3, 3, 1);
      }
    }
    // Étincelles d'une étape atteinte
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.t += dt;
      if (s.t > 1.1) {
        sparks.splice(i, 1);
        continue;
      }
      if (s.t < 0) continue;
      const a = 1 - s.t / 1.1;
      c.globalAlpha = a;
      px(c, '#fff3b0', s.x, s.y - s.t * 10, 2, 2);
      c.globalAlpha = 1;
    }
  }

  /** (V4) Visiteurs, clocher, fenêtres du village, teinte du soir. */
  function drawV4(c, v, frame) {
    const list = v.visitors || [];
    const steeple = v.steeple || null;
    // Le couple sur le clocher (qui attend d'être vu, ou chaque printemps-été une fois vu).
    const atSteeple = list.find((x) => x.id === 'whiteStork');
    if ((steeple && steeple.storks > 0) || atSteeple) {
      const r = visitorRect('whiteStork', 'steeple');
      if (has('stork.steeple')) drawSprite(c, imgs, 'stork.steeple', r.x, r.y);
      else {
        px(c, '#6a6a7a', r.x + 5, r.y + 8, 6, 16);
        px(c, OUTLINE, r.x + 2, r.y + 6, 12, 3);
        px(c, '#8a6a42', r.x + 3, r.y + 6, 10, 2);
        px(c, '#f4f4f0', r.x + 4, r.y, 2, 6), px(c, '#f4f4f0', r.x + 10, r.y + 1, 2, 5);
        px(c, '#d8382a', r.x + 3, r.y + 1, 1, 1), px(c, '#d8382a', r.x + 12, r.y + 2, 1, 1);
      }
      if (atSteeple?.state === 'visible') drawQuestion(c, r.x + 4, r.y - 12);
    }
    let residents = 0;
    for (const x of list) {
      if (x.id === 'whiteStork') continue;
      const r = visitorRect(x.id, x.anchor);
      if (x.state === 'hint') {
        const hint = x.hintIcon || 'visitor.hint.trumpet';
        if (has(hint)) drawSprite(c, imgs, hint, r.x + Math.round((r.w - 16) / 2), r.y + r.h - 16);
        else px(c, '#5a4030', r.x + r.w / 2 - 1, r.y + r.h - 4, 2, 2);
        continue;
      }
      if (x.state === 'resident') {
        if (residents >= 3) continue;
        residents += 1;
        // Les vers luisants ne se voient que le soir (lueurs vertes dans la prairie).
        if (x.id === 'glowworms') {
          if ((tint > 0 || v.villageLights) && !reduced) drawGlowField(c, r);
          else if (tint > 0 || v.villageLights) drawGlowField(c, r, true);
          continue;
        }
      }
      if (x.id === 'glowworms') {
        drawGlowField(c, r, reduced);
        if (x.state === 'visible') drawQuestion(c, r.x + 4, r.y - 12);
        continue;
      }
      const name = visitorSpriteName(x.id, frame);
      const sway = x.state === 'resident' && !reduced && x.id !== 'redDeer' ? Math.round(Math.sin(time * 0.9 + r.x) * 3) : 0;
      if (has(name)) drawSprite(c, imgs, name, r.x + sway, r.y);
      else if (has(visitorSpriteName(x.id, 0))) drawSprite(c, imgs, visitorSpriteName(x.id, 0), r.x + sway, r.y);
      else drawAnimalFallback(c, x.id === 'crane' ? 'heron' : x.id === 'redDeer' ? 'roeDeer' : x.id === 'oriole' ? 'hoopoe' : 'otter', r.x + sway + Math.round((r.w - 16) / 2), r.y + r.h - 16, frame);
      if (x.state === 'visible') drawQuestion(c, r.x + Math.round(r.w / 2) - 4, r.y - 12);
    }
    // Fenêtres du village qui s'allument le soir (et pendant le générique, au soir).
    if (v.villageLights || tint > 0) {
      for (const p of VILLAGE_LIGHTS) {
        if (has('view.village.lights')) drawSprite(c, imgs, 'view.village.lights', p.x, p.y);
        else px(c, '#f2d23a', p.x + 5, p.y + 8, 2, 2), px(c, '#f2d23a', p.x + 10, p.y + 8, 2, 2);
      }
    }
    if (tint > 0) {
      c.fillStyle = `rgba(255,168,72,${Math.min(0.5, tint)})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.fillStyle = `rgba(80,40,90,${Math.min(0.2, tint * 0.4)})`;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  function drawQuestion(c, x, y) {
    const up = reduced ? 0 : Math.round(Math.sin(time * 4) * 1.5);
    px(c, OUTLINE, x, y + up, 9, 9);
    px(c, '#fffbe8', x + 1, y + 1 + up, 7, 7);
    px(c, OUTLINE, x + 3, y + 9 + up, 3, 2);
    for (const [dx, dy] of [[3, 2], [4, 2], [5, 2], [5, 3], [4, 4], [4, 6]]) px(c, OUTLINE, x + dx, y + dy + up, 1, 1);
  }
  function drawGlowField(c, r, still = false) {
    for (let k = 0; k < 7; k++) {
      const gx = r.x - 10 + Math.round(hash(k, 71) * (r.w + 20));
      const gy = r.y + 2 + Math.round(hash(k, 73) * (r.h + 4));
      const on = still || Math.sin(time * 2.1 + k * 1.3) > -0.2;
      if (!on) continue;
      c.fillStyle = 'rgba(200,255,120,0.35)';
      c.fillRect(gx - 1, gy - 1, 3, 3);
      px(c, '#d8ff8a', gx, gy, 1, 1);
    }
  }

  function stepAuto(dt) {
    if (!auto || autoPaused || reduced) return;
    const a = auto;
    a.t += dt;
    if (a.mode === 'credits') {
      const k = Math.min(1, a.t / a.dur);
      scroll = a.from + (a.to - a.from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
      if (k >= 1) a.done = true;
    } else {
      // Contemplation : descend lentement, puis remonte, sans fin.
      scroll += a.dir * a.speed * dt;
      const m = maxScroll();
      if (scroll >= m) {
        scroll = m;
        a.dir = -1;
      } else if (scroll <= 0) {
        scroll = 0;
        a.dir = 1;
      }
    }
  }

  function stepScroll(dt) {
    stepAuto(dt);
    if (scrollAnim) {
      const a = scrollAnim;
      a.t = Math.min(a.dur, a.t + dt);
      const k = a.t / a.dur;
      scroll = a.from + (a.to - a.from) * (1 - (1 - k) ** 3);
      if (k >= 1) scrollAnim = null;
    } else if (flingV) {
      scroll += flingV * dt;
      flingV *= Math.exp(-dt * 4.5);
      if (Math.abs(flingV) < 8) flingV = 0;
    }
    const m = maxScroll();
    if (scroll < 0 || scroll > m) {
      scroll = Math.max(0, Math.min(m, scroll));
      flingV = 0;
    }
  }

  function render(view, dt = 0) {
    if (!ctx) return;
    const d = Math.max(0, Math.min(0.1, Number(dt) || 0));
    time += d;
    stepScroll(d);
    if (!view) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    noteSteps(view);
    const key = staticKeyOf(view);
    if (key !== staticKey) {
      staticKey = key;
      buildStatic(view);
    }
    drawFrame(view, d);
    const L = layout;
    const z = L.zoom;
    const top = Math.round(L.dev.top - scroll * L.dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const P = PAL[seasonOf(view)] || PAL.summer;
    // Au-dessus du monde : le ciel ; en dessous : le chemin.
    ctx.fillStyle = P.sky;
    ctx.fillRect(0, 0, L.dev.w, Math.max(0, top));
    ctx.fillStyle = P.grass;
    ctx.fillRect(0, top + VIEW_H * z, L.dev.w, Math.max(0, L.dev.h - top - VIEW_H * z));
    // Marges latérales : le bord du dessin prolongé (colonne étirée).
    if (L.dev.x0 > 0) {
      ctx.drawImage(world, 0, 0, 1, VIEW_H, 0, top, L.dev.x0, VIEW_H * z);
      ctx.drawImage(world, VIEW_W - 1, 0, 1, VIEW_H, L.dev.x0 + VIEW_W * z, top, L.dev.w - L.dev.x0 - VIEW_W * z, VIEW_H * z);
    }
    ctx.drawImage(world, 0, 0, VIEW_W, VIEW_H, L.dev.x0, top, VIEW_W * z, VIEW_H * z);
  }

  /** Point CSS (relatif au canevas) → monde. */
  function toWorld(x, y) {
    const L = layout;
    return { x: (x * L.dpr - L.dev.x0) / L.zoom, y: (y * L.dpr - L.dev.top + scroll * L.dpr) / L.zoom };
  }
  /** Rectangle du monde → px CSS (relatif au canevas). */
  function toCss(r) {
    const L = layout;
    const k = L.zoom / L.dpr;
    return { x: L.dev.x0 / L.dpr + r.x * k, y: L.dev.top / L.dpr - scroll + r.y * k, w: r.w * k, h: r.h * k };
  }

  function hitTest(x, y) {
    if (!lastView) return null;
    const w = toWorld(x, y);
    if (w.x < -8 || w.x > VIEW_W + 8) return null;
    return pickViewTarget(viewTargets(layout, lastView), Math.max(0, Math.min(VIEW_W - 0.01, w.x)), w.y);
  }

  function rectOfPlace(id) {
    if (id === 'farm') return FARM_RECT;
    if (id === 'river') return PONTOON_RECT;
    return PLACE_RECTS[id] || null;
  }

  function scrollTo(target, { animate = true } = {}) {
    const r = typeof target === 'string' ? rectOfPlace(target) : target;
    if (!r) return scroll;
    const L = layout;
    const k = L.zoom / L.dpr;
    const visH = L.dev.avail / L.dpr - Math.max(0, overlay);
    // Le lieu (ou son haut s'il est trop grand) au milieu de la partie visible.
    const focusY = r.h * k > visH ? r.y + Math.min(r.h, 80) / 2 : r.y + r.h / 2;
    const to = Math.max(0, Math.min(maxScroll(), focusY * k - visH / 2));
    flingV = 0;
    if (!animate || reduced) {
      scrollAnim = null;
      scroll = to;
    } else scrollAnim = { from: scroll, to, t: 0, dur: 0.32 };
    return to;
  }

  function targetRect(hit) {
    if (!hit || !lastView) return null;
    const t = viewTargets(layout, lastView).find((x) => x.hit.type === hit.type && (x.hit.id ?? null) === (hit.id ?? null));
    return t ? toCss(t.rect) : null;
  }

  return {
    render,
    resize,
    scrollBy(dy) {
      scrollAnim = null;
      flingV = 0;
      scroll = Math.max(0, Math.min(maxScroll(), scroll + (Number(dy) || 0)));
    },
    fling(vy) {
      scrollAnim = null;
      flingV = reduced ? 0 : Number(vy) || 0;
    },
    stopFling() {
      flingV = 0;
    },
    scrollTo,
    setOverlay(bottomCss) {
      overlay = Math.max(0, Number(bottomCss) || 0);
      scroll = Math.max(0, Math.min(maxScroll(), scroll));
    },
    hitTest,
    placeRect: (id) => {
      const r = rectOfPlace(id);
      return r ? toCss(r) : null;
    },
    targetRect,
    toWorld,
    toCss,
    setImages(i) {
      imgs = i;
      seasonSets = null;
      tintCache.clear();
      staticKey = '';
    },
    /** (V4) Teinte du soir (aplat doré), 0 = aucune. */
    setTint(a) {
      tint = Math.max(0, Math.min(0.5, Number(a) || 0));
    },
    /**
     * (V4) Défilement automatique : 'credits' (du ciel jusqu'à la ferme en `duration` s) ou 'contemplate' (descente et
     * remontée lentes, `speed` px CSS / s). Sans effet en mouvements réduits (l'interface saute d'un lieu à l'autre).
     */
    setAuto(opts = null) {
      if (!opts) {
        auto = null;
        autoPaused = false;
        return;
      }
      const L = layout;
      const k = L.zoom / L.dpr;
      const visH = L.dev.avail / L.dpr - Math.max(0, overlay);
      const farmTo = Math.max(0, Math.min(maxScroll(), (FARM_RECT.y + FARM_RECT.h / 2) * k - visH / 2));
      scrollAnim = null;
      flingV = 0;
      autoPaused = false;
      if (opts.mode === 'credits') {
        auto = { mode: 'credits', from: opts.from ?? 0, to: opts.to ?? farmTo, dur: Math.max(1, opts.duration || 70), t: 0, done: false };
        scroll = auto.from;
      } else auto = { mode: 'contemplate', speed: Math.max(1, opts.speed || 6 * k), dir: 1, t: 0 };
    },
    stopAuto() {
      auto = null;
      autoPaused = false;
    },
    set autoPaused(on) {
      autoPaused = !!on;
    },
    get autoPaused() {
      return autoPaused;
    },
    get auto() {
      return auto ? { mode: auto.mode, t: auto.t, dur: auto.dur || 0, done: !!auto.done, paused: autoPaused } : null;
    },
    /** (V4) Centre de la partie visible et sa hauteur (px du monde) : l'écoute du paysage sonore. */
    listener() {
      const L = layout;
      const k = L.zoom / L.dpr;
      const visH = L.dev.avail / L.dpr - Math.max(0, overlay);
      return { y: Math.round(scroll / k + visH / 2 / k), h: Math.round(visH / k), top: Math.round(scroll / k) };
    },
    worldCenterY() {
      const L = layout;
      const k = L.zoom / L.dpr;
      return (scroll + (L.dev.avail / L.dpr - Math.max(0, overlay)) / 2) / k;
    },
    setReducedMotion(on) {
      reduced = !!on;
      if (reduced) {
        fades.length = 0;
        sparks.length = 0;
        flingV = 0;
      }
    },
    reset() {
      lastView = null;
      for (const k of Object.keys(known)) delete known[k];
      fades.length = 0;
      sparks.length = 0;
      scroll = 0;
      flingV = 0;
      scrollAnim = null;
      staticKey = '';
    },
    get layout() {
      return layout;
    },
    get scroll() {
      return scroll;
    },
    get scrolling() {
      return !!scrollAnim || flingV !== 0;
    },
    stats: () => ({ zoom: layout.zoom, scroll, scrollMax: layout.scrollMax, overlay, fades: fades.length, sparks: sparks.length, drawn, x0: layout.x0, top: layout.top, dpr: layout.dpr, sprites: has('view.bg.summer') }),
  };
}
