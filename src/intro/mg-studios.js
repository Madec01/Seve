// Intro « MG studios » — l'image : variante « Le panneau de la ferme » (prototype validé par l'utilisateur le
// 2026-10-04), avec sa fin douce. Moteur pixel art : un canevas « art » à basse résolution, agrandi d'un facteur
// ENTIER en pixels physiques (net sur tous les écrans, même DPR 2,625), dessiné à partir de la petite planche
// assets/sprites/intro.png (src/intro/sheet.js) et de dessins faits par le code (ciel, soleil, panneau, MG…).
//
//   const scene = createMgStudios(canvas, sheetImage);
//   scene.build();                 // sprites préparés (police « Ferme » chargée avant : texte « studios »)
//   scene.draw(t, { reduced })     // dessine l'instant t (s) ; reduced : image fixe (mouvement réduit)
//
// La chronologie (temps forts, fin, fondus) est dans src/intro/timeline.js (pure, testée).

import { INTRO_SPRITES } from './sheet.js';
import { T, RM, CROW_SYL, CROW_DUR, SND_INFO, sndLevel, crowSyllableOn, henAt, clamp01, prog, eInOutSine } from './timeline.js';

// Palette (celle du jeu : css/style.css et packs Kenney)
const C = {
  K: '#3f2631', parch: '#fff1d2', parch2: '#f2dcb0',
  wood: '#a3703a', woodD: '#6d4b27', woodL: '#c58747', woodLL: '#dca464',
  green: '#7cc955', greenD: '#528738', greenL: '#a5dd7a',
  grass: '#84c669', grassD: '#65a556', grassL: '#8bd87d',
  soilL: '#eaa56c', soil: '#cf8254', soilD: '#b86542', soilDD: '#8e5236',
  gold: '#fddc00', orange: '#ffb600', goldD: '#b58300',
  red: '#e2665b', redD: '#8e3f38',
};

