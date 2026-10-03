// Lot 4 « Collection & enjeux doux » — logique partagée par les niveaux (src/core/game.js) et la carrière
// (src/core/career/cozy.js) : état, activation, migration, vérification ; aube et soir ; moteurs des fêtes
// participatives (chasse, marmite, étal, paniers, foire) ; hiver vivant (trouvailles, traces, mangeoire, veillée) ;
// compteurs de l'année ; faits des lanternes ; requêtes. Pur : aucun DOM, aucune horloge.
// Règles : docs/GAME_DESIGN.md § 17 ; contrat : docs/ARCHITECTURE.md, « Lot 4 — contrats » ; nombres : src/data/cozy.js.
//
// Tout ne s'active que si state.cozy existe (Détente et carrière par défaut ; clé ABSENTE en Classique : parité des
// niveaux 1 à 8). Tirages : un flux NOUVEAU, state.rng.cozy (cachettes de la chasse : 9 nombres ; trouvaille d'hiver :
// 5 nombres à chaque aube d'hiver ; oiseau : 1 nombre à l'aube qui suit un remplissage ; villageois des paniers :
// 3 nombres) ; aucun autre flux ne tire un nombre de plus.
//
// `host` (game.js pour les niveaux, l'extension pour la carrière) :
//   { mode: 'levels' | 'career', state, level, crops, push(type, payload), fail(reason),
//     earn(kind, amount)        kind : 'fete' | 'winter' (argent, bilan, statistiques)
//     spend(amount)             carrière : sachets de la foire aux graines (poste « seeds »)
//     rank()                    carrière : rang ; niveaux : 1
//     seasonLength(si)          durée de la saison si
//     patrimony()               carrière : patrimoine (prospérité des lanternes)
//     treeSeedCost(crop)        prix d'un plant (foire aux graines) }

import { SEASONS, SEASON_NAMES } from '../data/balance.js';
import { getCrop, isRareCrop, isTreeCrop } from '../data/crops.js';
import { getProduct, productsFor } from '../data/products.js';
import { CLIENTS, CLIENTS_BY_ID } from '../data/variety.js';
import { THEMES_BY_ID } from '../data/career/themes.js';
import {
  BASKET_LIKES, BIRDS, BIRDS_BY_ID, COZY_PARTS, COZY_VERSION, FEEDER, FETES, FETES_BY_ID, FETE_ENGINES, FETE_ENGINE_IDS, FETE_REWARDS,
  HIDDEN_KINDS, HIDDEN_NAMES, LANTERN_RULES, RIBBONS, SEED_FAIR, SOUP_CROPS, STAND_POINTS, STORY, THEME_FETE_GAMES, TRACES, TRACES_BY_ID,
  WINTER_FINDS, WINTER_FINDS_BY_ID, WINTER_RULES, careerFactor,
} from '../data/cozy.js';
import { hashSeed, stream } from './rng.js';
import { absDay } from './surprises.js';
import { currentTheme, isStarCrop, themeFestivalToday } from './variety-effects.js';
import { isTreeAdult } from './trees.js';
import { gameCrops } from './perks.js';
import { levelInvestments } from './economy.js';
import { lanternsFor } from './lanterns.js';

export { COZY_VERSION };

const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v) => Number.isInteger(v) && v >= 0;
const clone = (o) => JSON.parse(JSON.stringify(o));
const bump = (map, key, n = 1) => {
  map[key] = (map[key] || 0) + n;
};

/** Produits animaux (« ce que la ferme a produit ») : nom et icône. */
export const ANIMAL_PRODUCTS = {
  eggs: { name: 'Œufs', icon: 'product.eggs' },
  milk: { name: 'Lait', icon: 'product.milk' },
  wool: { name: 'Laine', icon: 'product.wool' },
  angora: { name: 'Laine angora', icon: 'product.angora' },
  duckEgg: { name: 'Œufs de cane', icon: 'product.duckEgg' },
  truffle: { name: 'Truffes', icon: 'product.truffle' },
};

// ── État ────────────────────────────────────────────────────────────────────────────────────────

/** Parties actives d'après l'option (true, { lanterns, fetes, winter, helpers } ; absentes = true). */
export function normalizeCozyParts(opt, mode = 'levels') {
  const out = {};
  for (const p of COZY_PARTS) out[p] = obj(opt) ? opt[p] !== false : true;
  if (mode !== 'career') out.helpers = false;
  return out;
}

/** Résumé du décor (critère « beauté » des niveaux). */
export function normalizeDecor(d) {
  const placed = obj(d) && Number.isFinite(d.placed) ? Math.max(0, Math.min(99, Math.floor(d.placed))) : 0;
  return { placed, path: obj(d) && d.path === true, fence: obj(d) && d.fence === true };
}

export function emptyCozyStats() {
  return {
    eggs: 0, eggsGold: 0, eggsAll: 0, fetes: {}, ribbons: { green: 0, blue: 0, gold: 0 }, ladles3: 0, hearts: 0,
    finds: {}, traces: {}, birds: {}, fish: {}, seedPacks: 0, handPicked: 0, handBonus: 0, weeded: 0, themesPlayed: {},
    // (ajouts de la livraison) meilleurs résultats (tampon 🏅), géants récoltés, produits animaux, visiteurs du thème.
    best: {}, giants: {}, animal: {}, themeVisitors: {},
    handCrops: {}, // carrière : récoltes à la main par culture (épreuves du comice, F1-5)
  };
}

/** Compteurs de l'année (niveaux : depuis le début de la partie ; carrière : depuis le dernier bilan). */
export function newCozyYear(since = 1, partial = false, base = {}) {
  return {
    since,
    partial,
    harvests: 0, hand: 0, cared: 0, handBonus: 0,
    produced: { crops: {}, products: {}, animal: {} },
    fine: {}, gold: {}, giants: {},
    fetes: {},
    hearts: 0, story: false, feederDays: 0, birds: {}, finds: 0,
    quests: 0, visitor: false, patrimonyStart: 0,
    animalCollected: 0, animalLost: 0,
    // Compteurs au début de l'année (commandes, caisses, quêtes) : l'année compte la différence.
    base: { orders: base.orders || 0, crates: base.crates || 0, quests: base.quests || 0 },
  };
}

function newWinter() {
  return { finds: [], traces: [], feeder: { filledDay: 0, bird: null, fills: 0, here: false }, storyDay: 0, nextId: 1 };
}

/** Nouvel état du lot (state.cozy). */
export function newCozyState(parts = normalizeCozyParts(true), { partial = false, decor = null, since = 1, base = {} } = {}) {
  return {
    v: COZY_VERSION,
    parts: { ...parts },
    decor: normalizeDecor(decor),
    year: newCozyYear(since, partial, base),
    fete: null,
    stand: null,
    winter: newWinter(),
    seedBank: {},
    lanterns: null,
    lit: null,
    stats: emptyCozyStats(),
  };
}

function ensureStream(state) {
  if (!Number.isInteger(state.rng?.cozy)) state.rng.cozy = hashSeed(state.seed, 'cozy');
}

/** Compteurs du lot 3 au début de l'année (commandes, caisses) et quêtes de Joseph (carrière). */
export function yearBaseOf(state) {
  return {
    orders: state.variety?.stats?.ordersDone || 0,
    crates: state.variety?.stats?.cratesFull || 0,
    quests: state.mode === 'career' ? state.career?.lifetime?.questsDone || 0 : 0,
  };
}

/** Active le lot : état et flux. `opt` : true | { lanterns, fetes, winter, helpers, decor }. */
export function enableCozy(state, opt = true, { partial = false } = {}) {
  const mode = state.mode === 'career' ? 'career' : 'levels';
  if (!state.cozy) {
    state.cozy = newCozyState(normalizeCozyParts(opt, mode), {
      partial,
      decor: obj(opt) ? opt.decor : null,
      since: state.time ? absDay(state) : 1,
      base: yearBaseOf(state),
    });
    if (mode === 'career') {
      state.cozy.lanterns = { history: [] };
      state.cozy.statsBase = emptyCozyStats();
    }
  }
  ensureStream(state);
  return state.cozy;
}

