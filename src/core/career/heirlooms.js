// La Vallée vivante (lot V1) — lectures pures des variétés anciennes, des traits et des services, sans enregistrement
// d'extension. Lues par src/core/farm.js, src/core/surprises.js, src/core/cozy.js, src/core/career/{runtime,crew,work,
// machines,events,animals,handwork}.js. Règles : docs/VALLEE.md § 3 et § 4 ; contrat : docs/ARCHITECTURE.md, « Vallée
// vivante — contrats du lot V1 ». Aucun tirage, aucun DOM.
//
// Tout est gardé par state.career?.valley (une partie de niveau n'a pas state.career : chaque fonction renvoie la valeur
// neutre — 1, 0, null, false).
//
// (V2, « Le troc et les croisements ») Variétés lues sur ALL_VARIETIES_BY_ID (35) ; traits en LISTE (une croisée en a
// deux) : chaque règle de trait passe par hasTrait. Effets de la Grainothèque (graines par récolte, fixation, prix des
// graines sauvées, touristes) et services des habitants du V2 (merle, lézard, pipistrelle) : lus ici, gardés par
// `parts.heritage` (absent = vrai). Contrat : docs/ARCHITECTURE.md, « Vallée vivante — contrats du lot V2 ».
//
// (V3, « Le ruisseau ») Les avantages des lieux de la vallée (canicule, l'eau revient, places du moulin, chauffage,
// entretien des animaux, ruches de la prairie, jachère, poissons, touristes, abris, corbeaux, cueillette des haies,
// trouvailles d'hiver) sont lus ICI (une seule porte d'entrée pour les modules partagés, comme au V2), gardés par
// `parts.places` (absente = vraie) et `parts.heritage` ; src/core/career/places.js les ré-exporte. Habitants de la vallée
// (group 'valley') et Reinette grise (group 'orchard') : seulement avec la partie `places`.

import { SEASONS } from '../../data/balance.js';
import { ALL_SPECIES_BY_ID, ALL_VARIETIES_BY_ID, FALLOW, SEED_RULES, SPECIES_BY_ID, STAGE_FINE, TRAITS_BY_ID, varietyTraits } from '../../data/career/valley.js';
import { CROSS_RULES, SEED_LIBRARY, crossName } from '../../data/career/heritage.js';
import { PLACES, WATER_BACK } from '../../data/career/places.js';

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

/** Variété ancienne semée sur une parcelle (null sinon ; les 35 variétés du V1 et du V2). */
export function varietyOf(plot) {
  return (plot && plot.variety && ALL_VARIETIES_BY_ID[plot.variety]) || null;
}

/** Nom affiché d'une variété (identifiant ou définition) : une croisée porte le nom actuel de la ferme. */
export function varietyName(state, x) {
  const v = typeof x === 'string' ? ALL_VARIETIES_BY_ID[x] : x;
  if (!v) return '';
  return v.group === 'cross' ? crossName(v, state?.career?.farmName) : v.name;
}

/** Traits de la variété d'une parcelle ([] sinon) : définitions de TRAITS (une croisée en a deux). */
export function traitsOf(plot) {
  const v = varietyOf(plot);
  return v ? varietyTraits(v).map((id) => TRAITS_BY_ID[id]).filter(Boolean) : [];
}

/** Premier trait de la variété d'une parcelle (null sinon) — gardé pour le V1 (= traitsOf(plot)[0]). */
export function traitOf(plot) {
  return traitsOf(plot)[0] || null;
}

/** La variété de la parcelle a-t-elle ce trait ? (false sans la Vallée.) */
export function hasTrait(state, plot, id) {
  if (!valleyOf(state)) return false;
  const v = varietyOf(plot);
  return !!v && varietyTraits(v).includes(id);
}

const traitIs = hasTrait;

/** La variété est-elle fixée (sauvée) ? */
export function isFixed(state, varietyId) {
  const v = valleyOf(state);
  return !!v && !!v.varieties?.[varietyId]?.fixedAt;
}

