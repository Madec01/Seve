// Bonus permanents dans une partie (v3) : chaque effet, un par un ; copie au lancement ; nettoyage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goToDay, newGame, nextDay, record, rich } from './helpers.js';
import { createGame, loadGame } from '../src/core/game.js';
import { PERKS, PERK_TIERS, getPerk } from '../src/data/perks.js';
import { getCrop, NEW_CROPS } from '../src/data/crops.js';
import { getInvestment } from '../src/data/investments.js';
import { getLevel } from '../src/data/levels.js';
import { normalizeRunPerks, perkValue } from '../src/core/perks.js';

const freePlot = (g) => g.state.plots.findIndex((p) => p.unlocked && !p.cropId);
/** Valeur d'effet d'un bonus au rang donné (les chiffres viennent des données : réglables). */
const V = (id, rank = 1) => getPerk(id).effect.values[rank - 1];

test('bonus : données (14 bonus, 3 paliers, 41 étoiles pour tout acheter)', () => {
  assert.equal(PERKS.length, 14);
  assert.deepEqual(PERK_TIERS, [{ tier: 1, starsRequired: 0 }, { tier: 2, starsRequired: 8 }, { tier: 3, starsRequired: 18 }]);
  const total = PERKS.reduce((s, p) => s + p.costs.reduce((a, b) => a + b, 0), 0);
  assert.equal(total, 41);
  for (const p of PERKS) {
    assert.ok([1, 2, 3].includes(p.tier), p.id);
    assert.equal(p.effect.values.length, p.costs.length, p.id);
    assert.ok(p.name && p.description.length > 10, p.id);
    assert.equal(getPerk(p.id), p);
  }
  assert.deepEqual(getPerk('startPurse').costs, [2, 3]);
});

test('createGame : bonus copiés et nettoyés (ids inconnus, rangs invalides ignorés, rang plafonné)', () => {
  const g = createGame({ levelId: 1, seed: 1, perks: { almanac: 1, startPurse: 9, dragon: 1, goodSeeds: 0, frugal: 'oui', haggler: 1.5 } });
  assert.deepEqual(g.state.perks, { almanac: 1, startPurse: 2 });
  assert.deepEqual(g.query.perks(), [
    { id: 'almanac', name: 'Almanach', rank: 1, description: getPerk('almanac').description },
    { id: 'startPurse', name: 'Bas de laine', rank: 2, description: getPerk('startPurse').description },
  ]);
  const perks = { almanac: 1 };
  const h = createGame({ levelId: 1, seed: 1, perks });
  perks.frugal = 1; // acheter un bonus pendant la partie ne change pas la partie en cours
  assert.deepEqual(h.state.perks, { almanac: 1 });
  assert.deepEqual(normalizeRunPerks(null), {});
  assert.deepEqual(normalizeRunPerks([1, 2]), {});
  assert.deepEqual(createGame({ levelId: 1, seed: 1 }).state.perks, {});
  // Sauvegarde : un bonus inconnu ou un rang faux est refusé.
  const saved = g.serialize();
  assert.throws(() => loadGame({ ...saved, perks: { dragon: 1 } }), /Sauvegarde invalide/);
  assert.throws(() => loadGame({ ...saved, perks: { startPurse: 3 } }), /Sauvegarde invalide/);
  assert.throws(() => loadGame({ ...saved, perks: null }), /Sauvegarde invalide/);
  assert.deepEqual(loadGame(saved).state.perks, { almanac: 1, startPurse: 2 });
});

test('perkValue : valeurs neutres sans bonus', () => {
  const s = { perks: {} };
  assert.equal(perkValue(s, 'seedFactor'), 1);
  assert.equal(perkValue(s, 'growthBonus'), 0);
  assert.equal(perkValue(s, 'frostRefund'), false);
  assert.deepEqual(perkValue(s, 'extraCrops'), []);
  assert.equal(perkValue({ perks: { startPurse: 2 } }, 'startMoney'), V('startPurse', 2));
  assert.equal(perkValue({ perks: { orchardist: 1 } }, 'treeGrowReduction'), 2);
  assert.equal(perkValue({ perks: { orchardist: 1 } }, 'treeDiscount'), 10);
});

