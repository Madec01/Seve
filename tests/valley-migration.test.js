// La Vallée vivante (lot V1) — sauvegardes : carrière d'avant la Vallée (lots 3 et 4, avec bocaux) reprise au rang 1 ou 3,
// aller-retour, valley: false gardé tel quel, vérification (checkValley), niveaux inchangés (parité).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { checkValley } from '../src/core/career/valley.js';
import { CAREER_VERSION } from '../src/data/career/career.js';
import { ALBUM_PAGES_BY_ID } from '../src/data/album.js';
import * as P from '../src/core/progression.js';
import { nextDay, record, setRank, emptyPlots, startedCareer } from './valley-helpers.js';

/** Sauvegarde « d'avant la Vallée » : sans state.career.valley ni son flux ni les champs de parcelle. */
function preValley(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  delete s.career.valley;
  delete s.rng.valley;
  for (const p of s.plots) for (const k of ['variety', 'lastVariety', 'fallow', 'rested']) delete p[k];
  return s;
}

function lot4Career(rank) {
  const g = createCareer({ seed: 11, valley: false });
  g.state.money = 20000;
  g.state.career.rank = rank;
  g.refreshLevel();
  for (let i = 0; i < 5; i++) nextDay(g);
  g.state.career.heirlooms.push({ cropId: 'wheat', lotId: 'lot3', year: 1, day: 3 }, { cropId: 'potato', lotId: 'home', year: 1, day: 4, from: 'merchant' });
  return g;
}

test('carrière d\'avant la Vallée au rang 3 (bocaux gardés) : la boîte à la première aube, les bocaux à ouvrir, autres flux inchangés', () => {
  const old = preValley(lot4Career(3).serialize());
  assert.equal(old.career.version, CAREER_VERSION);
  const g = loadCareer(old);
  const v = g.state.career.valley;
  assert.ok(v && v.started === null && v.jars.opened === 0);
  assert.ok(Number.isInteger(g.state.rng.valley));
  for (const k of Object.keys(old.rng)) assert.equal(g.state.rng[k], old.rng[k], k);
  assert.equal(g.state.career.version, CAREER_VERSION, 'version de carrière inchangée');
  const ev = record(g);
  nextDay(g);
  assert.equal(ev.of('valleyStarted').length, 1);
  assert.equal(g.query.career.valley().jars.pending, 2);
  assert.equal(g.actions.career.openJar().varietyId, 'rougeDeBordeaux');
  assert.equal(g.actions.career.openJar().varietyId, 'vitelotte');
  // Aller-retour.
  const back = loadCareer(g.serialize());
  assert.deepEqual(back.state.career.valley, g.state.career.valley);
  assert.equal(back.state.rng.valley, g.state.rng.valley);
});

test('carrière d\'avant la Vallée au rang 1 : rien jusqu\'au rang 2', () => {
  const g = loadCareer(preValley(lot4Career(1).serialize()));
  nextDay(g);
  assert.equal(g.state.career.valley.started, null);
  setRank(g, 2);
  nextDay(g);
  assert.ok(g.state.career.valley.started);
});

test('valley: false gardé tel quel à la reprise ; une Vallée d\'un V1 incomplète est complétée', () => {
  const off = createCareer({ seed: 2, valley: false });
  const back = loadCareer(off.serialize());
  assert.equal(back.state.career.valley, null);
  assert.equal('valley' in back.state.rng, false);
  const g = startedCareer();
  const s = g.serialize();
  delete s.career.valley.stats;
  delete s.career.valley.year.finds;
  const again = loadCareer(s);
  assert.equal(again.state.career.valley.stats.hand, 0);
  assert.equal(again.state.career.valley.year.finds, 0);
});

test('aller-retour en cours de partie : planches d\'essai, jachère, sol reposé, aménagements, habitants, plan « heirloom »', () => {
  const g = startedCareer();
  const [i, j] = emptyPlots(g);
  g.actions.career.sowHeirloom(i, 'bouleDOr');
  g.actions.career.sowFallow(j);
  g.actions.career.placeNature('yard.pile');
  g.actions.career.triggerValley('fix', 'coeurDeBoeuf');
  g.actions.career.setPlan('start', 'summer', 'heirloom:coeurDeBoeuf');
  g.actions.career.triggerValley('visible', 'robin');
  const back = loadCareer(g.serialize());
  assert.deepEqual(back.serialize(), g.serialize());
  assert.equal(back.query.plot(i).variety.id, 'bouleDOr');
  assert.ok(back.query.plot(j).fallow);
});

test('vérification : formes et cohérence (checkValley)', () => {
  const g = startedCareer();
  const fresh = () => JSON.parse(JSON.stringify(g.serialize()));
  assert.equal(checkValley(fresh()), null);
  const bad = (fn) => {
    const s = fresh();
    fn(s);
    return checkValley(s);
  };
  assert.match(bad((s) => (s.career.valley.stage = 3)), /étape/);
  assert.match(bad((s) => (s.career.valley.seeds.nope = 1)), /graines/);
  assert.match(bad((s) => (s.career.valley.nature['start.nest'] = { kind: 'nestbox', at: 1 })), /emplacement/);
  assert.match(bad((s) => (s.career.valley.nature['yard.pile'] = { kind: 'hedge', at: 1 })), /emplacement/);
  assert.match(bad((s) => (s.career.valley.species.robin = { state: 'gone', since: 1, spotId: null })), /habitant/);
  assert.match(bad((s) => (s.career.valley.jars.opened = 5)), /bocaux/);
  assert.match(bad((s) => (s.career.valley.finds = [1, 2, 3, 4])), /cueillette/);
  assert.match(bad((s) => (s.plots[0].variety = 'jauneDuDoubs')), /variété/);
  assert.match(bad((s) => {
    s.plots[0].cropId = 'carrot';
    s.plots[0].fallow = 0;
  }), /jachère/);
  assert.match(bad((s) => {
    s.career.valley = null;
    s.plots[0].rested = true;
  }), /sans Vallée/);
  // Une sauvegarde abîmée est refusée au chargement.
  const s = fresh();
  s.career.valley.stage = 9;
  assert.throws(() => loadCareer(s), /Vallée/);
});

test('niveaux : rien de la Vallée (ni état, ni flux, ni ligne) ; seules les 2 pages d\'album se voient (« À découvrir dans Ma ferme »)', () => {
  for (const difficulty of ['detente', 'classique']) {
    const g = createGame({ levelId: 3, seed: 4, difficulty });
    assert.equal(g.state.career, undefined);
    assert.equal('valley' in g.state.rng, false);
    assert.equal(g.valley, false);
    const rows = g.query.plantableCrops(0);
    assert.equal(rows.heirlooms, undefined);
    assert.equal(g.query.plot(0).variety, undefined);
    for (let k = 0; k < 3; k++) nextDay(g);
    assert.equal('valley' in g.state.rng, false);
  }
  const pages = P.albumPages(P.defaultProgress(), 'classique');
  for (const id of ['heirlooms', 'wildlife']) {
    const page = pages.find((x) => x.id === id);
    assert.equal(page.total, ALBUM_PAGES_BY_ID[id].cases.length);
    assert.ok(page.cases.every((c) => c.modeNote === 'À découvrir dans Ma ferme'));
  }
});
