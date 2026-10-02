// Mode Carrière — moteur des tâches (extension CORE-B « work ») : ce que font les employés et les machines
// pendant la journée, dans l'ordre chronologique, de façon déterministe. Pur. Conception :
// docs/CARRIERE.md § 6, § 7.2 et § 12 ; contrat : docs/ARCHITECTURE.md (« Mode Carrière — livraison CORE-B »).
//
// Le point d'accroche `tick(api, from, to)` reçoit les tranches de temps (from, to] (secondes écoulées dans
// la journée) ; un grand dt est découpé par le cœur jour par jour. Dans une tranche, on traite, du plus tôt
// au plus tard (à égalité : machines, puis parcelles des passages, puis employés dans l'ordre de l'équipe) :
//   - les passages des machines (moissonneuse et cueilleuse 30 %, semoir 35 %, collecteurs 40 % et 80 %) :
//     un passage choisit ses parcelles au départ et les traite rang par rang, chacune à son heure
//     (state.career.work.runs, événement machineWorked au départ, machineRunDone à la fin) ;
//   - les tâches des employés : chaque tâche a une heure de début et une heure de fin (doneAt) ; l'action
//     est faite à doneAt si elle est encore utile (sinon : pas d'expérience), puis la tâche suivante est
//     choisie à cet instant (événements taskDone puis taskStarted). Entre les deux, le rendu fait marcher
//     le personnage de `from` vers `target` puis joue l'action.
//
// Tâches (task = { kind, target, from, startAt, doneAt, lotId }) :
//   jardinier : 'chase' (corbeau) > 'harvest' / 'pick' (verger) > 'water' > 'sow' (plan de culture, achète
//               la graine) ; sinon 'idle' ; durée = 70 % du jour ÷ actions par jour ; de 15 % (Matinal : 5 %)
//               à 85 % du jour ; il laisse le travail aux machines de son terrain qui ne sont pas encore passées.
//   soigneur  : tournées à 25 %, 55 %, 85 % du jour : 'collect' à chaque abri de ses terrains (3 % du jour
//               par abri), 'idle' entre deux tournées.
//   artisan   : 'craft' à tour de rôle dans les ateliers de sa cour (animation ; l'effet est permanent).
//   vendeur   : 'sell' au grenier (vend ce qui est au bon cours), puis 'idle' à l'étal, et ainsi de suite.
//   fin de journée : 'home' (retour à la maison) ; ensuite task = null (le rendu le fait flâner près de la maison).
// target = { type: 'plot', plotIndex, lotId } | { type: 'building', buildingId, lotId } | { type: 'lot', lotId }
//        | { type: 'home', lotId: 'home' } ; from = target de la tâche précédente (maison au début du jour).

