// Simulation du mode Carrière (docs/CARRIERE.md § 13). Joue des carrières par l'API publique seulement
// (createCareer, game.actions, game.query), N années, de façon déterministe : graine × stratégie ; les tirages
// « humains » ont leur propre flux (comme tools/simulate.js) et ne touchent jamais aux tirages du jeu.
//
//   node tools/simulate-career.js                        tous les robots, Détente, saisons de 7 jours, 20 × 10 ans
//   node tools/simulate-career.js --strategy casual --years 10 --runs 50
//   node tools/simulate-career.js --difficulty classique
//   node tools/simulate-career.js --season 14            saisons de 10 ou 14 jours
//   node tools/simulate-career.js --matrix               rangs par année : 7 / 10 / 14 jours × Détente / Classique
//   node tools/simulate-career.js --matrix --seasons 10 --difficulties detente --strategy casual,optimal   (une partie)
//   node tools/simulate-career.js --assume-objectives    objectifs « employés / quêtes / comice » supposés remplis
//   node tools/simulate-career.js --trace --seed 3       une carrière, année par année
//   node tools/simulate-career.js --json
//   node tools/simulate-career.js --surprises off        (lot 2) sans qualité, géants, surprises, météos spéciales, trouvailles
//   node tools/simulate-career.js --compare-surprises    (lot 2) sans / avec : revenu par année, rang médian, Domaine
//   node tools/simulate-career.js --variety off          (lot 3) sans tableau, cadeaux, charrette, défis, colporteur ni thèmes
//                                                        (--variety board,themes : seulement ces parties) ; défaut : avec
//   node tools/simulate-career.js --compare-variety      (lot 3) sans → avec : revenu par année, rang médian, Domaine,
//                                                        sollicitations par semaine, faillites, gains de la variété
//   node tools/simulate-career.js --cozy off             (lot 4) sans fêtes, hiver, lanternes ni « aider sans remplacer »
//                                                        (--cozy fetes,winter,lanterns : seulement ces parties) ; défaut : avec
//   node tools/simulate-career.js --compare-cozy         (lot 4) sans → avec tout le lot (revenu, rangs, Domaine, fêtes, hiver)
//   node tools/simulate-career.js --compare-f1           (lot 4) sans → avec « aider sans remplacer » (fêtes et hiver des deux
//                                                        côtés) : handsOff (bénéfice des ans 4 à 7), tranquille (revenu,
//                                                        rangs, Domaine, part à la main, gestes), automator, débutant
//   node tools/simulate-career.js --lanterns             (lot 4) lanternes de l'année par robot et par critère
//   node tools/simulate-career.js --valley off           (Vallée vivante) sans la Vallée (--valley seeds,wildlife : parties)
//   node tools/simulate-career.js --compare-valley2 --jobs 4   (Vallée V2) sans la Vallée → V1 seul → V1 + V2, même graine :
//                                                        revenu, rangs, argent en caisse (ans 10, 14, 18), dépenses du V2,
//                                                        nouveautés (ans 2-10, 6-10), collection, handsOff (docs/VALLEE.md
//                                                        § 16.12 ; robots : HERITAGE_STYLES, me.heritageRnd) ; --no-none :
//                                                        sans la colonne « sans la Vallée » ; --first-seed N
//   node tools/simulate-career.js --valley seeds,wildlife   (Vallée V2) le V1 seul
//   node tools/simulate-career.js --compare-valley       (Vallée vivante) sans → avec : revenu, rangs, Domaine, dépenses,
//                                                        nouveautés par saison, collection, gestes, handsOff, automator
//                                                        (docs/VALLEE.md § 12.7 ; robots : VALLEY_STYLES, me.valleyRnd)
//
// Robots (profils humains : budget de gestes par jour, comme tools/simulate.js ; « glisser » sur un terrain :
// 1 geste + 0,25 par parcelle, « semer partout » : 3 gestes par terrain, ramasser un abri : 1, chasser un
// corbeau : 1, répondre à une offre ou à Joseph : 2, un achat : 3, pêcher : 1) :
//   casual    joueur tranquille ×1 : 7 à 11 gestes par jour, un jour sur dix sans jouer ; tient à la main le champ
//             de départ et les champs sans employé ni machine ; ramasse un abri sur deux par jour ; achète d'après
//             une liste d'envies (terrain → champ, pré, ateliers, verger…) en gardant 2 saisons de charges ;
//             embauche un jardinier dès la maison niv. 2, puis soigneur, artisan, vendeur ; arroseurs, puis cheval
//             et semoir, puis moissonneuse, tracteur ; équipe en congé l'hiver une fois sur deux ; accepte 70 %
//             des quêtes et des visiteurs ; chasse 60 % des corbeaux ; regarde le comice une fois sur deux ;
//             grenier « cours bas », tout vendu au Marché de Noël.
//   novice    débutant : 4 à 8 gestes, arrosage partiel, achète sans regarder les charges, jamais de congé,
//             plan « même culture » partout, accepte la moitié des offres.
//   optimal   joueur appliqué mais humain : au plus 40 gestes par jour, tout en ordre de rentabilité, quêtes et
//             visiteurs acceptés quand c'est faisable, corbeaux toujours chassés, comice visé, plan de culture le
//             plus rentable ; délègue quand la ferme dépasse ce qu'il peut tenir (employés, machines).
//   idle      joue la 1re année comme casual, puis ne fait plus rien (ni geste ni achat).
//   automator comme optimal, mais aucun geste à partir de l'année 3 (seulement des décisions : achats,
//             embauches, plans, congés) : part « idle » de la fin de partie.
//   handsOff  (lot 4) le tranquille les ans 1 à 3, puis plus rien (ni geste, ni achat) : la ferme laissée seule.
// (lot 4) Avec « aider sans remplacer » (F1), le tranquille et le débutant récoltent d'abord à la main ce qui est mûr,
// terrain le plus mûr d'abord, dans leur budget de gestes (même là où travaillent l'équipe et les machines : elles
// attendent 2 à 4 aubes) ; les achats se font avant d'aller aux champs et ne coûtent pas de gestes de champ (correction
// du lot 4 : le robot ne s'agrandissait plus, faute de gestes) ; fêtes, hiver : COZY_STYLES de tools/simulate.js.
//
// Carte 2D (carrière v2) : l'appliqué achète le terrain proposé (colonne d'origine d'abord) ; les autres
// choisissent au hasard un terrain de la lisière (même prix). Quête « culture » acceptée : le premier champ la met
// dans son plan (le joueur lit la demande de Joseph). L'appliqué demande parfois un service à Joseph (askQuest).
// Rythme (paceSummary, imprimé avant les tableaux) : sollicitations par semaine (commandes, marchand, animal perdu,
// corbeaux, quêtes proposées par Joseph), réussite des quêtes et commandes acceptées, rappels, au plus ouvert.
//
// Un module du lot CORE-B, tools/sim-career-staff.js, peut fournir des décisions (embauche, machines) : s'il
// existe et exporte `staffDecisions(game, me)`, elles sont appliquées en plus des envies (voir loadStaffHelper).

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { migrateRipe } from '../src/core/career/handwork.js';
import { DAY_SECONDS } from '../src/data/balance.js';
import { getCrop, isTreeCrop } from '../src/data/crops.js';
import { RANKS } from '../src/data/career/ranks.js';
import { COZY_STYLES, HUMAN_PROFILES, parseCozy, parseVariety, sowRare, varietyChoices, varietyDay, cozyDay } from './simulate.js';
import { ALL_VARIETIES_BY_ID, NATURE_ITEMS_BY_ID, SPECIES_BY_ID } from '../src/data/career/valley.js';
import { SEED_LIBRARY } from '../src/data/career/heritage.js';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const ASSUMED_TYPES = ['staff', 'quests', 'contestsWon'];

/** --valley on | off | seeds,wildlife (parties). */
export function parseValley(value) {
  const v = String(value);
  if (['off', 'false', '0', 'non'].includes(v)) return false;
  if (['on', 'true', '1', 'oui'].includes(v)) return true;
  const parts = v.split(',');
  // (V2) « seeds,wildlife » : le V1 seul ; « seeds,wildlife,heritage » : tout.
  return { seeds: parts.includes('seeds'), wildlife: parts.includes('wildlife'), heritage: parts.includes('heritage') };
}
export const STRATEGIES = ['casual', 'novice', 'optimal', 'idle', 'automator', 'handsOff'];

// ── Profils ────────────────────────────────────────────────────────────────────────────────
const C = HUMAN_PROFILES.casual;
const N = HUMAN_PROFILES.novice;
export const CAREER_PROFILES = {
  casual: {
    taps: C.taps, skipDay: C.skipDay, harvestProb: C.harvestProb, maxDelay: C.maxDelay, plantProb: C.plantProb, water: C.water,
    avoidFreeze: C.avoidFreeze, rentAware: C.rentAware, buyProb: C.buyProb, buyBuffer: C.buyBuffer, reserveSeasons: 2,
    collectProb: 0.5, acceptVisitor: 0.7, acceptQuest: 0.7, chaseCrow: 0.6, fish: 0.5, winterLeave: 0.5, merchant: 0.3, pet: 0.5,
    contestAware: 0.5, plan: 'simple', hirePick: 'first', smart: false,
    // (lot 3) Variété : comme le joueur tranquille des niveaux (§ 16.10).
    boardLook: C.boardLook, keepOrder: C.keepOrder, requestBias: C.requestBias, cardPick: C.cardPick, challengePick: C.challengePick, rareBuy: C.rareBuy, merchantAny: 0,
    cozy: COZY_STYLES.casual,
  },
  novice: {
    taps: N.taps, skipDay: N.skipDay, harvestProb: N.harvestProb, maxDelay: N.maxDelay, plantProb: N.plantProb, water: N.water,
    avoidFreeze: N.avoidFreeze, rentAware: 0, buyProb: N.buyProb, buyBuffer: N.buyBuffer, reserveSeasons: 0,
    collectProb: 0.5, acceptVisitor: 0.5, acceptQuest: 0.5, chaseCrow: 0.4, fish: 0.3, winterLeave: 0, merchant: 0.5, pet: 0.8,
    contestAware: 0, plan: 'same', hirePick: 'first', smart: false, starter: true,
    boardLook: 0, keepOrder: 0, requestBias: 1, cardPick: 'first', challengePick: 'none', rareBuy: 0, merchantAny: N.merchantAny,
    cozy: COZY_STYLES.novice, todoHarvest: true,
  },
  optimal: {
    taps: [40, 40], skipDay: 0, harvestProb: 1, maxDelay: 0, plantProb: 1, water: [1, 1], avoidFreeze: 1, rentAware: 1,
    buyProb: 1, buyBuffer: [20, 20], reserveSeasons: 2, collectProb: 1, acceptVisitor: 1, acceptQuest: 1, chaseCrow: 1, fish: 1,
    winterLeave: 'smart', merchant: 'smart', pet: 1, contestAware: 1, plan: 'best', hirePick: 'best', smart: true, askQuest: 0.2,
    boardLook: 1, keepOrder: 1, requestBias: 2, cardPick: 'best', challengePick: 'best', rareBuy: 1, merchantAny: 0,
    cozy: COZY_STYLES.optimal,
  },
};
CAREER_PROFILES.idle = { ...CAREER_PROFILES.casual, idleFrom: 2 };
CAREER_PROFILES.automator = { ...CAREER_PROFILES.optimal, noGesturesFrom: 3 };
// (lot 4) La ferme laissée seule : le tranquille les ans 1 à 3, puis plus rien.
CAREER_PROFILES.handsOff = { ...CAREER_PROFILES.casual, idleFrom: 4 };

/** (lot 4) Décor posé par le joueur simulé (critère « beauté » des lanternes). */
const DECOR3 = { 'porch.left': 'flowers.red', 'porch.right': 'bench', 'yard.1': 'birdhouse' };
const DECOR6 = { ...DECOR3, 'yard.2': 'flowers.yellow', 'gate.left': 'scarecrow', 'gate.right': 'lamp' };
export const SIM_CAREER_DECOR = {
  casual: { decor: DECOR3 }, idle: { decor: DECOR3 }, handsOff: { decor: DECOR3 },
  novice: { decor: { 'porch.left': 'flowers.red' } },
  optimal: { decor: DECOR6, path: 'path.stone' }, automator: { decor: DECOR6, path: 'path.stone' },
};

// Plans de culture des champs (semoir, jardiniers).
const PLANS = {
  simple: { spring: 'potato', summer: 'tomato', autumn: 'cabbage', winter: 'turnip' },
  best: { spring: 'strawberry', summer: 'corn', autumn: 'pumpkin', winter: 'cabbage' },
  same: null,
};

