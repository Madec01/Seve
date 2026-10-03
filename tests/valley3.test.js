// La Vallée vivante (lot V3) « Le ruisseau » — données, activation, ouverture de la vue (récit « Sur la colline »),
// étapes 6 et 7, signes de vie, flux `valley3` (aucun autre flux ne tire un nombre de plus), progression (album, succès,
// décors). Contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V3 » ; règles : docs/VALLEE.md § 17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_SPECIES, ALL_VARIETIES, MAX_STAGE, MAX_STAGE_ALL, SIGNS_ALL, SIGNS_ALL_V3, SPECIES, STAGES_ALL, STAGE_SIGNS_V3, VALLEY_PARTS, VALLEY_VERSION, VARIETIES, maxStageOf, stageSigns,
} from '../src/data/career/valley.js';
import {
  MUSHROOMS, MUSHROOM_RULES, ORCHARD_VARIETIES, PLACES, PLACES_COST_TOTAL, PLACES_HINTS, PLACE_MAX, PLACE_STEPS_TOTAL, RIVER_FISH, STAGES_V3, STORIES_V3, VALLEY_SPECIES,
  VALLEY_TREES, WILD_KINDS, WILD_RULES,
} from '../src/data/career/places.js';
import { CROPS, getCrop, isValleyTree } from '../src/data/crops.js';
import { ALBUM_PAGES } from '../src/data/album.js';
import { PLACES_ACHIEVEMENTS } from '../src/data/achievements.js';
import { getCosmetic } from '../src/data/cosmetics.js';
import { stageFor } from '../src/core/career/habitat.js';
import * as P from '../src/core/progression.js';
import { nextDay, record, setRank, startedCareer } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

/** Carrière V3 avec la vue ouverte (déboguée), au rang 6, riche. */
function openCareer(opts = {}) {
  const g = startedCareer(opts, 6);
  g.state.money = 500000;
  assert.equal(A(g).triggerValley('view').ok, true);
  return g;
}