import { DAY_SECONDS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { BUILDINGS_BY_ID, WORKSHOPS } from '../../data/career/buildings.js';
import { CAREER_ANIMALS_BY_ID } from '../../data/career/animals.js';
import { WORK, XP_GAIN } from '../../data/career/staff.js';
import { registerCareerExtension, providedFactor } from './registry.js';
import { inGreenhouse, needsWaterToday } from '../farm.js';
import { absDay, addWorkStat, byCell, coversLot, ensureWork, gardenerDuration, isMature, isWorking, sowChoice, workStart } from './crew.js';
import { doRunStep, machineWillPass, nextRunStep, passesBetween, startPass } from './machines.js';
import { collectShelter } from './animals.js';
import { gainXp, sellerThreshold, staffStatus } from './staff.js';
import { chaseCrowAt } from './events.js';
import { giantOpenToHelpers } from '../surprises.js';

const EPS = 1e-9;
const MAX_STEPS = 50000;
const HOME = Object.freeze({ type: 'home', lotId: 'home' });

const GARDEN_TYPES = ['field', 'orchard', 'greenhouse'];

// ── Cibles ───────────────────────────────────────────────────────────────────────────────────

function gardenLots(state, s) {
  const lots = state.career.lots.filter((l) => GARDEN_TYPES.includes(l.type));
  return s.lotId === 'all' ? lots : lots.filter((l) => l.id === s.lotId);
}

/** Parcelles déjà visées (autres employés, passages de machines en cours). */
function reservedPlots(state, except) {
  const set = new Set();
  for (const o of state.career.staff) {
    if (o === except || !o.task || o.task.target?.type !== 'plot') continue;
    set.add(o.task.target.plotIndex);
  }
  for (const r of state.career.work.runs) for (const p of r.plots) if (!p.done) set.add(p.index);
  return set;
}

/** Ce qu'un jardinier ferait sur une parcelle maintenant ('chase' | 'harvest' | 'pick' | 'water' | 'sow' | null). */
function gardenAction(api, i, t, pass) {
  const { state } = api;
  const p = state.plots[i];
  if (!p || !p.unlocked || !p.env) return null;
  const crop = p.cropId ? getCrop(p.cropId) : null;
  const tree = !!crop && isTreeCrop(crop);
  switch (pass) {
    case 'chase':
      return p.crow && p.cropId ? 'chase' : null;
    case 'harvest': {
      if (!crop || !isMature(p) || !giantOpenToHelpers(state, i)) return null; // (lot 2) le géant attend d'abord le joueur
      const kind = tree ? 'pick' : 'harvest';
      return machineWillPass(api, p.lot, kind, t) ? null : kind;
    }
    case 'water': {
      if (!crop || tree || p.watered || isMature(p)) return null;
      return needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : state.weather.today, api.level) ? 'water' : null;
    }
    case 'sow': {
      if (p.cropId || p.env === 'orchard') return null;
      if (machineWillPass(api, p.lot, 'sow', t)) return null;
      return sowChoice(api, i) !== null ? 'sow' : null;
    }
    default:
      return null;
  }
}

function pickGardenerTarget(api, s, t) {
  const { state } = api;
  const lots = gardenLots(state, s);
  const reserved = reservedPlots(state, s);
  for (const pass of ['chase', 'harvest', 'water', 'sow']) {
    for (const lot of lots) {
      for (const i of byCell(state, api.lotPlots(lot.id))) {
        if (reserved.has(i)) continue;
        const kind = gardenAction(api, i, t, pass);
        if (kind) return { kind, target: { type: 'plot', plotIndex: i, lotId: lot.id } };
      }
    }
  }
  return null;
}

/** Abris d'un soigneur (production à ramasser, animaux présents). */
function keeperShelters(state, s) {
  return Object.keys(state.career.buildings).filter((id) => {
    const def = BUILDINGS_BY_ID[id];
    if (def?.category !== 'shelter') return false;
    if (!CAREER_ANIMALS_BY_ID[def.animal]?.collect) return false;
    if ((state.investments[def.animal] || 0) <= 0) return false;
    return coversLot(s, state.career.buildings[id].lotId);
  });
}

function buildingTarget(state, buildingId) {
  return { type: 'building', buildingId, lotId: state.career.buildings[buildingId]?.lotId ?? 'home' };
}

function lotTarget(state, s) {
  if (s.lotId && s.lotId !== 'all') return { type: 'lot', lotId: s.lotId };
  const lot = s.job === 'gardener' ? gardenLots(state, s)[0] : null;
  return lot ? { type: 'lot', lotId: lot.id } : { ...HOME };
}

// ── Choix de la tâche suivante ───────────────────────────────────────────────────────────────

const END = () => WORK.end * DAY_SECONDS;

function makeTask(kind, target, t, duration) {
  return { kind, target, startAt: t, doneAt: Math.min(DAY_SECONDS, t + Math.max(0.001, duration)) };
}

function gardenerTask(api, s, t) {
  const d = gardenerDuration(api.state, s);
  if (t + d > END() + EPS) return null;
  const pick = pickGardenerTarget(api, s, t);
  if (pick) return makeTask(pick.kind, pick.target, t, d);
  return makeTask('idle', lotTarget(api.state, s), t, d);
}

