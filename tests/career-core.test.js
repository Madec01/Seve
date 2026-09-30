// Mode Carrière — socle (CORE-A) : création, années continues, charges de saison, marché, prix,
// coups durs (Détente) et faillite (Classique), points d'accroche des extensions, mode Niveaux intact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, careerOptions } from '../src/core/career/career.js';
import { createGame } from '../src/core/game.js';
import { levelFor } from '../src/data/difficulty.js';
import { getCrop } from '../src/data/crops.js';
import { CAREER_MARKET, HAND_BONUS, OFF_SEASON_FACTOR } from '../src/data/career/career.js';
import { LOT_PRICES } from '../src/data/career/lots.js';
import { DAY_SECONDS, goTo, newCareer, nextDay, record, setRank, skipDays, skipYear, tendAll, withExtension } from './career-helpers.js';

test('création : options par défaut', () => {
  const g = newCareer();
  const s = g.state;
  assert.equal(g.mode, 'career');
  assert.equal(s.mode, 'career');
  assert.equal(s.career.difficulty, 'detente');
  assert.equal(s.career.seasonLength, 7);
  assert.equal(s.career.farmerGender, 'fermier');
  assert.equal(s.career.outfit, 'outfit.classic');
  assert.equal(s.career.farmName, 'Ferme des Tilleuls');
  assert.equal(s.money, 200);
  assert.deepEqual(s.time, { year: 1, day: 1, seasonIndex: 0, dayOfSeason: 1, elapsed: 0 });
  assert.ok(['career', 'staff', 'events', 'weather', 'market', 'rot'].every((k) => Number.isInteger(s.rng[k])));
  assert.equal(s.plots.length, 16);
  assert.equal(s.plots.filter((p) => p.unlocked).length, 12);
  assert.ok(s.plots.every((p) => p.lot === 'start' && p.env === 'field'));
  assert.equal(s.investments.hen, 2);
  assert.deepEqual(s.career.lots.map((l) => [l.id, l.type]), [['home', 'home'], ['start', 'field'], ['yard', 'yard']]);
  assert.equal(s.career.buildings.coop.level, 1);
  assert.deepEqual(s.career.lots[2].slots, ['coop', null]);
  assert.equal(s.career.buildings.house.level, 1);
  assert.equal(s.career.rank, 1);
  assert.equal(g.level.id, 'career');
  assert.deepEqual(g.level.seasonLengths, [7, 7, 7, 7]);
  assert.equal(g.level.rents, null);
  assert.deepEqual(g.level.crops, ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'potato', 'strawberry']);
  const sum = g.query.career.summary();
  assert.equal(sum.title, 'Jeune fermier');
  assert.equal(sum.rankName, 'Petite ferme');
  assert.equal(sum.nextRank.patrimony, 1200);
});

test('création : options choisies (Classique, 14 jours, fermière, tenue, nom, décor)', () => {
  const g = createCareer({ seed: 3, difficulty: 'classique', seasonLength: 14, farmerGender: 'fermiere', outfit: 'outfit.raincoat', farmName: '  Les   Mûriers ', cosmetics: { decor: { 'porch.left': 'gnome', nowhere: 'gnome', 'yard.1': 'banane' } } });
  const c = g.state.career;
  assert.equal(c.difficulty, 'classique');
  assert.equal(g.state.difficulty, 'classique');
  assert.equal(g.state.money, 150);
  assert.equal(g.state.neighbourLoan, null);
  assert.equal(c.seasonLength, 14);
  assert.deepEqual(g.level.seasonLengths, [14, 14, 14, 14]);
  assert.equal(c.farmerGender, 'fermiere');
  assert.equal(g.query.career.summary().title, 'Jeune fermière');
  assert.equal(c.outfit, 'outfit.raincoat');
  assert.equal(c.farmName, 'Les Mûriers');
  assert.deepEqual(c.cosmetics.decor, { 'porch.left': 'gnome' });
  assert.equal(g.query.career.summary().nextRank.patrimony, 2400, 'seuils × 14 / 7');
  assert.equal(g.level.dailyCharge, 5);
});

