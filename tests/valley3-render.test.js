// Rendu de la Vallée V3 « Le ruisseau » (paquet UI/RENDER) : vue de la vallée (disposition, cibles, ordre des touchers),
// terres sauvages sur la carte (blocs, lisières, pas d'allée, objets déterministes), poteau « Vers la vallée », cellules des
// parcelles, clé de la grille. Fonctions pures (aucun DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { viewLayout, viewTargets, pickViewTarget, PLACE_RECTS, MILL_RECT, FARM_RECT, PONTOON_RECT, MUSHROOM_SPOTS, ANIMAL_ANCHORS, placeSpriteName, millSpriteName, farmSpriteName, sproutCount, VIEW_W, VIEW_H } from '../src/render/valley-view.js';
import { wildObjects, wildVisitor, wildGroundName, clearingTiles } from '../src/render/places-actors.js';
import { createCareerLayout, careerGridKey, careerLayoutKey, careerIsolatedTargets } from '../src/render/layout-career.js';
import { VALLEY_SPECIES } from '../src/data/career/places.js';
import { startedCareer, nextDay } from './valley-helpers.js';

const PIXEL7 = { cssW: 412, cssH: 915, dpr: 2.625, insetTop: 34, insetBottom: 76 };
const SMALL = { cssW: 360, cssH: 740, dpr: 3, insetTop: 34, insetBottom: 76 };
const css = (L, n) => (n * L.zoom) / L.dpr;

test('vue de la vallée : zoom × 5 sur le Pixel 7 et sur 360 × 740, monde centré, défilement borné', () => {
  for (const s of [PIXEL7, SMALL]) {
    const L = viewLayout(s);
    assert.equal(L.zoom, 5);
    assert.equal(L.worldW, VIEW_W);
    assert.equal(L.worldH, VIEW_H);
    assert.ok(L.x0 >= 0 && L.x0 < 40, `marge ${L.x0}`);
    assert.ok(L.scrollMax >= 0);
    assert.ok(css(L, VIEW_H) - L.scrollMax <= s.cssH - s.insetTop - s.insetBottom + 1);
  }
  assert.equal(viewLayout({ cssW: 300, cssH: 600, dpr: 1 }).zoom, 3, 'jamais sous × 3');
});

test('vue de la vallée : cadrage commun (lieux dans le monde) et lieux ≥ 100 px CSS', () => {
  for (const [id, r] of Object.entries(PLACE_RECTS)) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= VIEW_W && r.y + r.h <= VIEW_H, id);
    for (const s of [PIXEL7, SMALL]) {
      const L = viewLayout(s);
      assert.ok(css(L, Math.min(r.w, r.h)) >= 100, `${id} : ${css(L, Math.min(r.w, r.h))} px`);
    }
  }
  assert.deepEqual(PLACE_RECTS.brook, { x: 24, y: 120, w: 64, h: 312 });
  assert.deepEqual(MILL_RECT, { x: 80, y: 168, w: 32, h: 48 });
  assert.deepEqual(FARM_RECT, { x: 72, y: 256, w: 48, h: 48 });
  assert.equal(MUSHROOM_SPOTS.length, 5);
  for (const m of MUSHROOM_SPOTS) assert.ok(m.x >= PLACE_RECTS.combe.x && m.x + 16 <= 96 && m.y >= 40 && m.y + 16 <= 136, 'champignon dans le bois');
  for (const s of VALLEY_SPECIES) assert.ok(ANIMAL_ANCHORS[s.id], `ancrage de ${s.id}`);
});

test('vue de la vallée : petites cibles agrandies à ≥ 48 px CSS ; ordre des touchers', () => {
  const view = { animals: [{ id: 'kingfisher', state: 'visible' }, { id: 'heron', state: 'hint' }, { id: 'otter', state: 'resident' }], mushrooms: [{ id: 'm1', kind: 'cep', spot: 0 }], river: { step: 2 }, joseph: true };
  for (const s of [PIXEL7, SMALL]) {
    const L = viewLayout(s);
    const t = viewTargets(L, view);
    for (const x of t) assert.ok(css(L, x.rect.w) >= 47.99 && css(L, x.rect.h) >= 47.99, JSON.stringify(x.hit));
    assert.ok(!t.some((x) => x.hit.type === 'viewAnimal' && x.hit.id === 'heron'), 'un indice ne se touche pas');
    assert.ok(!t.some((x) => x.hit.type === 'viewAnimal' && x.hit.id === 'otter'), 'un habitant installé ne se touche pas');
    const a = ANIMAL_ANCHORS.kingfisher;
    assert.deepEqual(pickViewTarget(t, a.x, a.y - 8), { type: 'viewAnimal', id: 'kingfisher' });
    assert.deepEqual(pickViewTarget(t, PONTOON_RECT.x + 8, PONTOON_RECT.y + 8), { type: 'river' });
    assert.deepEqual(pickViewTarget(t, MUSHROOM_SPOTS[0].x + 8, MUSHROOM_SPOTS[0].y + 8), { type: 'mushroom', id: 'm1' });
    assert.deepEqual(pickViewTarget(t, 100, 190), { type: 'place', id: 'brook' }, 'le moulin mène au ruisseau (étape « Le moulin tourne »)');
    assert.deepEqual(pickViewTarget(t, 30, 175), { type: 'place', id: 'millpond' }, 'l\'étang avant le ruisseau');
    assert.deepEqual(pickViewTarget(t, 40, 360), { type: 'place', id: 'brook' }, 'le ruisseau avant le bocage');
    assert.deepEqual(pickViewTarget(t, 150, 360), { type: 'place', id: 'bocage' });
    assert.deepEqual(pickViewTarget(t, 100, 290), { type: 'farm' });
    assert.deepEqual(pickViewTarget(t, 150, 100), { type: 'place', id: 'oldOrchard' });
  }
  // Sans ruisseau qui chante : pas de ponton.
  assert.ok(!viewTargets(viewLayout(PIXEL7), { river: { step: 1 } }).some((x) => x.hit.type === 'river'));
});

