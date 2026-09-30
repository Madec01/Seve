// Concours du village (v3, niveau 12) : épreuves comptées depuis le début de l'année, jugées le soir
// du jour limite (dernier jour de l'automne), juste avant le fermage. Voir docs/GAME_DESIGN.md § 12.6.
//
// state.contest = null (niveau sans concours) | { awarded, result: null | { goalsMet: [goalId], amount } }

/** État initial du concours d'un niveau. */
export function initialContest(level) {
  return level.contest ? { awarded: false, result: null } : null;
}

/** Progression d'une épreuve d'après les statistiques de l'année. */
export function goalProgress(state, goal) {
  const year = state.stats.year;
  if (goal.type === 'harvest') return year.cropsHarvested[goal.cropId] || 0;
  if (goal.type === 'productsSold') {
    const sold = year.productsSold || {};
    const ids = goal.productIds || Object.keys(sold);
    return ids.reduce((n, id) => n + (sold[id] || 0), 0);
  }
  return 0;
}

/** [{ id, label, target, progress, done }] */
export function contestGoals(state, level) {
  if (!level.contest) return [];
  return level.contest.goals.map((g) => {
    const progress = goalProgress(state, g);
    return { id: g.id, label: g.label, target: g.target, progress, done: progress >= g.target };
  });
}

/** Prix que rapporteraient ces épreuves réussies. */
export function prizeFor(level, goalsMet) {
  const c = level.contest;
  if (!c || goalsMet.length === 0) return 0;
  return c.prizePerGoal * goalsMet.length + (goalsMet.length === c.goals.length ? c.bonusAll : 0);
}

/** Instantané des progressions (pour détecter les changements) : { goalId: progress }. */
export function contestSnapshot(state, level) {
  if (!level.contest || !state.contest || state.contest.awarded) return null;
  return Object.fromEntries(contestGoals(state, level).map((g) => [g.id, g.progress]));
}

/** Événements contestProgress des épreuves dont la progression a changé depuis `before`. */
export function contestChanges(state, level, before) {
  if (!before) return [];
  return contestGoals(state, level)
    .filter((g) => g.progress !== before[g.id])
    .map((g) => ({ goalId: g.id, progress: g.progress, target: g.target, done: g.done }));
}

/** true si le concours doit être jugé ce soir. */
export function contestDueTonight(state, level) {
  return !!level.contest && !!state.contest && !state.contest.awarded && state.time.day === level.contest.deadlineDay;
}

/** Remise des prix : marque le concours jugé, renvoie { amount, goalsMet, goals } (l'argent n'est pas versé ici). */
export function awardContest(state, level) {
  const goals = contestGoals(state, level);
  const goalsMet = goals.filter((g) => g.done).map((g) => g.id);
  const amount = prizeFor(level, goalsMet);
  state.contest.awarded = true;
  state.contest.result = { goalsMet, amount };
  return { amount, goalsMet, goals };
}
