// La Vallée vivante (lot V4 « Les cigognes ») — données, parties, flux valley4 (5 nombres par aube, aucun autre flux
// touché), décoratif strict (aucune pièce gagnée ni dépensée), { storks: false } = le V3, faits sonores, décor de la
// ferme, extras de la vue, prochain indice, album, succès, décors. docs/VALLEE.md § 18 ; contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V4 ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BENCH_LINES, DRAWN_VISITORS, EPILOGUE, FOREST_STATES, HELENE_NOTES, LEGENDS, LEGEND_RULES, POSTCARDS, STAGE_V4, STORIES_V4, STORK_RULES, VISITORS, VISITOR_RULES,
} from '../src/data/career/storks.js';
import {
  MAX_STAGE_ALL, MAX_STAGE_V3, STAGES_ALL, STAGE_SIGNS_V3, VALLEY_PARTS, VALLEY_VERSION, maxStageOf, stageSigns,
} from '../src/data/career/valley.js';
import { ALBUM_CASES, ALBUM_PAGES } from '../src/data/album.js';
import { STORKS_ACHIEVEMENTS } from '../src/data/achievements.js';
import { getCosmetic } from '../src/data/cosmetics.js';
import { normalizeValleyParts } from '../src/core/career/valley.js';
import { forestState, sceneryOf, storksOn } from '../src/core/career/storks.js';
import { hashSeed, stream } from '../src/core/rng.js';
import { DAY_SECONDS } from '../src/data/balance.js';
import * as P from '../src/core/progression.js';
import { A, Q, V, absOf, nextDay, record, stage7Career, stage8Career, toSeason, toSeasonDay, toStorkDay, v4Career } from './valley4-helpers.js';

test('données : 4 légendes, 6 visiteurs (5 tirés, ordre fixe), étape 8 sans palier, 5 récits, épilogue en 3 pages, 8 cartes, banc, Hélène', () => {
  assert.deepEqual(LEGENDS.map((x) => x.id), ['motherMelon', 'millEinkorn', 'farmMarvel', 'storkPea']);
  assert.deepEqual(LEGENDS.map((x) => [x.cropId, x.growDays]), [['melon', 6], ['wheat', 4], ['tomato', 5], ['pea', 3]]);
  assert.deepEqual(VISITORS.map((x) => x.id), ['whiteStork', 'crane', 'redDeer', 'oriole', 'beaver', 'glowworms']);
  assert.deepEqual(DRAWN_VISITORS.map((x) => x.id), ['crane', 'redDeer', 'oriole', 'beaver', 'glowworms']);
  assert.deepEqual(VISITOR_RULES, { hintChance: 0.06, visibleChance: 0.5, maxWait: 3 });
  assert.deepEqual([STORK_RULES.dayMin, STORK_RULES.dayMax, STORK_RULES.chicksMin, STORK_RULES.chicksMax], [2, 4, 1, 4]);
  assert.equal(LEGEND_RULES.marvel.gens, 3);
  for (const x of [...LEGENDS, ...VISITORS]) assert.ok(x.anecdote.length <= 110, `${x.id} : anecdote ≤ 110`);
  assert.deepEqual(STORIES_V4.map((s) => s.id), ['melon', 'mill', 'marvel', 'peas', 'storkNest']);
  for (const s of STORIES_V4) assert.equal(s.lines.length, 3);
  assert.equal(EPILOGUE.pages.length, 3);
  for (const p of EPILOGUE.pages) assert.equal(p.lines.length, 3);
  assert.equal(POSTCARDS.length, 8);
  assert.equal(POSTCARDS.at(-1).valley, 'La vallée d\'à côté');
  for (const k of ['spring', 'summer', 'autumn', 'winter']) assert.equal(BENCH_LINES[k].length, 4);
  assert.equal(HELENE_NOTES.length, 12);
  for (const h of HELENE_NOTES) assert.ok(h.length <= 90, h);
  assert.deepEqual(FOREST_STATES.map((f) => f.deciduous), [0, 0.2, 0.4, 0.6]);
  assert.equal(STAGE_V4.n, 8);
  assert.equal(STAGE_V4.signs, null);
  assert.deepEqual(STAGE_V4.reward, { ecus: 100 });
  // Le module de données n'importe rien.
  assert.ok(!/^\s*import\s/m.test(readFileSync(new URL('../src/data/career/storks.js', import.meta.url), 'utf8')));
});

