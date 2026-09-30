// Mode Carrière — constantes générales (données pures). Conception : docs/CARRIERE.md ; contrats :
// docs/ARCHITECTURE.md, « Mode Carrière — contrats ». Les chiffres sont des valeurs de départ, réglés
// avec tools/simulate-career.js.
//
// Rien de ce fichier n'est lu par une partie de niveau (règle d'or n° 1).

import { SEASONS } from '../balance.js';

/** Version de state.career (migrateCareer fait passer chaque version à la suivante) ; 2 : terrains sur la carte 2D (col, row). */
export const CAREER_VERSION = 2;

/** Version de l'enveloppe de sauvegarde (clé « une-annee-a-la-ferme.career »). */
export const CAREER_SCHEMA = 1;

/** Durées de saison proposées à la création (jours) ; 7 par défaut (décision de l'utilisateur, § 16). */
export const SEASON_LENGTHS = [7, 10, 14];
export const DEFAULT_SEASON_LENGTH = 7;

/** Durée de référence : les charges de saison et les seuils de rang sont réglés pour des saisons de 7 jours. */
export const REFERENCE_SEASON_LENGTH = 7;

/**
 * Facteur d'échelle d'une durée de saison : les coûts et gains QUOTIDIENS ne changent pas ; ce qui se
 * compte par saison ou par année (charges de saison, seuils de patrimoine des rangs) est multiplié par
 * durée / 7, pour que l'année reste équilibrée quelle que soit la durée.
 */
export function seasonScale(seasonLength) {
  return seasonLength / REFERENCE_SEASON_LENGTH;
}

/**
 * Seuils de patrimoine des rangs selon la durée des saisons (et non × durée / 7) : dans une année plus longue,
 * l'argent gagné est réinvesti plus de fois avant le bilan (terrains, bêtes, machines qui rapportent à leur tour
 * chaque jour) : la croissance se compose et le patrimoine d'une année donnée grandit à peu près comme le CARRÉ
 * de la durée (mesuré : ×2,1 en 10 jours, ×3,5 en 14 jours à l'année 2) ; au-delà, le plafond de 12 terrains
 * freine la croissance, d'où ×3,5 (et non ×4) en 14 jours. Réglé par la simulation (tools/simulate-career.js
 * --matrix, docs/CARRIERE.md § 13.4) pour que les rangs arrivent la même année quelle que soit la durée.
 */
export const PATRIMONY_SCALE = { 7: 1, 10: 2, 14: 3.5 };

export function patrimonyScale(seasonLength) {
  return PATRIMONY_SCALE[seasonLength] ?? Math.pow(seasonLength / REFERENCE_SEASON_LENGTH, 2);
}

/**
 * Objectifs COMPTÉS au fil des jours (récoltes, produits transformés vendus) : × durée / 7, arrondi à 5.
 * Les objectifs d'état (terrains, employés, parcelles, espèces, maison) et ceux qui arrivent une fois par saison ou
 * par année (quêtes de Joseph, comice) ne changent pas.
 */
export const DAY_COUNTED_OBJECTIVES = ['harvests', 'productsSold'];

export function objectiveTargetFor(obj, seasonLength) {
  if (!obj || !DAY_COUNTED_OBJECTIVES.includes(obj.type) || seasonLength === REFERENCE_SEASON_LENGTH) return obj?.target ?? 0;
  return Math.max(1, Math.round((obj.target * seasonScale(seasonLength)) / 5) * 5);
}

/** Fermier ou fermière (titres accordés, apparence du personnage). */
export const FARMER_GENDERS = ['fermier', 'fermiere'];
export const DEFAULT_FARMER_GENDER = 'fermier';

/**
 * Nombres de la carrière selon la difficulté choisie à la création (§ 1.7).
 *   dailyCharge         charges quotidiennes de la ferme (avant entretien, salaires, carburant)
 *   seasonCharge        « Impôts et assurance » du soir du dernier jour de chaque saison : base + perLot × terrains achetés
 *                       (× durée de saison / 7)
 *   cropPriceFactor     prix des récoltes brutes (pas des produits transformés)
 *   dryGrowth / dryHeatwaveGrowth   pousse d'un jour non arrosé (canicule)
 *   startMoney          argent de départ
 *   neighbourLoan       prêt de Joseph (src/core/neighbour.js) : plafond max(minCover, maxShare × charges) ;
 *                       null = Joseph ne prête pas (Classique)
 *   gameOver            true : charges impayables → faillite (la carrière se termine)
 */
