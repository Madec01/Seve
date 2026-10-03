// La Vallée vivante — lot V1 « La boîte en fer » (données pures, carrière seulement). Règles et contenus :
// docs/VALLEE.md (§ 2 à § 10) ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V1 ». Moteur :
// src/core/career/{valley,heirlooms,habitat}.js. Les chiffres font foi ici (réglés par tools/simulate-career.js
// --compare-valley, docs/VALLEE.md § 12).

/** Version de state.career.valley (V2 : 2, etc. ; rien n'est jamais retiré). */
export const VALLEY_VERSION = 1;

/** Parties (tests, simulation) : graines anciennes, habitants. */
export const VALLEY_PARTS = ['seeds', 'wildlife'];

/** La Vallée commence à la première aube où la ferme est à ce rang (ou plus). */
export const VALLEY_START = { rank: 2 };

/**
 * Graines anciennes : un bocal ouvert donne `jarSeeds` graines ; la boîte de Joseph `boxSeeds` par variété ; une récolte
 * à la main rend `handSeeds` graines (et + 1 vers la fixation) ; fixée après `fixHand` récoltes à la main ; graines d'une
 * variété fixée au prix de la culture × `fixedSeedFactor` ; pommier : `graftPerBasket` greffon par panier cueilli à la main.
 */
export const SEED_RULES = { jarSeeds: 3, boxSeeds: 3, handSeeds: 2, fixHand: 7, fixedSeedFactor: 1.25, graftPerBasket: 1 };