test('données : 6 lieux (19 étapes, 160 000), 10 habitants de la vallée, poissons, champignons, Reinette, cerisier et poirier, terres, étapes 6 et 7, 8 récits', () => {
  assert.deepEqual(PLACES.map((p) => p.id), ['brook', 'combe', 'poppies', 'millpond', 'bocage', 'oldOrchard']);
  assert.equal(PLACE_STEPS_TOTAL, 19);
  assert.deepEqual(Object.values(PLACE_MAX), [4, 3, 3, 3, 3, 3]);
  assert.ok(PLACES_COST_TOTAL >= 130000 && PLACES_COST_TOTAL <= 190000, `total des chantiers ${PLACES_COST_TOTAL} dans les leviers du § 17.12.7`);
  for (const p of PLACES) {
    for (const st of p.steps) {
      assert.ok(st.line.length <= 110, `${p.id}.${st.n} : ligne de Joseph trop longue`);
      if (st.n === 0) continue;
      assert.ok(st.cost > 0 && [1, 2, 3, 4].includes(st.seasons) && st.needs.length && st.boon.text, `${p.id}.${st.n}`);
    }
  }
  assert.deepEqual(VALLEY_SPECIES.map((s) => s.id), ['kingfisher', 'crayfish', 'otter', 'heron', 'blackWoodpecker', 'roeDeer', 'salamander', 'skylark', 'hoopoe', 'littleOwl']);
  for (const s of VALLEY_SPECIES) assert.ok(s.welcome && s.opens && s.placeId && s.anecdote.length <= 110 && s.group === 'valley', s.id);
  assert.deepEqual(RIVER_FISH.map((f) => f.id), ['minnow', 'gudgeon', 'chub', 'browntrout', 'crayfish']);
  assert.deepEqual(RIVER_FISH.filter((f) => f.weight === 0).map((f) => f.id), ['browntrout', 'crayfish'], 'truites et écrevisses à l\'étape 3');
  assert.deepEqual(MUSHROOMS.map((m) => [m.id, m.coins]), [['cep', 6], ['chanterelle', 4], ['hedgehogMushroom', 3]]);
  assert.deepEqual([MUSHROOM_RULES.chance, MUSHROOM_RULES.max, MUSHROOM_RULES.spots], [0.5, 3, 5]);
  assert.equal(ORCHARD_VARIETIES[0].id, 'reinetteGrise');
  // Cerisier et poirier : hors de CROPS, trouvés par getCrop.
  assert.deepEqual(VALLEY_TREES.map((t) => t.id), ['cherry', 'pear']);
  assert.ok(!CROPS.some((c) => isValleyTree(c.id)));
  assert.equal(getCrop('cherry').kind, 'tree');
  assert.deepEqual(getCrop('cherry').fruitSeasons, ['spring', 'summer']);
  assert.equal(getCrop('pear').seedCost, 60);
  assert.deepEqual(WILD_KINDS.map((k) => k.id), ['wood', 'marsh', 'grassland']);
  assert.deepEqual([WILD_RULES.price.base, WILD_RULES.price.step, WILD_RULES.youngSeasons, WILD_RULES.grownSeasons, WILD_RULES.needLots, WILD_RULES.total], [2500, 300, 1, 3, 16, 18]);
  // Étapes 6 et 7 ; 99 signes de vie.
  assert.deepEqual(STAGES_V3.map((s) => [s.n, s.signs]), [[6, 56], [7, 76]]);
  assert.deepEqual(STAGE_SIGNS_V3, [0, 2, 6, 11, 22, 38, 56, 76]);
  assert.equal(STAGES_ALL.length, 8);
  assert.equal(MAX_STAGE, 5);
  assert.equal(MAX_STAGE_ALL, 7);
  assert.equal(SIGNS_ALL, 51, 'le V2 seul ne change pas');
  assert.equal(SIGNS_ALL_V3, 99);
  assert.equal(stageSigns(6, true, true), 56);
  assert.equal(stageSigns(6, true, false), 38, 'sans le V3 : étape 5 au plus');
  assert.equal(maxStageOf({ heritage: true, places: true }), 7);
  assert.equal(maxStageOf({ heritage: true, places: false }), 5);
  assert.deepEqual(STORIES_V3.map((s) => s.id), ['hill', 'helene', 'brook3', 'combe3', 'poppies3', 'millpond3', 'bocage3', 'oldOrchard3']);
  assert.ok(STORIES_V3.every((s) => s.lines.length === 3));
  for (const k of ['valley.view', 'valley.works', 'valley.valleyAnimal', 'valley.river', 'valley.wild']) assert.ok(PLACES_HINTS[k], k);
  // Tables du V1 et du V2 en tête, inchangées (ordre des tirages).
  assert.deepEqual(ALL_VARIETIES.slice(0, 12), VARIETIES);
  assert.equal(ALL_VARIETIES.at(-1).id, 'reinetteGrise');
  assert.deepEqual(ALL_SPECIES.slice(0, 12).map((s) => s.id), SPECIES.map((s) => s.id));
  assert.deepEqual(ALL_SPECIES.slice(16).map((s) => s.id), VALLEY_SPECIES.map((s) => s.id));
  assert.equal(VALLEY_VERSION, 3);
  assert.deepEqual(VALLEY_PARTS, ['seeds', 'wildlife', 'heritage', 'places']);
});

