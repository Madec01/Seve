// Cultures — données pures.
// Ajouter une culture = ajouter une entrée ici (et ses sprites dans le rendu).
//
// Champs :
//   id          identifiant anglais (clé des sprites et des sauvegardes)
//   name        nom affiché
//   seasons     saisons où l'on peut la planter
//   growDays    jours de pousse (arrosée chaque jour) avant maturité
//   seedCost    prix de la graine
//   sellPrice   prix de vente de base à la récolte
//   frostHardy  true si elle résiste au gel du 1er jour d'hiver
//   kind        'crop' (défaut) ou 'tree' (arbre fruitier : reste sur la parcelle, voir src/core/trees.js)
//   dryGrowth           pousse d'un jour non arrosé (défaut GROWTH.dry = 0,5) — pomme de terre : 1
//   dryHeatwaveGrowth   pousse d'un jour de canicule non arrosé (défaut GROWTH.dryHeatwave = 0) — pomme de terre : 0,5
//   (arbres) growDays   jours avant d'être adulte ; fruitDays : jours pour qu'une récolte mûrisse ;
//            fruitSeasons : saisons où les fruits avancent ; needsWater : false (ne s'arrose pas) ;
//            sellPrice : prix d'un panier ; seedCost : prix du jeune plant
//
// Ordre : les 7 cultures d'origine d'abord (ordre inchangé depuis la v2), puis les nouveautés v3.

import { VALLEY_TREES } from './career/places.js';

export const CROPS = [
  { id: 'carrot', name: 'Carotte', seasons: ['spring', 'autumn'], growDays: 2, seedCost: 4, sellPrice: 10, frostHardy: false },
  { id: 'turnip', name: 'Navet', seasons: ['spring', 'autumn', 'winter'], growDays: 3, seedCost: 6, sellPrice: 14, frostHardy: true },
  { id: 'wheat', name: 'Blé', seasons: ['spring', 'summer'], growDays: 4, seedCost: 5, sellPrice: 16, frostHardy: false },
  { id: 'cabbage', name: 'Chou', seasons: ['autumn', 'winter'], growDays: 4, seedCost: 8, sellPrice: 20, frostHardy: true },
  { id: 'tomato', name: 'Tomate', seasons: ['summer'], growDays: 5, seedCost: 12, sellPrice: 38, frostHardy: false },
  { id: 'corn', name: 'Maïs', seasons: ['summer', 'autumn'], growDays: 6, seedCost: 15, sellPrice: 50, frostHardy: false },
  { id: 'sunflower', name: 'Tournesol', seasons: ['summer'], growDays: 5, seedCost: 10, sellPrice: 32, frostHardy: false },
  // ── v3 ──
  { id: 'potato', name: 'Pomme de terre', seasons: ['spring', 'summer', 'autumn'], growDays: 4, seedCost: 5, sellPrice: 16, frostHardy: false, dryGrowth: 1, dryHeatwaveGrowth: 0.5 },
  { id: 'strawberry', name: 'Fraise', seasons: ['spring', 'summer'], growDays: 4, seedCost: 12, sellPrice: 26, frostHardy: false },
  { id: 'zucchini', name: 'Courgette', seasons: ['summer'], growDays: 3, seedCost: 8, sellPrice: 22, frostHardy: false },
  { id: 'pumpkin', name: 'Citrouille', seasons: ['summer', 'autumn'], growDays: 7, seedCost: 18, sellPrice: 62, frostHardy: false },
  {
    id: 'apple',
    name: 'Pommier',
    kind: 'tree',
    seasons: ['spring', 'summer', 'autumn'],
    growDays: 6,
    fruitDays: 3,
    fruitSeasons: ['summer', 'autumn'],
    seedCost: 45,
    sellPrice: 26,
    frostHardy: true,
    needsWater: false,
  },
];

/** Les 7 cultures d'origine (niveaux 1 à 8). */
export const BASE_CROPS = ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower'];

/** Les nouveautés v3 (niveaux 9 à 12, ou bonus « Semencier » dans les niveaux 1 à 8). */
export const NEW_CROPS = ['potato', 'strawberry', 'zucchini', 'pumpkin', 'apple'];

/**
 * (lot 3) Graines rares : elles n'existent que par le colporteur Basile (et les cartes « Sachet de graines rares »,
 * le visiteur de l'année des lumières). HORS de CROPS (le marché de carrière, les trouvailles et « Herbier complet »
 * parcourent CROPS : y ajouter une culture changerait leurs tirages) ; jamais dans les listes des niveaux ni les
 * rangs de la carrière, jamais semées par le semoir ni les jardiniers, jamais demandées par le tableau ni la
 * charrette. Un semis consomme une graine du sachet (state.variety.rare), sans payer. Pas de recette d'atelier.
 * Règles : docs/GAME_DESIGN.md § 16.7.
 */
export const RARE_CROPS = [
  { id: 'pea', name: 'Petits pois', seasons: ['spring'], growDays: 3, seedCost: 5, sellPrice: 17, frostHardy: false, rare: true },
  { id: 'melon', name: 'Melon', seasons: ['summer'], growDays: 6, seedCost: 15, sellPrice: 64, frostHardy: false, rare: true },
  { id: 'leek', name: 'Poireau', seasons: ['autumn', 'winter'], growDays: 5, seedCost: 8, sellPrice: 27, frostHardy: true, rare: true },
];

export const RARE_CROP_IDS = RARE_CROPS.map((c) => c.id);

/** Accès par identifiant (cultures ordinaires ; getCrop trouve aussi les graines rares). */
export const CROPS_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));

const RARE_BY_ID = Object.fromEntries(RARE_CROPS.map((c) => [c.id, c]));

/**
 * (Vallée V3) Le cerisier et le poirier du verger conservatoire (VALLEY_TREES, src/data/career/places.js) : HORS de CROPS,
 * comme les graines rares ; getCrop les trouve (règles des arbres de src/core/trees.js).
 */
export { VALLEY_TREES };
const VALLEY_TREES_BY_ID = Object.fromEntries(VALLEY_TREES.map((c) => [c.id, c]));

export function getCrop(id) {
  return CROPS_BY_ID[id] || RARE_BY_ID[id] || VALLEY_TREES_BY_ID[id] || null;
}

/** true si c'est un arbre du verger conservatoire (cerisier, poirier : carrière, Vallée V3). */
export function isValleyTree(id) {
  return !!VALLEY_TREES_BY_ID[typeof id === 'string' ? id : id?.id];
}

/** true si c'est une graine rare du colporteur (pea, melon, leek). */
export function isRareCrop(id) {
  return !!RARE_BY_ID[typeof id === 'string' ? id : id?.id];
}

/** true si c'est un arbre fruitier (pommier). */
export function isTreeCrop(crop) {
  return !!crop && crop.kind === 'tree';
}
