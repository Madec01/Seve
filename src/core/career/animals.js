// Mode Carrière — animaux (extension CORE-B « animals ») : production à ramasser dans les abris (plafond
// de 3 jours), ramassage (joueur, soigneur, collecteur), naissances des lapins, truffes des cochons,
// tonte, balades à cheval. Pur. Conception : docs/CARRIERE.md § 5 ; contrats : docs/ARCHITECTURE.md.
//
// Remplace les animaux provisoires de CORE-A (DEFAULT_ANIMALS, mêmes identifiants) et pose le drapeau
// `collectAnimals` : le cœur ne paie plus les animaux à l'aube.
//
// Aube (étape 9, point d'accroche `incomes`) : chaque abri reçoit la production du jour
//   (animaux × valeur par jour × (1 + bonus du soigneur)), moins le lait parti à la fromagerie ;
//   au-delà de 3 jours de production, le surplus est perdu (événement shelterFull).
//   La tonte (dernier jour du printemps, de l'été, de l'automne) et les balades (chambre d'hôte) sont
//   payées tout de suite (revenus de l'aube).
// Aube (3 bis, `dawnEvents`) : truffes (automne, hiver : chaque cochon, 30 %, 60 pièces) → porcherie.
// Début de saison (`seasonStart`) : lapins : +1 par couple, dans la limite du clapier.
//
// state.career.buildings[abri] = { …, pending (valeur à ramasser), lastCollected (jour absolu) }

import { MAX_ANIMALS } from '../../data/career/career.js';
import { BUILDINGS_BY_ID, SHELTERS } from '../../data/career/buildings.js';
import { CAREER_ANIMALS, CAREER_ANIMALS_BY_ID, COLLECT } from '../../data/career/animals.js';
import { aboutFields } from '../../data/career/descriptions.js';
import { registerCareerExtension } from './registry.js';
import { animalCount, shelterCapacity } from './buildings.js';
import { absDay, addWorkStat, ensureWork, keeperBonus } from './crew.js';

/** Animal de carrière logé dans un abri. */
export function animalOfShelter(shelterId) {
  const def = BUILDINGS_BY_ID[shelterId];
  return def && def.category === 'shelter' ? CAREER_ANIMALS_BY_ID[def.animal] || null : null;
}

/** Abris construits, dans l'ordre des données. */
export function builtShelters(state) {
  return SHELTERS.filter((id) => state.career.buildings[id]);
}

/** Valeur produite par jour par un abri (à ramasser), bonus du soigneur compris ; `units` : animaux comptés. */
function dailyValue(state, shelterId, seasonId, units = null) {
  const a = animalOfShelter(shelterId);
  const b = state.career.buildings[shelterId];
  if (!a || !b || !a.collect) return 0;
  const n = units ?? (state.investments[a.id] || 0);
  const per = a.truffles ? a.truffles.value * a.truffles.chance : a.income[seasonId] || 0;
  return n * per * (1 + keeperBonus(state, b.lotId));
}

/**
 * Plafond de l'abri : 3 jours de production (cochons : 3 truffes par cochon). 0 sans animal
 * (l'abri garde alors ce qu'il contient, sans rien perdre).
 */
export function shelterCap(state, shelterId, seasonId) {
  const a = animalOfShelter(shelterId);
  if (!a || !a.collect) return 0;
  const n = state.investments[a.id] || 0;
  const b = state.career.buildings[shelterId];
  const per = a.truffles ? a.truffles.value : Math.max(...Object.values(a.income), a.income[seasonId] || 0);
  return Math.round(COLLECT.capDays * n * per * (1 + keeperBonus(state, b.lotId)));
}

/** Ajoute de la production à un abri, dans la limite du plafond. Renvoie { added, lost }. */
function addPending(api, shelterId, amount, seasonId) {
  const { state } = api;
  const b = state.career.buildings[shelterId];
  if (!b || !(amount > 0)) return { added: 0, lost: 0 };
  const cap = shelterCap(state, shelterId, seasonId);
  const before = b.pending || 0;
  const room = Math.max(0, cap - before);
  const added = Math.min(room, amount);
  const lost = Math.round((amount - added) * 100) / 100;
  b.pending = Math.round((before + added) * 100) / 100;
  if (lost > 0) {
    addWorkStat(state, 'lostAnimals', lost);
    api.push('shelterFull', { buildingId: shelterId, lost: Math.round(lost), pending: Math.round(b.pending), cap });
  }
  return { added, lost };
}

