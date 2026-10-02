// Lot 3 « Variété » — le générateur de demandes « faisables cette saison » (commun au tableau du village, à la
// charrette du marché et aux défis), le tableau (C1), la charrette (C3) et les récoltes comptées. Partagé par les
// niveaux (src/core/game.js) et la carrière (src/core/career/variety.js). Pur : aucun DOM, aucune horloge.
// Règles : docs/GAME_DESIGN.md § 16.1, § 16.2, § 16.4 ; contrat : docs/ARCHITECTURE.md, « Lot 3 — contrats ».
//
// Tirages : flux « orders » (commandes et relances), flux « variety » (charrette). Aucun autre flux n'est touché.
//
// `host` (fourni par game.js ou par l'extension de carrière) :
//   { state, level, crops, push(type, payload), earn(key, amount), rateFor(plot) → vitesse de pousse arrosée }
//   earn : 'orders' | 'cart' (prime ; l'appelant gère l'argent, le bilan et la part de Joseph)

import { EPSILON, SEASONS } from '../data/balance.js';
import { getCrop, isRareCrop, isTreeCrop } from '../data/crops.js';
import {
  BOARD, CART, CLIENTS, CLIENTS_BY_ID, FEASIBLE_WEIGHTS, ORDER_RATES, ORDER_RATE_RULES, ORDER_SIZES, ORDER_TWO_LINES, VARIETY_TEXTS,
} from '../data/variety.js';
import { stream } from './rng.js';
import { inGreenhouse, isMature } from './farm.js';
import { targetFor } from './processing.js';
import { isTreeAdult } from './trees.js';
import { cardActive, isStarCrop, vAbsDay, vSeasonAbs } from './variety-effects.js';

const round2 = (x) => Math.round(x * 100) / 100;

// ── Dates et champ ──────────────────────────────────────────────────────────────────────────────

/** Durée d'une saison (index ; défaut : la saison en cours). */
export function seasonLen(state, level, si = state.time.seasonIndex) {
  return level.seasonLengths[si];
}

/** Jours restant dans la saison, aujourd'hui compris. */
export function daysLeftWithToday(state, level) {
  return seasonLen(state, level) - state.time.dayOfSeason + 1;
}

/** Dernier jour absolu de la saison en cours. */
export function seasonEndAbs(state, level) {
  return vAbsDay(state) + (seasonLen(state, level) - state.time.dayOfSeason);
}

/** Aubes restant avant le gel du 1er jour d'hiver (Infinity en hiver). */
export function dawnsBeforeFrost(state, level) {
  const si = state.time.seasonIndex;
  if (SEASONS[si] === 'winter') return Infinity;
  let n = seasonLen(state, level) - state.time.dayOfSeason;
  for (let s = si + 1; s < SEASONS.length && SEASONS[s] !== 'winter'; s++) n += level.seasonLengths[s];
  return n;
}

/** Parcelles de champ ouvertes (niveaux : toutes les parcelles ouvertes ; carrière : les champs). */
export function openFieldPlots(state) {
  if (state.mode === 'career') return state.plots.filter((p) => p.unlocked && p.env === 'field').length;
  return state.plots.filter((p) => p.unlocked).length;
}

/** Arbres fruitiers adultes possédés. */
export function adultTrees(state) {
  return state.plots.filter((p) => p.unlocked && p.env !== null && p.cropId && isTreeCrop(getCrop(p.cropId)) && isTreeAdult(state, p)).length;
}

/**
 * Valeur de base d'une unité (prime) : prix de vente × prix des récoltes du mode × baisse du niveau (niveau 9),
 * sans étal, cours, fête, prime « à la main » ni qualité.
 */
export function baseUnitValue(state, level, cropId) {
  const crop = getCrop(cropId);
  if (!crop) return 0;
  return round2(crop.sellPrice * (level.cropPriceFactor ?? 1) * (level.modifiers?.rawPriceFactor ?? 1));
}

