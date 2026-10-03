// Lot 4 « Collection & enjeux doux » — D1 : l'album de la ferme (données pures). Règles et contenus :
// docs/GAME_DESIGN.md § 17.1 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats ». Moteur : src/core/album.js.
//
// Une page = { id, name, icon, cases: [case], reward: { ecus, cosmeticId } }.
// Une case = { id, name, icon, mode: 'all' | 'dc' | 'career', check: { type, id? }, text (anecdote), hint, stamps? }
//   caseId = '<pageId>.<id>' (ex. 'garden.carrot', 'sky.fog') — identifiant permanent (progression).
//   mode : 'all' = niveaux (Détente et Classique) et carrière ; 'dc' = Détente ou carrière (contenus des lots 2 à 4) ;
//          'career' = carrière seulement.
//   check.type (lu dans les faits de src/core/album.js) : cropHarvested, productSold, animalProduct, animalOwned, pet,
//          weather, specialWeather, surprise, find, forage, wish, client, merchantMet, theme, fete, comice, contest,
//          cartFull, goldMedal, winterFind, trace, bird, fish, story.
//   stamps : tampons possibles en plus ('gold' | 'giant' | 'fete' | 'visitor' | 'best') ; ils ne sont pas nécessaires
//            pour compléter la page (récompenses en plus : ALBUM_EXTRA_REWARDS).
// Les icônes réutilisent les sprites existants (cultures, produits, animaux, météo, surprises, portraits) ; les
// manquants sont dessinés par le paquet ART (planche lot4).

import { SEED_RULES, SPECIES, VARIETIES } from './career/valley.js';
import { CROSSES, CROP_NAMES, SPECIES_V2, TROC, VILLAGE_VARIETIES_BY_ID } from './career/heritage.js';
import { CLIENTS } from './variety.js';

export const ALBUM_VERSION = 1;

/**
 * Pages réservées par le lot 4 à « La Vallée vivante » : remplies par le lot V1 (graines anciennes, habitants de la
 * ferme). Les lots suivants de la Vallée ajoutent des pages NOUVELLES (jamais une case dans une page existante).
 */
export const RESERVED_PAGE_IDS = ['heirlooms', 'wildlife'];

/** Tampons : ordre d'affichage et noms. */
export const ALBUM_STAMPS = {
  gold: { name: 'Récolte dorée', icon: 'album.stamp.gold' },
  giant: { name: 'Légume géant', icon: 'album.stamp.giant' },
  fete: { name: 'Fête jouée', icon: 'album.stamp.fete' },
  visitor: { name: 'Visiteur accueilli', icon: 'album.stamp.visitor' },
  best: { name: 'Le meilleur résultat', icon: 'album.stamp.best' },
  // (Vallée V2) Troc : la variété donnée était d'une culture préférée du voisin (♥).
  heart: { name: 'Une préférée offerte ♥', icon: 'album.stamp.heart' },
};

/** Suffixes des indices selon le mode de la case (affichés quand on joue dans un mode qui ne la donne pas). */
export const ALBUM_MODE_NOTES = {
  career: 'À découvrir dans Ma ferme',
  dc: 'En Détente ou dans Ma ferme',
};

const crop = (id, name, text, extra = {}) => ({
  id, name, icon: `crop.${id}.icon`, mode: 'all', check: { type: 'cropHarvested', id }, text, hint: `Récoltez une ${name.toLowerCase()}.`, stamps: ['gold', 'giant'], ...extra,
});

