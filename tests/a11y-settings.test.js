// Réglages d'accessibilité (src/storage.js) et cycle du bouton de vitesse (src/ui/a11y.js, partie pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Stockage simulé (partagé avec tests/storage.test.js quand tout le dossier tourne dans un processus).
globalThis.window = globalThis.window || {};
if (!window.localStorage) {
  const mem = new Map();
  window.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
}
const store = { set: (k, v) => window.localStorage.setItem(k, v), clear: () => window.localStorage.removeItem(KEY) };
const KEY = 'une-annee-a-la-ferme.settings';
const storage = await import('../src/storage.js');
const { nextSpeed, speedCycle, speedText, slowSpeedSupported } = await import('../src/ui/a11y.js');

test('réglages d\'accessibilité : défauts', () => {
  store.clear();
  const s = storage.loadSettings();
  assert.equal(s.textScale, 1);
  assert.equal(s.pauseOnSheet, 'auto');
  assert.equal(s.readableFont, false);
  assert.equal(s.plotHints, true);
  assert.equal(s.pinchZoom, true);
  assert.equal(s.a11yOffered, false);
});

test('réglages d\'accessibilité : valeurs inconnues ramenées aux défauts', () => {
  store.set(KEY, JSON.stringify({ textScale: 2, pauseOnSheet: 'parfois', highContrast: 'oui', speed: 0.5 }));
  const s = storage.loadSettings();
  assert.equal(s.textScale, 1);
  assert.equal(s.pauseOnSheet, 'auto');
  assert.equal(s.highContrast, false);
  assert.equal(s.speed, 0.5); // vitesse lente mémorisée
  store.set(KEY, JSON.stringify({ textScale: 1.3, pauseOnSheet: 'off' }));
  assert.equal(storage.loadSettings().textScale, 1.3);
  assert.equal(storage.loadSettings().pauseOnSheet, 'off');
  store.clear();
});

test('bouton de vitesse : cycle avec et sans la vitesse lente', () => {
  assert.deepEqual(speedCycle({ slowSpeed: false }), [1, 2, 4]);
  assert.equal(nextSpeed(0, {}), 1);
  assert.equal(nextSpeed(1, {}), 2);
  assert.equal(nextSpeed(4, {}), 0);
  assert.equal(nextSpeed(0.5, {}), 1); // ×½ alors que l'option est coupée
  if (slowSpeedSupported()) {
    const s = { slowSpeed: true };
    assert.deepEqual(speedCycle(s), [0.5, 1, 2, 4]);
    assert.equal(nextSpeed(0, s), 0.5);
    assert.equal(nextSpeed(0.5, s), 1);
    assert.equal(nextSpeed(4, s), 0);
  }
  assert.equal(speedText(0.5), '×½');
  assert.equal(speedText(2), '×2');
});