test('création : valeurs invalides → défauts ; difficulté ou durée inconnue → erreur', () => {
  const o = careerOptions({ farmName: 'x'.repeat(40), farmerGender: 'chevalier', outfit: 'gnome' });
  assert.equal(o.farmName, 'Ferme des Tilleuls');
  assert.equal(o.farmerGender, 'fermier');
  assert.equal(o.outfit, 'outfit.classic');
  assert.throws(() => createCareer({ difficulty: 'facile' }), /Difficulté inconnue/);
  assert.throws(() => createCareer({ seasonLength: 9 }), /Durée de saison/);
});

for (const L of [7, 10, 14]) {
  test(`années continues : saisons de ${L} jours`, () => {
    const g = newCareer({ seasonLength: L });
    const ev = record(g);
    assert.equal(g.query.calendar().totalDays, 4 * L);
    assert.equal(g.query.calendar().year, 1);
    skipDays(g, 4 * L - 1);
    assert.deepEqual([g.state.time.year, g.state.time.day, g.state.time.seasonIndex], [1, 4 * L, 3]);
    assert.equal(ev.of('seasonWarning').at(-1).yearEnd, true);
    nextDay(g);
    assert.equal(g.state.status, 'playing');
    assert.deepEqual([g.state.time.year, g.state.time.day, g.state.time.seasonIndex, g.state.time.dayOfSeason], [2, 1, 0, 1]);
    assert.equal(ev.of('billPaid').length, 4);
    assert.ok(ev.of('billPaid').every((e) => e.career === true));
    assert.equal(ev.of('victory').length, 0);
    const ye = ev.of('yearEnd');
    assert.equal(ye.length, 1);
    assert.equal(ye[0].year, 1);
    const types = ev.events.map((e) => e.type);
    assert.ok(types.lastIndexOf('billPaid') < types.indexOf('yearEnd'), 'billPaid d\'hiver avant yearEnd');
    assert.equal(ev.of('seasonStart').at(-1).seasonId, 'spring');
    assert.equal(ev.of('seasonStart').at(-1).year, 2);
    assert.equal(g.state.career.history.length, 1);
    assert.equal(g.state.stats.year.rentsPaid, 0, 'statistiques de l\'année remises à zéro');
    // La deuxième année se déroule pareil.
    skipYear(g);
    assert.equal(g.state.time.year, 3);
    assert.equal(g.state.career.history.length, 2);
  });
}

test('années continues : les cultures d\'hiver et les arbres passent l\'année ; gel chaque hiver', () => {
  const g = newCareer();
  g.state.money = 100000;
  goTo(g, 1, 3 * 7 + 1); // 1er jour d'hiver
  g.actions.plant(0, 'turnip');
  g.actions.plant(1, 'cabbage');
  skipDays(g, 6);
  assert.equal(g.state.time.day, 28);
  nextDay(g); // printemps de l'année 2
  assert.equal(g.state.time.year, 2);
  assert.ok(['turnip', 'cabbage'].includes(g.state.plots[0].cropId) || g.state.plots[0].cropId === null);
  // Une carotte semée à la fin de l'automne gèle au 1er jour d'hiver de l'année 2.
  goTo(g, 2, 21);
  const ev = record(g);
  g.actions.plant(5, 'carrot');
  g.state.plots[5].growth = 0;
  nextDay(g, 'cloudy');
  assert.equal(ev.of('frost').length, 1);
  assert.equal(g.state.plots[5].cropId, null);
});

