// La Vallée vivante, lot V1 (rendu) : emplacements nature de la scène (un rectangle pour chaque identifiant du cœur,
// sans chevaucher parcelles, chemins, bâtiments, ruches, emplacements de décor), boîte en fer, ancrages des bêtes,
// tuiles des haies et des bandes, chêne qui grandit, lisière fleurie, oiseaux et papillons selon l'étape, toucher (mode
// aménagement exclusif, bête qui attend agrandie pour le doigt). Purs et testés sous Node (aucun DOM).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer, setRank, nextDay } from './career-helpers.js';
import { createCareerLayout, careerValleySpots } from '../src/render/layout-career.js';
import { cozySpots } from '../src/render/cozy-actors.js';
import {
  oakStage, hedgeTileName, stripTileName, oakSpriteName, fallowSpriteName, edgeFlowersOn, birdsPerMinute, butterfliesOn, edgeTiles,
  findRect, growRect, createValleyActors,
} from '../src/render/valley-actors.js';
import { TILE, SPRITES, DECOR_SPRITES, decorSprite } from '../src/render/atlas.js';
import { NATURE_KINDS } from '../src/data/career/valley.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const px = (t) => ({ x: t.x * TILE, y: t.y * TILE, w: (t.w || 1) * TILE, h: (t.h || 1) * TILE });

/** Une grande ferme : pré (deux abris), verger, mare, cour des ateliers, champ, serre, friche ; grenier construit. */
function bigFarm() {
  const g = newCareer({ valley: true });
  setRank(g, 6);
  g.state.money = 1e7;
  nextDay(g);
  const ids = {};
  for (const t of ['meadow', 'orchard', 'pond', 'workshops', 'field', 'greenhouse', 'wild']) {
    const b = g.actions.career.buyLot();
    assert.ok(b.ok, `achat d'un terrain (${t})`);
    const id = b.lotId || g.state.career.lots[g.state.career.lots.length - 1].id;
    if (t !== 'wild') assert.ok(g.actions.career.developLot(id, t).ok, `aménagement ${t}`);
    ids[t] = id;
  }
  g.actions.career.build?.(ids.meadow, 0, 'cowshed');
  g.actions.career.build?.(ids.meadow, 1, 'sheepfold');
  g.actions.career.build?.('yard', 0, 'coop');
  g.state.career.buildings.storage = g.state.career.buildings.storage || { level: 1, lotId: 'home', slot: null };
  return { g, ids, L: createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments }) };
}

test('emplacements nature : un rectangle pour chaque identifiant que valleySpots() peut renvoyer', () => {
  const { g, L } = bigFarm();
  assert.ok(L.valley && L.valley.spots && L.valley.box && L.valley.animalAnchors);
  const all = NATURE_KINDS.flatMap((k) => g.query.career.valleySpots(k).map((s) => s.spotId));
  assert.ok(all.length >= 30, `beaucoup d'emplacements (${all.length})`);
  for (const id of all) {
    const r = L.valley.spots[id];
    assert.ok(r, `rectangle pour ${id}`);
    assert.ok(L.valley.animalAnchors[id], `ancrage pour ${id}`);
    const kind = g.query.career.valleySpots().find((s) => s.spotId === id).kind;
    assert.equal(r.kind, kind, `${id} : même genre que le cœur`);
  }
});

