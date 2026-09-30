// Pommier (v3) : croissance, fruits, dormance, gel, maladie, arrachage, pollinisation. Pomme de terre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goToDay, newGame, nextDay, record, rich, skipDays } from './helpers.js';
import { getCrop } from '../src/data/crops.js';
import { getLevel } from '../src/data/levels.js';
import { applyRot } from '../src/core/farm.js';

const apple = getCrop('apple');
const potato = getCrop('potato');

/** Première parcelle ouverte et vide. */
function freePlot(g) {
  return g.state.plots.findIndex((p) => p.unlocked && !p.cropId);
}

test('pommier : données', () => {
  assert.equal(apple.kind, 'tree');
  assert.equal(apple.seedCost, 45);
  assert.equal(apple.growDays, 6);
  assert.equal(apple.fruitDays, 3);
  assert.deepEqual(apple.fruitSeasons, ['summer', 'autumn']);
  assert.deepEqual(apple.seasons, ['spring', 'summer', 'autumn']);
  assert.equal(apple.sellPrice, 26);
  assert.equal(apple.frostHardy, true);
  assert.equal(apple.needsWater, false);
});

test('pommier : plantation (prix, état, événement), jamais arrosé même sous la pluie', () => {
  const g = newGame(12);
  g.state.weather.today = 'rain';
  const rec = record(g);
  const money = g.state.money;
  const i = freePlot(g);
  const r = g.actions.plant(i, 'apple');
  assert.deepEqual(r, { ok: true, cost: 45, fatigue: false });
  assert.equal(g.state.money, money - 45);
  assert.deepEqual(g.state.plots[i], { unlocked: true, cropId: 'apple', growth: 0, watered: false, lastHarvested: null, fatigued: false, fruit: 0, insured: false });
  assert.deepEqual(rec.of('planted')[0], { type: 'planted', plotIndex: i, cropId: 'apple', amount: 45, fatigue: false, watered: false });
  const q = g.query.plot(i);
  assert.equal(q.kind, 'tree');
  assert.equal(q.action, null);
  assert.equal(q.needsWater, false);
  assert.equal(q.willFreeze, false);
  assert.equal(q.tree.stage, 'sapling');
  assert.equal(g.actions.water(i).reason, "Le pommier n'a pas besoin d'eau.");
  nextDay(g, 'rain');
  assert.equal(g.state.plots[i].watered, false);
});

test('pommier planté au 1er jour : adulte à l’aube du 7ᵉ jour, 4 paniers (jours 11, 14, 17, 20)', () => {
  const g = newGame(12);
  rich(g);
  const i = freePlot(g);
  const offer = g.query.plantableCrops(i).find((c) => c.id === 'apple');
  assert.equal(offer.kind, 'tree');
  assert.equal(offer.sowAll, false);
  assert.equal(offer.tree.harvestsBeforeYearEnd, 4);
  assert.equal(offer.tree.basketPrice, 26);
  assert.equal(offer.daysToMature, 10); // aube du jour 11
  assert.equal(offer.willFreeze, false);
  g.actions.plant(i, 'apple');
  assert.equal(g.query.plot(i).tree.adultInDays, 6);
  assert.equal(g.query.plot(i).tree.harvestsLeftEstimate, 4);
  const stages = [];
  const harvestDays = [];
  for (let day = 1; day <= 28; day++) {
    const q = g.query.plot(i);
    stages.push(q.tree.stage);
    if (q.action === 'harvest') {
      const h = g.actions.harvest(i);
      assert.equal(h.ok, true);
      assert.equal(h.tree, true);
      assert.equal(h.amount, 26);
      harvestDays.push(day);
      assert.equal(g.state.plots[i].cropId, 'apple', "l'arbre reste après la récolte");
      assert.equal(g.state.plots[i].fruit, 0);
    }
    if (day < 28) nextDay(g);
  }
  assert.deepEqual(harvestDays, [11, 14, 17, 20]);
  assert.deepEqual(stages.slice(0, 7), ['sapling', 'sapling', 'sapling', 'young', 'young', 'young', 'adult']);
  assert.equal(g.state.stats.year.cropsHarvested.apple, 4);
  assert.equal(g.state.stats.year.harvestIncome, 4 * 26);
});

