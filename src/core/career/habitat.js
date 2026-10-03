// La Vallée vivante (lot V1) — habitats, recettes, emplacements, signes de vie, étapes, indice (pur, sans tirage). Règles :
// docs/VALLEE.md § 4 à § 6 et § 10.1 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V1 ».
// (V2) Espèces et variétés lues sur les tables ALL_* (16 et 35) ; nichoir à chauves-souris (emplacements `bat`, seulement
// avec la partie `heritage`) ; prochain indice dans l'ordre du § 16.9.4 (récit, troc, paire, Grainothèque).

import { getCrop, isTreeCrop } from '../../data/crops.js';
import {
  ALL_SPECIES, ALL_SPECIES_BY_ID, ALL_VARIETIES, ALL_VARIETIES_BY_ID, MAX_STAGE, LONE_TREE, NATURE_ITEMS_BY_ID, NATURE_SPOTS,
  RECIPE_NATURE, RECIPE_TEXTS, STAGES, BOON_TEXTS, agreeWith,
} from '../../data/career/valley.js';
import { SEED_LIBRARY } from '../../data/career/heritage.js';
import { inGreenhouse, isMature } from '../farm.js';
import { isTreeAdult } from '../trees.js';
import { careerSeasonCharge } from './effects.js';
import { handSeedsOf, hasTrait, heritagePartOn, isFixed, libraryLevelOf, seasonAbs, seasonAbsOfDay, speciesInstalled, varietyName } from './heirlooms.js';
import {
  crossLinks, heritageOn, heritageSeedsOn, pairPlots, pairStatus, partnerPlotOf, swapInfo, unreadStory, unitOf,
} from './heritage.js';

const SPECIES = ALL_SPECIES;
const SPECIES_BY_ID = ALL_SPECIES_BY_ID;
const VARIETIES = ALL_VARIETIES;
const VARIETIES_BY_ID = ALL_VARIETIES_BY_ID;

