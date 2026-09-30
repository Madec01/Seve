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
// Mode Carrière (game.state.mode === 'career', détecté à chaque image) : disposition en colonne
// (layout-career.js) qui grandit vers le haut, reconstruite quand les terrains, les bâtiments ou les
// machines changent (le défilement reste sur ce qu'on regardait) ; acteurs (career-actors.js).
//   scene.focusLot(lotId, opts?)        fait défiler (animé si opts.animate) pour montrer le terrain ;
//                                       opts { animate, align: 'center' | 'fit' } → défilement visé (px CSS)
//   scene.focusHouse(opts?)             montre la maison (bande du bas)
//   scene.focusBuilding(id, opts?)      montre un bâtiment (maison, grenier, abri, atelier, serre…)
//   scene.lotRect(lotId)                rectangle (px du monde) d'un terrain, ou null
//   scene.lotScreenRect(lotId)          rectangle à l'écran (px CSS) d'un terrain, ou null
//   scene.setCareer(on)                 force la reconstruction de la disposition (sinon automatique)
//   scene.hitTest(x, y, opts?)          + { type: 'lotSign', lotId, slot? } | { type: 'lotForSale', lotId }
//                                       | { type: 'shelter', buildingId } | { type: 'building', buildingId }
//                                       | { type: 'machine', key } | { type: 'employee', staffId }
//                                       | { type: 'pond', buildingId, lotId } | { type: 'crow', plotIndex }
//                                       | { type: 'joseph' } | { type: 'visitor', offerId, kind }
//                                       | { type: 'investment', id: 'beehive' | 'solarPanel' }
//   scene.careerStats()                 acteurs dessinés, taille des tampons (mesures)
//   Tampons : en carrière la vue ne couvre que l'écran ; la couche fixe couvre tout le monde et on en
//   recopie la tranche visible à chaque image (monde très haut, 60 i/s au téléphone).
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
  FARM_SIGN_WIDE_TEXT_RECT, WINDMILL_FRAMES, drawWideFarmSign, playerSprite, BUBBLE_CONTENT,
} from './atlas.js';
import { createCareerLayout, careerLayoutKey, WORKSHOP_IDS } from './layout-career.js';
import { createCareerActors } from './career-actors.js';
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
const CAREER_VISIBLE_ROWS = 22;
const FAIR_LANTERNS_X = [1.5, 9.5]; // lampions des fêtes (tuiles, au-dessus de la route) // ordinateur : tuiles visibles en hauteur (zoom par la hauteur)
const PRODUCT_OF_ANIMAL = { hen: 'product.eggs', rabbit: 'product.angora', duck: 'product.duckEgg', cow: 'product.milk', goat: 'product.milk', pig: 'product.truffle', sheep: 'product.angora', horse: 'product.ride' };

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

  // ── Mode Carrière ────────────────────────────────────────────────────────────────
  let careerMode = false;
  let careerKey = '';
  let windowed = false; // vue limitée à l'écran, couche fixe sur tout le monde (carrière)
  let sBufY0 = 0; // haut de la couche fixe (px du monde) en mode fenêtré
  let staticH = 1;
  const actors = createCareerActors();
  const careerInfo = { t: -1, nextLot: null, full: {}, today: null, active: null, contest: false };
  const prevLevels = {}; // niveaux des bâtiments (apparition « pop » à la construction / amélioration)
  const deferred = []; // événements de carrière, traités après la reconstruction de la disposition
  let clearing = null; // défrichage d'un terrain acheté : { lotId, t0 }
  let forceRebuild = false;

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
    if (entryCount >= entries.length) entries.push({ sortY: 0, name: '', x: 0, y: 0, flipX: false, scale: 1, set: null, alpha: 1, tool: null, toolFlip: false, img: null, overlay: null, icon: null });
    const e = entries[entryCount++];
    e.img = null;
    e.flipX = false;
    e.scale = 1;
    e.alpha = 1;
    e.tool = null;
    e.overlay = null;
    e.icon = null;
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
      // (Carrière) une seule disposition en colonne : seul le zoom change.
      if (!careerMode) rebuildLayout(layout.level);
    }
    computeCamera();
  }

  /** (Carrière) Ordonnée du monde (px) au centre de la bande visible. */
  function worldCenterY() {
    const cur = scrollAnim ? scrollAnim.to : scrollDev;
    return (cur + band.y + band.h / 2 - baseY) / zoom;
  }

  /**
   * Zoom, position du monde, taille des tampons ; garde (ou recentre) le défilement.
   * @param keepWorldY  (carrière) ordonnée du monde à garder au centre de la bande (défaut : l'actuelle)
   */
  function computeCamera(keepWorldY) {
    const prevMax = maxScrollDev;
    const keepY = careerMode && userScrolled ? (keepWorldY ?? (initialized ? worldCenterY() : null)) : null;
    band.x = Math.round(insets.left * dpr);
    band.y = Math.round(insets.top * dpr);
    band.w = Math.max(1, devW - band.x - Math.round(insets.right * dpr));
    band.h = Math.max(1, devH - band.y - Math.round(insets.bottom * dpr));
    const ess = layout.essential;
    if (careerMode && mode !== 'portrait') {
      // Ordinateur : la même colonne, centrée, zoom par la hauteur (≈ 22 tuiles visibles).
      const byWidth = Math.floor(band.w / ess.w);
      const byHeight = Math.max(minZoom, Math.floor(band.h / (CAREER_VISIBLE_ROWS * TILE)));
      zoom = Math.max(1, Math.min(byWidth, byHeight));
    } else if (mode === 'portrait') {
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
    let h = Math.ceil((devH * 2 + maxScrollDev) / zoom) + 3;
    // (Carrière) Fenêtré : la vue ne couvre que l'écran ; la couche fixe garde toute la hauteur.
    const sh = h;
    if (windowed) {
      sBufY0 = bufY0;
      h = Math.ceil(devH / zoom) + 3;
    }
    ox = -bufX0;
    oy = -bufY0;
    const wantStaticH = windowed ? sh : h;
    if (w !== viewW || h !== viewH || view.width !== w || view.height !== h || staticLayer.height !== wantStaticH) {
      viewW = w;
      viewH = h;
      staticH = wantStaticH;
      view.width = viewW;
      view.height = viewH;
      staticLayer.width = viewW;
      staticLayer.height = staticH;
      scratch.width = viewW;
      scratch.height = viewH;
      vctx = noSmooth(view.getContext('2d'));
      sctx = noSmooth(staticLayer.getContext('2d'));
    }
    staticKey = -1;
    if (!userScrolled) focusFieldDev();
    else if (keepY !== null && keepY !== undefined) setScrollDev(baseY + keepY * zoom - (band.y + band.h / 2));
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
    if (windowed) {
      // La vue suit le défilement : son haut est la première ligne de pixels du monde visible.
      bufY0 = Math.max(sBufY0, Math.floor((scrollDev - baseY) / zoom) - 1);
      oy = -bufY0;
    }
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
    if (careerMode) return hitTestCareer(w.x, w.y, hitOpts);
    const owned = lastGame ? lastGame.state.investments : undefined;
    if (hitOpts && hitOpts.touch) return layout.hitTestNear(w.x, w.y, owned, (TOUCH_SLOP_CSS * dpr) / zoom);
    return layout.hitTest(w.x, w.y, owned);
  }

  /**
   * (Carrière) Personnages (corbeau, Joseph, visiteurs, employés), bulles de ramassage, puis la
   * disposition (parcelles, bâtiments, abris, machines garées, panneaux, terrain à vendre…).
   */
  function hitTestCareer(wx, wy, hitOpts) {
    const touch = !!(hitOpts && hitOpts.touch);
    const slop = touch ? (TOUCH_SLOP_CSS * dpr) / zoom : 0;
    const a = actors.hitTest(wx, wy, slop);
    if (a) return a;
    const bs = lastGame?.state?.career?.buildings || {};
    for (const [id, s0] of Object.entries(layout.slots)) {
      if (!s0.animal || !(bs[id]?.pending > 0)) continue;
      const bx = s0.bubble ? s0.bubble.x : s0.anchor.x - 16;
      const by = s0.bubble ? s0.bubble.y : s0.anchor.y - 30;
      if (wx >= bx - slop && wx < bx + 32 + slop && wy >= by - slop && wy < by + 32 + slop) return { type: 'shelter', buildingId: id };
    }
    return layout.hitTestCareer(wx, wy, lastGame?.state || null, slop);
  }

  /** (Carrière) Défile pour centrer un rectangle (px du monde) dans la partie visible (au-dessus de la feuille). */
  function centerRect(r, opts = {}) {
    if (!r) return scrollDev / dpr;
    flingV = 0;
    userScrolled = true;
    scrollBeforeOverlay = null;
    const visH = band.h - overlayDev;
    let target;
    if (opts.align === 'fit' || r.h * zoom > visH) {
      // Trop haut pour tenir : on montre le bas (allée, panneau), là où l'on entre dans le terrain.
      target = r.h * zoom > visH ? baseY + (r.y + r.h) * zoom - (band.y + visH) + 8 * dpr : baseY + (r.y + r.h / 2) * zoom - (band.y + visH / 2);
    } else target = baseY + (r.y + r.h / 2) * zoom - (band.y + visH / 2);
    if (opts.animate) animateScrollDev(target);
    else {
      scrollAnim = null;
      setScrollDev(target);
    }
    return (scrollAnim ? scrollAnim.to : scrollDev) / dpr;
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

  // ── (Carrière) Couche fixe : toute la hauteur du monde ────────────────────────────
  const COBBLE_PARTS = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
  /** Rectangle en autotuile 3 × 3 (pavés, eau) : bords et coins de la planche, centre varié. */
  function drawAutoRect(c, sheets, prefix, r, center2, salt) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const row = y === r.y ? 0 : y === r.y + r.h - 1 ? 2 : 1;
        const col = x === r.x ? 0 : x === r.x + r.w - 1 ? 2 : 1;
        let name = `${prefix}.${COBBLE_PARTS[row * 3 + col]}`;
        if (row === 1 && col === 1 && center2 && tileHash(x, y, salt) < 0.28) name = center2;
        drawSprite(c, sheets, name, x * TILE, y * TILE);
      }
    }
  }

  /** Pointillés clairs autour d'un emplacement libre (on peut y construire). */
  function dottedRect(c, r, color) {
    c.fillStyle = color;
    const x0 = r.x * TILE + 2;
    const y0 = r.y * TILE + 2;
    const x1 = (r.x + r.w) * TILE - 3;
    const y1 = (r.y + r.h) * TILE - 3;
    for (let x = x0; x <= x1; x += 4) { c.fillRect(x, y0, 2, 1); c.fillRect(x, y1, 2, 1); }
    for (let y = y0; y <= y1; y += 4) { c.fillRect(x0, y, 1, 2); c.fillRect(x1, y, 1, 2); }
  }

  function buildStaticCareer(season, st) {
    const sheets = seasonSheets[season];
    const L = layout;
    const c = sctx;
    const SOX = ox;
    const SOY = -sBufY0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, viewW, staticH);
    c.translate(SOX, SOY);
    const tx0 = Math.floor(-SOX / TILE) - 1;
    const ty0 = Math.floor(-SOY / TILE) - 1;
    const tx1 = Math.ceil((viewW - SOX) / TILE) + 1;
    const ty1 = Math.min(Math.ceil((staticH - SOY) / TILE) + 1, L.rows + 40);
    const fr = flowerRate(season);
    const orchardSet = new Set();
    for (const o of L.orchards) for (let y = o.rect.y; y < o.rect.y + o.rect.h; y++) for (let x = o.rect.x; x < o.rect.x + o.rect.w; x++) orchardSet.add(y * 64 + x);

    // 1. Herbe (fleurs plus nombreuses au verger au printemps)
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const h = tileHash(tx, ty, 11);
        const rate = orchardSet.has(ty * 64 + tx) ? fr * 3 : fr;
        const name = h < 0.14 ? 'ground.grass.tufts' : h > 1 - rate ? 'ground.grass.flowers' : 'ground.grass';
        drawSprite(c, sheets, name, tx * TILE, ty * TILE);
      }
    }
    // 2. Pavés des cours des ateliers, eau des mares, sol de la serre
    for (const r of L.cobbles) drawAutoRect(c, sheets, 'ground.cobble', r, 'ground.cobble.c.2', 13);
    for (const p of L.ponds) drawAutoRect(c, sheets, 'water', p.water, 'water.c.1', 17);
    for (const g of L.greenhouses) {
      for (let y = g.y + 2; y < g.y + 6; y++) for (let x = g.x + 1; x < g.x + g.w - 1; x++) drawSprite(c, sheets, 'path.c', x * TILE, y * TILE);
    }
    // 3. Chemins, allées, route
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!L.isPath(tx, ty)) continue;
        if (cosmetics.path === 'path.stone') drawStonePathTile(c, sheets, tx, ty, tx * TILE, ty * TILE);
        else drawPathTile(c, sheets, tx, ty, tx * TILE, ty * TILE);
      }
    }
    // 4. Friches : herbes hautes, fleurs sauvages, souches, ronces
    const wildFlowers = season === 'spring' || season === 'summer';
    for (const w of L.wilds) {
      for (let y = w.rect.y; y < w.rect.y + w.rect.h; y++) {
        for (let x = w.rect.x; x < w.rect.x + w.rect.w; x++) {
          const h = tileHash(x, y, 29 + w.seed);
          let name = null;
          if (h < 0.3) name = `land.tallgrass.${1 + Math.floor(h * 10) % 3}`;
          else if (h < 0.37) name = wildFlowers ? `land.wildflower.${h < 0.335 ? 1 : 2}` : 'land.tallgrass.2';
          else if (h < 0.4) name = 'land.stump';
          else if (h < 0.42) name = season === 'winter' ? 'land.tallgrass.1' : 'land.bramble';
          else if (h < 0.45) name = 'land.cleared.patch';
          if (name && SPRITES[name]) drawSprite(c, sheets, name, x * TILE + Math.floor(tileHash(x, y, 3) * 5) - 2, y * TILE + Math.floor(tileHash(x, y, 4) * 3) - 1);
        }
      }
    }
    // 5. Forêt (bords, haut, terrain à vendre, bas) et lisières
    const fset = season === 'autumn' ? 'forest.autumn' : 'forest.green';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!L.isForest(tx, ty)) continue;
        const up = L.isForest(tx, ty - 1);
        const down = L.isForest(tx, ty + 1);
        const part = !down ? 'bottom' : !up ? 'top' : 'fill';
        drawSprite(c, sheets, `${fset}.${part}`, tx * TILE, ty * TILE);
      }
    }
    const edgeGreen = season === 'winter' ? 'tree.pine' : season === 'autumn' ? 'tree.autumn' : 'tree.green';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!L.isForest(tx, ty)) continue;
        const openRight = !L.isForest(tx + 1, ty) && !L.isPath(tx + 1, ty);
        const openLeft = !L.isForest(tx - 1, ty) && !L.isPath(tx - 1, ty);
        if (!openRight && !openLeft) continue;
        const h = tileHash(tx, ty, 23);
        const name = h < 0.3 ? 'tree.pine' : edgeGreen;
        const dx = (openRight ? 6 : -6) + Math.floor(h * 5) - 2;
        drawSprite(c, sheets, name, tx * TILE + dx, ty * TILE - 3 + (ty % 2) * 2);
      }
    }
    // Terrain à vendre : forêt assombrie, souches et grand panneau dans la lisière.
    const sale = L.saleBand;
    if (sale) {
      const y0 = sale.y0 * TILE;
      const hh = (sale.rows - 1) * TILE;
      c.fillStyle = 'rgba(18,30,26,0.30)';
      c.fillRect(-SOX, y0, viewW, hh);
      c.fillStyle = 'rgba(18,30,26,0.16)';
      c.fillRect(-SOX, y0 + hh - 6, viewW, 6);
      for (const [x, dy] of [[3, 0], [10, 0], [4, -1]]) drawSprite(c, sheets, 'land.stump', x * TILE + 2, (sale.y0 + sale.rows - 1) * TILE + dy * 4);
      drawSprite(c, sheets, 'land.sale.sign.big', 6 * TILE, (sale.y0 + sale.rows - 2) * TILE + 2);
    }
    // 6. Clôtures (champs : style de la personnalisation ; enclos et verger : bois)
    for (const f of L.fences) {
      if (f.kind === 'field') drawFieldFence(c, sheets, f.rect, f.gateX);
      else drawFence(c, sheets, f.rect, f.gateX);
    }
    // 7. Serre : toit vitré opaque au fond, montants, façade basse avec la porte
    for (const g of L.greenhouses) {
      const x1 = g.x + g.w - 1;
      for (let x = g.x; x <= x1; x++) drawSprite(c, sheets, 'glass.roof.top', x * TILE, g.y * TILE);
      for (let x = g.x; x <= x1; x++) drawSprite(c, sheets, x === g.x ? 'glass.roof.l' : x === x1 ? 'glass.roof.r' : 'glass.roof.c', x * TILE, (g.y + 1) * TILE);
      for (let y = g.y + 2; y < g.y + 6; y++) {
        drawSprite(c, sheets, 'glass.roof.l', g.x * TILE, y * TILE);
        drawSprite(c, sheets, 'glass.roof.r', x1 * TILE, y * TILE);
      }
      const doorX = g.x + Math.floor(g.w / 2);
      for (let x = g.x; x <= x1; x++) drawSprite(c, sheets, x === g.x ? 'glass.wall.l' : x === x1 ? 'glass.wall.r' : x === doorX ? 'glass.door' : 'glass.wall.c', x * TILE, (g.y + 6) * TILE);
    }
    // 8. Mares : roseaux et nénuphars, ponton
    for (const p of L.ponds) {
      const w = p.water;
      drawSprite(c, sheets, 'water.reeds', w.x * TILE, (w.y + w.h - 2) * TILE);
      drawSprite(c, sheets, 'water.reeds', (w.x + w.w - 1) * TILE, w.y * TILE + 4);
      drawSprite(c, sheets, 'water.lily', (w.x + 2) * TILE + 3, (w.y + 1) * TILE + 2);
      drawSprite(c, sheets, 'water.lily', (w.x + 5) * TILE, (w.y + 2) * TILE + 5);
      drawSprite(c, sheets, 'pond.dock', p.dock.x * TILE, p.dock.y * TILE + 4);
    }
    // 9. Décor fixe (du haut vers le bas)
    drawList.length = 0;
    for (const d of L.deco) drawList.push(d);
    drawList.sort((a, b) => a.y - b.y);
    for (const d of drawList) {
      const name = decoSprite(d.kind, season, tileHash(d.tx, d.ty, 7));
      if (!name) continue;
      drawSprite(c, sheets, name, d.x, name.endsWith('.tall') ? d.y - TILE : d.y);
    }
    drawList.length = 0;
    // 10. Accessoires : puits, tonneau, panneau de la ferme, panneaux des terrains, enclos
    for (const p of L.props) drawSprite(c, sheets, p.name, p.x * TILE + (p.dx || 0), p.y * TILE + (p.dy || 0));
    drawSprite(c, sheets, 'well', L.well.x * TILE, L.well.y * TILE);
    if (L.sign && hasSlot('sign')) drawWideFarmSign(c, sheets, L.sign.x * TILE, L.sign.y * TILE);
    for (const s0 of L.lotSigns) drawSprite(c, sheets, 'land.sign', s0.x * TILE, s0.y * TILE - 2);
    for (const s0 of Object.values(L.slots)) for (const p of s0.props || []) drawSprite(c, sheets, p.name, p.x, p.y);
    // Jardin de la chambre d'hôte
    for (const s0 of Object.values(L.slots)) {
      for (const d of s0.gardenDeco || []) {
        if (d.kind === 'flowers') drawSprite(c, sheets, season === 'winter' ? 'ground.grass.tufts' : 'ground.grass.flowers', d.x * TILE, d.y * TILE);
        else if (d.kind === 'bush') drawSprite(c, sheets, season === 'winter' ? 'bush' : 'bush.berry', d.x * TILE, d.y * TILE);
        else if (d.kind === 'bench' && SPRITES['decor.bench']) drawSprite(c, sheets, 'decor.bench', d.x * TILE, d.y * TILE);
      }
    }
    // Emplacements libres (pré, basse-cour, cour des ateliers) et bâtiments pas encore construits.
    const dots = season === 'winter' ? 'rgba(90,110,140,0.55)' : 'rgba(255,241,210,0.6)';
    for (const e of L.emptySlots) {
      dottedRect(c, e.rect, dots);
      drawSprite(c, sheets, 'sign', e.sign.x * TILE, e.sign.y * TILE);
    }
    const H = L.home;
    if (!(H.storage.level > 0)) {
      dottedRect(c, { x: H.storage.x, y: H.storage.y + 1, w: H.storage.w, h: H.storage.h - 1 }, dots);
      drawSprite(c, sheets, 'sign', (H.storage.x + (H.storage.w >> 1)) * TILE - 8, (H.storage.y + H.storage.h - 1) * TILE);
    }
    if (!(H.stand.level > 0)) drawSprite(c, sheets, 'sign', H.stand.cart.x * TILE, H.stand.cart.y * TILE);
    void st;
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
    if (careerMode) {
      const b = layout.bandAt(y);
      return !!b && b.type !== 'home' && !b.forSale;
    }
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
    if (careerMode) {
      // Carrière : par les allées et l'épine (layout.route), le dernier point porte l'outil.
      const pts = layout.route({ x: farmer.x, y: farmer.y }, target);
      pts[pts.length - 1] = target;
      for (const p of pts) farmer.path.push(p);
      farmer.idle = 0;
      return;
    }
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
    if (careerMode) {
      farmer.path.length = 0;
      for (const p of layout.route({ x: farmer.x, y: farmer.y }, layout.farmerHome)) farmer.path.push(p);
      return;
    }
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
    const step = FARMER_SPEED * (farmer.path.length > 2 ? (careerMode ? 3 : 1.7) : 1) * dt;
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
      if (opts.overlay) e.overlay = opts.overlay; // (carrière) outil tenu, dessiné à la même position
      if (opts.icon) e.icon = opts.icon; // (carrière) icône dans une bulle ('@bubble')
      if (opts.alpha !== undefined) e.alpha = opts.alpha;
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
  function appleTreeSprite(info, season, cropId = 'apple') {
    if (cropId !== 'apple' && SPRITES[`tree.${cropId}.sapling`]) {
      // (Carrière, phase B) cerisier, poirier : mêmes étapes et saisons que le pommier.
      if (info.stage === 'sapling') return `tree.${cropId}.sapling`;
      if (info.stage === 'young') return `tree.${cropId}.young`;
      const ripe = (info.fruitStage || 0) >= 2 || !!info.fruitReady;
      if (season === 'winter') return `tree.${cropId}.winter`;
      if (season === 'spring') return `tree.${cropId}.spring`;
      const name = `tree.${cropId}.${season}${ripe ? '.ripe' : ''}`;
      return SPRITES[name] ? name : `tree.${cropId}.summer`;
    }
    if (info.stage === 'sapling') return 'tree.apple.sapling';
    if (info.stage === 'young') return 'tree.apple.young';
    return treeSprite(3, season, (info.fruitStage || 0) >= 2 || !!info.fruitReady);
  }

  function drawPlots(sheetsEnv, raining, season) {
    const L = layout;
    const k = L.plotScale || 1; // ×2 en portrait : terre et cultures dessinées en grand
    const c = vctx;
    const sc = k === 1 ? undefined : { scale: k };
    // (Carrière) Monde très haut : seules les parcelles proches de la vue ; parcelles retirées ignorées.
    const cy0 = windowed ? -oy - 40 : -Infinity;
    const cy1 = windowed ? -oy + viewH + 8 : Infinity;
    const skip = (r) => r.retired || r.y > cy1 || r.y + r.h < cy0;
    for (let i = 0; i < L.plots.length; i++) {
      const pv = plotViews[i];
      const r = L.plots[i];
      if (!pv) continue;
      if (!pv.unlocked) continue;
      if (windowed && skip(r)) continue;
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
      if (windowed && skip(r)) continue;
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
      if (windowed && skip(r)) continue;
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
      const sprite = s0.kind === 'workshop' && s0.sprite ? s0.sprite : id === 'dairy' ? 'building.dairy' : 'building.jamworkshop';
      pushBuilding(sprite, b.x, b.y, b.w, b.h, objSet, `${id}.main`);
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
      const e = pushSprite(anyProductSprite(pl.productId), x0 + j * step, bottom - 13, bottom + 0.5 + j * 0.01, images);
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
    const ids = careerMode ? WORKSHOP_IDS : PROCESSING_IDS;
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k];
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
      drawSprite(c, images, anyProductSprite(item.productId), bx + 1, by + 1);
      c.globalAlpha = 1;
    }
  }

  // Pommes restées sur l'arbre en hiver (le sprite d'hiver est nu) : quelques pixels rouges.
  const WINTER_APPLES = [[4, 6], [10, 5], [7, 9], [11, 9], [5, 10]];

  function drawTree(c, i, pv, r, k, sc, season, sheetsEnv) {
    const info = treeInfo(pv, lastGame?.state.plots[i]);
    const name = appleTreeSprite(info, season, pv.cropId);
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

  /** Sprite d'un produit : table des niveaux, sinon « product.<id> » de la carrière, sinon repli. */
  function anyProductSprite(id) {
    const n = productSprite(id);
    if (n !== 'crate.empty') return n;
    return SPRITES[`product.${id}`] ? `product.${id}` : n;
  }

  // ── (Carrière) Objets dynamiques : bâtiments à niveaux, machines, acteurs, fermier ──────
  const viewRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  function collectCareer(owned, season, sheetsEnv) {
    entryCount = 0;
    const L = layout;
    const H = L.home;
    const objSet = season === 'winter' ? sheetsEnv : images;
    const st = lastGame.state;
    const car = st.career || {};
    viewRect.x0 = -ox;
    viewRect.y0 = -oy - 8;
    viewRect.x1 = -ox + viewW;
    viewRect.y1 = -oy + viewH + 40;

    // Maison, grenier / silo, étal
    pushBuilding(H.house.sprite, H.house.x, H.house.y, H.house.w, H.house.h, objSet, 'b.house');
    if (H.storage.sprite) pushBuilding(H.storage.sprite, H.storage.x, H.storage.y, H.storage.w, H.storage.h, objSet, 'b.storage');
    if (H.stand.level >= 2 && H.stand.sprite) {
      pushBuilding(H.stand.sprite, H.stand.x, H.stand.y, H.stand.w, H.stand.h, objSet, 'b.roadsideStand');
    } else if (H.stand.level === 1) {
      const sd = H.stand;
      pushBuilding('stall.cart', sd.cart.x, sd.cart.y, 1, 1, objSet, 'b.roadsideStand');
      for (let k = 0; k < sd.crates.length; k++) {
        const t = sd.crates[k];
        const cropId = recentCrops[k];
        const crate = cropId && (SPRITES[`crate.${cropId}`] ? `crate.${cropId}` : cropId === 'apple' ? 'perk.basket' : 'crate.empty');
        const name = cropId ? crate : k === 0 ? 'crate.empty' : k === 1 ? 'sack.empty' : null;
        if (name) pushSprite(name, t.x * TILE, t.y * TILE + 1, (t.y + 1) * TILE, images);
      }
    }
    // Panneaux solaires, ruches
    const ns = Math.min(H.solar.length, owned.solarPanel || 0);
    for (let k = 0; k < ns; k++) pushBuilding('solar.panel', H.solar[k].x, H.solar[k].y, 1, 1, objSet, `solarPanel.${k}`);
    const nh = Math.min(L.hives.length, owned.beehive || 0);
    for (let k = 0; k < nh; k++) pushBuilding('beehive', L.hives[k].x, L.hives[k].y, 1, 1, objSet, `beehive.${k}`);
    // Arroseurs (niv. 1 : la moitié des têtes, niv. 2 : toutes) et convoyeur
    let conveyor = null;
    for (const m of Object.values(car.machines || {})) {
      if (!m) continue;
      if (m.id === 'conveyor') conveyor = m;
      if (m.id !== 'sprinklers') continue;
      const sp = L.sprinklers[m.lotId];
      if (!sp) continue;
      const n = (m.level || 1) >= 2 ? sp.heads.length : Math.ceil(sp.heads.length / 2);
      for (let k = 0; k < n; k++) pushBuilding('sprinkler', sp.heads[k].x, sp.heads[k].y + (sp.onFence ? -0.25 : 0), 1, 1, objSet, `sprinklers.${m.lotId}`);
    }
    if (conveyor) {
      const on = conveyor.on !== false;
      const frame = on && Math.floor(time * 6) % 2 ? '.1' : '';
      for (const cv of L.conveyors) {
        for (let x = cv.x0; x <= cv.x1; x++) pushSprite(`machine.conveyor.h${frame}`, x * TILE, cv.y * TILE, cv.y * TILE + 4, objSet);
        // Branches montant vers la porte de chaque atelier de la cour.
        for (const s0 of Object.values(L.slots)) {
          if (s0.kind !== 'workshop' || s0.lotId !== cv.lotId) continue;
          const bx = s0.building.x + (s0.building.w >> 1) + (s0.slot === 0 ? 1 : -1);
          for (let y = s0.building.y + s0.building.h; y < cv.y; y++) pushSprite(`machine.conveyor.v${frame}`, bx * TILE, y * TILE, y * TILE + 2, objSet);
        }
      }
    }
    // Abris, chambre d'hôte, ateliers
    for (const [id, s0] of Object.entries(L.slots)) {
      const b = s0.building;
      if (s0.kind === 'shelter' || s0.kind === 'guest') {
        if (s0.sprite) pushBuilding(s0.sprite, b.x, b.y, b.w, b.h, objSet, `b.${id}`);
      } else if (s0.kind === 'workshop') {
        pushWorkshop(id, owned, objSet);
        const lvl = car.buildings?.[id]?.level || owned[id] || 0;
        if (lvl >= 4) pushBuilding('part.sign.gold', b.x + b.w - 1, b.y + b.h - 2, 1, 1, objSet, `${id}.3`).y -= 2;
        if (lvl >= 5) pushBuilding('part.annex', s0.slot === 0 ? b.x - 1 : b.x + b.w, b.y + b.h - 2, 1, 2, objSet, `${id}.4`);
      }
    }
    // Décorations posées sur les emplacements
    for (const d of L.decorSlots || []) {
      if (d.kind !== 'small') continue;
      const name = decorSprite(cosmetics.decor[d.id]);
      if (!name || name === 'deco.pond') continue;
      const tall = (SPRITES[name].h || 1) > 1;
      pushSprite(name, d.x, tall ? d.y - TILE : d.y, d.y + TILE - 0.5, objSet);
    }
    const pond = (L.decorSlots || []).find((d) => d.id === 'pond');
    if (pond && decorSprite(cosmetics.decor.pond) === 'deco.pond') pushSprite('deco.pond', pond.x, pond.y, pond.y + 1, objSet);
    // Coupe du comice sur le panneau de la ferme ; cocarde pendant le comice
    const cres = car.contest?.result || st.contest?.result;
    const met = cres && Array.isArray(cres.goalsMet) ? cres.goalsMet.length : 0;
    if (L.sign && hasSlot('sign')) {
      if (met > 0) {
        const trophy = met >= 3 ? 'icon.trophy.gold' : met === 2 ? 'icon.trophy.silver' : 'icon.trophy.bronze';
        pushSprite(trophy, L.sign.x * TILE + 32, L.sign.y * TILE - 12, (L.sign.y + 1) * TILE + 0.2, images);
      } else if (careerInfo.contest && SPRITES['fair.ribbon']) {
        pushSprite('fair.ribbon', L.sign.x * TILE + 34, L.sign.y * TILE - 10, (L.sign.y + 1) * TILE + 0.2, images);
      }
    }
    // Décor de fête du jour
    pushFair(objSet);
    // Animaux, employés, machines, corbeaux, visiteurs, Joseph
    actors.collect(pushSprite, viewRect, { base: images, obj: objSet });
    // Fermier (ou fermière)
    {
      const walking = farmer.path.length > 0;
      const hop = walking && Math.sin(farmer.walkT * 5 * Math.PI) > 0 ? -1 : 0;
      const workBob = farmer.tool && Math.sin(farmer.toolT * 18) > 0 ? 1 : 0;
      const x = Math.round(farmer.x) - 8;
      const y = Math.round(farmer.y) - 15 + hop + workBob;
      pushSprite(farmerSprite(), x, y, farmer.y + 1, images, { flipX: farmer.facing < 0, tool: farmer.tool, toolFlip: farmer.facing < 0 });
    }
  }

  /** Sprite du joueur : tenue choisie, fermier ou fermière (carrière). */
  function farmerSprite() {
    const female = careerMode && lastGame?.state?.career?.farmerGender === 'fermiere';
    const name = female ? playerSprite(cosmetics.outfit, { female: true }) : outfitSprite(cosmetics.outfit);
    return SPRITES[name] ? name : outfitSprite(cosmetics.outfit);
  }

  /** Thème de la fête du jour selon la saison (id de CORE-C : seedFair, villageFete, harvestFestival, christmasMarket). */
  function fairTheme() {
    const id = careerInfo.today;
    if (!id) return null;
    if (/christmas|noel|xmas/i.test(id)) return 'christmas';
    if (/harvest|recolte/i.test(id)) return 'harvest';
    if (/seed|semis/i.test(id)) return 'seed';
    return 'village';
  }

  function pushFair(objSet) {
    const theme = fairTheme();
    if (!theme) return;
    const H = layout.home;
    const y0 = H.y0;
    const put = (name, tx, ty, dy = 0) => {
      if (!SPRITES[name]) return;
      const sz = SPRITES[name];
      pushBuilding(name, tx, ty - ((sz.h || 1) - 1), sz.w || 1, sz.h || 1, objSet, `fair.${name}`).y += dy;
    };
    const blink = Math.floor(time * 2) % 2 ? '.1' : '';
    const leftX = layout.machineParking && Object.values(layout.machineParking).some((m) => m.id === 'waterTower') ? 4 : 2;
    if (theme === 'christmas') {
      put(`fair.chalet${SPRITES[`fair.chalet${blink}`] ? blink : ''}`, leftX, y0 + 11);
      put('fair.xmasTree', 1, y0 + 11);
    } else {
      put('fair.stand', leftX, y0 + 11);
      put('fair.balloons', leftX + 2, y0 + 11);
      if (theme === 'harvest') put('fair.pumpkins', leftX, y0 + 12);
      if (theme === 'seed' && SPRITES['sack.wheat']) put('sack.wheat', leftX + 2, y0 + 12);
    }
    // Lampions suspendus au-dessus du bord de la route (devant le tracteur garé).
    const lan = `fair.lanterns${SPRITES[`fair.lanterns${blink}`] ? blink : ''}`;
    if (SPRITES[lan]) for (const lx of FAIR_LANTERNS_X) pushSprite(lan, lx * TILE, H.roadY * TILE - 13, H.roadY * TILE + 6, objSet);
  }

  /** Guirlandes des jours de fête : au-dessus de la route et entre la maison et le grenier. */
  function drawFairGarlands() {
    const theme = fairTheme();
    if (!theme) return;
    const H = layout.home;
    const T = TILE;
    drawGarland(1 * T, H.roadY * T - 4, 13 * T, 6, 0.4);
    drawGarland((H.house.x + H.house.w) * T - 4, (H.y0 + 2) * T, H.storage.x * T + 4, 8, 2.2);
  }

  /** Arc-en-ciel (événement au hasard) : en surimpression dans le ciel de la vue, qui apparaît doucement. */
  let rainbowT = 0;
  function drawRainbow(dt) {
    const on = careerInfo.active === 'rainbow';
    rainbowT = Math.max(0, Math.min(1, rainbowT + (on ? dt : -dt) * 0.6));
    if (rainbowT <= 0 || !SPRITES['effect.rainbow']) return;
    const c = vctx;
    const k = Math.max(1, Math.floor((layout.essential.w) / 64));
    const w = 64 * k;
    const x = Math.round(-ox + (viewW - w) / 2);
    // Haut de la bande visible (sous la barre du haut), pas du canvas.
    const y = Math.round(-oy + (band.y - blitY) / zoom + 10);
    c.globalAlpha = 0.5 * rainbowT;
    drawSprite(c, images, 'effect.rainbow', x, y, { scale: k });
    c.globalAlpha = 1;
  }

  /** Serre : vitres claires par-dessus les cultures (on les voit à travers), reflets. */
  function drawGlass() {
    const c = vctx;
    for (const g of layout.greenhouses) {
      const y0 = (g.y + 2) * TILE;
      if (y0 > -oy + viewH || y0 + 4 * TILE < -oy) continue;
      c.globalAlpha = 0.28;
      for (let y = g.y + 2; y < g.y + 6; y++) for (let x = g.x + 1; x < g.x + g.w - 1; x++) drawSprite(c, images, 'glass.roof.c', x * TILE, y * TILE);
      c.globalAlpha = 0.35;
      c.fillStyle = '#ffffff';
      const sweep = ((time * 18) % ((g.w + 6) * TILE)) - 3 * TILE;
      for (let yy = 0; yy < 4 * TILE; yy += 1) {
        const x = Math.round(g.x * TILE + TILE + sweep - yy * 0.5);
        if (x > g.x * TILE + TILE && x < (g.x + g.w - 1) * TILE - 2) c.fillRect(x, y0 + yy, 2, 1);
      }
      c.globalAlpha = 1;
    }
  }

  /** Eau des mares : quelques reflets qui scintillent. */
  function drawWater() {
    const c = vctx;
    for (const p of layout.ponds) {
      const w = p.water;
      if ((w.y + w.h) * TILE < -oy || w.y * TILE > -oy + viewH) continue;
      for (let k = 0; k < 7; k++) {
        const ph = (time * 0.7 + k * 0.37) % 1;
        if (ph > 0.5) continue;
        const x = (w.x + 1) * TILE + Math.floor(tileHash(k, Math.floor(time * 0.7 + k * 0.37), 5) * (w.w - 2) * TILE);
        const y = (w.y + 1) * TILE + Math.floor(tileHash(k, Math.floor(time * 0.7 + k * 0.37), 6) * (w.h - 2) * TILE);
        c.globalAlpha = ph < 0.25 ? ph * 4 : (0.5 - ph) * 4;
        c.fillStyle = '#e8f6ff';
        c.fillRect(x, y, 3, 1);
        c.fillRect(x + 1, y - 1, 1, 1);
      }
      c.globalAlpha = 1;
    }
  }

  /** Bulles de ramassage au-dessus des abris (production en attente) ; nombres à l'écran ensuite. */
  const bubbleLabels = [];
  function drawCollectBubbles() {
    bubbleLabels.length = 0;
    const st = lastGame.state;
    const bs = st.career?.buildings || {};
    const c = vctx;
    for (const [id, s0] of Object.entries(layout.slots)) {
      if (!s0.animal) continue;
      const pending = bs[id]?.pending || 0;
      if (!(pending > 0)) continue;
      const icon = PRODUCT_OF_ANIMAL[s0.animal] || 'product.eggs';
      const bp = s0.bubble || { x: s0.anchor.x - 16, y: s0.anchor.y - 30 };
      const bx = Math.round(bp.x);
      const by = Math.round(bp.y + (Math.sin(time * 2.4 + bx) > 0.4 ? -1 : 0));
      if (by > -oy + viewH || by + 32 < -oy) continue;
      const full = careerInfo.full[id];
      c.globalAlpha = full ? 0.72 + 0.28 * Math.sin(time * 5) : 1;
      drawSprite(c, images, 'bubble.collect', bx, by);
      if (SPRITES[icon]) drawSprite(c, images, icon, bx + BUBBLE_CONTENT.x, by + BUBBLE_CONTENT.y - 1);
      c.globalAlpha = 1;
      bubbleLabels.push({ x: bx + 16, y: by + BUBBLE_CONTENT.y + BUBBLE_CONTENT.h + 2, text: String(Math.round(pending)), full: !!full });
    }
  }

  /** Nombres des bulles et prix du terrain à vendre, écrits à l'échelle de l'écran (nets). */
  const labelPt = { x: 0, y: 0 };
  function drawCareerLabels() {
    const size = Math.max(Math.round(11 * dpr), Math.round(zoom * 5.5));
    ctx.save();
    ctx.font = `700 ${size}px "Ferme", "Trebuchet MS", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(size / 5));
    for (const b of bubbleLabels) {
      worldToDevice(b.x, b.y, labelPt);
      if (labelPt.y < -size || labelPt.y > devH + size) continue;
      ctx.strokeStyle = '#3f2631';
      ctx.strokeText(b.text, labelPt.x, labelPt.y);
      ctx.fillStyle = b.full ? '#ffb3a0' : '#fff3b0';
      ctx.fillText(b.text, labelPt.x, labelPt.y);
    }
    const sale = layout.saleBand;
    const info = careerInfo.nextLot;
    if (sale && info) {
      worldToDevice(7 * TILE, (sale.y0 + sale.rows) * TILE + 4, labelPt);
      if (labelPt.y > -size * 2 && labelPt.y < devH + size * 2) {
        const big = Math.max(Math.round(13 * dpr), Math.round(zoom * 6.5));
        ctx.font = `700 ${big}px "Ferme", "Trebuchet MS", monospace`;
        const locked = !!info.lockedByRank;
        const text = locked ? `Rang ${info.lockedByRank} requis` : `${info.price} pièces`;
        ctx.lineWidth = Math.max(3, Math.round(big / 5));
        ctx.strokeStyle = '#3f2631';
        const tw = ctx.measureText(text).width;
        const iconS = Math.max(1, Math.round(big / 9));
        const iw = 16 * iconS * 0.8;
        const cx = labelPt.x + iw / 2;
        ctx.strokeText(text, cx, labelPt.y);
        ctx.fillStyle = locked ? '#f3e9dc' : info.canBuy ? '#fff3b0' : '#ffd0c0';
        ctx.fillText(text, cx, labelPt.y);
        const icon = locked ? 'icon.career.lock' : 'icon.career.coins';
        if (SPRITES[icon]) drawSprite(ctx, images, icon, Math.round(cx - tw / 2 - 16 * iconS), Math.round(labelPt.y - 8 * iconS), { scale: iconS });
      }
    }
    ctx.restore();
  }

  function drawEntries() {
    drawList.length = 0;
    for (let i = 0; i < entryCount; i++) drawList.push(entries[i]);
    drawList.sort(byDepth);
    const c = vctx;
    // (Carrière) Monde très haut : on ne dessine que ce qui touche la vue.
    const cull = windowed;
    const vy0 = -oy - 8;
    const vy1 = -oy + viewH + 8;
    for (const e of drawList) {
      if (e.img) {
        c.drawImage(e.img, e.x, e.y);
        continue;
      }
      if (cull) {
        if (e.y > vy1) continue;
        const sp = e.name.charCodeAt(0) === 64 ? null : SPRITES[e.name];
        const hh = sp ? (sp.h || 1) * TILE * e.scale : 40;
        if (e.y + hh < vy0) continue;
      }
      if (e.name === '@bubble') {
        extraImages();
        c.drawImage(bubble, e.x, e.y);
        if (e.icon && SPRITES[e.icon]) drawSprite(c, images, e.icon, e.x + 1, e.y + 1);
        continue;
      }
      if (e.alpha !== 1) c.globalAlpha = Math.max(0, Math.min(1, e.alpha));
      if (e.scale !== 1) {
        drawSprite(c, e.set, e.name, e.x, e.y, { scale: e.scale, flipX: e.flipX });
      } else {
        drawSprite(c, e.set, e.name, e.x, e.y, e.flipX ? { flipX: true } : undefined);
      }
      if (e.tool) {
        // Outil tenu à côté du fermier (tuile de 16 px, dessinée plus haut que ses mains)
        drawSprite(c, images, e.tool, e.x + (e.toolFlip ? -9 : 9), e.y + 2, { flipX: e.toolFlip });
      }
      if (e.overlay) drawSprite(c, images, e.overlay, e.x, e.y, e.flipX ? { flipX: true } : undefined);
      if (e.alpha !== 1) c.globalAlpha = 1;
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

  /** (Carrière) Fumées (maison, chambre d'hôte, serre chauffée) et jets des arroseurs à l'aube. */
  function emitCareerAmbient(dt, owned, season, weather, dayProgress) {
    const L = layout;
    const car = lastGame.state.career || {};
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = season === 'summer' ? rnd(1.4, 2.2) : rnd(0.6, 1.1);
      const h = L.home.house;
      effects.smoke((h.x + 1) * TILE + 7, h.y * TILE + 1);
      const g = L.slots.guestHouse;
      if (g && Math.random() < 0.6) effects.smoke((g.building.x + 1) * TILE + 7, g.building.y * TILE + 1);
      for (const gh of L.greenhouses) if (gh.level >= 3 && (season === 'winter' || season === 'autumn')) effects.smoke((gh.x + gh.w - 2) * TILE + 8, gh.y * TILE - 2);
    }
    if (L.slots.mill && owned.mill > 0) {
      const busy = working('mill');
      millPhase = (millPhase + dt / (busy ? 0.13 : 0.42)) % (WINDMILL_FRAMES * 1000);
    }
    for (const id of ['dairy', 'jamWorkshop', 'cannery', 'spinningMill']) {
      const s0 = L.slots[id];
      if (!s0 || !(owned[id] > 0) || !working(id)) continue;
      if (Math.random() < dt * 0.9) effects.smoke(s0.building.x * TILE + 10, s0.building.y * TILE + 3);
    }
    const spraying = season !== 'winter' && weather !== 'rain' && weather !== 'storm' && dayProgress < 0.22;
    if (!spraying) return;
    sprayT -= dt;
    if (sprayT > 0) return;
    sprayT = 0.05;
    const heads = [];
    for (const m of Object.values(car.machines || {})) {
      if (!m || m.id !== 'sprinklers' || m.on === false) continue;
      const sp = L.sprinklers[m.lotId];
      if (!sp) continue;
      const n = (m.level || 1) >= 2 ? sp.heads.length : Math.ceil(sp.heads.length / 2);
      for (let k = 0; k < n; k++) heads.push(sp.heads[k]);
    }
    if (!heads.length) return;
    const t = heads[Math.floor(Math.random() * heads.length)];
    const wy = t.y * TILE + 4;
    if (wy < -oy - 16 || wy > -oy + viewH + 16) return;
    effects.spray(t.x * TILE + 8, wy);
  }

  function drawCareerBees(owned, season, weather, dayProgress) {
    if (season === 'winter' || weather === 'rain' || weather === 'storm' || dayProgress > 0.92) return;
    const n = Math.min(layout.hives.length, owned.beehive || 0);
    const c = vctx;
    for (let k = 0; k < n; k++) {
      const t = layout.hives[k];
      const cx = t.x * TILE + 8;
      const cy = t.y * TILE + 5;
      if (cy < -oy - 20 || cy > -oy + viewH + 20) continue;
      for (let b = 0; b < 3; b++) {
        const ph = k * 2.1 + b * 2.4;
        const x = Math.round(cx + Math.sin(time * 1.9 + ph) * 8 + Math.sin(time * 4.3 + ph * 1.7) * 3 + 6);
        const y = Math.round(cy + Math.cos(time * 2.6 + ph) * 4 - 4 + Math.sin(time * 6 + ph) * 1.5);
        c.fillStyle = '#fdbe53';
        c.fillRect(x, y, 1, 1);
        c.fillStyle = OUTLINE;
        c.fillRect(x + (Math.sin(time * 1.9 + ph) > 0 ? -1 : 1), y, 1, 1);
      }
    }
  }

  /** (Carrière) Lanternes des fêtes qui s'allument le soir. */
  function drawFairGlow(dayProgress, weather) {
    if (!fairTheme()) return;
    const dark = weather === 'storm' ? 0.8 : weather === 'rain' ? 0.5 : 0;
    const k = Math.max(dark, dayProgress > 0.68 ? Math.min(1, (dayProgress - 0.68) / 0.12) : 0);
    if (k <= 0.02) return;
    const c = vctx;
    c.save();
    c.translate(ox, oy);
    c.globalCompositeOperation = 'lighter';
    const y = layout.home.roadY * TILE - 8;
    for (let i = 0; i < 4 * FAIR_LANTERNS_X.length; i++) {
      const cx = Math.round(FAIR_LANTERNS_X[i >> 2] * TILE) + 3 + (i & 3) * 8;
      c.globalAlpha = 0.09 * k * (0.9 + 0.1 * Math.sin(time * 7 + i));
      c.fillStyle = '#ffcf6a';
      c.fillRect(cx - 5, y - 3, 11, 9);
      c.fillRect(cx - 3, y - 5, 7, 13);
    }
    c.restore();
    c.globalAlpha = 1;
  }

  function drawHover(owned) {
    if (!hover) return;
    let r = null;
    if (careerMode && hover.type !== 'plot' && hover.type !== 'investment') r = layout.hitRect(hover) || actors.rectOf(hover);
    else if (hover.type === 'plot') r = layout.plotRect(hover.index);
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
    drawSprite(c, images, farmerSprite(), fr.x, fr.y, farmer.facing < 0 ? { flipX: true } : undefined);
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

    if (game.state && game.state.mode === 'career') {
      if (!careerMode || game !== lastGame) {
        lastGame = game;
        rebuildCareer(game, true);
      } else if (forceRebuild || careerLayoutKey(game.state) !== careerKey) rebuildCareer(game, false);
      if (game.level) layout.level = game.level;
      return renderCareer(game, dt);
    }
    if (careerMode) {
      // Retour au mode Niveaux : disposition des niveaux, vue pleine.
      careerMode = false;
      windowed = false;
      actors.reset();
      deferred.length = 0;
      clearing = null;
      rebuildLayout(game.level || layout.level);
      computeCamera();
      lastGame = null;
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

  // ── (Carrière) Disposition, reconstruction et image ──────────────────────────────────
  function careerOpts(g) {
    return { career: g.state.career, plots: g.state.plots, investments: g.state.investments };
  }

  /**
   * Reconstruit la disposition de carrière. first : nouvelle partie (tout est remis à zéro, vue sur le
   * champ de départ) ; sinon le monde a changé (terrain acheté, bâtiment…) : ce qui était à l'écran y
   * reste, tout ce qui est en coordonnées du monde descend de la hauteur ajoutée en haut.
   */
  function rebuildCareer(g, first) {
    const oldH = layout.height;
    const keepY = !first && userScrolled ? worldCenterY() : null;
    const anim = !first && scrollAnim ? { ...scrollAnim } : null;
    layout = createCareerLayout(g.level || layout.level, careerOpts(g));
    careerKey = careerLayoutKey(g.state);
    forceRebuild = false;
    careerMode = true;
    windowed = true;
    if (first) {
      resetTracking();
      effects.clear();
      actors.reset();
      deferred.length = 0;
      clearing = null;
      for (const k of Object.keys(prevLevels)) delete prevLevels[k];
      careerInfo.t = -1;
      userScrolled = false;
      flingV = 0;
      scrollAnim = null;
      scrollBeforeOverlay = null;
      computeCamera();
      return;
    }
    const dy = layout.height - oldH;
    // Suivi des parcelles : on garde ce qui existe, on complète (nouvelles parcelles à la fin).
    const n = layout.plots.length;
    const grow = (arr, v) => { while (arr.length < n) arr.push(v); arr.length = n; };
    grow(plotViews, null);
    grow(prevCrop, undefined);
    grow(prevFruit, 0);
    grow(prevGrowth, -1);
    grow(prevWatered, false);
    grow(prevUnlocked, false);
    for (let i = 0; i < n; i++) plotViews[i] = null; // positions et parcelles retirées : tout relire
    visualIndex = null;
    unlockedCount = -1;
    staticKey = -1;
    if (dy) {
      farmer.y += dy;
      for (const p of farmer.path) p.y += dy;
      effects.shift(0, dy);
      actors.shift(dy);
    }
    computeCamera(keepY !== null ? keepY + dy : undefined);
    if (anim) scrollAnim = { ...anim, from: anim.from + dy * zoom, to: anim.to + dy * zoom };
  }

  /** Relit quelques requêtes de carrière (au plus 4 fois par seconde). */
  function refreshCareerInfo(g) {
    if (careerInfo.t >= 0 && time - careerInfo.t < 0.25) return;
    careerInfo.t = time;
    const q = g.query?.career;
    try { careerInfo.nextLot = q?.nextLot ? q.nextLot() : null; } catch { careerInfo.nextLot = null; }
    careerInfo.full = {};
    try {
      for (const b of (q?.buildings ? q.buildings() : [])) if (b && b.full) careerInfo.full[b.id] = true;
    } catch { /* requête indisponible */ }
    const ev = g.state.career?.events || {};
    careerInfo.today = ev.today || null;
    careerInfo.active = ev.active ? ev.active.kind || ev.active.id || null : null;
    careerInfo.contest = !!(g.state.career?.contest && !g.state.career.contest.awarded);
  }

  /** Apparition des bâtiments construits ou améliorés, des ruches et panneaux achetés. */
  function syncCareerBuildings(st) {
    const bs = st.career?.buildings || {};
    const seen = new Set();
    for (const [id, b] of Object.entries(bs)) {
      seen.add(id);
      const lv = b?.level || 0;
      const before = prevLevels[id];
      if (initialized && lv > (before || 0)) {
        pops.set(`b.${id}`, time);
        if (!before) pops.set(`${id}.main`, time);
        else pops.set(`${id}.${lv - 1}`, time);
      }
      prevLevels[id] = lv;
    }
    for (const id of Object.keys(prevLevels)) if (!seen.has(id)) delete prevLevels[id];
    for (const id of ['beehive', 'solarPanel']) {
      const nn = st.investments?.[id] || 0;
      const before = prevOwned[id] ?? nn;
      if (initialized && nn > before) for (let k = before; k < nn; k++) pops.set(`${id}.${k}`, time);
      prevOwned[id] = nn;
    }
  }

  /** Événements de carrière différés : la disposition est maintenant à jour. */
  function flushDeferred() {
    while (deferred.length) {
      const [type, payload] = deferred.shift();
      careerEvent(type, payload);
    }
  }

  function careerEvent(type, payload = {}) {
    const L = layout;
    switch (type) {
      case 'lotBought':
        clearing = { lotId: payload.lotId, t0: time };
        break;
      case 'lotDeveloped': {
        const r = L.lotRect(payload.lotId);
        if (!r) break;
        // Clôture posée de gauche à droite : poussière et étincelles le long du terrain.
        for (let k = 0; k < 10; k++) {
          const x = r.x + TILE + (k / 9) * (r.w - 2 * TILE);
          effects.dirt(x, r.y + r.h - TILE * 1.5, 5, 1);
          effects.sparkle({ x: x - 6, y: r.y + 4, w: 12, h: r.h - 2 * TILE }, 3, 'gold', k * 0.1);
        }
        break;
      }
      case 'buildingBuilt':
      case 'buildingUpgraded': {
        const r = L.investmentRect(payload.buildingId, 99);
        if (r) {
          effects.sparkle(r, Math.min(40, 14 + Math.round((r.w * r.h) / 200)), 'gold', 0);
          effects.dirt(r.x + r.w / 2, r.y + r.h - 2, 12, 1);
        }
        break;
      }
      case 'machineBought':
      case 'machineUpgraded': {
        const m = L.machineParking[payload.key];
        if (m) effects.sparkle({ x: m.x, y: m.y, w: m.w, h: m.h }, 14, 'gold', 0);
        break;
      }
      default:
        break;
    }
    actors.onEvent(type, payload, L);
    effects.onEvent(type, payload, L);
  }

  /** Défrichage d'un terrain acheté : la forêt s'efface, les arbres s'enfoncent, poussière et feuilles. */
  function drawClearing(season, sheetsEnv) {
    if (!clearing) return;
    const age = time - clearing.t0;
    const r = layout.lotRect(clearing.lotId);
    if (!r || age > 1.6) {
      clearing = null;
      return;
    }
    const c = vctx;
    if (!clearing.started) {
      clearing.started = true;
      const set = season === 'winter' ? sheetsEnv : images;
      for (let k = 0; k < 9; k++) {
        const x = r.x + TILE + Math.floor(tileHash(k, 1, 41) * (r.w - 3 * TILE));
        const y = r.y + TILE + Math.floor(tileHash(k, 2, 41) * (r.h - 3 * TILE));
        const name = season === 'winter' ? 'tree.pine' : season === 'autumn' ? 'tree.autumn' : 'tree.green';
        effects.sinkTree({ x, y, w: TILE, h: TILE }, name, set, 1);
      }
    }
    const k = Math.max(0, 1 - age / 1.2);
    if (k <= 0) return;
    const fset = season === 'autumn' ? 'forest.autumn' : 'forest.green';
    c.globalAlpha = k;
    for (let ty = Math.floor(r.y / TILE); ty < (r.y + r.h) / TILE; ty++) {
      const part = ty === Math.floor((r.y + r.h) / TILE) - 1 ? 'bottom' : 'fill';
      for (let tx = 0; tx < layout.cols; tx++) drawSprite(c, sheetsEnv, `${fset}.${part}`, tx * TILE, ty * TILE);
    }
    c.globalAlpha = 1;
  }

  function renderCareer(game, dt) {
    const cal = game.query.calendar();
    const season = cal.seasonId || 'spring';
    const weather = game.state.weather?.today || 'sunny';
    const dayProgress = cal.dayProgress ?? 0.5;
    const owned = game.state.investments || {};
    const raining = weather === 'rain' || weather === 'storm';
    const sheetsEnv = seasonSheets[season] || seasonSheets.spring;

    refreshCareerInfo(game);
    syncCareerBuildings(game.state);
    syncPlots(game, raining);
    actors.sync(game, layout, time);
    initialized = true;
    flushDeferred();

    const key = `career|${SEASON_INDEX[season] ?? 0}|${cosVersion}|${careerKey}`;
    if (key !== staticKey) {
      buildStaticCareer(season, game.state);
      staticKey = key;
    }

    updateFarmer(dt);
    actors.update(dt, { elapsed: game.state.time?.elapsed || 0, season, weather, dayProgress });
    emitCareerAmbient(dt, owned, season, weather, dayProgress);
    fxState.season = season;
    fxState.weather = weather;
    fxState.dayProgress = dayProgress;
    fxState.view.x = -ox;
    fxState.view.y = -oy;
    fxState.view.w = viewW;
    fxState.view.h = viewH;
    effects.update(dt, fxState);

    const c = vctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    // Tranche visible de la couche fixe.
    c.drawImage(staticLayer, 0, bufY0 - sBufY0, viewW, viewH, 0, 0, viewW, viewH);
    c.translate(ox, oy);
    drawWater();
    drawPlots(sheetsEnv, raining, season);
    drawGlass();
    effects.drawGround(c, images);
    drawClearing(season, sheetsEnv);
    collectCareer(owned, season, sheetsEnv);
    drawEntries();
    effects.drawSmoke(c);
    drawCareerBees(owned, season, weather, dayProgress);
    drawFairGarlands();
    if (contestDay(cal)) drawBunting();
    drawWorkBubbles(owned);
    drawCollectBubbles();
    effects.drawWorld(c);
    if (decorMode) drawDecorOverlay(season === 'winter' ? sheetsEnv : images);
    drawHover(owned);
    drawRainbow(dt);
    c.setTransform(1, 0, 0, 1, 0, 0);
    effects.drawWeather(c);
    effects.drawLight(c, viewW, viewH);
    drawLampGlow(dayProgress, weather);
    drawFairGlow(dayProgress, weather);
    effects.postProcess(c, view, scratch);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, devW, devH);
    ctx.drawImage(view, 0, 0, viewW, viewH, blitX, blitY, viewW * zoom, viewH * zoom);
    drawSignText();
    drawCareerLabels();
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
    if (careerMode && (!lvl || lvl.id === 'career' || lvl.career)) {
      // La disposition de carrière se reconstruit d'elle-même (à la prochaine image).
      forceRebuild = true;
      return;
    }
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
      if (careerMode && type !== 'treeRemoved') {
        // Carrière : traité après la prochaine reconstruction de la disposition (positions à jour).
        deferred.push([type, payload || {}]);
        if (deferred.length > 300) deferred.shift();
        return;
      }
      if (type === 'treeRemoved' && payload) {
        // L'arbre s'enfonce dans la terre (sprite d'avant l'arrachage).
        const r = layout.plotRect(payload.plotIndex);
        const pv = plotViews[payload.plotIndex];
        if (r) {
          const season = lastGame ? lastGame.query.calendar().seasonId : 'summer';
          const i = payload.plotIndex;
          const info = treeInfo(pv, { growth: prevGrowth[i], fruit: prevFruit[i] });
          const name = pv ? appleTreeSprite(info, season, pv.cropId || 'apple') : 'tree.apple.young';
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
    // ── Carrière ──
    focusLot(lotId, opts = {}) {
      if (!careerMode) return scrollDev / dpr;
      return centerRect(layout.lotRect(lotId), opts);
    },
    focusHouse(opts = {}) {
      if (!careerMode) {
        focusField();
        return scrollDev / dpr;
      }
      return centerRect(layout.homeRect, opts);
    },
    focusBuilding(id, opts = {}) {
      const r = careerMode ? layout.investmentRect(id, 99) : layout.investmentRect?.(id, 99);
      return centerRect(r || null, opts);
    },
    lotRect(lotId) {
      return careerMode ? layout.lotRect(lotId) : null;
    },
    lotScreenRect(lotId) {
      const r = careerMode ? layout.lotRect(lotId) : null;
      if (!r) return null;
      const a = worldToScreen(r.x, r.y);
      const b = worldToScreen(r.x + r.w, r.y + r.h);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    },
    setCareer(on = true) {
      if (on) forceRebuild = true;
    },
    get careerMode() {
      return careerMode;
    },
    get actors() {
      return actors;
    },
    careerStats() {
      return { ...actors.stats(), view: { w: viewW, h: viewH }, staticLayer: { w: viewW, h: staticH }, world: { w: layout.width, h: layout.height }, zoom, windowed };
    },
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