/**
 * Planche d'essai perdue sans récolte (gel, pourriture, arbre arraché, terrain réaménagé) : sa graine (ou son greffon)
 * revient dans la boîte — « rien ne se perd » (docs/VALLEE.md, règles d'or). À appeler AVANT clearPlot. Variété fixée :
 * rien (ses graines s'achètent). → true si une graine est revenue.
 */
export function returnTrialSeed(state, plot) {
  const v = valleyOf(state);
  const x = varietyOf(plot);
  if (!v || !v.started || !x || !plot.cropId || v.varieties?.[x.id]?.fixedAt) return false;
  v.seeds[x.id] = (v.seeds[x.id] || 0) + 1;
  return true;
}

/** Planche d'essai : parcelle semée d'une variété pas encore fixée. */
export function isTrial(state, plot) {
  const v = varietyOf(plot);
  return !!v && !!valleyOf(state) && !isFixed(state, v.id);
}

/** Habitant installé (observé) ? (Habitants du V2 : seulement avec la partie `heritage` ; de la vallée : `places`.) */
export function speciesInstalled(state, id) {
  const v = valleyOf(state);
  if (!v || v.parts?.wildlife === false || v.species?.[id]?.state !== 'installed') return false;
  return speciesInPart(state, ALL_SPECIES_BY_ID[id]);
}

/** L'habitant existe-t-il dans cette partie ? (V1 toujours ; V2 : `heritage` ; vallée : `places`.) */
export function speciesInPart(state, s) {
  if (!s) return false;
  const g = s.group || 'v1';
  if (g === 'v1') return true;
  if (!heritagePartOn(state)) return false;
  return g !== 'valley' || placesOn(state);
}

/** La variété existe-t-elle dans cette partie ? (Du pays toujours ; V2 : `heritage` ; du verger de la commune : `places`.) */
export function varietyInPart(state, x) {
  if (!x) return false;
  const g = x.group || 'pays';
  if (g === 'pays') return true;
  if (!heritagePartOn(state)) return false;
  return g !== 'orchard' || placesOn(state);
}

// ── (V2) La Grainothèque et ses effets ─────────────────────────────────────────────────────

/** Le V2 est-il actif (partie `heritage`, absente = vraie) ? */
export function heritagePartOn(state) {
  const v = valleyOf(state);
  return !!v && v.parts?.heritage !== false;
}

/** Niveau de la Grainothèque (0 : pas construite, ou V2 désactivé). */
export function libraryLevelOf(state) {
  const v = valleyOf(state);
  if (!v || v.parts?.heritage === false || !v.library) return 0;
  return v.library.level || 0;
}

/**
 * Effets cumulés de la Grainothèque : { level, circle, handSeeds, fixHand, crossNeed, fixedSeedFactor, touristBonus }.
 * Sans Grainothèque : les règles du V1 (2 graines, 7 récoltes, 3 rencontres, × 1,25, 0).
 */
export function libraryEffectsOf(state) {
  const level = libraryLevelOf(state);
  const out = { level, circle: 0, handSeeds: SEED_RULES.handSeeds, fixHand: SEED_RULES.fixHand, crossNeed: CROSS_RULES.need, fixedSeedFactor: SEED_RULES.fixedSeedFactor, touristBonus: 0 };
  for (const L of SEED_LIBRARY.levels) {
    if (L.level > level) break;
    if (L.circle !== undefined) out.circle = L.circle;
    if (L.handSeeds !== undefined) out.handSeeds = L.handSeeds;
    if (L.fixHand !== undefined) out.fixHand = L.fixHand;
    if (L.crossNeed !== undefined) out.crossNeed = L.crossNeed;
    if (L.fixedSeedFactor !== undefined) out.fixedSeedFactor = L.fixedSeedFactor;
    if (L.touristBonus !== undefined) out.touristBonus = L.touristBonus;
  }
  return out;
}

/** Graines rendues par une récolte à la main d'une planche d'essai (2 ; 3 au niveau 2 ; un greffon : 1). */
export function handSeedsOf(state, tree = false) {
  return tree ? SEED_RULES.graftPerBasket : libraryEffectsOf(state).handSeeds;
}

