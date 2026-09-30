// Cœur du jeu : createGame() / loadGame() → { state, update, on, serialize, actions, query }.
// Contrat décrit dans docs/ARCHITECTURE.md. Logique pure : aucun accès au DOM.
//
// ── Déroulé d'une journée ──────────────────────────────────────────────────────────────
// update(dt) accumule dt × vitesse dans state.time.elapsed. Chaque fois que elapsed dépasse
// DAY_SECONDS, la journée se termine (fin de journée) puis la suivante commence (aube), dans
// l'ordre, autant de fois que nécessaire (un grand dt traite plusieurs jours d'affilée).
//
// Fin de journée (le soir) :
//   (v3) jour limite du concours (niveau 12) → remise des prix (contestAwarded), avant le fermage ;
//   si c'est le dernier jour de la saison :
//     (v3) filets de sécurité des ateliers : dernier jour de l'année → tout ce qui est en cours est
//          vendu en l'état (processingSoldRaw, raison 'yearEnd') ; sinon, si l'argent manque pour le
//          fermage → vendu en l'état (raison 'rent') ;
//     (détente) prêt du voisin : argent < fermage, aucune dette en cours et manque ≤ plafond → le voisin
//          prête ce qui manque (+ de quoi ressemer, sauf au dernier fermage) : neighbourLoan (src/core/neighbour.js) ;
//     fermage : argent < fermage  → faillite (status 'bankrupt', événement bankrupt), plus rien ne bouge ;
//               sinon on paie      → billPaid ; après le fermage d'hiver : (détente) le voisin reprend ce
//               qui lui est dû dans la limite de l'argent restant et efface le reste (loanRepayment,
//               loanForgiven, loanRepaid), puis victory (status 'victory').
//
// Aube (dans cet ordre) :
//   1. pousse des cultures d'après l'arrosage et la météo de la veille (ruches et « Main verte » :
//      bonus hors hiver ; non arrosée : level.dryGrowth, canicule : level.dryHeatwaveGrowth — selon le
//      mode de difficulté ; pomme de terre : ses propres dryGrowth / dryHeatwaveGrowth),
//      (v3) pousse des arbres (croissance, puis fruits ; dormance en hiver),
//      puis remise à zéro de l'arrosage de toutes les parcelles ;
//   2. passage au jour suivant ; si une saison commence → seasonStart ;
//      si c'est le 1er jour d'hiver → gel des cultures non résistantes (frost ; les arbres ne gèlent pas ;
//      « Assurance gel » : prix des graines gelées remboursé) ;
//   3. nouvelle météo : aujourd'hui = la prévision d'hier, nouvelle prévision pour demain ;
//   4. maladie (si aube pluvieuse et rotChance > 0) : chaque culture peut pourrir, et les pommes mûres (rot) ;
//   5. pluie / orage : toutes les parcelles plantées sont arrosées (pas les arbres) ;
//   6. nouveau cours du marché (niveau « marché fou ») ;
//   7. arrosage automatique : N parcelles plantées, non mûres, non arrosées, qui en ont besoin
//      aujourd'hui (ni arbres, ni pommes de terre hors canicule) ; coût d'arrosage éventuel ;
//   8. (v3) ateliers : chaque place avance d'une aube ; les produits prêts sont vendus (productSold) ;
//   9. revenus des investissements (valeurs de la saison du jour ; orage : pas de revenu de l'étal ;
//      tonte des moutons à l'aube du dernier jour de printemps, d'été et d'automne) ;
//      (v3) le lait des vaches puis des chèvres remplit les places libres de la fromagerie allumée
//      (ces unités ne rapportent rien aujourd'hui : processingStarted) ;
//  10. charges quotidiennes (ferme (level.dailyCharge) − « Ferme économe » + entretien − panneaux solaires,
//      minimum 0) ;
//  11. mensualité du prêt (aube du jour loan.first, puis tous les loan.every jours) ;
//      (détente) part du voisin sur les produits vendus ce matin (charge 'neighbour', loanRepayment) ;
//  12. événements : (contestProgress,) weather, dawn, moneyChanged, puis seasonWarning (2 jours avant un changement).
//
// L'argent peut devenir négatif uniquement par les charges de l'aube (charges, arrosage
// automatique, prêt). Les achats et plantations exigent d'avoir la somme.
//
// Modes de difficulté (src/data/difficulty.js) : state.difficulty ('detente' par défaut, 'classique' =
// nombres de la v3) ; le niveau de la partie est levelFor(levelId, difficulty) (query.level()).
// En mode classique, tout se joue exactement comme avant les modes (test de parité).
//
// v3 : les bonus permanents de la partie (state.perks, copiés au lancement) sont lus par perkValue()
// (src/core/perks.js). Avec perks = {}, les niveaux 1 à 8 se jouent exactement comme en v2 (test de
// parité) : aucune nouvelle règle, aucun tirage aléatoire supplémentaire.
//
// Mode Carrière (state.mode === 'career', créé par createCareer de src/core/career/career.js) : le niveau
// est careerLevel(state) (recalculé après chaque achat), et la journée, les actions de la parcelle, les
// achats et les requêtes propres à la carrière passent par src/core/career/runtime.js (déroulé en tête de
// ce fichier-là). Une partie de niveau ne passe par AUCUNE de ces branches.

import { DAY_SECONDS, DEFAULT_SPEED, EPSILON, SEASONS, SPEEDS, WARNING_DAYS, WEATHER_TYPES } from '../data/balance.js';
import { getInvestment } from '../data/investments.js';
import { getCrop, isTreeCrop } from '../data/crops.js';
import { getLevel, yearLength } from '../data/levels.js';
import { DEFAULT_DIFFICULTY, LEGACY_DIFFICULTY, getDifficulty, isDifficulty, levelFor } from '../data/difficulty.js';
import { getPerk, perkMaxRank } from '../data/perks.js';
import { getProduct, productsFor, recipeActive, recipeFor, PRODUCTS } from '../data/products.js';
import { createRngState, stream } from './rng.js';
import {
  advanceDay,
  calendarQuery,
  daysLeftInSeason,
  isLastDayOfSeason,
  isLastSeason,
  seasonId,
  tomorrowSeasonIndex,
} from './calendar.js';
import { drawWeather, isRainy, weatherWaters } from './weather.js';
import { initialMarket, marketMultiplier, updateMarket } from './market.js';
import {
  checkBuy,
  dailyCharges,
  dawnIncomes,
  growthBonus,
  levelInvestments,
  loanDueOn,
  loanPaymentsLeft,
  maxOf,
  nextCost,
  nextLoanDay,
  notEnoughMoney,
  owned,
  priceBonus,
  rentFor,
  sprinklerCapacity,
} from './economy.js';
import {
  applyFrost,
  applyRot,
  clearPlot,
  createPlots,
  growPlots,
  harvestValue,
  isMature,
  inGreenhouse,
  needsWaterToday,
  plotUnlockCost,
  plotWateredRate,
  rainWater,
  rawUnitPrice,
  sprinklerWater,
  stageOf,
  wateredRate,
  wouldFatigue,
  yieldFactor,
} from './farm.js';
import {
  fruitStage,
  isFruitReady,
  isTreeAdult,
  isTreePlot,
  pollinationFactor,
  setTree,
  treeForecast,
  treeGrowDays,
  treeSeedCost,
  treeStage,
} from './trees.js';
import {
  PROCESSING_IDS,
  advanceProcessing,
  capacity,
  capacityAt,
  ensureBuilding,
  fillMilk,
  isProcessingBuilding,
  processingTotals,
  productSaleValue,
  productValueNow,
  sellRaw,
  targetFor,
  tryProcessHarvest,
} from './processing.js';
import { awardContest, contestChanges, contestDueTonight, contestGoals, contestSnapshot, initialContest, prizeFor } from './contest.js';
import { gameCrops, hasPerks, normalizeRunPerks, perkValue } from './perks.js';
import { careerLevel } from './career/level.js';
import { BUILDINGS_BY_ID } from '../data/career/buildings.js';
import { createCareerRuntime } from './career/runtime.js';
import './career/extensions.js';
import { addHarvest, addLost, addProductSold, addStat, buildSummary, createStats, noteRentPaid, noteSeasonHarvest } from './stats.js';
import { createEmitter } from './events.js';
import { borrow, canBorrow, initialNeighbourLoan, loanAmount, maxMissing, repay, repaymentFrom, willLend } from './neighbour.js';