const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const BIG_SHELTERS = ['cowshed', 'stable', 'sheepfold', 'goatShed'];
const SEASON_NAMES = { spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' };

// ── Emplacements ────────────────────────────────────────────────────────────────────────────

/** Le grenier est-il construit ? (nichoir à chouette) */
export function granaryBuilt(state) {
  return !!state.career.buildings?.storage;
}

/** Définitions d'emplacements d'un terrain possédé : [{ slot, kind, side, needs?, startOnly?, heritage? }]. */
function lotSpotDefs(state, lot) {
  const v2 = heritagePartOn(state);
  return (NATURE_SPOTS[lot.type] || []).filter((d) => (!d.startOnly || lot.id === 'start') && (!d.heritage || v2));
}

/**
 * Emplacements des terrains possédés (dans l'ordre des terrains), éventuellement d'un genre :
 * [{ spotId, lotId, lotName, slot, kind, side, placed: null | kind, locked: null | raison }].
 * Le nichoir à chouette n'existe qu'avec le grenier construit.
 */
export function spotsOf(state, kind = null) {
  const v = state.career.valley;
  const out = [];
  for (const lot of state.career.lots) {
    for (const d of lotSpotDefs(state, lot)) {
      if (kind && d.kind !== kind) continue;
      if (d.needs === 'granary' && !granaryBuilt(state)) continue;
      const spotId = `${lot.id}.${d.slot}`;
      out.push({ spotId, lotId: lot.id, lotName: lot.name, slot: d.slot, kind: d.kind, side: d.side, placed: v?.nature?.[spotId]?.kind || null });
    }
  }
  return out;
}

/** Définition d'un emplacement (terrain possédé, genre) ou null. `ignoreNeeds` : le grenier n'est pas exigé (vérification). */
export function spotDef(state, spotId, { ignoreNeeds = false } = {}) {
  if (typeof spotId !== 'string') return null;
  const k = spotId.lastIndexOf('.');
  if (k <= 0) return null;
  const lotId = spotId.slice(0, k);
  const slot = spotId.slice(k + 1);
  const lot = state.career.lots.find((l) => l.id === lotId);
  if (!lot) return null;
  const d = lotSpotDefs(state, lot).find((x) => x.slot === slot);
  if (!d) return null;
  if (d.needs === 'granary' && !ignoreNeeds && !granaryBuilt(state)) return null;
  return { ...d, spotId, lotId, lot };
}

/** « du Haut-Champ », « de la Combe », « des Saules », « de l'Orée ». */
export function ofLot(name) {
  const n = String(name || '');
  if (/^Le /.test(n)) return `du ${n.slice(3)}`;
  if (/^Les /.test(n)) return `des ${n.slice(4)}`;
  if (/^La /.test(n)) return `de la ${n.slice(3)}`;
  if (/^L['’]/.test(n)) return `de l'${n.slice(2)}`;
  return `de ${n}`;
}

const WHERE = {
  hedge: 'près de la haie', strip: 'sur la bande fleurie', nestbox: 'près du nichoir', woodpile: 'près du tas de bois',
  insectHotel: 'près de l\'hôtel à insectes', owlbox: 'au nichoir du grenier', loneTree: 'au pied du chêne', reeds: 'au bord de la mare',
  batbox: 'au nichoir à chauves-souris',
};

/** « près de la haie du Haut-Champ » (texte d'un emplacement). */
export function whereText(state, spotId) {
  const d = spotDef(state, spotId, { ignoreNeeds: true });
  if (!d) return 'dans la ferme';
  if (d.kind === 'reeds' || d.kind === 'owlbox') return WHERE[d.kind];
  return `${WHERE[d.kind]} ${ofLot(d.lot.name)}`;
}

/** Libellé d'un emplacement pour la feuille de confirmation : « Le Haut-Champ, côté gauche ». */
export function spotLabel(state, spotId) {
  const d = spotDef(state, spotId, { ignoreNeeds: true });
  return d ? `${d.lot.name}, ${d.side}` : spotId;
}

/** Stade d'un arbre isolé posé : 'sapling' | 'young' | 'adult' (saisons absolues depuis la plantation). */
export function loneTreeStage(state, entry) {
  if (!entry) return null;
  const age = seasonAbs(state) - seasonAbsOfDay(state, entry.at);
  if (age >= LONE_TREE.adultSeasons) return 'adult';
  return age >= LONE_TREE.youngSeasons ? 'young' : 'sapling';
}

/** Prix du prochain aménagement d'un genre (0 s'il en reste un à replacer dans la réserve). */
export function naturePrice(state, kind) {
  const v = state.career.valley;
  const item = NATURE_ITEMS_BY_ID[kind];
  if (!item || !v) return null;
  if ((v.reserve?.[kind] || 0) > 0) return 0;
  const n = v.bought?.[kind] || 0;
  const p = item.price.base + item.price.step * n;
  return Number.isFinite(item.price.max) ? Math.min(item.price.max, p) : p;
}

/** Réaménagement d'un terrain : les aménagements intérieurs (pas les haies) vont à la réserve. → [kind] */
export function reserveLotNature(state, lotId) {
  const v = state.career?.valley;
  if (!v) return [];
  const kinds = [];
  for (const [spotId, n] of Object.entries(v.nature)) {
    if (!spotId.startsWith(`${lotId}.`)) continue;
    const slot = spotId.slice(lotId.length + 1);
    if (slot === 'hedgeL' || slot === 'hedgeR') continue;
    kinds.push(n.kind);
    v.reserve[n.kind] = (v.reserve[n.kind] || 0) + 1;
    delete v.nature[spotId];
  }
  return kinds;
}

// ── Habitats et recettes ────────────────────────────────────────────────────────────────────

/** Parcelles en jachère fleurie (index). */
export function fallowPlots(state) {
  const out = [];
  state.plots.forEach((p, i) => {
    if (p && p.env && p.unlocked && p.fallow !== undefined && !p.cropId) out.push(i);
  });
  return out;
}

/** Parcelles d'une variété mellifère en pousse (pas encore mûres). */
export function beePlotsGrowing(state) {
  let n = 0;
  for (const p of state.plots) if (p && p.env && p.cropId && hasTrait(state, p, 'bee') && !isMature(p)) n++;
  return n;
}

/** Compte de chaque genre de recette (aménagements posés + ce que la ferme offre). */
export function habitatCounts(state) {
  const v = state.career.valley;
  const c = { hedge: 0, strip: 0, nestbox: 0, woodpile: 0, insectHotel: 0, owlbox: 0, loneTree: 0, reeds: 0, batbox: 0, pond: 0, orchard: 0, wildGround: 0, bigShelter: 0, treeAdult: 0, oakAdult: 0, flowers: 0, cropsGrowing: 0 };
  if (!v) return c;
  for (const n of Object.values(v.nature)) {
    c[n.kind] = (c[n.kind] || 0) + 1;
    if (n.kind === 'loneTree' && loneTreeStage(state, n) === 'adult') c.oakAdult += 1;
  }
  for (const l of state.career.lots) {
    if (l.type === 'pond') c.pond += 1;
    if (l.type === 'orchard') c.orchard += 1;
    if (l.type === 'wild') c.wildGround += 1;
  }
  for (const id of BIG_SHELTERS) if (state.career.buildings?.[id]) c.bigShelter += 1;
  const fallows = fallowPlots(state).length;
  c.wildGround += fallows;
  let apples = 0;
  const growing = new Set();
  for (const p of state.plots) {
    if (!p || !p.env || !p.unlocked || !p.cropId) continue;
    const crop = getCrop(p.cropId);
    if (!crop) continue;
    // Cultures différentes : une variété ancienne compte à part de sa culture ordinaire ; le verger compte aussi.
    growing.add(p.variety ? `${crop.id}:${p.variety}` : crop.id);
    if (isTreeCrop(crop) && isTreeAdult(state, p)) apples += 1;
  }
  c.treeAdult = c.oakAdult + apples;
  c.flowers = c.strip + fallows + beePlotsGrowing(state);
  c.cropsGrowing = growing.size;
  return c;
}

function recipeText(kind, n) {
  const [one, many] = RECIPE_TEXTS[kind] || [kind, kind];
  if (kind === 'pond') return one;
  return `${n} ${n > 1 ? many : one}`;
}

/** Saison d'arrivée de l'espèce (saison du jour). */
export function inSeason(state, id) {
  const s = SPECIES_BY_ID[id];
  return !!s && s.seasons.includes(['spring', 'summer', 'autumn', 'winter'][state.time.seasonIndex]);
}

/** Texte des saisons d'arrivée : « toute l'année », « printemps → automne », « été ». */
export function seasonsText(seasons) {
  if (seasons.length === 4) return 'toute l\'année';
  if (seasons.length === 1) return SEASON_NAMES[seasons[0]];
  if (seasons.length === 2) return `${SEASON_NAMES[seasons[0]]}, ${SEASON_NAMES[seasons[1]]}`;
  return `${SEASON_NAMES[seasons[0]]} → ${SEASON_NAMES[seasons[seasons.length - 1]]}`;
}

const SEASON_WHEN = { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' };
const SEASON_FROM = { spring: 'du printemps', summer: 'de l\'été', autumn: 'de l\'automne', winter: 'de l\'hiver' };
const SEASON_TO = { spring: 'au printemps', summer: 'à l\'été', autumn: 'à l\'automne', winter: 'à l\'hiver' };
/** Quand vient l'espèce, à placer après un verbe : « toute l'année », « en été », « au printemps et en été », « du printemps à l'automne ». */
export function seasonsWhen(seasons) {
  if (seasons.length === 4) return 'toute l\'année';
  if (seasons.length === 1) return SEASON_WHEN[seasons[0]];
  if (seasons.length === 2) return `${SEASON_WHEN[seasons[0]]} et ${SEASON_WHEN[seasons[1]]}`;
  return `${SEASON_FROM[seasons[0]]} ${SEASON_TO[seasons[seasons.length - 1]]}`;
}

/** Pronom sujet et verbe accordés : « il vient », « elles viennent ». */
export function comesText(s, future = false) {
  const pron = s.pl ? (s.g === 'f' ? 'elles' : 'ils') : (s.g === 'f' ? 'elle' : 'il');
  const verb = future ? (s.pl ? 'viendront' : 'viendra') : (s.pl ? 'viennent' : 'vient');
  return `${pron} ${verb}`;
}

/** Recette d'une espèce : { items: [{ kind, n, have, ok, text }], ok, inSeason }. */
export function recipeStatus(state, id, counts = habitatCounts(state)) {
  const s = SPECIES_BY_ID[id];
  if (!s) return null;
  const items = s.recipe.map((r) => {
    const have = counts[r.kind] || 0;
    return { kind: r.kind, n: r.n, have, ok: have >= r.n, text: recipeText(r.kind, r.n) };
  });
  return { items, ok: items.every((x) => x.ok), inSeason: inSeason(state, id) };
}

/** Terrains préférés d'une espèce (spotLot). */
function preferredLots(state, s) {
  if (!s.spotLot) return [];
  const lots = state.career.lots;
  if (s.spotLot === 'bigShelter') return [...new Set(BIG_SHELTERS.map((id) => state.career.buildings?.[id]?.lotId).filter(Boolean))];
  return lots.filter((l) => l.type === s.spotLot).map((l) => l.id);
}

/**
 * Emplacement où l'on voit une espèce : un aménagement posé de ses genres sur un terrain préféré, sinon un emplacement
 * de ces genres sur un terrain préféré, sinon un aménagement posé de ses genres ailleurs, sinon une haie posée, sinon la
 * haie gauche du champ de départ (toujours possédé).
 */
export function speciesSpot(state, id) {
  const s = SPECIES_BY_ID[id];
  if (!s) return null;
  const all = spotsOf(state);
  const pref = new Set(preferredLots(state, s));
  for (const kind of s.spotKinds) {
    const hit = all.find((x) => x.kind === kind && x.placed && pref.has(x.lotId));
    if (hit) return hit.spotId;
  }
  for (const kind of s.spotKinds) {
    const hit = all.find((x) => x.kind === kind && pref.has(x.lotId));
    if (hit) return hit.spotId;
  }
  for (const kind of s.spotKinds) {
    const hit = all.find((x) => x.kind === kind && x.placed);
    if (hit) return hit.spotId;
  }
  const hedge = all.find((x) => x.kind === 'hedge' && x.placed);
  return hedge ? hedge.spotId : 'start.hedgeL';
}

// ── Signes de vie, étapes, services ─────────────────────────────────────────────────────────

/** Habitants installés (ids, ordre des données : les 12 du V1 puis les 4 du V2). */
export function installedSpecies(state) {
  return SPECIES.filter((s) => speciesInstalled(state, s.id)).map((s) => s.id);
}

/** Variétés fixées (ids, ordre des données). */
export function fixedVarieties(state) {
  return VARIETIES.filter((x) => isFixed(state, x.id)).map((x) => x.id);
}

/** Signes de vie : habitants installés + variétés fixées. */
export function signsOfLife(state) {
  if (!state.career?.valley) return 0;
  return installedSpecies(state).length + fixedVarieties(state).length;
}

/** Étape atteinte pour un nombre de signes de vie. */
export function stageFor(signs) {
  let n = 0;
  for (const st of STAGES) if (signs >= st.signs) n = st.n;
  return Math.min(n, MAX_STAGE);
}

/** Services en cours (habitants installés, étapes) : [{ id, text }]. */
export function valleyServices(state) {
  const v = state.career?.valley;
  if (!v) return [];
  const out = [];
  for (const id of installedSpecies(state)) out.push({ id, text: SPECIES_BY_ID[id].service.text });
  for (const st of STAGES) if (st.n <= v.stage && st.reward.boon) out.push({ id: `stage.${st.n}`, text: BOON_TEXTS[st.reward.boon] });
  return out;
}

// ── Le prochain indice (un seul à la fois) ──────────────────────────────────────────────────

function plotSowable(state, i, crop) {
  const p = state.plots[i];
  if (!p || !p.unlocked || !p.env || p.cropId) return false;
  if (isTreeCrop(crop)) return p.env === 'orchard';
  if (p.env === 'orchard') return false;
  return inGreenhouse(p) || crop.seasons.includes(['spring', 'summer', 'autumn', 'winter'][state.time.seasonIndex]);
}

/** Espèces que l'indice regarde : les 16 avec le V2, les 12 du V1 sinon. */
function hintSpecies(state) {
  return heritagePartOn(state) ? SPECIES : SPECIES.filter((s) => s.group !== 'v2');
}

/** Indice « graines à semer » : la première variété dont une graine peut être semée maintenant (null sinon). */
function sowableSeedsHint(state) {
  const v = state.career.valley;
  for (const x of VARIETIES) {
    const n = v.seeds[x.id] || 0;
    if (n <= 0) continue;
    const crop = getCrop(x.cropId);
    const k = state.plots.findIndex((p, i) => plotSowable(state, i, crop));
    if (k >= 0) {
      const name = varietyName(state, x);
      return { kind: 'seeds', text: `${n} ${n > 1 ? 'graines' : 'graine'} de ${name} ${n > 1 ? 'attendent' : 'attend'} d'être ${n > 1 ? 'semées' : 'semée'}.`, icon: x.icon, target: { type: 'plot', id: k } };
    }
  }
  return null;
}

/**
 * (V2) « Semez la paire » : une variété du village en main dont le croisement n'est pas trouvé et dont aucune paire ne
 * pousse, avec une parcelle libre et sa voisine. → null | indice
 */
function pairHint(state) {
  if (!heritageSeedsOn(state)) return null;
  const v = state.career.valley;
  const links = crossLinks(state);
  for (const x of VARIETIES) {
    if (x.group !== 'village' || !v.varieties[x.id]) continue;
    if (v.crosses?.[x.cropId]?.foundAt) continue;
    if (links.some((l) => l.cropId === x.cropId)) continue;
    if (!pairStatus(state, x.cropId).canPair) continue;
    const spots = pairPlots(state, x.cropId);
    if (!spots.length) continue;
    return { kind: 'pair', text: `${x.name} ne demande qu'à rencontrer sa cousine du pays : semez la paire.`, icon: x.icon, target: { type: 'pair', id: x.cropId } };
  }
  return null;
}

/** (V2) La Grainothèque à construire : seulement si on peut la payer en gardant 2 saisons de charges. */
function libraryHint(state) {
  const v = state.career.valley;
  if (!heritageSeedsOn(state) || !v.site || libraryLevelOf(state) > 0) return null;
  const L = SEED_LIBRARY.levels[0];
  if (state.career.rank < L.rank) return null;
  let reserve = 0;
  try {
    reserve = 2 * careerSeasonCharge(state);
  } catch {
    reserve = 0;
  }
  if (state.money - L.price < reserve) return null;
  return { kind: 'library', text: 'Une maison pour vos graines : la Grainothèque peut se construire derrière la maison.', icon: 'icon.library', target: { type: 'library', id: null } };
}

/**
 * Le prochain indice (un seul, docs/VALLEE.md § 16.9.4) : (1) une bête à aller voir ; (2) un chapitre ou un récit de Joseph
 * à lire ; (3) un troc en attente ; (4) un bocal à ouvrir ; (5) une planche d'essai mûre (« + 1 rencontre » si sa jumelle
 * est à côté) ; (6) semer la paire ; (7) des graines qui attendent (rien de semé) ; (8) l'espèce la plus proche de venir ;
 * (9) la Grainothèque à construire ; (10) des graines à semer ; (11) l'étape suivante. → null | { kind, text, icon, target }
 */
export function nextHint(state) {
  const v = state.career?.valley;
  if (!v || !v.started) return null;
  const wild = v.parts.wildlife !== false;
  const seeds = v.parts.seeds !== false;
  const species = hintSpecies(state);
  if (wild) {
    for (const s of species) {
      const e = v.species[s.id];
      if (e?.state === 'visible') return { kind: 'observe', text: `${s.the || s.name} vous attend${s.pl ? 'ent' : ''} ${whereText(state, e.spotId)}.`, icon: s.icon, target: { type: 'species', id: s.id } };
    }
  }
  const unread = STAGES.find((st) => st.n <= v.stage && !v.chapters.read.includes(st.n));
  if (unread) return { kind: 'chapter', text: 'Joseph a quelque chose à vous dire.', icon: 'portrait.joseph', target: null };
  if (heritageOn(state)) {
    const story = unreadStory(state);
    if (story) return { kind: 'story', text: 'Joseph a quelque chose à vous dire.', icon: 'portrait.joseph', target: { type: 'story', id: story.id } };
    const troc = seeds ? swapInfo(state) : null;
    if (troc) return { kind: 'troc', text: `${troc.clientName} propose un troc : ${troc.varietyName}.`, icon: 'troc.pin', target: { type: 'troc', id: troc.clientId } };
  }
  const pending = (state.career.heirlooms || []).length - v.jars.opened;
  if (seeds && pending > 0) return { kind: 'jar', text: pending > 1 ? `${pending} bocaux de graines anciennes à ouvrir.` : 'Un bocal de graines anciennes à ouvrir.', icon: 'item.heirloom', target: null };
  if (seeds) {
    const k = state.plots.findIndex((p) => p && p.env && p.variety && p.cropId && isMature(p) && !isFixed(state, p.variety));
    if (k >= 0) {
      const x = VARIETIES_BY_ID[state.plots[k].variety];
      const name = varietyName(state, x);
      const n = handSeedsOf(state, unitOf(x.id) === 'greffon');
      const unit = unitOf(x.id) === 'greffon' ? (n > 1 ? 'greffons' : 'greffon') : n > 1 ? 'graines' : 'graine';
      const meet = heritageSeedsOn(state) && partnerPlotOf(state, k) >= 0 ? ' et + 1 rencontre' : '';
      return { kind: 'trial', text: `${name} est ${agreeWith(x, 'mûr')} : récoltez-${x.g === 'f' ? 'la' : 'le'} à la main (+ ${n} ${unit}${meet}).`, icon: x.icon, target: { type: 'plot', id: k } };
    }
    const pair = pairHint(state);
    if (pair) return pair;
  }
  // Rien de semé (juste après la boîte de Joseph, ou toutes les planches récoltées) : semer passe avant les recettes —
  // le premier geste de la Vallée est de semer ses graines (relecture « joueur tranquille », intégration V1).
  const nothingSown = !state.plots.some((p) => p && p.variety && p.cropId);
  const seedsHint = seeds ? sowableSeedsHint(state) : null;
  if (seedsHint && nothingSown) return seedsHint;
  if (wild) {
    const counts = habitatCounts(state);
    let best = null;
    for (const s of species) {
      if (v.species[s.id]) continue;
      const r = recipeStatus(state, s.id, counts);
      const missing = r.items.filter((x) => !x.ok);
      let score = missing.reduce((a, x) => a + (x.n - x.have), 0);
      for (const x of missing) {
        const kind = RECIPE_NATURE[x.kind];
        const item = kind && NATURE_ITEMS_BY_ID[kind];
        if (!kind) score += 20;
        else if (item && item.rank > state.career.rank) score += 50;
      }
      if (!missing.length && !r.inSeason) score += 0.5;
      if (!best || score < best.score) best = { s, r, missing, score };
    }
    if (best) {
      const { s, missing } = best;
      if (!missing.length) {
        return { kind: 'recipe', text: `Tout est prêt pour ${lowerFirst(s.the || s.name)} : ${comesText(s)} ${seasonsWhen(s.seasons)}.`, icon: s.icon, target: null };
      }
      const m = missing[0];
      const kind = RECIPE_NATURE[m.kind] || null;
      const lack = m.n - m.have;
      const text = m.kind === 'pond' ? `${s.name} : il faut une mare.` : `${s.name} : il manque ${recipeText(m.kind, lack)}.`;
      const target = kind === 'fallow' ? { type: 'nature', id: 'fallow' } : kind ? { type: 'nature', id: kind } : { type: 'lot', id: null };
      // (V2) La Grainothèque passe avant une recette qui attend un aménagement verrouillé ou un terrain.
      const lib = libraryHint(state);
      if (lib && (!kind || (NATURE_ITEMS_BY_ID[kind]?.rank || 0) > state.career.rank)) return lib;
      return { kind: 'recipe', text, icon: s.icon, target };
    }
  }
  const lib = libraryHint(state);
  if (lib) return lib;
  if (seedsHint) return seedsHint;
  const next = STAGES.find((st) => st.n === v.stage + 1);
  if (next) {
    const left = next.signs - signsOfLife(state);
    return { kind: 'stage', text: `Encore ${left} signe${left > 1 ? 's' : ''} de vie pour « ${next.name} ».`, icon: 'icon.signs', target: null };
  }
  return null;
}

/** Points de beauté des lanternes (aménagements posés, paon-du-jour). */
export function natureBeauty(state) {
  const v = state.career?.valley;
  if (!v) return { nature: 0, butterfly: false };
  const n = Object.values(v.nature).reduce((s, x) => s + (NATURE_ITEMS_BY_ID[x.kind]?.beauty || 0), 0);
  return { nature: n, butterfly: speciesInstalled(state, 'butterfly') };
}

