// Lot 4 « Collection & enjeux doux » — données pures : lanternes (D3), fêtes participatives (C6), hiver vivant (C8),
// « aider sans remplacer » (F1, carrière). Règles : docs/GAME_DESIGN.md § 17 ; contrat : docs/ARCHITECTURE.md,
// « Lot 4 — contrats ». Moteur : src/core/cozy.js, src/core/lanterns.js, src/core/career/{cozy,handwork}.js.
// Les nombres sont réglés par la simulation (tools/simulate.js --compare-cozy / --lanterns,
// tools/simulate-career.js --compare-f1 / --compare-cozy) : ce fichier fait foi.

import { HAND_BONUS } from './career/career.js';

export const COZY_VERSION = 1;

/** Parties du lot (helpers : carrière seulement). */
export const COZY_PARTS = ['lanterns', 'fetes', 'winter', 'helpers'];

// ── D3 — Les lanternes ────────────────────────────────────────────────────────────────────────

export const LANTERN_CRITERIA = [
  { id: 'variety', name: 'Variété', color: 'green', icon: 'icon.crit.variety', lantern: 'lantern.green' },
  { id: 'care', name: 'Soin', color: 'blue', icon: 'icon.crit.care', lantern: 'lantern.blue' },
  { id: 'neighbours', name: 'Voisinage', color: 'pink', icon: 'icon.crit.neighbours', lantern: 'lantern.pink' },
  { id: 'beauty', name: 'Beauté', color: 'yellow', icon: 'icon.crit.beauty', lantern: 'lantern.yellow' },
  { id: 'prosperity', name: 'Prospérité', color: 'orange', icon: 'icon.crit.prosperity', lantern: 'lantern.orange' },
];
export const LANTERN_IDS = LANTERN_CRITERIA.map((c) => c.id);

/**
 * Barèmes (paliers de 2, 3 et 4 lanternes ; 1 lanterne toujours). Réglés par la simulation (§ 17.8).
 *   levels.variety : parts de k (cultures de la partie sans les graines rares + recettes des ateliers proposés)
 *   levels.care / career.care : parts (0..1) ; prosperity (niveaux) : parts des seuils d'étoiles ★★ / ★★★
 *   points : barèmes du voisinage et de la beauté (caps : plafonds)
 */
export const LANTERN_RULES = {
  levels: {
    variety: [0.5, 0.75, 0.95],
    care: [0.3, 0.5, 0.67],
    neighbours: [12, 17, 21],
    beauty: [4, 7, 9],
    neighbourPoints: { order: 1, crate: 1, fete: 2, heart: 1, story: 1 },
    beautyPoints: { decor: 1, decorMax: 8, path: 1, fence: 1, hive: 1, hiveMax: 3, tree: 1, treeMax: 3, sunflowers: 1, sunflowersN: 5, giant: 1, feeder: 1, feederDays: 3, birds: 1, birdsN: 3 },
    // Prospérité : ≥ ½ ★★, ≥ ★★, ≥ ★★★ (seuils Détente du niveau).
    prosperity: [0.5, 1, 'stars3'],
  },
  career: {
    // (Vallée vivante, lot V1) Recalibrés avec la Vallée (règle du § 17.2.1, simulation 60 × 10 ans) : la beauté relevée
    // des points nature (+ 6, + 1 paon-du-jour) ; la variété relevée des cultures en plus que sèment les graines anciennes.
    variety: [11, 16, 18],
    care: [0.65, 0.74, 0.8],
    neighbours: [9, 16, 19],
    beauty: [14, 19, 21],
    neighbourPoints: { order: 1, crate: 1, quest: 3, fete: 2, heart: 1, visitor: 2, story: 1 },
    // (Vallée vivante) nature : + 1 par aménagement nature posé (natureMax au plus) ; butterfly : le paon-du-jour installé.
    beautyPoints: { decor: 1, decorMax: 12, path: 1, fence: 1, hive: 1, hiveMax: 4, tree: 1, treeMax: 4, embellish: 2, giant: 1, feeder: 1, feederDays: 3, birds: 1, birdsN: 3, pet: 1, nature: 1, natureMax: 6, butterfly: 1 },
    prosperity: [0.3, 0.65, 2.5],
    prosperityFloor: 1000,
  },
  /** Soin sans les surprises du lot 2 (pas de suivi d'arrosage) : 2 lanternes. */
  careFallback: 2,
};

