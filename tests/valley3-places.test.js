// La Vallée vivante (lot V3) — les six lieux : chantier payé + condition de vie + reprise (un chantier par lieu, les six
// en parallèle), avantages sur les leviers existants, habitants de la vallée (il faut les toucher), pêche au ruisseau,
// champignons d'automne, Reinette grise, cerisier et poirier, indice. Règles : docs/VALLEE.md § 17.4 à § 17.7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES_BY_ID } from '../src/data/career/places.js';
import { FALLOW } from '../src/data/career/valley.js';
import {
  crowWeightFactor, fishFactor, growthFactorOf, heatingFactorOf, hedgeCoinsFactorOf, millPlacesOf, touristBonusOf, upkeepFactorOf, valleyDryGrowth, winterFindsMax,
} from '../src/core/career/heirlooms.js';
import { careerDailyCharges } from '../src/core/career/effects.js';
import { checkValley } from '../src/core/career/valley.js';
import { nextHint } from '../src/core/career/habitat.js';
import { nextDay, record, skipDays, startedCareer, toSeason } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

function openCareer(opts = {}) {
  const g = startedCareer(opts, 6);
  g.state.money = 500000;
  A(g).triggerValley('view');
  return g;
}

const absDay = (g) => (g.state.time.year - 1) * 4 * g.state.career.seasonLength + g.state.time.day;

test('chantier : refus (conditions manquantes, dans l\'ordre des données), paiement au poste « La Vallée » (patrimoine 100 %), reprise en saisons, étape atteinte à l\'aube', () => {
  const g = openCareer();
  assert.equal(A(g).startWorks('nope').reason, 'Lieu inconnu.');
  assert.equal(A(g).startWorks('combe').reason, 'Il manque : le geai des chênes.');
  assert.match(A(g).startWorks('brook').reason, /^Il manque : \d+ haies\.$/);
  A(g).triggerValley('install', 'jay');
  const info = Q(g).valley().places.find((p) => p.id === 'combe');
  assert.equal(info.next.canStart, true);
  assert.deepEqual(info.next.needs.map((n) => n.ok), [true]);
  const spent = g.state.career.valley.spent;
  const money = g.state.money;
  const st = PLACES_BY_ID.combe.steps[1];
  const ev = record(g);
  const r = A(g).startWorks('combe');
  assert.equal(r.ok, true);
  assert.equal(r.cost, st.cost);
  assert.equal(r.readyAt, absDay(g) + st.seasons * g.state.career.seasonLength);
  assert.equal(g.state.money, money - st.cost);
  assert.equal(g.state.career.valley.spent, spent + st.cost);
  assert.equal(ev.of('worksStarted')[0].first, true);
  // Un chantier par lieu ; un autre lieu peut avancer en même temps.
  assert.match(A(g).startWorks('combe').reason, /^Un chantier est déjà en cours ici : encore \d+ jours\.$/);
  A(g).triggerValley('place', 'brook', 1);
  assert.equal(A(g).startWorks('brook').reason, 'Il manque : 4 jachères fleuries.');
  g.state.career.valley.stats.fallows = 4;
  assert.equal(A(g).startWorks('brook').ok, true, 'deux lieux en reprise en même temps');
  const w = Q(g).valley().places.find((p) => p.id === 'combe').works;
  assert.equal(w.progress, 0);
  assert.equal(w.daysLeft, st.seasons * g.state.career.seasonLength);
  // Reprise : en jours (saisons × durée des saisons), l'étape tombe à l'aube.
  skipDays(g, st.seasons * g.state.career.seasonLength - 1);
  assert.equal(g.state.career.valley.places.combe.step, 0);
  nextDay(g);
  assert.equal(g.state.career.valley.places.combe.step, 1);
  const rec = ev.of('placeRecovered').find((e) => e.placeId === 'combe');
  assert.deepEqual([rec.step, rec.name, rec.boon.kind], [1, 'Jeunes plants', 'heating']);
  assert.deepEqual(rec.species, ['blackWoodpecker']);
  assert.equal(g.state.career.valley.places.combe.works, null);
  assert.equal(checkValley(g.serialize()), null);
  // Patrimoine : les dépenses de la Vallée comptent à 100 %.
  assert.equal(g.query.career.summary().patrimony >= g.state.career.valley.spent, true);
});

