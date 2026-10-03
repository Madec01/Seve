// La Vallée vivante (lot V2 « Le troc et les croisements ») — données, activation, panneau et récits, Grainothèque
// (5 niveaux, refus, effets, patrimoine), trait Parfumée, traits en liste, 4 habitants du V2 (flux valley2, services),
// nichoir à chauves-souris, stand de la fête, « Revoir la boîte », bilan, progression (album, succès).
// Contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 » ; règles : docs/VALLEE.md § 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/core/career/career.js';
import { careerExtensions } from '../src/core/career/registry.js';
import { patrimony } from '../src/core/career/ranks.js';
import { nextFloat } from '../src/core/rng.js';
import {
  ALL_SPECIES, ALL_VARIETIES, ALL_VARIETIES_BY_ID, NATURE_ITEMS_BY_ID, SIGNS_ALL, SPECIES, TRAITS_BY_ID, VARIETIES, VARIETY_OF_CROP,
  VALLEY_VERSION, varietyTraits, STAGES, STAGE_SIGNS_V2, stageSigns,
} from '../src/data/career/valley.js';
import {
  CROSSES, CROSS_RULES, HERITAGE_HINTS, LIBRARY_MAX, SEED_LIBRARY, SPECIES_V2, STORIES, TROC, VILLAGE_VARIETIES, crossName, ofFarm,
} from '../src/data/career/heritage.js';
import { CLIENTS } from '../src/data/variety.js';
import { ALBUM_PAGES_BY_ID } from '../src/data/album.js';
import { HERITAGE_ACHIEVEMENTS, ALL_ACHIEVEMENTS } from '../src/data/achievements.js';
import { getCosmetic } from '../src/data/cosmetics.js';
import { STAND_POINTS } from '../src/data/cozy.js';
import * as P from '../src/core/progression.js';
import {
  fixedSeedCost, growthBonusOf, handSeedsOf, hasTrait, hedgeFindsMaxOf, libraryEffectsOf, scentedFactorOf, staffNeverTiredOf, touristBonusOf,
  traitOf, traitsOf,
} from '../src/core/career/heirlooms.js';
import { habitatCounts, recipeStatus, speciesSpot, spotsOf } from '../src/core/career/habitat.js';
import { moodOf } from '../src/core/career/staff.js';
import { newLot } from './career-crew-helpers.js';
import { emptyPlots, nextDay, record, ripen, setRank, startedCareer, toSeason, valleyCareer } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

