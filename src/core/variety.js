// Lot 3 « Variété » — logique partagée par les niveaux (src/core/game.js) et la carrière (src/core/career/variety.js) :
// état, activation, migration, vérification ; étapes de l'aube et du soir ; cadeau de saison (cartes), défis,
// colporteur et graines rares ; requêtes. Le tableau, la charrette et le générateur de demandes sont dans
// src/core/requests.js ; la lecture des effets en cours dans src/core/variety-effects.js. Pur : aucun DOM.
// Règles : docs/GAME_DESIGN.md § 16 ; contrat : docs/ARCHITECTURE.md, « Lot 3 — contrats ».
//
// Tout ne s'active que si state.variety existe (Détente et carrière par défaut ; clé ABSENTE en Classique : parité
// des niveaux 1 à 8). Tirages : deux flux NOUVEAUX, state.rng.orders (commandes) et state.rng.variety (charrette,
// cartes, défis, étal, thèmes, averses) ; les autres flux tirent exactement les mêmes nombres qu'avant.
//
// `host` (game.js pour les niveaux, l'extension pour la carrière) :
//   { mode, state, level, crops, push(type, payload), fail(reason),
//     earn(key, amount)            key : 'orders' | 'cart' | 'cards' | 'medals' (argent, bilan, statistiques)
//     spend(key, amount)           key : 'merchant'
//     rateFor(plot, tree?)         vitesse de pousse arrosée (null : semis du jour ; tree : fruits)
//     giveInvestment(id, n, price) pose n unités (ruche, poulailler, poules) → { ok } | { ok: false, reason }
//     canGive(id, n)               → null | raison
//     nextCost(id)                 prix du prochain achat (niveaux : poulailler, ruche)
//     clearingPossible()           le champ peut-il encore s'agrandir / un terrain se défricher ?
//     refreshLevel() }

import { SEASONS, SEASON_NAMES } from '../data/balance.js';
import { CROPS, getCrop, isRareCrop, isTreeCrop, RARE_CROP_IDS } from '../data/crops.js';
import {
  CARD_VALUES, CARDS, CARDS_BY_ID, CHALLENGE_RULES, CHALLENGES, CHALLENGES_BY_ID, CLIENTS_BY_ID, MEDALS, MERCHANT, MERCHANT_ECUS_IF_OWNED,
  MERCHANT_ITEMS, MERCHANT_ITEMS_BY_ID, RARE_OF_SEASON, RARE_SEEDS, VARIETY_PARTS, VARIETY_VERSION, BOARD,
} from '../data/variety.js';
import { THEMES_BY_ID } from '../data/career/themes.js';
import { hashSeed, stream } from './rng.js';
import { inGreenhouse, isMature, needsWaterToday } from './farm.js';
import { isTreeAdult } from './trees.js';
import {
  adultTrees, boardCrops, boardHorizon, cartCrateCount, cartInfo, claimPreview, departCart, drawCart, feasibleCrops, openFieldPlots,
  orderInfo, orderStarted, orderStillFeasible, removeOrder, renewBoard, requestedCrops, seasonEndAbs, seasonLen,
} from './requests.js';
import { cardActive, currentTheme, hasVarietyAlmanac, vAbsDay, vSeasonAbs } from './variety-effects.js';

export { VARIETY_VERSION };

const PARTS_LEVELS = VARIETY_PARTS.filter((p) => p !== 'themes');
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v) => Number.isInteger(v) && v >= 0;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));

// ── État ────────────────────────────────────────────────────────────────────────────────────────

/** Parties actives d'après l'option (true, { board, … } ; absentes = true). */
export function normalizeParts(opt, mode = 'levels') {
  const list = mode === 'career' ? VARIETY_PARTS : PARTS_LEVELS;
  const out = {};
  for (const p of list) out[p] = obj(opt) ? opt[p] !== false : true;
  if (mode !== 'career') out.themes = false;
  return out;
}

export function emptyVarietyStats() {
  return {
    ordersDone: 0, ordersPremium: 0, ordersByClient: {}, carts: 0, cartsFull: 0, cratesFull: 0, cartPremium: 0,
    cardsPicked: {}, cardIncome: 0, medals: { bronze: 0, silver: 0, gold: 0 }, medalCoins: 0, medalEcus: 0,
    merchantSpent: 0, merchantBought: {}, rareSown: {}, rareHarvested: {},
  };
}

export function newSeasonCounters(abs) {
  return { abs, harvests: 0, sales: 0, harvested: {}, sown: {}, care: 0, quality: 0, orders: 0, crates: 0, products: 0, apples: 0, animals: 0, collect: 0 };
}

/** Nouvel état de la variété (state.variety). */
export function newVarietyState(parts = normalizeParts(true)) {
  return {
    v: VARIETY_VERSION,
    parts: { ...parts },
    nextId: 1,
    board: { slots: Array.from({ length: BOARD.slots }, () => null), startDay: 1, rerollDay: 0, yesterday: [], done: [] },
    cart: null,
    cards: { offer: null, active: [], last: null, pending: { freePlot: false, clearingHalf: false, rentFactor: 1, chargeFactor: 1, cartFactor: 1 } },
    challenges: { season: null, options: [], kept: [], targets: {}, medals: {}, next: null, last: null },
    season: null,
    merchant: null,
    rare: Object.fromEntries(RARE_CROP_IDS.map((id) => [id, 0])),
    freeSows: {},
    owned: { copperCan: false, almanac: false, horseshoe: false },
    fertilizer: null,
    stats: emptyVarietyStats(),
  };
}

/** Flux aléatoires du lot (graines dérivées de state.seed). */
function ensureStreams(state) {
  for (const k of ['orders', 'variety']) if (!Number.isInteger(state.rng?.[k])) state.rng[k] = hashSeed(state.seed, k);
}

/** Active la variété : état et flux. `opt` : true | { board, cards, … }. */
export function enableVariety(state, opt = true) {
  if (!state.variety) state.variety = newVarietyState(normalizeParts(opt, state.mode === 'career' ? 'career' : 'levels'));
  ensureStreams(state);
  return state.variety;
}

/** Complète un état chargé (champs ajoutés plus tard). */
export function completeVariety(state) {
  const v = state.variety;
  if (!obj(v)) return;
  const d = newVarietyState(normalizeParts(true, state.mode === 'career' ? 'career' : 'levels'));
  for (const [k, val] of Object.entries(d)) if (v[k] === undefined) v[k] = val;
  for (const [k, val] of Object.entries(d.parts)) if (v.parts[k] === undefined) v.parts[k] = val;
  if (obj(v.board)) for (const [k, val] of Object.entries(d.board)) if (v.board[k] === undefined) v.board[k] = val;
  if (obj(v.cards)) {
    for (const [k, val] of Object.entries(d.cards)) if (v.cards[k] === undefined) v.cards[k] = val;
    if (obj(v.cards.pending)) for (const [k, val] of Object.entries(d.cards.pending)) if (v.cards.pending[k] === undefined) v.cards.pending[k] = val;
  }
  if (obj(v.challenges)) for (const [k, val] of Object.entries(d.challenges)) if (v.challenges[k] === undefined) v.challenges[k] = val;
  if (obj(v.stats)) for (const [k, val] of Object.entries(emptyVarietyStats())) if (v.stats[k] === undefined) v.stats[k] = val;
  if (obj(v.rare)) for (const id of RARE_CROP_IDS) if (v.rare[id] === undefined) v.rare[id] = 0;
  if (obj(v.owned)) for (const [k, val] of Object.entries(d.owned)) if (v.owned[k] === undefined) v.owned[k] = val;
  if (obj(v.season)) for (const [k, val] of Object.entries(newSeasonCounters(v.season.abs))) if (v.season[k] === undefined) v.season[k] = val;
  ensureStreams(state);
}

/**
 * Migration d'une sauvegarde d'avant le lot 3 (Détente ou carrière) : la variété arrive à la reprise. Le tableau se
 * remplit à l'aube suivante ; ni charrette, ni défis, ni colporteur avant la saison suivante ; cartes à la fin de la
 * saison en cours.
 */
export function migrateToVariety(state) {
  const v = enableVariety(state, true);
  v.board.startDay = vAbsDay(state) + 1;
  v.season = newSeasonCounters(vSeasonAbs(state));
  return v;
}

