// Mode Carrière — terrains (pur) : achat dans l'ordre, aménagement, réaménagement d'un terrain vide,
// parcelles. Conception : docs/CARRIERE.md § 2.
//
// state.career.lots : terrains POSSÉDÉS, de bas en haut :
//   { id, index, type, name, pricePaid, developPaid, slots: null | [null | buildingId, …], plan }
//   index 0 'home' (maison), 1 'start' (champ de départ), 2 'yard' (basse-cour), 3.. 'lot3'… (achetés)
//   plan (champs et serre) : { spring, summer, autumn, winter } → 'same' | cropId | null (semoir, jardiniers)
// Parcelles d'un terrain : state.plots[i].lot === lot.id (index du cœur, ajoutées à la fin, jamais renumérotées).

import { SEASONS } from '../../data/balance.js';
import { getCrop } from '../../data/crops.js';
import { DIFFICULTY_CAREER, MAX_LOTS, seasonScale } from '../../data/career/career.js';
import { FIRST_LOT_INDEX, FIXED_LOTS, FIXED_TYPE_NAMES, LOT_NAMES, LOT_PRICES, LOT_TYPES, MAX_LOTS_BY_RANK, START_FIELD, getLotType, lotIdFor } from '../../data/career/lots.js';
import { BUILDINGS_BY_ID } from '../../data/career/buildings.js';
import { ensureLotPlots, newPlot, notEnoughMoney, placeBuilding, rankLabel, removeBuilding } from './buildings.js';
import { providedFirst } from './registry.js';

export const DEFAULT_PLAN = Object.freeze({ spring: 'same', summer: 'same', autumn: 'same', winter: 'same' });

/** Terrains et parcelles de départ (createCareer). */
export function initialLots() {
  return FIXED_LOTS.map((f) => ({
    id: f.id,
    index: f.index,
    type: f.type,
    name: f.name,
    pricePaid: 0,
    developPaid: 0,
    slots: f.type === 'yard' ? [null, null] : null,
    plan: f.type === 'field' ? { ...DEFAULT_PLAN } : null,
  }));
}

/** 16 parcelles du champ de départ : les 12 premières (3 rangées de 4) ouvertes. */
export function initialPlots() {
  const plots = [];
  for (let cell = 0; cell < START_FIELD.cols * START_FIELD.rows; cell++) plots.push(newPlot('start', 'field', cell, cell < START_FIELD.open));
  return plots;
}

export function getLot(state, lotId) {
  return state.career.lots.find((l) => l.id === lotId) || null;
}

/** Index des parcelles d'un terrain (actives : env non nul). */
export function lotPlots(state, lotId, { includeRetired = false } = {}) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (p.lot === lotId && (includeRetired || p.env !== null)) out.push(i);
  });
  return out;
}

/** Nombre de terrains d'un type (le champ de départ compte pour un champ). */
export function countType(state, type) {
  return state.career.lots.filter((l) => l.type === type).length;
}

/** Terrains possédés au plus au rang actuel. */
export function maxLotsForRank(rank) {
  return MAX_LOTS_BY_RANK[Math.min(rank, 6)] ?? MAX_LOTS;
}

/** Charges de saison en plus par terrain acheté (× durée / 7). */
export function chargePerLot(state) {
  const d = DIFFICULTY_CAREER[state.career.difficulty];
  return Math.round(d.seasonCharge.perLot * seasonScale(state.career.seasonLength));
}

/**
 * Le terrain à vendre (toujours celui juste au-dessus du dernier) :
 * null (12 terrains achetés) | { id, index, name, price, basePrice, special, chargeIncrease, canBuy, reason, lockedByRank }
 */
export function nextLotInfo(state) {
  const n = state.career.lotsBought;
  if (n >= MAX_LOTS) return null;
  const index = FIRST_LOT_INDEX + n;
  const lot = { id: lotIdFor(index), index, name: LOT_NAMES[n], basePrice: LOT_PRICES[n] };
  const special = providedFirst('lotPrice', state, lot);
  const price = special && Number.isFinite(special.price) ? special.price : lot.basePrice;
  const maxLots = maxLotsForRank(state.career.rank);
  let reason = null;
  let lockedByRank = null;
  if (n >= maxLots) {
    lockedByRank = Object.entries(MAX_LOTS_BY_RANK).map(([r, m]) => [Number(r), m]).find(([, m]) => m > n)?.[0] ?? null;
    reason = lockedByRank ? rankLabel(lockedByRank) : 'Plus de terrain à vendre.';
  } else if (state.money < price) reason = notEnoughMoney(price - state.money);
  return { ...lot, price, special: special || null, chargeIncrease: chargePerLot(state), canBuy: reason === null, reason, lockedByRank };
}

/** Achète le terrain suivant (en friche). → { ok, lotId, index, cost } */
export function buyLot(api) {
  const { state } = api;
  const info = nextLotInfo(state);
  if (!info) return api.fail('Tous les terrains sont achetés.');
  if (!info.canBuy) return api.fail(info.reason);
  api.spend('lots', info.price);
  const lot = { id: info.id, index: info.index, type: 'wild', name: info.name, pricePaid: info.price, developPaid: 0, slots: null, plan: null };
  if (info.special) lot.special = info.special.label || true;
  state.career.lots.push(lot);
  state.career.lotsBought += 1;
  api.push('lotBought', { lotId: lot.id, index: lot.index, cost: info.price, name: lot.name });
  return { ok: true, lotId: lot.id, index: lot.index, cost: info.price };
}