test('données : 12 variétés du village, 11 croisées (traits distincts des deux parents), 4 habitants, 4 récits, 5 niveaux (58 000), 51 signes de vie', () => {
  assert.equal(VILLAGE_VARIETIES.length, 12);
  assert.equal(new Set(VILLAGE_VARIETIES.map((x) => x.cropId)).size, 12, 'une par culture');
  assert.equal(new Set(VILLAGE_VARIETIES.map((x) => x.clientId)).size, 12, 'une par client du tableau');
  assert.deepEqual([...VILLAGE_VARIETIES.map((x) => x.clientId)].sort(), CLIENTS.map((c) => c.id).sort());
  for (const x of VILLAGE_VARIETIES) {
    assert.ok(x.anecdote.length <= 110, x.id);
    assert.ok(TRAITS_BY_ID[x.trait], x.id);
    assert.notEqual(x.trait, ALL_VARIETIES_BY_ID[VARIETY_OF_CROP[x.cropId]].trait, `${x.id} : trait différent de la variété du pays`);
    assert.match(x.label, /^De la part de /);
  }
  assert.equal(CROSSES.length, 11);
  assert.ok(!CROSSES.some((c) => c.cropId === 'apple'), 'pas de croisement de pommier');
  for (const c of CROSSES) {
    const [pays, village] = c.parents.map((id) => ALL_VARIETIES_BY_ID[id]);
    assert.equal(pays.group, 'pays');
    assert.equal(village.group, 'village');
    assert.equal(pays.cropId, c.cropId);
    assert.equal(village.cropId, c.cropId);
    assert.deepEqual([...c.traits].sort(), [pays.trait, village.trait].sort(), `${c.id} : les deux traits des parents`);
    assert.equal(new Set(c.traits).size, 2);
    assert.ok(c.text.length <= 110, c.id);
    assert.equal(c.id, `cross${c.cropId.charAt(0).toUpperCase()}${c.cropId.slice(1)}`);
  }
  // (V3) + la Reinette grise (à la fin) : 36.
  assert.equal(ALL_VARIETIES.length, 36);
  assert.equal(new Set(ALL_VARIETIES.map((x) => x.id)).size, 36);
  assert.deepEqual(ALL_VARIETIES.slice(0, 12), VARIETIES, 'les 12 du pays en tête, inchangées');
  assert.deepEqual(varietyTraits('crossTomato'), ['fine', 'tasty']);
  assert.deepEqual(varietyTraits('bouleDOr'), ['early']);
  // Parfumée sur le blé barbu, la fraise Moutot, l'Api étoilé et deux croisées.
  assert.deepEqual(ALL_VARIETIES.filter((x) => varietyTraits(x).includes('scented')).map((x) => x.id), ['barbuDuRoussillon', 'madameMoutot', 'apiEtoile', 'crossWheat', 'crossStrawberry']);
  assert.equal(TRAITS_BY_ID.scented.product, 0.15);
  assert.deepEqual(SPECIES_V2.map((s) => s.id), ['wildBee', 'blackbird', 'lizard', 'bat']);
  // (V3) + les 10 habitants de la vallée (à la fin) : 26 ; SIGNS_ALL reste celui du V2.
  assert.equal(ALL_SPECIES.length, 26);
  assert.deepEqual(ALL_SPECIES.slice(0, 12).map((s) => s.id), SPECIES.map((s) => s.id));
  assert.equal(SIGNS_ALL, 51);
  assert.deepEqual(STORIES.map((s) => s.id), ['heritage0', 'heritage1', 'heritage2', 'heritage3']);
  assert.ok(STORIES.every((s) => s.lines.length === 3));
  assert.equal(LIBRARY_MAX, 5);
  assert.deepEqual(SEED_LIBRARY.levels.map((L) => L.rank), [3, 4, 5, 5, 6]);
  const total = SEED_LIBRARY.levels.reduce((s, L) => s + L.price, 0);
  assert.ok(total >= 46000 && total <= 70000, `total ${total} dans les leviers du § 16.12.6`);
  assert.equal(TROC.order.length, 12);
  assert.deepEqual(TROC.order.map((o) => o.circle), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  assert.equal(CROSS_RULES.need, 3, 'décision de l\'utilisateur : 3 rencontres');
  assert.equal(NATURE_ITEMS_BY_ID.batbox.rank, 4);
  assert.deepEqual(NATURE_ITEMS_BY_ID.batbox.price, { base: 100, step: 50 });
  assert.equal(VALLEY_VERSION, 3);
  for (const k of ['valley.library', 'valley.troc', 'valley.pair', 'valley.cross', 'valley.scented']) assert.ok(HERITAGE_HINTS[k], k);
});

test('nom des croisées : « de la Ferme des Tilleuls », « du Moulin », « de Chez Martin », « d\'Arcy »', () => {
  assert.equal(ofFarm('Ferme des Tilleuls'), 'de la Ferme des Tilleuls');
  assert.equal(ofFarm('Le Moulin'), 'du Moulin');
  assert.equal(ofFarm('Les Saules'), 'des Saules');
  assert.equal(ofFarm('La Combe'), 'de la Combe');
  assert.equal(ofFarm('L\'Orée'), 'de l\'Orée');
  assert.equal(ofFarm('Chez Martin'), 'de Chez Martin');
  assert.equal(ofFarm('Arcy'), 'd\'Arcy');
  assert.equal(ofFarm('Bergerie du Haut'), 'de la Bergerie du Haut');
  assert.equal(crossName('crossTomato', 'Ferme des Tilleuls'), 'Tomate de la Ferme des Tilleuls');
  assert.equal(crossName('crossPotato', 'Chez Martin'), 'Pomme de terre de Chez Martin');
  // Le nom suit le nom actuel de la ferme (calculé, jamais enregistré).
  const g = startedCareer({}, 3);
  A(g).triggerValley('cross', 'tomato');
  const name = () => Q(g).valley().varieties.find((x) => x.id === 'crossTomato').name;
  assert.equal(name(), `Tomate ${ofFarm(g.state.career.farmName)}`);
  g.state.career.farmName = 'Le Moulin';
  assert.equal(name(), 'Tomate du Moulin');
  assert.ok(!JSON.stringify(g.state.career.valley).includes('Moulin'));
});

test('activation : partie heritage (absente = vraie) ; { heritage: false } = le V1 (aucun champ du V2 dans les requêtes, aucun flux valley2)', () => {
  const g = createCareer({ seed: 3 });
  assert.deepEqual(g.state.career.valley.parts, { seeds: true, wildlife: true, heritage: true, places: true });
  assert.ok(Number.isInteger(g.state.rng.valley2));
  const off = createCareer({ seed: 3, valley: { heritage: false } });
  assert.deepEqual(off.state.career.valley.parts, { seeds: true, wildlife: true, heritage: false, places: false });
  assert.equal(off.state.rng.valley2, undefined);
  const v1 = startedCareer({ valley: { heritage: false } }, 3);
  const q = Q(v1).valley();
  assert.equal(q.heritage, false);
  assert.equal(q.library, undefined);
  assert.equal(q.varieties.length, 12);
  assert.equal(q.species.length, 12);
  assert.equal(q.stage.total, 24);
  assert.ok(!q.nature.items.some((x) => x.kind === 'batbox'));
  assert.ok(!spotsOf(v1.state).some((x) => x.kind === 'batbox'));
  assert.equal(v1.state.career.valley.site, false, 'pas de panneau');
  assert.equal(A(v1).buildSeedLibrary().reason, 'Grainothèque désactivée.');
  assert.equal(A(v1).sowHeirloom(0, 'carotteViolette').reason, 'Variété inconnue.');
  assert.equal(A(v1).placeNature('home.bat', 'batbox').reason, 'Emplacement inconnu.');
  // Avec le V2 : 35 variétés, 16 habitants, 51 signes.
  const v2 = startedCareer({ valley: { places: false } }, 3);
  const q2 = Q(v2).valley();
  assert.equal(q2.heritage, true);
  assert.equal(q2.varieties.length, 35);
  assert.equal(q2.species.length, 16);
  assert.equal(q2.stage.total, 51);
  assert.equal(q2.varieties.find((x) => x.id === 'crossCarrot').name, '?', 'croisée inconnue : « ? »');
  assert.equal(q2.varieties.find((x) => x.id === 'carotteViolette').name, 'Carotte', 'variété inconnue : le nom de la culture');
  assert.match(q2.varieties.find((x) => x.id === 'carotteViolette').hint, /Lili/);
});

test('panneau et récit « Une idée de Joseph » : première aube au rang 3 (Vallée commencée), une seule fois', () => {
  const g = startedCareer({}, 2);
  const ev = record(g);
  nextDay(g);
  assert.equal(g.state.career.valley.site, false);
  setRank(g, 3);
  nextDay(g);
  assert.equal(g.state.career.valley.site, true);
  assert.deepEqual(ev.of('storyAvailable').map((e) => e.id), ['heritage0']);
  assert.deepEqual(g.state.career.valley.stories, { available: ['heritage0'], read: [] });
  nextDay(g);
  assert.equal(ev.of('storyAvailable').length, 1);
  const lib = Q(g).valley().library;
  assert.deepEqual([lib.level, lib.site, lib.vignette, lib.next.level, lib.next.price, lib.next.canBuild], [0, true, 'library.site', 1, SEED_LIBRARY.levels[0].price, true]);
  // Le récit attend d'être lu (indice), relisible ensuite.
  assert.equal(Q(g).valley().hint.kind === 'chapter' || Q(g).valley().hint.kind === 'story', true);
  assert.equal(A(g).readStory('nope').reason, 'Récit inconnu.');
  assert.equal(A(g).readStory('heritage2').reason, 'Récit inconnu.', 'pas encore disponible');
  const r = A(g).readStory('heritage0');
  assert.deepEqual([r.ok, r.story.title, r.story.lines.length, r.story.vignette], [true, 'Une idée de Joseph', 3, 'story.library']);
  assert.deepEqual(g.state.career.valley.stories.read, ['heritage0']);
  assert.ok(Q(g).valley().stories.find((s) => s.id === 'heritage0').read);
});

test('Grainothèque : 5 niveaux, rangs, argent, plus haut ; dépense de la Vallée comptée à 100 % au patrimoine ; récits des niveaux 1 et 5', () => {
  const g = startedCareer({}, 2);
  const ev = record(g);
  assert.equal(A(g).buildSeedLibrary().reason, 'Rang 3 requis');
  setRank(g, 3);
  g.state.money = 100;
  assert.match(A(g).buildSeedLibrary().reason, /^Pas assez d'argent/);
  g.state.money = 200000;
  const before = patrimony(g.state);
  const spent0 = g.state.career.valley.spent;
  const r1 = A(g).buildSeedLibrary();
  assert.deepEqual([r1.ok, r1.level, r1.name, r1.cost, r1.story], [true, 1, 'La remise aux graines', SEED_LIBRARY.levels[0].price, 'heritage1']);
  assert.equal(g.state.career.valley.spent - spent0, SEED_LIBRARY.levels[0].price);
  assert.equal(patrimony(g.state), before, 'argent → patrimoine de la Vallée (100 %)');
  assert.equal(g.state.career.yearStats.spentBy.valley >= SEED_LIBRARY.levels[0].price, true);
  assert.deepEqual(ev.of('seedLibraryBuilt').map((e) => e.level), [1]);
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'heritage1'));
  assert.equal(A(g).buildSeedLibrary().reason, 'Rang 4 requis');
  setRank(g, 4);
  assert.equal(A(g).buildSeedLibrary().level, 2);
  assert.equal(A(g).buildSeedLibrary().reason, 'Rang 5 requis');
  setRank(g, 5);
  assert.equal(A(g).buildSeedLibrary().level, 3);
  assert.equal(A(g).buildSeedLibrary().level, 4);
  assert.equal(A(g).buildSeedLibrary().reason, 'Rang 6 requis');
  setRank(g, 6);
  const r5 = A(g).buildSeedLibrary();
  assert.deepEqual([r5.level, r5.story], [5, 'heritage3']);
  assert.equal(A(g).buildSeedLibrary().reason, 'La grainothèque est déjà au plus haut.');
  assert.equal(g.state.career.valley.spent - spent0, SEED_LIBRARY.levels.reduce((s, L) => s + L.price, 0));
  assert.deepEqual(g.state.career.valley.library.level, 5);
  const lib = Q(g).valley().library;
  assert.deepEqual([lib.level, lib.name, lib.vignette, lib.next], [5, 'La grainothèque vivante', 'library.5', null]);
  assert.equal(lib.effects.length, 7, 'les lignes du troc des niveaux 1 à 3 se résument en une');
  assert.equal(lib.effects.filter((t) => /^Troc/.test(t)).length, 1);
  assert.match(lib.effects[0], /les 12 voisins/);
  // Déblocages des rangs : la Grainothèque au rang 3, le nichoir à chauves-souris au rang 4.
  const ext = careerExtensions().find((e) => e.id === 'valley');
  assert.ok(ext.providers.unlocks(3).some((u) => u.kind === 'valley' && u.id === 'seedLibrary'));
  assert.ok(ext.providers.unlocks(4).some((u) => u.kind === 'nature' && u.id === 'batbox'));
  // Avant le début de la Vallée : refus.
  const r = valleyCareer({}, 1);
  assert.equal(A(r).buildSeedLibrary().reason, 'La Vallée commence au rang 2.');
});