/** Vérifie state.variety (sauvegarde). → null | 'problème'. */
export function checkVariety(state) {
  const v = state.variety;
  if (v === undefined || v === null) return null;
  if (!obj(v) || v.v !== VARIETY_VERSION) return 'variété';
  if (!obj(v.parts) || !Object.values(v.parts).every((x) => typeof x === 'boolean')) return 'variété (parties)';
  if (!int(v.nextId) || v.nextId < 1) return 'variété';
  const cropOk = (id) => !!getCrop(id) && !isRareCrop(id);
  const lineOk = (l) => obj(l) && cropOk(l.cropId) && int(l.n) && l.n >= 1 && int(l.got) && l.got <= l.n;
  // Tableau
  const b = v.board;
  if (!obj(b) || !Array.isArray(b.slots) || b.slots.length !== BOARD.slots) return 'tableau du village';
  for (const o of b.slots) {
    if (o === null) continue;
    if (!obj(o) || typeof o.id !== 'string' || !CLIENTS_BY_ID[o.clientId] || !int(o.day)) return 'commande';
    if (!Array.isArray(o.lines) || o.lines.length < 1 || o.lines.length > 2 || !o.lines.every(lineOk)) return 'commande';
    if (typeof o.rate !== 'number' || o.rate < 1 || o.rate > 1.6 || typeof o.kept !== 'boolean' || typeof o.base !== 'number' || o.base < 0 || !int(o.fromStock)) return 'commande';
  }
  if (!int(b.startDay) || !int(b.rerollDay) || !Array.isArray(b.yesterday) || !b.yesterday.every((id) => !!getCrop(id))) return 'tableau du village';
  if (!Array.isArray(b.done)) return 'tableau du village';
  // Charrette
  const c = v.cart;
  if (c !== null) {
    if (!obj(c) || typeof c.id !== 'string' || !int(c.season) || !int(c.departDay) || typeof c.horse !== 'boolean' || typeof c.base !== 'number') return 'charrette';
    if (!Array.isArray(c.crates) || c.crates.length < 1 || c.crates.length > 4 || !c.crates.every(lineOk)) return 'charrette';
  }
  // Cartes
  const k = v.cards;
  if (!obj(k) || !Array.isArray(k.active) || !obj(k.pending)) return 'cartes';
  if (k.offer !== null && !(obj(k.offer) && int(k.offer.season) && Array.isArray(k.offer.options) && k.offer.options.length === 2 && k.offer.options.every((id) => CARDS_BY_ID[id]))) return 'cartes proposées';
  for (const a of k.active) if (!obj(a) || !CARDS_BY_ID[a.id] || !(a.season === null || int(a.season)) || !int(a.until)) return 'carte en cours';
  if (k.last !== null && !(Array.isArray(k.last) && k.last.every((id) => CARDS_BY_ID[id]))) return 'cartes';
  for (const key of ['rentFactor', 'chargeFactor', 'cartFactor']) if (typeof k.pending[key] !== 'number' || k.pending[key] <= 0) return 'cartes';
  if (typeof k.pending.freePlot !== 'boolean' || typeof k.pending.clearingHalf !== 'boolean') return 'cartes';
  // Défis
  const ch = v.challenges;
  if (!obj(ch) || !Array.isArray(ch.options) || !Array.isArray(ch.kept) || !obj(ch.targets) || !obj(ch.medals)) return 'défis';
  if (!(ch.season === null || int(ch.season))) return 'défis';
  if (!ch.options.every((id) => CHALLENGES_BY_ID[id]) || ch.kept.length > CHALLENGE_RULES.keepMax || !ch.kept.every((id) => ch.options.includes(id))) return 'défis';
  for (const [id, t] of Object.entries(ch.targets)) if (!CHALLENGES_BY_ID[id] || !Array.isArray(t) || t.length !== 3 || !t.every((x) => int(x) && x >= 1)) return 'défis';
  for (const [id, m] of Object.entries(ch.medals)) if (!CHALLENGES_BY_ID[id] || !Number.isInteger(m) || m < 0 || m > 3) return 'défis';
  if (ch.next !== null && !(obj(ch.next) && int(ch.next.season) && Array.isArray(ch.next.options) && ch.next.options.every((id) => CHALLENGES_BY_ID[id]))) return 'défis';
  if (ch.next && ch.next.kept !== undefined && !(Array.isArray(ch.next.kept) && ch.next.kept.length <= CHALLENGE_RULES.keepMax)) return 'défis';
  // Compteurs de la saison
  if (v.season !== null && !(obj(v.season) && int(v.season.abs) && obj(v.season.harvested) && obj(v.season.sown))) return 'défis (compteurs)';
  // Colporteur
  const m = v.merchant;
  if (m !== null) {
    if (!obj(m) || !int(m.season) || !int(m.soonDay) || !int(m.arriveDay) || !int(m.leaveDay) || typeof m.announced !== 'boolean' || !Array.isArray(m.stall)) return 'colporteur';
    for (const it of m.stall) {
      if (!obj(it) || typeof it.itemId !== 'string' || !int(it.price) || typeof it.sold !== 'boolean') return 'colporteur';
      if (!MERCHANT_ITEMS_BY_ID[it.itemId] && !(it.itemId.startsWith('seeds.') && RARE_CROP_IDS.includes(it.itemId.slice(6)))) return 'colporteur';
    }
  }
  // Graines rares, semis offerts, objets
  if (!obj(v.rare) || !RARE_CROP_IDS.every((id) => int(v.rare[id]))) return 'graines rares';
  if (!obj(v.freeSows) || !Object.entries(v.freeSows).every(([id, n]) => cropOk(id) && int(n))) return 'semis offerts';
  if (!obj(v.owned) || !['copperCan', 'almanac', 'horseshoe'].every((key) => typeof v.owned[key] === 'boolean')) return 'objets du colporteur';
  if (v.fertilizer !== null && !(obj(v.fertilizer) && int(v.fertilizer.left) && typeof v.fertilizer.growth === 'number')) return 'engrais';
  if (!obj(v.stats) || !int(v.stats.ordersDone) || !obj(v.stats.medals)) return 'statistiques de la variété';
  if (!['orders', 'variety'].every((key) => Number.isInteger(state.rng?.[key]))) return 'aléatoire de la variété';
  return null;
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────

/** Dernier jour absolu d'une saison absolue. */
export function seasonEndAbsOf(state, level, abs) {
  if (state.mode === 'career') {
    const L = state.career.seasonLength;
    return Math.floor(abs / 4) * 4 * L + ((abs % 4) + 1) * L;
  }
  let n = 0;
  for (let s = 0; s <= abs; s++) n += level.seasonLengths[s];
  return n;
}

/** Index (0..3) d'une saison absolue. */
const seasonIndexOf = (abs) => abs % 4;

/** Une partie (le printemps du niveau 1, ou de la 1re année de carrière) où la charrette, le colporteur et les défis n'existent pas encore. */
function firstSpring(host) {
  const { state, level } = host;
  if (state.time.seasonIndex !== 0) return false;
  return state.mode === 'career' ? state.time.year === 1 : !!level.tutorial;
}

/** Saison absolue de la saison suivante, et son index. */
function nextSeason(state) {
  const abs = vSeasonAbs(state) + 1;
  return { abs, si: seasonIndexOf(abs), sid: SEASONS[seasonIndexOf(abs)] };
}

// ── Compteurs de la saison (défis) ──────────────────────────────────────────────────────────────

/** Ajoute à un compteur de la saison (défis). key : 'harvests' | 'sales' | … ; pour 'harvested' / 'sown' : cropId. */
export function noteVariety(state, key, n = 1, cropId = null) {
  const v = state.variety;
  if (!v || !v.season) return;
  const s = v.season;
  if (key === 'harvested' || key === 'sown') {
    if (cropId) s[key][cropId] = (s[key][cropId] || 0) + n;
    return;
  }
  if (typeof s[key] === 'number') s[key] += n;
}

/**
 * Une récolte (n parcelles, n = 4 pour un géant) : compteurs des défis. info = { cropId, amount, quality, care, tree }.
 */
export function noteHarvest(state, { cropId, amount = 0, units = 1, quality = 'normal', care = false, tree = false }) {
  if (!state.variety?.season) return;
  noteVariety(state, 'harvests', units);
  noteVariety(state, 'harvested', units, cropId);
  if (amount > 0) noteVariety(state, 'sales', amount);
  if (care && !tree) noteVariety(state, 'care', units);
  if (quality === 'fine' || quality === 'gold') noteVariety(state, 'quality', 1);
  if (tree) noteVariety(state, 'apples', 1);
  if (isRareCrop(cropId)) state.variety.stats.rareHarvested[cropId] = (state.variety.stats.rareHarvested[cropId] || 0) + units;
}

// ── C4 — Défis ──────────────────────────────────────────────────────────────────────────────────

function kFactor(state, len) {
  const k = (openFieldPlots(state) / 12) * (len / 7);
  return Math.min(CHALLENGE_RULES.kMax, Math.max(CHALLENGE_RULES.kMin, k));
}

/** Cultures faisables (défis) d'une saison : celles qui se sèment cette saison-là et mûrissent dans sa durée. */
function seasonFeasible(host, si, current) {
  const len = seasonLen(host.state, host.level, si);
  if (current) return feasibleCrops(host, { horizon: len });
  return feasibleCrops(host, { horizon: len, season: SEASONS[si] });
}

function hasWorkshop(host) {
  const { state } = host;
  if (state.mode === 'career') return ['jamWorkshop', 'dairy', 'mill'].some((id) => !!state.career.buildings[id]);
  return Object.keys(state.processing || {}).length > 0;
}

function hasAnimal(host) {
  const { state, level } = host;
  if (state.mode === 'career') return false;
  return ['chickenCoop', 'cow', 'goat', 'sheep'].some((id) => (state.investments[id] || 0) > 0 && level.availableInvestments.includes(id));
}

function hasShelter(host) {
  const { state } = host;
  if (state.mode !== 'career') return false;
  return Object.entries(state.career.buildings).some(([id, b]) => b && ['coop', 'hutch', 'duckPond', 'goatShed', 'cowshed', 'sheepfold', 'pigsty'].includes(id));
}

/** Une charrette viendra-t-elle (saison d'index si) ? */
function cartExpected(host, si) {
  const v = host.state.variety;
  if (!v.parts.cart) return false;
  if (host.state.mode === 'career' && host.state.time.year === 1 && si === 0) return false;
  if (host.state.mode !== 'career' && host.level.tutorial && si === 0) return false;
  return true;
}

/** Le défi est-il possible pour la saison d'index si ? */
function challengePossible(host, def, si, current) {
  const { state } = host;
  const v = state.variety;
  const career = state.mode === 'career';
  if (def.mode === 'levels' && career) return false;
  if (def.mode === 'career' && !career) return false;
  switch (def.id) {
    case 'variety':
      return Object.keys(seasonFeasible(host, si, current)).length >= 2;
    case 'sowing':
      return Object.values(seasonFeasible(host, si, current)).filter((e) => e.reasons.includes('sowable')).length >= 2;
    case 'care':
    case 'quality':
      return !!state.surprises;
    case 'orders':
      return !!v.parts.board;
    case 'crates':
      return current ? !!v.cart : cartExpected(host, si);
    case 'products':
      return hasWorkshop(host);
    case 'apples':
      return adultTrees(state) > 0 && getCrop('apple').fruitSeasons.includes(SEASONS[si]);
    case 'animals':
      return hasAnimal(host);
    case 'collect':
      return hasShelter(host);
    default:
      return true;
  }
}

/** Cibles d'un défi pour la saison d'index si : [bronze, argent, or]. */
function challengeTargets(host, def, si, current) {
  const { state, level } = host;
  const len = seasonLen(state, level, si);
  const k = kFactor(state, len);
  let mult = 1;
  switch (def.scale) {
    case 'k':
      mult = k;
      break;
    case 'kMin1':
      mult = Math.max(1, k);
      break;
    case 'price':
      mult = k * (level.cropPriceFactor ?? 1);
      break;
    case 'days':
      mult = len / 7;
      break;
    case 'trees':
      mult = Math.max(1, adultTrees(state) / 2);
      break;
    default:
      mult = 1;
  }
  let t = def.targets.map((x) => Math.max(1, Math.round(x * mult)));
  if (def.perRank && state.mode === 'career') t = t.map((x) => x + (state.career.rank || 1));
  if (def.capFeasible) {
    const n = Object.keys(seasonFeasible(host, si, current)).length;
    t = t.map((x) => Math.max(1, Math.min(x, n)));
  }
  if (def.capCrates) {
    const n = current && state.variety.cart ? state.variety.cart.crates.length : cartCrateCount(state, level);
    t = t.map((x) => Math.max(1, Math.min(x, n)));
  }
  // Paliers croissants (au moins égaux).
  for (let i = 1; i < 3; i++) if (t[i] < t[i - 1]) t[i] = t[i - 1];
  return t;
}

/** Tire 3 défis différents (flux « variety »), jamais les mêmes trois que la saison précédente. */
function drawChallenges(host, si, current) {
  const v = host.state.variety;
  const possible = CHALLENGES.filter((def) => challengePossible(host, def, si, current));
  const rng = stream(host.state.rng, 'variety');
  const same = (a, b) => !!b && a.length === b.length && a.every((id) => b.includes(id));
  let options = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    let pool = [...possible];
    options = [];
    while (options.length < CHALLENGE_RULES.offered && pool.length) {
      const id = rng.weighted(Object.fromEntries(pool.map((d) => [d.id, d.weight])));
      options.push(id);
      pool = pool.filter((d) => d.id !== id);
    }
    if (!same(options, v.challenges.last) || possible.length <= CHALLENGE_RULES.offered) break;
  }
  const targets = Object.fromEntries(options.map((id) => [id, challengeTargets(host, CHALLENGES_BY_ID[id], si, current)]));
  return { options, targets };
}

