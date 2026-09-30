// Modules du contenu v3 (lot CORE) vus par l'interface : progression permanente, bonus, succès,
// cosmétiques, produits. Tout est vérifié avant usage : tant qu'un module ou une fonction manque,
// l'interface masque ce qui en dépend et le jeu reste jouable (jeu v2).
//
// v3 = { progression, perks, achievements, cosmetics, products, ready }
//   progression : module src/core/progression.js (fonctions pures, voir docs/ARCHITECTURE.md)
//   perks       : { PERKS, PERK_TIERS, getPerk }
//   achievements: { ACHIEVEMENTS, getAchievement }
//   cosmetics   : { COSMETICS, DECOR_SLOTS, DEFAULT_COSMETICS, DEFAULT_FARM_NAME, FARM_NAME_MAX }
//   products    : { PRODUCTS, getProduct, recipeFor }
//
// loadV3() : chargé une fois au démarrage (import dynamique : un module absent ne casse rien ;
// dans la version publiée, esbuild les inclut dans le paquet unique).
// has(name) : la fonction `progression[name]` existe-t-elle ?

export const v3 = { progression: null, perks: null, achievements: null, cosmetics: null, products: null, ready: false };

/** La fonction de progression `name` est-elle disponible ? */
export function has(name) {
  return typeof v3.progression?.[name] === 'function';
}

async function tryImport(loader) {
  try {
    return await loader();
  } catch (err) {
    console.info('Module v3 absent :', err?.message || err);
    return null;
  }
}

export async function loadV3() {
  const [progression, perks, achievements, cosmetics, products] = await Promise.all([
    tryImport(() => import('../core/progression.js')),
    tryImport(() => import('../data/perks.js')),
    tryImport(() => import('../data/achievements.js')),
    tryImport(() => import('../data/cosmetics.js')),
    tryImport(() => import('../data/products.js')),
  ]);
  Object.assign(v3, { progression, perks, achievements, cosmetics, products });
  // La progression permanente n'est utilisable que si ses fonctions de base sont là.
  v3.ready = !!(progression && has('normalizeProgress') && has('starsAvailable'));
  return v3;
}
