// Lot 4 — D1 : l'album de la ferme (données, faits, nouveautés, pages, récompenses, rattrapage, veillées).
// Règles : docs/GAME_DESIGN.md § 17.1 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createCareer } from '../src/core/career/career.js';
import { ALBUM_CASES, ALBUM_COMPLETE_REWARD, ALBUM_EXTRA_REWARDS, ALBUM_PAGES, RESERVED_PAGE_IDS, STORIES } from '../src/data/album.js';
import { COSMETICS, getCosmetic } from '../src/data/cosmetics.js';
import { COZY_ACHIEVEMENTS } from '../src/data/achievements.js';
import { albumFacts, caseDone, contextFromSave } from '../src/core/album.js';
import * as P from '../src/core/progression.js';
import { nextDay } from './helpers.js';

const NOW = 1_700_000_000_000;

test('données : 13 pages (11 du lot 4 + 2 de la Vallée), 148 cases, identifiants uniques, anecdotes ≤ 110 caractères, récompenses connues', () => {
  assert.equal(ALBUM_PAGES.length, 13);
  assert.equal(ALBUM_CASES.length, 148);
  assert.deepEqual(ALBUM_PAGES.map((p) => p.cases.length), [15, 12, 11, 8, 13, 13, 9, 9, 9, 13, 12, 12, 12]);
  assert.equal(new Set(ALBUM_CASES.map((c) => c.caseId)).size, 148);
  for (const c of ALBUM_CASES) {
    assert.ok(['all', 'dc', 'career'].includes(c.mode), c.caseId);
    assert.ok(c.text.length <= 110, `${c.caseId} : anecdote trop longue (${c.text.length})`);
    assert.ok(c.hint && c.name && c.icon, c.caseId);
  }
  for (const p of ALBUM_PAGES) assert.ok(getCosmetic(p.reward.cosmeticId)?.found, p.id);
  for (const r of ALBUM_EXTRA_REWARDS) if (r.cosmeticId) assert.ok(getCosmetic(r.cosmeticId)?.found, r.id);
  assert.ok(getCosmetic(ALBUM_COMPLETE_REWARD.cosmeticId)?.category === 'large');
  assert.deepEqual(RESERVED_PAGE_IDS, ['heirlooms', 'wildlife']);
  assert.equal(STORIES.length, 12);
  assert.ok(STORIES.every((s) => s.lines.length === 3));
  assert.equal(ALBUM_CASES.find((c) => c.caseId === 'garden.apple').stamps.join(), 'gold', 'le pommier n\'a pas de tampon géant');
  // 20 décors trouvés du lot 4 (14 de l'album, 6 des lanternes), sans prix.
  const lot4 = COSMETICS.filter((c) => c.found && c.price === 0 && !['owl.carved', 'statue.small', 'lantern.peddler', 'weathervane.rooster', 'sign.magazine', 'seed.cabinet', 'nestbox.painted', 'valley.linden'].includes(c.id));
  assert.equal(lot4.length, 20);
  assert.equal(COZY_ACHIEVEMENTS.length, 12);
  assert.equal(COZY_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 255);
  assert.ok(COZY_ACHIEVEMENTS.every((a) => a.category === 'cozy' && a.reward.stars === 0));
});

test('Classique : l\'album se remplit à partir du contexte (cultures, temps du jour), sans rien changer à la partie', () => {
  const g = createGame({ levelId: 1, seed: 3, difficulty: 'classique' });
  g.state.weather.today = 'storm';
  g.state.stats.year.cropsHarvested.carrot = 2;
  g.state.investments.chickenCoop = 1;
  const before = JSON.stringify(g.serialize());
  const p = P.defaultProgress();
  const found = P.checkAlbum(p, g.query.achievementContext());
  assert.ok(found.cases.includes('garden.carrot'));
  assert.ok(found.cases.includes('sky.storm'));
  assert.ok(found.cases.includes('animals.hen'));
  assert.ok(found.cases.includes('homemade.eggs'));
  assert.ok(!found.cases.includes('sky.fog'), 'les météos spéciales : Détente ou carrière');
  assert.equal(JSON.stringify(g.serialize()), before, 'la partie est intacte');
  const r = P.recordAlbum(p, found, NOW, 'levels');
  assert.deepEqual(r.cases, found.cases);
  assert.deepEqual(r.progress.album.found['garden.carrot'], { at: NOW, src: 'levels' });
  assert.deepEqual(P.checkAlbum(r.progress, g.query.achievementContext()).cases, [], 'une case trouvée l\'est pour toujours');
  assert.deepEqual(p, P.defaultProgress(), 'entrée intacte');
});