// ── Joueur simulé ──────────────────────────────────────────────────────────────────────────
function humanRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function humanSeed(seed, strategy) {
  let h = 2166136261;
  for (const ch of `career/${seed}/${strategy}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const between = (rnd, [a, b]) => a + (b - a) * rnd();

function isMatureState(p) {
  const crop = p.cropId && getCrop(p.cropId);
  if (!crop) return false;
  if (crop.kind === 'tree') return (p.fruit || 0) >= crop.fruitDays - 1e-9;
  return p.growth >= crop.growDays - 1e-9;
}

/** Parcelles actives groupées par terrain (ordre des terrains : de bas en haut). */
function plotsByLot(game) {
  const by = new Map();
  game.state.plots.forEach((p, i) => {
    if (!p.env || !p.unlocked) return;
    if (!by.has(p.lot)) by.set(p.lot, []);
    by.get(p.lot).push(i);
  });
  return by;
}

function seasonCharge(game) {
  return game.query.finance().nextBill.amount;
}

// ── Délégation : qui s'occupe d'un terrain ────────────────────────────────────────────────
function hasMachine(game, id, lotId) {
  return !!game.state.career.machines[`${id}@${lotId}`];
}

function gardenerOn(game, lotId) {
  return game.state.career.staff.some((s) => s.job === 'gardener' && !s.onLeave && (s.lotId === lotId || s.lotId === 'all'));
}

function machineWorking(game, id, lotId) {
  const m = game.state.career.machines[`${id}@${lotId}`];
  if (!m || !m.on) return false;
  const line = game.query.career.machine ? game.query.career.machine(`${id}@${lotId}`) : null;
  return line ? line.working !== false : true;
}

// ── Achats ─────────────────────────────────────────────────────────────────────────────────
// kind : upgrade (bâtiment), item / animal (buyInvestment), lot (terrain + aménagement), build (emplacement),
// hire (métier, n employés de ce métier), machine (id, n : sur le n-ième terrain compatible), machineUp (id, level),
// plan (plans de culture posés), leave (rien : décision de saison).
const CASUAL_WISHES = [
  { kind: 'upgrade', id: 'roadsideStand', level: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'beehive', n: 2 },
  { kind: 'lot', type: 'workshops' },
  { kind: 'build', type: 'workshops', id: 'jamWorkshop' },
  { kind: 'build', type: 'workshops', id: 'mill' },
  { kind: 'upgrade', id: 'storage', level: 1 },
  { kind: 'build', type: 'meadow', id: 'goatShed' },
  { kind: 'animal', id: 'goat', n: 3 },
  { kind: 'upgrade', id: 'house', level: 2 },
  { kind: 'hire', job: 'gardener', n: 1 },
  { kind: 'machine', id: 'sprinklers', n: 1 },
  { kind: 'upgrade', id: 'jamWorkshop', level: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'solarPanel', n: 1 },
  // (lot 4) la serre au rang 2 (500) : l'hiver vit plus tôt
  { kind: 'lot', type: 'greenhouse' },
  // rang 3
  { kind: 'build', type: 'workshops', id: 'dairy' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'cowshed' },
  { kind: 'animal', id: 'cow', n: 2 },
  { kind: 'machine', id: 'sprinklers', n: 2 },
  { kind: 'build', type: 'meadow', id: 'stable' },
  { kind: 'animal', id: 'horse', n: 1 },
  { kind: 'machine', id: 'seeder', n: 1 },
  { kind: 'upgrade', id: 'house', level: 3 },
  { kind: 'hire', job: 'keeper', n: 1 },
  { kind: 'upgrade', id: 'coop', level: 2 },
  { kind: 'animal', id: 'hen', n: 6 },
  { kind: 'lot', type: 'field' },
  { kind: 'hire', job: 'gardener', n: 2 },
  { kind: 'machine', id: 'harvester', n: 1 },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'guestHouse' },
  { kind: 'build', type: 'meadow', id: 'pigsty' },
  { kind: 'animal', id: 'pig', n: 2 },
  { kind: 'item', id: 'beehive', n: 4 },
  // (lot 4) la mare au rang 3 (300) : canards et pêche, aussi l'hiver (les canards : une espèce de plus, rang 5)
  { kind: 'lot', type: 'pond' },
  { kind: 'animal', id: 'duck', n: 2 },
  // rang 4
  { kind: 'lot', type: 'orchard' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'sheepfold' },
  { kind: 'animal', id: 'sheep', n: 2 },
  { kind: 'build', type: 'meadow', id: 'hutch' },
  { kind: 'animal', id: 'rabbit', n: 2 },
  { kind: 'upgrade', id: 'house', level: 4 },
  { kind: 'hire', job: 'artisan', n: 1 },
  { kind: 'machine', id: 'tractor', n: 1 },
  { kind: 'machine', id: 'sprinklers', n: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 2 },
  { kind: 'upgrade', id: 'roadsideStand', level: 2 },
  { kind: 'hire', job: 'gardener', n: 3 },
  { kind: 'machineUp', id: 'sprinklers', level: 2 },
  { kind: 'machine', id: 'seeder', n: 2 },
  { kind: 'machine', id: 'harvester', n: 2 },
  { kind: 'item', id: 'beehive', n: 6 },
  // rang 5
  { kind: 'upgrade', id: 'house', level: 5 },
  { kind: 'hire', job: 'seller', n: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'hire', job: 'gardener', n: 4 },
  { kind: 'machineUp', id: 'seeder', level: 2 },
  { kind: 'machineUp', id: 'harvester', level: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'upgrade', id: 'storage', level: 3 },
  // rang 6 (carte 2D : jusqu'à 16 terrains)
  { kind: 'lot', type: 'meadow' },
  { kind: 'lot', type: 'workshops' },
];

const OPTIMAL_WISHES = [
  { kind: 'upgrade', id: 'roadsideStand', level: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'item', id: 'beehive', n: 2 },
  { kind: 'item', id: 'solarPanel', n: 1 },
  { kind: 'lot', type: 'workshops' },
  { kind: 'build', type: 'workshops', id: 'jamWorkshop' },
  { kind: 'build', type: 'workshops', id: 'mill' },
  { kind: 'upgrade', id: 'jamWorkshop', level: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 1 },
  { kind: 'item', id: 'beehive', n: 4 },
  { kind: 'upgrade', id: 'house', level: 2 },
  { kind: 'machine', id: 'sprinklers', n: 1 },
  { kind: 'machine', id: 'sprinklers', n: 2 },
  { kind: 'hire', job: 'gardener', n: 1 },
  { kind: 'build', type: 'meadow', id: 'goatShed' },
  { kind: 'animal', id: 'goat', n: 3 },
  // (lot 4) la serre au rang 2
  { kind: 'lot', type: 'greenhouse' },
  // rang 3
  { kind: 'build', type: 'workshops', id: 'dairy' },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'cowshed' },
  { kind: 'animal', id: 'cow', n: 3 },
  { kind: 'build', type: 'meadow', id: 'stable' },
  { kind: 'animal', id: 'horse', n: 1 },
  { kind: 'machine', id: 'seeder', n: 1 },
  { kind: 'machine', id: 'harvester', n: 1 },
  { kind: 'upgrade', id: 'house', level: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'machine', id: 'sprinklers', n: 3 },
  { kind: 'hire', job: 'gardener', n: 2 },
  { kind: 'item', id: 'beehive', n: 6 },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'guestHouse' },
  { kind: 'build', type: 'meadow', id: 'pigsty' },
  { kind: 'animal', id: 'pig', n: 2 },
  { kind: 'hire', job: 'keeper', n: 1 },
  // (lot 4) la mare au rang 3
  { kind: 'lot', type: 'pond' },
  { kind: 'animal', id: 'duck', n: 2 },
  // rang 4
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'sheepfold' },
  { kind: 'animal', id: 'sheep', n: 3 },
  { kind: 'build', type: 'meadow', id: 'hutch' },
  { kind: 'animal', id: 'rabbit', n: 2 },
  { kind: 'machine', id: 'tractor', n: 1 },
  { kind: 'machineUp', id: 'sprinklers', level: 2 },
  { kind: 'upgrade', id: 'roadsideStand', level: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'storage', level: 2 },
  { kind: 'upgrade', id: 'house', level: 4 },
  { kind: 'hire', job: 'artisan', n: 1 },
  { kind: 'hire', job: 'gardener', n: 3 },
  { kind: 'machine', id: 'seeder', n: 2 },
  { kind: 'machine', id: 'harvester', n: 2 },
  { kind: 'item', id: 'solarPanel', n: 2 },
  { kind: 'lot', type: 'field' },
  // rang 5
  { kind: 'upgrade', id: 'house', level: 5 },
  { kind: 'hire', job: 'seller', n: 1 },
  { kind: 'machineUp', id: 'seeder', level: 2 },
  { kind: 'machineUp', id: 'harvester', level: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'lot', type: 'orchard' },
  { kind: 'upgrade', id: 'storage', level: 3 },
  // rang 6 (carte 2D : jusqu'à 16 terrains)
  { kind: 'lot', type: 'meadow' },
  { kind: 'lot', type: 'workshops' },
];

// Le novice : surtout des animaux et des champs, sans ordre ni calcul, jamais de congé.
const NOVICE_WISHES = [
  { kind: 'animal', id: 'hen', n: 4 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'roadsideStand', level: 1 },
  { kind: 'build', type: 'meadow', id: 'goatShed' },
  { kind: 'animal', id: 'goat', n: 2 },
  { kind: 'lot', type: 'workshops' },
  { kind: 'build', type: 'workshops', id: 'jamWorkshop' },
  { kind: 'upgrade', id: 'house', level: 2 },
  { kind: 'hire', job: 'gardener', n: 1 },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'cowshed' },
  { kind: 'animal', id: 'cow', n: 2 },
  { kind: 'machine', id: 'sprinklers', n: 1 },
  { kind: 'lot', type: 'field' },
  { kind: 'build', type: 'workshops', id: 'dairy' },
  { kind: 'upgrade', id: 'storage', level: 1 },
  { kind: 'upgrade', id: 'house', level: 3 },
  { kind: 'hire', job: 'keeper', n: 1 },
  { kind: 'build', type: 'meadow', id: 'pigsty' },
  { kind: 'animal', id: 'pig', n: 2 },
  { kind: 'lot', type: 'meadow' },
  { kind: 'build', type: 'meadow', id: 'stable' },
  { kind: 'animal', id: 'horse', n: 1 },
  { kind: 'machine', id: 'seeder', n: 1 },
  { kind: 'build', type: 'meadow', id: 'sheepfold' },
  { kind: 'animal', id: 'sheep', n: 2 },
  { kind: 'lot', type: 'field' },
  { kind: 'hire', job: 'gardener', n: 2 },
  { kind: 'machine', id: 'harvester', n: 1 },
  { kind: 'lot', type: 'orchard' },
  { kind: 'upgrade', id: 'house', level: 4 },
  { kind: 'hire', job: 'gardener', n: 3 },
  { kind: 'lot', type: 'field' },
  { kind: 'upgrade', id: 'house', level: 5 },
  { kind: 'hire', job: 'artisan', n: 1 },
  { kind: 'lot', type: 'field' },
];

const WISHES = { casual: CASUAL_WISHES, novice: NOVICE_WISHES, optimal: OPTIMAL_WISHES, idle: CASUAL_WISHES, automator: OPTIMAL_WISHES, handsOff: CASUAL_WISHES };

const TYPE_INFO = { field: { cost: 150, rank: 1 }, meadow: { cost: 120, rank: 1 }, orchard: { cost: 100, rank: 2 }, workshops: { cost: 100, rank: 2 }, greenhouse: { cost: 500, rank: 2 }, pond: { cost: 300, rank: 3 } };
function getTypeInfo(type) {
  return TYPE_INFO[type] || { cost: 0, rank: 9 };
}

function fieldLots(game) {
  return game.state.career.lots.filter((l) => l.type === 'field');
}

/** Terrain pour un nouveau jardinier : le champ le plus grand sans jardinier, sinon le verger, sinon « tous ». */
function gardenerTarget(game) {
  const lots = game.state.career.lots.filter((l) => ['field', 'orchard', 'greenhouse'].includes(l.type));
  const free = lots.filter((l) => !game.state.career.staff.some((s) => s.job === 'gardener' && s.lotId === l.id));
  // Les champs sans machine d'abord (les plus « à la main »), les plus récents (loin de la maison) d'abord.
  free.sort((a, b) => machineScore(game, a.id) - machineScore(game, b.id) || b.index - a.index);
  return free[0]?.id || 'all';
}

function machineScore(game, lotId) {
  return ['sprinklers', 'seeder', 'harvester'].filter((id) => hasMachine(game, id, lotId)).length;
}

function staffCount(game, job) {
  return game.state.career.staff.filter((s) => s.job === job).length;
}

/** Coût et faisabilité d'une envie : { done, cost, locked, run() }. */
function wishState(game, w, me) {
  const c = game.state.career;
  const A = game.actions;
  const Q = game.query.career;
  switch (w.kind) {
    case 'upgrade': {
      const b = Q.building(w.id);
      if (!b || b.level >= w.level) return { done: true };
      if (!b.canUpgrade && /Rang|Construisez|aménager/.test(b.reason || '')) return { locked: true };
      if (b.nextCost === null || b.nextCost === undefined) return { locked: true };
      return { cost: b.nextCost, run: () => A.career.upgradeBuilding(w.id) };
    }
    case 'item':
    case 'animal': {
      const inv = game.query.investments().find((i) => i.id === w.id);
      if (!inv) return { locked: true };
      if (inv.owned >= w.n) return { done: true };
      if (inv.canBuy) return { cost: inv.nextCost, run: () => A.buyInvestment(w.id) };
      if (inv.nextCost !== null && /Pas assez/.test(inv.reason || '')) return { cost: inv.nextCost, run: () => A.buyInvestment(w.id) };
      return { locked: true };
    }
    case 'lot': {
      const wanted = w.nth;
      const count = c.lots.filter((l) => l.index >= 3 && l.type === w.type).length;
      if (count >= wanted) return { done: true };
      const wild = c.lots.find((l) => l.type === 'wild');
      if (wild) {
        const t = Q.lotTypes(wild.id).find((x) => x.type === w.type);
        if (t && t.canDevelop) return { cost: t.cost, run: () => A.career.developLot(wild.id, w.type) };
        if (t && /Rang|Au plus/.test(t.reason || '')) return { locked: true };
        return { cost: t ? t.cost : 0, run: () => A.career.developLot(wild.id, w.type) };
      }
      // Carte 2D : l'appliqué prend le terrain proposé (colonne d'origine d'abord) ; les autres choisissent au
      // hasard parmi les terrains de la lisière (à gauche, à droite, au-dessus) : même prix, autre place.
      const sale = Q.lots().filter((l) => l.forSale && l.buyable);
      const next = me && !me.profile.smart && sale.length ? sale[Math.floor(me.rnd() * sale.length)] : Q.nextLot();
      if (!next || next.lockedByRank) return { locked: true };
      const typeInfo = getTypeInfo(w.type);
      if (typeInfo.rank > c.rank) return { locked: true };
      // « Le verger de Joseph » : le terrain devient un verger (déjà aménagé).
      if (next.special && w.type !== 'orchard') return { cost: next.price, run: () => A.career.buyLot(next.id) };
      return {
        cost: next.price + (next.special ? 0 : typeInfo.cost),
        run: () => {
          const r = A.career.buyLot(next.id);
          if (!r.ok) return r;
          if (r.lotType) return r;
          const d = A.career.developLot(r.lotId, w.type);
          if (d.ok && d.plots?.length && me) setLotPlan(game, me, r.lotId);
          return d;
        },
      };
    }
    case 'build': {
      if (c.buildings[w.id]) return { done: true };
      for (const lot of c.lots) {
        if (lot.type !== w.type && !(w.type === 'meadow' && lot.type === 'yard')) continue;
        const slot = (lot.slots || []).indexOf(null);
        if (slot < 0) continue;
        const opt = Q.buildOptions(lot.id, slot).find((o) => o.buildingId === w.id);
        if (!opt) continue;
        if (!opt.canBuild && /Rang/.test(opt.reason || '')) return { locked: true };
        return { cost: opt.cost, run: () => A.career.build(lot.id, slot, w.id) };
      }
      return { locked: true };
    }
    case 'hire': {
      if (staffCount(game, w.job) >= w.n) return { done: true };
      const cands = Q.candidates();
      if (!cands.canHire || !cands.list.length) return { locked: true };
      // Un salaire de plus : garder de quoi le payer une saison.
      const cand = me?.profile.hirePick === 'best' ? cands.list.reduce((a, b) => (b.level > a.level ? b : a)) : cands.list[0];
      const lotId = w.job === 'gardener' ? gardenerTarget(game) : w.job === 'keeper' ? 'all' : w.job === 'artisan' ? c.lots.find((l) => l.type === 'workshops')?.id : 'home';
      if (w.job === 'artisan' && !lotId) return { locked: true };
      return { cost: (cand.wage || 8) * c.seasonLength, spendless: true, run: () => A.career.hire(cand.id, w.job, lotId) };
    }
    case 'machine': {
      const cat = Q.machineCatalog().find((m) => m.id === w.id);
      if (!cat) return { locked: true };
      if (cat.scope === 'farm') {
        if (c.machines[w.id]) return { done: true };
        if (cat.lockedByRank) return { locked: true };
        return { cost: cat.cost, run: () => A.career.buyMachine(w.id) };
      }
      const owned = Object.values(c.machines).filter((m) => m && m.id === w.id).length;
      if (owned >= w.n) return { done: true };
      if (cat.lockedByRank) return { locked: true };
      const places = (cat.places || []).filter((p) => !p.owned);
      if (!places.length) return { locked: true };
      // Champ de départ puis les champs dans l'ordre ; seul un champ où la machine peut travailler.
      const place = places.find((p) => p.canBuy) || places.find((p) => /Pas assez/.test(p.reason || ''));
      if (!place) return { locked: true };
      return { cost: cat.cost, run: () => A.career.buyMachine(w.id, place.place) };
    }
    case 'machineUp': {
      const list = Q.machines().filter((m) => m.id === w.id && m.level < w.level);
      if (!Object.values(c.machines).some((m) => m && m.id === w.id)) return { locked: true };
      if (!list.length) return { done: true };
      const m = list[0];
      if (!m.canUpgrade && !/Pas assez/.test(m.reason || '')) return { locked: true };
      return { cost: m.nextCost, run: () => A.career.upgradeMachine(w.id, m.buildingId || m.lotId) };
    }
    default:
      return { locked: true };
  }
}

/** Numérote les envies « terrain » (n-ième terrain de ce type). */
function numberWishes(list) {
  const seen = {};
  return list.map((w) => (w.kind === 'lot' ? { ...w, nth: (seen[w.type] = (seen[w.type] || 0) + 1) } : w));
}

/** Achète la première envie pas encore faite (en gardant `reserve`) ; passe les envies verrouillées. */
function shop(game, me, reserve) {
  for (const w of me.wishes) {
    const s = wishState(game, w, me);
    if (s.done || s.locked) continue;
    if (game.state.money - s.cost < reserve) return false;
    const r = s.run();
    if (r && r.ok === false) continue;
    return true;
  }
  return false;
}

/** Plan de culture d'un champ selon le profil (avec un atelier de confitures : des fraises au printemps). */
function setLotPlan(game, me, lotId) {
  const base = PLANS[me.profile.plan];
  if (!base) return;
  const plan = { ...base };
  if (game.state.career.buildings.jamWorkshop) plan.spring = 'strawberry';
  // Comice : un champ par épreuve « culture » pas encore réussie (le joueur prépare le comice).
  const goals = contestCropGoals(game, me);
  if (goals.length) {
    const k = fieldLots(game).findIndex((l) => l.id === lotId);
    const cropId = k >= 0 && k < goals.length ? goals[k] : null;
    const crop = cropId && getCrop(cropId);
    if (crop) for (const sid of ['summer', 'autumn']) if (crop.seasons.includes(sid)) plan[sid] = cropId;
  }
  // Quête « culture » de Joseph acceptée : le premier champ la sème (le joueur lit la demande et ajuste son plan).
  const qc = questCrop(game);
  if (qc && fieldLots(game)[0]?.id === lotId) {
    const crop = getCrop(qc);
    if (crop) for (const sid of Object.keys(plan)) if (crop.seasons.includes(sid)) plan[sid] = qc;
  }
  for (const [sid, cropId] of Object.entries(plan)) {
    const ok = game.query.career.lot(lotId)?.plan;
    if (!ok) return;
    game.actions.career.setPlan(lotId, sid, game.level.crops.includes(cropId) ? cropId : 'same');
  }
  me.planned[lotId] = planKey(game, me);
}

function planKey(game, me) {
  return `${game.state.career.rank}/${game.state.career.buildings.jamWorkshop ? 'jam' : ''}/${contestCropGoals(game, me).join(',')}/${questCrop(game) || ''}`;
}

/** Culture d'une quête de Joseph acceptée et pas finie (ou null). */
function questCrop(game) {
  const q = game.state.career.quest;
  return q && q.accepted && q.type === 'crop' && q.progress < q.need.n ? q.need.id : null;
}

/** Cultures des épreuves du comice pas encore réussies (si le joueur s'y intéresse cette année). */
function contestCropGoals(game, me) {
  const k = game.state.career.contest;
  if (!me || !me.contestFocus || !k || k.judged || k.year !== game.state.time.year) return [];
  const info = game.query.career.contest();
  const out = [];
  for (const g of k.goals) {
    if (!g.cropIds) continue;
    if (info?.goals.find((x) => x.id === g.id)?.done) continue;
    out.push(g.cropIds[0]);
  }
  return out;
}

// ── Événements, quêtes, comice ─────────────────────────────────────────────────────────────
function priorityCrops(game, me) {
  const out = [];
  // Objectif « produits transformés » du Carnet : des cultures pour les ateliers (le joueur le lit).
  const wantsProducts = (game.query.career.summary().nextRank?.objectives || []).some((ob) => ob.id === 'products' && !ob.done);
  if (wantsProducts && me.rnd() < Math.max(0.5, me.profile.contestAware)) {
    for (const w of game.query.processing()) {
      if (!w.on || !w.places.some((x) => x === null)) continue;
      if (w.buildingId === 'jamWorkshop') out.push('strawberry');
      if (w.buildingId === 'mill') out.push('wheat');
    }
  }
  const q = game.state.career.quest;
  if (q && q.accepted && q.type === 'crop') out.push(q.need.id);
  for (const o of game.state.career.events.offers) if (o.kind === 'visitor' && o.accepted) out.push(o.data.cropId);
  // (lot 3) L'appliqué sème les cultures des commandes qu'il a gardées.
  if (me.profile.smart && game.state.variety) {
    for (const o of game.query.orders()?.slots || []) if (!o.empty && o.kept) for (const l of o.lines) if (l.left > 0) out.push(l.cropId);
  }
  if (me.contestFocus) {
    const k = game.query.career.contest();
    if (k && !k.judged) {
      for (const g of k.goals) {
        if (g.done) continue;
        const def = game.state.career.contest.goals.find((x) => x.id === g.id);
        if (def?.cropIds) out.push(...def.cropIds);
      }
    }
  }
  return out;
}

function handleEvents(game, me, spend) {
  const P = me.profile;
  const A = game.actions.career;
  const Q = game.query.career;
  const rnd = me.rnd;
  const ev = Q.events();
  // Offres (petite feuille : on la voit passer ; décider coûte 2 gestes).
  for (const o of ev.offers) {
    if (me.seenOffers.has(o.id)) {
      if (o.kind === 'visitor' && o.accepted && o.canDeliver && spend(1)) A.deliverOffer(o.id);
      continue;
    }
    me.seenOffers.add(o.id);
    if (!spend(2)) continue;
    if (o.kind === 'visitor') {
      let yes = rnd() < P.acceptVisitor;
      if (P.smart) {
        const growing = game.state.plots.filter((p) => p.cropId === o.data.cropId).length;
        yes = o.inStock + growing >= o.n;
      }
      if (yes) {
        A.acceptOffer(o.id);
        me.stats.visitorsAccepted++;
        if (o.inStock > 0) A.deliverOffer(o.id);
      } else A.declineOffer(o.id);
    } else if (o.kind === 'merchant') {
      const reserve = 2 * seasonCharge(game);
      let yes = P.merchant === 'smart' ? o.data.itemId !== 'beehive' || game.state.career.rank >= 2 : rnd() < P.merchant;
      if (game.state.money - o.price < reserve) yes = false;
      if (yes) A.acceptOffer(o.id);
      else A.declineOffer(o.id);
    } else if (o.kind === 'pet') {
      if (rnd() < P.pet) A.acceptOffer(o.id);
      else A.declineOffer(o.id);
    }
  }
  // Quête de Joseph.
  const q = Q.quest();
  if (q && !me.seenQuests.has(q.id)) {
    me.seenQuests.add(q.id);
    if (spend(2)) {
      let yes = rnd() < P.acceptQuest;
      if (P.smart) yes = q.type !== 'trees' || game.state.money > 300;
      if (yes) {
        A.acceptQuest();
        me.stats.questsAccepted++;
      } else A.declineQuest();
    }
  }
  if (q && q.accepted && q.canDeliver && spend(1)) A.deliverQuest();
  // Carnet → « Demander un service à Joseph » : seul le joueur appliqué le fait (le tranquille attend Joseph).
  if (!q && P.askQuest && Q.joseph().ask?.canAsk && rnd() < P.askQuest && spend(2)) A.askQuest();
  // Arbres demandés par Joseph (quête « pommiers ») : on les plante au verger.
  if (q && q.accepted && q.type === 'trees') {
    for (const [, list] of plotsByLot(game)) {
      if (game.state.plots[list[0]].env !== 'orchard') continue;
      if (spend(3)) orchardTrees(game, list, 0);
    }
  }
  // Corbeaux.
  for (const i of ev.crows) {
    if (rnd() >= P.chaseCrow) continue;
    if (!spend(1)) break;
    if (A.chaseCrow(i).ok) me.stats.crowsChased++;
  }
  // Pêche.
  if (ev.fishing.pond && !ev.fishing.fishedToday && rnd() < P.fish && spend(1)) A.fish();
}

function collectShelters(game, me, spend) {
  const Q = game.query.career;
  if (!Q.shelters) return;
  const shelters = Q.shelters().filter((s) => s.collect && s.pending > 0);
  shelters.sort((a, b) => b.pending - a.pending);
  for (const s of shelters) {
    // Un abri tenu par un soigneur ou un collecteur : on n'y va que s'il déborde.
    const delegated = s.collector || game.state.career.staff.some((x) => x.job === 'keeper' && !x.onLeave && (x.lotId === 'all' || x.lotId === s.lotId));
    if (delegated && !s.full) continue;
    if (me.rnd() >= (s.full ? 1 : me.profile.collectProb)) continue;
    if (!spend(1)) break;
    if (game.actions.career.collect(s.buildingId).ok) me.stats.collects++;
  }
}

// ── Gestes aux champs ──────────────────────────────────────────────────────────────────────
function pickCrop(game, i, { rnd, P, keep, priority, me }) {
  const cal = game.query.calendar();
  let options = game.query.plantableCrops(i).filter((o) => o.kind !== 'tree' && !o.rare && o.seedCost <= game.state.money - keep && cal.day < cal.totalDays);
  if (!options.length) return null;
  const safe = options.filter((o) => !o.willFreeze);
  for (const id of priority) {
    const o = safe.find((x) => x.id === id);
    if (o) return o;
  }
  if (P.smart) {
    options = safe;
    if (!options.length) return null;
    const score = (o) => (o.sellPrice * 1.1 - o.seedCost) / Math.max(1, o.daysToMature) + (o.product?.owned ? 2 : 0);
    return options.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
  if (rnd() < P.avoidFreeze) options = safe;
  if (!options.length) return null;
  if (P.starter) {
    const cheap = options.filter((o) => ['carrot', 'turnip'].includes(o.id));
    return cheap[0] || options.reduce((a, b) => (b.seedCost < a.seedCost ? b : a));
  }
  const wantsProducts = (game.query.career.summary().nextRank?.objectives || []).some((ob) => ob.id === 'products' && !ob.done);
  // (lot 3) × 2 les cultures demandées au tableau (si le joueur l'a regardé hier ou aujourd'hui).
  const wanted = me.wanted && me.wanted.day >= cal.day - 1 && P.requestBias > 1 ? me.wanted.crops : null;
  const weight = (o) => (1 / Math.sqrt(o.seedCost * o.daysToMature)) * (o.product?.owned ? (wantsProducts ? 6 : 2) : 1) * (wanted && wanted.has(o.id) ? P.requestBias : 1);
  const total = options.reduce((s, o) => s + weight(o), 0);
  let r = rnd() * total;
  for (const o of options) {
    r -= weight(o);
    if (r <= 0) return o;
  }
  return options[options.length - 1];
}

function orchardTrees(game, lotPlots, reserve) {
  for (const i of lotPlots) {
    if (game.state.plots[i].cropId) continue;
    if (!game.query.plantableCrops(i).some((o) => o.id === 'apple')) return;
    if (game.state.money < 45 + reserve) return;
    game.actions.plant(i, 'apple');
  }
}

/** Terrains que le joueur tient lui-même (ordre : sans aide d'abord). */
function tendOrder(game) {
  const out = [];
  for (const [lotId, list] of plotsByLot(game)) {
    const helped = gardenerOn(game, lotId);
    out.push({ lotId, list, env: game.state.plots[list[0]].env, helped, harvester: machineWorking(game, 'harvester', lotId), seeder: machineWorking(game, 'seeder', lotId) });
  }
  out.sort((a, b) => Number(a.helped) - Number(b.helped));
  return out;
}

function fieldWork(game, me, spend) {
  const P = me.profile;
  const cal = game.query.calendar();
  const lots = tendOrder(game);
  const priority = priorityCrops(game, me);
  // (lot 4, F1) L'équipe laisse la récolte au joueur : il récolte d'abord à la main, terrain le plus mûr d'abord.
  if (game.state.cozy?.parts?.helpers) {
    handHarvestFirst(game, me, spend, lots);
    return { lots, priority, cal };
  }
  // Récolte (glisser) : le jour même avec harvestProb, au plus tard après maxDelay jours.
  for (const L of lots) {
    if (L.harvester && !L.helped && L.env === 'field') continue; // la moissonneuse passe
    const toHarvest = [];
    for (const i of L.list) {
      const p = game.state.plots[i];
      if (!isMatureState(p)) {
        delete me.matureSince[i];
        continue;
      }
      if (me.matureSince[i] === undefined) me.matureSince[i] = me.day;
      if (me.day - me.matureSince[i] >= P.maxDelay || me.rnd() < P.harvestProb) toHarvest.push(i);
    }
    if (!toHarvest.length) continue;
    // Un terrain tenu par un jardinier : on ne l'aide que s'il reste des gestes.
    if (L.helped && !P.smart) continue;
    if (!spend(1)) break;
    for (const i of toHarvest) {
      if (!spend(0.25)) break;
      if (game.actions.harvest(i).ok) {
        delete me.matureSince[i];
        me.stats.handHarvests++;
      }
    }
  }
  return { lots, priority, cal };
}

/**
 * (lot 4, F1) Récolte à la main d'abord : tous les terrains (aidés ou non), le plus mûr d'abord (le plus de parcelles
 * mûres, puis celles qui attendent depuis le plus longtemps) ; le jour même avec harvestProb, au plus tard après maxDelay
 * jours (le débutant suit la ligne « À faire » des champs mûrs : tout ce qui est mûr, le plus mûr d'abord).
 */
function handHarvestFirst(game, me, spend, lots) {
  const P = me.profile;
  const plans = [];
  for (const L of lots) {
    const ripe = [];
    let waited = 0;
    for (const i of L.list) {
      const p = game.state.plots[i];
      if (!isMatureState(p)) {
        delete me.matureSince[i];
        continue;
      }
      if (me.matureSince[i] === undefined) me.matureSince[i] = me.day;
      const late = me.day - me.matureSince[i] >= P.maxDelay;
      if (P.todoHarvest || late || me.rnd() < P.harvestProb) ripe.push(i);
      waited += me.day - me.matureSince[i];
    }
    if (ripe.length) plans.push({ L, ripe, waited });
  }
  plans.sort((a, b) => b.ripe.length - a.ripe.length || b.waited - a.waited);
  for (const { ripe } of plans) {
    if (!spend(1)) break;
    for (const i of ripe) {
      if (!spend(0.25)) return;
      if (game.actions.harvest(i).ok) {
        delete me.matureSince[i];
        me.stats.handHarvests++;
      }
    }
  }
}

function sowAndWater(game, me, spend, { lots, priority, cal }) {
  const P = me.profile;
  const keep = cal.daysLeftInSeason <= 2 && me.rnd() < P.rentAware ? seasonCharge(game) : 0;
  for (const L of lots) {
    if (L.helped || L.seeder) continue;
    if (L.env === 'orchard') {
      if (L.list.some((i) => !game.state.plots[i].cropId) && spend(3)) orchardTrees(game, L.list, seasonCharge(game));
      continue;
    }
    let empty = L.list.filter((i) => !game.state.plots[i].cropId);
    if (!empty.length || me.rnd() >= P.plantProb || !spend(3)) continue;
    // (lot 3) Les graines rares d'abord (« semer partout » les utilise jusqu'au bout du sachet).
    if (game.state.variety && sowRare(game, empty) > 0) empty = empty.filter((i) => !game.state.plots[i].cropId);
    if (!empty.length) continue;
    const pick = pickCrop(game, empty[0], { rnd: me.rnd, P, keep, priority, me });
    if (!pick) continue;
    for (const i of empty) {
      if (game.state.money - pick.seedCost < keep) break;
      if (!game.actions.plant(i, pick.id).ok) break;
    }
  }
  // Arrosage partiel (glisser), terrain par terrain.
  for (const L of lots) {
    if (L.helped) continue;
    const thirsty = L.list.filter((i) => game.query.plot(i).action === 'water');
    if (!thirsty.length) continue;
    if (!spend(1)) break;
    const share = between(me.rnd, P.water);
    for (const i of thirsty) {
      if (me.rnd() >= share) continue;
      if (!spend(0.25)) break;
      game.actions.water(i);
    }
  }
}

// ── Décisions (sans geste) ─────────────────────────────────────────────────────────────────
function seasonalDecisions(game, me) {
  const P = me.profile;
  const cal = game.query.calendar();
  const A = game.actions.career;
  // Plans des champs (au changement de rang, d'atelier, d'épreuves du comice).
  for (const lot of fieldLots(game)) if (me.planned[lot.id] !== planKey(game, me)) setLotPlan(game, me, lot.id);
  const key = `${game.state.time.year}/${cal.seasonId}`;
  if (me.lastSeasonKey === key) return;
  me.lastSeasonKey = key;
  // Congés d'hiver.
  if (!game.state.career.staff.length) return;
  if (cal.seasonId === 'winter') {
    if (P.winterLeave === 'smart') {
      for (const s of game.state.career.staff) if (s.job === 'gardener' && !s.onLeave) A.setLeave(s.id, true);
    } else if (P.winterLeave > 0 && me.rnd() < P.winterLeave) A.setTeamLeave(true);
  } else if (cal.seasonId === 'spring') {
    if (game.state.career.staff.some((s) => s.onLeave)) A.setTeamLeave(false);
  }
}

function contestFocus(game, me) {
  const k = game.state.career.contest;
  const key = k ? `${k.year}` : null;
  if (key && me.contestKey !== key) {
    me.contestKey = key;
    me.contestFocus = me.rnd() < me.profile.contestAware;
  }
  // Épreuve « stock » : on garde au grenier.
  if (me.contestFocus && k && !k.judged && game.state.career.buildings.storage) {
    const stockGoal = k.goals.find((g) => g.type === 'stock');
    if (stockGoal) {
      const want = game.query.calendar().seasonId === 'autumn' && game.query.career.stock().used < stockGoal.target ? 'always' : 'low';
      if (game.state.career.storageMode !== want) game.actions.career.setStorageMode(want);
    }
  }
}

function sellStock(game, me) {
  const cal = game.query.calendar();
  const stock = game.query.career.stock();
  if (!stock.lines.length) return;
  const k = game.state.career.contest;
  const keepForContest = me.contestFocus && k && !k.judged && k.goals.some((g) => g.type === 'stock');
  if (me.profile.smart) {
    if (keepForContest) return;
    for (const line of stock.lines) if (line.multiplier >= 1.15 || line.offSeason || (cal.seasonId === 'winter' && cal.dayOfSeason === 4)) game.actions.career.sellStock(line.cropId);
    return;
  }
  // Tout vendu au Marché de Noël (hiver, jour 4), ou quand le grenier est plein.
  if ((cal.seasonId === 'winter' && cal.dayOfSeason === 4) || stock.used >= stock.capacity) game.actions.career.sellStock();
}

/** (lot 3) Visiteur unique de l'année à thème : son cadeau est accepté (grossiste : quand il y a un grenier plein). */
function themeVisitor(game, me) {
  const offers = game.query.career.events().offers.filter((o) => o.kind === 'themeVisitor');
  for (const o of offers) {
    if (o.data.gift === 'wholesale' && game.query.career.stock().used < 5 && o.daysLeft > 0) continue;
    game.actions.career.acceptOffer(o.id);
  }
  void me;
}


// ── (Vallée vivante, lot V1) Gestes et décisions de la Vallée ─────────────────────────────────
// docs/VALLEE.md § 12.4 : par l'API publique et un tirage propre (me.valleyRnd), pour que les autres décisions restent
// les mêmes avec ou sans la Vallée. Les gestes de la Vallée ont leur petit budget à part (ils s'ajoutent aux gestes du
// jour) : ouvrir un bocal 1, semer des graines anciennes 1 par terrain, observer une bête 1, cueillir une haie 0,5,
// poser un aménagement 1 (décision de boutique), une jachère 0,5.
// (V2) Le nichoir à chauves-souris après les berges (il n'existe qu'avec le V2 : sans lui, la liste du V1 est inchangée).
const NATURE_CASUAL = ['hedge', 'woodpile', 'strip', 'hedge', 'hedge', 'insectHotel', 'nestbox', 'owlbox', 'reeds', 'batbox', 'loneTree'];
const NATURE_OPTIMAL = ['hedge', 'woodpile', 'strip', 'insectHotel', 'hedge', 'owlbox', 'reeds', 'batbox', 'loneTree', 'hedge', 'nestbox', 'strip', 'hedge', 'woodpile', 'loneTree'];
export const VALLEY_STYLES = {
  casual: { jar: 0.5, sow: 1, observe: 0.7, finds: 0.5, fair: 0.5, fallowSpring: 0.3, fallowSummer: 0.3, natureEvery: 'season', natureProb: 1, natureFromRank: 2, order: NATURE_CASUAL, allFromRank: 5, fastFromRank: 6, plan: false, fields: 'start', budget: 3 },
  novice: { jar: 0.15, sow: 0.3, observe: 0.21, finds: 0.15, fair: 0.15, fallowSpring: 0.09, fallowSummer: 0.09, natureEvery: 'season', natureProb: 0.3, natureFromRank: 3, order: NATURE_CASUAL, allFromRank: 6, fastFromRank: 7, plan: false, fields: 'start', budget: 2 },
  optimal: { jar: 1, sow: 1, observe: 1, finds: 1, fair: 1, fallowSpring: 1, fallowSummer: 1, natureEvery: 'day', natureProb: 1, natureFromRank: 2, order: NATURE_OPTIMAL, allFromRank: 6, fastFromRank: 6, reserveSeasons: 4, plan: true, fields: 'tended', budget: 6 },
};
VALLEY_STYLES.idle = VALLEY_STYLES.casual;
VALLEY_STYLES.handsOff = VALLEY_STYLES.casual;
VALLEY_STYLES.automator = VALLEY_STYLES.optimal;

function valleyRng(me) {
  if (!me.valleyRnd) me.valleyRnd = humanRng((me.seedBase ?? 1) ^ 0x2545f491);
  return me.valleyRnd;
}

// (Vallée V2) docs/VALLEE.md § 16.12.5 : Grainothèque (un regard par saison ; appliqué : chaque jour), troc en attente
// (70 % des jours joués, une préférée ♥ une fois sur deux), paires semées avant les autres graines anciennes. Tirage
// propre (me.heritageRnd) : les décisions du V1 tirent les mêmes nombres avec ou sans le V2.
export const HERITAGE_STYLES = {
  casual: { library: 'season', maxLevel: 5, n1Reserve: 2, reserve: 4, n2Rank: 4, look: 1, troc: 0.7, fav: 0.5, pair: 1, pairsPerCrop: 1, fields: 'start', farmFirst: 3, planWithLibrary: true },
  novice: { library: 'season', maxLevel: 2, n1Rank: 4, n1Reserve: 2, reserve: 4, n2Rank: 4, look: 0.3, troc: 0.21, fav: 0.5, pair: 0.3, pairsPerCrop: 2, fields: 'start', farmFirst: 3 },
  optimal: { library: 'day', maxLevel: 5, n1Reserve: 4, reserve: 4, n2Rank: 4, look: 1, troc: 1, fav: 1, pair: 1, pairsPerCrop: 2, fields: 'tended' },
};
HERITAGE_STYLES.idle = HERITAGE_STYLES.casual;
HERITAGE_STYLES.handsOff = HERITAGE_STYLES.casual;
HERITAGE_STYLES.automator = HERITAGE_STYLES.optimal;

function heritageRng(me) {
  if (!me.heritageRnd) me.heritageRnd = humanRng((me.seedBase ?? 1) ^ 0x5bd1e995);
  return me.heritageRnd;
}

/** Le V2 est-il ouvert pour ce robot ? */
function heritageOpen(game) {
  const v = game.state.career.valley;
  return !!v?.started && v.parts.heritage !== false && v.parts.seeds !== false;
}

/** Grainothèque (décision de boutique, sans geste) : N1 au rang ≥ 3 avec 2 saisons de charges + 500 ; puis 4 saisons. */
function libraryDecision(game, me, natureFirst) {
  const HS = HERITAGE_STYLES[me.strategy];
  if (!HS || !heritageOpen(game)) return;
  const v = game.state.career.valley;
  const level = v.library?.level || 0;
  if (level >= HS.maxLevel) return;
  const cal = game.query.calendar();
  const key = HS.library === 'day' ? `${game.state.time.year}/${cal.day}` : `${game.state.time.year}/${cal.seasonId}`;
  if (me.libraryKey === key) return;
  // Les aménagements de sa liste passent d'abord (tant que celui de la saison n'est pas posé).
  if (natureFirst) return;
  const next = game.query.career.valley().library?.next;
  if (!next) return;
  const rank = game.state.career.rank;
  const needRank = level === 0 ? HS.n1Rank || next.rank : level === 1 ? Math.max(next.rank, HS.n2Rank) : next.rank;
  if (rank < needRank) return;
  const reserve = level === 0 ? HS.n1Reserve * seasonCharge(game) + 500 : HS.reserve * seasonCharge(game);
  if (game.state.money - next.price <= reserve) return;
  // La ferme d'abord (tranquille, débutant) : un niveau au-delà du premier seulement si le prochain achat de la ferme
  // (sa liste d'envies) reste payable après lui et si l'argent couvre trois fois son prix (`farmFirst`) — la
  // Grainothèque est « pour la beauté », avec l'argent qui dort.
  if (level >= 1 && HS.farmFirst) {
    const w = nextWishCost(game, me);
    if (w !== null && (game.state.money - next.price - w < reserve || game.state.money < HS.farmFirst * next.price)) return;
  }
  me.libraryKey = key;
  if (heritageRng(me)() >= HS.look) return;
  if (game.actions.career.buildSeedLibrary().ok) me.valleyStats.library = (me.valleyStats.library || 0) + 1;
}

/** Prix du prochain achat de la liste d'envies de la ferme (null : rien à acheter). */
function nextWishCost(game, me) {
  for (const w of me.wishes) {
    const st = wishState(game, w, me);
    if (st.done || st.locked) continue;
    return Number.isFinite(st.cost) ? st.cost : null;
  }
  return null;
}

/** Troc en attente : fait 70 % des jours joués (2 gestes) ; une préférée une fois sur deux, sinon la première sauvée. */
function trocGesture(game, me, tap) {
  const HS = HERITAGE_STYLES[me.strategy];
  const v = game.state.career.valley;
  if (!HS || !heritageOpen(game) || !v.troc) return;
  const rnd = heritageRng(me);
  if (rnd() >= HS.troc) return;
  const info = game.query.career.valley().troc;
  if (!info || !info.gifts.length) return;
  const fav = info.gifts.find((g) => g.fav);
  const pick = fav && rnd() < HS.fav ? fav : info.gifts.find((g) => !g.fav) || info.gifts[0];
  if (!tap(2)) return;
  game.actions.career.swapSeeds(pick.varietyId);
}

/**
 * Paires : avant les autres graines anciennes, sur le champ de départ (tranquille) ou les terrains tenus à la main
 * (appliqué), quand une variété du village est en main et que son croisement n'est pas trouvé (la graine du pays
 * s'achète si elle est sauvée). Un geste par terrain.
 */
function heritagePairs(game, me, targets) {
  const HS = HERITAGE_STYLES[me.strategy];
  if (!HS || !heritageOpen(game)) return 0;
  const rnd = heritageRng(me);
  if (rnd() >= HS.pair) return 0;
  const v = game.state.career.valley;
  const links = game.query.career.valleyCrossLinks();
  let taps = 0;
  for (const L of targets) {
    let sown = false;
    for (const x of game.query.career.valley().crosses) {
      if (x.found || !x.canPair) continue;
      if (!v.varieties[x.parents[1].varietyId]) continue;
      const growing = links.filter((l) => l.cropId === x.cropId).length;
      if (growing >= HS.pairsPerCrop) continue;
      const spot = game.query.career.valleyPairPlots(x.cropId).find((s) => L.list.includes(s.plotIndex) && L.list.includes(s.partnerPlot));
      if (!spot) continue;
      const crop = game.query.plantableCrops(spot.plotIndex).find((r) => r.id === x.cropId);
      if (crop?.willFreeze) continue;
      if (game.actions.career.sowPair(spot.plotIndex, x.cropId).ok) {
        sown = true;
        links.push({ cropId: x.cropId });
      }
    }
    if (sown) taps += 1;
  }
  return taps;
}

/** Variétés fixées → plan de culture (appliqué) : la variété de la culture prévue, si elle est sauvée. */
function valleyPlans(game) {
  const v = game.state.career.valley;
  if (!v?.started) return;
  const fixed = Object.entries(v.varieties).filter(([, e]) => e.fixedAt).map(([id]) => id);
  if (!fixed.length) return;
  // Seulement les traits qui paient la graine × 1,25 (savoureuse, précoce, géante, rustique ; V2 : parfumée) : l'appliqué
  // calcule. Une croisée (deux traits) passe avant la variété de sa culture.
  const PAY = ['tasty', 'early', 'giant', 'hardy', 'scented'];
  const pays = (x) => (x.traits || [x.trait]).some((t) => PAY.includes(t.id));
  const rows = game.query.career.valley().varieties.filter((x) => fixed.includes(x.id) && !x.tree && pays(x));
  rows.sort((a, b) => (a.group === 'cross' ? 1 : 0) - (b.group === 'cross' ? 1 : 0));
  const crops = Object.fromEntries(rows.map((x) => [x.cropId, x.id]));
  for (const lot of game.state.career.lots) {
    if (!lot.plan) continue;
    for (const [sid, want] of Object.entries(lot.plan)) {
      if (typeof want !== 'string' || want.startsWith('heirloom:') || want === 'same') continue;
      const id = crops[want];
      if (id) game.actions.career.setPlan(lot.id, sid, `heirloom:${id}`);
    }
  }
}

/** Aménagement suivant voulu (dans l'ordre du profil ; après allFromRank : tout ce qui est libre). */
function nextNatureWish(game, me, VS) {
  const v = game.state.career.valley;
  const counts = {};
  for (const n of Object.values(v.nature)) counts[n.kind] = (counts[n.kind] || 0) + 1;
  const seen = {};
  for (const kind of VS.order) {
    seen[kind] = (seen[kind] || 0) + 1;
    if ((counts[kind] || 0) >= seen[kind]) continue;
    const spot = game.query.career.valleySpots(kind).find((x) => x.free && !/Rang|grenier|mare/.test(x.reason || ''));
    if (spot) return spot;
  }
  if (game.state.career.rank >= VS.allFromRank) return game.query.career.valleySpots().find((x) => x.free && !/Rang|grenier|mare/.test(x.reason || '')) || null;
  return null;
}

/** Décisions et gestes de la Vallée avant les champs (bocal, bête, cueillette, foire, aménagement, jachère). */
function valleyMorning(game, me, P, noGestures) {
  const VS = VALLEY_STYLES[me.strategy];
  const v = game.state.career.valley;
  if (!VS || !v?.started) return 0;
  const rnd = valleyRng(me);
  const A = game.actions.career;
  let taps = 0;
  const budget = noGestures ? 0 : VS.budget;
  const tap = (n) => {
    if (taps + n > budget + 1e-9) return false;
    taps += n;
    return true;
  };
  const cal = game.query.calendar();
  if (!noGestures) {
    // Bocal (un jour sur deux), bête venue, cueillette des haies, étal de la foire.
    if (v.jars.opened < game.state.career.heirlooms.length && rnd() < VS.jar && tap(1)) A.openJar();
    for (const [id, e] of Object.entries(v.species)) if (e.state === 'visible' && rnd() < VS.observe && tap(1)) A.observe(id);
    for (const f of [...v.finds]) if (rnd() < VS.finds && tap(0.5)) A.pickHedgeFind(f.id);
    const fair = v.fair && v.fair.year === game.state.time.year && !v.fair.bought && v.fair.varietyId && cal.seasonId === 'winter' && cal.daysLeftInSeason === 0;
    if (fair && rnd() < VS.fair && game.state.money - v.fair.price > 2 * seasonCharge(game) && tap(1)) A.buyFairHeirloom();
    // (V2) Troc en attente (tirage propre).
    if (v.parts.heritage !== false) trocGesture(game, me, tap);
    // Jachère fleurie : décidée au début du printemps (et de l'été), posée dès qu'une parcelle de champ tenue à la main
    // est vide pendant la saison.
    if (cal.seasonId === 'spring' || cal.seasonId === 'summer') {
      const key = `${game.state.time.year}/${cal.seasonId}`;
      if (me.fallowKey !== key) {
        me.fallowKey = key;
        me.fallowWant = rnd() < (cal.seasonId === 'spring' ? VS.fallowSpring : VS.fallowSummer);
      }
      if (me.fallowWant && cal.daysLeftInSeason > 1) {
        const fields = new Set(game.state.career.lots.filter((l) => l.type === 'field' && !game.state.career.staff.some((x) => x.job === 'gardener' && (x.lotId === l.id || x.lotId === 'all'))).map((l) => l.id));
        const i = game.state.plots.findIndex((p) => fields.has(p.lot) && p.unlocked && p.env === 'field' && !p.cropId && p.fallow === undefined);
        if (i >= 0 && tap(0.5) && A.sowFallow(i).ok) me.fallowWant = false;
      }
    }
  }
  // Aménagement nature (décision de boutique : sans geste de champ) : un par saison (tranquille), un par jour (appliqué).
  if (game.state.career.rank >= VS.natureFromRank) {
    // Tranquille : un par saison (sa liste, puis à partir du rang 5 ce qui est libre), deux par saison au rang 6 ;
    // appliqué : un par jour (réserve de 4 saisons de charges).
    const half = Math.max(1, Math.floor(game.state.career.seasonLength / 2));
    const key = VS.natureEvery === 'day' ? `${game.state.time.year}/${cal.day}` : game.state.career.rank >= VS.fastFromRank ? `${game.state.time.year}/${cal.seasonId}/${Math.floor((cal.dayOfSeason - 1) / half)}` : `${game.state.time.year}/${cal.seasonId}`;
    if (me.natureKey !== key) {
      const spot = nextNatureWish(game, me, VS);
      if (spot && game.state.money - spot.price > (VS.reserveSeasons || 2) * seasonCharge(game) + 50) {
        me.natureKey = key;
        if (rnd() < VS.natureProb && A.placeNature(spot.spotId).ok) me.valleyStats.placed++;
      }
    }
  }
  // (V2) Grainothèque : après l'aménagement de la saison (sa liste passe d'abord).
  if (v.parts.heritage !== false) {
    const half = Math.max(1, Math.floor(game.state.career.seasonLength / 2));
    const natureKeyNow = VS.natureEvery === 'day' ? `${game.state.time.year}/${cal.day}` : game.state.career.rank >= VS.fastFromRank ? `${game.state.time.year}/${cal.seasonId}/${Math.floor((cal.dayOfSeason - 1) / half)}` : `${game.state.time.year}/${cal.seasonId}`;
    const natureFirst = game.state.career.rank >= VS.natureFromRank && me.natureKey !== natureKeyNow && !!nextNatureWish(game, me, VS) && VS.natureEvery !== 'day';
    libraryDecision(game, me, natureFirst);
  }
  // (V2) Le tranquille, avec la Grainothèque (son étagère montre la collection), met aussi au plan de culture ses variétés
  // sauvées dont un trait paie la graine (comme l'appliqué).
  if (VS.plan || (v.parts.heritage !== false && HERITAGE_STYLES[me.strategy]?.planWithLibrary && (v.library?.level || 0) >= 1)) valleyPlans(game);
  return taps;
}

/** Semis à la main des graines anciennes (avant « semer partout ») : champ de départ (tranquille) ou terrains tenus. */
function valleySowing(game, me, P, lots) {
  const VS = VALLEY_STYLES[me.strategy];
  const v = game.state.career.valley;
  if (!VS || !v?.started || !v.parts.seeds) return 0;
  const rnd = valleyRng(me);
  let taps = 0;
  const targets = VS.fields === 'start' ? lots.filter((L) => L.lotId === 'start') : lots.filter((L) => !L.helped && L.env !== 'orchard');
  // (V2) Les paires d'abord (tirage propre, leur propre chance).
  if (v.parts.heritage !== false) taps += heritagePairs(game, me, targets);
  if (rnd() >= VS.sow) return taps;
  // (V2) Une variété du village dont le croisement n'est pas trouvé garde ses graines pour les paires.
  const keepForPair = (id) => v.parts.heritage !== false && ALL_VARIETIES_BY_ID[id]?.group === 'village' && !v.crosses?.[ALL_VARIETIES_BY_ID[id].cropId]?.foundAt && ALL_VARIETIES_BY_ID[id].cropId !== 'apple';
  const withSeeds = Object.entries(v.seeds).filter(([id, n]) => n > 0 && !keepForPair(id)).map(([id]) => id);
  if (!withSeeds.length) return taps;
  // Les variétés pas encore sauvées d'abord (le joueur veut les sauver).
  withSeeds.sort((a, b) => Number(!!v.varieties[a]?.fixedAt) - Number(!!v.varieties[b]?.fixedAt));
  for (const L of targets) {
    const empty = L.list.filter((i) => !game.state.plots[i].cropId && game.state.plots[i].fallow === undefined);
    if (!empty.length) continue;
    let sown = 0;
    for (const i of empty) {
      const rows = game.query.plantableCrops(i);
      const ok = (rows.heirlooms || []).filter((h) => h.canSow && h.seeds > 0 && !h.tree && withSeeds.includes(h.varietyId) && !rows.find((r) => r.id === h.cropId)?.willFreeze);
      ok.sort((a, b) => Number(a.fixed) - Number(b.fixed));
      // (V2) 35 variétés : les planches d'essai sont réparties (la variété pas encore sauvée qui pousse le moins d'abord).
      if (v.parts.heritage !== false) {
        const growing = (id) => game.state.plots.filter((p) => p.variety === id && p.cropId).length;
        ok.sort((a, b) => Number(a.fixed) - Number(b.fixed) || growing(a.varietyId) - growing(b.varietyId));
      }
      if (!ok.length) break;
      if (game.actions.career.sowHeirloom(i, ok[0].varietyId).ok) sown++;
    }
    if (sown) taps += 1;
  }
  // Greffons du pommier Calville (V2 : et de l'Api étoilé) : au verger (une parcelle vide, sinon un pommier ordinaire
  // arraché pour lui).
  for (const graftId of ['calvilleBlanc', 'apiEtoile']) {
    const grafts = v.seeds[graftId] || 0;
    if (!(grafts > 0) || v.varieties[graftId]?.fixedAt) continue;
    const orchard = lots.filter((L) => L.env === 'orchard').flatMap((L) => L.list);
    let i = orchard.find((k) => !game.state.plots[k].cropId);
    if (i === undefined) {
      i = orchard.find((k) => game.state.plots[k].cropId === 'apple' && !game.state.plots[k].variety);
      if (i !== undefined) game.actions.removeTree(i);
    }
    if (i !== undefined && game.actions.career.sowHeirloom(i, graftId).ok) taps += 1;
  }
  return taps;
}

// ── Une journée ───────────────────────────────────────────────────────────────────────────
function playDay(game, me) {
  const P = me.profile;
  const year = game.state.time.year;
  const t = { left: 0, spent: 0, valley: 0 };
  const spend = (n) => {
    if (t.left < n - 1e-9) return false;
    t.left -= n;
    t.spent += n;
    return true;
  };
  if (P.idleFrom && year >= P.idleFrom) return t;
  const noGestures = P.noGesturesFrom && year >= P.noGesturesFrom;
  contestFocus(game, me);
  seasonalDecisions(game, me);
  // (lot 3) Fenêtre de fin de saison (cadeau, défis) et visiteur du thème : des décisions, sans geste compté.
  if (game.state.variety) {
    varietyChoices(game, me, P);
    themeVisitor(game, me);
  }
  t.left = noGestures ? 0 : Math.round(between(me.rnd, P.taps));
  const cal = game.query.calendar();
  if (!noGestures && me.rnd() < P.skipDay && cal.daysLeftInSeason > 0) {
    t.left = 0;
    return t;
  }
  if (!noGestures) handleEvents(game, me, spend);
  // (lot 3) Tableau du village (et grenier → commandes, charrette), colporteur.
  if (!noGestures && game.state.variety) varietyDay(game, me, P, spend, (P.reserveSeasons || 0) * seasonCharge(game));
  // (lot 4) Fête du jour (mini-jeu en pause : pas de geste), trouvailles d'hiver, mangeoire, veillée, foire aux graines.
  if (!noGestures && game.state.cozy) cozyDay(game, me, P.cozy, spend, (P.reserveSeasons || 1) * seasonCharge(game));
  // Achats (le joueur ouvre la boutique certains jours ; l'automate décide chaque jour sans geste). (lot 4) Avant les
  // champs et sans coûter de gestes de champ : le robot s'agrandit aussi les jours où il récolte beaucoup.
  if (noGestures || me.rnd() < P.buyProb) {
    const reserve = P.reserveSeasons * seasonCharge(game) + between(me.rnd, P.buyBuffer);
    shop(game, me, reserve);
  }
  if (me.staffHelper) me.staffHelper(game, me);
  // (Vallée vivante) Bocal, bête, cueillette, foire, jachère, aménagement (budget de gestes à part).
  if (game.state.career.valley) t.valley += valleyMorning(game, me, P, noGestures);
  const ctx = noGestures ? null : fieldWork(game, me, spend);
  if (!noGestures) collectShelters(game, me, spend);
  // (Vallée vivante) Graines anciennes semées à la main avant « semer partout ».
  if (ctx && game.state.career.valley) t.valley += valleySowing(game, me, P, ctx.lots);
  if (ctx) sowAndWater(game, me, spend, ctx);
  sellStock(game, me);
  return t;
}

// ── Une carrière ───────────────────────────────────────────────────────────────────────────
let staffHelperModule = null;
/** tools/sim-career-staff.js (lot CORE-B), s'il existe : décisions d'équipe et de machines en plus des envies. */
export async function loadStaffHelper() {
  if (staffHelperModule !== null) return staffHelperModule;
  const file = join(dirname(fileURLToPath(import.meta.url)), 'sim-career-staff.js');
  staffHelperModule = existsSync(file) ? await import(pathToFileURL(file).href) : false;
  return staffHelperModule;
}

export function playCareer({ seed = 1, strategy = 'casual', years = 10, difficulty = 'detente', seasonLength = 7, assumeObjectives = false, onDay = null, helper = null, surprises = true, variety = true, cozy = true, valley = true, keepGame = false } = {}) {
  const game = createCareer({ seed, difficulty, seasonLength, farmName: 'Ferme simulée', surprises, variety, cozy, valley, cosmetics: SIM_CAREER_DECOR[strategy] || null });
  const profile = CAREER_PROFILES[strategy];
  if (!profile) throw new Error(`Stratégie inconnue : ${strategy}`);
  const me = {
    rnd: humanRng(humanSeed(seed, strategy)), profile, strategy, matureSince: {}, day: 0, wishes: numberWishes(WISHES[strategy]),
    planned: {}, seenOffers: new Set(), seenQuests: new Set(), contestFocus: false, contestKey: null, lastSeasonKey: null,
    stats: { visitorsAccepted: 0, questsAccepted: 0, crowsChased: 0, collects: 0, handHarvests: 0 },
    pace: { questsOffered: 0, questsAsked: 0, questsAccepted: 0, questsDone: 0, questsFailed: 0, questsWithdrawn: 0, questDays: [], visitors: 0, visitorsAccepted: 0, visitorsDelivered: 0, asks: 0, events: 0, festivals: 0, reminders: 0, days: 0, maxOpen: 0, sideLots: 0 },
    staffHelper: helper && typeof helper.staffDecisions === 'function' ? (g, m) => helper.staffDecisions(g, m) : null,
    seedBase: humanSeed(seed, strategy),
    springPlan: PLANS[profile.plan]?.spring ? [PLANS[profile.plan].spring] : [],
    valleyStats: { placed: 0 },
  };
  game.actions.career.setStorageMode('low');
  const out = { seed, strategy, years: [], bankrupt: false, loans: 0, hardships: 0, rescues: 0, quests: 0, contests: 0, domaineYear: null, overdraftStreakMax: 0 };
  // (lot 3) gains de la variété (pièces, toute la carrière) et écus.
  out.variety = { orders: 0, cart: 0, cards: 0, medals: 0, merchant: 0, ecus: 0, ordersDone: 0, medalsN: 0, themes: 0 };
  // (lot 4) fêtes et hiver (pièces), écus, lanternes par année, comice (stand).
  out.cozy = { fetes: 0, winter: 0, ecus: 0, seedPacks: 0, standBonus: 0, lanterns: [] };
  game.on('feteDone', (e) => (out.cozy.ecus += e.ecus || 0));
  game.on('winterPicked', (e) => (out.cozy.winter += e.amount || 0));
  game.on('storyHeard', () => (out.cozy.ecus += 1));
  game.on('seedPackBought', () => out.cozy.seedPacks++);
  game.on('lanternsLit', (e) => out.cozy.lanterns.push({ year: e.year, values: [...e.values], total: e.total, criteria: e.criteria.map((c) => c.value) }));
  game.on('orderDone', (e) => {
    out.variety.orders += e.premium;
    out.variety.ordersDone++;
  });
  game.on('orderRemoved', (e) => (out.variety.orders += e.premium || 0));
  game.on('cartDeparted', (e) => {
    out.variety.cart += e.premium;
    out.variety.ecus += e.ecus || 0;
  });
  game.on('cardPicked', (e) => (out.variety.cards += e.amount || 0));
  game.on('challengeMedal', (e) => {
    out.variety.medals += e.coins || 0;
    out.variety.ecus += e.ecus || 0;
    out.variety.medalsN++;
  });
  game.on('merchantBought', (e) => (out.variety.merchant += e.price || 0));
  game.on('themeStarted', () => out.variety.themes++);
  // (Vallée vivante) Nouveautés par saison (bocal, variété sauvée, indice, habitant, étape…), semis par culture.
  out.valley = { noveltySeasons: {}, sownCrops: {}, finds: 0, bees: 0 };
  const novelty = () => {
    const key = `${game.state.time.year}/${game.state.time.seasonIndex}`;
    out.valley.noveltySeasons[key] = (out.valley.noveltySeasons[key] || 0) + 1;
  };
  // (V2) + Grainothèque, troc proposé et fait, croisement.
  for (const type of ['valleyStarted', 'jarOpened', 'heirloomFixed', 'speciesHint', 'speciesInstalled', 'valleyStage', 'jayGift', 'fairHeirloomBought', 'seedLibraryBuilt', 'trocOffered', 'seedSwapped', 'crossFound']) game.on(type, novelty);
  game.on('hedgePicked', (e) => (out.valley.finds += e.amount || 0));
  game.on('planted', (e) => (out.valley.sownCrops[e.cropId] = (out.valley.sownCrops[e.cropId] || 0) + 1));
  let y = newYearAcc(game);
  let current = null;
  let overdraftSeasons = 0;
  game.on('neighbourLoan', () => out.loans++);
  game.on('hardship', (e) => {
    if (e.stage === 'overdraft') out.hardships++;
    if (e.stage === 'recovered' && y.hardshipSince !== null) {
      y.recoveries.push(me.day - y.hardshipSince);
      y.hardshipSince = null;
    }
    if (e.stage === 'overdraft' && y.hardshipSince === null) y.hardshipSince = me.day;
  });
  game.on('rescueSale', () => out.rescues++);
  game.on('questDone', () => {
    out.quests++;
    y.quests++;
  });
  game.on('contestAwarded', (e) => {
    y.contest = e.amount;
    if (e.all) out.contests++;
    out.cozy.standBonus += e.standBonus || 0;
  });
  game.on('careerEvent', (e) => {
    y.events++;
    me.pace.events++;
    // Sollicitations : ce qui demande une réponse ou un geste (commande, marchand, animal perdu, corbeaux).
    if (['visitor', 'merchant', 'lostPet', 'crows'].includes(e.kind)) me.pace.asks++;
    if (['visitor', 'merchant'].includes(e.kind)) me.pace.visitorMerchant = (me.pace.visitorMerchant || 0) + 1;
    if (e.kind === 'visitor') me.pace.visitors++;
  });
  game.on('festival', () => me.pace.festivals++);
  game.on('questOffered', (e) => {
    if (e.asked) me.pace.questsAsked++;
    else {
      me.pace.questsOffered++;
      me.pace.asks++;
    }
  });
  game.on('questProgress', (e) => {
    if (e.accepted) {
      me.pace.questsAccepted++;
      me.questAcceptedDay = me.day;
    }
  });
  game.on('questDone', () => {
    me.pace.questsDone++;
    if (me.questAcceptedDay != null) me.pace.questDays.push(me.day - me.questAcceptedDay);
    me.questAcceptedDay = null;
  });
  game.on('questExpired', (e) => {
    if (e.accepted && !e.declined) me.pace.questsFailed++;
    me.questAcceptedDay = null;
  });
  game.on('questWithdrawn', () => me.pace.questsWithdrawn++);
  game.on('questReminder', () => me.pace.reminders++);
  game.on('offerReminder', () => me.pace.reminders++);
  game.on('offerAccepted', (e) => {
    if (e.kind === 'visitor') me.pace.visitorsAccepted++;
  });
  game.on('offerResolved', (e) => {
    if (e.kind === 'visitor' && e.outcome === 'delivered') me.pace.visitorsDelivered++;
  });
  game.on('lotBought', (e) => {
    if (e.col) me.pace.sideLots++;
  });
  game.on('harvested', (e) => {
    const by = e.by === 'player' ? 'player' : e.by === 'machine' ? 'machine' : 'staff';
    y.harvestsBy[by] = (y.harvestsBy[by] || 0) + 1;
  });
  game.on('planted', (e) => {
    const by = e.by === 'player' ? 'player' : e.by === 'machine' ? 'machine' : 'staff';
    y.sownBy[by] = (y.sownBy[by] || 0) + 1;
  });
  game.on('collected', (e) => {
    const by = e.by === 'player' ? 'player' : e.by === 'collector' ? 'machine' : 'staff';
    y.collectedBy[by] = (y.collectedBy[by] || 0) + 1;
  });
  game.on('shelterFull', (e) => {
    y.animalLost += e.lost || 0;
  });
  game.on('billPaid', () => {
    const limit = -seasonCharge(game);
    overdraftSeasons = game.state.money < limit ? overdraftSeasons + 1 : 0;
    out.overdraftStreakMax = Math.max(out.overdraftStreakMax, overdraftSeasons);
  });
  game.on('yearEnd', ({ report }) => {
    current = report;
  });
  while (game.state.time.year <= years && game.state.status === 'playing') {
    me.day++;
    me.pace.days++;
    // (lot 2) Vœu de l'étoile filante : la bourse si elle est proposée, sinon le premier vœu.
    const wish = game.query.surprises()?.wish;
    if (wish) game.actions.makeWish((wish.options.find((o) => o.id === 'coins') || wish.options[0]).id);
    const open = (game.state.career.quest ? 1 : 0) + game.state.career.events.offers.filter((o) => o.kind === 'visitor').length;
    me.pace.maxOpen = Math.max(me.pace.maxOpen, open);
    const t = playDay(game, me);
    y.taps += t.spent + (t.valley || 0);
    y.valleyTaps += t.valley || 0;
    y.days++;
    if (assumeObjectives) {
      for (const r of RANKS) for (const o of r.objectives) if (ASSUMED_TYPES.includes(o.type)) game.state.career.objectives[o.id] = true;
    }
    const before = game.state.time.year;
    if (onDay) onDay(game, me);
    game.update(DAY_SECONDS / game.state.speed);
    y.minMoney = Math.min(y.minMoney, game.state.money);
    if (game.state.time.year !== before || game.state.status !== 'playing') {
      const rep = current || game.query.career.yearReport();
      const summary = game.query.career.summary();
      if (summary.rank >= 6 && out.domaineYear === null) out.domaineYear = before;
      const byTotal = (o) => Object.values(o).reduce((a, b) => a + b, 0);
      out.years.push({
        year: before,
        rank: summary.rank,
        patrimony: summary.patrimony,
        net: rep.net,
        income: rep.income,
        incomeBy: rep.incomeBy,
        money: game.state.money,
        minMoney: y.minMoney,
        lots: game.state.career.lotsBought,
        plots: game.state.plots.filter((p) => p.env && p.unlocked).length,
        staff: game.state.career.staff.length,
        machines: Object.values(game.state.career.machines).filter(Boolean).length,
        animals: Object.entries(game.state.investments).filter(([id]) => ['hen', 'goat', 'cow', 'sheep', 'pig', 'rabbit', 'horse', 'duck'].includes(id)).reduce((s, [, n]) => s + n, 0),
        harvests: game.state.career.lifetime.harvests,
        products: game.state.career.lifetime.productsSold,
        tapsPerDay: y.taps / Math.max(1, y.days),
        handShare: byTotal(y.harvestsBy) ? (y.harvestsBy.player || 0) / byTotal(y.harvestsBy) : 1,
        playerShare: byTotal(y.harvestsBy) + byTotal(y.sownBy) ? ((y.harvestsBy.player || 0) + (y.sownBy.player || 0)) / (byTotal(y.harvestsBy) + byTotal(y.sownBy)) : 1,
        harvestsBy: { ...y.harvestsBy },
        collectedBy: { ...y.collectedBy },
        animalLost: Math.round(y.animalLost),
        animalIncome: rep.incomeBy.animals || 0,
        quests: y.quests,
        hearts: game.state.career.joseph.hearts,
        contest: y.contest,
        events: y.events,
        recoveries: y.recoveries,
        stillInHardship: y.hardshipSince !== null,
        // (Vallée vivante) collection, étape, dépenses (cumul), gestes de la Vallée par jour.
        valley: valleyYearOf(game, y),
      });
      current = null;
      const since = y.hardshipSince;
      y = newYearAcc(game);
      y.hardshipSince = since;
    }
  }
  out.bankrupt = game.state.status === 'bankrupt';
  out.cozy.fetes = Object.values(game.state.career?.history || []).reduce((s, h) => s + (h.incomeBy?.fetes || 0), 0);
  if (keepGame) out.game = game;
  out.hearts = game.state.career.joseph.hearts;
  out.me = me.stats;
  out.pace = me.pace;
  return out;
}

function newYearAcc(game) {
  return { minMoney: game.state.money, taps: 0, valleyTaps: 0, days: 0, harvestsBy: {}, sownBy: {}, collectedBy: {}, animalLost: 0, quests: 0, contest: 0, events: 0, recoveries: [], hardshipSince: null };
}

/** (Vallée vivante) État de la Vallée en fin d'année (null sans la Vallée). */
function valleyYearOf(game, y) {
  const v = game.state.career.valley;
  if (!v) return null;
  return {
    started: !!v.started,
    fixed: Object.values(v.varieties).filter((e) => e.fixedAt).length,
    known: Object.keys(v.varieties).length,
    installed: Object.values(v.species).filter((e) => e.state === 'installed').length,
    stage: v.stage,
    // Signes de vie (habitants installés + variétés sauvées, V2 compris s'il est ouvert).
    signs: Object.values(v.species).filter((e) => e.state === 'installed').length + Object.values(v.varieties).filter((e) => e.fixedAt).length,
    spent: v.spent,
    nature: Object.keys(v.nature).length,
    tapsPerDay: y.valleyTaps / Math.max(1, y.days),
    hand: v.stats.hand,
    // (V2) collection : trocs, croisements trouvés, variétés sauvées par groupe, Grainothèque, habitants du V2.
    swaps: Object.keys(v.swaps || {}).length,
    crosses: Object.values(v.crosses || {}).filter((e) => e.foundAt).length,
    library: v.library?.level || 0,
    fixedPays: Object.entries(v.varieties).filter(([id, e]) => e.fixedAt && ALL_VARIETIES_BY_ID[id]?.group === 'pays').length,
    fixedVillage: Object.entries(v.varieties).filter(([id, e]) => e.fixedAt && ALL_VARIETIES_BY_ID[id]?.group === 'village').length,
    fixedCross: Object.entries(v.varieties).filter(([id, e]) => e.fixedAt && ALL_VARIETIES_BY_ID[id]?.group === 'cross').length,
    installedV2: Object.entries(v.species).filter(([id, e]) => e.state === 'installed' && !SPECIES_BY_ID[id]).length,
    meets: v.stats.meets || 0,
    // Dépenses du V2 : Grainothèque (niveaux achetés) et nichoirs à chauves-souris.
    v2Spent: SEED_LIBRARY.levels.filter((L) => L.level <= (v.library?.level || 0)).reduce((a, L) => a + L.price, 0)
      + Array.from({ length: v.bought?.batbox || 0 }, (_, k) => NATURE_ITEMS_BY_ID.batbox.price.base + NATURE_ITEMS_BY_ID.batbox.price.step * k).reduce((a, b) => a + b, 0),
  };
}

// ── Tableaux ───────────────────────────────────────────────────────────────────────────────
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

export function simulateCareer({ strategies = STRATEGIES, runs = 20, years = 10, difficulty = 'detente', seasonLength = 7, assumeObjectives = false, firstSeed = 1, helper = null, surprises = true, variety = true, cozy = true, valley = true } = {}) {
  const table = {};
  for (const strategy of strategies) {
    const careers = [];
    for (let k = 0; k < runs; k++) careers.push(playCareer({ seed: firstSeed + k, strategy, years, difficulty, seasonLength, assumeObjectives, helper, surprises, variety, cozy, valley }));
    table[strategy] = careerTable(careers, { runs, years, seasonLength });
  }
  return table;
}

/**
 * La même chose en parallèle (`--jobs N`, fils de travail node:worker_threads) : chaque fil joue une partie des
 * carrières (mêmes graines, mêmes résultats que simulateCareer), puis le tableau est fait ici.
 */
export async function simulateCareerParallel(opts = {}) {
  const { strategies = STRATEGIES, runs = 20, years = 10, seasonLength = 7, firstSeed = 1, jobs = 4 } = opts;
  const { Worker } = await import('node:worker_threads');
  const tasks = [];
  for (const strategy of strategies) for (let k = 0; k < runs; k++) tasks.push({ strategy, seed: firstSeed + k });
  const results = new Map();
  const { helper: _h, ...plain } = opts;
  void _h;
  const n = Math.max(1, Math.min(jobs, tasks.length));
  const chunks = Array.from({ length: n }, (_, j) => tasks.filter((_, k) => k % n === j));
  await Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { simWorker: true, opts: plain, tasks: chunk } });
    w.on('message', (m) => {
      for (const r of m) results.set(`${r.strategy}/${r.seed}`, r);
    });
    w.on('error', reject);
    w.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`fil ${code}`))));
  })));
  const table = {};
  for (const strategy of strategies) {
    const careers = [];
    for (let k = 0; k < runs; k++) careers.push(results.get(`${strategy}/${firstSeed + k}`));
    table[strategy] = careerTable(careers, { runs, years, seasonLength });
  }
  return table;
}

/** Tableau d'une stratégie à partir de ses carrières. */
function careerTable(careers, { runs, years, seasonLength }) {
  {
    const rows = [];
    for (let yv = 1; yv <= years; yv++) {
      const at = careers.map((c) => c.years.find((x) => x.year === yv)).filter(Boolean);
      if (!at.length) break;
      const ranks = at.map((x) => x.rank);
      const dist = {};
      for (let r = 1; r <= 6; r++) dist[r] = pct(ranks.filter((x) => x >= r).length, careers.length);
      rows.push({
        year: yv,
        rankMedian: median(ranks),
        rankAtLeast: dist,
        patrimony: Math.round(median(at.map((x) => x.patrimony))),
        net: Math.round(median(at.map((x) => x.net))),
        lots: median(at.map((x) => x.lots)),
        plots: median(at.map((x) => x.plots)),
        staff: median(at.map((x) => x.staff)),
        machines: median(at.map((x) => x.machines)),
        harvests: median(at.map((x) => x.harvests)),
        products: median(at.map((x) => x.products)),
        minMoney: Math.min(...at.map((x) => x.minMoney)),
        taps: Math.round(median(at.map((x) => x.tapsPerDay)) * 10) / 10,
        handShare: Math.round(median(at.map((x) => x.handShare)) * 100),
        patrimonyMean: Math.round(at.reduce((s, x) => s + x.patrimony, 0) / at.length),
        netMean: Math.round(at.reduce((s, x) => s + x.net, 0) / at.length),
        playerShare: Math.round(median(at.map((x) => x.playerShare)) * 100),
        quests: median(at.map((x) => x.quests)),
        hearts: median(at.map((x) => x.hearts)),
        contest: median(at.map((x) => x.contest)),
        animalLostShare: Math.round(100 * median(at.map((x) => (x.animalIncome + x.animalLost > 0 ? x.animalLost / (x.animalIncome + x.animalLost) : 0)))),
        visitors: Math.round(median(at.map((x) => x.incomeBy.visitors || 0))),
        questIncome: Math.round(median(at.map((x) => x.incomeBy.quests || 0))),
        income: Math.round(at.reduce((s, x) => s + x.income, 0) / at.length),
        moneyMean: Math.round(at.reduce((s, x) => s + x.money, 0) / at.length),
        // (Vallée vivante) médianes de l'année (null sans la Vallée).
        valley: at[0].valley
          ? {
              fixed: median(at.map((x) => x.valley.fixed)),
              known: median(at.map((x) => x.valley.known)),
              installed: median(at.map((x) => x.valley.installed)),
              stage: median(at.map((x) => x.valley.stage)),
              signs: median(at.map((x) => x.valley.signs || 0)),
              nature: median(at.map((x) => x.valley.nature)),
              spentMean: Math.round(at.reduce((s2, x) => s2 + x.valley.spent, 0) / at.length),
              taps: Math.round(median(at.map((x) => x.valley.tapsPerDay)) * 100) / 100,
              fixed4: pct(at.filter((x) => x.valley.fixed >= 4).length, at.length),
              installed4: pct(at.filter((x) => x.valley.installed >= 4).length, at.length),
              // (V2) médianes : trocs, croisements, Grainothèque, variétés par groupe, habitants du V2 ; dépenses du V2.
              swaps: median(at.map((x) => x.valley.swaps || 0)),
              crosses: median(at.map((x) => x.valley.crosses || 0)),
              library: median(at.map((x) => x.valley.library || 0)),
              fixedPays: median(at.map((x) => x.valley.fixedPays || 0)),
              fixedVillage: median(at.map((x) => x.valley.fixedVillage || 0)),
              fixedCross: median(at.map((x) => x.valley.fixedCross || 0)),
              installedV2: median(at.map((x) => x.valley.installedV2 || 0)),
              v2SpentMean: Math.round(at.reduce((s2, x) => s2 + (x.valley.v2Spent || 0), 0) / at.length),
              swaps4: pct(at.filter((x) => (x.valley.swaps || 0) >= 4).length, at.length),
              crosses1: pct(at.filter((x) => (x.valley.crosses || 0) >= 1).length, at.length),
            }
          : null,
      });
    }
    const recoveries = careers.flatMap((c) => c.years.flatMap((y) => y.recoveries));
    return {
      rows,
      runs,
      bankrupt: pct(careers.filter((c) => c.bankrupt).length, careers.length),
      loans: median(careers.map((c) => c.loans)),
      hardships: median(careers.map((c) => c.hardships)),
      rescues: careers.filter((c) => c.rescues > 0).length,
      rescueCareersAtMostOne: pct(careers.filter((c) => c.rescues <= 1).length, careers.length),
      overdraftStreakMax: Math.max(...careers.map((c) => c.overdraftStreakMax)),
      recoveryWithin2Seasons: recoveries.length ? pct(recoveries.filter((d) => d <= 2 * seasonLength).length, recoveries.length) : 100,
      domaineYear: median(careers.map((c) => c.domaineYear ?? Infinity)),
      domaineBy10: pct(careers.filter((c) => c.domaineYear !== null && c.domaineYear <= 10).length, careers.length),
      domaineBefore5: pct(careers.filter((c) => c.domaineYear !== null && c.domaineYear <= 4).length, careers.length),
      contests: median(careers.map((c) => c.contests)),
      quests: median(careers.map((c) => c.quests)),
      hearts: median(careers.map((c) => c.hearts)),
      pace: paceSummary(careers),
      // (lot 3) gains moyens de la variété par carrière (pièces) et écus.
      variety: Object.fromEntries(Object.keys(careers[0]?.variety || {}).map((k) => [k, Math.round(careers.reduce((s2, c) => s2 + c.variety[k], 0) / careers.length)])),
      // (lot 4) gains moyens par carrière (fêtes, hiver, stand du comice), écus, lanternes de chaque année.
      cozy: {
        fetes: Math.round(careers.reduce((s2, c) => s2 + (c.cozy?.fetes || 0), 0) / careers.length),
        winter: Math.round(careers.reduce((s2, c) => s2 + (c.cozy?.winter || 0), 0) / careers.length),
        standBonus: Math.round(careers.reduce((s2, c) => s2 + (c.cozy?.standBonus || 0), 0) / careers.length),
        ecus: Math.round(careers.reduce((s2, c) => s2 + (c.cozy?.ecus || 0), 0) / careers.length),
        seedPacks: Math.round(careers.reduce((s2, c) => s2 + (c.cozy?.seedPacks || 0), 0) / careers.length),
        lanterns: careers.flatMap((c) => c.cozy?.lanterns || []),
      },
      rank3By5: pct(careers.filter((c) => (c.years.find((x) => x.year === 5)?.rank || 0) >= 3).length, careers.length),
      contestIncome: Math.round(careers.reduce((s2, c) => s2 + c.years.reduce((a, y) => a + (y.contest || 0), 0), 0) / careers.length),
      valley: valleySummary(careers, years),
      sown: careers.reduce((acc, c) => {
        for (const [id, n] of Object.entries(c.valley?.sownCrops || {})) acc[id] = (acc[id] || 0) + n;
        return acc;
      }, {}),
    };
  }
}

/** (Vallée vivante) Nouveautés par saison, collection complète, cueillette, semis par culture (null sans la Vallée). */
function valleySummary(careers, years) {
  if (!careers.length || !careers[0].years[0]?.valley) return null;
  const firstYear = (c, test) => c.years.find((y) => y.valley && test(y.valley))?.year ?? Infinity;
  // Saisons des ans 2 à N avec au moins une nouveauté (V2 : aussi les ans 6 à 10, et les ans 2 à 10 quand N > 10).
  const shareOf = (c, from, to) => {
    let n = 0;
    let total = 0;
    for (let yv = from; yv <= Math.min(to, c.years.length); yv++) {
      for (let si = 0; si < 4; si++) {
        total++;
        if ((c.valley.noveltySeasons[`${yv}/${si}`] || 0) > 0) n++;
      }
    }
    return total ? n / total : 0;
  };
  const shares = careers.map((c) => shareOf(c, 2, years));
  const shares210 = careers.map((c) => shareOf(c, 2, Math.min(10, years)));
  const shares610 = careers.map((c) => shareOf(c, 6, Math.min(10, years)));
  const sown = {};
  for (const c of careers) for (const [id, n] of Object.entries(c.valley.sownCrops)) sown[id] = (sown[id] || 0) + n;
  return {
    noveltyShare: Math.round(100 * median(shares)),
    noveltyAtLeast80: pct(shares.filter((x) => x >= 0.8).length, shares.length),
    noveltyShare210: Math.round(100 * median(shares210)),
    noveltyShare610: Math.round(100 * median(shares610)),
    noveltyAtLeast80of210: pct(shares210.filter((x) => x >= 0.8).length, shares210.length),
    all12Swaps: median(careers.map((c) => firstYear(c, (v) => (v.swaps || 0) >= 12))),
    all11Crosses: median(careers.map((c) => firstYear(c, (v) => (v.crosses || 0) >= 11))),
    all35Fixed: median(careers.map((c) => firstYear(c, (v) => v.fixed >= 35))),
    library5: median(careers.map((c) => firstYear(c, (v) => (v.library || 0) >= 5))),
    library1: median(careers.map((c) => firstYear(c, (v) => (v.library || 0) >= 1))),
    all16Installed: median(careers.map((c) => firstYear(c, (v) => v.installed >= 16))),
    v2Complete: median(careers.map((c) => firstYear(c, (v) => (v.swaps || 0) >= 12 && (v.crosses || 0) >= 11 && v.fixed >= 35 && (v.library || 0) >= 5 && v.installed >= 16))),
    all12Fixed: median(careers.map((c) => firstYear(c, (v) => v.fixed >= 12))),
    all12Installed: median(careers.map((c) => firstYear(c, (v) => v.installed >= 12))),
    stage5: median(careers.map((c) => firstYear(c, (v) => v.stage >= 5))),
    // Année (médiane) de chaque étape 1 à 5, et part des carrières à l'étape 5 avant la fin.
    stageYears: [1, 2, 3, 4, 5].map((k) => median(careers.map((c) => firstYear(c, (v) => v.stage >= k)))),
    stage5Share: pct(careers.filter((c) => c.years.some((y) => y.valley && y.valley.stage >= 5)).length, careers.length),
    started: median(careers.map((c) => firstYear(c, (v) => v.started))),
    finds: Math.round(careers.reduce((s2, c) => s2 + c.valley.finds, 0) / careers.length),
    sown,
  };
}

/** Rythme des sollicitations et réussite des quêtes (retours de joueurs « trop de quêtes, trop court »). */
export function paceSummary(careers) {
  const sum = (k) => careers.reduce((s, c) => s + (c.pace?.[k] || 0), 0);
  const days = Math.max(1, sum('days'));
  const accepted = sum('questsAccepted');
  const questDays = careers.flatMap((c) => c.pace?.questDays || []);
  const vAcc = sum('visitorsAccepted');
  return {
    asksPerWeek: Math.round((sum('asks') / days) * 7 * 100) / 100,
    eventsPerWeek: Math.round((sum('events') / days) * 7 * 100) / 100,
    questsOfferedPerYear: Math.round((sum('questsOffered') / careers.length / Math.max(1, careers[0]?.years.length || 1)) * 10) / 10,
    questsAccepted: accepted,
    questSuccess: accepted ? pct(sum('questsDone'), accepted) : null,
    questsFailed: sum('questsFailed'),
    questsWithdrawn: sum('questsWithdrawn'),
    questDaysMedian: median(questDays),
    visitorsPerYear: Math.round((sum('visitors') / careers.length / Math.max(1, careers[0]?.years.length || 1)) * 10) / 10,
    visitorSuccess: vAcc ? pct(sum('visitorsDelivered'), vAcc) : null,
    remindersPerYear: Math.round((sum('reminders') / careers.length / Math.max(1, careers[0]?.years.length || 1)) * 10) / 10,
    maxOpen: Math.max(0, ...careers.map((c) => c.pace?.maxOpen || 0)),
    sideLotShare: pct(sum('sideLots'), careers.reduce((s, c) => s + (c.years.at(-1)?.lots || 0), 0)),
  };
}

function printPace(table) {
  console.log('\n  Rythme (toutes carrières) : sollicitations/semaine (commandes, marchand, animal perdu, corbeaux, quêtes proposées) · événements au hasard/semaine · quêtes proposées/an · réussite des quêtes acceptées · jours pour la finir (méd.) · commandes/an · réussite des commandes acceptées · rappels/an · au plus ouvert (quête + commande) · terrains de côté');
  for (const [strategy, t] of Object.entries(table)) {
    const p = t.pace;
    console.log(`  ${strategy.padEnd(9)} ${String(p.asksPerWeek).padStart(5)} · ${String(p.eventsPerWeek).padStart(5)} · ${String(p.questsOfferedPerYear).padStart(4)} · ${p.questSuccess === null ? '  —' : `${p.questSuccess} %`} (${p.questsAccepted} acceptées, ${p.questsFailed} ratées, ${p.questsWithdrawn} retirées) · ${p.questDaysMedian} j · ${p.visitorsPerYear} · ${p.visitorSuccess === null ? '—' : `${p.visitorSuccess} %`} · ${p.remindersPerYear} · ${p.maxOpen} · ${p.sideLotShare} %`);
  }
}

function printTable(table, title) {
  console.log(`\n${title}`);
  for (const [strategy, t] of Object.entries(table)) {
    console.log(`\n  ${strategy} — faillites ${t.bankrupt} % · prêts de Joseph (méd.) ${t.loans} · coups durs (méd.) ${t.hardships} · carrières avec vente de secours ${t.rescues}/${t.runs} · Domaine (méd.) ${Number.isFinite(t.domaineYear) ? `année ${t.domaineYear}` : 'jamais'} (≤ an 10 : ${t.domaineBy10} %, ≤ an 4 : ${t.domaineBefore5} %) · comices réussis (méd.) ${t.contests} · quêtes (méd.) ${t.quests} · ♥ ${t.hearts}`);
    console.log('  année | rang | ≥2   ≥3   ≥4   ≥5   ≥6  | patrimoine | bénéfice | terr. | parc. | empl. | mach. | gestes/j | part joueur | quêtes | comice | visiteurs | animaux perdus | argent min');
    for (const r of t.rows) {
      const p = [2, 3, 4, 5, 6].map((k) => `${String(r.rankAtLeast[k]).padStart(3)}%`).join(' ');
      console.log(`  ${String(r.year).padStart(5)} | ${String(r.rankMedian).padStart(4)} | ${p} | ${String(r.patrimony).padStart(10)} | ${String(r.net).padStart(8)} | ${String(r.lots).padStart(5)} | ${String(r.plots).padStart(5)} | ${String(r.staff).padStart(5)} | ${String(r.machines).padStart(5)} | ${String(r.taps).padStart(8)} | ${String(r.playerShare).padStart(10)}% | ${String(r.quests).padStart(6)} | ${String(r.contest).padStart(6)} | ${String(r.visitors).padStart(9)} | ${String(r.animalLostShare).padStart(13)}% | ${String(r.minMoney).padStart(10)}`);
    }
  }
}

/** Tableau compact « rang médian et % ≥ rang cible par année » pour plusieurs réglages. */
function printMatrix(results) {
  console.log('\nRang médian par année (et % des carrières au rang ≥ cible de la courbe § 9.1 : an 1 → 2, an 3 → 3, an 5 → 4, an 7 → 5, an 10 → 6)');
  const target = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5, 10: 6 };
  for (const { label, table } of results) {
    for (const [strategy, t] of Object.entries(table)) {
      const cells = t.rows.map((r) => `${r.rankMedian}(${String(r.rankAtLeast[target[r.year] || 6]).padStart(3)}%)`).join(' ');
      const p = t.pace;
      console.log(`  ${label.padEnd(18)} ${strategy.padEnd(9)} ${cells}  · Domaine ${Number.isFinite(t.domaineYear) ? `an ${t.domaineYear}` : 'jamais'} · faillites ${t.bankrupt} % · sollic./sem. ${p.asksPerWeek} · quêtes ${p.questSuccess ?? '—'} % · commandes ${p.visitorSuccess ?? '—'} %`);
    }
  }
}

/** (lot 2) Sans / avec les surprises : revenu moyen par année, rang médian, Domaine. */
function printCompareSurprises(off, on, years) {
  console.log('\nSurprises du lot 2 — carrière : sans → avec (revenu moyen de l\'année, rang médian)');
  for (const strategy of Object.keys(off)) {
    const a = off[strategy];
    const b = on[strategy];
    let ia = 0;
    let ib = 0;
    const cells = [];
    for (let k = 0; k < Math.min(a.rows.length, b.rows.length, years); k++) {
      ia += a.rows[k].income;
      ib += b.rows[k].income;
      cells.push(`an ${a.rows[k].year} : ${a.rows[k].rankMedian}→${b.rows[k].rankMedian}`);
    }
    const d = ia ? (100 * (ib - ia)) / ia : 0;
    const y3 = (t) => t.rows.slice(0, 3).reduce((s, r) => s + r.income, 0);
    const d3 = y3(a) ? (100 * (y3(b) - y3(a))) / y3(a) : 0;
    console.log(`  ${strategy.padEnd(9)} revenu ${d >= 0 ? '+' : ''}${d.toFixed(1)} % (années 1 à 3 : ${d3 >= 0 ? '+' : ''}${d3.toFixed(1)} %) · Domaine ${a.domaineYear}→${b.domaineYear} · faillites ${a.bankrupt}→${b.bankrupt} % · rangs ${cells.join(', ')}`);
  }
}

/** (lot 3) Sans → avec la variété : revenu par année, rang médian, Domaine, sollicitations, gains. */
function printCompareVariety(off, on, years) {
  console.log('\nVariété du lot 3 — carrière : sans → avec (revenu moyen de l\'année, rang médian, Domaine, faillites, sollicitations/semaine)');
  for (const strategy of Object.keys(off)) {
    const a = off[strategy];
    const b = on[strategy];
    let ia = 0;
    let ib = 0;
    const cells = [];
    for (let k = 0; k < Math.min(a.rows.length, b.rows.length, years); k++) {
      ia += a.rows[k].income;
      ib += b.rows[k].income;
      cells.push(`${a.rows[k].rankMedian}→${b.rows[k].rankMedian}`);
    }
    const d = ia ? (100 * (ib - ia)) / ia : 0;
    const v = b.variety || {};
    console.log(`  ${strategy.padEnd(9)} revenu ${d >= 0 ? '+' : ''}${d.toFixed(1)} % · Domaine ${a.domaineYear}→${b.domaineYear} · faillites ${a.bankrupt}→${b.bankrupt} % · sollic./sem. ${a.pace.asksPerWeek}→${b.pace.asksPerWeek} (évén. au hasard ${a.pace.eventsPerWeek}→${b.pace.eventsPerWeek}) · rangs ${cells.join(' ')}`);
    console.log(`            gains par carrière : tableau ${v.orders} · cartes ${v.cards} · charrette ${v.cart} · médailles ${v.medals} · colporteur −${v.merchant} · écus ${v.ecus} · commandes ${v.ordersDone} · médailles ${v.medalsN} · thèmes ${v.themes}`);
  }
}

/** (lot 4) Sans → avec : revenu cumulé, rangs médians, Domaine, faillites, part à la main et gestes (ans 5-10), comice. */
function printCompareLot4(off, on, years, title) {
  console.log(`\n${title}`);
  const sumIncome = (t) => t.rows.slice(0, years).reduce((s2, r) => s2 + r.income, 0);
  const late = (t, k) => {
    const rows = t.rows.filter((r) => r.year >= 5);
    return rows.length ? Math.round(rows.reduce((s2, r) => s2 + r[k], 0) / rows.length) : 0;
  };
  for (const strategy of Object.keys(off)) {
    const a = off[strategy];
    const b = on[strategy];
    const ia = sumIncome(a);
    const ib = sumIncome(b);
    const d = ia ? (100 * (ib - ia)) / ia : 0;
    const p10 = (t) => t.rows.find((r) => r.year === Math.min(10, years))?.patrimonyMean ?? 0;
    const dp = p10(a) ? (100 * (p10(b) - p10(a))) / p10(a) : 0;
    const ranks = a.rows.map((r, k) => `${r.rankMedian}→${b.rows[k]?.rankMedian ?? '—'}`).join(' ');
    console.log(`  ${strategy.padEnd(9)} revenu ${Math.round(ia)} → ${Math.round(ib)} (${d >= 0 ? '+' : ''}${d.toFixed(1)} %) · patrimoine an ${Math.min(10, years)} (moy.) ${p10(a)} → ${p10(b)} (${dp >= 0 ? '+' : ''}${dp.toFixed(1)} %) · Domaine ${a.domaineYear}→${b.domaineYear} · faillites ${a.bankrupt}→${b.bankrupt} % · rang 3 à l'an 5 : ${a.rank3By5}→${b.rank3By5} %`);
    console.log(`            rangs ${ranks} · à la main (ans 5-10) ${late(a, 'handShare')} → ${late(b, 'handShare')} % · gestes/j ${late(a, 'taps')} → ${late(b, 'taps')} · comice ${a.contestIncome} → ${b.contestIncome}`);
    if (strategy === 'handsOff') {
      const prof = (t) => t.rows.filter((r) => r.year >= 4 && r.year <= 7).reduce((s2, r) => s2 + r.netMean, 0) / 4;
      const pa = prof(a);
      const pb = prof(b);
      console.log(`            ferme laissée seule : bénéfice moyen par an (ans 4 à 7) ${Math.round(pa)} → ${Math.round(pb)} (${pa ? `${(100 * (pb - pa) / Math.abs(pa)).toFixed(0)} %` : '—'}) · argent min ${Math.min(...a.rows.map((r) => r.minMoney))} → ${Math.min(...b.rows.map((r) => r.minMoney))}`);
    }
    const c = b.cozy || {};
    console.log(`            par carrière (avec) : fêtes ${c.fetes} · hiver ${c.winter} · stand du comice ${c.standBonus} · sachets ${c.seedPacks} · écus ${c.ecus}`);
  }
}

