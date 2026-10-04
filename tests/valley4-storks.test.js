// La Vallée vivante (lot V4) — les cigognes et la fin douce : jour des cigognes (2ᵉ à 4ᵉ jour du printemps, hachage de la
// graine), clocher puis étape 8 (à l'aube qui suit leur visite), roue sur la maison, nid au printemps suivant, cigogneaux
// et départ, vallée complète, épilogue de Joseph, générique, cartes des vallées voisines, banc. docs/VALLEE.md § 18.4 à
// § 18.5 et § 18.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTCARDS } from '../src/data/career/storks.js';
import { ofFarm } from '../src/data/career/heritage.js';
import { checkValley } from '../src/core/career/valley.js';
import { benchLine, storkDay } from '../src/core/career/storks.js';
import { hashSeed } from '../src/core/rng.js';
import {
  A, Q, V, absOf, nextDay, record, stage7Career, stage8Career, toSeason, toSeasonDay, toStorkDay, v4Career,
} from './valley4-helpers.js';

test('jour des cigognes : 2ᵉ, 3ᵉ ou 4ᵉ jour du printemps, fixé par la graine (aucun hasard au-delà), quelle que soit la durée des saisons', () => {
  const days = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const g = v4Career({ seed });
    const d = storkDay(g.state);
    assert.ok(d >= 2 && d <= 4);
    assert.equal(d, 2 + (hashSeed(seed, 'storkDay') % 3));
    days.add(d);
  }
  assert.deepEqual([...days].sort(), [2, 3, 4]);
  const g10 = v4Career({ seed: 5, seasonLength: 10 });
  assert.equal(storkDay(g10.state), 2 + (hashSeed(5, 'storkDay') % 3));
});

test('le clocher : le jour des cigognes du premier printemps où la vallée les nourrit ; elles attendent sans limite qu\'on vienne les voir', () => {
  const g = v4Career();
  A(g).triggerValley('stage', 6);
  toStorkDay(g);
  assert.equal(V(g).stork.steepleAt, null, 'étape 6 : pas encore');
  A(g).triggerValley('stage', 7);
  const ev = record(g);
  toStorkDay(g);
  const arr = ev.of('storksArrived');
  assert.deepEqual(arr.map((e) => [e.where, e.first, e.day]), [['steeple', true, storkDay(g.state)]]);
  assert.equal(g.state.time.dayOfSeason, storkDay(g.state));
  assert.ok(ev.of('visitorVisible').some((e) => e.id === 'whiteStork' && e.spotId === 'steeple'));
  assert.equal(ev.of('visitorHint').filter((e) => e.id === 'whiteStork').length, 0, 'aucun indice : elles arrivent le jour dit');
  assert.equal(Q(g).valley().stork.state, 'steeple');
  const at = V(g).stork.steepleAt;
  ev.clear();
  toSeason(g, 2);
  toStorkDay(g);
  assert.equal(ev.of('storksArrived').length, 0);
  assert.equal(V(g).stork.steepleAt, at);
  assert.equal(V(g).visitors.whiteStork.state, 'visible');
  assert.equal(V(g).stage, 7, 'l\'étape 8 attend qu\'on les ait vues');
});

test('vues sur le clocher → étape 8 et chapitre 8 à l\'aube suivante, puis la roue ; les pois l\'aube d\'après ; une sauvegarde à l\'étape 8 sans cigognes vues est refusée', () => {
  const g = stage7Career();
  toStorkDay(g);
  const r = A(g).observeVisitor('whiteStork');
  assert.equal(r.title, 'Les cigognes sont revenues !');
  assert.equal(V(g).stage, 7, 'pas dans la même journée');
  assert.equal(V(g).stork.seenAt, absOf(g));
  const ev = record(g);
  nextDay(g);
  assert.equal(V(g).stage, 8);
  assert.equal(V(g).stork.wheelAt, absOf(g));
  assert.equal(ev.of('storkWheelPlaced').length, 1);
  assert.equal(Q(g).valley().chapters.find((c) => c.n === 8).title, 'Les cigognes');
  assert.equal(Q(g).valley().stage.max, 8);
  assert.equal(Q(g).valley().stage.next, null);
  assert.equal(Q(g).valleyScenery().nest.state, 'wheel');
  ev.clear();
  nextDay(g);
  assert.ok(ev.of('legendAwoken').some((e) => e.id === 'storkPea') || V(g).legends.storkPea, 'les pois du jour des cigognes');
  const s = JSON.parse(JSON.stringify(g.serialize()));
  assert.equal(checkValley(s), null);
  s.career.valley.stork.seenAt = null;
  assert.match(checkValley(s), /étape/);
});