const GARDEN = [
  crop('carrot', 'Carotte', 'Les fanes se mangent aussi : en pesto, Mamie Odette jure que c\'est un délice.'),
  crop('turnip', 'Navet', 'Avant la pomme de terre, c\'était lui qui remplissait les marmites d\'hiver.', { hint: 'Récoltez un navet.' }),
  crop('wheat', 'Blé', 'Un seul grain semé donne un épi d\'une quarantaine de grains : de quoi faire rêver le boulanger.', { hint: 'Récoltez du blé.' }),
  crop('cabbage', 'Chou', 'Il aime le froid : après une gelée, ses feuilles deviennent plus sucrées.', { hint: 'Récoltez un chou.' }),
  crop('tomato', 'Tomate', 'On l\'a longtemps crue toxique : on la cultivait pour décorer les jardins.'),
  crop('corn', 'Maïs', 'Chaque fil soyeux de l\'épi correspond à un grain : pas de fil, pas de grain !', { hint: 'Récoltez du maïs.' }),
  crop('sunflower', 'Tournesol', 'Jeune, il suit le soleil d\'est en ouest ; adulte, il regarde l\'est pour toujours.', { hint: 'Récoltez un tournesol.' }),
  crop('potato', 'Pomme de terre', 'Parmentier faisait garder ses champs le jour… pour donner envie de les voler la nuit.'),
  crop('strawberry', 'Fraise', 'Ses vraies graines sont les petits points dorés sur sa peau.'),
  crop('zucchini', 'Courgette', 'Oubliez-en une trois jours sous les feuilles : elle devient une massue.'),
  crop('pumpkin', 'Citrouille', 'Les plus grosses du monde pèsent plus lourd qu\'une vache.'),
  crop('apple', 'Pomme', 'Un pommier peut donner des pommes pendant plus de cinquante ans.', { stamps: ['gold'], hint: 'Récoltez un panier de pommes.' }),
  crop('pea', 'Petits pois', 'Mendel a découvert l\'hérédité en comptant des petits pois, lisses ou ridés.', { mode: 'dc', hint: 'Basile vend parfois ses graines.' }),
  crop('melon', 'Melon', 'Un bon melon est lourd dans la main et sent bon près de la queue.', { mode: 'dc', hint: 'Basile vend parfois ses graines.' }),
  crop('leek', 'Poireau', 'Au pays de Galles, on en épingle un au chapeau le 1er mars.', { mode: 'dc', hint: 'Basile vend parfois ses graines.' }),
];

const sold = (id, name, text) => ({ id, name, icon: `product.${id}`, mode: 'all', check: { type: 'productSold', id }, text, hint: 'Vendez ce produit de l\'atelier.' });
const animalProduct = (id, name, mode, text, hint = 'Ramassez-en à l\'abri.') => ({ id, name, icon: `product.${id}`, mode, check: { type: 'animalProduct', id }, text, hint });

const HOMEMADE = [
  sold('strawberryJam', 'Confiture de fraises', 'Autant de sucre que de fruits : la règle des confitures de grand-mère.'),
  sold('appleJuice', 'Jus de pomme', 'Il faut environ deux kilos de pommes pour un litre de jus.'),
  sold('cowCheese', 'Fromage de vache', 'Une dizaine de litres de lait pour un kilo de fromage.'),
  sold('goatCheese', 'Fromage de chèvre', 'Frais, il se tartine ; sec, il se râpe : la chèvre est polyvalente.'),
  sold('flour', 'Farine', 'Au moulin, la meule du dessous ne tourne pas : c\'est celle du dessus qui travaille.'),
  sold('bread', 'Pain', 'Les miettes allaient aux poules : rien ne se perdait.'),
  animalProduct('eggs', 'Œufs', 'all', 'Une poule pond presque un œuf par jour quand les jours sont longs.'),
  animalProduct('milk', 'Lait', 'all', 'Une vache boit jusqu\'à cent litres d\'eau par jour.', 'Une vache ou une chèvre, et du lait à la ferme.'),
  animalProduct('wool', 'Laine', 'all', 'Une tonte donne environ quatre kilos de laine par mouton.', 'Gardez des moutons jusqu\'à la tonte.'),
  animalProduct('angora', 'Laine angora', 'career', 'On dit la laine angora sept fois plus chaude que celle du mouton.'),
  animalProduct('duckEgg', 'Œufs de cane', 'career', 'Plus gros que ceux de poule, ils font des gâteaux plus moelleux.'),
  animalProduct('truffle', 'Truffe', 'career', 'Autrefois, on cherchait les truffes avec des cochons… qui les aimaient un peu trop.', 'Un cochon au pré, en automne…'),
];

const animal = (id, name, mode, text, icon = `animal.${id}`) => ({ id, name, icon, mode, check: { type: 'animalOwned', id }, text, hint: 'Accueillez cet animal à la ferme.' });

const ANIMALS = [
  animal('hen', 'Poule', 'all', 'Les poules reconnaissent une centaine de visages, humains compris.', 'animal.chicken'),
  animal('cow', 'Vache', 'all', 'Les vaches ont une meilleure amie, et s\'ennuient loin d\'elle.'),
  animal('sheep', 'Mouton', 'all', 'Un mouton se souvient de cinquante visages pendant deux ans.'),
  animal('goat', 'Chèvre', 'all', 'Ses pupilles rectangulaires lui font voir presque tout autour d\'elle.'),
  animal('bees', 'Abeilles', 'all', 'Pour un pot de miel, les abeilles visitent des millions de fleurs.', 'beehive'),
  animal('rabbit', 'Lapin', 'career', 'Un lapin heureux saute en l\'air en se tortillant : on appelle ça un « binky ».'),
  animal('duck', 'Canard', 'career', 'Les canetons suivent la première chose qu\'ils voient bouger en sortant de l\'œuf.'),
  animal('pig', 'Cochon', 'career', 'Le cochon est propre : il se roule dans la boue pour se rafraîchir.'),
  animal('horse', 'Cheval', 'career', 'Un cheval peut dormir debout : ses jambes se verrouillent toutes seules.'),
  { id: 'cat', name: 'Chat', icon: 'pet.cat', mode: 'career', check: { type: 'pet', id: 'cat' }, text: 'Le chat de ferme garde le grenier des souris depuis des milliers d\'années.', hint: 'Un jour, un petit animal perdu…' },
  { id: 'dog', name: 'Chien', icon: 'pet.dog', mode: 'career', check: { type: 'pet', id: 'dog' }, text: 'Un chien de berger comprend des dizaines de mots et de coups de sifflet.', hint: 'Un jour, un petit animal perdu…' },
];

