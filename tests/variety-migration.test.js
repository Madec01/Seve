// Lot 3 « Variété » — sauvegardes : migration (Détente, Classique, carrière), aller-retour, vérification
// (checkVariety), progression (progress.lifetime.variety). Contrat : docs/ARCHITECTURE.md, « Lot 3 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame, migrateState } from '../src/core/game.js';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { checkVariety } from '../src/core/variety.js';
import { defaultProgress, normalizeProgress, recordCareerYear, recordRunEnd } from '../src/core/progression.js';
import { DAY_SECONDS, nextDay, skipDays } from './helpers.js';

/** Sauvegarde « d'avant le lot 3 » : sans state.variety ni ses flux. */
function preLot3(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  delete s.variety;
  delete s.rng.orders;
  delete s.rng.variety;
  if (s.stats) for (const k of ['year', 'season']) {
    delete s.stats[k].varietyIncome;
    delete s.stats[k].varietySpent;
  }
  if (s.career) delete s.career.theme;
  return s;
}

test('migration : une partie Détente d\'avant le lot 3 reçoit la variété (tableau à l\'aube suivante, charrette et défis à la saison suivante)', () => {
  const g = createGame({ levelId: 2, seed: 5, difficulty: 'detente', variety: false });
  skipDays(g, 3);
  const old = preLot3(g.serialize());
  const back = loadGame(old);
  const v = back.state.variety;
  assert.ok(v);
  assert.equal(v.board.startDay, old.time.day + 1);
  assert.ok(v.board.slots.every((o) => o === null));
  assert.equal(v.cart, null);
  assert.equal(v.challenges.season, null);
  assert.equal(v.merchant, null);
  assert.ok(Number.isInteger(back.state.rng.orders) && Number.isInteger(back.state.rng.variety));
  // Les flux existants ne bougent pas.
  for (const k of ['weather', 'market', 'rot', 'quality', 'surprise', 'sky']) assert.equal(back.state.rng[k], old.rng[k]);
  nextDay(back);
  assert.ok(back.state.variety.board.slots.some(Boolean), 'tableau rempli à l\'aube suivante');
  while (back.state.time.seasonIndex === 0) nextDay(back);
  assert.ok(back.query.cart(), 'charrette à la saison suivante');
  assert.equal(back.query.challenges().options.length, 3, 'défis à la saison suivante');
});

test('migration : une partie Classique ne reçoit jamais la variété ; variety: null est gardé tel quel', () => {
  const g = createGame({ levelId: 3, seed: 2, difficulty: 'classique' });
  skipDays(g, 2);
  const m = migrateState(g.serialize());
  assert.equal('variety' in m, false);
  const back = loadGame(g.serialize());
  assert.equal('variety' in back.state, false);
  const off = createGame({ levelId: 3, seed: 2, difficulty: 'detente', variety: false });
  const b2 = loadGame(off.serialize());
  assert.equal(b2.state.variety, null);
});

test('sauvegarde : aller-retour exact en pleine partie (tableau commencé, charrette, cartes, défis, colporteur, graines rares)', () => {
  const g = createGame({ levelId: 2, seed: 8, difficulty: 'detente' });
  g.state.money = 3000;
  skipDays(g, 4);
  g.state.variety.rare.pea = 2;
  g.state.variety.freeSows.carrot = 1;
  const saved = g.serialize();
  const back = loadGame(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.serialize(), saved);
  for (let d = 0; d < 15; d++) {
    g.update(DAY_SECONDS);
    back.update(DAY_SECONDS);
  }
  assert.deepEqual(back.serialize(), g.serialize());
});