/** Mesure d'un défi (compteurs de la saison). */
export function challengeProgress(state, id) {
  const s = state.variety?.season;
  if (!s) return 0;
  switch (id) {
    case 'variety':
      return Object.keys(s.harvested).length;
    case 'sowing':
      return Object.keys(s.sown).length;
    default:
      return Math.floor(s[id] || 0);
  }
}

function medalReward(state, tier) {
  const m = MEDALS[tier - 1];
  const rank = state.mode === 'career' ? state.career.rank || 1 : 1;
  return { medal: m.id, ecus: m.ecus, coins: state.mode === 'career' ? m.careerCoins * rank : m.coins };
}

/** Médailles des défis gardés : chaque palier atteint donne sa récompense, tout de suite. */
export function checkMedals(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.challenges) return [];
  const ch = v.challenges;
  if (ch.season === null || ch.season !== vSeasonAbs(state) || !v.season || v.season.abs !== ch.season) return [];
  const out = [];
  for (const id of ch.kept) {
    const t = ch.targets[id];
    if (!t) continue;
    const p = challengeProgress(state, id);
    const tier = t.filter((x) => p >= x).length;
    while ((ch.medals[id] || 0) < tier) {
      const next = (ch.medals[id] || 0) + 1;
      ch.medals[id] = next;
      const r = medalReward(state, next);
      v.stats.medals[r.medal] += 1;
      v.stats.medalEcus += r.ecus;
      if (r.coins > 0) {
        v.stats.medalCoins += r.coins;
        host.earn('medals', r.coins);
      }
      if (v.season) v.season.medals = (v.season.medals || 0) + 1;
      const ev = { challengeId: id, name: CHALLENGES_BY_ID[id].name, medal: r.medal, ecus: r.ecus, coins: r.coins };
      host.push('challengeMedal', ev);
      out.push(ev);
    }
  }
  return out;
}

function challengeInfo(host, id, set, { current }) {
  const { state } = host;
  const def = CHALLENGES_BY_ID[id];
  const targets = set.targets[id] || challengeTargets(host, def, state.time.seasonIndex, true);
  const medal = current ? state.variety.challenges.medals[id] || 0 : 0;
  const kept = (set.kept || []).includes(id);
  return {
    id,
    name: def.name,
    icon: `icon.challenge.${id}`,
    text: fill(def.text, { n: targets[0] }),
    progress: current ? challengeProgress(state, id) : 0,
    targets: [...targets],
    medal,
    kept,
    locked: medal > 0,
    rewards: [1, 2, 3].map((tier) => medalReward(state, tier)),
  };
}

