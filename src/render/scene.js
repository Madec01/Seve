// Scène de la ferme (canvas 2D, pixel art).
//
// createScene(canvas, images, level, opts?) → scene
//   opts : { effects, minZoom (paysage), layoutMode: 'auto' | 'portrait' | 'landscape' }
//   scene.resize(cssW, cssH, dpr)       taille du canvas (px CSS) et densité de pixels ; en mode
//                                       'auto', choisit la disposition portrait si cssH > cssW × 1,05
//   scene.render(game, timeMs)          dessine une image (à appeler dans requestAnimationFrame)
//   scene.setInsets({ top, bottom, left, right })
//                                       px CSS couverts par l'interface (barre du haut, onglets) :
//                                       la « bande visible » est entre eux ; le champ y est centré
//   scene.scrollBy(dyCss)               fait défiler (comme scrollTop : + = voir plus bas) ;
//                                       renvoie le déplacement réellement appliqué (px CSS)
//   scene.getScroll() / scene.maxScroll()   défilement courant / maximal (px CSS, 0 si tout tient)
//   scene.setScroll(yCss)               défilement absolu (borné)
//   scene.fling(vyCss)                  élan après un glissé (px CSS / s, même sens que scrollBy)
//   scene.focusField()                  recentre la vue sur le champ
//   scene.focusPlot(i)                  fait défiler juste ce qu'il faut pour voir la parcelle i
//   scene.layoutMode                    'portrait' | 'landscape'
//   scene.screenToWorld(x, y)           px CSS (relatifs au canvas) → { x, y } monde (défilement compris)
//   scene.worldToScreen(wx, wy)         monde → { x, y } px CSS (pour placer une infobulle)
//   scene.hitTest(x, y, opts?)          px CSS → { type:'plot', index } | { type:'investment', id } | null
//                                       opts.touch = true : tolérant (doigt) — une touche dans l'allée
//                                       ou la clôture à moins de ~8 px CSS d'une parcelle la désigne
//   scene.setHover(hit)                 surbrillance (résultat de hitTest, ou null)
//   scene.onEvent(type, payload)        = effects.onEvent(type, payload, scene.layout)
//   scene.setLevel(level)               change de niveau (nouvelle disposition)
//   scene.layout, scene.effects, scene.zoom, scene.dpr
//
// Rendu : tout est dessiné à l'échelle 1 dans un tampon « vue » (le monde + la forêt autour, sur
// toute la hauteur qu'on peut faire défiler), puis recopié sur le canvas avec un zoom entier
// (imageSmoothingEnabled = false) et un décalage entier en pixels réels : le défilement reste net.
// Le sol, la forêt, les clôtures et le décor fixe sont mis en cache (reconstruits au changement de
// saison, d'achat d'enclos ou de taille). Les textes flottants sont dessinés après le zoom, nets.
//
// Portrait : le zoom est le plus grand entier tel que la partie essentielle du monde (12 tuiles)
// tienne dans la largeur ; les colonnes de forêt des bords peuvent être rognées.
//
// La scène ne lit le jeu que par game.state et game.query ; elle ne modifie rien.

import { TILE, drawSprite, cropSprite, soilSprite, spriteRect } from './atlas.js';
import { buildSeasonSheets } from './assets.js';
import { createLayout, tileHash } from './layout.js';
import { createEffects } from './effects.js';

