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
//   scene.focusPlot(i, opts?)           fait défiler juste ce qu'il faut pour voir la parcelle i
//                                       opts : { margin (px CSS, 24), bottom (px CSS couverts en
//                                       plus en bas, ex. bulle du tutoriel), animate (bool) }
//   scene.setOverlay(bottomCss)         panneau temporaire posé sur le bas de la bande visible
//                                       (feuille du bas ouverte) : on peut alors faire défiler
//                                       au-delà du bas du monde (forêt) pour garder une parcelle
//                                       au-dessus de la feuille ; 0 = retour animé dans les bornes
//   scene.scrollTo(yCss, animate?)      défilement absolu, animé en douceur si animate
//   scene.layoutMode                    'portrait' | 'landscape'
//   scene.screenToWorld(x, y)           px CSS (relatifs au canvas) → { x, y } monde (défilement compris)
//   scene.worldToScreen(wx, wy)         monde → { x, y } px CSS (pour placer une infobulle)
//   scene.hitTest(x, y, opts?)          px CSS → { type:'plot', index } | { type:'investment', id } | null
//                                       opts.touch = true : tolérant (doigt) — une touche dans l'allée
//                                       ou la clôture à moins de ~8 px CSS d'une parcelle la désigne
//   scene.setHover(hit)                 surbrillance (résultat de hitTest, ou null)
//   scene.onEvent(type, payload)        = effects.onEvent(type, payload, scene.layout)
//   scene.setLevel(level)               change de niveau (nouvelle disposition)
//   scene.setCosmetics({ farmName, outfit, path, fence, decor })   (v3) personnalisation : nom sur le
//                                       panneau, tenue du fermier, style des allées ('path.dirt' |
//                                       'path.stone'), clôture du champ ('fence.wood' | 'fence.picket' |
//                                       'fence.stone' | 'fence.hedge'), décor = { [slotId]: itemId | null }
//                                       (`slots` accepté comme synonyme de `decor`) ; champs absents :
//                                       inchangés. Relu à chaque appel (couche fixe reconstruite).
//   scene.setDecorMode(on)              (v3) mode décoration : repères « + » sur les emplacements vides,
//                                       emplacements soulignés, le reste légèrement assombri ; hitTest
//                                       renvoie alors { type:'decorSlot', id } | { type:'sign' } |
//                                       { type:'farmer' } | null (seulement ces trois types)
//   scene.decorSlotRect(id)             (v3) rectangle (px du monde) d'un emplacement, ou null
//   scene.focusDecorSlot(id, opts?)     (v3) défile pour voir l'emplacement (ou 'sign', 'farmer') au-dessus
//                                       de la feuille ouverte ; opts { margin, animate }
//   scene.focusDecorArea(animate?)      (v3) défile sur la cour (fait aussi à l'entrée en mode décoration)
//   scene.focusRect(r, opts?)           (v3) défile pour voir le rectangle r (px du monde) au-dessus de la feuille
//   scene.setContestDay(on | null)      (v3) force (true/false) ou laisse automatique (null) les fanions
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

import {
  TILE, SPRITES, drawSprite, cropSprite, soilSprite, spriteRect, treeSprite, productSprite, decorSprite, outfitSprite,
  FARM_SIGN_WIDE_TEXT_RECT, WINDMILL_FRAMES, drawWideFarmSign,
} from './atlas.js';
import { getCrop } from '../data/crops.js';
import { buildSeasonSheets } from './assets.js';
import { createLayout, tileHash } from './layout.js';
import { createEffects } from './effects.js';

