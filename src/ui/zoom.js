// Zoom de la SCÈNE (le canevas de la ferme) : boutons + / −, retour au zoom par défaut, préférence retenue.
//
// À ne pas confondre avec la taille du texte (Options › Accessibilité, 100–150 %, src/ui/a11y.js) ni avec
// le zoom de la page du navigateur (option « pinchZoom », sur l'interface seulement) : ici, seule la
// ferme grossit ; l'interface ne bouge pas. Le pincement à deux doigts, le double toucher et Ctrl + molette
// sont dans src/ui/gestures.js ; la caméra (bornes, zoom entier, défilement) dans src/render/scene.js.
//
// createZoomControls(app) → { frame(), changed(), root, stored(mode) }
//   frame()    à chaque image, après scene.render : visibilité des boutons, préférence appliquée à chaque
//              nouvelle partie (ou retour au menu : zoom par défaut), enregistrement quand le zoom change.
//   changed()  le zoom vient de changer (geste) : enregistre tout de suite.
// Préférence locale (localStorage, clé `une-annee-a-la-ferme.zoom`) : { levels, career } = rapport au zoom
// par défaut (indépendant de l'écran), null ou absent = défaut.
// Boutons : colonne à droite (à gauche pour gaucher), au-dessus de la ligne « À faire » et des onglets, à
// gauche de la mini-carte en carrière ; cibles de 48 px ; cachés sous une feuille, une fenêtre, une bulle.

import { el } from './dom.js';

const STORE_KEY = 'une-annee-a-la-ferme.zoom';

function loadAll() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveAll(v) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(v));
  } catch {
    /* stockage indisponible : le zoom vaut pour cette partie */
  }
}

/** Glyphe dessiné en CSS (barres nettes, pas de police) : '+' ou '−'. */
function glyph(kind) {
  return el(`span.zoom-glyph.zoom-glyph--${kind}`, { 'aria-hidden': 'true' });
}

export function createZoomControls(app) {
  let prefs = loadAll();
  let appliedKey = null; // partie (et mode) dont la préférence a été appliquée
  let lastRatio; // dernier rapport enregistré / appliqué
  let visible = null;
  let lastState = '';

  const modeOf = () => (app.game?.mode === 'career' || app.scene?.careerMode ? 'career' : 'levels');

  function act(dir) {
    const s = app.scene;
    if (!s?.setZoom) return;
    const info = s.zoomInfo();
    if ((dir === 'in' && !info.canIn) || (dir === 'out' && !info.canOut)) {
      app.vibrate?.([30, 40, 30]);
      return;
    }
    s.setZoom(dir);
    app.audio?.play?.('click', { volume: 0.4 });
    app.vibrate?.(8);
    changed();
  }

  function reset() {
    const s = app.scene;
    if (!s?.setZoom) return;
    s.setZoom(null);
    app.audio?.play?.('click', { volume: 0.4 });
    app.vibrate?.(8);
    changed();
  }

  const inBtn = el('button.zoom-btn.zoom-in', { type: 'button', id: 'zoom-in', 'aria-label': 'Zoomer sur la ferme', title: 'Zoomer', onclick: () => act('in') }, el('span.zoom-face', glyph('plus')));
  const outBtn = el('button.zoom-btn.zoom-out', { type: 'button', id: 'zoom-out', 'aria-label': 'Dézoomer la ferme', title: 'Dézoomer', onclick: () => act('out') }, el('span.zoom-face', glyph('minus')));
  const resetBtn = el('button.zoom-btn.zoom-reset', { type: 'button', id: 'zoom-reset', 'aria-label': 'Zoom par défaut', title: 'Zoom par défaut', onclick: reset }, el('span.zoom-face', el('span.zoom-reset-text', { 'aria-hidden': 'true' }, '1:1')));
  const root = el('div.zoom-controls', { id: 'zoom-controls', role: 'group', 'aria-label': 'Zoom de la ferme', hidden: true }, resetBtn, inBtn, outBtn);
  document.body.append(root);
  // Le doigt sur les boutons ne doit pas partir vers la scène (ni zoomer la page).
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('dblclick', (e) => e.preventDefault());

  function save() {
    const s = app.scene;
    if (!s?.zoomInfo || app.inMenu || !app.game) return;
    const info = s.zoomInfo();
    if (info.gesture) return;
    const r = info.ratio;
    if (r === lastRatio) return;
    lastRatio = r;
    const mode = modeOf();
    if (r === null) delete prefs[mode];
    else prefs[mode] = r;
    saveAll(prefs);
  }

  function changed() {
    save();
  }

  /** Préférence de la partie (ou zoom par défaut au menu) appliquée une fois par partie et par mode. */
  function applyStored() {
    const s = app.scene;
    if (!s?.setZoomRatio) return;
    const key = app.inMenu || !app.game ? 'menu' : app.game;
    const mode = key === 'menu' ? 'menu' : modeOf();
    if (appliedKey && appliedKey.key === key && appliedKey.mode === mode) return;
    appliedKey = { key, mode };
    prefs = loadAll();
    const r = mode === 'menu' ? null : prefs[mode] ?? null;
    s.setZoomRatio(r);
    lastRatio = s.zoomInfo().ratio;
  }

  function wanted() {
    if (!app.game || app.inMenu || !app.scene?.zoomInfo) return false;
    // Grand écran : la feuille est rangée à droite, la ferme reste visible (les boutons se décalent, CSS).
    const wide = document.body.classList.contains('layout-wide');
    if ((app.sheets?.isOpen() && !wide) || app.dialogs?.isOpen()) return false;
    if (app.hints?.active || app.tutorial?.active) return false;
    return !document.body.classList.contains('is-loading');
  }

  function frame() {
    if (!app.scene?.zoomInfo) return;
    applyStored();
    const want = wanted();
    if (want !== visible) {
      visible = want;
      root.hidden = !want;
    }
    // Place : à gauche de la mini-carte (carrière), ou de son bouton « Carte » quand elle est cachée.
    const mm = app.careerUI?.minimap;
    const mmState = mm && !mm.root.hidden ? (mm.hidden ? 'collapsed' : 'shown') : 'none';
    const info = app.scene.zoomInfo();
    const state = `${mmState}|${info.canIn}|${info.canOut}|${info.isDefault}`;
    if (state !== lastState) {
      lastState = state;
      root.dataset.minimap = mmState;
      inBtn.setAttribute('aria-disabled', info.canIn ? 'false' : 'true');
      outBtn.setAttribute('aria-disabled', info.canOut ? 'false' : 'true');
      resetBtn.hidden = info.isDefault;
    }
    if (!info.gesture && !info.animating) save();
  }

  return {
    frame,
    changed,
    root,
    stored: (mode) => loadAll()[mode] ?? null,
  };
}
