// Petites préférences de l'interface « guidage » (lot 1 « confort ») : résumé du matin, « Semer partout »
// retenu. Pas une donnée de jeu : si le stockage est indisponible, les valeurs par défaut s'appliquent.
// (Accompagnement, src/ui/coach/store.js) leçons « à lire » (unread), passées (passed), rappels coupés
// (reminders : { [sorte]: { off: true } }), reprise du cours de début de carrière (firstSteps : { key, step, done }).

const KEY = 'une-annee-a-la-ferme.guidance';
const DEFAULTS = { morning: true, sowAll: false, unread: [], passed: [], reminders: {}, firstSteps: null };

export function readPrefs() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(patch) {
  const next = { ...readPrefs(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
  return next;
}
