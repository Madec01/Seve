#!/usr/bin/env node
// Simulation d'équilibrage : des joueurs-robots jouent chaque niveau avec de nombreuses graines.
//
//   node tools/simulate.js                      tous les niveaux, 200 graines, toutes les stratégies
//   node tools/simulate.js --level 3 --seeds 500
//   node tools/simulate.js --strategy balanced --verbose
//   node tools/simulate.js --clicks 30          limite d'actions par jour (par défaut illimité :
//                                               le joueur arrose tout à la main, quitte à mettre en pause)
//   node tools/simulate.js --trace --level 2 --strategy optimal --seed 7   déroulé jour par jour d'une partie
//   node tools/simulate.js --json               sortie JSON (pour comparer deux réglages)
//
// Les robots passent uniquement par l'API publique du jeu (actions / query), comme l'interface.
// Chaque jour, juste après l'aube, ils récoltent, achètent, plantent et arrosent, puis la journée s'écoule.
//
// Stratégies :
//   careless  : graines les moins chères, pas d'investissement ni de parcelle, aucune prévoyance
//               (plante même ce qui gèlera, ne garde rien de côté).
//   balanced  : meilleure culture du moment, investissements progressifs dans un ordre fixe tant
//               qu'ils sont rentables d'ici la fin de l'année, garde de quoi payer le fermage.
//   investor  : achète tout investissement dès qu'il le peut (meilleur revenu par pièce d'abord),
//               plante avec ce qui reste.
//   optimal   : heuristique gloutonne : évalue chaque achat (investissement ou parcelle) par sa
//               rentabilité attendue jusqu'à la fin de l'année, garde une réserve pour le fermage,
//               gère la rotation (niveau bio) et vend au bon moment sur le marché fou.

import { createGame } from '../src/core/game.js';
import { DAY_SECONDS, EPSILON, SEASONS } from '../src/data/balance.js';
import { CROPS, getCrop } from '../src/data/crops.js';
import { getInvestment } from '../src/data/investments.js';
import { LEVELS, yearLength } from '../src/data/levels.js';

// ── Arguments ────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const SEEDS = Number(arg('seeds', 200));
const LEVEL_FILTER = arg('level', null);
const STRATEGY_FILTER = arg('strategy', null);
const CLICKS = Number(arg('clicks', Infinity));
const JSON_OUT = !!arg('json', false);
const VERBOSE = !!arg('verbose', false);
const TRACE = !!arg('trace', false);
const TRACE_SEED = Number(arg('seed', 1));
// Réglages de la stratégie « optimal » (fonds de roulement gardé, rentabilité minimale d'un achat).
const OPT_CAPITAL = Number(arg('opt-capital', 0.6));
const OPT_RATIO = Number(arg('opt-ratio', 0.15));
const OPT_PLANT_FIRST = !!arg('opt-plant-first', false);
const OPT_MARKET = !arg('opt-no-market', false);
const OPT_HOLD = Number(arg('opt-hold', 0.8));

// ── Modèle économique utilisé par les robots pour évaluer leurs achats ───────────────────

/** Contexte de décision (recalculé après chaque action). */
function ctx(game) {
  const q = game.query;
  return { game, q, level: q.level(), cal: q.calendar(), fin: q.finance(), state: game.state };
}

function seasonEnds(level) {
  const ends = [];
  let acc = 0;
  for (const len of level.seasonLengths) ends.push((acc += len));
  return ends;
}

function seasonOfDay(level, day) {
  return seasonEnds(level).findIndex((e) => day <= e);
}

function cropsOf(level) {
  return level.crops ? level.crops.map(getCrop) : CROPS;
}

function unlockedPlots(state) {
  return state.plots.filter((p) => p.unlocked).length;
}

/**
 * Meilleure culture d'une saison, en régime de croisière :
 * { perDay: profit / jour / parcelle, revenue: chiffre d'affaires / jour / parcelle }.
 */
