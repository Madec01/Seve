// La Vallée vivante (lot V1) — graines anciennes : bocaux, semis, récolte à la main (+ 2 graines), fixation, équipe et
// semoir (variétés fixées seulement, jamais de graine gardée), grenier, traits, jachère fleurie, greffons du pommier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCrop } from '../src/data/crops.js';
import { SEED_RULES, VARIETIES, VARIETIES_BY_ID, TRAITS_BY_ID, FALLOW } from '../src/data/career/valley.js';
import { sowChoice } from '../src/core/career/crew.js';
import { qualityChances } from '../src/core/surprises.js';
import { giantFactorOf } from '../src/core/career/heirlooms.js';
import { treeGrowDays } from '../src/core/trees.js';
import { valleyCareer, startedCareer, emptyPlots, ripen, nextDay, record, withExtension, toSeason, setRank } from './valley-helpers.js';
import { hireAs } from './career-crew-helpers.js';

const FIX = SEED_RULES.fixHand;

test('bocaux : la variété de la culture du bocal d\'abord ; sinon une variété pas encore obtenue (de saison) ; 3 graines', () => {
  const g = startedCareer();
  const ev = record(g);
  g.actions.career.triggerValley('jar', 'carrot');
  g.actions.career.triggerValley('jar', 'turnip');
  assert.equal(g.query.career.valley().jars.pending, 2);
  assert.equal(g.query.career.valley().jars.list[0].label, '…une du Doubs, 1952');
  const a = g.actions.career.openJar();
  assert.deepEqual([a.varietyId, a.seeds, a.isNew, a.cropId], ['jauneDuDoubs', 3, true, 'carrot']);
  assert.equal(a.trait.id, 'tasty');
  assert.equal(ev.of('jarOpened').length, 1);
  // Navet déjà dans la boîte : une variété manquante qui se sème au printemps.
  const b = g.actions.career.openJar();
  assert.ok(b.isNew);
  assert.ok(['rougeDeBordeaux', 'vitelotte', 'reineDesVallees'].includes(b.varietyId), b.varietyId);
  assert.equal(g.actions.career.openJar().reason, 'Aucun bocal à ouvrir.');
  assert.equal(g.state.career.valley.jars.opened, 2);
  // Toutes obtenues : 3 graines de la variété du bocal.
  for (const x of VARIETIES) g.actions.career.triggerValley('seeds', x.id, 0);
  g.actions.career.triggerValley('jar', 'cabbage');
  const c = g.actions.career.openJar();
  assert.deepEqual([c.varietyId, c.isNew], ['milanDePontoise', false]);
});

test('bocaux déjà gardés (lots 2 et 3, state.career.heirlooms) : à ouvrir dès le début de la Vallée, les anciens d\'abord', () => {
  const g = valleyCareer({}, 1);
  g.state.career.heirlooms.push({ cropId: 'cabbage', lotId: 'lot3', year: 1, day: 2 }, { cropId: 'corn', lotId: 'home', year: 1, day: 3, from: 'merchant' });
  nextDay(g);
  assert.equal(g.state.career.valley.started, null, 'rang 1 : pas encore');
  assert.equal(g.actions.career.openJar().reason, 'La Vallée commence au rang 2.');
  setRank(g, 2);
  nextDay(g);
  const q = g.query.career.valley();
  assert.deepEqual(q.jars.list.map((j) => [j.cropId, j.from]), [['cabbage', 'find'], ['corn', 'merchant']]);
  assert.equal(q.hint.kind, 'chapter');
  g.actions.career.readChapter(0);
  assert.equal(g.query.career.valley().hint.kind, 'jar');
  assert.equal(g.actions.career.openJar().varietyId, 'milanDePontoise');
  assert.equal(g.actions.career.openJar().varietyId, 'grandRouxBasque');
  assert.equal(g.state.career.heirlooms.length, 2, 'la liste des trouvailles ne change pas (album)');
});