function keeperTask(api, s, t) {
  const { state } = api;
  const rounds = WORK.keeperRounds;
  const plan = s.plan || (s.plan = { round: 0, queue: [] });
  const visit = WORK.keeperVisit * DAY_SECONDS;
  for (let guard = 0; guard < 8; guard++) {
    while (plan.queue.length) {
      const id = plan.queue.shift();
      if (state.career.buildings[id]) return makeTask('collect', buildingTarget(state, id), t, visit);
    }
    if (plan.round >= rounds.length) return null;
    const tr = rounds[plan.round] * DAY_SECONDS;
    if (t + EPS < tr) {
      const first = keeperShelters(state, s)[0];
      return makeTask('idle', first ? buildingTarget(state, first) : lotTarget(state, s), t, tr - t);
    }
    plan.round += 1;
    plan.queue = keeperShelters(state, s);
  }
  return null;
}

function artisanTask(api, s, t) {
  const { state } = api;
  const d = WORK.artisanSession * DAY_SECONDS;
  if (t + d > END() + EPS) return null;
  const shops = WORKSHOPS.filter((id) => state.career.buildings[id]?.lotId === s.lotId);
  if (!shops.length) return makeTask('idle', lotTarget(state, s), t, d);
  const id = shops[(s.actionsToday || 0) % shops.length];
  return makeTask('craft', buildingTarget(state, id), t, d);
}

function sellerTask(api, s, t, prev) {
  const { state } = api;
  const visit = WORK.sellerVisit * DAY_SECONDS;
  const wait = WORK.sellerEvery * DAY_SECONDS;
  if (t + visit > END() + EPS) return null;
  const stand = state.career.buildings.roadsideStand ? buildingTarget(state, 'roadsideStand') : { ...HOME };
  if (!state.career.buildings.storage) return makeTask('idle', stand, t, Math.min(wait, END() - t));
  if (prev && prev.kind === 'sell') return makeTask('idle', stand, t, Math.max(visit, Math.min(wait, END() - t)));
  return makeTask('sell', buildingTarget(state, 'storage'), t, visit);
}

function nextTask(api, s, t, prev) {
  switch (s.job) {
    case 'gardener':
      return gardenerTask(api, s, t);
    case 'keeper':
      return keeperTask(api, s, t);
    case 'artisan':
      return artisanTask(api, s, t);
    case 'seller':
      return sellerTask(api, s, t, prev);
    default:
      return null;
  }
}

/** Heure (secondes) à laquelle un employé sans tâche peut commencer, ou null (pas aujourd'hui). */
function startTime(api, s, cursor) {
  const { state } = api;
  if (!isWorking(state, s)) return null;
  const t = Math.max(cursor, workStart(s) * DAY_SECONDS);
  switch (s.job) {
    case 'gardener':
      return t + gardenerDuration(state, s) <= END() + EPS ? t : null;
    case 'keeper': {
      const plan = s.plan || { round: 0, queue: [] };
      if (!plan.queue.length && plan.round >= WORK.keeperRounds.length) return null;
      return t < DAY_SECONDS * 0.97 ? t : null;
    }
    case 'artisan':
      return t + WORK.artisanSession * DAY_SECONDS <= END() + EPS ? t : null;
    case 'seller':
      return t + WORK.sellerVisit * DAY_SECONDS <= END() + EPS ? t : null;
    default:
      return null;
  }
}

// ── Exécution ────────────────────────────────────────────────────────────────────────────────

function sellerSell(api, s) {
  const { state } = api;
  let amount = 0;
  let count = 0;
  const threshold = sellerThreshold(s);
  for (const cropId of Object.keys(state.career.stock).sort()) {
    const fair = providedFactor('priceFactor', state, { kind: 'stock', id: cropId }) > 1;
    const good = (state.market[cropId] ?? 1) >= threshold - EPS || api.offSeason(cropId);
    if (!fair && !good) continue;
    const r = api.sellStock(cropId, undefined, fair ? 'fair' : 'seller');
    if (r.ok) {
      amount += r.amount;
      count += r.count;
    }
  }
  return { ok: count > 0, amount, count };
}

