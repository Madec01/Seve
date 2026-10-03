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
// Mode Carrière (docs/CARRIERE.md, src/ui/career/*) : « Ma ferme » au menu principal, création
// (app.startCareer), reprise (app.continueCareer), sauvegarde propre (storage.saveCareer), onglets,
// feuilles et fenêtres de la carrière (app.careerUI). Une seule partie active à la fois : la partie de
// niveau est enregistrée avant d'ouvrir la carrière (retour au menu), et inversement.
//
// Débogage (seulement avec ?debug=1 dans l'adresse) : window.__game (partie en cours),
// window.__app et window.__debug = { skipDays(n), plotPoint(i), investmentPoint(id), start(levelId),
// progress(), setProgress(p), grange(tab), decor(), setMoney(n), career(), careerStart(opts),
// careerSkipYears(n), careerRank(n), careerMoney(n), careerEvent(id), lotPoint(id) }.

import { SHEETS } from './render/atlas.js';
import { loadImage, loadImages } from './render/assets.js';
import { createScene } from './render/scene.js';
import { createGame, loadGame } from './core/game.js';
import { createCareer, loadCareer, careerMetaOf } from './core/career/career.js';
import { DAY_SECONDS, SEASONS } from './data/balance.js';
import { getLevel, LEVELS } from './data/levels.js';
import { getInvestment } from './data/investments.js';
import { getCrop } from './data/crops.js';
import { DIFFICULTIES, LEGACY_DIFFICULTY } from './data/difficulty.js';
import { AUDIO } from './audio/manifest.js';
import { ambienceFor, createAudio } from './audio/audio.js';
import * as storage from './storage.js';
import * as pwa from './pwa.js';
import { $, el, fmt, plural } from './ui/dom.js';
import { initSprites, investmentIcon, cropIcon, icon, sprite } from './ui/icons.js';
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
import { season, seasonArrives, cropName, cropCount, incomePhrase, difficultyName } from './ui/text.js';
import { loadV3, v3 } from './ui/v3.js';
import { createProgress } from './ui/progress.js';
import { createGrange } from './ui/grange.js';
import { createDecor } from './ui/decor.js';
import { createHints } from './ui/hints.js';
import { isProcessing } from './ui/buildings.js';
import { productIcon } from './ui/icons.js';
import { productName } from './ui/panel.js';
import { createCareerUI } from './ui/career/index.js';
import { careerMenuButtons, openNewFarm } from './ui/career/menu.js';
import { createMessages } from './ui/messages.js';
import { createTodo } from './ui/todo.js';
import { openGuide } from './ui/guide.js';
import { speedCycle } from './ui/a11y.js';
import { createJuice } from './ui/juice.js';
import { createLot2 } from './ui/lot2.js';
import { createVariety } from './ui/variety.js';
import { createCozy } from './ui/cozy.js';
import { createAlbum } from './ui/album.js';
import { nextFloat } from './core/rng.js';
import * as surprisesCore from './core/surprises.js';
import { SPECIAL_WEATHERS_BY_ID, FINDS_BY_ID } from './data/surprises.js';

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
let pending = { billPaid: null, frost: null, end: null, contest: null, loan: null };
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
app.careerUI = createCareerUI(app);
app.careerMenuButtons = (btn) => careerMenuButtons(app, btn);
app.newFarm = () => openNewFarm(app, {});
// Guidage (lot 1 « confort ») : historique des messages, ligne « À faire », guide de la ferme.
app.messages = createMessages(app);
app.toasts.setLogger((e) => app.messages.add(e));
app.toasts.setMoreHandler(() => app.messages.open());
app.todo = createTodo(app);
app.openGuide = (opts = {}) => openGuide(app, opts);
// Lot 2 « Toucher & surprises » : récolte juteuse (pièces qui volent, notes qui montent), qualité, géants,
// surprises de l'aube, météos spéciales (vœu), trouvailles du défrichage.
app.juice = createJuice(app);
app.lot2 = createLot2(app);
// Lot 3 « Variété » : tableau du village, cadeau et défis de la saison, charrette du marché, Basile le colporteur,
// années à thème de la carrière (src/ui/variety.js ; rien n'apparaît sans state.variety, donc jamais en Classique).
app.variety = createVariety(app);
// Lot 4 « Collection & enjeux doux » : album de la ferme (progression permanente, aussi en Classique), fêtes
// participatives et mode fête, hiver vivant, lanternes de fin d'année, « aider sans remplacer » (carrière)
// (src/ui/album.js, src/ui/cozy.js ; rien de state.cozy en Classique).
app.storage = storage;
app.album = createAlbum(app);
app.cozy = createCozy(app);

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
  app.applyA11y?.(); // taille du texte, police, contraste, scène, pause du matin (src/ui/a11y.js)
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
    text: 'La partie est sauvegardée.',
    actionLabel: 'Recharger',
    keepTouch: true,
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
// Mode de difficulté des nouvelles parties (progression permanente).
app.difficulty = () => app.progression.difficulty();
app.setDifficulty = (id) => app.progression.setDifficulty(id);
app.progress = () => app.progression.get();
app.isLevelUnlocked = (id) => app.progression.isLevelUnlocked(id);

