// Mode Carrière — économie de base (pur) : charges de saison, effets cumulés (étal, ruches, panneaux),
// revenus de l'aube, charges quotidiennes. Lu par src/core/economy.js (branches `state.mode === 'career'`)
// et par src/core/career/runtime.js. N'importe aucun autre module du cœur (pas de cycle avec economy.js).

import { SEASONS } from '../../data/balance.js';
import { DIFFICULTY_CAREER, seasonScale } from '../../data/career/career.js';
import { BUILDINGS_BY_ID, FARM_ITEMS } from '../../data/career/buildings.js';
import { careerAnimals, careerFlag, providedFactor, providedSum } from './registry.js';
// (Vallée V3) Lecteurs purs (heirlooms.js n'importe que des données : aucun cycle avec economy.js).
import { heatingFactorOf, upkeepFactorOf } from './heirlooms.js';

export const FARM_ITEMS_BY_ID = Object.fromEntries(FARM_ITEMS.map((i) => [i.id, i]));

/** true pour un état de carrière. */
export function isCareer(state) {
  return !!state && state.mode === 'career';
}

/** Données de la difficulté de la carrière. */
export function careerDifficulty(state) {
  return DIFFICULTY_CAREER[state.career.difficulty] || DIFFICULTY_CAREER.detente;
}

/**
 * Charges de saison (« Impôts et assurance ») : (base + perLot × terrains achetés) × durée / 7, arrondi.
 * → { amount, base, perLot, lots, scale }
 */
export function seasonChargeDetail(state) {
  const d = careerDifficulty(state);
  const lots = state.career.lotsBought;
  const scale = seasonScale(state.career.seasonLength);
  let amount = Math.round((d.seasonCharge.base + d.seasonCharge.perLot * lots) * scale);
  // (lot 3) Carte « La ristourne de la coopérative » : prochaines charges × 0,8 (fournisseur seasonChargeFactor).
  const factor = providedFactor('seasonChargeFactor', state);
  if (factor !== 1) amount = Math.round(amount * factor);
  return { amount, base: d.seasonCharge.base, perLot: d.seasonCharge.perLot, lots, scale, ...(factor !== 1 ? { reduced: true, factor } : {}) };
}

export function careerSeasonCharge(state) {
  return seasonChargeDetail(state).amount;
}

/** Niveau d'un bâtiment (0 s'il n'est pas construit). */
export function buildingLevel(state, buildingId) {
  return state.career.buildings[buildingId]?.level || 0;
}

/** Données du niveau actuel d'un bâtiment (null s'il n'est pas construit). */
export function buildingLevelData(state, buildingId) {
  const lvl = buildingLevel(state, buildingId);
  const b = BUILDINGS_BY_ID[buildingId];
  return lvl > 0 && b ? b.levels[Math.min(lvl, b.levels.length) - 1] : null;
}

/** Entretien quotidien d'un bâtiment construit. */
export function buildingUpkeep(state, buildingId) {
  const lvl = buildingLevel(state, buildingId);
  const b = BUILDINGS_BY_ID[buildingId];
  if (!b || lvl <= 0) return 0;
  if (b.upkeepByLevel) return b.upkeepByLevel[Math.min(lvl, b.upkeepByLevel.length) - 1];
  return b.upkeep || 0;
}

/** Investissements de carrière possédables avec buyInvestment : animaux puis aménagements (ruches, panneaux). */
// Cache lié au tableau des animaux (lui-même en cache tant que les extensions ne changent pas).
let invCache = { animals: null, list: null, byId: null };
export function careerInvestments() {
  const animals = careerAnimals();
  if (invCache.animals !== animals) {
    const list = Object.freeze([...animals, ...FARM_ITEMS]);
    const byId = new Map();
    for (const i of list) if (!byId.has(i.id)) byId.set(i.id, i); // le premier, comme find()
    invCache = { animals, list, byId };
  }
  return invCache.list;
}

export function getCareerInvestment(id) {
  careerInvestments();
  return invCache.byId.get(id) || null;
}

/**
 * Somme d'un effet en carrière : investissements possédés (ruches, panneaux, animaux), niveaux des
 * bâtiments (étal : priceBonus), puis fournisseurs des extensions (vendeur, charrette de Joseph…).
 */
export function careerEffectTotal(state, key) {
  let total = 0;
  for (const inv of careerInvestments()) {
    const n = state.investments[inv.id] || 0;
    const v = inv.effects?.[key];
    if (n > 0 && typeof v === 'number') total += v * (inv.kind === 'upgrade' ? 1 : n);
  }
  if (key === 'priceBonus') {
    for (const id of Object.keys(state.career.buildings)) {
      const v = buildingLevelData(state, id)?.priceBonus;
      if (typeof v === 'number') total += v;
    }
  }
  return total + providedSum('effects', state, key);
}