const sky = (id, name, type, text, hint) => ({ id, name, icon: `icon.weather.${id}`, mode: type === 'weather' ? 'all' : 'dc', check: { type, id }, text, hint });

const SKY = [
  sky('storm', 'Orage', 'weather', 'Comptez les secondes entre l\'éclair et le tonnerre : trois secondes, un kilomètre.', 'Un jour d\'orage…'),
  sky('heatwave', 'Canicule', 'weather', 'Par grosse chaleur, on arrose le soir : l\'eau s\'évapore moins vite.', 'Un jour de canicule, en été…'),
  sky('snow', 'Neige', 'weather', 'La neige est une couverture : dessous, le sol gèle moins.', 'Un jour de neige, en hiver…'),
  sky('warmrain', 'Pluie chaude', 'specialWeather', 'Après une pluie tiède, on dit que l\'herbe pousse « à vue d\'œil ».', 'Une pluie, du printemps à l\'automne…'),
  sky('fog', 'Brouillard', 'specialWeather', 'Un matin de brouillard en automne, les champignons sortent de partout.', 'Un matin de brouillard, au printemps ou en automne…'),
  sky('shootingstar', 'Étoiles filantes', 'specialWeather', 'Ce sont des grains de poussière qui brûlent très haut dans le ciel.', 'Une nuit claire, de l\'été à l\'hiver…'),
  sky('goldenhour', 'Heure dorée', 'specialWeather', 'Juste avant le coucher du soleil, tout prend une couleur de miel.', 'Un jour de soleil, du printemps à l\'automne…'),
  sky('rainbow', 'Arc-en-ciel', 'specialWeather', 'On ne voit un arc-en-ciel que dos au soleil.', 'Un rayon de soleil après la pluie…'),
];

const luck = (id, name, mode, check, icon, text, hint) => ({ id, name, icon, mode, check, text, hint });
const DAWN = 'Une surprise de l\'aube…';
const CLEARING = 'En défrichant un terrain…';

const LUCK = [
  luck('fairy', 'La fée des cultures', 'dc', { type: 'surprise', id: 'fairy' }, 'fairy', 'Personne ne l\'a jamais vue en plein jour. Mais les choux, eux, s\'en souviennent.', DAWN),
  luck('chest', 'Un vieux coffre', 'dc', { type: 'surprise', id: 'chest' }, 'chest.old', 'Les anciens cachaient leurs économies dans un coffre… et oubliaient parfois où.', DAWN),
  luck('ring', 'Un cercle de fées', 'dc', { type: 'surprise', id: 'ring' }, 'mushroom.ring', 'Les champignons poussent en rond, et le cercle s\'élargit un peu chaque année.', DAWN),
  luck('mushrooms', 'Champignons du brouillard', 'dc', { type: 'forage' }, 'mushroom', 'Cueillez-les au couteau, sans arracher : ils repousseront.', 'Un matin de brouillard, cueillez les champignons.'),
  luck('fox', 'Un renard', 'career', { type: 'surprise', id: 'fox' }, 'fox', 'Un renard près d\'un champ, c\'est moins de corbeaux… et de campagnols.', DAWN),
  luck('hedgehog', 'Un hérisson', 'dc', { type: 'surprise', id: 'hedgehog' }, 'hedgehog', 'Un hérisson mange des dizaines de limaces et d\'insectes chaque nuit.', DAWN),
  luck('owl', 'La chouette sculptée', 'dc', { type: 'surprise', id: 'owl' }, 'owl.carved', 'Le sculpteur l\'avait posée là pour faire peur aux souris.', DAWN),
  luck('wish', 'Un vœu exaucé', 'dc', { type: 'wish' }, 'icon.weather.shootingstar', 'Il paraît qu\'un vœu dit tout bas porte plus loin.', 'Après une nuit d\'étoiles filantes, faites un vœu.'),
  luck('coins', 'Un pot de pièces', 'career', { type: 'find', id: 'coins' }, 'find.coins', 'Une pièce de 1900 ! Le grand-père de Joseph en a peut-être perdu d\'autres…', CLEARING),
  luck('seedjar', 'Un bocal de graines anciennes', 'career', { type: 'find', id: 'seedjar' }, 'find.seedjar', 'Certaines graines dorment des dizaines d\'années avant de germer.', CLEARING),
  luck('well', 'Un vieux puits', 'career', { type: 'find', id: 'well' }, 'find.well', 'Avant le robinet, chaque ferme avait son puits, et son seau qui grince.', CLEARING),
  luck('lamb', 'Un agneau perdu', 'career', { type: 'find', id: 'lamb' }, 'find.lostlamb', 'Un agneau reconnaît la voix de sa mère parmi tout le troupeau.', CLEARING),
  luck('statue', 'Une petite statue', 'career', { type: 'find', id: 'statue' }, 'find.statue', 'C\'est saint Fiacre, le patron des jardiniers.', CLEARING),
];