// ── Le générateur « faisable cette saison » (§ 16.1) ───────────────────────────────────────────

/**
 * Cultures faisables : { [cropId]: { reasons: [..], growing: n } } (jamais une graine rare).
 *   growing : pousse sur une parcelle (pas un géant) et ne gèlera pas avant d'être mûre
 *   stock   : (carrière) il en reste au grenier
 *   sowable : se sème aujourd'hui (hors serre) et mûrit (arrosée) en `horizon` aubes au plus, sans geler
 *   tree    : arbre adulte possédé, en saison de fruits, une récolte tient dans l'horizon (ou est déjà mûre)
 * @param {object} opts { horizon, season? (id de saison pour « sowable », défaut : celle du jour) }
 */
export function feasibleCrops(host, { horizon, season = null } = {}) {
  const { state, level } = host;
  const sid = season || SEASONS[state.time.seasonIndex];
  const frost = season ? Infinity : dawnsBeforeFrost(state, level);
  const out = {};
  const add = (id, reason) => {
    const e = out[id] || (out[id] = { reasons: [], growing: 0 });
    if (!e.reasons.includes(reason)) e.reasons.push(reason);
    return e;
  };
  const allowed = new Set(host.crops.filter((c) => !isRareCrop(c.id)).map((c) => c.id));
  // growing (et arbres en fruits)
  if (!season) {
    state.plots.forEach((p) => {
      if (!p.cropId || !p.unlocked || p.env === null || p.giant !== undefined) return;
      if (!allowed.has(p.cropId)) return;
      const crop = getCrop(p.cropId);
      if (isTreeCrop(crop)) {
        if (!isTreeAdult(state, p) || !crop.fruitSeasons.includes(sid)) return;
        const rate = host.rateFor(p, true);
        const left = (p.fruit || 0) >= crop.fruitDays - EPSILON ? 0 : Math.ceil((crop.fruitDays - (p.fruit || 0)) / rate - EPSILON);
        if (left <= horizon) add(crop.id, 'tree').growing += 1;
        return;
      }
      const need = isMature(p) ? 0 : Math.ceil((crop.growDays - p.growth) / host.rateFor(p) - EPSILON);
      if (!crop.frostHardy && !inGreenhouse(p) && need > frost) return;
      add(crop.id, 'growing').growing += 1;
    });
  }
  // stock (carrière)
  if (state.mode === 'career' && !season) {
    for (const [id, n] of Object.entries(state.career.stock || {})) if (n > 0 && allowed.has(id)) add(id, 'stock');
  }
  // sowable
  const rate = host.rateFor(null);
  for (const crop of host.crops) {
    if (!allowed.has(crop.id) || isTreeCrop(crop) || !crop.seasons.includes(sid)) continue;
    const need = Math.ceil(crop.growDays / rate - EPSILON);
    if (need > horizon) continue;
    if (!crop.frostHardy && need > frost) continue;
    add(crop.id, 'sowable');
  }
  return out;
}

/** Nombre de cultures faisables (défis « Potager varié », « Semeur curieux »). */
export function feasibleCount(host, opts) {
  return Object.keys(feasibleCrops(host, opts)).length;
}

/** Culture de la quête de Joseph en cours (carrière), ou null. */
function questCropId(state) {
  const q = state.mode === 'career' ? state.career?.quest : null;
  return q && q.type === 'crop' && q.progress < q.need.n ? q.need.id : null;
}

/** Culture transformée par un atelier ALLUMÉ du joueur. */
function workshopTakes(state, cropId) {
  const t = targetFor(state, cropId);
  return !!t && t.product.source === 'harvest' && !!state.processing?.[t.buildingId]?.on;
}

/**
 * Applique les exclusions dans l'ordre, chacune seulement s'il reste au moins une autre culture possible.
 * @param {string[]} ids candidates
 * @param {Array<(id) => boolean>} rules exclusions (true = exclue)
 */