test('Almanach : météo d’après-demain exacte, lue sans consommer l’aléatoire', () => {
  for (const levelId of [1, 2, 5, 11]) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = createGame({ levelId, seed, perks: { almanac: 1 } });
      const plain = createGame({ levelId, seed });
      assert.equal(plain.query.forecast().afterTomorrow, null);
      const total = g.query.calendar().totalDays;
      const predictions = {};
      const seen = [];
      while (g.state.status === 'playing' && g.state.time.day <= total) {
        const day = g.state.time.day;
        const rngBefore = { ...g.state.rng };
        const f = g.query.forecast();
        assert.deepEqual(g.state.rng, rngBefore, 'la prévision ne consomme rien');
        if (day + 2 <= total) predictions[day + 2] = f.afterTomorrow;
        else assert.equal(f.afterTomorrow, null);
        if (predictions[day]) assert.equal(g.state.weather.today, predictions[day], `niveau ${levelId}, graine ${seed}, jour ${day}`);
        seen.push(g.state.weather.today);
        g.state.money = 1e6;
        g.update(20);
      }
      // Même météo qu'une partie sans bonus : l'almanach ne change rien au tirage.
      const plainSeen = [];
      while (plain.state.status === 'playing') {
        plainSeen.push(plain.state.weather.today);
        plain.state.money = 1e6;
        plain.update(20);
      }
      assert.deepEqual(seen, plainSeen);
    }
  }
});

test('Bas de laine : argent de départ + rang 1, + rang 2', () => {
  const base = getLevel(3).startMoney;
  assert.ok(V('startPurse', 1) > 0 && V('startPurse', 2) > V('startPurse', 1));
  assert.equal(createGame({ levelId: 3, seed: 1, perks: { startPurse: 1 } }).state.money, base + V('startPurse', 1));
  const g = createGame({ levelId: 3, seed: 1, perks: { startPurse: 2 } });
  assert.equal(g.state.money, base + V('startPurse', 2));
  assert.equal(g.state.startMoney, base + V('startPurse', 2));
  assert.equal(g.query.summary().startMoney, base + V('startPurse', 2));
});

test('Graines sélectionnées : graines × facteur arrondi (au moins 1), pas les pommiers', () => {
  const f = V('goodSeeds');
  assert.ok(f < 1);
  const g = newGame(12, 42, { perks: { goodSeeds: 1 } });
  rich(g);
  const offer = Object.fromEntries(g.query.plantableCrops().map((c) => [c.id, c]));
  assert.equal(offer.carrot.seedCost, Math.max(1, Math.round(4 * f)));
  assert.equal(offer.potato.seedCost, Math.round(5 * f));
  assert.equal(offer.strawberry.seedCost, Math.round(12 * f));
  assert.equal(offer.apple.seedCost, 45);
  const money = g.state.money;
  const r = g.actions.plant(freePlot(g), 'strawberry');
  assert.equal(r.cost, Math.round(12 * f));
  assert.equal(g.state.money, money - r.cost);
  assert.equal(g.state.stats.year.seedsSpent, r.cost);
  goToDay(g, 15);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'pumpkin').seedCost, Math.round(18 * f));
  assert.ok(Math.round(18 * f) < 18, 'le bonus change bien quelque chose');
});

test('Bon voisinage : fermage de printemps réduit, les autres inchangés', () => {
  const g = newGame(1, 42, { perks: { goodNeighbor: 1 } });
  rich(g, 5000);
  const spring = Math.round(60 * V('goodNeighbor'));
  assert.ok(spring < 60);
  assert.equal(g.query.finance().nextBill.amount, spring);
  const rec = record(g);
  goToDay(g, 8);
  assert.equal(rec.of('billPaid')[0].amount, spring);
  assert.equal(g.query.finance().nextBill.amount, 120);
});

test('Main verte : +5 % de pousse hors hiver (avec les ruches)', () => {
  const g = newGame(1, 42, { perks: { greenThumb: 1 } });
  rich(g);
  const i = freePlot(g);
  g.actions.plant(i, 'turnip');
  g.actions.water(i);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - 1.05) < 1e-9);
  g.actions.buyInvestment('beehive');
  g.actions.water(i);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - (1.05 + 1.15)) < 1e-9);
  goToDay(g, 22);
  const j = freePlot(g);
  g.actions.plant(j, 'turnip');
  g.actions.water(j);
  nextDay(g);
  assert.equal(g.state.plots[j].growth, 1, 'hiver : aucun bonus');
});

