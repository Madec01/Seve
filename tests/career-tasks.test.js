// Mode Carrière — moteur des tâches (CORE-B) : heures de travail, durée des actions, priorités du jardinier,
// action déjà faite par le joueur (pas d'expérience), machines avant employés, tournées du soigneur,
// événements pour le rendu (trajets), workPlan(), déterminisme, découpage du temps, sauvegarde en pleine tâche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCareer } from '../src/core/career/career.js';
import { createGame } from '../src/core/game.js';
import { WORK } from '../src/data/career/staff.js';
import { DAY_SECONDS, atFrac, hireAs, lotPlots, newCareer, newLot, nextDay, record, richCareer, snapshot, sowDirect } from './career-crew-helpers.js';

const D = DAY_SECONDS;

function gardenerFarm({ trait = 'loyal', seed = 7 } = {}) {
  const g = richCareer(3, { seed });
  const s = hireAs(g, 'gardener', 'start');
  s.trait = trait;
  return { g, s };
}

test('jardinier : commence à 15 % du jour (« Matinal » 5 %), action = 70 % du jour ÷ actions, jusqu\'à 85 %', () => {
  const { g, s } = gardenerFarm();
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  nextDay(g);
  for (const i of lotPlots(g, 'start')) g.state.plots[i].watered = false;
  const ev = record(g);
  atFrac(g, 0.149);
  assert.equal(ev.of('taskStarted').length, 0);
  atFrac(g, 0.151);
  const first = ev.of('taskStarted')[0];
  assert.equal(first.staffId, s.id);
  assert.equal(first.startAt, 0.15 * D);
  const d = (0.7 * D) / 14;
  assert.ok(Math.abs(first.doneAt - first.startAt - d) < 1e-9);
  assert.deepEqual(first.from, { type: 'home', lotId: 'home' });
  assert.equal(first.target.type, 'plot');
  assert.equal(first.kind, 'water');
  atFrac(g, 1);
  const done = ev.of('taskDone').filter((e) => e.staffId === s.id && e.kind !== 'home');
  assert.ok(done.length <= 14 && done.length >= 12, `${done.length}`);
  assert.ok(ev.of('taskStarted').filter((e) => e.kind !== 'home').every((e) => e.doneAt <= WORK.end * D + 1e-9));
  const last = ev.of('taskStarted').at(-1);
  assert.equal(last.kind, 'home', 'retour à la maison en fin de journée');
  assert.equal(s.task, null);
  // Enchaînement : chaque tâche part de la cible de la précédente.
  const starts = ev.of('taskStarted');
  for (let k = 1; k < starts.length; k++) assert.deepEqual(starts[k].from, starts[k - 1].target);
  // Matinal.
  const m = gardenerFarm({ trait: 'earlyBird' });
  sowDirect(m.g, lotPlots(m.g, 'start'), 'carrot');
  nextDay(m.g);
  const ev2 = record(m.g);
  atFrac(m.g, 0.06);
  assert.equal(ev2.of('taskStarted')[0].startAt, 0.05 * D);
});

test('jardinier : priorités corbeau > récolte > arrosage > semis (plan), et « idle » quand il n\'y a rien', () => {
  const { g, s } = gardenerFarm();
  const plots = lotPlots(g, 'start');
  g.actions.career.setPlan('start', 'spring', 'carrot');
  sowDirect(g, [plots[0]], 'carrot');
  sowDirect(g, [plots[1]], 'carrot', { mature: true });
  sowDirect(g, [plots[2]], 'carrot');
  g.state.plots[plots[2]].crow = true;
  for (const i of plots.slice(3)) g.state.plots[i].unlocked = false;
  const ev = record(g);
  atFrac(g, 0.9);
  const kinds = ev.of('taskDone').filter((e) => e.staffId === s.id).map((e) => [e.kind, e.target.plotIndex ?? null, e.result.ok]);
  assert.deepEqual(kinds.slice(0, 5), [
    ['chase', plots[2], true],
    ['harvest', plots[1], true],
    ['water', plots[0], true],
    ['water', plots[2], true],
    ['sow', plots[1], true],
  ]);
  assert.equal(g.state.plots[plots[1]].cropId, 'carrot', 'semé selon le plan');
  assert.ok(ev.of('harvested').every((h) => h.by === 'staff' && !h.handPicked));
  assert.ok(ev.of('crowChased').some((c) => c.by === 'staff'));
  assert.deepEqual(kinds[5], ['water', plots[1], true], 'le semis du jour s\'arrose');
  assert.ok(kinds.slice(6).every(([k]) => k === 'idle' || k === 'home'), 'ensuite : rien à faire, puis retour à la maison');
  assert.equal(s.xp, 5 + kinds.slice(5).filter(([k, , ok]) => k !== 'idle' && ok).length);
});

