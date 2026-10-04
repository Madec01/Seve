// Mode Carrière — employés (extension CORE-B « staff ») : candidats (3 par saison), embauche, renvoi,
// métiers et affectations, salaires, expérience et niveaux, humeur, congés, chômage technique ; artisan
// (places d'atelier) et vendeur (bonus de prix). Pur. Conception : docs/CARRIERE.md § 7.
// Les tâches de la journée (trajets, actions) sont dans src/core/career/work.js.
//
// state.career.staff[k] = {
//   id: 's1', name, look: { gender, outfit, hat, tint }, trait, job: null | 'gardener' | 'keeper' | 'artisan' | 'seller',
//   lotId: null | 'all' | lotId ('home' pour le vendeur), level (1-5), xp, wage, mood: 'joyful'|'content'|'tired',
//   streak (jours de travail d'affilée), joyUntilDay (jour absolu : joyeux tant que jour < joyUntilDay),
//   onLeave, leaveDays, idleReason: null | 'noMoney', actionsToday, task: null | { kind, target, from, startAt, doneAt, lotId },
//   plan: { round, queue } (soigneur : tournées du jour), hiredDay, suggestedJob, year: { actions, xp, … }
// }
// state.career.candidates = [{ id: 'c12', name, look, trait, level, xp, wage, suggestedJob }] ; candidatesDay (jour absolu).
//
// Salaires : payés avec les charges de l'aube (point d'accroche `charges`, source 'wages') pour chaque
// employé qui n'est pas en congé ; rien pendant un coup dur (chômage technique). Le salaire commence à
// l'aube qui suit l'embauche.

import { MAX_STAFF } from '../../data/career/career.js';
import { buildingLevelData } from './effects.js';
import { BUILDINGS_BY_ID, WORKSHOPS } from '../../data/career/buildings.js';
import { getProduct } from '../../data/products.js';
import { ARTISAN_PLACES, ARTISAN_PRODUCT_BONUS, CANDIDATES, HIRE_RANK, JOBS, JOBS_BY_ID, MAX_STAFF_LEVEL, MOODS, TRAITS, TRAITS_BY_ID, WAGE, WORK, XP_GAIN, XP_LEVELS } from '../../data/career/staff.js';
import { FIRST_NAMES, LOOK, genderOf, validLook } from '../../data/career/names.js';
import { registerCareerExtension } from './registry.js';
import { rankLabel, staffCapacity } from './buildings.js';
import { daysLeftInSeason } from '../calendar.js';
import { stream } from '../rng.js';
import { capacity as workshopCapacity } from '../processing.js';
import { absDay, actionsPerDay, addWorkStat, coversLot, ensureWork, isWorking, pausedOf, traitEffects } from './crew.js';
import { staffNeverTiredOf } from './heirlooms.js';

// ── Données dérivées ─────────────────────────────────────────────────────────────────────────

/** Salaire par jour d'un niveau (8, 11, 14, 17, 20) ; « Économe » : −2. */
export function wageFor(level, traitId) {
  const delta = TRAITS_BY_ID[traitId]?.effects.wageDelta || 0;
  return Math.max(WAGE.min, WAGE.base + WAGE.perLevel * (level - 1) + delta);
}

/** Niveau correspondant à une expérience. */
export function levelForXp(xp) {
  let lvl = 1;
  for (let k = 1; k < XP_LEVELS.length; k++) if (xp >= XP_LEVELS[k]) lvl = k + 1;
  return lvl;
}

function genderKey(s) {
  return s.look?.gender === 'f' ? 'f' : 'm';
}

export function jobName(job, gender = 'm') {
  return job ? JOBS_BY_ID[job]?.name[gender] ?? job : null;
}

