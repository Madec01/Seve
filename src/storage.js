// Sauvegarde locale (localStorage) : partie en cours, carrière, progression, options, tutoriel.
// Chaque accès est protégé (navigation privée, stockage plein ou désactivé) : en cas d'échec,
// le jeu continue sans sauvegarde et les lectures renvoient des valeurs par défaut.

import { PROGRESS_SCHEMA, albumRetro, archiveCareer, isLevelUnlocked as isUnlocked, migrateProgress, normalizeProgress } from './core/progression.js';
import { CAREER_SCHEMA, checkCareerState, migrateCareer } from './core/career/save.js';

const PREFIX = 'une-annee-a-la-ferme.';
const KEYS = {
  run: `${PREFIX}run`,
  progress: `${PREFIX}progress`,
  settings: `${PREFIX}settings`,
  tutorial: `${PREFIX}tutorial`,
  career: `${PREFIX}career`,
  careerBak: `${PREFIX}career.bak`,
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
  // ── Accessibilité (src/ui/a11y.js, section « Accessibilité » des options) ──
  textScale: 1, // taille du texte : 1 · 1,15 · 1,3 · 1,5 (toute l'interface en rem)
  readableFont: false, // police très lisible (Atkinson Hyperlegible) au lieu de la police pixel
  pauseOnSheet: 'auto', // pause pendant la lecture d'une fiche : 'auto' (oui en Détente) · 'on' · 'off'
  slowSpeed: false, // la vitesse ×½ entre dans le cycle du bouton de vitesse
  autoPauseDawn: false, // pause au début de chaque journée
  plotHints: true, // repères sur les parcelles (à arroser, pousses) : scene.setPlotHints
  controlsBottom: false, // bouton de vitesse en bas (dans la barre d'onglets), à portée de pouce
  leftHanded: false, // disposition miroir : bouton de vitesse à gauche
  highContrast: false, // contrastes renforcés (contours, fonds, couleurs d'état)
  pinchZoom: true, // zoom de la page à deux doigts (barres et fiches ; la scène garde ses gestes)
  a11yOffered: false, // les réglages d'accessibilité ont été proposés au premier lancement
});

export const TEXT_SCALES = Object.freeze([1, 1.15, 1.3, 1.5]);
export const SPEED_SETTINGS = Object.freeze([0.5, 1, 2, 4]);

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

// ── Carrière (une seule à la fois) ───────────────────────────────────────────────────
// Clé « une-annee-a-la-ferme.career » : { schema: 1, savedAt, meta, state } (state = game.serialize() d'une
// carrière ; meta = { farmName, year, seasonId, day, rank, difficulty, patrimony, … } pour le menu).
// Copie de secours « …career.bak » : avant d'écrire une nouvelle sauvegarde, la précédente est recopiée
// dans la copie de secours si elle se relit correctement (migrateCareer + checkCareerState) et si elle
// date d'un autre jour de jeu que la copie actuelle (au plus une fois par jour de jeu).

/** true si une enveloppe de carrière lue se relit comme une carrière valide. */
function readableCareer(entry) {
  if (!entry || typeof entry !== 'object' || !entry.state) return false;
  try {
    return checkCareerState(migrateCareer(entry.state)) === null;
  } catch {
    return false;
  }
}

function gameDayOf(entry) {
  const t = entry?.state?.time;
  return t ? `${t.year}/${t.day}` : null;
}

/** Enregistre la carrière (objet issu de game.serialize()), avec ses métadonnées pour le menu. */
export function saveCareer(serialized, meta = {}) {
  if (!serialized) return false;
  const prev = read(KEYS.career);
  if (readableCareer(prev)) {
    const bak = read(KEYS.careerBak);
    if (!bak || gameDayOf(bak) !== gameDayOf(prev)) write(KEYS.careerBak, prev);
  }
  return write(KEYS.career, { schema: CAREER_SCHEMA, savedAt: Date.now(), meta, state: serialized });
}