/** Les sept traits (pictogramme ET mot ; effets chiffrés lus par src/core/career/heirlooms.js). */
export const TRAITS = [
  { id: 'early', name: 'Précoce', icon: 'icon.trait.early', text: 'Pousse 15 % plus vite.', growth: 0.15 },
  { id: 'dry', name: 'Sobre', icon: 'icon.trait.dry', text: 'Un jour sans arrosage compte comme arrosé (canicule : aux trois quarts).', dry: 1, heat: 0.75 },
  { id: 'hardy', name: 'Rustique', icon: 'icon.trait.hardy', text: 'Passe le gel de l\'hiver ; pousse au ralenti en hiver, vendue au cours d\'hiver.', winterGrowth: 0.5 },
  { id: 'fine', name: 'Généreuse', icon: 'icon.trait.fine', text: 'Plus souvent belle (+ 4 points ; dorée + 1 point à la main).', fine: 0.04, gold: 0.01 },
  { id: 'tasty', name: 'Savoureuse', icon: 'icon.trait.tasty', text: '+ 10 % à la vente.', price: 0.1 },
  { id: 'bee', name: 'Mellifère', icon: 'icon.trait.bee', text: 'Un coin fleuri pour les bêtes ; à partir de 2 parcelles en pousse, chaque ruche rapporte 1 pièce de plus par jour.', minPlots: 2, perHive: 1 },
  { id: 'giant', name: 'Géante', icon: 'icon.trait.giant', text: 'Chance de légume géant doublée pour un carré de 2 × 2.', giant: 2 },
];
export const TRAITS_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/** Les douze variétés du pays (une par culture ; (†) : vraies variétés anciennes du domaine public). */
const variety = (id, cropId, name, trait, label, anecdote, tint) => ({ id, cropId, name, g: VARIETY_GENDER[cropId] || 'f', trait, label, anecdote, icon: `heirloom.${id}.icon`, ripe: `heirloom.${id}.4`, tint });
/** Genre du nom de chaque variété (premier nom : « Navet Boule d'or » est masculin, « Vitelotte » féminin) : accords. */
const VARIETY_GENDER = { carrot: 'f', turnip: 'm', wheat: 'm', cabbage: 'm', tomato: 'f', corn: 'm', sunflower: 'm', potato: 'f', strawberry: 'f', zucchini: 'f', pumpkin: 'f', apple: 'f' };
export const VARIETIES = [
  variety('jauneDuDoubs', 'carrot', 'Carotte jaune du Doubs', 'tasty', '…une du Doubs, 1952', 'Avant la carotte orange, on en cultivait des jaunes, des blanches et des violettes.', '#e8c64a'),
  variety('bouleDOr', 'turnip', 'Navet Boule d\'or', 'early', null, 'Sa chair jaune est plus douce que celle des navets blancs.', '#d9b54a'),
  variety('rougeDeBordeaux', 'wheat', 'Blé rouge de Bordeaux', 'dry', '…ge de Bord…', 'Ses racines vont chercher l\'eau très bas : il tient les étés secs.', '#b5652e'),
  variety('milanDePontoise', 'cabbage', 'Chou de Milan de Pontoise', 'fine', 'Milan… Pont…', 'Ses feuilles cloquées retiennent la rosée comme de petites cuillères.', '#4f7a3a'),
  variety('coeurDeBoeuf', 'tomato', 'Tomate Cœur de bœuf', 'fine', null, 'Une seule peut peser plus d\'une livre : une tranche suffit pour une tartine.', '#a3262a'),
  variety('grandRouxBasque', 'corn', 'Maïs grand roux basque', 'hardy', '…roux bas…', 'On le faisait sécher en tresses sous les toits, pour l\'hiver.', '#c86a2a'),
  variety('soleilDOr', 'sunflower', 'Tournesol Soleil d\'or', 'bee', 'Soleil d\'…', 'Une seule fleur nourrit des centaines d\'abeilles en une journée.', '#f2b81c'),
  variety('vitelotte', 'potato', 'Vitelotte', 'tasty', 'Vitel…', 'Violette dedans comme dehors : la purée en devient mauve.', '#6b3d7a'),
  variety('reineDesVallees', 'strawberry', 'Fraise Reine des Vallées', 'bee', 'Reine des V…', 'Une fraise des bois sans stolons : elle reste sagement là où on la plante.', '#d83a4a'),
  variety('rondeDeNice', 'zucchini', 'Courgette ronde de Nice', 'early', '…de de Ni…', 'Ronde comme une balle : on la farcit entière.', '#9cc46a'),
  variety('rougeVifDEtampes', 'pumpkin', 'Citrouille rouge vif d\'Étampes', 'giant', null, 'C\'est la citrouille des contes : aplatie, côtelée, rouge comme un carrosse.', '#d9452b'),
  variety('calvilleBlanc', 'apple', 'Pomme Calville blanc d\'hiver', 'tasty', null, 'Côtelée comme un fruit sculpté : on la servait à la table des rois.', '#d8d36a'),
];
export const VARIETIES_BY_ID = Object.fromEntries(VARIETIES.map((v) => [v.id, v]));
/** Variété du pays d'une culture (une par culture). */
export const VARIETY_OF_CROP = Object.fromEntries(VARIETIES.map((v) => [v.cropId, v.id]));

/** La boîte en fer de la mère de Joseph (rang 2) : trois variétés, la première haie offerte, trois lignes. */
export const JOSEPH_BOX = {
  varieties: ['bouleDOr', 'coeurDeBoeuf', 'rougeVifDEtampes'],
  seeds: 3,
  freeHedge: 'start.hedgeL',
  title: 'La boîte en fer',
  vignette: 'story.box',
  lines: [
    'La voilà, la boîte en fer de ma mère.',
    'Un navet, une tomate, une courge de son village : ça germe encore, tu verras.',
    'Le melon, lui, dort trop profond. Peut-être qu\'un jour…',
  ],
  hedgeLine: 'Une haie, c\'est la maison de tout le monde.',
};

/**
 * Aménagements nature (posés sur des emplacements prédéfinis, aucun entretien, jamais retirés) :
 *   price { base, step, max? } : base + step × (nombre déjà acheté), au plus max ; rank : rang qui le débloque ;
 *   needs : 'granary' (grenier construit) ; beauty : points de beauté des lanternes (6 au plus en tout).
 */
