// Point d'entrée : chargement des ressources, boucle de jeu, câblage cœur ↔ scène ↔ interface ↔ audio.
//
// Déroulé : écran de chargement (images, police, sons) → bouton « Commencer » (déverrouille l'audio)
// → menu principal (une ferme de démonstration tourne en fond) → partie.
//
// Mise en page (docs/MOBILE.md) : la scène occupe tout l'écran ; la barre du haut et la barre
// d'onglets se posent par-dessus et la scène en est prévenue (scene.setInsets). Téléphone en
// portrait d'abord ; grand écran en paysage (body.layout-wide) : onglets dans la barre du haut,
// feuilles « Acheter » et « Bilan » rangées à droite.
//
// Contenu v3 : progression permanente (src/ui/progress.js → src/core/progression.js), grange aux
// souvenirs (src/ui/grange.js), mode décoration (src/ui/decor.js), conseils « première fois »
// (src/ui/hints.js), ateliers (src/ui/buildings.js). Les modules du cœur v3 sont chargés au
// démarrage (src/ui/v3.js) et tout est vérifié avant usage : sans eux, le jeu reste le jeu v2.
//
// Débogage (seulement avec ?debug=1 dans l'adresse) : window.__game (partie en cours),
// window.__app et window.__debug = { skipDays(n), plotPoint(i), investmentPoint(id), start(levelId),
// progress(), setProgress(p), grange(tab), decor() }.

import { SHEETS } from './render/atlas.js';
import { loadImage, loadImages } from './render/assets.js';
import { createScene } from './render/scene.js';
import { createGame, loadGame } from './core/game.js';
import { DAY_SECONDS, SEASONS } from './data/balance.js';
import { getLevel, LEVELS } from './data/levels.js';
import { getInvestment } from './data/investments.js';
import { getCrop } from './data/crops.js';
import { AUDIO } from './audio/manifest.js';
import { ambienceFor, createAudio } from './audio/audio.js';
import * as storage from './storage.js';
import * as pwa from './pwa.js';
import { $, el, fmt, plural } from './ui/dom.js';
import { initSprites, investmentIcon, cropIcon, icon } from './ui/icons.js';
import { createTooltip } from './ui/tooltip.js';
import { createSheets } from './ui/sheets.js';
import { createTabbar } from './ui/tabbar.js';
import { createSceneInput } from './ui/gestures.js';
import { createToasts } from './ui/toasts.js';
import { createHud } from './ui/hud.js';
import { createPanel } from './ui/panel.js';
import { createField } from './ui/field.js';
import { createDialogs } from './ui/dialogs.js';
import { createTutorial } from './ui/tutorial.js';
import { season, seasonArrives, cropName, incomePhrase } from './ui/text.js';
import { loadV3, v3 } from './ui/v3.js';
import { createProgress } from './ui/progress.js';
import { createGrange } from './ui/grange.js';
import { createDecor } from './ui/decor.js';
import { createHints } from './ui/hints.js';
import { isProcessing } from './ui/buildings.js';
import { productIcon } from './ui/icons.js';
import { productName } from './ui/panel.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ── État de l'application ──────────────────────────────────────────────────────────
const settings = storage.loadSettings();
const audio = createAudio(AUDIO, settings);
const canvas = $('#scene');
const stage = $('#stage');

const app = {
  game: null,
  scene: null,
  audio,
  settings,
  inMenu: true,
  isTouch: matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches),
  keyboardMode: false, // le joueur navigue au clavier : focus automatique des boutons
};

window.addEventListener('keydown', (e) => {
  if (['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) app.keyboardMode = true;
}, true);
window.addEventListener('pointerdown', () => {
  app.keyboardMode = false;
}, true);

let images = null;
let attract = null; // ferme de démonstration derrière le menu
let unwire = null;
let pending = { billPaid: null, frost: null, end: null, contest: null };
let queuedBanner = null;
const pauseReasons = new Set();
let resumeSpeed = 1;
let lastPlaySpeed = settings.speed || 1;
let hover = { hit: null, x: 0, y: 0 };

// ── Interface ─────────────────────────────────────────────────────────────────────
app.tooltip = createTooltip($('#tooltip'));
app.toasts = createToasts($('#toasts'), $('#banner'));
app.sheets = createSheets($('#sheet-layer'), app);
app.hud = createHud($('#hud'), app);
app.tabbar = createTabbar($('#tabbar'), app);
app.panel = createPanel(app);
app.field = createField(app);
app.dialogs = createDialogs($('#modal-layer'), app);
app.tutorial = createTutorial($('#tutorial'), app);
app.input = createSceneInput(canvas, app);
app.progression = createProgress(app, storage);
app.grange = createGrange(app);
app.decor = createDecor(app);
app.hints = createHints(app);

applyDisplaySettings();

// ── Réglages ──────────────────────────────────────────────────────────────────────
function applyDisplaySettings() {
  const reduce = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('reduced-motion', reduce);
}

app.saveSettings = () => storage.saveSettings(settings);

app.updateSettings = (patch) => {
  Object.assign(settings, patch);
  audio.setVolumes(settings);
  applyDisplaySettings();
  app.hud.refreshMute();
  app.saveSettings();
  if ('keepAwake' in patch) updateWakeLock();
};

app.reducedMotion = () => document.documentElement.classList.contains('reduced-motion');

/** Petite vibration (téléphone), si l'option est active. */
app.vibrate = (pattern = 10) => {
  if (!settings.vibration || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* refusé par le navigateur (pas encore de geste) */
  }
};

// ── Application installée (PWA : src/pwa.js) ──────────────────────────────────────
app.isStandalone = () => pwa.isStandalone();
app.canInstall = () => pwa.canInstall() && !pwa.isStandalone();
app.installApp = async () => {
  const res = await pwa.promptInstall();
  if (res === 'accepted') app.dialogs.closeTop();
};
pwa.onInstallChange(() => {
  // Le bouton « Installer le jeu » du menu principal apparaît ou disparaît.
  if (app.inMenu && app.dialogs.top() === 'main-menu') app.dialogs.mainMenu();
});
pwa.onInstalled(() => app.toasts?.show({ kind: 'success', icon: 'star', text: 'Le jeu est installé : retrouvez-le sur l\'écran d\'accueil.' }));
pwa.onOfflineReady(() => app.toasts?.show({ kind: 'info', icon: 'info', text: 'Jeu disponible hors ligne.' }));
pwa.onUpdateAvailable(() => {
  app.toasts?.show({
    kind: 'info',
    icon: 'star',
    title: 'Nouvelle version disponible',
    text: 'Touchez ici pour recharger (la partie est sauvegardée).',
    duration: 60000,
    onClick: () => {
      save();
      pwa.applyUpdate();
    },
  });
});

/** Options → « Réparer le jeu » : service worker désinscrit, caches vidés, rechargement. */
app.repairGame = () => {
  save();
  return pwa.repairApp();
};

app.toggleMute = () => {
  app.updateSettings({ muted: !settings.muted });
  if (!settings.muted) audio.play('toggle');
};

app.toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
};

app.saveTutorial = (t) => storage.saveTutorial(t);
app.progress = () => app.progression.get();
app.isLevelUnlocked = (id) => app.progression.isLevelUnlocked(id);

app.resetProgress = () => {
  storage.resetProgress();
  app.progression.reload();
  uiMemo.write({});
  app.applyCosmetics();
  if (app.inMenu) app.dialogs.mainMenu();
};

// ── Petite mémoire de l'interface (succès déjà vus dans la grange) ────────────────
// Pas une donnée de jeu : si le stockage est indisponible, la pastille « nouveau » ne s'affiche
// simplement pas.
const uiMemo = {
  key: 'une-annee-a-la-ferme.ui',
  read() {
    try {
      const v = JSON.parse(window.localStorage.getItem(this.key) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  },
  write(v) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(v));
    } catch {
      /* stockage indisponible */
    }
  },
};
const doneAchievements = () => Object.keys(app.progression.get().achievements || {}).length;
app.hasNewAchievements = () => app.progression.available() && doneAchievements() > (uiMemo.read().achSeen ?? 0);
app.markAchievementsSeen = () => {
  const m = uiMemo.read();
  m.achSeen = doneAchievements();
  uiMemo.write(m);
};

