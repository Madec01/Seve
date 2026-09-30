// Arbres fruitiers (v3) : le pommier occupe une parcelle toute l'année (voir docs/GAME_DESIGN.md § 12.1).
//
// Une parcelle d'arbre : cropId = 'apple', growth = maturité de l'arbre (0 → jours pour être adulte,
// « Arboriste » compris), fruit = jours de fruits accumulés (0 → fruitDays), watered toujours false.
//
// Règles :
//   - chaque aube dont le jour écoulé était au printemps, en été ou en automne, l'arbre grandit de
//     1 jour × (1 + bonus de pousse), jusqu'à l'âge adulte ; en hiver, rien ne bouge (dormance) ;
//   - sur un arbre adulte, les fruits avancent de 1 jour × (1 + bonus de pousse) aux aubes dont le jour
//     écoulé appartient à fruitSeasons ; à fruitDays, la récolte est mûre (et y reste indéfiniment) ;
//   - l'arrosage, la pluie, la canicule et le gel n'ont aucun effet ; pas de fatigue du sol ;
//   - récolter remet les fruits à 0 (l'arbre reste) ; arracher vide la parcelle.

import { EPSILON, SEASONS } from '../data/balance.js';
import { getCrop, isTreeCrop } from '../data/crops.js';
import { perkValue } from './perks.js';

/** true si la parcelle porte un arbre. */
export function isTreePlot(plot) {
  return !!plot.cropId && isTreeCrop(getCrop(plot.cropId));
}

/** Jours pour qu'un arbre devienne adulte dans cette partie (« Arboriste » : 2 de moins). */
export function treeGrowDays(state, crop) {
  return Math.max(1, crop.growDays - perkValue(state, 'treeGrowReduction'));
}

/** Prix du jeune plant dans cette partie (« Arboriste » : 10 de moins). */
export function treeSeedCost(state, crop) {
  return Math.max(1, crop.seedCost - perkValue(state, 'treeDiscount'));
}

export function isTreeAdult(state, plot) {
  const crop = getCrop(plot.cropId);
  return plot.growth >= treeGrowDays(state, crop) - EPSILON;
}

/** true si les fruits de l'arbre sont mûrs (récoltables). */
export function isFruitReady(plot) {
  const crop = getCrop(plot.cropId);
  return !!crop && (plot.fruit || 0) >= crop.fruitDays - EPSILON;
}

/** 'sapling' (jeune plant) | 'young' (jeune arbre) | 'adult'. */
export function treeStage(state, plot) {
  const days = treeGrowDays(state, getCrop(plot.cropId));
  if (plot.growth >= days - EPSILON) return 'adult';
  return plot.growth < days / 2 - EPSILON ? 'sapling' : 'young';
}

/** Étape des fruits 0..3 (3 = mûrs ; le rendu dessine les pommes à partir de 2). */
export function fruitStage(plot) {
  const crop = getCrop(plot.cropId);
  if (isFruitReady(plot)) return 3;
  return Math.min(2, Math.floor(((plot.fruit || 0) / crop.fruitDays) * 3 + EPSILON));
}

/**
 * Pousse d'un arbre à l'aube.
 * @param {string} season  saison du jour écoulé
 * @param {number} rate    1 + bonus de pousse de ce jour-là
 */
export function growTree(state, plot, season, rate) {
  if (season === 'winter') return;
  const crop = getCrop(plot.cropId);
  const days = treeGrowDays(state, crop);
  if (plot.growth < days - EPSILON) {
    plot.growth = Math.min(days, plot.growth + rate);
    return;
  }
  if (crop.fruitSeasons.includes(season) && !isFruitReady(plot)) {
    plot.fruit = Math.min(crop.fruitDays, (plot.fruit || 0) + rate);
  }
}

/** Plante un arbre sur une parcelle vide (adulte si `adult`). */
export function setTree(state, plot, cropId, adult = false) {
  const crop = getCrop(cropId);
  plot.cropId = cropId;
  plot.growth = adult ? treeGrowDays(state, crop) : 0;
  plot.fruit = 0;
  plot.watered = false;
  plot.fatigued = false;
}

/** Rendement d'une récolte de pommes : 0,5 sans ruche au niveau « pollinisation », sinon 1. */
export function pollinationFactor(state, level, cropId) {
  if (!level.modifiers.pollination || !isTreeCrop(getCrop(cropId))) return 1;
  return (state.investments.beehive || 0) > 0 ? 1 : 0.5;
}

/**
 * Prévision d'un arbre jusqu'à la fin de l'année, en supposant chaque récolte faite dès qu'elle est
 * mûre et un bonus de pousse constant (celui d'aujourd'hui) :
 * { adultInDays (0 si adulte), fruitDaysLeft (0 si mûr, null si aucune récolte d'ici la fin),
 *   harvests (récoltes encore possibles, celle du jour comprise) }.
 * @param {object} tree { growth, fruit } — état de départ (une parcelle, ou { growth: 0, fruit: 0 } pour un plant)
 * @param {(seasonIndex) => number} rateOf  1 + bonus de pousse d'un jour de cette saison
 */
export function treeForecast(state, level, crop, tree, rateOf) {
  const days = treeGrowDays(state, crop);
  const total = level.seasonLengths.reduce((a, b) => a + b, 0);
  const seasonOfDay = (d) => {
    let acc = 0;
    for (let s = 0; s < level.seasonLengths.length; s++) {
      acc += level.seasonLengths[s];
      if (d <= acc) return s;
    }
    return level.seasonLengths.length - 1;
  };
  let growth = tree.growth;
  let fruit = tree.fruit || 0;
  let adultInDays = growth >= days - EPSILON ? 0 : null;
  let fruitDaysLeft = null;
  let harvests = 0;
  const today = state.time.day;
  if (fruit >= crop.fruitDays - EPSILON) {
    fruitDaysLeft = 0;
    harvests++;
    fruit = 0;
  }
  // Aube du jour today + k : elle fait pousser d'après le jour écoulé today + k − 1.
  for (let k = 1; today + k <= total; k++) {
    const si = seasonOfDay(today + k - 1);
    const season = SEASONS[si];
    if (season === 'winter') continue;
    const rate = rateOf(si);
    if (growth < days - EPSILON) {
      growth = Math.min(days, growth + rate);
      if (growth >= days - EPSILON && adultInDays === null) adultInDays = k;
      continue;
    }
    if (crop.fruitSeasons.includes(season)) {
      fruit = Math.min(crop.fruitDays, fruit + rate);
      if (fruit >= crop.fruitDays - EPSILON) {
        if (fruitDaysLeft === null) fruitDaysLeft = k;
        harvests++;
        fruit = 0;
      }
    }
  }
  return { adultInDays, fruitDaysLeft, harvests };
}
