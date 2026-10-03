// Lot 4 — D3 : les lanternes de fin d'année (calcul pur, soir des lanternes, récompenses de la progression).
// Règles : docs/GAME_DESIGN.md § 17.2 ; barèmes : LANTERN_RULES de src/data/cozy.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { careerCare, lanternsFor, litFor } from '../src/core/lanterns.js';
import { LANTERN_RULES } from '../src/data/cozy.js';
import * as P from '../src/core/progression.js';
import { nextDay, record } from './helpers.js';

const NOW = 1_700_000_000_000;

test('litFor : 1 lanterne toujours, + 1 par palier atteint', () => {
  assert.equal(litFor(0, [1, 2, 3]), 1);
  assert.equal(litFor(1, [1, 2, 3]), 2);
  assert.equal(litFor(2.5, [1, 2, 3]), 3);
  assert.equal(litFor(99, [1, 2, 3]), 4);
});

test('niveaux : paliers de la variété en parts de k (cultures sans les rares + recettes) ; prospérité sur les seuils d\'étoiles', () => {
  const R = LANTERN_RULES.levels;
  const k = 7;
  const steps = R.variety.map((x) => Math.ceil(x * k));
  const facts = { variety: { v: steps[1], k }, care: { cared: 5, harvests: 10 }, neighbours: R.neighbours[2], beauty: 0, prosperity: { money: 600, s2: 600, s3: 900 } };
  const res = lanternsFor(facts, 'levels');
  assert.deepEqual(res.criteria.map((c) => c.id), ['variety', 'care', 'neighbours', 'beauty', 'prosperity']);
  assert.equal(res.values[0], 3);
  assert.equal(res.criteria[0].k, 7);
  assert.equal(res.values[1], litFor(0.5, R.care));
  assert.equal(res.values[2], 4);
  assert.equal(res.values[3], 1, 'jamais moins d\'une lanterne');
  assert.equal(res.values[4], 3, '≥ ★★');
  assert.equal(res.total, res.values.reduce((a, b) => a + b, 0));
  assert.equal(res.criteria[3].next.need, R.beauty[0]);
  assert.equal(res.criteria[2].next, null);
  // Sans les surprises : le soin vaut 2 lanternes.
  assert.equal(lanternsFor({ ...facts, care: { fallback: true } }, 'levels').values[1], LANTERN_RULES.careFallback);
  // Aucun mot négatif.
  for (const c of res.criteria) assert.ok(!/ne |pas |moins|perdu|raté/i.test(c.measure), c.measure);
});

test('carrière : soin = moyenne des récoltes à la main soignées et des abris ramassés à temps ; prospérité = croissance du patrimoine', () => {
  assert.equal(careerCare({ hand: 6, harvests: 10, collected: 80, lost: 20, shelters: true }), (0.6 + 0.8) / 2);
  assert.equal(careerCare({ hand: 6, harvests: 10, collected: 0, lost: 0, shelters: false }), 0.6);
  const R = LANTERN_RULES.career;
  const res = lanternsFor({ variety: R.variety[2], care: { hand: 9, harvests: 10, collected: 1, lost: 0, shelters: true }, neighbours: 0, beauty: R.beauty[0], prosperity: { start: 2000, end: 2000 * (1 + R.prosperity[1]) } }, 'career');
  assert.deepEqual(res.values, [4, 4, 1, 2, 3]);
  // Croissance mesurée sur au moins 1 000 de patrimoine (première année).
  const small = lanternsFor({ prosperity: { start: 100, end: 100 + 1000 * R.prosperity[0] } }, 'career');
  assert.equal(small.values[4], 2);
  assert.equal(lanternsFor({ prosperity: { start: 5000, end: 4000 } }, 'career').criteria[4].measure, 'Une année pour souffler');
});

