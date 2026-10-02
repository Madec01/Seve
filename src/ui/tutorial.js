// Tutoriel guidé du niveau 1 : des bulles qui avancent au fil des vraies actions du joueur
// (semer, arroser, accélérer, récolter, acheter un poulailler, préparer l'hiver).
//
// createTutorial(layer, app) → { start(game, step?), stop(), onEvent(ev), onSpeed(s), frame(),
//                                getHighlight(), active, step }
// getHighlight() → { type: 'plot', index } | { type: 'ui', selector } | null : ce qui est mis en
// valeur (la scène n'a pas de surbrillance dédiée : l'anneau est un élément DOM posé sur la parcelle).
//
// Téléphone en portrait : la bulle occupe toute la largeur, en haut (sous la barre du haut) ou en
// bas (au-dessus des onglets ou de la feuille ouverte), du côté opposé à sa cible pour ne jamais la
// couvrir ; la scène défile pour montrer la parcelle visée (scene.focusPlot). Textes courts.

import { append, clear, el, fmt, placeNear, setText } from './dom.js';
import { icon } from './icons.js';
import { joseph } from './career/util.js';
import { waterEffect } from './text.js';

const NAME = 'Joseph, votre voisin';

/** Où se trouve le bouton de vitesse (options « Vitesse et pause en bas » et « gaucher », src/ui/a11y.js). */
function speedWhere() {
  const root = document.documentElement.classList;
  const docked = !!document.querySelector('#tabbar #hud-speed');
  return `${docked ? 'en bas' : 'en haut'} à ${root.contains('left-handed') ? 'gauche' : 'droite'}`;
}

