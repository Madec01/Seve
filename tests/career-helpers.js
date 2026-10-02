// Outils communs aux tests du mode Carrière (tests/career-*.test.js).
import { createCareer } from '../src/core/career/career.js';
import { registerCareerExtension } from '../src/core/career/registry.js';
import { DAY_SECONDS, forceWeather, nextDay, record, skipDays } from './helpers.js';

export { DAY_SECONDS, forceWeather, nextDay, record, skipDays };

/**
 * Nouvelle carrière ; 1er jour ensoleillé par défaut (tests indépendants de la météo tirée).
 * Surprises du lot 2 désactivées par défaut (qualité, géants, fée… changeraient les nombres des règles testées
 * ici) : les tests du lot 2 les demandent ({ surprises: true }, tests/surprises*.test.js).
 */
export function newCareer(opts = {}, { rawWeather = false } = {}) {
  const game = createCareer({ seed: 7, surprises: false, ...opts });
  if (!rawWeather) game.state.weather.today = 'sunny';
  return game;
}

/** Joue jusqu'au jour `day` de l'année `year` (journée commencée), temps ensoleillé. */
export function goTo(game, year, day, weather = 'sunny') {
  while ((game.state.time.year < year || (game.state.time.year === year && game.state.time.day < day)) && game.state.status === 'playing') nextDay(game, weather);
}

/** Passe une année entière (4 saisons). */
export function skipYear(game, weather = 'sunny') {
  const L = game.state.career.seasonLength;
  skipDays(game, 4 * L, weather);
}

/** Change le rang (tests) et recalcule le niveau. */
export function setRank(game, rank) {
  game.state.career.rank = rank;
  game.refreshLevel();
}

/**
 * Enregistre une extension de test qui capture `api` (CORE-B/C) ; renvoie { api: () => api, off }.
 * `ext` : champs d'une extension (hooks, providers…), id 'test' par défaut.
 */
export function withExtension(ext = {}) {
  let captured = null;
  const off = registerCareerExtension({
    id: 'test',
    ...ext,
    actions: (api) => {
      captured = api;
      return ext.actions ? ext.actions(api) : {};
    },
  });
  return { api: () => captured, off };
}

/** Récolte, arrose et sème partout (robot appliqué, pour faire tourner une ferme dans les tests). */
export function tendAll(game, cropFor = null) {
  const q = game.query;
  for (let i = 0; i < game.state.plots.length; i++) {
    let p = q.plot(i);
    if (p.action === 'harvest') game.actions.harvest(i);
    p = q.plot(i);
    if (p.action === 'plant') {
      const opts = q.plantableCrops(i).filter((o) => !o.willFreeze && o.canAfford);
      const pick = cropFor ? opts.find((o) => o.id === cropFor(i)) : opts[0];
      if (pick) game.actions.plant(i, pick.id);
    }
    if (q.plot(i).action === 'water') game.actions.water(i);
  }
}
