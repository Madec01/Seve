// La Vallée vivante (lot V1) — activation, début (boîte de Joseph), flux aléatoire, étapes et chapitres, cueillette des
// haies, foire, geai, patrimoine, bilan, progression (album, succès). Contrat : docs/ARCHITECTURE.md, « Vallée vivante —
// contrats du lot V1 » ; règles : docs/VALLEE.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/core/career/career.js';
import { careerExtensions } from '../src/core/career/registry.js';
import { patrimony } from '../src/core/career/ranks.js';
import { nextFloat } from '../src/core/rng.js';
import {
  FAIR_STALL, HEDGE_FINDS_BY_ID, JOSEPH_BOX, SEED_RULES, SPECIES, STAGES, VARIETIES, VARIETIES_BY_ID, NATURE_ITEMS, TRAITS, SIGNS_V1,
} from '../src/data/career/valley.js';
import { ALBUM_PAGES_BY_ID } from '../src/data/album.js';
import { VALLEY_ACHIEVEMENTS, ALL_ACHIEVEMENTS } from '../src/data/achievements.js';
import { getCosmetic } from '../src/data/cosmetics.js';
import { careerFactor } from '../src/data/cozy.js';
import * as P from '../src/core/progression.js';
import { valleyCareer, startedCareer, newCareer, nextDay, record, setRank, toSeason } from './valley-helpers.js';

test('données : 12 variétés (une par culture), 7 traits (+ Parfumée du V2), 8 aménagements (+ nichoir à chauves-souris du V2), 12 habitants, 6 étapes, 24 signes de vie', () => {
  assert.equal(VARIETIES.length, 12);
  assert.equal(new Set(VARIETIES.map((x) => x.cropId)).size, 12);
  assert.equal(TRAITS.length, 8);
  assert.equal(TRAITS.filter((t) => t.id !== 'scented').length, 7);
  assert.equal(NATURE_ITEMS.length, 9);
  assert.equal(NATURE_ITEMS.filter((n) => !n.heritage).length, 8);
  assert.equal(SPECIES.length, 12);
  assert.deepEqual(STAGES.map((s) => s.signs), [0, 2, 6, 11, 17, 24]);
  assert.equal(SIGNS_V1, 24);
  for (const x of VARIETIES) assert.ok(x.anecdote.length <= 110, x.id);
  for (const s of SPECIES) {
    assert.ok(s.anecdote.length <= 110, s.id);
    assert.ok(s.recipe.length > 0 && s.hint && s.service.text, s.id);
  }
  assert.deepEqual(JOSEPH_BOX.varieties.map((id) => VARIETIES_BY_ID[id].cropId), ['turnip', 'tomato', 'pumpkin']);
  // L'extension est enregistrée en dernier (après le lot 4).
  assert.equal(careerExtensions().at(-1).id, 'valley');
});

test('activation : par défaut, null avec valley: false ; avant le rang 2 rien ne se passe ni ne s\'affiche', () => {
  const g = createCareer({ seed: 3 });
  assert.equal(g.valley, true);
  assert.ok(Number.isInteger(g.state.rng.valley));
  assert.deepEqual(g.query.career.valley(), { started: null, startsAtRank: 2 });
  const off = createCareer({ seed: 3, valley: false });
  assert.equal(off.valley, false);
  assert.equal(off.state.career.valley, null);
  assert.equal(off.query.career.valley(), null);
  const r1 = newCareer({ valley: true });
  const ev = record(r1);
  for (let i = 0; i < 5; i++) nextDay(r1);
  assert.equal(r1.state.career.valley.started, null);
  assert.equal(ev.of('valleyStarted').length, 0);
  assert.equal(r1.actions.career.openJar().reason, 'La Vallée commence au rang 2.');
  const parts = createCareer({ seed: 3, valley: { wildlife: false } });
  assert.deepEqual(parts.state.career.valley.parts, { seeds: true, wildlife: false, heritage: true, places: true });
});

