// La Vallée vivante — lot V2 « Le troc et les croisements » (données pures, carrière seulement). Règles et contenus :
// docs/VALLEE.md § 16 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 ». Moteur :
// src/core/career/{heritage,valley,heirlooms,habitat}.js. Les chiffres font foi ici (réglés par
// tools/simulate-career.js --compare-valley2, docs/VALLEE.md § 16.12).
//
// Ce fichier n'importe PAS src/data/career/valley.js (c'est valley.js qui l'importe : pas d'import circulaire). Les
// traits sont désignés par leur identifiant (TRAITS de valley.js) ; les cultures par leur identifiant (src/data/crops.js).
//
// Ordre des données = ordre des tirages : SPECIES_V2 est tiré à chaque aube (flux `valley2`, un nombre par espèce, dans
// cet ordre). Les tables du V1 (VARIETIES, SPECIES) ne changent jamais.

/**
 * La Grainothèque : emplacement réservé dans la bande de la maison (2 × 2 tuiles), panneau au rang `siteRank` ; 5 niveaux
 * (total 62 800 après réglage — départ 58 000, docs/VALLEE.md § 16.12 —, comptés à 100 % au patrimoine). Effets cumulés (un niveau garde les effets des précédents) :
 *   circle            cercle du troc de saison ouvert (1 : 4 voisins, 2 : 8, 3 : les 12) ;
 *   handSeeds         graines par récolte à la main d'une planche d'essai (au lieu de 2) ;
 *   fixHand           récoltes à la main pour sauver une variété (au lieu de 7) ;
 *   crossNeed         rencontres pour un croisement (au lieu de 3) ;
 *   fixedSeedFactor   prix des graines d'une variété sauvée (× 1 au lieu de × 1,25) ;
 *   touristBonus      touristes + 15 % (ils viennent voir les bocaux).
 */
export const SEED_LIBRARY = {
  name: 'La Grainothèque',
  siteRank: 3,
  siteName: 'Ici, une grainothèque ?',
  siteLines: ['Une maison pour vos graines', 'Le troc toute l\'année', 'Vos bocaux rangés'],
  levels: [
    { level: 1, name: 'La remise aux graines', price: 1600, rank: 3, circle: 1, vignette: 'library.1', unlocks: ['Troc de saison : un voisin par saison (4 voisins)', 'L\'étagère : toute la collection'] },
    { level: 2, name: 'La petite grainothèque', price: 4000, rank: 4, circle: 2, handSeeds: 3, vignette: 'library.2', unlocks: ['3 graines par récolte à la main', 'Troc : 4 voisins de plus'] },
    { level: 3, name: 'La grainothèque', price: 8000, rank: 5, circle: 3, fixHand: 5, vignette: 'library.3', unlocks: ['Variété sauvée en 5 récoltes à la main', 'Troc : les 12 voisins'] },
    { level: 4, name: 'Le jardin d\'essai', price: 19200, rank: 5, crossNeed: 2, vignette: 'library.4', unlocks: ['Croisement en 2 rencontres'] },
    { level: 5, name: 'La grainothèque vivante', price: 30000, rank: 6, fixedSeedFactor: 1, touristBonus: 0.15, vignette: 'library.5', unlocks: ['Graines des variétés sauvées au prix normal', 'Touristes + 15 %'] },
  ],
};
export const LIBRARY_MAX = SEED_LIBRARY.levels.length;

/** Genre du nom (premier nom) de chaque culture : accords (« Navet de la ferme est sauvé »). */
const CROP_GENDER = { carrot: 'f', turnip: 'm', wheat: 'm', cabbage: 'm', tomato: 'f', corn: 'm', sunflower: 'm', potato: 'f', strawberry: 'f', zucchini: 'f', pumpkin: 'f', apple: 'f' };

const village = (id, cropId, name, trait, clientId, from, anecdote, tint) => ({
  id, cropId, name, g: CROP_GENDER[cropId] || 'f', trait, traits: [trait], clientId, label: `De la part de ${from}`, anecdote,
  icon: `heirloom.${id}.icon`, ripe: `heirloom.${id}.4`, tint, group: 'village',
});

