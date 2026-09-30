// Mode Carrière — sauvegarde (clé, copie de secours, métadonnées, archive), chargement et migration,
// vérification de l'état, progression (progress.career, écus, succès de carrière).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, careerMetaOf, loadCareer as loadCareerGame, migrateCareer, checkCareerState, NEWER_SAVE_MESSAGE } from '../src/core/career/career.js';
import { CAREER_ACHIEVEMENTS, ACHIEVEMENTS } from '../src/data/achievements.js';
import * as P from '../src/core/progression.js';
import { newCareer, nextDay, record, setRank, skipDays, skipYear, tendAll } from './career-helpers.js';

const store = new Map();
globalThis.window = globalThis.window || {};
const mockStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
/**
 * tests/storage.test.js installe aussi un faux localStorage : chaque test installe le sien et remet
 * l'ancien à la fin (t.after).
 */
function useStore(t) {
  const previous = window.localStorage;
  window.localStorage = mockStorage;
  store.clear();
  t.after(() => {
    window.localStorage = previous;
  });
}
const storage = await import('../src/storage.js');
const KEY = 'une-annee-a-la-ferme.career';
const BAK = 'une-annee-a-la-ferme.career.bak';

test('sauvegarde / chargement : aller-retour exact, la partie reprend à l\'identique', () => {
  const a = newCareer({ seed: 11, farmName: 'Le Clos' });
  a.state.money = 5000;
  setRank(a, 2);
  a.actions.career.buyLot();
  a.actions.career.developLot('lot3', 'field');
  a.actions.career.upgradeBuilding('storage');
  for (let d = 0; d < 10; d++) {
    tendAll(a);
    nextDay(a, d % 3 ? 'sunny' : 'rain');
  }
  const saved = a.serialize();
  const b = loadCareerGame(JSON.parse(JSON.stringify(saved)));
  assert.equal(b.mode, 'career');
  assert.deepEqual(b.serialize(), saved);
  assert.deepEqual(b.level, a.level);
  // Même suite de journées → même état (aucun état caché hors de state).
  for (let d = 0; d < 40; d++) {
    for (const g of [a, b]) {
      tendAll(g);
      nextDay(g, d % 4 ? 'sunny' : 'rain');
    }
  }
  assert.deepEqual(b.serialize(), a.serialize());
  assert.equal(a.state.time.year, 2);
});

test('saveCareer : enveloppe { schema, savedAt, meta, state } ; copie de secours au plus une fois par jour de jeu', (t) => {
  useStore(t);
  const g = newCareer({ farmName: 'Les Tilleuls' });
  const meta = careerMetaOf(g);
  assert.deepEqual(Object.keys(meta).sort(), ['day', 'difficulty', 'farmName', 'farmerGender', 'patrimony', 'rank', 'rankName', 'seasonId', 'seasonLength', 'status', 'title', 'year'].sort());
  assert.ok(storage.saveCareer(g.serialize(), meta));
  const env = JSON.parse(store.get(KEY));
  assert.equal(env.schema, 1);
  assert.ok(Number.isFinite(env.savedAt));
  assert.deepEqual(env.meta, meta);
  assert.equal(store.has(BAK), false, 'pas de copie de secours avant une 2e sauvegarde');
  assert.deepEqual(storage.careerMeta(), meta);
  // 2e sauvegarde le même jour : la précédente (relue avec succès) devient la copie de secours.
  storage.saveCareer(g.serialize(), meta);
  const bak1 = JSON.parse(store.get(BAK));
  assert.equal(bak1.state.time.day, 1);
  // Même jour de jeu : la copie de secours ne change pas.
  g.state.money += 1;
  storage.saveCareer(g.serialize(), meta);
  assert.equal(JSON.parse(store.get(BAK)).savedAt, bak1.savedAt);
  // Jour suivant : la sauvegarde d'hier devient la copie de secours.
  nextDay(g);
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  nextDay(g);
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  assert.equal(storage.loadCareerBackup().state.time.day, 2);
  assert.equal(storage.loadCareer().state.time.day, 3);
  // Sauvegarde principale abîmée : jamais recopiée dans la copie de secours.
  store.set(KEY, JSON.stringify({ schema: 1, state: { mode: 'career', career: { version: 1 } } }));
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  assert.equal(storage.loadCareerBackup().state.time.day, 2);
  // Illisible : lecture nulle, la copie de secours se recharge.
  store.set(KEY, '{pas du json');
  assert.equal(storage.loadCareer(), null);
  assert.equal(storage.careerMeta(), null);
  const back = loadCareerGame(storage.loadCareerBackup().state);
  assert.equal(back.state.time.day, 2);
  store.clear();
});