function applyExclusions(ids, rules) {
  let list = [...ids];
  for (const rule of rules) {
    const kept = list.filter((id) => !rule(id));
    if (kept.length) list = kept;
  }
  return list;
}

/** Cultures demandées sur le tableau (commandes en cours, lignes pas pleines comprises). */
export function boardCrops(state) {
  const out = new Set();
  for (const o of state.variety?.board?.slots || []) if (o) for (const l of o.lines) out.add(l.cropId);
  return out;
}

/** Cultures des caisses de la charrette en cours. */
export function cartCrops(state) {
  return new Set((state.variety?.cart?.crates || []).map((c) => c.cropId));
}

/** Cultures encore attendues (tableau ou charrette, pas pleines) : badge « Commande » de la feuille des graines. */
export function requestedCrops(state) {
  const out = new Set();
  const v = state.variety;
  if (!v) return out;
  for (const o of v.board?.slots || []) if (o) for (const l of o.lines) if (l.got < l.n) out.add(l.cropId);
  for (const c of v.cart?.crates || []) if (c.got < c.n) out.add(c.cropId);
  return out;
}

function weightedId(rng, weights) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  if (!keys.length) return null;
  return rng.weighted(Object.fromEntries(keys.map((k) => [k, weights[k]])));
}

// ── C1 — Le tableau du village ─────────────────────────────────────────────────────────────────

/** Horizon du tableau : jours restant dans la saison (aujourd'hui compris), au moins 3. */
export function boardHorizon(state, level) {
  return Math.max(BOARD.minHorizon, daysLeftWithToday(state, level));
}

function sizeCategory(crop) {
  if (crop.sellPrice < ORDER_SIZES.cheap.maxPrice) return ORDER_SIZES.cheap;
  if (crop.sellPrice < ORDER_SIZES.medium.maxPrice) return ORDER_SIZES.medium;
  return ORDER_SIZES.dear;
}

function sizeCap(state, crop) {
  if (isTreeCrop(crop)) return Math.max(1, ORDER_SIZES.perTree * adultTrees(state));
  return Math.max(ORDER_SIZES.minCap, Math.floor(openFieldPlots(state) / ORDER_SIZES.plotsPerUnit));
}

function drawSize(rng, state, crop, rank) {
  const cat = sizeCategory(crop);
  const bonus = state.mode === 'career' ? Math.floor((rank - 1) / cat.perRank) : 0;
  const n = rng.int(cat.levels[0] + bonus, cat.levels[1] + bonus);
  return Math.max(1, Math.min(n, sizeCap(state, crop)));
}

function careerRank(state) {
  return state.mode === 'career' ? state.career.rank || 1 : 1;
}

/**
 * Nouvelle commande pour une place (flux « orders ») : client absent du tableau, culture faisable, taille, taux.
 * → order | null (aucune culture faisable).
 */