test('vue de la vallée : noms des dessins et pousses selon la reprise', () => {
  assert.equal(placeSpriteName('brook', 3), 'place.brook.3');
  assert.equal(millSpriteName(3), 'place.mill.0');
  assert.equal(millSpriteName(4, 1), 'place.mill.1.a');
  assert.equal(farmSpriteName(9), 'view.farm.4');
  assert.equal(sproutCount(0), 1);
  assert.equal(sproutCount(0.5), 3);
  assert.equal(sproutCount(1), 5);
});

function wildCareer() {
  const g = startedCareer({}, 6);
  g.state.money = 9e6;
  for (let k = 0; k < 20; k++) g.actions.career.buyLot();
  g.actions.career.triggerValley('stage', 5);
  nextDay(g);
  return g;
}
const layoutOf = (g) => createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments, grid: g.query.career.grid() });

test('terres sauvages : forêts à confier dans le monde, bloc sans clôture ni allée, lisières, clé de la grille', () => {
  const g = wildCareer();
  const L0 = layoutOf(g);
  assert.ok(L0.wildable.length >= 1, 'des forêts à confier');
  const id = L0.wildable[0].cellId;
  const key0 = careerGridKey(g.query.career.grid());
  // Une forêt à confier reste une forêt (tout le bloc).
  const w0 = L0.wildable[0];
  const tx = w0.rect.x / 16 + 6;
  const ty = w0.rect.y / 16 + 5;
  assert.ok(L0.isForest(tx, ty));
  assert.ok(L0.isForest(tx, w0.rect.y / 16 + 10), 'pas d\'allée sur une forêt à confier');
  const r = g.actions.career.rewild(id, 'marsh');
  assert.ok(r.ok, r.reason);
  const key1 = careerGridKey(g.query.career.grid());
  assert.notEqual(key0, key1, 'la clé change : la carte se reconstruit');
  const L = layoutOf(g);
  const b = L.wildBands.find((x) => x.cellId === id);
  assert.ok(b, 'bloc de la terre sauvage');
  assert.equal(b.kind, 'marsh');
  assert.equal(b.stage, 0);
  assert.equal(b.rect.w, 14 * 16);
  assert.equal(b.rect.h, 11 * 16);
  const bx = b.rect.x / 16;
  const by = b.rect.y / 16;
  for (let y = by; y < by + 11; y++) for (let x = bx + 1; x < bx + 13; x++) assert.ok(!L.isForest(x, y) && !L.isPath(x, y), `sol de la terre en ${x},${y}`);
  assert.ok(!L.fences.some((f) => f.rect.x >= bx && f.rect.x < bx + 14 && f.rect.y >= by && f.rect.y < by + 11), 'aucune clôture');
  assert.ok(!L.lotSigns.some((s) => s.lotId === id), 'aucun panneau de terrain');
  // Toucher : le bloc → sa fiche ; le poteau, cible agrandie.
  assert.deepEqual(L.hitTestCareer(b.rect.x + 100, b.rect.y + 60, g.state, 0), { type: 'wildLand', cellId: id });
  const sx = b.sign.x * 16 + 8;
  const sy = b.sign.y * 16 + 8;
  assert.deepEqual(L.hitTestCareer(sx, sy, g.state, 0), { type: 'wildLand', cellId: id });
  assert.equal(L.wildRect(id).w, 224);
  // Les objets sont déterministes, dans le bloc, sans chevauchement de tuiles.
  for (const kind of ['wood', 'marsh', 'grassland']) {
    for (const stage of [0, 1, 2]) {
      const band = { ...b, kind, stage };
      const o1 = wildObjects(band);
      assert.deepEqual(o1, wildObjects(band));
      const seen = new Set();
      for (const o of o1) {
        assert.ok(o.x >= b.rect.x + 16 && o.x + o.w <= b.rect.x + b.rect.w - 16 && o.y >= b.rect.y && o.y + o.h <= b.rect.y + b.rect.h, `${kind}/${stage} ${o.name} dans le bloc`);
        for (let y = o.y; y < o.y + o.h; y += 16) for (let x = o.x; x < o.x + o.w; x += 16) {
          const k = `${x},${y}`;
          assert.ok(!seen.has(k), `${kind}/${stage} : chevauchement en ${k}`);
          seen.add(k);
        }
      }
      if (stage > 0) assert.ok(o1.length >= 4, `${kind}/${stage} : des objets`);
    }
  }
  assert.ok(/^wildland\.marsh\.ground(\.1)?$/.test(wildGroundName('marsh', 3, 4)));
  assert.equal(wildVisitor({ ...b, stage: 1 }, 10), null, 'pas de visiteur avant la reprise');
  const days = Array.from({ length: 40 }, (_, d) => wildVisitor({ ...b, kind: 'marsh', stage: 2 }, d));
  assert.ok(days.some(Boolean) && days.every((v) => v === null || ['frog', 'dragonfly'].includes(v)), 'visiteurs du marais (héron : seulement installé)');
  assert.ok(days.some((v, d) => v !== wildVisitor({ ...b, kind: 'marsh', stage: 2 }, d + 1)), 'le visiteur change avec les jours');
});

