// La Vallée vivante (lot V2) — les croisements : voisinage des parcelles, « Semer la paire » (atomique), rencontres à la
// récolte à la main (jamais l'équipe), une par récolte, osmie (double), Grainothèque niveau 4 (2 rencontres), sachet doré
// (3 graines), nom de la ferme, récit du premier croisement, requêtes (liens, mode paire, fiche de parcelle, feuille des
// graines), indice, rien ne se perd. Contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 » ; règles :
// docs/VALLEE.md § 16.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CROSS_RULES } from '../src/data/career/heritage.js';
import { crossLinks, pairPlots, partnerOf, plotNeighbours } from '../src/core/career/heritage.js';
import { newLot } from './career-crew-helpers.js';
import { emptyPlots, nextDay, record, ripen, setRank, startedCareer, toSeason, withExtension } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

/** Carrière au printemps avec les deux carottes en main (pays sauvée, village 3 graines). */
function carrotCareer(opts = {}, rank = 3) {
  const g = startedCareer(opts, rank);
  A(g).triggerValley('fix', 'jauneDuDoubs');
  A(g).triggerValley('seeds', 'carotteViolette', 3);
  return g;
}

/** Index du champ de départ par cellule. */
function startCell(g, cell) {
  return g.state.plots.findIndex((p) => p.lot === 'start' && p.cell === cell);
}

test('voisinage : même terrain, un côté commun (droite, gauche, dessous, dessus), 4 colonnes au champ et à la serre', () => {
  const g = startedCareer({}, 6);
  const at = (cell) => startCell(g, cell);
  assert.deepEqual(plotNeighbours(g.state, at(5)), [at(6), at(4), at(9), at(1)]);
  assert.deepEqual(plotNeighbours(g.state, at(0)), [at(1), at(4)]);
  assert.deepEqual(plotNeighbours(g.state, at(3)), [at(2), at(7)], 'bord droit : pas de voisine à droite');
  const gh = newLot(g, 'greenhouse');
  const ghPlots = g.state.plots.map((p, i) => (p.lot === gh && p.env ? i : -1)).filter((i) => i >= 0);
  if (ghPlots.length === 4) {
    const cells = ghPlots.map((i) => g.state.plots[i].cell);
    const k = ghPlots[cells.indexOf(1)];
    assert.equal(plotNeighbours(g.state, k).length, 2, 'serre sur une ligne : gauche et droite');
  }
  assert.deepEqual(partnerOf('jauneDuDoubs'), { crossId: 'crossCarrot', partnerId: 'carotteViolette', cropId: 'carrot' });
  assert.equal(partnerOf('calvilleBlanc'), null);
  assert.equal(partnerOf('crossCarrot'), null, 'pas de génération suivante');
});

test('semer la paire : variété du village sur la parcelle touchée, celle du pays à côté (graines d\'abord, sinon au prix × 1,25) ; atomique ; refus', () => {
  const g = carrotCareer();
  const ev = record(g);
  const a = startCell(g, 0);
  const b = startCell(g, 1);
  assert.equal(A(g).sowPair(a, 'apple').reason, 'Culture sans croisement.');
  assert.equal(A(g).sowPair(999, 'carrot').reason, 'Parcelle inexistante.');
  const money = g.state.money;
  const r = A(g).sowPair(a, 'carrot');
  assert.deepEqual([r.ok, r.plots, r.varieties, r.fromSeeds], [true, [a, b], ['carotteViolette', 'jauneDuDoubs'], [true, false]]);
  assert.ok(r.cost > 0, 'la carotte du pays (sauvée, sans graine) est achetée');
  assert.equal(g.state.money, money - r.cost);
  assert.equal(g.state.plots[a].variety, 'carotteViolette');
  assert.equal(g.state.plots[b].variety, 'jauneDuDoubs');
  assert.equal(g.state.career.valley.seeds.carotteViolette, 2);
  assert.deepEqual(ev.of('pairSown')[0].plots, [a, b]);
  assert.equal(A(g).sowPair(a, 'carrot').reason, 'Cette parcelle n\'est pas libre.');
  // Plus de voisine libre : refus, rien n'est semé.
  for (const i of emptyPlots(g)) g.state.plots[i].cropId = 'turnip';
  g.state.plots[startCell(g, 11)].cropId = null;
  const lone = startCell(g, 11);
  const before = JSON.stringify(g.state.plots);
  assert.equal(A(g).sowPair(lone, 'carrot').reason, 'Il faut une parcelle libre juste à côté.');
  assert.equal(JSON.stringify(g.state.plots), before);
  // Saison : la tomate ne se sème pas au printemps.
  const h = startedCareer({}, 3);
  A(h).triggerValley('fix', 'coeurDeBoeuf');
  A(h).triggerValley('seeds', 'noireDeCrimee', 3);
  assert.equal(A(h).sowPair(startCell(h, 0), 'tomato').reason, 'Tomate ne se sème pas au printemps.');
  // Sans la variété du village : raison douce.
  const k = startedCareer({}, 3);
  A(k).triggerValley('fix', 'jauneDuDoubs');
  assert.match(A(k).sowPair(startCell(k, 0), 'carrot').reason, /la Carotte violette : Lili la garde dans son jardin/);
  // Variété du pays connue mais sans graine ni sauvée : refus, rien n'est semé (atomique).
  const m = startedCareer({}, 3);
  A(m).triggerValley('seeds', 'carotteViolette', 3);
  A(m).triggerValley('seeds', 'jauneDuDoubs', 0);
  const snap = JSON.stringify(m.state.plots);
  assert.match(A(m).sowPair(startCell(m, 0), 'carrot').reason, /Plus de graines de Carotte jaune du Doubs/);
  assert.equal(JSON.stringify(m.state.plots), snap);
  assert.equal(m.state.career.valley.seeds.carotteViolette, 3);
});

