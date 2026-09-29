// Calendrier : jours, saisons, fin d'année.
// Conventions : state.time.day est le jour de l'année (1..total), dayOfSeason commence à 1.

import { DAY_SECONDS, SEASONS, SEASON_NAMES } from '../data/balance.js';
import { yearLength } from '../data/levels.js';

export function seasonId(state) {
  return SEASONS[state.time.seasonIndex];
}

export function seasonLength(level, seasonIndex) {
  return level.seasonLengths[seasonIndex];
}

export function isLastDayOfSeason(state, level) {
  return state.time.dayOfSeason >= seasonLength(level, state.time.seasonIndex);
}

export function isLastSeason(state) {
  return state.time.seasonIndex === SEASONS.length - 1;
}

/** Nombre de jours complets restant dans la saison après aujourd'hui (0 = dernier jour). */
export function daysLeftInSeason(state, level) {
  return seasonLength(level, state.time.seasonIndex) - state.time.dayOfSeason;
}

/** Saison de demain (null si l'année s'achève ce soir). */
export function tomorrowSeasonIndex(state, level) {
  if (!isLastDayOfSeason(state, level)) return state.time.seasonIndex;
  return isLastSeason(state) ? null : state.time.seasonIndex + 1;
}

/** Fait passer le calendrier au jour suivant. Renvoie true si une nouvelle saison commence. */
export function advanceDay(state, level) {
  const t = state.time;
  t.day += 1;
  if (t.dayOfSeason >= seasonLength(level, t.seasonIndex)) {
    t.seasonIndex += 1;
    t.dayOfSeason = 1;
    return true;
  }
  t.dayOfSeason += 1;
  return false;
}

export function calendarQuery(state, level) {
  const t = state.time;
  const id = SEASONS[t.seasonIndex];
  return {
    day: t.day,
    dayOfSeason: t.dayOfSeason,
    seasonIndex: t.seasonIndex,
    seasonId: id,
    seasonName: SEASON_NAMES[id],
    seasonLength: seasonLength(level, t.seasonIndex),
    daysLeftInSeason: daysLeftInSeason(state, level),
    dayProgress: Math.min(1, Math.max(0, t.elapsed / DAY_SECONDS)),
    totalDays: yearLength(level),
  };
}
