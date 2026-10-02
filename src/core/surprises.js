// Lot 2 « Toucher & surprises » — logique partagée par les niveaux (src/core/game.js) et la carrière
// (src/core/career/runtime.js). Pur : aucun DOM. Règles : docs/GAME_DESIGN.md, « Lot 2 — surprises » ;
// contrat : docs/ARCHITECTURE.md, « Lot 2 — contrats » ; nombres : src/data/surprises.js.
//
// Tout ne s'active que si state.surprises existe (Détente et carrière par défaut ; jamais en Classique, pour la
// parité des niveaux 1 à 8). Tirages : trois flux NOUVEAUX (state.rng.quality pour les récoltes, state.rng.surprise
// pour les surprises de l'aube, géants, cueillettes et vœux, state.rng.sky pour les météos spéciales) : les flux
// existants (météo, marché, maladie, événements de carrière…) tirent exactement les mêmes nombres qu'avant.

import { SEASONS } from '../data/balance.js';
import { getCrop, isTreeCrop } from '../data/crops.js';
import {
  CHEST, ECUS_IF_OWNED, FAIRY, FOUND_COSMETICS, GIANT, HEDGEHOG, QUALITY, RING, SKY, SPECIAL_WEATHERS, SPECIAL_WEATHERS_BY_ID,
  SURPRISES, SURPRISES_BY_ID, SURPRISE_RULES, WISH, WISHES, WISHES_BY_ID,
} from '../data/surprises.js';
import { hashSeed, stream } from './rng.js';
import { inGreenhouse, isMature, needsWaterToday } from './farm.js';

export const SURPRISES_VERSION = 1;
export const SPECIAL_IDS = SPECIAL_WEATHERS.map((w) => w.id);
export const SURPRISE_KINDS = SURPRISES.map((s) => s.id);
const STAT_KEYS = ['fine', 'gold', 'giants', 'surprises', 'weathers', 'finds'];

// ── État ────────────────────────────────────────────────────────────────────────────────────

/** true si les surprises sont actives dans cette partie. */
export function surprisesOn(state) {
  return !!state && !!state.surprises;
}

export function emptySurpriseStats() {
  return { fine: {}, gold: {}, giants: {}, surprises: {}, weathers: {}, finds: {}, forage: 0, wishes: 0 };
}

/** Nouvel état des surprises (state.surprises). */
export function newSurprisesState() {
  return {
    v: SURPRISES_VERSION,
    sky: { today: null, tomorrow: null },
    fox: null,
    hedgehog: null,
    luck: null,
    wish: null,
    wells: [],
    found: { owl: false, statue: false },
    lastDay: 0,
    stats: emptySurpriseStats(),
  };
}

/** Active les surprises : état et flux aléatoires (graines dérivées de state.seed). */
export function enableSurprises(state) {
  if (!state.surprises) state.surprises = newSurprisesState();
  for (const k of ['quality', 'surprise', 'sky']) if (!Number.isInteger(state.rng[k])) state.rng[k] = hashSeed(state.seed, k);
  return state.surprises;
}

/** Complète un état des surprises chargé (champs ajoutés plus tard). */
export function completeSurprises(state) {
  const s = state.surprises;
  if (!s || typeof s !== 'object') return;
  const d = newSurprisesState();
  for (const [k, v] of Object.entries(d)) if (s[k] === undefined) s[k] = v;
  if (!s.stats || typeof s.stats !== 'object') s.stats = emptySurpriseStats();
  for (const [k, v] of Object.entries(emptySurpriseStats())) if (s.stats[k] === undefined) s.stats[k] = v;
  if (!s.found || typeof s.found !== 'object') s.found = { owl: false, statue: false };
  for (const k of ['quality', 'surprise', 'sky']) if (!Number.isInteger(state.rng?.[k])) state.rng[k] = hashSeed(state.seed, k);
}

