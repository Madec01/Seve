// Simulation du mode Carrière — comportement des robots pour l'équipe, les machines et les animaux (lot
// CORE-B). Module importé par tools/simulate-career.js (lot CORE-C) ; il ne joue que par l'API publique
// (game.actions.career.*, game.query.career.*).
//
//   import { staffDecisions, crewDay, automatedLots, crewSummary } from './sim-career-staff.js';
//   staffDecisions(game, me)            // appelé chaque jour par tools/simulate-career.js (en plus de ses envies
//                                       // « hire » / « machine ») : cheval pour tirer le semoir et la moissonneuse,
//                                       // niveaux 2 avec le tracteur, collecteurs, cueilleuse, château d'eau,
//                                       // employés sans affectation remis au travail
//   const gestures = crewDay(game, me, { strategy });   // robot complet autonome (ramassage, embauche, machines,
//                                       // congés) : à appeler une fois par jour, avant game.update(DAY_SECONDS)
//   automatedLots(game) → Set(lotId)   // terrains tenus par un jardinier ou par semoir + moissonneuse :
//                                      // le robot « casual » n'y fait plus de gestes (§ 13.1)
//   crewSummary(game) → { staff, wagesYear, fuelYear, machines, lostAnimals, collected }
//
// `me` : l'objet du robot (me.rnd() : tirages « humains », me.crew : mémoire de ce module, créée au besoin).
// Stratégies :
//   casual    ramasse un abri sur deux par jour (ceux qu'aucun soigneur ni collecteur ne couvre) ; embauche
//             un jardinier dès que possible pour le champ le moins bien tenu, puis un soigneur (≥ 2 abris),
//             un vendeur (grenier), un artisan (cour des ateliers) ; arroseurs, puis cheval + semoir +
//             moissonneuse (rang 3), collecteur du poulailler, tracteur et niveaux 2 (rang 4) ; met les
//             jardiniers en congé en hiver une année sur deux ;
//   optimal   ramasse tout chaque jour ; embauche et équipe les champs dès que c'est rentable (réserve de
//             2 saisons de charges + 14 jours de salaires) ; congés d'hiver des jardiniers sans serre ;
//   novice    ramasse un jour sur trois ; embauche sans regarder l'argent ; jamais de congé ;
//   idle      ne fait rien (l'équipe et les machines déjà là continuent seules) ;
//   automator comme optimal, sans ramasser à la main à partir de l'année 3 (soigneurs et collecteurs).

const FIELD_TYPES = ['field', 'greenhouse'];

function mem(me) {
  if (!me.crew) me.crew = { leaveYear: {}, hires: 0, bought: [] };
  return me.crew;
}

function seasonCharge(game) {
  return game.query.finance().nextBill.amount;
}

/** Réserve gardée avant un achat ou une embauche. */
function reserve(game, strategy) {
  const wages = game.query.career.candidates().wages || 0;
  if (strategy === 'novice') return 0;
  return 2 * seasonCharge(game) + 14 * (wages + 8) + (strategy === 'casual' ? 60 : 20);
}

/** Terrains tenus sans le joueur : jardinier affecté (ou « tous les champs »), ou semoir + moissonneuse. */
export function automatedLots(game) {
  const out = new Set();
  const lots = game.query.career.lots().filter((l) => l.bought && (FIELD_TYPES.includes(l.type) || l.type === 'orchard'));
  const staff = game.state.career.staff.filter((s) => s.job === 'gardener' && !s.onLeave);
  const all = staff.some((s) => s.lotId === 'all');
  for (const lot of lots) {
    if (all || staff.some((s) => s.lotId === lot.id)) out.add(lot.id);
    const keys = lot.machines || [];
    const has = (id) => keys.some((k) => k.startsWith(`${id}@`) && game.state.career.machines[k]?.on);
    if (lot.type === 'field' && has('seeder') && has('harvester')) out.add(lot.id);
    if (lot.type === 'orchard' && has('fruitPicker')) out.add(lot.id);
  }
  return out;
}

/** Abris que personne d'autre ne ramasse (ni soigneur ni collecteur). */
function unattendedShelters(game) {
  const staff = game.state.career.staff.filter((s) => s.job === 'keeper' && !s.onLeave);
  return game.query.career.shelters().filter((sh) => sh.collect && sh.pending > 0 && !sh.collector && !staff.some((s) => s.lotId === 'all' || s.lotId === sh.lotId));
}

function collect(game, me, strategy) {
  const c = game.state.career;
  let gestures = 0;
  let prob = 1;
  if (strategy === 'casual') prob = 0.5;
  else if (strategy === 'novice') prob = 1 / 3;
  else if (strategy === 'idle') prob = 0;
  else if (strategy === 'automator' && game.state.time.year >= 3) prob = 0;
  for (const sh of unattendedShelters(game)) {
    if (prob < 1 && me.rnd() >= prob) continue;
    if (game.actions.career.collect(sh.buildingId).ok) gestures++;
  }
  void c;
  return gestures;
}

