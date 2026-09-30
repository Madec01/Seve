// Mode Carrière — terrains : achat (terrain proposé de la carte 2D ; cases, voisinage : career-map.test.js), prix,
// limite par rang, aménagements, réaménagement, parcelles (index stables), champ de départ, plan de culture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOT_NAMES, LOT_PRICES } from '../src/data/career/lots.js';
import { newCareer, nextDay, record, setRank } from './career-helpers.js';

function rich(g, money = 1e6) {
  g.state.money = money;
}

test('achat des terrains (carte 2D) : terrain proposé, prix selon le nombre possédé, limité par le rang (1, 3, 6, 9, 12, 16)', () => {
  const g = newCareer();
  const ev = record(g);
  const next = g.query.career.nextLot();
  assert.deepEqual([next.id, next.index, next.col, next.row, next.name, next.price, next.chargeIncrease], ['lot3', 3, 0, 1, LOT_NAMES[0], 250, 15]);
  assert.equal(next.canBuy, false, '200 pièces au départ');
  assert.equal(next.buyable, true, 'achetable (l\'argent n\'est pas compté)');
  assert.match(next.reason, /Pas assez d'argent \(il manque 50 pièces\)/);
  rich(g);
  const r = g.actions.career.buyLot();
  assert.deepEqual(r, { ok: true, lotId: 'lot3', index: 3, col: 0, row: 1, cost: 250 });
  assert.deepEqual([ev.of('lotBought')[0].lotId, ev.of('lotBought')[0].col, ev.of('lotBought')[0].row], ['lot3', 0, 1]);
  const lot = g.state.career.lots[3];
  assert.equal(lot.type, 'wild', 'en friche');
  assert.equal(lot.pricePaid, 250);
  // Rang 1 : un seul terrain.
  const locked = g.query.career.nextLot();
  assert.equal(locked.canBuy, false);
  assert.equal(locked.buyable, false);
  assert.equal(locked.lockedByRank, 2);
  assert.match(locked.lockedReason, /Rang 2 requis/);
  assert.match(g.actions.career.buyLot().reason, /Rang 2 requis/);
  const expected = [250];
  for (const [rank, total] of [[2, 3], [3, 6], [4, 9], [5, 12], [6, 16]]) {
    setRank(g, rank);
    while (g.state.career.lotsBought < total) {
      const n = g.state.career.lotsBought;
      const res = g.actions.career.buyLot();
      assert.ok(res.ok, `terrain ${n + 1}`);
      assert.equal(res.cost, LOT_PRICES[n]);
      expected.push(LOT_PRICES[n]);
    }
    assert.equal(g.actions.career.buyLot().ok, false);
  }
  assert.equal(g.query.career.nextLot(), null);
  assert.equal(g.state.career.lots.length, 19);
  assert.deepEqual(g.state.career.lots.slice(3).map((l) => l.pricePaid), LOT_PRICES);
  assert.equal(g.state.career.yearStats.spentBy.lots, LOT_PRICES.reduce((a, b) => a + b, 0));
  // Terrain proposé par défaut : la colonne d'origine d'abord (vers le haut), puis les côtés.
  assert.deepEqual(g.state.career.lots.slice(3, 9).map((l) => [l.col, l.row]), [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]]);
  const lots = g.query.career.lots();
  assert.equal(lots.length, 19, 'plus rien à vendre');
  assert.ok(lots.every((l) => l.bought && l.owned));
});

