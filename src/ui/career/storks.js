// Interface de La Vallée vivante, lot V4 « Les cigognes » (docs/VALLEE.md § 18 ; contrat : docs/ARCHITECTURE.md, « Vallée
// vivante — contrats du lot V4 », « Ce que RENDER et UI consomment » et « Écarts et précisions (livraison CORE V4) »).
//
// createStorks(app) → app.storks = {
//   on(game)                 le V4 existe dans cette carrière (Vallée commencée, parties storks / places / heritage, v ≥ 4)
//   legendsTab(v)            segment « Légendes » de la Grainothèque (4 lignes ≥ 72 px : cloche, état, Semer / Récolter)
//   legendShelf(v)           4ᵉ étagère « Les légendes 2 / 4 » (bocaux à couvercle doré)
//   legendsGroup(v), visitorsGroup(v)   groupes repliés « Légendes » (La Vallée › Graines), « Visiteurs rares » (Habitants)
//   bookButton()             bouton « Le livre » de l'en-tête de « La Vallée » (≥ 48 px)
//   openLegend(id), sowLegend(id), harvestLegend(id), observeVisitor(id), openNest()
//   openEpilogue(), playCredits(), openBench(), contemplate()       la fin douce, le banc, la contemplation
//   onEvent(ev, game), onHit(hit) → bool (scène), onViewHit(hit) → bool (vue de la vallée)
//   todoItems(game)          vl-visitor, vl-storks, vl-legend, vl-epilogue, vl-postcard (jamais « ressemez »)
//   hintAction(h)            visitor, legendRipe, legendSow, storkNeed, epilogue, postcard
//   yearLines(report), yearBlock(report)   bilan annuel (visiteurs, légendes, cigogneaux ; avant / après)
//   reportLines(v), pending(v), scape(game) → natureScape | null (main.js : paysage sonore), frame(dt), reset(game|null)
//   debugState()
// }
//
// Règles : décoratif (aucune pièce) ; rien ne presse, rien n'expire (un visiteur attend, une légende mûre attend) ; jamais
// de ligne « À faire » pour ressemer ; cibles ≥ 48 px, textes ≥ 14 px, pictogramme ET mot ; lecteurs d'écran
// (« en fleur, encore 3 jours », « vu », « 2 générations sur 3 ») ; mouvements réduits ; temps en pause pendant la lecture,
// l'épilogue, le générique (« seule la vallée s'entend ») et la contemplation.

import { el, plural } from '../dom.js';
import { v3 } from '../v3.js';
import { vIcon } from './valley.js';
import { natureScape, phaseOf } from '../../audio/soundscape.js';
import { viewSoundSpots, PLACE_RECTS } from '../../render/valley-view.js';
import * as SD from '../../data/career/storks.js';
import { absDay } from '../../core/surprises.js';

const LEGEND_EMOJI = { motherMelon: '🍈', millEinkorn: '🌾', farmMarvel: '🍅', storkPea: '🫛' };
const VISITOR_EMOJI = { whiteStork: '🕊', crane: '🐦', redDeer: '🦌', oriole: '🐤', beaver: '🦫', glowworms: '✨' };
const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const LEGEND_DEF = (id) => SD.LEGENDS_BY_ID?.[id] || null;
const VISITOR_DEF = (id) => SD.VISITORS_BY_ID?.[id] || null;
const fill = (t, vars) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
/** « mûr », « mûre », « mûrs » (accords des légendes). */
function agree(x, word) {
  const f = x?.g === 'f';
  const pl = !!x?.pl;
  return `${word}${f ? 'e' : ''}${pl ? 's' : ''}`;
}
const daysText = (n) => plural(Math.max(0, Math.ceil(n || 0)), 'jour');

export function legendIcon(x, cls = 'sprite--md') {
  return vIcon([x?.icon, `legend.${x?.id}.icon`, 'legend.jar'], cls, LEGEND_EMOJI[x?.id] || '🫙');
}
export function visitorIcon(id, cls = 'sprite--md') {
  return vIcon([`visitor.${id}`, VISITOR_DEF(id)?.icon], cls, VISITOR_EMOJI[id] || '🪶');
}
/** Petit dessin de la cloche d'une légende (sprite de la scène, 8 × 12). */
function clocheIcon(l, cls = 'sprite--md') {
  const name = l?.cloche?.sprite || (l?.state === 'awake' ? 'legend.cloche' : null);
  return vIcon([name, 'legend.cloche'], `${cls}.vl4-cloche-ico`, l?.state === 'awake' ? '🔔' : '?');
}

