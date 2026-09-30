// Mode Carrière — machines (données pures). Conception : docs/CARRIERE.md § 6 ; code :
// src/core/career/machines.js (achat, amélioration, interrupteur, passages, carburant) et
// src/core/career/work.js (déroulé des passages dans la journée).
//
//   scope    'lot' : une par type et par terrain (clé « <id>@<lotId> ») ; 'shelter' : une par abri
//            (clé « collector@<buildingId> ») ; 'farm' : une pour la ferme (clé = id, terrain 'home')
//   lotTypes terrains compatibles (scope 'lot')
//   levels   [{ cost, rank, capacity (actions par jour ; Infinity = tout le terrain), requires }]
//            requires : null | 'puller' (cheval ou tracteur) | 'tractor'
//   fuel     carburant par jour de travail (payé à l'aube suivante ; jamais quand l'argent est négatif)
//   upkeep   entretien quotidien (payé même éteinte ; château d'eau : arroseurs sans entretien)
//   passes   heures de passage (fraction de la journée) ; 0 = à l'aube
//   kind     type de travail (événement machineWorked) : water | sow | harvest | pick | collect | convey
//   step     durée de passage d'une parcelle (fraction de la journée), pour l'animation rang par rang
//   phase    'B' : contenu de la phase B

export const MACHINES = [
  {
    id: 'sprinklers',
    name: 'Arroseurs',
    scope: 'lot',
    lotTypes: ['field', 'greenhouse'],
    kind: 'water',
    fuel: 0,
    upkeep: 1,
    passes: [0],
    levels: [
      { cost: 150, rank: 2, capacity: 8, requires: null, text: 'Arrose 8 parcelles à l\'aube.' },
      { cost: 250, rank: 2, capacity: Infinity, requires: null, text: 'Arrose tout le terrain à l\'aube.' },
    ],
    description: 'Arrosent les parcelles du terrain chaque aube.',
  },
  {
    id: 'seeder',
    name: 'Semoir',
    scope: 'lot',
    lotTypes: ['field', 'greenhouse'],
    kind: 'sow',
    fuel: 2,
    upkeep: 0,
    passes: [0, 0.35],
    step: 0.01,
    levels: [
      { cost: 500, rank: 3, capacity: 8, requires: 'puller', text: '8 semis par jour (cheval ou tracteur).' },
      { cost: 700, rank: 4, capacity: Infinity, requires: 'tractor', text: 'Sème tout le terrain (tracteur).' },
    ],
    description: 'Sème selon le plan de culture et achète les graines.',
  },
  {
    id: 'harvester',
    name: 'Moissonneuse',
    scope: 'lot',
    lotTypes: ['field'],
    kind: 'harvest',
    fuel: 3,
    upkeep: 0,
    passes: [0.3],
    step: 0.012,
    levels: [
      { cost: 700, rank: 3, capacity: 8, requires: 'puller', text: '8 récoltes par jour (cheval ou tracteur).' },
      { cost: 1000, rank: 4, capacity: Infinity, requires: 'tractor', text: 'Récolte tout le terrain (tracteur).' },
    ],
    description: 'Récolte les cultures mûres (prix normal, sans le bonus « à la main »).',
  },
  {
    id: 'fruitPicker',
    name: 'Cueilleuse',
    scope: 'lot',
    lotTypes: ['orchard'],
    kind: 'pick',
    fuel: 1,
    upkeep: 0,
    passes: [0.3],
    step: 0.015,
    levels: [{ cost: 400, rank: 3, capacity: Infinity, requires: null, text: 'Cueille tous les fruits mûrs du verger.' }],
    description: 'Cueille les fruits mûrs du verger.',
  },
  {
    id: 'collector',
    name: 'Collecteur',
    scope: 'shelter',
    lotTypes: ['meadow', 'yard', 'pond'],
    kind: 'collect',
    fuel: 0,
    upkeep: 0,
    passes: [0.4, 0.8],
    levels: [{ cost: 250, rank: 3, capacity: Infinity, requires: null, text: 'Ramasse l\'abri deux fois par jour.' }],
    description: 'Ramasse la production d\'un abri deux fois par jour.',
  },
  {
    id: 'tractor',
    name: 'Tracteur',
    scope: 'farm',
    lotTypes: [],
    kind: null,
    fuel: 4,
    upkeep: 0,
    passes: [],
    levels: [{ cost: 2000, rank: 4, capacity: Infinity, requires: null, text: 'Tire les machines niv. 2 ; jardiniers + 25 % d\'actions.' }],
    description: 'Permet les machines niveau 2 et aide les jardiniers ; carburant les jours où il tire une machine.',
  },
  {
    id: 'waterTower',
    name: 'Château d\'eau',
    scope: 'farm',
    lotTypes: [],
    kind: 'water',
    fuel: 0,
    upkeep: 0,
    passes: [0],
    phase: 'B',
    levels: [{ cost: 3000, rank: 5, capacity: Infinity, requires: null, text: 'Arroseurs sans entretien ; la serre est arrosée chaque aube.' }],
    description: 'Les arroseurs ne coûtent plus d\'entretien ; la serre est arrosée chaque aube.',
  },
  {
    id: 'conveyor',
    name: 'Convoyeur',
    scope: 'farm',
    lotTypes: [],
    kind: 'convey',
    fuel: 0,
    upkeep: 1,
    passes: [0],
    phase: 'B',
    levels: [{ cost: 2500, rank: 5, capacity: Infinity, requires: null, text: 'Remplit les places libres des ateliers avec le stock du grenier.' }],
    description: 'Quand une place d\'atelier se libère, elle se remplit avec le stock du grenier (le plus cher d\'abord).',
  },
];

export const MACHINES_BY_ID = Object.fromEntries(MACHINES.map((m) => [m.id, m]));
export const MACHINE_IDS = MACHINES.map((m) => m.id);

export function getMachine(id) {
  return MACHINES_BY_ID[id] || null;
}

/** Clé d'une machine dans state.career.machines. */
export function machineKey(id, place) {
  const def = MACHINES_BY_ID[id];
  if (!def) return null;
  return def.scope === 'farm' ? id : `${id}@${place}`;
}

/** Terrain des machines de ferme (bande de la maison). */
export const FARM_MACHINE_LOT = 'home';
