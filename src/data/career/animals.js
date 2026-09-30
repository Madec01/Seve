// Mode Carrière — animaux (données pures, forme d'investissement). Conception : docs/CARRIERE.md § 5 ;
// code : src/core/career/animals.js. Enregistrés par l'extension « animals » : ils remplacent les animaux
// provisoires DEFAULT_ANIMALS de src/data/career/buildings.js (mêmes identifiants).
//
// Forme d'un investissement de carrière (lue par CORE-A : achat, entretien, patrimoine, vente de secours) :
//   { id, name, description, category: 'animal', kind: 'unit', shelter, price: { base, step }, income
//     (valeur produite par jour et par animal, par saison), upkeep, rank, effects }
// En plus (CORE-B) :
//   product     produit à ramasser (icône `product.<id>` de l'atlas) ; null : rien à ramasser
//   productName nom affiché (bulle, fiche de l'abri)
//   collect     true : la production s'accumule dans l'abri (plafond : COLLECT.capDays jours)
//   truffles    { chance, value, seasons } : cochon (chaque aube, chaque cochon a `chance` de trouver une truffe)
//   breeding    { perPair } : lapins (+1 par couple à chaque début de saison, dans la limite du clapier)
//   rides       { perDay, seasons, needs } : cheval (balades avec la chambre d'hôte)
//   traction    true : tire le semoir et la moissonneuse niv. 1
//   phase       'B' : contenu de la phase B

const ALL = { spring: 0, summer: 0, autumn: 0, winter: 0 };
const every = (v) => ({ spring: v, summer: v, autumn: v, winter: v });

export const CAREER_ANIMALS = [
  {
    id: 'hen',
    name: 'Poule',
    description: 'Des œufs chaque jour, même en hiver. À ramasser au poulailler.',
    category: 'animal',
    kind: 'unit',
    shelter: 'coop',
    price: { base: 30, step: 0 },
    income: every(2),
    upkeep: 0,
    rank: 1,
    effects: {},
    product: 'eggs',
    productName: 'Œufs',
    collect: true,
  },
  {
    id: 'rabbit',
    name: 'Lapin',
    description: 'De la laine angora chaque jour ; un lapereau par couple à chaque saison.',
    category: 'animal',
    kind: 'unit',
    shelter: 'hutch',
    price: { base: 40, step: 0 },
    income: every(2),
    upkeep: 0,
    rank: 3,
    effects: {},
    product: 'angora',
    productName: 'Laine angora',
    collect: true,
    breeding: { perPair: 1 },
  },
  {
    id: 'duck',
    name: 'Canard',
    description: 'Des œufs de cane chaque jour ; ils nagent sur la mare.',
    category: 'animal',
    kind: 'unit',
    shelter: 'duckPond',
    price: { base: 45, step: 0 },
    income: every(3),
    upkeep: 0,
    rank: 4,
    effects: {},
    product: 'duckEgg',
    productName: 'Œufs de cane',
    collect: true,
    phase: 'B',
  },
  {
    id: 'goat',
    name: 'Chèvre',
    description: 'Du lait chaque jour : il part à la fromagerie, sinon il se ramasse.',
    category: 'animal',
    kind: 'unit',
    shelter: 'goatShed',
    price: { base: 80, step: 5 },
    income: every(9),
    upkeep: 1,
    rank: 1,
    effects: { milk: true },
    product: 'milk',
    productName: 'Lait',
    collect: true,
  },
  {
    id: 'cow',
    name: 'Vache',
    description: 'Du lait chaque jour : il part à la fromagerie, sinon il se ramasse.',
    category: 'animal',
    kind: 'unit',
    shelter: 'cowshed',
    price: { base: 150, step: 10 },
    income: every(16),
    upkeep: 3,
    rank: 2,
    effects: { milk: true },
    product: 'milk',
    productName: 'Lait',
    collect: true,
  },
  {
    id: 'sheep',
    name: 'Mouton',
    description: 'Une tonte à la fin du printemps, de l\'été et de l\'automne (automatique).',
    category: 'animal',
    kind: 'unit',
    shelter: 'sheepfold',
    price: { base: 110, step: 10 },
    income: ALL,
    upkeep: 2,
    rank: 1,
    effects: { shearing: 90, shearingSeasons: ['spring', 'summer', 'autumn'] },
    product: null,
    productName: null,
    collect: false,
  },
  {
    id: 'pig',
    name: 'Cochon',
    description: 'Trouve des truffes en automne et en hiver (30 % de chance par jour, 60 pièces).',
    category: 'animal',
    kind: 'unit',
    shelter: 'pigsty',
    price: { base: 140, step: 10 },
    income: ALL,
    upkeep: 2,
    rank: 3,
    effects: {},
    product: 'truffle',
    productName: 'Truffes',
    collect: true,
    truffles: { chance: 0.3, value: 60, seasons: ['autumn', 'winter'] },
  },
  {
    id: 'horse',
    name: 'Cheval',
    description: 'Tire le semoir et la moissonneuse niv. 1 ; balades (+8 par jour) avec la chambre d\'hôte.',
    category: 'animal',
    kind: 'unit',
    shelter: 'stable',
    price: { base: 400, step: 100 },
    income: ALL,
    upkeep: 3,
    rank: 3,
    effects: {},
    product: null,
    productName: null,
    collect: false,
    traction: true,
    rides: { perDay: 8, seasons: ['spring', 'summer', 'autumn'], needs: 'guestHouse' },
  },
];

export const CAREER_ANIMALS_BY_ID = Object.fromEntries(CAREER_ANIMALS.map((a) => [a.id, a]));

/** Ramassage (§ 5.1) : plafond de production gardée dans un abri, en jours. */
export const COLLECT = { capDays: 3 };