export const NATURE_ITEMS = [
  { id: 'hedge', name: 'Haie champêtre', icon: 'icon.nature.hedge', price: { base: 120, step: 40, max: 600 }, rank: 2, text: 'La maison de tout le monde : rouge-gorge, hérisson, lièvre…', beauty: 1 },
  { id: 'strip', name: 'Bande fleurie', icon: 'icon.nature.strip', price: { base: 80, step: 40 }, rank: 2, text: 'Coquelicots et bleuets : coccinelles, bourdons, papillons.', beauty: 1 },
  { id: 'nestbox', name: 'Nichoir', icon: 'icon.nature.nestbox', price: { base: 40, step: 20 }, rank: 2, text: 'Mésanges et hirondelles y nichent : la ferme en est plus belle.', beauty: 1 },
  { id: 'woodpile', name: 'Tas de bois et de pierres', icon: 'icon.nature.woodpile', price: { base: 30, step: 10 }, rank: 2, text: 'Bûches moussues et pierres sèches : rouge-gorge et hérisson s\'y cachent.', beauty: 1 },
  { id: 'insectHotel', name: 'Hôtel à insectes', icon: 'icon.nature.insectHotel', price: { base: 60, step: 30 }, rank: 2, text: 'Des tiges creuses et des pommes de pin : les coccinelles y passent l\'hiver.', beauty: 1 },
  { id: 'owlbox', name: 'Nichoir à chouette', icon: 'icon.nature.owlbox', price: { base: 150, step: 0 }, rank: 2, needs: 'granary', text: 'Sous le pignon du grenier : la chouette hulotte, contre les corbeaux.', beauty: 1 },
  { id: 'loneTree', name: 'Arbre isolé (un chêne)', icon: 'icon.nature.loneTree', price: { base: 250, step: 100 }, rank: 3, text: 'Jeune plant, jeune arbre, puis chêne adulte en deux saisons : le geai l\'attend.', beauty: 1 },
  { id: 'reeds', name: 'Berges plantées', icon: 'icon.nature.reeds', price: { base: 300, step: 0 }, rank: 3, text: 'Roseaux et iris au bord de la mare : les libellules arrivent.', beauty: 1 },
];
export const NATURE_ITEMS_BY_ID = Object.fromEntries(NATURE_ITEMS.map((n) => [n.id, n]));
export const NATURE_KINDS = NATURE_ITEMS.map((n) => n.id);

/** Arbre isolé : jeune arbre après 1 saison, chêne adulte après 2 (saisons absolues depuis la plantation). */
export const LONE_TREE = { youngSeasons: 1, adultSeasons: 2 };

const HEDGES = [{ slot: 'hedgeL', kind: 'hedge', side: 'côté gauche' }, { slot: 'hedgeR', kind: 'hedge', side: 'côté droit' }];
/**
 * Emplacements par type de terrain (identifiant `<lotId>.<slot>`) ; le cœur ne connaît que les identifiants, RENDER
 * leur position. `startOnly` : seulement sur le champ de départ ; `needs` : le grenier construit.
 */
export const NATURE_SPOTS = {
  home: [{ slot: 'nest', kind: 'nestbox', side: 'près de la maison' }, { slot: 'owl', kind: 'owlbox', side: 'sous le pignon du grenier', needs: 'granary' }],
  field: [...HEDGES, { slot: 'strip', kind: 'strip', side: 'en bas du champ' }, { slot: 'hotel', kind: 'insectHotel', side: 'au coin du champ', startOnly: true }],
  meadow: [...HEDGES, { slot: 'nest', kind: 'nestbox', side: 'sur un poteau' }, { slot: 'pile', kind: 'woodpile', side: 'au bord du pré' }, { slot: 'tree', kind: 'loneTree', side: 'au milieu' }],
  orchard: [...HEDGES, { slot: 'nest', kind: 'nestbox', side: 'dans un pommier' }, { slot: 'pile', kind: 'woodpile', side: 'au pied des arbres' }, { slot: 'hotel', kind: 'insectHotel', side: 'au bout des rangs' }],
  workshops: [...HEDGES, { slot: 'hotel', kind: 'insectHotel', side: 'contre le mur' }],
  wild: [...HEDGES, { slot: 'pile', kind: 'woodpile', side: 'dans les herbes' }, { slot: 'tree', kind: 'loneTree', side: 'au milieu' }],
  pond: [...HEDGES, { slot: 'reeds', kind: 'reeds', side: 'les berges' }],
  yard: [...HEDGES, { slot: 'nest', kind: 'nestbox', side: 'près du poulailler' }, { slot: 'pile', kind: 'woodpile', side: 'au fond de la cour' }],
  greenhouse: [...HEDGES],
};