const client = (id, name, text) => ({ id, name, icon: `portrait.client.${id}`, mode: 'dc', check: { type: 'client', id }, text, hint: `Livrez une commande à ${name.split(',')[0]}.` });

const VILLAGE = [
  client('rose', 'Mme Rose, la fleuriste', 'Elle reconnaît chaque fleur du village à son parfum, les yeux fermés.'),
  client('paulo', 'Paulo, le boulanger', 'Il se lève à trois heures du matin, et chante en pétrissant.'),
  client('lili', 'La petite Lili', 'Son lapin Caramel a droit à une carotte par jour, pas une de plus.'),
  client('garnier', 'M. Garnier, l\'instituteur', 'Chaque printemps, sa classe sème des radis dans des pots de yaourt.'),
  client('chevalier', 'Mme Chevalier, l\'aubergiste', 'Sa soupe du soir n\'a jamais deux fois la même recette.'),
  client('fabre', 'Le père Fabre, pêcheur', 'Il a pris un brochet long comme un bras. Le bras grandit à chaque fois qu\'il le raconte.'),
  client('perrin', 'Mlle Perrin, la musicienne', 'Elle accorde son violon sur le chant du merle.'),
  client('maire', 'M. le maire', 'Son écharpe tricolore ne sort que pour les fêtes et les mariages.'),
  client('odette', 'Mamie Odette', 'Ses bocaux sont rangés par année, depuis 1974.'),
  client('leon', 'Léon, le facteur', 'Il connaît le nom de tous les chiens du village, et leurs humeurs.'),
  client('morel', 'Mme Morel, la couturière', 'Elle teint ses laines au tournesol et à la pelure d\'oignon.'),
  client('twins', 'Zoé et Bastien, les jumeaux', 'Leur cabane secrète est au fond du verger. Tout le monde le sait. Chut.'),
  { id: 'basile', name: 'Basile le colporteur', icon: 'portrait.merchant', mode: 'dc', check: { type: 'merchantMet' }, text: 'Sa roulotte a fait trois fois le tour du pays. Il ne dit jamais par où.', hint: 'Le colporteur passe le 5ᵉ jour de chaque saison.' },
];

const year = (id, name, text) => ({ id, name, icon: `icon.theme.${id}`, mode: 'career', check: { type: 'theme', id }, text, hint: 'Une année à thème…', stamps: ['fete', 'visitor'] });

const YEARS = [
  year('bees', 'L\'année des abeilles', 'Margot parle à ses ruches chaque matin : les abeilles aiment les nouvelles.'),
  year('cheese', 'L\'année du fromage', 'Anselme retourne ses meules à la main, une par une, chaque matin.'),
  year('tourism', 'Le boom touristique', 'Son article a fait venir des visiteurs jusque de la ville.'),
  year('giants', 'L\'année des géants', 'Gaspard parle à ses citrouilles. Il prétend qu\'elles écoutent.'),
  year('frogs', 'L\'année des grenouilles', 'Quand les grenouilles chantent fort le soir, Firmin annonce la pluie.'),
  year('orchard', 'L\'année des vergers', 'Mathis greffe ses pommiers comme on coud : avec patience et du raphia.'),
  year('bread', 'L\'année du pain', 'Jeanne connaît le vent mieux que personne : c\'est lui qui fait tourner son moulin.'),
  year('markets', 'Les grands marchés', 'Il pèse tout d\'un coup d\'œil, et se trompe rarement de plus d\'une pomme.'),
  year('lights', 'L\'année des lumières', 'Chez lui, l\'hiver dure six mois, et l\'on chante pour faire revenir le soleil.'),
];