test('charges de saison : 20 + 15 × terrains (Détente), 40 + 25 × terrains (Classique), × durée / 7', () => {
  const d = newCareer();
  assert.equal(d.query.finance().nextBill.amount, 20);
  d.state.money = 100000;
  for (let k = 0; k < 1; k++) assert.ok(d.actions.career.buyLot().ok);
  assert.equal(d.query.finance().nextBill.amount, 35);
  setRank(d, 5);
  for (let k = 0; k < 5; k++) assert.ok(d.actions.career.buyLot().ok);
  assert.equal(d.query.career.charges().season.amount, 20 + 15 * 6);
  assert.equal(d.query.career.charges().season.perLot, 15);
  const c = newCareer({ difficulty: 'classique' });
  assert.equal(c.query.finance().nextBill.amount, 40);
  c.state.money = 100000;
  c.actions.career.buyLot();
  assert.equal(c.query.finance().nextBill.amount, 65);
  assert.equal(newCareer({ seasonLength: 10 }).query.finance().nextBill.amount, Math.round(20 * 10 / 7));
  assert.equal(newCareer({ seasonLength: 14 }).query.finance().nextBill.amount, 40);
  assert.equal(newCareer({ seasonLength: 14, difficulty: 'classique' }).query.finance().nextBill.amount, 80);
  // Payées le soir du dernier jour de la saison (billPaid avec le détail).
  const g = newCareer();
  const ev = record(g);
  skipDays(g, 7);
  const bill = ev.of('billPaid')[0];
  assert.equal(bill.amount, 20);
  assert.deepEqual(bill.detail, { base: 20, perLot: 15, lots: 0, scale: 1 });
  assert.equal(g.state.career.yearStats.spentBy.seasonCharges, 20);
});

test('charges quotidiennes : ferme (2 / 5) + entretien − panneaux solaires ; salaires jamais en négatif', () => {
  const ext = withExtension({ hooks: { charges: () => [{ source: 'wages', amount: 8 }, { source: 'fuel', amount: 3 }] } });
  try {
    const g = newCareer();
    const ev = record(g);
    nextDay(g);
    const dawn = ev.of('dawn')[0];
    assert.deepEqual(dawn.chargesDetail, [{ source: 'farm', amount: 2 }, { source: 'wages', amount: 8 }, { source: 'fuel', amount: 3 }]);
    assert.equal(dawn.charges, 13);
    // Argent négatif : ni salaire ni carburant (chômage technique).
    g.state.money = -50;
    ev.clear();
    nextDay(g);
    assert.deepEqual(ev.of('dawn')[0].chargesDetail, [{ source: 'farm', amount: 2 }]);
    assert.equal(g.query.career.summary().paused, true);
  } finally {
    ext.off();
  }
  const g = newCareer();
  g.state.money = 1000;
  assert.ok(g.actions.buyInvestment('solarPanel').ok);
  assert.equal(g.query.career.charges().dailyTotal, 0, 'panneau : 2 − 5 → 0 (jamais négatif)');
  assert.ok(g.actions.buyInvestment('goat').ok === false, 'pas de chèvrerie');
});

test('cours du marché : entre × 0,8 et × 1,3 chaque aube, hors saison × 1,25', () => {
  const g = newCareer();
  assert.ok(Object.values(g.state.market).every((m) => m === 1));
  for (let d = 0; d < 30; d++) {
    nextDay(g);
    for (const m of Object.values(g.state.market)) assert.ok(m >= CAREER_MARKET.min && m <= CAREER_MARKET.max, m);
  }
  assert.ok(Object.values(g.state.market).some((m) => m !== 1));
  const info = g.query.career.market();
  assert.equal(info.carrot.multiplier, g.state.market.carrot);
  assert.equal(info.pumpkin, undefined, 'citrouille : pas encore débloquée');
  // Hors saison : le blé en hiver.
  g.state.time = { ...g.state.time, seasonIndex: 3, dayOfSeason: 1, day: 22 };
  assert.equal(g.query.career.market().wheat.offSeason, true);
  assert.equal(g.query.career.market().turnip.offSeason, false);
});

