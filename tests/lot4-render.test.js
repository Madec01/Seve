// Lot 4 « Collection & enjeux doux » (rendu) : repères de la scène (cachettes de la chasse, lisière, traces, mangeoire,
// porte-lanternes, fenêtre de la veillée, stand des fêtes), placement déterministe des objets, toucher en mode fête.
// Purs et testés sous Node (aucun DOM : les replis dessinés ne sont pas créés).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/data/levels.js';
import { createLayout } from '../src/render/layout.js';
import { createCareer } from '../src/core/career/career.js';
import { createCareerLayout } from '../src/render/layout-career.js';
import { cozySpots, cozySpot, placeItems, waitingPlots, createCozyActors } from '../src/render/cozy-actors.js';
import { TILE } from '../src/render/atlas.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const tilesOf = (r) => {
  const out = [];
  for (let ty = Math.floor(r.y / TILE); ty < Math.ceil((r.y + r.h) / TILE); ty++) for (let tx = Math.floor(r.x / TILE); tx < Math.ceil((r.x + r.w) / TILE); tx++) out.push([tx, ty]);
  return out;
};

function checkSpots(L, label) {
  const s = cozySpots(L);
  assert.ok(s.hideSpots.length >= 16, `${label} : au moins 16 cachettes (${s.hideSpots.length})`);
  assert.ok(s.edgeSpots.length >= 8, `${label} : au moins 8 places en lisière (${s.edgeSpots.length})`);
  assert.ok(s.traceSpots.length >= 8, `${label} : au moins 8 places de traces (${s.traceSpots.length})`);
  const plots = L.plots.filter((p) => !p.retired);
  const e = L.essential || { x: 0, w: L.width };
  // Le centre d'une cachette n'est jamais sur une parcelle ni un chemin.
  for (const h of s.hideSpots) {
    const cx = Math.floor((h.x + 8) / TILE);
    const cy = Math.floor((h.y + 8) / TILE);
    assert.ok(!L.isPath(cx, cy, true), `${label} : cachette sur le chemin (${cx}, ${cy})`);
    for (const p of plots) assert.ok(!overlap({ x: h.x + 4, y: h.y + 4, w: 8, h: 8 }, p), `${label} : cachette sur la parcelle ${p.index}`);
    assert.ok(h.x + 8 >= e.x && h.x + 8 <= e.x + e.w, `${label} : cachette dans la largeur visible`);
  }
  for (const r of [...s.edgeSpots, ...s.traceSpots].map((p) => ({ x: p.x, y: p.y, w: TILE, h: TILE }))) {
    for (const [tx, ty] of tilesOf(r)) assert.ok(!L.isPath(tx, ty, true), `${label} : lisière ou trace sur le chemin`);
    for (const p of plots) assert.ok(!overlap(r, p), `${label} : lisière ou trace sur une parcelle`);
  }
  // Mangeoire, porte-lanternes, stand : jamais sur une parcelle ni sur un chemin.
  for (const [name, r] of [['mangeoire', s.feeder], ['porte-lanternes', s.lanternRack], ['stand', s.feteStall]]) {
    for (const p of plots) assert.ok(!overlap(r, p), `${label} : ${name} sur la parcelle ${p.index}`);
    for (const [tx, ty] of tilesOf(r)) assert.ok(!L.isPath(tx, ty, true), `${label} : ${name} sur le chemin (${tx}, ${ty})`);
  }
  assert.equal(s.feeder.w, 16, label);
  assert.equal(s.feeder.h, 32, label);
  assert.equal(s.lanternRack.w, 32, label);
  // Le porte-lanternes est sur le perron (touche la maison) et la fenêtre est sur la maison.
  const house = L.house || L.home?.house;
  if (house) {
    const hr = { x: house.x * TILE, y: house.y * TILE, w: house.w * TILE, h: house.h * TILE };
    assert.ok(overlap(s.storyWindow, hr), `${label} : fenêtre de la veillée sur la maison`);
    assert.ok(overlap({ ...s.lanternRack, y: s.lanternRack.y - 2, h: s.lanternRack.h + 4 }, { ...hr, h: hr.h + TILE }), `${label} : porte-lanternes contre la maison`);
  }
  // Déterministe : même disposition → mêmes repères.
  assert.deepEqual(cozySpots(L), s, `${label} : déterministe`);
  return s;
}

