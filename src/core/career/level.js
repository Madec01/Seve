// Mode Carrière — careerLevel(state) : un objet DE MÊME FORME qu'un niveau (src/data/levels.js), recalculé
// après chaque achat, passage de rang ou changement de l'amitié de Joseph. Le cœur (game.js, farm.js,
// economy.js…) le lit comme un niveau : cultures du rang, investissements débloqués, durée des saisons,
// météo douce, nombres de la difficulté, plafond du prêt de Joseph.

import { CROPS, getCrop } from '../../data/crops.js';
import { getLevel } from '../../data/levels.js';
import { getInvestment } from '../../data/investments.js';
import { CROPS_BY_RANK, JOSEPH_LOAN_HEARTS } from '../../data/career/career.js';
import { BUILDINGS_BY_ID, WORKSHOPS } from '../../data/career/buildings.js';
import { START_FIELD } from '../../data/career/lots.js';
import { careerDifficulty, careerInvestments, careerSeasonCharge } from './effects.js';

/** Cultures débloquées à un rang (ordre de CROPS). */
export function cropsForRank(rank) {
  const ids = new Set();
  for (const [r, list] of Object.entries(CROPS_BY_RANK)) if (Number(r) <= rank) for (const id of list) ids.add(id);
  return CROPS.filter((c) => ids.has(c.id)).map((c) => c.id);
}

/** Rang qui débloque une culture (null si jamais). */
export function cropRank(cropId) {
  for (const [r, list] of Object.entries(CROPS_BY_RANK)) if (list.includes(cropId)) return Number(r);
  return null;
}

/** Prêt de Joseph selon la difficulté et l'amitié (4 ♥ : plafond × 2 ; 6 ♥ : sans supplément). */
export function josephLoanConfig(state) {
  const base = careerDifficulty(state).neighbourLoan;
  if (!base) return null;
  const hearts = state.career.joseph?.hearts || 0;
  const cfg = { ...base };
  if (hearts >= JOSEPH_LOAN_HEARTS.doubleCap) {
    cfg.maxShare = base.maxShare * 2;
    cfg.minCover = base.minCover * 2;
  }
  if (hearts >= JOSEPH_LOAN_HEARTS.noSurcharge) cfg.surcharge = 0;
  return cfg;
}

export function careerLevel(state) {
  const c = state.career;
  const d = careerDifficulty(state);
  const L = c.seasonLength;
  const base = getLevel(1); // météo douce et contraintes neutres des niveaux
  const rank = c.rank;
  const investmentsById = {};
  const available = [];
  for (const inv of careerInvestments()) {
    investmentsById[inv.id] = inv;
    if ((inv.rank ?? 1) <= rank || (state.investments[inv.id] || 0) > 0) available.push(inv.id);
  }
  // Ateliers : l'investissement des niveaux sert aux recettes (places : src/core/processing.js, branche carrière).
  for (const id of WORKSHOPS) {
    const inv = getInvestment(id);
    if (!inv) continue;
    investmentsById[id] = inv;
    if (BUILDINGS_BY_ID[id].levels[0].rank <= rank || (state.investments[id] || 0) > 0) available.push(id);
  }
  const crops = cropsForRank(rank);
  // Arbres déjà plantés (sauvegarde, héritage) : leur culture reste connue.
  for (const p of state.plots) if (p.cropId && !crops.includes(p.cropId) && getCrop(p.cropId)) crops.push(p.cropId);
  return {
    id: 'career',
    career: true,
    name: c.farmName,
    description: '',
    tutorial: false,
    difficulty: c.difficulty,
    rank,
    startMoney: d.startMoney,
    gridCols: START_FIELD.cols,
    gridRows: Math.ceil(state.plots.length / START_FIELD.cols),
    startArea: { cols: START_FIELD.cols, rows: START_FIELD.open / START_FIELD.cols },
    unlockedPlots: START_FIELD.open,
    maxPlots: START_FIELD.cols * START_FIELD.rows,
    plotCost: { ...START_FIELD.plotCost },
    seasonLengths: [L, L, L, L],
    rents: null,
    seasonCharge: careerSeasonCharge(state),
    starThresholds: null,
    weather: base.weather,
    availableInvestments: available,
    investmentsById,
    crops: CROPS.filter((cr) => crops.includes(cr.id)).map((cr) => cr.id),
    startTrees: [],
    contest: null,
    seedMerchant: false,
    dailyCharge: d.dailyCharge,
    cropPriceFactor: d.cropPriceFactor,
    dryGrowth: d.dryGrowth,
    dryHeatwaveGrowth: d.dryHeatwaveGrowth,
    neighbourLoan: josephLoanConfig(state),
    modifiers: { ...base.modifiers },
  };
}