/** Champ le moins bien tenu (le plus de parcelles non semées ou à arroser), sans jardinier. */
function neediestField(game) {
  const staffLots = new Set(game.state.career.staff.filter((s) => s.job === 'gardener').map((s) => s.lotId));
  let best = null;
  let bestScore = -1;
  for (const lot of game.query.career.lots()) {
    if (!lot.bought || !FIELD_TYPES.includes(lot.type) || staffLots.has(lot.id)) continue;
    const score = lot.plots.filter((i) => {
      const p = game.state.plots[i];
      return p.unlocked && (!p.cropId || !p.watered);
    }).length + lot.plots.length / 100;
    if (score > bestScore) {
      best = lot;
      bestScore = score;
    }
  }
  return best;
}

function hireOne(game, job, lotId) {
  const q = game.query.career.candidates();
  if (!q.canHire || !q.list.length) return false;
  // Métier conseillé d'abord, sinon le premier.
  const cand = q.list.find((c) => c.suggestedJob === job) || q.list[0];
  return game.actions.career.hire(cand.id, job, lotId).ok;
}

function staffing(game, me, strategy) {
  const c = game.state.career;
  const A = game.actions.career;
  const cap = game.query.career.candidates().capacity;
  if (strategy === 'idle') return 0;
  // Maison niv. 2 dès le rang 2 (embauche).
  if (c.rank >= 2 && c.buildings.house.level < 2 && game.state.money - 500 > reserve(game, strategy)) {
    if (A.upgradeBuilding('house').ok) return 3;
  }
  if (c.staff.length >= cap) return 0;
  if (strategy !== 'novice' && game.state.money < reserve(game, strategy) + 60) return 0;
  const has = (job) => c.staff.filter((s) => s.job === job).length;
  const field = neediestField(game);
  if (field && (has('gardener') === 0 || has('gardener') < game.query.career.lots().filter((l) => l.bought && FIELD_TYPES.includes(l.type)).length - (strategy === 'casual' ? 1 : 0))) {
    if (hireOne(game, 'gardener', field.id)) return 3;
  }
  const shelters = game.query.career.shelters().filter((s) => s.collect && s.count > 0);
  if (has('keeper') === 0 && shelters.length >= 2) {
    if (hireOne(game, 'keeper', 'all')) return 3;
  }
  if (has('seller') === 0 && c.buildings.storage && c.rank >= 3) {
    if (hireOne(game, 'seller', null)) return 3;
  }
  const yard = game.query.career.lots().find((l) => l.type === 'workshops' && l.buildings.length > 0 && !c.staff.some((s) => s.job === 'artisan' && s.lotId === l.id));
  if (yard && c.rank >= 3 && has('artisan') === 0) {
    if (hireOne(game, 'artisan', yard.id)) return 3;
  }
  return 0;
}

/** Envies de machines (dans l'ordre) : { id, place, level }. */
function machineWishes(game) {
  const c = game.state.career;
  const out = [];
  const fields = c.lots.filter((l) => l.type === 'field');
  for (const f of fields) out.push({ id: 'sprinklers', place: f.id, level: 1 });
  if (c.rank >= 3) {
    out.push({ kind: 'horse' });
    for (const f of fields) {
      out.push({ id: 'seeder', place: f.id, level: 1 });
      out.push({ id: 'harvester', place: f.id, level: 1 });
    }
    if (c.buildings.coop) out.push({ id: 'collector', place: 'coop', level: 1 });
    for (const o of c.lots.filter((l) => l.type === 'orchard')) out.push({ id: 'fruitPicker', place: o.id, level: 1 });
  }
  if (c.rank >= 4) {
    out.push({ id: 'tractor', place: null, level: 1 });
    for (const f of fields) {
      out.push({ id: 'sprinklers', place: f.id, level: 2 });
      out.push({ id: 'harvester', place: f.id, level: 2 });
      out.push({ id: 'seeder', place: f.id, level: 2 });
    }
  }
  if (c.rank >= 5) out.push({ id: 'waterTower', place: null, level: 1 });
  return out;
}

function horseWish(game, strategy) {
  const c = game.state.career;
  if ((game.state.investments.horse || 0) > 0) return { done: true };
  if (c.machines.tractor) return { done: true };
  const A = game.actions;
  if (!c.buildings.stable) {
    for (const lot of c.lots) {
      if (lot.type !== 'meadow' && lot.type !== 'yard') continue;
      const slot = (lot.slots || []).indexOf(null);
      if (slot < 0) continue;
      const opt = game.query.career.buildOptions(lot.id, slot).find((o) => o.buildingId === 'stable');
      if (!opt) continue;
      return { cost: opt.cost + 400, run: () => A.career.build(lot.id, slot, 'stable').ok && A.buyInvestment('horse') };
    }
    return { locked: true };
  }
  const inv = game.query.investments().find((i) => i.id === 'horse');
  return inv && inv.canBuy ? { cost: inv.nextCost, run: () => A.buyInvestment('horse') } : { locked: true };
  void strategy;
}

