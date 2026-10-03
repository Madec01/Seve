// La Vallée vivante (lot V1) — aménagements nature (emplacements, prix, rang, réserve), recettes d'habitat, venue d'une
// bête (indice → là → elle ATTEND qu'on la touche, sans limite de temps), services, indice unique, bêtes du jour, beauté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVAL, NATURE_SPOTS, SPECIES_BY_ID } from '../src/data/career/valley.js';
import { WINTER_RULES, LANTERN_RULES } from '../src/data/cozy.js';
import { habitatCounts, loneTreeStage, recipeStatus, speciesSpot, spotsOf, whereText } from '../src/core/career/habitat.js';
import { crowWeightFactor, fishFactor, growthBonusOf, qualityBonusOf, winterCoinsFactor, winterFindsMax, animalBonusOf, touristBonusOf, giantBonusOf } from '../src/core/career/heirlooms.js';
import { cozyLanterns } from '../src/core/cozy.js';
import { careerCozyHost } from '../src/core/career/cozy.js';
import { startedCareer, emptyPlots, nextDay, record, withExtension, toSeason, setRank } from './valley-helpers.js';

test('emplacements : haies sur chaque terrain possédé (sauf la maison), bande fleurie des champs, hôtel du champ de départ, chouette avec le grenier', () => {
  const g = startedCareer();
  const ids = spotsOf(g.state).map((x) => x.spotId);
  // (V2) Le nichoir à chauves-souris sous l'avant-toit de la maison (en fin de liste du terrain ; partie `heritage`).
  assert.deepEqual(ids, ['home.nest', 'home.bat', 'start.hedgeL', 'start.hedgeR', 'start.strip', 'start.hotel', 'yard.hedgeL', 'yard.hedgeR', 'yard.nest', 'yard.pile']);
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  assert.ok(spotsOf(g.state).some((x) => x.spotId === 'home.owl'));
  const lot = g.actions.career.buyLot();
  g.actions.career.developLot(lot.lotId, 'meadow');
  assert.deepEqual(spotsOf(g.state).filter((x) => x.lotId === lot.lotId).map((x) => x.slot), ['hedgeL', 'hedgeR', 'nest', 'pile', 'tree']);
  for (const [type, list] of Object.entries(NATURE_SPOTS)) if (type !== 'home') assert.ok(list.some((d) => d.slot === 'hedgeL'), type);
  const spots = g.query.career.valleySpots('hedge');
  assert.equal(spots.find((x) => x.spotId === 'start.hedgeL').placed, 'hedge');
  assert.equal(spots.find((x) => x.spotId === 'start.hedgeR').label, 'Le champ de départ, côté droit');
  assert.equal(whereText(g.state, 'yard.pile'), 'près du tas de bois de la basse-cour');
  assert.deepEqual(g.query.career.lot('yard').nature.map((x) => x.slot), ['hedgeL', 'hedgeR', 'nest', 'pile']);
});

