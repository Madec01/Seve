// La Vallée vivante — lot V1 « La boîte en fer » : extension de carrière (id 'valley'), enregistrée en DERNIER par
// src/core/career/extensions.js (après cozy). Pur. Règles : docs/VALLEE.md ; contrat : docs/ARCHITECTURE.md, « Vallée
// vivante — contrats du lot V1 » (écarts : « Écarts et précisions (livraison CORE V1) »).
//
// État : state.career.valley (null quand c'est désactivé) ; parcelles : variety, lastVariety, fallow, rested.
// Aléatoire : un seul flux nouveau, state.rng.valley — à chaque aube une fois la Vallée commencée : 12 nombres (un par
// espèce, habitants actifs) ; l'été et l'automne à partir de l'étape 2 : 3 nombres (cueillette des haies) ; 1 nombre par
// bocal ouvert ; 1 nombre au dernier jour d'hiver (étal de la foire). Aucun autre flux ne tire un nombre de plus.
//
// Points d'accroche :
//   dawnEvents  début (boîte de Joseph, première haie), jachères échues, trouvailles effacées au 1er jour d'hiver, bocal du
//               geai au 1er jour d'automne, étal de la foire au dernier jour d'hiver, espèces (indice → venue), cueillette ;
//   incomes     ruches + 1 pièce par jour avec 2 parcelles mellifères en pousse (hors hiver) ;
//   dawn        étape de la vallée (jamais en baisse) → valleyStage ;
//   yearEnd     report.valley, compteurs de l'année remis à zéro.
// Lus directement : heirlooms.js (farm.js, surprises.js, cozy.js, runtime.js, crew.js, events.js, animals.js) ; récolte :
// valleyHarvest (runtime.js) ; semis : valleySow (runtime.js, crew.js).
//
// (V2, « Le troc et les croisements », partie `heritage`) Grainothèque (5 niveaux), troc avec les 12 voisins (une
// proposition à la fois), croisements déterministes (rencontres à la récolte à la main), 4 habitants (flux NOUVEAU
// state.rng.valley2 : 4 nombres par aube, rien d'autre), 4 récits de Joseph, « Revoir la boîte ». Lectures pures :
// src/core/career/heritage.js ; données : src/data/career/heritage.js ; contrat : docs/ARCHITECTURE.md, « Vallée vivante —
// contrats du lot V2 ». Avec { heritage: false } : le V1 exactement (aucun tirage valley2, aucune règle du V2).

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { careerFactor } from '../../data/cozy.js';
import {
  ALL_SPECIES, ALL_SPECIES_BY_ID, ALL_VARIETIES, ALL_VARIETIES_BY_ID, ARRIVAL, FAIR_STALL, HEDGE_FINDS, HEDGE_FINDS_BY_ID, HEDGE_FIND_RULES,
  JOSEPH_BOX, MAX_STAGE, NATURE_ITEMS, NATURE_ITEMS_BY_ID, SEED_RULES, SIGNS_ALL, SIGNS_V1, SPECIES, SPECIES_BY_ID, STAGES, TRAITS_BY_ID,
  VALLEY_PARTS, VALLEY_START, VALLEY_TEXTS, VALLEY_VERSION, VARIETIES, VARIETIES_BY_ID, VARIETY_OF_CROP, agreeWith, savedText, varietyTraits,
} from '../../data/career/valley.js';
import {
  CROP_LOVE, CROSSES, CROSSES_BY_ID, CROSS_RULES, HERITAGE_TEXTS, LIBRARY_MAX, SEED_LIBRARY, SPECIES_V2, STORIES, STORIES_BY_ID, TROC, TROC_BY_CLIENT,
  VILLAGE_VARIETIES_BY_ID,
} from '../../data/career/heritage.js';
import { hashSeed, stream } from '../rng.js';
import { absDay } from '../surprises.js';
import { inGreenhouse } from '../farm.js';
import { treeSeedCost } from '../trees.js';
import {
  animalBonusOf, crossFactorOf, crossNeedOf, fixHandOf, fixedSeedCost, growthBonusOf, handSeedsOf, hedgeFindsMaxOf, heritagePartOn, isFixed,
  libraryLevelOf, partOn, seasonAbs, touristBonusOf, valleyOf, varietyName, varietyOf,
} from './heirlooms.js';
import {
  beePlotsGrowing, fixedVarieties, habitatCounts, installedSpecies, loneTreeStage, naturePrice, nextHint, recipeStatus, seasonsText, seasonsWhen,
  signsOfLife, speciesSpot, spotDef, spotLabel, spotsOf, stageFor, valleyServices, whereText, granaryBuilt,
} from './habitat.js';
import {
  boxInfo, canSupply, clientInfo, crossLinks, crossOfCrop, farmOf, heritageOn, heritageSeedsOn, isFavGift, libraryInfo, nextTrocClient,
  pairPartnerPlot, pairPlots, pairStatus, partnerOf, plotNeighbours, savedVarieties, storiesInfo, swapInfo, traitInfos, trocGifts, trocLock,
  trocRemaining, unitOf,
} from './heritage.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const SEASON_IN = { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' };
const FROM = ['box', 'jar', 'fair', 'jay', 'swap', 'cross', 'debug'];
const SPECIES_STATES = ['hint', 'visible', 'installed'];
const STAGE_NAMES = STAGES.map((s) => s.name);

// ── État ────────────────────────────────────────────────────────────────────────────────────

function emptyYear() {
  return { hand: 0, seedsSaved: 0, fixed: 0, installed: 0, placed: 0, finds: 0, jars: 0, spent: 0, swaps: 0, meets: 0, crosses: 0, heirloomCrops: [] };
}

function emptyStats() {
  return { hand: 0, seedsSaved: 0, observed: 0, placed: 0, jars: 0, fallows: 0, finds: {}, swaps: 0, meets: 0, crosses: 0, pairs: 0 };
}

/** Champs du V2 (Grainothèque, troc, croisements, récits). */
function emptyHeritage() {
  return { library: null, site: false, troc: null, trocSeason: -1, trocFairYear: 0, swaps: {}, crosses: {}, stories: { available: [], read: [] } };
}

/** Parties actives : true → toutes ; { seeds, wildlife } → absentes = true. */
export function normalizeValleyParts(opt) {
  const o = opt && typeof opt === 'object' ? opt : {};
  return Object.fromEntries(VALLEY_PARTS.map((k) => [k, o[k] !== false]));
}

export function newValleyState(parts = normalizeValleyParts(true)) {
  return {
    v: VALLEY_VERSION, parts, started: null, stage: 0, chapters: { read: [] }, spent: 0, jars: { opened: 0 }, seeds: {}, varieties: {},
    nature: {}, reserve: {}, bought: {}, species: {}, finds: [], jayYear: 0, fair: null, year: emptyYear(), stats: emptyStats(), nextId: 1,
    ...emptyHeritage(),
  };
}

/** createCareer({ valley }) : false → null (gardé tel quel à la reprise) ; true ou { seeds, wildlife }. */
export function enableCareerValley(state, opt = true) {
  if (opt === false) {
    state.career.valley = null;
    return null;
  }
  state.career.valley = newValleyState(normalizeValleyParts(opt));
  ensureRng(state);
  return state.career.valley;
}

function ensureRng(state) {
  if (!state.rng || typeof state.rng !== 'object') return;
  if (!Number.isInteger(state.rng.valley)) state.rng.valley = hashSeed(state.seed, 'valley');
  // (V2) Flux des 4 habitants du V2, seulement avec la partie `heritage` (aucun tirage sinon).
  if (state.career?.valley?.parts?.heritage !== false && !Number.isInteger(state.rng.valley2)) state.rng.valley2 = hashSeed(state.seed, 'valley2');
}

/** Complète une Vallée d'une version précédente (champs ajoutés plus tard ; rien n'est retiré). */
function completeValley(v) {
  const fresh = newValleyState(normalizeValleyParts(v.parts));
  for (const [k, val] of Object.entries(fresh)) if (v[k] === undefined) v[k] = val;
  v.parts = normalizeValleyParts(v.parts);
  for (const [k, val] of Object.entries(emptyYear())) if (v.year[k] === undefined) v.year[k] = val;
  for (const [k, val] of Object.entries(emptyStats())) if (v.stats[k] === undefined) v.stats[k] = val;
  if (!v.chapters || !Array.isArray(v.chapters.read)) v.chapters = { read: [] };
  if (!v.jars || !Number.isInteger(v.jars.opened)) v.jars = { opened: 0 };
  if (!v.year.heirloomCrops || !Array.isArray(v.year.heirloomCrops)) v.year.heirloomCrops = [];
  if (!v.stories || !Array.isArray(v.stories.available) || !Array.isArray(v.stories.read)) v.stories = { available: [], read: [] };
  for (const k of ['swaps', 'crosses']) if (!v[k] || typeof v[k] !== 'object' || Array.isArray(v[k])) v[k] = {};
  v.v = VALLEY_VERSION;
}

