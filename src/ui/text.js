// Textes de l'interface : saisons avec leurs articles, météo, sources de revenus et de charges.

import { SEASONS, SEASON_NAMES, WEATHER_TYPES } from '../data/balance.js';
import { getInvestment } from '../data/investments.js';
import { getCrop } from '../data/crops.js';

export { SEASONS, SEASON_NAMES };

const SEASON_FORMS = {
  spring: { the: 'le printemps', of: 'du printemps', in: 'au printemps', end: 'Fin du printemps' },
  summer: { the: 'l\'été', of: 'de l\'été', in: 'en été', end: 'Fin de l\'été' },
  autumn: { the: 'l\'automne', of: 'de l\'automne', in: 'en automne', end: 'Fin de l\'automne' },
  winter: { the: 'l\'hiver', of: 'de l\'hiver', in: 'en hiver', end: 'Fin de l\'hiver' },
};

/** Forme d'une saison : 'name' (« Printemps »), 'the', 'of', 'in', 'end'. */
export function season(id, form = 'name') {
  if (form === 'name') return SEASON_NAMES[id] || id;
  return SEASON_FORMS[id]?.[form] || id;
}

/** « L'été arrive », « L'hiver arrive »… */
export function seasonArrives(id) {
  const t = season(id, 'the');
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} arrive`;
}

export function weatherName(id) {
  return WEATHER_TYPES[id]?.name || '—';
}

export const WEATHER_HINTS = {
  sunny: 'Beau temps : pensez à arroser.',
  cloudy: 'Temps couvert : pensez à arroser.',
  rain: 'La pluie arrose tout le champ.',
  storm: 'L\'orage arrose tout le champ, mais l\'étal reste fermé.',
  heatwave: 'Canicule : une culture non arrosée ne pousse pas du tout.',
  snow: 'Neige : un joli manteau blanc, sans effet sur les cultures.',
};

export function investmentName(id) {
  return getInvestment(id)?.name || id;
}

export function cropName(id) {
  return getCrop(id)?.name || id;
}

/** « 3 carottes » : nom de culture en minuscule, accordé. */
export function cropCount(id, n) {
  const name = cropName(id).toLowerCase();
  if (name === 'blé') return n <= 1 ? `${n} botte de blé` : `${n} bottes de blé`;
  if (n <= 1) return `${n} ${name}`;
  if (name.endsWith('s') || name.endsWith('x')) return `${n} ${name}`;
  if (name === 'maïs') return `${n} maïs`;
  if (name === 'blé') return `${n} bottes de blé`;
  return `${n} ${name}s`;
}

export const CHARGE_NAMES = {
  farm: 'Charges de la ferme',
  water: 'Arrosage payant',
  loan: 'Mensualité du prêt',
};
