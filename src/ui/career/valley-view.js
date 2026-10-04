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
// (Lot V4 « Les cigognes ») open({ visitorId?, bench? }) ; startCredits(credits, { onEnd }) : le générique doux (vue au soir,
//   ruban et barre cachés, « Passer » ≥ 48 px, cartes 16 px, musique coupée en 3 s, seule la vallée s'entend, temps en
//   pause ; mouvements réduits : une carte par toucher) ; startContemplate() : « S'asseoir sur le banc » (défilement lent,
//   sans texte, à quitter d'un toucher) ; crediting, contemplating ; bouton « S'asseoir » dans la barre (après l'épilogue) ;
//   écoute du paysage sonore au défilement (audio.setNatureListener) ; musique × 0,6 dans la vue (audio.setMusicScale).
// Gestes : glisser vertical = défiler (élan léger, pas de pincement), toucher = cible (src/render/valley-view.js, hitTest).
// Lecteurs d'écran : le canevas a role=img et un résumé ; la liste des lieux (bouton « Liste ») est la vraie navigation.

import { el, plural, setText } from '../dom.js';
import { icon } from '../icons.js';
import { createValleyView as createRenderer, viewLayout } from '../../render/valley-view.js';
import { SIGNALS } from '../coach/signals.js';

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
  // (V4) Générique et contemplation.
  let credits = null; // { info, t, idx, shown, onEnd, still, end }
  let contemplating = false;
  let creditsNode = null;
  let cardNode = null;
  let skipBtn = null;
  let benchBtn = null;
  let listenKey = '';
  let listenT = 0;

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
    benchBtn = el('button.vv-btn.vv-bench', { type: 'button', id: 'vv-bench', hidden: true, 'aria-label': 'S\'asseoir sur le banc', onclick: () => { app.vibrate?.(8); startContemplate(); } }, el('span.vv-bench-ico', { 'aria-hidden': 'true' }, '🪑'), el('span', 'S\'asseoir'));
    const barNode = el('nav.vv-bar', { id: 'vv-bar', 'aria-label': 'La vallée' }, back, countNode, benchBtn, list);
    cardNode = el('p.vv-card', { id: 'vv-card', 'aria-live': 'polite', hidden: true });
    skipBtn = el('button.vv-btn.vv-skip', { type: 'button', id: 'vv-skip', onclick: (e) => { e.stopPropagation(); app.vibrate?.(8); endCredits({ skipped: true }); } }, 'Passer');
    creditsNode = el('div.vv-credits', { id: 'vv-credits', hidden: true }, cardNode, skipBtn, el('p.vv-still-hint', { id: 'vv-still-hint', hidden: true }, 'Touchez pour la suite'));
    root = el('section.valley-view', { id: 'valley-view', 'aria-label': 'La vallée', hidden: true }, canvas, ribbon, barNode, creditsNode);
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
    if (!press.moved || credits || contemplating) return;
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
    // (V4) Contemplation : un toucher quitte le banc. Générique : un toucher met en pause / reprend (mouvements réduits :
    // carte suivante).
    if (contemplating) {
      stopContemplate();
      return;
    }
    if (credits) {
      creditsTap();
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
    } else if (opts.visitorId) {
      const t = renderer.targetRect?.({ type: 'visitor', id: opts.visitorId });
      if (t) renderer.scrollTo({ x: 0, y: (t.y + renderer.scroll - renderer.layout.top) / (renderer.layout.zoom / renderer.layout.dpr), w: 16, h: 16 }, { animate: false });
    } else if (opts.bench) renderer.scrollTo({ x: 144, y: 138, w: 32, h: 16 }, { animate: false });
    else if (opts.mushrooms) renderer.scrollTo('combe', { animate: false });
    else if (!was) renderer.scrollTo('farm', { animate: false });
    if (opts.placeId) requestAnimationFrame(() => app.places?.openPlace?.(opts.placeId));
    // Joseph montre la vue (leçons valley.view, valley.valleyAnimal… : src/ui/coach/lessons/valley.js).
    if (!was) app.coach?.signal?.(SIGNALS.viewOpen);
    // (V4) La vallée passe devant : musique × 0,6, paysage sonore de la vue.
    if (!was) {
      app.audio.setMusicScale?.(0.6);
      listenKey = '';
      app.updateAmbience?.();
    }
    if (app.keyboardMode) requestAnimationFrame(() => root.querySelector('#vv-list')?.focus());
    return true;
  }

  function close({ silent = false, fromHistory = false } = {}) {
    if (!active) return;
    if (credits) endCredits({ skipped: true, closing: true });
    if (contemplating) stopContemplate({ closing: true });
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
    app.coach?.signal?.(SIGNALS.viewClose);
    app.audio.setMusicScale?.(1);
    app.updateAmbience?.();
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

  // ── (V4) Le générique doux ──────────────────────────────────────────────────────
  const CREDIT_DUR = 70;
  function creditCards(info) {
    const out = (info.cards || []).map((c) => ({ title: c.name, text: c.text, placeId: c.placeId }));
    if (info.total) out.push({ title: info.title || '', text: info.total });
    for (const line of info.end || []) out.push({ title: '', text: line, end: true });
    return out;
  }
  /** Démarre le générique : la vue au soir, du ciel jusqu'à la ferme ; musique coupée, seule la vallée s'entend. */
  function startCredits(info = {}, { onEnd } = {}) {
    if (!active && !open({ credits: true })) return false;
    if (app.sheets.isOpen()) app.sheets.close('silent');
    contemplating && stopContemplate({ closing: true });
    const still = !!app.reducedMotion?.();
    credits = { info, cards: creditCards(info), t: 0, idx: -1, onEnd, still, paused: false, endT: 0 };
    document.body.classList.add('in-valley-credits');
    creditsNode.hidden = false;
    root.querySelector('#vv-still-hint').hidden = !still;
    app.pushPause('credits');
    app.audio.playMusic?.(null, { fade: 3 });
    renderer.setTint?.(0.25);
    renderer.setOverlay(0);
    keep = null;
    if (still) {
      renderer.stopAuto?.();
      showCard(0);
    } else renderer.setAuto?.({ mode: 'credits', duration: CREDIT_DUR });
    canvas.setAttribute('aria-label', `${info.title || 'La vallée'} : la vallée au soir. Touchez pour mettre en pause ; « Passer » pour revenir à la ferme.`);
    app.updateAmbience?.();
    requestAnimationFrame(() => skipBtn?.focus?.({ preventScroll: true }));
    return true;
  }
  function showCard(i) {
    if (!credits) return;
    credits.idx = i;
    const c = credits.cards[i];
    if (!c) {
      cardNode.hidden = true;
      return;
    }
    cardNode.hidden = false;
    cardNode.classList.toggle('is-end', !!c.end);
    cardNode.replaceChildren(c.title ? el('b.vv-card-title', c.title) : '', c.text ? el('span.vv-card-text', c.text) : '');
    if (credits.still && c.placeId) renderer.scrollTo(c.placeId, { animate: false });
    if (credits.still && !c.placeId) renderer.scrollTo('farm', { animate: false });
  }
  function stepCredits(dt) {
    const c = credits;
    if (!c || c.still) return;
    if (c.paused) return;
    c.t += dt;
    // Les cartes des lieux au fil du défilement (du ciel à la ferme), puis le total et les deux lignes de la fin.
    const nPlaces = c.cards.filter((x) => x.placeId).length;
    const step = (CREDIT_DUR * 0.75) / Math.max(1, nPlaces);
    let want = -1;
    if (c.t >= 4) {
      const i = Math.floor((c.t - 4) / step);
      if (i < nPlaces) want = (c.t - 4) % step < step * 0.85 ? i : -1;
      else {
        const rest = c.t - 4 - nPlaces * step;
        const j = nPlaces + Math.floor(rest / 5);
        want = j < c.cards.length ? j : -1;
        if (j >= c.cards.length && rest > (c.cards.length - nPlaces) * 5 + 2) {
          endCredits({ skipped: false });
          return;
        }
      }
    }
    if (want !== c.idx) showCard(want);
  }
  function creditsTap() {
    const c = credits;
    if (!c) return;
    if (c.still) {
      // Mouvements réduits : une carte par toucher, puis la fin.
      if (c.idx + 1 >= c.cards.length) endCredits({ skipped: false });
      else showCard(c.idx + 1);
      return;
    }
    c.paused = !c.paused;
    renderer.autoPaused = c.paused;
    root.classList.toggle('is-paused', c.paused);
    app.toasts.show({ kind: 'info', text: c.paused ? 'En pause : touchez pour reprendre.' : 'La vallée reprend.', duration: 1400, log: false, key: 'vv-credits' });
  }
  function endCredits({ skipped = false, closing = false } = {}) {
    const c = credits;
    if (!c) return;
    credits = null;
    document.body.classList.remove('in-valley-credits');
    root.classList.remove('is-paused');
    creditsNode.hidden = true;
    cardNode.hidden = true;
    renderer?.stopAuto?.();
    renderer?.setTint?.(0);
    app.popPause('credits');
    try {
      c.onEnd?.({ skipped });
    } catch (err) {
      console.warn('Générique :', err);
    }
    // La musique de saison revient (fondu 2 s).
    const season = (() => {
      try {
        return app.game?.query?.calendar?.().seasonId || null;
      } catch {
        return null;
      }
    })();
    if (season) app.audio.playMusic?.(season, { fade: 2 });
    if (!closing) close({ silent: true });
  }

  // ── (V4) S'asseoir sur le banc ─────────────────────────────────────────────────
  function startContemplate() {
    if (!active || credits) return false;
    if (!view?.canContemplate) return false;
    if (app.sheets.isOpen()) app.sheets.close('silent');
    contemplating = true;
    keep = null;
    document.body.classList.add('in-valley-contemplate');
    renderer.setOverlay(0);
    renderer.setTint?.(view?.villageLights ? 0.18 : 0);
    if (!app.reducedMotion?.()) renderer.setAuto?.({ mode: 'contemplate' });
    canvas.setAttribute('aria-label', 'Assis sur le banc : la vallée défile lentement. Touchez pour vous lever.');
    app.toasts.show({ kind: 'info', text: 'Touchez l\'écran pour vous lever.', duration: 2200, log: false, key: 'vv-sit' });
    return true;
  }
  function stopContemplate({ closing = false } = {}) {
    if (!contemplating) return;
    contemplating = false;
    document.body.classList.remove('in-valley-contemplate');
    renderer?.stopAuto?.();
    renderer?.setTint?.(0);
    summaryKey = '';
    if (!closing) app.audio.play('close', { volume: 0.4 });
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
    if (benchBtn) benchBtn.hidden = !view?.canContemplate;
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
    if (credits) stepCredits(dt);
    applyKeep();
    // (V4) Écoute du paysage sonore : le centre de la partie visible (≤ 10 fois par seconde, s'il a bougé).
    listenT += dt;
    if (listenT >= 0.1) {
      listenT = 0;
      const l = renderer.listener?.();
      const k = l ? `${l.y}|${l.h}` : '';
      if (l && k !== listenKey) {
        listenKey = k;
        app.audio.setNatureListener?.({ y: l.y, h: l.h });
      }
    }
    if (!app.sheets.isOpen() && lastOverlay > 0) {
      lastOverlay = 0;
      renderer.setOverlay(0);
    }
    renderer.render(view, dt);
  }

  function onEvent(ev) {
    if (!active) return;
    if (['placeRecovered', 'worksStarted', 'mushroomsGrew', 'mushroomPicked', 'riverFished', 'speciesVisible', 'speciesInstalled', 'storyRead', 'valleyStage', 'visitorVisible', 'visitorSeen', 'visitorHint', 'storksArrived', 'epilogueAvailable', 'epilogueRead'].includes(ev.type)) viewT = -1;
  }

  function reset() {
    if (credits) endCredits({ skipped: true, closing: true });
    if (contemplating) stopContemplate({ closing: true });
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
    startCredits,
    endCredits: (o) => endCredits(o || { skipped: true }),
    startContemplate,
    stopContemplate,
    get crediting() {
      return !!credits;
    },
    get contemplating() {
      return contemplating;
    },
    creditsState: () => (credits ? { t: Math.round(credits.t * 10) / 10, idx: credits.idx, cards: credits.cards.length, still: credits.still, paused: !!credits.paused } : null),
    stats: () => ({ active, view: view ? { places: (view.places || []).map((p) => [p.id, p.step, !!p.works]), animals: (view.animals || []).length, mushrooms: (view.mushrooms || []).length, river: view.river || null } : null, renderer: renderer?.stats?.() || null }),
  };
}