/** Vérification (sauvegarde). → null | 'problème' */
export function checkValley(state) {
  const v = state.career.valley;
  const obj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const int = (x, min = 0, max = 1e9) => Number.isInteger(x) && x >= min && x <= max;
  for (const p of state.plots) {
    if (!p || (p.variety === undefined && p.fallow === undefined && p.rested === undefined && p.lastVariety === undefined)) continue;
    if (!v) return 'Vallée (parcelle sans Vallée)';
    if (p.variety !== undefined && (!ALL_VARIETIES_BY_ID[p.variety] || p.cropId !== ALL_VARIETIES_BY_ID[p.variety].cropId)) return 'Vallée (variété d\'une parcelle)';
    if (p.lastVariety !== undefined && !ALL_VARIETIES_BY_ID[p.lastVariety]) return 'Vallée (dernière variété)';
    if (p.fallow !== undefined && (!int(p.fallow) || p.cropId || p.env !== 'field')) return 'Vallée (jachère)';
    if (p.rested !== undefined && p.rested !== true) return 'Vallée (sol reposé)';
  }
  if (v === null || v === undefined) return null;
  if (!obj(v) || !int(v.v, 1, VALLEY_VERSION)) return 'Vallée (version)';
  if (!obj(v.parts) || !VALLEY_PARTS.every((k) => typeof v.parts[k] === 'boolean' || (k === 'heritage' && v.parts[k] === undefined && v.v === 1))) return 'Vallée (parties)';
  if (v.started !== null && !(obj(v.started) && int(v.started.year, 1) && int(v.started.day, 1) && int(v.started.abs, 1))) return 'Vallée (début)';
  if (!int(v.stage, 0, MAX_STAGE) || v.stage > stageFor(signsOfLife(state))) return 'Vallée (étape)';
  if (!obj(v.chapters) || !Array.isArray(v.chapters.read) || !v.chapters.read.every((n) => int(n, 0, MAX_STAGE))) return 'Vallée (chapitres)';
  if (!(typeof v.spent === 'number' && Number.isFinite(v.spent) && v.spent >= 0)) return 'Vallée (dépenses)';
  if (!obj(v.jars) || !int(v.jars.opened) || v.jars.opened > (state.career.heirlooms || []).length) return 'Vallée (bocaux)';
  if (!obj(v.seeds) || !Object.entries(v.seeds).every(([id, n]) => ALL_VARIETIES_BY_ID[id] && int(n))) return 'Vallée (graines)';
  if (!obj(v.varieties)) return 'Vallée (variétés)';
  for (const [id, e] of Object.entries(v.varieties)) {
    if (!ALL_VARIETIES_BY_ID[id] || !obj(e) || !FROM.includes(e.from) || !int(e.got) || !int(e.hand) || !(e.fixedAt === null || int(e.fixedAt))) return `Vallée (variété ${id})`;
  }
  if (!obj(v.nature)) return 'Vallée (aménagements)';
  for (const [spotId, n] of Object.entries(v.nature)) {
    const d = spotDef(state, spotId, { ignoreNeeds: true });
    if (!d || !obj(n) || n.kind !== d.kind || !int(n.at)) return `Vallée (emplacement ${spotId})`;
  }
  for (const key of ['reserve', 'bought']) {
    if (!obj(v[key]) || !Object.entries(v[key]).every(([k, n]) => NATURE_ITEMS_BY_ID[k] && int(n))) return `Vallée (${key})`;
  }
  if (!obj(v.species)) return 'Vallée (habitants)';
  for (const [id, e] of Object.entries(v.species)) {
    if (!ALL_SPECIES_BY_ID[id] || !obj(e) || !SPECIES_STATES.includes(e.state) || !int(e.since) || !(e.spotId === null || typeof e.spotId === 'string')) return `Vallée (habitant ${id})`;
  }
  if (!Array.isArray(v.finds) || v.finds.length > hedgeFindsMaxOf(state, HEDGE_FIND_RULES.max)) return 'Vallée (cueillette)';
  for (const f of v.finds) if (!obj(f) || typeof f.id !== 'string' || !HEDGE_FINDS_BY_ID[f.kind] || typeof f.spotId !== 'string' || !int(f.day)) return 'Vallée (trouvaille)';
  if (!int(v.jayYear)) return 'Vallée (geai)';
  if (v.fair !== null && !(obj(v.fair) && int(v.fair.year, 1) && (v.fair.varietyId === null || VARIETIES_BY_ID[v.fair.varietyId]) && int(v.fair.price) && typeof v.fair.bought === 'boolean')) return 'Vallée (foire)';
  if (!obj(v.year) || !obj(v.stats) || !int(v.nextId, 1)) return 'Vallée (compteurs)';
  return checkHeritage(state, v, obj, int);
}

/** (V2) Vérification des champs du V2 (une sauvegarde V1, `v: 1`, sans eux, reste valide). */
function checkHeritage(state, v, obj, int) {
  if (v.v === 1 && v.library === undefined && v.swaps === undefined) return null;
  if (v.library !== null && v.library !== undefined && !(obj(v.library) && int(v.library.level, 1, LIBRARY_MAX) && int(v.library.builtAt) && int(v.library.levelAt))) return 'Vallée (grainothèque)';
  if (v.site !== undefined && typeof v.site !== 'boolean') return 'Vallée (panneau)';
  if (v.troc !== null && v.troc !== undefined) {
    if (!obj(v.troc) || !TROC_BY_CLIENT[v.troc.clientId] || !int(v.troc.since) || !['season', 'fair'].includes(v.troc.from)) return 'Vallée (troc)';
    if (v.swaps?.[v.troc.clientId]) return 'Vallée (troc déjà fait)';
  }
  if (v.trocSeason !== undefined && !int(v.trocSeason, -1)) return 'Vallée (troc de saison)';
  if (v.trocFairYear !== undefined && !int(v.trocFairYear)) return 'Vallée (troc de la foire)';
  if (v.swaps !== undefined) {
    if (!obj(v.swaps)) return 'Vallée (trocs)';
    for (const [clientId, e] of Object.entries(v.swaps)) {
      const entry = TROC_BY_CLIENT[clientId];
      if (!entry || !obj(e) || !ALL_VARIETIES_BY_ID[e.given] || e.got !== entry.varietyId || !int(e.seeds) || typeof e.fav !== 'boolean' || !int(e.at)) return `Vallée (troc ${clientId})`;
    }
  }
  if (v.crosses !== undefined) {
    if (!obj(v.crosses)) return 'Vallée (croisements)';
    for (const [cropId, e] of Object.entries(v.crosses)) {
      const c = crossOfCrop(cropId);
      if (!c || !obj(e) || !int(e.meet) || !(e.foundAt === null || int(e.foundAt))) return `Vallée (croisement ${cropId})`;
      if (e.foundAt !== null && !v.varieties[c.id]) return `Vallée (croisement ${cropId} sans variété)`;
    }
  }
  if (v.stories !== undefined) {
    if (!obj(v.stories) || !Array.isArray(v.stories.available) || !Array.isArray(v.stories.read)) return 'Vallée (récits)';
    if (!v.stories.available.every((id) => STORIES_BY_ID[id]) || !v.stories.read.every((id) => v.stories.available.includes(id))) return 'Vallée (récits)';
  }
  if (v.year?.heirloomCrops !== undefined && !(Array.isArray(v.year.heirloomCrops) && v.year.heirloomCrops.every((id) => getCrop(id)))) return 'Vallée (cultures de l\'année)';
  return null;
}

// ── Petits outils ───────────────────────────────────────────────────────────────────────────

function V(state) {
  return state.career.valley;
}

