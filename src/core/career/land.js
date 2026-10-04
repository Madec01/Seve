// Mode Carrière — terrains (pur) : carte 2D (achat d'un bloc qui touche la ferme), aménagement,
// réaménagement d'un terrain vide, parcelles. Conception : docs/CARRIERE.md § 2 ; contrat : docs/ARCHITECTURE.md,
// « Carrière v2 — carte 2D ».
//
// state.career.lots : terrains POSSÉDÉS, dans l'ordre d'achat :
//   { id, index, col, row, type, name, pricePaid, developPaid, slots: null | [null | buildingId, …], plan }
//   index 0 'home' (maison), 1 'start' (champ de départ), 2 'yard' (basse-cour) : tous trois dans le bloc
//   (col 0, row 0) ; 3.. terrains achetés (index = ordre d'achat, id = case : lotIdAt(col, row))
//   plan (champs et serre) : { spring, summer, autumn, winter } → 'same' | cropId | null (semoir, jardiniers)
// Parcelles d'un terrain : state.plots[i].lot === lot.id (index du cœur, ajoutées à la fin, jamais renumérotées).

import { CARD_VALUES } from '../../data/variety.js';
import { SEASONS } from '../../data/balance.js';
import { countNoun } from '../../data/french.js';
import { getCrop } from '../../data/crops.js';
import { DIFFICULTY_CAREER, MAX_LOTS, seasonScale } from '../../data/career/career.js';
import { FIRST_LOT_INDEX, FIXED_LOTS, FIXED_TYPE_NAMES, LOT_GRID, LOT_PRICES, LOT_TYPES, MAX_LOTS_BY_RANK, START_FIELD, getLotType, inLotGrid, lotCellOf, lotIdAt, lotNameAt } from '../../data/career/lots.js';
import { BUILDINGS_BY_ID } from '../../data/career/buildings.js';
import { ensureLotPlots, newPlot, notEnoughMoney, placeBuilding, rankLabel, removeBuilding } from './buildings.js';
import { providedFirst } from './registry.js';
import { aboutFields } from '../../data/career/descriptions.js';
import { lotFinds } from './surprises.js';
import { reserveLotNature } from './habitat.js';
import { fixHandOf, isFixed, planVariety, returnTrialSeed, varietyName } from './heirlooms.js';
import { ALL_VARIETIES_BY_ID as VARIETIES_BY_ID } from '../../data/career/valley.js';
import { wildCells, wildEligible, wildPrice } from './places.js';

export const DEFAULT_PLAN = Object.freeze({ spring: 'same', summer: 'same', autumn: 'same', winter: 'same' });

/** Terrains et parcelles de départ (createCareer). */
export function initialLots() {
  return FIXED_LOTS.map((f) => ({
    id: f.id,
    index: f.index,
    col: LOT_GRID.home.col,
    row: LOT_GRID.home.row,
    type: f.type,
    name: f.name,
    pricePaid: 0,
    developPaid: 0,
    slots: f.type === 'yard' ? [null, null] : null,
    plan: f.type === 'field' ? { ...DEFAULT_PLAN } : null,
  }));
}

/** 16 parcelles du champ de départ : les 12 premières (3 rangées de 4) ouvertes. */
export function initialPlots() {
  const plots = [];
  for (let cell = 0; cell < START_FIELD.cols * START_FIELD.rows; cell++) plots.push(newPlot('start', 'field', cell, cell < START_FIELD.open));
  return plots;
}

/**
 * (Accompagnement, docs/ACCOMPAGNEMENT.md § 5.1) Option de création `starter` : 6 carottes mûres et arrosées sur les
 * premières parcelles ouvertes du champ de départ (rangée du haut, puis le début de la suivante : le champ a 4
 * colonnes). Déterministe (aucun tirage) ; carrière seulement ; désactivée par défaut (createCareer).
 */
export const STARTER_CROP = 'carrot';
export const STARTER_PLOTS = 6;
export function applyStarter(state, noteSown = null) {
  const crop = getCrop(STARTER_CROP);
  const out = [];
  state.plots.forEach((p, i) => {
    if (out.length >= STARTER_PLOTS || p.lot !== 'start' || !p.unlocked || p.cropId) return;
    Object.assign(p, { cropId: crop.id, growth: crop.growDays, watered: true, fatigued: false, insured: false });
    if (typeof noteSown === 'function') {
      noteSown(state, i);
      if (p.care) p.care.wetEnd = true; // soignées : arrosées chaque jour jusqu'à maturité
    }
    out.push(i);
  });
  return out;
}

