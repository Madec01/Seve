// Ateliers (v3) : places, entrée des récoltes et du lait, avancement, ventes, interrupteur,
// vente en l'état, filets de sécurité, fromagerie (priorité au lait de vache), moulin et four à pain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goToDay, newGame, nextDay, record, rich } from './helpers.js';
import { loadGame } from '../src/core/game.js';
import { getInvestment } from '../src/data/investments.js';
import { PRODUCTS, getProduct, productsFor, recipeFor } from '../src/data/products.js';
import { getPerk } from '../src/data/perks.js';

/** Rend la parcelle i récoltable avec cette culture (tests de l'atelier, sans attendre la pousse). */
function ripe(g, i, cropId) {
  const p = g.state.plots[i];
  p.unlocked = true;
  p.cropId = cropId;
  p.growth = { strawberry: 4, wheat: 4, carrot: 2, pumpkin: 7, tomato: 5 }[cropId] ?? 6;
  if (cropId === 'apple') p.fruit = 3;
}

test('produits : données et recettes', () => {
  assert.deepEqual(PRODUCTS.map((p) => p.id), ['strawberryJam', 'appleJuice', 'cowCheese', 'goatCheese', 'flour', 'bread']);
  assert.equal(getProduct('strawberryJam').value, 46);
  assert.equal(recipeFor('mill', 1, 'wheat').id, 'flour');
  assert.equal(recipeFor('mill', 2, 'wheat').id, 'flour');
  assert.equal(recipeFor('mill', 3, 'wheat').id, 'bread');
  assert.equal(recipeFor('jamWorkshop', 1, 'wheat'), null);
  assert.deepEqual(productsFor('mill').map((p) => p.id), ['flour', 'bread']);
  assert.deepEqual(productsFor('mill', 3).map((p) => p.id), ['bread']);
  for (const id of ['jamWorkshop', 'dairy', 'mill']) {
    const inv = getInvestment(id);
    assert.equal(inv.kind, 'upgrade');
    assert.equal(inv.category, 'processing');
    assert.deepEqual(inv.effects.processing.places, [2, 3, 4]);
  }
  assert.deepEqual(getInvestment('dairy').requiresAny, ['cow', 'goat']);
  assert.equal(getInvestment('cow').effects.milk, true);
  assert.equal(getInvestment('goat').effects.milk, true);
});

test('achat d’un atelier : places créées (interrupteur allumé), améliorations, Artisan', () => {
  const g = newGame(9);
  rich(g);
  const rec = record(g);
  let seen = null;
  g.on('purchased', () => (seen = JSON.parse(JSON.stringify(g.state.processing.jamWorkshop))));
  const price = getInvestment('jamWorkshop').costs[0];
  assert.deepEqual(g.actions.buyInvestment('jamWorkshop'), { ok: true, owned: 1, cost: price });
  assert.deepEqual(seen, { on: true, places: [null, null] }, 'l’atelier existe quand purchased part');
  assert.deepEqual(rec.of('purchased')[0], { type: 'purchased', investmentId: 'jamWorkshop', owned: 1, cost: price });
  g.actions.buyInvestment('jamWorkshop');
  assert.equal(g.state.processing.jamWorkshop.places.length, 3);
  g.actions.buyInvestment('jamWorkshop');
  assert.equal(g.state.processing.jamWorkshop.places.length, 4);
  assert.equal(g.actions.buyInvestment('jamWorkshop').reason, 'Niveau maximal atteint.');
  const a = newGame(9, 42, { perks: { artisan: 1 } });
  rich(a);
  a.actions.buyInvestment('jamWorkshop');
  assert.equal(a.state.processing.jamWorkshop.places.length, 3);
  assert.equal(a.query.processing()[0].capacity, 3);
  // Entretien quotidien forfaitaire.
  assert.equal(g.query.finance().dailyCharges, 5 + 1);
});

