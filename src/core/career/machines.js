// Mode Carrière — machines (extension CORE-B « machines ») : achat, amélioration, interrupteur ; arroseurs
// et château d'eau (aube), semoir (aube puis 35 % du jour), moissonneuse et cueilleuse (30 %), collecteurs
// (40 % et 80 %), convoyeur (après les ateliers), tracteur (machines niv. 2, jardiniers + 25 %) ;
// carburant payé à l'aube suivante, entretien. Pur. Conception : docs/CARRIERE.md § 6.
//
// state.career.machines[key] = { id, lotId, level, on, workedDay, usedDay, used, buildingId? }
//   key : « <id>@<lotId> » (machines de terrain), « collector@<abri> », « tractor » / « waterTower » /
//         « conveyor » (machines de ferme, terrain 'home')
//   workedDay : dernier jour absolu de travail ; usedDay / used : actions faites ce jour-là (capacité)
// state.career.work.runs : passages en cours (semoir, moissonneuse, cueilleuse) — rang par rang, chaque
//   parcelle à son heure : [{ key, id, lotId, kind, puller, startAt, endAt, plots: [{ index, at, done, ok }] }]
//   (exécutés par src/core/career/work.js, gardés dans la sauvegarde : reprise en plein passage).
// state.career.work.fuel : { [jour absolu]: { [key]: carburant } } — payé à l'aube suivante (charges).
//
// Règles : les machines passent AVANT les employés sur leur terrain (work.js : un jardinier ne récolte pas
// un terrain dont la moissonneuse n'est pas encore passée, ne sème pas avant le semoir) ; un employé ne
// refait jamais ce qu'une machine vient de faire (l'action n'est plus utile). Coup dur : les machines à
// carburant s'arrêtent (arroseurs, collecteurs, château d'eau et convoyeur continuent).

