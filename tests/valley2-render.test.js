// La Vallée vivante, lot V2 « Le troc et les croisements » (rendu) : emplacement réservé de la Grainothèque (2 × 2, sans
// chevauchement, quelle que soit la taille de la maison et du grenier), nichoirs à chauves-souris (un rectangle pour chaque
// identifiant du cœur), dessins (niveaux, panneau), sachet du tableau, abeille entre deux parents voisins, mode paire
// (seules les parcelles valides répondent), cible au doigt ≥ 48 px. Purs et testés sous Node (aucun DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer, setRank, nextDay } from './career-helpers.js';
import { createCareerLayout } from '../src/render/layout-career.js';
import { cozySpots } from '../src/render/cozy-actors.js';
import { varietySpots } from '../src/render/variety-actors.js';
import { createValleyActors, librarySpriteName, trocPinRect, beePos, pairTargets, growRect } from '../src/render/valley-actors.js';
import { TILE, SPRITES, DECOR_SPRITES, decorSprite } from '../src/render/atlas.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const px = (t) => ({ x: t.x * TILE, y: t.y * TILE, w: (t.w || 1) * TILE, h: (t.h || 1) * TILE });
const layoutOf = (g) => createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments });

/** Ferme avec la Vallée commencée (V2 ouvert), verger et cour des ateliers ; maison et grenier au niveau demandé. */
function farm({ house = 1, storage = 1 } = {}) {
  const g = newCareer({ valley: true });
  setRank(g, 6);
  g.state.money = 1e7;
  nextDay(g);
  const ids = {};
  for (const t of ['orchard', 'workshops', 'meadow']) {
    const b = g.actions.career.buyLot();
    assert.ok(b.ok, `achat d'un terrain (${t})`);
    const id = b.lotId || g.state.career.lots[g.state.career.lots.length - 1].id;
    assert.ok(g.actions.career.developLot(id, t).ok, `aménagement ${t}`);
    ids[t] = id;
  }
  const B = g.state.career.buildings;
  B.house = { ...(B.house || { lotId: 'home', slot: null }), level: house };
  if (storage) B.storage = { ...(B.storage || { lotId: 'home', slot: null }), level: storage };
  if (!g.state.career.valley.started) g.actions.career.triggerValley('start');
  return { g, ids, L: layoutOf(g) };
}

test('Grainothèque : 2 × 2 tuiles réservées dans la bande de la maison, sans rien chevaucher (maison et grenier de toutes tailles)', () => {
  for (const house of [1, 2, 3, 4, 5]) {
    for (const storage of [1, 2, 3]) {
      const { L } = farm({ house, storage });
      const lib = L.valley.library;
      const tag = `maison ${house}, grenier ${storage}`;
      assert.ok(lib, `rectangle de la Grainothèque (${tag})`);
      assert.equal(lib.w, 2 * TILE);
      assert.equal(lib.h, 2 * TILE);
      const H = L.home.y0;
      assert.ok(lib.y >= H * TILE && lib.y + lib.h <= (H + 14) * TILE, `dans la bande de la maison (${tag})`);
      const blocks = [L.home.house, L.home.storage, L.home.well, L.home.stand, L.home.waterTower, L.home.tractor].filter(Boolean).map(px);
      for (const s of L.home.solar || []) blocks.push(px({ x: s.x, y: s.y }));
      for (const b of blocks) assert.ok(!overlap(lib, b), `pas sur un bâtiment de la maison (${tag})`);
      for (const d of L.decorSlots || []) assert.ok(!overlap(lib, d), `pas sur l'emplacement de décor ${d.id} (${tag})`);
      for (const [id, r] of Object.entries(L.valley.spots)) assert.ok(!overlap(lib, r), `pas sur l'emplacement nature ${id} (${tag})`);
      assert.ok(!overlap(lib, L.valley.box), `pas sur la boîte en fer (${tag})`);
      for (const m of Object.values(L.machineParking || {})) assert.ok(!overlap(lib, m), `pas sur une machine garée (${tag})`);
      for (let ty = lib.y / TILE; ty < (lib.y + lib.h) / TILE; ty++) for (let tx = lib.x / TILE; tx < (lib.x + lib.w) / TILE; tx++) assert.ok(!L.isPath(tx, ty), `pas sur un chemin (${tx}, ${ty}) (${tag})`);
      // Le panneau du village (lot 3) et les repères du lot 4 (mangeoire, porte-lanternes, stand de fête) s'écartent.
      const v = varietySpots(L);
      assert.ok(!overlap(lib, v.board), `pas sous le panneau du village (${tag})`);
      const cz = cozySpots(L);
      for (const k of ['feeder', 'lanternRack', 'storyWindow', 'feteStall']) if (cz[k]?.w) assert.ok(!overlap(lib, cz[k]), `pas sous ${k} (${tag})`);
      for (const h of cz.hideSpots || []) assert.ok(!overlap(lib, px({ x: h.tx ?? Math.floor(h.x / TILE), y: h.ty ?? Math.floor(h.y / TILE) })), `aucune cachette sur la Grainothèque (${tag})`);
      // Le décor (arbres, buissons) ne pousse pas dessus.
      for (const d of L.deco) assert.ok(!(d.tx >= lib.x / TILE && d.tx < (lib.x + lib.w) / TILE && d.ty >= lib.y / TILE && d.ty < (lib.y + lib.h) / TILE), `décor ${d.kind} hors de la Grainothèque (${tag})`);
    }
  }
});