test('poser un aménagement : prix croissants (haie 120 + 40 × n, au plus 600), rang, grenier, refus', () => {
  const g = startedCareer();
  const A = g.actions.career;
  const ev = record(g);
  assert.equal(A.placeNature('nope.x').reason, 'Emplacement inconnu.');
  assert.equal(A.placeNature('start.hedgeL').reason, 'Déjà aménagé.');
  assert.equal(A.placeNature('start.hedgeR', 'woodpile').reason, 'Cet aménagement ne va pas ici.');
  const a = A.placeNature('start.hedgeR');
  assert.deepEqual([a.ok, a.kind, a.cost, a.fromReserve], [true, 'hedge', 120, false]);
  assert.equal(A.placeNature('yard.hedgeL').cost, 160);
  assert.equal(ev.of('naturePlaced').length, 2);
  g.state.career.valley.bought.hedge = 20;
  assert.equal(g.query.career.valleySpots('hedge').find((x) => x.free).price, 600);
  // Chêne et berges : rang 3 ; nichoir à chouette : le grenier.
  const lot = A.buyLot();
  A.developLot(lot.lotId, 'meadow');
  assert.equal(A.placeNature(`${lot.lotId}.tree`).reason, 'Rang 3 requis');
  setRank(g, 3);
  assert.ok(A.placeNature(`${lot.lotId}.tree`).ok);
  assert.equal(A.placeNature('home.owl').reason, 'Construisez d\'abord le grenier.');
  g.state.money = 3;
  assert.match(A.placeNature('yard.nest').reason, /Pas assez d'argent/);
  const info = g.query.career.valley().nature.items.find((x) => x.kind === 'reeds');
  assert.equal(info.locked, true);
});

test('réaménager un terrain : les haies restent, le reste va à la réserve (à replacer gratuitement)', () => {
  const g = startedCareer({}, 3);
  const A = g.actions.career;
  const lot = A.buyLot();
  A.developLot(lot.lotId, 'meadow');
  A.placeNature(`${lot.lotId}.hedgeL`);
  A.placeNature(`${lot.lotId}.pile`);
  A.placeNature(`${lot.lotId}.tree`);
  const ev = record(g);
  const r = A.developLot(lot.lotId, 'field');
  assert.ok(r.ok);
  assert.deepEqual(r.natureReserved.sort(), ['loneTree', 'woodpile']);
  assert.deepEqual(ev.of('natureReserved')[0].kinds.sort(), ['loneTree', 'woodpile']);
  const v = g.state.career.valley;
  assert.ok(v.nature[`${lot.lotId}.hedgeL`]);
  assert.equal(v.nature[`${lot.lotId}.pile`], undefined);
  assert.deepEqual(v.reserve, { woodpile: 1, loneTree: 1 });
  const free = A.placeNature('yard.pile');
  assert.deepEqual([free.cost, free.fromReserve], [0, true]);
  assert.equal(v.reserve.woodpile, undefined);
});

test('recettes d\'habitat : lignes cochées ; jachère = friche et coin fleuri ; variété mellifère en pousse = coin fleuri', () => {
  const g = startedCareer();
  const r = recipeStatus(g.state, 'robin');
  assert.deepEqual(r.items.map((x) => [x.kind, x.n, x.have, x.ok, x.text]), [['hedge', 1, 1, true, '1 haie'], ['woodpile', 1, 0, false, '1 tas de bois']]);
  assert.equal(r.ok, false);
  const i = emptyPlots(g)[0];
  g.actions.career.sowFallow(i);
  let c = habitatCounts(g.state);
  assert.deepEqual([c.wildGround, c.flowers], [1, 1]);
  g.actions.career.triggerValley('seeds', 'reineDesVallees', 2);
  g.actions.career.sowHeirloom(emptyPlots(g).find((k) => k !== i), 'reineDesVallees');
  c = habitatCounts(g.state);
  assert.equal(c.flowers, 2);
  assert.ok(c.cropsGrowing >= 1);
  const q = g.query.career.valley().species.find((s) => s.id === 'robin');
  assert.deepEqual([q.state, q.recipeOk, q.seasonsText], ['unknown', false, 'toute l\'année']);
});

test('venue : recette remplie → indice ; là au plus tard 3 aubes après ; elle ATTEND qu\'on la touche (même quand la saison change)', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.placeNature('yard.pile');
  let guard = 0;
  while (!g.state.career.valley.species.robin && guard++ < 60) nextDay(g);
  const hint = ev.of('speciesHint')[0];
  assert.deepEqual([hint.id, hint.spotId], ['robin', 'yard.pile']);
  assert.equal(g.state.career.valley.species.robin.state, 'hint');
  assert.deepEqual(g.query.career.valleyAnimals(), [{ id: 'robin', spotId: 'yard.pile', state: 'hint', hintIcon: 'wild.hint.note' }]);
  for (let k = 0; k < ARRIVAL.maxWait - 1; k++) {
    if (g.state.career.valley.species.robin.state === 'visible') break;
    nextDay(g);
  }
  assert.equal(g.state.career.valley.species.robin.state, 'visible');
  assert.equal(ev.of('speciesVisible')[0].where, 'près du tas de bois de la basse-cour');
  assert.equal(g.query.career.valley().hint.kind, 'observe');
  // Sans limite de temps : deux saisons plus tard, elle est toujours là.
  for (let k = 0; k < 2 * g.state.career.seasonLength; k++) nextDay(g);
  assert.equal(g.state.career.valley.species.robin.state, 'visible');
  assert.equal(g.actions.career.observe('hedgehog').reason, 'Rien à observer ici.');
  const r = g.actions.career.observe('robin');
  assert.deepEqual([r.ok, r.name, r.first, r.service.kind], [true, 'Rouge-gorge', true, 'winterFinds']);
  assert.equal(ev.of('speciesInstalled')[0].anecdote, SPECIES_BY_ID.robin.anecdote);
  assert.equal(g.actions.career.observe('robin').reason, 'Déjà installé.');
  assert.equal(g.query.career.valley().species.find((s) => s.id === 'robin').firstMet, 'Vous l\'avez déjà vu à la mangeoire.');
});

test('une seule nouvelle venue annoncée par aube ; personne ne s\'installe sans le toucher du joueur', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.placeNature('yard.pile');
  g.actions.career.placeNature('start.hedgeR');
  for (let k = 0; k < 40; k++) nextDay(g);
  const days = ev.of('speciesHint').map(() => 1);
  assert.ok(days.length >= 2, 'rouge-gorge et hérisson annoncés');
  const perDawn = {};
  let day = 0;
  for (const e of ev.events) {
    if (e.type === 'dawn') day++;
    if (e.type === 'speciesHint') perDawn[day] = (perDawn[day] || 0) + 1;
  }
  assert.ok(Object.values(perDawn).every((n) => n === 1));
  assert.ok(Object.values(g.state.career.valley.species).every((s) => s.state !== 'installed'));
});

