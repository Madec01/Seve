// La Vallée vivante (lot V4) — les quatre légendes sous cloche : réveils (étape 6, Ru des Saules 4, 3 générations de la
// Merveille, étape 8), une seule par aube et jamais le matin d'un autre récit, semis gratuit toute saison sans arrosage,
// pousse en jours de culture, mûre sans limite, récolte à la main seulement, jamais vendue. docs/VALLEE.md § 18.2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDS } from '../src/data/career/storks.js';
import { ofFarm } from '../src/data/career/heritage.js';
import { valleyHarvest } from '../src/core/career/valley.js';
import { emptyPlots, ripen, withExtension } from './valley-helpers.js';
import { A, Q, V, absOf, nextDay, record, stage7Career, stage8Career, toSeason, v4Career } from './valley4-helpers.js';

const legend = (g, id) => Q(g).valley().legends.find((x) => x.id === id);

test('réveils : le melon à l\'étape 6, l\'engrain au moulin (Ru 4), les pois à l\'étape 8 — à l\'aube suivante, récit compris', () => {
  const g = v4Career();
  A(g).triggerValley('stage', 6);
  assert.equal(V(g).legends.motherMelon, undefined, 'pas dans la même aube que l\'étape');
  assert.equal(legend(g, 'motherMelon').state, 'asleep');
  assert.match(legend(g, 'motherMelon').wakeText, /étape 6/);
  const ev = record(g);
  nextDay(g);
  const aw = ev.of('legendAwoken');
  assert.deepEqual(aw.map((e) => e.id), ['motherMelon']);
  assert.equal(aw[0].story, 'melon');
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'melon'));
  assert.equal(V(g).legends.motherMelon.awokeAt, absOf(g));
  assert.equal(legend(g, 'motherMelon').state, 'awake');
  assert.equal(legend(g, 'millEinkorn').state, 'asleep');
  A(g).triggerValley('place', 'brook', 4);
  ev.clear();
  nextDay(g);
  // Le récit « brook3 » est venu à l'aube précédente (pendant le débogage) : l'engrain se réveille maintenant.
  assert.deepEqual(ev.of('legendAwoken').map((e) => e.id), ['millEinkorn']);
  const h = stage8Career();
  for (let k = 0; k < 6; k++) nextDay(h);
  assert.ok(V(h).legends.storkPea, 'les pois après les cigognes');
});

test('une seule légende par aube, dans l\'ordre des données ; jamais le matin où un autre récit arrive', () => {
  const g = v4Career();
  A(g).triggerValley('stage', 7);
  A(g).triggerValley('place', 'brook', 4);
  V(g).marvel.gens = 3;
  // Un récit de lieu arrive à l'aube suivante (le bois de la Combe restauré) : les légendes attendent.
  A(g).triggerValley('place', 'combe', 2);
  A(g).triggerValley('works', 'combe');
  A(g).triggerValley('recover', 'combe');
  const ev = record(g);
  nextDay(g);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'combe3'));
  assert.equal(ev.of('legendAwoken').length, 0, 'un récit ce matin : la légende attend');
  const order = [];
  for (let k = 0; k < 5; k++) {
    ev.clear();
    nextDay(g);
    const aw = ev.of('legendAwoken');
    assert.ok(aw.length <= 1);
    order.push(...aw.map((e) => e.id));
  }
  assert.deepEqual(order, ['motherMelon', 'millEinkorn', 'farmMarvel']);
});

