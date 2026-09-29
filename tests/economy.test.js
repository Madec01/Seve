import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, newGame, nextDay, record, rich, skipDays } from './helpers.js';
import { BASE_DAILY_CHARGE } from '../src/data/balance.js';
import { getInvestment } from '../src/data/investments.js';
import { getLevel } from '../src/data/levels.js';

const coop = getInvestment('chickenCoop');

test('acheter un investissement : prix successifs, maximum, événement', () => {
  const g = newGame(3);
  rich(g, 10000);
  const rec = record(g);
  let money = g.state.money;
  for (let n = 0; n < coop.costs.length; n++) {
    const q = g.query.investments().find((i) => i.id === 'chickenCoop');
    assert.equal(q.owned, n);
    assert.equal(q.nextCost, coop.costs[n]);
    assert.equal(q.canBuy, true);
    assert.equal(q.reason, null);
    const r = g.actions.buyInvestment('chickenCoop');
    assert.deepEqual(r, { ok: true, owned: n + 1, cost: coop.costs[n] });
    money -= coop.costs[n];
    assert.equal(g.state.money, money);
  }
  const q = g.query.investments().find((i) => i.id === 'chickenCoop');
  assert.equal(q.nextCost, null);
  assert.equal(q.canBuy, false);
  assert.equal(q.reason, `Vous avez déjà le maximum (${coop.costs.length}).`);
  assert.equal(g.actions.buyInvestment('chickenCoop').ok, false);
  assert.deepEqual(
    rec.of('purchased').map((e) => e.owned),
    [1, 2, 3],
  );
  assert.deepEqual(rec.of('purchased')[0], { type: 'purchased', investmentId: 'chickenCoop', owned: 1, cost: coop.costs[0] });
  assert.equal(g.state.stats.year.investmentsSpent, coop.costs.reduce((a, b) => a + b, 0));
});

test('la première vache coûte plus cher (étable comprise)', () => {
  const cow = getInvestment('cow');
  assert.ok(cow.costs[0] > cow.costs[1]);
  const g = newGame(3);
  rich(g);
  assert.equal(g.actions.buyInvestment('cow').cost, cow.costs[0]);
  assert.equal(g.actions.buyInvestment('cow').cost, cow.costs[1]);
});

test('refus : argent, niveau, identifiant', () => {
  const g = newGame(1);
  g.state.money = coop.costs[0] - 12;
  const r = g.actions.buyInvestment('chickenCoop');
  assert.deepEqual(r, { ok: false, reason: "Pas assez d'argent (il manque 12 pièces)." });
  assert.equal(g.query.investments().find((i) => i.id === 'chickenCoop').reason, "Pas assez d'argent (il manque 12 pièces).");
  assert.equal(g.actions.buyInvestment('cow').reason, '« Vache » n\'est pas disponible dans ce niveau.');
  assert.equal(g.actions.buyInvestment('dragon').reason, 'Investissement inconnu.');
  assert.deepEqual(
    g.query.investments().map((i) => i.id),
    getLevel(1).availableInvestments,
  );
  const g8 = newGame(8);
  rich(g8);
  assert.ok(!g8.query.investments().some((i) => i.id === 'sprinkler'));
  assert.equal(g8.actions.buyInvestment('sprinkler').ok, false);
});

test('query.investments : champs', () => {
  const g = newGame(3);
  const inv = g.query.investments().find((i) => i.id === 'guestHouse');
  assert.deepEqual(Object.keys(inv).sort(), ['canBuy', 'description', 'effects', 'id', 'income', 'incomeBySeason', 'kind', 'max', 'name', 'nextCost', 'owned', 'reason', 'upkeep'].sort());
  assert.equal(inv.income, getInvestment('guestHouse').income.spring);
  assert.equal(inv.max, 1);
});

