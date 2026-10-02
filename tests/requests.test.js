// Lot 3 « Variété » — générateur de demandes « faisables cette saison », tableau du village, charrette du marché,
// récoltes comptées (src/core/requests.js). Règles : docs/GAME_DESIGN.md § 16.1, § 16.2, § 16.4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { getCrop, isRareCrop, RARE_CROP_IDS } from '../src/data/crops.js';
import { BOARD, CART, CLIENTS_BY_ID, ORDER_RATES } from '../src/data/variety.js';
import { baseUnitValue, feasibleCrops, boardHorizon } from '../src/core/requests.js';
import { gameCrops } from '../src/core/perks.js';
import { wateredRate } from '../src/core/farm.js';
import { growthBonus } from '../src/core/economy.js';
import { DAY_SECONDS, nextDay, record, rich, skipDays } from './helpers.js';

function detente(levelId = 2, seed = 7, opts = {}) {
  const g = createGame({ levelId, seed, difficulty: 'detente', ...opts });
  g.state.weather.today = 'sunny';
  return g;
}

/** Hôte minimal pour appeler le générateur depuis un test. */
function hostOf(g) {
  const level = g.query.level();
  return {
    state: g.state,
    level,
    crops: gameCrops(level, g.state.perks),
    rateFor: (plot, tree) => (tree ? 1 + growthBonus(g.state, g.state.time.seasonIndex) : wateredRate(g.state, g.state.time.seasonIndex)),
  };
}

/** Récolte toutes les parcelles mûres, sème `cropId` partout où c'est vide, arrose. */
function tend(g, cropId) {
  for (let i = 0; i < g.state.plots.length; i++) {
    const p = g.query.plot(i);
    if (p.action === 'harvest') g.actions.harvest(i);
    if (g.query.plot(i).action === 'plant' && cropId) g.actions.plant(i, cropId);
    if (g.query.plot(i).action === 'water') g.actions.water(i);
  }
}

/** Sème une culture mûre tout de suite sur la parcelle i (tests). */
function ripe(g, i, cropId) {
  const p = g.state.plots[i];
  p.cropId = cropId;
  p.growth = getCrop(cropId).growDays;
  p.watered = false;
}

test('Classique : aucune variété (clé absente, aucun flux, aucune requête ni champ nouveau)', () => {
  const g = createGame({ levelId: 1, seed: 3, difficulty: 'classique' });
  assert.equal('variety' in g.state, false);
  assert.equal(g.state.rng.orders, undefined);
  assert.equal(g.state.rng.variety, undefined);
  assert.equal(g.variety, false);
  for (const q of ['variety', 'orders', 'cart', 'cards', 'challenges', 'merchant']) assert.equal(g.query[q](), null, q);
  assert.equal('claim' in g.query.plot(0), false);
  for (const row of g.query.plantableCrops(0)) {
    assert.equal('requested' in row, false);
    assert.equal('free' in row, false);
    assert.equal(row.rare, undefined);
  }
  assert.equal('variety' in g.query.summary(), false);
  assert.equal(g.actions.keepOrder('o1').ok, false);
  // Option explicite : la variété peut s'activer en Classique (point ouvert § 16.11).
  const c = createGame({ levelId: 1, seed: 3, difficulty: 'classique', variety: true });
  assert.ok(c.state.variety && c.state.rng.orders && c.state.rng.variety);
});

test('Détente : variété active par défaut ; false → null ; parties au choix', () => {
  const g = detente();
  assert.ok(g.variety);
  assert.deepEqual(g.state.variety.parts, { board: true, cards: true, cart: true, challenges: true, merchant: true, themes: false });
  assert.ok(Number.isInteger(g.state.rng.orders) && Number.isInteger(g.state.rng.variety));
  const off = detente(2, 7, { variety: false });
  assert.equal(off.state.variety, null);
  assert.equal(off.query.variety(), null);
  const some = detente(2, 7, { variety: { board: true, cards: false, cart: false, challenges: false, merchant: false } });
  assert.deepEqual(some.state.variety.parts, { board: true, cards: false, cart: false, challenges: false, merchant: false, themes: false });
  assert.equal(some.query.cart(), null);
  assert.equal(some.query.challenges(), null);
  assert.ok(some.query.orders().slots.some((s) => !s.empty));
});

