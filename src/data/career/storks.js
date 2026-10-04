// La Vallée vivante — lot V4 « Les cigognes » : données (pures, n'importe rien). Règles et textes : docs/VALLEE.md § 18 ;
// contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V4 » (écarts : « Écarts et précisions (livraison CORE
// V4) »). Lu par src/core/career/storks.js (lectures pures) et src/core/career/valley.js (extension `valley`).
//
// Le V4 est DÉCORATIF : rien ici ne touche l'économie (aucun prix, aucun revenu, aucun service). Un seul flux nouveau,
// `valley4` : 5 nombres par aube (un par visiteur tiré, ordre de VISITORS filtré `drawn`) une fois la vue de la vallée
// ouverte. Tout le reste (légendes, cigognes, cigogneaux, cartes, phrases) est déterministe.
//
// L'ORDRE DES TABLES EST L'ORDRE DES TIRAGES ET DES RÉVEILS : ne jamais réordonner LEGENDS ni VISITORS.

/** Les quatre légendes (page d'album « Les légendes »), dans l'ordre des réveils (une au plus par aube). */
export const LEGENDS = [
  {
    id: 'motherMelon', cropId: 'melon', name: 'Le melon de la boîte', sub: 'Melon Petit Gris de Rennes', g: 'm', the: 'Le melon de la boîte',
    icon: 'legend.motherMelon.icon', growDays: 6, wake: { kind: 'stage', n: 6 }, story: 'melon',
    anecdote: 'Petit, gris et brodé dehors, orange dedans : on le disait trop sucré pour être vrai.',
    firstHarvest: 'Vous portez une tranche du premier melon à Joseph. Il ferme les yeux.',
    label: 'De la boîte en fer', wakeText: 'Il dort au fond de la boîte en fer : « quand l\'eau revient, tout revient » (étape 6).',
    short: 'melon de la boîte',
  },
  {
    id: 'millEinkorn', cropId: 'wheat', name: 'L\'engrain du moulin', sub: 'Petit épeautre', g: 'm', the: 'L\'engrain du moulin',
    icon: 'legend.millEinkorn.icon', growDays: 4, wake: { kind: 'place', id: 'brook', step: 4 }, story: 'mill',
    anecdote: 'Le plus vieux blé cultivé : ses épis fins nourrissaient déjà les premiers paysans.',
    firstHarvest: 'Une poignée de farine d\'engrain : Paulo promet d\'en faire une miche pour Joseph.',
    label: 'Du coffre du moulin', wakeText: 'Quelque part dans le vieux moulin, quand sa roue tournera de nouveau (Ru des Saules, étape 4).',
    short: 'engrain du moulin',
  },
  {
    id: 'farmMarvel', cropId: 'tomato', name: 'La Merveille', sub: 'Née chez vous', nameFarm: true, g: 'f', the: 'La Merveille',
    icon: 'legend.farmMarvel.icon', growDays: 5, wake: { kind: 'generations' }, story: 'marvel',
    anecdote: 'Rayée d\'or et de pourpre : trois étés de sélection à la main l\'ont rendue unique au monde.',
    firstHarvest: 'Vous coupez la Merveille en deux : elle sent l\'été tout entier.',
    label: 'Née à la ferme', wakeText: 'Gardez les graines d\'une belle tomate de la ferme, une fois par été (3 générations).',
    short: 'Merveille',
  },
  {
    id: 'storkPea', cropId: 'pea', name: 'Les pois du jour des cigognes', sub: 'Pois Corne de bélier', g: 'm', pl: true, the: 'Les pois du jour des cigognes',
    icon: 'legend.storkPea.icon', growDays: 3, wake: { kind: 'stage', n: 8 }, story: 'peas',
    anecdote: 'Un pois à rames aux gousses courbes : la grand-mère de Joseph le semait au retour des cigognes.',
    firstHarvest: 'Les premiers pois du jour des cigognes, croqués crus, au jardin.',
    label: 'De la grand-mère de Joseph', wakeText: 'Quand les cigognes reviendront sur le clocher…',
    short: 'pois du jour des cigognes',
  },
];
export const LEGENDS_BY_ID = Object.fromEntries(LEGENDS.map((x) => [x.id, x]));
export const LEGEND_IDS = LEGENDS.map((x) => x.id);

/**
 * Cloches et Merveille : 4 cloches devant la Grainothèque (niveau ≥ needLibrary) ; Merveille : une génération par été
 * (récolte à la main, belle ou dorée, de la Tomate croisée sauvée ; toute qualité si les surprises sont coupées) ; une
 * légende au plus se réveille par aube.
 */
