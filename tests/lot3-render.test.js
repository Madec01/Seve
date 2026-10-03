// Lot 3 « Variété » (rendu) : repères de la scène (tableau du village, charrette, roulotte), purs et testés sous Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/data/levels.js';
import { createLayout } from '../src/render/layout.js';
import { createCareer } from '../src/core/career/career.js';
import { createCareerLayout } from '../src/render/layout-career.js';
import { varietySpots, createVarietyActors } from '../src/render/variety-actors.js';
import { TILE } from '../src/render/atlas.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const px = (r) => ({ x: r.x * TILE, y: r.y * TILE, w: (r.w || 1) * TILE, h: (r.h || 1) * TILE });

/** Le panneau (2 × 2 tuiles) ne couvre ni parcelle, ni chemin, ni maison, ni emplacement de décor. */
function checkBoard(L, label) {
  const s = varietySpots(L);
  const b = s.board;
  assert.equal(b.w, 32, label);
  assert.equal(b.h, 32, label);
  for (const p of L.plots) if (!p.retired) assert.ok(!overlap(b, p), `${label} : panneau sur la parcelle ${p.index}`);
  for (let ty = b.y / TILE; ty < (b.y + b.h) / TILE; ty++) {
    for (let tx = b.x / TILE; tx < (b.x + b.w) / TILE; tx++) assert.ok(!L.isPath(tx, ty, true), `${label} : panneau sur le chemin (${tx}, ${ty})`);
  }
  if (L.house) assert.ok(!overlap(b, px(L.house)), `${label} : panneau sur la maison`);
  for (const d of L.decorSlots || []) assert.ok(!overlap(b, d), `${label} : panneau sur l'emplacement ${d.id}`);
  const e = L.essential || { x: 0, w: L.width };
  assert.ok(b.x >= e.x && b.x + b.w <= e.x + e.w, `${label} : panneau dans la partie visible`);
  return s;
}

/** Charrette, caisses et roulotte : sur la route, dans la largeur visible, sans se chevaucher. */
function checkRoad(L, s, label) {
  const roadPx = s.roadY * TILE;
  const e = L.essential || { x: 0, w: L.width };
  for (const r of [s.cart, s.wagon, ...s.crates]) {
    assert.ok(r.y >= roadPx - 1 && r.y + r.h <= roadPx + 2 * TILE + 1, `${label} : sur la route`);
    assert.ok(r.x >= e.x - 1 && r.x + r.w <= e.x + e.w + 1, `${label} : dans la largeur visible`);
  }
  assert.ok(!overlap(s.cart, s.merchant), `${label} : charrette et roulotte séparées`);
  for (const c of s.crates) assert.ok(!overlap(c, s.merchant), `${label} : caisse sur la roulotte`);
  assert.ok(!overlap(s.board, s.cart) && !overlap(s.board, s.merchant), `${label} : panneau hors de la route`);
}

test('lot 3 (rendu) : panneau du village, charrette et roulotte bien placés en portrait (tous les niveaux)', () => {
  for (const lvl of LEVELS) {
    const L = createLayout(lvl, { mode: 'portrait' });
    const s = checkBoard(L, `portrait niveau ${lvl.id}`);
    checkRoad(L, s, `portrait niveau ${lvl.id}`);
    // Le panneau est près du portail du champ (au plus 4 tuiles du chemin, sous ou au bas de la clôture).
    const g = L.field.gate;
    assert.ok(Math.abs(s.board.x / TILE - g.x) <= 4, `niveau ${lvl.id} : près du portail`);
    assert.ok(s.board.y / TILE >= g.y && s.board.y / TILE <= g.y + 3, `niveau ${lvl.id} : sous le portail`);
  }
});

test('lot 3 (rendu) : mêmes repères en paysage (tous les niveaux)', () => {
  for (const lvl of LEVELS) {
    const L = createLayout(lvl);
    const s = checkBoard(L, `paysage niveau ${lvl.id}`);
    checkRoad(L, s, `paysage niveau ${lvl.id}`);
  }
});

test('lot 3 (rendu) : carrière, le panneau dans la bande de la maison, la charrette sur la route', () => {
  const g = createCareer({ seed: 11, variety: false });
  const L = createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments });
  const s = checkBoard(L, 'carrière');
  checkRoad(L, s, 'carrière');
  const H = L.home.y0 * TILE;
  assert.ok(s.board.y >= H && s.board.y + s.board.h <= L.home.roadY * TILE, 'panneau entre le champ de départ et la route');
  for (const k of ['house', 'storage', 'well', 'stand']) if (L.home[k]) assert.ok(!overlap(s.board, px(L.home[k])), `panneau sur ${k}`);
});

test('lot 3 (rendu) : rien n\'est dessiné ni touchable sans state.variety (Classique)', () => {
  const lvl = LEVELS[0];
  const L = createLayout(lvl, { mode: 'portrait' });
  const effects = new Proxy({}, { get: () => () => null });
  const a = createVarietyActors(effects);
  const game = { mode: 'levels', state: { time: { day: 3 } }, query: {} };
  a.sync(game, L, { time: 1 });
  a.update(0.016);
  const pushed = [];
  a.collect((...args) => pushed.push(args));
  assert.equal(pushed.length, 0);
  assert.equal(L.variety, undefined, 'pas de layout.variety en Classique');
  const s = varietySpots(L);
  assert.equal(a.hitTest(s.board.x + 8, s.board.y + 8, 10), null);
});

test('lot 3 (rendu) : avec la variété, le panneau et ses feuilles sont dessinés et touchables', () => {
  const lvl = LEVELS[1];
  const L = createLayout(lvl, { mode: 'portrait' });
  const effects = new Proxy({}, { get: () => () => null });
  // Sous Node : pas de planche ni de DOM ; un faux canvas suffit pour les replis dessinés.
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => null, set: () => true }) }) };
  const a = createVarietyActors(effects);
  const orders = { slots: [{ id: 'o1', kept: true, lines: [] }, { empty: true, text: '…' }, { id: 'o2', lines: [] }], startsIn: 0 };
  const game = {
    mode: 'levels',
    state: { time: { day: 2 }, variety: { v: 1, parts: { board: true }, board: { slots: [] }, cart: null } },
    query: { orders: () => orders, cart: () => null, merchant: () => null, cards: () => ({ offer: null, active: [] }) },
  };
  a.sync(game, L, { time: 1 });
  assert.ok(L.variety && L.variety.board, 'layout.variety posé');
  const pushed = [];
  a.collect((name, x, y, sortY, opts) => pushed.push({ name, x, y, sortY, opts }));
  // 1 panneau + 2 feuilles (la place vide n'a pas de feuille) ; repli dessiné sous Node (pas de planche).
  assert.equal(pushed.length, 3);
  const s = varietySpots(L);
  assert.deepEqual(a.hitTest(s.board.x + 16, s.board.y + 16, 0), { type: 'villageBoard' });
  assert.deepEqual(a.hitTest(s.board.x - 6, s.board.y + 16, 8), { type: 'villageBoard' }, 'tolérance du doigt');
  assert.equal(a.hitTest(s.board.x - 30, s.board.y + 16, 8), null);
  if (!hadDoc) delete globalThis.document;
});
