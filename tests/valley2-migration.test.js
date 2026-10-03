// La Vallée vivante (lot V2) — sauvegardes et migration : une carrière du V1 (`v: 1`) reprise sans perte (champs du V2
// ajoutés, flux valley2 créé, autres flux intacts), ancienne carrière riche au rang 6 (panneau, récit, 5 niveaux d'un coup),
// aller-retour, vérification (checkValley), { heritage: false } = le V1 exactement (empreinte de l'état sur 10 ans), le flux
// valley du V1 et tous les autres tirent les mêmes nombres avec ou sans le V2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { checkValley } from '../src/core/career/valley.js';
import { SPECIES, VALLEY_VERSION, VARIETIES } from '../src/data/career/valley.js';
import { SEED_LIBRARY } from '../src/data/career/heritage.js';
import { loadStaffHelper, playCareer } from '../tools/simulate-career.js';
import { nextDay, record, setRank, startedCareer } from './valley-helpers.js';

const A = (g) => g.actions.career;
const V2_FIELDS = ['library', 'site', 'troc', 'trocSeason', 'trocFairYear', 'swaps', 'crosses', 'stories'];
/** (V3) Champs du V3 (inertes sans la partie `places`) : retirés aussi. */
const V3_FIELDS = ['view', 'places', 'wilds', 'wildBought', 'river', 'mushrooms'];

/** Sauvegarde « du V1 » : sans les champs du V2, `v: 1`, sans flux valley2. */
function asV1(saved) {
  const s = JSON.parse(JSON.stringify(saved));
  const v = s.career.valley;
  for (const k of [...V2_FIELDS, ...V3_FIELDS]) delete v[k];
  delete v.parts.heritage;
  delete v.parts.places;
  for (const k of ['swaps', 'meets', 'crosses', 'heirloomCrops', 'works', 'recovered', 'valleyInstalled', 'wilds', 'river', 'riverIncome', 'mushrooms']) delete v.year[k];
  for (const k of ['swaps', 'meets', 'crosses', 'pairs', 'works', 'recovered', 'river', 'riverIncome', 'mushrooms', 'wilds', 'visits']) delete v.stats[k];
  v.v = 1;
  delete s.rng.valley2;
  return s;
}

test('carrière du V1 reprise : champs du V2 ajoutés sans rien retirer, v = 2, flux valley2 créé, autres flux intacts, sauvegarde valide', () => {
  const g = startedCareer({}, 3);
  A(g).triggerValley('fix', 'bouleDOr');
  A(g).triggerValley('install', 'robin');
  for (let i = 0; i < 3; i++) nextDay(g);
  const old = asV1(g.serialize());
  assert.equal(old.career.valley.v, 1);
  assert.equal(checkValley(old), null, 'une sauvegarde V1 reste valide');
  const h = loadCareer(old);
  const v = h.state.career.valley;
  assert.equal(v.v, VALLEY_VERSION);
  assert.deepEqual(v.parts, { seeds: true, wildlife: true, heritage: true, places: true });
  assert.deepEqual([v.library, v.troc, v.trocSeason, v.trocFairYear, v.swaps, v.crosses, v.stories], [null, null, -1, 0, {}, {}, { available: [], read: [] }]);
  assert.equal(v.site, false);
  assert.deepEqual(v.year.heirloomCrops, []);
  assert.equal(v.stats.swaps, 0);
  assert.ok(Number.isInteger(h.state.rng.valley2));
  for (const k of Object.keys(old.rng)) assert.equal(h.state.rng[k], old.rng[k], k);
  // Rien du V1 n'est perdu.
  assert.ok(v.varieties.bouleDOr.fixedAt);
  assert.equal(v.species.robin.state, 'installed');
  assert.deepEqual(v.seeds, old.career.valley.seeds);
  // Au rang 3 : le panneau et le récit à la première aube.
  const ev = record(h);
  nextDay(h);
  assert.equal(h.state.career.valley.site, true);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'heritage0'));
  // Aller-retour.
  const again = loadCareer(h.serialize());
  assert.deepEqual(again.state.career.valley, h.state.career.valley);
});

test('ancienne carrière riche (rang 6) : panneau et récit à la première aube, les 5 niveaux d\'un coup, un seul troc par saison, la foire au prochain hiver', () => {
  const g = startedCareer({}, 6);
  A(g).triggerValley('fix', 'bouleDOr');
  const old = asV1(g.serialize());
  const h = loadCareer(old);
  h.state.money = 500000;
  nextDay(h);
  assert.equal(h.state.career.valley.site, true);
  for (let n = 1; n <= SEED_LIBRARY.levels.length; n++) assert.equal(A(h).buildSeedLibrary().level, n);
  const ev = record(h);
  const L = h.state.career.seasonLength;
  for (let d = 0; d < 4 * L + 1; d++) nextDay(h);
  assert.ok(ev.of('trocOffered').length <= 1, 'une proposition à la fois (elle attend)');
});