/** Jachère fleurie : la culture suivante pousse + growth (étape 4 « sol vivant » : growthStage4). */
export const FALLOW = { growth: 0.1, growthStage4: 0.2 };

/**
 * Recettes d'habitat : genres comptés par src/core/career/habitat.js (habitatCounts) — aménagements posés (hedge,
 * strip, nestbox, woodpile, insectHotel, owlbox, loneTree, reeds) et : pond (la mare), orchard (un verger), wildGround
 * (friche ou jachère fleurie), bigShelter (étable, écurie, bergerie ou chèvrerie), treeAdult (chêne isolé ou pommier
 * adulte), oakAdult (chêne isolé adulte), flowers (bande fleurie, jachère, variété mellifère en pousse), cropsGrowing
 * (cultures différentes en place : champs, serre et verger ; une variété ancienne compte à part de sa culture).
 */
export const RECIPE_TEXTS = {
  hedge: ['haie', 'haies'],
  strip: ['bande fleurie', 'bandes fleuries'],
  nestbox: ['nichoir', 'nichoirs'],
  woodpile: ['tas de bois', 'tas de bois'],
  insectHotel: ['hôtel à insectes', 'hôtels à insectes'],
  owlbox: ['nichoir à chouette', 'nichoirs à chouette'],
  loneTree: ['chêne isolé', 'chênes isolés'],
  reeds: ['berges plantées', 'berges plantées'],
  pond: ['la mare', 'la mare'],
  orchard: ['verger', 'vergers'],
  wildGround: ['friche ou jachère fleurie', 'friches ou jachères fleuries'],
  bigShelter: ['étable, écurie, bergerie ou chèvrerie', 'grands abris'],
  treeAdult: ['arbre adulte (chêne isolé ou pommier)', 'arbres adultes'],
  oakAdult: ['chêne isolé adulte', 'chênes isolés adultes'],
  flowers: ['coin fleuri (bande, jachère, variété mellifère)', 'coins fleuris (bande, jachère, variété mellifère)'],
  cropsGrowing: ['culture différente en pousse', 'cultures différentes en pousse'],
};

/** Aménagement à poser pour avancer un genre de recette (bouton « Aménager » de l'indice). */
export const RECIPE_NATURE = { hedge: 'hedge', strip: 'strip', nestbox: 'nestbox', woodpile: 'woodpile', insectHotel: 'insectHotel', owlbox: 'owlbox', loneTree: 'loneTree', oakAdult: 'loneTree', treeAdult: 'loneTree', reeds: 'reeds', flowers: 'strip', wildGround: 'fallow' };