test('récolte transformable : part à l’atelier (0 pièce), puis vendue toute seule à l’aube', () => {
  const g = newGame(9);
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  ripe(g, 1, 'strawberry');
  const q = g.query.plot(1);
  assert.deepEqual(q.processTarget, { buildingId: 'jamWorkshop', productId: 'strawberryJam', productName: 'Confiture de fraises', value: 46, hasRoom: true, on: true });
  const rec = record(g);
  const money = g.state.money;
  const r = g.actions.harvest(1);
  assert.deepEqual(r, { ok: true, amount: 0, cropId: 'strawberry', tree: false, processed: { buildingId: 'jamWorkshop', productId: 'strawberryJam', placeIndex: 0 } });
  assert.equal(g.state.money, money);
  assert.deepEqual(rec.of('harvested')[0], { type: 'harvested', plotIndex: 1, cropId: 'strawberry', amount: 0, fatigue: false, tree: false, processed: r.processed });
  assert.deepEqual(rec.of('processingStarted')[0], {
    type: 'processingStarted', buildingId: 'jamWorkshop', placeIndex: 0, productId: 'strawberryJam', input: 'strawberry', source: 'harvest', plotIndex: 1,
  });
  // Valeur « en l'état » = prix brut de la récolte à l'entrée, baisse du niveau 9 comprise (26 × 0,75 = 19,5 → 20).
  assert.deepEqual(g.state.processing.jamWorkshop.places[0], { productId: 'strawberryJam', input: 'strawberry', source: 'harvest', daysLeft: 2, rawValue: 20, yieldFactor: 1 });
  assert.equal(g.state.stats.year.cropsHarvested.strawberry, 1);
  assert.equal(g.state.stats.year.harvestIncome, 0);
  const proc = g.query.processing()[0];
  assert.equal(proc.value, 46);
  assert.equal(proc.rawValue, 20);
  assert.deepEqual(proc.places[0], { productId: 'strawberryJam', productName: 'Confiture de fraises', input: 'strawberry', daysLeft: 2, days: 2, value: 46, rawValue: 20 });
  assert.equal(g.query.finance().processingValue, 46);
  assert.equal(g.query.finance().processingRawValue, 20);
  rec.clear();
  nextDay(g);
  assert.equal(g.state.processing.jamWorkshop.places[0].daysLeft, 1);
  assert.equal(rec.of('productSold').length, 0);
  nextDay(g);
  assert.equal(g.state.processing.jamWorkshop.places[0], null);
  assert.deepEqual(rec.of('productSold'), [{ type: 'productSold', buildingId: 'jamWorkshop', productId: 'strawberryJam', amount: 46, placeIndex: 0 }]);
  const dawn = rec.of('dawn').at(-1);
  assert.deepEqual(dawn.incomes[0], { source: 'jamWorkshop', amount: 46, owned: 1, kind: 'processed', productId: 'strawberryJam' });
  assert.equal(g.state.stats.year.productIncome, 46);
  assert.deepEqual(g.state.stats.year.productsSold, { strawberryJam: 1 });
  assert.equal(g.state.stats.year.investmentIncome, 0, 'les produits ne sont pas des revenus d’investissement');
  assert.equal(g.query.summary().net, g.state.money - 1000, 'le bilan compte les produits vendus');
});

test('atelier plein, ou éteint : la récolte est vendue normalement ; ce qui est en cours continue', () => {
  const g = newGame(9);
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  for (const i of [1, 2, 3]) ripe(g, i, 'strawberry');
  assert.equal(g.actions.harvest(1).amount, 0);
  assert.equal(g.actions.harvest(2).amount, 0);
  assert.equal(g.query.plot(3).processTarget.hasRoom, false);
  const full = g.actions.harvest(3);
  assert.equal(full.amount, 20);
  assert.equal(full.processed, null);
  // Interrupteur
  const rec = record(g);
  assert.deepEqual(g.actions.setProcessing('jamWorkshop', false), { ok: true, on: false });
  assert.deepEqual(rec.of('processingToggled'), [{ type: 'processingToggled', buildingId: 'jamWorkshop', on: false }]);
  nextDay(g);
  nextDay(g);
  assert.equal(rec.of('productSold').length, 2, 'éteint : ce qui est en cours se vend quand même');
  ripe(g, 4, 'strawberry');
  assert.equal(g.query.plot(4).processTarget.hasRoom, false);
  assert.equal(g.query.plot(4).processTarget.on, false);
  assert.equal(g.actions.harvest(4).amount, 20);
  assert.equal(g.actions.setProcessing('jamWorkshop', true).on, true);
  ripe(g, 5, 'strawberry');
  assert.equal(g.actions.harvest(5).amount, 0);
  assert.equal(g.actions.setProcessing('mill', true).ok, false);
  assert.equal(g.actions.setProcessing('dragon', true).reason, 'Atelier inconnu.');
});

