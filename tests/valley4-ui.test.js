// Rendu et interface de la Vallée V4 « Les cigognes » (paquet UI/RENDER) : cloches des légendes dans le rectangle de la
// Grainothèque, pied du nid sur la cheminée de chaque maison (hors porte et panneau), lueurs, passages, forêt en 4 états,
// visiteurs et banc dans la vue (cibles ≥ 48 px CSS), pages du livre, cartes du générique, réglage « Sons de la vallée »,
// décors trouvés. Fonctions pures (aucun DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clocheRects, CLOCHE_DX, nestAnchor, NEST_ANCHORS, clocheStage, clocheSpriteName, nestSpriteName, glowSpots, flyoverPath, rainbowBands, forestTileName, LEGEND_ORDER } from '../src/render/storks-actors.js';
import { createCareerLayout } from '../src/render/layout-career.js';
import { viewLayout, viewTargets, pickViewTarget, visitorRect, visitorSpriteName, viewSoundSpots, VIEW_ANCHORS_V4, VIEW_W, VIEW_H, BENCH_RECT, PLACE_RECTS } from '../src/render/valley-view.js';
import { SPRITES, decorSprite, DECOR_SPRITES } from '../src/render/atlas.js';
import { bookPages, bookFigures } from '../src/ui/career/valley-book.js';
import { creditsCardAt, placeCenterY } from '../src/ui/career/storks.js';
import { DEFAULT_SETTINGS, NATURE_SOUNDS } from '../src/storage.js';
import { LEGEND_IDS, VISITOR_IDS } from '../src/data/career/storks.js';
import { stage8Career } from './valley4-helpers.js';

const PIXEL7 = { cssW: 412, cssH: 915, dpr: 2.625, insetTop: 34, insetBottom: 76 };
const SMALL = { cssW: 360, cssH: 740, dpr: 3, insetTop: 34, insetBottom: 76 };
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

test('cloches : 4 rectangles 8 × 12 dans le rectangle de la Grainothèque, ordre des légendes, la porte reste visible', () => {
  assert.deepEqual(LEGEND_ORDER, LEGEND_IDS);
  const lib = { x: 160, y: 96, w: 32, h: 32 };
  const r = clocheRects(lib);
  assert.equal(r.length, 4);
  for (const c of r) {
    assert.equal(c.w, 8);
    assert.equal(c.h, 12);
    assert.ok(inside(c, lib), 'la cloche ne sort pas du rectangle réservé');
    assert.equal(c.y + c.h, lib.y + lib.h, 'posée sur le bas du bâtiment');
  }
  for (let i = 1; i < 4; i++) assert.ok(r[i].x > r[i - 1].x, 'de gauche à droite');
  // La porte (au milieu du bas, px 15 à 17) n'est couverte par aucune cloche.
  assert.ok(!r.some((c) => c.x - lib.x < 17 && c.x - lib.x + c.w > 15));
  assert.deepEqual(clocheRects(null), []);
  assert.equal(CLOCHE_DX.length, 4);
});

test('cloches et nid dans la vraie disposition d\'une carrière V4', () => {
  const g = stage8Career();
  const L = createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments, grid: g.query.career.grid() });
  const lib = L.valley.library;
  assert.ok(lib);
  assert.equal(L.valley.cloches.length, 4);
  for (const c of L.valley.cloches) assert.ok(inside(c, lib));
  const n = L.valley.nest;
  assert.ok(n, 'pied du nid');
  assert.ok(n.x >= n.houseRect.x && n.x <= n.houseRect.x + n.houseRect.w);
  assert.ok(n.y < n.houseRect.y + n.houseRect.h / 2, 'sur le toit');
});

test('nid : pied posé sur la cheminée de chaque niveau de maison, sur le toit, hors de la porte et du panneau', () => {
  const HOUSES = { 1: [4, 3], 2: [5, 3], 3: [5, 4], 4: [6, 4], 5: [6, 5] };
  for (let lv = 1; lv <= 5; lv++) {
    const a = nestAnchor(lv);
    assert.deepEqual(a, NEST_ANCHORS[lv]);
    const [tw, th] = HOUSES[lv];
    const w = tw * 16;
    const h = th * 16;
    assert.ok(a.x - 12 >= 0 && a.x + 12 <= w + 8, `niveau ${lv} : la roue tient au-dessus de la maison`);
    assert.ok(a.y <= h / 2, `niveau ${lv} : sur le toit (moitié haute)`);
    // La porte est dans la rangée du bas : le nid (24 × 20 au-dessus du pied) n'y descend jamais.
    assert.ok(a.y < h - 16, `niveau ${lv} : loin de la porte`);
  }
  assert.deepEqual(nestAnchor(0), NEST_ANCHORS[1]);
  assert.deepEqual(nestAnchor(9), NEST_ANCHORS[5]);
});