test('services des habitants installés (et seulement eux)', () => {
  const g = startedCareer();
  const s = g.state;
  assert.equal(winterFindsMax(s, WINTER_RULES.maxFinds), 3);
  for (const id of ['robin', 'hedgehog', 'ladybird', 'bumblebee', 'butterfly', 'swallow', 'tawnyOwl', 'frog', 'dragonfly', 'hare', 'squirrel']) g.actions.career.triggerValley('install', id);
  assert.equal(winterFindsMax(s, WINTER_RULES.maxFinds), 4);
  assert.equal(winterCoinsFactor(s), 2);
  assert.equal(crowWeightFactor(s), 0.5);
  assert.equal(fishFactor(s), 1.25);
  assert.equal(touristBonusOf(s), 0.15);
  assert.equal(giantBonusOf(s), 0.015);
  assert.equal(animalBonusOf(s), 0.05, 'printemps');
  assert.equal(growthBonusOf(s), 0.03, 'bourdons, pas de pluie');
  s.weather.today = 'rain';
  assert.ok(Math.abs(growthBonusOf(s) - 0.13) < 1e-9, 'bourdons + grenouilles les jours de pluie');
  const q = qualityBonusOf(s, s.plots[0], true);
  assert.ok(Math.abs(q.fine - 0.02) < 1e-9, 'hérisson (à la main) + coccinelles');
  assert.ok(Math.abs(qualityBonusOf(s, s.plots[0], false).fine - 0.01) < 1e-9, 'coccinelles seulement pour l\'équipe');
  assert.ok(g.query.career.valley().services.length >= 11);
});

test('le prochain indice (un seul) : bête à voir, chapitre, bocal, planche mûre, (rien de semé : graines), recette, graines, étape', () => {
  const g = startedCareer();
  const Q = () => g.query.career.valley().hint;
  assert.equal(Q().kind, 'chapter');
  g.actions.career.readChapter(0);
  g.actions.career.triggerValley('jar', 'carrot');
  assert.equal(Q().kind, 'jar');
  g.actions.career.openJar();
  const i = emptyPlots(g)[0];
  g.actions.career.sowHeirloom(i, 'bouleDOr');
  g.state.plots[i].growth = 99;
  assert.deepEqual([Q().kind, Q().target], ['trial', { type: 'plot', id: i }]);
  g.actions.harvest(i);
  // Rien de semé : semer passe avant les recettes ; une planche en terre, la recette revient.
  assert.equal(Q().kind, 'seeds');
  g.actions.career.sowHeirloom(Q().target.id, 'bouleDOr');
  assert.equal(Q().kind, 'recipe');
  assert.deepEqual(Q().target, { type: 'nature', id: 'woodpile' });
  g.actions.career.triggerValley('visible', 'robin');
  assert.deepEqual(Q().target, { type: 'species', id: 'robin' });
});

test('bêtes du jour : indices, bêtes à voir, habitants en promenade (6 au plus, sans tirage)', () => {
  const g = startedCareer();
  for (const id of ['robin', 'hedgehog', 'ladybird', 'bumblebee', 'tawnyOwl', 'hare', 'frog', 'swallow']) g.actions.career.triggerValley('install', id);
  const rng = g.state.rng.valley;
  const a = g.query.career.valleyAnimals();
  assert.equal(g.state.rng.valley, rng);
  assert.ok(a.filter((x) => x.state === 'resident').length <= 6);
  assert.deepEqual(g.query.career.valleyAnimals(), a, 'même jour, même réponse');
  assert.ok(a.every((x) => typeof x.spotId === 'string'));
});

test('arbre isolé : jeune plant, jeune arbre (1 saison), chêne adulte (2 saisons) — le geai l\'attend', () => {
  const g = startedCareer({}, 3);
  const lot = g.actions.career.buyLot();
  g.actions.career.developLot(lot.lotId, 'meadow');
  g.actions.career.placeNature(`${lot.lotId}.tree`);
  const n = () => g.state.career.valley.nature[`${lot.lotId}.tree`];
  assert.equal(loneTreeStage(g.state, n()), 'sapling');
  toSeason(g, 1);
  assert.equal(loneTreeStage(g.state, n()), 'young');
  toSeason(g, 2);
  assert.equal(loneTreeStage(g.state, n()), 'adult');
  assert.equal(habitatCounts(g.state).oakAdult, 1);
  assert.equal(speciesSpot(g.state, 'jay'), `${lot.lotId}.tree`);
});

test('lanternes (beauté, carrière) : + 1 par aménagement nature (6 au plus), + 1 avec le paon-du-jour', () => {
  const t = withExtension();
  try {
    const g = startedCareer({ cozy: true });
    const host = careerCozyHost(t.api());
    const base = cozyLanterns(host, {}).criteria.find((c) => c.id === 'beauty').value;
    for (const spot of ['start.hedgeR', 'yard.hedgeL', 'yard.hedgeR', 'yard.pile', 'yard.nest', 'start.strip', 'start.hotel', 'home.nest']) g.actions.career.placeNature(spot);
    const after = cozyLanterns(host, {}).criteria.find((c) => c.id === 'beauty').value;
    assert.equal(after - base, LANTERN_RULES.career.beautyPoints.natureMax - 1, 'la haie offerte comptait déjà');
    g.actions.career.triggerValley('install', 'butterfly');
    assert.equal(cozyLanterns(host, {}).criteria.find((c) => c.id === 'beauty').value - after, 1);
  } finally {
    t.off();
  }
});
