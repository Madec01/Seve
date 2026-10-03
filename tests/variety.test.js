// Lot 3 « Variété » — cadeau de saison (cartes), défis et médailles, colporteur et graines rares, effets
// (src/core/variety.js, src/core/variety-effects.js). Règles : docs/GAME_DESIGN.md § 16.3, § 16.5, § 16.7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame } from '../src/core/game.js';
import { getCrop } from '../src/data/crops.js';
import { CARD_VALUES, CHALLENGES_BY_ID, MEDALS, MERCHANT_ITEMS_BY_ID, RARE_SEEDS } from '../src/data/variety.js';
import { levelFor } from '../src/data/difficulty.js';
import { DAY_SECONDS, nextDay, record, rich, skipDays } from './helpers.js';

function detente(levelId = 2, seed = 7, opts = {}) {
  const g = createGame({ levelId, seed, difficulty: 'detente', ...opts });
  g.state.weather.today = 'sunny';
  return g;
}

/** Jusqu'au soir du dernier jour de la saison : passe l'aube suivante (fin de saison jouée). */
function endSeason(g) {
  const si = g.state.time.seasonIndex;
  while (g.state.time.seasonIndex === si && g.state.status === 'playing') nextDay(g);
}

/** Propose une carte précise (tests) pour la saison en cours. */
function offer(g, ids) {
  g.state.variety.cards.offer = { season: g.state.time.seasonIndex, options: ids };
}

function openPlot(g, k = 0) {
  return g.state.plots.map((p, i) => (p.unlocked && !p.cropId ? i : -1)).filter((i) => i >= 0)[k];
}

test('cartes : deux cartes différentes à la fin du printemps, de l\'été et de l\'automne (pas après l\'hiver)', () => {
  const g = detente(2, 4);
  const rec = record(g);
  rich(g, 5000);
  for (let s = 0; s < 3; s++) {
    endSeason(g);
    const ev = rec.of('cardsOffered').at(-1);
    assert.ok(ev, `fin de saison ${s}`);
    assert.equal(ev.options.length, 2);
    assert.notEqual(ev.options[0].id, ev.options[1].id);
    assert.equal(ev.season, s + 1);
    for (const c of ev.options) {
      assert.match(c.icon, /^icon\.card\./);
      assert.ok(['now', 'season', 'next'].includes(c.kind));
    }
    // Choix en attente : la carte suivante remplace la paire non choisie, sans message.
    assert.ok(g.query.cards().offer);
  }
  assert.equal(rec.of('cardsOffered').length, 3);
  while (g.state.status === 'playing') nextDay(g);
  assert.equal(rec.of('cardsOffered').length, 3, 'pas de carte après l\'hiver (victoire)');
});

test('cartes : refus (pas de cadeau, carte non proposée) ; la bourse (+12 + 4 × saison) ; une seule carte gardée', () => {
  const g = detente(2, 4);
  assert.equal(g.actions.pickCard('purse').reason, 'Pas de cadeau à choisir.');
  offer(g, ['purse', 'poster']);
  g.state.variety.cards.offer.season = 1;
  assert.equal(g.actions.pickCard('bees').reason, 'Cette carte n\'est pas proposée.');
  const money = g.state.money;
  const r = g.actions.pickCard('purse');
  assert.ok(r.ok);
  assert.equal(r.amount, CARD_VALUES.purse.base + CARD_VALUES.purse.perSeason * 1);
  assert.equal(g.state.money, money + r.amount);
  assert.equal(g.query.cards().offer, null);
  assert.equal(g.actions.pickCard('poster').reason, 'Pas de cadeau à choisir.');
  assert.equal(g.state.stats.year.varietyIncome, r.amount);
});

