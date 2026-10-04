// La Vallée vivante — lot V2 « Le troc et les croisements » : lectures pures (Grainothèque, troc, croisements, voisinage
// des parcelles, boîte de Joseph, récits), sans enregistrement d'extension et sans tirage. L'extension `valley`
// (src/core/career/valley.js) s'en sert pour son déroulé, ses actions et ses requêtes ; src/core/career/habitat.js pour le
// prochain indice. Règles : docs/VALLEE.md § 16 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 ».
//
// N'importe ni DOM ni horloge ; n'importe pas habitat.js ni valley.js (pas d'import circulaire).

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { CLIENTS } from '../../data/variety.js';
import {
  ALL_VARIETIES, ALL_VARIETIES_BY_ID, JOSEPH_BOX, TRAITS_BY_ID, VARIETIES_BY_ID, VARIETY_OF_CROP, varietyTraits,
} from '../../data/career/valley.js';
import {
  CROSSES, CROSSES_BY_ID, CROSS_OF_CROP, HERITAGE_TEXTS, LIBRARY_MAX, SEED_LIBRARY, STORIES, TROC, TROC_BY_CLIENT, VILLAGE_OF_CROP,
  VILLAGE_VARIETIES_BY_ID, ofFarm,
} from '../../data/career/heritage.js';
import {
  crossNeedOf, fixHandOf, handSeedsOf, heritagePartOn, isFixed, libraryEffectsOf, libraryLevelOf, placesOn, storksOn, valleyOf, varietyName,
} from './heirlooms.js';
import { STORIES_V3 } from '../../data/career/places.js';
import { EPILOGUE, STORIES_V4 } from '../../data/career/storks.js';
import { inGreenhouse } from '../farm.js';

const CLIENTS_BY_ID = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));

// ── État et Grainothèque ───────────────────────────────────────────────────────────────────

/** Le V2 est-il ouvert ? (Vallée commencée et partie `heritage`.) */
export function heritageOn(state) {
  const v = valleyOf(state);
  return !!v && !!v.started && v.parts?.heritage !== false;
}

/** Troc et croisements : il faut aussi la partie `seeds`. */
export function heritageSeedsOn(state) {
  const v = valleyOf(state);
  return heritageOn(state) && v.parts?.seeds !== false;
}

/** Niveau de la Grainothèque (0 : pas construite). */
export function libraryLevel(state) {
  return libraryLevelOf(state);
}

