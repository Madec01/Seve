// Lot 4 — D3 : les lanternes de fin d'année (pur). Règles : docs/GAME_DESIGN.md § 17.2 ; barèmes : LANTERN_RULES de
// src/data/cozy.js. Les faits sont rassemblés par src/core/cozy.js (lanternFacts) ; ce module ne fait que compter.
//
// lanternsFor(facts, mode) → { values: [5], criteria: [lanternCriterion], total, partial }
//   lanternCriterion = { id, name, icon, color, measure, value, lit (1..4), next: null | { need, text } }
// Chaque critère a au moins une lanterne ; elles ne changent ni les étoiles ni l'argent.
//
// facts (niveaux) : { variety: { v, k }, care: { cared, harvests, fallback }, neighbours, beauty,
//                     prosperity: { money, s2, s3 }, partial }
// facts (carrière) : { variety: n, care: { hand, harvests, collected, lost, shelters, fallback }, neighbours, beauty,
//                      prosperity: { start, end }, partial }

import { LANTERN_CRITERIA, LANTERN_RULES } from '../data/cozy.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
/** 1 382 (espace fine insécable entre les milliers, comme l'interface). */
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
const pct = (x) => `${Math.round(x * 100)} %`;

/** Nombre de lanternes (1 à 4) d'une valeur pour trois paliers croissants. */
export function litFor(value, steps) {
  let lit = 1;
  for (const s of steps) if (value >= s - 1e-9) lit += 1;
  return lit;
}

function criterion(id, value, steps, measure, nextText) {
  const def = LANTERN_CRITERIA.find((c) => c.id === id);
  const lit = litFor(value, steps);
  let next = null;
  if (lit < 4) {
    const target = steps[lit - 1];
    next = { need: target, text: nextText(target, lit + 1) };
  }
  return { id, name: def.name, icon: def.icon, color: def.color, measure, value, lit, next, steps: [...steps] };
}

function levelsCriteria(f) {
  const R = LANTERN_RULES.levels;
  const k = Math.max(1, f.variety?.k || 1);
  const vSteps = R.variety.map((x) => Math.ceil(x * k));
  const v = f.variety?.v || 0;
  const out = [];
  out.push({ ...criterion('variety', v, vSteps, plural(v, 'culture ou produit différent', 'cultures ou produits différents'), (t, n) => `Encore ${plural(t - v, 'culture ou produit', 'cultures ou produits')} pour la ${n}ᵉ lanterne`), k });
  // Soin : part des récoltes soignées ; sans suivi (surprises désactivées, partie migrée) : 2 lanternes.
  const c = f.care || {};
  if (c.fallback) {
    const def = LANTERN_CRITERIA.find((x) => x.id === 'care');
    out.push({ id: 'care', name: def.name, icon: def.icon, color: def.color, measure: 'Des cultures bien soignées', value: null, lit: LANTERN_RULES.careFallback, next: null });
  } else {
    const share = c.harvests > 0 ? c.cared / c.harvests : 0;
    out.push(criterion('care', share, R.care, `${pct(share)} des récoltes bien soignées`, (t, n) => `Arroser chaque jour donne la ${n}ᵉ lanterne (${pct(t)} des récoltes)`));
  }
  const nb = f.neighbours || 0;
  out.push(criterion('neighbours', nb, R.neighbours, plural(nb, 'point', 'points') + ' de voisinage', (t, n) => (t - nb <= 3 ? `Encore ${plural(t - nb, 'point')} pour la ${n}ᵉ lanterne` : 'Les fêtes et les commandes réchauffent le voisinage')));
  const be = f.beauty || 0;
  out.push(criterion('beauty', be, R.beauty, plural(be, 'point', 'points') + ' de beauté', (t, n) => `Une décoration, une ruche ou un tournesol de plus pour la ${n}ᵉ lanterne`));
  const p = f.prosperity || {};
  const s2 = p.s2 || 0;
  const s3 = p.s3 || 0;
  const pSteps = [Math.round(R.prosperity[0] * s2), Math.round(R.prosperity[1] * s2), s3];
  const money = Math.max(0, Math.round(p.money || 0));
  out.push(criterion('prosperity', money, pSteps, `${num(money)} ${money > 1 ? 'pièces' : 'pièce'} à la fin de l'année`, (t, n) => `${num(t)} ${t > 1 ? 'pièces' : 'pièce'} pour la ${n}ᵉ lanterne`));
  return out;
}

function careerCriteria(f) {
  const R = LANTERN_RULES.career;
  const out = [];
  const v = f.variety || 0;
  out.push(criterion('variety', v, R.variety, plural(v, 'culture ou produit différent', 'cultures ou produits différents'), (t, n) => `Encore ${plural(t - v, 'culture ou produit', 'cultures ou produits')} pour la ${n}ᵉ lanterne`));
  const c = f.care || {};
  if (c.fallback) {
    const def = LANTERN_CRITERIA.find((x) => x.id === 'care');
    out.push({ id: 'care', name: def.name, icon: def.icon, color: def.color, measure: 'Des cultures bien soignées', value: null, lit: LANTERN_RULES.careFallback, next: null });
  } else {
    const share = careerCare(c);
    out.push(criterion('care', share, R.care, `${pct(share)} de soin cette année`, (t, n) => `Récolter à la main et ramasser les abris à temps donnent la ${n}ᵉ lanterne`));
  }
  const nb = f.neighbours || 0;
  out.push(criterion('neighbours', nb, R.neighbours, plural(nb, 'point', 'points') + ' de voisinage', (t, n) => (t - nb <= 3 ? `Encore ${plural(t - nb, 'point')} pour la ${n}ᵉ lanterne` : 'Les fêtes, Joseph et les commandes réchauffent le voisinage')));
  const be = f.beauty || 0;
  out.push(criterion('beauty', be, R.beauty, plural(be, 'point', 'points') + ' de beauté', (t, n) => `Une décoration, une ruche ou un arbre de plus pour la ${n}ᵉ lanterne`));
  const p = f.prosperity || {};
  const base = Math.max(p.start || 0, R.prosperityFloor);
  const growth = ((p.end || 0) - (p.start || 0)) / base;
  out.push(criterion('prosperity', growth, R.prosperity, growth > 0 ? `Patrimoine +${pct(growth)} cette année` : 'Une année pour souffler', (t, n) => `Un patrimoine en hausse de ${pct(t)} donne la ${n}ᵉ lanterne`));
  return out;
}

/** Soin de la carrière : moyenne de c (récoltes à la main soignées ÷ toutes) et a (abris ramassés à temps). */
export function careerCare(c) {
  const share = c.harvests > 0 ? (c.hand || 0) / c.harvests : 0;
  const total = (c.collected || 0) + (c.lost || 0);
  if (!c.shelters || total <= 0) return share;
  return (share + (c.collected || 0) / total) / 2;
}

/** Lanternes de l'année d'après les faits. */
export function lanternsFor(facts, mode = 'levels') {
  const criteria = mode === 'career' ? careerCriteria(facts || {}) : levelsCriteria(facts || {});
  const values = criteria.map((c) => c.lit);
  return { values, criteria, total: values.reduce((a, b) => a + b, 0), partial: !!facts?.partial };
}