// ── C2 — Cartes ─────────────────────────────────────────────────────────────────────────────────

/** La carte est-elle possible (pour la saison d'index si, celle de l'effet) ? */
function cardPossible(host, id, si) {
  const { state, level } = host;
  const v = state.variety;
  const career = state.mode === 'career';
  switch (id) {
    case 'hen':
      return career ? !host.canGive('hen', CARD_VALUES.hen.careerHens) : true;
    case 'watering':
      return !level.modifiers?.noSprinkler;
    case 'clover':
      return !!state.surprises;
    case 'bees':
      return !host.canGive('beehive', 1);
    case 'crier':
      return !!v.parts.board;
    case 'cartHorse':
      return !!v.parts.cart && (!!v.cart || cartExpected(host, si));
    case 'clearing':
      return host.clearingPossible();
    case 'recipe':
      return hasWorkshop(host);
    case 'hay':
      return career ? hasShelter(host) && Object.entries(state.investments).some(([id2, n]) => n > 0 && ['hen', 'rabbit', 'duck', 'goat', 'cow'].includes(id2)) : ['chickenCoop', 'cow', 'goat'].some((x) => (state.investments[x] || 0) > 0);
    case 'almanac':
      return !hasVarietyAlmanac(state) && !(state.perks?.almanac > 0);
    default:
      return true;
  }
}

/** Valeur affichée d'une carte (pièces de la bourse, graines du sachet…). */
function cardValue(host, id, seasonAbsOfEffect) {
  const { state } = host;
  const career = state.mode === 'career';
  const rank = career ? state.career.rank || 1 : 1;
  if (id === 'purse') {
    const p = CARD_VALUES.purse;
    return career ? p.careerBase + p.careerPerRank * rank : p.base + p.perSeason * Math.max(1, seasonIndexOf(seasonAbsOfEffect));
  }
  if (id === 'seedBag') return { cropId: RARE_OF_SEASON[SEASONS[seasonIndexOf(seasonAbsOfEffect)]], n: career ? CARD_VALUES.seedBag.careerSeeds : CARD_VALUES.seedBag.seeds };
  if (id === 'watering') return career ? CARD_VALUES.watering.careerPlots : CARD_VALUES.watering.plots;
  return null;
}

export function cardInfo(host, id, seasonAbsOfEffect = vSeasonAbs(host.state)) {
  const career = host.state.mode === 'career';
  const def = CARDS_BY_ID[id];
  const value = cardValue(host, id, seasonAbsOfEffect);
  let text = career && def.careerText ? def.careerText : def.text;
  if (id === 'purse') text = fill(text, { amount: value });
  if (id === 'seedBag') text = fill(text, { n: value.n, crop: getCrop(value.cropId).name.toLowerCase() });
  if (id === 'watering') text = fill(text, { n: value });
  const kind = career && def.careerKind ? def.careerKind : def.kind;
  return { id, name: career && def.careerName ? def.careerName : def.name, icon: `icon.card.${id}`, text, kind, ...(value !== null ? { value: typeof value === 'object' ? { ...value } : value } : {}) };
}

/** Propose deux cartes (fin de saison) pour la saison suivante (flux « variety »). → données de cardsOffered | null */
export function offerCards(host) {
  const { state } = host;
  const v = state.variety;
  if (!v.parts.cards) return null;
  const next = nextSeason(state);
  const possible = CARDS.filter((c) => cardPossible(host, c.id, next.si));
  if (possible.length < 2) return null;
  const rng = stream(state.rng, 'variety');
  const same = (a, b) => !!b && a.length === b.length && a.every((id) => b.includes(id));
  let options = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    let pool = [...possible];
    options = [];
    while (options.length < 2 && pool.length) {
      const id = rng.weighted(Object.fromEntries(pool.map((c) => [c.id, c.weight])));
      options.push(id);
      pool = pool.filter((c) => c.id !== id);
    }
    if (!same(options, v.cards.last) || possible.length <= 2) break;
  }
  v.cards.offer = { season: next.abs, options };
  v.cards.last = [...options];
  return { season: next.abs, seasonName: SEASON_NAMES[next.sid], options: options.map((id) => cardInfo(host, id, next.abs)) };
}

/** Garde une carte. → { ok, card, amount?, gift? } | { ok: false, reason } */
export function pickCard(host, cardId) {
  const { state, level } = host;
  const v = state.variety;
  if (!v || !v.parts.cards || !v.cards.offer) return host.fail('Pas de cadeau à choisir.');
  const offer = v.cards.offer;
  if (!offer.options.includes(cardId)) return host.fail('Cette carte n\'est pas proposée.');
  const si = seasonIndexOf(offer.season);
  if (!cardPossible(host, cardId, si)) return host.fail('Plus possible : choisissez l\'autre carte.');
  const career = state.mode === 'career';
  const card = cardInfo(host, cardId, offer.season);
  const out = { ok: true, card };
  const until = seasonEndAbsOf(state, level, offer.season);
  const activate = () => v.cards.active.push({ id: cardId, season: offer.season, until });
  switch (cardId) {
    case 'purse': {
      out.amount = card.value;
      v.stats.cardIncome += out.amount;
      host.earn('cards', out.amount);
      break;
    }
    case 'hen':
      if (career) {
        const r = host.giveInvestment('hen', CARD_VALUES.hen.careerHens, 0);
        if (!r.ok) return host.fail('Plus possible : choisissez l\'autre carte.');
        out.gift = { investmentId: 'hen', n: CARD_VALUES.hen.careerHens };
      } else activate();
      break;
    case 'bees': {
      const r = host.giveInvestment('beehive', 1, 0);
      if (!r.ok) return host.fail('Plus possible : choisissez l\'autre carte.');
      out.gift = { investmentId: 'beehive', n: 1 };
      break;
    }
    case 'landlord':
      if (career) v.cards.pending.chargeFactor = CARD_VALUES.landlord.factor;
      else v.cards.pending.rentFactor = CARD_VALUES.landlord.factor;
      break;
    case 'cartHorse':
      if (v.cart) v.cart.horse = true;
      else v.cards.pending.cartFactor = CARD_VALUES.cartHorse.factor;
      break;
    case 'clearing':
      if (career) v.cards.pending.clearingHalf = true;
      else v.cards.pending.freePlot = true;
      break;
    case 'seedBag': {
      const { cropId, n } = card.value;
      v.rare[cropId] = (v.rare[cropId] || 0) + n;
      out.gift = { cropId, n, rare: true };
      break;
    }
    case 'almanac': {
      // Niveaux : jusqu'à la fin de la partie ; carrière : jusqu'à la fin de l'année.
      const end = career ? seasonEndAbsOf(state, level, Math.floor(vSeasonAbs(state) / 4) * 4 + 3) : level.seasonLengths.reduce((a, b) => a + b, 0);
      v.cards.active.push({ id: 'almanac', season: null, until: Math.max(end, until) });
      break;
    }
    default:
      activate();
  }
  v.cards.offer = null;
  v.stats.cardsPicked[cardId] = (v.stats.cardsPicked[cardId] || 0) + 1;
  if (host.refreshLevel) host.refreshLevel();
  host.push('cardPicked', { card, ...(out.amount ? { amount: out.amount } : {}), ...(out.gift ? { gift: out.gift } : {}) });
  return out;
}

/** Retire les cartes dont l'effet est passé. → [{ id, name }] */
function expireCards(host) {
  const { state } = host;
  const v = state.variety;
  const today = vAbsDay(state);
  const ended = [];
  v.cards.active = v.cards.active.filter((c) => {
    if (c.until >= today) return true;
    ended.push({ id: c.id, name: cardInfo(host, c.id, c.season ?? vSeasonAbs(state)).name });
    return false;
  });
  return ended;
}

// ── C7 — Le colporteur ──────────────────────────────────────────────────────────────────────────

/** Jour de la saison où Basile arrive. */
export function merchantArriveDayOfSeason(len) {
  return len < MERCHANT.shortSeason ? MERCHANT.shortDay : MERCHANT.day;
}

