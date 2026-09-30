// Modes de difficulté (détente / classique) et prêt du voisin (mode détente).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame } from '../src/core/game.js';
import { DIFFICULTIES, DIFFICULTY_IDS, DEFAULT_DIFFICULTY, LEGACY_DIFFICULTY, levelFor, levelsFor } from '../src/data/difficulty.js';
import { LEVELS, getLevel } from '../src/data/levels.js';
import { BASE_DAILY_CHARGE, GROWTH } from '../src/data/balance.js';
import * as P from '../src/core/progression.js';
import { DAY_SECONDS, goToDay, newGame, nextDay, openPlots, record, rich, skipDays } from './helpers.js';

const detente = (levelId = 1, seed = 42) => newGame(levelId, seed, { difficulty: 'detente' });
const LOAN = DIFFICULTIES.detente.neighbourLoan;

/** Amène la partie au soir du dernier jour de la saison en cours, avec `money` pièces. */
function lastDayWith(g, money) {
  const cal = g.query.calendar();
  goToDay(g, cal.day + cal.daysLeftInSeason);
  g.state.money = money;
}

// ── Données ──────────────────────────────────────────────────────────────────────────

test('modes : détente par défaut, classique = données d\'origine', () => {
  assert.deepEqual(DIFFICULTY_IDS, ['detente', 'classique']);
  assert.equal(DEFAULT_DIFFICULTY, 'detente');
  assert.equal(LEGACY_DIFFICULTY, 'classique');
  for (const base of LEVELS) {
    const c = levelFor(base.id, 'classique');
    for (const k of ['startMoney', 'rents', 'starThresholds', 'modifiers', 'seasonLengths', 'description', 'weather']) assert.deepEqual(c[k], base[k], `${base.id} ${k}`);
    assert.equal(c.dailyCharge, BASE_DAILY_CHARGE);
    assert.equal(c.dryGrowth, GROWTH.dry);
    assert.equal(c.dryHeatwaveGrowth, GROWTH.dryHeatwave);
    assert.equal(c.cropPriceFactor, 1);
    assert.equal(c.neighbourLoan, null);
    assert.equal(getLevel(base.id).difficulty, 'classique');
    // Détente : la contrainte du niveau reste (mêmes cultures, investissements, grille, saisons, météo, règles).
    const d = levelFor(base.id, 'detente');
    for (const k of ['crops', 'availableInvestments', 'gridCols', 'gridRows', 'maxPlots', 'seasonLengths', 'weather', 'contest', 'startTrees']) assert.deepEqual(d[k], base[k], `${base.id} ${k}`);
    for (const k of ['waterCost', 'rotChance', 'priceVolatility', 'soilFatigue', 'noSprinkler', 'rawPriceFactor', 'pollination']) assert.deepEqual(d.modifiers[k], base.modifiers[k], `${base.id} ${k}`);
    assert.equal(d.difficulty, 'detente');
    assert.ok(d.startMoney >= base.startMoney, `${base.id} : départ au moins aussi riche`);
    d.rents.forEach((r, i) => assert.ok(r <= base.rents[i], `${base.id} : fermage ${i} pas plus cher`));
    assert.ok(d.starThresholds[0] < d.starThresholds[1]);
    assert.ok(d.neighbourLoan && d.neighbourLoan !== DIFFICULTIES.detente.neighbourLoan, 'copie du réglage');
  }
  assert.equal(levelFor(1, 'detente'), levelFor(1, 'detente'), 'même objet (cache)');
  assert.equal(levelFor(99, 'detente'), null);
  assert.equal(levelFor(1, 'difficile'), null);
  assert.deepEqual(levelsFor('classique').map((l) => l.id), LEVELS.map((l) => l.id));
  // Niveau 7 : mensualité réduite, et la description le dit.
  const l7 = levelFor(7, 'detente');
  assert.ok(l7.description.includes(String(l7.modifiers.loan.payment)));
});