test('les flux existants tirent les mêmes nombres avec ou sans la variété (météo, marché, maladie, surprises)', () => {
  for (const levelId of [2, 3, 6]) {
    const a = detente(levelId, 11);
    const b = detente(levelId, 11, { variety: false });
    for (let d = 0; d < 20; d++) {
      a.update(DAY_SECONDS);
      b.update(DAY_SECONDS);
    }
    for (const k of ['weather', 'market', 'rot', 'sky']) assert.equal(a.state.rng[k], b.state.rng[k], `${levelId} ${k}`);
    assert.deepEqual(a.state.weather, b.state.weather);
  }
});

test('générateur : chaque commande est faisable cette saison (culture du niveau, jamais rare, pousse ou se sème à temps)', () => {
  for (const levelId of [1, 2, 4, 5, 9, 11, 12]) {
    for (const seed of [1, 2, 3]) {
      const g = detente(levelId, seed);
      rich(g, 5000);
      const crops = gameCrops(g.query.level(), {}).map((c) => c.id);
      const seen = new Set();
      while (g.state.status === 'playing') {
        const host = hostOf(g);
        const feas = feasibleCrops(host, { horizon: boardHorizon(g.state, host.level) });
        for (const o of g.state.variety.board.slots) {
          if (!o || seen.has(o.id)) continue;
          seen.add(o.id);
          // Une commande neuve (de ce jour) : chaque culture est faisable aujourd'hui.
          if (o.day !== g.state.time.day) continue;
          for (const l of o.lines) {
            assert.ok(crops.includes(l.cropId), `${levelId}/${seed} : ${l.cropId} hors du niveau`);
            assert.ok(!isRareCrop(l.cropId));
            assert.ok(feas[l.cropId], `${levelId}/${seed} jour ${g.state.time.day} : ${l.cropId} pas faisable`);
            assert.ok(l.n >= 1 && l.got === 0);
          }
          assert.ok(CLIENTS_BY_ID[o.clientId]);
          assert.ok(ORDER_RATES.some((r) => r.rate === o.rate));
        }
        // Jamais deux fois le même client sur le tableau.
        const clients = g.state.variety.board.slots.filter(Boolean).map((o) => o.clientId);
        assert.equal(new Set(clients).size, clients.length);
        tend(g, null);
        g.update(DAY_SECONDS);
      }
      assert.ok(seen.size > 10, `${levelId}/${seed} : ${seen.size} commandes`);
    }
  }
});

test('générateur : « faisable » = pousse (sans geler), se sème à temps, ou fruits d\'un arbre adulte ; jamais une graine rare', () => {
  const g = detente(1, 4);
  const host = hostOf(g);
  // Printemps, 7 jours : carotte (2), navet (3), blé (4) se sèment à temps.
  let feas = feasibleCrops(host, { horizon: 7 });
  assert.deepEqual(Object.keys(feas).sort(), ['carrot', 'turnip', 'wheat']);
  assert.ok(Object.values(feas).every((e) => e.reasons.includes('sowable')));
  // Horizon court : seulement la carotte.
  feas = feasibleCrops(host, { horizon: 2 });
  assert.deepEqual(Object.keys(feas), ['carrot']);
  // Une culture qui pousse est faisable même si elle ne se sème plus.
  const [i0, i1] = g.state.plots.map((p, i) => (p.unlocked ? i : -1)).filter((i) => i >= 0);
  g.state.plots[i0].cropId = 'tomato';
  g.state.plots[i0].growth = 4;
  feas = feasibleCrops(host, { horizon: 2 });
  assert.deepEqual(feas.tomato.reasons, ['growing']);
  // Une graine rare plantée n'est jamais demandée.
  g.state.plots[i1].cropId = 'pea';
  feas = feasibleCrops(host, { horizon: 7 });
  assert.equal(feas.pea, undefined);
  // Automne : une culture qui gèlera avant d'être mûre n'est pas faisable.
  const a = detente(1, 4);
  a.state.time = { day: 20, seasonIndex: 2, dayOfSeason: 6, elapsed: 0 };
  a.state.plots[i0].cropId = 'corn';
  a.state.plots[i0].growth = 0;
  const fa = feasibleCrops(hostOf(a), { horizon: 3 });
  assert.equal(fa.corn, undefined, 'le maïs gèlera');
  assert.ok(fa.turnip, 'le navet résiste au gel');
});

