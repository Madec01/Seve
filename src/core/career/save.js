// Mode Carrière — versions et vérification de la sauvegarde (pur). Conception : docs/CARRIERE.md § 1.8.
//
// state.career.version (CAREER_VERSION) : migrateCareer(saved) fait passer chaque version à la suivante
// (champs ajoutés à leur valeur par défaut) ; une version inconnue (plus récente) est REFUSÉE (erreur
// `code: 'newer'`, message « Cette sauvegarde vient d'une version plus récente du jeu ») sans être effacée.
// checkCareerState(state) renvoie le premier problème trouvé, ou null.

import { DAY_SECONDS, SEASONS, SPEEDS, WEATHER_TYPES } from '../../data/balance.js';
import { checkOptions } from '../options.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { getProduct } from '../../data/products.js';
import { COSMETICS_BY_ID, DECOR_SLOTS_BY_ID, FARM_NAME_MAX } from '../../data/cosmetics.js';
import { CAREER_SCHEMA, CAREER_VERSION, DIFFICULTY_CAREER, FARMER_GENDERS, INCOME_KEYS, MAX_LOTS, MAX_STAFF, SEASON_LENGTHS, SPENT_KEYS, STORAGE_MODES } from '../../data/career/career.js';
import { BUILDINGS_BY_ID, WORKSHOPS, buildingMaxLevel } from '../../data/career/buildings.js';
import { FIRST_LOT_INDEX, FIXED_LOTS, LOT_GRID, START_FIELD, getLotType, inLotGrid, lotCellOf, lotIdAt } from '../../data/career/lots.js';
import { ALL_OBJECTIVES, MAX_RANK } from '../../data/career/ranks.js';
import { capacityAt } from '../processing.js';
import { getCareerInvestment } from './effects.js';
import { careerExtensions } from './registry.js';
import { shelterCapacity, staffCapacity, storageCapacity } from './buildings.js';
import { planVariety } from './heirlooms.js';

export { CAREER_SCHEMA, CAREER_VERSION };

/** Version de l'état de jeu (même que STATE_VERSION de game.js ; répétée ici pour éviter un cycle). */
export const CAREER_STATE_VERSION = 2;

export const NEWER_SAVE_MESSAGE = 'Cette sauvegarde vient d\'une version plus récente du jeu.';

/** Valeurs par défaut des champs de state.career (création, et migration des champs absents). */
export function defaultCareerFields() {
  return {
    rank: 1,
    objectives: {},
    lotsBought: 0,
    buildings: {},
    machines: {},
    staff: [],
    candidates: [],
    candidatesDay: 0,
    nextStaffId: 1,
    stock: {},
    storageMode: 'low',
    events: { active: null, offers: [], calendarDone: [], fishedDay: 0, lastKind: null },
    contest: null,
    quest: null,
    joseph: { hearts: 0, questsDone: 0, gifts: [] },
    pets: { cat: false, dog: false },
    hardship: null,
    history: [],
    lifetime: { harvests: 0, handPicked: 0, productsSold: 0, truffles: 0, questsDone: 0, contestsWon: 0, cropsInSeason: {} },
    cosmetics: { decor: {} },
    yearStats: emptyYearStats(),
    paid: { buildings: 0, machines: 0, animals: 0 },
    assetLog: [],
    bestPatrimony: 0,
  };
}

export function emptyYearStats() {
  return { incomeBy: Object.fromEntries(INCOME_KEYS.map((k) => [k, 0])), spentBy: Object.fromEntries(SPENT_KEYS.map((k) => [k, 0])), cropIncome: {} };
}

/**
 * Migre une sauvegarde de carrière (objet issu de game.serialize(), mode 'career') vers CAREER_VERSION.
 * Renvoie un NOUVEL objet. Lève une erreur (code 'newer') pour une version plus récente.
 */