/** Programme le passage de Basile pour la saison en cours (1er jour). */
function scheduleMerchant(host) {
  const { state, level } = host;
  const v = state.variety;
  if (!v.parts.merchant || firstSpring(host)) {
    v.merchant = null;
    return;
  }
  const len = seasonLen(state, level);
  const start = vAbsDay(state) - state.time.dayOfSeason + 1;
  const arrive = start + merchantArriveDayOfSeason(len) - 1;
  const leave = Math.min(arrive + MERCHANT.stay - 1, start + len - 1);
  v.merchant = { season: vSeasonAbs(state), soonDay: arrive - 1, arriveDay: arrive, leaveDay: leave, announced: false, stall: [] };
}

function itemPrice(host, item) {
  const career = host.state.mode === 'career';
  const p = career ? item.careerPrice : item.price;
  if (p === 'used') {
    const id = item.id === 'usedCoop' ? 'chickenCoop' : 'beehive';
    const next = host.nextCost(id);
    return next === null ? null : Math.round(next * MERCHANT.usedFactor);
  }
  return p;
}

function itemPossible(host, item) {
  const { state, level } = host;
  const v = state.variety;
  const career = state.mode === 'career';
  if (itemPrice(host, item) === null || itemPrice(host, item) === undefined) return false;
  if (item.unique && v.owned[item.id]) return false;
  if (item.cosmeticId && (v.stats.merchantBought[item.id] || 0) > 0) return false;
  switch (item.id) {
    case 'fertilizer':
      if (career) return !state.career.events?.fertilizer && state.plots.some((p) => p.env === 'field' && p.cropId && !isMature(p));
      return !v.fertilizer;
    case 'usedCoop':
      return !host.canGive('chickenCoop', 1);
    case 'hens':
      return !host.canGive('hen', item.count);
    case 'usedHive':
      return !host.canGive('beehive', 1);
    case 'copperCan':
      return !level.modifiers?.noSprinkler;
    case 'almanac':
      return !(state.perks?.almanac > 0) && !hasVarietyAlmanac(state);
    case 'horseshoe':
      return !!state.surprises;
    case 'heirloom':
      return career;
    default:
      return true;
  }
}

/** Étal tiré à l'arrivée (flux « variety ») : un sachet de graines rares de saison + 2 (ou 3) objets. */
function drawStall(host) {
  const { state } = host;
  const career = state.mode === 'career';
  const rng = stream(state.rng, 'variety');
  const stall = [];
  const rare = RARE_OF_SEASON[SEASONS[state.time.seasonIndex]];
  if (rare) {
    const s = RARE_SEEDS[rare];
    stall.push({ itemId: `seeds.${rare}`, price: career ? s.careerPrice : s.price, sold: false, data: { cropId: rare, seeds: career ? s.careerSeeds : s.seeds } });
  }
  const n = career && (state.career.rank || 1) >= MERCHANT.careerMoreAt ? MERCHANT.careerItems : MERCHANT.items;
  let pool = MERCHANT_ITEMS.filter((it) => itemPossible(host, it));
  for (let k = 0; k < n && pool.length; k++) {
    const id = rng.weighted(Object.fromEntries(pool.map((it) => [it.id, it.weight])));
    const item = MERCHANT_ITEMS_BY_ID[id];
    pool = pool.filter((it) => it.id !== id);
    stall.push({ itemId: id, price: itemPrice(host, item), sold: false });
  }
  return stall;
}

/** Aube : annonce la veille, arrivée de Basile. → [[type, payload]] */
function merchantDawn(host) {
  const { state } = host;
  const m = state.variety.merchant;
  const events = [];
  if (!m) return events;
  const today = vAbsDay(state);
  if (today === m.soonDay && !m.announced) {
    m.announced = true;
    events.push(['merchantSoon', { arriveDay: m.arriveDay, text: MERCHANT.soonText }]);
  }
  if (today === m.arriveDay && !m.stall.length) {
    m.announced = true;
    m.stall = drawStall(host);
    events.push(['merchantArrived', { merchant: merchantInfo(host), text: MERCHANT.arriveText }]);
  }
  return events;
}

/** Soir : Basile repart (soir de son dernier jour). */
export function merchantEvening(host) {
  const { state } = host;
  const m = state.variety?.merchant;
  if (!m || vAbsDay(state) !== m.leaveDay) return;
  const sold = m.stall.filter((it) => it.sold).map((it) => it.itemId);
  state.variety.merchant = null;
  host.push('merchantLeft', { sold, text: MERCHANT.leaveText });
}

function itemDisplay(host, it) {
  const career = host.state.mode === 'career';
  if (it.itemId.startsWith('seeds.')) {
    const cropId = it.itemId.slice(6);
    const crop = getCrop(cropId);
    const seeds = it.data?.seeds ?? (career ? RARE_SEEDS[cropId].careerSeeds : RARE_SEEDS[cropId].seeds);
    return { name: `Sachet de graines rares : ${crop.name.toLowerCase()}`, icon: `seedbag.${cropId}`, text: `${seeds} semis de ${crop.name.toLowerCase()} (graines comprises).`, unique: false, cropId, seeds };
  }
  const item = MERCHANT_ITEMS_BY_ID[it.itemId];
  let text = career && item.careerText ? item.careerText : item.text;
  if (item.id === 'copperCan') text = fill(text, { n: career ? item.careerPlots : item.plots });
  return { name: item.name, icon: `item.${item.id}`, text, unique: !!item.unique, ...(item.cosmeticId ? { cosmeticId: item.cosmeticId } : {}) };
}

/** Fiche du colporteur (query.merchant). */
export function merchantInfo(host) {
  const { state } = host;
  const m = state.variety?.merchant;
  if (!m) return null;
  const today = vAbsDay(state);
  const here = today >= m.arriveDay && today <= m.leaveDay && m.stall.length > 0;
  return {
    here,
    soon: today < m.arriveDay,
    arriveDay: m.arriveDay,
    leaveDay: m.leaveDay,
    daysLeft: Math.max(0, m.leaveDay - today),
    daysUntil: Math.max(0, m.arriveDay - today),
    name: MERCHANT.name,
    portrait: MERCHANT.portrait,
    line: MERCHANT.line,
    stall: m.stall.map((it) => {
      const d = itemDisplay(host, it);
      const check = here && !it.sold ? buyCheck(host, it) : null;
      return { itemId: it.itemId, ...d, price: it.price, sold: it.sold, canBuy: here && !it.sold && !check, reason: it.sold ? 'Déjà vendu.' : !here ? 'Le colporteur n\'est pas là.' : check };
    }),
  };
}