import { DAY_SECONDS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { getProduct } from '../../data/products.js';
import { BUILDINGS_BY_ID } from '../../data/career/buildings.js';
import { FARM_MACHINE_LOT, MACHINES, MACHINES_BY_ID, machineKey } from '../../data/career/machines.js';
import { CAREER_ANIMALS_BY_ID } from '../../data/career/animals.js';
import { aboutFields } from '../../data/career/descriptions.js';
import { registerCareerExtension } from './registry.js';
import { rankLabel } from './buildings.js';
import { lotTypeName } from './land.js';
import { collectShelter } from './animals.js';
import { giantOpenToHelpers } from '../surprises.js';
import { absDay, addWorkStat, byCell, effectiveLevel, ensureWork, isMature, machineCapacity, machineUsed, serpentine, sowChoice, useMachine } from './crew.js';
import { inGreenhouse, needsWaterToday, rawUnitPrice } from '../farm.js';
import { targetFor, tryProcessHarvest } from '../processing.js';

export { MACHINES, MACHINES_BY_ID };

const PHASE_ORDER = { sow: 0, harvest: 1, pick: 2 };

// ── Carburant ────────────────────────────────────────────────────────────────────────────────

function recordFuel(state, key, amount) {
  if (!(amount > 0)) return;
  const w = ensureWork(state);
  if (!w.fuel || typeof w.fuel !== 'object') w.fuel = {};
  const day = String(absDay(state));
  const book = w.fuel[day] || (w.fuel[day] = {});
  book[key] = amount; // une fois par jour de travail
}

function fuelOf(state, day) {
  const book = state.career.work?.fuel?.[String(day)];
  return book ? Object.values(book).reduce((a, b) => a + b, 0) : 0;
}

/** Note le travail d'une machine (capacité, jour de travail, carburant, tracteur). */
function worked(api, m, key, puller) {
  const { state } = api;
  useMachine(state, m, 1);
  recordFuel(state, key, MACHINES_BY_ID[m.id].fuel);
  if (puller === 'tractor' && state.career.machines.tractor) {
    const t = state.career.machines.tractor;
    t.workedDay = absDay(state);
    recordFuel(state, 'tractor', MACHINES_BY_ID.tractor.fuel);
  }
  addWorkStat(state, 'machineActions', 1);
}

// ── Peut-elle travailler ? ───────────────────────────────────────────────────────────────────

/** → { ok: true, level, puller, capacity } | { ok: false, reason } */
export function canWork(api, m) {
  const { state } = api;
  const def = MACHINES_BY_ID[m?.id];
  if (!def) return { ok: false, reason: 'Machine inconnue.' };
  if (!m.on) return { ok: false, reason: 'Éteinte.' };
  if (def.fuel > 0 && api.isPaused()) return { ok: false, reason: 'À l\'arrêt : passe difficile (plus de carburant).' };
  if (def.scope === 'lot') {
    const lot = api.lot(m.lotId);
    if (!lot || !def.lotTypes.includes(lot.type)) return { ok: false, reason: 'Le terrain ne convient plus à cette machine.' };
  }
  if (def.scope === 'shelter' && !state.career.buildings[m.buildingId]) return { ok: false, reason: 'L\'abri n\'existe plus.' };
  const eff = effectiveLevel(state, m);
  if (eff.level === 0) return { ok: false, reason: eff.reason };
  return { ok: true, level: eff.level, puller: eff.puller, capacity: machineCapacity(m, eff.level) };
}

/** Parcelles couvertes par des arroseurs (niv. 1 : les 8 premières cases ; niv. 2 : tout le terrain). */
export function sprinklerCoverage(api, m, level = m.level) {
  const plots = byCell(api.state, api.lotPlots(m.lotId));
  const cap = machineCapacity(m, level);
  return plots.filter((i) => api.state.plots[i].cell < cap);
}

// ── Aube : semoir (1er passage), arroseurs, château d'eau ────────────────────────────────────

function eligible(api, kind, i) {
  const p = api.state.plots[i];
  if (!p || !p.unlocked || !p.env) return false;
  const crop = p.cropId ? getCrop(p.cropId) : null;
  if (kind === 'harvest') return !!crop && !isTreeCrop(crop) && isMature(p) && giantOpenToHelpers(api.state, i); // (lot 2) le géant attend d'abord le joueur
  if (kind === 'pick') return !!crop && isTreeCrop(crop) && isMature(p);
  if (kind === 'sow') return !p.cropId && p.env !== 'orchard' && sowChoice(api, i) !== null;
  return false;
}

/** Fait l'action d'une machine sur une parcelle (au moment de passer). → true si elle a servi. */
function actOnPlot(api, kind, i) {
  if (!eligible(api, kind, i)) return false;
  if (kind === 'sow') {
    const cropId = sowChoice(api, i);
    return !!cropId && api.plant(i, cropId, { by: 'machine' }).ok;
  }
  return api.harvest(i, { by: 'machine' }).ok;
}

/** Semoir, 1er passage à l'aube (immédiat). */
function seederDawnPass(api) {
  const { state } = api;
  for (const [key, m] of Object.entries(state.career.machines)) {
    if (!m || m.id !== 'seeder') continue;
    const cw = canWork(api, m);
    if (!cw.ok) continue;
    const room = cw.capacity - machineUsed(state, m);
    if (room <= 0) continue;
    const plots = [];
    for (const i of serpentine(state, api.lotPlots(m.lotId))) {
      if (plots.length >= room) break;
      if (actOnPlot(api, 'sow', i)) {
        worked(api, m, key, cw.puller);
        plots.push({ index: i, at: 0 });
      }
    }
    if (plots.length) api.push('machineWorked', { key, id: m.id, lotId: m.lotId, kind: 'sow', plots, fuel: MACHINES_BY_ID.seeder.fuel, puller: cw.puller, startAt: 0, endAt: 0, dawn: true });
  }
}

function waterHook(api, { weather }) {
  const { state } = api;
  seederDawnPass(api);
  const watered = [];
  const level = api.level;
  const waterPlot = (i) => {
    const p = state.plots[i];
    const crop = p.cropId ? getCrop(p.cropId) : null;
    if (!crop || p.watered || isMature(p) || !needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : weather, level)) return false;
    p.watered = true;
    watered.push(i);
    return true;
  };
  for (const [key, m] of Object.entries(state.career.machines)) {
    if (!m || m.id !== 'sprinklers') continue;
    const cw = canWork(api, m);
    if (!cw.ok) continue;
    const plots = sprinklerCoverage(api, m, cw.level).filter(waterPlot);
    if (plots.length) {
      useMachine(state, m, plots.length);
      addWorkStat(state, 'machineActions', plots.length);
      api.push('machineWorked', { key, id: m.id, lotId: m.lotId, kind: 'water', plots: plots.map((index) => ({ index, at: 0 })), fuel: 0, puller: null, startAt: 0, endAt: 0 });
    }
  }
  const tower = state.career.machines.waterTower;
  if (tower && canWork(api, tower).ok) {
    const plots = [];
    state.plots.forEach((p, i) => {
      if (p.env === 'greenhouse' && p.unlocked && waterPlot(i)) plots.push(i);
    });
    if (plots.length) {
      useMachine(state, tower, plots.length);
      api.push('machineWorked', { key: 'waterTower', id: 'waterTower', lotId: tower.lotId, kind: 'water', plots: plots.map((index) => ({ index, at: 0 })), fuel: 0, puller: null, startAt: 0, endAt: 0 });
    }
  }
  return watered;
}