test('début (première aube au rang 2) : boîte de Joseph (3 × 3 graines), première haie offerte, chapitre 0 à lire', () => {
  const g = valleyCareer();
  const ev = record(g);
  nextDay(g);
  const v = g.state.career.valley;
  assert.ok(v.started && v.started.year === 1);
  const st = ev.of('valleyStarted');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].box.map((b) => [b.varietyId, b.seeds]), JOSEPH_BOX.varieties.map((id) => [id, JOSEPH_BOX.seeds]));
  assert.equal(st[0].hedge, 'start.hedgeL');
  assert.deepEqual(st[0].chapter.lines, JOSEPH_BOX.lines);
  for (const id of JOSEPH_BOX.varieties) {
    assert.equal(v.seeds[id], 3);
    assert.equal(v.varieties[id].from, 'box');
  }
  assert.deepEqual(v.nature['start.hedgeL'].kind, 'hedge');
  assert.equal(v.bought.hedge || 0, 0, 'la haie offerte ne compte pas dans les prix croissants');
  assert.equal(v.spent, 0);
  const q = g.query.career.valley();
  assert.equal(q.stage.n, 0);
  assert.equal(q.hint.kind, 'chapter');
  assert.deepEqual(g.actions.career.readChapter(0).chapter.lines, JOSEPH_BOX.lines);
  assert.equal(g.query.career.valley().chapters[0].read, true);
  assert.equal(g.actions.career.readChapter(1).reason, 'Chapitre inconnu.');
  // Une seule boîte.
  nextDay(g);
  assert.equal(ev.of('valleyStarted').length, 1);
});

test('flux : la Vallée ne tire aucun nombre des autres flux ; sans geste du joueur, la ferme est la même avec ou sans', () => {
  const run = (valley) => {
    const g = newCareer({ valley, cozy: true, surprises: true, variety: true });
    g.state.money = 5000;
    setRank(g, 2);
    for (let i = 0; i < 40; i++) nextDay(g);
    return g.state;
  };
  const a = run(false);
  const b = run(true);
  for (const k of Object.keys(a.rng)) assert.equal(b.rng[k], a.rng[k], k);
  assert.ok(Number.isInteger(b.rng.valley) && !('valley' in a.rng));
  assert.equal(b.money, a.money);
  assert.deepEqual(b.weather, a.weather);
  assert.deepEqual(b.market, a.market);
});

test('tirages fixes : 12 nombres par aube (habitants), + 3 l\'été et l\'automne dès l\'étape 2, + 1 par bocal ouvert', () => {
  const g = startedCareer();
  const v = g.state.career.valley;
  const advance = (seed, n) => {
    const h = { x: seed };
    for (let k = 0; k < n; k++) nextFloat(h, 'x');
    return h.x;
  };
  let before = g.state.rng.valley;
  nextDay(g);
  assert.equal(g.state.rng.valley, advance(before, 12), 'printemps, étape 0 : 12 nombres');
  g.actions.career.triggerValley('jar', 'carrot');
  before = g.state.rng.valley;
  assert.ok(g.actions.career.openJar().ok);
  assert.equal(g.state.rng.valley, advance(before, 1), 'un bocal : 1 nombre');
  // Étape 2, été : 12 + 3.
  g.actions.career.triggerValley('stage', 2);
  assert.equal(v.stage, 2);
  toSeason(g, 1);
  before = g.state.rng.valley;
  nextDay(g);
  assert.equal(g.state.rng.valley, advance(before, 15), 'été, étape 2 : 15 nombres');
  // Habitants désactivés : aucun des 12 nombres.
  const w = startedCareer({ valley: { wildlife: false } });
  before = w.state.rng.valley;
  nextDay(w);
  assert.equal(w.state.rng.valley, before);
});

test('étapes : signes de vie (habitants installés + variétés fixées), valleyStage en fin d\'aube, jamais en baisse ; chapitres', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.triggerValley('fix', 'bouleDOr');
  g.actions.career.triggerValley('install', 'robin');
  assert.equal(g.state.career.valley.stage, 0, 'l\'étape change à l\'aube');
  nextDay(g);
  const st = ev.of('valleyStage');
  assert.equal(st.length, 1);
  assert.deepEqual([st[0].n, st[0].name, st[0].reward.ecus], [1, 'Le premier chant', 5]);
  assert.deepEqual(st[0].chapter.lines, STAGES[1].chapter.lines);
  const dawnIdx = ev.events.findIndex((e) => e.type === 'dawn');
  assert.ok(ev.events.findIndex((e) => e.type === 'valleyStage') < dawnIdx || dawnIdx >= 0);
  const q = g.query.career.valley();
  assert.equal(q.stage.signs, 2);
  assert.deepEqual(q.stage.next, { n: 2, name: 'Les haies refleurissent', signs: 6 });
  assert.equal(q.hint.kind, 'chapter');
  assert.ok(g.actions.career.readChapter(1).ok);
  // Plusieurs paliers d'un coup : un événement par étape.
  ev.clear();
  g.actions.career.triggerValley('stage', 5);
  assert.equal(g.state.career.valley.stage, 5);
  assert.deepEqual(ev.of('valleyStage').map((e) => e.n), [2, 3, 4, 5]);
  assert.equal(ev.of('valleyStage').at(-1).reward.cosmeticId, 'valley.linden');
  assert.deepEqual(g.query.career.valley().services.filter((s) => s.id.startsWith('stage.')).map((s) => s.id), ['stage.2', 'stage.3', 'stage.4']);
});

