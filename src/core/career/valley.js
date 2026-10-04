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
//
// (V3, « Le ruisseau », partie `places`) Vue de la vallée (ouverte à l'étape 5, récit « Sur la colline »), 6 lieux en 19
// étapes (chantier payé + condition de vie + reprise en saisons, un chantier par lieu), 10 habitants de la vallée (flux
// NOUVEAU state.rng.valley3 : 10 nombres par aube une fois la vue ouverte ; 3 nombres par aube d'automne pour les
// champignons dès l'étape 2 du bois ; 2 nombres par pêche au ruisseau ; rien d'autre), pêche au ruisseau, champignons,
// Reinette grise, cerisier et poirier, terres sauvages (après le 16ᵉ terrain), étapes 6 et 7, 8 récits. Lectures pures :
// src/core/career/places.js ; données : src/data/career/places.js ; contrat : docs/ARCHITECTURE.md, « Vallée vivante —
// contrats du lot V3 ». Avec { places: false } : le V1 + V2 exactement (aucun tirage valley3, aucune règle du V3).
//
// (V4, « Les cigognes », partie `storks`) 4 légendes sous cloche (jamais vendues), 6 visiteurs rares (flux NOUVEAU
// state.rng.valley4 : 5 nombres par aube une fois la vue ouverte, rien d'autre ; les cigognes sont déterministes), l'étape
// 8, le nid sur la maison, 5 récits et l'épilogue de Joseph, le livre de la vallée, les cartes des vallées voisines, les
// faits sonores. DÉCORATIF : aucune action du V4 ne gagne ni ne dépense une pièce. Lectures pures : src/core/career/storks.js ;
// données : src/data/career/storks.js ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V4 ». Avec
// { storks: false } : le V1 + V2 + V3 exactement (aucun tirage valley4, aucune règle du V4).

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { careerFactor } from '../../data/cozy.js';
import {
  ALL_SPECIES, ALL_SPECIES_BY_ID, ALL_VARIETIES, ALL_VARIETIES_BY_ID, ARRIVAL, FAIR_STALL, HEDGE_FINDS, HEDGE_FINDS_BY_ID, HEDGE_FIND_RULES,
  JOSEPH_BOX, MAX_STAGE, MAX_STAGE_ALL, MAX_STAGE_V3, NATURE_ITEMS, NATURE_ITEMS_BY_ID, SEED_RULES, SIGNS_ALL, SIGNS_ALL_V3, SIGNS_V1, SPECIES, SPECIES_BY_ID, STAGES, STAGES_ALL, TRAITS_BY_ID,
  VALLEY_PARTS, VALLEY_START, VALLEY_TEXTS, VALLEY_VERSION, VARIETIES, VARIETIES_BY_ID, VARIETY_OF_CROP, agreeWith, savedText,
} from '../../data/career/valley.js';
import {
  MUSHROOMS, MUSHROOMS_BY_ID, MUSHROOM_RULES, ORCHARD_VARIETIES_BY_ID, PLACES, PLACES_BY_ID, PLACES_OPEN, PLACES_TEXTS, PLACE_MAX, STORIES_V3, STORIES_V3_BY_ID,
  VALLEY_SPECIES, VALLEY_SPECIES_BY_ID, WILD_KINDS, WILD_KINDS_BY_ID, WILD_RULES,
} from '../../data/career/places.js';
import { inLotGrid, lotCellOf, lotNameAt } from '../../data/career/lots.js';
import {
  CROP_LOVE, CROSSES, CROSS_RULES, HERITAGE_TEXTS, LIBRARY_MAX, SEED_LIBRARY, SPECIES_V2, STORIES_BY_ID, TROC, TROC_BY_CLIENT,
  VILLAGE_VARIETIES_BY_ID,
} from '../../data/career/heritage.js';
import { hashSeed, stream } from '../rng.js';
import { absDay } from '../surprises.js';
import { inGreenhouse } from '../farm.js';
import { treeSeedCost } from '../trees.js';
import {
  animalBonusOf, crossFactorOf, crossNeedOf, fishFactor, fixHandOf, fixedSeedCost, growthBonusOf, handSeedsOf, hedgeCoinsFactorOf, hedgeFindsMaxOf, heritagePartOn, isFixed,
  libraryLevelOf, meadowHivesOf, millPlacesOf, partOn, placeStepOf, placesOn, seasonAbs, speciesInPart, speciesInstalled, touristBonusOf, valleyOf, varietyInPart, varietyName, varietyOf,
} from './heirlooms.js';
import {
  canStartWorks, mushroomSeason, mushroomsInfo, placeInfo, placesInfo, riverFishTable, riverInfo, stageNeedText, unreadV3, viewInfo, viewOpen, wildCellInfo, wildCells,
  wildEligible, wildOpen, wildPrice, wildStageAt, wildTotal,
} from './places.js';
import { themeFishFactor } from './themes.js';
import { weatherWaters } from '../weather.js';
import {
  DRAWN_VISITORS, EPILOGUE, LEGENDS, LEGENDS_BY_ID, LEGEND_RULES, POSTCARDS, POSTCARDS_BY_ID, STAGE_V4, STORIES_V4, STORIES_V4_BY_ID, STORK_RULES, STORKS_TEXTS,
  VISITORS, VISITORS_BY_ID, VISITOR_RULES,
} from '../../data/career/storks.js';
import {
  benchLine, bookOf, chicksText, chronicle, clocheInfo, creditsInfo, epilogueInfo, epiloguePages, fill as fillText, glowSpot, isStorkDay, legendName, legendWakeOk, legendsInfo,
  nextPostcard, postcardsInfo, reconstructStageAt, sceneryOf, seenVisitors, soundFacts, sowLegendReason, springDayText, stage8Ok, storkDay, storkInfo, storkNeedText,
  storkNeedsOk, storksOn, valleyComplete, viewExtras, visitorRecipe, visitorSpot, visitorsInfo,
} from './storks.js';
import {
  beePlotsGrowing, fixedVarieties, habitatCounts, installedSpecies, loneTreeStage, naturePrice, nextHint, recipeStatus, seasonsText, seasonsWhen,
  signsOfLife, speciesSpot, spotDef, spotLabel, spotsOf, stageFor, stageSignsOf, stagesOf, stageTarget, valleyServices, whereText, granaryBuilt,
} from './habitat.js';
import {
  boxInfo, canSupply, clientInfo, crossLinks, crossOfCrop, farmOf, heritageSeedsOn, isFavGift, libraryInfo, nextTrocClient,
  pairPartnerPlot, pairPlots, pairStatus, partnerOf, plotNeighbours, savedVarieties, storiesInfo, swapInfo, traitInfos, trocGifts, trocLock,
  trocRemaining, unitOf,
} from './heritage.js';

/** (V3) Tous les récits par identifiant (V2, V3 ; (V4) récits des cigognes). */
const STORY_BY_ID = { ...STORIES_BY_ID, ...STORIES_V3_BY_ID, ...STORIES_V4_BY_ID };