/** Fait l'action d'une tâche arrivée à son terme. → { ok, … } */
function perform(api, s, task) {
  const { state } = api;
  const i = task.target?.plotIndex;
  switch (task.kind) {
    case 'chase': {
      const p = state.plots[i];
      if (!p || !p.crow) return { ok: false };
      const r = chaseCrowAt(api, i, 'staff');
      if (r.ok) s.year.crows = (s.year.crows || 0) + 1;
      return { ok: !!r.ok };
    }
    case 'harvest':
    case 'pick': {
      const p = state.plots[i];
      if (!p || !p.cropId || !isMature(p)) return { ok: false };
      const r = api.harvest(i, { by: 'staff' });
      if (r.ok) s.year.harvests = (s.year.harvests || 0) + 1;
      return r.ok ? { ok: true, amount: r.amount, cropId: r.cropId, stored: r.stored, processed: !!r.processed } : { ok: false };
    }
    case 'water': {
      const p = state.plots[i];
      const crop = p?.cropId ? getCrop(p.cropId) : null;
      if (!crop || p.watered || isMature(p) || !needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : state.weather.today, api.level)) return { ok: false };
      const r = api.water(i, { by: 'staff' });
      if (r.ok) s.year.watered = (s.year.watered || 0) + 1;
      return { ok: !!r.ok };
    }
    case 'sow': {
      const cropId = sowChoice(api, i);
      if (!cropId) return { ok: false };
      const r = api.plant(i, cropId, { by: 'staff' });
      if (r.ok) s.year.sown = (s.year.sown || 0) + 1;
      return r.ok ? { ok: true, cropId, cost: r.cost } : { ok: false };
    }
    case 'collect': {
      const id = task.target.buildingId;
      if (Math.round(state.career.buildings[id]?.pending || 0) <= 0) return { ok: false };
      const r = collectShelter(api, id, 'keeper', { staffId: s.id });
      if (r.ok) s.year.collected = (s.year.collected || 0) + r.amount;
      return r.ok ? { ok: true, amount: r.amount } : { ok: false };
    }
    case 'sell': {
      const r = sellerSell(api, s);
      if (r.ok) s.year.sold = (s.year.sold || 0) + r.amount;
      return r;
    }
    case 'craft':
      return { ok: true, passive: true };
    default:
      return { ok: false };
  }
}

function xpFor(s, task, result) {
  if (!result.ok || result.passive) return 0;
  switch (task.kind) {
    case 'collect':
      return XP_GAIN.keeperShelter;
    case 'sell':
      return result.amount / XP_GAIN.sellerPerCoins;
    case 'chase':
    case 'harvest':
    case 'pick':
    case 'water':
    case 'sow':
      return XP_GAIN.gardener;
    default:
      return 0;
  }
}

function setTask(api, s, task, from) {
  s.task = { ...task, from: from ? { ...from } : { ...HOME }, lotId: s.lotId };
  api.push('taskStarted', { staffId: s.id, kind: s.task.kind, target: { ...s.task.target }, from: { ...s.task.from }, startAt: s.task.startAt, doneAt: s.task.doneAt, lotId: s.lotId, job: s.job });
}

/** Un pas d'un employé à l'heure t : fin de la tâche en cours (action, expérience), puis tâche suivante. */
function staffStep(api, s, t) {
  const { state } = api;
  let prev = null;
  if (!s.year) s.year = {};
  if (s.task) {
    prev = s.task;
    s.task = null;
    let result = { ok: false };
    if (prev.kind !== 'home' && prev.kind !== 'idle' && isWorking(state, s)) result = perform(api, s, prev);
    if (result.ok && !result.passive) {
      s.actionsToday = (s.actionsToday || 0) + 1;
      s.year.actions = (s.year.actions || 0) + 1;
      addWorkStat(state, 'staffActions', 1);
    } else if (prev.kind === 'craft') s.actionsToday = (s.actionsToday || 0) + 1;
    api.push('taskDone', { staffId: s.id, kind: prev.kind, target: { ...prev.target }, startAt: prev.startAt, doneAt: prev.doneAt, result });
    const xp = xpFor(s, prev, result);
    if (xp > 0) gainXp(api, s, xp);
  }
  const from = prev ? prev.target : HOME;
  const task = isWorking(state, s) ? nextTask(api, s, t, prev) : null;
  if (task) setTask(api, s, task, from);
  else if (prev && prev.kind !== 'home') setTask(api, s, makeTask('home', { ...HOME }, t, WORK.homeWalk * DAY_SECONDS), from);
  else if (!prev) {
    // Rien à faire alors qu'il pouvait commencer : il reste à la maison jusqu'à la fin de sa journée.
    setTask(api, s, makeTask('home', { ...HOME }, t, Math.max(WORK.homeWalk * DAY_SECONDS, END() - t)), HOME);
  }
}

