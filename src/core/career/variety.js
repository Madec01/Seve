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
import { isMature, plotWateredRate, wateredRate } from '../farm.js';
import { growthBonus } from '../economy.js';
import { hasRoom, targetFor } from '../processing.js';
import {
  checkMedals, checkVariety, completeVariety, emptyVarietyStats, judgeChallenges, merchantEvening, migrateToVariety,
  offerCards, offerChallenges, varietyCartEvening, varietyDawn,
} from '../variety.js';
import { claimPreview, claimUnits } from '../requests.js';
import { posterFactor, recipeFactor, seedFairFactor, themePriceFactor, themeSeedFactor } from '../variety-effects.js';
import { careerIncomes, getCareerInvestment } from './effects.js';
import { careerNextCost, itemMax, shelterCapacity } from './buildings.js';
import { saleLots } from './land.js';
import { stockUnitPrice } from './storage.js';
import { registerCareerExtension } from './registry.js';
import {
  checkTheme, drawNextTheme, ensureTheme, startTheme, themeCalendar, themeDawn, themeExtraPlaces, themeIncomes, themeInfo, themeQuery,
} from './themes.js';
import { THEMES_BY_ID } from '../../data/career/themes.js';

const count = (state, id) => state.investments[id] || 0;

/** Peut-on poser `n` unités (cadeau, achat au colporteur) ? → null | raison */
function canGiveCareer(state, id, n = 1) {
  const c = state.career;
  if (id === 'hen') {
    const inv = getCareerInvestment('hen');
    if (!inv || (inv.rank ?? 1) > c.rank || !c.buildings.coop) return 'Il faut d\'abord un poulailler.';
    if (shelterCapacity(state, 'coop') - count(state, 'hen') < n) return 'Le poulailler est plein.';
    return null;
  }
  if (id === 'beehive') {
    const inv = getCareerInvestment('beehive');
    if (!inv || (inv.rank ?? 1) > c.rank) return 'Pas encore de ruche à ce rang.';
    if (count(state, 'beehive') + n > itemMax(state, inv)) return 'Plus de place pour une ruche.';
    return null;
  }
  return 'Impossible ici.';
}

/** Champ où l'engrais du colporteur fait le plus d'effet (le plus de cultures pas mûres). */
function bestFieldLot(state) {
  const by = {};
  state.plots.forEach((p) => {
    if (p.env !== 'field' || !p.unlocked || !p.cropId || isMature(p)) return;
    by[p.lot] = (by[p.lot] || 0) + 1;
  });
  let best = null;
  for (const [lot, n] of Object.entries(by)) if (!best || n > best.n) best = { lot, n };
  return best ? best.lot : state.career.lots.find((l) => l.type === 'field')?.id || 'start';
}

/** Hôte de la variété pour une carrière (voir src/core/variety.js). */
export function careerVarietyHost(api) {
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
    earn(key, amount) {
      if (!(amount > 0)) return;
      api.earn(key, amount);
      if (key === 'orders' || key === 'cart') api.repayJoseph(amount, key);
    },
    spend(key, amount, opts) {
      if (!(amount > 0)) return;
      api.spend(key, amount, opts);
    },
    rateFor(plot, tree = false) {
      const si = state.time.seasonIndex;
      if (tree) return 1 + growthBonus(state, si);
      return plot ? plotWateredRate(state, plot, si) : wateredRate(state, si);
    },
    canGive: (id, n) => canGiveCareer(state, id, n),
    giveInvestment(id, n = 1, price = 0) {
      const bad = canGiveCareer(state, id, n);
      if (bad) return api.fail(bad);
      if (price > 0 && state.money < price) return api.fail(api.notEnoughMoney(price - state.money));
      state.investments[id] = count(state, id) + n;
      if (price > 0) {
        if (id === 'hen') {
          const each = Math.round(price / n);
          for (let k = 0; k < n; k++) api.spend('merchant', k === n - 1 ? price - each * (n - 1) : each, { asset: 'animals', log: { kind: 'animal', id: 'hen' } });
        } else api.spend('merchant', price, { asset: 'buildings' });
      }
      api.refreshLevel();
      api.push('purchased', { investmentId: id, owned: state.investments[id], cost: price, gift: price === 0, used: price > 0 });
      return { ok: true };
    },
    nextCost(id) {
      const inv = getCareerInvestment(id);
      return inv ? careerNextCost(state, inv) : null;
    },
    clearingPossible: () => !state.variety?.cards?.pending?.clearingHalf && (state.career.lots.some((l) => l.type === 'wild') || saleLots(state).some((l) => l.buyable)),
    careerFertilizer(arg, item) {
      const lot = typeof arg === 'string' && state.career.lots.some((l) => l.id === arg && l.type === 'field') ? arg : bestFieldLot(state);
      state.career.events.fertilizer = { lotId: lot, left: item.days, growth: item.growth };
    },
    refreshLevel: () => api.refreshLevel(),
    themeCalendar: () => themeCalendar(state),
  };
}