/** Raison qui empêche l'achat (ou null). */
function buyCheck(host, it) {
  const { state } = host;
  if (state.money < it.price) return notEnough(it.price - state.money);
  const item = MERCHANT_ITEMS_BY_ID[it.itemId];
  if (!item) return null;
  if (item.id === 'usedCoop' && host.canGive('chickenCoop', 1)) return 'Le poulailler est plein.';
  if (item.id === 'hens' && host.canGive('hen', item.count)) return 'Le poulailler est plein.';
  if (item.id === 'usedHive' && host.canGive('beehive', 1)) return 'Plus de place pour une ruche.';
  if (item.unique && state.variety.owned[item.id]) return 'Déjà à vous.';
  return null;
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

/** Achat à l'étal. → { ok, item, cost, cosmeticId?, ecusIfOwned?, heirloom? } */
export function buyFromMerchant(host, itemId, arg) {
  const { state } = host;
  const v = state.variety;
  const m = v?.merchant;
  const today = vAbsDay(state);
  if (!m || !v.parts.merchant || today < m.arriveDay || today > m.leaveDay || !m.stall.length) return host.fail('Le colporteur n\'est pas là.');
  const it = m.stall.find((x) => x.itemId === itemId);
  if (!it) return host.fail('Cet objet n\'est pas à l\'étal.');
  if (it.sold) return host.fail('Déjà vendu.');
  const bad = buyCheck(host, it);
  if (bad) return host.fail(bad);
  const career = state.mode === 'career';
  const d = itemDisplay(host, it);
  const out = { ok: true, item: { itemId, name: d.name, icon: d.icon }, cost: it.price };
  if (itemId.startsWith('seeds.')) {
    host.spend('merchant', it.price);
    v.rare[d.cropId] = (v.rare[d.cropId] || 0) + d.seeds;
    out.seeds = { cropId: d.cropId, n: d.seeds };
  } else {
    const item = MERCHANT_ITEMS_BY_ID[itemId];
    switch (itemId) {
      case 'fertilizer':
        host.spend('merchant', it.price);
        if (career) host.careerFertilizer(arg, item);
        else v.fertilizer = { left: item.days, growth: item.growth };
        break;
      case 'usedCoop': {
        const r = host.giveInvestment('chickenCoop', 1, it.price);
        if (!r.ok) return host.fail(r.reason);
        break;
      }
      case 'hens': {
        const r = host.giveInvestment('hen', item.count, it.price);
        if (!r.ok) return host.fail(r.reason);
        break;
      }
      case 'usedHive': {
        const r = host.giveInvestment('beehive', 1, it.price);
        if (!r.ok) return host.fail(r.reason);
        break;
      }
      case 'copperCan':
      case 'almanac':
      case 'horseshoe':
        host.spend('merchant', it.price);
        v.owned[itemId] = true;
        break;
      case 'lantern':
      case 'weathervane':
        host.spend('merchant', it.price);
        out.cosmeticId = item.cosmeticId;
        out.ecusIfOwned = MERCHANT_ECUS_IF_OWNED;
        break;
      case 'heirloom': {
        host.spend('merchant', it.price);
        const pool = CROPS.filter((c) => !isTreeCrop(c));
        const crop = pool[stream(state.rng, 'variety').int(0, pool.length - 1)];
        state.career.heirlooms.push({ cropId: crop.id, lotId: 'home', year: state.time.year, day: state.time.day, from: 'merchant' });
        out.heirloom = { cropId: crop.id, cropName: crop.name };
        break;
      }
      default:
        host.spend('merchant', it.price);
    }
  }
  it.sold = true;
  v.stats.merchantSpent += it.price;
  v.stats.merchantBought[itemId] = (v.stats.merchantBought[itemId] || 0) + 1;
  if (host.refreshLevel) host.refreshLevel();
  host.push('merchantBought', { itemId, name: d.name, price: it.price, ...(out.cosmeticId ? { cosmeticId: out.cosmeticId, ecusIfOwned: out.ecusIfOwned } : {}), ...(out.heirloom ? { heirloom: out.heirloom } : {}), ...(out.seeds ? { seeds: out.seeds } : {}) });
  return out;
}

// ── Arrosoirs (carte, objet) et engrais du colporteur (niveaux) ────────────────────────────────

/** Parcelles arrosées chaque matin par l'arrosoir magique et l'arrosoir de cuivre (après l'arrosage automatique). */
export function varietyWater(host, weather) {
  const { state, level } = host;
  const v = state.variety;
  if (!v) return [];
  const career = state.mode === 'career';
  let n = 0;
  if (cardActive(state, 'watering')) n += career ? CARD_VALUES.watering.careerPlots : CARD_VALUES.watering.plots;
  if (v.owned.copperCan) n += career ? MERCHANT_ITEMS_BY_ID.copperCan.careerPlots : MERCHANT_ITEMS_BY_ID.copperCan.plots;
  if (n <= 0) return [];
  const cands = [];
  state.plots.forEach((p, i) => {
    if (!p.cropId || !p.unlocked || p.env === null || p.watered || isMature(p)) return;
    if (career && p.env !== 'field' && p.env !== 'greenhouse') return;
    const crop = getCrop(p.cropId);
    if (isTreeCrop(crop) || !needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : weather, level)) return;
    cands.push({ i, progress: p.growth / crop.growDays });
  });
  cands.sort((a, b) => a.progress - b.progress || a.i - b.i);
  const out = [];
  for (const c of cands.slice(0, n)) {
    state.plots[c.i].watered = true;
    out.push(c.i);
  }
  return out;
}

/** Engrais du colporteur (niveaux) : +¼ de jour de pousse par aube, tout le champ, pendant 3 aubes. */
function applyFertilizer(state) {
  const f = state.variety.fertilizer;
  if (!f) return;
  for (const p of state.plots) {
    if (!p.cropId || !p.unlocked) continue;
    const crop = getCrop(p.cropId);
    if (isTreeCrop(crop) || isMature(p)) continue;
    p.growth = Math.min(crop.growDays, p.growth + f.growth);
  }
  f.left -= 1;
  if (f.left <= 0) state.variety.fertilizer = null;
}

// ── Déroulé ─────────────────────────────────────────────────────────────────────────────────────

/** Défis de la saison qui commence : ceux proposés la veille, sinon un tirage. */
function startChallenges(host, { force = false } = {}) {
  const { state } = host;
  const v = state.variety;
  const ch = v.challenges;
  const abs = vSeasonAbs(state);
  if (!v.parts.challenges || (firstSpring(host) && !force)) {
    ch.season = null;
    ch.options = [];
    ch.kept = [];
    ch.targets = {};
    ch.medals = {};
    ch.next = null;
    return null;
  }
  const si = state.time.seasonIndex;
  let options;
  let kept = [];
  if (ch.next && ch.next.season === abs) {
    options = ch.next.options.filter((id) => challengePossible(host, CHALLENGES_BY_ID[id], si, true));
    kept = (ch.next.kept || []).filter((id) => options.includes(id));
    if (options.length < 2) options = null;
  }
  if (ch.options.length) ch.last = [...ch.options];
  if (!options) options = drawChallenges(host, si, true).options;
  ch.season = abs;
  ch.options = options;
  ch.kept = kept;
  ch.targets = Object.fromEntries(options.map((id) => [id, challengeTargets(host, CHALLENGES_BY_ID[id], si, true)]));
  ch.medals = {};
  ch.next = null;
  return { season: abs, options };
}

/** Nouvelle saison (aube du 1er jour, ou création de la partie). → [[type, payload]] */
function seasonStartVariety(host, { creation = false } = {}) {
  const { state } = host;
  const v = state.variety;
  const events = [];
  v.season = newSeasonCounters(vSeasonAbs(state));
  // Commandes gardées devenues impossibles : retirées gentiment (prime des unités données).
  if (!creation && v.parts.board) {
    v.board.slots.forEach((o, k) => {
      if (!o) return;
      if (!o.kept && !orderStarted(o)) return; // renouvelée plus bas
      if (!orderStillFeasible(host, o)) {
        const pushed = [];
        removeOrder({ ...host, push: (t, p) => pushed.push([t, p]) }, k, 'withdrawn');
        events.push(...pushed);
      }
    });
  }
  // Charrette.
  if (v.parts.cart && !firstSpring(host)) {
    v.cart = drawCart(host);
    if (v.cart) events.push(['cartArrived', { cart: cartInfo(host), text: 'La charrette du marché est arrivée : remplissez ses caisses avant le dernier soir de la saison.' }]);
  } else v.cart = null;
  // Défis (après la charrette : « La charrette pleine » a besoin du nombre de caisses).
  startChallenges(host);
  // Colporteur.
  scheduleMerchant(host);
  return events;
}

/** Débogage : Basile arrive tout de suite (étal tiré, événements). → true si arrivé. */
export function varietyDawnMerchant(host) {
  const events = merchantDawn(host);
  for (const [t, p] of events) host.push(t, p);
  return events.some(([t]) => t === 'merchantArrived');
}

/** Débogage : défis de la saison tirés à nouveau. */
export function varietyRestartChallenges(host) {
  if (!host.state.variety.season) host.state.variety.season = newSeasonCounters(vSeasonAbs(host.state));
  const r = startChallenges(host, { force: true });
  if (r) host.push('challengesOffered', { season: r.season, seasonName: SEASON_NAMES[SEASONS[seasonIndexOf(r.season)]], options: r.options.map((id) => challengeInfo(host, id, host.state.variety.challenges, { current: true })), current: true });
  return !!r;
}

/** Création de la partie : 1re saison (tableau rempli, charrette, défis, colporteur programmé). */
export function varietyStart(host) {
  const { state, level } = host;
  const v = state.variety;
  if (!v) return;
  if (state.mode !== 'career' && level.tutorial) v.board.startDay = BOARD.level1Start;
  seasonStartVariety(host, { creation: true });
  if (v.parts.board && vAbsDay(state) >= v.board.startDay) renewBoard(host);
}

/**
 * Aube (niveaux : après le marché et les surprises du lot 2 ; carrière : seasonStart + dawnEvents). → [[type, payload]]
 * @param {object} opts { newSeason }
 */
