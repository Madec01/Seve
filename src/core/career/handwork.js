// Mode Carrière — lot 4, F1 « aider sans remplacer » (pur, sans enregistrement d'extension). Règles :
// docs/GAME_DESIGN.md § 17.3 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats » (F1) ; nombres : F1 de
// src/data/cozy.js (la prime à la main : HAND_BONUS de src/data/career/career.js).
//
// Les salariés et les machines font les corvées (arroser, désherber, semer, ramasser, chasser les corbeaux) ; la
// récolte attend d'abord le joueur : machines (moissonneuse, cueilleuse) à partir de la 3ᵉ aube après la maturité,
// jardiniers à partir de la 4ᵉ (ripeAt : jour absolu de la maturité, posé à l'aube). Rien ne reste bloqué : le
// dernier jour de l'automne, l'équipe récolte tout de suite ce qui gèlerait (hors serre). Le géant garde la règle du
// lot 2 (3 aubes, giantOpenToHelpers). Aucun tirage.
//
// Tout est gardé par state.cozy?.parts?.helpers : une carrière sans le lot 4 garde l'ancien comportement (récolte tout
// de suite, prime 1,1).

import { getCrop, isTreeCrop } from '../../data/crops.js';
import { HAND_BONUS, HAND_BONUS_LEGACY } from '../../data/career/career.js';
import { F1 } from '../../data/cozy.js';
import { inGreenhouse, isMature } from '../farm.js';
import { absDay } from '../surprises.js';

/** true si F1 est actif dans cette carrière. */
export function helpersOn(state) {
  return state?.mode === 'career' && !!state.cozy?.parts?.helpers;
}

/** Prime « à la main » de la partie (1,25 avec F1, 1,1 sans). */
export function handBonusOf(state) {
  return helpersOn(state) ? HAND_BONUS : HAND_BONUS_LEGACY;
}

/** Aube (fin) : ripeAt = aujourd'hui pour toute parcelle mûre qui n'en a pas ; effacé sur les autres. */
export function markRipe(state) {
  if (!helpersOn(state)) return [];
  const today = absDay(state);
  const ripened = [];
  state.plots.forEach((p, i) => {
    if (!p || !p.env || !p.unlocked) {
      if (p && p.ripeAt !== undefined) delete p.ripeAt;
      return;
    }
    if (p.cropId && isMature(p)) {
      if (p.ripeAt === undefined) {
        p.ripeAt = today;
        ripened.push(i);
      }
    } else if (p.ripeAt !== undefined) delete p.ripeAt;
  });
  return ripened;
}

/** Le dernier jour de l'automne, une culture non résistante hors serre gèlerait demain (pas un arbre). */
function wouldFreezeTomorrow(state, p) {
  if (inGreenhouse(p)) return false;
  if (state.time.seasonIndex !== 2 || state.time.dayOfSeason !== state.career.seasonLength) return false;
  const crop = getCrop(p.cropId);
  return !!crop && !isTreeCrop(crop) && !crop.frostHardy;
}

/** Aubes passées depuis la maturité (0 le jour même ; ripeAt pas encore posé : 0). */
export function waitedDawns(state, i) {
  const p = state.plots[i];
  if (!p || !p.cropId || !isMature(p)) return 0;
  return Math.max(0, absDay(state) - (p.ripeAt ?? absDay(state)));
}

/**
 * Salariés ('staff') et machines ('machine') peuvent-ils récolter cette parcelle maintenant ?
 * true sans F1 (ancien comportement), pour un géant (règle du lot 2, vérifiée ailleurs), après le délai, ou le dernier
 * jour de l'automne pour ce qui gèlerait demain.
 */
export function helpersMayHarvest(state, i, who = 'staff') {
  if (!helpersOn(state)) return true;
  const p = state.plots[i];
  if (!p || !p.cropId) return true;
  if (p.giant !== undefined) return true;
  const delay = who === 'machine' ? F1.machineDelay : F1.staffDelay;
  if (waitedDawns(state, i) >= delay) return true;
  return wouldFreezeTomorrow(state, p);
}

/**
 * Aides qui peuvent récolter cette parcelle : { machine: 'harvester' | 'fruitPicker' | null (allumée, sur ce terrain),
 * staff: bool (un jardinier couvre ce terrain) }.
 */
export function harvestHelpers(state, i) {
  const p = state.plots[i];
  const out = { machine: null, staff: false };
  if (!p || !p.cropId || state.mode !== 'career' || !state.career) return out;
  const crop = getCrop(p.cropId);
  const want = crop && isTreeCrop(crop) ? 'fruitPicker' : 'harvester';
  for (const m of Object.values(state.career.machines || {})) {
    if (m && m.id === want && m.lotId === p.lot && m.on) out.machine = want;
  }
  out.staff = (state.career.staff || []).some((s) => s && s.job === 'gardener' && (s.lotId === 'all' || s.lotId === p.lot));
  return out;
}

/**
 * Fiche de la parcelle : aubes avant que l'équipe puisse récolter ({ machineIn, staffIn, machine } ; 0 = déjà ;
 * null quand cette aide n'est pas sur le terrain : pas de moissonneuse / cueilleuse allumée, pas de jardinier) ; null si
 * la parcelle n'est pas mûre ou sans F1.
 */
export function waitInfo(state, i) {
  if (!helpersOn(state)) return null;
  const p = state.plots[i];
  if (!p || !p.cropId || !isMature(p) || p.giant !== undefined) return null;
  const w = waitedDawns(state, i);
  const freeze = wouldFreezeTomorrow(state, p);
  const h = harvestHelpers(state, i);
  return {
    machineIn: h.machine ? (freeze ? 0 : Math.max(0, F1.machineDelay - w)) : null,
    staffIn: h.staff ? (freeze ? 0 : Math.max(0, F1.staffDelay - w)) : null,
    machine: h.machine,
    freeze,
  };
}

/** Culture en pousse qu'un jardinier peut désherber (pas un arbre, pas mûre, pas un géant, pas encore désherbée). */
export function weedable(state, i) {
  if (!helpersOn(state)) return false;
  const p = state.plots[i];
  if (!p || !p.unlocked || !p.env || !p.cropId || p.weeded || p.giant !== undefined) return false;
  const crop = getCrop(p.cropId);
  return !!crop && !isTreeCrop(crop) && !isMature(p);
}

/** Désherbe (jardinier) : weeded = true ; événement weeded. → { ok } */
export function weed(api, i, staff = null) {
  const { state } = api;
  if (!weedable(state, i)) return api.fail('Rien à désherber ici.');
  const p = state.plots[i];
  p.weeded = true;
  if (staff?.name) p.weededBy = staff.name;
  if (state.cozy?.stats) state.cozy.stats.weeded = (state.cozy.stats.weeded || 0) + 1;
  api.push('weeded', { plotIndex: i, by: staff?.id ?? 'staff', name: staff?.name ?? null });
  return { ok: true, plotIndex: i };
}

/** Bonus de qualité d'une culture désherbée récoltée à la main (lu par rollQuality) ; null sinon. */
export function weedQualityBonus(plot) {
  return plot && plot.weeded ? { fine: F1.weedFine, gold: F1.weedGold } : null;
}

/** Migration (ancienne carrière) : cultures déjà mûres → ripeAt reculé de F1.migrateRipeBack aubes. */
export function migrateRipe(state) {
  const today = absDay(state);
  for (const p of state.plots || []) {
    if (!p || !p.env || !p.unlocked || !p.cropId) continue;
    if (isMature(p) && p.ripeAt === undefined) p.ripeAt = today - F1.migrateRipeBack;
  }
}
