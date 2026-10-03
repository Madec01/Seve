// La Vallée vivante (lot V3) — les terres sauvages : après le 16ᵉ terrain (vue ouverte), les cases de forêt de la grille
// qui touchent la ferme se confient à la nature (2 500 + 300 × n, sorte pour toujours, de proche en proche), reprennent en
// 1 puis 3 saisons, comptent comme signe de vie une fois reprises, ne sont jamais à vendre. Règles : docs/VALLEE.md § 17.8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frontierCells } from '../src/core/career/land.js';
import { checkValley } from '../src/core/career/valley.js';
import { wildEligible, wildSigns } from '../src/core/career/places.js';
import { nextDay, record, skipDays, startedCareer } from './valley-helpers.js';

const A = (g) => g.actions.career;
const Q = (g) => g.query.career;

/** Carrière au rang 6, 16 terrains achetés, vue ouverte. */
function wildCareer() {
  const g = startedCareer({}, 6);
  g.state.money = 2000000;
  for (let k = 0; k < 16; k++) assert.equal(A(g).buyLot().ok, true);
  assert.equal(g.state.career.lotsBought, 16);
  return g;
}

test('ouverture : vue ouverte ET 16 terrains ; 18 forêts au total ; refus doux', () => {
  const g = startedCareer({}, 6);
  g.state.money = 2000000;
  A(g).triggerValley('view');
  assert.equal(Q(g).valley().wilds.open, false);
  assert.equal(Q(g).valley().wilds.total, 18, 'avant le 16ᵉ terrain : le total annoncé reste 18');
  assert.equal(A(g).rewild('lot3', 'wood').reason, 'Les terres sauvages viennent après le 16ᵉ terrain.');
  const w = wildCareer();
  assert.equal(Q(w).valley().wilds.open, false, 'pas sans la vue');
  assert.equal(A(w).rewild('lot3', 'wood').reason, 'La vallée s\'ouvrira quand elle chantera (étape 5).');
  A(w).triggerValley('view');
  const q = Q(w).valley().wilds;
  assert.equal(q.open, true);
  assert.equal(q.total, 18);
  assert.equal(q.count, 0);
  assert.equal(q.nextPrice, 2500);
  assert.ok(q.eligible.length > 0 && q.eligible.length <= 18);
  assert.equal(frontierCells(w.state).length, 0, 'plus rien à vendre');
});

test('confier une forêt : prix croissant, sorte pour toujours, patrimoine 100 %, grille (wildland / wildable), jamais à vendre', () => {
  const g = wildCareer();
  A(g).triggerValley('view');
  const ev = record(g);
  const first = Q(g).valley().wilds.eligible[0];
  assert.equal(A(g).rewild(first, 'jungle').reason, 'Sorte inconnue.');
  assert.equal(A(g).rewild(g.state.career.lots[3].id, 'wood').reason, 'Cette case n\'est pas une forêt libre.');
  assert.equal(A(g).rewild('nope', 'wood').reason, 'Case inconnue.');
  const spent = g.state.career.valley.spent;
  const r = A(g).rewild(first, 'marsh');
  assert.equal(r.ok, true);
  assert.deepEqual([r.cost, r.n, r.kind, r.first], [2500, 1, 'marsh', true]);
  assert.equal(g.state.career.valley.spent, spent + 2500);
  assert.equal(ev.of('wildLandGiven')[0].cellId, first);
  assert.equal(Q(g).valley().wilds.nextPrice, 2800);
  assert.equal(A(g).rewild(first, 'wood').reason, 'Cette case n\'est pas une forêt libre.');
  const cell = Q(g).grid().cells.find((c) => c.id === first);
  assert.deepEqual([cell.state, cell.wildKind, cell.wildStage], ['wildland', 'marsh', 0]);
  assert.ok(Q(g).grid().cells.some((c) => c.state === 'wildable' && c.price === 2800));
  const info = Q(g).wildCell(first);
  assert.deepEqual([info.state, info.kind, info.stage, info.seasonsLeft], ['wildland', 'marsh', 0, 3]);
  assert.equal(checkValley(g.serialize()), null);
  // Une case sauvage n'est jamais à vendre, même si la ferme pouvait encore acheter.
  g.state.career.lotsBought = 15;
  assert.ok(!frontierCells(g.state).some((c) => `${c.col},${c.row}` === `${info.col},${info.row}`));
  g.state.career.lotsBought = 16;
});

test('reprise : jeune après 1 saison, reprise après 3 (wildLandGrown) ; signe de vie une fois reprise ; débogage wildGrow', () => {
  const g = wildCareer();
  A(g).triggerValley('view');
  const id = Q(g).valley().wilds.eligible[0];
  A(g).rewild(id, 'wood');
  const L = g.state.career.seasonLength;
  const ev = record(g);
  skipDays(g, L);
  assert.deepEqual(ev.of('wildLandGrown').map((e) => e.stage), [1]);
  skipDays(g, 2 * L);
  assert.deepEqual(ev.of('wildLandGrown').map((e) => e.stage), [1, 2]);
  assert.equal(wildSigns(g.state), 1);
  // Débogage : une terre avance d'un état à chaque appel.
  const id2 = Q(g).valley().wilds.eligible[0];
  A(g).triggerValley('wild', id2, 'grassland');
  assert.deepEqual(A(g).triggerValley('wildGrow', id2), { ok: true, stage: 1 });
  assert.equal(Q(g).wildCell(id2).stage, 1);
  assert.deepEqual(A(g).triggerValley('wildGrow', id2), { ok: true, stage: 2 });
  assert.equal(Q(g).wildCell(id2).stage, 2);
  nextDay(g);
  assert.equal(checkValley(g.serialize()), null);
});

test('de proche en proche : les 18 forêts finissent toutes confiées', () => {
  const g = wildCareer();
  A(g).triggerValley('view');
  let n = 0;
  while (wildEligible(g.state).length && n < 40) {
    assert.equal(A(g).rewild(wildEligible(g.state)[0], ['wood', 'marsh', 'grassland'][n % 3]).ok, true);
    n++;
  }
  assert.equal(n, 18);
  assert.equal(g.state.career.valley.wildBought, 18);
  assert.equal(g.query.achievementContext().career.valley.wilds, 18);
  assert.equal(checkValley(g.serialize()), null);
});
