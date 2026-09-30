// Le prêt du voisin (mode « détente ») : le filet de sécurité qui remplace la faillite immédiate.
//
// Règles (level.neighbourLoan = { surcharge, repayShare, cushion } ; null en mode classique) :
//   - Le soir d'un fermage, si l'argent ne suffit pas (après la vente en l'état des ateliers), que l'on
//     ne doit RIEN au voisin et qu'il manque au plus max(`minCover`, `maxShare` du fermage), Joseph
//     prête automatiquement ce qui manque, plus `cushion` pièces pour
//     ressemer (sauf au dernier fermage de l'année). On lui doit la somme prêtée + `surcharge`
//     (arrondi à la pièce supérieure). Le fermage est alors payé normalement.
//   - Remboursement automatique : `repayShare` de chaque vente (récolte vendue, produit transformé vendu
//     à l'aube) part chez le voisin tant que la dette n'est pas réglée (arrondi supérieur, au plus la dette).
//     On peut aussi rembourser quand on veut (action repayNeighbour).
//   - Un fermage manqué alors qu'on doit encore de l'argent au voisin, ou quand il manque plus que ce
//     plafond → faillite (le filet rattrape un faux pas, pas une ferme abandonnée).
//   - Fin de l'année : après le fermage d'hiver, ce qui reste dû est repris sur l'argent final, dans la
//     limite de cet argent ; Joseph efface le reste (l'argent final ne devient jamais négatif), avant
//     de compter les étoiles.
// Tout est déterministe (aucun tirage) et tient dans state.neighbourLoan (sérialisé avec la partie) :
//   { debt, borrowed, repaid, forgiven, loans }   debt : reste dû ; borrowed : total prêté (sans le
//     supplément) ; repaid : total remboursé ; forgiven : effacé en fin d'année ; loans : prêts reçus.

/** État initial du prêt (mode avec prêt), ou null (mode classique). */
export function initialNeighbourLoan(level) {
  return level.neighbourLoan ? { debt: 0, borrowed: 0, repaid: 0, forgiven: 0, loans: 0 } : null;
}

/** true si le voisin peut prêter (mode avec prêt, aucune dette en cours) — sans regarder la somme. */
export function canBorrow(state, level) {
  return !!level.neighbourLoan && !!state.neighbourLoan && state.neighbourLoan.debt <= 0;
}

/**
 * Manque maximal que le voisin accepte de couvrir pour un fermage `rent` : `maxShare` du fermage
 * (arrondi inférieur), et au moins `minCover` pièces (petits fermages du début d'année).
 */
export function maxMissing(level, rent) {
  const cfg = level.neighbourLoan;
  return Math.max(cfg.minCover ?? 0, Math.floor(rent * cfg.maxShare + 1e-9));
}

/** true si le voisin prête ce soir : pas de dette en cours, et le manque ne dépasse pas maxMissing. */
export function willLend(state, level, rent) {
  return canBorrow(state, level) && state.money < rent && rent - state.money <= maxMissing(level, rent);
}

/** Somme que le voisin prêterait pour un fermage `rent` avec `money` en poche (0 si rien ne manque). */
export function loanAmount(level, rent, money, lastSeason) {
  if (money >= rent || !level.neighbourLoan) return 0;
  return rent - money + (lastSeason ? 0 : level.neighbourLoan.cushion);
}

/** Dette correspondant à une somme prêtée (supplément compris, arrondi supérieur). */
export function debtFor(level, amount) {
  return Math.ceil(amount * (1 + level.neighbourLoan.surcharge) - 1e-9);
}

/** Part d'une vente de `amount` pièces reprise par le voisin (0 si on ne lui doit rien). */
export function repaymentFrom(state, level, amount) {
  const loan = state.neighbourLoan;
  if (!loan || loan.debt <= 0 || !(amount > 0) || !level.neighbourLoan) return 0;
  return Math.min(loan.debt, Math.ceil(amount * level.neighbourLoan.repayShare - 1e-9));
}

/** Enregistre un prêt : renvoie { amount, debt } (la dette ajoutée). */
export function borrow(state, level, amount) {
  const debt = debtFor(level, amount);
  const loan = state.neighbourLoan;
  loan.debt += debt;
  loan.borrowed += amount;
  loan.loans += 1;
  return { amount, debt };
}

/** Enregistre un remboursement ; renvoie true si la dette est entièrement réglée. */
export function repay(state, amount) {
  const loan = state.neighbourLoan;
  loan.debt -= amount;
  loan.repaid += amount;
  return loan.debt <= 0;
}
