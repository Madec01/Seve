// La Vallée vivante (lot V4) — le livre de la vallée (une page par année reconstruite depuis les jours gardés, avant /
// après, grilles, calendrier, récits, cartes), jours des étapes (gardés, ou reconstruits pour une ancienne carrière),
// phrases d'Hélène, bilan de l'année. docs/VALLEE.md § 18.6 et § 18.10.5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HELENE_NOTES } from '../src/data/career/storks.js';
import { heleneNote, reconstructStageAt } from '../src/core/career/storks.js';
import { hashSeed } from '../src/core/rng.js';
import { playCareer } from '../tools/simulate-career.js';
import { A, Q, V, absOf, nextDay, stage8Career, toSeason, v4Career } from './valley4-helpers.js';

test('jours des étapes : l\'étape 0 au début de la Vallée, puis chaque étape franchie (V4 actif)', () => {
  const g = v4Career();
  assert.deepEqual(V(g).stageAt[0], { abs: V(g).started.abs });
  A(g).triggerValley('stage', 3);
  for (const n of [1, 2, 3]) assert.equal(V(g).stageAt[n].abs, absOf(g));
  assert.equal(V(g).stageAt[4], undefined);
});

test('le livre : couverture, avant / après, une page par année (≤ 6 lignes, la phrase d\'Hélène), graines, êtres, lieux, calendrier, récits, cartes', () => {
  const g = stage8Career();
  A(g).triggerValley('visitor', 'crane', 'seen');
  A(g).openValleyBook();
  assert.equal(V(g).stats.bookOpened, 1);
  const b = Q(g).valleyBook();
  assert.match(b.title, /^La vallée de /);
  assert.equal(b.farmName, g.state.career.farmName);
  assert.equal(b.since, V(g).started.year);
  assert.equal(b.cover.total, 99);
  assert.equal(b.cover.vignette, 'valley.stage.8');
  assert.equal(b.beforeAfter.to.vignette, 'valley.stage.8');
  assert.equal(b.beforeAfter.to.signs, b.cover.signs);
  assert.match(b.beforeAfter.text, /^\d+ → \d+ signes de vie$/);
  assert.equal(b.years.length, g.state.time.year - V(g).started.year + 1);
  for (const y of b.years) {
    assert.ok(y.lines.length <= 6);
    assert.equal(y.vignette, `valley.stage.${y.stage}`);
  }
  const last = b.years.at(-1);
  assert.equal(last.stage, 8);
  assert.ok(last.lines.includes('Étape 8 · Les cigognes'));
  assert.ok(last.lines.includes('Les cigognes sur le clocher du village'));
  assert.equal(b.seeds.length, 40);
  assert.deepEqual(b.seeds.filter((x) => x.kind === 'legend').map((x) => x.id), ['motherMelon', 'millEinkorn', 'farmMarvel', 'storkPea']);
  assert.equal(b.beings.length, 32);
  assert.deepEqual(b.beings.filter((x) => x.kind === 'visitor' && x.state === 'seen').map((x) => x.id), ['whiteStork', 'crane']);
  assert.equal(b.beings.find((x) => x.id === 'oriole').name, '?', 'silhouette tant qu\'il n\'est pas venu');
  assert.equal(b.places.length, 6);
  assert.deepEqual(b.calendar.map((c) => c.id), ['whiteStork', 'crane']);
  assert.match(b.calendar[0].when, /^Printemps, \dᵉ jour : les cigognes$/);
  assert.ok(b.stories.some((s) => s.kind === 'chapter' && s.id === 8));
  assert.deepEqual(b.postcards, []);
  assert.deepEqual(b.epilogue, { read: false, credits: false });
  // Une page de plus par année.
  toSeason(g, 3);
  toSeason(g, 0);
  assert.equal(Q(g).valleyBook().years.length, b.years.length + 1);
});

test('phrases d\'Hélène : une par année, hachage pur de la graine et de l\'année ; seulement après son arrivée', () => {
  const g = v4Career();
  assert.equal(heleneNote(g.state, 9), HELENE_NOTES[hashSeed(g.state.seed, 'helene9') % 12]);
  assert.ok(Q(g).valleyBook().years.every((y) => y.helene === null), 'avant Hélène : rien');
  A(g).triggerValley('stage', 7);
  const y = Q(g).valleyBook().years.at(-1);
  assert.equal(y.helene, heleneNote(g.state, y.year));
});

test('ancienne carrière : le jour de chaque étape reconstruit depuis les dates gardées (approché, jamais en arrière, après les lieux demandés)', () => {
  const c = playCareer({ seed: 2, strategy: 'casual', years: 18, valley: { storks: false }, keepGame: true });
  const s = c.game.state;
  const v = s.career.valley;
  v.parts.storks = true;
  const at = reconstructStageAt(s);
  assert.equal(Object.keys(at).length, v.stage + 1);
  let prev = 0;
  for (let n = 0; n <= v.stage; n++) {
    assert.equal(at[n].approx, true);
    assert.ok(at[n].abs >= prev, `étape ${n} pas avant l'étape ${n - 1}`);
    prev = at[n].abs;
  }
  if (v.stage >= 6) assert.ok(at[6].abs >= v.places.brook.steps[2]);
  if (v.stage >= 7) for (const p of Object.values(v.places)) assert.ok(at[7].abs >= p.steps[2]);
  assert.ok(prev <= (s.time.year - 1) * 4 * s.career.seasonLength + s.time.day);
});

test('bilan de l\'année : légendes, récoltes, visiteurs vus, cigogneaux, cartes, avant / après ; compteurs remis à zéro', () => {
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  A(g).sowLegend('storkPea');
  A(g).triggerValley('legendRipe', 'storkPea');
  A(g).harvestLegend('storkPea');
  A(g).triggerValley('visitor', 'crane', 'seen');
  const rep = g.query.career.yearReport().valley;
  for (const k of ['legends', 'legendHarvests', 'visitorsSeen', 'chicks', 'postcards', 'stageStart', 'stageYearStart', 'stageNow', 'startYear']) assert.ok(k in rep, k);
  assert.equal(rep.legendHarvests, 1);
  assert.equal(rep.visitorsSeen, 2);
  assert.equal(rep.stageNow, 8);
  assert.equal(rep.stageStart, 0);
  assert.equal(rep.startYear, V(g).started.year);
  let report = null;
  g.on('yearEnd', (e) => (report = e.report));
  const year = g.state.time.year;
  while (g.state.time.year === year) nextDay(g);
  assert.equal(report.valley.legendHarvests, 1);
  assert.equal(V(g).year.legendHarvests, 0);
  assert.equal(V(g).year.visitorsSeen, 0);
});