/**
 * Ramasse un abri : l'argent est gagné tout de suite (poste « animals »), événement collected.
 * `by` : 'player' | 'keeper' | 'collector'. → { ok, amount } | { ok: false, reason }
 */
export function collectShelter(api, buildingId, by = 'player', extra = {}) {
  const { state } = api;
  const def = BUILDINGS_BY_ID[buildingId];
  if (!def || def.category !== 'shelter') return api.fail('Abri inconnu.');
  const b = state.career.buildings[buildingId];
  if (!b) return api.fail(`Pas encore de ${def.name.toLowerCase()}.`);
  const amount = Math.round(b.pending || 0);
  if (amount <= 0) {
    b.pending = 0;
    return api.fail('Rien à ramasser pour l\'instant.');
  }
  b.pending = 0;
  b.lastCollected = absDay(state);
  api.earn('animals', amount);
  addWorkStat(state, 'collected', amount, by);
  api.push('collected', { buildingId, amount, by, animalId: def.animal, product: animalOfShelter(buildingId)?.product || null, ...extra });
  return { ok: true, amount };
}

/** Ligne d'un abri pour query.career.shelters(). */
export function shelterInfo(state, shelterId, seasonId) {
  const def = BUILDINGS_BY_ID[shelterId];
  const b = state.career.buildings[shelterId];
  const a = animalOfShelter(shelterId);
  const count = state.investments[def.animal] || 0;
  const daily = dailyValue(state, shelterId, seasonId);
  const cap = shelterCap(state, shelterId, seasonId);
  const pending = Math.round(b?.pending || 0);
  const collectorKey = `collector@${shelterId}`;
  return {
    buildingId: shelterId,
    name: def.levels[Math.max(0, (b?.level || 1) - 1)].name,
    level: b?.level || 0,
    lotId: b?.lotId ?? null,
    slot: b?.slot ?? null,
    animalId: def.animal,
    animalName: a?.name ?? def.animal,
    count,
    capacity: shelterCapacity(state, shelterId),
    product: a?.product ?? null,
    productName: a?.productName ?? null,
    collect: !!a?.collect,
    pending,
    dailyValue: Math.round(daily),
    cap,
    pendingDays: daily > 0 ? Math.round((pending / daily) * 10) / 10 : 0,
    full: cap > 0 && pending >= cap - 0.5,
    keeperBonus: b ? keeperBonus(state, b.lotId) : 0,
    lastCollected: b?.lastCollected ?? null,
    collector: state.career.machines[collectorKey] ? collectorKey : null,
    keepers: state.career.staff.filter((s) => s.job === 'keeper' && b && (s.lotId === 'all' || s.lotId === b.lotId)).map((s) => s.id),
    ...aboutFields('building', shelterId, b?.level || 0),
    animalAbout: aboutFields('animal', def.animal),
  };
}

// ── Points d'accroche ─────────────────────────────────────────────────────────────────────────

/** Début de saison : naissances des lapins (+1 par couple, clapier et 80 animaux au plus). */
function births(api) {
  const { state } = api;
  for (const a of CAREER_ANIMALS) {
    if (!a.breeding) continue;
    const n = state.investments[a.id] || 0;
    if (n < 2 || !state.career.buildings[a.shelter]) continue;
    const room = Math.min(shelterCapacity(state, a.shelter) - n, MAX_ANIMALS - animalCount(state));
    const born = Math.min(Math.floor(n / 2) * a.breeding.perPair, room);
    if (born <= 0) continue;
    state.investments[a.id] = n + born;
    api.push('animalBorn', { animalId: a.id, count: born, buildingId: a.shelter, total: n + born });
  }
  api.refreshLevel();
}

/** Aube : truffes (automne, hiver), dans la porcherie. */
function truffles(api, seasonId) {
  const { state } = api;
  for (const a of CAREER_ANIMALS) {
    if (!a.truffles || !a.truffles.seasons.includes(seasonId)) continue;
    const n = state.investments[a.id] || 0;
    const b = state.career.buildings[a.shelter];
    if (n <= 0 || !b) continue;
    const rng = api.rng('career');
    let count = 0;
    for (let k = 0; k < n; k++) if (rng.chance(a.truffles.chance)) count++;
    if (count === 0) continue;
    const amount = Math.round(count * a.truffles.value * (1 + keeperBonus(state, b.lotId)));
    const { added } = addPending(api, a.shelter, amount, seasonId);
    state.career.lifetime.truffles = (state.career.lifetime.truffles || 0) + count;
    api.push('truffleFound', { count, amount, stored: Math.round(added), buildingId: a.shelter });
  }
}