test('niveau Détente : lanternsLit le dernier soir, juste avant la victoire ; state.result.lanterns et summary.cozy.lanterns', () => {
  const g = createGame({ levelId: 2, seed: 6, difficulty: 'detente' });
  g.state.money = 5000;
  const ev = record(g);
  while (g.state.status === 'playing') nextDay(g);
  const types = ev.events.map((e) => e.type);
  const lit = types.indexOf('lanternsLit');
  assert.ok(lit >= 0);
  assert.equal(types.indexOf('victory'), lit + 1, 'lanternsLit juste avant victory');
  const e = ev.of('lanternsLit')[0];
  assert.equal(e.values.length, 5);
  assert.equal(e.levelId, 2);
  assert.equal(e.criteria[4].lit, 4, '5000 pièces : prospérité au maximum');
  assert.deepEqual(g.state.result.lanterns.values, e.values);
  assert.deepEqual(ev.of('victory')[0].summary.cozy.lanterns.values, e.values);
  // Classique : aucune lanterne.
  const c = createGame({ levelId: 2, seed: 6, difficulty: 'classique' });
  c.state.money = 5000;
  const evc = record(c);
  while (c.state.status === 'playing') nextDay(c);
  assert.equal(evc.of('lanternsLit').length, 0);
  assert.equal(c.state.result.lanterns, undefined);
});

test('aperçu de l\'année (query.lanterns) ; lanternes désactivées (cozy: { lanterns: false })', () => {
  const g = createGame({ levelId: 3, seed: 2, difficulty: 'detente' });
  const q = g.query.lanterns();
  assert.equal(q.criteria.length, 5);
  assert.ok(q.total >= 5 && q.total <= 20);
  assert.equal(q.partial, false);
  const h = createGame({ levelId: 3, seed: 2, difficulty: 'detente', cozy: { lanterns: false } });
  assert.equal(h.query.lanterns(), null);
});

test('progression : écus des niveaux (total − meilleur précédent, la 1re fois total − 5), lanternes de couleur, grand lampion, succès', () => {
  let p = P.defaultProgress();
  let r = P.recordLanterns(p, { mode: 'levels', levelId: 1, values: [2, 3, 2, 4, 2] }, NOW);
  assert.equal(r.rewards.ecus, 13 - 5);
  assert.equal(r.rewards.newBest, true);
  assert.deepEqual(r.rewards.cosmetics, ['lantern.yellow']);
  assert.ok(r.progress.cosmetics.owned.includes('lantern.yellow'));
  assert.equal(r.progress.ecus, 8);
  assert.deepEqual(P.levelLanterns(r.progress, 1), { best: [2, 3, 2, 4, 2], total: 13 });
  p = r.progress;
  r = P.recordLanterns(p, { mode: 'levels', levelId: 1, values: [2, 2, 2, 2, 2] }, NOW);
  assert.equal(r.rewards.ecus, 0, 'moins bien : rien, sans rien perdre');
  assert.equal(r.progress.lanterns.levels[1].total, 13);
  r = P.recordLanterns(p, { mode: 'levels', levelId: 1, values: [3, 3, 3, 3, 3] }, NOW);
  assert.equal(r.rewards.ecus, 2);
  assert.deepEqual(r.achievements, ['brightYear']);
  r = P.recordLanterns(r.progress, { mode: 'career', values: [4, 4, 4, 4, 4] }, NOW);
  assert.equal(r.rewards.ecus, Math.floor((20 - 5) / 2));
  assert.ok(r.rewards.cosmetics.includes('lantern.grand'));
  assert.ok(r.achievements.includes('allLanterns'));
  assert.equal(r.progress.lanterns.career.years, 1);
  assert.equal(r.progress.lanterns.grand, true);
  assert.deepEqual(r.progress.lanterns.firsts.sort(), ['beauty', 'care', 'neighbours', 'prosperity', 'variety']);
  assert.deepEqual(P.normalizeProgress(r.progress).lanterns, r.progress.lanterns, 'normalisation idempotente');
});
