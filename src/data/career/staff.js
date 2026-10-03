// Mode Carrière — employés (données pures). Conception : docs/CARRIERE.md § 7 ; code :
// src/core/career/staff.js (embauche, niveaux, humeur, congés) et src/core/career/work.js (tâches).
//
// Rien de ce fichier n'est lu par une partie de niveau.

import { F1 } from '../cozy.js';

/** Métiers (§ 7.2). `lotTypes` : terrains où l'on peut l'affecter ; `all` : « tous les … » possible. */
export const JOBS = [
  {
    id: 'gardener',
    name: { m: 'Jardinier', f: 'Jardinière' },
    lotTypes: ['field', 'orchard', 'greenhouse'],
    all: true,
    allLabel: 'Tous les champs',
    // (lot 4, F1) Les corvées d'abord ; la récolte attend le joueur (F1.staffDelay aubes).
    text: `Arrose, désherbe, sème selon le plan de culture (achète les graines), chasse les corbeaux ; récolte ce qui attend depuis ${F1.staffDelay} jours.`,
    tool: 'can',
  },
  {
    id: 'keeper',
    name: { m: 'Soigneur', f: 'Soigneuse' },
    lotTypes: ['meadow', 'yard', 'pond'],
    all: true,
    allLabel: 'Tous les animaux',
    text: 'Ramasse les abris trois fois par jour ; les animaux de ses terrains rapportent 5 % de plus par niveau.',
    tool: 'pail',
  },
  {
    id: 'artisan',
    name: { m: 'Artisan', f: 'Artisane' },
    lotTypes: ['workshops'],
    all: false,
    text: 'Ajoute des places aux ateliers de sa cour (+1, puis +2 au niveau 3) ; au niveau 5, produits +10 %.',
    tool: 'hoe',
  },
  {
    id: 'seller',
    name: { m: 'Vendeur', f: 'Vendeuse' },
    lotTypes: ['home'],
    all: false,
    text: 'Vend le stock du grenier au bon cours ; toutes les ventes +2 % par niveau (un seul vendeur compte).',
    tool: 'basket',
  },
];

export const JOBS_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));
export const JOB_IDS = JOBS.map((j) => j.id);

/**
 * Traits (§ 7.3), tous positifs. Identifiants = icônes `icon.career.trait.<id>` de l'atlas.
 *   effects : actionsFactor (jardinier : × actions), wageDelta (salaire), xpFactor, neverTired,
 *             keeperBonus (soigneur : revenus + x), sellerBonus (vendeur : ventes + x), startAt (début du travail)
 */
export const TRAITS = [
  { id: 'strong', name: { m: 'Costaud', f: 'Costaude' }, text: '20 % d\'actions en plus chaque jour.', effects: { actionsFactor: 1.2 }, job: 'gardener' },
  { id: 'thrifty', name: { m: 'Économe', f: 'Économe' }, text: 'Demande 2 pièces de moins par jour.', effects: { wageDelta: -2 }, job: null },
  { id: 'quick', name: { m: 'Vif', f: 'Vive' }, text: 'Apprend vite : expérience × 1,5.', effects: { xpFactor: 1.5 }, job: null },
  { id: 'loyal', name: { m: 'Fidèle', f: 'Fidèle' }, text: 'N\'est jamais las, même sans congé.', effects: { neverTired: true }, job: null },
  { id: 'animalLover', name: { m: 'Ami des bêtes', f: 'Amie des bêtes' }, text: 'Soigneur : les animaux rapportent 5 % de plus encore.', effects: { keeperBonus: 0.05 }, job: 'keeper' },
  { id: 'chatty', name: { m: 'Bavard', f: 'Bavarde' }, text: 'Vendeur : les ventes rapportent 3 % de plus encore.', effects: { sellerBonus: 0.03 }, job: 'seller' },
  { id: 'earlyBird', name: { m: 'Matinal', f: 'Matinale' }, text: 'Commence plus tôt (5 % du jour) : environ 15 % d\'actions en plus.', effects: { startAt: 0.05 }, job: null },
];