test('effets cumulés des niveaux : 3 graines (N2), fixation en 5 (N3), croisement en 2 (N4), graines au prix normal et touristes + 15 % (N5)', () => {
  const g = startedCareer({}, 6);
  const fx = () => libraryEffectsOf(g.state);
  assert.deepEqual(fx(), { level: 0, circle: 0, handSeeds: 2, fixHand: 7, crossNeed: 3, fixedSeedFactor: 1.25, touristBonus: 0 });
  A(g).triggerValley('library', 1);
  assert.deepEqual([fx().circle, fx().handSeeds], [1, 2]);
  A(g).triggerValley('library', 2);
  assert.deepEqual([fx().circle, fx().handSeeds, handSeedsOf(g.state), handSeedsOf(g.state, true)], [2, 3, 3, 1]);
  A(g).triggerValley('library', 3);
  assert.deepEqual([fx().circle, fx().fixHand], [3, 5]);
  A(g).triggerValley('library', 4);
  assert.equal(fx().crossNeed, 2);
  assert.equal(fixedSeedCost(8, g.state), 10);
  const t0 = touristBonusOf(g.state);
  A(g).triggerValley('library', 5);
  assert.deepEqual([fx().fixedSeedFactor, fx().touristBonus], [1, 0.15]);
  assert.equal(fixedSeedCost(8, g.state), 8);
  assert.ok(Math.abs(touristBonusOf(g.state) - t0 - 0.15) < 1e-9);
  // Récolte à la main au niveau 2 : 3 graines ; une variété qui a déjà 5 récoltes est sauvée à la prochaine (niveau 3).
  const h = startedCareer({}, 5);
  A(h).triggerValley('library', 2);
  const [i] = emptyPlots(h);
  assert.ok(A(h).sowHeirloom(i, 'bouleDOr').ok);
  ripen(h, i);
  assert.equal(h.actions.harvest(i).seeds, 3);
  h.state.career.valley.varieties.bouleDOr.hand = 5;
  A(h).triggerValley('library', 3);
  assert.equal(h.state.career.valley.varieties.bouleDOr.fixedAt, null, 'aucune fixation « en silence »');
  assert.ok(A(h).sowHeirloom(i, 'bouleDOr').ok);
  ripen(h, i);
  const r = h.actions.harvest(i);
  assert.equal(r.fixed, true);
  assert.equal(Q(h).valley().varieties.find((x) => x.id === 'bouleDOr').need, 5);
});

