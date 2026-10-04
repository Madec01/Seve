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
const { defaultProgress, recordRunEnd } = await import('../src/core/progression.js');
const KEY = (k) => `une-annee-a-la-ferme.${k}`;

test('JSON invalide : valeurs par défaut', () => {
  for (const k of ['run', 'progress', 'settings', 'tutorial']) store.set(KEY(k), '{pas du json');
  assert.equal(storage.loadRun(), null);
  assert.deepEqual(storage.loadProgress(), defaultProgress());
  assert.deepEqual(storage.loadSettings(), { ...storage.DEFAULT_SETTINGS });
  assert.deepEqual(storage.loadTutorial(), { done: false, step: null });
  store.clear();
});

test('réglages : types et bornes vérifiés, vitesse inconnue ignorée', () => {
  store.set(KEY('settings'), JSON.stringify({ musicVolume: 7, sfxVolume: 'fort', muted: 'oui', speed: 3, vibration: 'non', keepAwake: false }));
  const s = storage.loadSettings();
  assert.equal(s.musicVolume, 1);
  assert.equal(s.sfxVolume, storage.DEFAULT_SETTINGS.sfxVolume);
  assert.equal(s.muted, false);
  assert.equal(s.speed, 1);
  assert.equal(s.vibration, true);
  assert.equal(s.keepAwake, false);
  store.set(KEY('settings'), JSON.stringify({ speed: 4 }));
  assert.equal(storage.loadSettings().speed, 4);
  store.clear();
});

test('progression abîmée : entrées nettoyées, niveaux verrouillés par défaut', () => {
  store.set(KEY('progress'), JSON.stringify({ levels: [1, 2, 3] }));
  assert.deepEqual(storage.loadProgress(), defaultProgress());
  store.set(KEY('progress'), JSON.stringify({ levels: { 1: { stars: 12, completed: 'yes' }, 2: null, 3: { stars: 2, bestMoney: 400, completed: true } } }));
  const p = storage.loadProgress();
  assert.deepEqual(p.levels[1], { stars: 3, bestMoney: null, completed: false, played: false });
  assert.equal(p.levels[2], undefined);
  assert.deepEqual(p.levels[3], { stars: 2, bestMoney: 400, completed: true, played: true });
  assert.equal(p.schema, 2);
  assert.equal(storage.isLevelUnlocked(2, p), false);
  assert.equal(storage.isLevelUnlocked(4, p), true);
  // Fin de partie : progression.recordRunEnd (le seul chemin de l'interface), puis enregistrement.
  const rec = recordRunEnd(p, { levelId: 1, outcome: 'victory', stars: 2, money: 300, summary: null, perksActive: false });
  assert.equal(rec.rewards.firstTime, true);
  storage.saveProgress(rec.progress);
  assert.deepEqual(storage.loadProgress().levels[1], { stars: 3, bestMoney: 300, completed: true, played: true });
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
    assert.deepEqual(storage.loadProgress(), defaultProgress());
    storage.clearRun();
    storage.resetProgress();
    assert.equal(storage.saveSettings({}), false);
  } finally {
    window.localStorage = saved;
  }
});

test('progression v1 : migrée au schéma 2, succès des anciennes parties débloqués une fois', () => {
  const levels = {};
  for (let id = 1; id <= 8; id++) levels[id] = { stars: id <= 5 ? 3 : 2, bestMoney: 500 + id, completed: true };
  store.set(KEY('progress'), JSON.stringify({ levels }));
  const p = storage.loadProgress();
  assert.equal(p.schema, 2);
  assert.deepEqual(p.levels[4], { stars: 3, bestMoney: 504, completed: true, played: true });
  assert.deepEqual(Object.keys(p.achievements).sort(), ['firstYear', 'risingStar', 'veteran'].sort());
  assert.equal(p.ecus, 10 + 20 + 30);
  assert.deepEqual(p.perks, {});
  const m = storage.progressMigration();
  assert.deepEqual(m.retroactive.sort(), ['firstYear', 'risingStar', 'veteran'].sort());
  assert.deepEqual(m.rewards, { stars: 2, ecus: 60 });
  assert.equal(storage.progressMigration(), null);
  // Enregistrée : le rechargement ne redébloque rien.
  assert.equal(JSON.parse(store.get(KEY('progress'))).schema, 2);
  const again = storage.loadProgress();
  assert.deepEqual(again, p);
  assert.equal(storage.progressMigration(), null);
  store.clear();
});

test('réglage « Sons de l\'interface » : « Doux » par défaut, valeur inconnue ignorée', () => {
  assert.equal(storage.DEFAULT_SETTINGS.uiSound, 'soft');
  assert.deepEqual([...storage.UI_SOUNDS], ['normal', 'soft', 'off']);
  for (const v of ['normal', 'soft', 'off']) {
    store.set(KEY('settings'), JSON.stringify({ uiSound: v }));
    assert.equal(storage.loadSettings().uiSound, v);
  }
  store.set(KEY('settings'), JSON.stringify({ uiSound: 'strident' }));
  assert.equal(storage.loadSettings().uiSound, 'soft');
  store.clear();
});