/**
 * (lot 4) La même ferme laissée seule : le tranquille la construit 3 ans SANS « aider sans remplacer », puis la même
 * sauvegarde tourne seule 4 ans (ans 4 à 7), sans puis avec F1. → { off, on } bénéfice moyen par an, revenus par poste.
 */
export function handsOffSameFarm({ runs = 8, helper = null, difficulty = 'detente', seasonLength = 7 } = {}) {
  const res = { off: 0, on: 0, incomeOff: {}, incomeOn: {} };
  for (let k = 1; k <= runs; k++) {
    const built = playCareer({ seed: k, strategy: 'casual', years: 3, difficulty, seasonLength, helper, cozy: { helpers: false }, keepGame: true });
    const saved = built.game.serialize();
    for (const helpers of [false, true]) {
      const st = JSON.parse(JSON.stringify(saved));
      st.cozy.parts.helpers = helpers;
      if (helpers) migrateRipe(st);
      const g = loadCareer(st);
      let net = 0;
      const book = helpers ? res.incomeOn : res.incomeOff;
      g.on('yearEnd', (e) => {
        if (e.year < 4 || e.year > 7) return;
        net += e.report.net;
        for (const [key, v] of Object.entries(e.report.incomeBy)) book[key] = (book[key] || 0) + v / runs / 4;
      });
      while (g.state.time.year <= 7 && g.state.status === 'playing') g.update(DAY_SECONDS / g.state.speed);
      res[helpers ? 'on' : 'off'] += net / 4 / runs;
    }
  }
  res.off = Math.round(res.off);
  res.on = Math.round(res.on);
  return res;
}

