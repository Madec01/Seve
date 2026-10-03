// La Vallée vivante — lot V3 « Le ruisseau » (données pures, carrière seulement). Règles et contenus : docs/VALLEE.md
// § 17 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V3 ». Moteur : src/core/career/{places,valley,
// heirlooms,habitat}.js. Les chiffres font foi ici (réglés par tools/simulate-career.js --compare-valley3, docs/VALLEE.md
// § 17.12).
//
// Ce fichier n'importe RIEN (ni valley.js, ni heritage.js, ni crops.js : c'est valley.js et crops.js qui l'importent).
// Ordre des données = ordre des tirages : VALLEY_SPECIES est tiré à chaque aube (flux `valley3`, un nombre par espèce,
// dans cet ordre) ; les tables du V1 et du V2 ne changent jamais.

const ALL_YEAR = ['spring', 'summer', 'autumn', 'winter'];

/**
 * Les six lieux de la vallée (ordre fixe : celui des reprises à l'aube et de la liste des lieux). Une étape = chantier
 * (`cost`, payé d'un geste) + conditions de vie (`needs`, lues au lancement seulement) + reprise (`seasons` × durée des
 * saisons de la carrière). `boon` : ce que la ferme y gagne (lu par src/core/career/heirlooms.js ; tous modestes, sur des
 * leviers existants). `species` : habitants de la vallée que l'étape fait venir (recettes de VALLEY_SPECIES).
 *   need = { kind: 'nature', id: 'hedge' | 'strip' | 'woodpile' | 'loneTreeAdult', n } | { kind: 'fallowsTotal', n }
 *        | { kind: 'species', id } | { kind: 'place', id, step } | { kind: 'variety', id } | { kind: 'treesAdult', n }
 */
const place = (id, name, short, where, steps) => ({ id, name, short, where, icon: `icon.place.${id}`, vignette: `place.${id}.0`, steps: steps.map((s) => ({ ...s, vignette: `place.${id}.${s.n}` })) });