export function getLot(state, lotId) {
  return state.career.lots.find((l) => l.id === lotId) || null;
}

/** Index des parcelles d'un terrain (actives : env non nul). */
export function lotPlots(state, lotId, { includeRetired = false } = {}) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (p.lot === lotId && (includeRetired || p.env !== null)) out.push(i);
  });
  return out;
}

/** Nombre de terrains d'un type (le champ de départ compte pour un champ). */
export function countType(state, type) {
  return state.career.lots.filter((l) => l.type === type).length;
}

/** Terrains possédés au plus au rang actuel. */
export function maxLotsForRank(rank) {
  return MAX_LOTS_BY_RANK[Math.min(rank, 6)] ?? MAX_LOTS;
}

/** Charges de saison en plus par terrain acheté (× durée / 7). */
export function chargePerLot(state) {
  const d = DIFFICULTY_CAREER[state.career.difficulty];
  return Math.round(d.seasonCharge.perLot * seasonScale(state.career.seasonLength));
}

// ── Carte 2D ────────────────────────────────────────────────────────────────────────────────

const key = (col, row) => `${col},${row}`;
const NEIGHBOURS = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** Cases occupées : ferme de départ + terrains achetés → Map « col,row » → terrain (ferme : 'home'). */
function occupied(state) {
  const m = new Map([[key(LOT_GRID.home.col, LOT_GRID.home.row), 'home']]);
  for (const l of state.career.lots) if (l.index >= FIRST_LOT_INDEX) m.set(key(l.col, l.row), l);
  return m;
}

/** Rang qui permet de posséder un terrain de plus (null : plus aucun). */
function rankForMoreLots(n) {
  return Object.entries(MAX_LOTS_BY_RANK).map(([r, m]) => [Number(r), m]).find(([, m]) => m > n)?.[0] ?? null;
}

/**
 * Cases libres de la « lisière » : dans la grille, pas encore achetées, et qui touchent (par un côté) un terrain
 * possédé ou la ferme de départ. Ordre : colonne la plus proche du centre, puis la plus basse, puis la gauche.
 * Vide quand la ferme a déjà MAX_LOTS terrains.
 */
export function frontierCells(state) {
  if (state.career.lotsBought >= MAX_LOTS) return [];
  const occ = occupied(state);
  // (Vallée V3) Une terre sauvage n'est JAMAIS à vendre.
  const wild = state.career.valley?.wilds || null;
  const out = [];
  for (let col = LOT_GRID.cols[0]; col <= LOT_GRID.cols[1]; col++) {
    for (let row = LOT_GRID.rows[0]; row <= LOT_GRID.rows[1]; row++) {
      if (!inLotGrid(col, row) || occ.has(key(col, row))) continue;
      if (wild && wild[lotIdAt(col, row)]) continue;
      if (NEIGHBOURS.some(([dc, dr]) => occ.has(key(col + dc, row + dr)))) out.push({ col, row });
    }
  }
  return out.sort((a, b) => Math.abs(a.col) - Math.abs(b.col) || a.row - b.row || a.col - b.col);
}

/**
 * Terrain à vendre sur une case (lisière) :
 * { id, index, col, row, name, price, basePrice, special, chargeIncrease, buyable, canBuy, reason, lockedReason, lockedByRank }
 *   buyable : la case touche la ferme ET le rang permet un terrain de plus (l'argent n'est pas compté) ;
 *   canBuy  : buyable ET assez d'argent ; reason : pourquoi on ne peut pas acheter (rang, argent) ;
 *   lockedReason : pourquoi ce n'est pas achetable (rang) ou null.
 */
export function saleInfoAt(state, col, row) {
  const n = state.career.lotsBought;
  const lot = { id: lotIdAt(col, row), index: FIRST_LOT_INDEX + n, col, row, name: lotNameAt(col, row), basePrice: LOT_PRICES[Math.min(n, LOT_PRICES.length - 1)] };
  const special = providedFirst('lotPrice', state, lot);
  const price = special && Number.isFinite(special.price) ? special.price : lot.basePrice;
  const maxLots = maxLotsForRank(state.career.rank);
  let lockedReason = null;
  let lockedByRank = null;
  if (n >= maxLots) {
    lockedByRank = rankForMoreLots(n);
    lockedReason = lockedByRank ? rankLabel(lockedByRank) : 'Plus de terrain à vendre.';
  }
  const reason = lockedReason || (state.money < price ? notEnoughMoney(price - state.money) : null);
  return { ...lot, price, special: special || null, chargeIncrease: chargePerLot(state), buyable: lockedReason === null, canBuy: reason === null, reason, lockedReason, lockedByRank };
}