test('prix d\'une récolte : Détente × 1,25, cours, hors saison, étal, « cueilli main » × 1,10 ; employé : sans', () => {
  const ext = withExtension();
  try {
    const g = newCareer();
    g.state.money = 10000;
    g.actions.plant(0, 'carrot');
    g.actions.plant(1, 'carrot');
    g.state.plots[0].growth = 2;
    g.state.plots[1].growth = 2;
    g.state.market.carrot = 1.2;
    const base = 10 * 1.25 * 1.2;
    const hand = g.actions.harvest(0);
    assert.equal(hand.amount, Math.round(base * HAND_BONUS));
    assert.equal(hand.handPicked, true);
    const r = ext.api().harvest(1, { by: 'staff' });
    assert.equal(r.amount, Math.round(base));
    assert.equal(r.handPicked, false);
    assert.equal(g.state.career.lifetime.harvests, 2);
    assert.equal(g.state.career.lifetime.handPicked, 1);
    // Étal (+20 %) et hors saison (× 1,25) : une carotte mûre récoltée en été.
    assert.ok(g.actions.career.upgradeBuilding('roadsideStand').ok);
    g.actions.plant(2, 'carrot');
    g.state.plots[2].growth = 2;
    g.state.time = { ...g.state.time, seasonIndex: 1, dayOfSeason: 1, day: 8 };
    assert.equal(g.query.plot(2).offSeason, true);
    assert.equal(g.actions.harvest(2).amount, Math.round(base * 1.2 * OFF_SEASON_FACTOR * HAND_BONUS));
    // Corbeau non chassé : −50 %.
    Object.assign(g.state.plots[3], { cropId: 'turnip', growth: 3, crowPenalty: true });
    const expected = Math.round(getCrop('turnip').sellPrice * 1.25 * g.state.market.turnip * 1.2 * OFF_SEASON_FACTOR * HAND_BONUS * 0.5);
    const cr = g.actions.harvest(3);
    assert.equal(cr.amount, expected);
    assert.equal(cr.crowPenalty, true);
    assert.equal(g.state.plots[3].crowPenalty, false);
  } finally {
    ext.off();
  }
});

test('cultures : débloquées par rang ; arbres au verger seulement', () => {
  const g = newCareer();
  g.state.money = 10000;
  const r = g.actions.plant(0, 'corn');
  assert.equal(r.ok, false);
  assert.match(r.reason, /Rang 2 requis/);
  g.state.time = { ...g.state.time, seasonIndex: 1, dayOfSeason: 1, day: 8 };
  setRank(g, 2);
  assert.ok(g.level.crops.includes('corn'));
  assert.ok(g.actions.plant(0, 'corn').ok);
  assert.match(g.actions.plant(1, 'apple').reason, /verger/);
  assert.ok(!g.query.plantableCrops(1).some((o) => o.id === 'apple'));
});

