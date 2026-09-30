// Mode Carrière — quêtes et amitié de Joseph (lot CORE-C, pur). Conception : docs/CARRIERE.md § 8.3 ;
// données : src/data/career/quests.js ; contrat : docs/ARCHITECTURE.md, « Mode Carrière — livraison CORE-C ».
//
// Extension enregistrée (id 'quests') :
//   - une quête proposée au début de chaque saison à partir du rang 2 (seasonStart), jusqu'au soir du dernier
//     jour de la saison ; acceptQuest / declineQuest / deliverQuest (depuis le grenier) ; les récoltes de la
//     culture demandée sont mises de côté (harvest) ; produits, œufs et pommiers sont comptés ;
//   - récompense : argent (poste « quests »), écus (à verser par l'interface : questDone.ecus), +1 ♥ ;
//   - amitié (0 à 10 ♥, jamais perdue) : +1 par quête réussie, +1 par prêt remboursé en entier, +1 à la fête des
//     récoltes si une quête est en cours ; paliers : cadeaux (2), prêt × 2 (4) et sans supplément (6) lus par
//     careerLevel, « verger de Joseph » (8 : fournisseur lotPrice + action buyLot), charrette (10 : +5 % ventes).
// Met à jour joseph.hearts, joseph.questsDone, lifetime.questsDone puis api.refreshLevel() (prêt, objectifs).

import { CROPS, getCrop, isTreeCrop } from '../../data/crops.js';
import { PRODUCTS, getProduct } from '../../data/products.js';
import { WORKSHOPS } from '../../data/career/buildings.js';
import { LOT_TYPES_BY_ID } from '../../data/career/lots.js';
import {
  EGG_VALUE, JOSEPH_CART, JOSEPH_HEARTS, JOSEPH_LINES, JOSEPH_ORCHARD, MAX_HEARTS, QUEST_RANK, QUEST_REWARD,
  QUEST_TEMPLATES, QUEST_TEMPLATES_BY_ID,
} from '../../data/career/quests.js';
import { canBorrow, loanAmount, maxMissing, willLend } from '../neighbour.js';
import { setTree } from '../trees.js';
import { careerSeasonCharge } from './effects.js';
import { ensureLotPlots } from './buildings.js';
import { buyLot as buyLotBase, countType, getLot } from './land.js';
import { registerCareerExtension } from './registry.js';
import { baseCropPrice, cropPlural, dayIndex, eggsCountable, festivalToday, seasonEndIndex } from './events.js';

const J = (state) => state.career.joseph;
const count = (state, id) => state.investments[id] || 0;
const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));

export function josephDefaults() {
  return { hearts: 0, questsDone: 0, gifts: [], loansRepaid: 0, loanHearts: 0, festivalHeartYear: 0, onceDone: [], orchardDone: false, nextQuestId: 1, questsThisYear: 0, ecusThisYear: 0, heartLog: [] };
}

/** « confitures de fraises », « fromages de vache », « sacs de farine »… */
export function productPlural(productId, n) {
  const name = (getProduct(productId)?.name || productId).toLowerCase();
  if (n <= 1) return name;
  if (name === 'farine') return 'sacs de farine';
  if (name.startsWith('jus')) return `bouteilles de ${name}`;
  const [head, ...rest] = name.split(' ');
  return [head.endsWith('s') ? head : `${head}s`, ...rest].join(' ');
}

function treePlots(state) {
  return state.plots.filter((p) => p.env === 'orchard' && p.cropId && isTreeCrop(getCrop(p.cropId))).length;
}

function freeOrchardPlots(state) {
  return state.plots.filter((p) => p.env === 'orchard' && p.unlocked && !p.cropId).length;
}

// ── Amitié ──────────────────────────────────────────────────────────────────────────────────────

/** Palier d'amitié atteint à `hearts` (ou null). */
export function heartTier(hearts) {
  return JOSEPH_HEARTS.find((t) => t.hearts === hearts) || null;
}