export const PLACES = [
  place('brook', 'Le Ru des Saules', 'Le ruisseau', 'au ruisseau', [
    { n: 0, name: 'À sec', line: 'Un lit de cailloux blancs. Petit, j\'y attrapais les truites à la main.' },
    {
      n: 1, name: 'Un filet d\'eau', cost: 3500, seasons: 2, needs: [{ kind: 'nature', id: 'hedge', n: 8 }],
      boon: { kind: 'heatGrowth', value: 0.25, text: 'Canicule : une parcelle non arrosée pousse ½ jour (au lieu de ¼).' },
      line: 'Les haies retiennent la pluie : l\'eau revient doucement au ruisseau.',
    },
    {
      n: 2, name: 'Le ruisseau chante', cost: 7000, seasons: 2, needs: [{ kind: 'fallowsTotal', n: 4 }],
      boon: { kind: 'riverFishing', value: 1, text: 'Pêche au ruisseau, une fois par jour (en plus de la mare).' }, species: ['kingfisher'],
      line: 'Écoute-le courir sur les cailloux. Ça faisait soixante ans.',
    },
    {
      n: 3, name: 'Les truites reviennent', cost: 13000, seasons: 3, needs: [{ kind: 'place', id: 'combe', step: 1 }, { kind: 'species', id: 'kingfisher' }],
      boon: { kind: 'riverTrout', value: 1, text: 'La pêche au ruisseau prend aussi truites et écrevisses.' }, species: ['crayfish'],
      line: 'L\'ombre des jeunes arbres garde l\'eau fraîche : les truites aiment ça.',
    },
    {
      n: 4, name: 'Le moulin tourne', cost: 22000, seasons: 3, needs: [{ kind: 'place', id: 'millpond', step: 2 }, { kind: 'species', id: 'crayfish' }],
      boon: { kind: 'millPlace', value: 1, text: 'Moulin à eau : le moulin de la ferme a une place de plus.' }, species: ['otter'], story: 'brook3',
      line: 'La vieille roue tourne de nouveau. Mon père y portait le blé.',
    },
  ]),
  place('combe', 'Le bois de la Combe', 'Le bois', 'dans le bois de la Combe', [
    { n: 0, name: 'La coupe rase', line: 'Des souches et des ronces. On a tout coupé, il y a longtemps.' },
    {
      n: 1, name: 'Jeunes plants', cost: 3000, seasons: 2, needs: [{ kind: 'species', id: 'jay' }],
      boon: { kind: 'heating', value: 0.5, text: 'Bois mort : chauffage de la serre − 50 %.' }, species: ['blackWoodpecker'],
      line: 'Les glands que ton geai a cachés ont levé. On les aide un peu.',
    },
    {
      n: 2, name: 'Le bois clair', cost: 6500, seasons: 3, needs: [{ kind: 'species', id: 'squirrel' }, { kind: 'species', id: 'blackWoodpecker' }],
      boon: { kind: 'mushrooms', value: 1, text: 'Champignons d\'automne à cueillir dans le bois.' }, species: ['roeDeer'],
      line: 'Le soleil passe entre les branches : les champignons vont sortir.',
    },
    {
      n: 3, name: 'La vieille futaie', cost: 12000, seasons: 4, needs: [{ kind: 'species', id: 'tawnyOwl' }, { kind: 'species', id: 'roeDeer' }],
      boon: { kind: 'winterFindsPlus', value: 1, text: 'Lisière d\'hiver : une trouvaille de plus à la fois.' }, species: ['salamander'], story: 'combe3',
      line: 'De grands arbres, enfin. Ici, on parle tout bas.',
    },
  ]),
  place('poppies', 'La prairie des Coquelicots', 'La prairie', 'dans la prairie', [
    { n: 0, name: 'La friche sèche', line: 'De l\'herbe jaune et des cailloux. Même les sauterelles s\'ennuient.' },
    {
      n: 1, name: 'La prairie', cost: 2000, seasons: 2, needs: [{ kind: 'nature', id: 'strip', n: 3 }],
      boon: { kind: 'hay', value: 0.9, text: 'Foin : entretien des animaux − 10 %.' }, species: ['skylark'],
      line: 'Les graines de tes bandes fleuries ont volé jusqu\'ici.',
    },
    {
      n: 2, name: 'La prairie fleurie', cost: 5000, seasons: 3, needs: [{ kind: 'species', id: 'bumblebee' }, { kind: 'species', id: 'butterfly' }, { kind: 'species', id: 'skylark' }],
      boon: { kind: 'meadowHives', value: 1, text: 'Chaque ruche rapporte 1 pièce de plus par jour (hors hiver).' }, species: ['hoopoe'],
      line: 'Des coquelicots à perte de vue, comme sur la boîte de ma mère.',
    },
    {
      n: 3, name: 'La prairie aux orchidées', cost: 10000, seasons: 4, needs: [{ kind: 'species', id: 'wildBee' }, { kind: 'species', id: 'hoopoe' }],
      boon: { kind: 'orchidSoil', value: 0.3, text: 'Sol vivant : après une jachère, la culture suivante pousse 30 % plus vite.' }, story: 'poppies3',
      line: 'Des orchidées sauvages ! Il faut des années sans charrue pour ça.',
    },
  ]),
  place('millpond', 'L\'étang du moulin', 'L\'étang', 'au bord de l\'étang', [
    { n: 0, name: 'La vase', line: 'Une cuvette de boue et de roseaux secs. Le moulin dort à côté.' },
    {
      n: 1, name: 'L\'étang', cost: 5500, seasons: 2, needs: [{ kind: 'place', id: 'brook', step: 2 }],
      boon: { kind: 'pondFish', value: 1.15, text: 'Poissons + 15 % (pêche de la mare et du ruisseau).' }, species: ['heron'],
      line: 'Le ruisseau a rempli la cuvette. Le héron est déjà là, regarde.',
    },
    {
      n: 2, name: 'Les nénuphars', cost: 11000, seasons: 3, needs: [{ kind: 'species', id: 'dragonfly' }, { kind: 'species', id: 'frog' }, { kind: 'species', id: 'heron' }],
      boon: { kind: 'pondTourists', value: 0.1, text: 'Touristes + 10 % (les promeneurs du dimanche).' },
      line: 'Des nénuphars blancs. Le dimanche, le village vient s\'y promener.',
    },
    {
      n: 3, name: 'La roselière', cost: 18000, seasons: 4, needs: [{ kind: 'species', id: 'bat' }],
      boon: { kind: 'reedSwallows', value: 0.05, text: 'Abris + 5 % au printemps et en été (les hirondelles chassent sur les roseaux).' }, story: 'millpond3',
      line: 'Les roseaux ont tout gagné : les hirondelles y chassent tout l\'été.',
    },
  ]),
  place('bocage', 'Le bocage du chemin creux', 'Le bocage', 'dans le chemin creux', [
    { n: 0, name: 'Les talus nus', line: 'Le chemin creux, sans une haie. Le vent emporte tout.' },
    {
      n: 1, name: 'Les haies replantées', cost: 2500, seasons: 2, needs: [{ kind: 'nature', id: 'hedge', n: 12 }],
      boon: { kind: 'hedgeCoins', value: 1.5, text: 'Cueillette des haies : pièces × 1,5.' },
      line: 'Tes haies ont fait des petits : on a replanté tout le chemin.',
    },
    {
      n: 2, name: 'Le bocage', cost: 5500, seasons: 3, needs: [{ kind: 'species', id: 'hedgehog' }, { kind: 'species', id: 'robin' }, { kind: 'species', id: 'blackbird' }],
      boon: { kind: 'crowsHalf', value: 0.5, text: 'Corbeaux encore deux fois plus rares.' }, species: ['littleOwl'],
      line: 'Des haies, des talus : la vallée a retrouvé ses chemins de traverse.',
    },
    {
      n: 3, name: 'Les vieux têtards', cost: 11000, seasons: 4, needs: [{ kind: 'species', id: 'littleOwl' }],
      boon: { kind: 'noCrows', value: 2, text: 'Plus aucun corbeau ; cueillette des haies × 2.' }, story: 'bocage3',
      line: 'Les vieux saules en têtard : la chevêche y dort, les corbeaux n\'osent plus.',
    },
  ]),
  place('oldOrchard', 'Le verger conservatoire', 'Le verger', 'au verger conservatoire', [
    { n: 0, name: 'Les pommiers abandonnés', line: 'Le vieux verger de la commune. Plus personne ne le taille.' },
    {
      n: 1, name: 'Taillés et greffés', cost: 3000, seasons: 2, needs: [{ kind: 'variety', id: 'calvilleBlanc' }],
      boon: { kind: 'graftReinette', value: 3, text: '3 greffons de Reinette grise du Canada : une variété ancienne de plus à sauver.' },
      line: 'On a taillé, greffé : voilà trois greffons de Reinette grise pour toi.',
    },
    {
      n: 2, name: 'En fleurs', cost: 6500, seasons: 3, needs: [{ kind: 'variety', id: 'apiEtoile' }],
      boon: { kind: 'cherry', value: 1, text: 'Cerisier Montmorency : jeunes plants à planter dans vos vergers.' },
      line: 'Tout le verger en fleurs. Et un vieux cerisier Montmorency, encore là !',
    },
    {
      n: 3, name: 'Le conservatoire', cost: 13000, seasons: 4, needs: [{ kind: 'treesAdult', n: 6 }],
      boon: { kind: 'pear', value: 1, text: 'Poirier Louise-Bonne : jeunes plants à planter dans vos vergers.' }, story: 'oldOrchard3',
      line: 'Chaque vieil arbre a son étiquette. Et voilà un poirier Louise-Bonne.',
    },
  ]),
];
export const PLACES_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const PLACE_IDS = PLACES.map((p) => p.id);
/** Dernière étape de chaque lieu (3 ; le ruisseau : 4). */
export const PLACE_MAX = Object.fromEntries(PLACES.map((p) => [p.id, p.steps.length - 1]));
/** 19 étapes à rendre. */
export const PLACE_STEPS_TOTAL = PLACES.reduce((s, p) => s + p.steps.length - 1, 0);
/** Total des chantiers (160 000 au départ). */
export const PLACES_COST_TOTAL = PLACES.reduce((s, p) => s + p.steps.reduce((a, st) => a + (st.cost || 0), 0), 0);
/** Étape de la vallée qui ouvre la vue (« La vallée chante »). */
export const PLACES_OPEN = { stage: 5 };

