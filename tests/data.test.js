import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, WEATHER_TYPES, SPEEDS, DAY_SECONDS } from '../src/data/balance.js';
import { BASE_CROPS, CROPS, NEW_CROPS, getCrop } from '../src/data/crops.js';
import { BASE_INVESTMENTS, INVESTMENTS, getInvestment } from '../src/data/investments.js';
import { LEVELS, getLevel, yearLength } from '../src/data/levels.js';

test('constantes de temps', () => {
  assert.equal(DAY_SECONDS, 20);
  assert.deepEqual(SPEEDS, [0, 1, 2, 4]);
  assert.deepEqual(SEASONS, ['spring', 'summer', 'autumn', 'winter']);
});

test('cultures : champs complets et cohérents', () => {
  const ids = new Set();
  for (const c of CROPS) {
    assert.match(c.id, /^[a-z][a-zA-Z]*$/);
    assert.ok(!ids.has(c.id), `doublon ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.name, 'string');
    assert.ok(c.seasons.length > 0 && c.seasons.every((s) => SEASONS.includes(s)), c.id);
    assert.ok(Number.isInteger(c.growDays) && c.growDays > 0);
    assert.ok(Number.isInteger(c.seedCost) && c.seedCost > 0);
    // Un arbre rapporte plusieurs paniers : un panier seul peut valoir moins que le jeune plant.
    if (c.kind === 'tree') assert.ok(Number.isInteger(c.sellPrice) && c.sellPrice * 3 > c.seedCost, `${c.id} doit être rentable`);
    else assert.ok(Number.isInteger(c.sellPrice) && c.sellPrice > c.seedCost, `${c.id} doit être rentable`);
    assert.equal(typeof c.frostHardy, 'boolean');
    // Une culture plantable en hiver doit résister au gel.
    if (c.seasons.includes('winter')) assert.ok(c.frostHardy, c.id);
    assert.equal(getCrop(c.id), c);
  }
  for (const id of ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower']) assert.ok(getCrop(id), id);
  // Chaque saison propose au moins une culture.
  for (const s of SEASONS) assert.ok(CROPS.some((c) => c.seasons.includes(s)), s);
  assert.equal(getCrop('inconnue'), null);
});

test('investissements : champs complets et cohérents', () => {
  const expected = ['chickenCoop', 'beehive', 'roadsideStand', 'cow', 'sheep', 'sprinkler', 'solarPanel', 'guestHouse', 'goat', 'jamWorkshop', 'dairy', 'mill'];
  // Ordre fixé : les 8 d'origine d'abord (parité v2), puis les nouveautés v3.
  assert.deepEqual(INVESTMENTS.map((i) => i.id), expected);
  for (const inv of INVESTMENTS) {
    assert.equal(typeof inv.name, 'string');
    assert.ok(inv.description.length > 10);
    assert.ok(['unit', 'upgrade'].includes(inv.kind));
    assert.ok(inv.costs.length >= 1 && inv.costs.every((c) => Number.isInteger(c) && c > 0));
    for (const s of SEASONS) assert.ok(Number.isInteger(inv.income[s]) && inv.income[s] >= 0, `${inv.id} ${s}`);
    assert.ok(Number.isInteger(inv.upkeep) && inv.upkeep >= 0);
    assert.equal(getInvestment(inv.id), inv);
  }
  assert.equal(getInvestment('sprinkler').kind, 'upgrade');
  assert.equal(getInvestment('sprinkler').costs.length, 3);
  assert.equal(getInvestment('sprinkler').effects.waterPlots.length, 3);
  assert.equal(getInvestment('beehive').income.winter, 0);
  assert.equal(getInvestment('roadsideStand').costs.length, 1);
  assert.equal(getInvestment('guestHouse').costs.length, 1);
});

test('niveaux 1 à 12 : champs complets et cohérents', () => {
  assert.deepEqual(
    LEVELS.map((l) => l.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  for (const l of LEVELS) {
    assert.equal(getLevel(l.id), l);
    assert.equal(typeof l.name, 'string');
    assert.ok(l.description.length > 20);
    assert.equal(typeof l.tutorial, 'boolean');
    assert.ok(l.startMoney > 0);
    assert.ok(l.unlockedPlots > 0 && l.unlockedPlots <= l.maxPlots && l.maxPlots <= l.gridCols * l.gridRows);
    assert.equal(l.seasonLengths.length, 4);
    assert.ok(l.seasonLengths.every((n) => Number.isInteger(n) && n >= 3));
    assert.equal(l.rents.length, 4);
    assert.ok(l.rents.every((n) => Number.isInteger(n) && n > 0));
    assert.equal(l.starThresholds.length, 2);
    assert.ok(l.starThresholds[0] < l.starThresholds[1]);
    for (const s of SEASONS) {
      const table = l.weather[s];
      assert.ok(table, `${l.id} ${s}`);
      assert.ok(Object.keys(table).every((w) => WEATHER_TYPES[w]), `${l.id} ${s}`);
      assert.ok(Object.values(table).reduce((a, b) => a + b, 0) > 0);
    }
    assert.ok(l.availableInvestments.every((id) => getInvestment(id)));
    for (const k of ['waterCost', 'rotChance', 'priceVolatility', 'loan', 'soilFatigue', 'noSprinkler', 'rawPriceFactor', 'pollination']) assert.ok(k in l.modifiers, `${l.id} ${k}`);
    assert.ok(Array.isArray(l.crops) && l.crops.length > 0 && l.crops.every((id) => getCrop(id)), `${l.id} cultures`);
    assert.ok(Array.isArray(l.startTrees) && l.startTrees.every((i) => Number.isInteger(i) && i >= 0 && i < l.gridCols * l.gridRows));
    assert.equal(yearLength(l), l.seasonLengths.reduce((a, b) => a + b, 0));
  }
  assert.equal(getLevel(1).tutorial, true);
  assert.ok(LEVELS.slice(1).every((l) => !l.tutorial));
  assert.equal(getLevel(99), null);
});

test('chaque niveau porte sa contrainte', () => {
  assert.ok(getLevel(2).modifiers.waterCost > 0);
  assert.ok((getLevel(2).weather.summer.heatwave || 0) > (getLevel(1).weather.summer.heatwave || 0));
  assert.ok((getLevel(2).weather.summer.rain || 0) < (getLevel(1).weather.summer.rain || 0));
  assert.ok(getLevel(3).modifiers.rotChance > 0);
  assert.ok(getLevel(3).weather.spring.rain > getLevel(1).weather.spring.rain);
  assert.equal(getLevel(4).maxPlots, 6);
  assert.equal(getLevel(4).unlockedPlots, 6);
  assert.equal(getLevel(5).seasonLengths[3], 14);
  assert.ok(getLevel(5).rents[3] > getLevel(1).rents[3]);
  assert.equal(getLevel(6).modifiers.priceVolatility, true);
  assert.equal(getLevel(7).startMoney, 600);
  assert.ok(getLevel(7).modifiers.loan.payment > 0);
  assert.equal(getLevel(8).modifiers.noSprinkler, true);
  assert.ok(!getLevel(8).availableInvestments.includes('sprinkler'));
  assert.equal(getLevel(8).modifiers.soilFatigue, 0.3);
});

test('v3 : cultures ajoutées après les 7 d’origine, champs des nouveautés', () => {
  assert.deepEqual(CROPS.map((c) => c.id), ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower', 'potato', 'strawberry', 'zucchini', 'pumpkin', 'apple']);
  assert.deepEqual(BASE_CROPS, ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower']);
  assert.deepEqual(NEW_CROPS, ['potato', 'strawberry', 'zucchini', 'pumpkin', 'apple']);
  const potato = getCrop('potato');
  assert.equal(potato.dryGrowth, 1);
  assert.equal(potato.dryHeatwaveGrowth, 0.5);
  assert.deepEqual([potato.growDays, potato.seedCost, potato.sellPrice], [4, 5, 16]);
  assert.deepEqual([getCrop('strawberry').growDays, getCrop('strawberry').seedCost, getCrop('strawberry').sellPrice], [4, 12, 26]);
  assert.deepEqual([getCrop('zucchini').growDays, getCrop('zucchini').seedCost, getCrop('zucchini').sellPrice], [3, 8, 22]);
  assert.deepEqual([getCrop('pumpkin').growDays, getCrop('pumpkin').seedCost, getCrop('pumpkin').sellPrice], [7, 18, 62]);
  for (const id of BASE_CROPS) assert.equal(getCrop(id).kind, undefined, 'les cultures d’origine ne changent pas');
});

test('v3 : chèvre et ateliers ; niveaux 1 à 8 inchangés (cultures et investissements d’origine)', () => {
  const goat = getInvestment('goat');
  assert.deepEqual(goat.costs, [90, 100, 110]);
  assert.equal(goat.income.winter, 9);
  assert.equal(goat.upkeep, 1);
  for (const inv of INVESTMENTS) assert.ok(['animal', 'crop', 'processing', 'utility'].includes(inv.category), inv.id);
  for (const l of LEVELS.filter((x) => x.id <= 8)) {
    assert.deepEqual(l.crops, BASE_CROPS, `niveau ${l.id}`);
    assert.ok(l.availableInvestments.every((id) => BASE_INVESTMENTS.includes(id)), `niveau ${l.id}`);
    assert.deepEqual(l.startTrees, []);
    assert.equal(l.contest, null);
    assert.equal(l.seedMerchant, true);
    assert.equal(l.modifiers.rawPriceFactor, 1);
    assert.equal(l.modifiers.pollination, false);
  }
});

test('v3 : niveaux 9 à 12 portent leur système', () => {
  const [l9, l10, l11, l12] = [9, 10, 11, 12].map(getLevel);
  assert.equal(l9.modifiers.rawPriceFactor, 0.75);
  assert.ok(l9.availableInvestments.includes('jamWorkshop'));
  assert.deepEqual([l10.gridCols, l10.gridRows, l10.unlockedPlots, l10.maxPlots], [4, 4, 12, 16]);
  assert.deepEqual(l10.startTrees, [0, 1, 2, 3]);
  assert.equal(l10.modifiers.pollination, true);
  assert.deepEqual([l11.gridCols, l11.gridRows, l11.unlockedPlots, l11.maxPlots], [5, 3, 9, 15]);
  assert.deepEqual(l11.seasonLengths, [7, 5, 7, 10]);
  assert.ok(!l11.availableInvestments.includes('cow'));
  assert.ok(l11.availableInvestments.includes('dairy') && l11.availableInvestments.includes('goat'));
  assert.ok(!Object.values(l11.weather).some((t) => t.heatwave));
  assert.deepEqual(l11.crops, ['carrot', 'turnip', 'wheat', 'cabbage', 'potato', 'strawberry', 'apple']);
  assert.equal(l12.contest.deadlineDay, 21);
  for (const id of ['goat', 'jamWorkshop', 'dairy', 'mill']) assert.ok(l12.availableInvestments.includes(id));
  for (const l of [l9, l10, l11, l12]) assert.equal(l.seedMerchant, false);
});
