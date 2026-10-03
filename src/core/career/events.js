// Mode Carrière — événements vivants (lot CORE-C, pur). Conception : docs/CARRIERE.md § 8.1, § 8.2, § 10.9 ;
// données : src/data/career/events.js ; contrat : docs/ARCHITECTURE.md, « Mode Carrière — livraison CORE-C ».
//
// Extension enregistrée (id 'events') sur les points d'accroche de src/core/career/registry.js :
//   - calendrier des fêtes : fournisseurs priceFactor (fête du village, fête des récoltes, marché de Noël) et
//     seedFactor (foire aux semis) ; chambre d'hôte × 2 le jour de la fête du village (incomes) ;
//     state.career.events.today = id de la fête du jour (lu par CORE-B : employés joyeux, vendeur) ;
//   - comice agricole : annoncé le 1er jour d'été (seasonStart), jugé le soir du dernier jour d'automne
//     (evening, avant les charges) ; prix versés (poste « contest »), lifetime.contestsWon ;
//   - événements au hasard (dawnEvents) : visiteur acheteur, touristes, corbeaux, arc-en-ciel, rosée,
//     marchand ambulant, animal perdu, cadeau de Joseph ; offres (acceptOffer / declineOffer / deliverOffer),
//     récoltes mises de côté pour un visiteur (harvest) ;
//   - corbeaux (chaseCrow ; non chassé à l'aube suivante → plot.crowPenalty) ; pêche (fish, une fois par jour).
// Aucun événement ne détruit une culture, un animal ou un bâtiment. Tous les tirages : flux « events ».

import { agree, countNoun, nounPlural } from '../../data/french.js';
import { DAY_SECONDS, SEASONS } from '../../data/balance.js';
import { CROPS, getCrop, isTreeCrop } from '../../data/crops.js';
import { BUILDINGS_BY_ID, WORKSHOPS } from '../../data/career/buildings.js';
import {
  CALENDAR_EVENTS, CALENDAR_EVENTS_BY_ID, CONTEST, CONTEST_GOAL_POOL, CROWS, DEW, FISH, JOSEPH_GIFT, MERCHANT_ITEMS, PETS,
  RAINBOW, RANDOM_EVENTS, RANDOM_EVENTS_BY_ID, RANDOM_EVENT_RULES, TOURISTS, TRUFFLE_CHANCE_HINT, VISITOR,
} from '../../data/career/events.js';
import { buildingLevelData, getCareerInvestment } from './effects.js';
import { itemMax, shelterCapacity, storageCapacity } from './buildings.js';
import { careerFlag, providedSum, registerCareerExtension } from './registry.js';
import { crowWeightFactor, fishFactor } from './heirlooms.js';
import { isMature } from '../farm.js';
import { stockUsed } from './storage.js';
import { cheerStaff } from './staff.js';
import { foxActive } from '../surprises.js';
import { themeFestivalToday } from '../variety-effects.js';
import { acceptThemeVisitor, themeCalendar, themeEventWeight, themeFishFactor, themeOfferInfo, themeTouristPass } from './themes.js';
import { MERCHANT } from '../../data/variety.js';
import { STAND_COMICE } from '../../data/cozy.js';
import { helpersOn } from './handwork.js';

// ── Dates ───────────────────────────────────────────────────────────────────────────────────────

/** Jour absolu de la carrière (1 = 1er jour de l'année 1) : sert aux échéances des offres et quêtes. */
export function dayIndex(state) {
  const L = state.career.seasonLength;
  return (state.time.year - 1) * 4 * L + state.time.day;
}

/** Jour absolu du dernier jour de la saison en cours. */
export function seasonEndIndex(state) {
  const L = state.career.seasonLength;
  return (state.time.year - 1) * 4 * L + (state.time.seasonIndex + 1) * L;
}

/** Jour de la saison d'une fête du calendrier (lot 4 : 'last' = dernier jour de la saison). */
export function festivalDay(state, f) {
  return f.day === 'last' ? state.career.seasonLength : f.day;
}

/** Fête du calendrier à une date (saison, jour de la saison), si le rang la permet ; sinon null. */
export function festivalAt(state, seasonIndex, dayOfSeason) {
  const sid = SEASONS[seasonIndex];
  const rank = state.career?.rank || 1;
  return CALENDAR_EVENTS.find((e) => e.seasonId === sid && festivalDay(state, e) === dayOfSeason && e.rank <= rank) || null;
}

/** Facteurs de prix d'une fête (lot 4 : le marché de Noël dès le rang 1, ses facteurs au rang 2 : factorsRank). */
function festivalFactors(state, f) {
  if (!f) return null;
  return (f.factorsRank ?? 0) <= (state.career?.rank || 1) ? f.factors : null;
}

/** Fête du jour (données de CALENDAR_EVENTS) ou null. */
export function festivalToday(state) {
  if (!state || state.mode !== 'career' || !state.career) return null;
  return festivalAt(state, state.time.seasonIndex, state.time.dayOfSeason);
}

/** Fête de demain (bandeau « la veille »). */
export function festivalTomorrow(state) {
  const L = state.career.seasonLength;
  let si = state.time.seasonIndex;
  let d = state.time.dayOfSeason + 1;
  if (d > L) {
    d = 1;
    si = (si + 1) % 4;
  }
  return festivalAt(state, si, d);
}

// ── Petits outils ───────────────────────────────────────────────────────────────────────────────

const ev = (state) => state.career.events;
const count = (state, id) => state.investments[id] || 0;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));

/** Prix « de base » d'une récolte en carrière (prix × difficulté, sans le cours ni les bonus). */
export function baseCropPrice(api, cropId) {
  const crop = getCrop(cropId);
  return crop ? crop.sellPrice * (api.level.cropPriceFactor ?? 1) : 0;
}

/** Cultures du rang (hors arbres) qu'on peut semer aujourd'hui (hors serre). */
function seasonalCrops(api) {
  const sid = api.seasonId();
  return api.crops.filter((c) => !isTreeCrop(c) && c.seasons.includes(sid));
}

function pickWeighted(rng, items, weightOf) {
  const weights = {};
  items.forEach((it, k) => {
    const w = weightOf(it);
    if (w > 0) weights[k] = w;
  });
  if (!Object.keys(weights).length) return null;
  return items[Number(rng.weighted(weights))];
}

function shuffleTake(rng, list, n) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function yearCounters() {
  return { visitors: 0, visitorIncome: 0, tourists: 0, touristIncome: 0, crowsChased: 0, crowsMissed: 0, fish: 0, fishIncome: 0, gifts: 0, events: 0 };
}

/** Champs de state.career.events en plus du contrat (valeurs par défaut). */
export function eventsDefaults() {
  return { active: null, offers: [], calendarDone: [], fishedDay: 0, lastKind: null, today: null, nextOfferId: 1, eggs: 0, eggSeen: {}, fertilizer: null, year: yearCounters() };
}

// ── Comice agricole ─────────────────────────────────────────────────────────────────────────────

