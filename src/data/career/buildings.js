// Mode Carrière — bâtiments à niveaux et aménagements de la ferme (données pures). Conception :
// docs/CARRIERE.md § 4 et § 5.
//
// Un bâtiment est UNIQUE dans la ferme (un seul de chaque type) et a un niveau (1 → levels.length).
//   placement : 'home' (bande de la maison : pas d'emplacement à choisir), 'slot' (emplacement d'un
//               terrain : `slotTypes` = types de terrain acceptés), 'lot' (créé avec l'aménagement du
//               terrain : serre, mare)
//   levels[k] : niveau k + 1 → { name, cost, rank, ...effets } ; cost du niveau 1 = prix de construction
//               (0 pour un bâtiment offert ou payé avec l'aménagement)
//   upkeep    : entretien quotidien (forfait dès le niveau 1) ou upkeepByLevel
//   category  : 'house' | 'storage' | 'greenhouse' | 'sales' | 'guests' | 'shelter' | 'workshop'
//
// Effets lus par src/core/career/buildings.js :
//   staff (maison) : employés au plus ; tiredDays : jours avant « Las » ; yearEcus : écus en plus au bilan
//   capacity (grenier / silo) : unités de stock
//   plots, growth, winterGrowth, heating (serre)
//   priceBonus, passersby (multiplicateur du revenu des passants) (étal)
//   incomeFactor (chambre d'hôte) ; income (revenu de base par saison, niveau 1)
//   animals (abri : capacité), animal : animal logé
//   places (atelier) : places de travail

const SEASON_ZERO = { spring: 0, summer: 0, autumn: 0, winter: 0 };