/** (Vallée vivante) Sans → avec la Vallée (même graine) : cibles de docs/VALLEE.md § 12.2. */
export function printCompareValley(off, on, years, title) {
  console.log(`\n${title}`);
  const sumIncome = (t) => t.rows.slice(0, years).reduce((s2, r) => s2 + r.income, 0);
  const late = (t, k) => {
    const rows = t.rows.filter((r) => r.year >= 5);
    return rows.length ? rows.reduce((s2, r) => s2 + r[k], 0) / rows.length : 0;
  };
  const sign = (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} %`;
  const yr = (x) => (Number.isFinite(x) ? `an ${x}` : 'jamais');
  for (const strategy of Object.keys(off)) {
    const a = off[strategy];
    const b = on[strategy];
    const ia = sumIncome(a);
    const ib = sumIncome(b);
    const yN = Math.min(10, years);
    const p10 = (t) => t.rows.find((r) => r.year === yN)?.patrimonyMean ?? 0;
    const ranks = a.rows.map((r, k) => `${r.rankMedian}→${b.rows[k]?.rankMedian ?? '—'}`).join(' ');
    console.log(`  ${strategy.padEnd(9)} revenu ${Math.round(ia)} → ${Math.round(ib)} (${sign(ia ? (100 * (ib - ia)) / ia : 0)}) · patrimoine an ${yN} (moy.) ${p10(a)} → ${p10(b)} (${sign(p10(a) ? (100 * (p10(b) - p10(a))) / p10(a) : 0)}) · Domaine ${a.domaineYear}→${b.domaineYear} · faillites ${a.bankrupt}→${b.bankrupt} % · rang 3 à l'an 5 : ${a.rank3By5}→${b.rank3By5} %`);
    console.log(`            rangs ${ranks} · gestes/j (ans 5-10) ${late(a, 'taps').toFixed(1)} → ${late(b, 'taps').toFixed(1)} · à la main ${Math.round(late(a, 'handShare'))} → ${Math.round(late(b, 'handShare'))} %`);
    const vs = b.valley;
    if (!vs) continue;
    const row = (yv) => b.rows.find((r) => r.year === yv)?.valley;
    const r5 = row(5);
    const r8 = row(8);
    const rN = row(years) || b.rows.at(-1)?.valley;
    const spent = rN ? rN.spentMean : 0;
    const collection = b.rows.map((r) => (r.valley ? `${r.valley.fixed}/${r.valley.installed}/${r.valley.stage}` : '—')).join(' ');
    console.log(`            Vallée : début ${yr(vs.started)} · dépenses (moy., cumul an ${years}) ${spent} · nouveautés : ${vs.noveltyShare} % des saisons (ans 2-${years}, méd.) · carrières ≥ 80 % : ${vs.noveltyAtLeast80} % · cueillette ${vs.finds}`);
    console.log(`            collection (variétés fixées / habitants / étape, méd.) ${collection}`);
    console.log(`            dépenses cumulées (moy.) ${b.rows.map((r) => (r.valley ? r.valley.spentMean : 0)).join(' ')}`);
    const mA = a.rows.at(-1)?.moneyMean ?? 0;
    const mB = b.rows.at(-1)?.moneyMean ?? 0;
    console.log(`            argent en caisse an ${a.rows.at(-1)?.year} (moy.) ${mA} → ${mB} (${mA ? Math.round((100 * mB) / mA) : '—'} % de sans)`);
    console.log(`            an 5 : ${r5 ? `${r5.fixed} variétés, ${r5.installed} habitants` : '—'} · 12 variétés : ${yr(vs.all12Fixed)} · 12 habitants : ${yr(vs.all12Installed)} · étape 5 : ${yr(vs.stage5)} · gestes de la Vallée/j (an ${years}) ${rN ? rN.taps : 0}${r8 ? ` · an 8 : ≥ 4 variétés ${r8.fixed4} %, ≥ 4 habitants ${r8.installed4} %` : ''}`);
    if (strategy === 'handsOff') {
      const prof = (t) => t.rows.filter((r) => r.year >= 4 && r.year <= 7).reduce((s2, r) => s2 + r.netMean, 0) / 4;
      const pa = prof(a);
      const pb = prof(b);
      console.log(`            ferme laissée seule : bénéfice moyen par an (ans 4 à 7) ${Math.round(pa)} → ${Math.round(pb)} (${pa ? sign((100 * (pb - pa)) / Math.abs(pa)) : '—'})`);
    }
  }
}