const clone = (o) => JSON.parse(JSON.stringify(o));
const SEASON_IN = { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' };
const FROM = ['box', 'jar', 'fair', 'jay', 'swap', 'cross', 'debug', 'orchard'];
const SPECIES_STATES = ['hint', 'visible', 'installed'];
const STAGE_NAMES = STAGES.map((s) => s.name);

// ── État ────────────────────────────────────────────────────────────────────────────────────

function emptyYear() {
  return {
    hand: 0, seedsSaved: 0, fixed: 0, installed: 0, placed: 0, finds: 0, jars: 0, spent: 0, swaps: 0, meets: 0, crosses: 0, heirloomCrops: [],
    // (V3) chantiers lancés, étapes de lieux atteintes, habitants de la vallée, terres confiées, pêches au ruisseau, champignons.
    works: 0, recovered: 0, valleyInstalled: 0, wilds: 0, river: 0, riverIncome: 0, mushrooms: 0,
    // (V4) légendes réveillées et récoltées, visiteurs vus, cigogneaux, cartes reçues.
    legends: 0, legendHarvests: 0, visitorsSeen: 0, chicks: 0, postcards: 0,
  };
}

function emptyStats() {
  return {
    hand: 0, seedsSaved: 0, observed: 0, placed: 0, jars: 0, fallows: 0, finds: {}, swaps: 0, meets: 0, crosses: 0, pairs: 0,
    works: 0, recovered: 0, river: 0, riverIncome: 0, mushrooms: 0, wilds: 0, visits: 0,
    legendHarvests: 0, visitorsSeen: 0, storkYears: 0, postcards: 0, credits: 0, bookOpened: 0,
  };
}

/** (V4) Champs du V4 (légendes, cloches, Merveille, visiteurs, cigognes, épilogue, cartes, jours des étapes). */
function emptyStorks() {
  return {
    legends: {}, cloches: {}, marvel: { gens: 0, lastYear: 0 }, visitors: {},
    stork: { steepleAt: null, seenAt: null, wheelAt: null, farmSince: null, years: {} },
    epilogue: { availableAt: null, readAt: null, creditsAt: null }, postcards: { sent: null, got: [] }, stageAt: {}, rainedAt: null,
  };
}

/** (V3) Champs du V3 (vue, lieux, terres sauvages, pêche, champignons). */
function emptyPlaces() {
  return { view: { open: false, openedAt: null, visits: 0 }, places: {}, wilds: {}, wildBought: 0, river: { fishedDay: 0 }, mushrooms: [] };
}

/** Champs du V2 (Grainothèque, troc, croisements, récits). */
function emptyHeritage() {
  return { library: null, site: false, troc: null, trocSeason: -1, trocFairYear: 0, swaps: {}, crosses: {}, stories: { available: [], read: [] } };
}

/** Parties actives : true → toutes ; { seeds, wildlife } → absentes = true. (V3) `places` n'existe pas sans `heritage`. */
export function normalizeValleyParts(opt) {
  const o = opt && typeof opt === 'object' ? opt : {};
  const parts = Object.fromEntries(VALLEY_PARTS.map((k) => [k, o[k] !== false]));
  if (!parts.heritage) parts.places = false;
  // (V4) `storks` n'existe pas sans `places`.
  if (!parts.places) parts.storks = false;
  return parts;
}

export function newValleyState(parts = normalizeValleyParts(true)) {
  return {
    v: VALLEY_VERSION, parts, started: null, stage: 0, chapters: { read: [] }, spent: 0, jars: { opened: 0 }, seeds: {}, varieties: {},
    nature: {}, reserve: {}, bought: {}, species: {}, finds: [], jayYear: 0, fair: null, year: emptyYear(), stats: emptyStats(), nextId: 1,
    ...emptyHeritage(),
    ...emptyPlaces(),
    ...emptyStorks(),
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
  // (V3) Flux des habitants de la vallée, des champignons et de la pêche au ruisseau : seulement avec la partie `places`.
  const parts = state.career?.valley?.parts;
  if (parts && parts.heritage !== false && parts.places !== false && !Number.isInteger(state.rng.valley3)) state.rng.valley3 = hashSeed(state.seed, 'valley3');
  // (V4) Flux des visiteurs rares : seulement avec la partie `storks`.
  if (parts && parts.heritage !== false && parts.places !== false && parts.storks !== false && !Number.isInteger(state.rng.valley4)) state.rng.valley4 = hashSeed(state.seed, 'valley4');
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
  // (V3) Vue, lieux, terres sauvages, pêche, champignons (rien n'est retiré ni réinterprété ; l'étape garde sa valeur).
  if (!v.view || typeof v.view !== 'object') v.view = { open: false, openedAt: null, visits: 0 };
  for (const k of ['places', 'wilds']) if (!v[k] || typeof v[k] !== 'object' || Array.isArray(v[k])) v[k] = {};
  if (!Number.isInteger(v.wildBought)) v.wildBought = Object.keys(v.wilds).length;
  if (!v.river || typeof v.river !== 'object') v.river = { fishedDay: 0 };
  if (!Array.isArray(v.mushrooms)) v.mushrooms = [];
  // (V4) Légendes, visiteurs, cigognes, épilogue, cartes, jours des étapes (stageAt reconstruit par migrate).
  for (const k of ['legends', 'cloches', 'visitors', 'stageAt']) if (!v[k] || typeof v[k] !== 'object' || Array.isArray(v[k])) v[k] = {};
  if (!v.marvel || typeof v.marvel !== 'object') v.marvel = { gens: 0, lastYear: 0 };
  if (!v.stork || typeof v.stork !== 'object') v.stork = { steepleAt: null, seenAt: null, wheelAt: null, farmSince: null, years: {} };
  if (!v.stork.years || typeof v.stork.years !== 'object') v.stork.years = {};
  if (!v.epilogue || typeof v.epilogue !== 'object') v.epilogue = { availableAt: null, readAt: null, creditsAt: null };
  if (!v.postcards || typeof v.postcards !== 'object' || !Array.isArray(v.postcards.got)) v.postcards = { sent: null, got: [] };
  if (v.rainedAt === undefined) v.rainedAt = null;
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
  if (!obj(v.parts) || !VALLEY_PARTS.every((k) => typeof v.parts[k] === 'boolean' || (k === 'heritage' && v.parts[k] === undefined && v.v === 1) || (k === 'places' && v.parts[k] === undefined && v.v <= 2) || (k === 'storks' && v.parts[k] === undefined && v.v <= 3))) return 'Vallée (parties)';
  if (v.started !== null && !(obj(v.started) && int(v.started.year, 1) && int(v.started.day, 1) && int(v.started.abs, 1))) return 'Vallée (début)';
  // Paliers du V1 (les plus bas) : une étape atteinte avant le recalage du V2 reste valide (elle ne recule jamais).
  // (V3) Étapes 6 et 7 : seulement avec la partie `places`, signes de vie et conditions de lieux remplis.
  if (!int(v.stage, 0, MAX_STAGE_ALL)) return 'Vallée (étape)';
  if (v.stage <= MAX_STAGE && v.stage > stageFor(signsOfLife(state))) return 'Vallée (étape)';
  if (v.stage > MAX_STAGE && (!placesOn(state) || v.stage > stageTarget(state))) return 'Vallée (étape)';
  if (!obj(v.chapters) || !Array.isArray(v.chapters.read) || !v.chapters.read.every((n) => int(n, 0, MAX_STAGE_ALL))) return 'Vallée (chapitres)';
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
  return checkHeritage(state, v, obj, int) || checkPlaces(state, v, obj, int) || checkStorks(state, v, obj, int);
}

/** (V4) Vérification des champs du V4 (une sauvegarde V1, V2 ou V3, sans eux, reste valide). */
function checkStorks(state, v, obj, int) {
  const day = (x) => x === null || x === undefined || Number.isInteger(x);
  if (v.stage === STAGE_V4.n && !(storksOn(state) && v.stork?.seenAt)) return 'Vallée (étape 8 sans cigognes vues)';
  if (v.legends !== undefined) {
    if (!obj(v.legends)) return 'Vallée (légendes)';
    for (const [id, e] of Object.entries(v.legends)) if (!LEGENDS_BY_ID[id] || !obj(e) || !Number.isInteger(e.awokeAt) || !int(e.harvests) || !day(e.firstAt)) return `Vallée (légende ${id})`;
  }
  if (v.cloches !== undefined) {
    if (!obj(v.cloches)) return 'Vallée (cloches)';
    for (const [id, c] of Object.entries(v.cloches)) {
      if (c === null) continue;
      if (!LEGENDS_BY_ID[id] || !v.legends?.[id] || !obj(c) || !Number.isInteger(c.sownAt) || !Number.isInteger(c.readyAt) || c.sownAt > c.readyAt || typeof c.ripe !== 'boolean') return `Vallée (cloche ${id})`;
    }
  }
  if (v.marvel !== undefined && !(obj(v.marvel) && int(v.marvel.gens, 0, LEGEND_RULES.marvel.gens) && int(v.marvel.lastYear))) return 'Vallée (Merveille)';
  if (v.visitors !== undefined) {
    if (!obj(v.visitors)) return 'Vallée (visiteurs)';
    for (const [id, e] of Object.entries(v.visitors)) {
      if (!VISITORS_BY_ID[id] || !obj(e) || !['hint', 'visible', 'seen'].includes(e.state) || !Number.isInteger(e.since) || (e.state === 'seen' && !Number.isInteger(e.at))) return `Vallée (visiteur ${id})`;
    }
  }
  if (v.stork !== undefined) {
    const k = v.stork;
    if (!obj(k) || !['steepleAt', 'seenAt', 'wheelAt', 'farmSince'].every((f) => day(k[f])) || !obj(k.years)) return 'Vallée (cigognes)';
    if (k.seenAt != null && (k.steepleAt == null || k.seenAt < k.steepleAt)) return 'Vallée (cigognes vues)';
    if (k.farmSince != null && k.wheelAt == null) return 'Vallée (nid sans roue)';
    for (const [y, e] of Object.entries(k.years)) {
      if (!/^\d+$/.test(y) || !obj(e) || !Number.isInteger(e.arrived) || !int(e.chicks, 0, STORK_RULES.chicksMax) || !day(e.left)) return `Vallée (cigognes de l'an ${y})`;
    }
  }
  if (v.epilogue !== undefined) {
    const e = v.epilogue;
    if (!obj(e) || !day(e.availableAt) || !day(e.readAt) || !day(e.creditsAt) || (e.readAt != null && e.availableAt == null)) return 'Vallée (épilogue)';
  }
  if (v.postcards !== undefined) {
    const p = v.postcards;
    if (!obj(p) || !Array.isArray(p.got)) return 'Vallée (cartes)';
    const ids = p.got.map((g) => g?.id);
    if (!p.got.every((g) => obj(g) && POSTCARDS_BY_ID[g.id] && Number.isInteger(g.at) && typeof g.read === 'boolean') || new Set(ids).size !== ids.length) return 'Vallée (cartes reçues)';
    if (!ids.every((id, k) => id === POSTCARDS[k].id)) return 'Vallée (ordre des cartes)';
    if (p.sent !== null && p.sent !== undefined && !(obj(p.sent) && POSTCARDS_BY_ID[p.sent.id] && !ids.includes(p.sent.id) && Number.isInteger(p.sent.at) && Number.isInteger(p.sent.arrives))) return 'Vallée (carte en route)';
  }
  if (v.stageAt !== undefined) {
    if (!obj(v.stageAt)) return 'Vallée (jours des étapes)';
    for (const [n, e] of Object.entries(v.stageAt)) if (!/^\d$/.test(n) || Number(n) > MAX_STAGE_ALL || !obj(e) || !Number.isInteger(e.abs)) return 'Vallée (jour d\'une étape)';
  }
  if (v.rainedAt !== undefined && !day(v.rainedAt)) return 'Vallée (pluie)';
  return null;
}

/** (V3) Vérification des champs du V3 (une sauvegarde V1 ou V2, sans eux, reste valide). */
function checkPlaces(state, v, obj, int) {
  if (v.view !== undefined && !(obj(v.view) && typeof v.view.open === 'boolean' && (v.view.openedAt === null || int(v.view.openedAt, 1)) && int(v.view.visits))) return 'Vallée (vue)';
  if (v.places !== undefined) {
    if (!obj(v.places)) return 'Vallée (lieux)';
    for (const [id, e] of Object.entries(v.places)) {
      const p = PLACES_BY_ID[id];
      if (!p || !obj(e) || !int(e.step, 0, PLACE_MAX[id]) || !obj(e.steps)) return `Vallée (lieu ${id})`;
      const keys = Object.keys(e.steps).map(Number);
      if (keys.length !== e.step || !keys.every((n) => n >= 1 && n <= e.step) || !Object.values(e.steps).every((d) => int(d, 1))) return `Vallée (étapes du lieu ${id})`;
      if (e.works !== null && e.works !== undefined) {
        const w = e.works;
        if (!obj(w) || w.step !== e.step + 1 || !int(w.startedAt, 1) || !int(w.readyAt, 1) || w.startedAt > w.readyAt || !(typeof w.cost === 'number' && w.cost >= 0)) return `Vallée (chantier ${id})`;
      }
    }
  }
  if (v.wilds !== undefined) {
    if (!obj(v.wilds) || Object.keys(v.wilds).length > 34) return 'Vallée (terres sauvages)';
    const owned = new Set(state.career.lots.map((l) => l.id));
    for (const [cellId, e] of Object.entries(v.wilds)) {
      const cell = lotCellOf(cellId);
      if (!cell || !inLotGrid(cell.col, cell.row) || owned.has(cellId) || !obj(e) || !WILD_KINDS_BY_ID[e.kind] || e.col !== cell.col || e.row !== cell.row || !Number.isInteger(e.at)) return `Vallée (terre sauvage ${cellId})`;
    }
    if (v.wildBought !== undefined && v.wildBought !== Object.keys(v.wilds).length) return 'Vallée (terres confiées)';
  }
  if (v.river !== undefined && !(obj(v.river) && int(v.river.fishedDay))) return 'Vallée (ruisseau)';
  if (v.mushrooms !== undefined) {
    if (!Array.isArray(v.mushrooms) || v.mushrooms.length > MUSHROOM_RULES.max) return 'Vallée (champignons)';
    for (const m of v.mushrooms) if (!obj(m) || typeof m.id !== 'string' || !MUSHROOMS_BY_ID[m.kind] || !int(m.spot, 0, MUSHROOM_RULES.spots - 1) || !int(m.day)) return 'Vallée (champignon)';
  }
  // Arbres du verger conservatoire : seulement au verger.
  for (const p of state.plots) if (p && (p.cropId === 'cherry' || p.cropId === 'pear') && p.env !== 'orchard') return 'Vallée (arbre du verger conservatoire)';
  return null;
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
    if (!v.stories.available.every((id) => STORY_BY_ID[id] || id === EPILOGUE.id) || !v.stories.read.every((id) => v.stories.available.includes(id))) return 'Vallée (récits)';
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
  // (V4) Le livre de la vallée commence ici (jour de l'étape 0).
  if (storksOn(state)) v.stageAt[0] = { abs };
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
  // (V4) Récits devenus disponibles ce matin (une légende ou un récit par aube, toutes parties confondues).
  const storiesBefore = v.stories?.available?.length || 0;
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
  let hinted = hintedV1;
  if (v.parts.heritage !== false) {
    siteDawn(api);
    if (v.parts.seeds) trocDawn(api);
    if (v.parts.wildlife) hinted = speciesDawn(api, SPECIES_V2, 'valley2', hintedV1);
  }
  // (V3) Ouverture de la vue, reprises des lieux, terres sauvages, champignons, habitants de la vallée (flux valley3).
  if (placesOn(state)) hinted = placesDawn(api, hinted);
  // (V4) Cigognes, légendes, cloches, cartes, visiteurs rares (flux valley4), après tout le reste.
  if (storksOn(state)) storksDawn(api, hinted, storiesBefore);
}

// ── (V3) Aube : la vallée ───────────────────────────────────────────────────────────────────

function rng3(state) {
  ensureRng(state);
  return stream(state.rng, 'valley3');
}

/** Récit du V3 disponible (une fois) : pousse storyAvailable. */
function pushStoryV3(api, id) {
  const v = V(api.state);
  if (!STORIES_V3_BY_ID[id] || v.stories.available.includes(id)) return null;
  v.stories.available.push(id);
  api.push('storyAvailable', { id, title: STORIES_V3_BY_ID[id].title });
  return id;
}

/**
 * Pose l'étape `step` d'un lieu (reprise terminée, ou débogage) : steps[step], Reinette grise au verger 1 (3 greffons),
 * récit du lieu à sa dernière étape → placeRecovered.
 */
function reachPlaceStep(api, placeId, step) {
  const { state } = api;
  const v = V(state);
  const p = PLACES_BY_ID[placeId];
  const abs = absDay(state);
  const e = v.places[placeId] || (v.places[placeId] = { step: 0, steps: {}, works: null });
  e.step = step;
  e.steps[step] = abs;
  if (e.works && e.works.step <= step) e.works = null;
  v.stats.recovered = (v.stats.recovered || 0) + 1;
  v.year.recovered = (v.year.recovered || 0) + 1;
  const st = p.steps[step];
  let grafts = null;
  if (st.boon.kind === 'graftReinette') {
    const x = ORCHARD_VARIETIES_BY_ID.reinetteGrise;
    addVariety(v, x.id, 'orchard', abs);
    v.seeds[x.id] = (v.seeds[x.id] || 0) + st.boon.value;
    grafts = { varietyId: x.id, name: x.name, n: st.boon.value };
  }
  const story = step >= PLACE_MAX[placeId] && st.story ? st.story : null;
  api.push('placeRecovered', {
    placeId, step, name: st.name, placeName: p.name, boon: { kind: st.boon.kind, text: st.boon.text }, species: [...(st.species || [])], story, line: st.line,
    ...(grafts ? { grafts } : {}), restored: step >= PLACE_MAX[placeId],
  });
  if (story) pushStoryV3(api, story);
}

function placesDawn(api, hintedBefore) {
  const { state } = api;
  const v = V(state);
  const abs = absDay(state);
  // 1. Ouverture : première aube où la vallée chante (étape ≥ 5).
  if (!v.view.open && v.stage >= PLACES_OPEN.stage) {
    v.view.open = true;
    v.view.openedAt = abs;
    api.push('valleyViewOpened', { first: true });
    pushStoryV3(api, 'hill');
  }
  if (!v.view.open) return hintedBefore;
  // 2. Reprises (ordre des lieux) : la condition n'est plus lue, la reprise va à son terme.
  for (const p of PLACES) {
    const e = v.places[p.id];
    if (e?.works && abs >= e.works.readyAt) reachPlaceStep(api, p.id, e.works.step);
  }
  // 3. Terres sauvages qui passent à l'état 1 ou 2 ce matin.
  for (const [cellId, e] of Object.entries(v.wilds)) {
    const now = wildStageAt(state, e, abs);
    if (now > wildStageAt(state, e, abs - 1)) api.push('wildLandGrown', { cellId, kind: e.kind, stage: now, name: lotNameAt(e.col, e.row) });
  }
  // 4. Champignons : effacés au 1er jour d'hiver ; en automne (bois ≥ 2), 3 nombres à chaque aube.
  if (state.time.seasonIndex === 3 && state.time.dayOfSeason === 1 && v.mushrooms.length) v.mushrooms = [];
  if (mushroomSeason(state)) mushroomDawn(api);
  // 5. Habitants de la vallée (10 nombres valley3) ; une seule venue annoncée par aube toutes espèces confondues.
  return v.parts.wildlife ? speciesDawn(api, VALLEY_SPECIES, 'valley3', hintedBefore) : hintedBefore;
}

// ── (V4) Aube : cigognes, légendes, cloches, cartes, visiteurs rares ───────────────────────

/** Marque de l'aube en cours (récits disponibles avant le V4) : lue par la fin de l'aube (épilogue). Pas dans l'état. */
const dawnMarks = new WeakMap();

/** Récit du V4 disponible (une fois) : pousse storyAvailable. */
function pushStoryV4(api, id) {
  const v = V(api.state);
  if (!STORIES_V4_BY_ID[id] || v.stories.available.includes(id)) return null;
  v.stories.available.push(id);
  api.push('storyAvailable', { id, title: STORIES_V4_BY_ID[id].title, v4: true });
  return id;
}

/** Une entrée d'année des cigognes sur la maison (créée à leur arrivée). */
function storkYearOf(v, year) {
  return v.stork.years[year] || null;
}

/** Les cigognes arrivent sur la roue de la maison (jour des cigognes, étape 8 passée). */
function storksToFarm(api) {
  const { state } = api;
  const v = V(state);
  const abs = absDay(state);
  const year = state.time.year;
  if (storkYearOf(v, year)) return false;
  v.stork.years[year] = { arrived: abs, chicks: 0, left: null };
  const first = !v.stork.farmSince;
  if (first) v.stork.farmSince = abs;
  v.stats.storkYears = (v.stats.storkYears || 0) + 1;
  api.push('storksArrived', { where: 'farm', first, day: storkDay(state), text: STORKS_TEXTS.storksHome });
  return true;
}

/** Les cigognes se posent sur le clocher (première fois : elles attendent qu'on vienne les voir). */
function storksToSteeple(api) {
  const { state } = api;
  const v = V(state);
  const abs = absDay(state);
  const x = VISITORS_BY_ID.whiteStork;
  v.stork.steepleAt = abs;
  v.visitors.whiteStork = { state: 'visible', since: abs, spotId: 'steeple' };
  api.push('storksArrived', { where: 'steeple', first: true, day: storkDay(state), text: STORKS_TEXTS.storksSteeple });
  api.push('visitorVisible', { id: x.id, name: x.name, spotId: 'steeple', where: x.where, whereText: x.whereText, text: x.welcome });
}

/** Les cigogneaux (1ᵉʳ jour de l'été, nid habité) : 1 à 4, hachage pur de la graine et de l'année. */
function storkChicks(api) {
  const { state } = api;
  const v = V(state);
  const cur = storkYearOf(v, state.time.year);
  if (!cur || cur.left !== null || cur.chicks > 0) return;
  const span = STORK_RULES.chicksMax - STORK_RULES.chicksMin + 1;
  cur.chicks = STORK_RULES.chicksMin + (hashSeed(state.seed, `storkChicks${state.time.year}`) % span);
  v.year.chicks = (v.year.chicks || 0) + cur.chicks;
  api.push('storkChicks', { n: cur.chicks, text: chicksText(cur.chicks) });
}

/** Le départ des cigognes (dernier jour de l'été). */
function storksLeave(api) {
  const { state } = api;
  const v = V(state);
  const cur = storkYearOf(v, state.time.year);
  if (!cur || cur.left !== null) return;
  cur.left = absDay(state);
  const day = storkDay(state);
  api.push('storksLeft', { returnDay: day, text: fillText(STORKS_TEXTS.storksLeft, { day: springDayText(day) }) });
}

/** Réveille une légende (récit compris). */
function wakeLegend(api, id) {
  const { state } = api;
  const v = V(state);
  const x = LEGENDS_BY_ID[id];
  if (!x || v.legends[id]) return false;
  v.legends[id] = { awokeAt: absDay(state), harvests: 0, firstAt: null };
  v.year.legends = (v.year.legends || 0) + 1;
  api.push('legendAwoken', { id, name: legendName(state, id), sub: x.sub, story: x.story, cropId: x.cropId, anecdote: x.anecdote, needLibrary: libraryLevelOf(state) < LEGEND_RULES.needLibrary });
  pushStoryV4(api, x.story);
  return true;
}

/**
 * Venue des visiteurs tirés (5 nombres valley4 par aube, vue ouverte, partie wildlife) : même automate qu'au V1 (indice →
 * visible → on le touche) ; une seule venue annoncée par aube toutes espèces confondues.
 */
function visitorsDawn(api, hintedBefore) {
  const { state } = api;
  const v = V(state);
  ensureRng(state);
  const rng = stream(state.rng, 'valley4');
  const draws = DRAWN_VISITORS.map(() => rng.float());
  const abs = absDay(state);
  let hinted = hintedBefore;
  DRAWN_VISITORS.forEach((x, k) => {
    const e = v.visitors[x.id];
    if (e?.state === 'visible' || e?.state === 'seen') return;
    if (e?.state === 'hint') {
      if (draws[k] < VISITOR_RULES.visibleChance || abs - e.since >= VISITOR_RULES.maxWait - 1) {
        e.state = 'visible';
        e.spotId = visitorSpot(state, x.id);
        api.push('visitorVisible', { id: x.id, name: x.name, spotId: e.spotId, where: x.where, whereText: x.whereText, text: x.welcome });
      }
      return;
    }
    if (hinted) return;
    const r = visitorRecipe(state, x.id);
    if (!r.ok || !r.inSeason || draws[k] >= VISITOR_RULES.hintChance) return;
    hinted = true;
    const spotId = visitorSpot(state, x.id);
    v.visitors[x.id] = { state: 'hint', since: abs, spotId };
    api.push('visitorHint', { id: x.id, spotId, text: x.hint, icon: x.hintIcon, where: x.where });
  });
  return hinted;
}

/** (V4) L'aube du V4 (après le V1, le V2 et le V3 ; ordre du contrat). */
function storksDawn(api, hintedBefore, storiesBefore) {
  const { state } = api;
  const v = V(state);
  const abs = absDay(state);
  dawnMarks.set(state, { abs, stories: storiesBefore });
  // 1. Cigognes (jour des cigognes ; 1ᵉʳ et dernier jour de l'été). Ni visiteurs ni cigognes sans la partie wildlife.
  if (v.parts.wildlife) {
    if (isStorkDay(state)) {
      if (v.stage >= STAGE_V4.n && v.stork.wheelAt) storksToFarm(api);
      else if (!v.stork.steepleAt && storkNeedsOk(state)) storksToSteeple(api);
    }
    if (state.time.seasonIndex === 1 && state.time.dayOfSeason === 1) storkChicks(api);
    if (state.time.seasonIndex === 1 && state.time.dayOfSeason === state.career.seasonLength) storksLeave(api);
  }
  // 2. Un récit ou une légende au plus par aube, et seulement si aucun autre récit n'est venu ce matin : d'abord « Un nid
  // sur la maison » (dès la première arrivée sur la maison), puis la première légende qui peut se réveiller.
  const quiet = () => v.stories.available.length === storiesBefore;
  if (v.stork.farmSince && !v.stories.available.includes('storkNest') && quiet()) pushStoryV4(api, 'storkNest');
  if (quiet()) {
    const x = LEGENDS.find((l) => !v.legends[l.id] && legendWakeOk(state, l.id));
    if (x) wakeLegend(api, x.id);
  }
  // 3. Cloches mûres.
  for (const x of LEGENDS) {
    const c = v.cloches[x.id];
    if (c && !c.ripe && abs >= c.readyAt) {
      c.ripe = true;
      api.push('legendRipe', { id: x.id, name: legendName(state, x.id) });
    }
  }
  // 4. Cartes des vallées voisines.
  const sent = v.postcards.sent;
  if (sent && abs >= sent.arrives) {
    v.postcards.got.push({ id: sent.id, at: abs, read: false });
    v.postcards.sent = null;
    v.year.postcards = (v.year.postcards || 0) + 1;
    v.stats.postcards = (v.stats.postcards || 0) + 1;
    const c = POSTCARDS_BY_ID[sent.id];
    api.push('postcardArrived', { id: c.id, valley: c.valley, signer: c.signer, first: v.postcards.got.length === 1 });
  }
  // 5. Visiteurs tirés (flux valley4 : 5 nombres), vue ouverte.
  if (v.view?.open && v.parts.wildlife) visitorsDawn(api, hintedBefore);
  // Arc-en-ciel de demain : il a plu aujourd'hui.
  if (weatherWaters(state.weather?.today)) v.rainedAt = abs;
}

function mushroomDawn(api) {
  const { state } = api;
  const v = V(state);
  const rng = rng3(state);
  const r = [rng.float(), rng.float(), rng.float()];
  if (v.mushrooms.length >= MUSHROOM_RULES.max || r[0] >= MUSHROOM_RULES.chance) return;
  const total = MUSHROOMS.reduce((a, m) => a + m.weight, 0);
  let x = r[1] * total;
  let kind = MUSHROOMS[MUSHROOMS.length - 1];
  for (const m of MUSHROOMS) {
    if (x < m.weight) {
      kind = m;
      break;
    }
    x -= m.weight;
  }
  const free = Array.from({ length: MUSHROOM_RULES.spots }, (_, k) => k).filter((k) => !v.mushrooms.some((m) => m.spot === k));
  const spot = free[Math.min(free.length - 1, Math.floor(r[2] * free.length))];
  const m = { id: `m${v.nextId++}`, kind: kind.id, spot, day: absDay(state) };
  v.mushrooms.push(m);
  api.push('mushroomsGrew', { finds: [{ id: m.id, kind: m.kind, spot }] });
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

/** Fin de l'aube : étape de la vallée (jamais en baisse ; (V3) jusqu'à 7 ; (V4) 8, la roue, l'épilogue). */
function updateStage(api) {
  const { state } = api;
  const v = V(state);
  if (!v?.started) return;
  const target = stageTarget(state);
  const v4 = storksOn(state);
  const abs = absDay(state);
  while (v.stage < target) {
    v.stage += 1;
    const st = STAGES_ALL[v.stage];
    api.push('valleyStage', { n: st.n, name: st.name, reward: clone(st.reward), chapter: { title: st.chapter.title, lines: [...st.chapter.lines], ...(st.chapter.vignette ? { vignette: st.chapter.vignette } : {}) } });
    if (v4) v.stageAt[st.n] = { abs };
    // (V4) Étape 8 : Joseph pose la roue à cigognes sur la cheminée (cadeau, aucun coût).
    if (v4 && st.n === STAGE_V4.n && !v.stork.wheelAt) {
      v.stork.wheelAt = abs;
      api.push('storkWheelPlaced', { text: STORKS_TEXTS.wheel });
    }
  }
  if (v4) epilogueDawn(api);
}

/** (V4) Vallée complète : Joseph attend sur la colline (jamais le même matin qu'une légende ou un récit). */
function epilogueDawn(api) {
  const { state } = api;
  const v = V(state);
  if (v.epilogue.availableAt || !valleyComplete(state)) return;
  const abs = absDay(state);
  const mark = dawnMarks.get(state);
  if (mark && mark.abs === abs && v.stories.available.length > mark.stories) return;
  v.epilogue.availableAt = abs;
  if (!v.stories.available.includes(EPILOGUE.id)) v.stories.available.push(EPILOGUE.id);
  api.push('epilogueAvailable', { text: STORKS_TEXTS.epilogueWaits });
}

function beeIncome(api, { seasonId }) {
  const { state } = api;
  const v = V(state);
  if (!v?.started || seasonId === 'winter') return [];
  const out = [];
  const hives = state.investments.beehive || 0;
  const t = TRAITS_BY_ID.bee;
  if (v.parts.seeds && hives && beePlotsGrowing(state) >= t.minPlots) out.push({ source: 'valleyBees', amount: hives * t.perHive, kind: 'valley', key: 'honey' });
  // (V3) Prairie fleurie : + 1 pièce par ruche et par jour (hors hiver).
  const meadow = hives ? meadowHivesOf(state) : 0;
  if (meadow) out.push({ source: 'valleyMeadow', amount: hives * meadow, kind: 'valley', key: 'honey' });
  return out;
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
  // (V3) Bloc « La vallée cette année » : chantiers, étapes de lieux atteintes, habitants de la vallée, terres, pêches.
  const v3 = placesOn(state)
    ? {
        works: v.year.works || 0, recovered: v.year.recovered || 0, valleyInstalled: v.year.valleyInstalled || 0, wilds: v.year.wilds || 0,
        river: v.year.river || 0, riverIncome: v.year.riverIncome || 0, mushrooms: v.year.mushrooms || 0,
        places: PLACES.map((p) => ({ id: p.id, step: placeStepOf(state, p.id) })),
      }
    : {};
  // (V4) Bloc « La vallée cette année » : avant / après, légendes, visiteurs vus, cigogneaux, cartes.
  const v4 = storksOn(state) && v.started ? storksYear(state, from) : {};
  return {
    started: !!v.started,
    stage: v.stage,
    stageName: STAGES_ALL[v.stage]?.name || STAGE_NAMES[v.stage],
    signs: signsOfLife(state),
    year: clone(v.year),
    installed,
    fixed,
    natureTotal: Object.keys(v.nature).length,
    ...v2,
    ...v3,
    ...v4,
  };
}

/** (V4) Étape atteinte à un jour absolu, d'après les jours gardés des étapes. */
function stageAtDay(v, abs) {
  let n = 0;
  for (const [k, e] of Object.entries(v.stageAt || {})) if (e && e.abs <= abs && Number(k) > n) n = Number(k);
  return Math.min(n, v.stage);
}

function storksYear(state, from) {
  const v = V(state);
  const L = state.career.seasonLength;
  const startYear = v.started.year;
  return {
    legends: v.year.legends || 0, legendHarvests: v.year.legendHarvests || 0, visitorsSeen: v.year.visitorsSeen || 0, chicks: v.year.chicks || 0, postcards: v.year.postcards || 0,
    startYear, stageStart: stageAtDay(v, (startYear - 1) * 4 * L + 1), stageYearStart: stageAtDay(v, from - 1), stageNow: v.stage,
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
export function valleyHarvest(api, plotIndex, by, { quality = null } = {}) {
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
  // (V4) La Merveille : une génération par été (récolte à la main, belle ou dorée, de la Tomate croisée sauvée).
  if (storksOn(state)) marvelGeneration(state, x, quality, info.events);
  return info;
}

/** (V4) + 1 génération de la Merveille (une par été, 3 au plus) ; aucune pièce, rien d'autre ne change à la récolte. */
function marvelGeneration(state, x, quality, events) {
  const v = V(state);
  const R = LEGEND_RULES.marvel;
  if (x.id !== R.crossId || !isFixed(state, R.crossId) || seasonIdOf(state) !== R.season) return;
  if (state.surprises && !R.qualities.includes(quality)) return;
  const m = v.marvel;
  if (m.gens >= R.gens || m.lastYear >= state.time.year) return;
  m.gens += 1;
  m.lastYear = state.time.year;
  events.push(['marvelGeneration', { n: m.gens, need: R.gens }]);
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

/** Variété connue de cette partie (le V2 seulement avec la partie `heritage` ; la Reinette grise avec `places`). */
function knownVariety(state, id) {
  const x = ALL_VARIETIES_BY_ID[id];
  if (!x || !varietyInPart(state, x)) return null;
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
  // (V4) Un visiteur rare : la fenêtre d'observation passe par observeVisitor.
  if (VISITORS_BY_ID[speciesId] && !ALL_SPECIES_BY_ID[speciesId]) return observeVisitor(api, speciesId);
  const s0 = ALL_SPECIES_BY_ID[speciesId];
  const s = s0 && speciesInPart(state, s0) ? s0 : null;
  const e = s ? v.species[speciesId] : null;
  if (e?.state === 'installed') return api.fail(`Déjà ${agreeWith(s, 'installé')}.`);
  if (!s || !v.parts.wildlife || e?.state !== 'visible') return api.fail('Rien à observer ici.');
  e.state = 'installed';
  e.at = absDay(state);
  v.stats.observed += 1;
  v.year.installed += 1;
  const first = installedSpecies(state).length === 1;
  // (V3) Un habitant de la vallée : la fenêtre montre ce qu'il ouvre ; le premier fait venir Hélène (récit).
  const valley = s.group === 'valley';
  let firstValley = false;
  if (valley) {
    v.year.valleyInstalled = (v.year.valleyInstalled || 0) + 1;
    firstValley = VALLEY_SPECIES.filter((x) => speciesInstalled(state, x.id)).length === 1;
  }
  const extra = { ...(s.welcome ? { welcome: s.welcome } : {}), ...(valley ? { valley: true, opens: s.opens, placeId: s.placeId, firstValley } : {}) };
  const out = { speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId, ...extra };
  api.push('speciesInstalled', { id: speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId, ...extra });
  if (firstValley) pushStoryV3(api, 'helene');
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
  // (V3) Bocage : pièces × 1,5 (haies replantées), × 2 (vieux têtards).
  const amount = Math.round(def.coins * careerFactor(state.career.rank) * hedgeCoinsFactorOf(state));
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
  const st = STAGES_ALL[n];
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
  // (V4) L'épilogue se lit par readEpilogue (3 pages).
  if (id === EPILOGUE.id && storksOn(api.state)) return readEpilogue(api);
  const s = STORY_BY_ID[id];
  if (!s || !v.stories?.available.includes(id) || (STORIES_V3_BY_ID[id] && !placesOn(api.state)) || (STORIES_V4_BY_ID[id] && !storksOn(api.state))) return api.fail('Récit inconnu.');
  if (!v.stories.read.includes(id)) v.stories.read.push(id);
  const lines = s.lines.map((l) => l.replace('{ofFarm}', farmOf(api.state)));
  return { ok: true, story: { id: s.id, title: s.title, lines, vignette: s.vignette } };
}

// ── (V4) Actions : légendes, visiteurs, épilogue, cartes, livre ─────────────────────────────

function needStorks(api) {
  const refused = needStarted(api);
  if (refused) return refused;
  if (!storksOn(api.state)) return api.fail(STORKS_TEXTS.disabled);
  return null;
}

/** Sème une légende sous sa cloche (gratuit, toute saison, sans arrosage). */
function sowLegend(api, legendId) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const reason = sowLegendReason(state, legendId);
  if (reason) return api.fail(reason);
  const v = V(state);
  const x = LEGENDS_BY_ID[legendId];
  const abs = absDay(state);
  const readyAt = abs + x.growDays;
  v.cloches[legendId] = { sownAt: abs, readyAt, ripe: false };
  api.push('legendSown', { id: legendId, readyAt, name: legendName(state, legendId) });
  return { ok: true, legendId, sownAt: abs, readyAt, days: x.growDays };
}

/** Récolte à la main une légende mûre : aucune pièce, rien au grenier ; la cloche redevient libre. */
function harvestLegend(api, legendId) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const x = LEGENDS_BY_ID[legendId];
  if (!x) return api.fail(STORKS_TEXTS.unknownLegend);
  const v = V(state);
  const c = v.cloches[legendId];
  if (!c) return api.fail(STORKS_TEXTS.emptyCloche);
  const abs = absDay(state);
  if (!c.ripe && abs < c.readyAt) {
    const n = c.readyAt - abs;
    return api.fail(fillText(STORKS_TEXTS.notRipe, { days: `${n} jour${n > 1 ? 's' : ''}` }));
  }
  const e = v.legends[legendId];
  const first = !e.firstAt;
  if (first) e.firstAt = abs;
  e.harvests += 1;
  v.cloches[legendId] = null;
  v.stats.legendHarvests = (v.stats.legendHarvests || 0) + 1;
  v.year.legendHarvests = (v.year.legendHarvests || 0) + 1;
  const name = legendName(state, legendId);
  const line = first ? x.firstHarvest : fillText(STORKS_TEXTS.harvested, { name, e: agreeWith(x, '') });
  api.push('legendHarvested', { id: legendId, first, line, harvests: e.harvests, name });
  return { ok: true, legendId, first, line, harvests: e.harvests };
}

/** Toucher un visiteur rare qui fait halte (il attendait) : fenêtre d'observation ; cigognes : l'étape 8 à l'aube suivante. */
function observeVisitor(api, visitorId) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const x = VISITORS_BY_ID[visitorId];
  const e = x ? v.visitors[visitorId] : null;
  if (e?.state === 'seen') return api.fail(STORKS_TEXTS.alreadySeen);
  if (!x || e?.state !== 'visible' || !v.parts.wildlife) return api.fail(STORKS_TEXTS.nothingToSee);
  const abs = absDay(state);
  e.state = 'seen';
  e.at = abs;
  if (visitorId === 'whiteStork') v.stork.seenAt = abs;
  v.stats.visitorsSeen = (v.stats.visitorsSeen || 0) + 1;
  v.year.visitorsSeen = (v.year.visitorsSeen || 0) + 1;
  const n = seenVisitors(state).length;
  api.push('visitorSeen', { id: visitorId, name: x.name, first: true, where: x.where, title: x.title, anecdote: x.anecdote, n, total: VISITORS.length });
  return { ok: true, visitorId, name: x.name, title: x.title, anecdote: x.anecdote, first: true, where: x.where, n, total: VISITORS.length };
}

/** L'épilogue de Joseph (3 pages) ; la première lecture garde le jour (décor iron.box : recordValleyEpilogue). */
function readEpilogue(api) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  if (!v.epilogue.availableAt) return api.fail(STORKS_TEXTS.epilogueNotYet);
  const first = !v.epilogue.readAt;
  if (first) v.epilogue.readAt = absDay(state);
  if (!v.stories.available.includes(EPILOGUE.id)) v.stories.available.push(EPILOGUE.id);
  if (!v.stories.read.includes(EPILOGUE.id)) v.stories.read.push(EPILOGUE.id);
  api.push('epilogueRead', { first });
  return { ok: true, pages: epiloguePages(state), first, title: EPILOGUE.title, credits: creditsInfo(state), after: { ...EPILOGUE.after } };
}

/** Le générique a été regardé (livre, statistiques) ; aucun effet. */
function seeCredits(api) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  if (!v.epilogue.readAt) return api.fail(STORKS_TEXTS.creditsNotYet);
  if (!v.epilogue.creditsAt) v.epilogue.creditsAt = absDay(state);
  v.stats.credits = (v.stats.credits || 0) + 1;
  return { ok: true, credits: creditsInfo(state) };
}

/** Envoie un sachet de la boîte en fer à la vallée voisine suivante (gratuit) ; sa carte arrive la saison suivante. */
function sendPostcardSeeds(api) {
  const refused = needStorks(api);
  if (refused) return refused;
  const { state } = api;
  const info = postcardsInfo(state);
  if (!info.canSend) return api.fail(info.reason);
  const v = V(state);
  const c = nextPostcard(state);
  const abs = absDay(state);
  const arrives = (seasonAbs(state) + 1) * state.career.seasonLength + 1;
  v.postcards.sent = { id: c.id, at: abs, arrives };
  api.push('postcardSent', { id: c.id, valley: c.valley, arrives });
  return { ok: true, id: c.id, valley: c.valley, arrives, daysLeft: arrives - abs };
}

/** Lit une carte reçue. */
function readPostcard(api, id) {
  const refused = needStorks(api);
  if (refused) return refused;
  const v = V(api.state);
  const g = v.postcards.got.find((x) => x.id === id);
  if (!g) return api.fail(STORKS_TEXTS.postcardUnknown);
  g.read = true;
  const c = POSTCARDS_BY_ID[id];
  return { ok: true, card: { id, n: c.n, valley: c.valley, signer: c.signer, text: c.text, vignette: c.vignette, at: g.at } };
}

/** Ouvre le livre de la vallée (statistique : conseils, simulation) ; aucun effet. */
function openValleyBook(api) {
  const refused = needStorks(api);
  if (refused) return refused;
  const v = V(api.state);
  v.stats.bookOpened = (v.stats.bookOpened || 0) + 1;
  return { ok: true };
}


// ── (V3) Actions : vue de la vallée, chantiers, pêche, champignons, terres sauvages ─────────

function needPlaces(api) {
  const refused = needStarted(api);
  if (refused) return refused;
  if (!placesOn(api.state)) return api.fail(PLACES_TEXTS.disabled);
  if (!viewOpen(api.state)) return api.fail(PLACES_TEXTS.notOpen);
  return null;
}

/** Ouvre la vue de la vallée (compte une visite). → { ok, first, story: null | 'hill' } */
function openValleyView(api) {
  const refused = needPlaces(api);
  if (refused) return refused;
  const v = V(api.state);
  v.view.visits = (v.view.visits || 0) + 1;
  v.stats.visits = (v.stats.visits || 0) + 1;
  const story = v.stories.available.includes('hill') && !v.stories.read.includes('hill') ? 'hill' : null;
  return { ok: true, first: v.view.visits === 1, story };
}

/** Lance le chantier de l'étape suivante d'un lieu (poste « La Vallée », patrimoine 100 %). */
function startWorks(api, placeId) {
  const refused = needPlaces(api);
  if (refused) return refused;
  const { state } = api;
  const check = canStartWorks(state, placeId);
  if (!check.ok) return api.fail(check.reason);
  const v = V(state);
  const p = PLACES_BY_ID[placeId];
  const st = p.steps[check.step];
  const abs = absDay(state);
  const readyAt = abs + st.seasons * state.career.seasonLength;
  spendValley(api, st.cost);
  const e = v.places[placeId] || (v.places[placeId] = { step: 0, steps: {}, works: null });
  e.works = { step: st.n, startedAt: abs, readyAt, cost: st.cost };
  v.stats.works = (v.stats.works || 0) + 1;
  v.year.works = (v.year.works || 0) + 1;
  const first = v.stats.works === 1;
  const out = { placeId, step: st.n, name: st.name, cost: st.cost, seasons: st.seasons, readyAt, daysLeft: readyAt - abs, first };
  api.push('worksStarted', { placeId, step: st.n, name: st.name, placeName: p.name, cost: st.cost, seasons: st.seasons, readyAt, first });
  return { ok: true, ...out };
}

/** Pêche au ruisseau (une par jour ; 2 nombres valley3 : le poisson, la valeur). */
function fishRiver(api) {
  const refused = needPlaces(api);
  if (refused) return refused;
  const { state } = api;
  const info = riverInfo(state);
  if (!info.canFish) return api.fail(info.reason);
  const v = V(state);
  const table = riverFishTable(state);
  const rng = rng3(state);
  const weights = Object.fromEntries(table.map((f, k) => [k, f.weight]));
  const f = table[Number(rng.weighted(weights))];
  // Libellules × 1,25, étang du moulin × 1,15 (fishFactor), canne de Firmin × 1,5 (comme la mare).
  const amount = Math.round(rng.int(f.min, f.max) * fishFactor(state) * (state.variety ? themeFishFactor(state) : 1));
  v.river.fishedDay = absDay(state);
  v.stats.river = (v.stats.river || 0) + 1;
  v.stats.riverIncome = (v.stats.riverIncome || 0) + amount;
  v.year.river = (v.year.river || 0) + 1;
  v.year.riverIncome = (v.year.riverIncome || 0) + amount;
  api.earn('valley', amount);
  const first = v.stats.river === 1;
  api.push('riverFished', { fishId: f.id, name: f.name, icon: f.icon, amount, first });
  return { ok: true, fishId: f.id, name: f.name, icon: f.icon, amount, first };
}

/** Cueille un champignon du bois (pièces × careerFactor(rang), comme la cueillette des haies). */
function pickMushroom(api, id) {
  const refused = needPlaces(api);
  if (refused) return refused;
  const { state } = api;
  const v = V(state);
  const k = v.mushrooms.findIndex((m) => m.id === id);
  if (k < 0) return api.fail(PLACES_TEXTS.noMushroom);
  const m = v.mushrooms.splice(k, 1)[0];
  const def = MUSHROOMS_BY_ID[m.kind];
  const amount = Math.round(def.coins * careerFactor(state.career.rank));
  api.earn('valley', amount);
  v.stats.mushrooms = (v.stats.mushrooms || 0) + 1;
  v.year.mushrooms = (v.year.mushrooms || 0) + 1;
  api.push('mushroomPicked', { id: m.id, kind: m.kind, name: def.name, amount, spot: m.spot });
  return { ok: true, kind: m.kind, name: def.name, amount };
}

/** Confie une forêt à la nature (sorte choisie pour toujours ; 2 500 + 300 × n ; patrimoine 100 %). */
function rewild(api, cellId, kind) {
  const refused = needStarted(api);
  if (refused) return refused;
  const { state } = api;
  if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
  if ((state.career.lotsBought || 0) < WILD_RULES.needLots) return api.fail(PLACES_TEXTS.wildNeedLots);
  const open = wildOpen(state);
  if (!open.open) return api.fail(open.reason);
  const cell = lotCellOf(cellId);
  if (!cell || !inLotGrid(cell.col, cell.row)) return api.fail(PLACES_TEXTS.wildUnknown);
  const v = V(state);
  if (v.wilds[cellId] || state.career.lots.some((l) => l.id === cellId)) return api.fail(PLACES_TEXTS.wildNotForest);
  if (!wildEligible(state).includes(cellId)) return api.fail(PLACES_TEXTS.wildNotTouching);
  const k = WILD_KINDS_BY_ID[kind];
  if (!k) return api.fail(PLACES_TEXTS.wildKindUnknown);
  const cost = wildPrice(state);
  if (state.money < cost) return api.fail(notEnough(cost - state.money));
  spendValley(api, cost);
  v.wilds[cellId] = { kind, col: cell.col, row: cell.row, at: absDay(state) };
  v.wildBought = (v.wildBought || 0) + 1;
  v.stats.wilds = (v.stats.wilds || 0) + 1;
  v.year.wilds = (v.year.wilds || 0) + 1;
  const name = lotNameAt(cell.col, cell.row);
  const first = v.wildBought === 1;
  api.push('wildLandGiven', { cellId, col: cell.col, row: cell.row, name, kind, cost, first });
  return { ok: true, cellId, col: cell.col, row: cell.row, name, kind, cost, n: v.wildBought, first };
}

/** (Débogage) Ouvre la vue tout de suite (comme à l'aube de l'étape 5 : récit « Sur la colline »). */
function openViewNow(api) {
  const v = V(api.state);
  if (v.view.open) return;
  v.view.open = true;
  v.view.openedAt = absDay(api.state);
  api.push('valleyViewOpened', { first: true });
  pushStoryV3(api, 'hill');
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
      const s = s0 && speciesInPart(state, s0) ? s0 : null;
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
      const p3 = placesOn(state);
      const n = Math.max(0, Math.min(p3 ? (storksOn(state) ? MAX_STAGE_ALL : MAX_STAGE_V3) : MAX_STAGE, Number(arg) || 0));
      // (V3) Étapes 6 et 7 : la vue ouverte et les conditions de lieux posées d'abord (Ru des Saules ≥ 2 ; six lieux ≥ 2).
      if (p3 && n >= 6) {
        openViewNow(api);
        for (const pl of PLACES) {
          const want = n >= 7 ? 2 : pl.id === 'brook' ? 2 : 0;
          if (placeStepOf(state, pl.id) < want) triggerValley(api, 'place', pl.id, want);
        }
      }
      // Signes de vie jusqu'au palier (variétés fixées d'abord, puis habitants), puis l'étape (comme à l'aube). (V4)
      // L'étape 8 n'a pas de palier : celui de l'étape 7.
      const need = stageSignsOf(state, Math.min(n, MAX_STAGE_V3)) || 0;
      const h = heritagePartOn(state);
      for (const x of h ? ALL_VARIETIES : VARIETIES) {
        if (signsOfLife(state) >= need) break;
        if (!isFixed(state, x.id) && varietyInPart(state, x)) triggerValley(api, 'fix', x.id);
      }
      for (const s of h && v.parts.wildlife ? ALL_SPECIES : SPECIES) {
        if (signsOfLife(state) >= need) break;
        if (v.species[s.id]?.state !== 'installed' && speciesInPart(state, s)) triggerValley(api, 'install', s.id);
      }
      // (V3) Encore court (étape 7 : 76 signes) : les lieux avancent d'une étape à la fois.
      if (p3 && n >= 6) {
        let guard = 0;
        while (signsOfLife(state) < need && guard++ < 30) {
          const pl = PLACES.find((x) => placeStepOf(state, x.id) < PLACE_MAX[x.id]);
          if (!pl) break;
          triggerValley(api, 'place', pl.id, placeStepOf(state, pl.id) + 1);
        }
      }
      // (V4) Étape 8 : les cigognes posées sur le clocher et vues (comme si on les avait touchées).
      if (n >= STAGE_V4.n && storksOn(state)) {
        updateStage(api);
        if (!v.stork.steepleAt) storksToSteeple(api);
        if (v.visitors.whiteStork?.state !== 'seen') observeVisitor(api, 'whiteStork');
      }
      updateStage(api);
      return { ok: true, stage: v.stage };
    }
    // (V4) Légendes, Merveille, visiteurs, cigognes, vallée complète, épilogue, cartes (débogage et tests).
    case 'legend': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      if (!LEGENDS_BY_ID[arg]) return api.fail(STORKS_TEXTS.unknownLegend);
      if (arg === 'farmMarvel') v.marvel.gens = Math.max(v.marvel.gens, LEGEND_RULES.marvel.gens);
      if (!wakeLegend(api, arg)) return api.fail('Déjà réveillée.');
      return { ok: true };
    }
    case 'legendRipe': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      const x = LEGENDS_BY_ID[arg];
      if (!x) return api.fail(STORKS_TEXTS.unknownLegend);
      if (!v.legends[arg]) wakeLegend(api, arg);
      const c = v.cloches[arg] || (v.cloches[arg] = { sownAt: abs - x.growDays, readyAt: abs, ripe: false });
      c.readyAt = Math.min(c.readyAt, abs);
      c.sownAt = Math.min(c.sownAt, c.readyAt);
      if (!c.ripe) {
        c.ripe = true;
        api.push('legendRipe', { id: arg, name: legendName(state, arg) });
      }
      return { ok: true };
    }
    case 'marvel': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      const n = Math.max(0, Math.min(LEGEND_RULES.marvel.gens, Number.isInteger(arg) ? arg : v.marvel.gens + 1));
      v.marvel.gens = n;
      api.push('marvelGeneration', { n, need: LEGEND_RULES.marvel.gens });
      return { ok: true, gens: n };
    }
    case 'visitor': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      const x = VISITORS_BY_ID[arg];
      if (!x) return api.fail('Visiteur inconnu.');
      if (v.visitors[arg]?.state === 'seen') return api.fail(STORKS_TEXTS.alreadySeen);
      if (arg === 'whiteStork') {
        if (!v.stork.steepleAt) storksToSteeple(api);
      } else if (v.visitors[arg]?.state !== 'visible') {
        const spotId = visitorSpot(state, arg);
        v.visitors[arg] = { state: 'visible', since: abs, spotId };
        api.push('visitorVisible', { id: x.id, name: x.name, spotId, where: x.where, whereText: x.whereText, text: x.welcome });
      }
      if (arg2 === 'seen') return observeVisitor(api, arg);
      return { ok: true, spotId: v.visitors[arg].spotId };
    }
    case 'storks': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      if (arg === 'steeple') {
        if (v.stork.steepleAt) return api.fail('Déjà sur le clocher.');
        storksToSteeple(api);
        return { ok: true };
      }
      if (arg === 'farm') {
        if (!v.stork.steepleAt) storksToSteeple(api);
        if (v.visitors.whiteStork?.state !== 'seen') observeVisitor(api, 'whiteStork');
        if (!v.stork.wheelAt) {
          v.stork.wheelAt = abs;
          api.push('storkWheelPlaced', { text: STORKS_TEXTS.wheel });
        }
        if (!storksToFarm(api)) return api.fail('Déjà arrivées cette année.');
        pushStoryV4(api, 'storkNest');
        return { ok: true };
      }
      if (arg === 'chicks') {
        if (!v.stork.years[state.time.year]) return api.fail('Pas de cigognes sur la maison cette année.');
        storkChicks(api);
        return { ok: true, chicks: v.stork.years[state.time.year].chicks };
      }
      if (arg === 'leave') {
        if (!v.stork.years[state.time.year]) return api.fail('Pas de cigognes sur la maison cette année.');
        storksLeave(api);
        return { ok: true };
      }
      return api.fail('Inconnu.');
    }
    case 'complete': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      for (const pl of PLACES) triggerValley(api, 'place', pl.id, PLACE_MAX[pl.id]);
      triggerValley(api, 'stage', STAGE_V4.n);
      if (!v.stork.farmSince) triggerValley(api, 'storks', 'farm');
      return { ok: true, stage: v.stage, complete: valleyComplete(state) };
    }
    case 'epilogue': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      if (v.epilogue.availableAt) return api.fail('Déjà disponible.');
      v.epilogue.availableAt = abs;
      if (!v.stories.available.includes(EPILOGUE.id)) v.stories.available.push(EPILOGUE.id);
      api.push('epilogueAvailable', { text: STORKS_TEXTS.epilogueWaits });
      return { ok: true };
    }
    case 'postcard': {
      if (!storksOn(state)) return api.fail(STORKS_TEXTS.disabled);
      if (!v.postcards.sent) {
        const c = nextPostcard(state);
        if (!c) return api.fail(STORKS_TEXTS.postcardsDone);
        v.postcards.sent = { id: c.id, at: abs, arrives: abs + 1 };
        api.push('postcardSent', { id: c.id, valley: c.valley, arrives: abs + 1 });
      } else v.postcards.sent.arrives = Math.min(v.postcards.sent.arrives, abs + 1);
      return { ok: true, id: v.postcards.sent.id, arrives: v.postcards.sent.arrives };
    }
    // (V3) Vue de la vallée, lieux, terres sauvages, champignons, ruisseau (débogage et tests).
    case 'view':
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      openViewNow(api);
      return { ok: true };
    case 'works': {
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      const pl = PLACES_BY_ID[arg];
      if (!pl) return api.fail(PLACES_TEXTS.unknownPlace);
      openViewNow(api);
      const step = placeStepOf(state, arg) + 1;
      const st = pl.steps[step];
      if (!st) return api.fail(PLACES_TEXTS.restored);
      const e = v.places[arg] || (v.places[arg] = { step: 0, steps: {}, works: null });
      e.works = { step, startedAt: abs, readyAt: abs + st.seasons * state.career.seasonLength, cost: 0 };
      api.push('worksStarted', { placeId: arg, step, name: st.name, placeName: pl.name, cost: 0, seasons: st.seasons, readyAt: e.works.readyAt, first: false });
      return { ok: true, readyAt: e.works.readyAt };
    }
    case 'recover': {
      const e = placesOn(state) ? v.places[arg] : null;
      if (!e?.works) return api.fail('Aucun chantier ici.');
      e.works.readyAt = Math.max(e.works.startedAt, abs + 1);
      return { ok: true, readyAt: e.works.readyAt };
    }
    case 'place': {
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      const pl = PLACES_BY_ID[arg];
      if (!pl) return api.fail(PLACES_TEXTS.unknownPlace);
      openViewNow(api);
      const target = Math.max(0, Math.min(PLACE_MAX[arg], Math.floor(Number(arg2) || 0)));
      for (let k = placeStepOf(state, arg) + 1; k <= target; k++) reachPlaceStep(api, arg, k);
      return { ok: true, step: placeStepOf(state, arg) };
    }
    case 'wild': {
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      const cell = lotCellOf(arg);
      if (!cell || !inLotGrid(cell.col, cell.row) || v.wilds[arg] || state.career.lots.some((l) => l.id === arg)) return api.fail(PLACES_TEXTS.wildNotForest);
      const kindId = WILD_KINDS_BY_ID[arg2] ? arg2 : WILD_KINDS[0].id;
      v.wilds[arg] = { kind: kindId, col: cell.col, row: cell.row, at: abs };
      v.wildBought = (v.wildBought || 0) + 1;
      api.push('wildLandGiven', { cellId: arg, col: cell.col, row: cell.row, name: lotNameAt(cell.col, cell.row), kind: kindId, cost: 0, first: v.wildBought === 1 });
      return { ok: true };
    }
    case 'wildGrow': {
      const e = placesOn(state) ? v.wilds[arg] : null;
      if (!e) return api.fail('Pas de terre sauvage ici.');
      // Avance d'un état (0 → 1 → 2) tout de suite ; `at` peut passer avant le jour 1 (débogage).
      const L = state.career.seasonLength;
      const now = wildStageAt(state, e, abs);
      if (now >= 2) return { ok: true, stage: 2 };
      e.at = abs - (now === 0 ? WILD_RULES.youngSeasons : WILD_RULES.grownSeasons) * L;
      api.push('wildLandGrown', { cellId: arg, kind: e.kind, stage: now + 1, name: lotNameAt(e.col, e.row) });
      return { ok: true, stage: now + 1 };
    }
    case 'mushrooms': {
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      const n = Math.max(1, Math.min(MUSHROOM_RULES.max, Number(arg) || MUSHROOM_RULES.max));
      const added = [];
      while (v.mushrooms.length < n) {
        const spot = Array.from({ length: MUSHROOM_RULES.spots }, (_, k) => k).find((k) => !v.mushrooms.some((m) => m.spot === k));
        const m = { id: `m${v.nextId++}`, kind: MUSHROOMS[v.mushrooms.length % MUSHROOMS.length].id, spot, day: abs };
        v.mushrooms.push(m);
        added.push({ id: m.id, kind: m.kind, spot });
      }
      if (added.length) api.push('mushroomsGrew', { finds: added });
      return { ok: true, mushrooms: v.mushrooms.length };
    }
    case 'riverReset':
      if (!placesOn(state)) return api.fail(PLACES_TEXTS.disabled);
      v.river.fishedDay = 0;
      return { ok: true };
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

