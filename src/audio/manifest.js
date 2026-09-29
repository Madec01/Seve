// Catalogue des sons du jeu (chemins relatifs à la racine du jeu).
//
// Chaque entrée : { src: [ogg, mp3], volume, loop? }
//   - src    : ogg en premier (Firefox, Chrome), mp3 en secours (Safari) — prendre le premier
//              format lisible (audio.canPlayType) ;
//   - volume : volume relatif conseillé (0..1) pour équilibrer les sons entre eux, à multiplier
//              par le volume réglé par le joueur ;
//   - loop   : true pour les musiques et ambiances à jouer en boucle.
//
// Origine et licence de chaque fichier : voir CREDITS.md. Les musiques de Sirental (CC BY 4.0)
// imposent l'attribution affichée dans les crédits du jeu.

const both = (path) => [`${path}.ogg`, `${path}.mp3`];
const m = (name, extra = {}) => ({ src: both(`assets/audio/music/${name}`), volume: 0.7, loop: true, ...extra });
const s = (name, volume = 1) => ({ src: both(`assets/audio/sfx/${name}`), volume });
const a = (name, volume = 1) => ({ src: both(`assets/audio/ambience/${name}`), volume, loop: true });

export const AUDIO = {
  music: {
    menu: m('menu'),                 // « Town Theme »
    spring: m('spring'),             // « Spring Farm »
    summer: m('summer'),             // « Summer Farm »
    autumn: m('autumn'),             // « Fall Farm »
    winter: m('winter'),             // « Winter Farm »
    night: m('night'),               // « Night Time » (pause, écran de fin de saison…)
    // Victoire : jouer l'intro une fois, puis enchaîner la boucle
    victory: {
      intro: m('festival-intro', { loop: false }),   // « Festival Music » intro, 9,4 s
      loop: m('festival-loop'),                      // « Festival Music » boucle, 42,1 s
    },
    festival: m('festival', { loop: false }),        // version complète (intro + boucle), 52,7 s
  },

  sfx: {
    // Interface
    click: s('click', 0.8),          // clic de bouton
    hover: s('hover', 0.4),          // survol (discret)
    toggle: s('toggle', 0.9),        // vitesse, interrupteurs
    open: s('open', 0.8),            // ouverture de fenêtre
    close: s('close', 0.8),          // fermeture de fenêtre
    page: s('page', 1),              // changement d'onglet (page tournée)
    confirm: s('confirm', 0.56),     // validation
    error: s('error', 1),            // action impossible
    warning: s('warning', 0.45),     // avertissement (changement de saison, fermage proche)

    // Potager
    plant: s('plant', 1),            // semis
    water: s('water', 1),            // arrosoir
    harvest: s('harvest', 1),        // récolte (à jouer avec « coin »)
    coin: s('coin', 1),              // gain d'argent
    dig: s('dig', 1),                // ouverture d'une nouvelle parcelle
    frost: s('frost', 1),            // gel (craquement de glace)
    frostJingle: s('frost-jingle', 0.52), // gel : petite mélodie descendante
    rot: s('rot', 0.8),              // culture pourrie (niveau pluvieux)

    // Achats et investissements
    buy: s('buy', 1),                // achat (pièces)
    build: s('build', 1),            // bâtiment posé (marteau sur bois)
    unlock: s('unlock', 0.61),       // niveau débloqué, nouvel élément

    // Animaux
    rooster: s('rooster', 0.48),     // coq à l'aube
    chicken: s('chicken', 0.38),
    cow: s('cow', 0.35),
    sheep: s('sheep', 0.59),
    bees: s('bees', 0.86),

    // Jingles de fin
    seasonEnd: s('season-end', 0.53), // fin de saison / fermage payé
    victory: s('victory', 0.82),      // année réussie (avant la musique du festival)
    bankrupt: s('bankrupt', 0.56),    // faillite
  },

  ambience: {
    birds: a('birds', 0.8),          // printemps / été, en journée (boucle de 120 s)
    rain: a('rain', 0.9),            // pluie et orage (boucle de 60 s)
    wind: a('wind', 0.8),            // hiver, neige (boucle de 6,8 s)
    bees: a('bees', 0.5),            // près des ruches (boucle de 30 s)
  },
};