test('sprites des cloches et du nid', () => {
  assert.equal(clocheStage(null, 5), -1);
  assert.equal(clocheSpriteName('motherMelon', null, 5), 'legend.cloche');
  const e = { sownAt: 10, readyAt: 16, ripe: false };
  assert.equal(clocheStage(e, 10), 0);
  assert.equal(clocheStage(e, 13), 1);
  assert.equal(clocheStage(e, 16), 2);
  assert.equal(clocheStage({ ...e, ripe: true }, 10), 2);
  assert.equal(clocheSpriteName('storkPea', e, 14), 'legend.storkPea.1');
  for (const id of LEGEND_IDS) for (const s of [0, 1, 2]) assert.ok(SPRITES[`legend.${id}.${s}`], `legend.${id}.${s}`);
  assert.ok(SPRITES['legend.cloche']);
  assert.equal(nestSpriteName(null), null);
  assert.equal(nestSpriteName({ state: 'wheel' }), 'stork.wheel');
  assert.equal(nestSpriteName({ state: 'pair' }), 'stork.nest.pair');
  assert.equal(nestSpriteName({ state: 'chicks', chicks: 2 }), 'stork.nest.chicks');
  assert.equal(nestSpriteName({ state: 'snow' }), 'stork.nest.snow');
  for (const n of ['stork.wheel', 'stork.nest.pair', 'stork.nest.chicks', 'stork.nest.snow']) assert.ok(SPRITES[n], n);
});

test('lueurs des vers luisants : 24 au plus, au pied des haies, déterministes par jour', () => {
  const hedges = [{ x: 0, y: 0, w: 16, h: 160 }, { x: 208, y: 0, w: 16, h: 160 }, { x: 0, y: 200, w: 16, h: 160 }, { x: 208, y: 200, w: 16, h: 160 }, { x: 400, y: 0, w: 16, h: 160 }];
  const a = glowSpots(hedges, 42);
  assert.ok(a.length <= 24 && a.length > 0);
  assert.deepEqual(a, glowSpots(hedges, 42));
  assert.notDeepEqual(a, glowSpots(hedges, 43));
  for (const p of a) assert.ok(hedges.some((h) => p.y >= h.y && p.y <= h.y + h.h && p.x >= h.x - 10 && p.x <= h.x + h.w + 10));
  assert.deepEqual(glowSpots([], 1), []);
  assert.equal(glowSpots(Array.from({ length: 40 }, (_, i) => ({ x: i * 20, y: 0, w: 16, h: 160 })), 3).length, 24);
});

test('passages : une traversée de ≤ 20 s par jour, déterministe', () => {
  assert.equal(flyoverPath(null, 3), null);
  for (let d = 1; d < 60; d++) {
    for (const k of ['storks', 'cranes']) {
      const f = flyoverPath(k, d);
      assert.ok(f.dur <= 20);
      assert.ok(f.start >= 0.2 && f.start <= 0.65);
      assert.ok(f.yFrac > 0 && f.yFrac < 0.5);
      assert.deepEqual(f, flyoverPath(k, d));
    }
  }
  assert.equal(flyoverPath('storks', 5).count, 2);
  assert.equal(rainbowBands(60).length, 5);
});

test('forêt de la carte : 1, 2 puis 3 tuiles sur 5 deviennent feuillues ; vieux arbres et fougères à l\'état 3', () => {
  const count = (n) => {
    let k = 0;
    let old = 0;
    for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
      const t = forestTileName(n, x, y, 'summer');
      if (t) k += 1;
      if (t && /forest\.(old|fern)/.test(t)) old += 1;
    }
    return { k: k / 3600, old };
  };
  assert.equal(count(0).k, 0);
  assert.ok(Math.abs(count(1).k - 0.2) < 0.04);
  assert.ok(Math.abs(count(2).k - 0.4) < 0.04);
  assert.ok(Math.abs(count(3).k - 0.6) < 0.04);
  assert.equal(count(2).old, 0);
  assert.ok(count(3).old > 0);
  // Les merisiers fleurissent au printemps.
  let bloom = false;
  for (let x = 0; x < 80 && !bloom; x++) bloom = forestTileName(3, x, 7, 'spring') === 'forest.mixed.cherry.bloom';
  assert.ok(bloom);
  for (let x = 0; x < 40; x++) {
    const t = forestTileName(3, x, 3, 'spring');
    if (t) assert.ok(SPRITES[t], t);
  }
});