test('traits en liste : traitsOf / hasTrait ; une croisée a ses deux traits (précoce + savoureuse) ; traitOf = le premier', () => {
  const g = startedCareer({}, 3);
  const plot = { variety: 'crossTurnip', cropId: 'turnip', env: 'field' };
  assert.deepEqual(traitsOf(plot).map((t) => t.id), ['early', 'tasty']);
  assert.equal(traitOf(plot).id, 'early');
  assert.ok(hasTrait(g.state, plot, 'early') && hasTrait(g.state, plot, 'tasty') && !hasTrait(g.state, plot, 'fine'));
  assert.equal(hasTrait({ mode: 'levels' }, plot, 'early'), false, 'sans la Vallée : rien');
  // Parfumée : × 1,15 ; sinon 1.
  assert.equal(scentedFactorOf(g.state, { variety: 'madameMoutot', cropId: 'strawberry' }), 1.15);
  assert.equal(scentedFactorOf(g.state, { variety: 'reineDesVallees', cropId: 'strawberry' }), 1);
});

test('Parfumée : une fraise Madame Moutot qui part à l\'atelier de confitures a un rendement × 1,15', () => {
  const run = (variety) => {
    const g = createCareer({ seed: 7, surprises: false, variety: false, cozy: false, valley: true });
    g.state.weather.today = 'sunny';
    g.state.money = 1e6;
    setRank(g, 4);
    nextDay(g);
    const shops = newLot(g, 'workshops');
    assert.ok(A(g).build(shops, 0, 'jamWorkshop').ok);
    const p = g.state.plots[0];
    p.cropId = 'strawberry';
    p.growth = 99;
    if (variety) {
      p.variety = variety;
      A(g).triggerValley('seeds', variety, 1);
    }
    const r = g.actions.harvest(0);
    assert.equal(r.processed?.buildingId, 'jamWorkshop');
    return g.state.processing.jamWorkshop.places[0].yieldFactor;
  };
  const base = run(null);
  const scented = run('madameMoutot');
  assert.ok(Math.abs(scented / base - 1.15) < 1e-9, `${scented} / ${base}`);
});

