// Accompagnement — ce que le joueur sait déjà (docs/ACCOMPAGNEMENT.md § 10.3). PUR : aucun accès au DOM ni au stockage.
//
// Contexte de déduction (`actx`, construit par le moteur au chargement puis à chaque partie) :
//   { progress, tutorialDone, careerSave: { year, day, rank } | null, archives (nombre de fermes archivées),
//     game?, state?, mode?, seen(id) }
// acquiredAtLoad(lessons, actx) → [id] : leçons non vues dont `acquired(actx)` est vrai (ou les rudiments des règles
// communes). experienced(actx) / veteran(actx) : règles du tableau du § 10.3 (exportées pour les catalogues).

const num = (v) => (Number.isFinite(v) ? v : 0);

function levelsWon(progress) {
  return Object.values(progress?.levels || {}).filter((l) => l && l.completed).length;
}

function careerYear(actx) {
  const save = actx?.careerSave;
  const live = actx?.state?.mode === 'career' ? actx.state.time?.year : 0;
  return Math.max(num(save?.year), num(live), num(actx?.progress?.career?.bestYear));
}

function careerPastDay3(actx) {
  const t = actx?.state?.mode === 'career' ? actx.state.time : null;
  const s = actx?.careerSave;
  const past = (y, d) => num(y) > 1 || num(d) > 3;
  return (t && past(t.year, t.day)) || (s && past(s.year, s.day)) || num(actx?.progress?.career?.years) >= 1;
}

/**
 * Rudiments des gestes déjà sus (récolter, semer, arroser, temps, argent, acheter) : un niveau gagné, le tutoriel du
 * niveau 1 terminé, une carrière qui a dépassé le jour 3, ou au moins 20 récoltes au cumul.
 */
export function experienced(actx) {
  if (!actx) return false;
  if (levelsWon(actx.progress) >= 1) return true;
  if (actx.tutorialDone) return true;
  if (careerPastDay3(actx)) return true;
  return num(actx.progress?.lifetime?.harvests) >= 20;
}

/** La ligne « À faire », l'appui long, « Semer partout », la cloche : ≥ 2 niveaux gagnés, ou une carrière en an 2. */
export function veteran(actx) {
  if (!actx) return false;
  return levelsWon(actx.progress) >= 2 || careerYear(actx) >= 2;
}

/** Une carrière existe déjà (sauvegarde) ou a existé (archive) : le cours de début de carrière est su. */
export function careerKnown(actx) {
  return !!actx?.careerSave || num(actx?.archives) > 0 || num(actx?.progress?.career?.started) > 0;
}

/** Ce niveau a déjà été gagné ou commencé. */
export function levelKnown(actx, id) {
  const l = actx?.progress?.levels?.[id];
  return !!l && !!(l.completed || l.played || l.bestMoney !== undefined && l.bestMoney !== null);
}

/**
 * Leçons non vues que le joueur maîtrise déjà. Chaque leçon peut porter `acquired(actx)` ; un prédicat qui lève une
 * exception (état d'une ancienne version, lot absent) compte comme faux.
 */
export function acquiredAtLoad(lessons, actx) {
  const out = [];
  const seen = typeof actx?.seen === 'function' ? actx.seen : () => false;
  for (const l of lessons || []) {
    if (!l || !l.id || seen(l.id) || typeof l.acquired !== 'function') continue;
    let ok = false;
    try {
      ok = !!l.acquired(actx);
    } catch {
      ok = false;
    }
    if (ok) out.push(l.id);
  }
  return out;
}
