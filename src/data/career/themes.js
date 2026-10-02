// Lot 3 « Variété » — années à thème de la carrière (C5), données pures. Règles : docs/GAME_DESIGN.md § 16.6 ;
// moteur : src/core/career/themes.js. Rien de ce fichier n'est lu par une partie de niveau.
//
// À partir de la 2e année, chaque année a un thème : une vedette (culture, fruit ou produit) vendue +25 % toute
// l'année et deux fois plus demandée par le tableau et la charrette, des effets doux toute l'année, une fête
// spéciale (un jour du calendrier en plus, jamais le même qu'une autre fête ni que le colporteur : jours 5 et 6) et
// un visiteur unique (une fois dans l'année, un cadeau gratuit ; il attend la réponse jusqu'à la fin de la saison).
// Chaque thème est au moins à moitié positif : trois avantages au moins, au plus une petite contrepartie.

/** Règles communes : vedette × starFactor ; thèmes à partir de l'année firstYear ; tirage sans répétition (sac). */
export const THEME_RULES = { starFactor: 1.25, firstYear: 2, installName: 'L\'année de l\'installation' };

/**
 * Thèmes. star : { kind: 'crop' | 'product', ids } ; effects : textes (une ligne chacun) ; festival : { name, seasonId,
 * day, text } ; visitor : { id (portrait.theme.<id>), name, seasonId, day, text, gift } ; values : chiffres du thème.
 */
