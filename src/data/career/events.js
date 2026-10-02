// Mode Carrière — événements vivants (données pures). Conception : docs/CARRIERE.md § 8.1, § 8.2, § 10.9.
// Moteur : src/core/career/events.js (lot CORE-C). Rien de ce fichier n'est lu par une partie de niveau.
//
// Les chiffres sont des valeurs de départ réglées avec tools/simulate-career.js.

// ── 8.1 Le calendrier (chaque année, fixe) ──────────────────────────────────────────────────────
//   day    : jour de la saison (le même quelle que soit la durée des saisons : 7, 10 ou 14 jours)
//   rank   : rang à partir duquel la fête a lieu
//   factors: multiplicateurs de prix par genre de vente ('crop' récolte, 'product' produit transformé,
//            'stock' vente du grenier) — fournisseur priceFactor ; seedFactor : prix des graines
//   guestFactor : revenu de la chambre d'hôte ce jour-là ; joyful : employés joyeux (lu par CORE-B) ;
//   questHeart : +1 ♥ de Joseph si une quête est en cours (acceptée, pas finie)
export const CALENDAR_EVENTS = [
  {
    id: 'seedFair',
    name: 'Foire aux semis',
    seasonId: 'spring',
    day: 3,
    rank: 1,
    icon: 'fair.stand',
    text: 'Graines à −25 % toute la journée (le semoir en profite aussi).',
    seedFactor: 0.75,
    factors: {},
  },
  {
    id: 'villageFete',
    name: 'Fête du village',
    seasonId: 'summer',
    day: 4,
    rank: 1,
    icon: 'fair.bunting',
    text: 'Récoltes vendues +25 % aujourd\'hui ; l\'équipe est joyeuse ; chambre d\'hôte × 2.',
    factors: { crop: 1.25 },
    guestFactor: 2,
    joyful: true,
  },
  {
    id: 'harvestFestival',
    name: 'Fête des récoltes',
    seasonId: 'autumn',
    day: 2,
    rank: 1,
    icon: 'fair.lanterns',
    text: 'Toutes les ventes +15 % ; Joseph offre un cœur si une de ses quêtes est en cours.',
    factors: { crop: 1.15, product: 1.15, stock: 1.15 },
    questHeart: 1,
  },
  {
    id: 'christmasMarket',
    name: 'Marché de Noël',
    seasonId: 'winter',
    day: 4,
    rank: 2,
    icon: 'fair.chalet',
    text: 'Produits transformés +50 % ce matin ; stock du grenier +25 % toute la journée.',
    factors: { product: 1.5, stock: 1.25 },
  },
];

export const CALENDAR_EVENTS_BY_ID = Object.fromEntries(CALENDAR_EVENTS.map((e) => [e.id, e]));

// ── Comice agricole (concours annuel) ───────────────────────────────────────────────────────────
// Annoncé à l'aube du 1er jour d'été (rang ≥ 2), jugé le soir du dernier jour d'automne (avant les charges).
// 3 épreuves tirées (flux « events ») parmi celles POSSIBLES avec la ferme du joueur, jamais deux fois la
// même la même année. Progression comptée depuis l'annonce (sauf « stock » : au soir du jugement).
// Prix : prizePerRank × rang par épreuve réussie, + une fois de plus si les 3 sont réussies ; × 2 au
// rang 6 (« comice régional »).
export const CONTEST = {
  rank: 2,
  goals: 3,
  prizePerRank: 100,
  bonusAllGoals: 1, // bonus = bonusAllGoals × prix d'une épreuve
  domaineRank: 6,
  domaineFactor: 2,
  name: 'Comice agricole',
};