/** Terrains à vendre de la lisière (dans l'ordre de frontierCells). */
export function saleLots(state) {
  return frontierCells(state).map(({ col, row }) => saleInfoAt(state, col, row));
}

/**
 * Le terrain à vendre proposé par défaut (Carte, simulateur, anciens appels de buyLot() sans argument) :
 * le premier de la lisière (colonne d'origine d'abord, vers le haut) ; null quand il n'y en a plus.
 */
export function nextLotInfo(state) {
  return saleLots(state)[0] || null;
}

/** Étendue de la carte (terrains possédés, ferme, lisière) et toutes les cases de la grille (mini-carte). */
export function gridInfo(state) {
  const occ = occupied(state);
  const sale = saleLots(state);
  const saleKeys = new Map(sale.map((s) => [key(s.col, s.row), s]));
  // (Vallée V3) Terres sauvages (« wildland ») et forêts qu'on peut confier (« wildable ») : elles entrent dans l'étendue.
  const wilds = state.career.valley ? wildCells(state) : {};
  const wildable = new Set(state.career.valley ? wildEligible(state) : []);
  const wildExtent = [...Object.values(wilds), ...[...wildable].map((id) => lotCellOf(id))];
  const shown = [{ col: LOT_GRID.home.col, row: LOT_GRID.home.row }, ...state.career.lots.filter((l) => l.index >= FIRST_LOT_INDEX), ...sale, ...wildExtent];
  const cols = [Math.min(...shown.map((x) => x.col)), Math.max(...shown.map((x) => x.col))];
  const rows = [Math.min(...shown.map((x) => x.row)), Math.max(...shown.map((x) => x.row))];
  const cells = [];
  const maxRow = Math.max(LOT_GRID.rows[1], rows[1]);
  for (let row = maxRow; row >= LOT_GRID.rows[0]; row--) {
    for (let col = LOT_GRID.cols[0]; col <= LOT_GRID.cols[1]; col++) {
      const k = key(col, row);
      const o = occ.get(k);
      if (o === 'home') {
        cells.push({ col, row, id: 'home', name: 'La ferme', state: 'home', type: 'home' });
        continue;
      }
      if (o) {
        cells.push({ col, row, id: o.id, name: o.name, state: 'owned', type: o.type });
        continue;
      }
      if (!inLotGrid(col, row)) continue;
      const id = lotIdAt(col, row);
      const w = wilds[id];
      if (w) {
        cells.push({ col, row, id, name: lotNameAt(col, row), state: 'wildland', type: null, wildKind: w.kind, wildStage: w.stage });
        continue;
      }
      if (wildable.has(id)) {
        cells.push({ col, row, id, name: lotNameAt(col, row), state: 'wildable', type: null, price: wildPrice(state) });
        continue;
      }
      const s = saleKeys.get(k);
      cells.push({ col, row, id, name: lotNameAt(col, row), state: s ? (s.buyable ? 'buyable' : 'locked') : 'forest', type: null });
    }
  }
  return { cols, rows, home: { ...LOT_GRID.home }, bounds: { cols: [...LOT_GRID.cols], rows: [...LOT_GRID.rows] }, block: { cols: LOT_GRID.blockCols, rows: LOT_GRID.blockRows, homeRows: LOT_GRID.homeRows, topForest: LOT_GRID.topForest }, cells };
}

/**
 * Achète un terrain de la lisière (en friche). `lotId` : un terrain à vendre (query.career.lots(), forSale) ;
 * sans argument : le terrain proposé par défaut (nextLotInfo). → { ok, lotId, index, col, row, cost }
 */
