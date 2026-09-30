#!/usr/bin/env node
// Capture de parité v2 → v3 : enregistre, AVANT toute modification du cœur, le déroulé exact des
// niveaux 1 à 8 joués par des robots scriptés déterministes (plusieurs graines × plusieurs robots) :
// argent jour par jour, empreinte de l'état et des événements de chaque journée, résultat final.
//
//   node tools/capture-parity.js            écrit tests/fixtures/parity-v2.json (à ne lancer qu'une fois, en v2)
//   node tools/capture-parity.js --check    rejoue et compare au fichier (sans l'écrire)
//   node tools/capture-parity.js --v1-saves <dossier>   écrit tests/fixtures/v1-saves.json : vraies sauvegardes
//        v1 (en pleine journée) produites par le code v2 extrait dans <dossier> (git archive c938af8 src | tar -x -C <dossier>),
//        et la fin de leur partie en v2 (tests/migration.test.js)
//
// tests/parity.test.js importe `playParity` et `PARITY_CASES` d'ici et vérifie l'égalité exacte,
// sans bonus permanent (`perks = {}`), après les changements de la v3.
//
// L'empreinte ne porte que sur les champs de l'état et des événements qui existaient en v2 : les
// champs ajoutés par la v3 (bonus, fruits, ateliers, concours, nouvelles statistiques…) sont retirés
// avant le calcul, pour vérifier que les règles v2 donnent exactement les mêmes nombres.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGame } from '../src/core/game.js';
import { DAY_SECONDS } from '../src/data/balance.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = join(ROOT, 'tests/fixtures/parity-v2.json');

export const PARITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];
export const PARITY_SEEDS = [1, 2, 3, 7, 11, 42, 99, 123, 2024, 31337];
export const PARITY_BOTS = ['scripted', 'investor', 'random', 'sponsored', 'patron'];

export const PARITY_CASES = [];
for (const levelId of PARITY_LEVELS) {
  for (const bot of PARITY_BOTS) for (const seed of PARITY_SEEDS) PARITY_CASES.push({ levelId, bot, seed });
}

// ── Projection sur les champs v2 ─────────────────────────────────────────────────────────
const PLOT_KEYS = ['unlocked', 'cropId', 'growth', 'watered', 'lastHarvested', 'fatigued'];
const STAT_KEYS = [
  'harvestIncome', 'investmentIncome', 'charges', 'waterSpent', 'loanPaid', 'rentsPaid', 'seedsSpent',
  'investmentsSpent', 'plotsSpent', 'cropsPlanted', 'cropsHarvested', 'cropsLost',
];
/** Clés ajoutées par la v3 dans les événements et résumés : retirées avant l'empreinte. */
const V3_EVENT_KEYS = new Set([
  'tree', 'processed', 'refund', 'milkToDairy', 'productIncome', 'productsSold', 'rawSales', 'frostRefund',
  'contestPrize', 'minMoneyAfterRent', 'bestSeasonHarvestIncome', 'perks', 'processing', 'contest', 'fruit',
]);

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

function stripV3(value) {
  if (Array.isArray(value)) return value.map(stripV3);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (!V3_EVENT_KEYS.has(k)) out[k] = stripV3(v);
    return out;
  }
  return value;
}

/** État réduit aux champs v2 (ordre des clés fixé). */
export function projectState(s) {
  return {
    levelId: s.levelId,
    seed: s.seed,
    status: s.status,
    speed: s.speed,
    time: pick(s.time, ['day', 'seasonIndex', 'dayOfSeason', 'elapsed']),
    money: s.money,
    startMoney: s.startMoney,
    weather: pick(s.weather, ['today', 'tomorrow']),
    plots: s.plots.map((p) => pick(p, PLOT_KEYS)),
    plotsBought: s.plotsBought,
    investments: s.investments,
    market: s.market,
    rng: pick(s.rng, ['weather', 'market', 'rot']),
    stats: { year: pick(s.stats.year, STAT_KEYS), season: pick(s.stats.season, STAT_KEYS) },
    lastDawn: stripV3(s.lastDawn),
    result: s.result,
  };
}

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