/** Accords et petits textes des habitants de la vallée. */
const VALLEY_FORMS = {
  kingfisher: { the: 'Le martin-pêcheur', g: 'm', pl: false, welcome: 'Bienvenue, petit martin-pêcheur !' },
  crayfish: { the: 'Les écrevisses', g: 'f', pl: true, welcome: 'Bienvenue, petites écrevisses !' },
  otter: { the: 'La loutre', g: 'f', pl: false, welcome: 'Bienvenue, petite loutre !' },
  heron: { the: 'Le héron cendré', g: 'm', pl: false, welcome: 'Bienvenue, beau héron !' },
  blackWoodpecker: { the: 'Le pic noir', g: 'm', pl: false, welcome: 'Bienvenue, petit pic !' },
  roeDeer: { the: 'Le chevreuil', g: 'm', pl: false, welcome: 'Bienvenue, petit chevreuil !' },
  salamander: { the: 'La salamandre tachetée', g: 'f', pl: false, welcome: 'Bienvenue, petite salamandre !' },
  skylark: { the: 'L\'alouette des champs', g: 'f', pl: false, welcome: 'Bienvenue, petite alouette !' },
  hoopoe: { the: 'La huppe fasciée', g: 'f', pl: false, welcome: 'Bienvenue, belle huppe !' },
  littleOwl: { the: 'La chouette chevêche', g: 'f', pl: false, welcome: 'Bienvenue, petite chevêche !' },
};
const valleySpecies = (id, name, seasons, recipe, placeId, seenAt, hint, hintIcon, anecdote, opens) => ({
  id, name, ...VALLEY_FORMS[id], icon: `wild.${id}`, seasons, recipe, placeId, seenAt, spotKinds: [], hint, hintIcon, anecdote, opens,
  // Les habitants de la vallée ne rendent aucun service de plus (leurs lieux ont déjà leur avantage) : la fenêtre
  // d'observation montre ce qu'ils ouvrent (`opens`) à la place du service.
  service: { kind: 'opens', value: 0, text: opens },
  group: 'valley',
});