export const LEGEND_RULES = {
  cloches: 4, needLibrary: 1,
  marvel: { crossId: 'crossTomato', gens: 3, season: 'summer', qualities: ['fine', 'gold'] },
  onePerDawn: true,
};

/**
 * Les six visiteurs rares (page d'album « Les visiteurs rares »). `drawn` : venue tirée (flux valley4, ordre ci-dessous) ;
 * les cigognes viennent d'elles-mêmes (jour des cigognes, STORK_RULES). need = { kind: 'stage', n } | { kind: 'place', id,
 * step, sinceSeasons? } | { kind: 'nature', id: 'hedge', n }.
 */
export const VISITORS = [
  {
    id: 'whiteStork', name: 'Cigognes blanches', the: 'Les cigognes', g: 'f', pl: true, icon: 'visitor.whiteStork', seasons: ['spring', 'summer'], drawn: false,
    recipe: [{ kind: 'stage', n: 7 }, { kind: 'place', id: 'millpond', step: 2 }, { kind: 'place', id: 'poppies', step: 2 }],
    where: 'view', spot: 'steeple', whereText: 'sur le clocher du village',
    hint: null, hintIcon: null, welcome: 'Deux grands oiseaux blancs tournent au-dessus du clocher !',
    anecdote: 'Elles ne chantent pas : elles claquent du bec, tête renversée, pour se saluer.',
    title: 'Les cigognes sont revenues !', halt: 'Les cigognes sur le clocher',
    decor: { view: 'steeple', farm: 'nest' }, calendar: 'Printemps, {dayShort} : les cigognes',
  },
  {
    id: 'crane', name: 'Grues cendrées', the: 'Les grues', g: 'f', pl: true, icon: 'visitor.crane', seasons: ['autumn'], drawn: true,
    recipe: [{ kind: 'place', id: 'poppies', step: 3 }, { kind: 'place', id: 'millpond', step: 3 }],
    where: 'view', placeId: 'poppies', whereText: 'dans la prairie',
    hint: 'Des cris de trompette, très haut, dans le ciel d\'automne…', hintIcon: 'visitor.hint.trumpet', welcome: 'Les grues font halte dans la prairie !',
    anecdote: 'Les grues voyagent en famille et se parlent en vol, avec des cris de trompette.',
    title: 'Les grues font halte dans la prairie !', halt: 'Des grues font halte dans la prairie', still: 'Les grues se reposent encore dans la prairie.',
    decor: { view: 'crane', farm: 'flyover' }, calendar: 'Automne : les grues',
  },
  {
    id: 'redDeer', name: 'Cerf élaphe', the: 'Le cerf', g: 'm', icon: 'visitor.redDeer', seasons: ['autumn'], drawn: true,
    recipe: [{ kind: 'place', id: 'combe', step: 3, sinceSeasons: 4 }],
    where: 'view', placeId: 'combe', whereText: 'à la lisière du bois',
    hint: 'Un grand bramement, au crépuscule, du côté de la vieille futaie…', hintIcon: 'visitor.hint.antler', welcome: 'Un cerf à la lisière du bois !',
    anecdote: 'Chaque printemps, le cerf perd ses bois ; ils repoussent plus grands.',
    title: 'Un cerf à la lisière du bois !', halt: 'Un cerf à la lisière du bois', still: 'Le cerf attend encore à la lisière du bois.',
    decor: { view: 'redDeer', farm: 'deer' }, calendar: 'Automne, au crépuscule : le brame du cerf',
  },
  {
    id: 'oriole', name: 'Loriot d\'Europe', the: 'Le loriot', g: 'm', icon: 'visitor.oriole', seasons: ['summer'], drawn: true,
    recipe: [{ kind: 'place', id: 'oldOrchard', step: 3, sinceSeasons: 4 }],
    where: 'view', placeId: 'oldOrchard', whereText: 'dans le verger',
    hint: 'Un sifflement flûté, « dudeli-o », tout en haut des vieux pommiers…', hintIcon: 'visitor.hint.flute', welcome: 'Le loriot chante au verger !',
    anecdote: 'Jaune d\'or, il vit tout en haut des arbres : on l\'entend bien plus qu\'on ne le voit.',
    title: 'Le loriot chante au verger !', halt: 'Le loriot chante au verger', still: 'Le loriot chante encore au verger.',
    decor: { view: 'oriole', farm: 'oriole' }, calendar: 'Été : le loriot au verger',
  },
  {
    id: 'beaver', name: 'Castor d\'Europe', the: 'Le castor', g: 'm', icon: 'visitor.beaver', seasons: ['spring', 'summer', 'autumn'], drawn: true,
    recipe: [{ kind: 'place', id: 'brook', step: 4 }, { kind: 'place', id: 'bocage', step: 3 }],
    where: 'view', placeId: 'brook', whereText: 'près du pont du ruisseau',
    hint: 'Des branches de saule rongées en pointe, au bord du ruisseau…', hintIcon: 'visitor.hint.gnawed', welcome: 'Un castor au ruisseau !',
    anecdote: 'Presque disparu de France, il revient : ses barrages gardent l\'eau des ruisseaux.',
    title: 'Un castor au ruisseau !', halt: 'Un castor au ruisseau', still: 'Le castor ronge encore ses branches au ruisseau.',
    decor: { view: 'beaver' }, calendar: 'Printemps → automne, le soir : le castor au ruisseau',
  },
  {
    id: 'glowworms', name: 'Vers luisants', the: 'Les vers luisants', g: 'm', pl: true, icon: 'visitor.glowworms', seasons: ['summer'], drawn: true,
    recipe: [{ kind: 'stage', n: 7 }, { kind: 'nature', id: 'hedge', n: 20 }],
    where: 'farm', spot: 'hedge', whereText: 'au pied d\'une haie de la ferme',
    hint: 'Hier soir, une petite lumière verte au pied d\'une haie…', hintIcon: 'visitor.hint.glow', welcome: 'Des vers luisants le long de la haie !',
    anecdote: 'Les soirs d\'été, la femelle allume sa lanterne pour que le mâle la trouve.',
    title: 'Des vers luisants le long de la haie !', halt: 'Des vers luisants le long de la haie', still: 'Les vers luisants brillent encore au pied de la haie.',
    decor: { view: 'glowView', farm: 'glow' }, calendar: 'Soirs d\'été : les vers luisants',
  },
];
export const VISITORS_BY_ID = Object.fromEntries(VISITORS.map((x) => [x.id, x]));
export const VISITOR_IDS = VISITORS.map((x) => x.id);
/** Visiteurs tirés (flux valley4 : un nombre par visiteur, dans cet ordre, à chaque aube, vue ouverte). */
export const DRAWN_VISITORS = VISITORS.filter((x) => x.drawn);