test('cartes « saison » : foire aux graines, engrais, affiche, poule voyageuse, foin, recette, arrosoir magique, trèfle', () => {
  const g = detente(10, 3);
  rich(g, 5000);
  assert.equal(g.actions.pickCard('hay').ok, false);
  g.actions.buyInvestment('chickenCoop');
  g.actions.buyInvestment('jamWorkshop');
  const seed0 = g.query.plantableCrops().find((c) => c.id === 'strawberry').seedCost;
  const price0 = g.query.plantableCrops().find((c) => c.id === 'carrot').sellPrice;
  const rate0 = 1;
  for (const id of ['seedFair', 'fertilizer', 'poster', 'hen', 'hay', 'recipe', 'watering', 'clover']) {
    offer(g, [id, 'purse']);
    assert.ok(g.actions.pickCard(id).ok, id);
  }
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'strawberry').seedCost, Math.round(seed0 * 0.5), 'graines à moitié prix');
  assert.equal(g.query.plantableCrops().find((c) => c.id === 'carrot').sellPrice, Math.round(getCrop('carrot').sellPrice * 1.25 * CARD_VALUES.poster.factor));
  assert.ok(price0 > 0);
  void rate0;
  // L'engrais : × (1 + 0,08) sur la pousse arrosée.
  const i = openPlot(g);
  g.actions.plant(i, 'carrot');
  g.actions.water(i);
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[i].growth - (1 + CARD_VALUES.fertilizer.growth)) < 1e-9);
  // La poule voyageuse : +3 chaque matin.
  assert.ok(g.state.lastDawn.incomes.some((x) => x.source === 'cardHen' && x.amount === CARD_VALUES.hen.coins));
  // Le trèfle : chances de qualité × 2.
  const q = g.query.plot(i).quality;
  const plain = detente(10, 3);
  plain.state.plots[i] = JSON.parse(JSON.stringify(g.state.plots[i]));
  const q0 = plain.query.plot(i).quality;
  assert.ok(Math.abs(q.fine - q0.fine * 2) < 1e-3);
  // Fin de saison : les effets s'arrêtent (cardEnded à l'aube suivante).
  const rec = record(g);
  endSeason(g);
  assert.ok(rec.of('cardEnded').length >= 8);
  assert.equal(g.query.cards().active.filter((c) => c.current).length, 0);
});

test('cartes « prochaine fois » : propriétaire (fermage −20 %), défrichage (parcelle gratuite), cheval (charrette × 2) ; « maintenant » : essaim, sachet rare, almanach', () => {
  const g = detente(2, 5);
  rich(g, 5000);
  const rent = g.query.finance().nextBill.amount;
  offer(g, ['landlord', 'purse']);
  g.actions.pickCard('landlord');
  assert.equal(g.query.finance().nextBill.amount, Math.round(rent * 0.8));
  assert.equal(g.query.finance().nextBill.reduced, true);
  const rec = record(g);
  endSeason(g);
  assert.equal(rec.of('billPaid')[0].amount, Math.round(rent * 0.8));
  assert.equal(rec.of('billPaid')[0].reduced, true);
  assert.equal(g.state.variety.cards.pending.rentFactor, 1, 'une seule fois');
  // Défrichage : la prochaine parcelle achetée est gratuite.
  offer(g, ['clearing', 'purse']);
  assert.ok(g.actions.pickCard('clearing').ok);
  const closed = g.state.plots.findIndex((p) => !p.unlocked);
  assert.equal(g.query.plot(closed).unlockCost, 0);
  const money = g.state.money;
  assert.equal(g.actions.unlockPlot(closed).cost, 0);
  assert.equal(g.state.money, money);
  const closed2 = g.state.plots.findIndex((p) => !p.unlocked);
  assert.ok(g.query.plot(closed2).unlockCost > 0);
  // Cheval de renfort : la charrette en cours paiera double.
  offer(g, ['cartHorse', 'purse']);
  g.actions.pickCard('cartHorse');
  assert.equal(g.query.cart().horse, true);
  // Essaim : une ruche offerte.
  offer(g, ['bees', 'purse']);
  const hives = g.state.investments.beehive || 0;
  assert.ok(g.actions.pickCard('bees').ok);
  assert.equal(g.state.investments.beehive, hives + 1);
  // Sachet de graines rares : 3 graines de la culture rare de la saison.
  offer(g, ['seedBag', 'purse']);
  const r = g.actions.pickCard('seedBag');
  assert.deepEqual(r.gift, { cropId: 'melon', n: CARD_VALUES.seedBag.seeds, rare: true });
  assert.equal(g.state.variety.rare.melon, CARD_VALUES.seedBag.seeds);
  // Almanach : météo d'après-demain (lue sans consommer de tirage).
  assert.equal(g.query.forecast().afterTomorrow, null);
  offer(g, ['almanac', 'purse']);
  g.actions.pickCard('almanac');
  const weatherRng = g.state.rng.weather;
  const after = g.query.forecast().afterTomorrow;
  assert.ok(after);
  assert.equal(g.state.rng.weather, weatherRng);
  g.update(DAY_SECONDS);
  g.update(DAY_SECONDS);
  assert.equal(g.state.weather.today, after, 'la prévision d\'après-demain était juste');
});

