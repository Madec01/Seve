// Sauvegarde locale (localStorage) : partie en cours, progression, options, tutoriel.
// Chaque accès est protégé (navigation privée, stockage plein ou désactivé) : en cas d'échec,
// le jeu continue sans sauvegarde et les lectures renvoient des valeurs par défaut.

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
  panelCollapsed: null, // null = automatique selon la largeur de l'écran
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
/** { levels: { [id]: { stars, bestMoney, completed } } } */
export function loadProgress() {
  const data = read(KEYS.progress);
  const levels = {};
  const raw = data && typeof data.levels === 'object' && data.levels && !Array.isArray(data.levels) ? data.levels : {};
  for (const [id, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    levels[id] = {
      stars: Math.max(0, Math.min(3, Math.floor(Number(v.stars) || 0))),
      bestMoney: Number.isFinite(v.bestMoney) ? v.bestMoney : null,
      completed: v.completed === true,
    };
  }
  return { levels };
}

export function saveProgress(progress) {
  return write(KEYS.progress, progress);
}

/**
 * Note le résultat d'un niveau gagné. Renvoie { progress, newBest, newStars }.
 */
export function recordVictory(levelId, stars, money) {
  const progress = loadProgress();
  const prev = progress.levels[levelId] || { stars: 0, bestMoney: null, completed: false };
  const newBest = prev.bestMoney === null || money > prev.bestMoney;
  const newStars = stars > (prev.stars || 0);
  progress.levels[levelId] = {
    stars: Math.max(prev.stars || 0, stars),
    bestMoney: newBest ? money : prev.bestMoney,
    completed: true,
  };
  saveProgress(progress);
  return { progress, newBest, newStars, firstTime: !prev.completed };
}

/** Le niveau 1 est toujours ouvert ; les suivants s'ouvrent quand le précédent est terminé. */
export function isLevelUnlocked(levelId, progress = loadProgress()) {
  if (levelId <= 1) return true;
  return !!progress.levels[levelId - 1]?.completed;
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
      else if (k === 'panelCollapsed' && (data[k] === true || data[k] === false)) out[k] = data[k];
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
