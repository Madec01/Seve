// Accessibilité : application des réglages d'affichage et de confort (section « Accessibilité »
// des options, fenêtre du premier lancement dans src/ui/dialogs.js).
//
//   applyA11y(app)          applique tous les réglages (classes de <html>, viewport, scène, partie)
//   initA11y(app)           une fois au démarrage (appelé par createHud) : écouteurs système
//   speedCycle(settings)    vitesses du bouton : [½,] ×1, ×2, ×4 (puis pause)
//   nextSpeed(sp, settings) vitesse suivante au toucher du bouton
//   slowSpeedSupported()    le cœur accepte-t-il la vitesse ×½ ?
//   pauseOnSheetActive(app) pause pendant la lecture d'une fiche (réglage, ou « auto » = Détente)
//
// Classes posées sur <html> (lues par css/style.css) :
//   font-readable   police Atkinson Hyperlegible (« Lisible ») pour les textes de l'interface
//   high-contrast   contrastes renforcés
//   controls-bottom bouton de vitesse dans la barre d'onglets (à portée de pouce)
//   left-handed     disposition miroir (bouton de vitesse à gauche)
//   --text-scale    facteur de la taille du texte (html { font-size: calc(16px * var(--text-scale)) })
//   data-text-scale 100 · 115 · 130 · 150 (ajustements de mise en page aux grandes tailles)
//
// Tout appel vers le cœur ou la scène est protégé par un test d'existence : les lots qui les
// ajoutent (vitesse ×½, pause chaque matin, scene.setReducedMotion, scene.setPlotHints) peuvent
// arriver séparément.

import { SPEEDS } from '../data/balance.js';

const VIEWPORT_ZOOM = 'width=device-width, initial-scale=1, viewport-fit=cover';
const VIEWPORT_LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

/** Le cœur accepte la vitesse ×½ (src/data/balance.js SPEEDS). */
export function slowSpeedSupported() {
  return Array.isArray(SPEEDS) && SPEEDS.includes(0.5);
}

/** Vitesses parcourues par le bouton (la pause vient après la dernière). */
export function speedCycle(settings) {
  return settings?.slowSpeed && slowSpeedSupported() ? [0.5, 1, 2, 4] : [1, 2, 4];
}

/** Vitesse suivante : pause → première vitesse du cycle → … → ×4 → pause. */
export function nextSpeed(sp, settings) {
  const cycle = speedCycle(settings);
  if (sp === 0) return cycle[0];
  const i = cycle.indexOf(sp);
  if (i === -1) return sp < 1 ? 1 : 0; // ×½ alors que l'option est coupée : on repasse à ×1
  return i === cycle.length - 1 ? 0 : cycle[i + 1];
}

/** Texte court de la vitesse (bouton) : « ×½ », « ×1 »… */
export function speedText(sp) {
  return sp === 0.5 ? '×½' : `×${sp}`;
}

/** Difficulté de la partie en cours (ou celle des prochaines parties, depuis le menu). */
function currentDifficulty(app) {
  const g = app.game && !app.inMenu ? app.game : null;
  if (g) return g.mode === 'career' ? g.state?.career?.difficulty || g.difficulty : g.difficulty || g.state?.difficulty;
  try {
    return app.difficulty?.();
  } catch {
    return null;
  }
}

/** Pause pendant la lecture d'une fiche : 'on' / 'off', ou 'auto' = oui sauf en mode Classique. */
export function pauseOnSheetActive(app) {
  const v = app.settings?.pauseOnSheet;
  if (v === 'on') return true;
  if (v === 'off') return false;
  return currentDifficulty(app) !== 'classique';
}

function setViewport(zoom) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const want = zoom ? VIEWPORT_ZOOM : VIEWPORT_LOCKED;
  if (meta.getAttribute('content') !== want) meta.setAttribute('content', want);
}

