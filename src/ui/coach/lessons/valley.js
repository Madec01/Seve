// Catalogue « La Vallée » de l'accompagnement (paquet LEÇONS Vallée) : leçons V1 → V4 et rappels de la Vallée.
// Format : docs/ARCHITECTURE.md, « Accompagnement — contrats » (Format d'une leçon, ctx, cibles, rappels, SIGNALS).
// Conception : docs/ACCOMPAGNEMENT.md § 7.7, § 7.8 (V4), § 8.4 (rappels jar, species, troc, chapter, trial) et § 10.3
// (déduction de ce qui est déjà su). PUR : aucun accès au DOM ni à `window` ; tout passe par `ctx` (lecture seule).
//
// Les identifiants des anciens conseils (VALLEY_HINTS, HERITAGE_HINTS, PLACES_HINTS, STORKS_HINTS) sont repris tels
// quels : un conseil déjà vu compte comme une leçon vue (progression.hintsSeen).
//
// Cibles de la scène : formes de scene.hitTest (façade scene.targetRect du MOTEUR) — valleyBox, wildlife, hedgeFind,
// natureSpot (spotId), seedLibrary, pairPlot (plotIndex), villageBoard, valleyView (poteau), wildCell (cellId), visitor ;
// vue de la vallée : app.valleyView.targetPageRect — place, viewAnimal, mushroom, river, visitor.

import { ALL_SPECIES_BY_ID, ALL_VARIETIES_BY_ID } from '../../../data/career/valley.js';
import { VALLEY_SPECIES_BY_ID, PLACES } from '../../../data/career/places.js';

// ── Lectures (toutes gardées : une partie sans Vallée, ou un lot non chargé, ne casse rien) ──────────────────────

const CH = 'valley';
const CAREER = ['career'];

