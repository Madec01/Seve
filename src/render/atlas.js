// Atlas des sprites : noms lisibles → position dans les planches (tuiles de 16 px).
//
// Planches :
//   farm  : Kenney « Tiny Farm »  (CC0) — assets/sprites/tiny-farm.png, 12 × 11 tuiles
//   town  : Kenney « Tiny Town »  (CC0) — assets/sprites/tiny-town.png, 12 × 11 tuiles
//   extra : tuiles dérivées des packs Kenney (plants pas mûrs, tournesol, panneau solaire, arroseur)
//           — assets/sprites/extra.png, générée par assets/sprites/generate-extra.py
//   v3    : contenu « v3 » dessiné dans le style Kenney (nouvelles cultures, pommier, chèvre, produits,
//           bâtiments, décorations, tenues, icônes) — assets/sprites/v3.png, générée (avec le bloc
//           « v3:auto » plus bas) par assets/sprites/generate-v3.py
//   career: mode Carrière (animaux, abris à niveaux, maison, silos, machines, employés et portraits,
//           Joseph, friche, pavés, fêtes, icônes, succès…) dessiné dans le style Kenney —
//           assets/sprites/career.png, générée (avec le bloc « career:auto » plus bas) par
//           assets/sprites/generate-career.py
//   lot2  : « toucher et surprises » (légumes géants, qualité, surprises de l'aube, météos spéciales,
//           trouvailles, effets de récolte) dessiné dans le style Kenney — assets/sprites/lot2.png,
//           générée (avec le bloc « lot2:auto » plus bas) par assets/sprites/generate-lot2.py
//   lot3/lot4 : « variété » puis « collection et enjeux doux » (album, fêtes, hiver, lanternes, décors),
//           dans le style Kenney — assets/sprites/lot3.png / lot4.png, générées (avec les blocs « lot3:auto »
//           et « lot4:auto » plus bas) par assets/sprites/generate-lot3.py / generate-lot4.py
//
// Une entrée simple : { sheet, col, row, w?, h? } (w/h en tuiles, 1 par défaut).
// Une entrée composée (bâtiments) : { w, h, layers: [{ sheet, col, row, dx, dy }] }
//   dx/dy en tuiles à l'intérieur du sprite ; les calques sont dessinés dans l'ordre.
//
// Orientation : les animaux (mouton, vache, poule) regardent vers la DROITE ; une seule image
// par animal (pas d'animation de marche) → retourner horizontalement (flipX) et faire
// « sautiller » d'1 px dans le code pour les animer.
//
// Ce module ne touche pas au DOM : il ne fait que décrire les sprites et dessiner sur un
// contexte canvas fourni.

export const TILE = 16;

export const SHEETS = {
  farm: 'assets/sprites/tiny-farm.png',
  town: 'assets/sprites/tiny-town.png',
  extra: 'assets/sprites/extra.png',
  v3: 'assets/sprites/v3.png',
  career: 'assets/sprites/career.png',
  lot2: 'assets/sprites/lot2.png',
  lot3: 'assets/sprites/lot3.png',
  lot4: 'assets/sprites/lot4.png',
  valley1: 'assets/sprites/valley1.png',
  valley2: 'assets/sprites/valley2.png',
  valley3: 'assets/sprites/valley3.png',
  valley3bg: 'assets/sprites/valley3-bg.png',
  valley4: 'assets/sprites/valley4.png',
  coach: 'assets/sprites/coach.png',
};

// Cultures disponibles (toutes présentes dans Tiny Farm ; le tournesol n'y a qu'une image mûre,
// ses autres étapes sont empruntées/dérivées, voir plus bas).
export const CROP_IDS = ['carrot', 'turnip', 'wheat', 'cabbage', 'tomato', 'corn', 'sunflower'];
export const CROP_STAGES = 5; // 0 graine, 1 pousse, 2 jeune plant, 3 plant, 4 mûr

const f = (col, row, w, h) => (w || h ? { sheet: 'farm', col, row, w: w || 1, h: h || 1 } : { sheet: 'farm', col, row });
const t = (col, row, w, h) => (w || h ? { sheet: 'town', col, row, w: w || 1, h: h || 1 } : { sheet: 'town', col, row });
const x = (col, row) => ({ sheet: 'extra', col, row });
const L = (sheet, col, row, dx, dy) => ({ sheet, col, row, dx, dy });

// Grille d'un sprite composé à partir d'un tableau de lignes de [col,row] (null = vide).
function grid(sheet, rows) {
  const layers = [];
  rows.forEach((line, dy) => line.forEach((cell, dx) => {
    if (cell) layers.push(L(sheet, cell[0], cell[1], dx, dy));
  }));
  return { w: Math.max(...rows.map(r => r.length)), h: rows.length, layers };
}

// ---------------------------------------------------------------------------
// Cultures
// Tiny Farm, une ligne par culture : col 4 pousse, col 5 plant, col 6 mûr, col 7 fané,
// col 8 récolte (icône), col 9 grand sac, col 10 sachet de graines, col 11 cagette.
// Étape 0 (graine) : tuile commune « graines semées » dessinée pour le jeu (extra col 6, ligne 1),
// transparente, à poser par-dessus la parcelle.
// Étape intermédiaire manquante : tuile « pas mûre » dérivée (fruits recolorés en vert, planche extra).
const SEED = x(6, 1);
const CROP_ROWS = { carrot: 0, turnip: 1, corn: 2, tomato: 3, cabbage: 4, wheat: 5 };
const CROP_STAGE_MAP = {
  //          0     1        2        3        4
  carrot:  [SEED, f(4, 0), x(0, 0), f(5, 0), f(6, 0)],
  turnip:  [SEED, f(4, 1), x(1, 0), f(5, 1), f(6, 1)],
  tomato:  [SEED, f(4, 3), x(2, 0), f(5, 3), f(6, 3)],
  corn:    [SEED, f(4, 2), f(5, 2), x(3, 0), f(6, 2)],
  wheat:   [SEED, f(4, 5), f(5, 5), x(4, 0), f(6, 5)],
  cabbage: [SEED, f(4, 4), f(5, 4), x(6, 0), f(6, 4)],
  sunflower: [SEED, f(4, 4), f(8, 6), x(5, 0), f(11, 6)],
};

const crops = {};
for (const id of CROP_IDS) {
  CROP_STAGE_MAP[id].forEach((s, i) => { crops[`crop.${id}.${i}`] = s; });
  const row = CROP_ROWS[id];
  if (row !== undefined) {
    crops[`crop.${id}.dead`] = f(7, row);
    crops[`crop.${id}.icon`] = f(8, row);
    crops[`sack.${id}`] = f(9, row);
    crops[`seedbag.${id}`] = f(10, row);
    crops[`crate.${id}`] = f(11, row);
  }
}
Object.assign(crops, {
  'crop.sunflower.dead': x(5, 1),
  'crop.sunflower.icon': f(11, 6),
  'sack.sunflower': x(1, 1),
  'seedbag.sunflower': x(0, 1),
  'crate.sunflower': x(2, 1),
  'crop.seeds': SEED,          // graines semées (sur la terre)
  'seed.sprouting': f(9, 6),   // graine germée (icône « graine » générique)
});

// ---------------------------------------------------------------------------
// Bâtiments composés (vérifiés visuellement contre les images d'exemple Kenney)

// Grange rouge à toit vert (Tiny Farm) : faîte + 3 rangs de toit, pignon (mur à croix + bas du toit
// en surimpression), rangée du bas avec porte.
const BARN_ROOF = [
  L('farm', 10, 6, 1, 0),
  L('farm', 9, 7, 0, 1), L('farm', 10, 7, 1, 1), L('farm', 11, 7, 2, 1),
  L('farm', 9, 8, 0, 2), L('farm', 10, 8, 1, 2), L('farm', 11, 8, 2, 2),
  L('farm', 9, 9, 0, 3), L('farm', 10, 9, 1, 3), L('farm', 11, 9, 2, 3),
  L('farm', 6, 7, 0, 4), L('farm', 7, 7, 1, 4), L('farm', 8, 7, 2, 4),
  L('farm', 9, 10, 0, 4), L('farm', 10, 10, 1, 4), L('farm', 11, 10, 2, 4),
];

const buildings = {
  // Grange (disposition de l'image d'exemple Kenney) : 3 × 6 tuiles, petite porte
  'building.barn': { w: 3, h: 6, layers: [...BARN_ROOF,
    L('farm', 6, 9, 0, 5), L('farm', 7, 10, 1, 5), L('farm', 8, 9, 2, 5)] },
  // Grange, grande porte : 3 × 6
  'building.barn.bigdoor': { w: 3, h: 6, layers: [...BARN_ROOF,
    L('farm', 6, 9, 0, 5), L('farm', 6, 10, 1, 5), L('farm', 8, 9, 2, 5)] },
  // Grande grange (étable) : 3 × 7, rangée à fenêtres + grande porte
  'building.barn.tall': { w: 3, h: 7, layers: [...BARN_ROOF,
    L('farm', 8, 10, 0, 5), L('farm', 7, 8, 1, 5), L('farm', 8, 10, 2, 5),
    L('farm', 6, 9, 0, 6), L('farm', 6, 10, 1, 6), L('farm', 8, 9, 2, 6)] },

  // Maison (Tiny Town) : toit d'ardoise + murs en bois, 4 × 3 (comme l'exemple Kenney)
  'building.house': grid('town', [
    [[0, 4], [3, 4], [1, 4], [2, 4]],
    [[0, 5], [1, 5], [3, 5], [2, 5]],
    [[0, 6], [0, 7], [1, 7], [3, 6]],
  ]),
  // Maison de pierre à toit rouge (chambre d'hôte), 4 × 3
  'building.house.red': grid('town', [
    [[4, 4], [7, 4], [5, 4], [6, 4]],
    [[4, 5], [5, 5], [7, 5], [6, 5]],
    [[4, 6], [4, 7], [5, 7], [7, 6]],
  ]),
  // Petite maison bois / ardoise, 3 × 3
  'building.cottage': grid('town', [
    [[0, 4], [1, 4], [2, 4]],
    [[0, 5], [3, 5], [2, 5]],
    [[0, 6], [1, 7], [3, 6]],
  ]),
  // Petite maison pierre / tuiles rouges, 3 × 3
  'building.cottage.red': grid('town', [
    [[4, 4], [5, 4], [6, 4]],
    [[4, 5], [7, 5], [6, 5]],
    [[4, 6], [5, 7], [7, 6]],
  ]),
  // Cabane 2 × 3 (toit rouge sans pignon, mur bois, fenêtre + porte) : idéale pour le poulailler
  'building.shed': grid('town', [
    [[4, 4], [6, 4]],
    [[4, 5], [6, 5]],
    [[0, 7], [3, 7]],
  ]),
  // Puits (toit + margelle), 1 × 2
  'well': t(8, 7, 1, 2),
};

// Pièces détachées de construction (pour composer d'autres bâtiments)
const buildingParts = {
  'barn.roof.peak': f(10, 6),
  'barn.roof.tl': f(9, 7), 'barn.roof.t': f(10, 7), 'barn.roof.tr': f(11, 7),
  'barn.roof.l': f(9, 8), 'barn.roof.c': f(10, 8), 'barn.roof.r': f(11, 8),
  'barn.roof.bl': f(9, 9), 'barn.roof.b': f(10, 9), 'barn.roof.br': f(11, 9),
  'barn.roof.eave.l': f(9, 10), 'barn.roof.eave.r': f(11, 10), // se posent sur le pignon
  'barn.wall.gable.l': f(6, 7), 'barn.wall.gable.c': f(7, 7), 'barn.wall.gable.r': f(8, 7),
  'barn.wall.mid.l': f(6, 8), 'barn.wall.mid.c': f(7, 8), 'barn.wall.mid.r': f(8, 8),
  'barn.wall.bottom.l': f(6, 9), 'barn.wall.bottom.c': f(7, 9), 'barn.wall.bottom.r': f(8, 9),
  'barn.door.big': f(6, 10), 'barn.door.small': f(7, 10), 'barn.window': f(8, 10),

  'roof.slate.l': t(0, 4), 'roof.slate.c': t(1, 4), 'roof.slate.r': t(2, 4), 'roof.slate.chimney': t(3, 4),
  'roof.slate.bottom.l': t(0, 5), 'roof.slate.bottom.c': t(1, 5), 'roof.slate.bottom.r': t(2, 5), 'roof.slate.gable': t(3, 5),
  'roof.red.l': t(4, 4), 'roof.red.c': t(5, 4), 'roof.red.r': t(6, 4), 'roof.red.chimney': t(7, 4),
  'roof.red.bottom.l': t(4, 5), 'roof.red.bottom.c': t(5, 5), 'roof.red.bottom.r': t(6, 5), 'roof.red.gable': t(7, 5),
  // le pignon d'ardoise se termine en bois, celui de tuiles rouges en pierre : à associer ainsi
  'wall.wood.l': t(0, 6), 'wall.wood.c': t(1, 6), 'wall.wood.doorway': t(2, 6), 'wall.wood.r': t(3, 6),
  'wall.wood.window': t(0, 7), 'wall.wood.door': t(1, 7), 'wall.wood.doubledoor.l': t(2, 7), 'wall.wood.doubledoor.r': t(3, 7),
  'wall.stone.l': t(4, 6), 'wall.stone.c': t(5, 6), 'wall.stone.doorway': t(6, 6), 'wall.stone.r': t(7, 6),
  'wall.stone.window': t(4, 7), 'wall.stone.door': t(5, 7), 'wall.stone.doubledoor.l': t(6, 7), 'wall.stone.doubledoor.r': t(7, 7),
};

// ---------------------------------------------------------------------------
// Sol
const ground = {
  // Herbe (Tiny Town ; même vert que le fond des tuiles de Tiny Farm)
  'ground.grass': t(0, 0),
  'ground.grass.tufts': t(1, 0),
  'ground.grass.flowers': t(2, 0),

  // Chemin de terre 3 × 3 (bords herbeux) + coins intérieurs (« inner.tl » = herbe dans le coin haut-gauche)
  'path.tl': t(0, 1), 'path.t': t(1, 1), 'path.tr': t(2, 1),
  'path.l': t(0, 2), 'path.c': t(1, 2), 'path.r': t(2, 2),
  'path.bl': t(0, 3), 'path.b': t(1, 3), 'path.br': t(2, 3),
  'path.inner.tl': t(3, 3), 'path.inner.tr': t(4, 3), 'path.inner.br': t(5, 3), 'path.inner.bl': t(6, 3),
  'path.stones': t(7, 3), // pas japonais (pierres sur l'herbe)

  // Parcelles de terre labourée (Tiny Farm, tuiles opaques avec l'herbe autour).
  // « dry » = terre claire, « wet » = terre sombre (arrosée) : les deux existent dans le pack.
  'soil.dry': f(0, 0), 'soil.wet': f(1, 0), // parcelle isolée (ovale vertical)
  'soil.dry.v.top': f(0, 1), 'soil.dry.v.mid': f(0, 2), 'soil.dry.v.bottom': f(0, 3),
  'soil.wet.v.top': f(1, 1), 'soil.wet.v.mid': f(1, 2), 'soil.wet.v.bottom': f(1, 3),
  'soil.dry.h.left': f(0, 5), 'soil.dry.h.mid': f(1, 5), 'soil.dry.h.right': f(2, 5), 'soil.dry.h.single': f(3, 5),
  'soil.wet.h.left': f(0, 4), 'soil.wet.h.mid': f(1, 4), 'soil.wet.h.right': f(2, 4), 'soil.wet.h.single': f(3, 4),
};

// ---------------------------------------------------------------------------
// Végétation et décor
const nature = {
  'tree.green': t(4, 2),              // petit arbre vert (1 tuile)
  'tree.green.tall': t(4, 0, 1, 2),   // grand arbre vert (1 × 2)
  'tree.autumn': t(3, 2),             // petit arbre orange
  'tree.autumn.tall': t(3, 0, 1, 2),  // grand arbre orange (1 × 2)
  'tree.pine': f(3, 2),               // petit sapin
  'tree.pine.tall': f(3, 0, 1, 2),    // grand sapin (1 × 2)
  'tree.round': f(3, 3),              // arbre rond / buisson haut
  'tree.dead.tall': f(2, 0, 1, 2),    // arbre mort (hiver), 1 × 2
  'tree.dead': f(2, 2, 1, 2),         // petit arbre mort, 1 × 2
  'bush': t(5, 0),                    // gros buisson rond
  'bush.berry': f(6, 6),              // buisson à baies
  'plant.fern': t(5, 1),              // pousses / fougère
  'plant.weeds': f(8, 6),             // herbes hautes
  'mushrooms': t(5, 2),
  'stump': f(7, 6),
  'rocks.small': f(5, 6),
  'rocks.big': f(5, 7),
  'log': t(10, 8),
  // Forêt dense (Tiny Town), vérifiée en répétition : bande du haut (cimes), remplissage, bande du bas
  // (troncs). Se répète sans couture à l'horizontale et (pour « fill ») à la verticale.
  // Les bords gauche/droit sont coupés net : y poser des 'tree.green' / 'tree.autumn' isolés.
  // (Les colonnes 6 et 8 de la planche sont des raccords d'angle non retenus.)
  'forest.green.top': t(7, 0), 'forest.green.fill': t(7, 1), 'forest.green.bottom': t(7, 2),
  'forest.autumn.top': t(10, 0), 'forest.autumn.fill': t(10, 1), 'forest.autumn.bottom': t(10, 2),
};

// ---------------------------------------------------------------------------
// Clôtures (Tiny Town)
const fences = {
  // Enclos 3 × 3 : coins, côtés ; « gate » = bas du milieu avec ouverture (entrée de l'enclos)
  'fence.tl': t(8, 3), 'fence.t': t(9, 3), 'fence.tr': t(10, 3),
  'fence.l': t(8, 4), 'fence.r': t(10, 4),
  'fence.bl': t(8, 5), 'fence.gate': t(9, 5), 'fence.br': t(10, 5),
  // Clôture verticale isolée (haut, milieu répétable, bas)
  'fence.v.top': t(11, 3), 'fence.v.mid': t(11, 4), 'fence.v.bottom': t(11, 5),
  // Clôture horizontale isolée (gauche, milieu répétable, droite)
  'fence.h.left': t(8, 6), 'fence.h.mid': t(9, 6), 'fence.h.right': t(10, 6),
};

// ---------------------------------------------------------------------------
// Animaux, personnages, objets
const things = {
  'animal.sheep': f(0, 10),
  'animal.cow': f(1, 10),
  'animal.chicken': f(2, 10),
  'farmer': f(1, 9),                  // fermier au chapeau de paille
  'farmer.nohat': f(0, 9),            // fermier tête nue (enfant / aide)

  'egg': f(5, 10),
  'milk.bottle': f(3, 10),
  'bucket.milk': f(4, 10),
  'bucket': f(0, 6),
  'bucket.water': f(1, 6),
  'bucket.town': t(10, 10),
  'bucket.town.water': t(11, 10),
  'barrel': f(1, 7),
  'sack.empty': f(2, 6),
  'seedbag.empty': f(3, 6),
  'crate.empty': f(4, 6),
  'hay': f(0, 8),
  'hay.tied': f(1, 8),
  'trough.wood': f(2, 8, 2, 1),
  'trough.wood.water': f(2, 9, 2, 1),
  'trough.metal': f(4, 8, 2, 1),
  'trough.metal.feed': f(4, 9, 2, 1),

  'beehive': t(10, 7),
  'stall.cart': t(9, 4),              // charrette de marchand : étal au bord de la route
  'sign': t(11, 6),
  'target': t(11, 7),
  'bag': t(11, 8),
  'coin': t(9, 7),

  'tool.wateringcan': f(0, 7),
  'tool.shovel': f(2, 7),
  'tool.axe': f(3, 7),
  'tool.sickle': f(4, 7),
  'tool.pickaxe': t(7, 9),
  'tool.pitchfork': t(8, 9),
  'tool.hoe': t(9, 10),
  'tool.hammer': t(8, 10),
  'tool.axe.town': t(7, 10),

  // Dessinés pour le jeu dans le style Kenney (planche extra)
  'solar.panel': x(3, 1),
  'sprinkler': x(4, 1),
};

