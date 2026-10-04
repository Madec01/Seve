// Zones de toucher au zoom minimal (Vallée V3, reste du V2 n° 1 ; docs/VALLEE.md § 17.11.4) : toute cible isolée de la scène
// de carrière et de la vue de la vallée a une zone d'au moins 48 × 48 px CSS calculée à l'écran (Pixel 7 et 360 × 740) ;
// les parcelles prennent leur cellule ; les modes de visée posent le zoom tactile (parcelle ≥ 48 px). Fonctions pures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomBounds, touchZoom, expandHitCss, minWorldFor } from '../src/render/camera-zoom.js';
import { createCareerLayout, careerIsolatedTargets } from '../src/render/layout-career.js';
import { growRect } from '../src/render/valley-actors.js';
import { viewLayout, viewTargets } from '../src/render/valley-view.js';
import { startedCareer, nextDay } from './valley-helpers.js';

const SCREENS = [
  { name: 'Pixel 7', cssW: 412, cssH: 915, dpr: 2.625 },
  { name: '360 × 740', cssW: 360, cssH: 740, dpr: 3 },
];

/** Zoom minimal de la scène de carrière en portrait (mêmes règles que scene.js : zoom par la largeur, plafonné, bornes). */
function minZoomOf(s, layout) {
  const devW = Math.round(s.cssW * s.dpr);
  const devH = Math.round((s.cssH - 120) * s.dpr); // barre du haut et onglets
  const byWidth = Math.floor(devW / layout.essential.w);
  const byField = Math.floor(devH / (layout.fieldRect.h + 16));
  const cap = Math.max(1, Math.floor((40 * s.dpr) / 16));
  const base = Math.max(1, Math.min(byWidth, byField, cap));
  return zoomBounds({ base, bandW: devW, bandH: devH, worldW: layout.x1 - layout.x0, worldH: layout.height, career: true }).min;
}

function bigCareer() {
  const g = startedCareer({}, 6);
  g.state.money = 9e6;
  for (let k = 0; k < 20; k++) g.actions.career.buyLot();
  g.state.investments.beehive = 4;
  g.actions.career.triggerValley('stage', 5);
  nextDay(g);
  const cells = g.query.career.grid().cells.filter((c) => c.state === 'wildable');
  g.actions.career.rewild(cells[0].id, 'wood');
  return g;
}

test('zoom tactile : ⌈48 × dpr / 32⌉ (4 sur le Pixel 7, 5 en DPR 3) ; une parcelle y fait ≥ 48 px CSS', () => {
  assert.equal(touchZoom(2.625), 4);
  assert.equal(touchZoom(3), 5);
  assert.equal(touchZoom(1), 2);
  for (const d of [1, 1.5, 2, 2.625, 2.75, 3, 3.5]) {
    const z = touchZoom(d);
    assert.ok((32 * z) / d >= 48, `DPR ${d}`);
    assert.ok((32 * (z - 1)) / d < 48 || z === 1, `le plus petit (DPR ${d})`);
  }
  const r = expandHitCss({ x: 10, y: 10, w: 16, h: 16 }, 3, 2.625);
  assert.ok(Math.abs((r.w * 3) / 2.625 - 48) < 1e-9);
  assert.equal(r.x + r.w / 2, 18, 'agrandie autour de son centre');
  assert.deepEqual(expandHitCss({ x: 0, y: 0, w: 200, h: 100 }, 3, 2.625), { x: 0, y: 0, w: 200, h: 100 }, 'jamais rétrécie');
});

test('scène de carrière, zoom minimal : chaque cible isolée a une zone ≥ 48 × 48 px CSS', () => {
  const g = bigCareer();
  const L = createCareerLayout(g.level, { career: g.state.career, plots: g.state.plots, investments: g.state.investments, grid: g.query.career.grid() });
  for (const s of SCREENS) {
    const z = minZoomOf(s, L);
    assert.ok(z >= 1);
    const k = z / s.dpr;
    const m = minWorldFor(z, s.dpr);
    const list = careerIsolatedTargets(L, g.state);
    assert.ok(list.some((t) => t.kind === 'signpost') && list.some((t) => t.kind === 'lotSign') && list.some((t) => t.kind === 'wildSign') && list.some((t) => t.kind === 'wildOffer'), 'poteaux et panneaux mesurés');
    for (const t of list) {
      const g2 = expandHitCss(t.rect, z, s.dpr);
      assert.ok(g2.w * k >= 47.99 && g2.h * k >= 47.99, `${s.name} ${t.kind} ${t.id}`);
      // La zone répond bien au toucher (coin de la zone agrandie, hors de la cible elle-même).
      if (t.kind !== 'signpost') {
        const hit = L.hitTestCareer(g2.x + 0.5, g2.y + g2.h / 2, g.state, 0, m);
        assert.ok(hit, `${s.name} ${t.kind} ${t.id} : le bord de la zone répond`);
      }
    }
    // Aménagements, boîte, Grainothèque (valley-actors.growRect au même minimum).
    for (const r of [...Object.values(L.valley.spots), L.valley.box, L.valley.library].filter(Boolean)) {
      const gr = growRect(r, m);
      assert.ok(gr.w * k >= 47.99 && gr.h * k >= 47.99, `${s.name} emplacement ${JSON.stringify(r)}`);
    }
    // Modes de visée : au zoom tactile (s'il est plus grand), parcelles et emplacements ≥ 48 px CSS.
    const tz = Math.max(z, touchZoom(s.dpr));
    for (const p of L.plots.filter((x) => !x.retired)) assert.ok((p.w * tz) / s.dpr >= 48, `${s.name} parcelle ${p.index}`);
    for (const r of Object.values(L.valley.spots)) {
      const gr = growRect(r, minWorldFor(tz, s.dpr));
      assert.ok((gr.w * tz) / s.dpr >= 47.99 && (gr.h * tz) / s.dpr >= 47.99);
    }
    // Les parcelles prennent leur cellule.
    for (const p of L.plots.filter((x) => !x.retired)) {
      const c = L.plotCell(p.index);
      assert.ok(c.w >= p.w && c.h >= p.h);
    }
  }
});

test('vue de la vallée : toutes les cibles ≥ 48 px CSS (lieux ≥ 100)', () => {
  const view = {
    animals: ['kingfisher', 'crayfish', 'otter', 'heron', 'blackWoodpecker', 'roeDeer', 'salamander', 'skylark', 'hoopoe', 'littleOwl'].map((id) => ({ id, state: 'visible' })),
    mushrooms: [0, 1, 2].map((spot) => ({ id: `m${spot}`, kind: 'cep', spot })),
    river: { step: 3 },
    joseph: true,
  };
  for (const s of SCREENS) {
    const L = viewLayout({ ...s, insetTop: 34, insetBottom: 76 });
    const k = L.zoom / L.dpr;
    for (const t of viewTargets(L, view)) {
      assert.ok(t.rect.w * k >= 47.99 && t.rect.h * k >= 47.99, `${s.name} ${JSON.stringify(t.hit)}`);
      if (t.hit.type === 'place' && t.rect.w > 40) assert.ok(Math.min(t.rect.w, t.rect.h) * k >= 100, `${s.name} ${t.hit.id}`);
    }
  }
});