test('clearCareer : archive dans progress.career.archive (5 dernières) puis efface ; resetProgress efface la carrière', (t) => {
  useStore(t);
  const g = newCareer();
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  for (let k = 0; k < 6; k++) storage.clearCareer({ archive: { farmName: `Ferme ${k}`, years: k + 1, rank: 2, patrimony: 1234.4, endedBy: 'restart' } });
  const p = storage.loadProgress();
  assert.equal(p.career.archive.length, 5);
  assert.deepEqual(p.career.archive[0], { farmName: 'Ferme 5', years: 6, rank: 2, patrimony: 1234, endedBy: 'restart' });
  assert.equal(store.has(KEY), false);
  assert.equal(store.has(BAK), false);
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  storage.clearCareer();
  assert.equal(storage.loadCareer(), null);
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  storage.saveCareer(g.serialize(), careerMetaOf(g));
  storage.resetProgress();
  assert.equal(store.has(KEY), false);
  assert.equal(store.has(BAK), false);
  store.clear();
});

test('migrateCareer : champs ajoutés complétés ; version plus récente refusée (sans effacer)', () => {
  const g = newCareer();
  const saved = g.serialize();
  const old = JSON.parse(JSON.stringify(saved));
  delete old.career.assetLog;
  delete old.career.yearStats;
  delete old.career.lifetime.cropsInSeason;
  delete old.plots[0].crowPenalty;
  const m = migrateCareer(old);
  assert.deepEqual(m.career.assetLog, []);
  assert.equal(m.career.yearStats.incomeBy.crops, 0);
  assert.deepEqual(m.career.lifetime.cropsInSeason, {});
  assert.equal(m.plots[0].crowPenalty, false);
  assert.equal(checkCareerState(m), null);
  assert.equal(old.career.assetLog, undefined, 'entrée non modifiée');
  const newer = JSON.parse(JSON.stringify(saved));
  newer.career.version = 99;
  assert.throws(() => loadCareerGame(newer), (e) => e.code === 'newer' && e.message === NEWER_SAVE_MESSAGE);
  assert.throws(() => migrateCareer({ mode: 'levels' }), /invalide/);
  assert.throws(() => loadCareerGame(null), /invalide/);
});

test('checkCareerState : sauvegardes incohérentes refusées', () => {
  const g = newCareer();
  g.state.money = 1e5;
  setRank(g, 2);
  g.actions.career.buyLot();
  g.actions.career.developLot('lot3', 'meadow');
  g.actions.career.build('lot3', 0, 'goatShed');
  g.actions.buyInvestment('goat');
  const ok = g.serialize();
  assert.equal(checkCareerState(ok), null);
  const broken = [
    (s) => { s.career.lots[3].type = 'castle'; },
    (s) => { s.investments.goat = 9; },
    (s) => { s.time.day = 5; },
    (s) => { s.time.dayOfSeason = 8; },
    (s) => { s.career.seasonLength = 9; },
    (s) => { s.career.lotsBought = 2; },
    (s) => { s.plots[0].cropId = 'apple'; },
    (s) => { s.career.stock = { carrot: 5 }; },
    (s) => { s.career.buildings.goatShed.slot = 1; },
    (s) => { s.career.rank = 7; },
    (s) => { s.career.objectives.nope = true; },
    (s) => { s.career.staff = [{ id: 's1' }]; },
    (s) => { s.career.farmerGender = 'chevalier'; },
    (s) => { s.perks = { almanac: 1 }; },
    (s) => { delete s.rng.staff; },
    (s) => { s.neighbourLoan = null; },
    (s) => { s.status = 'victory'; },
  ];
  for (const [k, f] of broken.entries()) {
    const s = JSON.parse(JSON.stringify(ok));
    f(s);
    assert.notEqual(checkCareerState(s), null, `cas ${k}`);
    assert.throws(() => loadCareerGame(s), /invalide/, `cas ${k}`);
  }
});

