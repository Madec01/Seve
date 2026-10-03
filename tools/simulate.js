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
//   node tools/simulate.js --difficulty classique   mode de difficulté (detente par défaut ; classique = v3)
//   node tools/simulate.js --compare-modes      tableau des victoires côte à côte : détente / classique
//   node tools/simulate.js --surprises off      (lot 2) sans les surprises (qualité, géants, fée, météos spéciales…) ;
//                                               défaut : celui du mode (détente : avec, classique : sans)
//   node tools/simulate.js --compare-surprises  (lot 2) tableau côte à côte : sans / avec les surprises (revenus, ★)
//   node tools/simulate.js --variety off        (lot 3) sans la variété (tableau, cadeaux, charrette, défis, colporteur) ;
//                                               --variety board,cards : seulement ces parties ; défaut : celui du mode
//   node tools/simulate.js --compare-variety    (lot 3) sans → avec la variété (même graine, surprises actives des deux côtés) :
//                                               revenu, argent final, victoires, ★★★ et gain par partie de chaque partie du lot
//   node tools/simulate.js --stars              (lot 3) seuils d'étoiles Détente suggérés (règle du § 13.3 : ★★ = argent final
//                                               médian du joueur tranquille, ★★★ = ses 12 % meilleures parties)
//   node tools/simulate.js --cozy off           (lot 4) sans fêtes, hiver ni lanternes (--cozy fetes,winter : seulement ces
//                                               parties) ; défaut : celui du mode (détente : avec, classique : sans)
//   node tools/simulate.js --compare-cozy       (lot 4) sans → avec (même graine ; surprises et variété actives des deux
//                                               côtés) : revenu, argent final, victoires, ★★★, gains des fêtes et de l'hiver, écus
//   node tools/simulate.js --lanterns           (lot 4) répartition 1 / 2 / 3 / 4 lanternes par critère et total médian, par robot
//
// Les robots passent uniquement par l'API publique du jeu (actions / query), comme l'interface.
// Chaque jour, juste après l'aube, ils récoltent, achètent, plantent et arrosent, puis la journée s'écoule.
//
// Stratégies (robots « parfaits » : chaque parcelle arrosée, récoltée, replantée chaque jour) :
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
// Joueurs humains simulés (voir « Joueurs humains simulés » plus bas) :
//   casual    : joueur tranquille à ×1 sur téléphone (arrose 50 à 70 % des parcelles, récolte parfois
//               un jour en retard, choisit ses graines un peu au hasard, suit le tutoriel).
//   novice    : débutant (arrose 20 à 40 %, carottes et navets, achète sans regarder le fermage).
//   idle      : sème une fois le 1er jour puis ne fait plus rien (doit faire faillite).
// Variété (lot 3, § 16.10 du game design) : le casual regarde le tableau un jour sur deux, garde une commande sur deux
//   quand il peut la semer, pondère son « semer partout » × 2 vers les cultures demandées, choisit une carte au hasard,
//   garde 2 défis au hasard, achète un sachet de graines rares 40 % du temps s'il a la marge (et sème ses graines rares) ;
//   le novice ne garde rien, prend la première carte, ignore les défis, achète au colporteur 20 % du temps ; l'optimal
//   choisit au mieux (carte, défis, commandes faisables, graines rares) ; careless / balanced / investor : première carte,
//   deux premiers défis, rien au colporteur. Tout passe par l'API publique, avec le tirage propre au joueur.
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
import { levelFor } from '../src/data/difficulty.js';
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
const COMPARE_MODES = !!arg('compare-modes', false);
const DIFFICULTY = String(arg('difficulty', 'detente'));
const SURPRISES_ARG = arg('surprises', null);
const SURPRISES = SURPRISES_ARG === null ? undefined : !['off', 'false', '0', 'non'].includes(String(SURPRISES_ARG));
const COMPARE_SURPRISES = !!arg('compare-surprises', false);
const VARIETY_ARG = arg('variety', null);
const VARIETY = VARIETY_ARG === null ? undefined : parseVariety(VARIETY_ARG);
const COMPARE_VARIETY = !!arg('compare-variety', false);
const STARS = !!arg('stars', false);
const COZY_ARG = arg('cozy', null);
const COZY = COZY_ARG === null ? undefined : parseCozy(COZY_ARG);
const COMPARE_COZY = !!arg('compare-cozy', false);
const LANTERNS = !!arg('lanterns', false);

/** --cozy : 'off' → false, 'on' → true, 'fetes,winter' → { fetes: true, winter: true, … autres : false }. */
export function parseCozy(v) {
  const t = String(v);
  if (['off', 'false', '0', 'non'].includes(t)) return false;
  if (['on', 'true', '1', 'oui'].includes(t)) return true;
  const want = t.split(',').map((x) => x.trim()).filter(Boolean);
  return Object.fromEntries(['lanterns', 'fetes', 'winter', 'helpers'].map((k) => [k, want.includes(k)]));
}

/** --variety : 'off' → false, 'on' → true, 'board,cards' → { board: true, cards: true, … autres : false }. */
export function parseVariety(v) {
  const t = String(v);
  if (['off', 'false', '0', 'non'].includes(t)) return false;
  if (['on', 'true', '1', 'oui'].includes(t)) return true;
  const want = t.split(',').map((x) => x.trim()).filter(Boolean);
  return Object.fromEntries(['board', 'cards', 'cart', 'challenges', 'merchant', 'themes'].map((k) => [k, want.includes(k)]));
}
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
    rawFactor: level.modifiers.rawPriceFactor * (level.cropPriceFactor ?? 1),
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

/**
 * Arrosage payant (niveau sécheresse) : une parcelle de plus ne sert que si l'on peut encore semer ET
 * arroser jusqu'à la récolte toutes les parcelles vides (celle-ci comprise) avec l'argent qui reste.
 * Sans ce garde-fou, un peu d'argent en plus (« Bas de laine », parcelles moins chères) faisait acheter
 * des parcelles trop tôt : champ à moitié semé faute d'argent, année finie plus bas.
 */
function canFarmMorePlots(c, moneyLeft) {
  if (!c.level.modifiers.waterCost) return true;
  // Saison en cours et suivante : les semis de la saison suivante (été : tomates, maïs) coûtent souvent plus.
  let perPlot = 0;
  for (const si of [c.cal.seasonIndex, Math.min(3, c.cal.seasonIndex + 1)]) {
    const model = seasonCropModel(c, SEASONS[si]);
    const best = model.id ? c.crops.find((cr) => cr.id === model.id) : null;
    if (best) perPlot = Math.max(perPlot, c.seed(best) + waterFor(c, best) * model.cycle);
  }
  const empty = c.state.plots.filter((p) => p.unlocked && !p.cropId).length + 1;
  return moneyLeft >= empty * perPlot;
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
    // v3 : pomme de terre un jour de canicule (arrosage payant) : elle pousse quand même à moitié ;
    // on n'arrose pas si l'arrosage entamerait la réserve du fermage.
    if (skipOptionalWater(game, i)) continue;
    if (!click(budget)) return;
    if (!game.actions.water(i).ok) return;
  }
}

