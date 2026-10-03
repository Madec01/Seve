// Lot 4 — sauvegardes : migration (Détente, Classique, carrière), aller-retour, vérification (checkCozy), progression
// (album, lanternes, lifetime.cozy) et rattrapage au chargement (src/storage.js). Contrat : « Lot 4 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame } from '../src/core/game.js';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { checkCozy } from '../src/core/cozy.js';
import { F1 } from '../src/data/cozy.js';
import { getCrop } from '../src/data/crops.js';
import { absDay } from '../src/core/surprises.js';
import { defaultProgress, normalizeProgress, recordCareerYear } from '../src/core/progression.js';
import { DAY_SECONDS, nextDay, skipDays } from './helpers.js';

/** Sauvegarde « d'avant le lot 4 » : sans state.cozy ni son flux. */
function preLot4(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  delete s.cozy;
  delete s.rng.cozy;
  if (s.stats) for (const k of ['year', 'season']) delete s.stats[k].cozyIncome;
  if (s.variety?.stats) delete s.variety.stats.merchantVisits;
  for (const p of s.plots || []) {
    delete p.ripeAt;
    delete p.weeded;
  }
  return s;
}

test('niveaux : une partie Détente d\'avant le lot 4 le reçoit à la reprise (année « partielle »), les autres flux ne bougent pas', () => {
  const g = createGame({ levelId: 2, seed: 5, difficulty: 'detente', cozy: false });
  skipDays(g, 5);
  const old = preLot4(g.serialize());
  const back = loadGame(old);
  const z = back.state.cozy;
  assert.ok(z);
  assert.equal(z.year.partial, true);
  assert.ok(Number.isInteger(back.state.rng.cozy));
  for (const k of ['weather', 'market', 'rot', 'quality', 'surprise', 'sky', 'orders', 'variety']) assert.equal(back.state.rng[k], old.rng[k], k);
  assert.equal(back.state.variety.stats.merchantVisits, 0, 'compteur du lot 3 ajouté');
  nextDay(back);
  assert.equal(back.query.lanterns().partial, true);
  // Aller-retour.
  const again = loadGame(back.serialize());
  assert.deepEqual(again.state.cozy, back.state.cozy);
});

test('niveaux : Classique d\'avant le lot 4 → rien ; cozy: false gardé tel quel ; hiver en cours à la reprise : mangeoire sortie', () => {
  const c = createGame({ levelId: 2, seed: 5, difficulty: 'classique' });
  skipDays(c, 3);
  const back = loadGame(preLot4(c.serialize()));
  assert.equal('cozy' in back.state, false);
  const off = createGame({ levelId: 2, seed: 5, difficulty: 'detente', cozy: false });
  assert.equal(loadGame(off.serialize()).state.cozy, null);
  const w = createGame({ levelId: 2, seed: 5, difficulty: 'detente', cozy: false });
  w.state.money = 10000;
  while (w.state.time.day < 23) nextDay(w);
  const wb = loadGame(preLot4(w.serialize()));
  assert.equal(wb.state.cozy.winter.feeder.here, true);
  assert.ok(wb.state.cozy.winter.storyDay > 0);
});

test('carrière d\'avant le lot 4 : activé à la reprise ; cultures déjà mûres : ripeAt reculé de 4 aubes (l\'équipe peut récolter)', () => {
  const g = createCareer({ seed: 3, cozy: false, surprises: false, variety: false });
  g.state.weather.today = 'sunny';
  g.actions.plant(0, 'carrot');
  g.state.plots[0].growth = getCrop('carrot').growDays;
  skipDays(g, 2);
  const old = preLot4(g.serialize());
  const back = loadCareer(old);
  assert.ok(back.state.cozy);
  assert.equal(back.state.cozy.parts.helpers, true);
  assert.equal(back.state.cozy.year.partial, true);
  assert.equal(back.state.plots[0].ripeAt, absDay(back.state) - F1.migrateRipeBack);
  assert.ok(back.state.cozy.year.patrimonyStart > 0);
  assert.deepEqual(back.state.cozy.lanterns, { history: [] });
  const again = loadCareer(back.serialize());
  assert.deepEqual(again.state.cozy, back.state.cozy);
});

