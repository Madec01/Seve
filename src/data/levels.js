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
//   crops                          cultures proposées (liste explicite ; niveaux 1 à 8 : BASE_CROPS)
//   startTrees                     (v3) index des parcelles portant un pommier ADULTE au départ
//   contest                        (v3) null, ou concours { deadlineDay, prizePerGoal, bonusAll, goals } (src/core/contest.js)
//   seedMerchant                   (v3) true : le bonus « Semencier » y ajoute les nouvelles cultures (niveaux 1 à 8 ;
//                                  les niveaux 9 à 12 ont leur propre liste)
//   modifiers                      contraintes du niveau :
//     waterCost        prix de chaque arrosage (manuel ou automatique)
//     rotChance        chance, à chaque aube pluvieuse, qu'une culture non récoltée pourrisse
//     priceVolatility  true : prix de vente variables chaque jour (×0,5 à ×1,8)
//     loan             null ou { payment, every, first } : mensualité payée à l'aube du jour `first`,
//                      puis tous les `every` jours (first vaut every + 1 par défaut)
//     soilFatigue      0, ou perte de rendement quand on replante la culture récoltée juste avant
//     noSprinkler      true : pas d'arrosage automatique
//     rawPriceFactor   (v3) multiplicateur du prix de vente BRUT des récoltes (pas des produits transformés)
//     pollination      (v3) true : sans aucune ruche, une récolte de pommes a un rendement de 0,5
//   difficulty, dailyCharge, cropPriceFactor, dryGrowth, dryHeatwaveGrowth, neighbourLoan
//                                  nombres du mode de difficulté : ici ceux du mode « classique » ; le mode
//                                  « détente » (défaut) les remplace, avec startMoney, rents et starThresholds :
//                                  utiliser levelFor(id, difficulté) de src/data/difficulty.js
//
// Règle d'or v3 : les niveaux 1 à 8 ne changent pas (les défauts ci-dessous les laissent identiques).

import { BASE_DAILY_CHARGE, GROWTH } from './balance.js';
import { BASE_CROPS, CROPS, NEW_CROPS } from './crops.js';

const ALL_INVESTMENTS = ['chickenCoop', 'beehive', 'roadsideStand', 'cow', 'sheep', 'sprinkler', 'solarPanel', 'guestHouse'];
const ALL_CROPS = CROPS.map((c) => c.id);

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

// Météo de montagne (niveau 11) : pas de canicule, neige fréquente.
const MOUNTAIN_WEATHER = {
  spring: { sunny: 4, cloudy: 3, rain: 3, snow: 1 },
  summer: { sunny: 5, cloudy: 3, rain: 2, storm: 1 },
  autumn: { sunny: 3, cloudy: 4, rain: 3, storm: 1, snow: 1 },
  winter: { sunny: 2, cloudy: 3, snow: 6 },
};