test('lot 4 : repères de la scène pour les 12 niveaux (portrait et paysage)', () => {
  for (const mode of ['portrait', 'landscape']) {
    for (const lvl of LEVELS) checkSpots(createLayout(lvl, { mode }), `${mode} niveau ${lvl.id}`);
  }
});

test('lot 4 : repères de la scène en carrière (bande de la maison et champ de départ)', () => {
  const g = createCareer({ seed: 11, variety: false });
  const L = createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments });
  const s = checkSpots(L, 'carrière');
  const fieldTop = L.fieldRect.y - 2 * TILE;
  for (const h of s.hideSpots) assert.ok(h.y >= fieldTop && h.y < L.home.roadY * TILE, 'carrière : cachette près de la maison');
});

test('lot 4 : cozySpot = ⌊u × n⌋, puis la suivante libre', () => {
  const spots = new Array(10).fill(0).map((_, i) => ({ x: i, y: 0 }));
  assert.equal(cozySpot(0, spots), 0);
  assert.equal(cozySpot(0.35, spots), 3);
  assert.equal(cozySpot(0.999999, spots), 9);
  assert.equal(cozySpot(0.35, spots, new Set([3, 4])), 5);
  assert.equal(cozySpot(0.95, spots, new Set([9])), 0, 'on repart au début');
  assert.equal(cozySpot(0.5, []), -1);
  assert.equal(cozySpot(Number.NaN, spots), 0);
});

test('lot 4 : 8 objets cachés → 8 cachettes différentes, stables', () => {
  const L = createLayout(LEVELS[1], { mode: 'portrait' });
  const s = cozySpots(L);
  const items = [0.1, 0.1, 0.1, 0.5, 0.52, 0.9, 0.95, 0.99].map((u, index) => ({ index, u }));
  const a = placeItems(items, s.hideSpots);
  assert.equal(new Set(a).size, 8, 'toutes différentes');
  assert.deepEqual(placeItems(items, s.hideSpots), a, 'mêmes positions');
  for (const i of a) assert.ok(i >= 0 && i < s.hideSpots.length);
});

test('lot 4 : badge « vous attend » seulement avec F1 (parts.helpers)', () => {
  const plots = [{ cropId: 'carrot', ripeAt: 3 }, { cropId: null }, { cropId: 'turnip' }, { cropId: 'corn', ripeAt: 5 }];
  assert.deepEqual(waitingPlots({ plots, cozy: { parts: { helpers: true } } }), [0, 3]);
  assert.deepEqual(waitingPlots({ plots, cozy: { parts: { helpers: false } } }), []);
  assert.deepEqual(waitingPlots({ plots }), []);
});

/** Partie factice minimale (forme des requêtes du contrat). */
function fakeGame(over = {}) {
  const fete = {
    id: 'springFete', engine: 'chasse', themeId: null, day: 1, done: false,
    hidden: { kind: 'egg', items: [0.05, 0.2, 0.33, 0.47, 0.6, 0.71, 0.86, 0.97].map((u, index) => ({ index, u, gold: index === 0, found: index === 2 ? 'player' : null })), foundByPlayer: 1, total: 8 },
  };
  return {
    mode: 'levels',
    state: { cozy: { parts: { lanterns: true, fetes: true, winter: true }, winter: { finds: [], traces: [], feeder: {} } }, plots: [], time: { day: 1 } },
    query: {
      calendar: () => ({ seasonId: 'winter', dayProgress: 0.5 }),
      fete: () => fete,
      winter: () => ({ finds: [{ id: 'w1', kind: 'holly', name: 'Houx', icon: 'winter.holly', u: 0.4 }], traces: [], feeder: { here: true, canFill: true, filledToday: false, bird: null }, story: { available: true, heard: false } }),
      ...over,
    },
  };
}