//   type : 'harvest' (récoltes de cropIds, ou d'arbres fruitiers avec tree: true), 'harvests' (toutes les
//          récoltes), 'productsSold' (produits vendus : productIds, ou tous), 'eggs' (œufs ramassés : poules
//          et canes, compté chaque aube), 'truffles', 'stock' (unités au grenier au soir du jugement)
//   target : base + perRank × rang ;  label : {n} remplacé par la cible
//   needs  : condition pour que l'épreuve soit tirée (src/core/career/events.js, contestGoalPossible)
export const CONTEST_GOAL_POOL = [
  { id: 'pumpkins', type: 'harvest', cropIds: ['pumpkin'], target: { base: 4, perRank: 1 }, label: '{n} citrouilles', needs: 'pumpkin' },
  { id: 'products', type: 'productsSold', target: { base: 6, perRank: 3 }, label: '{n} produits transformés', needs: 'workshop' },
  { id: 'cheeses', type: 'productsSold', productIds: ['cowCheese', 'goatCheese'], target: { base: 2, perRank: 1 }, label: '{n} fromages', needs: 'cheese' },
  { id: 'fruits', type: 'harvest', tree: true, target: { base: 4, perRank: 2 }, label: '{n} paniers de fruits', needs: 'trees' },
  { id: 'eggs', type: 'eggs', target: { base: 0, perRank: 10 }, label: '{n} œufs ramassés', needs: 'eggs' },
  { id: 'truffles', type: 'truffles', target: { base: 0, perRank: 1 }, label: '{n} truffes', needs: 'pigs' },
  { id: 'stock', type: 'stock', target: { base: 0, perRank: 15 }, label: 'Plus beau stock : {n} unités au grenier le jour du jugement', needs: 'storage' },
  // Toujours possibles (cultures du rang 1, d'été ou d'automne) : complètent le tirage d'une petite ferme.
  { id: 'harvests', type: 'harvests', target: { base: 30, perRank: 15 }, label: '{n} récoltes', needs: null },
  { id: 'tomatoes', type: 'harvest', cropIds: ['tomato'], target: { base: 6, perRank: 2 }, label: '{n} tomates', needs: null },
  { id: 'potatoes', type: 'harvest', cropIds: ['potato'], target: { base: 6, perRank: 3 }, label: '{n} pommes de terre', needs: null },
];

/** Chance qu'un cochon trouve une truffe chaque aube d'automne (§ 5) : sert à juger « truffes » possible. */
export const TRUFFLE_CHANCE_HINT = 0.3;

// ── 8.2 Événements au hasard ────────────────────────────────────────────────────────────────────
// Tirage à l'aube (flux « events ») : `chance` par jour, jamais les `graceDays` premiers jours de la
// carrière, jamais un jour de fête, jamais deux fois le même d'affilée, un seul actif à la fois.
// Rythme « tranquille » (retours de joueurs, 2026-09-30) : 0,3 → 0,15 par jour ; avec les quêtes de Joseph (au plus
// une toutes les deux saisons), ≈ 1 sollicitation par semaine de jeu (simulation, docs/CARRIERE.md § 13.5).
// (lot 3) Avec la variété (tableau du village et colporteur à la place du visiteur acheteur et du marchand ambulant,
// 28 points de poids sur 78) : chanceWithVariety, pour que les autres événements gardent leur fréquence (≈ 0,7/semaine).
export const RANDOM_EVENT_RULES = { chance: 0.15, graceDays: 3, chanceWithVariety: 0.1 };

//   weight : poids du tirage ; name, icon, text : pour le message (toast) et l'Agenda
export const RANDOM_EVENTS = [
  { id: 'visitor', weight: 20, name: 'Visiteur acheteur', icon: 'npc.visitor.1' },
  { id: 'tourists', weight: 15, name: 'Touristes', icon: 'npc.visitor.2' },
  { id: 'crows', weight: 10, name: 'Corbeaux', icon: 'bird.crow' },
  { id: 'rainbow', weight: 10, name: 'Arc-en-ciel', icon: 'effect.rainbow' },
  { id: 'dew', weight: 10, name: 'Rosée du matin', icon: 'icon.career.dew' },
  { id: 'merchant', weight: 8, name: 'Marchand ambulant', icon: 'npc.visitor.3' },
  { id: 'lostPet', weight: 5, name: 'Animal perdu', icon: 'pet.cat' },
  { id: 'josephGift', weight: 5, name: 'Cadeau de Joseph', icon: 'portrait.joseph' },
];

export const RANDOM_EVENTS_BY_ID = Object.fromEntries(RANDOM_EVENTS.map((e) => [e.id, e]));

