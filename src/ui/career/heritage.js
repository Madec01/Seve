// Interface de La Vallée vivante, lot V2 « Le troc et les croisements » (docs/VALLEE.md § 16 ; contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V2 », « Ce que RENDER et UI consomment », « Écarts et précisions (livraison CORE V2) »).
//
// createHeritage(app) → app.heritage = {
//   openLibrary(tab?)        fiche « La Grainothèque » (feuille haute, pause de lecture) : vignette, niveau, effets cochés,
//                            « Construire · 1 600 » / « Agrandir · 4 000 », segments L'étagère · Croisements · Troc
//   openTroc()               feuille « Troc avec … » : ce qu'on reçoit, ce qu'on donne (au choix, ♥ en tête), « Échanger »
//   openCross(cropId)        popup du croisement (sachet doré, nom complet, deux traits, « Semer » / « Plus tard »)
//   enterPair(cropId), leavePair(), pairing   mode « paire » (barre #vl-pairbar à la place des onglets)
//   sowPairAt(index, cropId) « Semer la paire » d'un geste (feuille des graines, parcelle touchée en mode paire)
//   openStory(id), openBox() récits de la Grainothèque ; « Revoir la boîte en fer » (état actuel des trois variétés)
//   onEvent(ev, game)        appelé par app.valley.onEvent : messages, sons, fenêtres en file, conseils, résumé du matin
//   onHit(hit) → bool        seedLibrary | pairPlot
//   todoItems(game)          vl-troc, vl-story
//   boardCard(game)          carte « Troc » en tête du tableau du village ; orderMark(order), echoThanks(ev)
//   plotRows(plot)           fiche d'une parcelle : croisement (« 2 / 3 rencontres · récoltez-la à la main »)
//   seedRows(rows, index, { close })   feuille des graines : lignes « Semer la paire »
//   seedsTop(v), seedGroups(v, row), boxButton(), storyButtons(v)     onglet Graines de « La Vallée »
//   varietyExtra(x)          fiche d'une variété : « De la part de … », croisement + « Semer la paire »
//   hintAction(h)            bouton du prochain indice (troc, paire, Grainothèque, récit)
//   yearLines(report), reportLines(v), pending(v)   bilan annuel, Carnet › Bilan, pastille du Carnet
//   frame(), reset(game|null), on(game), debugState()
// }
//
// Règles : carrière seulement (state.career.valley et parts.heritage) ; rien ne presse (un troc attend sans limite, une
// rencontre ne se perd jamais), aucune envie fabriquée (pas de ligne « À faire » pour acheter un niveau) ; cibles ≥ 48 px,
// textes ≥ 14 px, peu de texte ; traits en pictogramme ET en mot ; lecteurs d'écran (« 2 rencontres sur 3 », « sauvée »,
// « troc fait ») ; mouvements réduits ; temps en pause pendant la lecture (feuilles) et le mode paire.

import { el, fmt, plural } from '../dom.js';
import { icon, cropIcon, hasSprite, sprite, spriteAny } from '../icons.js';
import { cropName as cropNameOf } from '../text.js';
import { SIGNALS } from '../coach/signals.js';
import * as VD from '../../data/career/valley.js';
import * as HD from '../../data/career/heritage.js';
import { STORIES_V3_BY_ID } from '../../data/career/places.js';
import { traitChip, fixBar, vIcon } from './valley.js';

// ── Textes ──────────────────────────────────────────────────────────────────────────

// Les anciens conseils « première fois » (HERITAGE_HINTS) sont des leçons de Joseph : src/ui/coach/lessons/valley.js.

const GROUPS = [
  { id: 'pays', label: 'Du pays', shelf: 'Du pays' },
  { id: 'village', label: 'Du village', shelf: 'Du village' },
  { id: 'cross', label: 'De la ferme', shelf: 'De la ferme' },
];
const LIB_EMOJI = ['🪧', '🛖', '🏡', '🏠', '🌻', '🌹'];
const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Variété (V1, du village ou croisée) par identifiant. */
const vDef = (id) => (VD.ALL_VARIETIES_BY_ID || VD.VARIETIES_BY_ID || {})[id] || null;
const genderOf = (x) => x?.g || vDef(x?.varietyId || x?.id)?.g || 'f';
const agree = (x, word) => (typeof VD.agreeWith === 'function' ? VD.agreeWith({ g: genderOf(x) }, word) : genderOf(x) === 'm' ? word : `${word}e`);
/** Traits d'une ligne de requête : `traits` (V2) ou `trait` (V1). */
export function traitsOf(x) {
  if (!x) return [];
  if (Array.isArray(x.traits) && x.traits.length) return x.traits.map((t) => (typeof t === 'string' ? VD.TRAITS_BY_ID?.[t] : t)).filter(Boolean);
  if (x.trait) return [typeof x.trait === 'string' ? VD.TRAITS_BY_ID?.[x.trait] : x.trait].filter(Boolean);
  return [];
}
/** Pastilles de traits (pictogramme ET mot) : une ou deux. */
export function traitChips(x, opts) {
  const list = traitsOf(x);
  return list.length ? el('span.vl-traits', list.map((t) => traitChip(t, opts))) : null;
}

/**
 * Barre de rencontres à segments, lue « 2 rencontres sur 3 ».
 * @param {number} meet rencontres faites @param {number} need rencontres nécessaires
 */
export function meetBar(meet, need) {
  const max = Math.max(1, need | 0);
  const n = Math.max(0, Math.min(max, meet | 0));
  return el(
    'span.vl-fix.vl-meet',
    { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(n), 'aria-label': `${n} ${n > 1 ? 'rencontres' : 'rencontre'} sur ${max}` },
    el('span.vl-fix-bar', { 'aria-hidden': 'true' }, Array.from({ length: max }, (_, i) => el(`span.vl-fix-seg.vl-meet-seg${i < n ? '.is-on' : ''}`))),
    el('span.vl-fix-txt', { 'aria-hidden': 'true' }, `${n} / ${max}`),
  );
}

/** Icône d'une variété : son dessin, sinon celui de la culture (sceau doré pour une croisée). */
function varIcon(x, cls = 'sprite--md') {
  const def = vDef(x?.varietyId || x?.id) || {};
  const cropId = x?.cropId || def.cropId;
  const names = [x?.icon, def.icon, x?.ripeIcon, def.ripe, cropId ? `crop.${cropId}.icon` : null, cropId ? `tree.${cropId}.icon` : null, cropId ? `crop.${cropId}.4` : null];
  const node = vIcon(names, cls, '🌱');
  const group = x?.group || def.group;
  if (group === 'cross' && !hasSprite(x?.icon || def.icon)) return el('span.vl-sealed', node, el('span.vl-seal', { 'aria-hidden': 'true' }));
  return node;
}
const portrait = (name, cls = 'sprite--portrait') => spriteAny([name, 'portrait.joseph'].filter(Boolean), cls, 'star');

// ── Module ──────────────────────────────────────────────────────────────────────────