/** Vérifie state.surprises (sauvegarde). → null | 'problème'. */
export function checkSurprises(state) {
  const s = state.surprises;
  if (s === undefined || s === null) return null;
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const int = (v) => Number.isInteger(v) && v >= 0;
  const until = (v) => v === null || (obj(v) && int(v.until));
  if (!obj(s) || s.v !== SURPRISES_VERSION) return 'surprises';
  if (!obj(s.sky) || ![s.sky.today, s.sky.tomorrow].every((x) => x === null || SPECIAL_WEATHERS_BY_ID[x])) return 'météo spéciale';
  if (!until(s.fox) || !until(s.hedgehog) || !until(s.luck)) return 'surprises en cours';
  if (s.wish !== null && !(obj(s.wish) && int(s.wish.day) && Array.isArray(s.wish.options) && s.wish.options.length > 0 && s.wish.options.every((id) => WISHES_BY_ID[id]))) return 'vœu';
  if (!Array.isArray(s.wells) || !s.wells.every((id) => typeof id === 'string')) return 'puits';
  if (!obj(s.found) || typeof s.found.owl !== 'boolean' || typeof s.found.statue !== 'boolean') return 'trouvailles';
  if (!int(s.lastDay)) return 'surprises';
  if (!obj(s.stats) || !STAT_KEYS.every((k) => obj(s.stats[k])) || !int(s.stats.forage) || !int(s.stats.wishes)) return 'statistiques des surprises';
  if (!['quality', 'surprise', 'sky'].every((k) => Number.isInteger(state.rng?.[k]))) return 'aléatoire des surprises';
  for (const [i, p] of state.plots.entries()) {
    if (p.care !== undefined && !(obj(p.care) && int(p.care.sown) && int(p.care.dry) && typeof p.care.rotated === 'boolean' && typeof p.care.wetEnd === 'boolean')) return 'soins de la parcelle';
    if (p.giant !== undefined) {
      if (!int(p.giant) || p.giant >= state.plots.length || !p.cropId || state.plots[p.giant].giant !== p.giant) return 'légume géant';
    }
    if (p.forage !== undefined && !(obj(p.forage) && ['mushroom', 'ring'].includes(p.forage.kind) && int(p.forage.value) && int(p.forage.until) && !p.cropId)) return `champignons (parcelle ${i})`;
  }
  return null;
}

// ── Dates ───────────────────────────────────────────────────────────────────────────────────

/** Jour absolu : jour de l'année (niveaux), jour depuis le début de la carrière (carrière). */
export function absDay(state) {
  if (state.mode === 'career') return (state.time.year - 1) * 4 * state.career.seasonLength + state.time.day;
  return state.time.day;
}

/** Dernier jour absolu de la saison en cours. */
function seasonEndDay(state, level) {
  if (state.mode === 'career') return (state.time.year - 1) * 4 * state.career.seasonLength + (state.time.seasonIndex + 1) * state.career.seasonLength;
  let n = 0;
  for (let s = 0; s <= state.time.seasonIndex; s++) n += level.seasonLengths[s];
  return n;
}

const active = (x, state) => !!x && x.until >= absDay(state);
export const foxActive = (state) => active(state.surprises?.fox, state);
export const hedgehogActive = (state) => active(state.surprises?.hedgehog, state);
export const luckActive = (state) => active(state.surprises?.luck, state);

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

// ── Parcelles : géométrie (grille du cœur) ─────────────────────────────────────────────────

/**
 * Case d'une parcelle dans la grille du cœur : niveaux → (index % gridCols, ligne) ; carrière → case du terrain
 * (4 colonnes, verger 3). group : 'field' (niveaux) ou l'identifiant du terrain. null : parcelle hors jeu.
 */
export function plotCell(state, level, i) {
  const p = state.plots[i];
  if (!p || !p.unlocked) return null;
  if (state.mode === 'career') {
    if (!p.env) return null;
    const cols = p.env === 'orchard' ? 3 : 4;
    return { group: p.lot, col: p.cell % cols, row: Math.floor(p.cell / cols) };
  }
  return { group: 'field', col: i % level.gridCols, row: Math.floor(i / level.gridCols) };
}