/** Aube, étape 9 : production dans les abris ; tonte et balades payées. */
function incomes(api, { seasonId, lastDayOfSeason, milkToDairy = [] }) {
  const { state } = api;
  const out = [];
  for (const shelterId of builtShelters(state)) {
    const a = animalOfShelter(shelterId);
    if (!a || !a.collect || a.truffles) continue;
    const n = state.investments[a.id] || 0;
    if (n <= 0) continue;
    const sent = milkToDairy.filter((m) => m.animalId === a.id).reduce((s, m) => s + m.count, 0);
    const units = Math.max(0, n - sent);
    const amount = Math.round(dailyValue(state, shelterId, seasonId, units));
    if (amount > 0) addPending(api, shelterId, amount, seasonId);
  }
  for (const a of CAREER_ANIMALS) {
    const n = state.investments[a.id] || 0;
    if (n <= 0) continue;
    const lotId = state.career.buildings[a.shelter]?.lotId;
    if (lastDayOfSeason && a.effects.shearing && a.effects.shearingSeasons?.includes(seasonId)) {
      out.push({ source: a.id, amount: Math.round(a.effects.shearing * n * (1 + keeperBonus(state, lotId))), owned: n, kind: 'shearing', key: 'animals' });
    }
    if (a.rides && a.rides.seasons.includes(seasonId) && state.career.buildings[a.rides.needs]) {
      out.push({ source: a.id, amount: a.rides.perDay * n, owned: n, kind: 'rides', key: 'guests' });
    }
  }
  return out;
}

function check(state) {
  const c = state.career;
  for (const id of builtShelters(state)) {
    const b = c.buildings[id];
    if (b.lastCollected !== null && b.lastCollected !== undefined && !Number.isInteger(b.lastCollected)) return `ramassage de ${id}`;
  }
  return null;
}

registerCareerExtension({
  id: 'animals',
  investments: CAREER_ANIMALS,
  flags: { collectAnimals: true },
  init(state) {
    ensureWork(state);
  },
  migrate(state) {
    ensureWork(state);
    for (const id of Object.keys(state.career.buildings)) {
      const b = state.career.buildings[id];
      if (b.pending === undefined) b.pending = 0;
      if (b.lastCollected === undefined) b.lastCollected = null;
    }
  },
  check,
  hooks: {
    seasonStart(api) {
      births(api);
    },
    dawnEvents(api, { seasonId }) {
      truffles(api, seasonId);
    },
    incomes,
  },
  actions(api) {
    return {
      collect: (buildingId) => collectShelter(api, buildingId, 'player'),
      /**
       * « Tout ramasser » : tous les abris (bouton, glisser sur plusieurs abris).
       * → { ok, total, amount (= total), count, byShelter: [{ buildingId, name, amount }] } ;
       *   rien à ramasser : { ok: false, reason, total: 0, amount: 0, count: 0, byShelter: [] }.
       */
      collectAll: () => {
        let amount = 0;
        const byShelter = [];
        for (const id of builtShelters(api.state)) {
          if (Math.round(api.state.career.buildings[id].pending || 0) <= 0) continue;
          const r = collectShelter(api, id, 'player', { all: true });
          if (r.ok) {
            amount += r.amount;
            const b = api.state.career.buildings[id];
            byShelter.push({ buildingId: id, name: BUILDINGS_BY_ID[id].levels[Math.max(0, (b?.level || 1) - 1)].name, amount: r.amount });
          }
        }
        if (!byShelter.length) return { ...api.fail('Rien à ramasser pour l\'instant.'), total: 0, amount: 0, count: 0, byShelter };
        return { ok: true, total: amount, amount, count: byShelter.length, byShelter };
      },
    };
  },
  queries(api) {
    return {
      /** Abris construits : animaux, production à ramasser, plafond, collecteur, soigneurs. */
      shelters: () => builtShelters(api.state).map((id) => shelterInfo(api.state, id, api.seasonId())),
      shelter: (id) => (api.state.career.buildings[id] && BUILDINGS_BY_ID[id]?.category === 'shelter' ? shelterInfo(api.state, id, api.seasonId()) : null),
    };
  },
});