/** Arrosage facultatif (culture qui pousse aussi sans eau) qui ferait passer sous la réserve du fermage. */
function skipOptionalWater(game, i) {
  const c = ctx(game);
  const crop = getCrop(c.state.plots[i].cropId);
  if (!crop || (crop.dryGrowth ?? 0.5) < 1 || !c.level.modifiers.waterCost) return false;
  return c.state.money - c.level.modifiers.waterCost < reserve(c) + committedWater(c);
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


// ── Joueurs humains simulés (casual, novice, idle) ─────────────────────────────────────
//
// Les robots ci-dessus jouent parfaitement : chaque parcelle arrosée, récoltée et replantée chaque
// jour. Un vrai joueur, sur téléphone, à ×1 (20 s par jour), n'y arrive pas. Ces modèles imitent
// un joueur tranquille, avec leur propre tirage (déterministe : graine × niveau × stratégie), sans
// jamais toucher aux tirages du jeu :
//   - un budget de gestes par jour (glisser pour arroser / récolter coûte peu, « semer partout » 3 gestes) ;
//   - certains jours, on ne fait rien (distrait, menus, on regarde la ferme) ;
//   - arrosage partiel (une part tirée chaque jour des parcelles qui en ont besoin) ;
//   - récolte en retard d'un jour (ou deux pour le novice), replantation parfois en retard ;
//   - cultures choisies un peu au hasard parmi celles qu'on peut payer, surtout les pas chères et
//     rapides (le novice : carottes et navets, sinon la moins chère) ; « semer partout » ;
//   - niveau 1 : le tutoriel (une seule carotte le 1er jour, puis le poulailler conseillé dès qu'on
//     a 70 pièces, parfois trop tôt) ; ailleurs, une liste d'envies d'achats (poulailler d'abord,
//     puis ce que suggère la description du niveau), sans calcul de rentabilité ;
//   - aucune prévision météo ; le casual regarde souvent la couleur du fermage (n'achète rien qui la
//     ferait passer au rouge, garde de quoi payer les 3 derniers jours), le novice jamais (il peut
//     acheter juste avant le fermage).
//   idle : sème une fois le 1er jour, puis ne fait plus rien (la faillite doit rester possible).

export const HUMAN_PROFILES = {
  casual: {
    skipDay: 0.1, // jour sans rien faire
    taps: [7, 11], // gestes par jour
    harvestProb: 0.7, // récolte le jour même (sinon le lendemain, sûr)
    maxDelay: 1,
    plantProb: 0.75, // replante les parcelles vides ce jour-là
    water: [0.5, 0.7], // part des parcelles arrosées
    avoidFreeze: 0.8, // tient compte du gel annoncé
    rentAware: 0.7, // regarde le fermage : n'achète pas s'il le met en danger ; garde de quoi le payer les 3 derniers jours
    buyProb: 0.5, // regarde la boutique ce jour-là
    buyBuffer: [0, 40], // argent gardé après un achat
    tutorialCoop: 0.8, // achète le poulailler conseillé par le tutoriel dès 70 pièces
    plotProb: 0.08, // achète une parcelle (s'il reste de quoi)
    cropBias: 'cheapFast',
    // (lot 3) Variété
    boardLook: 0.5, // regarde le tableau un jour sur deux
    keepOrder: 0.25, // garde à la main une commande sur quatre qu'il peut semer (QA du lot 3 : semer sa culture la garde d'office)
    requestBias: 2, // « semer partout » : × 2 vers les cultures demandées
    cardPick: 'random',
    challengePick: 'random',
    rareBuy: 0.4, // achète un sachet de graines rares s'il a la marge
    merchantAny: 0,
    cozy: null, // (lot 4) COZY_STYLES.casual (posé plus bas)
  },
  novice: {
    skipDay: 0.15,
    taps: [4, 8],
    harvestProb: 0.5,
    maxDelay: 2,
    plantProb: 0.6,
    water: [0.2, 0.4],
    avoidFreeze: 0.3,
    rentAware: 0,
    buyProb: 0.6,
    buyBuffer: [0, 0],
    tutorialCoop: 1,
    plotProb: 0,
    cropBias: 'starter',
    wishes: 'novice',
    // (lot 3) Variété : ne garde rien, première carte, ignore les défis, achète au colporteur 20 % du temps.
    boardLook: 0,
    keepOrder: 0,
    requestBias: 1,
    cardPick: 'first',
    challengePick: 'none',
    rareBuy: 0,
    merchantAny: 0.2,
    cozy: null, // (lot 4) COZY_STYLES.novice (posé plus bas)
  },
};

// ── Variété (lot 3) : décisions des joueurs simulés ─────────────────────────────────────

/** Valeur estimée d'une carte (choix de l'optimal). */
function cardScore(game, card) {
  const fin = game.query.finance();
  switch (card.id) {
    case 'purse':
      return card.value || 25;
    case 'bees':
      return 55;
    case 'clearing':
      return 35;
    case 'landlord':
      return Math.round(fin.nextBill.amount * 0.2);
    case 'cartHorse':
      return (game.query.cart()?.premiumFull || 60) * 0.5;
    case 'seedBag':
      return 40;
    case 'hen':
      return 28;
    case 'fertilizer':
      return 26;
    case 'poster':
      return 18;
    case 'recipe':
      return game.query.processing().length ? 22 : 0;
    case 'seedFair':
      return 15;
    case 'watering':
      return 14;
    case 'hay':
      return 14;
    case 'crier':
      return 12;
    case 'clover':
      return 8;
    default:
      return 4;
  }
}

/** Ordre de préférence des défis (optimal : les plus sûrs d'abord). */
const CHALLENGE_PREF = ['harvests', 'orders', 'sales', 'crates', 'variety', 'sowing', 'products', 'animals', 'care', 'apples', 'quality', 'collect'];

/** Cadeau de la saison et défis (fenêtre de fin de saison) : le joueur choisit, sans geste compté. */
export function varietyChoices(game, me, style) {
  const q = game.query;
  if (!q.variety || !game.state.variety) return;
  const cards = q.cards();
  if (cards?.offer && style.cardPick !== 'none') {
    const opts = cards.offer.options;
    let pick = opts[0];
    if (style.cardPick === 'random') pick = opts[Math.floor(me.rnd() * opts.length)];
    else if (style.cardPick === 'best') pick = opts.reduce((a, b) => (cardScore(game, b) > cardScore(game, a) ? b : a));
    if (!game.actions.pickCard(pick.id).ok) {
      const other = opts.find((o) => o.id !== pick.id);
      if (other) game.actions.pickCard(other.id);
    }
  }
  const ch = q.challenges();
  if (ch && ch.options.length && ch.kept.length === 0 && style.challengePick !== 'none' && me.challengeSeason !== ch.season) {
    me.challengeSeason = ch.season;
    let ids = ch.options.map((o) => o.id);
    if (style.challengePick === 'random') {
      ids = [...ids];
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(me.rnd() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    } else if (style.challengePick === 'best') ids.sort((a, b) => CHALLENGE_PREF.indexOf(a) - CHALLENGE_PREF.indexOf(b));
    for (const id of ids.slice(0, 2)) game.actions.keepChallenge(id);
  }
}

/**
 * Tableau du village et colporteur (gestes d'un jour). spend(n) : gestes ; keep : argent gardé pour le fermage.
 */
export function varietyDay(game, me, style, spend, keep = 0) {
  const q = game.query;
  if (!game.state.variety) return;
  // Tableau : un regard (1 geste), garder les commandes qu'on peut semer.
  if (style.boardLook > 0 && q.orders() && me.rnd() < style.boardLook && spend(1)) {
    const board = q.orders();
    const sowable = new Set(q.plantableCrops().map((o) => o.id));
    // Il retient les cultures demandées (son « semer partout » des deux jours suivants les préfère).
    me.wanted = { day: q.calendar().day, crops: new Set((board?.slots || []).filter((o) => !o.empty).flatMap((o) => o.lines.filter((l) => l.left > 0).map((l) => l.cropId))) };
    for (const o of board?.slots || []) {
      if (o.empty || o.kept) continue;
      const can = o.lines.every((l) => sowable.has(l.cropId) || l.inStock >= l.left);
      if (can && me.rnd() < style.keepOrder) game.actions.keepOrder(o.id, true);
    }
    if (game.mode === 'career') {
      for (const o of q.orders()?.slots || []) if (!o.empty && o.canDeliver) game.actions.deliverOrder(o.id);
      const cart = q.cart();
      if (cart) cart.crates.forEach((c, k) => c.canLoad && game.actions.loadCart(k));
    }
  }
  // Colporteur.
  const m = q.merchant();
  if (m && m.here && me.merchantSeen !== m.arriveDay) {
    me.merchantSeen = m.arriveDay;
    if (style.rareBuy > 0 && me.rnd() < style.rareBuy) {
      const bag = m.stall.find((it) => it.itemId.startsWith('seeds.') && it.canBuy);
      if (bag && game.state.money - bag.price >= keep && spend(1)) game.actions.buyFromMerchant(bag.itemId);
    }
    if (style.merchantAny > 0 && me.rnd() < style.merchantAny) {
      // Le débutant achète un objet au hasard parmi ceux qu'il peut payer (sans regarder le fermage).
      const can = m.stall.filter((x) => x.canBuy);
      const it = can.length ? can[Math.floor(me.rnd() * can.length)] : null;
      if (it && spend(1)) game.actions.buyFromMerchant(it.itemId);
    }
  }
}

/** Sème d'abord les graines rares possédées (de saison, qui ne gèleront pas) sur les parcelles vides. → parcelles semées */
export function sowRare(game, plots) {
  if (!game.state.variety) return 0;
  let n = 0;
  for (const i of plots) {
    if (game.state.plots[i].cropId) continue;
    const rare = game.query.plantableCrops(i).find((o) => o.rare && o.seedsLeft > 0 && !o.willFreeze);
    if (!rare) break;
    if (game.actions.plant(i, rare.id).ok) n++;
  }
  return n;
}

/** Choix « au mieux » de l'optimal : commandes faisables gardées, graines rares achetées si elles rapportent. */
function optimalVariety(game, me) {
  const q = game.query;
  if (!game.state.variety) return;
  const board = q.orders();
  const sowable = new Map(q.plantableCrops().map((o) => [o.id, o]));
  for (const o of board?.slots || []) {
    if (o.empty || o.kept) continue;
    if (o.lines.every((l) => sowable.has(l.cropId) && !sowable.get(l.cropId).willFreeze)) game.actions.keepOrder(o.id, true);
  }
  const m = q.merchant();
  if (m && m.here) {
    for (const it of m.stall) {
      if (!it.canBuy) continue;
      if (it.itemId.startsWith('seeds.')) {
        const crop = q.plantableCrops().find((o) => o.id === it.cropId) || null;
        const days = getCrop(it.cropId).growDays;
        if (q.calendar().daysLeftInSeason < days && it.cropId !== 'leek') continue;
        const value = (crop?.sellPrice || getCrop(it.cropId).sellPrice) * it.seeds;
        if (value > it.price * 1.5 && game.state.money - it.price > 150) game.actions.buyFromMerchant(it.itemId);
      } else if (it.itemId === 'copperCan' && game.state.money - it.price > 250) game.actions.buyFromMerchant(it.itemId);
    }
  }
}

// ── Lot 4 : fêtes participatives et hiver vivant (décisions des joueurs simulés, § 17.8 du game design) ──────
//
// Leur propre tirage (me.cozyRnd), distinct des autres décisions : avec ou sans le lot, le joueur prend exactement les
// mêmes décisions pour le reste (comparaisons --compare-cozy à graine égale). Le mini-jeu met le jeu en pause : pas de
// geste compté. Le tranquille joue une fête sur ses jours de jeu avec 60 % de chances (choix au hasard : 2 légumes,
// 3 à 5 cagettes, paniers au hasard), trouve 5 à 8 œufs, ramasse une trouvaille d'hiver une fois sur deux, remplit la
// mangeoire un jour sur deux, écoute la veillée ; le débutant joue 30 % des fêtes ; l'appliqué joue tout, au mieux.
export const COZY_STYLES = {
  casual: { fete: 0.6, eggs: [5, 8], soup: [2, 2], stand: [3, 5], finds: 0.5, feeder: 0.5, story: 1, pick: 'random', seedFair: 0.5 },
  novice: { fete: 0.3, eggs: [3, 6], soup: [1, 2], stand: [2, 4], finds: 0.3, feeder: 0.3, story: 0.6, pick: 'random', seedFair: 0.3 },
  optimal: { fete: 1, eggs: [8, 8], soup: [3, 3], stand: [5, 6], finds: 1, feeder: 1, story: 1, pick: 'best', seedFair: 1 },
};

/** Décor posé par le joueur simulé (écus des parties précédentes) : critère « beauté » des lanternes. */
export const SIM_DECOR = { casual: { placed: 3, path: false, fence: false }, novice: { placed: 1, path: false, fence: false }, optimal: { placed: 6, path: true, fence: false } };

HUMAN_PROFILES.casual.cozy = COZY_STYLES.casual;
HUMAN_PROFILES.novice.cozy = COZY_STYLES.novice;

function cozyRng(me) {
  if (!me.cozyRnd) me.cozyRnd = humanRng((me.seedBase ?? 1) ^ 0x5bd1e995);
  return me.cozyRnd;
}

function shuffled(rnd, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const itemOf = (c) => ({ kind: c.kind, id: c.id });

/** Points estimés d'un produit au stand (choix de l'appliqué). */
function standGuess(c) {
  return 1 + (c.quality === 'gold' ? 2 : c.quality === 'fine' ? 1 : 0) + (c.giant ? 2 : 0) + (c.homemade ? 1 : 0) + (c.star ? 1 : 0);
}

/** Joue le mini-jeu de la fête du jour (si le joueur y va). → true si joué. */
function playFete(game, me, P, keep = 0) {
  const q = game.query;
  const f = q.fete();
  if (!f || f.done) return false;
  const rnd = cozyRng(me);
  const key = `${game.state.mode === 'career' ? game.state.time.year : 0}/${f.day}`;
  if (me.cozyFete !== key) {
    me.cozyFete = key;
    me.cozyGo = rnd() < P.fete;
  }
  if (!me.cozyGo) return false;
  const between2 = ([a, b]) => Math.round(a + (b - a) * rnd());
  const A = game.actions;
  if (f.engine === 'chasse') {
    if (me.cozyHunted === key) return false;
    me.cozyHunted = key;
    const want = between2(P.eggs);
    const todo = shuffled(rnd, f.hidden.items.filter((h) => !h.found)).slice(0, Math.max(0, want - f.hidden.foundByPlayer));
    for (const h of todo) A.feteFind(h.index);
    return true;
  }
  const choices = f.choices || [];
  if (f.engine === 'marmite') {
    if (!choices.length) return false;
    const n = Math.min(choices.length, between2(P.soup), f.max);
    let pick;
    if (P.pick === 'best') {
      const beau = choices.filter((c) => c.quality !== 'normal' || c.giant);
      pick = [...beau.slice(0, 1), ...choices.filter((c) => !beau.slice(0, 1).includes(c))].slice(0, n);
      if (f.themeId === 'bread' && !pick.some((c) => c.id === 'wheat')) {
        const w = choices.find((c) => c.id === 'wheat');
        if (w) pick = [w, ...pick.filter((c) => c.id !== 'wheat')].slice(0, n);
      }
    } else pick = shuffled(rnd, choices).slice(0, n);
    let r = A.cookSoup(pick.map(itemOf));
    if (!r.ok && choices.some((c) => c.id === 'wheat')) r = A.cookSoup([{ kind: 'crop', id: 'wheat' }]);
    return r.ok;
  }
  if (f.engine === 'etal') {
    if (!choices.length) return false;
    const n = Math.min(choices.length, between2(P.stand), f.max);
    const pick = P.pick === 'best' ? [...choices].sort((a, b) => standGuess(b) - standGuess(a)).slice(0, n) : shuffled(rnd, choices).slice(0, n);
    return A.presentStand(pick.map(itemOf)).ok;
  }
  if (f.engine === 'paniers') {
    if (choices.length < 3) return false;
    let pool = P.pick === 'best' ? [...choices] : shuffled(rnd, choices);
    const baskets = f.villagers.map((v) => {
      const b = [];
      if (P.pick === 'best') {
        for (const like of v.likes) {
          const k = pool.findIndex((c) => c.kind === like.kind && c.id === like.id);
          if (k >= 0 && b.length < 2) b.push(pool.splice(k, 1)[0]);
        }
      }
      return b;
    });
    for (const b of baskets) while (b.length < (P.pick === 'best' ? 2 : 1 + Math.floor(rnd() * 2)) && pool.length) b.push(pool.shift());
    if (baskets.some((b) => !b.length)) return false;
    return A.giveBaskets(baskets.map((b) => b.map(itemOf))).ok;
  }
  if (f.engine === 'foire') {
    // Foire aux graines (carrière) : quelques sachets des cultures de printemps, en gardant de quoi payer les charges.
    const packs = (f.stalls || []).flatMap((st) => st.packs).filter((x) => x.canBuy);
    const want = P.pick === 'best' ? (me.springPlan || []).filter(Boolean) : shuffled(rnd, packs).slice(0, 2).map((x) => x.cropId);
    let bought = 0;
    for (const cropId of want) {
      for (let k = 0; k < (P.pick === 'best' ? 4 : 1 + Math.floor(rnd() * 2)); k++) {
        const pk = (game.query.fete()?.stalls || []).flatMap((st) => st.packs).find((x) => x.cropId === cropId && x.canBuy);
        if (!pk || game.state.money - pk.price < keep) break;
        if (A.buySeedPack(cropId).ok) bought++;
      }
    }
    return bought > 0;
  }
  return false;
}

/**
 * Lot 4 : la journée « douce » d'un joueur simulé (fête du jour, trouvailles d'hiver, mangeoire, veillée). Exportée pour
 * tools/simulate-career.js. P : COZY_STYLES[…] ; spend(n) : gestes (facultatif) ; keep : argent gardé (foire).
 */
export function cozyDay(game, me, P, spend = () => true, keep = 0) {
  if (!game.state.cozy || !P) return;
  const q = game.query;
  playFete(game, me, P, keep);
  const w = q.winter();
  if (!w) return;
  const rnd = cozyRng(me);
  for (const x of w.finds) if (rnd() < P.finds && spend(0.25)) game.actions.pickWinterFind(x.id);
  if (w.feeder.canFill && rnd() < P.feeder && spend(0.25)) game.actions.fillFeeder();
  if (w.story.available && rnd() < P.story) game.actions.hearStory();
}

/**
 * Envies d'achats par niveau : ce que suggère la description du niveau (le novice : surtout des
 * poulaillers, et l'investissement que le niveau met en avant).
 */
const NOVICE_WISHES = {
  default: ['chickenCoop', 'chickenCoop', 'beehive', 'chickenCoop'],
  4: ['chickenCoop', 'cow', 'chickenCoop'],
  9: ['chickenCoop', 'jamWorkshop', 'chickenCoop'],
  10: ['beehive', 'jamWorkshop', 'chickenCoop'],
  11: ['goat', 'chickenCoop', 'dairy'],
  12: ['chickenCoop', 'goat', 'dairy'],
};

const HUMAN_WISHES = {
  default: ['chickenCoop', 'sprinkler', 'beehive', 'sheep', 'chickenCoop', 'cow', 'roadsideStand', 'solarPanel', 'chickenCoop', 'guestHouse'],
  4: ['chickenCoop', 'cow', 'sheep', 'chickenCoop', 'beehive', 'chickenCoop', 'cow'],
  9: ['chickenCoop', 'jamWorkshop', 'beehive', 'sprinkler', 'chickenCoop', 'jamWorkshop', 'sheep'],
  10: ['beehive', 'jamWorkshop', 'chickenCoop', 'goat', 'sprinkler', 'beehive', 'jamWorkshop'],
  11: ['goat', 'chickenCoop', 'dairy', 'goat', 'sprinkler', 'beehive', 'sheep'],
  12: ['chickenCoop', 'goat', 'dairy', 'mill', 'jamWorkshop', 'sprinkler', 'beehive', 'cow'],
};

/** Tirage pseudo-aléatoire propre au joueur simulé (mulberry32). */
function humanRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function humanSeed(levelId, seed, strategy) {
  let h = 2166136261;
  for (const ch of `${levelId}/${seed}/${strategy}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Mémoire du joueur simulé (une par partie). */
export function createHuman(strategy, levelId, seed) {
  const base = humanSeed(levelId, seed, strategy);
  return { rnd: humanRng(base), seedBase: base, matureSince: {}, tutorial: levelId === 1 ? 'plant' : null, wishIndex: 0 };
}

const between = (me, [a, b]) => a + (b - a) * me.rnd();

function humanPickCrop(game, me, profile, plotIndex, budgetMoney) {
  const c = ctx(game);
  const cal = c.cal;
  const avoid = me.rnd() < profile.avoidFreeze;
  let options = c.q.plantableCrops(plotIndex).filter((o) => o.kind !== 'tree' && !o.rare && o.seedCost <= budgetMoney);
  if (avoid) options = options.filter((o) => !o.willFreeze);
  // Personne ne sème le dernier jour de l'année.
  options = options.filter((o) => cal.day < cal.totalDays);
  if (options.length === 0) return null;
  if (profile.cropBias === 'starter') {
    const starters = options.filter((o) => o.id === 'carrot' || o.id === 'turnip');
    if (starters.length) return starters[Math.floor(me.rnd() * starters.length)];
    return options.reduce((a, b) => (b.seedCost < a.seedCost ? b : a));
  }
  // Au hasard, surtout les cultures bon marché et rapides ; un peu plus celles que l'atelier transforme ;
  // (lot 3) × 2 les cultures demandées au tableau ou à la charrette (le casual a regardé le tableau).
  const wanted = me.wanted && me.wanted.day >= cal.day - 1 ? me.wanted.crops : null;
  const weight = (o) => (1 / Math.sqrt(o.seedCost * o.daysToMature)) * (o.product?.owned ? 2 : 1) * (wanted && wanted.has(o.id) && profile.requestBias ? profile.requestBias : 1);
  const total = options.reduce((sum, o) => sum + weight(o), 0);
  let r = me.rnd() * total;
  for (const o of options) {
    r -= weight(o);
    if (r <= 0) return o;
  }
  return options[options.length - 1];
}

/**
 * Argent que le joueur garde de côté pour le fermage (il regarde la couleur du fermage) : pour un
 * achat, toute la saison (il n'achète pas s'il voit le fermage passer au rouge) ; pour semer, seulement
 * les 3 derniers jours.
 */
function humanKeep(game, me, profile, forPurchase = false) {
  const fin = game.query.finance();
  if ((forPurchase || fin.nextBill.daysLeft <= 2) && me.rnd() < profile.rentAware) return fin.nextBill.amount;
  return 0;
}

function humanDay(game, me, profile) {
  const q = game.query;
  const cal = q.calendar();
  let taps = Math.round(between(me, profile.taps));
  const spend = (n) => {
    if (taps < n) return false;
    taps -= n;
    return true;
  };
  // Niveau 1 : tutoriel. Jour 1 : une seule carotte, arrosée.
  if (me.tutorial === 'plant') {
    const i = game.state.plots.findIndex((p) => p.unlocked && !p.cropId);
    game.actions.plant(i, 'carrot');
    if (q.plot(i).action === 'water') game.actions.water(i);
    me.tutorial = 'harvest';
    return;
  }
  // (lot 3) Fenêtre de fin de saison : cadeau et défis (la fenêtre s'ouvre toute seule).
  if (game.state.variety) varietyChoices(game, me, profile);
  if (me.rnd() < profile.skipDay && cal.daysLeftInSeason > 0) return;
  // (lot 4) Fête du jour, trouvailles d'hiver, mangeoire, veillée (tirage propre : rien d'autre ne change).
  if (game.state.cozy) cozyDay(game, me, profile.cozy);

  // Récolte (glisser) : le jour même avec harvestProb, au plus tard après maxDelay jours.
  const toHarvest = [];
  for (let i = 0; i < game.state.plots.length; i++) {
    const p = q.plot(i);
    if (!p.mature) {
      delete me.matureSince[i];
      continue;
    }
    if (me.matureSince[i] === undefined) me.matureSince[i] = cal.day;
    const late = cal.day - me.matureSince[i] >= profile.maxDelay;
    const billNight = profile.rentAware > 0 && cal.daysLeftInSeason === 0;
    if (late || billNight || me.rnd() < profile.harvestProb) toHarvest.push(i);
  }
  if (toHarvest.length && spend(1)) {
    for (const i of toHarvest) {
      if (!spend(0.25)) break;
      if (game.actions.harvest(i).ok) {
        delete me.matureSince[i];
        if (me.tutorial === 'harvest') me.tutorial = 'coop';
      }
    }
  }

  // Achats : le poulailler du tutoriel, puis la liste d'envies.
  if (me.tutorial === 'coop') {
    if (game.state.money >= 70) {
      if (me.rnd() < profile.tutorialCoop && spend(3)) game.actions.buyInvestment('chickenCoop');
      me.tutorial = null;
    }
  } else if (me.tutorial === null && me.rnd() < profile.buyProb && spend(3)) {
    const table = profile.wishes === 'novice' ? NOVICE_WISHES : HUMAN_WISHES;
    const wishes = table[game.level.id] || table.default;
    const invs = q.investments();
    const buffer = between(me, profile.buyBuffer) + humanKeep(game, me, profile, true);
    for (let k = 0; k < wishes.length; k++) {
      const id = wishes[k];
      const inv = invs.find((x) => x.id === id);
      if (!inv) continue;
      const wanted = wishes.slice(0, k + 1).filter((w) => w === id).length;
      if (inv.owned >= wanted) continue;
      if (inv.canBuy && game.state.money - inv.nextCost >= buffer) game.actions.buyInvestment(id);
      break; // on attend d'avoir de quoi acheter l'envie suivante
    }
    if (profile.plotProb > 0 && me.rnd() < profile.plotProb) {
      const idx = game.state.plots.findIndex((p) => !p.unlocked);
      const cost = idx >= 0 ? q.plot(idx).unlockCost : null;
      if (cost !== null && game.state.money - cost >= 100 + buffer) game.actions.unlockPlot(idx);
    }
  }

  // (lot 3) Tableau du village (un jour sur deux) et colporteur.
  // « S'il a la marge » : le sachet ne doit pas entamer le fermage de la saison (+ 40 pièces pour ressemer).
  if (game.state.variety) varietyDay(game, me, profile, spend, game.query.finance().nextBill.amount + 40);

  // Plantation (« semer partout ») certains jours.
  const empty = () => game.state.plots.map((p, i) => (p.unlocked && !p.cropId ? i : -1)).filter((i) => i >= 0);
  if (empty().length && me.rnd() < profile.plantProb && spend(3)) {
    // (lot 3) Les graines rares d'abord (« semer partout » les utilise jusqu'au bout du sachet).
    sowRare(game, empty());
    const keep = humanKeep(game, me, profile);
    const first = empty()[0];
    const pick = humanPickCrop(game, me, profile, first, game.state.money - keep);
    if (pick) {
      for (const i of empty()) {
        if (game.state.money - pick.seedCost < keep) break;
        if (!game.actions.plant(i, pick.id).ok) break;
      }
    }
  }

  // Arrosage partiel (glisser).
  const thirsty = [];
  for (let i = 0; i < game.state.plots.length; i++) if (q.plot(i).action === 'water') thirsty.push(i);
  if (thirsty.length && spend(1)) {
    const share = between(me, profile.water);
    for (const i of thirsty) {
      if (me.rnd() >= share) continue;
      if (!spend(0.25)) break;
      game.actions.water(i);
    }
  }
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

  casual(game, me) {
    humanDay(game, me, HUMAN_PROFILES.casual);
  },

  novice(game, me) {
    humanDay(game, me, HUMAN_PROFILES.novice);
  },

  idle(game, me) {
    if (me.done) return;
    me.done = true;
    const i = game.state.plots.findIndex((p) => p.unlocked && !p.cropId);
    const cheap = game.query.plantableCrops(i).filter((o) => o.kind !== 'tree').reduce((a, b) => (b.seedCost < a.seedCost ? b : a));
    for (const p of game.query.plots()) if (p.action === 'plant' && !game.actions.plant(p.index, cheap.id).ok) break;
    for (const p of game.query.plots()) if (p.action === 'water') game.actions.water(p.index);
  },

  optimal(game, me) {
    const budget = makeBudget();
    if (game.state.variety) {
      varietyChoices(game, me, { cardPick: 'best', challengePick: 'best' });
      optimalVariety(game, me);
    }
    // (lot 4) L'appliqué joue toutes les fêtes, au mieux, et tout l'hiver.
    if (game.state.cozy) cozyDay(game, me, COZY_STYLES.optimal);
    harvestAll(game, budget, OPT_MARKET);
    if (OPT_PLANT_FIRST) plantAll(game, budget, 'best', true);
    for (let guard = 0; guard < 40; guard++) {
      const c = ctx(game);
      const spendable = c.state.money - (reserve(c) + committedWater(c) + 10 + workingCapital(c, OPT_CAPITAL));
      let best = null;
      for (const id of candidates(c)) {
        const cost = purchaseCost(c, id);
        if (cost > spendable) continue;
        if (id === 'plot' && !canFarmMorePlots(c, spendable - cost)) continue;
        const ratio = (purchaseValue(c, id) - cost) / cost;
        if (ratio > OPT_RATIO && (!best || ratio > best.ratio)) best = { id, ratio };
      }
      if (!best || !tryBuy(game, best.id, 10, true, OPT_CAPITAL)) break;
    }
    plantTrees(game, budget, { maxShare: 0.34, minBaskets: 3, springOnly: false, weigh: true });
    waterAll(game, budget);
    if (game.state.variety) sowRare(game, game.state.plots.map((p, i) => (p.unlocked && !p.cropId ? i : -1)).filter((i) => i >= 0));
    plantAll(game, budget, 'best', true);
    waterAll(game, budget);
  },
};

/** Robots appliqués d'avant le lot 3 (careless, balanced, investor) : première carte, deux premiers défis. */
const ROBOT_VARIETY = { cardPick: 'first', challengePick: 'first' };

// ── Boucle de simulation ────────────────────────────────────────────────────────────────

/**
 * Joue une partie. Renvoie { win, money, stars, summary, seasonId?, income, contest }.
 * income : revenus par origine { crops, apples, products, investments, contest, raw, refund, total } (disjoints),
 *   et, pour les parts, trees = pommes vendues brutes + jus, milk = lait vendu + fromages.
 */
export function playOne(levelId, seed, strategy, perks = {}, difficulty = DIFFICULTY, surprises = SURPRISES, variety = VARIETY, cozy = COZY) {
  const opts = { levelId, seed, perks, difficulty };
  if (surprises !== undefined) opts.surprises = surprises;
  if (variety !== undefined) opts.variety = variety;
  // (lot 4) Le décor posé dans la progression (critère « beauté ») : quelques décorations pour le tranquille.
  const cz = cozy === undefined ? (difficulty !== 'classique' ? true : undefined) : cozy;
  if (cz) opts.cozy = { ...(typeof cz === 'object' ? cz : {}), decor: SIM_DECOR[strategy] || null };
  else if (cz === false) opts.cozy = false;
  const game = createGame(opts);
  const me = createHuman(strategy, levelId, seed);
  const total = game.query.calendar().totalDays;
  let result = null;
  // Sources disjointes (crops, apples, products, investments, contest, raw, refund) ; trees et milk
  // regroupent pour les parts : pommes brutes + jus ; lait vendu + fromages.
  const income = { crops: 0, apples: 0, products: 0, investments: 0, contest: 0, raw: 0, refund: 0, trees: 0, milk: 0, surprises: 0, quality: 0, giants: 0 };
  // (lot 2) argent des surprises (coffres, champignons, vœux) ; part « qualité » et « géants » des récoltes.
  const lot2 = { fine: 0, gold: 0, giants: 0, surprises: 0, specials: 0, wishes: 0 };
  // (lot 3) Variété : primes du tableau et de la charrette, cartes, médailles (pièces) ; dépenses au colporteur ; écus.
  const lot3 = { orders: 0, cart: 0, cards: 0, medals: 0, merchant: 0, ecus: 0, ordersDone: 0, cratesFull: 0, medalsN: 0, rareSown: 0 };
  const medalsBy = {};
  // (lot 4) Fêtes (pièces, écus, jouées), hiver (pièces), veillée, lanternes de l'année.
  const lot4 = { fetes: 0, winter: 0, ecus: 0, played: 0, helped: 0, lanterns: null, stories: 0 };
  game.on('feteDone', (e) => {
    lot4.ecus += e.ecus || 0;
  });
  game.on('feteFound', (e) => (lot4.fetes += e.amount || 0));
  game.on('feteEnded', (e) => {
    lot4.fetes += e.helped?.amount || 0;
    lot4.helped += e.helped?.amount || 0;
  });
  game.on('winterPicked', (e) => (lot4.winter += e.amount || 0));
  game.on('storyHeard', () => {
    lot4.stories++;
    lot4.ecus += 1;
  });
  game.on('lanternsLit', (e) => {
    lot4.lanterns = { values: [...e.values], total: e.total };
    lot4.crit = e.criteria.map((c) => ({ value: c.value, k: c.k }));
  });
  game.on('orderDone', (e) => {
    lot3.orders += e.premium;
    lot3.ordersDone++;
  });
  game.on('orderRemoved', (e) => (lot3.orders += e.premium || 0));
  game.on('cartDeparted', (e) => {
    lot3.cart += e.premium;
    lot3.ecus += e.ecus || 0;
  });
  game.on('crateFull', () => lot3.cratesFull++);
  game.on('cardPicked', (e) => (lot3.cards += e.amount || 0));
  game.on('challengeMedal', (e) => {
    lot3.medals += e.coins || 0;
    lot3.ecus += e.ecus || 0;
    lot3.medalsN++;
    medalsBy[`${e.challengeId}.${e.medal}`] = (medalsBy[`${e.challengeId}.${e.medal}`] || 0) + 1;
  });
  game.on('merchantBought', (e) => (lot3.merchant += e.price || 0));
  game.on('planted', (e) => {
    if (e.rare) lot3.rareSown++;
  });
  game.on('surprise', (e) => {
    lot2.surprises++;
    if (e.amount) income.surprises += e.amount;
  });
  game.on('foragePicked', (e) => (income.surprises += e.amount));
  game.on('wishGranted', (e) => {
    lot2.wishes++;
    if (e.amount) income.surprises += e.amount;
  });
  game.on('specialWeather', () => lot2.specials++);
  game.on('giantHarvested', (e) => {
    lot2.giants++;
    income.giants += e.amount;
  });
  let contest = null;
  game.on('harvested', (e) => {
    if (e.quality === 'fine') lot2.fine++;
    if (e.quality === 'gold') lot2.gold++;
    if (e.qualityBonus) income.quality += e.qualityBonus;
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
      else if (i.kind === 'card') lot3.cards += i.amount;
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
    // (lot 2) Vœu de l'étoile filante : un joueur choisit la bourse si elle est proposée, sinon le premier vœu.
    const wish = game.query.surprises?.()?.wish;
    if (wish) game.actions.makeWish((wish.options.find((o) => o.id === 'coins') || wish.options[0]).id);
    if (game.state.variety && ['careless', 'balanced', 'investor'].includes(strategy)) varietyChoices(game, me, ROBOT_VARIETY);
    STRATEGIES[strategy](game, me);
    if (TRACE) traceDay(game, before);
    game.update(DAY_SECONDS);
  }
  if (!result) throw new Error(`Partie non terminée (niveau ${levelId}, graine ${seed})`);
  income.variety = lot3.orders + lot3.cart + lot3.cards + lot3.medals;
  // (lot 4) pièces des fêtes (cookSoup, presentStand, giveBaskets ne passent pas par feteFound : summary.cozyIncome)
  income.cozy = result.summary?.cozyIncome || 0;
  lot4.fetes = Math.max(0, income.cozy - lot4.winter);
  lot4.played = Object.keys(game.state.cozy?.year?.fetes || {}).length;
  income.total = income.crops + income.apples + income.products + income.investments + income.contest + income.raw + income.refund + income.surprises + income.variety + income.cozy;
  return { ...result, income, contest, lot2, lot3, lot4, medalsBy };
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
function simulateRow(level, strategy, perks, difficulty = DIFFICULTY, surprises = SURPRISES, variety = VARIETY, cozy = COZY) {
  const results = [];
  for (let seed = 1; seed <= SEEDS; seed++) results.push(playOne(level.id, seed, strategy, perks, difficulty, surprises, variety, cozy));
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
    // Mode détente : parties où le voisin a prêté au moins une fois.
    loanRate: results.filter((r) => r.summary.neighbourLoan?.loans > 0).length / results.length,
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
    // (lot 2) revenu moyen de l'année, part des surprises, nombre moyen d'événements du lot 2 par partie.
    avgIncome: Math.round(sum('total') / results.length),
    avgMoney: Math.round(results.reduce((s, r) => s + r.money, 0) / results.length),
    lot2: Object.fromEntries(['fine', 'gold', 'giants', 'surprises', 'specials', 'wishes'].map((k) => [k, +(results.reduce((s, r) => s + r.lot2[k], 0) / results.length).toFixed(2)])),
    lot2Income: { quality: Math.round(sum('quality') / results.length), giants: Math.round(sum('giants') / results.length), surprises: Math.round(sum('surprises') / results.length) },
    // (lot 3) gain moyen par partie de chaque partie de la variété, écus, compteurs.
    lot3: Object.fromEntries(['orders', 'cart', 'cards', 'medals', 'merchant', 'ecus', 'ordersDone', 'cratesFull', 'medalsN', 'rareSown'].map((k) => [k, +(results.reduce((s, r) => s + r.lot3[k], 0) / results.length).toFixed(1)])),
    moneys: results.map((r) => r.money),
    // (lot 4) gain moyen des fêtes et de l'hiver, écus, fêtes jouées, lanternes (par critère : parts 1 / 2 / 3 / 4).
    lot4: Object.fromEntries(['fetes', 'winter', 'ecus', 'played', 'stories'].map((k) => [k, +(results.reduce((s, r) => s + (r.lot4?.[k] || 0), 0) / results.length).toFixed(1)])),
    lanterns: lanternStats(results),
    loanAny: results.filter((r) => r.summary.neighbourLoan?.loans > 0).length,
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

export function simulate(levels, strategies, perks, difficulty = DIFFICULTY, surprises = SURPRISES, variety = VARIETY, cozy = COZY) {
  return levels.map((base) => {
    const level = levelFor(base.id, difficulty);
    return {
      level: level.id,
      name: level.name,
      difficulty,
      thresholds: level.starThresholds,
      rows: strategies.map((s) => simulateRow(level, s, perks, difficulty, surprises, variety, cozy)),
    };
  });
}

/** (lot 4) Lanternes de toutes les parties : par critère, parts des parties à 1, 2, 3, 4 lanternes ; totaux. */
export function lanternStats(results) {
  const lit = results.map((r) => r.lot4?.lanterns).filter(Boolean);
  if (!lit.length) return null;
  const per = [0, 1, 2, 3, 4].map((k) => [1, 2, 3, 4].map((n) => lit.filter((l) => l.values[k] === n).length / lit.length));
  const totals = lit.map((l) => l.total);
  return { n: lit.length, per, totals, median: median(totals) };
}

function printTable(out, title) {
  console.log(`${title}\n`);
  for (const lv of out) {
    console.log(`Niveau ${lv.level} — ${lv.name}   (★★ ≥ ${lv.thresholds[0]}, ★★★ ≥ ${lv.thresholds[1]})`);
    console.log('  stratégie  victoires  argent médian  (si victoire)   faillite / ★ / ★★ / ★★★   produits arbres lait  prêt voisin   faillites par saison');
    for (const r of lv.rows) {
      const st = r.stars.map((n) => pct(n, SEEDS).padStart(4)).join(' ');
      const losses = Object.entries(r.lossSeasons)
        .map(([s, n]) => `${s}:${n}`)
        .join(' ');
      const share = ['products', 'trees', 'milk'].map((k) => pct(r.share[k] * 100, 100).padStart(5)).join(' ');
      const contest = r.contest ? `  concours ${r.contest.avgPrize} (≥ 2 épreuves : ${pct(r.contest.twoGoals * 100, 100)})` : '';
      console.log(
        `  ${r.strategy.padEnd(10)} ${pct(r.winRate * SEEDS, SEEDS).padStart(8)}  ${String(r.medianMoney).padStart(12)}  ${String(r.medianWinMoney ?? '—').padStart(12)}   ${st}   ${share}   ${pct(r.loanRate * 100, 100).padStart(9)}   ${losses}${contest}`,
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

function printCompareModes(detente, classique) {
  console.log(`Victoires par mode (détente / classique) : ${SEEDS} graines par niveau et par stratégie, sans bonus\n`);
  const strategies = detente[0].rows.map((r) => r.strategy);
  console.log(`niveau  ${strategies.map((s) => s.padStart(15)).join('')}`);
  detente.forEach((lv, k) => {
    const cells = lv.rows.map((r, j) => `${pct(r.winRate * 100, 100)} / ${pct(classique[k].rows[j].winRate * 100, 100)}`.padStart(15));
    console.log(`${String(lv.level).padStart(4)}    ${cells.join('')}`);
  });
}

/** (lot 2) Sans / avec les surprises : revenu de l'année, argent final, victoires, étoiles, événements. */
function printCompareSurprises(off, on) {
  console.log(`Surprises du lot 2 (mode ${DIFFICULTY}) : sans → avec, ${SEEDS} graines par niveau et par stratégie\n`);
  console.log('niveau  stratégie   revenu moyen (sans → avec, écart)   argent moyen (écart)   victoires     ★★★ (sans → avec)   par partie : belles dorées géants surprises météos   gain : qualité géants surprises');
  const totals = {};
  off.forEach((lv, k) => {
    lv.rows.forEach((r, j) => {
      const a = on[k].rows[j];
      const d = r.avgIncome ? (100 * (a.avgIncome - r.avgIncome)) / r.avgIncome : 0;
      const dm = r.avgMoney ? (100 * (a.avgMoney - r.avgMoney)) / Math.abs(r.avgMoney) : 0;
      (totals[r.strategy] = totals[r.strategy] || []).push(d);
      const l = a.lot2;
      console.log(
        `${String(lv.level).padStart(4)}    ${r.strategy.padEnd(10)}  ${String(r.avgIncome).padStart(6)} → ${String(a.avgIncome).padStart(6)}  (${d >= 0 ? '+' : ''}${d.toFixed(1)} %)        ${dm >= 0 ? '+' : ''}${dm.toFixed(1)} %       ${pct(r.winRate * 100, 100).padStart(4)} → ${pct(a.winRate * 100, 100).padStart(4)}   ${pct(r.stars[3], SEEDS).padStart(4)} → ${pct(a.stars[3], SEEDS).padStart(4)}          ${String(l.fine).padStart(6)} ${String(l.gold).padStart(6)} ${String(l.giants).padStart(6)} ${String(l.surprises).padStart(9)} ${String(l.specials).padStart(6)}        ${String(a.lot2Income.quality).padStart(6)} ${String(a.lot2Income.giants).padStart(6)} ${String(a.lot2Income.surprises).padStart(9)}`,
      );
    });
  });
  console.log('\nÉcart moyen du revenu de l\'année, tous niveaux :');
  for (const [s, ds] of Object.entries(totals)) console.log(`  ${s.padEnd(10)} ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)} %`);
}

/** (lot 3) Sans → avec la variété : revenu de l'année, argent final, victoires, ★★★, gain par partie. */
function printCompareVariety(off, on) {
  console.log(`Variété du lot 3 (mode ${DIFFICULTY}) : sans → avec, ${SEEDS} graines par niveau et par stratégie (surprises : défaut du mode)\n`);
  console.log('niveau  stratégie   revenu moyen (sans → avec, écart)   argent médian (écart)   victoires     ★★★ (sans → avec)   gain par partie : tableau cartes charrette médailles · colporteur (dépense) · écus · commandes caisses médailles');
  const totals = {};
  const money = {};
  off.forEach((lv, k) => {
    lv.rows.forEach((r, j) => {
      const a = on[k].rows[j];
      const d = r.avgIncome ? (100 * (a.avgIncome - r.avgIncome)) / r.avgIncome : 0;
      const dm = r.medianMoney ? (100 * (a.medianMoney - r.medianMoney)) / Math.abs(r.medianMoney) : 0;
      (totals[r.strategy] = totals[r.strategy] || []).push(d);
      (money[r.strategy] = money[r.strategy] || []).push(dm);
      const l = a.lot3;
      console.log(
        `${String(lv.level).padStart(4)}    ${r.strategy.padEnd(10)}  ${String(r.avgIncome).padStart(6)} → ${String(a.avgIncome).padStart(6)}  (${d >= 0 ? '+' : ''}${d.toFixed(1)} %)        ${String(r.medianMoney).padStart(5)} → ${String(a.medianMoney).padStart(5)} (${dm >= 0 ? '+' : ''}${dm.toFixed(0)} %)   ${pct(r.winRate * 100, 100).padStart(4)} → ${pct(a.winRate * 100, 100).padStart(4)}   ${pct(r.stars[3], SEEDS).padStart(4)} → ${pct(a.stars[3], SEEDS).padStart(4)}          ${String(l.orders).padStart(6)} ${String(l.cards).padStart(6)} ${String(l.cart).padStart(6)} ${String(l.medals).padStart(6)} · ${String(l.merchant).padStart(5)} · ${String(l.ecus).padStart(4)} · ${l.ordersDone} ${l.cratesFull} ${l.medalsN}`,
      );
    });
  });
  console.log('\nÉcart moyen, tous niveaux : revenu de l\'année · argent final médian');
  for (const [s, ds] of Object.entries(totals)) console.log(`  ${s.padEnd(10)} ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)} % · ${(money[s].reduce((a, b) => a + b, 0) / money[s].length).toFixed(1)} %`);
}

/** (lot 4) Sans → avec les fêtes, l'hiver et les lanternes : revenu de l'année, argent final, victoires, ★★★, gains. */
function printCompareCozy(off, on) {
  console.log(`Lot 4 (mode ${DIFFICULTY}) : sans → avec fêtes, hiver et lanternes, ${SEEDS} graines par niveau et par stratégie (surprises et variété : défaut du mode)\n`);
  console.log('niveau  stratégie   revenu moyen (sans → avec, écart)   argent médian (écart)   victoires     ★★★ (sans → avec)   par partie : fêtes hiver (pièces) · écus · fêtes jouées · veillées · lanternes (méd.)');
  const totals = {};
  const money = {};
  off.forEach((lv, k) => {
    lv.rows.forEach((r, j) => {
      const a = on[k].rows[j];
      const d = r.avgIncome ? (100 * (a.avgIncome - r.avgIncome)) / r.avgIncome : 0;
      const dm = r.medianMoney ? (100 * (a.medianMoney - r.medianMoney)) / Math.abs(r.medianMoney) : 0;
      (totals[r.strategy] = totals[r.strategy] || []).push(d);
      (money[r.strategy] = money[r.strategy] || []).push(dm);
      const l = a.lot4;
      console.log(
        `${String(lv.level).padStart(4)}    ${r.strategy.padEnd(10)}  ${String(r.avgIncome).padStart(6)} → ${String(a.avgIncome).padStart(6)}  (${d >= 0 ? '+' : ''}${d.toFixed(1)} %)        ${String(r.medianMoney).padStart(5)} → ${String(a.medianMoney).padStart(5)} (${dm >= 0 ? '+' : ''}${dm.toFixed(0)} %)   ${pct(r.winRate * 100, 100).padStart(4)} → ${pct(a.winRate * 100, 100).padStart(4)}   ${pct(r.stars[3], SEEDS).padStart(4)} → ${pct(a.stars[3], SEEDS).padStart(4)}          ${String(l.fetes).padStart(6)} ${String(l.winter).padStart(5)} · ${String(l.ecus).padStart(4)} · ${l.played} · ${l.stories} · ${a.lanterns ? a.lanterns.median : '—'}`,
      );
    });
  });
  console.log('\nÉcart moyen, tous niveaux : revenu de l\'année · argent final médian');
  for (const [s, ds] of Object.entries(totals)) console.log(`  ${s.padEnd(10)} ${(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1)} % · ${(money[s].reduce((a, b) => a + b, 0) / money[s].length).toFixed(1)} %`);
}

/** (lot 4) Répartition des lanternes par critère (parts 1 / 2 / 3 / 4) et total médian, par robot (tous niveaux confondus). */
function printLanterns(out) {
  const names = ['variété', 'soin', 'voisinage', 'beauté', 'prospérité'];
  console.log(`Lanternes (mode ${DIFFICULTY}, ${SEEDS} graines) : par critère, parts des années à 1 / 2 / 3 / 4 lanternes ; total médian\n`);
  const by = {};
  for (const lv of out) {
    for (const r of lv.rows) {
      if (!r.lanterns) continue;
      const b = (by[r.strategy] = by[r.strategy] || { n: 0, per: names.map(() => [0, 0, 0, 0]), totals: [] });
      b.n += r.lanterns.n;
      r.lanterns.per.forEach((row, k) => row.forEach((x, n) => (b.per[k][n] += x * r.lanterns.n)));
      b.totals.push(...r.lanterns.totals);
      if (VERBOSE) console.log(`  niveau ${String(lv.level).padStart(2)} ${r.strategy.padEnd(9)} total méd. ${r.lanterns.median} · ${r.lanterns.per.map((row, k) => `${names[k]} ${row.map((x) => Math.round(x * 100)).join('/')}`).join(' · ')}`);
    }
  }
  for (const [s, b] of Object.entries(by)) {
    console.log(`  ${s.padEnd(10)} total médian ${median(b.totals)} / 20 (${b.n} années)`);
    names.forEach((nm, k) => console.log(`             ${nm.padEnd(11)} ${b.per[k].map((x) => `${String(Math.round((100 * x) / b.n)).padStart(3)} %`).join('  ')}`));
  }
}

/** Quantile (0..1) d'une liste de nombres. */
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * (lot 3) Seuils d'étoiles Détente suggérés (règle du § 13.3) : ★★ ≈ argent final médian du joueur tranquille,
 * ★★★ ≈ ses 12 % meilleures parties (faillites comptées à 0), arrondis à la dizaine.
 */
function printStars(out) {
  console.log(`Seuils d'étoiles suggérés (mode ${DIFFICULTY}, ${SEEDS} graines, casual / novice) : ★★ = médiane casual, ★★★ = 88e centile casual\n`);
  console.log('niveau  actuels (★★ / ★★★)   suggérés (★★ / ★★★)   casual : ★★+ / ★★★ avec les suggérés   novice : ★★★ avec les suggérés');
  for (const lv of out) {
    const casual = lv.rows.find((r) => r.strategy === 'casual');
    const novice = lv.rows.find((r) => r.strategy === 'novice');
    if (!casual) continue;
    const t2 = Math.round(quantile(casual.moneys, 0.5) / 10) * 10;
    const t3 = Math.round(quantile(casual.moneys, 0.88) / 10) * 10;
    const share = (r, t) => (r ? pct(r.moneys.filter((m) => m >= t).length, r.moneys.length) : '—');
    console.log(`${String(lv.level).padStart(4)}    ${String(lv.thresholds[0]).padStart(5)} / ${String(lv.thresholds[1]).padStart(5)}        ${String(t2).padStart(5)} / ${String(t3).padStart(5)}          ${share(casual, t2)} / ${share(casual, t3)}                     ${share(novice, t3)}`);
  }
}