export function varietyDawn(host, { newSeason = false } = {}) {
  const { state } = host;
  const v = state.variety;
  if (!v) return [];
  const events = [];
  const collect = { ...host, push: (t, p) => events.push([t, p]) };
  // 1. Cartes échues.
  for (const e of expireCards(collect)) events.push(['cardEnded', e]);
  // 2. Nouvelle saison.
  if (newSeason || !v.season || v.season.abs !== vSeasonAbs(state)) events.push(...seasonStartVariety(collect, { creation: false }));
  // Engrais du colporteur (niveaux).
  if (v.fertilizer && state.mode !== 'career') applyFertilizer(state);
  // 3. Colporteur.
  events.push(...merchantDawn(collect));
  // 4. Tableau.
  v.board.done = [];
  if (v.parts.board) {
    const today = vAbsDay(state);
    if (today >= v.board.startDay) {
      const before = v.board.slots.filter(Boolean).length;
      v.board.yesterday = [...boardCrops(state)];
      const first = before === 0 && today === v.board.startDay;
      const r = renewBoard(collect);
      if (r.added || r.replaced) {
        events.push(['ordersRenewed', { reason: first ? 'start' : 'dawn', slots: v.board.slots.map((o) => (o ? orderInfo(host, o) : null)), added: r.added + r.replaced }]);
      }
    }
  }
  return events;
}

/**
 * Soir du dernier jour de la saison, AVANT le fermage / les charges : départ de la charrette. → données | null
 */
export function varietyCartEvening(host) {
  const v = host.state.variety;
  if (!v || !v.cart) return null;
  return departCart(host);
}

/** Juge les défis de la saison (fin de saison). → données de challengesJudged | null */
export function judgeChallenges(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.challenges) return null;
  const ch = v.challenges;
  if (ch.season === null || ch.season !== vSeasonAbs(state)) return null;
  checkMedals(host);
  return { season: ch.season, seasonName: SEASON_NAMES[SEASONS[seasonIndexOf(ch.season)]], results: ch.kept.map((id) => ({ challengeId: id, name: CHALLENGES_BY_ID[id].name, medal: ch.medals[id] || 0 })) };
}

/** Propose les défis de la saison suivante (soir du dernier jour). → données de challengesOffered | null */
export function offerChallenges(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.challenges) return null;
  const next = nextSeason(state);
  if (v.challenges.options.length) v.challenges.last = [...v.challenges.options];
  const draw = drawChallenges(host, next.si, false);
  v.challenges.next = { season: next.abs, options: draw.options, targets: draw.targets, kept: [] };
  return {
    season: next.abs,
    seasonName: SEASON_NAMES[next.sid],
    options: draw.options.map((id) => challengeInfo(host, id, v.challenges.next, { current: false })),
  };
}

// ── Actions du tableau ──────────────────────────────────────────────────────────────────────────

function findOrder(state, orderId) {
  const slots = state.variety?.board?.slots || [];
  const k = slots.findIndex((o) => o && o.id === orderId);
  return k >= 0 ? { k, order: slots[k] } : null;
}

export function keepOrder(host, orderId, keep = true) {
  const f = findOrder(host.state, orderId);
  if (!f) return host.fail('Commande inconnue.');
  if (!keep && orderStarted(f.order)) return host.fail('Une commande commencée reste gardée.');
  f.order.kept = !!keep;
  return { ok: true, order: orderInfo(host, f.order) };
}

export function declineOrder(host, orderId) {
  const f = findOrder(host.state, orderId);
  if (!f) return host.fail('Commande inconnue.');
  const { premium } = removeOrder(host, f.k, 'declined');
  return { ok: true, premium };
}

export function rerollOrders(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.board) return host.fail('Pas de tableau du village.');
  const today = vAbsDay(state);
  if (today < v.board.startDay) return host.fail('Le tableau n\'a pas encore de commandes.');
  if (v.board.rerollDay === today) return host.fail('Une seule relance par jour : revenez demain.');
  const replaceable = v.board.slots.filter((o) => o && !o.kept && !orderStarted(o)).length;
  if (!replaceable) return host.fail('Toutes les commandes sont gardées.');
  v.board.rerollDay = today;
  const r = renewBoard(host, { fill: false });
  host.push('ordersRenewed', { reason: 'reroll', slots: v.board.slots.map((o) => (o ? orderInfo(host, o) : null)), added: r.replaced });
  return { ok: true, replaced: r.replaced };
}

// ── Défis : garder ──────────────────────────────────────────────────────────────────────────────

export function keepChallenge(host, challengeId, keep = true) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.challenges || !CHALLENGES_BY_ID[challengeId]) return host.fail('Défi inconnu.');
  const ch = v.challenges;
  const current = ch.season !== null && ch.season === vSeasonAbs(state) && ch.options.includes(challengeId);
  const set = current ? ch : ch.next && ch.next.options.includes(challengeId) ? ch.next : null;
  if (!set) return host.fail('Défi inconnu.');
  if (!set.kept) set.kept = [];
  if (keep) {
    if (!set.kept.includes(challengeId)) {
      if (set.kept.length >= CHALLENGE_RULES.keepMax) return host.fail('Deux défis au plus.');
      set.kept.push(challengeId);
    }
    if (current) checkMedals(host);
  } else {
    if (current && (ch.medals[challengeId] || 0) > 0) return host.fail('Ce défi a déjà une médaille.');
    set.kept = set.kept.filter((id) => id !== challengeId);
  }
  return { ok: true, kept: [...set.kept] };
}

// ── Requêtes ────────────────────────────────────────────────────────────────────────────────────

export function ordersQuery(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.board) return null;
  const today = vAbsDay(state);
  const done = new Map((v.board.done || []).map((d) => [d.slot, d]));
  const slots = v.board.slots.map((o, k) => {
    if (o) return orderInfo(host, o);
    const d = done.get(k);
    return { empty: true, text: 'Nouvelle demande demain matin', ...(d ? { delivered: true, clientId: d.clientId, clientName: CLIENTS_BY_ID[d.clientId].name } : {}) };
  });
  const replaceable = v.board.slots.some((o) => o && !o.kept && !orderStarted(o));
  let rerollReason = null;
  if (today < v.board.startDay) rerollReason = 'Le tableau n\'a pas encore de commandes.';
  else if (v.board.rerollDay === today) rerollReason = 'Une seule relance par jour : revenez demain.';
  else if (!replaceable) rerollReason = 'Toutes les commandes sont gardées.';
  return { slots, canReroll: rerollReason === null, rerollReason, startsIn: Math.max(0, v.board.startDay - today) };
}

export function cardsQuery(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.cards) return null;
  const today = vAbsDay(state);
  const offer = v.cards.offer;
  return {
    offer: offer ? { season: offer.season, seasonName: SEASON_NAMES[SEASONS[seasonIndexOf(offer.season)]], options: offer.options.map((id) => cardInfo(host, id, offer.season)) } : null,
    active: v.cards.active.filter((c) => c.season === null || c.season >= vSeasonAbs(state)).map((c) => ({ ...cardInfo(host, c.id, c.season ?? vSeasonAbs(state)), until: c.until, daysLeft: Math.max(0, c.until - today), season: c.season, current: cardActive(state, c.id) })),
    pending: { ...v.cards.pending },
  };
}

export function challengesQuery(host) {
  const { state } = host;
  const v = state.variety;
  if (!v || !v.parts.challenges) return null;
  const ch = v.challenges;
  const current = ch.season !== null && ch.season === vSeasonAbs(state);
  return {
    season: current ? ch.season : null,
    seasonName: current ? SEASON_NAMES[SEASONS[seasonIndexOf(ch.season)]] : null,
    options: current ? ch.options.map((id) => challengeInfo(host, id, ch, { current: true })) : [],
    kept: current ? [...ch.kept] : [],
    canKeepMore: current && ch.kept.length < CHALLENGE_RULES.keepMax,
    next: ch.next ? { season: ch.next.season, seasonName: SEASON_NAMES[SEASONS[seasonIndexOf(ch.next.season)]], options: ch.next.options.map((id) => challengeInfo(host, id, ch.next, { current: false })), kept: [...(ch.next.kept || [])] } : null,
  };
}