// ── Robots scriptés (API publique v2 seulement) ──────────────────────────────────────────
export function lcg(seed) {
  let r = (Number(seed) * 7919 + 17) >>> 0;
  return () => (r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 4294967296;
}

export const BOTS = {
  // Récolte, achète un poulailler au-delà de 250, ouvre une parcelle au-delà de 300,
  // plante en alternant les cultures qui ne gèleront pas, arrose tout.
  scripted(g) {
    const n = g.state.plots.length;
    for (let i = 0; i < n; i++) if (g.query.plot(i).action === 'harvest') g.actions.harvest(i);
    if (g.state.money > 250) g.actions.buyInvestment('chickenCoop');
    if (g.state.money > 300) {
      const locked = g.state.plots.findIndex((p) => !p.unlocked);
      if (locked >= 0) g.actions.unlockPlot(locked);
    }
    const crops = g.query.plantableCrops().filter((c) => !c.willFreeze);
    for (let i = 0; i < n; i++) {
      if (g.query.plot(i).action === 'plant' && crops.length) g.actions.plant(i, crops[i % crops.length].id);
    }
    for (let i = 0; i < n; i++) if (g.query.plot(i).action === 'water') g.actions.water(i);
  },
  // Achète tout investissement abordable (ordre des données), puis plante la culture la plus chère
  // abordable qui ne gèlera pas, arrose tout.
  investor(g) {
    for (const p of g.query.plots()) if (p.action === 'harvest') g.actions.harvest(p.index);
    const bill = g.query.finance().nextBill;
    for (const inv of g.query.investments()) {
      if (inv.canBuy && g.state.money - inv.nextCost > bill.amount + 40) g.actions.buyInvestment(inv.id);
    }
    for (const p of g.query.plots()) {
      if (p.action !== 'plant') continue;
      const options = g.query.plantableCrops(p.index).filter((c) => c.canAfford && !c.willFreeze);
      if (!options.length) continue;
      const best = options.reduce((a, b) => (b.seedCost > a.seedCost ? b : a));
      g.actions.plant(p.index, best.id);
    }
    for (const p of g.query.plots()) if (p.action === 'water') g.actions.water(p.index);
  },
  // Joueur au hasard (tirages déterministes) : récoltes, plantations, arrosages partiels,
  // parcelles et investissements au hasard.
  random(g, rnd) {
    for (const p of g.query.plots()) {
      if (p.action === 'harvest' && rnd() < 0.9) g.actions.harvest(p.index);
      else if (p.action === 'plant' && rnd() < 0.8) {
        const crops = g.query.plantableCrops(p.index);
        if (crops.length) g.actions.plant(p.index, crops[Math.floor(rnd() * crops.length)].id);
      } else if (p.action === 'water' && rnd() < 0.7) g.actions.water(p.index);
      else if (p.action === 'unlock' && rnd() < 0.04) g.actions.unlockPlot(p.index);
    }
    const buyable = g.query.investments().filter((i) => i.canBuy);
    if (buyable.length && rnd() < 0.3) g.actions.buyInvestment(buyable[Math.floor(rnd() * buyable.length)].id);
  },
  // Comme « random », mais reçoit 90 pièces par jour : tient l'année entière (hiver, victoire, tous
  // les achats), pour couvrir tout le calendrier.
  sponsored(g, rnd) {
    BOTS.random(g, rnd);
    g.state.money += 90;
  },
  // Riche : reçoit 150 pièces par jour, achète tout (parcelles comprises), plante et arrose tout.
  patron(g) {
    g.state.money += 150;
    BOTS.investor(g);
    for (const p of g.query.plots()) if (p.action === 'unlock' && g.state.money > 400) g.actions.unlockPlot(p.index);
  },
};

/**
 * Joue une partie de parité. Renvoie { money, status, stars, day, stats, days: [argent], hashes: [empreinte/jour], final }.
 * @param {object} opts { levelId, bot, seed, perks } — perks transmis à createGame (absent en v2)
 */
export function playParity({ levelId, bot, seed, perks }) {
  const g = perks === undefined ? createGame({ levelId, seed }) : createGame({ levelId, seed, perks });
  const rnd = lcg(seed + levelId * 1000);
  let events = [];
  g.on('*', (e) => events.push(JSON.stringify(stripV3(e))));
  const days = [];
  const hashes = [];
  for (let d = 0; d < 80 && g.state.status === 'playing'; d++) {
    BOTS[bot](g, rnd);
    // Deux pas inégaux : une journée coupée en plein milieu doit donner le même résultat.
    g.update(DAY_SECONDS * 0.37);
    g.update(DAY_SECONDS * 0.63);
    days.push(g.state.money);
    hashes.push(hash(JSON.stringify(projectState(g.state)) + '\n' + events.join('\n')));
    events = [];
  }
  const s = g.state;
  return {
    money: s.money,
    status: s.status,
    stars: s.result?.stars ?? 0,
    day: s.time.day,
    stats: pick(s.stats.year, STAT_KEYS),
    days,
    hashes,
    final: hash(JSON.stringify(projectState(s))),
  };
}

function captureAll() {
  const out = {};
  for (const c of PARITY_CASES) out[`${c.levelId}/${c.bot}/${c.seed}`] = playParity(c);
  return out;
}

// ── Robots de la simulation d'équilibrage (tools/simulate.js), sans bonus ─────────────────
export const SIM_STRATEGIES = ['careless', 'balanced', 'investor', 'optimal'];
export const SIM_SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Résultat d'une partie d'un robot de la simulation, réduit aux champs v2. */
export async function playSim(levelId, seed, strategy) {
  const { playOne } = await import('./simulate.js');
  const r = playOne(levelId, seed, strategy);
  return {
    win: r.win,
    money: r.money,
    stars: r.stars,
    stats: pick(r.summary, STAT_KEYS),
    investments: r.summary.investments,
  };
}

async function captureSim() {
  const out = {};
  for (const levelId of PARITY_LEVELS) {
    for (const strategy of SIM_STRATEGIES) {
      for (const seed of SIM_SEEDS) out[`${levelId}/${strategy}/${seed}`] = await playSim(levelId, seed, strategy);
    }
  }
  return out;
}

/** Sauvegardes v1 réelles (code v2 extrait dans `dir`), pour tests/migration.test.js. */
async function captureV1Saves(dir) {
  const { createGame: createV2 } = await import(pathToFileURL(join(dir, 'src/core/game.js')).href);
  const out = [];
  for (const levelId of PARITY_LEVELS) {
    for (const [bot, seed, stopDay] of [['sponsored', 3, 5], ['patron', 42, 17], ['patron', 11, 12], ['scripted', 7, 9]]) {
      const g = createV2({ levelId, seed });
      const rnd = lcg(seed + levelId * 1000);
      while (g.state.status === 'playing' && g.state.time.day < stopDay) {
        BOTS[bot](g, rnd);
        g.update(DAY_SECONDS);
      }
      BOTS[bot](g, rnd);
      g.update(7.3); // en pleine journée
      const saved = JSON.parse(JSON.stringify(g.serialize()));
      for (let d = 0; d < 80 && g.state.status === 'playing'; d++) {
        BOTS[bot](g, rnd);
        g.update(DAY_SECONDS);
      }
      out.push({ levelId, bot, seed, stopDay, saved, final: hash(JSON.stringify(projectState(g.state))), money: g.state.money, status: g.state.status });
    }
  }
  writeFileSync(join(ROOT, 'tests/fixtures/v1-saves.json'), JSON.stringify(out) + '\n');
  console.log(`Capturé : ${out.length} sauvegardes v1 → tests/fixtures/v1-saves.json`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && process.argv.includes('--v1-saves')) {
  await captureV1Saves(process.argv[process.argv.indexOf('--v1-saves') + 1]);
} else if (isMain) {
  const check = process.argv.includes('--check');
  const results = captureAll();
  const sim = await captureSim();
  if (check) {
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    for (const [k, v] of Object.entries(sim)) {
      if (JSON.stringify(v) !== JSON.stringify(fixture.sim[k])) {
        console.log(`SIMULATION DIFFÉRENTE ${k}`);
        process.exitCode = 1;
      }
    }
    const saved = fixture.cases;
    let bad = 0;
    for (const [k, v] of Object.entries(results)) {
      if (JSON.stringify(v) !== JSON.stringify(saved[k])) {
        bad++;
        const i = v.hashes.findIndex((h, j) => h !== saved[k]?.hashes[j]);
        console.log(`DIFFÉRENT ${k} (premier jour différent : ${i + 1})`);
      }
    }
    console.log(bad ? `${bad} parties différentes sur ${PARITY_CASES.length}` : `Parité exacte : ${PARITY_CASES.length} parties identiques`);
    if (bad) process.exitCode = 1;
    process.exit();
  }
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(
    FIXTURE,
    JSON.stringify({ capturedAt: new Date().toISOString(), note: 'Résultats v2 des niveaux 1 à 8 (robots scriptés et robots de la simulation) — ne pas régénérer après la v3', cases: results, sim }) + '\n',
  );
  const wins = Object.values(results).filter((r) => r.status === 'victory').length;
  console.log(`Capturé : ${PARITY_CASES.length} parties (${wins} victoires) → ${FIXTURE}`);
}