/**
 * Visiteur acheteur : commande de `count` récoltes d'une culture de saison, payées `factor` × le prix de
 * base (difficulté comprise, sans le cours du jour), valable max(`days`, durée de saison × `seasonShare`) jours
 * (5 jours en saisons de 7 et 10 jours, 7 en saisons de 14). Seulement une culture qu'on peut avoir à temps : au
 * grenier, déjà semée, ou qui pousse en `days` − 1 jours au plus. Une seule commande à la fois. Livrée
 * depuis le grenier (« Livrer ») ou avec les prochaines récoltes de cette culture (mises de côté). Ratée :
 * les unités déjà mises de côté sont payées au prix normal (rien ne se perd). Rappel (offerReminder) la veille
 * du dernier jour d'une commande acceptée.
 */
export const VISITOR = {
  factor: 1.5,
  days: 5,
  seasonShare: 0.5,
  count: [3, 5],
  countExpensive: [2, 4],
  expensivePrice: 40,
  reminders: [1],
  names: ['Mme Leblanc', 'M. Garnier', 'Mme Rousseau', 'M. Fabre', 'Mlle Perrin', 'le boulanger Paulo', 'Mme Chevalier', 'la petite Lili', 'M. le maire', 'Mme Morel'],
};

/** Touristes : `passes` passages (part du jour) ; chacun rapporte perPass × (1 + attrait). */
export const TOURISTS = { passes: [0.3, 0.55, 0.8], perPass: 5 };

/** Corbeaux : 1 à 3 parcelles non mûres (champ, jamais la serre ni le verger), hors hiver, ≥ minSown semées. */
export const CROWS = { count: [1, 3], minSown: 12 };

/** Arc-en-ciel : la veille était pluvieuse ; pousse + growthBonus aujourd'hui (toute la ferme, hors hiver). */
export const RAINBOW = { growthBonus: 0.1, after: ['rain', 'storm'] };

/** Rosée du matin : printemps ou automne, pas de pluie ; toutes les parcelles des champs arrosées ce matin. */
export const DEW = { seasons: ['spring', 'autumn'], notOn: ['rain', 'storm'] };

/**
 * Marchand ambulant (rang ≥ 2) : propose UN objet pour la journée.
 *   fertilizer : un champ (celui qui a le plus de cultures, ou celui choisi) : + growth jour de pousse par
 *                aube pendant `days` aubes pour chaque culture pas encore mûre
 *   hens       : `count` poules (s'il y a la place au poulailler)
 *   beehive    : une ruche d'occasion (si on peut encore en poser une)
 */
export const MERCHANT_ITEMS = [
  { id: 'fertilizer', name: 'Engrais', price: 150, days: 3, growth: 0.25, weight: 3, text: 'Un sac d\'engrais : un champ pousse 25 % plus vite pendant 3 jours.' },
  { id: 'hens', name: 'Deux poules', price: 40, count: 2, weight: 2, text: 'Deux belles poules pondeuses, 40 pièces les deux.' },
  { id: 'beehive', name: 'Ruche d\'occasion', price: 40, weight: 2, text: 'Une ruche d\'occasion, pleine d\'abeilles, pour 40 pièces.' },
];

/** Animal perdu (phase B) : chat, puis chien. Compagnon décoratif, gratuit. */
export const PETS = [
  { id: 'cat', name: 'Chaton', text: 'Un chaton miaule près du puits. L\'adopter ?' },
  { id: 'dog', name: 'Chien', text: 'Un chien sans collier suit le chemin de la ferme. L\'adopter ?' },
];

/**
 * Cadeau de Joseph (≥ 2 ♥) : il sème lui-même `seeds` parcelles vides (la culture de saison la moins chère,
 * graines offertes) ; sans parcelle vide (ou en hiver sans culture possible) : `coins` pièces.
 */
export const JOSEPH_GIFT = { hearts: 2, seeds: 8, coins: 30 };

/** Pêche (mare) : une fois par jour, un poisson de 5 à 40 pièces (flux « events »). */
export const FISH = [
  { id: 'gudgeon', name: 'Goujon', min: 5, max: 10, weight: 35 },
  { id: 'roach', name: 'Gardon', min: 8, max: 15, weight: 30 },
  { id: 'perch', name: 'Perche', min: 12, max: 22, weight: 18 },
  { id: 'trout', name: 'Truite', min: 18, max: 30, weight: 12 },
  { id: 'pike', name: 'Brochet', min: 30, max: 40, weight: 5 },
];