const ALL_YEAR = ['spring', 'summer', 'autumn', 'winter'];
const species = (id, name, seasons, recipe, spotKinds, service, hint, hintIcon, anecdote, extra = {}) => ({ id, name, ...SPECIES_FORMS[id], icon: `wild.${id}`, seasons, recipe, spotKinds, service, hint, hintIcon, anecdote, ...extra });
/** Accords des habitants : `the` (avec l'article), `g` (genre 'm' | 'f'), `pl` (nom au pluriel : « Les coccinelles »). */
const SPECIES_FORMS = {
  robin: { the: 'Le rouge-gorge', g: 'm', pl: false },
  hedgehog: { the: 'Le hérisson', g: 'm', pl: false },
  ladybird: { the: 'Les coccinelles', g: 'f', pl: true },
  bumblebee: { the: 'Les bourdons', g: 'm', pl: true },
  butterfly: { the: 'Le paon-du-jour', g: 'm', pl: false },
  swallow: { the: 'Les hirondelles', g: 'f', pl: true },
  tawnyOwl: { the: 'La chouette hulotte', g: 'f', pl: false },
  frog: { the: 'La grenouille rousse', g: 'f', pl: false },
  dragonfly: { the: 'Les libellules', g: 'f', pl: true },
  hare: { the: 'Le lièvre', g: 'm', pl: false },
  squirrel: { the: 'L\'écureuil roux', g: 'm', pl: false },
  jay: { the: 'Le geai des chênes', g: 'm', pl: false },
};

/**
 * Les douze habitants (ordre des tirages de l'aube : 1 nombre par espèce, dans cet ordre). service.kind :
 *   winterFinds (trouvailles d'hiver à la fois), handFine / fine (chance « belle » à la main / pour toutes les récoltes),
 *   growth (pousse, hors hiver), tourists, animals (production des abris, saisons), crows (poids des corbeaux),
 *   rainGrowth (pousse les jours de pluie ou d'orage), fish (valeur des poissons), giant (chance de géant),
 *   winterCoins (pièces des trouvailles d'hiver), jar (un bocal chaque automne).
 * spotKinds : où on la voit (genres d'emplacements, dans l'ordre de préférence) ; spotLot : terrain préféré.
 */