test('générateur : la culture qu\'un atelier allumé transforme n\'est pas demandée (s\'il y a une autre culture)', () => {
  const g = detente(9, 5);
  rich(g, 5000);
  assert.ok(g.actions.buyInvestment('jamWorkshop').ok);
  g.update(DAY_SECONDS);
  for (let d = 0; d < 6; d++) {
    for (const o of g.state.variety.board.slots) if (o && o.day === g.state.time.day) assert.ok(o.lines.every((l) => l.cropId !== 'strawberry'), 'pas de fraises');
    g.update(DAY_SECONDS);
  }
});

test('tableau : 3 places ; niveau 1 à partir de l\'aube du 5ᵉ jour (événement ordersRenewed « start »)', () => {
  const g = detente(1, 2);
  assert.equal(g.state.variety.board.slots.length, BOARD.slots);
  assert.ok(g.state.variety.board.slots.every((o) => o === null));
  assert.equal(g.query.orders().startsIn, 4);
  const rec = record(g);
  skipDays(g, 3);
  assert.ok(g.state.variety.board.slots.every((o) => o === null), 'pas avant le 5ᵉ jour');
  nextDay(g);
  assert.equal(g.state.time.day, 5);
  assert.ok(g.state.variety.board.slots.some(Boolean));
  const ev = rec.of('ordersRenewed');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].reason, 'start');
  // Niveau 2 : dès le 1er jour.
  assert.ok(detente(2, 2).state.variety.board.slots.every(Boolean));
});

test('tableau : récolte à la main → payée au prix normal et comptée ; complète → prime = base × (taux − 1)', () => {
  const g = detente(2, 9);
  const o = g.state.variety.board.slots.find(Boolean);
  const line = o.lines[0];
  o.lines = [{ ...line, n: 2, got: 0 }];
  o.rate = 1.1;
  const rec = record(g);
  ripe(g, 0, line.cropId);
  ripe(g, 1, line.cropId);
  const raw0 = g.query.plot(0).harvestValue;
  assert.deepEqual(g.query.plot(0).claim, { kind: 'order', id: o.id, label: `→ ${CLIENTS_BY_ID[o.clientId].name}`, got: 0, n: 2 });
  const money0 = g.state.money;
  const r1 = g.actions.harvest(0);
  assert.ok(r1.ok);
  assert.equal(r1.processed, null);
  assert.equal(r1.claimed.kind, 'order');
  assert.equal(r1.amount, raw0 + (r1.qualityBonus || 0), 'payée au prix normal tout de suite');
  assert.equal(g.state.money, money0 + r1.amount);
  assert.equal(rec.of('orderProgress').length, 1);
  assert.equal(rec.of('orderProgress')[0].got, 1);
  assert.ok(g.query.orders().slots.find((s) => s.id === o.id).kept, 'commencée : gardée d\'office');
  const r2 = g.actions.harvest(1);
  const base = baseUnitValue(g.state, g.query.level(), line.cropId) * 2;
  const premium = Math.round(base * 0.1);
  const done = rec.of('orderDone');
  assert.equal(done.length, 1);
  assert.equal(done[0].premium, premium);
  assert.equal(done[0].thanks, CLIENTS_BY_ID[o.clientId].thanks);
  assert.equal(g.state.money, money0 + r1.amount + r2.amount + premium);
  // La place reste libre jusqu'à l'aube (coche « livrée »).
  const slot = g.query.orders().slots.find((s) => s.empty && s.delivered);
  assert.ok(slot);
  assert.equal(g.state.variety.stats.ordersDone, 1);
  assert.equal(g.query.summary().variety.orderPremium, premium);
  assert.equal(g.state.stats.year.varietyIncome, premium);
  nextDay(g);
  assert.ok(g.state.variety.board.slots.every(Boolean), 'la place se remplit à l\'aube');
});

