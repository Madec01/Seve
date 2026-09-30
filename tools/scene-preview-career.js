// Aperçu de la scène — mode Carrière (outil de développement, importé par scene-preview.js si ?career=1).
//
// Construit une vraie carrière (createCareer) à différents stades en passant par les actions du jeu
// (achats de terrains, aménagements, bâtiments, machines, embauches), argent et rang forcés, puis
// ajoute à la main ce que les tirages ne donnent pas tout de suite (fêtes, corbeaux, visiteurs, Joseph).
//
// Paramètres d'URL (en plus de ceux de scene-preview.js) :
//   career=1  stage=start|1|3|8|12|manor  (manor = 12 terrains, maison niv. 5, rang 6)
//   event=seed|village|harvest|christmas|rainbow|tourists|crows|visitor|merchant|pet|joseph|all
//   staff=0..8 (défaut selon le stade)  sim=secondes de jeu à dérouler (employés et machines au travail)
//   pets=1  focus=<lotId>|house|field  crops=0 (champs vides)
// window.preview.career expose { stage(n), event(id), sim(s), lots(), focus(id) } pour les scripts.

import { createCareer } from '../src/core/career/career.js';
import { CROPS } from '../src/data/crops.js';

let drawCandidates = null;
try {
  ({ drawCandidates } = await import('../src/core/career/staff.js'));
} catch (e) {
  console.warn('Employés (CORE-B) indisponibles :', e.message);
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const LOT_ORDER = ['field', 'meadow', 'orchard', 'workshops', 'field', 'greenhouse', 'meadow', 'pond', 'meadow', 'field', 'workshops', 'orchard'];
const SLOT_PLAN = {
  yard: [null, 'guestHouse'],
  meadow1: ['sheepfold', 'cowshed'],
  meadow2: ['pigsty', 'hutch'],
  meadow3: ['stable', 'goatShed'],
  workshops1: ['jamWorkshop', 'dairy'],
  workshops2: ['mill', null],
};

function makeRng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), chance: (p) => next() < p, pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

const log = [];
function tryAct(label, res) {
  if (!res || !res.ok) log.push(`${label} : ${res ? res.reason : 'absent'}`);
  return res;
}

/**
 * Nouvelle carrière au stade voulu.
 * @param opts { seed, stage: 'start'|'1'|'3'|'8'|'12'|'manor', season, staff, crops, farmName }
 */
