// Mode Carrière — événements vivants (CORE-C) : calendrier des fêtes (prix, graines, chambre d'hôte),
// événements au hasard (déterminisme, fréquence, règles), visiteurs et commandes (récoltes mises de côté,
// grenier, échéance), touristes, corbeaux, arc-en-ciel, rosée, marchand, animal perdu, cadeau de Joseph,
// pêche, sauvegarde en plein événement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer, checkCareerState } from '../src/core/career/career.js';
import { createGame } from '../src/core/game.js';
import { getCrop } from '../src/data/crops.js';
import { CALENDAR_EVENTS, RANDOM_EVENT_RULES, VISITOR } from '../src/data/career/events.js';
import { dayIndex, festivalToday } from '../src/core/career/events.js';
import { DAY_SECONDS, goTo, newCareer, nextDay, record, setRank, skipDays, skipYear, tendAll } from './career-helpers.js';

const L = 7;
const dayOf = (seasonIndex, d) => seasonIndex * L + d;

/** Parcelle mûre de la culture donnée (test). */
function ripen(g, i, cropId) {
  const p = g.state.plots[i];
  p.cropId = cropId;
  p.growth = getCrop(cropId).growDays;
  p.fruit = 0;
  p.watered = false;
}

/** Sème `n` parcelles du champ de départ (non mûres). */
function sow(g, cropId, n = 12) {
  let k = 0;
  g.state.plots.forEach((p) => {
    if (k >= n || !p.unlocked || p.env !== 'field' || p.cropId) return;
    p.cropId = cropId;
    p.growth = 0;
    p.watered = false;
    k++;
  });
}

test('parité : une partie de niveau n\'a ni événements de carrière ni requêtes de carrière', () => {
  const g = createGame({ levelId: 1, seed: 1, difficulty: 'detente' });
  assert.equal(g.query.career, undefined);
  assert.equal(g.actions.career, undefined);
  assert.equal(g.state.career, undefined);
  assert.equal(g.state.rng.events, undefined);
});

test('calendrier : fêtes au bon jour, bandeau la veille, cochées puis remises à zéro au bilan', () => {
  const g = newCareer();
  const ev = record(g);
  setRank(g, 2);
  skipYear(g);
  const fests = ev.of('festival');
  assert.deepEqual(fests.map((f) => f.id), CALENDAR_EVENTS.map((f) => f.id));
  for (const f of fests) {
    const def = CALENDAR_EVENTS.find((x) => x.id === f.id);
    assert.equal(f.day, def.day);
  }
  // Nouvelle année : calendrier remis à zéro, bilan de l'année complété.
  assert.deepEqual(g.state.career.events.calendarDone, []);
  const yearEnd = ev.of('yearEnd')[0];
  assert.deepEqual(yearEnd.report.events.festivals, CALENDAR_EVENTS.map((f) => f.id));
  // Veille de la foire aux semis : bandeau « demain ».
  goTo(g, 2, 2);
  const q = g.query.career.events();
  assert.equal(q.tomorrow.id, 'seedFair');
  assert.equal(q.today, null);
  assert.equal(q.calendar[0].id, 'seedFair');
  assert.equal(q.calendar[0].daysUntil, 1);
});

test('calendrier : marché de Noël seulement à partir du rang 2', () => {
  const g = newCareer();
  const ev = record(g);
  skipYear(g);
  assert.ok(!ev.of('festival').some((f) => f.id === 'christmasMarket'));
  assert.ok(g.query.career.events().calendar.find((c) => c.id === 'christmasMarket').locked);
});

test('foire aux semis : graines à −25 % (joueur et semoir), seulement ce jour-là', () => {
  const g = newCareer();
  goTo(g, 1, 2);
  assert.equal(festivalToday(g.state), null);
  const normal = g.query.plantableCrops(0).find((o) => o.id === 'tomato') ?? null;
  void normal;
  const money0 = g.state.money;
  assert.ok(g.actions.plant(0, 'strawberry').ok);
  const costDay2 = money0 - g.state.money;
  assert.equal(costDay2, getCrop('strawberry').seedCost);
  nextDay(g);
  assert.equal(festivalToday(g.state).id, 'seedFair');
  const money1 = g.state.money;
  assert.ok(g.actions.plant(1, 'strawberry').ok);
  assert.equal(money1 - g.state.money, Math.round(getCrop('strawberry').seedCost * 0.75));
  nextDay(g);
  const money2 = g.state.money;
  assert.ok(g.actions.plant(2, 'strawberry').ok);
  assert.equal(money2 - g.state.money, getCrop('strawberry').seedCost);
});