/** Complète un état chargé (champs ajoutés plus tard). */
export function completeCozy(state) {
  const z = state.cozy;
  if (!obj(z)) return;
  const mode = state.mode === 'career' ? 'career' : 'levels';
  const d = newCozyState(normalizeCozyParts(true, mode));
  for (const [k, val] of Object.entries(d)) if (z[k] === undefined) z[k] = val;
  for (const [k, val] of Object.entries(d.parts)) if (z.parts[k] === undefined) z.parts[k] = val;
  if (mode !== 'career') z.parts.helpers = false;
  z.decor = normalizeDecor(z.decor);
  if (obj(z.year)) {
    for (const [k, val] of Object.entries(newCozyYear())) if (z.year[k] === undefined) z.year[k] = val;
    for (const k of ['crops', 'products', 'animal']) if (!obj(z.year.produced[k])) z.year.produced[k] = {};
  }
  if (obj(z.stats)) {
    for (const [k, val] of Object.entries(emptyCozyStats())) if (z.stats[k] === undefined) z.stats[k] = val;
  }
  if (obj(z.winter)) {
    for (const [k, val] of Object.entries(newWinter())) if (z.winter[k] === undefined) z.winter[k] = val;
    if (obj(z.winter.feeder)) for (const [k, val] of Object.entries(newWinter().feeder)) if (z.winter.feeder[k] === undefined) z.winter.feeder[k] = val;
  }
  if (mode === 'career') {
    if (!obj(z.lanterns)) z.lanterns = { history: [] };
    if (!obj(z.statsBase)) z.statsBase = emptyCozyStats();
    for (const [k, val] of Object.entries(emptyCozyStats())) if (z.statsBase[k] === undefined) z.statsBase[k] = val;
  }
  ensureStream(state);
}

/**
 * Migration d'une sauvegarde d'avant le lot 4 (Détente ou carrière) : le lot s'active à la reprise ; les compteurs
 * des lanternes commencent à zéro (« Année commencée avant les lanternes ») ; hiver en cours : la mangeoire est là.
 */
export function migrateToCozy(state) {
  const z = enableCozy(state, true, { partial: true });
  if (SEASONS[state.time.seasonIndex] === 'winter') {
    z.winter.feeder.here = true;
    if (state.time.dayOfSeason <= STORY.day) z.winter.storyDay = absDay(state) + (STORY.day - state.time.dayOfSeason);
    else z.winter.storyDay = absDay(state);
  }
  return z;
}

/** Vérifie state.cozy (sauvegarde). → null | 'problème'. */
export function checkCozy(state) {
  const z = state.cozy;
  if (z === undefined || z === null) return null;
  if (!obj(z) || z.v !== COZY_VERSION) return 'lot 4';
  if (!obj(z.parts) || !COZY_PARTS.every((p) => typeof z.parts[p] === 'boolean')) return 'lot 4 (parties)';
  if (!obj(z.decor) || !int(z.decor.placed)) return 'lot 4 (décor)';
  const y = z.year;
  if (!obj(y) || !int(y.since) || typeof y.partial !== 'boolean') return 'lot 4 (année)';
  for (const k of ['harvests', 'hand', 'cared', 'handBonus', 'hearts', 'feederDays', 'finds', 'quests', 'animalCollected']) if (!(Number.isFinite(y[k]) && y[k] >= 0)) return `lot 4 (année : ${k})`;
  if (!obj(y.produced) || !['crops', 'products', 'animal'].every((k) => obj(y.produced[k]))) return 'lot 4 (production)';
  for (const id of Object.keys(y.produced.crops)) if (!getCrop(id)) return 'lot 4 (culture)';
  for (const id of Object.keys(y.produced.products)) if (!getProduct(id)) return 'lot 4 (produit)';
  for (const id of Object.keys(y.produced.animal)) if (!ANIMAL_PRODUCTS[id]) return 'lot 4 (produit animal)';
  for (const k of ['fine', 'gold', 'giants']) {
    if (!obj(y[k])) return 'lot 4 (qualité)';
    for (const [id, n] of Object.entries(y[k])) if (!getCrop(id) || !int(n)) return 'lot 4 (qualité)';
  }
  if (!obj(y.fetes)) return 'lot 4 (fêtes de l\'année)';
  for (const id of Object.keys(y.fetes)) if (!feteIdKnown(id)) return `lot 4 (fête ${id})`;
  if (!obj(y.birds) || !Object.keys(y.birds).every((id) => BIRDS_BY_ID[id])) return 'lot 4 (oiseaux)';
  const f = z.fete;
  if (f !== null) {
    if (!obj(f) || !feteIdKnown(f.id) || !FETE_ENGINE_IDS.includes(f.engine) || !int(f.day)) return 'lot 4 (fête)';
    if (f.themeId !== null && f.themeId !== undefined && !THEMES_BY_ID[f.themeId]) return 'lot 4 (fête du thème)';
    if (f.hidden !== null && f.hidden !== undefined) {
      if (!Array.isArray(f.hidden) || f.hidden.length > FETE_ENGINES.chasse.count) return 'lot 4 (objets cachés)';
      for (const h of f.hidden) {
        if (!obj(h) || !(typeof h.u === 'number' && h.u >= 0 && h.u < 1) || typeof h.gold !== 'boolean') return 'lot 4 (objet caché)';
        if (![null, 'player', 'village'].includes(h.found)) return 'lot 4 (objet caché)';
      }
    }
    if (f.villagers !== null && f.villagers !== undefined) {
      if (!Array.isArray(f.villagers) || f.villagers.length !== 3 || !f.villagers.every((id) => CLIENTS_BY_ID[id])) return 'lot 4 (villageois)';
    }
    if (typeof f.done !== 'boolean') return 'lot 4 (fête)';
  }
  if (z.stand !== null && !(obj(z.stand) && int(z.stand.year) && RIBBONS.some((r) => r.id === z.stand.ribbon))) return 'lot 4 (stand)';
  const w = z.winter;
  if (!obj(w) || !Array.isArray(w.finds) || !Array.isArray(w.traces) || !obj(w.feeder) || !int(w.storyDay) || !int(w.nextId)) return 'lot 4 (hiver)';
  if (w.finds.length > WINTER_RULES.maxFinds) return 'lot 4 (trouvailles)';
  for (const x of w.finds) if (!obj(x) || typeof x.id !== 'string' || !WINTER_FINDS_BY_ID[x.kind] || !(x.u >= 0 && x.u < 1) || !int(x.day)) return 'lot 4 (trouvaille)';
  for (const x of w.traces) if (!obj(x) || !TRACES_BY_ID[x.kind] || !(x.u >= 0 && x.u < 1)) return 'lot 4 (trace)';
  if (!int(w.feeder.filledDay) || (w.feeder.bird !== null && !(obj(w.feeder.bird) && BIRDS_BY_ID[w.feeder.bird.id]))) return 'lot 4 (mangeoire)';
  if (!obj(z.seedBank)) return 'lot 4 (réserve de graines)';
  for (const [id, n] of Object.entries(z.seedBank)) if (!getCrop(id) || !int(n)) return 'lot 4 (réserve de graines)';
  if (z.lanterns !== null && !(obj(z.lanterns) && Array.isArray(z.lanterns.history))) return 'lot 4 (lanternes)';
  if (!obj(z.stats)) return 'lot 4 (statistiques)';
  for (const k of ['eggs', 'eggsGold', 'eggsAll', 'ladles3', 'hearts', 'seedPacks', 'handPicked', 'weeded']) if (!int(z.stats[k])) return `lot 4 (statistiques : ${k})`;
  for (const id of Object.keys(z.stats.birds || {})) if (!BIRDS_BY_ID[id]) return 'lot 4 (oiseaux)';
  for (const id of Object.keys(z.stats.finds || {})) if (!WINTER_FINDS_BY_ID[id]) return 'lot 4 (trouvailles)';
  for (const id of Object.keys(z.stats.traces || {})) if (!TRACES_BY_ID[id]) return 'lot 4 (traces)';
  if (state.mode === 'career') {
    const today = absDay(state);
    for (const p of state.plots) {
      if (p.ripeAt !== undefined && !(Number.isInteger(p.ripeAt) && p.ripeAt <= today)) return 'lot 4 (maturité)';
      if (p.weeded !== undefined && typeof p.weeded !== 'boolean') return 'lot 4 (désherbage)';
    }
  }
  return null;
}

function feteIdKnown(id) {
  if (FETES_BY_ID[id]) return true;
  return typeof id === 'string' && id.startsWith('theme.') && !!THEMES_BY_ID[id.slice(6)];
}

// ── Calendrier des fêtes ───────────────────────────────────────────────────────────────────────

const dayMatches = (f, day, len) => (f.day === 'last' ? day === len : f.day === day);