/**
 * Les dix habitants de la vallée (même automate qu'aux V1 et V2 : indice, venue, il faut les toucher — dans la vue).
 * Recettes : étapes de lieux (+ genres du V1 pour la huppe et la chevêche). Ordre des tirages du flux `valley3`.
 */
export const VALLEY_SPECIES = [
  valleySpecies('kingfisher', 'Martin-pêcheur', ALL_YEAR, [{ kind: 'place', id: 'brook', step: 2 }], 'brook', 'sur une branche au-dessus du ruisseau',
    'Un éclair bleu et un petit cri aigu, au ras de l\'eau…', 'wild.hint.feather', 'Il plonge comme une flèche et ressort avec un poisson en travers du bec.',
    'Le ruisseau peut maintenant passer à « Les truites reviennent ».'),
  valleySpecies('crayfish', 'Écrevisses à pattes blanches', ['spring', 'summer', 'autumn'], [{ kind: 'place', id: 'brook', step: 3 }], 'brook', 'sous les cailloux, près du pont',
    'De petites pinces sous les cailloux du ruisseau…', 'wild.hint.pincer', 'Elles ne vivent que dans l\'eau très pure : leur retour est une fête.',
    'Le ruisseau peut maintenant passer à « Le moulin tourne ».'),
  valleySpecies('otter', 'Loutre', ALL_YEAR, [{ kind: 'place', id: 'brook', step: 4 }, { kind: 'place', id: 'millpond', step: 2 }], 'millpond', 'sur la berge, près du moulin',
    'Des traces palmées dans la vase, et une glissade sur la berge…', 'wild.hint.webbed', 'Elle glisse sur les berges encore et encore, juste pour le plaisir.',
    'Elle a sa page dans le carnet d\'Hélène.'),
  valleySpecies('heron', 'Héron cendré', ALL_YEAR, [{ kind: 'place', id: 'millpond', step: 1 }], 'millpond', 'debout dans l\'eau de l\'étang',
    'Une grande silhouette grise, immobile au bord de l\'eau…', 'wild.hint.feather', 'Il peut attendre une heure sur une patte avant de pêcher.',
    'L\'étang peut maintenant passer à « Les nénuphars ».'),
  valleySpecies('blackWoodpecker', 'Pic noir', ALL_YEAR, [{ kind: 'place', id: 'combe', step: 1 }], 'combe', 'sur un tronc du bois',
    'Un tambour sec, tout là-haut, dans le bois…', 'wild.hint.drum', 'Il tambourine jusqu\'à vingt coups par seconde : c\'est sa façon de chanter.',
    'Le bois peut maintenant passer à « Le bois clair ».'),
  valleySpecies('roeDeer', 'Chevreuil', ALL_YEAR, [{ kind: 'place', id: 'combe', step: 2 }], 'combe', 'à la lisière du bois',
    'Des traces fines, en cœur, dans la boue du sentier…', 'wild.hint.hoof', 'Quand il a peur, il aboie : on dirait un petit chien dans le bois.',
    'Le bois peut maintenant passer à « La vieille futaie ».'),
  valleySpecies('salamander', 'Salamandre tachetée', ['spring', 'autumn'], [{ kind: 'place', id: 'combe', step: 3 }], 'combe', 'sous les feuilles, au pied d\'un vieil arbre',
    'Une tache jaune et noire sous les feuilles mouillées…', 'wild.hint.tail', 'Elle sort les soirs de pluie et peut vivre plus de vingt ans.',
    'Elle a sa page dans le carnet d\'Hélène.'),
  valleySpecies('skylark', 'Alouette des champs', ['spring', 'summer'], [{ kind: 'place', id: 'poppies', step: 1 }], 'poppies', 'au-dessus de la prairie',
    'Un chant qui monte, monte, tout là-haut dans le ciel…', 'wild.hint.note', 'Elle chante en s\'élevant, si haut qu\'on ne la voit plus.',
    'La prairie peut maintenant passer à « La prairie fleurie ».'),
  valleySpecies('hoopoe', 'Huppe fasciée', ['summer'], [{ kind: 'place', id: 'poppies', step: 2 }, { kind: 'woodpile', n: 2 }], 'poppies', 'sur un piquet de la prairie',
    'Un « oup-oup-oup » tout doux, du côté de la prairie…', 'wild.hint.note', 'Elle dresse sa huppe en éventail quand on la surprend.',
    'La prairie peut maintenant passer à « La prairie aux orchidées ».'),
  valleySpecies('littleOwl', 'Chouette chevêche', ALL_YEAR, [{ kind: 'place', id: 'bocage', step: 2 }, { kind: 'oakAdult', n: 1 }], 'bocage', 'dans un vieux saule têtard',
    'Deux yeux jaunes dans un vieux saule, au crépuscule…', 'wild.hint.moon', 'Toute petite, elle hoche la tête quand elle vous regarde.',
    'Le bocage peut maintenant passer à « Les vieux têtards ».'),
];
export const VALLEY_SPECIES_BY_ID = Object.fromEntries(VALLEY_SPECIES.map((s) => [s.id, s]));