/**
 * Récompenses des lanternes (écus, décors). Niveaux : max(0, total − meilleur total précédent du niveau), la première
 * fois total − firstBase ; carrière : ⌊(total − careerBase) ÷ careerDivisor⌋ chaque année.
 */
export const LANTERN_REWARDS = { firstBase: 5, careerBase: 5, careerDivisor: 2, grand: 'lantern.grand', grandTotal: 20 };

// ── C6 — Les fêtes participatives ─────────────────────────────────────────────────────────────

/**
 * Calendrier des fêtes participatives.
 *   seasonId, day (jour de la saison, ou 'last' = dernier jour) ; levels : niveaux qui l'ont (Détente) ; career : rang
 *   minimal (null : pas en carrière) ; album : case de la page « Les fêtes » ; calendarId : fête du calendrier de
 *   carrière (src/data/career/events.js) qui porte les effets d'avant.
 */
export const FETES = [
  { id: 'seedFair', engine: 'foire', seasonId: 'winter', day: 'last', levels: [], career: 1, album: 'seedFair', calendarId: 'seedFair', name: 'La foire aux graines', icon: 'fete.seedstall', text: 'Des sachets de graines à −25 % pour le printemps.' },
  { id: 'springFete', engine: 'chasse', seasonId: 'spring', day: 3, levels: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], career: 1, album: 'eggHunt', calendarId: 'springFete', name: 'La fête du printemps', icon: 'fete.egg.0', text: '8 œufs peints sont cachés dans la ferme : à vous de les trouver !' },
  { id: 'villageFete', engine: 'marmite', seasonId: 'summer', day: 4, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], career: 1, album: 'soup', calendarId: 'villageFete', name: 'La fête du village', icon: 'fete.pot', text: 'La soupe partagée : apportez jusqu\'à trois légumes de l\'année.' },
  { id: 'harvestFestival', engine: 'etal', seasonId: 'autumn', day: 2, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], career: 1, album: 'stand', calendarId: 'harvestFestival', name: 'La fête des récoltes', icon: 'fete.stand', text: 'Le stand de la ferme : 5 cagettes jugées par M. le maire.' },
  { id: 'christmasMarket', engine: 'paniers', seasonId: 'winter', day: 4, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], career: 1, album: 'christmas', calendarId: 'christmasMarket', name: 'Le marché de Noël', icon: 'fete.basket', text: 'Trois paniers pour trois villageois : offrez-leur ce qu\'ils aiment.' },
];
export const FETES_BY_ID = Object.fromEntries(FETES.map((f) => [f.id, f]));

/** Moteurs des mini-jeux. */
export const FETE_ENGINES = {
  chasse: { count: 8 },
  marmite: { max: 3 },
  etal: { slots: 5 },
  paniers: { baskets: 3, perBasket: 2 },
  foire: {},
};
export const FETE_ENGINE_IDS = Object.keys(FETE_ENGINES);

/**
 * Récompenses (pièces des niveaux ; carrière : × careerFactor(rang) = 1 + 0,5 × (rang − 1)) et écus.
 *   chasse : par objet trouvé soi-même (doré), trouvé le soir par le village (doré) ; + allEcus si les 8 sont trouvés
 *   marmite : pièces selon les louches (1, 2, 3) ; écus = louches
 *   etal : pièces selon le ruban (vert, bleu, or) ; écus ; paliers de points
 *   paniers : pièces par panier + par ♥ ; écus = ♥
 */
export const FETE_REWARDS = {
  chasse: { found: 2, foundGold: 6, village: 1, villageGold: 3, allEcus: 1 },
  marmite: { coins: [6, 12, 20], ecus: [1, 2, 3] },
  etal: { coins: { green: 10, blue: 20, gold: 32 }, ecus: { green: 0, blue: 1, gold: 2 } },
  paniers: { perBasket: 3, perHeart: 3 },
};

/** Facteur des récompenses en pièces de la carrière (rang 1 : × 1, Domaine : × 3,5). */
export function careerFactor(rank = 1) {
  return 1 + 0.5 * (Math.max(1, rank) - 1);
}

/** Légumes de la soupe (les fruits ne sont pas proposés). */
export const SOUP_CROPS = ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower', 'potato', 'zucchini', 'pumpkin', 'pea', 'leek'];