export const THEMES = [
  {
    id: 'bees',
    name: 'L\'année des abeilles',
    rank: 2,
    star: { kind: 'crop', ids: ['sunflower'] },
    effects: ['Tournesols vendus +25 %.', 'Ruches : miel +50 %.'],
    festival: { name: 'Fête du miel', seasonId: 'summer', day: 2, text: 'Miel × 3 aujourd\'hui, récoltes +10 %.' },
    visitor: { id: 'margot', name: 'Margot l\'apicultrice', seasonId: 'spring', day: 2, text: 'Margot vous offre une ruche pleine d\'abeilles.', gift: 'hive' },
    values: { hiveIncome: 1.5, festivalHives: 3, festivalCrops: 1.1, giftCoins: 60 },
  },
  {
    id: 'cheese',
    name: 'L\'année du fromage',
    rank: 3,
    star: { kind: 'product', ids: ['cowCheese', 'goatCheese'] },
    effects: ['Fromages vendus +25 %.', 'Fromagerie : une place de plus dès la visite d\'Anselme.'],
    festival: { name: 'Foire aux fromages', seasonId: 'autumn', day: 7, text: 'Produits transformés × 1,5 aujourd\'hui.' },
    visitor: { id: 'anselme', name: 'Anselme le fromager', seasonId: 'summer', day: 2, text: 'Anselme vous apprend un tour de main : une place de plus à la fromagerie cette année.', gift: 'dairyPlace' },
    values: { festivalProducts: 1.5, giftCoins: 80 },
  },
  {
    id: 'tourism',
    name: 'Le boom touristique',
    rank: 2,
    star: { kind: 'crop', ids: ['strawberry'] },
    effects: ['Fraises vendues +25 %.', 'Touristes deux fois plus souvent, +50 % par passage.', 'Chambre d\'hôte +25 %.'],
    festival: { name: 'Nuit des lampions', seasonId: 'summer', day: 7, text: 'Chambre d\'hôte × 2 et touristes garantis.' },
    visitor: { id: 'journalist', name: 'Une journaliste de « Campagne & Jardins »', seasonId: 'spring', day: 7, text: 'La journaliste écrit un bel article sur votre ferme : 10 écus et un panneau souvenir.', gift: 'magazine' },
    values: { touristWeight: 2, touristPass: 1.5, guestHouse: 1.25, festivalGuests: 2, festivalPasses: 3, giftEcus: 10, cosmeticId: 'sign.magazine' },
  },
  {
    id: 'giants',
    name: 'L\'année des géants',
    rank: 3,
    star: { kind: 'crop', ids: ['pumpkin'] },
    effects: ['Citrouilles vendues +25 %.', 'Légumes géants deux fois plus fréquents.', 'Graines de citrouille −20 %.'],
    festival: { name: 'Concours du plus gros légume', seasonId: 'autumn', day: 4, text: 'Citrouilles × 1,5 aujourd\'hui, géants +50 %.' },
    visitor: { id: 'gaspard', name: 'Gaspard, jardinier champion', seasonId: 'summer', day: 2, text: 'Gaspard vous laisse 6 graines de citrouille de concours.', gift: 'pumpkinSeeds' },
    values: { giantChance: 2, seedFactor: 0.8, seedCrop: 'pumpkin', festivalCrop: 1.5, festivalGiant: 1.5, freeSows: 6 },
  },
  {
    id: 'frogs',
    name: 'L\'année des grenouilles',
    rank: 1,
    star: { kind: 'crop', ids: ['cabbage'] },
    effects: ['Choux vendus +25 %.', 'Les jours nuageux, parfois une petite averse à l\'aube.', 'Corbeaux deux fois plus rares.', 'L\'heure dorée est plus rare.'],
    festival: { name: 'Bal des grenouilles', seasonId: 'spring', day: 7, text: 'Tout est arrosé, récoltes +10 % aujourd\'hui.' },
    visitor: { id: 'firmin', name: 'Firmin le vieux pêcheur', seasonId: 'autumn', day: 3, text: 'Firmin vous offre sa canne : poissons +50 % toute l\'année.', gift: 'rod' },
    values: { showerChance: 0.3, crowWeight: 0.5, goldenHour: 0.5, festivalCrops: 1.1, fishFactor: 1.5, giftCoins: 40 },
  },
  {
    id: 'orchard',
    name: 'L\'année des vergers',
    rank: 2,
    star: { kind: 'crop', ids: ['apple'] },
    effects: ['Paniers de pommes vendus +25 %.', 'Les fruits mûrissent 20 % plus vite.'],
    festival: { name: 'Fête de la pomme', seasonId: 'autumn', day: 7, text: 'Paniers de fruits et jus × 1,5 aujourd\'hui.' },
    visitor: { id: 'mathis', name: 'Mathis le pépiniériste', seasonId: 'spring', day: 7, text: 'Mathis plante un pommier adulte dans votre verger.', gift: 'tree' },
    values: { fruitSpeed: 1.2, festivalFruit: 1.5, giftCoins: 80 },
  },
  {
    id: 'bread',
    name: 'L\'année du pain',
    rank: 1,
    star: { kind: 'crop', ids: ['wheat'] },
    effects: ['Blé vendu +25 %.', 'Farine et pain +20 %.', 'Graines de blé −20 %.'],
    festival: { name: 'Fête du pain', seasonId: 'summer', day: 7, text: 'Blé × 1,25 et produits du moulin × 1,5 aujourd\'hui.' },
    visitor: { id: 'jeanne', name: 'Jeanne la meunière', seasonId: 'spring', day: 2, text: 'Jeanne vous laisse 10 semis de blé et 40 pièces.', gift: 'wheatSeeds' },
    values: { millProducts: 1.2, seedFactor: 0.8, seedCrop: 'wheat', festivalWheat: 1.25, festivalMill: 1.5, freeSows: 10, giftCoins: 40 },
  },
  {
    id: 'markets',
    name: 'L\'année des grands marchés',
    rank: 2,
    star: { kind: 'crop', ids: ['tomato'] },
    effects: ['Tomates vendues +25 %.', 'Cours du marché plus vifs (× 0,7 à × 1,45).'],
    festival: { name: 'Grand marché', seasonId: 'spring', day: 7, text: 'Toutes les ventes +20 % aujourd\'hui.' },
    visitor: { id: 'wholesaler', name: 'Un grossiste de la ville', seasonId: 'autumn', day: 3, text: 'Le grossiste rachète tout le grenier 30 % au-dessus du cours du jour.', gift: 'wholesale' },
    values: { marketMin: 0.7, marketMax: 1.45, festivalSales: 1.2, wholesale: 1.3 },
  },
  {
    id: 'lights',
    name: 'L\'année des lumières',
    rank: 1,
    star: { kind: 'crop', ids: ['turnip'] },
    effects: ['Navets vendus +25 %.', 'Produits transformés vendus en hiver +15 %.', 'Équipe joyeuse la semaine de la fête.'],
    festival: { name: 'Fête des lumières', seasonId: 'winter', day: 2, text: 'Produits transformés × 1,3 aujourd\'hui, lampions.' },
    visitor: { id: 'northpeddler', name: 'Le colporteur du Nord', seasonId: 'winter', day: 7, text: 'Le colporteur du Nord vous offre 8 graines rares de poireau et 5 écus.', gift: 'leekSeeds' },
    values: { winterProducts: 1.15, festivalProducts: 1.3, rareSeeds: 8, giftEcus: 5 },
  },
];

export const THEMES_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/** Produits du moulin (année du pain). */
export const MILL_PRODUCTS = ['flour', 'bread'];