export const TRAITS_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
export const TRAIT_IDS = TRAITS.map((t) => t.id);

/** Humeurs (§ 7.3) : multiplicateur des actions. */
export const MOODS = {
  joyful: { name: { m: 'Joyeux', f: 'Joyeuse' }, factor: 1.1 },
  content: { name: { m: 'Content', f: 'Contente' }, factor: 1 },
  tired: { name: { m: 'Las', f: 'Lasse' }, factor: 0.9 },
};

/** Niveaux 1 → 5 : expérience totale nécessaire (§ 7.3). */
export const XP_LEVELS = [0, 100, 300, 700, 1500];
export const MAX_STAFF_LEVEL = XP_LEVELS.length;

/** Salaire par jour : 8 + 3 × (niveau − 1) ; trait « Économe » : −2 (§ 7.3). */
export const WAGE = { base: 8, perLevel: 3, min: 1 };

/** Actions par jour du jardinier, niveau 1 → 5 (§ 7.2). */
export const GARDENER_ACTIONS = [14, 18, 22, 26, 30];

/** Réglages du travail (fractions de la journée). */
export const WORK = {
  /** Heures de travail (§ 7.2) : de 15 % à 85 % du jour ; « Matinal » commence à 5 %. */
  start: 0.15,
  end: 0.85,
  /** Trajet de retour à la maison en fin de journée (animation). */
  homeWalk: 0.04,
  /** « Tous les champs » / « tous les animaux » : −20 % d'actions (trajets). */
  allFactor: 0.8,
  /** Tracteur : jardiniers + 25 % d'actions. */
  tractorFactor: 1.25,
  /** Soigneur : tournées de ramassage (§ 7.2) et durée d'une visite d'abri. */
  keeperRounds: [0.25, 0.55, 0.85],
  keeperVisit: 0.03,
  /** Soigneur : revenus des animaux de ses terrains + 5 % par niveau. */
  keeperBonusPerLevel: 0.05,
  /** Artisan : durée d'une séance à l'atelier (animation). */
  artisanSession: 0.1,
  /** Vendeur : une vérification du grenier toutes les … ; durée du passage au grenier. */
  sellerEvery: 0.15,
  sellerVisit: 0.04,
  /** Vendeur : vend quand le cours ≥ 1,15 − 0,02 × (niveau − 1), ou hors saison ; ventes + 2 % par niveau. */
  sellerThreshold: 1.15,
  sellerThresholdPerLevel: 0.02,
  sellerBonusPerLevel: 0.02,
  /** Jours avant « Las » : maison (tiredDays), 21 par défaut. Joie : 7 jours après une fête ou un congé ≥ 2 jours. */
  tiredDays: 21,
  joyDays: 7,
  joyLeaveDays: 2,
};

/** Expérience gagnée (§ 7.2). */
export const XP_GAIN = {
  gardener: 1, // par action utile
  keeperShelter: 2, // par abri ramassé (non vide)
  artisanProduct: 2, // par produit vendu d'un atelier de sa cour
  sellerPerCoins: 10, // 1 point par 10 pièces vendues
};

/** Artisan : places en plus par niveau (niv. 1-2 : +1, niv. 3-4 : +2, niv. 5 : +2) et bonus de prix au niv. 5. */
export const ARTISAN_PLACES = [1, 1, 2, 2, 2];
export const ARTISAN_PRODUCT_BONUS = { level: 5, factor: 1.1 };

/** Candidats (§ 7.1) : 3 par saison ; niveau 2 pour 1 candidat sur 3 à partir du rang 4. */
export const CANDIDATES = { count: 3, level2Chance: 1 / 3, level2Rank: 4 };

/** Rang et maison nécessaires pour embaucher (§ 7.1). */
export const HIRE_RANK = 2;