test("revenus à l'aube : par saison, ruche nulle en hiver, étal nul sous l'orage", () => {
  const g = newGame(3);
  rich(g);
  for (const id of ['chickenCoop', 'beehive', 'roadsideStand', 'guestHouse', 'cow']) g.actions.buyInvestment(id);
  const rec = record(g);
  nextDay(g, 'sunny');
  const byId = (d) => Object.fromEntries(d.incomes.filter((i) => i.kind === 'daily').map((i) => [i.source, i.amount]));
  let inc = byId(rec.of('dawn').at(-1));
  assert.equal(inc.chickenCoop, getInvestment('chickenCoop').income.spring);
  assert.equal(inc.beehive, getInvestment('beehive').income.spring);
  assert.equal(inc.roadsideStand, getInvestment('roadsideStand').income.spring);
  assert.equal(inc.guestHouse, getInvestment('guestHouse').income.spring);
  assert.equal(inc.cow, getInvestment('cow').income.spring);
  nextDay(g, 'storm');
  inc = byId(rec.of('dawn').at(-1));
  assert.equal(inc.roadsideStand, undefined);
  skipDays(g, 5); // jour 8 : été
  inc = byId(rec.of('dawn').at(-1));
  assert.equal(g.query.calendar().seasonId, 'summer');
  assert.equal(inc.roadsideStand, getInvestment('roadsideStand').income.summer);
  assert.equal(inc.guestHouse, getInvestment('guestHouse').income.summer);
  skipDays(g, 14); // hiver
  inc = byId(rec.of('dawn').at(-1));
  assert.equal(g.query.calendar().seasonId, 'winter');
  assert.equal(inc.beehive, undefined);
  assert.equal(inc.guestHouse, getInvestment('guestHouse').income.winter);
  const d = rec.of('dawn').at(-1);
  assert.equal(d.net, d.incomes.reduce((s, i) => s + i.amount, 0) - d.charges);
});

test('charges quotidiennes : ferme + entretien − solaire, jamais négatives', () => {
  const g = newGame(3);
  rich(g, 10000);
  assert.equal(g.query.finance().dailyCharges, BASE_DAILY_CHARGE);
  g.actions.buyInvestment('chickenCoop');
  g.actions.buyInvestment('cow');
  const upkeep = getInvestment('chickenCoop').upkeep + getInvestment('cow').upkeep;
  assert.equal(g.query.finance().dailyCharges, BASE_DAILY_CHARGE + upkeep);
  g.actions.buyInvestment('solarPanel');
  const red = getInvestment('solarPanel').effects.chargeReduction;
  assert.equal(g.query.finance().dailyCharges, Math.max(0, BASE_DAILY_CHARGE + upkeep - red));
  g.actions.buyInvestment('solarPanel');
  assert.equal(g.query.finance().dailyCharges, Math.max(0, BASE_DAILY_CHARGE + upkeep - 2 * red));
  const g2 = newGame(3);
  rich(g2);
  g2.actions.buyInvestment('solarPanel');
  g2.actions.buyInvestment('solarPanel');
  assert.equal(g2.query.finance().dailyCharges, 0);
  const money = g2.state.money;
  nextDay(g2);
  assert.equal(g2.state.money, money);
});

test("l'arrosage automatique a un entretien forfaitaire", () => {
  const g = newGame(1);
  rich(g);
  g.actions.buyInvestment('sprinkler');
  g.actions.buyInvestment('sprinkler');
  assert.equal(g.query.finance().dailyCharges, BASE_DAILY_CHARGE + getInvestment('sprinkler').upkeep);
});

test('tonte des moutons : le dernier jour du printemps, de l’été et de l’automne', () => {
  const g = newGame(3);
  rich(g);
  g.actions.buyInvestment('sheep');
  g.actions.buyInvestment('sheep');
  const shear = [];
  g.on('dawn', (d) => {
    for (const i of d.incomes) if (i.kind === 'shearing') shear.push([d.day, i.amount]);
  });
  g.update(DAY_SECONDS * 40);
  const amount = 2 * getInvestment('sheep').effects.shearing;
  assert.deepEqual(shear, [
    [7, amount],
    [14, amount],
    [21, amount],
  ]);
});

