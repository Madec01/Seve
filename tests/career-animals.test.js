// Mode Carrière — animaux (CORE-B) : production à ramasser, plafond de 3 jours, ramassage, lait vers la
// fromagerie, tonte, truffes, naissances des lapins, balades, bonus du soigneur, requêtes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerAnimals, careerFlag } from '../src/core/career/registry.js';
import { CAREER_ANIMALS, COLLECT } from '../src/data/career/animals.js';
import { DEFAULT_ANIMALS } from '../src/data/career/buildings.js';
import { loadCareer } from '../src/core/career/career.js';
import { DAY_SECONDS, atFrac, hireAs, newCareer, newLot, nextDay, record, richCareer, setRank } from './career-crew-helpers.js';

test('animaux de carrière : remplacent les provisoires (mêmes ids), production à ramasser', () => {
  const ids = careerAnimals().map((a) => a.id);
  assert.deepEqual(ids, DEFAULT_ANIMALS.map((a) => a.id));
  assert.ok(careerAnimals().every((a) => !a.provisional));
  assert.equal(careerFlag('collectAnimals'), true);
  assert.equal(CAREER_ANIMALS.length, 8);
  const pig = careerAnimals().find((a) => a.id === 'pig');
  assert.deepEqual(pig.truffles, { chance: 0.3, value: 60, seasons: ['autumn', 'winter'] });
  const g = newCareer();
  const inv = g.query.investments().find((i) => i.id === 'hen');
  assert.equal(inv.collect, true);
  assert.equal(inv.nextCost, 30);
});

test('œufs : s\'accumulent au poulailler à l\'aube, se ramassent (argent tout de suite, bilan « animaux »)', () => {
  const g = newCareer();
  const ev = record(g);
  nextDay(g);
  assert.equal(g.state.career.buildings.coop.pending, 4, '2 poules × 2');
  assert.ok(!ev.of('dawn')[0].incomes.some((i) => i.source === 'hen'), 'plus payés à l\'aube');
  const money = g.state.money;
  const r = g.actions.career.collect('coop');
  assert.deepEqual(r, { ok: true, amount: 4 });
  assert.equal(g.state.money, money + 4);
  assert.equal(g.state.career.buildings.coop.pending, 0);
  assert.equal(g.state.career.buildings.coop.lastCollected, 2);
  const c = ev.of('collected')[0];
  assert.deepEqual([c.buildingId, c.amount, c.by, c.product], ['coop', 4, 'player', 'eggs']);
  assert.equal(g.state.career.yearStats.incomeBy.animals, 4);
  assert.equal(g.state.career.work.stats.collected.player, 4);
  assert.equal(g.actions.career.collect('coop').ok, false, 'rien à ramasser');
  assert.equal(g.actions.career.collect('cowshed').ok, false, 'abri absent');
  assert.equal(g.actions.career.collect('house').ok, false, 'pas un abri');
});

test('plafond : 3 jours de production, le surplus est perdu (shelterFull) ; un oubli de 2 jours ne coûte rien', () => {
  const g = newCareer();
  const ev = record(g);
  nextDay(g);
  nextDay(g);
  nextDay(g);
  assert.equal(g.state.career.buildings.coop.pending, 12);
  assert.equal(ev.of('shelterFull').length, 0, 'rien de perdu en 3 jours');
  const sh = g.query.career.shelter('coop');
  assert.equal(sh.cap, COLLECT.capDays * 2 * 2);
  assert.equal(sh.full, true);
  assert.equal(sh.pendingDays, 3);
  nextDay(g);
  nextDay(g);
  assert.equal(g.state.career.buildings.coop.pending, 12, 'plafonné');
  assert.equal(ev.of('shelterFull').length, 2);
  assert.equal(ev.of('shelterFull')[0].lost, 4);
  assert.equal(g.state.career.work.stats.lostAnimals, 8);
  assert.equal(g.actions.career.collect('coop').amount, 12);
});

