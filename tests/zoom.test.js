// Zoom de la scène (src/render/camera-zoom.js) : bornes, crans entiers, pincement, conversion écran ↔ monde,
// préférence enregistrée, couche fixe indépendante du zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zoomBounds, clampZoom, snapZoom, stepZoom, pinchZoom, anchorScroll, zoomRatio, zoomFromRatio, staticRegion,
} from '../src/render/camera-zoom.js';

// Téléphone de référence (Pixel 7) : bande ≈ 1081 × 1900 px réels, zoom par défaut 5, monde des niveaux 256 × 800.
const PHONE = { base: 5, bandW: 1081, bandH: 1900, worldW: 256, worldH: 800 };

test('zoom : bornes du téléphone de référence (niveaux et carrière)', () => {
  const b = zoomBounds(PHONE);
  assert.deepEqual(b, { min: 2, max: 12, base: 5 }); // toute la ferme visible à ×2 ; ×2,4 au plus
  const c = zoomBounds({ ...PHONE, worldW: 1120, worldH: 2250, career: true });
  assert.equal(c.min, 3); // la carrière est immense : on ne descend pas sous la moitié du défaut
  assert.equal(c.max, 12);
  // Le défaut est toujours permis, et on peut toujours zoomer d'au moins un cran.
  for (const base of [1, 2, 3, 4, 5, 7]) {
    const bb = zoomBounds({ ...PHONE, base });
    assert.ok(bb.min <= base && base < bb.max, `base ${base}`);
    assert.ok(bb.min >= 1);
  }
});

test('zoom : le défaut garde « toute la ferme visible » si elle tient déjà', () => {
  const b = zoomBounds({ base: 3, bandW: 2000, bandH: 2000, worldW: 256, worldH: 400 });
  assert.equal(b.min, 3); // on ne dézoome pas en dessous de ce qui montre déjà tout (min ≤ base)
});

test('zoom : crans entiers et bornes', () => {
  const b = zoomBounds(PHONE);
  assert.equal(snapZoom(6.4, b), 6);
  assert.equal(snapZoom(6.6, b), 7);
  assert.equal(snapZoom(40, b), 12);
  assert.equal(snapZoom(0.2, b), 2);
  assert.equal(snapZoom(Number.NaN, b), 5);
  assert.equal(stepZoom(5, 1, b), 6);
  assert.equal(stepZoom(5, -1, b), 4);
  assert.equal(stepZoom(5.4, 1, b), 6); // depuis un zoom fractionnaire : l'entier suivant
  assert.equal(stepZoom(5.4, -1, b), 5);
  assert.equal(stepZoom(12, 1, b), 12);
  assert.equal(stepZoom(2, -1, b), 2);
  assert.equal(clampZoom(7.5, b), 7.5);
});

test('zoom : pincement proportionnel à l\'écart des doigts, élastique aux bornes', () => {
  const b = zoomBounds(PHONE);
  assert.equal(pinchZoom(5, 100, 160, b), 8);
  assert.equal(pinchZoom(5, 100, 50, b), 2.5);
  const over = pinchZoom(5, 100, 1000, b);
  assert.ok(over > 12 && over <= 12 * 1.05);
  const under = pinchZoom(5, 100, 10, b);
  assert.ok(under < 2 && under >= 2 * 0.95);
  assert.equal(snapZoom(over, b), 12);
  assert.equal(snapZoom(under, b), 2);
});

test('zoom : le point du monde sous les doigts reste sous les doigts (écran ↔ monde)', () => {
  // Mêmes formules que scene.js : écran = base − défilement + monde × zoom ; défilement = anchorScroll(…).
  const baseX = 120;
  for (const zoom of [2, 5, 7.3, 12]) {
    const wx = 137.25;
    const sx = 640;
    const scroll = anchorScroll(baseX, zoom, wx, sx);
    const screen = baseX - scroll + wx * zoom;
    assert.ok(Math.abs(screen - sx) < 1e-9, `zoom ${zoom}`);
    const back = (sx - baseX + scroll) / zoom; // screenToWorld
    assert.ok(Math.abs(back - wx) < 1e-9);
  }
});

test('zoom : préférence enregistrée en rapport au défaut (indépendante de l\'écran)', () => {
  const b = zoomBounds(PHONE);
  assert.equal(zoomRatio(5, 5), null);
  assert.equal(zoomRatio(null, 5), null);
  assert.equal(zoomRatio(8, 5), 1.6);
  assert.equal(zoomFromRatio(1.6, b), 8);
  assert.equal(zoomFromRatio(null, b), null);
  assert.equal(zoomFromRatio(1, b), null);
  assert.equal(zoomFromRatio('n\'importe quoi', b), null);
  assert.equal(zoomFromRatio(-2, b), null);
  assert.equal(zoomFromRatio(99, b), 12); // borné
  // Petit téléphone (défaut 4) : le même rapport donne un zoom proche, borné.
  const small = zoomBounds({ base: 4, bandW: 945, bandH: 1500, worldW: 256, worldH: 800 });
  assert.equal(zoomFromRatio(1.6, small), 6);
});

test('zoom : la couche fixe couvre l\'écran pour tout zoom permis et tout défilement', () => {
  const devW = 1081;
  const devH = 2402;
  const bandCx = devW / 2;
  const worldX0 = -224;
  const worldX1 = 448;
  const worldH = 1200;
  const b = zoomBounds({ base: 5, bandW: devW, bandH: 1900, worldW: worldX1 - worldX0, worldH, career: true });
  const reg = staticRegion({ worldX0, worldX1, worldH, minZoom: b.min, devW, devH, bandCx });
  // Elle ne dépend pas du zoom courant : la même pour tous.
  for (let z = b.min * 0.95; z <= b.max * 1.05; z += 0.25) {
    // Vue centrée n'importe où dans le monde (les bornes du défilement gardent le centre dans la ferme).
    for (const cx of [worldX0, 0, worldX1]) {
      for (const cy of [0, worldH / 2, worldH]) {
        const left = cx - bandCx / z;
        const right = cx + (devW - bandCx) / z;
        const top = cy - devH / z;
        const bottom = cy + devH / z;
        assert.ok(left >= reg.x0 && right <= reg.x0 + reg.w, `x à ×${z.toFixed(2)}`);
        assert.ok(top >= reg.y0 && bottom <= reg.y0 + reg.h, `y à ×${z.toFixed(2)}`);
      }
    }
  }
});