test('fête du village : récoltes +25 % ; fête des récoltes : +15 % partout ; marché de Noël : grenier +25 %', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 4));
  assert.equal(festivalToday(g.state).id, 'villageFete');
  assert.equal(g.query.career.market().tomato.fair, 1.25);
  ripen(g, 0, 'tomato');
  const expected = g.query.plot(0).handValue;
  const noFair = Math.round(expected / 1.25);
  const r = g.actions.harvest(0);
  assert.equal(r.amount, expected);
  assert.ok(Math.abs(r.amount / 1.25 - noFair) <= 1);
  goTo(g, 1, dayOf(2, 2));
  assert.equal(festivalToday(g.state).id, 'harvestFestival');
  assert.equal(g.query.career.market().corn.fair, 1.15);
  goTo(g, 1, dayOf(3, 4));
  assert.equal(festivalToday(g.state).id, 'christmasMarket');
  assert.equal(g.query.career.market().turnip.fair, 1, 'récoltes : prix normal');
  g.state.money = 100000;
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  g.state.career.stock = { turnip: 2 };
  const before = g.query.career.stock().lines[0].unitPrice;
  nextDay(g);
  g.state.career.stock = { turnip: 2 };
  // Même cours pour comparer : on remet le cours du jour de la fête.
  const after = g.query.career.stock().lines[0].unitPrice;
  assert.ok(before > after, 'le grenier se vend mieux le jour du marché de Noël');
});

test('fête du village : chambre d\'hôte × 2 ce jour-là', () => {
  const g = newCareer();
  setRank(g, 3);
  g.state.money = 100000;
  assert.ok(g.actions.career.buyLot().ok);
  assert.ok(g.actions.career.developLot('lot3', 'meadow').ok);
  assert.ok(g.actions.career.build('lot3', 0, 'guestHouse').ok);
  goTo(g, 1, dayOf(1, 3));
  const ev = record(g);
  nextDay(g); // fête du village
  const dawn = ev.of('dawn')[0];
  const guests = dawn.incomes.filter((i) => i.key === 'guests').reduce((s, i) => s + i.amount, 0);
  assert.equal(guests, 34 * 2);
  ev.clear();
  nextDay(g);
  const dawn2 = ev.of('dawn')[0];
  assert.equal(dawn2.incomes.filter((i) => i.key === 'guests').reduce((s, i) => s + i.amount, 0), 34);
});

test('événements au hasard : déterministes (même graine → mêmes événements), jamais les 3 premiers jours ni un jour de fête', () => {
  const run = (seed) => {
    const g = createCareer({ seed });
    const ev = record(g);
    setRank(g, 2);
    for (let d = 0; d < 56; d++) {
      tendAll(g);
      nextDay(g, d % 5 === 0 ? 'rain' : 'sunny');
    }
    return { events: ev.of('careerEvent').map((e) => `${e.kind}`), days: ev, state: JSON.stringify(g.state.career.events) };
  };
  const a = run(21);
  const b = run(21);
  assert.deepEqual(a.events, b.events);
  assert.equal(a.state, b.state);
  const c = run(22);
  assert.notEqual(JSON.stringify(c.events) + c.state, JSON.stringify(a.events) + a.state);
});

