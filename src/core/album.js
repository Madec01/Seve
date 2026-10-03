// Lot 4 — D1 : l'album de la ferme, côté progression (PUR : aucune lecture ni écriture de stockage, aucune horloge —
// `now` est passé en argument). Règles : docs/GAME_DESIGN.md § 17.1 ; contrat : docs/ARCHITECTURE.md, « Lot 4 —
// contrats » ; cases et récompenses : src/data/album.js.
//
// L'album n'est PAS dans l'état de la partie : il vit dans la progression (progress.album) et se calcule à partir du
// contexte de la partie en cours (query.achievementContext()) et de la progression (cumuls, succès, décors). Il se
// remplit donc aussi en Classique, sans rien changer à la partie.
//
//   progress.album = { found: { [caseId]: { at, src } }, stamps: { [caseId]: [stamp] }, claimed: [rewardId],
//                      seen: [caseId], stories: 0, retroDone: false }
//
// Toutes les fonctions qui modifient la progression renvoient un NOUVEL objet (l'entrée n'est jamais modifiée) ; les
// écus et décors des récompenses sont déjà ajoutés à la progression renvoyée (comme unlockAchievements).

import {
  ALBUM_CASES, ALBUM_CASES_BY_ID, ALBUM_COMPLETE_REWARD, ALBUM_EXTRA_REWARDS, ALBUM_MODE_NOTES, ALBUM_PAGES, ALBUM_PAGES_BY_ID, ALBUM_STAMPS,
  ALBUM_TEXTS, STORIES,
} from '../data/album.js';
import { COSMETICS, getCosmetic } from '../data/cosmetics.js';
import { levelFor } from '../data/difficulty.js';
import { getLevel } from '../data/levels.js';
import { STORY } from '../data/cozy.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const SRC = ['levels', 'career', 'retro'];

/** Album vide. */
export function defaultAlbum() {
  return { found: {}, stamps: {}, claimed: [], seen: [], stories: 0, retroDone: false };
}

/** Normalise un album lu (champs abîmés → défauts ; cases et récompenses inconnues ignorées). */
export function normalizeAlbum(raw) {
  const a = defaultAlbum();
  if (!isObj(raw)) return a;
  if (isObj(raw.found)) {
    for (const [id, v] of Object.entries(raw.found)) {
      if (!ALBUM_CASES_BY_ID[id]) continue;
      a.found[id] = { at: isObj(v) && Number.isFinite(v.at) ? v.at : null, src: isObj(v) && SRC.includes(v.src) ? v.src : 'retro' };
    }
  }
  if (isObj(raw.stamps)) {
    for (const [id, list] of Object.entries(raw.stamps)) {
      const c = ALBUM_CASES_BY_ID[id];
      if (!c || !Array.isArray(list)) continue;
      const ok = [...new Set(list.filter((s) => (c.stamps || []).includes(s)))];
      if (ok.length) a.stamps[id] = ok;
    }
  }
  const rewardIds = new Set([...ALBUM_PAGES.map((p) => p.id), ...ALBUM_EXTRA_REWARDS.map((r) => r.id), ALBUM_COMPLETE_REWARD.id]);
  if (Array.isArray(raw.claimed)) a.claimed = [...new Set(raw.claimed.filter((id) => rewardIds.has(id)))];
  if (Array.isArray(raw.seen)) a.seen = [...new Set(raw.seen.filter((id) => ALBUM_CASES_BY_ID[id]))];
  a.stories = Number.isFinite(raw.stories) ? Math.max(0, Math.floor(raw.stories)) : 0;
  a.retroDone = raw.retroDone === true;
  return a;
}

const albumOf = (p) => (isObj(p?.album) ? p.album : defaultAlbum());

// ── Faits ──────────────────────────────────────────────────────────────────────────────────────