export function createHeritage(app) {
  let live = null; // { id, build, sig, lastSig }
  let queued = false;
  let tab = 'shelf';
  let pairing = null; // culture du mode paire
  let bar = null;
  const windows = []; // { kind: 'cross' | 'story', data }
  let trocPick = null;
  let trocDone = null; // résultat du dernier échange (merci du voisin)
  const day = { key: '', meets: 0, lots: new Set() };

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.mode === 'career' && g.state?.career?.valley);
  const on = (g = app.game) => {
    if (!enabled(g)) return false;
    const v = g.state.career.valley;
    return !!v.started && v.parts?.heritage !== false && (v.v || 1) >= 2;
  };
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Grainothèque :', err);
      return fallback;
    }
  }
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  const V = (g = app.game) => (on(g) ? q('valley', g) : null);
  const dayKey = (g = app.game) => {
    const t = g?.state?.time || {};
    return `${t.year || 0}|${t.day ?? 0}`;
  };
  function refused(text) {
    app.audio.play('error');
    app.vibrate?.([30, 40, 30]);
    app.toasts.show({ kind: 'error', text, log: false });
  }
  function act(name, ...args) {
    const fn = app.game?.actions?.career?.[name];
    if (typeof fn !== 'function') {
      refused('Bientôt disponible.');
      return null;
    }
    let res;
    try {
      res = fn(...args);
    } catch (err) {
      console.warn(`actions.career.${name} :`, err);
      res = { ok: false, reason: 'Impossible pour l\'instant.' };
    }
    if (res && res.ok === false) refused(res.reason || 'Impossible pour l\'instant.');
    schedule();
    app.careerUI?.refresh?.();
    return res;
  }
  const morning = (text) => text && app.todo?.morningNote?.(text);
  const signal = (name, data) => app.coach?.signal?.(name, data);
  const tone = (name, opts) => app.audio.tone?.(name, opts);
  const reduced = () => !!app.reducedMotion?.();
  const cropName = (id) => safe(() => cropNameOf(id), id) || id;

  // ── Feuilles « vivantes » ──────────────────────────────────────────────────────
  function openLive(id, { title, icon: ico, build, sig, tall = true, pauses, outsideClose }) {
    const node = safe(build, null) || el('p.sheet-empty', 'Rien pour l\'instant.');
    app.sheets.open({ id, kind: 'popup', tall, title, icon: ico, content: node, className: `vl-sheet vl-sheet--${id}`, pauses, outsideClose, onClose: () => { if (live?.id === id) live = null; } });
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
  function repaint() {
    if (!live || app.sheets.current !== live.id) return;
    live.lastSig = safe(live.sig, '');
    const node = safe(live.build, null);
    if (node) app.sheets.setContent(node, true);
  }

  // ── La Grainothèque ────────────────────────────────────────────────────────────
  function libVignette(lib, cls = 'sprite--vl-lib') {
    const n = lib?.level || 0;
    const names = n > 0 ? [lib.vignette, `library.${Math.min(5, n)}`] : ['library.site'];
    return vIcon(names, cls, LIB_EMOJI[Math.min(5, n)] || '🏡');
  }

  function buildButton(lib) {
    const nx = lib?.next;
    if (!nx) return lib?.level >= 5 ? el('p.vl-ok', 'La grainothèque est au plus haut ✓') : null;
    if (!lib.site && !lib.level) return el('p.vl-lock', icon('lock', 'sm'), nx.reason || `Rang ${nx.rank} requis`);
    const verb = lib.level ? 'Agrandir' : 'Construire';
    const can = !!nx.canBuild;
    return el(
      'div.vl-lib-build',
      el(
        `button.btn.btn--wide.vl-lib-go${can ? '.btn--red' : '.is-disabled'}`,
        { type: 'button', id: 'vl-lib-build', 'aria-disabled': can ? 'false' : 'true', 'aria-label': `${verb} : ${nx.name}, ${fmt(nx.price)} pièces${can ? '' : `. ${nx.reason || ''}`}`, onclick: () => buildLibrary(nx) },
        el('span', verb),
        el('span.buy-cost', icon('coin', 'sm'), fmt(nx.price)),
        nx.rank && !can && /rang/i.test(nx.reason || '') ? el('span.vl-lib-rank', `· rang ${nx.rank}`) : null,
      ),
      can ? el('p.vl-lib-next', `${nx.name} : ${(nx.unlocks || []).map(lower).join(' ; ')}`) : el('p.card-reason', nx.reason || 'Pas encore.'),
    );
  }

  function buildLibrary(nx) {
    if (!nx?.canBuild) return refused(nx?.reason || 'Pas encore.');
    const res = act('buildSeedLibrary');
    if (!res?.ok) return;
    app.audio.play('buy');
    tone('reveal', { volume: 0.8, delay: 0.15 });
    app.vibrate?.([14, 50, 14]);
    repaint();
  }

  function libHead(v) {
    const lib = v.library || { level: 0 };
    const lines = lib.level
      ? (lib.effects || []).map((t) => el('li.is-ok', el('span.vl-check', { 'aria-hidden': 'true' }), el('span', t)))
      : (lib.siteLines || ['Une maison pour vos graines', 'Le troc toute l\'année', 'Vos bocaux bien rangés']).map((t) => el('li', el('span.vl-check', { 'aria-hidden': 'true' }, '·'), el('span', t)));
    return el(
      'div.vl-lib-head',
      el('div.vl-lib-pic', libVignette(lib)),
      el(
        'div.vl-lib-main',
        el('b.vl-lib-level', lib.level ? `Niveau ${lib.level}` : lib.site ? 'À construire' : 'Bientôt'),
        el('span.vl-lib-name', lib.level ? lib.name : 'La Grainothèque'),
        el('ul.vl-lib-fx', lines),
      ),
    );
  }

  function libTabs() {
    const T = [
      { id: 'shelf', label: 'L\'étagère' },
      { id: 'cross', label: 'Croisements' },
      { id: 'troc', label: 'Troc' },
    ];
    return el(
      'div.seg.vl-seg',
      { role: 'tablist', 'aria-label': 'La Grainothèque' },
      T.map((t) => el(
        `button.seg-btn${t.id === tab ? '.is-active' : ''}`,
        { type: 'button', role: 'tab', id: `vl-lib-tab-${t.id}`, 'aria-selected': t.id === tab ? 'true' : 'false', onclick: () => {
          if (t.id === tab) return;
          app.audio.play('page', { volume: 0.6 });
          tab = t.id;
          repaint();
          signal(SIGNALS.valleySheet, { tab: t.id, sheet: 'vl-library' });
        } },
        el('span', t.label),
      )),
    );
  }

  /** L'étagère : trois étagères (du pays, du village, de la ferme), 4 bocaux par rangée. */
  function shelfTab(v) {
    const list = v.varieties || [];
    return el(
      'div.vl-shelf',
      GROUPS.map((g) => {
        const items = list.filter((x) => (x.group || vDef(x.id)?.group || 'pays') === g.id);
        if (!items.length) return null;
        const fixed = items.filter((x) => x.state === 'fixed').length;
        return el(
          'section.vl-shelf-row',
          { 'aria-label': `${g.shelf} : ${fixed} sur ${items.length}` },
          el('h3.vl-shelf-title', el('span', g.shelf), el('small', `${fixed} / ${items.length}`)),
          el('div.vl-jars-grid', items.map(jarTile)),
        );
      }),
      el('p.sheet-hint', 'Touchez un bocal pour voir la variété.'),
    );
  }
  function jarTile(x) {
    const unknown = x.state === 'unknown';
    const fixed = x.state === 'fixed';
    const badge = unknown ? '?' : fixed ? '✓' : String(x.seeds || 0);
    const label = unknown ? `${cropName(x.cropId)} : à trouver` : `${x.name}, ${fixed ? agree(x, 'sauvé') : plural(x.seeds || 0, x.unit || 'graine')}`;
    return el(
      `button.vl-jar-tile${unknown ? '.is-unknown' : ''}${fixed ? '.is-fixed' : ''}${(x.group || vDef(x.id)?.group) === 'cross' ? '.is-cross' : ''}`,
      { type: 'button', id: `vl-jar-${x.id}`, 'aria-label': label, onclick: () => app.valley?.openVariety?.(x.id) },
      el('span.vl-jar-glass', { 'aria-hidden': 'true' }, unknown ? vIcon(['jar.empty'], 'sprite--md', '🫙') : varIcon(x, 'sprite--md'), !unknown && hasSprite('jar.glass') ? el('span.vl-jar-shine', sprite('jar.glass', 'sprite--md')) : null),
      el(`span.vl-jar-badge${fixed ? '.is-ok' : unknown ? '.is-q' : ''}`, { 'aria-hidden': 'true' }, badge),
    );
  }

  /** Croisements : 11 lignes (parents, variété croisée, rencontres, « Semer la paire »). */
  function crossRow(c) {
    const [a, b] = c.parents || [];
    const found = !!c.found;
    let status;
    if (found) status = c.fixed ? el('span.vl-row-sub.is-ok', `${capitalize(agree({ g: vDef(c.id)?.g }, 'sauvé'))} ✓`) : el('span.vl-row-sub', `${plural(c.seeds ?? vRow(c.id)?.seeds ?? 0, 'graine')} · `, fixBar(vRow(c.id)?.hand || 0, vRow(c.id)?.need || 7));
    else status = el('span.vl-row-sub', meetBar(c.meet || 0, c.need || 3), c.linked ? el('span.vl-linked', 'une paire pousse') : null);
    const missing = (c.parents || []).find((p) => !p.have);
    const go = !found && c.canPair
      ? el('button.btn.btn--red.vl-small', { type: 'button', id: `vl-pair-${c.cropId}`, onclick: () => enterPair(c.cropId) }, 'Semer la paire')
      : null;
    return el(
      `article.vl-row.vl-cross${found ? '.is-found' : ''}`,
      { id: `vl-cross-${c.cropId}`, 'aria-label': `${found ? c.name : `Croisement de ${cropName(c.cropId)}`}${found ? '' : `, ${c.meet || 0} rencontres sur ${c.need || 3}`}` },
      el(
        'span.vl-cross-pics',
        { 'aria-hidden': 'true' },
        el(`span.vl-cross-p${a?.have ? '' : '.is-missing'}`, varIcon(a, 'sprite--sm')),
        el('span.vl-cross-op', '+'),
        el(`span.vl-cross-p${b?.have ? '' : '.is-missing'}`, varIcon(b, 'sprite--sm')),
        el('span.vl-cross-op', '→'),
        el(`span.vl-cross-p.is-gold${found ? '' : '.is-q'}`, found ? varIcon({ ...c, group: 'cross' }, 'sprite--sm') : el('b', '?')),
      ),
      el(
        'div.vl-row-main',
        el('span.vl-row-name', found ? c.name : '?'),
        found ? traitChips(c) : el('span.vl-row-sub.is-soft', `${a?.name || '…'} + ${b?.name || '…'}`),
        status,
        !found && !c.canPair ? el('span.vl-row-sub', missing ? c.reason || `Il faut d'abord ${missing.name}.` : c.reason || '') : null,
      ),
      go,
    );
  }
  const vRow = (id) => (V()?.varieties || []).find((y) => y.id === id) || null;
  function crossTab(v) {
    const list = v.crosses || [];
    const found = list.filter((c) => c.found).length;
    return el(
      'div.vl-crosses',
      el('p.vl-count', `${found} / ${list.length || 11} croisements trouvés`),
      el('p.vl-rule', v.crossRule || HD.HERITAGE_TEXTS?.crossRule || 'Semez côte à côte les deux variétés d\'une culture ; récoltez l\'une à la main pendant que l\'autre pousse à côté : une rencontre.'),
      el('div.vl-rows', list.map(crossRow)),
    );
  }

  /** Troc : la proposition en attente, puis les 12 voisins. */
  function trocCard(t, { board = false } = {}) {
    if (!t) return null;
    return el(
      'article.vl-troc-card',
      { id: board ? 'vl-board-troc' : 'vl-troc-card' },
      el('span.vl-troc-pic', portrait(t.portrait), el('span.vl-troc-pin', { 'aria-hidden': 'true' }, vIcon(['troc.pin', 'seedpack.village'], 'sprite--sm', '🌱'))),
      el(
        'div.vl-troc-main',
        el('b.vl-troc-name', `Troc · ${t.clientName}`),
        el('span.vl-troc-what', varIcon({ varietyId: t.varietyId, icon: t.icon, cropId: vDef(t.varietyId)?.cropId }, 'sprite--xs'), el('span', t.varietyName)),
      ),
      el('button.btn.btn--red.vl-small.vl-troc-go', { type: 'button', id: board ? 'vl-board-troc-go' : 'vl-troc-go', onclick: () => openTroc() }, 'Choisir une graine'),
    );
  }
  function trocTab(v) {
    const s = v.swaps || { done: 0, total: 12, list: [] };
    const parts = [];
    if (v.troc) parts.push(trocCard(v.troc));
    else parts.push(el('p.vl-note', vIcon(['icon.swap'], 'sprite--xs', '🌱'), !(v.varieties || []).some((x) => x.state === 'fixed') ? 'Sauvez une première variété pour échanger.' : v.library?.level ? 'Un voisin épinglera un sachet au tableau, au 2ᵉ jour de la saison.' : 'Le troc de la foire, en attendant : le dernier jour d\'hiver.'));
    parts.push(el('p.vl-count', `${s.done} ${s.done > 1 ? 'trocs' : 'troc'} sur ${s.total || 12}`));
    parts.push(
      el(
        'div.vl-neighbours',
        { role: 'list' },
        (s.list || []).map((n) => el(
          `div.vl-nb${n.done ? '.is-done' : ''}${n.locked ? '.is-locked' : ''}`,
          { role: 'listitem', id: `vl-nb-${n.clientId}`, 'aria-label': `${n.clientName} : ${n.varietyName}${n.done ? ', troc fait' : n.locked ? `, ${n.locked}` : ''}` },
          el('span.vl-nb-pic', { 'aria-hidden': 'true' }, portrait(n.portrait, 'sprite--md'), el('span.vl-nb-var', varIcon({ varietyId: n.varietyId, icon: n.icon, cropId: vDef(n.varietyId)?.cropId }, 'sprite--xs'))),
          el('span.vl-nb-name', { 'aria-hidden': 'true' }, n.clientName),
          el(`span.vl-nb-state${n.done ? '.is-ok' : ''}`, { 'aria-hidden': 'true' }, n.done ? `✓${n.fav ? ' ♥' : ''}` : n.locked ? n.locked : '·'),
        )),
      ),
    );
    parts.push(el('p.sheet-hint', 'Un troc par voisin ; ça ne coûte rien : la grainothèque garde toujours une poignée de chaque graine sauvée.'));
    return el('div.vl-troc-tab', parts);
  }

  function libraryContent() {
    const v = V();
    if (!v) return el('p.cz-lead', 'La Grainothèque arrive avec la Vallée.');
    const body = tab === 'cross' ? crossTab(v) : tab === 'troc' ? trocTab(v) : shelfTab(v);
    return el('div.vl-library', libHead(v), buildButton(v.library), libTabs(), el('div.vl-panel', { role: 'tabpanel' }, body));
  }
  function openLibrary(t = null) {
    if (!on()) return false;
    if (t && ['shelf', 'cross', 'troc'].includes(t)) tab = t;
    if (pairing) leavePair({ silent: true });
    if (app.valley?.placing) app.valley.leavePlacing({ silent: true });
    return openLive('vl-library', { title: 'La Grainothèque', icon: vIcon(['icon.library', 'library.1'], 'sprite--md', '🏡'), build: libraryContent, sig: () => JSON.stringify([V(), tab, Math.floor((app.game?.state.money || 0) / 10)]) });
  }

  // ── Le troc ───────────────────────────────────────────────────────────────────
  function trocContent() {
    const v = V();
    if (trocDone) return trocThanks(trocDone);
    const t = v?.troc;
    if (!t) return el('div.vl-troc', el('p.cz-lead', 'Aucun troc en attente : un voisin épinglera bientôt un sachet au tableau.'));
    const gifts = [...(t.gifts || [])];
    const order = { pays: 0, village: 1, cross: 2 };
    gifts.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (order[a.group] ?? 0) - (order[b.group] ?? 0));
    if (trocPick && !gifts.some((g) => g.varietyId === trocPick)) trocPick = null;
    // Le petit mot du voisin une seule fois (première préférée) ; les suivantes : « ♥ 4 graines au lieu de 3 ».
    const firstFav = gifts.find((g) => g.fav) || null;
    const unit = t.unit || 'graine';
    return el(
      'div.vl-troc',
      el('div.vl-troc-who', el('span.vl-troc-pic', portrait(t.portrait)), el('div', el('b', t.clientName), t.clientTitle ? el('small', t.clientTitle) : null)),
      t.text ? el('p.cz-say', `« ${t.text} »`) : null,
      el('h3.vl-troc-h', `${t.clientName} vous donne :`),
      el(
        'div.vl-row.is-static.vl-troc-get',
        el('span.vl-row-ico', varIcon({ varietyId: t.varietyId, icon: t.icon, cropId: vDef(t.varietyId)?.cropId }, 'sprite--md')),
        el('span.vl-row-main', el('span.vl-row-name', t.varietyName), traitChips(t), el('span.vl-row-sub', `${plural(t.seeds || 3, unit)}${vDef(t.varietyId)?.label ? ` · ${vDef(t.varietyId).label}` : ''}`)),
      ),
      el('h3.vl-troc-h', 'Vous lui donnez (au choix) :'),
      gifts.length
        ? el(
            'div.vl-gifts',
            { role: 'radiogroup', 'aria-label': 'Votre graine à donner' },
            gifts.map((g) => el(
              `button.vl-gift${trocPick === g.varietyId ? '.is-picked' : ''}`,
              { type: 'button', role: 'radio', id: `vl-gift-${g.varietyId}`, 'aria-checked': trocPick === g.varietyId ? 'true' : 'false', 'aria-label': `${g.name}${g.fav ? `, préférée : ${g.seedsBack || 4} graines en retour` : ''}`, onclick: () => {
                trocPick = g.varietyId;
                app.audio.play('click', { volume: 0.6 });
                app.vibrate?.(6);
                repaint();
              } },
              el('span.vl-radio', { 'aria-hidden': 'true' }),
              el('span.vl-gift-ico', varIcon(g, 'sprite--md')),
              el('span.vl-gift-main', el('span.vl-gift-name', g.name, g.group === 'cross' ? el('span.vl-gold', { 'aria-hidden': 'true' }, ' ✦') : null), g.fav ? el('span.vl-gift-fav', el('span.vl-heart', { 'aria-hidden': 'true' }, '♥ '), g === firstFav ? t.favText || `${plural(g.seedsBack || 4, unit)} en retour` : `${plural(g.seedsBack || 4, unit)} au lieu de ${t.seeds || 3}`) : traitChips(g)),
            )),
          )
        : el('p.vl-note', 'Sauvez une première variété pour échanger.'),
      el('p.vl-free', 'Ça ne vous coûte rien : la grainothèque en garde toujours.'),
      el(
        `button.btn.btn--big.btn--wide.vl-go.vl-swap${trocPick ? '.btn--red' : '.is-disabled'}`,
        { type: 'button', id: 'vl-swap', 'aria-disabled': trocPick ? 'false' : 'true', onclick: () => doSwap() },
        'Échanger',
      ),
    );
  }
  function trocThanks(r) {
    const got = r.got || {};
    const x = vRow(got.varietyId);
    const k = x ? firstSowable(x) : null;
    return el(
      'div.vl-troc.is-done',
      el('div.vl-troc-who', el('span.vl-troc-pic', portrait(`portrait.client.${r.clientId}`)), el('div', el('b', r.clientName || 'Merci !'), el('small', 'Troc fait ✓'))),
      el('div.vl-troc-pack', { 'aria-hidden': 'true' }, vIcon(['seedpack.village', 'seedpack.heirloom'], 'sprite--card', '🌱')),
      r.thanks ? el('p.cz-say', { role: 'status' }, `« ${r.thanks} »`) : null,
      el('p.vl-ok', `${got.name || 'Une graine'} : ${plural(got.seeds || 3, got.unit || 'graine')}${r.fav ? ' ♥' : ''}`),
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', id: 'vl-troc-later', onclick: () => { trocDone = null; app.sheets.close(); } }, 'Plus tard'),
        k !== null ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl-troc-sow', onclick: () => { trocDone = null; sowAt(k); } }, x?.tree ? 'Planter' : 'Semer') : null,
      ),
    );
  }
  function doSwap() {
    if (!trocPick) return refused('Choisissez d\'abord une de vos graines.');
    const res = act('swapSeeds', trocPick);
    if (!res?.ok) return;
    trocDone = res;
    trocPick = null;
    tone('pop', { volume: 0.9 });
    app.audio.play('coin', { volume: 0.4, delay: 0.2 });
    app.vibrate?.([12, 40, 12]);
    repaint();
  }
  function openTroc() {
    if (!on()) return false;
    trocDone = null;
    trocPick = null;
    if (pairing) leavePair({ silent: true });
    const t = V()?.troc;
    return openLive('vl-troc', { title: t ? `Troc avec ${t.clientName}` : 'Le troc', icon: vIcon(['icon.swap', 'troc.pin'], 'sprite--md', '🌱'), build: trocContent, sig: () => JSON.stringify([V()?.troc, trocPick, !!trocDone]), tall: false });
  }

  // ── Semer ────────────────────────────────────────────────────────────────────
  function firstSowable(x) {
    const g = app.game;
    const plots = safe(() => g.query.plots(), []) || [];
    for (const p of plots) {
      if (p.action !== 'plant' || p.cropId) continue;
      if (x.tree ? p.env !== 'orchard' : p.env === 'orchard') continue;
      const rows = safe(() => g.query.plantableCrops(p.index)?.heirlooms, null) || [];
      const r = rows.find((y) => y.varietyId === x.id);
      if (r && r.canSow) return p.index;
    }
    return null;
  }
  function sowAt(index) {
    if (!Number.isInteger(index)) return false;
    app.sheets.close('silent');
    requestAnimationFrame(() => {
      app.revealPlot?.(index);
      app.field?.openSeedPicker?.(index);
    });
    return true;
  }

  // ── Le croisement (popup) ───────────────────────────────────────────────────────
  function crossContent(d) {
    const x = vRow(d.varietyId) || {};
    const parents = (d.parents || []).map((p) => (typeof p === 'string' ? vDef(p)?.name || p : p?.name)).filter(Boolean);
    const k = x.id ? firstSowable(x) : null;
    return el(
      'div.vl-crossfound',
      el('div.vl-pack', { 'aria-hidden': 'true' }, vIcon(['seedpack.cross'], 'sprite--card', '✨'), el('span.vl-pack-pop', varIcon({ ...x, varietyId: d.varietyId, group: 'cross', cropId: d.cropId }, 'sprite--md'))),
      el('p.vl-crossfound-kicker', 'Un croisement !'),
      el('h3.vl-crossfound-name', { role: 'status' }, d.name || x.name),
      traitChips({ traits: d.traits || x.traits }),
      el('p.vl-crossfound-from', `${agree({ g: vDef(d.varietyId)?.g }, 'Né')} de ${parents.join(' et ')} · ${plural(d.seeds || 3, 'graine')}`),
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', id: 'vl-cross-later', onclick: () => app.sheets.close() }, 'Plus tard'),
        k !== null ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl-cross-sow', onclick: () => sowAt(k) }, 'Semer') : null,
      ),
    );
  }
  function showCross(d) {
    tone('chime', { volume: 0.9 });
    app.vibrate?.([14, 60, 14, 60, 20]);
    openLive('vl-cross', { title: 'La Grainothèque', icon: vIcon(['icon.cross', 'seedpack.cross'], 'sprite--md', '✨'), build: () => crossContent(d), sig: () => '', tall: false });
  }
  /** Fiche d'un croisement : trouvé → le popup ; sinon l'onglet Croisements de la Grainothèque. */
  function openCross(cropId) {
    const c = (V()?.crosses || []).find((y) => y.cropId === cropId);
    if (c?.found) return showCross({ varietyId: c.id, cropId, name: c.name, traits: c.traits, parents: (c.parents || []).map((p) => p.name), seeds: vRow(c.id)?.seeds ?? 3 }), true;
    openLibrary('cross');
    requestAnimationFrame(() => app.sheets.body?.querySelector(`#vl-cross-${cropId}`)?.scrollIntoView?.({ block: 'center' }));
    return true;
  }

  // ── Mode « paire » ───────────────────────────────────────────────────────────
  function buildBar() {
    if (bar) return;
    bar = el(
      'nav.vl-placebar.vl-pairbar',
      { id: 'vl-pairbar', 'aria-label': 'Semer la paire' },
      el('div.vl-bar-info', el('span.vl-bar-ico', { id: 'vl-pair-ico' }), el('span.vl-bar-text', el('b', { id: 'vl-pair-name' }), el('small', { id: 'vl-pair-sub', 'aria-live': 'polite' }))),
      el('button.tabbar-btn.vl-bar-btn.is-done', { type: 'button', id: 'vl-pair-done', onclick: () => { app.vibrate?.(8); leavePair(); } }, el('span.tabbar-ico', icon('play', 'md')), el('span.tabbar-label', 'Terminer')),
    );
    document.body.append(bar);
  }
  function paintBar() {
    if (!bar || !pairing) return;
    const ico = bar.querySelector('#vl-pair-ico');
    if (ico.dataset.crop !== pairing) {
      ico.dataset.crop = pairing;
      ico.replaceChildren(vIcon(['icon.cross', `crop.${pairing}.icon`], 'sprite--sm', '🐝'));
    }
    const n = (safe(() => app.scene?.valleyPairTargets?.(), []) || []).length;
    const t1 = `Semer la paire · ${cropName(pairing)}`;
    const t2 = n ? 'Touchez une parcelle' : 'Aucune place : deux parcelles libres côte à côte';
    const a = bar.querySelector('#vl-pair-name');
    const b = bar.querySelector('#vl-pair-sub');
    if (a.textContent !== t1) a.textContent = t1;
    if (b.textContent !== t2) b.textContent = t2;
  }
  function enterPair(cropId) {
    const g = app.game;
    if (!on(g) || g.state.status !== 'playing' || !cropId) return false;
    const c = (V(g)?.crosses || []).find((y) => y.cropId === cropId);
    if (c && !c.canPair) return refused(c.reason || 'Pas possible pour l\'instant.'), false;
    const spots = q('valleyPairPlots', g, cropId) || [];
    if (!spots.length) return refused('Il faut deux parcelles libres côte à côte.'), false;
    if (app.valley?.placing) app.valley.leavePlacing({ silent: true });
    buildBar();
    pairing = cropId;
    // Signal avant la fermeture de la feuille : la leçon de Joseph passe au mode de visée (pas de retour en arrière).
    signal(SIGNALS.placing, { kind: 'pair', cropId });
    app.sheets.close('silent');
    app.input?.cancel?.();
    app.hints?.clear?.();
    app.pushPause('valley-pair');
    document.body.classList.add('in-valley-place', 'in-valley-pair');
    app.scene?.setPairPlacing?.(cropId);
    app.scene?.ensureTouchZoom?.({ animate: !reduced() }); // (V3) zoom tactile : parcelles ≥ 48 px
    paintBar();
    app.audio.play('open', { volume: 0.6 });
    app.onDecorChange?.(true);
    // La vue va vers la parcelle valide la plus proche du centre (si aucune n'est visible).
    requestAnimationFrame(() => {
      const s = app.scene;
      const view = safe(() => s.viewRect?.(), null);
      const list = safe(() => s.valleyPairTargets?.(), []) || [];
      if (!view || !list.length) return;
      const cx = view.x + view.w / 2;
      const cy = view.y + view.h / 2;
      const inside = (r) => r.x >= view.x && r.x + r.w <= view.x + view.w && r.y >= view.y && r.y + r.h <= view.y + view.h;
      if (list.some((t0) => inside(t0.rect))) return;
      let best = null;
      let bd = Infinity;
      for (const t0 of list) {
        const d = (t0.rect.x + t0.rect.w / 2 - cx) ** 2 + (t0.rect.y + t0.rect.h / 2 - cy) ** 2;
        if (d < bd) {
          bd = d;
          best = t0.rect;
        }
      }
      if (best) safe(() => s.focusWorld?.(best.x + best.w / 2, best.y + best.h / 2, { animate: !reduced() }), null);
    });
    // Pas de message : la barre le dit (un message attendrait la fin du mode et arriverait trop tard).
    if (app.keyboardMode) requestAnimationFrame(() => bar.querySelector('#vl-pair-done')?.focus());
    return true;
  }
  function leavePair({ silent = false } = {}) {
    if (!pairing) return;
    pairing = null;
    document.body.classList.remove('in-valley-pair');
    if (!app.valley?.placing) document.body.classList.remove('in-valley-place');
    app.scene?.setPairPlacing?.(null);
    if (!app.valley?.placing && !app.places?.wilding) app.scene?.restoreZoom?.({ animate: !reduced() });
    signal(SIGNALS.placing, { kind: null });
    app.popPause('valley-pair');
    if (!silent) app.audio.play('close', { volume: 0.6 });
    app.onDecorChange?.(false);
    app.tabbar?.refresh?.();
  }
  /** Sème la paire d'un geste : parent du village sur `index`, parent du pays sur la voisine libre. */
  function sowPairAt(index, cropId, close = null) {
    const res = act('sowPair', index, cropId);
    if (!res?.ok) return false;
    app.audio.play('plant', { volume: 0.85 });
    tone('pop', { volume: 0.5, delay: 0.12 });
    app.vibrate?.([10, 30, 10]);
    if (pairing) leavePair({ silent: true });
    close?.();
    return true;
  }

  // ── Récits de la Grainothèque ────────────────────────────────────────────────────
  const STORY_VIGNETTE = { heritage0: 'story.library', heritage1: 'story.library', heritage2: 'story.cross', heritage3: 'story.library5' };
  function stories(v = V()) {
    return v?.stories || [];
  }
  function firstUnreadStory(v = V()) {
    return stories(v).find((s) => s.available && !s.read)?.id || null;
  }
  function storyContent(id) {
    const s = stories().find((x) => x.id === id) || (HD.STORIES || []).find((x) => x.id === id) || STORIES_V3_BY_ID?.[id]; // (V3) récits du ruisseau
    if (!s) return el('p.sheet-empty', 'Récit inconnu.');
    return el(
      'div.vl-chapter.cz-veillee',
      el('div.cz-vignette.vl-vignette', vIcon([s.vignette, STORY_VIGNETTE[id], 'story.box'], 'sprite--vl-vignette', '🔥')),
      el('h3.cz-story-title', s.title),
      el('div.cz-story', (s.lines || []).map((l, i) => el('p.cz-story-line', { style: { '--cz-delay': `${i}` } }, `« ${l} »`))),
      el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl-story-ok', onclick: () => readStory(id) }, 'Merci, Joseph'),
    );
  }
  function readStory(id) {
    const s = stories().find((x) => x.id === id);
    if (s && !s.read) {
      const res = act('readStory', id);
      if (!res?.ok) return;
    }
    app.vibrate?.(10);
    app.sheets.close();
    app.places?.afterStory?.(id); // (V3) « Sur la colline » : la vue de la vallée s'ouvre une première fois
  }
  function openStory(id = firstUnreadStory()) {
    if (!on() || !id) return false;
    tone('magic', { volume: 0.6 });
    return openLive('vl-story', { title: 'Joseph raconte', icon: vIcon(['portrait.joseph'], 'sprite--md', '💬'), build: () => storyContent(id), sig: () => '', outsideClose: false });
  }
  /** Boutons « Les récits de Joseph » (ajoutés à ceux des étapes, fiche « La Vallée »). */
  function storyButtons(v) {
    return stories(v).filter((s) => s.available).map((s) => el(`button.btn.vl-chap${s.read ? '' : '.is-new'}`, { type: 'button', id: `vl-story-${s.id}`, onclick: () => openStory(s.id) }, s.read ? '' : el('span.vl-new', 'Nouveau · '), s.title));
  }

  // ── « Revoir la boîte en fer » ─────────────────────────────────────────────────
  function boxContent() {
    const v = V() || (enabled() ? q('valley') : null);
    const box = v?.box || {};
    const lines = box.lines || VD.JOSEPH_BOX?.lines || [];
    const list = box.varieties || [];
    const stateText = (b) => {
      if (b.state === 'fixed') return `${capitalize(agree(b, 'sauvé'))} ✓`;
      return `${plural(b.seeds || 0, b.unit || 'graine')} · ${Math.min(b.hand || 0, b.need || 7)} / ${b.need || 7} récoltes à la main`;
    };
    return el(
      'div.vl-box.cz-veillee.is-again',
      el('div.cz-vignette.vl-vignette', vIcon([box.vignette, VD.JOSEPH_BOX?.vignette, 'story.box'], 'sprite--vl-vignette', '🍪')),
      el('div.cz-story', lines.map((l) => el('p.cz-story-line.is-still', `« ${l} »`))),
      list.length
        ? el(
            'div.vl-box-seeds',
            { role: 'list', 'aria-label': 'Les trois variétés de la boîte' },
            list.map((b) => el(
              `button.vl-box-seed.is-still${b.state === 'fixed' ? '.is-fixed' : ''}`,
              { type: 'button', role: 'listitem', id: `vl-boxv-${b.varietyId}`, 'aria-label': `${b.name}, ${stateText(b)}`, onclick: () => app.valley?.openVariety?.(b.varietyId) },
              varIcon(b, 'sprite--md'),
              el('b', b.name),
              traitChips(b),
              el('small', stateText(b)),
            )),
          )
        : null,
      box.hedge ? el('p.cz-say.vl-hedge', `« ${box.hedgeLine || VD.JOSEPH_BOX?.hedgeLine || ''} »`, el('small', ` La haie de Joseph : ${box.hedge.label || 'le champ de départ'}.`)) : null,
      box.melonLine && !lines.includes(box.melonLine) ? el('p.cz-say.vl-melon', `« ${box.melonLine} »`) : null,
      el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl-box-close', onclick: () => app.sheets.close() }, 'Fermer'),
    );
  }
  function openBox() {
    if (!enabled() || !app.game.state.career.valley.started) return false;
    tone('magic', { volume: 0.5 });
    return openLive('vl-boxagain', { title: VD.JOSEPH_BOX?.title || 'La boîte en fer', icon: vIcon(['valley.box'], 'sprite--md', '🍪'), build: boxContent, sig: () => JSON.stringify(V()?.box || null), outsideClose: false });
  }
  function boxButton() {
    if (!enabled()) return null;
    return el('button.btn.btn--wide.vl-box-again', { type: 'button', id: 'vl-box-again', onclick: () => openBox() }, vIcon(['valley.box'], 'sprite--sm', '🍪'), 'Revoir la boîte en fer');
  }

  // ── Onglet Graines de « La Vallée » ───────────────────────────────────────────────
  /** En tête : la carte « La Grainothèque », puis la proposition de troc. */
  function seedsTop(v) {
    if (!v?.heritage && v?.heritage !== undefined) return null;
    if (!on()) return null;
    const lib = v.library || { level: 0 };
    const sub = lib.level ? `Niveau ${lib.level} · ${lib.name}` : lib.site ? 'À construire derrière la maison' : 'Au rang 3, Joseph aura une idée';
    return el(
      'div.vl-seeds-top',
      el(
        'button.vl-libcard',
        { type: 'button', id: 'vl-libcard', 'aria-label': `La Grainothèque : ${sub}`, onclick: () => openLibrary() },
        el('span.vl-libcard-pic', libVignette(lib, 'sprite--md')),
        el('span.vl-libcard-main', el('b', 'La Grainothèque'), el('small', sub)),
        el('span.btn.vl-small.vl-libcard-go', { 'aria-hidden': 'true' }, 'Voir'),
      ),
      v.troc ? trocCard(v.troc) : null,
    );
  }
  /** Liste groupée : « En cours » (ouvert), « Du pays », « Du village », « De la ferme » (repliés). */
  function seedGroups(v, row) {
    const list = v.varieties || [];
    const inHand = list.filter((x) => x.state === 'seeds');
    const out = [];
    if (inHand.length) out.push(el('section.vl-group.is-open', el('h3.vl-group-title', el('span', 'En cours'), el('small', `${inHand.length}`)), el('div.vl-rows', inHand.map(row))));
    for (const g of GROUPS) {
      const items = list.filter((x) => (x.group || vDef(x.id)?.group || 'pays') === g.id && x.state !== 'seeds');
      const all = list.filter((x) => (x.group || vDef(x.id)?.group || 'pays') === g.id);
      if (!all.length) continue;
      const fixed = all.filter((x) => x.state === 'fixed').length;
      out.push(el(
        'details.vl-group',
        { id: `vl-group-${g.id}` },
        el('summary.vl-group-title', el('span', g.label), el('small', `${fixed} / ${all.length}`)),
        items.length ? el('div.vl-rows', items.map(row)) : el('p.stats-note', 'Toutes en cours, plus haut.'),
      ));
    }
    return out;
  }
  /** Fiche d'une variété : « De la part de … », croisement (« 2 / 3 rencontres ») et « Semer la paire ». */
  function varietyExtra(x) {
    if (!x || !on()) return null;
    const parts = [];
    const def = vDef(x.id) || {};
    const group = x.group || def.group;
    if (group === 'village' && x.state !== 'unknown') parts.push(el('p.vl-label.vl-from', x.label || def.label || ''));
    const c = x.cross;
    if (c && !c.found) {
      const cr = (V()?.crosses || []).find((y) => y.cropId === c.cropId);
      parts.push(el(
        'div.vl-xline',
        el('span.vl-xline-txt', `Croisement avec ${c.partnerName} :`),
        meetBar(c.meet || 0, c.need || 3),
        cr?.canPair ? el('button.btn.btn--red.vl-small', { type: 'button', id: 'vl-var-pair', onclick: () => enterPair(c.cropId) }, 'Semer la paire') : cr?.reason ? el('small.vl-row-sub', cr.reason) : null,
      ));
    } else if (c?.found && group !== 'cross') parts.push(el('p.vl-row-sub.is-ok', `Croisement trouvé ✓ (${(V()?.crosses || []).find((y) => y.cropId === c.cropId)?.name || ''})`));
    if (group === 'cross' && x.state !== 'unknown') {
      const cr = (V()?.crosses || []).find((y) => y.id === x.id);
      if (cr?.parents?.length) parts.push(el('p.vl-row-sub.is-soft', `${agree(x, 'Né')} de ${cr.parents.map((p) => p.name).join(' et ')}, chez vous.`));
    }
    return parts.length ? el('div.vl-vextra', parts) : null;
  }

  // ── Le prochain indice ──────────────────────────────────────────────────────────
  function hintAction(h) {
    if (!h || !on()) return null;
    const t = h.target || {};
    switch (h.kind) {
      case 'troc':
        return { label: 'Voir', go: () => openTroc() };
      case 'pair':
        return { label: 'Semer la paire', go: () => enterPair(t.id || t.cropId) };
      case 'library':
        return { label: 'Voir', go: () => openLibrary() };
      case 'story':
        return { label: 'Écouter Joseph', go: () => openStory(t.id || firstUnreadStory()) };
      default:
        return null;
    }
  }

  // ── Toucher dans la scène ────────────────────────────────────────────────────
  function onHit(hit) {
    if (!hit || !enabled()) return false;
    switch (hit.type) {
      case 'seedLibrary': {
        app.audio.play('page', { volume: 0.7 });
        const v = V();
        const s = stories(v).find((x) => x.id === 'heritage0' && x.available && !x.read);
        if (s && !v?.library?.level) openStory('heritage0');
        else openLibrary();
        return true;
      }
      case 'pairPlot':
        if (pairing) sowPairAt(hit.plotIndex, pairing);
        return true;
      default:
        return false;
    }
  }

  // ── « À faire maintenant » ────────────────────────────────────────────────────
  function todoItems(g = app.game) {
    if (!on(g)) return [];
    const v = V(g);
    if (!v) return [];
    const out = [];
    if (v.troc) out.push({ id: 'vl-troc', prio: 37, icon: () => portrait(v.troc.portrait, 'sprite--sm'), text: `${v.troc.clientName} propose un troc`, short: 'un troc à faire', go: () => openTroc() });
    const unreadChapter = (v.chapters || []).some((c) => c.available && !c.read);
    const st = firstUnreadStory(v);
    if (st && !unreadChapter) out.push({ id: 'vl-story', prio: 35, icon: () => vIcon(['portrait.joseph'], 'sprite--sm', '💬'), text: 'Joseph a quelque chose à vous dire', short: 'Joseph a quelque chose à dire', go: () => openStory(st) });
    return out;
  }

  // ── Tableau du village ─────────────────────────────────────────────────────────
  function boardCard(g = app.game) {
    const v = V(g);
    if (!v?.troc) return null;
    return el('section.vl-board-troc', trocCard(v.troc, { board: true }), v.library?.level || v.library?.site ? el('button.btn.vl-small.vl-board-lib', { type: 'button', id: 'vl-board-lib', onclick: () => openLibrary('troc') }, 'Voir la Grainothèque') : null);
  }
  /** Petit sachet sur la carte d'une commande quand le même voisin propose un troc. */
  function orderMark(o, g = app.game) {
    const t = on(g) ? g.state.career.valley.troc : null;
    if (!t || !o || o.clientId !== t.clientId) return null;
    return el('span.vl-order-pack', { title: 'Propose aussi un troc', 'aria-label': 'Propose aussi un troc' }, vIcon(['troc.pin', 'seedpack.village'], 'sprite--xs', '🌱'));
  }
  /** Écho doux : une fois le troc fait, une commande livrée sur trois (hachage pur de l'identifiant) parle du jardin. */
  function echoThanks(ev, g = app.game) {
    if (!on(g) || !ev?.clientId) return null;
    const sw = g.state.career.valley.swaps?.[ev.clientId];
    if (!sw) return null;
    let h = 0;
    for (const ch of String(ev.orderId ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    if (h % 3 !== 0) return null;
    const line = HD.TROC?.lines?.[ev.clientId]?.garden;
    const given = vDef(sw.given)?.name || '';
    if (!line) return given ? `Vos graines de ${given} ont pris dans mon jardin !` : null;
    return line.replace(/\{(variety|given|name)\}/g, given).replace(/\{farm\}/g, safe(() => app.game.query.career.valley().farmName, '') || '');
  }

  // ── Fiches existantes ───────────────────────────────────────────────────────────
  function plotRows(p) {
    if (!on() || !p?.variety?.cross || !p.cropId) return null;
    const c = p.variety.cross;
    if (c.linked) {
      return el('div.vl-plot-cross.tip-ok', vIcon(['fx.pollen', 'icon.cross'], 'sprite--xs', '🐝'), el('span', `Croisement avec ${c.partnerName} (à côté) : `), meetBar(c.meet || 0, c.need || 3), el('span', ' · récoltez-la à la main'));
    }
    return el('div.vl-plot-cross.tip-sub', vIcon(['icon.cross'], 'sprite--xs', '🐝'), el('span', `Semez ${c.partnerName} juste à côté pour ${genderOf(p.variety) === 'm' ? 'le' : 'la'} croiser`), c.meet ? meetBar(c.meet, c.need || 3) : null);
  }
  /** Feuille des graines : une ligne « Semer la paire » par culture dont le croisement se sème ici. */
  function seedRows(rows, index, { close } = {}) {
    if (!on() || !rows?.length) return null;
    const crops = new Map();
    for (const h of rows) if (h.pair && (h.group === 'village' || h.group === 'pays') && !crops.has(h.cropId)) crops.set(h.cropId, h);
    if (!crops.size) return null;
    const crosses = V()?.crosses || [];
    const out = [];
    for (const [cropId, h] of crops) {
      const c = crosses.find((y) => y.cropId === cropId);
      const can = !!h.pair.canPair;
      // Sans paire possible : la raison seulement si cette graine se sème ici aujourd'hui (pas de liste de refus).
      if (!can && (!h.pair.reason || !h.canSow)) continue;
      out.push(el(
        `button.seed-row.vl-pair-row${can ? '' : '.is-disabled'}`,
        { type: 'button', id: `seed-pair-${cropId}`, 'aria-disabled': can ? 'false' : 'true', onclick: () => (can ? sowPairAt(index, cropId, close) : refused(h.pair.reason)) },
        el('span.seed-icon.vl-pair-ico', { 'aria-hidden': 'true' }, varIcon(c?.parents?.[1] || h, 'sprite--sm'), varIcon(c?.parents?.[0] || h, 'sprite--sm')),
        el('span.seed-main', el('span.seed-name', 'Semer la paire'), el('span.seed-facts', el('span', c?.parents?.length ? c.parents.map((p) => p.name).join(' + ') : cropName(cropId))), el('span.seed-warns', c ? el('span.warn-chip.vl-chip-meet', `${c.meet || 0} / ${c.need || 3} rencontres`) : null, !can ? el('span.warn-chip.is-frost', h.pair.reason) : null)),
      ));
    }
    return out.length ? el('div.vl-pair-sec', out) : null;
  }

  /** Bilan annuel : « + 2 trocs, 1 croisement, Grainothèque niveau 2 ». */
  function yearLines(report) {
    const r = report?.valley;
    if (!r) return [];
    const out = [];
    if (r.swaps) out.push(plural(r.swaps, 'troc avec le village', 'trocs avec le village'));
    if (r.crosses) out.push(plural(r.crosses, 'croisement trouvé', 'croisements trouvés'));
    if (r.meets) out.push(plural(r.meets, 'rencontre d\'abeilles', 'rencontres d\'abeilles'));
    if (r.libraryLevel) out.push(`Grainothèque niveau ${r.libraryLevel}`);
    return out;
  }
  /** Carnet › Bilan : lignes de la Grainothèque. */
  function reportLines(v) {
    if (!v?.swaps) return [];
    const crosses = v.crosses || [];
    return [
      ['Grainothèque', v.library?.level ? `niveau ${v.library.level}` : '—'],
      ['Trocs avec le village', `${v.swaps.done} / ${v.swaps.total || 12}`],
      ['Croisements trouvés', `${crosses.filter((c) => c.found).length} / ${crosses.length || 11}`],
    ];
  }
  const pending = (v) => !!(v?.troc || firstUnreadStory(v));

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(ev, g) {
    if (!g || !enabled(g)) return;
    switch (ev.type) {
      case 'storyAvailable':
        if (ev.id === 'heritage0') morning('Joseph a une idée, derrière la maison…');
        app.toasts.show({ prio: 'important', kind: 'info', key: `vl-story-${ev.id}`, sprite: vIcon(['portrait.joseph'], 'sprite--sm', '💬'), text: 'Joseph a quelque chose à vous dire.', actionLabel: 'Écouter', onClick: () => openStory(ev.id), duration: 5600 });
        break;
      case 'seedLibraryBuilt':
        tone('reveal', { volume: 0.75, delay: 0.25 });
        app.toasts.show({ prio: 'important', kind: 'achievement', key: 'vl-lib', sprite: vIcon([`library.${Math.min(5, ev.level || 1)}`, 'icon.library'], 'sprite--sm', '🏡'), title: `${ev.name || 'La Grainothèque'} !`, text: (ev.unlocks || []).join(' · ') || 'Vos graines ont une maison.', actionLabel: 'Voir', onClick: () => openLibrary(), duration: 5600 });
        break;
      case 'trocOffered':
        morning(`${ev.clientName || 'Un voisin'} a épinglé un sachet au tableau.`);
        app.toasts.show({ prio: 'important', kind: 'info', key: 'vl-troc', sprite: portrait(`portrait.client.${ev.clientId}`, 'sprite--sm'), title: `${ev.clientName || 'Un voisin'} propose un troc`, text: ev.varietyName ? `${ev.varietyName}, contre une de vos graines.` : 'Un sachet au tableau du village.', actionLabel: 'Voir', onClick: () => openTroc(), duration: 6000 });
        tone('pop', { volume: 0.5, delay: 0.3 });
        break;
      case 'seedSwapped':
        if (app.sheets.current !== 'vl-troc') app.toasts.show({ prio: 'important', kind: 'success', key: 'vl-swapped', sprite: portrait(`portrait.client.${ev.clientId}`, 'sprite--sm'), title: `${ev.clientName} : merci !`, text: ev.thanks || 'Troc fait.', duration: 4200 });
        break;
      case 'crossMeeting': {
        const k = dayKey(g);
        if (day.key !== k) {
          day.key = k;
          day.meets = 0;
          day.lots = new Set();
        }
        day.meets += 1;
        const lot = safe(() => g.query.plot(ev.plotIndex)?.lotName, null);
        if (lot) day.lots.add(lot);
        app.toasts.show({ prio: 'info', kind: 'info', key: 'vl-meet', sprite: vIcon(['fx.pollen', 'icon.cross'], 'sprite--sm', '🐝'), text: `+ 1 rencontre · ${Math.min(ev.meet, ev.need)} / ${ev.need}`, duration: 2400, log: false });
        tone('chirp', { volume: 0.35, throttle: 400 });
        break;
      }
      case 'crossFound':
        morning(`Une variété nouvelle : ${ev.name}.`);
        windows.push({ kind: 'cross', data: ev });
        break;
      case 'pairSown':
        app.toasts.show({ prio: 'info', kind: 'success', key: 'vl-pairsown', sprite: vIcon(['icon.cross'], 'sprite--sm', '🐝'), text: 'Paire semée : récoltez l\'une à la main pendant que l\'autre pousse.', duration: 3000, log: false });
        break;
      case 'dawn':
        for (const line of morningLines()) morning(line);
        break;
      default:
        break;
    }
    if (live) schedule();
  }

  function morningLines() {
    const out = [];
    if (day.meets > 0 && day.key && day.key !== dayKey()) {
      const where = day.lots.size === 1 ? ` (${[...day.lots][0]})` : '';
      out.push(`Hier : ${plural(day.meets, 'rencontre', 'rencontres')} d'abeilles${where}.`);
    }
    if (day.key !== dayKey()) {
      day.key = dayKey();
      day.meets = 0;
      day.lots = new Set();
    }
    return out;
  }

  // ── À chaque image ─────────────────────────────────────────────────────────────
  function frame() {
    const g = app.game;
    if (pairing) {
      if (!g || app.inMenu || g.state.status !== 'playing' || app.dialogs.isOpen() || !on(g)) leavePair({ silent: true });
      else if (bar) paintBar();
    }
    if (!g || app.inMenu || !enabled(g)) return;
    if (windows.length && g.state.status === 'playing' && !app.dialogs.isOpen() && !app.sheets.isOpen() && !(app.coach ? app.coach.blocking : app.hints?.active || app.tutorial?.active) && !app.cozy?.feteMode && !pairing && !app.valley?.placing && !app.decor?.active && !app.valleyView?.active && !app.places?.wilding) {
      const w = windows.shift();
      if (w.kind === 'cross') {
        showCross(w.data);
        // Le premier croisement : le récit « Le premier croisement » suit.
        if (w.data.story) windows.unshift({ kind: 'story', data: { id: w.data.story } });
      } else if (w.kind === 'story') openStory(w.data.id);
    }
  }

  function reset(g = null) {
    if (pairing) leavePair({ silent: true });
    live = null;
    windows.length = 0;
    tab = 'shelf';
    trocPick = null;
    trocDone = null;
    day.key = '';
    day.meets = 0;
    day.lots = new Set();
    void g;
  }

  return {
    openLibrary,
    openTroc,
    openCross,
    enterPair,
    leavePair,
    get pairing() {
      return pairing;
    },
    sowPairAt,
    openStory,
    openBox,
    onEvent,
    onHit,
    todoItems,
    boardCard,
    orderMark,
    echoThanks,
    plotRows,
    seedRows,
    seedsTop,
    seedGroups,
    boxButton,
    storyButtons,
    varietyExtra,
    hintAction,
    yearLines,
    reportLines,
    pending,
    morningLines,
    frame,
    reset,
    on,
    debugState: () => ({ live: live?.id || null, tab, pairing, windows: windows.map((w) => w.kind), trocPick, trocDone: !!trocDone }),
  };
}
