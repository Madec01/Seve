import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forceWeather, newGame, nextDay, openPlots, record, rich, skipDays } from './helpers.js';
import { getCrop } from '../src/data/crops.js';
import { getInvestment } from '../src/data/investments.js';
import { getLevel } from '../src/data/levels.js';
import { PLOT_COST } from '../src/data/balance.js';
import { initialUnlockedIndices, plotUnlockCost, stageOf } from '../src/core/farm.js';

const carrot = getCrop('carrot');
const tomato = getCrop('tomato');

test('parcelles ouvertes au départ : bloc centré', () => {
  assert.deepEqual(initialUnlockedIndices(getLevel(1)), [1, 2, 3, 4, 7, 8, 9, 10, 13, 14, 15, 16]);
  const g = newGame(1);
  assert.equal(g.state.plots.length, 24);
  assert.equal(openPlots(g).length, getLevel(1).unlockedPlots);
  assert.equal(newGame(4).state.plots.length, 6);
  assert.equal(openPlots(newGame(4)).length, 6);
});

test('planter : coût, état et événement', () => {
  const g = newGame(1);
  forceWeather(g, 'sunny');
  const rec = record(g);
  const money = g.state.money;
  const r = g.actions.plant(1, 'carrot');
  assert.deepEqual(r, { ok: true, cost: carrot.seedCost, fatigue: false });
  assert.equal(g.state.money, money - carrot.seedCost);
  const p = g.query.plot(1);
  assert.equal(p.cropId, 'carrot');
  assert.equal(p.cropName, 'Carotte');
  assert.equal(p.stage, 0);
  assert.equal(p.progress, 0);
  assert.equal(p.daysLeft, carrot.growDays);
  assert.equal(p.mature, false);
  assert.equal(p.action, 'water');
  assert.equal(p.watered, false);
  assert.deepEqual(rec.of('planted')[0], { type: 'planted', plotIndex: 1, cropId: 'carrot', amount: carrot.seedCost, fatigue: false, watered: p.watered });
  assert.deepEqual(rec.of('moneyChanged')[0], { type: 'moneyChanged', money: g.state.money, delta: -carrot.seedCost });
  assert.equal(g.state.stats.year.seedsSpent, carrot.seedCost);
});

test('planter : refus lisibles', () => {
  const g = newGame(1);
  assert.equal(g.actions.plant(0, 'carrot').reason, "Cette parcelle n'est pas encore ouverte.");
  assert.equal(g.actions.plant(99, 'carrot').reason, 'Parcelle inexistante.');
  assert.equal(g.actions.plant(-1, 'carrot').reason, 'Parcelle inexistante.');
  assert.equal(g.actions.plant(1.5, 'carrot').reason, 'Parcelle inexistante.');
  assert.equal(g.actions.plant(1, 'licorne').reason, 'Culture inconnue.');
  assert.equal(g.actions.plant(1, 'tomato').reason, 'Tomate : ne se plante pas au printemps.');
  g.actions.plant(1, 'carrot');
  assert.equal(g.actions.plant(1, 'turnip').reason, 'Cette parcelle est déjà plantée.');
  g.state.money = 1;
  assert.equal(g.actions.plant(2, 'carrot').reason, `Pas assez d'argent (il manque ${carrot.seedCost - 1} pièces).`);
  g.state.money = carrot.seedCost - 1;
  assert.equal(g.actions.plant(2, 'carrot').reason, "Pas assez d'argent (il manque 1 pièce).");
  g.state.money = -20;
  assert.equal(g.actions.plant(2, 'carrot').reason, `Pas assez d'argent (il manque ${carrot.seedCost + 20} pièces).`);
});

test('arrosée chaque jour : mûre après growDays aubes', () => {
  for (const crop of [carrot, tomato]) {
    const g = newGame(1);
    rich(g);
    skipDays(g, crop.id === 'tomato' ? 7 : 0); // la tomate se plante en été
    forceWeather(g, 'sunny');
    g.actions.plant(1, crop.id);
    for (let d = 0; d < crop.growDays; d++) {
      assert.equal(g.query.plot(1).mature, false);
      g.actions.water(1);
      nextDay(g, 'sunny');
    }
    assert.equal(g.query.plot(1).mature, true, crop.id);
    assert.equal(g.query.plot(1).stage, 4);
    assert.equal(g.query.plot(1).action, 'harvest');
  }
});

test('non arrosée : pousse de moitié', () => {
  const g = newGame(1);
  g.actions.plant(1, 'carrot');
  g.state.plots[1].watered = false;
  nextDay(g, 'sunny');
  assert.equal(g.state.plots[1].growth, 0.5);
  nextDay(g, 'cloudy');
  assert.equal(g.state.plots[1].growth, 1);
  skipDays(g, 2, 'sunny');
  assert.equal(g.query.plot(1).mature, true);
});

