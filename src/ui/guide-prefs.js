// Petites préférences de l'interface « guidage » (lot 1 « confort ») : résumé du matin, « Semer partout »
// retenu. Pas une donnée de jeu : si le stockage est indisponible, les valeurs par défaut s'appliquent.

const KEY = 'une-annee-a-la-ferme.guidance';
const DEFAULTS = { morning: true, sowAll: false };

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