test('activation : partie places (absente = vraie) ; { places: false } = le V1 + V2 (aucun flux valley3, aucun champ du V3 dans les requêtes) ; { heritage: false } coupe aussi le V3', () => {
  const g = startedCareer({}, 3);
  assert.equal(g.state.career.valley.parts.places, true);
  assert.ok(Number.isInteger(g.state.rng.valley3));
  const q = Q(g).valley();
  assert.equal(q.places3, true);
  assert.deepEqual(q.view, { open: false, opensAtStage: 5, visits: 0, openedAt: null });
  assert.deepEqual(q.places, [], 'rien tant que la vue n\'est pas ouverte');
  assert.equal(q.stage.total, 99);
  assert.equal(q.species.length, 26);
  assert.equal(q.varieties.length, 36);
  assert.equal(A(g).openValleyView().reason, 'La vallée s\'ouvrira quand elle chantera (étape 5).');
  assert.equal(A(g).startWorks('brook').reason, 'La vallée s\'ouvrira quand elle chantera (étape 5).');
  assert.equal(Q(g).valleyView(), null);
  const off = startedCareer({ valley: { places: false } }, 3);
  assert.equal(off.state.career.valley.parts.places, false);
  assert.equal(off.state.rng.valley3, undefined);
  const qo = Q(off).valley();
  assert.equal(qo.places3, undefined);
  assert.equal(qo.stage.total, 51);
  assert.equal(qo.species.length, 16);
  assert.equal(qo.varieties.length, 35);
  assert.equal(A(off).openValleyView().reason, 'Vue de la vallée désactivée.');
  assert.equal(A(off).triggerValley('view').ok, false);
  const v1 = startedCareer({ valley: { heritage: false } }, 3);
  assert.deepEqual(v1.state.career.valley.parts, { seeds: true, wildlife: true, heritage: false, places: false });
  assert.equal(v1.state.rng.valley3, undefined);
});

test('ouverture : première aube à l\'étape 5 → valleyViewOpened puis le récit « Sur la colline » ; la vue compte ses visites', () => {
  const g = startedCareer({}, 6);
  A(g).triggerValley('stage', 5);
  assert.equal(g.state.career.valley.stage, 5);
  assert.equal(g.state.career.valley.view.open, false, 'l\'étape monte en fin d\'aube : la vue s\'ouvre à l\'aube suivante');
  const ev = record(g);
  nextDay(g);
  const types = ev.events.map((e) => e.type);
  assert.ok(types.indexOf('valleyViewOpened') >= 0 && types.indexOf('valleyViewOpened') < types.lastIndexOf('storyAvailable'));
  assert.deepEqual(ev.of('storyAvailable').map((e) => e.id), ['hill']);
  assert.equal(g.state.career.valley.view.openedAt > 0, true);
  const r = A(g).openValleyView();
  assert.deepEqual(r, { ok: true, first: true, story: 'hill' });
  assert.equal(A(g).readStory('hill').story.title, 'Sur la colline');
  assert.deepEqual(A(g).openValleyView(), { ok: true, first: false, story: null });
  assert.equal(g.state.career.valley.view.visits, 2);
  const view = Q(g).valleyView();
  assert.equal(view.open, true);
  assert.equal(view.places.length, 6);
  assert.equal(view.farmTier, 4);
  assert.equal(Q(g).valley().places.length, 6);
  // L'ouverture ne se refait jamais.
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('valleyViewOpened').length, 0);
});

test('étapes 6 et 7 : paliers 56 et 76 ET conditions de lieux (Ru des Saules ≥ 2 ; six lieux ≥ 2), jamais de recul, chapitres, écus', () => {
  assert.equal(stageFor(70, true, true, { ok6: false, ok7: false }), 5);
  assert.equal(stageFor(70, true, true, { ok6: true, ok7: true }), 6);
  assert.equal(stageFor(80, true, true, { ok6: true, ok7: false }), 6);
  assert.equal(stageFor(80, true, true, { ok6: true, ok7: true }), 7);
  assert.equal(stageFor(80, true, false), 5, 'sans le V3 : étape 5 au plus');
  const g = openCareer();
  const ev = record(g);
  A(g).triggerValley('stage', 7);
  assert.equal(g.state.career.valley.stage, 7);
  assert.deepEqual(ev.of('valleyStage').map((e) => e.n).slice(-2), [6, 7]);
  const s7 = ev.of('valleyStage').at(-1);
  assert.deepEqual(s7.reward, { ecus: 80, cosmeticId: 'valley.bench' });
  assert.equal(s7.chapter.lines.length, 3);
  assert.equal(A(g).readChapter(7).chapter.title, 'La vallée vivante');
  const q = Q(g).valley();
  assert.equal(q.stage.n, 7);
  assert.equal(q.stage.next, null);
  assert.equal(q.chapters.length, 8);
  assert.ok(q.stage.signs >= 76);
  // Sauvegarde valide et rechargée.
  const saved = g.serialize();
  const r = P.recordValleyStage(P.defaultProgress(), 7);
  assert.equal(r.rewards.cosmeticId, 'valley.bench');
  assert.equal(r.progress.career.valleyStage, 7);
  assert.ok(saved.career.valley.stage === 7);
});