/** Heure du prochain pas d'un employé (fin de tâche, ou début de journée), ou null. */
function staffTime(api, s, cursor) {
  if (s.task) return Math.max(cursor, s.task.doneAt);
  return startTime(api, s, cursor);
}

/** Tranche (from, to] : passages des machines et tâches des employés, dans l'ordre chronologique. */
export function runTick(api, from, to) {
  const { state } = api;
  if (!api.playing() || !(to > from)) return;
  ensureWork(state);
  const passes = passesBetween(state, from, to);
  let pi = 0;
  let cursor = from;
  for (let guard = 0; guard < MAX_STEPS; guard++) {
    if (!api.playing()) return;
    let best = null;
    const consider = (t, rank, run) => {
      if (t === null || t > to + EPS) return;
      if (!best || t < best.t - EPS || (Math.abs(t - best.t) <= EPS && rank < best.rank)) best = { t, rank, run };
    };
    if (pi < passes.length) {
      const p = passes[pi];
      consider(p.t, 0, () => {
        pi++;
        startPass(api, p.key, p.t);
      });
    }
    const step = nextRunStep(state, to);
    if (step) consider(Math.max(cursor, step.plot.at), 1, () => doRunStep(api, step.run, step.plot));
    state.career.staff.forEach((s, k) => {
      const t = staffTime(api, s, cursor);
      if (t !== null) consider(t, 2 + k / 1000, () => staffStep(api, s, Math.max(cursor, t)));
    });
    if (!best) break;
    cursor = Math.max(cursor, best.t);
    best.run();
  }
}

// ── Requête pour le rendu ────────────────────────────────────────────────────────────────────

function workPlan(api) {
  const { state } = api;
  return state.career.staff.map((s) => ({
    staffId: s.id,
    name: s.name,
    look: { ...s.look },
    job: s.job,
    lotId: s.lotId,
    status: staffStatus(state, s),
    mood: s.mood,
    actionsToday: s.actionsToday || 0,
    task: s.task ? JSON.parse(JSON.stringify(s.task)) : null,
    tool: s.job === 'gardener' ? toolFor(s.task?.kind) : { keeper: 'pail', artisan: 'hoe', seller: 'basket' }[s.job] || null,
  }));
}

/** Outil tenu (sprite `tool.<id>` de l'atlas) selon la tâche du jardinier. */
function toolFor(kind) {
  return { water: 'can', harvest: 'basket', pick: 'basket', sow: 'seedbag', chase: 'hoe' }[kind] || 'hoe';
}

registerCareerExtension({
  id: 'work',
  init(state) {
    ensureWork(state).day = absDay(state);
  },
  migrate(state) {
    ensureWork(state);
  },
  hooks: {
    dawn(api) {
      const w = ensureWork(api.state);
      w.day = absDay(api.state);
      w.runs = [];
    },
    tick(api, from, to) {
      runTick(api, from, to);
    },
  },
  queries(api) {
    return {
      workPlan: () => workPlan(api),
      /** Heure du jour (secondes) : les tâches et passages se lisent par rapport à elle. */
      workClock: () => ({ elapsed: api.state.time.elapsed, day: absDay(api.state), daySeconds: DAY_SECONDS }),
    };
  },
});