export const DIFFICULTY_CAREER = {
  detente: {
    id: 'detente',
    dailyCharge: 2,
    seasonCharge: { base: 20, perLot: 15 },
    cropPriceFactor: 1.25,
    dryGrowth: 0.75,
    dryHeatwaveGrowth: 0.25,
    startMoney: 200,
    neighbourLoan: { maxShare: 1, minCover: 100, surcharge: 0.1, repayShare: 0.5, cushion: 30 },
    gameOver: false,
  },
  classique: {
    id: 'classique',
    dailyCharge: 5,
    seasonCharge: { base: 40, perLot: 25 },
    cropPriceFactor: 1,
    dryGrowth: 0.5,
    dryHeatwaveGrowth: 0,
    startMoney: 150,
    neighbourLoan: null,
    gameOver: true,
  },
};

/** Amitié de Joseph qui change son prêt (§ 8.3) : 4 ♥ plafond × 2 ; 6 ♥ sans supplément. */
export const JOSEPH_LOAN_HEARTS = { doubleCap: 4, noSurcharge: 6 };

/** Récolte touchée par le joueur (§ 3.3). */
export const HAND_BONUS = 1.1;

/** Culture vendue dans une saison où elle ne peut pas être semée (hors serre) (§ 3.2). */
export const OFF_SEASON_FACTOR = 1.25;

/** Récolte d'une parcelle marquée d'un corbeau non chassé (§ 8.2) : −50 %. */
export const CROW_PENALTY = 0.5;

/** Cours du marché de carrière (§ 3.2) : chaque aube, marche bornée avec rappel vers 1. */
export const CAREER_MARKET = { min: 0.8, max: 1.3, meanReversion: 0.5, step: 0.1 };

/** Coups durs (§ 1.7). */
export const HARDSHIP = {
  /** Les employés et les machines reprennent quand l'argent repasse au-dessus de ce montant. */
  recoverMoney: 50,
  /** Vente de secours : la coopérative rachète animaux puis machines à cette part du prix payé. */
  rescueShare: 0.5,
};

/** Cultures débloquées par rang (§ 1.5) ; l'ordre final suit CROPS. */
export const CROPS_BY_RANK = {
  1: ['carrot', 'turnip', 'wheat', 'cabbage', 'potato', 'strawberry', 'tomato'],
  2: ['corn', 'sunflower', 'zucchini', 'apple'],
  3: ['pumpkin'],
};

/** Mise en réserve au grenier (§ 4.2). */
export const STORAGE_MODES = ['never', 'low', 'always'];
export const DEFAULT_STORAGE_MODE = 'low';

/** Limites (§ 2.5). */
export const MAX_LOTS = 16;
export const MAX_ANIMALS = 80;
export const MAX_STAFF = 8;
export const MAX_PLOTS = 128;

/** Ferme de départ (§ 1.4, § 5) : 2 poules offertes par Joseph dans le poulailler de la basse-cour. */
export const START = { hens: 2 };

/** Écus (§ 1.6) : bilan annuel 10 + 3 × rang + min(20, ⌊bénéfice / 1 000⌋) (+10 avec le Manoir) ; rang : 20 × rang. */
export const CAREER_ECUS = { yearBase: 10, yearPerRank: 3, yearProfitStep: 1000, yearProfitMax: 20, manorBonus: 10, rankUpPerRank: 20 };

/** Nombre d'anciennes carrières gardées dans progress.career.archive. */
export const CAREER_ARCHIVE_MAX = 5;

/** Sources de revenus et de dépenses du bilan de l'année (clés de state.career.yearStats). */
export const INCOME_KEYS = ['crops', 'products', 'animals', 'passersby', 'guests', 'stock', 'honey', 'visitors', 'quests', 'contest', 'rescue', 'other'];
export const SPENT_KEYS = ['seeds', 'charges', 'wages', 'fuel', 'heating', 'seasonCharges', 'lots', 'develop', 'buildings', 'machines', 'animals', 'items', 'water', 'other'];

export { SEASONS };
