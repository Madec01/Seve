#!/usr/bin/env node
// Simulation d'équilibrage : des joueurs-robots jouent chaque niveau avec de nombreuses graines.
//
//   node tools/simulate.js                      tous les niveaux, 200 graines, toutes les stratégies
//   node tools/simulate.js --level 3 --seeds 500
//   node tools/simulate.js --levels 9-12        une plage de niveaux
//   node tools/simulate.js --strategy balanced --verbose
//   node tools/simulate.js --perks all          (v3) avec tous les bonus permanents (none par défaut, ou une
//                                               liste : --perks almanac,frugal ; rang maximal)
//   node tools/simulate.js --compare-perks      (v3) tableau côte à côte : sans bonus / avec tous les bonus
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
//               (plante même ce qui gèlera, ne garde rien de côté) ; jamais d'atelier ni d'arbre.
//   balanced  : meilleure culture du moment, investissements progressifs dans un ordre fixe tant
//               qu'ils sont rentables d'ici la fin de l'année, garde de quoi payer le fermage ;
//               (v3) l'atelier du niveau vient juste après le premier poulailler ; pommiers au printemps
//               sur au plus 1/4 des parcelles ; nourrit l'atelier (culture transformable tant qu'il y a de la place).
//   investor  : achète tout investissement dès qu'il le peut (meilleur revenu par pièce d'abord),
//               plante avec ce qui reste ; (v3) ateliers et chèvres compris.
//   optimal   : heuristique gloutonne : évalue chaque achat (investissement ou parcelle) par sa
//               rentabilité attendue jusqu'à la fin de l'année, garde une réserve pour le fermage,
//               gère la rotation (niveau bio) et vend au bon moment sur le marché fou ;
//               (v3) valeur d'un atelier = gain par produit × produits réellement possibles d'ici la fin
//               de l'année ; pommiers seulement si ≥ 3 paniers sont attendus ; concours du niveau 12.
//
// Parité : sans bonus, sur les niveaux 1 à 8, les robots prennent exactement les mêmes décisions qu'en v2
// (tests/parity.test.js) : tout ce qui est propre à la v3 ne s'active qu'avec un arbre, un atelier, une
// chèvre, un bonus ou un concours.

import { fileURLToPath } from 'node:url';
import { loanDueOn } from '../src/core/economy.js';
import { createGame } from '../src/core/game.js';
import { gameCrops, perkValue } from '../src/core/perks.js';
import { DAY_SECONDS, EPSILON, MARKET, SEASONS } from '../src/data/balance.js';
import { getCrop } from '../src/data/crops.js';
import { getInvestment } from '../src/data/investments.js';
import { LEVELS, yearLength } from '../src/data/levels.js';
import { PERKS } from '../src/data/perks.js';
import { getProduct, productsFor } from '../src/data/products.js';

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
const LEVELS_RANGE = arg('levels', null);
const STRATEGY_FILTER = arg('strategy', null);
const CLICKS = Number(arg('clicks', Infinity));
const JSON_OUT = !!arg('json', false);
const VERBOSE = !!arg('verbose', false);
const TRACE = !!arg('trace', false);
const TRACE_SEED = Number(arg('seed', 1));
const PERKS_ARG = String(arg('perks', 'none'));
const COMPARE = !!arg('compare-perks', false);
// Réglages de la stratégie « optimal » (fonds de roulement gardé, rentabilité minimale d'un achat).
const OPT_CAPITAL = Number(arg('opt-capital', 0.6));
const OPT_RATIO = Number(arg('opt-ratio', 0.15));
const OPT_PLANT_FIRST = !!arg('opt-plant-first', false);
const OPT_MARKET = !arg('opt-no-market', false);
const OPT_HOLD = Number(arg('opt-hold', 0.9));

/** Bonus d'après --perks : 'none' → {}, 'all' → tous au rang maximal, 'a,b' → ceux-là au rang maximal. */
export function resolvePerks(spec) {
  if (!spec || spec === 'none') return {};
  const ids = spec === 'all' ? PERKS.map((p) => p.id) : String(spec).split(',').map((s) => s.trim()).filter(Boolean);
  const out = {};
  for (const id of ids) {
    const perk = PERKS.find((p) => p.id === id);
    if (!perk) throw new Error(`Bonus inconnu : ${id}`);
    out[id] = perk.costs.length;
  }
  return out;
}

