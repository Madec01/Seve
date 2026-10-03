// Mode Carrière — cours du marché et prix de vente (pur). Conception : docs/CARRIERE.md § 3.2.
//
// Chaque aube, chaque culture a un cours entre × 0,8 et × 1,3 (flux aléatoire « market » de la partie,
// rappel vers 1 de 0,5, pas de ± 0,1). Une culture vendue dans une saison où elle ne peut pas être semée
// vaut × 1,25 (« hors saison »). Les jours de fête (lot CORE-C) passent par le fournisseur `priceFactor`.
//
// Prix d'une récolte = prix de base × difficulté (1,25 en Détente) × cours × hors saison
//   × (1 + étal + vendeur…) × fêtes × rendement × 1,10 si récoltée à la main (× 0,5 corbeau), arrondi.

import { SEASONS } from '../../data/balance.js';
import { CROPS } from '../../data/crops.js';
import { CAREER_MARKET, OFF_SEASON_FACTOR } from '../../data/career/career.js';
import { stream } from '../rng.js';
import { priceBonus } from '../economy.js';
import { providedFactor } from './registry.js';
import { themeMarketBounds } from '../variety-effects.js';

/** Cours de départ : 1 pour toutes les cultures (même celles d'un rang pas encore atteint). */
export function initialCareerMarket() {
  return Object.fromEntries(CROPS.map((c) => [c.id, 1]));
}

/** Nouveau cours du jour, pour toutes les cultures (aube, étape 6). */
export function updateCareerMarket(state) {
  const rng = stream(state.rng, 'market');
  const { meanReversion, step } = CAREER_MARKET;
  // (lot 3) Année des grands marchés : cours plus vifs (× 0,7 à × 1,45) — mêmes tirages.
  const bounds = state.variety ? themeMarketBounds(state) : null;
  const min = bounds ? bounds.min : CAREER_MARKET.min;
  const max = bounds ? bounds.max : CAREER_MARKET.max;
  for (const c of CROPS) {
    const m = state.market[c.id] ?? 1;
    const next = m + (1 - m) * meanReversion + (rng.float() * 2 - 1) * step;
    state.market[c.id] = Math.round(Math.min(max, Math.max(min, next)) * 100) / 100;
  }
}

/** true si la culture ne peut pas être semée (hors serre) dans la saison du jour. */
export function isOffSeason(state, crop) {
  return !crop.seasons.includes(SEASONS[state.time.seasonIndex]);
}

export function offSeasonFactor(state, crop) {
  return isOffSeason(state, crop) ? OFF_SEASON_FACTOR : 1;
}

/**
 * Prix brut courant d'une culture en carrière (sans rendement ni bonus « à la main ») :
 * base × difficulté × cours × hors saison × (1 + bonus de prix) × fêtes.
 * @param {string} kind 'crop' (récolte) ou 'stock' (vente du grenier) — pour le fournisseur priceFactor
 */
export function careerCropPrice(state, level, crop, kind = 'crop') {
  return (
    crop.sellPrice
    * (level.cropPriceFactor ?? 1)
    * (state.market[crop.id] ?? 1)
    * offSeasonFactor(state, crop)
    * (1 + priceBonus(state))
    * providedFactor('priceFactor', state, { kind, id: crop.id })
  );
}

/** Multiplicateur d'un produit transformé en carrière (fêtes : Marché de Noël…). */
export function careerProductFactor(state, productId) {
  return providedFactor('priceFactor', state, { kind: 'product', id: productId });
}

/** Pour query.career.market() : { [cropId]: { multiplier, offSeason, fair } }. */
export function marketInfo(state, cropIds) {
  const out = {};
  for (const c of CROPS) {
    if (cropIds && !cropIds.includes(c.id)) continue;
    const fair = providedFactor('priceFactor', state, { kind: 'crop', id: c.id });
    out[c.id] = { multiplier: state.market[c.id] ?? 1, offSeason: isOffSeason(state, c), fair };
  }
  return out;
}
