// Personnalisation (v3) — données pures, AUCUN effet sur le jeu. Voir docs/GAME_DESIGN.md § 12.7.
//
// Objets : { id, name, category: 'small'|'large'|'path'|'fence'|'outfit', price (écus), isDefault? }
// Un objet acheté est débloqué pour toujours ; une décoration peut être posée sur autant
// d'emplacements qu'on veut. Emplacements (DECOR_SLOTS) : identifiants stables, communs à tous
// les niveaux et aux deux dispositions (portrait / paysage).

export const COSMETICS = [
  // Petit décor (1 tuile)
  { id: 'flowers.red', name: 'Massif de fleurs rouges', category: 'small', price: 10 },
  { id: 'flowers.yellow', name: 'Massif de fleurs jaunes', category: 'small', price: 10 },
  { id: 'flowers.blue', name: 'Massif de fleurs bleues', category: 'small', price: 10 },
  { id: 'flowers.white', name: 'Massif de fleurs blanches', category: 'small', price: 10 },
  { id: 'flowers.pink', name: 'Massif de fleurs roses', category: 'small', price: 10 },
  { id: 'bench', name: 'Banc', category: 'small', price: 20 },
  { id: 'lamp', name: 'Réverbère', category: 'small', price: 25 },
  { id: 'scarecrow', name: 'Épouvantail', category: 'small', price: 20 },
  { id: 'wheelbarrow', name: 'Brouette', category: 'small', price: 15 },
  { id: 'birdhouse', name: 'Nichoir', category: 'small', price: 15 },
  { id: 'gnome', name: 'Nain de jardin', category: 'small', price: 30 },
  { id: 'mailbox', name: 'Boîte aux lettres', category: 'small', price: 15 },
  { id: 'hedge.bush', name: 'Buisson taillé', category: 'small', price: 10 },
  // Grand décor (2 × 2 tuiles)
  { id: 'pond', name: 'Petite mare', category: 'large', price: 50 },
  // Allées
  { id: 'path.dirt', name: 'Allées de terre', category: 'path', price: 0, isDefault: true },
  { id: 'path.stone', name: 'Pavés de pierre', category: 'path', price: 40 },
  // Clôture du champ
  { id: 'fence.wood', name: 'Clôture de bois', category: 'fence', price: 0, isDefault: true },
  { id: 'fence.picket', name: 'Palissade blanche', category: 'fence', price: 40 },
  { id: 'fence.stone', name: 'Muret de pierre', category: 'fence', price: 50 },
  { id: 'fence.hedge', name: 'Haie', category: 'fence', price: 45 },
  // Tenue du fermier
  { id: 'outfit.classic', name: 'Salopette', category: 'outfit', price: 0, isDefault: true },
  { id: 'outfit.checked', name: 'Chemise à carreaux', category: 'outfit', price: 30 },
  { id: 'outfit.gardener', name: 'Tablier de jardinier', category: 'outfit', price: 40 },
  { id: 'outfit.raincoat', name: 'Ciré jaune', category: 'outfit', price: 50 },
];

export const COSMETICS_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id) {
  return COSMETICS_BY_ID[id] || null;
}

/** Emplacements de décoration (kind : 'small' = petit décor, 'large' = grand décor, 'sign' = panneau du nom). */
export const DECOR_SLOTS = [
  { id: 'porch.left', name: 'Devant la maison, à gauche', kind: 'small' },
  { id: 'porch.right', name: 'Devant la maison, à droite', kind: 'small' },
  { id: 'yard.1', name: 'Dans la cour', kind: 'small' },
  { id: 'yard.2', name: 'Dans la cour, près du chemin', kind: 'small' },
  { id: 'gate.left', name: 'Au portail du champ, à gauche', kind: 'small' },
  { id: 'gate.right', name: 'Au portail du champ, à droite', kind: 'small' },
  { id: 'road.1', name: 'Au bord de la route', kind: 'small' },
  { id: 'road.2', name: 'Au bord de la route, plus loin', kind: 'small' },
  { id: 'road.3', name: 'Au bout de la route', kind: 'small' },
  { id: 'field.corner', name: 'Au coin du champ', kind: 'small' },
  { id: 'pond', name: 'Près de la lisière', kind: 'large' },
];

export const DECOR_SLOTS_BY_ID = Object.fromEntries(DECOR_SLOTS.map((s) => [s.id, s]));

/** Emplacement du panneau de la ferme (toujours présent, affiche le nom ; pas un emplacement de décoration). */
export const SIGN_SLOT = { id: 'sign', name: 'Panneau de la ferme', kind: 'sign' };

export const DEFAULT_FARM_NAME = 'Ferme des Tilleuls';
export const FARM_NAME_MAX = 18;

export const DEFAULT_COSMETICS = Object.freeze({
  farmName: DEFAULT_FARM_NAME,
  outfit: 'outfit.classic',
  path: 'path.dirt',
  fence: 'fence.wood',
  decor: Object.freeze({}),
  owned: Object.freeze(['outfit.classic', 'path.dirt', 'fence.wood']),
});