function seasonCropModel(level, season, { hives = 0, priceBonus = 0 } = {}) {
  const rate = 1 + (season === 'winter' ? 0 : 0.1 * hives);
  const options = cropsOf(level)
    .filter((c) => c.seasons.includes(season))
    .map((c) => {
      const cycle = Math.ceil(c.growDays / rate - EPSILON);
      const price = c.sellPrice * (1 + priceBonus);
      const profit = price - c.seedCost - level.modifiers.waterCost * cycle;
      return { perDay: profit / cycle, revenue: price / cycle };
    })
    .sort((a, b) => b.perDay - a.perDay);
  if (options.length === 0) return { perDay: 0, revenue: 0 };
  // Niveau bio : la rotation oblige à alterner avec la 2e meilleure culture.
  if (level.modifiers.soilFatigue > 0 && options.length > 1) {
    return { perDay: (options[0].perDay + options[1].perDay) / 2, revenue: (options[0].revenue + options[1].revenue) / 2 };
  }
  return options[0];
}

/** Part du potentiel réellement exploitée (fins de saison, gel, maladie, météo). */
function efficiency(level, season) {
  let e = season === 'winter' ? 0.6 : 0.85;
  if (level.modifiers.rotChance > 0) e *= 0.85;
  return e;
}

/** Valeur attendue (pièces gagnées d'ici la fin de l'année) d'un achat supplémentaire. */
function purchaseValue(c, id) {
  const { level, cal, state, fin } = c;
  const total = yearLength(level);
  const ends = seasonEnds(level);
  const plots = unlockedPlots(state);
  const hives = state.investments.beehive || 0;
  const bonus = fin.priceBonus;
  let value = 0;
  for (let d = cal.day + 1; d <= total; d++) {
    const season = SEASONS[seasonOfDay(level, d)];
    const eff = efficiency(level, season);
    const now = seasonCropModel(level, season, { hives, priceBonus: bonus });
    if (id === 'plot') {
      // Le dernier cycle de l'année n'est pas toujours récolté : on s'arrête 3 jours avant la fin.
      if (d <= total - 3) value += now.perDay * eff;
      continue;
    }
    const inv = getInvestment(id);
    const n = state.investments[id] || 0;
    if (inv.kind === 'unit') {
      value += (inv.income[season] || 0) - inv.upkeep;
      if (inv.effects.shearing && inv.effects.shearingSeasons.includes(season) && ends.includes(d)) value += inv.effects.shearing;
      if (inv.effects.chargeReduction) value += Math.min(inv.effects.chargeReduction, fin.dailyCharges);
    } else if (n === 0) {
      value -= inv.upkeep;
    }
    if (inv.effects.growthBonus) {
      const more = seasonCropModel(level, season, { hives: hives + 1, priceBonus: bonus });
      value += (more.perDay - now.perDay) * plots * eff;
    }
    if (inv.effects.priceBonus) value += inv.effects.priceBonus * now.revenue * plots * eff;
    if (inv.effects.waterPlots && Number.isFinite(CLICKS)) {
      // L'arrosage automatique ne vaut quelque chose que pour un joueur limité en clics.
      value += 0.3 * Math.min(plots, inv.effects.waterPlots[n] ?? 0);
    }
  }
  return value;
}

function purchaseCost(c, id) {
  if (id === 'plot') {
    const idx = c.state.plots.findIndex((p) => !p.unlocked);
    return idx >= 0 ? c.q.plot(idx).unlockCost : null;
  }
  return c.q.investments().find((x) => x.id === id)?.nextCost ?? null;
}

/** Prix attendu d'une récolte (prix de base × étal × fatigue ; sur le marché fou, cours moyen ≈ 1). */
function expectedPrice(c, crop, fatigue) {
  const f = fatigue ? 1 - c.level.modifiers.soilFatigue : 1;
  return crop.sellPrice * (1 + c.fin.priceBonus) * f;
}