test('carrière en faillite (Classique) : se recharge, reste terminée', () => {
  const g = createCareer({ seed: 2, difficulty: 'classique' });
  g.state.weather.today = 'sunny';
  skipDays(g, 6);
  g.state.money = 0;
  nextDay(g);
  assert.equal(g.state.status, 'bankrupt');
  const again = loadCareerGame(g.serialize());
  assert.equal(again.state.status, 'bankrupt');
  assert.equal(again.actions.career.buyLot().ok, false);
});

test('progression : progress.career par défaut, normalisation, archive', () => {
  const d = P.defaultProgress();
  assert.deepEqual(d.career, { started: false, bestRank: 0, bestYear: 0, years: 0, archive: [] });
  const n = P.normalizeProgress({ career: { started: 'oui', bestRank: 9, bestYear: 3.7, years: -2, archive: [{ farmName: '', years: 2, rank: 3, patrimony: 'x', endedBy: 'bankrupt' }, 'bad'] } });
  assert.deepEqual(n.career, { started: false, bestRank: 6, bestYear: 3, years: 0, archive: [{ farmName: 'Ferme des Tilleuls', years: 2, rank: 3, patrimony: 0, endedBy: 'bankrupt' }] });
  assert.deepEqual(P.normalizeProgress(n), n, 'idempotent');
  const a = P.archiveCareer(d, { farmName: 'La Combe', years: 4, rank: 3, patrimony: 5000, endedBy: 'bankrupt' });
  assert.equal(a.career.archive[0].farmName, 'La Combe');
  assert.equal(a.career.bestRank, 3);
  assert.deepEqual(d.career.archive, [], 'entrée intacte');
});

test('progression : écus du bilan annuel (10 + 3 × rang + ⌊bénéfice / 1 000⌋ ≤ 20, +10 Manoir), rang, succès', () => {
  const NOW = 1000;
  assert.equal(P.ecusForCareerYear({ rank: 1, net: 800 }), 13);
  assert.equal(P.ecusForCareerYear({ rank: 3, net: 5400 }), 24);
  assert.equal(P.ecusForCareerYear({ rank: 6, net: 90000, houseLevel: 5 }), 10 + 18 + 20 + 10);
  assert.equal(P.ecusForCareerYear({ rank: 2, net: -300 }), 16);
  let p = P.defaultProgress();
  const start = P.recordCareerStart(p, NOW);
  assert.deepEqual(start.achievements, ['careerStart']);
  assert.equal(start.progress.ecus, 5);
  assert.equal(start.progress.career.started, true);
  p = start.progress;
  const report = { cropsHarvested: { carrot: 60, wheat: 45 }, productsSold: { flour: 3 }, houseLevel: 1 };
  const y = P.recordCareerYear(p, { year: 1, rank: 2, net: 1500, report, career: { rank: 2, lots: 1, staffCount: 0, machines: [], cropsInSeason: [], year: 2 } }, NOW);
  assert.equal(y.rewards.ecus, 10 + 6 + 1);
  assert.ok(y.achievements.includes('firstLot'));
  assert.ok(y.achievements.includes('harvest100'), 'les récoltes de la carrière comptent pour « Cent paniers »');
  assert.equal(y.progress.lifetime.harvests, 105);
  assert.equal(y.progress.career.years, 1);
  assert.equal(y.progress.career.bestYear, 2);
  assert.equal(y.progress.career.bestRank, 2);
  const r = P.recordCareerRank(y.progress, 3, NOW);
  assert.equal(r.rewards.ecus, 60);
  assert.deepEqual(r.achievements, ['rank3']);
  // Aucune étoile gagnée en carrière.
  assert.equal(P.starsEarned(r.progress), 1, 'seule l\'étoile de « Cent paniers » (succès des niveaux)');
});