test('le joueur a déjà fait l\'action : l\'employé passe à la suivante, sans expérience', () => {
  const { g, s } = gardenerFarm();
  const plots = lotPlots(g, 'start');
  sowDirect(g, plots, 'carrot', { mature: true });
  g.actions.career.setPlan('start', 'spring', null);
  const ev = record(g);
  atFrac(g, 0.151);
  const t = s.task;
  assert.equal(t.kind, 'harvest');
  // Le joueur récolte la même parcelle avant la fin de la tâche.
  assert.ok(g.actions.harvest(t.target.plotIndex).ok);
  atFrac(g, t.doneAt / D + 0.0001);
  const done = ev.of('taskDone')[0];
  assert.equal(done.result.ok, false);
  assert.equal(s.xp, 0);
  assert.notEqual(s.task.target.plotIndex, t.target.plotIndex, 'une autre parcelle');
});

test('deux jardiniers ne visent jamais la même parcelle ; « tous les champs » couvre plusieurs terrains', () => {
  const g = richCareer(3);
  const f2 = newLot(g, 'field');
  const a = hireAs(g, 'gardener', 'all');
  const b = hireAs(g, 'gardener', 'all');
  a.trait = 'loyal';
  b.trait = 'loyal';
  g.actions.career.setPlan('start', 'spring', null);
  g.actions.career.setPlan(f2, 'spring', null);
  sowDirect(g, [...lotPlots(g, 'start'), ...lotPlots(g, f2)], 'carrot', { mature: true });
  const ev = record(g);
  for (let k = 0; k < 200; k++) {
    g.update(D / 200);
    if (a.task?.target?.type === 'plot' && b.task?.target?.type === 'plot') assert.notEqual(a.task.target.plotIndex, b.task.target.plotIndex);
  }
  const lots = new Set(ev.of('harvested').map((h) => g.state.plots[h.plotIndex].lot));
  assert.ok(lots.has('start') && lots.has(f2));
});

test('machines avant employés : le jardinier laisse la récolte à la moissonneuse, puis fait le reste', () => {
  const g = richCareer(3);
  const meadow = newLot(g, 'meadow');
  g.actions.career.build(meadow, 0, 'stable');
  g.actions.buyInvestment('horse');
  g.actions.career.buyMachine('harvester', 'start');
  g.actions.career.setPlan('start', 'spring', null);
  const s = hireAs(g, 'gardener', 'start');
  s.trait = 'loyal';
  const plots = lotPlots(g, 'start');
  sowDirect(g, plots, 'carrot', { mature: true });
  const ev = record(g);
  atFrac(g, 0.3);
  assert.equal(ev.of('harvested').length, 0, 'avant 30 % : le jardinier attend la machine');
  atFrac(g, 0.9);
  const h = ev.of('harvested');
  assert.equal(h.filter((e) => e.by === 'machine').length, 8);
  assert.equal(h.filter((e) => e.by === 'staff').length, 4, 'les 4 dernières : le jardinier');
  assert.equal(new Set(h.map((e) => e.plotIndex)).size, 12, 'jamais deux fois la même');
});

