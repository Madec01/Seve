// Mode Carrière v2 — carte 2D des terrains : cases (col, row), voisinage, terrains achetables à gauche, à droite et
// au-dessus, prix selon le nombre possédé, limites de rang, grid() (mini-carte), sauvegarde, migration des
// anciennes carrières (terrains empilés en colonne : colonne 0, rangées 1..n, même image).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCareer, checkCareerState, migrateCareer, CAREER_VERSION } from '../src/core/career/career.js';
import { LOT_GRID, LOT_PRICES, inLotGrid, lotCellOf, lotIdAt, lotNameAt } from '../src/data/career/lots.js';
import { MAX_LOTS } from '../src/data/career/career.js';
import { newCareer, record, setRank } from './career-helpers.js';

const rich = (g) => {
  g.state.money = 1e7;
};
const forSale = (g) => g.query.career.lots().filter((l) => l.forSale);
const cells = (list) => list.map((l) => [l.col, l.row]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test('identifiants des cases : colonne 0 = anciens identifiants (lot3 = rangée 1), côtés « w » / « e »', () => {
  assert.equal(lotIdAt(0, 1), 'lot3');
  assert.equal(lotIdAt(0, 6), 'lot8');
  assert.equal(lotIdAt(-1, 0), 'lot2w1');
  assert.equal(lotIdAt(2, 3), 'lot5e2');
  for (let col = LOT_GRID.cols[0]; col <= LOT_GRID.cols[1]; col++) {
    for (let row = LOT_GRID.rows[0]; row <= LOT_GRID.rows[1]; row++) {
      if (!inLotGrid(col, row)) continue;
      assert.deepEqual(lotCellOf(lotIdAt(col, row)), { col, row });
      assert.ok(lotNameAt(col, row).length > 3);
    }
  }
  assert.equal(lotCellOf('home'), null);
  assert.equal(lotCellOf('lot2'), null, 'la ferme de départ n\'est pas à vendre');
  assert.equal(lotCellOf('lot3w0'), null);
  assert.deepEqual(lotCellOf('lot14'), { col: 0, row: 12 }, 'rangée 12 : ancienne carrière');
  assert.equal(inLotGrid(0, 0), false);
  assert.equal(inLotGrid(3, 1), false);
  assert.equal(inLotGrid(0, 7), false);
  // Noms uniques dans la grille.
  const names = [];
  for (let col = -2; col <= 2; col++) for (let row = 0; row <= 6; row++) if (inLotGrid(col, row)) names.push(lotNameAt(col, row));
  assert.equal(new Set(names).size, names.length);
});

test('au départ : trois terrains à vendre autour de la ferme (au-dessus, à gauche, à droite)', () => {
  const g = newCareer();
  const sale = forSale(g);
  assert.deepEqual(cells(sale), [[-1, 0], [0, 1], [1, 0]]);
  for (const l of sale) {
    assert.equal(l.owned, false);
    assert.equal(l.buyable, true);
    assert.equal(l.canBuy, false, '200 pièces');
    assert.equal(l.lockedReason, null);
    assert.equal(l.price, LOT_PRICES[0]);
    assert.equal(l.chargeIncrease, 15);
    assert.equal(l.id, lotIdAt(l.col, l.row));
    assert.equal(l.name, lotNameAt(l.col, l.row));
  }
  const home = g.query.career.lots().filter((l) => l.fixed);
  assert.deepEqual(home.map((l) => [l.id, l.col, l.row, l.owned]), [['home', 0, 0, true], ['start', 0, 0, true], ['yard', 0, 0, true]]);
  const grid = g.query.career.grid();
  assert.deepEqual(grid.cols, [-1, 1]);
  assert.deepEqual(grid.rows, [0, 1]);
  assert.deepEqual(grid.home, { col: 0, row: 0 });
  assert.deepEqual(grid.bounds, { cols: [-2, 2], rows: [0, 6] });
  assert.deepEqual(grid.block, { cols: 14, rows: 11, homeRows: 40, topForest: 2 });
  assert.equal(grid.lots.length, 6);
  assert.equal(grid.cells.length, 35, '5 × 7 cases (ferme comprise)');
  const st = Object.fromEntries(grid.cells.map((c) => [`${c.col},${c.row}`, c.state]));
  assert.equal(st['0,0'], 'home');
  assert.equal(st['0,1'], 'buyable');
  assert.equal(st['-1,0'], 'buyable');
  assert.equal(st['2,0'], 'forest');
  assert.equal(st['0,2'], 'forest');
});

test('acheter à gauche : la lisière s\'étend ; un terrain qui ne touche pas la ferme est refusé', () => {
  const g = newCareer();
  const ev = record(g);
  rich(g);
  setRank(g, 6);
  assert.match(g.actions.career.buyLot('lot3w2').reason, /ne touche pas encore/);
  assert.match(g.actions.career.buyLot('lot99').reason, /Terrain inconnu/);
  assert.match(g.actions.career.buyLot('lot9').reason, /Terrain inconnu/, 'rangée 7 : hors de la grille');
  assert.match(g.actions.career.buyLot('start').reason, /Terrain inconnu/);
  const r = g.actions.career.buyLot('lot2w1');
  assert.deepEqual(r, { ok: true, lotId: 'lot2w1', index: 3, col: -1, row: 0, cost: 250 });
  const e = ev.of('lotBought')[0];
  assert.deepEqual([e.lotId, e.index, e.col, e.row, e.cost, e.name], ['lot2w1', 3, -1, 0, 250, lotNameAt(-1, 0)]);
  assert.match(g.actions.career.buyLot('lot2w1').reason, /déjà à vous/);
  assert.deepEqual(cells(forSale(g)), [[-2, 0], [-1, 1], [0, 1], [1, 0]]);
  // Le prix dépend du nombre de terrains possédés, pas de la place.
  assert.ok(forSale(g).every((l) => l.price === LOT_PRICES[1]));
  assert.equal(g.actions.career.buyLot('lot3w1').cost, LOT_PRICES[1]);
  assert.equal(g.actions.career.buyLot('lot3w2').cost, LOT_PRICES[2], 'touche maintenant (−1, 1)');
  const lot = g.state.career.lots.find((l) => l.id === 'lot3w2');
  assert.deepEqual([lot.col, lot.row, lot.index, lot.type], [-2, 1, 5, 'wild']);
  assert.ok(g.actions.career.developLot('lot3w2', 'field').ok, 'un terrain de côté s\'aménage comme les autres');
  assert.equal(checkCareerState(g.serialize()), null);
  // La mini-carte suit.
  const grid = g.query.career.grid();
  assert.deepEqual(grid.cols, [-2, 1]);
  assert.deepEqual(grid.rows, [0, 2]);
});

test('limites du rang : la lisière reste affichée, verrouillée (buyable: false, lockedReason) ; 16 terrains au plus', () => {
  const g = newCareer();
  rich(g);
  assert.ok(g.actions.career.buyLot('lot2e1').ok);
  const sale = forSale(g);
  assert.ok(sale.length >= 3);
  for (const l of sale) {
    assert.equal(l.buyable, false);
    assert.equal(l.canBuy, false);
    assert.equal(l.lockedByRank, 2);
    assert.match(l.lockedReason, /Rang 2 requis/);
  }
  assert.match(g.actions.career.buyLot('lot3').reason, /Rang 2 requis/);
  setRank(g, 6);
  // Remplir en serpentant : toujours un terrain de la lisière, au hasard déterministe.
  let k = 0;
  while (g.state.career.lotsBought < MAX_LOTS) {
    const s = forSale(g).filter((l) => l.buyable);
    assert.ok(s.length > 0);
    const pick = s[(k * 7) % s.length];
    assert.ok(g.actions.career.buyLot(pick.id).ok);
    k++;
  }
  assert.equal(MAX_LOTS, 16);
  assert.equal(forSale(g).length, 0, 'plus rien à vendre');
  assert.equal(g.query.career.nextLot(), null);
  assert.match(g.actions.career.buyLot().reason, /Tous les terrains/);
  assert.equal(checkCareerState(g.serialize()), null);
  const reloaded = loadCareer(g.serialize());
  assert.deepEqual(reloaded.query.career.grid(), g.query.career.grid());
});

test('sauvegarde : cases vérifiées (identifiant ↔ case, case libre, terrain relié à la ferme)', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 6);
  for (const id of ['lot2e1', 'lot2e2', 'lot3e2', 'lot3']) assert.ok(g.actions.career.buyLot(id).ok, id);
  const saved = g.serialize();
  assert.equal(saved.career.version, CAREER_VERSION);
  assert.deepEqual(loadCareer(saved).state.career.lots.map((l) => [l.id, l.col, l.row]), saved.career.lots.map((l) => [l.id, l.col, l.row]));
  const bad = (fn) => {
    const s = JSON.parse(JSON.stringify(saved));
    fn(s);
    return checkCareerState(s);
  };
  assert.match(bad((s) => { s.career.lots[4].col = -2; }), /terrain/);
  assert.match(bad((s) => { s.career.lots[5].id = 'lot2e1'; s.career.lots[5].col = 1; s.career.lots[5].row = 0; }), /case/);
  assert.match(bad((s) => { const l = s.career.lots[4]; l.id = 'lot5e2'; l.row = 3; }), /isolé/);
  assert.match(bad((s) => { s.career.lots[0].col = 1; }), /terrain/);
});