test('Détente, coup dur étape par étape : ateliers → grenier → Joseph → découvert → vente de secours ; jamais de fin', () => {
  const g = newCareer();
  const ev = record(g);
  // Préparation : un pré avec une bergerie et 2 moutons (achetés : vente de secours possible), un grenier.
  g.state.money = 100000;
  setRank(g, 2);
  assert.ok(g.actions.career.buyLot().ok);
  assert.ok(g.actions.career.developLot('lot3', 'meadow').ok);
  assert.ok(g.actions.career.build('lot3', 0, 'sheepfold').ok);
  assert.ok(g.actions.buyInvestment('sheep').ok);
  assert.ok(g.actions.buyInvestment('sheep').ok);
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  g.state.career.stock = { carrot: 3, wheat: 2 };
  goTo(g, 1, 7);
  // Soir du 1er fermage : 35 de charges, 20 pièces en poche ; le grenier vend les moins chères d'abord.
  g.state.money = 20;
  ev.clear();
  nextDay(g);
  const sold = ev.of('stockSold')[0];
  assert.equal(sold.reason, 'charges');
  assert.ok(sold.lines.some((l) => l.cropId === 'carrot'));
  assert.equal(ev.of('neighbourLoan').length, 0, 'le grenier a suffi');
  assert.equal(ev.of('billPaid').length, 1);
  assert.ok(g.state.money >= 0);
  // 2e saison : plus de grenier, 10 pièces → Joseph prête (plafond max(100, charges)) avec coussin.
  g.state.career.stock = {};
  goTo(g, 1, 14);
  g.state.money = 10;
  ev.clear();
  nextDay(g);
  const loan = ev.of('neighbourLoan')[0];
  assert.ok(loan, 'Joseph prête');
  assert.equal(loan.amount, 35 - 10 + 30);
  assert.equal(g.state.neighbourLoan.debt, Math.ceil(55 * 1.1));
  assert.equal(ev.of('hardship').length, 0);
  // 3e saison : on doit encore à Joseph → il ne prête plus : découvert (coup dur), on continue à jouer.
  goTo(g, 1, 21);
  g.state.money = 5;
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('neighbourLoan').length, 0);
  assert.equal(ev.of('billPaid').length, 1, 'les charges sont payées quand même');
  // Charges de l'aube : ferme 2 + entretien des 2 moutons 4 ; les œufs s'accumulent au poulailler (CORE-B : à ramasser).
  assert.equal(g.state.money, 5 - 35 - 2 - 4, 'découvert (charges de saison, puis charge de l\'aube)');
  assert.equal(ev.of('hardship')[0].stage, 'overdraft');
  assert.equal(g.state.status, 'playing');
  assert.equal(g.query.career.summary().paused, true);
  assert.equal(g.actions.buyInvestment('sheep').ok, false, 'achats impossibles');
  // 4e saison : encore sous −(charges) → vente de secours (moutons, du plus récent), puis paiement.
  goTo(g, 1, 28);
  g.state.money = -100;
  ev.clear();
  nextDay(g);
  const rescue = ev.of('rescueSale')[0];
  assert.ok(rescue, 'vente de secours');
  assert.equal(rescue.sold[0].kind, 'animal');
  assert.equal(rescue.sold[0].id, 'sheep');
  assert.equal(rescue.sold[0].amount, Math.round((110 + 10) * 0.5), 'le plus récent (2e mouton, 120) à 50 %');
  assert.equal(g.state.investments.sheep, 0);
  assert.equal(g.state.career.hardship.stage, 'rescueSold');
  assert.equal(g.state.status, 'playing');
  assert.equal(ev.of('yearEnd').length, 1, 'l\'année continue');
  // Retour au-dessus de 50 : fin du coup dur.
  g.state.money = 500;
  ev.clear();
  nextDay(g);
  assert.equal(ev.of('hardship')[0].stage, 'recovered');
  assert.equal(g.state.career.hardship, null);
  assert.equal(g.query.career.summary().paused, false);
  // La dette de Joseph suit d'une année à l'autre (pas d'effacement).
  assert.ok(g.state.neighbourLoan.debt > 0);
  assert.equal(g.state.neighbourLoan.forgiven, 0);
});

test('Détente : une ferme endettée et abandonnée ne finit jamais (8 ans sans rien faire)', () => {
  const g = newCareer();
  g.state.money = 100000;
  setRank(g, 2);
  g.actions.career.buyLot();
  g.actions.career.buyLot();
  g.actions.career.developLot('lot3', 'meadow');
  g.state.money = 0;
  for (let y = 0; y < 8; y++) skipYear(g);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.time.year, 9);
  assert.ok(g.state.money < 0, 'découvert');
  assert.ok(g.state.career.hardship, 'coup dur en cours, sans fin de partie');
});