test('semer une graine ancienne : gratuit, consomme une graine ; refus ; quel que soit le rang de la culture', () => {
  const g = startedCareer();
  const [i, j] = emptyPlots(g);
  const A = g.actions.career;
  assert.equal(A.sowHeirloom(i, 'nope').reason, 'Variété inconnue.');
  assert.equal(A.sowHeirloom(999, 'bouleDOr').reason, 'Parcelle inexistante.');
  assert.equal(A.sowHeirloom(i, 'coeurDeBoeuf').reason, 'Tomate ne se sème pas au printemps.');
  assert.equal(A.sowHeirloom(i, 'calvilleBlanc').reason, 'Un greffon se plante dans un verger.');
  const money = g.state.money;
  const ev = record(g);
  const r = A.sowHeirloom(i, 'bouleDOr');
  assert.deepEqual([r.ok, r.cost, r.fromSeeds, r.seedsLeft, r.cropId], [true, 0, true, 2, 'turnip']);
  assert.equal(g.state.money, money);
  assert.equal(g.state.plots[i].variety, 'bouleDOr');
  assert.equal(ev.of('planted')[0].variety, 'bouleDOr');
  assert.equal(ev.of('heirloomSown')[0].seedsLeft, 2);
  assert.equal(A.sowHeirloom(i, 'bouleDOr').reason, 'Cette parcelle n\'est pas libre.');
  const pv = g.query.plot(i).variety;
  assert.deepEqual([pv.id, pv.trial, pv.hand, pv.need, pv.seedsOnHand, pv.trait.id], ['bouleDOr', true, 0, FIX, 2, 'early']);
  g.state.career.valley.seeds.bouleDOr = 0;
  assert.equal(A.sowHeirloom(j, 'bouleDOr').reason, 'Plus de graines de Navet Boule d\'or : récoltez-en une à la main.');
  // Citrouille de la boîte (culture du rang 3) semée au rang 2, en été.
  toSeason(g, 1);
  assert.ok(!g.level.crops.includes('pumpkin'));
  const k = emptyPlots(g)[0];
  assert.ok(A.sowHeirloom(k, 'rougeVifDEtampes').ok);
  // Lignes de la feuille des graines.
  const rows = g.query.plantableCrops(emptyPlots(g)[0]);
  assert.ok(Array.isArray(rows.heirlooms) && rows.heirlooms.some((h) => h.varietyId === 'coeurDeBoeuf' && h.canSow));
  assert.equal(rows.fallow.canSow, true);
});

test('récolte à la main : + 2 graines et + 1 vers la fixation ; sauvée à 7 ; ensuite plus de graine (vente illimitée × 1,25)', () => {
  const g = startedCareer();
  const i = emptyPlots(g)[0];
  const A = g.actions.career;
  const ev = record(g);
  for (let n = 1; n <= FIX; n++) {
    assert.ok(A.sowHeirloom(i, 'bouleDOr').ok, `semis ${n}`);
    ripen(g, i);
    const r = g.actions.harvest(i);
    assert.ok(r.ok);
    assert.deepEqual([r.variety, r.seeds], ['bouleDOr', 2]);
    assert.equal(g.state.career.valley.varieties.bouleDOr.hand, n);
  }
  assert.equal(g.state.career.valley.seeds.bouleDOr, 3 + FIX * 2 - FIX);
  const types = ev.events.map((e) => e.type);
  assert.ok(types.indexOf('heirloomHarvest') > types.indexOf('harvested'));
  const fixed = ev.of('heirloomFixed');
  assert.equal(fixed.length, 1);
  assert.equal(fixed[0].text, 'Navet Boule d\'or est sauvée !');
  assert.ok(g.state.career.valley.varieties.bouleDOr.fixedAt);
  assert.equal(g.state.plots[i].lastVariety, 'bouleDOr');
  // Sauvée : la récolte à la main ne rend plus de graine, mais compte toujours (succès).
  A.sowHeirloom(i, 'bouleDOr');
  ripen(g, i);
  const after = g.actions.harvest(i);
  assert.equal(after.seeds, 0);
  assert.equal(g.state.career.valley.stats.hand, FIX + 1);
  // Graines gardées d'abord, puis prix de la culture × 1,25.
  g.state.career.valley.seeds.bouleDOr = 0;
  const cost = A.sowHeirloom(i, 'bouleDOr');
  assert.equal(cost.cost, Math.round(getCrop('turnip').seedCost * SEED_RULES.fixedSeedFactor));
  assert.equal(g.query.career.valley().varieties.find((x) => x.id === 'bouleDOr').state, 'fixed');
});

