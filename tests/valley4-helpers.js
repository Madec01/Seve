// Outils communs aux tests du lot V4 de la Vallée vivante (tests/valley4*.test.js).
import { nextDay, record, startedCareer, toSeason } from './valley-helpers.js';
import { storkDay } from '../src/core/career/storks.js';

export { nextDay, record, startedCareer, toSeason };

export const A = (g) => g.actions.career;
export const Q = (g) => g.query.career;
export const V = (g) => g.state.career.valley;

/** Jour absolu de la carrière. */
export function absOf(g) {
  return (g.state.time.year - 1) * 4 * g.state.career.seasonLength + g.state.time.day;
}

/** Carrière avec la Vallée commencée, riche, au rang 6 (tout le V4 actif par défaut). */
export function v4Career(opts = {}, rank = 6) {
  const g = startedCareer(opts, rank);
  g.state.money = 5000000;
  return g;
}

/** Carrière à l'étape 7 (vue ouverte, six lieux à l'étape 2 au moins). */
export function stage7Career(opts = {}) {
  const g = v4Career(opts);
  A(g).triggerValley('stage', 7);
  return g;
}

/** Joue jusqu'au jour des cigognes du prochain printemps (aube passée). */
export function toStorkDay(g) {
  const day = storkDay(g.state);
  if (!(g.state.time.seasonIndex === 0 && g.state.time.dayOfSeason < day)) toSeason(g, 0);
  while (g.state.time.dayOfSeason < day) nextDay(g);
}

/** Joue jusqu'au jour `dayOfSeason` de la saison `seasonIndex` (prochaine occurrence, aube passée). */
export function toSeasonDay(g, seasonIndex, dayOfSeason) {
  if (!(g.state.time.seasonIndex === seasonIndex && g.state.time.dayOfSeason <= dayOfSeason)) toSeason(g, seasonIndex);
  while (g.state.time.dayOfSeason < dayOfSeason) nextDay(g);
}

/** Cigognes au clocher vues et étape 8 atteinte (aube suivante), roue posée. */
export function stage8Career(opts = {}) {
  const g = stage7Career(opts);
  toStorkDay(g);
  A(g).observeVisitor('whiteStork');
  nextDay(g);
  return g;
}
