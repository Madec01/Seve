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
// Boutons : colonne collée au bord de l'écran (marge de sécurité comprise). Carrière : à droite, juste au-dessus de
// la mini-carte (ou de son bouton « Carte » quand elle est repliée), alignée sur elle, gaucher compris (la mini-carte
// ne change pas de côté). Niveaux : au même endroit, au-dessus de la ligne « À faire » ; à gauche pour gaucher.
// Ancrée par le bas, « 1:1 » en haut : + et − ne bougent pas. Cibles de 48 px ; cachés sous une feuille, une fenêtre,
// une bulle, dans la vue de la vallée. Placement en CSS (css/style.css, `data-minimap` = shown | collapsed | none).
// Place des messages : frame() publie la hauteur occupée en bas par la mini-carte (`--float-reserve`) et la largeur
// occupée au bord par la colonne (`--float-col-r` / `--float-col-l`) sur <html>, classe `body.has-float-ui` ; les
// messages se posent au-dessus de la mini-carte et à côté de la colonne (css/guidance.css), jamais sur un bouton
// + / − / 1:1, sur la mini-carte ni sur la ligne « À faire ».

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

  // ── Place réservée aux messages (#toasts, src/ui/toasts.js ; css/guidance.css) ─────────────────────
  // En hauteur : la mini-carte (cadre, boutons de coin, ou bouton « Carte ») ; les messages se posent au-dessus.
  // En largeur : la colonne de zoom, collée au bord ; les messages se rangent à côté d'elle (sur toute la hauteur,
  // « 1:1 » ou pas : la largeur ne change pas, les messages ne sautent pas quand on zoome).
  const RESERVE_GAP = 8;
  let reserveAt = 0;
  let reserveKey = '';
  let lastReserveState = ''; // état des boutons / de la mini-carte à la dernière mesure
  function measureReserve(force) {
    const now = performance.now();
    if (!force && now - reserveAt < 250) return;
    reserveAt = now;
    const de = document.documentElement;
    const vh = de.clientHeight || window.innerHeight;
    const vw = de.clientWidth || window.innerWidth;
    const wide = document.body.classList.contains('layout-wide');
    const off = wide || app.valleyView?.active; // grand écran : messages ailleurs ; vue de la vallée : tout est caché
    let top = Infinity;
    let colL = 0;
    let colR = 0;
    if (!off && !root.hidden) {
      const r = root.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) {
        if (r.left + r.width / 2 > vw / 2) colR = Math.ceil(vw - r.left);
        else colL = Math.ceil(r.right);
      }
    }
    const mm = app.careerUI?.minimap;
    if (!off && mm && !mm.root.hidden) {
      for (const n of mm.root.querySelectorAll('.minimap-frame, .minimap-btn, .minimap-show')) {
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.width > 0) top = Math.min(top, r.top);
      }
    }
    const h = Number.isFinite(top) ? Math.max(0, Math.ceil(vh - top + RESERVE_GAP)) : 0;
    const key = `${h}|${colL}|${colR}`;
    if (key === reserveKey) return;
    reserveKey = key;
    de.style.setProperty('--float-reserve', `${h}px`);
    de.style.setProperty('--float-col-l', `${colL}px`);
    de.style.setProperty('--float-col-r', `${colR}px`);
    document.body.classList.toggle('has-float-ui', h > 0 || colL > 0 || colR > 0);
  }

  function save() {
    const s = app.scene;
    if (!s?.zoomInfo || app.inMenu || !app.game) return;
    const info = s.zoomInfo();
    if (info.gesture || info.forced) return; // (Vallée V3) zoom tactile d'un mode de visée : pas une préférence
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
    app.coach?.signal?.('zoom', { ratio: app.scene?.zoomInfo?.().ratio ?? null });
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
    // (Accompagnement) Une bulle de Joseph couvre l'écran : les boutons se cachent, sauf pendant la leçon du zoom.
    if (app.coach?.blocking && app.coach.current?.lessonId !== 'basics.zoom') return false;
    if (app.valleyView?.active) return false; // (Vallée V3) l'écran « La vallée »
    return !document.body.classList.contains('is-loading');
  }

  function frame() {
    if (!app.scene?.zoomInfo) return;
    applyStored();
    const want = wanted();
    if (want !== visible) {
      visible = want;
      root.hidden = !want;
      lastReserveState = ''; // mesure tout de suite
    }
    // Place (CSS, data-minimap) : au bord, au-dessus de la mini-carte (carrière), ou de son bouton « Carte » quand
    // elle est repliée ; au-dessus de la ligne « À faire » en Niveaux.
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
    measureReserve(state !== lastReserveState);
    lastReserveState = state;
  }

  return {
    frame,
    changed,
    root,
    stored: (mode) => loadAll()[mode] ?? null,
  };
}