const FETES_PAGE = [
  { id: 'seedFair', name: 'La foire aux graines', icon: 'fete.seedstall', mode: 'career', check: { type: 'fete', id: 'seedFair' }, text: 'À la fin de l\'hiver, on échangeait ses plus belles graines, avant les semis.', hint: 'Jouez à la fête : hiver, dernier jour.', stamps: ['best'] },
  { id: 'eggHunt', name: 'La chasse aux œufs', icon: 'fete.egg.0', mode: 'dc', check: { type: 'fete', id: 'eggHunt' }, text: 'Teints à la pelure d\'oignon, les œufs sortaient couleur cuivre.', hint: 'Jouez à la fête : printemps, jour 3.', stamps: ['best'] },
  { id: 'soup', name: 'La soupe partagée', icon: 'fete.pot', mode: 'dc', check: { type: 'fete', id: 'soup' }, text: 'Chacun apporte un légume : c\'est toute l\'histoire de la soupe au caillou.', hint: 'Jouez à la fête : été, jour 4.', stamps: ['best'] },
  { id: 'stand', name: 'Le stand de la ferme', icon: 'fete.stand', mode: 'dc', check: { type: 'fete', id: 'stand' }, text: 'Le maire juge les stands avec un carnet… et goûte un peu de tout.', hint: 'Jouez à la fête : automne, jour 2.', stamps: ['best'] },
  { id: 'christmas', name: 'Les paniers de Noël', icon: 'fete.basket', mode: 'dc', check: { type: 'fete', id: 'christmas' }, text: 'Un panier offert à un voisin revient toujours, rempli d\'autre chose.', hint: 'Jouez à la fête : hiver, jour 4.', stamps: ['best'] },
  { id: 'comice', name: 'Le comice agricole', icon: 'icon.career.contest', mode: 'career', check: { type: 'comice' }, text: 'Les premiers comices, au XIXᵉ siècle, primaient les plus belles bêtes du canton.', hint: 'Réussissez une épreuve du comice.' },
  { id: 'contest', name: 'Le concours du village', icon: 'icon.contest', mode: 'dc', check: { type: 'contest' }, text: 'La plus grosse citrouille du concours a dû être portée à quatre.', hint: 'Réussissez une épreuve du concours (niveau 12).' },
  { id: 'cart', name: 'La charrette pleine', icon: 'icon.cart', mode: 'dc', check: { type: 'cartFull' }, text: 'L\'âne de la charrette s\'appelle Pompon. Il préfère les carottes aux compliments.', hint: 'Remplissez toutes les caisses d\'une charrette.' },
  { id: 'goldMedal', name: 'Une médaille d\'or', icon: 'medal.gold', mode: 'dc', check: { type: 'goldMedal' }, text: 'Une médaille, ça s\'accroche au mur de la cuisine, près du calendrier.', hint: 'Une médaille d\'or à un défi de la saison.' },
];

const edge = (id, name, text, type = 'winterFind', icon = `winter.${id}`) => ({ id, name, icon, mode: 'dc', check: { type, id }, text, hint: type === 'trace' ? 'Un jour de neige.' : 'En hiver, en lisière de la forêt.' });

const EDGE = [
  edge('deadwood', 'Bois mort', 'Le petit bois sec allume le feu ; les bûches le font durer.'),
  edge('pinecone', 'Pommes de pin', 'Fermées quand il fait humide, ouvertes quand il fait sec : un vrai baromètre.'),
  edge('holly', 'Houx', 'Seuls les houx femelles portent des boules rouges.'),
  edge('blewit', 'Pieds-bleus', 'Ce champignon d\'hiver a le pied violet et une odeur fruitée.'),
  edge('chestnut', 'Châtaignes', 'Une bogue piquante cache deux ou trois châtaignes.'),
  edge('mistletoe', 'Gui', 'Le gui pousse sur les arbres sans jamais toucher la terre.'),
  edge('hareTrack', 'Traces de lièvre', 'Les grandes pattes arrière se posent devant les petites : le lièvre est passé en sautant.', 'trace', 'track.hare'),
  edge('deerTrack', 'Traces de chevreuil', 'Deux petits sabots en forme de cœur, bien alignés.', 'trace', 'track.deer'),
  edge('foxTrack', 'Traces de renard', 'Le renard pose ses pattes en ligne droite, comme sur un fil.', 'trace', 'track.fox'),
];

const bird = (id, name, text, hint = 'Remplissez la mangeoire en hiver.') => ({ id, name, icon: `bird.${id}`, mode: 'dc', check: { type: 'bird', id }, text, hint });
const fish = (id, name, text) => ({ id, name, icon: `fish.${id}`, mode: 'career', check: { type: 'fish', id }, text, hint: 'Pêchez à la mare.' });

