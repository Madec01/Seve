// Progression permanente (v3) — PURE : aucune lecture ni écriture de stockage (voir src/storage.js).
// Étoiles, bonus permanents, succès, écus, cosmétiques, cumuls de toutes les parties.
// Toutes les fonctions qui modifient la progression renvoient un NOUVEL objet (l'entrée n'est jamais modifiée).
//
// Objet de progression (schéma 2) :
// { schema: 2,
//   levels: { [id]: { stars, bestMoney, completed, played } },
//   perks: { [perkId]: rank }, perksEnabled: true,
//   achievements: { [id]: { at } },
//   lifetime: { harvests, cropsHarvested: { [cropId]: n }, productsSold: { [productId]: n }, yearsWon, yearsLost, rentsPaid },
//   ecus: 0,
//   cosmetics: { farmName, outfit, path, fence, decor: { [slotId]: itemId }, owned: [itemId] },
//   hintsSeen: [hintId],
//   difficulty: 'detente' | 'classique',    mode choisi pour les NOUVELLES parties (défaut : détente,
//                                           y compris pour une progression d'avant les modes)
//   career: { started, bestRank, bestYear, years,          mode Carrière (docs/CARRIERE.md § 1.6 et § 1.8) :
//             archive: [{ farmName, years, rank, patrimony, endedBy: 'bankrupt'|'restart' }] } (5 dernières, la plus récente d'abord)
// }
// Les succès parcourent ALL_ACHIEVEMENTS (niveaux + carrière) ; ceux de la carrière (category 'career') ne
// donnent que des écus.
//
// Étoiles et records : une seule fiche par niveau, quel que soit le mode (on garde le meilleur).

import { ACHIEVEMENTS as LEVEL_ACHIEVEMENTS, ALL_ACHIEVEMENTS as ACHIEVEMENTS, CAREER_ACHIEVEMENTS, getAchievement } from '../data/achievements.js';
import { CAREER_ARCHIVE_MAX, CAREER_ECUS } from '../data/career/career.js';
import { COSMETICS, DECOR_SLOTS_BY_ID, DEFAULT_COSMETICS, DEFAULT_FARM_NAME, FARM_NAME_MAX, getCosmetic } from '../data/cosmetics.js';
import { getCrop } from '../data/crops.js';
import { LEVELS, getLevel } from '../data/levels.js';
import { PERKS, PERK_TIERS, getPerk, perkMaxRank } from '../data/perks.js';
import { getProduct } from '../data/products.js';
import { DEFAULT_DIFFICULTY, isDifficulty } from '../data/difficulty.js';

export const PROGRESS_SCHEMA = 2;

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNegInt = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

function defaultCosmetics() {
  // owned : toujours dans l'ordre du catalogue (COSMETICS).
  return { ...clone(DEFAULT_COSMETICS), decor: {}, owned: COSMETICS.filter((i) => DEFAULT_COSMETICS.owned.includes(i.id)).map((i) => i.id) };
}

/** Progression de la carrière (vide). */
export function defaultCareerProgress() {
  return { started: false, bestRank: 0, bestYear: 0, years: 0, archive: [] };
}

function defaultLifetime() {
  return { harvests: 0, cropsHarvested: {}, productsSold: {}, yearsWon: 0, yearsLost: 0, rentsPaid: 0 };
}

/** Progression vide (première partie). */
export function defaultProgress() {
  return {
    schema: PROGRESS_SCHEMA,
    levels: {},
    perks: {},
    perksEnabled: true,
    achievements: {},
    lifetime: defaultLifetime(),
    ecus: 0,
    cosmetics: defaultCosmetics(),
    hintsSeen: [],
    difficulty: DEFAULT_DIFFICULTY,
    career: defaultCareerProgress(),
  };
}

function countMap(raw, known) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, n] of Object.entries(raw)) if (known(id) && nonNegInt(n) > 0) out[id] = nonNegInt(n);
  return out;
}

/**
 * Normalise une progression lue (v1 `{ levels }`, v2, ou abîmée) : champs abîmés → valeurs par défaut,
 * références inconnues (niveau, bonus, succès, objet, emplacement) ignorées. Ne débloque rien.
 */