test('le nid sur la maison : le jour des cigognes du printemps suivant (récit « Un nid sur la maison »), cigogneaux le 1ᵉʳ jour de l\'été, départ le dernier jour de l\'été, chaque année', () => {
  const g = stage8Career();
  const ev = record(g);
  toSeason(g, 2);
  toStorkDay(g);
  let arr = ev.of('storksArrived');
  assert.deepEqual(arr.map((e) => [e.where, e.first]), [['farm', true]]);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'storkNest'));
  assert.equal(V(g).stork.farmSince, absOf(g));
  assert.equal(Q(g).valley().stork.state, 'nest');
  assert.equal(Q(g).valleyScenery().nest.state, 'pair');
  const year = g.state.time.year;
  assert.deepEqual(V(g).stork.years[year], { arrived: absOf(g), chicks: 0, left: null });
  ev.clear();
  toSeasonDay(g, 1, 1);
  const chicks = 1 + (hashSeed(g.state.seed, `storkChicks${year}`) % 4);
  assert.deepEqual(ev.of('storkChicks').map((e) => e.n), [chicks]);
  assert.equal(V(g).stork.years[year].chicks, chicks);
  assert.equal(V(g).year.chicks, chicks);
  ev.clear();
  toSeasonDay(g, 1, g.state.career.seasonLength);
  const left = ev.of('storksLeft');
  assert.equal(left.length, 1);
  assert.equal(left[0].returnDay, storkDay(g.state));
  assert.match(left[0].text, /Elles reviendront le \dᵉ jour du printemps/);
  assert.equal(V(g).stork.years[year].left, absOf(g));
  ev.clear();
  toSeason(g, 2);
  toStorkDay(g);
  arr = ev.of('storksArrived');
  assert.deepEqual(arr.map((e) => [e.where, e.first]), [['farm', false]]);
  assert.equal(ev.of('storyAvailable').filter((e) => e.id === 'storkNest').length, 0);
  assert.equal(Object.keys(V(g).stork.years).length, 2);
  assert.equal(Q(g).valley().stork.years, 2);
});

test('vues en été (pas au printemps) : l\'étape 8 à l\'aube suivante, le nid au printemps qui suit', () => {
  const g = stage7Career();
  toStorkDay(g);
  toSeasonDay(g, 1, 3);
  A(g).observeVisitor('whiteStork');
  nextDay(g);
  assert.equal(V(g).stage, 8);
  assert.equal(V(g).stork.farmSince, null);
  toSeason(g, 0);
  toStorkDay(g);
  assert.ok(V(g).stork.farmSince);
});