export const BUILDINGS = [
  {
    id: 'house',
    name: 'Maison',
    category: 'house',
    placement: 'home',
    startLevel: 1,
    upkeep: 0,
    levels: [
      { name: 'Maisonnette', cost: 0, rank: 1, staff: 0, tiredDays: 21 },
      { name: 'Maison', cost: 500, rank: 2, staff: 2, tiredDays: 21 },
      { name: 'Grande maison', cost: 1500, rank: 3, staff: 4, tiredDays: 28 },
      { name: 'Corps de ferme', cost: 4000, rank: 4, staff: 6, tiredDays: 28 },
      { name: 'Manoir', cost: 10000, rank: 5, staff: 8, tiredDays: 28, yearEcus: 10 },
    ],
  },
  {
    id: 'storage',
    name: 'Grenier',
    category: 'storage',
    placement: 'home',
    upkeep: 0,
    levels: [
      { name: 'Grenier', cost: 400, rank: 2, capacity: 30 },
      { name: 'Silo', cost: 1500, rank: 4, capacity: 100 },
      { name: 'Grand silo', cost: 4000, rank: 5, capacity: 250 },
    ],
  },
  {
    id: 'roadsideStand',
    name: 'Étal',
    category: 'sales',
    placement: 'home',
    upkeep: 0,
    income: { spring: 4, summer: 8, autumn: 4, winter: 2 },
    noIncomeOn: ['storm'],
    levels: [
      { name: 'Étal au bord de la route', cost: 180, rank: 1, priceBonus: 0.2, passersby: 1 },
      { name: 'Boutique de la ferme', cost: 600, rank: 4, priceBonus: 0.3, passersby: 2 },
      { name: 'Marché fermier', cost: 1800, rank: 5, priceBonus: 0.4, passersby: 3, phase: 'B' },
    ],
  },
  {
    id: 'greenhouse',
    name: 'Serre',
    category: 'greenhouse',
    placement: 'lot',
    lotType: 'greenhouse',
    upkeep: 0,
    levels: [
      // Niveau 1 : payé avec l'aménagement « Serre » (800).
      { name: 'Serre froide', cost: 0, rank: 3, plots: 4, growth: 1, winterGrowth: 0.5, heating: 0 },
      { name: 'Grande serre', cost: 1200, rank: 3, plots: 8, growth: 1, winterGrowth: 0.5, heating: 0 },
      { name: 'Serre chauffée', cost: 3000, rank: 4, plots: 8, growth: 1.1, winterGrowth: 1.1, heating: 3 },
    ],
  },
  {
    id: 'guestHouse',
    name: 'Chambre d\'hôte',
    category: 'guests',
    placement: 'slot',
    slotTypes: ['meadow', 'yard'],
    income: { spring: 20, summer: 34, autumn: 20, winter: 8 },
    upkeepByLevel: [2, 3, 4],
    levels: [
      { name: 'Chambre d\'hôte', cost: 300, rank: 3, incomeFactor: 1 },
      { name: 'Maison d\'hôtes', cost: 800, rank: 3, incomeFactor: 1.5 },
      { name: 'Gîte de charme', cost: 2000, rank: 4, incomeFactor: 2.2 },
    ],
  },
  // ── Abris d'animaux (§ 4.5) ──
  shelter('coop', ['Poulailler', 'Poulailler agrandi', 'Grand poulailler'], 'hen', [0, 150, 400], [4, 8, 12], 1, { startLevel: 1, the: 'Le poulailler', fem: false }),
  shelter('sheepfold', ['Bergerie', 'Bergerie agrandie', 'Grande bergerie'], 'sheep', [200, 350, 700], [3, 5, 8], 1, { the: 'La bergerie', fem: true }),
  shelter('goatShed', ['Chèvrerie', 'Chèvrerie agrandie', 'Grande chèvrerie'], 'goat', [150, 300, 600], [3, 5, 8], 1, { the: 'La chèvrerie', fem: true }),
  shelter('cowshed', ['Étable', 'Étable agrandie', 'Grande étable'], 'cow', [250, 400, 800], [3, 5, 8], 2, { the: 'L\'étable', fem: true }),
  shelter('pigsty', ['Porcherie', 'Porcherie agrandie', 'Grande porcherie'], 'pig', [250, 400, 800], [2, 4, 6], 3, { the: 'La porcherie', fem: true }),
  shelter('hutch', ['Clapier', 'Clapier agrandi', 'Grand clapier'], 'rabbit', [120, 250, 500], [4, 8, 12], 3, { the: 'Le clapier', fem: false }),
  shelter('stable', ['Écurie', 'Écurie agrandie', 'Grande écurie'], 'horse', [400, 600, 1200], [1, 2, 4], 3, { the: 'L\'écurie', fem: true }),
  // Mare : niveau 1 payé avec l'aménagement « Mare » (phase B).
  shelter('duckPond', ['Mare aux canards', 'Mare agrandie', 'Grande mare'], 'duck', [0, 200, 500], [4, 8, 12], 4, { placement: 'lot', lotType: 'pond', phase: 'B', the: 'La mare', fem: true }),
  // ── Ateliers (§ 4.7) : 5 niveaux, places 2 / 3 / 4 / 5 / 6, sur une cour des ateliers ──
  workshop('jamWorkshop', 'Atelier de confitures', [90, 120, 160, 320, 640], 1, 2),
  workshop('dairy', 'Fromagerie', [160, 130, 170, 340, 680], 2, 3),
  workshop('mill', 'Moulin', [150, 130, 200, 400, 800], 1, 3),
];

function shelter(id, levelNames, animal, costs, capacity, rank, extra = {}) {
  return {
    id,
    name: levelNames[0],
    category: 'shelter',
    placement: 'slot',
    slotTypes: ['meadow', 'yard'],
    animal,
    upkeep: 0,
    levels: costs.map((cost, k) => ({ name: levelNames[k], cost, rank: k === 0 ? rank : Math.max(rank, k + 1), animals: capacity[k] })),
    ...extra,
  };
}

function workshop(id, name, costs, upkeep, rank) {
  const places = [2, 3, 4, 5, 6];
  // Niveaux 1 à 3 : dès le rang de l'atelier ; niveau 4 : rang 4 ; niveau 5 : rang 5 (§ 1.5).
  return {
    id,
    name,
    category: 'workshop',
    placement: 'slot',
    slotTypes: ['workshops'],
    upkeep,
    levels: costs.map((cost, k) => ({ name: `${name} niv. ${k + 1}`, cost, rank: k < 3 ? rank : Math.max(rank, k + 1), places: places[k] })),
  };
}

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export function getBuilding(id) {
  return BUILDINGS_BY_ID[id] || null;
}