export function createTutorial(layer, app) {
  let game = null;
  let index = -1;
  let tutoPlot = null; // parcelle choisie pour l'exemple
  let lastRect = '';
  let hidden = false; // 'dialog' (tout caché), 'popup' (bulle cachée, rappel visible) ou false
  let minimized = false;
  let crowdedTried = -1; // étape pour laquelle la scène a déjà défilé faute de place pour la bulle
  let crowdedAt = 0;
  let userExpanded = false; // la bulle a été rouverte à la main : plus de réduction automatique // la bulle a été réduite par le joueur : seul le rappel reste affiché

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

  // « Touchez » au doigt, « Cliquez » à la souris.
  const tap = (cap = true) => (app.isTouch ? (cap ? 'Touchez' : 'touchez') : cap ? 'Cliquez' : 'cliquez');

  const STEPS = [
    {
      id: 'welcome',
      title: 'Bienvenue à la ferme !',
      text: () =>
        `Un an pour faire prospérer la ferme ! Chaque saison dure ${game.level.seasonLengths[0]} jours ; le dernier soir, on paie le fermage. Je vous montre ?`,
      pauses: true,
      buttons: [
        { label: 'Passer le tutoriel', action: () => skip() },
        { label: 'C\'est parti !', primary: true, action: () => next() },
      ],
    },
    {
      id: 'plant',
      hint: () => (app.field.isOpen() ? `${tap()} « Carotte » dans la liste.` : `${tap()} la parcelle qui clignote.`),
      title: 'Semer',
      text: () => `${tap()} la parcelle qui clignote, puis choisissez la carotte : pas chère, mûre en 2 jours.`,
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
      hint: () => `${tap()} la carotte pour l'arroser.`,
      title: 'Arroser',
      text: () => `${tap()} la parcelle pour l'arroser : elle poussera ${waterEffect(game.level).faster}. À refaire chaque matin !${app.isTouch ? ' (Glissez le doigt sur le champ pour tout arroser d\'un coup.)' : ''}`,
      pauses: true,
      skipIf: () => tutoPlot !== null && game.query.plot(tutoPlot)?.watered,
      skipToast: 'Il pleut : la pluie arrose le champ pour vous !',
      target: () => ({ type: 'plot', index: tutoPlot }),
      advance: (ev) => ev.type === 'watered',
    },
    {
      id: 'speed',
      hint: () => `${tap()} le bouton de vitesse (${speedWhere()}).`,
      title: 'Le temps passe',
      text: () =>
        app.isTouch
          ? `À ×1, une journée dure 20 secondes. Touchez le bouton de vitesse ${speedWhere()} pour passer à ×2, puis ×4, puis pause. Appui long : pause.`
          : `À ×1, une journée dure 20 secondes. Cliquez sur le bouton de vitesse ${speedWhere()} (×2, ×4, pause), ou touches 1, 2, 3 et Espace.`,
      target: () => ({ type: 'ui', selector: '#hud-speed' }),
      advanceSpeed: (s) => s >= 2,
      advance: (ev) => ev.type === 'dawn',
    },
    {
      id: 'harvest',
      hint: () => (tutoPlot !== null && game.query.plot(tutoPlot)?.mature ? `${tap()} la carotte mûre pour la récolter.` : 'Arrosez chaque matin, puis récoltez.'),
      title: 'Récolter',
      text: () => {
        const p = tutoPlot !== null ? game.query.plot(tutoPlot) : null;
        if (p?.mature) return `Elle est mûre ! ${tap()}-la pour la récolter : l'argent arrive tout de suite.`;
        if (p?.cropId && !p.watered) return `Nouveau jour : arrosez la carotte. Mûre, ${tap(false)}-la pour la récolter.`;
        return `Patience… Arrosez chaque matin ; une fois mûre, ${tap(false)} la carotte pour la récolter.`;
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
        game.query.finance().neighbourLoan
          ? `Bravo ! Voici le fermage : ${fmt(game.query.finance().nextBill.amount)} pièces à payer le dernier soir de la saison. Regardez le signe : ✓ « couvert », c'est payé d'avance ; ! « juste », récoltez encore. S'il manque un peu, je vous avancerai l'argent !`
          : `Bravo ! Voici le fermage : ${fmt(game.query.finance().nextBill.amount)} pièces à payer le dernier soir de la saison, sinon c'est la faillite. Regardez le signe : ✓ « couvert », c'est bon ; ! « juste », récoltez encore ; ✗ « danger », attention !`,
      pauses: true,
      target: () => ({ type: 'ui', selector: '#hud-bill' }),
      buttons: [{ label: 'Compris', primary: true, action: () => next() }],
    },
    {
      id: 'coop',
      // Conseillé seulement si, après l'achat, il reste de quoi payer le fermage de la saison
      // (sinon un débutant vide sa caisse juste avant le fermage).
      hint: () => (coopReady() ? 'Achetez un poulailler (onglet « Acheter »).' : `Récoltez jusqu'à ${fmt(coopTarget())} pièces (${fmt(game.state.money)}), puis achetez un poulailler.`),
      title: 'Investir',
      text: () =>
        coopReady()
          ? `Les investissements rapportent chaque matin, même en hiver. ${app.sheets.isOpen('shop') ? `${tap()} « Acheter » sur le poulailler.` : `Ouvrez l'onglet « Acheter » en bas.`}`
          : `Les investissements rapportent chaque matin, même en hiver. Gardez d'abord de quoi payer le fermage : à ${fmt(coopTarget())} pièces, achetez un poulailler (vous en avez ${fmt(game.state.money)}).`,
      enter: () => {
        if (coopReady()) app.panel.focusInvestment('chickenCoop');
      },
      target: () => (app.sheets.isOpen('shop') ? { type: 'ui', selector: '#card-chickenCoop' } : { type: 'ui', selector: '#tab-shop' }),
      showOver: ['shop'],
      refreshOn: ['moneyChanged', 'sheet'],
      advance: (ev) => ev.type === 'purchased',
      buttons: [{ label: 'Plus tard', action: () => next() }],
    },
    {
      id: 'onward',
      hint: () => 'Plantez, arrosez, récoltez, investissez.',
      title: 'À vous de jouer',
      text: () =>
        app.isTouch
          ? 'Plantez, arrosez, récoltez, investissez. Appui long sur une parcelle ou un bâtiment : sa fiche. Je reviendrai avant l\'hiver !'
          : 'Plantez, arrosez, récoltez, investissez. Survolez une parcelle ou un bâtiment pour tout savoir. Je reviendrai avant l\'hiver !',
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
        `L'hiver arrive dans deux jours : le gel détruira les cultures fragiles, récoltez ce qui est mûr ! En hiver, seuls navet et chou poussent, et le fermage est le plus cher (${fmt(game.level.rents[3])} pièces).`,
      pauses: true,
      target: () => ({ type: 'ui', selector: '#hud-bill' }),
      buttons: [{ label: 'Compris', primary: true, action: () => next() }],
    },
    {
      id: 'done',
      title: 'Vous savez tout !',
      text: () => 'Payez le fermage d\'hiver et l\'année est gagnée. Bonne récolte !',
      buttons: [{ label: 'Merci !', primary: true, action: () => finish() }],
    },
  ];

  const step = () => STEPS[index] || null;

  /** Prix du poulailler dans cette partie (bonus compris). */
  function coopCost() {
    return game.query.investments().find((i) => i.id === 'chickenCoop')?.nextCost ?? 70;
  }
  /** Argent à avoir pour acheter le poulailler en gardant le fermage de la saison. */
  function coopTarget() {
    return coopCost() + game.query.finance().nextBill.amount;
  }
  const coopReady = () => game.state.money >= coopTarget();

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
    focusTarget();
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
  /** La scène finit de défiler (focusPlot animé) : on attend avant de juger la place. */
  function scrollSettling() {
    return performance.now() - crowdedAt < 700;
  }

  function minimize(auto = false) {
    if (minimized) return;
    if (!auto) app.audio.play('close', { volume: 0.6 });
    minimized = true;
    layer.classList.add('is-min');
    updatePill();
    if (!auto && app.keyboardMode) pill.focus?.({ preventScroll: true });
  }

  function expand() {
    if (!minimized) return;
    app.audio.play('open', { volume: 0.6 });
    userExpanded = true;
    minimized = false;
    layer.classList.remove('is-min');
    updatePill();
    lastRect = '';
    position(true);
  }

  function updatePill() {
    const s = step();
    // Feuille haute (achats, bilan) : pas de rappel par-dessus (il couvrirait son en-tête).
    const tallSheet = hidden === 'popup' && app.sheets?.box.classList.contains('is-tall');
    const show = !!(s && !s.dormant && s.hint && game && (minimized || hidden === 'popup') && !tallSheet);
    if (show) {
      if (!pillAvatar.firstChild) pillAvatar.append(joseph('content', 'sprite--xs'));
      pillTitle.textContent = s.title;
      setText(pillText, s.hint());
      pill.classList.add('is-visible');
      placePill();
      pill.classList.toggle('is-static', hidden === 'popup' && !minimized);
      app.toasts?.hideBanner?.(); // le rappel se place là où s'affiche le bandeau
    }
    pill.classList.toggle('is-visible', show);
  }

  /**
   * Rappel compact : sous la barre du haut, à gauche (la feuille ouverte est en bas : elle n'est pas couverte).
   * S'il couvrirait la parcelle ou le bouton visé (grand texte, parcelle tout en haut), il passe en bas, au-dessus
   * des onglets.
   */
  function placePill() {
    const left = app.safeLeft() + 8;
    let top = app.safeTop() + 8;
    pill.style.left = `${Math.round(left)}px`;
    pill.style.top = `${Math.round(top)}px`;
    const h = hidden === 'popup' ? null : getHighlight();
    const r = h ? targetRect(h) : null;
    if (r) {
      const p = pill.getBoundingClientRect();
      const covers = p.left < r.right && p.right > r.left && top < r.bottom && top + p.height > r.top;
      if (covers) top = Math.max(top, app.safeBottom() - p.height - 8);
      pill.style.top = `${Math.round(top)}px`;
    }
  }

  /** Montre la parcelle visée (la scène défile si elle dépasse l'écran). */
  function focusTarget() {
    const h = getHighlight();
    if (h?.type === 'plot' && typeof app.scene?.focusPlot === 'function') app.scene.focusPlot(h.index, { animate: true });
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
    userExpanded = false;
    layer.classList.remove('is-min');
    const canMinimize = !!s.hint && (!s.buttons || s.id === 'coop');
    append(bubble, [
      canMinimize ? el('button.tuto-min', { type: 'button', 'aria-label': 'Réduire la bulle', 'data-tip': 'Réduire (le conseil reste affiché en haut à gauche)', onclick: () => minimize() }, el('span.tuto-min-bar')) : null,
      el('div.tuto-avatar', joseph('content', 'sprite--avatar')), // même portrait de Joseph qu'en carrière
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

  function targetRect(h) {
    if (h?.type === 'plot') return app.plotPageRect(h.index);
    if (h?.type === 'ui') {
      const n = document.querySelector(h.selector);
      if (n && n.offsetParent !== null) {
        const r = n.getBoundingClientRect();
        if (r.width && r.height) return r;
      }
    }
    return null;
  }

  function position(force = false) {
    const s = step();
    if (!s || s.dormant) return;
    const h = getHighlight();
    const rect = targetRect(h);
    const key = rect ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}` : 'none';
    const vkey = `${key}|${window.innerWidth}x${window.innerHeight}|${app.sheets?.current || ''}|${Math.round(app.safeBottom())}`;
    if (!force && vkey === lastRect) return;
    lastRect = vkey;
    if (h?.type === 'plot' && rect) {
      const pad = 3;
      ring.style.left = `${Math.round(rect.left - pad)}px`;
      ring.style.top = `${Math.round(rect.top - pad)}px`;
      ring.style.width = `${Math.round(rect.width + pad * 2)}px`;
      ring.style.height = `${Math.round(rect.height + pad * 2)}px`;
      ring.classList.add('is-visible');
      // Sous la feuille ouverte ou la barre du haut : l'anneau ne se dessine pas par-dessus.
      ring.classList.toggle('is-covered', rect.bottom > app.safeBottom() + 1 || rect.top < app.safeTop() - 1);
    } else {
      ring.classList.remove('is-visible');
    }
    if (app.isWide()) positionWide(h, rect, s);
    else positionPortrait(rect, s);
    if (minimized && pill.classList.contains('is-visible')) placePill();
  }

  /**
   * Portrait : la bulle prend la largeur de l'écran et se range en haut (sous la barre du haut)
   * ou en bas (au-dessus des onglets ou de la feuille), du côté où elle ne couvre pas la cible.
   */
  function positionPortrait(rect, s) {
    bubble.classList.remove('is-free');
    bubble.classList.add('is-docked');
    const vw = window.innerWidth;
    const top = app.safeTop() + 8;
    const bottom = app.safeBottom() - 8; // bord haut des onglets ou de la feuille ouverte
    const b = bubble.getBoundingClientRect();
    const w = b.width;
    const h = b.height;
    const x = Math.round(Math.max(8, (vw - w) / 2));
    let side = 'none';
    let y;
    if (!rect) {
      y = bottom - h;
    } else {
      const cy = rect.top + rect.height / 2;
      const roomTop = rect.top - 14 - top; // place au-dessus de la cible
      const roomBottom = bottom - (rect.bottom + 14);
      const preferTop = cy > (top + bottom) / 2;
      const fitsTop = roomTop >= h;
      const fitsBottom = roomBottom >= h;
      if ((preferTop && fitsTop) || (!fitsBottom && fitsTop)) {
        y = top;
        side = 'top';
      } else if (fitsBottom) {
        y = bottom - h;
        side = 'bottom';
      } else {
        // Pas de place sans recouvrir : du côté le plus grand, collée au bord.
        y = roomTop > roomBottom ? top : bottom - h;
        side = 'none';
        // Grand texte (130–150 %) sur un petit écran : la bulle ne tient ni au-dessus ni au-dessous de la
        // parcelle visée. D'abord la scène défile pour montrer la parcelle au-dessus de la bulle ; si cela ne
        // suffit pas, la bulle se réduit en rappel compact (l'anneau montre la parcelle, un toucher la rouvre).
        const hl = getHighlight();
        if (hl?.type === 'plot' && !userExpanded && s?.hint) {
          if (crowdedTried !== index && typeof app.scene?.focusPlot === 'function') {
            crowdedTried = index;
            crowdedAt = performance.now();
            y = bottom - h;
            app.scene.focusPlot(hl.index, { animate: true, bottom: h + 16 });
            lastRect = ''; // rejugé après le défilement (même si la scène ne peut pas défiler)
          } else if (crowdedTried === index) {
            if (scrollSettling()) lastRect = ''; // rejugé à l'image suivante
            else minimize(true);
          }
        }
      }
    }
    bubble.style.left = `${x}px`;
    bubble.style.top = `${Math.round(y)}px`;
    // Bulle en haut de l'écran : le bandeau (titre du niveau, saison) lui laisse la place.
    if (y < top + 80) app.toasts?.hideBanner?.();
    if (rect && side !== 'none') {
      const cx = rect.left + rect.width / 2 - x;
      bubble.style.setProperty('--ax', `${Math.round(Math.max(22, Math.min(w - 22, cx)))}px`);
      // La flèche pointe vers la cible : bulle en haut → flèche en bas.
      bubble.dataset.side = side === 'top' ? 'top' : 'bottom';
    } else {
      bubble.dataset.side = 'none';
    }
    // Étape sans pause (on joue pendant ce temps) : si la bulle cache le champ, elle se réduit
    // d'elle-même en rappel compact (le joueur peut la rouvrir d'un toucher).
    if (s && !s.pauses && !userExpanded && s.hint) {
      const f = app.fieldPageRect();
      const by = Math.round(y);
      if (f && by < f.bottom && by + h > f.top) minimize(true);
    }
  }

  function positionWide(h, rect, s) {
    bubble.classList.remove('is-docked');
    if (rect) {
      // Parcelle : la bulle se place autour du champ entier (sans cacher d'autres parcelles),
      // la flèche restant alignée sur la parcelle visée.
      const anchor = h.type === 'plot' ? app.fieldPageRect() || rect : rect;
      const prefer = h.type === 'plot' ? 'bottom' : h.selector === '#card-chickenCoop' ? 'left' : h.selector.startsWith('#tab-') ? 'bottom' : 'bottom';
      bubble.classList.remove('is-free');
      let side = placeNear(bubble, anchor, prefer, 18);
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
      bubble.style.top = `${Math.round(app.safeBottom() - r.height - 16)}px`;
      bubble.dataset.side = 'none';
    }
  }

  function avoidField() {
    const f = app.fieldPageRect();
    if (!f) return false;
    const b = bubble.getBoundingClientRect();
    const overlaps = b.left < f.right && b.right > f.left && b.top < f.bottom && b.bottom > f.top;
    if (!overlaps) return false;
    const below = f.bottom + 12;
    if (below + b.height > app.safeBottom() - 8) return false;
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
    // Une fenêtre cache tout le tutoriel ; une feuille (graines, fiche…) ne cache que la bulle :
    // le rappel compact de l'étape reste affiché en haut. Exception : l'étape « Investir » garde
    // sa bulle au-dessus de la feuille des achats (elle vise la carte du poulailler).
    const s = step();
    const sheet = app.sheets?.current;
    const state = app.dialogs.isOpen() ? 'dialog' : sheet && !(s?.showOver || []).includes(sheet) ? 'popup' : false;
    if (sheet !== lastSheet) {
      lastSheet = sheet;
      if (s?.refreshOn?.includes('sheet')) {
        clearUiHighlight();
        applyUiHighlight();
        const t = bubble.querySelector('.tuto-text');
        if (t) setText(t, s.text());
      }
      lastRect = '';
    }
    if (state !== hidden) {
      hidden = state;
      layer.classList.toggle('is-hidden', hidden === 'dialog');
      layer.classList.toggle('is-popup', hidden === 'popup');
      if (!hidden) lastRect = '';
      updatePill();
    }
    if (hidden !== 'dialog') position();
  }
  let lastSheet = null;

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

