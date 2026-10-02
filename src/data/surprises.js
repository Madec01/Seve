// Lot 2 « Toucher & surprises » — données pures (qualité des récoltes, légumes géants, surprises de l'aube,
// météos spéciales, vœux, trouvailles au défrichage). Règles : docs/GAME_DESIGN.md, « Lot 2 — surprises » ;
// contrat : docs/ARCHITECTURE.md, « Lot 2 — contrats ». Réglages obtenus avec tools/simulate.js et
// tools/simulate-career.js (hausse du revenu attendue ≤ ~8 % pour le joueur tranquille).
//
// Tout est TOUJOURS positif : aucune surprise ne fait perdre une culture, un animal ou de l'argent.

/**
 * Qualité d'une récolte : normale, belle (× 1,5), dorée (× 2).
 * Chances = base + soins (chaque soin s'ajoute) ; vœu « chance » : × luckFactor.
 * Dorée : seulement pour une récolte faite À LA MAIN (niveaux : toujours ; carrière : by === 'player').
 */
export const QUALITY = {
  multipliers: { normal: 1, fine: 1.5, gold: 2 },
  base: { fine: 0.02, gold: 0.004 },
  /** Arrosée chaque jour où elle en avait besoin, depuis le semis (arbres : toujours vrai). */
  watered: { fine: 0.015, gold: 0.004 },
  /** Une ruche au moins dans la ferme. */
  bees: { fine: 0.01, gold: 0.003 },
  /** Sol reposé : culture différente de la dernière récoltée sur cette parcelle. */
  rotation: { fine: 0.01, gold: 0.003 },
  /** Bonus permanent « Main verte ». */
  greenThumb: { fine: 0.01, gold: 0.003 },
  /** Vœu « chance » : chances multipliées. */
  luckFactor: 2,
};

/** Noms affichés des qualités. */
export const QUALITY_NAMES = { normal: 'Normale', fine: 'Belle', gold: 'Dorée' };

/**
 * Légumes géants : un carré 2 × 2 de la même culture (pas un arbre), semée le même jour à 1 jour près, toute mûre,
 * chaque parcelle arrosée le jour où elle a mûri → à chaque aube, `chance` de fusionner (un carré par aube au plus).
 * Valeur : `valueFactor` × la valeur d'une parcelle (au lieu de 4).
 * Carrière : le géant attend le joueur `handDays` jours ; ensuite salariés et machines peuvent le récolter, sans la
 * prime du géant (4 × leur valeur d'une parcelle) : un champ tenu par les machines n'est jamais bloqué.
 */
export const GIANT = { chance: 0.06, valueFactor: 6, sownSpread: 1, handDays: 3 };

/**
 * Surprises de l'aube : à chaque aube (après `graceDays` jours), `chance` d'en tirer une parmi celles qui sont
 * possibles (poids), jamais deux jours de suite (`minGap` jours entre deux surprises).
 */
export const SURPRISE_RULES = { chance: 0.06, graceDays: 4, minGap: 3 };

export const SURPRISES = [
  { id: 'fairy', weight: 2, name: 'La fée des cultures', icon: 'fairy', text: 'Cette nuit, une fée a dansé dans le champ : {n} parcelle{s} {verb} mûri d\'un coup !' },
  { id: 'chest', weight: 3, name: 'Un vieux coffre', icon: 'chest.old', text: 'En bêchant, vous trouvez un vieux coffre : {reward} !' },
  { id: 'ring', weight: 2, name: 'Un cercle de fées', icon: 'mushroom.ring', text: 'Un cercle de champignons rares a poussé sur une parcelle : cueillez-le (+{value} pièces).' },
  { id: 'fox', weight: 2, name: 'Un renard s\'installe', icon: 'fox', text: 'Un renard roux s\'est installé à la lisière : plus aucun corbeau jusqu\'à la fin de la saison.' },
  { id: 'hedgehog', weight: 2, name: 'Un hérisson', icon: 'hedgehog', text: 'Un hérisson garde le potager : aucune culture ne pourrira pendant {days} jours.' },
  { id: 'owl', weight: 1, name: 'Une chouette sculptée', icon: 'owl.carved', text: 'Sous une vieille souche : une chouette en bois sculpté ! Elle rejoint vos décorations.' },
];

export const SURPRISES_BY_ID = Object.fromEntries(SURPRISES.map((s) => [s.id, s]));

/** Réglages des surprises. */
export const FAIRY = { size: 3 };
/** Coffre : pièces (niveaux : coins ; carrière : coins + perRank × rang) ou écus (ecusChance). */
export const CHEST = { coins: [15, 30], perRank: 15, ecusChance: 0.35, ecus: [3, 6] };
/** Cercle de fées : valeur = facteur × prix de la culture la plus chère de la saison (au moins min), jours de vie. */
export const RING = { factor: 1.5, min: 25, days: 4 };
/** Renard (carrière) : jusqu'à la fin de la saison. Hérisson (niveaux à maladie) : jours. */
export const HEDGEHOG = { days: 6 };
/** Décor trouvé déjà possédé : écus à la place. */
export const ECUS_IF_OWNED = 5;

