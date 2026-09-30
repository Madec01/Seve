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

// ── Carte 2D (Carrière v2) : blocs côte à côte, terrains à vendre voisins, chemins, trajets ─────────
import { careerGridCells, careerGridKey } from '../src/render/layout-career.js';

/** Carrière avec des terrains posés sur des cases choisies ([col, row, type]) et une grille à la main. */
function career2d(cells) {
  const g = createCareer({ seed: 5 });
  g.state.career.rank = 6;
  g.refreshLevel();
  for (const [col, row, type] of cells) {
    g.state.money = 1e7;
    const r = g.actions.career.buyLot();
    assert.ok(r.ok, r.reason);
    const d = g.actions.career.developLot(r.lotId, type);
    assert.ok(d.ok, d.reason);
    const lot = g.state.career.lots.find((l) => l.id === r.lotId);
    // Case choisie ; identifiant propre à la case (le cœur nomme les terrains d'après leur case).
    const id = `c${col}r${row}`;
    for (const p of g.state.plots) if (p.lot === lot.id) p.lot = id;
    for (const b of Object.values(g.state.career.buildings)) if (b.lotId === lot.id) b.lotId = id;
    lot.id = id;
    lot.col = col;
    lot.row = row;
  }
  const occ = new Set(['0,0', ...cells.map(([c, r]) => `${c},${r}`)]);
  const lots = g.state.career.lots.filter((l) => l.index >= 3).map((l) => ({ id: l.id, col: l.col, row: l.row, owned: true }));
  for (let col = -2; col <= 2; col++) {
    for (let row = 0; row <= 6; row++) {
      if (occ.has(`${col},${row}`)) continue;
      if (![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, b]) => occ.has(`${col + a},${row + b}`))) continue;
      lots.push({ id: `sale${col}_${row}`, col, row, owned: false, buyable: row < 3, price: 500, lockedReason: row < 3 ? null : 'Rang 5', lockedByRank: row < 3 ? null : 5 });
    }
  }
  const grid = { cols: [-2, 2], rows: [0, 6], home: { col: 0, row: 0 }, lots };
  return { g, grid, L: createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments, grid }) };
}

test('carte 2D : blocs de 14 × 11 tuiles aux cases de la grille, colonne 0 inchangée, à gauche en x négatif', () => {
  const { g, L } = career2d([[0, 1, 'field'], [-1, 0, 'meadow'], [1, 0, 'orchard'], [1, 1, 'field'], [-1, 1, 'workshops']]);
  assert.equal(L.x0, -14 * 16 * 2); // lisière à vendre en colonne −2 (à côté de (−1, 0))
  assert.equal(L.x1 - L.x0, L.width);
  const lot = (col, row) => L.lots.find((l) => l.col === col && l.row === row && !l.forSale && l.id !== 'start' && l.id !== 'home');
  const yard = L.lots.find((l) => l.id === 'yard');
  assert.equal(lot(-1, 0).rect.y, yard.rect.y); // ligne 0 : à côté de la basse-cour
  assert.equal(lot(1, 1).rect.y, yard.rect.y - 11 * 16);
  assert.equal(lot(1, 1).rect.x, 14 * 16);
  assert.equal(lot(-1, 0).rect.x, -14 * 16);
  // Parcelles : dans leur bloc, uniques, touchables, bande = terrain du cœur.
  const seen = new Set();
  L.plots.forEach((p, i) => {
    if (p.retired) return;
    const k = `${p.x},${p.y}`;
    assert.ok(!seen.has(k));
    seen.add(k);
    assert.deepEqual(L.hitTestCareer(p.x + 16, p.y + 16, g.state, 0), { type: 'plot', index: i });
    assert.equal(L.bandAt(p.y + 16, p.x + 16).id, g.state.plots[i].lot);
  });
  // Panneaux des terrains de côté, abris du pré de gauche
  for (const s of L.lotSigns) assert.deepEqual(L.hitTestCareer(s.x * 16 + 8, s.y * 16 + 8, g.state, 0), { type: 'lotSign', lotId: s.lotId });
});

test('carte 2D : terrains à vendre voisins (forêt + panneau), forêt dense ailleurs, allées reliées', () => {
  const { g, L } = career2d([[0, 1, 'field'], [1, 0, 'meadow'], [1, 1, 'field']]);
  const sale = L.lots.filter((l) => l.forSale);
  assert.ok(sale.length >= 4);
  for (const s of sale) {
    assert.equal(L.hitTestCareer(s.rect.x + 100, s.rect.y + 40, g.state, 0).type, 'lotForSale');
    assert.equal(L.hitTestCareer(s.rect.x + 100, s.rect.y + 40, g.state, 0).lotId, s.id);
    assert.ok(L.isForest(s.rect.x / 16 + 5, s.rect.y / 16 + 3));
  }
  // Case ni possédée ni à vendre : forêt (col 2, ligne 3)
  assert.ok(L.isForest(2 * 14 + 6, L.grid.rowY(3) + 4));
  // Allée de la basse-cour prolongée jusqu'au pré de droite (ligne 0), à travers la lisière
  const yard = L.bands.find((b) => b.id === 'yard');
  for (let x = 2; x <= 14 + 12; x++) assert.ok(L.isPath(x, yard.lane), `allée x ${x}`);
  // Trajet de la maison au champ (1, 1) : finit à la cible, reste sur les allées (points de passage)
  const f = L.lots.find((l) => l.col === 1 && l.row === 1);
  const target = { x: f.rect.x + 100, y: f.rect.y + 60 };
  const r = L.route(L.farmerHome, target);
  assert.deepEqual(r[r.length - 1], target);
  for (const p of r.slice(1, -2)) assert.ok(L.isPath(Math.floor(p.x / 16), Math.floor(p.y / 16)), `point ${p.x},${p.y} sur une allée`);
});

test('carte 2D : sans grille, une ancienne carrière reste une colonne ; clés de grille', () => {
  const g = careerAt(3);
  const cells = careerGridCells(g.state.career, null);
  assert.equal(cells.cands.length, 1);
  assert.deepEqual(cells.owned.map((o) => [o.col, o.row]).length, 3);
  assert.equal(careerGridKey(null), '');
  assert.notEqual(careerGridKey({ lots: [{ id: 'a', col: 1, row: 0 }] }), careerGridKey({ lots: [{ id: 'a', col: -1, row: 0 }] }));
});