const OUTLINE = '#3f2631';
const MIN_ZOOM = 2;
const PORTRAIT_RATIO = 1.05; // portrait si hauteur > largeur × 1,05
const MAX_TILE_CSS = 40; // portrait : une tuile ne dépasse pas ~40 px CSS (tablettes)
const TOUCH_SLOP_CSS = 8; // tolérance du toucher autour des parcelles
const ANIMAL_SPEED = { chicken: 15, sheep: 9, cow: 7 };
const HOP_RATE = { chicken: 9, sheep: 6, cow: 4.5 };
const FARMER_SPEED = 44;
const POP_TIME = 0.55;
const ANIMAL_KINDS = ['chicken', 'sheep', 'cow'];
const SEASON_INDEX = { spring: 0, summer: 1, autumn: 2, winter: 3 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function noSmooth(ctx) {
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

// Ressort : 0 → 1 avec un léger dépassement (apparition « pop »).
function popScale(t) {
  if (t >= 1) return 1;
  const c1 = 1.9;
  const c3 = c1 + 1;
  const u = t - 1;
  return Math.max(0.05, 1 + c3 * u * u * u + c1 * u * u);
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function createScene(canvas, images, level, opts = {}) {
  const ctx = noSmooth(canvas.getContext('2d'));
  const seasonSheets = buildSeasonSheets(images);
  const effects = opts.effects || createEffects(images);
  const minZoom = Math.max(1, opts.minZoom || MIN_ZOOM);

  const modeOpt = opts.layoutMode || 'auto';
  let mode = modeOpt === 'portrait' ? 'portrait' : 'landscape';
  let layout = createLayout(level, { mode });

  // Tampons
  const view = makeCanvas(layout.width, layout.height);
  let vctx = noSmooth(view.getContext('2d'));
  const staticLayer = makeCanvas(layout.width, layout.height);
  let sctx = noSmooth(staticLayer.getContext('2d'));
  const scratch = makeCanvas(layout.width, layout.height);

  // Géométrie écran (px réels du canvas sauf mention)
  let dpr = 1;
  let cssW = layout.width * 2;
  let cssH = layout.height * 2;
  let devW = cssW;
  let devH = cssH;
  let zoom = 2;
  let viewW = layout.width;
  let viewH = layout.height;
  let ox = 0; // origine du monde dans le tampon de vue
  let oy = 0;
  let blitX = 0; // position du tampon zoomé sur le canvas (px réels, défilement compris)
  let blitY = 0;
  let baseX = 0; // position de l'origine du monde sur le canvas, défilement nul (px réels)
  let baseY = 0;
  let bufX0 = 0; // coin haut-gauche du tampon, en px du monde
  let bufY0 = 0;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 }; // px CSS
  const band = { x: 0, y: 0, w: 1, h: 1 }; // bande visible (px réels)
  let scrollDev = 0; // défilement vertical (px réels, entier)
  let maxScrollDev = 0;
  let userScrolled = false; // le joueur a fait défiler : ne plus recentrer tout seul
  let flingV = 0; // élan (px CSS / s)

  let staticKey = -1;
  let lastTime = null;
  let time = 0;
  let hover = null;
  let lastGame = null;
  let initialized = false;

  // ── Suivi de l'état (détection des changements) ───────────────────────────────────
  let plotViews = [];
  let prevCrop = [];
  let prevGrowth = [];
  let prevWatered = [];
  let prevUnlocked = [];
  const prevOwned = {};
  const pops = new Map(); // clé → temps de départ
  const recentCrops = []; // cagettes de l'étal (plus récentes en premier)

  // Animaux
  const animals = { chicken: [], cow: [], sheep: [] };

  // Fermier
  const farmer = {
    x: 0, y: 0, path: [], facing: 1, where: 'home', idle: 0, tool: null, toolT: 0, walkT: 0,
  };

  // Liste de dessin triée par profondeur (réutilisée)
  const entries = [];
  let entryCount = 0;
  function entry() {
    if (entryCount >= entries.length) entries.push({ sortY: 0, name: '', x: 0, y: 0, flipX: false, scale: 1, set: null, alpha: 1, tool: null, toolFlip: false });
    const e = entries[entryCount++];
    e.flipX = false;
    e.scale = 1;
    e.alpha = 1;
    e.tool = null;
    return e;
  }
  const byDepth = (a, b) => a.sortY - b.sortY;
  const drawList = [];

  function resetTracking() {
    const n = layout.plots.length;
    plotViews = new Array(n).fill(null);
    prevCrop = new Array(n).fill(undefined);
    prevGrowth = new Array(n).fill(-1);
    prevWatered = new Array(n).fill(false);
    prevUnlocked = new Array(n).fill(false);
    for (const k of Object.keys(prevOwned)) delete prevOwned[k];
    pops.clear();
    recentCrops.length = 0;
    animals.chicken.length = 0;
    animals.cow.length = 0;
    animals.sheep.length = 0;
    farmer.x = layout.farmerHome.x;
    farmer.y = layout.farmerHome.y;
    farmer.path.length = 0;
    farmer.where = 'home';
    farmer.idle = 0;
    farmer.tool = null;
    initialized = false;
    staticKey = -1;
  }
  resetTracking();

  // ── Géométrie ───────────────────────────────────────────────────────────────────
  function wantedMode(w, h) {
    if (modeOpt === 'portrait' || modeOpt === 'landscape') return modeOpt;
    return h > w * PORTRAIT_RATIO ? 'portrait' : 'landscape';
  }

  function resize(w, h, ratio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1) {
    dpr = ratio || 1;
    cssW = Math.max(1, w);
    cssH = Math.max(1, h);
    devW = Math.max(1, Math.round(cssW * dpr));
    devH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== devW) canvas.width = devW;
    if (canvas.height !== devH) canvas.height = devH;
    if (canvas.style) {
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    noSmooth(ctx);
    const m = wantedMode(cssW, cssH);
    if (m !== mode) {
      mode = m;
      rebuildLayout(layout.level);
    }
    computeCamera();
  }

  /** Zoom, position du monde, taille des tampons ; garde (ou recentre) le défilement. */
  function computeCamera() {
    const prevMax = maxScrollDev;
    band.x = Math.round(insets.left * dpr);
    band.y = Math.round(insets.top * dpr);
    band.w = Math.max(1, devW - band.x - Math.round(insets.right * dpr));
    band.h = Math.max(1, devH - band.y - Math.round(insets.bottom * dpr));
    const ess = layout.essential;
    if (mode === 'portrait') {
      const byWidth = Math.floor(band.w / ess.w);
      // Le champ entier doit tenir en hauteur dans la bande (cas extrêmes : écran très bas).
      const byField = Math.floor(band.h / (layout.fieldRect.h + TILE));
      const cap = Math.max(1, Math.floor((MAX_TILE_CSS * dpr) / TILE));
      zoom = Math.max(1, Math.min(byWidth, byField, cap));
    } else {
      zoom = Math.max(minZoom, Math.floor(Math.min(band.w / layout.width, band.h / layout.height)));
    }
    // Horizontal : partie essentielle centrée dans la bande.
    baseX = Math.round(band.x + band.w / 2 - (ess.x + ess.w / 2) * zoom);
    // Vertical : monde centré s'il tient, sinon défilement (0 = haut du monde en haut de la bande).
    const worldDevH = layout.height * zoom;
    if (worldDevH <= band.h) {
      baseY = Math.round(band.y + (band.h - worldDevH) / 2);
      maxScrollDev = 0;
    } else {
      baseY = band.y;
      maxScrollDev = worldDevH - band.h;
    }
    // Tampon : couvre tout le canvas, pour tout défilement possible.
    bufX0 = Math.floor(-baseX / zoom) - 1;
    bufY0 = Math.floor(-baseY / zoom) - 1;
    const w = Math.ceil(devW / zoom) + 3;
    const h = Math.ceil((devH + maxScrollDev) / zoom) + 3;
    ox = -bufX0;
    oy = -bufY0;
    if (w !== viewW || h !== viewH || view.width !== w || view.height !== h) {
      viewW = w;
      viewH = h;
      view.width = viewW;
      view.height = viewH;
      staticLayer.width = viewW;
      staticLayer.height = viewH;
      scratch.width = viewW;
      scratch.height = viewH;
      vctx = noSmooth(view.getContext('2d'));
      sctx = noSmooth(staticLayer.getContext('2d'));
    }
    staticKey = -1;
    if (!userScrolled) focusFieldDev();
    else if (prevMax > 0 && maxScrollDev > 0) setScrollDev(Math.round((scrollDev / prevMax) * maxScrollDev));
    else setScrollDev(scrollDev);
  }

  function setScrollDev(v) {
    scrollDev = Math.max(0, Math.min(maxScrollDev, Math.round(v)));
    blitX = baseX + bufX0 * zoom;
    blitY = baseY - scrollDev + bufY0 * zoom;
  }

  /** Défilement qui place le centre vertical d'un rectangle (px du monde) au centre de la bande. */
  function centerOnDev(r) {
    return baseY + (r.y + r.h / 2) * zoom - (band.y + band.h / 2);
  }

  function focusFieldDev() {
    setScrollDev(centerOnDev(layout.fieldRect));
  }

  function setInsets(ins = {}) {
    let changed = false;
    for (const k of ['top', 'bottom', 'left', 'right']) {
      if (ins[k] === undefined) continue;
      const v = Math.max(0, Number(ins[k]) || 0);
      if (v !== insets[k]) {
        insets[k] = v;
        changed = true;
      }
    }
    if (changed) computeCamera();
  }

  function scrollBy(dyCss) {
    const before = scrollDev;
    flingV = 0;
    userScrolled = true;
    setScrollDev(scrollDev + (Number(dyCss) || 0) * dpr);
    return (scrollDev - before) / dpr;
  }

  function setScroll(yCss) {
    flingV = 0;
    userScrolled = true;
    setScrollDev((Number(yCss) || 0) * dpr);
    return scrollDev / dpr;
  }

  function fling(vyCss) {
    if (maxScrollDev <= 0) return;
    userScrolled = true;
    flingV = Math.max(-4000, Math.min(4000, Number(vyCss) || 0));
  }

  function focusField() {
    flingV = 0;
    userScrolled = false;
    focusFieldDev();
  }

  /** Fait défiler le moins possible pour que la parcelle soit entièrement visible (avec une marge). */
  function focusPlot(i, marginCss = 24) {
    const r = layout.plotRect(i);
    if (!r) return scrollDev / dpr;
    flingV = 0;
    const m = marginCss * dpr;
    const top = baseY - scrollDev + r.y * zoom;
    const bottom = top + r.h * zoom;
    if (top < band.y + m) setScrollDev(scrollDev - (band.y + m - top));
    else if (bottom > band.y + band.h - m) setScrollDev(scrollDev + (bottom - (band.y + band.h - m)));
    return scrollDev / dpr;
  }

  function screenToWorld(x, y) {
    return {
      x: (x * dpr - blitX) / zoom - ox,
      y: (y * dpr - blitY) / zoom - oy,
    };
  }

  function worldToScreen(wx, wy) {
    return {
      x: (blitX + (wx + ox) * zoom) / dpr,
      y: (blitY + (wy + oy) * zoom) / dpr,
    };
  }

  // Pour les textes flottants : monde → pixels réels du canvas.
  function worldToDevice(wx, wy, out) {
    out.x = blitX + (wx + ox) * zoom;
    out.y = blitY + (wy + oy) * zoom;
    return out;
  }

  function hitTest(x, y, hitOpts) {
    const w = screenToWorld(x, y);
    const owned = lastGame ? lastGame.state.investments : undefined;
    if (hitOpts && hitOpts.touch) return layout.hitTestNear(w.x, w.y, owned, (TOUCH_SLOP_CSS * dpr) / zoom);
    return layout.hitTest(w.x, w.y, owned);
  }

  // ── Couche fixe : sol, chemins, forêt, clôtures, décor ────────────────────────────
  function drawQuad(c, sheets, name, qx, qy, dx, dy) {
    const r = spriteRect(name);
    c.drawImage(sheets[r.sheet], r.x + qx * 8, r.y + qy * 8, 8, 8, dx + qx * 8, dy + qy * 8, 8, 8);
  }

  let pathWithGuest = false;
  const P = (tx, ty) => layout.isPath(tx, ty, pathWithGuest);
  function drawPathTile(c, sheets, tx, ty, dx, dy) {
    const n = P(tx, ty - 1);
    const s = P(tx, ty + 1);
    const w = P(tx - 1, ty);
    const e = P(tx + 1, ty);
    // haut-gauche
    drawQuad(c, sheets, n && w ? (P(tx - 1, ty - 1) ? 'path.c' : 'path.inner.tl') : n ? 'path.l' : w ? 'path.t' : 'path.tl', 0, 0, dx, dy);
    drawQuad(c, sheets, n && e ? (P(tx + 1, ty - 1) ? 'path.c' : 'path.inner.tr') : n ? 'path.r' : e ? 'path.t' : 'path.tr', 1, 0, dx, dy);
    drawQuad(c, sheets, s && w ? (P(tx - 1, ty + 1) ? 'path.c' : 'path.inner.bl') : s ? 'path.l' : w ? 'path.b' : 'path.bl', 0, 1, dx, dy);
    drawQuad(c, sheets, s && e ? (P(tx + 1, ty + 1) ? 'path.c' : 'path.inner.br') : s ? 'path.r' : e ? 'path.b' : 'path.br', 1, 1, dx, dy);
  }

  function drawFence(c, sheets, r, gateX) {
    const x1 = r.x + r.w - 1;
    const y1 = r.y + r.h - 1;
    for (let y = r.y; y <= y1; y++) {
      for (let x = r.x; x <= x1; x++) {
        let name = null;
        if (y === r.y) name = x === r.x ? 'fence.tl' : x === x1 ? 'fence.tr' : 'fence.t';
        else if (y === y1) name = x === r.x ? 'fence.bl' : x === x1 ? 'fence.br' : x === gateX ? 'fence.gate' : 'fence.t';
        else if (x === r.x) name = 'fence.l';
        else if (x === x1) name = 'fence.r';
        if (name) drawSprite(c, sheets, name, x * TILE, y * TILE);
      }
    }
  }

  function flowerRate(season) {
    return season === 'spring' ? 0.09 : season === 'summer' ? 0.06 : season === 'autumn' ? 0.015 : 0;
  }

  function decoSprite(kind, season, h) {
    const evergreen = h < 0.22;
    switch (kind) {
      case 'tree':
        if (season === 'winter') return h < 0.6 ? 'tree.pine' : 'bush';
        if (evergreen) return 'tree.pine';
        return season === 'autumn' ? (h < 0.7 ? 'tree.autumn' : 'tree.green') : 'tree.green';
      case 'treeTall':
        if (season === 'winter') return h < 0.7 ? 'tree.pine.tall' : 'tree.dead.tall';
        if (evergreen) return 'tree.pine.tall';
        return season === 'autumn' ? (h < 0.75 ? 'tree.autumn.tall' : 'tree.green.tall') : 'tree.green.tall';
      case 'bush': return 'bush';
      case 'berry': return season === 'spring' || season === 'summer' ? 'bush.berry' : 'bush';
      case 'rocks': return 'rocks.small';
      case 'rocksBig': return 'rocks.big';
      case 'stump': return 'stump';
      case 'log': return 'log';
      case 'mushrooms': return season === 'winter' ? null : season === 'spring' ? 'plant.fern' : 'mushrooms';
      case 'fern': return season === 'winter' ? null : season === 'autumn' ? 'plant.weeds' : 'plant.fern';
      case 'weeds': return season === 'winter' ? null : 'plant.weeds';
      default: return null;
    }
  }

  function buildStatic(season, owned) {
    const sheets = seasonSheets[season];
    const c = sctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, viewW, viewH);
    c.translate(ox, oy);
    const tx0 = Math.floor(-ox / TILE) - 1;
    const ty0 = Math.floor(-oy / TILE) - 1;
    const tx1 = Math.ceil((viewW - ox) / TILE) + 1;
    const ty1 = Math.ceil((viewH - oy) / TILE) + 1;
    const fr = flowerRate(season);

    // 1. Herbe
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const h = tileHash(tx, ty, 11);
        const name = h < 0.14 ? 'ground.grass.tufts' : h > 1 - fr ? 'ground.grass.flowers' : 'ground.grass';
        drawSprite(c, sheets, name, tx * TILE, ty * TILE);
      }
    }
    // 2. Chemins et route
    pathWithGuest = layout.available.has('guestHouse') && (owned.guestHouse || 0) > 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (P(tx, ty)) drawPathTile(c, sheets, tx, ty, tx * TILE, ty * TILE);
      }
    }
    // Parterre de fleurs des ruches
    const bed = season === 'spring' || season === 'summer' ? 'ground.grass.flowers' : 'ground.grass.tufts';
    for (const d of layout.deco) {
      if (d.kind === 'flowerbed' && (tileHash(d.tx, d.ty, 5) < 0.75 || season !== 'spring')) drawSprite(c, sheets, bed, d.x, d.y);
    }
    // Jardin de la chambre d'hôte
    const guest = layout.available.has('guestHouse') && (owned.guestHouse || 0) > 0;
    if (guest) {
      for (const f of layout.garden.flowers) drawSprite(c, sheets, season === 'winter' ? 'ground.grass.tufts' : 'ground.grass.flowers', f.x * TILE, f.y * TILE);
    }

    // 3. Forêt (bandes haut/bas et côtés, plus tout ce qui dépasse du monde)
    const fset = season === 'autumn' ? 'forest.autumn' : 'forest.green';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!layout.isForest(tx, ty)) continue;
        const up = layout.isForest(tx, ty - 1);
        const down = layout.isForest(tx, ty + 1);
        const part = !down ? 'bottom' : !up ? 'top' : 'fill';
        drawSprite(c, sheets, `${fset}.${part}`, tx * TILE, ty * TILE);
      }
    }

    // Lisières verticales : arbres isolés à cheval sur la coupe nette des tuiles de forêt.
    const edgeGreen = season === 'autumn' ? 'tree.autumn' : season === 'winter' ? 'tree.pine' : 'tree.green';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!layout.isForest(tx, ty)) continue;
        const openRight = !layout.isForest(tx + 1, ty) && !layout.isPath(tx + 1, ty);
        const openLeft = !layout.isForest(tx - 1, ty) && !layout.isPath(tx - 1, ty);
        if (!openRight && !openLeft) continue;
        const h = tileHash(tx, ty, 23);
        const name = h < 0.3 ? 'tree.pine' : edgeGreen;
        const dx = (openRight ? 6 : -6) + Math.floor(h * 5) - 2;
        drawSprite(c, sheets, name, tx * TILE + dx, ty * TILE - 3 + (ty % 2) * 2);
      }
    }

    // 4. Clôtures
    const f = layout.field;
    drawFence(c, sheets, f.fence, f.gate.x);
    const sl = layout.slots;
    const A = layout.available;
    if (A.has('chickenCoop') && (owned.chickenCoop || 0) > 0) drawFence(c, sheets, sl.chickenCoop.fence, null);
    if (A.has('cow') && (owned.cow || 0) > 0) drawFence(c, sheets, sl.cow.fence, null);
    if (A.has('sheep') && (owned.sheep || 0) > 0) drawFence(c, sheets, sl.sheep.fence, null);
    // 5. Décor fixe (du haut vers le bas)
    drawList.length = 0;
    for (const d of layout.deco) if (d.kind !== 'flowerbed') drawList.push(d);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) {
      const name = decoSprite(d.kind, season, tileHash(d.tx, d.ty, 7));
      if (!name) continue;
      const tall = name.endsWith('.tall');
      drawSprite(c, sheets, name, d.x, tall ? d.y - TILE : d.y);
    }
    drawList.length = 0;

    // Accessoires de la ferme
    for (const p of layout.props) drawSprite(c, sheets, p.name, p.x * TILE + (p.dx || 0), p.y * TILE + (p.dy || 0));
    drawSprite(c, sheets, 'well', layout.well.x * TILE, layout.well.y * TILE);
    if (guest) {
      for (const b of layout.garden.bushes) drawSprite(c, sheets, season === 'winter' ? 'bush' : 'bush.berry', b.x * TILE, b.y * TILE);
      // Tournesols du jardin (printemps / été) ; sinon un banc de pierres.
      for (const p of layout.garden.plants) {
        const name = season === 'summer' ? 'crop.sunflower.4' : season === 'spring' ? 'crop.sunflower.2' : season === 'autumn' ? 'plant.weeds' : null;
        if (name) drawSprite(c, name.startsWith('crop') ? images : sheets, name, p.x * TILE + (p.dx || 0), p.y * TILE + (p.dy || 0));
      }
    }
    for (const id of ['sheep', 'cow', 'chickenCoop']) {
      if (!layout.available.has(id) || (owned[id] || 0) <= 0) continue;
      for (const p of sl[id].props || []) drawSprite(c, p.sheet === 'base' ? images : sheets, p.name, p.x, p.y);
    }

    // 6. Panneaux « à vendre » des emplacements libres
    for (const id of layout.available) {
      if ((owned[id] || 0) > 0) continue;
      const s = sl[id];
      if (!s) continue;
      drawSprite(c, sheets, 'sign', s.sign.x * TILE, s.sign.y * TILE);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Synchronisation avec l'état du jeu ───────────────────────────────────────────
  function spawnAnimal(kind, pen, pop) {
    const minX = pen.x * TILE - 3;
    const maxX = (pen.x + pen.w - 1) * TILE + 3;
    const minY = pen.y * TILE - 3;
    const maxY = (pen.y + pen.h - 1) * TILE + 2;
    const a = {
      kind,
      minX, maxX, minY, maxY,
      x: rnd(minX, maxX),
      y: rnd(minY, maxY),
      tx: 0, ty: 0,
      moving: false,
      wait: rnd(0.2, 2.5),
      phase: rnd(0, 6),
      facing: Math.random() < 0.5 ? 1 : -1,
      peck: 0,
      born: pop ? time : -10,
    };
    a.tx = a.x;
    a.ty = a.y;
    return a;
  }

  function syncAnimals(owned, pop) {
    const sl = layout.slots;
    const want = {
      chicken: layout.available.has('chickenCoop') ? Math.min(9, (owned.chickenCoop || 0) * sl.chickenCoop.perUnit) : 0,
      cow: layout.available.has('cow') ? Math.min(3, owned.cow || 0) : 0,
      sheep: layout.available.has('sheep') ? Math.min(3, owned.sheep || 0) : 0,
    };
    const pens = { chicken: sl.chickenCoop.pen, cow: sl.cow.pen, sheep: sl.sheep.pen };
    for (const kind of ANIMAL_KINDS) {
      const list = animals[kind];
      while (list.length < want[kind]) list.push(spawnAnimal(kind, pens[kind], pop));
      if (list.length > want[kind]) list.length = want[kind];
    }
  }

  function syncOwned(game) {
    const owned = game.state.investments || {};
    let changed = !initialized;
    const ids = layout.slotIds;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const n = owned[id] || 0;
      const before = prevOwned[id] ?? n;
      if (n !== before) changed = true;
      if (initialized && n > before) {
        for (let k = before; k < n; k++) pops.set(`${id}.${k}`, time);
        if (before === 0) pops.set(`${id}.main`, time);
      }
      prevOwned[id] = n;
    }
    if (changed) syncAnimals(owned, initialized);
  }

  function noteHarvest(cropId) {
    const i = recentCrops.indexOf(cropId);
    if (i >= 0) recentCrops.splice(i, 1);
    recentCrops.unshift(cropId);
    if (recentCrops.length > 3) recentCrops.length = 3;
  }

  function syncPlots(game, raining) {
    const plots = game.state.plots;
    const n = Math.min(plots.length, layout.plots.length);
    let changed = 0;
    let lastIdx = -1;
    let lastTool = null;
    for (let i = 0; i < n; i++) {
      const p = plots[i];
      const crop = p.cropId || null;
      if (plotViews[i] && crop === prevCrop[i] && p.growth === prevGrowth[i] && p.watered === prevWatered[i] && p.unlocked === prevUnlocked[i]) continue;
      const was = plotViews[i];
      const view = game.query.plot(i);
      if (initialized && was) {
        let tool = null;
        if (!prevUnlocked[i] && p.unlocked) tool = 'tool.hoe';
        else if (!prevCrop[i] && crop) tool = 'tool.shovel';
        else if (prevCrop[i] && !crop) {
          if (was.mature) {
            tool = 'tool.sickle';
            noteHarvest(prevCrop[i]);
          }
        } else if (crop && !prevWatered[i] && p.watered && !raining) tool = 'tool.wateringcan';
        if (tool) {
          changed++;
          lastIdx = i;
          lastTool = tool;
        }
      }
      plotViews[i] = view;
      prevCrop[i] = crop;
      prevGrowth[i] = p.growth;
      prevWatered[i] = p.watered;
      prevUnlocked[i] = p.unlocked;
    }
    // Une action du joueur touche une ou deux parcelles ; au-delà, c'est l'aube (pluie, arroseurs).
    if (changed >= 1 && changed <= 2) farmerGoTo(lastIdx, lastTool);
    if (!initialized) {
      // Étal : cagettes des cultures les plus récoltées jusqu'ici.
      const harvested = game.state.stats?.year?.cropsHarvested || {};
      const ids = Object.keys(harvested).sort((a, b) => harvested[b] - harvested[a]).slice(0, 3);
      recentCrops.length = 0;
      recentCrops.push(...ids);
    }
  }

  // ── Fermier ───────────────────────────────────────────────────────────────────────
  function inField(x, y) {
    const f = layout.field.fence;
    return x > f.x * TILE && x < (f.x + f.w) * TILE && y > f.y * TILE && y < (f.y + f.h - 1) * TILE + 8;
  }

  function routePoints() {
    return [{ x: layout.farmerHome.x, y: layout.farmerHome.y }, ...layout.routeToField];
  }

  function farmerGoTo(plotIndex, tool) {
    const r = layout.plotRect(plotIndex);
    if (!r) return;
    // Debout juste sous la parcelle (sur la rangée suivante en paysage, dans l'allée en portrait).
    const target = { x: r.x + r.w / 2, y: r.y + r.h + (layout.plotScale > 1 ? 3 : 11), tool, plot: plotIndex };
    farmer.path.length = 0;
    if (!inField(farmer.x, farmer.y)) {
      const route = routePoints();
      // Reprend le trajet au point le plus proche (dans le sens maison → champ).
      let best = 0;
      let bestD = Infinity;
      route.forEach((p, k) => {
        const d = Math.abs(p.x - farmer.x) + Math.abs(p.y - farmer.y);
        if (d < bestD) { bestD = d; best = k; }
      });
      for (let k = best; k < route.length; k++) farmer.path.push(route[k]);
    }
    farmer.path.push(target);
    farmer.idle = 0;
  }

  function farmerGoHome() {
    const route = routePoints().reverse();
    farmer.path.length = 0;
    for (const p of route) farmer.path.push(p);
  }

  function updateFarmer(dt) {
    if (farmer.tool) {
      farmer.toolT -= dt;
      if (farmer.toolT <= 0) farmer.tool = null;
      return;
    }
    const next = farmer.path[0];
    if (!next) {
      farmer.walkT = 0;
      farmer.idle += dt;
      if (farmer.where === 'field' && farmer.idle > 14) farmerGoHome();
      return;
    }
    const dx = next.x - farmer.x;
    const dy = next.y - farmer.y;
    const d = Math.hypot(dx, dy);
    // Il presse le pas sur les longs trajets (maison ↔ champ).
    const step = FARMER_SPEED * (farmer.path.length > 2 ? 1.7 : 1) * dt;
    farmer.walkT += dt;
    if (Math.abs(dx) > 0.5) farmer.facing = dx > 0 ? 1 : -1;
    if (d <= step) {
      farmer.x = next.x;
      farmer.y = next.y;
      farmer.path.shift();
      if (next.tool) {
        farmer.tool = next.tool;
        farmer.toolT = 1.1;
        farmer.facing = 1;
      }
      farmer.where = inField(farmer.x, farmer.y) ? 'field' : farmer.path.length ? 'road' : 'home';
      farmer.idle = 0;
    } else {
      farmer.x += (dx / d) * step;
      farmer.y += (dy / d) * step;
    }
  }

  // ── Animaux ──────────────────────────────────────────────────────────────────────
  function updateAnimal(a, dt) {
    a.phase += dt;
    if (a.moving) {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const d = Math.hypot(dx, dy);
      const step = ANIMAL_SPEED[a.kind] * dt;
      if (d <= step) {
        a.x = a.tx;
        a.y = a.ty;
        a.moving = false;
        a.wait = a.kind === 'chicken' ? rnd(0.4, 2.2) : rnd(1.5, 5);
      } else {
        a.x += (dx / d) * step;
        a.y += (dy / d) * step;
        if (Math.abs(dx) > 0.3) a.facing = dx > 0 ? 1 : -1;
      }
    } else {
      a.wait -= dt;
      if (a.kind === 'chicken') {
        if (a.peck > 0) a.peck -= dt;
        else if (Math.random() < dt * 0.9) a.peck = 0.35;
      }
      if (a.wait <= 0) {
        const range = a.kind === 'chicken' ? 22 : 30;
        a.tx = Math.max(a.minX, Math.min(a.maxX, a.x + rnd(-range, range)));
        a.ty = Math.max(a.minY, Math.min(a.maxY, a.y + rnd(-range * 0.6, range * 0.6)));
        a.moving = true;
        a.peck = 0;
      }
    }
  }

  // ── Dessin dynamique ─────────────────────────────────────────────────────────────
  function pushSprite(name, x, y, sortY, set, opts) {
    const e = entry();
    e.name = name;
    e.x = x;
    e.y = y;
    e.sortY = sortY;
    e.set = set;
    if (opts) {
      if (opts.flipX) e.flipX = true;
      if (opts.scale) e.scale = opts.scale;
      if (opts.tool) { e.tool = opts.tool; e.toolFlip = !!opts.toolFlip; }
    }
    return e;
  }

  // Bâtiment avec animation d'apparition (ancrée en bas au centre).
  function pushBuilding(name, tx, ty, wTiles, hTiles, set, popKey) {
    const x = tx * TILE;
    const y = ty * TILE;
    const bottom = y + hTiles * TILE;
    const start = pops.get(popKey);
    let s = 1;
    if (start !== undefined) {
      const k = (time - start) / POP_TIME;
      if (k >= 1) pops.delete(popKey);
      else s = popScale(k);
    }
    if (s === 1) return pushSprite(name, x, y, bottom, set);
    const w = wTiles * TILE * s;
    const h = hTiles * TILE * s;
    return pushSprite(name, Math.round(x + (wTiles * TILE - w) / 2), Math.round(bottom - h), bottom, set, { scale: s });
  }

  function drawPlots(sheetsEnv, raining, season) {
    const L = layout;
    const k = L.plotScale || 1; // ×2 en portrait : terre et cultures dessinées en grand
    const c = vctx;
    const sc = k === 1 ? undefined : { scale: k };
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      const r = L.plots[i];
      if (!pv) continue;
      if (!pv.unlocked) continue;
      const wet = (pv.cropId && pv.watered) || raining;
      let left = false;
      let right = false;
      if (k === 1) {
        // Paysage : les parcelles voisines d'une même ligne forment un sillon continu.
        const nb = L.plotNeighbors(i);
        left = nb.left >= 0 && !!plotViews[nb.left]?.unlocked;
        right = nb.right >= 0 && !!plotViews[nb.right]?.unlocked;
      }
      // Portrait : chaque parcelle est une motte bien séparée (cible tactile lisible).
      drawSprite(c, sheetsEnv, soilSprite(wet, left, right), r.x, r.y + (k > 1 ? 1 : 0), sc);
    }
    // Parcelles à acheter : pointillés discrets
    c.fillStyle = 'rgba(63,38,49,0.28)';
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      if (!pv || pv.unlocked) continue;
      const r = L.plots[i];
      const n = r.w;
      const step = 3 * k;
      for (let d = 2 * k; d < n - 2 * k; d += step) {
        c.fillRect(r.x + d, r.y + 2 * k, k, k);
        c.fillRect(r.x + d, r.y + n - 3 * k, k, k);
        c.fillRect(r.x + 2 * k, r.y + d, k, k);
        c.fillRect(r.x + n - 3 * k, r.y + d, k, k);
      }
    }
    // Cultures
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      if (!pv || !pv.cropId) continue;
      const r = L.plots[i];
      const stage = Math.max(0, Math.min(4, pv.stage | 0));
      let dy = 1;
      if (pv.mature) {
        // Balancement doux + scintillement
        dy += Math.sin(time * 2.4 + i * 1.7) > 0.35 ? -1 : 0;
      } else if (stage >= 2 && season !== 'winter') {
        dy += Math.sin(time * 1.3 + i * 0.9) > 0.8 ? -1 : 0;
      }
      drawSprite(c, images, cropSprite(pv.cropId, stage), r.x, r.y + dy * k - (k > 1 ? 2 : 0), sc);
      if (pv.mature) {
        const ph = (time * 0.55 + i * 0.37) % 1;
        if (ph < 0.18) {
          const sx = r.x + (3 + Math.floor(tileHash(i, Math.floor(time * 0.55 + i * 0.37), 3) * 10)) * k;
          const sy = r.y + (1 + Math.floor(tileHash(i, Math.floor(time * 0.55 + i * 0.37), 4) * 6)) * k;
          c.fillStyle = '#ffffff';
          c.fillRect(sx, sy, k, k);
          if (ph > 0.05 && ph < 0.13) {
            c.fillStyle = '#fff3b0';
            c.fillRect(sx - k, sy, k, k);
            c.fillRect(sx + k, sy, k, k);
            c.fillRect(sx, sy - k, k, k);
            c.fillRect(sx, sy + k, k, k);
          }
        }
      }
    }
  }

  function collectDrawables(owned, season, sheetsEnv, weather, dayProgress) {
    entryCount = 0;
    const sl = layout.slots;
    const A = layout.available;
    const objSet = season === 'winter' ? sheetsEnv : images;

    // Maison (toujours)
    const h = layout.house;
    pushSprite('building.house', h.x * TILE, h.y * TILE, (h.y + h.h) * TILE, objSet);

    // Poulailler
    if (A.has('chickenCoop') && owned.chickenCoop > 0) {
      const s = sl.chickenCoop.shed;
      pushBuilding('building.shed', s.x, s.y, s.w, s.h, objSet, 'chickenCoop.main');
    }
    // Vaches : grange
    if (A.has('cow') && owned.cow > 0) {
      const b = sl.cow.barn;
      pushBuilding('building.barn.bigdoor', b.x, b.y, b.w, b.h, objSet, 'cow.main');
    }
    // Chambre d'hôte
    if (A.has('guestHouse') && owned.guestHouse > 0) {
      const g = sl.guestHouse.house;
      pushBuilding('building.house.red', g.x, g.y, g.w, g.h, objSet, 'guestHouse.main');
    }
    // Ruches
    if (A.has('beehive')) {
      const n = Math.min(3, owned.beehive || 0);
      for (let k = 0; k < n; k++) {
        const t = sl.beehive.hives[k];
        pushBuilding('beehive', t.x, t.y, 1, 1, objSet, `beehive.${k}`);
      }
    }
    // Étal
    if (A.has('roadsideStand') && owned.roadsideStand > 0) {
      const s = sl.roadsideStand;
      pushBuilding('stall.cart', s.cart.x, s.cart.y, 1, 1, objSet, 'roadsideStand.main');
      const pk = pops.get('roadsideStand.main');
      if (pk === undefined || time - pk > 0.3) {
        for (let k = 0; k < s.crates.length; k++) {
          const t = s.crates[k];
          const cropId = recentCrops[k];
          const name = cropId ? `crate.${cropId}` : k === 0 ? 'crate.empty' : k === 1 ? 'sack.empty' : null;
          if (name) pushSprite(name, t.x * TILE, t.y * TILE + 1, (t.y + 1) * TILE, images);
        }
      }
    }
    // Panneaux solaires
    if (A.has('solarPanel')) {
      const n = Math.min(2, owned.solarPanel || 0);
      for (let k = 0; k < n; k++) {
        const t = sl.solarPanel.units[k];
        pushBuilding('solar.panel', t.x, t.y, 1, 1, objSet, `solarPanel.${k}`);
      }
    }
    // Arroseurs
    if (A.has('sprinkler')) {
      const lvl = Math.min(3, owned.sprinkler || 0);
      const n = lvl > 0 ? sl.sprinkler.perLevel[lvl - 1] : 0;
      for (let k = 0; k < n; k++) {
        const t = sl.sprinkler.units[k];
        // Chaque tête appartient au niveau d'arrosage qui l'a ajoutée.
        let unitLevel = 0;
        while (sl.sprinkler.perLevel[unitLevel] <= k) unitLevel++;
        const popKey = `sprinkler.${unitLevel}`;
        pushBuilding('sprinkler', t.x, t.y, 1, 1, objSet, popKey);
      }
    }

    // Animaux
    for (const kind of ANIMAL_KINDS) {
      for (const a of animals[kind]) {
        let hop = 0;
        if (a.moving) hop = Math.sin(a.phase * HOP_RATE[kind] * Math.PI) > 0 ? -1 : 0;
        if (a.peck > 0) hop = 1;
        const x = Math.round(a.x);
        const y = Math.round(a.y) + hop;
        let scale = 1;
        const age = time - a.born;
        if (age < POP_TIME) scale = popScale(age / POP_TIME);
        const name = `animal.${kind}`;
        if (scale !== 1) {
          const w = 16 * scale;
          pushSprite(name, Math.round(x + (16 - w) / 2), Math.round(y + 16 - w), a.y + 16, images, { flipX: a.facing < 0, scale });
        } else {
          pushSprite(name, x, y, a.y + 16, images, { flipX: a.facing < 0 });
        }
      }
    }

    // Fermier
    {
      const walking = farmer.path.length > 0;
      const hop = walking && Math.sin(farmer.walkT * 5 * Math.PI) > 0 ? -1 : 0;
      const workBob = farmer.tool && Math.sin(farmer.toolT * 18) > 0 ? 1 : 0;
      const x = Math.round(farmer.x) - 8;
      const y = Math.round(farmer.y) - 15 + hop + workBob;
      pushSprite('farmer', x, y, farmer.y + 1, images, {
        flipX: farmer.facing < 0,
        tool: farmer.tool,
        toolFlip: farmer.facing < 0,
      });
    }
    void weather;
    void dayProgress;
  }

  function drawEntries() {
    drawList.length = 0;
    for (let i = 0; i < entryCount; i++) drawList.push(entries[i]);
    drawList.sort(byDepth);
    const c = vctx;
    for (const e of drawList) {
      if (e.scale !== 1) {
        drawSprite(c, e.set, e.name, e.x, e.y, { scale: e.scale, flipX: e.flipX });
      } else {
        drawSprite(c, e.set, e.name, e.x, e.y, e.flipX ? { flipX: true } : undefined);
      }
      if (e.tool) {
        // Outil tenu à côté du fermier (tuile de 16 px, dessinée plus haut que ses mains)
        drawSprite(c, images, e.tool, e.x + (e.toolFlip ? -9 : 9), e.y + 2, { flipX: e.toolFlip });
      }
    }
    drawList.length = 0;
  }

  function drawBees(owned, season, weather, dayProgress) {
    if (!layout.available.has('beehive')) return;
    if (season === 'winter' || weather === 'rain' || weather === 'storm' || dayProgress > 0.92) return;
    const n = Math.min(3, owned.beehive || 0);
    const c = vctx;
    for (let k = 0; k < n; k++) {
      const t = layout.slots.beehive.hives[k];
      const cx = t.x * TILE + 8;
      const cy = t.y * TILE + 5;
      for (let b = 0; b < 3; b++) {
        const ph = k * 2.1 + b * 2.4;
        const x = Math.round(cx + Math.sin(time * 1.9 + ph) * 8 + Math.sin(time * 4.3 + ph * 1.7) * 3);
        const y = Math.round(cy + Math.cos(time * 2.6 + ph) * 4 - 4 + Math.sin(time * 6 + ph) * 1.5);
        c.fillStyle = '#fdbe53';
        c.fillRect(x, y, 1, 1);
        c.fillStyle = OUTLINE;
        c.fillRect(x + (Math.sin(time * 1.9 + ph) > 0 ? -1 : 1), y, 1, 1);
        if (Math.sin(time * 40 + ph) > 0) {
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(x, y - 1, 1, 1);
        }
      }
    }
  }

  // Cheminées et arroseurs : émissions régulières de particules.
  let smokeT = 0;
  let sprayT = 0;
  function emitAmbient(dt, owned, season, weather, dayProgress) {
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = season === 'summer' ? rnd(1.4, 2.2) : rnd(0.6, 1.1);
      const h = layout.house;
      effects.smoke((h.x + 1) * TILE + 7, h.y * TILE + 1);
      if (layout.available.has('guestHouse') && owned.guestHouse > 0 && Math.random() < 0.6) {
        const g = layout.slots.guestHouse.house;
        effects.smoke((g.x + 1) * TILE + 7, g.y * TILE + 1);
      }
    }
    const lvl = layout.available.has('sprinkler') ? Math.min(3, owned.sprinkler || 0) : 0;
    const spraying = lvl > 0 && season !== 'winter' && weather !== 'rain' && weather !== 'storm' && dayProgress < 0.22;
    if (spraying) {
      sprayT -= dt;
      if (sprayT <= 0) {
        sprayT = 0.05;
        const n = layout.slots.sprinkler.perLevel[lvl - 1];
        const t = layout.slots.sprinkler.units[Math.floor(Math.random() * n)];
        effects.spray(t.x * TILE + 8, t.y * TILE + 4);
      }
    }
  }

  function drawHover(owned) {
    if (!hover) return;
    let r = null;
    if (hover.type === 'plot') r = layout.plotRect(hover.index);
    else if (hover.type === 'investment') r = layout.investmentRect(hover.id, owned[hover.id] || 0);
    if (!r) return;
    const c = vctx;
    const pulse = 0.65 + 0.35 * Math.sin(time * 5);
    const x0 = r.x - 1;
    const y0 = r.y - 1;
    const x1 = r.x + r.w;
    const y1 = r.y + r.h;
    const arm = Math.max(3, Math.min(layout.plotScale > 1 ? 8 : 5, Math.floor(Math.min(r.w, r.h) / 4)));
    c.globalAlpha = pulse;
    // Coins en « L » : contour sombre puis blanc
    for (const [color, o] of [[OUTLINE, 1], ['#ffffff', 0]]) {
      c.fillStyle = color;
      const ax = x0 - o;
      const ay = y0 - o;
      const bx = x1 + o;
      const by = y1 + o;
      c.fillRect(ax, ay, arm, 1); c.fillRect(ax, ay, 1, arm);
      c.fillRect(bx - arm + 1, ay, arm, 1); c.fillRect(bx, ay, 1, arm);
      c.fillRect(ax, by, arm, 1); c.fillRect(ax, by - arm + 1, 1, arm);
      c.fillRect(bx - arm + 1, by, arm, 1); c.fillRect(bx, by - arm + 1, 1, arm);
    }
    if (hover.type === 'plot') {
      c.globalAlpha = 0.12 * pulse;
      c.fillStyle = '#ffffff';
      c.fillRect(r.x, r.y, r.w, r.h);
    }
    c.globalAlpha = 1;
  }

  // ── Image ───────────────────────────────────────────────────────────────────────
  const fxState = { season: 'spring', weather: 'sunny', dayProgress: 0.5, view: { x: 0, y: 0, w: 512, h: 320 } };
  function render(game, timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    const dt = lastTime === null ? 0 : Math.min(0.1, Math.max(0, (timeMs - lastTime) / 1000));
    lastTime = timeMs;
    time += dt;
    if (flingV !== 0) {
      const before = scrollDev;
      setScrollDev(scrollDev + flingV * dt * dpr);
      flingV *= Math.exp(-dt * 4.5);
      if (Math.abs(flingV) < 12 || scrollDev === before) flingV = 0;
    }

    if (game.level && game.level !== layout.level) setLevel(game.level);
    if (game !== lastGame) {
      lastGame = game;
      resetTracking();
      effects.clear();
    }

    const cal = game.query.calendar();
    const season = cal.seasonId || 'spring';
    const weather = game.state.weather?.today || 'sunny';
    const dayProgress = cal.dayProgress ?? 0.5;
    const owned = game.state.investments || {};
    const raining = weather === 'rain' || weather === 'storm';
    const sheetsEnv = seasonSheets[season] || seasonSheets.spring;

    syncOwned(game);
    syncPlots(game, raining);
    initialized = true;

    // Clé du cache de la couche fixe : saison + emplacements achetés (la taille remet la clé à -1).
    let key = SEASON_INDEX[season] ?? 0;
    let bit = 4;
    for (const id of layout.available) {
      if ((owned[id] || 0) > 0) key += bit;
      bit *= 2;
    }
    if (key !== staticKey) {
      buildStatic(season, owned);
      staticKey = key;
    }

    for (const kind of ANIMAL_KINDS) for (const a of animals[kind]) updateAnimal(a, dt);
    updateFarmer(dt);
    emitAmbient(dt, owned, season, weather, dayProgress);
    fxState.season = season;
    fxState.weather = weather;
    fxState.dayProgress = dayProgress;
    fxState.view.x = -ox;
    fxState.view.y = -oy;
    fxState.view.w = viewW;
    fxState.view.h = viewH;
    effects.update(dt, fxState);

    // Tampon de vue
    const c = vctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(staticLayer, 0, 0);
    c.translate(ox, oy);
    drawPlots(sheetsEnv, raining, season);
    effects.drawGround(c, images);
    collectDrawables(owned, season, sheetsEnv, weather, dayProgress);
    drawEntries();
    effects.drawSmoke(c);
    drawBees(owned, season, weather, dayProgress);
    effects.drawWorld(c);
    drawHover(owned);
    c.setTransform(1, 0, 0, 1, 0, 0);
    effects.drawWeather(c);
    effects.drawLight(c, viewW, viewH);
    effects.postProcess(c, view, scratch);

    // Canvas final
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(view, 0, 0, viewW, viewH, blitX, blitY, viewW * zoom, viewH * zoom);
    effects.drawScreen(ctx, worldToDevice, zoom, images, dpr);
  }

  function rebuildLayout(lvl) {
    layout = createLayout(lvl, { mode });
    resetTracking();
    effects.clear();
    userScrolled = false;
    flingV = 0;
  }

  function setLevel(lvl) {
    rebuildLayout(lvl);
    computeCamera();
  }

  // Taille initiale : celle du canvas tel qu'il est.
  resize(canvas.clientWidth || canvas.width || 1024, canvas.clientHeight || canvas.height || 640, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

  return {
    resize,
    render,
    screenToWorld,
    worldToScreen,
    hitTest,
    setHover(hit) {
      hover = hit || null;
    },
    onEvent(type, payload) {
      effects.onEvent(type, payload, layout);
    },
    setLevel,
    setInsets,
    scrollBy,
    setScroll,
    getScroll() {
      return scrollDev / dpr;
    },
    maxScroll() {
      return maxScrollDev / dpr;
    },
    fling,
    focusField,
    focusPlot,
    get layoutMode() {
      return mode;
    },
    get insets() {
      return { ...insets };
    },
    get dpr() {
      return dpr;
    },
    get layout() {
      return layout;
    },
    get effects() {
      return effects;
    },
    get zoom() {
      return zoom;
    },
    get hover() {
      return hover;
    },
  };
}