test('équipe et machines : leurs récoltes ne gardent jamais de graine ni ne comptent pour la fixation', () => {
  const t = withExtension();
  try {
    const g = startedCareer();
    const api = t.api();
    const i = emptyPlots(g)[0];
    g.actions.career.sowHeirloom(i, 'bouleDOr');
    ripen(g, i);
    const r = api.harvest(i, { by: 'staff' });
    assert.ok(r.ok);
    assert.equal(r.seeds, 0);
    assert.equal(g.state.career.valley.seeds.bouleDOr, 2);
    assert.equal(g.state.career.valley.varieties.bouleDOr.hand, 0);
    g.actions.career.sowHeirloom(i, 'bouleDOr');
    ripen(g, i);
    assert.equal(api.harvest(i, { by: 'machine' }).seeds, 0);
    assert.equal(g.state.career.valley.varieties.bouleDOr.hand, 0);
  } finally {
    t.off();
  }
});

test('équipe et semoir : une variété pas encore sauvée jamais ; une variété sauvée par le plan (heirloom:<id> ou « même culture »)', () => {
  const t = withExtension();
  try {
    const g = startedCareer();
    const api = t.api();
    const [i, j] = emptyPlots(g);
    // Pas encore sauvée : le plan la refuse ; « même culture » → la culture ordinaire.
    assert.match(g.actions.career.setPlan('start', 'spring', 'heirloom:bouleDOr').reason, /sauvez-la d'abord/);
    g.actions.career.sowHeirloom(i, 'bouleDOr');
    ripen(g, i);
    g.actions.harvest(i);
    assert.equal(g.state.plots[i].lastVariety, 'bouleDOr');
    assert.equal(api.plant(j, 'heirloom:bouleDOr', { by: 'staff' }).reason, 'Une variété pas encore sauvée se sème à la main.');
    assert.equal(sowChoice(api, i), 'turnip');
    // Sauvée.
    g.actions.career.triggerValley('fix', 'bouleDOr');
    assert.equal(sowChoice(api, i), 'heirloom:bouleDOr');
    assert.ok(g.actions.career.setPlan('start', 'spring', 'heirloom:bouleDOr').ok);
    assert.equal(sowChoice(api, j), 'heirloom:bouleDOr');
    const seeds = g.state.career.valley.seeds.bouleDOr;
    const r = api.plant(j, sowChoice(api, j), { by: 'machine' });
    assert.ok(r.ok);
    assert.equal(r.cost, 0, 'graine gardée d\'abord');
    assert.equal(g.state.career.valley.seeds.bouleDOr, seeds - 1);
    assert.equal(g.state.plots[j].variety, 'bouleDOr');
    g.state.career.valley.seeds.bouleDOr = 0;
    const k = emptyPlots(g)[0];
    const r2 = api.plant(k, 'heirloom:bouleDOr', { by: 'staff' });
    assert.equal(r2.cost, Math.round(api.seedCost('turnip') * SEED_RULES.fixedSeedFactor));
    ripen(g, k);
    assert.equal(api.harvest(k, { by: 'staff' }).seeds, 0);
    assert.equal(g.state.career.valley.seeds.bouleDOr, 0, 'l\'équipe ne garde jamais de graine');
    // La sauvegarde accepte le plan.
    assert.equal(g.state.career.lots[1].plan.spring, 'heirloom:bouleDOr');
  } finally {
    t.off();
  }
});

test('un jardinier sème la variété sauvée du plan dans la journée, sans garder de graine à la récolte', () => {
  const g = startedCareer();
  setRank(g, 3);
  g.actions.career.triggerValley('fix', 'bouleDOr');
  g.state.career.valley.seeds.bouleDOr = 0;
  assert.ok(g.actions.career.setPlan('start', 'spring', 'heirloom:bouleDOr').ok);
  hireAs(g, 'gardener', 'start');
  nextDay(g);
  nextDay(g);
  const sown = g.state.plots.filter((p) => p.lot === 'start' && p.variety === 'bouleDOr').length;
  assert.ok(sown > 0, 'des navets Boule d\'or semés par le jardinier');
  assert.equal(g.state.career.valley.seeds.bouleDOr, 0);
});

test('une variété ancienne ne va jamais au grenier (vendue tout de suite)', () => {
  const g = startedCareer();
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  g.actions.career.setStorageMode('always');
  const [i, j] = emptyPlots(g);
  g.actions.career.sowHeirloom(i, 'bouleDOr');
  g.actions.plant(j, 'turnip');
  ripen(g, i);
  ripen(g, j);
  assert.equal(g.actions.harvest(i).stored, false);
  assert.equal(g.actions.harvest(j).stored, true);
});

test('traits : précoce (× 1,15), sobre (sans arrosage = arrosé), savoureuse (+ 10 %), généreuse (+ 4 / + 1 points), géante (× 2)', () => {
  const g = startedCareer();
  const [i, j] = emptyPlots(g);
  g.actions.career.sowHeirloom(i, 'bouleDOr');
  g.actions.plant(j, 'turnip');
  g.actions.water(i);
  g.actions.water(j);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - 1.15 * g.state.plots[j].growth) < 1e-9, 'précoce');
  // Sobre : un jour sans arrosage compte comme arrosé ; pas besoin d'arroser (sauf canicule).
  g.actions.career.triggerValley('seeds', 'rougeDeBordeaux', 3);
  const [a, b] = emptyPlots(g);
  g.actions.career.sowHeirloom(a, 'rougeDeBordeaux');
  g.actions.plant(b, 'wheat');
  assert.equal(g.query.plot(a).needsWater, false);
  assert.equal(g.query.plot(a).action, null);
  assert.equal(g.query.plot(b).action, 'water');
  nextDay(g);
  assert.equal(g.state.plots[a].growth, 1);
  assert.ok(g.state.plots[b].growth < 1);
  // Savoureuse : + 10 % à la vente.
  g.actions.career.triggerValley('seeds', 'jauneDuDoubs', 3);
  const [c, d] = emptyPlots(g);
  g.actions.career.sowHeirloom(c, 'jauneDuDoubs');
  g.actions.plant(d, 'carrot');
  ripen(g, c);
  ripen(g, d);
  const vc = g.query.plot(c).handValue;
  const vd = g.query.plot(d).handValue;
  assert.ok(Math.abs(vc - vd * 1.1) <= 1, `${vc} ≈ ${vd} × 1,1`);
  // Généreuse : qualité.
  const p = { ...g.state.plots[d], variety: 'milanDePontoise', cropId: 'cabbage' };
  const q0 = qualityChances(g.state, { ...p, variety: undefined }, true);
  const q1 = qualityChances(g.state, p, true);
  const q2 = qualityChances(g.state, p, false);
  assert.ok(Math.abs(q1.fine - q0.fine - TRAITS_BY_ID.fine.fine) < 1e-9);
  assert.ok(Math.abs(q1.gold - q0.gold - TRAITS_BY_ID.fine.gold) < 1e-9);
  assert.equal(q2.gold, 0);
  // Géante : × 2 pour un carré de 4 parcelles de la variété.
  const sq = [0, 1, 2, 3].map(() => ({ variety: 'rougeVifDEtampes', cropId: 'pumpkin' }));
  assert.equal(giantFactorOf(g.state, sq), 2);
  assert.equal(giantFactorOf(g.state, [...sq.slice(0, 3), { cropId: 'pumpkin' }]), 1);
});

