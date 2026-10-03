// Mode Carrière — terrains et aménagements (données pures). Conception : docs/CARRIERE.md § 2.
//
// Carrière v2 — carte 2D (docs/ARCHITECTURE.md, « Carrière v2 — carte 2D ») : les terrains sont des BLOCS
// d'une grille autour de la ferme de départ. La ferme de départ (maison, champ de départ, basse-cour) occupe
// le bloc (col 0, row 0) ; chaque terrain achetable est un bloc (col, row) : col −2 … 2 (0 = la colonne
// d'origine, négatif = à gauche), row 0 … 6 (vers le haut ; en row 0 seulement à côté de la ferme de départ).
// On achète un bloc libre qui TOUCHE (par un côté) un bloc possédé ou la ferme de départ.
// Les terrains possédés gardent un index d'achat (3, 4, … : ordre d'achat), leur identifiant dépend de la case.

/** Prix des terrains, selon le nombre de terrains DÉJÀ possédés (le 1er coûte 250, le 16e 37 000). */
export const LOT_PRICES = [250, 400, 600, 900, 1300, 1900, 2700, 3800, 5300, 7400, 10000, 14000, 18500, 24000, 30000, 37000];

/**
 * Noms fixes de la colonne d'origine (col 0), du bas vers le haut : row 1 → « Le Haut-Champ »…
 * (les rangées 7 à 12 ne servent qu'aux anciennes carrières, dont les terrains s'empilaient en colonne).
 */
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

/** Noms des colonnes de côté, de row 0 à row 6 (col −2, −1, 1, 2). */
export const SIDE_LOT_NAMES = {
  '-2': ['Le Bas-Fond', 'Les Saules', 'La Prairie Haute', 'Le Clos Martin', 'Les Bruyères', 'La Roche', 'Le Bois Joli'],
  '-1': ['Le Petit Pré', 'Le Champ du Moulin', 'Les Noisetiers', 'La Pâture', 'Le Chemin Creux', 'Les Genêts', 'La Lisière'],
  1: ['Le Jardin du Bas', 'Les Coquelicots', 'Le Champ de la Croix', 'Les Tilleuls', 'La Source', 'Les Châtaigniers', 'Le Belvédère'],
  2: ['Le Pré Carré', 'Les Grands Prés', 'La Butte', 'Le Champ Rond', 'Les Chênes', 'Le Plateau', 'La Crête'],
};

/**
 * Grille des terrains (carte 2D).
 *   cols, rows   bornes des cases ACHETABLES (la ferme de départ est la case (0, 0))
 *   home         case de la ferme de départ
 *   blockCols    largeur d'un bloc en tuiles (14 : x 0 et x 13 forêt ou haie, 12 utiles)
 *   blockRows    hauteur d'un bloc de terrain en tuiles (11 : 10 de contenu + l'allée)
 *   homeRows     hauteur du bloc de la ferme de départ en tuiles (basse-cour 11 + champ de départ 13 + maison 16)
 *   topForest    lignes de forêt au-dessus de la rangée la plus haute
 *   legacyRows   rangée la plus haute possible pour une ancienne carrière (terrains empilés en colonne 0)
 */
export const LOT_GRID = { cols: [-2, 2], rows: [0, 6], home: { col: 0, row: 0 }, blockCols: 14, blockRows: 11, homeRows: 40, topForest: 2, legacyRows: 12 };

/** Identifiant d'un terrain selon sa case : col 0 → « lot3 » (row 1), « lot4 »… ; côtés → « lot3w1 » (ouest), « lot2e1 » (est). */
export function lotIdAt(col, row) {
  if (col === 0) return `lot${row + 2}`;
  return `lot${row + 2}${col < 0 ? 'w' : 'e'}${Math.abs(col)}`;
}

/** Case d'un identifiant de terrain (null si ce n'est pas un identifiant de terrain achetable). */
export function lotCellOf(id) {
  const m = /^lot(\d+)(?:([we])(\d))?$/.exec(String(id));
  if (!m) return null;
  const row = Number(m[1]) - 2;
  const col = m[2] ? (m[2] === 'w' ? -1 : 1) * Number(m[3]) : 0;
  if (row < 0 || (col === 0 && row === 0) || (m[2] && Number(m[3]) === 0)) return null;
  return { col, row };
}

/** La case est-elle dans la grille des terrains achetables ? */
export function inLotGrid(col, row) {
  const g = LOT_GRID;
  return Number.isInteger(col) && Number.isInteger(row) && col >= g.cols[0] && col <= g.cols[1] && row >= g.rows[0] && row <= g.rows[1] && !(col === 0 && row === 0);
}

/** Nom fixe d'une case. */
export function lotNameAt(col, row) {
  if (col === 0) return LOT_NAMES[row - 1] || `Terrain ${row}`;
  return SIDE_LOT_NAMES[String(col)]?.[row] || `Terrain ${col < 0 ? 'ouest' : 'est'} ${row}`;
}

/** Index du premier terrain achetable (0 maison, 1 champ de départ, 2 basse-cour). */
export const FIRST_LOT_INDEX = 3;

/** Identifiant d'un terrain à partir de son index (anciennes carrières : terrains empilés en colonne 0). */
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
  // (lot 4, § 17.5.4) Mare au rang 3 (300) et serre au rang 2 (500), sans « bientôt » : l'hiver vit plus tôt.
  { id: 'pond', name: 'Mare', cost: 300, rank: 3, max: 1, plots: null, slots: 0, building: 'duckPond' },
  { id: 'greenhouse', name: 'Serre', cost: 500, rank: 2, max: 1, plots: { env: 'greenhouse', count: 4, cols: 4 }, slots: 0, building: 'greenhouse' },
];

export const LOT_TYPES_BY_ID = Object.fromEntries(LOT_TYPES.map((t) => [t.id, t]));

export function getLotType(id) {
  return LOT_TYPES_BY_ID[id] || null;
}

/** Aménagements qu'on peut choisir pour un terrain acheté (tous sauf les types fixes). */
export const DEVELOP_TYPES = LOT_TYPES.map((t) => t.id);

/** Types des terrains fixes (en plus de LOT_TYPES) : noms affichés. */
export const FIXED_TYPE_NAMES = { home: 'Maison', yard: 'Basse-cour' };

/** Nombre de terrains possédés au plus selon le rang (§ 1.5) : rang 1 → 1, 2 → 3, 3 → 6, 4 → 9, 5 → 12, 6 → 16. */
export const MAX_LOTS_BY_RANK = { 1: 1, 2: 3, 3: 6, 4: 9, 5: 12, 6: 16 };