export function normalizeProgress(raw) {
  const p = defaultProgress();
  if (!isObj(raw)) return p;
  // Niveaux
  if (isObj(raw.levels)) {
    for (const [id, v] of Object.entries(raw.levels)) {
      if (!getLevel(Number(id)) || !isObj(v)) continue;
      const completed = v.completed === true;
      p.levels[Number(id)] = {
        stars: Math.max(0, Math.min(3, Math.floor(Number(v.stars) || 0))),
        bestMoney: Number.isFinite(v.bestMoney) ? v.bestMoney : null,
        completed,
        played: v.played === true || completed,
      };
    }
  }
  // Bonus
  if (isObj(raw.perks)) {
    for (const perk of PERKS) {
      const rank = raw.perks[perk.id];
      if (Number.isInteger(rank) && rank >= 1) p.perks[perk.id] = Math.min(rank, perkMaxRank(perk));
    }
  }
  if (typeof raw.perksEnabled === 'boolean') p.perksEnabled = raw.perksEnabled;
  // Succès
  if (isObj(raw.achievements)) {
    for (const a of ACHIEVEMENTS) {
      const v = raw.achievements[a.id];
      if (v === undefined || v === null || v === false) continue;
      p.achievements[a.id] = { at: isObj(v) && Number.isFinite(v.at) ? v.at : null };
    }
  }
  // Cumuls
  if (isObj(raw.lifetime)) {
    const l = raw.lifetime;
    p.lifetime = {
      harvests: nonNegInt(l.harvests),
      cropsHarvested: countMap(l.cropsHarvested, (id) => !!getCrop(id)),
      productsSold: countMap(l.productsSold, (id) => !!getProduct(id)),
      yearsWon: nonNegInt(l.yearsWon),
      yearsLost: nonNegInt(l.yearsLost),
      rentsPaid: nonNegInt(l.rentsPaid),
    };
  }
  p.ecus = nonNegInt(raw.ecus);
  // Cosmétiques
  if (isObj(raw.cosmetics)) {
    const c = raw.cosmetics;
    const owned = new Set(DEFAULT_COSMETICS.owned);
    if (Array.isArray(c.owned)) for (const id of c.owned) if (getCosmetic(id)) owned.add(id);
    p.cosmetics.owned = COSMETICS.filter((i) => owned.has(i.id)).map((i) => i.id);
    p.cosmetics.farmName = cleanFarmName(c.farmName);
    for (const [key, cat] of [['outfit', 'outfit'], ['path', 'path'], ['fence', 'fence']]) {
      const item = getCosmetic(c[key]);
      if (item && item.category === cat && owned.has(item.id)) p.cosmetics[key] = item.id;
    }
    if (isObj(c.decor)) {
      for (const [slotId, itemId] of Object.entries(c.decor)) {
        const slot = DECOR_SLOTS_BY_ID[slotId];
        const item = getCosmetic(itemId);
        if (slot && item && item.category === slot.kind && owned.has(item.id)) p.cosmetics.decor[slotId] = item.id;
      }
    }
  }
  if (Array.isArray(raw.hintsSeen)) p.hintsSeen = [...new Set(raw.hintsSeen.filter((h) => typeof h === 'string' && h.length > 0 && h.length < 64))];
  if (isDifficulty(raw.difficulty)) p.difficulty = raw.difficulty;
  if (isObj(raw.career)) {
    const c = raw.career;
    p.career.started = c.started === true;
    p.career.bestRank = Math.min(6, nonNegInt(c.bestRank));
    p.career.bestYear = nonNegInt(c.bestYear);
    p.career.years = nonNegInt(c.years);
    if (Array.isArray(c.archive)) {
      p.career.archive = c.archive
        .filter((e) => isObj(e))
        .map((e) => ({
          farmName: cleanFarmName(e.farmName),
          years: nonNegInt(e.years),
          rank: Math.max(1, Math.min(6, nonNegInt(e.rank) || 1)),
          patrimony: Number.isFinite(e.patrimony) ? Math.round(e.patrimony) : 0,
          endedBy: e.endedBy === 'bankrupt' ? 'bankrupt' : 'restart',
        }))
        .slice(0, CAREER_ARCHIVE_MAX);
    }
  }
  return p;
}

/**
 * Migration au premier démarrage v3 : normalise, puis débloque les succès déjà remplis par les
 * anciennes parties (niveaux gagnés, ★★★). Renvoie { progress, retroactive: [achievementId], rewards, migrated }.
 * `migrated` est vrai si l'entrée n'était pas déjà au schéma 2.
 */
export function migrateProgress(raw, now = Date.now()) {
  const migrated = !(isObj(raw) && raw.schema === PROGRESS_SCHEMA);
  let progress = normalizeProgress(raw);
  if (!migrated) return { progress, retroactive: [], rewards: { stars: 0, ecus: 0 }, migrated };
  const ids = checkAchievements(progress, null);
  const res = unlockAchievements(progress, ids, now);
  progress = res.progress;
  return { progress, retroactive: ids, rewards: res.rewards, migrated };
}

// ── Étoiles et bonus ──────────────────────────────────────────────────────────────────