/** Effets cumulés : { level, circle, handSeeds, fixHand, crossNeed, fixedSeedFactor, touristBonus }. */
export function libraryEffects(state) {
  return libraryEffectsOf(state);
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

/** Lignes cochées des effets en cours (« ✓ Troc de saison »…). */
function effectLines(level) {
  // (intégration) Les lignes du troc des niveaux 1 à 3 se résument en une seule (« … (8 voisins) ») : moins à lire.
  const out = [];
  let circle = 0;
  for (const L of SEED_LIBRARY.levels) if (L.level <= level && L.circle) circle = Math.max(circle, L.circle);
  const per = TROC.order.filter((e) => e.circle === 1).length;
  const total = TROC.order.filter((e) => e.circle <= circle).length || per;
  for (const L of SEED_LIBRARY.levels) {
    if (L.level > level) continue;
    for (const t of L.unlocks) {
      if (/^Troc\b/.test(t)) {
        if (L.level === 1) out.push(t.replace(/\(\d+ voisins\)/, total >= TROC.order.length ? `(les ${TROC.order.length} voisins)` : `(${total} voisins)`));
        continue;
      }
      out.push(t);
    }
  }
  return out;
}

/**
 * Le prochain niveau : { level, name, price, rank, canBuild, reason, unlocks } | null (au plus haut). Refus : rang, argent,
 * V2 désactivé.
 */
export function nextLibraryLevel(state) {
  const level = libraryLevelOf(state);
  if (level >= LIBRARY_MAX) return null;
  const L = SEED_LIBRARY.levels[level];
  const v = valleyOf(state);
  let reason = null;
  if (!v || v.parts?.heritage === false || v.parts?.seeds === false) reason = HERITAGE_TEXTS.disabled;
  else if (!v.started) reason = 'La Vallée commence au rang 2.';
  else if (state.career.rank < L.rank) reason = `Rang ${L.rank} requis`;
  else if (state.money < L.price) reason = notEnough(L.price - state.money);
  return { level: L.level, name: L.name, price: L.price, rank: L.rank, canBuild: !reason, reason, unlocks: [...L.unlocks], vignette: L.vignette };
}

/** Fiche « La Grainothèque » : { level, name, site, vignette, effects, next }. */
export function libraryInfo(state) {
  const v = valleyOf(state);
  const level = libraryLevelOf(state);
  const L = level ? SEED_LIBRARY.levels[level - 1] : null;
  return {
    level,
    name: L ? L.name : SEED_LIBRARY.name,
    site: !!v?.site,
    vignette: L ? L.vignette : 'library.site',
    effects: effectLines(level),
    siteLines: [...SEED_LIBRARY.siteLines],
    next: nextLibraryLevel(state),
  };
}

// ── Troc ───────────────────────────────────────────────────────────────────────────────────

function hasOrchard(state) {
  return state.career.lots.some((l) => l.type === 'orchard');
}

function hasGreenhouse(state) {
  return state.career.lots.some((l) => l.type === 'greenhouse');
}

/** Variétés sauvées (fixées), dans l'ordre des données (pays, village, croisées ; (V3) Reinette grise). */
export function savedVarieties(state) {
  return ALL_VARIETIES.filter((x) => isFixed(state, x.id) && (x.group !== 'orchard' || placesOn(state))).map((x) => x.id);
}

/** Voisins encore à échanger (ordre fixe). */
export function trocRemaining(state) {
  const v = valleyOf(state);
  return TROC.order.filter((o) => !v?.swaps?.[o.clientId]);
}

/** Raison pour laquelle un voisin ne propose pas encore de troc de saison (null : il peut). */
export function trocLock(state, entry) {
  if (entry.needs === 'orchard' && !hasOrchard(state)) return HERITAGE_TEXTS.needOrchard;
  if (libraryEffectsOf(state).circle < entry.circle) return `Grainothèque niveau ${entry.circle}`;
  return null;
}

/**
 * Prochain voisin qui propose un troc : `from` 'fair' (foire aux graines : le prochain de l'ordre, tous cercles confondus ;
 * Léon attend un verger) ou 'season' (cercle ouvert par la Grainothèque ; le premier dont la culture se sème cette saison
 * ou la suivante — toute l'année avec une serre —, sinon le premier). → entrée de TROC.order | null
 */
export function nextTrocClient(state, from = 'season') {
  const list = trocRemaining(state).filter((o) => (o.needs !== 'orchard' || hasOrchard(state)));
  if (from === 'fair') return list[0] || null;
  const open = list.filter((o) => !trocLock(state, o));
  if (!open.length) return null;
  const now = SEASONS[state.time.seasonIndex];
  const next = SEASONS[(state.time.seasonIndex + 1) % 4];
  const gh = hasGreenhouse(state);
  const soon = open.find((o) => {
    const crop = getCrop(ALL_VARIETIES_BY_ID[o.varietyId].cropId);
    if (gh && !isTreeCrop(crop)) return true;
    return crop.seasons.includes(now) || crop.seasons.includes(next);
  });
  return soon || open[0];
}

/** La variété est-elle d'une culture préférée du voisin (♥) ? */
export function isFavGift(clientId, varietyId) {
  const c = CLIENTS_BY_ID[clientId];
  const x = ALL_VARIETIES_BY_ID[varietyId];
  return !!c && !!x && c.favorites.includes(x.cropId);
}

/** Ce qu'on peut donner à un voisin : variétés sauvées sauf la sienne ; ♥ (préférées) en tête. → [{ varietyId, fav }] */
export function trocGifts(state, clientId) {
  const entry = TROC_BY_CLIENT[clientId];
  const list = savedVarieties(state).filter((id) => !entry || id !== entry.varietyId).map((id) => ({ varietyId: id, fav: isFavGift(clientId, id) }));
  return [...list.filter((x) => x.fav), ...list.filter((x) => !x.fav)];
}

/** Unité d'une variété (« graine » | « greffon »). */
export function unitOf(varietyId) {
  const x = ALL_VARIETIES_BY_ID[varietyId];
  return x && isTreeCrop(getCrop(x.cropId)) ? 'greffon' : 'graine';
}

function traitInfo(id) {
  const t = TRAITS_BY_ID[id];
  return t ? { id: t.id, name: t.name, icon: t.icon, text: t.text } : null;
}

/** Traits d'une variété en informations ([{ id, name, icon, text }]). */
export function traitInfos(x) {
  return varietyTraits(x).map(traitInfo).filter(Boolean);
}

/** Nom d'un voisin, titre et portrait. */
export function clientInfo(clientId) {
  const c = CLIENTS_BY_ID[clientId];
  return { clientId, clientName: c ? c.name : clientId, clientTitle: c ? c.title : '', portrait: `portrait.client.${clientId}` };
}

/** Texte du ♥ : « Elle adore les fraises : 4 graines ». */
function favTextOf(clientId) {
  const c = CLIENTS_BY_ID[clientId];
  if (!c) return null;
  const crops = c.favorites.map((id) => getCrop(id)?.name?.toLowerCase()).filter(Boolean);
  return `${c.name} adore ${crops.length > 1 ? `${crops.slice(0, -1).join(', ')} et ${crops.at(-1)}` : crops[0]} : ${TROC.seeds + TROC.favBonus} graines au lieu de ${TROC.seeds}.`;
}

/** La proposition en attente (trocInfo) ou null. */
export function swapInfo(state) {
  const v = valleyOf(state);
  if (!v?.troc) return null;
  const entry = TROC_BY_CLIENT[v.troc.clientId];
  if (!entry) return null;
  const x = VILLAGE_VARIETIES_BY_ID[entry.varietyId];
  const unit = unitOf(x.id);
  const gifts = trocGifts(state, entry.clientId).map(({ varietyId, fav }) => {
    const g = ALL_VARIETIES_BY_ID[varietyId];
    return { varietyId, name: varietyName(state, g), icon: g.icon, traits: traitInfos(g), group: g.group, fav, seedsBack: TROC.seeds + (fav ? TROC.favBonus : 0) };
  });
  return {
    ...clientInfo(entry.clientId),
    from: v.troc.from,
    since: v.troc.since,
    text: TROC.lines[entry.clientId]?.offer || '',
    fairText: v.troc.from === 'fair' ? TROC.fairText : null,
    varietyId: x.id,
    varietyName: x.name,
    icon: x.icon,
    traits: traitInfos(x),
    anecdote: x.anecdote,
    label: x.label,
    seeds: TROC.seeds,
    unit,
    gifts,
    favText: favTextOf(entry.clientId),
    noCost: HERITAGE_TEXTS.noCost,
  };
}

// ── Voisinage des parcelles et croisements ─────────────────────────────────────────────────

/** Colonnes d'un terrain : 3 au verger, 4 au champ et à la serre (même règle que query.plot(i)). */
function colsOf(p) {
  return p.env === 'orchard' ? 3 : 4;
}

/**
 * Voisines d'une parcelle : même terrain, même `env`, un côté commun (|Δcol| + |Δrow| = 1 ; col = cell % cols). Ordre :
 * droite, gauche, dessous, dessus. → [index]
 */
export function plotNeighbours(state, i) {
  const p = state.plots[i];
  if (!p || !p.env) return [];
  const cols = colsOf(p);
  const col = p.cell % cols;
  const row = Math.floor(p.cell / cols);
  const want = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]];
  const out = [];
  for (const [c, r] of want) {
    if (c < 0 || c >= cols || r < 0) continue;
    const cell = r * cols + c;
    const k = state.plots.findIndex((q, j) => j !== i && q && q.lot === p.lot && q.env === p.env && q.cell === cell);
    if (k >= 0) out.push(k);
  }
  return out;
}