/** Pêche au ruisseau (Ru des Saules ≥ 2) : poids à l'étape 2 (`weight`) puis à l'étape 3 et plus (`weight3`). */
export const RIVER_FISH = [
  { id: 'minnow', name: 'Vairon', icon: 'fish.minnow', min: 4, max: 8, weight: 40, weight3: 30 },
  { id: 'gudgeon', name: 'Goujon', icon: 'fish.gudgeon', min: 5, max: 10, weight: 35, weight3: 25 },
  { id: 'chub', name: 'Chevesne', icon: 'fish.chub', min: 10, max: 18, weight: 25, weight3: 20 },
  { id: 'browntrout', name: 'Truite fario', icon: 'fish.browntrout', min: 20, max: 32, weight: 0, weight3: 15 },
  { id: 'crayfish', name: 'Écrevisse', icon: 'fish.crayfish', min: 18, max: 28, weight: 0, weight3: 10 },
];
export const RIVER_FISH_BY_ID = Object.fromEntries(RIVER_FISH.map((f) => [f.id, f]));
/** Une pêche au ruisseau par jour ; facteurs : libellules, étang du moulin, canne de Firmin (comme la mare). */
export const RIVER_RULES = { perDay: 1, minStep: 2, troutStep: 3 };

/** Champignons d'automne (bois de la Combe ≥ 2) : pièces × careerFactor(rang), comme la cueillette des haies. */
export const MUSHROOMS = [
  { id: 'cep', name: 'Cèpe', icon: 'find.cep', coins: 6, weight: 1 },
  { id: 'chanterelle', name: 'Girolle', icon: 'find.chanterelle', coins: 4, weight: 1 },
  { id: 'hedgehogMushroom', name: 'Pied-de-mouton', icon: 'find.hedgehogMushroom', coins: 3, weight: 1 },
];
export const MUSHROOMS_BY_ID = Object.fromEntries(MUSHROOMS.map((m) => [m.id, m]));
/** 3 nombres `valley3` à chaque aube d'automne dès l'étape 2 du bois (chance, sorte, emplacement), qu'il y ait de la place ou non. */
export const MUSHROOM_RULES = { chance: 0.5, max: 3, season: 'autumn', minStep: 2, spots: 5 };

