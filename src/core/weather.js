// Météo : tirage quotidien selon la table de la saison et du niveau.

import { SEASONS, WEATHER_TYPES } from '../data/balance.js';
import { stream } from './rng.js';

/** Tire la météo d'un jour de la saison donnée (flux « weather »). */
export function drawWeather(state, level, seasonIndex) {
  const table = level.weather[SEASONS[seasonIndex]];
  return stream(state.rng, 'weather').weighted(table);
}

/** true si cette météo arrose tout le champ. */
export function weatherWaters(weatherId) {
  return !!WEATHER_TYPES[weatherId]?.waters;
}

/** true si c'est une aube pluvieuse (maladie possible). */
export function isRainy(weatherId) {
  return weatherWaters(weatherId);
}