export function buildingMaxLevel(b) {
  return b.levels.length;
}

/** Abris d'animaux et ateliers : bâtiments qui se posent sur un emplacement. */
export const SLOT_BUILDINGS = BUILDINGS.filter((b) => b.placement === 'slot').map((b) => b.id);
export const SHELTERS = BUILDINGS.filter((b) => b.category === 'shelter').map((b) => b.id);
export const WORKSHOPS = BUILDINGS.filter((b) => b.category === 'workshop').map((b) => b.id);

/** Abri d'un animal. */
export function shelterFor(animalId) {
  return BUILDINGS.find((b) => b.category === 'shelter' && b.animal === animalId) || null;
}

/**
 * Aménagements de la ferme sans niveau (§ 4.8), achetés à l'unité avec buyInvestment (forme d'un
 * investissement : kind 'unit', costs = prix de chaque unité).
 *   maxByRank : unités au plus selon le rang ; perField : au plus N par champ (ruches)
 */
export const FARM_ITEMS = [
  {
    id: 'beehive',
    category: 'crop',
    name: 'Ruche',
    description: 'Du miel hors hiver, et chaque ruche fait pousser toute la ferme 5 % plus vite (hors hiver).',
    kind: 'unit',
    costs: [60, 80, 100, 120, 140, 160],
    income: { spring: 5, summer: 5, autumn: 5, winter: 0 },
    incomeKey: 'honey',
    upkeep: 0,
    rank: 1,
    maxByRank: { 1: 2, 2: 4, 3: 6 },
    perField: 2,
    effects: { growthBonus: 0.05 },
  },
  {
    id: 'solarPanel',
    category: 'utility',
    name: 'Panneau solaire',
    description: 'Réduit les charges quotidiennes de 5 pièces (jamais les salaires ni le carburant).',
    kind: 'unit',
    costs: [80, 100, 150, 200],
    income: SEASON_ZERO,
    upkeep: 0,
    rank: 1,
    effects: { chargeReduction: 5 },
  },
];

/**
 * Animaux de carrière PROVISOIRES (forme d'investissement, une unité = un animal) : ils font tourner le
 * squelette de la carrière tant que src/data/career/animals.js (lot CORE-B) n'est pas enregistré ;
 * registerCareerInvestments() de src/core/career/registry.js les remplace (même identifiant). Chiffres du § 5.
 *   price : base + step × déjà possédés ; shelter : abri qui les loge ; rank : rang qui les débloque
 */
export const DEFAULT_ANIMALS = [
  animal('hen', 'Poule', 'coop', 30, 0, 2, 0, 1, 'Des œufs chaque jour, même en hiver.'),
  animal('rabbit', 'Lapin', 'hutch', 40, 0, 2, 0, 3, 'De la laine angora chaque jour.'),
  animal('duck', 'Canard', 'duckPond', 45, 0, 3, 0, 4, 'Des œufs de cane chaque jour.'),
  animal('goat', 'Chèvre', 'goatShed', 80, 5, 9, 1, 1, 'Du lait chaque jour (fromagerie).', { milk: true }),
  animal('cow', 'Vache', 'cowshed', 150, 10, 16, 3, 2, 'Du lait chaque jour (fromagerie).', { milk: true }),
  animal('sheep', 'Mouton', 'sheepfold', 110, 10, 0, 2, 1, 'Une tonte à la fin du printemps, de l\'été et de l\'automne.', { shearing: 90, shearingSeasons: ['spring', 'summer', 'autumn'] }),
  animal('pig', 'Cochon', 'pigsty', 140, 10, 0, 2, 3, 'Trouve des truffes en automne et en hiver.'),
  animal('horse', 'Cheval', 'stable', 400, 100, 0, 3, 3, 'Tire le semoir et la moissonneuse ; balades avec la chambre d\'hôte.'),
];

function animal(id, name, shelterId, base, step, perDay, upkeep, rank, description, effects = {}) {
  const income = { spring: perDay, summer: perDay, autumn: perDay, winter: perDay };
  return { id, name, description, category: 'animal', kind: 'unit', shelter: shelterId, price: { base, step }, income, upkeep, rank, effects, provisional: true };
}