// ── Personnalisation : la scène reçoit les choix du joueur (lot RENDER : scene.setCosmetics) ──
app.applyCosmetics = () => {
  const s = app.scene;
  if (!s || typeof s.setCosmetics !== 'function' || !app.progression.available()) return;
  const c = app.progression.cosmetics();
  try {
    s.setCosmetics({ farmName: c.farmName, outfit: c.outfit, path: c.path, fence: c.fence, decor: { ...c.decor } });
  } catch (err) {
    console.warn('setCosmetics :', err);
  }
};

/** Écran de fin d'année → grange (la partie est terminée : retour au menu, puis la grange). */
app.openGrangeFromEnd = (tab = 'bonus') => {
  app.quitToMenu({ ended: true });
  app.grange.open(tab);
};

/** Menu principal affiché : conseils de la grange et du décor (une fois pour toutes). */
app.onMainMenu = () => {
  const P = app.progression;
  if (!P.available()) return;
  if (P.canSpendStars()) app.hints.maybe('grange', { selector: '#menu-grange' });
  else if (P.ecus() >= 10) app.hints.maybe('decor', { selector: '#menu-grange' });
};
app.onProgressChange = () => {
  app.grange?.refresh();
};

// ── Écran allumé pendant la partie (Wake Lock, option) ─────────────────────────────
function updateWakeLock() {
  const want = !!(settings.keepAwake && !document.hidden && app.game && !app.inMenu && app.game.state.status === 'playing');
  pwa.setWakeLock(want).catch?.(() => {});
}
app.wakeLockSupported = () => pwa.isWakeLockSupported();

// ── Pause (fenêtres, tutoriel, onglet caché) ──────────────────────────────────────
app.pushPause = (reason) => {
  const g = app.game;
  if (!g || app.inMenu || g.state.status !== 'playing') return;
  if (pauseReasons.size === 0) resumeSpeed = g.state.speed;
  pauseReasons.add(reason);
  if (g.state.speed !== 0) g.actions.setSpeed(0);
  audio.setDuck(pauseReasons.has('pause') || pauseReasons.has('options'));
  scheduleRefresh();
};

app.popPause = (reason) => {
  if (!pauseReasons.delete(reason)) return;
  audio.setDuck(pauseReasons.has('pause') || pauseReasons.has('options'));
  const g = app.game;
  if (pauseReasons.size === 0 && g && g.state.status === 'playing') {
    g.actions.setSpeed(resumeSpeed);
    scheduleRefresh();
  }
};

/** Vitesse « réelle » de la partie (hors pauses automatiques), pour la sauvegarde. */
function effectiveSpeed() {
  const g = app.game;
  if (!g) return 1;
  return pauseReasons.size ? resumeSpeed : g.state.speed;
}

app.setSpeed = (speed, { fromUser = false } = {}) => {
  const g = app.game;
  if (!g || app.inMenu || g.state.status !== 'playing') return;
  if (fromUser) {
    // Un choix explicite du joueur lève la pause du tutoriel (pas celle d'une fenêtre ouverte).
    if (app.dialogs.isOpen()) return;
    pauseReasons.delete('tutorial');
    pauseReasons.delete('hidden');
    audio.play('toggle');
  }
  const res = g.actions.setSpeed(speed);
  if (res.ok) {
    if (speed > 0) {
      lastPlaySpeed = speed;
      if (fromUser && settings.speed !== speed) {
        settings.speed = speed;
        app.saveSettings();
      }
    }
    app.tutorial.onSpeed(speed);
    scheduleRefresh();
  }
};

app.openPauseMenu = () => {
  if (!app.game || app.inMenu || app.game.state.status !== 'playing') return;
  if (app.dialogs.top() === 'pause') return;
  app.sheets.close('silent');
  app.dialogs.pauseMenu();
};

// ── Onglets et feuilles ───────────────────────────────────────────────────────────
/** Onglet du bas : 'farm' | 'shop' | 'stats' | 'menu'. */
app.openTab = (id, { fromUser = false } = {}) => {
  if (!app.game || app.inMenu) return;
  if (id === 'menu') {
    app.openPauseMenu();
    return;
  }
  if (id === 'farm') {
    if (app.sheets.isOpen()) app.sheets.close();
    else if (fromUser) audio.play('click', { volume: 0.5 });
    if (typeof app.scene?.focusField === 'function') app.scene.focusField();
    app.tabbar.refresh();
    return;
  }
  if (fromUser && app.sheets.isOpen(id)) {
    app.sheets.close();
    return;
  }
  const lvl = app.game.level;
  if (id === 'shop') {
    app.sheets.open({ id: 'shop', kind: 'panel', tall: true, icon: icon('coin', 'md'), title: 'Acheter', content: app.panel.shopNode });
    app.panel.flush();
  } else if (id === 'stats') {
    app.sheets.open({ id: 'stats', kind: 'panel', tall: true, icon: icon('bill', 'md'), title: `Bilan · Niveau ${lvl.id}`, content: app.panel.statsNode });
    app.panel.showStats();
  }
};

app.onSheetChange = () => {
  app.tabbar?.refresh();
  requestAnimationFrame(() => app.toasts.trim?.());
  updateInsets();
  updateSheetOverlay();
};
app.onDecorChange = () => {
  insetsKey = '';
  updateInsets();
  app.tabbar?.refresh();
};
app.onDialogChange = () => {
  app.tabbar?.refresh();
  updateWakeLock();
};

/**
 * Feuille ouverte en portrait : la scène sait quelle hauteur est couverte en bas (elle peut alors
 * défiler au-delà du bas du monde) ; la parcelle visée par la feuille reste visible au-dessus.
 */
let revealIndex = null;
let revealDecor = null; // { id: emplacement | 'sign' | 'farmer', sheet: id de la feuille }
let revealInvestment = null; // { id: investissement, sheet: id de la feuille }
function updateSheetOverlay() {
  const s = app.scene;
  if (!s || typeof s.setOverlay !== 'function') return;
  // Mode décoration depuis le menu : la scène du menu est la ferme décorée, elle suit aussi la feuille.
  const open = app.sheets.isOpen() && !app.isWide() && (!app.inMenu || app.decor?.active);
  s.setOverlay(open ? app.sheets.box.offsetHeight : 0);
  if (!open) {
    revealIndex = null;
    revealDecor = null;
    revealInvestment = null;
    return;
  }
  const i = app.field.current?.index;
  if (revealIndex !== null && i === revealIndex) s.focusPlot(i, { margin: 14, animate: true });
  if (revealDecor && app.sheets.current === revealDecor.sheet && typeof s.focusDecorSlot === 'function') s.focusDecorSlot(revealDecor.id, { margin: 14 });
  if (revealInvestment && app.sheets.current === revealInvestment.sheet && typeof s.focusRect === 'function') {
    const id = revealInvestment.id;
    s.focusRect(s.layout.investmentRect?.(id, app.game?.state.investments[id] || 0), { margin: 14 });
  }
}

/** Fiche d'un bâtiment ou d'un enclos (atelier, poulailler…) : il reste visible au-dessus de la feuille. */
app.revealInvestment = (id, sheetId) => {
  const s = app.scene;
  if (!s || typeof s.focusRect !== 'function') return;
  revealInvestment = { id, sheet: sheetId };
  updateSheetOverlay();
};

/**
 * Mode décoration : l'emplacement touché (ou le panneau, ou le fermier) reste visible au-dessus de
 * sa feuille. À appeler juste après l'ouverture de la feuille `sheetId`.
 */
