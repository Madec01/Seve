// Cœur du jeu : createGame() / loadGame() → { state, update, on, serialize, actions, query }.
// Contrat décrit dans docs/ARCHITECTURE.md. Logique pure : aucun accès au DOM.
//
// ── Déroulé d'une journée ──────────────────────────────────────────────────────────────
// update(dt) accumule dt × vitesse dans state.time.elapsed. Chaque fois que elapsed dépasse
// DAY_SECONDS, la journée se termine (fin de journée) puis la suivante commence (aube), dans
// l'ordre, autant de fois que nécessaire (un grand dt traite plusieurs jours d'affilée).
//
// Fin de journée (le soir) :
//   si c'est le dernier jour de la saison → fermage :
//     argent < fermage  → faillite (status 'bankrupt', événement bankrupt), plus rien ne bouge ;
//     sinon on paie      → billPaid ; après le fermage d'hiver → victory (status 'victory').
//
// Aube (dans cet ordre) :
//   1. pousse des cultures d'après l'arrosage et la météo de la veille (ruches : bonus hors hiver,
//      canicule : 0 si non arrosée), puis remise à zéro de l'arrosage de toutes les parcelles ;
//   2. passage au jour suivant ; si une saison commence → seasonStart ;
//      si c'est le 1er jour d'hiver → gel des cultures non résistantes (frost) ;
//   3. nouvelle météo : aujourd'hui = la prévision d'hier, nouvelle prévision pour demain ;
//   4. maladie (si aube pluvieuse et rotChance > 0) : chaque culture peut pourrir (rot) ;
//   5. pluie / orage : toutes les parcelles plantées sont arrosées ;
//   6. nouveau cours du marché (niveau « marché fou ») ;
//   7. arrosage automatique : N parcelles plantées, non mûres, non arrosées (coût d'arrosage éventuel) ;
//   8. revenus des investissements (valeurs de la saison du jour ; orage : pas de revenu de l'étal ;
//      tonte des moutons à l'aube du dernier jour de printemps, d'été et d'automne) ;
//   9. charges quotidiennes (ferme + entretien − panneaux solaires, minimum 0) ;
//  10. mensualité du prêt (aube du jour loan.first, puis tous les loan.every jours) ;
//  11. événements : weather, dawn, moneyChanged, puis seasonWarning (2 jours avant un changement).
//
// L'argent peut devenir négatif uniquement par les charges de l'aube (charges, arrosage
// automatique, prêt). Les achats et plantations exigent d'avoir la somme.

import { DAY_SECONDS, DEFAULT_SPEED, EPSILON, SEASONS, SPEEDS, WARNING_DAYS } from '../data/balance.js';
import { CROPS, getCrop } from '../data/crops.js';
import { getLevel, yearLength } from '../data/levels.js';
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
import { initialMarket, levelCrops, marketMultiplier, updateMarket } from './market.js';
import {
  checkBuy,
  dailyCharges,
  dawnIncomes,
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
  currentUnitPrice,
  growPlots,
  harvestValue,
  isMature,
  plotUnlockCost,
  rainWater,
  sprinklerWater,
  stageOf,
  wateredRate,
  wouldFatigue,
} from './farm.js';
import { addHarvest, addLost, addStat, buildSummary, createStats } from './stats.js';
import { createEmitter } from './events.js';

export const STATE_VERSION = 1;

/** Nouvelle partie. */
export function createGame({ levelId = 1, seed = Date.now() } = {}) {
  const level = getLevel(levelId);
  if (!level) throw new Error(`Niveau inconnu : ${levelId}`);
  const crops = levelCrops(level, CROPS);
  const state = {
    version: STATE_VERSION,
    levelId: level.id,
    seed,
    status: 'playing',
    speed: DEFAULT_SPEED,
    time: { day: 1, seasonIndex: 0, dayOfSeason: 1, elapsed: 0 },
    money: level.startMoney,
    startMoney: level.startMoney,
    weather: { today: null, tomorrow: null },
    plots: createPlots(level),
    plotsBought: 0,
    investments: Object.fromEntries(levelInvestments(level).map((i) => [i.id, 0])),
    market: {},
    rng: createRngState(seed),
    stats: { year: createStats(), season: createStats() },
    lastDawn: null,
    result: null,
  };
  state.weather.today = drawWeather(state, level, 0);
  state.weather.tomorrow = drawWeather(state, level, tomorrowSeasonIndex(state, level) ?? 0);
  state.market = initialMarket(state, level, crops);
  return wrap(state);
}

