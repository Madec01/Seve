// Mécaniques propres à certains niveaux : maladie (3), marché fou (6), fatigue du sol (8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, newGame, nextDay, record, rich, skipDays } from './helpers.js';
import { createGame } from '../src/core/game.js';
import { MARKET } from '../src/data/balance.js';
import { CROPS, getCrop } from '../src/data/crops.js';
import { getInvestment } from '../src/data/investments.js';
import { getLevel } from '../src/data/levels.js';

/** Plante toutes les parcelles ouvertes vides avec une culture de la saison. */
function plantEverything(g) {
  const season = g.query.calendar().seasonId;
  const crop = CROPS.find((c) => c.seasons.includes(season) && c.growDays >= 4) || CROPS.find((c) => c.seasons.includes(season));
  g.state.plots.forEach((p, i) => {
    if (p.unlocked && !p.cropId) g.actions.plant(i, crop.id);
  });
}

test('maladie : seulement les aubes pluvieuses, au taux prévu', () => {
  const chance = getLevel(3).modifiers.rotChance;
  assert.ok(chance > 0);
  let exposures = 0;
  let rotten = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = createGame({ levelId: 3, seed });
    rich(g);
    let rottenHere = 0;
    g.on('rot', (r) => {
      rottenHere++;
      assert.ok(['rain', 'storm'].includes(g.state.weather.today), 'pourriture un jour sans pluie');
      assert.equal(g.state.plots[r.plotIndex].cropId, null);
      assert.ok(typeof r.cropId === 'string');
      rotten++;
    });
    for (let day = 0; day < 20; day++) {
      plantEverything(g);
      // cultures exposées à l'aube qui vient (si elle est pluvieuse)
      const planted = g.state.plots.filter((p) => p.cropId).length;
      const tomorrowRainy = ['rain', 'storm'].includes(g.state.weather.tomorrow);
      if (tomorrowRainy) exposures += planted;
      g.update(DAY_SECONDS);
    }
    assert.equal(g.state.stats.year.cropsLost.rot, rottenHere);
  }
  const rate = rotten / exposures;
  assert.ok(exposures > 1000);
  assert.ok(Math.abs(rate - chance) < 0.02, `taux observé ${rate}`);
});

test('maladie : aucune pourriture dans les niveaux sans maladie', () => {
  const g = createGame({ levelId: 1, seed: 3 });
  rich(g);
  const rec = record(g);
  for (let day = 0; day < 20; day++) {
    plantEverything(g);
    nextDay(g, 'rain');
  }
  assert.equal(rec.of('rot').length, 0);
});

test('maladie : même graine, mêmes pertes', () => {
  const run = () => {
    const g = createGame({ levelId: 3, seed: 9 });
    rich(g);
    const lost = [];
    g.on('rot', (r) => lost.push([g.state.time.day, r.plotIndex]));
    for (let day = 0; day < 25; day++) {
      plantEverything(g);
      g.update(DAY_SECONDS);
    }
    return lost;
  };
  assert.deepEqual(run(), run());
});

test('marché fou : cours par culture dans [0,5 ; 1,8], qui change chaque jour', () => {
  const g = newGame(6, 5);
  rich(g);
  const seen = new Set();
  let changes = 0;
  let prev = { ...g.state.market };
  for (let d = 0; d < 27; d++) {
    nextDay(g);
    for (const c of CROPS) {
      const m = g.state.market[c.id];
      assert.ok(m >= MARKET.min && m <= MARKET.max, `${c.id} ${m}`);
      seen.add(m);
      if (m !== prev[c.id]) changes++;
    }
    prev = { ...g.state.market };
  }
  assert.ok(seen.size > 20);
  assert.ok(changes > 27 * CROPS.length * 0.7);
});

test('marché fou : prix affiché et prix de récolte suivent le cours du jour', () => {
  const g = newGame(6, 12);
  rich(g);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  nextDay(g);
  g.actions.water(1);
  nextDay(g);
  const m = g.state.market.carrot;
  const listed = g.query.plantableCrops().find((c) => c.id === 'carrot');
  assert.equal(listed.marketMultiplier, m);
  assert.equal(listed.basePrice, getCrop('carrot').sellPrice);
  assert.equal(listed.sellPrice, Math.round(getCrop('carrot').sellPrice * m));
  assert.equal(g.query.plot(1).harvestValue, Math.round(getCrop('carrot').sellPrice * m));
  // avec l'étal, les deux bonus se cumulent
  g.actions.buyInvestment('roadsideStand');
  const bonus = getInvestment('roadsideStand').effects.priceBonus;
  assert.equal(g.actions.harvest(1).amount, Math.round(getCrop('carrot').sellPrice * m * (1 + bonus)));
});

test('sans volatilité, le cours vaut toujours 1', () => {
  const g = newGame(1);
  rich(g);
  skipDays(g, 10);
  assert.ok(Object.values(g.state.market).every((m) => m === 1));
});

test('fatigue du sol : replanter la même culture réduit la récolte de 30 %', () => {
  const g = newGame(8);
  rich(g);
  const carrot = getCrop('carrot');
  const grow = (i) => {
    for (let d = 0; d < 5 && !g.query.plot(i).mature; d++) {
      g.actions.water(i);
      nextDay(g);
    }
  };
  g.actions.plant(1, 'carrot');
  grow(1);
  assert.equal(g.actions.harvest(1).amount, carrot.sellPrice);
  // même culture : fatiguée
  assert.equal(g.query.plantableCrops(1).find((c) => c.id === 'carrot').fatigue, true);
  assert.equal(g.query.plantableCrops(1).find((c) => c.id === 'carrot').sellPrice, Math.round(carrot.sellPrice * 0.7));
  assert.equal(g.query.plantableCrops(1).find((c) => c.id === 'turnip').fatigue, false);
  assert.equal(g.query.plantableCrops(2).find((c) => c.id === 'carrot').fatigue, false);
  const r = g.actions.plant(1, 'carrot');
  assert.equal(r.fatigue, true);
  assert.equal(g.query.plot(1).fatigue, true);
  grow(1);
  const h = g.actions.harvest(1);
  assert.equal(h.amount, Math.round(carrot.sellPrice * 0.7));
  // rotation : une autre culture rapporte plein pot, et la parcelle n'est plus « fatiguée »
  assert.equal(g.actions.plant(1, 'turnip').ok, true);
  assert.equal(g.query.plot(1).fatigue, false);
  grow(1);
  assert.equal(g.actions.harvest(1).amount, getCrop('turnip').sellPrice);
  assert.equal(g.state.plots[1].lastHarvested, 'turnip');
  assert.equal(g.query.calendar().seasonId, 'summer');
  assert.equal(g.query.plantableCrops(1).find((c) => c.id === 'wheat').fatigue, false);
  assert.deepEqual(g.actions.plant(1, 'wheat'), { ok: true, cost: getCrop('wheat').seedCost, fatigue: false });
});

test('sans fatigue du sol (niveau 1), replanter la même culture ne coûte rien', () => {
  const g = newGame(1);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  nextDay(g);
  g.actions.water(1);
  nextDay(g);
  g.actions.harvest(1);
  assert.equal(g.actions.plant(1, 'carrot').fatigue, false);
});
