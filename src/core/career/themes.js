// Mode Carrière — lot 3 « Variété » : les années à thème (C5). Pur. Règles : docs/GAME_DESIGN.md § 16.6 ;
// données : src/data/career/themes.js ; contrat : docs/ARCHITECTURE.md, « Lot 3 — contrats ».
//
// state.career.theme = { year, id, next, bag, festivalDone, visitor: null | { offerId, done }, history: [{ year, id }],
//                        dairyPlace?, rod? }
//   - tirage au bilan de l'année (flux « variety »), parmi les thèmes possibles au rang, sans répétition tant que
//     tous n'ont pas été vus (bag : thèmes déjà vus dans le cycle) ; annoncé (themeAnnounced), puis commencé au 1er
//     jour du printemps (themeStarted). 1re année : « l'année de l'installation », sans thème ;
//   - fête spéciale (événement festival { theme: true }) ; visiteur unique : une offre `themeVisitor` dans
//     state.career.events.offers (acceptée par acceptOffer, comme les autres offres), qui attend jusqu'à la fin de la
//     saison ; son cadeau est gratuit ;
//   - effets lus ailleurs : src/core/variety-effects.js (prix, graines, géants, heure dorée, fruits, marché).

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { THEME_RULES, THEMES, THEMES_BY_ID } from '../../data/career/themes.js';
import { stream } from '../rng.js';
import { getProduct } from '../../data/products.js';
import { setTree } from '../trees.js';
import { isMature } from '../farm.js';
import { currentTheme, themeFestivalToday, vAbsDay } from '../variety-effects.js';
import { cheerStaff, syncWorkshops } from './staff.js';
import { stockUnitPrice } from './storage.js';

/** Thème vide (année en cours, sans thème). */
export function defaultTheme(year = 1) {
  return { year, id: null, next: null, bag: [], festivalDone: false, visitor: null, history: [] };
}

export function ensureTheme(state) {
  const c = state.career;
  if (!c.theme || typeof c.theme !== 'object') c.theme = defaultTheme(state.time.year);
  const d = defaultTheme(state.time.year);
  for (const [k, v] of Object.entries(d)) if (c.theme[k] === undefined) c.theme[k] = v;
  return c.theme;
}

/** Vérifie state.career.theme. → null | 'problème' */
export function checkTheme(state) {
  const t = state.career.theme;
  if (t === undefined) return null;
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const int = (v) => Number.isInteger(v) && v >= 0;
  if (!obj(t) || !int(t.year)) return 'thème de l\'année';
  if (t.id !== null && !THEMES_BY_ID[t.id]) return 'thème de l\'année';
  if (t.next !== null && !THEMES_BY_ID[t.next]) return 'thème de l\'année';
  if (!Array.isArray(t.bag) || !t.bag.every((id) => THEMES_BY_ID[id])) return 'thème de l\'année';
  if (typeof t.festivalDone !== 'boolean') return 'thème de l\'année';
  if (t.visitor !== null && !(obj(t.visitor) && typeof t.visitor.offerId === 'string' && typeof t.visitor.done === 'boolean')) return 'visiteur du thème';
  if (!Array.isArray(t.history)) return 'thème de l\'année';
  return null;
}

/** Fiche d'un thème (événements, requête). */
export function themeInfo(state, id) {
  const th = THEMES_BY_ID[id];
  if (!th) return null;
  const names = th.star.ids.map((x) => (th.star.kind === 'product' ? getProduct(x)?.name : getCrop(x)?.name) || x);
  return {
    id: th.id,
    name: th.name,
    icon: `icon.theme.${th.id}`,
    text: `Vedette : ${names.join(', ').toLowerCase()} (+25 %).`,
    star: { kind: th.star.kind, ids: [...th.star.ids], names, factor: THEME_RULES.starFactor },
    effects: [...th.effects],
    festival: { name: th.festival.name, seasonId: th.festival.seasonId, day: th.festival.day, text: th.festival.text },
    visitor: { name: th.visitor.name, portrait: `portrait.theme.${th.visitor.id}`, seasonId: th.visitor.seasonId, day: th.visitor.day, text: th.visitor.text },
  };
}