/** Reprise d'une partie depuis un objet issu de game.serialize(). */
export function loadGame(saved) {
  if (!saved || typeof saved !== 'object') throw new Error('Sauvegarde invalide');
  if (saved.version !== STATE_VERSION) throw new Error(`Version de sauvegarde incompatible : ${saved.version}`);
  if (!getLevel(saved.levelId)) throw new Error(`Niveau inconnu : ${saved.levelId}`);
  return wrap(JSON.parse(JSON.stringify(saved)));
}

function wrap(state) {
  const level = getLevel(state.levelId);
  const crops = levelCrops(level, CROPS);
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

  function validPlot(index) {
    return Number.isInteger(index) && index >= 0 && index < state.plots.length;
  }

  // ── Fin de journée : fermage ────────────────────────────────────────────────────────
  function endOfDay() {
    if (!isLastDayOfSeason(state, level)) return;
    const sid = seasonId(state);
    const rent = rentFor(level, state.time.seasonIndex);
    if (state.money < rent) {
      state.status = 'bankrupt';
      state.time.elapsed = DAY_SECONDS; // la partie s'arrête le soir du dernier jour
      state.result = { outcome: 'bankrupt', amountDue: rent, money: state.money, seasonId: sid, day: state.time.day };
      push('bankrupt', { amountDue: rent, money: state.money, seasonId: sid, summary: buildSummary(state, sid, { amountDue: rent }) });
      return;
    }
    addStat(state, 'rentsPaid', rent);
    changeMoney(-rent);
    push('billPaid', { amount: rent, seasonId: sid, summary: buildSummary(state, sid, { amount: rent }) });
    if (isLastSeason(state)) {
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
    const moneyBefore = state.money;
    const prevSeason = state.time.seasonIndex;
    const prevWeather = state.weather.today;

    // 1. Pousse (veille) puis remise à zéro de l'arrosage.
    growPlots(state, prevSeason, prevWeather);

    // 2. Nouveau jour, nouvelle saison, gel.
    const newSeason = advanceDay(state, level);
    const sid = seasonId(state);
    if (newSeason) {
      state.stats.season = createStats();
      push('seasonStart', { seasonId: sid, seasonIndex: state.time.seasonIndex });
      if (sid === 'winter') {
        const lost = applyFrost(state);
        addLost(state, 'frost', lost.length);
        push('frost', { lostPlots: lost.map((l) => l.plotIndex), lost });
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
    const sprinkled = sprinklerWater(state, sprinklerCapacity(state, level));
    const waterCost = sprinkled.length * level.modifiers.waterCost;

    // 8. Revenus.
    const incomes = dawnIncomes(state, level, state.time.seasonIndex, today, isLastDayOfSeason(state, level));
    const incomeTotal = incomes.reduce((s, i) => s + i.amount, 0);

    // 9-10. Charges et prêt.
    const fixed = dailyCharges(state, level);
    const loanPayment = loanDueOn(level, state.time.day) ? level.modifiers.loan.payment : 0;
    const chargesDetail = [{ source: 'farm', amount: fixed }];
    if (waterCost > 0) chargesDetail.push({ source: 'water', amount: waterCost });
    if (loanPayment > 0) chargesDetail.push({ source: 'loan', amount: loanPayment });
    const charges = fixed + waterCost + loanPayment;

    addStat(state, 'investmentIncome', incomeTotal);
    addStat(state, 'charges', fixed);
    addStat(state, 'waterSpent', waterCost);
    addStat(state, 'loanPaid', loanPayment);
    state.money += incomeTotal - charges;

    // 11. Événements.
    const dawnInfo = {
      day: state.time.day,
      seasonId: sid,
      weather: today,
      incomes,
      charges,
      chargesDetail,
      sprinkled,
      net: incomeTotal - charges,
    };
    state.lastDawn = JSON.parse(JSON.stringify(dawnInfo));
    push('weather', { today, tomorrow: state.weather.tomorrow });
    push('dawn', dawnInfo);
    if (state.money !== moneyBefore) push('moneyChanged', { money: state.money, delta: state.money - moneyBefore });

    if (!isLastSeason(state) && daysLeftInSeason(state, level) + 1 === WARNING_DAYS) {
      const next = SEASONS[state.time.seasonIndex + 1];
      push('seasonWarning', { nextSeasonId: next, daysLeft: WARNING_DAYS, frost: next === 'winter' });
    }
  }

  // ── Temps ────────────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (!playing() || !(dt > 0) || state.speed === 0) return;
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

  const actions = {
    plant: act((plotIndex, cropId) => {
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
      if (p.cropId) return fail('Cette parcelle est déjà plantée.');
      const crop = getCrop(cropId);
      if (!crop || !crops.includes(crop)) return fail('Culture inconnue.');
      const sid = seasonId(state);
      if (!crop.seasons.includes(sid)) return fail(`${crop.name} : ne se plante pas ${seasonLabel(sid)}.`);
      if (state.money < crop.seedCost) return fail(notEnoughMoney(crop.seedCost - state.money));
      p.cropId = crop.id;
      p.growth = 0;
      p.fatigued = wouldFatigue(level, p, crop.id);
      p.watered = weatherWaters(state.weather.today); // il pleut : la graine est arrosée d'office
      addStat(state, 'seedsSpent', crop.seedCost);
      addStat(state, 'cropsPlanted', 1);
      changeMoney(-crop.seedCost);
      push('planted', { plotIndex, cropId: crop.id, amount: crop.seedCost, fatigue: p.fatigued, watered: p.watered });
      return { ok: true, cost: crop.seedCost, fatigue: p.fatigued };
    }),

    water: act((plotIndex) => {
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
      if (!p.cropId) return fail('Rien à arroser ici.');
      if (isMature(p)) return fail('Cette culture est mûre : récoltez-la !');
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
      if (!playing()) return fail(ENDED);
      if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
      const p = state.plots[plotIndex];
      if (!p.cropId) return fail('Rien à récolter ici.');
      if (!isMature(p)) {
        const left = plotDaysLeft(p);
        return fail(`Pas encore mûre (encore ${left} jour${left > 1 ? 's' : ''}).`);
      }
      const cropId = p.cropId;
      const amount = harvestValue(state, level, p);
      const fatigue = p.fatigued;
      p.lastHarvested = cropId;
      clearPlot(p);
      addStat(state, 'harvestIncome', amount);
      addHarvest(state, cropId);
      changeMoney(amount);
      push('harvested', { plotIndex, cropId, amount, fatigue });
      return { ok: true, amount, cropId };
    }),

    unlockPlot: act((plotIndex) => {
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
      if (!playing()) return fail(ENDED);
      const check = checkBuy(state, level, investmentId);
      if (!check.ok) return check;
      state.investments[investmentId] = owned(state, investmentId) + 1;
      addStat(state, 'investmentsSpent', check.cost);
      changeMoney(-check.cost);
      const n = state.investments[investmentId];
      push('purchased', { investmentId, owned: n, cost: check.cost });
      return { ok: true, owned: n, cost: check.cost };
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
    return Math.max(1, Math.ceil((crop.growDays - p.growth) / wateredRate(state, state.time.seasonIndex) - EPSILON));
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

  const query = {
    plot(plotIndex) {
      if (!validPlot(plotIndex)) return null;
      const p = state.plots[plotIndex];
      const crop = p.cropId ? getCrop(p.cropId) : null;
      const mature = !!crop && isMature(p);
      const daysLeft = crop ? plotDaysLeft(p) : 0;
      const unlockCost = p.unlocked ? null : plotUnlockCost(state, level);
      let action = null;
      if (playing()) {
        if (!p.unlocked) action = unlockCost === null ? null : 'unlock';
        else if (!crop) action = 'plant';
        else if (mature) action = 'harvest';
        else if (!p.watered) action = 'water';
      }
      return {
        index: plotIndex,
        col: plotIndex % level.gridCols,
        row: Math.floor(plotIndex / level.gridCols),
        unlocked: p.unlocked,
        unlockCost,
        cropId: p.cropId,
        cropName: crop ? crop.name : null,
        stage: crop ? stageOf(p.growth, crop.growDays) : 0,
        progress: crop ? Math.min(1, p.growth / crop.growDays) : 0,
        daysLeft,
        watered: p.watered,
        mature,
        fatigue: p.fatigued,
        willFreeze: !!crop && !mature && freezes(crop, daysLeft),
        harvestValue: mature ? harvestValue(state, level, p) : null,
        action,
      };
    },

    plots() {
      return state.plots.map((_, i) => query.plot(i));
    },

    /** Cultures plantables aujourd'hui ; avec plotIndex, tient compte de la fatigue du sol de cette parcelle. */
    plantableCrops(plotIndex) {
      const sid = seasonId(state);
      const plot = validPlot(plotIndex) ? state.plots[plotIndex] : null;
      const rate = wateredRate(state, state.time.seasonIndex);
      return crops
        .filter((c) => c.seasons.includes(sid))
        .map((c) => {
          const fatigue = plot ? wouldFatigue(level, plot, c.id) : false;
          const factor = fatigue ? 1 - level.modifiers.soilFatigue : 1;
          const sellPrice = Math.round(currentUnitPrice(state, c) * factor);
          const daysToMature = Math.ceil(c.growDays / rate - EPSILON);
          return {
            id: c.id,
            name: c.name,
            seedCost: c.seedCost,
            basePrice: c.sellPrice,
            marketMultiplier: marketMultiplier(state, c.id),
            sellPrice,
            profit: sellPrice - c.seedCost,
            growDays: c.growDays,
            daysToMature,
            frostHardy: c.frostHardy,
            fatigue,
            willFreeze: freezes(c, daysToMature),
            canAfford: state.money >= c.seedCost,
          };
        });
    },

    investments() {
      const sid = seasonId(state);
      return levelInvestments(level).map((inv) => {
        const check = playing() ? checkBuy(state, level, inv.id) : fail(ENDED);
        return {
          id: inv.id,
          name: inv.name,
          description: inv.description,
          kind: inv.kind,
          owned: owned(state, inv.id),
          max: maxOf(inv),
          nextCost: nextCost(state, inv),
          canBuy: check.ok,
          reason: check.ok ? null : check.reason,
          income: inv.income[sid] || 0,
          incomeBySeason: { ...inv.income },
          upkeep: inv.upkeep,
          effects: jsonEffects(inv.effects),
        };
      });
    },

    forecast() {
      return { today: state.weather.today, tomorrow: state.weather.tomorrow };
    },

    finance() {
      const si = state.time.seasonIndex;
      const incomes = dawnIncomes(state, level, si, null, false);
      const dailyIncome = incomes.reduce((s, i) => s + i.amount, 0);
      const charges = dailyCharges(state, level);
      const total = yearLength(level);
      const loan = level.modifiers.loan;
      const nextLoan = nextLoanDay(level, state.time.day, total);
      return {
        money: state.money,
        dailyIncome,
        dailyCharges: charges,
        net: dailyIncome - charges,
        nextBill: { amount: rentFor(level, si), daysLeft: daysLeftInSeason(state, level), seasonId: SEASONS[si] },
        loan: loan
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
      };
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
  };

  return {
    get state() {
      return state;
    },
    level,
    update,
    on: emitter.on,
    serialize: () => JSON.parse(JSON.stringify(state)),
    actions,
    query,
  };
}

/** Copie des effets sans Infinity (null = « toutes les parcelles »), pour l'affichage. */
function jsonEffects(effects) {
  const out = { ...effects };
  if (out.waterPlots) out.waterPlots = out.waterPlots.map((n) => (n === Infinity ? null : n));
  return out;
}

function seasonLabel(sid) {
  return { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' }[sid];
}