function emptyFacts() {
  const S = () => new Set();
  return {
    crops: S(), cropGold: S(), cropGiant: S(), products: S(), animalProducts: S(), animals: S(), pets: S(), weather: S(), special: S(),
    surprises: S(), finds: S(), forage: false, wish: false, clients: S(), merchantMet: false, themes: S(), themeFetes: S(), themeVisitors: S(),
    fetes: S(), feteBest: S(), comice: false, contest: false, cartFull: false, goldMedal: false, winterFinds: S(), traces: S(), birds: S(),
    fish: S(), stories: 0,
  };
}

const keysOf = (map) => Object.entries(map || {}).filter(([, n]) => (typeof n === 'number' ? n > 0 : !!n)).map(([k]) => k);
const addAll = (set, list) => {
  for (const x of list || []) set.add(x);
};

/** Investissements (niveaux) ou espèces (carrière) → animaux de la page « Les animaux ». */
const ANIMAL_OF = { chickenCoop: 'hen', hen: 'hen', beehive: 'bees', cow: 'cow', sheep: 'sheep', goat: 'goat', rabbit: 'rabbit', duck: 'duck', pig: 'pig', horse: 'horse' };

/** Succès débloqués → cases prouvées (§ 17.1.4). */
const ACHIEVEMENT_CASES = {
  henHouse: ['animals.hen', 'homemade.eggs'],
  herd: ['animals.cow', 'animals.sheep', 'animals.goat', 'homemade.milk'],
  truffles: ['animals.pig', 'homemade.truffle'],
  menagerie: ['animals.hen', 'animals.rabbit', 'animals.duck', 'animals.goat', 'animals.cow', 'animals.sheep', 'animals.pig', 'animals.horse'],
  fairChampion: ['fetes.comice'],
  baker: ['homemade.bread'],
  winterTomato: ['garden.tomato'],
};

/** Décors possédés → cases prouvées (§ 17.1.4). */
const COSMETIC_CASES = {
  'owl.carved': ['luck.owl'],
  'statue.small': ['luck.statue'],
  'lantern.peddler': ['village.basile'],
  'weathervane.rooster': ['village.basile'],
  'sign.magazine': ['years.tourism'],
};