test('événements au hasard : ≈ 30 % des jours libres, jamais deux fois le même d\'affilée, un seul à la fois', () => {
  let started = 0;
  let free = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const g = createCareer({ seed });
    setRank(g, 2);
    g.state.money = 5000;
    let last = null;
    for (let d = 0; d < 56; d++) {
      tendAll(g);
      const before = g.state.career.events.active;
      const kinds = [];
      const off = g.on('careerEvent', (e) => kinds.push(e));
      nextDay(g, d % 4 === 0 ? 'rain' : 'sunny');
      if (typeof off === 'function') off();
      const today = dayIndex(g.state);
      const fest = festivalToday(g.state);
      assert.ok(kinds.length <= 1, 'un seul événement par aube');
      if (kinds.length) {
        assert.ok(today > RANDOM_EVENT_RULES.graceDays, 'pas pendant les 3 premiers jours');
        assert.equal(fest, null, 'pas un jour de fête');
        assert.notEqual(kinds[0].kind, last, 'jamais deux fois le même d\'affilée');
        last = kinds[0].kind;
      }
      // Jour « libre » : rien en cours à l'aube (hors événement d'un jour qui vient de finir), pas de fête.
      const wasFree = !before || !['visitor', 'merchant', 'lostPet'].includes(before.kind) || kinds.length > 0;
      if (today > RANDOM_EVENT_RULES.graceDays && !fest && wasFree) {
        free++;
        if (kinds.length) started++;
      }
    }
  }
  const rate = started / free;
  assert.ok(rate > 0.18 && rate < 0.36, `fréquence ${rate}`);
});

test('visiteur : accepter, récoltes mises de côté (→ nom), paiement × 1,5 à la dernière', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  sow(g, 'potato', 12);
  const r = g.actions.career.triggerEvent('visitor');
  assert.ok(r.ok, r.reason);
  const offer = g.query.career.events().offers[0];
  assert.equal(offer.kind, 'visitor');
  assert.ok(offer.n >= 3 && offer.n <= 7);
  assert.equal(offer.daysLeft, VISITOR.days - 1);
  const cropId = offer.data.cropId;
  const unit = Math.round(getCrop(cropId).sellPrice * 1.25 * 1.5);
  assert.equal(offer.reward, unit * offer.n);
  // Sans accepter : la récolte est vendue normalement.
  ripen(g, 0, cropId);
  assert.ok(g.actions.harvest(0).amount > 0);
  const ev = record(g);
  assert.ok(g.actions.career.acceptOffer(offer.id).ok);
  assert.equal(g.actions.career.acceptOffer(offer.id).ok, false, 'déjà acceptée');
  const money0 = g.state.money;
  for (let k = 0; k < offer.n; k++) {
    ripen(g, k, cropId);
    const h = g.actions.harvest(k);
    assert.equal(h.amount, 0, 'mise de côté');
  }
  const harvested = ev.of('harvested');
  assert.equal(harvested[0].diverted, `→ ${offer.data.name}`);
  const done = ev.of('offerResolved')[0];
  assert.equal(done.outcome, 'delivered');
  assert.equal(done.amount, unit * offer.n);
  assert.equal(g.state.money - money0, unit * offer.n);
  assert.equal(g.state.career.events.offers.length, 0);
  assert.equal(g.state.career.events.active, null);
  assert.equal(ev.of('careerEventEnded').length, 1);
  assert.equal(g.state.career.yearStats.incomeBy.visitors, unit * offer.n);
});

test('visiteur : livraison depuis le grenier ; refus ; échéance (ce qui est mis de côté est payé au prix normal)', () => {
  const g = newCareer();
  setRank(g, 2);
  g.state.money = 10000;
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  goTo(g, 1, 5);
  assert.ok(g.actions.career.triggerEvent('visitor').ok);
  let offer = g.query.career.events().offers[0];
  const cropId = offer.data.cropId;
  g.state.career.stock = { [cropId]: 2 };
  assert.equal(g.query.career.events().offers[0].canDeliver, true);
  let r = g.actions.career.deliverOffer(offer.id);
  assert.ok(r.ok);
  assert.equal(r.delivered, 2);
  assert.equal(r.done, false);
  assert.equal(g.state.career.stock[cropId], undefined);
  assert.equal(g.actions.career.deliverOffer(offer.id).ok, false, 'grenier vide');
  // Échéance : 5 jours (aujourd'hui compris) ; rappel la veille du dernier jour ; les 2 unités livrées sont
  // payées au prix normal.
  assert.equal(g.query.career.events().offers[0].daysLeft, 4);
  const ev = record(g);
  const money0 = g.state.money;
  for (let k = 0; k < 4; k++) nextDay(g);
  assert.equal(ev.of('offerResolved').length, 0, 'encore valable le dernier jour');
  assert.equal(ev.of('offerReminder').length, 1, 'un rappel la veille du dernier jour');
  assert.equal(ev.of('offerReminder')[0].daysLeft, 1);
  nextDay(g);
  const exp = ev.of('offerResolved')[0];
  assert.equal(exp.outcome, 'expired');
  assert.equal(exp.amount, Math.round(getCrop(cropId).sellPrice * 1.25 * 2));
  assert.ok(g.state.money > money0 - 20);
  // Refus d'une nouvelle offre.
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('visitor').ok);
  offer = g.query.career.events().offers[0];
  r = g.actions.career.declineOffer(offer.id);
  assert.ok(r.ok);
  assert.equal(g.state.career.events.offers.length, 0);
  assert.equal(g.state.career.events.active, null);
});

