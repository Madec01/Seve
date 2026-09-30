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

/**
 * Conseil météo tenant compte du mode de difficulté (pousse sans arrosage pendant une canicule :
 * 0 en classique, un peu en détente).
 */
export function weatherHint(id, level = null) {
  if (id === 'heatwave' && level && (level.dryHeatwaveGrowth ?? 0) > 0) return 'Canicule : une culture non arrosée pousse à peine.';
  return WEATHER_HINTS[id] || '';
}

/**
 * Effet d'un jour sans arrosage, selon le mode (level.dryGrowth : 0,5 en classique, 0,75 en détente).
 * @returns { faster: « deux fois plus vite » | « plus vite », slower: « deux fois moins vite » | « un peu moins vite » }
 */
export function waterEffect(level = null) {
  const dry = level?.dryGrowth ?? 0.5;
  if (dry <= 0.5) return { faster: 'deux fois plus vite', slower: 'deux fois moins vite' };
  return { faster: 'plus vite', slower: 'un peu moins vite' };
}

/** Nom court d'un mode de difficulté ('detente' → « Détente »). */
export function difficultyName(id) {
  return id === 'classique' ? 'Classique' : 'Détente';
}

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
  if (name === 'chou') return `${n} choux`;
  if (name === 'pomme de terre') return `${n} pommes de terre`;
  return `${n} ${name}s`;
}

export const CHARGE_NAMES = {
  farm: 'Charges de la ferme',
  water: 'Arrosage payant',
  loan: 'Mensualité du prêt',
};

// ── Revenus des investissements ─────────────────────────────────────────────────────

/** « au printemps », « au printemps et en automne », « au printemps, en été et en automne ». */
export function seasonList(ids, form = 'in') {
  const parts = ids.map((id) => season(id, form));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`;
}

/**
 * Profil d'un revenu saisonnier (par jour, pour `units` unités) :
 * { constant, value (si constant), groups: [{ value, seasons }] triés du plus fort au plus faible }.
 */
export function incomeProfile(bySeason = {}, units = 1) {
  const values = SEASONS.map((s) => (bySeason[s] || 0) * units);
  const constant = values.every((v) => v === values[0]);
  const groups = [];
  SEASONS.forEach((s, i) => {
    const g = groups.find((x) => x.value === values[i]);
    if (g) g.seasons.push(s);
    else groups.push({ value: values[i], seasons: [s] });
  });
  groups.sort((a, b) => b.value - a.value);
  return { constant, value: constant ? values[0] : null, values, groups };
}

/**
 * Phrase décrivant un revenu quotidien selon les saisons :
 * « +7 par jour, toute l'année », « +5 par jour, sauf en hiver »,
 * « +8 par jour en été, +4 au printemps et en automne, +2 en hiver ».
 */
export function incomePhrase(bySeason, units = 1) {
  const p = incomeProfile(bySeason, units);
  if (p.constant) return p.value > 0 ? `+${p.value} par jour, toute l'année` : 'aucun revenu quotidien';
  const paying = p.groups.filter((g) => g.value > 0);
  const zero = p.groups.find((g) => g.value === 0);
  if (paying.length === 1 && zero) return `+${paying[0].value} par jour, sauf ${seasonList(zero.seasons)}`;
  const text = paying.map((g, i) => `+${g.value}${i === 0 ? ' par jour' : ''} ${seasonList(g.seasons)}`).join(', ');
  return zero ? `${text}, rien ${seasonList(zero.seasons)}` : text;
}