/** Fête d'un jour (saison si, jour de la saison) : { id, engine, themeId, name, icon, text, def } ou null. */
export function feteOn(host, si, day, { themeOk = true } = {}) {
  const { state } = host;
  const sid = SEASONS[si];
  const len = host.seasonLength(si);
  if (host.mode === 'career') {
    const rank = host.rank();
    const f = FETES.find((x) => x.career !== null && x.career <= rank && x.seasonId === sid && dayMatches(x, day, len));
    if (f) return { id: f.id, engine: f.engine, themeId: null, name: f.name, icon: f.icon, text: f.text, album: f.album };
    if (!themeOk) return null;
    const th = currentTheme(state);
    if (th && th.festival.seasonId === sid && th.festival.day === day && THEME_FETE_GAMES[th.id]) {
      const g = THEME_FETE_GAMES[th.id];
      return { id: `theme.${th.id}`, engine: g.engine, themeId: th.id, name: g.name, icon: `icon.theme.${th.id}`, text: g.text, album: null };
    }
    return null;
  }
  const lv = host.level.id;
  const f = FETES.find((x) => x.levels.includes(lv) && x.seasonId === sid && dayMatches(x, day, len));
  return f ? { id: f.id, engine: f.engine, themeId: null, name: f.name, icon: f.icon, text: f.text, album: f.album } : null;
}

/** Fête de demain (veille) ; null après le dernier jour de l'année (niveaux). */
function feteTomorrow(host) {
  const { state } = host;
  let si = state.time.seasonIndex;
  let day = state.time.dayOfSeason + 1;
  let wrapped = false;
  if (day > host.seasonLength(si)) {
    day = 1;
    si += 1;
    if (si >= SEASONS.length) {
      if (host.mode !== 'career') return null;
      si = 0;
      wrapped = true;
    }
  }
  return feteOn(host, si, day, { themeOk: !wrapped });
}

/** Prochaines fêtes : [{ id, name, engine, seasonId, day, daysUntil, text }] (au plus 5). */
function upcomingFetes(host) {
  const { state } = host;
  const out = [];
  let si = state.time.seasonIndex;
  let day = state.time.dayOfSeason;
  let wrapped = false;
  const total = SEASONS.reduce((n, _, k) => n + host.seasonLength(k), 0);
  for (let d = 0; d < total && out.length < 5; d++) {
    if (d > 0) {
      day += 1;
      if (day > host.seasonLength(si)) {
        day = 1;
        si += 1;
        if (si >= SEASONS.length) {
          if (host.mode !== 'career') break;
          si = 0;
          wrapped = true;
        }
      }
    }
    const f = feteOn(host, si, day, { themeOk: !wrapped });
    if (!f) continue;
    if (d === 0 && state.cozy.fete && state.cozy.fete.id === f.id && state.cozy.fete.done) continue;
    out.push({ id: f.id, name: f.name, engine: f.engine, seasonId: SEASONS[si], day, daysUntil: d, text: f.text });
  }
  return out;
}

// ── Compteurs ──────────────────────────────────────────────────────────────────────────────────

/**
 * Une récolte (les deux modes) : compteurs de l'année (lanternes, fêtes) et de la partie.
 * { cropId, quality, cared, by, units, giant, handBonus }
 */
export function noteCozyHarvest(state, { cropId, quality = 'normal', cared = false, by = 'player', units = 1, giant = false, handBonus = 0 }) {
  const z = state.cozy;
  if (!z) return;
  const y = z.year;
  const hand = by === 'player';
  y.harvests += units;
  if (hand) y.hand += units;
  if (state.mode === 'career') {
    if (hand && (cared || quality === 'fine' || quality === 'gold')) y.cared += units;
    if (hand) {
      z.stats.handPicked += units;
      bump(z.stats.handCrops, cropId, units);
    }
  } else if (cared || quality === 'fine' || quality === 'gold') y.cared += units;
  if (handBonus > 0) {
    y.handBonus += handBonus;
    z.stats.handBonus += handBonus;
  }
  bump(y.produced.crops, cropId, units);
  if (quality === 'fine') bump(y.fine, cropId);
  if (quality === 'gold') bump(y.gold, cropId);
  if (giant) {
    bump(y.giants, cropId);
    bump(z.stats.giants, cropId);
  }
}

/** Un produit transformé vendu. */
export function noteCozyProduct(state, productId, n = 1) {
  if (!state.cozy || !getProduct(productId)) return;
  bump(state.cozy.year.produced.products, productId, n);
}

/** Un produit animal (œufs, lait, laine…) ramassé ou rapporté. */
export function noteCozyAnimal(state, id, n = 1) {
  if (!state.cozy || !ANIMAL_PRODUCTS[id] || !(n > 0)) return;
  bump(state.cozy.year.produced.animal, id, n);
  bump(state.cozy.stats.animal, id, n);
}

/** Niveaux : produits animaux d'après les revenus de l'aube (poulailler → œufs ; vache, chèvre → lait ; tonte → laine). */
export function noteLevelIncomes(state, incomes, milkToDairy = []) {
  if (!state.cozy) return;
  for (const inc of incomes || []) {
    if (!(inc.amount > 0)) continue;
    if (inc.source === 'chickenCoop') noteCozyAnimal(state, 'eggs');
    else if ((inc.source === 'cow' || inc.source === 'goat') && inc.kind !== 'shearing') noteCozyAnimal(state, 'milk');
    else if (inc.kind === 'shearing' || (inc.source === 'sheep' && inc.shearing)) noteCozyAnimal(state, 'wool');
  }
  if ((milkToDairy || []).length) noteCozyAnimal(state, 'milk');
}

// ── Récompenses ────────────────────────────────────────────────────────────────────────────────

function coinsFor(host, base) {
  return host.mode === 'career' ? Math.round(base * careerFactor(host.rank())) : base;
}

function noteFetePlayed(host, fete, entry) {
  const z = host.state.cozy;
  const first = !z.year.fetes[fete.id];
  z.year.fetes[fete.id] = { ...(z.year.fetes[fete.id] || {}), engine: fete.engine, day: fete.day, ...entry };
  if (first) {
    const def = FETES_BY_ID[fete.id];
    if (def) bump(z.stats.fetes, def.album);
    if (fete.themeId) bump(z.stats.themesPlayed, fete.themeId);
  }
}

function noteBest(host, fete) {
  const def = FETES_BY_ID[fete.id];
  if (def) host.state.cozy.stats.best[def.album] = 1;
}

// ── Choix des mini-jeux (ce que la ferme a produit cette année) ────────────────────────────────

function itemName(kind, id) {
  if (kind === 'crop') return getCrop(id)?.name ?? id;
  if (kind === 'product') return getProduct(id)?.name ?? id;
  return ANIMAL_PRODUCTS[id]?.name ?? id;
}

function itemIcon(kind, id) {
  if (kind === 'crop') return `crop.${id}.icon`;
  if (kind === 'product') return `product.${id}`;
  return ANIMAL_PRODUCTS[id]?.icon ?? `product.${id}`;
}

function starOf(state, kind, id) {
  if (state.mode !== 'career') return false;
  const th = currentTheme(state);
  if (!th) return false;
  if (kind === 'crop') return isStarCrop(state, id);
  return th.star.kind === 'product' && th.star.ids.includes(id);
}

/** itemInfo d'un produit de l'année. */
export function itemInfo(state, kind, id) {
  const y = state.cozy.year;
  const crop = kind === 'crop';
  return {
    kind,
    id,
    name: itemName(kind, id),
    icon: itemIcon(kind, id),
    quality: crop && (y.gold[id] || 0) > 0 ? 'gold' : crop && (y.fine[id] || 0) > 0 ? 'fine' : 'normal',
    giant: crop && (y.giants[id] || 0) > 0,
    star: starOf(state, kind, id),
    homemade: kind === 'product',
  };
}

/** Tout ce que la ferme a produit cette année : [itemInfo]. */
export function producedItems(state) {
  const p = state.cozy.year.produced;
  const out = [];
  for (const [kind, map] of [['crop', p.crops], ['product', p.products], ['animal', p.animal]]) {
    for (const [id, n] of Object.entries(map)) if (n > 0) out.push(itemInfo(state, kind, id));
  }
  return out;
}

function producedHas(state, item) {
  if (!obj(item)) return false;
  const p = state.cozy.year.produced;
  const map = item.kind === 'crop' ? p.crops : item.kind === 'product' ? p.products : item.kind === 'animal' ? p.animal : null;
  return !!map && (map[item.id] || 0) > 0;
}

