// Le potager : parcelles, plantation, arrosage, pousse, récolte, gel, maladie, arrosage automatique.
//
// Une parcelle (dans state.plots) :
//   { unlocked, cropId, growth, watered, lastHarvested, fatigued, fruit, insured }
//   growth        jours de pousse accumulés (0 → growDays)
//   watered       arrosée aujourd'hui (remis à false à chaque aube, après la pousse)
//   lastHarvested dernière culture récoltée sur cette parcelle (fatigue du sol)
//   fatigued      la culture en place a été replantée juste après la même (rendement réduit)
//   fruit         (v3) arbres : jours de fruits accumulés (0 pour une culture) — voir src/core/trees.js
//   insured       (v3) « Assurance gel » : semée quand elle avait le temps de mûrir avant le gel (remboursée si elle gèle)

import { EPSILON, GROWTH, PLOT_COST, SEASONS, WEATHER_TYPES } from '../data/balance.js';
import { perkValue } from './perks.js';
import { getCrop, isTreeCrop } from '../data/crops.js';
import { growthBonus, priceBonus } from './economy.js';
import { marketMultiplier } from './market.js';
import { growTree, isFruitReady, pollinationFactor } from './trees.js';

/** Index des parcelles ouvertes au départ : bloc startArea centré horizontalement, en haut. */
export function initialUnlockedIndices(level) {
  const { gridCols, gridRows } = level;
  const area = level.startArea || { cols: gridCols, rows: gridRows };
  const cols = Math.min(area.cols, gridCols);
  const rows = Math.min(area.rows, gridRows);
  const offsetCol = Math.floor((gridCols - cols) / 2);
  const set = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) set.push(r * gridCols + offsetCol + c);
  }
  // Si unlockedPlots diffère du bloc, on complète (ou tronque) dans l'ordre des index.
  const target = Math.min(level.unlockedPlots, gridCols * gridRows);
  for (let i = 0; set.length < target && i < gridCols * gridRows; i++) {
    if (!set.includes(i)) set.push(i);
  }
  return set.slice(0, target).sort((a, b) => a - b);
}

export function createPlots(level) {
  const open = new Set(initialUnlockedIndices(level));
  const plots = [];
  for (let i = 0; i < level.gridCols * level.gridRows; i++) {
    plots.push({ unlocked: open.has(i), cropId: null, growth: 0, watered: false, lastHarvested: null, fatigued: false, fruit: 0, insured: false });
  }
  return plots;
}

export function unlockedCount(state) {
  return state.plots.reduce((n, p) => n + (p.unlocked ? 1 : 0), 0);
}

/** Prix de la prochaine parcelle achetée, ou null si le champ ne peut plus s'agrandir. */
export function plotUnlockCost(state, level) {
  if (unlockedCount(state) >= level.maxPlots) return null;
  const pc = level.plotCost || PLOT_COST;
  return Math.max(0, pc.base + pc.step * state.plotsBought - perkValue(state, 'plotDiscount'));
}

/** Récoltable : culture mûre, ou arbre aux fruits mûrs. */
export function isMature(plot) {
  const crop = plot.cropId && getCrop(plot.cropId);
  if (!crop) return false;
  if (isTreeCrop(crop)) return isFruitReady(plot);
  return plot.growth >= crop.growDays - EPSILON;
}

/**
 * true si arroser aujourd'hui fait une différence pour cette culture : jamais pour un arbre ;
 * pomme de terre (dryGrowth ≥ 1) : seulement un jour de canicule.
 */
export function needsWaterToday(crop, weatherId) {
  if (!crop || isTreeCrop(crop) || crop.needsWater === false) return false;
  const heatwave = !!WEATHER_TYPES[weatherId]?.noDryGrowth;
  const dry = heatwave ? (crop.dryHeatwaveGrowth ?? GROWTH.dryHeatwave) : (crop.dryGrowth ?? GROWTH.dry);
  return dry < GROWTH.watered;
}

/** Vitesse de pousse d'une parcelle arrosée (1 + bonus des ruches). */
export function wateredRate(state, seasonIndex) {
  return GROWTH.watered * (1 + growthBonus(state, seasonIndex));
}

/** Étape visuelle 0..4 : 0 = vient d'être plantée, 4 = mûre. */
export function stageOf(growth, growDays) {
  if (growth >= growDays - EPSILON) return 4;
  return Math.min(3, Math.floor((growth / growDays) * 4 + EPSILON));
}

/**
 * Pousse de l'aube, d'après l'arrosage et la météo de la veille, puis remise à zéro de l'arrosage.
 * @param {number} seasonIndex saison du jour écoulé (bonus des ruches)
 * @param {string} weatherId   météo du jour écoulé (canicule)
 */