test('ramasser tous les abris (collectAll) ; requête shelters()', () => {
  const g = richCareer(3);
  g.actions.career.build('yard', 1, 'hutch');
  g.actions.buyInvestment('rabbit');
  g.actions.buyInvestment('hen');
  nextDay(g);
  const list = g.query.career.shelters();
  assert.deepEqual(list.map((s) => [s.buildingId, s.count, s.pending, s.product]), [['coop', 3, 6, 'eggs'], ['hutch', 1, 2, 'angora']]);
  const r = g.actions.career.collectAll();
  assert.deepEqual(r, { ok: true, total: 8, amount: 8, count: 2, byShelter: [{ buildingId: 'coop', name: 'Poulailler', amount: 6 }, { buildingId: 'hutch', name: 'Clapier', amount: 2 }] });
  const none = g.actions.career.collectAll();
  assert.equal(none.ok, false);
  assert.equal(typeof none.reason, 'string');
  assert.deepEqual([none.total, none.count, none.byShelter], [0, 0, []]);
});

test('« Tout ramasser » au niveau du jeu : game.actions.collectAll (carrière = career.collectAll, niveaux = sans effet)', () => {
  const g = richCareer(3);
  g.actions.buyInvestment('hen');
  nextDay(g);
  const money = g.state.money;
  const r = g.actions.collectAll();
  assert.equal(r.ok, true);
  assert.equal(r.total, g.state.money - money);
  assert.deepEqual(r.byShelter.map((x) => x.buildingId), ['coop']);
  assert.equal(g.actions.collectAll().ok, false);
});

test('lait : part à la fromagerie (inchangé), le reste se ramasse ; sans fromagerie tout se ramasse', () => {
  const g = richCareer(3);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'goatShed');
  g.actions.buyInvestment('goat');
  g.actions.buyInvestment('goat');
  nextDay(g);
  assert.equal(g.state.career.buildings.goatShed.pending, 18);
  // Fromagerie : 2 places au niveau 1 → les 2 chèvres y vont, rien à ramasser.
  const yard = newLot(g, 'workshops');
  g.actions.career.build(yard, 0, 'dairy');
  g.actions.career.collect('goatShed');
  const ev = record(g);
  nextDay(g);
  assert.ok(ev.of('dawn')[0].milkToDairy.some((m) => m.animalId === 'goat' && m.count === 2));
  assert.equal(g.state.career.buildings.goatShed.pending, 0);
});

test('tonte : payée automatiquement le dernier jour du printemps, de l\'été et de l\'automne', () => {
  const g = richCareer(2);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'sheepfold');
  g.actions.buyInvestment('sheep');
  g.actions.buyInvestment('sheep');
  const ev = record(g);
  while (g.state.time.day < 7) nextDay(g);
  const shear = ev.of('dawn').flatMap((d) => d.incomes).filter((i) => i.kind === 'shearing');
  assert.deepEqual(shear.map((i) => [i.source, i.amount]), [['sheep', 180]]);
  assert.equal(g.state.career.buildings.sheepfold.pending, 0, 'rien à ramasser');
});

test('truffes : automne et hiver seulement, déterministes, dans la porcherie ; cumul de carrière', () => {
  const run = () => {
    const g = richCareer(3, { seed: 11 });
    const meadow = newLot(g, 'meadow');
    g.actions.career.build(meadow, 0, 'pigsty');
    g.actions.career.upgradeBuilding('pigsty');
    for (let k = 0; k < 4; k++) g.actions.buyInvestment('pig');
    const ev = record(g);
    while (g.state.time.day < 14) nextDay(g);
    assert.equal(ev.of('truffleFound').length, 0, 'ni au printemps ni en été');
    let found = 0;
    while (g.state.time.day < 28) {
      nextDay(g);
      found = g.state.career.lifetime.truffles;
      g.actions.career.collect('pigsty');
    }
    return { g, ev, found };
  };
  const a = run();
  const b = run();
  assert.ok(a.found > 0, 'des truffes en automne et en hiver');
  assert.equal(a.found, b.found, 'déterministe');
  const t = a.ev.of('truffleFound')[0];
  assert.equal(t.buildingId, 'pigsty');
  assert.equal(t.amount, t.count * 60);
  const collected = a.ev.of('collected').filter((c) => c.buildingId === 'pigsty').reduce((s, c) => s + c.amount, 0);
  assert.equal(collected, a.found * 60, 'chaque truffe vaut 60');
  // Espérance : 4 cochons × 30 % × 14 aubes ≈ 17.
  assert.ok(a.found >= 6 && a.found <= 30, `${a.found}`);
});