test('finance : revenu estimé, prochain fermage', () => {
  const g = newGame(1);
  rich(g, 5000);
  g.actions.buyInvestment('chickenCoop');
  const f = g.query.finance();
  assert.equal(f.money, g.state.money);
  assert.equal(f.dailyIncome, coop.income.spring);
  assert.equal(f.dailyCharges, BASE_DAILY_CHARGE + coop.upkeep);
  assert.equal(f.net, f.dailyIncome - f.dailyCharges);
  assert.deepEqual(f.nextBill, { amount: getLevel(1).rents[0], daysLeft: 6, seasonId: 'spring' });
  assert.equal(f.loan, null);
  skipDays(g, 6);
  assert.equal(g.query.finance().nextBill.daysLeft, 0);
  nextDay(g);
  assert.deepEqual(g.query.finance().nextBill, { amount: getLevel(1).rents[1], daysLeft: 6, seasonId: 'summer' });
});

test('fermage payé le dernier soir de la saison', () => {
  const g = newGame(1);
  const rent = getLevel(1).rents[0];
  skipDays(g, 6);
  const rec = record(g);
  g.state.money = rent + 3;
  g.update(DAY_SECONDS - 0.001);
  assert.equal(rec.of('billPaid').length, 0);
  g.update(0.001);
  const bill = rec.of('billPaid');
  assert.equal(bill.length, 1);
  assert.equal(bill[0].amount, rent);
  assert.equal(bill[0].seasonId, 'spring');
  assert.equal(bill[0].summary.rentsPaid, rent);
  assert.equal(bill[0].summary.seasonId, 'spring');
  assert.equal(bill[0].summary.season.rentsPaid, rent);
  // fermage payé avant l'aube suivante (et ses charges)
  const types = rec.events.map((e) => e.type);
  assert.ok(types.indexOf('billPaid') < types.indexOf('dawn'));
  assert.equal(g.state.money, 3 - g.state.lastDawn.charges + g.state.lastDawn.incomes.reduce((s, i) => s + i.amount, 0));
  assert.equal(g.state.status, 'playing');
  // les statistiques de saison repartent à zéro
  assert.equal(g.state.stats.season.rentsPaid, 0);
  assert.equal(g.state.stats.year.rentsPaid, rent);
});

test('argent exactement égal au fermage : ça passe', () => {
  const g = newGame(1);
  skipDays(g, 6);
  g.state.money = getLevel(1).rents[0];
  nextDay(g);
  assert.equal(g.state.status, 'playing');
});

test('faillite si l’argent ne couvre pas le fermage', () => {
  const g = newGame(1);
  const rent = getLevel(1).rents[0];
  const rec = record(g);
  skipDays(g, 6);
  g.state.money = rent - 1;
  nextDay(g);
  assert.equal(g.state.status, 'bankrupt');
  const b = rec.of('bankrupt');
  assert.equal(b.length, 1);
  assert.equal(b[0].amountDue, rent);
  assert.equal(b[0].money, rent - 1);
  assert.equal(b[0].seasonId, 'spring');
  assert.equal(b[0].summary.rentsPaid, 0);
  assert.equal(b[0].summary.amountDue, rent);
  assert.equal(g.state.money, rent - 1);
  assert.deepEqual(g.state.result, { outcome: 'bankrupt', amountDue: rent, money: rent - 1, seasonId: 'spring', day: 7 });
  assert.equal(rec.of('dawn').filter((d) => d.day === 8).length, 0);
});

test('victoire après le fermage d’hiver, étoiles selon l’argent final', () => {
  const lvl = getLevel(1);
  const [t2, t3] = lvl.starThresholds;
  const winterRent = lvl.rents[3];
  for (const [final, stars] of [
    [0, 1],
    [t2 - 1, 1],
    [t2, 2],
    [t3 - 1, 2],
    [t3, 3],
    [t3 + 5000, 3],
  ]) {
    const g = newGame(1);
    rich(g);
    const rec = record(g);
    skipDays(g, 27);
    assert.equal(g.query.calendar().day, 28);
    g.state.money = final + winterRent;
    nextDay(g);
    assert.equal(g.state.status, 'victory');
    const v = rec.of('victory');
    assert.equal(v.length, 1);
    assert.equal(v[0].money, final);
    assert.equal(v[0].stars, stars, `argent ${final}`);
    assert.equal(v[0].summary.stars, stars);
    assert.deepEqual(g.state.result, { outcome: 'victory', stars, money: final, day: 28 });
    assert.equal(g.actions.buyInvestment('chickenCoop').reason, 'La partie est terminée.');
    assert.ok(g.query.investments().every((i) => !i.canBuy));
  }
});