test('habitants du V2 : recettes, saisons, emplacements ; flux valley2 (4 nombres par aube, rien d\'autre) ; une seule venue par aube toutes espèces confondues', () => {
  const g = startedCareer({}, 4);
  const v = g.state.career.valley;
  // Le flux valley2 avance de 4 nombres par aube.
  const h0 = { x: g.state.rng.valley2 };
  const v1 = g.state.rng.valley;
  nextDay(g);
  for (let k = 0; k < 4; k++) nextFloat(h0, 'x');
  assert.equal(g.state.rng.valley2, h0.x);
  assert.notEqual(g.state.rng.valley, v1, 'le flux du V1 tire toujours ses 12 nombres');
  // Recettes.
  assert.deepEqual(recipeStatus(g.state, 'wildBee').items.map((r) => [r.kind, r.n]), [['insectHotel', 2], ['flowers', 3]]);
  assert.deepEqual(recipeStatus(g.state, 'bat').items.map((r) => [r.kind, r.n]), [['batbox', 1], ['pond', 1]]);
  assert.equal(habitatCounts(g.state).batbox, 0);
  assert.ok(A(g).placeNature('home.bat', 'batbox').ok);
  assert.equal(habitatCounts(g.state).batbox, 1);
  assert.equal(speciesSpot(g.state, 'bat'), 'home.bat');
  // Observer une espèce du V2 (comme au V1).
  A(g).triggerValley('visible', 'lizard');
  const ev = record(g);
  const r = A(g).observe('lizard');
  assert.deepEqual([r.ok, r.welcome], [true, 'Bienvenue, petit lézard !']);
  assert.equal(ev.of('speciesInstalled')[0].id, 'lizard');
  assert.equal(A(g).observe('lizard').reason, 'Déjà installé.');
  assert.equal(v.species.lizard.state, 'installed');
  assert.ok(Q(g).valley().installed.includes('lizard'));
  // Une seule venue annoncée par aube : recettes du V1 et du V2 remplies, au plus un indice par aube.
  const h = startedCareer({}, 6);
  for (const id of ['start.hotel']) A(h).placeNature(id);
  h.state.career.valley.species = {};
  let maxHints = 0;
  const evh = record(h);
  for (let d = 0; d < 40; d++) {
    const n0 = evh.of('speciesHint').length;
    nextDay(h);
    maxHints = Math.max(maxHints, evh.of('speciesHint').length - n0);
  }
  assert.ok(maxHints <= 1);
});