test('checkVariety : refuse un état abîmé (version, client, culture, 0 ≤ got ≤ n, 3 places, 2 défis, entiers, flux)', () => {
  const g = createGame({ levelId: 2, seed: 8, difficulty: 'detente' });
  const ok = g.serialize();
  assert.equal(checkVariety(ok), null);
  const bad = (fn) => {
    const s = JSON.parse(JSON.stringify(ok));
    fn(s);
    return checkVariety(s);
  };
  assert.ok(bad((s) => (s.variety.v = 99)));
  assert.ok(bad((s) => (s.variety.board.slots[0].clientId = 'inconnu')));
  assert.ok(bad((s) => (s.variety.board.slots[0].lines[0].cropId = 'banane')));
  assert.ok(bad((s) => (s.variety.board.slots[0].lines[0].cropId = 'pea')), 'jamais une graine rare');
  assert.ok(bad((s) => (s.variety.board.slots[0].lines[0].got = s.variety.board.slots[0].lines[0].n + 1)));
  assert.ok(bad((s) => s.variety.board.slots.push(null)));
  assert.ok(bad((s) => {
    s.variety.challenges.options = ['harvests', 'sales', 'orders'];
    s.variety.challenges.kept = ['harvests', 'sales', 'orders'];
  }));
  assert.ok(bad((s) => (s.variety.rare.pea = -1)));
  assert.ok(bad((s) => (s.variety.freeSows.carrot = 1.5)));
  assert.ok(bad((s) => delete s.rng.orders));
  assert.ok(bad((s) => (s.variety.cards.offer = { season: 1, options: ['purse', 'banane'] })));
  assert.throws(() => loadGame(JSON.parse(JSON.stringify({ ...ok, variety: { ...ok.variety, v: 7 } }))), /Sauvegarde invalide/);
});

test('migration (carrière) : une ancienne carrière reçoit la variété à la reprise, sans thème pour l\'année en cours', () => {
  const g = createCareer({ seed: 4, variety: false });
  g.state.weather.today = 'sunny';
  skipDays(g, 10);
  const old = preLot3(g.serialize());
  const back = loadCareer(old);
  assert.ok(back.state.variety);
  assert.deepEqual(back.state.career.theme, { year: 1, id: null, next: null, bag: [], festivalDone: false, visitor: null, history: [] });
  assert.equal(back.query.career.theme().id, null);
  // Aller-retour exact ensuite.
  const saved = back.serialize();
  assert.deepEqual(loadCareer(JSON.parse(JSON.stringify(saved))).serialize(), saved);
  // variety: false gardé à la reprise.
  const off = createCareer({ seed: 4, variety: false });
  assert.equal(loadCareer(off.serialize()).state.variety, null);
});

test('progression : progress.lifetime.variety (commandes, charrettes pleines, médailles, graines rares) — niveaux et carrière', () => {
  const p = defaultProgress();
  assert.deepEqual(p.lifetime.variety, { orders: 0, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 0 }, rare: {} });
  const summary = { cropsHarvested: {}, productsSold: {}, cropsLost: { frost: 0, rot: 0 }, harvestIncome: 0, bestSeasonHarvestIncome: 0, rentsPaid: 0, variety: { ordersDone: 4, cartsFull: 1, medals: { bronze: 2, silver: 1, gold: 0 }, rareHarvested: { pea: 3, banane: 2 } } };
  const r = recordRunEnd(p, { levelId: 2, outcome: 'victory', stars: 2, money: 300, summary });
  assert.deepEqual(r.progress.lifetime.variety, { orders: 4, cartsFull: 1, medals: { bronze: 2, silver: 1, gold: 0 }, rare: { pea: 3 } });
  const c = recordCareerYear(r.progress, { year: 1, rank: 2, net: 500, report: { cropsHarvested: {}, productsSold: {}, variety: { ordersDone: 2, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 1 }, rareHarvested: { leek: 1 } } } });
  assert.deepEqual(c.progress.lifetime.variety, { orders: 6, cartsFull: 1, medals: { bronze: 2, silver: 1, gold: 1 }, rare: { pea: 3, leek: 1 } });
  // Normalisation : valeurs abîmées → 0 ; progression d'avant le lot 3 → compteurs vides.
  const n = normalizeProgress({ lifetime: { harvests: 3, variety: { orders: -2, cartsFull: 'x', medals: { gold: 2.5 }, rare: { pea: 2, kiwi: 1 } } } });
  assert.deepEqual(n.lifetime.variety, { orders: 0, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 2 }, rare: { pea: 2 } });
  assert.deepEqual(normalizeProgress({ lifetime: { harvests: 1 } }).lifetime.variety, { orders: 0, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 0 }, rare: {} });
});