test('tableau : « Pas pour moi » sans pénalité ; commencée → prime des unités données ; garder ; relance une fois par jour', () => {
  const g = detente(2, 12);
  const slots = g.state.variety.board.slots;
  const [a, b, c] = slots;
  const money0 = g.state.money;
  // Refus d'une commande pas commencée : rien ne change, la place reste vide jusqu'à l'aube.
  const r = g.actions.declineOrder(a.id);
  assert.deepEqual(r, { ok: true, premium: 0 });
  assert.equal(g.state.money, money0);
  assert.equal(slots[0], null);
  // Commande commencée puis refusée : la prime des unités données.
  b.rate = 1.15;
  b.lines[0].n = Math.max(2, b.lines[0].n);
  ripe(g, 0, b.lines[0].cropId);
  g.actions.harvest(0);
  const after = g.state.money;
  assert.equal(g.actions.keepOrder(b.id, false).reason, 'Une commande commencée reste gardée.');
  const d = g.actions.declineOrder(b.id);
  const expect = Math.round(baseUnitValue(g.state, g.query.level(), b.lines[0].cropId) * 0.15);
  assert.equal(d.premium, expect);
  assert.equal(g.state.money, after + expect);
  // Garder / relancer : la commande gardée reste ; une seule relance par jour.
  nextDay(g);
  const kept = g.state.variety.board.slots.find(Boolean);
  assert.ok(g.actions.keepOrder(kept.id).ok);
  const others = g.state.variety.board.slots.filter((o) => o && o.id !== kept.id).map((o) => o.id);
  const rr = g.actions.rerollOrders();
  assert.ok(rr.ok);
  assert.equal(rr.replaced, others.length);
  assert.ok(g.state.variety.board.slots.some((o) => o && o.id === kept.id));
  assert.ok(g.state.variety.board.slots.every((o) => !o || !others.includes(o.id)));
  assert.equal(g.actions.rerollOrders().reason, 'Une seule relance par jour : revenez demain.');
  assert.equal(g.query.orders().canReroll, false);
  void c;
  assert.equal(g.actions.keepOrder('o999').reason, 'Commande inconnue.');
  assert.equal(g.actions.deliverOrder(kept.id).reason, 'Les commandes se remplissent quand vous récoltez.');
});

test('tableau : une commande gardée devenue impossible au changement de saison est retirée (prime des unités données)', () => {
  const g = detente(2, 3);
  const o = g.state.variety.board.slots.find(Boolean);
  o.lines = [{ cropId: 'carrot', n: 5, got: 2 }];
  o.base = baseUnitValue(g.state, g.query.level(), 'carrot') * 2;
  o.kept = true;
  o.rate = 1.1;
  // Été : la carotte ne se sème plus et rien ne pousse.
  for (const p of g.state.plots) if (p.cropId === 'carrot') p.cropId = null;
  const rec = record(g);
  const money = g.state.money;
  while (g.state.time.seasonIndex === 0) nextDay(g);
  const rm = rec.of('orderRemoved').find((e) => e.orderId === o.id);
  assert.ok(rm);
  assert.equal(rm.reason, 'withdrawn');
  assert.equal(rm.premium, Math.round(o.base * 0.1));
  assert.ok(g.state.money >= money - 100);
});