/** Terrains où affecter un métier : [{ lotId, name, type }] (+ 'all' si le métier le permet). */
export function assignableLots(state, job) {
  const def = JOBS_BY_ID[job];
  if (!def) return [];
  if (job === 'seller') return [{ lotId: 'home', name: 'La ferme', type: 'home' }];
  const lots = state.career.lots.filter((l) => {
    if (job === 'keeper') return ['meadow', 'yard', 'pond'].includes(l.type);
    return def.lotTypes.includes(l.type);
  });
  const out = lots.map((l) => ({ lotId: l.id, name: l.name, type: l.type }));
  if (def.all && out.length) out.push({ lotId: 'all', name: def.allLabel, type: 'all' });
  return out;
}

/** Jours avant « Las » (maison : 21, 28 dès la grande maison). */
function tiredDays(state) {
  return buildingLevelData(state, 'house')?.tiredDays ?? WORK.tiredDays;
}

/** Humeur d'un employé aujourd'hui. */
export function moodOf(state, s) {
  const day = absDay(state);
  if ((s.joyUntilDay || 0) > day) return 'joyful';
  // (Vallée V2) Pipistrelle installée : l'été, l'équipe n'est jamais lasse (on prend le frais à les regarder voler).
  if (!traitEffects(s).neverTired && !(state.career?.valley && staffNeverTiredOf(state)) && (s.streak || 0) >= tiredDays(state)) return 'tired';
  return 'content';
}

function setMood(api, s) {
  const mood = moodOf(api.state, s);
  if (mood !== s.mood) {
    const before = s.mood;
    s.mood = mood;
    api.push('staffMood', { staffId: s.id, name: s.name, mood, before });
  }
}

// ── Candidats ────────────────────────────────────────────────────────────────────────────────

function newYearStats() {
  return { actions: 0, harvests: 0, watered: 0, sown: 0, crows: 0, collected: 0, sold: 0, xp: 0, wages: 0, daysWorked: 0 };
}

/** Tire 3 candidats (flux « staff ») : prénoms libres, apparence, trait, niveau, métier conseillé. */
export function drawCandidates(state, rng) {
  const c = state.career;
  const used = new Set([...c.staff.map((s) => s.name)]);
  const list = [];
  const n = CANDIDATES.count;
  for (let k = 0; k < n; k++) {
    const free = FIRST_NAMES.filter((x) => !used.has(x.name));
    const pool = free.length ? free : FIRST_NAMES;
    const name = pool[rng.int(0, pool.length - 1)].name;
    used.add(name);
    const gender = genderOf(name);
    const look = { gender, outfit: rng.int(0, LOOK.outfits - 1), hat: rng.chance(0.5), tint: rng.int(0, LOOK.tints - 1) };
    const trait = TRAITS[rng.int(0, TRAITS.length - 1)].id;
    const level = c.rank >= CANDIDATES.level2Rank && rng.chance(CANDIDATES.level2Chance) ? 2 : 1;
    const suggestedJob = TRAITS_BY_ID[trait].job || JOBS[rng.int(0, JOBS.length - 1)].id;
    const id = `c${c.nextStaffId++}`;
    list.push({ id, name, look, trait, level, xp: XP_LEVELS[level - 1], wage: wageFor(level, trait), suggestedJob });
  }
  return list;
}

function renewCandidates(api) {
  const { state } = api;
  state.career.candidates = drawCandidates(state, api.rng('staff'));
  state.career.candidatesDay = absDay(state);
  api.push('candidatesRenewed', { count: state.career.candidates.length });
}

// ── Artisan : places d'atelier, produits ─────────────────────────────────────────────────────

/** Meilleur artisan au travail sur la cour de ce bâtiment (null s'il n'y en a pas). */
function artisanFor(state, buildingId) {
  const lotId = state.career.buildings[buildingId]?.lotId;
  if (!lotId) return null;
  let best = null;
  for (const s of state.career.staff) {
    if (s.job !== 'artisan' || s.lotId !== lotId || s.onLeave) continue;
    if (!best || s.level > best.level) best = s;
  }
  return best;
}

function extraPlaces(state, buildingId) {
  if (BUILDINGS_BY_ID[buildingId]?.category !== 'workshop') return 0;
  const s = artisanFor(state, buildingId);
  return s ? ARTISAN_PLACES[Math.min(s.level, ARTISAN_PLACES.length) - 1] : 0;
}

