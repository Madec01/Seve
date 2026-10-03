// La Vallée vivante (lot V1) — habitats, recettes, emplacements, signes de vie, étapes, indice (pur, sans tirage). Règles :
// docs/VALLEE.md § 4 à § 6 et § 10.1 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V1 ».

import { getCrop, isTreeCrop } from '../../data/crops.js';
import {
  MAX_STAGE, LONE_TREE, NATURE_ITEMS, NATURE_ITEMS_BY_ID, NATURE_SPOTS, RECIPE_NATURE, RECIPE_TEXTS, SPECIES, SPECIES_BY_ID, STAGES,
  BOON_TEXTS, VARIETIES, VARIETIES_BY_ID,
} from '../../data/career/valley.js';
import { inGreenhouse, isMature } from '../farm.js';
import { isTreeAdult } from '../trees.js';
import { isFixed, seasonAbs, seasonAbsOfDay, speciesInstalled, traitOf } from './heirlooms.js';

const BIG_SHELTERS = ['cowshed', 'stable', 'sheepfold', 'goatShed'];
const SEASON_NAMES = { spring: 'printemps', summer: 'été', autumn: 'automne', winter: 'hiver' };

// ── Emplacements ────────────────────────────────────────────────────────────────────────────

/** Le grenier est-il construit ? (nichoir à chouette) */
export function granaryBuilt(state) {
  return !!state.career.buildings?.storage;
}

/** Définitions d'emplacements d'un terrain possédé : [{ slot, kind, side, needs?, startOnly? }]. */
function lotSpotDefs(state, lot) {
  return (NATURE_SPOTS[lot.type] || []).filter((d) => (!d.startOnly || lot.id === 'start'));
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
  for (const p of state.plots) if (p && p.env && p.cropId && traitOf(p)?.id === 'bee' && !isMature(p)) n++;
  return n;
}

/** Compte de chaque genre de recette (aménagements posés + ce que la ferme offre). */
export function habitatCounts(state) {
  const v = state.career.valley;
  const c = { hedge: 0, strip: 0, nestbox: 0, woodpile: 0, insectHotel: 0, owlbox: 0, loneTree: 0, reeds: 0, pond: 0, orchard: 0, wildGround: 0, bigShelter: 0, treeAdult: 0, oakAdult: 0, flowers: 0, cropsGrowing: 0 };
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
    if (isTreeCrop(crop)) {
      if (isTreeAdult(state, p)) apples += 1;
    } else if (p.env === 'field' || inGreenhouse(p)) growing.add(crop.id);
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

/** Habitants installés (ids, ordre des données). */
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

/**
 * Le prochain indice : (1) une bête à aller voir ; (2) un chapitre de Joseph à lire ; (3) un bocal à ouvrir ; (4) une
 * planche d'essai mûre ; (5) l'espèce la plus proche de venir (ce qui manque) ; (6) des graines qui attendent d'être
 * semées ; (7) l'étape suivante. → null | { kind, text, icon, target }
 */
export function nextHint(state) {
  const v = state.career?.valley;
  if (!v || !v.started) return null;
  const wild = v.parts.wildlife !== false;
  const seeds = v.parts.seeds !== false;
  if (wild) {
    for (const s of SPECIES) {
      const e = v.species[s.id];
      if (e?.state === 'visible') return { kind: 'observe', text: `${s.name} vous attend ${whereText(state, e.spotId)}.`, icon: s.icon, target: { type: 'species', id: s.id } };
    }
  }
  const unread = STAGES.find((st) => st.n <= v.stage && !v.chapters.read.includes(st.n));
  if (unread) return { kind: 'chapter', text: 'Joseph a quelque chose à vous dire.', icon: 'portrait.joseph', target: null };
  const pending = (state.career.heirlooms || []).length - v.jars.opened;
  if (seeds && pending > 0) return { kind: 'jar', text: pending > 1 ? `${pending} bocaux de graines anciennes à ouvrir.` : 'Un bocal de graines anciennes à ouvrir.', icon: 'item.heirloom', target: null };
  if (seeds) {
    const k = state.plots.findIndex((p) => p && p.env && p.variety && p.cropId && isMature(p) && !isFixed(state, p.variety));
    if (k >= 0) {
      const x = VARIETIES_BY_ID[state.plots[k].variety];
      return { kind: 'trial', text: `${x.name} est mûre : récoltez-la à la main (+ 2 graines).`, icon: x.icon, target: { type: 'plot', id: k } };
    }
  }
  if (wild) {
    const counts = habitatCounts(state);
    let best = null;
    for (const s of SPECIES) {
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
      const { s, r, missing } = best;
      if (!missing.length) {
        return { kind: 'recipe', text: `Tout est prêt pour ${s.name.toLowerCase()} : il vient en ${seasonsText(s.seasons)}.`, icon: s.icon, target: null };
      }
      const m = missing[0];
      const kind = RECIPE_NATURE[m.kind] || null;
      const lack = m.n - m.have;
      const text = m.kind === 'pond' ? `${s.name} : il faut une mare.` : `${s.name} : il manque ${recipeText(m.kind, lack)}.`;
      const target = kind === 'fallow' ? { type: 'nature', id: 'fallow' } : kind ? { type: 'nature', id: kind } : { type: 'lot', id: null };
      void r;
      return { kind: 'recipe', text, icon: s.icon, target };
    }
  }
  if (seeds) {
    for (const x of VARIETIES) {
      const n = v.seeds[x.id] || 0;
      if (n <= 0) continue;
      const crop = getCrop(x.cropId);
      const k = state.plots.findIndex((p, i) => plotSowable(state, i, crop));
      if (k >= 0) return { kind: 'seeds', text: `${n} graine${n > 1 ? 's' : ''} de ${x.name} attend${n > 1 ? 'ent' : ''} d'être semée${n > 1 ? 's' : ''}.`, icon: x.icon, target: { type: 'plot', id: k } };
    }
  }
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

export { NATURE_ITEMS };
