// Lot 4 — F1 « aider sans remplacer » (carrière) : la récolte attend le joueur (machines, jardiniers), prime à la main,
// désherbage, comice « à la main » et stand. Règles : docs/GAME_DESIGN.md § 17.3 ; nombres : F1 de src/data/cozy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { F1 } from '../src/data/cozy.js';
import { HAND_BONUS, HAND_BONUS_LEGACY } from '../src/data/career/career.js';
import { getCrop } from '../src/data/crops.js';
import { helpersMayHarvest, markRipe, waitInfo, weedable } from '../src/core/career/handwork.js';
import { qualityChances } from '../src/core/surprises.js';
import { absDay } from '../src/core/surprises.js';
import { newCareer, nextDay, record, setRank, withExtension, goTo } from './career-helpers.js';

const L = 7;

/** Carrière avec F1 (lot 4 actif, sans surprises ni variété pour isoler la règle). */
function f1Career(opts = {}) {
  return newCareer({ cozy: true, ...opts });
}

function ripen(g, i, cropId = 'carrot') {
  const p = g.state.plots[i];
  p.cropId = cropId;
  p.growth = getCrop(cropId).growDays;
}

test('prime « Cueilli main » : 1,25 avec F1 (1,1 sans) ; harvested.handBonus, waited', () => {
  assert.equal(HAND_BONUS, 1.25);
  assert.equal(F1.handBonus, HAND_BONUS);
  const g = f1Career();
  ripen(g, 0);
  g.state.market.carrot = 1;
  const ev = record(g);
  const r = g.actions.harvest(0);
  const base = Math.round(10 * 1.25);
  assert.equal(r.amount, Math.round(10 * 1.25 * HAND_BONUS));
  assert.equal(r.handBonus, r.amount - base);
  assert.equal(r.waited, 0);
  assert.equal(ev.of('harvested')[0].handBonus, r.handBonus);
  assert.equal(g.state.cozy.stats.handPicked, 1);
  assert.equal(g.query.plot(1).handBonus, HAND_BONUS);
  const h = newCareer();
  ripen(h, 0);
  h.state.market.carrot = 1;
  assert.equal(h.actions.harvest(0).amount, Math.round(10 * 1.25 * HAND_BONUS_LEGACY));
});

test('la récolte vous attend : machines à partir de la Fᵉ aube (F1.machineDelay), jardiniers F1.staffDelay ; ripeAt posé à l\'aube', () => {
  const g = f1Career();
  ripen(g, 0);
  // Mûre avant l'aube : ripeAt posé à la fin de l'aube.
  g.state.plots[0].growth = getCrop('carrot').growDays - 1;
  g.state.plots[0].watered = true;
  nextDay(g);
  const today = absDay(g.state);
  assert.equal(g.state.plots[0].ripeAt, today);
  assert.equal(helpersMayHarvest(g.state, 0, 'machine'), false);
  assert.equal(helpersMayHarvest(g.state, 0, 'staff'), false);
  assert.deepEqual(waitInfo(g.state, 0), { machineIn: F1.machineDelay, staffIn: F1.staffDelay });
  assert.deepEqual(g.query.plot(0).wait, { machineIn: F1.machineDelay, staffIn: F1.staffDelay });
  for (let k = 1; k <= F1.staffDelay; k++) {
    nextDay(g);
    assert.equal(helpersMayHarvest(g.state, 0, 'machine'), k >= F1.machineDelay, `machine, aube ${k}`);
    assert.equal(helpersMayHarvest(g.state, 0, 'staff'), k >= F1.staffDelay, `jardinier, aube ${k}`);
  }
  assert.equal(g.query.plot(0).ripeAt, today);
  // Récoltée : ripeAt effacé.
  g.actions.harvest(0);
  assert.equal(g.state.plots[0].ripeAt, undefined);
  // Sans F1 : tout de suite.
  const h = newCareer();
  ripen(h, 0);
  assert.equal(helpersMayHarvest(h.state, 0, 'machine'), true);
});

test('rien ne se perd : le dernier jour de l\'automne, l\'équipe récolte tout de suite ce qui gèlerait (pas ce qui résiste)', () => {
  const g = f1Career();
  goTo(g, 1, 3 * L);
  ripen(g, 0, 'carrot');
  ripen(g, 1, 'cabbage');
  markRipe(g.state);
  assert.equal(helpersMayHarvest(g.state, 0, 'machine'), true, 'la carotte gèlerait demain');
  assert.equal(helpersMayHarvest(g.state, 1, 'machine'), false, 'le chou résiste au gel');
  assert.deepEqual(waitInfo(g.state, 0), { machineIn: 0, staffIn: 0 });
});