const FEEDER = [
  bird('greatTit', 'Mésange charbonnière', 'Sa cravate noire : plus elle est large, plus le mâle est fier.'),
  bird('blueTit', 'Mésange bleue', 'Elle s\'accroche la tête en bas pour attraper les graines.'),
  bird('robin', 'Rouge-gorge', 'Il suit le jardinier qui bêche, pour attraper les vers.'),
  bird('sparrow', 'Moineau', 'Il prend des bains de poussière pour se débarrasser des petites bêtes.'),
  bird('chaffinch', 'Pinson', 'Les pinsons d\'une même région chantent avec le même accent.'),
  bird('bullfinch', 'Bouvreuil', 'Le mâle a la poitrine rose vif ; on le voit surtout quand il fait très froid.', 'Remplissez la mangeoire plusieurs jours de suite.'),
  bird('nuthatch', 'Sittelle', 'Le seul oiseau qui descend les troncs la tête en bas.'),
  bird('woodpecker', 'Pic épeiche', 'Il tambourine jusqu\'à vingt coups par seconde, sans mal de tête.', 'Remplissez la mangeoire plusieurs jours de suite.'),
  fish('gudgeon', 'Goujon', 'Petit poisson des fonds de sable : les pêcheurs le prennent par dizaines.'),
  fish('roach', 'Gardon', 'On le reconnaît à ses yeux rouges.'),
  fish('perch', 'Perche', 'Ses rayures l\'aident à se cacher dans les herbes de la mare.'),
  fish('trout', 'Truite', 'Elle ne vit que dans une eau fraîche et propre : c\'est bon signe.'),
  fish('pike', 'Brochet', 'Immobile comme un bâton, puis rapide comme une flèche.'),
];

/** Les 12 veillées de Joseph (ordre fixe ; progression permanente commune aux deux modes). */
export const STORIES = [
  { id: 's1', title: 'La boîte en fer', lines: ['Ma mère gardait ses graines dans une boîte à biscuits.', 'Des haricots, des courges, un melon de son village.', 'Je l\'ai toujours, tu sais. Un jour, je te la montrerai.'] },
  { id: 's2', title: 'Les haies d\'autrefois', lines: ['Quand j\'étais petit, chaque champ avait sa haie.', 'Et chaque haie avait ses merles, ses hérissons, ses mûres.', 'On les a arrachées pour les tracteurs. Les oiseaux sont partis avec.'] },
  { id: 's3', title: 'Le ruisseau', lines: ['Il y avait un ruisseau, là, derrière les chênes.', 'On y pêchait des écrevisses avec un bout de lard et une ficelle.', 'Il s\'est tari l\'année de la grande sécheresse. Je l\'entends encore, parfois.'] },
  { id: 's4', title: 'La grande neige', lines: ['L\'hiver de mes dix ans, la neige est montée jusqu\'aux fenêtres.', 'On sortait par la lucarne du grenier, avec des pelles.', 'Les vaches ont eu chaud tout l\'hiver : on dormait presque avec elles !'] },
  { id: 's5', title: 'Pataud', lines: ['Mon chien Pataud ramenait les vaches tout seul, le soir.', 'Il connaissait l\'heure mieux que l\'horloge de l\'église.', 'Il me manque encore. Les bons chiens ne s\'oublient pas.'] },
  { id: 's6', title: 'Le premier tracteur', lines: ['Le jour où le premier tracteur est arrivé, tout le village est sorti.', 'Il était rouge, il toussait, et il faisait peur aux poules.', 'Mon père a dit : il ira plus vite, mais il ne saura jamais où pousse la menthe.'] },
  { id: 's7', title: 'Le bal', lines: ['C\'est au bal de juillet, sous les lampions, que j\'ai dansé avec Lucienne.', 'Elle m\'a marché sur les pieds toute la soirée.', 'On s\'est mariés l\'année suivante. Elle marchait toujours sur mes pieds.'] },
  { id: 's8', title: 'Le colporteur d\'antan', lines: ['Avant Basile, il y avait son grand-père, avec un âne et deux paniers.', 'Il vendait des aiguilles, du fil, des graines… et des histoires.', 'Les histoires, il les donnait pour rien. C\'était le meilleur de sa marchandise.'] },
  { id: 's9', title: 'Les cigognes', lines: ['Ma grand-mère disait que les cigognes nichaient sur le clocher.', 'Elles revenaient chaque printemps, le même jour, à ce qu\'elle disait.', 'Je ne les ai jamais vues. Mais je regarde toujours le clocher, en mars.'] },
  { id: 's10', title: 'Le vieux tilleul', lines: ['Le grand tilleul de la place, c\'est mon père qui l\'a planté.', 'L\'année de ma naissance, avec un seau d\'eau et beaucoup d\'espoir.', 'Les tilleuls, ça vit longtemps. Bien plus longtemps que les fermiers.'] },
  { id: 's11', title: 'Les hérissons', lines: ['On leur laissait une soucoupe de lait, le soir, au bout du jardin.', 'Il paraît que c\'est une mauvaise idée, maintenant : de l\'eau, et c\'est tout.', 'Mais ils revenaient chaque soir. Je crois qu\'ils venaient surtout pour la compagnie.'] },
  { id: 's12', title: 'La vallée qui chante', lines: ['Tu sais, la vallée chantait, avant. Les oiseaux, les grenouilles, le ruisseau.', 'Elle s\'est tue petit à petit, sans qu\'on y prenne garde.', 'Un jour, elle chantera de nouveau. Il suffit de lui laisser un peu de place.'] },
];

