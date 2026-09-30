// Mode Carrière — grenier / silo (pur) : mise en réserve des récoltes, vente au cours du jour, filet de
// sécurité des charges de saison. Conception : docs/CARRIERE.md § 4.2 et § 1.7 (étape 2).
//
// state.career.stock = { [cropId]: n } (une unité = une récolte ou un panier de fruits) ;
// state.career.storageMode = 'never' | 'low' (cours du jour < 1 et pas hors saison) | 'always'.
// Rien ne se gâte ; grenier plein → la récolte est vendue normalement.

import { CROPS, getCrop } from '../../data/crops.js';
import { STORAGE_MODES } from '../../data/career/career.js';
import { storageCapacity } from './buildings.js';
import { careerCropPrice, isOffSeason } from './market.js';

export function stockUsed(state) {
  return Object.values(state.career.stock).reduce((a, b) => a + b, 0);
}

export function stockRoom(state) {
  return Math.max(0, storageCapacity(state) - stockUsed(state));
}

/** true si cette récolte partirait au grenier maintenant (réglage, cours, place). */
export function wouldStore(state, cropId) {
  if (stockRoom(state) <= 0) return false;
  const mode = state.career.storageMode;
  if (mode === 'always') return true;
  if (mode === 'low') {
    const crop = getCrop(cropId);
    return (state.market[cropId] ?? 1) < 1 && !isOffSeason(state, crop);
  }
  return false;
}

/** Met une unité au grenier. */
export function addStock(state, cropId, n = 1) {
  state.career.stock[cropId] = (state.career.stock[cropId] || 0) + n;
}

/** Prix d'une unité du grenier aujourd'hui (cours, hors saison, étal, fêtes ; sans le bonus « à la main »). */
export function stockUnitPrice(state, level, cropId) {
  return Math.round(careerCropPrice(state, level, getCrop(cropId), 'stock'));
}

/** Retire n unités et les paie (api.earn, poste « stock »). Renvoie { amount, count }. */
function sellUnits(api, cropId, n) {
  const { state } = api;
  const have = state.career.stock[cropId] || 0;
  const count = Math.min(have, n);
  if (count <= 0) return { amount: 0, count: 0 };
  const amount = stockUnitPrice(state, api.level, cropId) * count;
  state.career.stock[cropId] = have - count;
  if (state.career.stock[cropId] === 0) delete state.career.stock[cropId];
  api.earn('stock', amount);
  return { amount, count };
}

/**
 * Vend du stock : une culture (n unités, tout par défaut) ou tout le grenier (cropId null).
 * → { ok, amount, count } ; événement stockSold { amount, count, reason, lines }.
 */
export function sellStock(api, cropId, n, reason = 'player') {
  const { state } = api;
  const ids = cropId === null || cropId === undefined ? Object.keys(state.career.stock) : [cropId];
  if (cropId && !getCrop(cropId)) return api.fail('Culture inconnue.');
  let amount = 0;
  let count = 0;
  const lines = [];
  for (const id of ids) {
    const want = n === undefined || n === null || cropId === null || cropId === undefined ? Infinity : Math.floor(Number(n));
    if (!(want > 0)) return api.fail('Quantité invalide.');
    const r = sellUnits(api, id, want);
    if (r.count > 0) lines.push({ cropId: id, count: r.count, amount: r.amount });
    amount += r.amount;
    count += r.count;
  }
  if (count === 0) return api.fail('Rien à vendre au grenier.');
  api.push('stockSold', { amount, count, reason, lines });
  api.repayJoseph(amount, 'stock');
  return { ok: true, amount, count };
}

/**
 * Filet de sécurité (charges de saison) : vend les cultures les moins chères d'abord, juste ce qu'il faut
 * pour atteindre `target` pièces. → { amount, count } (événement stockSold, raison `reason`, si vendu).
 */
export function sellStockFor(api, target, reason = 'charges') {
  const { state } = api;
  let amount = 0;
  let count = 0;
  const lines = {};
  while (state.money < target) {
    const ids = Object.keys(state.career.stock);
    if (ids.length === 0) break;
    ids.sort((a, b) => stockUnitPrice(state, api.level, a) - stockUnitPrice(state, api.level, b) || a.localeCompare(b));
    const id = ids[0];
    const r = sellUnits(api, id, 1);
    amount += r.amount;
    count += r.count;
    lines[id] = lines[id] || { cropId: id, count: 0, amount: 0 };
    lines[id].count += r.count;
    lines[id].amount += r.amount;
  }
  if (count > 0) api.push('stockSold', { amount, count, reason, lines: Object.values(lines) });
  return { amount, count };
}

/** Réglage de mise en réserve. */
export function setStorageMode(api, mode) {
  if (!STORAGE_MODES.includes(mode)) return api.fail('Réglage inconnu.');
  api.state.career.storageMode = mode;
  return { ok: true, mode };
}

/** Pour query.career.stock(). */
export function stockInfo(state, level) {
  const lines = [];
  let value = 0;
  for (const c of CROPS) {
    const n = state.career.stock[c.id] || 0;
    if (n <= 0) continue;
    const unitPrice = stockUnitPrice(state, level, c.id);
    lines.push({ cropId: c.id, name: c.name, n, unitPrice, total: unitPrice * n, multiplier: state.market[c.id] ?? 1, offSeason: isOffSeason(state, c) });
    value += unitPrice * n;
  }
  return { capacity: storageCapacity(state), used: stockUsed(state), mode: state.career.storageMode, lines, value };
}
