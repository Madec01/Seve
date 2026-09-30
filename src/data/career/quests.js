// Mode Carrière — quêtes et amitié de Joseph (données pures). Conception : docs/CARRIERE.md § 8.3.
// Moteur : src/core/career/quests.js (lot CORE-C). Rien de ce fichier n'est lu par une partie de niveau.

/** Rang à partir duquel Joseph propose des quêtes. */
export const QUEST_RANK = 2;

/**
 * Rythme des quêtes (retours de joueurs : « trop de quêtes en peu de temps », « une saison pour planter 10 patates,
 * c'était déjà trop tard ») : une seule quête à la fois, proposée au plus toutes les deux saisons, et un délai
 * large qui ne commence qu'à l'acceptation.
 *   seasonsBetweenOffers  au plus une proposition de Joseph toutes les N saisons (début de saison) ; le joueur peut
 *                         aussi lui demander un service dans le Carnet (askQuest), une fois par jour
 *   offerSeasons          une proposition pas encore acceptée attend la fin de la saison SUIVANTE, puis Joseph la
 *                         retire sans rien dire de fâché (questWithdrawn) ; aucun compte à rebours avant « Accepter »
 *   minSeasons            délai après l'acceptation : au moins N saisons entières de jours…
 *   growthFactor, marginDays  … et au moins 3 × la pousse la plus longue de ce qu'il faut produire + 2 jours ;
 *                         l'échéance tombe toujours le soir du DERNIER jour d'une saison (« jusqu'à la fin de l'hiver »)
 *   reminders             rappels (questReminder) quand il reste 3 jours puis 1 jour (échéance le soir du dernier)
 */
export const QUEST_PACE = { seasonsBetweenOffers: 2, offerSeasons: 2, minSeasons: 2, growthFactor: 3, marginDays: 2, reminders: [3, 1] };

/**
 * Modèles de quête.
 *   type   'crop'    : N récoltes d'une culture (semable cette saison ET la suivante : la proposition attend
 *                      jusqu'à la fin de la saison suivante) — mises de côté à la récolte, ou livrées du grenier
 *          'fruits'  : un panier de N fruits (récoltes d'arbres fruitiers ; mises de côté ou grenier)
 *          'product' : N produits transformés d'un atelier (comptés à la vente : ils sont payés normalement,
 *                      la récompense ajoute la moitié de leur valeur)
 *          'eggs'    : N œufs ramassés (poules, canes ; comptés au ramassage des abris ; ils sont payés normalement)
 *          'trees'   : planter N pommiers (une fois par carrière)
 *   n      : base + perRank × (rang − 2) + un tirage de 0 à jitter ; plafonné par la taille de la ferme
 *            (capPerPlot × parcelles de champ ouvertes pour 'crop', capPerTree × arbres pour 'fruits',
 *            poules et canes × jours du délai pour 'eggs') : au rang 2, 4 à 5 pommes de terre
 *   weight : poids du tirage (flux « events »)
 *   rewardFactor : récompense = rewardFactor × valeur des objets (prix de base × difficulté, sans le cours) ;
 *            'product' 0,5 : les produits sont déjà payés à la vente (total 1,5 × leur valeur) ;
 *            'eggs' : œufs comptés sans être retirés (valeur EGG_VALUE l'œuf, récompense en plus) ; 'trees' : prix des plants
 *   needs  : condition (src/core/career/quests.js) ; once : une seule fois par carrière
 *   text   : phrase de Joseph ({n}, {what} remplacés)
 */
export const QUEST_TEMPLATES = [
  { id: 'crop', type: 'crop', n: { base: 4, perRank: 2, jitter: 1, capPerPlot: 0.5, min: 3 }, weight: 40, rewardFactor: 1.5, text: 'Tu pourrais m\'apporter {n} {what} ? Ma sœur vient dîner, rien ne presse.' },
  { id: 'product', type: 'product', n: { base: 2, perRank: 1, jitter: 1 }, weight: 20, rewardFactor: 0.5, needs: 'workshop', text: 'J\'aimerais goûter tes {what} : {n}, ce serait parfait.' },
  { id: 'eggs', type: 'eggs', n: { base: 6, perRank: 4, jitter: 2 }, weight: 15, rewardFactor: 1.5, needs: 'eggs', text: 'Mes poules boudent… Tu me mettrais de côté {n} œufs ?' },
  { id: 'fruits', type: 'fruits', n: { base: 3, perRank: 1, jitter: 1, capPerTree: 2, min: 2 }, weight: 15, rewardFactor: 1.5, needs: 'trees', text: 'Un panier de {n} fruits pour la fête de l\'école, ça te dit ?' },
  { id: 'trees', type: 'trees', n: { base: 2, perRank: 0, jitter: 0 }, weight: 10, rewardFactor: 1.5, needs: 'orchard', once: true, text: 'Plante donc {n} pommiers au verger : tu me remercieras dans trois ans !' },
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
  questAccepted: 'Merci ! Rien ne presse : tu as jusqu\'à {deadline}.',
  questDeclined: 'Pas grave, une autre fois !',
  questProgress: 'Ça avance ! Encore {left}.',
  questReminder3: 'Petit rappel : plus que 3 jours pour mes {what}. Si tu n\'y arrives pas, ce n\'est pas grave !',
  questReminder1: 'Demain soir, c\'est le dernier jour pour mes {what}. Et sinon, tant pis : on reste amis !',
  questWithdrawn: 'Finalement, je me suis débrouillé. Merci quand même !',
  questAsk: 'Un service ? Justement, j\'y pensais…',
  questAskNone: 'Pour l\'instant, je n\'ai besoin de rien. Merci d\'avoir demandé !',
  questDone: 'Formidable ! Tiens, pour ta peine. Tu es un vrai voisin.',
  questDoneFem: 'Formidable ! Tiens, pour ta peine. Tu es une vraie voisine.',
  questExpired: 'Ce n\'est pas grave du tout ! Merci d\'avoir essayé, on remettra ça.',
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