test('Marchandage : investissements et ateliers × facteur arrondi', () => {
  const f = V('haggler');
  const g = newGame(12, 42, { perks: { haggler: 1 } });
  rich(g);
  const cost = (id) => g.query.investments().find((i) => i.id === id).nextCost;
  assert.equal(cost('chickenCoop'), Math.round(70 * f));
  assert.equal(cost('jamWorkshop'), Math.round(getInvestment('jamWorkshop').costs[0] * f));
  assert.equal(g.actions.buyInvestment('chickenCoop').cost, Math.round(70 * f));
  assert.equal(cost('chickenCoop'), Math.round(85 * f));
  assert.equal(g.state.stats.year.investmentsSpent, Math.round(70 * f));
});

test('Arpenteur : chaque parcelle achetée coûte moins cher', () => {
  const d = V('surveyor');
  const g = newGame(1, 42, { perks: { surveyor: 1 } });
  rich(g);
  assert.equal(g.query.plot(0).unlockCost, 40 - d);
  assert.equal(g.actions.unlockPlot(0).cost, 40 - d);
  assert.equal(g.query.plot(5).unlockCost, 50 - d);
});

test('Ferme économe : entretien des animaux et bâtiments −1/jour (jamais en dessous de 0)', () => {
  const g = newGame(1, 42, { perks: { frugal: 1 } });
  assert.equal(g.query.finance().dailyCharges, 5, 'les charges de la ferme ne changent pas');
  rich(g);
  g.actions.buyInvestment('chickenCoop'); // entretien 1 → 0
  assert.equal(g.query.finance().dailyCharges, 5);
  g.actions.buyInvestment('sheep'); // entretien 1 + 2 − 1
  assert.equal(g.query.finance().dailyCharges, 5 + 2);
  g.actions.buyInvestment('solarPanel');
  assert.equal(g.query.finance().dailyCharges, 2);
  const rec = record(g);
  nextDay(g);
  assert.equal(rec.of('dawn')[0].charges, 2);
});

test('Recettes de grand-mère : produits plus chers ; Réputation : tout plus cher (s’ajoute à l’étal)', () => {
  const pb = V('grandmaRecipes');
  const fs = V('famousStand');
  const g = newGame(12, 42, { perks: { grandmaRecipes: 1 } });
  rich(g);
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'strawberry').product.value, Math.round(46 * (1 + pb)));
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'strawberry').sellPrice, 26, 'les récoltes brutes ne changent pas');
  const h = newGame(12, 42, { perks: { famousStand: 1 } });
  rich(h);
  const i = freePlot(h);
  h.actions.plant(i, 'carrot');
  h.state.plots[i].growth = 2;
  assert.equal(h.query.plot(i).harvestValue, Math.round(10 * (1 + fs)));
  assert.equal(h.query.finance().priceBonus, fs);
  h.actions.buyInvestment('roadsideStand');
  assert.ok(Math.abs(h.query.finance().priceBonus - (0.2 + fs)) < 1e-9);
  assert.equal(h.actions.harvest(i).amount, Math.round(10 * (1.2 + fs)));
  assert.equal(h.query.plantableCrops().find((c) => c.id === 'strawberry').product.value, Math.round(46 * (1.2 + fs)));
});

test('Artisan : une place de plus dans chaque atelier', () => {
  const g = newGame(12, 42, { perks: { artisan: 1 } });
  rich(g);
  for (const id of ['jamWorkshop', 'mill', 'cow', 'dairy']) g.actions.buyInvestment(id);
  assert.deepEqual(g.query.processing().map((p) => [p.buildingId, p.capacity]), [['jamWorkshop', 3], ['dairy', 3], ['mill', 3]]);
  assert.equal(g.query.investments().find((i) => i.id === 'mill').processing.nextPlaces, 4);
});

test('Arboriste : pommier à 35, adulte en 4 jours', () => {
  const g = newGame(12, 42, { perks: { orchardist: 1 } });
  rich(g);
  const offer = g.query.plantableCrops().find((c) => c.id === 'apple');
  assert.equal(offer.seedCost, 35);
  assert.equal(offer.growDays, 4);
  const i = freePlot(g);
  assert.equal(g.actions.plant(i, 'apple').cost, 35);
  goToDay(g, 5);
  assert.equal(g.query.plot(i).tree.stage, 'adult');
  // Pommiers du départ (niveau 10) : adultes aussi.
  const h = newGame(10, 1, { perks: { orchardist: 1 } });
  assert.equal(h.state.plots[0].growth, 4);
  assert.equal(h.query.plot(0).tree.stage, 'adult');
});