/** Récoltes à la main pour sauver une variété (7 ; 5 au niveau 3). */
export function fixHandOf(state) {
  return libraryEffectsOf(state).fixHand;
}

/** Rencontres pour un croisement (3 ; 2 au niveau 4). */
export function crossNeedOf(state) {
  return libraryEffectsOf(state).crossNeed;
}

/** Facteur d'une rencontre (osmie installée : × 2). */
export function crossFactorOf(state) {
  return speciesInstalled(state, 'wildBee') ? ALL_SPECIES_BY_ID.wildBee.service.value : 1;
}

/** Parfumée : le rendement de la place d'atelier d'une récolte de cette variété × 1,15 (1 sinon). */
export function scentedFactorOf(state, plot) {
  return hasTrait(state, plot, 'scented') ? 1 + TRAITS_BY_ID.scented.product : 1;
}

/** Plafond de la cueillette des haies (merle noir installé : 4 au lieu de `base`). */
export function hedgeFindsMaxOf(state, base) {
  return speciesInstalled(state, 'blackbird') ? Math.max(base, ALL_SPECIES_BY_ID.blackbird.service.value) : base;
}

/** L'été, l'équipe n'est jamais lasse (pipistrelle installée). */
export function staffNeverTiredOf(state) {
  if (!speciesInstalled(state, 'bat')) return false;
  return ALL_SPECIES_BY_ID.bat.service.seasons.includes(SEASONS[state.time.seasonIndex]);
}

/** Étape de la vallée (0 sans la Vallée). */
export function stageOf(state) {
  return valleyOf(state)?.stage || 0;
}

/**
 * Multiplicateur de pousse d'une parcelle : précoce (× 1,15), sol reposé après une jachère (× 1,10 ; étape 4 : × 1,20 ;
 * (V3) prairie aux orchidées : × 1,30).
 */
