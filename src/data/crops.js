// Cultures — données pures.
// Ajouter une culture = ajouter une entrée ici (et ses sprites dans le rendu).
//
// Champs :
//   id          identifiant anglais (clé des sprites et des sauvegardes)
//   name        nom affiché
//   seasons     saisons où l'on peut la planter
//   growDays    jours de pousse (arrosée chaque jour) avant maturité
//   seedCost    prix de la graine
//   sellPrice   prix de vente de base à la récolte
//   frostHardy  true si elle résiste au gel du 1er jour d'hiver

export const CROPS = [
  { id: 'carrot', name: 'Carotte', seasons: ['spring', 'autumn'], growDays: 2, seedCost: 4, sellPrice: 10, frostHardy: false },
  { id: 'turnip', name: 'Navet', seasons: ['spring', 'autumn', 'winter'], growDays: 3, seedCost: 6, sellPrice: 15, frostHardy: true },
  { id: 'wheat', name: 'Blé', seasons: ['spring', 'summer'], growDays: 4, seedCost: 5, sellPrice: 16, frostHardy: false },
  { id: 'cabbage', name: 'Chou', seasons: ['autumn', 'winter'], growDays: 4, seedCost: 8, sellPrice: 21, frostHardy: true },
  { id: 'tomato', name: 'Tomate', seasons: ['summer'], growDays: 5, seedCost: 12, sellPrice: 38, frostHardy: false },
  { id: 'corn', name: 'Maïs', seasons: ['summer', 'autumn'], growDays: 6, seedCost: 15, sellPrice: 50, frostHardy: false },
  { id: 'sunflower', name: 'Tournesol', seasons: ['summer'], growDays: 5, seedCost: 10, sellPrice: 32, frostHardy: false },
];

/** Accès par identifiant. */
export const CROPS_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export function getCrop(id) {
  return CROPS_BY_ID[id] || null;
}