// ---------------------------------------------------------------------------
// Contenu v3 (planche « v3 »). Toutes les tuiles font 16 × 16 sauf indication (w/h en tuiles).
//
// Cultures v3 (citrouille, pomme de terre, fraise, courgette) : mêmes noms que les cultures Kenney
//   crop.<id>.1..4, .icon, .dead, seedbag.<id>, sack.<id>, crate.<id> ; l'étape 0 = graines semées
//   (tuile commune extra, ajoutée ci-dessous). cropSprite(id, stage) fonctionne tel quel.
// Pommier : une parcelle, 16 × 16, dessiné exactement comme une culture (même position, même échelle
//   ×2 en portrait) : tree.apple.sapling / .young / .spring / .summer / .summer.ripe / .autumn /
//   .autumn.ripe / .winter / .dead, et tree.apple.icon (pomme). Pour la scène : treeSprite(stage, season,
//   ripe) ; alias crop.apple.0..4 / .icon / .dead pour passer par cropSprite('apple', stage, season).
// Moulin : building.windmill.body (3 × 4) + building.windmill.sails.0..3 (3 × 4, même origine, à dessiner
//   par-dessus à la même position ; 4 images espacées de 22,5° : la rotation boucle 0→1→2→3→0).
//   Centre des ailes : pixel (24, 20) du sprite. building.windmill = corps + ailes 0 (image fixe).
// Panneau de la ferme deco.sign.farm (2 × 1) : planche vierge, zone de texte FARM_SIGN_TEXT_RECT (px sprite).
// Animaux : animal.goat regarde vers la droite, comme les autres.
const v3 = {
  // <v3:auto>
  // Généré par assets/sprites/generate-v3.py — ne pas modifier à la main.
  'crop.pumpkin.1': { sheet: 'v3', col: 0, row: 0 },
  'crop.pumpkin.2': { sheet: 'v3', col: 1, row: 0 },
  'crop.pumpkin.3': { sheet: 'v3', col: 2, row: 0 },
  'crop.pumpkin.4': { sheet: 'v3', col: 3, row: 0 },
  'crop.pumpkin.icon': { sheet: 'v3', col: 4, row: 0 },
  'crop.pumpkin.dead': { sheet: 'v3', col: 5, row: 0 },
  'seedbag.pumpkin': { sheet: 'v3', col: 6, row: 0 },
  'sack.pumpkin': { sheet: 'v3', col: 7, row: 0 },
  'crate.pumpkin': { sheet: 'v3', col: 8, row: 0 },
  'crop.potato.1': { sheet: 'v3', col: 9, row: 0 },
  'crop.potato.2': { sheet: 'v3', col: 10, row: 0 },
  'crop.potato.3': { sheet: 'v3', col: 11, row: 0 },
  'crop.potato.4': { sheet: 'v3', col: 12, row: 0 },
  'crop.potato.icon': { sheet: 'v3', col: 13, row: 0 },
  'crop.potato.dead': { sheet: 'v3', col: 14, row: 0 },
  'seedbag.potato': { sheet: 'v3', col: 15, row: 0 },
  'sack.potato': { sheet: 'v3', col: 0, row: 1 },
  'crate.potato': { sheet: 'v3', col: 1, row: 1 },
  'crop.strawberry.1': { sheet: 'v3', col: 2, row: 1 },
  'crop.strawberry.2': { sheet: 'v3', col: 3, row: 1 },
  'crop.strawberry.3': { sheet: 'v3', col: 4, row: 1 },
  'crop.strawberry.4': { sheet: 'v3', col: 5, row: 1 },
  'crop.strawberry.icon': { sheet: 'v3', col: 6, row: 1 },
  'crop.strawberry.dead': { sheet: 'v3', col: 7, row: 1 },
  'seedbag.strawberry': { sheet: 'v3', col: 8, row: 1 },
  'sack.strawberry': { sheet: 'v3', col: 9, row: 1 },
  'crate.strawberry': { sheet: 'v3', col: 10, row: 1 },
  'crop.zucchini.1': { sheet: 'v3', col: 11, row: 1 },
  'crop.zucchini.2': { sheet: 'v3', col: 12, row: 1 },
  'crop.zucchini.3': { sheet: 'v3', col: 13, row: 1 },
  'crop.zucchini.4': { sheet: 'v3', col: 14, row: 1 },
  'crop.zucchini.icon': { sheet: 'v3', col: 15, row: 1 },
  'crop.zucchini.dead': { sheet: 'v3', col: 0, row: 2 },
  'seedbag.zucchini': { sheet: 'v3', col: 1, row: 2 },
  'sack.zucchini': { sheet: 'v3', col: 2, row: 2 },
  'crate.zucchini': { sheet: 'v3', col: 3, row: 2 },
  'tree.apple.sapling': { sheet: 'v3', col: 4, row: 2 },
  'tree.apple.young': { sheet: 'v3', col: 5, row: 2 },
  'tree.apple.spring': { sheet: 'v3', col: 6, row: 2 },
  'tree.apple.summer': { sheet: 'v3', col: 7, row: 2 },
  'tree.apple.summer.ripe': { sheet: 'v3', col: 8, row: 2 },
  'tree.apple.autumn': { sheet: 'v3', col: 9, row: 2 },
  'tree.apple.autumn.ripe': { sheet: 'v3', col: 10, row: 2 },
  'tree.apple.winter': { sheet: 'v3', col: 11, row: 2 },
  'tree.apple.dead': { sheet: 'v3', col: 12, row: 2 },
  'tree.apple.icon': { sheet: 'v3', col: 13, row: 2 },
  'animal.goat': { sheet: 'v3', col: 14, row: 2 },
  'product.jam': { sheet: 'v3', col: 15, row: 2 },
  'product.cheese': { sheet: 'v3', col: 0, row: 3 },
  'product.flour': { sheet: 'v3', col: 1, row: 3 },
  'product.bread': { sheet: 'v3', col: 2, row: 3 },
  'product.juice': { sheet: 'v3', col: 3, row: 3 },
  'product.milk.goat': { sheet: 'v3', col: 4, row: 3 },
  'icon.star': { sheet: 'v3', col: 5, row: 3 },
  'icon.trophy.bronze': { sheet: 'v3', col: 6, row: 3 },
  'icon.trophy.silver': { sheet: 'v3', col: 7, row: 3 },
  'icon.trophy.gold': { sheet: 'v3', col: 8, row: 3 },
  'icon.medal': { sheet: 'v3', col: 9, row: 3 },
  'icon.ecu': { sheet: 'v3', col: 10, row: 3 },
  'perk.seeds': { sheet: 'v3', col: 11, row: 3 },
  'perk.wateringcan': { sheet: 'v3', col: 12, row: 3 },
  'perk.coin': { sheet: 'v3', col: 13, row: 3 },
  'perk.basket': { sheet: 'v3', col: 14, row: 3 },
  'perk.compost': { sheet: 'v3', col: 15, row: 3 },
  'perk.bee': { sheet: 'v3', col: 0, row: 4 },
  'perk.barn': { sheet: 'v3', col: 1, row: 4 },
  'perk.book': { sheet: 'v3', col: 2, row: 4 },
  'perk.clover': { sheet: 'v3', col: 3, row: 4 },
  'farmer.outfit.0': { sheet: 'v3', col: 4, row: 4 },
  'farmer.outfit.0.nohat': { sheet: 'v3', col: 5, row: 4 },
  'farmer.outfit.1': { sheet: 'v3', col: 6, row: 4 },
  'farmer.outfit.1.nohat': { sheet: 'v3', col: 7, row: 4 },
  'farmer.outfit.2': { sheet: 'v3', col: 8, row: 4 },
  'farmer.outfit.2.nohat': { sheet: 'v3', col: 9, row: 4 },
  'farmer.outfit.3': { sheet: 'v3', col: 10, row: 4 },
  'farmer.outfit.3.nohat': { sheet: 'v3', col: 11, row: 4 },
  'deco.path.stone': { sheet: 'v3', col: 12, row: 4 },
  'deco.path.stone.h': { sheet: 'v3', col: 13, row: 4 },
  'deco.path.stone.v': { sheet: 'v3', col: 14, row: 4 },
  'deco.path.stone.ne': { sheet: 'v3', col: 15, row: 4 },
  'deco.path.stone.nw': { sheet: 'v3', col: 0, row: 5 },
  'deco.path.stone.se': { sheet: 'v3', col: 1, row: 5 },
  'deco.path.stone.sw': { sheet: 'v3', col: 2, row: 5 },
  'deco.path.stone.single': { sheet: 'v3', col: 3, row: 5 },
  'deco.flowerbed.red': { sheet: 'v3', col: 4, row: 5 },
  'deco.flowerbed.yellow': { sheet: 'v3', col: 5, row: 5 },
  'deco.flowerbed.blue': { sheet: 'v3', col: 6, row: 5 },
  'deco.flowerbed.pink': { sheet: 'v3', col: 7, row: 5 },
  'deco.flowerbed.white': { sheet: 'v3', col: 8, row: 5 },
  'deco.bench': { sheet: 'v3', col: 9, row: 5 },
  'deco.lamppost': { sheet: 'v3', col: 10, row: 5, w: 1, h: 2 },
  'deco.scarecrow': { sheet: 'v3', col: 11, row: 5, w: 1, h: 2 },
  'deco.wheelbarrow': { sheet: 'v3', col: 12, row: 5 },
  'deco.pond': { sheet: 'v3', col: 13, row: 5, w: 2, h: 2 },
  'deco.birdhouse': { sheet: 'v3', col: 15, row: 5, w: 1, h: 2 },
  'deco.gnome': { sheet: 'v3', col: 0, row: 6 },
  'deco.mailbox': { sheet: 'v3', col: 1, row: 6 },
  'deco.sign.farm': { sheet: 'v3', col: 2, row: 6, w: 2, h: 1 },
  'deco.slot': { sheet: 'v3', col: 4, row: 6 },
  'deco.hedge': { sheet: 'v3', col: 5, row: 6 },
  'deco.hedge.h.left': { sheet: 'v3', col: 6, row: 6 },
  'deco.hedge.h.mid': { sheet: 'v3', col: 7, row: 6 },
  'deco.hedge.h.right': { sheet: 'v3', col: 8, row: 6 },
  'deco.hedge.v.top': { sheet: 'v3', col: 9, row: 6 },
  'deco.hedge.v.mid': { sheet: 'v3', col: 12, row: 6 },
  'deco.hedge.v.bottom': { sheet: 'v3', col: 0, row: 7 },
  'deco.fence.picket.tl': { sheet: 'v3', col: 1, row: 7 },
  'deco.fence.picket.t': { sheet: 'v3', col: 2, row: 7 },
  'deco.fence.picket.tr': { sheet: 'v3', col: 3, row: 7 },
  'deco.fence.picket.l': { sheet: 'v3', col: 4, row: 7 },
  'deco.fence.picket.r': { sheet: 'v3', col: 5, row: 7 },
  'deco.fence.picket.bl': { sheet: 'v3', col: 6, row: 7 },
  'deco.fence.picket.gate': { sheet: 'v3', col: 7, row: 7 },
  'deco.fence.picket.br': { sheet: 'v3', col: 8, row: 7 },
  'deco.fence.picket.v.top': { sheet: 'v3', col: 9, row: 7 },
  'deco.fence.picket.v.mid': { sheet: 'v3', col: 10, row: 7 },
  'deco.fence.picket.v.bottom': { sheet: 'v3', col: 11, row: 7 },
  'deco.fence.picket.h.left': { sheet: 'v3', col: 12, row: 7 },
  'deco.fence.picket.h.mid': { sheet: 'v3', col: 13, row: 7 },
  'deco.fence.picket.h.right': { sheet: 'v3', col: 14, row: 7 },
  'deco.wall.stone.tl': { sheet: 'v3', col: 15, row: 7 },
  'deco.wall.stone.t': { sheet: 'v3', col: 0, row: 8 },
  'deco.wall.stone.tr': { sheet: 'v3', col: 1, row: 8 },
  'deco.wall.stone.l': { sheet: 'v3', col: 2, row: 8 },
  'deco.wall.stone.r': { sheet: 'v3', col: 3, row: 8 },
  'deco.wall.stone.bl': { sheet: 'v3', col: 4, row: 8 },
  'deco.wall.stone.b': { sheet: 'v3', col: 5, row: 8 },
  'deco.wall.stone.br': { sheet: 'v3', col: 6, row: 8 },
  'deco.wall.stone.v.top': { sheet: 'v3', col: 7, row: 8 },
  'deco.wall.stone.v.mid': { sheet: 'v3', col: 8, row: 8 },
  'deco.wall.stone.v.bottom': { sheet: 'v3', col: 9, row: 8 },
  'deco.wall.stone.h.left': { sheet: 'v3', col: 10, row: 8 },
  'deco.wall.stone.h.mid': { sheet: 'v3', col: 11, row: 8 },
  'deco.wall.stone.h.right': { sheet: 'v3', col: 12, row: 8 },
  'deco.wall.stone.single': { sheet: 'v3', col: 13, row: 8 },
  'deco.wall.stone.gate': { sheet: 'v3', col: 14, row: 8 },
  'part.sign.jam': { sheet: 'v3', col: 15, row: 8 },
  'part.sign.cheese': { sheet: 'v3', col: 0, row: 9 },
  'part.sign.bread': { sheet: 'v3', col: 1, row: 9 },
  'part.awning': { sheet: 'v3', col: 2, row: 9 },
  'part.wall.white.l': { sheet: 'v3', col: 3, row: 9 },
  'part.wall.white.c': { sheet: 'v3', col: 4, row: 9 },
  'part.wall.white.r': { sheet: 'v3', col: 5, row: 9 },
  'part.wall.white.window': { sheet: 'v3', col: 6, row: 9 },
  'part.wall.white.door': { sheet: 'v3', col: 7, row: 9 },
  'part.roof.slate.white.l': { sheet: 'v3', col: 8, row: 9 },
  'part.roof.slate.white.c': { sheet: 'v3', col: 9, row: 9 },
  'part.roof.slate.white.r': { sheet: 'v3', col: 10, row: 9 },
  'part.roof.slate.white.gable': { sheet: 'v3', col: 11, row: 9 },
  'building.windmill.body': { sheet: 'v3', col: 12, row: 9, w: 3, h: 4 },
  'building.windmill.sails.0': { sheet: 'v3', col: 0, row: 10, w: 3, h: 4 },
  'building.windmill.sails.1': { sheet: 'v3', col: 3, row: 10, w: 3, h: 4 },
  'building.windmill.sails.2': { sheet: 'v3', col: 6, row: 10, w: 3, h: 4 },
  'building.windmill.sails.3': { sheet: 'v3', col: 9, row: 10, w: 3, h: 4 },
  'building.bakery': { sheet: 'v3', col: 12, row: 13, w: 2, h: 2 },
  'building.jamworkshop': { w: 3, h: 3, layers: [
    { sheet: 'town', col: 4, row: 4, dx: 0, dy: 0 },
    { sheet: 'town', col: 5, row: 4, dx: 1, dy: 0 },
    { sheet: 'town', col: 6, row: 4, dx: 2, dy: 0 },
    { sheet: 'town', col: 4, row: 5, dx: 0, dy: 1 },
    { sheet: 'town', col: 7, row: 5, dx: 1, dy: 1 },
    { sheet: 'town', col: 6, row: 5, dx: 2, dy: 1 },
    { sheet: 'town', col: 4, row: 7, dx: 0, dy: 2 },
    { sheet: 'town', col: 5, row: 7, dx: 1, dy: 2 },
    { sheet: 'town', col: 7, row: 6, dx: 2, dy: 2 },
    { sheet: 'v3', col: 2, row: 9, dx: 0, dy: 2 },
    { sheet: 'v3', col: 15, row: 8, dx: 2, dy: 2 },
  ] },
  'building.dairy': { w: 3, h: 3, layers: [
    { sheet: 'town', col: 0, row: 4, dx: 0, dy: 0 },
    { sheet: 'town', col: 1, row: 4, dx: 1, dy: 0 },
    { sheet: 'town', col: 2, row: 4, dx: 2, dy: 0 },
    { sheet: 'v3', col: 8, row: 9, dx: 0, dy: 1 },
    { sheet: 'v3', col: 11, row: 9, dx: 1, dy: 1 },
    { sheet: 'v3', col: 10, row: 9, dx: 2, dy: 1 },
    { sheet: 'v3', col: 6, row: 9, dx: 0, dy: 2 },
    { sheet: 'v3', col: 7, row: 9, dx: 1, dy: 2 },
    { sheet: 'v3', col: 5, row: 9, dx: 2, dy: 2 },
    { sheet: 'v3', col: 0, row: 9, dx: 2, dy: 2 },
  ] },
  'building.windmill': { w: 3, h: 4, layers: [
    { sheet: 'v3', col: 12, row: 9, dx: 0, dy: 0, w: 3, h: 4 },
    { sheet: 'v3', col: 0, row: 10, dx: 0, dy: 0, w: 3, h: 4 },
  ] },
  // </v3:auto>
};

export const CROP_IDS_V3 = ['pumpkin', 'potato', 'strawberry', 'zucchini'];
for (const id of CROP_IDS_V3) v3[`crop.${id}.0`] = SEED;

/** Sprite de chaque produit transformé (le fromage de chèvre réutilise la meule). */
export const PRODUCT_SPRITES = Object.freeze({
  strawberryJam: 'product.jam',
  appleJuice: 'product.juice',
  cowCheese: 'product.cheese',
  goatCheese: 'product.cheese',
  flour: 'product.flour',
  bread: 'product.bread',
});

/** Nom du sprite d'un produit (id de src/data/products.js), avec repli. */
export function productSprite(productId) {
  return PRODUCT_SPRITES[productId] || 'crate.empty';
}

/** Décorations de la personnalisation (id de src/data/cosmetics.js) → sprite. */
export const DECOR_SPRITES = Object.freeze({
  'flowers.red': 'deco.flowerbed.red',
  'flowers.yellow': 'deco.flowerbed.yellow',
  'flowers.blue': 'deco.flowerbed.blue',
  'flowers.white': 'deco.flowerbed.white',
  'flowers.pink': 'deco.flowerbed.pink',
  bench: 'deco.bench',
  lamp: 'deco.lamppost',
  scarecrow: 'deco.scarecrow',
  wheelbarrow: 'deco.wheelbarrow',
  birdhouse: 'deco.birdhouse',
  gnome: 'deco.gnome',
  mailbox: 'deco.mailbox',
  'hedge.bush': 'deco.hedge',
  pond: 'deco.pond',
  // (lot 2) Décors trouvés à la ferme (src/data/cosmetics.js, found: true).
  'owl.carved': 'owl.carved',
  'statue.small': 'find.statue',
  // (lot 3) Décors du colporteur et de la journaliste de « Campagne & Jardins » (found: true).
  'lantern.peddler': 'lantern.peddler',
  'weathervane.rooster': 'weathervane.rooster',
  'sign.magazine': 'sign.magazine',
  // (lot 4) Décors « trouvés dans l'album » et lanternes des critères (found: true, sans effet).
  'scarecrow.flower': 'decor.scarecrow.flower',
  'can.golden': 'decor.can.golden',
  'barrow.giant': 'decor.barrow.giant',
  'jam.shelf': 'decor.jam.shelf',
  'weathervane.pig': 'decor.weathervane.pig',
  sundial: 'decor.sundial',
  'lantern.fairy': 'decor.lantern.fairy',
  'pump.village': 'decor.pump.village',
  'bunting.post': 'decor.bunting.post',
  'arch.fete': 'decor.arch.fete',
  woodpile: 'decor.woodpile',
  'heron.wood': 'decor.heron.wood',
  'rocking.chair': 'decor.rocking.chair',
  herbarium: 'decor.herbarium',
  'lantern.green': 'decor.lantern.green',
  'lantern.blue': 'decor.lantern.blue',
  'lantern.pink': 'decor.lantern.pink',
  'lantern.yellow': 'decor.lantern.yellow',
  'lantern.orange': 'decor.lantern.orange',
  'lantern.grand': 'decor.lantern.grand',
  // (Vallée vivante, lot V1) Décors trouvés : pages d'album de la Vallée, étape 5 « La vallée chante » (planche valley1).
  'seed.cabinet': 'decor.seed.cabinet',
  'nestbox.painted': 'decor.nestbox.painted',
  'valley.linden': 'decor.valley.linden',
  // (Vallée vivante, lot V2) Décors trouvés : pages d'album « Le troc du village », « Les variétés de la ferme »,
  // « Les habitants (suite) » (planche valley2).
  'swap.basket': 'decor.swap.basket',
  'cross.sign': 'decor.cross.sign',
  'lizard.wall': 'decor.lizard.wall',
  // (Vallée vivante, lot V3) Décors trouvés : pages « Le carnet d'Hélène » et « Les lieux de la vallée », étape 7
  // « La vallée vivante » (planche valley3).
  'heron.vane': 'decor.heron.vane',
  'mill.wheel': 'decor.mill.wheel',
  'valley.bench': 'decor.valley.bench',
});

/** Sprite d'une décoration (accepte aussi « decor.<id> » ou un nom de sprite « deco.* »), ou null. */
export function decorSprite(itemId) {
  if (!itemId) return null;
  const id = String(itemId).replace(/^decor\./, '');
  if (DECOR_SPRITES[id]) return DECOR_SPRITES[id];
  if (SPRITES[id]) return id;
  if (SPRITES[`deco.${id}`]) return `deco.${id}`;
  return null;
}

/** Tenue du fermier (id de src/data/cosmetics.js) → indice de sprite farmer.outfit.N. */
const OUTFIT_INDEX = { 'outfit.classic': 0, 'outfit.checked': 1, 'outfit.raincoat': 2, 'outfit.blue': 2, 'outfit.gardener': 3 };
export const OUTFIT_COUNT = 4;
export function outfitSprite(outfitId, nohat = false) {
  let i = OUTFIT_INDEX[outfitId];
  if (i === undefined) {
    const m = /(\d+)$/.exec(String(outfitId ?? ''));
    i = m ? Math.min(OUTFIT_COUNT - 1, Number(m[1])) : 0;
  }
  return `farmer.outfit.${i}${nohat ? '.nohat' : ''}`;
}

/** Zone (pixels du sprite 32 × 16) où écrire le nom de la ferme sur 'deco.sign.farm'. */
export const FARM_SIGN_TEXT_RECT = Object.freeze({ x: 3, y: 3, w: 26, h: 6 });
/**
 * Panneau de la ferme de la scène : la planche 'deco.sign.farm' élargie à 3 tuiles (48 × 16, milieu
 * répété) pour que le nom se lise sur téléphone. Zone de texte correspondante (pixels du panneau).
 */
export const FARM_SIGN_WIDE_W = 48;
export const FARM_SIGN_WIDE_TEXT_RECT = Object.freeze({ x: 2, y: 2, w: 44, h: 7 });

/**
 * Dessine le panneau élargi : moitié gauche du sprite, colonne du milieu répétée, moitié droite.
 * @param images  planches (d'origine ou d'une saison)
 */
export function drawWideFarmSign(ctx, images, dx, dy) {
  const r = spriteRect('deco.sign.farm');
  const img = images[r.sheet];
  const extra = FARM_SIGN_WIDE_W - r.w;
  ctx.drawImage(img, r.x, r.y, 16, 16, dx, dy, 16, 16);
  for (let i = 0; i < extra; i++) ctx.drawImage(img, r.x + 15, r.y, 1, 16, dx + 16 + i, dy, 1, 16);
  ctx.drawImage(img, r.x + 16, r.y, r.w - 16, 16, dx + 16 + extra, dy, r.w - 16, 16);
}
/** Centre des ailes du moulin (pixels du sprite 48 × 64). */
export const WINDMILL_HUB = Object.freeze({ x: 24, y: 20 });
export const WINDMILL_FRAMES = 4;

/**
 * Sprite du pommier.
 * @param stage   0..4 (0–1 jeune plant, 2 jeune arbre, 3–4 arbre adulte)
 * @param season  'spring' | 'summer' | 'autumn' | 'winter'
 * @param ripe    pommes prêtes à cueillir (été / automne seulement)
 */
export function treeSprite(stage, season = 'summer', ripe = false) {
  if (stage === 'dead') return 'tree.apple.dead';
  if (stage <= 1) return 'tree.apple.sapling';
  if (stage === 2) return 'tree.apple.young';
  if (season === 'spring') return 'tree.apple.spring';
  if (season === 'winter') return 'tree.apple.winter';
  if (season === 'autumn') return ripe ? 'tree.apple.autumn.ripe' : 'tree.apple.autumn';
  return ripe || stage >= 4 ? 'tree.apple.summer.ripe' : 'tree.apple.summer';
}

// ---------------------------------------------------------------------------
// Contenu du mode Carrière (planche « career »). Noms : docs/CARRIERE.md § 11 et
// assets/sprites/generate-career.py. Animaux : regard vers la DROITE comme ceux de Kenney (flipX pour
// la gauche) ; tracteur : « .l » regarde à gauche, « .r » à droite. Employés : staffSprite(look, pose),
// portraits : staffPortrait(look) ; joueuse : playerSprite(outfitId, { female: true }).
// <career:auto>
  // Généré par assets/sprites/generate-career.py — ne pas modifier à la main.