/** Venue des visiteurs tirés : 6 % par aube qu'il s'annonce (indice), puis 50 % par aube (au plus tard la 3ᵉ). */
export const VISITOR_RULES = { hintChance: 0.06, visibleChance: 0.5, maxWait: 3 };

/** Les cigognes : jour des cigognes (2ᵉ à 4ᵉ jour du printemps, hachage de la graine) ; 1 à 4 cigogneaux ; conditions. */
export const STORK_RULES = {
  dayMin: 2, dayMax: 4, chicksMin: 1, chicksMax: 4,
  needs: [{ kind: 'stage', n: 7 }, { kind: 'place', id: 'millpond', step: 2 }, { kind: 'place', id: 'poppies', step: 2 }],
};

/** L'étape 8 « Les cigognes » : aucun palier de signes (les 99 restent « toute la vallée ») ; il faut avoir vu les cigognes. */
export const STAGE_V4 = {
  n: 8, id: 'storks', name: 'Les cigognes', signs: null, needs: { storkSeen: true }, reward: { ecus: 100 }, vignette: 'valley.stage.8',
  chapter: {
    title: 'Les cigognes', vignette: 'story.storks',
    lines: ['Regarde le clocher. Non, regarde bien.', 'Deux cigognes. Ma grand-mère avait raison : elles reviennent le même jour.', 'Soixante-dix ans que je regarde ce clocher en mars, petit.'],
  },
};

