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
for (const [id, name] of Object.entries(DECOR_SPRITES)) SPRITES[`decor.${id}`] = SPRITES[name];
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
