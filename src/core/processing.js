// Ateliers de transformation (v3) : confitures, fromagerie, moulin. Voir docs/GAME_DESIGN.md § 12.2.
//
// state.processing = { [buildingId]: { on, places: [null | place] } } — une entrée par atelier possédé,
// créée au premier achat (interrupteur allumé), places ajoutées à chaque amélioration.
// Une place occupée : { productId, input, source: 'harvest'|'animal', daysLeft, rawValue, yieldFactor }
//   daysLeft    aubes restantes avant la vente automatique
//   rawValue    valeur « en l'état », fixée à l'entrée (prix brut de la récolte / revenu de l'animal)
//   yieldFactor rendement de la récolte d'origine (fatigue du sol, pollinisation ; 1 pour le lait)
//
// Une règle : tant que l'interrupteur est allumé, une récolte transformable part à l'atelier s'il
// reste une place (sinon elle est vendue normalement) ; le lait remplit les places libres de la
// fromagerie à l'aube. Chaque place travaille `days` aubes, puis le produit est vendu tout seul.

import { INVESTMENTS, getInvestment } from '../data/investments.js';
import { getProduct, recipeFor } from '../data/products.js';
import { owned, priceBonus } from './economy.js';
import { perkValue } from './perks.js';

/** Ateliers (investissements avec l'effet `processing`), dans l'ordre des données. */
export const PROCESSING_IDS = INVESTMENTS.filter((i) => i.effects.processing).map((i) => i.id);

export function isProcessingBuilding(id) {
  return PROCESSING_IDS.includes(id);
}

/** Nombre de places d'un atelier à un niveau donné (« Artisan » : +1). 0 si non possédé. */
export function capacityAt(state, buildingId, level) {
  if (level <= 0) return 0;
  const places = getInvestment(buildingId).effects.processing.places;
  return places[Math.min(level, places.length) - 1] + perkValue(state, 'extraPlaces');
}

export function capacity(state, buildingId) {
  return capacityAt(state, buildingId, owned(state, buildingId));
}

/** Après l'achat d'un atelier (ou d'un niveau) : crée l'entrée ou ajoute des places libres. */
export function ensureBuilding(state, buildingId) {
  if (!state.processing) state.processing = {};
  const cap = capacity(state, buildingId);
  const b = state.processing[buildingId] || (state.processing[buildingId] = { on: true, places: [] });
  while (b.places.length < cap) b.places.push(null);
}

/** Prix de vente d'une place (calculé à la vente : étal et bonus de ce moment). */
export function productSaleValue(state, place) {
  const product = getProduct(place.productId);
  return Math.round(product.value * (1 + perkValue(state, 'productBonus')) * (1 + priceBonus(state)) * place.yieldFactor);
}

/** Prix de vente d'un produit fabriqué maintenant (rendement donné). */
export function productValueNow(state, productId, yieldFactor = 1) {
  return productSaleValue(state, { productId, yieldFactor });
}

/** Bâtiment possédé qui transformerait cette récolte / ce lait, avec la recette active : { buildingId, product } ou null. */
export function targetFor(state, input) {
  for (const id of PROCESSING_IDS) {
    const lvl = owned(state, id);
    if (lvl <= 0) continue;
    const product = recipeFor(id, lvl, input);
    if (product) return { buildingId: id, product };
  }
  return null;
}

function freeIndex(b) {
  return b ? b.places.indexOf(null) : -1;
}

/** true si l'atelier est allumé et a une place libre. */
export function hasRoom(state, buildingId) {
  const b = state.processing?.[buildingId];
  return !!b && b.on && freeIndex(b) >= 0;
}

/**
 * Une récolte arrive : part à l'atelier si possible. Renvoie { buildingId, productId, placeIndex } ou null.
 * @param {number} rawValue valeur de la récolte vendue brute (ce qu'elle aurait rapporté)
 */