test('rencontre : récolte à la main d\'un parent pendant que l\'autre pousse à côté ; une seule par récolte ; jamais l\'équipe ; 3 rencontres → le sachet doré', (t) => {
  const ext = withExtension();
  t.after(() => ext.off());
  const g = carrotCareer();
  const ev = record(g);
  const order = [];
  for (const t of ['harvested', 'heirloomHarvest', 'heirloomFixed', 'crossMeeting', 'crossFound', 'storyAvailable']) g.on(t, () => order.push(t));
  const meet = () => g.state.career.valley.crosses.carrot?.meet || 0;
  // Parcelle entourée de deux parents : une seule rencontre.
  A(g).triggerValley('seeds', 'jauneDuDoubs', 3);
  const c = startCell(g, 1);
  assert.ok(A(g).sowHeirloom(c, 'carotteViolette').ok);
  assert.ok(A(g).sowHeirloom(startCell(g, 0), 'jauneDuDoubs').ok);
  assert.ok(A(g).sowHeirloom(startCell(g, 2), 'jauneDuDoubs').ok);
  assert.equal(crossLinks(g.state).length, 2);
  ripen(g, c);
  g.actions.harvest(c);
  assert.equal(meet(), 1);
  const m1 = ev.of('crossMeeting')[0];
  assert.deepEqual([m1.cropId, m1.plotIndex, m1.meet, m1.need], ['carrot', c, 1, CROSS_RULES.need]);
  assert.deepEqual(order, ['harvested', 'heirloomHarvest', 'crossMeeting']);
  // Récolte de l'équipe : jamais de rencontre.
  ripen(g, startCell(g, 0));
  assert.ok(ext.api().harvest(startCell(g, 0), { by: 'staff' }).ok);
  assert.equal(meet(), 1);
  // Parent récolté sans l'autre à côté : rien.
  ripen(g, startCell(g, 2));
  g.actions.harvest(startCell(g, 2));
  assert.equal(meet(), 1);
  // Deux rencontres de plus → croisement.
  for (let k = 0; k < 2; k++) {
    const r = A(g).sowPair(startCell(g, 4), 'carrot');
    assert.ok(r.ok, r.reason);
    ripen(g, r.plots[1]);
    g.actions.harvest(r.plots[1]);
    g.state.plots[r.plots[0]].cropId = null;
    delete g.state.plots[r.plots[0]].variety;
  }
  assert.equal(meet(), 3);
  const f = ev.of('crossFound')[0];
  assert.deepEqual([f.varietyId, f.cropId, f.seeds, f.story], ['crossCarrot', 'carrot', 3, 'heritage2']);
  assert.match(f.name, /^Carotte (de la |du |d'|de )/);
  assert.deepEqual(f.traits.map((t) => t.id), ['tasty', 'fine']);
  assert.deepEqual(f.parents.map((x) => x.varietyId), ['jauneDuDoubs', 'carotteViolette']);
  assert.equal(g.state.career.valley.seeds.crossCarrot, 3);
  assert.equal(g.state.career.valley.varieties.crossCarrot.from, 'cross');
  assert.ok(Number.isInteger(g.state.career.valley.crosses.carrot.foundAt));
  assert.ok(g.state.career.valley.stories.available.includes('heritage2'));
  assert.deepEqual(order.slice(-3), ['crossMeeting', 'crossFound', 'storyAvailable']);
  // Croisement trouvé : plus de paire, plus de rencontre, plus de lien.
  assert.equal(A(g).sowPair(startCell(g, 8), 'carrot').reason, 'Ce croisement est déjà trouvé.');
  assert.equal(crossLinks(g.state).length, 0);
  // La croisée se sème et se sauve comme les autres ; à côté d'un parent : rien (pas de génération suivante).
  const x = startCell(g, 8);
  assert.ok(A(g).sowHeirloom(x, 'crossCarrot').ok);
  assert.ok(A(g).sowHeirloom(startCell(g, 9), 'carotteViolette').ok);
  ripen(g, x);
  const h = g.actions.harvest(x);
  assert.equal(h.seeds, 2);
  assert.equal(ev.of('crossFound').length, 1);
  // Un seul récit, même au deuxième croisement.
  A(g).triggerValley('cross', 'turnip');
  assert.equal(g.state.career.valley.stories.available.filter((s) => s === 'heritage2').length, 1);
});

test('osmie : chaque rencontre compte double ; Grainothèque niveau 4 : croisement en 2 rencontres', () => {
  const g = carrotCareer({}, 5);
  A(g).triggerValley('install', 'wildBee');
  const r = A(g).sowPair(startCell(g, 0), 'carrot');
  ripen(g, r.plots[0]);
  const ev = record(g);
  g.actions.harvest(r.plots[0]);
  assert.equal(g.state.career.valley.crosses.carrot.meet, 2);
  assert.equal(ev.of('crossMeeting')[0].add, 2);
  assert.equal(ev.of('crossFound').length, 0);
  const h = carrotCareer({}, 5);
  A(h).triggerValley('library', 4);
  for (let k = 0; k < 2; k++) {
    const p = A(h).sowPair(startCell(h, 4 * k), 'carrot');
    ripen(h, p.plots[0]);
    h.actions.harvest(p.plots[0]);
  }
  assert.ok(h.state.career.valley.crosses.carrot.foundAt);
  assert.equal(Q(h).valley().crosses.find((c) => c.cropId === 'carrot').need, 2);
});

test('requêtes : liens (abeille), mode paire, fiche de parcelle, feuille des graines (ligne « paire »), tableau des croisements, indice', () => {
  const g = carrotCareer();
  for (let n = 0; n <= 6; n++) A(g).readChapter(n);
  for (const s of g.state.career.valley.stories.available) A(g).readStory(s);
  // Indice : semez la paire.
  let hint = Q(g).valley().hint;
  assert.equal(hint.kind, 'pair');
  assert.deepEqual(hint.target, { type: 'pair', id: 'carrot' });
  // Mode paire : chaque parcelle vide avec une voisine vide.
  const spots = Q(g).valleyPairPlots('carrot');
  assert.ok(spots.length >= 10);
  assert.deepEqual(spots[0], { plotIndex: startCell(g, 0), partnerPlot: startCell(g, 1) });
  assert.deepEqual(Q(g).valleyPairPlots('apple'), []);
  assert.deepEqual(pairPlots(g.state, 'tomato'), [], 'la tomate ne se sème pas au printemps');
  // Feuille des graines : la ligne de la variété du village porte la paire.
  const rows = g.query.plantableCrops(startCell(g, 0)).heirlooms;
  const vio = rows.find((x) => x.varietyId === 'carotteViolette');
  assert.deepEqual([vio.group, vio.pair.canPair, vio.pair.cropId], ['village', true, 'carrot']);
  assert.deepEqual(vio.traits.map((t) => t.id), ['fine']);
  const r = A(g).sowPair(startCell(g, 0), 'carrot');
  const links = Q(g).valleyCrossLinks();
  assert.deepEqual(links, [{ a: r.plots[0], b: r.plots[1], cropId: 'carrot', meet: 0, need: 3 }]);
  const plot = g.query.plot(r.plots[0]).variety;
  assert.deepEqual([plot.group, plot.cross.partnerId, plot.cross.meet, plot.cross.need, plot.cross.linked, plot.cross.partnerPlot], ['village', 'jauneDuDoubs', 0, 3, true, r.plots[1]]);
  const cr = Q(g).valley().crosses.find((c) => c.cropId === 'carrot');
  assert.deepEqual([cr.name, cr.found, cr.linked, cr.meet, cr.parents.map((p) => p.have)], ['?', false, true, 0, [true, true]]);
  // Planche mûre avec sa jumelle à côté : l'indice le dit.
  ripen(g, r.plots[0]);
  hint = Q(g).valley().hint;
  assert.equal(hint.kind, 'trial');
  assert.match(hint.text, /\+ 2 graines et \+ 1 rencontre/);
  // Les 11 croisements ont leur ligne, avec une raison douce quand la paire n'est pas possible.
  const all = Q(g).valley().crosses;
  assert.equal(all.length, 11);
  assert.match(all.find((c) => c.cropId === 'tomato').reason, /Mme Chevalier la garde dans son jardin/);
  assert.match(all.find((c) => c.cropId === 'turnip').reason, /le Navet des Vertus Marteau : Mme Morel le garde/);
});

test('rien ne se perd : planche d\'essai récoltée par l\'équipe (V2) ou gelée → la graine revient ; les rencontres restent', (t) => {
  const ext = withExtension();
  t.after(() => ext.off());
  const g = carrotCareer();
  const api = ext.api();
  const r = A(g).sowPair(startCell(g, 0), 'carrot');
  ripen(g, r.plots[0]);
  g.actions.harvest(r.plots[0]);
  assert.equal(g.state.career.valley.crosses.carrot.meet, 1);
  const before = g.state.career.valley.seeds.carotteViolette;
  assert.ok(A(g).sowHeirloom(r.plots[0], 'carotteViolette').ok);
  ripen(g, r.plots[0]);
  assert.equal(api.harvest(r.plots[0], { by: 'staff' }).seeds, 0);
  assert.equal(g.state.career.valley.seeds.carotteViolette, before, 'la graine revient (sans graine en plus)');
  assert.equal(g.state.career.valley.varieties.carotteViolette.hand, 1, 'sans compter vers la fixation');
  assert.equal(g.state.career.valley.crosses.carrot.meet, 1, 'les rencontres ne baissent jamais');
  // V1 (heritage: false) : l'équipe ne rend rien (règle du V1 inchangée).
  const v1 = startedCareer({ valley: { heritage: false } }, 3);
  const [k] = emptyPlots(v1);
  A(v1).sowHeirloom(k, 'bouleDOr');
  ripen(v1, k);
  ext.api().harvest(k, { by: 'staff' });
  assert.equal(v1.state.career.valley.seeds.bouleDOr, 2);
});

test('équipe et semoir : une variété du village ou une croisée sauvée se sème par le plan de culture ; jamais avant', () => {
  const g = startedCareer({}, 3);
  A(g).triggerValley('seeds', 'carotteViolette', 3);
  assert.match(A(g).setPlan('start', 'spring', 'heirloom:carotteViolette').reason, /sauvez-la d'abord \(7 récoltes à la main\)/);
  A(g).triggerValley('fix', 'carotteViolette');
  assert.ok(A(g).setPlan('start', 'spring', 'heirloom:carotteViolette').ok);
  A(g).triggerValley('cross', 'carrot');
  A(g).triggerValley('fix', 'crossCarrot');
  assert.ok(A(g).setPlan('start', 'autumn', 'heirloom:crossCarrot').ok);
});

test('saison suivante : une paire semée en automne reste liée, la fiche dit « Semez … juste à côté » quand la jumelle manque', () => {
  const g = carrotCareer();
  toSeason(g, 2);
  const [i] = emptyPlots(g);
  assert.ok(A(g).sowHeirloom(i, 'carotteViolette').ok);
  const v = g.query.plot(i).variety;
  assert.deepEqual([v.cross.linked, v.cross.partnerKnown, v.cross.partnerName], [false, true, 'Carotte jaune du Doubs']);
  nextDay(g);
  setRank(g, 3);
});