/**
 * Remet les places des ateliers à leur capacité (artisan arrivé, parti, en congé, niveau) : ajoute des
 * places libres, ou retire les places en trop après avoir tassé les produits en cours ; un produit qui ne
 * tient plus est vendu en l'état (processingSoldRaw, raison 'artisan').
 */
export function syncWorkshops(api) {
  const { state } = api;
  for (const id of WORKSHOPS) {
    const b = state.processing?.[id];
    if (!b || !state.career.buildings[id]) continue;
    const cap = workshopCapacity(state, id);
    while (b.places.length < cap) b.places.push(null);
    if (b.places.length <= cap) continue;
    const busy = b.places.filter((p) => p !== null);
    const keep = busy.slice(0, cap);
    const extra = busy.slice(cap);
    b.places = [...keep, ...Array.from({ length: cap - keep.length }, () => null)];
    if (extra.length) {
      const amount = extra.reduce((s, p) => s + (p.rawValue || 0), 0);
      api.earn('other', amount);
      api.push('processingSoldRaw', { buildingId: id, amount, count: extra.length, reason: 'artisan' });
    }
  }
}

// ── Vendeur ──────────────────────────────────────────────────────────────────────────────────

/** Le vendeur qui compte (meilleur niveau, au travail). */
export function activeSeller(state) {
  let best = null;
  for (const s of state.career.staff) {
    if (s.job !== 'seller' || !isWorking(state, s)) continue;
    if (!best || s.level > best.level) best = s;
  }
  return best;
}

/** Bonus de prix du vendeur : + 2 % par niveau (+ 3 % « Bavard »). */
export function sellerBonus(state) {
  const s = activeSeller(state);
  return s ? WORK.sellerBonusPerLevel * s.level + (traitEffects(s).sellerBonus || 0) : 0;
}

/** Cours à partir duquel le vendeur vend (1,15 − 0,02 par niveau au-dessus du premier). */
export function sellerThreshold(s) {
  return WORK.sellerThreshold - WORK.sellerThresholdPerLevel * (s.level - 1);
}

// ── Expérience ───────────────────────────────────────────────────────────────────────────────

