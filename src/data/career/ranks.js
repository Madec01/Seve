// Mode Carrière — rangs de la ferme (données pures). Conception : docs/CARRIERE.md § 1.5.
//
// Un rang s'obtient dès que le patrimoine atteint le seuil (× 2 en saisons de 10 jours, × 3,5 en 14 : patrimonyScale) ET que
// ses deux objectifs sont remplis. Un rang acquis l'est pour toujours. Les objectifs comptés au fil des jours
// (récoltes, produits) sont × durée / 7 (objectiveTargetFor) ; « {n} » dans un libellé = la cible de la carrière.
//
// Types d'objectif (évalués dans src/core/career/ranks.js) :
//   lots {target}                terrains achetés
//   harvests {target}            récoltes (cumul de la carrière)
//   staff {target}               employés en même temps
//   productsSold {target}        produits transformés vendus (cumul de la carrière)
//   plots {target}               parcelles cultivables ouvertes (champs, verger, serre)
//   quests {target}              quêtes de Joseph réussies
//   species {target}             espèces d'animaux en même temps
//   buildingLevel {buildingId, target}  niveau d'un bâtiment
//   contestsWon {target}         comices réussis (les 3 épreuves)
//
// `features` : déblocages sans donnée de CORE-A (machines, embauche, quêtes…), pour la liste affichée.

export const RANKS = [
  {
    rank: 1,
    name: 'Petite ferme',
    title: { fermier: 'Jeune fermier', fermiere: 'Jeune fermière' },
    patrimony: 0,
    objectives: [],
    features: [],
  },
  {
    rank: 2,
    name: 'Ferme familiale',
    title: { fermier: 'Fermier', fermiere: 'Fermière' },
    patrimony: 1200,
    objectives: [
      { id: 'firstLot', label: 'Acheter un premier terrain', type: 'lots', target: 1 },
      // 100 au § 1.5 ; 80 après la simulation du socle ; 60 après la simulation complète (CORE-C : le joueur
      // tranquille passe aussi ses gestes à ramasser les abris, aux visiteurs et à Joseph : ≈ 75 récoltes la
      // première année ; 60 → rang 2 à la fin de l'année 1 dans ≈ 80 % des carrières, cible ≥ 70 %).
      { id: 'harvests', label: 'Faire {n} récoltes', type: 'harvests', target: 60 },
    ],
    features: [
      { kind: 'feature', id: 'hire', name: 'Embauche' },
      { kind: 'machine', id: 'sprinklers', name: 'Arroseurs de terrain' },
      { kind: 'feature', id: 'quests', name: 'Quêtes de Joseph' },
    ],
  },
  {
    rank: 3,
    name: 'Belle ferme',
    title: { fermier: 'Fermier reconnu', fermiere: 'Fermière reconnue' },
    patrimony: 4000,
    objectives: [
      { id: 'firstHire', label: 'Embaucher un employé', type: 'staff', target: 1 },
      // 30 au § 1.5 ; 20 après simulation (au rang 2, seul l'atelier de confitures transforme : fraises, pommes) ;
      // 15 après l'intégration (le débutant qui ne sème pas exprès des fraises restait des années au rang 2 avec
      // 10 à 16 produits : rang 3 à l'an 5 dans 65 % → cible 70 %).
      { id: 'products', label: 'Vendre {n} produits transformés', type: 'productsSold', target: 15, tip: 'Une cour des ateliers, l\'atelier de confitures, et des fraises semées au printemps et en été : chaque pot vendu compte.' },
    ],
    features: [
      { kind: 'machine', id: 'seeder', name: 'Semoir' },
      { kind: 'machine', id: 'harvester', name: 'Moissonneuse' },
      { kind: 'machine', id: 'fruitPicker', name: 'Cueilleuse' },
      { kind: 'machine', id: 'collector', name: 'Collecteur' },
    ],
  },
  {
    rank: 4,
    name: 'Grande ferme',
    title: { fermier: 'Maître fermier', fermiere: 'Maîtresse fermière' },
    patrimony: 12000,
    objectives: [
      { id: 'plots48', label: '48 parcelles cultivables', type: 'plots', target: 48 },
      { id: 'quests3', label: 'Réussir 3 quêtes de Joseph', type: 'quests', target: 3 },
    ],
    features: [
      { kind: 'machine', id: 'tractor', name: 'Tracteur' },
      { kind: 'feature', id: 'machines2', name: 'Machines niveau 2' },
    ],
  },
  {
    rank: 5,
    name: 'Exploitation modèle',
    title: { fermier: 'Grand exploitant', fermiere: 'Grande exploitante' },
    patrimony: 30000,
    objectives: [
      { id: 'staff5', label: 'Avoir 5 employés', type: 'staff', target: 5 },
      { id: 'species6', label: 'Élever 6 espèces d\'animaux', type: 'species', target: 6 },
    ],
    features: [
      { kind: 'machine', id: 'waterTower', name: 'Château d\'eau' },
      { kind: 'machine', id: 'conveyor', name: 'Convoyeur' },
    ],
  },
  {
    rank: 6,
    name: 'Domaine',
    title: { fermier: 'Seigneur du domaine', fermiere: 'Dame du domaine' },
    // 70 000 au § 1.5 ; 100 000 après la simulation complète (employés et machines de CORE-B, événements de
    // CORE-C) : Domaine vers l'année 9 pour le joueur tranquille (70 000 : année 8), année 6 pour l'appliqué.
    patrimony: 100000,
    objectives: [
      { id: 'manor', label: 'Maison au niveau Manoir', type: 'buildingLevel', buildingId: 'house', target: 5 },
      { id: 'contestAll', label: 'Réussir les 3 épreuves d\'un comice', type: 'contestsWon', target: 1 },
    ],
    features: [
      { kind: 'feature', id: 'domainSign', name: 'Panneau « Domaine »' },
      { kind: 'feature', id: 'regionalFair', name: 'Comice régional' },
    ],
  },
];

export const MAX_RANK = RANKS.length;

export function getRank(rank) {
  return RANKS[rank - 1] || null;
}

/** Tous les objectifs, dans l'ordre des rangs. */
export const ALL_OBJECTIVES = RANKS.flatMap((r) => r.objectives.map((o) => ({ ...o, rank: r.rank })));