export const STORIES_BY_ID = Object.fromEntries(STORIES.map((s) => [s.id, s]));

const STORY_CASES = STORIES.map((s, k) => ({
  id: s.id, name: s.title, icon: 'icon.story', mode: 'dc', check: { type: 'story', n: k + 1 }, text: s.lines[0], hint: 'Un soir d\'hiver, chez Joseph.',
}));

// (Vallée vivante, lot V1) Graines anciennes (variété fixée) et habitants de la ferme (espèce installée) : carrière.
const HEIRLOOM_CASES = VARIETIES.map((x) => ({
  id: x.id, name: x.name, icon: x.icon, mode: 'career', check: { type: 'heirloomFixed', id: x.id }, text: x.anecdote, hint: `Sauvez cette variété ancienne : ${SEED_RULES.fixHand} récoltes à la main.`,
}));
const WILDLIFE_CASES = SPECIES.map((sp) => ({
  id: sp.id, name: sp.name, icon: sp.icon, mode: 'career', check: { type: 'wildlifeInstalled', id: sp.id }, text: sp.anecdote, hint: 'Remplissez sa recette d\'habitat, puis allez le voir quand il vient.',
}));

// (Vallée vivante, lot V2) Le troc du village (un troc par voisin, tampon ♥), les variétés de la ferme (croisée sauvée),
// les habitants (suite) : carrière.
const CLIENT_NAME = Object.fromEntries(CLIENTS.map((c) => [c.id, c.name]));
const SWAP_CASES = TROC.order.map((o) => {
  const x = VILLAGE_VARIETIES_BY_ID[o.varietyId];
  return { id: o.clientId, name: `${CLIENT_NAME[o.clientId] || o.clientId} · ${x.name}`, icon: x.icon, mode: 'career', check: { type: 'swapDone', id: o.clientId }, text: x.anecdote, hint: 'Un troc de graines, au tableau du village.', stamps: ['heart'] };
});
const CROSS_CASES = CROSSES.map((c) => ({
  id: c.id, name: `${CROP_NAMES[c.cropId]} de la ferme`, icon: c.icon, mode: 'career', check: { type: 'heirloomFixed', id: c.id }, text: c.text, hint: 'Semez côte à côte les deux variétés d\'une même culture, puis sauvez la graine née chez vous.',
}));
const WILDLIFE2_CASES = SPECIES_V2.map((sp) => ({
  id: sp.id, name: sp.name, icon: sp.icon, mode: 'career', check: { type: 'wildlifeInstalled', id: sp.id }, text: sp.anecdote, hint: 'Remplissez sa recette d\'habitat, puis allez le voir quand il vient.',
}));

