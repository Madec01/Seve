// Lot 3 « Variété » — données pures : tableau du village (C1), cadeau de saison (C2), charrette du marché (C3),
// défis de la saison (C4), jour du colporteur et graines rares (C7). Règles : docs/GAME_DESIGN.md § 16 ;
// contrat : docs/ARCHITECTURE.md, « Lot 3 — contrats ». Les années à thème (C5) : src/data/career/themes.js.
// Réglages obtenus avec tools/simulate.js --compare-variety et tools/simulate-career.js --compare-variety.
//
// Règles d'or : aucun stress (rien n'est perdu, aucun refus pénalisé, rien ne presse), toujours faisable (un seul
// générateur de demandes : src/core/requests.js), le joueur au centre (salariés et machines ne livrent jamais).

export const VARIETY_VERSION = 1;

/** Parties du lot (createGame / createCareer : variety: { board, cards, … }). `themes` : carrière seulement. */
export const VARIETY_PARTS = ['board', 'cards', 'cart', 'challenges', 'merchant', 'themes'];

// ── C1 — Le tableau du village ─────────────────────────────────────────────────────────────────

/**
 * Tableau : `slots` commandes ; niveau 1 : à partir de l'aube du jour `level1Start` (après les premiers gestes du
 * tutoriel) ; ailleurs dès le 1er jour. Une relance gratuite par jour. Horizon du générateur : jours restants dans la
 * saison (aujourd'hui compris), au moins `minHorizon`.
 */
export const BOARD = { slots: 3, level1Start: 5, minHorizon: 3 };

/** Taux de prime d'une commande (poids) ; commande à deux lignes +0,1 (au plus ×1,5) ; carte « crieur » +0,1 (×1,6). */
export const ORDER_RATES = [
  { rate: 1.05, weight: 6 },
  { rate: 1.1, weight: 3 },
  { rate: 1.15, weight: 1 },
];
export const ORDER_RATE_RULES = { twoLines: 0.1, twoLinesMax: 1.5, crier: 0.1, crierMax: 1.6 };

/**
 * Taille d'une ligne selon le prix de vente de base de la culture : bon marché (< 20), moyenne (20 à 39), chère (≥ 40).
 * Carrière : + ⌊(rang − 1) / perRank⌋. Plafond : ⌊parcelles de champ ouvertes / plotsPerUnit⌋ (au moins minCap) ;
 * fruits : au plus perTree paniers par arbre adulte. Ligne secondaire : taille de sa catégorie − 1 (au moins 2).
 */
export const ORDER_SIZES = {
  cheap: { maxPrice: 20, levels: [3, 5], perRank: 2 },
  medium: { maxPrice: 40, levels: [2, 4], perRank: 2 },
  dear: { maxPrice: Infinity, levels: [2, 3], perRank: 3 },
  plotsPerUnit: 2,
  minCap: 2,
  perTree: 2,
  secondaryMin: 2,
};

/** Carrière, rang ≥ minRank : `chance` des commandes ont deux lignes (deux cultures différentes). */
export const ORDER_TWO_LINES = { minRank: 3, chance: 0.3 };

/**
 * Poids du tirage des cultures (générateur commun) : 1 ; × notGrowing si elle ne pousse pas encore (tableau) ;
 * × star (vedette de l'année, carrière) ; × favorite (préférée du client tiré, tableau) ; × yesterday si elle était
 * déjà demandée hier.
 */
export const FEASIBLE_WEIGHTS = { base: 1, notGrowing: 3, star: 2, favorite: 2, yesterday: 0.5 };

