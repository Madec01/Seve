// Sons doux de l'interface (src/audio/ui-sounds.js) : feutrés (presque rien au-dessus de 4 kHz), sans claquement,
// sans saturation, et nettement plus bas que les sons du jeu (retour joueur : « swiiip » aigus soûlants).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOFT_UI, UI_SOUND_MODES, UI_SOUND_NAMES, renderUiSound, rmsPeakWindow } from '../src/audio/ui-sounds.js';

const SR = 48000;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cr = Math.cos(ang * k);
        const ci = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - br;
        im[b] = im[a] - bi;
        re[a] += br;
        im[a] += bi;
      }
    }
  }
}

/** Part de l'énergie au-dessus de f (Hz), sur tout le son (une seule FFT, zéros en complément). */
function shareAbove(x, f) {
  let n = 1;
  while (n < x.length) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(x);
  fft(re, im);
  let tot = 0;
  let hi = 0;
  for (let k = 1; k < n / 2; k++) {
    const p = re[k] * re[k] + im[k] * im[k];
    tot += p;
    if ((k * SR) / n > f) hi += p;
  }
  return hi / tot;
}

const db = (v) => 20 * Math.log10(v);

test('catalogue : 9 sons d\'interface, 3 modes, survol muet en mode « Doux »', () => {
  assert.deepEqual([...UI_SOUND_MODES], ['normal', 'soft', 'off']);
  assert.equal(UI_SOUND_NAMES.length, 9);
  for (const n of UI_SOUND_NAMES) assert.ok(n in SOFT_UI, n);
  assert.equal(renderUiSound('hover', SR), null);
  assert.equal(renderUiSound('inconnu', SR), null);
});

for (const name of UI_SOUND_NAMES.filter((n) => SOFT_UI[n])) {
  test(`son doux « ${name} » : feutré, court, sans claquement ni saturation, bien plus bas que le jeu`, () => {
    const x = renderUiSound(name, SR);
    assert.ok(x instanceof Float32Array && x.length > 0);
    assert.ok(x.length / SR <= 0.5, 'court');
    let peak = 0;
    for (const v of x) peak = Math.max(peak, Math.abs(v));
    assert.ok(peak < 0.25, `crête ${db(peak).toFixed(1)} dB : aucune saturation`);
    // Attaque arrondie : le premier ms reste sous 20 % de la crête ; début et fin à zéro.
    let early = 0;
    for (let i = 0; i < SR * 0.001; i++) early = Math.max(early, Math.abs(x[i]));
    assert.ok(early < peak * 0.2, `attaque claquante (${(early / peak).toFixed(2)})`);
    assert.equal(x[0], 0);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-6);
    // Spectre : presque rien au-dessus de 4 kHz, très peu au-dessus de 3 kHz.
    assert.ok(shareAbove(x, 4000) < 0.005, `> 4 kHz : ${(shareAbove(x, 4000) * 100).toFixed(2)} %`);
    assert.ok(shareAbove(x, 3000) < 0.02, `> 3 kHz : ${(shareAbove(x, 3000) * 100).toFixed(2)} %`);
    // Niveau calé, au moins 9 dB sous la récolte (≈ −19 dB, même mesure).
    const level = db(rmsPeakWindow(x, SR));
    assert.ok(Math.abs(level - SOFT_UI[name].level) < 0.5, `niveau ${level.toFixed(1)} dB`);
    assert.ok(level <= -28, `niveau ${level.toFixed(1)} dB`);
  });
}

test('ouverture / fermeture des fiches : les plus discrètes ; même rendu à chaque appel (graine fixe)', () => {
  for (const n of ['open', 'close']) {
    assert.ok(SOFT_UI[n].level <= SOFT_UI.page.level && SOFT_UI.page.level < SOFT_UI.click.level, n);
    assert.deepEqual(renderUiSound(n, SR), renderUiSound(n, SR));
  }
  // Autre fréquence d'échantillonnage (téléphones à 44,1 kHz) : même durée.
  assert.equal(renderUiSound('click', 44100).length, Math.ceil(SOFT_UI.click.dur * 44100));
});