test('cueillette des haies (étape 2, été et automne) : une trouvaille sur une haie, ramassée au toucher × careerFactor', () => {
  const g = startedCareer();
  g.actions.career.triggerValley('stage', 2);
  toSeason(g, 1);
  assert.ok(g.state.career.valley.finds.length <= 1, 'au plus une par aube');
  g.state.career.valley.finds = [];
  const r = g.actions.career.triggerValley('finds');
  assert.ok(r.ok && r.finds === 3);
  const q = g.query.career.valley();
  assert.equal(q.finds.length, 3);
  assert.ok(q.finds.every((f) => f.spotId === 'start.hedgeL'));
  const f = q.finds[0];
  const money = g.state.money;
  const res = g.actions.career.pickHedgeFind(f.id);
  assert.equal(res.amount, Math.round(HEDGE_FINDS_BY_ID[f.kind].coins * careerFactor(2)));
  assert.equal(g.state.money, money + res.amount);
  assert.equal(g.state.career.yearStats.incomeBy.valley, res.amount);
  assert.equal(g.actions.career.pickHedgeFind(f.id).reason, 'Rien à cueillir ici.');
  // Au plus 3 ; effacées au 1er jour d'hiver.
  for (let i = 0; i < 10; i++) nextDay(g);
  assert.ok(g.state.career.valley.finds.length <= 3);
  toSeason(g, 3);
  assert.equal(g.state.career.valley.finds.length, 0);
});

test('foire aux graines (dernier jour d\'hiver) : l\'étal de la grainothèque du pays (60 + 30 × rang), une fois par an', () => {
  const g = startedCareer();
  const L = g.state.career.seasonLength;
  toSeason(g, 3);
  for (let d = 1; d < L; d++) nextDay(g);
  assert.equal(g.state.time.dayOfSeason, L);
  const fair = g.query.career.valley().fair;
  assert.ok(fair && fair.canBuy);
  assert.equal(fair.price, FAIR_STALL.base + FAIR_STALL.perRank * 2);
  assert.ok(!g.state.career.valley.varieties[fair.varietyId], 'une variété pas encore obtenue');
  assert.notEqual(fair.varietyId, 'calvilleBlanc', 'sans verger, pas de greffon');
  const spent = g.state.career.valley.spent;
  const r = g.actions.career.buyFairHeirloom();
  assert.ok(r.ok);
  assert.equal(g.state.career.valley.seeds[fair.varietyId], 3);
  assert.equal(g.state.career.valley.varieties[fair.varietyId].from, 'fair');
  assert.equal(g.state.career.valley.spent, spent + fair.price);
  assert.equal(g.actions.career.buyFairHeirloom().reason, 'Déjà acheté cette année.');
  nextDay(g);
  assert.equal(g.actions.career.buyFairHeirloom().reason, 'La foire aux graines n\'est pas aujourd\'hui.');
});

test('le geai installé : un bocal « oublié » chaque 1er jour d\'automne (une fois par an)', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.triggerValley('install', 'jay');
  const jars = g.state.career.heirlooms.length;
  toSeason(g, 2);
  assert.equal(g.state.career.heirlooms.length, jars + 1);
  assert.equal(g.state.career.heirlooms.at(-1).from, 'jay');
  assert.equal(ev.of('jayGift').length, 1);
  nextDay(g);
  assert.equal(g.state.career.heirlooms.length, jars + 1);
  const r = g.actions.career.openJar();
  assert.ok(r.ok);
  assert.equal(g.state.career.valley.varieties[r.varietyId].from, r.isNew ? 'jay' : g.state.career.valley.varieties[r.varietyId].from);
});