export function buyLot(api, lotId) {
  const { state } = api;
  let info;
  if (lotId === undefined || lotId === null) {
    info = nextLotInfo(state);
    if (!info) return api.fail(state.career.lotsBought >= MAX_LOTS ? 'Tous les terrains sont achetés.' : 'Aucun terrain à vendre.');
  } else {
    const cell = lotCellOf(lotId);
    if (!cell || !inLotGrid(cell.col, cell.row)) return api.fail('Terrain inconnu.');
    if (state.career.lots.some((l) => l.id === lotId)) return api.fail('Ce terrain est déjà à vous.');
    if (state.career.lotsBought >= MAX_LOTS) return api.fail('Tous les terrains sont achetés.');
    if (!frontierCells(state).some((c) => c.col === cell.col && c.row === cell.row)) return api.fail('Ce terrain ne touche pas encore votre ferme.');
    info = saleInfoAt(state, cell.col, cell.row);
  }
  if (!info.canBuy) return api.fail(info.reason);
  api.spend('lots', info.price);
  const lot = { id: info.id, index: info.index, col: info.col, row: info.row, type: 'wild', name: info.name, pricePaid: info.price, developPaid: 0, slots: null, plan: null };
  if (info.special) lot.special = info.special.label || true;
  state.career.lots.push(lot);
  state.career.lotsBought += 1;
  api.push('lotBought', { lotId: lot.id, index: lot.index, col: lot.col, row: lot.row, cost: info.price, name: lot.name });
  // (lot 2) Trouvailles au défrichage : 1 ou 2, juste après l'achat (événement finds ; champ finds du résultat).
  if (state.surprises) {
    const finds = lotFinds(api, lot.id);
    return { ok: true, lotId: lot.id, index: lot.index, col: lot.col, row: lot.row, cost: info.price, finds };
  }
  return { ok: true, lotId: lot.id, index: lot.index, col: lot.col, row: lot.row, cost: info.price };
}

/** true si le terrain est vide : aucune culture, aucun bâtiment, aucun animal dans ses abris. */
export function isLotEmpty(state, lot) {
  if (lotPlots(state, lot.id).some((i) => state.plots[i].cropId)) return false;
  if (lot.slots && lot.slots.some((b) => b !== null)) return false;
  for (const [id, b] of Object.entries(state.career.buildings)) {
    if (b.lotId !== lot.id) continue;
    const def = BUILDINGS_BY_ID[id];
    if (def.category === 'shelter' && (state.investments[def.animal] || 0) > 0) return false;
  }
  return true;
}

/**
 * Peut-on aménager ce terrain en `type` ? → { ok, cost, def } | { ok: false, reason }
 * Seuls les terrains achetés s'aménagent ; un terrain déjà aménagé doit être vide (réaménager).
 */
export function checkDevelop(state, lotId, type) {
  const lot = getLot(state, lotId);
  if (!lot) return { ok: false, reason: 'Terrain inconnu.' };
  if (lot.index < FIRST_LOT_INDEX) return { ok: false, reason: 'Ce terrain ne se réaménage pas.' };
  const def = getLotType(type);
  if (!def) return { ok: false, reason: 'Aménagement inconnu.' };
  if (lot.type === type) return { ok: false, reason: 'Le terrain est déjà aménagé ainsi.' };
  if (lot.type !== 'wild' && !isLotEmpty(state, lot)) return { ok: false, reason: 'Videz d\'abord le terrain (cultures, bâtiments, animaux).' };
  if (def.rank > state.career.rank) return { ok: false, reason: rankLabel(def.rank) };
  if (countType(state, type) >= def.max) return { ok: false, reason: `Au plus ${countNoun(def.max, def.name.toLowerCase())} dans la ferme.` };
  const cost = developCost(state, def);
  if (state.money < cost) return { ok: false, reason: notEnoughMoney(cost - state.money) };
  return { ok: true, cost, def };
}

/** Prix d'un aménagement ; (lot 3) carte « Coup de main au défrichage » : le prochain moins cher (CARD_VALUES.clearing). */
export function developCost(state, def) {
  if (def.cost > 0 && state.variety?.cards?.pending?.clearingHalf) return Math.round(def.cost * CARD_VALUES.clearing.careerFactor);
  return def.cost;
}