/** Étoiles gagnées : meilleures étoiles de chaque niveau + étoiles offertes par les succès. */
export function starsEarned(p) {
  let n = 0;
  for (const [id, v] of Object.entries(p.levels || {})) if (getLevel(Number(id))) n += v.stars || 0;
  for (const id of Object.keys(p.achievements || {})) n += getAchievement(id)?.reward.stars || 0;
  return n;
}

/** Étoiles dépensées en bonus (somme des prix des rangs achetés). */
export function starsSpent(p) {
  let n = 0;
  for (const [id, rank] of Object.entries(p.perks || {})) {
    const perk = getPerk(id);
    if (perk) for (let r = 0; r < Math.min(rank, perk.costs.length); r++) n += perk.costs[r];
  }
  return n;
}

export function starsAvailable(p) {
  return starsEarned(p) - starsSpent(p);
}

function tierRequirement(tier) {
  return PERK_TIERS.find((t) => t.tier === tier)?.starsRequired ?? Infinity;
}

/** Bonus pour la grange : [{ id, name, description, tier, rank, maxRank, nextCost, unlocked, canBuy, reason, starsRequired }]. */
export function perkList(p) {
  const earned = starsEarned(p);
  const available = starsAvailable(p);
  return PERKS.map((perk) => {
    const rank = p.perks?.[perk.id] || 0;
    const maxRank = perkMaxRank(perk);
    const nextCost = rank < maxRank ? perk.costs[rank] : null;
    const starsRequired = tierRequirement(perk.tier);
    const unlocked = earned >= starsRequired;
    let reason = null;
    if (!unlocked) {
      const missing = starsRequired - earned;
      reason = `Il faut ${starsRequired} étoiles gagnées (encore ${missing}).`;
    } else if (nextCost === null) reason = 'Acquis.';
    else if (available < nextCost) {
      const missing = nextCost - available;
      reason = `Il manque ${missing} étoile${missing > 1 ? 's' : ''}.`;
    }
    return {
      id: perk.id,
      name: perk.name,
      description: perk.description,
      tier: perk.tier,
      rank,
      maxRank,
      nextCost,
      unlocked,
      canBuy: unlocked && nextCost !== null && available >= nextCost,
      reason,
      starsRequired,
    };
  });
}

/** Achète le rang suivant d'un bonus. → { ok: true, progress } | { ok: false, reason } */
export function buyPerk(p, perkId) {
  const perk = getPerk(perkId);
  if (!perk) return { ok: false, reason: 'Bonus inconnu.' };
  const info = perkList(p).find((x) => x.id === perkId);
  if (!info.canBuy) return { ok: false, reason: info.reason };
  const progress = clone(p);
  progress.perks[perkId] = info.rank + 1;
  // Ordre stable des clés (ordre de PERKS).
  progress.perks = Object.fromEntries(PERKS.filter((x) => progress.perks[x.id]).map((x) => [x.id, progress.perks[x.id]]));
  return { ok: true, progress };
}

/** Rembourse tous les bonus (toutes les étoiles dépensées reviennent). */
export function refundPerks(p) {
  const progress = clone(p);
  progress.perks = {};
  return progress;
}

export function setPerksEnabled(p, enabled) {
  const progress = clone(p);
  progress.perksEnabled = !!enabled;
  return progress;
}

/** Bonus à passer à createGame({ perks }) : {} si l'interrupteur est éteint. */
export function runPerks(p) {
  return p.perksEnabled === false ? {} : { ...(p.perks || {}) };
}

/** Mode de difficulté des nouvelles parties (à passer à createGame({ difficulty })). */
export function runDifficulty(p) {
  return isDifficulty(p?.difficulty) ? p.difficulty : DEFAULT_DIFFICULTY;
}

/** Change le mode des nouvelles parties. → { ok: true, progress } | { ok: false, reason } */
export function setDifficulty(p, difficulty) {
  if (!isDifficulty(difficulty)) return { ok: false, reason: 'Difficulté inconnue.' };
  const progress = clone(p);
  progress.difficulty = difficulty;
  return { ok: true, progress };
}

/** Le niveau 1 est toujours ouvert ; le niveau n s'ouvre quand le niveau n − 1 est terminé. */
export function isLevelUnlocked(p, levelId) {
  if (levelId <= 1) return true;
  return !!p.levels?.[levelId - 1]?.completed;
}

// ── Succès ─────────────────────────────────────────────────────────────────────────────

function sumValues(o) {
  return Object.values(o || {}).reduce((a, b) => a + b, 0);
}

/**
 * Valeurs utiles aux conditions : cumuls (progression + partie en cours si elle n'est pas encore
 * comptée), et données de la partie.
 * ctx : query.achievementContext() (partie en cours), ou null (progression seule).
 * ctx.counted = true : les chiffres de la partie sont déjà dans p.lifetime (fin de partie).
 */
