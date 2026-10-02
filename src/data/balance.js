// Constantes globales d'équilibrage — données pures, aucune logique d'état.
// Les valeurs finales sont réglées avec la simulation (tools/simulate.js).

/** Durée d'un jour en secondes, à la vitesse ×1. */
export const DAY_SECONDS = 20;

/** Vitesses autorisées (0 = pause, 0.5 = vitesse douce ×½ : un jour dure 40 s). */
export const SPEEDS = [0, 0.5, 1, 2, 4];

/** Options de partie gérées par le cœur (game.setOption) et leur valeur par défaut. */
export const GAME_OPTIONS = { autoPauseDawn: false };

/** Vitesse au lancement d'une partie. */
export const DEFAULT_SPEED = 1;

/** Ordre des saisons dans l'année. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

/** Noms affichés des saisons. */
export const SEASON_NAMES = {
  spring: 'Printemps',
  summer: 'Été',
  autumn: 'Automne',
  winter: 'Hiver',
};

/** Types de météo et leurs effets de règle. */
export const WEATHER_TYPES = {
  sunny: { name: 'Ensoleillé', waters: false },
  cloudy: { name: 'Nuageux', waters: false },
  rain: { name: 'Pluie', waters: true },
  storm: { name: 'Orage', waters: true, blocksStand: true },
  heatwave: { name: 'Canicule', waters: false, noDryGrowth: true },
  snow: { name: 'Neige', waters: false },
};

/** Pousse quotidienne (en jours) selon l'arrosage de la veille. */
export const GROWTH = {
  watered: 1,
  dry: 0.5,
  /** Canicule : une parcelle non arrosée ne pousse pas du tout. */
  dryHeatwave: 0,
};

/** Charges fixes quotidiennes de la ferme (avant investissements). */
export const BASE_DAILY_CHARGE = 5;

/** Prix des parcelles à acheter : base + pas × (parcelles déjà achetées). */
export const PLOT_COST = { base: 40, step: 10 };

/** Nombre de jours avant un changement de saison où l'avertissement s'affiche. */
export const WARNING_DAYS = 2;

/** Bornes du multiplicateur de prix du marché fou. */
export const MARKET = {
  min: 0.5,
  max: 1.8,
  /** Rappel vers 1 à chaque aube (0 = marche aléatoire pure, 1 = tirage indépendant). */
  meanReversion: 0.8,
  /** Amplitude du pas aléatoire quotidien (tirage uniforme dans ±amplitude/2). */
  amplitude: 1.2,
};

/** Rendement d'une culture replantée sur la même parcelle (fatigue du sol, par défaut). */
export const DEFAULT_FATIGUE_YIELD = 0.7;

/** Petite tolérance pour comparer des durées de pousse fractionnaires. */
export const EPSILON = 1e-9;
