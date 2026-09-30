// Simulation du mode Carrière (squelette CORE-A ; CORE-C l'étend : employés, machines, événements,
// quêtes, robots novice / idle / automator). Voir docs/CARRIERE.md § 13.
//
// Joue des carrières par l'API publique seulement (createCareer, actions, requêtes), N années, de façon
// déterministe (graine × stratégie ; les tirages « humains » ont leur propre flux, comme tools/simulate.js).
//
//   node tools/simulate-career.js                        casual + optimal, Détente, 10 ans, 20 carrières
//   node tools/simulate-career.js --strategy casual --years 10 --runs 50
//   node tools/simulate-career.js --difficulty classique
//   node tools/simulate-career.js --season 14            saisons de 14 jours
//   node tools/simulate-career.js --assume-objectives    objectifs des lots CORE-B / CORE-C (employés, quêtes,
//                                                        comice) considérés remplis : mesure le rythme du patrimoine
//   node tools/simulate-career.js --trace --seed 3       une carrière, année par année
//   node tools/simulate-career.js --json
//
// Robots :
//   casual  : profil « casual » de tools/simulate.js (7 à 11 gestes par jour, récolte parfois en retard,
//             arrosage partiel, cultures bon marché et rapides, un jour sur dix sans jouer) ; achats d'après une
//             liste d'envies (étal, terrain → champ, ruches, grenier, pré et chèvres, panneaux, cour des
//             ateliers, verger…) en gardant de quoi payer 2 saisons de charges ; grenier « cours bas », tout
//             vendu en hiver.
//   optimal : tient toutes les parcelles chaque jour (culture la plus rentable par jour), achète terrains et
//             champs dès que possible (réserve : 2 saisons de charges), ruches, panneaux, étal, grenier, maison ;
//             vend le grenier au bon cours (≥ 1,15 ou hors saison).
// Sans les lots CORE-B / CORE-C, les objectifs « embaucher », « quêtes », « comice » ne peuvent pas être
// remplis : le rang plafonne à 2 sans --assume-objectives.

import { fileURLToPath } from 'node:url';
import { createCareer } from '../src/core/career/career.js';
import { DAY_SECONDS } from '../src/data/balance.js';
import { getCrop } from '../src/data/crops.js';
import { RANKS } from '../src/data/career/ranks.js';
import { HUMAN_PROFILES } from './simulate.js';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const ASSUMED_TYPES = ['staff', 'quests', 'contestsWon'];

// ── Joueur simulé ──────────────────────────────────────────────────────────────────────────
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