test('cloches : il faut la Grainothèque ; semis gratuit, toute saison ; pousse en jours ; mûre à l\'aube ; attend sans limite ; récolte à la main', () => {
  const g = v4Career();
  A(g).triggerValley('legend', 'motherMelon');
  let L = legend(g, 'motherMelon');
  assert.equal(L.needLibrary, true);
  assert.equal(L.canSow, false);
  assert.match(L.waitsHome, /attend sa maison : la Grainothèque/);
  assert.deepEqual(A(g).sowLegend('motherMelon'), { ok: false, reason: 'Il faut d\'abord la Grainothèque.' });
  assert.equal(A(g).sowLegend('farmMarvel').reason, 'Cette graine dort encore.');
  assert.equal(A(g).sowLegend('nope').reason, 'Légende inconnue.');
  A(g).triggerValley('library', 1);
  toSeason(g, 3);
  let money = g.state.money;
  const r = A(g).sowLegend('motherMelon');
  assert.equal(r.ok, true, 'en hiver aussi (sous cloche)');
  assert.equal(r.days, 6);
  assert.equal(r.readyAt, absOf(g) + 6);
  assert.equal(g.state.money, money, 'gratuit');
  assert.equal(A(g).sowLegend('motherMelon').reason, 'Elle pousse déjà sous sa cloche.');
  assert.equal(A(g).harvestLegend('motherMelon').reason, 'Pas encore mûre : encore 6 jours.');
  L = legend(g, 'motherMelon');
  assert.deepEqual([L.cloche.state, L.cloche.daysLeft, L.cloche.progress, L.cloche.sprite], ['growing', 6, 0, 'legend.motherMelon.0']);
  const ev = record(g);
  for (let k = 0; k < 3; k++) nextDay(g);
  assert.equal(legend(g, 'motherMelon').cloche.sprite, 'legend.motherMelon.1', 'en fleur à mi-pousse');
  for (let k = 0; k < 3; k++) nextDay(g, 'rain');
  assert.deepEqual(ev.of('legendRipe').map((e) => e.id), ['motherMelon']);
  assert.equal(legend(g, 'motherMelon').cloche.state, 'ripe');
  assert.equal(A(g).sowLegend('motherMelon').reason, 'Elle est mûre : récoltez-la d\'abord.');
  for (let k = 0; k < 30; k++) nextDay(g);
  assert.equal(legend(g, 'motherMelon').cloche.state, 'ripe', 'elle attend, sans limite');
  money = g.state.money;
  const plots = JSON.stringify(g.state.plots);
  const stock = JSON.stringify(g.state.career.stock);
  const h1 = A(g).harvestLegend('motherMelon');
  assert.deepEqual(h1, { ok: true, legendId: 'motherMelon', first: true, line: LEGENDS[0].firstHarvest, harvests: 1 });
  assert.equal(g.state.money, money, 'aucune pièce');
  assert.equal(JSON.stringify(g.state.plots), plots, 'aucune parcelle');
  assert.equal(JSON.stringify(g.state.career.stock), stock, 'rien au grenier');
  assert.equal(legend(g, 'motherMelon').cloche.state, 'free');
  assert.equal(A(g).harvestLegend('motherMelon').reason, 'Rien sous cette cloche.');
  A(g).sowLegend('motherMelon');
  A(g).triggerValley('legendRipe', 'motherMelon');
  const h2 = A(g).harvestLegend('motherMelon');
  assert.equal(h2.first, false);
  assert.equal(h2.harvests, 2);
  assert.match(h2.line, /récolté : la Grainothèque en garde les graines/);
  assert.equal(V(g).stats.legendHarvests, 2);
  assert.equal(V(g).legends.motherMelon.firstAt !== null, true);
});

test('une légende n\'existe ni pour le plan de culture, ni pour les semis aux champs (aucune variété, aucune parcelle)', () => {
  const g = stage8Career();
  A(g).triggerValley('library', 1);
  for (const x of LEGENDS) A(g).triggerValley('legend', x.id);
  const i = emptyPlots(g)[0];
  const rows = g.query.plantableCrops(i);
  for (const x of LEGENDS) assert.ok(!JSON.stringify(rows).includes(x.id), x.id);
  assert.equal(A(g).sowHeirloom(i, 'motherMelon').ok, false);
});