test('Détente : surprises, fêtes, hiver et variété remplissent leurs cases ; tampons doré, géant, 🏅', () => {
  const g = createGame({ levelId: 2, seed: 3, difficulty: 'detente' });
  const s = g.state;
  s.surprises.stats.gold.carrot = 1;
  s.surprises.stats.weathers.fog = 1;
  s.surprises.stats.surprises.fairy = 1;
  s.surprises.stats.wishes = 1;
  s.cozy.stats.giants.pumpkin = 1;
  s.cozy.stats.fetes.eggHunt = 1;
  s.cozy.stats.best.eggHunt = 1;
  s.cozy.stats.birds.robin = 1;
  s.cozy.stats.finds.holly = 1;
  s.cozy.stats.traces.foxTrack = 1;
  s.variety.stats.ordersByClient.lili = 1;
  s.variety.stats.merchantVisits = 1;
  s.stats.year.cropsHarvested.carrot = 1;
  const found = P.checkAlbum(P.defaultProgress(), g.query.achievementContext());
  for (const id of ['garden.carrot', 'sky.fog', 'luck.fairy', 'luck.wish', 'fetes.eggHunt', 'feeder.robin', 'edge.holly', 'edge.foxTrack', 'village.lili', 'village.basile']) assert.ok(found.cases.includes(id), id);
  const stamps = found.stamps.map((x) => `${x.caseId}/${x.stamp}`);
  assert.ok(stamps.includes('garden.carrot/gold'));
  assert.ok(stamps.includes('garden.pumpkin/giant'));
  assert.ok(stamps.includes('fetes.eggHunt/best'));
});

test('carrière : animaux, compagnons, poissons, années à thème et tampons (fête jouée, visiteur)', () => {
  const g = createCareer({ seed: 3 });
  const s = g.state;
  s.investments.pig = 1;
  s.career.pets.cat = true;
  s.cozy.stats.fish.trout = 1;
  s.cozy.stats.animal.angora = 1;
  s.career.theme = { ...s.career.theme, history: [{ year: 1, id: 'bees' }] };
  s.cozy.stats.themesPlayed.bees = 1;
  s.cozy.stats.themeVisitors.bees = 1;
  const ctx = g.query.achievementContext();
  assert.ok(ctx.career.speciesIds.includes('hen'));
  const found = P.checkAlbum(P.defaultProgress(), ctx);
  for (const id of ['animals.pig', 'animals.cat', 'feeder.trout', 'homemade.angora', 'years.bees', 'animals.hen']) assert.ok(found.cases.includes(id), id);
  const stamps = found.stamps.map((x) => `${x.caseId}/${x.stamp}`);
  assert.ok(stamps.includes('years.bees/fete') && stamps.includes('years.bees/visitor'));
});

