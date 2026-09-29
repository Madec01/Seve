import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame, STATE_VERSION } from '../src/core/game.js';
import { DAY_SECONDS } from './helpers.js';
import { LEVELS } from '../src/data/levels.js';

/** Petit joueur déterministe : récolte, achète, plante, arrose. */
function playDay(g) {
  const n = g.state.plots.length;
  for (let i = 0; i < n; i++) if (g.query.plot(i).action === 'harvest') g.actions.harvest(i);
  if (g.state.money > 250) g.actions.buyInvestment('chickenCoop');
  if (g.state.money > 300) {
    const locked = g.state.plots.findIndex((p) => !p.unlocked);
    if (locked >= 0) g.actions.unlockPlot(locked);
  }
  const crops = g.query.plantableCrops().filter((c) => !c.willFreeze);
  for (let i = 0; i < n; i++) {
    if (g.query.plot(i).action === 'plant' && crops.length) g.actions.plant(i, crops[i % crops.length].id);
  }
  for (let i = 0; i < n; i++) if (g.query.plot(i).action === 'water') g.actions.water(i);
}

function playUntilEnd(g, log) {
  for (let d = 0; d < 60 && g.state.status === 'playing'; d++) {
    playDay(g);
    g.update(DAY_SECONDS * 0.4);
    g.update(DAY_SECONDS * 0.6);
  }
  return log;
}

function logEvents(g) {
  const log = [];
  g.on('*', (e) => log.push(JSON.stringify(e)));
  return log;
}