const career = {
  'staff.m010': { sheet: 'career', col: 31, row: 9 },
  'staff.m010.walk': { sheet: 'career', col: 29, row: 16 },
  'staff.m010.walk2': { sheet: 'career', col: 8, row: 17 },
  'staff.m010.work': { sheet: 'career', col: 31, row: 17 },
  'staff.m011': { sheet: 'career', col: 28, row: 18 },
  'staff.m011.walk': { sheet: 'career', col: 31, row: 18 },
  'staff.m011.walk2': { sheet: 'career', col: 7, row: 27 },
  'staff.m011.work': { sheet: 'career', col: 6, row: 28 },
  'staff.m012': { sheet: 'career', col: 7, row: 28 },
  'staff.m012.walk': { sheet: 'career', col: 8, row: 28 },
  'staff.m012.walk2': { sheet: 'career', col: 9, row: 28 },
  'staff.m012.work': { sheet: 'career', col: 10, row: 28 },
  'staff.m013': { sheet: 'career', col: 11, row: 28 },
  'staff.m013.walk': { sheet: 'career', col: 12, row: 28 },
  'staff.m013.walk2': { sheet: 'career', col: 13, row: 28 },
  'staff.m013.work': { sheet: 'career', col: 14, row: 28 },
  'staff.m000': { sheet: 'career', col: 15, row: 28 },
  'staff.m000.walk': { sheet: 'career', col: 16, row: 28 },
  'staff.m000.walk2': { sheet: 'career', col: 17, row: 28 },
  'staff.m000.work': { sheet: 'career', col: 18, row: 28 },
  'staff.m001': { sheet: 'career', col: 19, row: 28 },
  'staff.m001.walk': { sheet: 'career', col: 20, row: 28 },
  'staff.m001.walk2': { sheet: 'career', col: 21, row: 28 },
  'staff.m001.work': { sheet: 'career', col: 22, row: 28 },
  'staff.m002': { sheet: 'career', col: 23, row: 28 },
  'staff.m002.walk': { sheet: 'career', col: 24, row: 28 },
  'staff.m002.walk2': { sheet: 'career', col: 25, row: 28 },
  'staff.m002.work': { sheet: 'career', col: 26, row: 28 },
  'staff.m003': { sheet: 'career', col: 27, row: 28 },
  'staff.m003.walk': { sheet: 'career', col: 28, row: 28 },
  'staff.m003.walk2': { sheet: 'career', col: 29, row: 28 },
  'staff.m003.work': { sheet: 'career', col: 30, row: 28 },
  'staff.m110': { sheet: 'career', col: 31, row: 28 },
  'staff.m110.walk': { sheet: 'career', col: 0, row: 29 },
  'staff.m110.walk2': { sheet: 'career', col: 1, row: 29 },
  'staff.m110.work': { sheet: 'career', col: 2, row: 29 },
  'staff.m111': { sheet: 'career', col: 3, row: 29 },
  'staff.m111.walk': { sheet: 'career', col: 4, row: 29 },
  'staff.m111.walk2': { sheet: 'career', col: 5, row: 29 },
  'staff.m111.work': { sheet: 'career', col: 6, row: 29 },
  'staff.m112': { sheet: 'career', col: 7, row: 29 },
  'staff.m112.walk': { sheet: 'career', col: 8, row: 29 },
  'staff.m112.walk2': { sheet: 'career', col: 9, row: 29 },
  'staff.m112.work': { sheet: 'career', col: 10, row: 29 },
  'staff.m113': { sheet: 'career', col: 11, row: 29 },
  'staff.m113.walk': { sheet: 'career', col: 12, row: 29 },
  'staff.m113.walk2': { sheet: 'career', col: 13, row: 29 },
  'staff.m113.work': { sheet: 'career', col: 14, row: 29 },
  'staff.m100': { sheet: 'career', col: 15, row: 29 },
  'staff.m100.walk': { sheet: 'career', col: 16, row: 29 },
  'staff.m100.walk2': { sheet: 'career', col: 17, row: 29 },
  'staff.m100.work': { sheet: 'career', col: 18, row: 29 },
  'staff.m101': { sheet: 'career', col: 19, row: 29 },
  'staff.m101.walk': { sheet: 'career', col: 20, row: 29 },
  'staff.m101.walk2': { sheet: 'career', col: 21, row: 29 },
  'staff.m101.work': { sheet: 'career', col: 22, row: 29 },
  'staff.m102': { sheet: 'career', col: 23, row: 29 },
  'staff.m102.walk': { sheet: 'career', col: 24, row: 29 },
  'staff.m102.walk2': { sheet: 'career', col: 25, row: 29 },
  'staff.m102.work': { sheet: 'career', col: 26, row: 29 },
  'staff.m103': { sheet: 'career', col: 27, row: 29 },
  'staff.m103.walk': { sheet: 'career', col: 28, row: 29 },
  'staff.m103.walk2': { sheet: 'career', col: 29, row: 29 },
  'staff.m103.work': { sheet: 'career', col: 30, row: 29 },
  'staff.m210': { sheet: 'career', col: 31, row: 29 },
  'staff.m210.walk': { sheet: 'career', col: 0, row: 30 },
  'staff.m210.walk2': { sheet: 'career', col: 1, row: 30 },
  'staff.m210.work': { sheet: 'career', col: 2, row: 30 },
  'staff.m211': { sheet: 'career', col: 3, row: 30 },
  'staff.m211.walk': { sheet: 'career', col: 4, row: 30 },
  'staff.m211.walk2': { sheet: 'career', col: 5, row: 30 },
  'staff.m211.work': { sheet: 'career', col: 6, row: 30 },
  'staff.m212': { sheet: 'career', col: 7, row: 30 },
  'staff.m212.walk': { sheet: 'career', col: 8, row: 30 },
  'staff.m212.walk2': { sheet: 'career', col: 9, row: 30 },
  'staff.m212.work': { sheet: 'career', col: 10, row: 30 },
  'staff.m213': { sheet: 'career', col: 11, row: 30 },
  'staff.m213.walk': { sheet: 'career', col: 12, row: 30 },
  'staff.m213.walk2': { sheet: 'career', col: 13, row: 30 },
  'staff.m213.work': { sheet: 'career', col: 14, row: 30 },
  'staff.m200': { sheet: 'career', col: 15, row: 30 },
  'staff.m200.walk': { sheet: 'career', col: 16, row: 30 },
  'staff.m200.walk2': { sheet: 'career', col: 17, row: 30 },
  'staff.m200.work': { sheet: 'career', col: 18, row: 30 },
  'staff.m201': { sheet: 'career', col: 19, row: 30 },
  'staff.m201.walk': { sheet: 'career', col: 20, row: 30 },
  'staff.m201.walk2': { sheet: 'career', col: 21, row: 30 },
  'staff.m201.work': { sheet: 'career', col: 22, row: 30 },
  'staff.m202': { sheet: 'career', col: 23, row: 30 },
  'staff.m202.walk': { sheet: 'career', col: 24, row: 30 },
  'staff.m202.walk2': { sheet: 'career', col: 25, row: 30 },
  'staff.m202.work': { sheet: 'career', col: 26, row: 30 },
  'staff.m203': { sheet: 'career', col: 27, row: 30 },
  'staff.m203.walk': { sheet: 'career', col: 28, row: 30 },
  'staff.m203.walk2': { sheet: 'career', col: 29, row: 30 },
  'staff.m203.work': { sheet: 'career', col: 30, row: 30 },
  'staff.m310': { sheet: 'career', col: 31, row: 30 },
  'staff.m310.walk': { sheet: 'career', col: 0, row: 31 },
  'staff.m310.walk2': { sheet: 'career', col: 1, row: 31 },
  'staff.m310.work': { sheet: 'career', col: 2, row: 31 },
  'staff.m311': { sheet: 'career', col: 3, row: 31 },
  'staff.m311.walk': { sheet: 'career', col: 4, row: 31 },
  'staff.m311.walk2': { sheet: 'career', col: 5, row: 31 },
  'staff.m311.work': { sheet: 'career', col: 6, row: 31 },
  'staff.m312': { sheet: 'career', col: 7, row: 31 },
  'staff.m312.walk': { sheet: 'career', col: 8, row: 31 },
  'staff.m312.walk2': { sheet: 'career', col: 9, row: 31 },
  'staff.m312.work': { sheet: 'career', col: 10, row: 31 },
  'staff.m313': { sheet: 'career', col: 11, row: 31 },
  'staff.m313.walk': { sheet: 'career', col: 12, row: 31 },
  'staff.m313.walk2': { sheet: 'career', col: 13, row: 31 },
  'staff.m313.work': { sheet: 'career', col: 14, row: 31 },
  'staff.m300': { sheet: 'career', col: 15, row: 31 },
  'staff.m300.walk': { sheet: 'career', col: 16, row: 31 },
  'staff.m300.walk2': { sheet: 'career', col: 17, row: 31 },
  'staff.m300.work': { sheet: 'career', col: 18, row: 31 },
  'staff.m301': { sheet: 'career', col: 19, row: 31 },
  'staff.m301.walk': { sheet: 'career', col: 20, row: 31 },
  'staff.m301.walk2': { sheet: 'career', col: 21, row: 31 },
  'staff.m301.work': { sheet: 'career', col: 22, row: 31 },
  'staff.m302': { sheet: 'career', col: 23, row: 31 },
  'staff.m302.walk': { sheet: 'career', col: 24, row: 31 },
  'staff.m302.walk2': { sheet: 'career', col: 25, row: 31 },
  'staff.m302.work': { sheet: 'career', col: 26, row: 31 },
  'staff.m303': { sheet: 'career', col: 27, row: 31 },
  'staff.m303.walk': { sheet: 'career', col: 28, row: 31 },
  'staff.m303.walk2': { sheet: 'career', col: 29, row: 31 },
  'staff.m303.work': { sheet: 'career', col: 30, row: 31 },
  'staff.f010': { sheet: 'career', col: 31, row: 31 },
  'staff.f010.walk': { sheet: 'career', col: 0, row: 32 },
  'staff.f010.walk2': { sheet: 'career', col: 1, row: 32 },
  'staff.f010.work': { sheet: 'career', col: 2, row: 32 },
  'staff.f011': { sheet: 'career', col: 3, row: 32 },
  'staff.f011.walk': { sheet: 'career', col: 4, row: 32 },
  'staff.f011.walk2': { sheet: 'career', col: 5, row: 32 },
  'staff.f011.work': { sheet: 'career', col: 6, row: 32 },
  'staff.f012': { sheet: 'career', col: 7, row: 32 },
  'staff.f012.walk': { sheet: 'career', col: 8, row: 32 },
  'staff.f012.walk2': { sheet: 'career', col: 9, row: 32 },
  'staff.f012.work': { sheet: 'career', col: 10, row: 32 },
  'staff.f013': { sheet: 'career', col: 11, row: 32 },
  'staff.f013.walk': { sheet: 'career', col: 12, row: 32 },
  'staff.f013.walk2': { sheet: 'career', col: 13, row: 32 },
  'staff.f013.work': { sheet: 'career', col: 14, row: 32 },
  'staff.f000': { sheet: 'career', col: 15, row: 32 },
  'staff.f000.walk': { sheet: 'career', col: 16, row: 32 },
  'staff.f000.walk2': { sheet: 'career', col: 17, row: 32 },
  'staff.f000.work': { sheet: 'career', col: 18, row: 32 },
  'staff.f001': { sheet: 'career', col: 19, row: 32 },
  'staff.f001.walk': { sheet: 'career', col: 20, row: 32 },
  'staff.f001.walk2': { sheet: 'career', col: 21, row: 32 },
  'staff.f001.work': { sheet: 'career', col: 22, row: 32 },
  'staff.f002': { sheet: 'career', col: 23, row: 32 },
  'staff.f002.walk': { sheet: 'career', col: 24, row: 32 },
  'staff.f002.walk2': { sheet: 'career', col: 25, row: 32 },
  'staff.f002.work': { sheet: 'career', col: 26, row: 32 },
  'staff.f003': { sheet: 'career', col: 27, row: 32 },
  'staff.f003.walk': { sheet: 'career', col: 28, row: 32 },
  'staff.f003.walk2': { sheet: 'career', col: 29, row: 32 },
  'staff.f003.work': { sheet: 'career', col: 30, row: 32 },
  'staff.f110': { sheet: 'career', col: 31, row: 32 },
  'staff.f110.walk': { sheet: 'career', col: 0, row: 33 },
  'staff.f110.walk2': { sheet: 'career', col: 1, row: 33 },
  'staff.f110.work': { sheet: 'career', col: 2, row: 33 },
  'staff.f111': { sheet: 'career', col: 3, row: 33 },
  'staff.f111.walk': { sheet: 'career', col: 4, row: 33 },
  'staff.f111.walk2': { sheet: 'career', col: 5, row: 33 },
  'staff.f111.work': { sheet: 'career', col: 6, row: 33 },
  'staff.f112': { sheet: 'career', col: 7, row: 33 },
  'staff.f112.walk': { sheet: 'career', col: 8, row: 33 },
  'staff.f112.walk2': { sheet: 'career', col: 9, row: 33 },
  'staff.f112.work': { sheet: 'career', col: 10, row: 33 },
  'staff.f113': { sheet: 'career', col: 11, row: 33 },
  'staff.f113.walk': { sheet: 'career', col: 12, row: 33 },
  'staff.f113.walk2': { sheet: 'career', col: 13, row: 33 },
  'staff.f113.work': { sheet: 'career', col: 14, row: 33 },
  'staff.f100': { sheet: 'career', col: 15, row: 33 },
  'staff.f100.walk': { sheet: 'career', col: 16, row: 33 },
  'staff.f100.walk2': { sheet: 'career', col: 17, row: 33 },
  'staff.f100.work': { sheet: 'career', col: 18, row: 33 },
  'staff.f101': { sheet: 'career', col: 19, row: 33 },
  'staff.f101.walk': { sheet: 'career', col: 20, row: 33 },
  'staff.f101.walk2': { sheet: 'career', col: 21, row: 33 },
  'staff.f101.work': { sheet: 'career', col: 22, row: 33 },
  'staff.f102': { sheet: 'career', col: 23, row: 33 },
  'staff.f102.walk': { sheet: 'career', col: 24, row: 33 },
  'staff.f102.walk2': { sheet: 'career', col: 25, row: 33 },
  'staff.f102.work': { sheet: 'career', col: 26, row: 33 },
  'staff.f103': { sheet: 'career', col: 27, row: 33 },
  'staff.f103.walk': { sheet: 'career', col: 28, row: 33 },
  'staff.f103.walk2': { sheet: 'career', col: 29, row: 33 },
  'staff.f103.work': { sheet: 'career', col: 30, row: 33 },
  'staff.f210': { sheet: 'career', col: 31, row: 33 },
  'staff.f210.walk': { sheet: 'career', col: 0, row: 34 },
  'staff.f210.walk2': { sheet: 'career', col: 1, row: 34 },
  'staff.f210.work': { sheet: 'career', col: 2, row: 34 },
  'staff.f211': { sheet: 'career', col: 3, row: 34 },
  'staff.f211.walk': { sheet: 'career', col: 4, row: 34 },
  'staff.f211.walk2': { sheet: 'career', col: 5, row: 34 },
  'staff.f211.work': { sheet: 'career', col: 6, row: 34 },
  'staff.f212': { sheet: 'career', col: 7, row: 34 },
  'staff.f212.walk': { sheet: 'career', col: 8, row: 34 },
  'staff.f212.walk2': { sheet: 'career', col: 9, row: 34 },
  'staff.f212.work': { sheet: 'career', col: 10, row: 34 },
  'staff.f213': { sheet: 'career', col: 11, row: 34 },
  'staff.f213.walk': { sheet: 'career', col: 12, row: 34 },
  'staff.f213.walk2': { sheet: 'career', col: 13, row: 34 },
  'staff.f213.work': { sheet: 'career', col: 14, row: 34 },
  'staff.f200': { sheet: 'career', col: 15, row: 34 },
  'staff.f200.walk': { sheet: 'career', col: 16, row: 34 },
  'staff.f200.walk2': { sheet: 'career', col: 17, row: 34 },
  'staff.f200.work': { sheet: 'career', col: 18, row: 34 },
  'staff.f201': { sheet: 'career', col: 19, row: 34 },
  'staff.f201.walk': { sheet: 'career', col: 20, row: 34 },
  'staff.f201.walk2': { sheet: 'career', col: 21, row: 34 },
  'staff.f201.work': { sheet: 'career', col: 22, row: 34 },
  'staff.f202': { sheet: 'career', col: 23, row: 34 },
  'staff.f202.walk': { sheet: 'career', col: 24, row: 34 },
  'staff.f202.walk2': { sheet: 'career', col: 25, row: 34 },
  'staff.f202.work': { sheet: 'career', col: 26, row: 34 },
  'staff.f203': { sheet: 'career', col: 27, row: 34 },
  'staff.f203.walk': { sheet: 'career', col: 28, row: 34 },
  'staff.f203.walk2': { sheet: 'career', col: 29, row: 34 },
  'staff.f203.work': { sheet: 'career', col: 30, row: 34 },
  'staff.f310': { sheet: 'career', col: 31, row: 34 },
  'staff.f310.walk': { sheet: 'career', col: 0, row: 35 },
  'staff.f310.walk2': { sheet: 'career', col: 1, row: 35 },
  'staff.f310.work': { sheet: 'career', col: 2, row: 35 },
  'staff.f311': { sheet: 'career', col: 3, row: 35 },
  'staff.f311.walk': { sheet: 'career', col: 4, row: 35 },
  'staff.f311.walk2': { sheet: 'career', col: 5, row: 35 },
  'staff.f311.work': { sheet: 'career', col: 6, row: 35 },
  'staff.f312': { sheet: 'career', col: 7, row: 35 },
  'staff.f312.walk': { sheet: 'career', col: 8, row: 35 },
  'staff.f312.walk2': { sheet: 'career', col: 9, row: 35 },
  'staff.f312.work': { sheet: 'career', col: 10, row: 35 },
  'staff.f313': { sheet: 'career', col: 11, row: 35 },
  'staff.f313.walk': { sheet: 'career', col: 12, row: 35 },
  'staff.f313.walk2': { sheet: 'career', col: 13, row: 35 },
  'staff.f313.work': { sheet: 'career', col: 14, row: 35 },
  'staff.f300': { sheet: 'career', col: 15, row: 35 },
  'staff.f300.walk': { sheet: 'career', col: 16, row: 35 },
  'staff.f300.walk2': { sheet: 'career', col: 17, row: 35 },
  'staff.f300.work': { sheet: 'career', col: 18, row: 35 },
  'staff.f301': { sheet: 'career', col: 19, row: 35 },
  'staff.f301.walk': { sheet: 'career', col: 20, row: 35 },
  'staff.f301.walk2': { sheet: 'career', col: 21, row: 35 },
  'staff.f301.work': { sheet: 'career', col: 22, row: 35 },
  'staff.f302': { sheet: 'career', col: 23, row: 35 },
  'staff.f302.walk': { sheet: 'career', col: 24, row: 35 },
  'staff.f302.walk2': { sheet: 'career', col: 25, row: 35 },
  'staff.f302.work': { sheet: 'career', col: 26, row: 35 },
  'staff.f303': { sheet: 'career', col: 27, row: 35 },
  'staff.f303.walk': { sheet: 'career', col: 28, row: 35 },
  'staff.f303.walk2': { sheet: 'career', col: 29, row: 35 },
  'staff.f303.work': { sheet: 'career', col: 30, row: 35 },
  'farmer.fermiere.outfit.0': { sheet: 'career', col: 31, row: 35 },
  'farmer.fermiere.outfit.0.nohat': { sheet: 'career', col: 0, row: 36 },
  'farmer.fermiere.outfit.1': { sheet: 'career', col: 1, row: 36 },
  'farmer.fermiere.outfit.1.nohat': { sheet: 'career', col: 2, row: 36 },
  'farmer.fermiere.outfit.2': { sheet: 'career', col: 3, row: 36 },
  'farmer.fermiere.outfit.2.nohat': { sheet: 'career', col: 4, row: 36 },
  'farmer.fermiere.outfit.3': { sheet: 'career', col: 5, row: 36 },
  'farmer.fermiere.outfit.3.nohat': { sheet: 'career', col: 6, row: 36 },
  'tool.can': { sheet: 'career', col: 7, row: 36 },
  'tool.can.work': { sheet: 'career', col: 8, row: 36 },
  'tool.basket': { sheet: 'career', col: 9, row: 36 },
  'tool.basket.work': { sheet: 'career', col: 10, row: 36 },
  'tool.seedbag': { sheet: 'career', col: 11, row: 36 },
  'tool.seedbag.work': { sheet: 'career', col: 12, row: 36 },
  'tool.pail': { sheet: 'career', col: 13, row: 36 },
  'tool.pail.work': { sheet: 'career', col: 14, row: 36 },
  'tool.hoe.carry': { sheet: 'career', col: 15, row: 36 },
  'tool.hoe.work': { sheet: 'career', col: 16, row: 36 },
  'npc.joseph': { sheet: 'career', col: 17, row: 36 },
  'npc.joseph.walk': { sheet: 'career', col: 18, row: 36 },
  'npc.joseph.walk2': { sheet: 'career', col: 19, row: 36 },
  'npc.visitor.1': { sheet: 'career', col: 20, row: 36 },
  'npc.visitor.1.walk': { sheet: 'career', col: 21, row: 36 },
  'npc.visitor.2': { sheet: 'career', col: 22, row: 36 },
  'npc.visitor.2.walk': { sheet: 'career', col: 23, row: 36 },
  'npc.visitor.3': { sheet: 'career', col: 24, row: 36 },
  'npc.visitor.3.walk': { sheet: 'career', col: 25, row: 36 },
  'portrait.staff.m010': { sheet: 'career', col: 24, row: 11, w: 2, h: 2 },
  'portrait.staff.m011': { sheet: 'career', col: 21, row: 16, w: 2, h: 2 },
  'portrait.staff.m012': { sheet: 'career', col: 23, row: 16, w: 2, h: 2 },
  'portrait.staff.m013': { sheet: 'career', col: 25, row: 16, w: 2, h: 2 },
  'portrait.staff.m000': { sheet: 'career', col: 27, row: 16, w: 2, h: 2 },
  'portrait.staff.m001': { sheet: 'career', col: 0, row: 17, w: 2, h: 2 },
  'portrait.staff.m002': { sheet: 'career', col: 2, row: 17, w: 2, h: 2 },
  'portrait.staff.m003': { sheet: 'career', col: 4, row: 17, w: 2, h: 2 },
  'portrait.staff.m110': { sheet: 'career', col: 6, row: 17, w: 2, h: 2 },
  'portrait.staff.m111': { sheet: 'career', col: 29, row: 17, w: 2, h: 2 },
  'portrait.staff.m112': { sheet: 'career', col: 8, row: 18, w: 2, h: 2 },
  'portrait.staff.m113': { sheet: 'career', col: 10, row: 18, w: 2, h: 2 },
  'portrait.staff.m100': { sheet: 'career', col: 12, row: 18, w: 2, h: 2 },
  'portrait.staff.m101': { sheet: 'career', col: 14, row: 18, w: 2, h: 2 },
  'portrait.staff.m102': { sheet: 'career', col: 16, row: 18, w: 2, h: 2 },
  'portrait.staff.m103': { sheet: 'career', col: 18, row: 18, w: 2, h: 2 },
  'portrait.staff.m210': { sheet: 'career', col: 20, row: 18, w: 2, h: 2 },
  'portrait.staff.m211': { sheet: 'career', col: 22, row: 18, w: 2, h: 2 },
  'portrait.staff.m212': { sheet: 'career', col: 24, row: 18, w: 2, h: 2 },
  'portrait.staff.m213': { sheet: 'career', col: 26, row: 18, w: 2, h: 2 },
  'portrait.staff.m200': { sheet: 'career', col: 0, row: 19, w: 2, h: 2 },
  'portrait.staff.m201': { sheet: 'career', col: 2, row: 19, w: 2, h: 2 },
  'portrait.staff.m202': { sheet: 'career', col: 4, row: 19, w: 2, h: 2 },
  'portrait.staff.m203': { sheet: 'career', col: 6, row: 19, w: 2, h: 2 },
  'portrait.staff.m310': { sheet: 'career', col: 28, row: 19, w: 2, h: 2 },
  'portrait.staff.m311': { sheet: 'career', col: 30, row: 19, w: 2, h: 2 },
  'portrait.staff.m312': { sheet: 'career', col: 8, row: 20, w: 2, h: 2 },
  'portrait.staff.m313': { sheet: 'career', col: 10, row: 20, w: 2, h: 2 },
  'portrait.staff.m300': { sheet: 'career', col: 12, row: 20, w: 2, h: 2 },
  'portrait.staff.m301': { sheet: 'career', col: 14, row: 20, w: 2, h: 2 },
  'portrait.staff.m302': { sheet: 'career', col: 16, row: 20, w: 2, h: 2 },
  'portrait.staff.m303': { sheet: 'career', col: 18, row: 20, w: 2, h: 2 },
  'portrait.staff.f010': { sheet: 'career', col: 20, row: 20, w: 2, h: 2 },
  'portrait.staff.f011': { sheet: 'career', col: 22, row: 20, w: 2, h: 2 },
  'portrait.staff.f012': { sheet: 'career', col: 24, row: 20, w: 2, h: 2 },
  'portrait.staff.f013': { sheet: 'career', col: 26, row: 20, w: 2, h: 2 },
  'portrait.staff.f000': { sheet: 'career', col: 0, row: 21, w: 2, h: 2 },
  'portrait.staff.f001': { sheet: 'career', col: 2, row: 21, w: 2, h: 2 },
  'portrait.staff.f002': { sheet: 'career', col: 4, row: 21, w: 2, h: 2 },
  'portrait.staff.f003': { sheet: 'career', col: 6, row: 21, w: 2, h: 2 },
  'portrait.staff.f110': { sheet: 'career', col: 28, row: 21, w: 2, h: 2 },
  'portrait.staff.f111': { sheet: 'career', col: 30, row: 21, w: 2, h: 2 },
  'portrait.staff.f112': { sheet: 'career', col: 8, row: 22, w: 2, h: 2 },
  'portrait.staff.f113': { sheet: 'career', col: 10, row: 22, w: 2, h: 2 },
  'portrait.staff.f100': { sheet: 'career', col: 12, row: 22, w: 2, h: 2 },
  'portrait.staff.f101': { sheet: 'career', col: 14, row: 22, w: 2, h: 2 },
  'portrait.staff.f102': { sheet: 'career', col: 16, row: 22, w: 2, h: 2 },
  'portrait.staff.f103': { sheet: 'career', col: 18, row: 22, w: 2, h: 2 },
  'portrait.staff.f210': { sheet: 'career', col: 20, row: 22, w: 2, h: 2 },
  'portrait.staff.f211': { sheet: 'career', col: 22, row: 22, w: 2, h: 2 },
  'portrait.staff.f212': { sheet: 'career', col: 24, row: 22, w: 2, h: 2 },
  'portrait.staff.f213': { sheet: 'career', col: 26, row: 22, w: 2, h: 2 },
  'portrait.staff.f200': { sheet: 'career', col: 0, row: 23, w: 2, h: 2 },
  'portrait.staff.f201': { sheet: 'career', col: 2, row: 23, w: 2, h: 2 },
  'portrait.staff.f202': { sheet: 'career', col: 4, row: 23, w: 2, h: 2 },
  'portrait.staff.f203': { sheet: 'career', col: 6, row: 23, w: 2, h: 2 },
  'portrait.staff.f310': { sheet: 'career', col: 28, row: 23, w: 2, h: 2 },
  'portrait.staff.f311': { sheet: 'career', col: 30, row: 23, w: 2, h: 2 },
  'portrait.staff.f312': { sheet: 'career', col: 8, row: 24, w: 2, h: 2 },
  'portrait.staff.f313': { sheet: 'career', col: 10, row: 24, w: 2, h: 2 },
  'portrait.staff.f300': { sheet: 'career', col: 12, row: 24, w: 2, h: 2 },
  'portrait.staff.f301': { sheet: 'career', col: 14, row: 24, w: 2, h: 2 },
  'portrait.staff.f302': { sheet: 'career', col: 16, row: 24, w: 2, h: 2 },
  'portrait.staff.f303': { sheet: 'career', col: 18, row: 24, w: 2, h: 2 },
  'portrait.joseph': { sheet: 'career', col: 20, row: 24, w: 2, h: 2 },
  'portrait.joseph.surprised': { sheet: 'career', col: 22, row: 24, w: 2, h: 2 },
  'portrait.joseph.proud': { sheet: 'career', col: 24, row: 24, w: 2, h: 2 },
  'portrait.joseph.happy': { sheet: 'career', col: 26, row: 24, w: 2, h: 2 },
  'animal.pig': { sheet: 'career', col: 26, row: 36 },
  'animal.pig.walk.1': { sheet: 'career', col: 27, row: 36 },
  'animal.pig.sniff': { sheet: 'career', col: 28, row: 36 },
  'animal.rabbit.white': { sheet: 'career', col: 29, row: 36 },
  'animal.rabbit.white.hop': { sheet: 'career', col: 30, row: 36 },
  'animal.rabbit.brown': { sheet: 'career', col: 31, row: 36 },
  'animal.rabbit.brown.hop': { sheet: 'career', col: 0, row: 37 },
  'animal.horse': { sheet: 'career', col: 0, row: 25, w: 2, h: 2 },
  'animal.horse.walk.1': { sheet: 'career', col: 2, row: 25, w: 2, h: 2 },
  'animal.horse.graze': { sheet: 'career', col: 4, row: 25, w: 2, h: 2 },
  'bird.crow': { sheet: 'career', col: 1, row: 37 },
  'bird.crow.fly.1': { sheet: 'career', col: 2, row: 37 },
  'bird.crow.fly.2': { sheet: 'career', col: 3, row: 37 },
  'building.coop.1': { sheet: 'career', col: 8, row: 8, w: 3, h: 3 },
  'building.coop.2': { sheet: 'career', col: 11, row: 8, w: 3, h: 3 },
  'building.coop.3': { sheet: 'career', col: 14, row: 8, w: 3, h: 3 },
  'building.sheepfold.1': { sheet: 'career', col: 17, row: 8, w: 3, h: 3 },
  'building.sheepfold.2': { sheet: 'career', col: 20, row: 8, w: 3, h: 3 },
  'building.sheepfold.3': { sheet: 'career', col: 23, row: 8, w: 3, h: 3 },
  'building.goatShed.1': { sheet: 'career', col: 26, row: 10, w: 3, h: 3 },
  'building.goatShed.2': { sheet: 'career', col: 29, row: 10, w: 3, h: 3 },
  'building.goatShed.3': { sheet: 'career', col: 0, row: 11, w: 3, h: 3 },
  'building.cowshed.1': { sheet: 'career', col: 3, row: 11, w: 3, h: 3 },
  'building.cowshed.2': { sheet: 'career', col: 6, row: 11, w: 3, h: 3 },
  'building.cowshed.3': { sheet: 'career', col: 9, row: 11, w: 3, h: 3 },
  'building.pigsty.1': { sheet: 'career', col: 12, row: 11, w: 3, h: 3 },
  'building.pigsty.2': { sheet: 'career', col: 15, row: 11, w: 3, h: 3 },
  'building.pigsty.3': { sheet: 'career', col: 18, row: 11, w: 3, h: 3 },
  'building.stable.1': { sheet: 'career', col: 21, row: 11, w: 3, h: 3 },
  'building.stable.2': { sheet: 'career', col: 24, row: 13, w: 3, h: 3 },
  'building.stable.3': { sheet: 'career', col: 27, row: 13, w: 3, h: 3 },
  'building.hutch.1': { sheet: 'career', col: 6, row: 25, w: 2, h: 2 },
  'building.hutch.2': { sheet: 'career', col: 17, row: 14, w: 3, h: 2 },
  'building.hutch.3': { sheet: 'career', col: 20, row: 14, w: 3, h: 2 },
  'building.house.1': { sheet: 'career', col: 27, row: 7, w: 4, h: 3 },
  'building.house.2': { sheet: 'career', col: 27, row: 4, w: 5, h: 3 },
  'building.house.3': { sheet: 'career', col: 18, row: 4, w: 5, h: 4 },
  'building.house.4': { sheet: 'career', col: 12, row: 0, w: 6, h: 4 },
  'building.house.5': { sheet: 'career', col: 0, row: 0, w: 6, h: 5 },
  'building.house.5.flag': { sheet: 'career', col: 6, row: 0, w: 6, h: 5 },
  'building.storage.1': { sheet: 'career', col: 10, row: 5, w: 2, h: 3 },
  'building.storage.2': { sheet: 'career', col: 30, row: 0, w: 2, h: 4 },
  'building.storage.3': { sheet: 'career', col: 23, row: 4, w: 4, h: 4 },
  'building.guestHouse.2': { sheet: 'career', col: 0, row: 8, w: 4, h: 3 },
  'building.guestHouse.3': { sheet: 'career', col: 0, row: 5, w: 5, h: 3 },
  'building.stand.2': { sheet: 'career', col: 9, row: 14, w: 4, h: 2 },
  'machine.tractor.l': { sheet: 'career', col: 28, row: 25, w: 2, h: 2 },
  'machine.tractor.l.1': { sheet: 'career', col: 30, row: 25, w: 2, h: 2 },
  'machine.tractor.r': { sheet: 'career', col: 8, row: 26, w: 2, h: 2 },
  'machine.tractor.r.1': { sheet: 'career', col: 10, row: 26, w: 2, h: 2 },
  'machine.trailer.l': { sheet: 'career', col: 26, row: 26, w: 2, h: 1 },
  'machine.trailer.r': { sheet: 'career', col: 3, row: 27, w: 2, h: 1 },
  'machine.seeder': { sheet: 'career', col: 5, row: 27, w: 2, h: 1 },
  'machine.seeder.1': { sheet: 'career', col: 26, row: 27, w: 2, h: 1 },
  'machine.harvester': { sheet: 'career', col: 9, row: 16, w: 3, h: 2 },
  'machine.harvester.1': { sheet: 'career', col: 12, row: 16, w: 3, h: 2 },
  'machine.fruitPicker': { sheet: 'career', col: 12, row: 26, w: 2, h: 2 },
  'machine.collector': { sheet: 'career', col: 4, row: 37 },
  'land.stump': { sheet: 'career', col: 5, row: 37 },
  'land.tallgrass.1': { sheet: 'career', col: 6, row: 37 },
  'land.tallgrass.2': { sheet: 'career', col: 7, row: 37 },
  'land.tallgrass.3': { sheet: 'career', col: 8, row: 37 },
  'land.wildflower.1': { sheet: 'career', col: 9, row: 37 },
  'land.wildflower.2': { sheet: 'career', col: 10, row: 37 },
  'land.bramble': { sheet: 'career', col: 11, row: 37 },
  'land.cleared': { sheet: 'career', col: 12, row: 37 },
  'land.cleared.patch': { sheet: 'career', col: 13, row: 37 },
  'land.sale.sign': { sheet: 'career', col: 14, row: 37 },
  'land.sale.sign.big': { sheet: 'career', col: 14, row: 26, w: 2, h: 2 },
  'land.sign': { sheet: 'career', col: 15, row: 37 },
  'ground.cobble.tl': { sheet: 'career', col: 16, row: 37 },
  'ground.cobble.t': { sheet: 'career', col: 17, row: 37 },
  'ground.cobble.tr': { sheet: 'career', col: 18, row: 37 },
  'ground.cobble.l': { sheet: 'career', col: 19, row: 37 },
  'ground.cobble.c': { sheet: 'career', col: 20, row: 37 },
  'ground.cobble.r': { sheet: 'career', col: 21, row: 37 },
  'ground.cobble.bl': { sheet: 'career', col: 22, row: 37 },
  'ground.cobble.b': { sheet: 'career', col: 23, row: 37 },
  'ground.cobble.br': { sheet: 'career', col: 24, row: 37 },
  'ground.cobble.inner.tl': { sheet: 'career', col: 25, row: 37 },
  'ground.cobble.inner.tr': { sheet: 'career', col: 26, row: 37 },
  'ground.cobble.inner.br': { sheet: 'career', col: 27, row: 37 },
  'ground.cobble.inner.bl': { sheet: 'career', col: 28, row: 37 },
  'ground.cobble.c.2': { sheet: 'career', col: 29, row: 37 },
  'product.truffle': { sheet: 'career', col: 30, row: 37 },
  'product.eggs': { sheet: 'career', col: 31, row: 37 },
  'product.angora': { sheet: 'career', col: 0, row: 38 },
  'product.milk': { sheet: 'career', col: 1, row: 38 },
  'product.duckEgg': { sheet: 'career', col: 2, row: 38 },
  'product.ride': { sheet: 'career', col: 3, row: 38 },
  'bubble': { sheet: 'career', col: 4, row: 38 },
  'bubble.tail': { sheet: 'career', col: 5, row: 38 },
  'bubble.collect': { sheet: 'career', col: 16, row: 26, w: 2, h: 2 },
  'fair.bunting': { sheet: 'career', col: 28, row: 27, w: 2, h: 1 },
  'fair.bunting.1': { sheet: 'career', col: 30, row: 27, w: 2, h: 1 },
  'fair.lanterns': { sheet: 'career', col: 0, row: 28, w: 2, h: 1 },
  'fair.lanterns.1': { sheet: 'career', col: 2, row: 28, w: 2, h: 1 },
  'fair.stand': { sheet: 'career', col: 18, row: 26, w: 2, h: 2 },
  'fair.xmasTree': { sheet: 'career', col: 31, row: 7, w: 1, h: 2 },
  'fair.chalet': { sheet: 'career', col: 15, row: 16, w: 3, h: 2 },
  'fair.chalet.1': { sheet: 'career', col: 18, row: 16, w: 3, h: 2 },
  'fair.ribbon': { sheet: 'career', col: 6, row: 38 },
  'fair.balloons': { sheet: 'career', col: 26, row: 8, w: 1, h: 2 },
  'fair.pumpkins': { sheet: 'career', col: 4, row: 28, w: 2, h: 1 },
  'icon.career.land': { sheet: 'career', col: 7, row: 38 },
  'icon.career.map': { sheet: 'career', col: 8, row: 38 },
  'icon.career.plan': { sheet: 'career', col: 9, row: 38 },
  'icon.career.staff': { sheet: 'career', col: 10, row: 38 },
  'icon.career.job.gardener': { sheet: 'career', col: 11, row: 38 },
  'icon.career.job.keeper': { sheet: 'career', col: 12, row: 38 },
  'icon.career.job.artisan': { sheet: 'career', col: 13, row: 38 },
  'icon.career.job.seller': { sheet: 'career', col: 14, row: 38 },
  'icon.career.trait.strong': { sheet: 'career', col: 15, row: 38 },
  'icon.career.trait.thrifty': { sheet: 'career', col: 16, row: 38 },
  'icon.career.trait.quick': { sheet: 'career', col: 17, row: 38 },
  'icon.career.trait.loyal': { sheet: 'career', col: 18, row: 38 },
  'icon.career.trait.animalLover': { sheet: 'career', col: 19, row: 38 },
  'icon.career.trait.chatty': { sheet: 'career', col: 20, row: 38 },
  'icon.career.trait.earlyBird': { sheet: 'career', col: 21, row: 38 },
  'icon.career.mood.joyful': { sheet: 'career', col: 22, row: 38 },
  'icon.career.mood.content': { sheet: 'career', col: 23, row: 38 },
  'icon.career.mood.tired': { sheet: 'career', col: 24, row: 38 },
  'icon.career.quest': { sheet: 'career', col: 25, row: 38 },
  'icon.career.heart': { sheet: 'career', col: 26, row: 38 },
  'icon.career.heart.empty': { sheet: 'career', col: 27, row: 38 },
  'icon.career.calendar': { sheet: 'career', col: 28, row: 38 },
  'icon.career.storage': { sheet: 'career', col: 29, row: 38 },
  'icon.career.wage': { sheet: 'career', col: 30, row: 38 },
  'icon.career.market.up': { sheet: 'career', col: 31, row: 38 },
  'icon.career.market.down': { sheet: 'career', col: 0, row: 39 },
  'icon.career.greenhouse': { sheet: 'career', col: 1, row: 39 },
  'icon.career.event': { sheet: 'career', col: 2, row: 39 },
  'icon.career.fuel': { sheet: 'career', col: 3, row: 39 },
  'icon.career.house': { sheet: 'career', col: 4, row: 39 },
  'icon.career.leave': { sheet: 'career', col: 5, row: 39 },
  'icon.career.level': { sheet: 'career', col: 6, row: 39 },
  'icon.career.hire': { sheet: 'career', col: 7, row: 39 },
  'icon.career.patrimony': { sheet: 'career', col: 8, row: 39 },
  'icon.career.crow': { sheet: 'career', col: 9, row: 39 },
  'icon.career.fishing': { sheet: 'career', col: 10, row: 39 },
  'icon.career.visitor': { sheet: 'career', col: 11, row: 39 },
  'icon.career.contest': { sheet: 'career', col: 12, row: 39 },
  'icon.career.rainbow': { sheet: 'career', col: 13, row: 39 },
  'icon.career.lock': { sheet: 'career', col: 14, row: 39 },
  'icon.career.coins': { sheet: 'career', col: 15, row: 39 },
  'icon.career.machine.tractor': { sheet: 'career', col: 16, row: 39 },
  'icon.career.machine.seeder': { sheet: 'career', col: 17, row: 39 },
  'icon.career.machine.harvester': { sheet: 'career', col: 18, row: 39 },
  'icon.career.machine.fruitPicker': { sheet: 'career', col: 19, row: 39 },
  'icon.career.machine.collector': { sheet: 'career', col: 20, row: 39 },
  'icon.career.machine.sprinklers': { sheet: 'career', col: 21, row: 39 },
  'icon.career.machine.waterTower': { sheet: 'career', col: 22, row: 39 },
  'icon.career.machine.conveyor': { sheet: 'career', col: 23, row: 39 },
  'icon.career.rank.1': { sheet: 'career', col: 24, row: 39 },
  'icon.career.rank.2': { sheet: 'career', col: 25, row: 39 },
  'icon.career.rank.3': { sheet: 'career', col: 26, row: 39 },
  'icon.career.rank.4': { sheet: 'career', col: 27, row: 39 },
  'icon.career.rank.5': { sheet: 'career', col: 28, row: 39 },
  'icon.career.rank.6': { sheet: 'career', col: 29, row: 39 },
  'icon.ach.careerStart': { sheet: 'career', col: 30, row: 39 },
  'icon.ach.careerStart.locked': { sheet: 'career', col: 31, row: 39 },
  'icon.ach.firstLot': { sheet: 'career', col: 0, row: 40 },
  'icon.ach.firstLot.locked': { sheet: 'career', col: 1, row: 40 },
  'icon.ach.rank3': { sheet: 'career', col: 2, row: 40 },
  'icon.ach.rank3.locked': { sheet: 'career', col: 3, row: 40 },
  'icon.ach.rank6': { sheet: 'career', col: 4, row: 40 },
  'icon.ach.rank6.locked': { sheet: 'career', col: 5, row: 40 },
  'icon.ach.firstHire': { sheet: 'career', col: 6, row: 40 },
  'icon.ach.firstHire.locked': { sheet: 'career', col: 7, row: 40 },
  'icon.ach.fullTeam': { sheet: 'career', col: 8, row: 40 },
  'icon.ach.fullTeam.locked': { sheet: 'career', col: 9, row: 40 },
  'icon.ach.teamLeader': { sheet: 'career', col: 10, row: 40 },
  'icon.ach.teamLeader.locked': { sheet: 'career', col: 11, row: 40 },
  'icon.ach.firstMachine': { sheet: 'career', col: 12, row: 40 },
  'icon.ach.firstMachine.locked': { sheet: 'career', col: 13, row: 40 },
  'icon.ach.tractor': { sheet: 'career', col: 14, row: 40 },
  'icon.ach.tractor.locked': { sheet: 'career', col: 15, row: 40 },
  'icon.ach.winterTomato': { sheet: 'career', col: 16, row: 40 },
  'icon.ach.winterTomato.locked': { sheet: 'career', col: 17, row: 40 },
  'icon.ach.menagerie': { sheet: 'career', col: 18, row: 40 },
  'icon.ach.menagerie.locked': { sheet: 'career', col: 19, row: 40 },
  'icon.ach.truffles': { sheet: 'career', col: 20, row: 40 },
  'icon.ach.truffles.locked': { sheet: 'career', col: 21, row: 40 },
  'icon.ach.josephFriend': { sheet: 'career', col: 22, row: 40 },
  'icon.ach.josephFriend.locked': { sheet: 'career', col: 23, row: 40 },
  'icon.ach.fairChampion': { sheet: 'career', col: 24, row: 40 },
  'icon.ach.fairChampion.locked': { sheet: 'career', col: 25, row: 40 },
  'icon.ach.tenYears': { sheet: 'career', col: 26, row: 40 },
  'icon.ach.tenYears.locked': { sheet: 'career', col: 27, row: 40 },
  'icon.ach.fullSilo': { sheet: 'career', col: 28, row: 40 },
  'icon.ach.fullSilo.locked': { sheet: 'career', col: 29, row: 40 },
  'icon.ach.recordYear': { sheet: 'career', col: 30, row: 40 },
  'icon.ach.recordYear.locked': { sheet: 'career', col: 31, row: 40 },
  'animal.duck': { sheet: 'career', col: 0, row: 41 },
  'animal.duck.walk.1': { sheet: 'career', col: 1, row: 41 },
  'animal.duck.swim': { sheet: 'career', col: 2, row: 41 },
  'product.fish.1': { sheet: 'career', col: 3, row: 41 },
  'product.fish.2': { sheet: 'career', col: 4, row: 41 },
  'product.fish.3': { sheet: 'career', col: 5, row: 41 },
  'water.tl': { sheet: 'career', col: 6, row: 41 },
  'water.t': { sheet: 'career', col: 7, row: 41 },
  'water.tr': { sheet: 'career', col: 8, row: 41 },
  'water.l': { sheet: 'career', col: 9, row: 41 },
  'water.c': { sheet: 'career', col: 10, row: 41 },
  'water.r': { sheet: 'career', col: 11, row: 41 },
  'water.bl': { sheet: 'career', col: 12, row: 41 },
  'water.b': { sheet: 'career', col: 13, row: 41 },
  'water.br': { sheet: 'career', col: 14, row: 41 },
  'water.inner.tl': { sheet: 'career', col: 15, row: 41 },
  'water.inner.tr': { sheet: 'career', col: 16, row: 41 },
  'water.inner.br': { sheet: 'career', col: 17, row: 41 },
  'water.inner.bl': { sheet: 'career', col: 18, row: 41 },
  'water.c.1': { sheet: 'career', col: 19, row: 41 },
  'water.lily': { sheet: 'career', col: 20, row: 41 },
  'water.reeds': { sheet: 'career', col: 21, row: 41 },
  'pond.dock': { sheet: 'career', col: 0, row: 27, w: 3, h: 1 },
  'glass.roof.c': { sheet: 'career', col: 22, row: 41 },
  'glass.roof.l': { sheet: 'career', col: 23, row: 41 },
  'glass.roof.r': { sheet: 'career', col: 24, row: 41 },
  'glass.wall.c': { sheet: 'career', col: 25, row: 41 },
  'glass.wall.l': { sheet: 'career', col: 26, row: 41 },
  'glass.wall.r': { sheet: 'career', col: 27, row: 41 },
  'glass.roof.top': { sheet: 'career', col: 28, row: 41 },
  'glass.door': { sheet: 'career', col: 29, row: 41 },
  'building.greenhouse.1': { sheet: 'career', col: 18, row: 0, w: 6, h: 4 },
  'building.greenhouse.2': { sheet: 'career', col: 24, row: 0, w: 6, h: 4 },
  'building.greenhouse.3': { sheet: 'career', col: 12, row: 4, w: 6, h: 4 },
  'building.cannery': { sheet: 'career', col: 0, row: 14, w: 3, h: 3 },
  'building.spinningMill': { sheet: 'career', col: 3, row: 14, w: 3, h: 3 },
  'product.tomatoSauce': { sheet: 'career', col: 30, row: 41 },
  'product.pumpkinSoup': { sheet: 'career', col: 31, row: 41 },
  'product.ratatouille': { sheet: 'career', col: 0, row: 42 },
  'product.yarn': { sheet: 'career', col: 1, row: 42 },
  'part.sign.gold': { sheet: 'career', col: 2, row: 42 },
  'part.annex': { sheet: 'career', col: 23, row: 14, w: 1, h: 2 },
  'machine.waterTower': { sheet: 'career', col: 30, row: 13, w: 2, h: 4 },
  'machine.conveyor.h': { sheet: 'career', col: 3, row: 42 },
  'machine.conveyor.v': { sheet: 'career', col: 4, row: 42 },
  'machine.conveyor.h.1': { sheet: 'career', col: 5, row: 42 },
  'machine.conveyor.v.1': { sheet: 'career', col: 6, row: 42 },
  'building.stand.3': { sheet: 'career', col: 5, row: 5, w: 5, h: 3 },
  'embellish.fountain': { sheet: 'career', col: 20, row: 26, w: 2, h: 2 },
  'embellish.fountain.1': { sheet: 'career', col: 22, row: 26, w: 2, h: 2 },
  'embellish.bandstand': { sheet: 'career', col: 6, row: 14, w: 3, h: 3 },
  'embellish.statue': { sheet: 'career', col: 24, row: 26, w: 2, h: 2 },
  'embellish.garden': { sheet: 'career', col: 4, row: 8, w: 4, h: 3 },
  'tree.cherry.sapling': { sheet: 'career', col: 7, row: 42 },
  'tree.cherry.young': { sheet: 'career', col: 8, row: 42 },
  'tree.cherry.spring': { sheet: 'career', col: 9, row: 42 },
  'tree.cherry.summer': { sheet: 'career', col: 10, row: 42 },
  'tree.cherry.summer.ripe': { sheet: 'career', col: 11, row: 42 },
  'tree.cherry.autumn': { sheet: 'career', col: 12, row: 42 },
  'tree.cherry.autumn.ripe': { sheet: 'career', col: 13, row: 42 },
  'tree.cherry.winter': { sheet: 'career', col: 14, row: 42 },
  'tree.cherry.dead': { sheet: 'career', col: 15, row: 42 },
  'tree.pear.sapling': { sheet: 'career', col: 16, row: 42 },
  'tree.pear.young': { sheet: 'career', col: 17, row: 42 },
  'tree.pear.spring': { sheet: 'career', col: 18, row: 42 },
  'tree.pear.summer': { sheet: 'career', col: 19, row: 42 },
  'tree.pear.summer.ripe': { sheet: 'career', col: 20, row: 42 },
  'tree.pear.autumn': { sheet: 'career', col: 21, row: 42 },
  'tree.pear.autumn.ripe': { sheet: 'career', col: 22, row: 42 },
  'tree.pear.winter': { sheet: 'career', col: 23, row: 42 },
  'tree.pear.dead': { sheet: 'career', col: 24, row: 42 },
  'tree.cherry.icon': { sheet: 'career', col: 25, row: 42 },
  'tree.pear.icon': { sheet: 'career', col: 26, row: 42 },
  'product.cherryJam': { sheet: 'career', col: 27, row: 42 },
  'product.pearJuice': { sheet: 'career', col: 28, row: 42 },
  'pet.cat': { sheet: 'career', col: 29, row: 42 },
  'pet.cat.walk.1': { sheet: 'career', col: 30, row: 42 },
  'pet.cat.walk.2': { sheet: 'career', col: 31, row: 42 },
  'pet.dog': { sheet: 'career', col: 0, row: 43 },
  'pet.dog.walk.1': { sheet: 'career', col: 1, row: 43 },
  'pet.dog.walk.2': { sheet: 'career', col: 2, row: 43 },
  'effect.rainbow': { sheet: 'career', col: 13, row: 14, w: 4, h: 2 },
  'animal.rabbit': { sheet: 'career', col: 29, row: 36 },
  'building.roadsideStand.2': { sheet: 'career', col: 9, row: 14, w: 4, h: 2 },
  'building.roadsideStand.3': { sheet: 'career', col: 5, row: 5, w: 5, h: 3 },
};
/** Apparences des employés : genre ('m' | 'f') × tenue (0..3) × chapeau (0 | 1) × teinte (0..3). */
export const STAFF_GENDERS = Object.freeze(['m', 'f']);
export const STAFF_OUTFITS = 4;
export const STAFF_TINTS = 4; // 0 cheveux bruns / peau médiane · 1 blonds / claire · 2 auburn / hâlée · 3 noirs / foncée
export const STAFF_POSES = Object.freeze(['idle', 'walk', 'walk2', 'work']);

