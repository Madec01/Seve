import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DAY_SECONDS, newGame, nextDay, record, rich } from './helpers.js';
import { createGame } from '../src/core/game.js';

test('on() renvoie une fonction de désabonnement', () => {
  const g = newGame(1);
  let n = 0;
  const off = g.on('dawn', () => n++);
  nextDay(g);
  off();
  nextDay(g);
  assert.equal(n, 1);
  assert.throws(() => g.on('dawn', 'pas une fonction'));
});

test('un gestionnaire peut agir pendant un événement', () => {
  const g = newGame(1);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  const harvested = [];
  g.on('dawn', () => {
    if (g.query.plot(1).mature) harvested.push(g.actions.harvest(1).amount);
  });
  g.on('dawn', () => {
    if (g.query.plot(1).action === 'water') g.actions.water(1);
  });
  nextDay(g);
  nextDay(g);
  assert.equal(harvested.length, 1);
});

test("contenu de l'événement dawn", () => {
  const g = newGame(1);
  rich(g, 1000);
  g.actions.buyInvestment('chickenCoop');
  const rec = record(g);
  nextDay(g, 'cloudy');
  const d = rec.of('dawn')[0];
  assert.deepEqual(Object.keys(d).sort(), ['charges', 'chargesDetail', 'day', 'incomes', 'milkToDairy', 'net', 'seasonId', 'sprinkled', 'type', 'weather'].sort());
  assert.equal(d.day, 2);
  assert.equal(d.seasonId, 'spring');
  assert.equal(d.weather, 'cloudy');
  assert.deepEqual(d.incomes, [{ source: 'chickenCoop', amount: g.query.investments().find((i) => i.id === 'chickenCoop').income, owned: 1, kind: 'daily' }]);
  assert.equal(d.charges, g.query.finance().dailyCharges);
  assert.deepEqual(rec.of('weather')[0], { type: 'weather', today: 'cloudy', tomorrow: g.state.weather.tomorrow });
  assert.deepEqual(g.state.lastDawn, (({ type, ...rest }) => rest)(d));
});

test('les moneyChanged racontent toute l’évolution de l’argent', () => {
  for (const levelId of [1, 2, 7]) {
    const g = createGame({ levelId, seed: 31 });
    const start = g.state.money;
    let sum = 0;
    let last = start;
    g.on('moneyChanged', (e) => {
      sum += e.delta;
      assert.equal(e.money, last + e.delta);
      last = e.money;
    });
    for (let d = 0; d < 40 && g.state.status === 'playing'; d++) {
      g.state.plots.forEach((p, i) => {
        const q = g.query.plot(i);
        if (q.action === 'harvest') g.actions.harvest(i);
        if (g.query.plot(i).action === 'plant') g.actions.plant(i, g.query.plantableCrops()[0].id);
        if (g.query.plot(i).action === 'water') g.actions.water(i);
      });
      if (g.state.money > 200) g.actions.buyInvestment('chickenCoop');
      g.update(DAY_SECONDS);
    }
    assert.equal(start + sum, g.state.money, `niveau ${levelId}`);
  }
});

test('le bilan est cohérent avec l’argent', () => {
  const g = createGame({ levelId: 3, seed: 8 });
  let summary = null;
  g.on('victory', (e) => (summary = e.summary));
  g.on('bankrupt', (e) => (summary = e.summary));
  for (let d = 0; d < 40 && g.state.status === 'playing'; d++) {
    g.state.plots.forEach((p, i) => {
      if (g.query.plot(i).action === 'harvest') g.actions.harvest(i);
      const crops = g.query.plantableCrops().filter((c) => !c.willFreeze);
      if (g.query.plot(i).action === 'plant' && crops.length) g.actions.plant(i, crops.at(-1).id);
      if (g.query.plot(i).action === 'water') g.actions.water(i);
    });
    if (g.state.money > 150) g.actions.buyInvestment('chickenCoop');
    if (g.state.money > 150) g.actions.buyInvestment('sheep');
    g.update(DAY_SECONDS);
  }
  assert.ok(summary);
  const s = summary;
  const computed =
    s.startMoney + s.harvestIncome + s.investmentIncome - s.charges - s.waterSpent - s.loanPaid - s.rentsPaid - s.seedsSpent - s.investmentsSpent - s.plotsSpent;
  assert.equal(computed, s.money);
  assert.equal(s.net, s.money - s.startMoney);
  assert.equal(s.totalHarvested, Object.values(s.cropsHarvested).reduce((a, b) => a + b, 0));
  assert.ok(s.totalHarvested > 0);
  assert.ok(s.investments.chickenCoop >= 1);
  assert.equal(typeof s.season.net, 'number');
  assert.deepEqual(g.query.summary().cropsHarvested, s.cropsHarvested);
});

test('la simulation tourne (fumée)', () => {
  const script = fileURLToPath(new URL('../tools/simulate.js', import.meta.url));
  const res = spawnSync(process.execPath, [script, '--seeds', '2', '--json'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.length, 12);
  for (const lv of out) {
    assert.deepEqual(
      lv.rows.map((r) => r.strategy),
      ['careless', 'balanced', 'investor', 'optimal'],
    );
    for (const r of lv.rows) assert.ok(r.winRate >= 0 && r.winRate <= 1);
  }
});
