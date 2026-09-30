// Bonus permanents d'une partie (v3) : lecture de state.perks ({ [perkId]: rang }), copiés au lancement.
// Avec state.perks = {} (aucun bonus), chaque effet vaut sa valeur neutre : le jeu v2 est inchangé.

import { CROPS } from '../data/crops.js';
import { PERKS, getPerk, perkEffects, perkMaxRank } from '../data/perks.js';

/** Valeurs neutres de chaque clé d'effet (aucun bonus). */
const NEUTRAL = {
  forecastDays: 0,
  startMoney: 0,
  seedFactor: 1,
  springRentFactor: 1,
  growthBonus: 0,
  investmentFactor: 1,
  plotDiscount: 0,
  farmChargeReduction: 0,
  productBonus: 0,
  priceBonus: 0,
  extraPlaces: 0,
  treeDiscount: 0,
  treeGrowReduction: 0,
  frostRefund: false,
  extraCrops: [],
};

/**
 * Nettoie une liste de bonus reçue (createGame, sauvegarde) : ids connus, rangs entiers de 1 au
 * rang maximal ; le reste est ignoré. Renvoie un NOUVEL objet, clés dans l'ordre de PERKS.
 */
export function normalizeRunPerks(perks) {
  const out = {};
  if (!perks || typeof perks !== 'object' || Array.isArray(perks)) return out;
  for (const perk of PERKS) {
    const rank = perks[perk.id];
    if (Number.isInteger(rank) && rank >= 1) out[perk.id] = Math.min(rank, perkMaxRank(perk));
  }
  return out;
}

/** Valeur d'une clé d'effet dans la partie (valeur neutre si aucun bonus ne la donne). */
export function perkValue(state, key) {
  const perks = state.perks;
  if (perks) {
    for (const id in perks) {
      const perk = getPerk(id);
      const rank = perks[id];
      if (!perk || !(rank >= 1)) continue;
      for (const eff of perkEffects(perk)) {
        if (eff.key === key) return eff.values[Math.min(rank, eff.values.length) - 1];
      }
    }
  }
  return NEUTRAL[key];
}

/** true si la partie a au moins un bonus permanent. */
export function hasPerks(state) {
  return !!state.perks && Object.keys(state.perks).length > 0;
}

/** Cultures de la partie : celles du niveau, + les nouveautés avec « Semencier » (dans l'ordre de CROPS). */
export function gameCrops(level, perks) {
  const extra = perkValue({ perks }, 'extraCrops');
  const ids = new Set([...(level.crops || CROPS.map((c) => c.id)), ...extra]);
  return CROPS.filter((c) => ids.has(c.id));
}