/** Ajoute aux faits ce qu'expose un contexte de partie (query.achievementContext()). */
function addContext(f, ctx) {
  if (!isObj(ctx)) return;
  const year = ctx.stats?.year;
  addAll(f.crops, keysOf(year?.cropsHarvested));
  addAll(f.products, keysOf(year?.productsSold));
  const career = ctx.levelId === 'career' || isObj(ctx.career);
  // Animaux.
  for (const [id, n] of Object.entries(ctx.investments || {})) if (n > 0 && ANIMAL_OF[id]) f.animals.add(ANIMAL_OF[id]);
  if (career) {
    addAll(f.animals, ctx.career?.speciesIds);
    addAll(f.pets, keysOf(ctx.career?.pets));
    addAll(f.animalProducts, keysOf(ctx.career?.animalProducts));
    addAll(f.fish, keysOf(ctx.career?.fish));
    addAll(f.themes, ctx.career?.themes);
    addAll(f.themeVisitors, ctx.career?.themeVisitors);
    addAll(f.themeFetes, ctx.career?.themesPlayed);
    if ((ctx.career?.contestGoalsMet || 0) > 0 || ctx.career?.contestAll) f.comice = true;
    if ((ctx.career?.truffles || 0) > 0) f.animalProducts.add('truffle');
  } else if (!ctx.cozy) {
    // Classique (rien de plus n'est exposé) : un poulailler à l'aube donne des œufs, une vache ou une chèvre du lait,
    // des moutons de la laine après la tonte du dernier jour de printemps.
    const inv = ctx.investments || {};
    if ((inv.chickenCoop || 0) > 0) f.animalProducts.add('eggs');
    if ((inv.cow || 0) + (inv.goat || 0) > 0) f.animalProducts.add('milk');
    const lv = getLevel(Number(ctx.levelId)) ? levelFor(Number(ctx.levelId), 'classique') : null;
    if ((inv.sheep || 0) > 0 && lv && Number(ctx.day) >= lv.seasonLengths[0]) f.animalProducts.add('wool');
  }
  // Ciel.
  if (['storm', 'heatwave', 'snow'].includes(ctx.weather)) f.weather.add(ctx.weather);
  if (ctx.specialWeather) f.special.add(ctx.specialWeather);
  // Surprises (lot 2).
  const sp = ctx.surprisesStats;
  if (isObj(sp)) {
    addAll(f.cropGold, keysOf(sp.gold));
    addAll(f.special, keysOf(sp.weathers));
    addAll(f.surprises, keysOf(sp.surprises));
    addAll(f.finds, keysOf(sp.finds));
    if ((sp.finds?.chest || 0) > 0) f.surprises.add('chest');
    if ((sp.forage || 0) > 0) f.forage = true;
    if ((sp.wishes || 0) > 0) f.wish = true;
    if (!ctx.cozy) addAll(f.cropGiant, keysOf(sp.giants));
  }
  // Variété (lot 3).
  const v = ctx.variety;
  if (isObj(v)) {
    addAll(f.clients, keysOf(v.ordersByClient));
    if ((v.merchantVisits || 0) > 0) f.merchantMet = true;
    if ((v.cartsFull || 0) > 0) f.cartFull = true;
    if ((v.medals?.gold || 0) > 0) f.goldMedal = true;
    addAll(f.crops, keysOf(v.rareHarvested));
  }
  // Lot 4.
  const z = ctx.cozy;
  if (isObj(z)) {
    const st = z.stats || {};
    addAll(f.cropGiant, keysOf(st.giants));
    addAll(f.fetes, keysOf(st.fetes));
    addAll(f.feteBest, keysOf(st.best));
    addAll(f.themeFetes, keysOf(st.themesPlayed));
    addAll(f.themeVisitors, keysOf(st.themeVisitors));
    addAll(f.winterFinds, keysOf(st.finds));
    addAll(f.traces, keysOf(st.traces));
    addAll(f.birds, keysOf(st.birds));
    addAll(f.fish, keysOf(st.fish));
    addAll(f.animalProducts, keysOf(st.animal));
    if (isObj(z.year?.produced)) addAll(f.animalProducts, keysOf(z.year.produced.animal));
    if ((z.contestGoals || 0) > 0) f.contest = true;
  }
}

/** Ajoute aux faits ce que prouve la progression (cumuls, succès, décors, histoires). */
function addProgress(f, p) {
  if (!isObj(p)) return;
  const l = p.lifetime || {};
  addAll(f.crops, keysOf(l.cropsHarvested));
  addAll(f.products, keysOf(l.productsSold));
  addAll(f.crops, keysOf(l.variety?.rare));
  if ((l.variety?.cartsFull || 0) > 0) f.cartFull = true;
  if ((l.variety?.medals?.gold || 0) > 0) f.goldMedal = true;
  addAll(f.birds, keysOf(l.cozy?.birds));
  f.stories = Math.max(f.stories, albumOf(p).stories || 0);
}

/** Cases prouvées directement (succès, décors) : [caseId]. */
function provenCases(p) {
  const out = new Set();
  for (const id of Object.keys(p?.achievements || {})) for (const c of ACHIEVEMENT_CASES[id] || []) out.add(c);
  for (const id of p?.cosmetics?.owned || []) for (const c of COSMETIC_CASES[id] || []) out.add(c);
  return out;
}

/** Contexte de partie (ou null) + progression → faits lisibles par les cases. */
export function albumFacts(ctx, progress) {
  const f = emptyFacts();
  addProgress(f, progress);
  addContext(f, ctx);
  f.proven = provenCases(progress);
  return f;
}