/** Ajoute de l'expérience (× 1,5 « Vif ») ; passage de niveau : salaire, événement staffLevelUp. */
export function gainXp(api, s, amount) {
  if (!(amount > 0)) return;
  const gain = amount * (traitEffects(s).xpFactor || 1);
  if (!s.year) s.year = newYearStats();
  s.xp = Math.round(((s.xp || 0) + gain) * 100) / 100;
  s.year.xp = Math.round(((s.year.xp || 0) + gain) * 100) / 100;
  while (s.level < MAX_STAFF_LEVEL && s.xp >= XP_LEVELS[s.level]) {
    s.level += 1;
    s.wage = wageFor(s.level, s.trait);
    const g = genderKey(s);
    const job = jobName(s.job, g);
    const apd = actionsPerDay(api.state, s);
    const label = job ? job.toLowerCase() : g === 'f' ? 'employée' : 'employé';
    const text = `${s.name} passe ${label} niveau ${s.level} (${apd ? `${apd} actions par jour, ` : ''}salaire ${s.wage})`;
    api.push('staffLevelUp', { staffId: s.id, name: s.name, level: s.level, job: s.job, wage: s.wage, actionsPerDay: apd, text });
    if (s.job === 'artisan') syncWorkshops(api);
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────────────────────

function findStaff(state, id) {
  return state.career.staff.find((s) => s.id === id) || null;
}

/** Peut-on embaucher ? → { ok } | { ok: false, reason } */
export function canHire(state) {
  const c = state.career;
  if (c.rank < HIRE_RANK) return { ok: false, reason: rankLabel(HIRE_RANK) };
  const cap = Math.min(MAX_STAFF, staffCapacity(state));
  if (cap <= 0) return { ok: false, reason: 'Agrandissez la maison (niveau 2) pour loger un employé.' };
  if (c.staff.length >= cap) return { ok: false, reason: cap >= MAX_STAFF ? `Au plus ${MAX_STAFF} employés.` : `La maison est pleine (${cap} employés) : agrandissez-la.` };
  return { ok: true };
}

function validateAssignment(state, job, lotId) {
  if (job === null || job === undefined) return { ok: true, job: null, lotId: null };
  const def = JOBS_BY_ID[job];
  if (!def) return { ok: false, reason: 'Métier inconnu.' };
  if (job === 'seller') return { ok: true, job, lotId: 'home' };
  if (lotId === null || lotId === undefined) return { ok: true, job, lotId: null };
  if (lotId === 'all') {
    if (!def.all) return { ok: false, reason: 'Ce métier s\'affecte à un seul terrain.' };
    return { ok: true, job, lotId: 'all' };
  }
  const ok = assignableLots(state, job).some((l) => l.lotId === lotId);
  if (!ok) {
    const lot = state.career.lots.find((l) => l.id === lotId);
    if (!lot) return { ok: false, reason: 'Terrain inconnu.' };
    return { ok: false, reason: `${def.name.m} : ${job === 'gardener' ? 'un champ, le verger ou la serre' : job === 'keeper' ? 'un pré, la basse-cour ou la mare' : 'une cour des ateliers'}.` };
  }
  return { ok: true, job, lotId };
}

function applyAssignment(api, s, job, lotId) {
  s.job = job;
  s.lotId = lotId;
  s.task = null;
  s.plan = { round: 0, queue: [] };
  api.push('staffAssigned', { staffId: s.id, name: s.name, job, lotId });
  syncWorkshops(api);
}

function hire(api, candidateId, job, lotId) {
  const { state } = api;
  const c = state.career;
  const can = canHire(state);
  if (!can.ok) return api.fail(can.reason);
  const k = c.candidates.findIndex((x) => x.id === candidateId);
  if (k < 0) return api.fail('Ce candidat n\'est plus disponible.');
  const assign = validateAssignment(state, job, lotId);
  if (!assign.ok) return api.fail(assign.reason);
  const cand = c.candidates[k];
  c.candidates.splice(k, 1);
  const s = {
    id: `s${c.nextStaffId++}`,
    name: cand.name,
    look: { ...cand.look },
    trait: cand.trait,
    job: null,
    lotId: null,
    level: cand.level,
    xp: cand.xp ?? XP_LEVELS[cand.level - 1],
    wage: wageFor(cand.level, cand.trait),
    mood: 'content',
    streak: 0,
    joyUntilDay: 0,
    onLeave: false,
    leaveDays: 0,
    idleReason: pausedOf(state) ? 'noMoney' : null,
    actionsToday: 0,
    task: null,
    plan: { round: 0, queue: [] },
    hiredDay: absDay(state),
    suggestedJob: cand.suggestedJob,
    year: newYearStats(),
  };
  c.staff.push(s);
  api.push('staffHired', { staffId: s.id, name: s.name, look: { ...s.look }, level: s.level, trait: s.trait, wage: s.wage });
  if (assign.job) applyAssignment(api, s, assign.job, assign.lotId);
  return { ok: true, staffId: s.id, staff: JSON.parse(JSON.stringify(s)) };
}

function fire(api, staffId) {
  const { state } = api;
  const k = state.career.staff.findIndex((s) => s.id === staffId);
  if (k < 0) return api.fail('Employé inconnu.');
  const [s] = state.career.staff.splice(k, 1);
  api.push('staffLeft', { staffId: s.id, name: s.name, reason: 'fired', text: `Au revoir, ${s.name} ! Merci pour tout.` });
  syncWorkshops(api);
  return { ok: true, staffId };
}

function assign(api, staffId, job, lotId) {
  const s = findStaff(api.state, staffId);
  if (!s) return api.fail('Employé inconnu.');
  const v = validateAssignment(api.state, job, lotId);
  if (!v.ok) return api.fail(v.reason);
  applyAssignment(api, s, v.job, v.lotId);
  return { ok: true, staffId, job: s.job, lotId: s.lotId };
}

function leaveOne(api, s, on) {
  const { state } = api;
  on = !!on;
  if (s.onLeave === on) return false;
  s.onLeave = on;
  s.task = null;
  s.plan = { round: 0, queue: [] };
  if (!on) {
    if ((s.leaveDays || 0) >= WORK.joyLeaveDays) {
      s.joyUntilDay = absDay(state) + WORK.joyDays;
      s.streak = 0;
    }
    s.leaveDays = 0;
  }
  api.push('staffLeave', { staffId: s.id, name: s.name, on });
  setMood(api, s);
  return true;
}

function setLeave(api, staffId, on) {
  const s = findStaff(api.state, staffId);
  if (!s) return api.fail('Employé inconnu.');
  leaveOne(api, s, on);
  syncWorkshops(api);
  return { ok: true, staffId, onLeave: s.onLeave };
}

function setTeamLeave(api, on) {
  const { state } = api;
  if (!state.career.staff.length) return api.fail('Personne à mettre en congé.');
  let count = 0;
  for (const s of state.career.staff) if (leaveOne(api, s, on)) count++;
  syncWorkshops(api);
  return { ok: true, count, onLeave: !!on };
}

/**
 * Rend l'équipe joyeuse pendant 7 jours (fête du village : CORE-C appelle cette fonction) ; la fête
 * compte comme un repos (le compteur « Las » repart de zéro).
 */
export function cheerStaff(api, { days = WORK.joyDays } = {}) {
  const day = absDay(api.state);
  for (const s of api.state.career.staff) {
    s.joyUntilDay = Math.max(s.joyUntilDay || 0, day + days);
    s.streak = 0;
    setMood(api, s);
  }
}

// ── Points d'accroche ────────────────────────────────────────────────────────────────────────

/** Salaires de l'aube : employés pas en congé ; rien pendant un coup dur. */
function wagesHook(api, { estimate = false } = {}) {
  const { state } = api;
  if (api.isPaused()) return [];
  let total = 0;
  for (const s of state.career.staff) {
    if (s.onLeave) continue;
    // Embauché aujourd'hui : son premier salaire sera payé à l'aube suivante (estimation comprise).
    const wage = Number.isFinite(s.wage) ? s.wage : 0;
    total += wage;
    if (!estimate && s.year) s.year.wages = (s.year.wages || 0) + wage;
  }
  if (!estimate && total > 0) {
    const w = ensureWork(state);
    w.year.wages = (w.year.wages || 0) + total;
  }
  return total > 0 ? [{ source: 'wages', amount: total }] : [];
}

/** Fin de l'aube : congés, chômage technique, humeur ; expérience des artisans (produits vendus). */
function dawnHook(api, { incomes = [] }) {
  const { state } = api;
  const paused = api.isPaused();
  for (const s of state.career.staff) {
    if (!s.year) s.year = newYearStats();
    s.idleReason = paused ? 'noMoney' : null;
    s.actionsToday = 0;
    s.task = null;
    s.plan = { round: 0, queue: [] };
    if (s.onLeave) {
      s.leaveDays = (s.leaveDays || 0) + 1;
      s.streak = 0;
    } else if (!paused && s.job && s.lotId) {
      s.streak = (s.streak || 0) + 1;
      s.year.daysWorked = (s.year.daysWorked || 0) + 1;
    }
    setMood(api, s);
  }
  // Artisans : 2 points par produit vendu à l'aube par un atelier de leur cour.
  for (const inc of incomes) {
    if (inc.kind !== 'processed') continue;
    const s = artisanFor(state, inc.source);
    if (s && !paused) gainXp(api, s, XP_GAIN.artisanProduct);
  }
  syncWorkshops(api);
}

function yearEndHook(api) {
  for (const s of api.state.career.staff) s.year = newYearStats();
  const w = ensureWork(api.state);
  w.year = { lostAnimals: 0, collected: { player: 0, keeper: 0, collector: 0 }, staffActions: 0, machineActions: 0, wages: 0, fuel: 0 };
}

// ── Requêtes ─────────────────────────────────────────────────────────────────────────────────

function lotName(state, lotId, job) {
  if (!lotId) return null;
  if (lotId === 'all') return JOBS_BY_ID[job]?.allLabel ?? 'Partout';
  if (lotId === 'home') return 'La ferme';
  return state.career.lots.find((l) => l.id === lotId)?.name ?? lotId;
}

export function staffStatus(state, s) {
  if (s.onLeave) return 'leave';
  if (pausedOf(state)) return 'noMoney';
  if (!s.job || !s.lotId) return 'unassigned';
  return 'working';
}

function staffLine(api, s) {
  const { state } = api;
  const g = genderKey(s);
  const trait = TRAITS_BY_ID[s.trait];
  return {
    ...JSON.parse(JSON.stringify(s)),
    gender: g,
    jobName: jobName(s.job, g),
    lotName: lotName(state, s.lotId, s.job),
    actionsPerDay: actionsPerDay(state, s),
    nextLevelXp: s.level < MAX_STAFF_LEVEL ? XP_LEVELS[s.level] : null,
    levelXp: XP_LEVELS[s.level - 1],
    moodName: MOODS[s.mood]?.name[g] ?? s.mood,
    traitName: trait?.name[g] ?? s.trait,
    traitText: trait?.text ?? '',
    status: staffStatus(state, s),
    assignable: JOBS.map((j) => ({ job: j.id, name: j.name[g], lots: assignableLots(state, j.id) })),
  };
}

function candidateLine(c) {
  const g = c.look.gender === 'f' ? 'f' : 'm';
  const trait = TRAITS_BY_ID[c.trait];
  return {
    ...JSON.parse(JSON.stringify(c)),
    gender: g,
    traitName: trait?.name[g] ?? c.trait,
    traitText: trait?.text ?? '',
    suggestedJobName: jobName(c.suggestedJob, g),
  };
}

function candidatesQuery(api) {
  const { state } = api;
  const can = canHire(state);
  return {
    list: state.career.candidates.map(candidateLine),
    nextInDays: daysLeftInSeason(state, api.level) + 1,
    capacity: Math.min(MAX_STAFF, staffCapacity(state)),
    count: state.career.staff.length,
    canHire: can.ok && state.career.candidates.length > 0,
    reason: can.ok ? (state.career.candidates.length ? null : 'Pas de candidat pour l\'instant.') : can.reason,
    wages: state.career.staff.filter((s) => !s.onLeave).reduce((sum, s) => sum + (s.wage || 0), 0),
  };
}

// ── Vérification, migration ──────────────────────────────────────────────────────────────────

function check(state) {
  const c = state.career;
  const lotIds = new Set(c.lots.map((l) => l.id));
  const ids = new Set();
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const s of c.staff) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || ids.has(s.id)) return 'employé';
    ids.add(s.id);
    if (typeof s.name !== 'string' || !s.name) return `nom de l'employé ${s.id}`;
    if (!validLook(s.look)) return `apparence de l'employé ${s.id}`;
    if (!TRAITS_BY_ID[s.trait]) return `trait de l'employé ${s.id}`;
    if (s.job !== null && !JOBS_BY_ID[s.job]) return `métier de l'employé ${s.id}`;
    if (s.lotId !== null && s.lotId !== 'all' && !lotIds.has(s.lotId)) return `affectation de l'employé ${s.id}`;
    if (!Number.isInteger(s.level) || s.level < 1 || s.level > MAX_STAFF_LEVEL || !num(s.xp) || s.xp < 0) return `niveau de l'employé ${s.id}`;
    if (!Number.isInteger(s.wage) || s.wage < 0) return `salaire de l'employé ${s.id}`;
    if (!MOODS[s.mood] || typeof s.onLeave !== 'boolean' || !Number.isInteger(s.streak)) return `humeur de l'employé ${s.id}`;
    if (s.task !== null && (typeof s.task !== 'object' || typeof s.task.kind !== 'string' || !num(s.task.startAt) || !num(s.task.doneAt))) return `tâche de l'employé ${s.id}`;
  }
  if (!Array.isArray(c.candidates)) return 'candidats';
  for (const cand of c.candidates) {
    if (!cand || typeof cand.id !== 'string' || typeof cand.name !== 'string' || !validLook(cand.look) || !TRAITS_BY_ID[cand.trait] || !Number.isInteger(cand.level)) return 'candidat';
  }
  if (!Number.isInteger(c.nextStaffId) || c.nextStaffId < 1) return 'employés (compteur)';
  return null;
}