/** Les douze variétés du village (une par culture, gardées par un client du tableau ; (†) : domaine public). */
export const VILLAGE_VARIETIES = [
  village('carotteViolette', 'carrot', 'Carotte violette', 'fine', 'lili', 'Lili', 'Violette dehors, orange dedans : Lili jure que Caramel la préfère. Il n\'a jamais dit le contraire.', '#7a3d8f'),
  village('blancheDeVirginie', 'zucchini', 'Courgette blanche de Virginie', 'bee', 'fabre', 'Fabre', 'Pâle comme la lune : ses grandes fleurs attirent les abeilles dès l\'aube, dit le père Fabre.', '#d9e4b8'),
  village('bleueDArtois', 'potato', 'Pomme de terre bleue d\'Artois', 'hardy', 'garnier', 'M. Garnier', 'Bleue jusqu\'au cœur : les enfants de la cantine la réclament à chaque rentrée.', '#4a5a9a'),
  village('marteauDesVertus', 'turnip', 'Navet des Vertus Marteau', 'tasty', 'morel', 'Mme Morel', 'Long et blanc, le navet des maraîchers d\'autrefois : sa chair fine fond dans le pot-au-feu.', '#efe9d6'),
  village('barbuDuRoussillon', 'wheat', 'Blé barbu du Roussillon', 'scented', 'paulo', 'Paulo', 'Ses longues barbes dorées ondulent au vent ; sa farine sent la noisette, dit Paulo.', '#d8a640'),
  village('noireDeCrimee', 'tomato', 'Tomate noire de Crimée', 'tasty', 'chevalier', 'Mme Chevalier', 'Sombre comme une prune, juteuse comme une pêche : la fierté de la soupe de l\'auberge.', '#5a2a2a'),
  village('veloursRouge', 'sunflower', 'Tournesol velours rouge', 'fine', 'rose', 'Mme Rose', 'Ses pétales rouge sombre ont l\'air de velours : Mme Rose en met au cœur de ses bouquets.', '#9a2a2a'),
  village('coeurDeBoeufDesVertus', 'cabbage', 'Chou cœur de bœuf des Vertus', 'giant', 'odette', 'Mamie Odette', 'Pointu comme un cœur : Mamie Odette le fait mijoter tout l\'hiver dans sa grande marmite.', '#8fbf5a'),
  village('madameMoutot', 'strawberry', 'Fraise Madame Moutot', 'scented', 'perrin', 'Mlle Perrin', 'Grosse, ronde et parfumée : on la cultivait déjà au temps des grands-parents de Mlle Perrin.', '#e0283a'),
  village('blancDesLandes', 'corn', 'Maïs blanc des Landes', 'dry', 'maire', 'M. le maire', 'Il pousse dans le sable sans boire : le maire en sert la cruchade à chaque buffet.', '#f2e8c4'),
  village('galeuseDEysines', 'pumpkin', 'Citrouille galeuse d\'Eysines', 'tasty', 'twins', 'Zoé et Bastien', 'Couverte de petites bosses : plus elle est galeuse, plus elle est sucrée !', '#e8a07a'),
  village('apiEtoile', 'apple', 'Pomme Api étoilé', 'scented', 'leon', 'Léon', 'Une petite pomme à cinq côtes, en étoile : Léon en garde toujours une dans sa sacoche.', '#d8443a'),
];
export const VILLAGE_VARIETIES_BY_ID = Object.fromEntries(VILLAGE_VARIETIES.map((x) => [x.id, x]));
/** Variété du village d'une culture. */
export const VILLAGE_OF_CROP = Object.fromEntries(VILLAGE_VARIETIES.map((x) => [x.cropId, x.id]));

/**
 * Le troc de graines : on donne `seeds` graines d'une variété sauvée, le voisin en rend `seeds` (+ `favBonus` si la variété
 * donnée est d'une de ses cultures préférées du tableau) ; une fois par voisin. Propositions : à l'aube du `seasonDay`ᵉ
 * jour de chaque saison (Grainothèque ≥ 1, cercles ouverts) et au dernier jour d'hiver (foire aux graines), une seule à la
 * fois, sans limite de temps. `order` : ordre fixe des propositions ; `needs: 'orchard'` : il faut un verger.
 */