/** Les cinq récits du V4 ({ofFarm} remplacé par le cœur : « de la Ferme des Tilleuls »). */
export const STORIES_V4 = [
  { id: 'melon', title: 'Le melon se réveille', vignette: 'story.melon', when: { legend: 'motherMelon' }, lines: ['Ce matin, j\'ai ouvert la boîte : trois graines de melon avaient gonflé.', 'Comme si elles avaient entendu le ruisseau revenir.', 'Ma mère disait : quand l\'eau revient, tout revient. Sème-les près de tes bocaux.'] },
  { id: 'mill', title: 'Le coffre du moulin', vignette: 'story.mill', when: { legend: 'millEinkorn' }, lines: ['En rangeant le moulin, on a ouvert le vieux coffre à grain de mon père.', 'Au fond, une poignée d\'engrain : le plus vieux blé du monde, disait-il.', 'Il a attendu soixante ans dans le noir. Il mérite un peu de soleil.'] },
  { id: 'marvel', title: 'La Merveille', vignette: 'story.marvel', when: { legend: 'farmMarvel' }, lines: ['Trois étés que tu gardes les graines de ta plus belle tomate.', 'Elle ne ressemble plus à aucune autre : c\'est la Merveille {ofFarm}.', 'Dans cent ans, quelqu\'un la sèmera en disant ton nom.'] },
  { id: 'peas', title: 'Les pois du jour des cigognes', vignette: 'story.peas', when: { legend: 'storkPea' }, lines: ['Ma grand-mère semait ses pois le jour où les cigognes revenaient.', 'Je les ai ressemés chaque printemps, en regardant le clocher vide.', 'Cette année, enfin, on les sème le bon jour. Tiens, ils sont à toi.'] },
  { id: 'storkNest', title: 'Un nid sur la maison', vignette: 'story.storkNest', when: 'storkNest', lines: ['Elles ont choisi ta maison !', 'Ma grand-mère disait qu\'une cigogne sur le toit, c\'est une maison heureuse.', 'Je crois qu\'elles savent ce qu\'elles font.'] },
];
export const STORIES_V4_BY_ID = Object.fromEntries(STORIES_V4.map((s) => [s.id, s]));

/** L'épilogue de Joseph « La vallée retrouvée » (3 pages) et le générique doux. */
export const EPILOGUE = {
  id: 'epilogue', title: 'La vallée retrouvée', vignette: 'story.epilogue.1',
  pages: [
    { vignette: 'story.epilogue.1', lines: ['Monte. Je voulais la voir avec toi, une fois finie.', 'Le ruisseau chante, le moulin tourne, les cigognes sont sur ta maison.', 'La vallée de ma mère, petit. Exactement comme elle me la racontait.'] },
    { vignette: 'story.epilogue.2', lines: ['Tiens. La boîte en fer. Elle est à toi, maintenant.', 'J\'y ai mis un peu de chaque graine : les tiennes, celles du village, les légendes.', 'Une graine qu\'on donne, c\'est une graine qui vit. Tu sauras à qui la donner.'] },
    { vignette: 'story.epilogue.3', lines: ['Moi, je vais m\'asseoir un peu sur ce banc, avec Hélène.', 'On comptera les hirondelles. Viens nous voir quand tu veux.', 'La vallée n\'a plus besoin qu\'on la sauve. Elle a juste besoin qu\'on y vive.'] },
  ],
  credits: {
    title: 'La vallée {ofFarm}',
    // Une carte par lieu (son nom, la phrase de Joseph de sa dernière étape : lue dans PLACES par le cœur).
    places: ['combe', 'oldOrchard', 'poppies', 'millpond', 'brook', 'bocage'],
    total: '{species} habitants · {varieties} variétés · {places} lieux · {legends} légendes',
    end: ['Merci d\'avoir rendu sa vallée à la mère de Joseph.', 'La vallée continue.'],
  },
  after: { watch: 'Regarder la vallée', later: 'Plus tard' },
};

