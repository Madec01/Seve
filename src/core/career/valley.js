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

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { careerFactor } from '../../data/cozy.js';
import {
  ARRIVAL, FAIR_STALL, HEDGE_FINDS, HEDGE_FINDS_BY_ID, HEDGE_FIND_RULES, JOSEPH_BOX, MAX_STAGE, NATURE_ITEMS, NATURE_ITEMS_BY_ID,
  SEED_RULES, SPECIES, SPECIES_BY_ID, STAGES, TRAITS_BY_ID, VALLEY_PARTS, VALLEY_START, VALLEY_TEXTS, VALLEY_VERSION, VARIETIES, VARIETIES_BY_ID,
  VARIETY_OF_CROP,
} from '../../data/career/valley.js';
import { hashSeed, stream } from '../rng.js';
import { absDay } from '../surprises.js';
import { inGreenhouse } from '../farm.js';
import { treeSeedCost } from '../trees.js';
import {
  animalBonusOf, fixedSeedCost, growthBonusOf, isFixed, partOn, seasonAbs, touristBonusOf, valleyOf, varietyOf,
} from './heirlooms.js';
import {
  beePlotsGrowing, fixedVarieties, habitatCounts, installedSpecies, loneTreeStage, naturePrice, nextHint, recipeStatus, seasonsText,
  signsOfLife, speciesSpot, spotDef, spotLabel, spotsOf, stageFor, valleyServices, whereText, granaryBuilt,
} from './habitat.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const SEASON_IN = { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' };
const FROM = ['box', 'jar', 'fair', 'jay'];
const SPECIES_STATES = ['hint', 'visible', 'installed'];
const STAGE_NAMES = STAGES.map((s) => s.name);

// ── État ────────────────────────────────────────────────────────────────────────────────────

function emptyYear() {
  return { hand: 0, seedsSaved: 0, fixed: 0, installed: 0, placed: 0, finds: 0, jars: 0, spent: 0 };
}

function emptyStats() {
  return { hand: 0, seedsSaved: 0, observed: 0, placed: 0, jars: 0, fallows: 0, finds: {} };
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
  if (state.rng && typeof state.rng === 'object' && !Number.isInteger(state.rng.valley)) state.rng.valley = hashSeed(state.seed, 'valley');
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
}