function rngOf(state) {
  ensureRng(state);
  return stream(state.rng, 'valley');
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

function seasonIdOf(state) {
  return SEASONS[state.time.seasonIndex];
}

function lastDayOfWinter(state) {
  return state.time.seasonIndex === 3 && state.time.dayOfSeason === state.career.seasonLength;
}

function hasOrchard(state) {
  return state.career.lots.some((l) => l.type === 'orchard');
}

function traitInfo(id) {
  const t = TRAITS_BY_ID[id];
  return { id: t.id, name: t.name, icon: t.icon, text: t.text };
}

function addVariety(v, id, from, abs) {
  const isNew = !v.varieties[id];
  if (isNew) v.varieties[id] = { from, got: abs, hand: 0, fixedAt: null };
  return isNew;
}

function spendValley(api, cost) {
  if (!(cost > 0)) return;
  const v = V(api.state);
  api.spend('valley', cost);
  v.spent += cost;
  v.year.spent = (v.year.spent || 0) + cost;
}

// ── Début : la boîte de Joseph ─────────────────────────────────────────────────────────────

function startValley(api) {
  const { state } = api;
  const v = V(state);
  const abs = absDay(state);
  v.started = { year: state.time.year, day: state.time.day, abs };
  const box = [];
  if (v.parts.seeds) {
    for (const id of JOSEPH_BOX.varieties) {
      addVariety(v, id, 'box', abs);
      v.seeds[id] = (v.seeds[id] || 0) + JOSEPH_BOX.seeds;
      box.push({ varietyId: id, name: VARIETIES_BY_ID[id].name, seeds: JOSEPH_BOX.seeds });
    }
  }
  // La première haie, offerte (hors prix croissants) : côté gauche du champ de départ, sinon la première haie libre.
  let hedge = null;
  if (!v.nature[JOSEPH_BOX.freeHedge] && spotDef(state, JOSEPH_BOX.freeHedge)) hedge = JOSEPH_BOX.freeHedge;
  else hedge = spotsOf(state, 'hedge').find((x) => !x.placed)?.spotId || null;
  if (hedge) v.nature[hedge] = { kind: 'hedge', at: abs };
  api.push('valleyStarted', { box, hedge, chapter: { title: JOSEPH_BOX.title, lines: [...JOSEPH_BOX.lines] }, hedgeLine: JOSEPH_BOX.hedgeLine });
}

// ── Aube ───────────────────────────────────────────────────────────────────────────────────

function endFallows(api) {
  const { state } = api;
  const now = seasonAbs(state);
  const plots = [];
  state.plots.forEach((p, i) => {
    if (p.fallow === undefined || p.fallow >= now) return;
    delete p.fallow;
    if (!p.cropId) p.rested = true;
    plots.push(i);
  });
  if (plots.length) api.push('fallowEnded', { plots });
}

/** Culture d'un bocal du geai (sans tirage) : la première variété pas encore obtenue de la saison suivante, sinon une autre. */
function jayCrop(state) {
  const v = V(state);
  const missing = VARIETIES.filter((x) => !v.varieties[x.id] && (x.cropId !== 'apple'));
  const next = SEASONS[(state.time.seasonIndex + 1) % 4];
  const pick = missing.find((x) => getCrop(x.cropId).seasons.includes(next)) || missing[0] || VARIETIES[0];
  return pick.cropId;
}

function jayGift(api) {
  const { state } = api;
  const v = V(state);
  if (!partOn(state, 'wildlife') || v.species.jay?.state !== 'installed' || v.jayYear >= state.time.year) return;
  v.jayYear = state.time.year;
  state.career.heirlooms.push({ cropId: jayCrop(state), lotId: 'home', year: state.time.year, day: state.time.day, from: 'jay' });
  api.push('jayGift', { index: state.career.heirlooms.length - 1, text: VALLEY_TEXTS.jayGift });
}

/** Variétés qu'on peut encore obtenir (le pommier Calville seulement avec un verger). */
function missingVarieties(state) {
  const v = V(state);
  return VARIETIES.filter((x) => !v.varieties[x.id] && (x.cropId !== 'apple' || hasOrchard(state)));
}

function fairStall(api) {
  const { state } = api;
  const v = V(state);
  const u = rngOf(state).float();
  const list = missingVarieties(state);
  const pick = list.length ? list[Math.min(list.length - 1, Math.floor(u * list.length))] : null;
  v.fair = { year: state.time.year, varietyId: pick ? pick.id : null, price: FAIR_STALL.base + FAIR_STALL.perRank * state.career.rank, bought: false };
}

/**
 * Venue des habitants (indice → visible). `list` : SPECIES (flux `valley`, 12 nombres) ou SPECIES_V2 (flux `valley2`,
 * 4 nombres) ; une seule venue annoncée par aube toutes espèces confondues (`hintedBefore`). → true si une espèce s'est
 * annoncée ce matin.
 */
function speciesDawn(api, list = SPECIES, streamName = 'valley', hintedBefore = false) {
  const { state } = api;
  const v = V(state);
  ensureRng(state);
  const rng = stream(state.rng, streamName);
  const draws = list.map(() => rng.float());
  const abs = absDay(state);
  const counts = habitatCounts(state);
  let hinted = hintedBefore;
  list.forEach((s, k) => {
    const e = v.species[s.id];
    if (e?.state === 'installed' || e?.state === 'visible') return;
    if (e?.state === 'hint') {
      if (draws[k] < ARRIVAL.visibleChance || abs - e.since >= ARRIVAL.maxWait - 1) {
        e.state = 'visible';
        e.spotId = speciesSpot(state, s.id);
        e.at = abs;
        api.push('speciesVisible', { id: s.id, name: s.name, spotId: e.spotId, where: whereText(state, e.spotId) });
      }
      return;
    }
    if (hinted && ARRIVAL.onePerDawn) return;
    const r = recipeStatus(state, s.id, counts);
    if (!r.ok || !r.inSeason || draws[k] >= ARRIVAL.hintChance) return;
    hinted = true;
    const spotId = speciesSpot(state, s.id);
    v.species[s.id] = { state: 'hint', since: abs, spotId };
    api.push('speciesHint', { id: s.id, spotId, text: s.hint, icon: s.hintIcon });
  });
  return hinted;
}

function hedgeDawn(api) {
  const { state } = api;
  const v = V(state);
  const rng = rngOf(state);
  const r = [rng.float(), rng.float(), rng.float()];
  const hedges = Object.entries(v.nature).filter(([, n]) => n.kind === 'hedge').map(([spotId]) => spotId);
  // (V2) Le merle noir élargit le plafond (4) — après les 3 tirages habituels, aucun tirage en plus.
  if (v.finds.length >= hedgeFindsMaxOf(state, HEDGE_FIND_RULES.max) || !hedges.length || r[0] >= HEDGE_FIND_RULES.chance) return;
  const sid = seasonIdOf(state);
  const kinds = HEDGE_FINDS.filter((f) => f.seasons.includes(sid));
  if (!kinds.length) return;
  const total = kinds.reduce((s, f) => s + f.weight, 0);
  let x = r[1] * total;
  let kind = kinds[kinds.length - 1];
  for (const f of kinds) {
    if (x < f.weight) {
      kind = f;
      break;
    }
    x -= f.weight;
  }
  const free = hedges.filter((spotId) => !v.finds.some((f) => f.spotId === spotId));
  const pool = free.length ? free : hedges;
  const spotId = pool[Math.min(pool.length - 1, Math.floor(r[2] * pool.length))];
  const find = { id: `h${v.nextId++}`, kind: kind.id, spotId, day: absDay(state) };
  v.finds.push(find);
  api.push('hedgeFinds', { finds: [{ id: find.id, kind: find.kind, spotId }] });
}

function dawnEvents(api) {
  const { state } = api;
  const v = V(state);
  if (!v) return;
  if (!v.started) {
    if (state.career.rank < VALLEY_START.rank) return;
    ensureRng(state);
    startValley(api);
  }
  // Saison nouvelle : jachères échues, cueillette effacée au 1er jour d'hiver, bocal du geai au 1er jour d'automne.
  endFallows(api);
  if (state.time.dayOfSeason === 1) {
    if (state.time.seasonIndex === 3 && v.finds.length) v.finds = [];
    if (state.time.seasonIndex === 2) jayGift(api);
  }
  // Foire aux graines (dernier jour d'hiver) : l'étal de la grainothèque du pays (1 nombre).
  if (lastDayOfWinter(state) && v.parts.seeds && v.fair?.year !== state.time.year) fairStall(api);
  const hintedV1 = v.parts.wildlife ? speciesDawn(api) : false;
  if (v.stage >= HEDGE_FIND_RULES.minStage && HEDGE_FIND_RULES.seasons.includes(seasonIdOf(state))) hedgeDawn(api);
  // (V2) Panneau de la Grainothèque et récit, troc (foire ou saison), habitants du V2 (flux valley2, 4 nombres).
  if (v.parts.heritage !== false) {
    siteDawn(api);
    if (v.parts.seeds) trocDawn(api);
    if (v.parts.wildlife) speciesDawn(api, SPECIES_V2, 'valley2', hintedV1);
  }
}

// ── (V2) Aube : panneau, récits, troc ───────────────────────────────────────────────────────

/** Récit de la Grainothèque disponible (une fois) ; → l'événement storyAvailable à pousser (ou null). */
function storyEvent(v, id) {
  if (!STORIES_BY_ID[id] || v.stories.available.includes(id)) return null;
  v.stories.available.push(id);
  return ['storyAvailable', { id, title: STORIES_BY_ID[id].title }];
}

function pushStory(api, id) {
  const e = storyEvent(V(api.state), id);
  if (e) api.push(...e);
  return e ? id : null;
}

/** Première aube au rang 3 (Vallée commencée) : le panneau « Ici, une grainothèque ? » et le récit heritage0. */
function siteDawn(api) {
  const { state } = api;
  const v = V(state);
  if (v.site || state.career.rank < SEED_LIBRARY.siteRank) return;
  v.site = true;
  pushStory(api, 'heritage0');
}

/** Données de l'événement trocOffered. */
function trocPayload(state, entry, from) {
  const x = VILLAGE_VARIETIES_BY_ID[entry.varietyId];
  const c = clientInfo(entry.clientId);
  return { clientId: entry.clientId, clientName: c.clientName, varietyId: x.id, varietyName: x.name, text: TROC.lines[entry.clientId]?.offer || '', from };
}

/**
 * Troc (une proposition à la fois, sans limite de temps) : au dernier jour d'hiver (foire aux graines, une par an) ou à
 * l'aube du 2ᵉ jour de chaque saison (Grainothèque ≥ 1, une par saison) ; il faut une variété sauvée à donner.
 */
function trocDawn(api) {
  const { state } = api;
  const v = V(state);
  if (v.troc || !savedVarieties(state).length || !trocRemaining(state).length) return;
  const year = state.time.year;
  let entry = null;
  let from = null;
  if (lastDayOfWinter(state) && v.trocFairYear < year) {
    entry = nextTrocClient(state, 'fair');
    if (entry) {
      v.trocFairYear = year;
      from = 'fair';
    }
  } else if (state.time.dayOfSeason === TROC.seasonDay && libraryLevelOf(state) >= 1 && v.trocSeason < seasonAbs(state)) {
    entry = nextTrocClient(state, 'season');
    if (entry) {
      v.trocSeason = seasonAbs(state);
      from = 'season';
    }
  }
  if (!entry || !trocGifts(state, entry.clientId).length) return;
  v.troc = { clientId: entry.clientId, since: absDay(state), from };
  api.push('trocOffered', trocPayload(state, entry, from));
}

/** Fin de l'aube : étape de la vallée (jamais en baisse). */
function updateStage(api) {
  const { state } = api;
  const v = V(state);
  if (!v?.started) return;
  const target = stageFor(signsOfLife(state));
  while (v.stage < target) {
    v.stage += 1;
    const st = STAGES[v.stage];
    api.push('valleyStage', { n: st.n, name: st.name, reward: clone(st.reward), chapter: { title: st.chapter.title, lines: [...st.chapter.lines] } });
  }
}

function beeIncome(api, { seasonId }) {
  const { state } = api;
  const v = V(state);
  if (!v?.started || !v.parts.seeds || seasonId === 'winter') return [];
  const hives = state.investments.beehive || 0;
  const t = TRAITS_BY_ID.bee;
  if (!hives || beePlotsGrowing(state) < t.minPlots) return [];
  return [{ source: 'valleyBees', amount: hives * t.perHive, kind: 'valley', key: 'honey' }];
}

/** Compteurs de l'année et ce qui est venu cette année (report.valley, query.career.yearReport().valley). */
export function careerValleyYear(state) {
  const v = V(state);
  if (!v) return null;
  const L = state.career.seasonLength;
  const from = (state.time.year - 1) * 4 * L + 1;
  const installed = ALL_SPECIES.filter((s) => v.species[s.id]?.state === 'installed' && (v.species[s.id].at ?? 0) >= from).map((s) => s.id);
  const fixed = ALL_VARIETIES.filter((x) => (v.varieties[x.id]?.fixedAt ?? 0) >= from).map((x) => x.id);
  const v2 = v.parts.heritage !== false ? { swaps: v.year.swaps || 0, crosses: v.year.crosses || 0, meets: v.year.meets || 0, libraryLevel: libraryLevelOf(state) } : {};
  return {
    started: !!v.started,
    stage: v.stage,
    stageName: STAGE_NAMES[v.stage],
    signs: signsOfLife(state),
    year: clone(v.year),
    installed,
    fixed,
    natureTotal: Object.keys(v.nature).length,
    ...v2,
  };
}

function yearEnd(api, { report }) {
  const v = V(api.state);
  if (!v) return;
  report.valley = careerValleyYear(api.state);
  v.year = emptyYear();
}

// ── Récolte et semis (lus par runtime.js) ──────────────────────────────────────────────────

/**
 * Récolte d'une parcelle à variété (AVANT clearPlot) : à la main → + 2 graines (pommier : + 1 greffon), + 1 vers la
 * fixation (fixée à 6 ; une variété sauvée ne rend plus de graines : elles sont en vente) ; équipe et machines : rien
 * (jamais de graine). Toujours : lastVariety (cultures).
 * → null | { variety, seeds, hand, need, fixed, events: [[type, payload]] } (événements à pousser après `harvested`).
 */
export function valleyHarvest(api, plotIndex, by) {
  const { state } = api;
  const v = valleyOf(state);
  const p = state.plots[plotIndex];
  const x = varietyOf(p);
  if (!v || !x) return null;
  const tree = isTreeCrop(getCrop(p.cropId));
  if (!tree) p.lastVariety = x.id;
  const entry = v.varieties[x.id];
  const fixHand = fixHandOf(state);
  const info = { variety: x.id, seeds: 0, hand: entry?.hand || 0, need: fixHand, fixed: false, events: [] };
  // (V2) Stand de la fête des récoltes : cultures dont une variété ancienne a été récoltée cette année (toutes récoltes).
  if (v.parts.heritage !== false) {
    if (!Array.isArray(v.year.heirloomCrops)) v.year.heirloomCrops = [];
    if (!v.year.heirloomCrops.includes(x.cropId)) v.year.heirloomCrops.push(x.cropId);
  }
  // (V2) Rien ne se perd : une planche d'essai récoltée par l'équipe ou une machine rend sa graine (sans graine en plus,
  // sans compter vers la fixation) — sinon une variété du village (un seul troc) ou une croisée (un seul croisement)
  // pourrait ne plus jamais se semer.
  if (by !== 'player' && v.parts.seeds && v.parts.heritage !== false && entry && !entry.fixedAt) {
    v.seeds[x.id] = (v.seeds[x.id] || 0) + 1;
    info.seedBack = true;
  }
  if (by !== 'player' || !v.parts.seeds) return info;
  const e = entry || (v.varieties[x.id] = { from: 'jar', got: absDay(state), hand: 0, fixedAt: null });
  // Une variété déjà sauvée ne rend plus de graines (elles sont en vente illimitée) ; la récolte à la main compte toujours.
  // (V2) Grainothèque niveau 2 : 3 graines par récolte à la main (greffon : 1).
  const gain = e.fixedAt ? 0 : handSeedsOf(state, tree);
  v.seeds[x.id] = (v.seeds[x.id] || 0) + gain;
  e.hand += 1;
  v.stats.hand += 1;
  v.year.hand += 1;
  v.stats.seedsSaved += gain;
  v.year.seedsSaved += gain;
  info.seeds = gain;
  info.hand = e.hand;
  if (gain > 0 || !e.fixedAt) info.events.push(['heirloomHarvest', { plotIndex, varietyId: x.id, seeds: gain, hand: e.hand, need: fixHand, by, tree }]);
  // (V2) Grainothèque niveau 3 : sauvée en 5 récoltes à la main ; une variété qui a déjà atteint le seuil (achat d'un
  // niveau) est sauvée ici, à sa récolte à la main (aucune fixation « en silence »).
  if (!e.fixedAt && e.hand >= fixHand) {
    e.fixedAt = absDay(state);
    v.year.fixed += 1;
    info.fixed = true;
    info.events.push(['heirloomFixed', fixedPayload(state, x)]);
  }
  // (V2) Rencontre de croisement : l'autre parent pousse sur une voisine (même terrain, un côté commun).
  if (v.parts.heritage !== false) crossMeeting(api, plotIndex, x, info.events);
  return info;
}

/** Données de heirloomFixed (V1 + traits du V2). */
function fixedPayload(state, x) {
  const name = varietyName(state, x);
  return { varietyId: x.id, name, trait: traitInfo(x.trait), traits: traitInfos(x), text: savedText({ ...x, name }) };
}

/**
 * (V2) Récolte à la main d'un parent pendant que l'autre parent pousse juste à côté : + 1 rencontre (osmie : + 2) ;
 * au seuil (3, Grainothèque niveau 4 : 2), le croisement : un sachet doré de 3 graines de la variété croisée. Une seule
 * rencontre par récolte. Événements (après heirloomFixed) : crossMeeting, crossFound, storyAvailable.
 */
function crossMeeting(api, plotIndex, x, events) {
  const { state } = api;
  const v = V(state);
  const link = partnerOf(x.id);
  if (!link) return;
  const cur = v.crosses[link.cropId];
  if (cur?.foundAt) return;
  const k = plotNeighbours(state, plotIndex).find((j) => {
    const q = state.plots[j];
    return q && q.env && q.cropId && q.variety === link.partnerId;
  });
  if (k === undefined) return;
  const c = cur || (v.crosses[link.cropId] = { meet: 0, foundAt: null });
  const add = crossFactorOf(state);
  c.meet += add;
  v.year.meets = (v.year.meets || 0) + add;
  v.stats.meets = (v.stats.meets || 0) + add;
  const need = crossNeedOf(state);
  events.push(['crossMeeting', { cropId: link.cropId, plotIndex, partnerPlot: k, meet: Math.min(c.meet, need), need, add }]);
  if (c.meet >= need) foundCross(api, link.cropId, events);
}

/** (V2) Le croisement d'une culture est trouvé : variété croisée ajoutée, 3 graines, premier récit. */
function foundCross(api, cropId, events) {
  const { state } = api;
  const v = V(state);
  const cr = crossOfCrop(cropId);
  const c = v.crosses[cropId] || (v.crosses[cropId] = { meet: 0, foundAt: null });
  if (c.foundAt) return null;
  const abs = absDay(state);
  const first = !Object.values(v.crosses).some((e) => e.foundAt);
  c.foundAt = abs;
  addVariety(v, cr.id, 'cross', abs);
  v.seeds[cr.id] = (v.seeds[cr.id] || 0) + CROSS_RULES.seeds;
  v.year.crosses = (v.year.crosses || 0) + 1;
  v.stats.crosses = (v.stats.crosses || 0) + 1;
  const story = first ? storyEvent(v, 'heritage2') : null;
  const payload = {
    varietyId: cr.id, cropId, name: varietyName(state, cr), traits: traitInfos(cr), parents: cr.parents.map((id) => ({ varietyId: id, name: ALL_VARIETIES_BY_ID[id].name })),
    seeds: CROSS_RULES.seeds, story: story ? 'heritage2' : null, text: cr.text,
  };
  events.push(['crossFound', payload]);
  if (story) events.push(story);
  return payload;
}

/** Prix du semis d'une variété fixée (sans graine gardée) : prix de la culture × 1,25 (greffon : prix du jeune plant × 1,25). */
export function heirloomSeedCost(api, varietyId) {
  const x = ALL_VARIETIES_BY_ID[varietyId];
  if (!x) return null;
  const crop = getCrop(x.cropId);
  // (V2) Grainothèque niveau 5 : au prix normal (× 1).
  return fixedSeedCost(isTreeCrop(crop) ? treeSeedCost(api.state, crop) : api.seedCost(crop.id), api.state);
}

/** Variété connue de cette partie (le V2 seulement avec la partie `heritage`). */
function knownVariety(state, id) {
  const x = ALL_VARIETIES_BY_ID[id];
  if (!x) return null;
  if (x.group !== 'pays' && valleyOf(state)?.parts?.heritage === false) return null;
  return x;
}

/**
 * Semer une variété ancienne (joueur ; équipe et semoir : seulement une variété fixée). Graines gardées d'abord (gratuit) ;
 * avant fixation, sans graine : refus ; fixée : prix de la culture × 1,25.
 */
export function valleySow(api, plotIndex, varietyId, { by = 'player' } = {}) {
  const { state } = api;
  const v = valleyOf(state);
  if (!v || !v.started) return api.fail(VALLEY_TEXTS.notStarted);
  if (!v.parts.seeds) return api.fail('Graines anciennes désactivées.');
  const x = knownVariety(state, varietyId);
  if (!x) return api.fail('Variété inconnue.');
  if (!Number.isInteger(plotIndex) || plotIndex < 0 || plotIndex >= state.plots.length || !state.plots[plotIndex].env) return api.fail('Parcelle inexistante.');
  const p = state.plots[plotIndex];
  if (!p.unlocked) return api.fail('Cette parcelle n\'est pas encore ouverte.');
  if (p.cropId) return api.fail('Cette parcelle n\'est pas libre.');
  const crop = getCrop(x.cropId);
  const tree = isTreeCrop(crop);
  if (tree && p.env !== 'orchard') return api.fail('Un greffon se plante dans un verger.');
  if (!tree && p.env === 'orchard') return api.fail('Le verger n\'accueille que des arbres.');
  const sid = seasonIdOf(state);
  if (!inGreenhouse(p) && !crop.seasons.includes(sid)) return api.fail(`${crop.name} ne se sème pas ${SEASON_IN[sid]}.`);
  const fixed = isFixed(state, x.id);
  if (by !== 'player' && !fixed) return api.fail('Une variété pas encore sauvée se sème à la main.');
  const have = v.seeds[x.id] || 0;
  const fromSeeds = have > 0;
  let cost = 0;
  if (!fromSeeds) {
    if (!fixed) return api.fail(noSeedsText(state, x, tree));
    cost = heirloomSeedCost(api, x.id);
    if (state.money < cost) return api.fail(notEnough(cost - state.money));
  }
  const r = api.plant(plotIndex, crop.id, { by, heirloom: { id: x.id, cost } });
  if (!r.ok) return r;
  if (fromSeeds) v.seeds[x.id] = have - 1;
  const seedsLeft = v.seeds[x.id] || 0;
  api.push('heirloomSown', { plotIndex, varietyId: x.id, fromSeeds, seedsLeft, by });
  return { ok: true, plotIndex, varietyId: x.id, cropId: crop.id, cost, fromSeeds, seedsLeft, fallowCancelled: !!r.fallowCancelled };
}

/** « Plus de graines de … pour l'instant : chaque récolte à la main d'une planche d'essai en rend 2. » */
function noSeedsText(state, x, tree) {
  return `Plus de ${tree ? 'greffon' : 'graines'} de ${varietyName(state, x)} pour l'instant : chaque récolte à la main d'une planche d'essai en rend ${handSeedsOf(state, tree)}.`;
}

// ── Actions ────────────────────────────────────────────────────────────────────────────────

function needStarted(api) {
  const v = valleyOf(api.state);
  if (!v) return api.fail('La Vallée est désactivée.');
  if (!v.started) return api.fail(VALLEY_TEXTS.notStarted);
  return null;
}

/** Ouvre le plus ancien bocal pas encore ouvert (1 nombre du flux valley). */
function openJar(api) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  if (!v.parts.seeds) return api.fail('Graines anciennes désactivées.');
  const jars = state.career.heirlooms || [];
  if (v.jars.opened >= jars.length) return api.fail(VALLEY_TEXTS.noJar);
  const index = v.jars.opened;
  const jar = jars[index];
  const u = rngOf(state).float();
  const own = VARIETY_OF_CROP[jar.cropId];
  let id = own && !v.varieties[own] ? own : null;
  if (!id) {
    const missing = missingVarieties(state);
    if (missing.length) {
      const sid = seasonIdOf(state);
      const inSeason = missing.filter((x) => !isTreeCrop(getCrop(x.cropId)) && getCrop(x.cropId).seasons.includes(sid));
      const pool = inSeason.length ? inSeason : missing;
      id = pool[Math.min(pool.length - 1, Math.floor(u * pool.length))].id;
    } else id = own || VARIETIES[0].id;
  }
  const x = VARIETIES_BY_ID[id];
  const isNew = addVariety(v, id, jar.from === 'jay' ? 'jay' : 'jar', absDay(state));
  v.seeds[id] = (v.seeds[id] || 0) + SEED_RULES.jarSeeds;
  v.jars.opened += 1;
  v.stats.jars += 1;
  v.year.jars += 1;
  const label = VARIETIES_BY_ID[own]?.label || null;
  const out = { index, varietyId: id, name: x.name, trait: traitInfo(x.trait), seeds: SEED_RULES.jarSeeds, isNew, label, cropId: x.cropId };
  api.push('jarOpened', clone(out));
  return { ok: true, ...out };
}

