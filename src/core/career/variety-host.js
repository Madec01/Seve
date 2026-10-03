// Mode Carrière — lot 3 « Variété » : l'hôte de carrière de la variété (argent par l'api, postes du bilan, grenier, poules
// et ruches), livraisons depuis le grenier, compteurs de l'année. Pur, SANS enregistrement d'extension : le moteur
// (runtime.js) et game.js l'importent sans changer l'ordre des extensions (celle de la variété, src/core/career/variety.js,
// est chargée par extensions.js après les surprises : la quête de Joseph passe avant le tableau pour les récoltes).

import { isMature, plotWateredRate, wateredRate } from '../farm.js';
import { growthBonus } from '../economy.js';
import { claimUnits } from '../requests.js';
import { emptyVarietyStats } from '../variety.js';
import { getCareerInvestment } from './effects.js';
import { careerNextCost, itemMax, shelterCapacity } from './buildings.js';
import { saleLots } from './land.js';
import { stockUnitPrice } from './storage.js';
import { THEMES_BY_ID } from '../../data/career/themes.js';

let themeCalendarProvider = null;

/** Calendrier du thème (fourni par l'extension de la variété, qui connaît les thèmes). */
export function setThemeCalendarProvider(fn) {
  themeCalendarProvider = fn;
}

/** Hôte de la carrière (alias). */
export function hostOf(api) {
  return careerVarietyHost(api);
}

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
    themeCalendar: () => (themeCalendarProvider ? themeCalendarProvider(state) : []),
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