function cellIndex(state, level) {
  const m = new Map();
  state.plots.forEach((_, i) => {
    const c = plotCell(state, level, i);
    if (c) m.set(`${c.group}:${c.col},${c.row}`, i);
  });
  return m;
}

// ── Soins (qualité, géants) ─────────────────────────────────────────────────────────────────

/** À appeler juste après un semis (pas un arbre) : jour, rotation, compteur des jours sans eau. */
export function noteSown(state, plotIndex) {
  if (!surprisesOn(state)) return;
  const p = state.plots[plotIndex];
  if (!p || !p.cropId || isTreeCrop(getCrop(p.cropId))) return;
  p.care = { sown: absDay(state), dry: 0, rotated: p.lastHarvested !== p.cropId, wetEnd: false };
}

/**
 * Avant la pousse de l'aube : pousse, arrosage et besoin d'eau de la veille de chaque culture (pas les arbres).
 * @param {string} prevWeather météo du jour écoulé
 */
export function growthSnapshot(state, level, prevWeather) {
  if (!surprisesOn(state)) return null;
  return state.plots.map((p) => {
    if (!p.cropId) return null;
    const crop = getCrop(p.cropId);
    if (isTreeCrop(crop)) return null;
    const mature = isMature(p);
    return { growth: p.growth, watered: p.watered, mature, needed: !mature && needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : prevWeather, level) };
  });
}

/** Facteur de pousse de la météo spéciale du jour écoulé (pluie chaude, arc-en-ciel des niveaux). */
export function skyGrowthFactor(special) {
  if (special === 'warmrain') return SKY.warmrainGrowth;
  if (special === 'rainbow') return SKY.rainbowGrowth;
  return 1;
}

/**
 * Après la pousse : pousse en plus (pluie chaude, arc-en-ciel ; pas dans la serre), jours sans eau, arrosée le
 * jour où elle a mûri.
 */
export function applyGrowthCare(state, snap, factor = 1) {
  if (!snap) return;
  snap.forEach((s, i) => {
    const p = state.plots[i];
    if (!s || !p.cropId) return;
    const crop = getCrop(p.cropId);
    if (factor !== 1 && !s.mature && !inGreenhouse(p)) {
      const d = p.growth - s.growth;
      if (d > 0) p.growth = Math.min(crop.growDays, p.growth + d * (factor - 1));
    }
    if (p.care && !s.mature) {
      if (s.needed && !s.watered) p.care.dry += 1;
      if (isMature(p)) p.care.wetEnd = s.watered || !s.needed;
    }
  });
}

/** Mûrit une culture d'un coup (fée, vœu) : compte comme arrosée le dernier jour. */
function ripen(p) {
  const crop = getCrop(p.cropId);
  p.growth = crop.growDays;
  if (p.care) p.care.wetEnd = true;
}

// ── Qualité ─────────────────────────────────────────────────────────────────────────────────

/** Soins d'une parcelle (fiche) : { wateredEveryDay, bees, rotation }. */
export function careOf(state, plot) {
  const crop = plot.cropId ? getCrop(plot.cropId) : null;
  const tree = !!crop && isTreeCrop(crop);
  return {
    wateredEveryDay: tree || (!!plot.care && plot.care.dry === 0),
    bees: (state.investments?.beehive || 0) > 0,
    rotation: !tree && !!plot.care && plot.care.rotated,
  };
}

/**
 * Chances de qualité de la récolte d'une parcelle : { fine, gold } (0..1). byHand false (salarié, machine) :
 * jamais dorée.
 */
export function qualityChances(state, plot, byHand = true) {
  const care = careOf(state, plot);
  let fine = QUALITY.base.fine;
  let gold = QUALITY.base.gold;
  const add = (b) => {
    fine += b.fine;
    gold += b.gold;
  };
  if (care.wateredEveryDay) add(QUALITY.watered);
  if (care.bees) add(QUALITY.bees);
  if (care.rotation) add(QUALITY.rotation);
  if ((state.perks?.greenThumb || 0) > 0) add(QUALITY.greenThumb);
  if (luckActive(state)) {
    fine *= QUALITY.luckFactor;
    gold *= QUALITY.luckFactor;
  }
  if (!byHand) gold = 0;
  return { fine: round4(fine), gold: round4(gold) };
}

