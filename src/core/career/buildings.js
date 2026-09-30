// Mode Carrière — bâtiments à niveaux (pur) : construction sur un emplacement, amélioration, capacités
// (maison → employés, grenier → stock, abris → animaux, serre → parcelles, ateliers → places), achat des
// animaux et des aménagements (ruches, panneaux). Conception : docs/CARRIERE.md § 4 et § 5.
//
// state.career.buildings[id] = { level, lotId, slot (null hors emplacement), pending, lastCollected, paid }
//   pending / lastCollected : production à ramasser des abris (lot CORE-B) ; paid : total payé (patrimoine)
// Ateliers : state.investments[id] = niveau (miroir, lu par src/core/processing.js), state.processing[id].

import { BUILDINGS, BUILDINGS_BY_ID, FARM_ITEMS, buildingMaxLevel, shelterFor } from '../../data/career/buildings.js';
import { MAX_ANIMALS } from '../../data/career/career.js';
import { getRank } from '../../data/career/ranks.js';
import { capacityAt, ensureBuilding, productValueNow } from '../processing.js';
import { productsFor, recipeActive } from '../../data/products.js';
import { getCrop } from '../../data/crops.js';
import { buildingLevel, buildingLevelData, buildingUpkeep, getCareerInvestment } from './effects.js';
import { aboutFields } from '../../data/career/descriptions.js';
import { careerAnimals } from './registry.js';

export function rankLabel(rank) {
  const r = getRank(rank);
  return r ? `Rang ${rank} requis (${r.name}).` : `Rang ${rank} requis.`;
}

