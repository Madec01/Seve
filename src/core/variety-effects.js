// Lot 3 « Variété » — lecture des effets en cours (cartes, objets du colporteur, thème de l'année). Pur, SANS
// dépendance vers le reste du cœur (seulement des données) : farm.js, economy.js, trees.js, surprises.js,
// processing.js et les modules de carrière le lisent sans créer de cycle d'imports.
//
// Tout est gardé par state.variety (absent en Classique : chaque fonction rend alors sa valeur neutre, la parité
// des niveaux 1 à 8 est intacte) et par state.variety.parts.<partie>.

import { SEASONS } from '../data/balance.js';
import { CARD_VALUES, MERCHANT_ITEMS_BY_ID } from '../data/variety.js';
import { MILL_PRODUCTS, THEME_RULES, THEMES_BY_ID } from '../data/career/themes.js';

/** Jour absolu : jour de l'année (niveaux), jour depuis le début de la carrière (carrière). */
export function vAbsDay(state) {
  if (state.mode === 'career') return (state.time.year - 1) * 4 * state.career.seasonLength + state.time.day;
  return state.time.day;
}

/** Saison absolue : (année − 1) × 4 + saison (niveaux : l'index de la saison). */
export function vSeasonAbs(state) {
  if (state.mode === 'career') return (state.time.year - 1) * 4 + state.time.seasonIndex;
  return state.time.seasonIndex;
}

/** true si la variété (ou une de ses parties) est active. */
export function varietyOn(state, part = null) {
  const v = state && state.variety;
  if (!v) return false;
  return part ? !!v.parts?.[part] : true;
}

/** true si une carte « saison » (ou l'almanach) fait effet maintenant. */
export function cardActive(state, id) {
  const v = state && state.variety;
  if (!v || !v.parts?.cards || !v.cards) return false;
  const today = vAbsDay(state);
  const season = vSeasonAbs(state);
  for (const c of v.cards.active) {
    if (c.id !== id) continue;
    if (c.season !== null && c.season !== season) continue;
    if (today <= c.until) return true;
  }
  return false;
}

/** Facteur du prix des graines : « Foire aux graines » les 3 premiers jours de la saison. */
export function seedFairFactor(state) {
  if (!cardActive(state, 'seedFair')) return 1;
  return state.time.dayOfSeason <= CARD_VALUES.seedFair.days ? CARD_VALUES.seedFair.factor : 1;
}

/** Bonus de pousse en plus (« Sac d'engrais ») : cultures et arbres, toute la saison (hiver compris). */
export function varietyGrowthBonus(state) {
  return cardActive(state, 'fertilizer') ? CARD_VALUES.fertilizer.growth : 0;
}

/** Facteur du prix des récoltes brutes (« Une affiche au marché »). */
export function posterFactor(state) {
  return cardActive(state, 'poster') ? CARD_VALUES.poster.factor : 1;
}

/** Facteur du prix des produits transformés (« La recette de saison »). */
export function recipeFactor(state) {
  return cardActive(state, 'recipe') ? CARD_VALUES.recipe.factor : 1;
}

/** Facteur des revenus quotidiens des animaux (« Du foin parfumé »), pas la tonte. */
export function hayFactor(state) {
  return cardActive(state, 'hay') ? CARD_VALUES.hay.factor : 1;
}

/** Facteur des chances de qualité (« Trèfle à quatre feuilles »). */
export function cloverFactor(state) {
  return cardActive(state, 'clover') ? CARD_VALUES.clover.factor : 1;
}

/** Fer à cheval du colporteur : { fine, gold } en plus (points de chance), ou null. */
export function horseshoeBonus(state) {
  if (!state?.variety?.owned?.horseshoe) return null;
  const item = MERCHANT_ITEMS_BY_ID.horseshoe;
  return { fine: item.fine, gold: item.gold };
}

/** Almanach (carte ou objet du colporteur) : météo d'après-demain affichée. */
export function hasVarietyAlmanac(state) {
  if (!state?.variety) return false;
  return !!state.variety.owned?.almanac || cardActive(state, 'almanac');
}

// ── Thème de l'année (carrière) ───────────────────────────────────────────────────────────────