test('emplacements nature : jamais sur une parcelle, un chemin, un bâtiment, une ruche ni un emplacement de décor', () => {
  const { L } = bigFarm();
  const plots = L.plots.filter((p) => !p.retired);
  const buildings = [L.home.house, L.home.well, L.home.stand].map(px);
  for (const [id, s] of Object.entries(L.slots)) if (s.building && s.kind !== 'pond' && s.kind !== 'greenhouse') buildings.push({ ...px(s.building), id });
  const hives = L.hives.map((h) => px({ x: h.x, y: h.y }));
  const decor = (L.decorSlots || []).map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, id: d.id }));
  const machines = Object.values(L.machineParking || {});
  const check = (id, r) => {
    for (const p of plots) assert.ok(!overlap(r, p), `${id} ne chevauche pas la parcelle ${p.index}`);
    for (const b of buildings) assert.ok(!overlap(r, b), `${id} ne chevauche pas un bâtiment (${b.id || 'maison'})`);
    for (const h of hives) assert.ok(!overlap(r, h), `${id} ne chevauche pas une ruche`);
    for (const d of decor) assert.ok(!overlap(r, d), `${id} ne chevauche pas l'emplacement de décor ${d.id}`);
    for (const m of machines) assert.ok(!overlap(r, m), `${id} ne chevauche pas une machine garée`);
    for (let ty = r.y / TILE; ty < (r.y + r.h) / TILE; ty++) for (let tx = r.x / TILE; tx < (r.x + r.w) / TILE; tx++) assert.ok(!L.isPath(tx, ty), `${id} : pas sur un chemin (${tx}, ${ty})`);
  };
  for (const [id, r] of Object.entries(L.valley.spots)) {
    if (/\.owl$/.test(id)) {
      // Le nichoir à chouette est accroché sous le pignon du grenier : sur le bâtiment, par conception.
      assert.ok(overlap(r, px(L.home.storage)), 'nichoir à chouette sur le grenier');
      continue;
    }
    check(id, r);
  }
  check('boîte', L.valley.box);
});

test('emplacements nature : haies sur les colonnes de lisière du bloc, bande au pied de la clôture, tuiles réservées', () => {
  const { L, ids } = bigFarm();
  const lot = L.lots.find((l) => l.id === ids.field);
  const hl = L.valley.spots[`${ids.field}.hedgeL`];
  const hr = L.valley.spots[`${ids.field}.hedgeR`];
  assert.equal(hl.x, lot.rect.x, 'haie gauche en x 0 du bloc');
  assert.equal(hr.x, lot.rect.x + 13 * TILE, 'haie droite en x 13 du bloc');
  assert.equal(hl.h, 10 * TILE, 'lignes 0 à 9');
  const strip = L.valley.spots[`${ids.field}.strip`];
  const fence = L.fences.find((f) => f.field && f.rect.y * TILE === lot.rect.y);
  assert.equal(strip.y, (fence.rect.y + fence.rect.h - 1) * TILE, 'bande fleurie au pied de la clôture');
  assert.ok(strip.x + strip.w <= (lot.rect.x / TILE + 7) * TILE, 'à gauche du portail');
  // Réservation : le décor (arbres, buissons) ne pousse pas sur le nichoir de la maison ni sur la boîte.
  const tiles = new Set([L.valley.spots['home.nest'], L.valley.box].map((r) => `${r.x / TILE},${r.y / TILE}`));
  for (const d of L.deco) assert.ok(!tiles.has(`${d.tx},${d.ty}`), `décor ${d.kind} hors des emplacements réservés`);
  // Les cachettes du lot 4 évitent aussi la boîte et le nichoir.
  const cz = cozySpots(L);
  for (const h of cz.hideSpots) assert.ok(!overlap(h, L.valley.box), 'cachette hors de la boîte en fer');
  assert.ok(!overlap(cz.lanternRack, L.valley.box), 'porte-lanternes à côté de la boîte, pas dessus');
});

test('emplacements nature : sans Vallée, rien n\'est réservé (décor des fermes existantes inchangé)', () => {
  const a = newCareer({ valley: false });
  const b = newCareer({ valley: true });
  const La = createCareerLayout(a.level, { career: a.state.career, plots: a.state.plots });
  const Lb = createCareerLayout(b.level, { career: b.state.career, plots: b.state.plots });
  assert.equal(La.valley.reserved, false);
  assert.equal(Lb.valley.reserved, true);
  // Même rectangle d'emplacements dans les deux cas (positions déterministes).
  assert.deepEqual(La.valley.spots['start.hedgeL'], Lb.valley.spots['start.hedgeL']);
  assert.deepEqual(careerValleySpots({ bands: [], house: { x: 1, w: 4 }, storage: { x: 10, y: 0, w: 2 }, free: () => true, H: 0 }).spots, {});
});