app.resetProgress = () => {
  if (app.game?.mode === 'career' && !app.inMenu) app.quitToMenu({ ended: true });
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
  if (!s || typeof s.setCosmetics !== 'function') return;
  // Carrière (partie en cours, ou ferme de carrière derrière le menu) : nom, tenue et décor de la carrière
  // (choisis à la création : « Nouvelle ferme ») ; allée et clôture de la progression (partagées).
  const g = app.game && !app.inMenu ? app.game : attract;
  const cc = g?.mode === 'career' ? g.state.career : null;
  if (!cc && !app.progression.available()) return;
  const c = app.progression.available() ? app.progression.cosmetics() : {};
  try {
    s.setCosmetics({
      farmName: cc?.farmName || c.farmName,
      outfit: cc?.outfit || c.outfit,
      path: c.path,
      fence: c.fence,
      decor: { ...(cc ? cc.cosmetics?.decor || {} : c.decor || {}) },
    });
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
    // Pause de lecture d'une fiche (src/ui/sheets.js) : relancer le temps (clavier, bouton) la lève jusqu'à la fermeture.
    if (speed > 0) app.sheets.releasePause?.();
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
  const handle = app.dialogs.pauseMenu();
  addPauseGuidance(handle?.node);
};

/** Menu Pause : « Messages » et « Guide de la ferme », juste après « Reprendre » (lot 1 « confort »). */
function addPauseGuidance(node) {
  const list = node?.querySelector('.menu-buttons');
  if (!list || list.querySelector('#pause-guide')) return;
  const unread = app.messages.unread;
  const messages = app.dialogs.btn([el('span', 'Messages'), unread ? el('span.pause-count', ` (${unread} nouveaux)`) : null], () => app.messages.open(), 'btn--big', { id: 'pause-messages' });
  const guide = app.dialogs.btn('Guide de la ferme', () => app.openGuide(), 'btn--big', { id: 'pause-guide' });
  const after = list.querySelector('#pause-resume');
  if (after) after.after(messages, guide);
  else list.prepend(messages, guide);
  // (Lot 4) L'album de la ferme (le jeu reste en pause) : pastille quand une case est nouvelle.
  if (app.album?.available?.() && !list.querySelector('#pause-album')) {
    const n = app.album.badge();
    const album = app.dialogs.btn([el('span', 'L\'album'), n ? el('span.pause-count', ` (${n} nouveauté${n > 1 ? 's' : ''})`) : null], () => app.album.open(), 'btn--big', { id: 'pause-album' });
    guide.after(album);
  }
}

// ── Onglets et feuilles ───────────────────────────────────────────────────────────
/** Onglet du bas : 'farm' | 'shop' | 'stats' | 'menu'. */
app.openTab = (id, { fromUser = false } = {}) => {
  if (!app.game || app.inMenu) return;
  if (app.careerUI.active()) {
    app.careerUI.openTab(id, { fromUser });
    app.tabbar.refresh();
    return;
  }
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
app.onTodoResize = () => {
  insetsKey = '';
  updateInsets();
};
app.onDecorChange = () => {
  insetsKey = '';
  updateInsets();
  app.tabbar?.refresh();
};
app.onDialogChange = () => {
  document.body.classList.toggle('has-dialog', app.dialogs?.isOpen() ?? false);
  // (QA du lot 4) Fenêtre de fin (saison, année, victoire) : les messages attendent dans l'historique (css/style.css).
  document.body.dataset.dialog = (app.dialogs?.isOpen() && app.dialogs.top()) || '';
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
    revealLotId = null;
    return;
  }
  if (revealLotId && app.sheets.current === revealLotId.sheet) {
    try {
      // Terrain à vendre (carte 2D) : son panneau « À vendre » est en bas du bloc, c'est lui qu'on montre.
      const sale = app.game?.mode === 'career' ? app.game.query.career.lot?.(revealLotId.id) : null;
      const r = sale?.forSale && typeof s.focusRect === 'function' ? s.lotRect?.(revealLotId.id) : null;
      if (r) s.focusRect({ x: r.x, y: r.y + r.h * 0.45, w: r.w, h: r.h * 0.55 }, { margin: 14 });
      else s.focusLot(revealLotId.id, { margin: 14, animate: true });
    } catch (err) {
      console.warn('focusLot :', err);
    }
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

/** Carrière : le terrain de la feuille ouverte reste visible au-dessus d'elle (scene.focusLot du rendu). */
let revealLotId = null;
app.revealLot = (lotId, sheetId) => {
  const s = app.scene;
  if (!s || typeof s.focusLot !== 'function') return;
  revealLotId = { id: lotId, sheet: sheetId };
  updateSheetOverlay();
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
    app.vibrate([30, 40, 30]); // motif « erreur », distinct du petit toucher (accessibilité)
    app.toasts.show({ kind: 'error', text: res.reason, log: false });
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

/** Mode détente : rembourse Joseph (au plus `amount` pièces). `explain` : bouton grisé touché. */
app.repayNeighbour = (amount, { explain = false } = {}) => {
  const g = app.game;
  if (!g || typeof g.actions.repayNeighbour !== 'function') return null;
  if (explain) {
    audio.play('error');
    app.toasts.show({ kind: 'error', text: `Il vous faut ${plural(amount, 'pièce')} pour rendre cette somme (vous en avez ${fmt(Math.max(0, g.state.money))}).`, log: false });
    return null;
  }
  const res = report(g.actions.repayNeighbour(amount));
  if (res?.ok) {
    audio.play('coin');
    app.vibrate(12);
  }
  return res;
};

/** Ouvre le bilan sur la section de Joseph (dette, remboursement). */
app.openNeighbour = () => {
  app.openTab('stats');
  requestAnimationFrame(() => app.panel.focusNeighbour?.());
};

/**
 * Sème la même culture sur la parcelle choisie puis sur toutes les parcelles libres. Si cela coûte plus de la
 * moitié de l'argent, le joueur confirme d'abord (renvoie alors une promesse du nombre de parcelles semées).
 */
app.plantAll = (cropId, firstIndex) => {
  const g = app.game;
  if (!g) return 0;
  const crop = getCrop(cropId);
  if (crop?.kind !== 'tree') {
    const others = g.query.plots().filter((p) => p.action === 'plant' && p.index !== firstIndex).length;
    const seed = g.query.plantableCrops(firstIndex).find((c) => c.id === cropId)?.seedCost ?? 0;
    const money = Math.max(0, g.state.money);
    const n = Math.min(others + 1, seed > 0 ? Math.floor(money / seed) : others + 1);
    const cost = n * seed;
    if (others > 0 && n > 1 && cost > money * 0.5) {
      return app.dialogs
        .confirm({
          title: 'Semer partout ?',
          text: `${plural(n, 'parcelle')} de ${cropName(cropId).toLowerCase()} : ${plural(cost, 'pièce')} sur vos ${fmt(money)}. Il vous restera ${plural(money - cost, 'pièce')}.`,
          ok: `Semer (${fmt(cost)})`,
          cancel: 'Annuler',
        })
        .then((ok) => (ok && app.game === g ? plantAllNow(g, cropId, firstIndex) : 0));
    }
  }
  return plantAllNow(g, cropId, firstIndex);
};

function plantAllNow(g, cropId, firstIndex) {
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
}

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

/** Rectangle du monde (px) en pixels de la page. */
app.worldPageRect = (r) => {
  const scene = app.scene;
  if (!scene || !r) return null;
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
  // Zoom à deux doigts (autorisé par l'option d'accessibilité) : la hauteur visible rétrécit ; la mise en page garde
  // la hauteur réelle de l'écran (hauteur visible × zoom).
  const vv = window.visualViewport;
  if (!vv) return Math.round(window.innerHeight);
  return Math.round(vv.height * (vv.scale > 1.01 ? vv.scale : 1));
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
  // La ligne « À faire » (src/ui/todo.js) garde sa place en bas pendant toute la partie, même cachée un instant
  // (feuille, bulle) : la scène ne saute pas à chaque fois, et rien d'utile ne reste dessous.
  const todoH = inGame && !app.isWide() && !(app.decor?.active) ? app.todo?.reserve?.() || 0 : 0;
  insets.bottom = inGame && !app.isWide() ? tabH + todoH : decorH && !app.isWide() ? decorH : 0;
  insets.left = 0;
  // Grand écran : le panneau rangé à droite (achats, bilan) réduit la scène visible.
  insets.right = inGame && app.isWide() && app.sheets.isOpen() ? Math.round(app.sheets.box.getBoundingClientRect().width) : 0;
  const key = `${insets.top},${insets.bottom},${insets.left},${insets.right},${todoH}`;
  if (key === insetsKey) return;
  insetsKey = key;
  document.documentElement.style.setProperty('--inset-top', `${insets.top}px`);
  // CSS : haut des onglets seulement (feuilles, messages, ligne « À faire » se posent dessus).
  document.documentElement.style.setProperty('--inset-bottom', `${insets.bottom - todoH}px`);
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
    app.scene.effects?.setCoinFlight?.(true); // (lot 2) les pièces de la récolte volent vers le compteur
    insetsKey = '';
    syncSceneCareer();
    app.applyCosmetics();
    if (app.decor.active && typeof app.scene.setDecorMode === 'function') app.scene.setDecorMode(true);
    // Nouvelle scène : réglages d'accessibilité du canvas (mouvements réduits, repères des parcelles : src/ui/a11y.js).
    app.applySceneA11y?.();
  }
  app.scene.resize(w, h, dpr);
  updateInsets();
  app.tutorial.relayout();
}

/** Carrière : la scène passe en disposition « colonne de terrains » (lot RENDER : scene.setCareer). */
function syncSceneCareer() {
  const s = app.scene;
  if (!s || typeof s.setCareer !== 'function') return;
  const g = app.game && !app.inMenu ? app.game : attract;
  try {
    s.setCareer(g?.mode === 'career');
  } catch (err) {
    console.warn('setCareer :', err);
  }
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
  const content = app.decor.active ? app.decor.hoverText(h) : h.type === 'plot' ? app.field.plotTip(h.index) : h.type === 'investment' ? app.field.investmentTip(h.id) : null;
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
    else if (['villageBoard', 'cart', 'merchant', 'feteItem', 'winterFind', 'feeder', 'storyWindow', 'lanternRack', 'feteStall'].includes(hit?.type)) pointer = true;
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
  // Carrière (carte 2D) : les flèches promènent la vue sur la ferme (pas quand une feuille est ouverte).
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (ARROWS[e.key] && app.careerUI.active() && !app.sheets.isOpen() && app.scene?.careerMode) {
    e.preventDefault();
    const [kx, ky] = ARROWS[e.key];
    const step = e.shiftKey ? 320 : 120;
    app.scene.scrollBy(kx * step, ky * step);
    return;
  }
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    const g = app.game;
    app.setSpeed(g.state.speed === 0 ? lastPlaySpeed || 1 : 0, { fromUser: true });
  } else if (e.key === '1') app.setSpeed(1, { fromUser: true });
  else if (e.key === '2') app.setSpeed(2, { fromUser: true });
  else if (e.key === '3') app.setSpeed(4, { fromUser: true });
  else if (e.key === 'm' || e.key === 'M') app.toggleMute();
  else if (app.careerUI.active() && (e.key === 'b' || e.key === 'B')) app.openTab('buy', { fromUser: true });
  else if (app.careerUI.active() && (e.key === 'e' || e.key === 'E')) app.openTab('staff', { fromUser: true });
  else if (app.careerUI.active() && (e.key === 'j' || e.key === 'J')) app.openTab('journal', { fromUser: true });
  else if (app.careerUI.active() && (e.key === 'c' || e.key === 'C')) app.careerUI.open.map();
  else if (app.careerUI.active() && (e.key === 'f' || e.key === 'F')) app.openTab('farm', { fromUser: false });
  else if (e.key === 'b' || e.key === 'B') app.openTab('shop', { fromUser: true });
  else if (e.key === 'n' || e.key === 'N') app.openTab('stats', { fromUser: true });
  else if (e.key === 'f' || e.key === 'F') app.openTab('farm', { fromUser: true });
  else if ((e.key === 'd' || e.key === 'D') && app.decor.available() && !app.decor.active && !app.careerUI.active()) app.decor.enter();
});

// ── Événements du jeu ─────────────────────────────────────────────────────────────
let refreshQueued = false;
let lastRefreshAt = 0;
// Carrière : une grande ferme émet des événements presque à chaque image (employés, machines) ; la barre du haut
// (prévision des charges, rang) est recalculée au plus 4 fois par seconde. Niveaux : à chaque image, inchangé.
const CAREER_REFRESH_MS = 250;
function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  const run = () => {
    refreshQueued = false;
    lastRefreshAt = performance.now();
    app.hud.refresh();
    if (hover.hit && app.tooltip.owner === 'scene') updateHoverTip();
  };
  const wait = app.game?.mode === 'career' ? CAREER_REFRESH_MS - (performance.now() - lastRefreshAt) : 0;
  if (wait > 0) setTimeout(() => requestAnimationFrame(run), wait);
  else requestAnimationFrame(run);
}