/** Vérification (sauvegarde). → null | 'problème' */
export function checkValley(state) {
  const v = state.career.valley;
  const obj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const int = (x, min = 0, max = 1e9) => Number.isInteger(x) && x >= min && x <= max;
  for (const p of state.plots) {
    if (!p || (p.variety === undefined && p.fallow === undefined && p.rested === undefined && p.lastVariety === undefined)) continue;
    if (!v) return 'Vallée (parcelle sans Vallée)';
    if (p.variety !== undefined && (!VARIETIES_BY_ID[p.variety] || p.cropId !== VARIETIES_BY_ID[p.variety].cropId)) return 'Vallée (variété d\'une parcelle)';
    if (p.lastVariety !== undefined && !VARIETIES_BY_ID[p.lastVariety]) return 'Vallée (dernière variété)';
    if (p.fallow !== undefined && (!int(p.fallow) || p.cropId || p.env !== 'field')) return 'Vallée (jachère)';
    if (p.rested !== undefined && p.rested !== true) return 'Vallée (sol reposé)';
  }
  if (v === null || v === undefined) return null;
  if (!obj(v) || !int(v.v, 1, VALLEY_VERSION)) return 'Vallée (version)';
  if (!obj(v.parts) || !VALLEY_PARTS.every((k) => typeof v.parts[k] === 'boolean')) return 'Vallée (parties)';
  if (v.started !== null && !(obj(v.started) && int(v.started.year, 1) && int(v.started.day, 1) && int(v.started.abs, 1))) return 'Vallée (début)';
  if (!int(v.stage, 0, MAX_STAGE) || v.stage > stageFor(signsOfLife(state))) return 'Vallée (étape)';
  if (!obj(v.chapters) || !Array.isArray(v.chapters.read) || !v.chapters.read.every((n) => int(n, 0, MAX_STAGE))) return 'Vallée (chapitres)';
  if (!(typeof v.spent === 'number' && Number.isFinite(v.spent) && v.spent >= 0)) return 'Vallée (dépenses)';
  if (!obj(v.jars) || !int(v.jars.opened) || v.jars.opened > (state.career.heirlooms || []).length) return 'Vallée (bocaux)';
  if (!obj(v.seeds) || !Object.entries(v.seeds).every(([id, n]) => VARIETIES_BY_ID[id] && int(n))) return 'Vallée (graines)';
  if (!obj(v.varieties)) return 'Vallée (variétés)';
  for (const [id, e] of Object.entries(v.varieties)) {
    if (!VARIETIES_BY_ID[id] || !obj(e) || !FROM.includes(e.from) || !int(e.got) || !int(e.hand) || !(e.fixedAt === null || int(e.fixedAt))) return `Vallée (variété ${id})`;
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
    if (!SPECIES_BY_ID[id] || !obj(e) || !SPECIES_STATES.includes(e.state) || !int(e.since) || !(e.spotId === null || typeof e.spotId === 'string')) return `Vallée (habitant ${id})`;
  }
  if (!Array.isArray(v.finds) || v.finds.length > HEDGE_FIND_RULES.max) return 'Vallée (cueillette)';
  for (const f of v.finds) if (!obj(f) || typeof f.id !== 'string' || !HEDGE_FINDS_BY_ID[f.kind] || typeof f.spotId !== 'string' || !int(f.day)) return 'Vallée (trouvaille)';
  if (!int(v.jayYear)) return 'Vallée (geai)';
  if (v.fair !== null && !(obj(v.fair) && int(v.fair.year, 1) && (v.fair.varietyId === null || VARIETIES_BY_ID[v.fair.varietyId]) && int(v.fair.price) && typeof v.fair.bought === 'boolean')) return 'Vallée (foire)';
  if (!obj(v.year) || !obj(v.stats) || !int(v.nextId, 1)) return 'Vallée (compteurs)';
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

function speciesDawn(api) {
  const { state } = api;
  const v = V(state);
  const rng = rngOf(state);
  const draws = SPECIES.map(() => rng.float());
  const abs = absDay(state);
  const counts = habitatCounts(state);
  let hinted = false;
  SPECIES.forEach((s, k) => {
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
}

function hedgeDawn(api) {
  const { state } = api;
  const v = V(state);
  const rng = rngOf(state);
  const r = [rng.float(), rng.float(), rng.float()];
  const hedges = Object.entries(v.nature).filter(([, n]) => n.kind === 'hedge').map(([spotId]) => spotId);
  if (v.finds.length >= HEDGE_FIND_RULES.max || !hedges.length || r[0] >= HEDGE_FIND_RULES.chance) return;
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
  if (v.parts.wildlife) speciesDawn(api);
  if (v.stage >= HEDGE_FIND_RULES.minStage && HEDGE_FIND_RULES.seasons.includes(seasonIdOf(state))) hedgeDawn(api);
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
  const installed = SPECIES.filter((s) => v.species[s.id]?.state === 'installed' && (v.species[s.id].at ?? 0) >= from).map((s) => s.id);
  const fixed = VARIETIES.filter((x) => (v.varieties[x.id]?.fixedAt ?? 0) >= from).map((x) => x.id);
  return {
    started: !!v.started,
    stage: v.stage,
    stageName: STAGE_NAMES[v.stage],
    signs: signsOfLife(state),
    year: clone(v.year),
    installed,
    fixed,
    natureTotal: Object.keys(v.nature).length,
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
  const info = { variety: x.id, seeds: 0, hand: entry?.hand || 0, need: SEED_RULES.fixHand, fixed: false, events: [] };
  if (by !== 'player' || !v.parts.seeds) return info;
  const e = entry || (v.varieties[x.id] = { from: 'jar', got: absDay(state), hand: 0, fixedAt: null });
  // Une variété déjà sauvée ne rend plus de graines (elles sont en vente illimitée) ; la récolte à la main compte toujours.
  const gain = e.fixedAt ? 0 : tree ? SEED_RULES.graftPerBasket : SEED_RULES.handSeeds;
  v.seeds[x.id] = (v.seeds[x.id] || 0) + gain;
  e.hand += 1;
  v.stats.hand += 1;
  v.year.hand += 1;
  v.stats.seedsSaved += gain;
  v.year.seedsSaved += gain;
  info.seeds = gain;
  info.hand = e.hand;
  if (gain > 0 || !e.fixedAt) info.events.push(['heirloomHarvest', { plotIndex, varietyId: x.id, seeds: gain, hand: e.hand, need: SEED_RULES.fixHand, by, tree }]);
  if (!e.fixedAt && e.hand >= SEED_RULES.fixHand) {
    e.fixedAt = absDay(state);
    v.year.fixed += 1;
    info.fixed = true;
    info.events.push(['heirloomFixed', { varietyId: x.id, name: x.name, trait: traitInfo(x.trait), text: VALLEY_TEXTS.saved.replace('{name}', x.name) }]);
  }
  return info;
}

/** Prix du semis d'une variété fixée (sans graine gardée) : prix de la culture × 1,25 (greffon : prix du jeune plant × 1,25). */
export function heirloomSeedCost(api, varietyId) {
  const x = VARIETIES_BY_ID[varietyId];
  if (!x) return null;
  const crop = getCrop(x.cropId);
  return fixedSeedCost(isTreeCrop(crop) ? treeSeedCost(api.state, crop) : api.seedCost(crop.id));
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
  const x = VARIETIES_BY_ID[varietyId];
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
    if (!fixed) return api.fail(`Plus de graines de ${x.name} : récoltez-en une à la main.`);
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
  if (!item) return 'Aménagement inconnu.';
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
  if (!NATURE_ITEMS_BY_ID[k] || k !== d.kind) return api.fail('Cet aménagement ne va pas ici.');
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
  const s = SPECIES_BY_ID[speciesId];
  const e = s ? v.species[speciesId] : null;
  if (e?.state === 'installed') return api.fail('Déjà installé.');
  if (!s || !v.parts.wildlife || e?.state !== 'visible') return api.fail('Rien à observer ici.');
  e.state = 'installed';
  e.at = absDay(state);
  v.stats.observed += 1;
  v.year.installed += 1;
  const first = installedSpecies(state).length === 1;
  const out = { speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId };
  api.push('speciesInstalled', { id: speciesId, name: s.name, service: serviceInfo(s), first, anecdote: s.anecdote, spotId: e.spotId });
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
      if (!VARIETIES_BY_ID[arg]) return api.fail('Variété inconnue.');
      addVariety(v, arg, 'jar', abs);
      v.seeds[arg] = (v.seeds[arg] || 0) + (Number.isInteger(arg2) ? arg2 : 3);
      return { ok: true, seeds: v.seeds[arg] };
    }
    case 'fix': {
      if (!VARIETIES_BY_ID[arg]) return api.fail('Variété inconnue.');
      addVariety(v, arg, 'jar', abs);
      const e = v.varieties[arg];
      e.hand = Math.max(e.hand, SEED_RULES.fixHand);
      if (!e.fixedAt) {
        e.fixedAt = abs;
        v.year.fixed += 1;
        const x = VARIETIES_BY_ID[arg];
        api.push('heirloomFixed', { varietyId: arg, name: x.name, trait: traitInfo(x.trait), text: VALLEY_TEXTS.saved.replace('{name}', x.name) });
      }
      return { ok: true };
    }
    case 'visible':
    case 'install': {
      const s = SPECIES_BY_ID[arg];
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
      while (v.finds.length < HEDGE_FIND_RULES.max) {
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

function varietyInfo(api, x) {
  const { state } = api;
  const v = V(state);
  const e = v.varieties[x.id];
  const fixed = !!e?.fixedAt;
  const tree = isTreeCrop(getCrop(x.cropId));
  let hint = null;
  if (!e) hint = JOSEPH_BOX.varieties.includes(x.id) ? VALLEY_TEXTS.boxVariety : tree ? VALLEY_TEXTS.graftVariety : VALLEY_TEXTS.unknownVariety;
  return {
    id: x.id, cropId: x.cropId, name: e ? x.name : getCrop(x.cropId).name, icon: x.icon, ripeIcon: x.ripe, tint: x.tint, trait: traitInfo(x.trait),
    state: !e ? 'unknown' : fixed ? 'fixed' : 'seeds', seeds: v.seeds[x.id] || 0, hand: e?.hand || 0, need: SEED_RULES.fixHand,
    label: x.label, anecdote: e ? x.anecdote : null, hint, from: e?.from || null, tree, unit: tree ? 'greffon' : 'graine',
    growing: state.plots.filter((p) => p.variety === x.id && p.cropId).length,
    seedCost: fixed ? heirloomSeedCost(api, x.id) : null,
  };
}

function speciesInfo(state, s, counts) {
  const v = V(state);
  const e = v.species[s.id];
  const r = recipeStatus(state, s.id, counts);
  const st = e ? e.state : 'unknown';
  return {
    id: s.id, name: s.name, icon: s.icon, seasons: [...s.seasons], seasonsText: seasonsText(s.seasons), state: st, inSeason: r.inSeason,
    recipe: r.items, recipeOk: r.ok, service: serviceInfo(s), spotId: e?.spotId || null, where: e?.spotId ? whereText(state, e.spotId) : null,
    hint: st !== 'unknown' ? s.hint : null, hintIcon: s.hintIcon, anecdote: st === 'installed' ? s.anecdote : null, firstMet: s.firstMet || null,
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
  const items = NATURE_ITEMS.map((it) => natureInfo(state, it));
  return {
    started: clone(v.started),
    parts: { ...v.parts },
    stage: { n: v.stage, name: st.name, signs, total: SPECIES.length + VARIETIES.length, next: next ? { n: next.n, name: next.name, signs: next.signs } : null, vignette: `valley.stage.${v.stage}`, reward: clone(st.reward) },
    hint: nextHint(state),
    chapters: STAGES.map((s) => ({ n: s.n, title: s.chapter.title, lines: [...s.chapter.lines], read: v.chapters.read.includes(s.n), available: s.n <= v.stage })),
    jars: { pending: jars.length, list: jars },
    varieties: VARIETIES.map((x) => varietyInfo(api, x)),
    species: SPECIES.map((s) => speciesInfo(state, s, counts)),
    nature: { items, free: items.reduce((a, x) => a + x.freeSpots, 0), placed: Object.keys(v.nature).length },
    finds: v.finds.map((f) => ({ id: f.id, kind: f.kind, name: HEDGE_FINDS_BY_ID[f.kind].name, icon: HEDGE_FINDS_BY_ID[f.kind].icon, spotId: f.spotId })),
    fair: fairInfo(state),
    services: valleyServices(state),
    year: clone(v.year),
    stats: clone(v.stats),
    spent: v.spent,
    fixed: fixedVarieties(state),
    installed: installedSpecies(state),
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

/** Habitants du jour (« présent » : hachage pur du jour et de l'espèce, sans flux aléatoire ; 6 au plus). */
function valleyAnimalsQuery(api) {
  const { state } = api;
  const v = V(state);
  if (!v?.started || !v.parts.wildlife) return [];
  const out = [];
  const abs = absDay(state);
  for (const s of SPECIES) {
    const e = v.species[s.id];
    if (!e) continue;
    if (e.state === 'hint' && e.since === abs) out.push({ id: s.id, spotId: e.spotId, state: 'hint', hintIcon: s.hintIcon });
    else if (e.state === 'visible') out.push({ id: s.id, spotId: e.spotId, state: 'visible' });
  }
  let residents = 0;
  for (const s of SPECIES) {
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
    variety = {
      id: x.id, name: x.name, icon: x.icon, ripeIcon: x.ripe, tint: x.tint, trait: traitInfo(x.trait), trial: !e?.fixedAt, hand: e?.hand || 0,
      need: SEED_RULES.fixHand, seedsOnHand: tree ? SEED_RULES.graftPerBasket : SEED_RULES.handSeeds, unit: tree ? 'greffon' : 'graine',
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
  const heirlooms = [];
  for (const x of VARIETIES) {
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
    else if (seeds <= 0 && !fixed) reason = `Plus de graines de ${x.name} : récoltez-en une à la main.`;
    else if (cost > state.money) reason = notEnough(cost - state.money);
    heirlooms.push({ varietyId: x.id, cropId: x.cropId, name: x.name, icon: x.icon, trait: traitInfo(x.trait), seeds, fixed, cost, canSow: !reason, reason, trial: !fixed, tree });
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
  return { started: !!v.started, fixed: fixedVarieties(state), installed: installedSpecies(state), stage: v.stage, jars: v.stats.jars, hand: v.stats.hand };
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
      return NATURE_ITEMS.filter((n) => n.rank === rank).map((n) => ({ kind: 'nature', id: n.id, name: n.name }));
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
  }),
  queries: (api) => ({
    valley: () => valleyQuery(api),
    valleySpots: (kind) => valleySpotsQuery(api, kind ?? null),
    valleyAnimals: () => valleyAnimalsQuery(api),
  }),
};