test('soigneur : tournées à 25 %, 55 % et 85 % ; 2 points par abri ramassé', () => {
  const g = richCareer(3);
  g.actions.career.build('yard', 1, 'hutch');
  g.actions.buyInvestment('rabbit');
  const s = hireAs(g, 'keeper', 'yard');
  s.trait = 'loyal';
  nextDay(g);
  const ev = record(g);
  atFrac(g, 0.24);
  assert.equal(ev.of('collected').length, 0);
  assert.equal(s.task.kind, 'idle');
  assert.ok(Math.abs(s.task.doneAt - 0.25 * D) < 1e-9, 'attend la tournée');
  atFrac(g, 0.4);
  const c = ev.of('collected');
  assert.deepEqual(c.map((e) => [e.buildingId, e.by]), [['coop', 'keeper'], ['hutch', 'keeper']]);
  assert.ok(c[0].staffId === s.id);
  assert.equal(s.xp, 4);
  const visits = ev.of('taskStarted').filter((e) => e.kind === 'collect');
  assert.equal(visits[0].startAt, 0.25 * D);
  assert.ok(Math.abs(visits[0].doneAt - visits[0].startAt - 0.03 * D) < 1e-9);
  atFrac(g, 1);
  assert.equal(ev.of('taskStarted').filter((e) => e.kind === 'collect').length, 6, '3 tournées × 2 abris');
  assert.equal(s.xp, 4, 'abris vides ensuite : pas d\'expérience');
});

test('artisan et vendeur : tâches d\'animation à l\'atelier, au grenier et à l\'étal', () => {
  const g = richCareer(3);
  const shops = newLot(g, 'workshops');
  g.actions.career.build(shops, 0, 'jamWorkshop');
  g.actions.career.build(shops, 1, 'mill');
  g.actions.career.upgradeBuilding('storage');
  g.actions.career.upgradeBuilding('roadsideStand');
  const a = hireAs(g, 'artisan', shops);
  const v = hireAs(g, 'seller');
  const ev = record(g);
  atFrac(g, 0.6);
  const crafts = ev.of('taskStarted').filter((e) => e.staffId === a.id);
  assert.deepEqual(crafts.slice(0, 2).map((e) => [e.kind, e.target.buildingId]), [['craft', 'jamWorkshop'], ['craft', 'mill']]);
  const sells = ev.of('taskStarted').filter((e) => e.staffId === v.id);
  assert.deepEqual(sells.slice(0, 2).map((e) => [e.kind, e.target.buildingId]), [['sell', 'storage'], ['idle', 'roadsideStand']]);
});

test('workPlan() : ce que lit le rendu (apparence, statut, tâche, outil)', () => {
  const { g, s } = gardenerFarm();
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  let plan = g.query.career.workPlan();
  assert.equal(plan.length, 1);
  assert.deepEqual([plan[0].staffId, plan[0].status, plan[0].task, plan[0].job], [s.id, 'working', null, 'gardener']);
  assert.deepEqual(plan[0].look, s.look);
  atFrac(g, 0.2);
  plan = g.query.career.workPlan();
  const t = plan[0].task;
  assert.ok(t && t.kind === 'water' && t.target.type === 'plot' && t.startAt <= g.state.time.elapsed && t.doneAt > g.state.time.elapsed);
  assert.equal(plan[0].tool, 'can');
  const clock = g.query.career.workClock();
  assert.equal(clock.elapsed, g.state.time.elapsed);
  g.actions.career.setLeave(s.id, true);
  plan = g.query.career.workPlan();
  assert.deepEqual([plan[0].status, plan[0].task], ['leave', null]);
});

