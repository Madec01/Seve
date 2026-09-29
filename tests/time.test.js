import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, newGame, nextDay, record, rich, skipDays } from './helpers.js';
import { getLevel } from '../src/data/levels.js';

test('état initial du calendrier', () => {
  const g = newGame(1);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.speed, 1);
  assert.equal(g.state.money, getLevel(1).startMoney);
  assert.deepEqual(g.query.calendar(), {
    day: 1,
    dayOfSeason: 1,
    seasonIndex: 0,
    seasonId: 'spring',
    seasonName: 'Printemps',
    seasonLength: 7,
    daysLeftInSeason: 6,
    dayProgress: 0,
    totalDays: 28,
  });
  const f = g.query.forecast();
  assert.ok(f.today && f.tomorrow);
});

test('un jour dure DAY_SECONDS secondes à la vitesse ×1', () => {
  const g = newGame(1);
  const rec = record(g);
  g.update(DAY_SECONDS / 2);
  assert.equal(g.query.calendar().dayProgress, 0.5);
  assert.equal(rec.of('dawn').length, 0);
  g.update(DAY_SECONDS / 2);
  assert.equal(rec.of('dawn').length, 1);
  assert.equal(g.query.calendar().day, 2);
  assert.equal(g.query.calendar().dayProgress, 0);
});

test('vitesses ×2, ×4 et pause', () => {
  const g = newGame(1);
  assert.deepEqual(g.actions.setSpeed(2), { ok: true, speed: 2 });
  g.update(DAY_SECONDS / 2);
  assert.equal(g.query.calendar().day, 2);
  g.actions.setSpeed(4);
  g.update(DAY_SECONDS / 4);
  assert.equal(g.query.calendar().day, 3);
  g.actions.setSpeed(0);
  g.update(1000);
  assert.equal(g.query.calendar().day, 3);
  assert.equal(g.query.calendar().dayProgress, 0);
  const bad = g.actions.setSpeed(3);
  assert.equal(bad.ok, false);
  assert.equal(typeof bad.reason, 'string');
  assert.equal(g.state.speed, 0);
});

test('dt invalide ignoré', () => {
  const g = newGame(1);
  for (const dt of [-5, 0, NaN, undefined, Infinity * 0]) g.update(dt);
  assert.equal(g.state.time.elapsed, 0);
});

test('un grand dt traite plusieurs aubes, dans l’ordre', () => {
  const g = newGame(1);
  rich(g, 1000);
  const rec = record(g);
  g.update(DAY_SECONDS * 5 + 3);
  const dawns = rec.of('dawn');
  assert.deepEqual(
    dawns.map((d) => d.day),
    [2, 3, 4, 5, 6],
  );
  assert.equal(g.query.calendar().day, 6);
  assert.ok(Math.abs(g.state.time.elapsed - 3) < 1e-9);
  // Chaque aube est précédée de sa météo.
  const types = rec.events.filter((e) => e.type === 'weather' || e.type === 'dawn').map((e) => e.type);
  assert.deepEqual(types, ['weather', 'dawn', 'weather', 'dawn', 'weather', 'dawn', 'weather', 'dawn', 'weather', 'dawn']);
  // 5 jours de charges fixes.
  assert.equal(g.state.money, 1000 - 5 * g.query.finance().dailyCharges);
});

test('un grand dt équivaut à des petits pas', () => {
  const a = newGame(3, 77);
  const b = newGame(3, 77);
  a.update(DAY_SECONDS * 30);
  for (let i = 0; i < 30 * 8; i++) b.update(DAY_SECONDS / 8);
  assert.deepEqual(a.serialize(), b.serialize());
});

test('un grand dt s’arrête à la faillite', () => {
  const g = newGame(1);
  g.state.money = 0;
  const rec = record(g);
  g.update(DAY_SECONDS * 40);
  assert.equal(g.state.status, 'bankrupt');
  assert.equal(rec.of('bankrupt').length, 1);
  assert.equal(g.query.calendar().day, 7);
  assert.equal(rec.of('dawn').length, 6);
  // Plus rien ne bouge ensuite.
  const snapshot = g.serialize();
  g.update(DAY_SECONDS * 10);
  assert.deepEqual(g.serialize(), snapshot);
  const r = g.actions.plant(1, 'carrot');
  assert.deepEqual(r, { ok: false, reason: 'La partie est terminée.' });
  assert.equal(g.query.plot(1).action, null);
});

test('les saisons s’enchaînent jusqu’à la victoire', () => {
  const g = newGame(1);
  rich(g);
  const rec = record(g);
  g.update(DAY_SECONDS * 100);
  assert.deepEqual(
    rec.of('seasonStart').map((e) => [e.seasonId, e.seasonIndex]),
    [
      ['summer', 1],
      ['autumn', 2],
      ['winter', 3],
    ],
  );
  assert.equal(rec.of('billPaid').length, 4);
  assert.deepEqual(
    rec.of('billPaid').map((e) => e.seasonId),
    ['spring', 'summer', 'autumn', 'winter'],
  );
  assert.equal(rec.of('victory').length, 1);
  assert.equal(g.state.status, 'victory');
  assert.equal(g.query.calendar().day, 28);
  // Ordre : le dernier fermage puis la victoire, en toute fin.
  const last = rec.events.slice(-3).map((e) => e.type);
  assert.deepEqual(last, ['moneyChanged', 'billPaid', 'victory']);
});

test('avertissements 2 jours avant chaque changement de saison', () => {
  const g = newGame(1);
  rich(g);
  const rec = record(g);
  const warnings = [];
  g.on('seasonWarning', (w) => warnings.push({ ...w, day: g.state.time.day }));
  g.update(DAY_SECONDS * 100);
  assert.deepEqual(warnings, [
    { nextSeasonId: 'summer', daysLeft: 2, frost: false, day: 6 },
    { nextSeasonId: 'autumn', daysLeft: 2, frost: false, day: 13 },
    { nextSeasonId: 'winter', daysLeft: 2, frost: true, day: 20 },
  ]);
  assert.equal(rec.of('seasonWarning').length, 3);
});

test('niveau 5 : un hiver de 14 jours', () => {
  const g = newGame(5);
  rich(g);
  assert.equal(g.query.calendar().totalDays, 35);
  skipDays(g, 21);
  assert.equal(g.query.calendar().seasonId, 'winter');
  assert.equal(g.query.calendar().seasonLength, 14);
  skipDays(g, 13);
  assert.equal(g.query.calendar().day, 35);
  assert.equal(g.state.status, 'playing');
  nextDay(g);
  assert.equal(g.state.status, 'victory');
});
