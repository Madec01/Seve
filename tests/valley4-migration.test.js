// La Vallée vivante (lot V4) — migrations et sauvegardes : une carrière du V3 reprise (champs du V4 ajoutés sans rien
// retirer, v = 4, flux valley4 créé, autres flux intacts, jours des étapes reconstruits) ; une ancienne carrière avancée
// (rien d'un coup) ; aller-retour ; vérification ; { storks: false } = le V3 exactement (empreinte de l'état d'une carrière
// de 24 ans) ; empreinte économique identique avec le V4 (l'argent de chaque jour).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadCareer } from '../src/core/career/career.js';
import { checkValley } from '../src/core/career/valley.js';
import { VALLEY_VERSION } from '../src/data/career/valley.js';
import { storkDay } from '../src/core/career/storks.js';
import { playCareer } from '../tools/simulate-career.js';
import { A, Q, V, nextDay, record, stage8Career, toSeason, toStorkDay, v4Career } from './valley4-helpers.js';

const V4_FIELDS = ['legends', 'cloches', 'marvel', 'visitors', 'stork', 'epilogue', 'postcards', 'stageAt', 'rainedAt'];
const V4_YEAR = ['legends', 'legendHarvests', 'visitorsSeen', 'chicks', 'postcards'];
const V4_STATS = ['legendHarvests', 'visitorsSeen', 'storkYears', 'postcards', 'credits', 'bookOpened'];

/** Retire d'un état (ou d'une sauvegarde) les champs du V4 : ce qui reste est l'état du V3. */
function stripV4(s, { version = true } = {}) {
  const v = s.career.valley;
  for (const k of V4_FIELDS) delete v[k];
  delete v.parts.storks;
  for (const k of V4_YEAR) delete v.year[k];
  for (const k of V4_STATS) delete v.stats[k];
  if (version) v.v = 3;
  delete s.rng.valley4;
  return s;
}

/** Sauvegarde « du V3 » d'une carrière (sans les champs du V4, `v: 3`, sans flux valley4). */
function asV3(saved) {
  return stripV4(JSON.parse(JSON.stringify(saved)));
}

test('carrière du V3 reprise : champs du V4 ajoutés sans rien retirer, v = 4, flux valley4 créé, autres flux intacts, sauvegarde valide', () => {
  const g = v4Career();
  A(g).triggerValley('stage', 6);
  for (let i = 0; i < 3; i++) nextDay(g);
  const old = asV3(g.serialize());
  assert.equal(checkValley(old), null, 'une sauvegarde V3 reste valide');
  const h = loadCareer(old);
  const v = V(h);
  assert.equal(v.v, VALLEY_VERSION);
  assert.equal(v.parts.storks, true);
  assert.deepEqual([v.cloches, v.marvel, v.visitors, v.epilogue, v.postcards, v.rainedAt], [{}, { gens: 0, lastYear: 0 }, {}, { availableAt: null, readAt: null, creditsAt: null }, { sent: null, got: [] }, null]);
  assert.deepEqual(v.stork, { steepleAt: null, seenAt: null, wheelAt: null, farmSince: null, years: {} });
  assert.ok(Number.isInteger(h.state.rng.valley4));
  for (const k of Object.keys(old.rng)) assert.equal(h.state.rng[k], old.rng[k], k);
  // Jours des étapes reconstruits (approchés) pour les étapes déjà atteintes.
  assert.deepEqual(Object.keys(v.stageAt).map(Number), [0, 1, 2, 3, 4, 5, 6]);
  for (const e of Object.values(v.stageAt)) assert.equal(e.approx, true);
  assert.equal(v.stage, 6, 'l\'étape garde sa valeur');
  assert.equal(checkValley(h.serialize()), null);
  // Une carrière sans le V3 garde storks: false (et aucun flux valley4).
  const g2 = v4Career({ valley: { places: false } });
  const h2 = loadCareer(asV3(g2.serialize()));
  assert.equal(V(h2).parts.storks, false);
  assert.equal(h2.state.rng.valley4, undefined);
});

test('ancienne carrière avancée (vallée complète, étape 7) : une légende par aube, cigognes au prochain jour des cigognes, épilogue seulement après le nid', () => {
  const g = v4Career();
  A(g).triggerValley('complete');
  // Une carrière du V3 : rien du V4 (légendes, cigognes, étape 8) ; on la ramène à l'étape 7.
  const s = asV3(g.serialize());
  s.career.valley.stage = 7;
  s.career.valley.chapters.read = s.career.valley.chapters.read.filter((n) => n <= 7);
  s.career.valley.stories.available = s.career.valley.stories.available.filter((id) => !['melon', 'mill', 'marvel', 'peas', 'storkNest', 'epilogue'].includes(id));
  s.career.valley.stories.read = s.career.valley.stories.read.filter((id) => s.career.valley.stories.available.includes(id));
  assert.equal(checkValley(s), null);
  const h = loadCareer(s);
  const ev = record(h);
  const legends = [];
  for (let k = 0; k < 4; k++) {
    ev.clear();
    nextDay(h);
    assert.ok(ev.of('legendAwoken').length <= 1);
    legends.push(...ev.of('legendAwoken').map((e) => e.id));
    assert.equal(ev.of('epilogueAvailable').length, 0);
  }
  assert.deepEqual(legends.slice(0, 2), ['motherMelon', 'millEinkorn']);
  assert.equal(V(h).stage, 7);
  toStorkDay(h);
  assert.equal(h.state.time.dayOfSeason, storkDay(h.state));
  assert.ok(V(h).stork.steepleAt, 'au prochain jour des cigognes');
  assert.equal(V(h).epilogue.availableAt, null, 'pas d\'épilogue avant le nid');
  A(h).observeVisitor('whiteStork');
  nextDay(h);
  toSeason(h, 2);
  toStorkDay(h);
  assert.ok(V(h).stork.farmSince);
  nextDay(h);
  nextDay(h);
  assert.ok(V(h).epilogue.availableAt, 'après le nid');
  assert.ok(Q(h).valleyBook().years.some((y) => y.approx), 'le livre reconstruit les années passées (« vers l\'an … »)');
});