test('le nichoir de la maison ne se dessine plus sous le panneau du village', () => {
  for (const storage of [1, 2, 3]) {
    const { L } = farm({ storage });
    assert.ok(!overlap(L.valley.spots['home.nest'], varietySpots(L).board), `grenier ${storage}`);
  }
});

test('nichoirs à chauves-souris : un rectangle pour chaque identifiant que valleySpots(\'batbox\') peut renvoyer', () => {
  const { g, L, ids } = farm();
  const spots = g.query.career.valleySpots('batbox');
  assert.ok(spots.length >= 3, `maison, verger, ateliers (${spots.length})`);
  for (const s of spots) {
    const r = L.valley.spots[s.spotId];
    assert.ok(r, `rectangle pour ${s.spotId}`);
    assert.equal(r.kind, 'batbox');
    assert.ok(L.valley.animalAnchors[s.spotId], `ancrage pour ${s.spotId}`);
  }
  // Verger et ateliers : jamais sur une parcelle ni sur un bâtiment.
  const plots = L.plots.filter((p) => !p.retired);
  for (const lot of [ids.orchard, ids.workshops]) {
    const r = L.valley.spots[`${lot}.bat`];
    for (const p of plots) assert.ok(!overlap(r, p), `${lot}.bat hors de la parcelle ${p.index}`);
    for (const [id, s0] of Object.entries(L.slots)) if (s0.building && s0.lotId === lot) assert.ok(!overlap(r, px(s0.building)), `${lot}.bat hors de ${id}`);
  }
});

test('dessins : niveaux 1 à 5, le panneau avant la construction, rien avant le rang 3', () => {
  assert.equal(librarySpriteName(0, false), null);
  assert.equal(librarySpriteName(0, true), 'library.site');
  assert.equal(librarySpriteName(1, true), 'library.1');
  assert.equal(librarySpriteName(3, false), 'library.3');
  assert.equal(librarySpriteName(9, true), 'library.5');
  // Planche valley2 (ART) : quand ses noms sont déclarés, ils correspondent au contrat.
  for (const n of ['library.site', 'library.1', 'library.5', 'troc.pin', 'seedpack.cross', 'fx.pollen', 'nature.batbox']) {
    if (SPRITES[n]) assert.equal(SPRITES[n].sheet, 'valley2', `${n} sur la planche valley2`);
  }
  for (const id of ['swap.basket', 'cross.sign', 'lizard.wall']) {
    assert.ok(DECOR_SPRITES[id], `${id} dans DECOR_SPRITES`);
    if (SPRITES[`decor.${id}`]) assert.ok(SPRITES[decorSprite(id)], `${id} : sprite connu`);
  }
});

test('sachet du tableau, abeille entre deux parents (mouvements réduits : point fixe), cibles du mode paire', () => {
  const pin = trocPinRect({ x: 128, y: 64, w: 32, h: 32 });
  assert.ok(pin.x >= 128 && pin.x + pin.w <= 128 + 32 + 2 && pin.y >= 64, 'sur le tableau, en haut à droite');
  assert.equal(trocPinRect(null), null);
  const a = { x: 0, y: 0 };
  const b = { x: 32, y: 0 };
  const still = beePos(a, b, 1.234, true);
  assert.deepEqual([still.x, still.still], [16, true], 'point de pollen fixe au milieu');
  assert.deepEqual(beePos(a, b, 7, true), still, 'immobile dans le temps');
  const p0 = beePos(a, b, 0, false);
  const p1 = beePos(a, b, 1.6, false);
  assert.ok(Math.abs(p0.x - 0) < 0.01 && Math.abs(p1.x - 32) < 0.01, 'aller-retour d\'une parcelle à l\'autre');
  for (let t = 0; t < 4; t += 0.1) {
    const p = beePos(a, b, t, false);
    assert.ok(p.x >= -0.01 && p.x <= 32.01 && p.y <= 0, 'reste entre les deux, au-dessus');
  }
  const L = { plotRect: (i) => (i < 3 ? { x: i * 32, y: 0, w: 32, h: 32 } : null) };
  const t = pairTargets([{ plotIndex: 0, partnerPlot: 1 }, { plotIndex: 0, partnerPlot: 1 }, { plotIndex: 2 }, { plotIndex: 7 }, null], L);
  assert.deepEqual(t.map((x) => x.plotIndex), [0, 2], 'sans doublon ni parcelle inconnue');
});