export function drawOrder(host, { exclude = [] } = {}) {
  const { state, level } = host;
  const v = state.variety;
  const rng = stream(state.rng, 'orders');
  const onBoard = new Set((v.board.slots || []).filter(Boolean).map((o) => o.clientId));
  const clients = CLIENTS.filter((c) => !onBoard.has(c.id) && !exclude.includes(c.id));
  if (!clients.length) return null;
  const feas = feasibleCrops(host, { horizon: boardHorizon(state, level) });
  const ids = Object.keys(feas);
  if (!ids.length) return null;
  const client = clients[rng.int(0, clients.length - 1)];
  const quest = questCropId(state);
  const onBoardCrops = boardCrops(state);
  const inCart = cartCrops(state);
  const list = applyExclusions(ids, [
    (id) => id === quest,
    (id) => workshopTakes(state, id),
    (id) => onBoardCrops.has(id),
    (id) => inCart.has(id),
  ]);
  const yesterday = new Set(v.board.yesterday || []);
  const weightOf = (id) => {
    let w = FEASIBLE_WEIGHTS.base;
    if (!feas[id].growing && !feas[id].reasons.includes('stock')) w *= FEASIBLE_WEIGHTS.notGrowing;
    if (isStarCrop(state, id)) w *= FEASIBLE_WEIGHTS.star;
    if (client.favorites.includes(id)) w *= FEASIBLE_WEIGHTS.favorite;
    if (yesterday.has(id)) w *= FEASIBLE_WEIGHTS.yesterday;
    return w;
  };
  const cropId = weightedId(rng, Object.fromEntries(list.map((id) => [id, weightOf(id)])));
  const rank = careerRank(state);
  const crop = getCrop(cropId);
  const lines = [{ cropId, n: drawSize(rng, state, crop, rank), got: 0 }];
  let twoLines = false;
  if (state.mode === 'career' && rank >= ORDER_TWO_LINES.minRank && rng.chance(ORDER_TWO_LINES.chance)) {
    const rest = list.filter((id) => id !== cropId);
    if (rest.length) {
      const second = weightedId(rng, Object.fromEntries(rest.map((id) => [id, weightOf(id)])));
      const c2 = getCrop(second);
      const n2 = Math.max(ORDER_SIZES.secondaryMin, drawSize(rng, state, c2, rank) - 1);
      lines.push({ cropId: second, n: Math.min(n2, Math.max(ORDER_SIZES.secondaryMin, sizeCap(state, c2))), got: 0 });
      twoLines = true;
    }
  }
  let rate = Number(rng.weighted(Object.fromEntries(ORDER_RATES.map((r) => [String(r.rate), r.weight]))));
  if (twoLines) rate = Math.min(ORDER_RATE_RULES.twoLinesMax, round2(rate + ORDER_RATE_RULES.twoLines));
  return { id: `o${v.nextId++}`, clientId: client.id, day: vAbsDay(state), lines, rate, kept: false, base: 0, fromStock: 0 };
}

/** Commande commencée (au moins une unité donnée). */
export function orderStarted(order) {
  return order.lines.some((l) => l.got > 0);
}

export function orderComplete(order) {
  return order.lines.every((l) => l.got >= l.n);
}

/** Taux effectif (carte « Le crieur du village » : +0,1, au plus × 1,6). */
export function effectiveRate(state, order) {
  if (!cardActive(state, 'crier')) return order.rate;
  return Math.min(ORDER_RATE_RULES.crierMax, round2(order.rate + ORDER_RATE_RULES.crier));
}

/** Prime d'une commande complète (valeur de base de toutes les unités × (taux − 1)). */
export function fullPremium(host, order) {
  const base = order.lines.reduce((s, l) => s + baseUnitValue(host.state, host.level, l.cropId) * l.n, 0);
  return Math.round(base * (effectiveRate(host.state, order) - 1));
}

/** Prime des unités déjà données. */
export function partialPremium(state, order) {
  return Math.round(order.base * (effectiveRate(state, order) - 1));
}

/**
 * Renouvelle le tableau : commandes non gardées et pas commencées remplacées, places vides remplies (si `fill`).
 * → { added, replaced } (nombres de commandes nouvelles).
 */
export function renewBoard(host, { fill = true } = {}) {
  const v = host.state.variety;
  const slots = v.board.slots;
  let added = 0;
  let replaced = 0;
  const replaceIdx = [];
  for (let k = 0; k < slots.length; k++) {
    const o = slots[k];
    if (o && !o.kept && !orderStarted(o)) replaceIdx.push(k);
  }
  // On retire d'abord les commandes remplacées (leurs clients et cultures redeviennent possibles), puis on tire.
  const leaving = replaceIdx.map((k) => slots[k].clientId);
  for (const k of replaceIdx) slots[k] = null;
  for (let k = 0; k < slots.length; k++) {
    if (slots[k]) continue;
    if (!fill && !replaceIdx.includes(k)) continue;
    const o = drawOrder(host, { exclude: replaceIdx.includes(k) ? leaving : [] });
    if (!o) continue;
    slots[k] = o;
    if (replaceIdx.includes(k)) replaced += 1;
    else added += 1;
  }
  return { added, replaced };
}