function facts(p, ctx) {
  const life = p.lifetime || defaultLifetime();
  const year = ctx?.stats?.year || null;
  const add = !!year && !ctx.counted;
  const cropsHarvested = { ...life.cropsHarvested };
  const productsSold = { ...life.productsSold };
  if (add) {
    for (const [id, n] of Object.entries(year.cropsHarvested || {})) cropsHarvested[id] = (cropsHarvested[id] || 0) + n;
    for (const [id, n] of Object.entries(year.productsSold || {})) productsSold[id] = (productsSold[id] || 0) + n;
  }
  return { cropsHarvested, productsSold, harvests: sumValues(cropsHarvested), products: sumValues(productsSold), year, ctx };
}

function levelsWonCount(p, ids) {
  return ids.filter((id) => p.levels?.[id]?.completed).length;
}

function threeStarsCount(p) {
  return LEVELS.filter((l) => (p.levels?.[l.id]?.stars || 0) >= 3).length;
}

const won = (ctx, minLevel) => !!ctx && ctx.status === 'victory' && ctx.levelId >= minLevel;

/**
 * Évalue une condition : { done, progress: null | { value, target } }.
 */
function evaluate(check, p, f) {
  const ctx = f.ctx;
  const year = f.year;
  const counter = (value, target) => ({ done: value >= target, progress: { value: Math.min(value, target), target } });
  switch (check.type) {
    case 'lifetimeHarvests':
      return counter(f.harvests, check.n);
    case 'lifetimeCropSet':
      return counter(check.cropIds.filter((id) => (f.cropsHarvested[id] || 0) > 0).length, check.cropIds.length);
    case 'seasonHarvestIncome': {
      const v = year ? Math.max(year.bestSeasonHarvestIncome || 0, ctx.stats.season?.harvestIncome || 0) : 0;
      return year ? counter(v, check.n) : { done: false, progress: null };
    }
    case 'winNoLoss':
      return { done: won(ctx, check.minLevel) && (year.cropsLost.frost || 0) + (year.cropsLost.rot || 0) === 0, progress: null };
    case 'yearHarvest':
      return year ? counter(year.cropsHarvested[check.cropId] || 0, check.n) : { done: false, progress: null };
    case 'adultTrees':
      return ctx && Number.isFinite(ctx.adultTrees) ? counter(ctx.adultTrees, check.n) : { done: false, progress: null };
    case 'owned':
      return { done: !!ctx?.investments && (ctx.investments[check.id] || 0) >= check.n, progress: null };
    case 'ownedTogether':
      return { done: !!ctx?.investments && check.ids.every((id) => (ctx.investments[id] || 0) > 0), progress: null };
    case 'ownAllInLevel': {
      const ids = ctx?.availableInvestments;
      return { done: !!ids && ids.length > 0 && ids.every((id) => (ctx.investments[id] || 0) > 0), progress: null };
    }
    case 'zeroCharges':
      return { done: !!ctx && ctx.status === 'playing' && ctx.dailyCharges === 0, progress: null };
    case 'lifetimeProducts':
      return counter(f.products, check.n);
    case 'anyProductSold': {
      const n = check.productIds ? check.productIds.reduce((s, id) => s + (f.productsSold[id] || 0), 0) : f.products;
      return { done: n > 0, progress: null };
    }
    case 'yearProducts': {
      if (!year) return { done: false, progress: null };
      const n = check.productIds.reduce((s, id) => s + (year.productsSold?.[id] || 0), 0);
      return counter(n, check.n);
    }
    case 'levelsWon':
      return counter(levelsWonCount(p, check.ids), check.ids.length);
    case 'threeStars':
      return counter(threeStarsCount(p), check.n);
    case 'threeStarsAll':
      return counter(threeStarsCount(p), LEVELS.length);
    case 'yearEndMoney':
      return { done: won(ctx, 1) && ctx.money >= check.n, progress: null };
    case 'closeCall': {
      const m = year?.minMoneyAfterRent;
      return { done: m !== null && m !== undefined && m < check.n, progress: null };
    }
    case 'purist':
      return { done: won(ctx, check.minLevel) && ctx.stars >= 3 && !ctx.perksActive, progress: null };
    case 'winNoInvestment':
      return { done: won(ctx, check.minLevel) && (year.investmentsSpent || 0) === 0, progress: null };
    case 'decorationsPlaced': {
      const n = Object.keys(p.cosmetics?.decor || {}).length;
      return counter(n, check.n);
    }
    // ── Carrière (ctx.career = query.career.achievementContext()) ──
    case 'careerStarted':
      return { done: !!p.career?.started || !!ctx?.career, progress: null };
    case 'careerLots':
      return ctx?.career ? counter(ctx.career.lots || 0, check.n) : { done: false, progress: null };
    case 'careerRank':
      return counter(Math.max(p.career?.bestRank || 0, ctx?.career?.rank || 0), check.n);
    case 'careerStaff':
      return ctx?.career ? counter(ctx.career.staffCount || 0, check.n) : { done: false, progress: null };
    case 'careerStaffLevel':
      return ctx?.career ? counter(ctx.career.maxStaffLevel || 0, check.n) : { done: false, progress: null };
    case 'careerMachine': {
      const ids = ctx?.career?.machines || [];
      return { done: check.id ? ids.includes(check.id) : ids.length > 0, progress: null };
    }
    case 'careerCropInSeason':
      return { done: !!ctx?.career?.cropsInSeason?.includes(`${check.cropId}@${check.seasonId}`), progress: null };
    case 'careerSpecies':
      return ctx?.career ? counter(ctx.career.species || 0, check.n) : { done: false, progress: null };
    case 'careerTruffles':
      return ctx?.career ? counter(ctx.career.truffles || 0, check.n) : { done: false, progress: null };
    case 'careerHearts':
      return ctx?.career ? counter(ctx.career.hearts || 0, check.n) : { done: false, progress: null };
    case 'careerContestAll':
      return { done: !!ctx?.career?.contestAll, progress: null };
    case 'careerYear':
      return counter(Math.max(p.career?.bestYear || 0, ctx?.career?.year || 0), check.n);
    case 'careerStock':
      return ctx?.career ? counter(ctx.career.stock || 0, check.n) : { done: false, progress: null };
    case 'careerYearNet': {
      const v = Math.max(ctx?.career?.yearNet ?? 0, ctx?.career?.bestYearNet ?? 0);
      return ctx?.career ? counter(Math.max(0, v), check.n) : { done: false, progress: null };
    }
    default:
      return { done: false, progress: null };
  }
}