test('étapes et parties : VALLEY_VERSION 4, partie storks, 9 étapes, étape 8 sans palier, paliers du V3 inchangés', () => {
  assert.equal(VALLEY_VERSION, 4);
  assert.deepEqual(VALLEY_PARTS, ['seeds', 'wildlife', 'heritage', 'places', 'storks']);
  assert.equal(STAGES_ALL.length, 9);
  assert.equal(MAX_STAGE_ALL, 8);
  assert.equal(MAX_STAGE_V3, 7);
  assert.deepEqual(STAGE_SIGNS_V3, [0, 2, 6, 11, 22, 38, 56, 76]);
  assert.equal(stageSigns(8, true, true), null);
  assert.equal(stageSigns(7, true, true), 76);
  assert.equal(maxStageOf({ heritage: true, places: true }), 8);
  assert.equal(maxStageOf({ heritage: true, places: true, storks: false }), 7);
  assert.equal(maxStageOf({ heritage: true, places: false }), 5);
  assert.equal(normalizeValleyParts({ places: false }).storks, false);
  assert.equal(normalizeValleyParts({ heritage: false }).storks, false);
  assert.equal(normalizeValleyParts(true).storks, true);
  const g = v4Career();
  assert.equal(storksOn(g.state), true);
  assert.ok(Number.isInteger(g.state.rng.valley4));
  const h = v4Career({ valley: { storks: false } });
  assert.equal(storksOn(h.state), false);
  assert.equal(h.state.rng.valley4, undefined);
  assert.equal(V(h).parts.storks, false);
});

test('flux valley4 : aucun nombre avant la vue ; puis exactement 5 nombres à chaque aube ; aucun autre flux ne tire un nombre de plus', () => {
  const a = v4Career();
  const b = v4Career({ valley: { storks: false } });
  const start = a.state.rng.valley4;
  nextDay(a);
  nextDay(b);
  assert.equal(a.state.rng.valley4, start, 'vue fermée : aucun tirage');
  for (const g of [a, b]) A(g).triggerValley('stage', 7);
  assert.equal(V(a).view.open, true);
  const r = { valley4: start };
  for (let day = 0; day < 40; day++) {
    nextDay(a);
    nextDay(b);
    for (let k = 0; k < 5; k++) stream(r, 'valley4').float();
    assert.equal(a.state.rng.valley4, r.valley4, `aube ${day + 1} : 5 nombres`);
  }
  const { valley4: _x, ...restA } = a.state.rng;
  void _x;
  assert.deepEqual(restA, b.state.rng, 'les autres flux : exactement les mêmes nombres');
  assert.equal(a.state.money, b.state.money);
  assert.equal(start, hashSeed(a.state.seed, 'valley4'));
});

test('décoratif strict : semer, récolter, voir, lire l\'épilogue, envoyer une carte, ouvrir le livre ne changent jamais l\'argent', () => {
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  nextDay(g);
  const money = g.state.money;
  const spent = V(g).spent;
  const patrimony = g.query.career.summary().patrimony;
  const ok = (r) => assert.equal(r.ok, true, r.reason);
  ok(A(g).sowLegend('storkPea'));
  A(g).triggerValley('legendRipe', 'storkPea');
  ok(A(g).harvestLegend('storkPea'));
  A(g).triggerValley('visitor', 'crane');
  ok(A(g).observeVisitor('crane'));
  A(g).triggerValley('epilogue');
  ok(A(g).readEpilogue());
  ok(A(g).seeCredits());
  ok(A(g).sendPostcardSeeds());
  ok(A(g).openValleyBook());
  assert.equal(g.state.money, money);
  assert.equal(V(g).spent, spent);
  assert.equal(g.query.career.summary().patrimony, patrimony);
});

