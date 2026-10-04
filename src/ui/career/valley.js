// Interface de La Vallée vivante, lot V1 « La boîte en fer » (docs/VALLEE.md § 2 à § 10 ; contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V1 », « Ce que RENDER et UI consomment », « Écarts et précisions (livraison CORE V1) »).
//
// createValley(app) → app.valley = {
//   open(tab?)               fiche « La Vallée » (feuille haute, pause pendant la lecture) : vignette, étape, signes de vie,
//                            le prochain indice, segments Graines · Habitants · Aménager
//   openJar()                ouverture d'un bocal (le plus ancien) ; openVariety(id), openSpecies(id), openChapter(n)
//   enterPlacing(kind), leavePlacing(), placing      mode aménagement (barre #vl-placebar à la place des onglets)
//   onEvent(ev, game)        main.js : fenêtres (boîte de Joseph), messages classés, sons, écus des étapes, conseils
//   onHit(hit) → bool        wildlife | hedgeFind | valleyBox | natureSpot
//   todoItems(game)          lignes « À faire » : vl-observe, vl-chapter, vl-jar, vl-trial, vl-finds
//   morningLines(ev)         lignes du résumé du matin (appelé par onEvent, via app.todo.morningNote)
//   plotRows(plot)           fiche d'une parcelle : variété, planche d'essai, jachère, sol reposé
//   plotTitle(plot), plotIcon(plot)
//   seedRows(crops, index, { close })   feuille des graines : « Graines anciennes » et « Jachère fleurie »
//   planLabel(value), planRows({ lotId, seasonId, greenhouse, cur, pick })   plan de culture (variétés sauvées)
//   lotSection(lot)          fiche d'un terrain : section « Nature »
//   fairSection()            feuille de la foire aux graines : étal « La grainothèque du pays »
//   yearBlock(report)        fenêtre du bilan annuel : « La vallée cette année »
//   journalCard(ui), reportSection(ui)   Carnet › Ferme (carte « La Vallée ») et Carnet › Bilan
//   frame(), reset(game|null), enabled(game), started(game), debugState()
// }
// (Lot V3) Délègue à app.places (src/ui/career/places.js) : le segment « Lieux », les habitants de la vallée (groupe
// « De la vallée »), le prochain indice (valleyAnimal, place, placeNeed, wild), les gestes de la scène (poteau, terres
// sauvages), les lignes « À faire » vl-view-animal / vl-mushrooms ; chapitres 6 et 7 ; repaint().
//
// Règles : carrière seulement (rien sans state.career.valley) ; rien ne presse, rien ne culpabilise (une bête attend
// sans limite de temps, un bocal attend qu'on l'ouvre) ; cibles ≥ 48 px, textes ≥ 14 px, peu de texte ; traits en
// pictogramme ET en mot ; lecteurs d'écran (libellés, barres lues « 4 récoltes sur 6 ») ; mouvements réduits.

import { el, fmt, plural } from '../dom.js';
import { icon, cropIcon, hasSprite, sprite } from '../icons.js';
import { cropName as cropNameOf } from '../text.js';
import { getCrop } from '../../data/crops.js';
import { SIGNALS } from '../coach/signals.js';
import { v3 } from '../v3.js';
import { readPrefs } from '../guide-prefs.js';
import { SEED_RULES, STAGES, NATURE_ITEMS_BY_ID, TRAITS_BY_ID, JOSEPH_BOX, BOON_TEXTS, agreeWith, savedText } from '../../data/career/valley.js';
import * as VD from '../../data/career/valley.js';
import { BOON_TEXTS_V3, STAGES_V3, VALLEY_SPECIES_BY_ID } from '../../data/career/places.js';

/** (V3) Habitant de la vallée (il attend dans la vue de la vallée, pas sur la ferme). */
const isValleySp = (id) => !!VALLEY_SPECIES_BY_ID?.[id];

// (V2) Lectures par identifiant sur les tables réunies (35 variétés, 16 habitants) quand elles existent.
const VARIETIES_BY_ID = VD.ALL_VARIETIES_BY_ID || VD.VARIETIES_BY_ID;
const SPECIES_BY_ID = VD.ALL_SPECIES_BY_ID || VD.SPECIES_BY_ID;

// ── Textes et petits dessins ─────────────────────────────────────────────────────────

// Les anciens conseils « première fois » (VALLEY_HINTS) sont des leçons de Joseph : src/ui/coach/lessons/valley.js.

/** Articles et accords des habitants (fenêtre d'observation, lignes « À faire »). */
const WHO = {
  robin: { the: 'Le rouge-gorge', a: 'Un rouge-gorge', pl: false, welcome: 'Bienvenue, petit rouge-gorge !' },
  hedgehog: { the: 'Le hérisson', a: 'Un hérisson', pl: false, welcome: 'Bienvenue, petit hérisson !' },
  ladybird: { the: 'Les coccinelles', a: 'Des coccinelles', pl: true, welcome: 'Bienvenue, les coccinelles !' },
  bumblebee: { the: 'Les bourdons', a: 'Des bourdons', pl: true, welcome: 'Bienvenue, les bourdons !' },
  butterfly: { the: 'Le paon-du-jour', a: 'Un paon-du-jour', pl: false, welcome: 'Bienvenue, beau papillon !' },
  swallow: { the: 'Les hirondelles', a: 'Des hirondelles', pl: true, welcome: 'Bienvenue, les hirondelles !' },
  tawnyOwl: { the: 'La chouette hulotte', a: 'Une chouette hulotte', pl: false, welcome: 'Bienvenue, chouette hulotte !' },
  frog: { the: 'La grenouille rousse', a: 'Une grenouille rousse', pl: false, welcome: 'Bienvenue, petite grenouille !' },
  dragonfly: { the: 'Les libellules', a: 'Des libellules', pl: true, welcome: 'Bienvenue, les libellules !' },
  hare: { the: 'Le lièvre', a: 'Un lièvre', pl: false, welcome: 'Bienvenue, petit lièvre !' },
  squirrel: { the: 'L\'écureuil roux', a: 'Un écureuil roux', pl: false, welcome: 'Bienvenue, petit écureuil !' },
  jay: { the: 'Le geai des chênes', a: 'Un geai des chênes', pl: false, welcome: 'Bienvenue, beau geai !' },
  // (V2) docs/VALLEE.md § 16.6
  wildBee: { the: 'L\'osmie', a: 'Une osmie', pl: false, welcome: 'Bienvenue, petite osmie !' },
  blackbird: { the: 'Le merle noir', a: 'Un merle noir', pl: false, welcome: 'Bienvenue, beau merle !' },
  lizard: { the: 'Le lézard des murailles', a: 'Un lézard des murailles', pl: false, welcome: 'Bienvenue, petit lézard !' },
  bat: { the: 'La pipistrelle', a: 'Une pipistrelle', pl: false, welcome: 'Bienvenue, petite pipistrelle !' },
};
const who = (id, name) => (WHO[id] ? { ...WHO[id], g: SPECIES_BY_ID[id]?.g || 'm' } : { the: name || 'Une bête', a: name || 'Une bête', pl: false, g: 'f', welcome: 'Bienvenue !' });
/** Accords d'une variété (genre du nom : « Navet Boule d'or » masculin) : vAgree(x, 'sauvé') → « sauvé » | « sauvée ». */
const genderOf = (x) => x?.g || VARIETIES_BY_ID[x?.varietyId || x?.id]?.g || 'f';
const vAgree = (x, word) => agreeWith({ g: genderOf(x) }, word);
const vPron = (x) => (genderOf(x) === 'm' ? 'le' : 'la');
/** Pronom sujet et futur accordés d'un habitant : « il viendra », « elles viendront ». */
const comes = (s) => `${s.pl ? (s.g === 'f' ? 'elles' : 'ils') : (s.g === 'f' ? 'elle' : 'il')} ${s.pl ? 'viendront' : 'viendra'}`;
/** « la graine », « le greffon ». */
const theUnit = (unit) => (unit === 'greffon' ? 'le greffon' : 'la graine');

const TRAIT_EMOJI = { early: '⏱', dry: '💧', hardy: '❄', fine: '★', tasty: '♥', bee: '🐝', giant: '◆', scented: '❀' };
const NATURE_EMOJI = { hedge: '🌳', strip: '🌼', nestbox: '🏠', owlbox: '🦉', woodpile: '🪵', insectHotel: '🐞', loneTree: '🌳', reeds: '🌾', fallow: '🌸', batbox: '🦇' };
const WILD_EMOJI = { robin: '🐦', hedgehog: '🦔', ladybird: '🐞', bumblebee: '🐝', butterfly: '🦋', swallow: '🐦', tawnyOwl: '🦉', frog: '🐸', dragonfly: '🪲', hare: '🐇', squirrel: '🐿', jay: '🐦', wildBee: '🐝', blackbird: '🐦', lizard: '🦎', bat: '🦇' };
const FIND_EMOJI = { blackberry: '🫐', elderflower: '🌼', sloe: '🫐', hazelnut: '🌰' };
const SEASON_END = { spring: 'du printemps', summer: 'de l\'été', autumn: 'de l\'automne', winter: 'de l\'hiver' };

const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const capitalize = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Sprite de l'atlas, sinon un petit dessin de remplacement (emoji décoratif, caché aux lecteurs d'écran). */
export function vIcon(names, cls = 'sprite--md', emoji = '•') {
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  for (const n of list) if (hasSprite(n)) return sprite(n, cls);
  const size = /--(xs)\b/.test(cls) ? 'xs' : /--(sm)\b/.test(cls) ? 'sm' : /--(lg|hero|card|vl-big|vl-vignette)\b/.test(cls) ? 'lg' : 'md';
  return el(`span.cz-emoji.vl-emoji.is-${size}`, { 'aria-hidden': 'true' }, emoji);
}

/** Pictogramme ET mot d'un trait (jamais la couleur seule). */
export function traitChip(t, { long = false } = {}) {
  if (!t) return null;
  return el(`span.vl-trait.is-${t.id}`, vIcon([t.icon, `icon.trait.${t.id}`], 'sprite--xs', TRAIT_EMOJI[t.id] || '•'), el('span', long && t.text ? `${t.name} : ${lower(t.text)}` : t.name));
}

/** (V2) Une ou deux pastilles de traits (croisées : deux traits) ; accepte `traits` (V2) ou `trait` (V1). */
export function traitsChips(x, opts) {
  const list = Array.isArray(x?.traits) && x.traits.length ? x.traits.map((t) => (typeof t === 'string' ? TRAITS_BY_ID[t] : t)).filter(Boolean) : x?.trait ? [typeof x.trait === 'string' ? TRAITS_BY_ID[x.trait] : x.trait] : [];
  if (!list.length) return null;
  if (list.length === 1) return traitChip(list[0], opts);
  return el(`span.vl-traits${opts?.long ? '.is-long' : ''}`, list.map((t) => traitChip(t, opts)));
}