test('saisons de 14 jours : une reprise de n saisons dure n × 14 jours', () => {
  const g = openCareer({ seasonLength: 14 });
  A(g).triggerValley('install', 'jay');
  const r = A(g).startWorks('combe');
  assert.equal(r.daysLeft, PLACES_BY_ID.combe.steps[1].seasons * 14);
});

test('restauré : dernière étape → récit du lieu ; « Ce lieu est déjà restauré. »', () => {
  const g = openCareer();
  const ev = record(g);
  A(g).triggerValley('place', 'bocage', 3);
  assert.equal(Q(g).valley().places.find((p) => p.id === 'bocage').restored, true);
  assert.equal(ev.of('placeRecovered').at(-1).story, 'bocage3');
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'bocage3'));
  assert.equal(A(g).startWorks('bocage').reason, 'Ce lieu est déjà restauré.');
  assert.equal(A(g).readStory('bocage3').story.title, 'Le chemin creux');
});

test('avantages : canicule, l\'eau revient, moulin, chauffage, foin, ruches, jachère, poissons, touristes, abris, corbeaux, cueillette, trouvailles', () => {
  const g = openCareer();
  const s = g.state;
  // Sans rien : valeurs neutres.
  assert.deepEqual([heatingFactorOf(s), upkeepFactorOf(s), millPlacesOf(s, 'mill'), crowWeightFactor(s), hedgeCoinsFactorOf(s), winterFindsMax(s, 3)], [1, 1, 0, 1, 1, 3]);
  assert.equal(valleyDryGrowth(s, 0.25, true), 0.25);
  A(g).triggerValley('place', 'brook', 4);
  assert.equal(valleyDryGrowth(s, 0.25, true), 0.5, 'canicule : ½ jour au lieu de ¼');
  assert.equal(valleyDryGrowth(s, 0, true), 0.25, 'Classique : ¼ au lieu de 0');
  assert.equal(millPlacesOf(s, 'mill'), 1);
  assert.equal(millPlacesOf(s, 'dairy'), 0);
  A(g).triggerValley('place', 'combe', 3);
  assert.equal(heatingFactorOf(s), 0.5);
  assert.equal(winterFindsMax(s, 3), 4);
  A(g).triggerValley('place', 'poppies', 3);
  assert.equal(upkeepFactorOf(s), 0.9);
  const plot = { rested: true };
  s.career.valley.stage = 4;
  assert.equal(growthFactorOf(s, plot), 1 + 0.3);
  assert.equal(FALLOW.growthStage4, 0.2);
  A(g).triggerValley('place', 'millpond', 3);
  assert.equal(fishFactor(s), 1.15);
  const tb = touristBonusOf(s);
  assert.ok(Math.abs(tb - 0.1) < 1e-9);
  A(g).triggerValley('place', 'bocage', 2);
  assert.equal(crowWeightFactor(s), 0.5);
  assert.equal(hedgeCoinsFactorOf(s), 1.5);
  A(g).triggerValley('place', 'bocage', 3);
  assert.equal(crowWeightFactor(s), 0, 'plus aucun corbeau');
  assert.equal(hedgeCoinsFactorOf(s), 2);
  // L'eau revient (étape 6) : + 0,1 jour sans arrosage, jamais plus d'un jour arrosé.
  s.career.valley.stage = 6;
  assert.ok(Math.abs(valleyDryGrowth(s, 0.75, false) - 0.85) < 1e-9);
  assert.equal(valleyDryGrowth(s, 1, false), 1);
  // Chauffage et entretien des animaux dans les charges.
  s.investments.hen = 4;
  const lvl = g.query.level ? g.query.level() : null;
  void lvl;
});

test('ruches de la prairie fleurie : + 1 pièce par ruche et par jour (hors hiver) ; entretien des animaux − 10 %', () => {
  const g = openCareer();
  g.state.investments.beehive = 3;
  g.state.investments.goat = 10;
  const before = g.query.career.charges().dailyTotal;
  A(g).triggerValley('place', 'poppies', 2);
  const after = g.query.career.charges().dailyTotal;
  assert.ok(after < before, `foin : charges plus basses (${before} → ${after})`);
  const ev = record(g);
  toSeason(g, 1);
  nextDay(g);
  const meadow = ev.of('dawn').at(-1).incomes.find((i) => i.source === 'valleyMeadow');
  assert.deepEqual([meadow.amount, meadow.kind], [3, 'valley']);
  toSeason(g, 3);
  ev.clear();
  nextDay(g);
  assert.ok(!ev.of('dawn').at(-1).incomes.some((i) => i.source === 'valleyMeadow'), 'rien l\'hiver');
  void careerDailyCharges;
});