function goalTarget(goal, rank) {
  return goal.target.base + goal.target.perRank * rank;
}

function treeCropIds() {
  return CROPS.filter((c) => isTreeCrop(c)).map((c) => c.id);
}

/** Compteur (cumulé) d'une épreuve, pour la progression depuis l'annonce. */
function goalCounter(state, goal) {
  const year = state.stats.year;
  // (lot 4, F1-5) « Le jury veut voir le travail du fermier » : seules les récoltes à la main comptent.
  const hand = helpersOn(state);
  switch (goal.type) {
    case 'harvest': {
      const ids = goal.tree ? treeCropIds() : goal.cropIds;
      const book = hand ? state.cozy.stats.handCrops || {} : year.cropsHarvested;
      return ids.reduce((n, id) => n + (book[id] || 0), 0);
    }
    case 'harvests':
      return (hand ? state.career.lifetime.handPicked : state.career.lifetime.harvests) || 0;
    case 'productsSold': {
      const sold = year.productsSold || {};
      const ids = goal.productIds || Object.keys(sold);
      return ids.reduce((n, id) => n + (sold[id] || 0), 0);
    }
    case 'eggs':
      return ev(state).eggs || 0;
    case 'truffles':
      return state.career.lifetime.truffles || 0;
    case 'stock':
      return stockUsed(state);
    default:
      return 0;
  }
}

/** Progression d'une épreuve du comice de l'année. */
export function contestGoalProgress(state, goal) {
  if (goal.type === 'stock') return stockUsed(state);
  return Math.max(0, goalCounter(state, goal) - (goal.base || 0));
}

/** true si l'épreuve peut être tirée avec la ferme du joueur (« seules des épreuves possibles »). */
export function contestGoalPossible(api, goal, rank) {
  const { state } = api;
  const c = state.career;
  const target = goalTarget(goal, rank);
  const L = c.seasonLength;
  switch (goal.needs) {
    case null:
    case undefined:
      return true;
    case 'pumpkin':
      return api.crops.some((cr) => cr.id === 'pumpkin');
    case 'workshop':
      return WORKSHOPS.some((id) => c.buildings[id]);
    case 'cheese':
      return !!c.buildings.dairy && count(state, 'cow') + count(state, 'goat') > 0;
    case 'trees':
      return state.plots.filter((p) => p.cropId && isTreeCrop(getCrop(p.cropId))).length >= 2;
    case 'eggs':
      return eggsCountable() && (count(state, 'hen') + count(state, 'duck')) * 2 * L >= target;
    case 'pigs':
      return count(state, 'pig') * L * TRUFFLE_CHANCE_HINT >= target * 1.5;
    case 'storage':
      return storageCapacity(state) >= Math.ceil(target * 1.5); // de la marge : le vendeur vend au bon cours
    default:
      return false;
  }
}

/** Prix d'une épreuve réussie pour le comice (rang de l'annonce ; × 2 au Domaine). */
export function contestPrizePerGoal(rank) {
  return CONTEST.prizePerRank * rank * (rank >= CONTEST.domaineRank ? CONTEST.domaineFactor : 1);
}

function announceContest(api) {
  const { state } = api;
  const c = state.career;
  const rank = c.rank;
  const rng = api.rng('events');
  const possible = CONTEST_GOAL_POOL.filter((g) => contestGoalPossible(api, g, rank));
  const picked = shuffleTake(rng, possible, CONTEST.goals);
  const goals = picked.map((g) => {
    const target = goalTarget(g, rank);
    const goal = { id: g.id, type: g.type, label: fill(g.label, { n: target }), target, notified: false };
    if (g.cropIds) goal.cropIds = [...g.cropIds];
    if (g.productIds) goal.productIds = [...g.productIds];
    if (g.tree) goal.tree = true;
    goal.base = g.type === 'stock' ? 0 : goalCounter(state, goal);
    return goal;
  });
  const L = c.seasonLength;
  c.contest = {
    year: state.time.year,
    rank,
    goals,
    judgeDay: (state.time.year - 1) * 4 * L + 3 * L, // soir du dernier jour d'automne
    prizePerGoal: contestPrizePerGoal(rank),
    judged: false,
    result: null,
  };
  api.push('contestAnnounced', { career: true, year: state.time.year, goals: contestInfo(state).goals, prizePerGoal: c.contest.prizePerGoal });
}

function notifyContest(api) {
  const k = api.state.career.contest;
  if (!k || k.judged) return;
  for (const g of k.goals) {
    const progress = contestGoalProgress(api.state, g);
    if (!g.notified && progress >= g.target) {
      g.notified = true;
      api.push('contestProgress', { career: true, goalId: g.id, label: g.label, progress, target: g.target, done: true });
    }
  }
}

function judgeContest(api) {
  const { state } = api;
  const c = state.career;
  const k = c.contest;
  const goals = k.goals.map((g) => {
    const progress = contestGoalProgress(state, g);
    return { id: g.id, label: g.label, target: g.target, progress, done: progress >= g.target };
  });
  const goalsMet = goals.filter((g) => g.done).map((g) => g.id);
  const all = goals.length === CONTEST.goals && goalsMet.length === goals.length;
  // (lot 4) Le stand de la fête des récoltes, présenté de nouveau au comice : + 25 % (ruban bleu) / + 50 % (rosette
  // d'or) du prix d'une épreuve.
  const stand = state.cozy?.stand && state.cozy.stand.year === k.year ? state.cozy.stand : null;
  const standBonus = stand ? Math.round(k.prizePerGoal * (STAND_COMICE[stand.ribbon] || 0)) : 0;
  const amount = k.prizePerGoal * goalsMet.length + (all ? k.prizePerGoal * CONTEST.bonusAllGoals : 0) + standBonus;
  k.judged = true;
  k.result = { goalsMet, amount, all, goals, ...(stand ? { standBonus, ribbon: stand.ribbon } : {}) };
  if (amount > 0) api.earn('contest', amount);
  if (all) c.lifetime.contestsWon = (c.lifetime.contestsWon || 0) + 1;
  api.push('contestAwarded', { career: true, year: k.year, amount, goalsMet, goals, all, contestsWon: c.lifetime.contestsWon, ...(state.cozy ? { standBonus, ribbon: stand ? stand.ribbon : null } : {}) });
}

/** Comice de l'année pour l'interface (forme proche de query.contest() v3). */
export function contestInfo(state) {
  const k = state.career.contest;
  if (!k) return null;
  const goals = k.judged && k.result
    ? k.result.goals.map((g) => ({ ...g }))
    : k.goals.map((g) => {
        const progress = contestGoalProgress(state, g);
        return { id: g.id, label: g.label, target: g.target, progress, done: progress >= g.target };
      });
  const today = dayIndex(state);
  return {
    name: CONTEST.name,
    year: k.year,
    rank: k.rank,
    goals,
    prizePerGoal: k.prizePerGoal,
    bonusAll: k.prizePerGoal * CONTEST.bonusAllGoals,
    maxPrize: k.prizePerGoal * (goals.length + (goals.length === CONTEST.goals ? CONTEST.bonusAllGoals : 0)),
    daysLeft: k.judged ? 0 : Math.max(0, k.judgeDay - today),
    judged: k.judged,
    result: k.result ? { goalsMet: [...k.result.goalsMet], amount: k.result.amount, all: k.result.all } : null,
  };
}