/**
 * Météos spéciales : tirées en même temps que la prévision de demain (flux « sky »), sur une météo de base donnée.
 *   on      météos de base qui la permettent
 *   seasons saisons possibles
 *   chance  chance quand c'est possible
 *   career  false : pas tirée en carrière (l'arc-en-ciel y est déjà un événement)
 */
export const SPECIAL_WEATHERS = [
  { id: 'warmrain', name: 'Pluie chaude', on: ['rain'], seasons: ['spring', 'summer', 'autumn'], chance: 0.06, icon: 'icon.weather.warmrain', text: 'Une pluie chaude arrose tout : les cultures poussent 1,5 fois plus vite aujourd\'hui.' },
  { id: 'fog', name: 'Brouillard', on: ['cloudy'], seasons: ['spring', 'autumn'], chance: 0.08, icon: 'icon.weather.fog', text: 'Un brouillard doux couvre la ferme : des champignons ont poussé sur les parcelles vides.' },
  { id: 'shootingstar', name: 'Nuit des étoiles filantes', on: ['sunny', 'cloudy'], seasons: ['summer', 'autumn', 'winter'], chance: 0.03, icon: 'icon.weather.shootingstar', text: 'Ce soir, des étoiles filantes : faites un vœu demain matin !' },
  { id: 'goldenhour', name: 'Heure dorée', on: ['sunny'], seasons: ['spring', 'summer', 'autumn'], chance: 0.04, icon: 'icon.weather.goldenhour', text: 'Une lumière dorée sur le marché : les récoltes se vendent 20 % plus cher aujourd\'hui.' },
  { id: 'rainbow', name: 'Arc-en-ciel', on: ['sunny', 'cloudy'], after: ['rain', 'storm'], seasons: ['spring', 'summer', 'autumn'], chance: 0.1, career: false, icon: 'icon.weather.rainbow', text: 'Un arc-en-ciel après la pluie : tout pousse 10 % plus vite aujourd\'hui.' },
];

export const SPECIAL_WEATHERS_BY_ID = Object.fromEntries(SPECIAL_WEATHERS.map((w) => [w.id, w]));

/** Effets chiffrés des météos spéciales. */
export const SKY = {
  warmrainGrowth: 1.5, // pousse du jour × 1,5
  rainbowGrowth: 1.1, // pousse du jour × 1,1
  goldenPrice: 1.2, // ventes de récoltes × 1,2
  /** Brouillard : champignons sur 2 à 4 parcelles vides ; valeur = facteur × prix de la culture la plus chère (au moins min). */
  fogPlots: [2, 4],
  fogFactor: 0.25,
  fogMin: 5,
  fogDays: 2,
};

/** Vœux (étoile filante) : 3 proposés parmi ceux-ci. */
export const WISHES = [
  { id: 'coins', name: 'Une bourse', icon: 'icon.coin', text: 'Une petite bourse de pièces.' },
  { id: 'growth', name: 'Un jour de pousse', icon: 'icon.grow', text: 'Toutes les cultures qui poussent gagnent un jour.' },
  { id: 'luck', name: 'La main chanceuse', icon: 'quality.gold', text: 'Belles et dorées deux fois plus fréquentes pendant 3 jours.' },
  { id: 'water', name: 'Une ondée', icon: 'icon.water', text: 'Tout le champ est arrosé aujourd\'hui.' },
];

export const WISHES_BY_ID = Object.fromEntries(WISHES.map((w) => [w.id, w]));

/** Vœux chiffrés : bourse (niveaux : coins ; carrière : coins + perRank × rang), jours de chance. */
export const WISH = { coins: 20, perRank: 15, luckDays: 3 };

/**
 * Trouvailles au défrichage (carrière) : à l'achat d'un terrain, `count` trouvailles (1 ou 2 : chance de 2),
 * tirées sans remise (poids). Le vieux puits, la statuette et l'agneau une fois chacun par ferme au plus.
 */
export const FINDS_RULES = { secondChance: 0.4 };

export const FINDS = [
  { id: 'chest', weight: 3, name: 'Un vieux coffre', icon: 'find.chest', text: 'Sous les ronces, un vieux coffre : {reward} !' },
  { id: 'coins', weight: 3, name: 'Un pot de pièces', icon: 'find.coins', text: 'Un pot de pièces enterré : +{amount} pièces.' },
  { id: 'seedjar', weight: 3, name: 'Un bocal de graines anciennes', icon: 'find.seedjar', text: 'Un bocal de graines anciennes de {crop} : gardé précieusement pour la Vallée.' },
  { id: 'well', weight: 2, once: true, name: 'Un vieux puits', icon: 'find.well', text: 'Un vieux puits remis en état : les cultures de ce terrain seront arrosées chaque matin.' },
  { id: 'statue', weight: 2, once: true, name: 'Une petite statue', icon: 'find.statue', text: 'Une petite statue de pierre : elle rejoint vos décorations.' },
  { id: 'lamb', weight: 2, once: true, name: 'Un agneau perdu', icon: 'find.lostlamb', text: '{animal}' },
];

export const FINDS_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

/** Trouvailles chiffrées : pièces (coins + perLot × terrains achetés), coffre comme CHEST. */
export const FIND_VALUES = { coins: [30, 60], perLot: 20 };

/** Décors trouvés (src/data/cosmetics.js, found: true). */
export const FOUND_COSMETICS = { owl: 'owl.carved', statue: 'statue.small' };
