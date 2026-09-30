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

/** Zone (pixels du sprite 32 × 16) où écrire le nom de la ferme sur 'deco.sign.farm'. */
export const FARM_SIGN_TEXT_RECT = Object.freeze({ x: 3, y: 3, w: 26, h: 6 });
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

export const SPRITES = {
  ...crops,
  ...ground,
  ...nature,
  ...fences,
  ...things,
  ...buildings,
  ...buildingParts,
  ...v3,
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