test('rustique : passe le gel du 1er jour d\'hiver, puis pousse × 0,5 l\'hiver (hors serre)', () => {
  const g = startedCareer();
  toSeason(g, 2);
  g.actions.career.triggerValley('seeds', 'grandRouxBasque', 3);
  const [i, j] = emptyPlots(g);
  g.actions.career.sowHeirloom(i, 'grandRouxBasque');
  g.actions.plant(j, 'corn');
  const L = g.state.career.seasonLength;
  for (let d = 1; d < L; d++) nextDay(g);
  g.state.plots[i].growth = 1;
  g.state.plots[j].growth = 1;
  nextDay(g);
  assert.equal(g.state.time.seasonIndex, 3);
  assert.equal(g.state.plots[j].cropId, null, 'le maïs ordinaire a gelé');
  assert.equal(g.state.plots[i].cropId, 'corn', 'le maïs grand roux basque est resté');
  const before = g.state.plots[i].growth;
  g.actions.water(i);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - before - 0.5) < 1e-9);
});

test('mellifère : 2 parcelles en pousse → chaque ruche + 1 pièce par jour (hors hiver) ; un coin fleuri', () => {
  const g = startedCareer();
  g.state.investments.beehive = 2;
  g.refreshLevel();
  g.actions.career.triggerValley('seeds', 'reineDesVallees', 3);
  const [i, j] = emptyPlots(g);
  g.actions.career.sowHeirloom(i, 'reineDesVallees');
  g.actions.career.sowHeirloom(j, 'reineDesVallees');
  const ev = record(g);
  nextDay(g);
  const inc = ev.of('dawn')[0].incomes.find((x) => x.source === 'valleyBees');
  assert.ok(inc);
  assert.equal(inc.amount, 2);
});