test('pages, récompenses (écus et décor ajoutés à la progression renvoyée), cases vues, album complet', () => {
  let p = P.defaultProgress();
  const sky = ALBUM_PAGES.find((pg) => pg.id === 'sky');
  const refused = P.claimAlbumReward(p, 'sky');
  assert.deepEqual(refused, { ok: false, reason: 'Page pas encore complète.' });
  p = P.recordAlbum(p, { cases: sky.cases.map((c) => `sky.${c.id}`), stamps: [] }, NOW, 'levels').progress;
  const pages = P.albumPages(p, 'classique');
  const sp = pages.find((pg) => pg.id === 'sky');
  assert.equal(sp.done, true);
  assert.equal(sp.found, 8);
  assert.equal(sp.rewards[0].ready, true);
  assert.ok(sp.cases.every((c) => c.isNew && c.text && !c.hint));
  const garden = pages.find((pg) => pg.id === 'garden');
  assert.equal(garden.cases.find((c) => c.id === 'pea').modeNote, 'En Détente ou dans Ma ferme');
  assert.equal(pages.find((pg) => pg.id === 'feeder').cases.find((c) => c.id === 'pike').modeNote, 'À découvrir dans Ma ferme');
  assert.deepEqual(P.albumClaimable(p), ['sky']);
  const c = P.claimAlbumReward(p, 'sky');
  assert.equal(c.ok, true);
  assert.deepEqual(c.rewards, { ecus: sky.reward.ecus, cosmeticId: 'sundial', already: false });
  assert.equal(c.progress.ecus, sky.reward.ecus);
  assert.ok(c.progress.cosmetics.owned.includes('sundial'));
  assert.equal(P.claimAlbumReward(c.progress, 'sky').reason, 'Déjà reçu.');
  assert.equal(P.claimAlbumReward(c.progress, 'nope').reason, 'Récompense inconnue.');
  const seen = P.markAlbumSeen(c.progress, ['sky.storm']);
  assert.equal(P.albumPages(seen).find((pg) => pg.id === 'sky').cases.find((x) => x.id === 'storm').isNew, false);
  // Succès « Première page ».
  assert.ok(P.checkAchievements(c.progress, null).includes('albumPage'));
  // Album complet : toutes les cases → les 13 pages ; la récompense « complete » (les 11 pages du lot 4) et le succès.
  const all = P.recordAlbum(P.defaultProgress(), { cases: ALBUM_CASES.map((x) => x.caseId), stamps: [] }, NOW).progress;
  const o = P.albumOverview(all);
  assert.deepEqual([o.found, o.total, o.pagesDone, o.complete.ready], [148, 148, 13, true]);
  const done = P.claimAlbumReward(all, 'complete');
  assert.equal(done.rewards.cosmeticId, 'herbarium');
  assert.ok(P.checkAchievements(all, null).includes('albumComplete'));
});

test('page dorée du potager et page des géants (tampons) ; succès « Herbier doré »', () => {
  const garden = ALBUM_PAGES.find((pg) => pg.id === 'garden');
  let p = P.recordAlbum(P.defaultProgress(), { cases: garden.cases.map((c) => `garden.${c.id}`), stamps: garden.cases.map((c) => ({ caseId: `garden.${c.id}`, stamp: 'gold' })) }, NOW).progress;
  assert.ok(P.albumClaimable(p).includes('garden.gold'));
  assert.ok(!P.albumClaimable(p).includes('garden.giant'));
  assert.ok(P.checkAchievements(p, null).includes('goldenHerbarium'));
  p = P.recordAlbum(p, { cases: [], stamps: garden.cases.filter((c) => c.id !== 'apple').map((c) => ({ caseId: `garden.${c.id}`, stamp: 'giant' })) }, NOW).progress;
  assert.ok(P.albumClaimable(p).includes('garden.giant'), '14 cases ont un tampon géant (pas le pommier)');
});

test('veillées : 12 histoires dans l\'ordre, + 1 écu par histoire nouvelle, puis une histoire déjà entendue (sans écu)', () => {
  let p = P.defaultProgress();
  for (let k = 0; k < 12; k++) {
    const r = P.recordStory(p, NOW);
    assert.equal(r.story.id, STORIES[k].id);
    assert.equal(r.first, true);
    assert.equal(r.ecus, 1);
    p = r.progress;
  }
  assert.equal(p.ecus, 12);
  assert.ok(P.albumPages(p).find((pg) => pg.id === 'stories').done);
  const again = P.recordStory(p, NOW);
  assert.equal(again.first, false);
  assert.equal(again.ecus, 0);
  assert.equal(again.progress.ecus, 12);
});