// ── Œufs ramassés ──────────────────────────────────────────────────────────────────────────────
// Les œufs se ramassent (abris : lot CORE-B, drapeau collectAnimals) : on observe la valeur en attente des
// abris à œufs (poulailler, mare) à chaque aube (avant et après la production du jour) et à chaque tranche de
// la journée ; une baisse = un ramassage (joueur, soigneur ou collecteur). 1 œuf = la production d'un animal
// pour un jour. Sans ramassage (pas de lot CORE-B), les œufs ne se comptent pas (épreuve et quête retirées).

const EGG_SHELTERS = ['coop', 'duckPond'];

function observeEggs(state) {
  if (!careerFlag('collectAnimals')) return;
  const e = ev(state);
  const seen = e.eggSeen || (e.eggSeen = {});
  const sid = SEASONS[state.time.seasonIndex];
  for (const id of EGG_SHELTERS) {
    const b = state.career.buildings[id];
    const cur = b ? b.pending || 0 : 0;
    const last = seen[id] || 0;
    if (cur < last - 1e-9) {
      const inv = getCareerInvestment(BUILDINGS_BY_ID[id].animal);
      const per = inv?.income?.[sid] || Math.max(1, ...Object.values(inv?.income || { x: 1 }));
      e.eggs = (e.eggs || 0) + Math.round((last - cur) / Math.max(0.5, per));
    }
    seen[id] = cur;
  }
}

/** true si les œufs se comptent (ramassage des abris : lot CORE-B). */
export function eggsCountable() {
  return careerFlag('collectAnimals');
}

// ── Événements au hasard ────────────────────────────────────────────────────────────────────────

function attractiveness(state) {
  const c = state.career;
  let a = 0;
  if (c.buildings.guestHouse) a += 1;
  if (count(state, 'horse') > 0) a += 1;
  if (c.lots.some((l) => l.type === 'pond')) a += 1;
  return a;
}

function fieldCrops(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (p.env === 'field' && p.unlocked && p.cropId && !isTreeCrop(getCrop(p.cropId))) out.push(i);
  });
  return out;
}

function merchantItems(api) {
  const { state } = api;
  const c = state.career;
  return MERCHANT_ITEMS.filter((item) => {
    if (item.id === 'fertilizer') return !ev(state).fertilizer && fieldCrops(state).some((i) => !isMature(state.plots[i]));
    if (item.id === 'hens') {
      const hen = getCareerInvestment('hen');
      return !!hen && (hen.rank ?? 1) <= c.rank && !!c.buildings.coop && shelterCapacity(state, 'coop') - count(state, 'hen') >= item.count;
    }
    if (item.id === 'beehive') {
      const inv = getCareerInvestment('beehive');
      return !!inv && (inv.rank ?? 1) <= c.rank && count(state, 'beehive') < itemMax(state, inv);
    }
    return false;
  });
}

function nextPet(state) {
  return PETS.find((p) => !state.career.pets?.[p.id]) || null;
}

/** Conditions de chaque événement au hasard (§ 8.2). */
function eventPossible(api, id, { seasonId, weather }) {
  const { state } = api;
  const c = state.career;
  switch (id) {
    case 'visitor':
      // (lot 3) Remplacé par le tableau du village quand il est actif (poids 0).
      if (state.variety?.parts?.board) return false;
      // Une seule commande à la fois (et une quête de Joseph au plus : § 8.3).
      return !c.events.offers.some((o) => o.kind === 'visitor') && visitorCrops(api).length > 0;
    case 'tourists':
      return attractiveness(state) > 0;
    case 'crows': {
      if (seasonId === 'winter' || foxActive(state)) return false; // (lot 2) le renard éloigne les corbeaux
      const sown = fieldCrops(state);
      return sown.length >= CROWS.minSown && sown.some((i) => !isMature(state.plots[i]) && !state.plots[i].crow);
    }
    case 'rainbow':
      return seasonId !== 'winter' && RAINBOW.after.includes(state.lastDawn?.weather);
    case 'dew':
      return DEW.seasons.includes(seasonId) && !DEW.notOn.includes(weather) && fieldCrops(state).some((i) => !isMature(state.plots[i]) && !state.plots[i].watered);
    case 'merchant':
      // (lot 3) Remplacé par Basile le colporteur, à date fixe (poids 0).
      if (state.variety?.parts?.merchant) return false;
      return c.rank >= 2 && merchantItems(api).length > 0;
    case 'lostPet':
      return !!nextPet(state);
    case 'josephGift':
      return (c.joseph?.hearts || 0) >= JOSEPH_GIFT.hearts;
    default:
      return false;
  }
}

/** Durée d'une commande de visiteur (jours). */
export function visitorDays(state) {
  return Math.max(VISITOR.days, Math.round(state.career.seasonLength * VISITOR.seasonShare));
}

/** Cultures qu'un visiteur peut commander : de saison, et qu'on peut avoir à temps (grenier, déjà semée, pousse courte). */
function visitorCrops(api) {
  const { state } = api;
  const days = visitorDays(state);
  const growing = new Set(fieldCrops(state).map((i) => state.plots[i].cropId));
  return seasonalCrops(api).filter((cr) => cr.growDays <= days - 1 || growing.has(cr.id) || (state.career.stock[cr.id] || 0) > 0);
}

function newOffer(api, kind, data, days) {
  const e = ev(api.state);
  const today = dayIndex(api.state);
  const offer = { id: `offer${e.nextOfferId++}`, kind, day: today, endDay: today + days - 1, accepted: false, delivered: 0, data };
  e.offers.push(offer);
  return offer;
}