export const TROC = {
  seeds: 3,
  favBonus: 1,
  seasonDay: 2,
  order: [
    { clientId: 'lili', varietyId: 'carotteViolette', circle: 1 },
    { clientId: 'fabre', varietyId: 'blancheDeVirginie', circle: 1 },
    { clientId: 'garnier', varietyId: 'bleueDArtois', circle: 1 },
    { clientId: 'morel', varietyId: 'marteauDesVertus', circle: 1 },
    { clientId: 'paulo', varietyId: 'barbuDuRoussillon', circle: 2 },
    { clientId: 'chevalier', varietyId: 'noireDeCrimee', circle: 2 },
    { clientId: 'rose', varietyId: 'veloursRouge', circle: 2 },
    { clientId: 'odette', varietyId: 'coeurDeBoeufDesVertus', circle: 2 },
    { clientId: 'perrin', varietyId: 'madameMoutot', circle: 3 },
    { clientId: 'maire', varietyId: 'blancDesLandes', circle: 3 },
    { clientId: 'twins', varietyId: 'galeuseDEysines', circle: 3 },
    { clientId: 'leon', varietyId: 'apiEtoile', circle: 3, needs: 'orchard' },
  ],
  lines: {
    lili: { offer: 'Mes carottes violettes contre une de tes graines ? Caramel est d\'accord !', thanks: 'Je vais la semer à côté de la cabane de Caramel !', garden: 'Tes graines ont poussé à côté de la cabane de Caramel !' },
    fabre: { offer: 'Ma courgette blanche, celle des pique-niques. Un échange ?', thanks: 'Je la planterai près de l\'étang.', garden: 'Vos graines ont pris, au bord de l\'étang.' },
    garnier: { offer: 'Une pomme de terre bleue, pour la leçon de sciences. On échange ?', thanks: 'Les enfants vont la semer dans le jardin de l\'école.', garden: 'Vos graines poussent dans le jardin de l\'école !' },
    morel: { offer: 'Mes navets des Vertus donnent une teinture ivoire. Vous m\'échangez ?', thanks: 'Je teindrai une laine à vos couleurs.', garden: 'Vos graines ont fleuri sous ma fenêtre.' },
    paulo: { offer: 'Mon blé barbu fait la meilleure farine du canton. On échange ?', thanks: 'Je t\'apporterai la première miche !', garden: 'Tes graines ont levé derrière le fournil !' },
    chevalier: { offer: 'La tomate noire de ma grand-mère, contre une graine de chez vous ?', thanks: 'Elle ira dans le potager de l\'auberge.', garden: 'Vos graines font la fierté du potager de l\'auberge.' },
    rose: { offer: 'Mon tournesol velours rouge, contre une graine qui fleurit ?', thanks: 'Elle sera dans mes bouquets l\'été prochain.', garden: 'Vos graines sont dans mes bouquets !' },
    odette: { offer: 'Mon chou des Vertus tient tout l\'hiver. Tu m\'en donnes une des tiennes ?', thanks: 'Passe goûter la soupe cet hiver !', garden: 'Tes graines ont pris dans mon jardin, mon petit.' },
    perrin: { offer: 'La fraise Madame Moutot, parfumée comme une sonate. Un troc ?', thanks: 'Je jouerai un air pour elle, au jardin.', garden: 'Vos graines ont poussé au rythme de mes gammes.' },
    maire: { offer: 'Le maïs blanc des Landes, pour le buffet. La mairie propose un échange !', thanks: 'Au nom du village, merci pour ces graines !', garden: 'Vos graines fleurissent devant la mairie !' },
    twins: { offer: 'On a des graines de citrouille galeuse, chut… on échange ?', thanks: 'Promis, on la plantera devant la cabane !', garden: 'Tes graines ont poussé devant la cabane (chut !).' },
    leon: { offer: 'Un greffon d\'Api étoilé, de l\'arbre de mon grand-père. Un échange ?', thanks: 'Je la planterai sur ma tournée, au bord du chemin.', garden: 'Vos graines ont pris au bord de ma tournée.' },
  },
  /** Phrase spéciale quand on donne une variété croisée (au nom de la ferme). */
  crossThanks: 'Une graine {farm} ! Je la planterai devant chez moi.',
  /** Petit mot quand la variété donnée est d'une culture préférée (♥) : « Lili adore les carottes : 4 graines au lieu de 3 ! » */
  favThanks: '{name} adore {crop} : {n} {units} au lieu de {base} !',
  fairText: 'À la foire, tout le village est là.',
};
export const TROC_BY_CLIENT = Object.fromEntries(TROC.order.map((o) => [o.clientId, o]));