export function merchantQuery(host) {
  const v = host.state.variety;
  if (!v || !v.parts.merchant) return null;
  return merchantInfo(host);
}

/** Effets en cours (cartes « saison », objets du colporteur). */
function effectsList(host) {
  const { state } = host;
  const v = state.variety;
  const today = vAbsDay(state);
  const out = [];
  for (const c of v.cards.active) {
    if (!cardActive(state, c.id)) continue;
    const info = cardInfo(host, c.id, c.season ?? vSeasonAbs(state));
    out.push({ id: `card.${c.id}`, name: info.name, icon: info.icon, text: info.text, until: c.until, daysLeft: Math.max(0, c.until - today) });
  }
  const p = v.cards.pending;
  if (p.rentFactor !== 1) out.push({ id: 'card.landlord', name: CARDS_BY_ID.landlord.name, icon: 'icon.card.landlord', text: 'Prochain fermage −20 %.', until: null, daysLeft: null });
  if (p.chargeFactor !== 1) out.push({ id: 'card.landlord', name: CARDS_BY_ID.landlord.careerName, icon: 'icon.card.landlord', text: 'Prochaines charges de saison −20 %.', until: null, daysLeft: null });
  if (p.cartFactor !== 1 || v.cart?.horse) out.push({ id: 'card.cartHorse', name: CARDS_BY_ID.cartHorse.name, icon: 'icon.card.cartHorse', text: 'Prime de la charrette × 2.', until: null, daysLeft: null });
  if (p.freePlot) out.push({ id: 'card.clearing', name: CARDS_BY_ID.clearing.name, icon: 'icon.card.clearing', text: 'Prochaine parcelle achetée gratuite.', until: null, daysLeft: null });
  if (p.clearingHalf) out.push({ id: 'card.clearing', name: CARDS_BY_ID.clearing.name, icon: 'icon.card.clearing', text: 'Prochain aménagement de terrain −25 %.', until: null, daysLeft: null });
  for (const id of ['copperCan', 'almanac', 'horseshoe']) {
    if (!v.owned[id]) continue;
    const item = MERCHANT_ITEMS_BY_ID[id];
    const career = state.mode === 'career';
    out.push({ id: `item.${id}`, name: item.name, icon: `item.${id}`, text: fill(career && item.careerText ? item.careerText : item.text, { n: career ? item.careerPlots : item.plots }), until: null, daysLeft: null });
  }
  if (v.fertilizer) out.push({ id: 'item.fertilizer', name: MERCHANT_ITEMS_BY_ID.fertilizer.name, icon: 'item.fertilizer', text: MERCHANT_ITEMS_BY_ID.fertilizer.text, until: today + v.fertilizer.left - 1, daysLeft: v.fertilizer.left - 1 });
  return out;
}

/** Calendrier du lot : colporteur, départ de la charrette (+ fête et visiteur du thème : carrière). */
function calendarList(host) {
  const { state } = host;
  const v = state.variety;
  const today = vAbsDay(state);
  const out = [];
  if (v.merchant && v.merchant.leaveDay >= today) out.push({ kind: 'merchant', day: v.merchant.arriveDay, daysUntil: Math.max(0, v.merchant.arriveDay - today), text: today >= v.merchant.arriveDay ? `${MERCHANT.name} est là.` : `${MERCHANT.name} passe ${v.merchant.arriveDay - today === 1 ? 'demain' : `dans ${v.merchant.arriveDay - today} jours`}.` });
  if (v.cart) out.push({ kind: 'cartDeparture', day: v.cart.departDay, daysUntil: Math.max(0, v.cart.departDay - today), text: v.cart.departDay === today ? 'La charrette part ce soir.' : 'La charrette part le dernier soir de la saison.' });
  if (host.themeCalendar) out.push(...host.themeCalendar());
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Graines rares possédées. */
function rareList(state) {
  const v = state.variety;
  const sid = SEASONS[state.time.seasonIndex];
  return RARE_CROP_IDS.filter((id) => (v.rare[id] || 0) > 0).map((id) => {
    const crop = getCrop(id);
    return { cropId: id, name: crop.name, seeds: v.rare[id], sowable: crop.seasons.includes(sid) };
  });
}

export function varietyQuery(host) {
  const { state } = host;
  const v = state.variety;
  if (!v) return null;
  return {
    enabled: true,
    parts: { ...v.parts },
    board: ordersQuery(host),
    cart: v.parts.cart ? cartInfo(host) : null,
    cards: cardsQuery(host),
    challenges: challengesQuery(host),
    merchant: merchantQuery(host),
    rare: rareList(state),
    owned: { ...v.owned },
    freeSows: { ...v.freeSows },
    effects: effectsList(host),
    stats: JSON.parse(JSON.stringify(v.stats)),
    calendar: calendarList(host),
    theme: currentTheme(state) ? { id: currentTheme(state).id, name: currentTheme(state).name } : null,
  };
}

/** Résumé de la variété pour summary / bilan : { orderPremium, cartPremium, cardIncome, medalCoins, merchantSpent, ordersDone, cratesFull, medals, … }. */
export function varietySummary(state) {
  const v = state.variety;
  if (!v) return null;
  const s = v.stats;
  return {
    orderPremium: s.ordersPremium,
    cartPremium: s.cartPremium,
    cardIncome: s.cardIncome,
    medalCoins: s.medalCoins,
    medalEcus: s.medalEcus,
    merchantSpent: s.merchantSpent,
    ordersDone: s.ordersDone,
    carts: s.carts,
    cartsFull: s.cartsFull,
    cratesFull: s.cratesFull,
    medals: { ...s.medals },
    rareHarvested: { ...s.rareHarvested },
    rareSown: { ...s.rareSown },
  };
}

/** Champ `claim` de query.plot(i) : où partirait une récolte à la main de cette parcelle. */
export function plotClaim(state, plot) {
  if (!state.variety || !plot.cropId) return null;
  return claimPreview(state, plot.cropId);
}

export { requestedCrops };

/** Graine rare ou semis offert utilisable maintenant pour cette culture ? → 'rare' | 'free' | null */
export function freeSowKind(state, cropId) {
  const v = state.variety;
  if (!v) return null;
  if (isRareCrop(cropId)) return (v.rare[cropId] || 0) > 0 ? 'rare' : null;
  return (v.freeSows[cropId] || 0) > 0 ? 'free' : null;
}

/** Consomme une graine rare ou un semis offert (après un semis réussi). → { rare?, free?, seedsLeft } */
export function consumeSow(state, cropId) {
  const v = state.variety;
  if (isRareCrop(cropId)) {
    v.rare[cropId] = Math.max(0, (v.rare[cropId] || 0) - 1);
    v.stats.rareSown[cropId] = (v.stats.rareSown[cropId] || 0) + 1;
    return { rare: true, seedsLeft: v.rare[cropId] };
  }
  v.freeSows[cropId] = Math.max(0, (v.freeSows[cropId] || 0) - 1);
  const left = v.freeSows[cropId];
  if (left === 0) delete v.freeSows[cropId];
  return { free: true, seedsLeft: left };
}

/** Lignes des graines rares de query.plantableCrops (graines possédées, de saison). */
export function rarePlantRows(state, { rate, freezes, plot = null }) {
  const v = state.variety;
  if (!v) return [];
  const sid = SEASONS[state.time.seasonIndex];
  const out = [];
  for (const id of RARE_CROP_IDS) {
    const seeds = v.rare[id] || 0;
    if (seeds <= 0) continue;
    const crop = getCrop(id);
    const greenhouse = !!plot && inGreenhouse(plot);
    if (!greenhouse && !crop.seasons.includes(sid)) continue;
    if (plot && plot.env === 'orchard') continue;
    const daysToMature = Math.ceil(crop.growDays / rate - 1e-9);
    out.push({ crop, seeds, daysToMature, willFreeze: !greenhouse && freezes(crop, daysToMature) });
  }
  return out;
}

/** Thème d'une partie : nom pour l'affichage (carrière). */
export function themeName(id) {
  return THEMES_BY_ID[id]?.name ?? null;
}

/** Pour les tests et le débogage : ce qui est faisable maintenant (tableau). */
export function feasibleNow(host) {
  return feasibleCrops(host, { horizon: boardHorizon(host.state, host.level) });
}

export { isTreeAdult };
