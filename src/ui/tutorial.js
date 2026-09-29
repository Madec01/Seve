// Tutoriel guidé du niveau 1 : des bulles qui avancent au fil des vraies actions du joueur
// (semer, arroser, accélérer, récolter, acheter un poulailler, préparer l'hiver).
//
// createTutorial(layer, app) → { start(game, step?), stop(), onEvent(ev), onSpeed(s), frame(),
//                                getHighlight(), active, step }
// getHighlight() → { type: 'plot', index } | { type: 'ui', selector } | null : ce qui est mis en
// valeur (la scène n'a pas de surbrillance dédiée : l'anneau est un élément DOM posé sur la parcelle).

import { append, clear, el, fmt, placeNear, setText } from './dom.js';
import { icon, sprite } from './icons.js';

const NAME = 'Joseph, votre voisin';

export function createTutorial(layer, app) {
  let game = null;
  let index = -1;
  let tutoPlot = null; // parcelle choisie pour l'exemple
  let lastRect = '';
  let hidden = false; // 'dialog' (tout caché), 'popup' (bulle cachée, rappel visible) ou false
  let minimized = false; // la bulle a été réduite par le joueur : seul le rappel reste affiché

  const ring = el('div.tuto-ring', { 'aria-hidden': 'true' });
  const bubble = el('div.tuto-bubble', { role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Tutoriel' });
  // Rappel compact de l'étape en cours (bulle réduite, ou cachée par le choix des graines).
  const pillText = el('span.tuto-pill-text');
  const pillTitle = el('b.tuto-pill-title');
  const pillAvatar = el('span.tuto-pill-avatar'); // sprite ajouté au premier affichage (atlas chargé)
  const pill = el(
    'button.tuto-pill',
    { type: 'button', 'aria-label': 'Afficher le conseil du tutoriel', onclick: () => expand() },
    pillAvatar,
    el('span.tuto-pill-body', pillTitle, pillText),
  );
  layer.append(ring, bubble, pill);

  // ── Étapes ────────────────────────────────────────────────────────────────────
  const firstEmptyPlot = () => {
    const plots = game.query.plots();
    const cols = game.level.gridCols;
    // Au centre de la première ligne ouverte, de préférence.
    const open = plots.filter((p) => p.unlocked && !p.cropId);
    if (!open.length) return null;
    const mid = (cols - 1) / 2;
    open.sort((a, b) => a.row - b.row || Math.abs(a.col - mid) - Math.abs(b.col - mid));
    return open[0].index;
  };

  const STEPS = [
    {
      id: 'welcome',
      title: 'Bienvenue à la ferme !',
      text: () =>
        `Vous avez un an pour faire prospérer cette ferme. Chaque saison dure ${game.level.seasonLengths[0]} jours et, le dernier soir, il faut payer le fermage au propriétaire. Je vous montre les bases ?`,
      pauses: true,
      buttons: [
        { label: 'Passer le tutoriel', action: () => skip() },
        { label: 'C\'est parti !', primary: true, action: () => next() },
      ],
    },
    {
      id: 'plant',
      hint: () => (app.field.isOpen() ? 'Choisissez « Carotte » dans la liste.' : 'Cliquez sur la parcelle qui clignote.'),
      title: 'Semer',
      text: () => 'Cliquez sur la parcelle qui clignote, puis choisissez des carottes : elles sont bon marché et poussent en 2 jours.',
      pauses: true,
      enter: () => {
        tutoPlot = firstEmptyPlot();
      },
      target: () => (tutoPlot !== null ? { type: 'plot', index: tutoPlot } : null),
      advance: (ev) => {
        if (ev.type === 'planted') {
          tutoPlot = ev.plotIndex;
          return true;
        }
        return false;
      },
    },
    {
      id: 'water',
      hint: () => 'Cliquez sur votre carotte pour l\'arroser.',
      title: 'Arroser',
      text: () => 'Cliquez à nouveau sur la parcelle pour l\'arroser. Une culture arrosée pousse deux fois plus vite. L\'arrosage vaut pour la journée : il faudra recommencer chaque matin.',
      pauses: true,
      skipIf: () => tutoPlot !== null && game.query.plot(tutoPlot)?.watered,
      skipToast: 'Il pleut : la pluie arrose le champ pour vous !',
      target: () => ({ type: 'plot', index: tutoPlot }),
      advance: (ev) => ev.type === 'watered',
    },
    {
      id: 'speed',
      hint: () => 'Accélérez le temps avec ×2 ou ×4 (en haut à droite).',
      title: 'Le temps passe',
      text: () => 'Une journée dure 20 secondes. Pour aller plus vite, cliquez sur ×2 ou ×4 en haut à droite (touches 2 et 3, et 1 pour revenir à la normale). La touche Espace met le jeu en pause.',
      target: () => ({ type: 'ui', selector: '#hud-speed' }),
      advanceSpeed: (s) => s >= 2,
      advance: (ev) => ev.type === 'dawn',
    },
    {
      id: 'harvest',
      hint: () => (tutoPlot !== null && game.query.plot(tutoPlot)?.mature ? 'Cliquez sur la carotte mûre pour la récolter.' : 'Arrosez chaque matin, puis récoltez la carotte.'),
      title: 'Récolter',
      text: () => {
        const p = tutoPlot !== null ? game.query.plot(tutoPlot) : null;
        if (p?.mature) return 'Votre carotte est mûre ! Cliquez dessus pour la récolter : l\'argent arrive tout de suite.';
        if (p?.cropId && !p.watered) return 'Un nouveau jour : pensez à arroser votre carotte. Quand elle sera mûre, cliquez dessus pour la récolter.';
        return 'Patience… Arrosez chaque matin ; quand la carotte sera mûre, cliquez dessus pour la récolter.';
      },
      target: () => (tutoPlot !== null ? { type: 'plot', index: tutoPlot } : null),
      refreshOn: ['dawn', 'watered', 'moneyChanged'],
      advance: (ev) => ev.type === 'harvested',
    },
    {
      id: 'bill',
      hint: () => 'Le fermage se paie le dernier soir de chaque saison.',
      title: 'Le fermage',
      text: () =>
        `Bravo, première récolte vendue ! Ici, c'est le fermage à payer au propriétaire le dernier soir de la saison : ${fmt(game.query.finance().nextBill.amount)} pièces ce printemps. S'il vous manque de l'argent ce soir-là, c'est la faillite. La couleur vous prévient : vert, vous avez déjà de quoi payer ; orange, il faut encore récolter ; rouge, danger !`,
      pauses: true,
      target: () => ({ type: 'ui', selector: '#hud-bill' }),
      buttons: [{ label: 'Compris', primary: true, action: () => next() }],
    },
    {
      id: 'coop',
      hint: () => (game.state.money >= 70 ? 'Achetez un poulailler dans le panneau de droite.' : 'Récoltez jusqu\'à 70 pièces, puis achetez un poulailler.'),
      title: 'Investir',
      text: () =>
        game.state.money >= 70
          ? 'Les investissements rapportent chaque matin, même en hiver quand rien ne pousse. Vous avez de quoi acheter un poulailler : cliquez sur « Acheter ».'
          : `Les investissements rapportent chaque matin, même en hiver quand rien ne pousse. Récoltez encore un peu et achetez un poulailler dès que vous aurez 70 pièces (vous en avez ${fmt(game.state.money)}).`,
      enter: () => {
        app.panel.toggle(true);
        app.panel.setTab('shop');
        app.panel.focusInvestment('chickenCoop');
      },
      target: () => ({ type: 'ui', selector: '#card-chickenCoop' }),
      refreshOn: ['moneyChanged'],
      advance: (ev) => ev.type === 'purchased',
      buttons: [{ label: 'Plus tard', action: () => next() }],
    },
    {
      id: 'onward',
      hint: () => 'Plantez, arrosez, récoltez, investissez.',
      title: 'À vous de jouer',
      text: () => 'Plantez, arrosez, récoltez et investissez. Survolez une parcelle ou un bâtiment pour tout savoir. Je reviendrai vous prévenir avant l\'hiver !',
      buttons: [{ label: 'D\'accord', primary: true, action: () => next() }],
    },
    {
      id: 'wait-winter',
      dormant: true,
      advance: (ev) => ev.type === 'seasonWarning' && ev.frost,
      skipIf: () => game.query.calendar().seasonId === 'winter',
    },
    {
      id: 'winter',
      hint: () => 'Récoltez avant l\'hiver et gardez des réserves.',
      title: 'L\'hiver approche',
      text: () =>
        `Dans deux jours, c'est l'hiver. Au premier matin, les cultures qui ne résistent pas au gel seront perdues : récoltez ce qui est mûr. En hiver, seuls le navet et le chou se plantent, et le fermage est le plus cher de l'année (${fmt(game.level.rents[3])} pièces) : gardez des réserves !`,
      pauses: true,
      target: () => ({ type: 'ui', selector: '#hud-bill' }),
      buttons: [{ label: 'Compris', primary: true, action: () => next() }],
    },
    {
      id: 'done',
      title: 'Vous savez tout !',
      text: () => 'Tenez jusqu\'au fermage d\'hiver pour réussir l\'année. Bonne récolte !',
      buttons: [{ label: 'Merci !', primary: true, action: () => finish() }],
    },
  ];

  const step = () => STEPS[index] || null;

  // ── Déroulé ───────────────────────────────────────────────────────────────────
  function start(g, from = 0) {
    game = g;
    // Reprise d'une partie sauvegardée en cours de tutoriel : la parcelle d'exemple n'est pas
    // sauvegardée ; on reprend la première parcelle semée (sans elle, ni anneau ni saut d'étape).
    const planted = from > 0 ? g.query.plots().filter((p) => p.cropId) : [];
    tutoPlot = (planted.find((p) => p.cropId === 'carrot') || planted[0])?.index ?? null;
    index = -1;
    go(Math.max(0, Math.min(STEPS.length - 1, from || 0)));
  }

  function go(i) {
    const prev = step();
    if (prev?.pauses) app.popPause('tutorial');
    clearUiHighlight();
    index = i;
    const s = step();
    if (!s) return finish();
    app.saveTutorial({ done: false, step: index });
    if (s.skipIf && s.skipIf()) {
      if (s.skipToast) app.toasts.show({ kind: 'info', icon: 'rain', text: s.skipToast });
      return go(index + 1);
    }
    s.enter?.();
    if (s.pauses) app.pushPause('tutorial');
    render();
  }

  // (garde : un bouton d'une bulle périmée, tutoriel arrêté, ne doit rien faire)
  function next() {
    if (!game || index < 0) return;
    app.audio.play('click');
    go(index + 1);
  }

  function skip() {
    if (!game || index < 0) return;
    app.audio.play('close');
    finish();
  }

  function finish() {
    const s = step();
    if (s?.pauses) app.popPause('tutorial');
    clearUiHighlight();
    index = -1;
    game = null;
    app.saveTutorial({ done: true, step: null });
    hideAll();
  }

  function hideAll() {
    if (bubble.contains(document.activeElement)) document.activeElement.blur();
    bubble.classList.remove('is-visible');
    // Contenu retiré après le fondu (la bulle cachée ne reçoit déjà plus ni clic ni focus).
    setTimeout(() => {
      if (index < 0) clear(bubble);
    }, 400);
    ring.classList.remove('is-visible');
    pill.classList.remove('is-visible');
  }

  function stop() {
    const s = step();
    if (s?.pauses) app.popPause('tutorial');
    clearUiHighlight();
    index = -1;
    game = null;
    hideAll();
  }

  /** Réduit la bulle : il ne reste que le rappel compact de l'étape (cliquable pour la rouvrir). */
  function minimize() {
    if (minimized) return;
    app.audio.play('close', { volume: 0.6 });
    minimized = true;
    layer.classList.add('is-min');
    updatePill();
    pill.focus?.({ preventScroll: true });
  }

  function expand() {
    if (!minimized) return;
    app.audio.play('open', { volume: 0.6 });
    minimized = false;
    layer.classList.remove('is-min');
    updatePill();
    lastRect = '';
    position(true);
  }

  function updatePill() {
    const s = step();
    const show = !!(s && !s.dormant && s.hint && game && (minimized || hidden === 'popup'));
    if (show) {
      if (!pillAvatar.firstChild) pillAvatar.append(sprite('farmer', 'sprite--xs'));
      pillTitle.textContent = s.title;
      setText(pillText, s.hint());
      const stage = app.stageRect();
      pill.classList.add('is-visible');
      const pw = pill.offsetWidth;
      const ph = pill.offsetHeight;
      // En haut à gauche de la scène ; sinon un autre coin, pour ne pas couvrir le choix des graines.
      const pop = document.getElementById('popup');
      const pr = hidden === 'popup' && pop ? pop.getBoundingClientRect() : null;
      const handle = document.getElementById('panel-handle');
      const hr = handle && handle.offsetParent !== null ? handle.getBoundingClientRect() : null;
      const right = hr && hr.width ? Math.min(stage.right, hr.left) : stage.right;
      const corners = [
        [stage.left + 8, stage.top + 8],
        [right - pw - 8, stage.top + 8],
        [stage.left + 8, stage.bottom - ph - 8],
        [right - pw - 8, stage.bottom - ph - 8],
      ];
      const free = ([x, y]) => !pr || x + pw <= pr.left || x >= pr.right || y + ph <= pr.top || y >= pr.bottom;
      const [x, y] = corners.find(free) || corners[0];
      pill.style.left = `${Math.round(x)}px`;
      pill.style.top = `${Math.round(y)}px`;
      pill.classList.toggle('is-static', hidden === 'popup' && !minimized);
    }
    pill.classList.toggle('is-visible', show);
  }

  function render() {
    const s = step();
    clear(bubble);
    if (!s || s.dormant) {
      bubble.classList.remove('is-visible');
      ring.classList.remove('is-visible');
      return;
    }
    minimized = false;
    layer.classList.remove('is-min');
    const canMinimize = !!s.hint && (!s.buttons || s.id === 'coop');
    append(bubble, [
      canMinimize ? el('button.tuto-min', { type: 'button', 'aria-label': 'Réduire la bulle', 'data-tip': 'Réduire (le conseil reste affiché en haut à gauche)', onclick: () => minimize() }, el('span.tuto-min-bar')) : null,
      el('div.tuto-avatar', sprite('farmer', 'sprite--avatar')),
      el(
        'div.tuto-content',
        el('div.tuto-name', NAME),
        el('div.tuto-title', s.title),
        el('p.tuto-text', s.text()),
        el(
          'div.tuto-actions',
          (s.buttons || []).map((b) =>
            el(`button.btn.btn--small${b.primary ? '.btn--red' : ''}`, { type: 'button', onclick: b.action }, b.label),
          ),
          !s.buttons && index > 0 ? el('button.tuto-skip', { type: 'button', onclick: () => skip() }, 'Passer le tutoriel') : null,
        ),
        el('div.tuto-progress', STEPS.filter((x) => !x.dormant).map((x) => el(`span.tuto-dot${x === s ? '.is-on' : STEPS.indexOf(x) < index ? '.is-past' : ''}`))),
      ),
    ]);
    bubble.classList.remove('is-visible');
    void bubble.offsetWidth;
    bubble.classList.add('is-visible');
    lastRect = '';
    applyUiHighlight();
    position(true);
    updatePill();
    if (index > 0) app.audio.play('warning', { volume: 0.6 });
  }

  // ── Surbrillance ──────────────────────────────────────────────────────────────
  function getHighlight() {
    const s = step();
    if (!s || s.dormant || !s.target || !game) return null;
    return s.target();
  }

  let uiTarget = null;
  function applyUiHighlight() {
    const h = getHighlight();
    if (h?.type === 'ui') {
      uiTarget = document.querySelector(h.selector);
      uiTarget?.classList.add('tuto-highlight');
    }
  }
  function clearUiHighlight() {
    uiTarget?.classList.remove('tuto-highlight');
    uiTarget = null;
  }

  function position(force = false) {
    const s = step();
    if (!s || s.dormant) return;
    const h = getHighlight();
    let rect = null;
    if (h?.type === 'plot') rect = app.plotPageRect(h.index);
    else if (h?.type === 'ui') {
      const n = document.querySelector(h.selector);
      if (n && n.offsetParent !== null) rect = n.getBoundingClientRect();
    }
    const key = rect ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}` : 'none';
    if (!force && key === lastRect) return;
    lastRect = key;
    if (h?.type === 'plot' && rect) {
      const pad = 4;
      ring.style.left = `${Math.round(rect.left - pad)}px`;
      ring.style.top = `${Math.round(rect.top - pad)}px`;
      ring.style.width = `${Math.round(rect.width + pad * 2)}px`;
      ring.style.height = `${Math.round(rect.height + pad * 2)}px`;
      ring.classList.add('is-visible');
    } else {
      ring.classList.remove('is-visible');
    }
    if (rect) {
      // Parcelle : la bulle se place autour du champ entier (sans cacher d'autres parcelles),
      // la flèche restant alignée sur la parcelle visée.
      const anchor = h.type === 'plot' ? app.fieldPageRect() || rect : rect;
      const prefer = h.type === 'plot' ? 'bottom' : h.selector === '#card-chickenCoop' ? 'left' : 'bottom';
      bubble.classList.remove('is-free');
      let side = placeNear(bubble, anchor, prefer, 18);
      // Étape sans pause visant l'interface (poulailler) : le joueur continue de jouer, la bulle
      // ne doit pas recouvrir le champ ; elle descend sous la clôture s'il y a la place (sans
      // flèche : elle ne serait plus en face de sa cible, qui reste surlignée).
      if (h.type === 'ui' && !s.pauses && avoidField()) side = 'none';
      const b = bubble.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 - b.left;
      const cy = rect.top + rect.height / 2 - b.top;
      const margin = 22;
      bubble.style.setProperty('--ax', `${Math.round(Math.max(margin, Math.min(b.width - margin, cx)))}px`);
      bubble.style.setProperty('--ay', `${Math.round(Math.max(margin, Math.min(b.height - margin, cy)))}px`);
      bubble.dataset.side = side;
    } else {
      bubble.classList.add('is-free');
      const stage = app.stageRect();
      const r = bubble.getBoundingClientRect();
      bubble.style.left = `${Math.round(stage.left + (stage.width - r.width) / 2)}px`;
      bubble.style.top = `${Math.round(stage.top + stage.height - r.height - 24)}px`;
      bubble.dataset.side = 'none';
    }
  }

  function avoidField() {
    const f = app.fieldPageRect();
    if (!f) return;
    const b = bubble.getBoundingClientRect();
    const overlaps = b.left < f.right && b.right > f.left && b.top < f.bottom && b.bottom > f.top;
    if (!overlaps) return false;
    const below = f.bottom + 12;
    if (below + b.height > window.innerHeight - 8) return false;
    bubble.style.top = `${Math.round(below)}px`;
    return true;
  }

  // ── Événements ────────────────────────────────────────────────────────────────
  function onEvent(ev) {
    const s = step();
    if (!s || !game) return;
    if (ev.type === 'bankrupt' || ev.type === 'victory') {
      stop();
      return;
    }
    if (s.advance && s.advance(ev)) {
      if (!s.dormant) app.audio.play('confirm');
      go(index + 1);
      return;
    }
    if (s.refreshOn?.includes(ev.type)) {
      const t = bubble.querySelector('.tuto-text');
      if (t) setText(t, s.text());
    }
    updatePill();
  }

  function onSpeed(speed) {
    const s = step();
    if (!s || !game) return;
    if (s.pauses && speed > 0 && (s.id === 'plant' || s.id === 'water')) app.popPause('tutorial');
    if (s.advanceSpeed && s.advanceSpeed(speed)) {
      app.audio.play('confirm');
      go(index + 1);
    }
  }

  function frame() {
    if (!game || index < 0) return;
    // Une fenêtre cache tout le tutoriel ; le choix des graines ne cache que la bulle (elle le
    // recouvrirait sur petit écran) : le rappel compact de l'étape reste alors affiché.
    const state = app.dialogs.isOpen() ? 'dialog' : app.field.isOpen() ? 'popup' : false;
    if (state !== hidden) {
      hidden = state;
      layer.classList.toggle('is-hidden', hidden === 'dialog');
      layer.classList.toggle('is-popup', hidden === 'popup');
      if (!hidden) lastRect = '';
      updatePill();
    }
    if (!hidden && !minimized) position();
  }

  return {
    start,
    stop,
    onEvent,
    onSpeed,
    frame,
    getHighlight,
    get active() {
      return index >= 0 && !!game;
    },
    get step() {
      return index;
    },
    get stepId() {
      return step()?.id || null;
    },
    relayout() {
      lastRect = '';
      position(true);
      updatePill();
    },
    minimize,
    expand,
  };
}