test('rattrapage : progression (cumuls, succès, décors) et sauvegardes (partie de niveau, carrière) ; une seule fois', () => {
  const raw = {
    schema: 2,
    lifetime: { cropsHarvested: { carrot: 4, potato: 1 }, productsSold: { flour: 2 }, variety: { rare: { pea: 1 }, cartsFull: 1, medals: { gold: 1 } } },
    achievements: { henHouse: { at: 1 }, truffles: { at: 2 } },
    cosmetics: { owned: ['owl.carved', 'lantern.peddler'] },
  };
  const p = P.normalizeProgress(raw);
  assert.equal(p.album.retroDone, false, 'progression d\'avant le lot 4');
  // Une partie de niveau Détente du lot 3 (sans lot 4) avec une dorée et un client livré.
  const lv = createGame({ levelId: 2, seed: 4, difficulty: 'detente', cozy: false });
  lv.state.surprises.stats.gold.tomato = 1;
  lv.state.variety.stats.ordersByClient.rose = 1;
  const levelSave = { state: lv.serialize() };
  delete levelSave.state.cozy;
  const car = createCareer({ seed: 2, cozy: false });
  car.state.career.pets.dog = true;
  car.state.investments.pig = 1;
  const careerSave = car.serialize();
  const r = P.albumRetro(p, { levelSave, careerSave });
  for (const id of ['garden.carrot', 'garden.potato', 'garden.pea', 'homemade.flour', 'fetes.cart', 'fetes.goldMedal', 'animals.hen', 'homemade.eggs', 'animals.pig', 'homemade.truffle', 'luck.owl', 'village.basile', 'village.rose', 'animals.dog']) {
    assert.ok(r.cases.includes(id), id);
  }
  assert.ok(r.progress.album.found['garden.carrot'].src === 'retro' && r.progress.album.found['garden.carrot'].at === null);
  assert.ok((r.progress.album.stamps['garden.tomato'] || []).includes('gold'));
  assert.equal(r.progress.album.retroDone, true);
  assert.deepEqual(P.albumRetro(r.progress, { levelSave, careerSave }).cases, [], 'une seule fois');
  assert.match(P.retroText(23), /^23 cases de l'album retrouvées/);
  assert.equal(P.retroText(1), '1 case de l\'album retrouvée dans vos anciennes parties');
  assert.ok(contextFromSave(careerSave).career.speciesIds.includes('pig'));
});

test('album à chaque aube (recordAlbumDawn) et à la fin (recordRunEnd : context, src levels)', () => {
  const g = createGame({ levelId: 2, seed: 5, difficulty: 'detente' });
  g.state.money = 5000;
  let p = P.defaultProgress();
  let last = null;
  g.on('victory', (e) => (last = e));
  while (g.state.status === 'playing') {
    const tend = g.query;
    for (const pl of tend.plots()) if (pl.action === 'harvest') g.actions.harvest(pl.index);
    for (const pl of tend.plots()) if (pl.action === 'plant') {
      const o = tend.plantableCrops(pl.index).find((x) => x.canAfford && !x.willFreeze);
      if (o) g.actions.plant(pl.index, o.id);
    }
    nextDay(g);
    p = P.recordAlbumDawn(p, g.query.achievementContext(), NOW).progress;
  }
  assert.ok(Object.keys(p.album.found).length >= 5);
  const end = P.recordRunEnd(p, { levelId: 2, outcome: 'victory', stars: last.stars, money: last.money, summary: last.summary, context: g.query.achievementContext() }, NOW);
  assert.ok(Array.isArray(end.album.cases));
  assert.ok(end.progress.lifetime.cozy);
  const f = albumFacts(g.query.achievementContext(), end.progress);
  assert.equal(caseDone(ALBUM_CASES.find((c) => c.caseId === 'garden.carrot'), f), f.crops.has('carrot'));
});