export const STATE_VERSION = 2;

/** Dernier niveau qui existait en v1 (sauvegardes à migrer). */
const V1_MAX_LEVEL = 8;

/**
 * Nouvelle partie.
 * @param {object} opts { levelId, seed, perks, difficulty } — perks : bonus permanents { [perkId]: rang }
 *   (progression.runPerks(progress) ; {} = aucun bonus, jeu d'origine) ; difficulty : 'detente' (défaut)
 *   ou 'classique' (nombres de la v3, test de parité) — voir src/data/difficulty.js
 */
export function createGame({ levelId = 1, seed = Date.now(), perks = {}, difficulty = DEFAULT_DIFFICULTY } = {}) {
  if (!isDifficulty(difficulty)) throw new Error(`Difficulté inconnue : ${difficulty}`);
  const level = levelFor(levelId, difficulty);
  if (!level) throw new Error(`Niveau inconnu : ${levelId}`);
  const runPerks = normalizeRunPerks(perks);
  const crops = gameCrops(level, runPerks);
  const startMoney = level.startMoney + perkValue({ perks: runPerks }, 'startMoney');
  const state = {
    version: STATE_VERSION,
    levelId: level.id,
    seed,
    status: 'playing',
    speed: DEFAULT_SPEED,
    time: { day: 1, seasonIndex: 0, dayOfSeason: 1, elapsed: 0 },
    money: startMoney,
    startMoney,
    weather: { today: null, tomorrow: null },
    plots: createPlots(level),
    plotsBought: 0,
    investments: Object.fromEntries(levelInvestments(level).map((i) => [i.id, 0])),
    market: {},
    rng: createRngState(seed),
    stats: { year: createStats(), season: createStats() },
    lastDawn: null,
    result: null,
    perks: runPerks,
    processing: {},
    contest: initialContest(level),
    difficulty: level.difficulty,
    neighbourLoan: initialNeighbourLoan(level),
  };
  for (const idx of level.startTrees || []) setTree(state, state.plots[idx], 'apple', true);
  state.weather.today = drawWeather(state, level, 0);
  state.weather.tomorrow = drawWeather(state, level, tomorrowSeasonIndex(state, level) ?? 0);
  state.market = initialMarket(state, level, crops);
  return wrap(state);
}

/**
 * Migre une sauvegarde v1 (niveaux 1 à 8, sans bonus) vers la v2 : bonus vides, fruits à 0, ateliers
 * vides, pas de concours, nouveaux compteurs à 0. Renvoie un NOUVEL objet ; une v2 est copiée telle quelle.
 * Toute sauvegarde sans mode de difficulté (v1, ou v2 d'avant les modes) passe en « classique »,
 * sans prêt du voisin : la partie continue avec les règles avec lesquelles elle a commencé.
 */
export function migrateState(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  if (s.version === 1) {
    s.perks = {};
    if (Array.isArray(s.plots)) {
      for (const p of s.plots) {
        if (!p || typeof p !== 'object') continue;
        if (p.fruit === undefined) p.fruit = 0;
        if (p.insured === undefined) p.insured = false;
      }
    }
    s.processing = {};
    s.contest = null;
    if (s.stats && typeof s.stats === 'object') {
      for (const k of ['year', 'season']) {
        const st = s.stats[k];
        if (st && typeof st === 'object') {
          for (const [key, v] of Object.entries(createStats())) if (st[key] === undefined) st[key] = v;
          if (k === 'year' && s.stats.season && Number.isFinite(s.stats.season.harvestIncome)) {
            st.bestSeasonHarvestIncome = Math.max(st.bestSeasonHarvestIncome || 0, s.stats.season.harvestIncome);
          }
        }
      }
      if (s.stats.season && Number.isFinite(s.stats.season.harvestIncome)) s.stats.season.bestSeasonHarvestIncome = s.stats.season.harvestIncome;
    }
    if (s.lastDawn && typeof s.lastDawn === 'object' && !s.lastDawn.milkToDairy) s.lastDawn.milkToDairy = [];
    s.version = 2;
  }
  // Modes de difficulté : une partie sauvegardée avant leur existence garde ses règles (classique).
  if (s.difficulty === undefined) s.difficulty = LEGACY_DIFFICULTY;
  if (s.neighbourLoan === undefined) s.neighbourLoan = null;
  return s;
}

/** Reprise d'une partie depuis un objet issu de game.serialize() (v2, ou v1 migrée). */
export function loadGame(saved) {
  if (!saved || typeof saved !== 'object') throw new Error('Sauvegarde invalide');
  if (saved.version !== STATE_VERSION && saved.version !== 1) throw new Error(`Version de sauvegarde incompatible : ${saved.version}`);
  if (!getLevel(saved.levelId)) throw new Error(`Niveau inconnu : ${saved.levelId}`);
  // Une sauvegarde v1 ne peut venir que des niveaux 1 à 8 (les niveaux 9 à 12 sont nés en v3).
  if (saved.version === 1 && getLevel(saved.levelId).id > V1_MAX_LEVEL) throw new Error('Sauvegarde invalide : niveau inconnu en v1');
  const state = migrateState(saved);
  if (!isDifficulty(state.difficulty)) throw new Error('Sauvegarde invalide : difficulté');
  const level = levelFor(saved.levelId, state.difficulty);
  state.levelId = level.id; // « 2 » (texte) → 2
  const problem = checkState(state, level);
  if (problem) throw new Error(`Sauvegarde invalide : ${problem}`);
  return wrap(state);
}

/**
 * Vérifie la structure d'un état chargé (sauvegarde abîmée, ancienne version des données…).
 * Renvoie un message décrivant le premier problème trouvé, ou null si l'état est utilisable.
 */