/** Les douze clients du tableau (Joseph n'y est jamais : il a ses quêtes). Portrait : `portrait.client.<id>`. */
export const CLIENTS = [
  { id: 'rose', name: 'Mme Rose', title: 'la fleuriste', favorites: ['sunflower', 'strawberry'], text: 'Pour égayer mes bouquets du dimanche.', thanks: 'Que c\'est joli ! Merci !' },
  { id: 'paulo', name: 'Paulo', title: 'le boulanger', favorites: ['wheat', 'apple', 'strawberry'], text: 'Pour mes tartes de demain matin.', thanks: 'Ça sent déjà bon !' },
  { id: 'lili', name: 'Lili', title: 'la petite voisine', favorites: ['carrot', 'turnip'], text: 'C\'est pour le goûter de mon lapin Caramel !', thanks: 'Caramel te dit merci !' },
  { id: 'garnier', name: 'M. Garnier', title: 'l\'instituteur', favorites: ['potato', 'cabbage', 'turnip'], text: 'Pour la cantine de l\'école.', thanks: 'Les enfants vont se régaler.' },
  { id: 'chevalier', name: 'Mme Chevalier', title: 'l\'aubergiste', favorites: ['tomato', 'pumpkin', 'cabbage'], text: 'Pour la soupe du soir à l\'auberge.', thanks: 'Mes clients en redemanderont !' },
  { id: 'fabre', name: 'Le père Fabre', title: 'le pêcheur', favorites: ['zucchini', 'tomato', 'corn'], text: 'Pour mon pique-nique au bord de l\'étang.', thanks: 'Ça mord mieux le ventre plein.' },
  { id: 'perrin', name: 'Mlle Perrin', title: 'la musicienne', favorites: ['strawberry', 'apple'], text: 'Une petite douceur avant le concert.', thanks: 'Je jouerai un air pour vous !' },
  { id: 'maire', name: 'M. le maire', title: 'le maire du village', favorites: ['corn', 'pumpkin', 'wheat'], text: 'Pour le buffet de la mairie.', thanks: 'Au nom du village, merci !' },
  { id: 'odette', name: 'Mamie Odette', title: 'la grand-mère du village', favorites: ['strawberry', 'apple', 'cabbage'], text: 'Pour mes bocaux de l\'hiver.', thanks: 'Passe goûter quand tu veux.' },
  { id: 'leon', name: 'Léon', title: 'le facteur', favorites: ['carrot', 'apple', 'wheat'], text: 'Ça me donnera des jambes pour ma tournée.', thanks: 'Je file, merci !' },
  { id: 'morel', name: 'Mme Morel', title: 'la couturière', favorites: ['sunflower', 'turnip'], text: 'Pour teindre mes laines, croyez-le ou non.', thanks: 'Mes pelotes seront superbes.' },
  { id: 'twins', name: 'Zoé et Bastien', title: 'les jumeaux', favorites: ['corn', 'pumpkin', 'carrot'], text: 'Pour notre cabane secrète (chut !).', thanks: 'Promis, on ne dira rien !' },
];
export const CLIENTS_BY_ID = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));

// ── C3 — La charrette du marché ────────────────────────────────────────────────────────────────

/**
 * Charrette : arrive à l'aube du 1er jour de chaque saison (niveau 1 : à partir de l'été ; carrière : dès l'été de la
 * 1re année ; l'hiver seulement si une culture est faisable) ; part le soir du dernier jour, avant le fermage.
 *   crates : 3 ; niveau 4 et toute charrette d'hiver : 2 ; carrière : 3, 4 au rang ≥ careerFourAt
 *   niveaux : N = arrondi(levelBase × parcelles ouvertes / 12 × durée / 7), entre levelMin et levelMax
 *   carrière : N = arrondi((careerBase + careerPerRank × (rang − 1)) × durée / 7), au plus la moitié des parcelles
 *              de champ ouvertes, au moins careerMin
 *   prime au départ : share × valeur de base chargée ; tout plein : + fullShare et fullEcus écus ; cheval : × 2.
 */
export const CART = {
  crates: 3,
  smallCrates: 2,
  smallLevels: [4],
  careerCrates: 3,
  careerFourAt: 4,
  levelBase: 4,
  levelMin: 2,
  levelMax: 10,
  careerBase: 4,
  careerPerRank: 2,
  careerMin: 2,
  share: 0.05,
  fullShare: 0.05,
  fullEcus: 2,
  horseFactor: 2,
  level1From: 1, // niveau 1 : à partir de l'été (index de saison)
};

// ── C2 — Un cadeau pour la saison ──────────────────────────────────────────────────────────────

/**
 * Cartes (deux proposées à la fin de chaque saison, on en garde une).
 *   kind : 'now' (effet tout de suite), 'season' (toute la saison suivante), 'next' (la prochaine fois)
 *   text / careerText : une ligne d'effet ; when : condition (src/core/variety.js, cardPossible)
 */