/** Les 16 pages (175 cases) : les 11 du lot 4, puis les 2 de la Vallée (lot V1), puis les 3 du lot V2. */
export const ALBUM_PAGES = [
  { id: 'garden', name: 'Le potager', icon: 'album.page.garden', cases: GARDEN, reward: { ecus: 30, cosmeticId: 'scarecrow.flower' } },
  { id: 'homemade', name: 'Fait maison et basse-cour', icon: 'album.page.homemade', cases: HOMEMADE, reward: { ecus: 25, cosmeticId: 'jam.shelf' } },
  { id: 'animals', name: 'Les animaux', icon: 'album.page.animals', cases: ANIMALS, reward: { ecus: 25, cosmeticId: 'weathervane.pig' } },
  { id: 'sky', name: 'Le ciel', icon: 'album.page.sky', cases: SKY, reward: { ecus: 20, cosmeticId: 'sundial' } },
  { id: 'luck', name: 'Petits bonheurs', icon: 'album.page.luck', cases: LUCK, reward: { ecus: 30, cosmeticId: 'lantern.fairy' } },
  { id: 'village', name: 'Le village', icon: 'album.page.village', cases: VILLAGE, reward: { ecus: 25, cosmeticId: 'pump.village' } },
  { id: 'years', name: 'Les années à thème', icon: 'album.page.years', cases: YEARS, reward: { ecus: 30, cosmeticId: 'bunting.post' } },
  { id: 'fetes', name: 'Les fêtes', icon: 'album.page.fetes', cases: FETES_PAGE, reward: { ecus: 25, cosmeticId: 'arch.fete' } },
  { id: 'edge', name: 'La lisière en hiver', icon: 'album.page.edge', cases: EDGE, reward: { ecus: 20, cosmeticId: 'woodpile' } },
  { id: 'feeder', name: 'La mangeoire et la mare', icon: 'album.page.feeder', cases: FEEDER, reward: { ecus: 25, cosmeticId: 'heron.wood' } },
  { id: 'stories', name: 'Les veillées de Joseph', icon: 'album.page.stories', cases: STORY_CASES, reward: { ecus: 30, cosmeticId: 'rocking.chair' } },
  { id: 'heirlooms', name: 'Graines anciennes', icon: 'album.page.heirlooms', cases: HEIRLOOM_CASES, reward: { ecus: 30, cosmeticId: 'seed.cabinet' } },
  { id: 'wildlife', name: 'Les habitants de la ferme', icon: 'album.page.wildlife', cases: WILDLIFE_CASES, reward: { ecus: 30, cosmeticId: 'nestbox.painted' } },
  { id: 'swaps', name: 'Le troc du village', icon: 'album.page.swaps', cases: SWAP_CASES, reward: { ecus: 25, cosmeticId: 'swap.basket' } },
  { id: 'crosses', name: 'Les variétés de la ferme', icon: 'album.page.crosses', cases: CROSS_CASES, reward: { ecus: 40, cosmeticId: 'cross.sign' } },
  { id: 'wildlife2', name: 'Les habitants (suite)', icon: 'album.page.wildlife2', cases: WILDLIFE2_CASES, reward: { ecus: 20, cosmeticId: 'lizard.wall' } },
];

/**
 * Pages de « L'album complet » : les 11 pages du lot 4 (les pages de la Vallée ne retirent jamais une récompense déjà
 * prête : elles ont chacune la leur).
 */
export const ALBUM_COMPLETE_PAGES = ['garden', 'homemade', 'animals', 'sky', 'luck', 'village', 'years', 'fetes', 'edge', 'feeder', 'stories'];

export const ALBUM_PAGES_BY_ID = Object.fromEntries(ALBUM_PAGES.map((p) => [p.id, p]));

/** Toutes les cases : [{ ...case, pageId, caseId }] dans l'ordre des pages. */
export const ALBUM_CASES = ALBUM_PAGES.flatMap((p) => p.cases.map((c) => ({ ...c, pageId: p.id, caseId: `${p.id}.${c.id}` })));
export const ALBUM_CASES_BY_ID = Object.fromEntries(ALBUM_CASES.map((c) => [c.caseId, c]));

/**
 * Récompenses en plus (tampons) : page dorée du potager (★ sur les 15 cultures), page des géants (◆ sur les 14 cases
 * qui en ont), page des grandes années (🎪 et ✉ sur les 9 années). `cases` : cases concernées, `stamp` : tampon voulu
 * (years.stamps : les deux).
 */
export const ALBUM_EXTRA_REWARDS = [
  { id: 'garden.gold', pageId: 'garden', name: 'La page dorée du potager', stamps: ['gold'], ecus: 20, cosmeticId: 'can.golden' },
  { id: 'garden.giant', pageId: 'garden', name: 'La page des géants', stamps: ['giant'], ecus: 20, cosmeticId: 'barrow.giant' },
  { id: 'years.stamps', pageId: 'years', name: 'La page des grandes années', stamps: ['fete', 'visitor'], ecus: 15, cosmeticId: null },
];

/** Album complet (les 11 pages du lot 4, ALBUM_COMPLETE_PAGES). */
export const ALBUM_COMPLETE_REWARD = { id: 'complete', name: 'L\'album complet', ecus: 100, cosmeticId: 'herbarium' };

/** Message du rattrapage (§ 17.1.4). */
export const ALBUM_TEXTS = {
  retro: '{n} case{s} de l\'album retrouvée{s} dans vos anciennes parties',
  found: 'Album : {name} ✓',
  complete: 'Page complète !',
  notReady: 'Page pas encore complète.',
  already: 'Déjà reçu.',
  unknown: 'Récompense inconnue.',
};