const cross = (cropId, parents, traits, text, tint) => {
  const id = `cross${cropId.charAt(0).toUpperCase()}${cropId.slice(1)}`;
  return { id, cropId, g: CROP_GENDER[cropId] || 'f', parents, traits, trait: traits[0], text, anecdote: text, tint, icon: `heirloom.${id}.icon`, ripe: `heirloom.${id}.4`, group: 'cross' };
};

/** Les onze croisements (variété du pays × variété du village ; pas de pommier) : traits hérités, sans hasard. */
export const CROSSES = [
  cross('carrot', ['jauneDuDoubs', 'carotteViolette'], ['tasty', 'fine'], 'Ni jaune ni violette : orangée au cœur pourpre, comme un coucher de soleil.', '#d9702a'),
  cross('turnip', ['bouleDOr', 'marteauDesVertus'], ['early', 'tasty'], 'Doré et allongé, il pousse vite et fond dans la bouche : le meilleur des deux.', '#e2c45a'),
  cross('wheat', ['rougeDeBordeaux', 'barbuDuRoussillon'], ['dry', 'scented'], 'Des épis roux à longues barbes : il tient la sécheresse et sa farine sent le pain chaud.', '#c07a34'),
  cross('cabbage', ['milanDePontoise', 'coeurDeBoeufDesVertus'], ['fine', 'giant'], 'Cloqué et pointu à la fois : un chou si grand qu\'il faut deux bras pour le porter.', '#5f9a44'),
  cross('tomato', ['coeurDeBoeuf', 'noireDeCrimee'], ['fine', 'tasty'], 'Grosse, côtelée, presque noire : une seule tranche fait une tartine.', '#6e2424'),
  cross('corn', ['grandRouxBasque', 'blancDesLandes'], ['hardy', 'dry'], 'Des grains roux et blancs mêlés, comme un épi en habit de fête.', '#dca060'),
  cross('sunflower', ['soleilDOr', 'veloursRouge'], ['bee', 'fine'], 'Or au bord, velours au cœur : les abeilles font la queue pour s\'y poser.', '#d9862a'),
  cross('potato', ['vitelotte', 'bleueDArtois'], ['tasty', 'hardy'], 'Violette et bleue marbrée : la purée en devient couleur lavande.', '#7a62a8'),
  cross('strawberry', ['reineDesVallees', 'madameMoutot'], ['bee', 'scented'], 'Petite comme une fraise des bois, parfumée comme une Moutot : un trésor de confiture.', '#c8202e'),
  cross('zucchini', ['rondeDeNice', 'blancheDeVirginie'], ['early', 'bee'], 'Ronde et pâle, elle pousse en un clin d\'œil sous ses grandes fleurs jaunes.', '#c4d88e'),
  cross('pumpkin', ['rougeVifDEtampes', 'galeuseDEysines'], ['giant', 'tasty'], 'Rouge vif et galeuse : la citrouille des contes, en plus sucrée.', '#d24a2a'),
];
export const CROSSES_BY_ID = Object.fromEntries(CROSSES.map((x) => [x.id, x]));
/** Croisement d'une culture (null pour le pommier). */
export const CROSS_OF_CROP = Object.fromEntries(CROSSES.map((x) => [x.cropId, x.id]));

/**
 * Croisements : `need` rencontres (Grainothèque niveau 4 : SEED_LIBRARY.levels[3].crossNeed) ; l'osmie installée fait
 * compter chaque rencontre `wildBeeFactor` fois ; un croisement donne un sachet doré de `seeds` graines.
 */
export const CROSS_RULES = { need: 3, wildBeeFactor: 2, seeds: 3 };

/** Accords des habitants du V2. */
const SPECIES_V2_FORMS = {
  wildBee: { the: 'L\'osmie', g: 'f', pl: false, welcome: 'Bienvenue, petite osmie !' },
  blackbird: { the: 'Le merle noir', g: 'm', pl: false, welcome: 'Bienvenue, beau merle !' },
  lizard: { the: 'Le lézard des murailles', g: 'm', pl: false, welcome: 'Bienvenue, petit lézard !' },
  bat: { the: 'La pipistrelle', g: 'f', pl: false, welcome: 'Bienvenue, petite pipistrelle !' },
};
const species2 = (id, name, seasons, recipe, spotKinds, service, hint, hintIcon, anecdote, extra = {}) => ({ id, name, ...SPECIES_V2_FORMS[id], icon: `wild.${id}`, seasons, recipe, spotKinds, service, hint, hintIcon, anecdote, group: 'v2', ...extra });