/** Une commande gardée est-elle encore faisable (changement de saison) ? Lignes pas pleines seulement. */
export function orderStillFeasible(host, order) {
  const feas = feasibleCrops(host, { horizon: seasonLen(host.state, host.level) });
  return order.lines.every((l) => l.got >= l.n || !!feas[l.cropId]);
}

/** Retire une commande d'une place (avec la prime des unités données). → { order, premium } */
export function removeOrder(host, slotIndex, reason) {
  const v = host.state.variety;
  const order = v.board.slots[slotIndex];
  v.board.slots[slotIndex] = null;
  const premium = orderStarted(order) ? partialPremium(host.state, order) : 0;
  if (premium > 0) {
    host.earn('orders', premium);
    v.stats.ordersPremium += premium;
  }
  const client = CLIENTS_BY_ID[order.clientId];
  host.push('orderRemoved', { orderId: order.id, clientId: order.clientId, clientName: client.name, reason, premium, ...(reason === 'withdrawn' && premium > 0 ? { text: VARIETY_TEXTS.withdrawn } : {}) });
  return { order, premium };
}

function orderLabel(order) {
  return `→ ${CLIENTS_BY_ID[order.clientId].name}`;
}

/** Commande complète : prime versée, place libre jusqu'à l'aube suivante. */
function completeOrder(host, slotIndex) {
  const { state } = host;
  const v = state.variety;
  const order = v.board.slots[slotIndex];
  const premium = Math.round(order.base * (effectiveRate(state, order) - 1));
  v.board.slots[slotIndex] = null;
  v.board.done = [...(v.board.done || []), { slot: slotIndex, orderId: order.id, clientId: order.clientId, day: vAbsDay(state) }];
  v.stats.ordersDone += 1;
  v.stats.ordersPremium += premium;
  v.stats.ordersByClient[order.clientId] = (v.stats.ordersByClient[order.clientId] || 0) + 1;
  if (v.season) v.season.orders += 1;
  if (premium > 0) host.earn('orders', premium);
  const client = CLIENTS_BY_ID[order.clientId];
  const units = order.lines.reduce((s, l) => s + l.n, 0);
  host.push('orderDone', { orderId: order.id, clientId: order.clientId, clientName: client.name, thanks: client.thanks, premium, units });
  return premium;
}

// ── C3 — La charrette du marché ────────────────────────────────────────────────────────────────

/** Nombre de caisses d'une charrette. */
export function cartCrateCount(state, level) {
  if (state.mode === 'career') return (state.career.rank || 1) >= CART.careerFourAt ? 4 : CART.careerCrates;
  if (SEASONS[state.time.seasonIndex] === 'winter' || CART.smallLevels.includes(level.id)) return CART.smallCrates;
  return CART.crates;
}

/** Unités par caisse. */
export function cartCrateSize(state, level) {
  const L = seasonLen(state, level);
  if (state.mode === 'career') {
    const rank = state.career.rank || 1;
    const n = Math.round((CART.careerBase + CART.careerPerRank * (rank - 1)) * L / 7);
    return Math.max(CART.careerMin, Math.min(n, Math.floor(openFieldPlots(state) / 2)));
  }
  const n = Math.round(CART.levelBase * openFieldPlots(state) / 12 * L / 7);
  return Math.max(CART.levelMin, Math.min(CART.levelMax, n));
}