test('poteau « Vers la vallée » : tuile réservée, au bord de la route, sans chevaucher la maison ni ses repères', () => {
  const g = wildCareer();
  const L = layoutOf(g);
  const p = L.valley.signpost;
  assert.ok(p, 'poteau posé quand la Vallée existe');
  const T = 16;
  const tiles = { x: p.x / T, y: p.y / T, w: p.w / T, h: p.h / T };
  assert.equal(tiles.y, L.home.roadY + 2, 'juste sous la route');
  const H = L.home;
  const rects = [H.house, H.storage, H.stand, H.well, H.waterTower, H.tractor, ...L.decorSlots.map((d) => ({ x: d.x / T, y: d.y / T, w: d.w / T, h: d.h / T }))];
  for (const k of ['box', 'library']) if (L.valley[k]) rects.push({ x: L.valley[k].x / T, y: L.valley[k].y / T, w: L.valley[k].w / T, h: L.valley[k].h / T });
  for (const s of Object.values(L.valley.spots)) rects.push({ x: s.x / T, y: s.y / T, w: s.w / T, h: s.h / T });
  const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const r of rects) assert.ok(!over(tiles, r), `chevauchement ${JSON.stringify(r)}`);
  for (let y = tiles.y; y < tiles.y + tiles.h; y++) assert.ok(!L.isForest(tiles.x, y) && !L.isPath(tiles.x, y), 'sur l\'herbe');
  assert.ok(!L.deco.some((d) => d.tx === tiles.x && d.ty >= tiles.y && d.ty < tiles.y + tiles.h), 'aucun décor dessous');
  // La couche fixe se reconstruit à l'ouverture de la vue (poteau) et à l'étape 7 (clairières).
  const k1 = careerLayoutKey(g.state);
  g.state.career.valley.stage = 7;
  assert.notEqual(careerLayoutKey(g.state), k1);
  assert.ok(clearingTiles(L).length > 10, 'des clairières le long de la lisière');
  assert.ok(careerIsolatedTargets(L, g.state).some((t) => t.kind === 'signpost'));
});

test('parcelles : chaque cellule contient sa parcelle, aucune ne chevauche une autre, clôture comprise au bord', () => {
  const g = wildCareer();
  const L = layoutOf(g);
  const live = L.plots.filter((p) => !p.retired);
  assert.ok(live.length >= 16);
  const cells = live.map((p) => ({ p, c: L.plotCell(p.index) }));
  for (const { p, c } of cells) {
    assert.ok(c.x <= p.x && c.y <= p.y && c.x + c.w >= p.x + p.w && c.y + c.h >= p.y + p.h, 'contient sa parcelle');
    assert.ok(c.w <= p.w + 32 && c.h <= p.h + 32, 'au plus une tuile de plus de chaque côté');
  }
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i].c;
    const b = cells[j].c;
    assert.ok(!(a.x < b.x + b.w - 1e-6 && a.x + a.w > b.x + 1e-6 && a.y < b.y + b.h - 1e-6 && a.y + a.h > b.y + 1e-6), `cellules ${cells[i].p.index} et ${cells[j].p.index}`);
  }
  // Au doigt (tolérance), toucher la clôture à côté d'une parcelle du bord la désigne.
  const first = live.find((p) => p.lot === 'start');
  const c = L.plotCell(first.index);
  const hit = L.hitTestCareer(c.x + 1, c.y + c.h / 2, g.state, 1);
  assert.deepEqual(hit, { type: 'plot', index: first.index });
});