const OUTLINE = '#3f2631';
const MIN_ZOOM = 2;
const PORTRAIT_RATIO = 1.05; // portrait si hauteur > largeur × 1,05
const MAX_TILE_CSS = 40; // portrait : une tuile ne dépasse pas ~40 px CSS (tablettes)
const TOUCH_SLOP_CSS = 8; // tolérance du toucher autour des parcelles
const ANIMAL_SPEED = { chicken: 15, sheep: 9, cow: 7, goat: 11 };
const HOP_RATE = { chicken: 9, sheep: 6, cow: 4.5, goat: 7 };
const FARMER_SPEED = 44;
const POP_TIME = 0.55;
const ANIMAL_KINDS = ['chicken', 'sheep', 'cow', 'goat'];
const PROCESSING_IDS = ['jamWorkshop', 'dairy', 'mill'];
const DEFAULT_COSMETICS = { farmName: 'Ferme des Tilleuls', outfit: 'outfit.classic', path: 'path.dirt', fence: 'fence.wood', decor: {} };
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
  let overlayDev = 0; // panneau posé sur le bas de la bande (feuille ouverte), px réels
  let scrollAnim = null; // { from, to, t, dur } défilement animé (px réels, secondes)
  let scrollBeforeOverlay = null; // défilement d'avant l'ouverture de la feuille (px réels)
  const SCROLL_ANIM = 0.32;

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
  let prevFruit = [];
  let unlockedCount = -1;

  // ── (v3) Personnalisation et mode décoration ──────────────────────────────────────
  const cosmetics = { ...DEFAULT_COSMETICS, decor: {} };
  let cosVersion = 0;
  let decorMode = false;
  let contestForce = null;
  let millPhase = 0; // ailes du moulin (images, fractionnaire)
  const signText = { key: '', size: 0, text: '' }; // mesure du nom de la ferme (cache)
  let visualIndex = null; // « vcol,vrow » → index de parcelle (portrait)
  const prevOwned = {};
  const pops = new Map(); // clé → temps de départ
  const recentCrops = []; // cagettes de l'étal (plus récentes en premier)

  // Animaux
  const animals = { chicken: [], cow: [], sheep: [], goat: [] };

  // Fermier
  const farmer = {
    x: 0, y: 0, path: [], facing: 1, where: 'home', idle: 0, tool: null, toolT: 0, walkT: 0,
  };

  // Liste de dessin triée par profondeur (réutilisée)
  const entries = [];
  let entryCount = 0;
  function entry() {
    if (entryCount >= entries.length) entries.push({ sortY: 0, name: '', x: 0, y: 0, flipX: false, scale: 1, set: null, alpha: 1, tool: null, toolFlip: false, img: null });
    const e = entries[entryCount++];
    e.img = null;
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
    prevFruit = new Array(n).fill(0);
    prevGrowth = new Array(n).fill(-1);
    prevWatered = new Array(n).fill(false);
    prevUnlocked = new Array(n).fill(false);
    unlockedCount = -1;
    visualIndex = null;
    for (const k of Object.keys(prevOwned)) delete prevOwned[k];
    pops.clear();
    recentCrops.length = 0;
    animals.chicken.length = 0;
    animals.cow.length = 0;
    animals.sheep.length = 0;
    animals.goat.length = 0;
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
    // + une hauteur d'écran : défilement au-delà du bas du monde quand une feuille est ouverte.
    const h = Math.ceil((devH * 2 + maxScrollDev) / zoom) + 3;
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

  /** Défilement maximal : bornes du monde, ou plus loin si une feuille couvre le bas. */
  function scrollLimitDev() {
    if (overlayDev <= 0) return maxScrollDev;
    const worldBottom = baseY + layout.height * zoom; // bas du monde, défilement nul
    const visibleBottom = band.y + band.h - overlayDev;
    return Math.max(maxScrollDev, Math.round(worldBottom - visibleBottom));
  }

  function setScrollDev(v) {
    scrollDev = Math.max(0, Math.min(scrollLimitDev(), Math.round(v)));
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

  /** Défilement animé (px réels) : départ rapide, arrivée en douceur. */
  function animateScrollDev(target) {
    const to = Math.max(0, Math.min(scrollLimitDev(), Math.round(target)));
    const reduce = typeof document !== 'undefined' && document.documentElement.classList.contains('reduced-motion');
    if (reduce || Math.abs(to - scrollDev) < 2) {
      scrollAnim = null;
      setScrollDev(to);
      return;
    }
    scrollAnim = { from: scrollDev, to, t: 0, dur: SCROLL_ANIM };
  }

  function stepScrollAnim(dt) {
    if (!scrollAnim) return;
    const a = scrollAnim;
    a.t = Math.min(a.dur, a.t + dt);
    const k = a.t / a.dur;
    const e = 1 - (1 - k) ** 3;
    setScrollDev(a.from + (a.to - a.from) * e);
    if (k >= 1) scrollAnim = null;
  }

  function setOverlay(bottomCss) {
    const v = Math.max(0, Math.round((Number(bottomCss) || 0) * dpr));
    if (v === overlayDev) return;
    // Feuille ouverte : on retient la vue d'avant, retrouvée en douceur à la fermeture.
    if (overlayDev === 0 && v > 0) scrollBeforeOverlay = scrollAnim ? scrollAnim.to : scrollDev;
    overlayDev = v;
    if (v === 0 && scrollBeforeOverlay !== null) {
      const back = scrollBeforeOverlay;
      scrollBeforeOverlay = null;
      animateScrollDev(back);
      return;
    }
    // Feuille plus basse : on revient en douceur dans les bornes du monde.
    const limit = scrollLimitDev();
    if (scrollAnim && scrollAnim.to > limit) scrollAnim = null;
    if (!scrollAnim && scrollDev > limit) animateScrollDev(limit);
  }

  function scrollTo(yCss, animate = false) {
    flingV = 0;
    userScrolled = true;
    if (animate) animateScrollDev((Number(yCss) || 0) * dpr);
    else {
      scrollAnim = null;
      setScrollDev((Number(yCss) || 0) * dpr);
    }
    return scrollDev / dpr;
  }

  function scrollBy(dyCss) {
    const before = scrollDev;
    flingV = 0;
    scrollAnim = null;
    scrollBeforeOverlay = null;
    userScrolled = true;
    setScrollDev(scrollDev + (Number(dyCss) || 0) * dpr);
    return (scrollDev - before) / dpr;
  }

  function setScroll(yCss) {
    flingV = 0;
    scrollAnim = null;
    userScrolled = true;
    setScrollDev((Number(yCss) || 0) * dpr);
    return scrollDev / dpr;
  }

  function fling(vyCss) {
    if (maxScrollDev <= 0) return;
    userScrolled = true;
    scrollAnim = null;
    flingV = Math.max(-4000, Math.min(4000, Number(vyCss) || 0));
  }

  function focusField() {
    flingV = 0;
    scrollAnim = null;
    scrollBeforeOverlay = null;
    userScrolled = false;
    focusFieldDev();
  }

  /**
   * Fait défiler le moins possible pour que la parcelle soit entièrement visible (avec une marge),
   * au-dessus de la feuille ouverte (setOverlay) et d'une éventuelle zone couverte en plus.
   * @param opts nombre (marge, compatibilité) ou { margin = 24, bottom = 0, animate = false }
   * @returns défilement visé (px CSS)
   */
  function focusPlot(i, opts = {}) {
    const o = typeof opts === 'number' ? { margin: opts } : opts || {};
    const r = layout.plotRect(i);
    if (!r) return scrollDev / dpr;
    flingV = 0;
    const m = (o.margin ?? 24) * dpr;
    const cur = scrollAnim ? scrollAnim.to : scrollDev;
    const top = baseY - cur + r.y * zoom;
    const bottom = top + r.h * zoom;
    const visTop = band.y + m;
    const visBottom = band.y + band.h - overlayDev - Math.max(0, (o.bottom || 0) * dpr) - m;
    let target = cur;
    if (bottom > visBottom) target = cur + (bottom - visBottom);
    if (top - (target - cur) < visTop) target = cur - (visTop - top); // le haut d'abord si trop petit
    if (target === cur) return cur / dpr;
    if (o.animate) animateScrollDev(target);
    else {
      scrollAnim = null;
      setScrollDev(target);
    }
    return (scrollAnim ? scrollAnim.to : scrollDev) / dpr;
  }

  /** Rectangle (px du monde) englobant les emplacements de la cour (portail, maison, route, panneau). */
  function decorAreaRect() {
    let r = null;
    for (const d of layout.decorSlots || []) {
      if (d.id === 'field.corner' || d.id === 'pond') continue;
      const q = { x: d.x, y: d.kind === 'small' ? d.y - TILE : d.y, w: d.w, h: d.kind === 'small' ? d.h + TILE : d.h };
      r = r ? { x: Math.min(r.x, q.x), y: Math.min(r.y, q.y), w: Math.max(r.x + r.w, q.x + q.w) - Math.min(r.x, q.x), h: Math.max(r.y + r.h, q.y + q.h) - Math.min(r.y, q.y) } : q;
    }
    return r;
  }

  /**
   * (v3) Mode décoration : fait défiler pour montrer la cour (la plupart des emplacements). Si elle
   * ne tient pas, son bas (maison, route, panneau) est prioritaire.
   * @returns défilement visé (px CSS)
   */
  function focusDecorArea(animate = true) {
    const r = decorAreaRect();
    if (!r) return scrollDev / dpr;
    flingV = 0;
    userScrolled = true;
    const m = 12 * dpr;
    const visH = band.h - overlayDev;
    let target;
    if (r.h * zoom + 2 * m <= visH) target = baseY + (r.y + r.h / 2) * zoom - (band.y + visH / 2);
    else target = baseY + (r.y + r.h) * zoom + m - (band.y + visH);
    if (animate) animateScrollDev(target);
    else {
      scrollAnim = null;
      setScrollDev(target);
    }
    return (scrollAnim ? scrollAnim.to : scrollDev) / dpr;
  }

  /**
   * (v3) Fait défiler le moins possible pour voir l'emplacement `id` (au-dessus de la feuille ouverte).
   * opts : { margin (px CSS, 24), animate (true) }. Renvoie le défilement visé (px CSS).
   */
  function focusDecorSlot(id, opts = {}) {
    const d = id === 'farmer' ? { ...farmerRect(), kind: 'small' } : (layout.decorSlots || []).find((s0) => s0.id === id);
    if (!d) return scrollDev / dpr;
    // Les petits objets dépassent d'une tuile vers le haut.
    return focusRect(d.kind === 'small' ? { x: d.x, y: d.y - TILE, w: d.w, h: d.h + TILE } : d, opts);
  }

  /**
   * (v3) Fait défiler le moins possible pour voir le rectangle `r` (px du monde) au-dessus de la
   * feuille ouverte. opts : { margin (px CSS, 24), animate (true) }. Renvoie le défilement visé (px CSS).
   */
  function focusRect(r, opts = {}) {
    if (!r) return scrollDev / dpr;
    const d = r;
    flingV = 0;
    userScrolled = true;
    const top0 = d.y;
    const m = (opts.margin ?? 24) * dpr;
    const cur = scrollAnim ? scrollAnim.to : scrollDev;
    const top = baseY - cur + top0 * zoom;
    const bottom = baseY - cur + (d.y + d.h) * zoom;
    const visTop = band.y + m;
    const visBottom = band.y + band.h - overlayDev - m;
    let target = cur;
    if (bottom > visBottom) target = cur + (bottom - visBottom);
    if (top - (target - cur) < visTop) target = cur - (visTop - top);
    if (target !== cur) {
      if (opts.animate === false) {
        scrollAnim = null;
        setScrollDev(target);
      } else animateScrollDev(target);
    }
    return (scrollAnim ? scrollAnim.to : scrollDev) / dpr;
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

  /** Rectangle du fermier (px du monde), tel qu'il est dessiné. */
  function farmerRect() {
    return { x: Math.round(farmer.x) - 8, y: Math.round(farmer.y) - 15, w: 16, h: 16 };
  }

  function distRect(r, x, y) {
    const dx = x < r.x ? r.x - x : x >= r.x + r.w ? x - (r.x + r.w) : 0;
    const dy = y < r.y ? r.y - y : y >= r.y + r.h ? y - (r.y + r.h) : 0;
    return Math.hypot(dx, dy);
  }

  /**
   * Mode décoration : emplacement, panneau ou fermier sous le point (px du monde). Tolérant : la cible
   * la plus proche à moins de `slop` px (au moins de quoi faire ~48 px CSS au doigt).
   */
  function decorHit(wx, wy, slop) {
    let best = null;
    let bestD = Infinity;
    const consider = (r, hit) => {
      const d = distRect(r, wx, wy);
      if (d <= slop && d < bestD - 1e-6) { bestD = d; best = hit; }
    };
    // Le fermier d'abord (il peut passer devant un emplacement) : à égalité, il l'emporte.
    consider(farmerRect(), { type: 'farmer' });
    for (const d of layout.decorSlots || []) {
      // Un grand sprite (réverbère, épouvantail, nichoir) dépasse vers le haut : zone agrandie.
      const item = cosmetics.decor[d.id];
      const sp = item ? decorSprite(item) : null;
      const tall = sp && SPRITES[sp] && (SPRITES[sp].h || 1) > 1 && d.kind === 'small';
      const r = tall ? { x: d.x, y: d.y - TILE, w: d.w, h: d.h + TILE } : d;
      consider(r, d.kind === 'sign' ? { type: 'sign' } : { type: 'decorSlot', id: d.id });
    }
    return best;
  }

  function hitTest(x, y, hitOpts) {
    const w = screenToWorld(x, y);
    if (decorMode) {
      // Au doigt : ~16 px CSS de tolérance autour des cibles de 16 px du monde (≥ 48 px CSS au total).
      const slop = hitOpts && hitOpts.touch ? Math.max(3, (16 * dpr) / zoom) : 1;
      return decorHit(w.x, w.y, slop);
    }
    const owned = lastGame ? lastGame.state.investments : undefined;
    if (hitOpts && hitOpts.touch) return layout.hitTestNear(w.x, w.y, owned, (TOUCH_SLOP_CSS * dpr) / zoom);
    return layout.hitTest(w.x, w.y, owned);
  }

  function hasSlot(id) {
    return (layout.decorSlots || []).some((d) => d.id === id);
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

  // (v3) Allées en pavés : même découpage en quarts de tuile que la terre, à partir des tuiles
  // « deco.path.stone » (plein), « .h » / « .v » (bords) et « .single » (coins extérieurs).
  function drawStonePathTile(c, sheets, tx, ty, dx, dy) {
    const n = P(tx, ty - 1);
    const s2 = P(tx, ty + 1);
    const w = P(tx - 1, ty);
    const e = P(tx + 1, ty);
    const C = 'deco.path.stone';
    drawQuad(c, sheets, n && w ? C : n ? 'deco.path.stone.v' : w ? 'deco.path.stone.h' : 'deco.path.stone.single', 0, 0, dx, dy);
    drawQuad(c, sheets, n && e ? C : n ? 'deco.path.stone.v' : e ? 'deco.path.stone.h' : 'deco.path.stone.single', 1, 0, dx, dy);
    drawQuad(c, sheets, s2 && w ? C : s2 ? 'deco.path.stone.v' : w ? 'deco.path.stone.h' : 'deco.path.stone.single', 0, 1, dx, dy);
    drawQuad(c, sheets, s2 && e ? C : s2 ? 'deco.path.stone.v' : e ? 'deco.path.stone.h' : 'deco.path.stone.single', 1, 1, dx, dy);
  }

  // (v3) Styles de la clôture du champ : pièces de chaque kit (null = rien, ex. ouverture de la haie).
  const FENCE_KITS = {
    'fence.picket': { tl: 'deco.fence.picket.tl', t: 'deco.fence.picket.t', tr: 'deco.fence.picket.tr', l: 'deco.fence.picket.l', r: 'deco.fence.picket.r', bl: 'deco.fence.picket.bl', b: 'deco.fence.picket.t', br: 'deco.fence.picket.br', gate: 'deco.fence.picket.gate' },
    'fence.stone': { tl: 'deco.wall.stone.tl', t: 'deco.wall.stone.t', tr: 'deco.wall.stone.tr', l: 'deco.wall.stone.l', r: 'deco.wall.stone.r', bl: 'deco.wall.stone.bl', b: 'deco.wall.stone.b', br: 'deco.wall.stone.br', gate: 'deco.wall.stone.gate' },
    'fence.hedge': { tl: 'deco.hedge', t: 'deco.hedge.h.mid', tr: 'deco.hedge', l: 'deco.hedge.v.mid', r: 'deco.hedge.v.mid', bl: 'deco.hedge', b: 'deco.hedge.h.mid', br: 'deco.hedge', gate: null, gateL: 'deco.hedge.h.right', gateR: 'deco.hedge.h.left' },
  };

  function drawFieldFence(c, sheets, r, gateX) {
    const kit = FENCE_KITS[cosmetics.fence];
    if (!kit) {
      drawFence(c, sheets, r, gateX);
      return;
    }
    const x1 = r.x + r.w - 1;
    const y1 = r.y + r.h - 1;
    for (let y = r.y; y <= y1; y++) {
      for (let x = r.x; x <= x1; x++) {
        let name = null;
        if (y === r.y) name = x === r.x ? kit.tl : x === x1 ? kit.tr : kit.t;
        else if (y === y1) {
          if (x === r.x) name = kit.bl;
          else if (x === x1) name = kit.br;
          else if (x === gateX) name = kit.gate;
          else if (kit.gateL && x === gateX - 1) name = kit.gateL;
          else if (kit.gateR && x === gateX + 1) name = kit.gateR;
          else name = kit.b;
        } else if (x === r.x) name = kit.l;
        else if (x === x1) name = kit.r;
        if (name) drawSprite(c, sheets, name, x * TILE, y * TILE);
      }
    }
  }

  // (v3) Forêt de montagne : les tuiles de forêt couvertes de sapins serrés, en quinconce.
  function drawPineForest(c, sheets, tx0, ty0, tx1, ty1) {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let row = 0; row < 2; row++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!layout.isForest(tx, ty)) continue;
          for (let col = 0; col < 2; col++) {
            const h = tileHash(tx * 2 + col, ty * 2 + row, 31);
            const px2 = tx * TILE + col * 8 + ((row & 1) ? 4 : 0) - 4 + Math.floor(h * 3) - 1;
            const py = ty * TILE + row * 8 - 8 + Math.floor(h * 2);
            // Pas de sapin qui déborde sur la route, ni sous la lisière du bas de la forêt du haut.
            if (!layout.isForest(tx, ty + 1) && row === 1) continue;
            drawSprite(c, sheets, h < 0.12 ? 'tree.pine.tall' : 'tree.pine', px2, h < 0.12 ? py - TILE : py);
          }
        }
      }
    }
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
      case 'pine': return 'tree.pine';
      case 'pineTall': return 'tree.pine.tall';
      case 'appleTree':
        return season === 'spring' ? 'tree.apple.spring' : season === 'summer' ? 'tree.apple.summer.ripe' : season === 'autumn' ? 'tree.apple.autumn.ripe' : 'tree.apple.winter';
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
        if (!P(tx, ty)) continue;
        if (cosmetics.path === 'path.stone') drawStonePathTile(c, sheets, tx, ty, tx * TILE, ty * TILE);
        else drawPathTile(c, sheets, tx, ty, tx * TILE, ty * TILE);
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

    if (layout.theme === 'mountain') drawPineForest(c, sheets, tx0, ty0, tx1, ty1);

    // Lisières verticales : arbres isolés à cheval sur la coupe nette des tuiles de forêt.
    const edgeGreen = layout.theme === 'mountain' || season === 'winter' ? 'tree.pine' : season === 'autumn' ? 'tree.autumn' : 'tree.green';
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
    drawFieldFence(c, sheets, f.fence, f.gate.x);
    const sl = layout.slots;
    const A = layout.available;
    if (A.has('goat') && sl.goat && (owned.goat || 0) > 0) drawFence(c, sheets, sl.goat.fence, null);
    // (v3) Petite mare (grand emplacement) : au sol, sous le reste du décor.
    const pond = (layout.decorSlots || []).find((d) => d.id === 'pond');
    if (pond && decorSprite(cosmetics.decor.pond) === 'deco.pond') drawSprite(c, sheets, 'deco.pond', pond.x, pond.y);
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
    // (v3) Panneau de la ferme (le nom est écrit à l'échelle de l'écran : drawSignText).
    if (layout.sign && hasSlot('sign')) drawWideFarmSign(c, sheets, layout.sign.x * TILE, layout.sign.y * TILE);
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
      goat: layout.available.has('goat') && sl.goat ? Math.min(3, owned.goat || 0) : 0,
    };
    const pens = { chicken: sl.chickenCoop.pen, cow: sl.cow.pen, sheep: sl.sheep.pen, goat: sl.goat?.pen };
    for (const kind of ANIMAL_KINDS) {
      const list = animals[kind];
      if (!pens[kind]) { list.length = 0; continue; }
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
    // Une parcelle achetée change le prix (ou la possibilité d'achat) des autres : on les relit.
    let open = 0;
    for (let i = 0; i < n; i++) if (plots[i].unlocked) open++;
    if (open !== unlockedCount) {
      unlockedCount = open;
      for (let i = 0; i < n; i++) if (!plots[i].unlocked && plotViews[i]) plotViews[i] = null;
    }
    let changed = 0;
    let lastIdx = -1;
    let lastTool = null;
    for (let i = 0; i < n; i++) {
      const p = plots[i];
      const crop = p.cropId || null;
      const fruit = p.fruit || 0;
      if (plotViews[i] && crop === prevCrop[i] && p.growth === prevGrowth[i] && p.watered === prevWatered[i] && p.unlocked === prevUnlocked[i] && fruit === prevFruit[i]) continue;
      const was = plotViews[i];
      const view = game.query.plot(i);
      if (initialized && was) {
        let tool = null;
        if (!prevUnlocked[i] && p.unlocked) tool = 'tool.hoe';
        else if (!prevCrop[i] && crop) tool = 'tool.shovel';
        else if (prevCrop[i] && !crop) {
          if (was.mature && prevCrop[i] !== 'apple') {
            tool = 'tool.sickle';
            noteHarvest(prevCrop[i]);
          } else if (prevCrop[i] === 'apple') tool = 'tool.axe'; // pommier arraché
        } else if (crop === 'apple' && crop === prevCrop[i] && fruit < prevFruit[i] && treeInfo(was, p).fruitReady) {
          tool = 'tool.sickle'; // cueillette
          noteHarvest('apple');
        } else if (crop && !prevWatered[i] && p.watered && !raining) tool = 'tool.wateringcan';
        if (tool) {
          changed++;
          lastIdx = i;
          lastTool = tool;
        }
      }
      plotViews[i] = view;
      prevCrop[i] = crop;
      prevFruit[i] = fruit;
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

  /** Parcelle voisine (à l'écran, par un côté) d'une parcelle ouverte ? (portrait) */
  function touchesOpen(i) {
    const p = layout.plots[i];
    if (p.vcol === undefined) return true;
    if (!visualIndex) visualIndex = new Map(layout.plots.map((q) => [`${q.vcol},${q.vrow}`, q.index]));
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = visualIndex.get(`${p.vcol + dc},${p.vrow + dr}`);
      if (j !== undefined && plotViews[j]?.unlocked) return true;
    }
    return false;
  }

  /**
   * (v3) Étape d'un pommier : query.plot(i).tree du cœur si présent, sinon calculée depuis l'état
   * (growth = maturité de l'arbre, fruit = jours de fruits).
   */
  function treeInfo(pv, p) {
    if (pv && pv.tree) return pv.tree;
    const crop = getCrop('apple') || { growDays: 6, fruitDays: 3 };
    const growth = p ? p.growth || 0 : (pv?.progress || 0) * crop.growDays;
    const fruit = p ? p.fruit || 0 : 0;
    const stage = growth >= crop.growDays - 1e-6 ? 'adult' : growth >= crop.growDays / 2 - 1e-6 ? 'young' : 'sapling';
    const fruitDays = crop.fruitDays || 3;
    const fruitReady = stage === 'adult' && fruit >= fruitDays - 1e-6;
    return { stage, growth, fruit, fruitDays, fruitReady, fruitStage: stage === 'adult' ? Math.min(3, Math.floor((fruit / fruitDays) * 3 + 1e-6)) : 0 };
  }

  /** (v3) Sprite d'un pommier selon son étape, la saison et ses fruits. */
  function appleTreeSprite(info, season) {
    if (info.stage === 'sapling') return 'tree.apple.sapling';
    if (info.stage === 'young') return 'tree.apple.young';
    return treeSprite(3, season, (info.fruitStage || 0) >= 2 || !!info.fruitReady);
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
    // Parcelles à acheter : herbe un peu plus sombre et pointillés clairs ; en portrait, une pièce
    // (« à vendre », qui se balance doucement) sur celles qui touchent le potager ouvert — on voit
    // où le champ peut s'agrandir sans encombrer la vue. Toutes restent achetables d'un toucher.
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      if (!pv || pv.unlocked) continue;
      const r = L.plots[i];
      const n = r.w;
      c.fillStyle = 'rgba(47,74,51,0.16)';
      c.fillRect(r.x + k, r.y + k, n - 2 * k, n - 2 * k);
      c.fillStyle = k > 1 ? 'rgba(255,241,210,0.55)' : 'rgba(63,38,49,0.28)';
      const step = 3 * k;
      for (let d = 2 * k; d < n - 2 * k; d += step) {
        c.fillRect(r.x + d, r.y + 2 * k, k, k);
        c.fillRect(r.x + d, r.y + n - 3 * k, k, k);
        c.fillRect(r.x + 2 * k, r.y + d, k, k);
        c.fillRect(r.x + n - 3 * k, r.y + d, k, k);
      }
      if (k > 1 && pv.unlockCost !== null && pv.unlockCost !== undefined && touchesOpen(i)) {
        const bob = Math.sin(time * 1.6 + i * 0.8) > 0.6 ? -1 : 0;
        // La pièce du pack occupe le centre ~8 × 10 de sa tuile de 16 px.
        drawSprite(c, sheetsEnv, 'coin', r.x + (n - TILE) / 2, r.y + (n - TILE) / 2 + bob);
      }
    }
    // Cultures
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      if (!pv || !pv.cropId) continue;
      const r = L.plots[i];
      if (pv.cropId === 'apple' || pv.kind === 'tree') {
        drawTree(c, i, pv, r, k, sc, season, sheetsEnv);
        continue;
      }
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

  // ── (v3) Ateliers ────────────────────────────────────────────────────────────────
  const EMPTY_PROC = { on: true, places: [] };
  /** État d'un atelier : state.processing[id] (contrat v3), sinon vide. */
  function procOf(id) {
    const st = lastGame?.state?.processing?.[id];
    if (!st) return EMPTY_PROC;
    return { on: st.on !== false, places: Array.isArray(st.places) ? st.places : [] };
  }
  function working(id) {
    const p = procOf(id);
    return p.on && p.places.some(Boolean);
  }

  // Petites images générées une fois : panneau gris (atelier éteint), bulle (atelier au travail).
  let grayPanel = null;
  let bubble = null;
  function extraImages() {
    if (grayPanel) return;
    grayPanel = makeCanvas(16, 16);
    const g = grayPanel.getContext('2d');
    drawSprite(g, images, 'sign', 0, 0);
    const d = g.getImageData(0, 0, 16, 16);
    for (let i = 0; i < d.data.length; i += 4) {
      if (!d.data[i + 3]) continue;
      const r = d.data[i]; const gg = d.data[i + 1]; const b = d.data[i + 2];
      if (r === 63 && gg === 38 && b === 49) continue; // contour
      const l = Math.round(0.3 * r + 0.55 * gg + 0.15 * b);
      const v = Math.round(90 + l * 0.55);
      d.data[i] = v - 4; d.data[i + 1] = v - 2; d.data[i + 2] = v + 8;
    }
    g.putImageData(d, 0, 0);
    // Bulle 18 × 20 (queue en bas au centre), bord sombre, fond crème.
    bubble = makeCanvas(18, 20);
    const bc = bubble.getContext('2d');
    bc.fillStyle = OUTLINE;
    bc.fillRect(2, 0, 14, 1); bc.fillRect(2, 17, 14, 1); bc.fillRect(0, 2, 1, 14); bc.fillRect(17, 2, 1, 14);
    bc.fillRect(1, 1, 1, 1); bc.fillRect(16, 1, 1, 1); bc.fillRect(1, 16, 1, 1); bc.fillRect(16, 16, 1, 1);
    bc.fillStyle = '#fff8ea';
    bc.fillRect(2, 1, 14, 16); bc.fillRect(1, 2, 16, 14);
    bc.fillStyle = '#e8dcc6';
    bc.fillRect(2, 15, 14, 1);
    // queue
    bc.fillStyle = OUTLINE;
    bc.fillRect(7, 18, 4, 1); bc.fillRect(8, 19, 2, 1);
    bc.fillStyle = '#fff8ea';
    bc.fillRect(8, 17, 2, 1); bc.fillRect(8, 18, 2, 1);
  }

  // Accessoires ajoutés par les niveaux 2 et 3 d'un atelier : [niveau, sprite, côté ('l' | 'r')].
  const UPGRADE_PROPS = {
    jamWorkshop: [[2, 'crate.strawberry', 'r'], [3, 'barrel', 'l']],
    dairy: [[2, 'bucket.milk', 'r'], [3, 'milk.bottle', 'l']],
    mill: [[2, 'sack.wheat', 'l']],
  };

  function pushWorkshop(id, owned, objSet) {
    const s0 = layout.slots[id];
    const lvl = Math.min(3, owned[id] || 0);
    if (!s0 || lvl <= 0) return;
    const b = s0.building;
    const bottom = (b.y + b.h) * TILE;
    if (id === 'mill') {
      const e = pushBuilding('building.windmill.body', b.x, b.y, b.w, b.h, objSet, 'mill.main');
      const frame = Math.floor(millPhase) % WINDMILL_FRAMES;
      pushSprite(`building.windmill.sails.${frame}`, e.x, e.y, e.sortY + 0.01, objSet, e.scale !== 1 ? { scale: e.scale } : undefined);
      if (lvl >= 3 && s0.bakery) {
        const k = s0.bakery;
        pushBuilding('building.bakery', k.x, k.y, k.w, k.h, objSet, 'mill.2');
      }
    } else {
      pushBuilding(id === 'dairy' ? 'building.dairy' : 'building.jamworkshop', b.x, b.y, b.w, b.h, objSet, `${id}.main`);
    }
    for (const [need, name, side] of UPGRADE_PROPS[id] || []) {
      if (lvl < need || (id === 'mill' && lvl >= 3 && s0.bakery)) continue;
      const tx = side === 'l' ? b.x - 1 : b.x + b.w;
      const e = pushBuilding(name, tx, b.y + b.h - 1, 1, 1, objSet, `${id}.${need - 1}`);
      e.x += side === 'l' ? 4 : -4;
      e.y += 1;
    }
    // Places occupées : un produit posé devant le bâtiment par place (le lait n'a pas d'icône avant).
    if (pops.has(`${id}.main`)) return;
    const pr = procOf(id);
    const n = Math.max(pr.places.length, 1);
    const step = 9;
    const x0 = Math.round(b.x * TILE + (b.w * TILE - ((n - 1) * step + 16)) / 2);
    for (let j = 0; j < pr.places.length; j++) {
      const pl = pr.places[j];
      if (!pl) continue;
      const e = pushSprite(productSprite(pl.productId), x0 + j * step, bottom - 13, bottom + 0.5 + j * 0.01, images);
      void e;
    }
    if (!pr.on) {
      extraImages();
      const e = pushSprite('sign', b.x * TILE + (id === 'mill' ? 30 : b.w * TILE - 14), bottom - 15, bottom + 0.4, images);
      e.img = grayPanel;
    }
  }

  // Bulles au-dessus des ateliers qui travaillent : l'icône d'un produit en cours, par intermittence.
  function drawWorkBubbles(owned) {
    const c = vctx;
    for (let k = 0; k < PROCESSING_IDS.length; k++) {
      const id = PROCESSING_IDS[k];
      const s0 = layout.slots[id];
      if (!s0 || !(owned[id] > 0) || !working(id)) continue;
      const cyc = (time + k * 1.1) % 3.4;
      if (cyc > 2.0) continue;
      const pl = procOf(id).places.filter(Boolean);
      const item = pl[Math.floor((time + k * 1.1) / 3.4) % pl.length];
      if (!item) continue;
      extraImages();
      const b = s0.building;
      const appear = cyc < 0.18 ? cyc / 0.18 : cyc > 1.8 ? (2.0 - cyc) / 0.2 : 1;
      const bob = Math.sin(time * 3 + k) > 0.3 ? -1 : 0;
      const bx = Math.round(b.x * TILE + (b.w * TILE) / 2 - 9 + (id === 'mill' ? 14 : 0));
      const by = Math.round(b.y * TILE - 14 + bob + (1 - appear) * 3 + (id === 'mill' ? 10 : 0));
      c.globalAlpha = Math.max(0, Math.min(1, appear));
      c.drawImage(bubble, bx, by);
      drawSprite(c, images, productSprite(item.productId), bx + 1, by + 1);
      c.globalAlpha = 1;
    }
  }

  // Pommes restées sur l'arbre en hiver (le sprite d'hiver est nu) : quelques pixels rouges.
  const WINTER_APPLES = [[4, 6], [10, 5], [7, 9], [11, 9], [5, 10]];

  function drawTree(c, i, pv, r, k, sc, season, sheetsEnv) {
    const info = treeInfo(pv, lastGame?.state.plots[i]);
    const name = appleTreeSprite(info, season);
    // Les arbres prennent la neige en hiver (planche d'hiver : « chapeaux » blancs).
    const set = season === 'winter' ? sheetsEnv : images;
    let dy = 1;
    if (info.stage === 'adult' && season !== 'winter') dy += Math.sin(time * 1.1 + i * 1.3) > 0.85 ? -1 : 0;
    const x = r.x;
    const y = r.y + dy * k - (k > 1 ? 2 : 0);
    drawSprite(c, set, name, x, y, sc);
    if (season === 'winter' && info.stage === 'adult' && info.fruitReady) {
      for (const [ax, ay] of WINTER_APPLES) {
        c.fillStyle = OUTLINE;
        c.fillRect(x + (ax - 1) * k, y + ay * k, k, k);
        c.fillStyle = '#d43d3d';
        c.fillRect(x + ax * k, y + ay * k, k, k);
        c.fillStyle = '#ff8a7a';
        c.fillRect(x + ax * k, y + (ay - 1) * k, k, k);
      }
    }
    if (info.fruitReady) {
      const ph = (time * 0.55 + i * 0.37) % 1;
      if (ph < 0.18) {
        const cell = Math.floor(time * 0.55 + i * 0.37);
        const sx = x + (3 + Math.floor(tileHash(i, cell, 3) * 10)) * k;
        const sy = y + (2 + Math.floor(tileHash(i, cell, 4) * 8)) * k;
        c.fillStyle = '#ffffff';
        c.fillRect(sx, sy, k, k);
        if (ph > 0.05 && ph < 0.13) {
          c.fillStyle = '#fff3b0';
          c.fillRect(sx - k, sy, k, k); c.fillRect(sx + k, sy, k, k);
          c.fillRect(sx, sy - k, k, k); c.fillRect(sx, sy + k, k, k);
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
          const crate = cropId && (SPRITES[`crate.${cropId}`] ? `crate.${cropId}` : cropId === 'apple' ? 'perk.basket' : 'crate.empty');
          const name = cropId ? crate : k === 0 ? 'crate.empty' : k === 1 ? 'sack.empty' : null;
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

    // (v3) Ateliers
    for (const id of PROCESSING_IDS) if (A.has(id)) pushWorkshop(id, owned, objSet);

    // (v3) Décorations posées sur les emplacements (la mare est au sol, dans la couche fixe)
    for (const d of layout.decorSlots || []) {
      if (d.kind !== 'small') continue;
      const name = decorSprite(cosmetics.decor[d.id]);
      if (!name || name === 'deco.pond') continue;
      const tall = (SPRITES[name].h || 1) > 1;
      pushSprite(name, d.x, tall ? d.y - TILE : d.y, d.y + TILE - 0.5, objSet);
    }
    // (v3) Coupe du concours posée sur le panneau de la ferme
    const cres = lastGame?.state?.contest?.result;
    const met = cres && Array.isArray(cres.goalsMet) ? cres.goalsMet.length : 0;
    if (met > 0 && layout.sign && hasSlot('sign')) {
      const trophy = met >= 3 ? 'icon.trophy.gold' : met === 2 ? 'icon.trophy.silver' : 'icon.trophy.bronze';
      pushSprite(trophy, layout.sign.x * TILE + 32, layout.sign.y * TILE - 12, (layout.sign.y + 1) * TILE + 0.2, images);
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
      pushSprite(outfitSprite(cosmetics.outfit), x, y, farmer.y + 1, images, {
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
      if (e.img) {
        c.drawImage(e.img, e.x, e.y);
        continue;
      }
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
  let bakeT = 0;
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
    // (v3) Moulin : ailes lentes au repos, plus vives quand il moud ; four à pain : fumée.
    if (layout.slots.mill && owned.mill > 0) {
      const busy = working('mill');
      millPhase = (millPhase + dt / (busy ? 0.13 : 0.42)) % (WINDMILL_FRAMES * 1000);
      const k = layout.slots.mill.bakery;
      if (k && owned.mill >= 3 && busy) {
        bakeT -= dt;
        if (bakeT <= 0) {
          bakeT = rnd(0.35, 0.6);
          effects.smoke(k.x * TILE + 22, k.y * TILE + 1);
        }
      }
    }
    // Fromagerie et atelier au travail : petite vapeur par la porte, de temps en temps.
    for (const id of ['dairy', 'jamWorkshop']) {
      const s0 = layout.slots[id];
      if (!s0 || !(owned[id] > 0) || !working(id)) continue;
      if (Math.random() < dt * 0.9) {
        const b = s0.building;
        effects.smoke(b.x * TILE + (id === 'dairy' ? 10 : 36), b.y * TILE + 3);
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

  // ── (v3) Concours : fanions ; réverbères ; mode décoration ; nom de la ferme ─────────
  function contestDay(cal) {
    if (contestForce !== null) return contestForce;
    const c = layout.level?.contest;
    return !!c && cal.day === c.deadlineDay;
  }

  const BUNTING = ['#e04a4a', '#fdbe53', '#5aa0e8', '#72c85a', '#ffffff'];
  /** Guirlande de fanions entre deux points (px du monde), qui se balance doucement. */
  function drawGarland(x0, y0, x1, sag, seed) {
    const c = vctx;
    const w = x1 - x0;
    const sway = Math.sin(time * 1.4 + seed) * 1.2;
    let prevY = null;
    for (let x = 0; x <= w; x++) {
      const t = x / w;
      const y = Math.round(y0 + (sag + sway) * 4 * t * (1 - t));
      c.fillStyle = '#6b4a3a';
      c.fillRect(x0 + x, y, 1, 1);
      if (prevY !== null && Math.abs(y - prevY) > 1) c.fillRect(x0 + x, Math.min(y, prevY) + 1, 1, Math.abs(y - prevY) - 1);
      prevY = y;
      if (x % 6 === 2 && x > 1 && x < w - 2) {
        const col = BUNTING[((x / 6) | 0) % BUNTING.length];
        const flap = Math.sin(time * 3 + x * 0.5 + seed) > 0.6 ? 1 : 0;
        c.fillStyle = OUTLINE;
        c.fillRect(x0 + x - 1, y + 1, 5, 1);
        c.fillRect(x0 + x - 1, y + 2, 1, 2);
        c.fillRect(x0 + x + 3, y + 2, 1, 2);
        c.fillRect(x0 + x, y + 4, 1, 1 + flap);
        c.fillRect(x0 + x + 2, y + 4, 1, 1 + flap);
        c.fillRect(x0 + x + 1, y + 5 + flap, 1, 1);
        c.fillStyle = col;
        c.fillRect(x0 + x, y + 2, 3, 2);
        c.fillRect(x0 + x + 1, y + 4, 1, 1 + flap);
      }
    }
  }

  function drawBunting() {
    const f = layout.field.fence;
    const T = TILE;
    // Au-dessus des clôtures haute et basse du champ, et entre la maison et le chemin.
    drawGarland(f.x * T + 4, f.y * T + 3, (f.x + f.w) * T - 4, 7, 0);
    const g = layout.field.gate;
    drawGarland(f.x * T + 4, (f.y + f.h - 1) * T + 3, g.x * T - 1, 5, 1.7);
    drawGarland((g.x + 1) * T + 1, (f.y + f.h - 1) * T + 3, (f.x + f.w) * T - 4, 5, 3.1);
    // Entre la maison et la chambre d'hôte (si elle est construite), par-dessus le chemin.
    const h = layout.house;
    const gh = layout.slots.guestHouse?.house;
    if (gh && (lastGame?.state.investments.guestHouse || 0) > 0 && layout.available.has('guestHouse') && gh.x > h.x + h.w) {
      drawGarland((h.x + h.w) * T - 3, (h.y + 1) * T + 2, gh.x * T + 3, 9, 4.2);
    }
  }

  function drawLampGlow(dayProgress, weather) {
    const dark = weather === 'storm' ? 0.8 : weather === 'rain' ? 0.5 : 0;
    const k = Math.max(dark, dayProgress > 0.72 ? Math.min(1, (dayProgress - 0.72) / 0.12) : 0);
    if (k <= 0.02) return;
    const c = vctx;
    let any = false;
    for (const d of layout.decorSlots || []) {
      if (decorSprite(cosmetics.decor[d.id]) !== 'deco.lamppost') continue;
      if (!any) {
        c.save();
        c.translate(ox, oy);
        c.globalCompositeOperation = 'lighter';
        any = true;
      }
      const cx = d.x + 8;
      const cy = d.y - TILE + 5;
      const flick = 0.9 + 0.1 * Math.sin(time * 9 + d.x);
      for (const [r, a] of [[11, 0.07], [7, 0.1], [4, 0.16]]) {
        c.globalAlpha = a * k * flick;
        c.fillStyle = '#ffcf6a';
        c.beginPath();
        // Disque « en escalier » : rectangles empilés (pas d'anticrénelage).
        for (let yy = -r; yy <= r; yy++) {
          const hw = Math.floor(Math.sqrt(r * r - yy * yy));
          c.rect(cx - hw, cy + yy, hw * 2 + 1, 1);
        }
        c.fill();
      }
      c.globalAlpha = k;
      c.fillStyle = '#fff3b0';
      c.fillRect(cx - 1, cy - 1, 3, 2);
    }
    if (any) {
      c.globalAlpha = 1;
      c.restore();
    }
  }

  /** Mode décoration : le reste assombri, emplacements, panneau et fermier au premier plan. */
  function drawDecorOverlay(objSet) {
    const c = vctx;
    c.fillStyle = 'rgba(28,20,40,0.34)';
    c.fillRect(-ox, -oy, viewW, viewH);
    const pulse = 0.55 + 0.45 * Math.sin(time * 3.2);
    for (const d of layout.decorSlots || []) {
      if (d.kind === 'sign') {
        drawWideFarmSign(c, objSet, d.x, d.y);
        cornerMarks(c, d, pulse);
        continue;
      }
      const name = decorSprite(cosmetics.decor[d.id]);
      if (name) {
        const tall = (SPRITES[name].h || 1) > 1 && d.kind === 'small';
        drawSprite(c, objSet, name, d.x, tall ? d.y - TILE : d.y);
        // Objet posé : souligné d'un trait clair.
        c.globalAlpha = 0.6 + 0.4 * pulse;
        c.fillStyle = '#fff3b0';
        c.fillRect(d.x + 2, d.y + d.h - 1, d.w - 4, 1);
        c.globalAlpha = 1;
      } else {
        // Repère « + » qui respire.
        const bob = pulse > 0.8 ? -1 : 0;
        c.globalAlpha = 0.7 + 0.3 * pulse;
        drawSprite(c, images, 'deco.slot', d.x + (d.w - TILE) / 2, d.y + (d.h - TILE) / 2 + bob);
        c.globalAlpha = 1;
      }
      cornerMarks(c, d, pulse);
    }
    // Fermier (touchable : choix de la tenue), sans outil.
    const fr = farmerRect();
    drawSprite(c, images, outfitSprite(cosmetics.outfit), fr.x, fr.y, farmer.facing < 0 ? { flipX: true } : undefined);
    cornerMarks(c, fr, pulse);
  }

  function cornerMarks(c, r, pulse) {
    const arm = 3;
    const x0 = r.x - 1;
    const y0 = r.y - 1;
    const x1 = r.x + r.w;
    const y1 = r.y + r.h;
    c.globalAlpha = 0.5 + 0.5 * pulse;
    for (const [color, o] of [[OUTLINE, 1], ['#ffffff', 0]]) {
      c.fillStyle = color;
      const ax = x0 - o; const ay = y0 - o; const bx = x1 + o; const by = y1 + o;
      c.fillRect(ax, ay, arm, 1); c.fillRect(ax, ay, 1, arm);
      c.fillRect(bx - arm + 1, ay, arm, 1); c.fillRect(bx, ay, 1, arm);
      c.fillRect(ax, by, arm, 1); c.fillRect(ax, by - arm + 1, 1, arm);
      c.fillRect(bx - arm + 1, by, arm, 1); c.fillRect(bx, by - arm + 1, 1, arm);
    }
    c.globalAlpha = 1;
  }

  /**
   * Nom de la ferme sur le panneau : police « Ferme » grasse, dessinée à la résolution de l'écran
   * (net), centrée dans FARM_SIGN_TEXT_RECT, réduite pour tenir, sinon tronquée avec « … ».
   */
  const signPt = { x: 0, y: 0 };
  function drawSignText() {
    if (!layout.sign || !hasSlot('sign')) return;
    const name = String(cosmetics.farmName || DEFAULT_COSMETICS.farmName).trim() || DEFAULT_COSMETICS.farmName;
    const R = FARM_SIGN_WIDE_TEXT_RECT;
    worldToDevice(layout.sign.x * TILE + R.x, layout.sign.y * TILE + R.y, signPt);
    const w = R.w * zoom;
    const h = R.h * zoom;
    if (signPt.x > devW || signPt.y > devH || signPt.x + w < 0 || signPt.y + h < 0) return;
    const key = `${name}|${zoom}`;
    if (signText.key !== key) {
      // La plus grande taille (px entiers) qui tient ; en dessous d'un plancher lisible, « … ».
      let size = Math.max(6, Math.floor(h * 1.3));
      const minSize = Math.max(6, Math.floor(h * 0.5));
      let text = name;
      const fits = (sz, t) => {
        ctx.font = `700 ${sz}px "Ferme", "Trebuchet MS", monospace`;
        return ctx.measureText(t).width <= w;
      };
      while (size > minSize && !fits(size, text)) size--;
      if (!fits(size, text)) {
        while (text.length > 1 && !fits(size, `${text}…`)) text = text.slice(0, -1).trimEnd();
        text = `${text}…`;
      }
      signText.key = key;
      signText.size = size;
      signText.text = text;
    }
    ctx.save();
    ctx.font = `700 ${signText.size}px "Ferme", "Trebuchet MS", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = Math.round(signPt.x + w / 2);
    const cy = Math.round(signPt.y + h / 2 + zoom * 0.35);
    ctx.fillStyle = 'rgba(255,241,210,0.55)';
    ctx.fillText(signText.text, cx, cy + Math.max(1, Math.round(zoom / 3)));
    ctx.fillStyle = decorMode ? '#4a2c24' : '#5a3527';
    ctx.fillText(signText.text, cx, cy);
    ctx.restore();
  }

  // ── Image ───────────────────────────────────────────────────────────────────────
  const fxState = { season: 'spring', weather: 'sunny', dayProgress: 0.5, view: { x: 0, y: 0, w: 512, h: 320 } };
  function render(game, timeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    const dt = lastTime === null ? 0 : Math.min(0.1, Math.max(0, (timeMs - lastTime) / 1000));
    lastTime = timeMs;
    time += dt;
    stepScrollAnim(dt);
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
    let key = `${SEASON_INDEX[season] ?? 0}|${cosVersion}|`;
    for (const id of layout.available) key += (owned[id] || 0) > 0 ? '1' : '0';
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
    if (contestDay(cal)) drawBunting();
    drawWorkBubbles(owned);
    effects.drawWorld(c);
    if (decorMode) drawDecorOverlay(season === 'winter' ? sheetsEnv : images);
    drawHover(owned);
    c.setTransform(1, 0, 0, 1, 0, 0);
    effects.drawWeather(c);
    effects.drawLight(c, viewW, viewH);
    drawLampGlow(dayProgress, weather);
    effects.postProcess(c, view, scratch);

    // Canvas final
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(view, 0, 0, viewW, viewH, blitX, blitY, viewW * zoom, viewH * zoom);
    drawSignText();
    effects.drawScreen(ctx, worldToDevice, zoom, images, dpr);
  }

  function rebuildLayout(lvl) {
    layout = createLayout(lvl, { mode });
    resetTracking();
    effects.clear();
    userScrolled = false;
    flingV = 0;
    scrollAnim = null;
    scrollBeforeOverlay = null;
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
      if (type === 'treeRemoved' && payload) {
        // L'arbre s'enfonce dans la terre (sprite d'avant l'arrachage).
        const r = layout.plotRect(payload.plotIndex);
        const pv = plotViews[payload.plotIndex];
        if (r) {
          const season = lastGame ? lastGame.query.calendar().seasonId : 'summer';
          const i = payload.plotIndex;
          const info = treeInfo(pv, { growth: prevGrowth[i], fruit: prevFruit[i] });
          const name = pv ? appleTreeSprite(info, season) : 'tree.apple.young';
          effects.sinkTree(r, name, season === 'winter' ? seasonSheets.winter : images, layout.plotScale || 1);
        }
      }
      effects.onEvent(type, payload, layout);
    },
    setLevel,
    setCosmetics(c = {}) {
      if (!c || typeof c !== 'object') return;
      for (const k of ['farmName', 'outfit', 'path', 'fence']) if (c[k] !== undefined && c[k] !== null) cosmetics[k] = c[k];
      const decor = c.decor || c.slots;
      if (decor && typeof decor === 'object') cosmetics.decor = { ...decor };
      cosVersion++;
      signText.key = '';
    },
    get cosmetics() {
      return { ...cosmetics, decor: { ...cosmetics.decor } };
    },
    setDecorMode(on) {
      const was = decorMode;
      decorMode = !!on;
      if (decorMode) hover = null;
      // Entrée en mode décoration : la vue se pose sur la cour (portail → panneau), où se trouvent
      // la plupart des emplacements. À la sortie, retour au champ.
      if (decorMode && !was) focusDecorArea(true);
      else if (!decorMode && was) {
        userScrolled = false;
        animateScrollDev(centerOnDev(layout.fieldRect));
      }
    },
    focusDecorSlot,
    focusDecorArea,
    focusRect,
    get decorMode() {
      return decorMode;
    },
    decorSlotRect(id) {
      const d = (layout.decorSlots || []).find((s0) => s0.id === id);
      return d ? { x: d.x, y: d.y, w: d.w, h: d.h } : null;
    },
    setContestDay(on) {
      contestForce = on === null || on === undefined ? null : !!on;
    },
    setInsets,
    scrollBy,
    setScroll,
    scrollTo,
    setOverlay,
    getScroll() {
      return scrollDev / dpr;
    },
    maxScroll() {
      return maxScrollDev / dpr;
    },
    fling,
    get overlay() {
      return overlayDev / dpr;
    },
    get scrolling() {
      return !!scrollAnim || flingV !== 0;
    },
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