/**
 * Réserve à garder pour payer le prochain fermage : fermage + charges + arrosage à venir
 * − revenus automatiques − récoltes attendues avant le fermage.
 */
function reserve(c, margin = 5) {
  const { q, cal, fin, level, state } = c;
  const d = cal.daysLeftInSeason; // aubes avant le fermage
  let harvest = 0;
  let water = 0;
  for (let i = 0; i < state.plots.length; i++) {
    const p = q.plot(i);
    if (!p.cropId) continue;
    if (p.mature) {
      harvest += p.harvestValue;
      continue;
    }
    water += level.modifiers.waterCost * Math.min(p.daysLeft, d + 1);
    if (p.daysLeft <= d && !p.willFreeze) harvest += expectedPrice(c, getCrop(p.cropId), p.fatigue);
  }
  let loans = 0;
  if (level.modifiers.loan) {
    for (let k = 1; k <= d; k++) if ((cal.day + k - 1) % level.modifiers.loan.every === 0) loans += level.modifiers.loan.payment;
  }
  const season = SEASONS[cal.seasonIndex];
  const sheep = state.investments.sheep || 0;
  const shear = getInvestment('sheep').effects;
  const shearing = sheep && d >= 1 && shear.shearingSeasons.includes(season) ? sheep * shear.shearing : 0;
  const out = fin.nextBill.amount + fin.dailyCharges * d + loans + water;
  const inc = fin.dailyIncome * d + shearing + harvest;
  return Math.max(0, out - inc + margin);
}

/** Argent déjà promis à l'arrosage des cultures en place (niveau sécheresse). */
function committedWater(c) {
  const { q, level, state } = c;
  if (!level.modifiers.waterCost) return 0;
  let w = 0;
  for (let i = 0; i < state.plots.length; i++) {
    const p = q.plot(i);
    if (p.cropId && !p.mature) w += level.modifiers.waterCost * p.daysLeft;
  }
  return w;
}

/** Fonds de roulement : de quoi replanter une bonne partie du champ (saison en cours ou suivante). */
function workingCapital(c, factor = 0.6) {
  const si = c.cal.daysLeftInSeason <= 1 ? Math.min(3, c.cal.seasonIndex + 1) : c.cal.seasonIndex;
  const season = SEASONS[si];
  const seeds = cropsOf(c.level)
    .filter((cr) => cr.seasons.includes(season))
    .map((cr) => cr.seedCost);
  const avg = seeds.length ? seeds.reduce((a, b) => a + b, 0) / seeds.length : 0;
  return Math.round(unlockedPlots(c.state) * avg * factor);
}

// ── Actions de base ─────────────────────────────────────────────────────────────────────

function makeBudget() {
  return { left: CLICKS };
}

function click(budget) {
  if (budget.left <= 0) return false;
  budget.left--;
  return true;
}

function harvestAll(game, budget, smartMarket) {
  const c = ctx(game);
  const { q, state, level, cal } = c;
  for (let i = 0; i < state.plots.length; i++) {
    const p = q.plot(i);
    if (!p.mature) continue;
    if (smartMarket && level.modifiers.priceVolatility) {
      // Marché fou : on garde sur pied tant que le cours est bas, sauf urgence.
      const mult = state.market[p.cropId];
      const crop = getCrop(p.cropId);
      const lastChance =
        cal.day >= cal.totalDays || (!crop.frostHardy && SEASONS[cal.seasonIndex] === 'autumn' && cal.daysLeftInSeason === 0);
      // Le jour du fermage (et la veille), on vend tout pour être sûr de payer.
      const billSoon = cal.daysLeftInSeason <= 1;
      if (mult < OPT_HOLD && !lastChance && !billSoon) continue;
    }
    if (!click(budget)) return;
    game.actions.harvest(i);
  }
}

function waterAll(game, budget) {
  const { q, state } = ctx(game);
  for (let i = 0; i < state.plots.length; i++) {
    if (q.plot(i).action !== 'water') continue;
    if (!click(budget)) return;
    if (!game.actions.water(i).ok) return;
  }
}