test('Classique : charges impayables → faillite, la carrière se termine (archive proposée)', () => {
  const g = newCareer({ difficulty: 'classique' });
  const ev = record(g);
  g.state.money = 150;
  g.state.career.stock = {};
  goTo(g, 1, 7);
  g.state.money = 30;
  nextDay(g);
  const b = ev.of('bankrupt')[0];
  assert.ok(b);
  assert.equal(b.career, true);
  assert.equal(b.amountDue, 40);
  assert.equal(g.state.status, 'bankrupt');
  assert.equal(g.state.result.outcome, 'bankrupt');
  assert.deepEqual(Object.keys(b.archive).sort(), ['endedBy', 'farmName', 'patrimony', 'rank', 'years']);
  assert.equal(b.archive.endedBy, 'bankrupt');
  assert.equal(ev.of('billPaid').length, 0);
  // Plus rien ne bouge.
  const t = { ...g.state.time };
  g.update(DAY_SECONDS * 3);
  assert.deepEqual(g.state.time, t);
  assert.equal(g.actions.plant(0, 'carrot').ok, false);
  assert.equal(g.actions.career.buyLot().ok, false);
  // Classique : le grenier et les ateliers se vendent d'abord (pas de faillite s'ils suffisent).
  const h = newCareer({ difficulty: 'classique' });
  const ev2 = record(h);
  h.state.money = 10000;
  setRank(h, 2);
  h.actions.career.upgradeBuilding('storage');
  h.state.career.stock = { corn: 5 };
  goTo(h, 1, 7);
  h.state.money = 0;
  nextDay(h);
  assert.equal(h.state.status, 'playing');
  assert.equal(ev2.of('stockSold')[0].reason, 'charges');
});

test('points d\'accroche : saison, aube, tranches de journée, soir, fin d\'année, revenus, fournisseurs, actions', () => {
  const calls = { seasonStart: 0, dawn: 0, evening: 0, yearEnd: 0, dawnEvents: 0, water: 0 };
  const ticks = [];
  const ext = withExtension({
    hooks: {
      seasonStart: () => calls.seasonStart++,
      dawnEvents: () => calls.dawnEvents++,
      water: () => {
        calls.water++;
        return [];
      },
      dawn: () => calls.dawn++,
      evening: (api, info) => {
        calls.evening++;
        if (info.lastDayOfYear) calls.lastOfYear = api.state.time.day;
      },
      yearEnd: (api, { report }) => {
        calls.yearEnd++;
        report.extra = 'ok';
      },
      tick: (api, from, to) => ticks.push([from, to]),
      incomes: () => [{ source: 'tourists', amount: 5, key: 'visitors', kind: 'tourists' }],
    },
    providers: {
      priceFactor: (state, { kind, id }) => (kind === 'crop' && id === 'carrot' ? 2 : 1),
      patrimony: () => 1000,
      unlocks: (rank) => (rank === 3 ? [{ kind: 'machine', id: 'seeder', name: 'Semoir (extension)' }] : []),
    },
    actions: (api) => ({ hello: () => ({ ok: true, rank: api.state.career.rank }) }),
    queries: () => ({ staff: () => ['Lucie'] }),
  });
  try {
    const g = newCareer();
    const ev = record(g);
    g.update(DAY_SECONDS / 4);
    g.update(DAY_SECONDS / 4);
    assert.deepEqual(ticks, [[0, 5], [5, 10]]);
    g.update(DAY_SECONDS * 2 - 10);
    assert.equal(calls.dawn, 2);
    skipYear(g);
    assert.equal(calls.seasonStart, 4);
    assert.equal(calls.yearEnd, 1);
    assert.equal(calls.lastOfYear, 28);
    assert.equal(ev.of('yearEnd')[0].report.extra, 'ok');
    assert.ok(ev.of('dawn')[0].incomes.some((i) => i.source === 'tourists'));
    assert.ok(g.state.career.history[0].incomeBy.visitors > 0);
    assert.equal(g.query.career.summary().patrimony, Math.round(g.state.money + 1000));
    assert.deepEqual(g.actions.career.hello(), { ok: true, rank: 1 });
    assert.deepEqual(g.query.career.staff(), ['Lucie']);
    assert.ok(g.query.career.summary().nextRank.unlocks.length > 0);
    // Prix × 2 sur la carotte (fête).
    g.state.money = 1000;
    g.state.plots[0].cropId = null;
    g.actions.plant(0, 'carrot');
    g.state.plots[0].growth = 2;
    g.state.market.carrot = 1;
    assert.equal(g.actions.harvest(0).amount, Math.round(10 * 1.25 * 2 * HAND_BONUS));
  } finally {
    ext.off();
  }
  // Actions des lots CORE-B (livrés) : refus motivé (embauche au rang 2), aucune machine au départ.
  const g = newCareer();
  const hire = g.actions.career.hire('x');
  assert.equal(hire.ok, false);
  assert.notEqual(hire.reason, 'Bientôt disponible.');
  assert.deepEqual(g.query.career.machines(), []);
});