test("les charges peuvent rendre l'argent négatif ; les achats non", () => {
  const g = newGame(1);
  g.state.money = 0;
  const rec = record(g);
  nextDay(g);
  assert.equal(g.state.money, -BASE_DAILY_CHARGE);
  assert.deepEqual(rec.of('moneyChanged').at(-1), { type: 'moneyChanged', money: -BASE_DAILY_CHARGE, delta: -BASE_DAILY_CHARGE });
  assert.equal(g.actions.plant(1, 'carrot').ok, false);
  // arroser gratuitement reste possible avec une dette
  g.state.money = 0;
  g.state.money = -30;
  g.state.plots[1].cropId = 'carrot';
  assert.equal(g.actions.water(1).ok, true);
});

test('prêt : mensualités à dates fixes, argent négatif toléré', () => {
  const lvl = getLevel(7);
  const loan = lvl.modifiers.loan;
  const g = newGame(7);
  const first = loan.first ?? loan.every + 1;
  assert.equal(g.state.money, lvl.startMoney);
  const f0 = g.query.finance().loan;
  assert.equal(f0.payment, loan.payment);
  assert.equal(f0.every, loan.every);
  assert.equal(f0.nextInDays, first - 1);
  const expectedDays = [];
  for (let d = first; d <= 28; d += loan.every) expectedDays.push(d);
  assert.equal(f0.paymentsLeft, expectedDays.length);
  assert.equal(f0.remaining, expectedDays.length * loan.payment);
  rich(g);
  const paid = [];
  g.on('dawn', (d) => {
    const l = d.chargesDetail.find((c) => c.source === 'loan');
    if (l) paid.push([d.day, l.amount]);
  });
  g.update(DAY_SECONDS * 40);
  assert.deepEqual(
    paid,
    expectedDays.map((d) => [d, loan.payment]),
  );
  assert.equal(g.state.stats.year.loanPaid, expectedDays.length * loan.payment);
  // Dette possible : la mensualité passe même sans argent.
  const g2 = newGame(7);
  skipDays(g2, first - 2);
  g2.state.money = 10;
  nextDay(g2);
  assert.equal(g2.state.money, 10 - loan.payment - g2.query.finance().dailyCharges);
  assert.ok(g2.state.money < 0);
  assert.equal(g2.query.finance().loan.nextInDays, loan.every);
});

test("sécheresse : chaque arrosage coûte, refus si l'argent manque", () => {
  const lvl = getLevel(2);
  const cost = lvl.modifiers.waterCost;
  assert.ok(cost > 0);
  const g = newGame(2);
  const rec = record(g);
  g.actions.plant(1, 'carrot');
  let money = g.state.money;
  assert.deepEqual(g.actions.water(1), { ok: true, cost });
  assert.equal(g.state.money, money - cost);
  assert.equal(rec.of('watered')[0].amount, cost);
  assert.equal(g.state.stats.year.waterSpent, cost);
  g.actions.plant(2, 'carrot');
  g.state.money = cost - 1;
  assert.equal(g.actions.water(2).reason, `Pas assez d'argent (il manque 1 pièce).`);
  assert.equal(g.query.plot(2).watered, false);
  // l'arrosage automatique coûte aussi, et peut créer une dette
  rich(g);
  g.actions.buyInvestment('sprinkler');
  g.state.money = 0;
  nextDay(g, 'sunny');
  const d = rec.of('dawn').at(-1);
  assert.deepEqual(d.sprinkled, [1, 2]);
  assert.deepEqual(
    d.chargesDetail.find((c) => c.source === 'water'),
    { source: 'water', amount: 2 * cost },
  );
  assert.equal(g.state.money, -d.charges);
  money = g.state.money;
  assert.equal(g.actions.water(1).reason, "Déjà arrosée aujourd'hui.");
  assert.equal(g.query.finance().waterCost, cost);
  assert.equal(g.state.money, money);
});