const round4 = (x) => Math.round(x * 10000) / 10000;

/** Tire la qualité d'une récolte (un tirage du flux « quality », toujours exactement un). */
export function rollQuality(state, plot, byHand = true) {
  const { fine, gold } = qualityChances(state, plot, byHand);
  const u = stream(state.rng, 'quality').float();
  const quality = u < gold ? 'gold' : u < gold + fine ? 'fine' : 'normal';
  return { quality, multiplier: QUALITY.multipliers[quality] };
}

/** Compte une belle / dorée (album). */
export function recordQuality(state, cropId, quality) {
  if (quality === 'fine' || quality === 'gold') bump(state.surprises.stats[quality], cropId);
}

// ── Légumes géants ──────────────────────────────────────────────────────────────────────────

/** Géant dont fait partie la parcelle : { anchor, plots: [4], cropId } ou null. */
export function giantAt(state, i) {
  const p = state.plots[i];
  if (!p || p.giant === undefined) return null;
  const anchor = p.giant;
  const plots = [];
  state.plots.forEach((q, k) => {
    if (q.giant === anchor) plots.push(k);
  });
  return { anchor, plots, cropId: state.plots[anchor].cropId };
}

/** Tous les géants : [{ anchor, plots, cropId }]. */
export function allGiants(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (p.giant === i) out.push(giantAt(state, i));
  });
  return out;
}

/** Retire les géants dont une parcelle a changé (gel, maladie, réaménagement…). */
export function validateGiants(state) {
  for (const g of allGiants(state)) {
    const ok = g.plots.length === 4 && g.plots.every((k) => {
      const q = state.plots[k];
      return q.cropId === g.cropId && q.unlocked && q.env !== null && isMature(q);
    });
    if (!ok) for (const k of g.plots) delete state.plots[k].giant;
  }
  // Marques orphelines (ancre disparue).
  state.plots.forEach((p) => {
    if (p.giant !== undefined && state.plots[p.giant]?.giant !== p.giant) delete p.giant;
  });
}

/** Carrés 2 × 2 qui peuvent devenir géants : [[ancre, droite, bas, diagonale]]. */
export function giantCandidates(state, level) {
  const idx = cellIndex(state, level);
  const ok = (i) => {
    const p = state.plots[i];
    if (i === undefined || !p || !p.cropId || p.giant !== undefined || !p.care || !p.care.wetEnd) return false;
    const crop = getCrop(p.cropId);
    return !isTreeCrop(crop) && isMature(p);
  };
  const out = [];
  state.plots.forEach((_, i) => {
    if (!ok(i)) return;
    const c = plotCell(state, level, i);
    const at = (dc, dr) => idx.get(`${c.group}:${c.col + dc},${c.row + dr}`);
    const sq = [i, at(1, 0), at(0, 1), at(1, 1)];
    if (!sq.every(ok)) return;
    const crop = state.plots[i].cropId;
    if (!sq.every((k) => state.plots[k].cropId === crop)) return;
    const days = sq.map((k) => state.plots[k].care.sown);
    if (Math.max(...days) - Math.min(...days) > GIANT.sownSpread) return;
    out.push(sq);
  });
  return out;
}

/** Fusionne un carré en géant (ancre = première parcelle). */
export function mergeGiant(state, square) {
  for (const k of square) state.plots[k].giant = square[0];
  return giantAt(state, square[0]);
}

/**
 * Aube : chance qu'un carré possible devienne géant (un au plus par aube ; aucun tirage s'il n'y a aucun carré).
 * → { anchor, plots, cropId } ou null.
 */
export function tryGiant(state, level) {
  if (!surprisesOn(state)) return null;
  const cands = giantCandidates(state, level);
  if (!cands.length) return null;
  const rng = stream(state.rng, 'surprise');
  if (!rng.chance(GIANT.chance)) return null;
  const sq = cands[rng.int(0, cands.length - 1)];
  const g = mergeGiant(state, sq);
  bump(state.surprises.stats.giants, g.cropId);
  return g;
}