/** La Reinette grise du Canada (†) : une variété ancienne de plus (greffons du verger conservatoire, étape 1). */
export const ORCHARD_VARIETIES = [
  {
    id: 'reinetteGrise', cropId: 'apple', name: 'Pomme Reinette grise du Canada', g: 'f', trait: 'fine', traits: ['fine'], label: 'Du verger de la commune',
    anecdote: 'Rugueuse et grise comme une vieille pierre : sa chair acidulée fait les meilleures tartes.', icon: 'heirloom.reinetteGrise.icon',
    ripe: 'heirloom.reinetteGrise.fruit', tint: '#a08a5a', group: 'orchard', graft: true,
  },
];
export const ORCHARD_VARIETIES_BY_ID = Object.fromEntries(ORCHARD_VARIETIES.map((x) => [x.id, x]));

/**
 * Le cerisier et le poirier du verger conservatoire : arbres fruitiers HORS de CROPS (le marché, les trouvailles et
 * l'« Herbier complet » parcourent CROPS : y ajouter un arbre changerait leurs tirages). Mêmes règles que le pommier
 * (src/core/trees.js) ; cours fixe ; jamais demandés par le tableau, la charrette, Joseph ni le comice.
 */
export const VALLEY_TREES = [
  {
    id: 'cherry', name: 'Cerisier Montmorency', kind: 'tree', seasons: ['spring', 'summer', 'autumn'], growDays: 6, fruitDays: 3, fruitSeasons: ['spring', 'summer'],
    seedCost: 60, sellPrice: 27, frostHardy: true, needsWater: false, valleyTree: true, unlockedBy: { place: 'oldOrchard', step: 2 },
    anecdote: 'Ses cerises acides font les meilleures clafoutis : on les cueillait pour la fête du village.',
  },
  {
    id: 'pear', name: 'Poirier Louise-Bonne', kind: 'tree', seasons: ['spring', 'summer', 'autumn'], growDays: 7, fruitDays: 4, fruitSeasons: ['summer', 'autumn'],
    seedCost: 60, sellPrice: 36, frostHardy: true, needsWater: false, valleyTree: true, unlockedBy: { place: 'oldOrchard', step: 3 },
    anecdote: 'Une poire fondante, née dans un jardin normand il y a deux siècles.',
  },
];
export const VALLEY_TREES_BY_ID = Object.fromEntries(VALLEY_TREES.map((t) => [t.id, t]));