/**
 * Nouveaux succès remplis (pas encore débloqués).
 * @param ctx query.achievementContext() de la partie en cours, ou null (progression seule : niveaux,
 *   étoiles, cumuls, décorations). Pour une fin de partie, utiliser recordRunEnd.
 */
export function checkAchievements(p, ctx) {
  const f = facts(p, ctx);
  return ACHIEVEMENTS.filter((a) => !p.achievements?.[a.id] && evaluate(a.check, p, f).done).map((a) => a.id);
}

/** Débloque des succès : → { progress, rewards: { stars, ecus } } (écus ajoutés, étoiles comptées dans starsEarned). */
export function unlockAchievements(p, ids, now = Date.now()) {
  const progress = clone(p);
  const rewards = { stars: 0, ecus: 0 };
  for (const id of ids) {
    const a = getAchievement(id);
    if (!a || progress.achievements[id]) continue;
    progress.achievements[id] = { at: now };
    rewards.stars += a.reward.stars;
    rewards.ecus += a.reward.ecus;
  }
  progress.ecus = (progress.ecus || 0) + rewards.ecus;
  return { progress, rewards };
}

/** Liste pour l'onglet « Succès » (succès des niveaux) : [{ id, name, description, reward, done, at, progress }]. */
export function achievementList(p, ctx) {
  return listOf(LEVEL_ACHIEVEMENTS, p, ctx, false);
}

/**
 * Liste pour la section « Carrière » de la grange : succès de carrière (écus seulement), même forme que
 * achievementList + category: 'career'. ctx : game.query.achievementContext() d'une carrière, ou null.
 */
export function careerAchievementList(p, ctx) {
  return listOf(CAREER_ACHIEVEMENTS, p, ctx, true);
}

function listOf(list, p, ctx, withCategory) {
  const f = facts(p, ctx);
  return list.map((a) => {
    const got = p.achievements?.[a.id];
    const ev = evaluate(a.check, p, f);
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      ...(withCategory ? { category: a.category } : {}),
      reward: { ...a.reward },
      done: !!got,
      at: got ? got.at : null,
      progress: got ? null : ev.progress,
    };
  });
}

// ── Fin de partie ──────────────────────────────────────────────────────────────────────

/** Écus d'une partie : victoire 10 + 5 × étoiles + 1 par 100 pièces (20 au plus) ; faillite 3 ; abandon 0. */
export function ecusForRun({ outcome, stars = 0, money = 0 }) {
  if (outcome === 'victory') return 10 + 5 * stars + Math.min(20, Math.max(0, Math.floor(money / 100)));
  if (outcome === 'bankrupt') return 3;
  return 0;
}