function checkState(s, level) {
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!['playing', 'bankrupt', 'victory'].includes(s.status)) return 'statut';
  if (!SPEEDS.includes(s.speed)) return 'vitesse';
  if (!num(s.money) || !num(s.startMoney)) return 'argent';
  const t = s.time;
  if (!t || typeof t !== 'object') return 'calendrier';
  if (!int(t.seasonIndex, 0, SEASONS.length - 1)) return 'saison';
  if (!int(t.dayOfSeason, 1, level.seasonLengths[t.seasonIndex])) return 'jour de la saison';
  if (!int(t.day, 1, yearLength(level))) return 'jour';
  if (!num(t.elapsed) || t.elapsed < 0 || t.elapsed > DAY_SECONDS) return 'heure';
  if (!s.weather || !WEATHER_TYPES[s.weather.today] || !WEATHER_TYPES[s.weather.tomorrow]) return 'météo';
  // Bonus de la partie (v3).
  if (!obj(s.perks)) return 'bonus';
  for (const [id, rank] of Object.entries(s.perks)) {
    const perk = getPerk(id);
    if (!perk || !int(rank, 1, perkMaxRank(perk))) return `bonus ${id}`;
  }
  if (!Array.isArray(s.plots) || s.plots.length !== level.gridCols * level.gridRows) return 'parcelles';
  for (const p of s.plots) {
    if (!p || typeof p !== 'object' || typeof p.unlocked !== 'boolean') return 'parcelle';
    if (p.cropId !== null && !getCrop(p.cropId)) return `culture inconnue (${p.cropId})`;
    if (p.cropId && !p.unlocked) return 'culture sur une parcelle fermée';
    if (!num(p.growth) || p.growth < 0) return 'pousse';
    if (p.lastHarvested != null && !getCrop(p.lastHarvested)) return 'culture précédente';
    if (!num(p.fruit) || p.fruit < 0) return 'fruits';
    if (p.fruit > 0 && !(p.cropId && isTreeCrop(getCrop(p.cropId)))) return 'fruits sans arbre';
    if (typeof p.insured !== 'boolean') return 'assurance';
  }
  if (!int(s.plotsBought, 0, s.plots.length)) return 'parcelles achetées';
  if (!s.investments || typeof s.investments !== 'object') return 'investissements';
  for (const [id, n] of Object.entries(s.investments)) {
    const inv = getInvestment(id);
    if (!inv || !int(n, 0, inv.costs.length)) return `investissement ${id}`;
  }
  if (!s.market || typeof s.market !== 'object' || Object.values(s.market).some((m) => !num(m))) return 'marché';
  if (!s.rng || !['weather', 'market', 'rot'].every((k) => Number.isInteger(s.rng[k]))) return 'aléatoire';
  const statsOk = (st) =>
    st && typeof st === 'object' && st.cropsHarvested && st.cropsLost && num(st.harvestIncome)
    && obj(st.productsSold) && ['productIncome', 'rawSales', 'frostRefund', 'contestPrize', 'bestSeasonHarvestIncome'].every((k) => num(st[k]))
    && (st.minMoneyAfterRent === null || num(st.minMoneyAfterRent));
  if (!s.stats || !statsOk(s.stats.year) || !statsOk(s.stats.season)) return 'statistiques';
  // Ateliers (v3) : une entrée par atelier possédé, places ≤ capacité, produits connus.
  if (!obj(s.processing)) return 'ateliers';
  for (const [id, b] of Object.entries(s.processing)) {
    if (!isProcessingBuilding(id) || !(s.investments[id] > 0)) return `atelier ${id}`;
    if (!obj(b) || typeof b.on !== 'boolean' || !Array.isArray(b.places)) return `atelier ${id}`;
    if (b.places.length > capacityAt(s, id, s.investments[id])) return `places de l'atelier ${id}`;
    for (const place of b.places) {
      if (place === null) continue;
      const product = obj(place) && getProduct(place.productId);
      if (!product || product.building !== id) return `produit de l'atelier ${id}`;
      if (!int(place.daysLeft, 1, 99) || !num(place.rawValue) || !num(place.yieldFactor)) return `place de l'atelier ${id}`;
      if (!['harvest', 'animal'].includes(place.source) || typeof place.input !== 'string') return `place de l'atelier ${id}`;
    }
  }
  for (const id of PROCESSING_IDS) if (s.investments[id] > 0 && !s.processing[id]) return `atelier ${id} absent`;
  // Concours (v3).
  if (level.contest) {
    if (!obj(s.contest) || typeof s.contest.awarded !== 'boolean') return 'concours';
    if (s.contest.result !== null && !(obj(s.contest.result) && Array.isArray(s.contest.result.goalsMet) && num(s.contest.result.amount))) return 'concours';
  } else if (s.contest !== null) return 'concours';
  // Prêt du voisin (mode détente).
  if (level.neighbourLoan) {
    const l = s.neighbourLoan;
    if (!obj(l) || !int(l.loans, 0, 99)) return 'prêt du voisin';
    if (!['debt', 'borrowed', 'repaid', 'forgiven'].every((k) => num(l[k]) && l[k] >= 0)) return 'prêt du voisin';
  } else if (s.neighbourLoan !== null) return 'prêt du voisin';
  return null;
}

/**
 * Enveloppe un état (nouvelle partie ou sauvegarde vérifiée) : update, actions, requêtes, événements.
 * Exportée pour src/core/career/career.js (createCareer / loadCareer) ; ne pas appeler ailleurs.
 */
export function wrapState(state) {
  return wrap(state);
}