app.revealDecorSlot = (id, sheetId) => {
  const s = app.scene;
  if (!s || typeof s.focusDecorSlot !== 'function') return;
  revealDecor = { id, sheet: sheetId };
  updateSheetOverlay(); // setOverlay d'abord : la feuille est comptée dans la zone couverte
};

/** Fait défiler la scène (en douceur) pour que la parcelle reste visible au-dessus de la feuille. */
app.revealPlot = (index) => {
  const s = app.scene;
  if (!s || typeof s.focusPlot !== 'function') return;
  revealIndex = index;
  updateSheetOverlay();
  s.focusPlot(index, { margin: 14, animate: true });
};

// ── Actions du joueur ─────────────────────────────────────────────────────────────
function report(res) {
  if (res && !res.ok) {
    audio.play('error');
    app.toasts.show({ kind: 'error', text: res.reason });
  }
  return res;
}

app.plant = (i, cropId) => report(app.game?.actions.plant(i, cropId));
app.water = (i) => report(app.game?.actions.water(i));
app.harvest = (i) => report(app.game?.actions.harvest(i));
app.unlockPlot = (i) => report(app.game?.actions.unlockPlot(i));
app.buyInvestment = (id) => report(app.game?.actions.buyInvestment(id));
app.removeTree = (i) => (typeof app.game?.actions.removeTree === 'function' ? report(app.game.actions.removeTree(i)) : null);
/** Interrupteur « Transformer » d'un atelier. */
app.setProcessing = (id, on) => {
  const g = app.game;
  if (!g || typeof g.actions.setProcessing !== 'function') return null;
  const res = report(g.actions.setProcessing(id, on));
  if (res?.ok) {
    audio.play('toggle');
    app.vibrate(12);
  }
  return res;
};
/** « Vendre en l'état » : tout ce qui est en cours dans l'atelier, au prix de la matière première. */
app.sellProcessing = (id) => {
  const g = app.game;
  if (!g || typeof g.actions.sellProcessing !== 'function') return null;
  return report(g.actions.sellProcessing(id));
};

/** Sème la même culture sur la parcelle choisie puis sur toutes les parcelles libres. */
app.plantAll = (cropId, firstIndex) => {
  const g = app.game;
  if (!g) return 0;
  const first = g.actions.plant(firstIndex, cropId);
  if (!first.ok) {
    report(first);
    return 0;
  }
  let n = 1;
  const crop = getCrop(cropId);
  if (crop?.kind === 'tree') return n; // « Semer partout » ne plante jamais d'arbre
  for (const p of g.query.plots()) {
    if (p.action !== 'plant') continue;
    const res = g.actions.plant(p.index, cropId);
    if (!res.ok) break;
    n += 1;
  }
  if (n > 1) app.toasts.show({ kind: 'success', sprite: cropIcon(cropId, 'sprite--sm'), text: `${n} parcelles semées (${cropName(cropId).toLowerCase()}).` });
  return n;
};

// ── Géométrie de la scène ─────────────────────────────────────────────────────────
/** Partie de la scène vraiment visible (sous la barre du haut, au-dessus des onglets). */
app.stageRect = () => {
  const c = canvas.getBoundingClientRect();
  const top = app.safeTop();
  const bottom = app.safeBottom();
  return { left: c.left, right: c.right - insets.right, top, bottom, width: c.width - insets.right, height: bottom - top };
};
app.isWide = () => document.body.classList.contains('layout-wide');
/** Bas de la barre du haut (px de la page). */
app.safeTop = () => (app.inMenu ? 0 : insets.top);
/** Haut des onglets ou de la feuille ouverte (px de la page). */
app.safeBottom = () => {
  const vh = viewportHeight();
  let b = vh - (app.inMenu ? 0 : insets.bottom);
  if (app.sheets.isOpen() && !app.isWide()) b = Math.min(b, app.sheets.box.getBoundingClientRect().top);
  return b;
};
app.safeLeft = () => 0;

/** Rectangle d'une parcelle en pixels de la page. */
app.plotPageRect = (index) => {
  const scene = app.scene;
  const r = scene?.layout.plotRect(index);
  if (!r) return null;
  const s = canvas.getBoundingClientRect();
  const a = scene.worldToScreen(r.x, r.y);
  const b = scene.worldToScreen(r.x + r.w, r.y + r.h);
  return { left: s.left + a.x, top: s.top + a.y, right: s.left + b.x, bottom: s.top + b.y, width: b.x - a.x, height: b.y - a.y };
};

/** Rectangle du champ clôturé en pixels de la page (placement des bulles du tutoriel). */
app.fieldPageRect = () => {
  const f = app.scene?.layout.field;
  if (!f) return null;
  const T = app.scene.layout.TILE;
  const s = canvas.getBoundingClientRect();
  const a = app.scene.worldToScreen(f.fence.x * T, f.fence.y * T);
  const b = app.scene.worldToScreen((f.fence.x + f.fence.w) * T, (f.fence.y + f.fence.h) * T);
  return { left: s.left + a.x, top: s.top + a.y, right: s.left + b.x, bottom: s.top + b.y, width: b.x - a.x, height: b.y - a.y };
};

/** Rectangle d'un bâtiment (investissement) en pixels de la page, ou null. */
app.investmentPageRect = (id) => {
  const scene = app.scene;
  const r = scene?.layout.investmentRect?.(id, app.game?.state.investments[id] || 0);
  if (!r) return null;
  const s = canvas.getBoundingClientRect();
  const a = scene.worldToScreen(r.x, r.y);
  const b = scene.worldToScreen(r.x + r.w, r.y + r.h);
  return { left: s.left + a.x, top: s.top + a.y, right: s.left + b.x, bottom: s.top + b.y, width: b.x - a.x, height: b.y - a.y };
};

function worldToPage(wx, wy) {
  const s = canvas.getBoundingClientRect();
  const p = app.scene.worldToScreen(wx, wy);
  return { x: s.left + p.x, y: s.top + p.y };
}

let currentMinZoom = 0;
function wantedMinZoom(w, h, dpr) {
  // Zoom ×2 minimum tant qu'on voit au moins les trois quarts du monde (512 × 320 px) ;
  // en dessous (très petite fenêtre), zoom ×1 pour tout montrer.
  return w * dpr >= 768 && h * dpr >= 480 ? 2 : 1;
}

function viewportHeight() {
  return Math.round(window.visualViewport?.height || window.innerHeight);
}

// Zones de l'écran couvertes par l'interface (px CSS), transmises à la scène.
const insets = { top: 0, bottom: 0, left: 0, right: 0 };
let insetsKey = '';
function updateInsets() {
  const inGame = !!app.game && !app.inMenu;
  // Tailles sans les transformations (la barre glisse à l'entrée en partie).
  const hudH = $('#hud').offsetHeight;
  const tabH = $('#tabbar').offsetHeight;
  // Mode décoration depuis le menu : la barre de décoration remplace les onglets.
  const decorH = app.decor?.active && app.inMenu ? $('#decorbar')?.offsetHeight || 0 : 0;
  insets.top = inGame ? hudH : 0;
  insets.bottom = inGame && !app.isWide() ? tabH : decorH && !app.isWide() ? decorH : 0;
  insets.left = 0;
  // Grand écran : le panneau rangé à droite (achats, bilan) réduit la scène visible.
  insets.right = inGame && app.isWide() && app.sheets.isOpen() ? Math.round(app.sheets.box.getBoundingClientRect().width) : 0;
  const key = `${insets.top},${insets.bottom},${insets.left},${insets.right}`;
  if (key === insetsKey) return;
  insetsKey = key;
  document.documentElement.style.setProperty('--inset-top', `${insets.top}px`);
  document.documentElement.style.setProperty('--inset-bottom', `${insets.bottom}px`);
  if (typeof app.scene?.setInsets === 'function') app.scene.setInsets({ ...insets });
  app.tutorial.relayout();
}

