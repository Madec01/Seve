// Mode Carrière — lot 4 « Collection & enjeux doux » : extension (id 'cozy'), enregistrée en DERNIER par
// src/core/career/extensions.js (après la variété). Pur. Règles : docs/GAME_DESIGN.md § 17 ; contrat :
// docs/ARCHITECTURE.md, « Lot 4 — contrats ».
//
// Les fêtes, l'hiver et les lanternes sont partagés avec les niveaux (src/core/cozy.js) ; ici, l'hôte de carrière
// (argent par l'api : poste « fetes » du bilan, « other » pour l'hiver, sachets de la foire : « seeds »), et les points
// d'accroche :
//   seasonStart  hiver : la mangeoire sort, la veillée au 3ᵉ jour ; printemps : trouvailles et traces effacées ;
//   dawnEvents   fêtes du calendrier et du thème (veille, jour), hiver (trouvaille, trace, oiseau, veillée) ;
//   incomes      produits animaux de l'aube (laine des moutons, lait parti à la fromagerie) ;
//   dawn         F1 : ripeAt posé sur chaque parcelle qui vient de mûrir (handwork.markRipe) ;
//   evening      fin de la fête du jour (feteEnded) ;
//   yearEnd      lanternes de l'année (lanternsLit, avant l'événement yearEnd), report.cozy, compteurs remis à zéro.
// F1 (aider sans remplacer) est lu directement par machines.js, work.js, runtime.js et surprises.js (handwork.js).

import { SEASONS } from '../../data/balance.js';
import { treeSeedCost } from '../trees.js';
import {
  checkCozy, completeCozy, cozyDawn, cozyEvening, cozyLanterns, cozySeasonStart, diffStats, emptyCozyStats, enableCozy, migrateToCozy,
  newCozyYear, noteCozyAnimal, yearBaseOf,
} from '../cozy.js';
import { markRipe, migrateRipe } from './handwork.js';
import { patrimony } from './ranks.js';
import { careerVarietyYear } from './variety-host.js';
import { absDay } from '../surprises.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const LANTERN_HISTORY = 10;

/** Hôte du lot 4 pour une carrière (voir src/core/cozy.js). */
export function careerCozyHost(api) {
  const { state } = api;
  return {
    mode: 'career',
    state,
    _api: api,
    get level() {
      return api.level;
    },
    get crops() {
      return api.crops;
    },
    push: api.push,
    fail: api.fail,
    earn(kind, amount) {
      if (!(amount > 0)) return;
      api.earn(kind === 'fete' ? 'fetes' : 'other', amount);
    },
    spend(amount) {
      if (amount > 0) api.spend('seeds', amount);
    },
    rank: () => state.career.rank,
    seasonLength: () => state.career.seasonLength,
    patrimony: () => patrimony(state),
    treeSeedCost: (crop) => treeSeedCost(state, crop),
  };
}

/** Débogage : 'ripe' (ripeAt des parcelles mûres reculé de `arg` aubes, 4 par défaut). */
export function triggerCareerCozy(host, kind, arg) {
  const { state } = host;
  if (kind !== 'ripe') return host.fail('Inconnu.');
  if (!state.cozy?.parts?.helpers) return host.fail('« Aider sans remplacer » désactivé.');
  const n = Number.isInteger(arg) ? arg : 4;
  markRipe(state);
  let count = 0;
  for (const p of state.plots) {
    if (p.ripeAt === undefined) continue;
    p.ripeAt -= n;
    count++;
  }
  return { ok: true, plots: count };
}

/** Contexte des succès et de l'album (query.achievementContext().career, ajouts du lot 4). */
export function careerAchievementExtras(state) {
  const c = state.career;
  const species = ['hen', 'rabbit', 'duck', 'goat', 'cow', 'sheep', 'pig', 'horse'].filter((id) => (state.investments[id] || 0) > 0);
  if ((state.investments.beehive || 0) > 0) species.push('bees');
  const animalProducts = { ...(state.cozy?.stats?.animal || {}) };
  if ((c.lifetime?.truffles || 0) > 0) animalProducts.truffle = Math.max(animalProducts.truffle || 0, c.lifetime.truffles);
  const themes = new Set((c.theme?.history || []).map((h) => h.id).filter(Boolean));
  if (c.theme?.id && c.theme.year === state.time.year) themes.add(c.theme.id);
  return {
    pets: { ...(c.pets || {}) },
    speciesIds: species,
    animalProducts,
    fish: { ...(state.cozy?.stats?.fish || {}) },
    themes: [...themes],
    themeVisitors: Object.keys(state.cozy?.stats?.themeVisitors || {}),
    themesPlayed: Object.keys(state.cozy?.stats?.themesPlayed || {}),
    contestGoalsMet: c.contest?.result?.goalsMet?.length || 0,
  };
}

