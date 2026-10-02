// Interface du lot 3 « Variété » (docs/GAME_DESIGN.md § 16, contrats : docs/ARCHITECTURE.md « Lot 3 ») :
// tableau du village (C1), cadeau de la saison (C2), charrette du marché (C3), défis de la saison (C4), années à
// thème de la carrière (C5), Basile le colporteur et graines rares (C7).
//
// createVariety(app) → app.variety = {
//   onEvent(ev, game)        main.js (onGameEvent) : messages, sons, récompenses, conseils, pages en attente
//   frame()                  à chaque image : feuille ouverte « vivante », fenêtre de fin de saison de la carrière
//   reset(game|null)         nouvelle partie / retour au menu
//   openBoard(), openCart(), openMerchant(), openCards(), openChallenges(), openTheme()   feuilles du bas
//   onHit(hit) → bool        toucher dans la scène : villageBoard | cart | merchant
//   seasonPages(ev)          niveaux : pages ajoutées à la fenêtre de fin de saison (cadeau, défis)
//   seasonSummary(ev)        niveaux : lignes « La charrette : +30 (2 caisses sur 3) » et médailles du bilan
//   todoItems(game)          lignes de « À faire maintenant » (src/ui/todo.js)
//   statsSection(game)       niveaux : section « Le village » du Bilan (src/ui/panel.js)
//   agendaSections(ui)       carrière : sections du Carnet › Agenda (src/ui/career/journal.js)
//   yearLines(report)        carrière : « L'an prochain : l'année des abeilles ! » (bilan annuel)
//   pendingChoice(game)      un cadeau ou des défis attendent : pastille Bilan / Carnet
//   plotRows(p, sheet)       fiche d'une parcelle : « À la récolte : → Lili (3 / 5) »
//   seedChips(c)             feuille des graines : « Rare · 4 graines », « Offert », « Commande »
//   enabled(game)            la variété est-elle active ? (jamais en Classique sans option)
// }
//
// Règles (§ 16.0) : rien n'apparaît sans `state.variety` (Classique) ; aucune feuille ne s'ouvre toute seule (sauf la
// fenêtre de fin de saison, qui existe déjà, et sa version courte en carrière) ; pas de compte à rebours, pas de
// relance culpabilisante ; feuilles du bas (pause pendant la lecture, src/ui/sheets.js), cibles ≥ 48 px, textes
// ≥ 14 px, portraits 48 px ; lecteurs d'écran (libellés, aria-pressed, barres de progression lues).
// Les requêtes et actions viennent du cœur (CORE) ; tout est protégé : une requête absente → rien d'affiché.

import { el, fmt, plural } from './dom.js';
import { icon, spriteAny } from './icons.js';
import { cropCount, cropName, season } from './text.js';
import { HINTS } from './hints.js';

// Conseils « première fois » (textes de VARIETY_HINTS du cœur s'ils existent, sinon ceux-ci).
const DEFAULT_HINTS = {
  'variety.board': { title: 'Le tableau du village', text: 'Les villageois y épinglent des commandes : récoltez ce qu\'ils demandent, ils paient une prime.' },
  'variety.cart': { title: 'La charrette du marché', text: 'Remplissez ses caisses avec vos récoltes avant son départ : une prime en plus, même à moitié pleine.' },
  'variety.cards': { title: 'Un cadeau pour la saison', text: 'Deux cartes gratuites : gardez celle qui vous plaît. Rien ne presse.' },
  'variety.challenges': { title: 'Les défis de la saison', text: 'Gardez un ou deux défis : chaque palier donne une médaille et des écus.' },
  'variety.merchant': { title: 'Basile le colporteur', text: 'Il passe le 5ᵉ jour de chaque saison avec des graines rares et des objets uniques.' },
  'variety.rare': { title: 'Les graines rares', text: 'Un sachet contient ses graines : semez-les à la main, gratuitement, jusqu\'au bout du sachet.' },
  'career.theme': { title: 'L\'année à thème', text: 'Chaque année a sa vedette (+25 %), sa fête et un visiteur unique qui apporte un cadeau.' },
};
for (const [id, h] of Object.entries(DEFAULT_HINTS)) if (!HINTS[id]) HINTS[id] = { ...h, where: 'game', who: id.startsWith('career.') ? 'joseph' : undefined };

/** Textes du cœur (src/data/variety.js : VARIETY_HINTS), chargés sans casser le jeu s'ils manquent. */
async function loadHintTexts() {
  try {
    const mod = await import('../data/variety.js');
    const H = mod?.VARIETY_HINTS || {};
    for (const [id, h] of Object.entries(H)) {
      const text = typeof h === 'string' ? h : h?.text;
      if (!text) continue;
      HINTS[id] = { ...(HINTS[id] || { where: 'game' }), ...(typeof h === 'object' ? h : {}), text, where: 'game' };
    }
  } catch {
    /* données du lot 3 absentes : textes par défaut */
  }
}

const MEDALS = ['bronze', 'silver', 'gold'];
const MEDAL_NAMES = { bronze: 'bronze', silver: 'argent', gold: 'or' };
const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'];
const CARD_FALLBACK = { purse: 'coin', seedFair: 'seed', fertilizer: 'seed', hen: 'harvest', watering: 'water', clover: 'star', poster: 'coin', landlord: 'bill', bees: 'harvest', crier: 'star', cartHorse: 'harvest', clearing: 'lock', seedBag: 'seed', recipe: 'harvest', hay: 'harvest', almanac: 'calendar' };
const CHALLENGE_FALLBACK = { harvests: 'harvest', sales: 'coin', variety: 'seed', sowing: 'seed', care: 'water', quality: 'star', orders: 'info', crates: 'harvest', products: 'harvest', apples: 'harvest', animals: 'harvest', collect: 'harvest' };

const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

/** « 2 carottes », sans dépendre d'une culture inconnue (graines rares avant le lot CORE). */
function count(cropId, n, name = null) {
  try {
    if (name && cropName(cropId) === cropId) return `${n} ${String(name).toLowerCase()}`;
    return cropCount(cropId, n);
  } catch {
    return `${n} ${String(name || cropId).toLowerCase()}`;
  }
}

/** Nom de la culture sans le nombre (« carottes »). */
/** « attend » / « attendent » (Zoé et Bastien). */
const waits = (name) => (/ et /.test(name || '') ? 'attendent' : 'attend');

/** Nom de la culture sans le nombre. */
function cropWords(cropId, n, name) {
  return count(cropId, Math.max(2, n), name).replace(/^\d+\s/, '');
}

/** Barre de progression lue par les lecteurs d'écran. */
function bar(got, n, label, cls = '') {
  const v = Math.max(0, Math.min(n || 1, got || 0));
  const pct = Math.round((v / Math.max(1, n || 1)) * 100);
  return el(
    `span.v-bar${pct >= 100 ? '.is-full' : ''}${cls ? `.${cls}` : ''}`,
    { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n || 1), 'aria-valuenow': String(v), 'aria-label': label || `${v} sur ${n}` },
    el('span.v-bar-fill', { style: { width: `${pct}%` } }),
  );
}

/** Médaille : sprite medal.<niveau> (repli : pastille dessinée en CSS). */
function medalNode(level, got, cls = '') {
  const name = MEDALS[level - 1] || 'bronze';
  const label = `Médaille ${name === 'silver' ? 'd\'argent' : name === 'gold' ? 'd\'or' : 'de bronze'}${got ? ' obtenue' : ''}`;
  const wrap = el(`span.v-medal.is-${name}${got ? '.is-got' : ''}${cls ? `.${cls}` : ''}`, { role: 'img', 'aria-label': label, title: label });
  const s = spriteAny([got ? `medal.${name}` : 'medal.empty'], 'sprite--sm', 'star');
  if (!s.classList.contains('ico--fallback')) {
    wrap.classList.add('has-sprite');
    wrap.append(s);
  }
  return wrap;
}