/** Aménage (ou réaménage) un terrain acheté. → { ok, cost, plots: [index] } */
export function developLot(api, lotId, type) {
  const { state } = api;
  const check = checkDevelop(state, lotId, type);
  if (!check.ok) return check;
  const lot = getLot(state, lotId);
  const def = check.def;
  // Ce que l'ancien aménagement laisse : parcelles retirées (index gardés), bâtiment du terrain retiré.
  for (const i of lotPlots(state, lot.id)) {
    const p = state.plots[i];
    if (state.career.valley) {
      // (Vallée) La graine d'une planche d'essai revient ; variété, jachère et sol reposé ne survivent pas au réaménagement
      // (sinon la parcelle, réutilisée vide par ensureLotPlots, garderait une variété sans culture : sauvegarde refusée).
      returnTrialSeed(state, p);
      for (const k of ['variety', 'fallow', 'rested']) if (p[k] !== undefined) delete p[k];
    }
    p.env = null;
    p.unlocked = false;
  }
  for (const [id, b] of Object.entries(state.career.buildings)) if (b.lotId === lot.id) removeBuilding(state, id);
  const cost = check.cost;
  if (cost > 0) api.spend('develop', cost);
  if (cost !== def.cost && state.variety) state.variety.cards.pending.clearingHalf = false;
  lot.type = type;
  lot.developPaid = (lot.developPaid || 0) + cost;
  lot.slots = def.slots > 0 ? Array.from({ length: def.slots }, () => null) : null;
  lot.plan = def.plots && def.plots.env !== 'orchard' ? { ...DEFAULT_PLAN } : null;
  let plots = [];
  if (def.building) placeBuilding(state, def.building, lot.id, null, 1, 0);
  if (def.plots) {
    const count = def.building === 'greenhouse' ? BUILDINGS_BY_ID.greenhouse.levels[0].plots : def.plots.count;
    plots = ensureLotPlots(state, lot, def.plots.env, count);
  }
  api.push('lotDeveloped', { lotId: lot.id, lotType: type, cost, plots }); // « lotType » : « type » écraserait le type de l'événement (on('*'))
  // (Vallée vivante) Les haies restent ; les autres aménagements nature du terrain vont à la réserve (à replacer gratuitement).
  const kinds = state.career.valley ? reserveLotNature(state, lot.id) : [];
  if (kinds.length) api.push('natureReserved', { lotId: lot.id, kinds });
  return kinds.length ? { ok: true, cost, plots, natureReserved: kinds } : { ok: true, cost, plots };
}

/** Aménagements proposés pour un terrain : [{ type, name, cost, canDevelop, reason, max, count, rank }]. */
export function lotTypesFor(state, lotId) {
  return LOT_TYPES.map((t) => {
    const check = checkDevelop(state, lotId, t.id);
    const about = aboutFields('lotType', t.id);
    return { type: t.id, name: t.name, cost: developCost(state, t), rank: t.rank, canDevelop: check.ok, reason: check.ok ? null : check.reason, max: Number.isFinite(t.max) ? t.max : null, count: countType(state, t.id), phase: t.phase || null, role: about.role, tips: about.tips, effectLines: about.effectLines };
  });
}

/** Nom affiché du type d'un terrain. */
export function lotTypeName(type) {
  return FIXED_TYPE_NAMES[type] || getLotType(type)?.name || type;
}

/** Plan de culture d'un champ ou de la serre : 'same' | cropId | null. */
export function setPlan(api, lotId, seasonId, cropId) {
  const { state } = api;
  const lot = getLot(state, lotId);
  if (!lot) return api.fail('Terrain inconnu.');
  if (!lot.plan) return api.fail('Ce terrain n\'a pas de plan de culture.');
  if (!SEASONS.includes(seasonId)) return api.fail('Saison inconnue.');
  // (Vallée vivante) 'heirloom:<id>' : une variété ancienne fixée (sauvée) dans le plan de culture.
  const heirloom = state.career.valley ? planVariety(cropId) : null;
  if (heirloom) {
    const x = VARIETIES_BY_ID[heirloom];
    const crop = getCrop(x.cropId);
    if (!isFixed(state, heirloom)) return api.fail(`${varietyName(state, x)} : sauvez-la d'abord (${fixHandOf(state)} récoltes à la main).`);
    if (crop.kind === 'tree') return api.fail('Culture inconnue.');
    if (lot.type !== 'greenhouse' && !crop.seasons.includes(seasonId)) return api.fail(`${crop.name} : ne se sème pas cette saison.`);
  } else if (cropId !== null && cropId !== 'same') {
    const crop = getCrop(cropId);
    if (crop && crop.rare) return api.fail('Les graines rares se sèment à la main.');
    if (!crop || crop.kind === 'tree') return api.fail('Culture inconnue.');
    if (!api.level.crops.includes(cropId)) return api.fail('Culture pas encore débloquée.');
    if (lot.type !== 'greenhouse' && !crop.seasons.includes(seasonId)) return api.fail(`${crop.name} : ne se sème pas cette saison.`);
  }
  lot.plan[seasonId] = cropId;
  return { ok: true, plan: { ...lot.plan } };
}

/** Parcelles « cultivables » ouvertes (champs, verger, serre) : objectif du rang 4. */
export function cultivablePlots(state) {
  return state.plots.filter((p) => p.unlocked && p.env).length;
}