export function buildCareerGame(opts = {}) {
  const seed = Number(opts.seed) || 7;
  const rng = makeRng(seed * 31 + 5);
  const game = createCareer({ seed, farmName: opts.farmName || 'Ferme des Tilleuls', farmerGender: opts.female ? 'fermiere' : 'fermier' });
  const st = game.state;
  const A = game.actions.career;
  const stage = String(opts.stage || 'start');
  const nLots = stage === 'manor' ? 12 : Math.max(0, Math.min(12, Number(stage) || 0));
  const rich = () => { st.money = 1e7; };
  rich();
  st.career.rank = nLots >= 12 ? 6 : nLots >= 8 ? 5 : nLots >= 3 ? 4 : nLots >= 1 ? 2 : 1;
  game.refreshLevel?.();
  log.length = 0;

  // Terrains et aménagements
  const byType = {};
  for (let k = 0; k < nLots; k++) {
    rich();
    const r = tryAct('buyLot', A.buyLot());
    if (!r?.ok) break;
    const type = LOT_ORDER[k];
    tryAct(`developLot ${r.lotId} ${type}`, A.developLot(r.lotId, type));
    (byType[type] ||= []).push(r.lotId);
  }
  // Bâtiments de la maison
  const houseLevel = stage === 'manor' ? 5 : nLots >= 8 ? 4 : nLots >= 3 ? 2 : 1;
  for (let l = 2; l <= houseLevel; l++) { rich(); tryAct('house', A.upgradeBuilding('house')); }
  const storageLevel = stage === 'manor' ? 3 : nLots >= 8 ? 2 : nLots >= 3 ? 1 : 0;
  for (let l = 1; l <= storageLevel; l++) { rich(); tryAct('storage', A.upgradeBuilding('storage')); }
  const standLevel = stage === 'manor' ? 3 : nLots >= 8 ? 2 : nLots >= 1 ? 1 : 0;
  for (let l = 1; l <= standLevel; l++) { rich(); tryAct('stand', A.upgradeBuilding('roadsideStand')); }
  // Emplacements : abris, chambre d'hôte, ateliers
  const place = (lotId, plan, maxLevel) => {
    plan.forEach((bid, slot) => {
      if (!bid || !lotId) return;
      rich();
      const res = tryAct(`build ${bid}`, A.build(lotId, slot, bid));
      if (!res?.ok) return;
      for (let l = 2; l <= maxLevel; l++) { rich(); tryAct(`upgrade ${bid}`, A.upgradeBuilding(bid)); }
    });
  };
  const lvl = stage === 'manor' ? 3 : nLots >= 8 ? 2 : 1;
  if (nLots >= 3) place('yard', SLOT_PLAN.yard, lvl);
  place(byType.meadow?.[0], SLOT_PLAN.meadow1, lvl);
  place(byType.meadow?.[1], SLOT_PLAN.meadow2, lvl);
  place(byType.meadow?.[2], SLOT_PLAN.meadow3, lvl);
  place(byType.workshops?.[0], SLOT_PLAN.workshops1, stage === 'manor' ? 5 : 2);
  place(byType.workshops?.[1], SLOT_PLAN.workshops2, stage === 'manor' ? 4 : 1);
  if (byType.greenhouse && stage === 'manor') for (let l = 2; l <= 3; l++) { rich(); tryAct('greenhouse', A.upgradeBuilding('greenhouse')); }
  if (nLots >= 3 && lvl >= 2) { rich(); tryAct('coop', A.upgradeBuilding('coop')); }
  // Animaux : jusqu'à la capacité des abris
  for (const inv of game.query.investments()) {
    if (inv.category !== 'animal') continue;
    const cap = inv.max || 0;
    for (let k = inv.owned; k < cap; k++) {
      rich();
      if (!tryAct(`animal ${inv.id}`, game.actions.buyInvestment(inv.id))?.ok) break;
    }
  }
  // Ruches et panneaux solaires
  const hives = nLots >= 8 ? 6 : nLots >= 3 ? 4 : nLots >= 1 ? 2 : 0;
  for (let k = 0; k < hives; k++) { rich(); if (!tryAct('beehive', game.actions.buyInvestment('beehive'))?.ok) break; }
  const solar = nLots >= 8 ? 4 : nLots >= 3 ? 2 : 0;
  for (let k = 0; k < solar; k++) { rich(); if (!tryAct('solar', game.actions.buyInvestment('solarPanel'))?.ok) break; }
  // Machines
  if (nLots >= 3 && A.buyMachine) {
    const buy = (id, placeId) => { rich(); return tryAct(`machine ${id}@${placeId}`, A.buyMachine(id, placeId)); };
    const up = (id, placeId) => { rich(); return tryAct(`upgrade ${id}@${placeId}`, A.upgradeMachine(id, placeId)); };
    buy('sprinklers', 'start');
    for (const f of byType.field || []) buy('sprinklers', f);
    if (nLots >= 8) {
      buy('tractor');
      for (const f of (byType.field || []).slice(0, 2)) {
        buy('seeder', f);
        buy('harvester', f);
      }
      buy('seeder', 'start');
      buy('harvester', 'start');
      for (const o of byType.orchard || []) buy('fruitPicker', o);
      buy('collector', 'coop');
      buy('collector', 'cowshed');
      if (byType.greenhouse) buy('sprinklers', byType.greenhouse[0]);
      if (stage === 'manor') {
        buy('waterTower');
        buy('conveyor');
        up('sprinklers', 'start');
        for (const f of byType.field || []) up('sprinklers', f);
        for (const f of (byType.field || []).slice(0, 2)) { up('seeder', f); up('harvester', f); }
      }
    }
  }
  // Employés
  const nStaff = Math.min(8, opts.staff !== undefined && opts.staff !== null ? Number(opts.staff) : stage === 'manor' ? 8 : nLots >= 8 ? 6 : nLots >= 3 ? 2 : 0);
  if (nStaff > 0 && drawCandidates && A.hire) {
    const gardenLots = ['start', ...(byType.field || []), ...(byType.orchard || []), ...(byType.greenhouse || [])];
    const jobs = [];
    for (let k = 0; k < nStaff; k++) {
      if (k === 2) jobs.push(['keeper', 'all']);
      else if (k === 5 && byType.workshops) jobs.push(['artisan', byType.workshops[0]]);
      else if (k === 6) jobs.push(['seller', 'home']);
      else jobs.push(['gardener', gardenLots[jobs.filter((j) => j[0] === 'gardener').length % gardenLots.length]]);
    }
    for (const [job, lotId] of jobs) {
      st.career.candidates = drawCandidates(st, rng);
      const cand = st.career.candidates[0];
      if (cand) tryAct(`hire ${job}`, A.hire(cand.id, job, lotId));
    }
  }
  // Saison, cultures
  if (opts.season !== undefined) st.time.seasonIndex = Number(opts.season) || 0;
  if (opts.crops !== false) fillCrops(game, rng);
  st.money = 5000 + nLots * 2000;
  game.refreshLevel?.();
  if (log.length) console.info(`[aperçu carrière] refus (${log.length}) :\n${log.join('\n')}`);
  return game;
}

