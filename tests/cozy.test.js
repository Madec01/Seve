// Lot 4 — état et options (createGame / createCareer ({ cozy })), requêtes (query.cozy, query.fete, query.winter),
// contexte de l'album, succès « Album et fêtes ». Contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createCareer } from '../src/core/career/career.js';
import { COZY_PARTS } from '../src/data/cozy.js';
import * as P from '../src/core/progression.js';
import { nextDay } from './helpers.js';

test('activation : défaut en Détente, clé absente en Classique, false → null, parties { lanterns, fetes, winter, decor }', () => {
  assert.deepEqual(COZY_PARTS, ['lanterns', 'fetes', 'winter', 'helpers']);
  const d = createGame({ levelId: 3, seed: 1, difficulty: 'detente' });
  assert.equal(d.cozy, true);
  assert.deepEqual(d.state.cozy.parts, { lanterns: true, fetes: true, winter: true, helpers: false });
  assert.ok(Number.isInteger(d.state.rng.cozy));
  assert.equal('cozy' in createGame({ levelId: 3, seed: 1, difficulty: 'classique' }).state, false);
  assert.equal(createGame({ levelId: 3, seed: 1, difficulty: 'detente', cozy: false }).state.cozy, null);
  const forced = createGame({ levelId: 3, seed: 1, difficulty: 'classique', cozy: true });
  assert.ok(forced.state.cozy, 'cozy: true force le lot (tests)');
  const part = createGame({ levelId: 3, seed: 1, difficulty: 'detente', cozy: { fetes: false, decor: { placed: 4, path: true } } });
  assert.deepEqual(part.state.cozy.parts, { lanterns: true, fetes: false, winter: true, helpers: false });
  assert.deepEqual(part.state.cozy.decor, { placed: 4, path: true, fence: false });
  // decorSummary de la progression (choix du joueur) : décor posé, allée, clôture.
  const p = P.defaultProgress();
  p.cosmetics.decor = { 'porch.left': 'gnome', 'yard.1': 'bench' };
  p.cosmetics.path = 'path.stone';
  assert.deepEqual(P.decorSummary(p), { placed: 2, path: true, fence: false });
  // Carrière : défaut actif avec F1 ; cozy: false → null.
  const c = createCareer({ seed: 2 });
  assert.equal(c.cozy, true);
  assert.equal(c.state.cozy.parts.helpers, true);
  assert.equal(createCareer({ seed: 2, cozy: false }).state.cozy, null);
  assert.equal(createCareer({ seed: 2, cosmetics: { decor: {}, path: 'path.stone' } }).state.career.cosmetics.path, 'path.stone');
});

test('query.cozy : forme ; prochaines fêtes ; réserve ; statistiques', () => {
  const g = createGame({ levelId: 2, seed: 7, difficulty: 'detente' });
  const q = g.query.cozy();
  assert.deepEqual(Object.keys(q).sort(), ['enabled', 'fete', 'history', 'lanterns', 'lit', 'parts', 'seedBank', 'stats', 'upcoming', 'winter'].sort());
  assert.equal(q.fete, null);
  assert.deepEqual(q.upcoming.map((u) => [u.id, u.seasonId, u.day, u.daysUntil]), [['springFete', 'spring', 3, 2], ['villageFete', 'summer', 4, 10], ['harvestFestival', 'autumn', 2, 15], ['christmasMarket', 'winter', 4, 24]]);
  assert.deepEqual(q.seedBank, []);
  assert.equal(q.lit, null);
  nextDay(g);
  nextDay(g);
  const f = g.query.fete();
  assert.deepEqual(Object.keys(f).sort(), ['choices', 'day', 'done', 'engine', 'hidden', 'icon', 'id', 'max', 'name', 'result', 'rules', 'stalls', 'text', 'themeId', 'villagers'].sort());
  assert.equal(f.icon, 'icon.fete');
  assert.ok(f.rules.length >= 1);
});

test('contexte de l\'album (achievementContext) : weather partout ; surprises, cozy (stats, pending, year), variété (clients, Basile, pending)', () => {
  const g = createGame({ levelId: 2, seed: 7, difficulty: 'detente' });
  const ctx = g.query.achievementContext();
  assert.equal(ctx.weather, g.state.weather.today);
  assert.ok(ctx.surprisesStats);
  assert.ok('specialWeather' in ctx);
  assert.deepEqual(Object.keys(ctx.cozy).sort(), ['contestGoals', 'pending', 'stats', 'year']);
  assert.ok(ctx.variety.ordersByClient && 'merchantVisits' in ctx.variety && ctx.variety.pending);
  const c = createCareer({ seed: 2 });
  const cc = c.query.achievementContext();
  assert.equal(typeof cc.career.species, 'number', 'career.species reste le nombre d\'espèces (succès « L\'arche »)');
  assert.ok(Array.isArray(cc.career.speciesIds));
  assert.ok(cc.career.pets && cc.career.fish && Array.isArray(cc.career.themes));
});

test('succès « Album et fêtes » : cumuls de la progression + ce qui n\'est pas encore compté (pending), sans double compte', () => {
  const p = P.defaultProgress();
  p.lifetime.cozy.handPicked = 499;
  p.lifetime.variety.orders = 49;
  p.lifetime.variety.medals.gold = 9;
  const ctx = { levelId: 'career', status: 'playing', stats: null, cozy: { pending: { handPicked: 1, eggsAll: 0, ribbons: { gold: 0 }, birds: {} } }, variety: { pending: { ordersDone: 1, cartsFull: 1, gold: 1 } } };
  const ids = P.checkAchievements(p, ctx);
  for (const id of ['handPicked500', 'orders50', 'goldMedals10', 'fullCart']) assert.ok(ids.includes(id), id);
  assert.deepEqual(P.checkAchievements(p, { ...ctx, counted: true }).filter((id) => ['handPicked500', 'orders50'].includes(id)), [], 'déjà compté : rien de plus');
  const birds = P.defaultProgress();
  birds.lifetime.cozy.birds = { sparrow: 1, greatTit: 1, robin: 1, blueTit: 1, chaffinch: 1, nuthatch: 1, bullfinch: 1 };
  assert.ok(!P.checkAchievements(birds, null).includes('birdFriends'));
  assert.ok(P.checkAchievements(birds, { cozy: { pending: { birds: { woodpecker: 1 } } } }).includes('birdFriends'));
  assert.equal(P.cozyAchievementList(birds, null).length, 12);
});