/**
 * Enregistre la fin d'une partie (victoire, faillite ou abandon par « Quitter » / « Recommencer ») :
 * niveaux (étoiles, record, terminé, joué), cumuls de la partie, écus, puis succès.
 * @param run { levelId, outcome: 'victory'|'bankrupt'|'abandon', stars, money, summary, perksActive,
 *              adultTrees?, investments?, availableInvestments?, dailyCharges? }
 *   summary : game.query.summary() ou le résumé de l'événement victory / bankrupt (null : cumuls inchangés)
 * → { progress, rewards: { ecus, newStars, newBest, firstTime, achievementStars, achievementEcus }, achievements: [id] }
 */
export function recordRunEnd(p, run, now = Date.now()) {
  const progress = clone(p);
  const { levelId, outcome, summary } = run;
  const stars = outcome === 'victory' ? Math.max(1, Math.min(3, run.stars || 1)) : 0;
  const money = Number.isFinite(run.money) ? run.money : summary?.money ?? 0;
  const prev = progress.levels[levelId] || { stars: 0, bestMoney: null, completed: false, played: false };
  const rewards = { ecus: 0, newStars: false, newBest: false, firstTime: false, achievementStars: 0, achievementEcus: 0 };
  if (getLevel(levelId)) {
    const entry = { ...prev, played: true };
    if (outcome === 'victory') {
      rewards.newBest = prev.bestMoney === null || money > prev.bestMoney;
      rewards.newStars = stars > (prev.stars || 0);
      rewards.firstTime = !prev.completed;
      entry.stars = Math.max(prev.stars || 0, stars);
      entry.bestMoney = rewards.newBest ? money : prev.bestMoney;
      entry.completed = true;
    }
    progress.levels[levelId] = entry;
  }
  // Cumuls
  if (summary) {
    const l = progress.lifetime;
    for (const [id, n] of Object.entries(summary.cropsHarvested || {})) {
      if (!getCrop(id) || !(n > 0)) continue;
      l.cropsHarvested[id] = (l.cropsHarvested[id] || 0) + n;
      l.harvests += n;
    }
    for (const [id, n] of Object.entries(summary.productsSold || {})) {
      if (!getProduct(id) || !(n > 0)) continue;
      l.productsSold[id] = (l.productsSold[id] || 0) + n;
    }
    l.rentsPaid += nonNegInt(summary.rentsPaid);
  }
  if (outcome === 'victory') progress.lifetime.yearsWon += 1;
  if (outcome === 'bankrupt') progress.lifetime.yearsLost += 1;
  rewards.ecus = ecusForRun({ outcome, stars, money });
  progress.ecus += rewards.ecus;
  // Succès (la partie est déjà dans les cumuls : counted).
  const ctx = {
    counted: true,
    levelId,
    status: outcome === 'victory' ? 'victory' : outcome === 'bankrupt' ? 'bankrupt' : 'abandon',
    money,
    stars,
    perksActive: !!run.perksActive,
    stats: summary ? { year: summary, season: summary.season || null } : null,
    investments: run.investments || summary?.investments || null,
    availableInvestments: run.availableInvestments || null,
    adultTrees: run.adultTrees,
    dailyCharges: run.dailyCharges,
  };
  const ids = checkAchievements(progress, ctx);
  const unlocked = unlockAchievements(progress, ids, now);
  rewards.achievementStars = unlocked.rewards.stars;
  rewards.achievementEcus = unlocked.rewards.ecus;
  return { progress: unlocked.progress, rewards, achievements: ids };
}

// ── Carrière ───────────────────────────────────────────────────────────────────────────

/** Écus du bilan annuel : 10 + 3 × rang + min(20, ⌊bénéfice / 1 000⌋) (+10 avec le Manoir). */
export function ecusForCareerYear({ rank = 1, net = 0, houseLevel = 1 } = {}) {
  const e = CAREER_ECUS;
  const profit = Math.min(e.yearProfitMax, Math.max(0, Math.floor((Number(net) || 0) / e.yearProfitStep)));
  return e.yearBase + e.yearPerRank * rank + profit + (houseLevel >= 5 ? e.manorBonus : 0);
}

/**
 * Une carrière commence (createCareer) : progress.career.started, succès « Première pierre ».
 * → { progress, rewards: { ecus }, achievements: [id] }
 */
export function recordCareerStart(p, now = Date.now()) {
  const progress = clone(p);
  if (!progress.career) progress.career = defaultCareerProgress();
  progress.career.started = true;
  progress.career.bestYear = Math.max(progress.career.bestYear || 0, 1);
  progress.career.bestRank = Math.max(progress.career.bestRank || 0, 1);
  const ids = checkAchievements(progress, null);
  const res = unlockAchievements(progress, ids, now);
  return { progress: res.progress, rewards: { ecus: res.rewards.ecus }, achievements: ids };
}