function resizeScene() {
  if (!images) return;
  const r = stage.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  const dpr = window.devicePixelRatio || 1;
  const mz = wantedMinZoom(w, h, dpr);
  if (!app.scene || mz !== currentMinZoom) {
    currentMinZoom = mz;
    const level = (app.game && !app.inMenu ? app.game : attract)?.level || getLevel(1);
    app.scene = createScene(canvas, images, level, { minZoom: mz });
    insetsKey = '';
    app.applyCosmetics();
    if (app.decor.active && typeof app.scene.setDecorMode === 'function') app.scene.setDecorMode(true);
  }
  app.scene.resize(w, h, dpr);
  updateInsets();
  app.tutorial.relayout();
}

// Taille réelle de l'écran : Chrome Android affiche ou cache sa barre d'adresse, le clavier…
function applyViewport() {
  const vv = window.visualViewport;
  const h = viewportHeight();
  document.documentElement.style.setProperty('--app-h', `${h}px`);
  // Téléphone tenu à l'horizontale : invitation à le tourner (pas sur ordinateur ni tablette).
  const w = window.innerWidth;
  const landscapePhone = app.isTouch && w > h && h < 520;
  document.body.classList.toggle('is-rotated', landscapePhone);
  if (landscapePhone) app.pushPause('rotate');
  else app.popPause('rotate');
  const wide = !landscapePhone && w >= 900 && w > h * 1.1;
  if (wide !== document.body.classList.contains('layout-wide')) {
    document.body.classList.toggle('layout-wide', wide);
    // Grand écran : les onglets rejoignent la barre du haut ; sinon, ils restent en bas.
    const tabbar = $('#tabbar');
    if (wide) $('.hud-row')?.append(tabbar);
    else document.body.insertBefore(tabbar, $('#sheet-layer'));
    app.sheets?.refit();
  }
  if (vv && (vv.offsetTop || vv.offsetLeft) && vv.scale <= 1.01) window.scrollTo(0, 0);
}

new ResizeObserver(() => resizeScene()).observe(stage);
new ResizeObserver(() => updateInsets()).observe($('#hud'));
new ResizeObserver(() => updateInsets()).observe($('#tabbar'));
window.addEventListener('resize', () => {
  applyViewport();
  resizeScene();
});
window.visualViewport?.addEventListener('resize', () => {
  applyViewport();
  resizeScene();
});
window.addEventListener('orientationchange', () => setTimeout(() => {
  applyViewport();
  resizeScene();
}, 150));
applyViewport();

// Changement de densité de pixels sans changement de taille (fenêtre glissée sur un autre écran,
// zoom du navigateur sur certains systèmes) : la requête média est réinstallée à chaque fois.
function watchDpr() {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const onChange = () => {
    mq.removeEventListener?.('change', onChange);
    resizeScene();
    watchDpr();
  };
  mq.addEventListener?.('change', onChange);
}
watchDpr();

// ── Survol à la souris (infobulles de la scène) ───────────────────────────────────
// Les gestes (toucher, glisser, appui long, molette) sont dans src/ui/gestures.js.
function sameHit(a, b) {
  if (!a || !b) return a === b;
  return a.type === b.type && a.index === b.index && a.id === b.id;
}

function updateHoverTip() {
  const h = hover.hit;
  if (!h || app.dialogs.isOpen() || app.field.isOpen() || (app.decor.active && app.sheets.isOpen())) {
    app.tooltip.hide('scene');
    return;
  }
  const content = app.decor.active ? app.decor.hoverText(h) : h.type === 'plot' ? app.field.plotTip(h.index) : app.field.investmentTip(h.id);
  if (content) app.tooltip.showAtPoint(content, hover.x, hover.y, 'scene');
  else app.tooltip.hide('scene');
}

app.onSceneHover = (hit, e) => {
  const changed = !sameHit(hit, hover.hit);
  hover = { hit, x: e.clientX, y: e.clientY };
  if (changed) {
    app.scene?.setHover(hit);
    let pointer = false;
    if (app.decor.active) pointer = !!hit && ['decorSlot', 'sign', 'farmer'].includes(hit.type);
    else if (hit?.type === 'plot') pointer = !!app.game?.query.plot(hit.index)?.action;
    else if (hit?.type === 'investment') pointer = true;
    canvas.style.cursor = pointer ? 'pointer' : '';
  }
  updateHoverTip();
};

// Pas de menu contextuel ni de sélection sur appui long dans le jeu (sauf champs de saisie).
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest?.('input, textarea, a')) e.preventDefault();
});
// Pincement / double toucher : pas de zoom de la page (Safari ignore user-scalable=no).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// Sons de survol des boutons (discrets).
let lastHoverBtn = null;
document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const b = e.target.closest?.('.btn, .hud-cell, .hud-speed, .level-card, .tabbar-btn, .seed-row, .opt-toggle');
  if (b === lastHoverBtn) return;
  lastHoverBtn = b;
  if (b && !b.classList.contains('is-disabled')) audio.play('hover', { volume: 0.6 });
});

// ── Clavier ───────────────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('is-loading')) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' && e.target.type !== 'range') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (app.decor.active && app.decor.onKey(e)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (app.dialogs.isOpen()) {
      app.dialogs.closeTop();
      return;
    }
    if (app.sheets.isOpen()) return app.sheets.close('escape');
    if (!app.inMenu && app.game) app.openPauseMenu();
    return;
  }
  if (app.field.isOpen() && app.field.onKey(e)) {
    e.preventDefault();
    return;
  }
  if (app.inMenu || !app.game || app.dialogs.isOpen()) return;
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    const g = app.game;
    app.setSpeed(g.state.speed === 0 ? lastPlaySpeed || 1 : 0, { fromUser: true });
  } else if (e.key === '1') app.setSpeed(1, { fromUser: true });
  else if (e.key === '2') app.setSpeed(2, { fromUser: true });
  else if (e.key === '3') app.setSpeed(4, { fromUser: true });
  else if (e.key === 'm' || e.key === 'M') app.toggleMute();
  else if (e.key === 'b' || e.key === 'B') app.openTab('shop', { fromUser: true });
  else if (e.key === 'n' || e.key === 'N') app.openTab('stats', { fromUser: true });
  else if (e.key === 'f' || e.key === 'F') app.openTab('farm', { fromUser: true });
  else if ((e.key === 'd' || e.key === 'D') && app.decor.available() && !app.decor.active) app.decor.enter();
});

// ── Événements du jeu ─────────────────────────────────────────────────────────────
let refreshQueued = false;
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    app.hud.refresh();
    if (hover.hit && app.tooltip.owner === 'scene') updateHoverTip();
  });
}

function wire(game) {
  const off = game.on('*', (ev) => {
    app.scene?.onEvent(ev.type, ev);
    app.hud.onEvent(ev);
    app.panel.onEvent(ev);
    app.field.onEvent(ev);
    app.tutorial.onEvent(ev);
    reactAudio(ev, game);
    reactMessages(ev, game);
    switch (ev.type) {
      case 'dawn':
        save();
        break;
      case 'billPaid':
        pending.billPaid = ev;
        break;
      case 'frost':
        pending.frost = ev;
        break;
      case 'bankrupt':
      case 'victory':
        pending.end = ev;
        break;
      case 'contestAwarded':
        pending.contest = ev;
        break;
      case 'purchased':
        if (isProcessing(game.query.investments().find((i) => i.id === ev.investmentId)) && ev.owned === 1 && app.hints.maybe('processingBought', { selector: '#bld-switch' })) {
          // Premier atelier : sa fiche s'ouvre, le conseil vise son interrupteur.
          app.field.openBuilding(ev.investmentId);
        }
        queueAchievementCheck(game);
        break;
      case 'harvested':
        queueAchievementCheck(game);
        break;
      default:
        break;
    }
    if (ev.type === 'dawn') app.progression.checkGame(game);
    scheduleRefresh();
  });
  return off;
}