function readCareerKey(key) {
  const data = read(key);
  if (!data || typeof data !== 'object' || !data.state || typeof data.state !== 'object') return null;
  return { state: data.state, meta: data.meta && typeof data.meta === 'object' ? data.meta : null, savedAt: data.savedAt ?? null, schema: data.schema ?? null };
}

/** { state, meta, savedAt, schema } ou null (lecture seule : la validation est faite par loadCareer du cœur). */
export function loadCareer() {
  return readCareerKey(KEYS.career);
}

/** Copie de secours (« Reprendre la sauvegarde de secours (hier) ») : même forme, ou null. */
export function loadCareerBackup() {
  return readCareerKey(KEYS.careerBak);
}

/** Métadonnées de la carrière pour le menu (sans charger la partie), ou null. */
export function careerMeta() {
  return loadCareer()?.meta ?? null;
}

/**
 * Efface la carrière (et sa copie de secours). Avec `archive` ({ farmName, years, rank, patrimony, endedBy }),
 * l'ajoute d'abord à progress.career.archive (progression enregistrée).
 */
export function clearCareer({ archive = null } = {}) {
  if (archive) saveProgress(archiveCareer(loadProgress(), archive));
  remove(KEYS.career);
  remove(KEYS.careerBak);
}

// ── Progression ──────────────────────────────────────────────────────────────────────
// Schéma 2 (v3) : voir src/core/progression.js (pur). Une progression v1 ({ levels }) est lue,
// complétée, et les succès déjà mérités par les anciennes parties sont débloqués d'un coup au
// premier chargement (écus et étoiles compris) ; progressMigration() dit lesquels (une seule fois).

let lastMigration = null;
let lastAlbumMigration = null;

/** Progression complète (schéma 2), jamais d'exception. */
export function loadProgress() {
  const raw = read(KEYS.progress);
  let progress;
  let changed = false;
  if (raw && typeof raw === 'object' && raw.schema !== PROGRESS_SCHEMA) {
    const res = migrateProgress(raw);
    if (res.retroactive.length) lastMigration = { retroactive: res.retroactive, rewards: res.rewards };
    progress = res.progress;
    changed = true;
  } else progress = normalizeProgress(raw);
  // (lot 4) Premier démarrage avec l'album : les cases que la progression et les sauvegardes (partie de niveau, carrière ;
  // lues sans être modifiées) prouvent déjà sont trouvées d'un coup, une seule fois (albumMigration()).
  if (!progress.album.retroDone) {
    if (!raw || typeof raw !== 'object') {
      progress.album.retroDone = true; // nouvelle progression : rien à retrouver
    } else {
      const run = loadRun();
      const career = loadCareer();
      const res = albumRetro(progress, { levelSave: run?.state ?? null, careerSave: career?.state ?? null });
      progress = res.progress;
      if (res.cases.length) lastAlbumMigration = { cases: res.cases };
      changed = true;
    }
  }
  if (changed) write(KEYS.progress, progress);
  return progress;
}

/**
 * (lot 4) Cases de l'album retrouvées dans les anciennes parties au premier démarrage avec l'album
 * (« 23 cases de l'album retrouvées dans vos anciennes parties ») : { cases: [caseId] } une seule fois, puis null.
 */
export function albumMigration() {
  const m = lastAlbumMigration;
  lastAlbumMigration = null;
  return m;
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

/** « Effacer la progression » : progression, tutoriel, partie en cours ET carrière (avec sa copie de secours). */
export function resetProgress() {
  remove(KEYS.progress);
  remove(KEYS.tutorial);
  remove(KEYS.run);
  remove(KEYS.career);
  remove(KEYS.careerBak);
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
  if (!SPEED_SETTINGS.includes(out.speed)) out.speed = DEFAULT_SETTINGS.speed;
  if (!TEXT_SCALES.includes(out.textScale)) out.textScale = DEFAULT_SETTINGS.textScale;
  if (!['auto', 'on', 'off'].includes(out.pauseOnSheet)) out.pauseOnSheet = DEFAULT_SETTINGS.pauseOnSheet;
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
