// Mode Carrière — points d'accroche pour les lots CORE-B (machines, employés, animaux) et CORE-C
// (fêtes, événements, quêtes). Pur : aucun DOM, aucune horloge. Contrat : docs/ARCHITECTURE.md,
// « Mode Carrière — points d'accroche (CORE-A) ».
//
// Un lot s'enregistre UNE fois, au chargement de son module, avec registerCareerExtension(ext) ; la liste
// des modules chargés est dans src/core/career/extensions.js (une ligne d'import par module).
//
//   ext = {
//     id: 'staff',                               // unique ; réenregistrer le même id remplace l'ancien (tests)
//     investments: [ ... ],                      // animaux de carrière (forme d'investissement) : remplacent
//                                                //   ceux de DEFAULT_ANIMALS de même id
//     flags: { collectAnimals: true },           // la production des animaux s'accumule dans les abris (CORE-B)
//                                                //   au lieu d'être payée à l'aube par CORE-A
//     init(state),                               // createCareer : compléter state.career (valeurs par défaut)
//     migrate(state),                            // loadCareer, après migrateCareer : compléter une ancienne sauvegarde
//     check(state) → null | 'problème',          // loadCareer : vérification de SES champs (checkCareerState)
//     hooks: {                                   // appelés par le cœur, dans l'ordre d'enregistrement
//       seasonStart(api, { seasonId, seasonIndex, year }),   // aube, étape 2 (après le gel)
//       dawnEvents(api, { seasonId, weather }),              // aube, étape 3 bis (après la météo) : événements, truffes
//       water(api, { weather }) → [plotIndex],               // aube, étape 7 : arrosage des machines (arroseurs)
//       afterProcessing(api, {}),                            // aube, après l'étape 8 (convoyeur)
//       incomes(api, { seasonId, weather, lastDayOfSeason }) → [{ source, amount, kind, key }],   // étape 9
//       charges(api, { money, seasonId }) → [{ source: 'wages'|'fuel'|…, amount }],               // étape 10
//       dawn(api, { seasonId, newSeason, incomes, charges }),                                      // fin de l'aube
//       tick(api, from, to),                                 // pendant la journée : (from, to] en secondes (elapsed)
//       evening(api, { seasonId, lastDayOfSeason, lastDayOfYear }),  // début de la fin de journée (avant les charges)
//       yearEnd(api, { year, report }),                      // fin d'année, avant l'événement yearEnd (peut compléter report)
//       harvest(api, { plotIndex, cropId, amount, by }) → null | { divert: true, label? },
//                                                            // avant la vente d'une récolte : { divert } = la récolte est
//                                                            //   mise de côté (commande, quête) : rien n'est payé
//     },
//     providers: {                               // valeurs lues par le cœur (sommées ou multipliées)
//       effects(state, key) → number,            // 'priceBonus' | 'growthBonus' | 'chargeReduction' (somme)
//       extraPlaces(state, buildingId) → number, // places d'atelier en plus (artisan)
//       priceFactor(state, { kind: 'crop'|'product'|'stock', id }) → number,   // multiplicateur (fêtes)
//       seedFactor(state, cropId) → number,      // multiplicateur du prix des graines (foire aux semis)
//       patrimony(state) → number,               // valeur ajoutée au patrimoine (déjà pondérée)
//       lotPrice(state, lot) → null | { price, label },  // prix spécial du terrain à vendre (« verger de Joseph »)
//       objective(state, objective) → null | number,     // progression d'un objectif de rang (sinon CORE-A la calcule)
//       unlocks(rank) → [{ kind, id, name }],    // déblocages affichés pour un rang
//     },
//     actions(api) → { name: (...args) => result },   // ajoutées à game.actions.career
//     queries(api) → { name: (...args) => value },    // ajoutées à game.query.career
//   }
//
// `api` (même objet pour tous, créé par partie) : voir createCareerApi dans src/core/career/runtime.js.

import { DEFAULT_ANIMALS } from '../../data/career/buildings.js';

const HOOK_NAMES = ['seasonStart', 'dawnEvents', 'water', 'afterProcessing', 'incomes', 'charges', 'dawn', 'tick', 'evening', 'yearEnd', 'harvest'];
const PROVIDER_NAMES = ['effects', 'extraPlaces', 'priceFactor', 'seedFactor', 'patrimony', 'lotPrice', 'objective', 'unlocks'];

const extensions = new Map();

/** Enregistre (ou remplace, même id) un lot d'extension. Renvoie une fonction qui le retire (tests). */
export function registerCareerExtension(ext) {
  if (!ext || typeof ext.id !== 'string' || !ext.id) throw new Error('Extension de carrière sans identifiant');
  for (const name of Object.keys(ext.hooks || {})) if (!HOOK_NAMES.includes(name)) throw new Error(`Point d'accroche inconnu : ${name}`);
  for (const name of Object.keys(ext.providers || {})) if (!PROVIDER_NAMES.includes(name)) throw new Error(`Fournisseur inconnu : ${name}`);
  extensions.set(ext.id, ext);
  return () => {
    if (extensions.get(ext.id) === ext) extensions.delete(ext.id);
  };
}

/** Retire une extension (tests). */
export function unregisterCareerExtension(id) {
  extensions.delete(id);
}

/** Extensions enregistrées, dans l'ordre d'enregistrement. */
export function careerExtensions() {
  return [...extensions.values()];
}

/** Fonctions d'un point d'accroche, dans l'ordre d'enregistrement. */
export function hooksOf(name) {
  const out = [];
  for (const ext of extensions.values()) {
    const fn = ext.hooks?.[name];
    if (typeof fn === 'function') out.push(fn);
  }
  return out;
}

/** Fournisseurs d'une valeur. */
export function providersOf(name) {
  const out = [];
  for (const ext of extensions.values()) {
    const fn = ext.providers?.[name];
    if (typeof fn === 'function') out.push(fn);
  }
  return out;
}

/** Somme des fournisseurs numériques (effects, extraPlaces, patrimony). */
export function providedSum(name, ...args) {
  let total = 0;
  for (const fn of providersOf(name)) {
    const v = fn(...args);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

/** Produit des fournisseurs multiplicatifs (priceFactor, seedFactor). */
export function providedFactor(name, ...args) {
  let f = 1;
  for (const fn of providersOf(name)) {
    const v = fn(...args);
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) f *= v;
  }
  return f;
}

/** Premier résultat non nul d'un fournisseur (lotPrice, objective). */
export function providedFirst(name, ...args) {
  for (const fn of providersOf(name)) {
    const v = fn(...args);
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

/** Drapeau posé par une extension (ex. collectAnimals). */
export function careerFlag(name) {
  for (const ext of extensions.values()) if (ext.flags?.[name]) return true;
  return false;
}

/**
 * Animaux de carrière (forme d'investissement) : ceux des extensions (CORE-B) remplacent les animaux
 * provisoires de DEFAULT_ANIMALS de même id ; l'ordre est celui de DEFAULT_ANIMALS, puis les nouveaux.
 */
export function careerAnimals() {
  const byId = new Map(DEFAULT_ANIMALS.map((a) => [a.id, a]));
  for (const ext of extensions.values()) for (const inv of ext.investments || []) byId.set(inv.id, inv);
  return [...byId.values()];
}

export function getCareerAnimal(id) {
  return careerAnimals().find((a) => a.id === id) || null;
}
