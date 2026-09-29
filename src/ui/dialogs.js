// Fenêtres : menu principal, choix du niveau, options, crédits, pause, fin de saison,
// faillite, victoire, confirmations.
//
// createDialogs(layer, app) → { open, close, closeTop, isOpen, top, mainMenu, levelSelect, options,
//                               credits, pauseMenu, seasonEnd, bankrupt, victory, confirm }
// Les fenêtres s'empilent ; seule celle du dessus est active. Échap ferme celle du dessus si elle
// le permet. Le focus clavier reste dans la fenêtre active.

import { SEASONS } from '../data/balance.js';
import { CROPS } from '../data/crops.js';
import { LEVELS, yearLength } from '../data/levels.js';
import { clear, el, fmt, plural, signed } from './dom.js';
import { cropIcon, icon, sprite } from './icons.js';
import { cropCount, season, seasonArrives } from './text.js';

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
    node.classList.add('dialog-wrap');
    if (opts.id) node.dataset.dialog = opts.id;
    layer.append(node);
    stack.push({ node, opts });
    layer.classList.add('is-active');
    layer.classList.toggle('is-menu', !!stack[0]?.opts.menu);
    if (opts.pauses) app.pushPause(opts.id || 'dialog');
    app.tooltip?.hide();
    app.field?.close(false);
    requestAnimationFrame(() => {
      node.classList.add('is-open');
      const target = node.querySelector('[data-autofocus]') || node.querySelector('.dialog-actions .btn:not(.is-disabled), .menu-buttons .btn, button');
      if (target && app.keyboardMode) target.focus({ preventScroll: true });
    });
    app.onDialogChange?.();
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
      const f = top.node.querySelector('.btn, button');
      if (f && app.keyboardMode) f.focus({ preventScroll: true });
    } else {
      layer.classList.remove('is-active', 'is-menu');
    }
    if (entry.opts.pauses) app.popPause(entry.opts.id || 'dialog');
    entry.opts.onClose?.(reason);
    app.onDialogChange?.();
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

  // Piège à focus (Tab reste dans la fenêtre du dessus).
  layer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !stack.length) return;
    const node = stack[stack.length - 1].node;
    const items = [...node.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
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
    const box = el(
      `div.dialog${o.cls ? `.${o.cls}` : ''}`,
      { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      o.title ? el(`div.dialog-ribbon${o.ribbon ? `.ribbon--${o.ribbon}` : ''}`, el('h2.dialog-title', { id: titleId }, o.title)) : null,
      o.onClose ? el('button.dialog-x', { type: 'button', 'aria-label': 'Fermer', onclick: o.onClose }, icon('close', 'sm')) : null,
      el('div.dialog-body', o.body),
      o.actions ? el('div.dialog-actions', o.actions) : null,
    );
    return el('div', box);
  }

  function btn(label, onclick, cls = '', extra = {}) {
    return el(`button.btn${cls ? `.${cls}` : ''}`, { type: 'button', onclick: (e) => { app.audio.play('click'); onclick(e); }, ...extra }, label);
  }

  // ── Menu principal ────────────────────────────────────────────────────────────
  function mainMenu() {
    closeAll();
    const saved = app.savedRunInfo();
    const buttons = [];
    if (saved) {
      buttons.push(
        btn(
          [el('span.btn-main', 'Continuer'), el('span.btn-sub', saved.label)],
          () => app.continueRun(),
          'btn--red.btn--big',
          { id: 'menu-continue', 'data-autofocus': '' },
        ),
      );
    }
    buttons.push(btn('Nouvelle partie', () => levelSelect(), saved ? 'btn--big' : 'btn--red.btn--big', { id: 'menu-new', ...(saved ? {} : { 'data-autofocus': '' }) }));
    buttons.push(btn('Options', () => options(), 'btn--big', { id: 'menu-options' }));
    buttons.push(btn('Crédits', () => credits(), 'btn--big', { id: 'menu-credits' }));

    const deco = el('div.menu-deco', ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower'].map((id) => cropIcon(id, 'sprite--deco')));
    const node = el(
      'div',
      el(
        'div.menu-screen',
        el('div.logo', el('div.logo-ribbon', el('h1.logo-title', 'Une année à la ferme')), el('p.logo-sub', 'Un an pour faire prospérer votre ferme, sans faire faillite')),
        el('div.menu-card', deco, el('div.menu-buttons', buttons)),
        el('p.menu-keys', 'Espace : pause · 1, 2, 3 : vitesses · Échap : menu'),
      ),
    );
    return open(node, { id: 'main-menu', closable: false, menu: true, sound: false });
  }

  // ── Choix du niveau ───────────────────────────────────────────────────────────
  function levelSelect() {
    const progress = app.progress();
    const cards = LEVELS.map((lvl) => {
      const p = progress.levels[lvl.id] || {};
      const unlocked = app.isLevelUnlocked(lvl.id);
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
        el('div.level-head', el('span.level-num', String(lvl.id)), el('span.level-name', lvl.name)),
        el('p.level-desc', lvl.description),
        el(
          'div.level-meta',
          el('span', icon('coin', 'xs'), `Départ ${fmt(lvl.startMoney)}`),
          el('span', icon('seed', 'xs'), `${lvl.unlockedPlots}${lvl.maxPlots > lvl.unlockedPlots ? `/${lvl.maxPlots}` : ''} parcelles`),
          el('span', icon('bill', 'xs'), `Hiver ${fmt(lvl.rents[3])}`),
        ),
        el(
          'div.level-foot',
          el('span.level-stars', [0, 1, 2].map((i) => icon(i < stars ? 'star' : 'star-empty', 'sm'))),
          unlocked ? el('span.level-best', p.bestMoney != null ? `Record : ${fmt(p.bestMoney)}` : lvl.id === 1 ? 'Avec tutoriel' : 'Nouveau !') : el('span.level-lock', icon('lock', 'sm'), `Finir le niveau ${lvl.id - 1}`),
        ),
      );
      return card;
    });
    const node = frame({
      title: 'Choisir une année',
      ribbon: 'ribbon',
      cls: 'dialog--levels',
      body: el('div.level-grid', cards),
      actions: [btn('Retour', () => closeTop(), '', { 'data-autofocus': '' })],
      onClose: () => closeTop(),
    });
    return open(node, { id: 'levels' });
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
        value.textContent = `${input.value} %`;
        app.updateSettings({ [key]: Number(input.value) / 100 });
      });
      input.addEventListener('change', () => {
        if (key === 'sfxVolume') app.audio.play('coin');
      });
      return el('label.opt-row', el('span.opt-label', label), input, value);
    };
    const toggle = (key, label, onChange, get = () => !!app.settings[key]) => {
      const box = el('span.checkbox');
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
        box,
        el('span.opt-label', label),
      );
      const sync = () => {
        const on = get();
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      };
      sync();
      return b;
    };
    const body = el(
      'div.options',
      el('h3.opt-section', 'Volumes'),
      slider('musicVolume', 'Musique'),
      slider('sfxVolume', 'Sons'),
      slider('ambienceVolume', 'Ambiance'),
      toggle('muted', 'Couper tout le son', (v) => app.updateSettings({ muted: v })),
      el('h3.opt-section', 'Affichage'),
      toggle('reducedMotion', 'Réduire les animations', (v) => app.updateSettings({ reducedMotion: v })),
      document.fullscreenEnabled ? toggle('fullscreen', 'Plein écran', () => app.toggleFullscreen(), () => !!document.fullscreenElement) : null,
      el('h3.opt-section', 'Progression'),
      el(
        'div.opt-danger',
        el('p', 'Efface les étoiles, les niveaux débloqués, le tutoriel et la partie en cours.'),
        btn('Réinitialiser la progression', async () => {
          const ok = await confirm({
            title: 'Tout effacer ?',
            text: 'Les étoiles, les niveaux débloqués et la partie en cours seront perdus. Cette action est définitive.',
            ok: 'Tout effacer',
            danger: true,
          });
          if (ok) {
            app.resetProgress();
            app.toasts.show({ kind: 'success', text: 'Progression réinitialisée.' });
          }
        }, 'btn--small', { id: 'opt-reset' }),
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
          ].map(([who, what], i, arr) => [el('strong', who), ` (${what})`, i < arr.length - 1 ? ', ' : '.']),
        ),
      ),
      el(
        'section.credit-block',
        el('h3', icon('info', 'sm'), 'Police'),
        el('p', el('strong', 'Pixelify Sans'), ' — Stefie Justprince, SIL Open Font License 1.1 (', link('https://github.com/eifetx/Pixelify-Sans', 'github.com/eifetx/Pixelify-Sans'), ').'),
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
    const c = g.query.calendar();
    const lvl = g.query.level();
    const body = el(
      'div.pause',
      el('p.pause-info', `Niveau ${lvl.id} · ${lvl.name}`),
      el('p.pause-sub', icon(c.seasonId, 'sm'), `Jour ${c.day} · ${c.seasonName}`, el('span.pause-money', icon('coin', 'sm'), fmt(g.state.money))),
      el(
        'div.menu-buttons',
        btn('Reprendre', () => closeTop(), 'btn--red.btn--big', { id: 'pause-resume', 'data-autofocus': '' }),
        btn('Options', () => options(), 'btn--big', { id: 'pause-options' }),
        btn('Recommencer l\'année', async () => {
          const ok = await confirm({ title: 'Recommencer ?', text: 'La partie en cours sera perdue et l\'année recommencera au premier jour du printemps.', ok: 'Recommencer', danger: true });
          if (ok) app.restartLevel();
        }, 'btn--big', { id: 'pause-restart' }),
        btn('Quitter vers le menu', () => app.quitToMenu(), 'btn--big', { id: 'pause-quit' }),
      ),
      el('p.pause-hint', 'La partie est sauvegardée automatiquement chaque matin.'),
    );
    const node = frame({ title: 'Pause', ribbon: 'ribbon', cls: 'dialog--pause', body, onClose: () => closeTop() });
    return open(node, { id: 'pause', pauses: true });
  }

  // ── Bilan chiffré ─────────────────────────────────────────────────────────────
  function moneyLine(label, value, cls = '') {
    return el('div.sum-line', el('span', label), el(`b${cls ? `.${cls}` : ''}`, value));
  }

  function summaryLines(s, { rent = null } = {}) {
    const lines = [
      moneyLine(`Récoltes vendues${s.totalHarvested ? ` (${s.totalHarvested})` : ''}`, `+${fmt(s.harvestIncome)}`, 'pos'),
      moneyLine('Revenus des investissements', `+${fmt(s.investmentIncome)}`, 'pos'),
      moneyLine('Charges quotidiennes', `−${fmt(s.charges)}`, 'neg'),
    ];
    if (s.waterSpent) lines.push(moneyLine('Arrosage', `−${fmt(s.waterSpent)}`, 'neg'));
    if (s.loanPaid) lines.push(moneyLine('Prêt', `−${fmt(s.loanPaid)}`, 'neg'));
    const spent = s.seedsSpent + s.plotsSpent;
    if (spent) lines.push(moneyLine('Graines et parcelles', `−${fmt(spent)}`, 'neg'));
    if (s.investmentsSpent) lines.push(moneyLine('Investissements achetés', `−${fmt(s.investmentsSpent)}`, 'neg'));
    const rentValue = rent ?? s.rentsPaid;
    if (rentValue) lines.push(moneyLine(rent !== null ? 'Fermage' : 'Fermages', `−${fmt(rentValue)}`, 'neg'));
    lines.push(el('div.sum-total', moneyLine('Bilan', signed(s.net), s.net >= 0 ? 'pos' : 'neg')));
    return el('div.sum-lines', lines);
  }

  function harvestChips(cropsHarvested) {
    const list = Object.entries(cropsHarvested || {}).filter(([, n]) => n > 0);
    if (!list.length) return null;
    return el('div.harvest-list', list.map(([id, n]) => el('span.harvest-chip.has-tip', { 'data-tip': cropCount(id, n) }, cropIcon(id, 'sprite--sm'), el('b', `×${n}`))));
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
    const crops = CROPS.filter((c) => (!lvl.crops || lvl.crops.includes(c.id)) && c.seasons.includes(next));
    const lost = extra.frost ? (extra.frost.lost || extra.frost.lostPlots || []).length : 0;

    const nextBlock = el(
      'div.next-season',
      el('h3.sum-title', icon(next, 'sm'), seasonArrives(next)),
      el('div.next-crops', crops.map((c) => el('span.next-crop.has-tip', { 'data-tip': `${c.name} : ${plural(c.growDays, 'jour')}, graine ${c.seedCost}, vente ${c.sellPrice}${c.frostHardy ? ' — résiste au gel' : ''}` }, cropIcon(c.id, 'sprite--sm'), el('span', c.name)))),
      el('p.next-rent', icon('bill', 'xs'), `Fermage ${season(next, 'of')} : `, el('b', fmt(lvl.rents[sIdx + 1])), ` dans ${plural(lvl.seasonLengths[sIdx + 1], 'jour')}.`),
      next === 'winter'
        ? el(
            `p.next-warn${lost ? '.is-danger' : '.is-ok'}`,
            icon('winter', 'sm'),
            lost
              ? `Le gel de la première nuit d'hiver a détruit ${plural(lost, 'culture')}. Seuls le navet et le chou résistent au froid.`
              : 'Aucune culture n\'a gelé cette nuit : bien joué ! En hiver, seuls le navet et le chou se plantent.',
          )
        : null,
      next === 'autumn' ? el('p.next-warn', icon('winter', 'sm'), 'Pensez à l\'hiver : les cultures qui ne résistent pas au gel seront perdues le premier jour d\'hiver.') : null,
    );

    const body = el(
      'div.season-end',
      el('div.rent-paid', icon('coin', 'lg'), el('div', el('div.rent-paid-title', `Fermage payé : ${plural(ev.amount, 'pièce')}`), el('div.rent-paid-sub', `Il vous reste ${plural(g.state.money, 'pièce')}.`))),
      el('div.season-cols', el('div', el('h3.sum-title', icon(ev.seasonId, 'sm'), `Bilan ${season(ev.seasonId, 'of')}`), summaryLines(s.season, { rent: ev.amount }), harvestChips(s.season.cropsHarvested)), nextBlock),
    );
    const node = frame({
      title: season(ev.seasonId, 'end'),
      ribbon: 'ribbon',
      cls: 'dialog--season',
      body,
      actions: [btn([`Continuer`, icon('play', 'sm')], () => closeTop(), 'btn--red', { 'data-autofocus': '', id: 'season-continue' })],
    });
    return open(node, { id: 'season-end', pauses: true, onClose: extra.onClose });
  }

  // ── Faillite ──────────────────────────────────────────────────────────────────
  function bankrupt(ev) {
    const s = ev.summary;
    const lvl = app.game.query.level();
    const missing = ev.amountDue - ev.money;
    let tip;
    if (!s.investmentsSpent) tip = 'Les investissements (poulailler, ruche…) rapportent chaque matin, même quand rien ne pousse.';
    else if (ev.seasonId === 'winter') tip = 'L\'hiver rapporte peu : gardez des réserves en automne et plantez navets et choux.';
    else if (s.cropsLost?.frost) tip = 'Récoltez avant l\'hiver : le gel détruit les cultures fragiles.';
    else tip = 'Surveillez la prévision du fermage en haut de l\'écran : elle vire au rouge quand le compte n\'y est pas.';
    const body = el(
      'div.end-screen',
      el('div.end-illus', sprite('farmer', 'sprite--hero'), sprite('crate.empty', 'sprite--hero')),
      el('p.end-lead', `Le fermage ${season(ev.seasonId, 'of')} s'élevait à ${plural(ev.amountDue, 'pièce')}, mais vous n'en aviez que ${fmt(ev.money)}.`),
      el('p.end-missing', `Il manquait ${plural(missing, 'pièce')}.`),
      el('div.end-sum', el('h3.sum-title', 'Votre année'), summaryLines(s), harvestChips(s.cropsHarvested)),
      el('p.end-tip', icon('info', 'sm'), tip),
    );
    const node = frame({
      title: 'Faillite…',
      ribbon: 'dark',
      cls: 'dialog--bankrupt',
      body,
      actions: [
        btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'bankrupt-menu' }),
        btn('Réessayer', () => app.startLevel(lvl.id, { skipConfirm: true }), 'btn--red', { id: 'bankrupt-retry', 'data-autofocus': '' }),
      ],
    });
    return open(node, { id: 'bankrupt', closable: false, sound: false });
  }

  // ── Victoire ──────────────────────────────────────────────────────────────────
  function victory(ev, record = {}) {
    const s = ev.summary;
    const lvl = app.game.query.level();
    const [t2, t3] = lvl.starThresholds;
    const next = LEVELS.find((l) => l.id === lvl.id + 1);
    const starNodes = [0, 1, 2].map(() => el('span.big-star', icon('star-empty', 'xl'), el('span.big-star-on', icon('star', 'xl'))));
    const body = el(
      'div.end-screen.is-victory',
      el('div.victory-stars', starNodes),
      el('p.end-lead', `Vous avez tenu toute l'année ! Il vous reste ${plural(ev.money, 'pièce')}.`),
      record.newBest && !record.firstTime ? el('p.end-record', icon('star', 'sm'), 'Nouveau record !') : null,
      el('p.end-thresholds', `2 étoiles dès ${fmt(t2)} pièces · 3 étoiles dès ${fmt(t3)} pièces`),
      el('div.end-sum', el('h3.sum-title', 'Votre année'), summaryLines(s), harvestChips(s.cropsHarvested)),
      next && record.firstTime ? el('p.end-unlock', icon('lock', 'sm'), `Nouveau niveau débloqué : « ${next.name} »`) : null,
    );
    const actions = [btn('Menu', () => app.quitToMenu({ ended: true }), '', { id: 'victory-menu' }), btn('Rejouer', () => app.startLevel(lvl.id, { skipConfirm: true }), '', { id: 'victory-replay' })];
    if (next) actions.push(btn('Niveau suivant', () => app.startLevel(next.id, { skipConfirm: true }), 'btn--red', { id: 'victory-next', 'data-autofocus': '' }));
    const node = frame({ title: 'Année réussie !', ribbon: 'ribbon', cls: 'dialog--victory', body, actions });
    const handle = open(node, { id: 'victory', closable: false, sound: false });
    // Étoiles une à une
    const reduce = document.documentElement.classList.contains('reduced-motion');
    starNodes.forEach((n, i) => {
      if (i >= ev.stars) return;
      setTimeout(() => {
        n.classList.add('is-on');
        app.audio.play(i === 2 ? 'unlock' : 'confirm', { pitch: 0, rate: 1 + i * 0.12 });
      }, reduce ? 0 : 700 + i * 550);
    });
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
    confirm,
    yearLength,
  };
}
