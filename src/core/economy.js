// Économie : investissements, revenus automatiques, charges, prêt, fermage.
// Mode Carrière (state.mode === 'career') : branches vers src/core/career/effects.js (investissements de
// carrière, étal à niveaux, charges de saison à la place du fermage). Une partie de niveau n'y passe jamais.

import { BASE_DAILY_CHARGE, SEASONS } from '../data/balance.js';
import { INVESTMENTS, getInvestment } from '../data/investments.js';
import { perkValue } from './perks.js';
import { careerEffectTotal, careerSeasonCharge } from './career/effects.js';

/**
 * Données d'un investissement pour ce niveau : celles de la carrière (level.investmentsById) si le
 * niveau en a, sinon celles des niveaux (src/data/investments.js).
 */
export function investmentOf(level, id) {
  return level?.investmentsById?.[id] ?? getInvestment(id);
}

/** Liste des investissements proposés dans ce niveau (dans l'ordre des données). */
export function levelInvestments(level) {
  if (level.investmentsById) return level.availableInvestments.map((id) => level.investmentsById[id]).filter(Boolean);
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

/** Prix de la prochaine unité / du prochain niveau (après « Marchandage »), ou null si le maximum est atteint. */
export function nextCost(state, inv) {
  const n = owned(state, inv.id);
  if (n >= inv.costs.length) return null;
  const factor = perkValue(state, 'investmentFactor');
  return factor === 1 ? inv.costs[n] : Math.round(inv.costs[n] * factor);
}

/** Somme d'un effet numérique sur toutes les unités possédées. */
export function effectTotal(state, effectKey) {
  if (state.mode === 'career') return careerEffectTotal(state, effectKey);
  let total = 0;
  for (const inv of INVESTMENTS) {
    const n = owned(state, inv.id);
    const v = inv.effects[effectKey];
    if (n > 0 && typeof v === 'number') total += v * (inv.kind === 'upgrade' ? 1 : n);
  }
  return total;
}

/** Bonus de vitesse de pousse (ruches + « Main verte »). Aucun effet en hiver. */
export function growthBonus(state, seasonIndex) {
  if (SEASONS[seasonIndex] === 'winter') return 0;
  return effectTotal(state, 'growthBonus') + perkValue(state, 'growthBonus');
}

/** Bonus sur le prix de vente (étal + « Réputation »). */
export function priceBonus(state) {
  return effectTotal(state, 'priceBonus') + perkValue(state, 'priceBonus');
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

/**
 * Charges quotidiennes fixes : ferme (level.dailyCharge, selon le mode de difficulté) + entretien des investissements (− « Ferme économe », au plus
 * tout l'entretien) − panneaux solaires (≥ 0).
 */
export function dailyCharges(state, level) {
  let upkeep = 0;
  for (const inv of levelInvestments(level)) {
    const n = owned(state, inv.id);
    if (n === 0) continue;
    upkeep += inv.upkeep * (inv.kind === 'upgrade' ? 1 : n);
  }
  upkeep = Math.max(0, upkeep - perkValue(state, 'upkeepReduction'));
  return Math.max(0, (level.dailyCharge ?? BASE_DAILY_CHARGE) + upkeep - effectTotal(state, 'chargeReduction'));
}

/** Jour de la première mensualité (par défaut : l'aube qui suit les `every` premiers jours). */
export function loanFirstDay(loan) {
  return loan.first ?? loan.every + 1;
}

/** true si une mensualité de prêt tombe à l'aube du jour `day`. */
export function loanDueOn(level, day) {
  const loan = level.modifiers.loan;
  if (!loan) return false;
  const first = loanFirstDay(loan);
  return day >= first && day > 1 && (day - first) % loan.every === 0;
}

/** Mensualités restant à payer après le jour `day` (jusqu'à la fin de l'année). */
export function loanPaymentsLeft(level, day, totalDays) {
  let n = 0;
  for (let d = day + 1; d <= totalDays; d++) if (loanDueOn(level, d)) n++;
  return n;
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

/**
 * Fermage de la saison (« Bon voisinage » : printemps réduit si `state` est donné).
 * Carrière : charges de saison (« Impôts et assurance », src/core/career/effects.js).
 */
export function rentFor(level, seasonIndex, state = null) {
  if (state && state.mode === 'career') return careerSeasonCharge(state);
  const rent = level.rents[seasonIndex];
  if (!state || seasonIndex !== 0) return rent;
  const factor = perkValue(state, 'springRentFactor');
  return factor === 1 ? rent : Math.round(rent * factor);
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
  if (inv.requiresAny && !inv.requiresAny.some((req) => owned(state, req) > 0)) {
    return { ok: false, reason: requirementText(inv.requiresAny) };
  }
  if (state.money < cost) return { ok: false, reason: notEnoughMoney(cost - state.money) };
  return { ok: true, cost, inv };
}

/** « Il faut d'abord une vache ou une chèvre. » */
export function requirementText(ids) {
  const names = ids.map((id) => ({ cow: 'une vache', goat: 'une chèvre' })[id] || `« ${getInvestment(id)?.name ?? id} »`);
  return `Il faut d'abord ${names.length > 1 ? `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}` : names[0]}.`;
}

export function notEnoughMoney(missing) {
  return `Pas assez d'argent (il manque ${missing} pièce${missing > 1 ? 's' : ''}).`;
}