/** Tire une charrette (flux « variety ») au 1er jour de la saison. → cart | null (aucune culture faisable). */
export function drawCart(host) {
  const { state, level } = host;
  const v = state.variety;
  const L = seasonLen(state, level);
  const feas = feasibleCrops(host, { horizon: L - 1 });
  const quest = questCropId(state);
  const ids = applyExclusions(Object.keys(feas), [(id) => id === quest, (id) => workshopTakes(state, id)]);
  if (!ids.length) return null;
  const rng = stream(state.rng, 'variety');
  const want = cartCrateCount(state, level);
  const size = cartCrateSize(state, level);
  const crates = [];
  let pool = [...ids];
  for (let k = 0; k < want && pool.length; k++) {
    const id = weightedId(rng, Object.fromEntries(pool.map((c) => [c, FEASIBLE_WEIGHTS.base * (isStarCrop(state, c) ? FEASIBLE_WEIGHTS.star : 1)])));
    pool = pool.filter((c) => c !== id);
    const crop = getCrop(id);
    crates.push({ cropId: id, n: isTreeCrop(crop) ? Math.max(1, Math.min(size, ORDER_SIZES.perTree * adultTrees(state))) : size, got: 0 });
  }
  const horse = v.cards?.pending?.cartFactor > 1;
  if (horse) v.cards.pending.cartFactor = 1;
  return { id: `c${v.nextId++}`, season: vSeasonAbs(state), crates, base: 0, departDay: seasonEndAbs(state, level), horse };
}

/** Primes de la charrette : { now (chargée), full (si tout est plein), ecus }. */
export function cartPremiums(host, cart) {
  const { state, level } = host;
  const factor = cart.horse ? CART.horseFactor : 1;
  const total = cart.crates.reduce((s, c) => s + baseUnitValue(state, level, c.cropId) * c.n, 0);
  const allFull = cart.crates.every((c) => c.got >= c.n);
  const now = Math.round(cart.base * CART.share) * factor + (allFull ? Math.round(cart.base * CART.fullShare) * factor : 0);
  const full = (Math.round(total * CART.share) + Math.round(total * CART.fullShare)) * factor;
  return { now, full, ecus: CART.fullEcus, allFull };
}

/** Départ de la charrette (soir du dernier jour, avant le fermage) : prime versée. → données de cartDeparted. */
export function departCart(host) {
  const { state } = host;
  const v = state.variety;
  const cart = v.cart;
  if (!cart) return null;
  v.cart = null;
  const units = cart.crates.reduce((s, c) => s + c.got, 0);
  const { now: premium, allFull } = cartPremiums(host, cart);
  const ecus = allFull ? CART.fullEcus : 0;
  v.stats.carts += 1;
  if (allFull) v.stats.cartsFull += 1;
  v.stats.cartPremium += premium;
  if (premium > 0) host.earn('cart', premium);
  const crates = cart.crates.map((c) => ({ cropId: c.cropId, n: c.n, got: c.got }));
  const fullCount = cart.crates.filter((c) => c.got >= c.n).length;
  const text = units === 0
    ? VARIETY_TEXTS.cartLeftEmpty
    : allFull
      ? `La charrette repart pleine : +${premium} pièces et ${ecus} écus !`
      : `La charrette repart : +${premium} pièces (${fullCount} caisse${fullCount > 1 ? 's' : ''} pleine${fullCount > 1 ? 's' : ''} sur ${crates.length}).`;
  return { units, base: Math.round(cart.base), premium, allFull, ecus, crates, horse: cart.horse, text };
}

// ── Récoltes comptées ──────────────────────────────────────────────────────────────────────────

/** Commandes qui attendent cette culture, la plus avancée d'abord, puis la plus ancienne : [slotIndex]. */
function ordersFor(state, cropId) {
  const slots = state.variety.board.slots;
  const out = [];
  slots.forEach((o, k) => {
    if (!o) return;
    if (o.lines.some((l) => l.cropId === cropId && l.got < l.n)) out.push(k);
  });
  const progress = (o) => o.lines.reduce((s, l) => s + l.got, 0) / o.lines.reduce((s, l) => s + l.n, 0);
  out.sort((a, b) => progress(slots[b]) - progress(slots[a]) || slots[a].day - slots[b].day || Number(slots[a].id.slice(1)) - Number(slots[b].id.slice(1)));
  return out;
}

