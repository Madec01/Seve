// Interface du lot 4 « Collection & enjeux doux » (docs/GAME_DESIGN.md § 17, contrats : docs/ARCHITECTURE.md
// « Lot 4 ») : fêtes participatives (C6) et leurs mini-jeux au doigt, mode fête de la chasse, hiver vivant (C8 :
// trouvailles en lisière, mangeoire, veillées de Joseph, foire aux graines), lanternes de fin d'année (D3), « aider
// sans remplacer » en carrière (F1 : prime à la main, « vous attend », réserve de graines).
//
// createCozy(app) → app.cozy = {
//   onEvent(ev, game)      main.js (onGameEvent) : messages, sons, récompenses (écus, lanternes, histoires)
//                          (les conseils « première fois » sont des leçons de Joseph : src/ui/coach/lessons/lots.js)
//   frame()                à chaque image : feuille ouverte « vivante », barre du mode fête
//   reset(game|null)       nouvelle partie / retour au menu (quitte le mode fête, porte-lanternes du niveau)
//   openFete(), enterFeteMode(), leaveFeteMode(), openWinter(), openStory(), openLanterns(), openSeedFair()
//   lanternPage(ev?)       { title, body(), actions? } : page « Les lanternes de l'année » (victoire, faillite) ou null
//   yearBlock(report)      carrière : lanternes de l'année dans la fenêtre du bilan annuel
//   todoItems(game)        lignes de « À faire maintenant » (src/ui/todo.js) ; { replaces: 'harvest' } pour F1
//   morningLines(ev)       lignes du résumé du matin (appelé par onEvent, via app.todo.morningNote)
//   plotRows(plot)         fiche d'une parcelle (carrière, F1) : « À la main : 31 · par l'équipe : 25 »…
//   seedChips(crop)        feuille des graines : « Réserve : 16 »
//   statsSection(game)     niveaux : section « Fêtes et lanternes » du Bilan (src/ui/panel.js)
//   agendaSections(ui)     carrière : fêtes, hiver, réserve (Carnet › Agenda)
//   lanternSection(ui)     carrière : « Les lanternes » (Carnet › Bilan)
//   levelBadge(levelId)    choix du niveau : « 🏮 13 / 20 » (meilleur total)
//   onHit(hit) → bool      toucher dans la scène : feteItem | winterFind | feeder | storyWindow | lanternRack | feteStall
//   enabled(game)          le lot est-il actif ? (jamais en Classique : clé state.cozy absente)
//   feteMode               mode fête en cours ?
// }
//
// Règles (§ 17.0) : aucun stress (pas de chrono, aucun échec, rien qui se rate), feuilles du bas (le temps s'arrête
// pendant la lecture, src/ui/sheets.js ; toujours pendant la chasse), cibles ≥ 48 px, textes ≥ 14 px, peu de texte,
// lecteurs d'écran (libellés, aria-pressed, régions vivantes), mouvements réduits. Rien de `state.cozy` en Classique.
// Les requêtes et actions viennent du cœur (CORE) ; tout est protégé : une requête absente → rien d'affiché.

import { el, fmt, plural } from './dom.js';
import { icon, spriteAny, hasSprite, sprite, cropIcon, productIcon } from './icons.js';
import { cropName, season } from './text.js';
import { SIGNALS } from './coach/signals.js';
import { v3 } from './v3.js';

/** Données du lot (noms des oiseaux, trouvailles, histoires), chargées sans casser le jeu si elles manquent. */
const DATA = { cozy: null, album: null };
async function loadData() {
  try {
    DATA.cozy = await import('../data/cozy.js');
  } catch {
    /* données du lot 4 absentes : textes par défaut */
  }
  try {
    DATA.album = await import('../data/album.js');
  } catch {
    /* album absent */
  }
}

const CRITERIA = [
  { id: 'variety', name: 'Variété', emoji: '🌿' },
  { id: 'care', name: 'Soin', emoji: '💧' },
  { id: 'neighbours', name: 'Voisinage', emoji: '🏡' },
  { id: 'beauty', name: 'Beauté', emoji: '🌼' },
  { id: 'prosperity', name: 'Prospérité', emoji: '🪙' },
];
const RIBBON_NAMES = { green: 'Ruban vert', blue: 'Ruban bleu', gold: 'Rosette d\'or' };
const RIBBON_SUB = { green: 'Coup de cœur des enfants', blue: 'Bel étal', gold: 'Grand prix du jury' };
const HIDDEN = {
  egg: { name: 'œufs', one: 'œuf', emoji: '🥚', verb: 'Chercher les œufs', found: 'trouvé', foundPl: 'trouvés' },
  lampion: { name: 'lampions', one: 'lampion', emoji: '🏮', verb: 'Allumer les lampions', found: 'allumé', foundPl: 'allumés' },
  frog: { name: 'grenouilles', one: 'grenouille', emoji: '🐸', verb: 'Chercher les grenouilles', found: 'trouvée', foundPl: 'trouvées' },
  lantern: { name: 'lanternes', one: 'lanterne', emoji: '🕯', verb: 'Allumer les lanternes', found: 'allumée', foundPl: 'allumées' },
};
const ENGINE_EMOJI = { chasse: '🥚', marmite: '🍲', etal: '🧺', paniers: '🎁', foire: '🌱' };
const FIND_EMOJI = { deadwood: '🪵', pinecone: '🌰', holly: '🌿', chestnut: '🌰', blewit: '🍄', mistletoe: '🌿' };

const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** Sprite de l'atlas, sinon un petit dessin de remplacement (emoji décoratif, caché aux lecteurs d'écran). */
export function czIcon(names, cls = 'sprite--md', emoji = '•') {
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  for (const n of list) if (hasSprite(n)) return sprite(n, cls);
  const size = /--(xs)\b/.test(cls) ? 'xs' : /--(sm)\b/.test(cls) ? 'sm' : /--(lg|hero|card|deco|big)\b/.test(cls) ? 'lg' : 'md';
  return el(`span.cz-emoji.is-${size}`, { 'aria-hidden': 'true' }, emoji);
}

/** Icône d'un produit de la ferme (itemInfo : culture, produit transformé, produit animal). */
function itemIcon(it, cls = 'sprite--md') {
  if (!it) return czIcon([], cls, '•');
  if (it.icon && hasSprite(it.icon)) return sprite(it.icon, cls);
  if (it.kind === 'crop') return cropIcon(it.id, cls);
  if (it.kind === 'product') return productIcon(it.id, cls);
  return spriteAny([`product.${it.id}`, it.id === 'milk' ? 'milk.bottle' : null, it.id === 'eggs' ? 'egg' : null].filter(Boolean), cls, 'harvest');
}

/** Lanternes d'un critère : n allumées sur 4 (dessin + texte lu ; jamais la couleur seule). */
export function lanternDots(lit, critId = null, { small = false, animate = false } = {}) {
  const n = Math.max(0, Math.min(4, lit | 0));
  return el(
    `span.cz-lanterns${small ? '.is-small' : ''}`,
    { role: 'img', 'aria-label': `${plural(n, 'lanterne')} sur 4` },
    [0, 1, 2, 3].map((i) => {
      const on = i < n;
      const node = el(`span.cz-lantern${on ? '.is-on' : ''}${critId ? `.is-${critId}` : ''}`, { 'aria-hidden': 'true' });
      const spr = czIcon(on ? [`lantern.${critId}.on`, 'icon.lantern.on'] : [`lantern.${critId}.off`, 'icon.lantern.off'], small ? 'sprite--xs' : 'sprite--sm', on ? '🏮' : '○');
      node.append(spr);
      if (animate && on) node.style.setProperty('--cz-delay', `${i}`);
      return node;
    }),
  );
}

