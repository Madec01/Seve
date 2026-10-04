// Ligne « À faire » regroupée (Vallée V3, reste du V2 n° 2) : familles, urgences seules, 5 entrées au plus.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTodo, familyOf, TODO_FAMILIES } from '../src/ui/todo-group.js';

const it = (id, prio, text = id) => ({ id, prio, text, short: text, icon: () => null, go: () => id });

test('familles : le village, la vallée, les fêtes, Joseph ; le champ n\'en a pas', () => {
  assert.equal(familyOf('v-order'), 'village');
  assert.equal(familyOf('order-12'), 'village');
  assert.equal(familyOf('offer-3'), 'village');
  assert.equal(familyOf('vl-troc'), 'village');
  assert.equal(familyOf('vl-story'), 'valley');
  assert.equal(familyOf('vl-view-animal'), 'valley');
  assert.equal(familyOf('cz-fete'), 'fete');
  assert.equal(familyOf('quest-new'), 'joseph');
  for (const id of ['harvest', 'water', 'plant', 'collect', 'crow', 'rent', 'lot', 'rank', 'goal']) assert.equal(familyOf(id), null, id);
  assert.deepEqual(Object.keys(TODO_FAMILIES), ['village', 'valley', 'fete', 'joseph']);
});

test('carrière reprise à 11 entrées → 5 au plus, regroupées, triées ; les urgences restent seules', () => {
  const list = [
    it('crow', 10), it('rent', 25), it('v-deliver', 36), it('v-order', 58), it('v-cart', 80), it('v-cards', 74),
    it('vl-observe', 30), it('vl-story', 35), it('vl-jar', 46), it('vl-mushrooms', 63), it('harvest', 40), it('quest', 37),
  ];
  const opened = [];
  const out = groupTodo(list, { open: (f, items) => opened.push([f, items.map((x) => x.id)]) });
  assert.ok(out.length <= 5);
  assert.equal(out[0].id, 'crow');
  assert.equal(out[1].id, 'rent');
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].prio <= out[i].prio, 'trié');
  const valley = out.find((x) => x.id === 'group-valley');
  assert.ok(valley, 'la vallée regroupée');
  assert.equal(valley.text, 'La vallée : 4 choses');
  assert.equal(valley.prio, 30, 'priorité de la plus pressante');
  assert.equal(valley.items.length, 4);
  assert.deepEqual(valley.items.map((x) => x.id), ['vl-observe', 'vl-story', 'vl-jar', 'vl-mushrooms']);
  valley.go();
  assert.deepEqual(opened[0], ['valley', ['vl-observe', 'vl-story', 'vl-jar', 'vl-mushrooms']]);
  const village = groupTodo(list).find((x) => x.id === 'group-village');
  assert.ok(village);
  assert.equal(village.text, 'Le village : 4 choses');
  assert.equal(village.count, 4);
});

test('une famille d\'une seule entrée garde sa ligne ; perGroup et max réglables', () => {
  const out = groupTodo([it('vl-story', 35), it('harvest', 40), it('v-order', 58)]);
  assert.deepEqual(out.map((x) => x.id), ['vl-story', 'harvest', 'v-order']);
  const many = Array.from({ length: 9 }, (_, i) => it(`vl-x${i}`, 40 + i));
  const g = groupTodo(many, { perGroup: 3 });
  assert.equal(g.length, 1);
  assert.equal(g[0].items.length, 3);
  assert.equal(g[0].text, 'La vallée : 9 choses');
  assert.equal(groupTodo(Array.from({ length: 9 }, (_, i) => it(`f${i}`, i + 30)), { max: 5 }).length, 5);
  assert.deepEqual(groupTodo([]), []);
  // Une entrée urgente d'une famille reste seule (et ne compte pas dans le groupe).
  const u = groupTodo([it('v-a', 20), it('v-b', 50), it('v-c', 60)]);
  assert.deepEqual(u.map((x) => x.id), ['v-a', 'group-village']);
  assert.equal(u[1].text, 'Le village : 2 choses');
});