function soupAccepts(fete) {
  const g = fete.themeId ? THEME_FETE_GAMES[fete.themeId] : null;
  return g?.accept || SOUP_CROPS;
}

function standSlots(fete) {
  const g = fete.themeId ? THEME_FETE_GAMES[fete.themeId] : null;
  return g?.slots || FETE_ENGINES.etal.slots;
}

function choicesFor(state, fete) {
  if (!['marmite', 'etal', 'paniers'].includes(fete.engine)) return null;
  const all = producedItems(state);
  if (fete.engine !== 'marmite') return all;
  const acc = soupAccepts(fete);
  return all.filter((it) => it.kind === 'crop' && acc.includes(it.id));
}

// ── Moteurs : calculs purs (aperçu et validation) ─────────────────────────────────────────────

function soupResult(host, fete, items) {
  const { state } = host;
  if (!Array.isArray(items) || items.length < 1 || items.length > FETE_ENGINES.marmite.max) return { reason: 'De 1 à 3 légumes différents.' };
  const ids = items.map((it) => (obj(it) ? it.id : it));
  if (new Set(ids).size !== ids.length) return { reason: 'De 1 à 3 légumes différents.' };
  const acc = soupAccepts(fete);
  for (const id of ids) {
    const name = getCrop(id)?.name ?? id;
    if (!acc.includes(id)) return { reason: `${name} : pas dans cette soupe.` };
    if (!producedHas(state, { kind: 'crop', id })) return { reason: `${name} : pas récolté cette année.` };
  }
  const g = fete.themeId ? THEME_FETE_GAMES[fete.themeId] : null;
  if (g?.require && !ids.includes(g.require)) return { reason: `${g.name} : du ${getCrop(g.require)?.name.toLowerCase() ?? g.require} obligatoire.` };
  const y = state.cozy.year;
  const beau = ids.some((id) => (y.fine[id] || 0) + (y.gold[id] || 0) + (y.giants[id] || 0) > 0);
  let ladles = Math.min(3, ids.length);
  if (ladles === 3 && state.surprises && !beau) ladles = 2;
  const r = FETE_REWARDS.marmite;
  return { ladles, amount: coinsFor(host, r.coins[ladles - 1]), ecus: r.ecus[ladles - 1], ids };
}

function standPointsOf(state, fete, item) {
  const y = state.cozy.year;
  const g = fete.themeId ? THEME_FETE_GAMES[fete.themeId] : null;
  let pts = STAND_POINTS.item;
  if (item.kind === 'crop') {
    if ((y.gold[item.id] || 0) > 0) pts += STAND_POINTS.gold;
    else if ((y.fine[item.id] || 0) > 0) pts += STAND_POINTS.fine;
    if ((y.giants[item.id] || 0) > 0) pts += g?.giant ?? STAND_POINTS.giant;
  }
  if (item.kind === 'product') pts += STAND_POINTS.homemade;
  if (starOf(state, item.kind, item.id)) pts += STAND_POINTS.star;
  if (g?.bonus?.[item.id]) pts += g.bonus[item.id];
  return pts;
}

function standResult(host, fete, items) {
  const { state } = host;
  const slots = standSlots(fete);
  if (!Array.isArray(items) || items.length < 1 || items.length > slots) return { reason: `De 1 à ${slots} produits différents.` };
  const keys = items.map((it) => (obj(it) ? `${it.kind}:${it.id}` : ''));
  if (keys.includes('') || new Set(keys).size !== keys.length) return { reason: `De 1 à ${slots} produits différents.` };
  for (const it of items) if (!producedHas(state, it)) return { reason: `${itemName(it.kind, it.id)} : pas produit cette année.` };
  const detail = items.map((it) => ({ item: { kind: it.kind, id: it.id }, points: standPointsOf(state, fete, it) }));
  const score = detail.reduce((s, d) => s + d.points, 0);
  let ribbon = 'green';
  for (const r of RIBBONS) if (score >= r.min) ribbon = r.id;
  const R = FETE_REWARDS.etal;
  return { score, ribbon, amount: coinsFor(host, R.coins[ribbon]), ecus: R.ecus[ribbon], detail };
}

/** Ce qu'aime un villageois : ses cultures préférées (lot 3) et un produit. */
export function villagerLikes(clientId) {
  const c = CLIENTS_BY_ID[clientId];
  if (!c) return [];
  return [...c.favorites.map((id) => ({ kind: 'crop', id })), ...(BASKET_LIKES[clientId] ? [{ kind: getProduct(BASKET_LIKES[clientId]) ? 'product' : 'animal', id: BASKET_LIKES[clientId] }] : [])];
}

function basketsResult(host, fete, baskets) {
  const { state } = host;
  const E = FETE_ENGINES.paniers;
  if (!Array.isArray(baskets) || baskets.length !== E.baskets) return { reason: 'Un produit au moins dans chaque panier.' };
  const seen = new Set();
  const perBasket = [];
  for (let k = 0; k < baskets.length; k++) {
    const b = (Array.isArray(baskets[k]) ? baskets[k] : []).filter(Boolean);
    if (b.length < 1 || b.length > E.perBasket) return { reason: 'Un produit au moins dans chaque panier.' };
    let hearts = 0;
    const likes = villagerLikes(fete.villagers[k]).map((l) => l.id);
    for (const it of b) {
      if (!obj(it)) return { reason: 'Un produit au moins dans chaque panier.' };
      const key = `${it.kind}:${it.id}`;
      if (seen.has(key)) return { reason: 'Un même produit une seule fois.' };
      seen.add(key);
      if (!producedHas(state, it)) return { reason: `${itemName(it.kind, it.id)} : pas produit cette année.` };
      if (likes.includes(it.id)) hearts += 1;
    }
    perBasket.push(hearts);
  }
  const hearts = perBasket.reduce((a, b) => a + b, 0);
  const R = FETE_REWARDS.paniers;
  return { hearts, perBasket, amount: coinsFor(host, R.perBasket * E.baskets + R.perHeart * hearts), ecus: hearts };
}

// ── Aube et soir ──────────────────────────────────────────────────────────────────────────────

/** Nouvelle fête du jour (tirages : chasse 9 nombres, paniers 3 nombres). */
function startFete(host, f) {
  const { state } = host;
  const z = state.cozy;
  const fete = { id: f.id, engine: f.engine, themeId: f.themeId || null, day: absDay(state), hidden: null, villagers: null, done: false, result: null };
  if (f.engine === 'chasse') {
    const rng = stream(state.rng, 'cozy');
    const us = [];
    for (let k = 0; k < FETE_ENGINES.chasse.count; k++) us.push(rng.float());
    const gold = rng.int(0, FETE_ENGINES.chasse.count - 1);
    fete.hidden = us.map((u, k) => ({ u: Math.min(0.999999, Math.max(0, u)), gold: k === gold, found: null }));
  } else if (f.engine === 'paniers') {
    const rng = stream(state.rng, 'cozy');
    const pool = CLIENTS.map((c) => c.id);
    const picked = [];
    for (let k = 0; k < FETE_ENGINES.paniers.baskets; k++) picked.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    fete.villagers = picked;
  }
  z.fete = fete;
  return fete;
}

function hiddenKind(fete) {
  if (fete.engine !== 'chasse') return null;
  return fete.themeId ? THEME_FETE_GAMES[fete.themeId]?.kind || 'egg' : 'egg';
}

function weightedPick(list, weightOf, u) {
  const total = list.reduce((s, x) => s + Math.max(0, weightOf(x)), 0);
  if (!(total > 0)) return null;
  let r = u * total;
  for (const x of list) {
    const w = Math.max(0, weightOf(x));
    if (w <= 0) continue;
    if (r < w) return x;
    r -= w;
  }
  return list.filter((x) => weightOf(x) > 0).at(-1) || null;
}

/** Début d'une saison (niveaux : depuis cozyDawn ; carrière : point d'accroche seasonStart). */
export function cozySeasonStart(host) {
  const { state } = host;
  const z = state.cozy;
  if (!z) return [];
  const sid = SEASONS[state.time.seasonIndex];
  const w = z.winter;
  if (sid === 'winter') {
    w.feeder = { filledDay: 0, bird: null, fills: 0, here: !!z.parts.winter };
    w.storyDay = z.parts.winter ? absDay(state) + (STORY.day - state.time.dayOfSeason) : 0;
  } else if (sid === 'spring') {
    w.finds = [];
    w.traces = [];
    w.feeder = { filledDay: 0, bird: null, fills: 0, here: false };
    w.storyDay = 0;
  }
  return [];
}