function machines(game, me, strategy) {
  if (strategy === 'idle') return 0;
  const c = game.state.career;
  const A = game.actions.career;
  for (const w of machineWishes(game)) {
    if (w.kind === 'horse') {
      const h = horseWish(game, strategy);
      if (h.done || h.locked) continue;
      if (game.state.money - h.cost < reserve(game, strategy)) return 0;
      h.run();
      return 3;
    }
    const key = w.place ? `${w.id}@${w.place}` : w.id;
    const m = c.machines[key];
    if (m && m.level >= w.level) continue;
    if (!m) {
      const cat = game.query.career.machineCatalog().find((x) => x.id === w.id);
      const place = cat?.places.find((p) => (p.place ?? null) === w.place);
      if (!place || (!place.canBuy && !/Pas assez/.test(place.reason || ''))) continue;
      if (game.state.money - cat.cost < reserve(game, strategy)) return 0;
      if (A.buyMachine(w.id, w.place).ok) return 3;
      continue;
    }
    const line = game.query.career.machine(key);
    if (!line || line.nextCost === null) continue;
    if (!line.canUpgrade && !/Pas assez/.test(line.reason || '')) continue;
    if (game.state.money - line.nextCost < reserve(game, strategy)) return 0;
    if (A.upgradeMachine(key).ok) return 3;
  }
  return 0;
}

/** Congés d'hiver des jardiniers (casual : une année sur deux ; optimal / automator : sans serre). */
function leaves(game, me, strategy) {
  const c = game.state.career;
  const cal = game.query.calendar();
  const m = mem(me);
  if (strategy === 'idle' || strategy === 'novice') return 0;
  const gardeners = c.staff.filter((s) => s.job === 'gardener');
  if (!gardeners.length) return 0;
  const hasGreenhouse = c.lots.some((l) => l.type === 'greenhouse');
  if (cal.seasonId === 'winter' && cal.dayOfSeason === 1 && !gardeners.some((s) => s.onLeave)) {
    if (m.leaveYear[game.state.time.year] === undefined) m.leaveYear[game.state.time.year] = strategy === 'casual' ? me.rnd() < 0.5 : !hasGreenhouse;
    if (!m.leaveYear[game.state.time.year]) return 0;
    for (const s of gardeners) if (s.lotId !== 'all' || !hasGreenhouse) game.actions.career.setLeave(s.id, true);
    return 2;
  }
  if (cal.seasonId === 'spring' && gardeners.some((s) => s.onLeave)) {
    for (const s of gardeners) if (s.onLeave) game.actions.career.setLeave(s.id, false);
    return 2;
  }
  return 0;
}

/** Employés sans métier ou sans terrain (ex. terrain réaménagé) : remis au travail. */
function assignIdle(game) {
  let n = 0;
  for (const s of game.state.career.staff) {
    if (s.job && s.lotId) continue;
    const job = s.job || s.suggestedJob || 'gardener';
    const line = game.query.career.staffMember(s.id);
    const lots = line?.assignable.find((a) => a.job === job)?.lots || [];
    const field = job === 'gardener' ? neediestField(game) : null;
    const lotId = field ? field.id : lots.find((l) => l.lotId === 'all')?.lotId || lots[0]?.lotId || null;
    if (lotId && game.actions.career.assign(s.id, job, lotId).ok) n++;
  }
  return n;
}

/**
 * Décisions d'équipe et de machines en plus des envies du simulateur (CORE-C) : `me.strategy` ou
 * `me.profile` donne la prudence. Aucun geste compté (décisions de gestion).
 */
export function staffDecisions(game, me) {
  if (game.state.status !== 'playing' || game.state.mode !== 'career') return 0;
  mem(me);
  const strategy = me.strategy || 'casual';
  if (strategy === 'idle' && game.state.time.year >= 2) return 0;
  let n = assignIdle(game);
  n += machines(game, me, strategy === 'idle' ? 'casual' : strategy);
  return n;
}

/** Une journée du robot pour l'équipe, les machines et les animaux. Renvoie le nombre de gestes. */
export function crewDay(game, me, { strategy = 'casual' } = {}) {
  if (game.state.status !== 'playing' || game.state.mode !== 'career') return 0;
  mem(me);
  let gestures = collect(game, me, strategy);
  gestures += leaves(game, me, strategy);
  if (strategy === 'casual' && me.rnd() > 0.5) return gestures; // achats un jour sur deux
  gestures += staffing(game, me, strategy);
  gestures += machines(game, me, strategy);
  return gestures;
}

/** Mesures de fin de simulation (année en cours). */
export function crewSummary(game) {
  const c = game.state.career;
  const w = c.work || {};
  return {
    staff: c.staff.length,
    levels: c.staff.map((s) => s.level),
    wagesYear: w.year?.wages || 0,
    fuelYear: w.year?.fuel || 0,
    machines: Object.keys(c.machines).length,
    lostAnimals: w.stats?.lostAnimals || 0,
    collected: w.stats?.collected || { player: 0, keeper: 0, collector: 0 },
    staffActions: w.stats?.staffActions || 0,
    machineActions: w.stats?.machineActions || 0,
  };
}