export function growthFactorOf(state, plot) {
  if (!valleyOf(state)) return 1;
  let f = 1;
  if (hasTrait(state, plot, 'early')) f *= 1 + TRAITS_BY_ID.early.growth;
  if (plot.rested) f *= 1 + fallowGrowthOf(state, stageOf(state) >= 4 ? FALLOW.growthStage4 : FALLOW.growth);
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
  if (hasTrait(state, plot, 'fine')) {
    const t = TRAITS_BY_ID.fine;
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
  if (!first || !varietyTraits(first).includes('giant')) return 1;
  return plotsList.every((p) => p.variety === first.id) ? TRAITS_BY_ID.giant.giant : 1;
}

/** Prix de vente : savoureuse × 1,10 (la rustique vendue l'hiver a déjà le cours « hors saison » × 1,25). */
export function priceFactorOf(state, plot) {
  return hasTrait(state, plot, 'tasty') ? 1 + TRAITS_BY_ID.tasty.price : 1;
}

/**
 * Prix d'une graine (ou d'un greffon) d'une variété fixée, à partir du prix de la culture du jour : × 1,25 (Grainothèque
 * niveau 5 : × 1, le prix normal). Sans `state` : la règle du V1.
 */
export function fixedSeedCost(baseCost, state = null) {
  const f = state ? libraryEffectsOf(state).fixedSeedFactor : SEED_RULES.fixedSeedFactor;
  return Math.max(1, Math.round(baseCost * f));
}

/** L'équipe et le semoir peuvent-ils semer cette variété ? Seulement une fois fixée. */
export function canHelpersSow(state, varietyId) {
  return partOn(state, 'seeds') && isFixed(state, varietyId);
}

/** Valeur de plan 'heirloom:<id>' → id de variété connu (null sinon). */
export function planVariety(value) {
  if (typeof value !== 'string' || !value.startsWith('heirloom:')) return null;
  const id = value.slice('heirloom:'.length);
  return ALL_VARIETIES_BY_ID[id] ? id : null;
}

// ── Services des habitants (lus par les modules partagés) ──────────────────────────────────

/** Trouvailles d'hiver à la fois (rouge-gorge : 4 au lieu de `base` ; (V3) vieille futaie : + 1). */
export function winterFindsMax(state, base) {
  return (speciesInstalled(state, 'robin') ? Math.max(base, SPECIES_BY_ID.robin.service.value) : base) + winterFindsPlusOf(state);
}

/** Pièces des trouvailles d'hiver (écureuil : × 2). */
export function winterCoinsFactor(state) {
  return speciesInstalled(state, 'squirrel') ? SPECIES_BY_ID.squirrel.service.value : 1;
}

/** Poids des corbeaux (chouette hulotte : × 0,5 ; (V3) bocage : × 0,5, puis vieux têtards : 0). */
export function crowWeightFactor(state) {
  return (speciesInstalled(state, 'tawnyOwl') ? SPECIES_BY_ID.tawnyOwl.service.value : 1) * crowsPlacesFactorOf(state);
}

/** Valeur des poissons (libellules : × 1,25 ; (V3) étang du moulin : × 1,15). */
export function fishFactor(state) {
  return (speciesInstalled(state, 'dragonfly') ? SPECIES_BY_ID.dragonfly.service.value : 1) * pondFishFactorOf(state);
}

/** Touristes : bonus par passage (paon-du-jour : 0,15 ; Grainothèque niveau 5 : + 0,15 ; (V3) nénuphars : + 0,10). */
export function touristBonusOf(state) {
  return (speciesInstalled(state, 'butterfly') ? SPECIES_BY_ID.butterfly.service.value : 0) + libraryEffectsOf(state).touristBonus + placesTouristBonusOf(state);
}

/** Production des abris (hirondelles : + 5 % au printemps et en été ; (V3) roselière : + 5 % de plus, mêmes saisons). */
export function animalBonusOf(state) {
  const s = SPECIES_BY_ID.swallow.service;
  if (!s.seasons.includes(SEASONS[state.time.seasonIndex])) return 0;
  return (speciesInstalled(state, 'swallow') ? s.value : 0) + placesAnimalBonusOf(state);
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
  // (V2) Lézard des murailles : + 0,10 les jours de canicule.
  if (speciesInstalled(state, 'lizard') && state.weather?.today === 'heatwave') g += ALL_SPECIES_BY_ID.lizard.service.value;
  return g;
}

// ── (V3) Les lieux de la vallée et leurs avantages ─────────────────────────────────────────

/** Le V3 est-il actif (parties `places` et `heritage`, absentes = vraies) ? */
export function placesOn(state) {
  const v = valleyOf(state);
  return !!v && v.parts?.heritage !== false && v.parts?.places !== false;
}

/** Étape atteinte d'un lieu (0 : pas commencé, ou V3 désactivé). */
export function placeStepOf(state, placeId) {
  if (!placesOn(state)) return 0;
  return valleyOf(state).places?.[placeId]?.step || 0;
}

/** Avantage → { placeId, step, value } (tiré des données : une étape = un avantage). */
const BOONS = {};
for (const p of PLACES) for (const st of p.steps) if (st.boon) BOONS[st.boon.kind] = { placeId: p.id, step: st.n, value: st.boon.value };

/** Valeur d'un avantage de lieu s'il est atteint, 0 sinon (lu par les modules partagés). */
export function placeBoonActive(state, kind) {
  const b = BOONS[kind];
  return b && placeStepOf(state, b.placeId) >= b.step ? b.value : 0;
}

/**
 * Canicule (Ru des Saules ≥ 1) : pousse d'une parcelle non arrosée un jour de canicule = `base` + 0,25 (Détente : ½ jour au
 * lieu de ¼ ; Classique : ¼ au lieu de 0), au plus 1 ; null sans l'avantage.
 */
export function heatDryGrowthOf(state, base = 0) {
  const add = placeBoonActive(state, 'heatGrowth');
  return add ? Math.min(1, base + add) : null;
}

/** « L'eau revient » (étape 6 de la vallée) : + 0,1 jour de pousse un jour sans arrosage (0 sinon). */
export function waterBackOf(state) {
  return placesOn(state) && stageOf(state) >= 6 ? WATER_BACK.dryGrowth : 0;
}

/**
 * Pousse d'un jour sans arrosage avec les avantages de la vallée (V3) : canicule (Ru 1) ou l'eau revient (étape 6) ; `base`
 * est la pousse ordinaire (culture, niveau, variété sobre). Au plus une journée arrosée (1). Sans le V3 : `base`.
 */
export function valleyDryGrowth(state, base, heat) {
  if (!placesOn(state)) return base;
  if (heat) {
    const h = heatDryGrowthOf(state, base);
    return h === null ? base : Math.max(base, h);
  }
  const w = waterBackOf(state);
  return w ? Math.min(1, base + w) : base;
}

/** Moulin à eau (Ru des Saules ≥ 4) : + 1 place au moulin de la ferme (fournisseur extraPlaces). */
export function millPlacesOf(state, buildingId) {
  return buildingId === 'mill' ? placeBoonActive(state, 'millPlace') : 0;
}

/** Bois mort (bois de la Combe ≥ 1) : chauffage de la serre × 0,5 (1 sinon). */
export function heatingFactorOf(state) {
  return placeBoonActive(state, 'heating') || 1;
}

/** Foin (prairie ≥ 1) : entretien des animaux × 0,9 (1 sinon). */
export function upkeepFactorOf(state) {
  return placeBoonActive(state, 'hay') || 1;
}

/** Prairie fleurie (≥ 2) : + 1 pièce par ruche et par jour hors hiver (0 sinon). */
export function meadowHivesOf(state) {
  return placeBoonActive(state, 'meadowHives');
}

/** Sol vivant de la prairie aux orchidées (≥ 3) : + 0,3 après une jachère (sinon `base`). */
export function fallowGrowthOf(state, base) {
  const o = placeBoonActive(state, 'orchidSoil');
  return o ? Math.max(base, o) : base;
}

/** Étang du moulin (≥ 1) : poissons × 1,15 (1 sinon). */
export function pondFishFactorOf(state) {
  return placeBoonActive(state, 'pondFish') || 1;
}

/** Nénuphars (étang ≥ 2) : touristes + 0,10 (0 sinon). */
export function placesTouristBonusOf(state) {
  return placeBoonActive(state, 'pondTourists');
}

/** Roselière (étang ≥ 3) : abris + 0,05 au printemps et en été (0 sinon). */
export function placesAnimalBonusOf(state) {
  const b = placeBoonActive(state, 'reedSwallows');
  return b && ['spring', 'summer'].includes(SEASONS[state.time.seasonIndex]) ? b : 0;
}

/** Corbeaux (bocage ≥ 2 : × 0,5 ; vieux têtards ≥ 3 : 0, plus aucun) ; 1 sinon. */
export function crowsPlacesFactorOf(state) {
  if (placeBoonActive(state, 'noCrows')) return 0;
  return placeBoonActive(state, 'crowsHalf') || 1;
}

/** Cueillette des haies : pièces × 1,5 (bocage ≥ 1), × 2 (≥ 3) ; 1 sinon. */
export function hedgeCoinsFactorOf(state) {
  return placeBoonActive(state, 'noCrows') || placeBoonActive(state, 'hedgeCoins') || 1;
}

/** Vieille futaie (bois ≥ 3) : une trouvaille d'hiver de plus à la fois (0 sinon). */
export function winterFindsPlusOf(state) {
  return placeBoonActive(state, 'winterFindsPlus');
}

// ── (V4) Les cigognes ──────────────────────────────────────────────────────────────────────

/**
 * Le V4 est-il actif (partie `storks`, absente = vraie ; il n'existe pas sans `places` ni `heritage`) ? Lecture unique,
 * ré-exportée par src/core/career/storks.js (ici pour que heritage.js et habitat.js la lisent sans import circulaire).
 */
export function storksOn(state) {
  const v = valleyOf(state);
  return !!v && v.parts?.heritage !== false && v.parts?.places !== false && v.parts?.storks !== false;
}
