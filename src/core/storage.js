// Sauvegardes (3 emplacements) et réglages globaux, dans le localStorage.
// Toute écriture est tolérante à l'échec : un navigateur en navigation privée
// ne doit pas casser la partie en cours.

const PREFIX = 'seve.v1';
export const SLOT_COUNT = 3;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(`${PREFIX}.${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[storage] lecture impossible', key, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(`${PREFIX}.${key}`, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('[storage] écriture impossible', key, err);
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(`${PREFIX}.${key}`); } catch (err) { /* ignoré */ }
}

export const DEFAULT_SETTINGS = {
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  voices: 0.8,
  screenShake: true,
  particles: 'plein',      // 'plein' | 'sobre' | 'aucun'
  showBeatRing: true,
  reducedMotion: false,
  touchLayout: 'droitier',  // 'droitier' | 'gaucher'
  lastSlot: 0,
};

export function loadSettings() {
  return Object.assign({}, DEFAULT_SETTINGS, read('settings', {}));
}

export function saveSettings(settings) {
  return write('settings', settings);
}

export function emptySave(slot) {
  return {
    slot,
    version: 1,
    createdAt: null,
    updatedAt: null,
    playtime: 0,
    sap: 0,
    totalSap: 0,
    act: 1,
    biome: 'clairiere',
    unlockedBiomes: ['clairiere'],
    unlockedSeeds: ['I', 'II', 'III'],
    upgrades: {},
    achievements: {},
    echoes: [],
    npcMet: {},
    stats: {
      runs: 0, harvests: 0, chords: 0, bestChord: null,
      purified: 0, perfectBeats: 0, bestChain: 0, bestScore: 0,
      wilted: 0, seedsSown: 0,
    },
    tutorialDone: false,
    dailyBest: {},
  };
}

export function loadSlot(slot) {
  const data = read(`save.${slot}`, null);
  if (!data) return null;
  // Fusion défensive : une sauvegarde d'une version antérieure reste lisible.
  const base = emptySave(slot);
  return Object.assign(base, data, {
    stats: Object.assign(base.stats, data.stats || {}),
  });
}

export function saveSlot(slot, data) {
  data.slot = slot;
  data.updatedAt = Date.now();
  if (!data.createdAt) data.createdAt = data.updatedAt;
  return write(`save.${slot}`, data);
}

export function deleteSlot(slot) { remove(`save.${slot}`); }

export function listSlots() {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) out.push(loadSlot(i));
  return out;
}