// Succès vérifiés à chaque aube, et un peu après un achat ou une récolte (une fois par image).
let achQueued = false;
function queueAchievementCheck(game) {
  if (achQueued) return;
  achQueued = true;
  requestAnimationFrame(() => {
    achQueued = false;
    if (app.game === game && game.state.status === 'playing') app.progression.checkGame(game);
  });
}

// Messages groupés : les récoltes parties à l'atelier (un glissé peut en envoyer plusieurs) et
// les produits vendus à l'aube font un seul message par image.
const grouped = { toWorkshop: new Map(), sold: [] };
function flushGrouped() {
  const t = app.toasts;
  if (grouped.toWorkshop.size) {
    for (const [productId, n] of grouped.toWorkshop) {
      t.show({ kind: 'success', sprite: productIcon(productId, 'sprite--sm'), text: n > 1 ? `${n} récoltes parties à l'atelier (${productName(productId).toLowerCase()}).` : `Récolte partie à l'atelier : ${productName(productId).toLowerCase()} en préparation.`, duration: 2600 });
    }
    grouped.toWorkshop.clear();
  }
  if (grouped.sold.length) {
    const total = grouped.sold.reduce((a, x) => a + (x.amount || 0), 0);
    const n = grouped.sold.length;
    const first = grouped.sold[0].productId;
    const names = [...new Set(grouped.sold.map((x) => productName(x.productId).toLowerCase()))];
    t.show({ kind: 'money', sprite: productIcon(first, 'sprite--sm'), title: n > 1 ? `${n} produits vendus` : 'Produit vendu', text: `${names.join(', ')} : +${fmt(total)} pièces`, duration: 3400 });
    grouped.sold = [];
  }
}

function reactAudio(ev, game) {
  switch (ev.type) {
    case 'planted':
      audio.play('plant');
      break;
    case 'watered':
      audio.play('water');
      break;
    case 'harvested':
      audio.play('harvest');
      if (!ev.processed) audio.play('coin', { delay: 0.06 });
      else audio.play('build', { delay: 0.08, volume: 0.45 });
      break;
    case 'productSold':
      audio.play('coin', { delay: 0.5, volume: 0.7 });
      break;
    case 'processingSoldRaw':
      audio.play('coin');
      break;
    case 'treeRemoved':
      audio.play('dig');
      break;
    case 'contestProgress':
      if (ev.done) audio.play('unlock', { volume: 0.7 });
      break;
    case 'purchased':
      audio.play('buy');
      audio.play('build', { delay: 0.25 });
      updateAmbience(game);
      break;
    case 'plotUnlocked':
      audio.play('dig');
      audio.play('buy', { delay: 0.15 });
      break;
    case 'dawn':
      audio.play('rooster', { pitch: 0.03 });
      if (ev.incomes?.some((i) => i.amount > 0)) audio.play('coin', { delay: 0.4, volume: 0.6 });
      break;
    case 'seasonStart':
      audio.playMusic(ev.seasonId);
      break;
    case 'seasonWarning':
      audio.play('warning');
      break;
    case 'frost':
      audio.play('frost');
      audio.play('frostJingle', { delay: 0.35, pitch: 0 });
      break;
    case 'rot':
      audio.play('rot');
      break;
    case 'weather':
      updateAmbience(game);
      break;
    case 'billPaid':
      if (ev.seasonId !== 'winter') audio.play('seasonEnd', { pitch: 0 });
      break;
    case 'bankrupt':
      audio.playMusic(null, { fade: 1 });
      audio.setAmbience({});
      audio.play('bankrupt', { pitch: 0, delay: 0.3 });
      break;
    case 'victory':
      audio.playMusic(null, { fade: 0.8 });
      audio.play('victory', { pitch: 0, delay: 0.2 });
      setTimeout(() => {
        if (app.game === game && game.state.status === 'victory') audio.playMusic('victory', { fade: 0.3 });
      }, 2600);
      break;
    default:
      break;
  }
}

function reactMessages(ev, game) {
  const t = app.toasts;
  switch (ev.type) {
    case 'seasonStart': {
      const bill = game.query.finance().nextBill;
      const banner = { kind: 'season', icon: ev.seasonId, title: season(ev.seasonId), text: `Fermage ${season(ev.seasonId, 'of')} : ${fmt(bill.amount)} pièces dans ${plural(bill.daysLeft + 1, 'jour')}` };
      queuedBanner = banner; // montré après le bilan de fin de saison
      break;
    }
    case 'seasonWarning': {
      // Cultures fragiles qui seront encore au champ au premier matin d'hiver (mûres ou non).
      const freezing = ev.frost ? game.query.plots().filter((p) => p.cropId && !frostHardy(p.cropId) && (p.willFreeze || p.mature)).length : 0;
      app.toasts.banner({
        kind: ev.frost ? 'frost' : 'warn',
        icon: ev.frost ? 'winter' : ev.nextSeasonId,
        title: `${seasonArrives(ev.nextSeasonId)} dans ${plural(ev.daysLeft, 'jour')}`,
        text: ev.frost
          ? freezing
            ? `${plural(freezing, 'culture')} ${freezing > 1 ? 'vont' : 'va'} geler : récoltez avant l'hiver !`
            : 'Au premier matin, les cultures fragiles gèleront.'
          : `Fermage ${season(game.query.calendar().seasonId, 'of')} : ${fmt(game.query.finance().nextBill.amount)} pièces`,
        duration: 5200,
      });
      break;
    }
    case 'frost': {
      const n = (ev.lost || ev.lostPlots || []).length;
      if (n) t.show({ kind: 'frost', icon: 'winter', title: 'Gel', text: `Le gel a détruit ${plural(n, 'culture')}.`, duration: 5000 });
      break;
    }
    case 'rot':
      t.show({ kind: 'rot', icon: 'rain', text: `${cropName(ev.cropId)} : la culture a pourri sous la pluie.`, duration: 4200 });
      break;
    case 'purchased': {
      const inv = getInvestment(ev.investmentId);
      const q = game.query.investments().find((i) => i.id === ev.investmentId);
      let what = '';
      if (inv.effects.waterPlots) what = 'Vos cultures seront arrosées chaque matin.';
      else if (inv.effects.chargeReduction) what = `Vos charges baissent de ${inv.effects.chargeReduction} par jour.`;
      else if (inv.effects.shearing) what = `Tonte : +${inv.effects.shearing} à la fin de chaque saison (sauf l'hiver).`;
      else if (q?.income || Object.values(q?.incomeBySeason || {}).some(Boolean)) what = `${incomePhrase(q.incomeBySeason)}.`;
      t.show({ kind: 'success', sprite: investmentIcon(ev.investmentId, 'sprite--sm'), title: inv.kind === 'upgrade' ? `${inv.name} : niveau ${ev.owned}` : `${inv.name} acheté${['beehive', 'guestHouse', 'cow', 'goat', 'dairy'].includes(inv.id) ? 'e' : ''} !`, text: what });
      break;
    }
    case 'harvested':
      if (ev.fatigue) t.show({ kind: 'warn', icon: 'info', text: 'Sol fatigué : même culture que la dernière fois, récolte réduite.' });
      if (ev.processed) grouped.toWorkshop.set(ev.processed.productId, (grouped.toWorkshop.get(ev.processed.productId) || 0) + 1);
      break;
    case 'productSold':
      grouped.sold.push(ev);
      break;
    case 'processingSoldRaw': {
      const texts = {
        player: `Produits vendus en l'état : +${fmt(ev.amount)} pièces.`,
        rent: `L'argent manquait : ${plural(ev.count, 'produit')} vendu${ev.count > 1 ? 's' : ''} en l'état avant le fermage (+${fmt(ev.amount)}).`,
        yearEnd: `Fin de l'année : ${plural(ev.count, 'produit')} en cours vendu${ev.count > 1 ? 's' : ''} en l'état (+${fmt(ev.amount)}).`,
      };
      t.show({ kind: ev.reason === 'player' ? 'money' : 'warn', icon: 'coin', text: texts[ev.reason] || texts.player, duration: 4200 });
      break;
    }
    case 'processingToggled':
      t.show({ kind: 'info', icon: 'info', text: ev.on ? 'Atelier allumé : les récoltes compatibles y partiront.' : 'Atelier éteint : tout se vend comme d\'habitude.', duration: 2400 });
      break;
    case 'treeRemoved':
      t.show({ kind: 'info', icon: 'seed', text: 'Pommier arraché : la parcelle est libre.' });
      break;
    case 'contestProgress':
      if (ev.done) {
        const goal = game.query.contest?.()?.goals.find((x) => x.id === ev.goalId);
        t.show({ kind: 'success', icon: 'star', title: 'Épreuve réussie !', text: `${goal?.label || 'Concours'} : ${fmt(ev.progress)} / ${fmt(ev.target)}. Prix au jugement.`, duration: 4200 });
      }
      break;
    case 'dawn': {
      for (const inc of ev.incomes || []) {
        if (inc.kind === 'shearing') t.show({ kind: 'money', icon: 'coin', title: 'Tonte des moutons', text: `+${fmt(inc.amount)} pièces` });
      }
      for (const inc of ev.incomes || []) {
        if (inc.kind === 'refund' && inc.amount > 0) t.show({ kind: 'money', icon: 'winter', title: 'Assurance gel', text: `Graines remboursées : +${fmt(inc.amount)} pièces` });
      }
      const loan = (ev.chargesDetail || []).find((c) => c.source === 'loan');
      if (loan) t.show({ kind: 'warn', icon: 'bill', title: 'Mensualité du prêt', text: `−${fmt(loan.amount)} pièces` });
      if (game.state.money < 0) t.show({ kind: 'error', icon: 'coin', text: 'Vous êtes à découvert : récoltez vite !' });
      break;
    }
    default:
      break;
  }
}