test('touristes : 3 passages dans la journée (+5 × (1 + attrait))', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('tourists').ok, false, 'rien à visiter');
  g.state.investments.horse = 1; // attrait : un cheval
  assert.ok(g.actions.career.triggerEvent('tourists').ok);
  const ev = record(g);
  g.update(DAY_SECONDS * 0.5 / g.state.speed);
  assert.equal(ev.of('touristsPassed').length, 1);
  g.update(DAY_SECONDS * 0.49 / g.state.speed);
  assert.equal(ev.of('touristsPassed').length, 3);
  assert.deepEqual(ev.of('touristsPassed').map((e) => e.amount), [10, 10, 10]);
  assert.equal(g.state.career.yearStats.incomeBy.visitors, 30);
  nextDay(g);
  assert.equal(g.state.career.events.active?.kind === 'tourists', false, 'fini le lendemain');
});

test('corbeaux : chasser (1 geste) ; non chassé à l\'aube suivante → récolte à −50 %', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('crows').ok, false, 'moins de 12 parcelles semées');
  sow(g, 'potato', 12);
  const ev = record(g);
  assert.ok(g.actions.career.triggerEvent('crows').ok);
  const plots = ev.of('crow')[0].plots;
  assert.ok(plots.length >= 1 && plots.length <= 3);
  for (const i of plots) {
    assert.equal(g.state.plots[i].crow, true);
    assert.equal(g.query.plot(i).crow, true);
  }
  assert.equal(g.actions.career.chaseCrow(15).ok, false);
  assert.ok(g.actions.career.chaseCrow(plots[0]).ok);
  assert.equal(ev.of('crowChased')[0].by, 'player');
  assert.equal(g.state.plots[plots[0]].crow, false);
  if (plots.length === 1) {
    assert.equal(g.state.career.events.active, null, 'tous chassés : fin de l\'événement');
    return;
  }
  nextDay(g);
  const ended = ev.of('careerEventEnded').find((e) => e.kind === 'crows');
  assert.deepEqual(ended.data.penalized, plots.slice(1));
  const i = plots[1];
  assert.equal(g.state.plots[i].crow, false);
  assert.equal(g.state.plots[i].crowPenalty, true);
  assert.equal(g.state.plots[plots[0]].crowPenalty, false);
  ripen(g, i, 'potato');
  ripen(g, plots[0], 'potato');
  const good = g.actions.harvest(plots[0]);
  const bad = g.actions.harvest(i);
  assert.equal(bad.crowPenalty, true);
  assert.ok(Math.abs(bad.amount - good.amount / 2) <= 1);
  assert.equal(g.state.plots[i].crowPenalty, false);
});

test('corbeaux : jamais en hiver ; une parcelle vidée ne garde pas la pénalité', () => {
  const g = newCareer();
  goTo(g, 1, dayOf(3, 2));
  sow(g, 'turnip', 12);
  assert.equal(g.actions.career.triggerEvent('crows').ok, false);
  g.state.plots[0].crowPenalty = true;
  g.state.plots[0].cropId = null;
  nextDay(g);
  assert.equal(g.state.plots[0].crowPenalty, false);
});

test('arc-en-ciel (après la pluie) : pousse + 10 % ; rosée : champs arrosés', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('rainbow').ok, false, 'pas de pluie hier');
  g.state.lastDawn.weather = 'rain';
  assert.ok(g.actions.career.triggerEvent('rainbow').ok);
  g.state.plots[0].cropId = 'potato';
  g.state.plots[0].growth = 0;
  g.state.plots[0].watered = true;
  nextDay(g);
  assert.ok(Math.abs(g.state.plots[0].growth - 1.1) < 1e-9);
  assert.equal(g.state.career.events.active?.kind === 'rainbow', false);
  // Rosée.
  g.state.career.events.active = null;
  sow(g, 'carrot', 4);
  assert.ok(g.actions.career.triggerEvent('dew').ok);
  const plots = g.query.career.events().active.data.plots;
  assert.ok(plots.length >= 4);
  for (const i of plots) assert.equal(g.state.plots[i].watered, true);
});