/** Jachère fleurie sur une parcelle de champ vide (gratuit), jusqu'au soir du dernier jour de la saison. */
function sowFallow(api, plotIndex) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const p = Number.isInteger(plotIndex) ? state.plots[plotIndex] : null;
  if (!p || !p.env || !p.unlocked || p.env !== 'field' || p.cropId) return api.fail('Une jachère se fait sur une parcelle de champ vide.');
  if (p.fallow !== undefined) return api.fail('Déjà en jachère.');
  p.fallow = seasonAbs(state);
  const v = V(state);
  v.stats.fallows += 1;
  api.push('fallowSown', { plotIndex, until: p.fallow });
  return { ok: true, plotIndex, until: p.fallow };
}

/** Raison pour laquelle un aménagement ne se pose pas (rang, grenier) ; null sinon. */
function natureLock(state, kind) {
  const item = NATURE_ITEMS_BY_ID[kind];
  if (!item || (item.heritage && !heritagePartOn(state))) return 'Aménagement inconnu.';
  if (item.rank > state.career.rank) return `Rang ${item.rank} requis`;
  if (item.needs === 'granary' && !granaryBuilt(state)) return 'Construisez d\'abord le grenier.';
  if (kind === 'reeds' && !state.career.lots.some((l) => l.type === 'pond')) return 'Il faut une mare.';
  return null;
}