/** Variétés de la partie : les 35 avec le V2 (36 avec le V3 : la Reinette grise), les 12 du pays sinon. */
function partVarieties(state) {
  return heritagePartOn(state) ? ALL_VARIETIES.filter((x) => varietyInPart(state, x)) : VARIETIES;
}

/** Habitants de la partie : les 16 avec le V2 (26 avec le V3), les 12 du V1 sinon. */
function partSpecies(state) {
  return heritagePartOn(state) ? ALL_SPECIES.filter((s) => speciesInPart(state, s)) : SPECIES;
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
    else if (group === 'orchard') hint = 'Trois greffons du verger conservatoire, quand il sera taillé et greffé (étape 1).';
    else hint = JOSEPH_BOX.varieties.includes(x.id) ? VALLEY_TEXTS.boxVariety : tree ? VALLEY_TEXTS.graftVariety : VALLEY_TEXTS.unknownVariety;
  }
  let name;
  if (group === 'cross') name = e ? varietyName(state, x) : '?';
  else name = e ? x.name : getCrop(x.cropId).name;
  const traits = traitInfos(x);
  const extra = group === 'pays' ? {} : group === 'orchard' ? { clientId: null, seal: PLACES_TEXTS.orchardLabel } : {
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
    // (V3) Habitant de la vallée : son lieu, où on le voit, ce qu'il ouvre ; « Il vous attend au ruisseau ».
    ...(s.group === 'valley' ? { placeId: s.placeId, seenAt: s.seenAt, opens: s.opens, where: whereText(state, s.placeId) } : {}),
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
  const p3 = placesOn(state);
  const v4 = storksOn(state);
  const stages = stagesOf(state);
  const st = STAGES_ALL[v.stage];
  const next = stages[v.stage + 1] || null;
  const counts = habitatCounts(state);
  const jars = (state.career.heirlooms || []).slice(v.jars.opened).map((j, k) => ({
    index: v.jars.opened + k, cropId: j.cropId, label: VARIETIES_BY_ID[VARIETY_OF_CROP[j.cropId]]?.label || null, from: j.from || 'find',
  }));
  const items = NATURE_ITEMS.filter((it) => !it.heritage || heritagePartOn(state)).map((it) => natureInfo(state, it));
  const v2 = heritagePartOn(state);
  const out = {
    started: clone(v.started),
    parts: { ...v.parts },
    stage: {
      n: v.stage, name: st.name, signs, total: p3 ? SIGNS_ALL_V3 : v2 ? SIGNS_ALL : SIGNS_V1,
      next: next ? { n: next.n, name: next.name, signs: stageSignsOf(state, next.n), ...(next.n >= 6 ? { needs: next.n === STAGE_V4.n ? storkNeedText(state) : stageNeedText(next.n) } : {}) } : null,
      vignette: `valley.stage.${v.stage}`, reward: clone(st.reward), max: p3 ? (v4 ? MAX_STAGE_ALL : MAX_STAGE_V3) : MAX_STAGE,
    },
    hint: nextHint(state),
    chapters: stages.map((s) => ({ n: s.n, title: s.chapter.title, lines: [...s.chapter.lines], read: v.chapters.read.includes(s.n), available: s.n <= v.stage })),
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
  const withV2 = {
    ...out,
    library: libraryInfo(state),
    troc: v.parts.seeds ? swapInfo(state) : null,
    swaps: swapsInfo(state),
    crosses: crossesInfo(api),
    box: boxInfo(state),
    stories: storiesInfo(state),
    crossRule: HERITAGE_TEXTS.crossRule,
  };
  if (!p3) return withV2;
  const withV3 = { ...withV2, ...placesQuery(state) };
  return v4 ? { ...withV3, ...storksQuery(state) } : withV3;
}

/** (V4) Champs du V4 de query.career.valley() : légendes, visiteurs, cigognes, épilogue, cartes, livre. */
function storksQuery(state) {
  const v = V(state);
  return {
    storks4: true,
    legends: legendsInfo(state),
    marvel: { n: v.marvel.gens, need: LEGEND_RULES.marvel.gens, crossSaved: isFixed(state, LEGEND_RULES.marvel.crossId), thisSummer: v.marvel.lastYear >= state.time.year },
    visitors: visitorsInfo(state),
    stork: storkInfo(state),
    epilogue: (({ available, read, credits }) => ({ available, read, credits }))(epilogueInfo(state)),
    postcards: postcardsInfo(state),
    book: { open: true, years: chronicle(state).length },
    complete: valleyComplete(state),
  };
}

/** (V3) Champs du V3 de query.career.valley() : vue, lieux, terres sauvages, ruisseau, champignons. */
function placesQuery(state) {
  const v = V(state);
  const open = viewOpen(state);
  const wo = wildOpen(state);
  const cells = Object.values(wildCells(state)).map((c) => ({ cellId: c.cellId, col: c.col, row: c.row, name: c.name, kind: c.kind, kindName: c.kindName, stage: c.stage, stageName: c.stageName, seasonsLeft: c.seasonsLeft, daysLeft: c.daysLeft }));
  const river = riverInfo(state);
  return {
    places3: true,
    view: { open, opensAtStage: PLACES_OPEN.stage, visits: v.view.visits || 0, openedAt: v.view.openedAt },
    places: placesInfo(state),
    steps: { done: PLACES.reduce((a, p) => a + placeStepOf(state, p.id), 0), total: PLACES.reduce((a, p) => a + PLACE_MAX[p.id], 0) },
    wilds: {
      open: wo.open, reason: wo.reason, count: Object.keys(v.wilds).length, total: wo.open ? wildTotal(state) : WILD_RULES.total, nextPrice: wildPrice(state),
      kinds: WILD_KINDS.map((k) => ({ id: k.id, name: k.name, icon: k.icon, text: k.text, grown: k.grown })), eligible: wildEligible(state), cells,
      before: PLACES_TEXTS.wildBefore,
    },
    river: { canFish: river.canFish, fishedToday: river.fishedToday, step: river.step, reason: river.reason },
    mushrooms: mushroomsInfo(state),
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
  // (V3) Les habitants de la vallée ne viennent pas sur la ferme : ils attendent dans la vue (query.career.valleyView()).
  const list = partSpecies(state).filter((s) => s.group !== 'valley');
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
  // (V4) Les vers luisants, sur la ferme (au pied d'une haie) : indice, halte, puis chaque soir d'été en décor.
  if (storksOn(state)) {
    const e = v.visitors?.glowworms;
    const x = VISITORS_BY_ID.glowworms;
    if (e?.state === 'hint' && e.since === abs) out.push({ id: x.id, spotId: e.spotId, state: 'hint', hintIcon: x.hintIcon, visitor: true });
    else if (e?.state === 'visible') out.push({ id: x.id, spotId: e.spotId, state: 'visible', visitor: true });
    else if (e?.state === 'seen' && x.seasons.includes(seasonIdOf(state))) out.push({ id: x.id, spotId: glowSpot(state), state: 'resident', visitor: true });
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
    installedV2: installed.filter((id) => ALL_SPECIES_BY_ID[id]?.group === 'v2').length,
    // (V3) étapes des lieux, lieux restaurés, habitants de la vallée, terres confiées, pêches au ruisseau.
    ...(placesOn(state)
      ? {
          places: Object.fromEntries(PLACES.map((p) => [p.id, placeStepOf(state, p.id)])),
          restored: PLACES.filter((p) => placeStepOf(state, p.id) >= PLACE_MAX[p.id]).map((p) => p.id),
          valleyInstalled: installed.filter((id) => VALLEY_SPECIES_BY_ID[id]),
          wilds: Object.keys(v.wilds || {}).length,
          riverFish: v.stats.river || 0,
          works: v.stats.works || 0,
        }
      : {}),
    // (V4) légendes réveillées et récoltées, visiteurs vus, nid sur la maison, épilogue, cartes.
    ...(storksOn(state)
      ? {
          legendsAwake: LEGENDS.filter((x) => v.legends?.[x.id]).length,
          legendHarvests: v.stats.legendHarvests || 0,
          legendsHarvested: LEGENDS.filter((x) => v.legends?.[x.id]?.firstAt).map((x) => x.id),
          visitorsSeen: seenVisitors(state),
          storkNest: !!v.stork?.farmSince,
          epilogueRead: !!v.epilogue?.readAt,
          postcards: (v.postcards?.got || []).length,
        }
      : {}),
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
      const before = Number.isInteger(state.career.valley.v) ? state.career.valley.v : 1;
      completeValley(state.career.valley);
      ensureRng(state);
      // (V4) Ancienne carrière : le jour de chaque étape déjà atteinte est reconstruit (« vers l'an 9 »).
      if (before < 4 && storksOn(state) && state.career.valley.started && !Object.keys(state.career.valley.stageAt).length) state.career.valley.stageAt = reconstructStageAt(state);
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
    // (V3) Moulin à eau (Ru des Saules ≥ 4) : + 1 place au moulin.
    extraPlaces(state, buildingId) {
      return state.career?.valley ? millPlacesOf(state, buildingId) : 0;
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
    // (V3)
    openValleyView: () => openValleyView(api),
    startWorks: (placeId) => startWorks(api, placeId),
    fishRiver: () => fishRiver(api),
    pickMushroom: (id) => pickMushroom(api, id),
    rewild: (cellId, kind) => rewild(api, cellId, kind),
    // (V4)
    sowLegend: (legendId) => sowLegend(api, legendId),
    harvestLegend: (legendId) => harvestLegend(api, legendId),
    observeVisitor: (visitorId) => observeVisitor(api, visitorId),
    readEpilogue: () => readEpilogue(api),
    seeCredits: () => seeCredits(api),
    sendPostcardSeeds: () => sendPostcardSeeds(api),
    readPostcard: (id) => readPostcard(api, id),
    openValleyBook: () => openValleyBook(api),
  }),
  queries: (api) => ({
    valley: () => valleyQuery(api),
    valleySpots: (kind) => valleySpotsQuery(api, kind ?? null),
    valleyAnimals: () => valleyAnimalsQuery(api),
    // (V2)
    valleyCrossLinks: () => (valleyOf(api.state) ? crossLinks(api.state) : []),
    valleyPairPlots: (cropId) => (heritageSeedsOn(api.state) ? pairPlots(api.state, cropId) : []),
    // (V3)
    valleyView: () => {
      if (!valleyOf(api.state)) return null;
      const view = viewInfo(api.state);
      // (V4) Visiteurs, clocher, barrage, fenêtres du village, banc habité, vallée complète.
      if (!view || !storksOn(api.state)) return view;
      const extra = viewExtras(api.state);
      // `joseph` garde son sens du V3 (un récit ou un chapitre du V3) ; le V4 passe par bench.joseph.
      return { ...view, ...extra };
    },
    wildCell: (cellId) => (placesOn(api.state) ? wildCellInfo(api.state, cellId) : null),
    place: (placeId) => (viewOpen(api.state) ? placeInfo(api.state, placeId) : null),
    // (V4)
    valleyScenery: () => (storksOn(api.state) ? sceneryOf(api.state) : null),
    valleyBook: () => (storksOn(api.state) ? bookOf(api.state) : null),
    valleySounds: () => (storksOn(api.state) ? soundFacts(api.state) : null),
    valleyEpilogue: () => (storksOn(api.state) ? { ...epilogueInfo(api.state), pages: epiloguePages(api.state), title: EPILOGUE.title, credits: creditsInfo(api.state) } : null),
    valleyBench: () => (storksOn(api.state) && V(api.state).epilogue.readAt ? { line: benchLine(api.state) } : null),
  }),
};