test('pommier : planté en été 2 paniers ; en automne aucun (et la feuille des graines le dit)', () => {
  const g = newGame(12);
  rich(g);
  goToDay(g, 8);
  const i = freePlot(g);
  assert.equal(g.query.plantableCrops(i).find((c) => c.id === 'apple').tree.harvestsBeforeYearEnd, 2);
  g.actions.plant(i, 'apple');
  let n = 0;
  for (let day = 8; day <= 28; day++) {
    if (g.query.plot(i).action === 'harvest') {
      g.actions.harvest(i);
      n++;
    }
    if (day < 28) nextDay(g);
  }
  assert.equal(n, 2);
  const h = newGame(12);
  rich(h);
  goToDay(h, 15);
  const offer = h.query.plantableCrops().find((c) => c.id === 'apple');
  assert.equal(offer.tree.harvestsBeforeYearEnd, 0);
  assert.equal(offer.daysToMature, null);
  assert.ok(offer.profit < 0);
  goToDay(h, 22);
  assert.ok(!h.query.plantableCrops().some((c) => c.id === 'apple'), 'pas de plantation en hiver');
});

test('pommier : dormance en hiver, ne gèle pas, pommes mûres gardées tout l’hiver', () => {
  const g = newGame(12);
  rich(g);
  const young = freePlot(g);
  g.actions.plant(young, 'apple');
  goToDay(g, 18);
  const late = freePlot(g);
  g.actions.plant(late, 'apple'); // jeune plant d'automne : 4 jours d'automne avant l'hiver
  const rec = record(g);
  goToDay(g, 20);
  assert.equal(g.query.plot(young).action, 'harvest'); // mûres au jour 20, on ne les cueille pas
  goToDay(g, 22); // 1er jour d'hiver
  assert.equal(rec.of('frost').length, 1);
  assert.ok(!rec.of('frost')[0].lostPlots.includes(young));
  assert.ok(!rec.of('frost')[0].lostPlots.includes(late));
  const growthLate = g.state.plots[late].growth;
  assert.equal(growthLate, 4);
  goToDay(g, 28);
  assert.equal(g.state.plots[late].growth, growthLate, 'aucune croissance en hiver');
  assert.equal(g.query.plot(late).tree.dormant, true);
  assert.equal(g.query.plot(late).tree.stage, 'young');
  assert.equal(g.query.plot(young).tree.fruitReady, true);
  assert.equal(g.query.plot(young).tree.fruitStage, 3);
  assert.equal(g.actions.harvest(young).amount, 26);
});

test('pommier : fleurs au printemps, fruits visibles par étapes, estimation des récoltes', () => {
  const g = newGame(12);
  rich(g);
  const i = freePlot(g);
  g.actions.plant(i, 'apple');
  goToDay(g, 7);
  let t = g.query.plot(i).tree;
  assert.equal(t.stage, 'adult');
  assert.equal(t.blossom, true);
  assert.equal(t.fruitStage, 0);
  assert.equal(t.fruitDaysLeft, 4);
  assert.equal(g.query.plot(i).daysLeft, 4);
  assert.equal(g.actions.harvest(i).reason, 'Pas encore de pommes (encore 4 jours).');
  goToDay(g, 10);
  t = g.query.plot(i).tree;
  assert.equal(t.blossom, false);
  assert.equal(t.fruit, 2);
  assert.equal(t.fruitStage, 2);
  assert.equal(g.query.plot(i).stage, 3);
  goToDay(g, 11);
  assert.equal(g.query.plot(i).stage, 4);
  assert.equal(g.query.plot(i).harvestValue, 26);
  assert.equal(g.query.plot(i).tree.harvestsLeftEstimate, 4);
});

