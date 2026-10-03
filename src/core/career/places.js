// La Vallée vivante — lot V3 « Le ruisseau » : lectures pures (vue de la vallée, lieux, chantiers, conditions de vie,
// habitants de la vallée, pêche au ruisseau, champignons, arbres du verger conservatoire, terres sauvages, étapes 6 et 7),
// sans enregistrement d'extension et sans tirage. L'extension `valley` (src/core/career/valley.js) s'en sert pour son
// déroulé, ses actions et ses requêtes ; src/core/career/habitat.js pour les signes de vie, les étapes et l'indice.
// Règles : docs/VALLEE.md § 17 ; contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V3 ».
//
// N'importe ni DOM ni horloge ; n'importe ni habitat.js, ni valley.js, ni land.js (pas d'import circulaire). Les avantages
// des lieux sont lus dans heirlooms.js (porte d'entrée des modules partagés) et ré-exportés ici.

import { SEASONS } from '../../data/balance.js';
import { getCrop, isTreeCrop } from '../../data/crops.js';
import { FIRST_LOT_INDEX, LOT_GRID, inLotGrid, lotCellOf, lotIdAt, lotNameAt } from '../../data/career/lots.js';
import { ALL_SPECIES_BY_ID, ALL_VARIETIES_BY_ID, LONE_TREE, RECIPE_TEXTS, agreeWith } from '../../data/career/valley.js';
import {
  MUSHROOMS, MUSHROOMS_BY_ID, MUSHROOM_RULES, PLACES, PLACES_BY_ID, PLACES_OPEN, PLACES_TEXTS, PLACE_MAX, PLACE_STEPS_TOTAL, RIVER_FISH, RIVER_RULES,
  STAGES_V3, STORIES_V3, VALLEY_SPECIES, VALLEY_SPECIES_BY_ID, VALLEY_TREES, WILD_KINDS, WILD_KINDS_BY_ID, WILD_RULES, WILD_VISITOR_NAMES,
} from '../../data/career/places.js';
import { hashSeed } from '../rng.js';
import { isTreeAdult } from '../trees.js';
import { isFixed, placeStepOf, placesOn, seasonAbs, seasonAbsOfDay, speciesInstalled, valleyOf } from './heirlooms.js';

export {
  crowsPlacesFactorOf, fallowGrowthOf, heatDryGrowthOf, heatingFactorOf, hedgeCoinsFactorOf, meadowHivesOf, millPlacesOf, placeBoonActive, placesAnimalBonusOf,
  placesOn, placesTouristBonusOf, pondFishFactorOf, upkeepFactorOf, valleyDryGrowth, waterBackOf, winterFindsPlusOf,
} from './heirlooms.js';