/** La condition d'une case est-elle remplie ? */
export function caseDone(c, f) {
  if (f.proven?.has(c.caseId)) return true;
  const ch = c.check;
  switch (ch.type) {
    case 'cropHarvested':
      return f.crops.has(ch.id);
    case 'productSold':
      return f.products.has(ch.id);
    case 'animalProduct':
      return f.animalProducts.has(ch.id);
    case 'animalOwned':
      return f.animals.has(ch.id);
    case 'pet':
      return f.pets.has(ch.id);
    case 'weather':
      return f.weather.has(ch.id);
    case 'specialWeather':
      return f.special.has(ch.id);
    case 'surprise':
      return f.surprises.has(ch.id);
    case 'find':
      return f.finds.has(ch.id);
    case 'forage':
      return f.forage;
    case 'wish':
      return f.wish;
    case 'client':
      return f.clients.has(ch.id);
    case 'merchantMet':
      return f.merchantMet;
    case 'theme':
      return f.themes.has(ch.id);
    case 'fete':
      return f.fetes.has(ch.id);
    case 'comice':
      return f.comice;
    case 'contest':
      return f.contest;
    case 'cartFull':
      return f.cartFull;
    case 'goldMedal':
      return f.goldMedal;
    case 'winterFind':
      return f.winterFinds.has(ch.id);
    case 'trace':
      return f.traces.has(ch.id);
    case 'bird':
      return f.birds.has(ch.id);
    case 'fish':
      return f.fish.has(ch.id);
    case 'story':
      return f.stories >= ch.n;
    default:
      return false;
  }
}

/** Le tampon d'une case est-il mérité ? */
export function stampDone(c, stamp, f) {
  switch (stamp) {
    case 'gold':
      return f.cropGold.has(c.id);
    case 'giant':
      return f.cropGiant.has(c.id);
    case 'fete':
      return f.themeFetes.has(c.id);
    case 'visitor':
      return f.themeVisitors.has(c.id);
    case 'best':
      return f.feteBest.has(c.id);
    default:
      return false;
  }
}

/** Nouveautés (rien n'est écrit) : { cases: [caseId], stamps: [{ caseId, stamp }] }. */
export function checkAlbum(progress, ctx) {
  const a = albumOf(progress);
  const f = albumFacts(ctx, progress);
  const cases = [];
  const stamps = [];
  for (const c of ALBUM_CASES) {
    if (!a.found[c.caseId] && caseDone(c, f)) cases.push(c.caseId);
    for (const s of c.stamps || []) {
      if ((a.stamps[c.caseId] || []).includes(s)) continue;
      if (stampDone(c, s, f)) stamps.push({ caseId: c.caseId, stamp: s });
    }
  }
  return { cases, stamps };
}

/** Écrit les nouveautés (checkAlbum) : → { progress, cases, stamps } (seulement les vraies nouveautés). */
export function recordAlbum(progress, found, now = Date.now(), src = 'levels') {
  const out = clone(progress);
  out.album = normalizeAlbum(out.album);
  const a = out.album;
  const cases = [];
  const stamps = [];
  for (const id of found?.cases || []) {
    if (!ALBUM_CASES_BY_ID[id] || a.found[id]) continue;
    a.found[id] = { at: src === 'retro' ? null : now, src: SRC.includes(src) ? src : 'levels' };
    cases.push(id);
  }
  for (const { caseId, stamp } of found?.stamps || []) {
    const c = ALBUM_CASES_BY_ID[caseId];
    if (!c || !(c.stamps || []).includes(stamp)) continue;
    const list = a.stamps[caseId] || (a.stamps[caseId] = []);
    if (list.includes(stamp)) continue;
    list.push(stamp);
    stamps.push({ caseId, stamp });
  }
  return { progress: out, cases, stamps };
}

/** Une page est-elle complète (toutes ses cases trouvées) ? */
export function pageDone(a, page) {
  return page.cases.every((c) => !!a.found[`${page.id}.${c.id}`]);
}

function extraReady(a, r) {
  const page = ALBUM_PAGES_BY_ID[r.pageId];
  const cases = page.cases.filter((c) => r.stamps.every((s) => (c.stamps || []).includes(s)));
  return cases.length > 0 && cases.every((c) => r.stamps.every((s) => (a.stamps[`${page.id}.${c.id}`] || []).includes(s)));
}

