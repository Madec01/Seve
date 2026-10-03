// La Vallée vivante (lot V1) — lectures pures des variétés anciennes, des traits et des services, sans enregistrement
// d'extension. Lues par src/core/farm.js, src/core/surprises.js, src/core/cozy.js, src/core/career/{runtime,crew,work,
// machines,events,animals,handwork}.js. Règles : docs/VALLEE.md § 3 et § 4 ; contrat : docs/ARCHITECTURE.md, « Vallée
// vivante — contrats du lot V1 ». Aucun tirage, aucun DOM.
//
// Tout est gardé par state.career?.valley (une partie de niveau n'a pas state.career : chaque fonction renvoie la valeur
// neutre — 1, 0, null, false).

import { SEASONS } from '../../data/balance.js';
import { FALLOW, SEED_RULES, SPECIES_BY_ID, STAGE_FINE, TRAITS_BY_ID, VARIETIES_BY_ID } from '../../data/career/valley.js';

/** La Vallée de la partie (null : niveau, ou carrière sans la Vallée). */
export function valleyOf(state) {
  return state?.mode === 'career' ? state.career?.valley || null : null;
}

/** La Vallée est-elle commencée (boîte de Joseph reçue) ? */
export function valleyStarted(state) {
  return !!valleyOf(state)?.started;
}

/** Partie de la Vallée active (seeds | wildlife). */
export function partOn(state, part) {
  const v = valleyOf(state);
  return !!v && v.parts?.[part] !== false;
}

/** Saison absolue (0 = printemps de l'an 1). */
export function seasonAbs(state) {
  return (state.time.year - 1) * 4 + state.time.seasonIndex;
}

/** Saison absolue d'un jour absolu (carrière). */
export function seasonAbsOfDay(state, abs) {
  return Math.floor((abs - 1) / state.career.seasonLength);
}

/** Variété ancienne semée sur une parcelle (null sinon). */
export function varietyOf(plot) {
  return (plot && plot.variety && VARIETIES_BY_ID[plot.variety]) || null;
}

/** Trait de la variété d'une parcelle (null sinon). */
export function traitOf(plot) {
  const v = varietyOf(plot);
  return v ? TRAITS_BY_ID[v.trait] : null;
}

function traitIs(state, plot, id) {
  if (!valleyOf(state)) return false;
  return traitOf(plot)?.id === id;
}

/** La variété est-elle fixée (sauvée) ? */
export function isFixed(state, varietyId) {
  const v = valleyOf(state);
  return !!v && !!v.varieties?.[varietyId]?.fixedAt;
}

/** Planche d'essai : parcelle semée d'une variété pas encore fixée. */
export function isTrial(state, plot) {
  const v = varietyOf(plot);
  return !!v && !!valleyOf(state) && !isFixed(state, v.id);
}

/** Habitant installé (observé) ? */
export function speciesInstalled(state, id) {
  const v = valleyOf(state);
  return !!v && v.parts?.wildlife !== false && v.species?.[id]?.state === 'installed';
}

/** Étape de la vallée (0 sans la Vallée). */
export function stageOf(state) {
  return valleyOf(state)?.stage || 0;
}

/** Multiplicateur de pousse d'une parcelle : précoce (× 1,15), sol reposé après une jachère (× 1,10 ; étape 4 : × 1,20). */
export function growthFactorOf(state, plot) {
  if (!valleyOf(state)) return 1;
  let f = 1;
  const t = traitOf(plot);
  if (t?.id === 'early') f *= 1 + t.growth;
  if (plot.rested) f *= 1 + (stageOf(state) >= 4 ? FALLOW.growthStage4 : FALLOW.growth);
  return f;
}

/** Pousse d'un jour sans arrosage d'une variété sobre (1 ; canicule 0,75) ; null : règle ordinaire. */
export function dryGrowthOf(state, plot, crop, heat) {
  if (!traitIs(state, plot, 'dry')) return null;
  const t = TRAITS_BY_ID.dry;
  return heat ? t.heat : t.dry;
}

/** Variété rustique hors serre : passe le gel du 1er jour d'hiver. */
export function survivesFrost(state, plot) {
  return traitIs(state, plot, 'hardy') && plot.env !== 'greenhouse';
}

/** Pousse en hiver (hors serre) d'une variété rustique : × 0,5 ; 1 sinon. */
export function winterGrowthOf(state, plot) {
  return survivesFrost(state, plot) ? TRAITS_BY_ID.hardy.winterGrowth : 1;
}

/**
 * Bonus de qualité de la Vallée pour une récolte : généreuse (+ 4 points belle ; à la main + 1 point dorée), hérisson
 * (à la main + 1 point), coccinelles et étape 3 « pollinisation » (toutes les récoltes, + 1 point chacune).
 * → { fine, gold } (0 sans la Vallée).
 */