/** +1 ♥ (au plus MAX_HEARTS) ; événement josephHeart { hearts, reason, line, unlock } ; recalcule le niveau. */
export function addHeart(api, reason) {
  const j = J(api.state);
  if ((j.hearts || 0) >= MAX_HEARTS) return false;
  j.hearts = (j.hearts || 0) + 1;
  j.heartLog = [...(j.heartLog || []), { reason, year: api.state.time.year, day: api.state.time.day }].slice(-20);
  const tier = heartTier(j.hearts);
  api.refreshLevel();
  const line = reason === 'loan' ? JOSEPH_LINES.loanHeart : reason === 'festival' ? JOSEPH_LINES.festivalHeart : JOSEPH_LINES.heart;
  api.push('josephHeart', {
    hearts: j.hearts,
    reason,
    line,
    unlock: tier ? { id: tier.id, name: tier.name, text: tier.text, line: JOSEPH_LINES.unlock[tier.id] } : null,
    ...(tier ? { gift: tier.id } : {}),
  });
  return true;
}

function checkLoanHearts(api) {
  const j = J(api.state);
  const repaid = j.loansRepaid || 0;
  while ((j.loanHearts || 0) < repaid) {
    j.loanHearts = (j.loanHearts || 0) + 1;
    addHeart(api, 'loan');
  }
}

/** Le verger de Joseph est-il proposé (8 ♥, pas encore utilisé, un verger de plus possible) ? */
function orchardOffered(state) {
  const j = J(state);
  if (!j || (j.hearts || 0) < JOSEPH_HEARTS.find((t) => t.id === 'orchard').hearts || j.orchardDone) return false;
  const def = LOT_TYPES_BY_ID.orchard;
  return state.career.rank >= def.rank && countType(state, 'orchard') < def.max;
}

/** Le terrain acheté devient « Le verger de Joseph » : verger aménagé avec des pommiers adultes. */
function giveOrchard(api, lot) {
  const { state } = api;
  const def = LOT_TYPES_BY_ID.orchard;
  lot.type = 'orchard';
  lot.slots = null;
  lot.plan = null;
  const plots = ensureLotPlots(state, lot, def.plots.env, def.plots.count);
  const trees = plots.slice(0, JOSEPH_ORCHARD.trees);
  for (const i of trees) setTree(state, state.plots[i], JOSEPH_ORCHARD.cropId, true);
  J(state).orchardDone = true;
  api.push('lotDeveloped', { lotId: lot.id, lotType: 'orchard', cost: 0, plots, gift: 'josephOrchard', trees });
  api.push('josephOrchard', { lotId: lot.id, trees, line: JOSEPH_LINES.orchard });
}

// ── Quêtes ──────────────────────────────────────────────────────────────────────────────────────

/** Produits qu'on peut fabriquer maintenant (atelier construit, ingrédient disponible). */
function makeableProducts(api) {
  const { state } = api;
  const sid = api.seasonId();
  return PRODUCTS.filter((p) => {
    const lvl = state.career.buildings[p.building]?.level || 0;
    if (!lvl || !WORKSHOPS.includes(p.building)) return false;
    if (p.minLevel && lvl < p.minLevel) return false;
    if (p.maxLevel && lvl > p.maxLevel) return false;
    if (p.source === 'animal') return count(state, p.input) > 0;
    const crop = api.crops.find((c) => c.id === p.input);
    if (!crop) return false;
    if (isTreeCrop(crop)) return state.plots.some((pl) => pl.cropId === crop.id);
    return crop.seasons.includes(sid);
  });
}

