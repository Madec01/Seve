// Lot 4 — C8 : l'hiver vivant (trouvailles en lisière, traces dans la neige, mangeoire et oiseaux, veillées de Joseph).
// Règles : docs/GAME_DESIGN.md § 17.5 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { BIRDS, WINTER_FINDS_BY_ID, WINTER_RULES } from '../src/data/cozy.js';
import { stream } from '../src/core/rng.js';
import { nextDay, record } from './helpers.js';

function detente(levelId = 2, seed = 4, opts = {}) {
  const g = createGame({ levelId, seed, difficulty: 'detente', ...opts });
  g.state.weather.today = 'sunny';
  return g;
}

function goTo(g, day, weather = 'sunny') {
  while (g.state.time.day < day && g.state.status === 'playing') nextDay(g, weather);
}

test('trouvailles d\'hiver : une par aube d\'hiver, 3 au plus, elles restent ; ramasser donne les pièces de la table', () => {
  const g = detente(2, 4);
  const ev = record(g);
  goTo(g, 21);
  assert.equal(g.query.winter().finds.length, 0, 'pas avant l\'hiver');
  assert.equal(g.query.winter().feeder.here, false);
  goTo(g, 22);
  let w = g.query.winter();
  assert.equal(w.finds.length, 1);
  assert.equal(w.feeder.here, true);
  assert.equal(ev.of('winterFind').length, 1);
  goTo(g, 25);
  w = g.query.winter();
  assert.equal(w.finds.length, WINTER_RULES.maxFinds, '3 au plus à la fois');
  const f = w.finds[0];
  const money = g.state.money;
  const r = g.actions.pickWinterFind(f.id);
  assert.equal(r.ok, true);
  assert.equal(r.amount, WINTER_FINDS_BY_ID[f.kind].coins);
  assert.equal(g.state.money, money + r.amount);
  assert.equal(g.actions.pickWinterFind(f.id).reason, 'Rien à ramasser ici.');
  assert.equal(g.state.cozy.stats.finds[f.kind], 1);
  assert.equal(g.state.cozy.year.finds, 1);
  assert.ok(g.state.stats.year.cozyIncome >= r.amount);
});

test('hiver : 5 tirages du flux cozy à CHAQUE aube d\'hiver (de la place ou non) ; un oiseau : 1 tirage de plus', () => {
  const g = detente(2, 4);
  goTo(g, 25);
  const seen = [];
  for (let d = 0; d < 2; d++) {
    const before = g.state.rng.cozy;
    const copy = { cozy: before };
    const r = stream(copy, 'cozy');
    for (let k = 0; k < 5; k++) r.float();
    nextDay(g);
    seen.push([copy.cozy, g.state.rng.cozy]);
  }
  for (const [want, got] of seen) assert.equal(got, want);
  // Mangeoire remplie : l'aube suivante tire un oiseau (6 nombres en tout).
  assert.ok(g.actions.fillFeeder().ok);
  const copy = { cozy: g.state.rng.cozy };
  const r = stream(copy, 'cozy');
  for (let k = 0; k < 6; k++) r.float();
  nextDay(g);
  assert.equal(g.state.rng.cozy, copy.cozy);
  assert.ok(g.query.winter().feeder.bird);
});

test('traces dans la neige : un jour de neige (40 %), visibles le jour même, case d\'album ; pas les autres jours', () => {
  let found = null;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const g = detente(2, seed);
    goTo(g, 21);
    for (let d = 0; d < 6 && !found; d++) {
      nextDay(g, 'snow');
      const w = g.query.winter();
      if (w.traces.length) found = { g, w };
    }
  }
  assert.ok(found, 'une trace dans les 30 premières graines');
  const { g, w } = found;
  assert.ok(['hareTrack', 'deerTrack', 'foxTrack'].includes(w.traces[0].kind));
  assert.ok(g.state.cozy.stats.traces[w.traces[0].kind] >= 1);
  nextDay(g, 'sunny');
  assert.equal(g.query.winter().traces.length, 0, 'la trace s\'efface le lendemain');
});

test('mangeoire : une fois par jour en hiver ; l\'oiseau vient le lendemain d\'un remplissage (rares : après 3 / 5 remplissages)', () => {
  const g = detente(2, 4);
  assert.equal(g.actions.fillFeeder().reason, 'La mangeoire sort en hiver.');
  goTo(g, 22);
  const ev = record(g);
  assert.ok(g.actions.fillFeeder().ok);
  assert.equal(g.actions.fillFeeder().reason, 'Déjà remplie aujourd\'hui.');
  assert.equal(g.query.winter().feeder.filledToday, true);
  assert.equal(g.query.winter().feeder.bird, null);
  nextDay(g);
  const bird = ev.of('feederBird')[0];
  assert.ok(bird && bird.bird.id);
  assert.equal(bird.first, true);
  assert.ok(!['bullfinch', 'woodpecker'].includes(bird.bird.id), 'les oiseaux rares attendent plusieurs remplissages');
  assert.equal(g.query.winter().feeder.bird.id, bird.bird.id);
  assert.equal(g.state.cozy.year.feederDays, 1);
  nextDay(g); // pas rempli hier : pas d'oiseau
  assert.equal(g.query.winter().feeder.bird, null);
  assert.equal(BIRDS.find((b) => b.id === 'woodpecker').minFills, 5);
});

test('veillée de Joseph : à partir du 3ᵉ jour d\'hiver, quand on veut, une fois par hiver', () => {
  const g = detente(2, 4);
  goTo(g, 22);
  assert.equal(g.actions.hearStory().reason, 'Pas de veillée en ce moment.');
  const ev = record(g);
  goTo(g, 24);
  assert.equal(ev.of('storyReady').length, 1);
  assert.equal(g.query.winter().story.available, true);
  goTo(g, 26);
  assert.ok(g.actions.hearStory().ok, 'Joseph attend tout l\'hiver');
  assert.equal(g.actions.hearStory().reason, 'Déjà écoutée cet hiver.');
  assert.equal(ev.of('storyHeard').length, 1);
  assert.equal(g.query.winter().story.heard, true);
});

test('niveau 5 (hiver de 14 jours) : trouvailles jusqu\'au bout (3 à la fois), une seule veillée', () => {
  const g = detente(5, 4);
  g.state.money = 100000;
  goTo(g, 21);
  const ev = record(g);
  while (g.state.status === 'playing' && g.state.time.day < 35) {
    for (const f of g.query.winter().finds) g.actions.pickWinterFind(f.id);
    nextDay(g);
  }
  assert.ok(ev.of('winterFind').length >= 13);
  assert.equal(ev.of('storyReady').length, 1);
});

test('hiver désactivé (cozy: { winter: false }) : ni trouvaille, ni mangeoire, ni veillée ; les fêtes restent', () => {
  const g = detente(2, 4, { cozy: { winter: false } });
  const ev = record(g);
  goTo(g, 26);
  assert.equal(g.query.winter(), null);
  assert.equal(ev.of('winterFind').length, 0);
  assert.equal(ev.of('feteStarted').length, 4);
  assert.equal(g.actions.fillFeeder().reason, 'La mangeoire sort en hiver.');
});