test('vendre en l’état : prix brut fixé à l’entrée, événement, statistiques', () => {
  const g = newGame(9);
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  assert.equal(g.actions.sellProcessing('jamWorkshop').reason, "Rien à vendre : l'atelier est vide.");
  ripe(g, 1, 'strawberry');
  ripe(g, 2, 'apple');
  g.actions.harvest(1);
  g.actions.harvest(2);
  g.actions.buyInvestment('roadsideStand'); // n'y change rien : valeur fixée à l'entrée
  const rec = record(g);
  const money = g.state.money;
  const r = g.actions.sellProcessing('jamWorkshop');
  assert.deepEqual(r, { ok: true, amount: 20 + 20, count: 2 });
  assert.equal(g.state.money, money + 40);
  assert.deepEqual(rec.of('processingSoldRaw'), [{ type: 'processingSoldRaw', buildingId: 'jamWorkshop', amount: 40, count: 2, reason: 'player' }]);
  assert.deepEqual(g.state.processing.jamWorkshop.places, [null, null]);
  assert.equal(g.state.stats.year.rawSales, 40);
  assert.equal(g.actions.sellProcessing('mill').ok, false);
});

test('prix d’un produit : étal, Réputation, Recettes de grand-mère, rendement ; ni cours ni baisse du niveau', () => {
  const g = newGame(9, 42, { perks: { famousStand: 1, grandmaRecipes: 1 } });
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  g.actions.buyInvestment('roadsideStand');
  ripe(g, 1, 'strawberry');
  g.actions.harvest(1);
  const pb = getPerk('grandmaRecipes').effect.values[0];
  const fs = getPerk('famousStand').effect.values[0];
  assert.equal(g.query.processing()[0].places[0].value, Math.round(46 * (1 + pb) * (1.2 + fs)));
  // Pollinisation (niveau 10) : jus à moitié prix sans ruche, calculé à la vente.
  const h = newGame(10);
  rich(h, 1000);
  h.actions.buyInvestment('jamWorkshop');
  ripe(h, 0, 'apple');
  assert.equal(h.query.plot(0).processTarget.value, 22);
  const r = h.actions.harvest(0);
  assert.equal(r.amount, 0);
  assert.equal(h.state.processing.jamWorkshop.places[0].yieldFactor, 0.5);
  assert.equal(h.state.processing.jamWorkshop.places[0].rawValue, 13);
  h.actions.buyInvestment('beehive');
  const sold = [];
  h.on('productSold', (e) => sold.push(e.amount));
  nextDay(h);
  assert.deepEqual(sold, [22], 'le rendement est celui de la récolte d’origine');
});

test('la valeur de vente se calcule à la vente (un étal acheté entre-temps compte)', () => {
  const g = newGame(12);
  rich(g, 2000);
  g.actions.buyInvestment('jamWorkshop');
  ripe(g, 1, 'strawberry');
  g.actions.harvest(1);
  g.actions.buyInvestment('roadsideStand');
  const sold = [];
  g.on('productSold', (e) => sold.push(e.amount));
  nextDay(g);
  nextDay(g);
  assert.deepEqual(sold, [Math.round(46 * 1.2)]);
});