/**
 * Plante les parcelles vides.
 * @param {'cheap'|'best'} mode
 * @param {boolean} careful  évite le gel et la fin d'année, garde la réserve du fermage et l'argent de l'arrosage
 */
function plantAll(game, budget, mode, careful) {
  const n = game.state.plots.length;
  for (let i = 0; i < n; i++) {
    const c = ctx(game);
    const p = c.q.plot(i);
    if (p.action !== 'plant') continue;
    const waterCost = c.level.modifiers.waterCost;
    let options = c.q.plantableCrops(i).filter((o) => o.canAfford);
    if (careful) {
      const left = c.cal.totalDays - c.cal.day;
      const res = reserve(c);
      const committed = committedWater(c);
      options = options.filter((o) => {
        if (o.willFreeze || o.daysToMature > left) return false;
        // Il faut pouvoir payer la graine, son arrosage et les charges nettes jusqu'à la récolte.
        const upkeep = Math.max(0, c.fin.dailyCharges - c.fin.dailyIncome) * Math.min(o.daysToMature, c.cal.daysLeftInSeason);
        const cash = c.state.money - o.seedCost - waterCost * o.daysToMature - committed - upkeep;
        if (cash < 0) return false;
        // Sous la réserve, seulement ce qui sera récolté avant le fermage.
        return cash >= res || o.daysToMature <= c.cal.daysLeftInSeason;
      });
    }
    if (options.length === 0) continue;
    let pick;
    if (mode === 'cheap') {
      pick = options.reduce((a, b) => (b.seedCost < a.seedCost ? b : a));
    } else {
      const profit = (o) => expectedPrice(c, getCrop(o.id), o.fatigue) - o.seedCost - waterCost * o.daysToMature;
      const perDay = (o) => profit(o) / o.daysToMature;
      // Peu d'argent : on privilégie le rendement du capital (cultures bon marché et rapides).
      const empty = c.state.plots.filter((pl) => pl.unlocked && !pl.cropId).length;
      const top = options.reduce((a, b) => (perDay(b) > perDay(a) ? b : a));
      const tight = c.state.money < empty * top.seedCost;
      const score = tight ? (o) => perDay(o) / (o.seedCost + waterCost * o.daysToMature) : perDay;
      pick = options.reduce((a, b) => (score(b) > score(a) ? b : a));
      if (profit(pick) <= 0) continue;
    }
    if (!click(budget)) return;
    game.actions.plant(i, pick.id);
  }
}

/** Achète si l'argent restant couvre la réserve du fermage + une marge (+ le fonds de roulement). */
function tryBuy(game, id, buffer, keepCapital = true, capitalFactor = 0.6) {
  const c = ctx(game);
  const cost = purchaseCost(c, id);
  if (cost == null) return false;
  const keep = reserve(c) + committedWater(c) + buffer + (keepCapital ? workingCapital(c, capitalFactor) : 0);
  if (c.state.money - cost < keep) return false;
  if (id === 'plot') {
    const idx = c.state.plots.findIndex((p) => !p.unlocked);
    return idx >= 0 && game.actions.unlockPlot(idx).ok;
  }
  return game.actions.buyInvestment(id).ok;
}

function candidates(c) {
  const ids = c.q.investments().map((x) => x.id);
  return ['plot', ...ids].filter((id) => purchaseCost(c, id) != null);
}

// ── Stratégies ─────────────────────────────────────────────────────────────────────────

const BALANCED_ORDER = [
  'chickenCoop', 'plot', 'plot', 'roadsideStand', 'beehive', 'plot', 'chickenCoop', 'sheep', 'plot', 'cow',
  'plot', 'beehive', 'solarPanel', 'plot', 'chickenCoop', 'sheep', 'guestHouse', 'plot', 'plot', 'plot', 'plot',
  'plot', 'plot', 'plot', 'plot', 'plot', 'plot', 'plot',
];