test('points d\'accroche : récolte mise de côté (commande), animaux ramassés par une extension', () => {
  const ext = withExtension({
    investments: [{ id: 'hen', name: 'Poule', category: 'animal', kind: 'unit', shelter: 'coop', price: { base: 30, step: 0 }, income: { spring: 2, summer: 2, autumn: 2, winter: 2 }, upkeep: 0, rank: 1, effects: {} }],
    flags: { collectAnimals: true },
    hooks: { harvest: (api, { cropId }) => (cropId === 'turnip' ? { divert: true, label: 'Mme Leblanc' } : null) },
  });
  try {
    const g = newCareer();
    const ev = record(g);
    g.state.money = 1000;
    g.actions.plant(0, 'turnip');
    g.state.plots[0].growth = 3;
    const r = g.actions.harvest(0);
    assert.equal(r.amount, 0);
    assert.equal(ev.of('harvested')[0].diverted, 'Mme Leblanc');
    nextDay(g);
    assert.ok(!ev.of('dawn')[0].incomes.some((i) => i.source === 'hen'), 'les œufs ne sont plus payés à l\'aube');
  } finally {
    ext.off();
  }
  // Avec l'extension des animaux (CORE-B) : les œufs s'accumulent au poulailler, à ramasser.
  const g = newCareer();
  const ev = record(g);
  nextDay(g);
  assert.equal(ev.of('dawn')[0].incomes.find((i) => i.source === 'hen'), undefined);
  assert.equal(g.state.career.buildings.coop.pending, 4);
});

test('mode Niveaux intact : aucune branche de carrière', () => {
  const g = createGame({ levelId: 1, seed: 1, difficulty: 'classique' });
  assert.equal(g.mode, 'levels');
  assert.equal(g.state.mode, undefined);
  assert.equal(g.state.career, undefined);
  assert.equal(g.actions.career, undefined);
  assert.equal(g.query.career, undefined);
  assert.equal(g.refreshLevel, undefined);
  assert.equal(g.level, levelFor(1, 'classique'));
  assert.deepEqual(Object.keys(g.state.rng), ['weather', 'market', 'rot']);
  assert.equal(g.query.calendar().year, undefined);
  // Une année de niveau se termine toujours (victoire ou faillite), elle ne continue pas.
  g.state.money = 100000;
  for (let d = 0; d < 28; d++) {
    g.state.weather.tomorrow = 'sunny';
    g.update(DAY_SECONDS);
  }
  assert.equal(g.state.status, 'victory');
  assert.equal(g.state.time.day, 28);
});

test('prix des terrains : ceux du § 2.2', () => {
  assert.deepEqual(LOT_PRICES, [250, 400, 600, 900, 1300, 1900, 2700, 3800, 5300, 7400, 10000, 14000]);
  assert.equal(LOT_PRICES.reduce((a, b) => a + b, 0), 48550);
});

test('une ferme tenue passe au rang 2 dans l\'année (objectifs et patrimoine)', () => {
  const g = newCareer();
  const ev = record(g);
  for (let d = 0; d < 28 && g.state.career.rank < 2; d++) {
    tendAll(g);
    if (g.state.career.lotsBought === 0 && g.state.money > 400) g.actions.career.buyLot();
    nextDay(g, d % 5 === 0 ? 'rain' : 'sunny');
  }
  const up = ev.of('rankUp')[0];
  if (up) {
    assert.equal(up.rank, 2);
    assert.equal(up.ecus, 40);
    assert.equal(up.name, 'Ferme familiale');
    assert.ok(up.unlocks.some((u) => u.kind === 'crop' && u.id === 'corn'));
  }
  assert.ok(g.state.career.objectives.firstLot);
});