const safe = (ctx, fn, fallback = null) => {
  try {
    const v = ctx?.safe ? ctx.safe(fn, fallback) : fn();
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
};
/** État brut de la Vallée (`state.career.valley`), ou null. */
const VS = (ctx) => ctx?.state?.career?.valley || null;
const started = (ctx) => !!VS(ctx)?.started;
/** Requête complète (plus lourde) : seulement quand l'état dit qu'il y a quelque chose. */
const QV = (ctx) => safe(ctx, () => ctx.q.career.valley(), null);
/** Jour absolu du jeu (formule du cœur : crew.js absDay) — celle des champs `since`, `ripeAt`, `readyAt` de l'état. */
const gameAbs = (ctx) => {
  const s = ctx?.state;
  const L = s?.career?.seasonLength;
  return s?.time && L ? (s.time.year - 1) * 4 * L + s.time.day : 0;
};
/** « Aujourd'hui » dans l'unité de l'accompagnement (ctx.day.abs), à défaut celle du jeu. */
const abs = (ctx) => (Number.isFinite(ctx?.day?.abs) ? ctx.day.abs : gameAbs(ctx));
/** Un jour absolu du jeu traduit dans l'unité de ctx.day.abs (les deux comptes peuvent différer : seul l'écart compte). */
const sinceOf = (ctx, v) => (Number.isFinite(v) ? abs(ctx) - Math.max(0, gameAbs(ctx) - v) : abs(ctx));
const parts = (ctx) => VS(ctx)?.parts || {};
const heritageOn = (ctx) => started(ctx) && (VS(ctx).v || 1) >= 2 && parts(ctx).heritage !== false;
const placesOn = (ctx) => heritageOn(ctx) && (VS(ctx).v || 1) >= 3 && parts(ctx).places !== false;
const viewOpen = (ctx) => placesOn(ctx) && !!VS(ctx).view?.open;
const storksOn = (ctx) => placesOn(ctx) && (VS(ctx).v || 1) >= 4 && parts(ctx).storks !== false;
const sum = (o) => Object.values(o || {}).reduce((a, n) => a + (Number(n) || 0), 0);
const stats = (ctx) => VS(ctx)?.stats || {};

/** Signal d'interface courant (`ctx.signal`) : nom et, si donné, identifiant (`data.id`). */
const isSignal = (ctx, name, id) => ctx?.signal?.name === name && (id === undefined || ctx.signal.data?.id === id);
const sheetOpened = (ctx, ...ids) => isSignal(ctx, 'sheetOpen') && ids.includes(ctx.signal.data?.id);
const sheetIs = (ctx, ...ids) => ids.includes(ctx?.ui?.sheet);
const evIs = (ctx, type) => ctx?.ev?.type === type;
const byPlayer = (ctx) => !ctx?.ev?.by || ctx.ev.by === 'player';

const isValleySp = (id) => !!VALLEY_SPECIES_BY_ID?.[id];
/** Habitant qui attend sur la ferme (V1, V2) : état 'visible', hors habitants de la vallée. */
function farmVisible(ctx) {
  const sp = VS(ctx)?.species || {};
  return Object.keys(sp).filter((id) => sp[id]?.state === 'visible' && !isValleySp(id));
}
function valleyVisible(ctx) {
  const sp = VS(ctx)?.species || {};
  return Object.keys(sp).filter((id) => sp[id]?.state === 'visible' && isValleySp(id));
}
function anyInstalled(ctx, valley = null) {
  const sp = VS(ctx)?.species || {};
  return Object.keys(sp).some((id) => sp[id]?.state === 'installed' && (valley === null || isValleySp(id) === valley));
}
/** « Le hérisson », « Les coccinelles » (accords des données). */
const theOf = (id) => ALL_SPECIES_BY_ID?.[id]?.the || 'La bête';
const pluralOf = (id) => !!ALL_SPECIES_BY_ID?.[id]?.pl;

const pendingJars = (ctx) => {
  const v = VS(ctx);
  const list = ctx?.state?.career?.heirlooms || [];
  return v ? Math.max(0, list.length - (v.jars?.opened || 0)) : 0;
};
const unreadChapter = (ctx) => {
  const v = VS(ctx);
  if (!v?.started) return null;
  const read = v.chapters?.read || [];
  for (let n = 0; n <= (v.stage || 0); n++) if (!read.includes(n)) return n;
  return null;
};
const unreadStory = (ctx) => {
  const st = VS(ctx)?.stories;
  return (st?.available || []).find((id) => !(st.read || []).includes(id)) || null;
};
const isFixed = (ctx, id) => !!VS(ctx)?.varieties?.[id]?.fixedAt;
/** Planches d'essai (variété pas encore sauvée) : index des parcelles. */
function trialPlots(ctx) {
  const plots = ctx?.state?.plots || [];
  const out = [];
  plots.forEach((p, i) => {
    if (p?.variety && p.cropId && !isFixed(ctx, p.variety)) out.push(i);
  });
  return out;
}
/** Planches d'essai mûres (la requête de parcelle dit « récolter »). */
function ripeTrials(ctx) {
  return trialPlots(ctx).filter((i) => {
    const p = ctx.state.plots[i];
    if (p.ripeAt !== undefined) return true;
    return safe(ctx, () => ctx.q.plot(i)?.action === 'harvest', false);
  });
}
const firstFreeSpot = (ctx, kind) => safe(ctx, () => (ctx.q.career.valleySpots(kind) || []).find((s) => s.free)?.spotId, null);
const traitsOf = (id) => {
  const x = ALL_VARIETIES_BY_ID?.[id];
  return x ? (Array.isArray(x.traits) ? x.traits : x.trait ? [x.trait] : []) : [];
};
const placeShort = (id) => {
  const p = (PLACES || []).find((x) => x.id === id);
  return p?.short || p?.name || 'Ce lieu';
};

// Cibles réutilisées.
const BOX = { scene: { type: 'valleyBox' }, label: 'la boîte en fer de Joseph, sur le perron' };
const LIBRARY = { scene: { type: 'seedLibrary' }, label: 'la Grainothèque' };
const BROOK = { view: { type: 'place', id: 'brook' }, label: 'le ruisseau, dans la vue de la vallée' };

// ── Règles de déduction pour les anciennes carrières (§ 10.3) ─────────────────────────────────────────────────

/** A déjà « joué » avec la Vallée : une graine récoltée à la main, un bocal ouvert, un aménagement acheté. */
const engaged = (ctx) => {
  const v = VS(ctx);
  if (!v?.started) return false;
  const s = v.stats || {};
  return (s.hand || 0) > 0 || (v.jars?.opened || 0) > 0 || sum(v.bought) > 0 || Object.keys(v.varieties || {}).length > 3;
};

// ── Leçons ────────────────────────────────────────────────────────────────────────────────────────────────────

export const LESSONS = [
  // ── V1 : la boîte, les graines anciennes ──
  {
    id: 'valley.box',
    chapter: CH,
    title: 'La boîte en fer',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Après la fenêtre « La boîte en fer » (chapitre 0 lu par « Merci, Joseph »).
    trigger: { on: ['valleyStarted', 'sheetClose'], when: (ctx) => started(ctx) && (VS(ctx).chapters?.read || []).includes(0) },
    stillRelevant: (ctx) => started(ctx),
    acquired: (ctx) => engaged(ctx),
    steps: [
      {
        id: 'tap',
        say: 'Ma boîte est sur votre perron. Touchez-la !',
        face: 'happy',
        target: () => BOX,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-valley') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-valley'),
      },
    ],
    next: 'valley.sheet',
  },
  {
    id: 'valley.sheet',
    chapter: CH,
    title: 'La fiche « La Vallée »',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['sheetOpen'], when: (ctx) => started(ctx) && sheetOpened(ctx, 'vl-valley') },
    acquired: (ctx) => engaged(ctx),
    where: 'sheet:vl-valley',
    steps: [
      {
        id: 'hint',
        say: 'En haut, le prochain but. Je le tiens à jour pour vous.',
        target: () => ({ ui: '.vl-hint', sheet: 'vl-valley', label: 'le prochain indice' }),
        gesture: 'look',
        sheet: 'vl-valley',
        done: { button: 'Suivant' },
      },
      {
        id: 'tabs',
        say: 'Graines, habitants, aménager : tout est rangé ici.',
        target: () => ({ ui: '.vl-seg', sheet: 'vl-valley', label: 'les onglets de la fiche' }),
        gesture: 'look',
        sheet: 'vl-valley',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.jar',
    chapter: CH,
    title: 'Un bocal de graines',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { when: (ctx) => started(ctx) && pendingJars(ctx) > 0 },
    stillRelevant: (ctx) => pendingJars(ctx) > 0,
    acquired: (ctx) => (VS(ctx)?.jars?.opened || 0) > 0,
    reminders: ['jar'],
    steps: [
      {
        id: 'box',
        say: 'Un bocal de graines ! Touchez ma boîte pour l\'ouvrir.',
        face: 'happy',
        target: () => BOX,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-valley', 'vl-jar') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-valley', 'vl-jar'),
      },
      {
        id: 'list',
        say: 'Touchez « Un bocal à ouvrir ».',
        target: () => ({ ui: '#vl-open-jar', sheet: 'vl-valley', label: 'le bouton des bocaux à ouvrir' }),
        gesture: 'tap',
        sheet: 'vl-valley',
        back: 'box',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-jar') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-jar'),
      },
      {
        id: 'open',
        say: 'Ouvrez-le : la graine se dévoile.',
        target: () => ({ ui: '#vl-jar-open', sheet: 'vl-jar', label: 'le bouton « Ouvrir le bocal »' }),
        gesture: 'tap',
        sheet: 'vl-jar',
        back: 'box',
        done: { on: 'jarOpened' },
      },
    ],
  },
  {
    id: 'valley.trial',
    chapter: CH,
    title: 'La planche d\'essai',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Une planche d'essai mûre (comme l'ancien conseil : l'indice « planche mûre » à l'aube), ou juste semée.
    trigger: { on: ['dawn', 'heirloomSown'], when: (ctx) => started(ctx) && ripeTrials(ctx).length > 0 },
    stillRelevant: (ctx) => ripeTrials(ctx).length > 0,
    acquired: (ctx) => (stats(ctx).hand || 0) > 0,
    reminders: ['trial'],
    steps: [
      {
        id: 'harvest',
        say: 'Elle est mûre ! Récoltez-la à la main : 2 graines pour vous.',
        face: 'happy',
        target: (ctx) => {
          const list = ripeTrials(ctx);
          return list.length > 1 ? { plots: list.slice(0, 6), label: 'les planches d\'essai mûres' } : list.length ? { plot: list[0], label: 'la planche d\'essai mûre' } : null;
        },
        gesture: 'swipe',
        done: { on: 'heirloomHarvest', when: (ctx) => byPlayer(ctx) },
        skipIf: (ctx) => ripeTrials(ctx).length === 0 && (stats(ctx).hand || 0) > 0,
      },
      {
        id: 'bar',
        say: '7 récoltes à la main, et la variété est sauvée.',
        target: (ctx) => {
          const plots = ctx?.state?.plots || [];
          const i = plots.findIndex((p) => p?.lastVariety && !isFixed(ctx, p.lastVariety));
          return i >= 0 ? { plot: i, label: 'la planche d\'essai' } : BOX;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.fixed',
    chapter: CH,
    title: 'Une variété sauvée',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['heirloomFixed'] },
    acquired: (ctx) => Object.values(VS(ctx)?.varieties || {}).some((x) => x?.fixedAt),
    steps: [
      {
        id: 'saved',
        say: 'Sauvée ! Ses graines sont sans fin. L\'équipe peut la semer.',
        face: 'proud',
        target: () => BOX,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.traits',
    chapter: CH,
    title: 'Le don d\'une variété',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    // Fiche d'une variété ouverte, deux variétés obtenues au moins.
    trigger: { on: ['sheetOpen'], when: (ctx) => started(ctx) && sheetOpened(ctx, 'vl-variety') && Object.keys(VS(ctx).varieties || {}).length >= 2 },
    acquired: (ctx) => Object.values(VS(ctx)?.varieties || {}).filter((x) => x?.fixedAt).length >= 2,
    where: 'sheet:vl-variety',
    steps: [
      {
        id: 'trait',
        say: 'Chaque variété a un don. Son dessin et son nom le disent.',
        target: () => ({ ui: '.vl-trait', sheet: 'vl-variety', label: 'le don de la variété' }),
        gesture: 'look',
        sheet: 'vl-variety',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.fallow',
    chapter: CH,
    title: 'La jachère fleurie',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['sheetOpen'], when: (ctx) => started(ctx) && sheetOpened(ctx, 'seeds') },
    acquired: (ctx) => (stats(ctx).fallows || 0) > 0,
    where: 'sheet:seeds',
    steps: [
      {
        id: 'line',
        say: 'Jachère fleurie : gratuite. La culture suivante poussera mieux.',
        target: () => ({ ui: '#seed-fallow', sheet: 'seeds', label: 'la ligne « Jachère fleurie »' }),
        gesture: 'look',
        sheet: 'seeds',
        done: { on: 'fallowSown', button: 'Compris' },
      },
    ],
  },

  // ── V1 : aménager, les habitants ──
  {
    id: 'valley.nature',
    chapter: CH,
    title: 'Aménager pour les bêtes',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Premier aménagement payable (ou à replacer), aucun encore acheté (la haie offerte ne compte pas).
    trigger: {
      on: ['dawn', 'sheetClose'],
      when: (ctx) => {
        if (!started(ctx) || sum(VS(ctx).bought) > 0) return false;
        const money = ctx.state?.money ?? 0;
        const items = safe(ctx, () => QV(ctx)?.nature?.items, []) || [];
        return items.some((it) => !it.locked && it.freeSpots > 0 && (it.reserve > 0 || (it.price || 0) <= money));
      },
    },
    stillRelevant: (ctx) => sum(VS(ctx)?.bought) === 0,
    acquired: (ctx) => sum(VS(ctx)?.bought) > 0 || (stats(ctx).placed || 0) > 1,
    steps: [
      {
        id: 'box',
        say: 'Une haie, un nichoir : les bêtes viendront. Touchez ma boîte.',
        target: () => BOX,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-valley') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-valley'),
        buttons: ['later'],
      },
      {
        id: 'tab',
        say: 'Touchez « Aménager ».',
        target: () => ({ ui: '#vl-tab-nature', sheet: 'vl-valley', label: 'l\'onglet « Aménager »' }),
        gesture: 'tap',
        sheet: 'vl-valley',
        back: 'box',
        done: { on: 'valleySheet', when: (ctx) => ctx?.signal?.data?.tab === 'nature' },
      },
      {
        id: 'pick',
        say: 'Choisissez un aménagement, puis touchez son bouton.',
        target: () => ({ ui: '.vl-sheet--vl-valley [id^="vl-place-"]', sheet: 'vl-valley', label: 'le bouton d\'un aménagement' }),
        gesture: 'tap',
        sheet: 'vl-valley',
        back: 'box',
        done: { on: 'placing', when: (ctx) => !!ctx?.signal?.data?.kind && ctx.signal.data.kind !== 'pair' },
      },
    ],
    next: 'valley.naturePlace',
  },
  {
    id: 'valley.naturePlace',
    chapter: CH,
    title: 'Poser un aménagement',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Mode aménagement (visée) : la barre du bas remplace les onglets, les places libres brillent.
    trigger: { on: ['placing'], when: (ctx) => started(ctx) && placingKind(ctx) !== null && sum(VS(ctx).bought) === 0 },
    stillRelevant: (ctx) => sum(VS(ctx)?.bought) === 0,
    acquired: (ctx) => sum(VS(ctx)?.bought) > 0 || (stats(ctx).placed || 0) > 1,
    where: 'placing',
    steps: [
      {
        id: 'spot',
        say: 'Touchez une place qui brille. « Terminer » quand c\'est fini.',
        face: 'happy',
        target: (ctx) => {
          const spotId = firstFreeSpot(ctx, placingKind(ctx) || 'hedge');
          return spotId ? { scene: { type: 'natureSpot', spotId }, label: 'un emplacement libre qui brille' } : null;
        },
        gesture: 'tap',
        done: { on: 'naturePlaced' },
      },
    ],
  },
  {
    id: 'valley.recipe',
    chapter: CH,
    title: 'Les recettes d\'habitat',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    // Onglet « Habitants » ouvert, une recette à une chose près.
    trigger: { on: ['valleySheet'], when: (ctx) => started(ctx) && ctx?.signal?.data?.tab === 'wildlife' && !!nearRecipe(ctx) },
    acquired: (ctx) => anyInstalled(ctx, false) && Object.keys(VS(ctx)?.species || {}).length >= 3,
    where: 'sheet:vl-valley',
    steps: [
      {
        id: 'recipe',
        say: (ctx) => {
          const s = nearRecipe(ctx);
          return s ? `Il manque une seule chose pour ${lowerFirst(theOf(s.id))}. Voyez sa recette.` : 'Chaque bête a sa recette : ce qu\'il lui faut pour venir.';
        },
        target: (ctx) => {
          const s = nearRecipe(ctx);
          return s ? { ui: `#vl-sp-${s.id}`, sheet: 'vl-valley', label: `la recette : ${theOf(s.id)}` } : { ui: '.vl-seg', sheet: 'vl-valley', label: 'les onglets' };
        },
        gesture: 'look',
        sheet: 'vl-valley',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.speciesHint',
    chapter: CH,
    title: 'Une trace ce matin',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['speciesHint'], when: (ctx) => !!ctx?.ev?.id && !isValleySp(ctx.ev.id) },
    stillRelevant: (ctx) => !!hintSpot(ctx),
    acquired: (ctx) => anyInstalled(ctx, false),
    steps: [
      {
        id: 'trace',
        say: 'Une trace ce matin… Une bête va bientôt venir.',
        target: (ctx) => {
          const spotId = hintSpot(ctx);
          return spotId ? { scene: { type: 'natureSpot', spotId }, label: 'la trace d\'une bête' } : BOX;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.species',
    chapter: CH,
    title: 'Une bête est venue',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['speciesVisible', 'dawn'], when: (ctx) => farmVisible(ctx).length > 0 },
    stillRelevant: (ctx) => farmVisible(ctx).length > 0,
    acquired: (ctx) => anyInstalled(ctx, false) || (stats(ctx).observed || 0) > 0,
    reminders: ['species'],
    steps: [
      {
        id: 'touch',
        say: (ctx) => {
          const id = farmVisible(ctx)[0];
          return id && pluralOf(id) ? 'Elles sont là ! Touchez-les pour qu\'elles s\'installent.' : 'Elle est là ! Touchez-la pour qu\'elle s\'installe.';
        },
        face: 'happy',
        target: (ctx) => {
          const id = farmVisible(ctx)[0];
          return id ? { scene: { type: 'wildlife', id }, label: theOf(id).toLowerCase() } : null;
        },
        gesture: 'tap',
        done: { on: 'speciesInstalled' },
      },
    ],
  },
  {
    id: 'valley.hedge',
    chapter: CH,
    title: 'La cueillette des haies',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['hedgeFinds'] },
    stillRelevant: (ctx) => (VS(ctx)?.finds || []).length > 0,
    acquired: (ctx) => sum(stats(ctx).finds) > 0,
    steps: [
      {
        id: 'pick',
        say: 'Des fruits sur la haie ! Touchez-les pour les cueillir.',
        face: 'happy',
        target: (ctx) => {
          const f = (VS(ctx)?.finds || [])[0];
          return f ? { scene: { type: 'hedgeFind', id: f.id }, label: 'la cueillette sur la haie' } : null;
        },
        gesture: 'tap',
        done: { on: 'hedgePicked' },
      },
    ],
  },
  {
    id: 'valley.stage',
    chapter: CH,
    title: 'La vallée revit',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Étapes 1 → 8 : la même leçon (une fois).
    trigger: { on: ['valleyStage'], when: (ctx) => unreadChapter(ctx) !== null },
    stillRelevant: (ctx) => unreadChapter(ctx) !== null,
    acquired: (ctx) => (VS(ctx)?.chapters?.read || []).some((n) => n >= 1),
    reminders: ['chapter'],
    steps: [
      {
        id: 'box',
        say: 'La vallée revit ! J\'ai quelque chose à vous dire. Touchez ma boîte.',
        face: 'proud',
        target: () => BOX,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-valley', 'vl-chapter') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-valley', 'vl-chapter'),
        buttons: ['later'],
      },
      {
        id: 'chapter',
        say: 'Touchez le chapitre pour l\'écouter.',
        target: (ctx) => {
          const n = unreadChapter(ctx);
          return n !== null ? { ui: `#vl-chap-${n}`, sheet: 'vl-valley', label: 'le chapitre à écouter' } : null;
        },
        gesture: 'tap',
        sheet: 'vl-valley',
        back: 'box',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-chapter') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-chapter') || unreadChapter(ctx) === null,
      },
    ],
  },
  {
    id: 'valley.reserve',
    chapter: CH,
    title: 'Les aménagements à replacer',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['natureReserved'] },
    stillRelevant: (ctx) => sum(VS(ctx)?.reserve) > 0,
    acquired: () => false,
    steps: [
      {
        id: 'reserve',
        say: 'Vos aménagements attendent. Replacez-les : c\'est gratuit.',
        target: () => BOX,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.fair',
    chapter: CH,
    title: 'L\'étal de la foire',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: {
      on: ['dawn'],
      when: (ctx) => {
        const f = VS(ctx)?.fair;
        return started(ctx) && !!f && !f.bought && !!f.varietyId && f.year === ctx.state?.time?.year;
      },
    },
    stillRelevant: (ctx) => !!VS(ctx)?.fair && !VS(ctx).fair.bought,
    acquired: (ctx) => Object.values(VS(ctx)?.varieties || {}).some((x) => x?.from === 'fair'),
    steps: [
      {
        id: 'stall',
        say: 'Foire aux graines : un sachet ancien, une fois par an. Voyez ma fiche.',
        target: () => BOX,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },

  // ── V2 : la Grainothèque, le troc, les croisements ──
  {
    id: 'valley.librarySign',
    chapter: CH,
    title: 'Une idée de Joseph',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['storyAvailable', 'dawn'], when: (ctx) => heritageOn(ctx) && !!VS(ctx).site && !VS(ctx).library },
    stillRelevant: (ctx) => heritageOn(ctx) && !VS(ctx).library,
    acquired: (ctx) => !!VS(ctx)?.library || (VS(ctx)?.stories?.read || []).includes('heritage0'),
    steps: [
      {
        id: 'sign',
        say: 'Une idée : une grainothèque, ici. Touchez le panneau.',
        target: () => ({ ...LIBRARY, label: 'le panneau « Ici, une grainothèque ? »' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-story', 'vl-library') },
        buttons: ['later'],
      },
    ],
  },
  {
    id: 'valley.library',
    chapter: CH,
    title: 'La Grainothèque',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['seedLibraryBuilt'], when: (ctx) => (ctx?.ev?.level || VS(ctx)?.library?.level || 0) === 1 },
    stillRelevant: (ctx) => !!VS(ctx)?.library,
    acquired: (ctx) => (VS(ctx)?.library?.level || 0) >= 2 || (stats(ctx).swaps || 0) > 0,
    steps: [
      {
        id: 'house',
        say: 'Vos graines ont une maison. Touchez-la !',
        face: 'proud',
        target: () => LIBRARY,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-library') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-library'),
      },
      {
        id: 'tabs',
        say: 'L\'étagère, les croisements, le troc : trois onglets.',
        target: () => ({ ui: '.vl-sheet--vl-library .vl-seg, #vl-lib-tab-shelf', sheet: 'vl-library', label: 'les onglets de la Grainothèque' }),
        gesture: 'look',
        sheet: 'vl-library',
        back: 'house',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.libraryLevel',
    chapter: CH,
    title: 'Agrandir la Grainothèque',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    // Le niveau suivant est payable pour la première fois.
    trigger: {
      on: ['dawn'],
      when: (ctx) => {
        const lv = VS(ctx)?.library?.level || 0;
        if (!heritageOn(ctx) || lv < 1 || lv >= 5) return false;
        return !!safe(ctx, () => QV(ctx)?.library?.next?.canBuild, false);
      },
    },
    stillRelevant: (ctx) => (VS(ctx)?.library?.level || 0) < 5,
    acquired: (ctx) => (VS(ctx)?.library?.level || 0) >= 2,
    steps: [
      {
        id: 'grow',
        say: 'Votre grainothèque peut grandir : plus de voisins, plus de graines.',
        target: () => LIBRARY,
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.trocPin',
    chapter: CH,
    title: 'Un sachet au tableau',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Sur la ferme : montrer le sachet épinglé ; la suite (valley.troc) se joue dans la feuille du tableau.
    trigger: { on: ['trocOffered', 'dawn'], when: (ctx) => heritageOn(ctx) && !!VS(ctx).troc },
    stillRelevant: (ctx) => !!VS(ctx)?.troc,
    acquired: (ctx) => (stats(ctx).swaps || 0) > 0 || Object.keys(VS(ctx)?.swaps || {}).length > 0,
    reminders: ['troc'],
    steps: [
      {
        id: 'pin',
        say: 'Un voisin propose un troc. Touchez son sachet au tableau.',
        face: 'happy',
        target: () => ({ scene: { type: 'villageBoard' }, label: 'le sachet épinglé au tableau du village' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'v-board', 'vl-troc') },
        buttons: ['later'],
      },
    ],
    next: 'valley.troc',
  },
  {
    id: 'valley.troc',
    chapter: CH,
    title: 'Un troc de graines',
    modes: CAREER,
    tier: 'E',
    // Avant le conseil du tableau (une seule bulle par ouverture de feuille : le troc d'abord, comme avant).
    priority: 75,
    // Feuille du tableau ouverte avec un sachet épinglé (l'ancien conseil de variety.js est retiré).
    trigger: { on: ['sheetOpen'], when: (ctx) => heritageOn(ctx) && !!VS(ctx).troc && sheetOpened(ctx, 'v-board') },
    stillRelevant: (ctx) => !!VS(ctx)?.troc,
    acquired: (ctx) => (stats(ctx).swaps || 0) > 0 || Object.keys(VS(ctx)?.swaps || {}).length > 0,
    // (Pas de `where` de feuille : chaque étape dit la sienne — v-board, puis vl-troc.)
    reminders: ['troc'],
    steps: [
      {
        id: 'card',
        say: 'Un troc ! Touchez « Choisir une graine ».',
        face: 'happy',
        target: () => ({ ui: '#vl-board-troc-go', sheet: 'v-board', label: 'le bouton « Choisir une graine »' }),
        gesture: 'tap',
        sheet: 'v-board',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-troc') },
      },
      {
        id: 'give',
        say: 'Donnez une graine sauvée. Ça ne vous coûte rien.',
        target: () => ({ ui: '[id^="vl-gift-"], #vl-swap', sheet: 'vl-troc', label: 'une graine à donner' }),
        gesture: 'tap',
        sheet: 'vl-troc',
        done: { on: 'seedSwapped', button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.pair',
    chapter: CH,
    title: 'Semer la paire',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Première paire possible : deux variétés d'une même culture à croisement.
    trigger: { on: ['dawn', 'seedSwapped', 'heirloomFixed', 'jarOpened'], when: (ctx) => heritageOn(ctx) && !!pairCrop(ctx) },
    stillRelevant: (ctx) => !!pairCrop(ctx),
    acquired: (ctx) => (stats(ctx).pairs || 0) > 0 || (stats(ctx).meets || 0) > 0 || Object.keys(VS(ctx)?.crosses || {}).length > 0,
    steps: [
      {
        id: 'library',
        say: 'Deux graines d\'une même culture : semez-les côte à côte !',
        face: 'happy',
        target: () => LIBRARY,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-library') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-library'),
        buttons: ['later'],
      },
      {
        id: 'tab',
        say: 'Touchez « Croisements ».',
        target: () => ({ ui: '#vl-lib-tab-cross', sheet: 'vl-library', label: 'l\'onglet « Croisements »' }),
        gesture: 'tap',
        sheet: 'vl-library',
        back: 'library',
        done: { on: 'valleySheet', when: (ctx) => ctx?.signal?.data?.tab === 'cross' },
      },
      {
        id: 'button',
        say: 'Touchez « Semer la paire ».',
        target: (ctx) => {
          const c = pairCrop(ctx);
          return c ? { ui: `#vl-pair-${c}`, sheet: 'vl-library', label: 'le bouton « Semer la paire »' } : null;
        },
        gesture: 'tap',
        sheet: 'vl-library',
        back: 'library',
        done: { on: 'placing', when: (ctx) => ctx?.signal?.data?.kind === 'pair' },
      },
    ],
    next: 'valley.pairPlace',
  },
  {
    id: 'valley.pairPlace',
    chapter: CH,
    title: 'La paire, côte à côte',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Mode paire (visée) : seules les parcelles libres qui ont une voisine libre brillent.
    trigger: { on: ['placing'], when: (ctx) => heritageOn(ctx) && pairSowing(ctx) && (stats(ctx).pairs || 0) === 0 },
    acquired: (ctx) => (stats(ctx).pairs || 0) > 0 || (stats(ctx).meets || 0) > 0,
    where: 'placing',
    steps: [
      {
        id: 'plot',
        say: 'Touchez une parcelle qui brille : les deux graines y vont.',
        target: (ctx) => {
          const c = pairCropSowing(ctx);
          const p = c ? safe(ctx, () => (ctx.q.career.valleyPairPlots(c) || [])[0], null) : null;
          return p ? { scene: { type: 'pairPlot', plotIndex: p.plotIndex }, label: 'une parcelle libre qui brille' } : null;
        },
        gesture: 'tap',
        done: { on: 'pairSown' },
      },
    ],
  },
  {
    id: 'valley.meet',
    chapter: CH,
    title: 'Les rencontres d\'abeilles',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['pairSown'] },
    acquired: (ctx) => (stats(ctx).meets || 0) > 0,
    steps: [
      {
        id: 'meet',
        say: 'Récoltez l\'une à la main, l\'autre à côté : une rencontre !',
        target: (ctx) => {
          const l = safe(ctx, () => (ctx.q.career.valleyCrossLinks() || [])[0], null);
          return l && Number.isInteger(l.a) && Number.isInteger(l.b) ? { plots: [l.a, l.b], label: 'les deux planches de la paire' } : null;
        },
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'three',
        say: '3 rencontres : une graine nouvelle, au nom de votre ferme.',
        target: (ctx) => {
          const l = safe(ctx, () => (ctx.q.career.valleyCrossLinks() || [])[0], null);
          return l && Number.isInteger(l.a) && Number.isInteger(l.b) ? { plots: [l.a, l.b], label: 'les deux planches de la paire' } : LIBRARY;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.cross',
    chapter: CH,
    title: 'Un croisement',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['sheetOpen'], when: (ctx) => heritageOn(ctx) && sheetOpened(ctx, 'vl-cross') },
    acquired: (ctx) => Object.values(VS(ctx)?.crosses || {}).filter((c) => c?.foundAt != null).length >= 2,
    where: 'sheet:vl-cross',
    steps: [
      {
        id: 'found',
        say: 'Une graine née chez vous, à votre nom ! Sauvez-la.',
        face: 'proud',
        target: () => ({ ui: '.vl-sheet--vl-cross .vl-go, #vl-cross-sow, #vl-cross-later', sheet: 'vl-cross', label: 'la graine nouvelle' }),
        gesture: 'look',
        sheet: 'vl-cross',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.scented',
    chapter: CH,
    title: 'Une variété parfumée',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['heirloomSown'], when: (ctx) => byPlayer(ctx) && traitsOf(ctx?.ev?.varietyId).includes('scented') },
    acquired: (ctx) => Object.entries(VS(ctx)?.varieties || {}).some(([id, x]) => x?.fixedAt && traitsOf(id).includes('scented')),
    steps: [
      {
        id: 'scent',
        say: 'Parfumée : à l\'atelier, elle vaut 15 % de plus.',
        target: (ctx) => {
          const plots = ctx?.state?.plots || [];
          const i = plots.findIndex((p) => p?.variety && traitsOf(p.variety).includes('scented'));
          return i >= 0 ? { plot: i, label: 'la planche parfumée' } : null;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.revisitBox',
    chapter: CH,
    title: 'Revoir la boîte',
    modes: CAREER,
    tier: 'U',
    priority: 20,
    trigger: { on: ['valleySheet', 'sheetOpen'], when: (ctx) => heritageOn(ctx) && (VS(ctx).chapters?.read || []).includes(0) && (sheetOpened(ctx, 'vl-valley') || ctx?.signal?.data?.tab === 'seeds') && !!VS(ctx).library },
    acquired: () => false,
    where: 'sheet:vl-valley',
    steps: [
      {
        id: 'again',
        say: 'Ma boîte se relit ici, quand vous voulez.',
        target: () => ({ ui: '#vl-box-again', sheet: 'vl-valley', label: 'le bouton « Revoir la boîte en fer »' }),
        gesture: 'look',
        sheet: 'vl-valley',
        done: { button: 'Compris' },
      },
    ],
  },

  // ── V3 : la vue de la vallée, les lieux, la pêche, les champignons, les terres sauvages ──
  {
    id: 'valley.viewOpen',
    chapter: CH,
    title: 'Le poteau de la colline',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Après la première visite (le récit « Sur la colline » ouvre la vue une fois) : où revenir.
    trigger: { on: ['viewClose', 'dawn'], when: (ctx) => viewOpen(ctx) && !ctx?.ui?.view },
    stillRelevant: (ctx) => viewOpen(ctx),
    acquired: (ctx) => (VS(ctx)?.view?.visits || 0) >= 2,
    steps: [
      {
        id: 'post',
        say: 'Pour revenir sur la colline, touchez ce poteau.',
        face: 'happy',
        target: () => ({ scene: { type: 'valleyView' }, label: 'le poteau « Vers la vallée »' }),
        gesture: 'tap',
        done: { on: 'viewOpen', button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.view',
    chapter: CH,
    title: 'La vue de la vallée',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['viewOpen', 'valleyViewOpened'], when: (ctx) => viewOpen(ctx) },
    acquired: (ctx) => Object.values(VS(ctx)?.places || {}).some((p) => (p?.step || 0) > 0 || p?.works),
    where: 'view',
    steps: [
      {
        id: 'place',
        say: 'Touchez un lieu pour voir ce qui lui manque.',
        target: () => BROOK,
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-place', 'vl-places-list') },
      },
    ],
    next: 'valley.place',
  },
  {
    id: 'valley.place',
    chapter: CH,
    title: 'La fiche d\'un lieu',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['sheetOpen'], when: (ctx) => placesOn(ctx) && sheetOpened(ctx, 'vl-place') },
    acquired: (ctx) => (stats(ctx).works || 0) > 0,
    where: 'view',
    steps: [
      {
        id: 'needs',
        say: '✓ : c\'est prêt. ✗ : il manque encore ça.',
        target: () => ({ ui: '#vl3-need-0', sheet: 'vl-place', label: 'ce qu\'il faut au lieu' }),
        gesture: 'look',
        sheet: 'vl-place',
        done: { button: 'Suivant' },
      },
      {
        id: 'start',
        say: 'Tout est ✓ ? Lancez le chantier ici.',
        target: () => ({ ui: '#vl3-start', sheet: 'vl-place', label: 'le bouton du chantier' }),
        gesture: 'look',
        sheet: 'vl-place',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.works',
    chapter: CH,
    title: 'Le chantier',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['worksStarted'] },
    acquired: (ctx) => (stats(ctx).recovered || 0) > 0,
    where: 'view',
    reminders: ['works'],
    steps: [
      {
        id: 'grow',
        say: 'Le lieu reprend tout seul, saison après saison.',
        target: (ctx) => {
          const pl = VS(ctx)?.places || {};
          const id = Object.keys(pl).find((k) => pl[k]?.works) || 'brook';
          return { view: { type: 'place', id }, label: `le chantier : ${placeShort(id)}` };
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.valleyAnimal',
    chapter: CH,
    title: 'Une bête de la vallée',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['speciesVisible', 'viewOpen'], when: (ctx) => valleyVisible(ctx).length > 0 },
    stillRelevant: (ctx) => valleyVisible(ctx).length > 0,
    acquired: (ctx) => anyInstalled(ctx, true),
    where: 'view',
    reminders: ['species'],
    steps: [
      {
        id: 'touch',
        say: 'Une bête de la vallée vous attend ! Touchez-la.',
        face: 'happy',
        target: (ctx) => {
          const id = valleyVisible(ctx)[0];
          return id ? { view: { type: 'viewAnimal', id }, label: theOf(id).toLowerCase() } : null;
        },
        gesture: 'tap',
        done: { on: 'speciesInstalled' },
      },
    ],
  },
  {
    id: 'valley.helene',
    chapter: CH,
    title: 'Le carnet d\'Hélène',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['speciesInstalled'], when: (ctx) => isValleySp(ctx?.ev?.id) },
    acquired: (ctx) => (VS(ctx)?.stories?.read || []).includes('helene'),
    steps: [
      {
        id: 'book',
        say: 'Hélène note chaque bête de la vallée. Son carnet est dans l\'album.',
        target: () => ({ ui: '#tab-menu', label: 'l\'onglet Menu (l\'album)' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.river',
    chapter: CH,
    title: 'La pêche au ruisseau',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['viewOpen', 'placeRecovered'], when: (ctx) => viewOpen(ctx) && !!safe(ctx, () => QV(ctx)?.river?.canFish, false) },
    acquired: (ctx) => (stats(ctx).river || 0) > 0,
    where: 'view',
    steps: [
      {
        id: 'fish',
        say: 'Une pêche par jour au ruisseau, en plus de la mare.',
        target: () => ({ view: { type: 'river' }, label: 'le ponton du ruisseau' }),
        gesture: 'tap',
        done: { on: 'riverFished', button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.mushrooms',
    chapter: CH,
    title: 'Les champignons du bois',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['viewOpen', 'mushroomsGrew'], when: (ctx) => viewOpen(ctx) && (VS(ctx).mushrooms || []).length > 0 },
    stillRelevant: (ctx) => (VS(ctx)?.mushrooms || []).length > 0,
    acquired: (ctx) => (stats(ctx).mushrooms || 0) > 0,
    where: 'view',
    steps: [
      {
        id: 'pick',
        say: 'Des champignons dans le bois : touchez-les.',
        face: 'happy',
        target: (ctx) => {
          const m = (VS(ctx)?.mushrooms || [])[0];
          return m ? { view: { type: 'mushroom', id: m.id }, label: 'un champignon dans le bois' } : null;
        },
        gesture: 'tap',
        done: { on: 'mushroomPicked' },
      },
    ],
  },
  {
    id: 'valley.grafts',
    chapter: CH,
    title: 'Les greffons du verger',
    modes: CAREER,
    tier: 'U',
    priority: 40,
    trigger: { on: ['placeRecovered'], when: (ctx) => !!ctx?.ev?.grafts || ctx?.ev?.placeId === 'oldOrchard' },
    acquired: (ctx) => Object.values(VS(ctx)?.varieties || {}).some((x) => x?.from === 'orchard' && (x.hand || 0) > 0),
    steps: [
      {
        id: 'plant',
        say: 'Des greffons ! Plantez-les dans un verger, sur une place libre.',
        target: (ctx) => {
          const i = orchardFree(ctx);
          return i !== null ? { plot: i, label: 'une place libre du verger' } : BOX;
        },
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.wild',
    chapter: CH,
    title: 'Les terres sauvages',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // 16 terrains et vue ouverte : une forêt qui touche la ferme peut revenir à la nature.
    trigger: {
      on: ['dawn', 'viewClose', 'lotBought'],
      when: (ctx) => viewOpen(ctx) && Object.keys(VS(ctx).wilds || {}).length === 0 && wildEligible(ctx).length > 0,
    },
    stillRelevant: (ctx) => Object.keys(VS(ctx)?.wilds || {}).length === 0,
    acquired: (ctx) => Object.keys(VS(ctx)?.wilds || {}).length > 0,
    steps: [
      {
        id: 'forest',
        say: 'Les forêts autour peuvent revenir à la nature. Touchez ce poteau.',
        target: (ctx) => {
          const cellId = wildEligible(ctx)[0];
          return cellId ? { scene: { type: 'wildCell', cellId }, label: 'une forêt à confier à la nature' } : null;
        },
        gesture: 'tap',
        done: { on: 'wildPlacing', when: (ctx) => !!ctx?.signal?.data?.on },
        buttons: ['later'],
      },
    ],
    next: 'valley.wildMode',
  },
  {
    id: 'valley.wildMode',
    chapter: CH,
    title: 'Confier une forêt',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    // Mode terres sauvages (visée) : les forêts qui touchent la ferme brillent ; la feuille « Confier à la nature ».
    trigger: { on: ['wildPlacing'], when: (ctx) => viewOpen(ctx) && !!ctx?.signal?.data?.on && Object.keys(VS(ctx).wilds || {}).length === 0 },
    stillRelevant: (ctx) => Object.keys(VS(ctx)?.wilds || {}).length === 0,
    acquired: (ctx) => Object.keys(VS(ctx)?.wilds || {}).length > 0,
    where: 'placing',
    steps: [
      {
        id: 'cell',
        say: 'Touchez une forêt qui brille.',
        target: (ctx) => {
          const cellId = wildEligible(ctx)[0];
          return cellId ? { scene: { type: 'wildCell', cellId }, label: 'une forêt qui brille' } : null;
        },
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-wild-choice') },
        skipIf: (ctx) => sheetIs(ctx, 'vl-wild-choice'),
      },
      {
        id: 'kind',
        say: 'Bois, marais ou prairie : choisissez. C\'est pour toujours.',
        target: () => ({ ui: '.vl-sheet--vl-wild-choice [id^="vl3-kind-"]', sheet: 'vl-wild-choice', label: 'les trois sortes de terre sauvage' }),
        gesture: 'look',
        sheet: 'vl-wild-choice',
        back: 'cell',
        done: { on: 'wildLandGiven', button: 'Compris' },
      },
    ],
  },

  // ── V4 « Les cigognes » (contrat du V4 ; codé en parallèle : cibles prudentes, scène et vue plutôt que boutons) ──
  {
    id: 'valley.legend',
    chapter: CH,
    title: 'Les légendes',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['legendAwoken'], when: (ctx) => storksOn(ctx) },
    acquired: (ctx) => Object.values(VS(ctx)?.legends || {}).some((l) => (l?.harvests || 0) > 0),
    reminders: ['legend'],
    steps: [
      {
        id: 'keep',
        say: 'Une légende s\'est réveillée ! Elle ne se vend pas : elle se garde.',
        face: 'proud',
        target: () => ({ ...LIBRARY, label: 'les cloches de la Grainothèque' }),
        gesture: 'look',
        done: { button: 'Suivant' },
      },
      {
        id: 'sow',
        say: 'Semez-la sous une cloche de la Grainothèque. Touchez-la !',
        target: () => ({ ...LIBRARY, label: 'les cloches de la Grainothèque' }),
        gesture: 'tap',
        done: { on: 'sheetOpen', when: (ctx) => sheetOpened(ctx, 'vl-library'), button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.visitor',
    chapter: CH,
    title: 'Les visiteurs rares',
    modes: CAREER,
    tier: 'E',
    priority: 70,
    trigger: { on: ['visitorVisible', 'viewOpen'], when: (ctx) => storksOn(ctx) && viewVisitors(ctx).length > 0 },
    stillRelevant: (ctx) => viewVisitors(ctx).length > 0,
    acquired: (ctx) => Object.values(VS(ctx)?.visitors || {}).some((x) => x?.state === 'seen'),
    where: 'view',
    reminders: ['visitor'],
    steps: [
      {
        id: 'see',
        say: 'Un visiteur rare fait halte. Allez le voir : il vous attend.',
        face: 'happy',
        target: (ctx) => {
          const id = viewVisitors(ctx)[0];
          return id ? { view: { type: 'visitor', id }, label: 'le visiteur rare' } : null;
        },
        gesture: 'tap',
        done: { on: 'visitorSeen', button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.book',
    chapter: CH,
    title: 'Le livre de la vallée',
    modes: CAREER,
    tier: 'U',
    priority: 20,
    trigger: { on: ['sheetOpen'], when: (ctx) => storksOn(ctx) && sheetOpened(ctx, 'vl-valley') && (stats(ctx).bookOpened || 0) === 0 },
    acquired: (ctx) => (stats(ctx).bookOpened || 0) > 0,
    where: 'sheet:vl-valley',
    steps: [
      {
        id: 'book',
        say: 'Tout ce que vous avez fait revivre est écrit dans le livre.',
        target: () => ({ ui: '#vl-book, #vl-book-open, .vl-book-btn, .vl-sheet--vl-valley .vl-stage', sheet: 'vl-valley', label: 'le bouton « Le livre »' }),
        gesture: 'look',
        sheet: 'vl-valley',
        done: { button: 'Compris' },
      },
    ],
  },
  {
    id: 'valley.sounds',
    chapter: CH,
    title: 'Les sons de la vallée',
    modes: CAREER,
    tier: 'U',
    priority: 20,
    trigger: { on: ['speciesInstalled', 'visitorSeen'], when: (ctx) => storksOn(ctx) && ctx?.settings?.natureSound !== 'off' },
    acquired: () => false,
    steps: [
      {
        id: 'listen',
        say: 'Écoutez : chaque habitant a son chant. Le réglage est dans Menu.',
        target: () => ({ ui: '#tab-menu', label: 'l\'onglet Menu (réglage du son)' }),
        gesture: 'look',
        done: { button: 'Compris' },
      },
    ],
  },
];

// ── Petites lectures des leçons ───────────────────────────────────────────────────────────────────────────────

function lowerFirst(t) {
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
/** Habitant de la ferme dont la recette est à une chose près (dans sa saison, pas encore venu). */
function nearRecipe(ctx) {
  const list = safe(ctx, () => QV(ctx)?.species, []) || [];
  return list.find((s) => s.state === 'unknown' && s.group !== 'valley' && s.inSeason !== false && (s.recipe || []).length > 1 && (s.recipe || []).filter((r) => !r.ok).length === 1) || null;
}
/** Emplacement de la trace (habitant annoncé sur la ferme). */
function hintSpot(ctx) {
  const sp = VS(ctx)?.species || {};
  const id = Object.keys(sp).find((k) => sp[k]?.state === 'hint' && !isValleySp(k));
  return id ? sp[id].spotId || null : null;
}
/** Culture dont une paire peut être semée (V2). */
function pairCrop(ctx) {
  if (!heritageOn(ctx)) return null;
  const list = safe(ctx, () => QV(ctx)?.crosses, []) || [];
  return list.find((c) => c.canPair && !c.found)?.cropId || null;
}
/**
 * Mode de visée courant : ctx.ui.placing (MOTEUR, d'après les signaux `placing` / `wildPlacing`) ; le signal courant
 * `placing { kind, cropId? }` le précise (kind 'pair' : mode paire ; sinon le genre d'aménagement).
 */
function placingRaw(ctx) {
  if (isSignal(ctx, 'placing')) return ctx.signal.data?.kind || null;
  const k = ctx?.ui?.placingKind ?? ctx?.ui?.placing;
  return typeof k === 'string' ? k : null;
}
function placingKind(ctx) {
  const k = placingRaw(ctx);
  if (k && k !== 'pair' && k !== 'wild') return k;
  // ctx.ui.placing n'est qu'un booléen (MOTEUR) : en mode aménagement, le genre le moins cher qui a une place libre.
  if (isSignal(ctx, 'placing') || !ctx?.ui?.placing) return null;
  const items = safe(ctx, () => QV(ctx)?.nature?.items, []) || [];
  const money = ctx.state?.money ?? 0;
  const ok = items.filter((it) => !it.locked && it.freeSpots > 0 && (it.reserve > 0 || (it.price || 0) <= money)).sort((a, b) => (a.reserve > 0 ? 0 : a.price || 0) - (b.reserve > 0 ? 0 : b.price || 0));
  return ok[0]?.kind || null;
}
const pairSowing = (ctx) => placingRaw(ctx) === 'pair';
/** Culture de la paire en cours (mode paire), sinon la première paire possible. */
const pairCropSowing = (ctx) => (isSignal(ctx, 'placing') && ctx.signal.data?.cropId) || pairCrop(ctx);
/** Forêts qui peuvent être confiées à la nature. */
function wildEligible(ctx) {
  if (!viewOpen(ctx)) return [];
  const w = safe(ctx, () => QV(ctx)?.wilds, null);
  return w?.open ? w.eligible || [] : [];
}
/** Parcelle libre d'un verger (greffons). */
function orchardFree(ctx) {
  const plots = ctx?.state?.plots || [];
  for (let i = 0; i < plots.length; i++) {
    const p = plots[i];
    if (!p || p.cropId || !p.unlocked || p.env !== 'orchard') continue;
    return i;
  }
  return null;
}
/** Visiteurs rares qui attendent dans la vue (V4 ; les vers luisants attendent sur la ferme). */
function viewVisitors(ctx) {
  const vis = VS(ctx)?.visitors || {};
  return Object.keys(vis).filter((id) => vis[id]?.state === 'visible' && id !== 'glowworms');
}

// ── Rappels de la Vallée (§ 8.4 : présent, positif, jamais de perte, jamais de compte à rebours) ─────────────────

/** Jour absolu d'une trouvaille { year, day } (day = jour de l'année). */
function absOf(ctx, row) {
  const L = ctx?.state?.career?.seasonLength;
  return row && L && Number.isFinite(row.year) && Number.isFinite(row.day) ? (row.year - 1) * 4 * L + row.day : null;
}
const whereOf = (ctx, id) => safe(ctx, () => (QV(ctx)?.species || []).find((s) => s.id === id)?.where, '') || '';

export const REMINDERS = [
  {
    id: 'jar',
    modes: CAREER,
    chapter: CH,
    title: 'Un bocal à ouvrir',
    example: 'Un bocal de graines attend d\'être ouvert.',
    when: (ctx) => {
      const n = pendingJars(ctx);
      if (!n) return null;
      const row = (ctx.state.career.heirlooms || [])[VS(ctx).jars?.opened || 0];
      return { since: sinceOf(ctx, absOf(ctx, row)), text: n > 1 ? `${n} bocaux de graines attendent d'être ouverts.` : 'Un bocal de graines attend d\'être ouvert.', target: BOX };
    },
    wait: 2,
    todo: 'vl-jar',
    go: (app) => app?.valley?.openJar?.(),
  },
  {
    id: 'species',
    modes: CAREER,
    chapter: CH,
    title: 'Une bête qui attend',
    example: 'Le hérisson vous attend près de la haie.',
    when: (ctx) => {
      const sp = VS(ctx)?.species || {};
      const id = [...farmVisible(ctx), ...valleyVisible(ctx)][0];
      if (!id) return null;
      const where = whereOf(ctx, id);
      const verb = pluralOf(id) ? 'vous attendent' : 'vous attend';
      return {
        since: sinceOf(ctx, sp[id].since),
        text: `${theOf(id)} ${verb}${where ? ` ${where}` : ''}, rien ne presse.`,
        target: isValleySp(id) ? null : { scene: { type: 'wildlife', id }, label: theOf(id).toLowerCase() },
      };
    },
    wait: 2,
    // (Une fonction `todo` serait une entrée fournie : ici deux entrées existantes possibles, l'action les cherche.)
    todo: null,
    go: (app) => goTodo(app, ['vl-observe', 'vl-view-animal']),
  },
  {
    id: 'troc',
    modes: CAREER,
    chapter: CH,
    title: 'Un troc épinglé',
    example: 'Mme Rose attend votre troc, rien ne presse.',
    when: (ctx) => {
      const t = VS(ctx)?.troc;
      if (!t) return null;
      const name = safe(ctx, () => QV(ctx)?.troc?.clientName, null);
      return { since: sinceOf(ctx, t.since), text: name ? `${name} attend votre troc, rien ne presse.` : 'Un voisin attend votre troc, rien ne presse.', target: { scene: { type: 'villageBoard' }, label: 'le sachet du tableau' } };
    },
    wait: 3,
    todo: 'vl-troc',
    go: (app) => app?.heritage?.openTroc?.(),
  },
  {
    id: 'chapter',
    modes: CAREER,
    chapter: CH,
    title: 'Un récit de Joseph',
    example: 'J\'ai quelque chose à vous raconter, quand vous voulez.',
    when: (ctx) => {
      const n = unreadChapter(ctx);
      const st = n === null ? unreadStory(ctx) : null;
      if (n === null && !st) return null;
      const at = n !== null ? VS(ctx).stageAt?.[n]?.abs : null;
      return { since: Number.isFinite(at) ? sinceOf(ctx, at) : null, text: 'J\'ai quelque chose à vous raconter, quand vous voulez.' };
    },
    wait: 2,
    todo: null,
    go: (app) => goTodo(app, ['vl-chapter', 'vl-story']),
  },
  {
    id: 'trial',
    modes: CAREER,
    chapter: CH,
    title: 'Une planche d\'essai mûre',
    example: 'Votre planche d\'essai est mûre : 2 graines à la main !',
    when: (ctx) => {
      if (!started(ctx)) return null;
      const list = ripeTrials(ctx);
      if (!list.length) return null;
      const since = Math.min(...list.map((i) => sinceOf(ctx, ctx.state.plots[i].ripeAt)));
      return { since, text: 'Votre planche d\'essai est mûre : 2 graines à la main !', target: { plot: list[0], label: 'la planche d\'essai mûre' } };
    },
    wait: 1,
    todo: 'vl-trial',
  },
  {
    id: 'works',
    modes: CAREER,
    chapter: CH,
    title: 'Un chantier prêt',
    example: 'Le ruisseau est prêt pour son chantier, quand vous voulez.',
    when: (ctx) => {
      if (!viewOpen(ctx)) return null;
      const p = readyPlace(ctx);
      if (!p) return null;
      return { since: null, text: `${p.short || p.name} : tout est prêt pour le chantier, quand vous voulez.` };
    },
    wait: 2,
    todo: null,
    go: (app) => {
      const g = app?.game;
      let p = null;
      try {
        p = (g?.query?.career?.valley?.()?.places || []).find((x) => x?.next?.canStart);
      } catch {
        p = null;
      }
      if (p) app?.valleyView?.open?.({ placeId: p.id });
    },
  },
  {
    id: 'legend',
    modes: CAREER,
    chapter: CH,
    title: 'Une légende mûre',
    example: 'Une légende est mûre sous sa cloche, quand vous voulez.',
    when: (ctx) => {
      if (!storksOn(ctx)) return null;
      const cl = VS(ctx).cloches || {};
      const id = Object.keys(cl).find((k) => cl[k]?.ripe);
      if (!id) return null;
      return { since: sinceOf(ctx, cl[id].readyAt), text: 'Une légende est mûre sous sa cloche, quand vous voulez.', target: LIBRARY };
    },
    wait: 1,
    todo: 'vl-legend',
  },
  {
    id: 'visitor',
    modes: CAREER,
    chapter: CH,
    title: 'Un visiteur rare',
    example: 'Un visiteur rare fait halte. Il vous attend, rien ne presse.',
    when: (ctx) => {
      if (!storksOn(ctx)) return null;
      const vis = VS(ctx).visitors || {};
      const id = Object.keys(vis).find((k) => vis[k]?.state === 'visible');
      if (!id) return null;
      return { since: sinceOf(ctx, vis[id].since), text: 'Un visiteur rare fait halte. Il vous attend, rien ne presse.' };
    },
    wait: 2,
    todo: 'vl-visitor',
  },
];

/** Action d'une entrée « À faire » existante (la première trouvée), au toucher d'une pastille. */
function goTodo(app, ids) {
  let items = [];
  try {
    items = app?.todo?.rawItems?.() || [];
  } catch {
    items = [];
  }
  for (const id of ids) {
    const it = items.find((x) => x?.id === id);
    if (it?.go) {
      it.go();
      return true;
    }
  }
  return false;
}

/** Lieu dont le chantier peut commencer (conditions ✓ et argent) : placeInfo, ou null. */
function readyPlace(ctx) {
  const pl = VS(ctx)?.places || {};
  // Un chantier en cours n'empêche pas les autres ; on ne lit la requête que si un lieu n'est pas au bout.
  const list = safe(ctx, () => QV(ctx)?.places, []) || [];
  return list.find((p) => !p.works && !p.restored && p.next?.canStart && !pl[p.id]?.works) || null;
}