// ── Modèle économique utilisé par les robots pour évaluer leurs achats ───────────────────

/** Contexte de décision (recalculé après chaque action). */
function ctx(game) {
  const q = game.query;
  const level = q.level();
  const state = game.state;
  const seedFactor = perkValue(state, 'seedFactor');
  return {
    game,
    q,
    level,
    cal: q.calendar(),
    fin: q.finance(),
    state,
    // v3 : cultures de la partie hors arbres (niveau + « Semencier »), prix des graines après bonus.
    crops: gameCrops(level, state.perks).filter((cr) => cr.kind !== 'tree'),
    seed: (cr) => (seedFactor === 1 ? cr.seedCost : Math.max(1, Math.round(cr.seedCost * seedFactor))),
    gt: perkValue(state, 'growthBonus'),
    rawFactor: level.modifiers.rawPriceFactor,
  };
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

function unlockedPlots(state) {
  return state.plots.filter((p) => p.unlocked).length;
}

/** Coût d'arrosage d'un cycle (pomme de terre : aucun, elle pousse sans eau). */
function waterFor(c, cr) {
  return (cr.dryGrowth ?? 0.5) >= 1 ? 0 : c.level.modifiers.waterCost;
}

/**
 * Meilleure culture d'une saison, en régime de croisière :
 * { perDay: profit / jour / parcelle, revenue: chiffre d'affaires / jour / parcelle }.
 */
function seasonCropModel(c, season, { hives = 0, priceBonus = 0 } = {}) {
  const { level } = c;
  const rate = 1 + (season === 'winter' ? 0 : 0.1 * hives + c.gt);
  const options = c.crops
    .filter((cr) => cr.seasons.includes(season))
    .map((cr) => {
      const cycle = Math.ceil(cr.growDays / rate - EPSILON);
      const price = cr.sellPrice * (1 + priceBonus) * c.rawFactor;
      const profit = price - c.seed(cr) - waterFor(c, cr) * cycle;
      return { perDay: profit / cycle, revenue: price / cycle, id: cr.id, cycle, profit };
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

// ── v3 : arbres, ateliers, lait ─────────────────────────────────────────────────────────

function treePlots(c) {
  return c.state.plots.filter((p) => p.cropId && getCrop(p.cropId).kind === 'tree');
}

/** Prix d'un produit maintenant (bonus de prix et « Recettes de grand-mère »), rendement donné. */
function productPrice(c, productId, yieldFactor = 1) {
  return getProduct(productId).value * (1 + perkValue(c.state, 'productBonus')) * (1 + c.fin.priceBonus) * yieldFactor;
}

/** Rendement des pommes (pollinisation) avec `hives` ruches. */
function appleYield(c, hives = c.state.investments.beehive || 0) {
  return c.level.modifiers.pollination && hives === 0 ? 0.5 : 1;
}

/** Places d'un atelier au niveau L (« Artisan » compris). */
function placesAt(c, inv, L) {
  return L > 0 ? inv.effects.processing.places[Math.min(L, 3) - 1] + perkValue(c.state, 'extraPlaces') : 0;
}

/**
 * Gain quotidien d'un atelier au niveau L, un jour de la saison `season` : places partagées entre les
 * recettes actives, les plus rentables par jour de place d'abord, dans la limite de l'approvisionnement.
 * Culture : le robot peut en planter autant qu'il veut, mais chaque produit coûte le manque à gagner
 * d'une parcelle qui aurait porté la meilleure culture. Pommes : pommiers adultes. Lait : animaux possédés.
 */
function workshopGain(c, inv, L, season, extraAnimals = {}) {
  if (L <= 0) return 0;
  let capacity = placesAt(c, inv, L); // jours de place disponibles par jour
  const best = seasonCropModel(c, season, { hives: c.state.investments.beehive || 0, priceBonus: c.fin.priceBonus });
  const options = [];
  for (const pr of productsFor(inv.id, L)) {
    let supply;
    let margin;
    if (pr.source === 'animal') {
      const aInv = getInvestment(pr.input);
      supply = (c.state.investments[pr.input] || 0) + (extraAnimals[pr.input] || 0);
      margin = productPrice(c, pr.id) - (aInv.income[season] || 0);
    } else if (pr.input === 'apple') {
      const crop = getCrop('apple');
      if (!crop.fruitSeasons.includes(season)) continue;
      const adult = treePlots(c).length;
      supply = adult / crop.fruitDays;
      const y = appleYield(c);
      margin = productPrice(c, pr.id, y) - crop.sellPrice * (1 + c.fin.priceBonus) * c.rawFactor * y;
    } else {
      const crop = c.crops.find((cr) => cr.id === pr.input);
      if (!crop || !crop.seasons.includes(season)) continue;
      const rate = 1 + (season === 'winter' ? 0 : 0.1 * (c.state.investments.beehive || 0) + c.gt);
      const cycle = Math.ceil(crop.growDays / rate - EPSILON);
      const raw = crop.sellPrice * (1 + c.fin.priceBonus) * c.rawFactor;
      const profit = raw - c.seed(crop) - waterFor(c, crop) * cycle;
      const opportunity = Math.max(0, best.perDay * cycle - profit);
      supply = Infinity;
      margin = productPrice(c, pr.id) - raw - opportunity;
    }
    if (margin > 0 && supply > 0) options.push({ days: pr.days, supply, margin });
  }
  options.sort((a, b) => b.margin / b.days - a.margin / a.days);
  let gain = 0;
  for (const o of options) {
    const n = Math.min(o.supply, capacity / o.days);
    gain += n * o.margin;
    capacity -= n * o.days;
    if (capacity <= EPSILON) break;
  }
  return gain;
}

/** Épreuves du concours encore à réussir (niveau 12, avant le jour limite). */
function contestOpen(c) {
  const k = c.q.contest();
  if (!k || k.awarded || k.daysLeft < 3) return null;
  return Object.fromEntries(k.goals.map((g) => [g.id, g]));
}

/** Bonus de valeur d'un achat qui aide à réussir une épreuve du concours. */
function contestBonus(c, id) {
  const goals = contestOpen(c);
  if (!goals) return 0;
  const prize = c.q.contest().prizePerGoal;
  const has = (x) => (c.state.investments[x] || 0) > 0;
  let bonus = 0;
  if (id === 'dairy' && !has('dairy') && !goals.cheese.done && (has('cow') || has('goat'))) bonus += prize;
  if ((id === 'goat' || id === 'cow') && !has('goat') && !has('cow') && !goals.cheese.done) bonus += prize * 0.5;
  if ((id === 'jamWorkshop' || id === 'mill' || id === 'dairy') && !goals.terroir.done) {
    const shops = ['jamWorkshop', 'mill', 'dairy'].filter(has).length;
    if (!has(id) && shops < 2) bonus += prize * 0.5;
  }
  return bonus;
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
    const now = seasonCropModel(c, season, { hives, priceBonus: bonus });
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
      const more = seasonCropModel(c, season, { hives: hives + 1, priceBonus: bonus });
      value += (more.perDay - now.perDay) * plots * eff;
    }
    if (inv.effects.priceBonus) value += inv.effects.priceBonus * now.revenue * plots * eff;
    if (inv.effects.waterPlots && Number.isFinite(CLICKS)) {
      // L'arrosage automatique ne vaut quelque chose que pour un joueur limité en clics.
      value += 0.3 * Math.min(plots, inv.effects.waterPlots[n] ?? 0);
    }
    // v3 : ateliers (gain du niveau suivant), lait transformé, pollinisation.
    if (inv.effects.processing) value += (workshopGain(c, inv, n + 1, season) - workshopGain(c, inv, n, season)) * eff;
    if (inv.effects.milk && state.processing?.dairy) {
      const dairy = getInvestment('dairy');
      const L = state.investments.dairy || 0;
      value += (workshopGain(c, dairy, L, season, { [id]: 1 }) - workshopGain(c, dairy, L, season)) * eff;
    }
    if (inv.effects.growthBonus && hives === 0 && level.modifiers.pollination) {
      const apple = getCrop('apple');
      if (apple.fruitSeasons.includes(season)) value += (treePlots(c).length / apple.fruitDays) * apple.sellPrice * 0.5 * (1 + bonus) * eff;
    }
  }
  return value + contestBonus(c, id);
}

function purchaseCost(c, id) {
  if (id === 'plot') {
    const idx = c.state.plots.findIndex((p) => !p.unlocked);
    return idx >= 0 ? c.q.plot(idx).unlockCost : null;
  }
  return c.q.investments().find((x) => x.id === id)?.nextCost ?? null;
}

/** L'achat est-il possible en principe (condition « il faut d'abord une vache ou une chèvre ») ? */
function requirementMet(c, id) {
  const inv = id === 'plot' ? null : getInvestment(id);
  return !inv?.requiresAny || inv.requiresAny.some((x) => (c.state.investments[x] || 0) > 0);
}

/** Prix attendu d'une récolte (prix de base × étal × fatigue ; sur le marché fou, cours moyen ≈ 1). */
function expectedPrice(c, crop, fatigue) {
  const f = fatigue ? 1 - c.level.modifiers.soilFatigue : 1;
  return crop.sellPrice * (1 + c.fin.priceBonus) * c.rawFactor * f;
}

/**
 * v3 : l'atelier prendra-t-il cette récolte ? Estimation : l'atelier possédé et allumé qui la transforme
 * peut absorber (places / jours) récoltes par jour ; on accepte tant que les parcelles de cette culture
 * déjà semées n'ont pas de quoi le remplir sur un cycle.
 */
function processingPrice(c, option, plotIndex) {
  const product = option.product;
  if (!product || !product.owned) return null;
  const b = c.state.processing?.[product.buildingId];
  if (!b || !b.on) return null;
  const growing = c.state.plots.filter((p, i) => i !== plotIndex && p.cropId === option.id).length;
  const perDay = b.places.length / product.days;
  if (growing >= perDay * option.daysToMature * 0.9) return null;
  return product.value;
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
    if (p.kind === 'tree') {
      // Pommier : le panier mûr, ou celui qui mûrira avant le fermage.
      if (p.mature) harvest += p.harvestValue;
      else if (p.tree.fruitDaysLeft !== null && p.tree.fruitDaysLeft <= d) harvest += expectedPrice(c, getCrop('apple'), false) * appleYield(c);
      continue;
    }
    if (p.mature) {
      harvest += p.harvestValue;
      continue;
    }
    water += level.modifiers.waterCost * Math.min(p.daysLeft, d + 1) * (p.needsWater || !getCrop(p.cropId).dryGrowth ? 1 : 0);
    // Marché fou : on compte prudemment sur un cours bas.
    const prudence = level.modifiers.priceVolatility ? 0.7 : 1;
    if (p.daysLeft <= d && !p.willFreeze) harvest += prudence * expectedPrice(c, getCrop(p.cropId), p.fatigue);
  }
  // v3 : produits en cours (vendus à l'aube s'ils sont prêts avant le fermage, sinon en l'état au pire).
  if (fin.processingRawValue > 0) {
    for (const b of q.processing()) for (const pl of b.places) if (pl) harvest += pl.daysLeft <= d ? pl.value : pl.rawValue;
  }
  // Mensualités jusqu'à l'aube qui suit le fermage comprise (elle tombe avant la première récolte).
  let loans = 0;
  for (let k = 1; k <= d + 1; k++) if (loanDueOn(level, cal.day + k)) loans += level.modifiers.loan.payment;
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
    if (p.cropId && !p.mature && p.kind !== 'tree' && (getCrop(p.cropId).dryGrowth ?? 0.5) < 1) w += level.modifiers.waterCost * p.daysLeft;
  }
  return w;
}