/** Tirage du thème de l'année suivante (bilan de l'année). → id | null */
export function drawNextTheme(api) {
  const { state } = api;
  if (!state.variety?.parts?.themes) return null;
  const t = ensureTheme(state);
  const rank = state.career.rank || 1;
  const possible = THEMES.filter((th) => th.rank <= rank).map((th) => th.id);
  if (!possible.length) return null;
  let pool = possible.filter((id) => !t.bag.includes(id));
  if (!pool.length) {
    t.bag = [];
    pool = possible.filter((id) => id !== t.id);
    if (!pool.length) pool = possible;
  }
  const rng = stream(state.rng, 'variety');
  const id = pool[rng.int(0, pool.length - 1)];
  t.bag.push(id);
  t.next = id;
  return id;
}

/** Début du printemps : le thème annoncé commence. → themeInfo | null */
export function startTheme(api) {
  const { state } = api;
  const t = ensureTheme(state);
  const hadDairy = !!t.dairyPlace;
  t.year = state.time.year;
  t.id = t.next && state.variety?.parts?.themes ? t.next : null;
  t.next = null;
  t.festivalDone = false;
  t.visitor = null;
  delete t.dairyPlace;
  delete t.rod;
  if (hadDairy) syncWorkshops(api);
  if (!t.id) return null;
  t.history.push({ year: t.year, id: t.id });
  return themeInfo(state, t.id);
}

/** Dernier jour absolu de la saison en cours. */
function seasonEnd(state) {
  const L = state.career.seasonLength;
  return (state.time.year - 1) * 4 * L + (state.time.seasonIndex + 1) * L;
}

/** Parcelles des champs plantées et pas mûres (averse, bal des grenouilles). */
function waterFields(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (!p.cropId || !p.unlocked || p.env !== 'field' || p.watered || isMature(p)) return;
    if (isTreeCrop(getCrop(p.cropId))) return;
    p.watered = true;
    out.push(i);
  });
  return out;
}

/**
 * Aube (après la météo) : averse de l'année des grenouilles, fête spéciale, arrivée du visiteur unique.
 * → [[type, payload]]
 */
export function themeDawn(api, { weather }) {
  const { state } = api;
  const th = currentTheme(state);
  const events = [];
  if (!th) return events;
  const t = state.career.theme;
  const sid = SEASONS[state.time.seasonIndex];
  // Averse des grenouilles : les jours nuageux, une chance (flux « variety » ; un tirage seulement ces jours-là).
  if (th.id === 'frogs' && weather === 'cloudy') {
    if (stream(state.rng, 'variety').chance(th.values.showerChance)) {
      const plots = waterFields(state);
      events.push(['themeShower', { plots, text: 'Une petite averse à l\'aube : les champs sont arrosés.' }]);
    }
  }
  // Fête spéciale.
  const fest = themeFestivalToday(state);
  if (fest && !t.festivalDone) {
    t.festivalDone = true;
    if (th.id === 'frogs') waterFields(state);
    if (th.id === 'lights') cheerStaff(api);
    events.push(['festival', { id: `theme.${th.id}`, name: th.festival.name, text: th.festival.text, icon: `fair.theme.${th.id}`, seasonId: th.festival.seasonId, day: th.festival.day, theme: true, themeId: th.id }]);
  }
  // Visiteur unique.
  if (!t.visitor && th.visitor.seasonId === sid && th.visitor.day === state.time.dayOfSeason) {
    const e = state.career.events;
    const today = vAbsDay(state);
    const offer = { id: `offer${e.nextOfferId++}`, kind: 'themeVisitor', day: today, endDay: seasonEnd(state), accepted: false, delivered: 0, data: { themeId: th.id, visitorId: th.visitor.id, name: th.visitor.name, text: th.visitor.text, gift: th.visitor.gift } };
    e.offers.push(offer);
    t.visitor = { offerId: offer.id, done: false };
    events.push(['offer', { offerId: offer.id, kind: 'themeVisitor', data: themeOfferInfo(state, offer) }]);
  }
  return events;
}