/**
 * Les quatre habitants du V2 (même forme que SPECIES du V1 ; ordre des tirages du flux `valley2`). service.kind :
 *   crossFactor (chaque rencontre de croisement compte `value` fois), hedgeFindsMax (cueillette des haies : `value` à la
 *   fois), heatGrowth (pousse + `value` les jours de canicule), staffSummer (l'été, l'équipe n'est jamais lasse).
 */
export const SPECIES_V2 = [
  species2('wildBee', 'Osmie', ['spring'], [{ kind: 'insectHotel', n: 2 }, { kind: 'flowers', n: 3 }], ['insectHotel'],
    { kind: 'crossFactor', value: 2, text: 'Chaque rencontre de croisement compte double.' },
    'De petits bouchons de terre au bout des tiges de l\'hôtel…', 'wild.hint.mud', 'Elle ferme chaque tige de son nid avec un bouchon de terre, comme une maçonne.'),
  species2('blackbird', 'Merle noir', ['winter'], [{ kind: 'hedge', n: 6 }, { kind: 'treeAdult', n: 1 }], ['hedge'],
    { kind: 'hedgeFindsMax', value: 4, text: 'Cueillette des haies : 4 trouvailles à la fois au lieu de 3.' },
    'Un chant flûté, au crépuscule, tout en haut de la haie…', 'wild.hint.note', 'Il chante dès la fin de l\'hiver, perché au plus haut, pour dire « ici, c\'est chez moi ».'),
  species2('lizard', 'Lézard des murailles', ['summer'], [{ kind: 'woodpile', n: 3 }, { kind: 'wildGround', n: 1 }], ['woodpile'],
    { kind: 'heatGrowth', value: 0.1, text: 'Les jours de canicule, vos cultures poussent 10 % plus vite.' },
    'Une petite queue qui file entre les pierres, en plein soleil…', 'wild.hint.tail', 'Il se chauffe au soleil le matin : sans chaleur, il ne peut pas courir.'),
  species2('bat', 'Pipistrelle', ['summer', 'autumn'], [{ kind: 'batbox', n: 1 }, { kind: 'pond', n: 1 }], ['batbox'],
    { kind: 'staffSummer', value: 1, seasons: ['summer'], text: 'L\'été, l\'équipe n\'est jamais lasse : on prend le frais, le soir, à les regarder voler.' },
    'Au crépuscule, de petites ombres zigzaguent au-dessus de la mare…', 'wild.hint.moon', 'Pas plus lourde qu\'une pièce, elle mange des milliers de moucherons chaque nuit.'),
];
export const SPECIES_V2_BY_ID = Object.fromEntries(SPECIES_V2.map((s) => [s.id, s]));

/** Les récits de la Grainothèque (Joseph) : relisibles ; ce ne sont pas des étapes. */
export const STORIES = [
  { id: 'heritage0', title: 'Une idée de Joseph', vignette: 'story.library', when: 'rank3', lines: ['Toutes ces graines, il leur faudrait une maison.', 'Derrière chez toi, il y a la place pour une petite remise en pierre.', 'Et les gens du village gardent des graines, eux aussi : on pourrait échanger.'] },
  { id: 'heritage1', title: 'La remise aux graines', vignette: 'story.library', when: 'library1', lines: ['Ma mère aurait aimé ça : des bocaux bien rangés, des étiquettes.', 'Ici, aucune graine ne se perdra plus.', 'Les voisins viendront épingler leurs sachets au tableau, tu verras.'] },
  { id: 'heritage2', title: 'Le premier croisement', vignette: 'story.cross', when: 'firstCross', lines: ['Deux fleurs côte à côte, une abeille entre les deux…', 'Et voilà une graine qui n\'existait nulle part ailleurs.', 'Elle porte le nom de ta ferme, maintenant. C\'est ton héritage, petit.'] },
  { id: 'heritage3', title: 'La grainothèque vivante', vignette: 'story.library5', when: 'library5', lines: ['Les gens viennent de loin pour voir tes bocaux, tu sais.', 'Ma mère disait : une graine qu\'on garde, c\'est une graine qui dort.', 'Une graine qu\'on donne, c\'est une graine qui vit.'] },
];
export const STORIES_BY_ID = Object.fromEntries(STORIES.map((s) => [s.id, s]));