export const SPECIES = [
  species('robin', 'Rouge-gorge', ALL_YEAR, [{ kind: 'hedge', n: 1 }, { kind: 'woodpile', n: 1 }], ['woodpile', 'hedge'],
    { kind: 'winterFinds', value: 4, text: 'L\'hiver, 4 trouvailles à la lisière au lieu de 3.' },
    'Un petit chant clair, très tôt, près du tas de bois…', 'wild.hint.note', 'Il défend son coin de jardin toute l\'année, même en plein hiver.', { firstMet: 'Vous l\'avez déjà vu à la mangeoire.' }),
  species('hedgehog', 'Hérisson', ['spring', 'summer', 'autumn'], [{ kind: 'hedge', n: 2 }, { kind: 'woodpile', n: 1 }], ['hedge'],
    { kind: 'handFine', value: 0.01, text: 'Vos récoltes à la main sont plus souvent belles (+ 1 point).' },
    'Des feuilles remuées et de petites traces au pied de la haie…', 'wild.hint.tracks', 'Il parcourt jusqu\'à deux kilomètres chaque nuit, de jardin en jardin.', { firstMet: 'Vous l\'avez déjà croisé un matin, près des champs.' }),
  species('ladybird', 'Coccinelles', ['spring', 'summer'], [{ kind: 'strip', n: 1 }, { kind: 'insectHotel', n: 1 }], ['strip', 'insectHotel'],
    { kind: 'fine', value: 0.01, text: 'Toutes les récoltes, équipe comprise, sont plus souvent belles (+ 1 point).' },
    'De petits points rouges sur les fleurs de la bande…', 'wild.hint.note', 'Une coccinelle mange des dizaines de pucerons par jour.'),
  species('bumblebee', 'Bourdons', ['spring', 'summer', 'autumn'], [{ kind: 'flowers', n: 3 }], ['strip', 'hedge'],
    { kind: 'growth', value: 0.03, seasons: ['spring', 'summer', 'autumn'], text: 'Vos cultures poussent 3 % plus vite (hors hiver).' },
    'Un gros bourdonnement dans les fleurs…', 'wild.hint.note', 'Il sort même quand il fait frais : il se réchauffe en faisant vibrer ses ailes.'),
  species('butterfly', 'Paon-du-jour', ['summer'], [{ kind: 'strip', n: 2 }, { kind: 'wildGround', n: 1 }, { kind: 'cropsGrowing', n: 4 }], ['strip', 'hedge'],
    { kind: 'tourists', value: 0.15, text: 'Les touristes donnent 15 % de plus à chaque passage ; un point de beauté.' },
    'Des ailes orange, posées au soleil…', 'wild.hint.feather', 'Les quatre « yeux » de ses ailes effraient les oiseaux.'),
  species('swallow', 'Hirondelles', ['spring', 'summer'], [{ kind: 'bigShelter', n: 1 }, { kind: 'pond', n: 1 }, { kind: 'nestbox', n: 2 }], ['nestbox', 'hedge'],
    { kind: 'animals', value: 0.05, seasons: ['spring', 'summer'], text: 'Vos abris produisent 5 % de plus au printemps et en été.' },
    'Des cris aigus au-dessus de l\'étable…', 'wild.hint.note', 'Elles reviennent d\'Afrique chaque printemps, souvent dans le même nid.', { spotLot: 'bigShelter' }),
  species('tawnyOwl', 'Chouette hulotte', ALL_YEAR, [{ kind: 'owlbox', n: 1 }, { kind: 'treeAdult', n: 1 }], ['owlbox'],
    { kind: 'crows', value: 0.5, text: 'Les corbeaux viennent deux fois moins souvent.' },
    'Un hululement, le soir, du côté du grenier…', 'wild.hint.note', 'Elle tourne la tête aux trois quarts : ses yeux, eux, ne bougent pas.'),
  species('frog', 'Grenouille rousse', ['spring', 'summer'], [{ kind: 'pond', n: 1 }, { kind: 'hedge', n: 3 }], ['reeds', 'hedge'],
    { kind: 'rainGrowth', value: 0.1, text: 'Les jours de pluie, vos cultures poussent 10 % plus vite.' },
    'Des œufs en grappe dans l\'eau de la mare…', 'wild.hint.eggs', 'Elle passe l\'hiver au fond de la mare, sous la vase.', { spotLot: 'pond' }),
  species('dragonfly', 'Libellules', ['summer'], [{ kind: 'pond', n: 1 }, { kind: 'reeds', n: 1 }], ['reeds'],
    { kind: 'fish', value: 1.25, text: 'Les poissons pêchés valent 25 % de plus.' },
    'Un éclair bleu au-dessus des roseaux…', 'wild.hint.feather', 'Elle chasse en plein vol et rate rarement sa proie.', { spotLot: 'pond' }),
  species('hare', 'Lièvre', ALL_YEAR, [{ kind: 'wildGround', n: 1 }, { kind: 'hedge', n: 4 }], ['woodpile', 'loneTree', 'hedge'],
    { kind: 'giant', value: 0.015, text: 'Les légumes géants viennent un peu plus souvent (+ 1,5 point).' },
    'De longues traces dans l\'herbe haute…', 'wild.hint.tracks', 'Un lièvre court à plus de soixante kilomètres à l\'heure, en zigzag.', { spotLot: 'wild' }),
  species('squirrel', 'Écureuil roux', ['autumn', 'winter'], [{ kind: 'orchard', n: 1 }, { kind: 'hedge', n: 5 }], ['nestbox', 'woodpile', 'insectHotel', 'hedge'],
    { kind: 'winterCoins', value: 2, text: 'Les trouvailles d\'hiver rapportent deux fois plus.' },
    'Des noisettes rongées au pied des pommiers…', 'wild.hint.nuts', 'Il enterre des centaines de noisettes, en oublie beaucoup : des arbres poussent.', { spotLot: 'orchard' }),
  species('jay', 'Geai des chênes', ['autumn'], [{ kind: 'oakAdult', n: 1 }, { kind: 'hedge', n: 4 }], ['loneTree'],
    { kind: 'jar', value: 1, text: 'Chaque automne, il « oublie » un bocal de graines anciennes au pied du chêne.' },
    'Un cri rauque, et une plume bleue au pied du chêne…', 'wild.hint.feather', 'Un geai cache des milliers de glands chaque automne : il plante des forêts sans le savoir.'),
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

/**
 * Venue d'une bête : recette remplie et saison d'arrivée → chaque aube, `hintChance` qu'elle s'annonce (indice ; une seule
 * nouvelle venue par aube ; même nombre tiré qu'avant : celui de l'espèce) ; les aubes suivantes, `visibleChance` qu'elle
 * soit là (au plus tard `maxWait` aubes après l'indice, aube de l'indice comprise) ; elle ATTEND ensuite qu'on la touche,
 * sans limite de temps.
 */
export const ARRIVAL = { hintChance: 0.2, visibleChance: 0.5, maxWait: 3, onePerDawn: true };

/** Les étapes de la vallée (signes de vie = habitants installés + variétés fixées ; jamais en baisse). */
export const STAGES = [
  { n: 0, id: 'asleep', name: 'La vallée endormie', signs: 0, reward: { ecus: 0 }, chapter: { title: JOSEPH_BOX.title, lines: JOSEPH_BOX.lines } },
  {
    n: 1, id: 'firstSong', name: 'Le premier chant', signs: 2, reward: { ecus: 5 },
    chapter: { title: 'Ça chante', lines: ['Tu entends ? Ça chante, ce matin.', 'Des années qu\'on n\'entendait plus rien, par ici.', 'Ils reviennent toujours là où on leur laisse un coin.'] },
  },
  {
    n: 2, id: 'hedgesBloom', name: 'Les haies refleurissent', signs: 6, reward: { ecus: 10, boon: 'hedgeFinds' },
    chapter: { title: 'Les haies refleurissent', lines: ['Les haies refleurissent, regarde : de l\'aubépine, du sureau.', 'À la fin de l\'été, il y aura des mûres. Ma mère en faisait des confitures.', 'Laisse-en un peu aux oiseaux, hein.'] },
  },
  {
    n: 3, id: 'humming', name: 'Le bourdonnement', signs: 11, reward: { ecus: 15, boon: 'pollination' },
    chapter: { title: 'Le bourdonnement', lines: ['Ça bourdonne de partout.', 'Les abeilles, les bourdons, les papillons : ils font tout le travail, sans salaire.', 'Tes récoltes n\'ont jamais été aussi belles.'] },
  },
  {
    n: 4, id: 'awake', name: 'La vallée s\'éveille', signs: 17, reward: { ecus: 20, boon: 'livingSoil' },
    chapter: { title: 'Les traces dans la rosée', lines: ['Je suis passé par le chemin creux, ce matin.', 'Des traces partout dans la rosée : lièvre, hérisson, renard.', 'La vallée se réveille, petit. Pour de bon.'] },
  },
  {
    n: 5, id: 'sings', name: 'La vallée chante', signs: 24, reward: { ecus: 50, cosmeticId: 'valley.linden' },
    chapter: { title: 'La vallée chante', lines: ['Écoute.', 'Les oiseaux, les grenouilles, le vent dans les haies…', 'Je te l\'avais dit : il suffisait de lui laisser un peu de place.'] },
  },
];
export const MAX_STAGE = STAGES.length - 1;

/** Ce que rend chaque étape (une phrase, fiche « La Vallée »). */
export const BOON_TEXTS = {
  hedgeFinds: 'Cueillette des haies : mûres, sureau, prunelles, noisettes, l\'été et l\'automne.',
  pollination: 'Pollinisation : toutes les récoltes sont plus souvent belles (+ 1 point).',
  livingSoil: 'Sol vivant : après une jachère, la culture suivante pousse 20 % plus vite.',
};

/** Pollinisation (étape 3) : chance « belle » de toutes les récoltes. */
export const STAGE_FINE = 0.01;

/** Cueillette des haies (étape 2) : l'été et l'automne, `chance` à l'aube, `max` à la fois ; pièces × careerFactor(rang). */
export const HEDGE_FINDS = [
  { id: 'blackberry', name: 'Mûres', icon: 'hedgefind.blackberry', seasons: ['summer', 'autumn'], coins: 3, weight: 1 },
  { id: 'elderflower', name: 'Fleurs de sureau', icon: 'hedgefind.elderflower', seasons: ['summer'], coins: 2, weight: 1 },
  { id: 'sloe', name: 'Prunelles', icon: 'hedgefind.sloe', seasons: ['autumn'], coins: 3, weight: 1 },
  { id: 'hazelnut', name: 'Noisettes', icon: 'hedgefind.hazelnut', seasons: ['autumn'], coins: 4, weight: 1 },
];
export const HEDGE_FINDS_BY_ID = Object.fromEntries(HEDGE_FINDS.map((f) => [f.id, f]));
export const HEDGE_FIND_RULES = { chance: 0.5, max: 3, seasons: ['summer', 'autumn'], minStage: 2 };

/** Étal « La grainothèque du pays » de la foire aux graines (dernier jour d'hiver) : 3 graines, base + perRank × rang. */
export const FAIR_STALL = { name: 'La grainothèque du pays', base: 60, perRank: 30, seeds: 3 };

/** Conseils « première fois » (UI). */
export const VALLEY_HINTS = {
  'valley.box': 'Joseph vous a laissé la boîte en fer sur le perron : touchez-la pour ouvrir « La Vallée ».',
  'valley.jar': 'Un bocal de graines anciennes : ouvrez-le pour découvrir la variété, puis semez ses graines.',
  'valley.trial': 'Une planche d\'essai est mûre : récoltez-la à la main pour garder 2 graines et avancer vers la variété sauvée.',
  'valley.nature': 'Votre premier aménagement nature : les bêtes viennent quand leur recette d\'habitat est remplie.',
  'valley.species': 'Touchez-la pour qu\'elle s\'installe : son service commence aussitôt. Rien ne presse, elle attend.',
  'valley.fixed': 'Variété sauvée : ses graines sont illimitées, et l\'équipe peut la semer (sans jamais garder de graines).',
  'valley.fallow': 'Jachère fleurie : la parcelle fleurit jusqu\'à la fin de la saison, puis la culture suivante pousse plus vite.',
  'valley.stage': 'Une étape de la vallée ! Joseph a quelque chose à vous dire.',
};

/** Textes. */
export const VALLEY_TEXTS = {
  unknownVariety: 'À retrouver : un bocal au défrichage, chez Basile, à la foire aux graines…',
  boxVariety: 'Dans la boîte de Joseph.',
  graftVariety: 'Un greffon à la foire aux graines (il faut un verger).',
  saved: '{name} est {sauvée} !',
  jayGift: 'Le geai a oublié un bocal au pied du chêne.',
  noJar: 'Aucun bocal à ouvrir.',
  notStarted: 'La Vallée commence au rang 2.',
};

/**
 * Accord d'un participe ou d'un adjectif avec une variété ou un habitant (champs `g`, `pl`) :
 * agreeWith(navet, 'sauvé') → 'sauvé' ; agreeWith(tomate, 'sauvé') → 'sauvée' ; agreeWith(coccinelles, 'installé') → 'installées'.
 */
export function agreeWith(x, word) {
  return `${word}${x?.g === 'f' ? 'e' : ''}${x?.pl ? 's' : ''}`;
}

/** « Navet Boule d'or est sauvé ! », « Tomate Cœur de bœuf est sauvée ! » */
export function savedText(x) {
  return VALLEY_TEXTS.saved.replace('{name}', x.name).replace('{sauvée}', agreeWith(x, 'sauvé'));
}

/** Signes de vie du V1 (12 habitants + 12 variétés). */
export const SIGNS_V1 = SPECIES.length + VARIETIES.length;
