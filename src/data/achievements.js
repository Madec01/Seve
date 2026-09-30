// Succès (v3) — données pures ; les conditions sont évaluées dans src/core/progression.js.
// Voir docs/GAME_DESIGN.md § 12.5.
//
// Champs : id, name, description (condition affichée), reward { stars: 0|1, ecus }, check { type, ...params }.
// Types de condition :
//   lifetimeHarvests {n}          récoltes cumulées (toutes parties + partie en cours)
//   lifetimeCropSet {cropIds}     chacune de ces cultures récoltée au moins une fois (cumul)
//   seasonHarvestIncome {n}       ventes de récoltes d'une même saison ≥ n (partie en cours)
//   winNoLoss {minLevel}          année gagnée (niveau ≥ minLevel) sans culture perdue (gel ni maladie)
//   yearHarvest {cropId, n}       n récoltes de cette culture dans l'année
//   adultTrees {n}                n pommiers adultes en même temps
//   owned {id, n}                 n unités d'un investissement
//   ownedTogether {ids}           au moins une unité de chacun en même temps
//   ownAllInLevel                 au moins un exemplaire de chaque investissement proposé dans le niveau
//   zeroCharges                   charges quotidiennes à 0
//   lifetimeProducts {n}          produits transformés vendus (cumul)
//   anyProductSold {productIds?}  au moins un produit vendu (parmi productIds si donné ; cumul)
//   yearProducts {productIds, n}  n produits de ces types vendus dans l'année
//   levelsWon {ids}               tous ces niveaux gagnés
//   threeStars {n}                ★★★ sur n niveaux
//   threeStarsAll                 ★★★ sur tous les niveaux
//   yearEndMoney {n}              année gagnée avec au moins n pièces
//   closeCall {n}                 un fermage payé en gardant moins de n pièces
//   purist {minLevel}             ★★★ sur un niveau ≥ minLevel avec les bonus permanents éteints
//   winNoInvestment {minLevel}    année gagnée (niveau ≥ minLevel) sans acheter d'investissement
//   decorationsPlaced {n}         n décorations posées en même temps

import { CROPS } from './crops.js';

const ALL_CROP_IDS = CROPS.map((c) => c.id);