function modeNoteFor(c, mode) {
  if (c.mode === 'career' && mode !== 'career') return ALBUM_MODE_NOTES.career;
  if (c.mode === 'dc' && mode === 'classique') return ALBUM_MODE_NOTES.dc;
  return null;
}

/**
 * Pages de l'album pour l'interface. mode : 'classique' | 'detente' | 'career' (indices « À découvrir dans Ma ferme »).
 * → [{ id, name, icon, found, total, done, cases: [{ id, caseId, name, icon, found, at, src, stamps, stampsPossible,
 *      text (si trouvée), hint (sinon), modeNote, isNew }], rewards: [{ id, name, ecus, cosmeticId, ready, claimed }] }]
 */
export function albumPages(progress, mode = null) {
  const a = albumOf(progress);
  return ALBUM_PAGES.map((page) => {
    const cases = page.cases.map((c) => {
      const caseId = `${page.id}.${c.id}`;
      const fd = a.found[caseId];
      return {
        id: c.id,
        caseId,
        name: c.name,
        icon: c.icon,
        found: !!fd,
        at: fd ? fd.at : null,
        src: fd ? fd.src : null,
        stamps: [...(a.stamps[caseId] || [])],
        stampsPossible: [...(c.stamps || [])],
        text: fd ? c.text : null,
        hint: fd ? null : c.hint,
        modeNote: fd ? null : modeNoteFor(c, mode),
        isNew: !!fd && !a.seen.includes(caseId),
      };
    });
    const done = pageDone(a, page);
    const rewards = [{ id: page.id, name: page.name, ecus: page.reward.ecus, cosmeticId: page.reward.cosmeticId, ready: done, claimed: a.claimed.includes(page.id) }];
    for (const r of ALBUM_EXTRA_REWARDS.filter((x) => x.pageId === page.id)) {
      rewards.push({ id: r.id, name: r.name, ecus: r.ecus, cosmeticId: r.cosmeticId, ready: extraReady(a, r), claimed: a.claimed.includes(r.id), stamps: [...r.stamps] });
    }
    return { id: page.id, name: page.name, icon: page.icon, found: cases.filter((c) => c.found).length, total: cases.length, done, cases, rewards };
  });
}

/** Vue d'ensemble : { found, total, pagesDone, complete: { ready, claimed, ecus, cosmeticId }, newCount, stamps }. */
export function albumOverview(progress) {
  const a = albumOf(progress);
  const total = ALBUM_CASES.length;
  const found = ALBUM_CASES.filter((c) => a.found[c.caseId]).length;
  const pagesDone = ALBUM_PAGES.filter((p) => pageDone(a, p)).length;
  const ready = pagesDone === ALBUM_PAGES.length;
  const claimable = albumClaimable(progress).length;
  return {
    found,
    total,
    pagesDone,
    pages: ALBUM_PAGES.length,
    complete: { id: ALBUM_COMPLETE_REWARD.id, name: ALBUM_COMPLETE_REWARD.name, ready, claimed: a.claimed.includes(ALBUM_COMPLETE_REWARD.id), ecus: ALBUM_COMPLETE_REWARD.ecus, cosmeticId: ALBUM_COMPLETE_REWARD.cosmeticId },
    newCount: ALBUM_CASES.filter((c) => a.found[c.caseId] && !a.seen.includes(c.caseId)).length,
    claimable,
    stories: a.stories,
  };
}

/** Récompenses prêtes et pas encore reçues : [rewardId]. */
export function albumClaimable(progress) {
  const a = albumOf(progress);
  const out = [];
  for (const p of ALBUM_PAGES) if (pageDone(a, p) && !a.claimed.includes(p.id)) out.push(p.id);
  for (const r of ALBUM_EXTRA_REWARDS) if (extraReady(a, r) && !a.claimed.includes(r.id)) out.push(r.id);
  if (ALBUM_PAGES.every((p) => pageDone(a, p)) && !a.claimed.includes(ALBUM_COMPLETE_REWARD.id)) out.push(ALBUM_COMPLETE_REWARD.id);
  return out;
}