// ── Cueillette (champignons du brouillard, cercle de fées) ───────────────────────────────

/** Parcelles vides où des champignons peuvent pousser (carrière : champs). */
export function emptyPlots(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (!p.unlocked || p.cropId || p.forage) return;
    if (state.mode === 'career' && p.env !== 'field') return;
    out.push(i);
  });
  return out;
}

/** Prix de la culture la plus chère de la saison dans cette partie (× prix du mode). */
export function bestSeasonPrice(state, level, crops) {
  const sid = SEASONS[state.time.seasonIndex];
  let best = 0;
  for (const c of crops) if (!isTreeCrop(c) && c.seasons.includes(sid)) best = Math.max(best, c.sellPrice);
  if (!best) for (const c of crops) if (!isTreeCrop(c)) best = Math.max(best, c.sellPrice);
  return best * (level.cropPriceFactor ?? 1);
}

/** Retire les champignons passés, ou posés sur une parcelle qui n'est plus vide ni ouverte. */
export function expireForage(state) {
  const today = absDay(state);
  for (const p of state.plots) {
    if (!p.forage) continue;
    if (p.forage.until < today || p.cropId || !p.unlocked || p.env === null) delete p.forage;
  }
}

/** Cueille les champignons d'une parcelle (enlève la marque). → { kind, value } ou null. */
export function takeForage(state, i) {
  const p = state.plots[i];
  if (!p || !p.forage || p.cropId) return null;
  const f = p.forage;
  delete p.forage;
  state.surprises.stats.forage += 1;
  return { kind: f.kind, value: f.value };
}

function shuffleTake(rng, list, n) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** Brouillard : champignons sur 2 à 4 parcelles vides. → { kind, plots, value } ou null. */
export function fogForage(state, level, crops) {
  const empty = emptyPlots(state);
  if (!empty.length) return null;
  const rng = stream(state.rng, 'surprise');
  const n = Math.min(empty.length, rng.int(SKY.fogPlots[0], SKY.fogPlots[1]));
  const plots = shuffleTake(rng, empty, n).sort((a, b) => a - b);
  const value = Math.max(SKY.fogMin, Math.round(SKY.fogFactor * bestSeasonPrice(state, level, crops)));
  const until = absDay(state) + SKY.fogDays - 1;
  for (const i of plots) state.plots[i].forage = { kind: 'mushroom', value, until };
  return { kind: 'mushroom', plots, value };
}

// ── Météos spéciales ────────────────────────────────────────────────────────────────────────

/**
 * Tire la météo spéciale d'un jour (un seul tirage du flux « sky ») d'après sa météo de base, celle de la veille et
 * sa saison. Carrière : pas d'arc-en-ciel (événement de carrière).
 */
export function drawSpecial(state, base, before, seasonId) {
  const career = state.mode === 'career';
  const u = stream(state.rng, 'sky').float();
  let acc = 0;
  for (const w of SPECIAL_WEATHERS) {
    if (career && w.career === false) continue;
    if (!w.on.includes(base) || !w.seasons.includes(seasonId)) continue;
    if (w.after && !w.after.includes(before)) continue;
    acc += w.chance;
    if (u < acc) return w.id;
  }
  return null;
}

/**
 * Aube, juste après le tirage de la météo de demain : aujourd'hui = la prévision d'hier, nouvelle prévision.
 * → { today, yesterday } (yesterday : météo spéciale du jour écoulé, pour la pousse et le vœu).
 */
export function advanceSky(state, tomorrowSeasonId) {
  const sky = state.surprises.sky;
  const yesterday = sky.today;
  sky.today = sky.tomorrow;
  const next = drawSpecial(state, state.weather.tomorrow, state.weather.today, tomorrowSeasonId);
  // Pas pendant les premiers jours (tutoriel, premiers gestes) : le tirage est fait quand même (déterminisme).
  sky.tomorrow = absDay(state) + 1 > SURPRISE_RULES.graceDays ? next : null;
  if (sky.today) bump(state.surprises.stats.weathers, sky.today);
  return { today: sky.today, yesterday };
}

