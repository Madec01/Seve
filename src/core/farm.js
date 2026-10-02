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
//   (carrière seulement) lot, env ('field' | 'orchard' | 'greenhouse' | null = parcelle retirée), cell, crow, crowPenalty
//     — voir src/core/career/land.js. La serre : ni gel, ni pluie, ni canicule ; pousse du niveau de la serre.

import { EPSILON, GROWTH, PLOT_COST, SEASONS, WEATHER_TYPES } from '../data/balance.js';
import { perkValue } from './perks.js';
import { getCrop, isTreeCrop } from '../data/crops.js';
import { growthBonus, priceBonus } from './economy.js';
import { marketMultiplier } from './market.js';
import { growTree, isFruitReady, pollinationFactor } from './trees.js';
import { buildingLevelData } from './career/effects.js';
import { careerCropPrice } from './career/market.js';
import { START_FIELD } from '../data/career/lots.js';
import { SKY } from '../data/surprises.js';

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
  if (state.mode === 'career') {
    // Carrière : seules les 4 parcelles fermées du champ de départ s'achètent (40 + 10 × déjà achetées).
    const closed = START_FIELD.cols * START_FIELD.rows - START_FIELD.open;
    if (state.plotsBought >= closed) return null;
    return START_FIELD.plotCost.base + START_FIELD.plotCost.step * state.plotsBought;
  }
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
export function needsWaterToday(crop, weatherId, level = null) {
  if (!crop || isTreeCrop(crop) || crop.needsWater === false) return false;
  return dryGrowthOf(crop, !!WEATHER_TYPES[weatherId]?.noDryGrowth, level) < GROWTH.watered;
}

/**
 * Pousse d'un jour sans arrosage : valeur propre à la culture (pomme de terre), sinon celle du niveau
 * (mode de difficulté : level.dryGrowth / level.dryHeatwaveGrowth), sinon GROWTH (classique).
 */
export function dryGrowthOf(crop, heatwave, level = null) {
  if (heatwave) return crop.dryHeatwaveGrowth ?? level?.dryHeatwaveGrowth ?? GROWTH.dryHeatwave;
  return crop.dryGrowth ?? level?.dryGrowth ?? GROWTH.dry;
}

/** Vitesse de pousse d'une parcelle arrosée (1 + bonus des ruches). */
export function wateredRate(state, seasonIndex) {
  return GROWTH.watered * (1 + growthBonus(state, seasonIndex));
}

/** Carrière : true si la parcelle est dans la serre. */
export function inGreenhouse(plot) {
  return plot.env === 'greenhouse';
}

/**
 * Carrière : multiplicateur de pousse de la serre pour une saison (niveau 1-2 : × 0,5 en hiver ;
 * niveau 3 « chauffée » : × 1,1 toute l'année). 1 hors de la serre.
 */
export function greenhouseFactor(state, plot, seasonIndex) {
  if (!inGreenhouse(plot)) return 1;
  const gh = buildingLevelData(state, 'greenhouse');
  if (!gh) return 1;
  return SEASONS[seasonIndex] === 'winter' ? gh.winterGrowth : gh.growth;
}

/** Vitesse de pousse d'une parcelle arrosée, serre comprise (carrière ; ailleurs = wateredRate). */
export function plotWateredRate(state, plot, seasonIndex) {
  return wateredRate(state, seasonIndex) * greenhouseFactor(state, plot, seasonIndex);
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
 * @param {object} level       niveau (pousse sans arrosage du mode de difficulté ; défaut : GROWTH)
 */
export function growPlots(state, seasonIndex, weatherId, level = null) {
  const bonus = 1 + growthBonus(state, seasonIndex);
  const heatwave = !!WEATHER_TYPES[weatherId]?.noDryGrowth;
  const season = SEASONS[seasonIndex];
  const career = state.mode === 'career';
  for (const p of state.plots) {
    const crop = p.cropId ? getCrop(p.cropId) : null;
    if (crop && isTreeCrop(crop)) {
      growTree(state, p, season, bonus);
    } else if (crop && !isMature(p)) {
      if (career && inGreenhouse(p)) {
        // Serre : la météo n'y entre pas (pas de canicule) ; pousse du niveau de la serre.
        const base = p.watered ? GROWTH.watered : dryGrowthOf(crop, false, level);
        p.growth = Math.min(crop.growDays, p.growth + base * bonus * greenhouseFactor(state, p, seasonIndex));
      } else {
        const base = p.watered ? GROWTH.watered : dryGrowthOf(crop, heatwave, level);
        p.growth = Math.min(crop.growDays, p.growth + base * bonus);
      }
    }
    p.watered = false;
  }
}

/** Gel du premier jour d'hiver : vide les parcelles des cultures non résistantes. */
export function applyFrost(state) {
  const lost = [];
  state.plots.forEach((p, i) => {
    if (p.cropId && !getCrop(p.cropId).frostHardy && !inGreenhouse(p)) {
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
    if (p.giant !== undefined) return; // (lot 2) un légume géant ne pourrit pas (aucun tirage)
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
  for (const p of state.plots) if (p.cropId && !isTreeCrop(getCrop(p.cropId)) && !inGreenhouse(p)) p.watered = true;
}

/**
 * Arrosage automatique : arrose jusqu'à `capacity` parcelles plantées, non mûres et non arrosées,
 * dans l'ordre des index. Renvoie la liste des index arrosés.
 */
export function sprinklerWater(state, capacity, weatherId = null, level = null) {
  const done = [];
  for (let i = 0; i < state.plots.length && done.length < capacity; i++) {
    const p = state.plots[i];
    if (p.cropId && !p.watered && !isMature(p) && needsWaterToday(getCrop(p.cropId), weatherId, level)) {
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
  // (lot 2) soins et légume géant : propres à la culture en place.
  if (p.care !== undefined) delete p.care;
  if (p.giant !== undefined) delete p.giant;
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

/**
 * Prix de vente brut courant (× rawPriceFactor du niveau × cropPriceFactor du mode de difficulté),
 * sans rendement. Les produits transformés n'ont ni l'un ni l'autre.
 */
export function rawUnitPrice(state, level, crop) {
  if (state.mode === 'career') return careerCropPrice(state, level, crop);
  const price = currentUnitPrice(state, crop) * level.modifiers.rawPriceFactor * (level.cropPriceFactor ?? 1);
  // (lot 2) heure dorée : récoltes × 1,2 ce jour-là (jamais en Classique : pas de state.surprises).
  return state.surprises?.sky?.today === 'goldenhour' ? price * SKY.goldenPrice : price;
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
