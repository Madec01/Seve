// Concours du village (v3, niveau 12) : progression des épreuves, jugement le soir du jour limite, prix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goToDay, newGame, nextDay, record, rich } from './helpers.js';
import { loadGame } from '../src/core/game.js';
import { getLevel } from '../src/data/levels.js';

const contest = getLevel(12).contest;

test('concours : données du niveau 12, absent ailleurs', () => {
  assert.equal(contest.deadlineDay, 21);
  assert.equal(contest.prizePerGoal, 120);
  assert.equal(contest.bonusAll, 120);
  assert.deepEqual(contest.goals.map((g) => [g.id, g.target]), [['pumpkins', 6], ['terroir', 12], ['cheese', 3]]);
  for (let id = 1; id <= 11; id++) assert.equal(getLevel(id).contest, null, `niveau ${id}`);
  const g = newGame(1);
  assert.equal(g.state.contest, null);
  assert.equal(g.query.contest(), null);
});

test('concours : requête initiale', () => {
  const g = newGame(12);
  assert.deepEqual(g.state.contest, { awarded: false, result: null });
  assert.deepEqual(g.query.contest(), {
    deadlineDay: 21,
    daysLeft: 20,
    awarded: false,
    result: null,
    prizePerGoal: 120,
    bonusAll: 120,
    goals: [
      { id: 'pumpkins', label: 'Citrouilles géantes', target: 6, progress: 0, done: false },
      { id: 'terroir', label: 'Étal du terroir', target: 12, progress: 0, done: false },
      { id: 'cheese', label: 'Fromage de la ferme', target: 3, progress: 0, done: false },
    ],
    potentialPrize: 0,
  });
});

test('concours : contestProgress à chaque récolte de citrouille et à chaque produit vendu', () => {
  const g = newGame(12);
  rich(g, 5000);
  const rec = record(g);
  goToDay(g, 8);
  for (const i of [1, 2]) {
    g.state.plots[i].cropId = 'pumpkin';
    g.state.plots[i].growth = 7;
    g.actions.harvest(i);
  }
  assert.deepEqual(rec.of('contestProgress'), [
    { type: 'contestProgress', goalId: 'pumpkins', progress: 1, target: 6, done: false },
    { type: 'contestProgress', goalId: 'pumpkins', progress: 2, target: 6, done: false },
  ]);
  // Une carotte ne compte pour rien.
  g.state.plots[3].cropId = 'carrot';
  g.state.plots[3].growth = 2;
  rec.clear();
  g.actions.harvest(3);
  assert.equal(rec.of('contestProgress').length, 0);
  // Fromage vendu : compte pour « terroir » et pour « cheese ».
  g.actions.buyInvestment('cow');
  g.actions.buyInvestment('dairy');
  nextDay(g);
  nextDay(g);
  rec.clear();
  nextDay(g);
  assert.deepEqual(rec.of('contestProgress').map((e) => [e.goalId, e.progress]), [['terroir', 1], ['cheese', 1]]);
  const q = g.query.contest();
  assert.deepEqual(q.goals.map((x) => x.progress), [2, 1, 1]);
});

function atDeadline(pumpkins, products, cheeses) {
  const g = newGame(12);
  rich(g, 5000);
  goToDay(g, 21);
  const year = g.state.stats.year;
  year.cropsHarvested.pumpkin = pumpkins;
  year.productsSold = { cowCheese: cheeses, strawberryJam: products - cheeses };
  return g;
}

test('concours : jugé le soir du jour 21, avant le fermage d’automne ; prix par épreuve + bonus', () => {
  const cases = [
    [[0, 0, 0], [], 0],
    [[6, 0, 0], ['pumpkins'], 120],
    [[6, 12, 0], ['pumpkins', 'terroir'], 240],
    [[5, 12, 3], ['terroir', 'cheese'], 240],
    [[6, 12, 3], ['pumpkins', 'terroir', 'cheese'], 480],
    [[9, 20, 12], ['pumpkins', 'terroir', 'cheese'], 480],
  ];
  for (const [[p, t, c], goalsMet, amount] of cases) {
    const g = atDeadline(p, t, c);
    assert.equal(g.query.contest().potentialPrize, amount);
    assert.equal(g.query.contest().daysLeft, 0);
    const rec = record(g);
    const money = g.state.money;
    nextDay(g);
    const award = rec.of('contestAwarded');
    assert.equal(award.length, 1);
    assert.equal(award[0].amount, amount);
    assert.deepEqual(award[0].goalsMet, goalsMet);
    assert.equal(award[0].goals.length, 3);
    const types = rec.events.map((e) => e.type);
    assert.ok(types.indexOf('contestAwarded') < types.indexOf('billPaid'), 'avant le fermage');
    const rent = rec.of('billPaid')[0].amount;
    assert.equal(g.state.stats.year.contestPrize, amount);
    assert.deepEqual(g.state.contest, { awarded: true, result: { goalsMet, amount } });
    assert.equal(g.query.contest().awarded, true);
    // Argent : + prix − fermage (+ revenus / − charges de l'aube suivante).
    const dawn = rec.of('dawn')[0];
    assert.equal(g.state.money, money + amount - rent + dawn.net);
    assert.equal(rec.of('billPaid')[0].summary.contestPrize, amount);
  }
});

test('concours : le prix peut éviter la faillite ; jamais jugé deux fois ; plus de progression après', () => {
  const g = atDeadline(6, 12, 3);
  const rent = g.query.finance().nextBill.amount;
  g.state.money = rent - 100;
  nextDay(g);
  assert.equal(g.state.status, 'playing');
  const rec = record(g);
  g.state.plots[1].cropId = 'pumpkin';
  g.state.plots[1].growth = 7;
  g.actions.harvest(1);
  goToDay(g, 28);
  nextDay(g);
  assert.equal(rec.of('contestAwarded').length, 0);
  assert.equal(rec.of('contestProgress').length, 0);
  assert.equal(g.state.stats.year.contestPrize, 480);
});

test('concours : état sauvegardé et vérifié', () => {
  const g = atDeadline(6, 0, 0);
  nextDay(g);
  const saved = g.serialize();
  assert.deepEqual(loadGame(saved).state.contest, { awarded: true, result: { goalsMet: ['pumpkins'], amount: 120 } });
  assert.throws(() => loadGame({ ...saved, contest: null }), /Sauvegarde invalide/);
  assert.throws(() => loadGame({ ...saved, contest: { awarded: 'oui', result: null } }), /Sauvegarde invalide/);
  const other = newGame(1).serialize();
  assert.throws(() => loadGame({ ...other, contest: { awarded: false, result: null } }), /Sauvegarde invalide/);
});
