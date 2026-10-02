// Mode Carrière — lot 3 « Variété » : extension (id 'variety'). Pur. Règles : docs/GAME_DESIGN.md § 16 ; contrat :
// docs/ARCHITECTURE.md, « Lot 3 — contrats ».
//
// Le tableau, la charrette, les cartes, les défis et le colporteur sont partagés avec les niveaux (src/core/variety.js,
// src/core/requests.js) ; ici, l'hôte de carrière (argent par l'api, postes du bilan, grenier, poules et ruches), et
// les points d'accroche :
//   seasonStart  printemps : le thème annoncé commence (themeStarted) ;
//   dawnEvents   cartes échues, nouvelle saison (défis, charrette), colporteur, tableau ; thème (averse, fête, visiteur) ;
//   incomes      thème des abeilles (+50 % de miel), du tourisme (chambre d'hôte, nuit des lampions) ;
//   dawn         médailles (produits vendus, ramassages) ;
//   evening      départ de Basile ; dernier jour de la saison : charrette, défis jugés, cartes et défis proposés
//                (avant les charges de saison) ;
//   yearEnd      compteurs de l'année (report.variety), thème suivant (themeAnnounced, report.nextTheme) ;
//   harvest      récolte à la main d'une culture demandée : { divert, sell, label, after } (vendue tout de suite).
// Fournisseurs : priceFactor (affiche, recette, thème), seedFactor (foire aux graines, thème), extraPlaces (fromagerie
// de l'année du fromage), seasonChargeFactor (ristourne de la coopérative).

import { SEASONS } from '../../data/balance.js';
import { hasRoom, targetFor } from '../processing.js';
import {
  checkMedals, checkVariety, completeVariety, emptyVarietyStats, judgeChallenges, merchantEvening, migrateToVariety,
  offerCards, offerChallenges, varietyCartEvening, varietyDawn,
} from '../variety.js';
import { claimPreview, claimUnits } from '../requests.js';
import { posterFactor, recipeFactor, seedFairFactor, themePriceFactor, themeSeedFactor } from '../variety-effects.js';
import { careerIncomes } from './effects.js';
import { careerVarietyHost, careerVarietyYear, hostOf, setThemeCalendarProvider } from './variety-host.js';
import {
  checkTheme, drawNextTheme, ensureTheme, startTheme, themeCalendar, themeDawn, themeExtraPlaces, themeIncomes, themeInfo, themeQuery,
} from './themes.js';
import { THEMES_BY_ID } from '../../data/career/themes.js';

/** Débogage : thème `id` tout de suite (ou le suivant tiré). */
export function triggerCareerVariety(host, kind, arg) {
  const api = host._api;
  const { state } = host;
  if (kind !== 'theme') return host.fail('Inconnu.');
  if (!state.variety.parts.themes) return host.fail('Thèmes désactivés.');
  const t = ensureTheme(state);
  if (arg && !THEMES_BY_ID[arg]) return host.fail('Thème inconnu.');
  t.next = arg || drawNextTheme(api);
  const info = startTheme(api);
  if (!info) return host.fail('Aucun thème.');
  api.push('themeStarted', { year: state.time.year, theme: info });
  return { ok: true, theme: info };
}

// ── Récolte à la main d'une culture demandée ───────────────────────────────────────────────────

function harvest(api, { plotIndex, cropId, by }) {
  const { state } = api;
  if (by !== 'player' || !state.variety) return null;
  const preview = claimPreview(state, cropId);
  if (!preview) return null;
  const t = targetFor(state, cropId);
  if (t && hasRoom(state, t.buildingId)) return null; // l'atelier allumé passe d'abord (§ 16.2.4)
  const host = hostOf(api);
  return {
    divert: true,
    sell: true,
    label: preview.label,
    claimed: { kind: preview.kind, id: preview.id, label: preview.label },
    after: () => claimUnits(host, { cropId, units: 1, by: 'player', plotIndex }),
  };
}

// ── Extension ──────────────────────────────────────────────────────────────────────────────────