const BASE_MODIFIERS = {
  waterCost: 0,
  rotChance: 0,
  priceVolatility: false,
  loan: null,
  soilFatigue: 0,
  noSprinkler: false,
  rawPriceFactor: 1,
  pollination: false,
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
    crops: BASE_CROPS,
    startTrees: [],
    contest: null,
    seedMerchant: true,
    tutorial: false,
    // Nombres du mode « classique » (les autres modes les remplacent : src/data/difficulty.js, levelFor).
    difficulty: 'classique',
    dailyCharge: BASE_DAILY_CHARGE,
    cropPriceFactor: 1,
    dryGrowth: GROWTH.dry,
    dryHeatwaveGrowth: GROWTH.dryHeatwave,
    neighbourLoan: null,
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
    starThresholds: [250, 430],
    weather: DROUGHT_WEATHER,
    modifiers: { waterCost: 1 },
  }),
  level({
    id: 3,
    name: 'L\'année pluvieuse',
    description: 'Il pleut souvent, l\'arrosage se fait tout seul… mais chaque jour de pluie, une culture peut pourrir sur pied.',
    startMoney: 100,
    rents: [70, 90, 190, 300],
    starThresholds: [280, 480],
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
    starThresholds: [220, 370],
  }),
  level({
    id: 5,
    name: 'L\'hiver sans fin',
    description: 'L\'hiver dure deux semaines et le fermage d\'hiver est salé. Tout se joue dans les réserves d\'automne.',
    startMoney: 100,
    seasonLengths: [7, 7, 7, 14],
    rents: [80, 150, 250, 900],
    starThresholds: [160, 260],
  }),
  level({
    id: 6,
    name: 'Le marché fou',
    description: 'Le prix de chaque culture change tous les jours, de la moitié à presque le double. Vendez au bon moment !',
    startMoney: 100,
    rents: [70, 130, 230, 540],
    starThresholds: [280, 500],
    modifiers: { priceVolatility: true },
  }),
  level({
    id: 7,
    name: 'Le crédit',
    description: 'La banque vous prête 600 pièces pour bien démarrer, mais il faut rembourser 150 pièces tous les 7 jours (au milieu de chaque saison), en plus du fermage.',
    startMoney: 600,
    rents: [150, 300, 420, 650],
    starThresholds: [300, 520],
    modifiers: { loan: { payment: 150, every: 7, first: 4 } },
  }),
  level({
    id: 8,
    name: 'L\'année bio',
    description: 'Pas d\'arrosage automatique, et replanter la même culture sur une parcelle réduit sa récolte de 30 % : pensez à la rotation.',
    startMoney: 100,
    rents: [80, 160, 240, 440],
    starThresholds: [180, 295],
    availableInvestments: ALL_INVESTMENTS.filter((id) => id !== 'sprinkler'),
    modifiers: { soilFatigue: 0.3, noSprinkler: true },
  }),
  // ── v3 ──
  level({
    id: 9,
    seedMerchant: false,
    name: 'L\'atelier de confitures',
    description: 'Les fruits frais se vendent mal cette année (−25 %), mais confitures et jus partent comme des petits pains. Installez l\'atelier et faites mûrir vos premiers pommiers.',
    startMoney: 300,
    rents: [50, 100, 180, 400],
    starThresholds: [380, 460],
    crops: ALL_CROPS,
    availableInvestments: ['chickenCoop', 'beehive', 'roadsideStand', 'sheep', 'sprinkler', 'solarPanel', 'jamWorkshop'],
    modifiers: { rawPriceFactor: 0.75 },
  }),
  level({
    id: 10,
    seedMerchant: false,
    name: 'Le verger de grand-père',
    description: 'Vous héritez de quatre vieux pommiers. Sans abeilles, ils ne donnent que des demi-récoltes : il faudra des ruches, et un atelier pour le jus.',
    startMoney: 180,
    gridCols: 4,
    gridRows: 4,
    startArea: { cols: 4, rows: 3 },
    unlockedPlots: 12,
    maxPlots: 16,
    startTrees: [0, 1, 2, 3],
    rents: [60, 120, 240, 440],
    starThresholds: [320, 600],
    crops: ALL_CROPS,
    availableInvestments: ['chickenCoop', 'beehive', 'roadsideStand', 'sheep', 'goat', 'sprinkler', 'solarPanel', 'jamWorkshop'],
    modifiers: { pollination: true },
  }),
  level({
    id: 11,
    seedMerchant: false,
    name: 'La ferme de montagne',
    description: 'Là-haut, l\'été est court et l\'hiver long. Trop de pente pour les vaches, trop froid pour les tomates : place aux chèvres, au fromage et aux pommes de terre.',
    startMoney: 280,
    gridCols: 5,
    gridRows: 3,
    startArea: { cols: 3, rows: 3 },
    unlockedPlots: 9,
    maxPlots: 15,
    seasonLengths: [7, 5, 7, 10],
    rents: [60, 100, 200, 500],
    starThresholds: [300, 470],
    weather: MOUNTAIN_WEATHER,
    crops: ['carrot', 'turnip', 'wheat', 'cabbage', 'potato', 'strawberry', 'apple'],
    availableInvestments: ['chickenCoop', 'beehive', 'roadsideStand', 'sheep', 'goat', 'dairy', 'sprinkler', 'solarPanel', 'guestHouse'],
  }),
  level({
    id: 12,
    seedMerchant: false,
    name: 'Le concours du village',
    description: 'Le village organise son grand concours d\'automne : plus belles citrouilles, produits du terroir, fromages. Chaque épreuve réussie rapporte un prix… et le fermage d\'hiver est salé.',
    startMoney: 250,
    rents: [80, 160, 280, 700],
    starThresholds: [360, 650],
    crops: ALL_CROPS,
    availableInvestments: [...ALL_INVESTMENTS, 'goat', 'jamWorkshop', 'dairy', 'mill'],
    contest: {
      deadlineDay: 21,
      prizePerGoal: 120,
      bonusAll: 120,
      goals: [
        { id: 'pumpkins', label: 'Citrouilles géantes', type: 'harvest', cropId: 'pumpkin', target: 6 },
        { id: 'terroir', label: 'Étal du terroir', type: 'productsSold', target: 12 },
        { id: 'cheese', label: 'Fromage de la ferme', type: 'productsSold', productIds: ['cowCheese', 'goatCheese'], target: 3 },
      ],
    },
  }),
];

export { BASE_CROPS, NEW_CROPS };

/** Accès par identifiant. */
export const LEVELS_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function getLevel(id) {
  return LEVELS_BY_ID[id] || null;
}

/** Nombre total de jours de l'année d'un niveau. */
export function yearLength(lvl) {
  return lvl.seasonLengths.reduce((a, b) => a + b, 0);
}
