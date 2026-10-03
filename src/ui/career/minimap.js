// Mode Carrière — mini-carte (retour d'un joueur, carte 2D, docs/CARRIERE.md § 10.4).
//
// createMinimap(app, { active, openLot(lotId), openMap() }) → { frame(), setHidden(bool), hidden, root }
//
// Un petit canevas en bas à droite, au-dessus des onglets, redessiné à chaque image par la scène
// (scene.getMinimap({ w, h, ctx }) : fond en cache, vue courante, repères). Gestes :
//   - toucher : la vue va au point touché (scene.minimapToWorld → scene.focusWorld, animé) ;
//   - glisser : la vue suit le doigt (on « promène » le cadre sur la mini-carte) ;
//   - appui long : la fiche du terrain touché (scene.minimapLotAt), sinon la grande carte.
// Deux petits boutons à ses coins (cibles de 48 px) : « Cacher » (choix retenu d'une partie à l'autre)
// et « Grande carte » (la carte des terrains, feuille haute). Cachée, elle laisse un bouton rond « Carte ».
// Jamais par-dessus une feuille, une fenêtre, une bulle du tutoriel ou d'un conseil : elle s'efface.

import { el } from '../dom.js';
import { icon } from '../icons.js';
import { cIcon } from './util.js';

const STORE_KEY = 'une-annee-a-la-ferme.minimap';
const LONG_MS = 450;
const SLOP = 7; // px CSS avant de considérer qu'on glisse sur la mini-carte

function loadHidden() {
  try {
    return localStorage.getItem(STORE_KEY) === 'hidden';
  } catch {
    return false;
  }
}

function saveHidden(hidden) {
  try {
    localStorage.setItem(STORE_KEY, hidden ? 'hidden' : 'shown');
  } catch {
    /* stockage indisponible : le choix vaut pour cette partie */
  }
}

/** Taille de la mini-carte (px CSS) selon l'écran : plus petite sur les petits téléphones. */
function sizeFor(w, h) {
  if (h < 700 || w < 370) return { w: 84, h: 116 };
  return { w: 96, h: 132 };
}