/**
 * Clé d'apparence « <genre><tenue><chapeau><teinte> » (ex. 'f013') à partir de
 * look = { outfit, hat, tint, gender? } ; gender absent → 'm' (female: true accepté aussi).
 */
export function lookKey(look = {}) {
  const clamp = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(Number(v) || 0)));
  const g = look.gender === 'f' || look.female === true ? 'f' : 'm';
  return `${g}${clamp(look.outfit, STAFF_OUTFITS)}${look.hat ? 1 : 0}${clamp(look.tint, STAFF_TINTS)}`;
}

/**
 * Sprite 16 × 16 d'un employé : 'staff.<clé>' (repos), '.walk', '.walk2' (autre pied), '.work'.
 * Personnage de face ; outil tenu : dessiner 'tool.<can|basket|seedbag|pail|hoe.carry>' par-dessus
 * (repos et marche) ou 'tool.<…>.work' (pose de travail), à la même position.
 */
export function staffSprite(look, pose = 'idle') {
  const key = lookKey(look);
  return pose && pose !== 'idle' && STAFF_POSES.includes(pose) ? `staff.${key}.${pose}` : `staff.${key}`;
}

/** Portrait 32 × 32 (tête et épaules) d'un employé : 'portrait.staff.<clé>'. */
export function staffPortrait(look) {
  return `portrait.staff.${lookKey(look)}`;
}

/** Sprite du joueur : fermier (farmer.outfit.N) ou fermière (farmer.fermiere.outfit.N), avec ou sans chapeau. */
export function playerSprite(outfitId, { female = false, nohat = false } = {}) {
  const name = outfitSprite(outfitId, nohat);
  return female ? name.replace(/^farmer\.outfit\./, 'farmer.fermiere.outfit.') : name;
}

/** Portrait de Joseph selon l'expression : 'content' (défaut), 'surprised', 'proud', 'happy'. */
export function josephPortrait(expr = 'content') {
  return expr && expr !== 'content' ? `portrait.joseph.${expr}` : 'portrait.joseph';
}

/** Bulle de ramassage 'bubble.collect' (32 × 32) : zone du contenu (icône 16 × 16), pointe en bas au centre. */
export const BUBBLE_CONTENT = Object.freeze({ x: 8, y: 4, w: 16, h: 16 });
/** Cadre 'bubble' (16 × 16) à étirer en 9 tranches : bords de 5 px ; 'bubble.tail' se pose sous le bas. */
export const BUBBLE_SLICE = 5;
// </career:auto>

// ---------------------------------------------------------------------------
// Lot 2 (planche « lot2 ») : légumes géants crop.<id>.giant (32 × 32, sur 2 × 2 parcelles, bas du sprite
// = bas du carré), pastilles quality.fine / quality.gold (à poser sur la tuile, en haut à droite), icônes
// dorées crop.<id>.icon.gold, fx.sparkle.0..3, fx.coin.0..3, fx.burst, fx.note ; surprises de l'aube
// (fairy.0..2, animal.fox[.walk.1|.sit|.sleep], animal.hedgehog[.walk.1], butterfly.rare.0..1, chest.old[.open],
// mushroom.ring, owl.carved 16 × 32) ; météos (icon.weather.*, star.shooting.0..1 32 × 16, fog 32 × 32
// raccordable) ; trouvailles (find.*, find.well 16 × 32, land.stump.find). Animaux : regard vers la DROITE.
// <lot2:auto>
  // Généré par assets/sprites/generate-lot2.py — ne pas modifier à la main.