/** Points du stand ; seuils des rubans. */
export const STAND_POINTS = { item: 1, fine: 1, gold: 2, giant: 2, homemade: 1, star: 1, heirloom: 1 }; // heirloom : (Vallée V2, carrière) culture dont une variété ancienne a été récoltée cette année
export const RIBBONS = [
  { id: 'green', name: 'Coup de cœur des enfants', min: 1 },
  { id: 'blue', name: 'Bel étal', min: 8 },
  { id: 'gold', name: 'Grand prix du jury', min: 12 },
];

/** Produit aimé de chaque client du tableau, en plus de ses cultures préférées (lot 3). */
export const BASKET_LIKES = {
  rose: 'strawberryJam', paulo: 'bread', lili: 'eggs', garnier: 'milk', chevalier: 'cowCheese', fabre: 'eggs',
  perrin: 'appleJuice', maire: 'goatCheese', odette: 'strawberryJam', leon: 'appleJuice', morel: 'wool', twins: 'bread',
};

/** Comice (carrière) : bonus du stand gardé, en part d'un prix d'épreuve. */
export const STAND_COMICE = { blue: 0.25, gold: 0.5 };

/**
 * Mini-jeux des fêtes des années à thème (lot 3, carrière) : moteur et variante.
 *   kind (chasse) : objet caché ; accept (marmite) : ingrédients ; require : ingrédient obligatoire ;
 *   bonus (etal) : points en plus pour certains produits ; giant : points d'un géant ; slots : cagettes.
 */
export const THEME_FETE_GAMES = {
  bees: { engine: 'marmite', name: 'La tarte au miel', text: 'Fruits et légumes sucrés pour la tarte au miel du village.', accept: ['strawberry', 'apple', 'melon', 'pumpkin', 'carrot'] },
  cheese: { engine: 'etal', name: 'La foire aux fromages', text: 'Vos fromages sur l\'étal : + 2 points chacun.', bonus: { cowCheese: 2, goatCheese: 2 } },
  tourism: { engine: 'chasse', name: 'La nuit des lampions', text: '8 lampions à allumer dans la ferme.', kind: 'lampion' },
  giants: { engine: 'etal', name: 'Le concours du plus gros légume', text: 'Le stand des géants : un légume géant vaut + 4 points.', giant: 4 },
  frogs: { engine: 'chasse', name: 'Le bal des grenouilles', text: '8 grenouilles cachées près des mares et des parcelles arrosées.', kind: 'frog' },
  orchard: { engine: 'etal', name: 'La fête de la pomme', text: 'Paniers de pommes et jus : + 2 points chacun.', bonus: { apple: 2, appleJuice: 2 } },
  bread: { engine: 'marmite', name: 'Le pain du village', text: 'Du blé obligatoire et deux autres ingrédients pour le pain du village.', accept: ['wheat', 'sunflower', 'pumpkin', 'apple', 'corn', 'potato', 'carrot', 'zucchini'], require: 'wheat' },
  markets: { engine: 'etal', name: 'Le grand marché', text: 'Un grand étal : 6 cagettes au lieu de 5.', slots: 6 },
  lights: { engine: 'chasse', name: 'La fête des lumières', text: '8 lanternes à allumer sous la neige.', kind: 'lantern' },
};

/** Objet caché d'une chasse (sprites fete.<kind>…) ; l'œuf de la fête du printemps par défaut. */
export const HIDDEN_KINDS = ['egg', 'lampion', 'frog', 'lantern'];
export const HIDDEN_NAMES = { egg: 'œufs', lampion: 'lampions', frog: 'grenouilles', lantern: 'lanternes' };

/** Foire aux graines (carrière) : sachet de 8 semis prépayés à −25 % ; 4 par culture, 20 en tout. */
export const SEED_FAIR = { pack: 8, discount: 0.25, perCrop: 4, max: 20, treePack: 1, rarePack: 3, rareCrop: 'pea' };

// ── C8 — L'hiver vivant ───────────────────────────────────────────────────────────────────────