/** Fonds de roulement : de quoi replanter une bonne partie du champ (saison en cours ou suivante). */
function workingCapital(c, factor = 0.6) {
  const si = c.cal.daysLeftInSeason <= 1 ? Math.min(3, c.cal.seasonIndex + 1) : c.cal.seasonIndex;
  const season = SEASONS[si];
  const seeds = c.crops.filter((cr) => cr.seasons.includes(season)).map((cr) => c.seed(cr));
  const avg = seeds.length ? seeds.reduce((a, b) => a + b, 0) / seeds.length : 0;
  return Math.round((unlockedPlots(c.state) - treePlots(c).length) * avg * factor);
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
    if (smartMarket && level.modifiers.priceVolatility && p.kind !== 'tree') {
      // Marché fou : on garde sur pied tant que le cours est bas, sauf urgence.
      const mult = state.market[p.cropId];
      const crop = getCrop(p.cropId);
      const lastChance =
        cal.day >= cal.totalDays || (!crop.frostHardy && SEASONS[cal.seasonIndex] === 'autumn' && cal.daysLeftInSeason === 0);
      // Le jour du fermage (et la veille), on vend tout pour être sûr de payer.
      const billSoon = cal.daysLeftInSeason <= 1;
      // Garder un jour de plus rapporte en moyenne prix × (1 − cours) × rappel vers 1 ; cela coûte
      // un jour de parcelle occupée (profit quotidien de la meilleure culture du moment).
      const expectedGain = crop.sellPrice * (1 + c.fin.priceBonus) * (1 - mult) * MARKET.meanReversion;
      const plotDay = seasonCropModel(c, SEASONS[cal.seasonIndex], { priceBonus: c.fin.priceBonus }).perDay;
      if (mult < OPT_HOLD && expectedGain > plotDay && !lastChance && !billSoon) continue;
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
 * Plante les parcelles vides (jamais d'arbre ici : voir plantTrees).
 * @param {'cheap'|'best'} mode
 * @param {boolean} careful  évite le gel et la fin d'année, garde la réserve du fermage et l'argent de l'arrosage
 */
function plantAll(game, budget, mode, careful) {
  const n = game.state.plots.length;
  for (let i = 0; i < n; i++) {
    const c = ctx(game);
    const p = c.q.plot(i);
    if (p.action !== 'plant') continue;
    let options = c.q.plantableCrops(i).filter((o) => o.canAfford && o.kind !== 'tree');
    const water = (o) => waterFor(c, getCrop(o.id));
    if (careful) {
      const left = c.cal.totalDays - c.cal.day;
      const res = reserve(c);
      const committed = committedWater(c);
      options = options.filter((o) => {
        if (o.willFreeze || o.daysToMature > left) return false;
        // Il faut pouvoir payer la graine, son arrosage et les charges nettes jusqu'à la récolte.
        const upkeep = Math.max(0, c.fin.dailyCharges - c.fin.dailyIncome) * Math.min(o.daysToMature, c.cal.daysLeftInSeason);
        const cash = c.state.money - o.seedCost - water(o) * o.daysToMature - committed - upkeep;
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
      // v3 : une récolte qui partira à l'atelier vaut le prix du produit.
      const price = (o) => processingPrice(c, o, i) ?? expectedPrice(c, getCrop(o.id), o.fatigue);
      const profit = (o) => price(o) - o.seedCost - water(o) * o.daysToMature;
      const perDay = (o) => profit(o) / o.daysToMature;
      // Peu d'argent : on privilégie le rendement du capital (cultures bon marché et rapides).
      const empty = c.state.plots.filter((pl) => pl.unlocked && !pl.cropId).length;
      const top = options.reduce((a, b) => (perDay(b) > perDay(a) ? b : a));
      const tight = c.state.money < empty * top.seedCost;
      const score = tight ? (o) => perDay(o) / (o.seedCost + water(o) * o.daysToMature) : perDay;
      pick = options.reduce((a, b) => (score(b) > score(a) ? b : a));
      if (profit(pick) <= 0) continue;
    }
    if (!click(budget)) return;
    game.actions.plant(i, pick.id);
  }
}

/**
 * v3 : plante des pommiers sur des parcelles vides.
 * @param {number} maxShare    part maximale des parcelles ouvertes occupée par des arbres
 * @param {number} minBaskets  paniers attendus d'ici la fin de l'année, au minimum
 * @param {boolean} springOnly seulement au printemps
 * @param {boolean} weigh      compare à ce que rapporterait la parcelle en cultures (optimal)
 */
function plantTrees(game, budget, { maxShare, minBaskets, springOnly, weigh }) {
  for (let guard = 0; guard < 24; guard++) {
    const c = ctx(game);
    if (springOnly && c.cal.seasonId !== 'spring') return;
    const offer = c.q.plantableCrops().find((o) => o.kind === 'tree');
    if (!offer || !offer.canAfford) return;
    const baskets = offer.tree.harvestsBeforeYearEnd;
    if (baskets < minBaskets) return;
    const cap = Math.floor(unlockedPlots(c.state) * maxShare);
    if (treePlots(c).length >= cap) return;
    const i = c.state.plots.findIndex((p) => p.unlocked && !p.cropId);
    if (i < 0) return;
    // Jus de pomme : atelier possédé, ou proposé par le niveau (le robot compte l'acheter : moitié-moitié).
    const juice = offer.product ? (offer.product.owned ? offer.product.value : (offer.product.value + offer.tree.basketPrice) / 2) : null;
    const basket = juice ?? offer.tree.basketPrice;
    const gain = baskets * basket - offer.seedCost;
    if (weigh) {
      // La parcelle aurait porté des cultures toute l'année (valeur d'une parcelle achetée).
      if (gain < purchaseValue(c, 'plot') * 1.1) return;
    } else if (gain <= 0) return;
    if (c.state.money - offer.seedCost < reserve(c) + committedWater(c) + workingCapital(c, 0.4)) return;
    if (!click(budget)) return;
    if (!game.actions.plant(i, offer.id).ok) return;
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
  return ['plot', ...ids].filter((id) => purchaseCost(c, id) != null && requirementMet(c, id));
}

// ── Stratégies ─────────────────────────────────────────────────────────────────────────

// v3 : les ateliers juste après le premier poulailler, la chèvre à côté de la vache (absents des
// niveaux 1 à 8 : sautés, l'ordre d'origine est inchangé).
const BALANCED_ORDER = [
  'chickenCoop', 'jamWorkshop', 'mill', 'goat', 'dairy', 'plot', 'plot', 'roadsideStand', 'beehive', 'plot', 'chickenCoop', 'sheep', 'plot', 'cow',
  'goat', 'plot', 'beehive', 'solarPanel', 'plot', 'chickenCoop', 'sheep', 'guestHouse', 'plot', 'plot', 'plot', 'plot',
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
      if (!requirementMet(c, id)) continue;
      if (purchaseValue(c, id) < cost * 1.1) continue;
      if (!tryBuy(game, id, 20)) break; // pas les moyens : on attend
    }
    plantTrees(game, budget, { maxShare: 0.25, minBaskets: 3, springOnly: true, weigh: true });
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
        .filter((x) => x.nextCost != null && x.id !== 'sprinkler' && requirementMet(c, x.id) && purchaseValue(c, x.id) > x.nextCost);
      const daily = (x) =>
        (x.income - x.upkeep + (x.effects.shearing ? x.effects.shearing / 7 : 0) + (x.effects.chargeReduction || 0) + 3 + (x.processing ? 8 : 0)) / x.nextCost;
      invs.sort((a, b) => daily(b) - daily(a));
      if (!invs.some((inv) => tryBuy(game, inv.id, 0, true, 0.3))) break;
    }
    plantTrees(game, budget, { maxShare: 0.25, minBaskets: 2, springOnly: false, weigh: true });
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
    plantTrees(game, budget, { maxShare: 0.34, minBaskets: 3, springOnly: false, weigh: true });
    waterAll(game, budget);
    plantAll(game, budget, 'best', true);
    waterAll(game, budget);
  },
};

// ── Boucle de simulation ────────────────────────────────────────────────────────────────

/**
 * Joue une partie. Renvoie { win, money, stars, summary, seasonId?, income, contest }.
 * income : revenus par origine { crops, apples, products, investments, contest, raw, refund, total } (disjoints),
 *   et, pour les parts, trees = pommes vendues brutes + jus, milk = lait vendu + fromages.
 */
export function playOne(levelId, seed, strategy, perks = {}) {
  const game = createGame({ levelId, seed, perks });
  const total = game.query.calendar().totalDays;
  let result = null;
  // Sources disjointes (crops, apples, products, investments, contest, raw, refund) ; trees et milk
  // regroupent pour les parts : pommes brutes + jus ; lait vendu + fromages.
  const income = { crops: 0, apples: 0, products: 0, investments: 0, contest: 0, raw: 0, refund: 0, trees: 0, milk: 0 };
  let contest = null;
  game.on('harvested', (e) => {
    if (e.tree) {
      income.apples += e.amount;
      income.trees += e.amount;
    } else income.crops += e.amount;
  });
  game.on('productSold', (e) => {
    income.products += e.amount;
    if (e.productId === 'appleJuice') income.trees += e.amount;
    if (e.productId === 'cowCheese' || e.productId === 'goatCheese') income.milk += e.amount;
  });
  game.on('dawn', (e) => {
    for (const i of e.incomes) {
      if (i.kind === 'daily' || i.kind === 'shearing') {
        income.investments += i.amount;
        if (i.source === 'cow' || i.source === 'goat') income.milk += i.amount;
      } else if (i.kind === 'refund') income.refund += i.amount;
    }
  });
  game.on('processingSoldRaw', (e) => (income.raw += e.amount));
  game.on('contestAwarded', (e) => {
    income.contest += e.amount;
    contest = { amount: e.amount, goalsMet: e.goalsMet.length };
  });
  game.on('victory', (e) => (result = { win: true, money: e.money, stars: e.stars, summary: e.summary }));
  game.on('bankrupt', (e) => (result = { win: false, money: e.money, stars: 0, seasonId: e.seasonId, summary: e.summary }));
  for (let day = 0; day <= total && game.state.status === 'playing'; day++) {
    const before = game.state.money;
    STRATEGIES[strategy](game);
    if (TRACE) traceDay(game, before);
    game.update(DAY_SECONDS);
  }
  if (!result) throw new Error(`Partie non terminée (niveau ${levelId}, graine ${seed})`);
  income.total = income.crops + income.apples + income.products + income.investments + income.contest + income.raw + income.refund;
  return { ...result, income, contest };
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
  const proc = game.query
    .processing()
    .map((b) => `${b.buildingId}[${b.places.map((p) => (p ? p.productId[0] + p.daysLeft : '·')).join('')}]`)
    .join(' ');
  console.log(
    `J${String(cal.day).padStart(2)} ${cal.seasonId.padEnd(6)} ${String(st.weather.today).padEnd(8)} ${String(before).padStart(5)} → ${String(st.money).padStart(5)}  parcelles ${unlockedPlots(st)}  ${JSON.stringify(crops)}  ${inv}  ${proc}`,
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
  const r = playOne(levelId, TRACE_SEED, strategy, resolvePerks(PERKS_ARG));
  console.log(r.win ? `Victoire : ${r.money} pièces, ${r.stars} étoile(s)` : `Faillite (${r.seasonId}) : ${r.money} pièces`);
  console.log(`Revenus : ${JSON.stringify(r.income)}${r.contest ? `  concours : ${JSON.stringify(r.contest)}` : ''}`);
  if (VERBOSE) console.log(JSON.stringify(r.summary, null, 1));
}

function selectedLevels() {
  if (LEVELS_RANGE) {
    const [a, b] = String(LEVELS_RANGE).split('-').map(Number);
    return LEVELS.filter((l) => l.id >= a && l.id <= (b || a));
  }
  return LEVELS.filter((l) => !LEVEL_FILTER || String(l.id) === String(LEVEL_FILTER));
}

/** Statistiques d'un niveau pour une stratégie. */
function simulateRow(level, strategy, perks) {
  const results = [];
  for (let seed = 1; seed <= SEEDS; seed++) results.push(playOne(level.id, seed, strategy, perks));
  const wins = results.filter((r) => r.win);
  const stars = [0, 1, 2, 3].map((s) => results.filter((r) => r.stars === s).length);
  const lossSeasons = {};
  for (const r of results) if (!r.win) lossSeasons[r.seasonId] = (lossSeasons[r.seasonId] || 0) + 1;
  const inv = {};
  for (const r of results) for (const [k, v] of Object.entries(r.summary.investments)) inv[k] = (inv[k] || 0) + v;
  const sum = (k) => results.reduce((s, r) => s + r.income[k], 0);
  const totalIncome = sum('total') || 1;
  return {
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
    // v3 : part du revenu par origine, prix du concours.
    share: {
      products: sum('products') / totalIncome,
      trees: sum('trees') / totalIncome,
      milk: sum('milk') / totalIncome,
    },
    contest: level.contest
      ? {
          avgPrize: Math.round(results.reduce((s, r) => s + (r.contest?.amount || 0), 0) / results.length),
          twoGoals: results.filter((r) => (r.contest?.goalsMet || 0) >= 2).length / results.length,
        }
      : null,
  };
}

export function simulate(levels, strategies, perks) {
  return levels.map((level) => ({
    level: level.id,
    name: level.name,
    thresholds: level.starThresholds,
    rows: strategies.map((s) => simulateRow(level, s, perks)),
  }));
}

function printTable(out, title) {
  console.log(`${title}\n`);
  for (const lv of out) {
    console.log(`Niveau ${lv.level} — ${lv.name}   (★★ ≥ ${lv.thresholds[0]}, ★★★ ≥ ${lv.thresholds[1]})`);
    console.log('  stratégie  victoires  argent médian  (si victoire)   faillite / ★ / ★★ / ★★★   produits arbres lait   faillites par saison');
    for (const r of lv.rows) {
      const st = r.stars.map((n) => pct(n, SEEDS).padStart(4)).join(' ');
      const losses = Object.entries(r.lossSeasons)
        .map(([s, n]) => `${s}:${n}`)
        .join(' ');
      const share = ['products', 'trees', 'milk'].map((k) => pct(r.share[k] * 100, 100).padStart(5)).join(' ');
      const contest = r.contest ? `  concours ${r.contest.avgPrize} (≥ 2 épreuves : ${pct(r.contest.twoGoals * 100, 100)})` : '';
      console.log(
        `  ${r.strategy.padEnd(10)} ${pct(r.winRate * SEEDS, SEEDS).padStart(8)}  ${String(r.medianMoney).padStart(12)}  ${String(r.medianWinMoney ?? '—').padStart(12)}   ${st}   ${share}   ${losses}${contest}`,
      );
      if (VERBOSE) console.log(`             achats moyens : ${JSON.stringify(r.avgInvestments)}  parcelles (pièces) : ${r.avgPlotsSpent}`);
    }
    console.log('');
  }
}

function printCompare(none, all) {
  console.log(`Comparaison sans bonus / avec tous les bonus : ${SEEDS} graines par niveau et par stratégie\n`);
  console.log('niveau  stratégie   victoires (sans → avec)   argent médian (sans → avec, écart)   ★★★ (sans → avec)');
  none.forEach((lv, k) => {
    lv.rows.forEach((r, j) => {
      const a = all[k].rows[j];
      const delta = r.medianMoney ? Math.round((100 * (a.medianMoney - r.medianMoney)) / Math.abs(r.medianMoney)) : 0;
      console.log(
        `${String(lv.level).padStart(4)}    ${r.strategy.padEnd(10)}  ${pct(r.winRate * 100, 100).padStart(5)} → ${pct(a.winRate * 100, 100).padStart(5)}          ${String(r.medianMoney).padStart(6)} → ${String(a.medianMoney).padStart(6)}  (${delta >= 0 ? '+' : ''}${delta} %)            ${pct(r.stars[3], SEEDS).padStart(4)} → ${pct(a.stars[3], SEEDS).padStart(4)}`,
      );
    });
  });
}

function run() {
  const levels = selectedLevels();
  const strategies = Object.keys(STRATEGIES).filter((s) => !STRATEGY_FILTER || s === STRATEGY_FILTER);
  if (COMPARE) {
    const none = simulate(levels, strategies, {});
    const all = simulate(levels, strategies, resolvePerks('all'));
    if (JSON_OUT) console.log(JSON.stringify({ none, all }, null, 2));
    else printCompare(none, all);
    return;
  }
  const perks = resolvePerks(PERKS_ARG);
  const out = simulate(levels, strategies, perks);
  if (JSON_OUT) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const perkText = Object.keys(perks).length ? `, bonus : ${PERKS_ARG}` : '';
  printTable(out, `Simulation : ${SEEDS} graines par niveau et par stratégie${Number.isFinite(CLICKS) ? `, ${CLICKS} actions/jour` : ''}${perkText}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (TRACE) runTrace();
  else run();
}

/** Débogage : valeur attendue et prix de chaque achat possible maintenant. */
export function debugPurchases(game) {
  const c = ctx(game);
  return candidates(c).map((id) => ({ id, cost: purchaseCost(c, id), value: Math.round(purchaseValue(c, id)), reserve: Math.round(reserve(c)), capital: workingCapital(c, OPT_CAPITAL) }));
}