function run() {
  const levels = selectedLevels();
  const strategies = Object.keys(STRATEGIES).filter((s) => !STRATEGY_FILTER || s === STRATEGY_FILTER);
  if (COMPARE_COZY) {
    const off = simulate(levels, strategies, {}, DIFFICULTY, SURPRISES, VARIETY, false);
    const on = simulate(levels, strategies, {}, DIFFICULTY, SURPRISES, VARIETY, COZY === undefined || COZY === false ? true : COZY);
    if (JSON_OUT) console.log(JSON.stringify({ off, on }, (k, v) => (k === 'moneys' || k === 'totals' ? undefined : v), 2));
    else printCompareCozy(off, on);
    return;
  }
  if (LANTERNS) {
    const out = simulate(levels, strategies.filter((s) => s !== 'idle'), {}, DIFFICULTY, SURPRISES, VARIETY, COZY);
    printLanterns(out);
    return;
  }
  if (COMPARE_VARIETY) {
    const off = simulate(levels, strategies, {}, DIFFICULTY, SURPRISES, false);
    const on = simulate(levels, strategies, {}, DIFFICULTY, SURPRISES, VARIETY === undefined || VARIETY === false ? true : VARIETY);
    if (JSON_OUT) console.log(JSON.stringify({ off, on }, (k, v) => (k === 'moneys' ? undefined : v), 2));
    else printCompareVariety(off, on);
    return;
  }
  if (STARS) {
    const out = simulate(levels, strategies.filter((s) => s === 'casual' || s === 'novice'), {}, DIFFICULTY, SURPRISES, VARIETY);
    printStars(out);
    return;
  }
  if (COMPARE_SURPRISES) {
    const off = simulate(levels, strategies, {}, DIFFICULTY, false);
    const on = simulate(levels, strategies, {}, DIFFICULTY, true);
    if (JSON_OUT) console.log(JSON.stringify({ off, on }, null, 2));
    else printCompareSurprises(off, on);
    return;
  }
  if (COMPARE_MODES) {
    const detente = simulate(levels, strategies, {}, 'detente');
    const classique = simulate(levels, strategies, {}, 'classique');
    if (JSON_OUT) console.log(JSON.stringify({ detente, classique }, null, 2));
    else printCompareModes(detente, classique);
    return;
  }
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
    console.log(JSON.stringify(out, (k, v) => (k === 'moneys' ? undefined : v), 2));
    return;
  }
  const perkText = Object.keys(perks).length ? `, bonus : ${PERKS_ARG}` : '';
  printTable(out, `Simulation (mode ${DIFFICULTY}) : ${SEEDS} graines par niveau et par stratégie${Number.isFinite(CLICKS) ? `, ${CLICKS} actions/jour` : ''}${perkText}`);
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