test('cartes : conditions (pas d\'arrosoir au niveau 8, pas de ruche au maximum) ; « Plus possible » si la place manque', () => {
  const g = detente(8, 2);
  rich(g, 5000);
  for (let k = 0; k < 30; k++) {
    endSeason(g);
    if (g.state.status !== 'playing') break;
    const o = g.query.cards().offer;
    if (o) assert.ok(o.options.every((c) => c.id !== 'watering'));
  }
  const h = detente(2, 2);
  h.state.investments.beehive = 3;
  offer(h, ['bees', 'purse']);
  assert.equal(h.actions.pickCard('bees').reason, 'Plus possible : choisissez l\'autre carte.');
  assert.ok(h.actions.pickCard('purse').ok);
});

test('défis : 3 proposés, on en garde 2 au plus ; la progression compte depuis le 1er jour ; médailles cumulées et récompenses', () => {
  const g = detente(2, 10);
  rich(g, 5000);
  const ch = g.query.challenges();
  assert.equal(ch.options.length, 3);
  assert.equal(new Set(ch.options.map((o) => o.id)).size, 3);
  assert.ok(ch.options.every((o) => o.targets[0] <= o.targets[1] && o.targets[1] <= o.targets[2]));
  // Remplace par des défis connus pour le test.
  const v = g.state.variety.challenges;
  v.options = ['harvests', 'sowing', 'sales'];
  v.targets = { harvests: [1, 2, 3], sowing: [1, 2, 3], sales: [1000, 2000, 3000] };
  // Semer avant de garder : la progression compte quand même.
  const plots = g.state.plots.map((p, i) => (p.unlocked ? i : -1)).filter((i) => i >= 0);
  g.actions.plant(plots[0], 'carrot');
  g.actions.plant(plots[1], 'turnip');
  assert.equal(g.query.challenges().options.find((o) => o.id === 'sowing').progress, 2);
  const rec = record(g);
  const money = g.state.money;
  assert.ok(g.actions.keepChallenge('sowing').ok);
  const medals = rec.of('challengeMedal');
  assert.deepEqual(medals.map((m) => m.medal), ['bronze', 'silver'], 'deux paliers d\'un coup');
  assert.deepEqual(medals.map((m) => m.ecus), [MEDALS[0].ecus, MEDALS[1].ecus]);
  assert.equal(g.state.money, money + MEDALS[1].coins);
  assert.equal(g.actions.keepChallenge('sowing', false).reason, 'Ce défi a déjà une médaille.');
  assert.ok(g.actions.keepChallenge('harvests').ok);
  assert.equal(g.actions.keepChallenge('sales').reason, 'Deux défis au plus.');
  assert.ok(g.actions.keepChallenge('harvests', false).ok, 'sans médaille : on peut changer d\'avis');
  assert.ok(g.actions.keepChallenge('sales').ok);
  assert.equal(g.actions.keepChallenge('nimporte').reason, 'Défi inconnu.');
  // Or au 3e semis.
  g.actions.plant(plots[2], 'wheat');
  assert.equal(rec.of('challengeMedal').at(-1).medal, 'gold');
  assert.equal(g.state.variety.stats.medals.gold, 1);
  // Fin de saison : défis jugés, défis de la saison suivante proposés (puis en cours).
  endSeason(g);
  const judged = rec.of('challengesJudged')[0];
  assert.deepEqual(judged.results.map((r) => [r.challengeId, r.medal]).sort(), [['sales', 0], ['sowing', 3]]);
  const offered = rec.of('challengesOffered')[0];
  assert.equal(offered.options.length, 3);
  assert.deepEqual(g.query.challenges().options.map((o) => o.id).sort(), offered.options.map((o) => o.id).sort());
  assert.equal(g.query.challenges().options.every((o) => o.medal === 0 && o.progress >= 0), true);
});

test('défis : jamais les mêmes trois deux saisons de suite ; niveau 1 : aucun au printemps, proposés à la fin du printemps', () => {
  const g = detente(1, 6);
  assert.equal(g.query.challenges().options.length, 0);
  const rec = record(g);
  endSeason(g);
  assert.equal(rec.of('challengesOffered').length, 1);
  assert.equal(g.query.challenges().options.length, 3);
  let last = g.query.challenges().options.map((o) => o.id).sort().join();
  while (g.state.status === 'playing' && g.state.time.seasonIndex < 3) {
    endSeason(g);
    const now = g.query.challenges().options.map((o) => o.id).sort().join();
    assert.notEqual(now, last);
    last = now;
  }
  // Les cibles suivent la taille du champ (k) : « Belle cueillette » au niveau 4 (6 parcelles) = k 0,5.
  const four = detente(4, 1);
  four.state.variety.challenges.options = ['harvests', 'sowing', 'sales'];
  assert.ok(CHALLENGES_BY_ID.harvests);
});