test('createGame : difficulté par défaut, inconnue refusée, query.difficulty()', () => {
  const g = createGame({ levelId: 1, seed: 1 });
  assert.equal(g.state.difficulty, 'detente');
  assert.equal(g.difficulty, 'detente');
  assert.deepEqual(Object.keys(g.query.difficulty()), ['id', 'name', 'description']);
  assert.equal(g.query.difficulty().name, 'Détente');
  assert.equal(g.level, levelFor(1, 'detente'));
  assert.equal(g.query.level(), levelFor(1, 'detente'));
  assert.equal(g.state.money, levelFor(1, 'detente').startMoney);
  assert.deepEqual(g.state.neighbourLoan, { debt: 0, borrowed: 0, repaid: 0, forgiven: 0, loans: 0 });
  const c = createGame({ levelId: 1, seed: 1, difficulty: 'classique' });
  assert.equal(c.state.difficulty, 'classique');
  assert.equal(c.state.neighbourLoan, null);
  assert.equal(c.state.money, getLevel(1).startMoney);
  assert.equal(c.query.finance().neighbourLoan, null);
  assert.throws(() => createGame({ levelId: 1, difficulty: 'difficile' }), /Difficulté inconnue/);
  // Même graine : même météo dans les deux modes (le mode ne consomme aucun tirage).
  assert.deepEqual(g.state.weather, c.state.weather);
  assert.deepEqual(g.state.rng, c.state.rng);
});

// ── Nombres du mode détente ──────────────────────────────────────────────────────────

test('détente : charges, fermage, pousse sans arrosage, prix des récoltes', () => {
  const g = detente(1);
  const lvl = g.level;
  assert.equal(g.query.finance().dailyCharges, lvl.dailyCharge);
  assert.equal(g.query.finance().nextBill.amount, lvl.rents[0]);
  // Carotte non arrosée : 0,75 jour de pousse (classique : 0,5).
  const [a, b] = openPlots(g);
  assert.ok(g.actions.plant(a, 'carrot').ok);
  assert.ok(g.actions.plant(b, 'carrot').ok);
  assert.ok(g.actions.water(b).ok);
  nextDay(g, 'sunny');
  assert.equal(g.state.plots[a].growth, lvl.dryGrowth);
  assert.equal(g.state.plots[b].growth, 1);
  // Canicule : 0,25 sans arrosage.
  g.state.plots[a].growth = 0;
  g.state.weather.today = 'heatwave';
  nextDay(g, 'sunny');
  assert.equal(g.state.plots[a].growth, lvl.dryHeatwaveGrowth);
  // Prix : 10 × 1,25 = 12,5 → 13 (arrondi) ; classique : 10.
  g.state.plots[b].growth = 2;
  assert.equal(g.query.plot(b).harvestValue, Math.round(10 * lvl.cropPriceFactor));
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'carrot').sellPrice, Math.round(10 * lvl.cropPriceFactor));
  const c = newGame(1, 42);
  const [x] = openPlots(c);
  c.actions.plant(x, 'carrot');
  nextDay(c, 'sunny');
  assert.equal(c.state.plots[x].growth, GROWTH.dry);
  c.state.plots[x].growth = 2;
  assert.equal(c.query.plot(x).harvestValue, 10);
  // La pomme de terre garde ses propres règles (pousse sans eau) ; l'eau reste utile aux autres.
  assert.equal(g.query.plantableCrops().find((cr) => cr.id === 'carrot').noWater, false);
});

test('détente : les produits transformés gardent leur prix (seules les récoltes brutes changent)', () => {
  const g = detente(9);
  rich(g);
  assert.ok(g.actions.buyInvestment('jamWorkshop').ok);
  const jam = g.query.plantableCrops().find((c) => c.id === 'strawberry');
  assert.equal(jam.product.value, 46);
  assert.equal(jam.sellPrice, Math.round(26 * 0.75 * g.level.cropPriceFactor));
});

// ── Prêt du voisin ───────────────────────────────────────────────────────────────────

test('prêt du voisin : fermage manqué → prêt automatique, fermage payé, la partie continue', () => {
  const g = detente(1);
  const rent = g.level.rents[0];
  lastDayWith(g, rent - 15);
  const fin = g.query.finance().neighbourLoan;
  assert.equal(fin.available, true);
  assert.equal(fin.wouldLend, 15 + LOAN.cushion);
  const log = record(g);
  nextDay(g);
  assert.equal(g.state.status, 'playing');
  const loan = log.of('neighbourLoan');
  assert.equal(loan.length, 1);
  const amount = 15 + LOAN.cushion;
  const debt = Math.ceil(amount * (1 + LOAN.surcharge));
  assert.deepEqual(
    { ...loan[0], type: undefined },
    { type: undefined, amount, debt, missing: 15, rent, seasonId: 'spring', surcharge: debt - amount, repayShare: LOAN.repayShare },
  );
  // Ordre : prêt, puis fermage payé.
  const types = log.events.map((e) => e.type);
  assert.ok(types.indexOf('neighbourLoan') < types.indexOf('billPaid'));
  assert.deepEqual(g.state.neighbourLoan, { debt, borrowed: amount, repaid: 0, forgiven: 0, loans: 1 });
  assert.equal(g.query.finance().neighbourLoan.debt, debt);
  assert.equal(g.query.finance().neighbourLoan.available, false);
  // Après le fermage : il reste le coussin, moins les charges de l'aube.
  assert.equal(g.state.money, LOAN.cushion - g.query.finance().dailyCharges);
  // Le bilan de l'année compte le prêt.
  assert.deepEqual(g.query.summary().neighbourLoan, g.state.neighbourLoan);
});

