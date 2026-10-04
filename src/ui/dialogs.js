// Fenêtres : menu principal, choix du niveau, options, crédits, pause, fin de saison,
// faillite, victoire, remise des prix du concours, confirmations.
//
// createDialogs(layer, app) → { open, close, closeTop, isOpen, top, mainMenu, levelSelect, options,
//                               credits, pauseMenu, seasonEnd, bankrupt, victory, contestResult,
//                               confirm, frame, btn, a11yWelcome }
// Options : section « Accessibilité » (taille du texte, police, contrastes, pause pendant la
// lecture, vitesse ×½, pause chaque matin, animations, repères, vibrations, commandes en bas,
// gaucher, zoom). Ces réglages sont aussi proposés une fois au premier lancement (a11yWelcome).
// Les fenêtres s'empilent ; seule celle du dessus est active. Échap ferme celle du dessus si elle
// le permet. Le focus clavier reste dans la fenêtre active.

import { SEASONS } from '../data/balance.js';
import { gameCrops } from '../core/perks.js';
import { LEVELS, yearLength } from '../data/levels.js';
import { DIFFICULTIES, DIFFICULTY_IDS, levelFor } from '../data/difficulty.js';
import { clear, el, fmt, gain, loss, plural, signed } from './dom.js';
import { achievementIcon, cropIcon, ecuIcon, icon, investmentIcon, productIcon, sprite, spriteAny } from './icons.js';
import { swipeToClose } from './sheets.js';
import { cropCount, season, seasonArrives } from './text.js';
import { TEXT_SCALES } from '../storage.js';
import { applyA11y, autoPauseDawnSupported, pauseOnSheetActive, slowSpeedSupported } from './a11y.js';
import { guidancePicker } from './coach/carnet.js';
import { SIGNALS } from './coach/signals.js';

