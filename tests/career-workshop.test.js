// Mode Carrière — commandes des ateliers (fiche d'atelier) : interrupteur, places en cours, vente en l'état,
// recettes par niveau, places de l'artisan ; mêmes actions et requêtes que les niveaux (setProcessing,
// sellProcessing, query.processing()), plus building(id).processing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hireAs, newLot, nextDay, record, richCareer, setRank } from './career-crew-helpers.js';

function jamCareer() {
  const g = richCareer(4);
  const shops = newLot(g, 'workshops');
  assert.ok(g.actions.career.build(shops, 0, 'jamWorkshop').ok);
  return { g, shops };
}

function harvestStrawberry(g, plot = 0) {
  g.state.plots[plot].cropId = 'strawberry';
  g.state.plots[plot].growth = 99;
  return g.actions.harvest(plot);
}

test('atelier de carrière : query.processing() (nom de carrière, niveau, places), interrupteur', () => {
  const { g } = jamCareer();
  const ev = record(g);
  const row = g.query.processing().find((b) => b.buildingId === 'jamWorkshop');
  assert.deepEqual({ name: row.name, level: row.level, on: row.on, capacity: row.capacity, places: row.places }, { name: 'Atelier de confitures', level: 1, on: true, capacity: 2, places: [null, null] });
  // Éteint : la fraise se vend normalement.
  assert.deepEqual(g.actions.setProcessing('jamWorkshop', false), { ok: true, on: false });
  assert.deepEqual(ev.of('processingToggled').at(-1), { type: 'processingToggled', buildingId: 'jamWorkshop', on: false });
  assert.equal(g.query.career.building('jamWorkshop').processing.on, false);
  let r = harvestStrawberry(g);
  assert.ok(r.ok);
  assert.equal(r.processed, null);
  assert.ok(r.amount > 0 || r.stored);
  // Allumé : elle part à l'atelier (2 aubes), vendue en confiture à l'aube.
  assert.deepEqual(g.actions.setProcessing('jamWorkshop', true), { ok: true, on: true });
  r = harvestStrawberry(g);
  assert.equal(r.processed.buildingId, 'jamWorkshop');
  let place = g.query.processing()[0].places[0];
  assert.equal(place.productId, 'strawberryJam');
  assert.equal(place.daysLeft, 2);
  assert.equal(g.query.career.building('jamWorkshop').processing.used, 1);
  nextDay(g);
  place = g.query.processing()[0].places[0];
  assert.equal(place.daysLeft, 1);
  nextDay(g);
  assert.equal(ev.of('productSold').at(-1).productId, 'strawberryJam');
  assert.equal(g.query.processing()[0].places[0], null);
});

test('atelier de carrière : vendre en l\'état (argent, bilan de l\'année, atelier vide refusé)', () => {
  const { g } = jamCareer();
  assert.match(g.actions.sellProcessing('jamWorkshop').reason, /vide/);
  harvestStrawberry(g, 0);
  harvestStrawberry(g, 1);
  const proc = g.query.processing()[0];
  assert.equal(proc.places.filter(Boolean).length, 2);
  const money = g.state.money;
  const before = g.state.career.yearStats.incomeBy.other;
  const r = g.actions.sellProcessing('jamWorkshop');
  assert.deepEqual(r, { ok: true, amount: proc.rawValue, count: 2 });
  assert.equal(g.state.money, money + proc.rawValue);
  assert.equal(g.state.career.yearStats.incomeBy.other, before + proc.rawValue, 'compté dans le bilan de l\'année');
  assert.deepEqual(g.query.processing()[0].places, [null, null]);
});

test('atelier de carrière : building(id).processing — recettes par niveau, places 2 à 6, artisan', () => {
  const { g, shops } = jamCareer();
  let info = g.query.career.building('jamWorkshop').processing;
  assert.equal(info.source, 'harvest');
  assert.equal(info.places, 2);
  assert.equal(info.nextPlaces, 3);
  assert.equal(info.upkeep, 1);
  assert.deepEqual(info.recipes.map((r) => [r.productId, r.inputName, r.active]), [['strawberryJam', 'Fraise', true], ['appleJuice', 'Pommier', true]]);
  setRank(g, 5);
  for (let k = 0; k < 4; k++) assert.ok(g.actions.career.upgradeBuilding('jamWorkshop').ok);
  info = g.query.career.building('jamWorkshop').processing;
  assert.equal(info.level, 5);
  assert.equal(info.places, 6);
  assert.equal(info.nextPlaces, null);
  assert.equal(g.query.processing()[0].capacity, 6);
  hireAs(g, 'artisan', shops);
  info = g.query.career.building('jamWorkshop').processing;
  assert.equal(info.places, 7);
  assert.equal(info.extraPlaces, 1);
  assert.equal(g.query.processing()[0].places.length, 7);
  // Moulin : farine jusqu'au niveau 2, pain à partir du niveau 3 ; fromagerie : lait (source animal).
  assert.ok(g.actions.career.build(shops, 1, 'mill').ok);
  const mill = () => g.query.career.building('mill').processing.recipes.map((r) => [r.productId, r.active]);
  assert.deepEqual(mill(), [['flour', true], ['bread', false]]);
  g.actions.career.upgradeBuilding('mill');
  g.actions.career.upgradeBuilding('mill');
  assert.deepEqual(mill(), [['flour', false], ['bread', true]]);
  assert.equal(g.query.career.building('dairy').processing.source, 'animal');
  assert.equal(g.query.career.building('dairy').processing.places, 0);
});

test('atelier de carrière : pas encore construit → setProcessing refusé', () => {
  const g = richCareer(4);
  assert.equal(g.actions.setProcessing('jamWorkshop', false).ok, false);
  assert.equal(g.actions.sellProcessing('jamWorkshop').ok, false);
  assert.equal(g.actions.setProcessing('greenhouse', false).reason, 'Atelier inconnu.');
});