test('cibles au doigt : tout emplacement, la boîte et une bête font au moins 48 px CSS une fois agrandis', () => {
  const { L } = bigFarm();
  for (const zoom of [3, 5, 8, 12]) {
    const dpr = 2.625;
    const minWorld = (48 * dpr) / zoom;
    for (const r of [...Object.values(L.valley.spots), L.valley.box]) {
      const gr = growRect(r, minWorld);
      assert.ok((gr.w * zoom) / dpr >= 47.99 && (gr.h * zoom) / dpr >= 47.99, `≥ 48 px CSS au zoom ${zoom}`);
    }
  }
});

test('tuiles : haies raccordées, bandes alternées, chêne selon son âge, jachère par saison', () => {
  assert.equal(hedgeTileName('spring', 0, 10), 'nature.hedge.spring.top');
  assert.equal(hedgeTileName('spring', 4, 10), 'nature.hedge.spring.mid');
  assert.equal(hedgeTileName('winter', 9, 10), 'nature.hedge.winter.bot');
  assert.equal(hedgeTileName('autumn', 0, 1), 'nature.hedge.autumn.mid');
  for (const s of ['spring', 'summer', 'autumn', 'winter']) {
    for (let r = 0; r < 3; r++) assert.ok(SPRITES[hedgeTileName(s, r, 3)], `sprite de haie ${s}`);
    assert.ok(SPRITES[stripTileName(s, 0)] && SPRITES[stripTileName(s, 1)], `bande fleurie ${s}`);
    assert.ok(SPRITES[oakSpriteName('adult', s)], `chêne ${s}`);
    assert.ok(SPRITES[fallowSpriteName(s)], `jachère ${s}`);
  }
  assert.equal(stripTileName('summer', 1), 'nature.strip.summer.1');
  assert.equal(oakSpriteName('sapling', 'summer'), 'nature.oak.sapling');
  assert.equal(oakSpriteName('young', 'winter'), 'nature.oak.young');
  const st = { time: { year: 1, seasonIndex: 0 }, career: { seasonLength: 7 } };
  assert.equal(oakStage(st, { at: 3 }), 'sapling');
  assert.equal(oakStage({ ...st, time: { year: 1, seasonIndex: 1 } }, { at: 3 }), 'young');
  assert.equal(oakStage({ ...st, time: { year: 1, seasonIndex: 2 } }, { at: 3 }), 'adult');
  assert.equal(oakStage({ ...st, time: { year: 2, seasonIndex: 0 } }, { at: 20 }), 'adult');
});

test('lisière et ciel selon l\'étape : fleurs (2 au printemps, 4 toute la belle saison), 0 à 5 vols par minute, papillons', () => {
  assert.equal(edgeFlowersOn(0, 'spring'), false);
  assert.equal(edgeFlowersOn(1, 'spring'), false);
  assert.equal(edgeFlowersOn(2, 'spring'), true);
  assert.equal(edgeFlowersOn(2, 'summer'), false);
  assert.equal(edgeFlowersOn(4, 'summer'), true);
  assert.equal(edgeFlowersOn(5, 'autumn'), true);
  assert.equal(edgeFlowersOn(5, 'winter'), false);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((n) => birdsPerMinute(n)), [0, 1, 2, 3, 4, 5]);
  assert.equal(birdsPerMinute(5, true), 0, 'mouvements réduits : rien ne traverse');
  assert.equal(butterfliesOn(3, 'summer'), true);
  assert.equal(butterfliesOn(2, 'summer'), false);
  assert.equal(butterfliesOn(5, 'spring'), false);
  assert.equal(butterfliesOn(5, 'summer', true), false);
  const { L } = bigFarm();
  const e1 = edgeTiles(L);
  const e2 = edgeTiles(L);
  assert.deepEqual(e1, e2, 'déterministe');
  assert.ok(e1.length > 20, `des fleurs sur la lisière (${e1.length})`);
  for (const t of e1) assert.ok(L.isForest(t.x / TILE, t.y / TILE), 'sur une tuile de forêt');
});