/**
 * (Vallée V2) Sans la Vallée → V1 seul → V1 + V2 (même graine) : cibles de docs/VALLEE.md § 16.12.4.
 * `none` peut être null (pas de colonne « sans »).
 */
export function printCompareValley2(none, off, on, years, title) {
  console.log(`\n${title}`);
  const sumIncome = (t, upTo = years) => t.rows.slice(0, upTo).reduce((s2, r) => s2 + r.income, 0);
  const late = (t, k) => {
    const rows = t.rows.filter((r) => r.year >= 5 && r.year <= 10);
    return rows.length ? rows.reduce((s2, r) => s2 + r[k], 0) / rows.length : 0;
  };
  const sign = (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} %`;
  const delta = (a, b) => (a ? sign((100 * (b - a)) / Math.abs(a)) : '—');
  const yr = (x) => (Number.isFinite(x) ? `an ${x}` : 'jamais');
  const moneyAt = (t, yv) => t.rows.find((r) => r.year === yv)?.moneyMean ?? null;
  for (const strategy of Object.keys(on)) {
    const n = none?.[strategy] || null;
    const a = off[strategy];
    const b = on[strategy];
    const y10 = Math.min(10, years);
    const ia = sumIncome(a, y10);
    const ib = sumIncome(b, y10);
    const p10 = (t) => t.rows.find((r) => r.year === y10)?.patrimonyMean ?? 0;
    const ranks = a.rows.map((r, k) => `${r.rankMedian}→${b.rows[k]?.rankMedian ?? '—'}`).join(' ');
    console.log(`  ${strategy.padEnd(9)} revenu (10 ans) V1 ${Math.round(ia)} → V1+V2 ${Math.round(ib)} (${delta(ia, ib)})${n ? ` · sans la Vallée ${Math.round(sumIncome(n, y10))} → toute la Vallée ${delta(sumIncome(n, y10), ib)}` : ''}${years > 10 ? ` · revenu ${years} ans ${delta(sumIncome(a), sumIncome(b))}` : ''}`);
    console.log(`            patrimoine an ${y10} (moy.) ${p10(a)} → ${p10(b)} (${delta(p10(a), p10(b))})${n ? ` · sans ${p10(n)} (${delta(p10(n), p10(b))})` : ''} · Domaine ${n ? `${n.domaineYear}→` : ''}${a.domaineYear}→${b.domaineYear} · faillites ${n ? `${n.bankrupt}→` : ''}${a.bankrupt}→${b.bankrupt} % · rang 3 à l'an 5 : ${a.rank3By5}→${b.rank3By5} %`);
    console.log(`            rangs (V1→V1+V2) ${ranks}${n ? ` · sans : ${n.rows.map((r) => r.rankMedian).join(' ')}` : ''}`);
    console.log(`            gestes/j (ans 5-10) ${late(a, 'taps').toFixed(2)} → ${late(b, 'taps').toFixed(2)} (${sign(late(b, 'taps') - late(a, 'taps')).replace(' %', '')}) · à la main ${Math.round(late(a, 'handShare'))} → ${Math.round(late(b, 'handShare'))} %`);
    const money = [10, 14, 18].filter((yv) => yv <= years).map((yv) => {
      const mn = n ? moneyAt(n, yv) : null;
      const ma = moneyAt(a, yv);
      const mb = moneyAt(b, yv);
      return `an ${yv} : ${mn !== null ? `sans ${mn} · ` : ''}V1 ${ma} · V1+V2 ${mb}${mn ? ` (${Math.round((100 * mb) / mn)} % de sans)` : ''}`;
    });
    console.log(`            argent en caisse (moy.) ${money.join(' ; ')}`);
    const vs = b.valley;
    if (!vs) continue;
    const va = a.valley;
    const rowB = (yv) => b.rows.find((r) => r.year === yv)?.valley;
    const spentAt = (yv) => rowB(yv)?.v2SpentMean ?? 0;
    console.log(`            dépenses du V2 (moy., cumul) an 10 ${spentAt(10)}${years >= 14 ? ` · an 14 ${spentAt(14)}` : ''}${years >= 18 ? ` · an 18 ${spentAt(18)}` : ''} · par an ${b.rows.map((r) => r.valley?.v2SpentMean ?? 0).join(' ')}`);
    console.log(`            nouveautés (méd.) ans 2-10 : ${va ? `${va.noveltyShare210} → ` : ''}${vs.noveltyShare210} % (carrières ≥ 80 % : ${va ? `${va.noveltyAtLeast80of210} → ` : ''}${vs.noveltyAtLeast80of210} %) · ans 6-10 : ${va ? `${va.noveltyShare610} → ` : ''}${vs.noveltyShare610} %`);
    console.log(`            collection par an (trocs/croisements/sauvées pays-village-croisées/Grainothèque/habitants) ${b.rows.map((r) => (r.valley ? `${r.valley.swaps}/${r.valley.crosses}/${r.valley.fixedPays}-${r.valley.fixedVillage}-${r.valley.fixedCross}/N${r.valley.library}/${r.valley.installed}` : '—')).join(' ')}`);
    console.log(`            N1 ${yr(vs.library1)} · 12 trocs ${yr(vs.all12Swaps)} · 11 croisements ${yr(vs.all11Crosses)} · 35 variétés ${yr(vs.all35Fixed)} · N5 ${yr(vs.library5)} · 16 habitants ${yr(vs.all16Installed)} · V2 complet ${yr(vs.v2Complete)} · étape 5 ${va ? `${yr(va.stage5)} → ` : ''}${yr(vs.stage5)}`);
    const stageLine = (t) => (t.valley?.stageYears || []).map((x) => (Number.isFinite(x) ? x : '—')).join('/');
    console.log(`            étapes 1-5 (an, méd.) ${va ? `V1 ${stageLine(a)} → ` : ''}V1+V2 ${stageLine(b)} (étape 5 atteinte : ${vs.stage5Share} %) · signes de vie par an (méd.) ${b.rows.map((r) => r.valley?.signs ?? '—').join(' ')}`);
    const r10 = rowB(10);
    if (r10) console.log(`            an 10 : trocs ${r10.swaps} (≥ 4 : ${r10.swaps4} %), croisements ${r10.crosses} (≥ 1 : ${r10.crosses1} %), Grainothèque N${r10.library}, habitants du V2 ${r10.installedV2}`);
    if (strategy === 'handsOff') {
      const prof = (t) => t.rows.filter((r) => r.year >= 4 && r.year <= 7).reduce((s2, r) => s2 + r.netMean, 0) / 4;
      console.log(`            ferme laissée seule : bénéfice moyen par an (ans 4 à 7) ${n ? `sans ${Math.round(prof(n))} → ` : ''}V1 ${Math.round(prof(a))} → V1+V2 ${Math.round(prof(b))} (${delta(prof(a), prof(b))}${n ? ` ; par rapport à sans : ${delta(prof(n), prof(b))}` : ''})`);
    }
  }
}