// ── Grenier : livrer une commande, charger la charrette ────────────────────────────────────────

/** Retire n unités du grenier et les paie au prix du jour (poste « stock »). → montant */
function sellFromStock(api, cropId, n) {
  const { state } = api;
  const have = state.career.stock[cropId] || 0;
  const k = Math.min(have, n);
  if (k <= 0) return { amount: 0, count: 0 };
  const amount = stockUnitPrice(state, api.level, cropId) * k;
  state.career.stock[cropId] = have - k;
  if (state.career.stock[cropId] === 0) delete state.career.stock[cropId];
  api.earn('stock', amount);
  api.repayJoseph(amount, 'stock');
  if (state.variety?.season) state.variety.season.sales += amount;
  return { amount, count: k };
}

/** « Livrer depuis le grenier » : les unités au grenier sont vendues au prix du jour et comptées. */
export function careerDeliverOrder(host, orderId) {
  const { state } = host;
  const v = state.variety;
  if (!v.parts.board) return host.fail('Pas de tableau du village.');
  const k = v.board.slots.findIndex((o) => o && o.id === orderId);
  if (k < 0) return host.fail('Commande inconnue.');
  const order = v.board.slots[k];
  const premiumBefore = v.stats.ordersPremium;
  let delivered = 0;
  let amount = 0;
  for (const line of order.lines) {
    const left = line.n - line.got;
    if (left <= 0) continue;
    const sale = sellFromStock(host._api, line.cropId, left);
    if (sale.count <= 0) continue;
    amount += sale.amount;
    delivered += sale.count;
    claimUnits(host, { cropId: line.cropId, units: sale.count, by: 'player', fromStock: true, only: { kind: 'order', slot: k } });
    if (v.board.slots[k] !== order) break;
  }
  if (delivered === 0) return host.fail('Rien au grenier pour cette commande.');
  const done = v.board.slots[k] !== order;
  const premium = v.stats.ordersPremium - premiumBefore;
  return done ? { ok: true, delivered, done, amount, premium } : { ok: true, delivered, done, amount };
}

/** « Charger depuis le grenier » une caisse de la charrette. */
export function careerLoadCart(host, crateIndex) {
  const { state } = host;
  const v = state.variety;
  if (!v.parts.cart || !v.cart) return host.fail('Pas de charrette en ce moment.');
  const crate = v.cart.crates[crateIndex];
  if (!crate) return host.fail('Caisse inconnue.');
  const left = crate.n - crate.got;
  if (left <= 0) return host.fail('Cette caisse est déjà pleine.');
  const sale = sellFromStock(host._api, crate.cropId, left);
  if (sale.count <= 0) return host.fail('Rien au grenier pour cette caisse.');
  claimUnits(host, { cropId: crate.cropId, units: sale.count, by: 'player', fromStock: true, only: { kind: 'crate', index: crateIndex } });
  return { ok: true, loaded: sale.count, full: crate.got >= crate.n, amount: sale.amount };
}

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

// ── Compteurs de l'année (bilan) ───────────────────────────────────────────────────────────────

function diffStats(now, base) {
  const out = {};
  for (const [k, v] of Object.entries(now)) {
    if (typeof v === 'number') out[k] = v - (typeof base?.[k] === 'number' ? base[k] : 0);
    else if (v && typeof v === 'object') out[k] = diffStats(v, base?.[k] || {});
  }
  return out;
}

/** Compteurs de la variété pour l'année en cours (depuis le dernier bilan). */
export function careerVarietyYear(state) {
  const v = state.variety;
  if (!v) return null;
  const d = diffStats(v.stats, v.yearBase || emptyVarietyStats());
  return {
    orderPremium: d.ordersPremium || 0,
    cartPremium: d.cartPremium || 0,
    cardIncome: d.cardIncome || 0,
    medalCoins: d.medalCoins || 0,
    medalEcus: d.medalEcus || 0,
    merchantSpent: d.merchantSpent || 0,
    ordersDone: d.ordersDone || 0,
    carts: d.carts || 0,
    cartsFull: d.cartsFull || 0,
    cratesFull: d.cratesFull || 0,
    medals: { bronze: d.medals?.bronze || 0, silver: d.medals?.silver || 0, gold: d.medals?.gold || 0 },
    rareHarvested: Object.fromEntries(Object.entries(d.rareHarvested || {}).filter(([, n]) => n > 0)),
  };
}

/** Prochain thème (annoncé au bilan) pour le bilan de l'année. */
export function careerNextTheme(state) {
  const id = state.career.theme?.next;
  return id ? { id, name: THEMES_BY_ID[id].name } : null;
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

/** Hôte de la carrière (alias). */
export function hostOf(api) {
  return careerVarietyHost(api);
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

registerCareerExtension(varietyExtension);