export function createVariety(app) {
  loadHintTexts();

  let game = null;
  let live = null; // { id, build: () => node, sig: () => string, lastSig }
  let queued = false;
  const doneToday = new Map(); // orderId → { slot, day, clientId, clientName, thanks, premium, portrait }
  const slotOf = new Map(); // orderId → place sur le tableau (dernier affichage)
  let evening = null; // { day, cart: cartDeparted, judged: challengesJudged, medals: [challengeMedal] }
  const seasonMedals = []; // médailles de la saison en cours (bilan de fin de saison)
  let careerSeason = null; // carrière : fenêtre courte de fin de saison à montrer { at, seasonName }
  let lastBadge = null;
  let badgeAt = 0;

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.state && g.state.variety);
  const isCareer = (g = app.game) => g?.mode === 'career';

  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Variété :', err);
      return fallback;
    }
  }

  /** Requête du lot (orders, cart, cards, challenges, merchant, variety) ; null hors variété. */
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  function theme(g = app.game) {
    if (!enabled(g) || !isCareer(g)) return null;
    const fn = g.query?.career?.theme;
    return typeof fn === 'function' ? safe(() => fn(), null) : null;
  }
  const dayOf = (g = app.game) => {
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

  // ── Récompenses (écus, décors) ────────────────────────────────────────────────
  function grantEcus(n) {
    const v = Math.floor(n || 0);
    if (v > 0) app.progression?.careerEcus?.(v);
    return v;
  }
  function grantCosmetic(id, ecusIfOwned) {
    if (app.lot2?.grantCosmetic) return app.lot2.grantCosmetic(id, ecusIfOwned);
    if (ecusIfOwned) grantEcus(ecusIfOwned);
    return null;
  }
  function morning(text) {
    if (text) app.todo?.morningNote?.(text);
  }
  function hint(id, target = null) {
    app.hints?.maybe?.(id, target);
  }

  // ── Petits dessins ─────────────────────────────────────────────────────────────
  const portraitOf = (name, cls = 'sprite--portrait') => spriteAny([name, 'portrait.joseph'].filter(Boolean), cls, 'star');
  const cropIco = (cropId, cls = 'sprite--sm') => spriteAny([`crop.${cropId}.icon`, `tree.${cropId}.icon`, `crop.${cropId}.4`, `seedbag.${cropId}`], cls, 'seed');
  const cardIco = (c, cls = 'sprite--md') => spriteAny([c?.icon, `icon.card.${c?.id}`].filter(Boolean), cls, CARD_FALLBACK[c?.id] || 'star');
  const challengeIco = (c, cls = 'sprite--md') => spriteAny([c?.icon, `icon.challenge.${c?.id}`].filter(Boolean), cls, CHALLENGE_FALLBACK[c?.id] || 'star');
  const itemIco = (it, cls = 'sprite--md') => spriteAny([it?.icon, `item.${it?.itemId}`, String(it?.itemId || '').startsWith('seeds.') ? `seedbag.${String(it.itemId).slice(6)}` : null].filter(Boolean), cls, 'coin');
  const sectionIco = (name, fallback, cls = 'sprite--sm') => spriteAny([`icon.${name}`], cls, fallback);
  const coin = () => icon('coin', 'sm');

  // ── Feuilles « vivantes » ──────────────────────────────────────────────────────
  /** Ouvre une feuille du lot ; son contenu est reconstruit quand le jeu change (si ce qu'elle montre a changé). */
  function openLive(id, { title, icon: ico, build, sig, tall = true }) {
    const node = safe(build, null) || el('p.sheet-empty', 'Rien pour l\'instant.');
    app.sheets.open({ id, kind: 'popup', tall, title, icon: ico, content: node, className: `v-sheet v-sheet--${id}`, onClose: () => { if (live?.id === id) live = null; } });
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

  // ── Tableau du village (C1) ───────────────────────────────────────────────────
  function boardSig() {
    const o = q('orders');
    return JSON.stringify([o, game?.state?.money >= 0, [...doneToday.keys()]]);
  }

  function keepBtn(o) {
    const kept = !!o.kept || !!o.started;
    return el(
      `button.btn.v-keep${kept ? '.is-on' : ''}`,
      {
        type: 'button',
        id: `v-keep-${o.id}`,
        'aria-pressed': kept ? 'true' : 'false',
        'aria-label': o.started ? `Commande commencée, gardée` : kept ? `Gardée : ne plus garder la commande de ${o.clientName}` : `Garder la commande de ${o.clientName}`,
        onclick: () => {
          app.audio.play('click', { volume: 0.6 });
          const res = act('keepOrder', o.id, !kept);
          if (res?.ok) {
            app.audio.play('toggle');
            app.vibrate?.(10);
          }
        },
      },
      el('span.v-pin', { 'aria-hidden': 'true' }),
      el('span', kept ? 'Gardée' : 'Garder'),
    );
  }

  function declineBtn(o) {
    return el(
      'button.btn.v-x',
      {
        type: 'button',
        id: `v-decline-${o.id}`,
        'aria-label': `Pas pour moi (${o.clientName})`,
        title: 'Pas pour moi',
        onclick: () => {
          app.audio.play('click', { volume: 0.6 });
          const res = act('declineOrder', o.id);
          if (res?.ok) {
            app.audio.play('page', { volume: 0.6 });
            const name = o.clientName || 'Le client';
            app.toasts.show({ kind: res.premium ? 'money' : 'info', sprite: portraitOf(o.portrait, 'sprite--sm'), title: name, text: res.premium ? `Merci pour ce que vous avez déjà livré ! +${fmt(res.premium)}` : 'Pas de souci, une autre fois !', duration: 3200 });
          }
        },
      },
      icon('close', 'md'),
    );
  }

  function orderCard(o, i) {
    slotOf.set(o.id, i);
    const premium = o.premium ?? o.premiumSoFar ?? 0;
    const lines = (o.lines || []).map((l) =>
      el(
        `div.v-line${l.left <= 0 || l.got >= l.n ? '.is-done' : ''}`,
        el('span.v-line-ico', cropIco(l.cropId)),
        el('span.v-line-text', el('b', `${fmt(l.got || 0)} / ${fmt(l.n)}`), ` ${cropWords(l.cropId, l.n, l.cropName)}`),
        bar(l.got, l.n, `${l.got || 0} sur ${l.n} ${cropWords(l.cropId, l.n, l.cropName)}`),
        isCareer() && l.inStock ? el('small.v-stock', `${fmt(l.inStock)} au grenier`) : null,
      ),
    );
    const actions = [];
    if (o.canDeliver) {
      actions.push(
        el(
          'button.btn.btn--red.v-deliver',
          {
            type: 'button',
            id: `v-deliver-${o.id}`,
            onclick: () => {
              const res = act('deliverOrder', o.id);
              if (res?.ok) {
                app.audio.play('coin', { volume: 0.7 });
                app.vibrate?.(12);
              }
            },
          },
          `Livrer depuis le grenier (${fmt(o.deliverCount || 0)})`,
        ),
      );
    }
    return el(
      `article.v-order${o.kept || o.started ? '.is-kept' : ''}`,
      { id: `v-order-${o.id}`, 'aria-label': `${o.clientName}, ${o.clientTitle || ''}` },
      el('div.v-order-head', el('span.v-portrait', portraitOf(o.portrait)), el('div.v-who', el('b.v-name', o.clientName), o.clientTitle ? el('small.v-title', o.clientTitle) : null), el('span.v-premium', { 'aria-label': `Prime ${premium} pièces` }, coin(), el('b', `+${fmt(premium)}`))),
      o.text ? el('p.v-say', `« ${o.text} »`) : null,
      el('div.v-lines', lines),
      o.note ? el('p.v-note', icon('info', 'sm'), o.note) : null,
      el('div.v-order-actions', keepBtn(o), ...actions, declineBtn(o)),
    );
  }

  function emptyCard(slot, i) {
    // Livrée aujourd'hui : le cœur le dit (slot.delivered) ; sinon, ce que l'interface a vu passer (orderDone).
    const seen = [...doneToday.values()].find((d) => (d.slot === i || (slot?.clientId && d.clientId === slot.clientId)) && d.day === dayOf());
    const done = slot?.delivered ? { clientName: slot.clientName, portrait: `portrait.client.${slot.clientId}`, thanks: seen?.thanks || null } : seen;
    if (done) {
      return el(
        'article.v-order.is-done',
        { 'aria-label': `${done.clientName} : commande livrée` },
        el('div.v-order-head', el('span.v-portrait', portraitOf(done.portrait)), el('div.v-who', el('b.v-name', done.clientName), el('small.v-title', 'Commande livrée')), el('span.v-check', { 'aria-hidden': 'true' }, '✓')),
        done.thanks ? el('p.v-say', `« ${done.thanks} »`) : null,
        el('p.v-empty-text', 'Nouvelle demande demain matin.'),
      );
    }
    return el('article.v-order.is-empty', el('span.v-empty-pin', { 'aria-hidden': 'true' }), el('p.v-empty-text', slot?.text || 'Nouvelle demande demain matin.'));
  }

  function boardContent() {
    const o = q('orders');
    if (!o) return el('p.sheet-empty', 'Le tableau du village est vide.');
    if (o.startsIn > 0) {
      return el('div.v-board', el('p.v-lead', `Les villageois épingleront leurs premières commandes ${o.startsIn === 1 ? 'demain' : `dans ${plural(o.startsIn, 'jour')}`}.`));
    }
    const slots = o.slots || [];
    const reroll = el(
      `button.btn.btn--wide.v-reroll${o.canReroll ? '' : '.is-disabled'}`,
      {
        type: 'button',
        id: 'v-reroll',
        'aria-disabled': o.canReroll ? 'false' : 'true',
        onclick: () => {
          if (!o.canReroll) {
            refused(o.rerollReason || 'Une seule relance par jour : revenez demain.');
            return;
          }
          const res = act('rerollOrders');
          if (res?.ok) app.audio.play('page', { volume: 0.7 });
        },
      },
      el('span.v-reroll-ico', { 'aria-hidden': 'true' }, '↻'),
      o.canReroll ? 'Autres demandes (gratuit)' : 'Autres demandes : demain',
    );
    return el(
      'div.v-board',
      el('p.v-lead', 'Récoltez ce qu\'ils demandent : payé tout de suite, et la prime quand c\'est complet.'),
      el('div.v-orders', { role: 'list' }, slots.map((s, i) => el('div', { role: 'listitem' }, s && !s.empty && s.id ? orderCard(s, i) : emptyCard(s, i)))),
      reroll,
    );
  }

  function openBoard() {
    if (!enabled()) return false;
    const r = openLive('v-board', { title: 'Le tableau du village', icon: sectionIco('board', 'info', 'sprite--md'), build: boardContent, sig: boardSig });
    hint('variety.board', { selector: '#v-reroll' });
    return r;
  }

  // ── Charrette du marché (C3) ──────────────────────────────────────────────────
  function cartContent() {
    const c = q('cart');
    if (!c) return el('div.v-cart', el('p.v-lead', 'La charrette du marché passe au début de chaque saison. À la saison prochaine !'));
    const rows = (c.crates || []).map((k, i) =>
      el(
        `div.v-crate${k.full ? '.is-full' : ''}`,
        { id: `v-crate-${i}` },
        el('span.v-crate-ico', cropIco(k.cropId, 'sprite--md')),
        el('div.v-crate-main', el('b', capitalize(cropWords(k.cropId, k.n, k.cropName))), el('div.v-crate-prog', bar(k.got, k.n, `${k.got || 0} sur ${k.n}`), el('span.v-crate-num', `${fmt(k.got || 0)} / ${fmt(k.n)}`))),
        k.full
          ? el('span.v-check', { 'aria-label': 'Caisse pleine' }, '✓')
          : isCareer() && (k.canLoad || k.inStock)
            ? el(
                `button.btn.btn--red.v-load${k.canLoad ? '' : '.is-disabled'}`,
                {
                  type: 'button',
                  id: `v-load-${i}`,
                  'aria-label': `Charger depuis le grenier (${Math.min(k.inStock || 0, k.n - (k.got || 0))})`,
                  onclick: () => {
                    if (!k.canLoad) return refused('Rien au grenier pour cette caisse.');
                    const res = act('loadCart', i);
                    if (res?.ok) {
                      app.audio.play('coin', { volume: 0.7 });
                      if (res.full) app.audio.tone?.('pop', { volume: 0.8 });
                    }
                  },
                },
                `Charger (${fmt(Math.min(k.inStock || 0, k.n - (k.got || 0)))})`,
              )
            : null,
      ),
    );
    const ecus = c.ecusFull || 0;
    return el(
      'div.v-cart',
      el('p.v-lead', `${c.departText || 'Part le soir du dernier jour'}. Vos récoltes à la main y vont toutes seules.`),
      el('div.v-crates', rows),
      el(
        'div.v-cart-pay',
        el('div', coin(), el('span', 'Prime au départ : '), el('b', `+${fmt(c.premiumNow || 0)}`)),
        el('div', icon('star', 'sm'), el('span', 'Tout plein : '), el('b', `+${fmt(c.premiumFull || 0)}`), ecus ? el('span', ' et ', el('b', plural(ecus, 'écu'))) : null),
        c.horse ? el('small.v-note', 'Cheval de renfort : prime ×2.') : null,
      ),
    );
  }

  function openCart() {
    if (!enabled()) return false;
    const r = openLive('v-cart', { title: 'La charrette du marché', icon: sectionIco('cart', 'harvest', 'sprite--md'), build: cartContent, sig: () => JSON.stringify(q('cart')), tall: false });
    hint('variety.cart', null);
    return r;
  }

  // ── Basile le colporteur (C7) ─────────────────────────────────────────────────
  function buyItem(it, m) {
    if (it.sold) return;
    if (!it.canBuy) return refused(it.reason || 'Pas possible pour l\'instant.');
    const money = Math.max(0, app.game.state.money);
    const go = () => {
      const res = act('buyFromMerchant', it.itemId);
      if (res?.ok) {
        app.audio.play('buy');
        app.audio.tone?.('magic', { volume: 0.6, delay: 0.1 });
        app.vibrate?.(12);
      }
    };
    if (it.price > money * 0.5) {
      app.dialogs
        .confirm({ title: `${it.name} ?`, text: `${plural(it.price, 'pièce')} sur vos ${fmt(money)}. Il vous restera ${plural(money - it.price, 'pièce')}.`, ok: `Acheter (${fmt(it.price)})`, cancel: 'Annuler' })
        .then((ok) => {
          if (ok && app.game) go();
        });
    } else go();
    void m;
  }

  function merchantContent() {
    const m = q('merchant');
    const head = (line) => el('div.v-merchant-head', el('span.v-portrait', portraitOf(m?.portrait || 'portrait.merchant')), el('div', el('b.v-name', m?.name || 'Basile le colporteur'), el('p.v-say', `« ${line} »`)));
    if (!m || (!m.here && !m.soon)) return el('div.v-merchant', head('Je passe le 5ᵉ jour de chaque saison. À bientôt !'));
    if (!m.here) {
      const when = m.daysUntil === 1 ? 'demain' : m.daysUntil > 1 ? `dans ${plural(m.daysUntil, 'jour')}` : 'bientôt';
      return el('div.v-merchant', head(m.daysUntil === 1 ? 'Je serai là demain, avec des trésors de la route !' : 'Je passe le 5ᵉ jour de chaque saison. À bientôt !'), el('p.v-lead', `Basile passe ${when} : il restera deux jours.`));
    }
    const tiles = (m.stall || []).map((it) =>
      el(
        `article.v-item${it.sold ? '.is-sold' : ''}${!it.sold && !it.canBuy ? '.is-off' : ''}`,
        { id: `v-item-${String(it.itemId).replace(/\W/g, '-')}` },
        el('span.v-item-ico', itemIco(it)),
        el('div.v-item-main', el('b', it.name), it.unique ? el('small.v-unique', 'Objet unique') : null, el('small', it.text || '')),
        it.sold
          ? el('span.v-sold', 'Vendu')
          : el(`button.btn.v-buy${it.canBuy ? '.btn--red' : '.is-disabled'}`, { type: 'button', 'aria-disabled': it.canBuy ? 'false' : 'true', 'aria-label': `Acheter ${it.name} pour ${it.price} pièces`, onclick: () => buyItem(it, m) }, coin(), fmt(it.price)),
      ),
    );
    return el(
      'div.v-merchant',
      head(m.line || 'Des trésors de la route, pour aujourd\'hui et demain !'),
      el('div.v-stall', tiles),
      el('p.sheet-hint', m.daysLeft > 0 ? 'Il repart demain soir.' : 'Il repart ce soir.'),
    );
  }

  function openMerchant() {
    if (!enabled()) return false;
    const r = openLive('v-merchant', { title: 'Basile le colporteur', icon: sectionIco('merchant', 'coin', 'sprite--md'), build: merchantContent, sig: () => JSON.stringify([q('merchant'), Math.floor((app.game?.state.money || 0) / 5)]) });
    hint('variety.merchant', null);
    return r;
  }

  // ── Cadeau de la saison (C2) ──────────────────────────────────────────────────
  function cardTile(c, onPick, { big = true } = {}) {
    return el(
      `button.v-card${big ? '.is-big' : ''}`,
      { type: 'button', id: `v-card-${c.id}`, 'aria-label': `Garder la carte ${c.name} : ${c.text}`, onclick: (e) => onPick(c, e.currentTarget) },
      el('span.v-card-ico', cardIco(c, 'sprite--card')),
      el('b.v-card-name', c.name),
      el('span.v-card-text', c.text),
      c.kind === 'now' ? el('small.v-card-kind', 'Tout de suite') : c.kind === 'next' ? el('small.v-card-kind', 'La prochaine fois') : el('small.v-card-kind', 'Toute la saison suivante'),
    );
  }

  /** Garde une carte (animation, son) ; then() après l'animation. */
  function pick(c, node, then) {
    const res = act('pickCard', c.id);
    if (!res?.ok) return false;
    node?.classList.add('is-picked');
    node?.parentElement?.classList.add('has-picked');
    app.audio.tone?.('reveal', { volume: 0.8 });
    app.vibrate?.([12, 40, 12]);
    setTimeout(() => then?.(), app.reducedMotion?.() ? 120 : 650);
    return true;
  }

  function activeEffects(list) {
    if (!list?.length) return null;
    return el(
      'div.v-effects',
      el('h3.stats-title', 'Effets en cours'),
      list.map((e) => el('div.v-effect', cardIco(e, 'sprite--sm'), el('span', el('b', e.name), e.text ? ` · ${e.text}` : ''), e.daysLeft !== undefined && e.daysLeft !== null ? el('small', e.daysLeft <= 0 ? 'dernier jour' : `encore ${plural(e.daysLeft + 1, 'jour')}`) : null)),
    );
  }

  function cardsContent() {
    const c = q('cards');
    const v = q('variety');
    const offer = c?.offer;
    const parts = [];
    if (offer?.options?.length) {
      parts.push(el('p.v-lead', `Pour ${season(seasonIdOf(offer), 'the') || 'la saison'} : touchez la carte à garder.`));
      parts.push(el('div.v-cards', offer.options.map((o) => cardTile(o, (card, node) => pick(card, node, () => app.sheets.close())))));
    } else parts.push(el('p.v-lead', 'Pas de cadeau à choisir pour l\'instant : il y en a un à la fin de chaque saison.'));
    parts.push(activeEffects(v?.effects || c?.active));
    return el('div.v-cards-page', parts);
  }

  function seasonIdOf(x) {
    if (!x) return null;
    if (x.seasonId) return x.seasonId;
    if (Number.isInteger(x.season)) return SEASON_IDS[((x.season % 4) + 4) % 4];
    return null;
  }

  function openCards() {
    if (!enabled()) return false;
    return openLive('v-cards', { title: 'Un cadeau pour la saison', icon: sectionIco('cards', 'star', 'sm'), build: cardsContent, sig: () => JSON.stringify([q('cards'), q('variety')?.effects]) });
  }

  // ── Défis de la saison (C4) ───────────────────────────────────────────────────
  function challengeCard(c, { canKeepMore = true, onToggle = null, compact = false } = {}) {
    const [b, s, gTarget] = c.targets || [1, 2, 3];
    const next = c.medal >= 3 ? gTarget : (c.targets || [])[c.medal || 0] ?? gTarget;
    const can = c.kept || canKeepMore;
    return el(
      `article.v-challenge${c.kept ? '.is-kept' : ''}${c.locked ? '.is-locked' : ''}${compact ? '.is-compact' : ''}`,
      { id: `v-ch-${c.id}` },
      el('span.v-ch-ico', challengeIco(c)),
      el(
        'div.v-ch-main',
        el('b', c.name),
        c.text ? el('small', c.text) : null,
        el('div.v-ch-prog', bar(Math.min(c.progress || 0, next), next, `${c.progress || 0} sur ${next}`), el('span.v-ch-num', `${fmt(Math.min(c.progress || 0, gTarget))} / ${fmt(next)}`)),
        el('div.v-medals', [1, 2, 3].map((lv) => el('span.v-medal-slot', medalNode(lv, (c.medal || 0) >= lv), el('small', fmt([b, s, gTarget][lv - 1]))))),
      ),
      el(
        `button.btn.v-ch-keep${c.kept ? '.is-on' : ''}${!can || (c.kept && c.locked) ? '.is-disabled' : ''}`,
        {
          type: 'button',
          id: `v-ch-keep-${c.id}`,
          'aria-pressed': c.kept ? 'true' : 'false',
          'aria-label': c.kept ? `Défi gardé : ${c.name}` : `Garder le défi ${c.name}`,
          onclick: () => {
            if (c.kept && c.locked) return refused('Ce défi a déjà une médaille.');
            if (!can) return refused('Deux défis au plus.');
            const res = act('keepChallenge', c.id, !c.kept);
            if (res?.ok) {
              app.audio.play('toggle');
              app.vibrate?.(10);
              onToggle?.();
            }
          },
        },
        c.kept ? '✓ Gardé' : 'Garder',
      ),
    );
  }

  function challengesContent() {
    const ch = q('challenges');
    if (!ch) return el('p.v-lead', 'Les défis arrivent avec la saison prochaine.');
    const parts = [];
    if (ch.options?.length) {
      parts.push(el('p.v-lead', `${capitalize(ch.seasonName || season(seasonIdOf(ch)) || 'Cette saison')} : gardez 1 ou 2 défis. Tout compte depuis le 1ᵉʳ jour.`));
      parts.push(el('div.v-challenges', ch.options.map((c) => challengeCard(c, { canKeepMore: ch.canKeepMore }))));
    }
    if (ch.next?.options?.length) {
      parts.push(el('h3.stats-title', `Pour ${lower(ch.next.seasonName || 'la saison suivante')}`));
      parts.push(el('div.v-challenges', ch.next.options.map((c) => challengeCard(c, { canKeepMore: (ch.next.options.filter((x) => x.kept).length < 2) }))));
    }
    if (!parts.length) parts.push(el('p.v-lead', 'Pas de défi cette saison.'));
    return el('div.v-challenges-page', parts);
  }

  function openChallenges() {
    if (!enabled()) return false;
    const ch = q('challenges');
    const title = ch?.seasonName ? `Les défis ${seasonOfTitle(ch)}` : 'Les défis de la saison';
    const r = openLive('v-challenges', { title, icon: sectionIco('challenge', 'star', 'sm'), build: challengesContent, sig: () => JSON.stringify(q('challenges')) });
    hint('variety.challenges', null);
    return r;
  }

  /** « de l'été », « du printemps »… */
  function seasonOfTitle(x) {
    const id = seasonIdOf(x);
    if (id) return season(id, 'of');
    return x?.seasonName ? `— ${x.seasonName}` : 'de la saison';
  }

  // ── Thème de l'année (C5, carrière) ───────────────────────────────────────────
  function themeBlock(t, { full = true } = {}) {
    if (!t) return null;
    const star = t.star?.names?.length ? `${t.star.names.join(', ')} : +${Math.round(((t.star.factor || 1.25) - 1) * 100)} % toute l'année` : null;
    const fest = t.festival;
    const vis = t.visitor;
    return el(
      'div.v-theme',
      t.id
        ? el('div.v-theme-head', spriteAny([t.icon, `icon.theme.${t.id}`].filter(Boolean), 'sprite--md', 'star'), el('div', el('b.v-name', t.name), t.text ? el('small', t.text) : null))
        : el('p.v-lead', 'L\'année de l\'installation : pas de thème cette année.'),
      t.id && star ? el('div.v-theme-line', icon('star', 'sm'), el('span', 'Vedette : ', el('b', star))) : null,
      t.id && full ? (t.effects || []).map((x) => el('div.v-theme-line', el('span.v-dot', { 'aria-hidden': 'true' }), el('span', x))) : null,
      t.id && fest ? el('div.v-theme-line', icon('calendar', 'sm'), el('span', el('b', fest.name), ` · ${season(fest.seasonId).toLowerCase()}, jour ${fest.day}`, fest.done ? ' ✓' : fest.daysUntil === 0 ? ' : aujourd\'hui !' : fest.daysUntil > 0 ? ` (dans ${plural(fest.daysUntil, 'jour')})` : '')) : null,
      t.id && vis ? el('div.v-theme-line', portraitOf(vis.portrait, 'sprite--sm'), el('span', el('b', vis.name), vis.done ? ' est passé(e) ✓' : ` · ${season(vis.seasonId).toLowerCase()}, jour ${vis.day}`)) : null,
      t.next ? el('p.v-theme-next', `L'an prochain : ${lower(t.next.name)} !`) : null,
    );
  }

  function openTheme() {
    const t = theme();
    if (!t) return false;
    app.sheets.open({ id: 'v-theme', kind: 'popup', title: t.id ? t.name : 'Année de l\'installation', icon: sectionIco('theme', 'star', 'sm'), content: themeBlock(t), className: 'v-sheet' });
    return true;
  }

  // ── Fin de saison (cadeau et défis) ───────────────────────────────────────────
  /** Lignes du bilan de saison : charrette, médailles. */
  function seasonSummary() {
    if (!enabled()) return null;
    const ev = evening && (evening.day === dayOf() || performance.now() - (evening.at || 0) < 120000) ? evening : null;
    const nodes = [];
    const cart = ev?.cart;
    if (cart) {
      const n = (cart.crates || []).filter((k) => k.got >= k.n).length;
      const total = (cart.crates || []).length;
      nodes.push(
        el(
          'p.v-sum-line',
          sectionIco('cart', 'harvest'),
          cart.units > 0 ? el('span', 'La charrette : ', el('b.pos', `+${fmt(cart.premium || 0)}`), ` (${plural(n, 'caisse pleine', 'caisses pleines')} sur ${total})`, cart.ecus ? ` et ${plural(cart.ecus, 'écu')}` : '') : el('span', 'La charrette est repartie à vide. À la saison prochaine !'),
        ),
      );
    }
    const medals = (ev?.medals || seasonMedals).slice();
    if (medals.length) {
      nodes.push(el('div.v-sum-medals', el('span', 'Médailles :'), medals.map((m) => el('span.v-sum-medal', medalNode(MEDALS.indexOf(m.medal) + 1, true), el('small', m.name)))));
    }
    return nodes.length ? el('div.v-season-sum', nodes) : null;
  }

  /**
   * Pages de la fenêtre de fin de saison (après le bilan) : [{ id, title, body(next), actions(next) }].
   * Niveaux : dialogs.seasonEnd les enchaîne ; carrière : fenêtre courte ouverte par frame().
   */
  function seasonPages() {
    if (!enabled()) return [];
    const pages = [];
    const c = q('cards');
    if (c?.offer?.options?.length) {
      const offer = c.offer;
      pages.push({
        id: 'cards',
        title: 'Un cadeau pour la saison',
        body: (next) => {
          let done = false;
          return el(
            'div.v-page.v-cards-page',
            el('p.v-lead', `Pour ${season(seasonIdOf(offer), 'the') || lower(offer.seasonName) || 'la saison suivante'}, le village vous offre une carte : touchez celle à garder.`),
            el('div.v-cards', offer.options.map((o) => cardTile(o, (card, node) => {
              if (done) return;
              if (pick(card, node, next)) done = true;
            }))),
          );
        },
        actions: (next) => [app.dialogs.btn('Plus tard', () => {
          later('cards');
          next();
        }, '', { id: 'v-cards-later' })],
      });
    }
    const ch = q('challenges');
    // Défis de la saison suivante ; si l'aube est déjà passée (même mise à jour que le soir), ceux de la nouvelle
    // saison tant qu'aucun n'est gardé.
    const nx = ch?.next?.options?.length ? ch.next : ch?.options?.length && !(ch.kept || []).length ? ch : null;
    if (nx) {
      pages.push({
        id: 'challenges',
        title: `Les défis ${seasonOfTitle(nx)}`,
        body: () => challengesPage(),
        actions: (next) => [
          app.dialogs.btn('Plus tard', () => {
            later('challenges');
            next();
          }, '', { id: 'v-ch-later' }),
          app.dialogs.btn(['C\'est parti', icon('play', 'sm')], () => next(), 'btn--red', { id: 'v-ch-ok', 'data-autofocus': '' }),
        ],
      });
    }
    return pages;
  }

  /** Page « Les défis de … » (fenêtre de fin de saison) : reconstruite en place à chaque choix. */
  function challengesPage() {
    const wrap = el('div.v-page.v-challenges-page');
    const paint = () => {
      const ch = q('challenges');
      const nx = ch?.next?.options?.length ? ch.next : ch;
      const list = nx?.options || [];
      const keptN = list.filter((x) => x.kept).length;
      wrap.replaceChildren(
        el('p.v-lead', 'Gardez 1 ou 2 défis (vous pourrez changer d\'avis) : chaque palier donne une médaille.'),
        el('div.v-challenges', list.map((c) => challengeCard(c, { canKeepMore: keptN < 2, onToggle: paint }))),
      );
    };
    paint();
    return wrap;
  }

  function later(kind) {
    const where = isCareer() ? 'le Carnet (Agenda)' : 'le Bilan';
    app.toasts.show({ kind: 'info', icon: 'star', key: `v-later-${kind}`, title: kind === 'cards' ? 'Votre cadeau attend' : 'Les défis attendent', text: `Retrouvez-${kind === 'cards' ? 'le' : 'les'} dans ${where}.`, duration: 3600, log: false });
    if (kind === 'cards') hint('variety.cards', null);
  }

  /** Carrière : fenêtre courte de fin de saison (charrette, médailles, cadeau, défis). */
  function openCareerSeason() {
    const pages = seasonPages();
    const sum = seasonSummary();
    if (!pages.length && !sum) return false;
    let idx = 0;
    let first = true;
    const show = (p) => {
      const node = app.dialogs.frame({ title: p.title, ribbon: 'ribbon', cls: 'dialog--season.dialog--variety', body: p.body(next), actions: p.actions(next) });
      app.dialogs.open(node, { id: 'v-season', pauses: true, replace: !first, sound: first });
      first = false;
    };
    function next() {
      if (idx < pages.length) show(pages[idx++]);
      else if (app.dialogs.top() === 'v-season') app.dialogs.closeTop();
    }
    if (sum) {
      show({
        title: careerSeason?.title || 'Fin de la saison',
        body: () => el('div.v-page', sum),
        actions: (nx) => [app.dialogs.btn(['Continuer', icon('play', 'sm')], () => nx(), 'btn--red', { id: 'v-season-next', 'data-autofocus': '' })],
      });
    } else next();
    return true;
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function medalText(m) {
    const name = m.medal === 'gold' ? 'd\'or' : m.medal === 'silver' ? 'd\'argent' : 'de bronze';
    const gain = [m.coins ? `+${plural(m.coins, 'pièce')}` : null, m.ecus ? `+${plural(m.ecus, 'écu')}` : null].filter(Boolean).join(' · ');
    return { title: `Médaille ${name} : ${m.name || 'défi'}`, text: gain || 'Bravo !' };
  }

  function onEvent(ev, g) {
    if (!g || !enabled(g)) return;
    game = g;
    const career = isCareer(g);
    switch (ev.type) {
      case 'ordersRenewed': {
        const n = ev.added ?? (ev.slots || []).filter(Boolean).length;
        if (ev.reason === 'dawn' && n > 0) morning(`${n > 1 ? `${n} nouvelles commandes` : 'Une nouvelle commande'} au tableau du village.`);
        if (ev.reason === 'start' && n > 0) {
          app.toasts.show({ kind: 'info', sprite: sectionIco('board', 'info'), title: 'Le tableau du village', text: 'Des villageois ont épinglé des commandes : touchez le panneau.', onClick: () => openBoard(), duration: 5200 });
          hint('variety.board', null);
        }
        break;
      }
      case 'orderProgress':
        app.audio.play('page', { volume: 0.45, throttle: 160 });
        break;
      case 'orderDone': {
        const slot = slotOf.get(ev.orderId);
        doneToday.set(ev.orderId, { slot: slot ?? -1, day: dayOf(g), clientId: ev.clientId, clientName: ev.clientName, thanks: ev.thanks, premium: ev.premium, portrait: `portrait.client.${ev.clientId}` });
        app.audio.tone?.('chime', { volume: 0.85, delay: 0.1 });
        app.audio.play('coin', { delay: 0.35, volume: 0.7 });
        app.vibrate?.([14, 50, 14]);
        app.toasts.show({ kind: 'money', sprite: portraitOf(`portrait.client.${ev.clientId}`, 'sprite--sm'), title: `${ev.clientName || 'Commande'} : merci !`, text: `${ev.thanks ? `« ${ev.thanks} » ` : ''}Prime : +${fmt(ev.premium || 0)}`, duration: 4600 });
        break;
      }
      case 'orderRemoved':
        if (ev.reason === 'withdrawn') app.toasts.show({ kind: ev.premium ? 'money' : 'info', sprite: sectionIco('board', 'info'), title: ev.clientName || 'Le tableau du village', text: ev.premium ? `La saison est passée : je prends ce que vous avez, merci ! +${fmt(ev.premium)}` : 'La saison est passée : ma commande est retirée. À bientôt !', duration: 4200 });
        break;
      case 'cartArrived':
        // Même mise à jour que la fin de saison (niveaux : la fenêtre du bilan arrive) : seulement le résumé du matin.
        if (!(evening && evening.day && !career && seasonFlip(g))) app.toasts.show({ kind: 'info', sprite: sectionIco('cart', 'harvest'), title: 'La charrette du marché', text: ev.text || 'Elle attend vos récoltes jusqu\'au dernier soir de la saison.', onClick: () => openCart(), duration: 5200 });
        morning('La charrette du marché est arrivée.');
        app.audio.play('page', { volume: 0.5, delay: 0.6 });
        hint('variety.cart', null);
        break;
      case 'cartProgress':
        break;
      case 'crateFull':
        app.audio.tone?.('pop', { volume: 0.85 });
        app.toasts.show({ kind: 'success', sprite: cropIco(ev.cropId), text: `Caisse pleine (${cropWords(ev.cropId, 2)}) !`, duration: 2600 });
        break;
      case 'cartDeparted': {
        evening = { ...(evening && evening.day === dayOf(g) ? evening : {}), day: dayOf(g), cart: ev, at: performance.now() };
        const e = grantEcus(ev.ecus);
        if (!career) {
          // Niveaux : la fenêtre de fin de saison le dit (ligne de la charrette) ; juste le son.
          if (ev.allFull) app.audio.tone?.('fanfare', { volume: 0.85, throttle: 400 });
          else if (ev.units > 0) app.audio.play('coin', { volume: 0.7 });
        } else if (ev.units > 0) {
          if (ev.allFull) {
            app.audio.tone?.('fanfare', { volume: 0.85, throttle: 400 });
            app.vibrate?.([20, 60, 20, 60, 30]);
          } else app.audio.play('coin', { volume: 0.7 });
          app.toasts.show({ kind: 'money', sprite: sectionIco('cart', 'harvest'), title: ev.allFull ? 'La charrette part, toute pleine !' : 'La charrette repart', text: `${ev.text ? `${ev.text} ` : ''}+${fmt(ev.premium || 0)}${e ? ` et ${plural(e, 'écu')}` : ''}`, duration: 4600 });
        } else {
          app.toasts.show({ kind: 'info', sprite: sectionIco('cart', 'harvest'), text: ev.text || 'La charrette repart. À la saison prochaine !', duration: 3200 });
        }
        break;
      }
      case 'cardsOffered':
        hint('variety.cards', null);
        if (career) careerSeason = { at: performance.now() + 400, title: endTitle(g) };
        break;
      case 'cardPicked': {
        const c = ev.card || {};
        let extra = '';
        if (ev.amount) extra = ` +${plural(ev.amount, 'pièce')}`;
        if (ev.gift?.cosmeticId) grantCosmetic(ev.gift.cosmeticId, ev.gift.ecusIfOwned);
        if (ev.gift?.ecus) grantEcus(ev.gift.ecus);
        if (!app.dialogs.isOpen()) app.toasts.show({ kind: ev.amount ? 'money' : 'success', sprite: cardIco(c, 'sprite--sm'), title: `Carte gardée : ${c.name || ''}`.trim(), text: `${c.text || ''}${extra}`, duration: 4200 });
        break;
      }
      case 'cardEnded':
        app.messages?.add?.({ kind: 'info', title: 'Fin d\'un effet', text: `${ev.name || 'Une carte'} : c'est terminé.` });
        break;
      case 'challengesOffered':
        hint('variety.challenges', null);
        if (career) careerSeason = careerSeason || { at: performance.now() + 400, title: endTitle(g) };
        break;
      case 'challengeMedal': {
        const e = grantEcus(ev.ecus);
        seasonMedals.push({ medal: ev.medal, name: ev.name, challengeId: ev.challengeId });
        const t = medalText({ ...ev, ecus: e });
        app.audio.tone?.(ev.medal === 'gold' ? 'fanfare' : 'chime', { volume: 0.85, throttle: 300 });
        app.vibrate?.(ev.medal === 'gold' ? [20, 60, 20, 60, 30] : [12, 40, 12]);
        app.toasts.show({ kind: 'achievement', sprite: medalSprite(ev.medal), title: t.title, text: t.text, onClick: () => openChallenges(), duration: 5000 });
        break;
      }
      case 'challengesJudged':
        evening = { ...(evening && evening.day === dayOf(g) ? evening : {}), day: dayOf(g), judged: ev, medals: seasonMedals.slice(), at: performance.now() };
        break;
      case 'merchantSoon':
        morning(ev.text || 'Demain, Basile le colporteur passe à la ferme.');
        app.toasts.show({ kind: 'info', sprite: portraitOf('portrait.merchant', 'sprite--sm'), title: 'Basile le colporteur', text: ev.text || 'Demain, Basile le colporteur passe à la ferme.', duration: 4200 });
        break;
      case 'merchantArrived':
        app.audio.tone?.('magic', { volume: 0.7, delay: 0.5 });
        app.toasts.show({ kind: 'info', sprite: portraitOf('portrait.merchant', 'sprite--sm'), title: 'Basile le colporteur est là', text: `${ev.text || 'Jusqu\'à demain soir.'} Touchez pour voir son étal.`, onClick: () => openMerchant(), duration: 6000 });
        morning('Basile le colporteur est là (jusqu\'à demain soir).');
        hint('variety.merchant', null);
        break;
      case 'merchantLeft':
        if (live?.id === 'v-merchant' && app.sheets.current === 'v-merchant') app.sheets.close();
        break;
      case 'merchantBought': {
        let text = '';
        if (ev.cosmeticId) {
          const r = grantCosmetic(ev.cosmeticId, ev.ecusIfOwned);
          text = r?.already && ev.ecusIfOwned ? `Vous l'aviez déjà : +${plural(ev.ecusIfOwned, 'écu')} à la place.` : 'Posez-le avec « Décorer la ferme ».';
        } else if (ev.ecusIfOwned) grantEcus(ev.ecusIfOwned);
        app.toasts.show({ kind: 'success', sprite: itemIco({ itemId: ev.itemId }, 'sprite--sm'), title: `${ev.name || 'Objet'} acheté`, text: text || `−${plural(ev.price || 0, 'pièce')}`, duration: 3600 });
        if (String(ev.itemId || '').startsWith('seeds.')) hint('variety.rare', null);
        break;
      }
      case 'themeAnnounced':
        break;
      case 'themeStarted': {
        const t = ev.theme || {};
        app.toasts.banner?.({ kind: 'season', icon: 'spring', title: t.name || 'Une nouvelle année', text: t.text || (t.star?.names?.length ? `Vedette : ${t.star.names.join(', ')} (+25 %)` : ''), duration: 5200 });
        hint('career.theme', null);
        break;
      }
      case 'offerResolved':
        if (ev.kind === 'themeVisitor' && ev.gift?.cosmeticId) grantCosmetic(ev.gift.cosmeticId, ev.gift.ecusIfOwned);
        if (ev.kind === 'themeVisitor' && ev.gift?.ecus) grantEcus(ev.gift.ecus);
        break;
      case 'planted':
        if (ev.rare) {
          hint('variety.rare', null);
          if (ev.seedsLeft === 0) app.toasts.show({ kind: 'info', sprite: cropIco(ev.cropId), text: 'Dernière graine du sachet semée.', duration: 2600 });
        }
        break;
      case 'dawn':
        if (ev.varietyWatered?.length) morning(`L'arrosoir a arrosé ${plural(ev.varietyWatered.length, 'parcelle')} cette nuit.`);
        break;
      case 'seasonStart':
        seasonMedals.length = 0;
        break;
      default:
        break;
    }
    if (live) schedule();
  }

  /** Le soir de fin de saison et l'aube suivante arrivent dans la même mise à jour. */
  function seasonFlip(g) {
    return !!evening && performance.now() - (evening.at || 0) < 1500 && !!g;
  }

  function endTitle(g) {
    const id = SEASON_IDS[g?.state?.time?.seasonIndex] || safe(() => g.query.calendar().seasonId, null);
    return id ? season(id, 'end') : 'Fin de la saison';
  }

  function medalSprite(medal) {
    return spriteAny([`medal.${medal}`], 'sprite--sm', 'star');
  }

  // ── Toucher dans la scène ─────────────────────────────────────────────────────
  function onHit(hit) {
    if (!hit || !enabled()) return false;
    if (hit.type === 'villageBoard') return openBoard();
    if (hit.type === 'cart') return openCart();
    if (hit.type === 'merchant') return openMerchant();
    if (hit.type === 'themeVisitor' && hit.offerId !== undefined && app.careerUI?.open?.offer) {
      app.careerUI.open.offer(hit.offerId);
      return true;
    }
    return false;
  }

  // ── « À faire maintenant » ────────────────────────────────────────────────────
  function todoItems(g = app.game) {
    if (!enabled(g)) return [];
    const out = [];
    const career = isCareer(g);
    const v = q('variety', g);
    const o = v?.board || q('orders', g);
    const orders = (o?.slots || []).filter((s) => s && !s.empty && s.id);
    if (orders.length) {
      const deliverable = orders.find((x) => x.canDeliver);
      if (career && deliverable) {
        out.push({ id: 'v-deliver', prio: 36, icon: () => portraitOf(deliverable.portrait, 'sprite--sm'), text: `${deliverable.clientName} : livrez depuis le grenier`, short: `la commande de ${deliverable.clientName}`, go: () => openBoard() });
      } else {
        const best = orders.slice().sort((a, b) => progressOf(b) - progressOf(a) || (b.kept ? 1 : 0) - (a.kept ? 1 : 0))[0];
        const line = (best.lines || []).find((l) => (l.left ?? l.n - (l.got || 0)) > 0) || best.lines?.[0];
        if (line) {
          const left = Math.max(0, line.left ?? line.n - (line.got || 0));
          out.push({ id: 'v-order', prio: best.started || best.kept ? 58 : 66, icon: () => portraitOf(best.portrait, 'sprite--sm'), text: `${best.clientName} ${waits(best.clientName)} ${count(line.cropId, left, line.cropName)}`, short: `${best.clientName} ${waits(best.clientName)} ${count(line.cropId, left, line.cropName)}`, go: () => openBoard() });
        }
      }
    }
    const c = v?.cart || q('cart', g);
    if (c) {
      const crates = c.crates || [];
      const full = crates.filter((k) => k.full).length;
      if (career && crates.some((k) => k.canLoad)) out.push({ id: 'v-cart-load', prio: 46, icon: () => sectionIco('cart', 'harvest'), text: 'La charrette : chargez depuis le grenier', short: 'charger la charrette', go: () => openCart() });
      else if (full < crates.length) out.push({ id: 'v-cart', prio: c.daysLeft === 0 ? 60 : 80, icon: () => sectionIco('cart', 'harvest'), text: `Charrette : ${full} / ${crates.length} caisses (${lower(c.departText || 'part en fin de saison')})`, short: `la charrette (${full} / ${crates.length} caisses)`, go: () => openCart() });
    }
    const m = v?.merchant || q('merchant', g);
    if (m?.here && (m.stall || []).some((x) => !x.sold)) out.push({ id: 'v-merchant', prio: 52, icon: () => portraitOf(m.portrait || 'portrait.merchant', 'sprite--sm'), text: `Basile le colporteur est là (${m.daysLeft > 0 ? 'jusqu\'à demain soir' : 'jusqu\'à ce soir'})`, short: 'Basile le colporteur', go: () => openMerchant() });
    else if (m?.soon && (m.daysUntil ?? 1) <= 1) out.push({ id: 'v-merchant-soon', prio: 86, icon: () => portraitOf('portrait.merchant', 'sprite--sm'), text: 'Demain : Basile le colporteur passe', short: 'Basile passe demain', go: () => openMerchant() });
    const cards = v?.cards || q('cards', g);
    if (cards?.offer?.options?.length) out.push({ id: 'v-cards', prio: 74, icon: () => sectionIco('cards', 'star'), text: 'Un cadeau pour la saison : choisissez une carte', short: 'un cadeau à choisir', go: () => openCards() });
    const ch = v?.challenges || q('challenges', g);
    if (ch?.options?.length && !(ch.kept || []).length) out.push({ id: 'v-challenges', prio: 77, icon: () => sectionIco('challenge', 'star'), text: 'Défis de la saison : gardez-en 1 ou 2', short: 'des défis à choisir', go: () => openChallenges() });
    return out;
  }

  function progressOf(o) {
    let got = 0;
    let n = 0;
    for (const l of o.lines || []) {
      got += l.got || 0;
      n += l.n || 0;
    }
    return n ? got / n : 0;
  }

  /** Un choix attend (cadeau, défis) : pastille de l'onglet Bilan / Carnet. */
  function pendingChoice(g = app.game) {
    if (!enabled(g)) return false;
    const cards = q('cards', g);
    const ch = q('challenges', g);
    return !!(cards?.offer?.options?.length || (ch?.options?.length && !(ch.kept || []).length));
  }

  // ── Sections du Bilan (niveaux) et du Carnet (carrière) ───────────────────────
  function sectionBtn(label, onclick, id) {
    return el('button.btn.btn--wide.v-open', { type: 'button', id, onclick: () => { app.audio.play('click', { volume: 0.6 }); onclick(); } }, label, el('span.v-chev', { 'aria-hidden': 'true' }, '›'));
  }

  function villageNodes(g = app.game) {
    if (!enabled(g)) return [];
    const v = q('variety', g) || {};
    const nodes = [];
    const t = theme(g);
    if (t) nodes.push(el('section.stats-section.v-sec', el('h3.stats-title', sectionIco('theme', 'star'), 'Thème de l\'année'), themeBlock(t, { full: false }), t.id ? sectionBtn('Voir le thème', () => openTheme(), 'v-sec-theme') : null));
    const cards = v.cards || q('cards', g);
    if (cards?.offer?.options?.length) nodes.push(el('section.stats-section.v-sec.is-pending', el('h3.stats-title', sectionIco('cards', 'star'), 'Cadeau de la saison'), el('p.stats-note', 'Deux cartes vous attendent : gardez-en une.'), sectionBtn('Choisir une carte', () => openCards(), 'v-sec-cards')));
    const o = v.board || q('orders', g);
    if (o) {
      const orders = (o.slots || []).filter((s) => s && !s.empty && s.id);
      const lines = orders.map((x) => {
        const l = x.lines?.[0];
        return el('div.stats-line', el('span.stats-label', portraitOf(x.portrait, 'sprite--xs'), ` ${x.clientName}`), el('b.stats-value', l ? `${fmt(l.got || 0)} / ${fmt(l.n)} ${cropWords(l.cropId, l.n, l.cropName)}` : ''));
      });
      nodes.push(el('section.stats-section.v-sec', el('h3.stats-title', sectionIco('board', 'info'), 'Le tableau du village'), o.startsIn > 0 ? el('p.stats-note', `Premières commandes ${o.startsIn === 1 ? 'demain' : `dans ${plural(o.startsIn, 'jour')}`}.`) : lines.length ? lines : el('p.stats-note', 'Pas de commande aujourd\'hui : revenez demain !'), sectionBtn('Voir le tableau', () => openBoard(), 'v-sec-board')));
    }
    const c = v.cart || q('cart', g);
    if (c) {
      const full = (c.crates || []).filter((k) => k.full).length;
      nodes.push(el('section.stats-section.v-sec', el('h3.stats-title', sectionIco('cart', 'harvest'), 'La charrette du marché'), el('div.stats-line', el('span.stats-label', `${full} / ${(c.crates || []).length} caisses pleines`), el('b.stats-value.pos', `+${fmt(c.premiumNow || 0)}`)), el('p.stats-note', c.departText || ''), sectionBtn('Voir la charrette', () => openCart(), 'v-sec-cart')));
    }
    const ch = v.challenges || q('challenges', g);
    if (ch?.options?.length) {
      const kept = ch.options.filter((x) => x.kept);
      nodes.push(
        el(
          `section.stats-section.v-sec${kept.length ? '' : '.is-pending'}`,
          el('h3.stats-title', sectionIco('challenge', 'star'), `Défis ${seasonOfTitle(ch)}`),
          kept.length ? kept.map((x) => el('div.stats-line', el('span.stats-label', x.name), el('b.stats-value', el('span.v-medals.is-inline', [1, 2, 3].map((lv) => medalNode(lv, (x.medal || 0) >= lv, 'is-xs'))), ` ${fmt(x.progress || 0)}`))) : el('p.stats-note', 'Gardez 1 ou 2 défis : tout compte depuis le 1ᵉʳ jour.'),
          sectionBtn(kept.length ? 'Voir les défis' : 'Choisir les défis', () => openChallenges(), 'v-sec-challenges'),
        ),
      );
    }
    const m = v.merchant || q('merchant', g);
    if (m && (m.here || m.soon)) nodes.push(el('section.stats-section.v-sec', el('h3.stats-title', sectionIco('merchant', 'coin'), 'Basile le colporteur'), el('p.stats-note', m.here ? (m.daysLeft > 0 ? 'À la ferme jusqu\'à demain soir.' : 'À la ferme jusqu\'à ce soir.') : m.daysUntil === 1 ? 'Il passe demain.' : `Il passe dans ${plural(m.daysUntil || 0, 'jour')} (le 5ᵉ jour de la saison).`), m.here ? sectionBtn('Voir son étal', () => openMerchant(), 'v-sec-merchant') : null));
    const effects = activeEffects(v.effects || cards?.active);
    if (effects) nodes.push(el('section.stats-section.v-sec', effects));
    const rare = (v.rare || []).filter((r) => r.seeds > 0);
    if (rare.length) nodes.push(el('section.stats-section.v-sec', el('h3.stats-title', sectionIco('rare', 'seed'), 'Graines rares'), rare.map((r) => el('div.stats-line', el('span.stats-label', cropIco(r.cropId, 'sprite--xs'), ` ${r.name}`), el('b.stats-value', plural(r.seeds, 'graine'))))));
    return nodes;
  }

  function statsSection(g = app.game) {
    const nodes = villageNodes(g);
    return nodes.length ? el('div.v-village', { id: 'stats-village' }, nodes) : null;
  }

  function agendaSections(ui) {
    return villageNodes(ui?.game || app.game);
  }

  function yearLines(report) {
    if (!enabled()) return null;
    const nodes = [];
    const v = report?.variety;
    if (v) {
      const m = v.medals || {};
      const medals = (m.bronze || 0) + (m.silver || 0) + (m.gold || 0);
      const bits = [v.ordersDone ? plural(v.ordersDone, 'commande livrée', 'commandes livrées') : null, v.cratesFull ? plural(v.cratesFull, 'caisse pleine', 'caisses pleines') : null, medals ? plural(medals, 'médaille') : null].filter(Boolean);
      if (bits.length) nodes.push(el('p.stats-note.v-year-village', sectionIco('board', 'info'), `Le village : ${bits.join(' · ')}.`));
    }
    const next = report?.nextTheme;
    if (next) {
      const name = typeof next === 'string' ? next : next.name;
      nodes.push(el('p.v-theme-next.is-big', spriteAny([next.icon, `icon.theme.${next.id}`].filter(Boolean), 'sprite--md', 'star'), `L'an prochain : ${lower(name || 'une année à thème')} !`));
    }
    return nodes.length ? el('div.v-year', nodes) : null;
  }

  // ── Fiche de parcelle, feuille des graines ────────────────────────────────────
  function plotRows(p) {
    if (!enabled() || !p?.claim) return null;
    const c = p.claim;
    return el('div.tip-note.v-claim', icon('harvest', 'xs'), `À la récolte : ${c.label || '→ commande'}${c.n ? ` (${fmt(c.got || 0)} / ${fmt(c.n)})` : ''}`);
  }

  function seedChips(c) {
    if (!enabled() || !c) return [];
    const chips = [];
    if (c.rare) chips.push(el('span.warn-chip.v-chip-rare', sectionIco('rare', 'seed', 'sprite--xs'), `Rare · ${plural(c.seedsLeft || 0, 'graine')}`));
    if (c.free) chips.push(el('span.warn-chip.v-chip-free', `Offert · ${plural(c.free, 'semis', 'semis')}`));
    if (c.requested) chips.push(el('span.warn-chip.v-chip-order', sectionIco('board', 'info', 'sprite--xs'), 'Commande'));
    return chips;
  }

  // ── À chaque image ────────────────────────────────────────────────────────────
  function frame() {
    const g = app.game;
    if (!g || app.inMenu || !enabled(g)) return;
    const now = performance.now();
    if (now - badgeAt > 500) {
      badgeAt = now;
      const on = pendingChoice(g);
      if (on !== lastBadge) {
        lastBadge = on;
        if (!isCareer(g)) app.tabbar?.setBadge('stats', on);
      }
    }
    if (careerSeason && isCareer(g) && now >= careerSeason.at && !app.dialogs.isOpen() && !app.tutorial?.active && g.state.status === 'playing') {
      careerSeason = null;
      openCareerSeason();
    }
  }

  function reset(g = null) {
    game = g;
    live = null;
    doneToday.clear();
    slotOf.clear();
    evening = null;
    seasonMedals.length = 0;
    careerSeason = null;
    lastBadge = null;
    if (!g || !enabled(g)) app.tabbar?.setBadge('stats', false);
  }

  return {
    onEvent,
    frame,
    reset,
    openBoard,
    openCart,
    openMerchant,
    openCards,
    openChallenges,
    openTheme,
    onHit,
    seasonPages,
    seasonSummary,
    todoItems,
    statsSection,
    agendaSections,
    yearLines,
    pendingChoice,
    plotRows,
    seedChips,
    enabled,
    grantEcus,
    /** Débogage : ce que montre le tableau. */
    debugState: () => ({ live: live?.id || null, doneToday: [...doneToday.keys()], medals: seasonMedals.slice(), evening, careerSeason }),
  };
}

export { MEDAL_NAMES };