/** Thème en cours (données de THEMES) ou null (niveaux, 1re année, variété ou thèmes désactivés). */
export function currentTheme(state) {
  if (!state || state.mode !== 'career' || !state.variety?.parts?.themes) return null;
  const t = state.career?.theme;
  if (!t || !t.id || t.year !== state.time.year) return null;
  return THEMES_BY_ID[t.id] || null;
}

/** true si le thème en cours est `id`. */
export function themeIs(state, id) {
  return currentTheme(state)?.id === id;
}

/** Fête du thème aujourd'hui (données du thème) ou null. */
export function themeFestivalToday(state) {
  const th = currentTheme(state);
  if (!th) return null;
  const f = th.festival;
  return f.seasonId === SEASONS[state.time.seasonIndex] && f.day === state.time.dayOfSeason ? th : null;
}

/** true si la vedette du thème est cette culture. */
export function isStarCrop(state, cropId) {
  const th = currentTheme(state);
  return !!th && th.star.kind === 'crop' && th.star.ids.includes(cropId);
}

/**
 * Facteur de prix du thème (fournisseur priceFactor de la carrière) : vedette, effets de l'année, fête du jour.
 * @param {{ kind: 'crop'|'product'|'stock', id }} sale
 */
export function themePriceFactor(state, { kind, id }) {
  const th = currentTheme(state);
  if (!th) return 1;
  const v = th.values;
  let f = 1;
  const crop = kind === 'crop' || kind === 'stock';
  if (crop && th.star.kind === 'crop' && th.star.ids.includes(id)) f *= THEME_RULES.starFactor;
  if (kind === 'product' && th.star.kind === 'product' && th.star.ids.includes(id)) f *= THEME_RULES.starFactor;
  if (th.id === 'bread' && kind === 'product' && MILL_PRODUCTS.includes(id)) f *= v.millProducts;
  if (th.id === 'lights' && kind === 'product' && SEASONS[state.time.seasonIndex] === 'winter') f *= v.winterProducts;
  const fest = themeFestivalToday(state);
  if (fest) {
    switch (th.id) {
      case 'bees':
      case 'frogs':
        if (kind === 'crop') f *= v.festivalCrops;
        break;
      case 'cheese':
        if (kind === 'product') f *= v.festivalProducts;
        break;
      case 'giants':
        if (crop && id === 'pumpkin') f *= v.festivalCrop;
        break;
      case 'orchard':
        if ((crop && id === 'apple') || (kind === 'product' && id === 'appleJuice')) f *= v.festivalFruit;
        break;
      case 'bread':
        if (crop && id === 'wheat') f *= v.festivalWheat;
        if (kind === 'product' && MILL_PRODUCTS.includes(id)) f *= v.festivalMill;
        break;
      case 'markets':
        f *= v.festivalSales;
        break;
      case 'lights':
        if (kind === 'product') f *= v.festivalProducts;
        break;
      default:
        break;
    }
  }
  return f;
}

/** Facteur du prix des graines du thème (géants : citrouille −20 % ; pain : blé −20 %). */
export function themeSeedFactor(state, cropId) {
  const th = currentTheme(state);
  if (!th || !th.values.seedCrop || th.values.seedCrop !== cropId) return 1;
  return th.values.seedFactor;
}

/** Chance des légumes géants × 2 (année des géants). */
export function themeGiantFactor(state) {
  return themeIs(state, 'giants') ? THEMES_BY_ID.giants.values.giantChance : 1;
}

/** Heure dorée 2 fois plus rare (année des grenouilles : la contrepartie). */
export function themeGoldenHourFactor(state) {
  return themeIs(state, 'frogs') ? THEMES_BY_ID.frogs.values.goldenHour : 1;
}

/** Fruits des arbres plus rapides (année des vergers), carrière seulement. */
export function themeFruitFactor(state) {
  return themeIs(state, 'orchard') ? THEMES_BY_ID.orchard.values.fruitSpeed : 1;
}

/** Géants récoltés le jour du concours du plus gros légume : + 50 %. */
export function themeGiantValueFactor(state) {
  const fest = themeFestivalToday(state);
  return fest && fest.id === 'giants' ? fest.values.festivalGiant : 1;
}

/** Bornes du cours du marché de carrière (année des grands marchés), ou null. */
export function themeMarketBounds(state) {
  if (!themeIs(state, 'markets')) return null;
  const v = THEMES_BY_ID.markets.values;
  return { min: v.marketMin, max: v.marketMax };
}