function startEvent(api, id, ctx) {
  const { state } = api;
  const e = ev(state);
  const rng = api.rng('events');
  const today = dayIndex(state);
  const def = RANDOM_EVENTS_BY_ID[id];
  const active = { id, kind: id, day: today, endDay: today, data: {} };
  let offer = null;
  switch (id) {
    case 'visitor': {
      const crops = visitorCrops(api);
      const growing = {};
      for (const i of fieldCrops(state)) growing[state.plots[i].cropId] = (growing[state.plots[i].cropId] || 0) + 1;
      const crop = pickWeighted(rng, crops, (cr) => 1 + 3 * (growing[cr.id] || 0) + (state.career.stock[cr.id] || 0));
      const range = crop.sellPrice >= VISITOR.expensivePrice ? VISITOR.countExpensive : VISITOR.count;
      const n = rng.int(range[0], range[1]);
      const name = VISITOR.names[rng.int(0, VISITOR.names.length - 1)];
      const basePrice = baseCropPrice(api, crop.id);
      const unitPrice = Math.round(basePrice * VISITOR.factor);
      offer = newOffer(api, 'visitor', { name, cropId: crop.id, cropName: crop.name, n, unitPrice, basePrice, total: unitPrice * n, factor: VISITOR.factor }, visitorDays(state));
      active.endDay = offer.endDay;
      active.data = { offerId: offer.id, name, cropId: crop.id, n };
      break;
    }
    case 'tourists': {
      const a = attractiveness(state);
      // (lot 3) Boom touristique : + 50 % par passage.
      // (Vallée vivante) Paon-du-jour installé : + 15 % par passage (fournisseur effects 'touristBonus').
      const vt = state.career.valley ? 1 + providedSum('effects', state, 'touristBonus') : 1;
      active.data = { perPass: Math.round(TOURISTS.perPass * (1 + a) * themeTouristPass(state) * vt), passes: TOURISTS.passes.length, done: 0, attractiveness: a };
      break;
    }
    case 'crows': {
      const candidates = fieldCrops(state).filter((i) => !isMature(state.plots[i]) && !state.plots[i].crow);
      const n = Math.min(candidates.length, rng.int(CROWS.count[0], CROWS.count[1]));
      const plots = shuffleTake(rng, candidates, n).sort((a, b) => a - b);
      for (const i of plots) state.plots[i].crow = true;
      active.data = { plots };
      api.push('crow', { plots: [...plots], text: plots.length === 1 ? 'Un corbeau dans les champs : touchez-le pour le chasser.' : `${plots.length} corbeaux dans les champs : touchez-les pour les chasser.` });
      break;
    }
    case 'rainbow':
      active.data = { growthBonus: RAINBOW.growthBonus };
      break;
    case 'dew': {
      const plots = fieldCrops(state).filter((i) => !isMature(state.plots[i]) && !state.plots[i].watered);
      for (const i of plots) state.plots[i].watered = true;
      active.data = { plots };
      break;
    }
    case 'merchant': {
      const item = pickWeighted(rng, merchantItems(api), (it) => it.weight || 1);
      offer = newOffer(api, 'merchant', { itemId: item.id, name: item.name, price: item.price, text: item.text }, 1);
      active.data = { offerId: offer.id, itemId: item.id };
      break;
    }
    case 'lostPet': {
      const pet = nextPet(state);
      offer = newOffer(api, 'pet', { petId: pet.id, name: pet.name, text: pet.text }, 1);
      active.data = { offerId: offer.id, petId: pet.id };
      break;
    }
    case 'josephGift':
      active.data = josephGift(api);
      e.year.gifts += 1;
      break;
    default:
      return;
  }
  e.active = active;
  e.lastKind = id;
  e.year.events += 1;
  api.push('careerEvent', { id, kind: id, name: def.name, icon: def.icon, text: eventText(state, active), data: JSON.parse(JSON.stringify(active.data)) });
  if (offer) api.push('offer', { offerId: offer.id, kind: offer.kind, data: offerInfo(state, offer) });
  void ctx;
}

/** Cadeau de Joseph : il sème des parcelles vides (graines offertes), sinon quelques pièces. */
function josephGift(api) {
  const { state } = api;
  const empty = [];
  state.plots.forEach((p, i) => {
    if (p.env === 'field' && p.unlocked && !p.cropId) empty.push(i);
  });
  const crops = seasonalCrops(api).filter((cr) => cr.growDays <= api.state.career.seasonLength);
  if (empty.length && crops.length) {
    const crop = crops.reduce((a, b) => (api.seedCost(b.id) < api.seedCost(a.id) ? b : a));
    const plots = [];
    for (const i of empty.slice(0, JOSEPH_GIFT.seeds)) {
      const cost = api.seedCost(crop.id);
      api.earn('other', cost); // les graines sont offertes : Joseph les paie
      if (api.plant(i, crop.id, { by: 'joseph' }).ok) plots.push(i);
      else api.changeMoney(-cost);
    }
    if (plots.length) return { gift: 'seeds', cropId: crop.id, cropName: crop.name, n: plots.length, plots };
  }
  api.earn('other', JOSEPH_GIFT.coins);
  return { gift: 'coins', amount: JOSEPH_GIFT.coins };
}

function eventText(state, active) {
  const d = active.data || {};
  switch (active.kind) {
    case 'visitor':
      return `${capital(d.name)} voudrait ${d.n} ${cropPlural(d.cropId, d.n)}, ${agree(cropPlural(d.cropId, d.n), d.n, 'payé')} × ${String(VISITOR.factor).replace('.', ',')}.`;
    case 'tourists':
      return `Des touristes se promènent sur la route : +${d.perPass} pièces à chaque passage.`;
    case 'crows':
      return `${d.plots.length === 1 ? 'Un corbeau s\'est posé' : `${d.plots.length} corbeaux se sont posés`} dans les champs : touchez pour ${d.plots.length === 1 ? 'le' : 'les'} chasser !`;
    case 'rainbow':
      return 'Un arc-en-ciel après la pluie : tout pousse 10 % plus vite aujourd\'hui.';
    case 'dew':
      return 'Rosée du matin : tous les champs sont arrosés.';
    case 'merchant':
      return `Un marchand ambulant passe : ${lowerFirst(MERCHANT_ITEMS.find((m) => m.id === d.itemId)?.text || '')}`;
    case 'lostPet':
      return PETS.find((p) => p.id === d.petId)?.text || '';
    case 'josephGift':
      return d.gift === 'seeds' ? `Joseph vous a semé ${countNoun(d.n, 'parcelle')} de ${cropMass(d.cropId, d.cropName)}.` : `Joseph vous offre ${d.amount} pièces.`;
    default:
      return '';
  }
}