test('toucher : la Grainothèque (cible ≥ 48 px) ; en mode paire, seules les parcelles valides répondent', () => {
  const { g, L } = farm();
  const A = g.actions.career;
  const actors = createValleyActors({});
  actors.sync(g, L, { time: 1 });
  const lib = L.valley.library;
  // Avant le panneau : rien à toucher.
  if (!g.state.career.valley.site) assert.equal(actors.hitTest(lib.x + 16, lib.y + 16, 0, {}), null);
  assert.ok(A.triggerValley('site').ok);
  actors.sync(g, L, { time: 2 });
  assert.deepEqual(actors.hitTest(lib.x + 16, lib.y + 16, 0, {}), { type: 'seedLibrary' }, 'le panneau se touche');
  assert.ok(A.triggerValley('library', 2).ok);
  actors.sync(g, L, { time: 3 });
  assert.equal(actors.stats().library, 2);
  assert.deepEqual(actors.hitTest(lib.x + 2, lib.y + 30, 0, {}), { type: 'seedLibrary' });
  for (const zoom of [3, 5, 8, 12]) {
    const gr = growRect(lib, (48 * 2.625) / zoom);
    assert.ok((gr.w * zoom) / 2.625 >= 47.99 && (gr.h * zoom) / 2.625 >= 47.99, `≥ 48 px CSS au zoom ${zoom}`);
  }
  // Mode paire : un parent du pays et du village pour la carotte, des parcelles libres côte à côte.
  A.triggerValley('fix', 'bouleDOr');
  A.triggerValley('troc', 'lili');
  A.triggerValley('swap', 'lili');
  A.triggerValley('seeds', 'jauneDuDoubs', 4);
  const want = g.query.career.valleyPairPlots('carrot');
  assert.ok(want.length > 0, 'des parcelles pour la paire');
  actors.setPair('carrot');
  actors.sync(g, L, { time: 4 });
  const targets = actors.pairTargets();
  assert.deepEqual(targets.map((x) => x.plotIndex).sort((x, y) => x - y), [...new Set(want.map((x) => x.plotIndex))].sort((x, y) => x - y));
  const r0 = targets[0].rect;
  assert.deepEqual(actors.hitTest(r0.x + 4, r0.y + 4, 0, {}), { type: 'pairPlot', plotIndex: targets[0].plotIndex });
  assert.equal(actors.hitTest(lib.x + 16, lib.y + 16, 0, {}), null, 'mode paire : la Grainothèque ne répond plus');
  actors.setPair(null);
  actors.sync(g, L, { time: 5 });
  assert.equal(actors.pairTargets().length, 0);
  // Une paire semée : l'abeille relie deux parcelles côte à côte (même règle de voisinage que le cœur).
  const sown = A.sowPair(want[0].plotIndex, 'carrot');
  assert.ok(sown.ok, sown.reason);
  const links = g.query.career.valleyCrossLinks();
  assert.ok(links.length >= 1, 'un lien entre les deux parents');
  for (const lk of links) {
    const ra = L.plotRect(lk.a);
    const rb = L.plotRect(lk.b);
    const touch = (ra.x === rb.x && Math.abs(ra.y - rb.y) <= ra.h + 4) || (ra.y === rb.y && Math.abs(ra.x - rb.x) <= ra.w + 4);
    assert.ok(touch, `parcelles ${lk.a} et ${lk.b} dessinées côte à côte`);
  }
  actors.sync(g, L, { time: 6 });
  assert.ok(actors.stats().links >= 1);
});

test('sans le V2 (heritage: false) : ni Grainothèque ni sachet dans la scène', () => {
  const g = newCareer({ valley: { heritage: false } });
  setRank(g, 6);
  nextDay(g);
  if (!g.state.career.valley?.started) g.actions.career.triggerValley('start');
  const L = layoutOf(g);
  const actors = createValleyActors({});
  actors.sync(g, L, { time: 1 });
  const lib = L.valley.library;
  assert.equal(actors.hitTest(lib.x + 16, lib.y + 16, 0, {}), null);
  assert.equal(actors.stats().library, 0);
  assert.equal(actors.stats().troc, false);
});