/**
 * Compte `units` unités d'une culture dans les commandes du tableau puis dans la charrette (le joueur seulement).
 * Pas de paiement de la vente ici (l'appelant la paie au prix normal) ; primes versées quand c'est complet.
 * @param {object} opts { cropId, units = 1, by = 'player', plotIndex?, fromStock?, only? ({ kind: 'order', slot } | { kind: 'crate', index }) }
 * → { claims: [{ kind, id, label, units, got, n }], counted, left }
 */
export function claimUnits(host, { cropId, units = 1, by = 'player', plotIndex = null, fromStock = false, only = null }) {
  const { state, level } = host;
  const v = state.variety;
  const claims = [];
  if (!v || by !== 'player' || isRareCrop(cropId)) return { claims, counted: 0, left: units };
  let left = units;
  const ub = baseUnitValue(state, level, cropId);
  // (2) Commandes du tableau.
  if (v.parts.board && (!only || only.kind === 'order')) {
    while (left > 0) {
      const list = ordersFor(state, cropId);
      if (only && only.kind === 'order' && !list.includes(only.slot)) break;
      const k = only && only.kind === 'order' ? only.slot : list[0];
      if (k === undefined) break;
      const order = v.board.slots[k];
      const line = order.lines.find((l) => l.cropId === cropId && l.got < l.n);
      if (!line) break;
      line.got += 1;
      order.base = round2(order.base + ub);
      order.kept = true;
      if (fromStock) order.fromStock += 1;
      left -= 1;
      const label = orderLabel(order);
      const total = { got: order.lines.reduce((s, l) => s + l.got, 0), n: order.lines.reduce((s, l) => s + l.n, 0) };
      const prev = claims.find((c) => c.kind === 'order' && c.id === order.id);
      if (prev) {
        prev.units += 1;
        prev.got = total.got;
      } else claims.push({ kind: 'order', id: order.id, label, units: 1, got: total.got, n: total.n });
      host.push('orderProgress', { orderId: order.id, clientId: order.clientId, clientName: CLIENTS_BY_ID[order.clientId].name, cropId, got: line.got, n: line.n, label, ...(plotIndex !== null ? { plotIndex } : {}), ...(fromStock ? { fromStock: true } : {}) });
      if (orderComplete(order)) completeOrder(host, k);
    }
  }
  // (3) Charrette.
  if (v.parts.cart && v.cart && (!only || only.kind === 'crate')) {
    while (left > 0) {
      const idx = only && only.kind === 'crate' ? (v.cart.crates[only.index]?.cropId === cropId && v.cart.crates[only.index].got < v.cart.crates[only.index].n ? only.index : -1) : v.cart.crates.findIndex((c) => c.cropId === cropId && c.got < c.n);
      if (idx < 0) break;
      const crate = v.cart.crates[idx];
      crate.got += 1;
      v.cart.base = round2(v.cart.base + ub);
      left -= 1;
      const prev = claims.find((c) => c.kind === 'cart' && c.crateIndex === idx);
      if (prev) {
        prev.units += 1;
        prev.got = crate.got;
      } else claims.push({ kind: 'cart', id: v.cart.id, crateIndex: idx, label: '→ charrette', units: 1, got: crate.got, n: crate.n });
      host.push('cartProgress', { crateIndex: idx, cropId, got: crate.got, n: crate.n, ...(plotIndex !== null ? { plotIndex } : {}), ...(fromStock ? { fromStock: true } : {}) });
      if (crate.got >= crate.n) {
        v.stats.cratesFull += 1;
        if (v.season) v.season.crates += 1;
        host.push('crateFull', { crateIndex: idx, cropId });
      }
    }
  }
  return { claims, counted: units - left, left };
}

