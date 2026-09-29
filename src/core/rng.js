// Générateur pseudo-aléatoire à graine, sérialisable (mulberry32).
// L'état du générateur est un simple entier 32 bits non signé, rangé dans l'état du jeu :
// une partie reprise depuis une sauvegarde tire exactement les mêmes nombres.
//
// Le jeu utilise plusieurs « flux » indépendants (météo, marché, maladie) pour que la météo
// d'une graine donnée ne dépende pas des actions du joueur.

/** Mélange une graine quelconque (nombre ou texte) en entier 32 bits non signé. */
export function hashSeed(seed, salt = '') {
  const text = `${seed}|${salt}`;
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Évite l'état 0 (valide pour mulberry32, mais on préfère une graine « active »).
  return h === 0 ? 0x9e3779b9 : h;
}

/**
 * Tire un flottant dans [0, 1) et fait avancer l'état.
 * @param {object} holder objet contenant l'état
 * @param {string} key    clé de l'état dans `holder`
 */
export function nextFloat(holder, key) {
  let a = (holder[key] + 0x6d2b79f5) >>> 0;
  holder[key] = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Crée un accès pratique à un flux stocké dans `holder[key]`.
 * L'objet renvoyé ne contient aucun état propre : tout vit dans `holder`.
 */
export function stream(holder, key) {
  return {
    float: () => nextFloat(holder, key),
    /** Entier dans [min, max] (bornes incluses). */
    int: (min, max) => min + Math.floor(nextFloat(holder, key) * (max - min + 1)),
    /** Vrai avec la probabilité p. */
    chance: (p) => nextFloat(holder, key) < p,
    /** Flottant uniforme dans [min, max). */
    range: (min, max) => min + nextFloat(holder, key) * (max - min),
    /** Tire une clé selon des poids { clé: poids }. Ordre des clés = ordre d'insertion. */
    weighted: (weights) => weightedPick(weights, nextFloat(holder, key)),
  };
}

/** Choisit une clé d'après ses poids et un tirage u dans [0, 1). */
export function weightedPick(weights, u) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (entries.length === 0) throw new Error('Table de tirage vide');
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = u * total;
  for (const [k, w] of entries) {
    if (x < w) return k;
    x -= w;
  }
  return entries[entries.length - 1][0];
}

/** Crée l'état initial des flux à partir d'une graine. */
export function createRngState(seed) {
  return {
    weather: hashSeed(seed, 'weather'),
    market: hashSeed(seed, 'market'),
    rot: hashSeed(seed, 'rot'),
  };
}