function frostHardy(cropId) {
  return !!getCrop(cropId)?.frostHardy;
}

/** Fenêtres de fin de saison / de partie, après le traitement complet d'une journée. */
function processPending() {
  const g = app.game;
  if (!g) return;
  flushGrouped();
  if (pending.end) {
    const ev = pending.end;
    pending = { billPaid: null, frost: null, end: null, contest: null };
    queuedBanner = null;
    app.sheets.close('silent');
    app.tooltip.hide();
    app.hints.clear();
    if (app.decor.active) app.decor.exit();
    pauseReasons.clear();
    updateWakeLock();
    const rec = recordEnd(g, ev.type === 'victory' ? 'victory' : 'bankrupt', ev);
    storage.clearRun();
    if (ev.type === 'victory') app.dialogs.victory(ev, rec);
    else app.dialogs.bankrupt(ev, rec);
    return;
  }
  // Concours (niveau 12) : la remise des prix passe avant le bilan de fin d'automne.
  if (pending.contest && !app.dialogs.isOpen()) {
    const ev = pending.contest;
    pending.contest = null;
    app.sheets.close('silent');
    app.dialogs.contestResult(ev, { onClose: () => processPending() });
    return;
  }
  if (pending.billPaid && app.dialogs.top() === 'contest') return;
  if (pending.billPaid) {
    const ev = pending.billPaid;
    const frost = pending.frost;
    pending.billPaid = null;
    pending.frost = null;
    // Le bandeau de la nouvelle saison s'affiche quand on referme le bilan.
    app.dialogs.seasonEnd(ev, {
      frost,
      onClose: () => {
        if (queuedBanner) app.toasts.banner(queuedBanner);
        queuedBanner = null;
      },
    });
    return;
  }
  if (pending.frost) pending.frost = null;
  if (queuedBanner && !app.dialogs.isOpen()) {
    app.toasts.banner(queuedBanner);
    queuedBanner = null;
  }
}

/**
 * Fin de partie (victoire, faillite, abandon) : cumul, écus, étoiles, succès (progression.js).
 * Sans le module de progression v3 : seule la victoire est notée (jeu v2).
 */
function recordEnd(game, outcome, ev = null) {
  let summary = ev?.summary;
  if (!summary) {
    try {
      summary = game.query.summary();
    } catch {
      summary = null;
    }
  }
  // Contexte de la partie pour les succès de fin d'année (arbres adultes, investissements…).
  let ctx = {};
  try {
    if (typeof game.query.achievementContext === 'function') ctx = game.query.achievementContext() || {};
  } catch {
    ctx = {};
  }
  return app.progression.recordRunEnd({
    levelId: game.level.id,
    outcome,
    stars: outcome === 'victory' ? ev?.stars || 0 : 0,
    money: ev?.money ?? game.state.money,
    summary,
    perksActive: Object.keys(game.state.perks || {}).length > 0,
    adultTrees: ctx.adultTrees,
    investments: ctx.investments,
    availableInvestments: ctx.availableInvestments,
    dailyCharges: ctx.dailyCharges,
  });
}

/** Une partie en cours est abandonnée (« Recommencer », ou nouvelle partie par-dessus) : cumul. */
function recordAbandon(game) {
  if (!game || game.state.status !== 'playing' || !app.progression.available()) return;
  try {
    recordEnd(game, 'abandon');
  } catch (err) {
    console.warn('Abandon non enregistré :', err);
  }
}

function updateAmbience(game) {
  if (!game || app.inMenu) {
    audio.setAmbience({});
    return;
  }
  const c = game.query.calendar();
  const owned = game.state.investments;
  audio.setAmbience(ambienceFor({ season: c.seasonId, weather: game.state.weather.today, owned }));
  audio.setWorld({ active: true, owned, season: c.seasonId, weather: game.state.weather.today });
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────────
function save() {
  const g = app.game;
  if (!g || app.inMenu || g.state.status !== 'playing') return;
  const data = g.serialize();
  data.speed = effectiveSpeed();
  const c = g.query.calendar();
  storage.saveRun(data, { levelId: g.level.id, levelName: g.level.name, day: c.day, seasonId: c.seasonId, money: g.state.money });
}

app.savedRunInfo = () => {
  const data = storage.loadRun();
  if (!data || data.state?.status !== 'playing') return null;
  const lvl = getLevel(data.state.levelId);
  if (!lvl) return null;
  try {
    loadGame(data.state); // sauvegarde abîmée ou d'une ancienne version : pas de « Continuer »
  } catch (err) {
    console.info('Sauvegarde ignorée :', err.message);
    storage.clearRun();
    return null;
  }
  const sid = SEASONS[data.state.time?.seasonIndex] || 'spring';
  return {
    levelId: lvl.id,
    label: `Niveau ${lvl.id} · Jour ${data.state.time?.day ?? 1} · ${season(sid)}`,
    data,
  };
};

window.addEventListener('beforeunload', () => save());
// Appli en arrière-plan (téléphone : bouton accueil, écran verrouillé) : sauvegarde, pause,
// son coupé (audio.js suspend le contexte) ; au retour, le menu de pause attend le joueur.
function onBackground() {
  save();
  app.input.cancel();
  if (app.game && !app.inMenu && app.game.state.status === 'playing' && !app.dialogs.isOpen()) app.openPauseMenu();
  updateWakeLock();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onBackground();
  else {
    lastT = null;
    updateWakeLock();
  }
});
window.addEventListener('pagehide', () => save());
document.addEventListener('freeze', () => save());