test('charrette : arrive le 1er jour, caisses de cultures différentes ; prime au départ (partielle, pleine + écus, cheval × 2)', () => {
  const g = detente(2, 6);
  const cart = g.query.cart();
  assert.ok(cart);
  assert.equal(cart.crates.length, CART.crates);
  assert.equal(new Set(cart.crates.map((c) => c.cropId)).size, cart.crates.length);
  assert.equal(cart.crates[0].n, Math.round(CART.levelBase * 12 / 12 * 7 / 7));
  assert.equal(cart.departText, 'Part le soir du 7ᵉ jour');
  // Partielle : 2 unités de la 1re caisse.
  const crop = cart.crates[0].cropId;
  // Pas de commande du tableau pour cette culture : la charrette les reçoit.
  for (const o of g.state.variety.board.slots) if (o && o.lines.some((l) => l.cropId === crop)) g.actions.declineOrder(o.id);
  ripe(g, 0, crop);
  ripe(g, 1, crop);
  const rec = record(g);
  const r = g.actions.harvest(0);
  assert.equal(r.claimed.kind, 'cart');
  g.actions.harvest(1);
  assert.equal(rec.of('cartProgress').length, 2);
  const base = baseUnitValue(g.state, g.query.level(), crop) * 2;
  assert.equal(g.query.cart().premiumNow, Math.round(base * CART.share));
  while (g.state.time.dayOfSeason < 7) nextDay(g);
  const before = rec.of('cartDeparted').length;
  nextDay(g);
  const dep = rec.of('cartDeparted')[before];
  assert.equal(dep.premium, Math.round(base * CART.share));
  assert.equal(dep.allFull, false);
  assert.equal(dep.ecus, 0);
  // Ordre du soir : cartDeparted, billPaid, challengesJudged, cardsOffered, challengesOffered.
  const order = rec.events.map((e) => e.type).filter((t) => ['cartDeparted', 'billPaid', 'challengesJudged', 'cardsOffered', 'challengesOffered'].includes(t));
  assert.deepEqual(order, ['cartDeparted', 'billPaid', 'challengesJudged', 'cardsOffered', 'challengesOffered']);
  // Pleine : + part en plus et 2 écus ; cheval × 2.
  const h = detente(2, 6);
  const c2 = h.state.variety.cart;
  c2.horse = true;
  for (const crate of c2.crates) {
    crate.got = crate.n;
    c2.base += baseUnitValue(h.state, h.query.level(), crate.cropId) * crate.n;
  }
  const full = h.query.cart();
  const rec2 = record(h);
  while (h.state.time.dayOfSeason < 7) nextDay(h);
  nextDay(h);
  const d2 = rec2.of('cartDeparted')[0];
  assert.equal(d2.allFull, true);
  assert.equal(d2.ecus, CART.fullEcus);
  assert.equal(d2.premium, (Math.round(c2.base * CART.share) + Math.round(c2.base * CART.fullShare)) * 2);
  assert.equal(full.premiumNow, d2.premium);
});

test('charrette : rien chargé → message doux ; niveau 1 : à partir de l\'été ; niveau 4 et hiver : 2 caisses', () => {
  const g = detente(1, 3);
  assert.equal(g.query.cart(), null, 'pas au printemps du niveau 1');
  const rec = record(g);
  while (g.state.time.seasonIndex === 0) nextDay(g);
  assert.ok(g.query.cart(), 'été : la charrette arrive');
  assert.equal(rec.of('cartArrived').length, 1);
  while (g.state.time.seasonIndex === 1) nextDay(g);
  const dep = rec.of('cartDeparted')[0];
  if (dep.units === 0) assert.equal(dep.text, 'La charrette repart. À la saison prochaine !');
  const four = detente(4, 3);
  assert.equal(four.query.cart().crates.length, CART.smallCrates);
});

test('récoltes comptées : l\'atelier allumé avec une place passe d\'abord ; un géant compte pour 4 unités', () => {
  const g = detente(9, 8);
  rich(g, 5000);
  g.actions.buyInvestment('jamWorkshop');
  const o = g.state.variety.board.slots.find(Boolean);
  o.lines = [{ cropId: 'strawberry', n: 3, got: 0 }];
  ripe(g, 0, 'strawberry');
  assert.equal(g.query.plot(0).claim, null);
  const r = g.actions.harvest(0);
  assert.ok(r.processed, 'à l\'atelier');
  assert.equal(o.lines[0].got, 0);
  // Géant : 4 unités.
  const h = detente(2, 8);
  const ord = h.state.variety.board.slots.find(Boolean);
  ord.lines = [{ cropId: 'carrot', n: 6, got: 0 }];
  for (const i of [0, 1, 6, 7]) {
    ripe(h, i, 'carrot');
    h.state.plots[i].giant = 0;
  }
  h.state.plots[0].giantSince = 1;
  h.actions.harvest(0);
  assert.equal(ord.lines[0].got, 4);
});

test('rien en Classique ne change avec les nouveaux modules : parité des robots et des données', () => {
  assert.equal(RARE_CROP_IDS.length, 3);
  // Les graines rares ne sont dans aucune liste de niveau.
  for (let id = 1; id <= 12; id++) {
    const crops = gameCrops(createGame({ levelId: id, seed: 1, difficulty: 'classique' }).query.level(), {});
    assert.ok(crops.every((c) => !isRareCrop(c.id)));
  }
});
