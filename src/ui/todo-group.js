// Lignes « À faire » regroupées (Vallée V3, reste du V2 n° 2 ; docs/VALLEE.md § 17.11.4, contrat : docs/ARCHITECTURE.md,
// « Vallée vivante — contrats du lot V3 »). Pur : aucun accès au DOM (testé par tests/todo-group.test.js).
//
//   TODO_FAMILIES                 { [famille]: { label, match(id) } } — le village, la vallée, les fêtes, Joseph
//   familyOf(id) → famille | null
//   groupTodo(items, { max = 5, urgent = 25, perGroup = 4, open? }) → liste regroupée, triée, `max` entrées au plus
//       Les entrées urgentes (priorité ≤ `urgent` : corbeaux, charges qui manquent) restent seules. Deux entrées ou plus
//       d'une même famille (non urgentes) deviennent une seule ligne { id: 'group-<famille>', prio: la plus pressante,
//       text: 'Le village : 4 choses', short, icon (celle de la première), family, items: [≤ perGroup], go } ;
//       `open(famille, items)` est appelé par go() (la petite feuille de 4 lignes). Une famille d'une seule entrée garde sa
//       ligne telle quelle. Sortie triée par priorité ; « Jamais 11 ».

export const TODO_FAMILIES = Object.freeze({
  village: {
    label: 'Le village',
    match: (id) => /^(v-|board-|order-|offer-|challenge-|gift|cart|peddler|troc$|vl-troc$)/.test(id),
  },
  valley: {
    label: 'La vallée',
    match: (id) => /^vl-/.test(id) && id !== 'vl-troc',
  },
  fete: {
    label: 'Les fêtes',
    match: (id) => /^(cz-|fete-|winter-|veillee)/.test(id),
  },
  joseph: {
    label: 'Joseph',
    match: (id) => /^quest/.test(id),
  },
});
const ORDER = Object.keys(TODO_FAMILIES);

export function familyOf(id) {
  const s = String(id || '');
  for (const f of ORDER) if (TODO_FAMILIES[f].match(s)) return f;
  return null;
}

const things = (n) => (n > 1 ? `${n} choses` : '1 chose');

export function groupTodo(items, { max = 5, urgent = 25, perGroup = 4, open = null } = {}) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  const byFam = new Map();
  for (const it of list) {
    if ((it.prio ?? 99) <= urgent) continue;
    const f = familyOf(it.id);
    if (!f) continue;
    if (!byFam.has(f)) byFam.set(f, []);
    byFam.get(f).push(it);
  }
  const out = [];
  const done = new Set();
  for (const it of list) {
    const f = (it.prio ?? 99) <= urgent ? null : familyOf(it.id);
    const fam = f ? byFam.get(f) : null;
    if (!fam || fam.length < 2) {
      out.push(it);
      continue;
    }
    if (done.has(f)) continue;
    done.add(f);
    const sorted = [...fam].sort((a, b) => (a.prio ?? 99) - (b.prio ?? 99));
    const label = TODO_FAMILIES[f].label;
    const kept = sorted.slice(0, perGroup);
    out.push({
      id: `group-${f}`,
      family: f,
      prio: sorted[0].prio ?? 99,
      text: `${label} : ${things(sorted.length)}`,
      short: `${label.charAt(0).toLowerCase()}${label.slice(1)} (${things(sorted.length)})`,
      icon: sorted[0].icon,
      items: kept,
      count: sorted.length,
      go: () => (typeof open === 'function' ? open(f, kept) : kept[0]?.go?.()),
    });
  }
  return out.sort((a, b) => (a.prio ?? 99) - (b.prio ?? 99)).slice(0, Math.max(1, max));
}