export function growPlots(state, seasonIndex, weatherId) {
  const bonus = 1 + growthBonus(state, seasonIndex);
  const heatwave = !!WEATHER_TYPES[weatherId]?.noDryGrowth;
  const season = SEASONS[seasonIndex];
  for (const p of state.plots) {
    const crop = p.cropId ? getCrop(p.cropId) : null;
    if (crop && isTreeCrop(crop)) {
      growTree(state, p, season, bonus);
    } else if (crop && !isMature(p)) {
      const dry = heatwave ? (crop.dryHeatwaveGrowth ?? GROWTH.dryHeatwave) : (crop.dryGrowth ?? GROWTH.dry);
      const base = p.watered ? GROWTH.watered : dry;
      p.growth = Math.min(crop.growDays, p.growth + base * bonus);
    }
    p.watered = false;
  }
}

/** Gel du premier jour d'hiver : vide les parcelles des cultures non résistantes. */
export function applyFrost(state) {
  const lost = [];
  state.plots.forEach((p, i) => {
    if (p.cropId && !getCrop(p.cropId).frostHardy) {
      lost.push({ plotIndex: i, cropId: p.cropId });
      clearPlot(p);
    }
  });
  return lost;
}

/**
 * Maladie (aube pluvieuse) : chaque culture non récoltée pourrit avec la probabilité rotChance.
 * Arbres : seules des pommes MÛRES peuvent pourrir (fruits remis à 0, l'arbre reste).
 */
export function applyRot(state, rotChance, rng) {
  const lost = [];
  if (!(rotChance > 0)) return lost;
  state.plots.forEach((p, i) => {
    if (!p.cropId) return;
    const tree = isTreeCrop(getCrop(p.cropId));
    if (tree && !isFruitReady(p)) return;
    if (rng.chance(rotChance)) {
      lost.push({ plotIndex: i, cropId: p.cropId, tree });
      if (tree) p.fruit = 0;
      else clearPlot(p);
    }
  });
  return lost;
}

/** La pluie arrose toutes les parcelles plantées (pas les arbres, qui ne s'arrosent pas). */
export function rainWater(state) {
  for (const p of state.plots) if (p.cropId && !isTreeCrop(getCrop(p.cropId))) p.watered = true;
}

/**
 * Arrosage automatique : arrose jusqu'à `capacity` parcelles plantées, non mûres et non arrosées,
 * dans l'ordre des index. Renvoie la liste des index arrosés.
 */
export function sprinklerWater(state, capacity, weatherId = null) {
  const done = [];
  for (let i = 0; i < state.plots.length && done.length < capacity; i++) {
    const p = state.plots[i];
    if (p.cropId && !p.watered && !isMature(p) && needsWaterToday(getCrop(p.cropId), weatherId)) {
      p.watered = true;
      done.push(i);
    }
  }
  return done;
}

export function clearPlot(p) {
  p.cropId = null;
  p.growth = 0;
  p.watered = false;
  p.fatigued = false;
  p.fruit = 0;
  p.insured = false;
}

/** Facteur de rendement de la fatigue du sol pour une parcelle. */
export function fatigueFactor(level, plot) {
  return plot.fatigued ? 1 - level.modifiers.soilFatigue : 1;
}

/** true si planter cette culture sur cette parcelle serait « fatigué » (même culture que la dernière récolte). */
export function wouldFatigue(level, plot, cropId) {
  return level.modifiers.soilFatigue > 0 && plot.lastHarvested === cropId;
}

/** Prix de vente courant d'une culture (marché × étal × Réputation), sans fatigue ni baisse du niveau. */
export function currentUnitPrice(state, crop) {
  return crop.sellPrice * marketMultiplier(state, crop.id) * (1 + priceBonus(state));
}

/** Prix de vente brut courant (× rawPriceFactor du niveau), sans rendement. */
export function rawUnitPrice(state, level, crop) {
  return currentUnitPrice(state, crop) * level.modifiers.rawPriceFactor;
}

/** Rendement de la récolte d'une parcelle : fatigue du sol × pollinisation (arbres). */
export function yieldFactor(state, level, plot) {
  return fatigueFactor(level, plot) * pollinationFactor(state, level, plot.cropId);
}

/** Somme gagnée en récoltant la parcelle maintenant (vendue brute). */
export function harvestValue(state, level, plot) {
  const crop = getCrop(plot.cropId);
  return Math.round(rawUnitPrice(state, level, crop) * yieldFactor(state, level, plot));
}