const lot2 = {
  'crop.carrot.giant': { sheet: 'lot2', col: 0, row: 0, w: 2, h: 2 },
  'crop.turnip.giant': { sheet: 'lot2', col: 2, row: 0, w: 2, h: 2 },
  'crop.wheat.giant': { sheet: 'lot2', col: 4, row: 0, w: 2, h: 2 },
  'crop.cabbage.giant': { sheet: 'lot2', col: 6, row: 0, w: 2, h: 2 },
  'crop.tomato.giant': { sheet: 'lot2', col: 8, row: 0, w: 2, h: 2 },
  'crop.corn.giant': { sheet: 'lot2', col: 10, row: 0, w: 2, h: 2 },
  'crop.sunflower.giant': { sheet: 'lot2', col: 12, row: 0, w: 2, h: 2 },
  'crop.pumpkin.giant': { sheet: 'lot2', col: 14, row: 0, w: 2, h: 2 },
  'crop.potato.giant': { sheet: 'lot2', col: 0, row: 2, w: 2, h: 2 },
  'crop.strawberry.giant': { sheet: 'lot2', col: 2, row: 2, w: 2, h: 2 },
  'crop.zucchini.giant': { sheet: 'lot2', col: 4, row: 2, w: 2, h: 2 },
  'quality.fine': { sheet: 'lot2', col: 14, row: 2 },
  'quality.gold': { sheet: 'lot2', col: 15, row: 2 },
  'crop.carrot.icon.gold': { sheet: 'lot2', col: 9, row: 3 },
  'crop.turnip.icon.gold': { sheet: 'lot2', col: 10, row: 3 },
  'crop.corn.icon.gold': { sheet: 'lot2', col: 11, row: 3 },
  'crop.tomato.icon.gold': { sheet: 'lot2', col: 12, row: 3 },
  'crop.cabbage.icon.gold': { sheet: 'lot2', col: 14, row: 3 },
  'crop.wheat.icon.gold': { sheet: 'lot2', col: 15, row: 3 },
  'crop.sunflower.icon.gold': { sheet: 'lot2', col: 0, row: 4 },
  'crop.pumpkin.icon.gold': { sheet: 'lot2', col: 1, row: 4 },
  'crop.potato.icon.gold': { sheet: 'lot2', col: 2, row: 4 },
  'crop.strawberry.icon.gold': { sheet: 'lot2', col: 3, row: 4 },
  'crop.zucchini.icon.gold': { sheet: 'lot2', col: 4, row: 4 },
  'fx.sparkle.0': { sheet: 'lot2', col: 5, row: 4 },
  'fx.sparkle.1': { sheet: 'lot2', col: 6, row: 4 },
  'fx.sparkle.2': { sheet: 'lot2', col: 7, row: 4 },
  'fx.sparkle.3': { sheet: 'lot2', col: 8, row: 4 },
  'fairy.0': { sheet: 'lot2', col: 9, row: 4 },
  'fairy.1': { sheet: 'lot2', col: 10, row: 4 },
  'fairy.2': { sheet: 'lot2', col: 11, row: 4 },
  'animal.fox': { sheet: 'lot2', col: 12, row: 4 },
  'animal.fox.walk.1': { sheet: 'lot2', col: 13, row: 4 },
  'animal.fox.sit': { sheet: 'lot2', col: 14, row: 4 },
  'animal.fox.sleep': { sheet: 'lot2', col: 15, row: 4 },
  'animal.hedgehog': { sheet: 'lot2', col: 0, row: 5 },
  'animal.hedgehog.walk.1': { sheet: 'lot2', col: 1, row: 5 },
  'butterfly.rare.0': { sheet: 'lot2', col: 2, row: 5 },
  'butterfly.rare.1': { sheet: 'lot2', col: 3, row: 5 },
  'chest.old': { sheet: 'lot2', col: 4, row: 5 },
  'chest.old.open': { sheet: 'lot2', col: 5, row: 5 },
  'mushroom.ring': { sheet: 'lot2', col: 6, row: 5 },
  'owl.carved': { sheet: 'lot2', col: 8, row: 2, w: 1, h: 2 },
  'icon.weather.warmrain': { sheet: 'lot2', col: 7, row: 5 },
  'icon.weather.fog': { sheet: 'lot2', col: 8, row: 5 },
  'icon.weather.shootingstar': { sheet: 'lot2', col: 9, row: 5 },
  'icon.weather.goldenhour': { sheet: 'lot2', col: 10, row: 5 },
  'icon.weather.rainbow': { sheet: 'lot2', col: 11, row: 5 },
  'icon.weather.mushroom': { sheet: 'lot2', col: 12, row: 5 },
  'star.shooting.0': { sheet: 'lot2', col: 9, row: 2, w: 2, h: 1 },
  'star.shooting.1': { sheet: 'lot2', col: 11, row: 2, w: 2, h: 1 },
  'fog': { sheet: 'lot2', col: 6, row: 2, w: 2, h: 2 },
  'find.well': { sheet: 'lot2', col: 13, row: 2, w: 1, h: 2 },
  'find.statue': { sheet: 'lot2', col: 13, row: 5 },
  'find.coins': { sheet: 'lot2', col: 14, row: 5 },
  'find.seedjar': { sheet: 'lot2', col: 15, row: 5 },
  'find.lostlamb': { sheet: 'lot2', col: 0, row: 6 },
  'find.lostlamb.walk.1': { sheet: 'lot2', col: 1, row: 6 },
  'land.stump.find': { sheet: 'lot2', col: 2, row: 6 },
  'fx.coin.0': { sheet: 'lot2', col: 3, row: 6 },
  'fx.coin.1': { sheet: 'lot2', col: 4, row: 6 },
  'fx.coin.2': { sheet: 'lot2', col: 5, row: 6 },
  'fx.coin.3': { sheet: 'lot2', col: 6, row: 6 },
  'fx.burst': { sheet: 'lot2', col: 7, row: 6 },
  'fx.note': { sheet: 'lot2', col: 8, row: 6 },
  'fairy': { sheet: 'lot2', col: 9, row: 4 },
  'fox': { sheet: 'lot2', col: 12, row: 4 },
  'hedgehog': { sheet: 'lot2', col: 0, row: 5 },
  'hedgehog.walk.1': { sheet: 'lot2', col: 1, row: 5 },
  'butterfly.rare': { sheet: 'lot2', col: 2, row: 5 },
  'star.shooting': { sheet: 'lot2', col: 9, row: 2, w: 2, h: 1 },
  'find.chest': { sheet: 'lot2', col: 4, row: 5 },
  'find.chest.open': { sheet: 'lot2', col: 5, row: 5 },
};
// </lot2:auto>

export const SPRITES = {
  ...crops,
  ...ground,
  ...nature,
  ...fences,
  ...things,
  ...buildings,
  ...buildingParts,
  ...v3,
  ...career,
  ...lot2,
};

// <lot3:auto>
// Lot 3 (planche « lot3 », assets/sprites/lot3.png) : « variété » dessinée dans le style Kenney.
// Tableau du village board.village (32 × 32) et feuilles board.note[.kept|.done] ; charrette du marché
// cart.market[.1] (32 × 32, âne vers la DROITE) ; roulotte merchant.wagon[.1] (32 × 32, avant à DROITE) ;
// Basile npc.merchant[.walk] (de face, comme npc.joseph) ; cultures rares pea / melon / leek (crop.<id>.1..4,
// .icon, .dead, .icon.gold, seedbag.<id>, sack.<id>, crate.<id>, crop.<id>.giant 32 × 32) et crate.apple ;
// portraits 32 × 32 portrait.client.<id>, portrait.merchant, portrait.theme.<id> ; icônes icon.board / cart /
// cards / challenge / merchant / theme / rare, icon.card.<id>, icon.challenge.<id>, medal.*, item.<id>,
// icon.theme.<id> ; stands fair.theme.<id> ; décors lantern.peddler, weathervane.rooster, sign.magazine.
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-lot3.py — ne pas modifier à la main.
const lot3 = {
  'crop.pea.1': { sheet: 'lot3', col: 12, row: 6 },
  'crop.pea.2': { sheet: 'lot3', col: 13, row: 6 },
  'crop.pea.3': { sheet: 'lot3', col: 14, row: 6 },
  'crop.pea.4': { sheet: 'lot3', col: 15, row: 6 },
  'crop.pea.icon': { sheet: 'lot3', col: 12, row: 7 },
  'crop.pea.dead': { sheet: 'lot3', col: 13, row: 7 },
  'crop.pea.icon.gold': { sheet: 'lot3', col: 14, row: 7 },
  'seedbag.pea': { sheet: 'lot3', col: 15, row: 7 },
  'sack.pea': { sheet: 'lot3', col: 0, row: 8 },
  'crate.pea': { sheet: 'lot3', col: 1, row: 8 },
  'crop.melon.1': { sheet: 'lot3', col: 2, row: 8 },
  'crop.melon.2': { sheet: 'lot3', col: 3, row: 8 },
  'crop.melon.3': { sheet: 'lot3', col: 4, row: 8 },
  'crop.melon.4': { sheet: 'lot3', col: 5, row: 8 },
  'crop.melon.icon': { sheet: 'lot3', col: 6, row: 8 },
  'crop.melon.dead': { sheet: 'lot3', col: 7, row: 8 },
  'crop.melon.icon.gold': { sheet: 'lot3', col: 8, row: 8 },
  'seedbag.melon': { sheet: 'lot3', col: 9, row: 8 },
  'sack.melon': { sheet: 'lot3', col: 10, row: 8 },
  'crate.melon': { sheet: 'lot3', col: 11, row: 8 },
  'crop.leek.1': { sheet: 'lot3', col: 12, row: 8 },
  'crop.leek.2': { sheet: 'lot3', col: 13, row: 8 },
  'crop.leek.3': { sheet: 'lot3', col: 14, row: 8 },
  'crop.leek.4': { sheet: 'lot3', col: 15, row: 8 },
  'crop.leek.icon': { sheet: 'lot3', col: 0, row: 9 },
  'crop.leek.dead': { sheet: 'lot3', col: 1, row: 9 },
  'crop.leek.icon.gold': { sheet: 'lot3', col: 2, row: 9 },
  'seedbag.leek': { sheet: 'lot3', col: 3, row: 9 },
  'sack.leek': { sheet: 'lot3', col: 4, row: 9 },
  'crate.leek': { sheet: 'lot3', col: 5, row: 9 },
  'crate.apple': { sheet: 'lot3', col: 6, row: 9 },
  'crop.pea.giant': { sheet: 'lot3', col: 0, row: 0, w: 2, h: 2 },
  'crop.melon.giant': { sheet: 'lot3', col: 2, row: 0, w: 2, h: 2 },
  'crop.leek.giant': { sheet: 'lot3', col: 4, row: 0, w: 2, h: 2 },
  'board.village': { sheet: 'lot3', col: 6, row: 0, w: 2, h: 2 },
  'board.note': { sheet: 'lot3', col: 7, row: 9 },
  'board.note.kept': { sheet: 'lot3', col: 8, row: 9 },
  'board.note.done': { sheet: 'lot3', col: 9, row: 9 },
  'cart.market': { sheet: 'lot3', col: 8, row: 0, w: 2, h: 2 },
  'cart.market.1': { sheet: 'lot3', col: 10, row: 0, w: 2, h: 2 },
  'merchant.wagon': { sheet: 'lot3', col: 12, row: 0, w: 2, h: 2 },
  'merchant.wagon.1': { sheet: 'lot3', col: 14, row: 0, w: 2, h: 2 },
  'npc.merchant': { sheet: 'lot3', col: 10, row: 9 },
  'npc.merchant.walk': { sheet: 'lot3', col: 11, row: 9 },
  'fair.theme.bees': { sheet: 'lot3', col: 12, row: 9 },
  'fair.theme.cheese': { sheet: 'lot3', col: 13, row: 9 },
  'fair.theme.tourism': { sheet: 'lot3', col: 14, row: 9 },
  'fair.theme.giants': { sheet: 'lot3', col: 15, row: 9 },
  'fair.theme.frogs': { sheet: 'lot3', col: 0, row: 10 },
  'fair.theme.orchard': { sheet: 'lot3', col: 1, row: 10 },
  'fair.theme.bread': { sheet: 'lot3', col: 2, row: 10 },
  'fair.theme.markets': { sheet: 'lot3', col: 3, row: 10 },
  'fair.theme.lights': { sheet: 'lot3', col: 4, row: 10 },
  'lantern.peddler': { sheet: 'lot3', col: 5, row: 10 },
  'weathervane.rooster': { sheet: 'lot3', col: 6, row: 10 },
  'sign.magazine': { sheet: 'lot3', col: 7, row: 10 },
  'portrait.client.rose': { sheet: 'lot3', col: 0, row: 2, w: 2, h: 2 },
  'portrait.client.paulo': { sheet: 'lot3', col: 2, row: 2, w: 2, h: 2 },
  'portrait.client.lili': { sheet: 'lot3', col: 4, row: 2, w: 2, h: 2 },
  'portrait.client.garnier': { sheet: 'lot3', col: 6, row: 2, w: 2, h: 2 },
  'portrait.client.chevalier': { sheet: 'lot3', col: 8, row: 2, w: 2, h: 2 },
  'portrait.client.fabre': { sheet: 'lot3', col: 10, row: 2, w: 2, h: 2 },
  'portrait.client.perrin': { sheet: 'lot3', col: 12, row: 2, w: 2, h: 2 },
  'portrait.client.maire': { sheet: 'lot3', col: 14, row: 2, w: 2, h: 2 },
  'portrait.client.odette': { sheet: 'lot3', col: 0, row: 4, w: 2, h: 2 },
  'portrait.client.leon': { sheet: 'lot3', col: 2, row: 4, w: 2, h: 2 },
  'portrait.client.morel': { sheet: 'lot3', col: 4, row: 4, w: 2, h: 2 },
  'portrait.client.twins': { sheet: 'lot3', col: 6, row: 4, w: 2, h: 2 },
  'portrait.merchant': { sheet: 'lot3', col: 8, row: 4, w: 2, h: 2 },
  'portrait.theme.margot': { sheet: 'lot3', col: 10, row: 4, w: 2, h: 2 },
  'portrait.theme.anselme': { sheet: 'lot3', col: 12, row: 4, w: 2, h: 2 },
  'portrait.theme.journalist': { sheet: 'lot3', col: 14, row: 4, w: 2, h: 2 },
  'portrait.theme.gaspard': { sheet: 'lot3', col: 0, row: 6, w: 2, h: 2 },
  'portrait.theme.firmin': { sheet: 'lot3', col: 2, row: 6, w: 2, h: 2 },
  'portrait.theme.mathis': { sheet: 'lot3', col: 4, row: 6, w: 2, h: 2 },
  'portrait.theme.jeanne': { sheet: 'lot3', col: 6, row: 6, w: 2, h: 2 },
  'portrait.theme.wholesaler': { sheet: 'lot3', col: 8, row: 6, w: 2, h: 2 },
  'portrait.theme.northpeddler': { sheet: 'lot3', col: 10, row: 6, w: 2, h: 2 },
  'icon.board': { sheet: 'lot3', col: 8, row: 10 },
  'icon.cart': { sheet: 'lot3', col: 9, row: 10 },
  'icon.cards': { sheet: 'lot3', col: 10, row: 10 },
  'icon.challenge': { sheet: 'lot3', col: 11, row: 10 },
  'icon.merchant': { sheet: 'lot3', col: 12, row: 10 },
  'icon.theme': { sheet: 'lot3', col: 13, row: 10 },
  'icon.rare': { sheet: 'lot3', col: 14, row: 10 },
  'icon.card.purse': { sheet: 'lot3', col: 15, row: 10 },
  'icon.card.seedFair': { sheet: 'lot3', col: 0, row: 11 },
  'icon.card.fertilizer': { sheet: 'lot3', col: 1, row: 11 },
  'icon.card.hen': { sheet: 'lot3', col: 2, row: 11 },
  'icon.card.watering': { sheet: 'lot3', col: 3, row: 11 },
  'icon.card.clover': { sheet: 'lot3', col: 4, row: 11 },
  'icon.card.poster': { sheet: 'lot3', col: 5, row: 11 },
  'icon.card.landlord': { sheet: 'lot3', col: 6, row: 11 },
  'icon.card.bees': { sheet: 'lot3', col: 7, row: 11 },
  'icon.card.crier': { sheet: 'lot3', col: 8, row: 11 },
  'icon.card.cartHorse': { sheet: 'lot3', col: 9, row: 11 },
  'icon.card.clearing': { sheet: 'lot3', col: 10, row: 11 },
  'icon.card.seedBag': { sheet: 'lot3', col: 11, row: 11 },
  'icon.card.recipe': { sheet: 'lot3', col: 12, row: 11 },
  'icon.card.hay': { sheet: 'lot3', col: 13, row: 11 },
  'icon.card.almanac': { sheet: 'lot3', col: 14, row: 11 },
  'icon.challenge.harvests': { sheet: 'lot3', col: 15, row: 11 },
  'icon.challenge.sales': { sheet: 'lot3', col: 0, row: 12 },
  'icon.challenge.variety': { sheet: 'lot3', col: 1, row: 12 },
  'icon.challenge.sowing': { sheet: 'lot3', col: 2, row: 12 },
  'icon.challenge.care': { sheet: 'lot3', col: 3, row: 12 },
  'icon.challenge.quality': { sheet: 'lot3', col: 4, row: 12 },
  'icon.challenge.orders': { sheet: 'lot3', col: 5, row: 12 },
  'icon.challenge.crates': { sheet: 'lot3', col: 6, row: 12 },
  'icon.challenge.products': { sheet: 'lot3', col: 7, row: 12 },
  'icon.challenge.apples': { sheet: 'lot3', col: 8, row: 12 },
  'icon.challenge.animals': { sheet: 'lot3', col: 9, row: 12 },
  'icon.challenge.collect': { sheet: 'lot3', col: 10, row: 12 },
  'medal.bronze': { sheet: 'lot3', col: 11, row: 12 },
  'medal.silver': { sheet: 'lot3', col: 12, row: 12 },
  'medal.gold': { sheet: 'lot3', col: 13, row: 12 },
  'medal.empty': { sheet: 'lot3', col: 14, row: 12 },
  'item.fertilizer': { sheet: 'lot3', col: 15, row: 12 },
  'item.usedCoop': { sheet: 'lot3', col: 0, row: 13 },
  'item.hens': { sheet: 'lot3', col: 1, row: 13 },
  'item.usedHive': { sheet: 'lot3', col: 2, row: 13 },
  'item.copperCan': { sheet: 'lot3', col: 3, row: 13 },
  'item.almanac': { sheet: 'lot3', col: 4, row: 13 },
  'item.horseshoe': { sheet: 'lot3', col: 5, row: 13 },
  'item.lantern': { sheet: 'lot3', col: 6, row: 13 },
  'item.weathervane': { sheet: 'lot3', col: 7, row: 13 },
  'item.heirloom': { sheet: 'lot3', col: 8, row: 13 },
  'icon.theme.bees': { sheet: 'lot3', col: 9, row: 13 },
  'icon.theme.cheese': { sheet: 'lot3', col: 10, row: 13 },
  'icon.theme.tourism': { sheet: 'lot3', col: 11, row: 13 },
  'icon.theme.giants': { sheet: 'lot3', col: 12, row: 13 },
  'icon.theme.frogs': { sheet: 'lot3', col: 13, row: 13 },
  'icon.theme.orchard': { sheet: 'lot3', col: 14, row: 13 },
  'icon.theme.bread': { sheet: 'lot3', col: 15, row: 13 },
  'icon.theme.markets': { sheet: 'lot3', col: 0, row: 14 },
  'icon.theme.lights': { sheet: 'lot3', col: 1, row: 14 },
};
Object.assign(SPRITES, lot3);
// Étape 0 des cultures rares : la tuile commune « graines semées » (comme les cultures v3).
for (const id of ['pea', 'melon', 'leek']) SPRITES[`crop.${id}.0`] = SPRITES['crop.seeds'];
// </lot3:auto>

// <lot4:auto>
// Lot 4 (planche « lot4 », assets/sprites/lot4.png) : « collection et enjeux doux » dans le style Kenney.
// Album : album.cover (32 × 32), icon.album, album.page.<id>, album.empty, album.stamp.<gold|giant|fete|visitor|best>,
// album.ribbon ; product.wool, fish.<id> ; hiver : winter.<id>, track.<hare|deer|fox>, bird.<id>[.1] (bec vers la
// DROITE ; .1 = il picore), feeder[.full] (16 × 32), window.lit, story.vignette (48 × 32), icon.story / winter /
// feeder / seedbank / fete / hand ; fêtes : fete.egg.<0..3|gold|shell>, fete.lampion[.lit], fete.lantern[.lit],
// fete.frog[.1], fete.pot[.1] / fete.stand / fete.seedstall (32 × 32), icon.ladle, ribbon.<green|blue|gold>,
// fete.basket[.full], seedpack.generic, npc.mayor[.walk], npc.lili[.walk] (de face, comme npc.joseph) ;
// lanternes : lantern.rack (32 × 32), lantern.<critère>.on/off (8 × 8 : col/row demi-entiers, w = h = 0.5),
// icon.crit.<critère>, icon.lantern.on/off ; F1 : fx.weeds[.1], badge.waiting (8 × 8) ; décors decor.* (dont
// decor.herbarium et decor.lantern.grand en 32 × 32) ; succès icon.ach.<id>[.locked].
// lantern.rack : la lanterne 8 × 8 du crochet (montant m = 0..4, rang r = 0..3) se dessine à
// x = 1 + 6 × m, y = 3 + 7 × r (pixels, à l'intérieur du sprite).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-lot4.py — ne pas modifier à la main.
const lot4 = {
  'album.cover': { sheet: 'lot4', col: 3, row: 0, w: 2, h: 2 },
  'icon.album': { sheet: 'lot4', col: 5, row: 2 },
  'album.page.garden': { sheet: 'lot4', col: 6, row: 2 },
  'album.page.homemade': { sheet: 'lot4', col: 7, row: 2 },
  'album.page.animals': { sheet: 'lot4', col: 8, row: 2 },
  'album.page.sky': { sheet: 'lot4', col: 9, row: 2 },
  'album.page.luck': { sheet: 'lot4', col: 10, row: 2 },
  'album.page.village': { sheet: 'lot4', col: 11, row: 2 },
  'album.page.years': { sheet: 'lot4', col: 12, row: 2 },
  'album.page.fetes': { sheet: 'lot4', col: 13, row: 2 },
  'album.page.edge': { sheet: 'lot4', col: 14, row: 2 },
  'album.page.stories': { sheet: 'lot4', col: 15, row: 2 },
  'album.empty': { sheet: 'lot4', col: 5, row: 3 },
  'album.stamp.gold': { sheet: 'lot4', col: 6, row: 3 },
  'album.stamp.giant': { sheet: 'lot4', col: 7, row: 3 },
  'album.stamp.fete': { sheet: 'lot4', col: 8, row: 3 },
  'album.stamp.visitor': { sheet: 'lot4', col: 9, row: 3 },
  'album.stamp.best': { sheet: 'lot4', col: 10, row: 3 },
  'album.ribbon': { sheet: 'lot4', col: 11, row: 3 },
  'product.wool': { sheet: 'lot4', col: 12, row: 3 },
  'fish.gudgeon': { sheet: 'lot4', col: 13, row: 3 },
  'fish.roach': { sheet: 'lot4', col: 14, row: 3 },
  'fish.perch': { sheet: 'lot4', col: 15, row: 3 },
  'fish.trout': { sheet: 'lot4', col: 0, row: 4 },
  'fish.pike': { sheet: 'lot4', col: 1, row: 4 },
  'winter.deadwood': { sheet: 'lot4', col: 2, row: 4 },
  'winter.pinecone': { sheet: 'lot4', col: 3, row: 4 },
  'winter.holly': { sheet: 'lot4', col: 4, row: 4 },
  'winter.chestnut': { sheet: 'lot4', col: 5, row: 4 },
  'winter.blewit': { sheet: 'lot4', col: 6, row: 4 },
  'winter.mistletoe': { sheet: 'lot4', col: 7, row: 4 },
  'track.hare': { sheet: 'lot4', col: 8, row: 4 },
  'track.deer': { sheet: 'lot4', col: 9, row: 4 },
  'track.fox': { sheet: 'lot4', col: 10, row: 4 },
  'bird.greatTit': { sheet: 'lot4', col: 11, row: 4 },
  'bird.greatTit.1': { sheet: 'lot4', col: 12, row: 4 },
  'bird.blueTit': { sheet: 'lot4', col: 13, row: 4 },
  'bird.blueTit.1': { sheet: 'lot4', col: 14, row: 4 },
  'bird.robin': { sheet: 'lot4', col: 15, row: 4 },
  'bird.robin.1': { sheet: 'lot4', col: 0, row: 5 },
  'bird.sparrow': { sheet: 'lot4', col: 1, row: 5 },
  'bird.sparrow.1': { sheet: 'lot4', col: 2, row: 5 },
  'bird.chaffinch': { sheet: 'lot4', col: 3, row: 5 },
  'bird.chaffinch.1': { sheet: 'lot4', col: 4, row: 5 },
  'bird.bullfinch': { sheet: 'lot4', col: 5, row: 5 },
  'bird.bullfinch.1': { sheet: 'lot4', col: 6, row: 5 },
  'bird.nuthatch': { sheet: 'lot4', col: 7, row: 5 },
  'bird.nuthatch.1': { sheet: 'lot4', col: 8, row: 5 },
  'bird.woodpecker': { sheet: 'lot4', col: 9, row: 5 },
  'bird.woodpecker.1': { sheet: 'lot4', col: 10, row: 5 },
  'feeder': { sheet: 'lot4', col: 15, row: 0, w: 1, h: 2 },
  'feeder.full': { sheet: 'lot4', col: 4, row: 2, w: 1, h: 2 },
  'window.lit': { sheet: 'lot4', col: 11, row: 5 },
  'story.vignette': { sheet: 'lot4', col: 0, row: 0, w: 3, h: 2 },
  'icon.story': { sheet: 'lot4', col: 12, row: 5 },
  'icon.winter': { sheet: 'lot4', col: 13, row: 5 },
  'icon.feeder': { sheet: 'lot4', col: 14, row: 5 },
  'icon.seedbank': { sheet: 'lot4', col: 15, row: 5 },
  'icon.fete': { sheet: 'lot4', col: 0, row: 6 },
  'icon.hand': { sheet: 'lot4', col: 1, row: 6 },
  'fete.egg.0': { sheet: 'lot4', col: 2, row: 6 },
  'fete.egg.1': { sheet: 'lot4', col: 3, row: 6 },
  'fete.egg.2': { sheet: 'lot4', col: 4, row: 6 },
  'fete.egg.3': { sheet: 'lot4', col: 5, row: 6 },
  'fete.egg.gold': { sheet: 'lot4', col: 6, row: 6 },
  'fete.egg.shell': { sheet: 'lot4', col: 7, row: 6 },
  'fete.lampion': { sheet: 'lot4', col: 8, row: 6 },
  'fete.lampion.lit': { sheet: 'lot4', col: 9, row: 6 },
  'fete.lantern': { sheet: 'lot4', col: 10, row: 6 },
  'fete.lantern.lit': { sheet: 'lot4', col: 11, row: 6 },
  'fete.frog': { sheet: 'lot4', col: 12, row: 6 },
  'fete.frog.1': { sheet: 'lot4', col: 13, row: 6 },
  'fete.pot': { sheet: 'lot4', col: 5, row: 0, w: 2, h: 2 },
  'fete.pot.1': { sheet: 'lot4', col: 7, row: 0, w: 2, h: 2 },
  'icon.ladle': { sheet: 'lot4', col: 14, row: 6 },
  'fete.stand': { sheet: 'lot4', col: 9, row: 0, w: 2, h: 2 },
  'ribbon.green': { sheet: 'lot4', col: 15, row: 6 },
  'ribbon.blue': { sheet: 'lot4', col: 0, row: 7 },
  'ribbon.gold': { sheet: 'lot4', col: 1, row: 7 },
  'fete.basket': { sheet: 'lot4', col: 2, row: 7 },
  'fete.basket.full': { sheet: 'lot4', col: 3, row: 7 },
  'fete.seedstall': { sheet: 'lot4', col: 11, row: 0, w: 2, h: 2 },
  'seedpack.generic': { sheet: 'lot4', col: 4, row: 7 },
  'npc.mayor': { sheet: 'lot4', col: 5, row: 7 },
  'npc.mayor.walk': { sheet: 'lot4', col: 6, row: 7 },
  'npc.lili': { sheet: 'lot4', col: 7, row: 7 },
  'npc.lili.walk': { sheet: 'lot4', col: 8, row: 7 },
  'lantern.rack': { sheet: 'lot4', col: 13, row: 0, w: 2, h: 2 },
  'icon.crit.variety': { sheet: 'lot4', col: 9, row: 7 },
  'icon.crit.care': { sheet: 'lot4', col: 10, row: 7 },
  'icon.crit.neighbours': { sheet: 'lot4', col: 11, row: 7 },
  'icon.crit.beauty': { sheet: 'lot4', col: 12, row: 7 },
  'icon.crit.prosperity': { sheet: 'lot4', col: 13, row: 7 },
  'icon.lantern.on': { sheet: 'lot4', col: 14, row: 7 },
  'icon.lantern.off': { sheet: 'lot4', col: 15, row: 7 },
  'fx.weeds': { sheet: 'lot4', col: 0, row: 8 },
  'fx.weeds.1': { sheet: 'lot4', col: 1, row: 8 },
  'decor.scarecrow.flower': { sheet: 'lot4', col: 2, row: 8 },
  'decor.can.golden': { sheet: 'lot4', col: 3, row: 8 },
  'decor.barrow.giant': { sheet: 'lot4', col: 4, row: 8 },
  'decor.jam.shelf': { sheet: 'lot4', col: 5, row: 8 },
  'decor.weathervane.pig': { sheet: 'lot4', col: 6, row: 8 },
  'decor.sundial': { sheet: 'lot4', col: 7, row: 8 },
  'decor.lantern.fairy': { sheet: 'lot4', col: 8, row: 8 },
  'decor.pump.village': { sheet: 'lot4', col: 9, row: 8 },
  'decor.bunting.post': { sheet: 'lot4', col: 10, row: 8 },
  'decor.arch.fete': { sheet: 'lot4', col: 11, row: 8 },
  'decor.woodpile': { sheet: 'lot4', col: 12, row: 8 },
  'decor.heron.wood': { sheet: 'lot4', col: 13, row: 8 },
  'decor.rocking.chair': { sheet: 'lot4', col: 14, row: 8 },
  'decor.herbarium': { sheet: 'lot4', col: 0, row: 2, w: 2, h: 2 },
  'decor.lantern.green': { sheet: 'lot4', col: 15, row: 8 },
  'decor.lantern.blue': { sheet: 'lot4', col: 0, row: 9 },
  'decor.lantern.pink': { sheet: 'lot4', col: 1, row: 9 },
  'decor.lantern.yellow': { sheet: 'lot4', col: 2, row: 9 },
  'decor.lantern.orange': { sheet: 'lot4', col: 3, row: 9 },
  'decor.lantern.grand': { sheet: 'lot4', col: 2, row: 2, w: 2, h: 2 },
  'icon.ach.albumPage': { sheet: 'lot4', col: 4, row: 9 },
  'icon.ach.albumPage.locked': { sheet: 'lot4', col: 5, row: 9 },
  'icon.ach.goldenHerbarium': { sheet: 'lot4', col: 6, row: 9 },
  'icon.ach.goldenHerbarium.locked': { sheet: 'lot4', col: 7, row: 9 },
  'icon.ach.albumComplete': { sheet: 'lot4', col: 8, row: 9 },
  'icon.ach.albumComplete.locked': { sheet: 'lot4', col: 9, row: 9 },
  'icon.ach.brightYear': { sheet: 'lot4', col: 10, row: 9 },
  'icon.ach.brightYear.locked': { sheet: 'lot4', col: 11, row: 9 },
  'icon.ach.allLanterns': { sheet: 'lot4', col: 12, row: 9 },
  'icon.ach.allLanterns.locked': { sheet: 'lot4', col: 13, row: 9 },
  'icon.ach.eggHunter': { sheet: 'lot4', col: 14, row: 9 },
  'icon.ach.eggHunter.locked': { sheet: 'lot4', col: 15, row: 9 },
  'icon.ach.goldRosette': { sheet: 'lot4', col: 0, row: 10 },
  'icon.ach.goldRosette.locked': { sheet: 'lot4', col: 1, row: 10 },
  'icon.ach.birdFriends': { sheet: 'lot4', col: 2, row: 10 },
  'icon.ach.birdFriends.locked': { sheet: 'lot4', col: 3, row: 10 },
  'icon.ach.handPicked500': { sheet: 'lot4', col: 4, row: 10 },
  'icon.ach.handPicked500.locked': { sheet: 'lot4', col: 5, row: 10 },
  'icon.ach.orders50': { sheet: 'lot4', col: 6, row: 10 },
  'icon.ach.orders50.locked': { sheet: 'lot4', col: 7, row: 10 },
  'icon.ach.fullCart': { sheet: 'lot4', col: 8, row: 10 },
  'icon.ach.fullCart.locked': { sheet: 'lot4', col: 9, row: 10 },
  'icon.ach.goldMedals10': { sheet: 'lot4', col: 10, row: 10 },
  'icon.ach.goldMedals10.locked': { sheet: 'lot4', col: 11, row: 10 },
  'lantern.variety.on': { sheet: 'lot4', col: 12, row: 10, w: 0.5, h: 0.5 },
  'lantern.variety.off': { sheet: 'lot4', col: 12.5, row: 10, w: 0.5, h: 0.5 },
  'lantern.care.on': { sheet: 'lot4', col: 12, row: 10.5, w: 0.5, h: 0.5 },
  'lantern.care.off': { sheet: 'lot4', col: 12.5, row: 10.5, w: 0.5, h: 0.5 },
  'lantern.neighbours.on': { sheet: 'lot4', col: 13, row: 10, w: 0.5, h: 0.5 },
  'lantern.neighbours.off': { sheet: 'lot4', col: 13.5, row: 10, w: 0.5, h: 0.5 },
  'lantern.beauty.on': { sheet: 'lot4', col: 13, row: 10.5, w: 0.5, h: 0.5 },
  'lantern.beauty.off': { sheet: 'lot4', col: 13.5, row: 10.5, w: 0.5, h: 0.5 },
  'lantern.prosperity.on': { sheet: 'lot4', col: 14, row: 10, w: 0.5, h: 0.5 },
  'lantern.prosperity.off': { sheet: 'lot4', col: 14.5, row: 10, w: 0.5, h: 0.5 },
  'badge.waiting': { sheet: 'lot4', col: 14, row: 10.5, w: 0.5, h: 0.5 },
  'album.page.feeder': { sheet: 'lot4', col: 13, row: 4 },
};
Object.assign(SPRITES, lot4);
// </lot4:auto>

