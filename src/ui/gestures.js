// Gestes sur la scène (canvas) : toucher, appui long, glisser, molette, souris.
//
// createSceneInput(canvas, app) → { cancel() }
//
// Politique (docs/MOBILE.md, « un geste = une intention ») :
//   Doigt
//   - toucher bref sur une parcelle : action immédiate selon son état
//       vide → choix des graines · semée non arrosée → arroser · mûre → récolter
//       en friche → ouvrir · déjà arrosée (ou second toucher) → fiche de la parcelle
//   - toucher bref sur un bâtiment → sa fiche (revenus, achat)
//   - appui long (450 ms) sur une parcelle ou un bâtiment → sa fiche, avec une petite vibration
//   - glisser en partant d'une parcelle : arroser / récolter en série toutes les parcelles
//     traversées (la première action trouvée fixe l'action de la série), sans faire défiler ; en
//     carrière, seulement si cette parcelle est à arroser ou à récolter (sinon, on fait défiler)
//   - glisser ailleurs : faire défiler la scène (scene.scrollBy), avec une légère inertie ; en carrière
//     (carte 2D), dans les deux sens : scrollBy(-dx, -dy), puis fling(vx, vy). Un glissé presque
//     vertical (ou horizontal) au départ reste sur son axe (pas de dérive de côté en remontant la ferme).
//   Souris
//   - clic : action immédiate au moment de l'appui (comme la V1), glisser = série ; clic sur une
//     parcelle sans action ou sur un bâtiment → fiche ; molette ou glisser dans le vide = défiler ;
//     survol = infobulle. Carrière : Maj + molette (ou molette horizontale du pavé tactile) = défiler
//     de côté.
// La cible est cherchée avec une tolérance pour le doigt (scene.hitTest(x, y, { touch: true })).
// Mode décoration (src/ui/decor.js, aussi sur la ferme de démonstration du menu) : seuls les
// emplacements, le panneau et le fermier réagissent (toucher ou clic → app.decor.onHit) ; glisser
// fait défiler la scène ; pas d'appui long ni de série.

const LONG_PRESS_MS = 450;
const TOUCH_SLOP = 10; // px avant de considérer qu'on glisse
const MOUSE_SLOP = 5;
const AXIS_LOCK = 0.42; // tan(≈ 23°) : en deçà, le glissé reste sur l'axe principal