test('pommier : les ruches et « Main verte » accélèrent croissance et fruits (hors hiver)', () => {
  const g = newGame(12, 42, { perks: { greenThumb: 1 } });
  rich(g);
  g.actions.buyInvestment('beehive');
  const i = freePlot(g);
  g.actions.plant(i, 'apple');
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - 1.15) < 1e-9);
  skipDays(g, 4);
  assert.equal(g.query.plot(i).tree.stage, 'young'); // 5 × 1,15 = 5,75 < 6
  nextDay(g);
  assert.equal(g.query.plot(i).tree.stage, 'adult');
  goToDay(g, 22);
  const growth = g.state.plots[i].growth;
  const fruit = g.state.plots[i].fruit;
  nextDay(g);
  assert.equal(g.state.plots[i].fruit, fruit, 'hiver : rien n’avance, même avec les bonus');
  assert.equal(g.state.plots[i].growth, growth);
});

test('pommier : arrosage refusé, pluie et arrosage automatique l’ignorent', () => {
  const g = newGame(12);
  rich(g);
  const i = freePlot(g);
  g.actions.plant(i, 'apple');
  g.actions.buyInvestment('sprinkler');
  const rec = record(g);
  nextDay(g);
  assert.ok(!rec.of('dawn')[0].sprinkled.includes(i));
  assert.equal(g.state.plots[i].watered, false);
});

test('arracher un pommier : parcelle vidée, pas une récolte, gratuit', () => {
  const g = newGame(12);
  rich(g);
  const i = freePlot(g);
  g.actions.plant(i, 'apple');
  const rec = record(g);
  const money = g.state.money;
  assert.equal(g.actions.removeTree(i + 1).ok, false);
  assert.equal(g.actions.removeTree(i + 1).reason, "Il n'y a pas d'arbre ici.");
  assert.equal(g.actions.removeTree(99).reason, 'Parcelle inexistante.');
  assert.deepEqual(g.actions.removeTree(i), { ok: true });
  assert.equal(g.state.money, money);
  assert.deepEqual(g.state.plots[i], { unlocked: true, cropId: null, growth: 0, watered: false, lastHarvested: null, fatigued: false, fruit: 0, insured: false });
  assert.deepEqual(rec.of('treeRemoved'), [{ type: 'treeRemoved', plotIndex: i }]);
  assert.equal(g.state.stats.year.cropsHarvested.apple, undefined);
  // Une culture ordinaire ne s'arrache pas.
  g.actions.plant(i, 'carrot');
  assert.equal(g.actions.removeTree(i).ok, false);
});

test('maladie : seules des pommes mûres pourrissent, l’arbre reste', () => {
  const g = newGame(12);
  const s = g.state;
  const [a, b, c] = [1, 2, 3];
  s.plots[a] = { ...s.plots[a], cropId: 'apple', growth: 6, fruit: 3 };
  s.plots[b] = { ...s.plots[b], cropId: 'apple', growth: 6, fruit: 1 };
  s.plots[c] = { ...s.plots[c], cropId: 'carrot', growth: 1 };
  const lost = applyRot(s, 1, { chance: () => true });
  assert.deepEqual(lost, [
    { plotIndex: a, cropId: 'apple', tree: true },
    { plotIndex: c, cropId: 'carrot', tree: false },
  ]);
  assert.equal(s.plots[a].cropId, 'apple');
  assert.equal(s.plots[a].fruit, 0);
  assert.equal(s.plots[b].fruit, 1);
  assert.equal(s.plots[c].cropId, null);
});

test('maladie en partie (niveau 3 + Semencier) : événements rot { tree: true } et pertes comptées', () => {
  let treeRots = 0;
  for (let seed = 1; seed <= 40 && treeRots === 0; seed++) {
    const g = newGame(3, seed, { rawWeather: true, perks: { seedMerchant: 1 } });
    rich(g);
    for (const i of [1, 2, 3, 4]) {
      g.state.plots[i].cropId = 'apple';
      g.state.plots[i].growth = 6;
      g.state.plots[i].fruit = 3;
    }
    g.on('rot', (e) => {
      if (e.tree) {
        treeRots++;
        assert.equal(g.state.plots[e.plotIndex].cropId, 'apple');
        assert.equal(g.state.plots[e.plotIndex].fruit, 0);
      }
    });
    for (let d = 0; d < 6; d++) g.update(20);
    assert.equal(g.state.stats.year.cropsLost.rot >= treeRots, true);
  }
  assert.ok(treeRots > 0);
});