export const varietyExtension = {
  id: 'variety',
  init(state) {
    if (state.variety) {
      ensureTheme(state);
      state.variety.yearBase = emptyVarietyStats();
    }
  },
  migrate(state) {
    // Carrière d'avant le lot 3 : la variété s'active à la reprise, sans thème pour l'année en cours.
    if (state.variety === undefined && state.rng && typeof state.rng === 'object' && state.career && state.time) {
      migrateToVariety(state);
      state.variety.yearBase = JSON.parse(JSON.stringify(state.variety.stats));
      state.career.theme = { year: state.time.year, id: null, next: null, bag: [], festivalDone: false, visitor: null, history: [] };
    } else if (state.variety) {
      completeVariety(state);
      if (!state.variety.yearBase) state.variety.yearBase = emptyVarietyStats();
      ensureTheme(state);
    }
  },
  check(state) {
    const p = checkVariety(state);
    if (p) return p;
    if (state.variety) return checkTheme(state);
    return null;
  },
  hooks: {
    seasonStart(api, { seasonId }) {
      if (!api.state.variety || seasonId !== 'spring') return;
      const info = startTheme(api);
      if (info) api.push('themeStarted', { year: api.state.time.year, theme: info });
    },
    dawnEvents(api, { weather }) {
      if (!api.state.variety) return;
      const host = hostOf(api);
      for (const [type, payload] of varietyDawn(host, {})) api.push(type, payload);
      for (const [type, payload] of themeDawn(api, { weather })) api.push(type, payload);
    },
    incomes(api, { seasonId, weather }) {
      const { state } = api;
      if (!state.variety || !state.career.theme?.id) return [];
      const base = careerIncomes(state, SEASONS.indexOf(seasonId), weather, false);
      return themeIncomes(api, { incomes: base });
    },
    dawn(api) {
      if (api.state.variety) checkMedals(hostOf(api));
    },
    evening(api, { lastDayOfSeason }) {
      const { state } = api;
      if (!state.variety) return;
      const host = hostOf(api);
      merchantEvening(host);
      if (!lastDayOfSeason || !api.playing()) return;
      const departed = varietyCartEvening(host);
      if (departed) api.push('cartDeparted', departed);
      const judged = judgeChallenges(host);
      if (judged) api.push('challengesJudged', judged);
      const cards = offerCards(host);
      if (cards) api.push('cardsOffered', cards);
      const next = offerChallenges(host);
      if (next) api.push('challengesOffered', next);
    },
    yearEnd(api, { year, report }) {
      const { state } = api;
      if (!state.variety) return;
      report.variety = careerVarietyYear(state);
      state.variety.yearBase = JSON.parse(JSON.stringify(state.variety.stats));
      const id = drawNextTheme(api);
      report.nextTheme = id ? { id, name: THEMES_BY_ID[id].name } : null;
      if (id) api.push('themeAnnounced', { year: year + 1, theme: themeInfo(state, id) });
    },
    harvest,
  },
  providers: {
    priceFactor(state, { kind, id }) {
      if (!state.variety) return 1;
      let f = themePriceFactor(state, { kind, id });
      if (kind === 'crop' || kind === 'stock') f *= posterFactor(state);
      if (kind === 'product') f *= recipeFactor(state);
      return f;
    },
    seedFactor(state, cropId) {
      if (!state.variety) return 1;
      return seedFairFactor(state) * themeSeedFactor(state, cropId);
    },
    extraPlaces(state, buildingId) {
      return state.variety ? themeExtraPlaces(state, buildingId) : 0;
    },
    seasonChargeFactor(state) {
      return state.variety?.cards?.pending?.chargeFactor ?? 1;
    },
  },
  queries: (api) => ({
    theme: () => themeQuery(api.state),
  }),
};

// Enregistrée par src/core/career/extensions.js (après les surprises : ordre des récoltes comptées).
setThemeCalendarProvider(themeCalendar);

export { careerVarietyHost };
