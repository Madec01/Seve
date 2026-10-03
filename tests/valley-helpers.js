// Outils communs aux tests de la Vallée vivante (tests/valley*.test.js).
import { newCareer, nextDay, record, setRank, skipDays, withExtension } from './career-helpers.js';
import { getCrop } from '../src/data/crops.js';

export { newCareer, nextDay, record, setRank, skipDays, withExtension };

/** Carrière avec la Vallée (sans lots 2 à 4 sauf demande), riche, au rang `rank`, pas encore commencée. */
export function valleyCareer(opts = {}, rank = 2) {
  const g = newCareer({ valley: true, ...opts });
  g.state.money = 100000;
  setRank(g, rank);
  return g;
}

/** Carrière avec la Vallée commencée (boîte de Joseph reçue à l'aube). */
export function startedCareer(opts = {}, rank = 2) {
  const g = valleyCareer(opts, rank);
  nextDay(g);
  if (!g.state.career.valley.started) throw new Error('Vallée pas commencée');
  return g;
}

/** Parcelles ouvertes et vides d'un terrain (champ de départ par défaut). */
export function emptyPlots(g, lotId = 'start') {
  return g.state.plots.map((p, i) => (p.lot === lotId && p.env && p.unlocked && !p.cropId ? i : -1)).filter((i) => i >= 0);
}

/** Rend la culture d'une parcelle mûre. */
export function ripen(g, i) {
  const p = g.state.plots[i];
  p.growth = getCrop(p.cropId).growDays;
}

/** Joue jusqu'au premier jour de la saison `seasonIndex` (0 printemps … 3 hiver), après l'aube. */
export function toSeason(g, seasonIndex) {
  let guard = 0;
  while (!(g.state.time.seasonIndex === seasonIndex && g.state.time.dayOfSeason === 1) && guard++ < 200) nextDay(g);
}