/**
 * Aube : fête d'hier effacée ; fêtes (veille, jour) ; hiver (trouvaille, trace, oiseau, veillée). → [[type, payload]]
 * Niveaux : après varietyDawn (newSeason : appelle aussi cozySeasonStart). Carrière : point d'accroche dawnEvents.
 */
export function cozyDawn(host, { newSeason = false, weather = host.state.weather.today } = {}) {
  const { state } = host;
  const z = state.cozy;
  if (!z) return [];
  const events = [];
  if (newSeason && host.mode !== 'career') cozySeasonStart(host);
  const today = absDay(state);
  if (z.fete && z.fete.day !== today) z.fete = null;
  z.winter.traces = [];
  if (z.winter.feeder.bird && z.winter.feeder.bird.day !== today) z.winter.feeder.bird = null;
  // Fêtes.
  if (z.parts.fetes) {
    const f = feteOn(host, state.time.seasonIndex, state.time.dayOfSeason);
    if (f && !z.fete) {
      const fete = startFete(host, f);
      events.push(['feteStarted', { fete: feteInfo(host), text: `${f.name} : aujourd'hui !` }]);
      void fete;
    }
    const t = feteTomorrow(host);
    if (t) events.push(['feteSoon', { id: t.id, name: t.name, engine: t.engine, day: state.time.dayOfSeason + 1, text: `Demain, ${t.name.charAt(0).toLowerCase()}${t.name.slice(1)} !` }]);
  }
  // Hiver vivant.
  if (z.parts.winter && SEASONS[state.time.seasonIndex] === 'winter') {
    const w = z.winter;
    w.feeder.here = true;
    const rng = stream(state.rng, 'cozy');
    const r = [rng.float(), rng.float(), rng.float(), rng.float(), rng.float()];
    const added = [];
    if (w.finds.length < WINTER_RULES.maxFinds) {
      const kind = weightedPick(WINTER_FINDS, (x) => x.weight, r[0]);
      const find = { id: `w${w.nextId++}`, kind: kind.id, u: Math.min(0.999999, r[1]), day: today };
      w.finds.push(find);
      added.push({ ...find });
    }
    let trace = null;
    if (weather === 'snow' && r[2] < TRACES.chance) {
      const kind = weightedPick(TRACES.kinds, (x) => x.weight, r[3]);
      trace = { kind: kind.id, u: Math.min(0.999999, r[4]), day: today };
      w.traces = [trace];
      bump(z.stats.traces, kind.id);
    }
    if (added.length || trace) events.push(['winterFind', { finds: added, trace: trace ? { kind: trace.kind, u: trace.u } : null }]);
    // Oiseau : le lendemain d'un remplissage (1 tirage).
    if (w.feeder.filledDay > 0 && w.feeder.filledDay === today - 1) {
      const u = stream(state.rng, 'cozy').float();
      const b = weightedPick(BIRDS, (x) => (w.feeder.fills >= x.minFills ? x.weight * ((z.stats.birds[x.id] || 0) > 0 ? 1 : FEEDER.unseenFactor) : 0), u);
      if (b) {
        const first = !(z.stats.birds[b.id] > 0);
        w.feeder.bird = { id: b.id, day: today };
        bump(z.stats.birds, b.id);
        z.year.birds[b.id] = 1;
        events.push(['feederBird', { bird: { id: b.id, name: b.name }, first }]);
      }
    }
    if (w.storyDay > 0 && w.storyDay === today && !z.year.story) events.push(['storyReady', { text: 'Ce soir, veillée chez Joseph : il vous attend quand vous voulez, tout l\'hiver.' }]);
  }
  return events;
}

/** Soir : fin de la fête du jour (les objets non trouvés sont trouvés par le village). → [[type, payload]] */
export function cozyEvening(host) {
  const { state } = host;
  const z = state.cozy;
  if (!z || !z.fete || z.fete.day !== absDay(state) || z.fete.ended) return [];
  const fete = z.fete;
  fete.ended = true;
  let n = 0;
  let amount = 0;
  let text = '';
  if (fete.engine === 'chasse') {
    const R = FETE_REWARDS.chasse;
    for (const h of fete.hidden || []) {
      if (h.found) continue;
      h.found = 'village';
      n += 1;
      amount += coinsFor(host, h.gold ? R.villageGold : R.village);
    }
    if (amount > 0) host.earn('fete', amount);
    const kind = HIDDEN_NAMES[hiddenKind(fete)] || 'œufs';
    text = n > 0 ? `Lili et les enfants du village ont trouvé ${n === 1 ? `le dernier des ${kind}` : `les ${n} derniers ${kind}`} pour vous !` : 'Quelle belle chasse !';
  } else if (!fete.done) {
    text = fete.engine === 'marmite' ? 'La soupe était bonne ! On vous en a gardé un bol.' : fete.engine === 'foire' ? 'La foire est finie : elle revient à la fin de l\'hiver prochain.' : 'La fête est finie : elle revient l\'an prochain.';
  } else text = 'Quelle belle fête !';
  return [['feteEnded', { id: fete.id, helped: { n, amount }, text }]];
}

// ── Actions ────────────────────────────────────────────────────────────────────────────────────

function todayFete(host, engines) {
  const z = host.state.cozy;
  const f = z?.fete;
  if (!f || f.day !== absDay(host.state) || f.ended) return null;
  return engines.includes(f.engine) ? f : null;
}

/** Chasse : toucher un objet caché. → { ok, index, gold, amount, found, total } */
export function feteFind(host, index) {
  const f = todayFete(host, ['chasse']);
  if (!f) return host.fail('Pas de chasse aujourd\'hui.');
  const h = Number.isInteger(index) ? f.hidden[index] : null;
  if (!h) return host.fail('Objet inconnu.');
  if (h.found) return host.fail('Déjà trouvé !');
  const z = host.state.cozy;
  const R = FETE_REWARDS.chasse;
  h.found = 'player';
  const amount = coinsFor(host, h.gold ? R.foundGold : R.found);
  host.earn('fete', amount);
  z.stats.eggs += 1;
  if (h.gold) z.stats.eggsGold += 1;
  const found = f.hidden.filter((x) => x.found === 'player').length;
  const total = f.hidden.length;
  f.result = { found, amount: (f.result?.amount || 0) + amount, ecus: 0 };
  noteFetePlayed(host, f, { eggs: found, score: found });
  host.push('feteFound', { index, kind: hiddenKind(f), gold: h.gold, amount, found, total });
  if (found === total) {
    f.done = true;
    f.result.ecus = R.allEcus;
    z.stats.eggsAll += 1;
    noteBest(host, f);
    host.push('feteDone', { id: f.id, engine: 'chasse', score: found, amount: f.result.amount, ecus: R.allEcus, text: 'Bravo, vous avez tout trouvé !' });
  }
  return { ok: true, index, gold: h.gold, amount, found, total };
}

/** Soupe partagée. → { ok, ladles, amount, ecus, text } */
export function cookSoup(host, items) {
  const f = todayFete(host, ['marmite']);
  if (!f) return host.fail('Pas de soupe aujourd\'hui.');
  if (f.done) return host.fail('Déjà goûtée : merci !');
  const r = soupResult(host, f, items);
  if (r.reason) return host.fail(r.reason);
  const z = host.state.cozy;
  f.done = true;
  const text = r.ladles === 3 ? 'La meilleure soupe de l\'année !' : r.ladles === 2 ? 'Un régal !' : 'Une bonne soupe, merci !';
  f.result = { score: r.ladles, ladles: r.ladles, amount: r.amount, ecus: r.ecus, items: r.ids.map((id) => ({ kind: 'crop', id })) };
  host.earn('fete', r.amount);
  if (r.ladles === 3) {
    z.stats.ladles3 += 1;
    noteBest(host, f);
  }
  noteFetePlayed(host, f, { ladles: r.ladles, score: r.ladles });
  host.push('feteDone', { id: f.id, engine: 'marmite', ladles: r.ladles, amount: r.amount, ecus: r.ecus, text });
  return { ok: true, ladles: r.ladles, amount: r.amount, ecus: r.ecus, text };
}

