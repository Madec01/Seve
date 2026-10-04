// Interface de La Vallée vivante, lot V3 « Le ruisseau » (docs/VALLEE.md § 17 ; contrat : docs/ARCHITECTURE.md, « Vallée
// vivante — contrats du lot V3 », « Ce que RENDER et UI consomment » et « Écarts et précisions (livraison CORE V3) »).
//
// createPlaces(app) → app.places = {
//   openPlace(id)            fiche d'un lieu (feuille basse, la vue de la vallée visible au-dessus) : vignette, étape,
//                            chantier en reprise (barre lue) ou prochaine étape (conditions cochées, « Lancer le chantier
//                            · 13 000 » ≥ 56 px, grisé + raison lue), ce que le lieu rend, habitants, la ligne de Joseph
//   openList()               liste des lieux (6 lignes ≥ 72 px : la vue se lit sans le dessin)
//   openWild(cellId)         fiche d'une terre sauvage (ou, pour une forêt à confier, les trois sortes à choisir)
//   enterWild(), leaveWild(), wilding   mode terres sauvages (barre #vl-wildbar à la place des onglets, zoom tactile)
//   openRiver()              pêche au ruisseau (petite fenêtre : le poisson, son nom, « + 14 »)
//   pickMushroom(id), observe(id)       gestes de la vue (champignon, bête de la vallée qui attend)
//   onEvent(ev, game), onHit(hit) → bool (scène : valleyView | wildLand | wildCell), onViewHit(hit) (vue de la vallée)
//   todoItems(game)          vl-view-animal, vl-mushrooms (les récits : vl-story, src/ui/career/heritage.js)
//   lieuxTab(v)              segment « Lieux » de la fiche « La Vallée » ; on(game), placesOpen(game)
//   speciesGroup(list, row)  groupe replié « De la vallée » (segment Habitants)
//   hintAction(h)            bouton du prochain indice (valleyAnimal, place, placeNeed, wild)
//   morningLines(), yearLines(report), reportLines(v), pending(v), isWildCell(id), afterStory(id)
//   frame(), reset(game|null), debugState()
// }
//
// Règles : carrière seulement (state.career.valley, parts.heritage et parts.places, v ≥ 3) ; rien ne presse, rien ne se
// perd (une bête attend sans limite, une reprise va à son terme) ; aucune ligne « À faire » pour un chantier ou une terre à
// payer ; cibles ≥ 48 px, textes ≥ 14 px, pictogramme ET mot ; lecteurs d'écran (« étape 2 sur 4 », « en reprise, encore
// 3 jours », barres lues) ; mouvements réduits ; temps en pause pendant la vue, la lecture et le mode terres sauvages.

import { el, fmt, plural } from '../dom.js';
import { icon } from '../icons.js';
import { SIGNALS } from '../coach/signals.js';
import { vIcon } from './valley.js';
import * as PD from '../../data/career/places.js';

// ── Textes ──────────────────────────────────────────────────────────────────────────

// Les anciens conseils « première fois » (PLACES_HINTS) sont des leçons de Joseph : src/ui/coach/lessons/valley.js.

const PLACE_EMOJI = { brook: '🌊', combe: '🌲', poppies: '🌺', millpond: '🪷', bocage: '🌳', oldOrchard: '🍎' };
const WILD_EMOJI = { kingfisher: '🐦', crayfish: '🦞', otter: '🦦', heron: '🐦', blackWoodpecker: '🐦', roeDeer: '🦌', salamander: '🦎', skylark: '🐦', hoopoe: '🐦', littleOwl: '🦉' };
const KIND_EMOJI = { wood: '🌳', marsh: '🌾', grassland: '🌼' };
const MUSH_EMOJI = { cep: '🍄', chanterelle: '🍄', hedgehogMushroom: '🍄' };
/** « Ce que le ruisseau vous rend » : le nom court du lieu, en minuscules. */
const RENDS = { brook: 'le ruisseau', combe: 'le bois', poppies: 'la prairie', millpond: 'l\'étang', bocage: 'le bocage', oldOrchard: 'le verger' };
const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const placeDef = (id) => PD.PLACES_BY_ID?.[id] || null;
const speciesDef = (id) => PD.VALLEY_SPECIES_BY_ID?.[id] || null;
const kindDef = (id) => PD.WILD_KINDS_BY_ID?.[id] || null;
/** « Un martin-pêcheur », « Des écrevisses », « Une loutre » (accords du V1). */
function aWho(id, name) {
  const s = speciesDef(id);
  if (!s) return name || 'Une bête';
  if (s.pl) return `Des ${lower(s.name)}`;
  return `${s.g === 'f' ? 'Une' : 'Un'} ${lower(s.name)}`;
}
const waits = (id) => (speciesDef(id)?.pl ? 'vous attendent' : 'vous attend');

// ── Module ──────────────────────────────────────────────────────────────────────────