test('vue : visiteurs posés dans le monde, cibles ≥ 48 px CSS, avant les lieux ; banc habité', () => {
  for (const id of VISITOR_IDS) {
    const r = visitorRect(id);
    assert.ok(r.x >= -2 && r.y >= 0 && r.x + r.w <= VIEW_W + 2 && r.y + r.h <= VIEW_H, id);
    assert.ok(SPRITES[visitorSpriteName(id)], visitorSpriteName(id));
  }
  assert.ok(SPRITES['stork.steeple']);
  for (const lay of [viewLayout(PIXEL7), viewLayout(SMALL)]) {
    const k = lay.zoom / lay.dpr;
    const view = { places: [], visitors: [{ id: 'crane', state: 'visible', anchor: 'crane' }, { id: 'whiteStork', state: 'visible', anchor: 'steeple' }, { id: 'oriole', state: 'resident', anchor: 'oriole' }], bench: { joseph: 'resident', helene: true } };
    const t = viewTargets(lay, view);
    const crane = t.find((x) => x.hit.type === 'visitor' && x.hit.id === 'crane');
    const stork = t.find((x) => x.hit.type === 'visitor' && x.hit.id === 'whiteStork');
    const bench = t.find((x) => x.hit.type === 'bench');
    for (const x of [crane, stork, bench]) {
      assert.ok(x, 'cible présente');
      assert.ok(x.rect.w * k >= 47.9 && x.rect.h * k >= 47.9, 'au moins 48 px CSS');
    }
    assert.ok(!t.some((x) => x.hit.type === 'visitor' && x.hit.id === 'oriole'), 'un visiteur en décor ne se touche pas');
    assert.ok(!t.some((x) => x.hit.type === 'joseph'), 'le banc remplace Joseph du V3');
    // Toucher les grues dans la prairie : le visiteur passe avant le lieu.
    const a = VIEW_ANCHORS_V4.crane;
    assert.deepEqual(pickViewTarget(t, a.x, a.y - 6), { type: 'visitor', id: 'crane' });
    assert.deepEqual(pickViewTarget(t, BENCH_RECT.x + 8, BENCH_RECT.y + 8), { type: 'bench' });
  }
  const spots = viewSoundSpots();
  for (const k of ['steeple', 'crane', 'redDeer', 'oriole', 'beaver']) assert.ok(Number.isFinite(spots[k].x) && Number.isFinite(spots[k].y), k);
});

test('livre : pages (couverture, avant / après, une par année, …) et les quatre chiffres partagés', () => {
  const book = {
    years: [{ year: 2 }, { year: 3 }, { year: 4 }],
    seeds: [{ kind: 'variety', state: 'saved' }, { kind: 'variety', state: 'seeds' }, { kind: 'legend', state: 'awake' }, { kind: 'legend', state: 'unknown' }],
    beings: [{ kind: 'species', state: 'installed' }, { kind: 'species', state: 'unknown' }, { kind: 'visitor', state: 'seen' }],
    places: [{ restored: true }, { restored: false }],
  };
  const p = bookPages(book);
  assert.equal(p[0].id, 'cover');
  assert.equal(p[1].id, 'beforeAfter');
  assert.deepEqual(p.slice(2, 5).map((x) => x.id), ['year:2', 'year:3', 'year:4']);
  assert.equal(p.at(-1).id, 'postcards');
  assert.equal(p.length, 2 + 3 + 6);
  assert.deepEqual(bookPages(null), []);
  assert.deepEqual(bookFigures(book), { beings: 1, varieties: 1, places: 1, legends: 1 });
});

test('livre : la requête du cœur se lit en pages', () => {
  const g = stage8Career();
  const book = g.query.career.valleyBook();
  const p = bookPages(book);
  assert.ok(p.length >= 9);
  assert.ok(p.some((x) => x.year));
});

test('générique : les cartes des lieux passent l\'une après l\'autre ; lieux de la vue', () => {
  const cards = [1, 2, 3, 4, 5, 6];
  assert.equal(creditsCardAt(0, cards), -1);
  assert.equal(creditsCardAt(5, cards), 0);
  const seen = new Set();
  for (let t = 0; t < 70; t += 0.5) {
    const i = creditsCardAt(t, cards);
    if (i >= 0) seen.add(i);
  }
  assert.equal(seen.size, 6);
  for (const id of Object.keys(PLACE_RECTS)) assert.ok(Number.isFinite(placeCenterY(id)));
});

test('réglage « Sons de la vallée » et décors trouvés du V4', () => {
  assert.equal(DEFAULT_SETTINGS.natureSound, 'full');
  assert.deepEqual([...NATURE_SOUNDS], ['full', 'light', 'off']);
  assert.equal(DECOR_SPRITES['melon.cloche'], 'decor.melon.cloche');
  assert.equal(DECOR_SPRITES['stork.vane'], 'decor.stork.vane');
  assert.equal(DECOR_SPRITES['iron.box'], 'decor.iron.box');
  for (const id of ['melon.cloche', 'stork.vane', 'iron.box']) assert.ok(SPRITES[decorSprite(id)], id);
});