test('prêt du voisin : remboursé sur les ventes (moitié, arrondi supérieur), puis loanRepaid', () => {
  const g = detente(1);
  rich(g, 1000);
  g.state.neighbourLoan.debt = 10;
  g.state.neighbourLoan.borrowed = 9;
  g.state.neighbourLoan.loans = 1;
  const [a, b] = openPlots(g);
  g.actions.plant(a, 'carrot');
  g.actions.plant(b, 'carrot');
  g.state.plots[a].growth = 2;
  g.state.plots[b].growth = 2;
  const log = record(g);
  const before = g.state.money;
  const r1 = g.actions.harvest(a); // 13 pièces → 7 au voisin
  assert.equal(r1.amount, 13);
  assert.equal(r1.loanRepayment, 7);
  assert.equal(g.state.money, before + 13 - 7);
  assert.equal(log.of('harvested')[0].loanRepayment, 7);
  assert.deepEqual({ ...log.of('loanRepayment')[0], type: undefined }, { type: undefined, amount: 7, remaining: 3, source: 'harvest' });
  const r2 = g.actions.harvest(b); // il ne reste que 3
  assert.equal(r2.loanRepayment, 3);
  assert.equal(g.state.neighbourLoan.debt, 0);
  assert.equal(g.state.neighbourLoan.repaid, 10);
  assert.equal(log.of('loanRepaid').length, 1);
  assert.equal(log.of('loanRepaid')[0].source, 'harvest');
  // Plus de dette : plus rien n'est repris, et le champ n'apparaît plus.
  g.actions.plant(a, 'carrot');
  g.state.plots[a].growth = 2;
  const r3 = g.actions.harvest(a);
  assert.equal(r3.loanRepayment, undefined);
  assert.equal(log.of('harvested')[2].loanRepayment, undefined);
});

test('prêt du voisin : part des produits vendus à l\'aube (charge « neighbour »)', () => {
  const g = detente(9);
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  const [a] = openPlots(g);
  g.actions.plant(a, 'strawberry');
  g.state.plots[a].growth = 4;
  assert.ok(g.actions.harvest(a).processed);
  g.state.neighbourLoan.debt = 100;
  g.state.neighbourLoan.loans = 1;
  const log = record(g);
  skipDays(g, 2);
  const sale = log.of('productSold')[0];
  assert.ok(sale);
  const part = Math.ceil(sale.amount * LOAN.repayShare);
  const dawn = log.of('dawn').find((d) => d.chargesDetail.some((c) => c.source === 'neighbour'));
  assert.deepEqual(dawn.chargesDetail.find((c) => c.source === 'neighbour'), { source: 'neighbour', amount: part });
  assert.equal(g.state.neighbourLoan.debt, 100 - part);
  assert.equal(log.of('loanRepayment')[0].source, 'product');
});

test('prêt du voisin : faillite si une dette est en cours, ou si le manque dépasse le plafond', () => {
  // Dette en cours.
  const g = detente(1);
  g.state.neighbourLoan.debt = 5;
  g.state.neighbourLoan.loans = 1;
  lastDayWith(g, g.level.rents[0] - 1);
  assert.equal(g.query.finance().neighbourLoan.wouldLend, null);
  const log = record(g);
  nextDay(g);
  assert.equal(g.state.status, 'bankrupt');
  assert.equal(log.of('neighbourLoan').length, 0);
  assert.equal(log.of('bankrupt')[0].neighbourDebt, 5);
  assert.equal(g.state.result.neighbourDebt, 5);
  // Manque trop grand (plafond : max(minCover, maxShare × fermage)).
  const h = detente(5);
  goToDay(h, 21); // dernier jour de l'automne
  const rent = h.level.rents[2];
  const cap = Math.max(LOAN.minCover, Math.floor(rent * LOAN.maxShare));
  assert.equal(h.query.finance().neighbourLoan.maxMissing, cap);
  h.state.money = rent - cap - 1;
  assert.equal(h.query.finance().neighbourLoan.wouldLend, null);
  nextDay(h);
  assert.equal(h.state.status, 'bankrupt');
  // Juste au plafond : prêt accordé.
  const k = detente(5);
  goToDay(k, 21);
  k.state.money = rent - cap;
  nextDay(k);
  assert.equal(k.state.status, 'playing');
  assert.equal(k.state.neighbourLoan.borrowed, cap + LOAN.cushion);
});