// <valley1:auto>
// Lot V1 de La Vallée vivante (planche « valley1 », assets/sprites/valley1.png) : « La boîte en fer », style Kenney.
// Variétés : heirloom.<id>.icon (12), heirloom.<id>.3 / .4 (11 cultures ; .0 à .3 et .dead manquants = alias de la
// culture de base, posés ci-dessous), heirloom.rougeVifDEtampes.giant (32 × 32), heirloom.calvilleBlanc.fruit (à poser
// par-dessus tree.apple.*) ; habitants wild.<id>[.1] (regard vers la GAUCHE ; .1 = seconde image), indices
// wild.hint.<tracks|feather|eggs|nuts|note> ; aménagements : nature.hedge.<saison>.<top|mid|bot> (haie verticale :
// haut, milieu répétable, bas), nature.strip.<saison>[.1] (répétable en largeur), nature.nestbox / owlbox / woodpile,
// nature.insectHotel (16 × 32), nature.reeds[.1|.2], nature.oak.sapling / young (16 × 32) / <saison> (32 × 48),
// nature.fallow.<saison> (32 × 32, sur la terre de la parcelle), nature.edge.flowers.<0..2> ; hedgefind.<id>,
// valley.box[.open], valley.label (8 × 8 : col/row demi-entiers, w = h = 0.5), seedpack.heirloom, story.box
// (48 × 32), valley.stage.<0..5> (96 × 48) ; icon.valley, icon.signs, icon.trait.<id>, icon.nature.<kind>,
// fx.birds[.1], fx.butterfly[.1] (8 × 8), album.page.heirlooms / wildlife, decor.seed.cabinet,
// decor.nestbox.painted, decor.valley.linden (32 × 32), icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-valley1.py — ne pas modifier à la main.
const valley1 = {
  'heirloom.jauneDuDoubs.icon': { sheet: 'valley1', col: 9, row: 9 },
  'heirloom.jauneDuDoubs.3': { sheet: 'valley1', col: 10, row: 9 },
  'heirloom.jauneDuDoubs.4': { sheet: 'valley1', col: 11, row: 9 },
  'heirloom.bouleDOr.icon': { sheet: 'valley1', col: 9, row: 10 },
  'heirloom.bouleDOr.3': { sheet: 'valley1', col: 10, row: 10 },
  'heirloom.bouleDOr.4': { sheet: 'valley1', col: 11, row: 10 },
  'heirloom.rougeDeBordeaux.icon': { sheet: 'valley1', col: 12, row: 10 },
  'heirloom.rougeDeBordeaux.4': { sheet: 'valley1', col: 13, row: 10 },
  'heirloom.milanDePontoise.icon': { sheet: 'valley1', col: 14, row: 10 },
  'heirloom.milanDePontoise.3': { sheet: 'valley1', col: 15, row: 10 },
  'heirloom.milanDePontoise.4': { sheet: 'valley1', col: 0, row: 11 },
  'heirloom.coeurDeBoeuf.icon': { sheet: 'valley1', col: 1, row: 11 },
  'heirloom.coeurDeBoeuf.3': { sheet: 'valley1', col: 2, row: 11 },
  'heirloom.coeurDeBoeuf.4': { sheet: 'valley1', col: 3, row: 11 },
  'heirloom.grandRouxBasque.icon': { sheet: 'valley1', col: 4, row: 11 },
  'heirloom.grandRouxBasque.4': { sheet: 'valley1', col: 5, row: 11 },
  'heirloom.soleilDOr.icon': { sheet: 'valley1', col: 6, row: 11 },
  'heirloom.soleilDOr.4': { sheet: 'valley1', col: 7, row: 11 },
  'heirloom.vitelotte.icon': { sheet: 'valley1', col: 8, row: 11 },
  'heirloom.vitelotte.4': { sheet: 'valley1', col: 9, row: 11 },
  'heirloom.reineDesVallees.icon': { sheet: 'valley1', col: 10, row: 11 },
  'heirloom.reineDesVallees.4': { sheet: 'valley1', col: 11, row: 11 },
  'heirloom.rondeDeNice.icon': { sheet: 'valley1', col: 12, row: 11 },
  'heirloom.rondeDeNice.4': { sheet: 'valley1', col: 13, row: 11 },
  'heirloom.rougeVifDEtampes.icon': { sheet: 'valley1', col: 14, row: 11 },
  'heirloom.rougeVifDEtampes.3': { sheet: 'valley1', col: 15, row: 11 },
  'heirloom.rougeVifDEtampes.4': { sheet: 'valley1', col: 0, row: 12 },
  'heirloom.calvilleBlanc.icon': { sheet: 'valley1', col: 1, row: 12 },
  'heirloom.calvilleBlanc.fruit': { sheet: 'valley1', col: 2, row: 12 },
  'heirloom.rougeVifDEtampes.giant': { sheet: 'valley1', col: 12, row: 8, w: 2, h: 2 },
  'wild.robin': { sheet: 'valley1', col: 3, row: 12 },
  'wild.robin.1': { sheet: 'valley1', col: 4, row: 12 },
  'wild.hedgehog': { sheet: 'valley1', col: 5, row: 12 },
  'wild.hedgehog.1': { sheet: 'valley1', col: 6, row: 12 },
  'wild.ladybird': { sheet: 'valley1', col: 7, row: 12 },
  'wild.ladybird.1': { sheet: 'valley1', col: 8, row: 12 },
  'wild.bumblebee': { sheet: 'valley1', col: 9, row: 12 },
  'wild.bumblebee.1': { sheet: 'valley1', col: 10, row: 12 },
  'wild.butterfly': { sheet: 'valley1', col: 11, row: 12 },
  'wild.butterfly.1': { sheet: 'valley1', col: 12, row: 12 },
  'wild.swallow': { sheet: 'valley1', col: 13, row: 12 },
  'wild.swallow.1': { sheet: 'valley1', col: 14, row: 12 },
  'wild.tawnyOwl': { sheet: 'valley1', col: 15, row: 12 },
  'wild.tawnyOwl.1': { sheet: 'valley1', col: 0, row: 13 },
  'wild.frog': { sheet: 'valley1', col: 1, row: 13 },
  'wild.frog.1': { sheet: 'valley1', col: 2, row: 13 },
  'wild.dragonfly': { sheet: 'valley1', col: 3, row: 13 },
  'wild.dragonfly.1': { sheet: 'valley1', col: 4, row: 13 },
  'wild.hare': { sheet: 'valley1', col: 5, row: 13 },
  'wild.hare.1': { sheet: 'valley1', col: 6, row: 13 },
  'wild.squirrel': { sheet: 'valley1', col: 7, row: 13 },
  'wild.squirrel.1': { sheet: 'valley1', col: 8, row: 13 },
  'wild.jay': { sheet: 'valley1', col: 9, row: 13 },
  'wild.jay.1': { sheet: 'valley1', col: 10, row: 13 },
  'wild.hint.tracks': { sheet: 'valley1', col: 11, row: 13 },
  'wild.hint.feather': { sheet: 'valley1', col: 12, row: 13 },
  'wild.hint.eggs': { sheet: 'valley1', col: 13, row: 13 },
  'wild.hint.nuts': { sheet: 'valley1', col: 14, row: 13 },
  'wild.hint.note': { sheet: 'valley1', col: 15, row: 13 },
  'nature.hedge.spring.top': { sheet: 'valley1', col: 0, row: 14 },
  'nature.hedge.spring.mid': { sheet: 'valley1', col: 1, row: 14 },
  'nature.hedge.spring.bot': { sheet: 'valley1', col: 2, row: 14 },
  'nature.hedge.summer.top': { sheet: 'valley1', col: 3, row: 14 },
  'nature.hedge.summer.mid': { sheet: 'valley1', col: 4, row: 14 },
  'nature.hedge.summer.bot': { sheet: 'valley1', col: 5, row: 14 },
  'nature.hedge.autumn.top': { sheet: 'valley1', col: 6, row: 14 },
  'nature.hedge.autumn.mid': { sheet: 'valley1', col: 7, row: 14 },
  'nature.hedge.autumn.bot': { sheet: 'valley1', col: 8, row: 14 },
  'nature.hedge.winter.top': { sheet: 'valley1', col: 9, row: 14 },
  'nature.hedge.winter.mid': { sheet: 'valley1', col: 10, row: 14 },
  'nature.hedge.winter.bot': { sheet: 'valley1', col: 11, row: 14 },
  'nature.strip.spring': { sheet: 'valley1', col: 12, row: 14 },
  'nature.strip.spring.1': { sheet: 'valley1', col: 13, row: 14 },
  'nature.strip.summer': { sheet: 'valley1', col: 14, row: 14 },
  'nature.strip.summer.1': { sheet: 'valley1', col: 15, row: 14 },
  'nature.strip.autumn': { sheet: 'valley1', col: 0, row: 15 },
  'nature.strip.autumn.1': { sheet: 'valley1', col: 1, row: 15 },
  'nature.strip.winter': { sheet: 'valley1', col: 2, row: 15 },
  'nature.strip.winter.1': { sheet: 'valley1', col: 3, row: 15 },
  'nature.nestbox': { sheet: 'valley1', col: 4, row: 15 },
  'nature.owlbox': { sheet: 'valley1', col: 5, row: 15 },
  'nature.woodpile': { sheet: 'valley1', col: 6, row: 15 },
  'nature.insectHotel': { sheet: 'valley1', col: 15, row: 6, w: 1, h: 2 },
  'nature.reeds': { sheet: 'valley1', col: 7, row: 15 },
  'nature.reeds.1': { sheet: 'valley1', col: 8, row: 15 },
  'nature.reeds.2': { sheet: 'valley1', col: 9, row: 15 },
  'nature.oak.sapling': { sheet: 'valley1', col: 10, row: 15 },
  'nature.oak.young': { sheet: 'valley1', col: 8, row: 9, w: 1, h: 2 },
  'nature.oak.spring': { sheet: 'valley1', col: 12, row: 0, w: 2, h: 3 },
  'nature.oak.summer': { sheet: 'valley1', col: 14, row: 0, w: 2, h: 3 },
  'nature.oak.autumn': { sheet: 'valley1', col: 12, row: 3, w: 2, h: 3 },
  'nature.oak.winter': { sheet: 'valley1', col: 14, row: 3, w: 2, h: 3 },
  'nature.fallow.spring': { sheet: 'valley1', col: 14, row: 8, w: 2, h: 2 },
  'nature.fallow.summer': { sheet: 'valley1', col: 0, row: 9, w: 2, h: 2 },
  'nature.fallow.autumn': { sheet: 'valley1', col: 2, row: 9, w: 2, h: 2 },
  'nature.fallow.winter': { sheet: 'valley1', col: 4, row: 9, w: 2, h: 2 },
  'nature.edge.flowers.0': { sheet: 'valley1', col: 11, row: 15 },
  'nature.edge.flowers.1': { sheet: 'valley1', col: 12, row: 15 },
  'nature.edge.flowers.2': { sheet: 'valley1', col: 13, row: 15 },
  'hedgefind.blackberry': { sheet: 'valley1', col: 14, row: 15 },
  'hedgefind.elderflower': { sheet: 'valley1', col: 15, row: 15 },
  'hedgefind.sloe': { sheet: 'valley1', col: 0, row: 16 },
  'hedgefind.hazelnut': { sheet: 'valley1', col: 1, row: 16 },
  'valley.box': { sheet: 'valley1', col: 2, row: 16 },
  'valley.box.open': { sheet: 'valley1', col: 3, row: 16 },
  'seedpack.heirloom': { sheet: 'valley1', col: 4, row: 16 },
  'story.box': { sheet: 'valley1', col: 12, row: 6, w: 3, h: 2 },
  'valley.stage.0': { sheet: 'valley1', col: 0, row: 0, w: 6, h: 3 },
  'valley.stage.1': { sheet: 'valley1', col: 6, row: 0, w: 6, h: 3 },
  'valley.stage.2': { sheet: 'valley1', col: 0, row: 3, w: 6, h: 3 },
  'valley.stage.3': { sheet: 'valley1', col: 6, row: 3, w: 6, h: 3 },
  'valley.stage.4': { sheet: 'valley1', col: 0, row: 6, w: 6, h: 3 },
  'valley.stage.5': { sheet: 'valley1', col: 6, row: 6, w: 6, h: 3 },
  'icon.valley': { sheet: 'valley1', col: 5, row: 16 },
  'icon.signs': { sheet: 'valley1', col: 6, row: 16 },
  'icon.trait.early': { sheet: 'valley1', col: 7, row: 16 },
  'icon.trait.dry': { sheet: 'valley1', col: 8, row: 16 },
  'icon.trait.hardy': { sheet: 'valley1', col: 9, row: 16 },
  'icon.trait.fine': { sheet: 'valley1', col: 10, row: 16 },
  'icon.trait.tasty': { sheet: 'valley1', col: 11, row: 16 },
  'icon.trait.bee': { sheet: 'valley1', col: 12, row: 16 },
  'icon.trait.giant': { sheet: 'valley1', col: 13, row: 16 },
  'icon.nature.hedge': { sheet: 'valley1', col: 14, row: 16 },
  'icon.nature.strip': { sheet: 'valley1', col: 15, row: 16 },
  'icon.nature.nestbox': { sheet: 'valley1', col: 0, row: 17 },
  'icon.nature.owlbox': { sheet: 'valley1', col: 1, row: 17 },
  'icon.nature.woodpile': { sheet: 'valley1', col: 2, row: 17 },
  'icon.nature.insectHotel': { sheet: 'valley1', col: 3, row: 17 },
  'icon.nature.loneTree': { sheet: 'valley1', col: 4, row: 17 },
  'icon.nature.reeds': { sheet: 'valley1', col: 5, row: 17 },
  'icon.nature.fallow': { sheet: 'valley1', col: 6, row: 17 },
  'fx.birds': { sheet: 'valley1', col: 7, row: 17 },
  'fx.birds.1': { sheet: 'valley1', col: 8, row: 17 },
  'album.page.heirlooms': { sheet: 'valley1', col: 9, row: 17 },
  'album.page.wildlife': { sheet: 'valley1', col: 10, row: 17 },
  'decor.seed.cabinet': { sheet: 'valley1', col: 11, row: 17 },
  'decor.nestbox.painted': { sheet: 'valley1', col: 12, row: 17 },
  'decor.valley.linden': { sheet: 'valley1', col: 6, row: 9, w: 2, h: 2 },
  'icon.ach.valleyBox': { sheet: 'valley1', col: 13, row: 17 },
  'icon.ach.valleyBox.locked': { sheet: 'valley1', col: 14, row: 17 },
  'icon.ach.firstSaved': { sheet: 'valley1', col: 15, row: 17 },
  'icon.ach.firstSaved.locked': { sheet: 'valley1', col: 0, row: 18 },
  'icon.ach.seedKeeper': { sheet: 'valley1', col: 1, row: 18 },
  'icon.ach.seedKeeper.locked': { sheet: 'valley1', col: 2, row: 18 },
  'icon.ach.firstNeighbour': { sheet: 'valley1', col: 3, row: 18 },
  'icon.ach.firstNeighbour.locked': { sheet: 'valley1', col: 4, row: 18 },
  'icon.ach.welcomingFarm': { sheet: 'valley1', col: 5, row: 18 },
  'icon.ach.welcomingFarm.locked': { sheet: 'valley1', col: 6, row: 18 },
  'icon.ach.valleySings': { sheet: 'valley1', col: 7, row: 18 },
  'icon.ach.valleySings.locked': { sheet: 'valley1', col: 8, row: 18 },
  'icon.ach.seedHands': { sheet: 'valley1', col: 9, row: 18 },
  'icon.ach.seedHands.locked': { sheet: 'valley1', col: 10, row: 18 },
  'valley.label': { sheet: 'valley1', col: 11, row: 18, w: 0.5, h: 0.5 },
  'fx.butterfly': { sheet: 'valley1', col: 11.5, row: 18, w: 0.5, h: 0.5 },
  'fx.butterfly.1': { sheet: 'valley1', col: 11, row: 18.5, w: 0.5, h: 0.5 },
};
Object.assign(SPRITES, valley1);
// Étapes des variétés que la planche ne redessine pas (0 à 2, le plant 3 quand la variété ne le change pas, le fané) :
// celles de la culture de base. Le pommier (calvilleBlanc) garde tree.apple.* et y pose heirloom.calvilleBlanc.fruit.
const HEIRLOOM_CROPS = {
  jauneDuDoubs: 'carrot', bouleDOr: 'turnip', rougeDeBordeaux: 'wheat', milanDePontoise: 'cabbage',
  coeurDeBoeuf: 'tomato', grandRouxBasque: 'corn', soleilDOr: 'sunflower', vitelotte: 'potato',
  reineDesVallees: 'strawberry', rondeDeNice: 'zucchini', rougeVifDEtampes: 'pumpkin',
};
for (const [id, cropId] of Object.entries(HEIRLOOM_CROPS)) {
  for (const st of ['0', '1', '2', '3', 'dead']) {
    const name = `heirloom.${id}.${st}`;
    if (!SPRITES[name] && SPRITES[`crop.${cropId}.${st}`]) SPRITES[name] = SPRITES[`crop.${cropId}.${st}`];
  }
}
// </valley1:auto>