export function createStorks(app) {
  let live = null; // { id, build, sig, lastSig }
  let queued = false;
  const windows = []; // { kind: 'story' | 'legend' | 'first' | 'visitor' | 'epiAfter', data }
  const visToasts = new Map();
  let epiPage = 0;
  let firstHarvest = null; // résultat de la première récolte d'une légende (fenêtre courte)
  let observed = null; // résultat d'observeVisitor (fenêtre d'observation)
  let pendingWheel = null; // la roue posée : message après la lecture du chapitre 8
  let groupLegends = false;
  let groupVisitors = false;
  let ambKey = '';
  let ambT = 0;
  const day = { key: '' };

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.mode === 'career' && g.state?.career?.valley);
  const on = (g = app.game) => {
    if (!enabled(g)) return false;
    const v = g.state.career.valley;
    const p = v.parts || {};
    return !!v.started && (v.v || 1) >= 4 && p.storks !== false && p.places !== false && p.heritage !== false;
  };
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Cigognes :', err);
      return fallback;
    }
  }
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  const V = (g = app.game) => (on(g) ? q('valley', g) : null);
  const S = (g = app.game) => (enabled(g) ? g.state.career.valley : null);
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
    app.scene?.storksTouch?.();
    return res;
  }
  const morning = (text) => text && app.todo?.morningNote?.(text);
  const tone = (name, opts) => app.audio.tone?.(name, opts);
  const reduced = () => !!app.reducedMotion?.();
  const busy = () => app.dialogs.isOpen() || app.sheets.isOpen() || !!app.coach?.blocking || !!app.cozy?.feteMode || !!app.heritage?.pairing || !!app.valley?.placing || !!app.decor?.active || !!app.places?.wilding || !!app.valleyView?.crediting || !!app.valleyBook?.isOpen;

  // ── Feuilles « vivantes » ──────────────────────────────────────────────────────
  function openLive(id, { title, icon: ico, build, sig, tall = false, pauses, outsideClose, onClose }) {
    const node = safe(build, null) || el('p.sheet-empty', 'Rien pour l\'instant.');
    app.sheets.open({
      id, kind: 'popup', tall, title, icon: ico, content: node, className: `vl-sheet vl4-sheet vl-sheet--${id}`, pauses, outsideClose,
      onClose: (r) => {
        if (live?.id === id) live = null;
        onClose?.(r);
      },
    });
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

  // ── Petits morceaux ────────────────────────────────────────────────────────────
  function bar(progress, label) {
    const pct = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);
    return el(
      'span.vl3-bar.vl4-bar',
      { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': label || `${pct} %` },
      el('span.vl3-bar-fill', { style: { width: `${pct}%` }, 'aria-hidden': 'true' }),
    );
  }
  function gensBar(n, need) {
    const max = Math.max(1, need | 0);
    const k = Math.max(0, Math.min(max, n | 0));
    return el(
      'span.vl-fix.vl4-gens',
      { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(k), 'aria-label': `${k} ${k > 1 ? 'générations' : 'génération'} sur ${max}` },
      el('span.vl-fix-bar', { 'aria-hidden': 'true' }, Array.from({ length: max }, (_, i) => el(`span.vl-fix-seg${i < k ? '.is-on' : ''}`))),
      el('span.vl-fix-txt', { 'aria-hidden': 'true' }, `${k} / ${max}`),
    );
  }
  const legends = (v = V()) => (Array.isArray(v?.legends) ? v.legends : []);
  const legendOf = (id, v = V()) => legends(v).find((l) => l.id === id) || null;
  const visitors = (v = V()) => (Array.isArray(v?.visitors) ? v.visitors : []);
  const visitorOf = (id, v = V()) => visitors(v).find((x) => x.id === id) || null;
  const yearOf = (abs) => {
    const L = app.game?.state?.career?.seasonLength || 7;
    return Math.floor((Math.max(1, abs) - 1) / (4 * L)) + 1;
  };

  /** État court d'une légende : « Mûr ! », « En fleur · encore 2 jours », « Prête à semer », « Endormie · 2 / 3 ». */
  function legendState(l) {
    if (!l) return '';
    if (l.state !== 'awake') return l.gens ? `Endormie · ${l.gens.n} / ${l.gens.need} générations` : 'Endormie';
    if (l.needLibrary) return l.waitsHome || 'Elle attend sa maison : la Grainothèque.';
    const c = l.cloche;
    if (!c || c.state === 'free') return 'Prête à semer';
    if (c.state === 'ripe') return `${capitalize(agree(l, 'mûr'))} !`;
    return `${c.stage >= 1 ? 'En fleur' : 'Semis'} · encore ${daysText(c.daysLeft)}`;
  }
  function legendAria(l) {
    const name = l.state === 'awake' || l.gens ? l.fullName || l.name : 'Une légende endormie';
    return `${name} : ${lower(legendState(l))}${l.harvests ? `, ${plural(l.harvests, 'récolte')}` : ''}`;
  }

  // ── Segment « Légendes » de la Grainothèque ─────────────────────────────────────
  function legendAction(l, small = true) {
    if (!l || l.state !== 'awake' || l.needLibrary) return null;
    const c = l.cloche;
    const cls = small ? 'button.btn.btn--red.vl-small' : 'button.btn.btn--red.btn--big.btn--wide';
    if (c?.state === 'ripe') return el(`${cls}.vl4-harvest`, { type: 'button', id: `vl4-harvest-${l.id}`, onclick: () => harvestLegend(l.id) }, 'Récolter à la main');
    if (!c || c.state === 'free') {
      if (l.canSow) return el(`${cls}.vl4-sow`, { type: 'button', id: `vl4-sow-${l.id}`, onclick: () => sowLegend(l.id) }, 'Semer');
      return l.sowReason ? el('small.vl-row-sub', l.sowReason) : null;
    }
    return null;
  }
  function legendRow(l) {
    const awake = l.state === 'awake';
    const c = l.cloche;
    const sub = [];
    sub.push(el(`span.vl-row-sub${c?.state === 'ripe' ? '.is-ok' : ''}`, legendState(l)));
    if (c?.state === 'growing') sub.push(bar(c.progress, `${Math.round((c.progress || 0) * 100)} %, encore ${daysText(c.daysLeft)}`));
    if (!awake) {
      if (l.gens) sub.push(gensBar(l.gens.n, l.gens.need));
      if (l.wakeText) sub.push(el('span.vl-row-sub.is-soft', l.wakeText));
    }
    return el(
      `article.vl-row.vl4-legend.is-${awake ? c?.state || 'free' : 'asleep'}`,
      { id: `vl4-legend-${l.id}` },
      el(
        'button.vl4-leg-pic',
        { type: 'button', id: `vl4-leg-open-${l.id}`, 'aria-label': legendAria(l), onclick: () => openLegend(l.id) },
        awake ? clocheIcon(l, 'sprite--md') : el('span.vl4-silhouette', { 'aria-hidden': 'true' }, l.gens ? legendIcon(l, 'sprite--md') : '?'),
      ),
      el('div.vl-row-main', { 'aria-hidden': 'true' }, el('span.vl-row-name', awake || l.gens ? l.fullName || l.name : `? (${LEGEND_DEF(l.id)?.short || 'une graine'})`), sub),
      legendAction(l),
    );
  }
  function legendsTab(v = V()) {
    const list = legends(v);
    if (!list.length) return el('p.sheet-empty', 'Les légendes dorment encore.');
    const awake = list.filter((l) => l.state === 'awake').length;
    return el(
      'div.vl4-legends',
      el('p.vl-count', `${awake} / ${list.length} légendes réveillées`),
      el('div.vl-rows', list.map(legendRow)),
      el('p.sheet-hint.vl4-hint', 'Sous cloche : toute saison, sans eau. Une légende ne se vend pas : elle se garde.'),
    );
  }
  /** La 4ᵉ étagère (L'étagère de la Grainothèque) : bocaux à couvercle doré. */
  function legendShelf(v = V()) {
    const list = legends(v);
    if (!list.length) return null;
    const awake = list.filter((l) => l.state === 'awake').length;
    return el(
      'section.vl-shelf-row.vl4-shelf',
      { 'aria-label': `Les légendes : ${awake} sur ${list.length}` },
      el('h3.vl-shelf-title', el('span', 'Les légendes'), el('small', `${awake} / ${list.length}`)),
      el(
        'div.vl-jars-grid',
        list.map((l) => {
          const known = l.state === 'awake';
          return el(
            `button.vl-jar-tile.vl4-jar${known ? '.is-fixed' : '.is-unknown'}`,
            { type: 'button', id: `vl4-jar-${l.id}`, 'aria-label': known ? `${l.fullName || l.name}, ${plural(l.harvests || 0, 'récolte')}` : 'Une légende endormie', onclick: () => openLegend(l.id) },
            el('span.vl-jar-glass', { 'aria-hidden': 'true' }, known ? legendIcon(l, 'sprite--md') : vIcon(['legend.jar', 'jar.empty'], 'sprite--md', '🫙')),
            el(`span.vl-jar-badge${known ? '.is-ok' : '.is-q'}`, { 'aria-hidden': 'true' }, known ? '✦' : '?'),
          );
        }),
      ),
    );
  }

  // ── Fiche d'une légende ──────────────────────────────────────────────────────────
  function legendContent(id) {
    const l = legendOf(id);
    if (!l) return el('p.sheet-empty', 'Légende inconnue.');
    const awake = l.state === 'awake';
    const parts = [el('div.vl-big.vl4-big', awake || l.gens ? legendIcon(l, 'sprite--hero') : vIcon(['legend.jar'], 'sprite--hero', '🫙'))];
    parts.push(el('h3.vl-obs-title', awake || l.gens ? l.fullName || l.name : 'Une légende endormie'));
    if (awake && l.sub) parts.push(el('p.vl4-sub', l.sub));
    if (awake && l.anecdote) parts.push(el('p.cz-say', `« ${l.anecdote} »`));
    if (!awake) {
      if (l.gens) parts.push(el('div.vl4-gensline', el('span', 'Générations : '), gensBar(l.gens.n, l.gens.need)));
      if (l.wakeText) parts.push(el('p.vl-note', l.wakeText));
    } else {
      const facts = [];
      if (l.awokeAt) facts.push(`Réveillée l'an ${yearOf(l.awokeAt)}`);
      facts.push(plural(l.harvests || 0, 'récolte'));
      parts.push(el('p.stats-note.vl4-facts', facts.join(' · ')));
      parts.push(el('p.vl4-state', { role: 'status' }, legendState(l)));
      if (l.cloche?.state === 'growing') parts.push(bar(l.cloche.progress, `${Math.round((l.cloche.progress || 0) * 100)} %, encore ${daysText(l.cloche.daysLeft)}`));
      const a = legendAction(l, false);
      if (a) parts.push(a);
      parts.push(el('p.sheet-hint', 'Sous cloche : toute saison, sans eau. On la récolte à la main, pour le plaisir.'));
    }
    return el('div.vl4-legend-sheet', parts);
  }
  function openLegend(id) {
    if (!on()) return false;
    const l = legendOf(id);
    return openLive('vl4-legend', { title: l?.state === 'awake' ? 'Une légende' : 'Une graine qui dort', icon: vIcon(['icon.legend', 'legend.jar'], 'sprite--md', '🫙'), build: () => legendContent(id), sig: () => JSON.stringify(legendOf(id)) });
  }
  function sowLegend(id) {
    const res = act('sowLegend', id);
    if (!res?.ok) return false;
    app.audio.play('plant', { volume: 0.85 });
    app.vibrate?.(10);
    const l = legendOf(id);
    app.toasts.show({ prio: 'info', kind: 'success', key: `vl4-sown-${id}`, sprite: legendIcon(l || LEGEND_DEF(id), 'sprite--sm'), text: `${l?.fullName || LEGEND_DEF(id)?.name || 'La légende'} sous sa cloche : ${daysText(res.days)}.`, duration: 2600, log: false });
    repaint();
    app.heritage?.repaint?.();
    return true;
  }
  function harvestLegend(id) {
    const res = act('harvestLegend', id);
    if (!res?.ok) return false;
    tone('pop', { volume: 0.9 });
    app.vibrate?.([10, 30, 10]);
    if (res.first) {
      firstHarvest = { ...res, id };
      app.sheets.close('silent');
      requestAnimationFrame(() => openFirstHarvest());
    } else {
      const l = legendOf(id) || LEGEND_DEF(id);
      app.toasts.show({ prio: 'info', kind: 'success', key: `vl4-harv-${id}`, sprite: legendIcon(l, 'sprite--sm'), text: fill(SD.STORKS_TEXTS?.harvested || '{name} récolté{e} : la Grainothèque en garde les graines.', { name: l?.fullName || l?.name || 'La légende', e: l?.g === 'f' ? 'e' : '' }).replace(/récolté(e?) :/, `récolté$1${l?.pl ? 's' : ''} :`), duration: 3000 });
      repaint();
      app.heritage?.repaint?.();
    }
    return true;
  }
  function openFirstHarvest() {
    const r = firstHarvest;
    if (!r) return false;
    const l = legendOf(r.id) || { ...LEGEND_DEF(r.id), id: r.id };
    tone('chime', { volume: 0.7, delay: 0.1 });
    return openLive('vl4-first', {
      title: 'Une première récolte',
      icon: vIcon(['icon.legend'], 'sprite--md', '🫙'),
      build: () => el(
        'div.vl-observe.vl4-first',
        el('div.vl-big', legendIcon(l, 'sprite--hero')),
        el('h3.vl-obs-title', { role: 'status' }, l.fullName || l.name),
        el('p.cz-say', `« ${r.line || LEGEND_DEF(r.id)?.firstHarvest || ''} »`),
        el('p.vl-ok', '✓ Album : Les légendes'),
        el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl4-first-ok', onclick: () => app.sheets.close() }, 'Merci'),
      ),
      sig: () => '',
      onClose: () => {
        firstHarvest = null;
      },
    });
  }

  // ── Une légende se réveille (récit, puis popup) ──────────────────────────────────
  function wakeContent(d) {
    const l = legendOf(d.id) || { ...LEGEND_DEF(d.id), id: d.id };
    const lib = !(l.needLibrary ?? d.needLibrary);
    return el(
      'div.vl-observe.vl4-wake',
      el('div.vl-big.vl4-jar-pop', vIcon(['legend.jar'], 'sprite--hero', '🫙')),
      el('h3.vl-obs-title', { role: 'status' }, 'Une légende se réveille !'),
      el('p.vl4-wake-name', l.fullName || d.name || l.name),
      l.sub || d.sub ? el('p.vl4-sub', l.sub || d.sub) : null,
      l.anecdote || d.anecdote ? el('p.cz-say', `« ${l.anecdote || d.anecdote} »`) : null,
      el('p.vl-ok', lib ? '✓ Sous sa cloche, devant la Grainothèque' : l.waitsHome || 'Elle attend sa maison : la Grainothèque.'),
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', id: 'vl4-wake-later', onclick: () => app.sheets.close() }, 'Plus tard'),
        lib ? el('button.btn.btn--wide.btn--red', { type: 'button', id: 'vl4-wake-sow', onclick: () => { if (sowLegend(d.id)) app.sheets.close(); } }, 'Semer') : null,
      ),
    );
  }
  function showWake(d) {
    tone('legend', { volume: 0.8 });
    return openLive('vl4-wake', { title: 'Une légende', icon: vIcon(['icon.legend', 'legend.jar'], 'sprite--md', '🫙'), build: () => wakeContent(d), sig: () => JSON.stringify(legendOf(d.id)) });
  }

  // ── Visiteurs rares ───────────────────────────────────────────────────────────────
  function observeContent(r) {
    const id = r.visitorId || r.id;
    const def = VISITOR_DEF(id) || {};
    const n = r.n ?? visitors().filter((x) => x.state === 'seen').length;
    const total = r.total ?? (visitors().length || 6);
    return el(
      'div.vl-observe.vl4-observe',
      el('div.vl-big', visitorIcon(id, 'sprite--hero')),
      el('h3.vl-obs-title', { role: 'status' }, r.title || def.title || r.name || 'Un visiteur rare'),
      r.anecdote || def.anecdote ? el('p.cz-say', `« ${r.anecdote || def.anecdote} »`) : null,
      el('p.vl-ok', `✓ Les visiteurs rares (${n} / ${total})`),
      el('button.btn.btn--red.btn--big.btn--wide.vl-go.vl-welcome', { type: 'button', id: 'vl4-welcome', onclick: () => app.sheets.close() }, 'Quelle chance !'),
    );
  }
  function showObserve(r) {
    observed = r;
    const id = r.visitorId || r.id;
    app.toasts.hide?.(visToasts.get(id));
    app.toasts.forget?.(`vl4-vis-${id}`);
    visToasts.delete(id);
    openLive('vl4-observe', { title: 'Un visiteur rare', icon: visitorIcon(id, 'sprite--md'), build: () => observeContent(r), sig: () => '', onClose: () => { observed = null; } });
    if (app.valleyView?.active) app.valleyView.keepVisible?.({ type: 'visitor', id });
  }
  function observeVisitor(id) {
    const res = act('observeVisitor', id);
    if (!res?.ok) return false;
    if (id === 'whiteStork') tone('clatter', { volume: 0.9 });
    else tone('chirp', { volume: 0.9, throttle: 300 });
    if (id !== 'glowworms') app.audio.playNature?.(id, { volume: 0.8 });
    app.vibrate?.([12, 50, 12]);
    showObserve({ ...res, visitorId: id });
    return true;
  }
  /** Va voir un visiteur : la vue de la vallée (défilée jusqu'à lui), ou la ferme (vers luisants). */
  function goVisitor(id) {
    const x = visitorOf(id);
    if (x?.whereKind === 'farm' || id === 'glowworms') {
      app.sheets.close('silent');
      app.valleyView?.close?.({ silent: true });
      requestAnimationFrame(() => focusScene('visitor', 'glowworms'));
      return true;
    }
    app.sheets.close('silent');
    return !!app.valleyView?.open?.({ visitorId: id });
  }
  function focusScene(kind, id) {
    const r = safe(() => app.scene?.storksItemRect?.(kind, id), null);
    if (!r) return false;
    safe(() => app.scene.focusWorld?.(r.x + r.w / 2, r.y + r.h / 2, { animate: !reduced() }), null);
    let n = 0;
    const pad = { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 };
    const paint = () => {
      const pr = app.worldPageRect?.(pad);
      app.todo?.ring?.(pr ? [pr] : []);
      if (++n < 40) requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);
    clearTimeout(focusScene.timer);
    focusScene.timer = setTimeout(() => app.todo?.ring?.([]), 2400);
    return true;
  }

  /** Groupe replié « Visiteurs rares » (La Vallée › Habitants). */
  function visitorRow(x) {
    const known = x.state === 'seen';
    const waiting = x.state === 'visible';
    const recipe = known ? null : el(
      'ul.vl-recipe',
      { 'aria-label': 'Ce qu\'il lui faut' },
      (x.recipe || []).map((r) => el(`li${r.ok ? '.is-ok' : ''}`, el('span.vl-check', { 'aria-hidden': 'true' }, r.ok ? '✓' : '✗'), el('span', r.text), el('span.sr-only', r.ok ? ' : prêt' : ' : pas encore'))),
      el(`li${x.inSeason ? '.is-ok' : ''}`, el('span.vl-check', { 'aria-hidden': 'true' }, x.inSeason ? '✓' : '·'), el('span', capitalize(x.seasonsText || ''))),
    );
    let state = null;
    let action = null;
    if (known) state = el('p.vl-row-sub.is-ok', `Vu ✓${x.seenAt ? ` · l'an ${yearOf(x.seenAt)}` : ''}`);
    else if (waiting) {
      state = el('p.vl-row-sub.is-wait', x.still || `${x.halt || x.title || 'Il fait halte'}.`);
      action = el('button.btn.btn--red.vl-small', { type: 'button', id: `vl4-see-${x.id}`, onclick: () => goVisitor(x.id) }, 'Aller voir');
    } else if (x.state === 'hint' && x.hint) state = el('p.vl-row-sub', `Indice : ${lower(x.hint)}`);
    return el(
      `article.vl-row.vl-species.vl4-visitor.is-${x.state}`,
      { id: `vl4-vis-${x.id}` },
      el('span.vl-row-ico', known || waiting ? visitorIcon(x.id, 'sprite--md') : el('span.vl3-sp-unknown', { 'aria-hidden': 'true' }, '?')),
      el('div.vl-row-main', el('span.vl-row-name', known || waiting ? x.name : `${x.name} · pas encore venu${x.g === 'f' ? 'e' : ''}${x.pl ? 's' : ''}`), el('span.vl-row-sub.is-soft', `${capitalize(x.where || '')} · ${x.seasonsText || ''}`), recipe, state, known && x.anecdote ? el('p.cz-say.vl-anec', `« ${x.anecdote} »`) : null),
      action,
    );
  }
  function visitorsGroup(v = V()) {
    const list = visitors(v);
    if (!list.length) return null;
    const n = list.filter((x) => x.state === 'seen').length;
    const waiting = list.some((x) => x.state === 'visible');
    const open = groupVisitors || waiting;
    const order = { visible: 0, hint: 1, unknown: 2, seen: 3 };
    return el(
      'section.vl3-spgroup.vl4-visgroup',
      el(
        'button.vl3-spgroup-head',
        { type: 'button', id: 'vl4-visgroup', 'aria-expanded': open ? 'true' : 'false', onclick: () => { groupVisitors = !open; app.valley?.repaint?.(); } },
        el('span', `Visiteurs rares · ${n} / ${list.length}`),
        waiting ? el('span.vl-dot', { 'aria-hidden': 'true' }) : null,
        el('span.c-row-go', { 'aria-hidden': 'true' }, open ? '▾' : '›'),
      ),
      open ? el('div.vl-rows', [...list].sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2)).map(visitorRow)) : null,
    );
  }
  /** Groupe replié « Légendes » (La Vallée › Graines) : « 2 / 4 », et la carte de la Grainothèque. */
  function legendsGroup(v = V()) {
    const list = legends(v);
    if (!list.length) return null;
    const n = list.filter((l) => l.state === 'awake').length;
    const ripe = list.some((l) => l.cloche?.state === 'ripe');
    const open = groupLegends || ripe;
    return el(
      'section.vl3-spgroup.vl4-leggroup',
      el(
        'button.vl3-spgroup-head',
        { type: 'button', id: 'vl4-leggroup', 'aria-expanded': open ? 'true' : 'false', onclick: () => { groupLegends = !open; app.valley?.repaint?.(); } },
        el('span', `Légendes · ${n} / ${list.length}`),
        ripe ? el('span.vl-dot', { 'aria-hidden': 'true' }) : null,
        el('span.c-row-go', { 'aria-hidden': 'true' }, open ? '▾' : '›'),
      ),
      open ? el('div.vl4-leggroup-body', el('div.vl-rows', list.map(legendRow)), el('button.btn.btn--wide.vl4-leg-lib', { type: 'button', id: 'vl4-leg-lib', onclick: () => app.heritage?.openLibrary?.('legends') }, 'Les cloches de la Grainothèque')) : null,
    );
  }

  // ── Le nid sur la maison ──────────────────────────────────────────────────────────
  function nestContent() {
    const v = V();
    const s = v?.stork || {};
    const sc = q('valleyScenery');
    const nest = sc?.nest || null;
    const dayText = s.dayText || SD.STORKS_TEXTS && `${s.day || 3}ᵉ jour du printemps`;
    let line;
    if (!s.farmSince) line = SD.STORKS_TEXTS?.wheel || 'Joseph a posé une vieille roue de charrette sur votre cheminée.';
    else if (nest?.state === 'pair' || nest?.state === 'chicks') {
      const n = s.thisYear?.chicks || 0;
      line = fill(SD.STORKS_TEXTS?.storkNest || 'Revenues le {day} · {chicks}', { day: dayText, chicks: n ? plural(n, 'cigogneau', 'cigogneaux') : 'pas encore de petits' });
    } else line = fill(SD.STORKS_TEXTS?.storksLeft || 'Les cigognes sont parties vers le sud. Elles reviendront le {day}.', { day: dayText });
    return el(
      'div.vl-observe.vl4-nest',
      el('div.vl-big', vIcon([nest?.state === 'chicks' ? 'stork.nest.chicks' : nest?.state === 'pair' ? 'stork.nest.pair' : nest?.state === 'snow' ? 'stork.nest.snow' : 'stork.wheel'], 'sprite--hero', '🪺')),
      el('p.vl4-nest-line', { role: 'status' }, line),
      s.years ? el('p.stats-note', `${plural(s.years, 'printemps', 'printemps')} sur la maison`) : null,
      el('p.sheet-hint', 'Une cigogne sur le toit, c\'est une maison heureuse.'),
      el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl4-nest-ok', onclick: () => app.sheets.close() }, 'Fermer'),
    );
  }
  function openNest() {
    if (!on()) return false;
    tone('clatter', { volume: 0.6 });
    return openLive('vl4-nest', { title: 'Les cigognes', icon: vIcon(['icon.visitor', 'visitor.whiteStork'], 'sprite--md', '🕊'), build: nestContent, sig: () => '' });
  }

  // ── L'épilogue de Joseph ──────────────────────────────────────────────────────────
  function epilogueInfo() {
    return q('valleyEpilogue');
  }
  function epilogueContent() {
    const e = epilogueInfo();
    const pages = e?.pages || SD.EPILOGUE?.pages || [];
    const i = Math.max(0, Math.min(pages.length - 1, epiPage));
    const p = pages[i] || { lines: [] };
    const last = i >= pages.length - 1;
    return el(
      'div.vl-chapter.cz-veillee.vl4-epilogue',
      el('div.cz-vignette.vl-vignette', vIcon([p.vignette, 'story.epilogue.1', 'story.box'], 'sprite--vl-vignette', '🌄')),
      el('h3.cz-story-title', `${e?.title || SD.EPILOGUE?.title || 'La vallée retrouvée'}`, el('small.vl4-page', ` · ${i + 1} / ${pages.length}`)),
      el('div.cz-story', { 'aria-live': 'polite' }, p.lines.map((l, k) => el(`p.cz-story-line${reduced() ? '.is-still' : ''}`, { style: { '--cz-delay': `${k}` } }, `« ${l} »`))),
      el(
        'button.btn.btn--red.btn--big.btn--wide.vl-go',
        { type: 'button', id: last ? 'vl4-epi-ok' : 'vl4-epi-next', onclick: () => (last ? readEpilogue() : nextEpiPage()) },
        last ? 'Merci, Joseph' : 'Suivant ›',
      ),
    );
  }
  function nextEpiPage() {
    epiPage += 1;
    app.audio.play('page', { volume: 0.6 });
    app.vibrate?.(8);
    repaint();
  }
  function openEpilogue() {
    const e = epilogueInfo();
    if (!e?.available && !e?.read) {
      refused(SD.STORKS_TEXTS?.epilogueNotYet || 'Pas encore.');
      return false;
    }
    epiPage = 0;
    tone('magic', { volume: 0.6 });
    if (app.valleyView?.active) app.valleyView.keepVisible?.({ type: 'bench' });
    return openLive('vl4-epilogue', { title: 'Joseph raconte', icon: vIcon(['portrait.joseph'], 'sprite--md', '💬'), build: epilogueContent, sig: () => String(epiPage), tall: true, outsideClose: false });
  }
  function readEpilogue() {
    const was = !!epilogueInfo()?.read;
    const res = was ? { ok: true, first: false } : act('readEpilogue');
    if (!res?.ok) return;
    app.vibrate?.(10);
    if (res.first || !was) {
      // Décor offert « La boîte en fer » (progression permanente).
      const P = v3.progression;
      if (typeof P?.recordValleyEpilogue === 'function') {
        try {
          const r = P.recordValleyEpilogue(app.progression.get());
          if (r?.progress) app.progression.commit(r.progress);
          if (r?.rewards?.cosmeticId && !r.rewards.already) app.toasts.show({ prio: 'important', kind: 'achievement', key: 'vl4-ironbox', sprite: vIcon(['decor.iron.box', 'valley.box.gift'], 'sprite--sm', '🎁'), title: 'Nouveau décor : La boîte en fer', text: 'Menu › Décorer', duration: 4200 });
        } catch (err) {
          console.warn('recordValleyEpilogue :', err);
        }
      }
    }
    app.sheets.close('silent');
    requestAnimationFrame(() => openEpilogueAfter());
  }
  function openEpilogueAfter() {
    const after = SD.EPILOGUE?.after || { watch: 'Regarder la vallée', later: 'Plus tard' };
    return openLive('vl4-epi-after', {
      title: 'La vallée retrouvée',
      icon: vIcon(['valley.box.gift', 'valley.box'], 'sprite--md', '🎁'),
      outsideClose: false,
      build: () => el(
        'div.vl4-epi-after',
        el('p.cz-lead', 'La vallée continue. Voulez-vous la regarder, au soir ?'),
        el('button.btn.btn--red.btn--big.btn--wide.vl4-watch', { type: 'button', id: 'vl4-watch', onclick: () => { app.sheets.close('silent'); requestAnimationFrame(() => playCredits()); } }, after.watch),
        el('button.btn.btn--wide.vl4-later', { type: 'button', id: 'vl4-later', onclick: () => app.sheets.close() }, `${after.later} (dans le livre)`),
      ),
      sig: () => '',
    });
  }

  // ── Le générique doux et la contemplation ────────────────────────────────────────
  function playCredits() {
    const e = epilogueInfo();
    if (!e?.read) {
      refused(SD.STORKS_TEXTS?.creditsNotYet || 'Après l\'épilogue de Joseph.');
      return false;
    }
    if (!app.valleyView?.startCredits) return false;
    app.valleyBook?.close?.({ silent: true });
    return app.valleyView.startCredits(e.credits || {}, {
      onEnd: () => {
        if (!epilogueInfo()?.credits) act('seeCredits');
        else safe(() => app.game.actions.career.seeCredits?.(), null);
      },
    });
  }
  function contemplate() {
    if (!q('valleyView')?.canContemplate) return false;
    return !!app.valleyView?.startContemplate?.();
  }

  // ── Le banc (Joseph et Hélène) ───────────────────────────────────────────────────
  function benchContent() {
    const b = q('valleyBench');
    const view = q('valleyView');
    return el(
      'div.vl-observe.vl4-bench',
      el('div.vl4-bench-pics', { 'aria-hidden': 'true' }, vIcon(['view.joseph.seated', 'portrait.joseph'], 'sprite--card', '👴'), vIcon(['view.helene.seated', 'view.helene'], 'sprite--card', '👩')),
      b?.line ? el('p.cz-say', { role: 'status' }, `« ${b.line} »`) : el('p.cz-say', '« Assieds-toi un peu. »'),
      view?.canContemplate ? el('button.btn.btn--red.btn--big.btn--wide', { type: 'button', id: 'vl4-sit', onclick: () => { app.sheets.close('silent'); requestAnimationFrame(() => contemplate()); } }, 'S\'asseoir sur le banc') : null,
      el('button.btn.btn--wide', { type: 'button', id: 'vl4-bench-ok', onclick: () => app.sheets.close() }, 'Merci'),
    );
  }
  function openBench() {
    const view = q('valleyView');
    const b = view?.bench || {};
    if (b.joseph === 'epilogue') return openEpilogue();
    if (b.joseph === 'story') {
      const st = (V()?.stories || []).find((s) => s.available && !s.read && s.id !== 'epilogue');
      if (st) return app.heritage?.openStory?.(st.id) || false;
      const ch = (V()?.chapters || []).find((c) => c.available && !c.read);
      if (ch) return app.valley?.openChapter?.(ch.n) || false;
    }
    if (!q('valleyBench')) return false;
    app.audio.play('page', { volume: 0.5 });
    if (app.valleyView?.active) app.valleyView.keepVisible?.({ type: 'bench' });
    return openLive('vl4-bench', { title: 'Sur le banc', icon: vIcon(['view.bench'], 'sprite--md', '🪑'), build: benchContent, sig: () => '' });
  }

  // ── Bouton « Le livre » ─────────────────────────────────────────────────────────
  function bookButton() {
    if (!on()) return null;
    return el('button.btn.vl-small.vl4-book-btn', { type: 'button', id: 'vl-book-open', 'aria-label': 'Le livre de la vallée', onclick: () => app.valleyBook?.open?.() }, vIcon(['icon.book', 'book.cover'], 'sprite--sm', '📗'), el('span', 'Le livre'));
  }

  // ── Toucher ──────────────────────────────────────────────────────────────────────
  function onHit(hit) {
    if (!hit || !on()) return false;
    switch (hit.type) {
      case 'storkNest':
        return openNest();
      case 'visitor':
        if (hit.id === 'glowworms') return observeVisitor('glowworms') || true;
        return false;
      default:
        return false;
    }
  }
  function onViewHit(hit) {
    if (!hit || !on()) return false;
    if (app.valleyView?.contemplating) return true;
    switch (hit.type) {
      case 'visitor':
        return observeVisitor(hit.id);
      case 'bench':
        return openBench();
      default:
        return false;
    }
  }

  // ── « À faire maintenant » ──────────────────────────────────────────────────────
  function todoItems(g = app.game) {
    if (!on(g)) return [];
    const v = V(g);
    if (!v) return [];
    const out = [];
    const vis = visitors(v);
    const storks = vis.find((x) => x.id === 'whiteStork' && x.state === 'visible');
    if (storks) out.push({ id: 'vl-storks', prio: 30, icon: () => visitorIcon('whiteStork', 'sprite--sm'), text: storks.halt || 'Les cigognes sur le clocher', short: 'les cigognes sur le clocher', go: () => goVisitor('whiteStork') });
    const other = vis.find((x) => x.id !== 'whiteStork' && x.state === 'visible');
    if (other) out.push({ id: 'vl-visitor', prio: 31, icon: () => visitorIcon(other.id, 'sprite--sm'), text: other.halt || other.title || 'Un visiteur rare fait halte', short: `${lower(other.the || other.name)} à aller voir`, go: () => goVisitor(other.id) });
    const e = v.epilogue || {};
    if (e.available && !e.read) out.push({ id: 'vl-epilogue', prio: 34, icon: () => vIcon(['portrait.joseph'], 'sprite--sm', '💬'), text: SD.STORKS_TEXTS?.epilogueWaits?.replace(/\.$/, '') || 'Joseph vous attend sur la colline', short: 'Joseph vous attend sur la colline', go: () => goBench() });
    const ripe = legends(v).find((l) => l.cloche?.state === 'ripe');
    if (ripe) out.push({ id: 'vl-legend', prio: 60, icon: () => legendIcon(ripe, 'sprite--sm'), text: `${ripe.the || ripe.fullName} ${ripe.pl ? 'sont' : 'est'} ${agree(ripe, 'mûr')}`, short: `${lower(ripe.the || ripe.fullName)} ${agree(ripe, 'mûr')}`, go: () => app.heritage?.openLibrary?.('legends') });
    const card = (v.postcards?.got || []).find((c) => !c.read);
    if (card) out.push({ id: 'vl-postcard', prio: 62, icon: () => vIcon(['icon.postcard', card.vignette], 'sprite--sm', '✉'), text: `Une carte ${ofValley(card.valley)}`, short: 'une carte postale', go: () => app.valleyBook?.open?.('postcards') });
    return out;
  }
  function ofValley(name) {
    const n = String(name || '');
    if (/^Le /.test(n)) return `du ${n.slice(3)}`;
    if (/^Les /.test(n)) return `des ${n.slice(4)}`;
    if (/^La /.test(n)) return `de la ${n.slice(3)}`;
    if (/^[AEIOUYÉÈ]/i.test(n)) return `d'${n}`;
    return `de ${n}`;
  }
  function goBench() {
    app.sheets.close('silent');
    return !!app.valleyView?.open?.({ bench: true });
  }

  // ── Le prochain indice ─────────────────────────────────────────────────────────
  function hintAction(h) {
    if (!h || !on()) return null;
    const t = h.target || {};
    switch (h.kind) {
      case 'visitor':
        return { label: 'Aller voir', go: () => goVisitor(t.id) };
      case 'legendRipe':
        return { label: 'Récolter', go: () => app.heritage?.openLibrary?.('legends') };
      case 'legendSow':
        return { label: 'Semer', go: () => app.heritage?.openLibrary?.('legends') };
      case 'storkNeed': {
        const st = V()?.stork;
        const miss = (st?.needs || []).find((n) => !n.ok);
        if (!miss) return null;
        const pid = /étang|nénuphar/i.test(miss.text) ? 'millpond' : /prairie|coquelicot/i.test(miss.text) ? 'poppies' : null;
        return pid ? { label: 'Voir', go: () => { app.sheets.close('silent'); requestAnimationFrame(() => app.places?.openPlace?.(pid)); } } : null;
      }
      case 'epilogue':
        return { label: 'Monter', go: () => goBench() };
      case 'postcard':
        return { label: 'Lire', go: () => app.valleyBook?.open?.('postcards') };
      default:
        return null;
    }
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function legendName(id) {
    return legendOf(id)?.fullName || LEGEND_DEF(id)?.name || 'Une légende';
  }
  function onEvent(ev, g) {
    if (!g || !on(g)) return;
    switch (ev.type) {
      case 'legendAwoken': {
        morning(`${ev.name || legendName(ev.id)} se réveille.`);
        app.toasts.show({ prio: 'important', kind: 'achievement', key: `vl4-wake-${ev.id}`, sprite: vIcon(['legend.jar', 'icon.legend'], 'sprite--sm', '🫙'), title: 'Une légende se réveille !', text: ev.name || legendName(ev.id), actionLabel: 'Voir', onClick: () => (ev.story ? app.heritage?.openStory?.(ev.story) : showWake(ev)), duration: 6000 });
        if (ev.story) windows.push({ kind: 'story', data: { id: ev.story } });
        windows.push({ kind: 'legend', data: { ...ev } });
        break;
      }
      case 'legendRipe':
        app.toasts.show({ prio: 'info', kind: 'info', key: `vl4-ripe-${ev.id}`, sprite: legendIcon(legendOf(ev.id) || LEGEND_DEF(ev.id), 'sprite--sm'), text: `${ev.name || legendName(ev.id)} : ${agree(LEGEND_DEF(ev.id), 'mûr')} sous sa cloche.`, actionLabel: 'Voir', onClick: () => app.heritage?.openLibrary?.('legends'), duration: 4000 });
        break;
      case 'legendHarvested':
        // Récolte du joueur : fenêtre ou message ouverts par harvestLegend ; ici seulement le débogage.
        if (!firstHarvest && app.sheets.current !== 'vl4-first' && ev.first && !live) {
          firstHarvest = { ...ev };
          windows.push({ kind: 'first', data: ev });
        }
        break;
      case 'marvelGeneration':
        app.toasts.show({ prio: 'info', kind: 'success', key: 'vl4-marvel', sprite: legendIcon(LEGEND_DEF('farmMarvel'), 'sprite--sm'), text: `+ 1 génération · Merveille : ${ev.n} / ${ev.need}`, duration: 3200 });
        tone('chirp', { volume: 0.4 });
        break;
      case 'visitorHint':
        morning(ev.text || VISITOR_DEF(ev.id)?.hint);
        break;
      case 'visitorVisible': {
        if (ev.id === 'whiteStork') break; // storksArrived dit déjà tout
        const def = VISITOR_DEF(ev.id) || {};
        morning(ev.text || def.welcome);
        const node = app.toasts.show({ prio: 'important', kind: 'info', key: `vl4-vis-${ev.id}`, sprite: visitorIcon(ev.id, 'sprite--sm'), title: ev.text || def.welcome || 'Un visiteur rare !', text: `${capitalize(ev.whereText || def.whereText || '')} : il vous attend.`.replace(/^ : /, ''), actionLabel: 'Voir', onClick: () => goVisitor(ev.id), duration: 6000 });
        if (node) visToasts.set(ev.id, node);
        tone('chirp', { volume: 0.6, delay: 0.4 });
        break;
      }
      case 'visitorSeen':
        if (!observed && app.sheets.current !== 'vl4-observe') windows.push({ kind: 'visitor', data: { ...ev, visitorId: ev.id } });
        break;
      case 'storksArrived': {
        const farm = ev.where === 'farm';
        const text = ev.text || (farm ? SD.STORKS_TEXTS?.storksHome : SD.STORKS_TEXTS?.storksSteeple);
        morning(text);
        app.toasts.show({ prio: 'important', kind: 'achievement', key: 'vl4-storks', sprite: visitorIcon('whiteStork', 'sprite--sm'), title: text, text: farm ? 'Sur la roue de la cheminée.' : 'Dans la vue de la vallée, sur le clocher.', actionLabel: 'Voir', onClick: () => (farm ? (app.valleyView?.close?.({ silent: true }), focusScene('storkNest')) : goVisitor('whiteStork')), duration: 6500 });
        tone('clatter', { volume: 0.7, delay: 0.3 });
        break;
      }
      case 'storkChicks':
        morning(ev.text || `${plural(ev.n || 1, 'cigogneau', 'cigogneaux')} dans le nid`);
        app.toasts.show({ prio: 'info', kind: 'info', key: 'vl4-chicks', sprite: vIcon(['stork.nest.chicks'], 'sprite--sm', '🪺'), text: ev.text || `${plural(ev.n || 1, 'cigogneau', 'cigogneaux')} dans le nid`, actionLabel: 'Voir', onClick: () => focusScene('storkNest'), duration: 3600 });
        break;
      case 'storksLeft':
        app.toasts.show({ prio: 'info', kind: 'info', key: 'vl4-left', sprite: visitorIcon('whiteStork', 'sprite--sm'), text: ev.text || 'Les cigognes sont parties vers le sud.', duration: 4200 });
        break;
      case 'storkWheelPlaced':
        morning(ev.text || SD.STORKS_TEXTS?.wheel);
        pendingWheel = { ...ev };
        break;
      case 'valleyStage':
        if (ev.n === 8) tone('chime', { volume: 0.8, delay: 0.5 });
        break;
      case 'storyAvailable':
        if (ev.id === 'storkNest') morning('Joseph a quelque chose à vous dire, à propos de votre maison…');
        break;
      case 'epilogueAvailable':
        morning(ev.text || SD.STORKS_TEXTS?.epilogueWaits);
        app.toasts.show({ prio: 'important', kind: 'info', key: 'vl4-epi', sprite: vIcon(['portrait.joseph'], 'sprite--sm', '💬'), title: ev.text || SD.STORKS_TEXTS?.epilogueWaits || 'Joseph vous attend sur la colline.', text: 'Sur le banc du belvédère.', actionLabel: 'Voir', onClick: () => goBench(), duration: 7000 });
        tone('magic', { volume: 0.5, delay: 0.4 });
        break;
      case 'postcardSent':
        app.toasts.show({ prio: 'info', kind: 'success', key: 'vl4-sent', sprite: vIcon(['icon.postcard'], 'sprite--sm', '✉'), text: `Un sachet part ${lower(ofValley(ev.valley))}.`, duration: 3000 });
        break;
      case 'postcardArrived':
        morning(`Une carte ${ofValley(ev.valley)} est arrivée.`);
        app.toasts.show({ prio: 'info', kind: 'info', key: 'vl4-card', sprite: vIcon(['icon.postcard'], 'sprite--sm', '✉'), text: `Une carte ${ofValley(ev.valley)}`, actionLabel: 'Lire', onClick: () => app.valleyBook?.open?.('postcards'), duration: 4200 });
        break;
      case 'weather':
      case 'dawn':
      case 'seasonStart':
        ambKey = ''; // le paysage sonore se recalcule (main.js : updateAmbience)
        if (ev.type === 'dawn') day.key = dayKey(g);
        break;
      default:
        break;
    }
    if (live) schedule();
  }

  // ── Bilan annuel ─────────────────────────────────────────────────────────────────
  function yearLines(report) {
    const r = report?.valley;
    if (!r) return [];
    const out = [];
    if (r.visitorsSeen) out.push(plural(r.visitorsSeen, 'visiteur rare vu', 'visiteurs rares vus'));
    if (r.legends) out.push(plural(r.legends, 'légende réveillée', 'légendes réveillées'));
    if (r.legendHarvests) out.push(plural(r.legendHarvests, 'récolte de légende', 'récoltes de légendes'));
    if (r.chicks) out.push(plural(r.chicks, 'cigogneau', 'cigogneaux'));
    if (r.postcards) out.push(plural(r.postcards, 'carte postale', 'cartes postales'));
    return out;
  }
  /** Bloc « avant / après » du bilan (vignette de l'année de départ et de cette année, × 1,5 côte à côte). */
  function yearBlock(report) {
    const r = report?.valley;
    if (!r || !on()) return null;
    const from = Number.isFinite(r.stageStart) ? r.stageStart : 0;
    const to = Number.isFinite(r.stageNow) ? r.stageNow : null;
    if (to === null) return null;
    const start = r.startYear || q('valleyBook')?.since || null;
    return el(
      'div.vl4-ba',
      { role: 'img', 'aria-label': `Avant, l'an ${start || '?'} : étape ${from}. Aujourd'hui : étape ${to}.` },
      el('figure.vl4-ba-fig', el('span.vl4-ba-pic', vIcon([`valley.stage.${from}`], 'sprite--vl-ba', '🌫')), el('figcaption', start ? `L'an ${start}` : 'Avant')),
      el('span.vl4-ba-arrow', { 'aria-hidden': 'true' }, '→'),
      el('figure.vl4-ba-fig', el('span.vl4-ba-pic', vIcon([`valley.stage.${to}`], 'sprite--vl-ba', '🌿')), el('figcaption', 'Cette année')),
    );
  }
  function reportLines(v) {
    if (!on() || !v?.storks4) return [];
    const L = legends(v);
    const vis = visitors(v);
    const s = v.stork || {};
    return [
      ['Légendes réveillées', `${L.filter((l) => l.state === 'awake').length} / ${L.length || 4}`],
      ['Visiteurs rares vus', `${vis.filter((x) => x.state === 'seen').length} / ${vis.length || 6}`],
      ['Printemps des cigognes sur la maison', String(s.years || 0)],
      ['Cartes des vallées voisines', `${(v.postcards?.got || []).length} / 8`],
    ];
  }
  const pending = (v) => !!(v && (visitors(v).some((x) => x.state === 'visible') || legends(v).some((l) => l.cloche?.state === 'ripe') || (v.epilogue?.available && !v.epilogue.read) || (v.postcards?.got || []).some((c) => !c.read)));

  // ── Paysage sonore (main.js : updateAmbience) ───────────────────────────────────
  /** natureScape pour la ferme ou la vue (null hors V4) : faits du cœur (une fois par jour), saison, météo, phase. */
  function scape(g = app.game) {
    if (!on(g)) return null;
    const facts = q('valleySounds', g);
    if (!facts) return null;
    const cal = safe(() => g.query.calendar(), {}) || {};
    const v = S(g);
    const abs = safe(() => absDay(g.state), 0);
    const where = app.valleyView?.active ? 'view' : 'farm';
    return natureScape(facts, {
      where,
      season: cal.seasonId,
      weather: g.state.weather?.today,
      dayProgress: cal.dayProgress,
      detail: app.settings?.natureSound || 'full',
      afterRain: Number.isFinite(v?.rainedAt) && v.rainedAt === abs - 1,
      spots: viewSoundSpots(),
    });
  }

  // ── À chaque image ─────────────────────────────────────────────────────────────
  function frame(dt = 0) {
    const g = app.game;
    if (!g || app.inMenu || !on(g)) return;
    // Le paysage sonore suit la phase du jour (vérifiée une fois par seconde) et la vue.
    ambT += dt;
    if (ambT >= 1) {
      ambT = 0;
      const cal = safe(() => g.query.calendar(), {}) || {};
      const key = `${dayKey(g)}|${phaseOf(cal.dayProgress)}|${g.state.weather?.today}|${app.valleyView?.active ? 'v' : 'f'}|${app.settings?.natureSound}`;
      if (key !== ambKey) {
        ambKey = key;
        app.updateAmbience?.();
      }
    }
    if (windows.length && g.state.status === 'playing' && !busy() && !app.valleyView?.active) {
      const w = windows.shift();
      if (w.kind === 'story') app.heritage?.openStory?.(w.data.id);
      else if (w.kind === 'legend') showWake(w.data);
      else if (w.kind === 'first') openFirstHarvest();
      else if (w.kind === 'visitor') showObserve(w.data);
    }
    // La roue paraît après « Merci, Joseph » (chapitre 8) : le message attend que le chapitre soit lu.
    if (pendingWheel && (S(g)?.chapters?.read || []).includes(8) && !app.sheets.isOpen() && !app.dialogs.isOpen()) {
      const w = pendingWheel;
      pendingWheel = null;
      app.toasts.show({ prio: 'important', kind: 'info', key: 'vl4-wheel', sprite: vIcon(['stork.wheel'], 'sprite--sm', '🛞'), title: 'La roue à cigognes', text: w.text || SD.STORKS_TEXTS?.wheel, actionLabel: 'Voir', onClick: () => { app.valleyView?.close?.({ silent: true }); focusScene('storkNest'); }, duration: 6000 });
    }
  }

  function reset(g = null) {
    live = null;
    windows.length = 0;
    visToasts.clear();
    epiPage = 0;
    firstHarvest = null;
    observed = null;
    pendingWheel = null;
    groupLegends = false;
    groupVisitors = false;
    ambKey = '';
    day.key = '';
    void g;
  }

  return {
    on,
    legendsTab,
    legendShelf,
    legendsGroup,
    visitorsGroup,
    bookButton,
    openLegend,
    sowLegend,
    harvestLegend,
    observeVisitor,
    goVisitor,
    openNest,
    openEpilogue,
    playCredits,
    openBench,
    contemplate,
    onEvent,
    onHit,
    onViewHit,
    todoItems,
    hintAction,
    yearLines,
    yearBlock,
    reportLines,
    pending,
    scape,
    frame,
    reset,
    repaint,
    debugState: () => ({ live: live?.id || null, windows: windows.map((w) => w.kind), epiPage, firstHarvest: !!firstHarvest, observed: observed ? observed.visitorId : null, ambKey }),
  };
}

/** (Tests) Le lieu dont la carte du générique passe à un instant (cartes au fil du défilement, du ciel à la ferme). */
export function creditsCardAt(t, cards, duration = 70) {
  const n = (cards || []).length;
  if (!n) return -1;
  const first = 4;
  const step = Math.max(4, (duration * 0.75) / n);
  const i = Math.floor((t - first) / step);
  if (t < first || i >= n) return -1;
  return (t - first) % step < step * 0.85 ? i : -1;
}

/** Hauteur (px du monde) où se trouve un lieu dans la vue (le générique saute de lieu en lieu en mouvements réduits). */
export function placeCenterY(id) {
  const r = PLACE_RECTS[id];
  return r ? r.y + Math.min(r.h, 80) / 2 : null;
}