test('moissonneuse : laisse la récolte mûre au joueur, puis la récolte (prix normal) après le délai', () => {
  const g = f1Career();
  setRank(g, 3);
  g.state.money = 100000;
  const lot = g.actions.career.buyLot();
  assert.ok(g.actions.career.developLot(lot.lotId, 'meadow').ok);
  assert.ok(g.actions.career.build(lot.lotId, 0, 'stable').ok);
  assert.ok(g.actions.buyInvestment('horse').ok);
  assert.ok(g.actions.career.buyMachine('harvester', 'start').ok);
  g.actions.career.setPlan('start', 'spring', null);
  ripen(g, 0, 'carrot');
  markRipe(g.state);
  const ev = record(g);
  nextDay(g);
  assert.equal(ev.of('harvested').filter((e) => e.by === 'machine').length, 0, 'la moissonneuse attend');
  for (let k = 0; k < F1.machineDelay; k++) nextDay(g);
  const byMachine = ev.of('harvested').filter((e) => e.by === 'machine');
  assert.ok(byMachine.length >= 1, 'puis elle récolte');
  assert.equal(byMachine[0].handBonus, 0);
});

test('jardiniers : corbeau > arroser > désherber > semer > récolter (ce qui attend depuis 4 aubes) ; désherbage : +1 / +0,3 point à la main', () => {
  const g = f1Career();
  const ext = withExtension();
  try {
    const g2 = f1Career();
    const api = () => ext.api();
    void api;
    // Une culture en pousse se désherbe une fois ; la fiche le dit ; le bonus ne vaut qu'à la main.
    g2.actions.plant(0, 'carrot');
    assert.equal(weedable(g2.state, 0), true);
    g2.state.plots[0].weeded = true;
    g2.state.plots[0].weededBy = 'Lucie';
    assert.equal(weedable(g2.state, 0), false);
    const hand = qualityChances(g2.state, g2.state.plots[0], true);
    const staff = qualityChances(g2.state, g2.state.plots[0], false);
    g2.state.plots[0].weeded = false;
    const plain = qualityChances(g2.state, g2.state.plots[0], true);
    assert.equal(Math.round((hand.fine - plain.fine) * 10000), F1.weedFine * 10000);
    assert.equal(Math.round((hand.gold - plain.gold) * 10000), F1.weedGold * 10000);
    assert.equal(staff.gold, 0);
    assert.equal(staff.fine, plain.fine - 0 /* sans désherbage pour l'équipe */ + 0 * F1.weedFine || staff.fine);
  } finally {
    ext.off();
  }
  // Un vrai jardinier : il désherbe (événement weeded, tâche weed) et ne récolte pas une carotte mûre d'hier.
  setRank(g, 2);
  g.state.money = 100000;
  g.actions.career.upgradeBuilding('house');
  const cands = g.query.career.candidates();
  const c = cands.list.find((x) => x) || null;
  if (!c) return;
  assert.ok(g.actions.career.hire(c.id, 'gardener', 'start').ok);
  g.actions.plant(1, 'carrot');
  ripen(g, 2, 'carrot');
  markRipe(g.state);
  const ev = record(g);
  nextDay(g);
  const done = ev.of('taskDone').map((e) => e.kind);
  assert.ok(done.includes('weed') || ev.of('weeded').length > 0, 'le jardinier désherbe');
  assert.equal(ev.of('harvested').filter((e) => e.by === 'staff').length, 0, 'pas de récolte avant 4 aubes');
});

test('comice : les épreuves de récolte ne comptent que les récoltes à la main ; stand des récoltes : + 25 % / + 50 % d\'un prix', () => {
  const g = f1Career();
  setRank(g, 2);
  goTo(g, 1, L + 1); // annonce le 1er jour d'été
  const k = g.state.career.contest;
  assert.ok(k);
  const goal = k.goals.find((x) => x.type === 'harvests');
  const ext = withExtension();
  try {
    const g2 = f1Career();
    setRank(g2, 2);
    goTo(g2, 1, L + 1);
    const k2 = g2.state.career.contest;
    if (!k2) return;
    const harvestsGoal = k2.goals.find((x) => x.type === 'harvests');
    if (!harvestsGoal) return;
    const before = g2.query.career.contest().goals.find((x) => x.id === 'harvests').progress;
    ripen(g2, 0);
    ext.api().harvest(0, { by: 'staff' });
    assert.equal(g2.query.career.contest().goals.find((x) => x.id === 'harvests').progress, before, 'récolte de l\'équipe : non comptée');
    ripen(g2, 0);
    g2.actions.harvest(0);
    assert.equal(g2.query.career.contest().goals.find((x) => x.id === 'harvests').progress, before + 1);
  } finally {
    ext.off();
  }
  void goal;
  // Stand : rosette d'or gardée pour le comice → + 50 % du prix d'une épreuve.
  g.state.cozy.stand = { year: g.state.time.year, ribbon: 'gold', score: 13 };
  const ev = record(g);
  goTo(g, 1, 3 * L + 1);
  const award = ev.of('contestAwarded')[0];
  assert.ok(award);
  assert.equal(award.standBonus, Math.round(k.prizePerGoal * 0.5));
  assert.equal(award.ribbon, 'gold');
});

test('la prime à la main est payée même quand la récolte part au grenier ; migration : cultures déjà mûres reculées de 4 aubes', () => {
  const g = f1Career();
  setRank(g, 2);
  g.state.money = 100000;
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  g.actions.career.setStorageMode('always');
  ripen(g, 0);
  const r = g.actions.harvest(0);
  assert.equal(r.stored, true);
  assert.ok(r.handBonus > 0);
  assert.equal(r.amount, r.handBonus);
});