/** Les huit vallées voisines (ordre fixe) : un sachet de la boîte en fer envoyé, une carte la saison suivante. */
export const POSTCARDS = [
  { id: 'valAuxMerles', n: 1, valley: 'Le Val-aux-Merles', signer: 'Marthe, l\'institutrice', text: 'Vos pois ont levé ! Et ce matin, un merle chantait sur la barrière.', vignette: 'postcard.1' },
  { id: 'combesHautes', n: 2, valley: 'Les Combes-Hautes', signer: 'la famille Roux', text: 'Le melon a pris sous la cloche. Les enfants comptent les jours.', vignette: 'postcard.2' },
  { id: 'saintAubin', n: 3, valley: 'Saint-Aubin-des-Saules', signer: 'Gaston', text: 'On a replanté une haie, puis deux. Les hérissons sont revenus.', vignette: 'postcard.3' },
  { id: 'fontaineRousse', n: 4, valley: 'La Fontaine-Rousse', signer: 'les gens de la Fontaine', text: 'La source coule de nouveau. On a pensé à vous.', vignette: 'postcard.4' },
  { id: 'moulinNeuf', n: 5, valley: 'Le Moulin-Neuf', signer: 'Albert, meunier', text: 'Notre meunier fait du pain avec votre engrain. Il sent la noisette.', vignette: 'postcard.5' },
  { id: 'presFleuris', n: 6, valley: 'Les Prés-Fleuris', signer: 'Suzanne', text: 'Coquelicots partout cet été. Hélène est venue les compter !', vignette: 'postcard.6' },
  { id: 'boisJoli', n: 7, valley: 'Le Bois-Joli', signer: 'Paul et Jeanne', text: 'Un chevreuil traverse le verger chaque matin, à sept heures pile.', vignette: 'postcard.7' },
  { id: 'nextValley', n: 8, valley: 'La vallée d\'à côté', signer: 'tout le village', text: 'Cette année, une cigogne s\'est posée sur notre clocher. Merci.', vignette: 'postcard.8' },
];
export const POSTCARDS_BY_ID = Object.fromEntries(POSTCARDS.map((x) => [x.id, x]));
/** La carte arrive à la première aube de la saison suivante ; un seul sachet en route à la fois. */
export const POSTCARD_RULES = { travelSeasons: 1, inFlight: 1 };

/** Le banc du belvédère : Joseph et Hélène, une phrase de saison au toucher (hachage du jour). */
export const BENCH_LINES = {
  spring: [
    'Elles sont arrivées le {day}, comme chaque année.',
    'Hélène a vu la première hirondelle ce matin. Elle l\'a notée deux fois, pour être sûre.',
    'Sens-tu l\'aubépine ? Ma mère en mettait un brin à la fenêtre.',
    'Les grenouilles ont recommencé à chanter. Le printemps, c\'est elles qui l\'annoncent.',
  ],
  summer: [
    'Hélène dit que les petits voleront avant la fin de l\'été.',
    'Les grillons, le soir… On n\'a pas besoin d\'autre musique.',
    'Regarde la prairie : on dirait qu\'elle bouge toute seule, avec les papillons.',
    'Il fait bon à l\'ombre du tilleul. Assieds-toi un peu.',
  ],
  autumn: [
    'Tu entends les grues ? Elles passent toujours par ici.',
    'Les cigognes sont parties. Le nid les attend, bien au chaud sur ta maison.',
    'Hélène a ramassé des cèpes plein son panier. Elle dit que c\'est pour la science.',
    'Le bois a mis son habit roux. Ma mère disait qu\'il se faisait beau pour l\'hiver.',
  ],
  winter: [
    'Le ruisseau fait moins de bruit sous la glace. Mais il est là.',
    'Des traces de renard dans la neige, jusqu\'à la haie. Il connaît le chemin.',
    'Hélène recopie son carnet au propre, l\'hiver. Elle dit que c\'est sa saison préférée.',
    'Le rouge-gorge ne nous quitte pas, lui. Fidèle comme un vieux chien.',
  ],
};

/** Les phrases d'Hélène (le livre de la vallée : une par année, hachage pur de l'année). */
export const HELENE_NOTES = [
  'J\'ai compté quarante-deux hirondelles sur le fil, ce matin.',
  'Trois espèces de chauves-souris au-dessus de l\'étang. Trois !',
  'Le martin-pêcheur a niché sous la berge, près du pont.',
  'Onze sortes d\'orchidées, et une douzième que je n\'ai pas su nommer.',
  'Les écrevisses ont fait des petits sous les cailloux.',
  'La chevêche m\'a regardée passer sans bouger. On se connaît.',
  'Le pic noir a creusé une nouvelle loge dans le vieux hêtre.',
  'Des traces de loutre jusqu\'au moulin, dans la neige.',
  'L\'alouette chantait si haut que je ne la voyais plus.',
  'Les grenouilles ont chanté toute la nuit après l\'orage.',
  'J\'ai vu un lièvre et un renard se regarder, puis repartir chacun de son côté.',
  'Mon carnet est presque plein. Il m\'en faudra un autre.',
];

/** La forêt de la carte en quatre états (dessin seulement ; part des tuiles devenues feuillues). */
export const FOREST_STATES = [
  { n: 0, name: 'La forêt d\'avant', deciduous: 0, clearings: false, old: false },
  { n: 1, name: 'La forêt s\'éclaire', deciduous: 0.2, clearings: false, old: false },
  { n: 2, name: 'Les clairières', deciduous: 0.4, clearings: true, old: false },
  { n: 3, name: 'La vieille forêt mêlée', deciduous: 0.6, clearings: true, old: true },
];