/** Part de chaque culture dans les semis (points de %) : sans → avec ; écart le plus grand. */
export function sowShareShift(offCareersSown, onCareersSown) {
  const share = (sown) => {
    const tot = Object.values(sown).reduce((x, y2) => x + y2, 0) || 1;
    return Object.fromEntries(Object.entries(sown).map(([k, n]) => [k, (100 * n) / tot]));
  };
  const a = share(offCareersSown);
  const b = share(onCareersSown);
  let worst = { cropId: null, delta: 0 };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (Math.abs(d) > Math.abs(worst.delta)) worst = { cropId: k, delta: Math.round(d * 10) / 10 };
  }
  return worst;
}

/** (lot 4) Lanternes par année : parts 1 / 2 / 3 / 4 par critère, total médian, par robot. */
function printCareerLanterns(table) {
  const names = ['variété', 'soin', 'voisinage', 'beauté', 'prospérité'];
  console.log('\nLanternes de carrière : par critère, parts des années à 1 / 2 / 3 / 4 lanternes ; total médian');
  for (const [strategy, t] of Object.entries(table)) {
    const lit = t.cozy?.lanterns || [];
    if (!lit.length) continue;
    console.log(`  ${strategy.padEnd(9)} total médian ${median(lit.map((l) => l.total))} / 20 (${lit.length} années)`);
    names.forEach((nm, k) => {
      const parts = [1, 2, 3, 4].map((n) => `${String(pct(lit.filter((l) => l.values[k] === n).length, lit.length)).padStart(3)} %`);
      const vals = lit.map((l) => l.criteria[k]).filter((x) => x !== null && x !== undefined).sort((a2, b2) => a2 - b2);
      const q = (p2) => (vals.length ? Math.round(vals[Math.floor((vals.length - 1) * p2)] * 100) / 100 : '—');
      console.log(`             ${nm.padEnd(11)} ${parts.join('  ')}   (mesure : 20 % ${q(0.2)} · 55 % ${q(0.55)} · 90 % ${q(0.9)})`);
    });
  }
}