test('filet de sécurité : l’argent manque au fermage → produits vendus en l’état avant de décider', () => {
  const g = newGame(9);
  rich(g, 1000);
  g.actions.buyInvestment('jamWorkshop');
  goToDay(g, 7);
  ripe(g, 1, 'strawberry');
  ripe(g, 2, 'strawberry');
  g.actions.harvest(1);
  g.actions.harvest(2);
  const rent = g.query.finance().nextBill.amount;
  g.state.money = rent - 30; // les 2 × 20 en l'état suffisent
  assert.equal(g.query.finance().rentAutoSell, true);
  const rec = record(g);
  nextDay(g);
  assert.equal(g.state.status, 'playing');
  const sold = rec.of('processingSoldRaw');
  assert.deepEqual(sold, [{ type: 'processingSoldRaw', buildingId: 'jamWorkshop', amount: 40, count: 2, reason: 'rent' }]);
  const types = rec.events.map((e) => e.type);
  assert.ok(types.indexOf('processingSoldRaw') < types.indexOf('billPaid'));
  assert.equal(rec.of('billPaid')[0].amount, rent);
  // Si les produits ne suffisent pas : faillite quand même, mais rien n'est perdu (vendu d'abord).
  const h = newGame(9);
  rich(h, 1000);
  h.actions.buyInvestment('jamWorkshop');
  goToDay(h, 7);
  ripe(h, 1, 'strawberry');
  h.actions.harvest(1);
  h.state.money = 0;
  const rec2 = record(h);
  nextDay(h);
  assert.equal(h.state.status, 'bankrupt');
  assert.equal(rec2.of('processingSoldRaw')[0].amount, 20);
  assert.equal(rec2.of('bankrupt')[0].money, 20);
});

test('filet de sécurité : assez d’argent → rien n’est vendu au fermage (sauf fin d’année)', () => {
  const g = newGame(9);
  rich(g, 5000);
  g.actions.buyInvestment('jamWorkshop');
  goToDay(g, 7);
  ripe(g, 1, 'strawberry');
  g.actions.harvest(1);
  assert.equal(g.query.finance().rentAutoSell, false);
  const rec = record(g);
  nextDay(g);
  assert.equal(rec.of('processingSoldRaw').length, 0);
  assert.equal(g.state.processing.jamWorkshop.places[0].daysLeft, 1);
  // Soir du dernier jour de l'année : tout ce qui est en cours est vendu en l'état.
  goToDay(g, 28);
  ripe(g, 2, 'apple');
  g.actions.harvest(2);
  assert.equal(g.query.finance().rentAutoSell, true);
  rec.clear();
  nextDay(g);
  assert.equal(g.state.status, 'victory');
  assert.deepEqual(rec.of('processingSoldRaw'), [{ type: 'processingSoldRaw', buildingId: 'jamWorkshop', amount: 20, count: 1, reason: 'yearEnd' }]);
  const types = rec.events.map((e) => e.type);
  assert.ok(types.indexOf('processingSoldRaw') < types.indexOf('billPaid'));
  assert.equal(rec.of('victory')[0].summary.rawSales, 20);
});

test('fromagerie : condition (vache ou chèvre), lait des chèvres (niveau 11)', () => {
  const g = newGame(11);
  rich(g);
  assert.equal(g.actions.buyInvestment('dairy').reason, "Il faut d'abord une vache ou une chèvre.");
  assert.equal(g.query.investments().find((i) => i.id === 'dairy').reason, "Il faut d'abord une vache ou une chèvre.");
  g.actions.buyInvestment('goat');
  assert.equal(g.actions.buyInvestment('dairy').ok, true);
  const rec = record(g);
  nextDay(g);
  const dawn = rec.of('dawn')[0];
  assert.deepEqual(dawn.milkToDairy, [{ animalId: 'goat', count: 1 }]);
  assert.ok(!dawn.incomes.some((i) => i.source === 'goat'), 'le lait parti à la fromagerie ne rapporte rien ce jour-là');
  assert.deepEqual(rec.of('processingStarted'), [{ type: 'processingStarted', buildingId: 'dairy', placeIndex: 0, productId: 'goatCheese', input: 'goat', source: 'animal' }]);
  assert.deepEqual(g.state.processing.dairy.places[0], { productId: 'goatCheese', input: 'goat', source: 'animal', daysLeft: 2, rawValue: 9, yieldFactor: 1 });
  nextDay(g); // 2e place remplie
  nextDay(g); // 1re vendue puis remplie à nouveau
  assert.deepEqual(rec.of('productSold').map((e) => [e.productId, e.amount]), [['goatCheese', 20]]);
  assert.equal(g.state.stats.year.productsSold.goatCheese, 1);
});