function humanSeed(seed, strategy) {
  let h = 2166136261;
  for (const ch of `career/${seed}/${strategy}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const between = (rnd, [a, b]) => a + (b - a) * rnd();

function isMatureState(p) {
  const crop = p.cropId && getCrop(p.cropId);
  if (!crop) return false;
  if (crop.kind === 'tree') return (p.fruit || 0) >= crop.fruitDays - 1e-9;
  return p.growth >= crop.growDays - 1e-9;
}

/** Parcelles actives groupées par terrain. */
function plotsByLot(game) {
  const by = new Map();
  game.state.plots.forEach((p, i) => {
    if (!p.env || !p.unlocked) return;
    if (!by.has(p.lot)) by.set(p.lot, []);
    by.get(p.lot).push(i);
  });
  return by;
}

function seasonCharge(game) {
  return game.query.finance().nextBill.amount;
}

// ── Achats ─────────────────────────────────────────────────────────────────────────────────
/** Envies d'achat : [{ id, kind, arg… }] ; `lot:<type>` achète le terrain suivant puis l'aménage. */
const CASUAL_WISHES = [
  { kind: 'upgrade', id: 'roadsideStand', level: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'beehive', n: 2 },
  { kind: 'lot', type: 'workshops' },
  { kind: 'build', type: 'workshops', id: 'jamWorkshop' },
  { kind: 'upgrade', id: 'storage', level: 1 },
  { kind: 'build', type: 'meadow', id: 'goatShed' },
  { kind: 'animal', id: 'goat', n: 3 },
  { kind: 'upgrade', id: 'jamWorkshop', level: 3 },
  { kind: 'upgrade', id: 'house', level: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'solarPanel', n: 1 },
  // rang 3
  { kind: 'build', type: 'workshops', id: 'dairy' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'guestHouse' },
  { kind: 'build', type: 'meadow', id: 'cowshed' },
  { kind: 'animal', id: 'cow', n: 2 },
  { kind: 'upgrade', id: 'coop', level: 2 },
  { kind: 'animal', id: 'hen', n: 8 },
  { kind: 'lot', type: 'field' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'pigsty' },
  { kind: 'animal', id: 'pig', n: 2 },
  { kind: 'build', type: 'meadow', id: 'sheepfold' },
  { kind: 'animal', id: 'sheep', n: 2 },
  { kind: 'item', id: 'beehive', n: 4 },
  { kind: 'upgrade', id: 'house', level: 3 },
  // rang 4
  { kind: 'lot', type: 'orchard' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'hutch' },
  { kind: 'animal', id: 'rabbit', n: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 2 },
  { kind: 'upgrade', id: 'roadsideStand', level: 2 },
  { kind: 'upgrade', id: 'house', level: 4 },
  { kind: 'item', id: 'beehive', n: 6 },
  // rang 5
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'house', level: 5 },
  { kind: 'lot', type: 'field' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'upgrade', id: 'storage', level: 3 },
];

const OPTIMAL_WISHES = [
  { kind: 'upgrade', id: 'roadsideStand', level: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'beehive', n: 2 },
  { kind: 'item', id: 'solarPanel', n: 1 },
  { kind: 'lot', type: 'workshops' },
  { kind: 'build', type: 'workshops', id: 'jamWorkshop' },
  { kind: 'upgrade', id: 'jamWorkshop', level: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 1 },
  { kind: 'item', id: 'beehive', n: 4 },
  { kind: 'upgrade', id: 'house', level: 2 },
  { kind: 'build', type: 'meadow', id: 'goatShed' },
  { kind: 'animal', id: 'goat', n: 3 },
  // rang 3
  { kind: 'build', type: 'workshops', id: 'dairy' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'guestHouse' },
  { kind: 'build', type: 'meadow', id: 'cowshed' },
  { kind: 'animal', id: 'cow', n: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'beehive', n: 6 },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'pigsty' },
  { kind: 'animal', id: 'pig', n: 2 },
  { kind: 'build', type: 'meadow', id: 'sheepfold' },
  { kind: 'animal', id: 'sheep', n: 3 },
  { kind: 'upgrade', id: 'house', level: 3 },
  // rang 4
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'hutch' },
  { kind: 'animal', id: 'rabbit', n: 2 },
  { kind: 'upgrade', id: 'roadsideStand', level: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 2 },
  { kind: 'upgrade', id: 'house', level: 4 },
  { kind: 'item', id: 'solarPanel', n: 2 },
  { kind: 'lot', type: 'field' },
  // rang 5
  { kind: 'upgrade', id: 'house', level: 5 },
  { kind: 'lot', type: 'field' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'upgrade', id: 'storage', level: 3 },
];

/** Coût et faisabilité d'une envie : { done, cost, locked, run() }. */
function wishState(game, w) {
  const c = game.state.career;
  const A = game.actions;
  const Q = game.query.career;
  switch (w.kind) {
    case 'upgrade': {
      const b = Q.building(w.id);
      if (!b || b.level >= w.level) return { done: true };
      if (!b.canUpgrade && /Rang|Construisez|aménager/.test(b.reason || '')) return { locked: true };
      return { cost: b.nextCost, run: () => A.career.upgradeBuilding(w.id) };
    }
    case 'item':
    case 'animal': {
      const inv = game.query.investments().find((i) => i.id === w.id);
      if (!inv) return { locked: true };
      if (inv.owned >= w.n) return { done: true };
      if (inv.canBuy) return { cost: inv.nextCost, run: () => A.buyInvestment(w.id) };
      if (inv.nextCost !== null && /Pas assez/.test(inv.reason || '')) return { cost: inv.nextCost, run: () => A.buyInvestment(w.id) };
      return { locked: true };
    }
    case 'lot': {
      // Une envie « terrain » par occurrence : faite quand le nombre de terrains de ce type (achetés) l'atteint.
      const wanted = w.nth;
      const count = c.lots.filter((l) => l.index >= 3 && l.type === w.type).length;
      if (count >= wanted) return { done: true };
      const wild = c.lots.find((l) => l.type === 'wild');
      const types = wild ? Q.lotTypes(wild.id) : null;
      const t = types ? types.find((x) => x.type === w.type) : Q.lotTypes('lot3').find((x) => x.type === w.type);
      if (wild) {
        if (t && t.canDevelop) return { cost: t.cost, run: () => A.career.developLot(wild.id, w.type) };
        if (t && /Rang|Au plus/.test(t.reason || '')) return { locked: true };
        return { cost: t ? t.cost : 0, run: () => A.career.developLot(wild.id, w.type) };
      }
      const next = Q.nextLot();
      if (!next || next.lockedByRank) return { locked: true };
      const typeInfo = getTypeInfo(w.type);
      if (typeInfo.rank > c.rank) return { locked: true };
      return { cost: next.price + typeInfo.cost, run: () => A.career.buyLot().ok && A.career.developLot(`lot${next.index}`, w.type) };
    }
    case 'build': {
      if (c.buildings[w.id]) return { done: true };
      for (const lot of c.lots) {
        if (lot.type !== w.type && !(w.type === 'meadow' && lot.type === 'yard')) continue;
        const slot = (lot.slots || []).indexOf(null);
        if (slot < 0) continue;
        const opt = Q.buildOptions(lot.id, slot).find((o) => o.buildingId === w.id);
        if (!opt) continue;
        if (!opt.canBuild && /Rang/.test(opt.reason || '')) return { locked: true };
        return { cost: opt.cost, run: () => A.career.build(lot.id, slot, w.id) };
      }
      return { locked: true };
    }
    default:
      return { locked: true };
  }
}

const TYPE_INFO = { field: { cost: 150, rank: 1 }, meadow: { cost: 120, rank: 1 }, orchard: { cost: 100, rank: 2 }, workshops: { cost: 100, rank: 2 } };
function getTypeInfo(type) {
  return TYPE_INFO[type] || { cost: 0, rank: 9 };
}

/** Numérote les envies « terrain » (n-ième terrain de ce type). */
function numberWishes(list) {
  const seen = {};
  return list.map((w) => (w.kind === 'lot' ? { ...w, nth: (seen[w.type] = (seen[w.type] || 0) + 1) } : w));
}

/** Achète la première envie pas encore faite (en gardant `reserve`) ; passe les envies verrouillées. */
function shop(game, wishes, reserve) {
  for (const w of wishes) {
    const s = wishState(game, w);
    if (s.done || s.locked) continue;
    if (game.state.money - s.cost < reserve) return false;
    s.run();
    return true;
  }
  return false;
}

// ── Gestes ─────────────────────────────────────────────────────────────────────────────────
function pickCrop(game, i, { rnd, mode, keep }) {
  const cal = game.query.calendar();
  let options = game.query.plantableCrops(i).filter((o) => o.kind !== 'tree' && o.seedCost <= game.state.money - keep && cal.day < cal.totalDays);
  if (mode === 'optimal') {
    options = options.filter((o) => !o.willFreeze);
    if (!options.length) return null;
    const score = (o) => (o.sellPrice * 1.1 - o.seedCost) / Math.max(1, o.daysToMature);
    return options.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
  if (rnd() < HUMAN_PROFILES.casual.avoidFreeze) options = options.filter((o) => !o.willFreeze);
  if (!options.length) return null;
  // Le Carnet montre les objectifs du rang suivant : « vendre des produits transformés » → plus de cultures
  // pour l'atelier.
  const wantsProducts = (game.query.career.summary().nextRank?.objectives || []).some((ob) => ob.id === 'products' && !ob.done);
  const weight = (o) => (1 / Math.sqrt(o.seedCost * o.daysToMature)) * (o.product?.owned ? (wantsProducts ? 6 : 2) : 1);
  const total = options.reduce((s, o) => s + weight(o), 0);
  let r = rnd() * total;
  for (const o of options) {
    r -= weight(o);
    if (r <= 0) return o;
  }
  return options[options.length - 1];
}

function orchardTrees(game, lotPlots) {
  for (const i of lotPlots) {
    if (game.state.plots[i].cropId) continue;
    if (!game.query.plantableCrops(i).some((o) => o.id === 'apple')) return;
    if (game.state.money < 45 + seasonCharge(game)) return;
    game.actions.plant(i, 'apple');
  }
}

function casualDay(game, me) {
  const profile = HUMAN_PROFILES.casual;
  const cal = game.query.calendar();
  let taps = Math.round(between(me.rnd, profile.taps));
  const start = taps;
  const spend = (n) => {
    if (taps < n) return false;
    taps -= n;
    return true;
  };
  if (me.rnd() < profile.skipDay && cal.daysLeftInSeason > 0) return 0;
  const byLot = plotsByLot(game);
  // Récolte (glisser) : le jour même avec harvestProb, au plus tard le lendemain.
  const toHarvest = [];
  for (const [, list] of byLot) {
    for (const i of list) {
      const p = game.state.plots[i];
      if (!isMatureState(p)) {
        delete me.matureSince[i];
        continue;
      }
      if (me.matureSince[i] === undefined) me.matureSince[i] = me.day;
      if (me.day - me.matureSince[i] >= profile.maxDelay || me.rnd() < profile.harvestProb) toHarvest.push(i);
    }
  }
  if (toHarvest.length && spend(1)) {
    for (const i of toHarvest) {
      if (!spend(0.25)) break;
      if (game.actions.harvest(i).ok) delete me.matureSince[i];
    }
  }
  // Achats (un jour sur deux).
  if (me.rnd() < profile.buyProb && spend(3)) {
    const reserve = 2 * seasonCharge(game) + between(me.rnd, profile.buyBuffer);
    shop(game, me.wishes, reserve);
  }
  // Semis « semer partout », terrain par terrain.
  const keep = cal.daysLeftInSeason <= 2 && me.rnd() < profile.rentAware ? seasonCharge(game) : 0;
  for (const [lotId, list] of byLot) {
    const env = game.state.plots[list[0]].env;
    if (env === 'orchard') {
      if (spend(3)) orchardTrees(game, list);
      continue;
    }
    const empty = list.filter((i) => !game.state.plots[i].cropId);
    if (!empty.length || me.rnd() >= profile.plantProb || !spend(3)) continue;
    const pick = pickCrop(game, empty[0], { rnd: me.rnd, mode: 'casual', keep });
    if (!pick) continue;
    for (const i of empty) {
      if (game.state.money - pick.seedCost < keep) break;
      if (!game.actions.plant(i, pick.id).ok) break;
    }
    void lotId;
  }
  // Arrosage partiel (glisser).
  const thirsty = [];
  for (const [, list] of byLot) for (const i of list) if (game.query.plot(i).action === 'water') thirsty.push(i);
  if (thirsty.length && spend(1)) {
    const share = between(me.rnd, profile.water);
    for (const i of thirsty) {
      if (me.rnd() >= share) continue;
      if (!spend(0.25)) break;
      game.actions.water(i);
    }
  }
  // Grenier : tout vendu au Marché de Noël (hiver, jour 4).
  if (cal.seasonId === 'winter' && cal.dayOfSeason === 4 && game.state.career.buildings.storage && Object.keys(game.state.career.stock).length) game.actions.career.sellStock();
  return start - taps;
}

function optimalDay(game, me) {
  let gestures = 0;
  me.reserved = {};
  // Parcelles déjà semées pour un atelier (encore sur pied) : elles occuperont ces places.
  for (const p of game.state.plots) {
    if (!p.cropId || !p.env) continue;
    const t = p.cropId === 'strawberry' ? 'jamWorkshop' : p.cropId === 'wheat' && game.state.investments.mill ? 'mill' : null;
    if (t) me.reserved[t] = (me.reserved[t] || 0) + 1;
  }
  const byLot = plotsByLot(game);
  for (const [, list] of byLot) {
    for (const i of list) {
      if (isMatureState(game.state.plots[i]) && game.actions.harvest(i).ok) gestures++;
    }
  }
  shop(game, me.wishes, 2 * seasonCharge(game) + 20);
  // Toujours de quoi payer les charges de la saison (les semis du jour ne mûriront peut-être pas avant).
  const fin = game.query.finance();
  const keep = fin.nextBill.amount + fin.dailyCharges * (fin.nextBill.daysLeft + 1);
  for (const [, list] of byLot) {
    const env = game.state.plots[list[0]].env;
    if (env === 'orchard') {
      orchardTrees(game, list);
      continue;
    }
    let empty = list.filter((i) => !game.state.plots[i].cropId);
    if (!empty.length) continue;
    // Des cultures pour les places libres des ateliers (confitures…), puis la plus rentable.
    for (const w of game.query.processing()) {
      if (!w.on) continue;
      let free = w.places.filter((x) => x === null).length - (me.reserved[w.buildingId] || 0);
      const recipe = game.query.plantableCrops(empty[0]).find((o) => o.product?.buildingId === w.buildingId && o.product.owned && !o.willFreeze);
      while (free > 0 && recipe && empty.length && game.state.money - recipe.seedCost >= keep) {
        const i = empty.shift();
        if (game.actions.plant(i, recipe.id).ok) gestures++;
        free--;
        me.reserved[w.buildingId] = (me.reserved[w.buildingId] || 0) + 1;
      }
    }
    if (!empty.length) continue;
    const pick = pickCrop(game, empty[0], { mode: 'optimal', keep });
    if (!pick) continue;
    for (const i of empty) {
      if (game.state.money - pick.seedCost < keep) break;
      if (game.actions.plant(i, pick.id).ok) gestures++;
    }
  }
  for (const [, list] of byLot) for (const i of list) if (game.query.plot(i).action === 'water' && game.actions.water(i).ok) gestures++;
  // Grenier : vendre au bon cours.
  const stock = game.query.career.stock();
  for (const line of stock.lines) if (line.multiplier >= 1.15 || line.offSeason) game.actions.career.sellStock(line.cropId);
  return gestures;
}

// ── Une carrière ───────────────────────────────────────────────────────────────────────────
export function playCareer({ seed = 1, strategy = 'casual', years = 10, difficulty = 'detente', seasonLength = 7, assumeObjectives = false, onDay = null } = {}) {
  const game = createCareer({ seed, difficulty, seasonLength, farmName: 'Ferme simulée' });
  const me = { rnd: humanRng(humanSeed(seed, strategy)), matureSince: {}, day: 0, wishes: numberWishes(strategy === 'optimal' ? OPTIMAL_WISHES : CASUAL_WISHES) };
  if (strategy === 'optimal') game.actions.career.setStorageMode('low');
  const out = { seed, strategy, years: [], bankrupt: false, loans: 0, hardships: 0, rescues: 0 };
  let yearStats = { minMoney: game.state.money, gestures: 0, days: 0 };
  let current = null;
  game.on('neighbourLoan', () => out.loans++);
  game.on('hardship', (e) => {
    if (e.stage === 'overdraft') out.hardships++;
  });
  game.on('rescueSale', () => out.rescues++);
  game.on('yearEnd', ({ report }) => {
    current = report;
  });
  while (game.state.time.year <= years && game.state.status === 'playing') {
    me.day++;
    const g = strategy === 'optimal' ? optimalDay(game, me) : casualDay(game, me);
    yearStats.gestures += g;
    yearStats.days++;
    if (assumeObjectives) {
      for (const r of RANKS) for (const o of r.objectives) if (ASSUMED_TYPES.includes(o.type)) game.state.career.objectives[o.id] = true;
    }
    const before = game.state.time.year;
    if (onDay) onDay(game);
    game.update(DAY_SECONDS);
    yearStats.minMoney = Math.min(yearStats.minMoney, game.state.money);
    if (game.state.time.year !== before || game.state.status !== 'playing') {
      const rep = current || game.query.career.yearReport();
      out.years.push({
        year: before,
        rank: game.state.career.rank,
        patrimony: game.query.career.summary().patrimony,
        net: rep.net,
        money: game.state.money,
        minMoney: yearStats.minMoney,
        lots: game.state.career.lotsBought,
        plots: game.state.plots.filter((p) => p.env && p.unlocked).length,
        harvests: game.state.career.lifetime.harvests,
        products: game.state.career.lifetime.productsSold,
        gesturesPerDay: yearStats.gestures / Math.max(1, yearStats.days),
      });
      current = null;
      yearStats = { minMoney: game.state.money, gestures: 0, days: 0 };
    }
  }
  out.bankrupt = game.state.status === 'bankrupt';
  return out;
}

// ── Tableaux ───────────────────────────────────────────────────────────────────────────────
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function simulateCareer({ strategies = ['casual', 'optimal'], runs = 20, years = 10, difficulty = 'detente', seasonLength = 7, assumeObjectives = false, firstSeed = 1 } = {}) {
  const table = {};
  for (const strategy of strategies) {
    const careers = [];
    for (let k = 0; k < runs; k++) careers.push(playCareer({ seed: firstSeed + k, strategy, years, difficulty, seasonLength, assumeObjectives }));
    const rows = [];
    for (let y = 1; y <= years; y++) {
      const at = careers.map((c) => c.years.find((x) => x.year === y)).filter(Boolean);
      if (!at.length) break;
      const ranks = at.map((x) => x.rank);
      const dist = {};
      for (let r = 1; r <= 6; r++) dist[r] = Math.round((100 * ranks.filter((x) => x >= r).length) / careers.length);
      rows.push({
        year: y,
        rankMedian: median(ranks),
        rankAtLeast: dist,
        patrimony: Math.round(median(at.map((x) => x.patrimony))),
        net: Math.round(median(at.map((x) => x.net))),
        lots: median(at.map((x) => x.lots)),
        plots: median(at.map((x) => x.plots)),
        harvests: median(at.map((x) => x.harvests)),
        products: median(at.map((x) => x.products)),
        minMoney: Math.min(...at.map((x) => x.minMoney)),
        gestures: Math.round(median(at.map((x) => x.gesturesPerDay)) * 10) / 10,
      });
    }
    table[strategy] = {
      rows,
      bankrupt: Math.round((100 * careers.filter((c) => c.bankrupt).length) / careers.length),
      loans: median(careers.map((c) => c.loans)),
      hardships: median(careers.map((c) => c.hardships)),
      rescues: careers.filter((c) => c.rescues > 0).length,
      domaineYear: median(careers.map((c) => c.years.find((x) => x.rank >= 6)?.year ?? Infinity)),
    };
  }
  return table;
}

function printTable(table, title) {
  console.log(`\n${title}`);
  for (const [strategy, t] of Object.entries(table)) {
    console.log(`\n  ${strategy} — faillites ${t.bankrupt} % · prêts de Joseph (médiane) ${t.loans} · coups durs ${t.hardships} · carrières avec vente de secours ${t.rescues} · Domaine (médiane) ${Number.isFinite(t.domaineYear) ? `année ${t.domaineYear}` : 'jamais'}`);
    console.log('  année | rang méd. | ≥2   ≥3   ≥4   ≥5   ≥6  | patrimoine | bénéfice | terrains | parcelles | récoltes | produits | argent min | gestes/j');
    for (const r of t.rows) {
      const pct = [2, 3, 4, 5, 6].map((k) => `${String(r.rankAtLeast[k]).padStart(3)}%`).join(' ');
      console.log(`  ${String(r.year).padStart(5)} | ${String(r.rankMedian).padStart(9)} | ${pct} | ${String(r.patrimony).padStart(10)} | ${String(r.net).padStart(8)} | ${String(r.lots).padStart(8)} | ${String(r.plots).padStart(9)} | ${String(r.harvests).padStart(8)} | ${String(r.products).padStart(8)} | ${String(r.minMoney).padStart(10)} | ${String(r.gestures).padStart(8)}`);
    }
  }
}

function run() {
  const strategies = arg('strategy', null) ? [String(arg('strategy'))] : ['casual', 'optimal'];
  const opts = {
    strategies,
    runs: Number(arg('runs', 20)),
    years: Number(arg('years', 10)),
    difficulty: String(arg('difficulty', 'detente')),
    seasonLength: Number(arg('season', 7)),
    assumeObjectives: !!arg('assume-objectives', false),
  };
  if (arg('trace', false)) {
    const c = playCareer({ ...opts, strategy: strategies[0], seed: Number(arg('seed', 1)) });
    for (const y of c.years) console.log(JSON.stringify(y));
    console.log({ bankrupt: c.bankrupt, loans: c.loans, hardships: c.hardships, rescues: c.rescues });
    return;
  }
  const table = simulateCareer(opts);
  if (arg('json', false)) {
    console.log(JSON.stringify(table, null, 2));
    return;
  }
  printTable(table, `Carrière — ${opts.difficulty}, saisons de ${opts.seasonLength} jours, ${opts.runs} carrières × ${opts.years} ans${opts.assumeObjectives ? ' (objectifs CORE-B/C supposés remplis)' : ''}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) run();