test('aller-retour d\'un état du V2 complet (Grainothèque, troc en attente, trocs, croisements, récits, nichoir)', () => {
  const g = startedCareer({}, 6);
  A(g).triggerValley('library', 3);
  A(g).triggerValley('swap', 'lili');
  A(g).triggerValley('troc', 'fabre');
  A(g).triggerValley('meet', 'turnip', 1);
  A(g).triggerValley('cross', 'carrot');
  A(g).readStory('heritage1');
  assert.ok(A(g).placeNature('home.bat', 'batbox').ok);
  const s = g.serialize();
  assert.equal(checkValley(s), null);
  const h = loadCareer(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(h.state.career.valley, g.state.career.valley);
  assert.deepEqual(h.query.career.valley().crosses, g.query.career.valley().crosses);
});

test('vérification : champs du V2 abîmés refusés', () => {
  const g = startedCareer({}, 6);
  A(g).triggerValley('library', 2);
  A(g).triggerValley('swap', 'lili');
  A(g).triggerValley('cross', 'carrot');
  const base = g.serialize();
  const bad = (fn) => {
    const s = JSON.parse(JSON.stringify(base));
    fn(s.career.valley, s);
    return checkValley(s);
  };
  assert.equal(bad(() => {}), null);
  assert.match(bad((v) => (v.library = { level: 9, builtAt: 1, levelAt: 1 })), /grainothèque/);
  assert.match(bad((v) => (v.troc = { clientId: 'nope', since: 1, from: 'season' })), /troc/);
  assert.match(bad((v) => (v.troc = { clientId: 'lili', since: 1, from: 'season' })), /troc déjà fait/);
  assert.match(bad((v) => (v.swaps.lili.got = 'bouleDOr')), /troc lili/);
  assert.match(bad((v) => (v.crosses.apple = { meet: 1, foundAt: null })), /croisement apple/);
  assert.match(bad((v) => delete v.varieties.crossCarrot), /croisement carrot sans variété/);
  assert.match(bad((v) => (v.stories.read = ['heritage3'])), /récits/);
  assert.match(bad((v) => (v.year.heirloomCrops = ['nope'])), /cultures de l'année/);
  assert.match(bad((v, s) => {
    s.plots[0].cropId = 'turnip';
    s.plots[0].variety = 'crossCarrot';
  }), /variété d'une parcelle/);
  // Une parcelle d'une variété du V2 bien formée passe.
  assert.equal(bad((v, s) => {
    s.plots[0].cropId = 'carrot';
    s.plots[0].variety = 'crossCarrot';
  }), null);
  // Quatre trouvailles des haies : seulement avec le merle.
  const f = (n) => Array.from({ length: n }, (_, k) => ({ id: `h${k}`, kind: 'blackberry', spotId: 'start.hedgeL', day: 1 }));
  assert.match(bad((v) => (v.finds = f(4))), /cueillette/);
  assert.equal(bad((v) => {
    v.finds = f(4);
    v.species.blackbird = { state: 'installed', since: 1, spotId: 'start.hedgeL', at: 1 };
  }), null);
});

test('{ heritage: false } : le V1 exactement — empreinte de l\'état d\'une carrière de 10 ans (tranquille, graine 1) identique à celle d\'avant le V2', async () => {
  // Empreinte relevée avant le lot V2 (commit 86db5a2) avec le même robot (tools/simulate-career.js) ; les champs du V2
  // (inertes) sont retirés avant le hachage.
  const helper = await loadStaffHelper();
  const c = playCareer({ seed: 1, strategy: 'casual', years: 10, valley: { heritage: false }, keepGame: true, helper: helper || null });
  const st = asV1(c.game.serialize());
  const hash = createHash('sha1').update(JSON.stringify(st)).digest('hex');
  assert.deepEqual(c.years.map((y) => y.money), [2028, 6286, 18923, 12564, 7001, 12780, 24024, 16220, 24073, 23925]);
  assert.equal(hash, '21b7aeec8e622712ee4420483238ae7fc2858ef8');
});

test('flux : avec le V2, le flux valley du V1 et tous les autres tirent les mêmes nombres (rien ne se passe du V2 sans geste)', () => {
  const run = (heritage) => {
    const g = createCareer({ seed: 5, valley: { heritage } });
    g.state.money = 50000;
    setRank(g, 3);
    for (let d = 0; d < 60; d++) nextDay(g);
    return g.state;
  };
  const a = run(false);
  const b = run(true);
  for (const k of Object.keys(a.rng)) assert.equal(b.rng[k], a.rng[k], k);
  assert.ok(Number.isInteger(b.rng.valley2));
  assert.equal(a.rng.valley2, undefined);
  assert.equal(b.money, a.money);
  assert.deepEqual(b.career.valley.species, a.career.valley.species);
});

test('recalage des étapes (V2) : une carrière du V1 déjà à l\'étape 4 avec 17 à 21 signes la garde (jamais de recul), sauvegarde valide, prochaine étape à 38', () => {
  const g = startedCareer({ valley: { heritage: false } }, 4);
  for (const x of VARIETIES.slice(0, 11)) A(g).triggerValley('fix', x.id);
  for (const sp of SPECIES.slice(0, 7)) A(g).triggerValley('install', sp.id);
  nextDay(g);
  const signs = g.query.career.valley().stage.signs;
  assert.ok(signs >= 17 && signs < 22, `signes ${signs}`);
  assert.equal(g.state.career.valley.stage, 4);
  const old = asV1(g.serialize());
  assert.equal(checkValley(old), null);
  const h = loadCareer(old);
  const ev = record(h);
  assert.equal(checkValley(h.serialize()), null, 'valide avec les paliers du V2');
  for (let i = 0; i < 3; i++) nextDay(h);
  assert.equal(h.state.career.valley.stage, 4, 'l\'étape 4 reste acquise');
  assert.equal(ev.of('valleyStage').length, 0);
  assert.equal(h.query.career.valley().stage.next.signs, 38);
  const again = loadCareer(h.serialize());
  assert.equal(again.state.career.valley.stage, 4);
});