test('fromagerie : le lait des vaches passe avant celui des chèvres ; places pleines → les animaux paient', () => {
  const g = newGame(12);
  rich(g, 5000);
  g.actions.buyInvestment('cow');
  g.actions.buyInvestment('cow');
  g.actions.buyInvestment('goat');
  g.actions.buyInvestment('dairy');
  const rec = record(g);
  nextDay(g);
  let dawn = rec.of('dawn').at(-1);
  assert.deepEqual(dawn.milkToDairy, [{ animalId: 'cow', count: 2 }]);
  assert.ok(!dawn.incomes.some((i) => i.source === 'cow'));
  assert.deepEqual(dawn.incomes.find((i) => i.source === 'goat'), { source: 'goat', amount: 9, owned: 1, kind: 'daily' });
  nextDay(g); // places occupées : tout le monde paie
  dawn = rec.of('dawn').at(-1);
  assert.deepEqual(dawn.milkToDairy, []);
  assert.equal(dawn.incomes.find((i) => i.source === 'cow').amount, 32);
  nextDay(g); // 2 fromages de vache vendus, places remplies par les vaches
  dawn = rec.of('dawn').at(-1);
  assert.deepEqual(dawn.incomes.filter((i) => i.kind === 'processed').map((i) => i.amount), [30, 30]);
  assert.deepEqual(dawn.milkToDairy, [{ animalId: 'cow', count: 2 }]);
  // 2e niveau : 3 places ; la nouvelle va encore à une vache (lait le plus cher), l'autre vache et la chèvre paient.
  g.actions.buyInvestment('dairy');
  nextDay(g);
  dawn = rec.of('dawn').at(-1);
  assert.deepEqual(dawn.milkToDairy, [{ animalId: 'cow', count: 1 }]);
  assert.equal(dawn.incomes.find((i) => i.source === 'cow').amount, 16);
  assert.equal(dawn.incomes.find((i) => i.source === 'goat').amount, 9);
  // Avec « Artisan » (4 places au 2e niveau), il reste une place pour la chèvre.
  const a = newGame(12, 42, { perks: { artisan: 1 } });
  rich(a, 5000);
  for (const id of ['cow', 'cow', 'goat', 'dairy', 'dairy']) a.actions.buyInvestment(id);
  const recA = record(a);
  nextDay(a);
  assert.deepEqual(recA.of('dawn')[0].milkToDairy, [{ animalId: 'cow', count: 2 }, { animalId: 'goat', count: 1 }]);
  // Une seule vache sur deux entre quand il ne reste qu'une place.
  const h = newGame(12);
  rich(h, 5000);
  h.actions.buyInvestment('cow');
  h.actions.buyInvestment('cow');
  h.actions.buyInvestment('dairy');
  h.state.processing.dairy.places[0] = { productId: 'cowCheese', input: 'cow', source: 'animal', daysLeft: 5, rawValue: 16, yieldFactor: 1 };
  const rec2 = record(h);
  nextDay(h);
  const d2 = rec2.of('dawn')[0];
  assert.deepEqual(d2.milkToDairy, [{ animalId: 'cow', count: 1 }]);
  assert.equal(d2.incomes.find((i) => i.source === 'cow').amount, 16);
});

test('fromagerie éteinte : le lait est vendu', () => {
  const g = newGame(11);
  rich(g);
  g.actions.buyInvestment('goat');
  g.actions.buyInvestment('dairy');
  g.actions.setProcessing('dairy', false);
  const rec = record(g);
  nextDay(g);
  assert.deepEqual(rec.of('dawn')[0].milkToDairy, []);
  assert.equal(rec.of('dawn')[0].incomes.find((i) => i.source === 'goat').amount, 9);
});