export const CARDS = [
  { id: 'purse', name: 'La bourse du village', kind: 'now', weight: 3, text: '+{amount} pièces tout de suite.' },
  { id: 'seedFair', name: 'Foire aux graines', kind: 'season', weight: 3, text: 'Graines à moitié prix les 3 premiers jours de la saison.' },
  { id: 'fertilizer', name: 'Sac d\'engrais', kind: 'season', weight: 3, text: 'Tout pousse 8 % plus vite toute la saison.' },
  { id: 'hen', name: 'Une poule voyageuse', kind: 'season', careerKind: 'now', weight: 2, text: '+3 pièces chaque matin de la saison.', careerText: 'Deux poules offertes au poulailler.' },
  { id: 'watering', name: 'L\'arrosoir magique', kind: 'season', weight: 2, text: 'Chaque matin, {n} parcelles qui ont soif sont arrosées.' },
  { id: 'clover', name: 'Trèfle à quatre feuilles', kind: 'season', weight: 2, text: 'Belles et dorées deux fois plus fréquentes toute la saison.' },
  { id: 'poster', name: 'Une affiche au marché', kind: 'season', weight: 2, text: 'Récoltes vendues 4 % plus cher toute la saison.' },
  { id: 'landlord', name: 'Le geste du propriétaire', kind: 'next', weight: 2, text: 'Prochain fermage −20 %.', careerName: 'La ristourne de la coopérative', careerText: 'Prochaines charges de saison −20 %.' },
  { id: 'bees', name: 'Un essaim d\'abeilles', kind: 'now', weight: 1, text: 'Une ruche offerte, tout de suite.' },
  { id: 'crier', name: 'Le crieur du village', kind: 'season', weight: 2, text: 'Primes du tableau +10 points toute la saison.' },
  { id: 'cartHorse', name: 'Un cheval de renfort', kind: 'next', weight: 2, text: 'Prime de la prochaine charrette × 2.' },
  { id: 'clearing', name: 'Coup de main au défrichage', kind: 'next', weight: 1, text: 'Prochaine parcelle achetée gratuite.', careerText: 'Prochain aménagement de terrain −25 %.' },
  { id: 'seedBag', name: 'Un sachet de graines rares', kind: 'now', weight: 1, text: '{n} graines rares de {crop}, tout de suite.' },
  { id: 'recipe', name: 'La recette de saison', kind: 'season', weight: 1, text: 'Produits transformés 10 % plus chers toute la saison.' },
  { id: 'hay', name: 'Du foin parfumé', kind: 'season', weight: 1, text: 'Les animaux rapportent 10 % de plus toute la saison.' },
  { id: 'almanac', name: 'L\'almanach du berger', kind: 'now', weight: 1, text: 'Météo d\'après-demain affichée jusqu\'à la fin de la partie.', careerText: 'Météo d\'après-demain affichée jusqu\'à la fin de l\'année.' },
];
export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Chiffres des cartes. */
export const CARD_VALUES = {
  purse: { base: 12, perSeason: 4, careerBase: 20, careerPerRank: 10 },
  seedFair: { factor: 0.5, days: 3 },
  fertilizer: { growth: 0.08 },
  hen: { coins: 3, careerHens: 2 },
  watering: { plots: 3, careerPlots: 4 },
  clover: { factor: 2, maxFactor: 4 },
  poster: { factor: 1.04 },
  landlord: { factor: 0.8 },
  crier: { bonus: 0.1 },
  cartHorse: { factor: 2 },
  clearing: { careerFactor: 0.75 },
  seedBag: { seeds: 3, careerSeeds: 6 },
  recipe: { factor: 1.1 },
  hay: { factor: 1.1 },
};

// ── C4 — Les défis de la saison ────────────────────────────────────────────────────────────────

/**
 * Défis : trois proposés par saison, on en garde 1 ou 2 ; trois paliers (bronze, argent, or) cumulés.
 *   targets : bronze / argent / or ; scale : 'k' (× k), 'kMin1' (× max(1, k)), 'days' (× durée / 7), 'trees'
 *   (× max(1, arbres adultes / 2)), 'price' (× k × prix des récoltes du mode), null (fixe) ; capFeasible : or
 *   plafonné au nombre de cultures faisables / semables ; capCrates : au plus le nombre de caisses ; perRank :
 *   carrière + rang ; mode : 'levels' | 'career' (sinon les deux).
 * k = (parcelles de champ ouvertes au début de la saison / 12) × (durée de la saison / 7), entre kMin et kMax.
 */
export const CHALLENGE_RULES = { kMin: 0.5, kMax: 4, keepMax: 2, offered: 3 };