test('services du V2 : osmie (rencontre double), merle (4 trouvailles des haies), lézard (canicule + 10 %), pipistrelle (équipe jamais lasse l\'été)', () => {
  const g = startedCareer({}, 4);
  for (const id of ['wildBee', 'blackbird', 'lizard', 'bat']) A(g).triggerValley('install', id);
  assert.equal(hedgeFindsMaxOf(g.state, 3), 4);
  g.state.weather.today = 'heatwave';
  const hot = growthBonusOf(g.state);
  g.state.weather.today = 'sunny';
  assert.ok(Math.abs(hot - growthBonusOf(g.state) - 0.1) < 1e-9);
  // Pipistrelle : l'été seulement.
  g.state.time.seasonIndex = 1;
  assert.equal(staffNeverTiredOf(g.state), true);
  const s = { streak: 99, joyUntilDay: 0 };
  assert.equal(moodOf(g.state, s), 'content');
  g.state.time.seasonIndex = 2;
  assert.equal(staffNeverTiredOf(g.state), false);
  assert.equal(moodOf(g.state, s), 'tired');
  // Merle : la cueillette des haies peut monter à 4 (débogage, sans tirage).
  setRank(g, 4);
  A(g).triggerValley('finds');
  assert.equal(g.state.career.valley.finds.length, 4);
  assert.equal(Q(g).valley().finds.length, 4);
});

test('nichoir à chauves-souris : emplacements sous l\'avant-toit (maison, ateliers) et dans un vieux pommier (verger) ; rang 4 ; 100 + 50 × n', () => {
  const g = startedCareer({}, 3);
  assert.equal(A(g).placeNature('home.bat', 'batbox').reason, 'Rang 4 requis');
  setRank(g, 4);
  const shops = newLot(g, 'workshops');
  const orch = newLot(g, 'orchard');
  const ids = spotsOf(g.state, 'batbox').map((x) => x.spotId);
  assert.deepEqual(ids, ['home.bat', `${shops}.bat`, `${orch}.bat`]);
  assert.equal(A(g).placeNature('home.bat').cost, 100);
  assert.equal(A(g).placeNature(`${shops}.bat`).cost, 150);
  assert.equal(Q(g).valleySpots('batbox').find((x) => x.spotId === `${orch}.bat`).price, 200);
  assert.ok(Q(g).valley().nature.items.some((x) => x.kind === 'batbox' && x.placed === 2));
});

test('stand de la fête des récoltes : + 1 point par culture dont une variété ancienne a été récoltée cette année', () => {
  assert.equal(STAND_POINTS.heirloom, 1);
  const g = startedCareer({}, 3);
  const [i] = emptyPlots(g);
  assert.ok(A(g).sowHeirloom(i, 'bouleDOr').ok);
  ripen(g, i);
  g.actions.harvest(i);
  assert.deepEqual(g.state.career.valley.year.heirloomCrops, ['turnip']);
  // Bilan de l'année : remis à zéro.
  const v1 = startedCareer({ valley: { heritage: false } }, 3);
  const [k] = emptyPlots(v1);
  A(v1).sowHeirloom(k, 'bouleDOr');
  ripen(v1, k);
  v1.actions.harvest(k);
  assert.deepEqual(v1.state.career.valley.year.heirloomCrops, [], 'V1 : rien');
});

test('« Revoir la boîte en fer » : la fenêtre du premier jour reconstruite depuis l\'état (graines, récoltes, sauvée)', () => {
  const g = startedCareer({}, 2);
  let box = Q(g).valley().box;
  assert.equal(box.title, 'La boîte en fer');
  assert.equal(box.lines.length, 3);
  assert.deepEqual(box.varieties.map((x) => [x.varietyId, x.state, x.seeds]), [['bouleDOr', 'seeds', 3], ['coeurDeBoeuf', 'seeds', 3], ['rougeVifDEtampes', 'seeds', 3]]);
  assert.deepEqual(box.hedge, { spotId: 'start.hedgeL', label: 'Le champ de départ, côté gauche' });
  A(g).triggerValley('fix', 'bouleDOr');
  box = Q(g).valley().box;
  assert.equal(box.varieties[0].state, 'fixed');
  assert.equal(box.varieties[0].need, 7);
});