test('succès de carrière : 17, 440 écus, sans étoile ; conditions évaluées sur ctx.career', () => {
  assert.equal(ACHIEVEMENTS.length, 26, 'la liste des niveaux ne change pas');
  assert.equal(CAREER_ACHIEVEMENTS.length, 17);
  assert.equal(CAREER_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 440);
  assert.ok(CAREER_ACHIEVEMENTS.every((a) => a.category === 'career' && a.reward.stars === 0));
  const p = P.defaultProgress();
  const ctx = (career) => ({ levelId: 'career', status: 'playing', stats: { year: { cropsHarvested: {}, productsSold: {}, cropsLost: { frost: 0, rot: 0 } }, season: null }, career });
  const all = {
    rank: 6, lots: 12, staffCount: 8, maxStaffLevel: 5, machines: ['tractor'], cropsInSeason: ['tomato@winter'], species: 8, truffles: 10,
    hearts: 10, contestAll: true, year: 10, stock: 250, yearNet: 10000,
  };
  const ids = P.checkAchievements(p, ctx(all));
  for (const a of CAREER_ACHIEVEMENTS) assert.ok(ids.includes(a.id), a.id);
  assert.deepEqual(P.checkAchievements(p, ctx({ rank: 1, lots: 0, staffCount: 0, machines: [], cropsInSeason: [], year: 1 })), ['careerStart']);
  assert.deepEqual(P.checkAchievements(p, null), [], 'progression seule : rien');
  // Contexte d'une vraie carrière.
  const g = newCareer();
  const real = g.query.achievementContext();
  assert.equal(real.levelId, 'career');
  assert.deepEqual(Object.keys(real.career).sort(), ['animals', 'bestYearNet', 'contestAll', 'cropsInSeason', 'hearts', 'houseLevel', 'lots', 'machines', 'maxStaffLevel', 'rank', 'species', 'staffCount', 'stock', 'stockCapacity', 'truffles', 'year', 'yearNet'].sort());
  assert.deepEqual(P.checkAchievements(p, real), ['careerStart']);
  const list = P.careerAchievementList(p, real);
  assert.equal(list.length, 17);
  assert.equal(list[0].category, 'career');
  assert.equal(P.achievementList(p, null).length, 26);
});

test('bilan de l\'année : revenus et dépenses par poste, meilleure culture, historique', () => {
  const g = newCareer();
  const ev = record(g);
  for (let d = 0; d < 28; d++) {
    tendAll(g);
    nextDay(g);
  }
  const ye = ev.of('yearEnd')[0];
  const rep = ye.report;
  assert.equal(rep.year, 1);
  assert.equal(rep.net, rep.income - rep.spent);
  assert.equal(rep.spentBy.seasonCharges, 80);
  assert.ok(rep.incomeBy.crops > 0);
  assert.equal(rep.incomeBy.animals, 2 * 2 * 27, '27 aubes dans l\'année 1 (le jour 1 commence sans aube)');
  assert.ok(rep.bestCrop && rep.bestCrop.income > 0);
  assert.equal(rep.harvests, Object.values(rep.cropsHarvested).reduce((a, b) => a + b, 0));
  assert.deepEqual(g.query.career.history()[0].year, 1);
  assert.equal(g.query.career.yearReport(1).net, rep.net);
  assert.equal(g.query.career.yearReport().year, 2);
  assert.equal(g.query.career.yearReport().net, g.state.career.yearStats.incomeBy.animals - g.state.career.yearStats.spentBy.charges - g.state.career.yearStats.spentBy.seeds + g.state.career.yearStats.incomeBy.crops);
  skipYear(g);
  assert.equal(g.query.career.history().length, 2);
});