export function qualityBonusOf(state, plot, byHand) {
  const out = { fine: 0, gold: 0 };
  if (!valleyOf(state)) return out;
  const t = traitOf(plot);
  if (t?.id === 'fine') {
    out.fine += t.fine;
    if (byHand) out.gold += t.gold;
  }
  if (byHand && speciesInstalled(state, 'hedgehog')) out.fine += SPECIES_BY_ID.hedgehog.service.value;
  if (speciesInstalled(state, 'ladybird')) out.fine += SPECIES_BY_ID.ladybird.service.value;
  if (stageOf(state) >= 3) out.fine += STAGE_FINE;
  return out;
}

/** Chance de géant en plus (lièvre : + 1,5 point). */
export function giantBonusOf(state) {
  return speciesInstalled(state, 'hare') ? SPECIES_BY_ID.hare.service.value : 0;
}

/** × 2 si les 4 parcelles d'un carré sont d'une même variété géante ; 1 sinon. */
export function giantFactorOf(state, plotsList) {
  if (!valleyOf(state) || !plotsList.length) return 1;
  const first = varietyOf(plotsList[0]);
  if (!first || TRAITS_BY_ID[first.trait]?.id !== 'giant') return 1;
  return plotsList.every((p) => p.variety === first.id) ? TRAITS_BY_ID.giant.giant : 1;
}

/** Prix de vente : savoureuse × 1,10 (la rustique vendue l'hiver a déjà le cours « hors saison » × 1,25). */
export function priceFactorOf(state, plot) {
  const t = valleyOf(state) ? traitOf(plot) : null;
  return t?.id === 'tasty' ? 1 + t.price : 1;
}

/** Prix d'une graine (ou d'un greffon) d'une variété fixée, à partir du prix de la culture du jour. */
export function fixedSeedCost(baseCost) {
  return Math.max(1, Math.round(baseCost * SEED_RULES.fixedSeedFactor));
}

/** L'équipe et le semoir peuvent-ils semer cette variété ? Seulement une fois fixée. */
export function canHelpersSow(state, varietyId) {
  return partOn(state, 'seeds') && isFixed(state, varietyId);
}

/** Valeur de plan 'heirloom:<id>' → id de variété connu (null sinon). */
export function planVariety(value) {
  if (typeof value !== 'string' || !value.startsWith('heirloom:')) return null;
  const id = value.slice('heirloom:'.length);
  return VARIETIES_BY_ID[id] ? id : null;
}

// ── Services des habitants (lus par les modules partagés) ──────────────────────────────────

/** Trouvailles d'hiver à la fois (rouge-gorge : 4 au lieu de `base`). */
export function winterFindsMax(state, base) {
  return speciesInstalled(state, 'robin') ? Math.max(base, SPECIES_BY_ID.robin.service.value) : base;
}

/** Pièces des trouvailles d'hiver (écureuil : × 2). */
export function winterCoinsFactor(state) {
  return speciesInstalled(state, 'squirrel') ? SPECIES_BY_ID.squirrel.service.value : 1;
}

/** Poids des corbeaux (chouette hulotte : × 0,5). */
export function crowWeightFactor(state) {
  return speciesInstalled(state, 'tawnyOwl') ? SPECIES_BY_ID.tawnyOwl.service.value : 1;
}

/** Valeur des poissons (libellules : × 1,25). */
export function fishFactor(state) {
  return speciesInstalled(state, 'dragonfly') ? SPECIES_BY_ID.dragonfly.service.value : 1;
}

/** Touristes : bonus par passage (paon-du-jour : 0,15). */
export function touristBonusOf(state) {
  return speciesInstalled(state, 'butterfly') ? SPECIES_BY_ID.butterfly.service.value : 0;
}

/** Production des abris (hirondelles : + 5 % au printemps et en été). */
export function animalBonusOf(state) {
  if (!speciesInstalled(state, 'swallow')) return 0;
  const s = SPECIES_BY_ID.swallow.service;
  return s.seasons.includes(SEASONS[state.time.seasonIndex]) ? s.value : 0;
}

/**
 * Bonus de pousse des habitants (fournisseur effects 'growthBonus', lu pendant la pousse de l'aube : saison et météo
 * sont encore celles de la veille) : bourdons + 0,03 hors hiver ; grenouilles + 0,10 les jours de pluie ou d'orage.
 */
export function growthBonusOf(state) {
  if (!valleyOf(state)) return 0;
  let g = 0;
  const season = SEASONS[state.time.seasonIndex];
  if (speciesInstalled(state, 'bumblebee') && SPECIES_BY_ID.bumblebee.service.seasons.includes(season)) g += SPECIES_BY_ID.bumblebee.service.value;
  if (speciesInstalled(state, 'frog') && ['rain', 'storm'].includes(state.weather?.today)) g += SPECIES_BY_ID.frog.service.value;
  return g;
}