test('prêt du voisin : un second prêt est possible une fois le premier remboursé', () => {
  const g = detente(1);
  lastDayWith(g, g.level.rents[0] - 10);
  nextDay(g);
  assert.equal(g.state.neighbourLoan.loans, 1);
  rich(g, 1000);
  const res = g.actions.repayNeighbour();
  assert.ok(res.ok);
  assert.equal(res.remaining, 0);
  lastDayWith(g, g.level.rents[1] - 10);
  nextDay(g);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.neighbourLoan.loans, 2);
});

test('prêt du voisin : dernier fermage sans coussin ; fin d\'année, le voisin reprend ce qu\'il peut et efface le reste', () => {
  const g = detente(1);
  rich(g, 10000);
  goToDay(g, 28);
  assert.equal(g.state.neighbourLoan.loans, 0);
  const rent = g.level.rents[3];
  g.state.money = rent - 20;
  assert.equal(g.query.finance().neighbourLoan.wouldLend, 20);
  const log = record(g);
  nextDay(g);
  assert.equal(g.state.status, 'victory');
  assert.equal(log.of('neighbourLoan')[0].amount, 20);
  assert.equal(log.of('loanForgiven')[0].amount, Math.ceil(20 * (1 + LOAN.surcharge)));
  assert.equal(log.of('loanRepaid')[0].source, 'yearEnd');
  assert.equal(g.state.money, 0);
  assert.equal(g.state.result.stars, 1);
  assert.equal(g.state.neighbourLoan.debt, 0);
  const types = log.events.map((e) => e.type);
  assert.ok(types.indexOf('loanRepaid') < types.indexOf('victory'), 'dette réglée avant la victoire');

  // Dette ancienne et argent suffisant : remboursée en entier, les étoiles comptent l'argent restant.
  const h = detente(1);
  rich(h, 10000);
  goToDay(h, 28);
  h.state.neighbourLoan.debt = 40;
  h.state.neighbourLoan.loans = 1;
  h.state.money = h.level.rents[3] + 100;
  const log2 = record(h);
  nextDay(h);
  assert.equal(h.state.status, 'victory');
  assert.equal(h.state.money, 60);
  assert.equal(log2.of('loanForgiven').length, 0);
  assert.deepEqual({ ...log2.of('loanRepayment')[0], type: undefined }, { type: undefined, amount: 40, remaining: 0, source: 'yearEnd' });
  assert.equal(log2.of('victory')[0].money, 60);
});

test('repayNeighbour : refus et remboursement partiel', () => {
  const c = newGame(1, 42);
  assert.equal(c.actions.repayNeighbour().ok, false);
  const g = detente(1);
  assert.match(g.actions.repayNeighbour().reason, /rien/);
  g.state.neighbourLoan.debt = 50;
  g.state.money = 20;
  assert.equal(g.actions.repayNeighbour(0).ok, false);
  const log = record(g);
  const r = g.actions.repayNeighbour();
  assert.deepEqual(r, { ok: true, amount: 20, remaining: 30 });
  assert.equal(g.state.money, 0);
  assert.equal(log.of('loanRepayment')[0].source, 'player');
  assert.equal(g.actions.repayNeighbour().ok, false, 'plus d\'argent');
  g.state.money = 100;
  assert.deepEqual(g.actions.repayNeighbour(10), { ok: true, amount: 10, remaining: 20 });
  assert.deepEqual(g.actions.repayNeighbour(), { ok: true, amount: 20, remaining: 0 });
  assert.equal(log.of('loanRepaid').length, 1);
});

test('mode classique : aucune règle du prêt, faillite immédiate comme avant', () => {
  const g = newGame(1, 42);
  lastDayWith(g, g.level.rents[0] - 1);
  const log = record(g);
  nextDay(g);
  assert.equal(g.state.status, 'bankrupt');
  assert.equal(log.of('neighbourLoan').length, 0);
  assert.equal('neighbourDebt' in log.of('bankrupt')[0], false);
  assert.equal('neighbourLoan' in log.of('bankrupt')[0].summary, false);
});