export function migrateCareer(saved) {
  if (!saved || typeof saved !== 'object' || saved.mode !== 'career' || !saved.career || typeof saved.career !== 'object') {
    throw new Error('Sauvegarde de carrière invalide');
  }
  const v = saved.career.version;
  if (!Number.isInteger(v) || v < 1) throw new Error('Sauvegarde de carrière invalide : version');
  if (v > CAREER_VERSION) {
    const err = new Error(NEWER_SAVE_MESSAGE);
    err.code = 'newer';
    throw err;
  }
  const s = JSON.parse(JSON.stringify(saved));
  // v1 → v2 : carte 2D. Les terrains achetés s'empilaient en colonne : ils gardent la colonne 0 et les rangées
  // 1, 2, 3… dans l'ordre d'achat (même identifiant « lot3 »…, même image) ; la ferme de départ est la case (0, 0).
  if (s.career.version < 2) {
    if (Array.isArray(s.career.lots)) {
      for (const l of s.career.lots) {
        if (!l || typeof l !== 'object') continue;
        if (!Number.isInteger(l.index) || l.index < FIRST_LOT_INDEX) {
          l.col = LOT_GRID.home.col;
          l.row = LOT_GRID.home.row;
        } else {
          l.col = 0;
          l.row = l.index - FIXED_LOTS.length + 1;
        }
      }
    }
    s.career.version = 2;
  }
  // Champs ajoutés sans changer de version (ajouts compatibles) : complétés à leur valeur par défaut.
  const defaults = defaultCareerFields();
  for (const [k, val] of Object.entries(defaults)) if (s.career[k] === undefined) s.career[k] = val;
  for (const [k, val] of Object.entries(defaults.lifetime)) if (s.career.lifetime[k] === undefined) s.career.lifetime[k] = val;
  for (const [k, val] of Object.entries(defaults.paid)) if (s.career.paid[k] === undefined) s.career.paid[k] = val;
  if (!s.career.yearStats.cropIncome || typeof s.career.yearStats.cropIncome !== 'object') s.career.yearStats.cropIncome = {};
  for (const k of ['incomeBy', 'spentBy']) {
    if (!s.career.yearStats[k] || typeof s.career.yearStats[k] !== 'object') s.career.yearStats[k] = defaults.yearStats[k];
    for (const [key, val] of Object.entries(defaults.yearStats[k])) if (s.career.yearStats[k][key] === undefined) s.career.yearStats[k][key] = val;
  }
  if (Array.isArray(s.plots)) {
    for (const p of s.plots) {
      if (!p || typeof p !== 'object') continue;
      if (p.crow === undefined) p.crow = false;
      if (p.crowPenalty === undefined) p.crowPenalty = false;
    }
  }
  s.career.version = CAREER_VERSION;
  for (const ext of careerExtensions()) if (typeof ext.migrate === 'function') ext.migrate(s);
  return s;
}