test('moulin : farine (1 j) aux niveaux 1-2, pain (2 j) avec le four du niveau 3', () => {
  const g = newGame(12);
  rich(g, 5000);
  g.actions.buyInvestment('mill');
  ripe(g, 1, 'wheat');
  assert.equal(g.actions.harvest(1).processed.productId, 'flour');
  const sold = [];
  g.on('productSold', (e) => sold.push([e.productId, e.amount]));
  nextDay(g);
  assert.deepEqual(sold, [['flour', 28]]);
  g.actions.buyInvestment('mill');
  g.actions.buyInvestment('mill');
  const inv = g.query.investments().find((i) => i.id === 'mill');
  assert.equal(inv.processing.level, 3);
  assert.equal(inv.processing.places, 4);
  assert.deepEqual(inv.processing.recipes.map((r) => [r.productId, r.active]), [['flour', false], ['bread', true]]);
  ripe(g, 2, 'wheat');
  assert.equal(g.query.plot(2).processTarget.productId, 'bread');
  assert.equal(g.actions.harvest(2).processed.productId, 'bread');
  nextDay(g);
  nextDay(g);
  assert.deepEqual(sold.at(-1), ['bread', 44]);
});

test('requêtes : investments().processing, plantableCrops().product, catégories', () => {
  const g = newGame(12);
  rich(g, 5000);
  let inv = g.query.investments().find((i) => i.id === 'jamWorkshop');
  assert.equal(inv.category, 'processing');
  assert.deepEqual(inv.processing, {
    level: 0,
    places: 0,
    nextPlaces: 2,
    on: false,
    used: 0,
    recipes: [
      { input: 'strawberry', inputName: 'Fraise', productId: 'strawberryJam', productName: 'Confiture de fraises', days: 2, value: 46, active: true, minLevel: 1 },
      { input: 'apple', inputName: 'Pommier', productId: 'appleJuice', productName: 'Jus de pomme', days: 1, value: 44, active: true, minLevel: 1 },
    ],
  });
  assert.equal(g.query.investments().find((i) => i.id === 'chickenCoop').processing, null);
  assert.deepEqual(g.query.investments().find((i) => i.id === 'dairy').requiresAny, ['cow', 'goat']);
  let straw = g.query.plantableCrops().find((c) => c.id === 'strawberry');
  assert.deepEqual(straw.product, { buildingId: 'jamWorkshop', productId: 'strawberryJam', name: 'Confiture de fraises', value: 46, days: 2, owned: false });
  g.actions.buyInvestment('jamWorkshop');
  inv = g.query.investments().find((i) => i.id === 'jamWorkshop');
  assert.equal(inv.processing.level, 1);
  assert.equal(inv.processing.places, 2);
  assert.equal(inv.processing.nextPlaces, 3);
  assert.equal(inv.processing.on, true);
  straw = g.query.plantableCrops().find((c) => c.id === 'strawberry');
  assert.equal(straw.product.owned, true);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'carrot').product, null);
  // Niveau sans atelier : aucune recette proposée.
  const h = newGame(11);
  assert.equal(h.query.plantableCrops().find((c) => c.id === 'strawberry').product, null);
});

test('sauvegarde : ateliers en cours rechargés à l’identique ; places abîmées refusées', () => {
  const g = newGame(12);
  rich(g, 5000);
  g.actions.buyInvestment('jamWorkshop');
  g.actions.buyInvestment('cow');
  g.actions.buyInvestment('dairy');
  ripe(g, 1, 'strawberry');
  g.actions.harvest(1);
  g.actions.setProcessing('dairy', false);
  nextDay(g);
  const saved = g.serialize();
  const h = loadGame(saved);
  assert.deepEqual(h.state, g.state);
  const broken = (patch) => {
    const s = JSON.parse(JSON.stringify(saved));
    patch(s);
    return s;
  };
  const cases = {
    'atelier non possédé': (s) => (s.processing.mill = { on: true, places: [null, null] }),
    'atelier possédé absent': (s) => delete s.processing.jamWorkshop,
    'trop de places': (s) => s.processing.jamWorkshop.places.push(null, null),
    'produit inconnu': (s) => (s.processing.jamWorkshop.places[0].productId = 'caviar'),
    'produit d’un autre atelier': (s) => (s.processing.jamWorkshop.places[0].productId = 'cowCheese'),
    'jours restants invalides': (s) => (s.processing.jamWorkshop.places[0].daysLeft = 0),
    'interrupteur invalide': (s) => (s.processing.dairy.on = 'oui'),
    'ateliers absents': (s) => delete s.processing,
  };
  for (const [name, patch] of Object.entries(cases)) assert.throws(() => loadGame(broken(patch)), /Sauvegarde invalide/, name);
});