test('dépenses de la Vallée : poste « valley » du bilan, comptées à 100 % dans le patrimoine', () => {
  const g = startedCareer();
  const before = patrimony(g.state);
  const r = g.actions.career.placeNature('yard.pile');
  assert.ok(r.ok);
  assert.equal(r.cost, 30);
  assert.equal(g.state.career.yearStats.spentBy.valley, 30);
  assert.equal(patrimony(g.state), before, 'argent − 30, patrimoine + 30');
  assert.equal(g.query.career.valley().spent, 30);
});

test('bilan de l\'année : report.valley (étape, compteurs, venus et sauvés cette année), compteurs remis à zéro', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.triggerValley('install', 'robin');
  g.actions.career.triggerValley('fix', 'bouleDOr');
  g.actions.career.placeNature('yard.pile');
  const L = g.state.career.seasonLength;
  for (let k = 0; k < 4 * L; k++) nextDay(g);
  const ye = ev.of('yearEnd')[0];
  assert.ok(ye.report.valley);
  assert.deepEqual(ye.report.valley.installed, ['robin']);
  assert.deepEqual(ye.report.valley.fixed, ['bouleDOr']);
  assert.equal(ye.report.valley.year.placed, 1);
  assert.equal(ye.report.valley.year.installed, 1);
  assert.equal(g.state.career.valley.year.placed, 0);
  assert.equal(g.query.career.yearReport().valley.installed.length, 0);
});

test('progression : 2 pages d\'album (carrière), 7 succès (155 écus), décor de l\'étape 5', () => {
  assert.equal(ALBUM_PAGES_BY_ID.heirlooms.cases.length, 12);
  assert.equal(ALBUM_PAGES_BY_ID.wildlife.cases.length, 12);
  assert.ok([...ALBUM_PAGES_BY_ID.heirlooms.cases, ...ALBUM_PAGES_BY_ID.wildlife.cases].every((c) => c.mode === 'career'));
  assert.equal(VALLEY_ACHIEVEMENTS.length, 7);
  assert.equal(VALLEY_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 155);
  assert.ok(VALLEY_ACHIEVEMENTS.every((a) => a.category === 'career' && a.reward.stars === 0 && ALL_ACHIEVEMENTS.includes(a)));
  for (const id of ['seed.cabinet', 'nestbox.painted', 'valley.linden']) assert.ok(getCosmetic(id)?.found, id);
  assert.equal(getCosmetic('valley.linden').category, 'large');
  const g = startedCareer();
  g.actions.career.triggerValley('fix', 'bouleDOr');
  g.actions.career.triggerValley('install', 'robin');
  const ctx = g.query.achievementContext();
  assert.deepEqual(ctx.career.valley, {
    started: true, fixed: ['bouleDOr'], installed: ['robin'], stage: 0, jars: 0, hand: 0,
    swaps: [], swapsFav: [], crossesFound: [], library: 0, fixedPays: 1, fixedVillage: 0, fixedCross: 0, installedV1: 1, installedV2: 0,
    // (V3) étapes des lieux, lieux restaurés, habitants de la vallée, terres, pêches, chantiers.
    places: { brook: 0, combe: 0, poppies: 0, millpond: 0, bocage: 0, oldOrchard: 0 }, restored: [], valleyInstalled: [], wilds: 0, riverFish: 0, works: 0,
  });
  const p = P.defaultProgress();
  const ids = P.checkAchievements(p, ctx);
  for (const id of ['valleyBox', 'firstSaved', 'firstNeighbour']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('seedKeeper') && !ids.includes('valleySings'));
  const found = P.checkAlbum(p, ctx);
  assert.ok(found.cases.includes('heirlooms.bouleDOr'));
  assert.ok(found.cases.includes('wildlife.robin'));
  // Pages vues dans les niveaux : « À découvrir dans Ma ferme ».
  const page = P.albumPages(p, 'detente').find((x) => x.id === 'wildlife');
  assert.equal(page.cases[0].modeNote, 'À découvrir dans Ma ferme');
  // Étape 5 : décor débloqué (les écus passent par recordCareerEcus).
  const r = P.recordValleyStage(p, 5);
  assert.ok(r.progress.cosmetics.owned.includes('valley.linden'));
  assert.equal(r.progress.ecus, p.ecus);
  assert.equal(r.progress.career.valleyStage, 5);
  assert.equal(P.recordValleyStage(r.progress, 5).rewards.already, true);
  assert.equal(P.normalizeProgress(r.progress).career.valleyStage, 5);
  assert.equal(SEED_RULES.handSeeds, 2);
});
