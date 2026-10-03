// La Vallée vivante (lot V3) — migrations et sauvegardes : une carrière du V2 reprise (champs du V3 ajoutés sans rien
// retirer, v = 3, flux valley3 créé, autres flux intacts, sauvegarde valide) ; une carrière déjà à l'étape 5 reçoit « Sur
// la colline » à la première aube ; { places: false } = le V1 + V2 exactement (empreinte d'une carrière de 18 ans).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadCareer } from '../src/core/career/career.js';
import { checkValley } from '../src/core/career/valley.js';
import { VALLEY_VERSION } from '../src/data/career/valley.js';
import { playCareer } from '../tools/simulate-career.js';
import { nextDay, record, startedCareer } from './valley-helpers.js';

const A = (g) => g.actions.career;
const V3_FIELDS = ['view', 'places', 'wilds', 'wildBought', 'river', 'mushrooms'];
const V3_YEAR = ['works', 'recovered', 'valleyInstalled', 'wilds', 'river', 'riverIncome', 'mushrooms'];
const V3_STATS = ['works', 'recovered', 'river', 'riverIncome', 'mushrooms', 'wilds', 'visits'];

/** Sauvegarde « du V2 » : sans les champs du V3, `v: 2`, sans flux valley3. */
function asV2(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  const v = s.career.valley;
  for (const k of V3_FIELDS) delete v[k];
  delete v.parts.places;
  for (const k of V3_YEAR) delete v.year[k];
  for (const k of V3_STATS) delete v.stats[k];
  v.v = 2;
  delete s.rng.valley3;
  return s;
}

test('carrière du V2 reprise : champs du V3 ajoutés sans rien retirer, v = 3, flux valley3 créé, autres flux intacts, sauvegarde valide', () => {
  const g = startedCareer({}, 4);
  A(g).triggerValley('fix', 'bouleDOr');
  A(g).triggerValley('install', 'robin');
  for (let i = 0; i < 3; i++) nextDay(g);
  const old = asV2(g.serialize());
  assert.equal(checkValley(old), null, 'une sauvegarde V2 reste valide');
  const h = loadCareer(old);
  const v = h.state.career.valley;
  assert.equal(v.v, VALLEY_VERSION);
  assert.deepEqual(v.parts, { seeds: true, wildlife: true, heritage: true, places: true });
  assert.deepEqual([v.view, v.places, v.wilds, v.wildBought, v.river, v.mushrooms], [{ open: false, openedAt: null, visits: 0 }, {}, {}, 0, { fishedDay: 0 }, []]);
  assert.ok(Number.isInteger(h.state.rng.valley3));
  for (const k of Object.keys(old.rng)) assert.equal(h.state.rng[k], old.rng[k], k);
  assert.equal(v.species.robin.state, 'installed');
  assert.ok(v.varieties.bouleDOr.fixedAt);
  assert.equal(checkValley(h.serialize()), null);
  // Une carrière du V1 (heritage: false) garde places: false.
  const g1 = startedCareer({ valley: { heritage: false } }, 3);
  const h1 = loadCareer(JSON.parse(JSON.stringify(g1.serialize())));
  assert.equal(h1.state.career.valley.parts.places, false);
  assert.equal(h1.state.rng.valley3, undefined);
});

test('ancienne carrière déjà à l\'étape 5 (et 16 terrains) : récit « Sur la colline » et vue à la première aube ; terres ouvertes du même coup', () => {
  const g = startedCareer({}, 6);
  g.state.money = 2000000;
  for (let k = 0; k < 16; k++) A(g).buyLot();
  A(g).triggerValley('stage', 5);
  const old = asV2(g.serialize());
  const h = loadCareer(old);
  const ev = record(h);
  nextDay(h);
  assert.ok(ev.of('valleyViewOpened').length === 1);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'hill'));
  assert.equal(h.query.career.valley().wilds.open, true);
  assert.equal(h.state.career.valley.stage, 5, 'l\'étape garde sa valeur');
  assert.equal(checkValley(h.serialize()), null);
});

test('sauvegarde : un état du V3 refusé s\'il est incohérent (étape de lieu, chantier, terre possédée, étape 7 sans le V3)', () => {
  const g = startedCareer({}, 6);
  g.state.money = 500000;
  A(g).triggerValley('view');
  A(g).triggerValley('place', 'brook', 2);
  const ok = g.serialize();
  assert.equal(checkValley(ok), null);
  const bad = (fn) => {
    const s = JSON.parse(JSON.stringify(ok));
    fn(s);
    return checkValley(s);
  };
  assert.match(bad((s) => { s.career.valley.places.brook.step = 9; }), /lieu brook/);
  assert.match(bad((s) => { s.career.valley.places.brook.works = { step: 5, startedAt: 2, readyAt: 1, cost: 0 }; }), /chantier brook/);
  assert.match(bad((s) => { s.career.valley.places.nope = { step: 0, steps: {}, works: null }; }), /lieu nope/);
  assert.match(bad((s) => { s.career.valley.wilds.lot3 = { kind: 'wood', col: 0, row: 1, at: 1 }; s.career.valley.wildBought = 0; }), /terres confiées|terre sauvage/);
  assert.match(bad((s) => { s.career.valley.mushrooms = [{ id: 'm1', kind: 'truffle', spot: 0, day: 1 }]; }), /champignon/);
  assert.match(bad((s) => { s.career.valley.stage = 7; }), /étape/);
  assert.match(bad((s) => { s.career.valley.parts.places = false; s.career.valley.stage = 6; }), /étape/);
});

test('{ places: false } : le V1 + V2 exactement — empreinte de l\'état d\'une carrière de 18 ans (tranquille, graine 1) identique à celle d\'avant le V3', () => {
  // Empreinte relevée avant le lot V3 (commit 533f993) avec le même robot, sans aide d'équipe ; les champs du V3 (inertes)
  // sont retirés avant le hachage.
  const c = playCareer({ seed: 1, strategy: 'casual', years: 18, valley: { places: false }, keepGame: true });
  const s = JSON.parse(JSON.stringify(c.game.state));
  const v = s.career.valley;
  for (const k of V3_FIELDS) delete v[k];
  delete v.v;
  delete v.parts;
  for (const k of ['works', 'recovered', 'valleyInstalled', 'wilds', 'river', 'riverIncome', 'mushrooms', 'visits']) {
    delete v.year[k];
    delete v.stats[k];
  }
  delete s.rng.valley3;
  assert.equal(c.game.state.money, 173047);
  assert.equal(createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 16), '25c523f9680fc98c');
});
