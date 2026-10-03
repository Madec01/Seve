// L'écran « La vallée » (Vallée vivante, lot V3 « Le ruisseau », docs/VALLEE.md § 17.3 ; contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V3 »).
//
// createValleyView(app) → app.valleyView = {
//   open({ placeId?, speciesId?, mushrooms?, first? }) → bool   écran plein (#valley-view, body.in-valley-view : barre du
//                            haut, onglets, ligne « À faire », zoom et mini-carte cachés), temps en pause
//                            (app.pushPause('valleyView')), ruban du haut, grand dessin qui défile, barre du bas
//                            « ‹ La ferme · 7 / 19 étapes · 62 signes de vie · Liste »
//   close({ silent? })       retour à la ferme, là où l'on était (Échap, bouton retour d'Android, « ‹ La ferme », la ferme)
//   active, frame(dt), reset(), onEvent(ev, game)
//   keepVisible(placeId | hit) garde un lieu (ou une cible) au-dessus de la feuille ouverte ; focusPlace(id)
//   targetPageRect(hit)      rectangle de la page d'une cible de la vue (conseils, vérification au doigt)
//   renderer                 la vue dessinée (src/render/valley-view.js) ; stats()
// }
// Gestes : glisser vertical = défiler (élan léger, pas de pincement), toucher = cible (src/render/valley-view.js, hitTest).
// Lecteurs d'écran : le canevas a role=img et un résumé ; la liste des lieux (bouton « Liste ») est la vraie navigation.

import { el, plural, setText } from '../dom.js';
import { icon } from '../icons.js';
import { createValleyView as createRenderer, viewLayout } from '../../render/valley-view.js';

const TAP_SLOP = 10;
const VIEW_Q_S = 0.25;