/** Messages des niveaux aussi valables en carrière (le reste passe par app.careerUI.onGameEvent). */
const SHARED_MESSAGES = new Set(['frost', 'harvested', 'productSold', 'processingSoldRaw', 'processingToggled', 'treeRemoved', 'loanRepayment', 'loanRepaid', 'contestProgress']);

function wire(game) {
  const off = game.on('*', (ev) => onGameEvent(ev, game));
  return off;
}

/** Réaction de toute l'application à un événement du cœur (aussi utilisé par les aides de débogage du lot 2). */
function onGameEvent(ev, game) {
  const career = game.mode === 'career';
  {
    app.scene?.onEvent(ev.type, ev);
    app.hud.onEvent(ev);
    app.juice.onEvent(ev, game);
    app.lot2.onEvent(ev, game);
    try {
      app.variety.onEvent(ev, game);
    } catch (err) {
      console.warn('Variété (événement) :', err);
    }
    try {
      app.cozy.onEvent(ev, game);
    } catch (err) {
      console.warn('Lot 4 (événement) :', err);
    }
    if (!career) app.panel.onEvent(ev);
    app.field.onEvent(ev);
    app.tutorial.onEvent(ev);
    app.todo.onEvent(ev, game);
    reactAudio(ev, game);
    if (!career || SHARED_MESSAGES.has(ev.type)) reactMessages(ev, game);
    if (career) {
      try {
        app.careerUI.onGameEvent(ev, game);
      } catch (err) {
        console.warn('Carrière (événement) :', err);
      }
      if (['lotBought', 'lotDeveloped', 'buildingBuilt', 'buildingUpgraded', 'rankUp'].includes(ev.type)) syncSceneCareer();
    }
    switch (ev.type) {
      case 'dawn':
        save();
        break;
      case 'billPaid':
        if (!career) pending.billPaid = ev;
        break;
      case 'frost':
        if (!career) pending.frost = ev;
        break;
      case 'bankrupt':
      case 'victory':
        if (!career) pending.end = ev;
        break;
      case 'contestAwarded':
        pending.contest = ev;
        break;
      case 'neighbourLoan':
        if (!career) pending.loan = ev;
        break;
      case 'purchased':
        if (!career && isProcessing(game.query.investments().find((i) => i.id === ev.investmentId)) && ev.owned === 1 && app.hints.maybe('processingBought', { selector: '#bld-switch' })) {
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
    if (ev.type === 'dawn') {
      app.progression.checkGame(game);
      try {
        app.album.onDawn(game); // (lot 4) nouvelles cases de l'album, comme les succès
      } catch (err) {
        console.warn('Album :', err);
      }
    }
    scheduleRefresh();
  }
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
const grouped = { toWorkshop: new Map(), sold: [], loan: null };
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
  // Remboursements automatiques de Joseph : un seul message discret, mis à jour tant qu'il est
  // affiché (un glissé sur tout le champ ne fait pas dix messages).
  if (grouped.loan && grouped.loan.pendingSince && performance.now() - grouped.loan.pendingSince > 450) {
    const L = grouped.loan;
    L.pendingSince = 0;
    if (L.remaining > 0) {
      t.show({
        key: 'neighbour-repay',
        kind: 'info',
        sprite: sprite('farmer', 'sprite--sm'),
        title: `−${fmt(L.total)} pour Joseph`,
        text: `Remboursement automatique · reste ${plural(L.remaining, 'pièce')}`,
        duration: 3000,
      });
    }
  }
}

function reactAudio(ev, game) {
  // Carrière : ce que font l'équipe et les machines s'entend à peine (une grande ferme en ferait une cacophonie à ×4).
  if (ev.by && ev.by !== 'player' && ['planted', 'watered', 'harvested'].includes(ev.type)) {
    const name = ev.type === 'planted' ? 'plant' : ev.type === 'watered' ? 'water' : 'harvest';
    audio.play(name, { volume: 0.22, throttle: 1400 });
    return;
  }
  switch (ev.type) {
    case 'planted':
      audio.play('plant'); // + bruit sourd synthétisé (src/ui/juice.js)
      break;
    case 'watered':
      audio.play('water'); // + éclaboussure synthétisée (src/ui/juice.js)
      break;
    case 'harvested':
      // (Lot 2) La note qui monte et la pièce qui arrive au compteur sont jouées par src/ui/juice.js.
      audio.play('harvest', { volume: 0.75 });
      if (ev.processed) audio.play('build', { delay: 0.08, volume: 0.45 });
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
      app.vibrate([15, 80, 15, 80, 15]); // motif « alerte » : la saison (et le fermage) arrive
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
      // (lot 3) Cadeau (carte « Un essaim d'abeilles ») ou objet d'occasion du colporteur.
      const fem = ['beehive', 'guestHouse', 'cow', 'goat', 'dairy'].includes(inv.id) ? 'e' : '';
      const verb = ev.gift ? `offert${fem}` : ev.used ? `d'occasion acheté${fem}` : `acheté${fem}`;
      t.show({ kind: 'success', sprite: investmentIcon(ev.investmentId, 'sprite--sm'), title: inv.kind === 'upgrade' ? `${inv.name} : niveau ${ev.owned}` : `${inv.name} ${verb} !`, text: what });
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
    case 'loanRepayment':
      if (ev.source === 'harvest' || ev.source === 'product') {
        // Cumul tant que le message est affiché (voir flushGrouped).
        const now = performance.now();
        const L = grouped.loan && now - grouped.loan.last < 3000 ? grouped.loan : { total: 0 };
        L.total += ev.amount;
        L.remaining = ev.remaining;
        L.last = now;
        L.pendingSince = L.pendingSince || now;
        grouped.loan = L;
      } else if (ev.source === 'player') {
        t.show({ kind: 'money', sprite: sprite('farmer', 'sprite--sm'), title: `${plural(ev.amount, 'pièce')} rendue${ev.amount > 1 ? 's' : ''} à Joseph`, text: ev.remaining > 0 ? `Reste à lui rendre : ${plural(ev.remaining, 'pièce')}.` : 'C\'est tout bon !', duration: 3000 });
      }
      break;
    case 'loanRepaid':
      if (ev.source !== 'yearEnd') {
        grouped.loan = null;
        audio.play('unlock', { volume: 0.6, delay: 0.2 });
        t.show({ kind: 'success', sprite: sprite('farmer', 'sprite--sm'), title: 'Dette remboursée, merci !', text: 'Joseph pourra encore vous dépanner si besoin.', duration: 4200 });
      }
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
      maybeLowMoneyHint(game);
      break;
    }
    default:
      break;
  }
}

/**
 * Conseil doux quand l'argent risque de manquer au fermage (une fois par saison, à l'aube, 3 jours
 * avant au plus) : quoi faire concrètement, sans alarme ni pause.
 */
let lowMoneyHint = null; // saison du dernier conseil
function maybeLowMoneyHint(game) {
  if (game.state.status !== 'playing' || app.tutorial.active) return;
  const p = app.hud.projection();
  if (p.state === 'ok' || p.daysLeft > 3 || p.daysLeft < 1) return;
  const key = `${game.state.time.seasonIndex}`;
  if (lowMoneyHint === key) return;
  if (p.state === 'warn' && p.projected - p.amount > 15) return; // les récoltes prévues suffiront largement
  lowMoneyHint = key;
  const plots = game.query.plots();
  const mature = plots.filter((x) => x.action === 'harvest').length;
  const empty = plots.filter((x) => x.action === 'plant').length;
  const c = game.query.calendar();
  const fast = game.query.plantableCrops().filter((x) => x.kind !== 'tree' && !x.willFreeze && x.canAfford && x.daysToMature <= p.daysLeft).sort((a, b) => a.daysToMature - b.daysToMature || a.seedCost - b.seedCost)[0];
  let text;
  if (mature) text = `${plural(mature, 'culture est mûre', 'cultures sont mûres')} : récoltez-les, l'argent arrive tout de suite.`;
  else if (empty && fast) text = `Des parcelles sont vides : semez des ${cropCount(fast.id, 2).replace(/^2 /, '')}, ${fast.daysToMature <= 2 ? 'ça pousse vite' : `récolte dans ${plural(fast.daysToMature, 'jour')}`}.`;
  else text = 'Arrosez vos cultures pour qu\'elles soient mûres avant le soir du fermage.';
  if (p.state === 'loan') text += ' Et pas de panique : Joseph peut vous avancer le reste.';
  t0().show({ kind: 'info', sprite: sprite('farmer', 'sprite--sm'), title: `Fermage ${season(c.seasonId, 'of')} dans ${plural(p.daysLeft, 'jour')}`, text, duration: 7000 });
}
const t0 = () => app.toasts;

function frostHardy(cropId) {
  return !!getCrop(cropId)?.frostHardy;
}

/** Fenêtres de fin de saison / de partie, après le traitement complet d'une journée. */
function processPending() {
  const g = app.game;
  if (!g) return;
  flushGrouped();
  if (g.mode === 'career') {
    // Comice (concours de carrière, moteur contest.js) : remise des prix avant le reste.
    if (pending.contest && !app.dialogs.isOpen()) {
      const ev = pending.contest;
      pending.contest = null;
      app.sheets.close('silent');
      app.dialogs.contestResult(ev, { onClose: () => processPending() });
      return;
    }
    app.careerUI.processPending();
    return;
  }
  if (pending.end) {
    const ev = pending.end;
    pending = { billPaid: null, frost: null, end: null, contest: null, loan: null };
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
  // Mode détente : Joseph avance l'argent du fermage — sa fenêtre passe avant le bilan de saison.
  if (pending.loan && !pending.loan.shown && !app.dialogs.isOpen()) {
    pending.loan.shown = true;
    app.sheets.close('silent');
    app.vibrate([10, 60, 10]);
    app.dialogs.neighbourLoan(pending.loan, { onClose: () => processPending() });
    return;
  }
  if (pending.billPaid && app.dialogs.top() === 'neighbour-loan') return;
  if (pending.billPaid) {
    const ev = pending.billPaid;
    const frost = pending.frost;
    const loan = pending.loan;
    pending.billPaid = null;
    pending.frost = null;
    pending.loan = null;
    // Le bandeau de la nouvelle saison s'affiche quand on referme le bilan.
    app.dialogs.seasonEnd(ev, {
      frost,
      loan,
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
  const albumBefore = app.album?.available?.() ? app.album.snapshot() : null;
  const rec = app.progression.recordRunEnd({
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
    context: ctx, // (lot 4) l'album lit le contexte de la fin de partie
  });
  // (Lot 4) Cases de l'album trouvées au bilan de fin (recordRunEnd lit summary.cozy et le contexte).
  if (albumBefore && outcome !== 'abandon') app.album.announceSince(albumBefore);
  return rec;
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
  if (g.mode === 'career') {
    let meta = null;
    try {
      meta = careerMetaOf(g);
    } catch (err) {
      console.warn('careerMetaOf :', err);
    }
    storage.saveCareer(data, meta || { farmName: g.state.career?.farmName, year: g.state.time.year });
    return;
  }
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
  // Sauvegarde d'avant les modes : elle continue en classique (règles du début de la partie).
  const mode = DIFFICULTIES[data.state.difficulty] ? data.state.difficulty : LEGACY_DIFFICULTY;
  return {
    levelId: lvl.id,
    difficulty: mode,
    label: `Niveau ${lvl.id} · Jour ${data.state.time?.day ?? 1} · ${season(sid)} · ${difficultyName(mode)}`,
    data,
  };
};

/** Enregistre tout de suite (achat important, bilan de l'année…). */
app.saveNow = () => save();

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
function startRun(game, { resumed = false, created = false } = {}) {
  if (unwire) unwire();
  app.careerUI.unbind();
  if (app.decor.active) app.decor.exit();
  app.tutorial.stop();
  app.hints.clear();
  pauseReasons.clear();
  pending = { billPaid: null, frost: null, end: null, contest: null, loan: null };
  grouped.toWorkshop.clear();
  grouped.sold = [];
  grouped.loan = null;
  lowMoneyHint = null;
  queuedBanner = null;
  app.dialogs.closeAll();
  app.toasts.clearAll();
  app.messages.clear();
  app.sheets.close('silent');
  app.input.cancel();
  app.tooltip.hide();

  app.game = game;
  app.todo.reset(game);
  app.juice.reset();
  app.lot2.reset(game);
  app.variety.reset(game);
  app.cozy.reset(game);
  app.album.reset();
  app.inMenu = false;
  if (DEBUG) window.__game = game;
  document.body.classList.remove('in-menu');
  document.body.classList.add('in-game');

  const career = game.mode === 'career';
  app.hud.bind(game);
  if (!career) app.panel.bind(game);
  unwire = wire(game);
  resizeScene();
  syncSceneCareer();
  app.applyCosmetics();
  if (typeof app.scene?.focusField === 'function') app.scene.focusField();

  // Nouvelle partie : ×1, ou ×½ avec l'option « Vitesse lente » (src/ui/a11y.js : speedCycle).
  if (!resumed) game.actions.setSpeed(speedCycle(settings)[0] || 1);
  else if (game.state.speed > 0) lastPlaySpeed = game.state.speed;

  const c = game.query.calendar();
  audio.playMusic(c.seasonId);
  updateAmbience(game);

  if (career) {
    // Mode Carrière : onglets, feuilles, fenêtres et conseils propres (src/ui/career/*).
    app.careerUI.bind(game, { resumed, created, quiet: resumed });
    // Reprise depuis le menu : « Où en étais-je ? » (fenêtre courte, la partie attend).
    if (resumed) app.todo.showResume(game);
    save();
    scheduleRefresh();
    updateWakeLock();
    if (pwa.isStandalone()) pwa.lockPortrait();
    app.tabbar.refresh();
    return;
  }
  app.tabbar.setTabs(null);

  const lvl = game.level;
  const farm = app.progression.available() ? `${app.progression.farmName()} · ` : '';
  const modeName = difficultyName(game.difficulty);
  if (resumed) {
    // « Où en étais-je ? » remplace l'ancien message « Partie reprise » (la fenêtre dit tout).
    if (!app.todo.showResume(game)) app.toasts.show({ kind: 'info', icon: 'calendar', text: `Partie reprise : jour ${c.day}, ${season(c.seasonId).toLowerCase()} (mode ${modeName}).` });
  } else if (lvl.contest) {
    app.toasts.banner({ kind: 'season', icon: c.seasonId, title: `${lvl.name}`, text: `${farm}Niveau ${lvl.id} · ${modeName} · jugement le soir du ${lvl.contest.deadlineDay}ᵉ jour`, duration: 4800 });
  } else {
    app.toasts.banner({ kind: 'season', icon: c.seasonId, title: `${lvl.name}`, text: `${farm}Niveau ${lvl.id} · ${modeName} · ${season(c.seasonId)}, jour 1`, duration: 3800 });
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
  // Mode choisi pour les nouvelles parties (Détente par défaut).
  const difficulty = app.difficulty();
  // (Lot 4) Détente : fêtes, hiver vivant, lanternes ; le décor de la progression compte pour la « beauté » (copié au
  // lancement, comme les bonus). Classique : aucune option (clé state.cozy absente, parité).
  const cozy = difficulty === 'classique' ? undefined : { decor: app.progression.decorSummary?.() || { placed: 0, path: false, fence: false } };
  const game = createGame({ levelId, seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, perks, difficulty, ...(cozy ? { cozy } : {}) });
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
  app.careerUI.unbind();
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
  app.todo.reset(null);
  app.juice.reset();
  app.lot2.reset(null);
  app.variety.reset(null);
  app.cozy.reset(null);
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
  syncSceneCareer();
  app.applyCosmetics();
  audio.playMusic('menu');
  audio.setAmbience({});
  audio.setWorld({ active: false });
  app.dialogs.mainMenu();
};

// ── Carrière : création, reprise, archive ─────────────────────────────────────────
/**
 * Sauvegarde de carrière pour le menu : { meta, label, data } ; { broken: true, backup } si illisible ;
 * { newer: true } si elle vient d'une version plus récente (gardée, jamais effacée) ; null sans carrière.
 */
app.savedCareerInfo = () => {
  const data = storage.loadCareer();
  if (!data) return null;
  let meta = data.meta || null;
  try {
    const g = loadCareer(data.state);
    if (g.state.status !== 'playing') return null;
    meta = careerMetaOf(g);
  } catch (err) {
    if (err?.code === 'newer' || /récente/.test(err?.message || '')) return { meta, newer: true, label: 'Sauvegarde d\'une version plus récente du jeu', data };
    console.info('Carrière illisible :', err?.message || err);
    return { broken: true, backup: !!storage.loadCareerBackup(), data };
  }
  if (!meta) return null;
  const sid = meta.seasonId || 'spring';
  return {
    meta,
    data,
    label: `Continuer · ${meta.farmName} · Année ${meta.year}, ${season(sid).toLowerCase()} · ${meta.rankName || `rang ${meta.rank}`}`,
  };
};

/** Archive la carrière sauvegardée (« Recommencer une ferme », nouvelle ferme par-dessus), puis l'efface. */
function archiveSavedCareer(endedBy = 'restart') {
  const data = storage.loadCareer();
  if (!data) return;
  let entry = null;
  try {
    const g = loadCareer(data.state);
    const sum = g.query.career.summary();
    entry = { farmName: sum.farmName, years: g.state.time.year, rank: sum.rank, patrimony: Math.max(sum.patrimony || 0, sum.bestPatrimony || 0), endedBy };
  } catch {
    const m = data.meta || {};
    entry = m.farmName ? { farmName: m.farmName, years: m.year || 1, rank: m.rank || 1, patrimony: m.patrimony || 0, endedBy } : null;
  }
  storage.clearCareer({ archive: entry });
  app.progression.reload();
}

/**
 * Nouvelle ferme. opts : { farmName, farmerGender, outfit, difficulty, seasonLength } (src/ui/career/menu.js).
 * archiveExisting : la ferme sauvegardée est d'abord archivée (confirmée deux fois par le joueur).
 */
app.startCareer = (opts, { archiveExisting = false } = {}) => {
  if (archiveExisting) archiveSavedCareer('restart');
  // La partie de niveau en cours (s'il y en a une) reste sauvegardée de son côté.
  if (app.game && !app.inMenu && app.game.mode !== 'career') save();
  let game;
  try {
    const decor = app.progression.available() ? { ...(app.progression.cosmetics().decor || {}) } : {};
    game = createCareer({ seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, ...opts, cosmetics: { decor } });
  } catch (err) {
    console.error(err);
    audio.play('error');
    app.toasts.show({ kind: 'error', text: `Impossible de créer la ferme : ${err.message}` });
    return;
  }
  app.progression.careerStart?.();
  startRun(game, { created: true });
};

/** « Ma ferme » → Continuer. Sauvegarde illisible : la copie de secours de la veille est proposée. */
app.continueCareer = async () => {
  const data = storage.loadCareer();
  if (!data) return app.dialogs.mainMenu();
  let game = null;
  try {
    game = loadCareer(data.state);
  } catch (err) {
    if (err?.code === 'newer' || /récente/.test(err?.message || '')) {
      audio.play('error');
      app.toasts.show({ kind: 'error', text: 'Cette sauvegarde vient d\'une version plus récente du jeu : mettez le jeu à jour (Options → Réparer le jeu).', duration: 6000 });
      return;
    }
    console.warn('Carrière illisible :', err);
    const bak = storage.loadCareerBackup();
    let backup = null;
    try {
      backup = bak ? loadCareer(bak.state) : null;
    } catch {
      backup = null;
    }
    if (backup) {
      const ok = await app.dialogs.confirm({ title: 'Sauvegarde abîmée', text: 'La sauvegarde de votre ferme ne se relit pas. Reprendre la sauvegarde de secours (celle de la veille) ?', ok: 'Reprendre la copie' });
      if (!ok) return;
      game = backup;
    } else {
      audio.play('error');
      app.toasts.show({ kind: 'error', text: 'La sauvegarde de votre ferme est illisible, et il n\'y a pas de copie de secours.', duration: 6000 });
      return;
    }
  }
  try {
    startRun(game, { resumed: true });
  } catch (err) {
    console.warn('Reprise de la carrière impossible :', err);
    app.quitToMenu({ ended: true });
    app.toasts.show({ kind: 'error', text: 'Impossible de reprendre la ferme pour l\'instant.' });
  }
};

/** Pause → « Recommencer une ferme » (double confirmation faite) : archive, retour au menu, création. */
app.restartCareer = () => {
  if (app.game?.mode === 'career') save();
  archiveSavedCareer('restart');
  app.quitToMenu({ ended: true });
  openNewFarm(app, {});
};

/** Faillite d'une carrière (Classique) : archivée puis effacée (la fenêtre suit). */
app.careerEnded = (ev) => {
  try {
    storage.clearCareer({ archive: ev?.archive || null });
  } catch (err) {
    console.warn('clearCareer :', err);
  }
  app.progression.reload();
  pauseReasons.clear();
  updateWakeLock();
};

// ── Ferme de démonstration (fond du menu) ─────────────────────────────────────────
/**
 * Derrière le menu : la ferme de carrière du joueur s'il en a une (une COPIE chargée de sa sauvegarde, qui vit à
 * ×1 et n'est jamais enregistrée : la vraie partie reprend exactement où elle était), sinon la ferme de
 * démonstration du niveau 1.
 */
function createAttractGame() {
  try {
    const saved = storage.loadCareer();
    if (saved?.state) {
      const g = loadCareer(saved.state);
      if (g.state.status === 'playing') {
        g.actions.setSpeed(1);
        // Ferme de fond du menu : jamais de « pause chaque matin » (rien n'est enregistré).
        if (typeof g.setOption === 'function' && g.options?.().autoPauseDawn) g.setOption('autoPauseDawn', false);
        g.__attract = true;
        return g;
      }
    }
  } catch {
    /* sauvegarde illisible : la ferme de démonstration */
  }
  return createDemoGame();
}

function createDemoGame() {
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
    if (g.state.status !== 'playing') {
      attract = createDemoGame();
      syncSceneCareer();
      app.applyCosmetics();
    }
  }
  if (g) app.scene.render(g, t);
  app.careerUI.frame(); // mini-carte de la carrière (dessinée par la scène, cachée hors carrière)
  // Lectures de mise en page (tutoriel) avant les écritures de style (HUD) : pas de reflow forcé.
  app.tutorial.frame();
  app.hints.frame();
  app.todo.tick();
  app.hud.frame(dt);
  app.juice.frame(dt);
  app.lot2.frame();
  app.variety.frame();
  app.cozy.frame();
  // Garde-fou : une feuille ouverte puis fermée dans la même image (une fenêtre s'est intercalée) ne doit pas rester
  // affichée vide (la classe is-visible arrivait après la fermeture : bug [42]).
  if (!app.sheets.current && app.sheets.box.classList.contains('is-visible')) app.sheets.box.classList.remove('is-visible');
}

// ── Chargement ────────────────────────────────────────────────────────────────────
/**
 * Planches de l'atlas. Celles d'un lot en cours de dessin (OPTIONAL_SHEETS : lot 3) peuvent manquer sans
 * empêcher le jeu de démarrer : le rendu et l'interface dessinent alors un repli (canDraw, spriteAny).
 */
const OPTIONAL_SHEETS = new Set(['lot3', 'lot4']);
async function loadSheets() {
  const required = {};
  const optional = [];
  for (const [k, v] of Object.entries(SHEETS)) {
    if (OPTIONAL_SHEETS.has(k)) optional.push([k, v]);
    else required[k] = v;
  }
  const [imgs, ...extra] = await Promise.all([
    loadImages(required),
    ...optional.map(([k, v]) =>
      loadImage(v, 1)
        .then((img) => [k, img])
        .catch(() => {
          console.info(`Planche ${k} absente : dessins de repli.`);
          return [k, null];
        }),
    ),
  ]);
  for (const [k, img] of extra) if (img) imgs[k] = img;
  return imgs;
}

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
    // Contrastes renforcés (lot 1 « confort ») : cadres foncés des boutons et des rubans.
    'assets/sprites/ui/button-red-deep.png',
    'assets/sprites/ui/button-slate-deep.png',
    'assets/sprites/ui/button-blue.png',
    'assets/sprites/ui/slot-wood-deep.png',
    'assets/sprites/ui/banner-red-deep.png',
    'assets/sprites/ui/banner-red-ribbon-deep.png',
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
      loadSheets().then((imgs) => {
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
  syncSceneCareer();
  app.applyCosmetics();
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
    maybeDetenteNotice();
    app.album.boot(); // (lot 4) « N cases de l'album retrouvées dans vos anciennes parties »
    if (legacyAchievements.length) {
      app.audio.play('unlock', { delay: 0.4, volume: 0.7 });
      app.toasts.show({ kind: 'achievement', icon: 'star', title: 'Grange aux souvenirs', text: `${plural(legacyAchievements.length, 'succès débloqué', 'succès débloqués')} grâce à vos anciennes parties !`, duration: 5200 });
    }
    if (DEBUG && params.get('level')) app.startLevel(Number(params.get('level')), { skipConfirm: true });
  };
  startBtn.addEventListener('click', go, { once: true });
  if (DEBUG && params.has('autostart')) go();
}

/**
 * Premier lancement depuis l'arrivée des modes de difficulté : un joueur qui avait déjà joué est
 * prévenu une fois que le jeu est plus doux (mode Détente). Un nouveau joueur n'a rien à apprendre :
 * la sélection des niveaux montre le choix du mode.
 */
function maybeDetenteNotice() {
  const m = uiMemo.read();
  if (m.detenteNotice) return;
  m.detenteNotice = 1;
  uiMemo.write(m);
  const p = app.progression.get();
  const saved = app.savedRunInfo();
  const played = Object.values(p.levels || {}).some((l) => l?.played || l?.completed || l?.bestMoney != null) || storage.loadTutorial().done || !!saved;
  if (!played) return;
  app.dialogs.detenteNotice({ savedClassique: saved?.difficulty === 'classique' });
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
    /** Ligne « À faire » : ce que le jeu propose, dans l'ordre (texte, id, priorité). */
    todo: () => app.todo.items().map((x) => ({ id: x.id, prio: x.prio, text: x.text, short: x.short })),
    messages: () => app.messages.list().map((m) => ({ kind: m.kind, title: m.title, text: m.text, day: m.day })),
    /** Change l'argent de la partie (tests : provoquer le prêt du voisin). */
    setMoney(n) {
      const g = app.game;
      if (!g) return null;
      g.state.money = n;
      app.hud.bind(g);
      if (g.mode === 'career') app.careerUI.refresh();
      else app.panel.refresh();
      return n;
    },
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
    // ── Carrière ──
    /** État de la carrière en cours (résumé), ou null. */
    career() {
      const g = app.game;
      if (!g || g.mode !== 'career') return null;
      return { summary: g.query.career.summary(), money: g.state.money, time: { ...g.state.time }, lots: g.query.career.lots().map((l) => ({ id: l.id, type: l.type, name: l.name, forSale: l.forSale })) };
    },
    /** Nouvelle carrière sans passer par la fenêtre (tests). */
    careerStart(opts = {}) {
      app.dialogs.closeAll();
      app.startCareer({ farmName: 'Ferme de test', difficulty: 'detente', seasonLength: 7, ...opts }, { archiveExisting: !!storage.loadCareer() });
      return !!app.game;
    },
    /** Passe des années entières (les fenêtres de fin d'année s'ouvrent puis se referment). */
    careerSkipYears(n = 1) {
      const g = app.game;
      if (!g || g.mode !== 'career') return 0;
      const target = g.state.time.year + n;
      let guard = 0;
      while (g.state.status === 'playing' && g.state.time.year < target && guard++ < 400) {
        while (app.dialogs.isOpen()) app.dialogs.closeTop() || app.dialogs.closeAll();
        app.hints.clear();
        if (!window.__debug.skipDays(1)) {
          processPending();
        }
      }
      processPending();
      return g.state.time.year;
    },
    /** Force le rang (tests de l'interface : contenu débloqué). */
    careerRank(n) {
      const g = app.game;
      if (!g || g.mode !== 'career') return null;
      g.state.career.rank = Math.max(1, Math.min(6, n));
      g.refreshLevel?.();
      app.hud.refresh();
      app.careerUI.refresh();
      return g.state.career.rank;
    },
    careerMoney(n) {
      return window.__debug.setMoney(n);
    },
    /** Déclenche un événement de carrière (lot CORE-C : actions.career.debugEvent), si disponible. */
    careerEvent(id) {
      const g = app.game;
      const fn = g?.actions.career?.debugEvent || g?.actions.career?.triggerEvent;
      if (typeof fn !== 'function') return { ok: false, reason: 'indisponible' };
      const res = fn(id);
      processPending();
      return res;
    },
    /**
     * (Lot 2) Aides de vérification : récolte de qualité forcée, géant, chaque surprise, chaque météo spéciale,
     * vœu, trouvailles. Elles modifient l'état comme le ferait le cœur, puis envoient l'événement à toute
     * l'application (onGameEvent) — sauf harvest(), qui passe par la vraie action du joueur.
     */
    lot2: {
      on: () => !!app.game?.state.surprises,
      /** Active les surprises sur la partie en cours (Classique : désactivées par défaut). */
      enable() {
        const g = app.game;
        if (!g) return false;
        if (!g.state.surprises) surprisesCore.enableSurprises(g.state);
        return !!g.state.surprises;
      },
      /** Prépare le flux « quality » pour que la prochaine récolte À LA MAIN de la parcelle i soit q. */
      forceQuality(i, q = 'gold') {
        const g = app.game;
        if (!g?.state.surprises) return false;
        const { fine, gold } = surprisesCore.qualityChances(g.state, g.state.plots[i], true);
        const lo = q === 'gold' ? 0 : q === 'fine' ? gold : gold + fine;
        const hi = q === 'gold' ? gold : q === 'fine' ? gold + fine : 1;
        for (let k = 0; k < 400000; k++) {
          const seed = (Math.random() * 4294967296) >>> 0;
          const h = { x: seed };
          const u = nextFloat(h, 'x');
          if (u >= lo && u < hi) {
            g.state.rng.quality = seed;
            return true;
          }
        }
        return false;
      },
      /** Rend mûres (même culture, semées le même jour, arrosées) toutes les parcelles ouvertes. */
      matureAll(cropId = null) {
        const g = app.game;
        if (!g) return 0;
        const id = cropId || g.level.crops?.[0] || 'carrot';
        const crop = getCrop(id);
        const day = surprisesCore.absDay ? surprisesCore.absDay(g.state) : g.state.time.day;
        let n = 0;
        g.state.plots.forEach((p) => {
          if (!p.unlocked || p.env === null) return;
          p.cropId = id;
          p.growth = crop.growDays;
          p.watered = true;
          delete p.giant;
          delete p.forage;
          if (g.state.surprises) p.care = { sown: day, dry: 0, rotated: false, wetEnd: true };
          n++;
        });
        return n;
      },
      /** Récolte (vraie action du joueur) de la parcelle i avec la qualité q. */
      harvest(i, q = 'gold') {
        window.__debug.lot2.forceQuality(i, q);
        return app.harvest(i);
      },
      /** Fusionne un carré 2 × 2 mûr en légume géant et l'annonce (comme à l'aube). */
      giant(cropId = null) {
        const g = app.game;
        if (!g) return null;
        window.__debug.lot2.enable();
        window.__debug.lot2.matureAll(cropId);
        const cands = surprisesCore.giantCandidates(g.state, g.level);
        if (!cands.length) return null;
        const sq = cands[Math.floor(cands.length / 2)];
        const res = surprisesCore.mergeGiant(g.state, sq);
        const crop = getCrop(res.cropId);
        onGameEvent({ type: 'giant', ...res, cropName: crop?.name || res.cropId, value: g.query.plot(res.anchor)?.harvestValue || 0 }, g);
        return res;
      },
      /**
       * Surprise de l'aube : 'fairy' | 'fox' | 'chest' | 'hedgehog' | 'owl' | 'ring'. Passe par le vrai chemin du
       * cœur (actions.triggerSurprise : état, argent, statistiques et événements `surprise` / `forage`).
       * → données de l'événement, ou { ok: false, reason } si elle est impossible aujourd'hui.
       */
      surprise(kind) {
        const g = app.game;
        if (!g) return null;
        window.__debug.lot2.enable();
        const r = g.actions.triggerSurprise?.(kind);
        processPending();
        if (!r?.ok) return { ok: false, reason: r?.reason || 'indisponible' };
        return r.surprise;
      },
      /** Météo spéciale du jour : 'warmrain' | 'fog' | 'shootingstar' | 'goldenhour' | 'rainbow' (null = aucune). */
      weather(id, { tomorrow = null, dayProgress = null } = {}) {
        const g = app.game;
        if (!g) return null;
        window.__debug.lot2.enable();
        const base = { warmrain: 'rain', fog: 'cloudy', shootingstar: 'sunny', goldenhour: 'sunny', rainbow: 'sunny' }[id];
        if (base) g.state.weather.today = base;
        g.state.surprises.sky.today = id || null;
        g.state.surprises.sky.tomorrow = tomorrow;
        if (dayProgress !== null) g.state.time.elapsed = DAY_SECONDS * dayProgress;
        else if (id === 'shootingstar') g.state.time.elapsed = DAY_SECONDS * 0.82;
        onGameEvent({ type: 'weather', today: g.state.weather.today, tomorrow: g.state.weather.tomorrow, special: { ...g.state.surprises.sky } }, g);
        const def = SPECIAL_WEATHERS_BY_ID[id];
        if (def) onGameEvent({ type: 'specialWeather', id, name: def.name, text: def.text, icon: def.icon }, g);
        updateAmbience(g);
        return g.state.surprises.sky;
      },
      /** Vœu de l'étoile filante (fenêtre « Faites un vœu »). */
      wish() {
        const g = app.game;
        if (!g) return null;
        window.__debug.lot2.enable();
        // Tirage du cœur (3 vœux parmi 4, comme le matin après une nuit d'étoiles filantes).
        const w = surprisesCore.newWish(g.state);
        onGameEvent({ type: 'wish', ...w, text: 'Cette nuit, vous avez vu une étoile filante : faites un vœu !' }, g);
        return w.options;
      },
      /** (Carrière) Trouvailles du défrichage sur un terrain (visuel + carte). */
      finds(lotId = null, kinds = ['chest', 'seedjar']) {
        const g = app.game;
        if (!g || g.mode !== 'career') return null;
        const lot = lotId || g.query.career.lots().find((l) => !l.forSale)?.id;
        const finds = kinds.map((k) => {
          const d = FINDS_BY_ID[k];
          return { kind: k, title: d.name, icon: d.icon, text: d.text.replace('{reward}', '40 pièces').replace('{amount}', '45').replace('{crop}', 'carottes').replace('{animal}', 'Un agneau perdu rejoint la bergerie.'), amount: k === 'coins' || k === 'chest' ? 40 : undefined };
        });
        onGameEvent({ type: 'finds', lotId: lot, lotName: 'Le terrain', finds }, g);
        return finds;
      },
      /** Récolte en série (comme un glissé) des parcelles mûres, une toutes les `ms` millisecondes. */
      swipe(ms = 70, q = null) {
        const g = app.game;
        if (!g) return 0;
        const list = g.state.plots.map((p, i) => i).filter((i) => g.query.plot(i)?.action === 'harvest');
        app.juice.swipeStart();
        list.forEach((i, k) => setTimeout(() => {
          if (q) window.__debug.lot2.forceQuality(i, q);
          if (g.actions.harvest(i)?.ok) app.vibrate(8);
          if (k === list.length - 1) app.juice.swipeEnd();
        }, k * ms));
        return list.length;
      },
      stats: () => ({ juice: app.juice.stats(), scene: app.scene?.lot2Stats?.(), voices: audio.synthVoices }),
    },
    /**
     * (Lot 3) Aides de vérification de la variété : chaque situation passe par l'action de débogage du cœur
     * (actions.triggerVariety : 'board' | 'cart' | 'merchant' | 'cards' | 'challenges' | 'theme') ou par les actions
     * publiques (récolte à la main pour remplir une commande). Alias : __debug.lot3.
     */
    variety: (() => {
      const V = {
        on: () => !!app.game?.state.variety,
        /** Requête complète (query.variety()). */
        state: () => (app.game?.state.variety ? app.game.query.variety?.() ?? null : null),
        /** actions.triggerVariety(kind, arg) puis fenêtres en attente. */
        trigger(kind, arg) {
          const g = app.game;
          if (!g) return { ok: false, reason: 'pas de partie' };
          const fn = g.actions.triggerVariety;
          if (typeof fn !== 'function') return { ok: false, reason: 'triggerVariety indisponible' };
          const res = fn(kind, arg);
          processPending();
          return res;
        },
        board: (arg) => V.trigger('board', arg),
        cart: (arg) => V.trigger('cart', arg),
        merchant: (arg) => V.trigger('merchant', arg),
        cards: (arg) => V.trigger('cards', arg),
        challenges: (arg) => V.trigger('challenges', arg),
        theme: (id) => V.trigger('theme', id),
        /** Médaille n (1..3) du défi id : le cœur seul sait compter ; essaie triggerVariety('medal'). */
        medal: (id, n = 1) => V.trigger('medal', { challengeId: id, medal: n }),
        /** Remplit la commande de la place `slot` par de vraies récoltes à la main (parcelles rendues mûres). */
        fill(slot = 0, units = null) {
          const g = app.game;
          const o = g?.query.orders?.()?.slots?.[slot];
          if (!o || o.empty) return { ok: false, reason: 'place vide' };
          let done = 0;
          for (const line of o.lines || []) {
            let left = units ?? (line.left ?? line.n - (line.got || 0));
            const crop = getCrop(line.cropId);
            const plots = g.state.plots.map((p, i) => ({ p, i })).filter(({ p }) => p && p.unlocked !== false && p.env !== null && !p.giant && (!p.cropId || getCrop(p.cropId)?.kind !== 'tree'));
            for (const { p, i } of plots) {
              if (left <= 0) break;
              p.cropId = line.cropId;
              p.growth = crop?.growDays ?? 3;
              p.watered = true;
              delete p.forage;
              const res = app.harvest(i);
              if (res?.ok) {
                left -= res.giant ? 4 : 1;
                done += 1;
              }
            }
          }
          processPending();
          return { ok: done > 0, harvested: done, order: g.query.orders?.()?.slots?.[slot] };
        },
        /** Ouvre une feuille : 'board' | 'cart' | 'merchant' | 'cards' | 'challenges' | 'theme'. */
        open(kind = 'board') {
          const f = { board: 'openBoard', cart: 'openCart', merchant: 'openMerchant', cards: 'openCards', challenges: 'openChallenges', theme: 'openTheme' }[kind];
          return f ? app.variety[f]() : false;
        },
        /** Avance jusqu'au soir du dernier jour de la saison (la fenêtre de fin de saison s'ouvre). */
        seasonEnd() {
          const g = app.game;
          if (!g) return 0;
          const s0 = g.state.time.seasonIndex;
          const y0 = g.state.time.year;
          let n = 0;
          while (g.state.status === 'playing' && g.state.time.seasonIndex === s0 && g.state.time.year === y0 && !app.dialogs.isOpen() && n < 40) {
            if (!window.__debug.skipDays(1)) break;
            n += 1;
          }
          return n;
        },
        /** Point (px de la page) d'une cible de la scène : 'board' | 'cart' | 'merchant' | 'visitor'. */
        point(kind = 'board') {
          const v = app.scene?.varietySpots?.();
          if (v && kind === 'visitor') return v.visitor ? worldToPage(v.visitor.x + 8, v.visitor.y - 7) : null;
          const r = v ? (kind === 'merchant' ? v.merchant : kind === 'cart' ? v.cart : v.board) : null;
          return r ? worldToPage(r.x + r.w / 2, r.y + r.h / 2) : null;
        },
        ui: () => app.variety.debugState(),
        stats: () => app.scene?.varietyStats?.() || null,
      };
      return V;
    })(),
    /**
     * (Lot 4) Aides de vérification « Collection & enjeux doux » : chaque situation passe par l'action de débogage du
     * cœur (actions.triggerCozy : 'fete' (id) | 'winter' | 'bird' (id) | 'trace' (kind) | 'story' | 'lanterns' |
     * 'ripe' (aubes)) ou par les actions publiques (feteFind, cookSoup, presentStand, giveBaskets, …). Alias :
     * __debug.lot4.
     */
    cozy: (() => {
      const C = {
        on: () => !!app.game?.state.cozy,
        /** Requête complète (query.cozy()). */
        state: () => (app.game?.state.cozy ? app.game.query.cozy?.() ?? null : null),
        /** actions.triggerCozy(kind, arg) puis fenêtres en attente. */
        trigger(kind, arg) {
          const g = app.game;
          if (!g) return { ok: false, reason: 'pas de partie' };
          const fn = g.actions.triggerCozy;
          if (typeof fn !== 'function') return { ok: false, reason: 'triggerCozy indisponible' };
          const res = fn(kind, arg);
          processPending();
          return res;
        },
        fete: (id) => C.trigger('fete', id),
        winter: () => C.trigger('winter'),
        bird: (id) => C.trigger('bird', id),
        trace: (kind) => C.trigger('trace', kind),
        story: () => C.trigger('story'),
        lanterns: () => C.trigger('lanterns'),
        ripe: (n = 4) => C.trigger('ripe', n),
        /** Trouve l'objet caché n° i (comme un toucher dans la scène). */
        find(i) {
          return app.cozy.onHit({ type: 'feteItem', index: i });
        },
        soup: (ids) => app.game?.actions.cookSoup?.((ids || []).map((id) => (typeof id === 'string' ? { kind: 'crop', id } : id))),
        stand: (items) => app.game?.actions.presentStand?.(items || []),
        baskets: (b) => app.game?.actions.giveBaskets?.(b || []),
        /** Ouvre une feuille : 'fete' | 'winter' | 'story' | 'lanterns' | 'album'. */
        open(kind = 'fete') {
          if (kind === 'album') return !!app.album.open();
          const f = { fete: 'openFete', winter: 'openWinter', story: 'openStory', lanterns: 'openLanterns' }[kind];
          return f ? app.cozy[f]() : false;
        },
        feteMode: (on = true) => (on ? app.cozy.enterFeteMode() : (app.cozy.leaveFeteMode(), false)),
        hint: () => app.cozy.showHint(),
        album: () => !!app.album.open(),
        albumAll: () => app.album.fillAll(),
        /** Point (px de la page) d'une cible du lot 4 : 'feteItem' (index) | 'winterFind' (id) | 'feeder' | … */
        point(kind, id) {
          const r = app.scene?.cozyItemRect?.(kind, id);
          return r ? worldToPage(r.x + r.w / 2, r.y + r.h / 2) : null;
        },
        ui: () => app.cozy.debugState(),
        stats: () => app.scene?.cozyStats?.() || null,
      };
      return C;
    })(),
    /** Centre du panneau d'un terrain (px de la page), si le rendu le connaît. */
    lotPoint(id) {
      const l = app.scene?.layout?.lots?.find?.((x) => x.id === id);
      if (!l) return null;
      // Panneau en tuiles (16 px), rectangle en px du monde.
      const p = l.sign ? { x: (l.sign.x + 1) * 16, y: (l.sign.y + 0.5) * 16 } : { x: l.rect.x + l.rect.w / 2, y: l.rect.y + l.rect.h / 2 };
      return worldToPage(p.x, p.y);
    },
  };
}

if (DEBUG) window.__debug.lot3 = window.__debug.variety;
if (DEBUG) window.__debug.lot4 = window.__debug.cozy;

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