const STRATEGIES = {
  careless(game) {
    const budget = makeBudget();
    harvestAll(game, budget, false);
    waterAll(game, budget);
    plantAll(game, budget, 'cheap', false);
    waterAll(game, budget);
  },

  balanced(game) {
    const budget = makeBudget();
    harvestAll(game, budget, false);
    // Suit une liste d'achats dans l'ordre ; saute ce qui n'est pas proposé ou plus rentable.
    const counts = {};
    for (const id of BALANCED_ORDER) {
      counts[id] = (counts[id] || 0) + 1;
      const c = ctx(game);
      const have = id === 'plot' ? c.state.plotsBought : c.state.investments[id] || 0;
      if (have >= counts[id]) continue;
      const cost = purchaseCost(c, id);
      if (cost == null) continue;
      if (purchaseValue(c, id) < cost * 1.1) continue;
      if (!tryBuy(game, id, 20)) break; // pas les moyens : on attend
    }
    waterAll(game, budget);
    plantAll(game, budget, 'best', true);
    waterAll(game, budget);
  },

  investor(game) {
    const budget = makeBudget();
    harvestAll(game, budget, false);
    // Investit avant de planter, dès qu'il a l'argent, tant que l'achat se rembourse d'ici la fin de l'année.
    for (let guard = 0; guard < 30; guard++) {
      const c = ctx(game);
      const invs = c.q
        .investments()
        .filter((x) => x.nextCost != null && x.id !== 'sprinkler' && purchaseValue(c, x.id) > x.nextCost);
      const daily = (x) =>
        (x.income - x.upkeep + (x.effects.shearing ? x.effects.shearing / 7 : 0) + (x.effects.chargeReduction || 0) + 3) / x.nextCost;
      invs.sort((a, b) => daily(b) - daily(a));
      if (!invs.some((inv) => tryBuy(game, inv.id, 0, false))) break;
    }
    waterAll(game, budget);
    plantAll(game, budget, 'best', true);
    waterAll(game, budget);
  },

  optimal(game) {
    const budget = makeBudget();
    harvestAll(game, budget, OPT_MARKET);
    if (OPT_PLANT_FIRST) plantAll(game, budget, 'best', true);
    for (let guard = 0; guard < 40; guard++) {
      const c = ctx(game);
      const spendable = c.state.money - (reserve(c) + committedWater(c) + 10 + workingCapital(c, OPT_CAPITAL));
      let best = null;
      for (const id of candidates(c)) {
        const cost = purchaseCost(c, id);
        if (cost > spendable) continue;
        const ratio = (purchaseValue(c, id) - cost) / cost;
        if (ratio > OPT_RATIO && (!best || ratio > best.ratio)) best = { id, ratio };
      }
      if (!best || !tryBuy(game, best.id, 10, true, OPT_CAPITAL)) break;
    }
    waterAll(game, budget);
    plantAll(game, budget, 'best', true);
    waterAll(game, budget);
  },
};

// ── Boucle de simulation ────────────────────────────────────────────────────────────────

function playOne(levelId, seed, strategy) {
  const game = createGame({ levelId, seed });
  const total = game.query.calendar().totalDays;
  let result = null;
  game.on('victory', (e) => (result = { win: true, money: e.money, stars: e.stars, summary: e.summary }));
  game.on('bankrupt', (e) => (result = { win: false, money: e.money, stars: 0, seasonId: e.seasonId, summary: e.summary }));
  for (let day = 0; day <= total && game.state.status === 'playing'; day++) {
    const before = game.state.money;
    STRATEGIES[strategy](game);
    if (TRACE) traceDay(game, before);
    game.update(DAY_SECONDS);
  }
  if (!result) throw new Error(`Partie non terminée (niveau ${levelId}, graine ${seed})`);
  return result;
}