/** Revenus du thème à l'aube (abeilles, chambre d'hôte, nuit des lampions). → [{ source, amount, kind, key }] */
export function themeIncomes(api, { incomes = [] } = {}) {
  const { state } = api;
  const th = currentTheme(state);
  if (!th) return [];
  const out = [];
  const fest = themeFestivalToday(state);
  if (th.id === 'bees') {
    const honey = incomes.filter((i) => i.source === 'beehive').reduce((s, i) => s + i.amount, 0);
    const extra = Math.round(honey * (th.values.hiveIncome - 1) + (fest ? honey * (th.values.festivalHives - 1) : 0));
    if (extra > 0) out.push({ source: 'themeBees', amount: extra, kind: 'theme', key: 'honey' });
  }
  if (th.id === 'tourism') {
    const guests = incomes.filter((i) => i.source === 'guestHouse').reduce((s, i) => s + i.amount, 0);
    const extra = Math.round(guests * (th.values.guestHouse - 1) + (fest ? guests * th.values.guestHouse * (th.values.festivalGuests - 1) : 0));
    if (extra > 0) out.push({ source: 'themeGuests', amount: extra, kind: 'theme', key: 'guests' });
    if (fest) out.push({ source: 'themeLanterns', amount: Math.round(th.values.festivalPasses * 5 * th.values.touristPass), kind: 'theme', key: 'visitors' });
  }
  return out;
}

/** Fiche de l'offre du visiteur unique (comme offerInfo des autres offres). */
export function themeOfferInfo(state, offer) {
  const d = offer.data;
  const today = vAbsDay(state);
  return {
    id: offer.id,
    kind: 'themeVisitor',
    accepted: offer.accepted,
    daysLeft: Math.max(0, offer.endDay - today),
    endDay: offer.endDay,
    data: JSON.parse(JSON.stringify(d)),
    title: d.name,
    icon: `portrait.theme.${d.visitorId}`,
    portrait: `portrait.theme.${d.visitorId}`,
    text: d.text,
    detail: 'Un cadeau, sans rien demander en échange : il vous attend jusqu\'à la fin de la saison.',
    acceptLabel: d.gift === 'wholesale' ? 'Vendre le grenier' : 'Accepter le cadeau',
    declineLabel: 'Plus tard',
  };
}

function freeOrchardPlot(state) {
  return state.plots.findIndex((p) => p.env === 'orchard' && p.unlocked && !p.cropId);
}

/**
 * Accepte le cadeau du visiteur unique. ctx = { canGiveHive(), giveHive(), earn(key, amount) }.
 * → { ok, gift } | { ok: false, reason } (le grossiste sans grenier : l'offre reste).
 */
export function acceptThemeVisitor(api, offer, ctx) {
  const { state } = api;
  const th = THEMES_BY_ID[offer.data.themeId];
  if (!th) return api.fail('Ce visiteur est reparti.');
  const v = th.values;
  const t = ensureTheme(state);
  const gift = { kind: th.visitor.gift };
  switch (th.visitor.gift) {
    case 'hive':
      if (ctx.canGiveHive()) {
        ctx.giveHive();
        gift.investmentId = 'beehive';
        gift.n = 1;
      } else {
        api.earn('other', v.giftCoins);
        gift.coins = v.giftCoins;
      }
      break;
    case 'dairyPlace':
      if (state.career.buildings.dairy) {
        t.dairyPlace = true;
        syncWorkshops(api);
        gift.dairyPlace = 1;
      } else {
        api.earn('other', v.giftCoins);
        gift.coins = v.giftCoins;
      }
      break;
    case 'magazine':
      gift.ecus = v.giftEcus;
      gift.cosmeticId = v.cosmeticId;
      gift.ecusIfOwned = 5;
      break;
    case 'pumpkinSeeds':
    case 'wheatSeeds': {
      const cropId = th.visitor.gift === 'pumpkinSeeds' ? 'pumpkin' : 'wheat';
      state.variety.freeSows[cropId] = (state.variety.freeSows[cropId] || 0) + v.freeSows;
      gift.freeSows = { cropId, n: v.freeSows };
      if (v.giftCoins) {
        api.earn('other', v.giftCoins);
        gift.coins = v.giftCoins;
      }
      break;
    }
    case 'rod':
      if (state.career.lots.some((l) => l.type === 'pond')) {
        t.rod = true;
        gift.rod = true;
      } else {
        api.earn('other', v.giftCoins);
        gift.coins = v.giftCoins;
      }
      break;
    case 'tree': {
      const i = freeOrchardPlot(state);
      if (i >= 0) {
        setTree(state, state.plots[i], 'apple', true);
        gift.tree = { plotIndex: i };
        api.refreshLevel();
      } else {
        api.earn('other', v.giftCoins);
        gift.coins = v.giftCoins;
      }
      break;
    }
    case 'wholesale': {
      const ids = Object.keys(state.career.stock || {});
      if (!ids.length) return api.fail('Rien au grenier pour le grossiste : revenez avant la fin de la saison.');
      let amount = 0;
      let count = 0;
      const lines = [];
      for (const id of ids) {
        const n = state.career.stock[id];
        const each = Math.round(stockUnitPrice(state, api.level, id) * v.wholesale);
        amount += each * n;
        count += n;
        lines.push({ cropId: id, count: n, amount: each * n });
        delete state.career.stock[id];
      }
      api.earn('stock', amount);
      api.push('stockSold', { amount, count, reason: 'wholesaler', lines });
      api.repayJoseph(amount, 'stock');
      gift.amount = amount;
      gift.count = count;
      break;
    }
    case 'leekSeeds':
      state.variety.rare.leek = (state.variety.rare.leek || 0) + v.rareSeeds;
      gift.rare = { cropId: 'leek', n: v.rareSeeds };
      gift.ecus = v.giftEcus;
      break;
    default:
      break;
  }
  if (t.visitor && t.visitor.offerId === offer.id) t.visitor.done = true;
  return { ok: true, gift };
}