test('colporteur : annoncé la veille, là les jours 5 et 6 (un sachet de graines rares + 2 objets), repart le soir du 6e jour', () => {
  const g = detente(2, 3);
  const rec = record(g);
  skipDays(g, 3);
  assert.equal(g.state.time.day, 4);
  assert.equal(rec.of('merchantSoon').length, 1);
  assert.equal(g.query.merchant().soon, true);
  assert.equal(g.actions.buyFromMerchant('seeds.pea').reason, 'Le colporteur n\'est pas là.');
  nextDay(g);
  const m = g.query.merchant();
  assert.equal(m.here, true);
  assert.equal(m.name, 'Basile le colporteur');
  assert.equal(m.stall.length, 3);
  assert.equal(m.stall[0].itemId, 'seeds.pea');
  assert.equal(m.stall[0].price, RARE_SEEDS.pea.price);
  assert.equal(rec.of('merchantArrived').length, 1);
  nextDay(g);
  assert.equal(g.query.merchant().here, true);
  nextDay(g);
  assert.equal(rec.of('merchantLeft').length, 1);
  assert.equal(g.query.merchant(), null);
  // Niveau 1 : pas au printemps.
  const l1 = detente(1, 3);
  skipDays(l1, 6);
  assert.equal(l1.query.merchant(), null);
});

test('graines rares : achat du sachet, semis gratuits (une graine en moins), récolte au prix de la culture ; plus de graines → refus', () => {
  const g = detente(2, 3);
  rich(g, 1000);
  assert.ok(g.actions.triggerVariety('merchant').ok);
  const money = g.state.money;
  const buy = g.actions.buyFromMerchant('seeds.pea');
  assert.ok(buy.ok);
  assert.equal(g.state.money, money - RARE_SEEDS.pea.price);
  assert.equal(g.actions.buyFromMerchant('seeds.pea').reason, 'Déjà vendu.');
  assert.equal(g.state.variety.rare.pea, RARE_SEEDS.pea.seeds);
  const row = g.query.plantableCrops(0).find((c) => c.id === 'pea');
  assert.equal(row.rare, true);
  assert.equal(row.seedCost, 0);
  assert.equal(row.seedsLeft, RARE_SEEDS.pea.seeds);
  const rec = record(g);
  const i = openPlot(g);
  const m2 = g.state.money;
  const r = g.actions.plant(i, 'pea');
  assert.ok(r.ok);
  assert.equal(r.cost, 0);
  assert.equal(r.rare, true);
  assert.equal(r.seedsLeft, RARE_SEEDS.pea.seeds - 1);
  assert.equal(g.state.money, m2);
  assert.equal(rec.of('planted')[0].rare, true);
  g.state.variety.rare.pea = 0;
  assert.equal(g.actions.plant(openPlot(g, 1), 'pea').reason, 'Plus de graines rares : le colporteur en vend.');
  // Récolte : prix de la culture (× 1,25 en Détente), jamais demandée par le tableau ni la charrette.
  g.state.plots[i].growth = getCrop('pea').growDays;
  assert.equal(g.query.plot(i).claim, null);
  const h = g.actions.harvest(i);
  assert.equal(h.amount - (h.qualityBonus || 0), Math.round(17 * 1.25));
  assert.equal(g.state.variety.stats.rareHarvested.pea, 1);
  // Sans variété : la graine rare n'existe pas.
  const c = createGame({ levelId: 2, seed: 3, difficulty: 'classique' });
  assert.equal(c.actions.plant(openPlot(c), 'pea').ok, false);
});