function placeNature(api, spotId, kind) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const d = spotDef(state, spotId, { ignoreNeeds: true });
  if (!d) return api.fail('Emplacement inconnu.');
  if (v.nature[spotId]) return api.fail('Déjà aménagé.');
  const k = kind ?? d.kind;
  if (!NATURE_ITEMS_BY_ID[k] || k !== d.kind || (NATURE_ITEMS_BY_ID[k].heritage && !heritagePartOn(state))) return api.fail('Cet aménagement ne va pas ici.');
  const lock = natureLock(state, k);
  if (lock) return api.fail(lock);
  const fromReserve = (v.reserve[k] || 0) > 0;
  const cost = fromReserve ? 0 : naturePrice(state, k);
  if (state.money < cost) return api.fail(notEnough(cost - state.money));
  if (fromReserve) {
    v.reserve[k] -= 1;
    if (v.reserve[k] <= 0) delete v.reserve[k];
  } else {
    spendValley(api, cost);
    v.bought[k] = (v.bought[k] || 0) + 1;
  }
  v.nature[spotId] = { kind: k, at: absDay(state) };
  v.stats.placed += 1;
  v.year.placed += 1;
  api.push('naturePlaced', { spotId, kind: k, cost, fromReserve });
  return { ok: true, spotId, kind: k, cost, fromReserve };
}

function serviceInfo(s) {
  return { kind: s.service.kind, value: s.service.value, text: s.service.text };
}

function observe(api, speciesId) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const s0 = ALL_SPECIES_BY_ID[speciesId];
  const s = s0 && (s0.group !== 'v2' || v.parts.heritage !== false) ? s0 : null;
  const e = s ? v.species[speciesId] : null;
  if (e?.state === 'installed') return api.fail(`Déjà ${agreeWith(s, 'installé')}.`);
  if (!s || !v.parts.wildlife || e?.state !== 'visible') return api.fail('Rien à observer ici.');
  e.state = 'installed';
  e.at = absDay(state);
  v.stats.observed += 1;
  v.year.installed += 1;
  const first = installedSpecies(state).length === 1;
  const extra = s.welcome ? { welcome: s.welcome } : {};
  const out = { speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId, ...extra };
  api.push('speciesInstalled', { id: speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId, ...extra });
  return { ok: true, ...out };
}

function pickHedgeFind(api, findId) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const k = v.finds.findIndex((f) => f.id === findId);
  if (k < 0) return api.fail('Rien à cueillir ici.');
  const find = v.finds.splice(k, 1)[0];
  const def = HEDGE_FINDS_BY_ID[find.kind];
  const amount = Math.round(def.coins * careerFactor(state.career.rank));
  api.earn('valley', amount);
  v.stats.finds[find.kind] = (v.stats.finds[find.kind] || 0) + 1;
  v.year.finds += 1;
  api.push('hedgePicked', { id: find.id, kind: find.kind, name: def.name, amount, spotId: find.spotId });
  return { ok: true, kind: find.kind, name: def.name, amount };
}

function fairInfo(state) {
  const v = V(state);
  if (!v?.started || !v.parts.seeds) return null;
  if (!lastDayOfWinter(state) || !v.fair || v.fair.year !== state.time.year) return null;
  const x = v.fair.varietyId ? VARIETIES_BY_ID[v.fair.varietyId] : null;
  let reason = null;
  if (!x) reason = 'Toutes les variétés du pays sont déjà chez vous.';
  else if (v.fair.bought) reason = 'Déjà acheté cette année.';
  else if (state.money < v.fair.price) reason = notEnough(v.fair.price - state.money);
  return {
    varietyId: x ? x.id : null, name: x ? x.name : null, icon: x ? x.icon : null, trait: x ? traitInfo(x.trait) : null, seeds: FAIR_STALL.seeds,
    price: v.fair.price, canBuy: !reason, reason, stall: FAIR_STALL.name, bought: v.fair.bought,
  };
}

function buyFairHeirloom(api) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  if (!lastDayOfWinter(state) || !v.fair || v.fair.year !== state.time.year) return api.fail('La foire aux graines n\'est pas aujourd\'hui.');
  const info = fairInfo(state);
  if (!info.canBuy) return api.fail(info.reason);
  const id = v.fair.varietyId;
  spendValley(api, v.fair.price);
  v.fair.bought = true;
  addVariety(v, id, 'fair', absDay(state));
  v.seeds[id] = (v.seeds[id] || 0) + FAIR_STALL.seeds;
  api.push('fairHeirloomBought', { varietyId: id, name: VARIETIES_BY_ID[id].name, seeds: FAIR_STALL.seeds, cost: v.fair.price });
  return { ok: true, varietyId: id, seeds: FAIR_STALL.seeds, cost: v.fair.price };
}

function chapterOf(n) {
  const st = STAGES[n];
  return { n, title: st.chapter.title, lines: [...st.chapter.lines] };
}

function readChapter(api, n) {
  const refused = needStarted(api);
  if (refused) return refused;
  const v = V(api.state);
  if (!Number.isInteger(n) || n < 0 || n > v.stage) return api.fail('Chapitre inconnu.');
  if (!v.chapters.read.includes(n)) v.chapters.read.push(n);
  v.chapters.read.sort((a, b) => a - b);
  return { ok: true, chapter: chapterOf(n) };
}

// ── (V2) Actions : Grainothèque, troc, paire, récits ───────────────────────────────────────

/** Origine d'une variété ajoutée par le débogage. */
function debugFrom(x) {
  return x.group === 'village' ? 'swap' : x.group === 'cross' ? 'cross' : 'jar';
}

function needHeritage(api, { seeds = true } = {}) {
  const refused = needStarted(api);
  if (refused) return refused;
  const v = V(api.state);
  if (v.parts.heritage === false || (seeds && v.parts.seeds === false)) return api.fail(HERITAGE_TEXTS.disabled);
  return null;
}