/** Stand de la ferme. → { ok, score, ribbon, amount, ecus, detail } */
export function presentStand(host, items) {
  const f = todayFete(host, ['etal']);
  if (!f) return host.fail('Pas de stand aujourd\'hui.');
  if (f.done) return host.fail('Déjà présenté : bravo !');
  const r = standResult(host, f, items);
  if (r.reason) return host.fail(r.reason);
  const { state } = host;
  const z = state.cozy;
  f.done = true;
  f.result = { score: r.score, ribbon: r.ribbon, amount: r.amount, ecus: r.ecus, items: items.map((it) => ({ kind: it.kind, id: it.id })) };
  host.earn('fete', r.amount);
  z.stats.ribbons[r.ribbon] = (z.stats.ribbons[r.ribbon] || 0) + 1;
  if (r.ribbon === 'gold') noteBest(host, f);
  noteFetePlayed(host, f, { ribbon: r.ribbon, score: r.score });
  // Carrière : le stand de la fête des récoltes est gardé pour le comice.
  if (host.mode === 'career' && f.id === 'harvestFestival') z.stand = { year: state.time.year, ribbon: r.ribbon, score: r.score };
  const ribbonName = RIBBONS.find((x) => x.id === r.ribbon).name;
  host.push('feteDone', { id: f.id, engine: 'etal', score: r.score, ribbon: r.ribbon, amount: r.amount, ecus: r.ecus, text: `${ribbonName} !` });
  return { ok: true, score: r.score, ribbon: r.ribbon, amount: r.amount, ecus: r.ecus, detail: r.detail };
}

/** Paniers de Noël. → { ok, hearts, perBasket, amount, ecus } */
export function giveBaskets(host, baskets) {
  const f = todayFete(host, ['paniers']);
  if (!f) return host.fail('Pas de paniers aujourd\'hui.');
  if (f.done) return host.fail('Déjà offerts : merci !');
  const r = basketsResult(host, f, baskets);
  if (r.reason) return host.fail(r.reason);
  const z = host.state.cozy;
  f.done = true;
  f.result = { score: r.hearts, hearts: r.hearts, amount: r.amount, ecus: r.ecus, items: baskets.map((b) => b.filter(Boolean).map((it) => ({ kind: it.kind, id: it.id }))) };
  host.earn('fete', r.amount);
  z.year.hearts += r.hearts;
  z.stats.hearts += r.hearts;
  if (r.hearts >= 6) noteBest(host, f);
  noteFetePlayed(host, f, { hearts: r.hearts, score: r.hearts });
  host.push('feteDone', { id: f.id, engine: 'paniers', hearts: r.hearts, amount: r.amount, ecus: r.ecus, text: r.hearts >= 4 ? 'Oh, leurs préférés !' : 'Merci, c\'est trop gentil !' });
  return { ok: true, hearts: r.hearts, perBasket: r.perBasket, amount: r.amount, ecus: r.ecus };
}

/** Aperçu en direct (pur, rien n'est écrit). → { score?, ladles?, ribbon?, hearts?, amount } */
export function fetePreview(host, items) {
  const f = host.state.cozy?.fete;
  if (!f || f.day !== absDay(host.state)) return null;
  if (f.engine === 'marmite') {
    const r = soupResult(host, f, items);
    return r.reason ? { ladles: 0, amount: 0, reason: r.reason } : { ladles: r.ladles, amount: r.amount, ecus: r.ecus };
  }
  if (f.engine === 'etal') {
    const r = standResult(host, f, items);
    return r.reason ? { score: 0, ribbon: null, amount: 0, reason: r.reason } : { score: r.score, ribbon: r.ribbon, amount: r.amount, ecus: r.ecus, detail: r.detail };
  }
  if (f.engine === 'paniers') {
    const r = basketsResult(host, f, items);
    return r.reason ? { hearts: 0, amount: 0, reason: r.reason } : { hearts: r.hearts, perBasket: r.perBasket, amount: r.amount, ecus: r.ecus };
  }
  return null;
}

// ── Foire aux graines (carrière) ─────────────────────────────────────────────────────────────