test('Assurance gel : graines remboursées à l’aube du gel, pour les cultures semées à temps', () => {
  const g = newGame(1, 42, { perks: { frostInsurance: 1, goodSeeds: 1 } });
  rich(g);
  goToDay(g, 15);
  const a = freePlot(g);
  g.actions.plant(a, 'corn'); // 6 jours, 7 aubes avant le gel : assurée ; jamais arrosée, elle ne mûrira pas
  assert.equal(g.state.plots[a].insured, true);
  goToDay(g, 21);
  const b = freePlot(g);
  g.actions.plant(b, 'carrot'); // semée malgré l'avertissement : pas assurée
  assert.equal(g.state.plots[b].insured, false);
  const c = freePlot(g);
  g.actions.plant(c, 'cabbage'); // résiste au gel
  const paid = Math.round(15 * 0.95); // prix payé (graines sélectionnées)
  const rec = record(g);
  nextDay(g);
  const frost = rec.of('frost')[0];
  assert.deepEqual(frost.lostPlots.sort(), [a, b].sort());
  assert.equal(frost.refund, paid);
  const dawn = rec.of('dawn')[0];
  assert.deepEqual(dawn.incomes[0], { source: 'frostInsurance', amount: paid, owned: 1, kind: 'refund' });
  assert.equal(g.state.stats.year.frostRefund, paid);
  assert.equal(g.state.stats.year.investmentIncome, 0);
  // Sans le bonus : jamais assurée, refund 0.
  const h = newGame(1);
  rich(h);
  goToDay(h, 15);
  const i = freePlot(h);
  h.actions.plant(i, 'corn');
  assert.equal(h.state.plots[i].insured, false);
  const rec2 = record(h);
  goToDay(h, 22);
  assert.equal(rec2.of('frost')[0].refund, 0);
  assert.ok(!rec2.of('dawn').some((d) => d.incomes.some((x) => x.kind === 'refund')));
});

test('Semencier : les 5 nouveautés dans les niveaux 1 à 8', () => {
  const plain = newGame(1);
  assert.deepEqual(plain.query.plantableCrops().map((c) => c.id), ['carrot', 'turnip', 'wheat']);
  assert.equal(plain.actions.plant(1, 'potato').reason, 'Culture inconnue.');
  const g = newGame(1, 42, { perks: { seedMerchant: 1 } });
  assert.deepEqual(g.query.plantableCrops().map((c) => c.id), ['carrot', 'turnip', 'wheat', 'potato', 'strawberry', 'apple']);
  assert.equal(g.actions.plant(1, 'potato').ok, true);
  for (const id of NEW_CROPS) assert.ok(getCrop(id));
  // Marché fou : cours aussi pour les nouveautés.
  const m = newGame(6, 1, { perks: { seedMerchant: 1 } });
  for (const id of NEW_CROPS) assert.ok(m.state.market[id] > 0, id);
});

test('tous les bonus à la fois : la partie se joue et se recharge', () => {
  const all = Object.fromEntries(PERKS.map((p) => [p.id, p.costs.length]));
  for (const levelId of [1, 6, 10, 12]) {
    const g = createGame({ levelId, seed: 3, perks: all });
    for (let d = 0; d < 40 && g.state.status === 'playing'; d++) {
      g.state.money += 150;
      for (const p of g.query.plots()) {
        if (p.action === 'harvest') g.actions.harvest(p.index);
        else if (p.action === 'plant') {
          const c = g.query.plantableCrops(p.index).find((x) => x.canAfford && !x.willFreeze && x.kind === 'crop');
          if (c) g.actions.plant(p.index, c.id);
        }
      }
      for (const inv of g.query.investments()) if (inv.canBuy && g.state.money > 600) g.actions.buyInvestment(inv.id);
      g.update(20);
      assert.deepEqual(loadGame(g.serialize()).state, g.state);
    }
    assert.notEqual(g.state.status, 'playing');
    assert.equal(getInvestment('chickenCoop').costs[0], 70, 'les données ne changent jamais');
  }
});