test('jachère fleurie : gratuite, jusqu\'à la fin de la saison, puis sol reposé (+ 10 % ; étape 4 : + 20 %) ; jamais l\'équipe', () => {
  const t = withExtension();
  try {
    const g = startedCareer();
    const api = t.api();
    const [i, j] = emptyPlots(g);
    const A = g.actions.career;
    const ev = record(g);
    const r = A.sowFallow(i);
    assert.deepEqual([r.ok, r.until], [true, 0]);
    assert.equal(A.sowFallow(i).reason, 'Déjà en jachère.');
    assert.equal(A.sowFallow(9999).reason, 'Une jachère se fait sur une parcelle de champ vide.');
    assert.equal(g.query.plot(i).fallow.until, 0);
    assert.equal(sowChoice(api, i), null, 'ni le semoir ni les jardiniers sur une jachère');
    assert.match(api.plant(i, 'carrot', { by: 'staff' }).reason, /Jachère/);
    // Le joueur sème par-dessus : elle s'arrête, sans sol reposé.
    A.sowFallow(j);
    const p = g.actions.plant(j, 'carrot');
    assert.equal(p.fallowCancelled, true);
    assert.equal(g.state.plots[j].fallow, undefined);
    toSeason(g, 1);
    assert.deepEqual(ev.of('fallowEnded')[0].plots, [i]);
    assert.equal(g.state.plots[i].rested, true);
    assert.equal(g.state.plots[i].fallow, undefined);
    // Sol reposé : la culture suivante pousse + 10 %, effacé à sa récolte.
    const k = emptyPlots(g).find((x) => x !== i);
    g.actions.plant(i, 'wheat');
    g.actions.plant(k, 'wheat');
    g.actions.water(i);
    g.actions.water(k);
    nextDay(g);
    assert.ok(Math.abs(g.state.plots[i].growth - (1 + FALLOW.growth) * g.state.plots[k].growth) < 1e-9);
    ripen(g, i);
    g.actions.harvest(i);
    assert.equal(g.state.plots[i].rested, undefined);
  } finally {
    t.off();
  }
});

test('pommier Calville : un greffon au verger, + 1 greffon par panier cueilli à la main', () => {
  const g = startedCareer();
  const lot = g.actions.career.buyLot();
  assert.ok(g.actions.career.developLot(lot.lotId, 'orchard').ok);
  g.actions.career.triggerValley('seeds', 'calvilleBlanc', 1);
  const i = g.state.plots.findIndex((p) => p.lot === lot.lotId && p.env === 'orchard');
  assert.equal(g.actions.career.sowHeirloom(emptyPlots(g)[0], 'calvilleBlanc').reason, 'Un greffon se plante dans un verger.');
  const r = g.actions.career.sowHeirloom(i, 'calvilleBlanc');
  assert.ok(r.ok, r.reason);
  const p = g.state.plots[i];
  assert.equal(p.variety, 'calvilleBlanc');
  p.growth = treeGrowDays(g.state, getCrop('apple'));
  p.fruit = getCrop('apple').fruitDays;
  const h = g.actions.harvest(i);
  assert.equal(h.seeds, 1);
  assert.equal(g.state.career.valley.seeds.calvilleBlanc, 1);
  assert.equal(p.variety, 'calvilleBlanc', 'l\'arbre reste');
  assert.equal(g.query.career.valley().varieties.find((x) => x.id === 'calvilleBlanc').unit, 'greffon');
  assert.equal(VARIETIES_BY_ID.calvilleBlanc.cropId, 'apple');
});
