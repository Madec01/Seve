// Constantes de réglage. Un seul endroit à toucher pour équilibrer le jeu.

export const TILE = 72;                 // taille logique d'une case en pixels
export const BEAT_WINDOW = 0.13;        // ±130 ms : fenêtre de Justesse
export const CHAIN_STEPS = [1, 1.5, 2, 3, 4];
export const CHAIN_GRACE_BEATS = 3;     // pulsations ratées avant retombée

export const PLAYER = {
  speed: 250,
  accel: 16,
  friction: 14,
  radius: 17,
  dashSpeed: 720,
  dashTime: 0.17,
  dashCooldown: 0.65,
  reach: 1.0,                            // en cases, autour de la case visée
};

export const GROWTH = {
  stageCount: 4,                         // graine · pousse · bourgeon · mûre
  wiltAfter: 26,                         // secondes de maturité avant flétrissure
  thirstRate: 0.035,                     // humidité perdue par seconde
  dryPenalty: 0.45,                      // facteur de croissance sur sol sec
};

export const BLIGHT = {
  spreadEveryBeats: 4,
  spreadChance: 0.34,
  damagePerSecond: 0.16,
  purifyPerAction: 0.42,
  dashDisperse: 0.22,
  loseThreshold: 0.65,
  fissureRespawnBeats: 24,
};

export const SEASON = {
  count: 3,
  beatsPerSeason: [64, 80, 96],
  baseGoal: [140, 320, 560],
  goalPerBiome: 1.0,
};

export const SCORE = {
  sapPerHarvest: 10,
  sapPerPurify: 4,
  echoValue: 60,
  seasonClearBonus: 120,
};

export const COLORS = {
  ink: '#2a2118',
  paper: '#f3e7cf',
  sap: '#f6c453',
  ash: '#6f6a63',
  good: '#8fce6a',
  bad: '#e0785e',
  ui: '#fbf3e2',
};

export const GAME_TITLE = 'SÈVE';
export const GAME_SUBTITLE = 'Le Chant des Racines';