function templatePossible(api, t, n) {
  const { state } = api;
  const L = state.career.seasonLength;
  switch (t.needs) {
    case undefined:
    case null:
      return true;
    case 'workshop':
      return makeableProducts(api).length > 0;
    case 'eggs':
      return eggsCountable() && (count(state, 'hen') + count(state, 'duck')) * L >= n;
    case 'trees':
      return treePlots(state) >= 2 && api.seasonId() !== 'winter';
    case 'orchard':
      return freeOrchardPlots(state) >= n && api.seasonId() !== 'winter' && api.crops.some((c) => c.id === 'apple');
    default:
      return false;
  }
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

/** Tire la quête de la saison (flux « events »). */
function drawQuest(api) {
  const { state } = api;
  const j = J(state);
  const rank = state.career.rank;
  const rng = api.rng('events');
  const L = state.career.seasonLength;
  const sid = api.seasonId();
  const candidates = [];
  for (const t of QUEST_TEMPLATES) {
    if (t.once && (j.onceDone || []).includes(t.id)) continue;
    const n = t.n.base + t.n.perRank * rank;
    if (t.type === 'crop') {
      const crops = api.crops.filter((c) => !isTreeCrop(c) && c.seasons.includes(sid) && c.growDays < L);
      if (!crops.length) continue;
    }
    if (!templatePossible(api, t, n)) continue;
    candidates.push({ t, n });
  }
  const pick = pickWeighted(rng, candidates, (x) => x.t.weight);
  if (!pick) return null;
  const { t, n } = pick;
  const q = { id: `quest${j.nextQuestId++}`, templateId: t.id, type: t.type, need: { type: t.type, id: null, n }, progress: 0, accepted: false, offeredDay: dayIndex(state), endDay: seasonEndIndex(state), base: 0, value: 0, reward: null };
  let what = '';
  if (t.type === 'crop') {
    const growing = {};
    for (const p of state.plots) if (p.cropId && p.env === 'field') growing[p.cropId] = (growing[p.cropId] || 0) + 1;
    const crops = api.crops.filter((c) => !isTreeCrop(c) && c.seasons.includes(sid) && c.growDays < L);
    const crop = pickWeighted(rng, crops, (c) => 1 + 2 * (growing[c.id] || 0));
    q.need.id = crop.id;
    what = cropPlural(crop.id, n);
    q.value = baseCropPrice(api, crop.id) * n;
  } else if (t.type === 'product') {
    const list = makeableProducts(api);
    const prod = list[rng.int(0, list.length - 1)];
    q.need.id = prod.id;
    what = productPlural(prod.id, n);
    q.value = prod.value * n;
  } else if (t.type === 'eggs') {
    q.need.id = 'eggs';
    what = 'œufs';
    q.value = EGG_VALUE * n;
  } else if (t.type === 'fruits') {
    q.need.id = 'fruit';
    what = 'fruits';
    const trees = CROPS.filter((c) => isTreeCrop(c));
    q.value = Math.round((trees.reduce((s, c) => s + baseCropPrice(api, c.id), 0) / Math.max(1, trees.length)) * n);
  } else if (t.type === 'trees') {
    q.need.id = JOSEPH_ORCHARD.cropId;
    what = 'pommiers';
    q.value = (getCrop(JOSEPH_ORCHARD.cropId)?.seedCost || 45) * n;
  }
  q.what = what;
  q.text = fill(t.text, { n, what });
  q.reward = { money: Math.round(q.value * t.rewardFactor), ecus: QUEST_REWARD.ecus, hearts: QUEST_REWARD.hearts };
  return q;
}

/** Compteur (cumul) d'une quête « passive » (produits, œufs, pommiers), pour la progression depuis l'acceptation. */
function passiveCounter(state, q) {
  if (q.type === 'product') return state.stats.year.productsSold?.[q.need.id] || 0;
  if (q.type === 'eggs') return state.career.events?.eggs || 0;
  if (q.type === 'trees') return treePlots(state);
  return 0;
}

function isPassive(q) {
  return q.type === 'product' || q.type === 'eggs' || q.type === 'trees';
}

function questDone(api) {
  const { state } = api;
  const c = state.career;
  const q = c.quest;
  const j = J(state);
  const money = q.reward.money;
  if (money > 0) api.earn('quests', money);
  j.questsDone = (j.questsDone || 0) + 1;
  c.lifetime.questsDone = (c.lifetime.questsDone || 0) + 1;
  j.questsThisYear = (j.questsThisYear || 0) + 1;
  j.ecusThisYear = (j.ecusThisYear || 0) + q.reward.ecus;
  const tpl = QUEST_TEMPLATES_BY_ID[q.templateId];
  if (tpl?.once) j.onceDone = [...new Set([...(j.onceDone || []), tpl.id])];
  c.quest = null;
  const fem = c.farmerGender === 'fermiere';
  api.push('questDone', { quest: questInfo(state, { ...q, progress: q.need.n }), amount: money, ecus: q.reward.ecus, hearts: q.reward.hearts, line: fem ? JOSEPH_LINES.questDoneFem : JOSEPH_LINES.questDone });
  for (let k = 0; k < q.reward.hearts; k++) addHeart(api, 'quest');
  if (money > 0 && q.type !== 'product' && q.type !== 'eggs') api.repayJoseph(money, 'quest');
  api.refreshLevel();
  api.checkRanks();
}

function setProgress(api, progress) {
  const q = api.state.career.quest;
  const before = q.progress;
  q.progress = Math.min(q.need.n, Math.max(0, progress));
  if (q.progress === before) return;
  if (q.progress >= q.need.n) questDone(api);
  else api.push('questProgress', { quest: questInfo(api.state, q) });
}

function checkPassive(api) {
  const q = api.state.career.quest;
  if (!q || !q.accepted || !isPassive(q)) return;
  setProgress(api, passiveCounter(api.state, q) - q.base);
}

function expireQuest(api) {
  const { state } = api;
  const q = state.career.quest;
  let amount = 0;
  if (q.accepted && !isPassive(q) && q.progress > 0) {
    // Rien ne se perd : ce qui a été mis de côté est payé au prix normal.
    amount = Math.round((q.value / q.need.n) * q.progress);
    api.earn('crops', amount);
  }
  state.career.quest = null;
  api.push('questExpired', { quest: questInfo(state, q), accepted: q.accepted, amount, line: JOSEPH_LINES.questExpired });
}

/** Quête pour l'interface. */
export function questInfo(state, q = state.career.quest) {
  if (!q) return null;
  const inStock = q.type === 'crop' ? state.career.stock[q.need.id] || 0 : q.type === 'fruits' ? fruitStock(state) : 0;
  const today = dayIndex(state);
  return {
    id: q.id,
    templateId: q.templateId,
    type: q.type,
    text: q.text,
    what: q.what,
    need: { ...q.need },
    progress: q.progress,
    left: Math.max(0, q.need.n - q.progress),
    reward: { ...q.reward },
    daysLeft: Math.max(0, q.endDay - today),
    accepted: q.accepted,
    canDeliver: (q.type === 'crop' || q.type === 'fruits') && inStock > 0 && q.progress < q.need.n,
    inStock,
    line: q.accepted ? fill(JOSEPH_LINES.questProgress, { left: `${Math.max(0, q.need.n - q.progress)} ${q.what}` }) : state.career.farmerGender === 'fermiere' ? JOSEPH_LINES.questOfferFem : JOSEPH_LINES.questOffer,
    portrait: 'portrait.joseph',
  };
}

function fruitStock(state) {
  return Object.entries(state.career.stock).filter(([id]) => isTreeCrop(getCrop(id))).reduce((s, [, n]) => s + n, 0);
}

function acceptQuest(api) {
  const { state } = api;
  const q = state.career.quest;
  if (!q) return api.fail('Joseph n\'a pas de quête pour vous en ce moment.');
  if (q.accepted) return api.fail('Quête déjà acceptée.');
  q.accepted = true;
  q.base = isPassive(q) ? passiveCounter(state, q) : 0;
  q.progress = 0;
  api.push('questProgress', { quest: questInfo(state, q), accepted: true, line: JOSEPH_LINES.questAccepted });
  return { ok: true, quest: questInfo(state, q), line: JOSEPH_LINES.questAccepted };
}

function declineQuest(api) {
  const { state } = api;
  const q = state.career.quest;
  if (!q) return api.fail('Joseph n\'a pas de quête pour vous en ce moment.');
  let amount = 0;
  if (q.accepted && !isPassive(q) && q.progress > 0) {
    amount = Math.round((q.value / q.need.n) * q.progress);
    api.earn('crops', amount);
  }
  state.career.quest = null;
  api.push('questExpired', { quest: questInfo(state, q), declined: true, accepted: q.accepted, amount, line: JOSEPH_LINES.questDeclined });
  return { ok: true, line: JOSEPH_LINES.questDeclined, ...(amount > 0 ? { amount } : {}) };
}

function deliverQuest(api) {
  const { state } = api;
  const q = state.career.quest;
  if (!q) return api.fail('Joseph n\'a pas de quête pour vous en ce moment.');
  if (q.type !== 'crop' && q.type !== 'fruits') return api.fail('Cette quête ne se livre pas depuis le grenier.');
  const want = q.need.n - q.progress;
  const stock = state.career.stock;
  let k = 0;
  const ids = q.type === 'crop' ? [q.need.id] : Object.keys(stock).filter((id) => isTreeCrop(getCrop(id)));
  for (const id of ids) {
    while (k < want && (stock[id] || 0) > 0) {
      stock[id] -= 1;
      if (stock[id] === 0) delete stock[id];
      k++;
    }
  }
  if (k === 0) return api.fail('Rien de ce qu\'il faut au grenier.');
  q.accepted = true;
  setProgress(api, q.progress + k);
  return { ok: true, delivered: k, done: !state.career.quest };
}

// ── Points d'accroche ───────────────────────────────────────────────────────────────────────────

function seasonStart(api) {
  const { state } = api;
  const c = state.career;
  if (c.rank < QUEST_RANK || c.quest) return;
  const q = drawQuest(api);
  if (!q) return;
  c.quest = q;
  api.push('questOffered', { quest: questInfo(state, q), line: c.farmerGender === 'fermiere' ? JOSEPH_LINES.questOfferFem : JOSEPH_LINES.questOffer });
}

function dawnEvents(api) {
  const { state } = api;
  const j = J(state);
  const fest = festivalToday(state);
  const q = state.career.quest;
  if (fest?.questHeart && q && q.accepted && j.festivalHeartYear !== state.time.year) {
    j.festivalHeartYear = state.time.year;
    for (let k = 0; k < fest.questHeart; k++) addHeart(api, 'festival');
  }
  checkPassive(api);
  checkLoanHearts(api);
}

function tick(api) {
  checkPassive(api);
  checkLoanHearts(api);
  // Filet : un terrain « verger de Joseph » acheté sans passer par l'action (débogage, ancienne version).
  const { state } = api;
  if (!J(state).orchardDone) {
    const lot = state.career.lots.find((l) => l.special === JOSEPH_ORCHARD.label && l.type === 'wild');
    if (lot) giveOrchard(api, lot);
  }
}

function evening(api, { lastDayOfSeason }) {
  checkPassive(api);
  if (lastDayOfSeason && api.state.career.quest) expireQuest(api);
}

function harvest(api, { cropId }) {
  const q = api.state.career.quest;
  if (!q || !q.accepted || q.progress >= q.need.n) return null;
  const match = q.type === 'crop' ? q.need.id === cropId : q.type === 'fruits' ? isTreeCrop(getCrop(cropId)) : false;
  if (!match) return null;
  setProgress(api, q.progress + 1);
  return { divert: true, label: '→ Joseph' };
}

function yearEnd(api, { report }) {
  const j = J(api.state);
  report.joseph = { hearts: j.hearts || 0, questsDone: j.questsThisYear || 0, questEcus: j.ecusThisYear || 0 };
  report.questEcus = j.ecusThisYear || 0;
  j.questsThisYear = 0;
  j.ecusThisYear = 0;
}

// ── Requêtes ────────────────────────────────────────────────────────────────────────────────────

function loanInfo(api) {
  const { state } = api;
  const level = api.level;
  const loan = state.neighbourLoan;
  if (!loan || !level.neighbourLoan) return null;
  const rent = careerSeasonCharge(state);
  let wouldLend = 0;
  if (state.money < rent) wouldLend = willLend(state, level, rent) ? loanAmount(level, rent, state.money, false) : null;
  return {
    debt: loan.debt, borrowed: loan.borrowed, repaid: loan.repaid, loans: loan.loans, available: canBorrow(state, level), wouldLend,
    maxMissing: maxMissing(level, rent), surcharge: level.neighbourLoan.surcharge, repayShare: level.neighbourLoan.repayShare,
    cushion: level.neighbourLoan.cushion, maxShare: level.neighbourLoan.maxShare, minCover: level.neighbourLoan.minCover,
  };
}

function josephInfo(api) {
  const { state } = api;
  const j = J(state);
  const hearts = j.hearts || 0;
  const next = JOSEPH_HEARTS.find((t) => t.hearts > hearts) || null;
  return {
    hearts,
    maxHearts: MAX_HEARTS,
    questsDone: j.questsDone || 0,
    nextGift: next ? { hearts: next.hearts, id: next.id, name: next.name, text: next.text } : null,
    tiers: JOSEPH_HEARTS.map((t) => ({ hearts: t.hearts, id: t.id, name: t.name, text: t.text, reached: hearts >= t.hearts })),
    orchard: { offered: orchardOffered(state), done: !!j.orchardDone },
    cart: hearts >= MAX_HEARTS,
    title: hearts >= MAX_HEARTS ? JOSEPH_CART.title : null,
    portrait: 'portrait.joseph',
    quest: questInfo(state),
    loan: loanInfo(api),
  };
}

// ── Sauvegarde ──────────────────────────────────────────────────────────────────────────────────

function init(state) {
  state.career.joseph = { ...josephDefaults(), ...(state.career.joseph || {}) };
}

function migrate(state) {
  const d = josephDefaults();
  const j = state.career.joseph && typeof state.career.joseph === 'object' ? state.career.joseph : (state.career.joseph = {});
  // Prêts remboursés avant cette version : pas de cœur rétroactif.
  if (j.loanHearts === undefined) j.loanHearts = j.loansRepaid || 0;
  for (const [k, v] of Object.entries(d)) if (j[k] === undefined) j[k] = v;
}

function check(state) {
  const j = state.career.joseph;
  const int = (v) => Number.isInteger(v) && v >= 0;
  if (!j || !int(j.hearts) || j.hearts > MAX_HEARTS || !int(j.questsDone) || !int(j.nextQuestId) || !Array.isArray(j.onceDone)) return 'amitié de Joseph';
  const q = state.career.quest;
  if (q !== null) {
    if (typeof q !== 'object' || !QUEST_TEMPLATES_BY_ID[q.templateId] || !q.need || !int(q.need.n) || q.need.n < 1 || !int(q.progress) || q.progress > q.need.n || typeof q.accepted !== 'boolean' || !int(q.endDay) || !q.reward) return 'quête de Joseph';
    if (q.type === 'crop' && !getCrop(q.need.id)) return 'quête de Joseph';
    if (q.type === 'product' && !getProduct(q.need.id)) return 'quête de Joseph';
  }
  return null;
}

// ── Enregistrement ──────────────────────────────────────────────────────────────────────────────

export const questsExtension = {
  id: 'quests',
  init,
  migrate,
  check,
  hooks: { seasonStart, dawnEvents, tick, evening, harvest, yearEnd },
  providers: {
    effects(state, key) {
      if (key !== 'priceBonus') return 0;
      return (state.career?.joseph?.hearts || 0) >= MAX_HEARTS ? JOSEPH_CART.priceBonus : 0;
    },
    lotPrice(state, lot) {
      if (!orchardOffered(state)) return null;
      return { price: Math.round(lot.basePrice * JOSEPH_ORCHARD.priceFactor), label: JOSEPH_ORCHARD.label, id: 'josephOrchard', lotType: 'orchard', trees: JOSEPH_ORCHARD.trees };
    },
    objective(state, obj) {
      return obj.type === 'quests' ? state.career.joseph?.questsDone ?? 0 : null;
    },
    unlocks(rank) {
      return rank === QUEST_RANK ? [{ kind: 'feature', id: 'quests', name: 'Quêtes de Joseph' }] : [];
    },
  },
  actions: (api) => ({
    acceptQuest: () => acceptQuest(api),
    declineQuest: () => declineQuest(api),
    deliverQuest: () => deliverQuest(api),
    // Achat du terrain suivant (CORE-A) ; « Le verger de Joseph » : aménagé tout de suite, pommiers adultes.
    buyLot: () => {
      const r = buyLotBase(api);
      if (r.ok) {
        const lot = getLot(api.state, r.lotId);
        if (lot && lot.special === JOSEPH_ORCHARD.label && !J(api.state).orchardDone) {
          giveOrchard(api, lot);
          return { ...r, special: JOSEPH_ORCHARD.label, lotType: 'orchard' };
        }
      }
      return r;
    },
  }),
  queries: (api) => ({
    quest: () => questInfo(api.state),
    joseph: () => josephInfo(api),
  }),
};

registerCareerExtension(questsExtension);

