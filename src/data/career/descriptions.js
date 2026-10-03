// Mode Carrière — « Ce que fait ce bâtiment » : descriptions pour les fiches (données pures).
// Retours de joueurs (2026-09-30) : chaque fiche doit expliquer à quoi sert le bâtiment, la machine, l'atelier,
// l'animal ou l'aménagement, ce que donne chaque niveau, et un conseil. Lu par les requêtes de carrière
// (query.career.buildings(), machines(), machineCatalog(), shelters(), lotTypes(), investments(), about()).
//
// Pour chaque identifiant :
//   role  : une phrase courte « À quoi ça sert » (joueur tranquille, sans jargon)
//   tips  : un ou deux conseils
// et effectLines(kind, id, level) : les lignes « ce que donne ce niveau », CALCULÉES à partir des données
// (capacité, vitesse, revenus, déblocages) pour rester justes quand les chiffres sont réglés.

import { BUILDINGS_BY_ID, FARM_ITEMS } from './buildings.js';
import { MACHINES_BY_ID } from './machines.js';
import { CAREER_ANIMALS_BY_ID, COLLECT } from './animals.js';
import { LOT_TYPES_BY_ID } from './lots.js';
import { PRODUCTS } from '../products.js';
import { countNoun } from '../french.js';
import { F1 } from '../cozy.js';
import { HAND_BONUS } from './career.js';

