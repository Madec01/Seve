// Outils communs aux tests.

import { createGame } from '../src/core/game.js';
import { DAY_SECONDS } from '../src/data/balance.js';

export { DAY_SECONDS };

/**
 * Nouvelle partie ; par défaut le 1er jour est ensoleillé (tests indépendants de la météo tirée).
 * Mode « classique » par défaut : les tests des règles d'origine portent sur les nombres de la v3 ;
 * les tests du mode détente le demandent explicitement ({ difficulty: 'detente' }).
 */
export function newGame(levelId = 1, seed = 42, { rawWeather = false, perks, difficulty = 'classique' } = {}) {
  const game = perks ? createGame({ levelId, seed, perks, difficulty }) : createGame({ levelId, seed, difficulty });
  if (!rawWeather) game.state.weather.today = 'sunny';
  return game;
}

/** Impose la météo du prochain jour (la prévision devient la météo du jour à l'aube). */
export function forceWeather(game, weather) {
  game.state.weather.tomorrow = weather;
}

/** Passe au jour suivant avec la météo donnée pour ce nouveau jour. */
export function nextDay(game, weather = 'sunny') {
  forceWeather(game, weather);
  game.update(DAY_SECONDS / game.state.speed);
}

/** Passe n jours (ensoleillés par défaut). */
export function skipDays(game, n, weather = 'sunny') {
  for (let i = 0; i < n; i++) nextDay(game, weather);
}

/** Index des parcelles ouvertes. */
export function openPlots(game) {
  return game.state.plots.map((p, i) => (p.unlocked ? i : -1)).filter((i) => i >= 0);
}

/** Enregistre tous les événements émis. */
export function record(game) {
  const events = [];
  game.on('*', (e) => events.push(e));
  return {
    events,
    of: (type) => events.filter((e) => e.type === type),
    clear: () => events.splice(0, events.length),
  };
}

/** Beaucoup d'argent, pour isoler une règle des problèmes de trésorerie. */
export function rich(game, amount = 100000) {
  game.state.money = amount;
}

/** Joue jusqu'au soir du jour `day` (inclus : la journée `day` est commencée, pas finie). */
export function goToDay(game, day, weather = 'sunny') {
  while (game.state.time.day < day && game.state.status === 'playing') nextDay(game, weather);
}