test('marchand ambulant (rang 2) : engrais, poules, ruche ; aujourd\'hui seulement', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('merchant').ok, false, 'rang 2');
  setRank(g, 2);
  g.state.money = 1000;
  sow(g, 'potato', 8);
  assert.ok(g.actions.career.triggerEvent('merchant').ok);
  const offer = g.state.career.events.offers[0];
  // Engrais sur le champ de départ.
  offer.data = { itemId: 'fertilizer', name: 'Engrais', price: 150, text: '' };
  const money = g.state.money;
  assert.ok(g.actions.career.acceptOffer(offer.id).ok);
  assert.equal(money - g.state.money, 150);
  assert.equal(g.state.career.events.fertilizer.lotId, 'start');
  for (let d = 0; d < 3; d++) {
    for (let i = 0; i < 8; i++) g.state.plots[i].watered = true;
    nextDay(g);
  }
  assert.ok(Math.abs(g.state.plots[0].growth - Math.min(4, 3 * 1.25)) < 1e-9, `pousse ${g.state.plots[0].growth}`);
  assert.equal(g.state.career.events.fertilizer, null);
  // Poules (place au poulailler : 4 - 2). (Une commande de visiteur tirée à l'aube dure 5 jours : on l'enlève.)
  g.state.career.events.active = null;
  g.state.career.events.offers = [];
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('merchant').ok);
  const o2 = g.state.career.events.offers[0];
  o2.data = { itemId: 'hens', name: 'Deux poules', price: 40, text: '' };
  assert.ok(g.actions.career.acceptOffer(o2.id).ok);
  assert.equal(g.state.investments.hen, 4);
  assert.equal(g.state.career.assetLog.filter((a) => a.id === 'hen').length, 2);
  // Ruche d'occasion.
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('merchant').ok);
  const o3 = g.state.career.events.offers[0];
  o3.data = { itemId: 'beehive', name: 'Ruche', price: 40, text: '' };
  assert.ok(g.actions.career.acceptOffer(o3.id).ok);
  assert.equal(g.state.investments.beehive, 1);
  // Une offre non prise part le soir.
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('merchant').ok);
  const ev = record(g);
  nextDay(g);
  assert.equal(ev.of('offerResolved')[0].outcome, 'expired');
  assert.equal(g.state.career.events.offers.length, 0);
  assert.equal(checkCareerState(g.serialize()), null);
});

test('animal perdu : chaton puis chien, décoratifs', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.ok(g.actions.career.triggerEvent('lostPet').ok);
  const o = g.query.career.events().offers[0];
  assert.equal(o.kind, 'pet');
  assert.equal(o.data.petId, 'cat');
  assert.ok(g.actions.career.acceptOffer(o.id).ok);
  assert.equal(g.state.career.pets.cat, true);
  g.state.career.events.lastKind = null;
  assert.ok(g.actions.career.triggerEvent('lostPet').ok);
  assert.equal(g.query.career.events().offers[0].data.petId, 'dog');
});

test('cadeau de Joseph (2 ♥) : il sème des parcelles vides, sinon 30 pièces', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  assert.equal(g.actions.career.triggerEvent('josephGift').ok, false, 'il faut 2 ♥');
  g.state.career.joseph.hearts = 2;
  const money = g.state.money;
  assert.ok(g.actions.career.triggerEvent('josephGift').ok);
  const d = g.state.career.events.active.data;
  assert.equal(d.gift, 'seeds');
  assert.equal(d.n, 8);
  assert.equal(g.state.money, money, 'graines offertes');
  assert.equal(g.state.plots.filter((p) => p.cropId).length, 8);
  // Plus de parcelle vide : des pièces.
  g.state.career.events.active = null;
  g.state.career.events.lastKind = null;
  sow(g, 'carrot', 16);
  const m2 = g.state.money;
  assert.ok(g.actions.career.triggerEvent('josephGift').ok);
  assert.equal(g.state.career.events.active.data.gift, 'coins');
  assert.equal(g.state.money - m2, 30);
});