test('bilan de l\'année : trocs, croisements, rencontres, niveau de la Grainothèque', () => {
  const g = startedCareer({}, 3);
  A(g).triggerValley('library', 1);
  A(g).triggerValley('swap', 'lili');
  A(g).triggerValley('meet', 'carrot', 1);
  A(g).triggerValley('cross', 'carrot');
  const rep = g.query.career.yearReport().valley;
  assert.equal(rep.swaps, 1);
  assert.equal(rep.libraryLevel, 1);
  assert.equal(rep.crosses, 1);
  assert.ok(rep.fixed.includes('jauneDuDoubs') || rep.fixed.length >= 1);
});

test('progression : 3 pages d\'album (trocs ♥, croisées, habitants), 6 succès (145 écus), 3 décors trouvés', () => {
  assert.equal(ALBUM_PAGES_BY_ID.swaps.cases.length, 12);
  assert.equal(ALBUM_PAGES_BY_ID.crosses.cases.length, 11);
  assert.equal(ALBUM_PAGES_BY_ID.wildlife2.cases.length, 4);
  for (const id of ['swaps', 'crosses', 'wildlife2']) assert.ok(ALBUM_PAGES_BY_ID[id].cases.every((c) => c.mode === 'career'), id);
  assert.deepEqual(HERITAGE_ACHIEVEMENTS.map((a) => a.id), ['firstSwap', 'villageSeeds', 'firstCross', 'farmHeritage', 'livingLibrary', 'valleyFriends']);
  assert.equal(HERITAGE_ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 145);
  assert.ok(HERITAGE_ACHIEVEMENTS.every((a) => a.category === 'career' && a.reward.stars === 0 && ALL_ACHIEVEMENTS.includes(a)));
  for (const id of ['swap.basket', 'cross.sign', 'lizard.wall']) assert.ok(getCosmetic(id)?.found && getCosmetic(id).price === 0, id);
  const g = startedCareer({}, 3);
  A(g).triggerValley('swap', 'lili'); // la première variété sauvée (carotte jaune du Doubs : ♥ pour Lili)
  A(g).triggerValley('cross', 'carrot');
  A(g).triggerValley('fix', 'crossCarrot');
  A(g).triggerValley('install', 'wildBee');
  A(g).triggerValley('library', 5);
  const ctx = g.query.achievementContext();
  const cv = ctx.career.valley;
  assert.deepEqual([cv.swaps, cv.crossesFound, cv.library, cv.fixedCross, cv.installedV2], [['lili'], ['crossCarrot'], 5, 1, 1]);
  const p = P.defaultProgress();
  const ids = P.checkAchievements(p, ctx);
  for (const id of ['firstSwap', 'firstCross', 'livingLibrary']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('villageSeeds') && !ids.includes('farmHeritage') && !ids.includes('valleyFriends'));
  // « Gardien des semences » compte les 12 du pays seulement.
  assert.ok(!ids.includes('seedKeeper'));
  const found = P.checkAlbum(p, ctx);
  for (const c of ['swaps.lili', 'crosses.crossCarrot', 'wildlife2.wildBee']) assert.ok(found.cases.includes(c), c);
  assert.equal(cv.swapsFav.includes('lili'), g.state.career.valley.swaps.lili.fav);
  if (g.state.career.valley.swaps.lili.fav) assert.ok(found.stamps.some((s) => s.caseId === 'swaps.lili' && s.stamp === 'heart'));
  const list = P.careerAchievementList(p, ctx);
  assert.equal(list.length, 38);
  assert.equal(P.albumOverview(p).pages, 18);
  assert.equal(P.albumOverview(p).total, 191);
});

test('signes de vie du V2 comptés pour les étapes (étapes 1 à 3 : paliers inchangés 2 / 6 / 11)', () => {
  const g = startedCareer({}, 3);
  const ev = record(g);
  for (const id of ['carotteViolette', 'blancheDeVirginie']) A(g).triggerValley('fix', id);
  nextDay(g);
  assert.equal(g.state.career.valley.stage, 1);
  assert.equal(ev.of('valleyStage').length, 1);
  A(g).triggerValley('install', 'wildBee');
  for (const id of ['bleueDArtois', 'marteauDesVertus', 'crossCarrot']) A(g).triggerValley('fix', id);
  nextDay(g);
  assert.equal(g.state.career.valley.stage, 2);
  assert.equal(Q(g).valley().stage.signs, 6);
});