/** Facteur de prix des récoltes du jour (heure dorée). */
export function goldenHourFactor(state) {
  return state.surprises?.sky?.today === 'goldenhour' ? SKY.goldenPrice : 1;
}

/** Événement de la météo spéciale du jour. */
export function specialInfo(id) {
  const w = SPECIAL_WEATHERS_BY_ID[id];
  return w ? { id: w.id, name: w.name, text: w.text, icon: w.icon } : null;
}

// ── Vœux (étoile filante) ───────────────────────────────────────────────────────────────────

/** Nouveau vœu (le matin après une nuit d'étoiles filantes) : 3 vœux parmi 4. */
export function newWish(state) {
  const rng = stream(state.rng, 'surprise');
  const options = shuffleTake(rng, WISHES.map((w) => w.id), 3);
  state.surprises.wish = { day: absDay(state), options };
  return wishInfo(state);
}

export function wishInfo(state) {
  const w = state.surprises?.wish;
  if (!w) return null;
  return { day: w.day, options: w.options.map((id) => ({ id, name: WISHES_BY_ID[id].name, text: WISHES_BY_ID[id].text, icon: WISHES_BY_ID[id].icon })) };
}

/** Pièces du vœu « bourse » (carrière : selon le rang). */
export function wishCoins(state) {
  return WISH.coins + (state.mode === 'career' ? WISH.perRank * (state.career.rank || 1) : 0);
}

/**
 * Exauce un vœu. ctx.earn(amount) verse l'argent. → { ok, boon, name, text, amount?, plots? } | { ok: false, reason }
 */
export function grantWish(state, boonId, ctx) {
  const w = state.surprises?.wish;
  if (!w) return { ok: false, reason: 'Pas de vœu à faire.' };
  if (!w.options.includes(boonId)) return { ok: false, reason: 'Ce vœu n\'est pas proposé.' };
  const def = WISHES_BY_ID[boonId];
  const out = { ok: true, boon: boonId, id: boonId, name: def.name, text: def.text };
  if (boonId === 'coins') {
    out.amount = wishCoins(state);
    ctx.earn(out.amount);
  } else if (boonId === 'growth') {
    const plots = [];
    state.plots.forEach((p, i) => {
      if (!p.cropId || p.env === null || !p.unlocked) return;
      const crop = getCrop(p.cropId);
      if (isTreeCrop(crop) || isMature(p)) return;
      p.growth = Math.min(crop.growDays, p.growth + 1);
      if (isMature(p) && p.care) p.care.wetEnd = true;
      plots.push(i);
    });
    out.plots = plots;
  } else if (boonId === 'luck') {
    state.surprises.luck = { until: absDay(state) + WISH.luckDays - 1 };
    out.until = state.surprises.luck.until;
  } else if (boonId === 'water') {
    const plots = [];
    state.plots.forEach((p, i) => {
      if (!p.cropId || p.env === null || !p.unlocked || p.watered) return;
      if (isTreeCrop(getCrop(p.cropId)) || isMature(p)) return;
      p.watered = true;
      plots.push(i);
    });
    out.plots = plots;
  }
  state.surprises.wish = null;
  state.surprises.stats.wishes += 1;
  return out;
}

// ── Surprises de l'aube ─────────────────────────────────────────────────────────────────────

function growingPlots(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (!p.cropId || !p.unlocked || p.env === null || inGreenhouse(p)) return;
    if (state.mode === 'career' && p.env !== 'field') return;
    const crop = getCrop(p.cropId);
    if (!isTreeCrop(crop) && !isMature(p)) out.push(i);
  });
  return out;
}