/** Conseils « première fois » (UI). */
export const HERITAGE_HINTS = {
  'valley.library': 'La Grainothèque est bâtie : chaque saison, un voisin épinglera un sachet au tableau du village.',
  'valley.troc': 'Un voisin propose un troc : touchez le sachet du tableau. Ça ne vous coûte rien, la grainothèque garde toujours une poignée de graines.',
  'valley.pair': 'Une paire est semée : récoltez l\'une à la main pendant que l\'autre pousse juste à côté, les abeilles font une rencontre.',
  'valley.cross': 'Un croisement ! Sauvez cette variété comme les autres : elle porte le nom de votre ferme.',
  'valley.scented': 'Variété parfumée : à l\'atelier, ce qu\'on en fait vaut 15 % de plus.',
};

/** Textes. */
export const HERITAGE_TEXTS = {
  crossRule: 'Semez côte à côte les deux variétés d\'une même culture ; chaque fois que vous en récoltez une à la main pendant que l\'autre pousse juste à côté, les abeilles font une rencontre. 3 rencontres : une graine nouvelle, au nom de votre ferme.',
  noTroc: 'Aucun troc en attente.',
  trocWait: 'Le troc de la foire, en attendant.',
  saveFirst: 'Sauvez une première variété pour échanger.',
  noCost: 'Ça ne vous coûte rien : la grainothèque en garde toujours.',
  disabled: 'Grainothèque désactivée.',
  needOrchard: 'Il faut un verger',
  maxLevel: 'La grainothèque est déjà au plus haut.',
  pairNeed: 'Il faut d\'abord {the} : {client} {pron} garde dans son jardin.',
  pairNeedPays: 'Il faut d\'abord {name} (une variété du pays).',
};

/**
 * « de la Ferme des Tilleuls », « du Moulin », « des Saules », « de l'Orée », « d'Arcy », « de Chez Martin ».
 * Règle de docs/VALLEE.md § 16.4 : article défini contracté ; Ferme, Maison, Grange, Bergerie, Métairie, Bastide,
 * Closerie → « de la … » ; une voyelle → « d'… » ; sinon « de … ».
 */
export function ofFarm(name) {
  const n = String(name || '').trim() || 'la ferme';
  if (/^Le /.test(n)) return `du ${n.slice(3)}`;
  if (/^Les /.test(n)) return `des ${n.slice(4)}`;
  if (/^La /.test(n)) return `de la ${n.slice(3)}`;
  if (/^L['’]/.test(n)) return `de l'${n.slice(2)}`;
  if (/^la ferme$/.test(n)) return 'de la ferme';
  if (/^(Ferme|Maison|Grange|Bergerie|Métairie|Bastide|Closerie)\b/.test(n)) return `de la ${n}`;
  if (/^[AEIOUYÀÂÉÈÊËÎÏÔÛÙÜaeiouyàâéèêëîïôûùü]/.test(n)) return `d'${n}`;
  return `de ${n}`;
}

/** Une culture qu'on aime (« Lili adore les carottes ») : petit mot du ♥ au troc. */
export const CROP_LOVE = { carrot: 'les carottes', turnip: 'les navets', wheat: 'le blé', cabbage: 'les choux', tomato: 'les tomates', corn: 'le maïs', sunflower: 'les tournesols', potato: 'les pommes de terre', strawberry: 'les fraises', zucchini: 'les courgettes', pumpkin: 'les citrouilles', apple: 'les pommes' };

/** Nom de culture d'un croisement (« Tomate », « Pomme de terre »). */
export const CROP_NAMES = { carrot: 'Carotte', turnip: 'Navet', wheat: 'Blé', cabbage: 'Chou', tomato: 'Tomate', corn: 'Maïs', sunflower: 'Tournesol', potato: 'Pomme de terre', strawberry: 'Fraise', zucchini: 'Courgette', pumpkin: 'Citrouille', apple: 'Pomme' };

/** « Tomate de la Ferme des Tilleuls » (nom calculé, jamais enregistré). */
export function crossName(x, farmName) {
  const c = typeof x === 'string' ? CROSSES_BY_ID[x] : x;
  if (!c) return '';
  return `${CROP_NAMES[c.cropId] || c.cropId} ${ofFarm(farmName)}`;
}

/** Nom court d'un croisement pour les listes serrées : « Tomate · de la ferme ». */
export function crossShortName(x) {
  const c = typeof x === 'string' ? CROSSES_BY_ID[x] : x;
  return c ? `${CROP_NAMES[c.cropId] || c.cropId} · de la ferme` : '';
}