/** Les trois sortes de terres sauvages (choisie une fois pour toutes ; aucune production, aucune charge). */
export const WILD_KINDS = [
  { id: 'wood', name: 'Le bois', icon: 'icon.wildland.wood', text: 'Laissez faire : en dix ans, un bois se plante tout seul.', stages: ['Terre retournée', 'Noisetiers et bouleaux', 'Un bois clair'], grown: 'un bois', visitors: ['roeDeer', 'jay', 'squirrel'], mm: '#2e5a2a' },
  { id: 'marsh', name: 'Le marais', icon: 'icon.wildland.marsh', text: 'De l\'eau qui dort, des joncs : la maison des grenouilles.', stages: ['Flaques et joncs', 'Mares et iris jaunes', 'Une roselière'], grown: 'un marais', visitors: ['heron', 'frog', 'dragonfly'], mm: '#3f6f6a' },
  { id: 'grassland', name: 'La prairie sauvage', icon: 'icon.wildland.grassland', text: 'De l\'herbe haute qu\'on ne fauche plus : les papillons s\'y perdent.', stages: ['Herbe rase', 'Herbe haute et marguerites', 'Une prairie fleurie'], grown: 'une prairie sauvage', visitors: ['hare', 'skylark', 'butterfly'], mm: '#a3b64f' },
];
export const WILD_KINDS_BY_ID = Object.fromEntries(WILD_KINDS.map((k) => [k.id, k]));
/** Prix : base + step × (terres déjà confiées) ; jeune après 1 saison, reprise après 3 ; il faut les 16 terrains. */
export const WILD_RULES = { price: { base: 2500, step: 300 }, youngSeasons: 1, grownSeasons: 3, needLots: 16, total: 18 };
/** Visiteurs qui ne sont pas des habitants (décor). */
export const WILD_VISITOR_NAMES = { roeDeer: 'Chevreuil', jay: 'Geai', squirrel: 'Écureuil', heron: 'Héron', frog: 'Grenouilles', dragonfly: 'Libellules', hare: 'Lièvre', skylark: 'Alouette', butterfly: 'Papillons' };

/** « L'eau revient » (étape 6) : un jour sans arrosage, les cultures poussent + 0,1 jour. */
export const WATER_BACK = { dryGrowth: 0.1 };

/** Étapes 6 et 7 de la vallée (au-dessus du palier 38 de l'étape 5 ; conditions de lieux en plus des signes de vie). */
export const STAGES_V3 = [
  {
    n: 6, id: 'waterBack', name: 'L\'eau revient', signs: 56, needs: { place: 'brook', step: 2 }, reward: { ecus: 60, boon: 'waterBack' },
    chapter: { title: 'L\'eau revient', lines: ['Tu l\'entends ? Le ruisseau.', 'Soixante ans que le Ru des Saules était à sec.', 'Ma mère disait : quand l\'eau revient, tout revient.'] },
  },
  {
    n: 7, id: 'livingValley', name: 'La vallée vivante', signs: 76, needs: { allPlacesStep: 2 }, reward: { ecus: 80, cosmeticId: 'valley.bench' },
    chapter: { title: 'La vallée vivante', lines: ['Monte avec moi sur la colline, une dernière fois.', 'Le bois, la prairie, l\'étang, les haies… tout respire.', 'Tu as rendu sa vallée à ma mère, petit. Merci.'] },
  },
];
/** Ce que rend l'étape 6 (fiche « La Vallée »). */
export const BOON_TEXTS_V3 = { waterBack: 'L\'eau revient : un jour sans arrosage, les cultures poussent un peu plus (+ 0,1 jour).' };

