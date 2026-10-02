// Options de partie gérées par le cœur (lot 1 « confort ») — logique pure, sans DOM.
//
// state.options n'existe que si une option a été réglée (game.setOption) : une partie qui n'en règle
// aucune garde exactement le même état qu'avant (parité du mode classique, sauvegardes inchangées).
//
// Options :
//   autoPauseDawn  (booléen, défaut false) : le jeu se met en pause (vitesse 0) juste après le
//                  traitement de chaque aube. Un grand dt s'arrête à cette aube (les jours suivants ne
//                  sont pas enchaînés). Événement 'autoPaused' { day, seasonId, previousSpeed } émis après
//                  'dawn' (et après 'seasonWarning').

import { GAME_OPTIONS } from '../data/balance.js';

/** Valeur courante d'une option (défaut si jamais réglée). */
export function optionValue(state, name) {
  const o = state.options;
  if (o && Object.prototype.hasOwnProperty.call(o, name)) return o[name];
  return GAME_OPTIONS[name];
}

/** Toutes les options (copie, défauts compris). */
export function allOptions(state) {
  const out = { ...GAME_OPTIONS };
  for (const k of Object.keys(GAME_OPTIONS)) out[k] = optionValue(state, k);
  return out;
}

/**
 * Règle une option. → { ok: true, name, value } | { ok: false, reason }.
 * Modifie state.options (créé à la première option réglée).
 */
export function setOption(state, name, value) {
  if (!Object.prototype.hasOwnProperty.call(GAME_OPTIONS, name)) return { ok: false, reason: 'Option inconnue.' };
  if (typeof GAME_OPTIONS[name] === 'boolean') {
    if (typeof value !== 'boolean') return { ok: false, reason: 'Valeur invalide (oui ou non attendu).' };
  }
  if (!state.options || typeof state.options !== 'object') state.options = {};
  state.options[name] = value;
  return { ok: true, name, value };
}

/** Vérifie state.options d'une sauvegarde : null si correct (ou absent), sinon un message. */
export function checkOptions(s) {
  if (s.options === undefined) return null;
  const o = s.options;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'options';
  for (const [k, v] of Object.entries(o)) {
    if (!Object.prototype.hasOwnProperty.call(GAME_OPTIONS, k)) continue; // option d'une version future : ignorée
    if (typeof v !== typeof GAME_OPTIONS[k]) return `option ${k}`;
  }
  return null;
}

/**
 * Après une aube : pause automatique si l'option est active et la partie continue.
 * Met la vitesse à 0 et émet 'autoPaused'. Renvoie true si la pause a été mise (la boucle de temps
 * doit alors s'arrêter : le reste du dt est abandonné).
 */
export function autoPauseAfterDawn(state, push, seasonId) {
  if (!optionValue(state, 'autoPauseDawn') || state.speed === 0) return false;
  const previousSpeed = state.speed;
  state.speed = 0;
  push('autoPaused', { day: state.time.day, seasonId, previousSpeed });
  return true;
}