test('lot 4 : toucher — en mode fête, seuls les objets cachés (pas encore trouvés) répondent', () => {
  const L = createLayout(LEVELS[1], { mode: 'portrait' });
  const fx = { sparkle() {}, confetti() {}, burst() {}, floatText() {} };
  const a = createCozyActors(fx);
  a.sync(fakeGame(), L, { time: 0 });
  const sp = a.spots();
  // Objet 0 (non trouvé) : touché ; objet 2 (trouvé) : rien.
  const r0 = a.itemRect('feteItem', 0);
  assert.deepEqual(a.hitTest(r0.x + 8, r0.y + 8, 0, { feteMode: true }), { type: 'feteItem', index: 0 });
  const r2 = a.itemRect('feteItem', 2);
  const h2 = a.hitTest(r2.x + 8, r2.y + 8, 0, { feteMode: true });
  assert.ok(!h2 || h2.index !== 2, 'un objet trouvé ne se touche plus');
  // Mode fête : la mangeoire ne répond pas ; hors mode fête, si.
  const f = sp.feeder;
  assert.equal(a.hitTest(f.x + 8, f.y + 20, 0, { feteMode: true }), null);
  assert.deepEqual(a.hitTest(f.x + 8, f.y + 20, 0, {}), { type: 'feeder' });
  // Fenêtre de la veillée et trouvaille d'hiver.
  const w = sp.storyWindow;
  assert.deepEqual(a.hitTest(w.x + 8, w.y + 8, 0, {}), { type: 'storyWindow' });
  const fr = a.itemRect('winterFind', 'w1');
  assert.deepEqual(a.hitTest(fr.x + 8, fr.y + 8, 0, {}), { type: 'winterFind', id: 'w1' });
  // Cible agrandie jusqu'à 48 px CSS (minWorld) : un toucher un peu à côté de l'œuf le trouve encore.
  assert.deepEqual(a.hitTest(r0.x - 6, r0.y + 8, 0, { feteMode: true, minWorld: 30 }), { type: 'feteItem', index: 0 });
});

test('lot 4 : rien sans state.cozy (Classique) — ni repères, ni cibles, ni porte-lanternes', () => {
  const L = createLayout(LEVELS[1], { mode: 'portrait' });
  const a = createCozyActors({});
  a.sync({ mode: 'levels', state: { plots: [] }, query: {} }, L, { time: 0 });
  assert.equal(a.spots(), null);
  assert.equal(a.hitTest(100, 100, 50, {}), null);
  const pushed = [];
  a.collect((...args) => pushed.push(args));
  assert.equal(pushed.length, 0);
  assert.equal(a.stats().enabled, false);
});

test('lot 4 : porte-lanternes — niveaux : meilleur résultat donné par l\'interface ; carrière : l\'année passée', () => {
  const L = createLayout(LEVELS[1], { mode: 'portrait' });
  const a = createCozyActors({});
  a.setImages({ lot4: {} }); // planche « chargée » (canDraw) : les noms des sprites sont poussés
  a.setLanterns([1, 2, 3, 4, 4]);
  a.sync(fakeGame(), L, { time: 0 });
  assert.deepEqual(a.stats().rack, [1, 2, 3, 4, 4]);
  const pushed = [];
  a.collect((name) => pushed.push(name));
  assert.equal(pushed.filter((n) => /^lantern\.\w+\.on$/.test(n || '')).length, 14, '14 lanternes allumées');
  assert.equal(pushed.filter((n) => /^lantern\.\w+\.off$/.test(n || '')).length, 6, '6 éteintes');
  const c = createCozyActors({});
  const g = fakeGame();
  g.mode = 'career';
  g.state.cozy.lanterns = { history: [{ year: 1, values: [2, 2, 2, 2, 2], total: 10 }] };
  c.sync(g, createCareerLayout(createCareer({ seed: 3, variety: false }).level, { career: createCareer({ seed: 3, variety: false }).state.career, plots: [] }), { time: 0 });
  assert.deepEqual(c.stats().rack, [2, 2, 2, 2, 2]);
});