test('migration v1 → v2 : les terrains en colonne gardent leur identifiant, colonne 0, rangées 1..n', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 5);
  for (let k = 0; k < 12; k++) assert.ok(g.actions.career.buyLot().ok);
  // Une ancienne carrière : 12 terrains empilés (lot3 … lot14), sans col / row.
  const v1 = JSON.parse(JSON.stringify(g.serialize()));
  v1.career.version = 1;
  v1.career.lots.forEach((l, k) => {
    if (k >= 3) {
      l.id = `lot${k}`;
      l.name = `Ancien ${k}`;
    }
    delete l.col;
    delete l.row;
  });
  // Les parcelles, bâtiments et machines désignent ces identifiants (ici : aucun sur ces terrains).
  const migrated = migrateCareer(v1);
  assert.equal(migrated.career.version, CAREER_VERSION);
  assert.deepEqual(migrated.career.lots.map((l) => [l.id, l.col, l.row]), [
    ['home', 0, 0], ['start', 0, 0], ['yard', 0, 0],
    ...Array.from({ length: 12 }, (_, k) => [`lot${k + 3}`, 0, k + 1]),
  ]);
  assert.equal(checkCareerState(migrated), null, 'rangées 7 à 12 permises pour une ancienne carrière');
  const old = loadCareer(v1);
  assert.equal(old.state.career.lots[14].name, 'Ancien 14', 'noms gardés');
  // Rang 6 : 4 terrains de plus, sur les côtés (la colonne d'origine est pleine jusqu'à la rangée 6 et au-delà).
  setRank(old, 6);
  old.state.money = 1e7;
  const sale = forSale(old);
  assert.ok(sale.length > 0 && sale.every((l) => l.col !== 0 && inLotGrid(l.col, l.row)));
  assert.equal(sale[0].price, LOT_PRICES[12]);
  assert.ok(old.actions.career.buyLot(sale[0].id).ok);
  assert.equal(old.query.career.grid().rows[1], 12, 'la carte montre toute la colonne');
  assert.equal(checkCareerState(old.serialize()), null);
});

test('le verger de Joseph peut être un terrain de côté (moitié prix sur toute la lisière)', () => {
  const g = newCareer();
  rich(g);
  setRank(g, 2);
  g.state.career.joseph.hearts = 8;
  g.refreshLevel();
  const sale = forSale(g);
  assert.ok(sale.every((l) => l.price === Math.round(LOT_PRICES[0] / 2) && l.special?.label === 'Le verger de Joseph'));
  const r = g.actions.career.buyLot('lot2e1');
  assert.ok(r.ok);
  assert.equal(r.lotType, 'orchard');
  assert.equal(g.state.career.lots.find((l) => l.id === 'lot2e1').type, 'orchard');
  assert.ok(forSale(g).every((l) => !l.special), 'une seule fois');
});