function unlockCos(progress, id) {
  if (!id || !getCosmetic(id)) return false;
  if (progress.cosmetics.owned.includes(id)) return true;
  const owned = new Set([...progress.cosmetics.owned, id]);
  progress.cosmetics.owned = COSMETICS.filter((i) => owned.has(i.id)).map((i) => i.id);
  return false;
}

/**
 * Reçoit la récompense d'une page (ou page dorée, des géants, des grandes années, album complet) : écus et décor
 * ajoutés à la progression renvoyée. → { ok, progress, rewards: { ecus, cosmeticId, already } } | { ok: false, reason }
 */
export function claimAlbumReward(progress, rewardId) {
  const a = albumOf(progress);
  let def = null;
  let ready = false;
  if (ALBUM_PAGES_BY_ID[rewardId]) {
    const page = ALBUM_PAGES_BY_ID[rewardId];
    def = { ecus: page.reward.ecus, cosmeticId: page.reward.cosmeticId };
    ready = pageDone(a, page);
  } else if (rewardId === ALBUM_COMPLETE_REWARD.id) {
    def = ALBUM_COMPLETE_REWARD;
    ready = ALBUM_PAGES.every((p) => pageDone(a, p));
  } else {
    const r = ALBUM_EXTRA_REWARDS.find((x) => x.id === rewardId);
    if (r) {
      def = r;
      ready = extraReady(a, r);
    }
  }
  if (!def) return { ok: false, reason: ALBUM_TEXTS.unknown };
  if (a.claimed.includes(rewardId)) return { ok: false, reason: ALBUM_TEXTS.already };
  if (!ready) return { ok: false, reason: ALBUM_TEXTS.notReady };
  const out = clone(progress);
  out.album = normalizeAlbum(out.album);
  out.album.claimed.push(rewardId);
  out.ecus = (out.ecus || 0) + def.ecus;
  const already = def.cosmeticId ? unlockCos(out, def.cosmeticId) : false;
  return { ok: true, progress: out, rewards: { ecus: def.ecus, cosmeticId: def.cosmeticId || null, already } };
}

/** Cases vues (badge « Nouveau » retiré). */
export function markAlbumSeen(progress, caseIds) {
  const out = clone(progress);
  out.album = normalizeAlbum(out.album);
  const seen = new Set(out.album.seen);
  for (const id of caseIds || []) if (ALBUM_CASES_BY_ID[id] && out.album.found[id]) seen.add(id);
  out.album.seen = ALBUM_CASES.filter((c) => seen.has(c.caseId)).map((c) => c.caseId);
  return out;
}

/** Contexte (forme de query.achievementContext()) reconstitué depuis une sauvegarde (niveau ou carrière), pour le rattrapage. */
export function contextFromSave(saved) {
  const s = isObj(saved?.state) ? saved.state : saved;
  if (!isObj(s)) return null;
  const career = s.mode === 'career';
  const ctx = {
    levelId: career ? 'career' : s.levelId,
    status: s.status,
    day: s.time?.day ?? 1,
    stats: { year: s.stats?.year || {}, season: s.stats?.season || {} },
    investments: { ...(s.investments || {}) },
    weather: s.weather?.today ?? null,
  };
  if (isObj(s.surprises?.stats)) ctx.surprisesStats = clone(s.surprises.stats);
  if (isObj(s.variety?.stats)) {
    const v = s.variety.stats;
    ctx.variety = { ordersDone: v.ordersDone || 0, cartsFull: v.cartsFull || 0, medals: { ...(v.medals || {}) }, rareHarvested: { ...(v.rareHarvested || {}) }, ordersByClient: { ...(v.ordersByClient || {}) }, merchantVisits: v.merchantVisits || 0 };
  }
  if (isObj(s.cozy)) ctx.cozy = { stats: clone(s.cozy.stats || {}), year: clone(s.cozy.year || {}), contestGoals: 0 };
  if (!career && isObj(s.contest?.result) && Array.isArray(s.contest.result.goalsMet) && s.cozy) ctx.cozy.contestGoals = s.contest.result.goalsMet.length;
  if (career && isObj(s.career)) {
    const c = s.career;
    const speciesIds = ['hen', 'rabbit', 'duck', 'goat', 'cow', 'sheep', 'pig', 'horse'].filter((id) => (s.investments?.[id] || 0) > 0);
    if ((s.investments?.beehive || 0) > 0) speciesIds.push('bees');
    const themes = (c.theme?.history || []).map((h) => h.id).filter(Boolean);
    if (c.theme?.id) themes.push(c.theme.id);
    ctx.career = {
      speciesIds,
      pets: { ...(c.pets || {}) },
      truffles: c.lifetime?.truffles || 0,
      themes,
      fish: { ...(s.cozy?.stats?.fish || {}) },
      animalProducts: { ...(s.cozy?.stats?.animal || {}) },
      themeVisitors: Object.keys(s.cozy?.stats?.themeVisitors || {}),
      themesPlayed: Object.keys(s.cozy?.stats?.themesPlayed || {}),
      contestGoalsMet: c.contest?.result?.goalsMet?.length || 0,
      contestAll: (c.lifetime?.contestsWon || 0) > 0,
    };
  }
  return ctx;
}

