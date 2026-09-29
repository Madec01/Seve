// Niveaux — données pures. Un niveau = une année avec ses contraintes.
//
// Champs :
//   id, name, description          identifiant (1..8), nom et texte de la sélection de niveau
//   tutorial                       true : tutoriel guidé (niveau 1)
//   startMoney                     argent de départ
//   gridCols, gridRows             taille de la grille du champ (index = ligne × gridCols + colonne)
//   startArea {cols, rows}         bloc de parcelles ouvertes au départ (centré horizontalement, en haut)
//   unlockedPlots                  nombre de parcelles ouvertes au départ (= cols × rows du bloc)
//   maxPlots                       nombre maximal de parcelles ouvertes (achats compris)
//   plotCost {base, step}          prix des parcelles achetées : base + pas × (déjà achetées)
//   seasonLengths [4]              durée de chaque saison en jours (printemps → hiver)
//   rents [4]                      fermage payé le dernier soir de chaque saison
//   weather {saison: {type: poids}} tables de tirage de la météo
//   starThresholds [2, 3]          argent final minimal pour ★★ et ★★★
//   availableInvestments           investissements proposés dans ce niveau
//   crops                          cultures proposées (null = toutes)
//   modifiers                      contraintes du niveau :
//     waterCost        prix de chaque arrosage (manuel ou automatique)
//     rotChance        chance, à chaque aube pluvieuse, qu'une culture non récoltée pourrisse
//     priceVolatility  true : prix de vente variables chaque jour (×0,5 à ×1,8)
//     loan             null ou { payment, every } : mensualité payée à l'aube tous les `every` jours
//     soilFatigue      0, ou perte de rendement quand on replante la culture récoltée juste avant
//     noSprinkler      true : pas d'arrosage automatique

const ALL_INVESTMENTS = ['chickenCoop', 'beehive', 'roadsideStand', 'cow', 'sheep', 'sprinkler', 'solarPanel', 'guestHouse'];

const MILD_WEATHER = {
  spring: { sunny: 5, cloudy: 3, rain: 3, storm: 0.5 },
  summer: { sunny: 6, cloudy: 2, rain: 1.5, storm: 1, heatwave: 1 },
  autumn: { sunny: 4, cloudy: 4, rain: 3, storm: 1 },
  winter: { sunny: 2, cloudy: 4, rain: 1, snow: 4 },
};

const DROUGHT_WEATHER = {
  spring: { sunny: 7, cloudy: 3, rain: 0.5, heatwave: 1 },
  summer: { sunny: 4, cloudy: 1, rain: 0.2, heatwave: 5 },
  autumn: { sunny: 6, cloudy: 3, rain: 0.5, heatwave: 1 },
  winter: { sunny: 4, cloudy: 4, rain: 0.3, snow: 2 },
};

const RAINY_WEATHER = {
  spring: { sunny: 2, cloudy: 3, rain: 6, storm: 1.5 },
  summer: { sunny: 3, cloudy: 2, rain: 5, storm: 2 },
  autumn: { sunny: 1, cloudy: 3, rain: 7, storm: 2 },
  winter: { sunny: 1, cloudy: 3, rain: 4, snow: 3 },
};

const BASE_MODIFIERS = {
  waterCost: 0,
  rotChance: 0,
  priceVolatility: false,
  loan: null,
  soilFatigue: 0,
  noSprinkler: false,
};

function level(def) {
  return {
    gridCols: 6,
    gridRows: 4,
    startArea: { cols: 4, rows: 3 },
    unlockedPlots: 12,
    maxPlots: 24,
    plotCost: { base: 40, step: 10 },
    seasonLengths: [7, 7, 7, 7],
    weather: MILD_WEATHER,
    availableInvestments: ALL_INVESTMENTS,
    crops: null,
    tutorial: false,
    ...def,
    modifiers: { ...BASE_MODIFIERS, ...(def.modifiers || {}) },
  };
}

export const LEVELS = [
  level({
    id: 1,
    name: 'Première année',
    description: 'Un climat doux et un fermage modeste pour apprendre les bases : planter, arroser, récolter et préparer l\'hiver.',
    tutorial: true,
    startMoney: 100,
    rents: [60, 120, 170, 240],
    starThresholds: [500, 900],
    availableInvestments: ['chickenCoop', 'beehive', 'roadsideStand', 'sheep', 'sprinkler', 'solarPanel'],
  }),
  level({
    id: 2,
    name: 'L\'année de sécheresse',
    description: 'La pluie se fait rare et les canicules s\'enchaînent. Chaque arrosage coûte 1 pièce, même automatique.',
    startMoney: 120,
    rents: [60, 110, 150, 220],
    starThresholds: [500, 900],
    weather: DROUGHT_WEATHER,
    modifiers: { waterCost: 1 },
  }),
  level({
    id: 3,
    name: 'L\'année pluvieuse',
    description: 'Il pleut souvent, l\'arrosage se fait tout seul… mais chaque jour de pluie, une culture peut pourrir sur pied.',
    startMoney: 100,
    rents: [70, 130, 190, 260],
    starThresholds: [500, 900],
    weather: RAINY_WEATHER,
    modifiers: { rotChance: 0.05 },
  }),
  level({
    id: 4,
    name: 'Le petit lopin',
    description: 'Seulement 6 parcelles, impossible d\'agrandir. Pour tenir l\'année, il faudra miser sur les animaux.',
    startMoney: 200,
    gridCols: 3,
    gridRows: 2,
    startArea: { cols: 3, rows: 2 },
    unlockedPlots: 6,
    maxPlots: 6,
    rents: [60, 110, 160, 220],
    starThresholds: [400, 800],
  }),
  level({
    id: 5,
    name: 'L\'hiver sans fin',
    description: 'L\'hiver dure deux semaines et le fermage d\'hiver est salé. Tout se joue dans les réserves d\'automne.',
    startMoney: 100,
    seasonLengths: [7, 7, 7, 14],
    rents: [60, 120, 170, 520],
    starThresholds: [500, 900],
  }),
  level({
    id: 6,
    name: 'Le marché fou',
    description: 'Le prix de chaque légume change tous les jours, de la moitié au presque double. Vendez au bon moment !',
    startMoney: 100,
    rents: [70, 130, 200, 290],
    starThresholds: [500, 900],
    modifiers: { priceVolatility: true },
  }),
  level({
    id: 7,
    name: 'Le crédit',
    description: 'La banque vous prête 600 pièces pour bien démarrer, mais il faut rembourser 40 pièces tous les 7 jours en plus du fermage.',
    startMoney: 600,
    rents: [150, 250, 330, 420],
    starThresholds: [500, 900],
    modifiers: { loan: { payment: 40, every: 7 } },
  }),
  level({
    id: 8,
    name: 'L\'année bio',
    description: 'Pas d\'arrosage automatique, et replanter la même culture sur une parcelle réduit sa récolte de 30 % : pensez à la rotation.',
    startMoney: 100,
    rents: [70, 130, 180, 250],
    starThresholds: [500, 900],
    availableInvestments: ALL_INVESTMENTS.filter((id) => id !== 'sprinkler'),
    modifiers: { soilFatigue: 0.3, noSprinkler: true },
  }),
];

/** Accès par identifiant. */
export const LEVELS_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function getLevel(id) {
  return LEVELS_BY_ID[id] || null;
}

/** Nombre total de jours de l'année d'un niveau. */
export function yearLength(lvl) {
  return lvl.seasonLengths.reduce((a, b) => a + b, 0);
}