/** Réglages qui touchent la scène (canvas) : animations réduites, repères des parcelles. */
export function applySceneA11y(app) {
  const s = app.scene;
  if (!s) return;
  const reduce = typeof app.reducedMotion === 'function' ? app.reducedMotion() : !!app.settings.reducedMotion;
  try {
    if (typeof s.setReducedMotion === 'function') s.setReducedMotion(reduce);
    if (typeof s.setPlotHints === 'function') s.setPlotHints(!!app.settings.plotHints);
  } catch (err) {
    console.warn('Accessibilité (scène) :', err);
  }
}

/** Réglages qui touchent la partie : pause au début de chaque journée. */
export function applyGameA11y(app) {
  const g = app.game;
  if (!g) return;
  const on = !!app.settings.autoPauseDawn;
  try {
    if (typeof g.actions?.setOption === 'function') g.actions.setOption('autoPauseDawn', on);
    else if (typeof g.setOption === 'function') g.setOption('autoPauseDawn', on);
  } catch (err) {
    console.warn('Accessibilité (partie) :', err);
  }
}

/** La partie sait-elle se mettre en pause chaque matin ? */
export function autoPauseDawnSupported(app) {
  const g = app.game || app.attractGame || null;
  if (g) return typeof g.actions?.setOption === 'function' || typeof g.setOption === 'function';
  return true; // pas de partie à interroger (menu) : le cœur la gère (src/core/options.js)
}

/** Applique tous les réglages d'accessibilité. Sans effet de bord si rien n'a changé. */
export function applyA11y(app) {
  const s = app.settings;
  const root = document.documentElement;
  const scale = Number(s.textScale) || 1;
  root.style.setProperty('--text-scale', String(scale));
  root.dataset.textScale = String(Math.round(scale * 100));
  root.classList.toggle('font-readable', !!s.readableFont);
  root.classList.toggle('high-contrast', !!s.highContrast);
  root.classList.toggle('controls-bottom', !!s.controlsBottom);
  root.classList.toggle('left-handed', !!s.leftHanded);
  setViewport(s.pinchZoom !== false);
  applySceneA11y(app);
  applyGameA11y(app);
  app.hud?.syncDock?.();
  // La hauteur de la barre du haut et des onglets change avec la taille du texte : la scène et
  // la feuille ouverte se recalent (ResizeObserver de main.js) ; la feuille republie sa hauteur.
  app.sheets?.refit?.();
}

let started = false;
/** Une seule fois au démarrage : préférence système « réduire les animations », grand écran. */
export function initA11y(app) {
  if (started) return;
  started = true;
  // Points d'entrée pour main.js (ex. après la création d'une nouvelle scène dans resizeScene).
  app.applyA11y = () => applyA11y(app);
  app.applySceneA11y = () => applySceneA11y(app);
  applyA11y(app);
  // La préférence système peut changer en cours de partie (main.js ne la lit qu'au démarrage).
  try {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', () => {
      document.documentElement.classList.toggle('reduced-motion', !!app.settings.reducedMotion || mq.matches);
      applySceneA11y(app);
    });
  } catch {
    /* navigateur ancien */
  }
  // Zoom à deux doigts : main.js écrit --app-h depuis visualViewport.height, qui rétrécit quand la
  // page est agrandie (×2 → la mise en page tiendrait dans la moitié de l'écran). Ces écouteurs
  // passent après ceux de main.js et remettent la hauteur réelle (hauteur visible × zoom).
  const vv = window.visualViewport;
  if (vv) {
    const fixZoomHeight = () => {
      if (vv.scale <= 1.01) return;
      document.documentElement.style.setProperty('--app-h', `${Math.round(vv.height * vv.scale)}px`);
    };
    vv.addEventListener('resize', fixZoomHeight);
    window.addEventListener('resize', fixZoomHeight);
  }
  // Grand écran en paysage (body.layout-wide, posé par main.js) : la vitesse reste en haut.
  new MutationObserver(() => app.hud?.syncDock?.()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