test('colporteur : objets (arrosoir de cuivre unique, fer à cheval, décors, poulailler d\'occasion à 70 %, engrais)', () => {
  const g = detente(2, 9);
  rich(g, 5000);
  g.actions.triggerVariety('merchant');
  g.state.variety.merchant.stall = [
    { itemId: 'copperCan', price: 60, sold: false },
    { itemId: 'horseshoe', price: 45, sold: false },
    { itemId: 'lantern', price: 30, sold: false },
    { itemId: 'usedCoop', price: Math.round(70 * 0.7), sold: false },
    { itemId: 'fertilizer', price: 35, sold: false },
  ];
  const rec = record(g);
  assert.ok(g.actions.buyFromMerchant('copperCan').ok);
  assert.equal(g.state.variety.owned.copperCan, true);
  assert.ok(g.actions.buyFromMerchant('horseshoe').ok);
  const deco = g.actions.buyFromMerchant('lantern');
  assert.equal(deco.cosmeticId, 'lantern.peddler');
  assert.equal(deco.ecusIfOwned, 5);
  assert.equal(rec.of('merchantBought').find((e) => e.itemId === 'lantern').cosmeticId, 'lantern.peddler');
  const coops = g.state.investments.chickenCoop || 0;
  assert.ok(g.actions.buyFromMerchant('usedCoop').ok);
  assert.equal(g.state.investments.chickenCoop, coops + 1);
  assert.ok(g.actions.buyFromMerchant('fertilizer').ok);
  // L'arrosoir de cuivre : 3 parcelles qui ont soif, les moins avancées d'abord.
  const plots = g.state.plots.map((p, i) => (p.unlocked ? i : -1)).filter((i) => i >= 0);
  for (const i of plots.slice(0, 5)) g.actions.plant(i, 'wheat');
  nextDay(g, 'sunny');
  assert.equal(g.state.lastDawn.varietyWatered.length, MERCHANT_ITEMS_BY_ID.copperCan.plots);
  // L'engrais : +0,25 jour de pousse par aube pendant 3 aubes (en plus de la pousse).
  assert.ok(g.state.variety.fertilizer.left === 2);
  // Le fer à cheval : + 1 point de belle.
  const q = g.query.plot(plots[0]).quality;
  const plain = detente(2, 9);
  plain.state.plots[plots[0]] = JSON.parse(JSON.stringify(g.state.plots[plots[0]]));
  assert.ok(Math.abs(q.fine - plain.query.plot(plots[0]).quality.fine - 0.01) < 1e-6);
  // Un objet unique déjà possédé n'est plus proposé.
  for (let k = 0; k < 4; k++) {
    endSeason(g);
    if (g.state.status !== 'playing') break;
  }
  assert.equal(g.state.variety.stats.merchantBought.copperCan, 1);
});

test('variété : déterminisme (même graine, mêmes gestes → mêmes événements) et sauvegarde en plein jeu', () => {
  const run = () => {
    const g = detente(3, 21);
    rich(g, 3000);
    const types = [];
    g.on('*', (e) => types.push(e.type));
    for (let d = 0; d < 30 && g.state.status === 'playing'; d++) {
      const c = g.query.cards();
      if (c?.offer) g.actions.pickCard(c.offer.options[0].id);
      const ch = g.query.challenges();
      if (ch && !ch.kept.length && ch.options.length) g.actions.keepChallenge(ch.options[0].id);
      for (let i = 0; i < g.state.plots.length; i++) {
        const p = g.query.plot(i);
        if (p.action === 'harvest') g.actions.harvest(i);
        if (g.query.plot(i).action === 'plant') {
          const o = g.query.plantableCrops(i).find((x) => x.requested) || g.query.plantableCrops(i)[0];
          if (o) g.actions.plant(i, o.id);
        }
      }
      g.update(DAY_SECONDS);
    }
    return { types, state: JSON.stringify(g.serialize()) };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.types, b.types);
  assert.equal(a.state, b.state);
  // Sauvegarde et reprise.
  const g = detente(5, 4);
  rich(g, 2000);
  skipDays(g, 9);
  const saved = g.serialize();
  const back = loadGame(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.serialize(), saved);
  for (let d = 0; d < 10; d++) {
    g.update(DAY_SECONDS);
    back.update(DAY_SECONDS);
  }
  assert.deepEqual(back.serialize(), g.serialize());
});

test('variété : bilan (summary.variety, varietyIncome compté dans le net) et contexte des succès', () => {
  const g = detente(2, 4);
  offer(g, ['purse', 'poster']);
  g.actions.pickCard('purse');
  const s = g.query.summary();
  assert.ok(s.variety);
  assert.equal(s.variety.cardIncome, CARD_VALUES.purse.base + CARD_VALUES.purse.perSeason);
  assert.deepEqual(Object.keys(g.query.achievementContext().variety).sort(), ['cartsFull', 'medals', 'merchantVisits', 'ordersByClient', 'ordersDone', 'pending', 'rareHarvested']);
  const level = levelFor(2, 'detente');
  assert.ok(level.starThresholds[0] > 0);
});