// ── Sauvegardes ──────────────────────────────────────────────────────────────────────

test('sauvegarde : mode et prêt du voisin conservés ; parties d\'avant les modes → classique', () => {
  const g = detente(1, 5);
  lastDayWith(g, 3);
  nextDay(g);
  assert.ok(g.state.neighbourLoan.debt > 0);
  const saved = JSON.parse(JSON.stringify(g.serialize()));
  const h = loadGame(saved);
  assert.equal(h.state.difficulty, 'detente');
  assert.equal(h.level, levelFor(1, 'detente'));
  assert.deepEqual(h.state.neighbourLoan, g.state.neighbourLoan);
  // Même suite de journées.
  for (let d = 0; d < 5; d++) {
    g.update(DAY_SECONDS);
    h.update(DAY_SECONDS);
  }
  assert.deepEqual(h.serialize(), g.serialize());
  // Sauvegarde d'avant les modes (ni difficulty ni neighbourLoan) : règles classiques.
  const old = newGame(3, 9).serialize();
  delete old.difficulty;
  delete old.neighbourLoan;
  const o = loadGame(old);
  assert.equal(o.state.difficulty, 'classique');
  assert.equal(o.state.neighbourLoan, null);
  assert.equal(o.level.rents, getLevel(3).rents);
  // Refus : mode inconnu, prêt abîmé, prêt en mode classique, prêt absent en détente.
  assert.throws(() => loadGame({ ...saved, difficulty: 'difficile' }), /difficulté/);
  assert.throws(() => loadGame({ ...saved, neighbourLoan: { ...saved.neighbourLoan, debt: -1 } }), /prêt du voisin/);
  assert.throws(() => loadGame({ ...saved, neighbourLoan: null }), /prêt du voisin/);
  assert.throws(() => loadGame({ ...newGame(1, 1).serialize(), neighbourLoan: { debt: 0, borrowed: 0, repaid: 0, forgiven: 0, loans: 0 } }), /prêt du voisin/);
  assert.throws(() => loadGame({ ...saved, neighbourLoan: { ...saved.neighbourLoan, loans: 1.5 } }), /prêt du voisin/);
});

test('détente : tout état atteint en jouant se recharge à l\'identique (12 niveaux)', () => {
  for (const base of LEVELS) {
    const g = createGame({ levelId: base.id, seed: base.id * 7 });
    for (let d = 0; d < 40 && g.state.status === 'playing'; d++) {
      for (const p of g.query.plots()) {
        if (p.action === 'harvest') g.actions.harvest(p.index);
        else if (p.action === 'plant') {
          const c = g.query.plantableCrops(p.index).find((x) => x.canAfford && x.kind !== 'tree' && !x.willFreeze);
          if (c) g.actions.plant(p.index, c.id);
        } else if (p.action === 'water' && d % 2) g.actions.water(p.index);
      }
      const copy = loadGame(JSON.parse(JSON.stringify(g.serialize())));
      assert.deepEqual(copy.serialize(), g.serialize(), `niveau ${base.id}, jour ${d}`);
      g.update(DAY_SECONDS);
    }
  }
});

// ── Progression ──────────────────────────────────────────────────────────────────────

test('progression : mode des nouvelles parties (détente par défaut, même pour une ancienne progression)', () => {
  const d = P.defaultProgress();
  assert.equal(d.difficulty, 'detente');
  assert.equal(P.runDifficulty(d), 'detente');
  assert.equal(P.normalizeProgress({ levels: {} }).difficulty, 'detente');
  assert.equal(P.normalizeProgress({ difficulty: 'classique' }).difficulty, 'classique');
  assert.equal(P.normalizeProgress({ difficulty: 'hard' }).difficulty, 'detente');
  const r = P.setDifficulty(d, 'classique');
  assert.ok(r.ok);
  assert.equal(r.progress.difficulty, 'classique');
  assert.equal(d.difficulty, 'detente', 'entrée non modifiée');
  assert.equal(P.runDifficulty(r.progress), 'classique');
  assert.equal(P.setDifficulty(d, 'x').ok, false);
  assert.equal(P.runDifficulty({}), 'detente');
  // Une seule fiche par niveau : les étoiles gardent le meilleur, quel que soit le mode.
  let p = P.recordRunEnd(d, { levelId: 1, outcome: 'victory', stars: 3, money: 900, summary: null }).progress;
  p = P.recordRunEnd(p, { levelId: 1, outcome: 'victory', stars: 1, money: 50, summary: null }).progress;
  assert.equal(p.levels[1].stars, 3);
});