export function createMinimap(app, hooks) {
  let hidden = loadHidden();
  let visible = null; // dernier état appliqué (null : jamais)
  let size = { w: 0, h: 0 };
  let dpr = 0;
  let press = null; // { id, x0, y0, dragging, long, timer }
  let broken = false; // la scène n'a pas su dessiner : on n'insiste pas

  const canvas = el('canvas.minimap-canvas', { width: 1, height: 1 });
  const box = el(
    'div.minimap-frame',
    { role: 'img', 'aria-label': 'Mini-carte de la ferme : touchez un endroit pour y aller, appui long pour la fiche du terrain' },
    canvas,
  );
  const hideBtn = el(
    'button.minimap-btn.minimap-hide',
    { type: 'button', id: 'minimap-hide', 'aria-label': 'Cacher la mini-carte', onclick: () => setHidden(true, true) },
    el('span.minimap-btn-face', icon('close', 'sm')),
  );
  const bigBtn = el(
    'button.minimap-btn.minimap-big',
    { type: 'button', id: 'minimap-big', 'aria-label': 'Grande carte des terrains', onclick: () => {
      app.audio.play('page', { volume: 0.6 });
      hooks.openMap();
    } },
    el('span.minimap-btn-face'),
  );
  const showBtn = el(
    'button.minimap-show',
    { type: 'button', id: 'minimap-show', 'aria-label': 'Afficher la mini-carte', onclick: () => setHidden(false, true) },
  );
  // Icônes de la planche : posées à la première image affichée (les images du jeu sont alors chargées).
  let iconsDone = false;
  function fillIcons() {
    iconsDone = true;
    bigBtn.firstChild.replaceChildren(cIcon('map', 'sprite--sm', 'seed'));
    showBtn.replaceChildren(cIcon('map', 'sprite--md', 'seed'));
  }
  const root = el('div.minimap', { id: 'minimap', hidden: true }, box, hideBtn, bigBtn, showBtn);
  document.body.append(root);

  function setHidden(v, fromUser = false) {
    hidden = !!v;
    saveHidden(hidden);
    root.classList.toggle('is-collapsed', hidden);
    if (fromUser) {
      app.audio.play('toggle', { volume: 0.6 });
      app.vibrate?.(8);
    }
  }
  root.classList.toggle('is-collapsed', hidden);

  // ── Gestes ────────────────────────────────────────────────────────────────────
  /** Point du doigt → px du canevas. */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    const kx = canvas.width / Math.max(1, r.width);
    const ky = canvas.height / Math.max(1, r.height);
    return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky, cx: e.clientX, cy: e.clientY };
  }

  function goTo(p, animate) {
    const s = app.scene;
    if (!s?.minimapToWorld) return;
    const w = s.minimapToWorld(p.x, p.y, { w: canvas.width, h: canvas.height });
    if (w) s.focusWorld(w.x, w.y, { animate });
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    const p = local(e);
    press = { id: e.pointerId, x0: p.cx, y0: p.cy, dragging: false, long: false, timer: null, p };
    press.timer = setTimeout(() => {
      if (!press || press.dragging) return;
      press.long = true;
      app.vibrate?.(20);
      const lotId = app.scene?.minimapLotAt?.(press.p.x, press.p.y);
      if (lotId) hooks.openLot(lotId);
      else hooks.openMap();
    }, LONG_MS);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id || press.long) return;
    const p = local(e);
    press.p = p;
    if (!press.dragging && Math.hypot(p.cx - press.x0, p.cy - press.y0) > SLOP) {
      press.dragging = true;
      clearTimeout(press.timer);
    }
    if (press.dragging) goTo(p, false);
  });
  const end = (e, cancelled) => {
    if (!press || e.pointerId !== press.id) return;
    const cur = press;
    press = null;
    clearTimeout(cur.timer);
    if (cancelled || cur.long || cur.dragging) return;
    app.audio.play('click', { volume: 0.4 });
    goTo(local(e), true);
  };
  canvas.addEventListener('pointerup', (e) => end(e, false));
  canvas.addEventListener('pointercancel', (e) => end(e, true));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Molette sur la mini-carte : fait défiler la scène (comme au-dessus de la ferme).
  root.addEventListener('wheel', (e) => {
    const s = app.scene;
    if (!s?.careerMode) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : 1;
    s.scrollBy((e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k, (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k);
  }, { passive: false });

  // ── Image ─────────────────────────────────────────────────────────────────────
  /** Doit-elle être à l'écran ? Jamais sur une feuille, une fenêtre, une bulle, ni hors carrière. */
  function wanted() {
    const s = app.scene;
    if (broken || !hooks.active() || !s?.careerMode || typeof s.getMinimap !== 'function') return false;
    if (app.sheets?.isOpen() || app.dialogs?.isOpen() || app.decor?.active) return false;
    if (app.valleyView?.active) return false; // (Vallée V3) l'écran « La vallée » couvre la ferme
    if (app.hints?.active || app.tutorial?.active) return false;
    if (document.body.classList.contains('is-loading')) return false;
    return true;
  }

  function frame() {
    const want = wanted();
    if (want !== visible) {
      visible = want;
      root.hidden = !want;
      if (want && !iconsDone) fillIcons();
      if (!want && press) {
        clearTimeout(press.timer);
        press = null;
      }
    }
    if (!want || hidden || document.hidden) return;
    const sz = sizeFor(window.innerWidth, window.innerHeight);
    const d = window.devicePixelRatio || 1;
    if (sz.w !== size.w || sz.h !== size.h || d !== dpr) {
      size = sz;
      dpr = d;
      box.style.width = `${sz.w}px`;
      box.style.height = `${sz.h}px`;
      canvas.style.width = `${sz.w}px`;
      canvas.style.height = `${sz.h}px`;
      canvas.width = Math.round(sz.w * d);
      canvas.height = Math.round(sz.h * d);
    }
    try {
      app.scene.getMinimap({ w: canvas.width, h: canvas.height, ctx: canvas.getContext('2d') });
    } catch (err) {
      console.warn('Mini-carte :', err);
      broken = true;
    }
  }

  return {
    frame,
    setHidden,
    get hidden() {
      return hidden;
    },
    get shown() {
      return !!visible && !hidden;
    },
    root,
  };
}