async function run() {
  const strategies = arg('strategy', null) ? String(arg('strategy')).split(',') : STRATEGIES;
  const helper = await loadStaffHelper();
  const surprisesArg = arg('surprises', null);
  const opts = {
    surprises: surprisesArg === null ? true : !['off', 'false', '0', 'non'].includes(String(surprisesArg)),
    strategies,
    runs: Number(arg('runs', 20)),
    years: Number(arg('years', 10)),
    difficulty: String(arg('difficulty', 'detente')),
    seasonLength: Number(arg('season', 7)),
    assumeObjectives: !!arg('assume-objectives', false),
    helper: helper || null,
    variety: arg('variety', null) === null ? true : parseVariety(arg('variety')),
    cozy: arg('cozy', null) === null ? true : parseCozy(arg('cozy')),
    valley: arg('valley', null) === null ? true : parseValley(arg('valley')),
    firstSeed: Number(arg('first-seed', 1)),
  };
  if (arg('compare-valley2', false)) {
    // (Vallée V2) Sans la Vallée → V1 seul → V1 + V2 (même graine). --jobs N : fils de travail.
    const jobs = Number(arg('jobs', 1));
    const sim = (o) => (jobs > 1 ? simulateCareerParallel({ ...o, jobs }) : Promise.resolve(simulateCareer(o)));
    const none = arg('no-none', false) ? null : await sim({ ...opts, valley: false });
    const off = await sim({ ...opts, valley: { seeds: true, wildlife: true, heritage: false } });
    const on = await sim({ ...opts, valley: true });
    if (arg('json', false)) {
      console.log(JSON.stringify({ none, off, on }, null, 2));
      return;
    }
    printCompareValley2(none, off, on, opts.years, `Vallée vivante (lot V2) — carrière ${opts.difficulty}, saisons de ${opts.seasonLength} jours : sans → V1 seul → V1 + V2 · ${opts.runs} carrières × ${opts.years} ans`);
    for (const strategy of Object.keys(on)) {
      const w = sowShareShift(off[strategy].sown || {}, on[strategy].sown || {});
      if (w.cropId) console.log(`  ${strategy.padEnd(9)} part des semis (V1 → V1+V2) : écart le plus grand ${w.cropId} ${w.delta >= 0 ? '+' : ''}${w.delta} points`);
    }
    return;
  }
  if (arg('compare-valley', false)) {
    const off = simulateCareer({ ...opts, valley: false });
    const on = simulateCareer({ ...opts, valley: opts.valley === false ? true : opts.valley });
    if (arg('json', false)) {
      console.log(JSON.stringify({ off, on }, null, 2));
      return;
    }
    printCompareValley(off, on, opts.years, `Vallée vivante (lot V1) — carrière ${opts.difficulty}, saisons de ${opts.seasonLength} jours : sans → avec · ${opts.runs} carrières × ${opts.years} ans`);
    for (const strategy of Object.keys(on)) {
      const w = sowShareShift(off[strategy].sown || {}, on[strategy].sown || {});
      if (w.cropId) console.log(`  ${strategy.padEnd(9)} part des semis : écart le plus grand ${w.cropId} ${w.delta >= 0 ? '+' : ''}${w.delta} points`);
    }
    return;
  }
  if (arg('compare-cozy', false)) {
    const off = simulateCareer({ ...opts, cozy: false });
    const on = simulateCareer({ ...opts, cozy: opts.cozy === false ? true : opts.cozy });
    if (arg('json', false)) console.log(JSON.stringify({ off, on }, null, 2));
    else printCompareLot4(off, on, opts.years, `Lot 4 — carrière : sans → avec (fêtes, hiver, lanternes, aider sans remplacer) · ${opts.runs} carrières × ${opts.years} ans`);
    return;
  }
  if (arg('compare-f1', false)) {
    const off = simulateCareer({ ...opts, cozy: { helpers: false } });
    const on = simulateCareer({ ...opts, cozy: true });
    if (arg('json', false)) console.log(JSON.stringify({ off, on }, null, 2));
    else printCompareLot4(off, on, opts.years, `Lot 4 — « aider sans remplacer » (F1) : sans → avec (fêtes et hiver des deux côtés) · ${opts.runs} carrières × ${opts.years} ans`);
    if (!arg('json', false) && opts.strategies.includes('handsOff')) {
      const h = handsOffSameFarm({ runs: opts.runs, helper: opts.helper, difficulty: opts.difficulty, seasonLength: opts.seasonLength });
      const keys = [...new Set([...Object.keys(h.incomeOff), ...Object.keys(h.incomeOn)])].filter((key) => Math.abs(h.incomeOff[key] || 0) + Math.abs(h.incomeOn[key] || 0) >= 50);
      console.log(`  même ferme laissée seule (construite 3 ans sans F1, puis ans 4 à 7) : bénéfice par an ${h.off} → ${h.on} (${h.off ? `${((100 * (h.on - h.off)) / Math.abs(h.off)).toFixed(0)} %` : '—'}) · ${keys.map((key) => `${key} ${Math.round(h.incomeOff[key] || 0)}→${Math.round(h.incomeOn[key] || 0)}`).join(' · ')}`);
    }
    return;
  }
  if (arg('lanterns', false)) {
    printCareerLanterns(simulateCareer(opts));
    return;
  }
  if (arg('compare-variety', false)) {
    const off = simulateCareer({ ...opts, variety: false });
    const on = simulateCareer({ ...opts, variety: opts.variety === false ? true : opts.variety });
    if (arg('json', false)) console.log(JSON.stringify({ off, on }, null, 2));
    else printCompareVariety(off, on, opts.years);
    return;
  }
  if (arg('compare-surprises', false)) {
    const off = simulateCareer({ ...opts, surprises: false });
    const on = simulateCareer({ ...opts, surprises: true });
    if (arg('json', false)) console.log(JSON.stringify({ off, on }, null, 2));
    else printCompareSurprises(off, on, opts.years);
    return;
  }
  if (arg('trace', false)) {
    const c = playCareer({ ...opts, strategy: strategies[0], seed: Number(arg('seed', 1)) });
    for (const y of c.years) console.log(JSON.stringify({ ...y, incomeBy: undefined }));
    console.log({ bankrupt: c.bankrupt, loans: c.loans, hardships: c.hardships, rescues: c.rescues, quests: c.quests, contests: c.contests, hearts: c.hearts, me: c.me });
    return;
  }
  if (arg('matrix', false)) {
    const results = [];
    // --difficulties detente,classique et --seasons 7,10,14 : une partie de la matrice (lancer plusieurs en parallèle).
    const listArg = (name, def) => (typeof arg(name, false) === 'string' ? String(arg(name)).split(',') : def);
    for (const difficulty of listArg('difficulties', ['detente', 'classique'])) {
      for (const seasonLength of listArg('seasons', [7, 10, 14]).map(Number)) {
        results.push({ label: `${difficulty} ${seasonLength} j`, table: simulateCareer({ ...opts, difficulty, seasonLength }) });
      }
    }
    if (arg('json', false)) console.log(JSON.stringify(results, null, 2));
    else printMatrix(results);
    return;
  }
  const table = simulateCareer(opts);
  if (arg('json', false)) {
    console.log(JSON.stringify(table, null, 2));
    return;
  }
  printPace(table);
  printTable(table, `Carrière — ${opts.difficulty}, saisons de ${opts.seasonLength} jours, ${opts.runs} carrières × ${opts.years} ans${opts.assumeObjectives ? ' (objectifs supposés remplis)' : ''}${helper ? ' (aide CORE-B : sim-career-staff.js)' : ''}`);
}

const { isMainThread } = await import('node:worker_threads');
const isMain = isMainThread && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) run();

// Fil de travail de simulateCareerParallel.
{
  const wt = await import('node:worker_threads');
  if (!wt.isMainThread && wt.workerData?.simWorker) {
    const helper = await loadStaffHelper();
    const { opts, tasks } = wt.workerData;
    const out = [];
    for (const t of tasks) {
      const c = playCareer({ ...opts, strategy: t.strategy, seed: t.seed, helper: helper || null });
      out.push({ ...c, strategy: t.strategy, seed: t.seed });
    }
    wt.parentPort.postMessage(out);
  }
}