export function tryProcessHarvest(state, cropId, rawValue, yieldFactor) {
  const t = targetFor(state, cropId);
  if (!t || t.product.source !== 'harvest' || !hasRoom(state, t.buildingId)) return null;
  const b = state.processing[t.buildingId];
  const placeIndex = freeIndex(b);
  b.places[placeIndex] = {
    productId: t.product.id,
    input: cropId,
    source: 'harvest',
    daysLeft: t.product.days,
    rawValue,
    yieldFactor,
  };
  return { buildingId: t.buildingId, productId: t.product.id, placeIndex };
}

/**
 * Aube, étape 8 : chaque place avance d'une aube ; les produits prêts sont vendus.
 * Renvoie [{ buildingId, productId, amount, placeIndex }] (l'argent n'est PAS encore versé).
 */
export function advanceProcessing(state) {
  const sold = [];
  if (!state.processing) return sold;
  for (const id of PROCESSING_IDS) {
    const b = state.processing[id];
    if (!b) continue;
    b.places.forEach((place, placeIndex) => {
      if (!place) return;
      place.daysLeft -= 1;
      if (place.daysLeft <= 0) {
        sold.push({ buildingId: id, productId: place.productId, amount: productSaleValue(state, place), placeIndex });
        b.places[placeIndex] = null;
      }
    });
  }
  return sold;
}

/**
 * Aube, étape 9 : le lait des vaches puis des chèvres remplit les places libres de la fromagerie
 * allumée, une unité par place ; ces unités ne rapportent rien aujourd'hui (retirées de `incomes`).
 * Renvoie { milkToDairy: [{ animalId, count }], started: [{ buildingId, placeIndex, productId, input, source }] }.
 */
export function fillMilk(state, level, incomes, season) {
  const milkToDairy = [];
  const started = [];
  for (const inv of INVESTMENTS) {
    if (!inv.effects.milk) continue;
    const n = owned(state, inv.id);
    if (n <= 0) continue;
    const t = targetFor(state, inv.id);
    if (!t || t.product.source !== 'animal') continue;
    const b = state.processing?.[t.buildingId];
    if (!b || !b.on) continue;
    const perUnit = inv.income[season] || 0;
    let count = 0;
    for (let u = 0; u < n; u++) {
      const placeIndex = freeIndex(b);
      if (placeIndex < 0) break;
      b.places[placeIndex] = { productId: t.product.id, input: inv.id, source: 'animal', daysLeft: t.product.days, rawValue: perUnit, yieldFactor: 1 };
      started.push({ buildingId: t.buildingId, placeIndex, productId: t.product.id, input: inv.id, source: 'animal' });
      count++;
    }
    if (count > 0) {
      milkToDairy.push({ animalId: inv.id, count });
      const entry = incomes.find((i) => i.source === inv.id && i.kind === 'daily');
      if (entry) {
        entry.amount -= perUnit * count;
        if (entry.amount <= 0) incomes.splice(incomes.indexOf(entry), 1);
      }
    }
  }
  return { milkToDairy, started };
}

/** Vend tout de suite ce qui est en cours dans un atelier, au prix « en l'état ». Renvoie { amount, count }. */
export function sellRaw(state, buildingId) {
  const b = state.processing?.[buildingId];
  let amount = 0;
  let count = 0;
  if (!b) return { amount, count };
  b.places.forEach((place, i) => {
    if (!place) return;
    amount += place.rawValue;
    count++;
    b.places[i] = null;
  });
  return { amount, count };
}

/** Totaux des places occupées : { count, value (ventes prévues), rawValue (en l'état) }. */
export function processingTotals(state) {
  let count = 0;
  let value = 0;
  let rawValue = 0;
  for (const id of PROCESSING_IDS) {
    const b = state.processing?.[id];
    if (!b) continue;
    for (const place of b.places) {
      if (!place) continue;
      count++;
      value += productSaleValue(state, place);
      rawValue += place.rawValue;
    }
  }
  return { count, value, rawValue };
}