/** Les récits de Joseph du V3 (relisibles ; ce ne sont pas des étapes). when : 'open' | 'firstValleySpecies' | { place, step }. */
export const STORIES_V3 = [
  { id: 'hill', title: 'Sur la colline', vignette: 'story.hill', when: 'open', lines: ['Viens, monte avec moi sur la colline.', 'D\'ici, on voit toute la vallée : le ruisseau à sec, le bois coupé, l\'étang plein de vase.', 'Ta ferme est là, au milieu. Et si on rendait la vallée à la vie ?'] },
  { id: 'helene', title: 'Hélène, la naturaliste', vignette: 'story.helene', when: 'firstValleySpecies', lines: ['Je te présente Hélène : elle compte les oiseaux depuis quarante ans.', 'Elle dit qu\'un martin-pêcheur ici, c\'est un petit miracle.', 'Elle tient le carnet de la vallée : elle y notera chaque bête qui revient.'] },
  { id: 'brook3', title: 'Le moulin de mon père', vignette: 'story.brook', when: { place: 'brook', step: 4 }, lines: ['La roue tourne, l\'eau chante, la farine vole.', 'Mon père m\'asseyait sur le sac de blé pour la pesée.', 'Je n\'aurais jamais cru entendre ce bruit-là une seconde fois.'] },
  { id: 'combe3', title: 'La vieille futaie', vignette: 'story.combe', when: { place: 'combe', step: 3 }, lines: ['Ce matin, un chevreuil m\'a regardé passer, sans bouger.', 'Ma mère venait ici cueillir les champignons, à l\'automne.', 'Je crois qu\'elle en aurait pleuré, tu sais.'] },
  { id: 'poppies3', title: 'Les orchidées', vignette: 'story.poppies', when: { place: 'poppies', step: 3 }, lines: ['Hélène a compté onze sortes d\'orchidées dans la prairie.', 'Onze ! Il n\'y en avait plus une seule.', 'Laisse-la tranquille, cette prairie. Elle sait ce qu\'elle fait.'] },
  { id: 'millpond3', title: 'Le dimanche à l\'étang', vignette: 'story.millpond', when: { place: 'millpond', step: 3 }, lines: ['Tout le village vient se promener autour de l\'étang, le dimanche.', 'Les enfants comptent les grenouilles, les vieux comptent les nénuphars.', 'Moi, je compte les hirondelles. Il y en a de plus en plus.'] },
  { id: 'bocage3', title: 'Le chemin creux', vignette: 'story.bocage', when: { place: 'bocage', step: 3 }, lines: ['J\'ai pris le chemin creux pour venir, ce matin.', 'Des haies de chaque côté, et une chevêche qui m\'a fait la révérence.', 'Le chemin de mon enfance, petit. Tu me l\'as rendu.'] },
  { id: 'oldOrchard3', title: 'Le conservatoire', vignette: 'story.oldOrchard', when: { place: 'oldOrchard', step: 3 }, lines: ['Chaque arbre a son étiquette, maintenant : Calville, Api, Reinette…', 'L\'école vient y faire la leçon de choses.', 'Une graine qu\'on donne vit. Un arbre qu\'on greffe aussi.'] },
];
export const STORIES_V3_BY_ID = Object.fromEntries(STORIES_V3.map((s) => [s.id, s]));

/** Conseils « première fois » (UI). */
export const PLACES_HINTS = {
  'valley.view': 'Touchez un lieu pour voir ce qui lui manque.',
  'valley.works': 'Le lieu reprend tout seul, saison après saison : revenez le voir.',
  'valley.valleyAnimal': 'Une bête de la vallée vous attend : touchez-la pour qu\'elle entre dans le carnet d\'Hélène.',
  'valley.river': 'Une pêche par jour au ruisseau, en plus de celle de la mare.',
  'valley.wild': 'Une forêt rendue à la nature ne produit rien : elle accueille.',
};

/** Textes. */
export const PLACES_TEXTS = {
  notOpen: 'La vallée s\'ouvrira quand elle chantera (étape 5).',
  disabled: 'Vue de la vallée désactivée.',
  unknownPlace: 'Lieu inconnu.',
  restored: 'Ce lieu est déjà restauré.',
  worksRunning: 'Un chantier est déjà en cours ici : encore {days}.',
  missing: 'Il manque : {list}.',
  riverDry: 'Le ruisseau est encore à sec.',
  riverDone: 'Vous avez déjà pêché au ruisseau aujourd\'hui : revenez demain !',
  noMushroom: 'Rien à cueillir ici.',
  wildNeedLots: 'Les terres sauvages viennent après le 16ᵉ terrain.',
  wildUnknown: 'Case inconnue.',
  wildNotForest: 'Cette case n\'est pas une forêt libre.',
  wildNotTouching: 'Il faut une forêt qui touche la ferme.',
  wildKindUnknown: 'Sorte inconnue.',
  wildConfirm: '{name} deviendra {grown}, pour toujours.',
  wildBefore: 'Après le 16ᵉ terrain, les forêts autour de la ferme pourront revenir à la nature.',
  needPond: 'Il faut une mare : aménagez un terrain en mare.',
  needOrchard: 'Il faut un verger : aménagez un terrain en verger.',
  needGranary: 'Il faut le grenier pour le nichoir à chouette.',
  needOak: 'Il faut un chêne isolé adulte (aménagement sur un pré ou une friche).',
  treeLocked: { cherry: 'Le cerisier vient du verger conservatoire.', pear: 'Le poirier vient du verger conservatoire.' },
  treeSeal: 'du verger conservatoire',
  orchardLabel: 'du verger de la commune',
};