test('pommiers du départ (niveau 10) et pollinisation : demi-récolte sans ruche', () => {
  const g = newGame(10);
  rich(g);
  const lvl = getLevel(10);
  assert.deepEqual(lvl.startTrees, [0, 1, 2, 3]);
  for (const i of lvl.startTrees) {
    assert.equal(g.state.plots[i].cropId, 'apple');
    assert.equal(g.state.plots[i].unlocked, true);
    assert.equal(g.query.plot(i).tree.stage, 'adult');
  }
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'apple').sellPrice, 13);
  goToDay(g, 11);
  assert.equal(g.query.plot(0).harvestValue, 13);
  assert.equal(g.actions.harvest(0).amount, 13);
  g.actions.buyInvestment('beehive');
  assert.equal(g.actions.harvest(1).amount, 26);
  // La pollinisation ne touche que les pommes.
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'strawberry').sellPrice, 26);
});

test('pommier : pas de fatigue du sol (niveau 8 + Semencier)', () => {
  const g = newGame(8, 42, { perks: { seedMerchant: 1 } });
  rich(g);
  const i = freePlot(g);
  g.state.plots[i].lastHarvested = 'apple';
  const offer = g.query.plantableCrops(i).find((c) => c.id === 'apple');
  assert.equal(offer.fatigue, false);
  assert.equal(g.actions.plant(i, 'apple').fatigue, false);
});

test('pomme de terre : pousse sans arrosage (1 j), 0,5 un jour de canicule non arrosé', () => {
  const g = newGame(12);
  rich(g);
  goToDay(g, 8); // été : canicule possible
  const i = freePlot(g);
  g.actions.plant(i, 'potato');
  let q = g.query.plot(i);
  assert.equal(q.needsWater, false);
  assert.equal(q.action, null);
  assert.equal(g.actions.water(i).reason, 'Pas besoin : elle pousse sans arrosage.');
  nextDay(g, 'heatwave');
  assert.equal(g.state.plots[i].growth, 1);
  q = g.query.plot(i);
  assert.equal(q.needsWater, true);
  assert.equal(q.action, 'water');
  nextDay(g, 'heatwave'); // non arrosée pendant une canicule
  assert.equal(g.state.plots[i].growth, 1.5);
  assert.equal(g.actions.water(i).ok, true); // canicule aujourd'hui : l'arrosage compte
  nextDay(g, 'sunny');
  assert.equal(g.state.plots[i].growth, 2.5);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'potato').noWater, true);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'tomato').noWater, false);
});

test('pomme de terre : l’arrosage automatique l’ignore sauf les jours de canicule', () => {
  const g = newGame(12);
  rich(g);
  goToDay(g, 8);
  g.actions.buyInvestment('sprinkler');
  const i = freePlot(g);
  g.actions.plant(i, 'potato');
  const rec = record(g);
  nextDay(g, 'sunny');
  assert.ok(!rec.of('dawn').at(-1).sprinkled.includes(i));
  nextDay(g, 'heatwave');
  assert.ok(rec.of('dawn').at(-1).sprinkled.includes(i));
});

test('pomme de terre au niveau 2 (Semencier) : aucun arrosage payé hors canicule', () => {
  const g = newGame(2, 42, { perks: { seedMerchant: 1 } });
  rich(g);
  const i = freePlot(g);
  g.actions.plant(i, 'potato');
  for (let d = 0; d < 4; d++) nextDay(g, 'sunny');
  assert.equal(g.query.plot(i).mature, true);
  assert.equal(g.state.stats.year.waterSpent, 0);
});