test('l\'étape 6 attend le Ru des Saules à l\'étape 2 même avec assez de signes de vie ; « next.needs » le dit', () => {
  const g = openCareer();
  // 62 signes sans lieu : habitants et variétés (V1, V2, V3) d'un coup.
  for (const x of ALL_VARIETIES) A(g).triggerValley('fix', x.id);
  for (const s of ALL_SPECIES) A(g).triggerValley('install', s.id);
  nextDay(g);
  const q = Q(g).valley();
  assert.ok(q.stage.signs >= 56, `signes ${q.stage.signs}`);
  assert.equal(q.stage.n, 5);
  assert.equal(q.stage.next.n, 6);
  assert.equal(q.stage.next.needs, 'et le Ru des Saules à l\'étape 2');
  A(g).triggerValley('place', 'brook', 2);
  nextDay(g);
  assert.equal(g.state.career.valley.stage, 6);
});

test('flux : avec le V3 (vue ouverte, rien de lancé), tous les flux sauf valley3 tirent les mêmes nombres qu\'avec { places: false }', () => {
  const run = (places) => {
    const g = startedCareer({ valley: { places } }, 6);
    g.state.money = 50000;
    // Étape posée directement (le débogage « stage » sauve aussi la Reinette avec le V3 : signes différents).
    g.state.career.valley.stage = 5;
    for (let d = 0; d < 60; d++) nextDay(g);
    return g.state;
  };
  const a = run(false);
  const b = run(true);
  assert.equal(b.career.valley.view.open, true);
  for (const k of Object.keys(a.rng)) assert.equal(b.rng[k], a.rng[k], k);
  assert.ok(Number.isInteger(b.rng.valley3));
  assert.notEqual(b.rng.valley3, undefined);
  assert.equal(a.rng.valley3, undefined);
  assert.equal(b.money, a.money);
  assert.deepEqual(b.career.valley.species, a.career.valley.species);
});

test('progression : 2 pages d\'album (carnet d\'Hélène 10, lieux 6), 8 succès (210 écus), 3 décors trouvés ; contexte des succès', () => {
  const wild = ALBUM_PAGES.find((p) => p.id === 'valleyWild');
  const places = ALBUM_PAGES.find((p) => p.id === 'places');
  assert.equal(wild.cases.length, 10);
  assert.equal(places.cases.length, 6);
  assert.deepEqual([wild.reward.ecus, wild.reward.cosmeticId, places.reward.ecus, places.reward.cosmeticId], [30, 'heron.vane', 40, 'mill.wheel']);
  assert.equal(PLACES_ACHIEVEMENTS.length, 8);
  assert.equal(PLACES_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 210);
  assert.ok(PLACES_ACHIEVEMENTS.every((a) => a.category === 'career'));
  for (const id of ['heron.vane', 'valley.bench']) assert.equal(getCosmetic(id)?.category, 'small', id);
  assert.equal(getCosmetic('mill.wheel').category, 'large');
  const g = openCareer();
  A(g).triggerValley('install', 'jay');
  A(g).startWorks('combe');
  A(g).triggerValley('place', 'poppies', 3);
  A(g).triggerValley('install', 'kingfisher');
  const ctx = g.query.achievementContext();
  const cv = ctx.career.valley;
  assert.deepEqual(cv.restored, ['poppies']);
  assert.deepEqual(cv.valleyInstalled, ['kingfisher']);
  assert.equal(cv.places.poppies, 3);
  assert.equal(cv.works, 1);
  const p = P.defaultProgress();
  const ids = P.checkAchievements(p, ctx);
  assert.ok(ids.includes('firstWorks'));
  assert.ok(!ids.includes('sixPlaces') && !ids.includes('helenesBook'));
  const found = P.checkAlbum(p, ctx);
  assert.ok(found.cases.includes('places.poppies'));
  assert.ok(found.cases.includes('valleyWild.kingfisher'));
  assert.equal(P.careerAchievementList(p, ctx).length, 38);
});