test('{ storks: false } : le V3 (étape 7 au plus, aucune action ni requête du V4, aucun champ lu)', () => {
  const g = v4Career({ valley: { storks: false } });
  assert.deepEqual(A(g).triggerValley('stage', 8), { ok: true, stage: 7 });
  const q = Q(g).valley();
  assert.equal(q.storks4, undefined);
  assert.equal(q.legends, undefined);
  assert.equal(q.stage.max, 7);
  assert.equal(q.stage.next, null);
  assert.equal(q.chapters.length, 8);
  for (const r of [A(g).sowLegend('motherMelon'), A(g).observeVisitor('crane'), A(g).readEpilogue(), A(g).sendPostcardSeeds(), A(g).openValleyBook()]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'Les cigognes sont désactivées.');
  }
  assert.equal(Q(g).valleyScenery(), null);
  assert.equal(Q(g).valleySounds(), null);
  assert.equal(Q(g).valleyBook(), null);
  assert.equal(Q(g).valleyView().visitors, undefined);
  for (let k = 0; k < 40; k++) nextDay(g);
  assert.deepEqual(V(g).visitors, {});
  assert.equal(V(g).stork.steepleAt, null);
  assert.deepEqual(V(g).stageAt, {});
});

test('faits sonores (forme figée pour AUDIO) : clés, étape, habitants installés, visiteurs vus, lieux, ferme, passage', () => {
  const g = stage8Career();
  const f = Q(g).valleySounds();
  assert.deepEqual(Object.keys(f), ['on', 'stage', 'installed', 'seen', 'places', 'farm', 'flyover', 'complete']);
  assert.deepEqual(Object.keys(f.farm), ['pond', 'frogs', 'wildGrass', 'fallows', 'strips', 'hives', 'nest']);
  assert.deepEqual(Object.keys(f.places), ['brook', 'combe', 'poppies', 'millpond', 'bocage', 'oldOrchard']);
  assert.equal(f.on, true);
  assert.equal(f.stage, 8);
  assert.ok(f.installed.includes('robin'));
  assert.deepEqual(f.seen, ['whiteStork']);
  assert.equal(f.complete, false);
  assert.ok([null, 'storks', 'cranes'].includes(f.flyover));
  // Avant le début de la Vallée : null.
  const h = v4Career();
  h.state.career.valley.started = null;
  assert.equal(Q(h).valleySounds(), null);
});

test('forêt de la carte en 4 états ; nid (roue, couple, petits, neige) ; décor du jour recalculé seulement quand il change', () => {
  const g = v4Career();
  assert.equal(forestState(g.state), 0);
  A(g).triggerValley('stage', 5);
  assert.equal(forestState(g.state), 1);
  A(g).triggerValley('stage', 7);
  assert.equal(forestState(g.state), 2);
  assert.equal(Q(g).valleyScenery().nest, null);
  A(g).triggerValley('complete');
  assert.equal(forestState(g.state), 3);
  const s1 = Q(g).valleyScenery();
  assert.equal(s1.forestState, 3);
  assert.equal(sceneryOf(g.state), sceneryOf(g.state), 'même jour, même objet (cache)');
  assert.ok(['pair', 'chicks'].includes(s1.nest.state) || g.state.time.seasonIndex >= 2);
  toSeasonDay(g, 1, 1);
  assert.equal(Q(g).valleyScenery().nest.state, 'chicks');
  assert.ok(Q(g).valleyScenery().nest.chicks >= 1);
  toSeason(g, 3);
  assert.equal(Q(g).valleyScenery().nest.state, 'snow');
  toSeason(g, 2);
  assert.equal(Q(g).valleyScenery().nest.state, 'wheel');
});

