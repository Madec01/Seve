// Statistiques de l'année et de la saison en cours, pour les écrans de bilan.

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
    s.harvestIncome + s.investmentIncome - s.charges - s.waterSpent - s.loanPaid - s.rentsPaid - s.seedsSpent - s.investmentsSpent - s.plotsSpent;
  const season = copy(state.stats.season);
  return {
    ...year,
    totalHarvested: Object.values(year.cropsHarvested).reduce((a, b) => a + b, 0),
    net: net(year),
    season: { ...season, net: net(season), totalHarvested: Object.values(season.cropsHarvested).reduce((a, b) => a + b, 0) },
    seasonId,
    day: state.time.day,
    startMoney: state.startMoney,
    money: state.money,
    investments: { ...state.investments },
    ...extra,
  };
}