// ── Parties ───────────────────────────────────────────────────────────────────────
function startRun(game, { resumed = false } = {}) {
  if (unwire) unwire();
  if (app.decor.active) app.decor.exit();
  app.tutorial.stop();
  app.hints.clear();
  pauseReasons.clear();
  pending = { billPaid: null, frost: null, end: null, contest: null };
  grouped.toWorkshop.clear();
  grouped.sold = [];
  queuedBanner = null;
  app.dialogs.closeAll();
  app.toasts.clearAll();
  app.sheets.close('silent');
  app.input.cancel();
  app.tooltip.hide();

  app.game = game;
  app.inMenu = false;
  if (DEBUG) window.__game = game;
  document.body.classList.remove('in-menu');
  document.body.classList.add('in-game');

  app.hud.bind(game);
  app.panel.bind(game);
  unwire = wire(game);
  resizeScene();
  if (typeof app.scene?.focusField === 'function') app.scene.focusField();

  if (!resumed) game.actions.setSpeed(1);
  else if (game.state.speed > 0) lastPlaySpeed = game.state.speed;

  const c = game.query.calendar();
  audio.playMusic(c.seasonId);
  updateAmbience(game);

  const lvl = game.level;
  const farm = app.progression.available() ? `${app.progression.farmName()} · ` : '';
  if (resumed) {
    app.toasts.show({ kind: 'info', icon: 'calendar', text: `Partie reprise : jour ${c.day}, ${season(c.seasonId).toLowerCase()}.` });
  } else if (lvl.contest) {
    app.toasts.banner({ kind: 'season', icon: c.seasonId, title: `${lvl.name}`, text: `${farm}Niveau ${lvl.id} · jugement le soir du ${lvl.contest.deadlineDay}ᵉ jour`, duration: 4800 });
  } else {
    app.toasts.banner({ kind: 'season', icon: c.seasonId, title: `${lvl.name}`, text: `${farm}Niveau ${lvl.id} · ${season(c.seasonId)}, jour 1`, duration: 3800 });
  }

  const tuto = storage.loadTutorial();
  if (lvl.tutorial && !tuto.done) app.tutorial.start(game, resumed ? tuto.step ?? 0 : 0);

  // Conseils « première fois » (une fois pour toutes, après le tutoriel s'il y en a un).
  const offered = new Set(lvl.availableInvestments || []);
  const invs = game.query.investments();
  if (invs.some(isProcessing)) app.hints.maybe('processing', { selector: '#tab-shop' });
  if (offered.has('goat')) app.hints.maybe('goat', { selector: '#tab-shop' });
  if (lvl.modifiers?.pollination) app.hints.maybe('pollination', { selector: '#tab-shop' });
  if (lvl.contest) app.hints.maybe('contest', { selector: '#tab-stats' });

  save();
  scheduleRefresh();
  updateWakeLock();
  if (pwa.isStandalone()) pwa.lockPortrait();
  app.tabbar.refresh();
}

app.startLevel = async (levelId, { skipConfirm = false } = {}) => {
  const saved = app.savedRunInfo();
  const inGame = app.game && !app.inMenu && app.game.state.status === 'playing';
  if (!skipConfirm && saved && !inGame) {
    const ok = await app.dialogs.confirm({
      title: 'Nouvelle année ?',
      text: `Une partie est en cours (${saved.label}). Commencer une nouvelle année l'effacera.`,
      ok: 'Commencer',
    });
    if (!ok) return;
  }
  // La partie en cours (ou sauvegardée) est abandonnée : ses chiffres vont au cumul.
  if (inGame) recordAbandon(app.game);
  else if (saved) {
    try {
      recordAbandon(loadGame(saved.data.state));
    } catch {
      /* sauvegarde illisible : rien à compter */
    }
  }
  storage.clearRun();
  // Bonus permanents copiés dans la partie au lancement ({} si l'interrupteur est éteint).
  const perks = app.progression.runPerks();
  const game = createGame({ levelId, seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, perks });
  startRun(game);
};

app.continueRun = () => {
  const saved = app.savedRunInfo();
  if (!saved) return app.dialogs.mainMenu();
  let game;
  try {
    game = loadGame(saved.data.state);
  } catch (err) {
    console.warn('Sauvegarde illisible :', err);
    storage.clearRun();
    audio.play('error');
    app.toasts.show({ kind: 'error', text: 'La sauvegarde est illisible : elle a été effacée.' });
    app.dialogs.mainMenu();
    return;
  }
  try {
    startRun(game, { resumed: true });
  } catch (err) {
    // Sauvegarde cohérente pour le cœur mais inutilisable par l'interface : on repart du menu.
    console.warn('Reprise impossible :', err);
    storage.clearRun();
    app.quitToMenu({ ended: true });
    app.toasts.show({ kind: 'error', text: 'La sauvegarde est illisible : elle a été effacée.' });
  }
};

app.restartLevel = () => {
  if (!app.game) return;
  app.startLevel(app.game.level.id, { skipConfirm: true });
};
app.onStarsEarned = () => {
  /* une étoile gagnée par un succès : la pastille du menu la montrera au retour */
};

app.quitToMenu = ({ ended = false } = {}) => {
  if (!ended) save();
  if (app.decor.active) app.decor.exit();
  app.hints.clear();
  app.tutorial.stop();
  if (unwire) unwire();
  unwire = null;
  pauseReasons.clear();
  audio.setDuck(false);
  app.game = null;
  app.inMenu = true;
  if (DEBUG) window.__game = null;
  app.toasts.clearAll();
  app.sheets.close('silent');
  app.input.cancel();
  app.tooltip.hide();
  hover.hit = null;
  updateWakeLock();
  document.body.classList.remove('in-game');
  document.body.classList.add('in-menu');
  attract = createAttractGame();
  resizeScene();
  audio.playMusic('menu');
  audio.setAmbience({});
  audio.setWorld({ active: false });
  app.dialogs.mainMenu();
};

// ── Ferme de démonstration (fond du menu) ─────────────────────────────────────────
function createAttractGame() {
  const g = createGame({ levelId: 1, seed: 20260929 });
  const tend = () => {
    for (const p of g.query.plots()) {
      if (p.action === 'harvest') g.actions.harvest(p.index);
    }
    const crops = g.query.plantableCrops();
    const crop = crops.find((c) => !c.willFreeze && c.canAfford) || crops[0];
    for (const p of g.query.plots()) {
      if (p.action === 'plant' && crop && g.state.money > 30) g.actions.plant(p.index, crop.id);
    }
    for (const p of g.query.plots()) if (p.action === 'water') g.actions.water(p.index);
    const inv = g.query.investments().find((i) => i.canBuy && g.state.money - i.nextCost > 60);
    if (inv) g.actions.buyInvestment(inv.id);
  };
  tend();
  g.on('dawn', tend);
  g.actions.setSpeed(2);
  return g;
}

// ── Boucle ────────────────────────────────────────────────────────────────────────
let lastT = null;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  if (!app.scene) return;
  let g = null;
  if (app.game && !app.inMenu) {
    g = app.game;
    if (!document.hidden) g.update(dt);
    processPending();
  } else if (attract) {
    g = attract;
    g.update(dt);
    if (g.state.status !== 'playing') attract = createAttractGame();
  }
  if (g) app.scene.render(g, t);
  // Lectures de mise en page (tutoriel) avant les écritures de style (HUD) : pas de reflow forcé.
  app.tutorial.frame();
  app.hints.frame();
  app.hud.frame(dt);
}