/** Le décor : arc-en-ciel une fois sur trois le matin qui suit une pluie ; passages d'oiseaux (hachage du jour). */
export const SCENERY_RULES = { rainbowEvery: 3, storkFlyEvery: 2, craneFlyEvery: 4, deerEvery: 3, orioleEvery: 2, residentEvery: 3 };

/** Conseils « première fois » (UI). */
export const STORKS_HINTS = {
  'valley.legend': 'Une légende ne se vend pas : elle se garde, et se partage.',
  'valley.visitor': 'Les visiteurs rares font halte : allez les voir, ils vous attendent.',
  'valley.book': 'Tout ce que vous avez fait revivre est écrit ici.',
  'valley.sounds': 'Écoutez : chaque habitant installé a son chant.',
};

/** Textes du V4 (refus, messages, lignes). */
export const STORKS_TEXTS = {
  disabled: 'Les cigognes sont désactivées.',
  unknownLegend: 'Légende inconnue.',
  asleep: 'Cette graine dort encore.',
  needLibrary: 'Il faut d\'abord la Grainothèque.',
  growing: 'Elle pousse déjà sous sa cloche.',
  ripeFirst: 'Elle est mûre : récoltez-la d\'abord.',
  emptyCloche: 'Rien sous cette cloche.',
  notRipe: 'Pas encore mûre : encore {days}.',
  waitsHome: '{the} attend sa maison : la Grainothèque.',
  harvested: '{name} récolté{e} : la Grainothèque en garde les graines.',
  nothingToSee: 'Rien à voir ici.',
  alreadySeen: 'Déjà vu.',
  epilogueNotYet: 'Pas encore : Joseph vous attendra sur la colline quand la vallée sera complète.',
  creditsNotYet: 'Après l\'épilogue de Joseph.',
  postcardNeedEpilogue: 'Après l\'épilogue de Joseph.',
  postcardInFlight: 'Un sachet est déjà en route.',
  postcardsDone: 'Toutes les vallées voisines ont reçu leurs graines.',
  postcardUnknown: 'Carte inconnue.',
  marvelNeedCross: 'Il faut d\'abord sauver la Tomate de la ferme.',
  marvelRule: 'Gardez les graines d\'une belle tomate de la ferme, une fois par été : {n} / {need} générations.',
  storksLeft: 'Les cigognes sont parties vers le sud. Elles reviendront le {day}.',
  storksHome: 'Les cigognes sont revenues sur la maison !',
  storksSteeple: 'Deux grands oiseaux blancs tournent au-dessus du clocher !',
  chicks: '{n} cigogneau{x} dans le nid',
  chicksBook: '{n} cigogneau{x}',
  epilogueWaits: 'Joseph vous attend sur la colline.',
  storkNeedDay: 'Les cigognes reviennent le {day}.',
  storkNeed: 'Les cigognes viendront quand {need}.',
  storkWaiting: 'Les cigognes vous attendent sur le clocher.',
  storkNest: 'Revenues le {day} · {chicks}',
  postcardHint: 'Une carte {of} vous attend.',
  wheel: 'Joseph a posé une vieille roue de charrette sur votre cheminée, pour inviter les cigognes.',
};

/** Textes du livre de la vallée. */
export const BOOK_TEXTS = {
  title: 'La vallée {ofFarm}',
  since: 'depuis l\'an {year}',
  approx: 'vers l\'an {year}',
  signs: '{from} → {to} signes de vie',
  storkYear: 'Retour des cigognes le {day}',
  storkYearChicks: 'Retour des cigognes le {day} · {chicks}',
  storkSteeple: 'Les cigognes sur le clocher du village',
  storkNestFirst: 'Un nid de cigognes sur la maison',
  stage: 'Étape {n} · {name}',
  installed: '{name} s\'installe',
  installedPl: '{name} s\'installent',
  saved: '{name} sauvée',
  savedM: '{name} sauvé',
  place: '{place} : {step}',
  legend: '{name} se réveille',
  legendPl: '{name} se réveillent',
  visitor: '{name} : vu{s} pour la première fois',
  postcard: 'Une carte {of}',
  epilogue: 'Joseph raconte la fin de l\'histoire',
  wild: '{name} revient à la nature',
};