/** Centre et parcelles de la fée : le carré 3 × 3 qui contient le plus de cultures en train de pousser. */
function fairyArea(state, level, rng) {
  const growing = new Set(growingPlots(state));
  if (!growing.size) return null;
  const idx = cellIndex(state, level);
  const r = Math.floor(FAIRY.size / 2);
  let best = [];
  let bestN = 0;
  for (const i of growing) {
    const c = plotCell(state, level, i);
    let n = 0;
    for (let dr = -r; dr <= r; dr++) for (let dc = -r; dc <= r; dc++) if (growing.has(idx.get(`${c.group}:${c.col + dc},${c.row + dr}`))) n++;
    if (n > bestN) {
      bestN = n;
      best = [i];
    } else if (n === bestN) best.push(i);
  }
  const center = best[rng.int(0, best.length - 1)];
  const c = plotCell(state, level, center);
  const plots = [];
  for (let dr = -r; dr <= r; dr++) {
    for (let dc = -r; dc <= r; dc++) {
      const k = idx.get(`${c.group}:${c.col + dc},${c.row + dr}`);
      if (growing.has(k)) plots.push(k);
    }
  }
  return { center, plots: plots.sort((a, b) => a - b) };
}

/** La surprise est-elle possible aujourd'hui ? */
function surprisePossible(state, level, id) {
  const sid = SEASONS[state.time.seasonIndex];
  const career = state.mode === 'career';
  switch (id) {
    case 'fairy':
      return growingPlots(state).length > 0;
    case 'chest':
      return true;
    case 'ring':
      return sid !== 'winter' && emptyPlots(state).length > 0;
    case 'fox':
      return career && sid !== 'winter' && !foxActive(state);
    case 'hedgehog':
      return !career && (level.modifiers?.rotChance || 0) > 0 && sid !== 'winter' && !hedgehogActive(state);
    case 'owl':
      return !state.surprises.found.owl;
    default:
      return false;
  }
}

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

/** Coffre (aube ou trouvaille) : pièces ou écus. */
export function chestReward(state, rng) {
  if (rng.chance(CHEST.ecusChance)) {
    const ecus = rng.int(CHEST.ecus[0], CHEST.ecus[1]);
    return { ecus, reward: `${ecus} écus` };
  }
  const amount = rng.int(CHEST.coins[0], CHEST.coins[1]) + (state.mode === 'career' ? CHEST.perRank * (state.career.rank || 1) : 0);
  return { amount, reward: `${amount} pièces` };
}

/**
 * Surprise de l'aube (au plus une) : tirage, puis effet. ctx = { level, crops, earn(amount) }.
 * → données de l'événement `surprise` ({ kind, title, text, icon, … }) ou null.
 */
export function dawnSurprise(state, ctx) {
  if (!surprisesOn(state)) return null;
  const s = state.surprises;
  const today = absDay(state);
  const rng = stream(state.rng, 'surprise');
  const roll = rng.float();
  if (today <= SURPRISE_RULES.graceDays || today - s.lastDay < SURPRISE_RULES.minGap || roll >= SURPRISE_RULES.chance) return null;
  const options = {};
  for (const def of SURPRISES) if (surprisePossible(state, ctx.level, def.id)) options[def.id] = def.weight;
  if (!Object.keys(options).length) return null;
  return applySurprise(state, ctx, rng.weighted(options), rng);
}

/**
 * Applique une surprise donnée (tirage fait, ou débogage / tests : forceSurprise). → données de l'événement, ou
 * null si elle est impossible aujourd'hui.
 */