test("canicule : une parcelle non arrosée ne pousse pas, arrosée elle pousse", () => {
  const g = newGame(1);
  g.actions.plant(1, 'wheat');
  g.actions.plant(2, 'wheat');
  nextDay(g, 'heatwave');
  g.actions.water(1);
  nextDay(g, 'sunny'); // la pousse de l'aube dépend de la veille (canicule)
  // parcelle 1 : non arrosée le jour 1 → 0,5 ; arrosée pendant la canicule du jour 2 → +1
  // parcelle 2 : 0,5 puis canicule sans arrosage → +0
  assert.equal(g.state.plots[1].growth, 1.5);
  assert.equal(g.state.plots[2].growth, 0.5);
});

test('ruches : +10 % de pousse par ruche, sauf en hiver', () => {
  const g = newGame(1);
  rich(g);
  const bonus = getInvestment('beehive').effects.growthBonus;
  g.actions.buyInvestment('beehive');
  g.actions.plant(1, 'wheat');
  g.actions.plant(2, 'wheat');
  g.actions.water(1);
  nextDay(g, 'sunny');
  assert.ok(Math.abs(g.state.plots[1].growth - (1 + bonus)) < 1e-9);
  assert.ok(Math.abs(g.state.plots[2].growth - 0.5 * (1 + bonus)) < 1e-9);
  g.actions.buyInvestment('beehive');
  g.actions.buyInvestment('beehive');
  g.actions.water(2);
  nextDay(g, 'sunny');
  assert.ok(Math.abs(g.state.plots[2].growth - (0.5 * (1 + bonus) + (1 + 3 * bonus))) < 1e-9);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'wheat').daysToMature, Math.ceil(4 / (1 + 3 * bonus)));
  // Hiver : pas de bonus.
  skipDays(g, 21 - g.state.time.day + 1);
  assert.equal(g.query.calendar().seasonId, 'winter');
  g.actions.plant(3, 'turnip');
  g.actions.water(3);
  nextDay(g, 'sunny');
  assert.equal(g.state.plots[3].growth, 1);
});

