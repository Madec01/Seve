// Produits transformés (v3) — données pures. Voir docs/GAME_DESIGN.md § 12.2 et src/core/processing.js.
//
// Champs :
//   id        identifiant anglais (clé des sprites « product.<id> » et des sauvegardes)
//   name      nom affiché
//   building  atelier qui le fabrique (investissement de type 'upgrade' avec l'effet `processing`)
//   source    'harvest' : entre à la récolte d'une culture ; 'animal' : lait versé à l'aube
//   input     culture (source 'harvest') ou animal (source 'animal') d'origine
//   days      nombre d'aubes de travail avant la vente automatique
//   value     prix de vente de base (avant bonus de prix, recettes de grand-mère et rendement)
//   minLevel / maxLevel  niveaux du bâtiment où la recette est active (défaut : 1 à 3)

export const PRODUCTS = [
  { id: 'strawberryJam', name: 'Confiture de fraises', building: 'jamWorkshop', source: 'harvest', input: 'strawberry', days: 2, value: 46 },
  { id: 'appleJuice', name: 'Jus de pomme', building: 'jamWorkshop', source: 'harvest', input: 'apple', days: 1, value: 44 },
  { id: 'cowCheese', name: 'Fromage de vache', building: 'dairy', source: 'animal', input: 'cow', days: 2, value: 30 },
  { id: 'goatCheese', name: 'Fromage de chèvre', building: 'dairy', source: 'animal', input: 'goat', days: 2, value: 20 },
  { id: 'flour', name: 'Farine', building: 'mill', source: 'harvest', input: 'wheat', days: 1, value: 28, maxLevel: 2 },
  { id: 'bread', name: 'Pain', building: 'mill', source: 'harvest', input: 'wheat', days: 2, value: 44, minLevel: 3 },
];

export const PRODUCTS_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id) {
  return PRODUCTS_BY_ID[id] || null;
}

/** true si la recette est active au niveau `buildingLevel` du bâtiment. */
export function recipeActive(product, buildingLevel) {
  return buildingLevel >= (product.minLevel ?? 1) && buildingLevel <= (product.maxLevel ?? Infinity);
}

/**
 * Recettes d'un bâtiment. Avec `buildingLevel`, seulement celles actives à ce niveau ;
 * sans, toutes (farine et pain compris).
 */
export function productsFor(buildingId, buildingLevel) {
  return PRODUCTS.filter((p) => p.building === buildingId && (buildingLevel === undefined || recipeActive(p, buildingLevel)));
}

/** Produit fabriqué à partir de `input` par ce bâtiment à ce niveau, ou null. */
export function recipeFor(buildingId, buildingLevel, input) {
  return PRODUCTS.find((p) => p.building === buildingId && p.input === input && recipeActive(p, buildingLevel)) || null;
}

/** Bâtiment qui transforme cette matière première (culture ou animal), ou null. */
export function buildingForInput(input) {
  return PRODUCTS.find((p) => p.input === input)?.building || null;
}