test('niveaux : aucune donnée du V2 (partie de niveau sans state.career)', async () => {
  const { createGame } = await import('../src/core/game.js');
  const lvl = createGame(1, 42);
  assert.equal(lvl.state.career, undefined);
  assert.equal(lvl.state.rng.valley2, undefined);
  assert.equal(touristBonusOf(lvl.state), 0);
  assert.equal(fixedSeedCost(8, lvl.state), 10);
});

test('simulation : --valley seeds,wildlife = le V1 seul ; un tranquille avec le V2 troque, bâtit la Grainothèque et sème des paires', async () => {
  const { parseValley, playCareer, HERITAGE_STYLES } = await import('../tools/simulate-career.js');
  assert.deepEqual(parseValley('seeds,wildlife'), { seeds: true, wildlife: true, heritage: false, places: false });
  assert.deepEqual(parseValley('seeds,wildlife,heritage'), { seeds: true, wildlife: true, heritage: true, places: false });
  for (const k of ['casual', 'novice', 'optimal', 'idle', 'automator', 'handsOff']) assert.ok(HERITAGE_STYLES[k], k);
  const c = playCareer({ seed: 2, strategy: 'casual', years: 5, keepGame: true });
  const v = c.game.state.career.valley;
  assert.ok(Object.keys(v.swaps).length >= 2, 'des trocs');
  assert.ok((v.library?.level || 0) >= 1, 'la Grainothèque');
  assert.ok(v.stats.pairs >= 1, 'des paires');
  assert.ok(c.years.at(-1).valley.v2Spent > 0);
});

test('paliers des étapes avec le V2 : 2 / 6 / 11 / 22 / 38 (étape 5 vers l\'an 9 du tranquille) ; sans le V2 : 2 / 6 / 11 / 17 / 24', () => {
  assert.deepEqual(STAGES.map((st) => st.signs), [0, 2, 6, 11, 17, 24], 'V1 inchangé');
  assert.deepEqual(STAGE_SIGNS_V2, [0, 2, 6, 11, 22, 38]);
  for (let n = 0; n <= 3; n++) assert.equal(stageSigns(n, true), stageSigns(n, false), `étape ${n} identique (débutant pas retardé)`);
  for (let n = 1; n < STAGE_SIGNS_V2.length; n++) {
    assert.ok(STAGE_SIGNS_V2[n] > STAGE_SIGNS_V2[n - 1], 'croissants');
    assert.ok(STAGE_SIGNS_V2[n] >= STAGES[n].signs, 'jamais plus bas que le V1 (vérification des sauvegardes)');
  }
  assert.ok(STAGE_SIGNS_V2.at(-1) <= SIGNS_ALL);
  // Avec le V2 : 17 signes ne donnent plus l'étape 4 ; 22 la donnent ; 38 l'étape 5 (et la fiche annonce le bon palier).
  const g = startedCareer({}, 3);
  const all = [...ALL_VARIETIES.map((x) => ['fix', x.id]), ...ALL_SPECIES.map((sp) => ['install', sp.id])];
  let k0 = 0;
  const to = (n) => { while (Q(g).valley().stage.signs < n) { A(g).triggerValley(...all[k0]); k0 += 1; } nextDay(g); };
  to(17);
  assert.equal(g.state.career.valley.stage, 3);
  assert.equal(Q(g).valley().stage.next.signs, 22);
  to(22);
  assert.equal(g.state.career.valley.stage, 4);
  assert.equal(Q(g).valley().stage.next.signs, 38);
  to(37);
  assert.equal(g.state.career.valley.stage, 4);
  to(38);
  assert.equal(g.state.career.valley.stage, 5);
  // Sans le V2 : les paliers du V1.
  const h = startedCareer({ valley: { heritage: false } }, 3);
  for (const id of VARIETIES.map((x) => x.id).slice(0, 12)) A(h).triggerValley('fix', id);
  for (const id of SPECIES.map((sp) => sp.id).slice(0, 5)) A(h).triggerValley('install', id);
  nextDay(h);
  assert.equal(h.state.career.valley.stage, 4, '17 signes : étape 4 au V1');
  assert.equal(Q(h).valley().stage.next.signs, 24);
});

test('débogage triggerValley(\'stage\', 5) avec le V2 : atteint le palier de 38 signes', () => {
  const g = startedCareer({}, 3);
  const r = A(g).triggerValley('stage', 5);
  assert.equal(r.stage, 5);
  assert.ok(Q(g).valley().stage.signs >= 38);
});