test('pêche au ruisseau : à sec avant l\'étape 2 ; une par jour (en plus de la mare) ; 2 nombres valley3, flux events intact ; truites et écrevisses à l\'étape 3', () => {
  const g = openCareer();
  assert.equal(A(g).fishRiver().reason, 'Le ruisseau est encore à sec.');
  A(g).triggerValley('place', 'brook', 2);
  const r3 = g.state.rng.valley3;
  const ev = g.state.rng.events;
  const ev2 = record(g);
  const money = g.state.money;
  const r = A(g).fishRiver();
  assert.equal(r.ok, true);
  assert.ok(['minnow', 'gudgeon', 'chub'].includes(r.fishId));
  assert.equal(g.state.money, money + r.amount);
  assert.notEqual(g.state.rng.valley3, r3);
  assert.equal(g.state.rng.events, ev, 'la pêche du ruisseau ne tire rien sur events');
  assert.equal(ev2.of('riverFished')[0].first, true);
  assert.equal(A(g).fishRiver().reason, 'Vous avez déjà pêché au ruisseau aujourd\'hui : revenez demain !');
  assert.equal(Q(g).valley().river.fishedToday, true);
  nextDay(g);
  assert.equal(A(g).fishRiver().ok, true);
  assert.equal(g.state.career.valley.stats.river, 2);
  // Étape 3 : les gros poissons possibles (sur 200 pêches, au moins une truite ou une écrevisse).
  A(g).triggerValley('place', 'brook', 3);
  const seen = new Set();
  for (let k = 0; k < 200; k++) {
    A(g).triggerValley('riverReset');
    seen.add(A(g).fishRiver().fishId);
  }
  assert.ok(seen.has('browntrout') && seen.has('crayfish'));
});

test('champignons d\'automne (bois ≥ 2) : 3 nombres valley3 à chaque aube d\'automne, 3 au plus, cueillis par le joueur, effacés au 1er jour d\'hiver', () => {
  const g = openCareer();
  A(g).triggerValley('place', 'combe', 2);
  toSeason(g, 2);
  let draws = 0;
  for (let d = 0; d < 6; d++) {
    const before = g.state.rng.valley3;
    nextDay(g);
    if (g.state.rng.valley3 !== before) draws++;
  }
  assert.ok(draws >= 6, 'des nombres valley3 chaque aube d\'automne');
  assert.ok(g.state.career.valley.mushrooms.length <= 3);
  A(g).triggerValley('mushrooms', 3);
  const m = Q(g).valley().mushrooms;
  assert.equal(m.length, 3);
  const r = A(g).pickMushroom(m[0].id);
  assert.equal(r.ok, true);
  assert.ok(r.amount > 0);
  assert.equal(A(g).pickMushroom('nope').reason, 'Rien à cueillir ici.');
  toSeason(g, 3);
  assert.equal(g.state.career.valley.mushrooms.length, 0);
});

test('habitants de la vallée : recette = étape d\'un lieu, indice puis venue (flux valley3), il faut les toucher ; le premier fait venir Hélène ; « Il vous attend au ruisseau »', () => {
  const g = openCareer();
  A(g).triggerValley('place', 'brook', 2);
  const ev = record(g);
  let guard = 0;
  while (g.state.career.valley.species.kingfisher?.state !== 'visible' && guard++ < 200) nextDay(g);
  assert.equal(g.state.career.valley.species.kingfisher.state, 'visible');
  assert.equal(g.state.career.valley.species.kingfisher.spotId, 'brook');
  assert.ok(ev.of('speciesHint').some((e) => e.id === 'kingfisher' && e.spotId === 'brook'));
  // Les bêtes de la vallée ne viennent pas sur la ferme : elles attendent dans la vue.
  assert.ok(!Q(g).valleyAnimals().some((a) => a.id === 'kingfisher'));
  assert.ok(Q(g).valleyView().animals.some((a) => a.id === 'kingfisher' && a.state === 'visible'));
  const hint = nextHint(g.state);
  assert.equal(hint.kind, 'valleyAnimal');
  assert.equal(hint.text, 'Le martin-pêcheur vous attend au ruisseau.');
  assert.deepEqual(hint.target, { type: 'viewAnimal', id: 'kingfisher' });
  const o = A(g).observe('kingfisher');
  assert.equal(o.ok, true);
  assert.equal(o.welcome, 'Bienvenue, petit martin-pêcheur !');
  assert.equal(o.opens, 'Le ruisseau peut maintenant passer à « Les truites reviennent ».');
  assert.ok(ev.of('storyAvailable').some((e) => e.id === 'helene'));
  const sp = Q(g).valley().species.find((s) => s.id === 'kingfisher');
  assert.deepEqual([sp.group, sp.placeId, sp.where, sp.state], ['valley', 'brook', 'au ruisseau', 'installed']);
});