// <valley2:auto>
// Lot V2 de La Vallée vivante (planche « valley2 », assets/sprites/valley2.png) : « Le troc et les croisements »,
// style Kenney. Variétés du village et croisées : heirloom.<id>.icon (12 + 11 ; les croisées portent un petit sceau
// doré en bas à droite), heirloom.<id>.4 (+ .3 quand la variété change le plant ; .0 à .3 et .dead manquants = alias
// de la culture de base, posés ci-dessous), heirloom.apiEtoile.fruit (à poser par-dessus tree.apple.*), géants
// heirloom.coeurDeBoeufDesVertus / crossCabbage / crossPumpkin.giant (32 × 32) ; Grainothèque library.site,
// library.1 … library.5 (32 × 32), library.window ; troc.pin, seedpack.village, seedpack.cross, jar.empty, jar.glass
// (reflet à poser sur une icône), shelf.wood (autotuile horizontale) ; habitants wild.<wildBee|blackbird|lizard|bat>[.1]
// (regard vers la GAUCHE), wild.hint.<mud|tail|moon> ; nature.batbox, icon.nature.batbox, icon.trait.scented,
// icon.library, icon.swap, icon.cross, fx.pollen[.1] (8 × 8 : col/row demi-entiers, w = h = 0.5) ; story.library,
// story.cross, story.library5 (48 × 32) ; album.page.swaps / crosses / wildlife2 ; decor.swap.basket,
// decor.cross.sign, decor.lizard.wall ; icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-valley2.py — ne pas modifier à la main.
const valley2 = {
  'heirloom.carotteViolette.icon': { sheet: 'valley2', col: 15, row: 0 },
  'heirloom.carotteViolette.3': { sheet: 'valley2', col: 15, row: 1 },
  'heirloom.carotteViolette.4': { sheet: 'valley2', col: 12, row: 2 },
  'heirloom.marteauDesVertus.icon': { sheet: 'valley2', col: 13, row: 2 },
  'heirloom.marteauDesVertus.3': { sheet: 'valley2', col: 14, row: 2 },
  'heirloom.marteauDesVertus.4': { sheet: 'valley2', col: 15, row: 2 },
  'heirloom.barbuDuRoussillon.icon': { sheet: 'valley2', col: 12, row: 3 },
  'heirloom.barbuDuRoussillon.4': { sheet: 'valley2', col: 13, row: 3 },
  'heirloom.coeurDeBoeufDesVertus.icon': { sheet: 'valley2', col: 14, row: 3 },
  'heirloom.coeurDeBoeufDesVertus.3': { sheet: 'valley2', col: 15, row: 3 },
  'heirloom.coeurDeBoeufDesVertus.4': { sheet: 'valley2', col: 0, row: 4 },
  'heirloom.noireDeCrimee.icon': { sheet: 'valley2', col: 1, row: 4 },
  'heirloom.noireDeCrimee.3': { sheet: 'valley2', col: 2, row: 4 },
  'heirloom.noireDeCrimee.4': { sheet: 'valley2', col: 3, row: 4 },
  'heirloom.blancDesLandes.icon': { sheet: 'valley2', col: 4, row: 4 },
  'heirloom.blancDesLandes.4': { sheet: 'valley2', col: 5, row: 4 },
  'heirloom.veloursRouge.icon': { sheet: 'valley2', col: 6, row: 4 },
  'heirloom.veloursRouge.4': { sheet: 'valley2', col: 7, row: 4 },
  'heirloom.bleueDArtois.icon': { sheet: 'valley2', col: 8, row: 4 },
  'heirloom.bleueDArtois.4': { sheet: 'valley2', col: 9, row: 4 },
  'heirloom.madameMoutot.icon': { sheet: 'valley2', col: 10, row: 4 },
  'heirloom.madameMoutot.4': { sheet: 'valley2', col: 11, row: 4 },
  'heirloom.blancheDeVirginie.icon': { sheet: 'valley2', col: 12, row: 4 },
  'heirloom.blancheDeVirginie.4': { sheet: 'valley2', col: 13, row: 4 },
  'heirloom.galeuseDEysines.icon': { sheet: 'valley2', col: 14, row: 4 },
  'heirloom.galeuseDEysines.3': { sheet: 'valley2', col: 15, row: 4 },
  'heirloom.galeuseDEysines.4': { sheet: 'valley2', col: 0, row: 5 },
  'heirloom.apiEtoile.icon': { sheet: 'valley2', col: 1, row: 5 },
  'heirloom.apiEtoile.fruit': { sheet: 'valley2', col: 2, row: 5 },
  'heirloom.crossCarrot.icon': { sheet: 'valley2', col: 3, row: 5 },
  'heirloom.crossCarrot.3': { sheet: 'valley2', col: 4, row: 5 },
  'heirloom.crossCarrot.4': { sheet: 'valley2', col: 5, row: 5 },
  'heirloom.crossTurnip.icon': { sheet: 'valley2', col: 6, row: 5 },
  'heirloom.crossTurnip.3': { sheet: 'valley2', col: 7, row: 5 },
  'heirloom.crossTurnip.4': { sheet: 'valley2', col: 8, row: 5 },
  'heirloom.crossWheat.icon': { sheet: 'valley2', col: 9, row: 5 },
  'heirloom.crossWheat.4': { sheet: 'valley2', col: 10, row: 5 },
  'heirloom.crossCabbage.icon': { sheet: 'valley2', col: 11, row: 5 },
  'heirloom.crossCabbage.3': { sheet: 'valley2', col: 12, row: 5 },
  'heirloom.crossCabbage.4': { sheet: 'valley2', col: 13, row: 5 },
  'heirloom.crossTomato.icon': { sheet: 'valley2', col: 14, row: 5 },
  'heirloom.crossTomato.3': { sheet: 'valley2', col: 15, row: 5 },
  'heirloom.crossTomato.4': { sheet: 'valley2', col: 0, row: 6 },
  'heirloom.crossCorn.icon': { sheet: 'valley2', col: 1, row: 6 },
  'heirloom.crossCorn.4': { sheet: 'valley2', col: 2, row: 6 },
  'heirloom.crossSunflower.icon': { sheet: 'valley2', col: 3, row: 6 },
  'heirloom.crossSunflower.4': { sheet: 'valley2', col: 4, row: 6 },
  'heirloom.crossPotato.icon': { sheet: 'valley2', col: 5, row: 6 },
  'heirloom.crossPotato.4': { sheet: 'valley2', col: 6, row: 6 },
  'heirloom.crossStrawberry.icon': { sheet: 'valley2', col: 7, row: 6 },
  'heirloom.crossStrawberry.4': { sheet: 'valley2', col: 8, row: 6 },
  'heirloom.crossZucchini.icon': { sheet: 'valley2', col: 9, row: 6 },
  'heirloom.crossZucchini.4': { sheet: 'valley2', col: 10, row: 6 },
  'heirloom.crossPumpkin.icon': { sheet: 'valley2', col: 11, row: 6 },
  'heirloom.crossPumpkin.3': { sheet: 'valley2', col: 12, row: 6 },
  'heirloom.crossPumpkin.4': { sheet: 'valley2', col: 13, row: 6 },
  'heirloom.coeurDeBoeufDesVertus.giant': { sheet: 'valley2', col: 9, row: 0, w: 2, h: 2 },
  'heirloom.crossCabbage.giant': { sheet: 'valley2', col: 11, row: 0, w: 2, h: 2 },
  'heirloom.crossPumpkin.giant': { sheet: 'valley2', col: 13, row: 0, w: 2, h: 2 },
  'library.site': { sheet: 'valley2', col: 0, row: 2, w: 2, h: 2 },
  'library.1': { sheet: 'valley2', col: 2, row: 2, w: 2, h: 2 },
  'library.2': { sheet: 'valley2', col: 4, row: 2, w: 2, h: 2 },
  'library.3': { sheet: 'valley2', col: 6, row: 2, w: 2, h: 2 },
  'library.4': { sheet: 'valley2', col: 8, row: 2, w: 2, h: 2 },
  'library.5': { sheet: 'valley2', col: 10, row: 2, w: 2, h: 2 },
  'library.window': { sheet: 'valley2', col: 14, row: 6 },
  'troc.pin': { sheet: 'valley2', col: 15, row: 6 },
  'seedpack.village': { sheet: 'valley2', col: 0, row: 7 },
  'seedpack.cross': { sheet: 'valley2', col: 1, row: 7 },
  'jar.empty': { sheet: 'valley2', col: 2, row: 7 },
  'jar.glass': { sheet: 'valley2', col: 3, row: 7 },
  'shelf.wood': { sheet: 'valley2', col: 4, row: 7 },
  'wild.wildBee': { sheet: 'valley2', col: 5, row: 7 },
  'wild.wildBee.1': { sheet: 'valley2', col: 6, row: 7 },
  'wild.blackbird': { sheet: 'valley2', col: 7, row: 7 },
  'wild.blackbird.1': { sheet: 'valley2', col: 8, row: 7 },
  'wild.lizard': { sheet: 'valley2', col: 9, row: 7 },
  'wild.lizard.1': { sheet: 'valley2', col: 10, row: 7 },
  'wild.bat': { sheet: 'valley2', col: 11, row: 7 },
  'wild.bat.1': { sheet: 'valley2', col: 12, row: 7 },
  'wild.hint.mud': { sheet: 'valley2', col: 13, row: 7 },
  'wild.hint.tail': { sheet: 'valley2', col: 14, row: 7 },
  'wild.hint.moon': { sheet: 'valley2', col: 15, row: 7 },
  'nature.batbox': { sheet: 'valley2', col: 0, row: 8 },
  'icon.nature.batbox': { sheet: 'valley2', col: 1, row: 8 },
  'icon.trait.scented': { sheet: 'valley2', col: 2, row: 8 },
  'icon.library': { sheet: 'valley2', col: 3, row: 8 },
  'icon.swap': { sheet: 'valley2', col: 4, row: 8 },
  'icon.cross': { sheet: 'valley2', col: 5, row: 8 },
  'album.page.swaps': { sheet: 'valley2', col: 6, row: 8 },
  'album.page.crosses': { sheet: 'valley2', col: 7, row: 8 },
  'album.page.wildlife2': { sheet: 'valley2', col: 8, row: 8 },
  'story.library': { sheet: 'valley2', col: 0, row: 0, w: 3, h: 2 },
  'story.cross': { sheet: 'valley2', col: 3, row: 0, w: 3, h: 2 },
  'story.library5': { sheet: 'valley2', col: 6, row: 0, w: 3, h: 2 },
  'decor.swap.basket': { sheet: 'valley2', col: 9, row: 8 },
  'decor.cross.sign': { sheet: 'valley2', col: 10, row: 8 },
  'decor.lizard.wall': { sheet: 'valley2', col: 11, row: 8 },
  'icon.ach.firstSwap': { sheet: 'valley2', col: 12, row: 8 },
  'icon.ach.firstSwap.locked': { sheet: 'valley2', col: 13, row: 8 },
  'icon.ach.villageSeeds': { sheet: 'valley2', col: 14, row: 8 },
  'icon.ach.villageSeeds.locked': { sheet: 'valley2', col: 15, row: 8 },
  'icon.ach.firstCross': { sheet: 'valley2', col: 0, row: 9 },
  'icon.ach.firstCross.locked': { sheet: 'valley2', col: 1, row: 9 },
  'icon.ach.farmHeritage': { sheet: 'valley2', col: 2, row: 9 },
  'icon.ach.farmHeritage.locked': { sheet: 'valley2', col: 3, row: 9 },
  'icon.ach.livingLibrary': { sheet: 'valley2', col: 4, row: 9 },
  'icon.ach.livingLibrary.locked': { sheet: 'valley2', col: 5, row: 9 },
  'icon.ach.valleyFriends': { sheet: 'valley2', col: 6, row: 9 },
  'icon.ach.valleyFriends.locked': { sheet: 'valley2', col: 7, row: 9 },
  'fx.pollen': { sheet: 'valley2', col: 8, row: 9, w: 0.5, h: 0.5 },
  'fx.pollen.1': { sheet: 'valley2', col: 8.5, row: 9, w: 0.5, h: 0.5 },
};
Object.assign(SPRITES, valley2);
// Étapes des variétés que la planche ne redessine pas (0 à 2, le plant 3 quand la variété ne le change pas, le fané) :
// celles de la culture de base. Le pommier (apiEtoile) garde tree.apple.* et y pose heirloom.apiEtoile.fruit.
const HEIRLOOM_CROPS_V2 = {
  carotteViolette: 'carrot', marteauDesVertus: 'turnip', barbuDuRoussillon: 'wheat',
  coeurDeBoeufDesVertus: 'cabbage', noireDeCrimee: 'tomato', blancDesLandes: 'corn',
  veloursRouge: 'sunflower', bleueDArtois: 'potato', madameMoutot: 'strawberry',
  blancheDeVirginie: 'zucchini', galeuseDEysines: 'pumpkin', crossCarrot: 'carrot',
  crossTurnip: 'turnip', crossWheat: 'wheat', crossCabbage: 'cabbage',
  crossTomato: 'tomato', crossCorn: 'corn', crossSunflower: 'sunflower',
  crossPotato: 'potato', crossStrawberry: 'strawberry', crossZucchini: 'zucchini',
  crossPumpkin: 'pumpkin',
};
for (const [id, cropId] of Object.entries(HEIRLOOM_CROPS_V2)) {
  for (const st of ['0', '1', '2', '3', 'dead']) {
    const name = `heirloom.${id}.${st}`;
    if (!SPRITES[name] && SPRITES[`crop.${cropId}.${st}`]) SPRITES[name] = SPRITES[`crop.${cropId}.${st}`];
  }
}
// </valley2:auto>

// <valley3:auto>
// Lot V3 de La Vallée vivante (planches « valley3 », assets/sprites/valley3.png, et « valley3bg »,
// assets/sprites/valley3-bg.png) : « Le ruisseau », style Kenney.
// Vue de la vallée : fonds view.bg.<saison> (192 × 432, planche valley3bg, quatre saisons dessinées) ; lieux posés aux
// coordonnées du cadrage commun, dessinés en été (herbe Kenney recolorée par saison) : place.brook.0 … 4 (64 × 312 :
// h = 19,5 tuiles), place.mill.0 / .1 / .1.a (32 × 48), place.combe.0 … 3 (96 × 96), place.poppies.0 … 3,
// place.oldOrchard.0 … 3 (80 × 80), place.millpond.0 … 3 (80 × 64), place.bocage.0 … 3 (192 × 64, bande du ruisseau
// transparente), place.works (32 × 32), place.sprouts ; view.farm.1 … 4 (48 × 48), view.signpost (16 × 32),
// view.pontoon, view.bench (32 × 16), view.helene[.1], portrait.helene (32 × 32), fx.ripple[.1], fx.mist (32 × 16).
// Grands dessins de la vue : contour (64, 39, 50) au lieu de (63, 38, 49) (pas de neige automatique des planches
// d'hiver ; le givre est posé par le rendu). Habitants wild.<id>[.1] (regard vers la GAUCHE), wild.hint.<pincer|drum|
// hoof|webbed> ; find.cep / chanterelle / hedgehogMushroom ; fish.minnow / chub / browntrout / crayfish ;
// heirloom.reinetteGrise.icon / .fruit (à poser par-dessus tree.apple.*) ; terres sauvages wildland.<sorte>.ground[.1],
// wildland.wood.sprout / hazel / birch (16 × 32), wildland.marsh.puddle / pool (32 × 32) / iris,
// wildland.grassland.tall[.1] / daisies / bush, wildland.sign, wildland.offer ; forest.clearing.0 … 2 ;
// icon.place.<id>, icon.works / view / river, icon.wildland.<sorte> ; story.<hill|helene|brook|combe|poppies|millpond|
// bocage|oldOrchard> (48 × 32), valley.stage.6 / 7 (96 × 48) ; album.page.valleyWild / places ; decor.heron.vane,
// decor.valley.bench, decor.mill.wheel (32 × 32) ; icon.ach.<id>[.locked].
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-valley3.py — ne pas modifier à la main.
const valley3 = {
  'view.bg.spring': { sheet: 'valley3bg', col: 0, row: 0, w: 12, h: 27 },
  'view.bg.summer': { sheet: 'valley3bg', col: 12, row: 0, w: 12, h: 27 },
  'view.bg.autumn': { sheet: 'valley3bg', col: 24, row: 0, w: 12, h: 27 },
  'view.bg.winter': { sheet: 'valley3bg', col: 36, row: 0, w: 12, h: 27 },
  'place.brook.0': { sheet: 'valley3', col: 0, row: 0, w: 4, h: 19.5 },
  'place.brook.1': { sheet: 'valley3', col: 4, row: 0, w: 4, h: 19.5 },
  'place.brook.2': { sheet: 'valley3', col: 8, row: 0, w: 4, h: 19.5 },
  'place.brook.3': { sheet: 'valley3', col: 12, row: 0, w: 4, h: 19.5 },
  'place.brook.4': { sheet: 'valley3', col: 0, row: 20, w: 4, h: 19.5 },
  'place.mill.0': { sheet: 'valley3', col: 12, row: 69, w: 2, h: 3 },
  'place.mill.1': { sheet: 'valley3', col: 14, row: 69, w: 2, h: 3 },
  'place.mill.1.a': { sheet: 'valley3', col: 0, row: 70, w: 2, h: 3 },
  'place.combe.0': { sheet: 'valley3', col: 4, row: 36, w: 6, h: 6 },
  'place.combe.1': { sheet: 'valley3', col: 10, row: 36, w: 6, h: 6 },
  'place.combe.2': { sheet: 'valley3', col: 0, row: 42, w: 6, h: 6 },
  'place.combe.3': { sheet: 'valley3', col: 6, row: 42, w: 6, h: 6 },
  'place.poppies.0': { sheet: 'valley3', col: 0, row: 48, w: 5, h: 5 },
  'place.poppies.1': { sheet: 'valley3', col: 5, row: 48, w: 5, h: 5 },
  'place.poppies.2': { sheet: 'valley3', col: 10, row: 48, w: 5, h: 5 },
  'place.poppies.3': { sheet: 'valley3', col: 0, row: 53, w: 5, h: 5 },
  'place.millpond.0': { sheet: 'valley3', col: 10, row: 58, w: 5, h: 4 },
  'place.millpond.1': { sheet: 'valley3', col: 10, row: 62, w: 5, h: 4 },
  'place.millpond.2': { sheet: 'valley3', col: 0, row: 63, w: 5, h: 4 },
  'place.millpond.3': { sheet: 'valley3', col: 5, row: 63, w: 5, h: 4 },
  'place.bocage.0': { sheet: 'valley3', col: 4, row: 20, w: 12, h: 4 },
  'place.bocage.1': { sheet: 'valley3', col: 4, row: 24, w: 12, h: 4 },
  'place.bocage.2': { sheet: 'valley3', col: 4, row: 28, w: 12, h: 4 },
  'place.bocage.3': { sheet: 'valley3', col: 4, row: 32, w: 12, h: 4 },
  'place.oldOrchard.0': { sheet: 'valley3', col: 5, row: 53, w: 5, h: 5 },
  'place.oldOrchard.1': { sheet: 'valley3', col: 10, row: 53, w: 5, h: 5 },
  'place.oldOrchard.2': { sheet: 'valley3', col: 0, row: 58, w: 5, h: 5 },
  'place.oldOrchard.3': { sheet: 'valley3', col: 5, row: 58, w: 5, h: 5 },
  'place.works': { sheet: 'valley3', col: 14, row: 72, w: 2, h: 2 },
  'place.sprouts': { sheet: 'valley3', col: 15, row: 44 },
  'view.farm.1': { sheet: 'valley3', col: 12, row: 42, w: 3, h: 3 },
  'view.farm.2': { sheet: 'valley3', col: 12, row: 45, w: 3, h: 3 },
  'view.farm.3': { sheet: 'valley3', col: 6, row: 67, w: 3, h: 3 },
  'view.farm.4': { sheet: 'valley3', col: 9, row: 69, w: 3, h: 3 },
  'view.signpost': { sheet: 'valley3', col: 3, row: 40, w: 1, h: 2 },
  'view.pontoon': { sheet: 'valley3', col: 15, row: 45 },
  'view.bench': { sheet: 'valley3', col: 0, row: 73, w: 2, h: 1 },
  'view.helene': { sheet: 'valley3', col: 15, row: 46 },
  'view.helene.1': { sheet: 'valley3', col: 15, row: 47 },
  'fx.ripple': { sheet: 'valley3', col: 15, row: 48 },
  'fx.ripple.1': { sheet: 'valley3', col: 15, row: 49 },
  'fx.mist': { sheet: 'valley3', col: 9, row: 74, w: 2, h: 1 },
  'portrait.helene': { sheet: 'valley3', col: 3, row: 74, w: 2, h: 2 },
  'wild.kingfisher': { sheet: 'valley3', col: 15, row: 50 },
  'wild.kingfisher.1': { sheet: 'valley3', col: 15, row: 51 },
  'wild.crayfish': { sheet: 'valley3', col: 15, row: 52 },
  'wild.crayfish.1': { sheet: 'valley3', col: 15, row: 53 },
  'wild.otter': { sheet: 'valley3', col: 15, row: 54 },
  'wild.otter.1': { sheet: 'valley3', col: 15, row: 55 },
  'wild.heron': { sheet: 'valley3', col: 15, row: 56 },
  'wild.heron.1': { sheet: 'valley3', col: 15, row: 57 },
  'wild.blackWoodpecker': { sheet: 'valley3', col: 15, row: 58 },
  'wild.blackWoodpecker.1': { sheet: 'valley3', col: 15, row: 59 },
  'wild.roeDeer': { sheet: 'valley3', col: 15, row: 60 },
  'wild.roeDeer.1': { sheet: 'valley3', col: 15, row: 61 },
  'wild.salamander': { sheet: 'valley3', col: 15, row: 62 },
  'wild.salamander.1': { sheet: 'valley3', col: 15, row: 63 },
  'wild.skylark': { sheet: 'valley3', col: 15, row: 64 },
  'wild.skylark.1': { sheet: 'valley3', col: 15, row: 65 },
  'wild.hoopoe': { sheet: 'valley3', col: 9, row: 67 },
  'wild.hoopoe.1': { sheet: 'valley3', col: 9, row: 68 },
  'wild.littleOwl': { sheet: 'valley3', col: 8, row: 70 },
  'wild.littleOwl.1': { sheet: 'valley3', col: 8, row: 71 },
  'wild.hint.pincer': { sheet: 'valley3', col: 11, row: 74 },
  'wild.hint.drum': { sheet: 'valley3', col: 12, row: 74 },
  'wild.hint.hoof': { sheet: 'valley3', col: 13, row: 74 },
  'wild.hint.webbed': { sheet: 'valley3', col: 14, row: 74 },
  'find.cep': { sheet: 'valley3', col: 15, row: 74 },
  'find.chanterelle': { sheet: 'valley3', col: 9, row: 75 },
  'find.hedgehogMushroom': { sheet: 'valley3', col: 10, row: 75 },
  'fish.minnow': { sheet: 'valley3', col: 11, row: 75 },
  'fish.chub': { sheet: 'valley3', col: 12, row: 75 },
  'fish.browntrout': { sheet: 'valley3', col: 13, row: 75 },
  'fish.crayfish': { sheet: 'valley3', col: 14, row: 75 },
  'heirloom.reinetteGrise.icon': { sheet: 'valley3', col: 15, row: 75 },
  'heirloom.reinetteGrise.fruit': { sheet: 'valley3', col: 0, row: 76 },
  'wildland.wood.ground': { sheet: 'valley3', col: 1, row: 76 },
  'wildland.wood.ground.1': { sheet: 'valley3', col: 2, row: 76 },
  'wildland.marsh.ground': { sheet: 'valley3', col: 3, row: 76 },
  'wildland.marsh.ground.1': { sheet: 'valley3', col: 4, row: 76 },
  'wildland.grassland.ground': { sheet: 'valley3', col: 5, row: 76 },
  'wildland.grassland.ground.1': { sheet: 'valley3', col: 6, row: 76 },
  'wildland.wood.sprout': { sheet: 'valley3', col: 7, row: 76 },
  'wildland.wood.hazel': { sheet: 'valley3', col: 8, row: 76 },
  'wildland.wood.birch': { sheet: 'valley3', col: 15, row: 42, w: 1, h: 2 },
  'wildland.marsh.puddle': { sheet: 'valley3', col: 9, row: 76 },
  'wildland.marsh.pool': { sheet: 'valley3', col: 5, row: 74, w: 2, h: 2 },
  'wildland.marsh.iris': { sheet: 'valley3', col: 10, row: 76 },
  'wildland.grassland.tall': { sheet: 'valley3', col: 11, row: 76 },
  'wildland.grassland.tall.1': { sheet: 'valley3', col: 12, row: 76 },
  'wildland.grassland.daisies': { sheet: 'valley3', col: 13, row: 76 },
  'wildland.grassland.bush': { sheet: 'valley3', col: 14, row: 76 },
  'wildland.sign': { sheet: 'valley3', col: 15, row: 76 },
  'wildland.offer': { sheet: 'valley3', col: 0, row: 77 },
  'forest.clearing.0': { sheet: 'valley3', col: 1, row: 77 },
  'forest.clearing.1': { sheet: 'valley3', col: 2, row: 77 },
  'forest.clearing.2': { sheet: 'valley3', col: 3, row: 77 },
  'icon.place.brook': { sheet: 'valley3', col: 4, row: 77 },
  'icon.place.poppies': { sheet: 'valley3', col: 5, row: 77 },
  'icon.works': { sheet: 'valley3', col: 6, row: 77 },
  'icon.place.combe': { sheet: 'valley3', col: 7, row: 77 },
  'icon.place.millpond': { sheet: 'valley3', col: 8, row: 77 },
  'icon.place.bocage': { sheet: 'valley3', col: 9, row: 77 },
  'icon.place.oldOrchard': { sheet: 'valley3', col: 10, row: 77 },
  'icon.view': { sheet: 'valley3', col: 11, row: 77 },
  'icon.river': { sheet: 'valley3', col: 12, row: 77 },
  'icon.wildland.wood': { sheet: 'valley3', col: 13, row: 77 },
  'icon.wildland.marsh': { sheet: 'valley3', col: 14, row: 77 },
  'icon.wildland.grassland': { sheet: 'valley3', col: 15, row: 77 },
  'album.page.valleyWild': { sheet: 'valley3', col: 0, row: 78 },
  'album.page.places': { sheet: 'valley3', col: 1, row: 78 },
  'story.hill': { sheet: 'valley3', col: 0, row: 40, w: 3, h: 2 },
  'story.helene': { sheet: 'valley3', col: 2, row: 70, w: 3, h: 2 },
  'story.brook': { sheet: 'valley3', col: 5, row: 70, w: 3, h: 2 },
  'story.combe': { sheet: 'valley3', col: 2, row: 72, w: 3, h: 2 },
  'story.poppies': { sheet: 'valley3', col: 5, row: 72, w: 3, h: 2 },
  'story.millpond': { sheet: 'valley3', col: 8, row: 72, w: 3, h: 2 },
  'story.bocage': { sheet: 'valley3', col: 11, row: 72, w: 3, h: 2 },
  'story.oldOrchard': { sheet: 'valley3', col: 0, row: 74, w: 3, h: 2 },
  'valley.stage.6': { sheet: 'valley3', col: 10, row: 66, w: 6, h: 3 },
  'valley.stage.7': { sheet: 'valley3', col: 0, row: 67, w: 6, h: 3 },
  'decor.heron.vane': { sheet: 'valley3', col: 2, row: 78 },
  'decor.valley.bench': { sheet: 'valley3', col: 3, row: 78 },
  'decor.mill.wheel': { sheet: 'valley3', col: 7, row: 74, w: 2, h: 2 },
  'icon.ach.firstWorks': { sheet: 'valley3', col: 4, row: 78 },
  'icon.ach.firstWorks.locked': { sheet: 'valley3', col: 5, row: 78 },
  'icon.ach.waterBack': { sheet: 'valley3', col: 6, row: 78 },
  'icon.ach.waterBack.locked': { sheet: 'valley3', col: 7, row: 78 },
  'icon.ach.livingValley': { sheet: 'valley3', col: 8, row: 78 },
  'icon.ach.livingValley.locked': { sheet: 'valley3', col: 9, row: 78 },
  'icon.ach.sixPlaces': { sheet: 'valley3', col: 10, row: 78 },
  'icon.ach.sixPlaces.locked': { sheet: 'valley3', col: 11, row: 78 },
  'icon.ach.helenesBook': { sheet: 'valley3', col: 12, row: 78 },
  'icon.ach.helenesBook.locked': { sheet: 'valley3', col: 13, row: 78 },
  'icon.ach.firstWild': { sheet: 'valley3', col: 14, row: 78 },
  'icon.ach.firstWild.locked': { sheet: 'valley3', col: 15, row: 78 },
  'icon.ach.forestBack': { sheet: 'valley3', col: 0, row: 79 },
  'icon.ach.forestBack.locked': { sheet: 'valley3', col: 1, row: 79 },
  'icon.ach.riverAngler': { sheet: 'valley3', col: 2, row: 79 },
  'icon.ach.riverAngler.locked': { sheet: 'valley3', col: 3, row: 79 },
};
Object.assign(SPRITES, valley3);
// </valley3:auto>