/** Une récolte à la main de cette culture serait-elle comptée (commande ou charrette) ? → { kind, id, label, got, n } | null */
export function claimPreview(state, cropId) {
  const v = state.variety;
  if (!v || isRareCrop(cropId)) return null;
  if (v.parts.board) {
    const list = ordersFor(state, cropId);
    if (list.length) {
      const o = v.board.slots[list[0]];
      return { kind: 'order', id: o.id, label: orderLabel(o), got: o.lines.reduce((s, l) => s + l.got, 0), n: o.lines.reduce((s, l) => s + l.n, 0) };
    }
  }
  if (v.parts.cart && v.cart) {
    const idx = v.cart.crates.findIndex((c) => c.cropId === cropId && c.got < c.n);
    if (idx >= 0) {
      const c = v.cart.crates[idx];
      return { kind: 'cart', id: v.cart.id, crateIndex: idx, label: '→ charrette', got: c.got, n: c.n };
    }
  }
  return null;
}

// ── Requêtes ───────────────────────────────────────────────────────────────────────────────────

/** Fiche d'une commande (query.orders). */
export function orderInfo(host, order) {
  const { state } = host;
  const client = CLIENTS_BY_ID[order.clientId];
  const stock = state.mode === 'career' ? state.career.stock || {} : null;
  const lines = order.lines.map((l) => {
    const crop = getCrop(l.cropId);
    return {
      cropId: l.cropId,
      cropName: crop?.name ?? l.cropId,
      icon: `crop.${l.cropId}.icon`,
      n: l.n,
      got: l.got,
      left: Math.max(0, l.n - l.got),
      ...(stock ? { inStock: stock[l.cropId] || 0 } : {}),
    };
  });
  const started = orderStarted(order);
  const rate = effectiveRate(state, order);
  const deliverCount = stock ? lines.reduce((s, l) => s + Math.min(l.left, l.inStock), 0) : 0;
  const workshop = order.lines.some((l) => l.got < l.n && workshopTakes(state, l.cropId));
  return {
    id: order.id,
    clientId: order.clientId,
    clientName: client.name,
    clientTitle: client.title,
    portrait: `portrait.client.${order.clientId}`,
    text: client.text,
    thanks: client.thanks,
    lines,
    rate,
    ratePct: Math.round((rate - 1) * 100),
    premium: fullPremium(host, order),
    premiumSoFar: partialPremium(state, order),
    kept: !!order.kept || started,
    started,
    canDeliver: deliverCount > 0,
    deliverCount,
    note: workshop ? VARIETY_TEXTS.workshopFirst : null,
    day: order.day,
  };
}

/** Fiche de la charrette (query.cart). */
export function cartInfo(host) {
  const { state } = host;
  const cart = state.variety?.cart;
  if (!cart) return null;
  const stock = state.mode === 'career' ? state.career.stock || {} : null;
  const today = vAbsDay(state);
  const daysLeft = Math.max(0, cart.departDay - today);
  const L = seasonLen(state, host.level);
  const prem = cartPremiums(host, cart);
  return {
    id: cart.id,
    crates: cart.crates.map((c) => {
      const crop = getCrop(c.cropId);
      const inStock = stock ? stock[c.cropId] || 0 : 0;
      return { cropId: c.cropId, cropName: crop?.name ?? c.cropId, icon: `crop.${c.cropId}.icon`, n: c.n, got: c.got, full: c.got >= c.n, inStock, canLoad: !!stock && inStock > 0 && c.got < c.n };
    }),
    departDay: cart.departDay,
    daysLeft,
    departText: daysLeft === 0 ? 'Part ce soir' : `Part le soir du ${L}ᵉ jour`,
    premiumNow: prem.now,
    premiumFull: prem.full,
    ecusFull: prem.ecus,
    horse: !!cart.horse,
    base: Math.round(cart.base),
  };
}