/** Pêche : × 1,5 avec la canne de Firmin. */
export function themeFishFactor(state) {
  return currentTheme(state)?.id === 'frogs' && state.career.theme?.rod ? THEMES_BY_ID.frogs.values.fishFactor : 1;
}

/** Fromagerie : +1 place (visiteur de l'année du fromage). */
export function themeExtraPlaces(state, buildingId) {
  return buildingId === 'dairy' && currentTheme(state)?.id === 'cheese' && state.career.theme?.dairyPlace ? 1 : 0;
}

/** Touristes : poids et gain par passage ; corbeaux : poids (événements au hasard). */
export function themeEventWeight(state, id) {
  const th = currentTheme(state);
  if (!th) return 1;
  if (id === 'tourists' && th.id === 'tourism') return th.values.touristWeight;
  if (id === 'crows' && th.id === 'frogs') return th.values.crowWeight;
  return 1;
}

export function themeTouristPass(state) {
  return currentTheme(state)?.id === 'tourism' ? THEMES_BY_ID.tourism.values.touristPass : 1;
}

/** Entrées du calendrier (Agenda, query.variety().calendar) : fête et visiteur du thème. */
export function themeCalendar(state) {
  const th = currentTheme(state);
  if (!th) return [];
  const L = state.career.seasonLength;
  const nowDay = state.time.seasonIndex * L + state.time.dayOfSeason;
  const at = (seasonId, day) => SEASONS.indexOf(seasonId) * L + day;
  const out = [];
  const f = at(th.festival.seasonId, th.festival.day);
  if (f >= nowDay && !state.career.theme.festivalDone) out.push({ kind: 'themeFestival', day: f, daysUntil: f - nowDay, text: `${th.festival.name} : ${th.festival.text}` });
  const vday = at(th.visitor.seasonId, th.visitor.day);
  if (vday >= nowDay && !state.career.theme.visitor) out.push({ kind: 'themeVisitor', day: vday, daysUntil: vday - nowDay, text: `${th.visitor.name} passera.` });
  return out;
}

/** Requête query.career.theme(). */
export function themeQuery(state) {
  if (!state.variety?.parts?.themes) return null;
  const t = state.career.theme;
  if (!t) return null;
  const L = state.career.seasonLength;
  const nowDay = state.time.seasonIndex * L + state.time.dayOfSeason;
  const at = (seasonId, day) => SEASONS.indexOf(seasonId) * L + day;
  const next = t.next ? { id: t.next, name: THEMES_BY_ID[t.next].name } : null;
  const th = currentTheme(state);
  if (!th) return { year: state.time.year, id: null, name: THEME_RULES.installName, icon: 'icon.theme', text: '', star: null, effects: [], festival: null, visitor: null, next };
  const info = themeInfo(state, th.id);
  const f = at(th.festival.seasonId, th.festival.day);
  const vd = at(th.visitor.seasonId, th.visitor.day);
  return {
    year: t.year,
    id: th.id,
    name: th.name,
    icon: info.icon,
    text: info.text,
    star: info.star,
    effects: info.effects,
    festival: { ...info.festival, daysUntil: Math.max(0, f - nowDay), done: t.festivalDone || f < nowDay },
    visitor: { ...info.visitor, done: !!t.visitor?.done, offerId: t.visitor?.offerId ?? null, daysUntil: Math.max(0, vd - nowDay) },
    next,
  };
}