/**
 * Rattrapage (§ 17.1.4) : au premier démarrage avec le lot 4 (retroDone false), les cases que la progression ou les
 * sauvegardes prouvent déjà sont trouvées d'un coup (date « avant l'album »). Une seule fois.
 * → { progress, cases }
 */
export function albumRetro(progress, { levelSave = null, careerSave = null } = {}) {
  const base = clone(progress);
  base.album = normalizeAlbum(base.album);
  if (base.album.retroDone) return { progress: base, cases: [] };
  const cases = new Set();
  const stamps = [];
  const seenStamp = new Set();
  for (const save of [null, levelSave, careerSave]) {
    if (save === undefined) continue;
    const ctx = save ? contextFromSave(save) : null;
    if (save && !ctx) continue;
    const found = checkAlbum(base, ctx);
    for (const id of found.cases) cases.add(id);
    for (const st of found.stamps) {
      const key = `${st.caseId}/${st.stamp}`;
      if (!seenStamp.has(key)) {
        seenStamp.add(key);
        stamps.push(st);
      }
    }
  }
  const res = recordAlbum(base, { cases: [...cases], stamps }, null, 'retro');
  res.progress.album.retroDone = true;
  return { progress: res.progress, cases: res.cases };
}

/** Texte du rattrapage (« 23 cases de l'album retrouvées… »). */
export function retroText(n) {
  return ALBUM_TEXTS.retro.replace(/\{n\}/g, String(n)).replace(/\{s\}/g, n > 1 ? 's' : '');
}

/**
 * Veillée de Joseph : l'histoire suivante (ordre fixe ; après la 12ᵉ, une histoire déjà entendue, sans écu).
 * → { progress, story: { id, title, lines }, first, ecus } (écu ajouté, case de la page « Les veillées » trouvée).
 */
export function recordStory(progress, now = Date.now(), src = 'levels') {
  const out = clone(progress);
  out.album = normalizeAlbum(out.album);
  const a = out.album;
  const heard = a.stories || 0;
  const first = heard < STORIES.length;
  const story = first ? STORIES[heard] : STORIES[heard % STORIES.length];
  let ecus = 0;
  if (first) {
    a.stories = heard + 1;
    ecus = STORY.ecus;
    out.ecus = (out.ecus || 0) + ecus;
    const caseId = `stories.${story.id}`;
    if (!a.found[caseId]) a.found[caseId] = { at: now, src: SRC.includes(src) ? src : 'levels' };
  } else a.stories = heard + 1;
  return { progress: out, story: clone(story), first, ecus };
}

/** Récapitulatif des tampons (noms, icônes) pour l'interface. */
export function albumStamps() {
  return clone(ALBUM_STAMPS);
}

export { ALBUM_PAGES, ALBUM_CASES };