/**
 * Revenus de l'aube (sans les extensions) : [{ source, amount, owned, kind, key }].
 *   animaux (sauf si une extension pose collectAnimals : production à ramasser), tonte au dernier jour de
 *   saison, miel, passants de l'étal (rien les jours d'orage), chambre d'hôte.
 *   key : poste du bilan de l'année (state.career.yearStats.incomeBy)
 * @param {string|null} weatherId météo du jour (null : estimation, sans effet météo)
 */
export function careerIncomes(state, seasonIndex, weatherId, lastDayOfSeason) {
  const season = SEASONS[seasonIndex];
  const out = [];
  const collect = careerFlag('collectAnimals');
  for (const inv of careerInvestments()) {
    const n = state.investments[inv.id] || 0;
    if (n === 0) continue;
    const isAnimal = inv.category === 'animal';
    if (isAnimal && collect) continue;
    const amount = (inv.income?.[season] || 0) * (inv.kind === 'upgrade' ? 1 : n);
    const key = inv.incomeKey || (isAnimal ? 'animals' : 'other');
    if (amount > 0) out.push({ source: inv.id, amount, owned: n, kind: 'daily', key });
    if (lastDayOfSeason && inv.effects?.shearing && inv.effects.shearingSeasons?.includes(season)) {
      out.push({ source: inv.id, amount: inv.effects.shearing * n, owned: n, kind: 'shearing', key: 'animals' });
    }
  }
  const stand = buildingLevelData(state, 'roadsideStand');
  if (stand) {
    const def = BUILDINGS_BY_ID.roadsideStand;
    const blocked = weatherId && def.noIncomeOn.includes(weatherId);
    const amount = blocked ? 0 : Math.round((def.income[season] || 0) * stand.passersby);
    if (amount > 0) out.push({ source: 'roadsideStand', amount, owned: buildingLevel(state, 'roadsideStand'), kind: 'passersby', key: 'passersby' });
  }
  const guests = buildingLevelData(state, 'guestHouse');
  if (guests) {
    const def = BUILDINGS_BY_ID.guestHouse;
    const amount = Math.round((def.income[season] || 0) * guests.incomeFactor);
    if (amount > 0) out.push({ source: 'guestHouse', amount, owned: buildingLevel(state, 'guestHouse'), kind: 'daily', key: 'guests' });
  }
  return out;
}

/**
 * Charges quotidiennes de base (sans les salaires ni le carburant des extensions) :
 *   ferme (difficulté) + entretien (animaux, bâtiments) − panneaux solaires (≥ 0) + chauffage de la serre (hiver).
 * → { fixed, heating, total, detail: [{ source: 'farm'|'upkeep'|'solar'|'heating', amount }] } (solar : montant négatif)
 */
export function careerDailyCharges(state, level, seasonIndex) {
  const farm = level.dailyCharge;
  let upkeep = 0;
  let animalUpkeep = 0;
  for (const inv of careerInvestments()) {
    const n = state.investments[inv.id] || 0;
    if (n > 0) upkeep += (inv.upkeep || 0) * (inv.kind === 'upgrade' ? 1 : n);
    if (n > 0 && inv.category === 'animal') animalUpkeep += (inv.upkeep || 0) * n;
  }
  // (Vallée V3) Foin de la prairie des Coquelicots : entretien des ANIMAUX × 0,9 (− 10 % de leur part, arrondi au
  // centième ; rien ne change sans l'avantage).
  const hay = state.career.valley ? upkeepFactorOf(state) : 1;
  if (hay !== 1 && animalUpkeep > 0) upkeep -= Math.round(animalUpkeep * (1 - hay) * 100) / 100;
  for (const id of Object.keys(state.career.buildings)) upkeep += buildingUpkeep(state, id);
  const solar = Math.min(farm + upkeep, careerEffectTotal(state, 'chargeReduction'));
  const fixed = Math.max(0, farm + upkeep - solar);
  const gh = buildingLevelData(state, 'greenhouse');
  // (Vallée V3) Bois mort du bois de la Combe : chauffage de la serre × 0,5.
  const heating = gh && SEASONS[seasonIndex] === 'winter' ? (gh.heating || 0) * (state.career.valley ? heatingFactorOf(state) : 1) : 0;
  const detail = [{ source: 'farm', amount: farm }];
  if (upkeep > 0) detail.push({ source: 'upkeep', amount: upkeep });
  if (solar > 0) detail.push({ source: 'solar', amount: -solar });
  if (heating > 0) detail.push({ source: 'heating', amount: heating });
  return { fixed, heating, total: fixed + heating, detail };
}