export function notEnoughMoney(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

/** Nombre d'employés au plus (maison). */
export function staffCapacity(state) {
  return buildingLevelData(state, 'house')?.staff ?? 0;
}

/** Unités de stock au plus (grenier / silo ; 0 sans grenier). */
export function storageCapacity(state) {
  return buildingLevelData(state, 'storage')?.capacity ?? 0;
}

/** Animaux au plus dans un abri (0 s'il n'est pas construit). */
export function shelterCapacity(state, shelterId) {
  return buildingLevelData(state, shelterId)?.animals ?? 0;
}

/** Nombre total d'animaux de la ferme. */
export function animalCount(state) {
  return careerAnimals().reduce((n, a) => n + (state.investments[a.id] || 0), 0);
}

/** Espèces présentes (au moins un animal). */
export function speciesCount(state) {
  return careerAnimals().filter((a) => (state.investments[a.id] || 0) > 0).length;
}

/** Terrain et emplacement d'un bâtiment de la bande de la maison. */
function homePlacement() {
  return { lotId: 'home', slot: null };
}

/** Bâtiment posé sur un emplacement d'un terrain, ou null. */
export function buildingAt(state, lotId, slot) {
  const lot = state.career.lots.find((l) => l.id === lotId);
  return lot?.slots?.[slot] ?? null;
}

/**
 * Peut-on améliorer (ou construire, pour la bande de la maison) ce bâtiment ?
 * → { ok: true, cost, level (niveau visé), def } | { ok: false, reason }
 */
export function checkUpgrade(state, buildingId) {
  const def = BUILDINGS_BY_ID[buildingId];
  if (!def) return { ok: false, reason: 'Bâtiment inconnu.' };
  const lvl = buildingLevel(state, buildingId);
  if (lvl === 0) {
    if (def.placement === 'slot') return { ok: false, reason: `Construisez d'abord ${def.the ? def.the.toLowerCase() : `« ${def.name} »`} sur un emplacement.` };
    if (def.placement === 'lot') return { ok: false, reason: `Il faut d'abord aménager un terrain en ${def.lotType === 'pond' ? 'mare' : 'serre'}.` };
  }
  if (lvl >= buildingMaxLevel(def)) return { ok: false, reason: 'Niveau maximal atteint.' };
  const next = def.levels[lvl];
  if (next.rank > state.career.rank) return { ok: false, reason: rankLabel(next.rank) };
  if (state.money < next.cost) return { ok: false, reason: notEnoughMoney(next.cost - state.money) };
  return { ok: true, cost: next.cost, level: lvl + 1, def };
}

/**
 * Peut-on construire ce bâtiment sur cet emplacement ? → { ok, cost, def } | { ok: false, reason }
 */
export function checkBuild(state, lotId, slot, buildingId) {
  const def = BUILDINGS_BY_ID[buildingId];
  if (!def) return { ok: false, reason: 'Bâtiment inconnu.' };
  const lot = state.career.lots.find((l) => l.id === lotId);
  if (!lot) return { ok: false, reason: 'Terrain inconnu.' };
  if (!Number.isInteger(slot) || slot < 0 || slot >= (lot.slots?.length || 0)) return { ok: false, reason: 'Emplacement inexistant.' };
  if (lot.slots[slot] !== null) return { ok: false, reason: 'Cet emplacement est déjà occupé.' };
  if (def.placement !== 'slot' || !def.slotTypes.includes(lot.type)) {
    return { ok: false, reason: def.category === 'workshop' ? 'Un atelier se construit dans une cour des ateliers.' : 'Ce bâtiment se construit dans un pré.' };
  }
  if (buildingLevel(state, buildingId) > 0) return { ok: false, reason: `Vous avez déjà ${def.the ? def.the.toLowerCase() : `« ${def.name} »`} (un seul par ferme).` };
  const first = def.levels[0];
  if (first.rank > state.career.rank) return { ok: false, reason: rankLabel(first.rank) };
  if (state.money < first.cost) return { ok: false, reason: notEnoughMoney(first.cost - state.money) };
  return { ok: true, cost: first.cost, def };
}

/** Pose un bâtiment (sans payer) : état, miroir des ateliers. */
export function placeBuilding(state, buildingId, lotId, slot, level = 1, paid = 0) {
  state.career.buildings[buildingId] = { level, lotId, slot, pending: 0, lastCollected: null, paid };
  if (slot !== null) {
    const lot = state.career.lots.find((l) => l.id === lotId);
    lot.slots[slot] = buildingId;
  }
  syncWorkshop(state, buildingId);
}

/** Retire un bâtiment (réaménagement d'un terrain vide). */
export function removeBuilding(state, buildingId) {
  const b = state.career.buildings[buildingId];
  if (!b) return;
  if (b.slot !== null) {
    const lot = state.career.lots.find((l) => l.id === b.lotId);
    if (lot?.slots) lot.slots[b.slot] = null;
  }
  delete state.career.buildings[buildingId];
}

/** Ateliers : state.investments[id] suit le niveau ; places ajoutées (src/core/processing.js). */
function syncWorkshop(state, buildingId) {
  if (BUILDINGS_BY_ID[buildingId]?.category !== 'workshop') return;
  state.investments[buildingId] = buildingLevel(state, buildingId);
  ensureBuilding(state, buildingId);
}

/** Améliore (ou construit, bande de la maison) : paie via api.spend, émet buildingBuilt / buildingUpgraded. */
export function upgradeBuilding(api, buildingId) {
  const { state } = api;
  const check = checkUpgrade(state, buildingId);
  if (!check.ok) return check;
  const existing = state.career.buildings[buildingId];
  api.spend('buildings', check.cost, { asset: 'buildings' });
  if (existing) {
    existing.level = check.level;
    existing.paid = (existing.paid || 0) + check.cost;
    syncWorkshop(state, buildingId);
  } else {
    const { lotId, slot } = homePlacement();
    placeBuilding(state, buildingId, lotId, slot, 1, check.cost);
  }
  const b = state.career.buildings[buildingId];
  onLevelChanged(state, buildingId);
  api.push(existing ? 'buildingUpgraded' : 'buildingBuilt', { buildingId, level: b.level, lotId: b.lotId, slot: b.slot, cost: check.cost });
  return { ok: true, level: b.level, cost: check.cost };
}

/** Construit sur un emplacement de terrain. */
export function buildOnSlot(api, lotId, slot, buildingId) {
  const { state } = api;
  const check = checkBuild(state, lotId, slot, buildingId);
  if (!check.ok) return check;
  api.spend('buildings', check.cost, { asset: 'buildings' });
  placeBuilding(state, buildingId, lotId, slot, 1, check.cost);
  api.push('buildingBuilt', { buildingId, level: 1, lotId, slot, cost: check.cost });
  return { ok: true, cost: check.cost };
}

/** Effets d'un changement de niveau : parcelles de la serre (niveau 2 : 8 parcelles). */
function onLevelChanged(state, buildingId) {
  if (buildingId === 'greenhouse') {
    const b = state.career.buildings.greenhouse;
    const want = buildingLevelData(state, 'greenhouse').plots;
    const lot = state.career.lots.find((l) => l.id === b.lotId);
    if (lot) ensureLotPlots(state, lot, 'greenhouse', want);
  }
}

/**
 * Parcelles d'un terrain : réutilise ses parcelles retirées (même index), puis en ajoute à la fin de
 * state.plots (les index ne sont jamais renumérotés). Renvoie les index créés ou réactivés.
 */
export function ensureLotPlots(state, lot, env, count) {
  const mine = [];
  state.plots.forEach((p, i) => {
    if (p.lot === lot.id) mine.push(i);
  });
  const active = mine.filter((i) => state.plots[i].env === env);
  const added = [];
  for (const i of mine) {
    if (active.length + added.length >= count) break;
    const p = state.plots[i];
    if (p.env === null) {
      resetPlot(p, env);
      added.push(i);
    }
  }
  let nextCell = mine.length;
  while (active.length + added.length < count) {
    state.plots.push(newPlot(lot.id, env, nextCell++));
    added.push(state.plots.length - 1);
  }
  return added;
}

export function newPlot(lotId, env, cell, unlocked = true) {
  return { unlocked, cropId: null, growth: 0, watered: false, lastHarvested: null, fatigued: false, fruit: 0, insured: false, lot: lotId, env, cell, crow: false, crowPenalty: false };
}

function resetPlot(p, env) {
  Object.assign(p, { unlocked: true, cropId: null, growth: 0, watered: false, lastHarvested: null, fatigued: false, fruit: 0, insured: false, env, crow: false, crowPenalty: false });
}

/** Options de construction d'un emplacement (fiche du pré / de la cour des ateliers). */
export function buildOptions(state, lotId, slot) {
  const lot = state.career.lots.find((l) => l.id === lotId);
  if (!lot || !lot.slots) return [];
  return BUILDINGS.filter((b) => b.placement === 'slot' && b.slotTypes.includes(lot.type)).map((b) => {
    const check = checkBuild(state, lotId, slot, b.id);
    return { buildingId: b.id, name: b.name, cost: b.levels[0].cost, rank: b.levels[0].rank, canBuild: check.ok, reason: check.ok ? null : check.reason };
  });
}

/** Description courte des effets d'un niveau (fiche d'un bâtiment). */
export function levelEffects(def, data) {
  if (!data) return {};
  const out = {};
  for (const k of ['staff', 'tiredDays', 'yearEcus', 'capacity', 'plots', 'growth', 'winterGrowth', 'heating', 'priceBonus', 'passersby', 'incomeFactor', 'animals', 'places']) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

/** Ligne de query.career.buildings() pour un bâtiment construit. */
export function buildingInfo(state, buildingId) {
  const def = BUILDINGS_BY_ID[buildingId];
  const b = state.career.buildings[buildingId];
  const level = b ? b.level : 0;
  const check = checkUpgrade(state, buildingId);
  const data = buildingLevelData(state, buildingId);
  const max = buildingMaxLevel(def);
  const out = {
    id: buildingId,
    name: data ? data.name : def.name,
    category: def.category,
    level,
    maxLevel: max,
    nextCost: level < max ? def.levels[level].cost : null,
    nextRank: level < max ? def.levels[level].rank : null,
    nextName: level < max ? def.levels[level].name : null,
    canUpgrade: check.ok,
    reason: check.ok ? null : check.reason,
    effects: levelEffects(def, data),
    nextEffects: level < max ? levelEffects(def, def.levels[level]) : null,
    lotId: b ? b.lotId : null,
    slot: b ? b.slot : null,
    // « Ce que fait ce bâtiment » (fiche) : à quoi il sert, ce que donne ce niveau et chaque niveau, conseils.
    ...aboutFields('building', buildingId, level),
  };
  if (def.category === 'shelter') {
    const count = state.investments[def.animal] || 0;
    out.animals = { id: def.animal, count, capacity: shelterCapacity(state, buildingId) };
    out.pending = b ? b.pending || 0 : 0;
  }
  if (def.category === 'workshop') out.processing = workshopInfo(state, buildingId, level);
  return out;
}

/**
 * Atelier de carrière (fiche) : même forme que `investments()[].processing` des niveaux, plus `source`
 * ('harvest' | 'animal'), `basePlaces`, `extraPlaces` (artisan) et `upkeep` (entretien par jour). Places : niveau (2 à 6) + artisan.
 */
export function workshopInfo(state, buildingId, level) {
  const def = BUILDINGS_BY_ID[buildingId];
  const b = state.processing?.[buildingId];
  const max = buildingMaxLevel(def);
  const shown = Math.max(1, level);
  const all = productsFor(buildingId);
  const places = level > 0 ? capacityAt(state, buildingId, level) : 0;
  return {
    level,
    places,
    basePlaces: def.levels[shown - 1].places,
    extraPlaces: level > 0 ? places - def.levels[level - 1].places : 0,
    nextPlaces: level < max ? capacityAt(state, buildingId, level + 1) : null,
    on: !!b && b.on,
    used: b ? b.places.filter(Boolean).length : 0,
    upkeep: level > 0 ? buildingUpkeep(state, buildingId) : def.upkeep || 0,
    source: all[0]?.source || 'harvest',
    recipes: all.map((pr) => ({
      input: pr.input,
      inputName: getCrop(pr.input)?.name ?? getCareerInvestment(pr.input)?.name ?? pr.input,
      productId: pr.id,
      productName: pr.name,
      days: pr.days,
      value: productValueNow(state, pr.id, 1),
      active: recipeActive(pr, shown),
      minLevel: pr.minLevel ?? 1,
      maxLevel: pr.maxLevel ?? null,
    })),
  };
}

/**
 * Achat d'une unité (animal, ruche, panneau) en carrière. → { ok: true, cost, inv } | { ok: false, reason }
 * Animaux : abri construit et pas plein (« L'étable est pleine : améliorez-la. »), 80 animaux au plus.
 * Ruches : 2 / 4 / 6 selon le rang, et 2 par champ au plus.
 */
export function checkBuyCareer(state, level, id) {
  const inv = getCareerInvestment(id);
  if (!inv) {
    if (BUILDINGS_BY_ID[id]?.category === 'workshop') return { ok: false, reason: 'Un atelier se construit dans une cour des ateliers.' };
    return { ok: false, reason: 'Investissement inconnu.' };
  }
  const owned = state.investments[id] || 0;
  if ((inv.rank ?? 1) > state.career.rank) return { ok: false, reason: rankLabel(inv.rank) };
  let cost;
  if (inv.category === 'animal') {
    const shelterDef = BUILDINGS_BY_ID[inv.shelter] || shelterFor(inv.id);
    if (!shelterDef || buildingLevel(state, shelterDef.id) === 0) {
      return { ok: false, reason: `Il faut d'abord ${shelterDef?.fem ? 'une' : 'un'} ${shelterDef ? shelterDef.name.toLowerCase() : 'abri'}.` };
    }
    if (owned >= shelterCapacity(state, shelterDef.id)) {
      const e = shelterDef.fem ? 'e' : '';
      return { ok: false, reason: `${shelterDef.the} est plein${e} : améliorez-l${shelterDef.fem ? 'a' : 'e'}.` };
    }
    if (animalCount(state) >= MAX_ANIMALS) return { ok: false, reason: `La ferme a déjà ${MAX_ANIMALS} animaux.` };
    cost = inv.price ? inv.price.base + inv.price.step * owned : inv.costs[owned];
  } else {
    const max = itemMax(state, inv);
    if (owned >= max) {
      if (inv.perField && owned < inv.costs.length && owned < (inv.maxByRank?.[Math.min(state.career.rank, 3)] ?? Infinity)) {
        return { ok: false, reason: `Au plus ${inv.perField} par champ : aménagez un autre champ.` };
      }
      return { ok: false, reason: owned >= inv.costs.length ? `Vous avez déjà le maximum (${inv.costs.length}).` : `Au plus ${max} pour l'instant (rang suivant : davantage).` };
    }
    cost = inv.costs[owned];
  }
  if (state.money < cost) return { ok: false, reason: notEnoughMoney(cost - state.money) };
  return { ok: true, cost, inv };
}

/** Unités au plus d'un aménagement (ruches : rang et champs). */
export function itemMax(state, inv) {
  let max = inv.costs.length;
  if (inv.maxByRank) max = Math.min(max, inv.maxByRank[Math.min(state.career.rank, Math.max(...Object.keys(inv.maxByRank).map(Number)))]);
  if (inv.perField) {
    const fields = state.career.lots.filter((l) => l.type === 'field').length;
    max = Math.min(max, inv.perField * fields);
  }
  return max;
}

/** Prix de la prochaine unité (null au maximum). */
export function careerNextCost(state, inv) {
  const owned = state.investments[inv.id] || 0;
  if (inv.category === 'animal') return inv.price ? inv.price.base + inv.price.step * owned : inv.costs?.[owned] ?? null;
  return owned < itemMax(state, inv) ? inv.costs[owned] : null;
}

export { FARM_ITEMS };