/**
 * Bilan d'une année de carrière (événement yearEnd) : écus du bilan, cumuls (récoltes, produits de l'année
 * ajoutés à lifetime : « Cent paniers », « Artisan du terroir »…), meilleurs rang et année, succès.
 * @param run { year, rank, net, report, career? } — report : celui de yearEnd ; career : query.career.achievementContext()
 * → { progress, rewards: { ecus, achievementEcus }, achievements: [id] }
 * Ne passer ensuite à checkAchievements que des contextes de l'année SUIVANTE (sinon l'année compterait deux fois).
 */
export function recordCareerYear(p, { year, rank, net, report = null, career = null } = {}, now = Date.now()) {
  const progress = clone(p);
  if (!progress.career) progress.career = defaultCareerProgress();
  const pc = progress.career;
  pc.started = true;
  pc.years += 1;
  pc.bestRank = Math.max(pc.bestRank || 0, rank || 0);
  pc.bestYear = Math.max(pc.bestYear || 0, (year || 0) + 1);
  if (report) {
    const l = progress.lifetime;
    for (const [id, n] of Object.entries(report.cropsHarvested || {})) {
      if (!getCrop(id) || !(n > 0)) continue;
      l.cropsHarvested[id] = (l.cropsHarvested[id] || 0) + n;
      l.harvests += n;
    }
    for (const [id, n] of Object.entries(report.productsSold || {})) {
      if (!getProduct(id) || !(n > 0)) continue;
      l.productsSold[id] = (l.productsSold[id] || 0) + n;
    }
  }
  const ecus = ecusForCareerYear({ rank, net, houseLevel: report?.houseLevel ?? career?.houseLevel ?? 1 });
  progress.ecus += ecus;
  const ctx = {
    counted: true,
    levelId: 'career',
    status: 'playing',
    stats: report ? { year: { cropsHarvested: report.cropsHarvested || {}, productsSold: report.productsSold || {}, cropsLost: {} }, season: null } : null,
    career: { ...(career || {}), rank: Math.max(rank || 0, career?.rank || 0), year: Math.max((year || 0) + 1, career?.year || 0), yearNet: net, bestYearNet: Math.max(net || 0, career?.bestYearNet || 0) },
  };
  const ids = checkAchievements(progress, ctx);
  const res = unlockAchievements(progress, ids, now);
  return { progress: res.progress, rewards: { ecus, achievementEcus: res.rewards.ecus }, achievements: ids };
}

/**
 * Passage de rang (événement rankUp) : + 20 × rang écus, meilleur rang, succès (« Belle ferme », « Le domaine »).
 * → { progress, rewards: { ecus, achievementEcus }, achievements: [id] }
 */
export function recordCareerRank(p, rank, now = Date.now()) {
  const progress = clone(p);
  if (!progress.career) progress.career = defaultCareerProgress();
  progress.career.started = true;
  progress.career.bestRank = Math.max(progress.career.bestRank || 0, rank);
  const ecus = CAREER_ECUS.rankUpPerRank * rank;
  progress.ecus += ecus;
  const ids = checkAchievements(progress, null);
  const res = unlockAchievements(progress, ids, now);
  return { progress: res.progress, rewards: { ecus, achievementEcus: res.rewards.ecus }, achievements: ids };
}

/**
 * Écus gagnés en cours de carrière hors bilan et rang (quête de Joseph réussie : questDone.ecus). Versés tout de
 * suite : le bilan de l'année (report.questEcus) ne fait que les rappeler, recordCareerYear ne les ajoute pas.
 * → { progress, rewards: { ecus }, achievements: [] }
 */
export function recordCareerEcus(p, amount) {
  const progress = clone(p);
  const ecus = Math.max(0, Math.min(1000, Math.floor(Number(amount) || 0)));
  progress.ecus = (progress.ecus || 0) + ecus;
  return { progress, rewards: { ecus }, achievements: [] };
}

/**
 * Archive une carrière terminée (faillite en Classique, ou « Recommencer une ferme ») : 5 dernières gardées,
 * la plus récente d'abord. entry = { farmName, years, rank, patrimony, endedBy: 'bankrupt' | 'restart' }.
 */
export function archiveCareer(p, entry) {
  const progress = clone(p);
  if (!progress.career) progress.career = defaultCareerProgress();
  const e = {
    farmName: cleanFarmName(entry?.farmName),
    years: nonNegInt(entry?.years),
    rank: Math.max(1, Math.min(6, nonNegInt(entry?.rank) || 1)),
    patrimony: Number.isFinite(entry?.patrimony) ? Math.round(entry.patrimony) : 0,
    endedBy: entry?.endedBy === 'bankrupt' ? 'bankrupt' : 'restart',
  };
  progress.career.archive = [e, ...(progress.career.archive || [])].slice(0, CAREER_ARCHIVE_MAX);
  progress.career.bestRank = Math.max(progress.career.bestRank || 0, e.rank);
  return progress;
}