test('arc-en-ciel : seulement le matin qui suit une pluie, une fois sur trois (hachage du jour)', () => {
  const g = stage7Career();
  let seen = 0;
  for (let k = 0; k < 60; k++) {
    nextDay(g, k % 2 ? 'rain' : 'sunny');
    const sc = Q(g).valleyScenery();
    const abs = absOf(g);
    const expect = g.state.weather.today === 'sunny' && V(g).rainedAt === abs - 1 && hashSeed(abs, 'rainbow') % 3 === 0;
    assert.equal(sc.rainbow, expect, `jour ${abs}`);
    if (sc.rainbow) seen++;
  }
  assert.ok(seen > 0);
});

test('vue de la vallée : visiteurs (halte, en décor), clocher, barrage, fenêtres du soir, banc habité après l\'épilogue', () => {
  const g = stage7Career();
  toStorkDay(g);
  for (const id of V(g).stories.available) A(g).readStory(id);
  let view = Q(g).valleyView();
  assert.deepEqual(view.steeple, { storks: 2, visible: true, waiting: true });
  assert.ok(view.visitors.some((x) => x.id === 'whiteStork' && x.state === 'visible' && x.anchor === 'steeple'));
  assert.equal(view.bench.joseph, false);
  A(g).triggerValley('visitor', 'beaver', 'seen');
  view = Q(g).valleyView();
  assert.equal(view.beaverDam, true);
  g.state.time.elapsed = DAY_SECONDS * 0.8;
  assert.equal(Q(g).valleyView().villageLights, true);
  g.state.time.elapsed = 0;
  assert.equal(Q(g).valleyView().villageLights, false);
  A(g).triggerValley('epilogue');
  assert.equal(Q(g).valleyView().bench.joseph, 'epilogue');
  A(g).readEpilogue();
  view = Q(g).valleyView();
  assert.equal(view.bench.joseph, 'resident');
  assert.equal(view.bench.helene, true);
  assert.equal(typeof view.bench.line, 'string');
  assert.equal(view.canContemplate, true);
  // Le champ `joseph` du V3 garde son sens (récits et chapitres du V3 seulement).
  assert.equal(typeof view.joseph, 'boolean');
});

test('prochain indice : visiteur avant les récits ; épilogue ; légende mûre ; légende à semer (une fois) ; étape 8 : ce qui manque aux cigognes', () => {
  const g = stage7Career();
  for (const n of [0, 1, 2, 3, 4, 5, 6, 7]) A(g).readChapter(n);
  for (const id of V(g).stories.available) A(g).readStory(id);
  // Étape 8 : aucun palier, la condition est le retour des cigognes (texte de l'étape suivante et de l'indice 'storkNeed').
  const next = Q(g).valley().stage.next;
  assert.deepEqual([next.n, next.signs], [8, null]);
  assert.match(next.needs, /Les cigognes reviennent le \d+ᵉ jour du printemps/);
  toStorkDay(g);
  let h = Q(g).valley().hint;
  assert.equal(h.kind, 'visitor');
  assert.deepEqual(h.target, { type: 'visitor', id: 'whiteStork', where: 'view' });
  A(g).observeVisitor('whiteStork');
  nextDay(g);
  A(g).readChapter(8);
  for (const id of V(g).stories.available) A(g).readStory(id);
  A(g).triggerValley('library', 1);
  A(g).triggerValley('legend', 'storkPea');
  for (const id of V(g).stories.available) A(g).readStory(id);
  h = Q(g).valley().hint;
  assert.ok(['legendSow'].includes(h.kind), JSON.stringify(h));
  assert.equal(h.target.type, 'seedLibrary');
  A(g).sowLegend(h.target.legendId);
  A(g).triggerValley('legendRipe', h.target.legendId);
  h = Q(g).valley().hint;
  assert.equal(h.kind, 'legendRipe');
  const done = h.target.legendId;
  A(g).harvestLegend(done);
  const after = Q(g).valley().hint;
  assert.ok(!(after?.kind === 'legendSow' && after.target.legendId === done), 'semer : une seule fois (jamais « ressemez »)');
  A(g).triggerValley('epilogue');
  assert.equal(Q(g).valley().hint.kind, 'epilogue');
});

