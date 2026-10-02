// Modes de difficulté — données pures.
//
//   detente   (défaut des nouvelles parties) : équilibre « facile et relaxant » — on gagne presque toujours
//             en jouant normalement (sans arroser chaque parcelle chaque jour), les étoiles récompensent le
//             bon jeu, et « le prêt du voisin » rattrape un fermage manqué.
//   classique : exactement les nombres de la v3 (le jeu d'avant le rééquilibrage, test de parité).
//
// Un mode ne change que des NOMBRES du niveau (et le filet de sécurité) : la contrainte de chaque niveau
// (sécheresse, pluie, petit lopin, marché fou, crédit, bio, ateliers, verger, montagne, concours) reste.
// Réglages obtenus avec la simulation (tools/simulate.js, joueurs « novice » et « casual »).
//
// Champs d'un mode (appliqués par levelFor() à chaque niveau) :
//   name, short, description   textes affichés (choix du mode)
//   dailyCharge                charges fixes quotidiennes de la ferme (classique : BASE_DAILY_CHARGE = 5)
//   cropPriceFactor            multiplicateur du prix de vente des récoltes brutes (pas des produits transformés)
//   dryGrowth                  pousse d'un jour non arrosé (classique : GROWTH.dry = 0,5)
//   dryHeatwaveGrowth          pousse d'un jour de canicule non arrosé (classique : GROWTH.dryHeatwave = 0)
//   neighbourLoan              null, ou le prêt du voisin (src/core/neighbour.js) :
//     maxShare    le voisin n'avance que si ce qui manque vaut au plus cette part du fermage…
//     minCover    … ou au plus ce nombre de pièces (petits fermages du début d'année)
//     surcharge   part ajoutée à la somme prêtée (0,1 = on rend 10 % de plus, arrondi au-dessus)
//     repayShare  part de chaque vente (récolte, produit transformé) reprise par le voisin tant qu'on lui doit
//     cushion     pièces prêtées EN PLUS de ce qui manque, pour pouvoir ressemer (pas au dernier fermage)
//   levels { [id]: { startMoney, rents, starThresholds, modifiers?, description? } }   nombres propres à
//                              chaque niveau (description : quand le texte du niveau cite un nombre changé)
//
// Seuils d'étoiles Détente (règle du § 13.3 : ★★ ≈ argent final médian du joueur tranquille, ★★★ ≈ ses 12 % meilleures
// parties ; niveau 2 : ★★★ rare pour le débutant, ≈ 15 %) — recalculés au lot 3 (2026-10-02) avec la variété active
// (tableau, cadeaux, charrette, défis, colporteur : tools/simulate.js --stars, 200 graines). Anciens (lot 2) :
// 410/650, 180/470, 230/450, 420/590, 240/510, 180/470, 140/380, 260/530, 170/340, 570/780, 260/440, 290/560.

import { BASE_DAILY_CHARGE, GROWTH } from './balance.js';
import { LEVELS, getLevel } from './levels.js';

export const DIFFICULTY_IDS = ['detente', 'classique'];

/** Mode des nouvelles parties. */
export const DEFAULT_DIFFICULTY = 'detente';

/** Mode des parties sauvegardées avant l'existence des modes (elles gardent leurs règles). */
export const LEGACY_DIFFICULTY = 'classique';

export const DIFFICULTIES = {
  detente: {
    id: 'detente',
    name: 'Détente',
    short: 'Détente',
    description: 'Pour jouer tranquillement : charges et fermages plus doux, les cultures poussent même sans arrosage, et Joseph, le voisin, avance l\'argent d\'un fermage manqué.',
    dailyCharge: 2,
    cropPriceFactor: 1.25,
    dryGrowth: 0.75,
    dryHeatwaveGrowth: 0.25,
    neighbourLoan: { maxShare: 0.5, minCover: 60, surcharge: 0.1, repayShare: 0.5, cushion: 30 },
    levels: {
      1: { startMoney: 160, rents: [20, 60, 90, 130], starThresholds: [560, 830] },
      2: { startMoney: 180, rents: [20, 60, 80, 120], starThresholds: [310, 570] },
      3: { startMoney: 160, rents: [20, 50, 100, 170], starThresholds: [350, 670] },
      4: { startMoney: 260, rents: [20, 60, 90, 120], starThresholds: [530, 750] },
      5: { startMoney: 160, rents: [20, 80, 140, 500], starThresholds: [490, 810] },
      6: { startMoney: 160, rents: [20, 70, 130, 300], starThresholds: [340, 680] },
      7: {
        startMoney: 660,
        rents: [50, 150, 230, 360],
        starThresholds: [220, 610],
        description: 'La banque vous prête 600 pièces pour bien démarrer, mais il faut rembourser 120 pièces tous les 7 jours (au milieu de chaque saison), en plus du fermage.',
        modifiers: { loan: { payment: 120, every: 7, first: 4 } },
      },
      8: { startMoney: 160, rents: [20, 80, 130, 240], starThresholds: [380, 730] },
      9: { startMoney: 360, rents: [20, 60, 120, 260], starThresholds: [290, 480] },
      10: { startMoney: 240, rents: [20, 90, 200, 420], starThresholds: [670, 900] },
      11: { startMoney: 340, rents: [20, 80, 160, 440], starThresholds: [390, 620] },
      12: { startMoney: 310, rents: [20, 100, 190, 480], starThresholds: [400, 680] },
    },
  },
  classique: {
    id: 'classique',
    name: 'Classique',
    short: 'Classique',
    description: 'L\'équilibre d\'origine : il faut arroser chaque jour et bien gérer, un fermage manqué, c\'est la faillite.',
    dailyCharge: BASE_DAILY_CHARGE,
    cropPriceFactor: 1,
    dryGrowth: GROWTH.dry,
    dryHeatwaveGrowth: GROWTH.dryHeatwave,
    neighbourLoan: null,
    levels: {},
  },
};

/** true si `id` est un mode connu. */
export function isDifficulty(id) {
  return DIFFICULTY_IDS.includes(id);
}

export function getDifficulty(id) {
  return isDifficulty(id) ? DIFFICULTIES[id] : null;
}

const cache = new Map();

/**
 * Niveau tel qu'il se joue dans un mode : les données de src/data/levels.js (classique), avec les
 * nombres du mode. Toujours le même objet pour un couple (niveau, mode). null si le niveau ou le mode
 * est inconnu.
 */
export function levelFor(levelId, difficulty = DEFAULT_DIFFICULTY) {
  const base = getLevel(levelId);
  const mode = getDifficulty(difficulty);
  if (!base || !mode) return null;
  const key = `${base.id}/${mode.id}`;
  if (cache.has(key)) return cache.get(key);
  const over = mode.levels[base.id] || {};
  const lvl = {
    ...base,
    ...over,
    difficulty: mode.id,
    dailyCharge: mode.dailyCharge,
    cropPriceFactor: mode.cropPriceFactor,
    dryGrowth: mode.dryGrowth,
    dryHeatwaveGrowth: mode.dryHeatwaveGrowth,
    neighbourLoan: mode.neighbourLoan ? { ...mode.neighbourLoan } : null,
    modifiers: { ...base.modifiers, ...(over.modifiers || {}) },
  };
  cache.set(key, lvl);
  return lvl;
}

/** Tous les niveaux d'un mode (sélection des niveaux : fermages et seuils d'étoiles du mode). */
export function levelsFor(difficulty = DEFAULT_DIFFICULTY) {
  return LEVELS.map((l) => levelFor(l.id, difficulty));
}