test('checkCozy : version, fête inconnue, objets cachés, trouvailles, réserve, ripeAt dans le futur', () => {
  const g = createGame({ levelId: 2, seed: 5, difficulty: 'detente' });
  assert.equal(checkCozy(g.state), null);
  const bad = (fn) => {
    const s = g.serialize();
    fn(s);
    return checkCozy(s);
  };
  assert.ok(bad((s) => (s.cozy.v = 99)));
  assert.ok(bad((s) => (s.cozy.fete = { id: 'dragon', engine: 'chasse', day: 1, hidden: null, villagers: null, done: false, result: null })));
  assert.ok(bad((s) => (s.cozy.fete = { id: 'springFete', engine: 'chasse', day: 1, hidden: [{ u: 2, gold: false, found: null }], villagers: null, done: false, result: null })));
  assert.ok(bad((s) => (s.cozy.winter.finds = [1, 2, 3, 4].map((k) => ({ id: `w${k}`, kind: 'holly', u: 0.5, day: 1 })))));
  assert.ok(bad((s) => (s.cozy.seedBank = { carrot: -1 })));
  assert.ok(bad((s) => (s.cozy.year.produced.crops.dragonfruit = 1)));
  assert.throws(() => loadGame({ ...g.serialize(), cozy: { v: 2 } }));
  assert.ok(loadGame({ ...g.serialize(), cozy: { v: 1 } }).state.cozy.year, 'champs manquants complétés (completeCozy)');
  const c = createCareer({ seed: 1 });
  assert.equal(checkCozy(c.state), null);
  const cs = c.serialize();
  cs.plots[0].ripeAt = absDay(c.state) + 5;
  assert.ok(checkCozy(cs));
});

test('progression : album, lanternes et lifetime.cozy ajoutés par normalizeProgress (schéma inchangé) ; bilan annuel compte report.cozy', () => {
  const old = { schema: 2, levels: { 1: { stars: 2, bestMoney: 300, completed: true } }, lifetime: { harvests: 3 } };
  const p = normalizeProgress(old);
  assert.equal(p.schema, 2);
  assert.equal(p.album.retroDone, false);
  assert.deepEqual(p.lanterns.levels, {});
  assert.deepEqual(p.lifetime.cozy, { handPicked: 0, eggsAll: 0, ribbonsGold: 0, birds: {}, fetes: 0 });
  assert.equal(defaultProgress().album.retroDone, true, 'une progression neuve n\'a rien à rattraper');
  const r = recordCareerYear(defaultProgress(), { year: 1, rank: 2, net: 1000, report: { cropsHarvested: {}, productsSold: {}, cozy: { stats: { handPicked: 40, eggsAll: 1, ribbons: { gold: 1 }, birds: { robin: 1 }, fetes: { soup: 1 } } } } });
  assert.deepEqual(r.progress.lifetime.cozy, { handPicked: 40, eggsAll: 1, ribbonsGold: 1, birds: { robin: 1 }, fetes: 1 });
  assert.ok(r.achievements.includes('eggHunter') && r.achievements.includes('goldRosette'));
});

test('stockage : au premier chargement sans album, rattrapage depuis les sauvegardes (lues sans être modifiées), une seule fois', async () => {
  const store = new Map();
  globalThis.window = globalThis.window || {};
  const saved = window.localStorage;
  window.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    const storage = await import('../src/storage.js');
    const g = createGame({ levelId: 2, seed: 4, difficulty: 'detente', cozy: false });
    g.state.stats.year.cropsHarvested.tomato = 3;
    const runState = preLot4(g.serialize());
    store.set('une-annee-a-la-ferme.run', JSON.stringify({ savedAt: 1, meta: {}, state: runState }));
    store.set('une-annee-a-la-ferme.progress', JSON.stringify({ schema: 2, lifetime: { cropsHarvested: { carrot: 1 } } }));
    const p = storage.loadProgress();
    assert.ok(p.album.found['garden.carrot'] && p.album.found['garden.tomato']);
    const m = storage.albumMigration();
    assert.ok(m.cases.includes('garden.tomato'));
    assert.equal(storage.albumMigration(), null, 'une seule fois');
    assert.equal(JSON.parse(store.get('une-annee-a-la-ferme.run')).state.cozy, undefined, 'sauvegarde intacte');
    assert.equal(storage.loadProgress().album.retroDone, true);
    void DAY_SECONDS;
  } finally {
    window.localStorage = saved;
  }
});