test('album (20 pages, 201 cases), 9 succès (210 écus), 3 décors trouvés, étape 8 et épilogue dans la progression', () => {
  assert.equal(ALBUM_PAGES.length, 20);
  assert.equal(ALBUM_CASES.length, 201);
  const legends = ALBUM_PAGES.find((p) => p.id === 'legends');
  const visitors = ALBUM_PAGES.find((p) => p.id === 'visitors');
  assert.deepEqual([legends.cases.length, legends.reward.ecus, legends.reward.cosmeticId], [4, 30, 'melon.cloche']);
  assert.deepEqual([visitors.cases.length, visitors.reward.ecus, visitors.reward.cosmeticId], [6, 40, 'stork.vane']);
  assert.equal(STORKS_ACHIEVEMENTS.length, 9);
  assert.equal(STORKS_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 210);
  for (const id of ['melon.cloche', 'stork.vane', 'iron.box']) {
    const c = getCosmetic(id);
    assert.ok(c && c.found && c.price === 0 && c.category === 'small', id);
  }
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  A(g).sowLegend('storkPea');
  A(g).triggerValley('legendRipe', 'storkPea');
  A(g).harvestLegend('storkPea');
  A(g).triggerValley('visitor', 'crane', 'seen');
  A(g).triggerValley('epilogue');
  A(g).readEpilogue();
  A(g).triggerValley('postcard');
  nextDay(g);
  const ctx = g.query.achievementContext();
  const cv = ctx.career.valley;
  assert.deepEqual(cv.legendsHarvested, ['storkPea']);
  assert.deepEqual(cv.visitorsSeen, ['whiteStork', 'crane']);
  assert.equal(cv.stage, 8);
  assert.equal(cv.epilogueRead, true);
  assert.equal(cv.postcards, 1);
  const p = P.defaultProgress();
  const ids = P.checkAchievements(p, ctx);
  for (const id of ['firstLegend', 'legendHarvest', 'storksBack', 'rareVisitor', 'valleyBook', 'furtherAway']) assert.ok(ids.includes(id), id);
  for (const id of ['fourLegends', 'storkNest', 'allVisitors']) assert.ok(!ids.includes(id), id);
  const found = P.checkAlbum(p, ctx);
  assert.ok(found.cases.includes('legends.storkPea'));
  assert.ok(found.cases.includes('visitors.whiteStork') && found.cases.includes('visitors.crane'));
  assert.equal(P.careerAchievementList(p, ctx).length, 47);
  const st = P.recordValleyStage(p, 8);
  assert.equal(st.progress.career.valleyStage, 8);
  const ep = P.recordValleyEpilogue(p);
  assert.ok(ep.progress.cosmetics.owned.includes('iron.box'));
  assert.equal(ep.rewards.cosmeticId, 'iron.box');
});

test('événements de l\'étape 8 : valleyStage (100 écus, chapitre « Les cigognes »), puis storkWheelPlaced, dans la même aube', () => {
  const g = stage7Career();
  toStorkDay(g);
  A(g).observeVisitor('whiteStork');
  const ev = record(g);
  nextDay(g);
  const types = ev.events.map((e) => e.type);
  const k = types.indexOf('valleyStage');
  assert.ok(k >= 0 && types.indexOf('storkWheelPlaced') > k);
  const st = ev.of('valleyStage')[0];
  assert.equal(st.n, 8);
  assert.deepEqual(st.reward, { ecus: 100 });
  assert.equal(st.chapter.title, 'Les cigognes');
  assert.equal(st.chapter.lines.length, 3);
  assert.equal(V(g).stageAt[8].abs, absOf(g));
});