export function createSceneInput(canvas, app) {
  let g = null; // geste en cours
  let inertia = null; // { v (px/ms), last }

  const scene = () => app.scene;
  const decorOn = () => !!app.decor?.active;
  /** La scène réagit-elle aux gestes ? (partie en cours, ou mode décoration) */
  const live = () => decorOn() || (!!app.game && !app.inMenu);
  const DECOR_TYPES = ['decorSlot', 'sign', 'farmer'];
  /** Carte 2D (carrière) : la scène défile aussi de côté. */
  const twoD = () => !!scene()?.careerMode;
  const canScroll = () => {
    const s = scene();
    if (typeof s?.scrollBy !== 'function') return false;
    const m = s.maxScroll?.();
    if (m === undefined || m === null) return true;
    return twoD() ? (m.x || 0) > 0 || Number(m) > 0 : Number(m) > 0;
  };

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Cible sous le doigt, avec tolérance (la nouvelle scène la gère elle-même). */
  function hitAt(x, y, touch) {
    const s = scene();
    if (!s || !live()) return null;
    if (decorOn()) {
      const h = s.hitTest(x, y, { touch, decor: true });
      return h && DECOR_TYPES.includes(h.type) ? h : null;
    }
    if (typeof s.setInsets === 'function') return s.hitTest(x, y, { touch });
    const h = s.hitTest(x, y);
    if (h || !touch) return h;
    for (const r of [6, 11, 16, 22]) {
      for (let a = 0; a < 8; a++) {
        const hh = s.hitTest(x + Math.cos((a * Math.PI) / 4) * r, y + Math.sin((a * Math.PI) / 4) * r);
        if (hh) return hh;
      }
    }
    return null;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  /** Toucher bref (ou clic) sur une parcelle. Renvoie l'action faite ('water', 'harvest'…). */
  function tapPlot(index) {
    const game = app.game;
    const p = game?.query.plot(index);
    if (!p || game.state.status !== 'playing') return null;
    // Carrière : une parcelle marquée d'un corbeau → on le chasse d'abord (docs/CARRIERE.md § 10.9).
    if (app.careerUI?.onPlotTap?.(index)) return 'crow';
    switch (p.action) {
      case 'plant':
        app.field.openSeedPicker(index);
        return 'plant';
      case 'water':
        if (app.field.isOpen()) app.field.close(false);
        if (app.water(index)?.ok) {
          app.vibrate(10);
          return 'water';
        }
        return null;
      case 'harvest':
        if (app.field.isOpen()) app.field.close(false);
        if (app.harvest(index)?.ok) {
          app.vibrate(12);
          return 'harvest';
        }
        return null;
      case 'unlock':
        app.field.openUnlock(index);
        return 'unlock';
      default:
        // Déjà arrosée, en train de pousser (ou friche impossible) : la fiche de la parcelle.
        app.audio.play('page', { volume: 0.6 });
        app.field.openPlotInfo(index);
        return 'info';
    }
  }

  function tapInvestment(id) {
    app.audio.play('page', { volume: 0.7 });
    app.field.openInvestmentInfo(id);
  }

  function openInfo(hit) {
    app.vibrate(20);
    app.audio.play('page', { volume: 0.7 });
    if (hit.type === 'plot') app.field.openPlotInfo(hit.index);
    else if (hit.type === 'investment') app.field.openInvestmentInfo(hit.id);
    else app.careerUI?.onHit?.(hit, { long: true });
  }

  /** Cibles propres à la carrière (terrains, abris, employés, corbeaux…) : src/ui/career/index.js. */
  function tapOther(hit) {
    if (!hit || hit.type === 'plot' || hit.type === 'investment') return false;
    return !!app.careerUI?.onHit?.(hit);
  }

  /** Glisser sur le champ : même action sur chaque parcelle traversée. */
  function dragOver(index) {
    if (!g || g.done.has(index)) return;
    g.done.add(index);
    const p = app.game?.query.plot(index);
    if (!p) return;
    if (!g.action && (p.action === 'water' || p.action === 'harvest')) g.action = p.action;
    if (p.action !== g.action) return;
    const res = g.action === 'water' ? app.game.actions.water(index) : app.game.actions.harvest(index);
    if (res?.ok) app.vibrate(8);
  }

  // ── Défilement avec inertie ─────────────────────────────────────────────────
  function stopInertia() {
    inertia = null;
    if (typeof scene()?.fling === 'function') {
      if (twoD()) scene().fling(0, 0);
      else scene().fling(0);
    }
  }
  /** Élan après un glissé : v (px / ms, vertical), vx (px / ms, carte 2D). */
  function startInertia(v, vx = 0) {
    if (!canScroll() || Math.hypot(v, vx) < 0.05 || app.reducedMotion()) return;
    // La scène gère elle-même l'élan (frottement) quand elle sait le faire.
    if (typeof scene().fling === 'function') {
      if (twoD()) scene().fling(vx * 1000, v * 1000);
      else scene().fling(v * 1000);
      return;
    }
    inertia = { v, last: performance.now() };
    const step = (t) => {
      if (!inertia) return;
      const dt = Math.min(40, t - inertia.last);
      inertia.last = t;
      scene().scrollBy(inertia.v * dt);
      inertia.v *= Math.pow(0.94, dt / 16);
      if (Math.abs(inertia.v) < 0.02) inertia = null;
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ── Pointeur ────────────────────────────────────────────────────────────────
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) {
      // Deuxième doigt : on annule le geste en cours (pas de pincement dans le jeu).
      cancel();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopInertia();
    if (!live()) return;
    const touch = e.pointerType !== 'mouse';
    const p = local(e);
    const hit = hitAt(p.x, p.y, touch);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    g = { id: e.pointerId, touch, x0: p.x, y0: p.y, lastX: p.x, lastY: p.y, lastT: performance.now(), v: 0, vx: 0, axis: null, hit, mode: null, action: null, done: new Set(), long: false, timer: null, decor: decorOn() };

    if (g.decor) {
      // Mode décoration : à la souris, le clic agit tout de suite ; au doigt, au lever.
      if (!touch) {
        if (hit) app.decor.onHit(hit);
        else if (app.sheets.isOpen()) app.sheets.close();
        g.mode = hit ? 'none' : null;
        app.tooltip.hide('scene');
      } else if (hit) scene().setHover?.(hit);
      return;
    }

    if (!touch) {
      // Souris : un clic dans la scène referme d'abord une fiche ouverte (grand écran).
      if (app.field.isOpen() && !hit) {
        app.field.close();
        g = null;
        return;
      }
      if (hit?.type === 'plot') {
        const done = tapPlot(hit.index);
        g.mode = 'field';
        if (done === 'water' || done === 'harvest') {
          g.action = done;
          g.done.add(hit.index);
        } else g.mode = 'none';
      } else if (hit?.type === 'investment') {
        tapInvestment(hit.id);
        g.mode = 'none';
      } else if (tapOther(hit)) {
        g.mode = 'none';
      }
      app.tooltip.hide('scene');
      return;
    }

    // Doigt : on attend de savoir si c'est un toucher, un appui long ou un glissé.
    if (hit) {
      scene().setHover(hit);
      g.timer = setTimeout(() => {
        if (!g || g.mode) return;
        g.long = true;
        scene()?.setHover(null);
        openInfo(hit);
      }, LONG_PRESS_MS);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!live()) return;
    const p = local(e);
    if (!g || e.pointerId !== g.id) {
      if (e.pointerType === 'mouse') app.onSceneHover?.(hitAt(p.x, p.y, false), e);
      return;
    }
    const dx = p.x - g.x0;
    const dy = p.y - g.y0;
    const slop = g.touch ? TOUCH_SLOP : MOUSE_SLOP;
    if (!g.mode && !g.long && dx * dx + dy * dy > slop * slop) {
      clearTimeout(g.timer);
      scene()?.setHover(null);
      // Carrière (grande ferme, carte 2D) : un glissé qui part d'une parcelle sans rien à arroser ni à récolter
      // fait défiler la vue (sinon on ne pourrait pas bouger en partant du champ). Niveaux : inchangé.
      const act = g.hit?.type === 'plot' && twoD() ? app.game?.query.plot(g.hit.index)?.action : null;
      const seriesOk = g.hit?.type === 'plot' && (!twoD() || act === 'water' || act === 'harvest');
      if (seriesOk && !g.decor) {
        g.mode = 'field';
        dragOver(g.hit.index);
      } else {
        g.mode = 'scroll';
        // Carte 2D : un glissé nettement vertical (ou horizontal) au départ garde son axe.
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        g.axis = !twoD() ? 'y' : ax <= ay * AXIS_LOCK ? 'y' : ay <= ax * AXIS_LOCK ? 'x' : null;
        // Le seuil franchi : on repart du point de départ (le premier pas n'est pas perdu).
        g.lastX = g.x0;
        g.lastY = g.y0;
      }
    }
    if (g.mode === 'field') {
      // Échantillonne le trajet (un doigt rapide saute des parcelles entre deux événements).
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - (g.px ?? p.x), p.y - (g.py ?? p.y)) / 6));
      for (let i = 1; i <= steps; i++) {
        const x = (g.px ?? p.x) + ((p.x - (g.px ?? p.x)) * i) / steps;
        const y = (g.py ?? p.y) + ((p.y - (g.py ?? p.y)) * i) / steps;
        const h = hitAt(x, y, false);
        if (h?.type === 'plot') dragOver(h.index);
      }
    } else if (g.mode === 'scroll' && canScroll()) {
      const now = performance.now();
      const d = g.axis === 'x' ? 0 : g.lastY - p.y; // doigt vers le haut → on descend dans la scène
      const dxs = g.axis === 'y' ? 0 : g.lastX - p.x; // doigt vers la gauche → on va vers la droite
      if (twoD()) scene().scrollBy(dxs, d);
      else scene().scrollBy(d);
      const dt = Math.max(1, now - g.lastT);
      g.v = 0.8 * (d / dt) + 0.2 * g.v;
      g.vx = 0.8 * (dxs / dt) + 0.2 * g.vx;
      g.lastT = now;
    }
    g.lastX = p.x;
    g.lastY = p.y;
    g.px = p.x;
    g.py = p.y;
    if (e.pointerType === 'mouse') app.onSceneHover?.(hitAt(p.x, p.y, false), e);
  });

  function finish(e, cancelled = false) {
    if (!g || (e && e.pointerId !== g.id)) return;
    const cur = g;
    g = null;
    clearTimeout(cur.timer);
    scene()?.setHover(null);
    if (cancelled) return;
    if (cur.decor) {
      if (cur.touch && !cur.mode && cur.hit) app.decor.onHit(cur.hit);
      else if (cur.mode === 'scroll' && performance.now() - cur.lastT < 80) startInertia(cur.v, cur.vx);
      return;
    }
    if (cur.touch && !cur.mode && !cur.long && cur.hit) {
      if (cur.hit.type === 'plot') tapPlot(cur.hit.index);
      else if (cur.hit.type === 'investment') tapInvestment(cur.hit.id);
      else tapOther(cur.hit);
    } else if (cur.mode === 'scroll') {
      // Pas d'inertie si le doigt s'est arrêté avant de se lever.
      if (performance.now() - cur.lastT < 80) startInertia(cur.v, cur.vx);
    }
  }

  canvas.addEventListener('pointerup', (e) => finish(e));
  canvas.addEventListener('pointercancel', (e) => finish(e, true));
  canvas.addEventListener('lostpointercapture', (e) => finish(e, true));
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') app.onSceneHover?.(null, e);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!live() || !canScroll()) return;
      e.preventDefault();
      stopInertia();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (twoD()) {
        // Maj + molette : de côté ; pavé tactile : les deux axes.
        const sx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const sy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        scene().scrollBy(sx * k, sy * k);
      } else scene().scrollBy(e.deltaY * k);
    },
    { passive: false },
  );

  function cancel() {
    if (g) clearTimeout(g.timer);
    g = null;
    stopInertia();
    scene()?.setHover(null);
  }

  return { cancel, hitAt };
}
