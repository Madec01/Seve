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

const ZERO = { spring: 0, summer: 0, autumn: 0, winter: 0 };

export const INVESTMENTS = [
  {
    id: 'chickenCoop',
    name: 'Poulailler',
    description: 'Des poules qui pondent tous les jours, même en hiver.',
    kind: 'unit',
    costs: [110, 130, 150],
    income: { spring: 8, summer: 8, autumn: 8, winter: 8 },
    upkeep: 2,
    effects: {},
  },
  {
    id: 'beehive',
    name: 'Ruche',
    description: 'Du miel hors hiver, et chaque ruche fait pousser les cultures 10 % plus vite.',
    kind: 'unit',
    costs: [100, 110, 120],
    income: { spring: 5, summer: 5, autumn: 5, winter: 0 },
    upkeep: 0,
    effects: { growthBonus: 0.1 },
  },
  {
    id: 'roadsideStand',
    name: 'Étal au bord de la route',
    description: 'Vos récoltes se vendent 20 % plus cher, et les passants achètent un peu chaque jour.',
    kind: 'unit',
    costs: [180],
    income: { spring: 4, summer: 8, autumn: 4, winter: 4 },
    upkeep: 0,
    effects: { priceBonus: 0.2, noIncomeOn: ['storm'] },
  },
  {
    id: 'cow',
    name: 'Vache',
    description: 'Du lait chaque jour. La première vache vient avec son étable.',
    kind: 'unit',
    costs: [360, 280, 280],
    income: { spring: 17, summer: 17, autumn: 17, winter: 17 },
    upkeep: 5,
    effects: {},
  },
  {
    id: 'sheep',
    name: 'Mouton',
    description: 'Rien au quotidien, mais une tonte rapporte gros à la fin du printemps, de l\'été et de l\'automne.',
    kind: 'unit',
    costs: [200, 220, 240],
    income: ZERO,
    upkeep: 3,
    effects: { shearing: 110, shearingSeasons: ['spring', 'summer', 'autumn'] },
  },
  {
    id: 'sprinkler',
    name: 'Arrosage automatique',
    description: 'Arrose vos cultures chaque matin : 8 parcelles, puis 16, puis tout le champ.',
    kind: 'upgrade',
    costs: [150, 250, 400],
    income: ZERO,
    upkeep: 1,
    effects: { waterPlots: [8, 16, Infinity] },
  },
  {
    id: 'solarPanel',
    name: 'Panneau solaire',
    description: 'Réduit les charges quotidiennes de la ferme de 4 pièces.',
    kind: 'unit',
    costs: [160, 180],
    income: ZERO,
    upkeep: 0,
    effects: { chargeReduction: 4 },
  },
  {
    id: 'guestHouse',
    name: 'Chambre d\'hôte',
    description: 'Des vacanciers toute l\'année, surtout l\'été. Un gros revenu saisonnier.',
    kind: 'unit',
    costs: [550],
    income: { spring: 14, summer: 26, autumn: 14, winter: 5 },
    upkeep: 2,
    effects: {},
  },
];

/** Accès par identifiant. */
export const INVESTMENTS_BY_ID = Object.fromEntries(INVESTMENTS.map((i) => [i.id, i]));

export function getInvestment(id) {
  return INVESTMENTS_BY_ID[id] || null;
}