/** Construit (niveau 1) ou agrandit d'un niveau la Grainothèque (poste « La Vallée », patrimoine 100 %). */
function buildSeedLibrary(api) {
  const refused = needHeritage(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const level = libraryLevelOf(state);
  if (level >= LIBRARY_MAX) return api.fail(HERITAGE_TEXTS.maxLevel);
  const L = SEED_LIBRARY.levels[level];
  if (state.career.rank < L.rank) return api.fail(`Rang ${L.rank} requis`);
  if (state.money < L.price) return api.fail(notEnough(L.price - state.money));
  const abs = absDay(state);
  spendValley(api, L.price);
  v.library = level === 0 ? { level: 1, builtAt: abs, levelAt: abs } : { ...v.library, level: L.level, levelAt: abs };
  v.site = true;
  const story = L.level === 1 ? 'heritage1' : L.level === LIBRARY_MAX ? 'heritage3' : null;
  const out = { level: L.level, name: L.name, cost: L.price, unlocks: [...L.unlocks], story };
  api.push('seedLibraryBuilt', clone(out));
  if (story) pushStory(api, story);
  return { ok: true, ...out };
}

/** Troc avec le voisin qui attend : on donne 3 graines d'une variété sauvée, il en rend 3 (4 pour une préférée ♥). */
function swapSeeds(api, varietyId) {
  const refused = needHeritage(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  if (!v.troc) return api.fail(HERITAGE_TEXTS.noTroc);
  const entry = TROC_BY_CLIENT[v.troc.clientId];
  const c = clientInfo(entry.clientId);
  const x = ALL_VARIETIES_BY_ID[varietyId];
  if (!x) return api.fail('Variété inconnue.');
  if (varietyId === entry.varietyId) return api.fail(`${c.clientName} a déjà cette variété : c'est la sienne.`);
  if (!isFixed(state, varietyId)) return api.fail('Cette variété n\'est pas encore sauvée.');
  const fav = isFavGift(entry.clientId, varietyId);
  const seeds = TROC.seeds + (fav ? TROC.favBonus : 0);
  const abs = absDay(state);
  const got = VILLAGE_VARIETIES_BY_ID[entry.varietyId];
  addVariety(v, got.id, 'swap', abs);
  v.seeds[got.id] = (v.seeds[got.id] || 0) + seeds;
  v.swaps[entry.clientId] = { given: varietyId, got: got.id, seeds, fav, at: abs };
  v.troc = null;
  v.year.swaps = (v.year.swaps || 0) + 1;
  v.stats.swaps = (v.stats.swaps || 0) + 1;
  const lines = TROC.lines[entry.clientId] || {};
  const thanks = x.group === 'cross' ? TROC.crossThanks.replace('{farm}', farmOf(state)) : lines.thanks || '';
  const unit = unitOf(got.id);
  const out = {
    clientId: entry.clientId, clientName: c.clientName, given: { varietyId, name: varietyName(state, x) }, got: { varietyId: got.id, name: got.name, seeds, unit },
    fav, thanks,
    favLine: fav ? TROC.favThanks.replace('{name}', c.clientName).replace('{crop}', CROP_LOVE[x.cropId] || x.cropId).replace('{n}', seeds).replace('{units}', unit === 'greffon' ? 'greffons' : 'graines').replace('{base}', TROC.seeds) : null,
  };
  api.push('seedSwapped', clone(out));
  return { ok: true, ...out };
}

/**
 * Semer la paire d'une culture : le parent du village sur `plotIndex`, celui du pays sur la première voisine libre
 * (droite, gauche, dessous, dessus). Chaque semis suit valleySow (graines gardées d'abord, sinon variété sauvée au prix
 * de la graine). Atomique : tout est vérifié avant de semer.
 */
function sowPair(api, plotIndex, cropId) {
  const refused = needHeritage(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const cr = crossOfCrop(cropId);
  if (!cr) return api.fail('Culture sans croisement.');
  if (v.crosses[cropId]?.foundAt) return api.fail('Ce croisement est déjà trouvé.');
  if (!Number.isInteger(plotIndex) || plotIndex < 0 || plotIndex >= state.plots.length || !state.plots[plotIndex].env) return api.fail('Parcelle inexistante.');
  const p = state.plots[plotIndex];
  if (!p.unlocked || p.cropId) return api.fail('Cette parcelle n\'est pas libre.');
  if (p.env === 'orchard') return api.fail('Le verger n\'accueille que des arbres.');
  const crop = getCrop(cropId);
  const sid = seasonIdOf(state);
  if (!inGreenhouse(p) && !crop.seasons.includes(sid)) return api.fail(`${crop.name} ne se sème pas ${SEASON_IN[sid]}.`);
  const k = pairPartnerPlot(state, plotIndex, crop);
  if (k < 0) return api.fail('Il faut une parcelle libre juste à côté.');
  const [paysId, villageId] = cr.parents;
  // Graines ou argent pour les deux semis (vérifiés ensemble).
  let need = 0;
  for (const id of [villageId, paysId]) {
    const x = ALL_VARIETIES_BY_ID[id];
    if ((v.seeds[id] || 0) > 0) continue;
    if (!isFixed(state, id)) {
      if (!v.varieties[id]) return api.fail(pairStatus(state, cropId).reason || 'Variété inconnue.');
      return api.fail(noSeedsText(state, x, false));
    }
    need += heirloomSeedCost(api, id);
  }
  if (state.money < need) return api.fail(notEnough(need - state.money));
  const a = valleySow(api, plotIndex, villageId, { by: 'player' });
  if (!a.ok) return a;
  const b = valleySow(api, k, paysId, { by: 'player' });
  if (!b.ok) return b;
  v.stats.pairs = (v.stats.pairs || 0) + 1;
  const out = { plots: [plotIndex, k], varieties: [villageId, paysId], cost: (a.cost || 0) + (b.cost || 0), fromSeeds: [!!a.fromSeeds, !!b.fromSeeds] };
  api.push('pairSown', { plots: [...out.plots], varieties: [...out.varieties], cost: out.cost, cropId });
  return { ok: true, ...out };
}

function readStory(api, id) {
  const refused = needStarted(api);
  if (refused) return refused;
  const v = V(api.state);
  const s = STORIES_BY_ID[id];
  if (!s || !v.stories?.available.includes(id)) return api.fail('Récit inconnu.');
  if (!v.stories.read.includes(id)) v.stories.read.push(id);
  return { ok: true, story: { id: s.id, title: s.title, lines: [...s.lines], vignette: s.vignette } };
}

/** Débogage et tests (passent par l'état ; jamais appelé par le jeu). */
function triggerValley(api, kind, arg, arg2) {
  const { state } = api;
  const v = valleyOf(state);
  if (!v) return api.fail('La Vallée est désactivée.');
  const abs = absDay(state);
  switch (kind) {
    case 'start':
      if (v.started) return api.fail('Déjà commencée.');
      startValley(api);
      return { ok: true };
    case 'jar': {
      const crop = getCrop(arg || 'carrot');
      if (!crop || isTreeCrop(crop)) return api.fail('Culture inconnue.');
      state.career.heirlooms.push({ cropId: crop.id, lotId: 'home', year: state.time.year, day: state.time.day, from: 'debug' });
      return { ok: true, index: state.career.heirlooms.length - 1 };
    }
    case 'seeds': {
      const x = knownVariety(state, arg);
      if (!x) return api.fail('Variété inconnue.');
      addVariety(v, arg, debugFrom(x), abs);
      v.seeds[arg] = (v.seeds[arg] || 0) + (Number.isInteger(arg2) ? arg2 : 3);
      return { ok: true, seeds: v.seeds[arg] };
    }
    case 'fix': {
      const x = knownVariety(state, arg);
      if (!x) return api.fail('Variété inconnue.');
      addVariety(v, arg, debugFrom(x), abs);
      const e = v.varieties[arg];
      e.hand = Math.max(e.hand, fixHandOf(state));
      if (!e.fixedAt) {
        e.fixedAt = abs;
        v.year.fixed += 1;
        api.push('heirloomFixed', fixedPayload(state, x));
      }
      return { ok: true };
    }
    // (V2) Panneau, Grainothèque, troc, croisements (débogage et tests).
    case 'site':
      v.site = true;
      pushStory(api, 'heritage0');
      return { ok: true };
    case 'library': {
      if (v.parts.heritage === false) return api.fail(HERITAGE_TEXTS.disabled);
      const n = Math.max(0, Math.min(LIBRARY_MAX, Math.floor(Number(arg) || 0)));
      const before = libraryLevelOf(state);
      v.site = true;
      v.library = n ? { level: n, builtAt: v.library?.builtAt || abs, levelAt: abs } : null;
      for (let k = before + 1; k <= n; k++) {
        const L = SEED_LIBRARY.levels[k - 1];
        const story = k === 1 ? 'heritage1' : k === LIBRARY_MAX ? 'heritage3' : null;
        api.push('seedLibraryBuilt', { level: k, name: L.name, cost: 0, unlocks: [...L.unlocks], story });
        if (story) pushStory(api, story);
      }
      return { ok: true, level: n };
    }
    case 'troc': {
      const entry = TROC_BY_CLIENT[arg] || nextTrocClient(state, 'fair');
      if (!entry || v.swaps[entry.clientId]) return api.fail('Voisin inconnu ou troc déjà fait.');
      v.troc = { clientId: entry.clientId, since: abs, from: 'season' };
      api.push('trocOffered', trocPayload(state, entry, 'season'));
      return { ok: true, clientId: entry.clientId };
    }
    case 'swap': {
      const entry = TROC_BY_CLIENT[arg] || (v.troc ? TROC_BY_CLIENT[v.troc.clientId] : null);
      if (!entry || v.swaps[entry.clientId]) return api.fail('Voisin inconnu ou troc déjà fait.');
      let gift = trocGifts(state, entry.clientId)[0]?.varietyId;
      if (!gift) {
        gift = VARIETIES.find((x) => x.id !== entry.varietyId)?.id;
        triggerValley(api, 'fix', gift);
      }
      v.troc = { clientId: entry.clientId, since: abs, from: 'season' };
      return swapSeeds(api, gift);
    }
    case 'meet': {
      const cr = crossOfCrop(arg);
      if (!cr) return api.fail('Culture sans croisement.');
      const c = v.crosses[arg] || (v.crosses[arg] = { meet: 0, foundAt: null });
      if (c.foundAt) return api.fail('Ce croisement est déjà trouvé.');
      const n = Number.isInteger(arg2) ? arg2 : 1;
      c.meet += n;
      const events = [['crossMeeting', { cropId: arg, plotIndex: null, partnerPlot: null, meet: Math.min(c.meet, crossNeedOf(state)), need: crossNeedOf(state), add: n }]];
      if (c.meet >= crossNeedOf(state)) foundCross(api, arg, events);
      for (const e of events) api.push(...e);
      return { ok: true, meet: c.meet, found: !!c.foundAt };
    }
    case 'cross': {
      const cr = crossOfCrop(arg);
      if (!cr) return api.fail('Culture sans croisement.');
      const events = [];
      const found = foundCross(api, arg, events);
      if (!found) return api.fail('Ce croisement est déjà trouvé.');
      v.crosses[arg].meet = Math.max(v.crosses[arg].meet, crossNeedOf(state));
      for (const e of events) api.push(...e);
      return { ok: true, varietyId: cr.id };
    }
    case 'visible':
    case 'install': {
      const s0 = ALL_SPECIES_BY_ID[arg];
      const s = s0 && (s0.group !== 'v2' || v.parts.heritage !== false) ? s0 : null;
      if (!s) return api.fail('Espèce inconnue.');
      const spotId = speciesSpot(state, s.id);
      if (v.species[s.id]?.state === 'installed') return api.fail('Déjà installé.');
      v.species[s.id] = { state: 'visible', since: abs, spotId, at: abs };
      if (kind === 'visible') {
        api.push('speciesVisible', { id: s.id, name: s.name, spotId, where: whereText(state, spotId) });
        return { ok: true, spotId };
      }
      return observe(api, s.id);
    }
    case 'stage': {
      const n = Math.max(0, Math.min(MAX_STAGE, Number(arg) || 0));
      // Signes de vie jusqu'au palier (variétés fixées d'abord, puis habitants), puis l'étape (comme à l'aube).
      for (const x of VARIETIES) {
        if (signsOfLife(state) >= STAGES[n].signs) break;
        if (!isFixed(state, x.id)) triggerValley(api, 'fix', x.id);
      }
      for (const s of SPECIES) {
        if (signsOfLife(state) >= STAGES[n].signs) break;
        if (v.species[s.id]?.state !== 'installed') triggerValley(api, 'install', s.id);
      }
      updateStage(api);
      return { ok: true, stage: v.stage };
    }
    case 'finds': {
      const hedges = Object.entries(v.nature).filter(([, n]) => n.kind === 'hedge').map(([spotId]) => spotId);
      if (!hedges.length) return api.fail('Aucune haie.');
      const sid = seasonIdOf(state);
      const kinds = HEDGE_FINDS.filter((f) => f.seasons.includes(sid));
      const list = kinds.length ? kinds : HEDGE_FINDS;
      const added = [];
      while (v.finds.length < hedgeFindsMaxOf(state, HEDGE_FIND_RULES.max)) {
        const f = { id: `h${v.nextId++}`, kind: list[v.finds.length % list.length].id, spotId: hedges[v.finds.length % hedges.length], day: abs };
        v.finds.push(f);
        added.push({ id: f.id, kind: f.kind, spotId: f.spotId });
      }
      if (added.length) api.push('hedgeFinds', { finds: added });
      return { ok: true, finds: added.length };
    }
    case 'fair': {
      const list = missingVarieties(state);
      v.fair = { year: state.time.year, varietyId: list[0]?.id || null, price: FAIR_STALL.base + FAIR_STALL.perRank * state.career.rank, bought: false };
      return { ok: true, varietyId: v.fair.varietyId };
    }
    case 'tree': {
      const n = v.nature[arg];
      if (!n || n.kind !== 'loneTree') return api.fail('Pas de chêne ici.');
      n.at = Math.max(1, abs - 2 * 4 * state.career.seasonLength);
      return { ok: true };
    }
    default:
      return api.fail('Inconnu.');
  }
}

// ── Requêtes ───────────────────────────────────────────────────────────────────────────────

/** Variétés de la partie : les 35 avec le V2, les 12 du pays sinon. */
function partVarieties(state) {
  return heritagePartOn(state) ? ALL_VARIETIES : VARIETIES;
}

/** Habitants de la partie : les 16 avec le V2, les 12 du V1 sinon. */
function partSpecies(state) {
  return heritagePartOn(state) ? ALL_SPECIES : SPECIES;
}

/** (V2) Lien d'un parent avec son croisement : { cropId, partnerId, partnerName, meet, need, found } | null. */
function crossLinkOf(state, x) {
  if (!heritagePartOn(state)) return null;
  const link = partnerOf(x.id);
  if (!link) return null;
  const c = V(state).crosses[link.cropId];
  return { cropId: link.cropId, crossId: link.crossId, partnerId: link.partnerId, partnerName: ALL_VARIETIES_BY_ID[link.partnerId].name, meet: c?.meet || 0, need: crossNeedOf(state), found: !!c?.foundAt };
}

function varietyInfo(api, x) {
  const { state } = api;
  const v = V(state);
  const e = v.varieties[x.id];
  const fixed = !!e?.fixedAt;
  const tree = isTreeCrop(getCrop(x.cropId));
  const group = x.group || 'pays';
  let hint = null;
  if (!e) {
    if (group === 'village') {
      const c = clientInfo(x.clientId);
      hint = `${c.clientName} la garde dans son jardin : un troc, au tableau du village.`;
    } else if (group === 'cross') hint = HERITAGE_TEXTS.crossRule;
    else hint = JOSEPH_BOX.varieties.includes(x.id) ? VALLEY_TEXTS.boxVariety : tree ? VALLEY_TEXTS.graftVariety : VALLEY_TEXTS.unknownVariety;
  }
  let name;
  if (group === 'cross') name = e ? varietyName(state, x) : '?';
  else name = e ? x.name : getCrop(x.cropId).name;
  const traits = traitInfos(x);
  const extra = group === 'pays' ? {} : {
    clientId: x.clientId || null,
    ...(group === 'cross' ? { parents: x.parents.map((id) => ({ varietyId: id, name: ALL_VARIETIES_BY_ID[id].name, icon: ALL_VARIETIES_BY_ID[id].icon })) } : {}),
  };
  return {
    id: x.id, cropId: x.cropId, name, g: x.g, icon: x.icon, ripeIcon: x.ripe, tint: x.tint, trait: traitInfo(x.trait), traits, group,
    state: !e ? 'unknown' : fixed ? 'fixed' : 'seeds', seeds: v.seeds[x.id] || 0, hand: e?.hand || 0, need: fixHandOf(state),
    label: x.label || null, anecdote: e ? x.anecdote : null, hint, from: e?.from || null, tree, unit: tree ? 'greffon' : 'graine',
    growing: state.plots.filter((p) => p.variety === x.id && p.cropId).length,
    seedCost: fixed ? heirloomSeedCost(api, x.id) : null,
    cross: crossLinkOf(state, x),
    ...extra,
  };
}

function speciesInfo(state, s, counts) {
  const v = V(state);
  const e = v.species[s.id];
  const r = recipeStatus(state, s.id, counts);
  const st = e ? e.state : 'unknown';
  return {
    id: s.id, name: s.name, icon: s.icon, seasons: [...s.seasons], seasonsText: seasonsText(s.seasons), seasonsWhen: seasonsWhen(s.seasons), the: s.the, g: s.g, pl: s.pl, state: st, inSeason: r.inSeason,
    recipe: r.items, recipeOk: r.ok, service: serviceInfo(s), spotId: e?.spotId || null, where: e?.spotId ? whereText(state, e.spotId) : null,
    hint: st !== 'unknown' ? s.hint : null, hintIcon: s.hintIcon, anecdote: st === 'installed' ? s.anecdote : null, firstMet: s.firstMet || null,
    group: s.group || 'v1', ...(s.welcome ? { welcome: s.welcome } : {}),
  };
}

function natureInfo(state, item) {
  const v = V(state);
  const spots = spotsOf(state, item.id);
  const reason = natureLock(state, item.id);
  return {
    kind: item.id, name: item.name, icon: item.icon, text: item.text, price: naturePrice(state, item.id), rank: item.rank,
    locked: !!reason && !/Pas assez/.test(reason), reason, placed: spots.filter((x) => x.placed).length,
    freeSpots: spots.filter((x) => !x.placed).length, reserve: v.reserve[item.id] || 0, bought: v.bought[item.id] || 0,
  };
}

/** (V2) Les 12 voisins du troc (fiche de la Grainothèque). */
function swapsInfo(state) {
  const v = V(state);
  const list = TROC.order.map((o) => {
    const x = VILLAGE_VARIETIES_BY_ID[o.varietyId];
    const done = v.swaps[o.clientId] || null;
    const given = done ? { varietyId: done.given, name: varietyName(state, done.given) } : null;
    return {
      ...clientInfo(o.clientId), varietyId: x.id, varietyName: x.name, icon: x.icon, done: !!done, given, fav: !!done?.fav, circle: o.circle,
      locked: done ? null : trocLock(state, o), waiting: v.troc?.clientId === o.clientId,
    };
  });
  return { done: list.filter((x) => x.done).length, total: TROC.order.length, list };
}

/** (V2) Les 11 croisements (fiche de la Grainothèque). */
function crossesInfo(api) {
  const { state } = api;
  const v = V(state);
  const links = crossLinks(state);
  return CROSSES.map((cr) => {
    const c = v.crosses[cr.cropId];
    const e = v.varieties[cr.id];
    const st = pairStatus(state, cr.cropId);
    return {
      cropId: cr.cropId, id: cr.id, name: e ? varietyName(state, cr) : '?', icon: cr.icon,
      parents: cr.parents.map((id) => {
        const x = ALL_VARIETIES_BY_ID[id];
        const pe = v.varieties[id];
        return { varietyId: id, name: pe ? x.name : getCrop(x.cropId).name, icon: x.icon, have: canSupply(state, id), fixed: !!pe?.fixedAt, known: !!pe, group: x.group };
      }),
      traits: traitInfos(cr), meet: c?.meet || 0, need: crossNeedOf(state), found: !!c?.foundAt, fixed: !!e?.fixedAt, hand: e?.hand || 0, seeds: v.seeds[cr.id] || 0,
      linked: links.some((l) => l.cropId === cr.cropId), canPair: st.canPair, reason: st.reason,
    };
  });
}

function valleyQuery(api) {
  const { state } = api;
  const v = V(state);
  if (!v) return null;
  if (!v.started) return { started: null, startsAtRank: VALLEY_START.rank };
  const signs = signsOfLife(state);
  const st = STAGES[v.stage];
  const next = STAGES[v.stage + 1] || null;
  const counts = habitatCounts(state);
  const jars = (state.career.heirlooms || []).slice(v.jars.opened).map((j, k) => ({
    index: v.jars.opened + k, cropId: j.cropId, label: VARIETIES_BY_ID[VARIETY_OF_CROP[j.cropId]]?.label || null, from: j.from || 'find',
  }));
  const items = NATURE_ITEMS.filter((it) => !it.heritage || heritagePartOn(state)).map((it) => natureInfo(state, it));
  const v2 = heritagePartOn(state);
  const out = {
    started: clone(v.started),
    parts: { ...v.parts },
    stage: { n: v.stage, name: st.name, signs, total: v2 ? SIGNS_ALL : SIGNS_V1, next: next ? { n: next.n, name: next.name, signs: next.signs } : null, vignette: `valley.stage.${v.stage}`, reward: clone(st.reward) },
    hint: nextHint(state),
    chapters: STAGES.map((s) => ({ n: s.n, title: s.chapter.title, lines: [...s.chapter.lines], read: v.chapters.read.includes(s.n), available: s.n <= v.stage })),
    jars: { pending: jars.length, list: jars },
    varieties: partVarieties(state).map((x) => varietyInfo(api, x)),
    species: partSpecies(state).map((s) => speciesInfo(state, s, counts)),
    nature: { items, free: items.reduce((a, x) => a + x.freeSpots, 0), placed: Object.keys(v.nature).length },
    finds: v.finds.map((f) => ({ id: f.id, kind: f.kind, name: HEDGE_FINDS_BY_ID[f.kind].name, icon: HEDGE_FINDS_BY_ID[f.kind].icon, spotId: f.spotId })),
    fair: fairInfo(state),
    services: valleyServices(state),
    year: clone(v.year),
    stats: clone(v.stats),
    spent: v.spent,
    fixed: fixedVarieties(state),
    installed: installedSpecies(state),
    heritage: v2,
  };
  if (!v2) return out;
  return {
    ...out,
    library: libraryInfo(state),
    troc: v.parts.seeds ? swapInfo(state) : null,
    swaps: swapsInfo(state),
    crosses: crossesInfo(api),
    box: boxInfo(state),
    stories: storiesInfo(state),
    crossRule: HERITAGE_TEXTS.crossRule,
  };
}

function valleySpotsQuery(api, kind = null) {
  const { state } = api;
  const v = V(state);
  if (!v?.started) return [];
  return spotsOf(state, kind).map((x) => {
    const lock = natureLock(state, x.kind);
    const price = naturePrice(state, x.kind);
    let reason = x.placed ? 'Déjà aménagé.' : lock;
    if (!reason && state.money < price) reason = notEnough(price - state.money);
    const extra = x.kind === 'loneTree' && x.placed ? { stage: loneTreeStage(state, v.nature[x.spotId]) } : {};
    return { spotId: x.spotId, lotId: x.lotId, lotName: x.lotName, slot: x.slot, kind: x.kind, label: spotLabel(state, x.spotId), placed: x.placed, free: !x.placed, price, canPlace: !reason, reason, ...extra };
  });
}

/** Habitants du jour (« présent » : hachage pur du jour et de l'espèce, sans flux aléatoire ; 6 au plus, V2 compris). */
function valleyAnimalsQuery(api) {
  const { state } = api;
  const v = V(state);
  if (!v?.started || !v.parts.wildlife) return [];
  const out = [];
  const abs = absDay(state);
  const list = partSpecies(state);
  for (const s of list) {
    const e = v.species[s.id];
    if (!e) continue;
    if (e.state === 'hint' && e.since === abs) out.push({ id: s.id, spotId: e.spotId, state: 'hint', hintIcon: s.hintIcon });
    else if (e.state === 'visible') out.push({ id: s.id, spotId: e.spotId, state: 'visible' });
  }
  let residents = 0;
  for (const s of list) {
    const e = v.species[s.id];
    if (e?.state !== 'installed' || !s.seasons.includes(seasonIdOf(state))) continue;
    if (residents >= 6) break;
    if (hashSeed(abs, s.id) % 100 >= 60) continue;
    residents += 1;
    out.push({ id: s.id, spotId: speciesSpot(state, s.id), state: 'resident' });
  }
  return out;
}

/** Champs en plus de query.plot(i) (carrière, Vallée active). */
export function valleyPlotExtras(api, i) {
  const { state } = api;
  const v = valleyOf(state);
  if (!v) return {};
  const p = state.plots[i];
  const x = varietyOf(p);
  let variety = null;
  if (x) {
    const e = v.varieties[x.id];
    const tree = isTreeCrop(getCrop(x.cropId));
    const link = crossLinkOf(state, x);
    let cross = null;
    if (link && !link.found) {
      const k = plotNeighbours(state, i).find((j) => state.plots[j]?.cropId && state.plots[j].variety === link.partnerId);
      cross = { partnerId: link.partnerId, partnerName: link.partnerName, meet: link.meet, need: link.need, linked: k !== undefined, partnerPlot: k ?? null, cropId: link.cropId, partnerKnown: !!v.varieties[link.partnerId] };
    }
    variety = {
      id: x.id, name: varietyName(state, x), g: x.g, icon: x.icon, ripeIcon: x.ripe, tint: x.tint, trait: traitInfo(x.trait), trial: !e?.fixedAt, hand: e?.hand || 0,
      need: fixHandOf(state), seedsOnHand: handSeedsOf(state, tree), unit: tree ? 'greffon' : 'graine', group: x.group || 'pays', traits: traitInfos(x), cross,
    };
  }
  const fallow = p.fallow !== undefined ? { until: p.fallow, text: `Jachère fleurie jusqu'à la fin ${({ spring: 'du printemps', summer: 'de l\'été', autumn: 'de l\'automne', winter: 'de l\'hiver' })[seasonIdOf(state)]} · ensuite : sol reposé (+ ${v.stage >= 4 ? 20 : 10} % de pousse)` } : null;
  return { variety, fallow, rested: !!p.rested };
}

/** Lignes en plus de query.plantableCrops(i) : variétés anciennes et jachère fleurie. */
export function valleyPlantable(api, i) {
  const { state } = api;
  const v = valleyOf(state);
  if (!v || !v.started || !v.parts.seeds) return null;
  const p = Number.isInteger(i) ? state.plots[i] : null;
  const sid = seasonIdOf(state);
  const v2 = heritageSeedsOn(state);
  const heirlooms = [];
  for (const x of partVarieties(state)) {
    const e = v.varieties[x.id];
    if (!e) continue;
    const crop = getCrop(x.cropId);
    const tree = isTreeCrop(crop);
    if (p && (tree ? p.env !== 'orchard' : p.env === 'orchard')) continue;
    const fixed = !!e.fixedAt;
    const seeds = v.seeds[x.id] || 0;
    const cost = seeds > 0 ? 0 : fixed ? heirloomSeedCost(api, x.id) : null;
    let reason = null;
    if (!(p && inGreenhouse(p)) && !crop.seasons.includes(sid)) reason = `${crop.name} ne se sème pas ${SEASON_IN[sid]}.`;
    else if (p && p.cropId) reason = 'Cette parcelle n\'est pas libre.';
    else if (seeds <= 0 && !fixed) reason = noSeedsText(state, x, tree);
    else if (cost > state.money) reason = notEnough(cost - state.money);
    const row = { varietyId: x.id, cropId: x.cropId, name: varietyName(state, x), icon: x.icon, trait: traitInfo(x.trait), seeds, fixed, cost, canSow: !reason, reason, trial: !fixed, tree };
    if (heritagePartOn(state)) {
      row.group = x.group || 'pays';
      row.traits = traitInfos(x);
      row.pair = null;
      const link = v2 && x.group !== 'cross' ? partnerOf(x.id) : null;
      if (link && !v.crosses[link.cropId]?.foundAt) {
        const st = pairStatus(state, link.cropId);
        let pr = st.reason;
        if (st.canPair && p) {
          if (p.cropId) pr = 'Cette parcelle n\'est pas libre.';
          else if (pairPartnerPlot(state, i, crop) < 0) pr = 'Il faut une parcelle libre juste à côté.';
          else if (!inGreenhouse(p) && !crop.seasons.includes(sid)) pr = `${crop.name} ne se sème pas ${SEASON_IN[sid]}.`;
        }
        row.pair = { canPair: !pr, reason: pr, cropId: link.cropId, partnerId: link.partnerId };
      }
    }
    heirlooms.push(row);
  }
  let fallowReason = null;
  if (!p) fallowReason = 'Touchez une parcelle de champ vide.';
  else if (p.env !== 'field' || p.cropId) fallowReason = 'Une jachère se fait sur une parcelle de champ vide.';
  else if (p.fallow !== undefined) fallowReason = 'Déjà en jachère.';
  return { heirlooms, fallow: { canSow: !fallowReason, reason: fallowReason, growth: v.stage >= 4 ? 0.2 : 0.1 } };
}

/** Contexte des succès et de l'album (query.achievementContext().career.valley). */
export function valleyAchievementContext(state) {
  const v = valleyOf(state);
  if (!v) return null;
  const fixed = fixedVarieties(state);
  const installed = installedSpecies(state);
  const group = (id) => ALL_VARIETIES_BY_ID[id]?.group || 'pays';
  return {
    started: !!v.started, fixed, installed, stage: v.stage, jars: v.stats.jars, hand: v.stats.hand,
    // (V2) trocs faits (voisins), croisements trouvés, niveau de la Grainothèque ; comptes par groupe (succès).
    swaps: Object.keys(v.swaps || {}),
    swapsFav: Object.entries(v.swaps || {}).filter(([, e]) => e.fav).map(([id]) => id),
    crossesFound: CROSSES.filter((c) => v.crosses?.[c.cropId]?.foundAt).map((c) => c.id),
    library: libraryLevelOf(state),
    fixedPays: fixed.filter((id) => group(id) === 'pays').length,
    fixedVillage: fixed.filter((id) => group(id) === 'village').length,
    fixedCross: fixed.filter((id) => group(id) === 'cross').length,
    installedV1: installed.filter((id) => SPECIES_BY_ID[id]).length,
    installedV2: installed.filter((id) => !SPECIES_BY_ID[id]).length,
  };
}

/** Emplacements d'un terrain (query.career.lot(id).nature). */
export function lotNature(state, lotId) {
  const v = valleyOf(state);
  if (!v) return null;
  return spotsOf(state).filter((x) => x.lotId === lotId).map((x) => ({ spotId: x.spotId, slot: x.slot, kind: x.kind, placed: x.placed, label: spotLabel(state, x.spotId) }));
}

// ── Extension ──────────────────────────────────────────────────────────────────────────────

export const valleyExtension = {
  id: 'valley',
  init(state) {
    if (state.career.valley === undefined) enableCareerValley(state, true);
    else if (state.career.valley) ensureRng(state);
  },
  migrate(state) {
    // Carrière d'avant la Vallée : elle s'active à la reprise (rang ≥ 2 : la boîte de Joseph à la première aube ; les
    // bocaux déjà trouvés sont à ouvrir). null : désactivée, gardé tel quel.
    if (!state.career || !state.rng || typeof state.rng !== 'object') return;
    if (state.career.valley === undefined) enableCareerValley(state, true);
    else if (state.career.valley) {
      completeValley(state.career.valley);
      ensureRng(state);
    }
  },
  check(state) {
    return checkValley(state);
  },
  hooks: {
    dawnEvents: (api) => dawnEvents(api),
    incomes: (api, ctx) => beeIncome(api, ctx),
    dawn: (api) => updateStage(api),
    yearEnd,
  },
  providers: {
    effects(state, key) {
      if (!state.career?.valley) return 0;
      if (key === 'growthBonus') return growthBonusOf(state);
      if (key === 'animalBonus') return animalBonusOf(state);
      if (key === 'touristBonus') return touristBonusOf(state);
      return 0;
    },
    patrimony(state) {
      return state.career?.valley ? state.career.valley.spent || 0 : 0;
    },
    unlocks(rank) {
      // (V2) La Grainothèque au rang 3 ; le nichoir à chauves-souris (rang 4) vient avec les aménagements.
      const out = rank === SEED_LIBRARY.siteRank ? [{ kind: 'valley', id: 'seedLibrary', name: SEED_LIBRARY.name }] : [];
      return [...out, ...NATURE_ITEMS.filter((n) => n.rank === rank).map((n) => ({ kind: 'nature', id: n.id, name: n.name }))];
    },
  },
  actions: (api) => ({
    openJar: () => openJar(api),
    sowHeirloom: (plotIndex, varietyId) => valleySow(api, plotIndex, varietyId, { by: 'player' }),
    sowFallow: (plotIndex) => sowFallow(api, plotIndex),
    placeNature: (spotId, kind) => placeNature(api, spotId, kind),
    observe: (speciesId) => observe(api, speciesId),
    pickHedgeFind: (findId) => pickHedgeFind(api, findId),
    buyFairHeirloom: () => buyFairHeirloom(api),
    readChapter: (n) => readChapter(api, n),
    triggerValley: (kind, arg, arg2) => triggerValley(api, kind, arg, arg2),
    // (V2)
    buildSeedLibrary: () => buildSeedLibrary(api),
    swapSeeds: (varietyId) => swapSeeds(api, varietyId),
    sowPair: (plotIndex, cropId) => sowPair(api, plotIndex, cropId),
    readStory: (id) => readStory(api, id),
  }),
  queries: (api) => ({
    valley: () => valleyQuery(api),
    valleySpots: (kind) => valleySpotsQuery(api, kind ?? null),
    valleyAnimals: () => valleyAnimalsQuery(api),
    // (V2)
    valleyCrossLinks: () => (valleyOf(api.state) ? crossLinks(api.state) : []),
    valleyPairPlots: (cropId) => (heritageSeedsOn(api.state) ? pairPlots(api.state, cropId) : []),
  }),
};

