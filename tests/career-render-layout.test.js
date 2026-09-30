// Disposition de la scène du mode Carrière (src/render/layout-career.js) : pure, testée sous Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareer } from '../src/core/career/career.js';
import { createCareerLayout, careerLayoutKey, careerWorldRows } from '../src/render/layout-career.js';

function careerAt(nLots, types = ['field', 'meadow', 'orchard', 'workshops', 'field', 'greenhouse', 'meadow', 'pond']) {
  const g = createCareer({ seed: 3 });
  g.state.career.rank = 6;
  g.refreshLevel();
  for (let k = 0; k < nLots; k++) {
    g.state.money = 1e7;
    const r = g.actions.career.buyLot();
    assert.ok(r.ok, r.reason);
    const d = g.actions.career.developLot(r.lotId, types[k % types.length]);
    assert.ok(d.ok, d.reason);
  }
  return g;
}

const layoutOf = (g) => createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments });

test('carrière (rendu) : le monde grandit de 11 lignes par terrain, la maison reste en bas', () => {
  const g = careerAt(0);
  const L0 = layoutOf(g);
  assert.equal(L0.rows, careerWorldRows(0));
  assert.equal(L0.width, 14 * 16);
  const g3 = careerAt(3);
  const L3 = layoutOf(g3);
  assert.equal(L3.rows - L0.rows, 33);
  // La maison est à la même distance du bas du monde.
  assert.equal(L3.height - L3.home.house.y * 16, L0.height - L0.home.house.y * 16);
  assert.equal(L3.lots[0].forSale, true);
  assert.deepEqual(L3.lots.map((l) => l.id), ['lot6', 'lot5', 'lot4', 'lot3', 'yard', 'start', 'home']);
});

test('carrière (rendu) : parcelles à leur index, 2 × 2 tuiles, sans chevauchement, touchables', () => {
  const g = careerAt(8);
  const L = layoutOf(g);
  assert.equal(L.plots.length, g.state.plots.length);
  const seen = new Set();
  L.plots.forEach((p, i) => {
    assert.equal(p.index, i);
    if (p.retired) return;
    assert.equal(p.w, 32);
    assert.ok(p.x >= 16 && p.x + p.w <= 13 * 16, `parcelle ${i} dans les colonnes utiles`);
    const k = `${p.x},${p.y}`;
    assert.ok(!seen.has(k), `parcelle ${i} unique`);
    seen.add(k);
    assert.deepEqual(L.hitTestCareer(p.x + 16, p.y + 16, g.state, 0), { type: 'plot', index: i });
    // Terrain de la parcelle = bande du monde où elle est dessinée.
    assert.equal(L.bandAt(p.y + 16).id, g.state.plots[i].lot);
  });
});

test('carrière (rendu) : panneaux, terrain à vendre, bâtiments et trajets', () => {
  const g = careerAt(3);
  const L = layoutOf(g);
  for (const s of L.lotSigns) assert.deepEqual(L.hitTestCareer(s.x * 16 + 8, s.y * 16 + 8, g.state, 0), { type: 'lotSign', lotId: s.lotId });
  const sale = L.lots.find((l) => l.forSale);
  assert.equal(L.hitTestCareer(sale.rect.x + 100, sale.rect.y + 40, g.state, 0).type, 'lotForSale');
  const h = L.home.house;
  assert.deepEqual(L.hitTestCareer((h.x + 1) * 16, (h.y + 1) * 16, g.state, 0), { type: 'building', buildingId: 'house' });
  assert.equal(L.hitTestCareer(L.slots.coop.anchor.x, L.slots.coop.anchor.y + 20, g.state, 0).type, 'shelter');
  // Trajet de la maison au dernier terrain : il finit à la cible et passe par l'épine (x 12).
  const target = { x: 100, y: L.lots[1].rect.y + 40 };
  const r = L.route(L.farmerHome, target);
  assert.deepEqual(r[r.length - 1], target);
  assert.ok(r.some((p) => p.x === 12 * 16 + 8));
});

test('carrière (rendu) : la clé de disposition change avec les terrains et les bâtiments, pas avec les cultures', () => {
  const g = careerAt(1);
  const k0 = careerLayoutKey(g.state);
  g.state.plots[0].cropId = 'carrot';
  assert.equal(careerLayoutKey(g.state), k0);
  g.state.money = 1e7;
  assert.ok(g.actions.career.upgradeBuilding('house').ok);
  assert.notEqual(careerLayoutKey(g.state), k0);
});