/** Croisement d'une culture (définition) ou null. */
export function crossOfCrop(cropId) {
  const id = CROSS_OF_CROP[cropId];
  return id ? CROSSES_BY_ID[id] : null;
}

/** Parent d'un croisement : { crossId, partnerId } (l'autre parent) ; null sinon. */
export function partnerOf(varietyId) {
  for (const c of CROSSES) {
    const k = c.parents.indexOf(varietyId);
    if (k >= 0) return { crossId: c.id, partnerId: c.parents[1 - k], cropId: c.cropId };
  }
  return null;
}

/** État d'un croisement : { cropId, crossId, meet, need, found, foundAt }. */
export function crossState(state, cropId) {
  const c = crossOfCrop(cropId);
  if (!c) return null;
  const e = valleyOf(state)?.crosses?.[cropId];
  return { cropId, crossId: c.id, meet: e?.meet || 0, need: crossNeedOf(state), found: !!e?.foundAt, foundAt: e?.foundAt ?? null };
}

/** Parcelle semée d'une variété précise (à n'importe quel stade) ? */
function sownWith(p, varietyId) {
  return !!p && !!p.env && !!p.cropId && p.variety === varietyId;
}

/** Voisine portant l'autre parent d'un croisement pas encore trouvé (index) ou -1. */
export function partnerPlotOf(state, i) {
  const p = state.plots[i];
  if (!p?.variety || !p.cropId) return -1;
  const link = partnerOf(p.variety);
  if (!link) return -1;
  if (valleyOf(state)?.crosses?.[link.cropId]?.foundAt) return -1;
  return plotNeighbours(state, i).find((k) => sownWith(state.plots[k], link.partnerId)) ?? -1;
}