// ── Convoyeur (après les ateliers) ───────────────────────────────────────────────────────────

function conveyorHook(api) {
  const { state } = api;
  const m = state.career.machines.conveyor;
  if (!m || !canWork(api, m).ok) return;
  const value = (cropId) => {
    const t = targetFor(state, cropId);
    return t && t.product.source === 'harvest' ? getProduct(t.product.id)?.value ?? 0 : -1;
  };
  let count = 0;
  const moved = [];
  for (;;) {
    const ids = Object.keys(state.career.stock).filter((id) => value(id) >= 0).sort((a, b) => value(b) - value(a) || a.localeCompare(b));
    let done = false;
    for (const cropId of ids) {
      const crop = getCrop(cropId);
      const processed = tryProcessHarvest(state, cropId, Math.round(rawUnitPrice(state, api.level, crop)), 1);
      if (!processed) continue;
      state.career.stock[cropId] -= 1;
      if (state.career.stock[cropId] <= 0) delete state.career.stock[cropId];
      api.push('processingStarted', { ...processed, input: cropId, source: 'conveyor' });
      moved.push({ cropId, buildingId: processed.buildingId });
      count++;
      done = true;
      break;
    }
    if (!done) break;
  }
  if (count > 0) {
    useMachine(state, m, count);
    addWorkStat(state, 'machineActions', count);
    api.push('machineWorked', { key: 'conveyor', id: 'conveyor', lotId: m.lotId, kind: 'convey', plots: [], moved, count, fuel: 0, puller: null, startAt: 0, endAt: 0 });
  }
}

// ── Passages dans la journée (appelés par work.js) ───────────────────────────────────────────