/** Cultures au hasard : champs selon la saison, serre toutes cultures, verger en pommiers. */
export function fillCrops(game, rng = makeRng(3)) {
  const st = game.state;
  const season = SEASONS[st.time.seasonIndex] || 'spring';
  const known = new Set(game.level?.crops || []);
  const seasonal = CROPS.filter((c) => c.kind !== 'tree' && c.seasons.includes(season) && (known.size === 0 || known.has(c.id)));
  const any = CROPS.filter((c) => c.kind !== 'tree' && (known.size === 0 || known.has(c.id)));
  st.plots.forEach((p) => {
    if (!p.unlocked || !p.env) return;
    if (p.env === 'orchard') {
      p.cropId = 'apple';
      p.growth = rng.pick([2, 5, 6, 6, 6]);
      p.fruit = rng.pick([0, 1, 2, 3, 3]);
      return;
    }
    if (rng.next() < 0.12) { p.cropId = null; p.growth = 0; p.watered = false; return; }
    const pool = p.env === 'greenhouse' ? any : seasonal;
    if (!pool.length) return;
    const crop = rng.pick(pool);
    p.cropId = crop.id;
    p.growth = Math.min(crop.growDays, Math.floor(rng.next() * (crop.growDays + 2)));
    p.watered = rng.next() < 0.5;
  });
}

/** Fêtes et événements forcés pour l'aperçu. */
export function applyEvent(game, id) {
  const st = game.state;
  const c = st.career;
  c.events = c.events || { active: null, offers: [], calendarDone: [] };
  c.events.offers = c.events.offers || [];
  const all = id === 'all';
  const fest = { seed: ['seedFair', 0], village: ['villageFete', 1], harvest: ['harvestFestival', 2], christmas: ['christmasMarket', 3] };
  if (fest[id]) {
    c.events.today = fest[id][0];
    st.time.seasonIndex = fest[id][1];
  }
  if (id === 'rainbow' || all) c.events.active = { id: 'rainbow', kind: 'rainbow', day: 1, endDay: 1, data: {} };
  if (id === 'tourists') c.events.active = { id: 'tourists', kind: 'tourists', day: 1, endDay: 1, data: {} };
  if (id === 'crows' || all) {
    let n = 0;
    st.plots.forEach((p) => { if (n < 3 && p.cropId && p.env === 'field' && p.growth < 2) { p.crow = true; n++; } });
    if (!n) st.plots.forEach((p) => { if (n < 3 && p.unlocked && p.env === 'field') { p.crow = true; n++; } });
  }
  if (id === 'visitor' || all) c.events.offers.push({ id: 'offerP1', kind: 'visitor', day: 1, endDay: 3, accepted: false, delivered: 0, data: { name: 'Mme Leblanc', cropId: 'tomato', cropName: 'Tomate', n: 6 } });
  if (id === 'merchant' || all) c.events.offers.push({ id: 'offerP2', kind: 'merchant', day: 1, endDay: 1, accepted: false, delivered: 0, data: { itemId: 'fertilizer', name: 'Engrais', price: 150 } });
  if (id === 'pet') c.events.offers.push({ id: 'offerP3', kind: 'pet', day: 1, endDay: 1, accepted: false, delivered: 0, data: { petId: 'cat', name: 'Chaton' } });
  if (id === 'joseph' || all) c.quest = { id: 'questP', templateId: 'crop', type: 'crop', need: { type: 'crop', id: 'carrot', n: 8 }, progress: 0, accepted: false, offeredDay: 1, endDay: 7, reward: null };
}

/** Production en attente dans les abris (bulles de ramassage). */
export function fillPending(game, full = false) {
  for (const [id, b] of Object.entries(game.state.career.buildings)) {
    if (['coop', 'sheepfold', 'goatShed', 'cowshed', 'pigsty', 'hutch', 'stable', 'duckPond'].includes(id)) b.pending = full ? 90 : 12 + id.length * 3;
  }
}

/** Déroule `seconds` de jeu (employés et machines au travail). */
export function simulate(game, seconds, from = null) {
  const st = game.state;
  if (from !== null) st.time.elapsed = from;
  st.speed = 1;
  const step = 0.1;
  for (let t = 0; t < seconds; t += step) game.update(step);
}

export const careerLog = log;