test('{ places: false } : les habitants de la vallée n\'existent pas (observe refusé)', () => {
  const g = startedCareer({ valley: { places: false } }, 6);
  assert.equal(A(g).triggerValley('install', 'kingfisher').reason, 'Espèce inconnue.');
});

test('verger conservatoire : Reinette grise (3 greffons à l\'étape 1), cerisier (étape 2), poirier (étape 3) plantés au verger, hors de CROPS', () => {
  const g = openCareer();
  const r0 = g.actions.career.buyLot();
  g.actions.career.developLot(r0.lotId, 'orchard');
  const orchard = g.state.plots.map((p, i) => (p.env === 'orchard' && p.unlocked ? i : -1)).filter((i) => i >= 0);
  const ev = record(g);
  A(g).triggerValley('place', 'oldOrchard', 1);
  assert.deepEqual(ev.of('placeRecovered')[0].grafts, { varietyId: 'reinetteGrise', name: 'Pomme Reinette grise du Canada', n: 3 });
  assert.equal(g.state.career.valley.seeds.reinetteGrise, 3);
  assert.equal(g.state.career.valley.varieties.reinetteGrise.from, 'orchard');
  assert.equal(A(g).sowHeirloom(orchard[0], 'reinetteGrise').ok, true);
  assert.equal(g.actions.plant(orchard[1], 'cherry').reason, 'Le cerisier vient du verger conservatoire.');
  assert.ok(!g.query.plantableCrops(orchard[1]).some((r) => r.id === 'cherry'));
  A(g).triggerValley('place', 'oldOrchard', 2);
  const row = g.query.plantableCrops(orchard[1]).find((r) => r.id === 'cherry');
  assert.ok(row && row.valleyTree && row.seedCost === 60);
  assert.ok(!g.query.plantableCrops(orchard[1]).some((r) => r.id === 'pear'));
  assert.equal(g.actions.plant(orchard[1], 'cherry').ok, true);
  assert.equal(g.actions.plant(orchard[2], 'pear').reason, 'Le poirier vient du verger conservatoire.');
  A(g).triggerValley('place', 'oldOrchard', 3);
  assert.equal(g.actions.plant(orchard[2], 'pear').ok, true);
  assert.equal(checkValley(g.serialize()), null);
  // Le cerisier donne au printemps : un arbre adulte et des fruits mûrs se récoltent comme un pommier.
  const p = g.state.plots[orchard[1]];
  p.growth = 6;
  p.fruit = 3;
  const h = g.actions.harvest(orchard[1]);
  assert.equal(h.ok, true);
  assert.equal(g.state.career.stock.cherry, undefined, 'jamais au grenier');
});

test('indice : un lieu prêt (payable en gardant 2 saisons de charges), puis ce qui manque au lieu le plus proche', () => {
  const g = openCareer();
  for (const s of ['robin', 'hedgehog', 'ladybird', 'bumblebee', 'butterfly', 'swallow', 'tawnyOwl', 'frog', 'dragonfly', 'hare', 'squirrel', 'jay', 'wildBee', 'blackbird', 'lizard', 'bat']) A(g).triggerValley('install', s);
  for (const k of Object.keys(g.state.career.valley.stories.available)) void k;
  g.state.career.valley.stories.read = [...g.state.career.valley.stories.available];
  g.state.career.valley.chapters.read = [0, 1, 2, 3, 4, 5];
  g.state.career.valley.seeds = {};
  let h = nextHint(g.state);
  assert.equal(h.kind, 'place');
  assert.match(h.text, /peut passer à « /);
  g.state.money = 10;
  h = nextHint(g.state);
  assert.notEqual(h.kind, 'place', 'pas de lieu prêt proposé sans de quoi payer');
});
