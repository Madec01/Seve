// Investissements (revenu automatique quotidien) — données pures.
//
// Champs :
//   id           identifiant anglais
//   name         nom affiché
//   description  courte description affichée sur la carte
//   kind         'unit'    : on achète des unités (quantité max = costs.length)
//                'upgrade' : on achète des niveaux successifs (niveau max = costs.length)
//   costs        prix de chaque unité / niveau, dans l'ordre d'achat
//   income       revenu quotidien PAR UNITÉ selon la saison (versé à l'aube)
//   upkeep       entretien quotidien PAR UNITÉ ('upgrade' : forfait dès le 1er niveau)
//   effects      effets spéciaux (voir src/core/economy.js et src/core/farm.js) :
//     growthBonus       +x de vitesse de pousse par unité (hors hiver)
//     priceBonus        +x sur le prix de vente des récoltes (non cumulatif : unité unique)
//     noIncomeOn        météos qui annulent le revenu de cet investissement ce jour-là
//     shearing          somme versée par unité à l'aube du dernier jour de chaque saison listée
//     shearingSeasons   saisons concernées par la tonte
//     waterPlots        nombre de parcelles arrosées chaque matin, par niveau (Infinity = toutes)
//     chargeReduction   réduction des charges quotidiennes par unité
//     milk              (v3) true : le lait de chaque unité peut aller à la fromagerie (vache, chèvre)
//     processing        (v3) atelier : { places: [par niveau], source: 'harvest' | 'animal' } (voir src/core/processing.js)
//   category     (v3) 'animal' | 'crop' | 'processing' | 'utility' : sections de l'onglet Acheter
//   requiresAny  (v3) facultatif : il faut posséder au moins un de ces investissements pour acheter
//
// Ordre : les 8 investissements d'origine d'abord (ordre inchangé depuis la v2), puis les nouveautés v3.

const ZERO = { spring: 0, summer: 0, autumn: 0, winter: 0 };

export const INVESTMENTS = [
  {
    id: 'chickenCoop',
    category: 'animal',
    name: 'Poulailler',
    description: 'Des poules qui pondent tous les jours, même en hiver.',
    kind: 'unit',
    costs: [70, 85, 100],
    income: { spring: 7, summer: 7, autumn: 7, winter: 7 },
    upkeep: 1,
    effects: {},
  },
  {
    id: 'beehive',
    category: 'crop',
    name: 'Ruche',
    description: 'Du miel hors hiver, et chaque ruche fait pousser les cultures 10 % plus vite.',
    kind: 'unit',
    costs: [60, 80, 100],
    income: { spring: 5, summer: 5, autumn: 5, winter: 0 },
    upkeep: 0,
    effects: { growthBonus: 0.1 },
  },
  {
    id: 'roadsideStand',
    category: 'utility',
    name: 'Étal au bord de la route',
    description: 'Vos récoltes se vendent 20 % plus cher, et les passants achètent un peu chaque jour.',
    kind: 'unit',
    costs: [180],
    income: { spring: 4, summer: 8, autumn: 4, winter: 2 },
    upkeep: 0,
    effects: { priceBonus: 0.2, noIncomeOn: ['storm'] },
  },
  {
    id: 'cow',
    category: 'animal',
    name: 'Vache',
    description: 'Du lait chaque jour. La première vache vient avec son étable.',
    kind: 'unit',
    costs: [180, 140, 140],
    income: { spring: 16, summer: 16, autumn: 16, winter: 16 },
    upkeep: 3,
    effects: { milk: true },
  },
  {
    id: 'sheep',
    category: 'animal',
    name: 'Mouton',
    description: 'Rien au quotidien, mais une tonte rapporte gros à la fin du printemps, de l\'été et de l\'automne.',
    kind: 'unit',
    costs: [120, 140, 160],
    income: ZERO,
    upkeep: 2,
    effects: { shearing: 90, shearingSeasons: ['spring', 'summer', 'autumn'] },
  },
  {
    id: 'sprinkler',
    category: 'crop',
    name: 'Arrosage automatique',
    description: 'Arrose vos cultures chaque matin : 8 parcelles, puis 16, puis tout le champ.',
    kind: 'upgrade',
    costs: [120, 200, 320],
    income: ZERO,
    upkeep: 1,
    effects: { waterPlots: [8, 16, Infinity] },
  },
  {
    id: 'solarPanel',
    category: 'utility',
    name: 'Panneau solaire',
    description: 'Réduit les charges quotidiennes de la ferme de 5 pièces par jour.',
    kind: 'unit',
    costs: [80, 100],
    income: ZERO,
    upkeep: 0,
    effects: { chargeReduction: 5 },
  },
  {
    id: 'guestHouse',
    category: 'utility',
    name: 'Chambre d\'hôte',
    description: 'Des vacanciers toute l\'année, surtout l\'été. Un gros revenu saisonnier.',
    kind: 'unit',
    costs: [300],
    income: { spring: 20, summer: 34, autumn: 20, winter: 8 },
    upkeep: 2,
    effects: {},
  },
  // ── v3 ──
  {
    id: 'goat',
    category: 'animal',
    name: 'Chèvre',
    description: 'Une petite vache : du lait chaque jour, même en hiver. La première vient avec son enclos.',
    kind: 'unit',
    costs: [90, 100, 110],
    income: { spring: 9, summer: 9, autumn: 9, winter: 9 },
    upkeep: 1,
    effects: { milk: true },
  },
  {
    id: 'jamWorkshop',
    category: 'processing',
    name: 'Atelier de confitures',
    description: 'Transforme les fraises en confiture et les pommes en jus, vendus tout seuls à l\'aube.',
    kind: 'upgrade',
    costs: [90, 120, 160],
    income: ZERO,
    upkeep: 1,
    effects: { processing: { places: [2, 3, 4], source: 'harvest' } },
  },
  {
    id: 'dairy',
    category: 'processing',
    name: 'Fromagerie',
    description: 'Le lait des vaches et des chèvres devient du fromage, vendu tout seul à l\'aube.',
    kind: 'upgrade',
    costs: [160, 130, 170],
    income: ZERO,
    upkeep: 2,
    requiresAny: ['cow', 'goat'],
    effects: { processing: { places: [2, 3, 4], source: 'animal' } },
  },
  {
    id: 'mill',
    category: 'processing',
    name: 'Moulin',
    description: 'Moud le blé en farine ; au niveau 3, son four à pain en fait du pain.',
    kind: 'upgrade',
    costs: [150, 130, 200],
    income: ZERO,
    upkeep: 1,
    effects: { processing: { places: [2, 3, 4], source: 'harvest' } },
  },
];

/** Les 8 investissements d'origine (niveaux 1 à 8). */
export const BASE_INVESTMENTS = ['chickenCoop', 'beehive', 'roadsideStand', 'cow', 'sheep', 'sprinkler', 'solarPanel', 'guestHouse'];

/** Ateliers de transformation (v3). */
export const PROCESSING_BUILDINGS = ['jamWorkshop', 'dairy', 'mill'];

/** Accès par identifiant. */
export const INVESTMENTS_BY_ID = Object.fromEntries(INVESTMENTS.map((i) => [i.id, i]));

export function getInvestment(id) {
  return INVESTMENTS_BY_ID[id] || null;
}