export const ACHIEVEMENTS = [
  { id: 'firstHarvest', name: 'Premier panier', description: 'Récolter une culture.', reward: { stars: 0, ecus: 5 }, check: { type: 'lifetimeHarvests', n: 1 } },
  { id: 'harvest100', name: 'Cent paniers', description: '100 récoltes, toutes parties confondues.', reward: { stars: 1, ecus: 10 }, check: { type: 'lifetimeHarvests', n: 100 } },
  { id: 'harvest500', name: 'Grenier plein', description: '500 récoltes, toutes parties confondues.', reward: { stars: 1, ecus: 20 }, check: { type: 'lifetimeHarvests', n: 500 } },
  { id: 'allCrops', name: 'Herbier complet', description: 'Avoir récolté chacune des 11 cultures et des pommes.', reward: { stars: 1, ecus: 20 }, check: { type: 'lifetimeCropSet', cropIds: ALL_CROP_IDS } },
  { id: 'goldenSeason', name: 'Saison dorée', description: '500 pièces de ventes de récoltes en une seule saison.', reward: { stars: 0, ecus: 20 }, check: { type: 'seasonHarvestIncome', n: 500 } },
  { id: 'noLoss', name: 'Rien ne se perd', description: 'Gagner une année (niveau 2 ou plus) sans perdre une culture (gel ni maladie).', reward: { stars: 0, ecus: 20 }, check: { type: 'winNoLoss', minLevel: 2 } },
  { id: 'pumpkinKing', name: 'Roi de la citrouille', description: '10 citrouilles récoltées dans la même année.', reward: { stars: 0, ecus: 20 }, check: { type: 'yearHarvest', cropId: 'pumpkin', n: 10 } },
  { id: 'orchard', name: 'Le verger', description: '6 pommiers adultes en même temps.', reward: { stars: 0, ecus: 20 }, check: { type: 'adultTrees', n: 6 } },
  { id: 'henHouse', name: 'Basse-cour', description: 'Posséder 3 poulaillers.', reward: { stars: 0, ecus: 10 }, check: { type: 'owned', id: 'chickenCoop', n: 3 } },
  { id: 'herd', name: 'Le troupeau', description: 'Au moins une vache, un mouton et une chèvre en même temps.', reward: { stars: 0, ecus: 15 }, check: { type: 'ownedTogether', ids: ['cow', 'sheep', 'goat'] } },
  { id: 'fullFarm', name: 'Ferme complète', description: 'Au moins un exemplaire de chaque investissement proposé dans le niveau.', reward: { stars: 0, ecus: 30 }, check: { type: 'ownAllInLevel' } },
  { id: 'greenEnergy', name: 'Énergie verte', description: 'Des charges quotidiennes à 0.', reward: { stars: 0, ecus: 10 }, check: { type: 'zeroCharges' } },
  { id: 'firstProduct', name: 'Fait maison', description: 'Vendre un produit transformé.', reward: { stars: 0, ecus: 5 }, check: { type: 'anyProductSold' } },
  { id: 'artisan50', name: 'Artisan du terroir', description: '50 produits transformés vendus, toutes parties confondues.', reward: { stars: 1, ecus: 20 }, check: { type: 'lifetimeProducts', n: 50 } },
  { id: 'cheeseMaster', name: 'Maître fromager', description: '10 fromages de chèvre vendus dans la même année.', reward: { stars: 0, ecus: 20 }, check: { type: 'yearProducts', productIds: ['goatCheese'], n: 10 } },
  { id: 'baker', name: 'Le boulanger', description: 'Vendre un pain.', reward: { stars: 0, ecus: 10 }, check: { type: 'anyProductSold', productIds: ['bread'] } },
  { id: 'firstYear', name: 'Première année réussie', description: 'Gagner le niveau 1.', reward: { stars: 0, ecus: 10 }, check: { type: 'levelsWon', ids: [1] } },
  { id: 'veteran', name: 'Fermier aguerri', description: 'Gagner les niveaux 1 à 8.', reward: { stars: 1, ecus: 30 }, check: { type: 'levelsWon', ids: [1, 2, 3, 4, 5, 6, 7, 8] } },
  { id: 'lifetime', name: 'Une vie à la ferme', description: 'Gagner les 12 niveaux.', reward: { stars: 1, ecus: 50 }, check: { type: 'levelsWon', ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } },
  { id: 'risingStar', name: 'Étoile montante', description: '★★★ sur 5 niveaux.', reward: { stars: 1, ecus: 20 }, check: { type: 'threeStars', n: 5 } },
  { id: 'modelFarm', name: 'Ferme modèle', description: '★★★ sur les 12 niveaux.', reward: { stars: 0, ecus: 100 }, check: { type: 'threeStarsAll' } },
  { id: 'strongbox', name: 'Coffre-fort', description: 'Finir une année avec 1 500 pièces ou plus.', reward: { stars: 0, ecus: 30 }, check: { type: 'yearEndMoney', n: 1500 } },
  { id: 'closeCall', name: 'Sur le fil', description: 'Payer un fermage et garder moins de 10 pièces.', reward: { stars: 0, ecus: 10 }, check: { type: 'closeCall', n: 10 } },
  { id: 'purist', name: 'Pur et dur', description: '★★★ sur un niveau 2 ou plus, bonus permanents éteints.', reward: { stars: 1, ecus: 30 }, check: { type: 'purist', minLevel: 2 } },
  { id: 'handmade', name: 'À la force des bras', description: 'Gagner une année (niveau 2 ou plus) sans acheter d\'investissement.', reward: { stars: 0, ecus: 20 }, check: { type: 'winNoInvestment', minLevel: 2 } },
  { id: 'prettyFarm', name: 'Jolie ferme', description: '10 décorations posées en même temps.', reward: { stars: 0, ecus: 20 }, check: { type: 'decorationsPlaced', n: 10 } },
];

export const ACHIEVEMENTS_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return ACHIEVEMENTS_BY_ID[id] || null;
}
