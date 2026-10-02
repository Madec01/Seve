// Mode Carrière — lot 2 « Toucher & surprises » : extension (id 'surprises') et trouvailles au défrichage (B6).
// Pur. Règles : docs/GAME_DESIGN.md, « Lot 2 — surprises » ; contrat : docs/ARCHITECTURE.md, « Lot 2 — contrats ».
//
// Le reste du lot 2 (qualité, géants, surprises de l'aube, météos spéciales, vœux) est partagé avec les niveaux
// (src/core/surprises.js) et appelé directement par src/core/career/runtime.js. Ici :
//   - fournisseur priceFactor : heure dorée → récoltes et grenier × 1,2 ce jour-là ;
//   - point d'accroche water : terrains avec un vieux puits → cultures arrosées chaque aube ;
//   - trouvailles à l'achat d'un terrain (lotFinds, appelé par l'action buyLot) ;
//   - sauvegarde : state.career.heirlooms (bocaux de graines anciennes), state.surprises des anciennes carrières.

import { CROPS, getCrop, isTreeCrop } from '../../data/crops.js';
import { ECUS_IF_OWNED, FINDS, FINDS_BY_ID, FINDS_RULES, FIND_VALUES, FOUND_COSMETICS, SKY } from '../../data/surprises.js';
import { inGreenhouse, isMature, needsWaterToday } from '../farm.js';
import { stream } from '../rng.js';
import { checkSurprises, chestReward, completeSurprises, enableSurprises } from '../surprises.js';
import { getCareerInvestment } from './effects.js';
import { shelterCapacity } from './buildings.js';
import { registerCareerExtension } from './registry.js';

/** Animal que l'agneau perdu peut devenir (mouton s'il y a de la place à la bergerie, sinon poule), ou null. */
function lambAnimal(state) {
  for (const id of ['sheep', 'hen']) {
    const inv = getCareerInvestment(id);
    if (!inv || !inv.shelter || !state.career.buildings[inv.shelter]) continue;
    if (shelterCapacity(state, inv.shelter) - (state.investments[id] || 0) > 0) return id;
  }
  return null;
}

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

/**
 * Trouvailles à l'achat d'un terrain : 1 ou 2 (sans remise ; puits, statue et agneau une fois par ferme).
 * Effets appliqués tout de suite ; événement `finds`. → [{ kind, title, text, icon, … }]
 */
export function lotFinds(api, lotId) {
  const { state } = api;
  const s = state.surprises;
  if (!s) return [];
  const lot = state.career.lots.find((l) => l.id === lotId);
  const rng = stream(state.rng, 'surprise');
  const count = rng.chance(FINDS_RULES.secondChance) ? 2 : 1;
  const done = new Set();
  const finds = [];
  for (let k = 0; k < count; k++) {
    const weights = {};
    for (const f of FINDS) {
      if (done.has(f.id)) continue;
      if (f.once && (s.stats.finds[f.id] || 0) > 0) continue;
      weights[f.id] = f.weight;
    }
    if (!Object.keys(weights).length) break;
    const id = rng.weighted(weights);
    done.add(id);
    const def = FINDS_BY_ID[id];
    const out = { kind: id, title: def.name, icon: def.icon };
    switch (id) {
      case 'chest': {
        const r = chestReward(state, rng);
        if (r.amount) {
          out.amount = r.amount;
          api.earn('other', r.amount);
        } else out.ecus = r.ecus;
        out.text = fill(def.text, { reward: r.reward });
        break;
      }
      case 'coins': {
        out.amount = rng.int(FIND_VALUES.coins[0], FIND_VALUES.coins[1]) + FIND_VALUES.perLot * state.career.lotsBought;
        api.earn('other', out.amount);
        out.text = fill(def.text, { amount: out.amount });
        break;
      }
      case 'seedjar': {
        const pool = CROPS.filter((c) => !isTreeCrop(c));
        const crop = pool[rng.int(0, pool.length - 1)];
        state.career.heirlooms.push({ cropId: crop.id, lotId, year: state.time.year, day: state.time.day });
        Object.assign(out, { cropId: crop.id, cropName: crop.name });
        out.text = fill(def.text, { crop: crop.name.toLowerCase() });
        break;
      }
      case 'well': {
        if (!s.wells.includes(lotId)) s.wells.push(lotId);
        out.lotId = lotId;
        out.text = def.text;
        break;
      }
      case 'statue': {
        s.found.statue = true;
        Object.assign(out, { cosmeticId: FOUND_COSMETICS.statue, ecusIfOwned: ECUS_IF_OWNED });
        out.text = def.text;
        break;
      }
      case 'lamb': {
        const animal = lambAnimal(state);
        if (animal) {
          state.investments[animal] = (state.investments[animal] || 0) + 1;
          api.refreshLevel();
          out.animal = animal;
          out.text = animal === 'sheep' ? 'Un agneau perdu vous suit jusqu\'à la bergerie : il reste avec vous !' : 'Un agneau perdu… était une poule ! Elle rejoint le poulailler.';
        } else {
          out.amount = FIND_VALUES.coins[0];
          api.earn('other', out.amount);
          out.text = `Un agneau perdu : son berger vous remercie avec ${out.amount} pièces.`;
        }
        break;
      }
      default:
        break;
    }
    s.stats.finds[id] = (s.stats.finds[id] || 0) + 1;
    finds.push(out);
  }
  if (finds.length) api.push('finds', { lotId, lotName: lot?.name || lotId, finds: JSON.parse(JSON.stringify(finds)) });
  return finds;
}

/** Point d'accroche water : les terrains au vieux puits sont arrosés (cultures qui en ont besoin aujourd'hui). */
function wellWater(api, { weather }) {
  const { state } = api;
  const wells = state.surprises?.wells;
  if (!wells || !wells.length) return [];
  const done = [];
  state.plots.forEach((p, i) => {
    if (!wells.includes(p.lot) || !p.unlocked || !p.env || !p.cropId || p.watered) return;
    const crop = getCrop(p.cropId);
    if (isTreeCrop(crop) || isMature(p)) return;
    if (!needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : weather, api.level)) return;
    p.watered = true;
    done.push(i);
  });
  return done;
}

export const surprisesExtension = {
  id: 'surprises',
  init(state) {
    if (!Array.isArray(state.career.heirlooms)) state.career.heirlooms = [];
  },
  migrate(state) {
    if (!Array.isArray(state.career.heirlooms)) state.career.heirlooms = [];
    // Carrière d'avant le lot 2 : les surprises s'activent à la reprise.
    if (state.surprises === undefined && state.rng && typeof state.rng === 'object') enableSurprises(state);
    else if (state.surprises) completeSurprises(state);
  },
  check(state) {
    const h = state.career.heirlooms;
    if (!Array.isArray(h) || !h.every((x) => x && typeof x === 'object' && getCrop(x.cropId) && typeof x.lotId === 'string')) return 'graines anciennes';
    const lots = new Set(state.career.lots.map((l) => l.id));
    if (state.surprises && !state.surprises.wells.every((id) => lots.has(id))) return 'puits';
    return checkSurprises(state);
  },
  hooks: { water: wellWater },
  providers: {
    priceFactor(state, { kind }) {
      if (kind !== 'crop' && kind !== 'stock') return 1;
      return state.surprises?.sky?.today === 'goldenhour' ? SKY.goldenPrice : 1;
    },
  },
};

registerCareerExtension(surprisesExtension);