/** Vérifie un état de carrière chargé. Renvoie un message (premier problème) ou null. */
export function checkCareerState(s) {
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(s) || s.mode !== 'career') return 'mode';
  if (s.version !== CAREER_STATE_VERSION) return 'version';
  const c = s.career;
  if (!obj(c) || c.version !== CAREER_VERSION) return 'version de carrière';
  if (!['playing', 'bankrupt'].includes(s.status)) return 'statut';
  if (!SPEEDS.includes(s.speed)) return 'vitesse';
  const opt = checkOptions(s);
  if (opt) return opt;
  if (!num(s.money) || !num(s.startMoney)) return 'argent';
  if (!DIFFICULTY_CAREER[c.difficulty] || s.difficulty !== c.difficulty) return 'difficulté';
  if (!SEASON_LENGTHS.includes(c.seasonLength)) return 'durée des saisons';
  const L = c.seasonLength;
  if (!FARMER_GENDERS.includes(c.farmerGender)) return 'fermier ou fermière';
  if (typeof c.farmName !== 'string' || c.farmName.trim().length < 1 || [...c.farmName].length > FARM_NAME_MAX) return 'nom de la ferme';
  if (COSMETICS_BY_ID[c.outfit]?.category !== 'outfit') return 'tenue';
  // Calendrier
  const t = s.time;
  if (!obj(t) || !int(t.year, 1, 100000)) return 'année';
  if (!int(t.seasonIndex, 0, SEASONS.length - 1)) return 'saison';
  if (!int(t.dayOfSeason, 1, L)) return 'jour de la saison';
  if (t.day !== t.seasonIndex * L + t.dayOfSeason) return 'jour';
  if (!num(t.elapsed) || t.elapsed < 0 || t.elapsed > DAY_SECONDS) return 'heure';
  if (!s.weather || !WEATHER_TYPES[s.weather.today] || !WEATHER_TYPES[s.weather.tomorrow]) return 'météo';
  if (!obj(s.perks) || Object.keys(s.perks).length > 0) return 'bonus';
  if (!s.rng || !['weather', 'market', 'rot', 'career', 'staff', 'events'].every((k) => Number.isInteger(s.rng[k]))) return 'aléatoire';
  if (!obj(s.market) || Object.values(s.market).some((m) => !num(m))) return 'marché';
  // Rang et objectifs
  if (!int(c.rank, 1, MAX_RANK)) return 'rang';
  if (!obj(c.objectives)) return 'objectifs';
  for (const [id, v] of Object.entries(c.objectives)) if (v !== true || !ALL_OBJECTIVES.some((o) => o.id === id)) return `objectif ${id}`;
  // Terrains
  if (!Array.isArray(c.lots) || c.lots.length < FIXED_LOTS.length) return 'terrains';
  if (!int(c.lotsBought, 0, MAX_LOTS) || c.lots.length !== FIXED_LOTS.length + c.lotsBought) return 'terrains achetés';
  const lotIds = new Set();
  const cells = new Set([`${LOT_GRID.home.col},${LOT_GRID.home.row}`]);
  for (let k = 0; k < c.lots.length; k++) {
    const l = c.lots[k];
    if (!obj(l)) return 'terrain';
    const fixed = FIXED_LOTS[k];
    if (l.index !== k) return `terrain ${k}`;
    if (fixed) {
      if (l.id !== fixed.id || l.col !== LOT_GRID.home.col || l.row !== LOT_GRID.home.row) return `terrain ${k}`;
    } else {
      // Case de la grille (ou colonne 0 d'une ancienne carrière), identifiant de la case, case libre, et qui
      // touche la ferme ou un terrain acheté avant lui.
      const cell = lotCellOf(l.id);
      if (!cell || cell.col !== l.col || cell.row !== l.row || l.id !== lotIdAt(l.col, l.row)) return `terrain ${k}`;
      if (!inLotGrid(l.col, l.row) && !(l.col === 0 && l.row >= 1 && l.row <= LOT_GRID.legacyRows)) return `case du terrain ${l.id}`;
      if (cells.has(`${l.col},${l.row}`)) return `case du terrain ${l.id}`;
      if (![[0, 1], [0, -1], [-1, 0], [1, 0]].some(([dc, dr]) => cells.has(`${l.col + dc},${l.row + dr}`))) return `terrain isolé ${l.id}`;
      cells.add(`${l.col},${l.row}`);
    }
    if (fixed ? l.type !== fixed.type : !getLotType(l.type)) return `type du terrain ${l.id}`;
    if (!num(l.pricePaid) || !num(l.developPaid) || l.pricePaid < 0 || l.developPaid < 0) return `prix du terrain ${l.id}`;
    const slotsWanted = l.type === 'yard' ? 2 : getLotType(l.type)?.slots || 0;
    if (slotsWanted > 0) {
      if (!Array.isArray(l.slots) || l.slots.length !== slotsWanted) return `emplacements du terrain ${l.id}`;
      for (let slot = 0; slot < l.slots.length; slot++) {
        const b = l.slots[slot];
        if (b === null) continue;
        const bs = c.buildings[b];
        if (!BUILDINGS_BY_ID[b] || !bs || bs.lotId !== l.id || bs.slot !== slot) return `emplacement du terrain ${l.id}`;
      }
    } else if (l.slots !== null) return `emplacements du terrain ${l.id}`;
    if (l.plan !== null) {
      // (Vallée vivante) 'heirloom:<id>' : une variété ancienne (vérifiée par l'extension valley).
      if (!obj(l.plan) || !SEASONS.every((sid) => l.plan[sid] === null || l.plan[sid] === 'same' || !!getCrop(l.plan[sid]) || (!!c.valley && !!planVariety(l.plan[sid])))) return `plan du terrain ${l.id}`;
    }
    lotIds.add(l.id);
  }
  // Bâtiments
  if (!obj(c.buildings)) return 'bâtiments';
  for (const [id, b] of Object.entries(c.buildings)) {
    const def = BUILDINGS_BY_ID[id];
    if (!def || !obj(b) || !int(b.level, 1, buildingMaxLevel(def))) return `bâtiment ${id}`;
    if (!lotIds.has(b.lotId)) return `terrain du bâtiment ${id}`;
    if (def.placement === 'slot') {
      const lot = c.lots.find((l) => l.id === b.lotId);
      if (!Number.isInteger(b.slot) || lot.slots?.[b.slot] !== id) return `emplacement du bâtiment ${id}`;
    } else if (b.slot !== null) return `emplacement du bâtiment ${id}`;
    if (def.placement === 'lot' && c.lots.find((l) => l.id === b.lotId).type !== def.lotType) return `terrain du bâtiment ${id}`;
    if (!num(b.pending) || b.pending < 0) return `production du bâtiment ${id}`;
  }
  if (!c.buildings.house || !c.buildings.coop) return 'maison ou poulailler absent';
  // Parcelles
  if (!Array.isArray(s.plots) || s.plots.length < START_FIELD.cols * START_FIELD.rows || s.plots.length > 400) return 'parcelles';
  for (const p of s.plots) {
    if (!obj(p) || typeof p.unlocked !== 'boolean' || !lotIds.has(p.lot) || !int(p.cell, 0, 63)) return 'parcelle';
    if (![null, 'field', 'orchard', 'greenhouse'].includes(p.env)) return 'type de parcelle';
    if (p.cropId !== null) {
      const crop = getCrop(p.cropId);
      if (!crop) return `culture inconnue (${p.cropId})`;
      if (!p.unlocked || p.env === null) return 'culture sur une parcelle fermée';
      if ((p.env === 'orchard') !== isTreeCrop(crop)) return 'culture sur le mauvais terrain';
    }
    if (!num(p.growth) || p.growth < 0 || !num(p.fruit) || p.fruit < 0) return 'pousse';
    if (p.lastHarvested != null && !getCrop(p.lastHarvested)) return 'culture précédente';
    if (typeof p.insured !== 'boolean' || typeof p.crow !== 'boolean' || typeof p.crowPenalty !== 'boolean') return 'parcelle';
  }
  if (!int(s.plotsBought, 0, START_FIELD.cols * START_FIELD.rows - START_FIELD.open)) return 'parcelles achetées';
  // Investissements (animaux, ruches, panneaux, miroir des ateliers)
  if (!obj(s.investments)) return 'investissements';
  for (const [id, n] of Object.entries(s.investments)) {
    if (!int(n, 0, 1000)) return `investissement ${id}`;
    if (WORKSHOPS.includes(id)) {
      if (n !== (c.buildings[id]?.level || 0)) return `atelier ${id}`;
      continue;
    }
    const inv = getCareerInvestment(id);
    if (!inv) return `investissement ${id}`;
    if (inv.category === 'animal') {
      if (n > shelterCapacity(s, inv.shelter)) return `abri plein (${id})`;
    } else if (n > inv.costs.length) return `investissement ${id}`;
  }
  for (const id of WORKSHOPS) if (c.buildings[id] && s.investments[id] !== c.buildings[id].level) return `atelier ${id}`;
  // Ateliers (places)
  if (!obj(s.processing)) return 'ateliers';
  for (const [id, b] of Object.entries(s.processing)) {
    if (!WORKSHOPS.includes(id) || !c.buildings[id]) return `atelier ${id}`;
    if (!obj(b) || typeof b.on !== 'boolean' || !Array.isArray(b.places)) return `atelier ${id}`;
    if (b.places.length > capacityAt(s, id, c.buildings[id].level)) return `places de l'atelier ${id}`;
    for (const place of b.places) {
      if (place === null) continue;
      const product = obj(place) && getProduct(place.productId);
      if (!product || product.building !== id || !int(place.daysLeft, 1, 99) || !num(place.rawValue) || !num(place.yieldFactor)) return `place de l'atelier ${id}`;
    }
  }
  // Prêt de Joseph
  if (DIFFICULTY_CAREER[c.difficulty].neighbourLoan) {
    const l = s.neighbourLoan;
    if (!obj(l) || !int(l.loans, 0, 100000) || !['debt', 'borrowed', 'repaid', 'forgiven'].every((k) => num(l[k]) && l[k] >= 0)) return 'prêt de Joseph';
  } else if (s.neighbourLoan !== null) return 'prêt de Joseph';
  // Grenier
  if (!obj(c.stock)) return 'grenier';
  let used = 0;
  for (const [id, n] of Object.entries(c.stock)) {
    if (!getCrop(id) || !int(n, 1, 100000)) return `grenier (${id})`;
    used += n;
  }
  if (used > storageCapacity(s)) return 'grenier trop plein';
  if (!STORAGE_MODES.includes(c.storageMode)) return 'réglage du grenier';
  // Employés, machines, événements, quêtes (formes générales ; le détail est vérifié par les extensions)
  if (!Array.isArray(c.staff) || c.staff.length > Math.min(MAX_STAFF, staffCapacity(s))) return 'employés';
  if (!Array.isArray(c.candidates) || !obj(c.machines) || !obj(c.events) || !obj(c.joseph) || !obj(c.pets)) return 'carrière';
  if (!int(c.joseph.hearts ?? 0, 0, 10)) return 'amitié de Joseph';
  if (c.hardship !== null && !(obj(c.hardship) && ['overdraft', 'rescueSold'].includes(c.hardship.stage))) return 'coup dur';
  if (!Array.isArray(c.history) || !Array.isArray(c.assetLog)) return 'historique';
  if (!obj(c.lifetime) || !['harvests', 'productsSold', 'truffles', 'questsDone', 'contestsWon'].every((k) => int(c.lifetime[k], 0, 1e9))) return 'cumuls';
  if (!obj(c.yearStats) || !obj(c.yearStats.incomeBy) || !obj(c.yearStats.spentBy)) return 'bilan de l\'année';
  if (!obj(c.paid) || !['buildings', 'machines', 'animals'].every((k) => num(c.paid[k]) && c.paid[k] >= 0)) return 'valeurs payées';
  if (!obj(c.cosmetics) || !obj(c.cosmetics.decor)) return 'décor';
  for (const slotId of Object.keys(c.cosmetics.decor)) if (!DECOR_SLOTS_BY_ID[slotId] && !/^lot\d+(?:[we]\d)?\.corner$/.test(slotId)) return `décor ${slotId}`;
  // Statistiques (même forme que les niveaux)
  const statsOk = (st) => obj(st) && obj(st.cropsHarvested) && obj(st.cropsLost) && num(st.harvestIncome) && obj(st.productsSold);
  if (!s.stats || !statsOk(s.stats.year) || !statsOk(s.stats.season)) return 'statistiques';
  for (const ext of careerExtensions()) {
    if (typeof ext.check !== 'function') continue;
    const problem = ext.check(s);
    if (problem) return problem;
  }
  return null;
}