test('déterminisme : même graine et mêmes gestes → même partie ; un grand dt = beaucoup de petits', () => {
  const make = () => {
    const g = richCareer(4, { seed: 21 });
    const f2 = newLot(g, 'field');
    const meadow = newLot(g, 'meadow');
    g.actions.career.build(meadow, 0, 'pigsty');
    g.actions.buyInvestment('pig');
    g.actions.buyInvestment('pig');
    g.actions.career.build(meadow, 1, 'stable');
    g.actions.buyInvestment('horse');
    g.actions.career.buyMachine('sprinklers', f2);
    g.actions.career.buyMachine('seeder', f2);
    g.actions.career.buyMachine('harvester', f2);
    g.actions.career.buyMachine('collector', 'coop');
    g.actions.career.upgradeBuilding('storage');
    hireAs(g, 'gardener', 'start');
    hireAs(g, 'gardener', f2);
    hireAs(g, 'keeper', meadow);
    hireAs(g, 'seller');
    return g;
  };
  const a = make();
  const b = make();
  const c = make();
  for (let d = 0; d < 40; d++) {
    a.update(D);
    b.update(D);
    for (let k = 0; k < 37; k++) c.update(D / 37);
  }
  assert.deepEqual(snapshot(b), snapshot(a));
  assert.equal(c.state.time.day, a.state.time.day);
  assert.deepEqual(snapshot(c), snapshot(a), 'découpage du temps sans effet');
  assert.ok(a.state.career.lifetime.harvests > 20);
  assert.ok(a.state.career.work.stats.staffActions > 100);
});

test('sauvegarde en pleine tâche : la reprise continue la même tâche, jusqu\'au même état', () => {
  const { g } = gardenerFarm();
  const keeper = hireAs(g, 'keeper', 'yard');
  void keeper;
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  g.actions.career.setPlan('start', 'spring', 'carrot');
  nextDay(g);
  atFrac(g, 0.43);
  const busy = g.state.career.staff.filter((s) => s.task);
  assert.ok(busy.length >= 1);
  const g2 = loadCareer(g.serialize());
  assert.deepEqual(g2.query.career.workPlan(), g.query.career.workPlan());
  for (let d = 0; d < 10; d++) {
    g.update(D / 3);
    g2.update(D / 3);
  }
  assert.deepEqual(snapshot(g2), snapshot(g));
});

test('congé ou renvoi en pleine tâche : la tâche s\'arrête ; affectation en pleine journée : il commence tout de suite', () => {
  const { g, s } = gardenerFarm();
  sowDirect(g, lotPlots(g, 'start'), 'carrot');
  atFrac(g, 0.3);
  assert.ok(s.task);
  g.actions.career.setLeave(s.id, true);
  assert.equal(s.task, null);
  const ev = record(g);
  atFrac(g, 0.4);
  assert.equal(ev.of('taskStarted').length, 0);
  g.actions.career.setLeave(s.id, false);
  atFrac(g, 0.41);
  assert.equal(ev.of('taskStarted')[0].startAt, 0.4 * D, 'reprend à l\'heure où on le rappelle');
  g.actions.career.assign(s.id, 'keeper', 'yard');
  assert.equal(s.task, null);
});

test('mode Niveaux : aucune tâche, aucun employé, aucun tirage « staff »', () => {
  const g = createGame({ levelId: 3, seed: 5, difficulty: 'classique' });
  g.update(D * 3);
  assert.equal(g.state.career, undefined);
  assert.equal(g.query.career, undefined);
  assert.equal(g.actions.career, undefined);
  assert.deepEqual(Object.keys(g.state.rng).sort(), ['market', 'rot', 'weather']);
  assert.ok(newCareer().state.rng.staff !== undefined, 'le flux « staff » n\'existe qu\'en carrière');
});

test('ancienne sauvegarde (avant CORE-B) : état du travail, champs des machines et des employés complétés', () => {
  const g = richCareer(3);
  g.actions.career.buyMachine('sprinklers', 'start');
  hireAs(g, 'gardener', 'start');
  const saved = g.serialize();
  delete saved.career.work;
  delete saved.career.machines['sprinklers@start'].usedDay;
  delete saved.career.machines['sprinklers@start'].workedDay;
  delete saved.career.staff[0].year;
  const g2 = loadCareer(saved);
  assert.ok(Array.isArray(g2.state.career.work.runs));
  assert.equal(g2.state.career.machines['sprinklers@start'].workedDay, 0);
  assert.ok(g2.state.career.staff[0].year);
  g2.update(D * 2);
  assert.equal(g2.state.status, 'playing');
});