test('vallée complète (6 lieux restaurés + nid) : Joseph attend sur la colline — jamais le matin du récit du nid ; épilogue en 3 pages ; générique ; banc', () => {
  const g = stage8Career();
  for (const pl of ['brook', 'combe', 'poppies', 'millpond', 'bocage', 'oldOrchard']) A(g).triggerValley('place', pl, pl === 'brook' ? 4 : 3);
  assert.equal(A(g).readEpilogue().reason, 'Pas encore : Joseph vous attendra sur la colline quand la vallée sera complète.');
  const ev = record(g);
  toSeason(g, 2);
  toStorkDay(g);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'storkNest'));
  assert.equal(ev.of('epilogueAvailable').length, 0, 'pas le même matin que le récit du nid');
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('epilogueAvailable').length, 1);
  assert.equal(V(g).epilogue.availableAt, absOf(g));
  assert.equal(Q(g).valley().complete, true);
  assert.deepEqual(Q(g).valley().epilogue, { available: true, read: false, credits: false });
  assert.equal(A(g).seeCredits().reason, 'Après l\'épilogue de Joseph.');
  const r = A(g).readStory('epilogue');
  assert.equal(r.ok, true);
  assert.equal(r.pages.length, 3);
  assert.equal(r.first, true);
  assert.equal(r.pages[0].lines[0], 'Monte. Je voulais la voir avec toi, une fois finie.');
  assert.equal(r.credits.title, `La vallée ${ofFarm(g.state.career.farmName)}`);
  assert.equal(r.credits.cards.length, 6);
  assert.equal(r.credits.total, '26 habitants · 36 variétés · 6 lieux · 4 légendes');
  assert.deepEqual(r.credits.end, ['Merci d\'avoir rendu sa vallée à la mère de Joseph.', 'La vallée continue.']);
  assert.equal(A(g).readEpilogue().first, false);
  const epi = Q(g).valley().stories.find((s) => s.id === 'epilogue');
  assert.deepEqual([epi.available, epi.read, epi.epilogue, epi.pages.length], [true, true, true, 3]);
  assert.equal(Q(g).valley().hint?.kind === 'epilogue', false);
  const c = A(g).seeCredits();
  assert.equal(c.ok, true);
  assert.equal(V(g).epilogue.creditsAt, absOf(g));
  // Le banc : une phrase de saison (4 par saison, hachage du jour).
  const line = benchLine(g.state);
  assert.equal(typeof line, 'string');
  assert.equal(Q(g).valleyBench().line, line);
  assert.ok(!line.includes('{day}'));
});

test('cartes des vallées voisines : après l\'épilogue, un sachet à la fois, la carte à la première aube de la saison suivante ; 8 cartes dans l\'ordre', () => {
  const g = stage8Career();
  assert.equal(A(g).sendPostcardSeeds().reason, 'Après l\'épilogue de Joseph.');
  A(g).triggerValley('epilogue');
  A(g).readEpilogue();
  const ev = record(g);
  const got = [];
  for (let k = 0; k < 8; k++) {
    const r = A(g).sendPostcardSeeds();
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.id, POSTCARDS[k].id);
    assert.equal(A(g).sendPostcardSeeds().reason, 'Un sachet est déjà en route.');
    const L = g.state.career.seasonLength;
    const firstOfNext = (Math.floor((absOf(g) - 1) / L) + 1) * L + 1;
    assert.equal(r.arrives, firstOfNext);
    ev.clear();
    while (absOf(g) < r.arrives) nextDay(g);
    assert.equal(g.state.time.dayOfSeason, 1);
    const a = ev.of('postcardArrived');
    assert.deepEqual(a.map((e) => e.id), [POSTCARDS[k].id]);
    got.push(a[0].id);
    assert.equal(Q(g).valley().postcards.got.at(-1).read, false, 'à lire (ligne « À faire » vl-postcard)');
    const card = A(g).readPostcard(POSTCARDS[k].id);
    assert.equal(card.card.text, POSTCARDS[k].text);
  }
  assert.deepEqual(got, POSTCARDS.map((c) => c.id));
  assert.equal(A(g).sendPostcardSeeds().reason, 'Toutes les vallées voisines ont reçu leurs graines.');
  assert.equal(A(g).readPostcard('nope').reason, 'Carte inconnue.');
  const p = Q(g).valley().postcards;
  assert.deepEqual([p.open, p.left, p.got.length, p.got.every((x) => x.read)], [true, 0, 8, true]);
  assert.equal(checkValley(g.serialize()), null);
});