test('la Merveille : une génération par été, récolte à la main de la Tomate croisée sauvée (belle ou dorée ; toute qualité sans les surprises)', () => {
  const ext = withExtension();
  try {
    const g = v4Career();
    const api = ext.api();
    assert.ok(api, 'api capturée');
    assert.match(legend(g, 'farmMarvel').wakeText, /sauver la Tomate de la ferme/);
    A(g).triggerValley('fix', 'crossTomato');
    assert.match(legend(g, 'farmMarvel').wakeText, /0 \/ 3 générations/);
    toSeason(g, 1);
    const plant = () => {
      const i = emptyPlots(g).find((k) => !g.state.plots[k].cropId);
      const r = A(g).sowHeirloom(i, 'crossTomato');
      assert.equal(r.ok, true, r.reason);
      ripen(g, i);
      return i;
    };
    // Équipe : rien. Joueur, sans les surprises (qualité nulle) : + 1 génération, une seule par été.
    const ev = record(g);
    let i = plant();
    valleyHarvest(api, i, 'staff', { quality: 'gold' });
    assert.equal(V(g).marvel.gens, 0);
    i = plant();
    g.actions.harvest(i);
    assert.equal(V(g).marvel.gens, 1);
    assert.deepEqual(ev.of('marvelGeneration').map((e) => [e.n, e.need]), [[1, 3]]);
    i = plant();
    g.actions.harvest(i);
    assert.equal(V(g).marvel.gens, 1, 'une par été');
    toSeason(g, 2);
    toSeason(g, 1);
    i = plant();
    g.actions.harvest(i);
    assert.equal(V(g).marvel.gens, 2);
    toSeason(g, 2);
    toSeason(g, 1);
    i = plant();
    g.actions.harvest(i);
    assert.equal(V(g).marvel.gens, 3);
    ev.clear();
    nextDay(g);
    const aw = ev.of('legendAwoken');
    assert.deepEqual(aw.map((e) => e.id), ['farmMarvel']);
    assert.equal(aw[0].name, `La Merveille ${ofFarm(g.state.career.farmName)}`);
    const story = Q(g).valley().stories.find((s) => s.id === 'marvel');
    assert.equal(story.lines[1], `Elle ne ressemble plus à aucune autre : c'est la Merveille ${ofFarm(g.state.career.farmName)}.`);
    // Le nom suit le nom actuel de la ferme (jamais enregistré).
    g.state.career.farmName = 'Le Moulin';
    assert.equal(legend(g, 'farmMarvel').name, 'La Merveille du Moulin');
  } finally {
    ext.off();
  }
});

test('la Merveille avec les surprises : seulement une récolte belle ou dorée compte', () => {
  const ext = withExtension();
  try {
    const g = v4Career({ surprises: true });
    const api = ext.api();
    A(g).triggerValley('fix', 'crossTomato');
    toSeason(g, 1);
    const i = emptyPlots(g).find((k) => !g.state.plots[k].cropId);
    assert.equal(A(g).sowHeirloom(i, 'crossTomato').ok, true);
    ripen(g, i);
    const info = valleyHarvest(api, i, 'player', { quality: 'normal' });
    assert.ok(!info.events.some(([t]) => t === 'marvelGeneration'));
    assert.equal(V(g).marvel.gens, 0);
    const info2 = valleyHarvest(api, i, 'player', { quality: 'fine' });
    assert.deepEqual(info2.events.find(([t]) => t === 'marvelGeneration')[1], { n: 1, need: 3 });
    const info3 = valleyHarvest(api, i, 'player', { quality: 'gold' });
    assert.ok(!info3.events.some(([t]) => t === 'marvelGeneration'), 'une par été');
    // L'été suivant seulement ; jamais hors de l'été (la même parcelle, à l'automne).
    toSeason(g, 2);
    const info4 = valleyHarvest(api, i, 'player', { quality: 'gold' });
    assert.ok(info4 && !info4.events.some(([t]) => t === 'marvelGeneration'));
    assert.equal(V(g).marvel.gens, 1);
  } finally {
    ext.off();
  }
});

test('ancienne carrière riche : une légende par aube (melon, engrain, Merveille, pois) — aucune rafale', () => {
  const g = stage8Career();
  A(g).triggerValley('complete');
  V(g).marvel.gens = 3;
  for (const id of Object.keys(V(g).legends)) delete V(g).legends[id];
  const ev = record(g);
  const seen = [];
  for (let k = 0; k < 8; k++) {
    ev.clear();
    nextDay(g);
    const aw = ev.of('legendAwoken');
    assert.ok(aw.length <= 1);
    seen.push(...aw.map((e) => e.id));
  }
  assert.deepEqual(seen, ['motherMelon', 'millEinkorn', 'farmMarvel', 'storkPea']);
});

test('requête des légendes : forme du contrat (legendInfo)', () => {
  const g = stage7Career();
  const L = Q(g).valley().legends;
  assert.equal(L.length, 4);
  for (const x of L) {
    for (const k of ['id', 'name', 'sub', 'cropId', 'icon', 'state', 'wakeText', 'cloche', 'canSow', 'sowReason', 'harvests', 'anecdote', 'needLibrary']) assert.ok(k in x, `${x.id}.${k}`);
  }
  assert.deepEqual(L.find((x) => x.id === 'farmMarvel').gens, { n: 0, need: 3 });
  assert.equal(L.find((x) => x.id === 'storkPea').name, '?');
  assert.equal(L.find((x) => x.id === 'storkPea').cloche, null);
});