/** Trouvailles d'hiver en lisière : poids du tirage, pièces (niveaux ; carrière × careerFactor). */
export const WINTER_FINDS = [
  { id: 'deadwood', name: 'Bois mort', weight: 3, coins: 2, icon: 'winter.deadwood' },
  { id: 'pinecone', name: 'Pommes de pin', weight: 3, coins: 2, icon: 'winter.pinecone' },
  { id: 'holly', name: 'Houx', weight: 2, coins: 3, icon: 'winter.holly' },
  { id: 'chestnut', name: 'Châtaignes', weight: 2, coins: 4, icon: 'winter.chestnut' },
  { id: 'blewit', name: 'Pieds-bleus', weight: 2, coins: 5, icon: 'winter.blewit' },
  { id: 'mistletoe', name: 'Gui', weight: 1, coins: 6, icon: 'winter.mistletoe' },
];
export const WINTER_FINDS_BY_ID = Object.fromEntries(WINTER_FINDS.map((f) => [f.id, f]));
export const WINTER_RULES = { maxFinds: 3 };

/** Traces dans la neige (un jour de neige, chance). Identifiants = cases de l'album. */
export const TRACES = {
  chance: 0.4,
  kinds: [
    { id: 'hareTrack', name: 'Traces de lièvre', weight: 2, icon: 'track.hare' },
    { id: 'deerTrack', name: 'Traces de chevreuil', weight: 1, icon: 'track.deer' },
    { id: 'foxTrack', name: 'Traces de renard', weight: 1, icon: 'track.fox' },
  ],
};
export const TRACES_BY_ID = Object.fromEntries(TRACES.kinds.map((t) => [t.id, t]));

/** Oiseaux de la mangeoire : poids, remplissages nécessaires dans l'hiver (minFills) ; jamais vu : poids × unseenFactor. */
export const BIRDS = [
  { id: 'sparrow', name: 'Moineau', weight: 4, minFills: 0 },
  { id: 'greatTit', name: 'Mésange charbonnière', weight: 4, minFills: 0 },
  { id: 'robin', name: 'Rouge-gorge', weight: 3, minFills: 0 },
  { id: 'blueTit', name: 'Mésange bleue', weight: 3, minFills: 0 },
  { id: 'chaffinch', name: 'Pinson', weight: 3, minFills: 0 },
  { id: 'nuthatch', name: 'Sittelle', weight: 2, minFills: 0 },
  { id: 'bullfinch', name: 'Bouvreuil', weight: 1, minFills: 3 },
  { id: 'woodpecker', name: 'Pic épeiche', weight: 1, minFills: 5 },
];
export const BIRDS_BY_ID = Object.fromEntries(BIRDS.map((b) => [b.id, b]));
export const FEEDER = { unseenFactor: 2 };

/** Veillées de Joseph : 3ᵉ jour d'hiver ; un écu par histoire nouvelle. */
export const STORY = { day: 3, ecus: 1 };

// ── F1 — Aider sans remplacer (carrière) ──────────────────────────────────────────────────────

/**
 *   handBonus : prime « Cueilli main » (src/data/career/career.js fait foi : HAND_BONUS)
 *   machineDelay / staffDelay : aubes après la maturité avant que machines / jardiniers récoltent
 *   weedFine / weedGold : chances de qualité en plus d'une culture désherbée récoltée à la main
 *   migrateRipeBack : cultures déjà mûres au chargement d'une ancienne carrière (ripeAt reculé)
 */
export const F1 = { handBonus: HAND_BONUS, machineDelay: 3, staffDelay: 4, weedFine: 0.01, weedGold: 0.003, migrateRipeBack: 4 };

// ── Conseils « première fois » (textes affichés par l'interface) ──────────────────────────────

export const COZY_HINTS = {
  'cozy.album': 'Une case de l\'album ! Chaque chose vécue à la ferme a sa page : Menu → L\'album.',
  'cozy.fete': 'Demain, c\'est jour de fête : un petit jeu au doigt, sans chrono. Ce que vous ne faites pas, le village le fera.',
  'cozy.winter': 'L\'hiver est là : ramassez les trouvailles en lisière, remplissez la mangeoire, et passez chez Joseph le soir.',
  'cozy.lanterns': 'Joseph allume des lanternes pour votre année : une au moins par critère, et l\'an prochain on peut toujours faire mieux.',
  'cozy.helpers': `Vos récoltes vous attendent : l'équipe ne les cueille qu'après ${F1.machineDelay} à ${F1.staffDelay} jours. À la main, elles valent ${Math.round((HAND_BONUS - 1) * 100)} % de plus !`,
  'cozy.seedFair': 'La foire aux graines : des sachets à −25 % pour le printemps. Vos semis les prendront d\'abord, sans payer.',
};