/** Heures de passage (secondes) des machines dans (from, to] : [{ t, key, pass }], dans l'ordre. */
export function passesBetween(state, from, to) {
  const out = [];
  for (const [key, m] of Object.entries(state.career.machines)) {
    const def = m && MACHINES_BY_ID[m.id];
    if (!def || !def.kind || def.scope === 'farm') continue;
    for (const pass of def.passes) {
      if (pass <= 0) continue;
      const t = pass * DAY_SECONDS;
      if (t > from && t <= to) out.push({ t, key, pass, order: PHASE_ORDER[def.kind] ?? 3 });
    }
  }
  return out.sort((a, b) => a.t - b.t || a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Début d'un passage à l'heure t (secondes) : collecteur (immédiat) ou passage rang par rang. */
export function startPass(api, key, t) {
  const { state } = api;
  const m = state.career.machines[key];
  if (!m) return;
  const def = MACHINES_BY_ID[m.id];
  const cw = canWork(api, m);
  if (!cw.ok) return;
  if (def.kind === 'collect') {
    const b = state.career.buildings[m.buildingId];
    if (!b || Math.round(b.pending || 0) <= 0) return;
    const r = collectShelter(api, m.buildingId, 'collector', { key });
    if (r.ok) {
      useMachine(state, m, 1);
      addWorkStat(state, 'machineActions', 1);
      api.push('machineWorked', { key, id: m.id, lotId: m.lotId, buildingId: m.buildingId, kind: 'collect', plots: [], amount: r.amount, fuel: 0, puller: null, startAt: t, endAt: t });
    }
    return;
  }
  if (state.career.work.runs.some((r) => r.key === key)) return;
  const room = cw.capacity - machineUsed(state, m);
  if (room <= 0) return;
  const reserved = new Set(state.career.work.runs.flatMap((r) => r.plots.filter((p) => !p.done).map((p) => p.index)));
  const picked = [];
  for (const i of serpentine(state, api.lotPlots(m.lotId))) {
    if (picked.length >= room) break;
    if (!reserved.has(i) && eligible(api, def.kind, i)) picked.push(i);
  }
  if (!picked.length) return;
  const step = (def.step || 0.01) * DAY_SECONDS;
  const plots = picked.map((index, k) => ({ index, at: Math.min(DAY_SECONDS, t + (k + 1) * step), done: false, ok: null }));
  const run = { key, id: m.id, lotId: m.lotId, kind: def.kind, puller: cw.puller, startAt: t, endAt: plots[plots.length - 1].at, plots };
  state.career.work.runs.push(run);
  api.push('machineWorked', { key, id: m.id, lotId: m.lotId, kind: def.kind, plots: plots.map((p) => ({ index: p.index, at: p.at })), fuel: def.fuel, puller: cw.puller, startAt: t, endAt: run.endAt });
}

/** Prochaine parcelle à traiter d'un passage : { run, plot } de plus petite heure (≤ to), ou null. */
export function nextRunStep(state, to) {
  let best = null;
  for (const run of state.career.work.runs) {
    const plot = run.plots.find((p) => !p.done);
    if (!plot || plot.at > to) continue;
    if (!best || plot.at < best.plot.at) best = { run, plot };
  }
  return best;
}

/** Traite une parcelle d'un passage (à son heure). */
export function doRunStep(api, run, plot) {
  const { state } = api;
  plot.done = true;
  const m = state.career.machines[run.key];
  let ok = false;
  if (m) {
    const cw = canWork(api, m);
    if (cw.ok && machineUsed(state, m) < cw.capacity) {
      ok = actOnPlot(api, run.kind, plot.index);
      if (ok) worked(api, m, run.key, run.puller);
    }
  }
  plot.ok = ok;
  if (run.plots.every((p) => p.done)) {
    state.career.work.runs.splice(state.career.work.runs.indexOf(run), 1);
    api.push('machineRunDone', { key: run.key, id: run.id, lotId: run.lotId, kind: run.kind, count: run.plots.filter((p) => p.ok).length });
  }
}

/**
 * true si une machine de ce type passera encore aujourd'hui sur ce terrain après `t` (ou y passe) : le
 * jardinier lui laisse le travail (« les machines passent avant les employés »).
 */
export function machineWillPass(api, lotId, kind, t) {
  const { state } = api;
  for (const [key, m] of Object.entries(state.career.machines)) {
    if (!m || m.lotId !== lotId) continue;
    const def = MACHINES_BY_ID[m.id];
    if (def.kind !== kind || def.scope !== 'lot') continue;
    if (state.career.work.runs.some((r) => r.key === key)) return true;
    const cw = canWork(api, m);
    if (!cw.ok || machineUsed(state, m) >= cw.capacity) continue;
    if (def.passes.some((p) => p > 0 && p * DAY_SECONDS > t)) return true;
  }
  return false;
}

// ── Actions ──────────────────────────────────────────────────────────────────────────────────

/** Abris où un collecteur a un sens (production à ramasser). */
function collectShelters(state) {
  return Object.keys(state.career.buildings).filter((id) => {
    const def = BUILDINGS_BY_ID[id];
    return def?.category === 'shelter' && CAREER_ANIMALS_BY_ID[def.animal]?.collect;
  });
}

/**
 * Emplacement d'achat : → { key, lotId, buildingId } | { reason }
 *   machine de terrain : `place` = lotId ; collecteur : `place` = abri (ou terrain : son premier abri libre) ;
 *   machine de ferme : `place` ignoré.
 */
function resolvePlace(state, def, place) {
  if (def.scope === 'farm') return { key: def.id, lotId: FARM_MACHINE_LOT, buildingId: null };
  if (def.scope === 'lot') {
    const lot = state.career.lots.find((l) => l.id === place);
    if (!lot) return { reason: 'Choisissez un terrain.' };
    if (!def.lotTypes.includes(lot.type)) return { reason: `${def.name} : ${def.lotTypes.map((t) => lotTypeName(t).toLowerCase()).join(' ou ')} seulement.` };
    return { key: machineKey(def.id, lot.id), lotId: lot.id, buildingId: null };
  }
  // Collecteur
  const shelters = collectShelters(state);
  let buildingId = shelters.includes(place) ? place : null;
  if (!buildingId) {
    const inLot = shelters.filter((id) => state.career.buildings[id].lotId === place);
    buildingId = inLot.find((id) => !state.career.machines[machineKey(def.id, id)]) || inLot[0] || null;
  }
  if (!buildingId) return { reason: 'Choisissez un abri (poulailler, clapier, étable…).' };
  return { key: machineKey(def.id, buildingId), lotId: state.career.buildings[buildingId].lotId, buildingId };
}

/** Clé d'une machine possédée à partir de (machineId, place) ou d'une clé. */
function resolveOwnedKey(state, machineId, place) {
  if (state.career.machines[machineId]) return machineId;
  const def = MACHINES_BY_ID[machineId];
  if (!def) return null;
  if (def.scope === 'farm') return def.id;
  if (def.scope === 'lot') return machineKey(def.id, place);
  if (state.career.machines[machineKey(def.id, place)]) return machineKey(def.id, place);
  return Object.keys(state.career.machines).find((k) => state.career.machines[k].id === def.id && state.career.machines[k].lotId === place) || null;
}

function checkBuy(api, machineId, place) {
  const { state } = api;
  const def = MACHINES_BY_ID[machineId];
  if (!def) return { ok: false, reason: 'Machine inconnue.' };
  const first = def.levels[0];
  if (first.rank > state.career.rank) return { ok: false, reason: rankLabel(first.rank) };
  const where = resolvePlace(state, def, place);
  if (where.reason) return { ok: false, reason: where.reason };
  if (state.career.machines[where.key]) return { ok: false, reason: def.scope === 'farm' ? 'Vous l\'avez déjà.' : 'Déjà installé ici.' };
  if (state.money < first.cost) return { ok: false, reason: api.notEnoughMoney(first.cost - state.money) };
  return { ok: true, cost: first.cost, def, ...where };
}

function buyMachine(api, machineId, place) {
  const check = checkBuy(api, machineId, place);
  if (!check.ok) return api.fail(check.reason);
  const { state } = api;
  const { key, lotId, buildingId, cost, def } = check;
  api.spend('machines', cost, { asset: 'machines', log: { kind: 'machine', id: def.id, key } });
  const m = { id: def.id, lotId, level: 1, on: true, workedDay: 0, usedDay: 0, used: 0 };
  if (buildingId) m.buildingId = buildingId;
  state.career.machines[key] = m;
  api.push('machineBought', { key, id: def.id, lotId, level: 1, on: true, cost, ...(buildingId ? { buildingId } : {}) });
  return { ok: true, key, cost, level: 1 };
}

function checkUpgrade(api, key) {
  const { state } = api;
  const m = key && state.career.machines[key];
  if (!m) return { ok: false, reason: 'Machine absente.' };
  const def = MACHINES_BY_ID[m.id];
  if (m.level >= def.levels.length) return { ok: false, reason: 'Niveau maximal atteint.' };
  const next = def.levels[m.level];
  if (next.rank > state.career.rank) return { ok: false, reason: rankLabel(next.rank) };
  if (state.money < next.cost) return { ok: false, reason: api.notEnoughMoney(next.cost - state.money) };
  return { ok: true, cost: next.cost, level: m.level + 1, m, def };
}

function upgradeMachine(api, machineId, place) {
  const key = resolveOwnedKey(api.state, machineId, place);
  const check = checkUpgrade(api, key);
  if (!check.ok) return api.fail(check.reason);
  const { m, def, cost, level } = check;
  api.spend('machines', cost, { asset: 'machines', log: { kind: 'machine', id: def.id, key } });
  m.level = level;
  api.push('machineUpgraded', { key, id: m.id, lotId: m.lotId, level, on: m.on, cost });
  return { ok: true, key, level, cost };
}

function setMachine(api, machineId, place, on) {
  if (typeof place === 'boolean' && on === undefined) {
    on = place;
    place = null;
  }
  const key = resolveOwnedKey(api.state, machineId, place);
  const m = key && api.state.career.machines[key];
  if (!m) return api.fail('Machine absente.');
  m.on = !!on;
  api.push('machineToggled', { key, id: m.id, lotId: m.lotId, level: m.level, on: m.on });
  return { ok: true, key, on: m.on };
}

// ── Requêtes ─────────────────────────────────────────────────────────────────────────────────

function machineLine(api, key) {
  const { state } = api;
  const m = state.career.machines[key];
  const def = MACHINES_BY_ID[m.id];
  const cw = canWork(api, m);
  const up = checkUpgrade(api, key);
  const max = def.levels.length;
  const lot = api.lot(m.lotId);
  const run = state.career.work?.runs?.find((r) => r.key === key) || null;
  return {
    key,
    id: m.id,
    name: def.name,
    scope: def.scope,
    lotId: m.lotId,
    lotName: lot ? lot.name : null,
    buildingId: m.buildingId ?? null,
    level: m.level,
    maxLevel: max,
    on: m.on,
    working: cw.ok,
    why: cw.ok ? null : cw.reason,
    effectiveLevel: cw.ok ? cw.level : 0,
    puller: cw.ok ? cw.puller : null,
    capacity: cw.ok ? (Number.isFinite(cw.capacity) ? cw.capacity : null) : 0,
    usedToday: machineUsed(state, m),
    workedToday: m.workedDay === absDay(state),
    nextCost: m.level < max ? def.levels[m.level].cost : null,
    nextRank: m.level < max ? def.levels[m.level].rank : null,
    nextText: m.level < max ? def.levels[m.level].text : null,
    text: def.levels[m.level - 1].text,
    fuel: def.fuel,
    upkeep: m.id === 'sprinklers' && state.career.machines.waterTower?.on ? 0 : def.upkeep,
    requires: def.levels[m.level - 1].requires,
    canUpgrade: up.ok,
    reason: up.ok ? null : up.reason,
    coverage: m.id === 'sprinklers' ? sprinklerCoverage(api, m, cw.ok ? cw.level : m.level) : null,
    passes: def.passes.slice(),
    run: run ? JSON.parse(JSON.stringify(run)) : null,
    ...aboutFields('machine', m.id, m.level),
  };
}

function catalog(api) {
  const { state } = api;
  return MACHINES.map((def) => {
    const first = def.levels[0];
    let places = [];
    if (def.scope === 'lot') {
      places = state.career.lots.filter((l) => def.lotTypes.includes(l.type)).map((l) => ({ place: l.id, lotId: l.id, buildingId: null, name: l.name }));
    } else if (def.scope === 'shelter') {
      places = collectShelters(state).map((id) => ({ place: id, lotId: state.career.buildings[id].lotId, buildingId: id, name: BUILDINGS_BY_ID[id].name }));
    } else places = [{ place: null, lotId: FARM_MACHINE_LOT, buildingId: null, name: 'La ferme' }];
    places = places.map((p) => {
      const c = checkBuy(api, def.id, p.place);
      const key = def.scope === 'farm' ? def.id : machineKey(def.id, p.buildingId || p.lotId);
      return { ...p, key, owned: !!state.career.machines[key], canBuy: c.ok, reason: c.ok ? null : c.reason };
    });
    const any = places.find((p) => p.canBuy);
    const lockedByRank = first.rank > state.career.rank ? first.rank : null;
    let reason = null;
    if (!any) {
      if (lockedByRank) reason = rankLabel(first.rank);
      else if (!places.length) reason = def.scope === 'shelter' ? 'Il faut d\'abord un abri avec des animaux à ramasser.' : `Il faut un terrain : ${def.lotTypes.map((t) => lotTypeName(t).toLowerCase()).join(' ou ')}.`;
      else if (places.every((p) => p.owned)) reason = def.scope === 'farm' ? 'Vous l\'avez déjà.' : 'Déjà installé partout.';
      else reason = places.find((p) => !p.owned)?.reason || null;
    }
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      scope: def.scope,
      lotTypes: def.lotTypes.slice(),
      cost: first.cost,
      rank: first.rank,
      lockedByRank,
      fuel: def.fuel,
      upkeep: def.upkeep,
      phase: def.phase || null,
      levels: def.levels.map((l, k) => ({ level: k + 1, cost: l.cost, rank: l.rank, capacity: Number.isFinite(l.capacity) ? l.capacity : null, requires: l.requires, text: l.text })),
      canBuy: !!any,
      reason,
      places,
      compatibleLots: [...new Set(places.filter((p) => !p.owned).map((p) => p.lotId))],
      owned: Object.values(state.career.machines).filter((m) => m && m.id === def.id).length,
      ...aboutFields('machine', def.id, 1),
    };
  });
}

// ── Charges (carburant, entretien) ───────────────────────────────────────────────────────────

function chargesHook(api, { estimate = false } = {}) {
  const { state } = api;
  const today = absDay(state);
  const fuel = fuelOf(state, estimate ? today : today - 1);
  let upkeep = 0;
  const tower = state.career.machines.waterTower?.on;
  for (const m of Object.values(state.career.machines)) {
    if (!m) continue;
    const def = MACHINES_BY_ID[m.id];
    if (!def || !def.upkeep) continue;
    if (m.id === 'sprinklers') {
      if (!tower) upkeep += def.upkeep;
    } else if (m.on) upkeep += def.upkeep;
  }
  if (!estimate) {
    const w = ensureWork(state);
    if (!(state.money < 0)) w.year.fuel = (w.year.fuel || 0) + fuel;
    if (w.fuel) for (const d of Object.keys(w.fuel)) if (Number(d) < today) delete w.fuel[d];
  }
  const out = [];
  if (fuel > 0) out.push({ source: 'fuel', amount: fuel });
  if (upkeep > 0) out.push({ source: 'upkeep', amount: upkeep, detail: 'machines' });
  return out;
}

// ── Vérification ─────────────────────────────────────────────────────────────────────────────

function check(state) {
  const c = state.career;
  const lotIds = new Set(c.lots.map((l) => l.id));
  for (const [key, m] of Object.entries(c.machines)) {
    if (!m || typeof m !== 'object') return `machine ${key}`;
    const def = MACHINES_BY_ID[m.id];
    if (!def) return `machine ${key}`;
    const want = def.scope === 'farm' ? def.id : def.scope === 'shelter' ? machineKey(def.id, m.buildingId) : machineKey(def.id, m.lotId);
    if (key !== want) return `clé de la machine ${key}`;
    if (!lotIds.has(m.lotId)) return `terrain de la machine ${key}`;
    if (!Number.isInteger(m.level) || m.level < 1 || m.level > def.levels.length) return `niveau de la machine ${key}`;
    if (typeof m.on !== 'boolean' || !Number.isInteger(m.workedDay) || m.workedDay < 0) return `machine ${key}`;
  }
  const w = c.work;
  if (!w || typeof w !== 'object' || !Array.isArray(w.runs)) return 'travail du jour';
  for (const r of w.runs) {
    if (!r || typeof r.key !== 'string' || !Array.isArray(r.plots)) return 'passage de machine';
    for (const p of r.plots) if (!Number.isInteger(p.index) || p.index < 0 || p.index >= state.plots.length || typeof p.at !== 'number') return 'passage de machine';
  }
  return null;
}

registerCareerExtension({
  id: 'machines',
  init(state) {
    ensureWork(state);
  },
  migrate(state) {
    ensureWork(state);
    for (const m of Object.values(state.career.machines)) {
      if (!m) continue;
      if (m.workedDay === undefined || m.workedDay === null) m.workedDay = 0;
      if (m.usedDay === undefined) m.usedDay = 0;
      if (m.used === undefined) m.used = 0;
      if (m.on === undefined) m.on = true;
    }
  },
  check,
  hooks: {
    water: waterHook,
    afterProcessing: conveyorHook,
    charges: chargesHook,
  },
  actions(api) {
    return {
      buyMachine: (machineId, place) => buyMachine(api, machineId, place),
      upgradeMachine: (machineId, place) => upgradeMachine(api, machineId, place),
      setMachine: (machineId, place, on) => setMachine(api, machineId, place, on),
    };
  },
  queries(api) {
    return {
      machines: () => Object.keys(api.state.career.machines).filter((k) => api.state.career.machines[k]).map((k) => machineLine(api, k)),
      machine: (key) => (api.state.career.machines[key] ? machineLine(api, key) : null),
      machineCatalog: () => catalog(api),
      /** Passages en cours (animation rang par rang ; relu après un chargement). */
      machineWork: () => JSON.parse(JSON.stringify(api.state.career.work?.runs || [])),
    };
  },
});