export function createValleyView(app) {
  let active = false;
  let renderer = null;
  let canvas = null;
  let root = null;
  let ribbon = null;
  let countNode = null;
  let view = null; // dernière requête valleyView()
  let viewT = -1;
  let clock = 0;
  let lastSize = '';
  let press = null; // { id, x, y, t, lastY, lastT, v, moved }
  let keep = null; // cible à garder au-dessus de la feuille : { place } | { hit }
  let lastOverlay = -1;
  let historyPushed = false;
  let ignorePops = 0; // retours d'historique lancés par close() lui-même (asynchrones)
  let summaryKey = '';

  const enabled = (g = app.game) => !!app.places?.placesOpen?.(g);
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Vue de la vallée :', err);
      return fallback;
    }
  }
  const q = (name, ...args) => {
    const fn = app.game?.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  };

  // ── DOM ──────────────────────────────────────────────────────────────────────
  function build() {
    if (root) return;
    canvas = el('canvas.vv-canvas', { id: 'valley-canvas', role: 'img', 'aria-label': 'La vallée vue de la colline' });
    ribbon = el('p.vv-ribbon', { id: 'vv-ribbon' }, 'La vallée');
    countNode = el('span.vv-count', { id: 'vv-count', 'aria-live': 'polite' });
    const back = el('button.vv-btn.vv-back', { type: 'button', id: 'vv-back', 'aria-label': 'Retour à la ferme', onclick: () => { app.vibrate?.(8); close(); } }, el('span.vv-back-arrow', { 'aria-hidden': 'true' }, '‹'), el('span', 'La ferme'));
    const list = el('button.vv-btn.vv-list', { type: 'button', id: 'vv-list', onclick: () => { app.vibrate?.(8); app.places?.openList?.(); } }, icon('menu', 'sm'), el('span', 'Liste'));
    const barNode = el('nav.vv-bar', { id: 'vv-bar', 'aria-label': 'La vallée' }, back, countNode, list);
    root = el('section.valley-view', { id: 'valley-view', 'aria-label': 'La vallée', hidden: true }, canvas, ribbon, barNode);
    document.body.append(root);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', () => { press = null; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      renderer?.scrollBy(e.deltaY);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('popstate', () => {
      if (ignorePops > 0) {
        ignorePops -= 1;
        return;
      }
      if (!active) return;
      historyPushed = false;
      close({ fromHistory: true });
    });
  }

  function ensureRenderer() {
    if (renderer) return renderer;
    const imgs = typeof app.images === 'function' ? app.images() : app.images;
    renderer = createRenderer(canvas, imgs || null, { reducedMotion: !!app.reducedMotion?.() });
    return renderer;
  }

  function insets() {
    const r = ribbon.getBoundingClientRect();
    const b = root.querySelector('#vv-bar').getBoundingClientRect();
    const vh = root.clientHeight || window.innerHeight;
    return { top: Math.max(0, Math.round(r.bottom)), bottom: Math.max(0, Math.round(vh - b.top)) };
  }

  function resize(force = false) {
    if (!renderer) return;
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const ins = insets();
    const key = `${w}x${h}@${dpr}|${ins.top}|${ins.bottom}`;
    if (!force && key === lastSize) return;
    lastSize = key;
    renderer.resize(viewLayout({ cssW: w, cssH: h, dpr, insetTop: ins.top, insetBottom: ins.bottom }));
  }

  // ── Gestes ───────────────────────────────────────────────────────────────────
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (!active || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    const p = local(e);
    renderer?.stopFling();
    press = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), lastY: p.y, lastT: performance.now(), v: 0, moved: false };
  }
  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    const p = local(e);
    if (!press.moved && Math.hypot(p.x - press.x, p.y - press.y) > TAP_SLOP) press.moved = true;
    if (!press.moved) return;
    const now = performance.now();
    const dy = p.y - press.lastY;
    renderer?.scrollBy(-dy);
    const dt = Math.max(1, now - press.lastT);
    press.v = 0.7 * press.v + 0.3 * (-dy / dt) * 1000;
    press.lastY = p.y;
    press.lastT = now;
  }
  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    const p = local(e);
    const was = press;
    press = null;
    if (was.moved) {
      if (performance.now() - was.lastT < 90 && Math.abs(was.v) > 80) renderer?.fling(was.v);
      return;
    }
    const hit = renderer?.hitTest(p.x, p.y);
    if (!hit) return;
    app.vibrate?.(8);
    if (hit.type === 'farm') {
      close();
      return;
    }
    app.places?.onViewHit?.(hit);
  }

  // ── Ouvrir, fermer ───────────────────────────────────────────────────────────
  function open(opts = {}) {
    const g = app.game;
    if (!g || app.inMenu || g.state.status !== 'playing' || !enabled(g)) return false;
    build();
    const res = safe(() => g.actions.career.openValleyView?.(), null);
    if (res && res.ok === false) {
      app.audio.play('error');
      app.toasts.show({ kind: 'error', text: res.reason || 'Pas encore.', log: false });
      return false;
    }
    if (app.valley?.placing) app.valley.leavePlacing({ silent: true });
    if (app.heritage?.pairing) app.heritage.leavePair({ silent: true });
    if (app.places?.wilding) app.places.leaveWild({ silent: true });
    if (app.sheets.isOpen()) app.sheets.close('silent');
    app.input?.cancel?.();
    const was = active;
    active = true;
    root.hidden = false;
    document.body.classList.add('in-valley-view');
    if (!was) {
      app.pushPause('valleyView');
      app.audio.play('open', { volume: 0.6 });
      try {
        if (!historyPushed) {
          history.pushState({ valleyView: true }, '');
          historyPushed = true;
        }
      } catch {
        historyPushed = false;
      }
    }
    ensureRenderer();
    renderer.setReducedMotion(!!app.reducedMotion?.());
    view = q('valleyView');
    viewT = clock;
    resize(true);
    // (QA du V3) Aucune feuille à l'ouverture : la place d'une ancienne feuille ne compte plus (sinon la vue défilait trop
    // loin, la bête ou le lieu visé hors de l'écran, après une fermeture faite feuille ouverte).
    renderer.setOverlay(0);
    lastOverlay = 0;
    renderer.render(view, 0);
    if (opts.placeId) renderer.scrollTo(opts.placeId, { animate: false });
    else if (opts.speciesId) {
      const t = renderer.targetRect?.({ type: 'viewAnimal', id: opts.speciesId });
      if (t) renderer.scrollTo({ x: 0, y: (t.y + renderer.scroll - renderer.layout.top) / (renderer.layout.zoom / renderer.layout.dpr), w: 16, h: 16 }, { animate: false });
    } else if (opts.mushrooms) renderer.scrollTo('combe', { animate: false });
    else if (!was) renderer.scrollTo('farm', { animate: false });
    if (opts.placeId) requestAnimationFrame(() => app.places?.openPlace?.(opts.placeId));
    const first = !!res?.first || !!opts.first;
    if (first || (view?.places || []).every((p) => !p.step && !p.works)) {
      setTimeout(() => app.hints?.maybe?.('valley.view', { rect: () => targetPageRect({ type: 'place', id: 'brook' }) }), 500);
    }
    if (opts.speciesId) setTimeout(() => app.hints?.maybe?.('valley.valleyAnimal', { rect: () => targetPageRect({ type: 'viewAnimal', id: opts.speciesId }) }), 600);
    if (app.keyboardMode) requestAnimationFrame(() => root.querySelector('#vv-list')?.focus());
    return true;
  }

  function close({ silent = false, fromHistory = false } = {}) {
    if (!active) return;
    active = false;
    keep = null;
    press = null;
    renderer?.setOverlay(0);
    lastOverlay = 0;
    if (app.sheets.isOpen()) app.sheets.close('silent');
    root.hidden = true;
    document.body.classList.remove('in-valley-view');
    app.popPause('valleyView');
    if (!silent) app.audio.play('close', { volume: 0.6 });
    if (historyPushed && !fromHistory) {
      historyPushed = false;
      try {
        if (history.state?.valleyView) {
          ignorePops += 1;
          history.back();
        }
      } catch {
        /* rien */
      }
    }
    app.tabbar?.refresh?.();
  }

  // ── Garder une cible au-dessus de la feuille ────────────────────────────────────
  function keepVisible(target) {
    if (!active || !renderer) return;
    keep = typeof target === 'string' ? { place: target } : target ? { hit: target } : null;
    lastOverlay = -1;
  }
  function applyKeep() {
    if (!keep || !renderer) return;
    const sheetOpen = app.sheets.isOpen();
    const sh = sheetOpen ? Math.round(app.sheets.box.getBoundingClientRect().height) : 0;
    const barH = insets().bottom;
    const ov = Math.max(0, sh - barH);
    if (ov === lastOverlay) return;
    lastOverlay = ov;
    renderer.setOverlay(ov);
    if (keep.place) renderer.scrollTo(keep.place, { animate: !app.reducedMotion?.() });
    else if (keep.hit) {
      const r = renderer.targetRect(keep.hit);
      if (r) {
        const L = renderer.layout;
        const k = L.zoom / L.dpr;
        renderer.scrollTo({ x: 0, y: (r.y + renderer.scroll - L.top) / k, w: r.w / k, h: r.h / k }, { animate: !app.reducedMotion?.() });
      }
    }
    if (!sheetOpen) keep = null;
  }
  function focusPlace(id) {
    if (!active || !renderer) return;
    renderer.setOverlay(0);
    renderer.scrollTo(id, { animate: !app.reducedMotion?.() });
  }

  function targetPageRect(hit) {
    if (!active || !renderer) return null;
    const r = hit?.type === 'place' ? renderer.placeRect(hit.id) : renderer.targetRect(hit);
    if (!r) return null;
    const c = canvas.getBoundingClientRect();
    return { left: c.left + r.x, top: c.top + r.y, right: c.left + r.x + r.w, bottom: c.top + r.y + r.h, width: r.w, height: r.h };
  }

  // ── Textes : ruban, compte, résumé lu ────────────────────────────────────────────
  function paintTexts() {
    const v = safe(() => app.game.query.career.valley(), null);
    if (!v) return;
    const st = v.stage || {};
    setText(ribbon, `La vallée · Étape ${st.n ?? 0}${st.name ? ` · ${st.name}` : ''}`);
    const list = Array.isArray(v.places) ? v.places : [];
    const done = list.reduce((a, p) => a + (p.step || 0), 0);
    const total = list.reduce((a, p) => a + (p.max || 0), 0) || 19;
    setText(countNode, `${done} / ${total} étapes · ${plural(st.signs || 0, 'signe de vie', 'signes de vie')}`);
    const key = list.map((p) => `${p.id}:${p.step}:${p.works ? p.works.daysLeft : '-'}`).join(',');
    if (key !== summaryKey) {
      summaryKey = key;
      const sum = list.map((p) => `${p.name}, étape ${p.step} sur ${p.max}${p.works ? `, en reprise, encore ${plural(p.works.daysLeft || 0, 'jour')}` : p.restored ? ', restauré' : ''}`).join(' ; ');
      canvas.setAttribute('aria-label', `La vallée vue de la colline. ${sum}. La liste des lieux est dans le bouton « Liste ».`);
    }
  }

  // ── À chaque image ─────────────────────────────────────────────────────────────
  let textT = -1;
  function frame(dt = 0) {
    clock += dt;
    if (!active) return;
    const g = app.game;
    if (!g || app.inMenu || g.state.status !== 'playing' || !enabled(g)) {
      close({ silent: true });
      return;
    }
    // Une fenêtre (fin de saison, nouveau rang) passe devant : la vue reste derrière, en pause.
    if (clock - viewT >= VIEW_Q_S || viewT < 0) {
      view = q('valleyView');
      viewT = clock;
    }
    if (clock - textT >= 0.5 || textT < 0) {
      textT = clock;
      paintTexts();
    }
    resize();
    applyKeep();
    if (!app.sheets.isOpen() && lastOverlay > 0) {
      lastOverlay = 0;
      renderer.setOverlay(0);
    }
    renderer.render(view, dt);
  }

  function onEvent(ev) {
    if (!active) return;
    if (['placeRecovered', 'worksStarted', 'mushroomsGrew', 'mushroomPicked', 'riverFished', 'speciesVisible', 'speciesInstalled', 'storyRead', 'valleyStage'].includes(ev.type)) viewT = -1;
  }

  function reset() {
    if (active) close({ silent: true });
    renderer?.reset?.();
    view = null;
    summaryKey = '';
  }

  return {
    open,
    close,
    get active() {
      return active;
    },
    frame,
    reset,
    onEvent,
    keepVisible,
    focusPlace,
    targetPageRect,
    get renderer() {
      return renderer;
    },
    stats: () => ({ active, view: view ? { places: (view.places || []).map((p) => [p.id, p.step, !!p.works]), animals: (view.animals || []).length, mushrooms: (view.mushrooms || []).length, river: view.river || null } : null, renderer: renderer?.stats?.() || null }),
  };
}