function capital(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function lowerFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** « 6 tomates », « 1 blé »… (pluriel simple des noms de culture). */
/** « de carottes », « de blé », « de choux » : la culture au sens d'une masse (après « parcelle de »). */
export function cropMass(cropId, fallbackName) {
  const name = (getCrop(cropId)?.name || fallbackName || cropId || '').toLowerCase();
  if (name === 'blé' || name === 'maïs') return name;
  if (name === 'pommier') return 'pommiers';
  return nounPlural(name);
}

export function cropPlural(cropId, n) {
  const name = (getCrop(cropId)?.name || cropId).toLowerCase();
  if (n <= 1) return name;
  if (name === 'blé') return 'bottes de blé';
  if (name === 'maïs') return 'épis de maïs';
  if (name === 'pomme') return 'paniers de pommes';
  if (name === 'pomme de terre') return 'pommes de terre';
  if (name === 'chou') return 'choux';
  return name.endsWith('s') || name.endsWith('x') ? name : `${name}s`;
}

/** Fin de l'événement actif (et de son offre éventuelle). */
function endActive(api, reason) {
  const e = ev(api.state);
  const a = e.active;
  if (!a) return;
  if (a.kind === 'crows') {
    const penalized = [];
    for (const i of a.data.plots || []) {
      const p = api.state.plots[i];
      if (!p || !p.crow) continue;
      p.crow = false;
      if (p.cropId && reason === 'ended') {
        p.crowPenalty = true;
        penalized.push(i);
      }
    }
    e.year.crowsMissed += penalized.length;
    a.data.penalized = penalized;
  }
  e.active = null;
  api.push('careerEventEnded', { id: a.id, kind: a.kind, reason, data: JSON.parse(JSON.stringify(a.data)) });
}

// ── Offres (visiteurs, marchand, animal perdu) ──────────────────────────────────────────────────

function findOffer(state, offerId) {
  return ev(state).offers.find((o) => o.id === offerId) || null;
}

function removeOffer(api, offer, outcome, extra = {}) {
  const e = ev(api.state);
  e.offers = e.offers.filter((o) => o !== offer);
  api.push('offerResolved', { offerId: offer.id, kind: offer.kind, outcome, ...extra });
  if (e.active && e.active.data?.offerId === offer.id) endActive(api, outcome);
}

function completeVisitor(api, offer) {
  const d = offer.data;
  const amount = d.unitPrice * d.n;
  api.earn('visitors', amount);
  const e = ev(api.state);
  e.year.visitors += 1;
  e.year.visitorIncome += amount;
  removeOffer(api, offer, 'delivered', { amount, cropId: d.cropId, n: d.n, name: d.name });
  api.repayJoseph(amount, 'visitor');
  return amount;
}

function expireOffer(api, offer) {
  let amount = 0;
  if (offer.kind === 'visitor' && offer.delivered > 0) {
    // Rien ne se perd : ce qui a été mis de côté est payé au prix normal.
    amount = Math.round(offer.data.basePrice * offer.delivered);
    api.earn('visitors', amount);
  }
  removeOffer(api, offer, 'expired', amount > 0 ? { amount, delivered: offer.delivered } : {});
  if (amount > 0) api.repayJoseph(amount, 'visitor');
}

/** Récoltes de la culture commandée : mises de côté (point d'accroche harvest). */
function divertForVisitor(api, cropId) {
  const offer = ev(api.state).offers.find((o) => o.kind === 'visitor' && o.accepted && o.data.cropId === cropId && o.delivered < o.data.n);
  if (!offer) return null;
  offer.delivered += 1;
  const label = `→ ${offer.data.name}`;
  if (offer.delivered >= offer.data.n) completeVisitor(api, offer);
  else api.push('offerProgress', { offerId: offer.id, delivered: offer.delivered, n: offer.data.n });
  return { divert: true, label };
}

function takeFromStock(state, cropId, n) {
  const have = state.career.stock[cropId] || 0;
  const k = Math.min(have, n);
  if (k <= 0) return 0;
  state.career.stock[cropId] = have - k;
  if (state.career.stock[cropId] === 0) delete state.career.stock[cropId];
  return k;
}

/** Offre pour l'interface (petite feuille : titre, texte de 2 lignes, boutons). */
export function offerInfo(state, offer) {
  if (offer.kind === 'themeVisitor') return themeOfferInfo(state, offer);
  const d = offer.data;
  const today = dayIndex(state);
  const base = { id: offer.id, kind: offer.kind, accepted: offer.accepted, daysLeft: Math.max(0, offer.endDay - today), endDay: offer.endDay, data: JSON.parse(JSON.stringify(d)) };
  if (offer.kind === 'visitor') {
    const inStock = state.career.stock[d.cropId] || 0;
    return {
      ...base,
      title: capital(d.name),
      icon: 'npc.visitor.1',
      text: `${capital(d.name)} voudrait ${d.n} ${cropPlural(d.cropId, d.n)}, ${agree(cropPlural(d.cropId, d.n), d.n, 'payé')} ${d.total} pièces (× ${String(VISITOR.factor).replace('.', ',')}).`,
      detail: offer.accepted ? `Mises de côté : ${offer.delivered} / ${d.n} · ${base.daysLeft === 0 ? 'dernier jour' : `encore ${base.daysLeft + 1} jours`}` : 'Livrée depuis le grenier ou avec vos prochaines récoltes.',
      acceptLabel: 'Accepter',
      declineLabel: 'Refuser',
      delivered: offer.delivered,
      n: d.n,
      inStock,
      canDeliver: inStock > 0 && offer.delivered < d.n,
      reward: d.total,
    };
  }
  if (offer.kind === 'merchant') {
    return {
      ...base,
      title: 'Marchand ambulant',
      icon: 'npc.visitor.3',
      text: d.text,
      detail: `${d.name} · ${d.price} pièces · aujourd'hui seulement`,
      acceptLabel: `Acheter (${d.price})`,
      declineLabel: 'Non merci',
      price: d.price,
      canAccept: state.money >= d.price,
    };
  }
  return {
    ...base,
    title: d.petId === 'dog' ? 'Un chien perdu' : 'Un chaton perdu',
    icon: `pet.${d.petId}`,
    text: d.text,
    detail: 'Un compagnon qui se promène dans la ferme.',
    acceptLabel: 'L\'adopter',
    declineLabel: 'Pas maintenant',
  };
}

function bestFertilizerLot(state) {
  const by = {};
  for (const i of fieldCrops(state)) {
    if (isMature(state.plots[i])) continue;
    const lot = state.plots[i].lot;
    by[lot] = (by[lot] || 0) + 1;
  }
  let best = null;
  for (const [lot, n] of Object.entries(by)) if (!best || n > best.n) best = { lot, n };
  return best ? best.lot : state.career.lots.find((l) => l.type === 'field')?.id || 'start';
}

function acceptOffer(api, offerId, arg) {
  const { state } = api;
  const offer = findOffer(state, offerId);
  if (!offer) return api.fail('Cette offre n\'existe plus.');
  const d = offer.data;
  if (offer.kind === 'themeVisitor') {
    // (lot 3) Visiteur unique de l'année à thème : son cadeau, gratuit.
    const inv = getCareerInvestment('beehive');
    const res = acceptThemeVisitor(api, offer, {
      canGiveHive: () => !!inv && (inv.rank ?? 1) <= state.career.rank && count(state, 'beehive') < itemMax(state, inv),
      giveHive: () => {
        state.investments.beehive = count(state, 'beehive') + 1;
        api.refreshLevel();
      },
    });
    if (!res.ok) return res;
    removeOffer(api, offer, 'accepted', { gift: res.gift, themeId: d.themeId });
    return { ok: true, offerId: offer.id, kind: offer.kind, gift: res.gift };
  }
  if (offer.kind === 'visitor') {
    if (offer.accepted) return api.fail('Commande déjà acceptée.');
    offer.accepted = true;
    api.push('offerAccepted', { offerId: offer.id, kind: offer.kind, data: offerInfo(state, offer) });
    return { ok: true, offerId: offer.id, kind: offer.kind };
  }
  if (offer.kind === 'merchant') {
    if (state.money < d.price) return api.fail(api.notEnoughMoney(d.price - state.money));
    if (d.itemId === 'fertilizer') {
      const item = MERCHANT_ITEMS.find((m) => m.id === 'fertilizer');
      const lot = typeof arg === 'string' && state.career.lots.some((l) => l.id === arg && l.type === 'field') ? arg : bestFertilizerLot(state);
      api.spend('items', d.price);
      ev(state).fertilizer = { lotId: lot, left: item.days, growth: item.growth };
    } else if (d.itemId === 'hens') {
      const item = MERCHANT_ITEMS.find((m) => m.id === 'hens');
      if (shelterCapacity(state, 'coop') - count(state, 'hen') < item.count) return api.fail('Le poulailler est plein : améliorez-le.');
      state.investments.hen = count(state, 'hen') + item.count;
      const each = Math.round(d.price / item.count);
      for (let k = 0; k < item.count; k++) api.spend('animals', k === item.count - 1 ? d.price - each * (item.count - 1) : each, { asset: 'animals', log: { kind: 'animal', id: 'hen' } });
    } else if (d.itemId === 'beehive') {
      const inv = getCareerInvestment('beehive');
      if (!inv || count(state, 'beehive') >= itemMax(state, inv)) return api.fail('Plus de place pour une ruche.');
      state.investments.beehive = count(state, 'beehive') + 1;
      api.spend('items', d.price, { asset: 'buildings' });
    }
    api.refreshLevel();
    removeOffer(api, offer, 'accepted', { amount: d.price, itemId: d.itemId });
    return { ok: true, offerId: offer.id, kind: offer.kind, cost: d.price, itemId: d.itemId };
  }
  // Animal perdu : adopté.
  state.career.pets[d.petId] = true;
  removeOffer(api, offer, 'accepted', { petId: d.petId });
  return { ok: true, offerId: offer.id, kind: offer.kind, petId: d.petId };
}

function declineOffer(api, offerId) {
  const offer = findOffer(api.state, offerId);
  if (!offer) return api.fail('Cette offre n\'existe plus.');
  let amount = 0;
  if (offer.kind === 'visitor' && offer.delivered > 0) {
    amount = Math.round(offer.data.basePrice * offer.delivered);
    api.earn('visitors', amount);
  }
  removeOffer(api, offer, 'declined', amount > 0 ? { amount } : {});
  return { ok: true, offerId, ...(amount > 0 ? { amount } : {}) };
}

function deliverOffer(api, offerId) {
  const { state } = api;
  const offer = findOffer(state, offerId);
  if (!offer) return api.fail('Cette offre n\'existe plus.');
  if (offer.kind !== 'visitor') return api.fail('Rien à livrer.');
  const d = offer.data;
  const k = takeFromStock(state, d.cropId, d.n - offer.delivered);
  if (k <= 0) return api.fail(`Pas de ${getCrop(d.cropId)?.name.toLowerCase() || d.cropId} au grenier.`);
  offer.accepted = true;
  offer.delivered += k;
  if (offer.delivered >= d.n) {
    const amount = completeVisitor(api, offer);
    return { ok: true, delivered: k, done: true, amount };
  }
  api.push('offerProgress', { offerId: offer.id, delivered: offer.delivered, n: d.n, fromStock: k });
  return { ok: true, delivered: k, done: false, left: d.n - offer.delivered };
}

// ── Corbeaux et pêche ───────────────────────────────────────────────────────────────────────────

/**
 * Chasse le corbeau d'une parcelle (joueur : action chaseCrow ; employé : CORE-B peut appeler
 * chaseCrowAt(api, plotIndex, 'staff')). → { ok } ; événement crowChased { plotIndex, by }.
 */
export function chaseCrowAt(api, plotIndex, by = 'player') {
  const { state } = api;
  const p = Number.isInteger(plotIndex) ? state.plots[plotIndex] : null;
  if (!p) return api.fail('Parcelle inexistante.');
  if (!p.crow) return api.fail('Pas de corbeau ici.');
  p.crow = false;
  const e = ev(state);
  e.year.crowsChased += 1;
  api.push('crowChased', { plotIndex, by });
  if (e.active?.kind === 'crows' && !(e.active.data.plots || []).some((i) => state.plots[i]?.crow)) endActive(api, 'chased');
  return { ok: true, plotIndex };
}

function hasPond(state) {
  return state.career.lots.some((l) => l.type === 'pond');
}

function fish(api) {
  const { state } = api;
  const e = ev(state);
  if (!hasPond(state)) return api.fail('Il faut une mare pour pêcher.');
  const today = dayIndex(state);
  if (e.fishedDay === today) return api.fail('Vous avez déjà pêché aujourd\'hui : revenez demain !');
  const rng = api.rng('events');
  const f = pickWeighted(rng, FISH, (x) => x.weight);
  // (lot 3) Canne de Firmin (année des grenouilles) : poissons + 50 %.
  // (Vallée vivante) Libellules installées : poissons + 25 %.
  const amount = Math.round(rng.int(f.min, f.max) * themeFishFactor(state) * (state.career.valley ? fishFactor(state) : 1));
  e.fishedDay = today;
  e.year.fish += 1;
  e.year.fishIncome += amount;
  // (lot 4) Album : poissons pêchés (la pêche marche aussi l'hiver, « sous la glace »).
  if (state.cozy) state.cozy.stats.fish[f.id] = (state.cozy.stats.fish[f.id] || 0) + 1;
  api.earn('other', amount);
  api.push('fishCaught', { fishId: f.id, name: f.name, amount });
  return { ok: true, amount, fishId: f.id, name: f.name };
}

// ── Déroulé (points d'accroche) ─────────────────────────────────────────────────────────────────

function seasonStart(api, { seasonId }) {
  const c = api.state.career;
  if (seasonId === 'summer' && c.rank >= CONTEST.rank) announceContest(api);
}

function dawnEvents(api, { seasonId, weather }) {
  const { state } = api;
  const e = ev(state);
  const today = dayIndex(state);
  // Œufs ramassés (épreuves et quêtes « œufs »).
  observeEggs(state);
  // Engrais du marchand : un jour de pousse en plus par aube, sur son champ.
  if (e.fertilizer) {
    for (const p of state.plots) {
      if (p.lot !== e.fertilizer.lotId || p.env !== 'field' || !p.cropId) continue;
      const crop = getCrop(p.cropId);
      if (isTreeCrop(crop) || isMature(p)) continue;
      p.growth = Math.min(crop.growDays, p.growth + e.fertilizer.growth);
    }
    e.fertilizer.left -= 1;
    if (e.fertilizer.left <= 0) e.fertilizer = null;
  }
  // Pénalité de corbeau sans culture (gel, parcelle vidée) : sans objet.
  for (const p of state.plots) if (p.crowPenalty && !p.cropId) p.crowPenalty = false;
  // Fin des événements d'un jour (corbeaux non chassés : −50 % à la récolte).
  if (e.active?.data?.offerId && !findOffer(state, e.active.data.offerId)) endActive(api, 'ended');
  if (e.active && !['visitor', 'merchant', 'lostPet'].includes(e.active.kind) && e.active.endDay < today) endActive(api, 'ended');
  // Fête du jour.
  const fest = festivalToday(state);
  e.today = fest ? fest.id : null;
  if (fest && !e.calendarDone.includes(fest.id)) {
    e.calendarDone.push(fest.id);
    if (fest.joyful) cheerStaff(api); // employés joyeux 7 jours (CORE-B)
    api.push('festival', { id: fest.id, name: fest.name, text: fest.text, icon: fest.icon, seasonId: fest.seasonId, day: festivalDay(state, fest) });
  }
  // Rappel la veille du dernier jour d'une commande acceptée pas encore livrée.
  for (const o of e.offers) {
    if (o.kind !== 'visitor' || !o.accepted || o.delivered >= o.data.n) continue;
    const daysLeft = o.endDay - today;
    if (!VISITOR.reminders.includes(daysLeft) || (o.reminded || []).includes(daysLeft)) continue;
    o.reminded = [...(o.reminded || []), daysLeft];
    api.push('offerReminder', { offerId: o.id, kind: o.kind, daysLeft, data: offerInfo(state, o), text: `${capital(o.data.name)} attend encore ${o.data.n - o.delivered} ${cropPlural(o.data.cropId, o.data.n - o.delivered)} : dernier jour demain.` });
  }
  // Tirage du jour. (lot 3) Avec la variété : 10 % (sans visiteur ni marchand, les autres gardent leur fréquence) ;
  // pas le jour de la fête du thème ; poids des touristes et des corbeaux selon le thème (jamais plus de tirages).
  const themeFest = state.variety ? themeFestivalToday(state) : null;
  if (!e.active && !fest && !themeFest && today > RANDOM_EVENT_RULES.graceDays) {
    const rng = api.rng('events');
    if (rng.chance(state.variety ? RANDOM_EVENT_RULES.chanceWithVariety : RANDOM_EVENT_RULES.chance)) {
      const ctx = { seasonId, weather };
      const options = RANDOM_EVENTS.filter((d) => d.id !== e.lastKind && eventPossible(api, d.id, ctx));
      // (Vallée vivante) Chouette hulotte installée : corbeaux deux fois plus rares (même tirage).
      const pick = pickWeighted(rng, options, (d) => d.weight * (state.variety ? themeEventWeight(state, d.id) : 1) * (d.id === 'crows' && state.career.valley ? crowWeightFactor(state) : 1));
      // (Vallée V3) Vieux têtards : plus aucun corbeau (poids 0). Si les corbeaux étaient le seul tirage possible, le nombre
      // qu'ils auraient tiré est tiré quand même (le flux `events` tire toujours autant de nombres).
      if (!pick && state.career.valley && options.some((d) => d.id === 'crows' && d.weight * (state.variety ? themeEventWeight(state, d.id) : 1) > 0)) rng.float();
      if (pick) startEvent(api, pick.id, ctx);
    }
  }
  notifyContest(api);
}

function dawn(api) {
  observeEggs(api.state);
}

function tick(api, from, to) {
  observeEggs(api.state);
  const e = ev(api.state);
  const a = e.active;
  if (!a || a.kind !== 'tourists') return;
  TOURISTS.passes.forEach((share, k) => {
    const at = share * DAY_SECONDS;
    if (at > from && at <= to && a.data.done <= k) {
      a.data.done = k + 1;
      api.earn('visitors', a.data.perPass);
      e.year.tourists += 1;
      e.year.touristIncome += a.data.perPass;
      api.push('touristsPassed', { amount: a.data.perPass, pass: k + 1, passes: TOURISTS.passes.length });
    }
  });
}

function incomes(api, { seasonId }) {
  const fest = festivalToday(api.state);
  if (!fest?.guestFactor) return [];
  const gh = buildingLevelData(api.state, 'guestHouse');
  if (!gh) return [];
  const extra = Math.round((BUILDINGS_BY_ID.guestHouse.income[seasonId] || 0) * gh.incomeFactor * (fest.guestFactor - 1));
  return extra > 0 ? [{ source: 'festival', amount: extra, kind: 'festival', key: 'guests' }] : [];
}

function evening(api, { seasonId, lastDayOfSeason }) {
  const { state } = api;
  const e = ev(state);
  const today = dayIndex(state);
  for (const offer of [...e.offers]) if (offer.endDay <= today) expireOffer(api, offer);
  notifyContest(api);
  const k = state.career.contest;
  if (lastDayOfSeason && seasonId === 'autumn' && k && !k.judged && k.year === state.time.year) judgeContest(api);
}

function yearEnd(api, { report }) {
  const e = ev(api.state);
  const k = api.state.career.contest;
  report.events = { ...e.year, festivals: [...e.calendarDone], contest: k && k.year === report.year && k.result ? { amount: k.result.amount, goalsMet: [...k.result.goalsMet], all: k.result.all } : null };
  e.calendarDone = [];
  e.year = yearCounters();
}

function harvest(api, { cropId }) {
  return divertForVisitor(api, cropId);
}

// ── Requêtes ────────────────────────────────────────────────────────────────────────────────────

function calendarInfo(state) {
  const L = state.career.seasonLength;
  const nowDay = (state.time.seasonIndex) * L + state.time.dayOfSeason;
  const done = ev(state).calendarDone || [];
  const extra = state.variety ? varietyCalendar(state, nowDay) : [];
  return [...CALENDAR_EVENTS.map((f) => {
    const at = SEASONS.indexOf(f.seasonId) * L + festivalDay(state, f);
    const isToday = at === nowDay;
    const passed = at < nowDay;
    return {
      id: f.id, name: f.name, text: f.text, icon: f.icon, seasonId: f.seasonId, day: festivalDay(state, f), rank: f.rank,
      locked: f.rank > state.career.rank, today: isToday, done: done.includes(f.id) || passed,
      daysUntil: isToday ? 0 : passed ? at + 4 * L - nowDay : at - nowDay,
    };
  }), ...extra].sort((a, b) => a.daysUntil - b.daysUntil);
}

/** (lot 3) Fête de l'année à thème et passage de Basile le colporteur, pour l'Agenda. */
function varietyCalendar(state, nowDay) {
  const out = [];
  for (const t of themeCalendar(state)) {
    if (t.kind !== 'themeFestival') continue;
    const th = state.career.theme;
    out.push({ id: `theme.${th.id}`, kind: 'themeFestival', name: t.text.split(' : ')[0], text: t.text.split(' : ').slice(1).join(' : '), icon: `fair.theme.${th.id}`, seasonId: SEASONS[Math.floor((t.day - 1) / state.career.seasonLength)], day: ((t.day - 1) % state.career.seasonLength) + 1, rank: 1, locked: false, today: t.daysUntil === 0, done: false, daysUntil: t.daysUntil });
  }
  const m = state.variety.merchant;
  if (m) {
    const today = (state.time.year - 1) * 4 * state.career.seasonLength + state.time.day;
    if (m.leaveDay >= today) {
      const d = Math.max(0, m.arriveDay - today);
      out.push({ id: 'merchant', kind: 'merchant', name: MERCHANT.name, text: 'Graines rares et petits trésors, deux jours.', icon: 'npc.merchant', seasonId: SEASONS[state.time.seasonIndex], day: state.time.dayOfSeason + d, rank: 1, locked: false, today: d === 0, done: false, daysUntil: d });
    }
  }
  return out;
}

function activeInfo(state) {
  const a = ev(state).active;
  if (!a) return null;
  const def = RANDOM_EVENTS_BY_ID[a.kind];
  return { id: a.id, kind: a.kind, name: def?.name || a.kind, icon: def?.icon || null, day: a.day, endDay: a.endDay, text: eventText(state, a), data: JSON.parse(JSON.stringify(a.data)) };
}

function festivalInfo(state, f) {
  return f ? { id: f.id, name: f.name, text: f.text, icon: f.icon, seasonId: f.seasonId, day: festivalDay(state, f), factors: { ...(festivalFactors(state, f) || {}) }, seedFactor: f.seedFactor ?? 1 } : null;
}

function eventsQuery(state) {
  const e = ev(state);
  return {
    today: festivalInfo(state, festivalToday(state)),
    tomorrow: festivalInfo(state, festivalTomorrow(state)),
    active: activeInfo(state),
    offers: e.offers.map((o) => offerInfo(state, o)),
    calendar: calendarInfo(state),
    contest: contestInfo(state),
    fishing: { pond: hasPond(state), fishedToday: e.fishedDay === dayIndex(state) },
    fertilizer: e.fertilizer ? { ...e.fertilizer } : null,
    pets: { ...state.career.pets },
    crows: state.plots.map((p, i) => (p.crow ? i : -1)).filter((i) => i >= 0),
  };
}

// ── Sauvegarde ──────────────────────────────────────────────────────────────────────────────────

function init(state) {
  const c = state.career;
  c.events = { ...eventsDefaults(), ...(c.events || {}) };
  if (!c.pets) c.pets = { cat: false, dog: false };
}

function migrate(state) {
  const c = state.career;
  const d = eventsDefaults();
  if (!c.events || typeof c.events !== 'object') c.events = d;
  for (const [k, v] of Object.entries(d)) if (c.events[k] === undefined) c.events[k] = v;
  for (const [k, v] of Object.entries(yearCounters())) if (c.events.year[k] === undefined) c.events.year[k] = v;
  if (!c.pets) c.pets = { cat: false, dog: false };
}

function check(state) {
  const c = state.career;
  const e = c.events;
  const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const int = (v) => Number.isInteger(v) && v >= 0;
  if (!obj(e) || !Array.isArray(e.offers) || !Array.isArray(e.calendarDone)) return 'événements';
  if (!e.calendarDone.every((id) => CALENDAR_EVENTS_BY_ID[id])) return 'fêtes';
  if (!int(e.nextOfferId) || !int(e.eggs) || !int(e.fishedDay)) return 'événements';
  if (e.lastKind !== null && !RANDOM_EVENTS_BY_ID[e.lastKind]) return 'événements';
  if (e.today !== null && !CALENDAR_EVENTS_BY_ID[e.today]) return 'fête du jour';
  if (e.active !== null && !(obj(e.active) && RANDOM_EVENTS_BY_ID[e.active.kind] && int(e.active.day) && int(e.active.endDay) && obj(e.active.data))) return 'événement en cours';
  for (const o of e.offers) {
    if (!obj(o) || typeof o.id !== 'string' || !['visitor', 'merchant', 'pet', 'themeVisitor'].includes(o.kind) || !int(o.endDay) || !int(o.delivered) || !obj(o.data)) return 'offre';
    if (o.kind === 'themeVisitor' && typeof o.data.themeId !== 'string') return 'visiteur du thème';
    if (o.kind === 'visitor' && (!getCrop(o.data.cropId) || !int(o.data.n) || o.delivered > o.data.n)) return 'commande';
    if (o.kind === 'merchant' && !MERCHANT_ITEMS.some((m) => m.id === o.data.itemId)) return 'marchand';
    if (o.kind === 'pet' && !PETS.some((p) => p.id === o.data.petId)) return 'animal perdu';
  }
  if (e.fertilizer !== null && !(obj(e.fertilizer) && c.lots.some((l) => l.id === e.fertilizer.lotId) && int(e.fertilizer.left))) return 'engrais';
  if (!obj(e.year)) return 'événements de l\'année';
  const k = c.contest;
  if (k !== null) {
    if (!obj(k) || !int(k.year) || !int(k.rank) || !Array.isArray(k.goals) || typeof k.judged !== 'boolean') return 'comice';
    for (const g of k.goals) if (!obj(g) || !CONTEST_GOAL_POOL.some((x) => x.id === g.id) || !int(g.target)) return 'épreuve du comice';
  }
  if (!obj(c.pets)) return 'animaux de compagnie';
  return null;
}

// ── Enregistrement ──────────────────────────────────────────────────────────────────────────────

export const eventsExtension = {
  id: 'events',
  init,
  migrate,
  check,
  hooks: { seasonStart, dawnEvents, dawn, tick, incomes, evening, yearEnd, harvest },
  providers: {
    priceFactor(state, { kind }) {
      return festivalFactors(state, festivalToday(state))?.[kind] ?? 1;
    },
    seedFactor(state) {
      return festivalToday(state)?.seedFactor ?? 1;
    },
    effects(state, key) {
      if (key !== 'growthBonus') return 0;
      const a = state.career?.events?.active;
      return a && a.kind === 'rainbow' ? a.data.growthBonus || RAINBOW.growthBonus : 0;
    },
  },
  actions: (api) => ({
    chaseCrow: (plotIndex) => chaseCrowAt(api, plotIndex, 'player'),
    fish: () => fish(api),
    acceptOffer: (offerId, arg) => acceptOffer(api, offerId, arg),
    declineOffer: (offerId) => declineOffer(api, offerId),
    deliverOffer: (offerId) => deliverOffer(api, offerId),
    // Débogage et tests (__debug.careerEvent(id)) : lance un événement au hasard tout de suite, si sa
    // condition est remplie (sans tirage ni délai de grâce ; l'événement en cours s'arrête, sans pénalité).
    triggerEvent: (id) => {
      const { state } = api;
      if (!RANDOM_EVENTS_BY_ID[id]) return api.fail('Événement inconnu.');
      // L'événement en cours (et son offre) laisse la place, sans pénalité.
      const cur = ev(state).active;
      if (cur) {
        const offer = cur.data?.offerId ? findOffer(state, cur.data.offerId) : null;
        if (offer) removeOffer(api, offer, 'expired');
        if (ev(state).active) endActive(api, 'replaced');
      }
      if (!eventPossible(api, id, { seasonId: api.seasonId(), weather: state.weather.today })) return api.fail('Impossible aujourd\'hui.');
      startEvent(api, id, {});
      return { ok: true, event: activeInfo(state) };
    },
  }),
  queries: (api) => ({
    events: () => eventsQuery(api.state),
    contest: () => contestInfo(api.state),
    festival: () => festivalInfo(api.state, festivalToday(api.state)),
  }),
};

registerCareerExtension(eventsExtension);