/** Barre de fixation lue « 4 récoltes à la main sur 6 ». */
export function fixBar(hand, need, unit = 'graine') {
  const n = Math.max(0, Math.min(need, hand | 0));
  const what = unit === 'greffon' ? 'paniers cueillis à la main' : 'récoltes à la main';
  return el(
    'span.vl-fix',
    { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(need), 'aria-valuenow': String(n), 'aria-label': `${n} ${what} sur ${need}` },
    el('span.vl-fix-bar', { 'aria-hidden': 'true' }, Array.from({ length: need }, (_, i) => el(`span.vl-fix-seg${i < n ? '.is-on' : ''}`))),
    el('span.vl-fix-txt', { 'aria-hidden': 'true' }, `${n} / ${need}`),
  );
}

/** Rangée de signes de vie (● ○), lue « 8 signes de vie sur 11 ». */
export function signsRow(signs, target) {
  const max = Math.max(1, target);
  const n = Math.max(0, Math.min(max, signs));
  // (V3) Jusqu'à 99 signes : au-delà de 40 points, une barre lue (la rangée irait sur trois lignes).
  if (max > 40) {
    const pct = Math.round((n / max) * 100);
    return el('span.vl-signs.is-bar', { role: 'img', 'aria-label': `${n} signes de vie sur ${max}` }, el('span.vl-signs-fill', { style: { width: `${pct}%` }, 'aria-hidden': 'true' }));
  }
  return el(
    'span.vl-signs',
    { role: 'img', 'aria-label': `${n} signes de vie sur ${max}` },
    Array.from({ length: max }, (_, i) => el(`span.vl-sign${i < n ? '.is-on' : ''}`, { 'aria-hidden': 'true' })),
  );
}

// ── Module ──────────────────────────────────────────────────────────────────────────