/** true si le terrain est vide : aucune culture, aucun bâtiment, aucun animal dans ses abris. */
export function isLotEmpty(state, lot) {
  if (lotPlots(state, lot.id).some((i) => state.plots[i].cropId)) return false;
  if (lot.slots && lot.slots.some((b) => b !== null)) return false;
  for (const [id, b] of Object.entries(state.career.buildings)) {
    if (b.lotId !== lot.id) continue;
    const def = BUILDINGS_BY_ID[id];
    if (def.category === 'shelter' && (state.investments[def.animal] || 0) > 0) return false;
  }
  return true;
}

/**
 * Peut-on aménager ce terrain en `type` ? → { ok, cost, def } | { ok: false, reason }
 * Seuls les terrains achetés s'aménagent ; un terrain déjà aménagé doit être vide (réaménager).
 */
export function checkDevelop(state, lotId, type) {
  const lot = getLot(state, lotId);
  if (!lot) return { ok: false, reason: 'Terrain inconnu.' };
  if (lot.index < FIRST_LOT_INDEX) return { ok: false, reason: 'Ce terrain ne se réaménage pas.' };
  const def = getLotType(type);
  if (!def) return { ok: false, reason: 'Aménagement inconnu.' };
  if (lot.type === type) return { ok: false, reason: 'Le terrain est déjà aménagé ainsi.' };
  if (lot.type !== 'wild' && !isLotEmpty(state, lot)) return { ok: false, reason: 'Videz d\'abord le terrain (cultures, bâtiments, animaux).' };
  if (def.rank > state.career.rank) return { ok: false, reason: rankLabel(def.rank) };
  if (countType(state, type) >= def.max) return { ok: false, reason: `Au plus ${def.max} ${def.name.toLowerCase()}${def.max > 1 ? 's' : ''} dans la ferme.` };
  if (state.money < def.cost) return { ok: false, reason: notEnoughMoney(def.cost - state.money) };
  return { ok: true, cost: def.cost, def };
}

/** Aménage (ou réaménage) un terrain acheté. → { ok, cost, plots: [index] } */
export function developLot(api, lotId, type) {
  const { state } = api;
  const check = checkDevelop(state, lotId, type);
  if (!check.ok) return check;
  const lot = getLot(state, lotId);
  const def = check.def;
  // Ce que l'ancien aménagement laisse : parcelles retirées (index gardés), bâtiment du terrain retiré.
  for (const i of lotPlots(state, lot.id)) {
    const p = state.plots[i];
    p.env = null;
    p.unlocked = false;
  }
  for (const [id, b] of Object.entries(state.career.buildings)) if (b.lotId === lot.id) removeBuilding(state, id);
  if (def.cost > 0) api.spend('develop', def.cost);
  lot.type = type;
  lot.developPaid = (lot.developPaid || 0) + def.cost;
  lot.slots = def.slots > 0 ? Array.from({ length: def.slots }, () => null) : null;
  lot.plan = def.plots && def.plots.env !== 'orchard' ? { ...DEFAULT_PLAN } : null;
  let plots = [];
  if (def.building) placeBuilding(state, def.building, lot.id, null, 1, 0);
  if (def.plots) {
    const count = def.building === 'greenhouse' ? BUILDINGS_BY_ID.greenhouse.levels[0].plots : def.plots.count;
    plots = ensureLotPlots(state, lot, def.plots.env, count);
  }
  api.push('lotDeveloped', { lotId: lot.id, lotType: type, cost: def.cost, plots }); // « lotType » : « type » écraserait le type de l'événement (on('*'))
  return { ok: true, cost: def.cost, plots };
}

/** Aménagements proposés pour un terrain : [{ type, name, cost, canDevelop, reason, max, count, rank }]. */
export function lotTypesFor(state, lotId) {
  return LOT_TYPES.map((t) => {
    const check = checkDevelop(state, lotId, t.id);
    return { type: t.id, name: t.name, cost: t.cost, rank: t.rank, canDevelop: check.ok, reason: check.ok ? null : check.reason, max: Number.isFinite(t.max) ? t.max : null, count: countType(state, t.id), phase: t.phase || null };
  });
}

/** Nom affiché du type d'un terrain. */
export function lotTypeName(type) {
  return FIXED_TYPE_NAMES[type] || getLotType(type)?.name || type;
}

/** Plan de culture d'un champ ou de la serre : 'same' | cropId | null. */
export function setPlan(api, lotId, seasonId, cropId) {
  const { state } = api;
  const lot = getLot(state, lotId);
  if (!lot) return api.fail('Terrain inconnu.');
  if (!lot.plan) return api.fail('Ce terrain n\'a pas de plan de culture.');
  if (!SEASONS.includes(seasonId)) return api.fail('Saison inconnue.');
  if (cropId !== null && cropId !== 'same') {
    const crop = getCrop(cropId);
    if (!crop || crop.kind === 'tree') return api.fail('Culture inconnue.');
    if (!api.level.crops.includes(cropId)) return api.fail('Culture pas encore débloquée.');
    if (lot.type !== 'greenhouse' && !crop.seasons.includes(seasonId)) return api.fail(`${crop.name} : ne se sème pas cette saison.`);
  }
  lot.plan[seasonId] = cropId;
  return { ok: true, plan: { ...lot.plan } };
}

/** Parcelles « cultivables » ouvertes (champs, verger, serre) : objectif du rang 4. */
export function cultivablePlots(state) {
  return state.plots.filter((p) => p.unlocked && p.env).length;
}