const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Jour absolu de la carrière (1 = premier jour de l'an 1). */
export function absDayOf(state) {
  return (state.time.year - 1) * 4 * state.career.seasonLength + state.time.day;
}

/** « 3 jours », « 1 jour ». */
export function daysText(n) {
  const d = Math.max(0, Math.ceil(n));
  return `${d} jour${d > 1 ? 's' : ''}`;
}

/** « 2 saisons », « 1 saison ». */
export function seasonsWord(n) {
  return `${n} saison${n > 1 ? 's' : ''}`;
}

// ── Ouverture ──────────────────────────────────────────────────────────────────────────────

/** La vue de la vallée est-elle ouverte (étape 5 atteinte, première aube) ? */
export function viewOpen(state) {
  return placesOn(state) && !!valleyOf(state).view?.open;
}

/** Étape atteinte d'un lieu (0..max). */
export function placeStep(state, placeId) {
  return placeStepOf(state, placeId);
}

/** Chantier en cours d'un lieu (null sinon) : { step, startedAt, readyAt, cost }. */
export function placeWorks(state, placeId) {
  if (!placesOn(state)) return null;
  return valleyOf(state).places?.[placeId]?.works || null;
}

/** Étapes de lieux atteintes (signes de vie). */
export function placesSigns(state) {
  if (!placesOn(state)) return 0;
  return PLACES.reduce((s, p) => s + placeStepOf(state, p.id), 0);
}

// ── Conditions de vie ──────────────────────────────────────────────────────────────────────

/** Aménagements posés d'un genre (haies, bandes, tas de bois) ; chênes isolés adultes ('loneTreeAdult'). */
function natureCount(state, id) {
  const v = valleyOf(state);
  if (!v) return 0;
  let n = 0;
  for (const x of Object.values(v.nature || {})) {
    if (id === 'loneTreeAdult') {
      if (x.kind === 'loneTree' && seasonAbs(state) - seasonAbsOfDay(state, x.at) >= LONE_TREE.adultSeasons) n += 1;
    } else if (x.kind === id) n += 1;
  }
  return n;
}

/** Arbres fruitiers adultes dans les vergers (pommiers, variétés, cerisiers, poiriers). */
export function adultOrchardTrees(state) {
  let n = 0;
  for (const p of state.plots) {
    if (!p || p.env !== 'orchard' || !p.cropId) continue;
    const crop = getCrop(p.cropId);
    if (crop && isTreeCrop(crop) && isTreeAdult(state, p)) n += 1;
  }
  return n;
}

/** Texte d'un genre d'aménagement compté : « 8 haies », « 1 chêne isolé adulte ». */
function natureWords(id, n) {
  if (id === 'loneTreeAdult') return `${n} ${n > 1 ? 'chênes isolés adultes' : 'chêne isolé adulte'}`;
  const [one, many] = RECIPE_TEXTS[id] || [id, id];
  return `${n} ${n > 1 ? many : one}`;
}

/** Ce qui manque sur la ferme pour qu'un habitant du V1 ou du V2 puisse venir (texte doux) ; null sinon. */
function speciesHelp(state, s) {
  if (!s || speciesInstalled(state, s.id)) return null;
  const kinds = (s.recipe || []).map((r) => r.kind);
  const lots = state.career.lots;
  if (kinds.includes('pond') && !lots.some((l) => l.type === 'pond')) return PLACES_TEXTS.needPond;
  if (kinds.includes('orchard') && !lots.some((l) => l.type === 'orchard')) return PLACES_TEXTS.needOrchard;
  if (kinds.includes('owlbox') && !state.career.buildings?.storage) return PLACES_TEXTS.needGranary;
  if (kinds.includes('oakAdult') && natureCount(state, 'loneTreeAdult') === 0) return PLACES_TEXTS.needOak;
  return null;
}

/** Nom d'une variété avec son article : « la Pomme Calville blanc d'hiver ». */
function theVariety(x) {
  return `${x.g === 'm' ? 'le' : 'la'} ${x.name}`;
}

/**
 * État d'une condition de vie : { kind, ok, have, n, text, lack, target, help? }. `text` : la ligne cochée ; `lack` : ce qui
 * manque, pour « Il manque : … » ; `target` : où aller ({ type: 'species' | 'nature' | 'place' | 'variety' | 'lot', id }).
 */
export function needStatus(state, need) {
  switch (need.kind) {
    case 'nature': {
      const have = natureCount(state, need.id);
      const lack = Math.max(0, need.n - have);
      const id = need.id === 'loneTreeAdult' ? 'loneTree' : need.id;
      return { kind: 'nature', ok: have >= need.n, have, n: need.n, text: `${natureWords(need.id, need.n)} sur la ferme`, lack: natureWords(need.id, lack || need.n), target: { type: 'nature', id } };
    }
    case 'fallowsTotal': {
      const have = valleyOf(state)?.stats?.fallows || 0;
      const lack = Math.max(0, need.n - have);
      const words = (n) => `${n} ${n > 1 ? 'jachères fleuries' : 'jachère fleurie'}`;
      return { kind: 'fallowsTotal', ok: have >= need.n, have, n: need.n, text: `${words(need.n)} semées (en tout)`, lack: words(lack || need.n), target: { type: 'nature', id: 'fallow' } };
    }
    case 'species': {
      const s = ALL_SPECIES_BY_ID[need.id];
      const ok = speciesInstalled(state, need.id);
      const help = ok ? null : speciesHelp(state, s);
      const out = { kind: 'species', ok, have: ok ? 1 : 0, n: 1, text: `${s.the} ${agreeWith(s, 'installé')}`, lack: lowerFirst(s.the), target: { type: 'species', id: need.id } };
      return help ? { ...out, help } : out;
    }
    case 'place': {
      const p = PLACES_BY_ID[need.id];
      const have = placeStepOf(state, need.id);
      return { kind: 'place', ok: have >= need.step, have, n: need.step, text: `${p.name} à l'étape ${need.step}`, lack: `${lowerFirst(p.name)} à l'étape ${need.step}`, target: { type: 'place', id: need.id } };
    }
    case 'variety': {
      const x = ALL_VARIETIES_BY_ID[need.id];
      const ok = isFixed(state, need.id);
      return { kind: 'variety', ok, have: ok ? 1 : 0, n: 1, text: `${capital(theVariety(x))} ${agreeWith(x, 'sauvé')}`, lack: theVariety(x), target: { type: 'variety', id: need.id } };
    }
    case 'treesAdult': {
      const have = adultOrchardTrees(state);
      const lack = Math.max(0, need.n - have);
      const words = (n) => `${n} ${n > 1 ? 'arbres fruitiers adultes' : 'arbre fruitier adulte'}`;
      const orchard = state.career.lots.find((l) => l.type === 'orchard');
      return { kind: 'treesAdult', ok: have >= need.n, have, n: need.n, text: `${words(need.n)} dans vos vergers`, lack: words(lack || need.n), target: { type: 'lot', id: orchard ? orchard.id : null } };
    }
    default:
      return { kind: need.kind, ok: false, have: 0, n: 0, text: '?', lack: '?', target: null };
  }
}

/** Étape suivante d'un lieu (définition) ou null (restauré). */
export function nextStepOf(state, placeId) {
  const p = PLACES_BY_ID[placeId];
  if (!p) return null;
  return p.steps[placeStepOf(state, placeId) + 1] || null;
}

/** Conditions de l'étape suivante d'un lieu : [needStatus] ([] si restauré). */
export function placeNeeds(state, placeId) {
  const st = nextStepOf(state, placeId);
  return st ? st.needs.map((n) => needStatus(state, n)) : [];
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

/** Jours restants d'un chantier (0 : la reprise se termine à la prochaine aube). */
function worksDaysLeft(state, works) {
  return Math.max(0, works.readyAt - absDayOf(state));
}

/**
 * Peut-on lancer le chantier de l'étape suivante ? → { ok, reason, cost, seasons, step, missing: [lack] }. Refus, dans
 * l'ordre : V3 désactivé, vue pas ouverte, lieu inconnu, restauré, chantier en cours, conditions, argent.
 */
export function canStartWorks(state, placeId) {
  const base = { ok: false, reason: null, cost: 0, seasons: 0, step: null, missing: [] };
  if (!placesOn(state)) return { ...base, reason: PLACES_TEXTS.disabled };
  if (!viewOpen(state)) return { ...base, reason: PLACES_TEXTS.notOpen };
  const p = PLACES_BY_ID[placeId];
  if (!p) return { ...base, reason: PLACES_TEXTS.unknownPlace };
  const st = nextStepOf(state, placeId);
  if (!st) return { ...base, reason: PLACES_TEXTS.restored };
  const out = { ...base, cost: st.cost, seasons: st.seasons, step: st.n };
  const works = placeWorks(state, placeId);
  if (works) return { ...out, reason: PLACES_TEXTS.worksRunning.replace('{days}', daysText(worksDaysLeft(state, works))) };
  const missing = placeNeeds(state, placeId).filter((n) => !n.ok).map((n) => n.lack);
  if (missing.length) return { ...out, missing, reason: PLACES_TEXTS.missing.replace('{list}', missing.join(', ')) };
  if (state.money < st.cost) return { ...out, reason: notEnough(st.cost - state.money) };
  return { ...out, ok: true };
}

/** Conditions remplies (sans regarder l'argent ni la reprise) : l'étape suivante est « prête ». */
export function placeReady(state, placeId) {
  const st = nextStepOf(state, placeId);
  return !!st && !placeWorks(state, placeId) && placeNeeds(state, placeId).every((n) => n.ok);
}

// ── Fiches ─────────────────────────────────────────────────────────────────────────────────

/** État d'un habitant de la vallée : 'unknown' | 'hint' | 'visible' | 'installed'. */
function valleySpeciesState(state, id) {
  return valleyOf(state)?.species?.[id]?.state || 'unknown';
}

/** Fiche d'un lieu (placeInfo du contrat). */
export function placeInfo(state, placeId) {
  const p = PLACES_BY_ID[placeId];
  if (!p) return null;
  const step = placeStepOf(state, placeId);
  const max = PLACE_MAX[placeId];
  const cur = p.steps[step];
  const w = placeWorks(state, placeId);
  const L = state.career.seasonLength;
  let works = null;
  if (w) {
    const left = worksDaysLeft(state, w);
    const total = Math.max(1, w.readyAt - w.startedAt);
    works = {
      step: w.step, name: p.steps[w.step].name, startedAt: w.startedAt, readyAt: w.readyAt, daysLeft: left, seasonsLeft: Math.ceil(left / L),
      progress: Math.max(0, Math.min(1, (total - left) / total)), cost: w.cost,
    };
  }
  const st = p.steps[step + 1] || null;
  let next = null;
  if (st) {
    const check = canStartWorks(state, placeId);
    next = {
      step: st.n, name: st.name, cost: st.cost, seasons: st.seasons,
      needs: placeNeeds(state, placeId).map((n) => ({ text: n.text, ok: n.ok, have: n.have, n: n.n, target: n.target, ...(n.help ? { help: n.help } : {}) })),
      canStart: check.ok, reason: check.reason, ready: placeReady(state, placeId), boonText: st.boon.text, line: st.line,
    };
  }
  const species = [];
  for (const s0 of p.steps) for (const id of s0.species || []) species.push(id);
  for (const s of VALLEY_SPECIES) if (s.placeId === placeId && !species.includes(s.id)) species.push(s.id);
  return {
    id: p.id, name: p.name, short: p.short, icon: p.icon, step, max, stepName: cur.name, vignette: cur.vignette, restored: step >= max, where: p.where,
    works, next,
    boons: p.steps.filter((x) => x.boon).map((x) => ({ step: x.n, text: x.boon.text, kind: x.boon.kind, active: step >= x.n })),
    species: species.map((id) => {
      const s = VALLEY_SPECIES_BY_ID[id];
      return { id, name: s.name, icon: s.icon, state: valleySpeciesState(state, id) };
    }),
    line: cur.line,
    story: p.steps.find((x) => x.story)?.story || null,
  };
}

/** Les six fiches ([] tant que la vue n'est pas ouverte). */
export function placesInfo(state) {
  if (!viewOpen(state)) return [];
  return PLACES.map((p) => placeInfo(state, p.id));
}

/** Où l'on voit un habitant de la vallée (identifiant du lieu). */
export function valleySpeciesSpot(state, id) {
  return VALLEY_SPECIES_BY_ID[id]?.placeId || null;
}

/** Texte « au ruisseau » d'un lieu (null si ce n'est pas un lieu). */
export function placeWhere(placeId) {
  return PLACES_BY_ID[placeId]?.where || null;
}

// ── Pêche au ruisseau, champignons ─────────────────────────────────────────────────────────

/** Poissons du ruisseau selon l'étape : [{ id, name, icon, min, max, weight }] (poids 0 retirés) ; [] à sec. */
export function riverFishTable(state) {
  const step = placeStepOf(state, 'brook');
  if (step < RIVER_RULES.minStep) return [];
  const trout = step >= RIVER_RULES.troutStep;
  return RIVER_FISH.map((f) => ({ id: f.id, name: f.name, icon: f.icon, min: f.min, max: f.max, weight: trout ? f.weight3 : f.weight })).filter((f) => f.weight > 0);
}

/** Pêche au ruisseau : { canFish, fishedToday, step, reason }. */
export function riverInfo(state) {
  const v = valleyOf(state);
  const step = placeStepOf(state, 'brook');
  const fishedToday = !!v?.river && v.river.fishedDay === absDayOf(state);
  let reason = null;
  if (!viewOpen(state)) reason = PLACES_TEXTS.notOpen;
  else if (step < RIVER_RULES.minStep) reason = PLACES_TEXTS.riverDry;
  else if (fishedToday) reason = PLACES_TEXTS.riverDone;
  return { canFish: !reason, fishedToday, step, reason };
}

/** Champignons à cueillir : [{ id, kind, name, icon, spot }]. */
export function mushroomsInfo(state) {
  const v = valleyOf(state);
  if (!placesOn(state) || !Array.isArray(v.mushrooms)) return [];
  return v.mushrooms.map((m) => ({ id: m.id, kind: m.kind, name: MUSHROOMS_BY_ID[m.kind]?.name || m.kind, icon: MUSHROOMS_BY_ID[m.kind]?.icon || null, spot: m.spot }));
}

/** Champignons possibles cette aube ? (automne, bois ≥ 2). */
export function mushroomSeason(state) {
  return placesOn(state) && placeStepOf(state, 'combe') >= MUSHROOM_RULES.minStep && SEASONS[state.time.seasonIndex] === MUSHROOM_RULES.season;
}

export { MUSHROOMS };

/** Arbres du verger conservatoire débloqués : ['cherry'?, 'pear'?]. */
export function treesUnlocked(state) {
  if (!placesOn(state)) return [];
  return VALLEY_TREES.filter((t) => placeStepOf(state, t.unlockedBy.place) >= t.unlockedBy.step).map((t) => t.id);
}

// ── Terres sauvages ────────────────────────────────────────────────────────────────────────

const key = (col, row) => `${col},${row}`;
const NEIGHBOURS = [[0, 1], [0, -1], [-1, 0], [1, 0]];

/** Cases occupées par la ferme (départ + terrains achetés). */
function occupiedCells(state) {
  const m = new Set([key(LOT_GRID.home.col, LOT_GRID.home.row)]);
  for (const l of state.career.lots) if (l.index >= FIRST_LOT_INDEX) m.add(key(l.col, l.row));
  return m;
}

/** Terres sauvages ouvertes ? → { open, reason } (vue ouverte et 16 terrains). */
export function wildOpen(state) {
  if (!placesOn(state)) return { open: false, reason: PLACES_TEXTS.disabled };
  if (!viewOpen(state)) return { open: false, reason: PLACES_TEXTS.notOpen };
  if ((state.career.lotsBought || 0) < WILD_RULES.needLots) return { open: false, reason: PLACES_TEXTS.wildNeedLots };
  return { open: true, reason: null };
}

/** Prix de la prochaine terre sauvage : 2 500 + 300 × (terres déjà confiées). */
export function wildPrice(state) {
  const n = valleyOf(state)?.wildBought || 0;
  return WILD_RULES.price.base + WILD_RULES.price.step * n;
}

/** État d'une terre sauvage au jour `abs` : 0 (en reprise), 1 (jeune, après 1 saison), 2 (reprise, après 3 saisons). */
export function wildStageAt(state, entry, abs = absDayOf(state)) {
  if (!entry) return null;
  const L = state.career.seasonLength;
  const age = abs - entry.at;
  if (age >= WILD_RULES.grownSeasons * L) return 2;
  return age >= WILD_RULES.youngSeasons * L ? 1 : 0;
}

/** État d'une terre sauvage (identifiant de case) : 0 | 1 | 2 ; null si ce n'en est pas une. */
export function wildStage(state, cellId) {
  return wildStageAt(state, valleyOf(state)?.wilds?.[cellId]);
}

/** Terres sauvages : { [cellId]: { cellId, col, row, name, kind, kindName, stage, stageName, seasonsLeft, daysLeft, at } }. */
export function wildCells(state) {
  const v = valleyOf(state);
  if (!placesOn(state) || !v.wilds) return {};
  const L = state.career.seasonLength;
  const abs = absDayOf(state);
  const out = {};
  for (const [cellId, e] of Object.entries(v.wilds)) {
    const stage = wildStageAt(state, e, abs);
    const k = WILD_KINDS_BY_ID[e.kind];
    const daysLeft = stage >= 2 ? 0 : Math.max(0, e.at + WILD_RULES.grownSeasons * L - abs);
    out[cellId] = { cellId, col: e.col, row: e.row, name: lotNameAt(e.col, e.row), kind: e.kind, kindName: k?.name || e.kind, stage, stageName: k?.stages[stage] || '', seasonsLeft: Math.ceil(daysLeft / L), daysLeft, at: e.at };
  }
  return out;
}

/** Terres sauvages reprises (état 2) : signes de vie. */
export function wildSigns(state) {
  if (!placesOn(state)) return 0;
  return Object.values(wildCells(state)).filter((c) => c.stage >= 2).length;
}

/** La case est-elle une terre sauvage ? */
export function isWildCell(state, col, row) {
  const v = valleyOf(state);
  return !!v?.wilds?.[lotIdAt(col, row)];
}

/** Cases de forêt de la grille encore libres (ni terrain, ni ferme, ni terre sauvage) : [{ col, row, cellId }]. */
export function forestCells(state) {
  const occ = occupiedCells(state);
  const v = valleyOf(state);
  const out = [];
  for (let col = LOT_GRID.cols[0]; col <= LOT_GRID.cols[1]; col++) {
    for (let row = LOT_GRID.rows[0]; row <= LOT_GRID.rows[1]; row++) {
      if (!inLotGrid(col, row) || occ.has(key(col, row))) continue;
      const cellId = lotIdAt(col, row);
      if (v?.wilds?.[cellId]) continue;
      out.push({ col, row, cellId });
    }
  }
  return out;
}

/**
 * Forêts qu'on peut confier à la nature : dans la grille, non possédées, pas encore sauvages, qui touchent (par un côté)
 * un terrain, la ferme de départ ou une terre sauvage (de proche en proche). [] tant que ce n'est pas ouvert.
 */
export function wildEligible(state) {
  if (!wildOpen(state).open) return [];
  const occ = occupiedCells(state);
  const v = valleyOf(state);
  for (const e of Object.values(v.wilds || {})) occ.add(key(e.col, e.row));
  return forestCells(state).filter(({ col, row }) => NEIGHBOURS.some(([dc, dr]) => occ.has(key(col + dc, row + dr)))).map((c) => c.cellId);
}

/** Nombre total de terres qu'on pourra confier (forêts de la grille non possédées ; 18 avec les 16 terrains de la grille). */
export function wildTotal(state) {
  const v = valleyOf(state);
  return forestCells(state).length + Object.keys(v?.wilds || {}).length;
}

/** Fiche d'une case (query.career.wildCell). */
export function wildCellInfo(state, cellId) {
  const cell = lotCellOf(cellId);
  if (!cell || !inLotGrid(cell.col, cell.row)) return null;
  const v = valleyOf(state);
  const name = lotNameAt(cell.col, cell.row);
  const base = { cellId, col: cell.col, row: cell.row, name };
  const e = v?.wilds?.[cellId];
  if (e && placesOn(state)) {
    const c = wildCells(state)[cellId];
    const k = WILD_KINDS_BY_ID[e.kind];
    // Visiteurs (décor) : ceux de la sorte, une fois la terre reprise ; un habitant de la vallée seulement s'il est installé.
    const visitors = (k?.visitors || []).map((id) => ({ id, name: ALL_SPECIES_BY_ID[id]?.name || WILD_VISITOR_NAMES[id] || id, seen: c.stage >= 2 && (!VALLEY_SPECIES_BY_ID[id] || speciesInstalled(state, id)) }));
    return { ...base, state: 'wildland', kind: e.kind, kindName: k?.name, stage: c.stage, stageName: c.stageName, seasonsLeft: c.seasonsLeft, daysLeft: c.daysLeft, grown: k?.grown, visitors, price: null, canRewild: false, reason: null };
  }
  if (occupiedCells(state).has(key(cell.col, cell.row))) return { ...base, state: 'owned', visitors: [], canRewild: false, reason: PLACES_TEXTS.wildNotForest };
  const open = wildOpen(state);
  const eligible = wildEligible(state).includes(cellId);
  const price = wildPrice(state);
  let reason = open.reason;
  if (!reason && !eligible) reason = PLACES_TEXTS.wildNotTouching;
  if (!reason && state.money < price) reason = notEnough(price - state.money);
  return { ...base, state: eligible ? 'wildable' : 'forest', visitors: [], price, canRewild: !reason, reason };
}

/** Visiteurs du jour d'une terre reprise (décor, hachage pur du jour) : 1 au plus. */
export function wildVisitorOf(state, cellId) {
  const e = valleyOf(state)?.wilds?.[cellId];
  if (!e || wildStageAt(state, e) < 2) return null;
  const k = WILD_KINDS_BY_ID[e.kind];
  const list = (k?.visitors || []).filter((id) => !VALLEY_SPECIES_BY_ID[id] || speciesInstalled(state, id));
  if (!list.length) return null;
  const h = hashSeed(absDayOf(state), cellId);
  if (h % 100 >= 50) return null;
  return list[h % list.length];
}

// ── Étapes 6 et 7 ──────────────────────────────────────────────────────────────────────────

/** Condition de lieu de l'étape 6 : le Ru des Saules à l'étape 2. */
export function stage6Ok(state) {
  const need = STAGES_V3[0].needs;
  return placeStepOf(state, need.place) >= need.step;
}

/** Condition de lieu de l'étape 7 : les six lieux à l'étape 2 au moins. */
export function stage7Ok(state) {
  const n = STAGES_V3[1].needs.allPlacesStep;
  return PLACES.every((p) => placeStepOf(state, p.id) >= n);
}

/** Texte de la condition de lieu d'une étape (6 ou 7) : « et le Ru des Saules à l'étape 2 ». */
export function stageNeedText(n) {
  if (n === 6) return `et ${lowerFirst(PLACES_BY_ID[STAGES_V3[0].needs.place].name)} à l'étape ${STAGES_V3[0].needs.step}`;
  if (n === 7) return `et les six lieux à l'étape ${STAGES_V3[1].needs.allPlacesStep}`;
  return null;
}

// ── La vue ─────────────────────────────────────────────────────────────────────────────────

/** Dessin de la ferme vue d'en haut (1..4) selon le rang. */
export function farmTier(state) {
  const r = state.career.rank || 1;
  return r >= 6 ? 4 : r >= 5 ? 3 : r >= 3 ? 2 : 1;
}

/** Un récit ou un chapitre du V3 attend d'être lu (Joseph sur le banc du belvédère). */
export function unreadV3(state) {
  const v = valleyOf(state);
  if (!v) return null;
  const story = STORIES_V3.find((s) => v.stories?.available?.includes(s.id) && !v.stories.read.includes(s.id));
  if (story) return { type: 'story', id: story.id };
  const ch = STAGES_V3.find((st) => st.n <= v.stage && !v.chapters?.read?.includes(st.n));
  return ch ? { type: 'chapter', id: ch.n } : null;
}

/** query.career.valleyView() : ce que RENDER dessine (null tant que la vue n'est pas ouverte). */
export function viewInfo(state) {
  if (!viewOpen(state)) return null;
  const v = valleyOf(state);
  const abs = absDayOf(state);
  const season = SEASONS[state.time.seasonIndex];
  const places = PLACES.map((p) => {
    const w = placeWorks(state, p.id);
    const info = w ? placeInfo(state, p.id).works : null;
    return { id: p.id, step: placeStepOf(state, p.id), works: !!w, progress: info ? info.progress : 0 };
  });
  const animals = [];
  for (const s of VALLEY_SPECIES) {
    const e = v.species?.[s.id];
    if (!e) continue;
    if (e.state === 'hint' && e.since === abs) animals.push({ id: s.id, placeId: s.placeId, state: 'hint', hintIcon: s.hintIcon });
    else if (e.state === 'visible') animals.push({ id: s.id, placeId: s.placeId, state: 'visible' });
  }
  let residents = 0;
  for (const s of VALLEY_SPECIES) {
    if (residents >= 4) break;
    if (!speciesInstalled(state, s.id) || !s.seasons.includes(season)) continue;
    if (hashSeed(abs, s.id) % 100 >= 60) continue;
    residents += 1;
    animals.push({ id: s.id, placeId: s.placeId, state: 'resident' });
  }
  const helene = !!v.stories?.available?.includes('helene') && hashSeed(abs, 'helene') % 3 === 0;
  return {
    open: true, season, stage: v.stage, farmTier: farmTier(state), places, animals, mushrooms: mushroomsInfo(state).map((m) => ({ id: m.id, kind: m.kind, spot: m.spot })),
    river: { canFish: riverInfo(state).canFish, step: placeStepOf(state, 'brook') }, joseph: !!unreadV3(state), helene,
    steps: placesSigns(state), stepsTotal: PLACE_STEPS_TOTAL,
  };
}

export { PLACES, PLACES_BY_ID, PLACES_OPEN, WILD_KINDS, WILD_RULES, VALLEY_SPECIES };