function traceDay(game, before) {
  const cal = game.query.calendar();
  const st = game.state;
  const crops = {};
  for (const p of st.plots) if (p.cropId) crops[p.cropId] = (crops[p.cropId] || 0) + 1;
  const inv = Object.entries(st.investments)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  console.log(
    `J${String(cal.day).padStart(2)} ${cal.seasonId.padEnd(6)} ${String(st.weather.today).padEnd(8)} ${String(before).padStart(5)} → ${String(st.money).padStart(5)}  parcelles ${unlockedPlots(st)}  ${JSON.stringify(crops)}  ${inv}`,
  );
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function pct(n, d) {
  return `${Math.round((100 * n) / d)}%`;
}

function runTrace() {
  const levelId = Number(LEVEL_FILTER || 1);
  const strategy = STRATEGY_FILTER || 'balanced';
  const r = playOne(levelId, TRACE_SEED, strategy);
  console.log(r.win ? `Victoire : ${r.money} pièces, ${r.stars} étoile(s)` : `Faillite (${r.seasonId}) : ${r.money} pièces`);
  if (VERBOSE) console.log(JSON.stringify(r.summary, null, 1));
}

function run() {
  const levels = LEVELS.filter((l) => !LEVEL_FILTER || String(l.id) === String(LEVEL_FILTER));
  const strategies = Object.keys(STRATEGIES).filter((s) => !STRATEGY_FILTER || s === STRATEGY_FILTER);
  const out = [];
  for (const level of levels) {
    const rows = [];
    for (const strategy of strategies) {
      const results = [];
      for (let seed = 1; seed <= SEEDS; seed++) results.push(playOne(level.id, seed, strategy));
      const wins = results.filter((r) => r.win);
      const stars = [0, 1, 2, 3].map((s) => results.filter((r) => r.stars === s).length);
      const lossSeasons = {};
      for (const r of results) if (!r.win) lossSeasons[r.seasonId] = (lossSeasons[r.seasonId] || 0) + 1;
      const inv = {};
      for (const r of results) for (const [k, v] of Object.entries(r.summary.investments)) inv[k] = (inv[k] || 0) + v;
      rows.push({
        strategy,
        winRate: wins.length / results.length,
        medianMoney: median(results.map((r) => r.money)),
        medianWinMoney: wins.length ? median(wins.map((r) => r.money)) : null,
        stars,
        lossSeasons,
        avgInvestments: Object.fromEntries(
          Object.entries(inv)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => [k, +(v / results.length).toFixed(2)]),
        ),
        avgPlotsSpent: Math.round(results.reduce((s, r) => s + r.summary.plotsSpent, 0) / results.length),
      });
    }
    out.push({ level: level.id, name: level.name, thresholds: level.starThresholds, rows });
  }
  if (JSON_OUT) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log(`Simulation : ${SEEDS} graines par niveau et par stratégie${Number.isFinite(CLICKS) ? `, ${CLICKS} actions/jour` : ''}\n`);
  for (const lv of out) {
    console.log(`Niveau ${lv.level} — ${lv.name}   (★★ ≥ ${lv.thresholds[0]}, ★★★ ≥ ${lv.thresholds[1]})`);
    console.log('  stratégie  victoires  argent médian  (si victoire)   faillite / ★ / ★★ / ★★★   faillites par saison');
    for (const r of lv.rows) {
      const st = r.stars.map((n) => pct(n, SEEDS).padStart(4)).join(' ');
      const losses = Object.entries(r.lossSeasons)
        .map(([s, n]) => `${s}:${n}`)
        .join(' ');
      console.log(
        `  ${r.strategy.padEnd(10)} ${pct(r.winRate * SEEDS, SEEDS).padStart(8)}  ${String(r.medianMoney).padStart(12)}  ${String(r.medianWinMoney ?? '—').padStart(12)}   ${st}   ${losses}`,
      );
      if (VERBOSE) console.log(`             achats moyens : ${JSON.stringify(r.avgInvestments)}  parcelles (pièces) : ${r.avgPlotsSpent}`);
    }
    console.log('');
  }
}

if (TRACE) runTrace();
else run();
