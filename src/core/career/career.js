// Mode Carrière — création et chargement (pur). Conception : docs/CARRIERE.md ; contrats :
// docs/ARCHITECTURE.md, « Mode Carrière — contrats ».
//
//   const game = createCareer({ seed, difficulty = 'detente', farmName, farmerGender = 'fermier',
//                               outfit = 'outfit.classic', seasonLength = 7, cosmetics });
//   const game2 = loadCareer(saved.state);   // migre (migrateCareer) puis vérifie (checkCareerState) ; lève une erreur sinon
//   game.mode === 'career' ; même interface que createGame (update, on, state, serialize, actions, query, level)
//   + game.actions.career.*, game.query.career.* (src/core/career/runtime.js).

import { DEFAULT_SPEED } from '../../data/balance.js';
import { COSMETICS_BY_ID, DECOR_SLOTS_BY_ID, DEFAULT_FARM_NAME } from '../../data/cosmetics.js';
import { CAREER_VERSION, DEFAULT_FARMER_GENDER, DEFAULT_SEASON_LENGTH, DIFFICULTY_CAREER, FARMER_GENDERS, SEASON_LENGTHS, START } from '../../data/career/career.js';
import { createRngState, hashSeed } from '../rng.js';
import { createStats } from '../stats.js';
import { drawWeather } from '../weather.js';
import { tomorrowSeasonIndex } from '../calendar.js';
import { cleanFarmName } from '../progression.js';
import { wrapState } from '../game.js';
import { initialLots, initialPlots } from './land.js';
import { placeBuilding } from './buildings.js';
import { initialCareerMarket } from './market.js';
import { careerLevel } from './level.js';
import { CAREER_STATE_VERSION, checkCareerState, defaultCareerFields, migrateCareer } from './save.js';
import { careerExtensions } from './registry.js';

export { careerLevel } from './level.js';
export { CAREER_SCHEMA, CAREER_VERSION, checkCareerState, migrateCareer, NEWER_SAVE_MESSAGE } from './save.js';
export { patrimony, rankTitle } from './ranks.js';

/** Options de création validées (valeurs inconnues → défauts ; difficulté ou durée inconnue → erreur). */
export function careerOptions({ difficulty = 'detente', farmName, farmerGender = DEFAULT_FARMER_GENDER, outfit = 'outfit.classic', seasonLength = DEFAULT_SEASON_LENGTH } = {}) {
  if (!DIFFICULTY_CAREER[difficulty]) throw new Error(`Difficulté inconnue : ${difficulty}`);
  if (!SEASON_LENGTHS.includes(seasonLength)) throw new Error(`Durée de saison inconnue : ${seasonLength}`);
  return {
    difficulty,
    farmName: cleanFarmName(farmName ?? DEFAULT_FARM_NAME),
    farmerGender: FARMER_GENDERS.includes(farmerGender) ? farmerGender : DEFAULT_FARMER_GENDER,
    outfit: COSMETICS_BY_ID[outfit]?.category === 'outfit' ? outfit : 'outfit.classic',
    seasonLength,
  };
}

/**
 * Nouvelle carrière.
 * @param opts { seed, difficulty ('detente' | 'classique'), farmName (18 caractères), farmerGender ('fermier' |
 *   'fermiere'), outfit (id de tenue ; l'interface ne propose que les tenues débloquées), seasonLength (7 | 10 | 14),
 *   cosmetics: { decor } (décor posé dans la progression : copie de départ de state.career.cosmetics.decor) }
 */
export function createCareer({ seed = Date.now(), cosmetics = null, ...rest } = {}) {
  const o = careerOptions(rest);
  const d = DIFFICULTY_CAREER[o.difficulty];
  const rng = createRngState(seed);
  rng.career = hashSeed(seed, 'career');
  rng.staff = hashSeed(seed, 'staff');
  rng.events = hashSeed(seed, 'events');
  const decor = {};
  if (cosmetics && cosmetics.decor && typeof cosmetics.decor === 'object') {
    for (const [slotId, itemId] of Object.entries(cosmetics.decor)) if (DECOR_SLOTS_BY_ID[slotId] && COSMETICS_BY_ID[itemId]) decor[slotId] = itemId;
  }
  const state = {
    version: CAREER_STATE_VERSION,
    mode: 'career',
    levelId: 'career',
    seed,
    status: 'playing',
    speed: DEFAULT_SPEED,
    time: { year: 1, day: 1, seasonIndex: 0, dayOfSeason: 1, elapsed: 0 },
    money: d.startMoney,
    startMoney: d.startMoney,
    weather: { today: null, tomorrow: null },
    plots: initialPlots(),
    plotsBought: 0,
    investments: { hen: START.hens },
    market: initialCareerMarket(),
    rng,
    stats: { year: createStats(), season: createStats() },
    lastDawn: null,
    result: null,
    perks: {},
    processing: {},
    contest: null,
    difficulty: o.difficulty,
    neighbourLoan: d.neighbourLoan ? { debt: 0, borrowed: 0, repaid: 0, forgiven: 0, loans: 0 } : null,
    career: {
      version: CAREER_VERSION,
      farmName: o.farmName,
      farmerGender: o.farmerGender,
      outfit: o.outfit,
      seasonLength: o.seasonLength,
      difficulty: o.difficulty,
      lots: initialLots(),
      ...defaultCareerFields(),
    },
  };
  state.career.cosmetics = { decor };
  placeBuilding(state, 'house', 'home', null, 1, 0);
  placeBuilding(state, 'coop', 'yard', 0, 1, 0);
  for (const ext of careerExtensions()) if (typeof ext.init === 'function') ext.init(state);
  const level = careerLevel(state);
  state.weather.today = drawWeather(state, level, 0);
  state.weather.tomorrow = drawWeather(state, level, tomorrowSeasonIndex(state, level) ?? 0);
  return wrapState(state);
}

/**
 * Reprise d'une carrière (objet issu de game.serialize()). Lève une erreur si l'objet est invalide,
 * d'une version plus récente (code 'newer') ou incohérent (checkCareerState).
 */
export function loadCareer(saved) {
  const state = migrateCareer(saved);
  const problem = checkCareerState(state);
  if (problem) throw new Error(`Sauvegarde de carrière invalide : ${problem}`);
  return wrapState(state);
}

/**
 * Métadonnées pour le menu (« Continuer · Ferme des Tilleuls · Année 3, été · Belle ferme ») :
 * { farmName, year, seasonId, day, rank, rankName, title, difficulty, patrimony, seasonLength, farmerGender, status }.
 */
export function careerMetaOf(game) {
  const s = game.query.career.summary();
  return {
    farmName: s.farmName,
    year: s.year,
    seasonId: s.seasonId,
    day: s.day,
    rank: s.rank,
    rankName: s.rankName,
    title: s.title,
    difficulty: s.difficulty,
    patrimony: s.patrimony,
    seasonLength: s.seasonLength,
    farmerGender: s.farmerGender,
    status: game.state.status,
  };
}