test('aller-retour : sauvegarde → chargement → la même partie (état identique, même suite)', () => {
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  A(g).sowLegend('storkPea');
  A(g).triggerValley('visitor', 'crane');
  A(g).triggerValley('epilogue');
  A(g).readEpilogue();
  A(g).sendPostcardSeeds();
  const saved = JSON.parse(JSON.stringify(g.serialize()));
  assert.equal(checkValley(saved), null);
  const h = loadCareer(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(h.serialize())), saved);
  for (let k = 0; k < 10; k++) {
    nextDay(g);
    nextDay(h);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(h.serialize())), JSON.parse(JSON.stringify(g.serialize())));
});

test('sauvegarde : un état du V4 refusé s\'il est incohérent', () => {
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  A(g).sowLegend('storkPea');
  A(g).triggerValley('epilogue');
  A(g).readEpilogue();
  A(g).triggerValley('postcard');
  nextDay(g);
  const ok = g.serialize();
  assert.equal(checkValley(ok), null);
  const bad = (fn) => {
    const s = JSON.parse(JSON.stringify(ok));
    fn(s.career.valley, s);
    return checkValley(s);
  };
  assert.match(bad((v) => { v.legends.nope = { awokeAt: 1, harvests: 0, firstAt: null }; }), /légende nope/);
  assert.match(bad((v) => { v.cloches.farmMarvel = { sownAt: 1, readyAt: 3, ripe: false }; }), /cloche farmMarvel/);
  assert.match(bad((v) => { v.cloches.storkPea = { sownAt: 9, readyAt: 3, ripe: false }; }), /cloche storkPea/);
  assert.match(bad((v) => { v.marvel.gens = 4; }), /Merveille/);
  assert.match(bad((v) => { v.visitors.crane = { state: 'seen', since: 3, spotId: 'poppies' }; }), /visiteur crane/);
  assert.match(bad((v) => { v.visitors.crane = { state: 'flying', since: 3, spotId: 'poppies' }; }), /visiteur crane/);
  assert.match(bad((v) => { v.stork.seenAt = v.stork.steepleAt - 1; }), /cigognes vues/);
  assert.match(bad((v) => { v.stork.wheelAt = null; v.stork.farmSince = 5; }), /nid sans roue/);
  assert.match(bad((v) => { v.stork.years[3] = { arrived: 5, chicks: 5, left: null }; }), /cigognes de l'an/);
  assert.match(bad((v) => { v.epilogue.availableAt = null; }), /épilogue/);
  assert.match(bad((v) => { v.postcards.got = [{ id: 'combesHautes', at: 3, read: false }]; }), /ordre des cartes/);
  assert.match(bad((v) => { v.postcards.got.push({ ...v.postcards.got[0] }); }), /cartes reçues/);
  assert.match(bad((v) => { v.postcards.sent = { id: v.postcards.got[0].id, at: 3, arrives: 9 }; }), /carte en route/);
  assert.match(bad((v) => { v.stageAt[9] = { abs: 3 }; }), /jour d'une étape/);
  assert.match(bad((v) => { v.parts.storks = 'oui'; }), /parties/);
});

test('{ storks: false } : le V3 exactement — empreinte de l\'état d\'une carrière de 24 ans (tranquille, graine 1) identique à celle d\'avant le V4 ; avec le V4, l\'argent de chaque jour est le même', () => {
  // Empreinte relevée avant le lot V4 (commit d553c2b) avec le même robot, sans aide d'équipe ; les champs du V4 (inertes)
  // sont retirés avant le hachage.
  const off = playCareer({ seed: 1, strategy: 'casual', years: 24, valley: { storks: false }, keepGame: true, trackMoney: true });
  const s = stripV4(JSON.parse(JSON.stringify(off.game.state)));
  assert.equal(off.game.state.money, 111495);
  assert.equal(createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 16), '6e0228ab1167b33b');
  // Le V4 complet (robots compris) : décoratif, l'argent de chaque jour est identique.
  const on = playCareer({ seed: 1, strategy: 'casual', years: 24, valley: true, keepGame: true, trackMoney: true });
  assert.equal(on.moneyDays.length, off.moneyDays.length);
  assert.deepEqual(on.moneyDays, off.moneyDays);
  const v = V(on.game);
  assert.ok(v.stage >= 7 && Object.keys(v.legends).length >= 2, 'le V4 a bien joué');
  const { valley4: _r, ...rngOn } = on.game.state.rng;
  void _r;
  assert.deepEqual(rngOn, off.game.state.rng, 'aucun autre flux ne tire un nombre de plus');
});