test('serialize → loadGame : la partie continue à l’identique', () => {
  for (const levelId of [1, 3, 6, 7, 8]) {
    const a = createGame({ levelId, seed: 2024 });
    for (let d = 0; d < 9; d++) {
      playDay(a);
      a.update(DAY_SECONDS);
    }
    a.update(DAY_SECONDS / 3); // en plein milieu d'une journée
    const saved = a.serialize();
    const b = loadGame(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(b.state, a.state);
    const logA = playUntilEnd(a, logEvents(a));
    const logB = playUntilEnd(b, logEvents(b));
    assert.deepEqual(b.state, a.state, `niveau ${levelId}`);
    assert.deepEqual(logB, logA);
    assert.notEqual(a.state.status, 'playing');
  }
});

test('même graine et mêmes actions → même partie', () => {
  const a = createGame({ levelId: 2, seed: 'abc' });
  const b = createGame({ levelId: 2, seed: 'abc' });
  playUntilEnd(a, []);
  playUntilEnd(b, []);
  assert.deepEqual(a.serialize(), b.serialize());
  const c = createGame({ levelId: 2, seed: 'abd' });
  playUntilEnd(c, []);
  assert.notDeepEqual(c.state.weather, a.state.weather);
});

test("l'état est du JSON pur et serialize en fait une copie indépendante", () => {
  const g = createGame({ levelId: 1, seed: 1 });
  playDay(g);
  g.update(DAY_SECONDS * 3);
  assert.deepEqual(JSON.parse(JSON.stringify(g.state)), g.state);
  const copy = g.serialize();
  copy.money = -999;
  copy.plots[1].cropId = 'x';
  assert.notEqual(g.state.money, -999);
  assert.notEqual(g.state.plots[1].cropId, 'x');
  assert.equal(copy.version, STATE_VERSION);
  // loadGame copie aussi l'objet reçu
  const saved = g.serialize();
  const h = loadGame(saved);
  saved.money = 123456;
  assert.notEqual(h.state.money, 123456);
});

test('loadGame refuse les sauvegardes invalides', () => {
  assert.throws(() => loadGame(null));
  assert.throws(() => loadGame('texte'));
  const g = createGame({ levelId: 1, seed: 1 });
  assert.throws(() => loadGame({ ...g.serialize(), version: 999 }));
  assert.throws(() => loadGame({ ...g.serialize(), levelId: 42 }));
  assert.throws(() => createGame({ levelId: 42 }));
});

test('une partie terminée se recharge terminée', () => {
  const g = createGame({ levelId: 1, seed: 1 });
  g.state.money = 0;
  g.update(DAY_SECONDS * 10);
  assert.equal(g.state.status, 'bankrupt');
  const h = loadGame(g.serialize());
  assert.equal(h.state.status, 'bankrupt');
  h.update(DAY_SECONDS * 10);
  assert.deepEqual(h.state, g.state);
});

test('loadGame refuse une sauvegarde abîmée au lieu de planter plus tard', () => {
  const g = createGame({ levelId: 1, seed: 7 });
  g.update(DAY_SECONDS * 2.5);
  const good = g.serialize();
  const broken = (patch) => {
    const s = JSON.parse(JSON.stringify(good));
    patch(s);
    return s;
  };
  const cases = {
    'état minimal': () => ({ version: STATE_VERSION, levelId: 1, status: 'playing' }),
    'calendrier absent': () => broken((s) => delete s.time),
    'jour hors saison': () => broken((s) => (s.time.dayOfSeason = 9)),
    'heure NaN (null en JSON)': () => broken((s) => (s.time.elapsed = null)),
    'argent absent': () => broken((s) => (s.money = null)),
    'vitesse inconnue': () => broken((s) => (s.speed = 3)),
    'météo inconnue': () => broken((s) => (s.weather.today = 'grêle')),
    'culture inconnue': () => broken((s) => { s.plots[0].unlocked = true; s.plots[0].cropId = 'banane'; }),
    'grille d\'un autre niveau': () => broken((s) => (s.levelId = 4)),
    'investissement au-delà du maximum': () => broken((s) => (s.investments.chickenCoop = 9)),
    'investissement inconnu': () => broken((s) => (s.investments.dragon = 1)),
    'flux aléatoire absent': () => broken((s) => delete s.rng.weather),
    'statistiques absentes': () => broken((s) => delete s.stats),
  };
  for (const [name, make] of Object.entries(cases)) {
    assert.throws(() => loadGame(make()), /Sauvegarde invalide/, name);
  }
  // L'identifiant de niveau en texte (« 1 ») reste accepté et normalisé.
  const h = loadGame({ ...good, levelId: '1' });
  assert.equal(h.state.levelId, 1);
  assert.deepEqual({ ...h.state, levelId: 1 }, { ...good, levelId: 1 });
});

test('update ignore un dt infini ou invalide', () => {
  const g = createGame({ levelId: 1, seed: 7 });
  for (const dt of [Infinity, -Infinity, NaN, -5, 0, undefined]) g.update(dt);
  assert.equal(g.state.time.day, 1);
  assert.equal(g.state.time.elapsed, 0);
  assert.equal(g.state.status, 'playing');
});

test('loadGame accepte tout état atteint en jouant (tous niveaux, en cours de journée et en fin de partie)', () => {
  let checked = 0;
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 4; seed++) {
      const g = createGame({ levelId: level.id, seed });
      let r = seed * 7919;
      const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let step = 0; step < 200 && g.state.status === 'playing'; step++) {
        for (const p of g.query.plots()) {
          if (p.action === 'harvest') g.actions.harvest(p.index);
          else if (p.action === 'plant' && rnd() < 0.8) {
            const crops = g.query.plantableCrops(p.index);
            if (crops.length) g.actions.plant(p.index, crops[Math.floor(rnd() * crops.length)].id);
          } else if (p.action === 'water' && rnd() < 0.7) g.actions.water(p.index);
          else if (p.action === 'unlock' && rnd() < 0.05) g.actions.unlockPlot(p.index);
        }
        const buyable = g.query.investments().filter((i) => i.canBuy);
        if (buyable.length && rnd() < 0.3) g.actions.buyInvestment(buyable[Math.floor(rnd() * buyable.length)].id);
        if (seed % 2 === 0) g.state.money += 40; // tient l'année entière une fois sur deux
        g.update(DAY_SECONDS * (0.3 + rnd() * 0.5));
        const saved = JSON.parse(JSON.stringify(g.serialize()));
        const h = loadGame(saved);
        assert.deepEqual(h.state, g.state);
        checked++;
      }
    }
  }
  assert.ok(checked > 300);
});
