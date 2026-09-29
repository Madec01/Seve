// Sauvegarde locale : valeurs abîmées ou d'un autre format → valeurs par défaut, sans exception.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.window = globalThis.window || {};
window.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const storage = await import('../src/storage.js');
const KEY = (k) => `une-annee-a-la-ferme.${k}`;

test('JSON invalide : valeurs par défaut', () => {
  for (const k of ['run', 'progress', 'settings', 'tutorial']) store.set(KEY(k), '{pas du json');
  assert.equal(storage.loadRun(), null);
  assert.deepEqual(storage.loadProgress(), { levels: {} });
  assert.deepEqual(storage.loadSettings(), { ...storage.DEFAULT_SETTINGS });
  assert.deepEqual(storage.loadTutorial(), { done: false, step: null });
  store.clear();
});

test('réglages : types et bornes vérifiés, vitesse inconnue ignorée', () => {
  store.set(KEY('settings'), JSON.stringify({ musicVolume: 7, sfxVolume: 'fort', muted: 'oui', speed: 3, panelCollapsed: true }));
  const s = storage.loadSettings();
  assert.equal(s.musicVolume, 1);
  assert.equal(s.sfxVolume, storage.DEFAULT_SETTINGS.sfxVolume);
  assert.equal(s.muted, false);
  assert.equal(s.speed, 1);
  assert.equal(s.panelCollapsed, true);
  store.set(KEY('settings'), JSON.stringify({ speed: 4 }));
  assert.equal(storage.loadSettings().speed, 4);
  store.clear();
});

test('progression abîmée : entrées nettoyées, niveaux verrouillés par défaut', () => {
  store.set(KEY('progress'), JSON.stringify({ levels: [1, 2, 3] }));
  assert.deepEqual(storage.loadProgress(), { levels: {} });
  store.set(KEY('progress'), JSON.stringify({ levels: { 1: { stars: 12, completed: 'yes' }, 2: null, 3: { stars: 2, bestMoney: 400, completed: true } } }));
  const p = storage.loadProgress();
  assert.deepEqual(p.levels[1], { stars: 3, bestMoney: null, completed: false });
  assert.equal(p.levels[2], undefined);
  assert.deepEqual(p.levels[3], { stars: 2, bestMoney: 400, completed: true });
  assert.equal(storage.isLevelUnlocked(2, p), false);
  assert.equal(storage.isLevelUnlocked(4, p), true);
  const rec = storage.recordVictory(1, 2, 300);
  assert.equal(rec.firstTime, true);
  assert.deepEqual(storage.loadProgress().levels[1], { stars: 3, bestMoney: 300, completed: true });
  store.clear();
});

test('stockage indisponible : aucune exception', () => {
  const saved = window.localStorage;
  window.localStorage = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  try {
    assert.equal(storage.saveRun({ a: 1 }), false);
    assert.equal(storage.loadRun(), null);
    assert.deepEqual(storage.loadProgress(), { levels: {} });
    storage.clearRun();
    storage.resetProgress();
    assert.equal(storage.saveSettings({}), false);
  } finally {
    window.localStorage = saved;
  }
});
