// Économie : investissements, revenus automatiques, charges, prêt, fermage.

import { BASE_DAILY_CHARGE, SEASONS } from '../data/balance.js';
import { INVESTMENTS, getInvestment } from '../data/investments.js';

/** Liste des investissements proposés dans ce niveau (dans l'ordre des données). */
export function levelInvestments(level) {
  return INVESTMENTS.filter(
    (inv) => level.availableInvestments.includes(inv.id) && !(inv.id === 'sprinkler' && level.modifiers.noSprinkler),
  );
}

export function owned(state, id) {
  return state.investments[id] || 0;
}

export function maxOf(inv) {
  return inv.costs.length;
}

/** Prix de la prochaine unité / du prochain niveau, ou null si le maximum est atteint. */
export function nextCost(state, inv) {
  const n = owned(state, inv.id);
  return n < inv.costs.length ? inv.costs[n] : null;
}

/** Somme d'un effet numérique sur toutes les unités possédées. */
export function effectTotal(state, effectKey) {
  let total = 0;
  for (const inv of INVESTMENTS) {
    const n = owned(state, inv.id);
    const v = inv.effects[effectKey];
    if (n > 0 && typeof v === 'number') total += v * (inv.kind === 'upgrade' ? 1 : n);
  }
  return total;
}

/** Bonus de vitesse de pousse (ruches). Aucun effet en hiver. */
export function growthBonus(state, seasonIndex) {
  if (SEASONS[seasonIndex] === 'winter') return 0;
  return effectTotal(state, 'growthBonus');
}

/** Bonus sur le prix de vente (étal). */
export function priceBonus(state) {
  return effectTotal(state, 'priceBonus');
}

/** Nombre de parcelles arrosées automatiquement chaque matin. */
export function sprinklerCapacity(state, level) {
  if (level.modifiers.noSprinkler) return 0;
  const inv = getInvestment('sprinkler');
  const lvl = owned(state, 'sprinkler');
  return lvl > 0 ? inv.effects.waterPlots[lvl - 1] : 0;
}

/**
 * Revenus d'une aube : [{ source, amount, owned, kind }].
 * kind : 'daily' (revenu quotidien) ou 'shearing' (tonte, dernier jour de saison).
 * @param {boolean} lastDayOfSeason aujourd'hui est le dernier jour de la saison
 * @param {string|null} weatherId  météo du jour (null = estimation, sans effet météo)
 */
export function dawnIncomes(state, level, seasonIndex, weatherId, lastDayOfSeason) {
  const season = SEASONS[seasonIndex];
  const incomes = [];
  for (const inv of levelInvestments(level)) {
    const n = owned(state, inv.id);
    if (n === 0) continue;
    const units = inv.kind === 'upgrade' ? 1 : n;
    let amount = (inv.income[season] || 0) * units;
    if (weatherId && inv.effects.noIncomeOn?.includes(weatherId)) amount = 0;
    if (amount > 0) incomes.push({ source: inv.id, amount, owned: n, kind: 'daily' });
    if (lastDayOfSeason && inv.effects.shearing && inv.effects.shearingSeasons.includes(season)) {
      incomes.push({ source: inv.id, amount: inv.effects.shearing * units, owned: n, kind: 'shearing' });
    }
  }
  return incomes;
}

/** Charges quotidiennes fixes : ferme + entretien des investissements − panneaux solaires (≥ 0). */
export function dailyCharges(state, level) {
  let upkeep = BASE_DAILY_CHARGE;
  for (const inv of levelInvestments(level)) {
    const n = owned(state, inv.id);
    if (n === 0) continue;
    upkeep += inv.upkeep * (inv.kind === 'upgrade' ? 1 : n);
  }
  return Math.max(0, upkeep - effectTotal(state, 'chargeReduction'));
}

/** true si une mensualité de prêt tombe à l'aube du jour `day`. */
export function loanDueOn(level, day) {
  const loan = level.modifiers.loan;
  return !!loan && day > 1 && (day - 1) % loan.every === 0;
}

/** Prochain jour (> day) de mensualité, ou null s'il tombe après la fin de l'année. */
export function nextLoanDay(level, day, totalDays) {
  const loan = level.modifiers.loan;
  if (!loan) return null;
  let d = day + 1;
  while (d <= totalDays) {
    if (loanDueOn(level, d)) return d;
    d++;
  }
  return null;
}

/** Fermage de la saison. */
export function rentFor(level, seasonIndex) {
  return level.rents[seasonIndex];
}

/**
 * Vérifie si un investissement peut être acheté.
 * Renvoie { ok: true, cost, inv } ou { ok: false, reason }.
 */
export function checkBuy(state, level, id) {
  const inv = getInvestment(id);
  if (!inv) return { ok: false, reason: 'Investissement inconnu.' };
  if (!levelInvestments(level).some((i) => i.id === id)) {
    return { ok: false, reason: `« ${inv.name} » n'est pas disponible dans ce niveau.` };
  }
  const cost = nextCost(state, inv);
  if (cost === null) {
    return {
      ok: false,
      reason: inv.kind === 'upgrade' ? 'Niveau maximal atteint.' : `Vous avez déjà le maximum (${maxOf(inv)}).`,
    };
  }
  if (state.money < cost) return { ok: false, reason: notEnoughMoney(cost - state.money) };
  return { ok: true, cost, inv };
}

export function notEnoughMoney(missing) {
  return `Pas assez d'argent (il manque ${missing} pièce${missing > 1 ? 's' : ''}).`;
}