const lerp = (a, b, p) => a + (b - a) * p;
const eOutCubic = (p) => 1 - (1 - p) ** 3;
const eOutQuad = (p) => 1 - (1 - p) * (1 - p);
const eInQuad = (p) => p * p;
const eOutBack = (p, s = 1.9) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const R = Math.round;

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, p) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${R(lerp(A[0], B[0], p))},${R(lerp(A[1], B[1], p))},${R(lerp(A[2], B[2], p))})`;
}
function mix3(a, b, c, p) { return p < 0.5 ? mix(a, b, p * 2) : mix(b, c, (p - 0.5) * 2); }
function rgbToHex(s) { const m = s.match(/\d+/g); return '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''); }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

// Petits dessins décrits en texte (une lettre = une couleur), mis en cache.
const PIX_CACHE = new Map();
function pix(rows, pal) {
  const key = rows.join('|') + JSON.stringify(pal);
  let c = PIX_CACHE.get(key);
  if (c) return c;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  c = makeCanvas(w, h);
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = pal[ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  }));
  PIX_CACHE.set(key, c);
  return c;
}

// Masque binaire → image stylée (contour, reflet, ombre portée), façon Kenney.
function maskFromFn(w, h, fn) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = fn(x + 0.5, y + 0.5) ? 1 : 0;
  return { w, h, m };
}
function styleMask(mask, st) {
  const { w, h, m } = mask;
  const pad = 1, sh = st.shadowDy || 0;
  const W = w + pad * 2, H = h + pad * 2 + sh;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
  const near = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) return true; return false; };
  if (sh) {
    g.fillStyle = st.shadow;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (near(x, y)) g.fillRect(x + pad, y + pad + sh, 1, 1);
  }
  g.fillStyle = st.outline;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!at(x, y) && near(x, y)) g.fillRect(x + pad, y + pad, 1, 1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    let col = st.fill;
    if (st.shade && !at(x, y + 1)) col = st.shade;
    else if (st.hi && !at(x, y - 1)) col = st.hi;
    g.fillStyle = col;
    g.fillRect(x + pad, y + pad, 1, 1);
  }
  c.fillPixels = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) c.fillPixels.push([x + pad, y + pad]);
  return c;
}

// Texte en police « Ferme » (Jersey Ferme) au pixel près : 1 pixel de police = 50 unités, cadratin 1170
// → 23,4 px par « taille 1 ». Rendu seuillé (aucun anticrénelage), puis contour + ombre en pixels.
function textMask(str, weight = 700, spacing = 0) {
  const size = 23.4;
  const probe = makeCanvas(8, 8).getContext('2d');
  probe.font = `${weight} ${size}px Ferme, monospace`;
  const advs = [...str].map((ch) => R(probe.measureText(ch).width) + spacing);
  const total = advs.reduce((a, b) => a + b, 0) - spacing;
  const W = total + 4, H = 30, base = 22;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.font = probe.font; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  let x = 2;
  const xs = [];
  [...str].forEach((ch, i) => { xs.push(x); g.fillText(ch, x, base); x += advs[i]; });
  const d = g.getImageData(0, 0, W, H).data;
  let minY = H, maxY = 0, minX = W, maxX = 0;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] >= 128) {
    m[i] = 1; const yy = (i / W) | 0, xx = i % W;
    minY = Math.min(minY, yy); maxY = Math.max(maxY, yy); minX = Math.min(minX, xx); maxX = Math.max(maxX, xx);
  }
  if (maxX < minX) { minX = 0; maxX = 0; minY = 0; maxY = 0; } // police absente : masque vide
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const mm = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) mm[y * w + x2] = m[(y + minY) * W + x2 + minX];
  return { w, h, m: mm, xs: xs.map((v) => v - minX), advs };
}
function letterSprites(str, style, weight = 700, spacing = 1) {
  const tm = textMask(str, weight, spacing);
  const whole = styleMask(tm, style);
  const letters = [];
  [...str].forEach((ch, i) => {
    const x0 = Math.max(0, tm.xs[i]), x1 = Math.min(tm.w, i + 1 < str.length ? tm.xs[i + 1] : tm.w);
    const lw = Math.max(1, x1 - x0);
    const sub = new Uint8Array(lw * tm.h);
    for (let y = 0; y < tm.h; y++) for (let x = 0; x < lw; x++) sub[y * lw + x] = tm.m[y * tm.w + x0 + x] || 0;
    letters.push({ ch, x: x0, img: styleMask({ w: lw, h: tm.h, m: sub }, style) });
  });
  return { w: whole.width, h: whole.height, letters };
}

// Le monogramme « MG » en pixels (lettres pleines, dessinées géométriquement)
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const l = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - (ax + vx * l), py - (ay + vy * l));
}
function mgMasks() {
  const H = 26, sw = 6;
  const M = maskFromFn(30, H, (x, y) =>
    x < sw || x > 30 - sw ||
    (y < 20 && (segDist(x, y, 3, 1.5, 15, 17.5) < 3.1 || segDist(x, y, 27, 1.5, 15, 17.5) < 3.1)));
  const G = maskFromFn(27, H, (x, y) => {
    const cx = 13.5, cy = 13, n = 2.6;
    const o = Math.abs((x - cx) / 13.5) ** n + Math.abs((y - cy) / 13) ** n <= 1;
    const i = Math.abs((x - cx) / 7.5) ** n + Math.abs((y - cy) / 7) ** n <= 1;
    let v = o && !i;
    if (x > 15.5 && y > 7 && y < 13) v = false; // bouche du G
    if (y >= 12 && y < 18 && x > 14 && o) v = true; // barre
    if (x > 15.5 && x < 20.5 && y >= 13 && y < 18 && !o) v = false;
    return v;
  });
  return { M, G };
}

// Couleurs du ciel : nuit → aube → matin
const SKY = {
  night: ['#231c38', '#3f2631', '#5a3348'],
  dawn: ['#3b4f86', '#b06d86', '#f6a66f'],
  day: ['#5aa2e6', '#9fd0f5', '#fde4ae'],
};
function skyColor(p, k) {
  const pick = (set) => mix3(set[0], set[1], set[2], k);
  const a = rgbToHex(pick(SKY.night)), b = rgbToHex(pick(SKY.dawn)), c = rgbToHex(pick(SKY.day));
  return p < 0.5 ? mix(a, b, p * 2) : mix(b, c, (p - 0.5) * 2);
}

// Un oiseau seul (fin de l'intro) : ailes hautes / ailes basses
const BIRD = [['K.....K', '.K...K.', '..KKK..'], ['.......', '.KKKKK.', 'K..K..K']];

/**
 * Crée la scène sur `canvas` (plein écran) avec la planche `sheet` (Image de assets/sprites/intro.png).
 */
export function createMgStudios(canvas, sheet) {
  const designW = 124, designH = 220;
  const dctx = canvas.getContext('2d', { alpha: true });
  const art = makeCanvas(1, 1);
  const g = art.getContext('2d');
  let physW = 1, physH = 1, S = 1, AW = 1, AH = 1;
  let exactPhys = null;
  let shake = 0;
  const parts = {};

  function measure() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    physW = Math.max(1, R(r.width * dpr)); physH = Math.max(1, R(r.height * dpr));
    // Taille exacte en pixels physiques quand le navigateur la donne (device-pixel-content-box)
    if (exactPhys && Math.abs(exactPhys[0] - physW) <= 2 && Math.abs(exactPhys[1] - physH) <= 2) [physW, physH] = exactPhys;
    if (canvas.width !== physW || canvas.height !== physH) { canvas.width = physW; canvas.height = physH; }
  }
  let ro = null;
  try {
    ro = new ResizeObserver((en) => {
      const b = en[0].devicePixelContentBoxSize;
      exactPhys = b && b[0] ? [b[0].inlineSize, b[0].blockSize] : null;
      measure();
    });
    ro.observe(canvas, { box: 'device-pixel-content-box' });
  } catch {
    try { ro = new ResizeObserver(measure); ro.observe(canvas); } catch { ro = null; }
  }

  function setupArt() {
    measure();
    S = Math.max(1, Math.min(Math.floor(physW / designW), Math.floor(physH / designH)));
    AW = Math.ceil(physW / S); AH = Math.ceil(physH / S);
    if (art.width !== AW || art.height !== AH) { art.width = AW; art.height = AH; }
    g.imageSmoothingEnabled = false;
  }
  function present(alpha, shakeX = 0) {
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, physW, physH);
    if (alpha <= 0) return;
    dctx.imageSmoothingEnabled = false;
    dctx.globalAlpha = alpha;
    const ox = Math.floor((physW - AW * S) / 2) + shakeX * S, oy = Math.floor((physH - AH * S) / 2);
    dctx.drawImage(art, 0, 0, AW, AH, ox, oy, AW * S, AH * S);
    dctx.globalAlpha = 1;
  }

  // ── Primitives ──
  function spr(name, x, y, flip = false) {
    const r = INTRO_SPRITES[name];
    if (!r || !sheet) return;
    const [sx, sy, sw, sh] = r;
    x = R(x); y = R(y);
    if (flip) {
      g.save(); g.translate(x + sw, y); g.scale(-1, 1);
      g.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      g.restore();
    } else g.drawImage(sheet, sx, sy, sw, sh, x, y, sw, sh);
  }
  function img(c, x, y, flip = false) {
    x = R(x); y = R(y);
    if (!flip) { g.drawImage(c, x, y); return; }
    g.save(); g.translate(x + c.width, y); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore();
  }
  function rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(R(x), R(y), R(w), R(h)); }
  function disc(cx, cy, r, col) {
    g.fillStyle = col;
    const r2 = r * r;
    for (let y = Math.floor(-r); y <= Math.ceil(r); y++) {
      let span = 0;
      for (let x = Math.floor(-r); x <= Math.ceil(r); x++) if ((x + 0.5) ** 2 + (y + 0.5) ** 2 <= r2) span++;
      if (span) g.fillRect(R(cx) - (span >> 1), R(cy) + y, span, 1);
    }
  }
  // Ciel en bandes (avec une ligne tramée entre deux bandes, façon pixel art)
  function skyBands(y0, y1, colAt, bands) {
    const h = y1 - y0;
    const cols = [];
    for (let i = 0; i < bands; i++) cols.push(colAt(i / (bands - 1)));
    for (let i = 0; i < bands; i++) {
      const a = y0 + R((h * i) / bands), b = y0 + R((h * (i + 1)) / bands);
      rect(0, a, AW, b - a, cols[i]);
      if (i > 0) { g.fillStyle = cols[i - 1]; for (let x = (i & 1); x < AW; x += 2) g.fillRect(x, a, 1, 1); }
    }
  }
  // Soleil : disque doré, reflet, halo, rayons qui tournent doucement
  function sun(cx, cy, r, rays, t) {
    g.globalAlpha = 0.18; disc(cx, cy, r + 6, '#fff2b0'); g.globalAlpha = 0.28; disc(cx, cy, r + 3, '#fff2b0'); g.globalAlpha = 1;
    disc(cx, cy, r, C.orange);
    disc(cx - 1, cy - 1, r - 1.5, C.gold);
    disc(cx - R(r * 0.35), cy - R(r * 0.35), Math.max(1.5, r * 0.28), '#fff6a8');
    if (rays > 0) {
      g.fillStyle = C.gold;
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + t * 0.35;
        const len = (i % 2 ? 3 : 5) * rays;
        for (let d = 0; d < len; d += 1) {
          const rr = r + 4 + d;
          g.fillRect(R(cx + Math.cos(a) * rr), R(cy + Math.sin(a) * rr), 1, 1);
        }
      }
    }
  }
  function stars(alpha, yMax, t) {
    if (alpha <= 0) return;
    for (let i = 0; i < 22; i++) {
      const x = R(hash(i) * AW), y = R(hash(i + 50) * yMax * 0.85);
      const tw = 0.55 + 0.45 * Math.sin(t * 6 + i * 1.7);
      g.globalAlpha = clamp01(alpha * tw);
      g.fillStyle = C.parch;
      g.fillRect(x, y, 1, 1);
      if (i % 5 === 0) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
    g.globalAlpha = 1;
  }
  // Herbe en tuiles Tiny Town (herbe, touffes, fleurs) : exactement celle de la ferme
  function grassField(y0, seed) {
    for (let ty = 0; y0 + ty * 16 < AH; ty++) for (let tx = -1; tx * 16 < AW; tx++) {
      const h = hash(tx * 13.1 + ty * 71.7 + seed);
      spr(`grass.${h < 0.62 ? 0 : h < 0.88 ? 1 : 2}`, tx * 16 + (AW % 16) / 2, y0 + ty * 16);
    }
  }
  function puff(x, y, p, dir) {
    if (p <= 0 || p >= 1) return;
    const r = 1.5 + p * 3.5;
    g.globalAlpha = (1 - p) * 0.9;
    disc(x + dir * p * 10, y - p * 4, r, C.parch);
    disc(x + dir * p * 16, y - p * 2, r * 0.7, C.parch);
    g.globalAlpha = 1;
  }
  function flyingLeaf(x, y, phase, col, colD) {
    const f = Math.floor(phase * 4) % 4;
    const rowsSet = [
      ['.KK.', 'KABK', '.KK.'],
      ['.K.', 'KAK', 'KBK', '.K.'],
      ['KK..', 'KABK', '..KK'],
      ['..KK', 'KABK', 'KK..'],
    ];
    img(pix(rowsSet[f], { K: C.K, A: col, B: colD }), x, y);
  }
  function voiceMarks(x, y, dir, big = false) {
    g.fillStyle = C.parch;
    const L = big ? 3 : 2;
    for (let i = 0; i < L; i++) {
      g.fillRect(R(x + dir * (1 + i)), R(y - 2 - i), 1, 1);
      g.fillRect(R(x + dir * (2 + i)), R(y + 1), 1, 1);
      g.fillRect(R(x + dir * (1 + i)), R(y + 4 + i), 1, 1);
    }
  }
  function feather(x, y, p, col) {
    if (p <= 0 || p >= 1) return;
    g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    const sx = R(x + Math.sin(p * 9) * 2), sy = R(y + p * 12);
    g.fillStyle = C.K; g.fillRect(sx - 1, sy, 4, 1);
    g.fillStyle = col; g.fillRect(sx, sy, 2, 1);
    g.globalAlpha = 1;
  }
  function post(x, y, h) {
    rect(x - 1, y, 8, h, C.K);
    rect(x, y + 1, 6, h - 1, C.wood);
    rect(x, y + 1, 2, h - 1, C.woodL);
    rect(x + 4, y + 1, 2, h - 1, C.woodD);
    rect(x - 1, y - 1, 8, 2, C.K);
  }
  function rope(x0, y0, x1, y1) {
    g.fillStyle = C.K;
    const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) g.fillRect(R(lerp(x0, x1, i / n)), R(lerp(y0, y1, i / n)), 1, 1);
  }

  // Vache, mouton : image de base + tête baissée (broute) + tête levée (cou tendu, meugle).
  function headFrames(name, hx, hy1) {
    const [sx, sy] = INTRO_SPRITES[name];
    const src = makeCanvas(16, 17), s = src.getContext('2d');
    s.drawImage(sheet, sx, sy, 16, 16, 0, 1, 16, 16);
    const d0 = s.getImageData(0, 0, 16, 17);
    const shifted = (dir) => {
      const c = makeCanvas(16, 17), cg = c.getContext('2d');
      const d = cg.createImageData(16, 17);
      d.data.set(d0.data);
      const px = (x, y) => (y * 16 + x) * 4;
      for (let x = hx; x < 16; x++) {
        if (dir > 0) {
          for (let y = hy1 + 1; y > 0; y--) for (let k = 0; k < 4; k++) d.data[px(x, y) + k] = d0.data[px(x, y - 1) + k];
          for (let k = 0; k < 4; k++) d.data[px(x, 0) + k] = 0;
        } else {
          for (let y = 0; y <= hy1; y++) for (let k = 0; k < 4; k++) d.data[px(x, y) + k] = d0.data[px(x, y + 1) + k];
        }
      }
      cg.putImageData(d, 0, 0);
      return c;
    };
    return { base: src, down: shifted(1), up: shifted(-1) };
  }
  // Panneau en planches (contour, reflets, veines, clous)
  function makeBoard(w, h, planks, light = false) {
    const c = makeCanvas(w, h), b = c.getContext('2d');
    const f = (x, y, ww, hh, col) => { b.fillStyle = col; b.fillRect(x, y, ww, hh); };
    const base = light ? C.woodL : C.wood, hi = light ? C.woodLL : C.woodL, dk = C.woodD;
    f(1, 0, w - 2, h, C.K); f(0, 1, w, h - 2, C.K);
    f(1, 1, w - 2, h - 2, base);
    const ph = (h - 2) / planks;
    for (let i = 0; i < planks; i++) {
      const y = 1 + R(i * ph);
      f(1, y, w - 2, 1, hi);
      if (i > 0) f(1, y - 1, w - 2, 1, dk);
      for (let k = 0; k < 3; k++) { const gx = 4 + R(hash(i * 7 + k + (light ? 30 : 0)) * (w - 14)); f(gx, y + 2 + (k % 2) * R(ph / 3), 4 + k, 1, dk); }
    }
    f(1, h - 2, w - 2, 1, dk);
    [[3, 2], [w - 4, 2], [3, h - 4], [w - 4, h - 4]].forEach(([x, y]) => { f(x, y, 1, 1, C.K); });
    return c;
  }

  function build() {
    const { M, G } = mgMasks();
    const st = { fill: C.parch, outline: C.K, shade: C.parch2, shadow: C.woodD, shadowDy: 1 };
    parts.M = styleMask(M, st); parts.G = styleMask(G, st);
    parts.text = letterSprites('studios', st, 700, 1);
    parts.board = makeBoard(76, 38, 3);
    parts.plank = makeBoard(parts.text.w + 12, parts.text.h + 7, 1, true);
    parts.cow = headFrames('cow', 10, 8);
    parts.sheep = headFrames('sheep', 10, 7);
  }

  // ── Le coq : surgit de derrière la planche, se pose sur le poteau gauche, chante ; à la fin, il gonfle le poitrail ──
  function drawRooster(t, o, cx, top, top0) {
    const perchX = cx - 37, perchY = top - 4 - 17;
    if (o.still) {
      const rdt = o.rmT != null ? o.rmT - RM.crow : -1;
      const crowing = rdt > -0.03 && rdt < CROW_DUR - 0.05;
      spr(crowing && sndLevel('coq', rdt + 0.02) >= 2 ? 'rooster.crow' : 'rooster.idle', perchX, perchY);
      if (crowing && crowSyllableOn(rdt)) voiceMarks(perchX + 17, perchY + 3, 1, sndLevel('coq', rdt) >= 6);
      return;
    }
    if (t < T.pop) return;
    if (t < T.land) {
      const p = prog(t, T.pop, T.land);
      const x = lerp(cx - 30, perchX, eOutQuad(p));
      const y = lerp(top0 + 14, top0 - 21, p) - Math.sin(p * Math.PI) * 14;
      spr(Math.floor(t * 24) % 2 ? 'rooster.flap' : 'rooster.idle', x, y);
      return;
    }
    const dt = t - T.crow;
    const landSquash = t - T.land < 0.06 ? 1 : 0;
    let fr = 'rooster.idle', lift = 0;
    if (dt >= -0.04 && dt < CROW_DUR - 0.05) {
      // bec ouvert pendant les syllabes, refermé dans les creux de l'enregistrement
      fr = sndLevel('coq', dt + 0.02) >= 2 || dt < 0.04 ? 'rooster.crow' : 'rooster.idle';
      if (dt > CROW_SYL[3][0] && dt < CROW_SYL[3][0] + CROW_SYL[3][1]) lift = 1;
    } else if (t >= T.puff && t < T.puffEnd) {
      // le dernier petit geste : poitrail gonflé, tête haute (un battement d'ailes l'accompagne)
      const p = prog(t, T.puff, T.puffEnd);
      fr = p < 0.12 ? 'rooster.flap' : 'rooster.puff';
      lift = p > 0.12 && p < 0.8 ? 1 : 0;
    } else if (t > T.crow + CROW_DUR + 0.6 && t < T.puff - 0.2) {
      // petits coups de tête fiers
      const ph = (t - T.crow) * 2.2;
      if (Math.floor(ph) % 3 === 1 && ph % 1 < 0.35) fr = 'rooster.puff';
    }
    spr(fr, perchX, perchY + landSquash - lift);
    if (fr === 'rooster.crow' && dt >= 0 && dt < CROW_DUR && crowSyllableOn(dt)) voiceMarks(perchX + 17, perchY + 3 - lift, 1, sndLevel('coq', dt) >= 6);
    feather(perchX + 2, perchY + 6, prog(t, T.land, T.land + 0.8), C.soilD);
    feather(perchX + 12, perchY + 4, prog(t, T.land + 0.05, T.land + 0.9), '#fdbe53');
    // une plume s'envole encore quand il gonfle le poitrail
    feather(perchX + 3, perchY + 8, prog(t, T.puff + 0.04, T.puff + 0.95), C.soilD);
  }
  function drawPasture(t, o, cx, fy) {
    const cowX = cx - 42, cowY = fy + 10, sheepX = cx + 24, sheepY = fy + 11;
    // vache : broute, relève la tête et meugle ; la queue chasse les mouches
    let cf = parts.cow.down;
    const cm = t - T.cow;
    if (o.still) cf = parts.cow.base;
    else if (cm > -0.15 && cm < SND_INFO.vache.dur) cf = parts.cow.up;
    else if (Math.floor(t * 2.4 + 0.5) % 4 === 0) cf = parts.cow.base;
    const tail = !o.still && Math.floor(t * 3.2) % 2;
    g.fillStyle = C.K;
    if (tail) { g.fillRect(cowX, cowY + 6, 1, 4); g.fillRect(cowX - 1, cowY + 10, 2, 2); }
    else { g.fillRect(cowX, cowY + 6, 1, 1); g.fillRect(cowX - 1, cowY + 7, 1, 3); g.fillRect(cowX - 2, cowY + 10, 2, 2); }
    img(cf, cowX, cowY);
    if (!o.still && sndLevel('vache', cm) >= 4 && Math.floor(cm * 7) % 2 === 0) voiceMarks(cowX + 17, cowY + 8, 1);
    // mouton (tourné vers la vache) : broute, puis bêle en levant la tête
    let sf = parts.sheep.down;
    const sm = t - T.sheep;
    if (o.still) sf = parts.sheep.base;
    else if (sm > -0.12 && sm < SND_INFO.mouton.dur) sf = parts.sheep.up;
    else if (Math.floor(t * 2 + 1.3) % 3 === 0) sf = parts.sheep.base;
    const bleating = !o.still && sndLevel('mouton', sm) >= 4;
    const hopS = bleating && Math.floor(sm * 15) % 2 ? -1 : 0;
    img(sf, sheepX, sheepY + hopS, true);
    if (bleating && Math.floor(sm * 8) % 2 === 0) voiceMarks(sheepX - 2, sheepY + 6, -1);
  }
  function drawHen(t, o, base) {
    const ct = o.still ? 99 : t - (T.hen - 0.95);
    const h = henAt(ct);
    if (!h.visible) return;
    const x = lerp(-18, AW + 4, h.p);
    const step = h.walking ? Math.floor(ct * 9) % 2 : 0;
    const cl = t - T.hen;
    const clucking = !o.still && cl >= 0 && cl < SND_INFO.poule.dur;
    let peck = 0;
    if (!o.still && !h.walking && !clucking) {
      // au milieu : elle picore ; à la fin, installée, un petit coup de bec de temps en temps
      peck = ct < 1.35 ? (Math.floor((ct - 0.95) * 8) % 2) : (Math.floor(ct * 3) % 4 === 1 ? 1 : 0);
    }
    spr('hen', x, base + 4 - step + peck);
    if (clucking && sndLevel('poule', cl) >= 1) voiceMarks(x + 15, base + 9, 1);
  }

  function render(t, o) {
    const cx = AW >> 1, gy = R(AH * 0.47);
    const base = gy + 16;
    const pSky = eInOutSine(prog(t, 0, 1.7));
    skyBands(0, gy, (k) => skyColor(lerp(0.12, 1, pSky), k), 10);
    stars(1 - prog(t, 0, 1.0), gy, t);
    // le soleil monte pendant le chant du coq ; ses rayons s'ouvrent sur la note tenue
    const crowFinal = T.crow + CROW_SYL[3][0];
    sun(cx + 40, R(lerp(gy + 10, gy - 92, eOutCubic(prog(t, 0.05, 2.0)))), 9, eOutBack(prog(t, crowFinal, crowFinal + 0.45)), t);
    if (!o.still) {
      // oiseaux lointains (fx.birds de la vallée)
      for (let i = 0; i < 3; i++) {
        const p = prog(t, 1.5 + i * 0.12, 3.9 + i * 0.12);
        if (p > 0 && p < 1) spr(`bird.${Math.floor(t * 6 + i) % 2}`, lerp(AW + 8, -24, p) + i * 9, gy - 104 + i * 5 + R(Math.sin(t * 3 + i) * 2));
      }
      // la fin : un oiseau seul traverse le ciel, sans se presser
      const pb = prog(t, T.bird, T.bird + 1.9);
      if (pb > 0 && pb < 1) img(pix(BIRD[Math.floor(t * 7) % 2], { K: C.K }), lerp(AW + 6, -10, pb), gy - 70 - R(Math.sin(pb * Math.PI) * 10) + R(Math.sin(t * 9) * 1));
    }
    // collines, haies d'arbres
    for (let x = 0; x < AW; x++) {
      const hy = gy - R(6 + 3 * Math.sin(x * 0.05 + 0.4) + 1.5 * Math.sin(x * 0.13));
      rect(x, hy, 1, gy - hy + 1, mix(C.grassD, '#86a9a4', 0.4));
    }
    grassField(gy, 7);
    rect(0, gy, AW, 1, C.grassL);
    [[-6, 1], [7, 0], [AW - 26, 0], [AW - 12, 1], [AW - 1, 0]].forEach(([x, a]) => spr(a ? 'tree.a' : 'tree.b', x, gy - 26));
    for (let x = -4; x < AW; x += 16) spr('fence', x, gy - 3);
    // deux rangs de cultures qui sautillent quand le panneau se plante
    const impact = T.impact;
    const fy = base + 58;
    for (let r = 0; r < 4; r++) {
      const ry = r < 2 ? base + 24 + r * 18 : fy + 34 + (r - 2) * 18;
      if (ry - 6 > AH) break;
      for (let x = -8 + (r % 2) * 8; x < AW; x += 16) {
        spr('soil', x, ry);
        const dist = Math.hypot(x + 8 - cx, ry - base);
        const dt = t - impact - dist * 0.0035;
        const hop = !o.still && dt > 0 && dt < 0.14 ? -R(Math.sin((dt / 0.14) * Math.PI) * 3) : 0;
        spr(`crop.${r % 4}`, x, ry - 6 + hop);
      }
    }
    // le pré : clôture, la vache (à gauche) et le mouton (à droite)
    for (let x = -4; x < AW; x += 16) spr('fence', x, fy);
    for (let x = (cx % 26) - 13; x < AW + 4; x += 26) { rect(x - 1, fy + 2, 5, 13, C.K); rect(x, fy + 3, 3, 11, C.wood); rect(x, fy + 3, 1, 11, C.woodL); rect(x - 1, fy + 2, 5, 1, C.K); }
    drawPasture(t, o, cx, fy);
    if (pSky < 1) { g.globalAlpha = (1 - pSky) * 0.55; rect(0, gy - 30, AW, AH, '#2a1d3c'); g.globalAlpha = 1; }
    // panneau qui tombe et se plante avec un rebond
    const fall = prog(t, T.fall, impact);
    let dy = -(base + 20) * (1 - eInQuad(fall));
    let squash = 0;
    if (t >= impact) {
      const dt = t - impact;
      dy = R(3.2 * Math.exp(-9 * dt) * Math.cos(dt * 30));
      squash = dt < 0.09 ? 1 : 0;
    }
    if (o.still) { dy = 0; squash = 0; }
    const bw = parts.board.width, bh = parts.board.height;
    const top0 = base - 74;
    const top = top0 + R(dy);
    [-30, 24].forEach((px) => post(cx + px, top - 3, 78 + (squash ? -1 : 0)));
    drawRooster(t, o, cx, top, top0);
    const bx = cx - (bw >> 1), by = top + (squash ? 1 : 0);
    img(parts.board, bx, by);
    const mgW = parts.M.width + parts.G.width + 2;
    const mx = cx - (mgW >> 1), my = by + 5;
    img(parts.M, mx, my); img(parts.G, mx + parts.M.width + 2, my);
    // reflet qui balaie MG
    const sh = prog(t, T.sheen, T.sheen + 0.45);
    if (sh > 0 && sh < 1 && !o.still) {
      const k = R(lerp(-12, mgW + 30, eInOutSine(sh)));
      g.fillStyle = '#ffffff';
      for (const [L, ox] of [[parts.M, 0], [parts.G, parts.M.width + 2]]) for (const [x, y] of L.fillPixels) {
        const d = x + ox + y - k;
        if (d >= 0 && d < 3) g.fillRect(mx + ox + x, my + y, 1, 1);
      }
    }
    // planchette « studios » qui se balance
    const sw = t >= impact && !o.still ? 5 * Math.exp(-3.2 * (t - impact)) * Math.sin((t - impact) * 9.5) : 0;
    const lag = t < impact && !o.still ? R(-3 * fall) : 0;
    const pw = parts.plank.width;
    const px0 = cx - (pw >> 1) + R(sw), py0 = by + bh + 5 + lag + (R(Math.abs(sw)) > 2 ? -1 : 0);
    rope(cx - 26, by + bh - 1, px0 + 6, py0 + 1);
    rope(cx + 26, by + bh - 1, px0 + pw - 7, py0 + 1);
    img(parts.plank, px0, py0);
    parts.text.letters.forEach((L) => img(L.img, px0 + 6 + L.x, py0 + 3));
    if (t >= impact || o.still) { rect(cx - 33, base + 1, 12, 2, C.soilD); rect(cx + 21, base + 1, 12, 2, C.soilD); }
    if (!o.still) {
      const pp = prog(t, impact, impact + 0.5);
      puff(cx - 30, base, pp, -1); puff(cx + 30, base, pp, 1); puff(cx - 22, base + 1, pp * 0.9, -1); puff(cx + 22, base + 1, pp * 0.9, 1);
    }
    drawHen(t, o, base);
    // feuilles portées par le vent
    if (!o.still) for (let i = 0; i < 9; i++) {
      const st = 1.3 + hash(i + 3) * 1.8, p = (t - st) / 1.5;
      if (p <= 0 || p >= 1) continue;
      const x = lerp(-6, AW + 6, p), y = gy - 40 + hash(i + 9) * 70 + Math.sin(p * 9 + i) * 6 + p * 14;
      const pal = [[C.green, C.greenD], [C.orange, C.goldD], [C.red, C.redD]][i % 3];
      flyingLeaf(R(x), R(y), p * 3 + i * 0.3, pal[0], pal[1]);
    }
    shake = !o.still && t >= impact && t < impact + 0.12 ? (Math.floor((t - impact) * 50) % 2 ? 1 : -1) : 0;
  }

  /** Dessine l'instant t. opts : { reduced (image fixe, t = temps du mouvement réduit), alpha }. */
  function draw(t, opts = {}) {
    setupArt();
    g.clearRect(0, 0, AW, AH);
    shake = 0;
    if (opts.reduced) render(T.fadeStart - 0.02, { still: true, rmT: t });
    else render(t, {});
    present(opts.alpha == null ? 1 : opts.alpha, shake);
  }

  function destroy() { try { ro?.disconnect(); } catch { /* */ } }

  return { build, draw, destroy, info: () => ({ S, AW, AH, physW, physH }) };
}