export function applySurprise(state, ctx, id, rng = stream(state.rng, 'surprise')) {
  const s = state.surprises;
  const today = absDay(state);
  if (!surprisePossible(state, ctx.level, id)) return null;
  const def = SURPRISES_BY_ID[id];
  const out = { kind: id, title: def.name, icon: def.icon };
  switch (id) {
    case 'fairy': {
      const area = fairyArea(state, ctx.level, rng);
      for (const i of area.plots) ripen(state.plots[i]);
      Object.assign(out, area);
      const n = area.plots.length;
      out.text = fill(def.text, { n, s: n > 1 ? 's' : '', verb: n > 1 ? 'ont' : 'a' });
      break;
    }
    case 'chest': {
      const r = chestReward(state, rng);
      if (r.amount) {
        out.amount = r.amount;
        ctx.earn(r.amount);
      } else out.ecus = r.ecus;
      out.text = fill(def.text, { reward: r.reward });
      break;
    }
    case 'ring': {
      const empty = emptyPlots(state);
      const plotIndex = empty[rng.int(0, empty.length - 1)];
      const value = Math.max(RING.min, Math.round(RING.factor * bestSeasonPrice(state, ctx.level, ctx.crops)));
      state.plots[plotIndex].forage = { kind: 'ring', value, until: today + RING.days - 1 };
      Object.assign(out, { plotIndex, value, plots: [plotIndex] });
      out.text = fill(def.text, { value });
      break;
    }
    case 'fox': {
      s.fox = { until: seasonEndDay(state, ctx.level) };
      Object.assign(out, { until: s.fox.until, days: s.fox.until - today + 1 });
      out.text = def.text;
      break;
    }
    case 'hedgehog': {
      s.hedgehog = { until: today + HEDGEHOG.days - 1 };
      Object.assign(out, { until: s.hedgehog.until, days: HEDGEHOG.days });
      out.text = fill(def.text, { days: HEDGEHOG.days });
      break;
    }
    case 'owl': {
      s.found.owl = true;
      Object.assign(out, { cosmeticId: FOUND_COSMETICS.owl, ecusIfOwned: ECUS_IF_OWNED });
      out.text = def.text;
      break;
    }
    default:
      return null;
  }
  s.lastDay = today;
  bump(s.stats.surprises, id);
  return out;
}

/** Fin des effets passés (renard, hérisson, chance). */
export function expireEffects(state) {
  const s = state.surprises;
  if (!s) return;
  const today = absDay(state);
  for (const k of ['fox', 'hedgehog', 'luck']) if (s[k] && s[k].until < today) s[k] = null;
}

// ── Requêtes ────────────────────────────────────────────────────────────────────────────────

/** Champs de query.plot(i) (seulement quand c'est activé). valueOf(i) : valeur d'une récolte à la main. */
export function plotSurpriseInfo(state, i, giantValue) {
  const p = state.plots[i];
  const crop = p.cropId ? getCrop(p.cropId) : null;
  const g = giantAt(state, i);
  return {
    quality: crop ? qualityChances(state, p, true) : null,
    care: crop ? careOf(state, p) : null,
    giant: g ? { anchor: g.anchor, plots: g.plots, isAnchor: g.anchor === i, cropId: g.cropId, value: giantValue } : null,
    forage: p.forage && !p.cropId ? { kind: p.forage.kind, value: p.forage.value, daysLeft: Math.max(0, p.forage.until - absDay(state)) } : null,
  };
}

/** Requête query.surprises(). */
export function surprisesQuery(state, giantValueOf, extra = {}) {
  const s = state.surprises;
  if (!s) return null;
  const today = absDay(state);
  const copy = (x) => (x ? { ...x, daysLeft: Math.max(0, x.until - today) } : null);
  const forage = [];
  state.plots.forEach((p, i) => {
    if (p.forage && !p.cropId) forage.push({ plotIndex: i, kind: p.forage.kind, value: p.forage.value, daysLeft: Math.max(0, p.forage.until - today) });
  });
  return {
    enabled: true,
    sky: { ...s.sky },
    fox: foxActive(state) ? copy(s.fox) : null,
    hedgehog: hedgehogActive(state) ? copy(s.hedgehog) : null,
    luck: luckActive(state) ? copy(s.luck) : null,
    wish: wishInfo(state),
    wells: [...s.wells],
    heirlooms: state.mode === 'career' ? JSON.parse(JSON.stringify(state.career.heirlooms || [])) : [],
    giants: allGiants(state).map((g) => ({ ...g, value: giantValueOf(g.anchor) })),
    forage,
    found: { ...s.found },
    stats: JSON.parse(JSON.stringify(s.stats)),
    ...extra,
  };
}

/** Argent d'une surprise dans les statistiques des niveaux (bilan : poste « surpriseIncome », créé au besoin). */
export function addSurpriseIncome(state, amount) {
  for (const st of [state.stats.year, state.stats.season]) st.surpriseIncome = (st.surpriseIncome || 0) + amount;
}

export { GIANT };