export function createDialogs(layer, app) {
  const stack = []; // { node, opts }

  // ── Pile de fenêtres ──────────────────────────────────────────────────────────
  function open(node, opts = {}) {
    if (opts.replace && stack.length) {
      const prev = stack.pop();
      prev.node.remove();
      prev.opts.onClose?.('replace');
      if (prev.opts.pauses) app.popPause(prev.opts.id || 'dialog');
    } else if (opts.sound !== false) {
      app.audio.play('open');
    }
    for (const s of stack) s.node.classList.add('is-behind');
    // Élément à refocaliser à la fermeture (bouton qui a ouvert la fenêtre).
    opts.returnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    node.classList.add('dialog-wrap');
    if (opts.id) node.dataset.dialog = opts.id;
    layer.append(node);
    stack.push({ node, opts });
    layer.classList.add('is-active');
    layer.classList.toggle('is-menu', !!stack[0]?.opts.menu);
    setBackgroundInert(true);
    if (opts.pauses) app.pushPause(opts.id || 'dialog');
    app.tooltip?.hide();
    app.sheets?.close('silent');
    requestAnimationFrame(() => {
      node.classList.add('is-open');
      const target = node.querySelector('[data-autofocus]') || node.querySelector('.dialog-actions .btn:not(.is-disabled), .menu-buttons .btn, button');
      if (target && app.keyboardMode) target.focus({ preventScroll: true });
    });
    app.onDialogChange?.();
    app.coach?.signal?.(SIGNALS.dialogOpen, { id: opts.id || null });
    return {
      node,
      close: (reason) => close(node, reason),
    };
  }

  function close(node, reason = 'close') {
    const i = stack.findIndex((s) => s.node === node);
    if (i === -1) return;
    const [entry] = stack.splice(i, 1);
    entry.node.classList.remove('is-open');
    entry.node.classList.add('is-closing');
    setTimeout(() => entry.node.remove(), 180);
    if (reason !== 'silent' && entry.opts.sound !== false) app.audio.play('close');
    if (stack.length) {
      const top = stack[stack.length - 1];
      top.node.classList.remove('is-behind');
      const back = entry.opts.returnFocus;
      const f = back && top.node.contains(back) ? back : top.node.querySelector('[data-autofocus]') || top.node.querySelector('.dialog-body .btn, .dialog-actions .btn, button');
      if (f && app.keyboardMode) f.focus({ preventScroll: true });
    } else {
      layer.classList.remove('is-active', 'is-menu');
      setBackgroundInert(false);
      const back = entry.opts.returnFocus;
      if (back && back.isConnected && app.keyboardMode && reason !== 'silent') back.focus({ preventScroll: true });
    }
    if (entry.opts.pauses) app.popPause(entry.opts.id || 'dialog');
    entry.opts.onClose?.(reason);
    app.onDialogChange?.();
    app.coach?.signal?.(SIGNALS.dialogClose, { id: entry.opts.id || null });
    if (entry.opts.id === 'resume') app.coach?.signal?.(SIGNALS.resumeClose);
  }

  function closeTop() {
    const top = stack[stack.length - 1];
    if (!top || top.opts.closable === false) return false;
    close(top.node, 'escape');
    return true;
  }

  function closeAll() {
    while (stack.length) close(stack[stack.length - 1].node, 'silent');
  }

  const isOpen = () => stack.length > 0;
  const top = () => stack[stack.length - 1]?.opts.id || null;

  // Le reste de la page est inerte tant qu'une fenêtre est ouverte (ni clic, ni focus clavier).
  const BACKGROUND = ['#hud', '#tabbar', '#sheet-layer', '#stage', '#banner', '#decorbar'];
  function setBackgroundInert(on) {
    for (const sel of BACKGROUND) {
      const n = document.querySelector(sel);
      if (n) n.inert = on;
    }
  }

  // Piège à focus : Tab et Maj+Tab tournent dans la fenêtre du dessus, même si le focus était
  // resté ailleurs (clic dans le vide, fenêtre ouverte à la souris).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !stack.length) return;
    const node = stack[stack.length - 1].node;
    const items = [...node.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = node.contains(document.activeElement);
    if (!inside) {
      (e.shiftKey ? last : first).focus();
      e.preventDefault();
    } else if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  });

  // ── Construction d'une fenêtre ────────────────────────────────────────────────
  /**
   * @param o { title, cls, body (nœuds), actions (nœuds), onClose (bouton ×), ribbon: 'red'|'ribbon'|'dark' }
   */
  function frame(o) {
    const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
    const grab = o.onClose ? el('div.dialog-grab', { 'aria-hidden': 'true' }, el('span.sheet-grab-bar')) : null;
    const body = el('div.dialog-body', o.body);
    const ribbon = o.title ? el(`div.dialog-ribbon${o.ribbon ? `.ribbon--${o.ribbon}` : ''}`, el('h2.dialog-title', { id: titleId }, o.title)) : null;
    const box = el(
      `div.dialog${o.cls ? `.${o.cls}` : ''}${o.onClose ? '.is-closable' : ''}`,
      { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      grab,
      ribbon,
      o.onClose ? el('button.dialog-x', { type: 'button', 'aria-label': 'Fermer', onclick: o.onClose }, icon('close', 'md')) : null,
      body,
      o.actions ? el('div.dialog-actions', o.actions) : null,
    );
    // Fenêtre fermable : on la ferme aussi en la faisant glisser vers le bas (téléphone).
    if (o.onClose) swipeToClose(box, { grab: [grab, ribbon], scroller: body, onClose: () => o.onClose() });
    const wrap = el('div', box);
    // Toucher le fond sombre autour de la fenêtre la ferme aussi.
    if (o.onClose) {
      wrap.addEventListener('pointerdown', (e) => {
        if (e.target === wrap) {
          e.preventDefault();
          o.onClose();
        }
      });
    }
    return wrap;
  }

  function btn(label, onclick, cls = '', extra = {}) {
    return el(`button.btn${cls ? `.${cls}` : ''}`, { type: 'button', onclick: (e) => { app.audio.play('click'); onclick(e); }, ...extra }, label);
  }

  // ── Menu principal ────────────────────────────────────────────────────────────
  function mainMenu() {
    closeAll();
    const saved = app.savedRunInfo();
    const buttons = [];
    // Mode Carrière : « Ma ferme » en premier (docs/CARRIERE.md § 1.1).
    if (app.careerMenuButtons) buttons.push(...app.careerMenuButtons(btn));
    // Mode Niveaux : son « Continuer » garde sa propre sauvegarde.
    if (saved) {
      buttons.push(
        btn(
          [el('span.btn-main', 'Continuer le niveau'), el('span.btn-sub', saved.label)],
          () => app.continueRun(),
          'btn--big',
          { id: 'menu-continue' },
        ),
      );
    }
    buttons.push(btn([el('span.btn-main', 'Les niveaux'), el('span.btn-sub', '12 années à contraintes')], () => levelSelect(), 'btn--big', { id: 'menu-new' }));
    if (app.progression?.available()) {
      // Pastille dorée : une étoile peut être dépensée, ou un succès n'a pas encore été vu.
      // (Lot 4) … ou une case de l'album / une récompense de page attend.
      const albumNew = (app.album?.badge?.() || 0) > 0;
      const dot = app.progression.canSpendStars() || app.hasNewAchievements?.() || albumNew;
      buttons.push(
        btn(
          [icon('star', 'sm'), el('span', 'La grange aux souvenirs'), dot ? el('span.menu-dot', { 'aria-label': 'Nouveau' }) : null],
          () => app.grange.open(app.progression.canSpendStars() ? 'bonus' : app.hasNewAchievements?.() ? 'achievements' : albumNew ? 'album' : 'bonus'),
          'btn--big.btn--grange',
          { id: 'menu-grange' },
        ),
      );
    }
    buttons.push(el('div.menu-row', btn('Options', () => options(), 'btn--big', { id: 'menu-options' }), btn('Crédits', () => credits(), 'btn--big', { id: 'menu-credits' })));
    if (app.canInstall()) buttons.push(btn('Installer le jeu', () => app.installApp(), 'btn--big', { id: 'menu-install' }));

    const deco = el('div.menu-deco', ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower'].map((id) => cropIcon(id, 'sprite--deco')));
    const node = el(
      'div',
      el(
        'div.menu-screen',
        el('div.logo', el('div.logo-ribbon', el('h1.logo-title', 'Une année à la ferme')), el('p.logo-sub', 'Un an pour faire prospérer votre ferme, sans faire faillite')),
        el('div.menu-card', deco, el('div.menu-buttons', buttons)),
        app.isTouch ? null : el('p.menu-keys', 'Espace : pause · 1, 2, 3 : vitesses · Échap : menu'),
      ),
    );
    const handle = open(node, { id: 'main-menu', closable: false, menu: true, sound: false });
    app.onMainMenu?.();
    if (shouldWelcome()) a11yWelcome();
    return handle;
  }

  // ── Réglages d'accessibilité (options et premier lancement) ───────────────────
  /** Change un réglage d'accessibilité : enregistrement, puis application immédiate. */
  function setA11y(patch) {
    app.updateSettings(patch);
    applyA11y(app);
    if ('pauseOnSheet' in patch) app.sheets?.syncPause?.();
  }

  /**
   * Interrupteur d'option : case (vraie coche) + libellé (+ précision) + « Oui » / « Non » écrit.
   * @param key réglage (id « opt-<key> ») ; get() : état affiché ; onChange(v)
   */
  function optToggle(key, label, onChange, { get = () => !!app.settings[key], sub = null } = {}) {
    const state = el('span.opt-state', { 'aria-hidden': 'true' });
    const b = el(
      'button.opt-toggle',
      {
        type: 'button',
        role: 'switch',
        id: `opt-${key}`,
        onclick: () => {
          app.audio.play('toggle');
          onChange(!get());
          sync();
        },
      },
      el('span.checkbox'),
      el('span.opt-label', sub ? [el('b', label), el('small', sub)] : label),
      state,
    );
    const sync = () => {
      const on = get();
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      state.textContent = on ? 'Oui' : 'Non';
    };
    sync();
    return b;
  }

  /** Taille du texte : quatre boutons (groupe radio) 100 · 115 · 130 · 150 %. */
  /**
   * (Vallée vivante, lot V4) « Sons de la vallée : Complets · Légers · Coupés » (settings.natureSound) : trois boutons
   * ≥ 48 px ; le moteur du paysage sonore démarre ou s'arrête aussitôt (audio.setNatureDetail, main.js updateAmbience).
   */
  function natureSoundPicker() {
    const CHOICES = [['full', 'Complets'], ['light', 'Légers'], ['off', 'Coupés']];
    const group = el('div.seg.opt-nature', { role: 'radiogroup', 'aria-label': 'Sons de la vallée', id: 'opt-natureSound' });
    const items = CHOICES.map(([id, label]) => el(
      'button.seg-btn',
      {
        type: 'button',
        role: 'radio',
        id: `opt-nature-${id}`,
        'data-mode': id,
        onclick: () => {
          if (app.settings.natureSound === id) return;
          app.audio.play('toggle');
          app.updateSettings({ natureSound: id });
          sync();
        },
      },
      el('span', label),
    ));
    group.append(...items);
    const sync = () => {
      for (const b of items) {
        const on = b.dataset.mode === (app.settings.natureSound || 'full');
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
    };
    sync();
    return el(
      'div.opt-block.opt-nature-block',
      el('span.opt-label', el('b', 'Sons de la vallée')),
      group,
      el('p.opt-note.opt-nature-note', 'Ma ferme, avec la Vallée : ruisseau, chants des habitants. « Légers » pour les petits téléphones.'),
    );
  }

  /**
   * « Sons de l'interface : Normaux · Doux · Coupés » (settings.uiSound, défaut « Doux ») : boutons, fiches, onglets,
   * bascules, erreurs (src/audio/ui-sounds.js). Les sons du jeu (récolte, pièces, animaux…) n'en dépendent pas. Au
   * choix, un « toc » d'essai dans le nouveau mode.
   */
  function uiSoundPicker() {
    const CHOICES = [['normal', 'Normaux'], ['soft', 'Doux'], ['off', 'Coupés']];
    const group = el('div.seg.opt-uisound', { role: 'radiogroup', 'aria-label': 'Sons de l\'interface', id: 'opt-uiSound' });
    const items = CHOICES.map(([id, label]) => el(
      'button.seg-btn',
      {
        type: 'button',
        role: 'radio',
        id: `opt-uisound-${id}`,
        'data-mode': id,
        onclick: () => {
          if ((app.settings.uiSound || 'soft') === id) return;
          app.updateSettings({ uiSound: id });
          app.audio.play('toggle');
          sync();
        },
      },
      el('span', label),
    ));
    group.append(...items);
    const sync = () => {
      for (const b of items) {
        const on = b.dataset.mode === (app.settings.uiSound || 'soft');
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
    };
    sync();
    return el(
      'div.opt-block.opt-uisound-block',
      el('span.opt-label', el('b', 'Sons de l\'interface')),
      group,
      el('p.opt-note', 'Boutons, fiches et onglets. « Doux » : petits sons feutrés et discrets. Les sons du jeu ne changent pas.'),
    );
  }

  function textSizePicker() {
    const group = el('div.seg', { role: 'radiogroup', 'aria-label': 'Taille du texte', id: 'opt-textScale' });
    const items = TEXT_SCALES.map((k) => {
      const pct = Math.round(k * 100);
      return el(
        'button.seg-btn',
        {
          type: 'button',
          role: 'radio',
          id: `opt-text-${pct}`,
          'data-scale': String(k),
          onclick: () => {
            if (app.settings.textScale === k) return;
            app.audio.play('toggle');
            setA11y({ textScale: k });
            sync();
          },
        },
        el('span.seg-sample', { style: `font-size: ${k}rem` }, 'A'),
        el('span.seg-pct', `${pct}\u00a0%`),
      );
    });
    group.append(...items);
    const sync = () => {
      for (const b of items) {
        const on = Number(b.dataset.scale) === app.settings.textScale;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
    };
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = Math.max(0, TEXT_SCALES.indexOf(app.settings.textScale));
      const j = Math.min(TEXT_SCALES.length - 1, Math.max(0, i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)));
      items[j].click();
      items[j].focus();
    });
    sync();
    return el('div.opt-block', el('span.opt-label', el('b', 'Taille du texte')), group);
  }

  /** Les interrupteurs d'accessibilité (options complètes, ou sélection du premier lancement). */
  function a11yToggles({ welcome = false } = {}) {
    const t = {
      readableFont: () => optToggle('readableFont', 'Police très lisible', (v) => setA11y({ readableFont: v }), { sub: 'Lettres simples et bien distinctes (Atkinson Hyperlegible) au lieu de la police pixel.' }),
      highContrast: () => optToggle('highContrast', 'Contrastes renforcés', (v) => setA11y({ highContrast: v }), { sub: 'Contours plus épais, fonds plus foncés, couleurs d\'alerte plus nettes.' }),
      pauseOnSheet: () =>
        optToggle('pauseOnSheet', 'Pause pendant la lecture', (v) => setA11y({ pauseOnSheet: v ? 'on' : 'off' }), {
          get: () => pauseOnSheetActive(app),
          sub: 'Le temps s\'arrête tant qu\'une fiche est ouverte (achats, bilan, graines…).',
        }),
      slowSpeed: () => (slowSpeedSupported() ? optToggle('slowSpeed', 'Vitesse lente ×½', (v) => setA11y({ slowSpeed: v }), { sub: 'Ajoutée au bouton de vitesse : une journée dure deux fois plus longtemps.' }) : null),
      autoPauseDawn: () => (autoPauseDawnSupported(app) ? optToggle('autoPauseDawn', 'Pause chaque matin', (v) => setA11y({ autoPauseDawn: v }), { sub: 'Le jeu s\'arrête au début de chaque journée : reprenez quand vous êtes prêt.' }) : null),
      reducedMotion: () => optToggle('reducedMotion', 'Réduire les animations', (v) => setA11y({ reducedMotion: v }), { sub: 'Moins de mouvements à l\'écran, pas d\'éclairs d\'orage.' }),
      plotHints: () => optToggle('plotHints', 'Repères sur les parcelles', (v) => setA11y({ plotHints: v }), { sub: 'Signale les parcelles à arroser et les jeunes pousses.' }),
      vibration: () => ('vibrate' in navigator ? optToggle('vibration', 'Vibrations', (v) => { setA11y({ vibration: v }); if (v) app.vibrate(20); }, { sub: 'Petite vibration au toucher et aux alertes.' }) : null),
      controlsBottom: () => optToggle('controlsBottom', 'Vitesse et pause en bas', (v) => setA11y({ controlsBottom: v }), { sub: 'Le bouton de vitesse passe dans la barre du bas, sous le pouce.' }),
      leftHanded: () => optToggle('leftHanded', 'Disposition pour gaucher', (v) => setA11y({ leftHanded: v }), { sub: 'Le bouton de vitesse passe à gauche.' }),
      pinchZoom: () => optToggle('pinchZoom', 'Loupe de l\'interface', (v) => setA11y({ pinchZoom: v }), { sub: 'Agrandir toute la page en écartant deux doigts sur les barres et les fiches. (Pour la ferme seule : pincez la ferme, ou boutons + et −.)' }),
    };
    const keys = welcome ? ['readableFont', 'pauseOnSheet', 'slowSpeed', 'reducedMotion', 'controlsBottom'] : Object.keys(t);
    return keys.map((k) => t[k]());
  }

  /** Premier lancement : proposer les réglages d'accessibilité une fois (pas sous Playwright, sauf ?welcome). */
  function shouldWelcome() {
    if (app.settings.a11yOffered || top() === 'a11y-welcome') return false;
    if (navigator.webdriver && !new URLSearchParams(location.search).has('welcome')) return false;
    return true;
  }

  /** Fenêtre courte et amicale : taille du texte, quelques interrupteurs, « C'est parti » / « Plus tard ». */
  function a11yWelcome() {
    let handle = null;
    const done = () => {
      app.updateSettings({ a11yOffered: true, guidanceAsked: true });
      handle?.close();
    };
    const node = frame({
      title: 'Bienvenue !',
      ribbon: 'ribbon',
      cls: 'dialog--welcome',
      body: [
        el('p.welcome-text', 'Réglez le jeu pour jouer confortablement. Vous pourrez tout changer plus tard dans Options, rubrique Accessibilité.'),
        el(
          'div.options',
          textSizePicker(),
          // (Accompagnement, § 10.1) Joseph vous accompagne : Complet (défaut) · Discret · Aucun.
          el('div.opt-block.welcome-coach', el('span.opt-label', el('b', 'Joseph vous accompagne')), guidancePicker(app, { idPrefix: 'welcome-coach', rows: true })),
          ...a11yToggles({ welcome: true }),
        ),
      ],
      actions: [btn('Plus tard', () => done(), '', { id: 'welcome-later' }), btn('C\'est parti', () => done(), 'btn--red', { id: 'welcome-ok', 'data-autofocus': '' })],
    });
    handle = open(node, {
      id: 'a11y-welcome',
      onClose: (reason) => {
        // Fermée par le jeu (menu reconstruit) : elle sera reproposée ; fermée par le joueur : jamais.
        if (reason !== 'silent' && reason !== 'replace' && !app.settings.a11yOffered) app.updateSettings({ a11yOffered: true, guidanceAsked: true });
      },
    });
    return handle;
  }

  // ── Choix du niveau ───────────────────────────────────────────────────────────
  /** Systèmes v3 d'un niveau (icônes et libellés visibles sur sa carte). */
  function levelSystems(lvl) {
    const inv = lvl.availableInvestments || [];
    const out = [];
    const shop = ['jamWorkshop', 'dairy', 'mill'].filter((id) => inv.includes(id));
    if (shop.length) out.push({ node: investmentIcon(shop[0], 'sprite--xs'), label: shop.length > 1 ? 'Ateliers' : 'Atelier' });
    if ((lvl.startTrees || []).length || (lvl.id >= 9 && (lvl.crops || []).includes('apple'))) out.push({ node: cropIcon('apple', 'sprite--xs'), label: (lvl.startTrees || []).length ? 'Vieux pommiers' : 'Pommiers' });
    if (inv.includes('goat')) out.push({ node: investmentIcon('goat', 'sprite--xs'), label: 'Chèvres' });
    if (lvl.contest) out.push({ node: spriteAny(['icon.trophy.gold', 'icon.medal'], 'sprite--xs', 'star'), label: 'Concours' });
    if (lvl.modifiers?.rawPriceFactor && lvl.modifiers.rawPriceFactor < 1) out.push({ node: icon('coin', 'xs'), label: `Récoltes −${Math.round((1 - lvl.modifiers.rawPriceFactor) * 100)} %` });
    if (lvl.modifiers?.pollination) out.push({ node: investmentIcon('beehive', 'sprite--xs'), label: 'Pollinisation' });
    return out;
  }

  /** Interrupteur « Bonus permanents » (choix du niveau) : activés (n) / désactivés, lien vers la grange. */
  function perksBar(onChange) {
    const P = app.progression;
    if (!P?.available()) return null;
    const bought = Object.keys(P.get().perks || {}).length;
    const box = el('span.checkbox');
    const label = el('span.opt-label');
    const sw = el('button.opt-toggle.perks-switch', { type: 'button', role: 'switch', id: 'levels-perks' }, box, label);
    const sync = () => {
      const on = P.perksEnabled();
      sw.classList.toggle('is-on', on);
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      label.textContent = '';
      label.append(el('b', 'Bonus permanents'), el('small', bought ? (on ? `activés (${bought})` : 'désactivés : jeu d\'origine') : 'aucun bonus acheté'));
    };
    sw.addEventListener('click', () => {
      app.audio.play('toggle');
      P.setPerksEnabled(!P.perksEnabled());
      sync();
      onChange?.();
    });
    sync();
    const grange = btn([icon('star', 'sm'), 'Grange'], () => app.grange.open('bonus'), 'btn--small.btn--grange-link', { id: 'levels-grange' });
    return el('div.perks-bar', sw, grange);
  }

  /**
   * Choix du mode de difficulté (nouvelles parties) : deux grandes options, Détente recommandée.
   * @param onChange appelé après un changement (ex. rafraîchir les cartes des niveaux)
   */
  function difficultySwitch(onChange) {
    const TEXTS = {
      detente: { title: 'Détente', tag: 'recommandé', sub: 'Pour jouer tranquille' },
      classique: { title: 'Classique', tag: null, sub: 'Pour les fermiers aguerris' },
    };
    const group = el('div.diff-switch', { role: 'radiogroup', 'aria-label': 'Difficulté des nouvelles parties', id: 'diff-switch' });
    const desc = el('p.diff-desc');
    const buttons = DIFFICULTY_IDS.map((id) => {
      const t = TEXTS[id] || { title: DIFFICULTIES[id].name, sub: '' };
      const b = el(
        `button.diff-opt.is-${id}`,
        {
          type: 'button',
          role: 'radio',
          id: `diff-${id}`,
          onclick: () => {
            if (app.difficulty() === id) return;
            app.audio.play('toggle');
            app.setDifficulty(id);
            sync();
            onChange?.(id);
          },
        },
        el('span.diff-radio', { 'aria-hidden': 'true' }),
        el('span.diff-text', el('b.diff-title', t.title, t.tag ? el('span.diff-tag', t.tag) : null), el('small.diff-sub', t.sub)),
      );
      return b;
    });
    group.append(...buttons);
    const sync = () => {
      const cur = app.difficulty();
      for (const b of buttons) {
        const on = b.id === `diff-${cur}`;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      desc.textContent = '';
      desc.append(DIFFICULTIES[cur]?.description || '');
    };
    // Flèches du clavier : passer d'une option à l'autre (groupe radio).
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = DIFFICULTY_IDS.indexOf(app.difficulty());
      const next = DIFFICULTY_IDS[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + DIFFICULTY_IDS.length) % DIFFICULTY_IDS.length];
      buttons[DIFFICULTY_IDS.indexOf(next)].click();
      buttons[DIFFICULTY_IDS.indexOf(next)].focus();
    });
    sync();
    return el('div.diff-box', el('div.diff-head', 'Difficulté'), group, desc);
  }

  /** Petite étiquette du mode d'une partie (« Détente », « Classique »). */
  function modeBadge(id) {
    const d = DIFFICULTIES[id];
    return d ? el(`span.mode-badge.is-${id}`, d.name) : null;
  }

  function levelSelect() {
    const grid = el('div.level-grid');
    const fill = () => grid.replaceChildren(...levelCards(app.difficulty()));
    fill();
    const node = frame({
      title: 'Choisir une année',
      ribbon: 'ribbon',
      cls: 'dialog--levels',
      body: [difficultySwitch(() => fill()), perksBar(), grid],
      actions: [btn('Retour', () => closeTop(), '', { 'data-autofocus': '' })],
      onClose: () => closeTop(),
    });
    return open(node, { id: 'levels' });
  }

  /** Cartes des niveaux, avec les nombres du mode choisi (départ, fermages, objectifs). */
  function levelCards(mode) {
    const progress = app.progress();
    return LEVELS.map((base) => {
      const lvl = levelFor(base.id, mode) || base;
      const p = progress.levels[lvl.id] || {};
      const unlocked = app.isLevelUnlocked(lvl.id);
      const systems = lvl.id >= 9 ? levelSystems(lvl) : [];
      const isNew = unlocked && lvl.id >= 9 && !p.played && !p.completed;
      const stars = p.stars || 0;
      const prev = LEVELS.find((l) => l.id === lvl.id - 1);
      const card = el(
        `button.level-card${unlocked ? '' : '.is-locked'}${p.completed ? '.is-done' : ''}`,
        {
          type: 'button',
          id: `level-${lvl.id}`,
          'aria-disabled': unlocked ? 'false' : 'true',
          onclick: () => {
            if (!unlocked) {
              app.audio.play('error');
              app.toasts.show({ kind: 'error', text: `Terminez d'abord « ${prev?.name} ».` });
              return;
            }
            app.audio.play('confirm');
            app.startLevel(lvl.id);
          },
        },
        el('div.level-head', el('span.level-num', String(lvl.id)), el('span.level-name', lvl.name), isNew ? el('span.level-new', 'Nouveau') : null),
        el('p.level-desc', lvl.description),
        systems.length ? el('div.level-systems', systems.map((x) => el('span.level-sys', x.node, x.label))) : null,
        el(
          'div.level-meta',
          el('span', icon('coin', 'xs'), `Départ ${fmt(lvl.startMoney)}`),
          el('span', icon('seed', 'xs'), `${lvl.unlockedPlots}${lvl.maxPlots > lvl.unlockedPlots ? `/${lvl.maxPlots}` : ''} parcelles`),
          el('span.level-rents', { 'data-tip': 'Fermages du printemps à l\'hiver' }, icon('bill', 'xs'), `Fermages ${lvl.rents.map((r) => fmt(r)).join(' · ')}`),
          el('span.level-goals', icon('star', 'xs'), `2★ dès ${fmt(lvl.starThresholds[0])} · 3★ dès ${fmt(lvl.starThresholds[1])}`),
        ),
        el(
          'div.level-foot',
          el('span.level-stars', [0, 1, 2].map((i) => icon(i < stars ? 'star' : 'star-empty', 'sm'))),
          // (Lot 4) Meilleur total des lanternes du niveau (« 🏮 13 / 20 »).
          app.cozy?.levelBadge?.(lvl.id) || null,
          unlocked ? el('span.level-best', p.bestMoney != null ? `Record : ${fmt(p.bestMoney)}` : lvl.id === 1 ? 'Avec tutoriel' : 'Nouveau !') : el('span.level-lock', icon('lock', 'sm'), `Finir le niveau ${lvl.id - 1}`),
        ),
      );
      return card;
    });
  }

  // ── Options ───────────────────────────────────────────────────────────────────
  function options() {
    const s = app.settings;
    const slider = (key, label) => {
      const value = el('span.slider-value', `${Math.round(s[key] * 100)} %`);
      const input = el('input.slider', {
        type: 'range',
        min: '0',
        max: '100',
        step: '5',
        value: String(Math.round(s[key] * 100)),
        'aria-label': label,
        id: `opt-${key}`,
      });
      const paint = () => input.style.setProperty('--val', `${input.value}%`);
      paint();
      input.addEventListener('input', () => {
        paint();
        value.textContent = `${input.value}\u00a0%`;
        app.updateSettings({ [key]: Number(input.value) / 100 });
      });
      input.addEventListener('change', () => {
        if (key === 'sfxVolume') app.audio.play('coin');
      });
      return el('label.opt-row', el('span.opt-label', label), input, value);
    };
    const toggle = (key, label, onChange, get = () => !!app.settings[key]) => optToggle(key, label, onChange, { get });
    const inRun = app.game && !app.inMenu && app.game.state.status === 'playing' ? app.game : null;
    const runNote = el('p.opt-note');
    const inCareer = inRun?.mode === 'career';
    const syncRunNote = () => {
      runNote.hidden = !inRun || (!inCareer && inRun.difficulty === app.difficulty());
      runNote.textContent = inCareer ? `Pour les niveaux seulement : votre ferme garde la difficulté choisie à sa création (${DIFFICULTIES[inRun.difficulty]?.name || ''}).` : inRun ? `S'applique à la prochaine année : la partie en cours reste en mode ${DIFFICULTIES[inRun.difficulty]?.name || ''}.` : '';
    };
    syncRunNote();
    const body = el(
      'div.options',
      el('h3.opt-section', 'Difficulté'),
      difficultySwitch(() => syncRunNote()),
      runNote,
      el('h3.opt-section', 'Volumes'),
      slider('musicVolume', 'Musique'),
      slider('sfxVolume', 'Sons'),
      uiSoundPicker(),
      slider('ambienceVolume', 'Ambiance'),
      natureSoundPicker(),
      toggle('muted', 'Couper tout le son', (v) => app.updateSettings({ muted: v })),
      el('h3.opt-section', { id: 'opt-msg' }, 'Messages'),
      app.messages?.modePicker?.() || null,
      // (Accompagnement, § 4.7) Complet · Discret · Aucun, et le carnet de Joseph.
      el('h3.opt-section', { id: 'opt-coach' }, 'Accompagnement'),
      el('div.opt-block', el('span.opt-label', el('b', 'Joseph vous accompagne')), guidancePicker(app, { idPrefix: 'opt-coach', rows: true })),
      btn([icon('info', 'sm'), 'Ouvrir le carnet de Joseph'], () => app.openCarnet?.(), 'btn--wide', { id: 'opt-carnet' }),
      el('h3.opt-section', { id: 'opt-a11y' }, 'Accessibilité'),
      textSizePicker(),
      ...a11yToggles(),
      el('h3.opt-section', 'Téléphone et affichage'),
      // Intro « MG studios » à chaque ouverture (src/intro/gate.js), activée par défaut
      optToggle('intro', 'Intro au démarrage', (v) => app.updateSettings({ intro: v }), { sub: 'L\'animation « MG studios » à chaque ouverture du jeu.' }),
      app.wakeLockSupported() ? toggle('keepAwake', 'Garder l\'écran allumé pendant la partie', (v) => app.updateSettings({ keepAwake: v })) : null,
      document.fullscreenEnabled && !app.isStandalone() ? toggle('fullscreen', 'Plein écran', () => app.toggleFullscreen(), () => !!document.fullscreenElement) : null,
      app.canInstall() ? btn([icon('star', 'sm'), 'Installer le jeu sur l\'appareil'], () => app.installApp(), 'btn--wide', { id: 'opt-install' }) : null,
      el('h3.opt-section', 'En cas de problème'),
      el(
        'div.opt-repair',
        el('p', 'Le jeu s\'affiche mal ou ne se met pas à jour ? Vide le cache hors ligne et recharge le jeu. Votre progression et votre partie sont conservées.'),
        btn('Réparer le jeu (vider le cache)', async () => {
          const ok = await confirm({
            title: 'Réparer le jeu ?',
            text: 'Le cache hors ligne sera vidé et le jeu rechargé depuis Internet (connexion nécessaire). La progression et la partie en cours sont gardées.',
            ok: 'Réparer',
          });
          if (ok) app.repairGame();
        }, 'btn--wide', { id: 'opt-repair' }),
      ),
      el('h3.opt-section', 'Progression'),
      el(
        'div.opt-danger',
        el('p', app.progression?.available() ? 'Efface les étoiles, les niveaux débloqués, les bonus, les succès, les écus, les décorations, le tutoriel, la partie en cours et votre ferme (mode Carrière).' : 'Efface les étoiles, les niveaux débloqués, le tutoriel, la partie en cours et votre ferme.'),
        btn('Réinitialiser la progression', async () => {
          const ok = await confirm({
            title: 'Tout effacer ?',
            text: app.progression?.available()
              ? 'Les étoiles, les niveaux débloqués, les bonus achetés, les succès, les écus, les décorations, la partie en cours ET votre ferme de carrière (sans archive) seront perdus. Cette action est définitive.'
              : 'Les étoiles, les niveaux débloqués, la partie en cours et votre ferme de carrière seront perdus. Cette action est définitive.',
            ok: 'Tout effacer',
            danger: true,
          });
          if (ok) {
            app.resetProgress();
            app.toasts.show({ kind: 'success', text: 'Progression réinitialisée.' });
          }
        }, 'btn--wide', { id: 'opt-reset' }),
      ),
    );
    const node = frame({
      title: 'Options',
      ribbon: 'ribbon',
      cls: 'dialog--options',
      body,
      actions: [btn('Retour', () => closeTop(), 'btn--red', { 'data-autofocus': '' })],
      onClose: () => closeTop(),
    });
    return open(node, { id: 'options', pauses: !!app.game && !app.inMenu });
  }

  // ── Crédits ───────────────────────────────────────────────────────────────────
  function credits() {
    const link = (href, label) => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label || href.replace(/^https?:\/\//, ''));
    const body = el(
      'div.credits',
      el('p.credits-intro', '« Une année à la ferme » n\'utilise que des ressources libres. Merci à leurs auteurs !'),
      el(
        'section.credit-block.is-required',
        el('h3', icon('sound', 'sm'), 'Musique'),
        el(
          'blockquote.credit-quote',
          '« Spring Farm », « Summer Farm », « Fall Farm », « Winter Farm », « Town Theme », « Night Time », « Festival Music » par ',
          el('strong', 'Sirental'),
          ' (',
          link('https://sirental.itch.io/farming-game-music'),
          '), licence ',
          link('https://creativecommons.org/licenses/by/4.0/', 'CC BY 4.0'),
          '.',
        ),
        el('p.credit-small', 'Fichiers renommés ; versions mp3 de secours réencodées à partir des WAV d\'origine.'),
      ),
      el(
        'section.credit-block',
        el('h3', sprite('crop.carrot.icon', 'sprite--xs'), 'Graphismes'),
        el('p', el('strong', 'Kenney'), ' (', link('https://www.kenney.nl', 'kenney.nl'), ') — Tiny Farm, Tiny Town et UI Pack Pixel Adventure, domaine public (CC0).'),
        el('p.credit-small', 'Quelques tuiles (plants en pousse, tournesol, panneau solaire, arroseur, icônes de météo et de l\'interface) ont été dessinées pour le jeu dans le même style, elles aussi en CC0.'),
        el('p.credit-small', 'Intro « MG studios » : le coq, le panneau et le décor ont été dessinés pour le jeu (CC0).'),
      ),
      el(
        'section.credit-block',
        el('h3', icon('coin', 'sm'), 'Effets sonores'),
        el('p', el('strong', 'Kenney'), ' — Interface Sounds, RPG Audio, Impact Sounds, Music Jingles (CC0).'),
        el(
          'p',
          'Freesound (CC0) : ',
          [
            ['Breviceps', 'poules'],
            ['BenjaminNelan', 'coq'],
            ['DataJuggler', 'abeilles'],
            ['Psykophobia', 'oiseaux'],
            ['JosephSardin', 'vache'],
            ['zachrau', 'mouton'],
            ['jmbphilmes', 'pluie'],
            ['derjuli', 'arrosoir'],
            ['magnuswaker', 'vent'],
            ['_stubb', 'battement d\'ailes de l\'intro'],
          ].map(([who, what], i, arr) => [el('strong', who), ` (${what})`, i < arr.length - 1 ? ', ' : '.']),
        ),
      ),
      el(
        'section.credit-block',
        el('h3', icon('info', 'sm'), 'Police'),
        el('p', el('strong', 'Jersey 15'), ' — Sarah Cadigan-Fried (The Soft Type Project), SIL Open Font License 1.1 (', link('https://github.com/scfried/soft-type-jersey', 'github.com/scfried/soft-type-jersey'), ').'),
        el('p.credit-small', 'Version modifiée pour le jeu : « I » à empattements, flèches et symboles ajoutés, lettres agrandies, graisse grasse ajoutée (même licence).'),
      ),
      el('p.credit-small', 'La liste détaillée de chaque fichier se trouve dans CREDITS.md.'),
    );
    const node = frame({
      title: 'Crédits',
      ribbon: 'ribbon',
      cls: 'dialog--credits',
      body,
      actions: [btn('Retour', () => closeTop(), 'btn--red', { 'data-autofocus': '' })],
      onClose: () => closeTop(),
    });
    return open(node, { id: 'credits' });
  }

  // ── Pause ─────────────────────────────────────────────────────────────────────
  function pauseMenu() {
    if (top() === 'pause') return null;
    const g = app.game;
    if (g?.mode === 'career') return careerPauseMenu(g);
    const c = g.query.calendar();
    const lvl = g.query.level();
    const body = el(
      'div.pause',
      el('p.pause-info', `Niveau ${lvl.id} · ${lvl.name}`, g.difficulty ? modeBadge(g.difficulty) : null),
      el('p.pause-sub', icon(c.seasonId, 'sm'), `Jour ${c.day} · ${c.seasonName}`, el('span.pause-money', icon('coin', 'sm'), fmt(g.state.money))),
      el(
        'div.menu-buttons',
        btn('Reprendre', () => closeTop(), 'btn--red.btn--big', { id: 'pause-resume', 'data-autofocus': '' }),
        app.decor?.available() ? btn('Décorer la ferme', () => app.decor.enter(), 'btn--big', { id: 'pause-decor' }) : null,
        btn('Options', () => options(), 'btn--big', { id: 'pause-options' }),
        btn('Recommencer l\'année', async () => {
          const ok = await confirm({ title: 'Recommencer ?', text: 'La partie en cours sera perdue et l\'année recommencera au premier jour du printemps.', ok: 'Recommencer', danger: true });
          if (ok) app.restartLevel();
        }, 'btn--big', { id: 'pause-restart' }),
        btn('Quitter vers le menu', async () => {
          const ok = await confirm({
            title: 'Quitter la partie ?',
            text: 'Votre progression est sauvegardée : vous pourrez reprendre l\'année là où vous l\'avez laissée avec « Continuer », depuis le menu principal.',
            ok: 'Quitter',
            cancel: 'Rester',
          });
          if (ok) app.quitToMenu();
        }, 'btn--big', { id: 'pause-quit' }),
      ),
      el('p.pause-hint', 'La partie est sauvegardée automatiquement chaque matin et quand vous quittez.'),
    );
    const node = frame({ title: 'Pause', ribbon: 'ribbon', cls: 'dialog--pause', body, onClose: () => closeTop() });
    return open(node, { id: 'pause', pauses: true });
  }

  /** Pause de la carrière : ferme, année, rang ; « Recommencer une ferme » (double confirmation, archive). */
  function careerPauseMenu(g) {
    const c = g.query.calendar();
    let s = null;
    try {
      s = g.query.career.summary();
    } catch {
      s = null;
    }
    const body = el(
      'div.pause',
      el('p.pause-info', s?.farmName || 'Ma ferme', modeBadge(g.state.career?.difficulty || 'detente')),
      el('p.pause-sub', icon(c.seasonId, 'sm'), `Année ${g.state.time.year} · ${c.seasonName} ${c.dayOfSeason}/${c.seasonLength}`, el('span.pause-money', icon('coin', 'sm'), fmt(g.state.money))),
      s ? el('p.pause-sub', spriteAny([`icon.career.rank.${s.rank}`], 'sprite--sm', 'star'), `${s.rankName} · ${s.title}`) : null,
      el(
        'div.menu-buttons',
        btn('Reprendre', () => closeTop(), 'btn--red.btn--big', { id: 'pause-resume', 'data-autofocus': '' }),
        btn('Options', () => options(), 'btn--big', { id: 'pause-options' }),
        btn('Recommencer une ferme', async () => {
          const ok = await confirm({ title: 'Recommencer une ferme ?', text: `« ${s?.farmName || 'Votre ferme'} » sera archivée dans la grange puis effacée. Vous choisirez ensuite une nouvelle ferme.`, ok: 'Continuer', danger: true });
          if (!ok) return;
          const sure = await confirm({ title: 'Vraiment ?', text: 'Dernière vérification : la ferme actuelle ne pourra plus être reprise.', ok: 'Recommencer', danger: true });
          if (sure) app.restartCareer?.();
        }, 'btn--big', { id: 'pause-restart' }),
        btn('Quitter vers le menu', async () => {
          const ok = await confirm({ title: 'Quitter la ferme ?', text: 'Votre ferme est sauvegardée : reprenez-la avec « Ma ferme » depuis le menu principal. Le temps s\'arrête pendant votre absence.', ok: 'Quitter', cancel: 'Rester' });
          if (ok) app.quitToMenu();
        }, 'btn--big', { id: 'pause-quit' }),
      ),
      el('p.pause-hint', 'La ferme est sauvegardée chaque matin, après chaque gros achat et quand vous quittez.'),
    );
    const node = frame({ title: 'Pause', ribbon: 'ribbon', cls: 'dialog--pause', body, onClose: () => closeTop() });
    return open(node, { id: 'pause', pauses: true });
  }

  // ── Bilan chiffré ─────────────────────────────────────────────────────────────
  function moneyLine(label, value, cls = '') {
    if (value === '0') cls = 'mid';
    return el('div.sum-line', el('span', label), el(`b${cls ? `.${cls}` : ''}`, value));
  }

  function summaryLines(s, { rent = null } = {}) {
    const lines = [
      moneyLine(`Récoltes vendues${s.totalHarvested ? ` (${s.totalHarvested})` : ''}`, gain(s.harvestIncome), 'pos'),
      moneyLine('Revenus des investissements', gain(s.investmentIncome), 'pos'),
    ];
    if (s.productIncome || s.rawSales) lines.push(moneyLine('Produits transformés', gain((s.productIncome || 0) + (s.rawSales || 0)), 'pos'));
    if (s.contestPrize) lines.push(moneyLine('Prix du concours', gain(s.contestPrize), 'pos'));
    if (s.frostRefund) lines.push(moneyLine('Assurance gel', gain(s.frostRefund), 'pos'));
    // (Lots 2 et 3) Surprises de l'aube ; le village (primes des commandes et de la charrette, cadeaux, médailles).
    if (s.surpriseIncome) lines.push(moneyLine('Surprises', gain(s.surpriseIncome), 'pos'));
    if (s.varietyIncome) lines.push(moneyLine('Le village (primes, cadeaux)', s.varietyIncome >= 0 ? gain(s.varietyIncome) : loss(-s.varietyIncome), s.varietyIncome >= 0 ? 'pos' : 'neg'));
    lines.push(moneyLine('Charges quotidiennes', loss(s.charges), 'neg'));
    if (s.waterSpent) lines.push(moneyLine('Arrosage', loss(s.waterSpent), 'neg'));
    if (s.loanPaid) lines.push(moneyLine('Prêt', loss(s.loanPaid), 'neg'));
    const spent = s.seedsSpent + s.plotsSpent;
    if (spent) lines.push(moneyLine('Graines et parcelles', loss(spent), 'neg'));
    if (s.investmentsSpent) lines.push(moneyLine('Investissements achetés', loss(s.investmentsSpent), 'neg'));
    const rentValue = rent ?? s.rentsPaid;
    if (rentValue) lines.push(moneyLine(rent !== null ? 'Fermage' : 'Fermages', loss(rentValue), 'neg'));
    // Bilan de l'année (pas de la saison) : le prêt de Joseph compte (prêté − rendu).
    if (rent === null && s.neighbourLoan) {
      if (s.neighbourLoan.borrowed) lines.push(moneyLine('Prêté par Joseph', gain(s.neighbourLoan.borrowed), 'pos'));
      if (s.neighbourLoan.repaid) lines.push(moneyLine('Rendu à Joseph', loss(s.neighbourLoan.repaid), 'neg'));
    }
    lines.push(el('div.sum-total', moneyLine('Bilan', signed(s.net), s.net >= 0 ? 'pos' : 'neg')));
    return el('div.sum-lines', lines);
  }

  function harvestChips(cropsHarvested, productsSold = null) {
    const list = Object.entries(cropsHarvested || {}).filter(([, n]) => n > 0);
    const prods = Object.entries(productsSold || {}).filter(([, n]) => n > 0);
    if (!list.length && !prods.length) return null;
    return el(
      'div.harvest-list',
      list.map(([id, n]) => el('span.harvest-chip.has-tip', { 'data-tip': cropCount(id, n) }, cropIcon(id, 'sprite--sm'), el('b', `×${n}`))),
      prods.map(([id, n]) => el('span.harvest-chip.is-product', productIcon(id, 'sprite--sm'), el('b', `×${n}`))),
    );
  }

  /** Récompenses de fin d'année : écus, succès débloqués, étoiles à dépenser (bouton Grange). */
  function rewardsBlock(record) {
    if (!record || !app.progression?.available()) return null;
    const ecus = record.rewards?.ecus || 0;
    const achs = record.achievements || [];
    const spare = record.starsAvailable || 0;
    const nodes = [];
    if (ecus) nodes.push(el('p.end-ecus', ecuIcon('sprite--sm'), `+${plural(ecus, 'écu')}`, el('small', ` (vous en avez ${fmt(app.progression.ecus())})`)));
    if (achs.length) {
      nodes.push(
        el(
          'div.end-achs',
          el('h3.sum-title', icon('star', 'sm'), achs.length > 1 ? `${achs.length} succès débloqués` : 'Succès débloqué'),
          el(
            'div.end-ach-list',
            achs.map((id) => {
              const d = app.progression.achievementDef(id);
              return el('span.end-ach', achievementIcon(id, true, 'sprite--md', d?.reward?.stars || 0), el('span', d?.name || id), d?.reward ? el('small', app.progression.rewardText(d.reward)) : null);
            }),
          ),
        ),
      );
    }
    if (spare > 0 && app.progression.canSpendStars()) {
      nodes.push(
        el(
          'div.end-spare',
          el('p', icon('star', 'sm'), `Vous avez ${plural(spare, 'étoile')} à dépenser.`),
          btn([icon('star', 'sm'), 'Grange aux souvenirs'], () => app.openGrangeFromEnd('bonus'), 'btn--wide', { id: 'end-grange' }),
        ),
      );
    }
    return nodes.length ? el('div.end-rewards', nodes) : null;
  }

  // ── Fin de saison ─────────────────────────────────────────────────────────────
  /**
   * @param ev     événement billPaid ({ amount, seasonId, summary })
   * @param extra  { frost: événement frost ou null }
   */
  function seasonEnd(ev, extra = {}) {
    const g = app.game;
    const lvl = g.query.level();
    const sIdx = SEASONS.indexOf(ev.seasonId);
    const next = SEASONS[sIdx + 1];
    const s = ev.summary;
    // Cultures de la partie : celles du niveau (+ les nouveautés avec « Semencier », niveaux 1 à 8 seulement).
    const runCrops = gameCrops(lvl, g.state.perks || {});
    const crops = runCrops.filter((c) => c.seasons.includes(next));
    const hardy = runCrops.filter((c) => c.frostHardy).map((c) => c.name.toLowerCase());
    const hardyText = hardy.length > 1 ? `${hardy.slice(0, -1).join(', ')} et ${hardy[hardy.length - 1]}` : hardy[0] || 'le navet et le chou';
    const lost = extra.frost ? (extra.frost.lost || extra.frost.lostPlots || []).length : 0;

    const nextBlock = el(
      'div.next-season',
      el('h3.sum-title', icon(next, 'sm'), seasonArrives(next)),
      el('div.next-crops', crops.map((c) => el('span.next-crop.has-tip', { 'data-tip': `${c.name} : ${plural(c.growDays, 'jour')}, graine ${c.seedCost}, vente ${c.sellPrice}${c.frostHardy ? ' — résiste au gel' : ''}` }, cropIcon(c.id, 'sprite--sm'), el('span', c.name)))),
      el('p.next-rent', icon('bill', 'xs'), `Fermage ${season(next, 'of')} : `, el('b', plural(lvl.rents[sIdx + 1], 'pièce')), `, à payer dans ${plural(lvl.seasonLengths[sIdx + 1], 'jour')}.`),
      next === 'winter'
        ? el(
            `p.next-warn${lost ? '.is-danger' : '.is-ok'}`,
            icon('winter', 'sm'),
            lost
              ? `Le gel de la première nuit d'hiver a détruit ${plural(lost, 'culture')}${extra.frost?.refund ? ` (assurance gel : +${fmt(extra.frost.refund)})` : ''}. Seuls ${hardyText} résistent au froid.`
              : `Aucune culture n'a gelé cette nuit : bien joué ! En hiver, ${crops.length ? `on peut planter : ${crops.map((c) => c.name.toLowerCase()).join(', ')}` : 'rien ne se plante'}.`,
          )
        : null,
      next === 'autumn' ? el('p.next-warn', icon('winter', 'sm'), 'Pensez à l\'hiver : les cultures qui ne résistent pas au gel seront perdues le premier jour d\'hiver.') : null,
    );

    const loan = extra.loan || null;
    const debt = g.query.finance().neighbourLoan?.debt || 0;
    const body = el(
      'div.season-end',
      el('div.rent-paid', icon('coin', 'lg'), el('div', el('div.rent-paid-title', `Fermage payé : ${plural(ev.amount, 'pièce')}`), el('div.rent-paid-sub', `Il vous reste ${plural(g.state.money, 'pièce')}.`))),
      loan
        ? el('p.next-warn.is-loan', sprite('farmer', 'sprite--sm'), `Joseph vous a avancé ${plural(loan.amount, 'pièce')}. Vous lui devez ${plural(debt, 'pièce')} : la moitié de vos ventes le rembourse.`)
        : debt > 0
          ? el('p.next-warn.is-loan', sprite('farmer', 'sprite--sm'), `Vous devez encore ${plural(debt, 'pièce')} à Joseph : tant que ce n'est pas réglé, il ne pourra pas vous dépanner.`)
          : null,
      el('div.season-cols', el('div', el('h3.sum-title', icon(ev.seasonId, 'sm'), `Bilan ${season(ev.seasonId, 'of')}`), summaryLines(s.season, { rent: ev.amount }), harvestChips(s.season.cropsHarvested, s.season.productsSold), app.variety?.seasonSummary?.(ev) || null), nextBlock),
    );
    // (Lot 3) Pages suivantes : « Un cadeau pour la saison » (2 cartes), puis « Les défis de … » (3 défis).
    // Chaque page a « Plus tard » : le choix attend (pastille sur l'onglet Bilan).
    const pages = app.variety?.seasonPages?.(ev) || [];
    let idx = 0;
    const onClose = (reason) => {
      if (reason !== 'replace') extra.onClose?.(reason);
    };
    const nextPage = () => {
      if (idx >= pages.length) {
        closeTop();
        return;
      }
      const p = pages[idx++];
      const pageNode = frame({ title: p.title, ribbon: 'ribbon', cls: 'dialog--season.dialog--variety', body: p.body(nextPage), actions: p.actions(nextPage) });
      open(pageNode, { id: 'season-end', pauses: true, replace: true, sound: false, onClose });
      app.audio.play('page', { volume: 0.7 });
    };
    const node = frame({
      title: season(ev.seasonId, 'end'),
      ribbon: 'ribbon',
      cls: 'dialog--season',
      body,
      actions: [btn([`Continuer`, icon('play', 'sm')], () => nextPage(), 'btn--red', { 'data-autofocus': '', id: 'season-continue' })],
    });
    return open(node, { id: 'season-end', pauses: true, onClose });
  }

  // ── Prêt du voisin (mode détente) ─────────────────────────────────────────────
  /**
   * Joseph avance l'argent du fermage : fenêtre chaleureuse, avant le bilan de fin de saison.
   * @param ev neighbourLoan ({ amount, debt, missing, rent, seasonId, surcharge, repayShare })
   */
  function neighbourLoan(ev, { onClose } = {}) {
    const share = ev.repayShare === 0.5 ? 'La moitié' : `${Math.round((ev.repayShare || 0.5) * 100)} %`;
    const cushion = Math.max(0, ev.amount - ev.missing);
    // Taux annoncé : celui du mode (10 %), pas l'écart arrondi à la pièce supérieure.
    const rate = app.game?.query.finance().neighbourLoan?.surcharge;
    const pct = Math.round((rate ?? (ev.amount > 0 ? ev.surcharge / ev.amount : 0.1)) * 100);
    const body = el(
      'div.loan-screen',
      el(
        'div.loan-head',
        el('span.loan-avatar', sprite('farmer', 'sprite--hero')),
        el(
          'div.loan-speech',
          el('div.tuto-name', 'Joseph, votre voisin'),
          el('p.loan-quote', `« Il vous manquait ${plural(ev.missing, 'pièce')} pour le fermage ${season(ev.seasonId, 'of')} ? Pas de souci, entre voisins on s'entraide ! »`),
        ),
      ),
      el(
        'div.loan-facts',
        el('div.sum-line', el('span', 'Joseph vous avance'), el('b.pos', `${plural(ev.amount, 'pièce')}`)),
        cushion > 0 ? el('p.loan-small', `(${fmt(ev.missing)} pour le fermage + ${fmt(cushion)} pour ressemer)`) : null,
        el('div.sum-line.loan-owe', el('span', `Vous lui devez (+${pct} %)`), el('b.warn', `${plural(ev.debt, 'pièce')}`)),
      ),
      el(
        'ul.loan-list',
        el('li', icon('coin', 'sm'), el('span', `${share} de chacune de vos ventes lui revient automatiquement, jusqu'au remboursement.`)),
        el('li', icon('bill', 'sm'), el('span', 'Vous pouvez le rembourser plus tôt dans le Bilan.')),
        el('li', icon('info', 'sm'), el('span', 'Tant que vous lui devez de l\'argent, il ne pourra pas vous aider une deuxième fois.')),
      ),
    );
    const node = frame({
      title: 'Joseph vous dépanne',
      ribbon: 'ribbon',
      cls: 'dialog--loan',
      body,
      actions: [btn(['Merci Joseph !'], () => closeTop(), 'btn--red', { 'data-autofocus': '', id: 'loan-ok' })],
    });
    const handle = open(node, { id: 'neighbour-loan', pauses: true, onClose, sound: false });
    app.audio.play('unlock', { volume: 0.55, pitch: 0 });
    return handle;
  }

  /** Premier lancement après l'arrivée des modes : message court (une seule fois). */
  function detenteNotice({ savedClassique = false } = {}) {
    const body = el(
      'div.notice',
      el(
        'div.loan-head',
        el('span.loan-avatar', sprite('farmer', 'sprite--hero')),
        el(
          'div.loan-speech',
          el('div.tuto-name', 'Joseph, votre voisin'),
          el('p.loan-quote', '« Bonne nouvelle : le jeu est plus doux maintenant ! »'),
        ),
      ),
      el(
        'ul.loan-list',
        el('li', icon('star', 'sm'), el('span', 'Nouveau mode Détente (par défaut) : charges et fermages plus doux, les cultures poussent même sans arrosage.')),
        el('li', sprite('farmer', 'sprite--xs'), el('span', 'Un soir de fermage difficile ? Joseph vous avance l\'argent.')),
        el('li', icon('bill', 'sm'), el('span', 'Envie de défi ? Le mode Classique garde l\'équilibre d\'origine (Nouvelle partie).')),
        savedClassique ? el('li', icon('calendar', 'sm'), el('span', 'Votre partie en cours continue en mode Classique.')) : null,
      ),
    );
    const node = frame({
      title: 'Le jeu est plus doux',
      ribbon: 'ribbon',
      cls: 'dialog--notice',
      body,
      actions: [btn('Super !', () => closeTop(), 'btn--red', { 'data-autofocus': '', id: 'notice-ok' })],
      onClose: () => closeTop(),
    });
    return open(node, { id: 'notice' });
  }

  // ── Faillite ──────────────────────────────────────────────────────────────────
  function bankrupt(ev, record = null) {
    const s = ev.summary;
    const lvl = app.game.query.level();
    const missing = ev.amountDue - ev.money;
    const nl = app.game.query.finance().neighbourLoan;
    // Mode détente : pourquoi Joseph n'a pas pu aider.
    let why = null;
    if (nl) {
      if ((ev.neighbourDebt || 0) > 0) why = `Vous deviez encore ${plural(ev.neighbourDebt, 'pièce')} à Joseph : il ne pouvait plus vous aider.`;
      else why = `Il manquait trop : Joseph avance au plus ${plural(nl.maxMissing, 'pièce')} pour ce fermage.`;
    }
    let tip;
    if ((ev.neighbourDebt || 0) > 0) tip = 'La prochaine fois, remboursez Joseph dès que possible (Bilan) : une fois la dette réglée, il peut de nouveau vous dépanner.';
    else if (!s.investmentsSpent) tip = 'Les investissements (poulailler, ruche…) rapportent chaque matin, même quand rien ne pousse.';
    else if (ev.seasonId === 'winter') tip = 'L\'hiver rapporte peu : gardez des réserves en automne et plantez navets et choux.';
    else if (s.cropsLost?.frost) tip = 'Récoltez avant l\'hiver : le gel détruit les cultures fragiles.';
    else tip = 'Surveillez la prévision du fermage en haut de l\'écran : elle vire au rouge quand le compte n\'y est pas.';
    const body = el(
      'div.end-screen',
      el('div.end-illus', sprite('farmer', 'sprite--hero'), sprite('crate.empty', 'sprite--hero')),
      el('p.end-lead', ev.money < 0
        ? `Le fermage ${season(ev.seasonId, 'of')} s'élevait à ${plural(ev.amountDue, 'pièce')}, mais vous étiez à découvert (${fmt(ev.money)}).`
        : `Le fermage ${season(ev.seasonId, 'of')} s'élevait à ${plural(ev.amountDue, 'pièce')}, mais vous n'en aviez que ${fmt(ev.money)}.`),
      el('p.end-missing', `Il manquait ${plural(missing, 'pièce')}.`),
      why ? el('p.end-why', sprite('farmer', 'sprite--xs'), why) : null,
      el('div.end-sum', el('h3.sum-title', 'Votre année'), summaryLines(s), harvestChips(s.cropsHarvested, s.productsSold), app.variety?.seasonSummary?.(ev) || null),
      el('p.end-tip', icon('info', 'sm'), tip),
      rewardsBlock(record),
    );
    const finalActions = () => [
      btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'bankrupt-menu' }),
      btn('Réessayer', () => app.startLevel(lvl.id, { skipConfirm: true }), 'btn--red', { id: 'bankrupt-retry', 'data-autofocus': '' }),
    ];
    // (Lot 4) Détente : « Les lanternes de l'année » après le bilan, avec « L'an prochain, ça ira mieux ».
    const lp = app.cozy?.lanternPage?.({ bankrupt: true });
    const showLanterns = () => {
      open(frame({ title: lp.title, ribbon: 'ribbon', cls: 'dialog--victory.dialog--lanterns', body: lp.body(), actions: finalActions() }), { id: 'bankrupt', closable: false, replace: true, sound: false });
      lp.onShow?.();
    };
    const node = frame({
      title: 'Faillite…',
      ribbon: 'dark',
      cls: 'dialog--bankrupt',
      body,
      actions: lp ? [btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'bankrupt-menu' }), btn(['Les lanternes', icon('play', 'sm')], () => showLanterns(), 'btn--red', { id: 'bankrupt-lanterns', 'data-autofocus': '' })] : finalActions(),
    });
    return open(node, { id: 'bankrupt', closable: false, sound: false });
  }

  /** Fin d'année (détente) : ce que Joseph a prêté, ce qui lui a été rendu, ce qu'il a effacé. */
  function loanBlock(loan) {
    if (!loan || !loan.borrowed) return null;
    return el(
      'div.end-loan',
      el('span.loan-avatar', sprite('farmer', 'sprite--md')),
      el(
        'div',
        el('b', 'Joseph, votre voisin'),
        el('div.sum-line', el('span', `Prêté (${plural(loan.loans, 'fois', 'fois')})`), el('b', fmt(loan.borrowed))),
        el('div.sum-line', el('span', 'Rendu'), el('b.pos', fmt(loan.repaid))),
        loan.forgiven ? el('div.sum-line', el('span', 'Effacé par Joseph'), el('b', fmt(loan.forgiven))) : null,
        el('p.loan-small', loan.forgiven ? '« Gardez le reste, c\'est cadeau. À l\'année prochaine ! »' : '« Tout est réglé, merci voisin ! »'),
      ),
    );
  }

  // ── Victoire ──────────────────────────────────────────────────────────────────
  function victory(ev, record = {}) {
    const s = ev.summary;
    const lvl = app.game.query.level();
    const [t2, t3] = lvl.starThresholds;
    const next = LEVELS.find((l) => l.id === lvl.id + 1);
    const starNodes = [0, 1, 2].map(() => el('span.big-star', icon('star-empty', 'xl'), el('span.big-star-on', icon('star', 'xl'))));
    const farm = app.progression?.available() ? app.progression.farmName() : null;
    const body = el(
      'div.end-screen.is-victory',
      farm ? el('p.end-farm', `${farm} · Niveau ${lvl.id}`) : null,
      el('div.victory-stars', starNodes),
      el('p.end-lead', `Vous avez tenu toute l'année ! Il vous reste ${plural(ev.money, 'pièce')}.`),
      record.newBest && !record.firstTime ? el('p.end-record', icon('star', 'sm'), 'Nouveau record !') : null,
      el('p.end-thresholds', `2 étoiles dès ${fmt(t2)} pièces · 3 étoiles dès ${fmt(t3)} pièces`),
      next && record.firstTime ? el('p.end-unlock', icon('lock', 'sm'), `Nouveau niveau débloqué : « ${next.name} »`) : null,
      loanBlock(s.neighbourLoan),
      rewardsBlock(record),
      el('div.end-sum', el('h3.sum-title', 'Votre année'), summaryLines(s), harvestChips(s.cropsHarvested, s.productsSold)),
    );
    const finalActions = () => {
      const list = [btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'victory-menu' }), btn('Rejouer', () => app.startLevel(lvl.id, { skipConfirm: true }), '', { id: 'victory-replay' })];
      if (next) list.push(btn('Niveau suivant', () => app.startLevel(next.id, { skipConfirm: true }), 'btn--red', { id: 'victory-next', 'data-autofocus': '' }));
      return list;
    };
    // (Lot 4) Détente : page « Les lanternes de l'année » après le bilan (les lanternes s'allument une à une).
    const lp = app.cozy?.lanternPage?.();
    const showLanterns = () => {
      open(frame({ title: lp.title, ribbon: 'ribbon', cls: 'dialog--victory.dialog--lanterns', body: lp.body(), actions: finalActions() }), { id: 'victory', closable: false, replace: true, sound: false });
      lp.onShow?.();
    };
    const actions = lp ? [btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'victory-menu' }), btn(['Les lanternes', icon('play', 'sm')], () => showLanterns(), 'btn--red', { id: 'victory-lanterns', 'data-autofocus': '' })] : finalActions();
    const node = frame({ title: 'Année réussie !', ribbon: 'ribbon', cls: 'dialog--victory', body, actions });
    const handle = open(node, { id: 'victory', closable: false, sound: false });
    // Étoiles une à une
    const reduce = document.documentElement.classList.contains('reduced-motion');
    starNodes.forEach((n, i) => {
      if (i >= ev.stars) return;
      setTimeout(() => {
        if (!n.isConnected) return; // fenêtre déjà quittée (niveau suivant) : pas de son dans la partie
        n.classList.add('is-on');
        app.audio.play(i === 2 ? 'unlock' : 'confirm', { pitch: 0, rate: 1 + i * 0.12 });
      }, reduce ? 0 : 700 + i * 550);
    });
    return handle;
  }

  // ── Concours du village : remise des prix ─────────────────────────────────────
  /** @param ev contestAwarded ({ amount, goalsMet, goals }) ; `onClose` : suite (bilan de saison). */
  function contestResult(ev, { onClose } = {}) {
    const goals = ev.goals || [];
    const met = new Set(ev.goalsMet || []);
    const all = goals.length > 0 && met.size === goals.length;
    const body = el(
      'div.end-screen.contest-result',
      el('div.end-illus', spriteAny(['icon.trophy.gold', 'icon.medal'], 'sprite--hero', 'star')),
      el('p.end-lead', ev.amount > 0 ? 'Le jury a fait le tour des fermes. Voici vos prix :' : 'Le jury a fait le tour des fermes… pas de prix cette fois.'),
      el(
        'div.contest-list',
        goals.map((g) =>
          el(
            `div.contest-line${met.has(g.id) ? '.is-done' : '.is-missed'}`,
            el('span.contest-mark', met.has(g.id) ? '✓' : '✗'),
            el('span.contest-name', g.label),
            el('span.contest-count', `${fmt(Math.min(g.progress ?? 0, g.target))} / ${fmt(g.target)}`),
          ),
        ),
      ),
      all ? el('p.end-record', icon('star', 'sm'), 'Les trois épreuves : prix spécial du jury !') : null,
      // (Lot 4) Le stand de la fête des récoltes, présenté de nouveau au comice (ruban bleu ou rosette d'or).
      ev.standBonus ? el('p.end-record.cz-stand-bonus', spriteAny([ev.ribbon ? `ribbon.${ev.ribbon}` : 'ribbon.blue'], 'sprite--sm', 'star'), `Stand du comice : +${fmt(ev.standBonus)}`) : null,
      el('p.contest-total', ev.amount > 0 ? `Prix : +${plural(ev.amount, 'pièce')}` : 'Prix : 0'),
    );
    const node = frame({
      title: ev.career ? 'Comice agricole' : 'Concours du village',
      ribbon: 'ribbon',
      cls: 'dialog--contest',
      body,
      actions: [btn(['Continuer', icon('play', 'sm')], () => closeTop(), 'btn--red', { 'data-autofocus': '', id: 'contest-continue' })],
    });
    const handle = open(node, { id: 'contest', pauses: true, onClose, sound: false });
    app.audio.play(ev.amount > 0 ? 'victory' : 'seasonEnd', { pitch: 0, volume: 0.8 });
    return handle;
  }

  // ── Confirmation ──────────────────────────────────────────────────────────────
  function confirm({ title, text, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
    return new Promise((resolve) => {
      let answered = false;
      let handle = null;
      const answer = (v) => {
        if (answered) return;
        answered = true;
        handle.close(v ? 'silent' : 'close');
        resolve(v);
      };
      const node = frame({
        title,
        cls: 'dialog--confirm',
        body: el('p.confirm-text', text),
        actions: [
          btn(cancel, () => answer(false), '', { 'data-autofocus': '' }),
          btn(ok, () => answer(true), danger ? 'btn--red' : 'btn--red'),
        ],
      });
      handle = open(node, {
        id: 'confirm',
        onClose: () => {
          if (!answered) {
            answered = true;
            resolve(false);
          }
        },
      });
    });
  }

  return {
    open,
    close,
    closeTop,
    closeAll,
    isOpen,
    top,
    mainMenu,
    levelSelect,
    options,
    credits,
    pauseMenu,
    seasonEnd,
    bankrupt,
    victory,
    contestResult,
    neighbourLoan,
    detenteNotice,
    confirm,
    frame,
    btn,
    a11yWelcome,
    yearLength,
  };
}