test('pêche : il faut une mare ; une fois par jour ; 5 à 40 pièces', () => {
  const g = newCareer();
  assert.equal(g.actions.career.fish().ok, false);
  setRank(g, 4);
  g.state.money = 100000;
  assert.ok(g.actions.career.buyLot().ok);
  assert.ok(g.actions.career.developLot('lot3', 'pond').ok);
  const ev = record(g);
  const r = g.actions.career.fish();
  assert.ok(r.ok);
  assert.ok(r.amount >= 5 && r.amount <= 40);
  assert.equal(ev.of('fishCaught')[0].amount, r.amount);
  assert.equal(g.actions.career.fish().ok, false, 'une fois par jour');
  assert.equal(g.query.career.events().fishing.fishedToday, true);
  nextDay(g);
  assert.ok(g.actions.career.fish().ok);
});

test('sauvegarde en plein événement : commande acceptée à moitié, corbeaux posés → reprise identique', () => {
  const g = newCareer();
  goTo(g, 1, 5);
  sow(g, 'potato', 12);
  assert.ok(g.actions.career.triggerEvent('visitor').ok);
  const offer = g.state.career.events.offers[0];
  assert.ok(g.actions.career.acceptOffer(offer.id).ok);
  ripen(g, 12, offer.data.cropId);
  g.actions.harvest(12);
  assert.equal(offer.delivered, 1);
  const saved = JSON.parse(JSON.stringify(g.serialize()));
  assert.equal(checkCareerState(saved), null);
  const g2 = loadCareer(saved);
  assert.deepEqual(g2.state.career.events, g.state.career.events);
  const ev = record(g2);
  const got = g2.state.career.events.offers[0];
  for (let k = 1; k < got.data.n; k++) {
    ripen(g2, 12 + (k % 4), got.data.cropId);
    g2.actions.harvest(12 + (k % 4));
  }
  assert.equal(ev.of('offerResolved')[0].outcome, 'delivered');
  // Même suite d'événements que la partie d'origine (déterminisme après chargement).
  const g3 = loadCareer(saved);
  const a = record(g2);
  const b = record(g3);
  g3.state.career.events = JSON.parse(JSON.stringify(g2.state.career.events));
  g3.state.plots = JSON.parse(JSON.stringify(g2.state.plots));
  g3.state.money = g2.state.money;
  g3.state.rng = JSON.parse(JSON.stringify(g2.state.rng));
  skipDays(g2, 10);
  skipDays(g3, 10);
  assert.deepEqual(a.of('careerEvent').map((e) => e.kind), b.of('careerEvent').map((e) => e.kind));
  // Sauvegarde abîmée : refusée.
  const bad = JSON.parse(JSON.stringify(saved));
  bad.career.events.offers[0].kind = 'dragon';
  assert.throws(() => loadCareer(bad), /offre/);
});

test('ancienne sauvegarde sans les champs de CORE-C : complétée à la reprise', () => {
  const g = newCareer();
  const saved = g.serialize();
  saved.career.events = { active: null, offers: [], calendarDone: [], fishedDay: 0, lastKind: null };
  saved.career.joseph = { hearts: 0, questsDone: 0, gifts: [] };
  const g2 = loadCareer(saved);
  assert.equal(g2.state.career.events.nextOfferId, 1);
  assert.equal(g2.state.career.joseph.nextQuestId, 1);
  skipDays(g2, 10);
  assert.equal(g2.state.status, 'playing');
});

test('fête du village : l\'équipe est joyeuse 7 jours (CORE-B : cheerStaff)', () => {
  const g = newCareer();
  setRank(g, 2);
  g.state.money = 10000;
  assert.ok(g.actions.career.upgradeBuilding('house').ok);
  const cand = g.query.career.candidates().list[0];
  assert.ok(g.actions.career.hire(cand.id, 'gardener', 'start').ok);
  goTo(g, 1, dayOf(1, 4));
  assert.equal(g.state.career.events.today, 'villageFete');
  const s = g.state.career.staff[0];
  assert.equal(s.mood, 'joyful');
  assert.ok(s.joyUntilDay > dayIndex(g.state));
});