/** Paires de parents voisins (croisement pas trouvé), au plus 12 : [{ a, b, cropId, meet, need }]. */
export function crossLinks(state) {
  if (!heritageSeedsOn(state)) return [];
  const out = [];
  const seen = new Set();
  state.plots.forEach((p, i) => {
    if (out.length >= 12 || !p?.variety || !p.cropId) return;
    const link = partnerOf(p.variety);
    if (!link || link.partnerId === p.variety) return;
    const cs = crossState(state, link.cropId);
    if (!cs || cs.found) return;
    for (const k of plotNeighbours(state, i)) {
      if (!sownWith(state.plots[k], link.partnerId)) continue;
      const key = i < k ? `${i}:${k}` : `${k}:${i}`;
      if (seen.has(key) || out.length >= 12) continue;
      seen.add(key);
      out.push({ a: Math.min(i, k), b: Math.max(i, k), cropId: link.cropId, meet: cs.meet, need: cs.need });
    }
  });
  return out;
}

/** Une parcelle vide où l'on peut semer cette culture aujourd'hui (pas au verger, saison ou serre). */
export function plotFreeFor(state, i, crop) {
  const p = state.plots[i];
  if (!p || !p.env || !p.unlocked || p.cropId || p.env === 'orchard') return false;
  if (isTreeCrop(crop)) return false;
  return inGreenhouse(p) || crop.seasons.includes(SEASONS[state.time.seasonIndex]);
}

/** Première voisine libre pour le second parent (droite, gauche, dessous, dessus) ou -1. */
export function pairPartnerPlot(state, i, crop) {
  return plotNeighbours(state, i).find((k) => plotFreeFor(state, k, crop)) ?? -1;
}

/** Mode paire : parcelles vides avec une voisine vide où la culture se sème aujourd'hui. → [{ plotIndex, partnerPlot }] */
export function pairPlots(state, cropId) {
  const crop = getCrop(cropId);
  if (!crop || !crossOfCrop(cropId)) return [];
  const out = [];
  state.plots.forEach((p, i) => {
    if (!plotFreeFor(state, i, crop)) return;
    const k = pairPartnerPlot(state, i, crop);
    if (k >= 0) out.push({ plotIndex: i, partnerPlot: k });
  });
  return out;
}

/** Une paire de ce croisement pousse-t-elle (deux parents voisins) ? */
export function pairGrowing(state, cropId) {
  return crossLinks(state).some((l) => l.cropId === cropId);
}

/** A-t-on de quoi semer une variété (graines gardées, ou variété sauvée) ? */
export function canSupply(state, varietyId) {
  const v = valleyOf(state);
  return (v?.seeds?.[varietyId] || 0) > 0 || isFixed(state, varietyId);
}

/**
 * Peut-on semer la paire d'une culture (sans regarder les parcelles) ? → { canPair, reason }. Raisons douces : « Il faut
 * d'abord la Carotte violette : Lili la garde dans son jardin ».
 */
export function pairStatus(state, cropId) {
  const c = crossOfCrop(cropId);
  if (!c) return { canPair: false, reason: 'Culture sans croisement.' };
  if (!heritageSeedsOn(state)) return { canPair: false, reason: HERITAGE_TEXTS.disabled };
  if (valleyOf(state)?.crosses?.[cropId]?.foundAt) return { canPair: false, reason: 'Ce croisement est déjà trouvé.' };
  const [paysId, villageId] = c.parents;
  if (!canSupply(state, villageId)) {
    const x = VILLAGE_VARIETIES_BY_ID[villageId];
    const v = valleyOf(state);
    if (v?.varieties?.[villageId]) return { canPair: false, reason: `Plus de graines de ${x.name} pour l'instant.` };
    const art = x.g === 'm' ? 'le' : 'la';
    return { canPair: false, reason: HERITAGE_TEXTS.pairNeed.replace('{the}', `${art} ${x.name}`).replace('{client}', clientInfo(x.clientId).clientName).replace('{pron}', art) };
  }
  if (!canSupply(state, paysId)) {
    const x = VARIETIES_BY_ID[paysId];
    const v = valleyOf(state);
    if (v?.varieties?.[paysId]) return { canPair: false, reason: `Plus de graines de ${x.name} pour l'instant.` };
    return { canPair: false, reason: HERITAGE_TEXTS.pairNeedPays.replace('{name}', x.name) };
  }
  return { canPair: true, reason: null };
}

// ── Boîte de Joseph, récits, nom de la ferme ───────────────────────────────────────────────