function migrate(state) {
  const c = state.career;
  ensureWork(state);
  if (!Number.isInteger(c.nextStaffId)) c.nextStaffId = 1;
  if (!Array.isArray(c.candidates)) c.candidates = [];
  for (const s of c.staff) {
    if (s.look && !s.look.gender) s.look.gender = genderOf(s.name);
    if (s.leaveDays === undefined) s.leaveDays = 0;
    if (!s.plan) s.plan = { round: 0, queue: [] };
    if (!s.year) s.year = newYearStats();
    if (s.hiredDay === undefined) s.hiredDay = 0;
    if (s.task === undefined) s.task = null;
    if (s.actionsToday === undefined) s.actionsToday = 0;
    if (s.joyUntilDay === undefined) s.joyUntilDay = 0;
    if (s.streak === undefined) s.streak = 0;
    if (s.idleReason === undefined) s.idleReason = null;
  }
  for (const cand of c.candidates) if (cand.look && !cand.look.gender) cand.look.gender = genderOf(cand.name);
}

registerCareerExtension({
  id: 'staff',
  init(state) {
    ensureWork(state);
    // Premiers candidats (visibles dès que l'embauche est débloquée), tirés du flux « staff ».
    state.career.candidates = drawCandidates(state, stream(state.rng, 'staff'));
    state.career.candidatesDay = 1;
  },
  migrate,
  check,
  hooks: {
    seasonStart(api) {
      renewCandidates(api);
    },
    charges: wagesHook,
    dawn: dawnHook,
    yearEnd: yearEndHook,
  },
  providers: {
    effects(state, key) {
      return key === 'priceBonus' ? sellerBonus(state) : 0;
    },
    extraPlaces,
    priceFactor(state, { kind, id }) {
      if (kind !== 'product') return 1;
      const building = getProduct(id)?.building;
      const s = building ? artisanFor(state, building) : null;
      return s && s.level >= ARTISAN_PRODUCT_BONUS.level ? ARTISAN_PRODUCT_BONUS.factor : 1;
    },
  },
  actions(api) {
    return {
      hire: (candidateId, job, lotId) => hire(api, candidateId, job, lotId),
      fire: (staffId) => fire(api, staffId),
      assign: (staffId, job, lotId) => assign(api, staffId, job, lotId),
      setLeave: (staffId, on) => setLeave(api, staffId, on),
      setTeamLeave: (on) => setTeamLeave(api, on),
    };
  },
  queries(api) {
    return {
      staff: () => api.state.career.staff.map((s) => staffLine(api, s)),
      staffMember: (id) => {
        const s = findStaff(api.state, id);
        return s ? staffLine(api, s) : null;
      },
      candidates: () => candidatesQuery(api),
      /** Métiers et traits (fiches, feuilles d'embauche). */
      jobs: () => JOBS.map((j) => ({ id: j.id, name: { ...j.name }, text: j.text, all: j.all, allLabel: j.allLabel || null, tool: j.tool })),
      traits: () => TRAITS.map((t) => ({ id: t.id, name: { ...t.name }, text: t.text })),
    };
  },
});

export { coversLot, addWorkStat };