// <valley4:auto>
// Lot V4 de La Vallée vivante (planche « valley4 », assets/sprites/valley4.png) : « Les cigognes », style Kenney.
// Légendes : legend.<motherMelon|millEinkorn|farmMarvel|storkPea>.icon ; legend.<id>.0 / .1 / .2 et legend.cloche
// (8 × 12 : sous la cloche de verre translucide, terre sur les 2 dernières lignes) ; legend.jar.
// Cigognes : visitor.whiteStork[.1] (16 × 24, pattes en bas), visitor.whiteStork.fly[.1] (32 × 16), stork.wheel
// (24 × 12) et stork.nest.<pair|chicks|snow> (24 × 20) au même pied (bas du poteau, x = 12), stork.steeple (16 × 24).
// Visiteurs : visitor.<crane|redDeer (32 × 32)|oriole|beaver>[.1], visitor.crane.flock[.1] (48 × 16),
// view.beaverDam (32 × 16), visitor.glowworms, fx.glow[.1] (8 × 8, halo par le code), visitor.hint.<trumpet|antler|
// gnawed|flute|glow>. Bêtes : regard vers la GAUCHE. Forêt de la carte : forest.mixed.<oak|beech|birch|cherry|
// cherry.bloom>, forest.old.0 / .1, forest.fern (tuiles pleines raccordées à forest.green.fill). Vue : valley.stage.8
// (96 × 48), view.village.lights, view.joseph.seated, view.helene.seated, valley.box.gift. Vignettes (48 × 32) :
// story.<melon|mill|marvel|peas|storks|storkNest>, story.epilogue.1 / .2 / .3, postcard.1 … 8. Livre : book.cover
// (64 × 80), book.ribbon (8 × 24). Pictogrammes : icon.<legend|visitor|book|postcard|sound.nature>,
// album.page.<legends|visitors>, decor.<melon.cloche|stork.vane|iron.box>, icon.ach.<id> (grisés par le code).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-valley4.py — ne pas modifier à la main.
const valley4 = {
  'legend.motherMelon.icon': { sheet: 'valley4', col: 9, row: 5 },
  'legend.millEinkorn.icon': { sheet: 'valley4', col: 4, row: 11 },
  'legend.farmMarvel.icon': { sheet: 'valley4', col: 5, row: 11 },
  'legend.storkPea.icon': { sheet: 'valley4', col: 6, row: 11 },
  'legend.motherMelon.0': { sheet: 'valley4', col: 7, row: 11, w: 0.5, h: 0.75 },
  'legend.motherMelon.1': { sheet: 'valley4', col: 8, row: 11, w: 0.5, h: 0.75 },
  'legend.motherMelon.2': { sheet: 'valley4', col: 10, row: 11, w: 0.5, h: 0.75 },
  'legend.millEinkorn.0': { sheet: 'valley4', col: 11, row: 11, w: 0.5, h: 0.75 },
  'legend.millEinkorn.1': { sheet: 'valley4', col: 12, row: 11, w: 0.5, h: 0.75 },
  'legend.millEinkorn.2': { sheet: 'valley4', col: 13, row: 11, w: 0.5, h: 0.75 },
  'legend.farmMarvel.0': { sheet: 'valley4', col: 14, row: 11, w: 0.5, h: 0.75 },
  'legend.farmMarvel.1': { sheet: 'valley4', col: 15, row: 11, w: 0.5, h: 0.75 },
  'legend.farmMarvel.2': { sheet: 'valley4', col: 1, row: 12, w: 0.5, h: 0.75 },
  'legend.storkPea.0': { sheet: 'valley4', col: 2, row: 12, w: 0.5, h: 0.75 },
  'legend.storkPea.1': { sheet: 'valley4', col: 4, row: 12, w: 0.5, h: 0.75 },
  'legend.storkPea.2': { sheet: 'valley4', col: 5, row: 12, w: 0.5, h: 0.75 },
  'legend.cloche': { sheet: 'valley4', col: 6, row: 12, w: 0.5, h: 0.75 },
  'legend.jar': { sheet: 'valley4', col: 7, row: 12 },
  'visitor.whiteStork': { sheet: 'valley4', col: 15, row: 6, w: 1, h: 1.5 },
  'visitor.whiteStork.1': { sheet: 'valley4', col: 9, row: 10, w: 1, h: 1.5 },
  'visitor.whiteStork.fly': { sheet: 'valley4', col: 10, row: 10, w: 2, h: 1 },
  'visitor.whiteStork.fly.1': { sheet: 'valley4', col: 12, row: 10, w: 2, h: 1 },
  'stork.wheel': { sheet: 'valley4', col: 14, row: 10, w: 1.5, h: 0.75 },
  'stork.nest.pair': { sheet: 'valley4', col: 12, row: 8, w: 1.5, h: 1.25 },
  'stork.nest.chicks': { sheet: 'valley4', col: 14, row: 8, w: 1.5, h: 1.25 },
  'stork.nest.snow': { sheet: 'valley4', col: 0, row: 9, w: 1.5, h: 1.25 },
  'stork.steeple': { sheet: 'valley4', col: 0, row: 11, w: 1, h: 1.5 },
  'visitor.crane': { sheet: 'valley4', col: 8, row: 12 },
  'visitor.crane.1': { sheet: 'valley4', col: 9, row: 12 },
  'visitor.crane.flock': { sheet: 'valley4', col: 6, row: 9, w: 3, h: 1 },
  'visitor.crane.flock.1': { sheet: 'valley4', col: 6, row: 10, w: 3, h: 1 },
  'visitor.redDeer': { sheet: 'valley4', col: 2, row: 9, w: 2, h: 2 },
  'visitor.redDeer.1': { sheet: 'valley4', col: 4, row: 9, w: 2, h: 2 },
  'visitor.oriole': { sheet: 'valley4', col: 10, row: 12 },
  'visitor.oriole.1': { sheet: 'valley4', col: 11, row: 12 },
  'visitor.beaver': { sheet: 'valley4', col: 12, row: 12 },
  'visitor.beaver.1': { sheet: 'valley4', col: 13, row: 12 },
  'view.beaverDam': { sheet: 'valley4', col: 1, row: 11, w: 2, h: 1 },
  'visitor.glowworms': { sheet: 'valley4', col: 14, row: 12 },
  'fx.glow': { sheet: 'valley4', col: 15, row: 12, w: 0.5, h: 0.5 },
  'fx.glow.1': { sheet: 'valley4', col: 0, row: 13, w: 0.5, h: 0.5 },
  'visitor.hint.trumpet': { sheet: 'valley4', col: 1, row: 13 },
  'visitor.hint.antler': { sheet: 'valley4', col: 2, row: 13 },
  'visitor.hint.gnawed': { sheet: 'valley4', col: 3, row: 13 },
  'visitor.hint.flute': { sheet: 'valley4', col: 4, row: 13 },
  'visitor.hint.glow': { sheet: 'valley4', col: 5, row: 13 },
  'forest.mixed.oak': { sheet: 'valley4', col: 6, row: 13 },
  'forest.mixed.beech': { sheet: 'valley4', col: 7, row: 13 },
  'forest.mixed.birch': { sheet: 'valley4', col: 8, row: 13 },
  'forest.mixed.cherry': { sheet: 'valley4', col: 9, row: 13 },
  'forest.mixed.cherry.bloom': { sheet: 'valley4', col: 10, row: 13 },
  'forest.old.0': { sheet: 'valley4', col: 11, row: 13 },
  'forest.old.1': { sheet: 'valley4', col: 12, row: 13 },
  'forest.fern': { sheet: 'valley4', col: 13, row: 13 },
  'view.village.lights': { sheet: 'valley4', col: 14, row: 13 },
  'view.joseph.seated': { sheet: 'valley4', col: 15, row: 13 },
  'view.helene.seated': { sheet: 'valley4', col: 0, row: 14 },
  'valley.box.gift': { sheet: 'valley4', col: 1, row: 14 },
  'story.melon': { sheet: 'valley4', col: 10, row: 0, w: 3, h: 2 },
  'story.mill': { sheet: 'valley4', col: 13, row: 0, w: 3, h: 2 },
  'story.marvel': { sheet: 'valley4', col: 10, row: 2, w: 3, h: 2 },
  'story.peas': { sheet: 'valley4', col: 13, row: 2, w: 3, h: 2 },
  'story.storks': { sheet: 'valley4', col: 4, row: 3, w: 3, h: 2 },
  'story.storkNest': { sheet: 'valley4', col: 7, row: 3, w: 3, h: 2 },
  'story.epilogue.1': { sheet: 'valley4', col: 10, row: 4, w: 3, h: 2 },
  'story.epilogue.2': { sheet: 'valley4', col: 13, row: 4, w: 3, h: 2 },
  'story.epilogue.3': { sheet: 'valley4', col: 0, row: 5, w: 3, h: 2 },
  'valley.stage.8': { sheet: 'valley4', col: 4, row: 0, w: 6, h: 3 },
  'postcard.1': { sheet: 'valley4', col: 3, row: 5, w: 3, h: 2 },
  'postcard.2': { sheet: 'valley4', col: 6, row: 5, w: 3, h: 2 },
  'postcard.3': { sheet: 'valley4', col: 9, row: 6, w: 3, h: 2 },
  'postcard.4': { sheet: 'valley4', col: 12, row: 6, w: 3, h: 2 },
  'postcard.5': { sheet: 'valley4', col: 0, row: 7, w: 3, h: 2 },
  'postcard.6': { sheet: 'valley4', col: 3, row: 7, w: 3, h: 2 },
  'postcard.7': { sheet: 'valley4', col: 6, row: 7, w: 3, h: 2 },
  'postcard.8': { sheet: 'valley4', col: 9, row: 8, w: 3, h: 2 },
  'book.cover': { sheet: 'valley4', col: 0, row: 0, w: 4, h: 5 },
  'book.ribbon': { sheet: 'valley4', col: 3, row: 11, w: 0.5, h: 1.5 },
  'icon.legend': { sheet: 'valley4', col: 2, row: 14 },
  'icon.visitor': { sheet: 'valley4', col: 3, row: 14 },
  'icon.book': { sheet: 'valley4', col: 4, row: 14 },
  'icon.postcard': { sheet: 'valley4', col: 5, row: 14 },
  'icon.sound.nature': { sheet: 'valley4', col: 6, row: 14 },
  'album.page.legends': { sheet: 'valley4', col: 7, row: 14 },
  'album.page.visitors': { sheet: 'valley4', col: 8, row: 14 },
  'decor.melon.cloche': { sheet: 'valley4', col: 9, row: 14 },
  'decor.stork.vane': { sheet: 'valley4', col: 10, row: 14 },
  'decor.iron.box': { sheet: 'valley4', col: 11, row: 14 },
  'icon.ach.firstLegend': { sheet: 'valley4', col: 12, row: 14 },
  'icon.ach.legendHarvest': { sheet: 'valley4', col: 13, row: 14 },
  'icon.ach.fourLegends': { sheet: 'valley4', col: 14, row: 14 },
  'icon.ach.storksBack': { sheet: 'valley4', col: 15, row: 14 },
  'icon.ach.storkNest': { sheet: 'valley4', col: 0, row: 15 },
  'icon.ach.rareVisitor': { sheet: 'valley4', col: 1, row: 15 },
  'icon.ach.allVisitors': { sheet: 'valley4', col: 2, row: 15 },
  'icon.ach.valleyBook': { sheet: 'valley4', col: 3, row: 15 },
  'icon.ach.furtherAway': { sheet: 'valley4', col: 4, row: 15 },
};
Object.assign(SPRITES, valley4);
// </valley4:auto>

// <coach:auto>
// Accompagnement (planche « coach », assets/sprites/coach.png) : le doigt de Joseph.
// coach.hand / .1 (16 × 16 : index tendu vers le haut-gauche, bout en (2, 1) ; .1 appuyé avec une onde, bout en (3, 3)),
// coach.hand.press (16 × 16 : appuyé, cercle pointillé centré en (3, 3), remplissage dessiné par le code),
// coach.hand.pinch / .1 (24 × 16 : pouce et index rapprochés, milieu (12, 2) / écartés, bouts (3, 2) et (20, 2)),
// coach.arrow (8 × 8, pointe à DROITE en (7, 3), à tourner), portrait.joseph.point (32 × 32 : montre du doigt en bas).
// Ajoutés à SPRITES ici même (Object.assign), après sa définition.
// Généré par assets/sprites/generate-coach.py — ne pas modifier à la main.
const coach = {
  'coach.hand': { sheet: 'coach', col: 2, row: 1 },
  'coach.hand.1': { sheet: 'coach', col: 3, row: 1 },
  'coach.hand.press': { sheet: 'coach', col: 4, row: 1 },
  'coach.hand.pinch': { sheet: 'coach', col: 2, row: 0, w: 1.5, h: 1 },
  'coach.hand.pinch.1': { sheet: 'coach', col: 4, row: 0, w: 1.5, h: 1 },
  'coach.arrow': { sheet: 'coach', col: 5, row: 1, w: 0.5, h: 0.5 },
  'portrait.joseph.point': { sheet: 'coach', col: 0, row: 0, w: 2, h: 2 },
};
Object.assign(SPRITES, coach);
// </coach:auto>

// Alias du pommier en « culture » (crop.apple.*) : étapes sans saison (été).
Object.assign(SPRITES, {
  'crop.apple.0': SPRITES['tree.apple.sapling'],
  'crop.apple.1': SPRITES['tree.apple.sapling'],
  'crop.apple.2': SPRITES['tree.apple.young'],
  'crop.apple.3': SPRITES['tree.apple.summer'],
  'crop.apple.4': SPRITES['tree.apple.summer.ripe'],
  'crop.apple.icon': SPRITES['tree.apple.icon'],
  'crop.apple.dead': SPRITES['tree.apple.dead'],
});

// Alias de la personnalisation (id de src/data/cosmetics.js) : « decor.<id> », « farmer.outfit.<id> »,
// « farmer.<outfitId> », allées et clôtures (aperçus de l'interface).
// (Lot 4) Seulement les sprites connus : un décor dont la planche n'est pas encore dessinée n'a pas d'alias vide.
for (const [id, name] of Object.entries(DECOR_SPRITES)) if (SPRITES[name]) SPRITES[`decor.${id}`] = SPRITES[name];
for (const [id, i] of Object.entries(OUTFIT_INDEX)) {
  SPRITES[`farmer.${id}`] = SPRITES[`farmer.outfit.${i}`];
  SPRITES[`farmer.outfit.${id.replace(/^outfit\./, '')}`] = SPRITES[`farmer.outfit.${i}`];
}
Object.assign(SPRITES, {
  'decor.path.dirt': SPRITES['path.c'],
  'decor.path.stone': SPRITES['deco.path.stone'],
  'decor.fence.wood': SPRITES['fence.h.mid'],
  'decor.fence.picket': SPRITES['deco.fence.picket.h.mid'],
  'decor.fence.stone': SPRITES['deco.wall.stone.h.mid'],
  'decor.fence.hedge': SPRITES['deco.hedge.h.mid'],
});

/**
 * Nom du sprite d'une culture à une étape (0..4), ou 'dead'.
 * Pour le pommier ('apple'), la saison (facultative) choisit le feuillage : treeSprite().
 */
export function cropSprite(cropId, stage, season) {
  if (cropId === 'apple' && season && stage !== 'dead') return treeSprite(stage, season, stage >= 4);
  return `crop.${cropId}.${stage}`;
}

/** Nom du sprite de parcelle selon son voisinage (ligne horizontale de parcelles) et l'arrosage. */
export function soilSprite(wet, hasLeft, hasRight) {
  const k = wet ? 'wet' : 'dry';
  if (hasLeft && hasRight) return `soil.${k}.h.mid`;
  if (hasLeft) return `soil.${k}.h.right`;
  if (hasRight) return `soil.${k}.h.left`;
  return `soil.${k}.h.single`;
}

/**
 * Rectangle source (en pixels) d'un sprite simple : { sheet, x, y, w, h }.
 * Pour un sprite composé, renvoie null (utiliser drawSprite).
 */
export function spriteRect(name) {
  const s = SPRITES[name];
  if (!s) throw new Error(`Sprite inconnu : ${name}`);
  if (s.layers) return null;
  return { sheet: s.sheet, x: s.col * TILE, y: s.row * TILE, w: (s.w || 1) * TILE, h: (s.h || 1) * TILE };
}

/** Taille d'un sprite en pixels (avant mise à l'échelle). */
export function spriteSize(name) {
  const s = SPRITES[name];
  if (!s) throw new Error(`Sprite inconnu : ${name}`);
  return { w: (s.w || 1) * TILE, h: (s.h || 1) * TILE };
}

/**
 * Dessine un sprite (simple ou composé).
 * @param ctx     contexte 2D (imageSmoothingEnabled = false conseillé)
 * @param images  { farm: HTMLImageElement, town: …, extra: … } (clés de SHEETS)
 * @param name    nom du sprite
 * @param dx, dy  coin haut-gauche de destination (pixels écran)
 * @param opts    { scale = 1, flipX = false }
 */
const NO_OPTS = Object.freeze({});

/** Couches d'un sprite (calculées une fois : pas d'allocation à chaque image). */
function layersOf(s) {
  if (!s._layers) {
    Object.defineProperty(s, '_layers', {
      value: (s.layers || [{ sheet: s.sheet, col: s.col, row: s.row, dx: 0, dy: 0, w: s.w || 1, h: s.h || 1 }]).map((l) => ({
        sheet: l.sheet,
        sx: l.col * TILE,
        sy: l.row * TILE,
        dx: (l.dx || 0) * TILE,
        dy: (l.dy || 0) * TILE,
        w: (l.w || 1) * TILE,
        h: (l.h || 1) * TILE,
      })),
    });
  }
  return s._layers;
}

export function drawSprite(ctx, images, name, dx, dy, opts = NO_OPTS) {
  const s = SPRITES[name];
  if (!s) throw new Error(`Sprite inconnu : ${name}`);
  const scale = opts.scale || 1;
  const layers = layersOf(s);
  const x = Math.round(dx);
  const y = Math.round(dy);
  if (!opts.flipX) {
    // Cas courant : pas de transformation du contexte.
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      ctx.drawImage(images[l.sheet], l.sx, l.sy, l.w, l.h, x + l.dx * scale, y + l.dy * scale, l.w * scale, l.h * scale);
    }
    return;
  }
  const w = (s.w || 1) * TILE;
  ctx.save();
  ctx.translate(x + w * scale, y);
  ctx.scale(-1, 1);
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    ctx.drawImage(images[l.sheet], l.sx, l.sy, l.w, l.h, l.dx * scale, l.dy * scale, l.w * scale, l.h * scale);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Interface (Kenney « UI Pack – Pixel Adventure », CC0), prête pour CSS border-image.
// Chemins relatifs à la racine du jeu. slice = largeur du bord à ne pas étirer (px source).
// Exemple : border: 12px solid transparent; border-image: url(assets/sprites/ui/panel-parchment.png) 8 fill / 16px round;
//           image-rendering: pixelated;  (à grossir ×2 : border-image-width = 2 × slice)
export const UI = {
  // Panneaux 32 × 32 (neuf zones)
  panelParchment:       { src: 'assets/sprites/ui/panel-parchment.png', size: 32, slice: 8 },       // fenêtres, infobulles
  panelParchmentWorn:   { src: 'assets/sprites/ui/panel-parchment-worn.png', size: 32, slice: 8 },
  panelParchmentOrnate: { src: 'assets/sprites/ui/panel-parchment-ornate.png', size: 32, slice: 12 }, // dialogues importants (rivets aux coins et au milieu des côtés)
  panelParchmentGrid:   { src: 'assets/sprites/ui/panel-parchment-grid.png', size: 32, slice: 8 },  // cases / inventaire
  panelWood:            { src: 'assets/sprites/ui/panel-wood.png', size: 32, slice: 8 },            // boutons
  panelWoodWorn:        { src: 'assets/sprites/ui/panel-wood-worn.png', size: 32, slice: 8 },       // bouton survolé / pressé
  panelWoodOrnate:      { src: 'assets/sprites/ui/panel-wood-ornate.png', size: 32, slice: 12 },
  panelSlate:           { src: 'assets/sprites/ui/panel-slate.png', size: 32, slice: 8 },           // barre du haut
  panelSlateLight:      { src: 'assets/sprites/ui/panel-slate-light.png', size: 32, slice: 8 },
  panelSlateRed:        { src: 'assets/sprites/ui/panel-slate-red.png', size: 32, slice: 10 },      // alerte (fermage, faillite)
  panelSlateGreen:      { src: 'assets/sprites/ui/panel-slate-green.png', size: 32, slice: 10 },    // succès
  panelSlateBlue:       { src: 'assets/sprites/ui/panel-slate-blue.png', size: 32, slice: 10 },     // info / météo
  panelWaterGrid:       { src: 'assets/sprites/ui/panel-water-grid.png', size: 32, slice: 8 },
  roundParchment:       { src: 'assets/sprites/ui/round-parchment.png', size: 32 },                  // pastille ronde (icône)
  roundWood:            { src: 'assets/sprites/ui/round-wood.png', size: 32 },
  // Bandeaux horizontaux 96 × 32 (3 tuiles assemblées) : n'étirer que le milieu
  // border-image: url(...) 0 32 fill / 0 32px stretch  (ou 0 64px à ×2)
  bannerRed:            { src: 'assets/sprites/ui/banner-red.png', w: 96, h: 32, sliceX: 32 },       // titre plat
  bannerRedRibbon:      { src: 'assets/sprites/ui/banner-red-ribbon.png', w: 96, h: 32, sliceX: 32 }, // titre à rubans (victoire, niveaux)
  barRedSlate:          { src: 'assets/sprites/ui/bar-red-slate.png', w: 96, h: 32, slice: 8 },     // encart / bouton secondaire
  gaugeRed:             { src: 'assets/sprites/ui/gauge-red.png', w: 48, h: 16, slice: 5 },         // cadre de jauge (remplissage en CSS)
  // Petites tuiles 16 × 16
  buttonClose:          { src: 'assets/sprites/ui/button-close.png', size: 16 },
  buttonRed:            { src: 'assets/sprites/ui/button-red.png', size: 16, slice: 5 },
  buttonSlate:          { src: 'assets/sprites/ui/button-slate.png', size: 16, slice: 5 },
  buttonSlateClose:     { src: 'assets/sprites/ui/button-slate-close.png', size: 16 },
  checkboxOff:          { src: 'assets/sprites/ui/checkbox-off.png', size: 16 },
  checkboxOn:           { src: 'assets/sprites/ui/checkbox-on.png', size: 16 },
  radioOff:             { src: 'assets/sprites/ui/radio-off.png', size: 16 },
  radioOn:              { src: 'assets/sprites/ui/radio-on.png', size: 16 },
  slotParchment:        { src: 'assets/sprites/ui/slot-parchment.png', size: 16, slice: 5 },
  slotWood:             { src: 'assets/sprites/ui/slot-wood.png', size: 16, slice: 5 },
  iconWarning:          { src: 'assets/sprites/ui/icon-warning.png', size: 16 },  // « ! » jaune
  iconAlert:            { src: 'assets/sprites/ui/icon-alert.png', size: 16 },    // « ! » rouge
  iconPlus:             { src: 'assets/sprites/ui/icon-plus.png', size: 16 },
  iconPlusRed:          { src: 'assets/sprites/ui/icon-plus-red.png', size: 16 },
  iconDot:              { src: 'assets/sprites/ui/icon-dot.png', size: 16 },
  iconArrowUp:          { src: 'assets/sprites/ui/icon-arrow-up.png', size: 16 },
};