/** Nom de la ferme (« Ferme des Tilleuls »). */
export function farmDisplayName(state) {
  return state.career?.farmName || 'la ferme';
}

/** « de la Ferme des Tilleuls » */
export function farmOf(state) {
  return ofFarm(farmDisplayName(state));
}

/** « Revoir la boîte en fer » : la fenêtre du premier jour reconstruite depuis l'état. */
export function boxInfo(state) {
  const v = valleyOf(state);
  if (!v?.started) return null;
  const hedgeSpot = Object.entries(v.nature || {}).find(([spotId, n]) => n.kind === 'hedge' && spotId === JOSEPH_BOX.freeHedge)?.[0] || null;
  const fix = fixHandOf(state);
  return {
    title: JOSEPH_BOX.title,
    vignette: JOSEPH_BOX.vignette,
    lines: [...JOSEPH_BOX.lines],
    hedgeLine: JOSEPH_BOX.hedgeLine,
    hedge: hedgeSpot ? { spotId: hedgeSpot, label: 'Le champ de départ, côté gauche' } : null,
    melonLine: JOSEPH_BOX.lines[2],
    varieties: JOSEPH_BOX.varieties.map((id) => {
      const x = VARIETIES_BY_ID[id];
      const e = v.varieties?.[id];
      const t = TRAITS_BY_ID[x.trait];
      return {
        varietyId: id, name: x.name, icon: x.icon, trait: { id: t.id, name: t.name, icon: t.icon, text: t.text },
        state: e?.fixedAt ? 'fixed' : e ? 'seeds' : 'unknown', seeds: v.seeds?.[id] || 0, hand: e?.hand || 0, need: fix,
      };
    }),
  };
}

/**
 * Récits de la carrière : ceux de la Grainothèque (V2), puis (V3, partie `places`) ceux de la vallée, puis (V4, partie
 * `storks`) ceux des cigognes et l'épilogue de Joseph (relisibles).
 */
export function storiesOf(state) {
  if (!placesOn(state)) return STORIES;
  return storksOn(state) ? [...STORIES, ...STORIES_V3, ...STORIES_V4, EPILOGUE_STORY] : [...STORIES, ...STORIES_V3];
}

/** (V4) L'épilogue comme récit relisible : ses 3 pages (lignes à la suite) ; `{ofFarm}` remplacé par storiesInfo. */
const EPILOGUE_STORY = { id: EPILOGUE.id, title: EPILOGUE.title, vignette: EPILOGUE.vignette, lines: EPILOGUE.pages.flatMap((p) => p.lines), pages: EPILOGUE.pages, epilogue: true };

/** « {ofFarm} » d'un récit du V4 remplacé par « de la Ferme des Tilleuls ». */
function storyLines(state, s) {
  return s.lines.map((l) => l.replace('{ofFarm}', farmOf(state)));
}

/** Récits de Joseph : [{ id, title, vignette, lines, available, read }] (V2, puis V3, puis V4 et l'épilogue). */
export function storiesInfo(state) {
  const v = valleyOf(state);
  const av = v?.stories?.available || [];
  const rd = v?.stories?.read || [];
  return storiesOf(state).map((s) => {
    const base = { id: s.id, title: s.title, vignette: s.vignette, lines: storyLines(state, s), available: av.includes(s.id), read: rd.includes(s.id) };
    if (STORIES.includes(s)) return base;
    if (STORIES_V3.includes(s)) return { ...base, v3: true };
    if (s.epilogue) return { ...base, v4: true, epilogue: true, pages: s.pages.map((p) => ({ vignette: p.vignette, lines: p.lines.map((l) => l.replace('{ofFarm}', farmOf(state))) })) };
    return { ...base, v4: true };
  });
}

/** Récit disponible pas encore lu (le premier) ou null. (V4) L'épilogue a son propre indice : il n'est pas compté ici. */
export function unreadStory(state) {
  const v = valleyOf(state);
  if (!v?.stories) return null;
  return storiesOf(state).find((s) => !s.epilogue && v.stories.available.includes(s.id) && !v.stories.read.includes(s.id)) || null;
}

/** Graines rendues par une récolte à la main (lu par l'indice et les fiches). */
export function handSeedsFor(state, varietyId) {
  return handSeedsOf(state, unitOf(varietyId) === 'greffon');
}

/** La variété du village d'une culture et celle du pays (aide aux fiches). */
export function parentsOfCrop(cropId) {
  return { paysId: VARIETY_OF_CROP[cropId] || null, villageId: VILLAGE_OF_CROP[cropId] || null };
}

export { heritagePartOn };