function wrap(state) {
  const career = state.mode === 'career';
  // Carrière : le « niveau » change avec la ferme (rang, achats) — refreshLevel().
  let level = career ? careerLevel(state) : levelFor(state.levelId, state.difficulty);
  let crops = gameCrops(level, state.perks);
  let rt = null; // moteur de carrière (src/core/career/runtime.js), créé plus bas
  function refreshLevel() {
    if (!career) return;
    level = careerLevel(state);
    crops = gameCrops(level, state.perks);
  }
  // Complète les places d'un atelier (sauvegarde plus courte que la capacité : jamais en jeu normal).
  for (const id of Object.keys(state.processing || {})) ensureBuilding(state, id);
  const emitter = createEmitter();
  const queue = [];
  const push = (type, payload) => queue.push([type, payload]);
  const flush = () => {
    while (queue.length) {
      const [type, payload] = queue.shift();
      emitter.emit(type, payload);
    }
  };

  const playing = () => state.status === 'playing';
  const fail = (reason) => ({ ok: false, reason });
  const ENDED = 'La partie est terminée.';

  function changeMoney(delta) {
    if (delta === 0) return;
    state.money += delta;
    push('moneyChanged', { money: state.money, delta });
  }

  /** Rembourse le voisin (montant déjà borné par l'appelant) : argent, événements loanRepayment / loanRepaid. */
  function repayNeighbour(amount, source) {
    if (!(amount > 0)) return;
    const done = repay(state, amount);
    changeMoney(-amount);
    push('loanRepayment', { amount, remaining: state.neighbourLoan.debt, source });
    if (done) push('loanRepaid', { total: state.neighbourLoan.repaid, borrowed: state.neighbourLoan.borrowed, loans: state.neighbourLoan.loans, source });
  }

  /** Fin de l'année : remboursement avec ce qui reste (≥ 0), le reste est effacé (loanForgiven). */
  function settleNeighbourAtYearEnd() {
    const loan = state.neighbourLoan;
    const paid = Math.min(loan.debt, Math.max(0, state.money));
    const forgiven = loan.debt - paid;
    if (paid > 0) {
      loan.debt -= paid;
      loan.repaid += paid;
      changeMoney(-paid);
      push('loanRepayment', { amount: paid, remaining: forgiven, source: 'yearEnd' });
    }
    if (forgiven > 0) {
      loan.debt = 0;
      loan.forgiven += forgiven;
      push('loanForgiven', { amount: forgiven });
    }
    push('loanRepaid', { total: loan.repaid, borrowed: loan.borrowed, loans: loan.loans, forgiven, source: 'yearEnd' });
  }

  function validPlot(index) {
    return Number.isInteger(index) && index >= 0 && index < state.plots.length;
  }

  // Parcelle de serre (carrière) : pousse propre, ni météo ni gel. Ailleurs : règles des niveaux.
  const rateFor = (p) => (career ? plotWateredRate(state, p, state.time.seasonIndex) : wateredRate(state, state.time.seasonIndex));
  const weatherFor = (p) => (career && inGreenhouse(p) ? 'sunny' : state.weather.today);
  const frostFree = (p) => career && inGreenhouse(p);

  /** Prix d'une graine dans cette partie (« Graines sélectionnées », « Arboriste »). */
  function seedCostOf(crop) {
    if (isTreeCrop(crop)) return treeSeedCost(state, crop);
    const factor = perkValue(state, 'seedFactor');
    return factor === 1 ? crop.seedCost : Math.max(1, Math.round(crop.seedCost * factor));
  }

  const rateOf = (si) => 1 + growthBonus(state, si);

  /** Remboursement de l'Assurance gel, avant le gel : cultures non résistantes semées assurées. */
  function frostRefundAmount() {
    let sum = 0;
    for (const p of state.plots) {
      const crop = p.cropId ? getCrop(p.cropId) : null;
      if (crop && !crop.frostHardy && p.insured) sum += seedCostOf(crop);
    }
    return sum;
  }

  function pushContestChanges(before) {
    for (const c of contestChanges(state, level, before)) push('contestProgress', c);
  }

  /** Argent d'une vente en l'état (statistique rawSales ; carrière : aussi le bilan de l'année, poste « other »). */
  function rawSaleMoney(amount) {
    addStat(state, 'rawSales', amount);
    if (rt) rt.api.account('income', 'other', amount);
    changeMoney(amount);
  }

  /** Vend en l'état tout ce qui est en cours dans les ateliers (filets de sécurité). */
  function sellAllRaw(reason) {
    for (const id of PROCESSING_IDS) {
      const { amount, count } = sellRaw(state, id);
      if (count === 0) continue;
      rawSaleMoney(amount);
      push('processingSoldRaw', { buildingId: id, amount, count, reason });
    }
  }

  // ── Fin de journée : concours, filets de sécurité, fermage ──────────────────────────
  function endOfDay() {
    if (rt) return rt.endOfDay();
    if (contestDueTonight(state, level)) {
      const award = awardContest(state, level);
      if (award.amount > 0) {
        addStat(state, 'contestPrize', award.amount);
        changeMoney(award.amount);
      }
      push('contestAwarded', award);
    }
    if (!isLastDayOfSeason(state, level)) return;
    const sid = seasonId(state);
    const rent = rentFor(level, state.time.seasonIndex, state);
    if (isLastSeason(state)) sellAllRaw('yearEnd');
    else if (state.money < rent) sellAllRaw('rent');
    // Mode détente : le voisin avance ce qui manque (s'il n'attend pas déjà un remboursement).
    if (willLend(state, level, rent)) {
      const missing = rent - state.money;
      const { amount, debt } = borrow(state, level, loanAmount(level, rent, state.money, isLastSeason(state)));
      changeMoney(amount);
      push('neighbourLoan', { amount, debt, missing, rent, seasonId: sid, surcharge: debt - amount, repayShare: level.neighbourLoan.repayShare });
    }
    if (state.money < rent) {
      const owed = state.neighbourLoan ? state.neighbourLoan.debt : 0;
      state.status = 'bankrupt';
      state.time.elapsed = DAY_SECONDS; // la partie s'arrête le soir du dernier jour
      state.result = { outcome: 'bankrupt', amountDue: rent, money: state.money, seasonId: sid, day: state.time.day };
      const extra = state.neighbourLoan ? { neighbourDebt: owed } : {};
      if (state.neighbourLoan) state.result.neighbourDebt = owed;
      push('bankrupt', { amountDue: rent, money: state.money, seasonId: sid, ...extra, summary: buildSummary(state, sid, { amountDue: rent }) });
      return;
    }
    addStat(state, 'rentsPaid', rent);
    changeMoney(-rent);
    noteRentPaid(state);
    push('billPaid', { amount: rent, seasonId: sid, summary: buildSummary(state, sid, { amount: rent }) });
    if (isLastSeason(state)) {
      // Fin de l'année : le voisin reprend ce qui lui est encore dû, dans la limite de l'argent qui
      // reste ; il efface le reste (l'argent final n'est jamais négatif à cause de lui).
      if (state.neighbourLoan && state.neighbourLoan.debt > 0) settleNeighbourAtYearEnd();
      const [t2, t3] = level.starThresholds;
      const stars = 1 + (state.money >= t2 ? 1 : 0) + (state.money >= t3 ? 1 : 0);
      state.status = 'victory';
      state.time.elapsed = DAY_SECONDS;
      state.result = { outcome: 'victory', stars, money: state.money, day: state.time.day };
      push('victory', { money: state.money, stars, summary: buildSummary(state, sid, { stars }) });
    }
  }

  // ── Aube ─────────────────────────────────────────────────────────────────────────────
  function dawn() {
    if (rt) return rt.dawn();
    const moneyBefore = state.money;
    const prevSeason = state.time.seasonIndex;
    const prevWeather = state.weather.today;
    const extraIncomes = []; // remboursement du gel, produits vendus (avant les revenus quotidiens)

    // 1. Pousse (veille), arbres compris, puis remise à zéro de l'arrosage.
    growPlots(state, prevSeason, prevWeather, level);

    // 2. Nouveau jour, nouvelle saison, gel.
    const newSeason = advanceDay(state, level);
    const sid = seasonId(state);
    if (newSeason) {
      state.stats.season = createStats();
      push('seasonStart', { seasonId: sid, seasonIndex: state.time.seasonIndex });
      if (sid === 'winter') {
        // « Assurance gel » : graines remboursées pour les cultures gelées qui avaient été semées à temps.
        const refund = perkValue(state, 'frostRefund') ? frostRefundAmount() : 0;
        const lost = applyFrost(state);
        addLost(state, 'frost', lost.length);
        if (refund > 0) {
          addStat(state, 'frostRefund', refund);
          extraIncomes.push({ source: 'frostInsurance', amount: refund, owned: 1, kind: 'refund' });
        }
        push('frost', { lostPlots: lost.map((l) => l.plotIndex), lost, refund });
      }
    }

    // 3. Météo.
    state.weather.today = state.weather.tomorrow;
    state.weather.tomorrow = drawWeather(state, level, tomorrowSeasonIndex(state, level) ?? state.time.seasonIndex);
    const today = state.weather.today;

    // 4. Maladie.
    if (isRainy(today) && level.modifiers.rotChance > 0) {
      const rotten = applyRot(state, level.modifiers.rotChance, stream(state.rng, 'rot'));
      addLost(state, 'rot', rotten.length);
      for (const r of rotten) push('rot', r);
    }

    // 5. Pluie.
    if (weatherWaters(today)) rainWater(state);

    // 6. Marché.
    updateMarket(state, level, crops);

    // 7. Arrosage automatique.
    const sprinkled = sprinklerWater(state, sprinklerCapacity(state, level), today, level);
    const waterCost = sprinkled.length * level.modifiers.waterCost;

    // 8. Ateliers : les produits prêts sont vendus.
    const contestBefore = contestSnapshot(state, level);
    let productSales = 0;
    for (const sale of advanceProcessing(state)) {
      productSales += sale.amount;
      addProductSold(state, sale.productId, sale.amount);
      extraIncomes.push({ source: sale.buildingId, amount: sale.amount, owned: owned(state, sale.buildingId), kind: 'processed', productId: sale.productId });
      push('productSold', sale);
    }

    // 9. Revenus ; le lait part à la fromagerie.
    const incomes = dawnIncomes(state, level, state.time.seasonIndex, today, isLastDayOfSeason(state, level));
    const milk = fillMilk(state, level, incomes, sid);
    for (const st of milk.started) push('processingStarted', st);
    const investmentTotal = incomes.reduce((s, i) => s + i.amount, 0);
    const allIncomes = [...extraIncomes, ...incomes];
    const incomeTotal = allIncomes.reduce((s, i) => s + i.amount, 0);

    // 10-11. Charges et prêt.
    const fixed = dailyCharges(state, level);
    const loanPayment = loanDueOn(level, state.time.day) ? level.modifiers.loan.payment : 0;
    // Prêt du voisin : sa part des produits vendus ce matin.
    const neighbourPayment = repaymentFrom(state, level, productSales);
    const chargesDetail = [{ source: 'farm', amount: fixed }];
    if (waterCost > 0) chargesDetail.push({ source: 'water', amount: waterCost });
    if (loanPayment > 0) chargesDetail.push({ source: 'loan', amount: loanPayment });
    if (neighbourPayment > 0) chargesDetail.push({ source: 'neighbour', amount: neighbourPayment });
    const charges = fixed + waterCost + loanPayment + neighbourPayment;

    addStat(state, 'investmentIncome', investmentTotal);
    addStat(state, 'charges', fixed);
    addStat(state, 'waterSpent', waterCost);
    addStat(state, 'loanPaid', loanPayment);
    state.money += incomeTotal - charges;
    let neighbourDone = false;
    if (neighbourPayment > 0) neighbourDone = repay(state, neighbourPayment);

    // 12. Événements.
    pushContestChanges(contestBefore);
    const dawnInfo = {
      day: state.time.day,
      seasonId: sid,
      weather: today,
      incomes: allIncomes,
      charges,
      chargesDetail,
      sprinkled,
      net: incomeTotal - charges,
      milkToDairy: milk.milkToDairy,
    };
    state.lastDawn = JSON.parse(JSON.stringify(dawnInfo));
    push('weather', { today, tomorrow: state.weather.tomorrow });
    push('dawn', dawnInfo);
    if (neighbourPayment > 0) {
      push('loanRepayment', { amount: neighbourPayment, remaining: state.neighbourLoan.debt, source: 'product' });
      if (neighbourDone) push('loanRepaid', { total: state.neighbourLoan.repaid, borrowed: state.neighbourLoan.borrowed, loans: state.neighbourLoan.loans, source: 'product' });
    }
    if (state.money !== moneyBefore) push('moneyChanged', { money: state.money, delta: state.money - moneyBefore });

    if (!isLastSeason(state) && daysLeftInSeason(state, level) + 1 === WARNING_DAYS) {
      const next = SEASONS[state.time.seasonIndex + 1];
      push('seasonWarning', { nextSeasonId: next, daysLeft: WARNING_DAYS, frost: next === 'winter' });
    }
  }

  // ── Temps ────────────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (rt) return rt.update(dt);
    if (!playing() || !(dt > 0) || !Number.isFinite(dt) || state.speed === 0) return;
    state.time.elapsed += dt * state.speed;
    while (playing() && state.time.elapsed >= DAY_SECONDS) {
      state.time.elapsed -= DAY_SECONDS;
      endOfDay();
      if (playing()) dawn();
      flush();
    }
    flush();
  }

  // ── Actions ──────────────────────────────────────────────────────────────────────────
  function act(fn) {
    return (...args) => {
      const res = fn(...args);
      flush();
      return res;
    };
  }

  function ownedBuilding(buildingId) {
    if (!isProcessingBuilding(buildingId)) return fail('Atelier inconnu.');
    if (!state.processing[buildingId] || owned(state, buildingId) <= 0) return fail(`Vous n'avez pas encore « ${getInvestment(buildingId).name} ».`);
    return null;
  }

  const actions = {
    plant: act((plotIndex, cropId) => {
      if (rt) return rt.plant(plotIndex, cropId, { by: 'player' });
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
      if (p.cropId) return fail('Cette parcelle est déjà plantée.');
      const crop = getCrop(cropId);
      if (!crop || !crops.includes(crop)) return fail('Culture inconnue.');
      const sid = seasonId(state);
      if (!crop.seasons.includes(sid)) return fail(`${crop.name} : ne se plante pas ${seasonLabel(sid)}.`);
      const cost = seedCostOf(crop);
      if (state.money < cost) return fail(notEnoughMoney(cost - state.money));
      if (isTreeCrop(crop)) {
        setTree(state, p, crop.id);
      } else {
        // « Assurance gel » : assurée si elle a le temps de mûrir avant le gel (pas de semis malgré l'avertissement).
        const insured = !!perkValue(state, 'frostRefund') && !freezes(crop, Math.ceil(crop.growDays / wateredRate(state, state.time.seasonIndex) - EPSILON));
        p.cropId = crop.id;
        p.growth = 0;
        p.fatigued = wouldFatigue(level, p, crop.id);
        p.watered = weatherWaters(state.weather.today); // il pleut : la graine est arrosée d'office
        p.insured = insured;
      }
      addStat(state, 'seedsSpent', cost);
      addStat(state, 'cropsPlanted', 1);
      changeMoney(-cost);
      push('planted', { plotIndex, cropId: crop.id, amount: cost, fatigue: p.fatigued, watered: p.watered });
      return { ok: true, cost, fatigue: p.fatigued };
    }),

    water: act((plotIndex) => {
      if (rt) return rt.water(plotIndex, { by: 'player' });
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
      if (!p.cropId) return fail('Rien à arroser ici.');
      const crop = getCrop(p.cropId);
      if (isTreeCrop(crop)) return fail('Le pommier n\'a pas besoin d\'eau.');
      if (isMature(p)) return fail('Cette culture est mûre : récoltez-la !');
      if (!needsWaterToday(crop, state.weather.today, level)) return fail('Pas besoin : elle pousse sans arrosage.');
      if (p.watered) return fail('Déjà arrosée aujourd\'hui.');
      const cost = level.modifiers.waterCost;
      if (cost > 0 && state.money < cost) return fail(notEnoughMoney(cost - state.money));
      p.watered = true;
      addStat(state, 'waterSpent', cost);
      changeMoney(-cost);
      push('watered', { plotIndex, cropId: p.cropId, amount: cost });
      return { ok: true, cost };
    }),

    harvest: act((plotIndex) => {
      if (rt) return rt.harvest(plotIndex, { by: 'player' });
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.cropId) return fail('Rien à récolter ici.');
      const tree = isTreePlot(p);
      if (!isMature(p)) {
        if (tree) return fail(treeNotReadyReason(p));
        const left = plotDaysLeft(p);
        return fail(`Pas encore mûre (encore ${left} jour${left > 1 ? 's' : ''}).`);
      }
      const cropId = p.cropId;
      const raw = harvestValue(state, level, p);
      const yf = yieldFactor(state, level, p);
      const fatigue = p.fatigued;
      const contestBefore = contestSnapshot(state, level);
      const processed = tryProcessHarvest(state, cropId, raw, yf);
      const amount = processed ? 0 : raw;
      if (tree) {
        p.fruit = 0;
      } else {
        p.lastHarvested = cropId;
        clearPlot(p);
      }
      addStat(state, 'harvestIncome', amount);
      addHarvest(state, cropId);
      noteSeasonHarvest(state);
      changeMoney(amount);
      // Prêt du voisin : sa part de la vente (champ loanRepayment seulement quand il y en a une).
      const neighbourPart = repaymentFrom(state, level, amount);
      push('harvested', { plotIndex, cropId, amount, fatigue, tree, processed, ...(neighbourPart > 0 ? { loanRepayment: neighbourPart } : {}) });
      if (processed) push('processingStarted', { ...processed, input: cropId, source: 'harvest', plotIndex });
      repayNeighbour(neighbourPart, 'harvest');
      pushContestChanges(contestBefore);
      return neighbourPart > 0 ? { ok: true, amount, cropId, tree, processed, loanRepayment: neighbourPart } : { ok: true, amount, cropId, tree, processed };
    }),

    removeTree: act((plotIndex) => {
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!isTreePlot(p)) return fail('Il n\'y a pas d\'arbre ici.');
      clearPlot(p);
      p.lastHarvested = null;
      push('treeRemoved', { plotIndex });
      return { ok: true };
    }),

    unlockPlot: act((plotIndex) => {
      if (rt) return rt.unlockPlot(plotIndex);
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (p.unlocked) return fail('Cette parcelle est déjà ouverte.');
      const cost = plotUnlockCost(state, level);
      if (cost === null) return fail('Le champ ne peut plus s\'agrandir.');
      if (state.money < cost) return fail(notEnoughMoney(cost - state.money));
      p.unlocked = true;
      state.plotsBought += 1;
      addStat(state, 'plotsSpent', cost);
      changeMoney(-cost);
      push('plotUnlocked', { plotIndex, cost });
      return { ok: true, cost };
    }),

    buyInvestment: act((investmentId) => {
      if (rt) return rt.buyInvestment(investmentId);
      if (!playing()) return fail(ENDED);
      const check = checkBuy(state, level, investmentId);
      if (!check.ok) return check;
      state.investments[investmentId] = owned(state, investmentId) + 1;
      if (isProcessingBuilding(investmentId)) ensureBuilding(state, investmentId);
      addStat(state, 'investmentsSpent', check.cost);
      changeMoney(-check.cost);
      const n = state.investments[investmentId];
      push('purchased', { investmentId, owned: n, cost: check.cost });
      return { ok: true, owned: n, cost: check.cost };
    }),

    setProcessing: act((buildingId, on) => {
      if (!playing()) return fail(ENDED);
      const bad = ownedBuilding(buildingId);
      if (bad) return bad;
      const b = state.processing[buildingId];
      b.on = !!on;
      push('processingToggled', { buildingId, on: b.on });
      return { ok: true, on: b.on };
    }),

    sellProcessing: act((buildingId) => {
      if (!playing()) return fail(ENDED);
      const bad = ownedBuilding(buildingId);
      if (bad) return bad;
      const { amount, count } = sellRaw(state, buildingId);
      if (count === 0) return fail('Rien à vendre : l\'atelier est vide.');
      rawSaleMoney(amount);
      push('processingSoldRaw', { buildingId, amount, count, reason: 'player' });
      return { ok: true, amount, count };
    }),

    /** Mode détente : rembourse le voisin maintenant (tout ce qu'on peut, ou `amount` pièces au plus). */
    repayNeighbour: act((amount) => {
      if (!playing()) return fail(ENDED);
      const loan = state.neighbourLoan;
      if (!loan) return fail('Pas de prêt du voisin dans ce mode.');
      if (loan.debt <= 0) return fail('Vous ne devez rien au voisin.');
      const wanted = amount === undefined ? loan.debt : Math.floor(Number(amount));
      if (!(wanted > 0)) return fail('Montant invalide.');
      const paid = Math.min(wanted, loan.debt, Math.max(0, Math.floor(state.money)));
      if (paid <= 0) return fail(notEnoughMoney(1));
      repayNeighbour(paid, 'player');
      return { ok: true, amount: paid, remaining: loan.debt };
    }),

    setSpeed: act((speed) => {
      if (!SPEEDS.includes(speed)) return fail('Vitesse invalide.');
      state.speed = speed;
      return { ok: true, speed };
    }),
  };

  // ── Requêtes ─────────────────────────────────────────────────────────────────────────
  function plotDaysLeft(p) {
    const crop = getCrop(p.cropId);
    if (!crop || isMature(p)) return 0;
    if (isTreeCrop(crop)) return forecastOf(p).fruitDaysLeft;
    return Math.max(1, Math.ceil((crop.growDays - p.growth) / rateFor(p) - EPSILON));
  }

  function forecastOf(p) {
    return treeForecast(state, level, getCrop(p.cropId), p, rateOf);
  }

  function treeNotReadyReason(p) {
    const f = forecastOf(p);
    if (f.fruitDaysLeft === null) return 'Pas de pommes avant la fin de l\'année.';
    return `Pas encore de pommes (encore ${f.fruitDaysLeft} jour${f.fruitDaysLeft > 1 ? 's' : ''}).`;
  }

  function treeInfo(p) {
    const crop = getCrop(p.cropId);
    const f = forecastOf(p);
    const stage = treeStage(state, p);
    const season = seasonId(state);
    return {
      stage,
      growth: p.growth,
      growDays: treeGrowDays(state, crop),
      adultInDays: f.adultInDays,
      fruit: p.fruit,
      fruitDays: crop.fruitDays,
      fruitReady: isFruitReady(p),
      fruitDaysLeft: f.fruitDaysLeft,
      fruitStage: stage === 'adult' ? fruitStage(p) : 0,
      dormant: season === 'winter',
      blossom: season === 'spring' && stage === 'adult',
      harvestsLeftEstimate: f.harvests,
    };
  }

  /** Atelier qui recevrait cette récolte, pour les fiches : null si aucun atelier possédé ne la transforme. */
  function processTargetOf(cropId, yf) {
    const t = targetFor(state, cropId);
    if (!t || t.product.source !== 'harvest') return null;
    const b = state.processing[t.buildingId];
    return {
      buildingId: t.buildingId,
      productId: t.product.id,
      productName: t.product.name,
      value: productValueNow(state, t.product.id, yf),
      hasRoom: !!b && b.on && b.places.includes(null),
      on: !!b && b.on,
    };
  }

  /** Recette que ce niveau propose pour une culture (atelier possédé : recette de son niveau ; sinon niveau 1). */
  function levelRecipeFor(cropId) {
    for (const inv of levelInvestments(level)) {
      if (!inv.effects.processing) continue;
      const lvl = owned(state, inv.id);
      const product = recipeFor(inv.id, Math.max(1, lvl), cropId);
      if (product && product.source === 'harvest') return { buildingId: inv.id, product, owned: lvl > 0 };
    }
    return null;
  }

  /** Nombre d'aubes restant avant le gel (Infinity si l'hiver est déjà là). */
  function dawnsBeforeFrost() {
    const si = state.time.seasonIndex;
    if (SEASONS[si] === 'winter') return Infinity;
    let n = daysLeftInSeason(state, level);
    for (let s = si + 1; s < SEASONS.length && SEASONS[s] !== 'winter'; s++) n += level.seasonLengths[s];
    return n;
  }

  function freezes(crop, daysNeeded) {
    return !crop.frostHardy && daysNeeded > dawnsBeforeFrost();
  }

  function rentAutoSellTonight(totals) {
    if (!playing() || totals.count === 0 || !isLastDayOfSeason(state, level)) return false;
    if (isLastSeason(state)) return true;
    return state.money < rentFor(level, state.time.seasonIndex, state);
  }

  const query = {
    plot(plotIndex) {
      if (!validPlot(plotIndex)) return null;
      const p = state.plots[plotIndex];
      const crop = p.cropId ? getCrop(p.cropId) : null;
      const isTree = !!crop && isTreeCrop(crop);
      const mature = !!crop && isMature(p);
      const daysLeft = crop ? plotDaysLeft(p) : 0;
      const unlockCost = p.unlocked || (career && p.lot !== 'start') ? null : plotUnlockCost(state, level);
      const needsWater = !!crop && !mature && needsWaterToday(crop, weatherFor(p), level);
      let action = null;
      if (playing() && !(career && p.env === null)) {
        if (!p.unlocked) action = unlockCost === null ? null : 'unlock';
        else if (!crop) action = 'plant';
        else if (mature) action = 'harvest';
        else if (!p.watered && needsWater) action = 'water';
      }
      const tree = isTree ? treeInfo(p) : null;
      let stage = 0;
      let progress = 0;
      if (isTree) {
        stage = tree.fruitReady ? 4 : { sapling: 1, young: 2, adult: 3 }[tree.stage];
        progress = tree.stage === 'adult' ? Math.min(1, p.fruit / tree.fruitDays) : Math.min(1, p.growth / tree.growDays);
      } else if (crop) {
        stage = stageOf(p.growth, crop.growDays);
        progress = Math.min(1, p.growth / crop.growDays);
      }
      const out = {
        index: plotIndex,
        col: plotIndex % level.gridCols,
        row: Math.floor(plotIndex / level.gridCols),
        unlocked: p.unlocked,
        unlockCost,
        cropId: p.cropId,
        cropName: crop ? crop.name : null,
        stage,
        progress,
        daysLeft,
        watered: p.watered,
        mature,
        fatigue: p.fatigued,
        willFreeze: !!crop && !isTree && !mature && !frostFree(p) && freezes(crop, daysLeft),
        harvestValue: mature ? harvestValue(state, level, p) : null,
        action,
        kind: crop ? (isTree ? 'tree' : 'crop') : null,
        tree,
        needsWater,
        processTarget: crop ? processTargetOf(crop.id, yieldFactor(state, level, p)) : null,
      };
      return rt ? Object.assign(out, rt.plotExtras(plotIndex)) : out;
    },

    plots() {
      return state.plots.map((_, i) => query.plot(i));
    },

    /** Cultures plantables aujourd'hui ; avec plotIndex, tient compte de la fatigue du sol de cette parcelle. */
    plantableCrops(plotIndex) {
      const sid = seasonId(state);
      const plot = validPlot(plotIndex) ? state.plots[plotIndex] : null;
      const rate = plot ? rateFor(plot) : wateredRate(state, state.time.seasonIndex);
      // Carrière : le verger n'accueille que des arbres, les champs et la serre que des cultures ; la serre
      // accepte toutes les cultures en toute saison.
      const allowed = (c) => {
        if (!career) return c.seasons.includes(sid);
        const tree = isTreeCrop(c);
        if (plot && plot.env === 'orchard') return tree && c.seasons.includes(sid);
        if (plot && inGreenhouse(plot)) return !tree;
        return c.seasons.includes(sid) && (!plot || !tree);
      };
      return crops
        .filter(allowed)
        .map((c) => {
          const tree = isTreeCrop(c);
          const seedCost = seedCostOf(c);
          const fatigue = plot && !tree ? wouldFatigue(level, plot, c.id) : false;
          const factor = fatigue ? 1 - level.modifiers.soilFatigue : 1;
          const yf = factor * (tree ? pollinationFactor(state, level, c.id) : 1);
          const sellPrice = Math.round(rawUnitPrice(state, level, c) * factor * (tree ? pollinationFactor(state, level, c.id) : 1));
          let daysToMature;
          let treeData = null;
          if (tree) {
            const f = treeForecast(state, level, c, { growth: 0, fruit: 0 }, rateOf);
            daysToMature = f.fruitDaysLeft;
            treeData = { fruitDays: c.fruitDays, fruitSeasons: [...c.fruitSeasons], basketPrice: sellPrice, harvestsBeforeYearEnd: f.harvests, adultInDays: f.adultInDays };
          } else {
            daysToMature = Math.ceil(c.growDays / rate - EPSILON);
          }
          const recipe = levelRecipeFor(c.id);
          return {
            id: c.id,
            name: c.name,
            seedCost,
            basePrice: c.sellPrice,
            marketMultiplier: marketMultiplier(state, c.id),
            sellPrice,
            profit: tree ? sellPrice * treeData.harvestsBeforeYearEnd - seedCost : sellPrice - seedCost,
            growDays: tree ? treeGrowDays(state, c) : c.growDays,
            daysToMature,
            frostHardy: c.frostHardy,
            fatigue,
            willFreeze: !tree && !(plot && frostFree(plot)) && freezes(c, daysToMature),
            canAfford: state.money >= seedCost,
            kind: tree ? 'tree' : 'crop',
            product: recipe
              ? {
                  buildingId: recipe.buildingId,
                  productId: recipe.product.id,
                  name: recipe.product.name,
                  value: productValueNow(state, recipe.product.id, yf),
                  days: recipe.product.days,
                  owned: recipe.owned,
                }
              : null,
            tree: treeData,
            noWater: !tree && !needsWaterToday(c, 'sunny', level),
            sowAll: !tree,
          };
        });
    },

    investments() {
      if (rt) return rt.investmentsList();
      const sid = seasonId(state);
      return levelInvestments(level).map((inv) => {
        const check = playing() ? checkBuy(state, level, inv.id) : fail(ENDED);
        const n = owned(state, inv.id);
        let processing = null;
        if (inv.effects.processing) {
          const b = state.processing[inv.id];
          const shown = Math.max(1, n);
          processing = {
            level: n,
            places: capacity(state, inv.id),
            nextPlaces: n < maxOf(inv) ? capacityAt(state, inv.id, n + 1) : null,
            on: !!b && b.on,
            used: b ? b.places.filter(Boolean).length : 0,
            recipes: productsFor(inv.id).map((pr) => ({
              input: pr.input,
              inputName: getCrop(pr.input)?.name ?? getInvestment(pr.input)?.name ?? pr.input,
              productId: pr.id,
              productName: pr.name,
              days: pr.days,
              value: productValueNow(state, pr.id, 1),
              active: recipeActive(pr, shown),
              minLevel: pr.minLevel ?? 1,
            })),
          };
        }
        return {
          id: inv.id,
          name: inv.name,
          description: inv.description,
          kind: inv.kind,
          owned: n,
          max: maxOf(inv),
          nextCost: nextCost(state, inv),
          canBuy: check.ok,
          reason: check.ok ? null : check.reason,
          income: inv.income[sid] || 0,
          incomeBySeason: { ...inv.income },
          upkeep: inv.upkeep,
          effects: jsonEffects(inv.effects),
          category: inv.category,
          requiresAny: inv.requiresAny ? [...inv.requiresAny] : null,
          processing,
        };
      });
    },

    processing() {
      return PROCESSING_IDS.filter((id) => state.processing[id]).map((id) => {
        const b = state.processing[id];
        let value = 0;
        let rawValue = 0;
        const places = b.places.map((place) => {
          if (!place) return null;
          const product = getProduct(place.productId);
          const v = productSaleValue(state, place);
          value += v;
          rawValue += place.rawValue;
          return { productId: place.productId, productName: product.name, input: place.input, daysLeft: place.daysLeft, days: product.days, value: v, rawValue: place.rawValue };
        });
        // Carrière : nom du bâtiment de carrière (src/data/career/buildings.js), niveaux 1 à 5, places + artisan.
        const name = rt ? (BUILDINGS_BY_ID[id]?.name ?? getInvestment(id).name) : getInvestment(id).name;
        return { buildingId: id, name, level: owned(state, id), on: b.on, capacity: capacity(state, id), places, value, rawValue };
      });
    },

    contest() {
      if (!level.contest || !state.contest) return null;
      const goals = contestGoals(state, level);
      const c = level.contest;
      return {
        deadlineDay: c.deadlineDay,
        daysLeft: Math.max(0, c.deadlineDay - state.time.day),
        awarded: state.contest.awarded,
        result: state.contest.result ? JSON.parse(JSON.stringify(state.contest.result)) : null,
        prizePerGoal: c.prizePerGoal,
        bonusAll: c.bonusAll,
        goals,
        potentialPrize: prizeFor(level, goals.filter((g) => g.done).map((g) => g.id)),
      };
    },

    perks() {
      return Object.entries(state.perks).map(([id, rank]) => {
        const perk = getPerk(id);
        return { id, name: perk.name, rank, description: perk.description };
      });
    },

    forecast() {
      return { today: state.weather.today, tomorrow: state.weather.tomorrow, afterTomorrow: afterTomorrow() };
    },

    finance() {
      const si = state.time.seasonIndex;
      const incomes = rt ? rt.incomesEstimate() : dawnIncomes(state, level, si, null, false);
      const dailyIncome = incomes.reduce((s, i) => s + i.amount, 0);
      const charges = rt ? rt.chargesInfo().dailyTotal : dailyCharges(state, level);
      const total = yearLength(level);
      const loan = level.modifiers.loan;
      const nextLoan = nextLoanDay(level, state.time.day, total);
      const totals = processingTotals(state);
      return {
        money: state.money,
        dailyIncome,
        dailyCharges: charges,
        net: dailyIncome - charges,
        nextBill: { amount: rentFor(level, si, state), daysLeft: daysLeftInSeason(state, level), seasonId: SEASONS[si] },
        loan: loan && !career
          ? {
              payment: loan.payment,
              every: loan.every,
              nextInDays: nextLoan === null ? null : nextLoan - state.time.day,
              paymentsLeft: loanPaymentsLeft(level, state.time.day, total),
              remaining: loanPaymentsLeft(level, state.time.day, total) * loan.payment,
            }
          : null,
        priceBonus: priceBonus(state),
        waterCost: level.modifiers.waterCost,
        processingValue: totals.value,
        processingRawValue: totals.rawValue,
        rentAutoSell: rentAutoSellTonight(totals),
        neighbourLoan: neighbourInfo(),
      };
    },

    /** Mode de difficulté de la partie : { id, name, description }. */
    difficulty() {
      const d = getDifficulty(state.difficulty);
      return { id: d.id, name: d.name, description: d.description };
    },

    calendar() {
      return calendarQuery(state, level);
    },

    level() {
      return level;
    },

    summary() {
      return buildSummary(state, seasonId(state));
    },

    /** Contexte des succès (src/core/progression.js : checkAchievements). */
    achievementContext() {
      if (rt) {
        return {
          levelId: 'career',
          status: state.status,
          day: state.time.day,
          seasonId: seasonId(state),
          money: state.money,
          stars: 0,
          perksActive: false,
          stats: { year: JSON.parse(JSON.stringify(state.stats.year)), season: JSON.parse(JSON.stringify(state.stats.season)) },
          investments: { ...state.investments },
          availableInvestments: [],
          adultTrees: state.plots.filter((p) => isTreePlot(p) && isTreeAdult(state, p)).length,
          dailyCharges: rt.chargesInfo().dailyTotal,
          career: rt.achievementContext(),
        };
      }
      return {
        levelId: level.id,
        status: state.status,
        day: state.time.day,
        seasonId: seasonId(state),
        money: state.money,
        stars: state.result?.stars ?? 0,
        perksActive: hasPerks(state),
        stats: { year: JSON.parse(JSON.stringify(state.stats.year)), season: JSON.parse(JSON.stringify(state.stats.season)) },
        investments: { ...state.investments },
        availableInvestments: levelInvestments(level).map((i) => i.id),
        adultTrees: state.plots.filter((p) => isTreePlot(p) && isTreeAdult(state, p)).length,
        dailyCharges: dailyCharges(state, level),
      };
    },
  };

  /**
   * Prêt du voisin pour l'interface (null en mode classique) :
   * { debt, borrowed, repaid, loans, available, wouldLend, surcharge, repayShare, cushion }.
   * wouldLend : ce que Joseph prêterait si le fermage de la saison tombait avec l'argent actuel
   * (0 : l'argent suffit ; null : il ne peut pas, une dette est en cours → ce serait la faillite).
   */
  function neighbourInfo() {
    const loan = state.neighbourLoan;
    if (!loan || !level.neighbourLoan) return null;
    const rent = rentFor(level, state.time.seasonIndex, state);
    const available = canBorrow(state, level);
    let wouldLend = 0;
    if (state.money < rent) wouldLend = willLend(state, level, rent) ? loanAmount(level, rent, state.money, isLastSeason(state) && !career) : null;
    return {
      debt: loan.debt,
      borrowed: loan.borrowed,
      repaid: loan.repaid,
      loans: loan.loans,
      available,
      wouldLend,
      maxMissing: maxMissing(level, rent),
      surcharge: level.neighbourLoan.surcharge,
      repayShare: level.neighbourLoan.repayShare,
      cushion: level.neighbourLoan.cushion,
      maxShare: level.neighbourLoan.maxShare,
      minCover: level.neighbourLoan.minCover,
    };
  }

  /** Météo d'après-demain (« Almanach ») : lue sur une COPIE du flux météo, sans rien consommer. */
  function afterTomorrow() {
    if (!perkValue(state, 'forecastDays')) return null;
    const total = yearLength(level);
    const target = state.time.day + 2;
    if (target > total) return null;
    // L'aube de demain tirera la météo d'après-demain avec la saison du jour target.
    let acc = 0;
    let si = 0;
    for (; si < level.seasonLengths.length; si++) {
      acc += level.seasonLengths[si];
      if (target <= acc) break;
    }
    const copy = { weather: state.rng.weather };
    return stream(copy, 'weather').weighted(level.weather[SEASONS[si]]);
  }

  if (career) {
    rt = createCareerRuntime({
      state,
      getLevel: () => level,
      getCrops: () => crops,
      refreshLevel,
      push,
      flush,
      changeMoney,
      fail,
      playing,
      ENDED,
      sellAllRaw,
      seedCostOf,
      neighbourInfo,
    });
    actions.career = Object.fromEntries(Object.entries(rt.careerActions).map(([name, fn]) => [name, act(fn)]));
    query.career = rt.careerQueries;
  }

  return {
    get state() {
      return state;
    },
    get level() {
      return level;
    },
    mode: career ? 'career' : 'levels',
    /** Carrière : recalcule le niveau après une modification directe de l'état (outils de débogage, tests). */
    ...(career ? { refreshLevel } : {}),
    difficulty: state.difficulty,
    update,
    on: emitter.on,
    serialize: () => JSON.parse(JSON.stringify(state)),
    actions,
    query,
  };
}

/** Copie des effets sans Infinity (null = « toutes les parcelles »), pour l'affichage. */
function jsonEffects(effects) {
  const out = JSON.parse(JSON.stringify({ ...effects, waterPlots: undefined }));
  if (effects.waterPlots) out.waterPlots = effects.waterPlots.map((n) => (n === Infinity ? null : n));
  return out;
}

function seasonLabel(sid) {
  return { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' }[sid];
}
