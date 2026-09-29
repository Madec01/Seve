// Marché : multiplicateur de prix de vente par culture.
// Sans volatilité (cas général), tous les multiplicateurs valent 1.
// Avec volatilité (« Le marché fou »), chaque multiplicateur suit à chaque aube une marche
// aléatoire bornée dans [MARKET.min, MARKET.max], avec un léger rappel vers 1.

import { MARKET } from '../data/balance.js';
import { stream } from './rng.js';

export function levelCrops(level, allCrops) {
  return level.crops ? allCrops.filter((c) => level.crops.includes(c.id)) : allCrops;
}

/** Multiplicateurs de départ. */
export function initialMarket(state, level, crops) {
  const market = {};
  const rng = stream(state.rng, 'market');
  for (const c of crops) {
    market[c.id] = level.modifiers.priceVolatility ? round2(rng.range(0.8, 1.2)) : 1;
  }
  return market;
}

/** Nouveau cours du jour (appelé à chaque aube). */
export function updateMarket(state, level, crops) {
  if (!level.modifiers.priceVolatility) return;
  const rng = stream(state.rng, 'market');
  for (const c of crops) {
    const m = state.market[c.id] ?? 1;
    const next = m + (1 - m) * MARKET.meanReversion + (rng.float() - 0.5) * MARKET.amplitude;
    state.market[c.id] = round2(Math.min(MARKET.max, Math.max(MARKET.min, next)));
  }
}

export function marketMultiplier(state, cropId) {
  return state.market[cropId] ?? 1;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}
