// Statistiques de l'année et de la saison en cours, pour les écrans de bilan.

import { varietySummary } from './variety.js';
import { cozySummary } from './cozy.js';

export function createStats() {
  return {
    harvestIncome: 0, // ventes des récoltes
    investmentIncome: 0, // revenus automatiques (dont tonte)
    charges: 0, // charges quotidiennes (ferme + entretien − solaire)
    waterSpent: 0, // coût de l'arrosage (manuel et automatique)
    loanPaid: 0, // mensualités du prêt
    rentsPaid: 0, // fermages payés
    seedsSpent: 0, // graines achetées
    investmentsSpent: 0, // investissements achetés
    plotsSpent: 0, // parcelles achetées
    cropsPlanted: 0,
    cropsHarvested: {}, // { cropId: nombre }
    cropsLost: { frost: 0, rot: 0 },
    // v3
    productIncome: 0, // produits transformés vendus (aube)
    productsSold: {}, // { productId: nombre }
    rawSales: 0, // ventes « en l'état » (bouton, filets de sécurité)
    frostRefund: 0, // remboursement de l'Assurance gel
    contestPrize: 0, // prix du concours (niveau 12)
    minMoneyAfterRent: null, // argent le plus bas juste après un fermage payé (null : aucun fermage payé)
    bestSeasonHarvestIncome: 0, // meilleures ventes de récoltes d'une saison (année) / de la saison
    // (lot 2) surpriseIncome : argent des surprises (coffres, champignons, vœux) — ajouté seulement quand il y en a
    // (addSurpriseIncome de src/core/surprises.js), pour que le bilan du mode Classique reste identique.
    // (lot 3) varietyIncome (primes du tableau et de la charrette, cartes, médailles) et varietySpent (colporteur) :
    // idem, créés seulement quand il y en a (src/core/game.js, addVarietyStat).
    // (lot 4) cozyIncome (fêtes, trouvailles d'hiver) : idem, créé seulement quand il y en a.
  };
}

/** Ajoute une valeur aux statistiques de l'année et de la saison. */
export function addStat(state, key, amount) {
  state.stats.year[key] += amount;
  state.stats.season[key] += amount;
}

export function addHarvest(state, cropId) {
  for (const s of [state.stats.year, state.stats.season]) {
    s.cropsHarvested[cropId] = (s.cropsHarvested[cropId] || 0) + 1;
  }
}

/** Retient les meilleures ventes de récoltes d'une saison (succès « Saison dorée »). */
export function noteSeasonHarvest(state) {
  const { year, season } = state.stats;
  season.bestSeasonHarvestIncome = season.harvestIncome;
  if (season.harvestIncome > year.bestSeasonHarvestIncome) year.bestSeasonHarvestIncome = season.harvestIncome;
}

export function addProductSold(state, productId, amount) {
  for (const s of [state.stats.year, state.stats.season]) {
    s.productsSold[productId] = (s.productsSold[productId] || 0) + 1;
    s.productIncome += amount;
  }
}

/** Note l'argent restant juste après un fermage payé (succès « Sur le fil »). */
export function noteRentPaid(state) {
  for (const s of [state.stats.year, state.stats.season]) {
    if (s.minMoneyAfterRent === null || state.money < s.minMoneyAfterRent) s.minMoneyAfterRent = state.money;
  }
}

export function addLost(state, cause, count) {
  state.stats.year.cropsLost[cause] += count;
  state.stats.season.cropsLost[cause] += count;
}

/**
 * Résumé pour billPaid / bankrupt / victory :
 * totaux de l'année + `season` (totaux de la saison qui s'achève) + contexte.
 */
export function buildSummary(state, seasonId, extra = {}) {
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const year = copy(state.stats.year);
  const net = (s) =>
    s.harvestIncome + s.investmentIncome + s.productIncome + s.rawSales + s.frostRefund + s.contestPrize + (s.surpriseIncome || 0)
    + (s.varietyIncome || 0) - (s.varietySpent || 0) + (s.cozyIncome || 0)
    - s.charges - s.waterSpent - s.loanPaid - s.rentsPaid - s.seedsSpent - s.investmentsSpent - s.plotsSpent;
  const season = copy(state.stats.season);
  // Mode détente : prêt du voisin (absent du résumé en mode classique). Le bilan de l'année en tient
  // compte (prêté − remboursé) ; celui de la saison non.
  const loan = state.neighbourLoan;
  const loanNet = loan ? loan.borrowed - loan.repaid : 0; // (le supplément et l'effacé sont dans l'écart)
  return {
    ...year,
    totalHarvested: Object.values(year.cropsHarvested).reduce((a, b) => a + b, 0),
    net: net(year) + loanNet,
    ...(loan ? { neighbourLoan: { ...loan } } : {}),
    season: { ...season, net: net(season), totalHarvested: Object.values(season.cropsHarvested).reduce((a, b) => a + b, 0) },
    seasonId,
    day: state.time.day,
    startMoney: state.startMoney,
    money: state.money,
    investments: { ...state.investments },
    // (lot 3) Variété : primes, cartes, médailles, colporteur (absent quand elle est désactivée).
    ...(state.variety ? { variety: varietySummary(state) } : {}),
    // (lot 4) Fêtes, hiver, lanternes : compteurs de l'année, cumuls, lanternes allumées (absent en Classique).
    ...(state.cozy ? { cozy: cozySummary(state) } : {}),
    ...extra,
  };
}