test('lapins : +1 par couple à chaque début de saison, dans la limite du clapier', () => {
  const g = richCareer(3);
  g.actions.career.build('yard', 1, 'hutch');
  for (let k = 0; k < 3; k++) g.actions.buyInvestment('rabbit');
  const ev = record(g);
  while (g.state.time.seasonIndex === 0) nextDay(g);
  assert.equal(g.state.investments.rabbit, 4, '3 lapins : 1 couple → 1 lapereau');
  const born = ev.of('animalBorn')[0];
  assert.deepEqual([born.animalId, born.count, born.buildingId], ['rabbit', 1, 'hutch']);
  while (g.state.time.seasonIndex === 1) nextDay(g);
  assert.equal(g.state.investments.rabbit, 4, 'clapier plein (4)');
  g.actions.career.upgradeBuilding('hutch');
  while (g.state.time.seasonIndex === 2) nextDay(g);
  assert.equal(g.state.investments.rabbit, 6, '2 couples, place pour 4 de plus');
  assert.equal(g.state.career.paid.animals, 120, 'les lapereaux sont gratuits (patrimoine inchangé)');
});

test('cheval : balades (+8 par jour et par cheval, printemps → automne) avec la chambre d\'hôte', () => {
  const g = richCareer(3);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  const ev = record(g);
  nextDay(g);
  assert.ok(!ev.of('dawn')[0].incomes.some((i) => i.kind === 'rides'), 'pas sans chambre d\'hôte');
  g.actions.career.build(meadow, 1, 'guestHouse');
  nextDay(g);
  const rides = ev.of('dawn')[1].incomes.find((i) => i.kind === 'rides');
  assert.deepEqual([rides.source, rides.amount, rides.key], ['horse', 8, 'guests']);
  g.state.time.seasonIndex = 3;
  g.state.time.day = 22;
  g.state.time.dayOfSeason = 1;
  nextDay(g);
  assert.ok(!ev.of('dawn')[2].incomes.some((i) => i.kind === 'rides'), 'pas en hiver');
});

test('soigneur : +5 % par niveau sur la production de ses terrains (ami des bêtes : +5 % de plus)', () => {
  const g = richCareer(2);
  g.actions.career.upgradeBuilding('coop');
  for (let k = 0; k < 6; k++) g.actions.buyInvestment('hen');
  const s = hireAs(g, 'keeper', 'yard');
  s.trait = 'thrifty';
  s.level = 2;
  nextDay(g);
  // 8 poules × 2 × 1,10 = 17,6 → 18 ; le soigneur ramasse dans la journée.
  atFrac(g, 0.2);
  assert.equal(g.state.career.buildings.coop.pending, 18);
  s.trait = 'animalLover';
  g.actions.career.collect('coop');
  nextDay(g);
  atFrac(g, 0.2);
  assert.equal(g.state.career.buildings.coop.pending, 18, '8 × 2 × 1,15 = 18,4 → 18');
  assert.ok(Math.abs(g.query.career.shelter('coop').keeperBonus - 0.15) < 1e-9);
  // En congé : pas de bonus.
  g.actions.career.setLeave(s.id, true);
  g.actions.career.collect('coop');
  nextDay(g);
  assert.equal(g.state.career.buildings.coop.pending, 16);
});

test('sauvegarde : production en attente et dernier ramassage gardés ; vérification', () => {
  const g = newCareer();
  nextDay(g);
  nextDay(g);
  const saved = g.serialize();
  const g2 = loadCareer(saved);
  assert.equal(g2.state.career.buildings.coop.pending, 8);
  saved.career.buildings.coop.lastCollected = 'hier';
  assert.throws(() => loadCareer(saved), /ramassage/);
});

test('rang : un animal verrouillé reste visible avec son rang', () => {
  const g = newCareer();
  const pig = g.query.investments().find((i) => i.id === 'pig');
  assert.equal(pig.lockedByRank, 3);
  assert.equal(pig.canBuy, false);
  setRank(g, 3);
  g.state.money = 1e5;
  assert.match(g.actions.buyInvestment('pig').reason, /porcherie/);
  void DAY_SECONDS;
});