// ── Cosmétiques ────────────────────────────────────────────────────────────────────────

/** Débloque un objet contre des écus. → { ok, progress } | { ok: false, reason } */
export function buyCosmetic(p, itemId) {
  const item = getCosmetic(itemId);
  if (!item) return { ok: false, reason: 'Objet inconnu.' };
  if (p.cosmetics.owned.includes(itemId)) return { ok: false, reason: 'Déjà débloqué.' };
  if (item.found) return { ok: false, reason: 'Cet objet se trouve à la ferme.' };
  if ((p.ecus || 0) < item.price) {
    const missing = item.price - (p.ecus || 0);
    return { ok: false, reason: `Il manque ${missing} écu${missing > 1 ? 's' : ''}.` };
  }
  const progress = clone(p);
  progress.ecus -= item.price;
  const owned = new Set([...progress.cosmetics.owned, itemId]);
  progress.cosmetics.owned = COSMETICS.filter((i) => owned.has(i.id)).map((i) => i.id);
  return { ok: true, progress };
}

/**
 * (lot 2) Débloque gratuitement un objet trouvé à la ferme (surprise `owl`, trouvaille `statue` : cosmeticId).
 * → { ok, progress, already } (already : déjà possédé — l'interface verse alors ecusIfOwned écus).
 */
export function unlockCosmetic(p, itemId) {
  const item = getCosmetic(itemId);
  if (!item) return { ok: false, reason: 'Objet inconnu.' };
  if (p.cosmetics.owned.includes(itemId)) return { ok: true, progress: clone(p), already: true };
  const progress = clone(p);
  const owned = new Set([...progress.cosmetics.owned, itemId]);
  progress.cosmetics.owned = COSMETICS.filter((i) => owned.has(i.id)).map((i) => i.id);
  return { ok: true, progress, already: false };
}

/** Pose (ou retire, itemId = null) une décoration sur un emplacement. */
export function placeDecor(p, slotId, itemId) {
  const slot = DECOR_SLOTS_BY_ID[slotId];
  if (!slot) return { ok: false, reason: 'Emplacement inconnu.' };
  const progress = clone(p);
  if (itemId === null || itemId === undefined) {
    delete progress.cosmetics.decor[slotId];
    return { ok: true, progress };
  }
  const item = getCosmetic(itemId);
  if (!item) return { ok: false, reason: 'Objet inconnu.' };
  if (!p.cosmetics.owned.includes(itemId)) return { ok: false, reason: 'Objet pas encore débloqué.' };
  if (item.category !== slot.kind) {
    return { ok: false, reason: slot.kind === 'large' ? 'Cet emplacement attend un grand décor.' : 'Cet emplacement attend un petit décor.' };
  }
  progress.cosmetics.decor[slotId] = itemId;
  return { ok: true, progress };
}

function setStyle(p, key, category, itemId) {
  const item = getCosmetic(itemId);
  if (!item || item.category !== category) return { ok: false, reason: 'Objet inconnu.' };
  if (!p.cosmetics.owned.includes(itemId)) return { ok: false, reason: 'Objet pas encore débloqué.' };
  const progress = clone(p);
  progress.cosmetics[key] = itemId;
  return { ok: true, progress };
}

export function setPath(p, itemId) {
  return setStyle(p, 'path', 'path', itemId);
}

export function setFence(p, itemId) {
  return setStyle(p, 'fence', 'fence', itemId);
}

export function setOutfit(p, itemId) {
  return setStyle(p, 'outfit', 'outfit', itemId);
}

/** Nom de ferme propre : espaces superflus retirés, 1 à 18 caractères, sinon le nom par défaut. */
export function cleanFarmName(text) {
  if (typeof text !== 'string') return DEFAULT_FARM_NAME;
  const t = text.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length < 1 || [...t].length > FARM_NAME_MAX) return DEFAULT_FARM_NAME;
  return t;
}

export function setFarmName(p, text) {
  const progress = clone(p);
  progress.cosmetics.farmName = cleanFarmName(text);
  return progress;
}

/** Note un conseil « première fois » comme vu. */
export function markHint(p, hintId) {
  if (p.hintsSeen?.includes(hintId)) return clone(p);
  const progress = clone(p);
  progress.hintsSeen = [...(progress.hintsSeen || []), String(hintId)];
  return progress;
}
