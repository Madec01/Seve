// Bonus permanents (v3), achetés avec les étoiles entre les années — données pures.
// Voir docs/GAME_DESIGN.md § 12.4. Lecture dans une partie : src/core/perks.js (perkValue).
//
// Champs :
//   id, name, description   identifiant, nom et effet en une phrase (affichés dans la grange)
//   tier                    palier (1, 2, 3) : ouvert selon les étoiles GAGNÉES (PERK_TIERS)
//   costs                   prix en étoiles de chaque rang (un bonus à 2 rangs a 2 prix)
//   effect { key, values }  clé d'effet lue par le cœur, valeur par rang
//
// Clés d'effet : forecastDays, startMoney, seedFactor, springRentFactor, growthBonus, investmentFactor,
// plotDiscount, farmChargeReduction, productBonus, priceBonus, extraPlaces, treeDiscount,
// treeGrowReduction (orchardist : deux effets), frostRefund, extraCrops.

import { NEW_CROPS } from './crops.js';

export const PERK_TIERS = [
  { tier: 1, starsRequired: 0 },
  { tier: 2, starsRequired: 8 },
  { tier: 3, starsRequired: 18 },
];

export const PERKS = [
  {
    id: 'almanac',
    name: 'Almanach',
    description: 'La météo d\'après-demain s\'affiche aussi.',
    tier: 1,
    costs: [1],
    effect: { key: 'forecastDays', values: [1] },
  },
  {
    id: 'startPurse',
    name: 'Bas de laine',
    description: 'Argent de départ : +15 pièces (rang 2 : +30).',
    tier: 1,
    costs: [2, 3],
    effect: { key: 'startMoney', values: [15, 30] },
  },
  {
    id: 'goodSeeds',
    name: 'Graines sélectionnées',
    description: 'Les graines coûtent 10 % de moins (pas les pommiers).',
    tier: 1,
    costs: [2],
    effect: { key: 'seedFactor', values: [0.9] },
  },
  {
    id: 'goodNeighbor',
    name: 'Bon voisinage',
    description: 'Le fermage de printemps baisse de 15 %.',
    tier: 1,
    costs: [2],
    effect: { key: 'springRentFactor', values: [0.85] },
  },
  {
    id: 'greenThumb',
    name: 'Main verte',
    description: 'Tout pousse 5 % plus vite hors hiver (cultures et arbres).',
    tier: 2,
    costs: [3],
    effect: { key: 'growthBonus', values: [0.05] },
  },
  {
    id: 'haggler',
    name: 'Marchandage',
    description: 'Investissements et ateliers coûtent 5 % de moins.',
    tier: 2,
    costs: [3],
    effect: { key: 'investmentFactor', values: [0.95] },
  },
  {
    id: 'surveyor',
    name: 'Arpenteur',
    description: 'Chaque parcelle achetée coûte 10 pièces de moins.',
    tier: 2,
    costs: [2],
    effect: { key: 'plotDiscount', values: [10] },
  },
  {
    id: 'frugal',
    name: 'Ferme économe',
    description: 'Les charges fixes de la ferme baissent d\'1 pièce par jour.',
    tier: 2,
    costs: [3],
    effect: { key: 'farmChargeReduction', values: [1] },
  },
  {
    id: 'grandmaRecipes',
    name: 'Recettes de grand-mère',
    description: 'Les produits transformés se vendent 10 % plus cher.',
    tier: 2,
    costs: [2],
    effect: { key: 'productBonus', values: [0.1] },
  },
  {
    id: 'famousStand',
    name: 'Réputation',
    description: 'Tout se vend 5 % plus cher (récoltes et produits).',
    tier: 3,
    costs: [4],
    effect: { key: 'priceBonus', values: [0.05] },
  },
  {
    id: 'artisan',
    name: 'Artisan',
    description: 'Une place de plus dans chaque atelier.',
    tier: 3,
    costs: [3],
    effect: { key: 'extraPlaces', values: [1] },
  },
  {
    id: 'orchardist',
    name: 'Arboriste',
    description: 'Les pommiers coûtent 10 pièces de moins et sont adultes 2 jours plus tôt.',
    tier: 3,
    costs: [3],
    effect: { key: 'treeDiscount', values: [10] },
    extraEffects: [{ key: 'treeGrowReduction', values: [2] }],
  },
  {
    id: 'frostInsurance',
    name: 'Assurance gel',
    description: 'Au gel du premier jour d\'hiver, les graines des cultures gelées sont remboursées.',
    tier: 3,
    costs: [3],
    effect: { key: 'frostRefund', values: [true] },
  },
  {
    id: 'seedMerchant',
    name: 'Semencier',
    description: 'Pomme de terre, fraise, courgette, citrouille et pommier dans les niveaux 1 à 8.',
    tier: 3,
    costs: [5],
    effect: { key: 'extraCrops', values: [NEW_CROPS] },
  },
];

export const PERKS_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export function getPerk(id) {
  return PERKS_BY_ID[id] || null;
}

/** Rang maximal d'un bonus. */
export function perkMaxRank(perk) {
  return perk.costs.length;
}

/** Tous les effets d'un bonus (effet principal + effets secondaires). */
export function perkEffects(perk) {
  return [perk.effect, ...(perk.extraEffects || [])];
}