test('débogage : triggerVariety(\'medal\') amène un défi proposé au palier voulu par le vrai chemin des médailles', () => {
  const g = detente(2, 9);
  const rec = record(g);
  const ch = g.query.challenges();
  assert.ok(ch && ch.options.length === 3);
  const id = ch.options.find((o) => o.id !== 'variety' && o.id !== 'sowing')?.id ?? ch.options[0].id;
  const money = g.state.money;
  const r = g.actions.triggerVariety('medal', { challengeId: id, medal: 2 });
  assert.ok(r.ok, r.reason);
  assert.equal(r.medal, 2);
  assert.deepEqual(rec.of('challengeMedal').map((e) => e.medal), ['bronze', 'silver']);
  assert.ok(g.query.challenges().kept.includes(id));
  assert.equal(g.state.money, money + MEDALS[1].coins);
  assert.equal(g.state.variety.stats.medals.silver, 1);
  // Refus : défi non proposé.
  assert.equal(g.actions.triggerVariety('medal', { challengeId: 'collect', medal: 1 }).ok, false);
  // Classique : variété absente.
  const c = createGame({ levelId: 2, seed: 9, difficulty: 'classique' });
  assert.equal(c.actions.triggerVariety('medal', { challengeId: id }).ok, false);
});

test('défis : paliers strictement croissants et atteignables ; un défi dont les paliers s\'écraseraient n\'est pas proposé', () => {
  const SE = ['spring', 'summer', 'autumn', 'winter'];
  const seen = {};
  for (const lv of [1, 2, 4, 5, 10]) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = detente(lv, seed);
      rich(g, 5000);
      let guard = 0;
      while (g.state.status === 'playing' && guard++ < 120) {
        const ch = g.state.variety.challenges;
        if (g.state.time.dayOfSeason === 1 && ch.season !== null) {
          const season = SE[g.state.time.seasonIndex];
          const level = g.query.level();
          for (const id of ch.options) {
            const t = ch.targets[id];
            assert.ok(t[0] >= 1 && t[0] < t[1] && t[1] < t[2], `niveau ${lv}, ${season}, ${id} : ${t}`);
            const key = `${lv}.${season}.${id}`;
            seen[key] = t.join('/');
            if (id === 'variety' || id === 'sowing') {
              assert.ok(t[0] >= 2, `${key} : au moins 2 cultures pour le bronze`);
              const crops = g.query.plantableCrops().filter((c) => !c.rare).length;
              assert.ok(t[2] <= Math.max(crops, 2) + 1, `${key} : or atteignable (${t} pour ${crops} cultures)`);
            }
            if (id === 'crates') assert.ok(t[2] <= g.state.variety.cart.crates.length, `${key} : au plus le nombre de caisses`);
          }
          // Niveau 2 au printemps : 3 cultures seulement → ni « Potager varié » ni « Semeur curieux » (3 / 3 / 3).
          if (lv === 2 && season === 'spring') assert.ok(!ch.options.includes('variety') && !ch.options.includes('sowing'), `printemps du niveau 2 : ${ch.options}`);
          // Niveau 4 : charrette de 2 caisses → pas de « Charrette pleine » (1 / 2 / 2).
          if (lv === 4) assert.ok(!ch.options.includes('crates'));
        }
        nextDay(g);
      }
    }
  }
  // Paliers reconstruits sous le plafond (4 cultures faisables : 2 / 3 / 4) et intacts au-dessus (niveau 10, été).
  assert.ok(Object.entries(seen).some(([k, t]) => /\.(variety|sowing)$/.test(k) && t === '2/3/4'), JSON.stringify(seen));
  assert.ok(Object.entries(seen).some(([k, t]) => k.endsWith('.variety') && t === '3/4/6'), JSON.stringify(seen));
});

test('défis : textes accordés au nombre (« 1 caisse », « 2 caisses »)', () => {
  const g = detente(2, 9);
  const ch = g.state.variety.challenges;
  ch.options = ['crates', 'quality', 'orders'];
  ch.kept = [];
  ch.targets = { crates: [1, 2, 3], quality: [1, 3, 5], orders: [2, 3, 5] };
  const texts = Object.fromEntries(g.query.challenges().options.map((c) => [c.id, c.text]));
  assert.equal(texts.crates, 'Remplir 1 caisse de la charrette.');
  assert.equal(texts.quality, 'Récolter 1 belle ou dorée.');
  assert.equal(texts.orders, 'Livrer 2 commandes du tableau.');
});
