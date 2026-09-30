// Mode Carrière — patrimoine, objectifs et rangs (pur). Conception : docs/CARRIERE.md § 1.5.
//
// Patrimoine = argent + prix payé pour les terrains + ½ × (aménagements, bâtiments et niveaux, machines,
//              animaux achetés, au prix payé) + fournisseurs des extensions − dette envers Joseph.
// Un rang s'obtient dès que le patrimoine atteint le seuil (× durée de saison / 7) ET que ses deux
// objectifs sont remplis (vérifié à chaque aube et après chaque achat). Un objectif rempli l'est pour
// toujours (state.career.objectives[id] = true) ; un rang acquis aussi.

import { CAREER_ECUS, seasonScale } from '../../data/career/career.js';
import { BUILDINGS, BUILDINGS_BY_ID } from '../../data/career/buildings.js';
import { LOT_TYPES } from '../../data/career/lots.js';
import { MAX_RANK, RANKS, getRank } from '../../data/career/ranks.js';
import { getCrop } from '../../data/crops.js';
import { CROPS_BY_RANK } from '../../data/career/career.js';
import { buildingLevel } from './effects.js';
import { speciesCount } from './buildings.js';
import { cultivablePlots, maxLotsForRank } from './land.js';
import { careerAnimals, providedFirst, providedSum, providersOf } from './registry.js';

export function patrimony(state) {
  const c = state.career;
  let lots = 0;
  let develop = 0;
  for (const l of c.lots) {
    lots += l.pricePaid || 0;
    develop += l.developPaid || 0;
  }
  const half = develop + (c.paid.buildings || 0) + (c.paid.machines || 0) + (c.paid.animals || 0);
  const debt = state.neighbourLoan ? state.neighbourLoan.debt : 0;
  return Math.round(state.money + lots + half / 2 + providedSum('patrimony', state) - debt);
}

/** Seuil de patrimoine d'un rang pour cette carrière (× durée de saison / 7). */
export function rankThreshold(state, rank) {
  const r = getRank(rank);
  return r ? Math.round(r.patrimony * seasonScale(state.career.seasonLength)) : Infinity;
}

/** Progression d'un objectif (nombre comparé à target). */
export function objectiveProgress(state, obj) {
  const provided = providedFirst('objective', state, obj);
  if (typeof provided === 'number') return provided;
  const c = state.career;
  switch (obj.type) {
    case 'lots':
      return c.lotsBought;
    case 'harvests':
      return c.lifetime.harvests;
    case 'staff':
      return c.staff.length;
    case 'productsSold':
      return c.lifetime.productsSold;
    case 'plots':
      return cultivablePlots(state);
    case 'quests':
      return c.joseph?.questsDone ?? c.lifetime.questsDone ?? 0;
    case 'species':
      return speciesCount(state);
    case 'buildingLevel':
      return buildingLevel(state, obj.buildingId);
    case 'contestsWon':
      return c.lifetime.contestsWon;
    default:
      return 0;
  }
}

/** Marque les objectifs remplis (tous rangs confondus). Renvoie les ids nouvellement remplis. */
export function updateObjectives(state) {
  const done = [];
  for (const r of RANKS) {
    for (const o of r.objectives) {
      if (state.career.objectives[o.id]) continue;
      if (objectiveProgress(state, o) >= o.target) {
        state.career.objectives[o.id] = true;
        done.push(o.id);
      }
    }
  }
  return done;
}

/** true si le rang `rank` est atteint (seuil et objectifs). */
export function rankReached(state, rank) {
  const r = getRank(rank);
  if (!r) return false;
  return patrimony(state) >= rankThreshold(state, rank) && r.objectives.every((o) => state.career.objectives[o.id]);
}

/** Titre du fermier au rang donné (accordé). */
export function rankTitle(state, rank = state.career.rank) {
  const r = getRank(rank);
  return r ? r.title[state.career.farmerGender] || r.title.fermier : '';
}

/**
 * Déblocages d'un rang, pour la liste affichée : cultures, aménagements, bâtiments et niveaux, animaux,
 * terrains, fonctions (machines, embauche…) et fournisseurs `unlocks` des extensions.
 */
export function unlocksFor(rank) {
  const out = [];
  for (const id of CROPS_BY_RANK[rank] || []) out.push({ kind: 'crop', id, name: getCrop(id)?.name ?? id });
  for (const a of careerAnimals()) if ((a.rank ?? 1) === rank) out.push({ kind: 'animal', id: a.id, name: a.name });
  for (const t of LOT_TYPES) if (t.rank === rank && t.id !== 'wild') out.push({ kind: 'lotType', id: t.id, name: t.name });
  for (const b of BUILDINGS) {
    b.levels.forEach((lvl, k) => {
      if (lvl.rank !== rank || (k === 0 && b.startLevel)) return;
      if (k === 0 && b.placement === 'lot') return; // payé avec l'aménagement (déjà listé)
      out.push({ kind: 'building', id: b.id, level: k + 1, name: k === 0 ? b.name : `${lvl.name} (niv. ${k + 1})` });
    });
  }
  const prev = rank > 1 ? maxLotsForRank(rank - 1) : 0;
  const now = maxLotsForRank(rank);
  if (now > prev) out.push({ kind: 'lots', id: 'lots', n: now, name: now === 1 ? '1 terrain' : `Jusqu'à ${now} terrains` });
  for (const f of getRank(rank)?.features || []) out.push({ ...f });
  for (const fn of providersOf('unlocks')) {
    const extra = fn(rank);
    if (Array.isArray(extra)) out.push(...extra);
  }
  // Doublons (une extension peut relister une machine) : premier gardé.
  const seen = new Set();
  return out.filter((u) => {
    const k = `${u.kind}:${u.id}:${u.level ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Écus du passage au rang `rank`. */
export function rankUpEcus(rank) {
  return CAREER_ECUS.rankUpPerRank * rank;
}

/**
 * Vérifie objectifs et rangs ; passe autant de rangs que possible (événement rankUp pour chacun).
 * Renvoie les rangs gagnés.
 */
export function checkRanks(api) {
  const { state } = api;
  updateObjectives(state);
  const gained = [];
  while (state.career.rank < MAX_RANK && rankReached(state, state.career.rank + 1)) {
    state.career.rank += 1;
    const r = getRank(state.career.rank);
    gained.push(state.career.rank);
    api.refreshLevel();
    api.push('rankUp', { rank: r.rank, name: r.name, title: rankTitle(state), unlocks: unlocksFor(r.rank), ecus: rankUpEcus(r.rank) });
  }
  const p = patrimony(state);
  if (p > (state.career.bestPatrimony || 0)) state.career.bestPatrimony = p;
  return gained;
}

/** Résumé pour query.career.summary(). */
export function rankSummary(state) {
  const c = state.career;
  const r = getRank(c.rank);
  const next = getRank(c.rank + 1);
  return {
    rank: c.rank,
    rankName: r.name,
    title: rankTitle(state),
    patrimony: patrimony(state),
    bestPatrimony: c.bestPatrimony || 0,
    nextRank: next
      ? {
          rank: next.rank,
          name: next.name,
          title: rankTitle(state, next.rank),
          patrimony: rankThreshold(state, next.rank),
          objectives: next.objectives.map((o) => {
            const progress = objectiveProgress(state, o);
            return { id: o.id, label: o.label, done: !!c.objectives[o.id], progress: Math.min(progress, o.target), target: o.target };
          }),
          unlocks: unlocksFor(next.rank),
        }
      : null,
  };
}

export { BUILDINGS_BY_ID };