export function createPlaces(app) {
  let live = null; // { id, build, sig, lastSig }
  let queued = false;
  let wilding = false;
  let wildBar = null;
  let riverResult = null;
  let wildPick = null; // sorte choisie dans la feuille « Confier à la nature »
  let confirmFor = null; // lieu dont on confirme le chantier
  const visToasts = new Map();
  const day = { key: '', mushrooms: 0, recovered: [] };

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.mode === 'career' && g.state?.career?.valley);
  /** Le V3 existe dans cette carrière (V2 compris, partie « places »). */
  const on = (g = app.game) => {
    if (!enabled(g)) return false;
    const v = g.state.career.valley;
    return !!v.started && v.parts?.heritage !== false && v.parts?.places !== false && (v.v || 1) >= 3;
  };
  /** La vue de la vallée est ouverte (étape 5 atteinte). */
  const placesOpen = (g = app.game) => on(g) && !!g.state.career.valley.view?.open;
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Lieux de la vallée :', err);
      return fallback;
    }
  }
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  const V = (g = app.game) => (on(g) ? q('valley', g) : null);
  const placesOf = (v = V()) => (Array.isArray(v?.places) ? v.places : []);
  const placeInfo = (id, v = V()) => placesOf(v).find((p) => p.id === id) || null;
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
  const viewActive = () => !!app.valleyView?.active;

  // ── Feuilles « vivantes » ──────────────────────────────────────────────────────
  function openLive(id, { title, icon: ico, build, sig, tall = false, pauses, outsideClose, onClose }) {
    const node = safe(build, null) || el('p.sheet-empty', 'Rien pour l\'instant.');
    app.sheets.open({
      id, kind: 'popup', tall, title, icon: ico, content: node, className: `vl-sheet vl3-sheet vl-sheet--${id}`, pauses, outsideClose,
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
  const placeIcon = (p, cls = 'sprite--md') => vIcon([p?.icon, `icon.place.${p?.id}`], cls, PLACE_EMOJI[p?.id] || '🌿');
  const speciesIcon = (id, cls = 'sprite--md') => vIcon([`wild.${id}`], cls, WILD_EMOJI[id] || '🐾');
  const daysText = (n) => plural(Math.max(0, Math.ceil(n || 0)), 'jour');
  function stepDots(step, max) {
    return el(
      'span.vl3-dots',
      { role: 'img', 'aria-label': `étape ${step} sur ${max}` },
      Array.from({ length: max }, (_, i) => el(`span.vl3-dot${i < step ? '.is-on' : ''}`, { 'aria-hidden': 'true' })),
    );
  }
  function bar(progress, label) {
    const pct = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);
    return el(
      'span.vl3-bar',
      { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': label || `${pct} %` },
      el('span.vl3-bar-fill', { style: { width: `${pct}%` }, 'aria-hidden': 'true' }),
    );
  }
  /** État court d'un lieu (liste, segment Lieux) : « en reprise · encore 3 jours », « prêt · 7 000 », « attend : … ». */
  function placeState(p) {
    if (!p) return '';
    if (p.restored) return 'Restauré ✓';
    if (p.works) return `En reprise · encore ${daysText(p.works.daysLeft)}`;
    const n = p.next;
    if (!n) return '';
    const miss = (n.needs || []).find((x) => !x.ok);
    if (!miss) return `Prêt · ${fmt(n.cost)}`;
    return `Attend : ${lower(miss.text)}`;
  }
  const placeStateClass = (p) => (p?.restored ? '.is-ok' : p?.works ? '.is-works' : p?.next && !(p.next.needs || []).some((x) => !x.ok) ? '.is-ready' : '');

  // ── La vue de la vallée (accès) ───────────────────────────────────────────────
  function goView(opts = {}) {
    if (!placesOpen()) {
      refused(PD.PLACES_TEXTS?.notOpen || 'La vallée s\'ouvrira quand elle chantera (étape 5).');
      return false;
    }
    return !!app.valleyView?.open?.(opts);
  }

  // ── Fiche d'un lieu ─────────────────────────────────────────────────────────────
  function needAction(n) {
    const t = n?.target;
    if (!t || n.ok) return null;
    switch (t.type) {
      case 'species': {
        const sp = (V()?.species || []).find((s) => s.id === t.id);
        if (sp?.state === 'visible') {
          if (speciesDef(t.id)) return { label: 'Voir', go: () => { app.sheets.close('silent'); goView({ speciesId: t.id }); } };
          return { label: 'Voir', go: () => { app.valleyView?.close?.(); app.valley?.showInScene?.('wildlife', t.id); } };
        }
        return { label: 'Voir', go: () => { app.valleyView?.close?.(); app.valley?.openSpecies?.(t.id); } };
      }
      case 'nature':
        if (t.id === 'fallow') return { label: 'Où ?', go: () => { app.valleyView?.close?.(); app.valley?.open?.('nature'); } };
        return { label: 'Aménager', go: () => { app.valleyView?.close?.(); requestAnimationFrame(() => app.valley?.enterPlacing?.(t.id === 'loneTreeAdult' ? 'loneTree' : t.id)); } };
      case 'place':
        return { label: 'Voir', go: () => openPlace(t.id) };
      case 'variety':
        return { label: 'Voir', go: () => { app.valleyView?.close?.(); app.valley?.openVariety?.(t.id); } };
      case 'lot':
        return { label: 'La carte', go: () => { app.valleyView?.close?.(); app.careerUI?.open?.map?.(); } };
      default:
        return null;
    }
  }

  function placeContent(id) {
    const v = V();
    const p = placeInfo(id, v);
    if (!p) return el('p.sheet-empty', 'Ce lieu attend que la vallée s\'ouvre.');
    const def = placeDef(id);
    const parts = [];
    parts.push(
      el(
        'div.vl3-place-head',
        el('span.vl3-place-pic', placeIcon(p, 'sprite--card')),
        el('div.vl3-place-title', el('p.vl3-place-step', `Étape ${p.step} sur ${p.max}`), el('p.vl3-place-stepname', stepDots(p.step, p.max), el('span', p.stepName || ''))),
      ),
    );
    if (p.restored) parts.push(el('p.vl3-restored', { role: 'status' }, 'Restauré ✓'));
    if (p.works) {
      const w = p.works;
      const pct = Math.round((w.progress || 0) * 100);
      parts.push(
        el(
          'section.vl3-works',
          { 'aria-label': 'En reprise' },
          el('small.vl3-sec-title', vIcon(['icon.works', 'place.works'], 'sprite--xs', '⛏'), 'En reprise'),
          el('p.vl3-works-name', w.name || ''),
          el('div.vl3-works-row', bar(w.progress, `${pct} %, encore ${daysText(w.daysLeft)}`), el('span.vl3-works-left', `encore ${daysText(w.daysLeft)}`)),
        ),
      );
    } else if (p.next) {
      const n = p.next;
      const needs = (n.needs || []).map((x, i) => {
        const a = needAction(x);
        return el(
          `li.vl3-need${x.ok ? '.is-ok' : ''}`,
          { id: `vl3-need-${i}` },
          el('span.vl-check', { 'aria-hidden': 'true' }, x.ok ? '✓' : '✗'),
          el('span.vl3-need-text', x.text, x.ok ? '' : x.have !== undefined && x.target?.type === 'nature' && Number.isFinite(x.have) ? ` (${x.have} / ${Number.isFinite(x.n) ? x.n : '?'})` : ''),
          el('span.sr-only', x.ok ? ' : rempli' : ' : il manque'),
          a ? el('button.btn.vl-small.vl3-need-go', { type: 'button', onclick: () => { app.vibrate?.(8); a.go(); } }, a.label) : null,
        );
      });
      const can = !!n.canStart;
      parts.push(
        el(
          'section.vl3-next',
          el('h3.vl3-next-title', el('small', 'Prochaine étape : '), n.name),
          needs.length ? el('ul.vl3-needs', { 'aria-label': 'Ce qu\'il faut' }, needs) : null,
          el('p.vl3-seasons', `Reprise : ${plural(n.seasons || 1, 'saison')}`),
          el(
            `button.btn.btn--big.btn--wide.vl3-start${can ? '.btn--red' : '.is-disabled'}`,
            { type: 'button', id: 'vl3-start', 'aria-disabled': can ? 'false' : 'true', 'aria-describedby': can ? null : 'vl3-start-why', onclick: () => (can ? confirmWorks(id) : refused(n.reason || 'Pas encore.')) },
            el('span', 'Lancer le chantier'),
            el('span.buy-cost', icon('coin', 'sm'), fmt(n.cost)),
          ),
          !can && n.reason ? el('p.card-reason', { id: 'vl3-start-why' }, n.reason) : null,
        ),
      );
    }
    const boons = p.boons || [];
    if (boons.length) {
      parts.push(
        el(
          'section.vl3-boons',
          el('h3.stats-title', `Ce que ${RENDS[id] || 'ce lieu'} vous rend`),
          el('ul.vl3-boon-list', boons.map((b) => el(`li${b.active ? '.is-ok' : ''}`, el('span.vl-check', { 'aria-hidden': 'true' }, b.active ? '✓' : '○'), el('span', b.active ? b.text : `${b.text} (étape ${b.step})`), el('span.sr-only', b.active ? ' : acquis' : ' : plus tard')))),
        ),
      );
    }
    const sp = p.species || [];
    if (sp.length) {
      parts.push(
        el(
          'section.vl3-species',
          el('h3.stats-title', 'Habitants'),
          el(
            'div.vl3-sp-list',
            sp.map((s) => {
              const st = s.state === 'installed' ? '✓' : s.state === 'visible' ? '!' : '?';
              const known = s.state === 'installed' || s.state === 'visible';
              const go = s.state === 'visible' ? () => { app.sheets.close('silent'); goView({ speciesId: s.id }); } : null;
              return el(
                `${go ? 'button' : 'span'}.vl3-sp.is-${s.state || 'unknown'}`,
                { type: go ? 'button' : null, id: `vl3-sp-${s.id}`, onclick: go, 'aria-label': `${s.name}, ${s.state === 'installed' ? 'installé' : s.state === 'visible' ? 'vous attend' : 'pas encore venu'}` },
                el('span.vl3-sp-ico', known ? speciesIcon(s.id, 'sprite--md') : el('span.vl3-sp-unknown', { 'aria-hidden': 'true' }, '?')),
                el('span.vl3-sp-name', { 'aria-hidden': 'true' }, s.name),
                el('span.vl3-sp-st', { 'aria-hidden': 'true' }, st),
              );
            }),
          ),
        ),
      );
    }
    const line = p.line || def?.steps?.[p.step]?.line;
    if (line) parts.push(el('p.cz-say.vl3-joseph', `« ${line} »`));
    // Lieu restauré : son récit, relisible.
    const storyId = (def?.steps || []).map((s) => s.story).filter(Boolean).pop();
    if (p.restored && storyId && (V()?.stories || []).some((s) => s.id === storyId && s.available)) {
      parts.push(el('button.btn.btn--wide.vl3-story', { type: 'button', onclick: () => app.heritage?.openStory?.(storyId) }, 'Relire le récit de Joseph'));
    }
    return el('div.vl3-place', parts);
  }

  function openPlace(id) {
    if (!placesOpen()) return goView();
    if (!viewActive()) {
      // La fiche d'un lieu s'ouvre dans la vue (le lieu reste visible au-dessus).
      if (!goView({ placeId: id })) return false;
    }
    const p = placeInfo(id);
    const def = placeDef(id);
    openLive('vl-place', { title: p?.name || def?.name || 'Un lieu', icon: placeIcon(p || def, 'sprite--md'), build: () => placeContent(id), sig: () => JSON.stringify([placeInfo(id), Math.floor((app.game?.state.money || 0) / 50)]) });
    app.valleyView?.keepVisible?.(id);
    app.audio.play('page', { volume: 0.6 });
    return true;
  }

  function confirmWorks(id) {
    const p = placeInfo(id);
    const n = p?.next;
    if (!n) return;
    confirmFor = id;
    const content = el(
      'div.vl-confirm.vl3-confirm',
      el('p.vl-confirm-where', vIcon(['icon.works', 'place.works'], 'sprite--md', '⛏'), el('span', `Le chantier « ${n.name} »`)),
      el('p.vl3-confirm-facts', el('span', icon('coin', 'sm'), fmt(n.cost)), el('span', ` · reprise ${plural(n.seasons || 1, 'saison')}`)),
      n.boonText ? el('p.stats-note', `Ensuite : ${lower(n.boonText)}`) : null,
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', id: 'vl3-confirm-no', onclick: () => openPlace(id) }, 'Pas encore'),
        el('button.btn.btn--wide.btn--red', { type: 'button', id: 'vl3-confirm-ok', onclick: () => startWorks(id) }, 'Lancer'),
      ),
    );
    app.sheets.open({ id: 'vl-place-confirm', kind: 'popup', title: p.name, icon: placeIcon(p, 'sprite--md'), content, className: 'vl-sheet vl3-sheet vl-sheet--confirm' });
    app.valleyView?.keepVisible?.(id);
  }

  function startWorks(id) {
    const res = act('startWorks', id);
    confirmFor = null;
    if (!res?.ok) return;
    app.sheets.close('silent');
    app.audio.play('buy', { volume: 0.7 });
    tone('reveal', { volume: 0.65, delay: 0.15 });
    app.vibrate?.([12, 40, 12]);
    app.valleyView?.focusPlace?.(id);
  }

  // ── Liste des lieux ──────────────────────────────────────────────────────────────
  function placeRow(p, { inView = true } = {}) {
    const state = placeState(p);
    return el(
      `button.vl-row.vl3-row${placeStateClass(p)}`,
      { type: 'button', id: `vl3-row-${p.id}`, 'aria-label': `${p.name}, étape ${p.step} sur ${p.max}${p.stepName ? `, ${p.stepName}` : ''}. ${state}`, onclick: () => (inView ? openPlace(p.id) : openPlace(p.id)) },
      el('span.vl-row-ico', placeIcon(p, 'sprite--md')),
      el('span.vl-row-main', el('span.vl-row-name', p.name), el('span.vl-row-sub', `Étape ${p.step} / ${p.max}${p.stepName ? ` · ${p.stepName}` : ''}`), el('span.vl3-row-state', state)),
      el('span.c-row-go', { 'aria-hidden': 'true' }, '›'),
    );
  }
  function listContent() {
    const v = V();
    const list = placesOf(v);
    if (!list.length) return el('p.sheet-empty', 'La vallée s\'ouvrira quand elle chantera.');
    const done = list.reduce((a, p) => a + (p.step || 0), 0);
    const total = list.reduce((a, p) => a + (p.max || 0), 0);
    return el('div.vl3-list', el('p.vl-count', `${done} / ${total} étapes de lieux`), el('div.vl-rows', list.map((p) => placeRow(p))), wildCard(v, { compact: true }));
  }
  function openList() {
    if (!placesOpen()) return goView();
    return openLive('vl-places-list', { title: 'Les lieux de la vallée', icon: vIcon(['icon.view'], 'sprite--md', '⛰'), build: listContent, sig: () => JSON.stringify(placesOf().map((p) => [p.id, p.step, p.works?.daysLeft, placeState(p)])), tall: true });
  }

  // ── Segment « Lieux » de la fiche « La Vallée » ─────────────────────────────────
  function wildCard(v, { compact = false } = {}) {
    const w = v?.wilds;
    if (!w) return null;
    if (!w.open) {
      return el('section.vl3-wildcard.is-soon', el('h3.stats-title', vIcon(['icon.wildland.wood'], 'sprite--sm', '🌳'), 'Terres sauvages'), el('p.stats-note', w.reason || PD.PLACES_TEXTS?.wildBefore || 'Après le 16ᵉ terrain, les forêts autour de la ferme pourront revenir à la nature.'));
    }
    const left = (w.total || 18) - (w.count || 0);
    return el(
      'section.vl3-wildcard',
      el('h3.stats-title', vIcon(['icon.wildland.wood'], 'sprite--sm', '🌳'), 'Terres sauvages'),
      el('p.vl3-wild-count', `${w.count || 0} / ${w.total || 18} confiées à la nature`),
      left > 0 && (w.eligible || []).length
        ? el('button.btn.btn--red.btn--wide.vl3-wild-go', { type: 'button', id: compact ? 'vl3-wild-go-list' : 'vl3-wild-go', onclick: () => enterWild() }, el('span', 'Confier une forêt'), el('span.buy-cost', icon('coin', 'sm'), fmt(w.nextPrice || 0)))
        : el('p.stats-note', left > 0 ? 'Aucune forêt ne touche la ferme pour l\'instant.' : 'Toutes les forêts de la carte sont rendues à la nature.'),
    );
  }
  function lieuxTab(v) {
    const list = placesOf(v);
    const done = list.reduce((a, p) => a + (p.step || 0), 0);
    const total = list.reduce((a, p) => a + (p.max || 0), 0) || PD.PLACE_STEPS_TOTAL || 19;
    return el(
      'div.vl3-lieux',
      el(
        'button.vl3-viewcard',
        { type: 'button', id: 'vl3-viewcard', onclick: () => { app.sheets.close('silent'); requestAnimationFrame(() => goView()); }, 'aria-label': `Voir la vallée : ${done} étapes sur ${total}` },
        el('span.vl3-viewcard-pic', vIcon([v?.stage?.vignette, `valley.stage.${v?.stage?.n ?? 5}`], 'sprite--vl-thumb', '⛰')),
        el('span.vl3-viewcard-main', el('b', 'Voir la vallée'), el('span', `${done} étapes sur ${total}`)),
        el('span.c-row-go', { 'aria-hidden': 'true' }, '›'),
      ),
      el('div.vl-rows', list.map((p) => placeRow(p, { inView: false }))),
      wildCard(v),
    );
  }

  // ── Habitants de la vallée (segment Habitants, groupe replié « De la vallée ») ─────────
  let groupOpen = false;
  function speciesGroup(list, row) {
    const mine = (list || []).filter((s) => s.group === 'valley' || speciesDef(s.id));
    if (!mine.length) return null;
    const n = mine.filter((s) => s.state === 'installed').length;
    const waiting = mine.some((s) => s.state === 'visible');
    const open = groupOpen || waiting;
    const order = { visible: 0, hint: 1, unknown: 2, installed: 3 };
    return el(
      'section.vl3-spgroup',
      el(
        'button.vl3-spgroup-head',
        { type: 'button', id: 'vl3-spgroup', 'aria-expanded': open ? 'true' : 'false', onclick: () => { groupOpen = !open; app.valley?.repaint?.(); } },
        el('span', `De la vallée · ${n} / ${mine.length}`),
        waiting ? el('span.vl-dot', { 'aria-hidden': 'true' }) : null,
        el('span.c-row-go', { 'aria-hidden': 'true' }, open ? '▾' : '›'),
      ),
      open ? el('div.vl-rows', [...mine].sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2)).map((s) => row(s, { goValley: () => { app.sheets.close('silent'); goView({ speciesId: s.id }); } }))) : null,
    );
  }

  // ── Observer une bête de la vallée (dans la vue) ────────────────────────────────
  function observeContent(r) {
    const s = speciesDef(r.speciesId) || {};
    const the = s.the || r.name || 'La bête';
    return el(
      'div.vl-observe',
      el('div.vl-big', speciesIcon(r.speciesId, 'sprite--hero')),
      el('h3.vl-obs-title', { role: 'status' }, `${the} ${s.pl ? 's\'installent' : 's\'installe'} !`),
      r.anecdote || s.anecdote ? el('p.cz-say', `« ${r.anecdote || s.anecdote} »`) : null,
      el('p.vl-service', el('span.vl-heart', { 'aria-hidden': 'true' }, '♥ '), opensText(r.speciesId, r.service?.text || s.opens || '')),
      el('p.vl-ok', '✓ Le carnet d\'Hélène'),
      el('button.btn.btn--red.btn--big.btn--wide.vl-go.vl-welcome', { type: 'button', id: 'vl3-welcome', onclick: () => app.sheets.close() }, r.welcome || s.welcome || 'Bienvenue !'),
    );
  }
  /**
   * (QA du V3) Ce que la bête ouvre : « Le ruisseau peut maintenant passer à … » seulement si plus rien ne manque ; sinon
   * « Un pas de plus vers … : il manque encore le bois de la Combe à l'étape 1. »
   */
  function opensText(speciesId, text) {
    const p = placesOf().find((x) => (x.next?.needs || []).some((n) => n.target?.type === 'species' && n.target.id === speciesId));
    const miss = p ? (p.next.needs || []).filter((n) => !n.ok) : [];
    if (!p || !miss.length) return text;
    return `Un pas de plus vers « ${p.next.name} » : il manque encore ${miss.map((n) => lower(n.text)).join(', ')}.`;
  }
  function observe(id) {
    const res = act('observe', id);
    if (!res?.ok) return false;
    tone('chirp', { volume: 0.9, throttle: 300 });
    app.vibrate?.([12, 50, 12]);
    showObserve({ speciesId: id, name: res.name, anecdote: res.anecdote, service: res.service, welcome: res.welcome });
    return true;
  }
  function showObserve(r) {
    app.toasts.hide?.(visToasts.get(r.speciesId));
    app.toasts.forget?.(`vl3-vis-${r.speciesId}`);
    visToasts.delete(r.speciesId);
    openLive('vl-observe3', { title: 'Un habitant de la vallée', icon: speciesIcon(r.speciesId, 'sprite--md'), build: () => observeContent(r), sig: () => '' });
    app.valleyView?.keepVisible?.({ type: 'viewAnimal', id: r.speciesId });
  }

  // ── Pêche au ruisseau et champignons ───────────────────────────────────────────
  function riverContent() {
    const r = riverResult;
    if (!r) return el('p.sheet-empty', 'Rien au bout de la ligne.');
    const fish = PD.RIVER_FISH_BY_ID?.[r.fishId];
    return el(
      'div.vl3-river',
      el('div.vl3-river-pic', vIcon([r.icon, fish?.icon, `fish.${r.fishId}`, 'product.fish.1'], 'sprite--card', '🐟')),
      el('p.vl3-river-name', { role: 'status' }, r.name || fish?.name || 'Un poisson'),
      el('p.vl3-river-amount', `+ ${fmt(r.amount || 0)}`),
      el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl3-river-ok', onclick: () => app.sheets.close() }, 'Merci, le ruisseau !'),
    );
  }
  function openRiver() {
    const res = act('fishRiver');
    if (!res?.ok) return false;
    riverResult = res;
    tone('pop', { volume: 0.8 });
    app.audio.play('water', { volume: 0.5 });
    app.vibrate?.([10, 30, 10]);
    openLive('vl-river', { title: 'La pêche au ruisseau', icon: vIcon(['icon.river', 'view.pontoon'], 'sprite--md', '🎣'), build: riverContent, sig: () => '' });
    app.valleyView?.keepVisible?.({ type: 'river' });
    return true;
  }
  function pickMushroom(id) {
    const res = act('pickMushroom', id);
    if (!res?.ok) return false;
    tone('pop', { volume: 0.85 });
    app.vibrate?.(10);
    app.toasts.show({ prio: 'important', kind: 'money', key: 'vl3-mush', sprite: vIcon([`find.${res.kind}`], 'sprite--sm', MUSH_EMOJI[res.kind] || '🍄'), text: `${res.name || 'Un champignon'} : +${fmt(res.amount || 0)}`, duration: 2400 });
    return true;
  }

  // ── Terres sauvages ──────────────────────────────────────────────────────────────
  const isWildCell = (id) => {
    const layout = app.scene?.layout;
    return !!(layout?.wildBands || []).some((b) => b.cellId === id) || !!(layout?.wildable || []).some((b) => b.cellId === id);
  };
  function wildCellInfo(cellId) {
    return q('wildCell', app.game, cellId);
  }
  function wildContent(cellId) {
    const c = wildCellInfo(cellId);
    if (!c) return el('p.sheet-empty', 'Une case de forêt.');
    if (c.state !== 'wildland') return el('div.vl3-wild', el('p.cz-lead', c.reason || 'Une forêt de la carte.'));
    const k = kindDef(c.kind);
    const parts = [
      el('div.vl3-wild-head', el('span.vl3-wild-pic', vIcon([k?.icon, `icon.wildland.${c.kind}`], 'sprite--card', KIND_EMOJI[c.kind] || '🌿')), el('div', el('p.vl3-wild-kind', k?.name || c.kindName || ''), el('p.vl3-wild-stage', stepDots((c.stage || 0) + 1, 3), el('span', c.stageName || k?.stages?.[c.stage || 0] || '')))),
    ];
    if ((c.stage || 0) < 2) {
      const left = c.seasonsLeft || 0;
      parts.push(el('p.vl3-wild-left', left > 0 ? `Encore ${plural(left, 'saison')} avant ${k?.grown || 'la nature'}.` : `Bientôt ${k?.grown || 'reprise'}.`));
    } else parts.push(el('p.vl-ok', `Reprise ✓ · ${k?.grown ? capitalize(k.grown) : 'La nature'} pour toujours.`));
    if (k?.text) parts.push(el('p.cz-say', `« ${k.text} »`));
    const vis = c.visitors || [];
    if (vis.length) {
      parts.push(
        el(
          'section.vl3-visitors',
          el('h3.stats-title', 'Visiteurs'),
          el('div.vl3-sp-list', vis.map((x) => el(`span.vl3-sp.is-${x.seen ? 'installed' : 'unknown'}`, el('span.vl3-sp-ico', x.seen ? vIcon([`wild.${x.id}`], 'sprite--md', WILD_EMOJI[x.id] || '🐾') : el('span.vl3-sp-unknown', { 'aria-hidden': 'true' }, '?')), el('span.vl3-sp-name', x.name), el('span.sr-only', x.seen ? ' : déjà vu' : ' : pas encore vu')))),
        ),
      );
    }
    parts.push(el('p.sheet-hint', 'Une terre sauvage ne produit rien et ne coûte rien : elle accueille.'));
    return el('div.vl3-wild', parts);
  }
  function choiceContent(cellId) {
    const c = wildCellInfo(cellId);
    const v = V();
    const price = c?.price ?? v?.wilds?.nextPrice ?? 0;
    const kinds = v?.wilds?.kinds?.length ? v.wilds.kinds : PD.WILD_KINDS || [];
    const can = c ? c.canRewild !== false : true;
    const pick = wildPick && kinds.some((k) => k.id === wildPick) ? wildPick : null;
    const name = c?.name || 'Cette forêt';
    const k = pick ? kinds.find((x) => x.id === pick) : null;
    const grown = k ? kindDef(k.id)?.grown || lower(k.name) : '';
    return el(
      'div.vl3-choice',
      el('p.cz-lead', `${name} : que deviendra-t-elle ?`),
      el(
        'div.vl3-kinds',
        { role: 'radiogroup', 'aria-label': 'La sorte de terre sauvage' },
        kinds.map((x) =>
          el(
            `button.vl3-kind${pick === x.id ? '.is-on' : ''}`,
            { type: 'button', role: 'radio', id: `vl3-kind-${x.id}`, 'aria-checked': pick === x.id ? 'true' : 'false', onclick: () => { wildPick = x.id; app.audio.play('click', { volume: 0.5 }); repaint(); } },
            el('span.vl3-kind-pic', vIcon([x.icon, `icon.wildland.${x.id}`], 'sprite--card', KIND_EMOJI[x.id] || '🌿')),
            el('span.vl3-kind-main', el('b', x.name), el('span', x.text || kindDef(x.id)?.text || '')),
          ),
        ),
      ),
      pick ? el('p.vl3-forever', (PD.PLACES_TEXTS?.wildConfirm || '{name} deviendra {grown}, pour toujours.').replace('{name}', name).replace('{grown}', grown)) : el('p.stats-note', 'Choisissez une sorte : c\'est pour toujours.'),
      !can && c?.reason ? el('p.card-reason', c.reason) : null,
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', onclick: () => app.sheets.close() }, 'Annuler'),
        el(
          `button.btn.btn--wide${pick && can ? '.btn--red' : '.is-disabled'}`,
          { type: 'button', id: 'vl3-rewild', 'aria-disabled': pick && can ? 'false' : 'true', onclick: () => (pick && can ? rewild(cellId, pick) : refused(!pick ? 'Choisissez d\'abord une sorte.' : c?.reason || 'Pas possible ici.')) },
          el('span', 'Confier à la nature'),
          el('span.buy-cost', icon('coin', 'sm'), fmt(price)),
        ),
      ),
    );
  }
  function openWild(cellId) {
    const c = wildCellInfo(cellId);
    if (c && c.state !== 'wildland') return openChoice(cellId);
    return openLive('vl-wild', { title: c?.name || 'Une terre sauvage', icon: vIcon([kindDef(c?.kind)?.icon], 'sprite--md', KIND_EMOJI[c?.kind] || '🌿'), build: () => wildContent(cellId), sig: () => JSON.stringify(wildCellInfo(cellId)) });
  }
  function openChoice(cellId) {
    wildPick = null;
    const c = wildCellInfo(cellId);
    return openLive('vl-wild-choice', { title: 'Confier à la nature', icon: vIcon(['wildland.offer', 'icon.wildland.wood'], 'sprite--md', '🌱'), build: () => choiceContent(cellId), sig: () => JSON.stringify([wildCellInfo(cellId), Math.floor((app.game?.state.money || 0) / 50)]), tall: true });
    void c;
  }
  function rewild(cellId, kind) {
    const res = act('rewild', cellId, kind);
    if (!res?.ok) return;
    wildPick = null;
    app.sheets.close('silent');
    app.audio.play('plant', { volume: 0.85 });
    tone('reveal', { volume: 0.5, delay: 0.2 });
    app.vibrate?.([12, 40, 12]);
    requestAnimationFrame(() => {
      if (!wilding) return;
      paintWildBar();
      const v = V();
      if (!(v?.wilds?.eligible || []).length || (v?.wilds?.count || 0) >= (v?.wilds?.total || 18)) leaveWild({ silent: true });
    });
  }

  function buildWildBar() {
    if (wildBar) return;
    wildBar = el(
      'nav.vl-placebar.vl-wildbar',
      { id: 'vl-wildbar', 'aria-label': 'Terres sauvages' },
      el('div.vl-bar-info', el('span.vl-bar-ico', { 'aria-hidden': 'true' }, vIcon(['icon.wildland.wood', 'wildland.offer'], 'sprite--sm', '🌿')), el('span.vl-bar-text', el('b', { id: 'vl-wild-name' }), el('small', { id: 'vl-wild-sub', 'aria-live': 'polite' }))),
      el('button.tabbar-btn.vl-bar-btn.is-done', { type: 'button', id: 'vl-wild-done', onclick: () => { app.vibrate?.(8); leaveWild(); } }, el('span.tabbar-ico', icon('play', 'md')), el('span.tabbar-label', 'Terminer')),
    );
    document.body.append(wildBar);
  }
  function paintWildBar() {
    if (!wildBar || !wilding) return;
    const w = V()?.wilds;
    const t1 = `Terre sauvage · ${fmt(w?.nextPrice || 0)}`;
    const t2 = (w?.eligible || []).length ? 'Touchez une forêt' : 'Aucune forêt ne touche la ferme';
    const a = wildBar.querySelector('#vl-wild-name');
    const b = wildBar.querySelector('#vl-wild-sub');
    if (a.textContent !== t1) a.textContent = t1;
    if (b.textContent !== t2) b.textContent = t2;
  }
  function enterWild() {
    const g = app.game;
    if (!placesOpen(g) || g.state.status !== 'playing') return false;
    const w = V(g)?.wilds;
    if (!w?.open) return refused(w?.reason || PD.PLACES_TEXTS?.wildNeedLots || 'Les terres sauvages viennent après le 16ᵉ terrain.'), false;
    if (!(w.eligible || []).length) return refused('Aucune forêt ne touche la ferme pour l\'instant.'), false;
    if (app.valleyView?.active) app.valleyView.close({ silent: true });
    if (app.valley?.placing) app.valley.leavePlacing({ silent: true });
    if (app.heritage?.pairing) app.heritage.leavePair({ silent: true });
    buildWildBar();
    wilding = true;
    // Signal avant la fermeture de la feuille : la leçon de Joseph passe au mode de visée (pas de retour en arrière).
    signal(SIGNALS.wildPlacing, { on: true });
    app.sheets.close('silent');
    app.input?.cancel?.();
    app.hints?.clear?.();
    app.pushPause('valley-wild');
    document.body.classList.add('in-valley-place', 'in-valley-wild');
    app.scene?.setWildPlacing?.(true);
    app.scene?.ensureTouchZoom?.({ animate: !reduced() });
    paintWildBar();
    app.audio.play('open', { volume: 0.6 });
    app.onDecorChange?.(true);
    // La vue va vers la forêt possible la plus proche du centre (si aucune n'est visible).
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const s = app.scene;
      const view = safe(() => s.viewRect?.(), null);
      const list = (w.eligible || []).map((id) => safe(() => s.layout?.wildRect?.(id), null)).filter(Boolean);
      if (!view || !list.length) return;
      const inside = (r) => r.x + r.w > view.x && r.x < view.x + view.w && r.y + r.h > view.y && r.y < view.y + view.h;
      if (list.some(inside)) return;
      const cx = view.x + view.w / 2;
      const cy = view.y + view.h / 2;
      let best = null;
      let bd = Infinity;
      for (const r of list) {
        const d = (r.x + r.w / 2 - cx) ** 2 + (r.y + r.h / 2 - cy) ** 2;
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      if (best) safe(() => s.focusWorld?.(best.x + best.w / 2, best.y + best.h / 2, { animate: !reduced() }), null);
    }));
    if (app.keyboardMode) requestAnimationFrame(() => wildBar.querySelector('#vl-wild-done')?.focus());
    return true;
  }
  function leaveWild({ silent = false } = {}) {
    if (!wilding) return;
    wilding = false;
    document.body.classList.remove('in-valley-wild');
    if (!app.valley?.placing && !app.heritage?.pairing) document.body.classList.remove('in-valley-place');
    app.scene?.setWildPlacing?.(false);
    app.scene?.restoreZoom?.({ animate: !reduced() });
    signal(SIGNALS.wildPlacing, { on: false });
    app.popPause('valley-wild');
    if (!silent) app.audio.play('close', { volume: 0.6 });
    app.onDecorChange?.(false);
    app.tabbar?.refresh?.();
    if (app.sheets.current === 'vl-wild-choice') app.sheets.close('silent');
  }

  // ── Toucher ──────────────────────────────────────────────────────────────────────
  /** Scène de la ferme : poteau « Vers la vallée », terre sauvage, forêt à confier. */
  function onHit(hit) {
    if (!hit || !enabled()) return false;
    switch (hit.type) {
      case 'valleyView':
        app.audio.play('page', { volume: 0.7 });
        goView();
        return true;
      case 'wildLand':
        openWild(hit.cellId);
        return true;
      case 'wildCell':
        if (wilding) openChoice(hit.cellId);
        else enterWild() && requestAnimationFrame(() => openChoice(hit.cellId));
        return true;
      default:
        return false;
    }
  }
  /** Vue de la vallée : lieu, bête qui attend, champignon, ponton, Joseph (la ferme : le retour, géré par la vue). */
  function onViewHit(hit) {
    if (!hit) return false;
    switch (hit.type) {
      case 'place':
        return openPlace(hit.id);
      case 'viewAnimal':
        return observe(hit.id);
      case 'mushroom':
        return pickMushroom(hit.id);
      case 'river':
        return openRiver();
      case 'joseph': {
        const st = (V()?.stories || []).find((s) => s.available && !s.read && s.id !== 'epilogue');
        if (st) return app.heritage?.openStory?.(st.id) || false;
        return false;
      }
      default:
        // (V4) Visiteurs rares, banc de Joseph et d'Hélène : src/ui/career/storks.js.
        return app.storks?.onViewHit?.(hit) || false;
    }
  }

  // ── « À faire maintenant » ────────────────────────────────────────────────────
  function todoItems(g = app.game) {
    if (!placesOpen(g)) return [];
    const v = V(g);
    if (!v) return [];
    const out = [];
    const vis = (v.species || []).filter((s) => s.state === 'visible' && (s.group === 'valley' || speciesDef(s.id)));
    if (vis.length) {
      const s = vis[0];
      const where = speciesDef(s.id) ? placeDef(speciesDef(s.id).placeId)?.where || s.where || '' : s.where || '';
      out.push({ id: 'vl-view-animal', prio: 31, icon: () => speciesIcon(s.id, 'sprite--sm'), text: `${aWho(s.id, s.name)} ${waits(s.id)} ${where}`.trim(), short: `${lower(aWho(s.id, s.name))} à aller voir`, go: () => goView({ speciesId: s.id }) });
    }
    const m = v.mushrooms || [];
    if (m.length) out.push({ id: 'vl-mushrooms', prio: 63, icon: () => vIcon([`find.${m[0].kind}`], 'sprite--sm', '🍄'), text: m.length > 1 ? `${m.length} champignons dans le bois de la Combe` : 'Un champignon dans le bois de la Combe', short: `${plural(m.length, 'champignon')} dans le bois`, go: () => goView({ mushrooms: true }) });
    return out;
  }

  // ── Le prochain indice ──────────────────────────────────────────────────────────
  function hintAction(h) {
    if (!h || !placesOpen()) return null;
    const t = h.target || {};
    switch (h.kind) {
      case 'valleyAnimal':
        return { label: 'Aller voir', go: () => { app.sheets.close('silent'); goView({ speciesId: t.id }); } };
      case 'place':
        return { label: 'Voir', go: () => { app.sheets.close('silent'); requestAnimationFrame(() => openPlace(t.id || t.placeId)); } };
      case 'placeNeed': {
        if (t.type === 'nature') return { label: 'Aménager', go: () => app.valley?.enterPlacing?.(t.id === 'loneTreeAdult' ? 'loneTree' : t.id) };
        if (t.type === 'species' && speciesDef(t.id)) return { label: 'Aller voir', go: () => { app.sheets.close('silent'); goView({ speciesId: t.id }); } };
        if (t.type === 'species') return { label: 'Voir', go: () => app.valley?.openSpecies?.(t.id) };
        if (t.type === 'variety') return { label: 'Voir', go: () => app.valley?.openVariety?.(t.id) };
        if (t.type === 'lot') return { label: 'La carte', go: () => { app.sheets.close('silent'); app.careerUI?.open?.map?.(); } };
        const pid = t.placeId || (t.type === 'place' ? t.id : null);
        return pid ? { label: 'Voir', go: () => { app.sheets.close('silent'); requestAnimationFrame(() => openPlace(pid)); } } : null;
      }
      case 'wild':
        return { label: 'Confier', go: () => enterWild() };
      default:
        return null;
    }
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(ev, g) {
    if (!g || !enabled(g)) return;
    switch (ev.type) {
      case 'valleyViewOpened':
        morning('Joseph vous attend : il veut vous montrer la vallée, depuis la colline.');
        break;
      case 'storyAvailable':
        if (ev.id === 'hill') morning('Joseph vous attend pour monter sur la colline…');
        break;
      case 'worksStarted':
        app.toasts.show({ prio: 'info', kind: 'info', key: 'vl3-works', sprite: vIcon(['icon.works', 'place.works'], 'sprite--sm', '⛏'), text: `Chantier lancé : ${ev.name || 'un lieu'} (${plural(ev.seasons || 1, 'saison')})`, duration: 3200 });
        break;
      case 'placeRecovered': {
        const p = placeDef(ev.placeId);
        tone('reveal', { volume: 0.75, delay: 0.2 });
        app.vibrate?.([14, 50, 14]);
        day.recovered.push(ev);
        morning(`${p?.name || 'Un lieu'} : ${lower(ev.name || 'une étape de plus')}.`);
        app.toasts.show({ prio: 'important', kind: 'achievement', key: `vl3-rec-${ev.placeId}`, sprite: vIcon([p?.icon, `icon.place.${ev.placeId}`], 'sprite--sm', PLACE_EMOJI[ev.placeId] || '🌿'), title: `${p?.name || 'La vallée'} : ${lower(ev.name || '')} !`, text: ev.boon?.text || 'Le lieu reprend vie.', actionLabel: 'Voir', onClick: () => goView({ placeId: ev.placeId }), duration: 6000 });
        break;
      }
      case 'mushroomsGrew': {
        const n = (ev.finds || []).length;
        if (n) morning(n > 1 ? `${n} champignons dans le bois de la Combe.` : 'Un champignon dans le bois de la Combe.');
        break;
      }
      case 'mushroomPicked':
        break;
      case 'riverFished':
        if (app.sheets.current !== 'vl-river') app.toasts.show({ prio: 'info', kind: 'money', key: 'vl3-fish', sprite: vIcon([PD.RIVER_FISH_BY_ID?.[ev.fishId]?.icon], 'sprite--sm', '🐟'), text: `${ev.name || 'Un poisson'} : +${fmt(ev.amount || 0)}`, duration: 2600 });
        break;
      case 'wildLandGiven':
        app.toasts.show({ prio: 'info', kind: 'success', key: 'vl3-wild', sprite: vIcon([kindDef(ev.kind)?.icon], 'sprite--sm', KIND_EMOJI[ev.kind] || '🌿'), text: `${ev.name || 'La forêt'} est rendue à la nature.`, duration: 3000 });
        break;
      case 'wildLandGrown': {
        const k = kindDef(ev.kind);
        app.toasts.show({ prio: 'info', kind: 'info', key: `vl3-grown-${ev.cellId}`, sprite: vIcon([k?.icon], 'sprite--sm', KIND_EMOJI[ev.kind] || '🌿'), text: ev.stage >= 2 ? `Une terre sauvage a repris : ${k?.grown || 'la nature'} !` : `Une terre sauvage reprend : ${lower(k?.stages?.[1] || 'ça pousse')}.`, duration: 3200 });
        break;
      }
      case 'speciesVisible': {
        if (!speciesDef(ev.id)) break;
        const where = placeDef(speciesDef(ev.id).placeId)?.where || ev.where || '';
        morning(`${aWho(ev.id, ev.name)} ${waits(ev.id)} ${where}.`);
        const node = app.toasts.show({ prio: 'important', kind: 'info', key: `vl3-vis-${ev.id}`, sprite: speciesIcon(ev.id, 'sprite--sm'), text: `${aWho(ev.id, ev.name)} ${waits(ev.id)} ${where} !`, actionLabel: 'Voir', onClick: () => goView({ speciesId: ev.id }), duration: 5600 });
        if (node) visToasts.set(ev.id, node);
        tone('chirp', { volume: 0.6, delay: 0.4 });
        break;
      }
      case 'speciesInstalled':
        if (speciesDef(ev.id) && app.sheets.current !== 'vl-observe3') showObserve({ speciesId: ev.id, name: ev.name, anecdote: ev.anecdote, service: ev.service, welcome: ev.welcome });
        break;
      case 'dawn':
        for (const line of morningLines()) morning(line);
        break;
      default:
        break;
    }
    if (live) schedule();
    if (wilding) paintWildBar();
  }

  function morningLines() {
    const out = [];
    if (day.key !== dayKey()) {
      day.key = dayKey();
      day.recovered = [];
    }
    return out;
  }

  /** Après la lecture d'un récit du V3 (src/ui/career/heritage.js) : « Sur la colline » ouvre la vue une première fois. */
  function afterStory(id) {
    if (id === 'hill' && placesOpen() && !viewActive()) {
      // Dès que rien d'autre n'est à l'écran (une fenêtre peut s'intercaler) : 20 essais, toutes les 300 ms.
      let tries = 0;
      const tryOpen = () => {
        if (viewActive() || !placesOpen()) return;
        if (!app.sheets.isOpen() && !app.dialogs.isOpen() && !(app.coach ? app.coach.blocking : app.hints?.active)) goView({ first: true });
        else if (++tries < 20) setTimeout(tryOpen, 300);
      };
      setTimeout(tryOpen, 250);
    }
  }

  // ── Bilan, Carnet, pastilles ─────────────────────────────────────────────────────
  function yearLines(report) {
    const r = report?.valley;
    if (!r) return [];
    const out = [];
    if (r.works) out.push(plural(r.works, 'chantier lancé', 'chantiers lancés'));
    if (r.recovered) out.push(plural(r.recovered, 'étape de lieu atteinte', 'étapes de lieux atteintes'));
    if (r.valleyInstalled) out.push(plural(r.valleyInstalled, 'habitant de la vallée', 'habitants de la vallée'));
    if (r.wilds) out.push(plural(r.wilds, 'terre sauvage', 'terres sauvages'));
    if (r.river) out.push(`${plural(r.river, 'pêche', 'pêches')} au ruisseau`);
    if (r.mushrooms) out.push(plural(r.mushrooms, 'champignon cueilli', 'champignons cueillis'));
    return out;
  }
  function reportLines(v) {
    if (!v?.view?.open || !Array.isArray(v.places)) return [];
    const list = v.places;
    const steps = list.reduce((a, p) => a + (p.step || 0), 0);
    const total = list.reduce((a, p) => a + (p.max || 0), 0) || 19;
    const valleySp = (v.species || []).filter((s) => s.group === 'valley' || speciesDef(s.id));
    const s = v.stats || {};
    return [
      ['Lieux restaurés', `${list.filter((p) => p.restored).length} / ${list.length}`],
      ['Étapes de lieux', `${steps} / ${total}`],
      ['Habitants de la vallée', `${valleySp.filter((x) => x.state === 'installed').length} / ${valleySp.length || 10}`],
      ['Terres sauvages', `${v.wilds?.count || 0} / ${v.wilds?.total || 18}`],
      ['Pêches au ruisseau', fmt(s.river || 0)],
    ];
  }
  const pending = (v) => !!(v?.view?.open && ((v.species || []).some((s) => s.state === 'visible' && (s.group === 'valley' || speciesDef(s.id))) || (v.mushrooms || []).length));

  // ── À chaque image ─────────────────────────────────────────────────────────────
  function frame() {
    const g = app.game;
    if (wilding) {
      if (!g || app.inMenu || g.state.status !== 'playing' || app.dialogs.isOpen() || !placesOpen(g)) leaveWild({ silent: true });
      else if (wildBar) paintWildBar();
    }
  }

  function reset(g = null) {
    if (wilding) leaveWild({ silent: true });
    live = null;
    riverResult = null;
    wildPick = null;
    confirmFor = null;
    groupOpen = false;
    day.key = '';
    day.recovered = [];
    visToasts.clear();
    void g;
  }

  return {
    openPlace,
    openList,
    openWild,
    openChoice,
    enterWild,
    leaveWild,
    get wilding() {
      return wilding;
    },
    openRiver,
    pickMushroom,
    observe,
    onEvent,
    onHit,
    onViewHit,
    todoItems,
    lieuxTab,
    speciesGroup,
    hintAction,
    morningLines,
    yearLines,
    reportLines,
    pending,
    isWildCell,
    afterStory,
    placeState,
    goView,
    frame,
    reset,
    on,
    placesOpen,
    debugState: () => ({ live: live?.id || null, wilding, riverResult: riverResult ? { ...riverResult } : null, wildPick, confirmFor, groupOpen }),
  };
}