export const CHALLENGES = [
  { id: 'harvests', name: 'Belle cueillette', text: 'Récolter {n} fois.', targets: [20, 36, 54], scale: 'k', weight: 3 },
  { id: 'sales', name: 'Bon marché', text: 'Vendre pour {n} pièces de récoltes.', targets: [300, 520, 760], scale: 'price', weight: 3 },
  { id: 'variety', name: 'Potager varié', text: 'Récolter {n} cultures différentes.', targets: [3, 4, 6], scale: null, capFeasible: true, weight: 2 },
  { id: 'sowing', name: 'Semeur curieux', text: 'Semer {n} cultures différentes.', targets: [4, 5, 6], scale: null, capFeasible: true, weight: 2 },
  { id: 'care', name: 'Aux petits soins', text: 'Récolter {n} culture{s} arrosée{s} chaque jour.', targets: [6, 12, 20], scale: 'k', weight: 2 },
  { id: 'quality', name: 'La main verte', text: 'Récolter {n} belle{s} ou dorée{s}.', targets: [1, 3, 5], scale: 'kMin1', weight: 1 },
  { id: 'orders', name: 'Ami du village', text: 'Livrer {n} commande{s} du tableau.', targets: [2, 3, 5], scale: null, weight: 2 },
  { id: 'crates', name: 'La charrette pleine', text: 'Remplir {n} caisse{s} de la charrette.', targets: [1, 2, 3], scale: null, capCrates: true, weight: 2 },
  { id: 'products', name: 'Fait maison', text: 'Vendre {n} produit{s} transformé{s}.', targets: [3, 6, 9], scale: null, perRank: true, weight: 2 },
  { id: 'apples', name: 'Paniers du verger', text: 'Récolter {n} panier{s} de fruits.', targets: [2, 4, 6], scale: 'trees', weight: 1 },
  { id: 'animals', name: 'Basse-cour heureuse', text: 'Gagner {n} pièces avec les animaux.', targets: [45, 80, 120], scale: 'days', mode: 'levels', weight: 1 },
  { id: 'collect', name: 'La tournée des abris', text: 'Ramasser {n} fois les abris.', targets: [6, 11, 17], scale: 'days', mode: 'career', weight: 2 },
];
export const CHALLENGES_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

/** Récompenses des médailles (paliers cumulés) : écus (versés par l'interface) et pièces (carrière : careerCoins × rang). */
export const MEDALS = [
  { id: 'bronze', name: 'Médaille de bronze', ecus: 1, coins: 0, careerCoins: 0 },
  { id: 'silver', name: 'Médaille d\'argent', ecus: 2, coins: 10, careerCoins: 5 },
  { id: 'gold', name: 'Médaille d\'or', ecus: 4, coins: 20, careerCoins: 10 },
];

// ── C7 — Le jour du colporteur ─────────────────────────────────────────────────────────────────

/**
 * Basile le colporteur : le jour `day` de chaque saison (saison de moins de `shortSeason` jours : `shortDay`), il
 * reste `stay` jours (il repart le soir du dernier). Annoncé la veille. Étal : toujours un sachet de graines rares
 * de saison + `items` autres objets (carrière, rang ≥ careerMoreAt : `careerItems`). Un achat demande confirmation
 * au-delà de `confirmShare` de l'argent (interface).
 */
export const MERCHANT = {
  name: 'Basile le colporteur',
  portrait: 'portrait.merchant',
  day: 5,
  shortSeason: 6,
  shortDay: 4,
  stay: 2,
  items: 2,
  careerItems: 3,
  careerMoreAt: 3,
  confirmShare: 0.5,
  usedFactor: 0.7,
  line: 'Des trésors de la route, pour aujourd\'hui et demain !',
  soonText: 'Demain, Basile le colporteur passe à la ferme.',
  arriveText: 'Basile le colporteur est là (jusqu\'à demain soir).',
  leaveText: 'Basile le colporteur reprend la route. À la saison prochaine !',
};

/** Graine rare de chaque saison (sachet du colporteur, carte « Sachet de graines rares »). */
export const RARE_OF_SEASON = { spring: 'pea', summer: 'melon', autumn: 'leek', winter: 'leek' };

/** Sachets de graines rares : prix et semis (niveaux ; carrière : careerPrice, careerSeeds). */
export const RARE_SEEDS = {
  pea: { price: 30, seeds: 6, careerPrice: 60, careerSeeds: 8 },
  melon: { price: 90, seeds: 6, careerPrice: 180, careerSeeds: 8 },
  leek: { price: 50, seeds: 6, careerPrice: 100, careerSeeds: 8 },
};