export function createCozy(app) {
  loadData();

  let game = null;
  let live = null; // { id, build, sig, lastSig }
  let queued = false;
  let feteMode = false;
  let bar = null;
  let barCount = null;
  let lanternsEv = null; // dernier lanternsLit { ev, rec, at, game }
  let storyShown = null; // histoire racontée cet hiver (affichée de nouveau)
  let feteToast = null; // annonce de la fête du jour (retirée quand on y entre)
  const sel = { feteId: null, soup: [], stand: [], baskets: [[], [], []], basket: 0 };
  const hand = { n: 0, bonus: 0, day: '' };
  let badgeAt = 0;

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.state && g.state.cozy);
  const isCareer = (g = app.game) => g?.mode === 'career';
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Lot 4 :', err);
      return fallback;
    }
  }
  /** Requête du lot (cozy, fete, winter, lanterns, fetePreview) ; null hors lot. */
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  const dayKey = (g = app.game) => {
    const t = g?.state?.time || {};
    return `${t.year || 0}|${t.seasonIndex ?? 0}|${t.day ?? 0}`;
  };
  function refused(text) {
    app.audio.play('error');
    app.vibrate?.([30, 40, 30]);
    app.toasts.show({ kind: 'error', text, log: false });
  }
  /** Action du cœur : message (sans historique) si refusée ; renvoie le résultat. */
  function act(name, ...args) {
    const g = app.game;
    const fn = g?.actions?.[name];
    if (typeof fn !== 'function') {
      refused('Bientôt disponible.');
      return null;
    }
    let res;
    try {
      res = fn(...args);
    } catch (err) {
      console.warn(`actions.${name} :`, err);
      res = { ok: false, reason: 'Impossible pour l\'instant.' };
    }
    if (res && res.ok === false) refused(res.reason || 'Impossible pour l\'instant.');
    schedule();
    return res;
  }
  function grantEcus(n) {
    const v = Math.floor(n || 0);
    if (v > 0) app.progression?.careerEcus?.(v);
    return v;
  }
  const morning = (text) => text && app.todo?.morningNote?.(text);
  const tone = (name, opts) => app.audio.tone?.(name, opts);
  const reduced = () => !!app.reducedMotion?.();

  // ── Feuilles « vivantes » ──────────────────────────────────────────────────────
  function openLive(id, { title, icon: ico, build, sig, tall = true, pauses }) {
    const node = safe(build, null) || el('p.sheet-empty', 'Rien pour l\'instant.');
    app.sheets.open({ id, kind: 'popup', tall, title, icon: ico, content: node, className: `cz-sheet cz-sheet--${id}`, pauses, onClose: () => { if (live?.id === id) live = null; } });
    live = { id, build, sig, lastSig: safe(sig, '') };
    return true;
  }
  function schedule() {
    if (queued || !live) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!live || app.sheets.current !== live.id) return;
      const s = safe(live.sig, '');
      if (s === live.lastSig) return;
      live.lastSig = s;
      const node = safe(live.build, null);
      if (node) app.sheets.setContent(node, true);
    });
  }
  /** Reconstruit tout de suite la feuille ouverte (choix locaux : légumes, cagettes, paniers). */
  function repaint() {
    if (!live || app.sheets.current !== live.id) return;
    live.lastSig = safe(live.sig, '');
    const node = safe(live.build, null);
    if (node) app.sheets.setContent(node, true);
  }

  // ── Petits dessins ─────────────────────────────────────────────────────────────
  const feteIcon = (f, cls = 'sprite--md') => czIcon([f?.icon, f?.themeId ? `icon.theme.${f.themeId}` : null, 'icon.fete'], cls, ENGINE_EMOJI[f?.engine] || '🎉');
  const portraitOf = (name, cls = 'sprite--portrait') => spriteAny([name, 'portrait.joseph'].filter(Boolean), cls, 'star');
  const ecuLine = (n) => (n ? el('span.cz-ecus', spriteAny(['icon.ecu'], 'sprite--xs', 'coin'), `+${plural(n, 'écu')}`) : null);
  const coinLine = (n) => el('span.cz-coins', icon('coin', 'sm'), `+${fmt(n || 0)}`);

  function qualityBadges(it) {
    const out = [];
    if (it.quality === 'gold') out.push(el('span.cz-q.is-gold', { title: 'Une dorée cette année' }, '✦'));
    else if (it.quality === 'fine') out.push(el('span.cz-q.is-fine', { title: 'Une belle cette année' }, '★'));
    if (it.giant) out.push(el('span.cz-q.is-giant', { title: 'Un géant cette année' }, '◆'));
    if (it.homemade) out.push(el('span.cz-q.is-home', { title: 'Fait maison' }, '⌂'));
    if (it.star) out.push(el('span.cz-q.is-star', { title: 'Vedette de l\'année' }, '☀'));
    return out;
  }
  function qualityWords(it) {
    const w = [];
    if (it.quality === 'gold') w.push('une dorée cette année');
    else if (it.quality === 'fine') w.push('une belle cette année');
    if (it.giant) w.push('un géant');
    if (it.homemade) w.push('fait maison');
    if (it.star) w.push('vedette de l\'année');
    return w.length ? ` (${w.join(', ')})` : '';
  }
  const sameItem = (a, b) => a && b && a.kind === b.kind && a.id === b.id;
  const itemKey = (it) => `${it.kind}:${it.id}`;

  /** Tuile d'un produit de l'année (≥ 72 px). */
  function itemTile(it, { selected = false, liked = false, disabled = false, onPick }) {
    return el(
      `button.cz-tile${selected ? '.is-on' : ''}${liked ? '.is-liked' : ''}${disabled ? '.is-off' : ''}`,
      {
        type: 'button',
        id: `cz-item-${it.kind}-${it.id}`,
        'aria-pressed': selected ? 'true' : 'false',
        'aria-label': `${it.name}${qualityWords(it)}${liked ? ', aimé de ce villageois' : ''}${selected ? ', choisi' : ''}`,
        onclick: () => onPick(it),
      },
      el('span.cz-tile-ico', itemIcon(it, 'sprite--md')),
      el('span.cz-tile-name', it.name),
      el('span.cz-tile-q', { 'aria-hidden': 'true' }, qualityBadges(it), liked ? el('span.cz-q.is-heart', '♥') : null),
    );
  }

  /** Phrase des villageois (le cœur peut la donner ; sinon, selon le résultat — jamais de reproche). */
  function resultText(r, f) {
    if (r.text) return r.text;
    if (f?.engine === 'marmite') return ['Une bonne soupe, merci !', 'Un régal !', 'La meilleure soupe de l\'année !'][Math.max(1, Math.min(3, r.ladles || 1)) - 1];
    if (f?.engine === 'etal') return r.ribbon === 'gold' ? 'Grand prix du jury : bravo !' : r.ribbon === 'blue' ? 'Un bel étal, vraiment !' : 'Les enfants ont adoré votre stand !';
    if (f?.engine === 'paniers') return (r.hearts || 0) >= 4 ? 'Oh, mes préférés !' : 'Merci, c\'est trop gentil !';
    return null;
  }

  function resultBox(r, f) {
    if (!r) return null;
    const lines = [];
    if (r.ladles) lines.push(el('div.cz-res-main', czIcon(['icon.ladle'], 'sprite--md', '🥄'), el('b', plural(r.ladles, 'louche'))));
    if (r.ribbon) lines.push(el('div.cz-res-main', czIcon([`ribbon.${r.ribbon}`], 'sprite--md', r.ribbon === 'gold' ? '🏵' : '🎗'), el('b', RIBBON_NAMES[r.ribbon] || 'Ruban'), el('small', RIBBON_SUB[r.ribbon] || '')));
    if (r.hearts !== undefined && f?.engine === 'paniers') lines.push(el('div.cz-res-main', el('span.cz-heart', { 'aria-hidden': 'true' }, '♥'), el('b', plural(r.hearts, 'cœur'))));
    if (r.score !== undefined && f?.engine === 'etal') lines.push(el('small.cz-res-score', `${plural(r.score, 'point')}`));
    return el(
      'div.cz-result',
      { role: 'status' },
      lines,
      resultText(r, f) ? el('p.cz-say', `« ${resultText(r, f)} »`) : null,
      el('div.cz-res-gain', r.amount ? coinLine(r.amount) : null, ecuLine(r.ecus)),
    );
  }

  // ── La fête du jour ───────────────────────────────────────────────────────────
  function resetSel(f) {
    const id = f ? `${f.id}|${f.day ?? ''}` : null;
    if (sel.feteId === id) return;
    sel.feteId = id;
    sel.soup = [];
    sel.stand = [];
    sel.baskets = [[], [], []];
    sel.basket = 0;
  }

  function feteSig() {
    const f = q('fete');
    return JSON.stringify([f, Math.floor((app.game?.state.money || 0) / 5)]);
  }

  function feteHead(f) {
    // Le nom de la fête est déjà le titre de la feuille : ici, seulement l'annonce (QA du lot 4 : nom en double).
    return el('div.cz-head', el('span.cz-head-ico', feteIcon(f, 'sprite--lg')), el('div', f.text ? el('p.cz-lead', f.text) : el('b.cz-name', f.name)));
  }
  function rulesList(f) {
    const rules = (f.rules || []).filter(Boolean);
    return rules.length ? el('ul.cz-rules', rules.map((r) => el('li', r))) : null;
  }

  function feteContent() {
    const f = q('fete');
    if (!f) {
      const up = (q('cozy')?.upcoming || [])[0];
      return el('div.cz-fete', el('p.cz-lead', up ? `Prochaine fête : ${up.name} (${up.daysUntil === 1 ? 'demain' : `dans ${plural(up.daysUntil, 'jour')}`}).` : 'Pas de fête aujourd\'hui. Elles reviennent chaque année !'));
    }
    resetSel(f);
    switch (f.engine) {
      case 'chasse':
        return chasseContent(f);
      case 'marmite':
        return soupContent(f);
      case 'etal':
        return standContent(f);
      case 'paniers':
        return basketsContent(f);
      case 'foire':
        return fairContent(f);
      default:
        return el('div.cz-fete', feteHead(f));
    }
  }

  function openFete() {
    if (!enabled()) return false;
    app.toasts.hide?.(feteToast);
    const f = q('fete');
    return openLive('cz-fete', { title: f?.name || 'Les fêtes', icon: feteIcon(f, 'sprite--md'), build: feteContent, sig: feteSig });
  }

  // ── Chasse (œufs, lampions, grenouilles, lanternes) ──────────────────────────
  function hiddenOf(f) {
    const h = f?.hidden || {};
    const items = h.items || [];
    const kind = HIDDEN[h.kind] ? h.kind : 'egg';
    const found = h.foundByPlayer ?? items.filter((x) => x.found === 'player').length;
    const total = h.total ?? items.length ?? 8;
    const left = items.filter((x) => !x.found).length;
    return { kind, items, found, total: total || 8, left, txt: HIDDEN[kind] };
  }

  function eggRow(h) {
    return el(
      'div.cz-eggs',
      { role: 'img', 'aria-label': `${h.found} ${h.found > 1 ? h.txt.foundPl : h.txt.found} sur ${h.total}` },
      h.items.map((it, i) => {
        const on = !!it.found;
        const name = h.kind === 'egg' ? (it.gold ? 'fete.egg.gold' : `fete.egg.${i % 4}`) : h.kind === 'frog' ? 'fete.frog' : h.kind === 'lampion' ? (on ? 'fete.lampion.lit' : 'fete.lampion') : on ? 'fete.lantern.lit' : 'fete.lantern';
        return el(`span.cz-egg${on ? '.is-on' : ''}${it.found === 'village' ? '.is-village' : ''}${it.gold ? '.is-gold' : ''}`, { 'aria-hidden': 'true' }, czIcon([name], 'sprite--md', h.txt.emoji));
      }),
    );
  }

  function chasseContent(f) {
    const h = hiddenOf(f);
    const parts = [feteHead(f), eggRow(h), el('p.cz-count', el('b', `${fmt(h.found)} / ${fmt(h.total)}`), ` ${h.found > 1 ? h.txt.foundPl : h.txt.found}`)];
    if (h.left > 0 && !f.done) {
      parts.push(
        el('button.btn.btn--red.btn--big.btn--wide.cz-go', { type: 'button', id: 'cz-hunt', onclick: () => enterFeteMode() }, el('span', h.found > 0 ? 'Continuer' : h.txt.verb)),
        el('p.sheet-hint', `Le jeu se met en pause. Indice illimité. Ce soir, Lili trouvera les ${h.txt.name} qui restent.`),
      );
    } else {
      parts.push(el('p.cz-lead.is-done', h.found >= h.total ? `Bravo : tous les ${h.txt.name}, et par vous !` : `C'est fini pour aujourd'hui : merci !`));
      if (f.result) parts.push(resultBox(f.result, f));
    }
    parts.push(rulesList(f));
    return el('div.cz-fete.cz-chasse', parts);
  }

  // ── Mode fête (chasse) ───────────────────────────────────────────────────────
  function buildBar() {
    if (bar) return;
    barCount = el('span.cz-bar-count', { 'aria-live': 'polite', id: 'cz-bar-count' }, '');
    const b = (id, label, ico, onclick, cls = '') => el(`button.tabbar-btn.cz-bar-btn${cls}`, { type: 'button', id: `cz-bar-${id}`, onclick: () => { app.vibrate?.(8); onclick(); } }, el('span.tabbar-ico', ico), el('span.tabbar-label', label));
    bar = el(
      'nav.cz-fetebar',
      { id: 'cz-fetebar', 'aria-label': 'Chasse de la fête' },
      el('div.cz-bar-info', el('span.cz-bar-ico', { id: 'cz-bar-ico' }), barCount),
      b('hint', 'Indice', czIcon(['icon.fete'], 'sprite--sm', '✨'), () => showHint()),
      b('done', 'Terminer', icon('play', 'md'), () => leaveFeteMode(), '.is-done'),
    );
    document.body.append(bar);
  }

  function paintBar() {
    if (!bar) return;
    const f = q('fete');
    const h = hiddenOf(f);
    const ico = bar.querySelector('#cz-bar-ico');
    if (ico && ico.dataset.kind !== h.kind) {
      ico.dataset.kind = h.kind;
      ico.replaceChildren(czIcon([h.kind === 'egg' ? 'fete.egg.0' : h.kind === 'frog' ? 'fete.frog' : h.kind === 'lampion' ? 'fete.lampion.lit' : 'fete.lantern.lit'], 'sprite--sm', h.txt.emoji));
    }
    const t = `${fmt(h.found)} / ${fmt(h.total)}`;
    if (barCount.textContent !== t) {
      barCount.textContent = t;
      barCount.setAttribute('aria-label', `${h.found} ${h.found > 1 ? h.txt.foundPl : h.txt.found} sur ${h.total}`);
    }
  }

  function enterFeteMode() {
    const g = app.game;
    const f = q('fete');
    if (!g || !f || f.engine !== 'chasse' || g.state.status !== 'playing') return false;
    if (hiddenOf(f).left <= 0) return false;
    if (feteMode) return true;
    buildBar();
    feteMode = true;
    app.sheets.close('silent');
    app.input?.cancel?.();
    app.toasts.hide?.(feteToast);
    app.pushPause('fete');
    document.body.classList.add('in-fete');
    app.scene?.setFeteMode?.(true);
    // (Accompagnement) Mode fête : seules les leçons de la fête (fete.chasse) peuvent s'afficher.
    app.coach?.signal?.(SIGNALS.feteMode, { on: true });
    paintBar();
    app.audio.play('open', { volume: 0.6 });
    app.onDecorChange?.(true); // la ligne « À faire » et les marges de la scène se recalculent
    const h = hiddenOf(f);
    app.toasts.show({ prio: 'important', kind: 'info', key: 'cz-hunt', sprite: czIcon(['icon.fete'], 'sprite--sm', h.txt.emoji), text: `Faites défiler la ferme et touchez les ${h.txt.name}. « Indice » montre le plus proche.`, duration: 4200, log: false });
    if (app.keyboardMode) requestAnimationFrame(() => bar.querySelector('#cz-bar-hint')?.focus());
    return true;
  }

  function leaveFeteMode({ silent = false } = {}) {
    if (!feteMode) return;
    feteMode = false;
    document.body.classList.remove('in-fete');
    app.scene?.setFeteMode?.(false);
    app.coach?.signal?.(SIGNALS.feteMode, { on: false });
    app.popPause('fete');
    app.todo?.ring?.([]);
    if (!silent) app.audio.play('close', { volume: 0.6 });
    app.onDecorChange?.(false);
    app.tabbar?.refresh();
  }

  /** Indice : la vue glisse vers l'objet le plus proche non trouvé, une étincelle le montre (illimité). */
  function showHint() {
    const s = app.scene;
    const f = q('fete');
    const h = hiddenOf(f);
    const left = h.items.filter((x) => !x.found);
    if (!s || !left.length) return;
    const view = safe(() => s.viewRect?.(), null);
    const cx = view ? view.x + view.w / 2 : 0;
    const cy = view ? view.y + view.h / 2 : 0;
    let best = null;
    let bd = Infinity;
    for (const it of left) {
      const r = safe(() => s.cozyItemRect?.('feteItem', it.index), null);
      if (!r) continue;
      const d = (r.x + r.w / 2 - cx) ** 2 + (r.y + r.h / 2 - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    if (!best) return;
    app.audio.play('page', { volume: 0.5 });
    focusRect(best, 2600);
    safe(() => s.effects?.sparkle?.({ x: best.x - 2, y: best.y - 2, w: best.w + 4, h: best.h + 4 }, reduced() ? 4 : 12, 'gold', 0.25), null);
  }

  /** Amène la vue sur un rectangle du monde et l'entoure un moment (anneau de la ligne « À faire »). */
  function focusRect(r, ms = 2200) {
    const s = app.scene;
    if (!s || !r) return;
    safe(() => s.focusWorld?.(r.x + r.w / 2, r.y + r.h / 2, { animate: !reduced() }), null);
    let n = 0;
    const pad = { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 };
    const paint = () => {
      const pr = app.worldPageRect?.(pad);
      app.todo?.ring?.(pr ? [pr] : []);
      if (++n < 40) requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    clearTimeout(focusRect.timer);
    focusRect.timer = setTimeout(() => app.todo?.ring?.([]), ms);
  }

  function findItem(index) {
    const res = act('feteFind', index);
    if (!res?.ok) return res;
    app.vibrate?.(res.gold ? [14, 40, 14] : 12);
    app.audio.tone?.(res.gold ? 'gold' : 'pop', { volume: 0.9 });
    paintBar();
    const f = q('fete');
    const h = hiddenOf(f);
    if (h.left <= 0) {
      // Tous trouvés : petite fête, puis retour au jeu.
      tone('fanfare', { volume: 0.85, delay: 0.25 });
      app.vibrate?.([20, 60, 20, 60, 30]);
      setTimeout(() => {
        leaveFeteMode({ silent: true });
        openFete();
      }, reduced() ? 300 : 1300);
    }
    return res;
  }

  // ── Soupe (marmite) ──────────────────────────────────────────────────────────
  function previewOf(items) {
    if (!items.length) return null;
    return q('fetePreview', app.game, items.map(({ kind, id }) => ({ kind, id })));
  }

  function soupContent(f) {
    const parts = [];
    const max = f.max || 3;
    const choices = f.choices || [];
    const theme = !!f.themeId;
    parts.push(
      el(
        'div.cz-pot',
        el('span.cz-pot-ico', czIcon(['fete.pot.1', 'fete.pot'], 'sprite--hero', '🍲')),
        el(
          'div.cz-pot-in',
          { role: 'list', 'aria-label': `Dans la marmite : ${sel.soup.length ? sel.soup.map((x) => x.name).join(', ') : 'rien encore'}` },
          [...Array(max)].map((_, i) => {
            const it = sel.soup[i];
            return it
              ? el('button.cz-slot.is-full', { type: 'button', role: 'listitem', 'aria-label': `Retirer ${it.name}`, onclick: () => { sel.soup.splice(i, 1); app.audio.play('click', { volume: 0.5 }); repaint(); } }, itemIcon(it, 'sprite--md'))
              : el('span.cz-slot', { role: 'listitem', 'aria-label': 'Place libre' });
          }),
        ),
      ),
    );
    if (!f.done) {
      parts.push(el('div.cz-npc', portraitOf('portrait.client.chevalier', 'sprite--sm'), el('p.cz-say', theme ? `« ${f.text || 'À vous de jouer !'} »` : `« Chacun apporte un légume ! Jusqu'à ${max}, tous différents. »`)));
      if (!choices.length) parts.push(el('p.cz-lead', 'Récoltez un légume, et revenez goûter !'));
      else {
        parts.push(
          el(
            'div.cz-tiles',
            choices.map((it) =>
              itemTile(it, {
                selected: sel.soup.some((x) => sameItem(x, it)),
                onPick: (x) => {
                  const k = sel.soup.findIndex((y) => sameItem(y, x));
                  if (k >= 0) sel.soup.splice(k, 1);
                  else if (sel.soup.length >= max) return refused(`De 1 à ${max} légumes différents.`);
                  else {
                    sel.soup.push(x);
                    tone('splash', { volume: 0.6 });
                  }
                  app.vibrate?.(8);
                  repaint();
                },
              }),
            ),
          ),
        );
        const pv = previewOf(sel.soup);
        parts.push(el('p.cz-preview', { 'aria-live': 'polite' }, pv?.ladles ? ['Le village dira : ', el('b', plural(pv.ladles, 'louche')), pv.amount ? ` · +${fmt(pv.amount)}` : ''] : sel.soup.length ? '' : 'Touchez un légume : il saute dans la marmite.'));
        parts.push(
          el(
            `button.btn.btn--red.btn--big.btn--wide.cz-go${sel.soup.length ? '' : '.is-disabled'}`,
            {
              type: 'button',
              id: 'cz-soup-go',
              'aria-disabled': sel.soup.length ? 'false' : 'true',
              onclick: () => {
                if (!sel.soup.length) return refused('Choisissez au moins un légume.');
                const res = act('cookSoup', sel.soup.map(({ kind, id }) => ({ kind, id })));
                if (res?.ok) {
                  tone('chime', { volume: 0.85 });
                  app.vibrate?.([12, 40, 12]);
                  repaint();
                }
              },
            },
            theme ? 'Goûter !' : 'Goûter la soupe !',
          ),
        );
      }
    } else {
      parts.push(resultBox(f.result, f));
    }
    parts.push(rulesList(f));
    return el('div.cz-fete.cz-soup', feteHead(f), parts);
  }

  // ── Stand de la ferme (étal) ─────────────────────────────────────────────────
  function standContent(f) {
    const slots = f.max || 5;
    const choices = f.choices || [];
    const parts = [feteHead(f)];
    const crates = el(
      'div.cz-crates',
      { role: 'list', 'aria-label': `Cagettes : ${sel.stand.length} sur ${slots}` },
      [...Array(slots)].map((_, i) => {
        const it = sel.stand[i];
        return it
          ? el('button.cz-crate.is-full', { type: 'button', role: 'listitem', 'aria-label': `Cagette ${i + 1} : ${it.name}. Toucher pour la vider.`, onclick: () => { sel.stand.splice(i, 1); app.audio.play('click', { volume: 0.5 }); repaint(); } }, itemIcon(it, 'sprite--md'), el('span.cz-tile-q', { 'aria-hidden': 'true' }, qualityBadges(it)))
          : el('span.cz-crate', { role: 'listitem', 'aria-label': `Cagette ${i + 1} vide` });
      }),
    );
    parts.push(el('div.cz-standbox', czIcon(['fete.stand'], 'sprite--lg', '🧺'), crates));
    if (!f.done) {
      if (!choices.length) parts.push(el('p.cz-lead', 'Récoltez ou produisez quelque chose, et revenez présenter votre stand !'));
      else {
        parts.push(
          el(
            'div.cz-tiles',
            choices.map((it) =>
              itemTile(it, {
                selected: sel.stand.some((x) => sameItem(x, it)),
                onPick: (x) => {
                  const k = sel.stand.findIndex((y) => sameItem(y, x));
                  if (k >= 0) sel.stand.splice(k, 1);
                  else if (sel.stand.length >= slots) return refused(`${slots} cagettes au plus : touchez-en une pour la vider.`);
                  else {
                    sel.stand.push(x);
                    app.audio.play('page', { volume: 0.5 });
                  }
                  app.vibrate?.(8);
                  repaint();
                },
              }),
            ),
          ),
        );
        const pv = previewOf(sel.stand);
        parts.push(el('p.cz-preview', { 'aria-live': 'polite' }, pv ? [plural(pv.score || 0, 'point'), ' · ', el('b', RIBBON_NAMES[pv.ribbon] || 'Ruban vert'), pv.amount ? ` · +${fmt(pv.amount)}` : ''] : 'Touchez un produit : il va dans une cagette.'));
        parts.push(
          el(
            `button.btn.btn--red.btn--big.btn--wide.cz-go${sel.stand.length ? '' : '.is-disabled'}`,
            {
              type: 'button',
              id: 'cz-stand-go',
              'aria-disabled': sel.stand.length ? 'false' : 'true',
              onclick: () => {
                if (!sel.stand.length) return refused('Remplissez au moins une cagette.');
                const res = act('presentStand', sel.stand.map(({ kind, id }) => ({ kind, id })));
                if (res?.ok) {
                  tone(res.ribbon === 'gold' ? 'fanfare' : 'chime', { volume: 0.85, delay: 0.2 });
                  app.vibrate?.(res.ribbon === 'gold' ? [20, 60, 20, 60, 30] : [12, 40, 12]);
                  repaint();
                }
              },
            },
            'Présenter au jury',
          ),
        );
      }
    } else {
      parts.push(resultBox(f.result, f));
      const detail = f.result?.detail || [];
      if (detail.length) parts.push(el('ul.cz-detail', detail.map((d) => el('li', itemIcon(d.item, 'sprite--xs'), el('span', d.item?.name || ''), el('b', `+${d.points}`)))));
    }
    parts.push(rulesList(f));
    return el('div.cz-fete.cz-stand', parts);
  }

  // ── Paniers de Noël ──────────────────────────────────────────────────────────
  function basketsContent(f) {
    const vill = f.villagers || [];
    const per = f.max || 2;
    const choices = f.choices || [];
    const parts = [feteHead(f)];
    const likesOf = (v) => v?.likes || [];
    const likedBy = (v, it) => likesOf(v).some((l) => sameItem(l, it) || (l.id === it.id && !l.kind));
    const used = (it) => sel.baskets.some((b) => b.some((x) => sameItem(x, it)));
    parts.push(
      el(
        'div.cz-villagers',
        vill.map((v, i) => {
          const b = sel.baskets[i] || [];
          const active = sel.basket === i && !f.done;
          const hearts = b.filter((x) => likedBy(v, x)).length;
          return el(
            `div.cz-villager${active ? '.is-active' : ''}`,
            el('span.cz-v-portrait', portraitOf(v.portrait || `portrait.client.${v.clientId}`, 'sprite--portrait')),
            el('b.cz-v-name', v.name),
            el('span.cz-likes', { 'aria-label': `Aime : ${likesOf(v).map((l) => l.name || (l.kind === 'crop' ? cropName(l.id) : l.id)).join(', ')}` }, likesOf(v).map((l) => el('span.cz-like', itemIcon(l, 'sprite--xs')))),
            el(
              `button.cz-basket${active ? '.is-on' : ''}`,
              {
                type: 'button',
                id: `cz-basket-${i}`,
                'aria-pressed': active ? 'true' : 'false',
                'aria-label': `Panier de ${v.name} : ${b.length ? b.map((x) => x.name).join(', ') : 'vide'}${f.done ? '' : '. Toucher pour le remplir.'}`,
                onclick: () => {
                  if (f.done) return;
                  sel.basket = i;
                  app.audio.play('click', { volume: 0.5 });
                  repaint();
                },
              },
              czIcon([b.length ? 'fete.basket.full' : 'fete.basket'], 'sprite--md', '🧺'),
              el('span.cz-basket-in', [...Array(per)].map((_, k) => (b[k] ? el('span.cz-bslot.is-full', itemIcon(b[k], 'sprite--sm')) : el('span.cz-bslot')))),
              hearts ? el('span.cz-basket-hearts', { 'aria-hidden': 'true' }, '♥'.repeat(hearts)) : null,
            ),
            !f.done && b.length ? el('button.btn.cz-empty', { type: 'button', 'aria-label': `Vider le panier de ${v.name}`, onclick: () => { sel.baskets[i] = []; app.audio.play('click', { volume: 0.5 }); repaint(); } }, 'Vider') : null,
          );
        }),
      ),
    );
    if (!f.done) {
      const v = vill[sel.basket];
      if (!choices.length) parts.push(el('p.cz-lead', 'Récoltez ou produisez quelque chose, et revenez faire les paniers !'));
      else {
        parts.push(el('p.cz-lead', v ? `Pour ${v.name} :` : 'Touchez un produit :'));
        parts.push(
          el(
            'div.cz-tiles',
            choices.map((it) =>
              itemTile(it, {
                selected: used(it),
                liked: likedBy(v, it),
                onPick: (x) => {
                  // Déjà dans un panier : il en sort. Sinon : panier choisi, ou le premier qui a une place.
                  for (const b of sel.baskets) {
                    const k = b.findIndex((y) => sameItem(y, x));
                    if (k >= 0) {
                      b.splice(k, 1);
                      app.audio.play('click', { volume: 0.5 });
                      repaint();
                      return;
                    }
                  }
                  let i = sel.basket;
                  if ((sel.baskets[i] || []).length >= per) i = sel.baskets.findIndex((b) => b.length < per);
                  if (i < 0) return refused('Les paniers sont pleins : touchez « Vider » pour changer.');
                  sel.baskets[i].push(x);
                  if (sel.baskets[i].length >= per) {
                    const nx = sel.baskets.findIndex((b) => b.length < per);
                    if (nx >= 0) sel.basket = nx;
                  }
                  app.audio.play('page', { volume: 0.5 });
                  app.vibrate?.(8);
                  repaint();
                },
              }),
            ),
          ),
        );
        // Autant de paniers garnis que de produits différents (3 au plus) : une petite ferme peut offrir 1 ou 2 paniers.
        const need = Math.min(vill.length, choices.length);
        const filled = sel.baskets.slice(0, vill.length).filter((b) => b.length > 0).length;
        const ready = vill.length > 0 && need > 0 && filled >= need;
        const pv = ready ? q('fetePreview', app.game, sel.baskets.slice(0, vill.length).map((b) => b.map(({ kind, id }) => ({ kind, id })))) : null;
        parts.push(el('p.cz-preview', { 'aria-live': 'polite' }, pv && !pv.reason ? [el('b', plural(pv.hearts || 0, 'cœur')), pv.amount ? ` · +${fmt(pv.amount)}` : ''] : need < vill.length ? `${need === 1 ? 'Un panier garni' : `${need} paniers garnis`} suffisent cette année.` : 'Un produit au moins dans chaque panier.'));
        parts.push(
          el(
            `button.btn.btn--red.btn--big.btn--wide.cz-go${ready ? '' : '.is-disabled'}`,
            {
              type: 'button',
              id: 'cz-baskets-go',
              'aria-disabled': ready ? 'false' : 'true',
              onclick: () => {
                if (!ready) return refused(need < vill.length ? `${need === 1 ? 'Un panier garni' : `${need} paniers garnis`} au moins.` : 'Un produit au moins dans chaque panier.');
                const res = act('giveBaskets', sel.baskets.slice(0, vill.length).map((b) => b.map(({ kind, id }) => ({ kind, id }))));
                if (res?.ok) {
                  tone('chime', { volume: 0.85 });
                  app.vibrate?.([12, 40, 12]);
                  repaint();
                }
              },
            },
            'Offrir les paniers',
          ),
        );
      }
    } else {
      parts.push(resultBox(f.result, f));
      const per2 = f.result?.perBasket || [];
      if (per2.length) parts.push(el('div.cz-thanks', vill.map((v, i) => el('p.cz-say', portraitOf(v.portrait || `portrait.client.${v.clientId}`, 'sprite--xs'), ` ${v.name} : « ${!(f.result?.items?.[i] || []).length ? 'Joyeux Noël !' : (per2[i] || 0) >= 2 ? 'Oh, mes préférés !' : (per2[i] || 0) === 1 ? 'Comme c\'est gentil !' : 'Merci, c\'est trop gentil !'} »`))));
    }
    parts.push(rulesList(f));
    return el('div.cz-fete.cz-baskets', parts);
  }

  // ── Foire aux graines (carrière) ─────────────────────────────────────────────
  function buyPack(p) {
    if (!p.canBuy) return refused(p.reason || 'Pas possible pour l\'instant.');
    const money = Math.max(0, app.game.state.money);
    const go = () => {
      const res = act('buySeedPack', p.cropId);
      if (res?.ok) {
        app.audio.play('buy');
        app.vibrate?.(12);
      }
    };
    if (p.price > money * 0.5) {
      app.dialogs
        .confirm({ title: `Sachet de ${lower(p.name)} ?`, text: `${plural(p.price, 'pièce')} sur vos ${fmt(money)}. Il vous restera ${plural(money - p.price, 'pièce')}.`, ok: `Acheter (${fmt(p.price)})`, cancel: 'Annuler' })
        .then((ok) => ok && app.game && go());
    } else go();
  }

  function fairContent(f) {
    const stalls = f.stalls || [];
    const bank = q('cozy')?.seedBank || [];
    const parts = [feteHead(f)];
    if (!stalls.length) parts.push(el('p.cz-lead', 'Rien à vendre aujourd\'hui.'));
    for (const s of stalls) {
      parts.push(
        el(
          'section.cz-stall',
          el('h3.stats-title', s.name),
          el(
            'div.cz-packs',
            { role: 'list' },
            (s.packs || []).map((p) =>
              el(
                `article.cz-pack${p.canBuy ? '' : '.is-off'}`,
                { role: 'listitem', id: `cz-pack-${p.cropId}` },
                el('span.cz-pack-ico', czIcon([p.icon, `seedbag.${p.cropId}`, 'seedpack.generic'], 'sprite--md', '🌱')),
                el('b.cz-pack-name', p.name),
                el('small', `${plural(p.seeds || 8, 'semis', 'semis')}${p.bought ? ` · ${p.bought} acheté${p.bought > 1 ? 's' : ''}` : ''}`),
                el(`button.btn.cz-buy${p.canBuy ? '.btn--red' : '.is-disabled'}`, { type: 'button', 'aria-disabled': p.canBuy ? 'false' : 'true', 'aria-label': `Acheter un sachet de ${p.name} pour ${p.price} pièces`, onclick: () => buyPack(p) }, icon('coin', 'sm'), fmt(p.price || 0)),
              ),
            ),
          ),
        ),
      );
    }
    // (Vallée vivante) Étal « La grainothèque du pays » : un sachet ancien par an.
    const vlFair = app.valley?.fairSection?.();
    if (vlFair) parts.push(vlFair);
    if (bank.length) parts.push(el('section.cz-bank', el('h3.stats-title', czIcon(['icon.seedbank'], 'sprite--sm', '🥫'), 'Ma réserve de graines'), bank.map((b) => el('div.stats-line', el('span.stats-label', cropIcon(b.cropId, 'sprite--xs'), ` ${b.name}`), el('b.stats-value', plural(b.n, 'semis', 'semis'))))));
    // (La règle « vos semis prennent la réserve d'abord » est déjà dans les règles du cœur, en bas de la feuille.)
    if (app.careerUI?.open?.plan) {
      const lot = safe(() => (app.game.query.career.lots?.() || []).find((l) => l.type === 'field' || l.id === 'start'), null);
      if (lot) parts.push(el('button.btn.btn--wide.cz-plan', { type: 'button', id: 'cz-plan', onclick: () => app.careerUI.open.plan(lot.id, 'spring') }, czIcon(['icon.seedbank'], 'sprite--sm', '📒'), 'Mon carnet de semis (printemps)'));
    }
    return el('div.cz-fete.cz-fair', parts, rulesList(f));
  }

  function openSeedFair() {
    return openFete();
  }

  // ── Hiver vivant ─────────────────────────────────────────────────────────────
  function winterContent() {
    const w = q('winter');
    if (!w) return el('p.cz-lead', 'L\'hiver vivant arrive avec la neige : trouvailles en lisière, mangeoire, veillées.');
    const parts = [];
    const finds = w.finds || [];
    parts.push(
      el(
        'section.cz-sec',
        el('h3.stats-title', czIcon(['icon.winter'], 'sprite--sm', '❄'), 'En lisière'),
        finds.length
          ? finds.map((f) =>
              el(
                'div.cz-row',
                el('span.cz-row-ico', czIcon([f.icon, `winter.${f.kind}`], 'sprite--md', FIND_EMOJI[f.kind] || '🍂')),
                el('span.cz-row-text', f.name || f.kind),
                el('button.btn.cz-small', { type: 'button', 'aria-label': `Montrer : ${f.name}`, onclick: () => showInScene('winterFind', f.id) }, 'Montrer'),
                el('button.btn.btn--red.cz-small', { type: 'button', id: `cz-pick-${f.id}`, 'aria-label': `Ramasser : ${f.name}`, onclick: () => pickFind(f.id) }, 'Ramasser'),
              ),
            )
          : el('p.stats-note', 'Rien pour l\'instant : une trouvaille apparaît chaque matin d\'hiver.'),
        (w.traces || []).length ? el('p.stats-note', `Dans la neige : ${(w.traces || []).map((t) => lower(t.name || t.kind)).join(', ')}.`) : null,
      ),
    );
    const fd = w.feeder || {};
    if (fd.here) {
      parts.push(
        el(
          'section.cz-sec',
          el('h3.stats-title', czIcon(['icon.feeder', 'feeder'], 'sprite--sm', '🐦'), 'La mangeoire'),
          fd.bird ? el('div.cz-row', el('span.cz-row-ico', czIcon([fd.bird.icon, `bird.${fd.bird.id}`], 'sprite--md', '🐦')), el('span.cz-row-text', `Aujourd'hui : ${fd.bird.name}`), el('button.btn.cz-small', { type: 'button', onclick: () => singBird(fd.bird) }, 'Écouter')) : null,
          fd.canFill
            ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'cz-fill', onclick: () => fill() }, 'Remplir la mangeoire')
            : el('p.stats-note', fd.filledToday ? 'Remplie aujourd\'hui : un oiseau viendra demain matin.' : 'Revenez demain pour la remplir.'),
        ),
      );
    }
    const st = w.story || {};
    parts.push(
      el(
        'section.cz-sec',
        el('h3.stats-title', czIcon(['icon.story'], 'sprite--sm', '🕯'), 'La veillée'),
        st.available && !st.heard
          ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'cz-story-open', onclick: () => openStory() }, 'Aller chez Joseph')
          : el('p.stats-note', st.heard ? 'Joseph vous a raconté une histoire cet hiver. Il en a d\'autres pour l\'an prochain.' : 'Le 3ᵉ jour d\'hiver, Joseph vous attend le soir.'),
      ),
    );
    if (isCareer()) {
      const up = (q('cozy')?.upcoming || []).find((x) => x.engine === 'foire');
      parts.push(el('section.cz-sec', el('h3.stats-title', czIcon(['icon.seedbank'], 'sprite--sm', '🌱'), 'Préparer le printemps'), el('p.stats-note', up ? `Foire aux graines ${up.daysUntil === 0 ? 'aujourd\'hui' : up.daysUntil === 1 ? 'demain' : `dans ${plural(up.daysUntil, 'jour')}`} : des sachets à −25 %.` : 'Le dernier jour de l\'hiver : la foire aux graines.')));
    }
    return el('div.cz-winter', parts);
  }

  function openWinter() {
    if (!enabled() || !q('winter')) return false;
    return openLive('cz-winter', { title: 'L\'hiver à la ferme', icon: czIcon(['icon.winter'], 'sprite--md', '❄'), build: winterContent, sig: () => JSON.stringify(q('winter')) });
  }

  function showInScene(kind, id) {
    const r = safe(() => app.scene?.cozyItemRect?.(kind, id), null);
    if (!r) return;
    app.sheets.close();
    requestAnimationFrame(() => focusRect(r, 2400));
  }

  function pickFind(id) {
    const res = act('pickWinterFind', id);
    if (res?.ok) {
      tone('pop', { volume: 0.85 });
      app.vibrate?.(10);
    }
    return res;
  }

  function fill() {
    const res = act('fillFeeder');
    if (res?.ok) {
      app.audio.play('plant', { volume: 0.5 });
      app.vibrate?.(10);
    }
    return res;
  }

  function singBird(bird) {
    tone('chirp', { volume: 0.9, throttle: 400 });
    app.scene?.cozySing?.();
    if (bird) app.toasts.show({ prio: 'info', kind: 'info', key: 'cz-bird', sprite: czIcon([bird.icon, `bird.${bird.id}`], 'sprite--sm', '🐦'), text: `${bird.name} chante à la mangeoire.`, duration: 2600, log: false });
  }

  // ── La veillée ───────────────────────────────────────────────────────────────
  function nextStory() {
    const S = DATA.album?.STORIES || [];
    if (!S.length) return null;
    const n = Math.max(0, app.progression?.get?.()?.album?.stories || 0);
    return S[n % S.length];
  }

  function storyContent() {
    const w = q('winter');
    const st = w?.story || {};
    const heard = !!st.heard;
    const story = heard ? storyShown : nextStory();
    const lines = story?.lines || [];
    const parts = [
      el('div.cz-vignette', czIcon(['story.vignette'], 'sprite--vignette', '🔥')),
      story ? el('h3.cz-story-title', story.title) : null,
      lines.length ? el('div.cz-story', lines.map((l, i) => el('p.cz-story-line', { style: { '--cz-delay': `${i}` } }, `« ${l} »`))) : el('p.cz-lead', '« Assieds-toi, il fait bon au coin du feu. »'),
    ];
    if (!heard && st.available) {
      parts.push(el('button.btn.btn--red.btn--big.btn--wide.cz-go', { type: 'button', id: 'cz-story-ok', onclick: () => hear() }, 'Bonne nuit, Joseph'));
    } else {
      parts.push(el('p.sheet-hint', heard ? 'Joseph a d\'autres histoires : revenez l\'hiver prochain.' : 'Le 3ᵉ jour d\'hiver, Joseph vous attend le soir.'));
      parts.push(el('button.btn.btn--wide', { type: 'button', id: 'cz-story-close', onclick: () => app.sheets.close() }, 'Fermer'));
    }
    return el('div.cz-veillee', parts);
  }

  function hear() {
    const res = act('hearStory');
    if (res?.ok) {
      tone('magic', { volume: 0.7 });
      app.vibrate?.(10);
      setTimeout(() => app.sheets.isOpen('cz-story') && app.sheets.close(), reduced() ? 200 : 600);
    }
  }

  function openStory() {
    if (!enabled() || !q('winter')) return false;
    return openLive('cz-story', { title: 'La veillée', icon: czIcon(['icon.story'], 'sprite--md', '🕯'), build: storyContent, sig: () => JSON.stringify(q('winter')?.story) });
  }

  /** storyHeard : l'histoire est choisie par la progression (écu, case d'album). */
  function onStoryHeard() {
    const P = v3.progression;
    let rec = null;
    if (typeof P?.recordStory === 'function') {
      try {
        rec = P.recordStory(app.progression.get(), Date.now(), isCareer() ? 'career' : 'levels');
        if (rec?.progress) app.progression.commit(rec.progress);
        if (rec?.first && rec.story) app.album?.announce?.([`stories.${rec.story.id}`]);
      } catch (err) {
        console.warn('recordStory :', err);
      }
    }
    storyShown = rec?.story || nextStory();
    const ecus = rec?.ecus || 0;
    app.toasts.show({ prio: 'important', kind: ecus ? 'achievement' : 'info', sprite: czIcon(['icon.story'], 'sprite--sm', '🕯'), title: storyShown ? `Veillée : ${storyShown.title}` : 'La veillée', text: ecus ? `Une histoire nouvelle : +${plural(ecus, 'écu')}` : 'Bonne nuit !', duration: 4200 });
  }

  // ── Les lanternes ─────────────────────────────────────────────────────────────
  function critDef(c) {
    return CRITERIA.find((x) => x.id === c.id) || { id: c.id, name: c.name, emoji: '🏮' };
  }

  function lanternRow(c, { animate = false } = {}) {
    const d = critDef(c);
    return el(
      `div.cz-crit.is-${c.id}`,
      { role: 'listitem' },
      el('span.cz-crit-ico', czIcon([c.icon, `icon.crit.${c.id}`], 'sprite--md', d.emoji)),
      el('div.cz-crit-main', el('div.cz-crit-head', el('b', c.name || d.name), lanternDots(c.lit, c.id, { animate })), c.measure ? el('small.cz-crit-measure', c.measure) : null, c.next?.text ? el('small.cz-crit-next', c.next.text) : null),
    );
  }

  /** Rangées des 5 critères ; animate : allumées une à une (mouvements réduits : toutes d'un coup). */
  function lanternRows(criteria, { animate = false } = {}) {
    const list = el(`div.cz-crits${animate && !reduced() ? '.is-lighting' : ''}`, { role: 'list', 'aria-label': 'Les lanternes de l\'année' }, (criteria || []).map((c) => lanternRow(c, { animate })));
    if (animate && !reduced()) {
      // Une lanterne après l'autre (un critère après l'autre), petit carillon.
      const lamps = [...list.querySelectorAll('.cz-lantern.is-on')];
      lamps.forEach((n) => n.classList.add('is-wait'));
      lamps.forEach((n, i) =>
        setTimeout(() => {
          if (!n.isConnected) return;
          n.classList.remove('is-wait');
          if (i % 2 === 0) tone('reveal', { volume: 0.35, throttle: 120 });
        }, 350 + i * 170),
      );
    }
    return list;
  }

  function cosmeticName(id) {
    return (v3.cosmetics?.COSMETICS || []).find((c) => c.id === id)?.name || id;
  }

  function lanternBody(ev, rec, { bankrupt = false } = {}) {
    const total = ev?.total ?? (ev?.values || []).reduce((a, b) => a + b, 0);
    const r = rec?.rewards || {};
    const head = el('p.cz-total', czIcon(['icon.lantern.on'], 'sprite--md', '🏮'), el('b', plural(total, 'lanterne')), r.newBest && !r.first ? el('span.cz-record', ' · nouveau record !') : null);
    return el(
      'div.cz-lantern-page',
      el('p.cz-lead', 'Ce soir, Joseph allume des lanternes sur le perron, pour votre année.'),
      head,
      ev?.partial ? el('p.stats-note', 'Année commencée avant les lanternes.') : null,
      lanternRows(ev?.criteria || [], { animate: true }),
      bankrupt ? el('p.cz-lead.is-soft', 'L\'an prochain, ça ira mieux.') : null,
      r.ecus || (r.cosmetics || []).length ? el('div.cz-rewards', ecuLine(r.ecus), (r.cosmetics || []).map((id) => el('p.cz-found', czIcon([`decor.${id}`], 'sprite--sm', '🏮'), `Nouveau décor : ${cosmeticName(id)}, à poser avec « Décorer la ferme »`))) : null,
    );
  }

  /** Page « Les lanternes de l'année » de la victoire et de la faillite (niveaux) : { title, body, sound }. */
  function lanternPage({ bankrupt = false } = {}) {
    const L = lanternsEv;
    if (!L || L.game !== app.game) return null;
    return {
      title: 'Les lanternes de l\'année',
      body: () => lanternBody(L.ev, L.rec, { bankrupt }),
      onShow: () => {
        tone('chime', { volume: 0.6 });
        // (Accompagnement) La page des lanternes est une page d'une fenêtre : la leçon est demandée ici.
        app.coach?.request?.('cozy.lanterns', { target: { ui: '#cz-lanterns', label: 'les lanternes de l\'année' } });
      },
    };
  }

  /** Fenêtre « Les lanternes de l'année » seule (aperçu de débogage). */
  function showLanternDialog() {
    const lp = lanternPage();
    if (!lp) return false;
    const d = app.dialogs;
    d.open(d.frame({ title: lp.title, ribbon: 'ribbon', cls: 'dialog--victory.dialog--lanterns', body: lp.body(), actions: [d.btn('Merci, Joseph', () => d.closeTop(), 'btn--red', { id: 'cz-lanterns-ok', 'data-autofocus': '' })], onClose: () => d.closeTop() }), { id: 'cz-lanterns', pauses: true, sound: false });
    lp.onShow?.();
    return true;
  }

  /** Carrière : lanternes dans la fenêtre du bilan annuel. */
  function yearBlock(report) {
    const L = lanternsEv && lanternsEv.game === app.game ? lanternsEv : null;
    const ev = L?.ev || report?.cozy?.lanterns || null;
    if (!ev || !(ev.criteria || []).length) return null;
    const cz = report?.cozy || {};
    const extra = [];
    if (cz.handPicked) extra.push(`${plural(cz.handPicked, 'récolte')} à la main${cz.handBonus ? ` (+${fmt(cz.handBonus)} de prime)` : ''}`);
    if (cz.fetes) extra.push(`${plural(typeof cz.fetes === 'number' ? cz.fetes : Object.keys(cz.fetes).length, 'fête')} jouée${(typeof cz.fetes === 'number' ? cz.fetes : Object.keys(cz.fetes).length) > 1 ? 's' : ''}`);
    return el('section.cz-year', el('h3.sum-title', czIcon(['icon.lantern.on'], 'sprite--sm', '🏮'), 'Les lanternes de l\'année'), lanternBody(ev, L?.rec), extra.length ? el('p.stats-note', `${capitalize(extra.join(' · '))}.`) : null);
  }

  /** lanternsLit : progression (meilleur total, écus, décors, succès), porte-lanternes. */
  function onLanterns(ev, g) {
    const P = v3.progression;
    let rec = null;
    if (ev.preview) {
      // Aperçu (débogage : triggerCozy('lanterns')) : rien n'est enregistré, la page s'ouvre seule.
      lanternsEv = { ev, rec: null, at: performance.now(), game: g };
      if (!app.dialogs.isOpen()) showLanternDialog();
      return;
    }
    if (typeof P?.recordLanterns === 'function') {
      try {
        const career = isCareer(g);
        const before = safe(() => (career ? app.progression.get().lanterns?.career : app.progression.get().lanterns?.levels?.[g.level?.id]), null);
        const r = P.recordLanterns(app.progression.get(), { mode: career ? 'career' : 'levels', levelId: career ? undefined : g.level?.id, values: ev.values, total: ev.total, partial: !!ev.partial }, Date.now());
        if (r?.progress) app.progression.commit(r.progress);
        rec = r;
        if (rec?.rewards) rec.rewards.first = !(before && before.total > 0);
        if (r?.achievements?.length) app.progression.announce(r.achievements, {});
      } catch (err) {
        console.warn('recordLanterns :', err);
      }
    }
    lanternsEv = { ev, rec, at: performance.now(), game: g };
    app.audio.tone?.('reveal', { volume: 0.7, delay: 0.3 });
    if (!isCareer(g)) applyRack(g);
  }

  /** Niveaux : le porte-lanternes montre le meilleur résultat du niveau (progression). */
  function applyRack(g = app.game) {
    const s = app.scene;
    if (!s?.setLanterns) return;
    if (!g || !enabled(g) || isCareer(g)) {
      s.setLanterns(null);
      return;
    }
    const best = safe(() => app.progression.get().lanterns?.levels?.[g.level?.id]?.best, null);
    s.setLanterns(Array.isArray(best) ? best : null);
  }

  function lanternsContent() {
    const g = app.game;
    const parts = [];
    const cur = q('lanterns');
    if (isCareer(g)) {
      const hist = g.state.cozy?.lanterns?.history || [];
      const last = hist[hist.length - 1];
      if (last) parts.push(el('section.cz-sec', el('h3.stats-title', `L'année ${last.year} : ${plural(last.total, 'lanterne')}`), historyCols(hist)));
    } else {
      const best = safe(() => app.progression.get().lanterns?.levels?.[g.level?.id], null);
      if (best?.best) parts.push(el('section.cz-sec', el('h3.stats-title', `Votre meilleure année : ${plural(best.total, 'lanterne')}`), el('div.cz-crits.is-compact', { role: 'list' }, CRITERIA.map((c, i) => lanternRow({ id: c.id, name: c.name, lit: best.best[i] || 1 })))));
      else parts.push(el('p.cz-lead', 'À la fin de l\'année, Joseph allumera ici une lanterne (ou plus) pour chaque critère.'));
    }
    if (cur?.criteria?.length) parts.push(el('section.cz-sec', el('h3.stats-title', `Cette année, pour l'instant : ${plural(cur.total, 'lanterne')}`), lanternRows(cur.criteria)));
    return el('div.cz-lanterns-sheet', parts);
  }

  function openLanterns() {
    if (!enabled()) return false;
    return openLive('cz-lanterns', { title: 'Les lanternes', icon: czIcon(['icon.lantern.on'], 'sprite--md', '🏮'), build: lanternsContent, sig: () => JSON.stringify(q('lanterns')) });
  }

  /** Carrière : années précédentes en petites colonnes (Carnet). */
  function historyCols(hist) {
    const list = (hist || []).slice(-10);
    if (!list.length) return null;
    const best = list.reduce((a, h) => (h.total > (a?.total || 0) ? h : a), null);
    return el(
      'div.cz-history',
      { role: 'list', 'aria-label': 'Les lanternes des années passées' },
      list.map((h) =>
        el(
          `div.cz-hcol${h === best ? '.is-best' : ''}`,
          { role: 'listitem', 'aria-label': `Année ${h.year} : ${plural(h.total, 'lanterne')}${h === best ? ', la meilleure' : ''}` },
          el('div.cz-hbars', { 'aria-hidden': 'true' }, CRITERIA.map((c, i) => el(`span.cz-hbar.is-${c.id}`, { style: { height: `${(h.values?.[i] || 1) * 25}%` } }))),
          el('b', String(h.total)),
          el('small', `an ${h.year}`),
        ),
      ),
    );
  }

  function lanternSection(ui) {
    const g = ui?.game || app.game;
    if (!enabled(g)) return null;
    const cur = q('lanterns', g);
    const hist = g.state.cozy?.lanterns?.history || [];
    if (!cur && !hist.length) return null;
    const best = hist.reduce((a, h) => (h.total > (a?.total || 0) ? h : a), null);
    return el(
      'section.c-sec.cz-sec',
      el('h3.stats-title', czIcon(['icon.lantern.on'], 'sprite--sm', '🏮'), 'Les lanternes'),
      cur?.criteria?.length ? [el('p.stats-note', `Cette année, pour l'instant : ${plural(cur.total, 'lanterne')}${cur.partial ? ' (année commencée avant les lanternes)' : ''}.`), lanternRows(cur.criteria)] : null,
      hist.length ? [el('p.stats-note', best ? `Meilleure année : l'an ${best.year} (${plural(best.total, 'lanterne')}).` : ''), historyCols(hist)] : null,
    );
  }

  function levelBadge(levelId) {
    const L = safe(() => app.progression.get().lanterns?.levels?.[levelId], null);
    if (!L || !L.total) return null;
    return el('span.level-lanterns.cz-badge', { 'aria-label': `Meilleures lanternes : ${L.total} sur 20` }, czIcon(['icon.lantern.on'], 'sprite--xs', '🏮'), `${L.total} / 20`);
  }

  // ── F1 : fiche de parcelle, feuille des graines ──────────────────────────────
  function plotRows(p) {
    if (!enabled() || !p) return null;
    const rows = [];
    if (p.handValue && p.helperValue !== undefined && p.helperValue !== null && (p.mature || p.action === 'harvest')) {
      rows.push(el('div.tip-ok.cz-hand', czIcon(['icon.hand'], 'sprite--xs', '♥'), el('span', 'À la main : ', el('b', fmt(p.handValue)), ` · par l'équipe : ${fmt(p.helperValue)}`)));
    }
    const w = p.wait;
    if (w && (p.mature || p.action === 'harvest')) {
      // Seulement l'aide qui travaille vraiment sur ce terrain (le cœur met machineIn / staffIn à null sinon :
      // moissonneuse ou cueilleuse allumée, jardinier qui couvre le terrain).
      const m = Number.isFinite(w.machineIn) ? w.machineIn : null;
      const s = Number.isFinite(w.staffIn) ? w.staffIn : null;
      let who = null;
      let n = null;
      if (m !== null && (s === null || m <= s)) {
        who = (w.machine || helpersOn(p.lot).machine) === 'fruitPicker' ? 'la cueilleuse' : 'la moissonneuse';
        n = m;
      } else if (s !== null) {
        who = 'le jardinier';
        n = s;
      }
      if (who) {
        const when = w.freeze ? `${who} la rentrera aujourd'hui, avant le gel` : n <= 0 ? `${who} peut la récolter dès maintenant` : `${who} passera dans ${plural(n, 'jour')}`;
        rows.push(el('div.tip-note.cz-wait', czIcon(['badge.waiting'], 'sprite--xs', '♥'), el('span', 'Vous attend', ` · ${when}`)));
      }
    }
    if (p.weeded) rows.push(el('div.tip-sub.cz-weeded', '✓ ', typeof p.weeded === 'string' ? `Désherbée par ${p.weeded}` : p.weededBy ? `Désherbée par ${p.weededBy}` : 'Désherbée (belle et dorée un peu plus probables à la main)'));
    return rows.length ? el('div.cz-plot', rows) : null;
  }

  /** Aides d'un terrain : { machine: 'harvester' | 'fruitPicker' | null, staff: bool }. */
  function helpersOn(lotId) {
    const g = app.game;
    const out = { machine: null, staff: false };
    if (!g || lotId === undefined || lotId === null) return out;
    for (const m of safe(() => g.query.career?.machines?.(), []) || []) {
      if (m.lotId === lotId && m.on !== false && (m.id === 'harvester' || m.id === 'fruitPicker')) out.machine = m.id;
    }
    for (const st of safe(() => g.query.career?.staff?.(), []) || []) {
      if (!st.onLeave && st.lotId === lotId && /garden|jardin/i.test(st.job || '')) out.staff = true;
    }
    return out;
  }

  function seedChips(c) {
    if (!enabled() || !c || !(c.bank > 0)) return [];
    return [el('span.warn-chip.cz-chip-bank', czIcon(['icon.seedbank'], 'sprite--xs', '🥫'), `Réserve : ${fmt(c.bank)}`)];
  }

  // ── Toucher dans la scène ─────────────────────────────────────────────────────
  function onHit(hit) {
    if (!hit || !enabled()) return false;
    switch (hit.type) {
      case 'feteItem':
        findItem(hit.index);
        return true;
      case 'winterFind':
        pickFind(hit.id);
        return true;
      case 'feeder': {
        const fd = q('winter')?.feeder || {};
        if (fd.canFill) fill();
        else if (fd.bird) singBird(fd.bird);
        else app.toasts.show({ prio: 'important', kind: 'info', key: 'cz-feeder', sprite: czIcon(['icon.feeder', 'feeder'], 'sprite--sm', '🐦'), text: fd.filledToday ? 'Remplie : un oiseau viendra demain matin.' : 'Revenez demain pour la remplir.', duration: 2600, log: false });
        return true;
      }
      case 'storyWindow':
        return openStory();
      case 'lanternRack':
        return openLanterns();
      case 'feteStall':
        return openFete();
      default:
        return false;
    }
  }

  // ── « À faire maintenant » ────────────────────────────────────────────────────
  function lotNameOf(g, lotId) {
    const fromQ = safe(() => g.query.career.lot?.(lotId)?.name, null);
    if (fromQ) return fromQ;
    const l = (app.scene?.layout?.lots || []).find((x) => x.id === lotId);
    return l?.name || 'Le champ';
  }

  function todoItems(g = app.game) {
    if (!enabled(g)) return [];
    const out = [];
    const f = q('fete', g);
    if (f && !f.done) {
      const go = () => openFete();
      const ico = () => feteIcon(f, 'sprite--sm');
      if (f.engine === 'chasse') {
        const h = hiddenOf(f);
        if (h.left > 0) out.push({ id: 'cz-fete', prio: 33, icon: ico, text: `${f.name} : ${plural(h.left, h.txt.one, h.txt.name)} à ${h.kind === 'lampion' || h.kind === 'lantern' ? 'allumer' : 'trouver'}`, short: `${lower(f.name)} (${h.left} ${h.left > 1 ? h.txt.name : h.txt.one})`, go });
      } else if (f.engine === 'marmite') out.push({ id: 'cz-fete', prio: 33, icon: ico, text: `${f.name} : apportez un légume à la soupe`, short: lower(f.name), go });
      else if (f.engine === 'etal') out.push({ id: 'cz-fete', prio: 33, icon: ico, text: `${f.name} : présentez votre stand`, short: lower(f.name), go });
      else if (f.engine === 'paniers') out.push({ id: 'cz-fete', prio: 33, icon: ico, text: `${f.name} : trois paniers à offrir`, short: lower(f.name), go });
      else if (f.engine === 'foire') out.push({ id: 'cz-fete', prio: 44, icon: ico, text: 'La foire aux graines est ouverte (−25 %)', short: 'la foire aux graines', go });
    }
    const up = (q('cozy', g)?.upcoming || []).find((x) => x.daysUntil === 1);
    if (up) out.push({ id: 'cz-soon', prio: 84, icon: () => czIcon([up.icon, 'icon.fete'], 'sprite--sm', ENGINE_EMOJI[up.engine] || '🎉'), text: `Demain : ${lower(up.name)}`, short: `${lower(up.name)} demain`, go: () => openFete() });
    const w = q('winter', g);
    if (w) {
      if (w.story?.available && !w.story.heard) out.push({ id: 'cz-story', prio: 60, icon: () => czIcon(['icon.story'], 'sprite--sm', '🕯'), text: 'Ce soir, veillée chez Joseph', short: 'la veillée chez Joseph', go: () => openStory() });
      const finds = w.finds || [];
      if (finds.length) out.push({ id: 'cz-finds', prio: 64, icon: () => czIcon([finds[0].icon, `winter.${finds[0].kind}`], 'sprite--sm', FIND_EMOJI[finds[0].kind] || '🍂'), text: finds.length > 1 ? `${finds.length} trouvailles en lisière` : `Une trouvaille en lisière : ${lower(finds[0].name || '')}`, short: `${plural(finds.length, 'trouvaille')} en lisière`, go: () => showInScene('winterFind', finds[0].id) });
      if (w.feeder?.here && w.feeder.canFill) out.push({ id: 'cz-feeder', prio: 68, icon: () => czIcon(['icon.feeder', 'feeder'], 'sprite--sm', '🐦'), text: 'Remplissez la mangeoire (gratuit)', short: 'la mangeoire', go: () => showInScene('feeder') });
      if (isCareer(g) && SEASON_OF(g) === 'winter') {
        const fair = (q('cozy', g)?.upcoming || []).find((x) => x.engine === 'foire' && x.daysUntil > 1);
        if (fair) out.push({ id: 'cz-spring', prio: 88, icon: () => czIcon(['icon.seedbank'], 'sprite--sm', '🌱'), text: `Préparez le printemps : foire aux graines dans ${plural(fair.daysUntil, 'jour')}`, short: 'préparer le printemps', go: () => openWinter() });
      }
    }
    // F1 : les champs mûrs vous attendent (remplace « N parcelles à récolter »).
    if (isCareer(g) && g.state.cozy?.parts?.helpers) {
      const plots = safe(() => g.query.plots(), []) || [];
      const ripe = plots.filter((p) => p.action === 'harvest' && !p.crow);
      if (ripe.length) {
        const byLot = new Map();
        for (const p of ripe) {
          const k = p.lot ?? 'home';
          if (!byLot.has(k)) byLot.set(k, []);
          byLot.get(k).push(p);
        }
        const [lotId, list] = [...byLot.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        const waiting = list.some((p) => p.wait);
        const name = lotNameOf(g, lotId);
        const pct = Math.round(((safe(() => DATA.cozy?.F1?.handBonus, 1.25) || 1.25) - 1) * 100);
        out.push({
          id: 'cz-ripe',
          replaces: 'harvest',
          prio: 40,
          icon: () => (list[0].cropId ? cropIcon(list[0].cropId, 'sprite--sm') : icon('harvest', 'md')),
          text: waiting ? `${name} : ${plural(list.length, 'parcelle mûre vous attend', 'parcelles mûres vous attendent')} (+${pct} % à la main)` : `${name} : ${plural(list.length, 'parcelle')} à récolter (+${pct} % à la main)`,
          short: `${plural(ripe.length, 'parcelle mûre', 'parcelles mûres')} (+${pct} % à la main)`,
          go: () => app.todo?.focusPlots?.(list.map((p) => p.index), list[0].index, 'harvest'),
        });
      }
    }
    return out;
  }

  // ── Bilan (niveaux) et Carnet (carrière) ─────────────────────────────────────
  function feteLine(f) {
    const when = f.daysUntil === 0 ? 'aujourd\'hui' : f.daysUntil === 1 ? 'demain' : `${season(f.seasonId).toLowerCase()}, jour ${f.day}`;
    return el('div.stats-line', el('span.stats-label', czIcon([f.icon, 'icon.fete'], 'sprite--xs', ENGINE_EMOJI[f.engine] || '🎉'), ` ${f.name}`), el('b.stats-value', when));
  }

  function cozyNodes(g) {
    if (!enabled(g)) return [];
    const nodes = [];
    const cz = q('cozy', g) || {};
    const f = q('fete', g);
    if (f) nodes.push(el('section.stats-section.cz-sec', el('h3.stats-title', feteIcon(f, 'sprite--sm'), `Aujourd'hui : ${f.name}`), el('p.stats-note', f.done ? 'C\'est fait : merci !' : f.text || ''), el('button.btn.btn--wide.v-open', { type: 'button', id: 'cz-sec-fete', onclick: () => openFete() }, f.done ? 'Voir la fête' : 'Participer', el('span.v-chev', { 'aria-hidden': 'true' }, '›'))));
    const up = (cz.upcoming || []).filter((x) => x.daysUntil > 0).slice(0, 3);
    if (up.length) nodes.push(el('section.stats-section.cz-sec', el('h3.stats-title', czIcon(['icon.fete'], 'sprite--sm', '🎉'), 'Les fêtes à venir'), up.map(feteLine)));
    const w = q('winter', g);
    if (w && (SEASON_OF(g) === 'winter' || (w.finds || []).length)) nodes.push(el('section.stats-section.cz-sec', el('h3.stats-title', czIcon(['icon.winter'], 'sprite--sm', '❄'), 'L\'hiver à la ferme'), el('p.stats-note', [(w.finds || []).length ? `${plural(w.finds.length, 'trouvaille')} en lisière` : 'Pas de trouvaille pour l\'instant', w.feeder?.bird ? `${lower(w.feeder.bird.name)} à la mangeoire` : null].filter(Boolean).join(' · ') + '.'), el('button.btn.btn--wide.v-open', { type: 'button', id: 'cz-sec-winter', onclick: () => openWinter() }, 'Voir l\'hiver', el('span.v-chev', { 'aria-hidden': 'true' }, '›'))));
    const L = q('lanterns', g);
    if (L?.criteria?.length) nodes.push(el('section.stats-section.cz-sec', el('h3.stats-title', czIcon(['icon.lantern.on'], 'sprite--sm', '🏮'), `Les lanternes : ${plural(L.total, 'lanterne')} pour l'instant`), el('div.cz-crits.is-compact', { role: 'list' }, L.criteria.map((c) => lanternRow(c))), el('p.stats-note', 'Joseph les allumera le dernier soir de l\'année. Elles ne changent ni les étoiles ni l\'argent.')));
    const bank = cz.seedBank || [];
    if (bank.length) nodes.push(el('section.stats-section.cz-sec', el('h3.stats-title', czIcon(['icon.seedbank'], 'sprite--sm', '🥫'), 'Réserve de graines'), bank.map((b) => el('div.stats-line', el('span.stats-label', cropIcon(b.cropId, 'sprite--xs'), ` ${b.name}`), el('b.stats-value', plural(b.n, 'semis', 'semis'))))));
    return nodes;
  }

  function statsSection(g = app.game) {
    const nodes = cozyNodes(g);
    return nodes.length ? el('div.cz-stats', { id: 'stats-cozy' }, nodes) : null;
  }

  function agendaSections(ui) {
    const g = ui?.game || app.game;
    return cozyNodes(g).filter((n) => !n.querySelector('.cz-crits')).map((n) => {
      n.classList.add('c-sec');
      return n;
    });
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(ev, g) {
    if (!g) return;
    if (ev.type === 'lanternsLit' && enabled(g)) onLanterns(ev, g);
    if (!enabled(g)) return;
    game = g;
    const career = isCareer(g);
    switch (ev.type) {
      case 'feteSoon':
        morning(ev.text || `Demain, ${lower(ev.name || 'une fête')} !`);
        app.toasts.banner?.({ kind: 'season', icon: SEASON_OF(g), title: ev.name || 'Demain, jour de fête', text: ev.text || 'Un petit jeu au doigt, sans chrono.', duration: 4600 });
        break;
      case 'feteStarted': {
        const f = ev.fete || q('fete', g);
        resetSel(f);
        morning(`Aujourd'hui : ${lower(f?.name || 'jour de fête')} !`);
        feteToast = app.toasts.show({ prio: 'info', kind: 'info', key: 'cz-fete', sprite: feteIcon(f, 'sprite--sm'), title: f?.name || 'Jour de fête', text: ev.text || f?.text || 'Venez participer !', actionLabel: 'Voir', onClick: () => openFete(), duration: 6000 });
        break;
      }
      case 'feteFound':
        paintBar();
        break;
      case 'feteDone': {
        const e = grantEcus(ev.ecus);
        if (!app.sheets.isOpen('cz-fete')) {
          app.toasts.show({ prio: 'important', kind: 'money', sprite: czIcon([ev.ribbon ? `ribbon.${ev.ribbon}` : null, 'icon.fete'], 'sprite--sm', '🎉'), title: ev.text || 'Merci pour la fête !', text: `+${fmt(ev.amount || 0)}${e ? ` · +${plural(e, 'écu')}` : ''}`, duration: 4200 });
        }
        if (ev.engine === 'chasse' && feteMode) leaveFeteMode({ silent: true });
        break;
      }
      case 'feteEnded':
        if (feteMode) leaveFeteMode({ silent: true });
        if (ev.helped?.n > 0 || ev.text) app.toasts.show({ kind: ev.helped?.amount ? 'money' : 'info', sprite: portraitOf('portrait.client.lili', 'sprite--sm'), title: 'Le soir de la fête', text: `${ev.text || 'Le village a fini la fête pour vous.'}${ev.helped?.amount ? ` +${fmt(ev.helped.amount)}` : ''}`, duration: 4600 });
        break;
      case 'seedPackBought':
        app.toasts.show({ kind: 'success', sprite: czIcon([`seedbag.${ev.cropId}`, 'seedpack.generic'], 'sprite--sm', '🌱'), text: `Sachet de ${cropName(ev.cropId).toLowerCase()} : ${plural(ev.seeds || 8, 'semis', 'semis')} dans la réserve (${fmt(ev.bank || 0)}).`, duration: 3200 });
        break;
      case 'winterFind':
        if ((ev.finds || []).length) morning('Une trouvaille vous attend en lisière.');
        if (ev.trace) morning('Des traces dans la neige, ce matin…');
        break;
      case 'winterPicked':
        app.toasts.show({ prio: 'important', kind: 'money', key: 'cz-pick', sprite: czIcon([`winter.${ev.kind}`], 'sprite--sm', FIND_EMOJI[ev.kind] || '🍂'), text: `${ev.name || 'Trouvaille'} : +${fmt(ev.amount || 0)}`, duration: 2400 });
        break;
      case 'feederFilled':
        break;
      case 'feederBird':
        morning(`${ev.bird?.name || 'Un oiseau'} est venu à la mangeoire.`);
        if (ev.first) tone('chirp', { volume: 0.7, delay: 0.6 });
        break;
      case 'storyReady':
        morning(ev.text || 'Ce soir, veillée chez Joseph.');
        break;
      case 'storyHeard':
        onStoryHeard();
        break;
      case 'harvested':
        if (career && (!ev.by || ev.by === 'player') && ev.handBonus > 0) {
          const k = dayKey(g);
          if (hand.day !== k && hand.n === 0) hand.day = k;
          hand.n += 1;
          hand.bonus += ev.handBonus;
        }
        break;
      case 'planted':
        if (ev.fromBank && (!ev.by || ev.by === 'player')) app.toasts.show({ kind: 'info', key: 'cz-bank', sprite: czIcon(['icon.seedbank'], 'sprite--sm', '🥫'), text: `Semis pris dans la réserve (reste ${fmt(ev.bankLeft ?? 0)}).`, duration: 2200, log: false });
        break;
      case 'dawn':
        if (career && hand.n > 0) morning(`À la main : ${plural(hand.n, 'récolte')} (+${fmt(hand.bonus)} de prime).`);
        hand.n = 0;
        hand.bonus = 0;
        hand.day = dayKey(g);
        break;
      default:
        break;
    }
    if (live) schedule();
  }

  const SEASON_OF = (g) => ['spring', 'summer', 'autumn', 'winter'][((g?.state?.time?.seasonIndex ?? 0) % 4 + 4) % 4];

  // ── À chaque image ────────────────────────────────────────────────────────────
  function frame() {
    const g = app.game;
    if (feteMode) {
      // Une fenêtre importante (fin de saison, victoire) interrompt le mode fête : les objets restent.
      if (!g || app.inMenu || g.state.status !== 'playing' || app.dialogs.isOpen() || !enabled(g) || q('fete', g)?.engine !== 'chasse') leaveFeteMode({ silent: true });
    }
    if (!g || app.inMenu || !enabled(g)) return;
    const now = performance.now();
    if (now - badgeAt > 500) {
      badgeAt = now;
      if (feteMode) paintBar();
    }
  }

  function reset(g = null) {
    if (feteMode) leaveFeteMode({ silent: true });
    game = g;
    live = null;
    resetSel(null);
    hand.n = 0;
    hand.bonus = 0;
    hand.day = '';
    storyShown = null;
    if (!g || lanternsEv?.game !== g) lanternsEv = null;
    requestAnimationFrame(() => applyRack(g));
  }

  return {
    onEvent,
    frame,
    reset,
    openFete,
    enterFeteMode,
    leaveFeteMode,
    openWinter,
    openStory,
    openLanterns,
    openSeedFair,
    lanternPage,
    lanternRows,
    yearBlock,
    todoItems,
    morningLines: () => [],
    plotRows,
    seedChips,
    statsSection,
    agendaSections,
    lanternSection,
    levelBadge,
    onHit,
    enabled,
    applyRack,
    showHint,
    get feteMode() {
      return feteMode;
    },
    /** Débogage : ce que montre l'interface. */
    debugState: () => ({ live: live?.id || null, feteMode, sel: JSON.parse(JSON.stringify(sel)), hand: { ...hand }, lanterns: lanternsEv ? { total: lanternsEv.ev.total, rec: !!lanternsEv.rec } : null, game: !!game }),
  };
}