function seedFairStalls(host) {
  const { state } = host;
  const f = state.cozy.fete;
  const bought = f?.result?.packs || {};
  const total = Object.values(bought).reduce((a, b) => a + b, 0);
  const pack = (cropId, seeds, price) => {
    const n = bought[cropId] || 0;
    let reason = null;
    if (n >= SEED_FAIR.perCrop) reason = `${SEED_FAIR.perCrop} sachets au plus par culture.`;
    else if (total >= SEED_FAIR.max) reason = `${SEED_FAIR.max} sachets au plus.`;
    else if (state.money < price) reason = notEnough(price - state.money);
    return { cropId, name: getCrop(cropId).name, icon: `seedbag.${cropId}`, seeds, price, bought: n, canBuy: !reason, reason };
  };
  const local = host.crops.filter((c) => !isTreeCrop(c) && !isRareCrop(c.id) && c.seasons.includes('spring')).map((c) => pack(c.id, SEED_FAIR.pack, Math.max(1, Math.round(c.seedCost * SEED_FAIR.pack * (1 - SEED_FAIR.discount)))));
  const stalls = [{ id: 'local', name: 'Graines du pays', packs: local }];
  const apple = host.crops.find((c) => isTreeCrop(c));
  if (apple && state.career?.lots?.some((l) => l.type === 'orchard')) {
    stalls.push({ id: 'plants', name: 'Plants', packs: [pack(apple.id, SEED_FAIR.treePack, Math.max(1, Math.round(host.treeSeedCost(apple) * (1 - SEED_FAIR.discount))))] });
  }
  if (state.variety && (state.variety.stats.merchantVisits || 0) > 0) {
    const pea = getCrop(SEED_FAIR.rareCrop);
    stalls.push({ id: 'basile', name: 'Le sachet de Basile', packs: [pack(pea.id, SEED_FAIR.rarePack, Math.max(1, Math.round(pea.seedCost * SEED_FAIR.rarePack * (1 - SEED_FAIR.discount))))] });
  }
  return stalls;
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

/** Foire aux graines : un sachet (semis prépayés) dans la réserve. → { ok, cropId, seeds, cost, bank } */
export function buySeedPack(host, cropId) {
  if (host.mode !== 'career') return host.fail('La foire aux graines n\'est pas aujourd\'hui.');
  const f = todayFete(host, ['foire']);
  if (!f) return host.fail('La foire aux graines n\'est pas aujourd\'hui.');
  const offer = seedFairStalls(host).flatMap((s) => s.packs.map((p) => ({ ...p, stall: s.id }))).find((p) => p.cropId === cropId);
  if (!offer) return host.fail('Ce sachet n\'est pas proposé.');
  if (!offer.canBuy) return host.fail(offer.reason);
  const { state } = host;
  const z = state.cozy;
  host.spend(offer.price);
  f.result = f.result || { packs: {}, amount: 0, ecus: 0, score: 0 };
  f.result.packs = f.result.packs || {};
  f.result.packs[cropId] = (f.result.packs[cropId] || 0) + 1;
  f.result.score = (f.result.score || 0) + 1;
  let bank;
  if (offer.stall === 'basile') {
    state.variety.rare[cropId] = (state.variety.rare[cropId] || 0) + offer.seeds;
    bank = state.variety.rare[cropId];
  } else {
    z.seedBank[cropId] = (z.seedBank[cropId] || 0) + offer.seeds;
    bank = z.seedBank[cropId];
  }
  z.stats.seedPacks += 1;
  noteFetePlayed(host, f, { score: f.result.score });
  if (Object.values(f.result.packs).reduce((a, b) => a + b, 0) >= SEED_FAIR.max) noteBest(host, f);
  host.push('seedPackBought', { cropId, seeds: offer.seeds, cost: offer.price, bank });
  return { ok: true, cropId, seeds: offer.seeds, cost: offer.price, bank };
}

/** Réserve de graines : prend un semis s'il y en a (plant). → true si pris. */
export function takeFromSeedBank(state, cropId) {
  const bank = state.cozy?.seedBank;
  if (!bank || !(bank[cropId] > 0)) return false;
  bank[cropId] -= 1;
  if (bank[cropId] <= 0) delete bank[cropId];
  return true;
}

// ── Hiver ──────────────────────────────────────────────────────────────────────────────────────

/** Ramasser une trouvaille d'hiver. → { ok, kind, name, amount } */
export function pickWinterFind(host, findId) {
  const z = host.state.cozy;
  const w = z?.winter;
  const k = w ? w.finds.findIndex((x) => x.id === findId) : -1;
  if (k < 0) return host.fail('Rien à ramasser ici.');
  const find = w.finds.splice(k, 1)[0];
  const def = WINTER_FINDS_BY_ID[find.kind];
  const amount = coinsFor(host, def.coins);
  host.earn('winter', amount);
  bump(z.stats.finds, find.kind);
  z.year.finds += 1;
  host.push('winterPicked', { id: find.id, kind: find.kind, name: def.name, amount });
  return { ok: true, kind: find.kind, name: def.name, amount };
}

/** Remplir la mangeoire (une fois par jour, en hiver). → { ok } */
export function fillFeeder(host) {
  const z = host.state.cozy;
  if (!z?.parts.winter || !z.winter.feeder.here) return host.fail('La mangeoire sort en hiver.');
  const today = absDay(host.state);
  if (z.winter.feeder.filledDay === today) return host.fail('Déjà remplie aujourd\'hui.');
  z.winter.feeder.filledDay = today;
  z.winter.feeder.fills += 1;
  z.year.feederDays += 1;
  host.push('feederFilled', {});
  return { ok: true };
}

/** Veillée de Joseph (quand on veut, tout l'hiver, à partir du 3ᵉ jour). → { ok } */
export function hearStory(host) {
  const z = host.state.cozy;
  const w = z?.winter;
  if (!w || !z.parts.winter || !(w.storyDay > 0) || absDay(host.state) < w.storyDay) return host.fail('Pas de veillée en ce moment.');
  if (z.year.story) return host.fail('Déjà écoutée cet hiver.');
  z.year.story = true;
  host.push('storyHeard', {});
  return { ok: true };
}

// ── Lanternes : faits de l'année ──────────────────────────────────────────────────────────────

const count = (map) => Object.values(map || {}).filter((n) => n > 0).length;

function levelK(host) {
  const crops = gameCrops(host.level, host.state.perks).filter((c) => !isRareCrop(c.id)).length;
  const recipes = levelInvestments(host.level).filter((i) => i.effects.processing).reduce((n, i) => n + productsFor(i.id).length, 0);
  return crops + recipes;
}

function adultTrees(state) {
  return state.plots.filter((p) => p.cropId && isTreeCrop(getCrop(p.cropId)) && isTreeAdult(state, p)).length;
}

/**
 * Faits des lanternes de l'année en cours (niveaux : argent `money` ; carrière : patrimoine).
 * extra : { money, patrimony, varietyYear } (valeurs au moment du calcul).
 */
export function lanternFacts(host, extra = {}) {
  const { state } = host;
  const z = state.cozy;
  const y = z.year;
  const nb = (pts) => pts;
  if (host.mode === 'career') {
    const R = LANTERN_RULES.career;
    const P = R.neighbourPoints;
    const B = R.beautyPoints;
    const v = extra.varietyYear || null;
    const orders = v ? v.ordersDone || 0 : Math.max(0, (state.variety?.stats?.ordersDone || 0) - y.base.orders);
    const crates = v ? v.cratesFull || 0 : Math.max(0, (state.variety?.stats?.cratesFull || 0) - y.base.crates);
    const quests = Math.max(0, (state.career.lifetime.questsDone || 0) - y.base.quests);
    const neighbours = nb(orders * P.order + crates * P.crate + quests * P.quest + Object.keys(y.fetes).length * P.fete + y.hearts * P.heart + (y.visitor ? P.visitor : 0) + (y.story ? P.story : 0));
    const decor = state.career.cosmetics?.decor || {};
    const decorN = Object.keys(decor).length;
    const embellish = Object.keys(decor).some((k) => /^lot\d+(?:[we]\d)?\.corner$/.test(k));
    const cos = state.career.cosmetics || {};
    const beauty =
      Math.min(B.decorMax, decorN) * B.decor
      + (cos.path && cos.path !== 'path.dirt' ? B.path : 0)
      + (cos.fence && cos.fence !== 'fence.wood' ? B.fence : 0)
      + Math.min(B.hiveMax, state.investments.beehive || 0) * B.hive
      + Math.min(B.treeMax, adultTrees(state)) * B.tree
      + (embellish ? B.embellish : 0)
      + (count(y.giants) > 0 ? B.giant : 0)
      + (y.feederDays >= B.feederDays ? B.feeder : 0)
      + (count(y.birds) >= B.birdsN ? B.birds : 0)
      + (state.career.pets?.cat || state.career.pets?.dog ? B.pet : 0);
    const shelters = Object.entries(state.career.buildings || {}).some(([id, b]) => b && ['coop', 'hutch', 'duckPond', 'goatShed', 'cowshed', 'pigsty'].includes(id) && (state.investments[{ coop: 'hen', hutch: 'rabbit', duckPond: 'duck', goatShed: 'goat', cowshed: 'cow', pigsty: 'pig' }[id]] || 0) > 0);
    return {
      variety: count(y.produced.crops) + count(y.produced.products) + count(y.produced.animal),
      care: { hand: y.cared, harvests: y.harvests, collected: y.animalCollected, lost: y.animalLost || 0, shelters, fallback: !state.surprises },
      neighbours,
      beauty,
      prosperity: { start: y.patrimonyStart, end: Number.isFinite(extra.patrimony) ? extra.patrimony : host.patrimony() },
      partial: y.partial,
    };
  }
  const R = LANTERN_RULES.levels;
  const P = R.neighbourPoints;
  const B = R.beautyPoints;
  const orders = Math.max(0, (state.variety?.stats?.ordersDone || 0) - y.base.orders);
  const crates = Math.max(0, (state.variety?.stats?.cratesFull || 0) - y.base.crates);
  const [s2, s3] = host.level.starThresholds;
  return {
    variety: { v: count(y.produced.crops) + count(y.produced.products), k: levelK(host) },
    care: { cared: y.cared, harvests: y.harvests, fallback: !state.surprises },
    neighbours: nb(orders * P.order + crates * P.crate + Object.keys(y.fetes).length * P.fete + y.hearts * P.heart + (y.story ? P.story : 0)),
    beauty:
      Math.min(B.decorMax, z.decor.placed) * B.decor
      + (z.decor.path ? B.path : 0)
      + (z.decor.fence ? B.fence : 0)
      + Math.min(B.hiveMax, state.investments.beehive || 0) * B.hive
      + Math.min(B.treeMax, adultTrees(state)) * B.tree
      + ((y.produced.crops.sunflower || 0) >= B.sunflowersN ? B.sunflowers : 0)
      + (count(y.giants) > 0 ? B.giant : 0)
      + (y.feederDays >= B.feederDays ? B.feeder : 0)
      + (count(y.birds) >= B.birdsN ? B.birds : 0),
    prosperity: { money: Number.isFinite(extra.money) ? extra.money : state.money, s2, s3 },
    partial: y.partial,
  };
}

/** Lanternes de l'année en cours (aperçu « Bilan », Carnet) ou au soir des lanternes. */
export function cozyLanterns(host, extra = {}) {
  if (!host.state.cozy?.parts.lanterns) return null;
  return lanternsFor(lanternFacts(host, extra), host.mode === 'career' ? 'career' : 'levels');
}

// ── Requêtes ───────────────────────────────────────────────────────────────────────────────────

/** feteInfo de la fête du jour (null hors fête). */
export function feteInfo(host) {
  const { state } = host;
  const f = state.cozy?.fete;
  if (!f || f.day !== absDay(state)) return null;
  const def = FETES_BY_ID[f.id];
  const g = f.themeId ? THEME_FETE_GAMES[f.themeId] : null;
  const name = def ? def.name : g?.name ?? f.id;
  const kind = hiddenKind(f);
  const rules = [];
  if (f.engine === 'chasse') rules.push(`Trouvez les ${FETE_ENGINES.chasse.count} ${HIDDEN_NAMES[kind]} cachés dans la ferme.`, 'Pas de chrono : le jeu est en pause, et le soir le village trouve ce qui reste.');
  else if (f.engine === 'marmite') rules.push(g?.require ? `Du ${getCrop(g.require).name.toLowerCase()} obligatoire, et jusqu'à deux autres ingrédients.` : 'Jusqu\'à trois légumes de l\'année, tous différents.', 'Trois légumes, dont un beau : la meilleure soupe !');
  else if (f.engine === 'etal') rules.push(`Remplissez ${standSlots(f)} cagettes avec ce que la ferme a produit cette année.`, 'Belles, dorées, géants et fait maison plaisent au jury.');
  else if (f.engine === 'paniers') rules.push('Deux produits par panier, offerts à trois villageois.', 'Un ♥ pour chaque produit qu\'ils aiment.');
  else if (f.engine === 'foire') rules.push(`Un sachet = ${SEED_FAIR.pack} semis à −${Math.round(SEED_FAIR.discount * 100)} % pour le printemps.`, 'Vos semis (et l\'équipe) prennent la réserve d\'abord, sans payer.');
  const info = {
    id: f.id,
    name,
    engine: f.engine,
    themeId: f.themeId,
    icon: f.themeId ? `icon.theme.${f.themeId}` : 'icon.fete',
    text: def ? def.text : g ? g.text : '',
    rules,
    day: f.day,
    done: f.done,
    result: f.result ? clone(f.result) : null,
    hidden: null,
    choices: null,
    max: null,
    villagers: null,
    stalls: null,
  };
  if (f.engine === 'chasse') {
    info.hidden = { kind, items: f.hidden.map((h, index) => ({ index, u: h.u, gold: h.gold, found: h.found })), foundByPlayer: f.hidden.filter((h) => h.found === 'player').length, total: f.hidden.length };
  }
  if (['marmite', 'etal', 'paniers'].includes(f.engine)) info.choices = choicesFor(state, f);
  if (f.engine === 'marmite') info.max = FETE_ENGINES.marmite.max;
  if (f.engine === 'etal') info.max = standSlots(f);
  if (f.engine === 'paniers') {
    info.max = FETE_ENGINES.paniers.perBasket;
    info.villagers = f.villagers.map((id) => ({ clientId: id, name: CLIENTS_BY_ID[id].name, portrait: `portrait.client.${id}`, likes: villagerLikes(id).map((l) => ({ ...l, icon: itemIcon(l.kind, l.id) })) }));
  }
  if (f.engine === 'foire') info.stalls = seedFairStalls(host);
  return info;
}

/** query.winter() */
export function winterQuery(host) {
  const { state } = host;
  const z = state.cozy;
  if (!z || !z.parts.winter) return null;
  const w = z.winter;
  const today = absDay(state);
  const bird = w.feeder.bird && w.feeder.bird.day === today ? BIRDS_BY_ID[w.feeder.bird.id] : null;
  return {
    finds: w.finds.map((x) => ({ id: x.id, kind: x.kind, name: WINTER_FINDS_BY_ID[x.kind].name, icon: WINTER_FINDS_BY_ID[x.kind].icon, u: x.u })),
    traces: w.traces.map((x) => ({ kind: x.kind, name: TRACES_BY_ID[x.kind].name, icon: TRACES_BY_ID[x.kind].icon, u: x.u })),
    feeder: { here: !!w.feeder.here, canFill: !!w.feeder.here && w.feeder.filledDay !== today && state.status === 'playing', filledToday: w.feeder.filledDay === today, bird: bird ? { id: bird.id, name: bird.name, icon: `bird.${bird.id}` } : null },
    story: { available: w.storyDay > 0 && today >= w.storyDay && !z.year.story, heard: !!z.year.story, day: w.storyDay },
  };
}

/** query.lanterns() */
export function lanternsQuery(host) {
  const res = cozyLanterns(host);
  if (!res) return null;
  return { criteria: res.criteria, total: res.total, partial: res.partial, values: res.values };
}

/** query.cozy() */
export function cozyQuery(host) {
  const { state } = host;
  const z = state.cozy;
  if (!z) return null;
  return {
    enabled: true,
    parts: { ...z.parts },
    fete: feteInfo(host),
    upcoming: z.parts.fetes ? upcomingFetes(host) : [],
    winter: winterQuery(host),
    lanterns: lanternsQuery(host),
    seedBank: Object.entries(z.seedBank).filter(([, n]) => n > 0).map(([cropId, n]) => ({ cropId, name: getCrop(cropId).name, icon: `crop.${cropId}.icon`, n })),
    stats: clone(z.stats),
    lit: z.lit ? clone(z.lit) : null,
    history: z.lanterns ? clone(z.lanterns.history) : null,
  };
}

/** Résumé de l'année (query.summary().cozy, report.cozy). */
export function cozySummary(state) {
  const z = state.cozy;
  if (!z) return null;
  return { year: clone(z.year), stats: clone(z.stats), ...(z.lit ? { lanterns: clone(z.lit) } : {}) };
}

/** Partie des statistiques pas encore comptée dans la progression (niveaux : tout ; carrière : depuis le bilan). */
export function cozyPendingStats(state) {
  const z = state.cozy;
  if (!z) return null;
  if (state.mode !== 'career' || !z.statsBase) return clone(z.stats);
  return diffStats(z.stats, z.statsBase);
}

export function diffStats(now, base) {
  const out = {};
  for (const [k, v] of Object.entries(now)) {
    if (typeof v === 'number') out[k] = v - (typeof base?.[k] === 'number' ? base[k] : 0);
    else if (v && typeof v === 'object') out[k] = diffStats(v, base?.[k] || {});
  }
  return out;
}

/** Nom de saison (« printemps »). */
export function seasonName(si) {
  return SEASON_NAMES?.[SEASONS[si]] ?? SEASONS[si];
}

/** Débogage (niveaux et carrière) : lance une partie du lot tout de suite. */
export function triggerCozyShared(host, kind, arg) {
  const { state } = host;
  const z = state.cozy;
  switch (kind) {
    case 'fete': {
      let f = null;
      if (typeof arg === 'string' && arg.startsWith('theme.')) {
        const id = arg.slice(6);
        const g = THEME_FETE_GAMES[id];
        if (!g) return host.fail('Fête inconnue.');
        f = { id: arg, engine: g.engine, themeId: id, name: g.name };
      } else {
        const def = FETES_BY_ID[arg || 'villageFete'];
        if (!def) return host.fail('Fête inconnue.');
        if (def.engine === 'foire' && host.mode !== 'career') return host.fail('La foire aux graines est propre à Ma ferme.');
        f = { id: def.id, engine: def.engine, themeId: null, name: def.name };
      }
      startFete(host, f);
      const info = feteInfo(host);
      host.push('feteStarted', { fete: info, text: `${f.name} : aujourd'hui !` });
      return { ok: true, fete: info };
    }
    case 'winter': {
      const w = z.winter;
      w.feeder.here = true;
      const rng = stream(state.rng, 'cozy');
      const kindDef = weightedPick(WINTER_FINDS, (x) => x.weight, rng.float());
      if (w.finds.length >= WINTER_RULES.maxFinds) w.finds.shift();
      const find = { id: `w${w.nextId++}`, kind: kindDef.id, u: Math.min(0.999999, rng.float()), day: absDay(state) };
      w.finds.push(find);
      host.push('winterFind', { finds: [{ ...find }], trace: null });
      return { ok: true, find };
    }
    case 'trace': {
      const t = TRACES_BY_ID[arg] || TRACES.kinds[0];
      const trace = { kind: t.id, u: 0.5, day: absDay(state) };
      z.winter.traces = [trace];
      bump(z.stats.traces, t.id);
      host.push('winterFind', { finds: [], trace: { kind: t.id, u: 0.5 } });
      return { ok: true, trace };
    }
    case 'bird': {
      const b = BIRDS_BY_ID[arg] || BIRDS[0];
      const first = !(z.stats.birds[b.id] > 0);
      z.winter.feeder.here = true;
      z.winter.feeder.bird = { id: b.id, day: absDay(state) };
      bump(z.stats.birds, b.id);
      z.year.birds[b.id] = 1;
      host.push('feederBird', { bird: { id: b.id, name: b.name }, first });
      return { ok: true, bird: b.id };
    }
    case 'story': {
      z.winter.storyDay = absDay(state);
      z.year.story = false;
      host.push('storyReady', { text: 'Ce soir, veillée chez Joseph.' });
      return { ok: true };
    }
    case 'lanterns': {
      const res = cozyLanterns(host);
      if (!res) return host.fail('Lanternes désactivées.');
      const payload = { year: state.mode === 'career' ? state.time.year : 1, values: res.values, total: res.total, criteria: res.criteria, partial: res.partial, preview: true };
      host.push('lanternsLit', payload);
      return { ok: true, lanterns: payload };
    }
    default:
      return host.fail('Inconnu.');
  }
}

export { HIDDEN_KINDS, FETES, FETES_BY_ID };