export function createValley(app) {
  let game = null;
  let live = null; // { id, build, sig, lastSig }
  let queued = false;
  let tab = 'seeds';
  let placing = null; // genre posé en mode aménagement
  let bar = null;
  const windows = []; // fenêtres en attente : { kind, data }
  const visToasts = new Map(); // espèce → message « … vous attend » (retiré quand elle s'installe)
  let sceneStage = -1;
  const day = { key: '', seeds: 0, hand: 0 };

  // ── Accès protégés ──────────────────────────────────────────────────────────────
  const enabled = (g = app.game) => !!(g && g.mode === 'career' && g.state?.career?.valley);
  const started = (g = app.game) => enabled(g) && !!g.state.career.valley.started;
  function safe(fn, fallback = null) {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (err) {
      console.warn('Vallée :', err);
      return fallback;
    }
  }
  function q(name, g = app.game, ...args) {
    if (!enabled(g)) return null;
    const fn = g.query?.career?.[name];
    return typeof fn === 'function' ? safe(() => fn(...args), null) : null;
  }
  const V = (g = app.game) => (started(g) ? q('valley', g) : null);
  const dayKey = (g = app.game) => {
    const t = g?.state?.time || {};
    return `${t.year || 0}|${t.day ?? 0}`;
  };
  function refused(text) {
    app.audio.play('error');
    app.vibrate?.([30, 40, 30]);
    app.toasts.show({ kind: 'error', text, log: false });
  }
  /** Action de carrière du cœur : message (sans historique) si refusée ; renvoie le résultat. */
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
  const grantEcus = (n) => {
    const v = Math.floor(n || 0);
    if (v > 0) app.progression?.careerEcus?.(v);
    return v;
  };
  const sceneRect = (kind, id) => safe(() => app.scene?.valleyItemRect?.(kind, id), null);

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

  /** Amène la vue sur un rectangle du monde et l'entoure un moment (anneau de la ligne « À faire »). */
  function focusRect(r, ms = 2400) {
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
  function showInScene(kind, id) {
    const r = sceneRect(kind, id);
    if (!r) return false;
    app.sheets.close();
    requestAnimationFrame(() => focusRect(r));
    return true;
  }

  // ── Fiche « La Vallée » ───────────────────────────────────────────────────────
  function valleySig() {
    const v = V();
    return JSON.stringify([v, tab, Math.floor((app.game?.state.money || 0) / 10)]);
  }

  function stageHead(v) {
    const st = v.stage;
    const next = st.next;
    return el(
      'div.vl-head',
      el('div.vl-vignette', vIcon([st.vignette, `valley.stage.${st.n}`], 'sprite--vl-vignette', ['🌫', '🐦', '🌸', '🐝', '🦔', '🎶', '💧', '🌳'][st.n] || '🌿')),
      el('p.vl-stage', el('b', `Étape ${st.n}`), ` · ${st.name}`),
      el(
        'div.vl-signs-line',
        signsRow(st.signs, next ? next.signs : st.total || 24),
        el('span.vl-signs-txt', next ? `${plural(st.signs, 'signe de vie', 'signes de vie')} · étape ${next.n} à ${next.signs}` : `${plural(st.signs, 'signe de vie', 'signes de vie')} · la vallée chante !`),
      ),
    );
  }

  function hintAction(h) {
    if (!h) return null;
    const t = h.target || null;
    const v2 = app.heritage?.hintAction?.(h); // (V2) troc, paire, Grainothèque, récit
    if (v2) return v2;
    const v3 = app.places?.hintAction?.(h); // (V3) bête de la vallée, lieu prêt, ce qui manque, terre sauvage
    if (v3) return v3;
    switch (h.kind) {
      case 'observe':
        return { label: 'Aller voir', go: () => showInScene('wildlife', t?.id) };
      case 'chapter':
        return { label: 'Écouter Joseph', go: () => openChapter(firstUnread()) };
      case 'jar':
        return { label: 'Ouvrir', go: () => openJar() };
      case 'trial':
        return { label: 'Voir', go: () => goPlots([t?.id]) };
      case 'seeds':
        return { label: 'Semer', go: () => sowAt(t?.id) };
      case 'recipe':
        if (t?.type === 'nature' && t.id === 'fallow') return { label: 'Jachère', go: () => goFallow() };
        if (t?.type === 'nature') return { label: 'Aménager', go: () => enterPlacing(t.id) };
        if (t?.type === 'lot') return { label: 'La carte', go: () => { app.sheets.close('silent'); app.careerUI?.open?.map?.(); } };
        return null;
      default:
        return null;
    }
  }

  function hintCard(v) {
    const h = v.hint;
    if (!h) return null;
    const a = hintAction(h);
    return el(
      'section.vl-hint',
      { 'aria-label': 'Le prochain indice' },
      el('small.vl-hint-title', 'Le prochain indice'),
      el(
        'div.vl-hint-row',
        el('span.vl-hint-ico', vIcon([h.icon], 'sprite--md', h.kind === 'chapter' ? '💬' : '🌿')),
        el('p.vl-hint-text', h.text),
        a ? el('button.btn.btn--red.vl-hint-go', { type: 'button', id: 'vl-hint-go', onclick: () => { app.vibrate?.(8); a.go(); } }, a.label) : null,
      ),
    );
  }

  function tabs() {
    const T = [
      { id: 'seeds', label: 'Graines', on: V()?.parts?.seeds !== false },
      { id: 'wildlife', label: 'Habitants', on: V()?.parts?.wildlife !== false },
      { id: 'nature', label: 'Aménager', on: true },
      { id: 'places', label: 'Lieux', on: !!app.places?.placesOpen?.() }, // (V3) 4ᵉ segment, une fois la vue ouverte
    ].filter((t) => t.on);
    if (!T.some((t) => t.id === tab)) tab = T[0]?.id || 'nature';
    return el(
      `div.seg.vl-seg${T.length >= 4 ? '.is-four' : ''}`,
      { role: 'tablist', 'aria-label': 'La Vallée' },
      T.map((t) =>
        el(
          `button.seg-btn${t.id === tab ? '.is-active' : ''}`,
          { type: 'button', role: 'tab', id: `vl-tab-${t.id}`, 'aria-selected': t.id === tab ? 'true' : 'false', onclick: () => {
            if (t.id === tab) return;
            app.audio.play('page', { volume: 0.6 });
            tab = t.id;
            repaint();
            signal(SIGNALS.valleySheet, { tab: t.id, sheet: 'vl-valley' });
          } },
          el('span', t.label),
        ),
      ),
    );
  }

  function valleyContent() {
    const v = V();
    if (!v) {
      const raw = enabled() ? q('valley') : null;
      return el('div.vl-valley', el('p.cz-lead', raw?.startsAtRank ? `La Vallée commence au rang ${raw.startsAtRank} : Joseph passera avec une boîte en fer.` : 'La Vallée n\'est pas active dans cette ferme.'));
    }
    const body = tab === 'wildlife' ? wildlifeTab(v) : tab === 'nature' ? natureTab(v) : tab === 'places' && app.places ? app.places.lieuxTab(v) : seedsTab(v);
    return el('div.vl-valley', stageHead(v), hintCard(v), tabs(), el('div.vl-panel', { role: 'tabpanel' }, body), chaptersSection(v));
  }

  function open(t = null) {
    if (!enabled()) return false;
    if (t && ['seeds', 'wildlife', 'nature', 'places'].includes(t)) tab = t;
    if (placing) leavePlacing({ silent: true });
    return openLive('vl-valley', { title: 'La Vallée', icon: vIcon(['icon.valley'], 'sprite--md', '🌿'), build: valleyContent, sig: valleySig });
  }

  // ── Onglet Graines ──────────────────────────────────────────────────────────
  function varietyRow(x) {
    const unknown = x.state === 'unknown';
    const status = unknown
      ? el('span.vl-row-sub', x.hint || 'À retrouver.')
      : x.state === 'fixed'
        ? el('span.vl-row-sub.is-ok', `${capitalize(vAgree(x, 'sauvé'))} ✓ · dans le plan de culture${x.seeds ? ` · ${plural(x.seeds, x.unit || 'graine')} gardée${x.seeds > 1 ? 's' : ''}` : ''}`)
        : el('span.vl-row-sub', `${plural(x.seeds, x.unit || 'graine')}${x.growing ? ` · ${x.growing} en terre` : ''}`, fixBar(x.hand, x.need, x.unit));
    return el(
      `button.vl-row.vl-variety${unknown ? '.is-unknown' : ''}${x.state === 'fixed' ? '.is-fixed' : ''}`,
      { type: 'button', id: `vl-var-${x.id}`, 'aria-label': `${x.name}, ${(x.traits || [x.trait]).filter(Boolean).map((t) => t.name).join(' et ')}, ${unknown ? 'à retrouver' : x.state === 'fixed' ? vAgree(x, 'sauvé') : `${plural(x.seeds, x.unit || 'graine')}, ${x.hand} récoltes à la main sur ${x.need}`}`, onclick: () => openVariety(x.id) },
      el(`span.vl-row-ico${x.group === 'cross' ? '.is-cross' : ''}`, unknown ? cropIcon(x.cropId, 'sprite--md') : vIcon([x.icon, x.ripeIcon, `crop.${x.cropId}.icon`, `tree.${x.cropId}.icon`], 'sprite--md', '🌱')),
      el('span.vl-row-main', el('span.vl-row-name', x.name), traitsChips(x), status),
      el('span.c-row-go', { 'aria-hidden': 'true' }, '›'),
    );
  }

  function seedsTab(v) {
    const parts = [];
    if (v.jars?.pending > 0) {
      parts.push(el('button.btn.btn--red.btn--wide.vl-jars', { type: 'button', id: 'vl-open-jar', onclick: () => openJar() }, vIcon(['item.heirloom', 'find.seedjar'], 'sprite--sm', '🫙'), v.jars.pending > 1 ? `${v.jars.pending} bocaux à ouvrir` : 'Un bocal à ouvrir'));
    }
    const fair = fairBlock(v.fair);
    if (fair) parts.push(fair);
    const list = v.varieties || [];
    const fixed = list.filter((x) => x.state === 'fixed').length;
    // (V2) En tête : la carte « La Grainothèque » et la proposition de troc.
    const H = app.heritage?.on?.() ? app.heritage : null;
    if (H) parts.unshift(H.seedsTop(v));
    parts.push(el('p.vl-count', `${fixed} / ${list.length} variétés sauvées`));
    if (H) parts.push(...H.seedGroups(v, varietyRow));
    else {
      // Les variétés qu'on a en main d'abord (graines à semer), puis les sauvées, puis celles à retrouver.
      const rank = { seeds: 0, fixed: 1, unknown: 2 };
      parts.push(el('div.vl-rows', [...list].sort((a, b) => (rank[a.state] ?? 2) - (rank[b.state] ?? 2)).map(varietyRow)));
    }
    parts.push(el('p.sheet-hint', `Récoltez une variété ancienne à la main : + ${v.library?.level >= 2 ? 3 : SEED_RULES.handSeeds} graines. Après ${v.library?.level >= 3 ? 5 : SEED_RULES.fixHand} récoltes à la main, elle est sauvée.`));
    // (V2) « Revoir la boîte en fer » (§ 16.10).
    if (app.heritage) parts.push(app.heritage.boxButton());
    return el('div.vl-seeds', parts);
  }

  function varietyContent(id) {
    const v = V();
    const x = (v?.varieties || []).find((y) => y.id === id);
    if (!x) return el('p.sheet-empty', 'Variété inconnue.');
    const unknown = x.state === 'unknown';
    const parts = [
      el('div.vl-big', unknown ? cropIcon(x.cropId, 'sprite--hero') : vIcon([x.ripeIcon, x.icon, `crop.${x.cropId}.4`, `tree.${x.cropId}.icon`], 'sprite--hero', '🌱'), unknown ? null : vIcon([x.icon, `crop.${x.cropId}.icon`], 'sprite--card', '🌱')),
      el('p.vl-trait-long', traitsChips(x, { long: true })),
      // (V2) « De la part de Lili », croisement « 2 / 3 rencontres » et « Semer la paire ».
      app.heritage?.varietyExtra?.(x) || null,
    ];
    if (unknown) {
      parts.push(el('p.cz-lead', x.hint || 'À retrouver.'));
      if (x.label && x.group !== 'village' && x.group !== 'cross') parts.push(el('p.vl-label', `Étiquette d'un vieux bocal : « ${x.label} »`));
    } else {
      if (x.anecdote) parts.push(el('p.cz-say', `« ${x.anecdote} »`));
      if (x.state === 'fixed') parts.push(el('p.vl-ok', `${capitalize(vAgree(x, 'sauvé'))} ✓ · ${x.tree ? 'greffons illimités' : 'graines illimitées'}${x.seedCost ? ` (${fmt(x.seedCost)} ${theUnit(x.unit)})` : ''} · l'équipe peut ${x.tree ? 'le planter' : `${vPron(x)} semer`}.`));
      else parts.push(el('div.vl-fixline', el('span', `${plural(x.seeds, x.unit || 'graine')} · `), fixBar(x.hand, x.need, x.unit)));
      parts.push(el('p.sheet-hint', x.tree ? 'Planter : touchez une parcelle vide du verger.' : 'Semer : touchez une parcelle vide.'));
      const k = firstSowable(x);
      parts.push(
        el(
          'div.sheet-actions',
          el('button.btn.btn--wide', { type: 'button', onclick: () => open('seeds') }, 'Retour'),
          k !== null && (x.seeds > 0 || x.state === 'fixed') ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl-sow', onclick: () => sowAt(k) }, x.tree ? 'Planter' : 'Semer') : null,
        ),
      );
    }
    if (unknown) parts.push(el('div.sheet-actions', el('button.btn.btn--wide', { type: 'button', onclick: () => open('seeds') }, 'Retour')));
    return el('div.vl-detail', parts);
  }

  function openVariety(id) {
    const x = (V()?.varieties || []).find((y) => y.id === id);
    if (!x) return false;
    return openLive('vl-variety', { title: x.name, icon: x.state === 'unknown' ? cropIcon(x.cropId, 'sprite--md') : vIcon([x.icon], 'sprite--md', '🌱'), build: () => varietyContent(id), sig: () => JSON.stringify((V()?.varieties || []).find((y) => y.id === id)), tall: false });
  }

  /** Première parcelle libre où la variété se sème aujourd'hui (index) ou null. */
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

  function goPlots(list) {
    const ids = (list || []).filter(Number.isInteger);
    if (!ids.length) return;
    app.sheets.close('silent');
    requestAnimationFrame(() => app.todo?.focusPlots?.(ids, ids[0], 'harvest'));
  }

  function goFallow() {
    const plots = safe(() => app.game.query.plots(), []) || [];
    const p = plots.find((x) => x.action === 'plant' && x.env === 'field' && !x.fallow);
    if (!p) return refused('Une jachère se fait sur une parcelle de champ vide.');
    sowAt(p.index);
  }

  // ── Bocaux ─────────────────────────────────────────────────────────────────────
  let jarResult = null;
  function jarContent() {
    const v = V();
    const r = jarResult;
    if (r) {
      const t = r.trait || TRAITS_BY_ID[VARIETIES_BY_ID[r.varietyId]?.trait];
      const x = (v?.varieties || []).find((y) => y.id === r.varietyId);
      const k = x ? firstSowable(x) : null;
      return el(
        'div.vl-jar.is-open',
        el('div.vl-jar-pic', vIcon(['item.heirloom', 'find.seedjar'], 'sprite--card', '🫙'), el('span.vl-jar-pop', { 'aria-hidden': 'true' }, vIcon([VARIETIES_BY_ID[r.varietyId]?.icon], 'sprite--md', '🌱'))),
        el('p.vl-jar-label', { role: 'status' }, el('b', r.name)),
        el('p.vl-trait-long', traitChip(t, { long: true })),
        el('p.vl-ok', `${plural(r.seeds, 'graine')}${r.isNew ? ' · nouvelle variété !' : ''}`),
        el(
          'div.sheet-actions',
          el('button.btn.btn--wide', { type: 'button', id: 'vl-jar-later', onclick: () => { jarResult = null; if (v?.jars?.pending > 0) repaint(); else app.sheets.close(); } }, v?.jars?.pending > 0 ? 'Bocal suivant' : 'Plus tard'),
          k !== null ? el('button.btn.btn--red.btn--wide', { type: 'button', id: 'vl-jar-sow', onclick: () => { jarResult = null; sowAt(k); } }, 'Semer') : null,
        ),
      );
    }
    const jar = v?.jars?.list?.[0];
    if (!jar) return el('div.vl-jar', el('p.cz-lead', 'Aucun bocal à ouvrir : on en trouve au défrichage, chez Basile, et le geai en oublie un chaque automne.'));
    return el(
      'div.vl-jar',
      el('div.vl-jar-pic', vIcon(['item.heirloom', 'find.seedjar'], 'sprite--card', '🫙')),
      el('p.vl-jar-label', jar.label ? `Une étiquette à demi effacée : « ${jar.label} »` : `Un bocal de graines de ${lower(cropName(jar.cropId))}…`),
      v.jars.pending > 1 ? el('p.stats-note', `${v.jars.pending} bocaux attendent.`) : null,
      el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl-jar-open', onclick: () => doOpenJar() }, 'Ouvrir le bocal'),
    );
  }
  const cropName = (id) => safe(() => cropNameOf(id), id) || id;
  function doOpenJar() {
    const res = act('openJar');
    if (!res?.ok) return;
    jarResult = res;
    tone('pop', { volume: 0.9 });
    app.vibrate?.([12, 40, 12]);
    repaint();
  }
  function openJar() {
    if (!started()) return false;
    jarResult = null;
    return openLive('vl-jar', { title: 'Un bocal de graines', icon: vIcon(['item.heirloom', 'find.seedjar'], 'sprite--md', '🫙'), build: jarContent, sig: () => JSON.stringify([V()?.jars, !!jarResult]), tall: false });
  }

  // ── Foire aux graines (étal « La grainothèque du pays ») ───────────────────────
  function fairBlock(f) {
    if (!f) return null;
    return el(
      'section.vl-fair',
      el('h3.stats-title', vIcon(['seedpack.heirloom'], 'sprite--sm', '🌱'), f.stall || 'La grainothèque du pays'),
      f.varietyId
        ? el(
            'div.vl-row.is-static',
            el('span.vl-row-ico', vIcon([f.icon, 'seedpack.heirloom'], 'sprite--md', '🌱')),
            el('span.vl-row-main', el('span.vl-row-name', f.name), traitChip(f.trait), el('span.vl-row-sub', VARIETIES_BY_ID[f.varietyId]?.cropId === 'apple' ? plural(f.seeds, 'greffon') : `Un sachet de ${plural(f.seeds, 'graine')}`)),
            f.bought
              ? el('span.vl-ok', 'Acheté ✓')
              : el(`button.btn.vl-buy${f.canBuy ? '.btn--red' : '.is-disabled'}`, { type: 'button', id: 'vl-fair-buy', 'aria-disabled': f.canBuy ? 'false' : 'true', 'aria-label': `Acheter ${VARIETIES_BY_ID[f.varietyId]?.cropId === 'apple' ? 'les greffons' : 'le sachet'} de ${f.name} pour ${f.price} pièces`, onclick: () => buyFair(f) }, icon('coin', 'sm'), fmt(f.price)),
          )
        : el('p.stats-note', f.reason || 'Toutes les variétés du pays sont déjà chez vous.'),
      !f.canBuy && f.reason && f.varietyId && !f.bought ? el('p.stats-note', f.reason) : null,
    );
  }
  function buyFair(f) {
    if (!f.canBuy) return refused(f.reason || 'Pas possible pour l\'instant.');
    const res = act('buyFairHeirloom');
    if (res?.ok) {
      app.audio.play('buy');
      tone('pop', { volume: 0.8, delay: 0.15 });
      app.vibrate?.(12);
    }
  }
  function fairSection() {
    const v = V();
    return v?.fair ? fairBlock(v.fair) : null;
  }

  // ── Onglet Habitants ──────────────────────────────────────────────────────────
  function speciesRow(s, { goValley = null } = {}) {
    const unknown = s.state === 'unknown';
    const sp = { g: s.g || who(s.id).g, pl: s.pl ?? who(s.id).pl };
    const recipe = el(
      'ul.vl-recipe',
      { 'aria-label': 'Recette d\'habitat' },
      (s.recipe || []).map((r) => el(`li${r.ok ? '.is-ok' : ''}`, el('span.vl-check', { 'aria-hidden': 'true' }, r.ok ? '✓' : '✗'), el('span', `${r.text}${r.ok ? '' : ` (${r.have} / ${r.n})`}`), el('span.sr-only', r.ok ? ' : prêt' : ' : il en manque'))),
      el(`li${s.inSeason ? '.is-ok' : ''}`, el('span.vl-check', { 'aria-hidden': 'true' }, s.inSeason ? '✓' : '·'), el('span', capitalize(s.seasonsText || ''))),
    );
    let state;
    let action = null;
    if (s.state === 'installed') state = el('p.vl-row-sub.is-ok', `${capitalize(agreeWith(sp, 'installé'))} ✓ — ${lower(s.service?.text || '')}`);
    else if (s.state === 'visible') {
      state = el('p.vl-row-sub.is-wait', `${sp.pl ? `${sp.g === 'f' ? 'Elles' : 'Ils'} vous attendent` : 'Vous attend'} ${s.where || ''}.`);
      action = el('button.btn.btn--red.vl-small', { type: 'button', id: `vl-see-${s.id}`, onclick: () => (goValley ? goValley() : showInScene('wildlife', s.id)) }, 'Aller voir');
    } else if (s.state === 'hint') state = el('p.vl-row-sub', `Indice : ${lower(s.hint || '')}`);
    else if (s.recipeOk) state = el('p.vl-row-sub', s.inSeason ? `Tout est prêt : ${comes(sp)} bientôt.` : `Tout est prêt : ${comes(sp)} ${s.seasonsWhen || 'à sa saison'}.`);
    else state = null;
    return el(
      `article.vl-row.vl-species.is-${s.state}`,
      { id: `vl-sp-${s.id}` },
      el('span.vl-row-ico', vIcon([s.icon, `wild.${s.id}`], 'sprite--md', WILD_EMOJI[s.id] || '🐾')),
      el('div.vl-row-main', el('span.vl-row-name', unknown ? `${s.name} · pas encore ${agreeWith(sp, 'venu')}` : s.name), s.state === 'installed' ? null : recipe, state, s.firstMet && s.state !== 'installed' ? el('p.vl-row-sub.is-soft', s.firstMet) : null, s.anecdote ? el('p.cz-say.vl-anec', `« ${s.anecdote} »`) : null),
      action,
    );
  }

  function wildlifeTab(v) {
    const all = v.species || [];
    // (V3) Les habitants de la vallée vivent dans un groupe replié « De la vallée » (en bas).
    const isValley = (s) => s.group === 'valley' || isValleySp(s.id);
    const list = all.filter((s) => !isValley(s));
    const n = list.filter((s) => s.state === 'installed').length;
    const order = { visible: 0, hint: 1, unknown: 2, installed: 3 };
    const sorted = [...list].sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2));
    const services = v.services || [];
    return el(
      'div.vl-wild',
      el('p.vl-count', `${n} / ${list.length} habitants installés`),
      el('div.vl-rows', sorted.map((s) => speciesRow(s))),
      app.places?.speciesGroup?.(all.filter(isValley), speciesRow) || null,
      services.length ? el('section.vl-services', el('h3.stats-title', 'Ce que la vallée vous rend'), el('ul', services.map((s) => el('li', s.text)))) : null,
      el('p.sheet-hint', 'Une bête venue vous attend, sans limite de temps : touchez-la pour qu\'elle s\'installe.'),
    );
  }

  function openSpecies(id) {
    tab = 'wildlife';
    open('wildlife');
    requestAnimationFrame(() => app.sheets.body?.querySelector(`#vl-sp-${id}`)?.scrollIntoView?.({ block: 'center' }));
  }

  // ── Onglet Aménager ───────────────────────────────────────────────────────────
  function natureCard(it) {
    const locked = !!it.locked;
    const free = it.freeSpots || 0;
    const canGo = !locked && free > 0;
    const price = it.reserve > 0 ? 'Gratuit (à replacer)' : `${fmt(it.price)}`;
    return el(
      `article.vl-card${locked ? '.is-locked' : ''}`,
      { id: `vl-nat-${it.kind}` },
      el('span.vl-card-ico', vIcon([it.icon, `icon.nature.${it.kind}`], 'sprite--md', NATURE_EMOJI[it.kind] || '🌿')),
      el(
        'div.vl-card-main',
        el('span.vl-row-name', it.name),
        el('span.vl-card-facts', locked ? el('span.vl-lock', icon('lock', 'sm'), it.reason || `Rang ${it.rank}`) : [el('span', icon('coin', 'xs'), price), el('span', `· ${free ? plural(free, 'emplacement libre', 'emplacements libres') : 'tout est posé'}`), it.placed ? el('span', `· ${it.placed} posé${it.placed > 1 ? 's' : ''}`) : null]),
        el('p.vl-row-sub', it.text),
      ),
      canGo ? el('button.btn.btn--red.vl-small', { type: 'button', id: `vl-place-${it.kind}`, 'aria-label': `Choisir un emplacement : ${it.name}`, onclick: () => enterPlacing(it.kind) }, 'Choisir') : null,
    );
  }

  function natureTab(v) {
    const items = v.nature?.items || [];
    const fallow = el(
      'article.vl-card',
      { id: 'vl-nat-fallow' },
      el('span.vl-card-ico', vIcon(['icon.nature.fallow'], 'sprite--md', '🌸')),
      el('div.vl-card-main', el('span.vl-row-name', 'Jachère fleurie'), el('span.vl-card-facts', el('span', 'Gratuit · une parcelle de champ vide')), el('p.vl-row-sub', 'Elle fleurit jusqu\'à la fin de la saison ; ensuite, la culture suivante pousse plus vite.')),
      el('button.btn.vl-small', { type: 'button', id: 'vl-fallow-go', onclick: () => goFallow() }, 'Où ?'),
    );
    return el('div.vl-nature', el('p.vl-count', `${plural(v.nature?.placed || 0, 'aménagement posé', 'aménagements posés')}`), el('div.vl-cards', items.map(natureCard), fallow), el('p.sheet-hint', 'Rien ne s\'entretient, rien ne s\'abîme : les bêtes viennent quand leur recette est remplie.'));
  }

  // ── Chapitres de Joseph ───────────────────────────────────────────────────────
  function firstUnread(v = V()) {
    const c = (v?.chapters || []).find((x) => x.available && !x.read);
    return c ? c.n : 0;
  }
  function chaptersSection(v) {
    const list = (v.chapters || []).filter((c) => c.available);
    const stories = app.heritage?.on?.() ? app.heritage.storyButtons(v) : []; // (V2) récits de la Grainothèque
    if (!list.length && !stories.length) return null;
    return el(
      'section.vl-chapters',
      el('h3.stats-title', vIcon(['portrait.joseph'], 'sprite--sm', '💬'), 'Les récits de Joseph'),
      el('div.vl-chap-list', list.map((c) => el(`button.btn.vl-chap${c.read ? '' : '.is-new'}`, { type: 'button', id: `vl-chap-${c.n}`, onclick: () => openChapter(c.n) }, c.read ? '' : el('span.vl-new', 'Nouveau · '), c.title)), stories),
    );
  }

  function chapterContent(n) {
    const v = V();
    const c = (v?.chapters || []).find((x) => x.n === n);
    if (!c) return el('p.sheet-empty', 'Chapitre inconnu.');
    return el(
      'div.vl-chapter.cz-veillee',
      el('div.cz-vignette.vl-vignette', vIcon(n === 0 ? [JOSEPH_BOX.vignette, 'story.box'] : [`valley.stage.${n}`], 'sprite--vl-vignette', '🔥')),
      el('h3.cz-story-title', c.title),
      el('div.cz-story', c.lines.map((l, i) => el('p.cz-story-line', { style: { '--cz-delay': `${i}` } }, `« ${l} »`))),
      n > 0 && STAGES[n]?.reward?.boon ? el('p.vl-ok', BOON_TEXTS[STAGES[n].reward.boon]) : null,
      n >= 6 && (STAGES_V3 || []).find((x) => x.n === n)?.reward?.boon ? el('p.vl-ok', BOON_TEXTS_V3?.[(STAGES_V3 || []).find((x) => x.n === n).reward.boon] || '') : null,
      el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl-chap-ok', onclick: () => readChapter(n) }, 'Merci, Joseph'),
    );
  }
  function readChapter(n) {
    const res = act('readChapter', n);
    if (res?.ok) {
      app.vibrate?.(10);
      app.sheets.close();
    }
  }
  function openChapter(n = firstUnread()) {
    if (!started()) return false;
    // (V2) « La boîte en fer » déjà lue : la même fenêtre que le premier jour, avec l'état actuel des trois variétés.
    if (n === 0 && app.heritage && (V()?.chapters || []).find((c) => c.n === 0)?.read && V()?.box) return app.heritage.openBox();
    tone('magic', { volume: 0.6 });
    return openLive('vl-chapter', { title: 'Joseph raconte', icon: vIcon(['portrait.joseph'], 'sprite--md', '💬'), build: () => chapterContent(n), sig: () => '' });
  }

  // ── La boîte en fer (début de la Vallée) ─────────────────────────────────────
  function boxContent(data) {
    const box = data?.box || [];
    const lines = data?.chapter?.lines || JOSEPH_BOX.lines;
    return el(
      'div.vl-box.cz-veillee',
      el('div.cz-vignette.vl-vignette', vIcon([JOSEPH_BOX.vignette, 'story.box'], 'sprite--vl-vignette', '🍪')),
      el('div.cz-story', lines.map((l, i) => el('p.cz-story-line', { style: { '--cz-delay': `${i}` } }, `« ${l} »`))),
      box.length
        ? el(
            'div.vl-box-seeds',
            { role: 'list', 'aria-label': 'Dans la boîte' },
            box.map((b, i) => {
              const x = VARIETIES_BY_ID[b.varietyId];
              return el('div.vl-box-seed', { role: 'listitem', style: { '--cz-delay': `${i + 3}` } }, vIcon([x?.icon, 'seedpack.heirloom'], 'sprite--md', '🌱'), el('b', b.name), traitChip(TRAITS_BY_ID[x?.trait]), el('small', plural(b.seeds, 'graine')));
            }),
          )
        : null,
      data?.hedge ? el('p.cz-say.vl-hedge', `« ${data.hedgeLine || JOSEPH_BOX.hedgeLine} »`, el('small', ' Joseph a planté une haie au bord du champ.')) : null,
      el('button.btn.btn--red.btn--big.btn--wide.vl-go', { type: 'button', id: 'vl-box-ok', onclick: () => {
        act('readChapter', 0);
        app.sheets.close();
        tone('chime', { volume: 0.6 });
      } }, 'Merci, Joseph'),
    );
  }
  function openBox(data) {
    tone('magic', { volume: 0.7 });
    // Ne se ferme plus d'un toucher hors d'elle (§ 16.10) : il faut « Merci, Joseph ».
    return openLive('vl-box', { title: JOSEPH_BOX.title, icon: vIcon(['valley.box'], 'sprite--md', '🍪'), build: () => boxContent(data), sig: () => '', outsideClose: false });
  }

  // ── Observer une bête ────────────────────────────────────────────────────────
  function observeContent(r) {
    const w = who(r.speciesId, r.name);
    return el(
      'div.vl-observe',
      el('div.vl-big', vIcon([`wild.${r.speciesId}`], 'sprite--hero', WILD_EMOJI[r.speciesId] || '🐾')),
      el('h3.vl-obs-title', { role: 'status' }, `${w.the} ${w.pl ? 's\'installent' : 's\'installe'} !`),
      r.anecdote ? el('p.cz-say', `« ${r.anecdote} »`) : null,
      el('p.vl-service', el('span.vl-heart', { 'aria-hidden': 'true' }, '♥ '), r.service?.text || ''),
      el('p.vl-ok', `✓ Album : ${SPECIES_BY_ID[r.speciesId]?.group === 'v2' ? 'Les habitants (suite)' : 'Les habitants de la ferme'}`),
      el('button.btn.btn--red.btn--big.btn--wide.vl-go.vl-welcome', { type: 'button', id: 'vl-welcome', onclick: () => app.sheets.close() }, w.welcome),
    );
  }
  function observe(id) {
    if (isValleySp(id)) return app.places?.observe?.(id) || false; // (V3) dans la vue
    const rect = sceneRect('wildlife', id);
    const res = act('observe', id);
    if (!res?.ok) return false;
    tone('chirp', { volume: 0.9, throttle: 300 });
    app.vibrate?.([12, 50, 12]);
    showObserve(res, rect);
    return true;
  }
  function showObserve(r, rect = null) {
    if (placing) leavePlacing({ silent: true });
    app.toasts.hide?.(visToasts.get(r.speciesId));
    app.toasts.forget?.(`vl-vis-${r.speciesId}`); // message encore en attente (feuille ouverte) : sans objet
    visToasts.delete(r.speciesId);
    openLive('vl-observe', { title: 'Un nouvel habitant', icon: vIcon([`wild.${r.speciesId}`], 'sprite--md', '🐾'), build: () => observeContent(r), sig: () => '', tall: false });
    // La bête reste visible au-dessus de la fenêtre.
    if (rect) requestAnimationFrame(() => requestAnimationFrame(() => safe(() => app.scene?.focusWorld?.(rect.x + rect.w / 2, rect.y + rect.h / 2, { animate: !reduced() }), null)));
  }

  // ── Mode aménagement ─────────────────────────────────────────────────────────
  function natureInfo(kind) {
    return (V()?.nature?.items || []).find((x) => x.kind === kind) || null;
  }
  function buildBar() {
    if (bar) return;
    const b = (id, label, ico, onclick, cls = '') => el(`button.tabbar-btn.vl-bar-btn${cls}`, { type: 'button', id: `vl-bar-${id}`, onclick: () => { app.vibrate?.(8); onclick(); } }, el('span.tabbar-ico', ico), el('span.tabbar-label', label));
    bar = el(
      'nav.vl-placebar',
      { id: 'vl-placebar', 'aria-label': 'Aménager' },
      el('div.vl-bar-info', el('span.vl-bar-ico', { id: 'vl-bar-ico' }), el('span.vl-bar-text', el('b', { id: 'vl-bar-name' }), el('small', { id: 'vl-bar-sub', 'aria-live': 'polite' }))),
      b('done', 'Terminer', icon('play', 'md'), () => leavePlacing(), '.is-done'),
    );
    document.body.append(bar);
  }
  function paintBar() {
    if (!bar || !placing) return;
    const it = natureInfo(placing);
    const name = it?.name || NATURE_ITEMS_BY_ID[placing]?.name || 'Aménagement';
    const nameNode = bar.querySelector('#vl-bar-name');
    const sub = bar.querySelector('#vl-bar-sub');
    const ico = bar.querySelector('#vl-bar-ico');
    if (ico.dataset.kind !== placing) {
      ico.dataset.kind = placing;
      ico.replaceChildren(vIcon([it?.icon, `icon.nature.${placing}`], 'sprite--sm', NATURE_EMOJI[placing] || '🌿'));
    }
    const t1 = `${name} · ${it?.reserve > 0 ? 'gratuit' : fmt(it?.price ?? 0)}`;
    const free = it?.freeSpots || 0;
    const t2 = free ? 'Touchez un emplacement' : 'Tout est posé';
    if (nameNode.textContent !== t1) nameNode.textContent = t1;
    if (sub.textContent !== t2) sub.textContent = t2;
  }
  function enterPlacing(kind) {
    const g = app.game;
    if (!started(g) || g.state.status !== 'playing') return false;
    const it = natureInfo(kind);
    if (!it) return false;
    if (it.locked) return refused(it.reason || `Rang ${it.rank} requis`), false;
    const spots = (q('valleySpots', g, kind) || []).filter((s) => s.free);
    if (!spots.length) return refused('Tous les emplacements de cet aménagement sont pris.'), false;
    buildBar();
    placing = kind;
    // Signal avant la fermeture de la feuille : la leçon de Joseph passe au mode de visée (pas de retour en arrière).
    signal(SIGNALS.placing, { kind });
    app.sheets.close('silent');
    app.input?.cancel?.();
    app.hints?.clear?.();
    app.pushPause('valley');
    document.body.classList.add('in-valley-place');
    app.scene?.setValleyPlacing?.(kind);
    app.scene?.ensureTouchZoom?.({ animate: !reduced() }); // (V3) zoom tactile : emplacements ≥ 48 px
    paintBar();
    app.audio.play('open', { volume: 0.6 });
    app.onDecorChange?.(true);
    // La vue va vers l'emplacement libre le plus proche du centre.
    const s = app.scene;
    const view = safe(() => s.viewRect?.(), null);
    const cx = view ? view.x + view.w / 2 : 0;
    const cy = view ? view.y + view.h / 2 : 0;
    let best = null;
    let bd = Infinity;
    for (const sp of spots) {
      const r = sceneRect('natureSpot', sp.spotId);
      if (!r) continue;
      const d = (r.x + r.w / 2 - cx) ** 2 + (r.y + r.h / 2 - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    if (best && view && !(best.x >= view.x && best.x + best.w <= view.x + view.w && best.y >= view.y && best.y + best.h <= view.y + view.h)) safe(() => s.focusWorld?.(best.x + best.w / 2, best.y + best.h / 2, { animate: !reduced() }), null);
    // (Pas de message « touchez un emplacement » : la barre le dit ; gardé pendant le mode, il arrivait après.)
    if (app.keyboardMode) requestAnimationFrame(() => bar.querySelector('#vl-bar-done')?.focus());
    return true;
  }
  function leavePlacing({ silent = false } = {}) {
    if (!placing) return;
    placing = null;
    document.body.classList.remove('in-valley-place');
    app.scene?.setValleyPlacing?.(null);
    if (!app.heritage?.pairing && !app.places?.wilding) app.scene?.restoreZoom?.({ animate: !reduced() });
    signal(SIGNALS.placing, { kind: null });
    app.popPause('valley');
    if (!silent) app.audio.play('close', { volume: 0.6 });
    app.onDecorChange?.(false);
    app.tabbar?.refresh?.();
    if (app.sheets.current === 'vl-confirm') app.sheets.close('silent');
  }
  function confirmSpot(spotId) {
    const kind = placing;
    const spot = (q('valleySpots', app.game, kind) || []).find((s) => s.spotId === spotId);
    if (!spot) return false;
    const it = natureInfo(kind);
    const verb = kind === 'hedge' || kind === 'loneTree' || kind === 'reeds' ? 'Planter' : kind === 'strip' ? 'Semer' : 'Poser';
    const price = it?.reserve > 0 ? 0 : spot.price;
    const content = el(
      'div.vl-confirm',
      el('p.vl-confirm-where', vIcon([it?.icon], 'sprite--md', NATURE_EMOJI[kind] || '🌿'), el('span', spot.label || spot.lotName || '')),
      !spot.canPlace && spot.reason ? el('p.card-reason', spot.reason) : null,
      el(
        'div.sheet-actions',
        el('button.btn.btn--wide', { type: 'button', onclick: () => app.sheets.close() }, 'Annuler'),
        el(`button.btn.btn--wide${spot.canPlace ? '.btn--red' : '.is-disabled'}`, { type: 'button', id: 'vl-confirm-ok', 'aria-disabled': spot.canPlace ? 'false' : 'true', onclick: () => place(spotId, kind) }, verb, price ? el('span.buy-cost', icon('coin', 'sm'), fmt(price)) : el('span.buy-cost', ' · gratuit')),
      ),
    );
    app.sheets.open({ id: 'vl-confirm', kind: 'popup', title: `${verb} ${articleOf(kind)} ici ?`, icon: vIcon([it?.icon], 'sprite--md', NATURE_EMOJI[kind] || '🌿'), content, className: 'vl-sheet vl-sheet--confirm' });
    return true;
  }
  function articleOf(kind) {
    return { hedge: 'une haie', strip: 'une bande fleurie', nestbox: 'un nichoir', owlbox: 'le nichoir à chouette', woodpile: 'un tas de bois', insectHotel: 'un hôtel à insectes', loneTree: 'un chêne', reeds: 'les berges', batbox: 'un nichoir à chauves-souris' }[kind] || 'un aménagement';
  }
  function place(spotId, kind) {
    const res = act('placeNature', spotId, kind);
    if (!res?.ok) return;
    app.sheets.close('silent');
    app.audio.play('plant', { volume: 0.8 });
    tone('pop', { volume: 0.6, delay: 0.1 });
    app.vibrate?.(14);
    requestAnimationFrame(() => {
      paintBar();
      const left = (q('valleySpots', app.game, kind) || []).filter((s) => s.free).length;
      if (!left) leavePlacing({ silent: true });
    });
  }

  // ── Toucher dans la scène ────────────────────────────────────────────────────
  function onHit(hit) {
    if (!hit || !enabled()) return false;
    if (app.heritage?.onHit?.(hit)) return true; // (V2) Grainothèque, parcelle du mode paire
    if (app.places?.onHit?.(hit)) return true; // (V3) poteau « Vers la vallée », terres sauvages
    switch (hit.type) {
      case 'wildlife':
        return observe(hit.id) || true;
      case 'hedgeFind': {
        const res = act('pickHedgeFind', hit.id);
        if (res?.ok) {
          tone('pop', { volume: 0.85 });
          app.vibrate?.(10);
        }
        return true;
      }
      case 'valleyBox': {
        const v = V();
        if (v?.chapters?.some((c) => c.available && !c.read)) openChapter(firstUnread(v));
        else if (v?.jars?.pending > 0) openJar();
        else open();
        return true;
      }
      case 'natureSpot':
        if (placing) confirmSpot(hit.spotId);
        return true;
      default:
        return false;
    }
  }

  // ── « À faire maintenant » ────────────────────────────────────────────────────
  function todoItems(g = app.game) {
    if (!started(g)) return [];
    const v = V(g);
    if (!v) return [];
    const out = [];
    const vis = (v.species || []).filter((s) => s.state === 'visible' && s.group !== 'valley' && !isValleySp(s.id)); // (V3) vallée : vl-view-animal
    if (vis.length) {
      const s = vis[0];
      const w = who(s.id, s.name);
      out.push({ id: 'vl-observe', prio: 30, icon: () => vIcon([s.icon], 'sprite--sm', WILD_EMOJI[s.id] || '🐾'), text: `${w.a} vous attend${w.pl ? 'ent' : ''} ${s.where || ''}`.trim(), short: `${lower(w.a)} à aller voir`, go: () => showInScene('wildlife', s.id) });
    }
    if ((v.chapters || []).some((c) => c.available && !c.read)) out.push({ id: 'vl-chapter', prio: 35, icon: () => vIcon(['portrait.joseph'], 'sprite--sm', '💬'), text: 'Joseph a quelque chose à vous dire', short: 'Joseph a quelque chose à dire', go: () => openChapter(firstUnread(v)) });
    if (v.jars?.pending > 0) out.push({ id: 'vl-jar', prio: 46, icon: () => vIcon(['item.heirloom', 'find.seedjar'], 'sprite--sm', '🫙'), text: v.jars.pending > 1 ? `${v.jars.pending} bocaux de graines à ouvrir` : 'Un bocal de graines à ouvrir', short: v.jars.pending > 1 ? `${v.jars.pending} bocaux à ouvrir` : 'un bocal à ouvrir', go: () => openJar() });
    const plots = safe(() => g.query.plots(), []) || [];
    const trials = plots.filter((p) => p.action === 'harvest' && p.variety?.trial && !p.crow);
    if (trials.length) {
      const x = trials[0].variety;
      out.push({ id: 'vl-trial', prio: 39, icon: () => vIcon([x.icon], 'sprite--sm', '🌱'), text: `${x.name} : récoltez à la main (+ ${x.seedsOnHand || 2} ${x.unit === 'greffon' ? 'greffon' : 'graines'}, ${Math.min(x.hand, x.need)} / ${x.need})`, short: `${lower(x.name)} à récolter à la main`, go: () => app.todo?.focusPlots?.(trials.map((p) => p.index), trials[0].index, 'harvest') });
    }
    for (const it of app.heritage?.todoItems?.(g) || []) out.push(it); // (V2) vl-troc, vl-story
    for (const it of app.places?.todoItems?.(g) || []) out.push(it); // (V3) vl-view-animal, vl-mushrooms
    const finds = v.finds || [];
    if (finds.length) out.push({ id: 'vl-finds', prio: 66, icon: () => vIcon([finds[0].icon], 'sprite--sm', FIND_EMOJI[finds[0].kind] || '🫐'), text: finds.length > 1 ? `${finds.length} cueillettes dans les haies` : `${finds[0].name} dans une haie`, short: `${plural(finds.length, 'cueillette')} dans les haies`, go: () => showInScene('hedgeFind', finds[0].id) });
    return out;
  }

  // ── Fiches existantes ─────────────────────────────────────────────────────────
  function plotRows(p) {
    if (!enabled() || !p) return null;
    const rows = [];
    const x = p.variety;
    if (x && p.cropId) {
      const kind = x.group === 'cross' ? 'Variété de la ferme' : x.group === 'village' ? 'Variété du village' : 'Variété ancienne';
      rows.push(el('div.tip-strong.vl-plot-var', vIcon([x.icon, `crop.${p.cropId}.icon`], 'sprite--xs', '🌱'), el('span', `${kind}${x.trial ? ' (planche d\'essai)' : ` · ${vAgree(x, 'sauvé')} ✓`}`)));
      rows.push(el('div.vl-plot-trait', traitsChips(x, { long: true })));
      const cross = app.heritage?.plotRows?.(p); // (V2) « Croisement avec … : 2 / 3 rencontres »
      if (cross) rows.push(cross);
      if (x.trial) rows.push(el('div.tip-ok.vl-plot-hand', el('span', `À la main : + ${x.seedsOnHand} ${x.unit === 'greffon' ? (x.seedsOnHand > 1 ? 'greffons' : 'greffon') : 'graines'} `), fixBar(x.hand, x.need, x.unit)));
    }
    if (p.fallow) rows.push(el('div.tip-ok.vl-plot-fallow', vIcon(['icon.nature.fallow'], 'sprite--xs', '🌸'), el('span', p.fallow.text)));
    else if (p.rested && !p.cropId) rows.push(el('div.tip-ok.vl-plot-rested', el('span', `Sol reposé : la prochaine culture pousse + ${(V()?.stage?.n ?? 0) >= 4 ? 20 : 10} %.`)));
    else if (p.rested) rows.push(el('div.tip-sub', 'Sol reposé : elle pousse plus vite.'));
    return rows.length ? el('div.vl-plot', rows) : null;
  }
  function plotTitle(p) {
    if (!enabled() || !p) return null;
    if (!p.cropId && p.fallow) return 'Jachère fleurie';
    if (p.cropId && p.variety) return p.mature ? `${p.variety.name} ${vAgree(p.variety, 'mûr')}` : p.variety.name;
    return null;
  }
  function plotIcon(p) {
    if (!enabled() || !p) return null;
    if (!p.cropId && p.fallow) return vIcon(['icon.nature.fallow'], 'sprite--md', '🌸');
    if (p.cropId && p.variety) return vIcon([p.variety.icon, `crop.${p.cropId}.icon`, `tree.${p.cropId}.icon`], 'sprite--md', '🌱');
    return null;
  }

  /** Feuille des graines : « Graines anciennes » (en tête) et « Jachère fleurie ». */
  function seedRows(crops, index, { close } = {}) {
    if (!started() || !crops) return null;
    const list = crops.heirlooms || [];
    const fallow = crops.fallow || null;
    const p = safe(() => app.game.query.plot(index), null);
    const parts = [];
    if (p?.fallow) parts.push(el('p.vl-note', vIcon(['icon.nature.fallow'], 'sprite--xs', '🌸'), 'En jachère fleurie : semer par-dessus l\'arrête (sans sol reposé).'));
    // (V2) « Semer la paire » d'un geste sur cette parcelle (parent du village ici, celui du pays juste à côté).
    const pairs = app.heritage?.seedRows?.(list, index, { close }) || null;
    if (pairs) parts.push(el('h3.vl-seed-title', vIcon(['icon.cross'], 'sprite--xs', '🐝'), 'Croisements'), pairs);
    if (list.length) {
      parts.push(el('h3.vl-seed-title', vIcon(['seedpack.heirloom'], 'sprite--xs', '🌱'), 'Graines anciennes'));
      parts.push(
        el(
          'div.seed-list.vl-seed-list',
          list.map((h) => {
            const facts = h.seeds > 0 ? `${plural(h.seeds, h.tree ? 'greffon' : 'graine')} · gratuit` : h.fixed ? `${capitalize(vAgree(h, 'sauvé'))} · ${fmt(h.cost)}` : `Plus de ${h.tree ? 'greffon' : 'graines'}`;
            return el(
              `button.seed-row.vl-seed-row${h.canSow ? '' : '.is-disabled'}`,
              { type: 'button', id: `seed-heirloom-${h.varietyId}`, dataset: { variety: h.varietyId }, 'aria-disabled': h.canSow ? 'false' : 'true', onclick: () => sowHeirloom(index, h, close) },
              el(`span.seed-icon${h.group === 'cross' ? '.is-cross' : ''}`, vIcon([h.icon, `crop.${h.cropId}.icon`, `tree.${h.cropId}.icon`], 'sprite--seed', '🌱')),
              el(
                'span.seed-main',
                el('span.seed-name', h.name),
                el('span.seed-facts', traitsChips(h), el('span', h.seeds > 0 ? '' : icon('seed', 'xs'), facts)),
                el('span.seed-warns', h.trial ? el('span.warn-chip.vl-chip-trial', vIcon(['valley.label'], 'sprite--xs', '🏷'), 'Planche d\'essai : récoltez-la à la main') : null, !h.canSow && h.reason ? el('span.warn-chip.is-frost', h.reason) : null),
              ),
            );
          }),
        ),
      );
    }
    if (fallow && p?.env === 'field' && !p.fallow) {
      const pct = Math.round((fallow.growth || 0.1) * 100);
      parts.push(
        el(
          `button.seed-row.vl-fallow-row${fallow.canSow ? '' : '.is-disabled'}`,
          { type: 'button', id: 'seed-fallow', 'aria-disabled': fallow.canSow ? 'false' : 'true', onclick: () => sowFallow(index, fallow, close) },
          el('span.seed-icon', vIcon(['icon.nature.fallow', `nature.fallow.${seasonId()}`], 'sprite--seed', '🌸')),
          el('span.seed-main', el('span.seed-name', 'Jachère fleurie (gratuit)'), el('span.seed-facts', el('span', `Jusqu'à la fin ${SEASON_END[seasonId()]} · ensuite + ${pct} % de pousse`)), !fallow.canSow && fallow.reason ? el('span.seed-warns', el('span.warn-chip.is-frost', fallow.reason)) : null),
        ),
      );
    }
    return parts.length ? el('div.vl-seeds-sec', parts) : null;
  }
  const seasonId = () => ['spring', 'summer', 'autumn', 'winter'][((app.game?.state?.time?.seasonIndex ?? 0) % 4 + 4) % 4];

  function sowHeirloom(index, h, close) {
    if (!h.canSow) return refused(h.reason || 'Pas possible ici.');
    const res = act('sowHeirloom', index, h.varietyId);
    if (!res?.ok) return;
    app.audio.play('plant', { volume: 0.8 });
    app.vibrate?.(10);
    let n = 1;
    // « Semer partout » : le stock de graines (ou l'argent, une fois sauvée) jusqu'au bout, puis s'arrête.
    if (readPrefs().sowAll) {
      const plots = safe(() => app.game.query.plots(), []) || [];
      for (const p of plots) {
        if (p.index === index || p.action !== 'plant' || p.fallow) continue;
        if (h.tree ? p.env !== 'orchard' : p.env === 'orchard') continue;
        const row = (safe(() => app.game.query.plantableCrops(p.index)?.heirlooms, []) || []).find((y) => y.varietyId === h.varietyId);
        if (!row?.canSow) {
          if (row && !row.fixed && row.seeds <= 0) break;
          continue;
        }
        const r2 = app.game.actions.career.sowHeirloom(p.index, h.varietyId);
        if (!r2?.ok) break;
        n++;
      }
    }
    if (n > 1) app.toasts.show({ prio: 'important', kind: 'success', key: 'vl-sow', sprite: vIcon([h.icon], 'sprite--sm', '🌱'), text: `${h.name} : ${plural(n, 'parcelle semée', 'parcelles semées')}.`, duration: 2600, log: false });
    close?.();
  }

  function sowFallow(index, f, close) {
    if (!f.canSow) return refused(f.reason || 'Pas possible ici.');
    const res = act('sowFallow', index);
    if (!res?.ok) return;
    app.audio.play('plant', { volume: 0.7 });
    tone('pop', { volume: 0.5, delay: 0.1 });
    app.vibrate?.(10);
    close?.();
  }

  /** Plan de culture : valeur 'heirloom:<id>' → libellé et icône. */
  function planLabel(value) {
    const id = typeof value === 'string' && value.startsWith('heirloom:') ? value.slice(9) : null;
    const x = id ? (V()?.varieties || []).find((y) => y.id === id) || VARIETIES_BY_ID[id] : null;
    return x ? [vIcon([x.icon, `crop.${x.cropId}.icon`], 'sprite--sm', '🌱'), el('span.vl-plan-name', x.name)] : null;
  }
  function planRows({ seasonId: sid, greenhouse, cur, pick }) {
    const v = V();
    if (!v) return [];
    const list = (v.varieties || []).filter((x) => x.state === 'fixed' && !x.tree);
    const out = [];
    for (const x of list) {
      const seasons = cropSeasons(x.cropId);
      if (!greenhouse && seasons && !seasons.includes(sid)) continue;
      const value = `heirloom:${x.id}`;
      out.push(
        el(
          `button.seed-row.c-plan-pick.vl-plan-row${cur === value ? '.is-current' : ''}`,
          { type: 'button', id: `c-plan-heirloom-${x.id}`, onclick: () => pick(value), 'aria-pressed': cur === value ? 'true' : 'false' },
          el('span.seed-icon', vIcon([x.icon, `crop.${x.cropId}.icon`], 'sprite--seed', '🌱')),
          el('span.seed-main', el('span.seed-name', x.name), el('span.seed-facts', traitsChips(x), el('span', icon('seed', 'xs'), x.seedCost ? fmt(x.seedCost) : '—'))),
          cur === value ? el('span.c-check', '✓') : null,
        ),
      );
    }
    return out.length ? [el('h3.vl-seed-title', vIcon(['seedpack.heirloom'], 'sprite--xs', '🌱'), 'Variétés sauvées'), ...out] : [];
  }
  function cropSeasons(cropId) {
    return safe(() => getCrop(cropId)?.seasons, null);
  }

  /** Fiche d'un terrain : section « Nature » (emplacements, posés ou à poser). */
  function lotSection(lot) {
    if (!started() || !lot?.nature) return null;
    const list = lot.nature;
    if (!list.length) return null;
    const v = V();
    const items = Object.fromEntries((v?.nature?.items || []).map((x) => [x.kind, x]));
    return el(
      'section.c-sec.vl-lot',
      el('h3.stats-title', vIcon(['icon.valley'], 'sprite--sm', '🌿'), 'Nature'),
      list.map((s) => {
        const it = items[s.kind];
        const name = `${NATURE_ITEMS_BY_ID[s.kind]?.name || s.kind}, ${String(s.label || '').split(', ').slice(1).join(', ') || ''}`.replace(/, $/, '');
        const right = s.placed
          ? el('span.vl-ok', '✓')
          : it?.locked
            ? el('span.vl-lock', icon('lock', 'sm'), it.reason || `Rang ${it.rank}`)
            : el('button.btn.btn--red.vl-small', { type: 'button', id: `vl-lot-${s.spotId.replace(/\./g, '-')}`, onclick: () => { const r = act('placeNature', s.spotId, s.kind); if (r?.ok) { app.audio.play('plant', { volume: 0.8 }); app.careerUI?.refresh?.(); } } }, `${s.kind === 'hedge' || s.kind === 'loneTree' || s.kind === 'reeds' ? 'Planter' : s.kind === 'strip' ? 'Semer' : 'Poser'} · ${it?.reserve > 0 ? 'gratuit' : fmt(it?.price ?? 0)}`);
        return el('div.vl-lot-row', vIcon([it?.icon, `icon.nature.${s.kind}`], 'sprite--sm', NATURE_EMOJI[s.kind] || '🌿'), el('span.vl-lot-name', name), right);
      }),
    );
  }

  /** Fenêtre du bilan annuel : « La vallée cette année ». */
  function yearBlock(report) {
    const r = report?.valley;
    if (!r || !r.started) return null;
    const y = r.year || {};
    const bits = [];
    const nInst = (r.installed || []).length || y.installed || 0;
    const nFix = (r.fixed || []).length || y.fixed || 0;
    if (nInst) bits.push(`${plural(nInst, 'habitant est venu', 'habitants sont venus')}`);
    if (nFix) bits.push(`${plural(nFix, 'variété sauvée', 'variétés sauvées')}`);
    if (y.placed) bits.push(`${plural(y.placed, 'aménagement posé', 'aménagements posés')}`);
    if (y.seedsSaved) bits.push(`${plural(y.seedsSaved, 'graine gardée', 'graines gardées')}`);
    if (y.finds) bits.push(`${plural(y.finds, 'cueillette', 'cueillettes')} dans les haies`);
    for (const t of app.heritage?.yearLines?.(report) || []) bits.push(t); // (V2) trocs, croisements, Grainothèque
    for (const t of app.places?.yearLines?.(report) || []) bits.push(t); // (V3) chantiers, étapes de lieux, terres sauvages
    const names = [...(r.installed || []).map((id) => SPECIES_BY_ID[id]?.name), ...(r.fixed || []).map((id) => VARIETIES_BY_ID[id]?.name)].filter(Boolean);
    return el(
      'section.vl-year',
      el('h3.sum-title', vIcon(['icon.valley'], 'sprite--sm', '🌿'), 'La vallée cette année'),
      el('p.vl-year-line', bits.length ? `${capitalize(bits.join(', '))}.` : 'Une année tranquille pour la vallée.'),
      names.length ? el('p.stats-note', names.join(' · ')) : null,
      el('p.stats-note', `Étape ${r.stage} · ${r.stageName} · ${plural(r.signs || 0, 'signe de vie', 'signes de vie')}${r.natureTotal ? ` · ${plural(r.natureTotal, 'aménagement', 'aménagements')} en tout` : ''}.`),
    );
  }

  /** Carnet › Ferme : carte « La Vallée » (en tête). */
  function journalCard(ui) {
    const g = ui?.game || app.game;
    if (!enabled(g)) return null;
    const v = V(g);
    if (!v) {
      const raw = q('valley', g);
      if (!raw?.startsAtRank) return null;
      return el('section.c-sec.vl-jcard.is-soon', el('p.stats-note', vIcon(['icon.valley'], 'sprite--xs', '🌿'), ` La Vallée commence au rang ${raw.startsAtRank}.`));
    }
    const pending = (v.species || []).some((s) => s.state === 'visible') || (v.chapters || []).some((c) => c.available && !c.read) || v.jars?.pending > 0 || !!app.heritage?.pending?.(v) || !!app.places?.pending?.(v);
    return el(
      'button.vl-jcard',
      { type: 'button', id: 'c-j-valley', onclick: () => open(), 'aria-label': `La Vallée : étape ${v.stage.n}, ${v.stage.name}, ${v.stage.signs} signes de vie${pending ? ', quelque chose vous attend' : ''}` },
      el('span.vl-jcard-pic', vIcon([v.stage.vignette], 'sprite--vl-thumb', '🌿')),
      el('span.vl-jcard-main', el('b', 'La Vallée'), el('span', `Étape ${v.stage.n} · ${v.stage.name}`), el('small', `${plural(v.stage.signs, 'signe de vie', 'signes de vie')}${v.stage.next ? ` · étape ${v.stage.next.n} à ${v.stage.next.signs}` : ''}`)),
      pending ? el('span.vl-dot', { 'aria-hidden': 'true' }) : null,
      el('span.c-row-go', { 'aria-hidden': 'true' }, '›'),
    );
  }

  /** Carnet › Bilan : la Vallée (cumul). */
  function reportSection(ui) {
    const g = ui?.game || app.game;
    const v = V(g);
    if (!v) return null;
    const s = v.stats || {};
    const line = (label, value) => el('div.stats-line', el('span.stats-label', label), el('b.stats-value', value));
    return el(
      'section.c-sec.vl-report',
      el('h3.stats-title', vIcon(['icon.valley'], 'sprite--sm', '🌿'), 'La Vallée'),
      line('Variétés sauvées', `${(v.fixed || []).length} / ${(v.varieties || []).length}`),
      line('Habitants installés', `${(v.installed || []).length} / ${(v.species || []).length}`),
      line('Récoltes à la main de variétés', fmt(s.hand || 0)),
      line('Graines gardées', fmt(s.seedsSaved || 0)),
      line('Aménagements posés', fmt(v.nature?.placed || 0)),
      ...(app.heritage?.reportLines?.(v) || []).map(([a, b]) => line(a, b)),
      ...(app.places?.reportLines?.(v) || []).map(([a, b]) => line(a, b)),
      line('Dépensé pour la vallée', `${fmt(v.spent || 0)} pièces`),
      el('p.stats-note', 'Ces dépenses comptent entièrement dans le patrimoine.'),
    );
  }

  // ── Étapes : écus, décor, chapitre ───────────────────────────────────────────
  function onStage(ev, g) {
    const e = grantEcus(ev.reward?.ecus);
    let cosmetic = null;
    const P = v3.progression;
    if (typeof P?.recordValleyStage === 'function') {
      try {
        const r = P.recordValleyStage(app.progression.get(), ev.n);
        if (r?.progress) app.progression.commit(r.progress);
        if (r?.rewards?.cosmeticId && !r.rewards.already) cosmetic = r.rewards.cosmeticId;
      } catch (err) {
        console.warn('recordValleyStage :', err);
      }
    }
    app.scene?.setValleyStage?.(ev.n);
    sceneStage = ev.n;
    tone('reveal', { volume: 0.7, delay: 0.2 });
    morning(`La vallée : « ${ev.name} ».`);
    const cosName = cosmetic ? (v3.cosmetics?.COSMETICS || []).find((c) => c.id === cosmetic)?.name || cosmetic : null;
    app.toasts.show({ prio: 'important', kind: 'achievement', key: 'vl-stage', sprite: vIcon([`valley.stage.${ev.n}`, 'icon.valley'], 'sprite--sm', '🌿'), title: `La vallée : ${ev.name}`, text: [e ? `+${plural(e, 'écu')}` : null, cosName ? `nouveau décor : ${cosName}` : null].filter(Boolean).join(' · ') || 'Joseph a quelque chose à vous dire.', actionLabel: 'Écouter', onClick: () => openChapter(ev.n), duration: 6000 });
    void g;
  }

  // ── Événements ─────────────────────────────────────────────────────────────────
  function onEvent(ev, g) {
    if (!g || !enabled(g)) return;
    game = g;
    try {
      app.heritage?.onEvent?.(ev, g); // (V2) troc, croisements, Grainothèque, récits
    } catch (err) {
      console.warn('Grainothèque (événement) :', err);
    }
    try {
      app.places?.onEvent?.(ev, g); // (V3) lieux, reprises, pêche, champignons, terres sauvages, bêtes de la vallée
      app.valleyView?.onEvent?.(ev, g);
    } catch (err) {
      console.warn('Lieux de la vallée (événement) :', err);
    }
    // (V3) Les bêtes de la vallée attendent dans la vue : leurs messages et leur fenêtre sont ceux de app.places.
    if ((ev.type === 'speciesVisible' || ev.type === 'speciesInstalled') && isValleySp(ev.id)) {
      if (live) schedule();
      return;
    }
    switch (ev.type) {
      case 'valleyStarted':
        windows.push({ kind: 'box', data: ev });
        morning('Joseph est passé ce matin, avec une boîte en fer…');
        app.scene?.setValleyStage?.(0);
        break;
      case 'heirloomHarvest':
        if (ev.by === 'player' || !ev.by) {
          const k = dayKey(g);
          if (day.key !== k) {
            day.key = k;
            day.seeds = 0;
            day.hand = 0;
          }
          day.seeds += ev.seeds || 0;
          day.hand += 1;
        }
        break;
      case 'heirloomFixed':
        tone('chime', { volume: 0.85, delay: 0.5 });
        app.vibrate?.([14, 50, 14]);
        app.toasts.show({ prio: 'important', kind: 'achievement', key: `vl-fixed-${ev.varietyId}`, sprite: vIcon([VARIETIES_BY_ID[ev.varietyId]?.icon], 'sprite--sm', '🌱'), title: ev.text || (VARIETIES_BY_ID[ev.varietyId] ? savedText(VARIETIES_BY_ID[ev.varietyId]) : `${ev.name} : variété sauvée !`), text: 'Dans l\'album et le plan de culture.', actionLabel: 'Voir', onClick: () => openVariety(ev.varietyId), duration: 5200 });
        break;
      case 'heirloomSown':
        if ((ev.by === 'player' || !ev.by) && ev.fromSeeds) app.toasts.show({ prio: 'info', kind: 'info', key: 'vl-sown', sprite: vIcon([VARIETIES_BY_ID[ev.varietyId]?.icon], 'sprite--sm', '🌱'), text: `Planche d'essai : il reste ${plural(ev.seedsLeft || 0, 'graine')}.`, duration: 2400, log: false });
        break;
      case 'naturePlaced':
        break;
      case 'natureReserved': {
        const n = (ev.kinds || []).length;
        if (n) app.toasts.show({ prio: 'important', kind: 'info', key: 'vl-reserve', sprite: vIcon(['icon.valley'], 'sprite--sm', '🌿'), text: `${plural(n, 'aménagement', 'aménagements')} à replacer, gratuitement (La Vallée › Aménager).`, actionLabel: 'Voir', onClick: () => open('nature'), duration: 5200 });
        break;
      }
      case 'fallowEnded':
        morning((ev.plots || []).length > 1 ? `Sol reposé sur ${ev.plots.length} parcelles : la prochaine culture y poussera plus vite.` : 'Sol reposé : la prochaine culture y poussera plus vite.');
        break;
      case 'speciesHint':
        morning(ev.text);
        break;
      case 'speciesVisible': {
        const w = who(ev.id, ev.name);
        morning(`${w.a} vous attend${w.pl ? 'ent' : ''} ${ev.where || ''}.`);
        const node = app.toasts.show({ prio: 'important', kind: 'info', key: `vl-vis-${ev.id}`, sprite: vIcon([`wild.${ev.id}`], 'sprite--sm', WILD_EMOJI[ev.id] || '🐾'), text: `${w.a} vous attend${w.pl ? 'ent' : ''} ${ev.where || ''} : touchez-${w.pl ? 'les' : 'le'} !`, actionLabel: 'Voir', onClick: () => showInScene('wildlife', ev.id), duration: 5600 });
        if (node) visToasts.set(ev.id, node);
        tone('chirp', { volume: 0.6, delay: 0.4 });
        break;
      }
      case 'speciesInstalled':
        // Toucher du joueur : la fenêtre est ouverte par observe() ; sinon (débogage), on l'ouvre ici.
        if (app.sheets.current !== 'vl-observe') showObserve({ speciesId: ev.id, name: ev.name, service: ev.service, anecdote: ev.anecdote });
        break;
      case 'hedgeFinds': {
        const f = (ev.finds || [])[0];
        if (f) morning(`${({ blackberry: 'Des mûres', elderflower: 'Des fleurs de sureau', sloe: 'Des prunelles', hazelnut: 'Des noisettes' })[f.kind] || 'Une cueillette'} dans une haie…`);
        break;
      }
      case 'hedgePicked':
        app.toasts.show({ prio: 'important', kind: 'money', key: 'vl-pick', sprite: vIcon([`hedgefind.${ev.kind}`], 'sprite--sm', FIND_EMOJI[ev.kind] || '🫐'), text: `${ev.name || 'Cueillette'} : +${fmt(ev.amount || 0)}`, duration: 2400 });
        break;
      case 'jayGift':
        morning(ev.text || 'Le geai a oublié un bocal au pied du chêne.');
        app.toasts.show({ prio: 'important', kind: 'info', key: 'vl-jay', sprite: vIcon(['wild.jay'], 'sprite--sm', '🐦'), text: ev.text || 'Le geai a oublié un bocal au pied du chêne.', actionLabel: 'Ouvrir', onClick: () => openJar(), duration: 5200 });
        break;
      case 'fairHeirloomBought':
        app.toasts.show({ prio: 'important', kind: 'success', key: 'vl-fair', sprite: vIcon(['seedpack.heirloom'], 'sprite--sm', '🌱'), text: `${ev.name || 'Un sachet'} : ${plural(ev.seeds || 3, VARIETIES_BY_ID[ev.varietyId]?.cropId === 'apple' ? 'greffon' : 'graine')} dans la boîte en fer.`, duration: 3200 });
        break;
      case 'valleyStage':
        onStage(ev, g);
        break;
      case 'dawn': {
        for (const line of morningLines(ev)) morning(line);
        break;
      }
      default:
        break;
    }
    if (live) schedule();
  }

  /** Résumé du matin : graines anciennes gardées hier (à la main). */
  function morningLines() {
    const out = [];
    if (day.seeds > 0 && day.key && day.key !== dayKey()) out.push(`Hier : ${plural(day.seeds, 'graine ancienne gardée', 'graines anciennes gardées')}.`);
    if (day.key !== dayKey()) {
      day.seeds = 0;
      day.hand = 0;
      day.key = dayKey();
    }
    return out;
  }

  // ── À chaque image ─────────────────────────────────────────────────────────────
  function frame() {
    const g = app.game;
    if (placing) {
      if (!g || app.inMenu || g.state.status !== 'playing' || app.dialogs.isOpen() || !started(g)) leavePlacing({ silent: true });
      else if (bar) paintBar();
    }
    if (!g || app.inMenu || !enabled(g)) return;
    const v = g.state.career.valley;
    const n = v.started ? v.stage || 0 : 0;
    if (n !== sceneStage) {
      sceneStage = n;
      app.scene?.setValleyStage?.(n);
    }
    // Fenêtres en attente (boîte de Joseph) : seulement quand rien d'autre n'est affiché.
    if (windows.length && g.state.status === 'playing' && !app.dialogs.isOpen() && !app.sheets.isOpen() && !(app.coach ? app.coach.blocking : app.hints?.active || app.tutorial?.active) && !app.cozy?.feteMode && !placing && !app.decor?.active && !app.valleyView?.active && !app.places?.wilding) {
      const w = windows.shift();
      if (w.kind === 'box') openBox(w.data);
    }
  }

  function reset(g = null) {
    if (placing) leavePlacing({ silent: true });
    game = g;
    live = null;
    windows.length = 0;
    sceneStage = -1;
    day.key = '';
    day.seeds = 0;
    day.hand = 0;
    jarResult = null;
    tab = 'seeds';
  }

  return {
    open,
    repaint,
    openJar,
    openVariety,
    openSpecies,
    openChapter,
    openBox,
    enterPlacing,
    leavePlacing,
    get placing() {
      return placing;
    },
    onEvent,
    onHit,
    observe,
    todoItems,
    morningLines,
    plotRows,
    plotTitle,
    plotIcon,
    seedRows,
    planLabel,
    planRows,
    lotSection,
    fairSection,
    yearBlock,
    journalCard,
    reportSection,
    frame,
    reset,
    enabled,
    started,
    showInScene,
    debugState: () => ({ live: live?.id || null, tab, placing, windows: windows.map((w) => w.kind), sceneStage, day: { ...day }, game: !!game }),
  };
}