/** Lanternes de l'année, report.cozy, historique, compteurs remis à zéro (yearEnd). */
function yearEnd(api, { year, report }) {
  const { state } = api;
  const z = state.cozy;
  if (!z) return;
  const host = careerCozyHost(api);
  const varietyYear = state.variety ? careerVarietyYear(state) : null;
  const lanterns = z.parts.lanterns ? cozyLanterns(host, { patrimony: report.patrimony, varietyYear }) : null;
  if (lanterns) {
    if (!z.lanterns) z.lanterns = { history: [] };
    z.lanterns.history.push({ year, values: [...lanterns.values], total: lanterns.total, partial: lanterns.partial });
    if (z.lanterns.history.length > LANTERN_HISTORY) z.lanterns.history.splice(0, z.lanterns.history.length - LANTERN_HISTORY);
    api.push('lanternsLit', { year, values: lanterns.values, total: lanterns.total, criteria: lanterns.criteria, partial: lanterns.partial });
  }
  const y = z.year;
  report.cozy = {
    lanterns: lanterns ? { values: lanterns.values, total: lanterns.total, partial: lanterns.partial } : null,
    fetes: clone(y.fetes),
    winter: { finds: y.finds, feederDays: y.feederDays, birds: Object.keys(y.birds), story: y.story },
    handPicked: y.hand,
    harvests: y.harvests,
    handBonus: y.handBonus,
    stats: diffStats(z.stats, z.statsBase || emptyCozyStats()),
  };
  // L'année suivante commence au lendemain (1er jour du printemps).
  z.year = newCozyYear(absDay(state) + 1, false, yearBaseOf(state));
  z.year.patrimonyStart = report.patrimony;
  z.statsBase = clone(z.stats);
  z.stand = null;
}

export const cozyExtension = {
  id: 'cozy',
  init(state) {
    if (!state.cozy) return;
    state.cozy.year.patrimonyStart = patrimony(state);
    state.cozy.year.base = yearBaseOf(state);
  },
  migrate(state) {
    // Carrière d'avant le lot 4 : le lot s'active à la reprise (F1 tout de suite, cultures déjà mûres : ripeAt reculé
    // de 4 aubes ; lanternes de l'année en cours sur ce qui reste ; foire aux graines au prochain dernier jour d'hiver).
    if (state.cozy === undefined && state.rng && typeof state.rng === 'object' && state.career && state.time) {
      migrateToCozy(state);
      state.cozy.year.patrimonyStart = patrimony(state);
      migrateRipe(state);
    } else if (state.cozy) completeCozy(state);
  },
  check(state) {
    return checkCozy(state);
  },
  hooks: {
    seasonStart(api) {
      if (api.state.cozy) cozySeasonStart(careerCozyHost(api));
    },
    dawnEvents(api, { weather }) {
      if (!api.state.cozy) return;
      for (const [type, payload] of cozyDawn(careerCozyHost(api), { weather })) api.push(type, payload);
    },
    incomes(api, { milkToDairy }) {
      const { state } = api;
      if (!state.cozy) return [];
      // Laine (moutons à l'aube), lait parti à la fromagerie : « ce que la ferme a produit ».
      if ((state.investments.sheep || 0) > 0) noteCozyAnimal(state, 'wool', 1);
      if ((milkToDairy || []).length) noteCozyAnimal(state, 'milk', 1);
      return [];
    },
    dawn(api) {
      if (api.state.cozy) markRipe(api.state);
    },
    evening(api) {
      if (!api.state.cozy) return;
      for (const [type, payload] of cozyEvening(careerCozyHost(api))) api.push(type, payload);
    },
    yearEnd,
  },
};

/** Active le lot à la création d'une carrière (createCareer({ cozy })). */
export function enableCareerCozy(state, opt = true) {
  if (opt === false) {
    state.cozy = null;
    return null;
  }
  return enableCozy(state, opt);
}

export { SEASONS };
