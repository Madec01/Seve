// Mode Carrière — quêtes et amitié de Joseph (données pures). Conception : docs/CARRIERE.md § 8.3.
// Moteur : src/core/career/quests.js (lot CORE-C). Rien de ce fichier n'est lu par une partie de niveau.

/** Rang à partir duquel Joseph propose une quête au début de chaque saison. */
export const QUEST_RANK = 2;

/**
 * Modèles de quête.
 *   type   'crop'    : N récoltes d'une culture de saison (mises de côté à la récolte, ou livrées du grenier)
 *          'fruits'  : un panier de N fruits (récoltes d'arbres fruitiers ; mises de côté ou grenier)
 *          'product' : N produits transformés d'un atelier (comptés à la vente : ils sont payés normalement,
 *                      la récompense ajoute la moitié de leur valeur)
 *          'eggs'    : N œufs ramassés (poules, canes ; comptés au ramassage des abris ; ils sont payés normalement)
 *          'trees'   : planter N pommiers (une fois par carrière)
 *   n      : base + perRank × rang
 *   weight : poids du tirage (flux « events »)
 *   rewardFactor : récompense = rewardFactor × valeur des objets (prix de base × difficulté, sans le cours) ;
 *            'product' 0,5 : les produits sont déjà payés à la vente (total 1,5 × leur valeur) ;
 *            'eggs' : œufs comptés sans être retirés (valeur EGG_VALUE l'œuf, récompense en plus) ; 'trees' : prix des plants
 *   needs  : condition (src/core/career/quests.js) ; once : une seule fois par carrière
 *   text   : phrase de Joseph ({n}, {what} remplacés)
 */
export const QUEST_TEMPLATES = [
  { id: 'crop', type: 'crop', n: { base: 6, perRank: 2 }, weight: 40, rewardFactor: 1.5, text: 'Tu pourrais m\'apporter {n} {what} ? Ma sœur vient dîner.' },
  { id: 'product', type: 'product', n: { base: 4, perRank: 1 }, weight: 20, rewardFactor: 0.5, needs: 'workshop', text: 'J\'aimerais goûter tes {what} : {n}, ce serait parfait.' },
  { id: 'eggs', type: 'eggs', n: { base: 0, perRank: 8 }, weight: 15, rewardFactor: 1.5, needs: 'eggs', text: 'Mes poules boudent… Tu me mettrais de côté {n} œufs cette saison ?' },
  { id: 'fruits', type: 'fruits', n: { base: 4, perRank: 1 }, weight: 15, rewardFactor: 1.5, needs: 'trees', text: 'Un panier de {n} fruits pour la fête de l\'école, ça te dit ?' },
  { id: 'trees', type: 'trees', n: { base: 2, perRank: 0 }, weight: 10, rewardFactor: 1.5, needs: 'orchard', once: true, text: 'Plante donc {n} pommiers au verger : tu me remercieras dans trois ans !' },
];

export const QUEST_TEMPLATES_BY_ID = Object.fromEntries(QUEST_TEMPLATES.map((t) => [t.id, t]));

/** Récompense d'une quête réussie en plus de l'argent (rewardFactor du modèle) : écus (versés par l'interface) et ♥. */
export const QUEST_REWARD = { ecus: 3, hearts: 1 };

/** Valeur d'un œuf pour les quêtes « œufs » (≈ ce que rapporte une poule par jour). */
export const EGG_VALUE = 2;

/** Amitié : 0 à MAX_HEARTS ♥, jamais perdue. */
export const MAX_HEARTS = 10;

/**
 * Paliers d'amitié (§ 8.3).
 *   gifts (2)      : cadeaux de temps en temps (événement au hasard « Cadeau de Joseph »)
 *   loanDouble (4) : prêt jusqu'à 2 fois plus (lu par careerLevel : JOSEPH_LOAN_HEARTS)
 *   loanFree (6)   : prêt sans supplément
 *   orchard (8)    : « Le verger de Joseph » : le prochain terrain à acheter devient un verger déjà aménagé
 *                    avec `trees` pommiers adultes, à `priceFactor` × son prix (une fois)
 *   cart (10)      : sa charrette : toutes les ventes + priceBonus ; titre « Ami de Joseph » ; succès
 */
export const JOSEPH_HEARTS = [
  { hearts: 2, id: 'gifts', name: 'Petits cadeaux', text: 'Joseph passera de temps en temps avec un cadeau.' },
  { hearts: 4, id: 'loanDouble', name: 'Prêt doublé', text: 'Joseph peut vous prêter jusqu\'à deux fois plus.' },
  { hearts: 6, id: 'loanFree', name: 'Prêt d\'ami', text: 'Joseph prête sans rien demander en plus.' },
  { hearts: 8, id: 'orchard', name: 'Le verger de Joseph', text: 'Le prochain terrain devient un verger de 4 pommiers adultes, à moitié prix.' },
  { hearts: 10, id: 'cart', name: 'La charrette de Joseph', text: 'Joseph vous lègue sa charrette : toutes les ventes +5 %.' },
];

export const JOSEPH_ORCHARD = { priceFactor: 0.5, trees: 4, cropId: 'apple', label: 'Le verger de Joseph' };
export const JOSEPH_CART = { priceBonus: 0.05, title: 'Ami de Joseph' };

/**
 * Répliques de Joseph (bulles de l'interface). {name} : nom de la ferme ; {what} : l'objet de la quête.
 * `fermiere` : variante au féminin quand elle diffère.
 */
export const JOSEPH_LINES = {
  questOffer: 'Bonjour, voisin ! J\'ai un petit service à te demander…',
  questOfferFem: 'Bonjour, voisine ! J\'ai un petit service à te demander…',
  questAccepted: 'Merci ! Rien ne presse : tu as jusqu\'à la fin de la saison.',
  questDeclined: 'Pas grave, une autre fois !',
  questProgress: 'Ça avance ! Encore {left}.',
  questDone: 'Formidable ! Tiens, pour ta peine. Tu es un vrai voisin.',
  questDoneFem: 'Formidable ! Tiens, pour ta peine. Tu es une vraie voisine.',
  questExpired: 'La saison est passée… Pas grave, une autre fois !',
  heart: 'On s\'entend bien, tous les deux.',
  loanHeart: 'Merci d\'avoir tout remboursé. Entre voisins, on se fait confiance.',
  festivalHeart: 'Quelle belle fête ! Et merci de m\'aider pour ma commande.',
  gift: 'Tiens, je passais par là… un petit quelque chose pour la ferme !',
  giftSeeds: 'J\'avais des graines en trop : je t\'ai semé {n} parcelles de {what}.',
  giftCoins: 'Tiens, {n} pièces : j\'ai vendu mes vieux outils au marché.',
  orchard: 'Mon vieux verger, là-haut… il est à toi pour moitié prix. Les pommiers sont déjà grands !',
  cart: 'Prends ma charrette : moi, je n\'en ai plus l\'usage. Tes clients te reconnaîtront de loin !',
  unlock: {
    gifts: 'Je passerai te voir de temps en temps, avec un petit quelque chose.',
    loanDouble: 'Si les charges te serrent, je peux t\'avancer deux fois plus qu\'avant.',
    loanFree: 'Et si je te prête, ce sera sans rien de plus. Entre amis !',
    orchard: 'Mon vieux verger, là-haut… il est à toi pour moitié prix. Les pommiers sont déjà grands !',
    cart: 'Prends ma charrette : moi, je n\'en ai plus l\'usage. Tes clients te reconnaîtront de loin !',
  },
};