const pct = (x) => `${Math.round(x * 100)} %`;
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const SEASON_NAMES = { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' };

// ── Textes ─────────────────────────────────────────────────────────────────────────────────────

/** Bâtiments (maison, grenier, étal, serre, chambre d'hôte, abris, ateliers). */
export const BUILDING_ABOUT = {
  house: {
    role: 'Votre maison : plus elle est grande, plus vous pouvez loger d\'employés.',
    tips: ['Agrandissez-la avant d\'embaucher : chaque employé a besoin d\'une chambre.', 'Le Manoir est l\'un des deux objectifs du rang Domaine.'],
  },
  storage: {
    role: 'Garde vos récoltes au lieu de les vendre tout de suite, pour les vendre plus cher plus tard.',
    tips: ['Réglez « Mettre au grenier » dans sa fiche : jamais, quand le cours est bas, ou toujours.', 'Hors saison, une récolte se vend 25 % plus cher ; au marché de Noël, le grenier se vend +25 %.'],
  },
  roadsideStand: {
    role: 'Votre étal au bord de la route : toutes vos récoltes se vendent plus cher, et les passants achètent un peu chaque jour.',
    tips: ['C\'est le premier achat conseillé : il rapporte dès le premier jour.', 'Les passants achètent surtout en été ; rien les jours d\'orage.'],
  },
  greenhouse: {
    role: 'Une serre vitrée (dès la Ferme familiale) : on y sème toutes les cultures, en toute saison, sans gel, pluie ni canicule.',
    tips: ['En hiver, la serre froide pousse deux fois moins vite : la serre chauffée pousse même mieux qu\'un champ.', 'Parfaite pour les tomates hors saison, vendues 25 % plus cher.'],
  },
  guestHouse: {
    role: 'Des chambres pour les touristes : elles rapportent chaque jour, surtout en été.',
    tips: ['Revenu doublé le jour de la fête du village.', 'Avec des chevaux à l\'écurie, les touristes font des balades (+8 par jour).'],
  },
  coop: {
    role: 'Le poulailler loge vos poules : elles pondent des œufs chaque jour, même en hiver.',
    tips: ['Touchez l\'abri pour ramasser les œufs : au-delà de 3 jours, la production du jour se perd.', 'Un soigneur ou un collecteur ramasse à votre place.'],
  },
  sheepfold: {
    role: 'La bergerie loge vos moutons : leur laine est tondue et vendue à la fin du printemps, de l\'été et de l\'automne.',
    tips: ['Rien à ramasser : la tonte est payée toute seule.'],
  },
  goatShed: {
    role: 'La chèvrerie loge vos chèvres : elles donnent du lait chaque jour.',
    tips: ['Avec une fromagerie, le lait devient du fromage de chèvre, plus rentable.'],
  },
  cowshed: {
    role: 'L\'étable loge vos vaches : elles donnent beaucoup de lait chaque jour.',
    tips: ['Avec une fromagerie, le lait devient du fromage de vache.', 'Une vache coûte un peu d\'entretien chaque jour.'],
  },
  pigsty: {
    role: 'La porcherie loge vos cochons : en automne et en hiver, ils trouvent des truffes.',
    tips: ['Une truffe vaut 60 pièces : touchez l\'abri pour les ramasser.'],
  },
  hutch: {
    role: 'Le clapier loge vos lapins : de la laine angora chaque jour, et des lapereaux à chaque saison.',
    tips: ['Un couple de lapins donne un petit à chaque début de saison, tant qu\'il y a de la place.'],
  },
  stable: {
    role: 'L\'écurie loge vos chevaux : ils tirent le semoir et la moissonneuse, et promènent les touristes.',
    tips: ['Un cheval suffit pour les machines de niveau 1, sans carburant.'],
  },
  duckPond: {
    role: 'La mare loge vos canards : des œufs de cane chaque jour, et vous pouvez pêcher une fois par jour.',
    tips: ['Touchez l\'eau pour pêcher : de 5 à 40 pièces.'],
  },
  jamWorkshop: {
    role: 'L\'atelier de confitures transforme vos fraises en confiture et vos pommes en jus, bien plus cher que la récolte.',
    tips: ['Les récoltes de fraises et de pommes y vont toutes seules tant qu\'il reste une place.', 'Chaque pot vendu compte pour l\'objectif « produits transformés ».'],
  },
  dairy: {
    role: 'La fromagerie transforme le lait de vos vaches et chèvres en fromages.',
    tips: ['Le lait part directement à la fromagerie à l\'aube : plus besoin de le ramasser.'],
  },
  mill: {
    role: 'Le moulin transforme votre blé en farine, puis en pain à partir du niveau 3.',
    tips: ['Semez du blé au printemps et en été pour le faire tourner.'],
  },
};

/** Machines. */
export const MACHINE_ABOUT = {
  sprinklers: { role: 'Arrosent les parcelles de ce terrain chaque matin : plus besoin d\'arroser à la main.', tips: ['Un petit entretien chaque jour, même éteints (gratuit avec le château d\'eau).'] },
  seeder: { role: 'Sème ce terrain selon son plan de culture, et achète les graines pour vous.', tips: ['Réglez le plan de culture dans la fiche du terrain (« même culture » par défaut).', 'Il faut un cheval ou le tracteur pour le tirer.'] },
  // (lot 4, F1) La récolte vous attend : la moissonneuse et la cueilleuse ne prennent que ce qui attend depuis quelques jours.
  harvester: { role: `Récolte ce qui attend depuis ${F1.machineDelay} jours sur ce terrain : rien ne reste jamais bloqué.`, tips: [`À la main, la récolte vaut ${Math.round((HAND_BONUS - 1) * 100)} % de plus : la moissonneuse vous la laisse d'abord.`] },
  fruitPicker: { role: `Cueille les fruits qui attendent depuis ${F1.machineDelay} jours au verger.`, tips: ['Aucune bête ni tracteur nécessaire.'] },
  collector: { role: 'Ramasse la production d\'un abri deux fois par jour : plus rien ne se perd.', tips: ['Idéal pour le poulailler et le clapier, qui se remplissent vite.'] },
  tractor: { role: 'Tire les machines de niveau 2 et aide vos jardiniers à travailler plus vite.', tips: ['Il consomme du carburant seulement les jours où il tire une machine.'] },
  waterTower: { role: 'Plus d\'entretien pour les arroseurs, et la serre est arrosée chaque matin.', tips: ['Rentable dès que vous avez beaucoup d\'arroseurs.'] },
  conveyor: { role: 'Remplit tout seul les places libres des ateliers avec le stock du grenier.', tips: ['Il prend d\'abord ce qui rapporte le plus.'] },
};

/** Animaux. */
export const ANIMAL_ABOUT = {
  hen: { role: 'Pond des œufs chaque jour, même en hiver.', tips: ['L\'animal le moins cher pour commencer : 2 poules sont offertes par Joseph.'] },
  rabbit: { role: 'Donne de la laine angora chaque jour et fait des petits.', tips: ['Achetez-les par deux : chaque couple donne un lapereau par saison.'] },
  duck: { role: 'Pond des œufs de cane chaque jour sur la mare.', tips: ['Il faut d\'abord aménager une mare.'] },
  goat: { role: 'Donne du lait chaque jour (fromage de chèvre avec une fromagerie).', tips: ['Moins chère que la vache, avec un petit entretien.'] },
  cow: { role: 'Donne beaucoup de lait chaque jour (fromage de vache avec une fromagerie).', tips: ['Chaque vache coûte 3 d\'entretien par jour : elle rapporte bien plus.'] },
  sheep: { role: 'Sa laine est tondue et vendue trois fois par an, sans rien à ramasser.', tips: ['Tonte à la fin du printemps, de l\'été et de l\'automne.'] },
  pig: { role: 'Cherche des truffes en automne et en hiver.', tips: ['Plus vous avez de cochons, plus vous trouvez de truffes.'] },
  horse: { role: 'Tire le semoir et la moissonneuse, et promène les touristes de la chambre d\'hôte.', tips: ['Pas de carburant, contrairement au tracteur.'] },
};

/** Aménagements de la ferme sans niveau. */
export const ITEM_ABOUT = {
  beehive: { role: 'Donne du miel hors hiver, et fait pousser toute la ferme un peu plus vite.', tips: ['Au plus 2 ruches par champ.'] },
  solarPanel: { role: 'Réduit vos charges de chaque jour.', tips: ['Il ne réduit ni les salaires ni le carburant.'] },
};

/** Aménagements de terrain. */
export const LOT_TYPE_ABOUT = {
  wild: { role: 'Un terrain laissé en friche : rien à faire, rien à payer en plus. Aménagez-le quand vous voulez.', tips: [] },
  field: { role: 'Un champ labouré de 16 parcelles, prêtes à semer.', tips: ['Ajoutez des arroseurs, un semoir et une moissonneuse pour qu\'il travaille seul.'] },
  meadow: { role: 'Un pré avec deux emplacements pour des abris d\'animaux ou la chambre d\'hôte.', tips: ['Chaque espèce a son abri (poulailler, étable, bergerie…).'] },
  orchard: { role: 'Un verger de 9 emplacements pour des pommiers : ils donnent des fruits pendant des années.', tips: ['Un pommier met du temps à grandir, puis donne sans être resemé.'] },
  workshops: { role: 'Une cour pavée avec deux emplacements d\'ateliers (confitures, fromagerie, moulin).', tips: ['Les produits transformés se vendent bien plus cher que les récoltes.'] },
  pond: { role: 'Une mare pour les canards, avec un ponton pour pêcher chaque jour.', tips: ['La mare se construit avec son abri : il ne reste qu\'à acheter des canards.'] },
  greenhouse: { role: 'Une serre vitrée pour cultiver toute l\'année, même en hiver.', tips: ['Agrandissez-la puis chauffez-la dans sa fiche.'] },
};

// ── Lignes « ce que donne ce niveau » (calculées) ─────────────────────────────────────────────

function productsOf(buildingId, level) {
  return PRODUCTS.filter((p) => p.building === buildingId && (!p.minLevel || level >= p.minLevel) && (!p.maxLevel || level <= p.maxLevel));
}

function incomeLine(income, factor, what) {
  const parts = Object.entries(income).filter(([, v]) => v > 0).map(([sid, v]) => `${Math.round(v * factor)} ${SEASON_NAMES[sid]}`);
  return parts.length ? `${what} : ${parts.join(', ')} par jour` : null;
}

/** Lignes d'un bâtiment au niveau `level` (1 → max). */
export function buildingLines(id, level) {
  const def = BUILDINGS_BY_ID[id];
  if (!def) return [];
  const lv = Math.max(1, Math.min(def.levels.length, level || 1));
  const d = def.levels[lv - 1];
  const out = [];
  switch (def.category) {
    case 'house':
      out.push(d.staff > 0 ? `Loge jusqu'à ${plural(d.staff, 'employé')}` : 'Pas encore de chambre pour un employé');
      out.push(`Un employé devient las après ${d.tiredDays} jours de travail d'affilée`);
      if (d.yearEcus) out.push(`+${d.yearEcus} écus au bilan de chaque année`);
      break;
    case 'storage':
      out.push(`Garde jusqu'à ${plural(d.capacity, 'récolte')}`);
      out.push('Vend quand vous le décidez (cours du jour, hors saison +25 %)');
      break;
    case 'sales':
      out.push(`Toutes vos récoltes se vendent +${pct(d.priceBonus)}`);
      out.push(incomeLine(def.income, d.passersby, 'Passants'));
      break;
    case 'greenhouse':
      out.push(`${plural(d.plots, 'parcelle')} sous verre, toutes cultures en toute saison`);
      out.push(d.winterGrowth >= 1 ? `Pousse × ${String(d.winterGrowth).replace('.', ',')} toute l'année, hiver compris` : `Pousse deux fois moins vite en hiver`);
      if (d.heating) out.push(`Chauffage : ${d.heating} pièces par jour d'hiver`);
      break;
    case 'guests': {
      out.push(incomeLine(def.income, d.incomeFactor, 'Touristes'));
      const upkeep = def.upkeepByLevel?.[lv - 1];
      if (upkeep) out.push(`Entretien : ${upkeep} par jour`);
      break;
    }
    case 'shelter': {
      const a = CAREER_ANIMALS_BY_ID[def.animal];
      out.push(`Loge jusqu'à ${countNoun(d.animals, (a?.name || def.animal).toLowerCase())}`);
      if (a?.collect) out.push(`Garde jusqu'à ${COLLECT.capDays} jours de production à ramasser`);
      break;
    }
    case 'workshop': {
      out.push(`${plural(d.places, 'place')} de travail en même temps`);
      const prods = productsOf(id, lv);
      if (prods.length) out.push(`Fabrique : ${prods.map((p) => `${p.name.toLowerCase()} (${p.value} pièces, ${plural(p.days, 'jour')})`).join(', ')}`);
      break;
    }
    default:
      break;
  }
  return out.filter(Boolean);
}

/** Lignes d'une machine au niveau `level`. */
export function machineLines(id, level) {
  const def = MACHINES_BY_ID[id];
  if (!def) return [];
  const lv = Math.max(1, Math.min(def.levels.length, level || 1));
  const d = def.levels[lv - 1];
  const out = [d.text];
  if (d.requires === 'puller') out.push('Tirée par un cheval ou le tracteur');
  if (d.requires === 'tractor') out.push('Tirée par le tracteur');
  if (def.fuel) out.push(`Carburant : ${def.fuel} par jour de travail`);
  if (def.upkeep) out.push(`Entretien : ${def.upkeep} par jour`);
  return out;
}

/** Lignes d'un animal (pas de niveau). */
export function animalLines(id) {
  const a = CAREER_ANIMALS_BY_ID[id];
  if (!a) return [];
  const out = [];
  const perDay = Math.max(...Object.values(a.income || {}));
  if (perDay > 0) out.push(`${a.productName || 'Production'} : ${perDay} pièces par jour`);
  if (a.effects?.shearing) out.push(`Tonte : ${a.effects.shearing} pièces, 3 fois par an`);
  if (a.truffles) out.push(`Truffes : ${pct(a.truffles.chance)} de chance par jour en automne et en hiver, ${a.truffles.value} pièces`);
  if (a.breeding) out.push('Un petit par couple à chaque saison');
  if (a.rides) out.push(`Balades : +${a.rides.perDay} par jour avec la chambre d'hôte`);
  if (a.traction) out.push('Tire le semoir et la moissonneuse (niveau 1)');
  if (a.upkeep) out.push(`Entretien : ${a.upkeep} par jour`);
  out.push(`Prix : ${a.price.base}${a.price.step ? ` (+${a.price.step} par animal déjà acheté)` : ''}`);
  return out;
}

/** Lignes d'un aménagement de la ferme (ruche, panneau). */
export function itemLines(id) {
  const it = FARM_ITEMS.find((x) => x.id === id);
  if (!it) return [];
  const out = [];
  const inc = incomeLine(it.income || {}, 1, 'Revenu');
  if (inc) out.push(inc);
  if (it.effects?.growthBonus) out.push(`Toute la ferme pousse +${pct(it.effects.growthBonus)} (hors hiver)`);
  if (it.effects?.chargeReduction) out.push(`Charges : −${it.effects.chargeReduction} par jour`);
  return out;
}

/** Lignes d'un aménagement de terrain. */
export function lotTypeLines(type) {
  const t = LOT_TYPES_BY_ID[type];
  if (!t) return [];
  const out = [];
  if (t.plots) out.push(`${plural(t.plots.count, t.plots.env === 'orchard' ? 'emplacement d\'arbre' : 'parcelle', t.plots.env === 'orchard' ? 'emplacements d\'arbre' : 'parcelles')}`);
  if (t.slots) out.push(`${plural(t.slots, 'emplacement')} de bâtiment`);
  if (t.building) out.push(`Avec ${(BUILDINGS_BY_ID[t.building]?.name || t.building).toLowerCase()} (niveau 1)`);
  if (t.cost) out.push(`Aménagement : ${t.cost} pièces`);
  if (Number.isFinite(t.max)) out.push(`Au plus ${t.max} dans la ferme`);
  if (!out.length) out.push('Rien à aménager ni à payer : herbe haute, souches et fleurs sauvages');
  return out;
}

// ── Accès commun ───────────────────────────────────────────────────────────────────────────────

const ABOUT = { building: BUILDING_ABOUT, machine: MACHINE_ABOUT, animal: ANIMAL_ABOUT, item: ITEM_ABOUT, lotType: LOT_TYPE_ABOUT };

/** Nombre de niveaux d'un élément (1 pour ce qui n'a pas de niveau). */
function levelCount(kind, id) {
  if (kind === 'building') return BUILDINGS_BY_ID[id]?.levels.length || 0;
  if (kind === 'machine') return MACHINES_BY_ID[id]?.levels.length || 0;
  return 1;
}

/** Lignes « ce que donne ce niveau ». */
export function effectLines(kind, id, level = 1) {
  switch (kind) {
    case 'building': return buildingLines(id, level);
    case 'machine': return machineLines(id, level);
    case 'animal': return animalLines(id);
    case 'item': return itemLines(id);
    case 'lotType': return lotTypeLines(id);
    default: return [];
  }
}

/**
 * Description complète d'un élément (fiche « Ce que fait ce bâtiment »).
 * → null | { kind, id, role, tips: [..], effectLines: [..] (niveau `level`, niveau 1 si 0),
 *            nextEffectLines: null | [..], levels: [{ level, name, cost, rank, lines }] }
 */
export function describe(kind, id, level = 1) {
  const about = ABOUT[kind]?.[id];
  if (!about) return null;
  const max = levelCount(kind, id);
  const lv = Math.max(1, Math.min(max, level || 1));
  const levels = [];
  if (kind === 'building' || kind === 'machine') {
    const defLevels = kind === 'building' ? BUILDINGS_BY_ID[id].levels : MACHINES_BY_ID[id].levels;
    defLevels.forEach((d, k) => levels.push({ level: k + 1, name: d.name || `Niveau ${k + 1}`, cost: d.cost, rank: d.rank, lines: effectLines(kind, id, k + 1) }));
  }
  return {
    kind,
    id,
    role: about.role,
    tips: [...about.tips],
    effectLines: effectLines(kind, id, lv),
    nextEffectLines: level >= 1 && level < max ? effectLines(kind, id, level + 1) : null,
    levels,
  };
}

/** Tous les identifiants décrits, par genre (tests : chaque bâtiment, machine, animal… a sa description). */
export const DESCRIBED = Object.fromEntries(Object.entries(ABOUT).map(([k, v]) => [k, Object.keys(v)]));

/**
 * Champs ajoutés aux lignes des requêtes (buildings(), machines(), machineCatalog(), shelters(), lotTypes(),
 * investments()) : { role, tips, effectLines, nextEffectLines, levelLines }. `level` 0 (pas encore construit ou
 * acheté) : effectLines = ce que donnerait le niveau 1, nextEffectLines = null.
 */
export function aboutFields(kind, id, level = 1) {
  const d = describe(kind, id, level);
  if (!d) return { role: null, tips: [], effectLines: [], nextEffectLines: null, levelLines: [] };
  return { role: d.role, tips: d.tips, effectLines: d.effectLines, nextEffectLines: d.nextEffectLines, levelLines: d.levels };
}