/**
 * Objets de l'étal (hors sachets) : prix (niveaux / carrière ; null : pas dans ce mode ; 'used' : 70 % du prochain
 * achat), unique (une fois par partie / ferme), cosmeticId (décor débloqué ; 5 écus s'il est déjà à vous).
 */
export const MERCHANT_ITEMS = [
  { id: 'fertilizer', name: 'Engrais du colporteur', price: 35, careerPrice: 150, weight: 3, text: 'Tout le champ : +¼ de jour de pousse chaque matin pendant 3 jours.', careerText: 'Un champ pousse 25 % plus vite pendant 3 jours.', days: 3, growth: 0.25 },
  { id: 'usedCoop', name: 'Poulailler d\'occasion', price: 'used', careerPrice: null, weight: 2, text: 'Un poulailler posé tout de suite, à 70 % du prix.' },
  { id: 'hens', name: 'Deux poules', price: null, careerPrice: 40, weight: 2, text: 'Deux belles poules pondeuses pour le poulailler.', count: 2 },
  { id: 'usedHive', name: 'Ruche d\'occasion', price: 'used', careerPrice: 40, weight: 2, text: 'Une ruche pleine d\'abeilles, posée tout de suite.' },
  { id: 'copperCan', name: 'Arrosoir de cuivre', price: 60, careerPrice: 300, weight: 2, unique: true, text: 'Chaque matin, {n} parcelles qui ont soif sont arrosées.', plots: 3, careerPlots: 4 },
  { id: 'almanac', name: 'Almanach de poche', price: 20, careerPrice: 80, weight: 1, unique: true, text: 'La météo d\'après-demain, chaque jour.' },
  { id: 'horseshoe', name: 'Fer à cheval porte-bonheur', price: 45, careerPrice: 250, weight: 1, unique: true, text: 'Belles et dorées un peu plus fréquentes.', fine: 0.01, gold: 0.003 },
  { id: 'lantern', name: 'Lanterne du colporteur', price: 30, careerPrice: 60, weight: 1, text: 'Une lanterne pour décorer la ferme.', cosmeticId: 'lantern.peddler' },
  { id: 'weathervane', name: 'Girouette au coq', price: 40, careerPrice: 80, weight: 1, text: 'Une girouette au coq pour le toit.', cosmeticId: 'weathervane.rooster' },
  { id: 'heirloom', name: 'Bocal de graines anciennes', price: null, careerPrice: 120, weight: 1, text: 'Une graine ancienne, gardée pour la Vallée.' },
];
export const MERCHANT_ITEMS_BY_ID = Object.fromEntries(MERCHANT_ITEMS.map((m) => [m.id, m]));

/** Décor déjà possédé : écus à la place (comme au lot 2). */
export const MERCHANT_ECUS_IF_OWNED = 5;

// ── Conseils « première fois » (hints.js) ──────────────────────────────────────────────────────

export const VARIETY_HINTS = {
  'variety.board': 'Le tableau du village : des voisins demandent quelques récoltes. Récoltez-les à la main : elles sont payées tout de suite, et la prime arrive quand la commande est complète.',
  'variety.cart': 'La charrette du marché attend des caisses de récoltes jusqu\'au dernier soir de la saison. Même à moitié pleine, elle paie une prime.',
  'variety.cards': 'Un cadeau pour la saison : choisissez une des deux cartes. Rien ne presse, le choix attend.',
  'variety.challenges': 'Les défis de la saison : gardez-en un ou deux. Chaque palier atteint donne une médaille et des écus.',
  'variety.merchant': 'Basile le colporteur passe deux jours avec sa roulotte : graines rares et petits trésors.',
  'variety.rare': 'Graines rares : chaque semis prend une graine du sachet, sans rien payer.',
  'career.theme': 'Chaque année a désormais son thème : une vedette mieux payée, une fête spéciale et un visiteur unique.',
};

/** Textes. */
export const VARIETY_TEXTS = {
  emptySlot: 'Nouvelle demande demain matin',
  noOrder: 'Pas de demande aujourd\'hui : revenez demain !',
  rerollUsed: 'Une seule relance par jour : revenez demain.',
  allKept: 'Toutes les commandes sont gardées.',
  workshopFirst: 'L\'atelier passe d\'abord',
  cartArrived: 'La charrette du marché est là jusqu\'au dernier soir de la saison : vos récoltes à la main remplissent ses caisses.',
  cartLeftEmpty: 'La charrette repart. À la saison prochaine !',
  withdrawn: 'La saison est passée : je prends ce que vous avez, merci !',
};