// ── Chargement ────────────────────────────────────────────────────────────────────
async function boot() {
  const loading = $('#loading');
  const fill = $('.loading-fill', loading);
  const gauge = $('.loading-gauge', loading);
  const text = $('.loading-text', loading);
  const startBtn = $('.loading-start', loading);
  const errBox = $('.loading-error', loading);

  // La jauge est tenue par le chargeur de index.html (window.__bootProgress) : il y a déjà
  // compté le téléchargement du jeu lui-même ; ici, la suite (images, police, premiers sons).
  const parts = { images: 0, ui: 0, font: 0, audio: 0 };
  const weights = { images: 0.45, ui: 0.25, font: 0.15, audio: 0.15 };
  const paint = () => {
    const v = Object.entries(parts).reduce((s, [k, p]) => s + p * weights[k], 0);
    if (typeof window.__bootProgress === 'function') window.__bootProgress(v);
    else {
      fill.style.transform = `scaleX(${v.toFixed(3)})`;
      gauge.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    }
  };
  paint();

  const uiImages = [
    'assets/sprites/ui/icons.png',
    'assets/sprites/ui/panel-parchment.png',
    'assets/sprites/ui/panel-parchment-ornate.png',
    'assets/sprites/ui/panel-wood.png',
    'assets/sprites/ui/slot-wood.png',
    'assets/sprites/ui/slot-parchment.png',
    'assets/sprites/ui/button-red.png',
    'assets/sprites/ui/button-slate.png',
    'assets/sprites/ui/banner-red-ribbon.png',
    'assets/sprites/ui/banner-red.png',
    'assets/sprites/ui/panel-slate.png',
    'assets/sprites/ui/checkbox-on.png',
    'assets/sprites/ui/checkbox-off.png',
  ];

  // Sons attendus avant « Commencer » : seulement les petits bruits de l'écran d'accueil et du
  // menu (quelques Ko), et jamais plus de 4 s. Musiques, ambiances et autres effets se
  // téléchargent ensuite en fond (la musique du menu démarre dès qu'elle est arrivée).
  const bootSounds = ['confirm', 'click', 'open', 'close', 'page', 'toggle'].map((k) => AUDIO.sfx[k]).filter(Boolean);
  const soundsReady = Promise.race([
    audio.prefetch(bootSounds, (done, total) => {
      parts.audio = done / total;
      paint();
    }),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]).then(() => {
    parts.audio = 1;
    paint();
  });

  try {
    let uiDone = 0;
    const tasks = [
      loadImages(SHEETS).then((imgs) => {
        parts.images = 1;
        paint();
        return imgs;
      }),
      Promise.all(
        uiImages.map((src) =>
          loadImage(src)
            .catch(() => null)
            .finally(() => {
              parts.ui = ++uiDone / uiImages.length;
              paint();
            }),
        ),
      ),
      (document.fonts?.load ? Promise.all(['16px "Ferme"', '700 16px "Ferme"'].map((f) => document.fonts.load(f))).catch(() => null) : Promise.resolve()).then(() => {
        parts.font = 1;
        paint();
      }),
      soundsReady,
    ];
    const [imgs] = await Promise.all(tasks);
    images = imgs;
  } catch (err) {
    console.error(err);
    text.textContent = 'Impossible de charger le jeu.';
    errBox.hidden = false;
    errBox.textContent = String(err.message || err);
    window.__bootFail?.(err); // garde-fou de index.html : nouvelle version ou bouton « Réparer »
    return;
  }

  initSprites(images);
  // Contenu v3 (progression permanente, bonus, succès, cosmétiques) : modules du cœur chargés
  // maintenant ; sans eux, le jeu reste le jeu v2.
  await loadV3();
  app.progression.reload();
  const legacyAchievements = app.progression.checkBoot();
  applyViewport();
  attract = createAttractGame();
  resizeScene();
  document.body.classList.add('in-menu');
  requestAnimationFrame(frame);

  // Le reste des sons se télécharge en fond, deux à la fois et le plus utile d'abord : sur un
  // réseau lent, la musique du menu n'est pas ralentie par tout le reste.
  const warmQueue = [
    AUDIO.music.menu,
    ...Object.values(AUDIO.sfx),
    AUDIO.music.spring,
    ...['summer', 'autumn', 'winter', 'night'].map((k) => AUDIO.music[k]),
    ...Object.values(AUDIO.ambience),
    AUDIO.music.victory.intro,
    AUDIO.music.victory.loop,
  ].filter(Boolean);
  const warmNext = () => {
    const e = warmQueue.shift();
    if (e) Promise.resolve(audio.warm(e)).finally(warmNext);
  };
  warmNext();
  warmNext();

  text.textContent = 'Prêt !';
  startBtn.hidden = false;
  window.__bootOk?.(); // le jeu a démarré : le garde-fou de index.html s'arrête
  if (!app.isTouch) startBtn.focus();
  const go = () => {
    audio.unlock();
    audio.play('confirm');
    loading.classList.add('is-done');
    document.body.classList.remove('is-loading');
    setTimeout(() => loading.remove(), 500);
    audio.playMusic('menu', { fade: 1 });
    app.dialogs.mainMenu();
    if (legacyAchievements.length) {
      app.audio.play('unlock', { delay: 0.4, volume: 0.7 });
      app.toasts.show({ kind: 'achievement', icon: 'star', title: 'Grange aux souvenirs', text: `${plural(legacyAchievements.length, 'succès débloqué', 'succès débloqués')} grâce à vos anciennes parties !`, duration: 5200 });
    }
    if (DEBUG && params.get('level')) app.startLevel(Number(params.get('level')), { skipConfirm: true });
  };
  startBtn.addEventListener('click', go, { once: true });
  if (DEBUG && params.has('autostart')) go();
}

// Tout geste du joueur (re)déverrouille l'audio si le navigateur l'a suspendu (Chrome Android :
// seuls touchend / pointerup / click comptent comme « activation » au doigt, pas pointerdown).
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => {
    if (!document.body.classList.contains('is-loading')) audio.unlock();
  }, { passive: true, capture: true });
}

// ── Débogage (?debug=1) ───────────────────────────────────────────────────────────
if (DEBUG) {
  window.__app = app;
  window.__debug = {
    /** Fait passer n journées (s'arrête si une fenêtre s'ouvre). Renvoie le nombre de jours passés. */
    skipDays(n = 1) {
      let done = 0;
      for (let i = 0; i < n; i++) {
        const g = app.game;
        if (!g || g.state.status !== 'playing' || app.dialogs.isOpen()) break;
        const before = g.state.time.day;
        const speed = g.state.speed;
        g.actions.setSpeed(1);
        g.update(DAY_SECONDS - g.state.time.elapsed + 0.001);
        if (g.state.status === 'playing' && g.state.speed === 1) g.actions.setSpeed(speed);
        processPending();
        if (g.state.time.day !== before || g.state.status !== 'playing') done += 1;
      }
      return done;
    },
    /** Centre d'une parcelle en pixels de la page. */
    plotPoint(i) {
      const r = app.plotPageRect(i);
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    },
    investmentPoint(id) {
      const r = app.scene.layout.investmentRect(id, app.game?.state.investments[id] || 0);
      if (!r) return null;
      return worldToPage(r.x + r.w / 2, r.y + r.h / 2);
    },
    start(levelId) {
      return app.startLevel(levelId, { skipConfirm: true });
    },
    insets: () => ({ ...insets }),
    levels: LEVELS.map((l) => l.id),
    /** Progression permanente (objet normalisé). */
    progress: () => app.progression.get(),
    /** Remplace la progression (tests) : elle est normalisée puis enregistrée. */
    setProgress(p) {
      app.progression.commit(v3.progression?.normalizeProgress ? v3.progression.normalizeProgress(p) : p);
      app.applyCosmetics();
      if (app.inMenu && app.dialogs.top() === 'main-menu') app.dialogs.mainMenu();
      return app.progression.get();
    },
    grange: (tab) => app.grange.open(tab),
    decor: () => app.decor.enter(),
    v3: () => v3,
  };
}

// Application installable : service worker (hors ligne, mises à jour), invitation à installer.
// (`?nosw` dans l'adresse : sans service worker, pour le débogage.)
pwa.initPWA();

boot().catch((err) => {
  // Erreur imprévue pendant le chargement : le chargeur de index.html affiche le vrai message
  // (« Détails ») et propose « Réparer le jeu ».
  console.error(err);
  window.__bootFail?.(err);
});

export { app };