test('trouvaille d\'une haie : une tuile de la haie, la même pour un même identifiant', () => {
  const r = { x: 0, y: 160, w: 16, h: 160 };
  const a = findRect(r, 'h1');
  assert.deepEqual(a, findRect(r, 'h1'));
  assert.ok(a.y >= r.y && a.y + a.h <= r.y + r.h && a.x === r.x);
  assert.equal(findRect(null, 'h1'), null);
});

test('toucher : la bête qui attend, la boîte ; en mode aménagement, seulement les emplacements libres', () => {
  const { g, L } = bigFarm();
  const actors = createValleyActors({});
  g.actions.career.triggerValley('visible', 'hedgehog');
  actors.sync(g, L, { time: 1 });
  const r = actors.itemRect('wildlife', 'hedgehog');
  assert.ok(r, 'la bête a un rectangle');
  assert.deepEqual(actors.hitTest(r.x + 8, r.y + 8, 0, {}), { type: 'wildlife', id: 'hedgehog' });
  const minWorld = (48 * 2.625) / 5;
  // Un peu à côté : la cible agrandie pour le doigt la trouve encore.
  assert.equal(actors.hitTest(r.x + 8 + minWorld / 2 - 2, r.y + 8, 0, {}), null, 'hors de la bête sans agrandissement');
  assert.deepEqual(actors.hitTest(r.x + 8 + minWorld / 2 - 2, r.y + 8, 0, { minWorld }), { type: 'wildlife', id: 'hedgehog' });
  const b = L.valley.box;
  assert.deepEqual(actors.hitTest(b.x + 8, b.y + 8, 0, {}), { type: 'valleyBox' });
  actors.setPlacing('woodpile');
  actors.sync(g, L, { time: 2 });
  assert.equal(actors.hitTest(b.x + 8, b.y + 8, 0, {}), null, 'mode aménagement : la boîte ne répond plus');
  assert.equal(actors.hitTest(r.x + 8, r.y + 8, 0, {}), null, 'mode aménagement : la bête non plus');
  const free = g.query.career.valleySpots('woodpile').filter((s) => s.free);
  assert.ok(free.length > 0 && actors.placingSpots().length === free.length);
  const s = L.valley.spots[free[0].spotId];
  assert.deepEqual(actors.hitTest(s.x + 4, s.y + 4, 0, { minWorld }), { type: 'natureSpot', spotId: free[0].spotId });
  actors.setPlacing(null);
  // Sans Vallée commencée : rien.
  const g2 = newCareer({ valley: true });
  const L2 = createCareerLayout(g2.level, { career: g2.state.career, plots: g2.state.plots });
  const a2 = createValleyActors({});
  a2.sync(g2, L2, { time: 1 });
  assert.equal(a2.hitTest(L2.valley.box.x + 8, L2.valley.box.y + 8, 0, {}), null);
  assert.equal(a2.stats().enabled, false);
});

test('décors de la Vallée : semainier, nichoir peint, tilleul dans DECOR_SPRITES (planche valley1)', () => {
  for (const id of ['seed.cabinet', 'nestbox.painted', 'valley.linden']) {
    assert.ok(DECOR_SPRITES[id], `${id} dans DECOR_SPRITES`);
    assert.ok(SPRITES[decorSprite(id)], `${id} : sprite connu`);
  }
  assert.equal((SPRITES[decorSprite('valley.linden')].w || 1), 2, 'le tilleul est un grand décor (2 × 2)');
});