test('étapes 0..4 et progression', () => {
  assert.equal(stageOf(0, 5), 0);
  assert.equal(stageOf(1, 5), 0);
  assert.equal(stageOf(1.25, 5), 1);
  assert.equal(stageOf(2.5, 5), 2);
  assert.equal(stageOf(3.75, 5), 3);
  assert.equal(stageOf(4.99, 5), 3);
  assert.equal(stageOf(5, 5), 4);
  assert.equal(stageOf(1, 2), 2);
  const g = newGame(1);
  rich(g);
  skipDays(g, 7);
  g.actions.plant(1, 'tomato');
  const stages = [g.query.plot(1).stage];
  const progress = [g.query.plot(1).progress];
  for (let d = 0; d < tomato.growDays; d++) {
    g.actions.water(1);
    nextDay(g);
    stages.push(g.query.plot(1).stage);
    progress.push(g.query.plot(1).progress);
  }
  assert.deepEqual(stages, [0, 0, 1, 2, 3, 4]);
  assert.deepEqual(progress, [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test("l'arrosage est remis à zéro à chaque aube", () => {
  const g = newGame(1);
  const rec = record(g);
  g.actions.plant(1, 'wheat');
  assert.equal(g.query.plot(1).watered, false);
  assert.deepEqual(g.actions.water(1), { ok: true, cost: 0 });
  assert.equal(g.query.plot(1).watered, true);
  assert.equal(g.query.plot(1).action, null);
  assert.equal(g.actions.water(1).reason, "Déjà arrosée aujourd'hui.");
  assert.deepEqual(rec.of('watered')[0], { type: 'watered', plotIndex: 1, cropId: 'wheat', amount: 0 });
  nextDay(g, 'sunny');
  assert.equal(g.query.plot(1).watered, false);
  assert.equal(g.actions.water(2).reason, 'Rien à arroser ici.');
  assert.equal(g.actions.water(0).reason, "Cette parcelle n'est pas encore ouverte.");
});

test('pluie et orage arrosent tout ; semer sous la pluie arrose la graine', () => {
  const g = newGame(1);
  g.actions.plant(1, 'wheat');
  g.actions.plant(2, 'carrot');
  nextDay(g, 'rain');
  assert.equal(g.query.plot(1).watered, true);
  assert.equal(g.query.plot(2).watered, true);
  const r = g.actions.plant(3, 'carrot');
  assert.equal(r.ok, true);
  assert.equal(g.query.plot(3).watered, true);
  nextDay(g, 'storm');
  assert.equal(g.query.plot(3).watered, true);
  nextDay(g, 'snow');
  assert.equal(g.query.plot(1).watered, false);
});

test('récolte : paiement, parcelle vidée, refus avant maturité', () => {
  const g = newGame(1);
  forceWeather(g, 'sunny');
  const rec = record(g);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  assert.equal(g.actions.harvest(1).reason, 'Pas encore mûre (encore 2 jours).');
  nextDay(g);
  assert.equal(g.actions.harvest(1).reason, 'Pas encore mûre (encore 1 jour).');
  assert.equal(g.actions.water(1).ok, true);
  nextDay(g);
  const money = g.state.money;
  assert.equal(g.query.plot(1).harvestValue, carrot.sellPrice);
  assert.equal(g.actions.water(1).reason, 'Cette culture est mûre : récoltez-la !');
  const r = g.actions.harvest(1);
  assert.deepEqual(r, { ok: true, amount: carrot.sellPrice, cropId: 'carrot' });
  assert.equal(g.state.money, money + carrot.sellPrice);
  assert.equal(g.query.plot(1).cropId, null);
  assert.equal(g.state.plots[1].lastHarvested, 'carrot');
  assert.deepEqual(rec.of('harvested')[0], { type: 'harvested', plotIndex: 1, cropId: 'carrot', amount: carrot.sellPrice, fatigue: false });
  assert.equal(g.actions.harvest(1).reason, 'Rien à récolter ici.');
  assert.equal(g.state.stats.year.cropsHarvested.carrot, 1);
  assert.equal(g.state.stats.year.harvestIncome, carrot.sellPrice);
});

test('une culture mûre reste récoltable', () => {
  const g = newGame(1);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  nextDay(g);
  g.actions.water(1);
  skipDays(g, 5);
  assert.equal(g.query.plot(1).mature, true);
  assert.equal(g.state.plots[1].growth, carrot.growDays);
  assert.equal(g.actions.harvest(1).ok, true);
});

test("étal : les récoltes se vendent 20 % plus cher", () => {
  const g = newGame(1);
  rich(g);
  g.actions.buyInvestment('roadsideStand');
  g.actions.plant(1, 'wheat');
  for (let i = 0; i < 4; i++) {
    g.actions.water(1);
    nextDay(g);
  }
  const bonus = getInvestment('roadsideStand').effects.priceBonus;
  const expected = Math.round(getCrop('wheat').sellPrice * (1 + bonus));
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'wheat').sellPrice, expected);
  assert.equal(g.actions.harvest(1).amount, expected);
});

test('gel au premier jour d’hiver : seules les cultures résistantes survivent', () => {
  const g = newGame(1);
  rich(g);
  skipDays(g, 20); // jour 21, dernier jour d'automne
  assert.equal(g.query.calendar().day, 21);
  const rec = record(g);
  g.actions.plant(1, 'carrot');
  g.actions.plant(2, 'cabbage');
  g.actions.plant(3, 'turnip');
  // une culture mûre non résistante gèle aussi
  g.state.plots[4].cropId = 'corn';
  g.state.plots[4].growth = getCrop('corn').growDays;
  assert.equal(g.query.plot(1).willFreeze, true);
  assert.equal(g.query.plot(2).willFreeze, false);
  assert.equal(g.query.plot(4).willFreeze, false);
  nextDay(g);
  const frost = rec.of('frost');
  assert.equal(frost.length, 1);
  assert.deepEqual(frost[0].lostPlots, [1, 4]);
  assert.equal(g.query.plot(1).cropId, null);
  assert.equal(g.query.plot(4).cropId, null);
  assert.equal(g.query.plot(2).cropId, 'cabbage');
  assert.equal(g.query.plot(3).cropId, 'turnip');
  assert.equal(g.state.stats.year.cropsLost.frost, 2);
  // l'ordre : saison, gel, météo, aube
  const order = rec.events.map((e) => e.type).filter((t) => ['seasonStart', 'frost', 'weather', 'dawn'].includes(t));
  assert.deepEqual(order, ['seasonStart', 'frost', 'weather', 'dawn']);
});

test('plantableCrops : saison, prix courant, gel annoncé', () => {
  const g = newGame(1);
  const spring = g.query.plantableCrops().map((c) => c.id);
  assert.deepEqual(spring, ['carrot', 'turnip', 'wheat']);
  const c = g.query.plantableCrops()[0];
  assert.deepEqual(Object.keys(c).sort(), [
    'basePrice', 'canAfford', 'daysToMature', 'fatigue', 'frostHardy', 'growDays', 'id', 'marketMultiplier', 'name', 'profit', 'seedCost', 'sellPrice', 'willFreeze',
  ].sort());
  assert.equal(c.sellPrice, carrot.sellPrice);
  assert.equal(c.profit, carrot.sellPrice - carrot.seedCost);
  rich(g);
  skipDays(g, 17); // jour 18 : 3 aubes avant le gel
  const autumn = Object.fromEntries(g.query.plantableCrops().map((x) => [x.id, x]));
  assert.equal(autumn.corn.willFreeze, true); // 6 jours
  assert.equal(autumn.carrot.willFreeze, false); // 2 jours
  assert.equal(autumn.cabbage.willFreeze, false); // résiste
  skipDays(g, 4);
  assert.deepEqual(
    g.query.plantableCrops().map((x) => x.id),
    ['turnip', 'cabbage'],
  );
  g.state.money = 0;
  assert.ok(g.query.plantableCrops().every((x) => !x.canAfford));
});

test('ouvrir des parcelles : prix croissant', () => {
  const g = newGame(1);
  rich(g, 1000);
  const rec = record(g);
  const pc = getLevel(1).plotCost || PLOT_COST;
  assert.equal(g.query.plot(0).unlocked, false);
  assert.equal(g.query.plot(0).unlockCost, pc.base);
  assert.equal(g.query.plot(0).action, 'unlock');
  assert.equal(g.query.plot(1).unlockCost, null);
  assert.deepEqual(g.actions.unlockPlot(0), { ok: true, cost: pc.base });
  assert.equal(g.state.money, 1000 - pc.base);
  assert.deepEqual(rec.of('plotUnlocked')[0], { type: 'plotUnlocked', plotIndex: 0, cost: pc.base });
  assert.equal(g.query.plot(5).unlockCost, pc.base + pc.step);
  assert.deepEqual(g.actions.unlockPlot(5), { ok: true, cost: pc.base + pc.step });
  assert.equal(g.actions.unlockPlot(5).reason, 'Cette parcelle est déjà ouverte.');
  assert.equal(g.actions.unlockPlot(1).reason, 'Cette parcelle est déjà ouverte.');
  assert.equal(g.actions.unlockPlot(24).reason, 'Parcelle inexistante.');
  assert.equal(g.actions.plant(0, 'carrot').ok, true);
  g.state.money = 3;
  assert.equal(g.actions.unlockPlot(6).reason, `Pas assez d'argent (il manque ${pc.base + 2 * pc.step - 3} pièces).`);
  assert.equal(g.state.stats.year.plotsSpent, 2 * pc.base + pc.step);
});

test('le champ ne dépasse pas maxPlots', () => {
  const lvl = { ...getLevel(1), maxPlots: 13 };
  const state = { plots: Array.from({ length: 24 }, (_, i) => ({ unlocked: i < 12 })), plotsBought: 0 };
  assert.equal(plotUnlockCost(state, lvl), lvl.plotCost.base);
  state.plots[12].unlocked = true;
  assert.equal(plotUnlockCost(state, lvl), null);
  // niveau 4 : tout est ouvert, rien à acheter
  const g = newGame(4);
  assert.ok(g.state.plots.every((p) => p.unlocked));
  assert.ok(g.query.plots().every((p) => p.unlockCost === null && p.action !== 'unlock'));
});

test('arrosage automatique : 8, 16 puis toutes les parcelles plantées', () => {
  const g = newGame(1);
  rich(g, 100000);
  for (let i = 0; i < 24; i++) g.actions.unlockPlot(i);
  for (let i = 0; i < 24; i++) g.actions.plant(i, 'wheat');
  const caps = getInvestment('sprinkler').effects.waterPlots;
  const rec = record(g);
  for (let lvl = 1; lvl <= 3; lvl++) {
    assert.equal(g.actions.buyInvestment('sprinkler').owned, lvl);
    nextDay(g, 'sunny');
    const expected = Math.min(24, caps[lvl - 1]);
    const dawn = rec.of('dawn').at(-1);
    assert.equal(dawn.sprinkled.length, expected);
    assert.deepEqual(dawn.sprinkled, Array.from({ length: expected }, (_, i) => i));
    assert.equal(g.state.plots.filter((p) => p.watered).length, expected);
  }
  assert.equal(g.actions.buyInvestment('sprinkler').reason, 'Niveau maximal atteint.');
  assert.equal(g.query.investments().find((i) => i.id === 'sprinkler').effects.waterPlots[2], null);
});

test("l'arrosage automatique ignore les parcelles mûres et déjà arrosées", () => {
  const g = newGame(1);
  rich(g);
  g.actions.buyInvestment('sprinkler');
  g.actions.plant(1, 'carrot');
  g.state.plots[1].growth = carrot.growDays; // mûre
  g.actions.plant(2, 'wheat');
  g.actions.plant(3, 'wheat');
  nextDay(g, 'sunny');
  assert.deepEqual(g.state.lastDawn.sprinkled, [2, 3]);
  nextDay(g, 'rain');
  assert.deepEqual(g.state.lastDawn.sprinkled, []);
});
