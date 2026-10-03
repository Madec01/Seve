// Mode Carrière — outils communs des extensions CORE-B (animaux, machines, employés, tâches). Pur : aucun
// DOM, aucune horloge. N'enregistre rien (les modules animals.js, machines.js, staff.js et work.js le font).
//
// Contient : jour absolu de la carrière, état de la journée de travail (state.career.work), coup dur vu
// depuis un fournisseur (sans `api`), employés actifs et bonus des soigneurs, niveau effectif des machines
// (cheval / tracteur), ordre de passage des parcelles (rang par rang), choix de la culture à semer (plan
// de culture, sécurité gel, argent).

import { DAY_SECONDS, EPSILON, SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { HARDSHIP } from '../../data/career/career.js';
import { MACHINES_BY_ID } from '../../data/career/machines.js';
import { GARDENER_ACTIONS, MOODS, TRAITS_BY_ID, WORK } from '../../data/career/staff.js';
import { daysLeftInSeason } from '../calendar.js';
import { inGreenhouse, isMature, plotWateredRate } from '../farm.js';
import { VARIETIES_BY_ID } from '../../data/career/valley.js';
import { canHelpersSow, fixedSeedCost, planVariety, survivesFrost } from './heirlooms.js';

export { DAY_SECONDS };

/** Jour absolu de la carrière (1 le premier jour ; continu d'une année à l'autre). */
export function absDay(state) {
  return (state.time.year - 1) * 4 * state.career.seasonLength + state.time.day;
}

/** État de la journée de travail (créé au besoin) : passages des machines, statistiques. */
export function defaultWork() {
  return {
    day: 0,
    runs: [],
    stats: { lostAnimals: 0, collected: { player: 0, keeper: 0, collector: 0 }, staffActions: 0, machineActions: 0 },
    year: { lostAnimals: 0, collected: { player: 0, keeper: 0, collector: 0 }, staffActions: 0, machineActions: 0, wages: 0, fuel: 0 },
  };
}

export function ensureWork(state) {
  const c = state.career;
  if (!c.work || typeof c.work !== 'object') c.work = defaultWork();
  const d = defaultWork();
  for (const k of Object.keys(d)) if (c.work[k] === undefined) c.work[k] = d[k];
  for (const k of ['stats', 'year']) {
    for (const [kk, v] of Object.entries(d[k])) if (c.work[k][kk] === undefined) c.work[k][kk] = v;
  }
  if (!Array.isArray(c.work.runs)) c.work.runs = [];
  return c.work;
}

/** Ajoute aux statistiques (cumul de la carrière et de l'année). */
export function addWorkStat(state, key, n, sub = null) {
  const w = ensureWork(state);
  for (const book of [w.stats, w.year]) {
    if (sub) book[key][sub] = (book[key][sub] || 0) + n;
    else book[key] = (book[key] || 0) + n;
  }
}

/** Coup dur (même règle que api.isPaused) : employés et machines à carburant à l'arrêt. */
export function pausedOf(state) {
  return state.money < 0 || (!!state.career.hardship && state.money < HARDSHIP.recoverMoney);
}

// ── Employés ─────────────────────────────────────────────────────────────────────────────────

export function traitEffects(s) {
  return TRAITS_BY_ID[s.trait]?.effects || {};
}

/** true si l'employé travaille aujourd'hui (métier + affectation, pas en congé, pas de coup dur). */
export function isWorking(state, s) {
  return !!s.job && !!s.lotId && !s.onLeave && !pausedOf(state);
}

/** Terrain couvert par une affectation (lotId exact, ou 'all'). */
export function coversLot(s, lotId) {
  return s.lotId === 'all' || s.lotId === lotId;
}

/** Bonus des soigneurs sur les animaux d'un terrain (le meilleur soigneur compte) : 0,05 × niveau (+0,05). */
export function keeperBonus(state, lotId) {
  let best = 0;
  for (const s of state.career.staff) {
    if (s.job !== 'keeper' || !coversLot(s, lotId) || !isWorking(state, s)) continue;
    const b = WORK.keeperBonusPerLevel * s.level + (traitEffects(s).keeperBonus || 0);
    if (b > best) best = b;
  }
  return best;
}

/** Tracteur possédé et allumé. */
export function tractorOn(state) {
  const t = state.career.machines.tractor;
  return !!t && t.on;
}

/**
 * Actions de base par jour d'un jardinier (sans « Matinal », qui allonge la journée) :
 * 14 / 18 / 22 / 26 / 30 × humeur × Costaud × tracteur × « tous les champs ».
 */
export function gardenerBaseActions(state, s) {
  let n = GARDENER_ACTIONS[Math.min(s.level, GARDENER_ACTIONS.length) - 1];
  n *= MOODS[s.mood]?.factor ?? 1;
  n *= traitEffects(s).actionsFactor || 1;
  if (tractorOn(state)) n *= WORK.tractorFactor;
  if (s.lotId === 'all') n *= WORK.allFactor;
  return n;
}

/** Heure de début du travail (fraction du jour). */
export function workStart(s) {
  return traitEffects(s).startAt ?? WORK.start;
}

/** Durée d'une action de jardinier (secondes de jeu). */
export function gardenerDuration(state, s) {
  return ((WORK.end - WORK.start) * DAY_SECONDS) / gardenerBaseActions(state, s);
}

/** Actions par jour affichées (jardinier ; « Matinal » compris). null pour les autres métiers. */
export function actionsPerDay(state, s) {
  if (s.job !== 'gardener') return null;
  return Math.round((gardenerBaseActions(state, s) * (WORK.end - workStart(s))) / (WORK.end - WORK.start));
}

// ── Machines ─────────────────────────────────────────────────────────────────────────────────

/** Nombre de chevaux (traction des machines niv. 1). */
export function horses(state) {
  return state.investments.horse || 0;
}

/**
 * Niveau auquel une machine peut travailler aujourd'hui (0 : elle ne peut pas) et ce qui la tire :
 * niv. 2 « tracteur » → tracteur allumé, sinon niv. 1 avec un cheval ; niv. 1 « cheval ou tracteur » →
 * cheval d'abord (pas de carburant), sinon tracteur. → { level, puller: null | 'horse' | 'tractor', reason }
 */
export function effectiveLevel(state, m) {
  const def = MACHINES_BY_ID[m.id];
  if (!def) return { level: 0, puller: null, reason: 'Machine inconnue.' };
  for (let lvl = Math.min(m.level, def.levels.length); lvl >= 1; lvl--) {
    const req = def.levels[lvl - 1].requires;
    if (!req) return { level: lvl, puller: null, reason: null };
    if (req === 'tractor' && tractorOn(state)) return { level: lvl, puller: 'tractor', reason: null };
    if (req === 'puller') {
      if (horses(state) > 0) return { level: lvl, puller: 'horse', reason: null };
      if (tractorOn(state)) return { level: lvl, puller: 'tractor', reason: null };
    }
  }
  return { level: 0, puller: null, reason: 'Il faut un cheval ou le tracteur pour la tirer.' };
}

/** Capacité (actions par jour) d'une machine à un niveau. */
export function machineCapacity(m, level) {
  const def = MACHINES_BY_ID[m.id];
  return level > 0 ? def.levels[level - 1].capacity : 0;
}

/** Actions déjà faites aujourd'hui par une machine. */
export function machineUsed(state, m) {
  return m.usedDay === absDay(state) ? m.used || 0 : 0;
}

export function useMachine(state, m, n = 1) {
  const day = absDay(state);
  if (m.usedDay !== day) {
    m.usedDay = day;
    m.used = 0;
  }
  m.used += n;
  m.workedDay = day;
}

// ── Parcelles ────────────────────────────────────────────────────────────────────────────────

/** Colonnes logiques d'un terrain (verger : 3, sinon 4). */
export function colsOf(plot) {
  return plot.env === 'orchard' ? 3 : 4;
}

/** Parcelles ouvertes d'un terrain, rang par rang en serpentin (ordre de passage des machines). */
export function serpentine(state, plotIndices) {
  const list = plotIndices.filter((i) => state.plots[i].unlocked && state.plots[i].env);
  return list.sort((a, b) => {
    const pa = state.plots[a];
    const pb = state.plots[b];
    const cols = colsOf(pa);
    const ra = Math.floor(pa.cell / cols);
    const rb = Math.floor(pb.cell / cols);
    if (ra !== rb) return ra - rb;
    const ca = pa.cell % cols;
    const cb = pb.cell % cols;
    return ra % 2 === 0 ? ca - cb : cb - ca;
  });
}

/** Parcelles ouvertes d'un terrain, dans l'ordre des cases. */
export function byCell(state, plotIndices) {
  return plotIndices.filter((i) => state.plots[i].unlocked && state.plots[i].env).sort((a, b) => state.plots[a].cell - state.plots[b].cell);
}

/** Parcelle mûre (culture ou arbre). */
export { isMature };

/** Aubes avant le prochain gel (Infinity en hiver). */
export function dawnsBeforeFrost(state, level) {
  const si = state.time.seasonIndex;
  if (SEASONS[si] === 'winter') return Infinity;
  let n = daysLeftInSeason(state, level);
  for (let s = si + 1; s < SEASONS.length && SEASONS[s] !== 'winter'; s++) n += level.seasonLengths[s];
  return n;
}

/** Jours avant maturité d'une culture semée aujourd'hui sur cette parcelle (arrosée). */
function daysToMature(state, plot, crop) {
  const rate = plotWateredRate(state, plot, state.time.seasonIndex);
  return Math.ceil(crop.growDays / Math.max(0.01, rate) - EPSILON);
}

function wouldFreeze(state, level, plot, crop) {
  if (inGreenhouse(plot) || crop.frostHardy) return false;
  return daysToMature(state, plot, crop) > dawnsBeforeFrost(state, level);
}

/** Cultures semables sur cette parcelle aujourd'hui (rang, saison ; la serre accepte tout sauf les arbres). */
function sowableCrops(api, plot) {
  const sid = api.seasonId();
  const out = [];
  for (const id of api.level.crops) {
    const crop = getCrop(id);
    if (!crop || isTreeCrop(crop)) continue;
    if (!inGreenhouse(plot) && !crop.seasons.includes(sid)) continue;
    out.push(crop);
  }
  return out;
}

/** Culture la plus rentable par jour, sûre (pas de gel) et payable ; null s'il n'y en a pas. */
export function bestSafeCrop(api, plot) {
  const { state } = api;
  const level = api.level;
  let best = null;
  let bestScore = -Infinity;
  for (const crop of sowableCrops(api, plot)) {
    if (wouldFreeze(state, level, plot, crop)) continue;
    const cost = api.seedCost(crop.id);
    if (cost > state.money) continue;
    const price = crop.sellPrice * (level.cropPriceFactor ?? 1) * (state.market[crop.id] ?? 1);
    const score = (price - cost) / Math.max(1, daysToMature(state, plot, crop));
    if (score > bestScore + 1e-9) {
      best = crop;
      bestScore = score;
    }
  }
  return best;
}

/**
 * (Vallée vivante) Variété fixée que l'équipe ou le semoir sème : plan 'heirloom:<id>', ou 'same' quand la dernière
 * récolte de la parcelle était une variété fixée. Graines gardées d'abord (gratuit), sinon prix × 1,25. → 'heirloom:<id>' | null
 */
function valleyChoice(api, p, want) {
  const { state } = api;
  let id = planVariety(want);
  if (!id && want === 'same' && p.lastVariety && VARIETIES_BY_ID[p.lastVariety]?.cropId === p.lastHarvested) id = p.lastVariety;
  if (!id || !canHelpersSow(state, id)) return null;
  const crop = getCrop(VARIETIES_BY_ID[id].cropId);
  if (!crop || isTreeCrop(crop)) return null;
  if (!inGreenhouse(p) && !crop.seasons.includes(api.seasonId())) return null;
  const hardy = survivesFrost(state, { ...p, variety: id });
  if (!hardy && wouldFreeze(state, api.level, p, crop)) return null;
  const seeds = state.career.valley.seeds[id] || 0;
  const cost = seeds > 0 ? 0 : fixedSeedCost(api.seedCost(crop.id));
  if (cost > state.money) return null;
  return `heirloom:${id}`;
}

/**
 * Culture que le semoir ou un jardinier sème sur une parcelle vide, d'après le plan du terrain (§ 3.4) :
 *   null (« Rien ») → rien ; 'same' → la dernière culture récoltée sur la parcelle si elle se sème encore,
 *   sinon (parcelle neuve, changement de saison) la plus rentable de la saison ; un identifiant → cette
 *   culture. Sécurité : jamais de semis qui gèlera avant maturité (remplacé par la plus rentable qui
 *   résiste, ou rien) ; jamais si l'argent ne couvre pas la graine. → cropId | null
 */
export function sowChoice(api, plotIndex) {
  const { state } = api;
  const p = state.plots[plotIndex];
  if (!p || !p.unlocked || !p.env || p.env === 'orchard' || p.cropId) return null;
  const lot = api.lot(p.lot);
  if (!lot || !lot.plan) return null;
  // (Vallée vivante) Jamais sur une jachère fleurie.
  if (p.fallow !== undefined) return null;
  let want = lot.plan[api.seasonId()];
  if (want === null || want === undefined) return null;
  if (state.career.valley) {
    const v = valleyChoice(api, p, want);
    if (v) return v;
    // Variété pas encore sauvée (ou pas semable aujourd'hui) : la culture ordinaire.
    const planned = planVariety(want);
    if (planned) want = VARIETIES_BY_ID[planned].cropId;
  }
  const options = sowableCrops(api, p);
  let pick = null;
  if (want === 'same') pick = options.find((c) => c.id === p.lastHarvested) || null;
  else pick = options.find((c) => c.id === want) || null;
  if (!pick && want !== 'same') return null;
  if (pick && wouldFreeze(state, api.level, p, pick)) pick = null;
  if (!pick) pick = bestSafeCrop(api, p);
  if (!pick) return null;
  if (api.seedCost(pick.id) > state.money) return null;
  return pick.id;
}