test('aménager en champ : 16 parcelles ouvertes ajoutées à la fin, index jamais renumérotés', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  g.actions.career.buyLot();
  const r = g.actions.career.developLot('lot3', 'field');
  assert.equal(r.ok, true);
  assert.equal(r.cost, 150);
  assert.deepEqual(r.plots, Array.from({ length: 16 }, (_, k) => 16 + k));
  assert.equal(g.state.plots.length, 32);
  assert.ok(r.plots.every((i) => g.state.plots[i].unlocked && g.state.plots[i].lot === 'lot3' && g.state.plots[i].env === 'field'));
  assert.deepEqual(r.plots.map((i) => g.state.plots[i].cell), Array.from({ length: 16 }, (_, k) => k));
  assert.equal(ev.of('lotDeveloped')[0].lotType, 'field');
  assert.deepEqual(g.state.career.lots[3].plan, { spring: 'same', summer: 'same', autumn: 'same', winter: 'same' });
  const q = g.query.plot(20);
  assert.equal(q.lot, 'lot3');
  assert.equal(q.col, 0);
  assert.equal(q.row, 1);
  assert.equal(q.action, 'plant');
  assert.equal(q.unlockCost, null);
  assert.ok(g.actions.plant(20, 'carrot').ok);
  // Le terrain garde ses parcelles ; déjà aménagé ainsi.
  assert.match(g.actions.career.developLot('lot3', 'field').reason, /déjà aménagé/);
  // Réaménager un terrain planté : refusé.
  assert.match(g.actions.career.developLot('lot3', 'meadow').reason, /Videz/);
  g.state.plots[20].cropId = null;
  // Vide : pré (les parcelles sont retirées, pas supprimées).
  assert.ok(g.actions.career.developLot('lot3', 'meadow').ok);
  assert.equal(g.state.plots.length, 32);
  assert.ok(r.plots.every((i) => g.state.plots[i].env === null && !g.state.plots[i].unlocked));
  assert.deepEqual(g.state.career.lots[3].slots, [null, null]);
  assert.equal(g.query.plot(20).action, null);
  assert.equal(g.actions.plant(20, 'carrot').ok, false);
  // Redevenu champ : les mêmes index reviennent.
  const back = g.actions.career.developLot('lot3', 'field');
  assert.deepEqual(back.plots, r.plots);
  assert.equal(g.state.plots.length, 32);
  assert.equal(g.state.career.lots[3].developPaid, 150 + 120 + 150);
});

test('aménagements : prix, rang, maximum ; les terrains fixes ne se réaménagent pas', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 5);
  for (let k = 0; k < 12; k++) g.actions.career.buyLot();
  const ids = g.state.career.lots.slice(3).map((l) => l.id);
  assert.equal(ids.length, 12);
  const types = Object.fromEntries(g.query.career.lotTypes('lot3').map((t) => [t.type, t]));
  assert.deepEqual([types.field.cost, types.meadow.cost, types.orchard.cost, types.workshops.cost, types.pond.cost, types.greenhouse.cost], [150, 120, 100, 100, 400, 800]);
  assert.equal(types.field.count, 1, 'le champ de départ compte');
  assert.equal(types.field.max, 6);
  // Champs : 5 de plus au plus.
  for (let k = 0; k < 5; k++) assert.ok(g.actions.career.developLot(ids[k], 'field').ok, `champ ${k}`);
  assert.match(g.actions.career.developLot(ids[5], 'field').reason, /Au plus 6 champs/);
  assert.ok(g.actions.career.developLot(ids[5], 'orchard').ok);
  assert.ok(g.actions.career.developLot(ids[6], 'orchard').ok);
  assert.match(g.actions.career.developLot(ids[7], 'orchard').reason, /Au plus 2/);
  assert.equal(g.actions.career.developLot('home', 'field').ok, false);
  assert.equal(g.actions.career.developLot('start', 'meadow').ok, false);
  assert.equal(g.actions.career.developLot(ids[7], 'castle').ok, false);
  // Rang : verger (2), serre (3), mare (4).
  const h = newCareer();
  rich(h);
  h.actions.career.buyLot();
  assert.match(h.actions.career.developLot('lot3', 'orchard').reason, /Rang 2 requis/);
  assert.match(h.actions.career.developLot('lot3', 'greenhouse').reason, /Rang 3 requis/);
  assert.match(h.actions.career.developLot('lot3', 'pond').reason, /Rang 4 requis/);
  assert.ok(h.actions.career.developLot('lot3', 'meadow').ok);
});

