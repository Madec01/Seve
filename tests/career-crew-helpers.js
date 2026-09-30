// Outils communs aux tests CORE-B (machines, employés, animaux, tâches) : tests/career-{machines,staff,animals,tasks}.test.js.
import { DAY_SECONDS, newCareer, nextDay, record, setRank } from './career-helpers.js';
import { drawCandidates } from '../src/core/career/staff.js';
import { stream } from '../src/core/rng.js';

export { DAY_SECONDS, newCareer, nextDay, record, setRank };

/** Carrière riche au rang donné (achats sans souci d'argent). */
export function richCareer(rank = 4, opts = {}) {
  const g = newCareer(opts);
  g.state.money = 1e6;
  setRank(g, rank);
  return g;
}

/** Avance la journée en cours jusqu'à la fraction `frac` (0..1) du jour. */
export function atFrac(g, frac) {
  const target = frac * DAY_SECONDS;
  const dt = target - g.state.time.elapsed;
  if (dt > 0) g.update(dt / g.state.speed);
}

/** Maison au niveau voulu (capacité d'employés). */
export function houseLevel(g, level) {
  while ((g.state.career.buildings.house.level || 1) < level) {
    const r = g.actions.career.upgradeBuilding('house');
    if (!r.ok) throw new Error(r.reason);
  }
}

/** Embauche le premier candidat (ou celui d'index k) et l'affecte. Renvoie l'employé (état). */
export function hireAs(g, job = null, lotId = null, k = 0) {
  const cap = () => [0, 0, 2, 4, 6, 8][g.state.career.buildings.house.level];
  while (cap() <= g.state.career.staff.length && g.state.career.buildings.house.level < 5) houseLevel(g, g.state.career.buildings.house.level + 1);
  if (!g.state.career.candidates[k]) g.state.career.candidates.push(...drawCandidates(g.state, stream(g.state.rng, 'staff')));
  const cand = g.state.career.candidates[k];
  if (!cand) throw new Error('pas de candidat');
  const r = g.actions.career.hire(cand.id, job, lotId);
  if (!r.ok) throw new Error(r.reason);
  return g.state.career.staff.find((s) => s.id === r.staffId);
}

/** Force un trait (tests : effet isolé) et recalcule le salaire. */
export function withTrait(s, trait, wageFor) {
  s.trait = trait;
  if (wageFor) s.wage = wageFor(s.level, trait);
  return s;
}

/** Achète un terrain et l'aménage. Renvoie son id. */
export function newLot(g, type) {
  const r = g.actions.career.buyLot();
  if (!r.ok) throw new Error(r.reason);
  const d = g.actions.career.developLot(r.lotId, type);
  if (!d.ok) throw new Error(d.reason);
  return r.lotId;
}

/** Sème une culture sur des parcelles (sans passer par le joueur : pas de dépense) et la rend mûre si `mature`. */
export function sowDirect(g, indices, cropId, { mature = false, growth = null } = {}) {
  for (const i of indices) {
    const p = g.state.plots[i];
    p.cropId = cropId;
    p.growth = growth ?? (mature ? 99 : 0);
    p.watered = false;
    p.fruit = 0;
  }
}

/** Index des parcelles ouvertes d'un terrain, dans l'ordre des cases. */
export function lotPlots(g, lotId) {
  return g.state.plots.map((p, i) => (p.lot === lotId && p.env && p.unlocked ? i : -1)).filter((i) => i >= 0).sort((a, b) => g.state.plots[a].cell - g.state.plots[b].cell);
}

/** Copie profonde de l'état sans ce qui dépend des abonnés (comparaison de déterminisme). */
export function snapshot(g) {
  return JSON.parse(JSON.stringify(g.serialize()));
}
