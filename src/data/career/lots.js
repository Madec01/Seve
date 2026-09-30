// Mode Carrière — terrains et aménagements (données pures). Conception : docs/CARRIERE.md § 2.
//
// Le monde est une colonne : en bas la maison (index 0), le champ de départ (1), la basse-cour (2) ;
// au-dessus, les terrains achetés un par un (index 3, 4, … → identifiants « lot3 », « lot4 »…).

/** Prix des 12 terrains, dans l'ordre d'achat (à régler). */
export const LOT_PRICES = [250, 400, 600, 900, 1300, 1900, 2700, 3800, 5300, 7400, 10000, 14000];

/** Noms fixes des terrains, par ordre d'achat. */
export const LOT_NAMES = [
  'Le Haut-Champ',
  'Le Pré du ruisseau',
  'La Combe',
  'Les Terres Joseph',
  'Le Clos des Pommiers',
  'La Grande Pièce',
  'Le Coteau',
  'Le Bois Brûlé',
  'La Fontaine',
  'Les Hauts de la Forêt',
  'La Clairière',
  'Le Sommet',
];

/** Index du premier terrain achetable (0 maison, 1 champ de départ, 2 basse-cour). */
export const FIRST_LOT_INDEX = 3;

/** Identifiant d'un terrain à partir de son index. */
export function lotIdFor(index) {
  return `lot${index}`;
}

/**
 * Terrains fixes de la ferme de départ.
 *   type : 'home' (maison, puits, grenier, étal), 'field' (champ de départ 4 × 4), 'yard' (basse-cour :
 *          poulailler offert à gauche, emplacement libre à droite)
 */
export const FIXED_LOTS = [
  { id: 'home', index: 0, type: 'home', name: 'La maison' },
  { id: 'start', index: 1, type: 'field', name: 'Le champ de départ' },
  { id: 'yard', index: 2, type: 'yard', name: 'La basse-cour' },
];

/** Champ de départ : 16 parcelles, 12 ouvertes (bloc 4 × 3 en haut), 4 à acheter (40 + 10 × déjà achetées). */
export const START_FIELD = { cols: 4, rows: 4, open: 12, plotCost: { base: 40, step: 10 } };

/**
 * Aménagements (§ 2.3).
 *   cost     prix de l'aménagement (le terrain est payé à part)
 *   rank     rang qui le débloque
 *   max      nombre au plus dans la ferme (le champ de départ compte pour un champ, la basse-cour pour un pré)
 *   plots    parcelles créées (env : 'field' | 'orchard' | 'greenhouse'), cols : largeur logique (rendu)
 *   slots    emplacements de bâtiment (abris et chambre d'hôte : pré ; ateliers : cour des ateliers)
 *   building bâtiment créé avec l'aménagement (serre, mare)
 *   phase    'B' : contenu de la phase B (utilisable, mais décor et équilibrage à venir)
 */
export const LOT_TYPES = [
  { id: 'wild', name: 'Friche', cost: 0, rank: 1, max: Infinity, plots: null, slots: 0 },
  { id: 'field', name: 'Champ', cost: 150, rank: 1, max: 6, plots: { env: 'field', count: 16, cols: 4 }, slots: 0 },
  { id: 'meadow', name: 'Pré', cost: 120, rank: 1, max: 4, plots: null, slots: 2 },
  { id: 'orchard', name: 'Verger', cost: 100, rank: 2, max: 2, plots: { env: 'orchard', count: 9, cols: 3 }, slots: 0 },
  { id: 'workshops', name: 'Cour des ateliers', cost: 100, rank: 2, max: 3, plots: null, slots: 2 },
  { id: 'pond', name: 'Mare', cost: 400, rank: 4, max: 1, plots: null, slots: 0, building: 'duckPond', phase: 'B' },
  { id: 'greenhouse', name: 'Serre', cost: 800, rank: 3, max: 1, plots: { env: 'greenhouse', count: 4, cols: 4 }, slots: 0, building: 'greenhouse', phase: 'B' },
];

export const LOT_TYPES_BY_ID = Object.fromEntries(LOT_TYPES.map((t) => [t.id, t]));

export function getLotType(id) {
  return LOT_TYPES_BY_ID[id] || null;
}

/** Aménagements qu'on peut choisir pour un terrain acheté (tous sauf les types fixes). */
export const DEVELOP_TYPES = LOT_TYPES.map((t) => t.id);

/** Types des terrains fixes (en plus de LOT_TYPES) : noms affichés. */
export const FIXED_TYPE_NAMES = { home: 'Maison', yard: 'Basse-cour' };

/** Nombre de terrains possédés au plus selon le rang (§ 1.5) : rang 1 → 1, 2 → 3, 3 → 6, 4 → 9, 5+ → 12. */
export const MAX_LOTS_BY_RANK = { 1: 1, 2: 3, 3: 6, 4: 9, 5: 12, 6: 12 };