test('verger : 9 parcelles d\'arbres (pommiers seulement)', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 2);
  g.actions.career.buyLot();
  const r = g.actions.career.developLot('lot3', 'orchard');
  assert.equal(r.plots.length, 9);
  const i = r.plots[4];
  assert.equal(g.query.plot(i).col, 1);
  assert.equal(g.query.plot(i).row, 1);
  assert.deepEqual(g.query.plantableCrops(i).map((o) => o.id), ['apple']);
  assert.match(g.actions.plant(i, 'carrot').reason, /verger/);
  assert.ok(g.actions.plant(i, 'apple').ok);
  assert.equal(g.state.career.lots[3].plan, null);
});

test('champ de départ : 4 parcelles à acheter (40 + 10 × déjà achetées)', () => {
  const g = newCareer();
  rich(g);
  const closed = g.state.plots.map((p, i) => (p.unlocked ? -1 : i)).filter((i) => i >= 0);
  assert.deepEqual(closed, [12, 13, 14, 15]);
  const costs = closed.map((i) => {
    assert.equal(g.query.plot(i).action, 'unlock');
    return g.actions.unlockPlot(i).cost;
  });
  assert.deepEqual(costs, [40, 50, 60, 70]);
  // Les parcelles des autres terrains ne s'achètent pas une à une.
  g.actions.career.buyLot();
  const { plots } = g.actions.career.developLot('lot3', 'field');
  g.actions.career.developLot('lot3', 'meadow');
  assert.equal(g.query.plot(plots[0]).unlockCost, null);
  assert.equal(g.actions.unlockPlot(plots[0]).ok, false);
});

test('plan de culture : même culture, une culture de la saison, ou rien', () => {
  const g = newCareer();
  const set = (sid, crop) => g.actions.career.setPlan('start', sid, crop);
  assert.ok(set('spring', 'carrot').ok);
  assert.ok(set('winter', null).ok);
  assert.ok(set('summer', 'same').ok);
  assert.match(set('summer', 'carrot').reason, /ne se sème pas/);
  assert.match(set('summer', 'corn').reason, /pas encore débloquée/);
  assert.equal(set('autumn', 'apple').ok, false);
  assert.equal(set('never', 'carrot').ok, false);
  assert.equal(g.actions.career.setPlan('yard', 'spring', 'carrot').ok, false);
  assert.deepEqual(g.state.career.lots[1].plan, { spring: 'carrot', summer: 'same', autumn: 'same', winter: null });
});

test('terrains : requête lots(), renommer', () => {
  const g = newCareer();
  const lots = g.query.career.lots();
  assert.deepEqual(lots.map((l) => [l.id, l.type, l.bought, l.forSale]), [['home', 'home', true, false], ['start', 'field', true, false], ['yard', 'yard', true, false], ['lot3', null, false, true], ['lot2w1', null, false, true], ['lot2e1', null, false, true]]);
  assert.deepEqual(lots[2].slots, [{ buildingId: 'coop', level: 1 }, null]);
  assert.deepEqual(lots[0].buildings, ['house']);
  assert.equal(lots[1].plots.length, 16);
  assert.equal(lots[3].price, 250);
  assert.ok(g.actions.career.renameLot('start', ' Le Potager ').ok);
  assert.equal(g.state.career.lots[1].name, 'Le Potager');
  assert.equal(g.actions.career.renameLot('start', '   ').ok, false);
  // La friche nouvellement achetée apparaît.
  g.state.money = 1000;
  g.actions.career.buyLot();
  nextDay(g);
  assert.equal(g.query.career.lot('lot3').type, 'wild');
  assert.equal(g.query.career.lot('lot3').typeName, 'Friche');
});
