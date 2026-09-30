// Sauvegarde locale (localStorage) : partie en cours, progression, options, tutoriel.
// Chaque accès est protégé (navigation privée, stockage plein ou désactivé) : en cas d'échec,
// le jeu continue sans sauvegarde et les lectures renvoient des valeurs par défaut.

import { PROGRESS_SCHEMA, isLevelUnlocked as isUnlocked, migrateProgress, normalizeProgress } from './core/progression.js';

const PREFIX = 'une-annee-a-la-ferme.';
const KEYS = {
  run: `${PREFIX}run`,
  progress: `${PREFIX}progress`,
  settings: `${PREFIX}settings`,
  tutorial: `${PREFIX}tutorial`,
};

export const DEFAULT_SETTINGS = Object.freeze({
  musicVolume: 0.6,
  sfxVolume: 0.8,
  ambienceVolume: 0.6,
  muted: false,
  speed: 1, // vitesse préférée à la reprise
  reducedMotion: false,
  vibration: true, // petite vibration au toucher (téléphone)
  keepAwake: true, // garder l'écran allumé pendant la partie (Wake Lock)
});

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* stockage indisponible : rien à faire */
  }
}

// ── Partie en cours ──────────────────────────────────────────────────────────────────
/** Enregistre une partie (objet issu de game.serialize()), avec des métadonnées pour le menu. */
export function saveRun(serialized, meta = {}) {
  if (!serialized) return false;
  return write(KEYS.run, { savedAt: Date.now(), meta, state: serialized });
}

/** { savedAt, meta, state } ou null. */
export function loadRun() {
  const data = read(KEYS.run);
  if (!data || typeof data !== 'object' || !data.state) return null;
  return data;
}

export function clearRun() {
  remove(KEYS.run);
}

// ── Progression ──────────────────────────────────────────────────────────────────────
// Schéma 2 (v3) : voir src/core/progression.js (pur). Une progression v1 ({ levels }) est lue,
// complétée, et les succès déjà mérités par les anciennes parties sont débloqués d'un coup au
// premier chargement (écus et étoiles compris) ; progressMigration() dit lesquels (une seule fois).

let lastMigration = null;

/** Progression complète (schéma 2), jamais d'exception. */
export function loadProgress() {
  const raw = read(KEYS.progress);
  if (raw && typeof raw === 'object' && raw.schema !== PROGRESS_SCHEMA) {
    const res = migrateProgress(raw);
    if (res.retroactive.length) lastMigration = { retroactive: res.retroactive, rewards: res.rewards };
    write(KEYS.progress, res.progress);
    return res.progress;
  }
  return normalizeProgress(raw);
}

/**
 * Succès débloqués par la migration d'une progression v1 (« 3 succès débloqués grâce à vos
 * anciennes parties ») : { retroactive: [id], rewards: { stars, ecus } } une seule fois, puis null.
 */
export function progressMigration() {
  const m = lastMigration;
  lastMigration = null;
  return m;
}

export function saveProgress(progress) {
  return write(KEYS.progress, progress);
}

/** Le niveau 1 est toujours ouvert ; les suivants s'ouvrent quand le précédent est terminé. */
export function isLevelUnlocked(levelId, progress = loadProgress()) {
  return isUnlocked(progress, levelId);
}

export function resetProgress() {
  remove(KEYS.progress);
  remove(KEYS.tutorial);
  remove(KEYS.run);
}

// ── Options ──────────────────────────────────────────────────────────────────────────
export function loadSettings() {
  const data = read(KEYS.settings);
  const out = { ...DEFAULT_SETTINGS };
  if (data && typeof data === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (data[k] !== undefined && typeof data[k] === typeof DEFAULT_SETTINGS[k]) out[k] = data[k];
    }
  }
  for (const k of ['musicVolume', 'sfxVolume', 'ambienceVolume']) out[k] = Math.min(1, Math.max(0, Number(out[k]) || 0));
  if (![1, 2, 4].includes(out.speed)) out.speed = DEFAULT_SETTINGS.speed;
  return out;
}

export function saveSettings(settings) {
  return write(KEYS.settings, settings);
}

// ── Tutoriel ─────────────────────────────────────────────────────────────────────────
/** { done: bool, step: number|null } */
export function loadTutorial() {
  const data = read(KEYS.tutorial);
  return { done: !!data?.done, step: Number.isInteger(data?.step) ? data.step : null };
}

export function saveTutorial(tutorial) {
  return write(KEYS.tutorial, { done: !!tutorial.done, step: tutorial.step ?? null });
}
