// Mode Carrière — déroulé des journées et interface publique (pur). Créé par wrap() de src/core/game.js
// quand state.mode === 'career' ; une partie de niveau ne passe jamais par ici.
//
// ── Déroulé d'une journée (carrière) ───────────────────────────────────────────────────────────────
// update(dt) : le temps avance en tranches ; chaque tranche (from, to] d'une même journée est passée aux
// points d'accroche `tick` (tâches des employés, passages des machines…), dans l'ordre chronologique ;
// un grand dt enchaîne tranches, fins de journée et aubes.
//
// Fin de journée (le soir) :
//   `evening` (extensions : comice le dernier jour d'automne, offres qui expirent…) ;
//   dernier jour de la saison → charges de saison, dans cet ordre, chaque étape seulement si la
//   précédente ne suffit pas :
//     1. ateliers vendus en l'état (processingSoldRaw, raison 'rent') ;
//     2. grenier vendu au cours du jour, cultures les moins chères d'abord, juste ce qu'il faut
//        (stockSold, raison 'charges') ;
//     3. (Détente) Joseph prête (src/core/neighbour.js, plafond max(100, charges) ; ×2 à 4 ♥ ; 0 % à 6 ♥) ;
//     Classique : il manque encore → FAILLITE (status 'bankrupt', événement bankrupt { career: true, … }) ;
//     5. (Détente) l'argent est encore sous −(charges) → vente de secours : animaux puis machines
//        rachetés à 50 % du prix payé, du plus récent au plus ancien, jusqu'à revenir à 0 (rescueSale) ;
//     paiement (billPaid { career: true, detail }) ; 4. argent négatif → coup dur (hardship
//     { stage: 'overdraft' }) : employés et machines à l'arrêt (l'extension lit api.isPaused()) jusqu'à
//     ce que l'argent repasse au-dessus de 50 (hardship { stage: 'recovered' }) ;
//   dernier jour de l'hiver → fin de l'année : bilan (yearEnd { year, report }), state.time.year + 1,
//     statistiques de l'année remises à zéro ; la dette de Joseph suit (pas d'effacement).
//
// Aube (dans cet ordre) :
//   1. pousse (serre : ni météo ni gel, pousse du niveau de la serre) ;
//   2. jour suivant (après l'hiver : printemps de l'année suivante) ; nouvelle saison → seasonStart, gel
//      (hors serre), `seasonStart` des extensions ;
//   3. météo ; 3 bis. `dawnEvents` des extensions ; 5. pluie (hors serre) ; 6. cours du marché ;
//   7. `water` des extensions (arroseurs) ; 8. ateliers (produits vendus) puis `afterProcessing` ;
//   9. revenus (animaux — sauf si une extension les fait ramasser —, miel, passants de l'étal, chambre
//      d'hôte) + `incomes` des extensions ; le lait remplit la fromagerie ;
//  10. charges quotidiennes (ferme + entretien − panneaux, chauffage) + `charges` des extensions
//      (salaires, carburant : JAMAIS prélevés si l'argent est négatif) ; part de Joseph sur les produits ;
//  11. `dawn` des extensions ; fin du coup dur si l'argent ≥ 50 ; événements weather, dawn,
//      moneyChanged (un seul pour toute l'aube), rangs (rankUp), seasonWarning.

import { DAY_SECONDS, EPSILON, SEASONS, WARNING_DAYS } from '../../data/balance.js';
import { getCrop, isRareCrop, isTreeCrop, isValleyTree } from '../../data/crops.js';
import { PLACES_TEXTS } from '../../data/career/places.js';
import { treesUnlocked } from './places.js';
import { CROW_PENALTY, HARDSHIP, MAX_STAFF } from '../../data/career/career.js';
import { BUILDINGS, BUILDINGS_BY_ID } from '../../data/career/buildings.js';
import { FARM_NAME_MAX } from '../../data/cosmetics.js';
import { stream } from '../rng.js';
import { advanceDay, daysLeftInSeason, isLastDayOfSeason, isLastSeason, seasonId, tomorrowSeasonIndex } from '../calendar.js';
import { drawWeather, weatherWaters } from '../weather.js';
import { applyFrost, clearPlot, growPlots, harvestValue, inGreenhouse, isMature, needsWaterToday, plotUnlockCost, rainWater, rawUnitPrice, wouldFatigue, yieldFactor } from '../farm.js';
import { setTree } from '../trees.js';
import { advanceProcessing, fillMilk, tryProcessHarvest } from '../processing.js';
import { addHarvest, addLost, addProductSold, addStat, buildSummary, createStats, noteSeasonHarvest } from '../stats.js';
import { borrow, loanAmount, repay, repaymentFrom, willLend } from '../neighbour.js';
import { autoPauseAfterDawn } from '../options.js';
import { careerDailyCharges, careerDifficulty, careerIncomes, careerInvestments, seasonChargeDetail } from './effects.js';
import { careerFlag, hooksOf, providedFactor, careerExtensions } from './registry.js';
import { updateCareerMarket, isOffSeason, marketInfo } from './market.js';
import { animalCount, buildOnSlot, buildOptions, buildingInfo, careerNextCost, checkBuyCareer, itemMax, rankLabel, shelterCapacity, staffCapacity, storageCapacity, upgradeBuilding } from './buildings.js';
import { aboutFields, describe } from '../../data/career/descriptions.js';
import { buyLot, developLot, getLot, gridInfo, lotPlots, lotTypeName, lotTypesFor, nextLotInfo, saleLots, setPlan } from './land.js';
import { cropRank } from './level.js';
import { checkRanks, patrimony, rankSummary } from './ranks.js';
import { addStock, sellStock, sellStockFor, setStorageMode, stockInfo, stockUsed, wouldStore } from './storage.js';
import { emptyYearStats } from './save.js';
import {
  advanceSky, applyGrowthCare, dawnSurprise, expireEffects, expireForage, fogForage, giantAt, growthSnapshot, newWish, noteSown,
  recordQuality, rollQuality, skyGrowthFactor, specialInfo, takeForage, tryGiant, validateGiants, giantOpenToHelpers, GIANT,
} from '../surprises.js';
import { careOf } from '../surprises.js';
import { autoKeepOrders, checkMedals, consumeSow, freeSowKind, noteHarvest, noteVariety, varietyWater } from '../variety.js';
import { claimPreview, claimUnits } from '../requests.js';
import { themeGiantValueFactor } from '../variety-effects.js';
import { careerNextTheme, careerVarietyHost, careerVarietyYear } from './variety-host.js';
import { handBonusOf, helpersOn, waitInfo, waitedDawns } from './handwork.js';
import { noteCozyHarvest, noteCozyProduct, takeFromSeedBank } from '../cozy.js';
import { careerCozyYear } from './cozy.js';
import { careerValleyYear, lotNature, valleyHarvest, valleyPlotExtras, valleySow } from './valley.js';
import { dryGrowthOf as heirloomDryGrowth, planVariety, priceFactorOf, scentedFactorOf } from './heirlooms.js';

/** Postes du bilan de l'année → statistiques des niveaux (buildSummary). */
const STAT_OF_INCOME = { crops: 'harvestIncome', products: 'productIncome', stock: 'rawSales', contest: 'contestPrize' };
const STAT_OF_SPENT = { seeds: 'seedsSpent', charges: 'charges', wages: 'charges', fuel: 'charges', heating: 'charges', seasonCharges: 'rentsPaid', water: 'waterSpent', develop: 'plotsSpent', lots: 'plotsSpent' };

/** Noms des contrats des lots CORE-B / CORE-C : actions « pas encore disponibles » tant qu'ils n'ont pas livré. */
const PENDING_ACTIONS = ['buyMachine', 'upgradeMachine', 'setMachine', 'collect', 'chaseCrow', 'fish', 'hire', 'fire', 'assign', 'setLeave', 'setTeamLeave', 'acceptOffer', 'declineOffer', 'deliverOffer', 'acceptQuest', 'declineQuest', 'deliverQuest'];

/**
 * @param core fourni par game.js : { state, getLevel, refreshLevel, getCrops, push, flush, changeMoney, fail,
 *   playing, ENDED, sellAllRaw, seedCostOf }
 */
export function createCareerRuntime(core) {
  const { state, push, fail } = core;
  const L = () => core.getLevel();
  const c = () => state.career;

  // ── Argent : pendant l'aube, un seul moneyChanged pour toute l'aube ──
  let moneyBatch = false;
  function changeMoney(delta) {
    if (delta === 0) return;
    if (moneyBatch) state.money += delta;
    else core.changeMoney(delta);
  }

  function account(kind, key, amount) {
    const ys = c().yearStats;
    const book = kind === 'income' ? ys.incomeBy : ys.spentBy;
    book[key] = (book[key] || 0) + amount;
  }

  function earn(key, amount) {
    if (!(amount > 0)) return;
    account('income', key, amount);
    const stat = STAT_OF_INCOME[key] || 'investmentIncome';
    addStat(state, stat, amount);
    changeMoney(amount);
  }

  /**
   * Dépense (achat, charge) : argent, bilan de l'année, statistiques ; `asset` : valeur comptée dans le
   * patrimoine ('buildings' | 'machines' | 'animals') ; `log` : { kind: 'animal'|'machine', id, key? } pour la
   * vente de secours (du plus récent au plus ancien).
   */
  function spend(key, amount, { asset = null, log = null } = {}) {
    if (!(amount > 0)) return;
    account('spent', key, amount);
    addStat(state, STAT_OF_SPENT[key] || 'investmentsSpent', amount);
    changeMoney(-amount);
    if (asset) c().paid[asset] = (c().paid[asset] || 0) + amount;
    if (log) c().assetLog.push({ ...log, price: amount, year: state.time.year, day: state.time.day });
  }

  function repayJoseph(saleAmount, source = 'harvest') {
    const part = repaymentFrom(state, L(), saleAmount);
    if (!(part > 0)) return 0;
    const done = repay(state, part);
    changeMoney(-part);
    push('loanRepayment', { amount: part, remaining: state.neighbourLoan.debt, source });
    if (done) {
      push('loanRepaid', { total: state.neighbourLoan.repaid, borrowed: state.neighbourLoan.borrowed, loans: state.neighbourLoan.loans, source });
      c().joseph.loansRepaid = (c().joseph.loansRepaid || 0) + 1;
    }
    return part;
  }

  /** Coup dur en cours (employés et machines à l'arrêt) : argent négatif, ou pas encore remonté à 50. */
  function isPaused() {
    return state.money < 0 || (!!c().hardship && state.money < HARDSHIP.recoverMoney);
  }

  function checkRecovery() {
    if (c().hardship && state.money >= HARDSHIP.recoverMoney) {
      c().hardship = null;
      push('hardship', { stage: 'recovered', money: state.money });
    }
  }

  function seedCost(crop) {
    const base = core.seedCostOf(crop);
    const f = providedFactor('seedFactor', state, crop.id);
    return f === 1 ? base : Math.max(1, Math.round(base * f));
  }

  function validPlot(i) {
    return Number.isInteger(i) && i >= 0 && i < state.plots.length && state.plots[i].env !== null;
  }

  // ── Actions de la parcelle (joueur, employés, machines) ──
  function plant(plotIndex, cropId, { by = 'player', heirloom = null } = {}) {
    if (!core.playing()) return fail(core.ENDED);
    // (Vallée vivante) Semis d'une variété ancienne ('heirloom:<id>' : plan de culture, semoir, jardiniers, joueur).
    const planned = state.career.valley ? planVariety(cropId) : null;
    if (planned) return valleySow(api, plotIndex, planned, { by });
    if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
    const p = state.plots[plotIndex];
    if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
    if (p.cropId) return fail('Cette parcelle est déjà plantée.');
    // (Vallée vivante) Jachère fleurie : seul le joueur sème par-dessus (elle s'arrête, sans sol reposé).
    if (p.fallow !== undefined && by !== 'player') return fail('Jachère fleurie : la parcelle fleurit jusqu\'à la fin de la saison.');
    // (lot 2) Champignons : le joueur les cueille d'abord ; un salarié ou une machine qui sème là les ramasse
    // pour vous (payés), pour qu'un champ tenu par les machines ne soit jamais bloqué.
    if (p.forage && by === 'player') return fail('Cueillez d\'abord les champignons.');
    const crop = getCrop(cropId);
    if (!crop) return fail('Culture inconnue.');
    // (lot 3) Graine rare du colporteur : à la main seulement (jamais le semoir ni les jardiniers), une graine du sachet.
    const rare = !!state.variety && isRareCrop(crop.id);
    if (rare && by !== 'player') return fail('Les graines rares se sèment à la main.');
    if (rare && freeSowKind(state, crop.id) !== 'rare') return fail('Plus de graines rares : le colporteur en vend.');
    // (Vallée V3) Cerisier et poirier du verger conservatoire : plantés à la main, une fois débloqués par le verger.
    const valleyTree = !!state.career.valley && isValleyTree(crop.id);
    if (valleyTree && (by !== 'player' || !treesUnlocked(state).includes(crop.id))) return fail(PLACES_TEXTS.treeLocked[crop.id]);
    // (Vallée vivante) Une variété ancienne se sème quel que soit le rang de sa culture (cadeau de la vallée).
    if (!rare && !heirloom && !valleyTree && !core.getCrops().includes(crop)) {
      const r = cropRank(crop.id);
      return fail(r ? `${crop.name} : ${rankLabel(r)}` : 'Culture inconnue.');
    }
    const tree = isTreeCrop(crop);
    if (p.env === 'orchard' && !tree) return fail('Le verger n\'accueille que des arbres.');
    if (p.env !== 'orchard' && tree) return fail('Les arbres se plantent au verger.');
    const sid = seasonId(state);
    if (!inGreenhouse(p) && !crop.seasons.includes(sid)) return fail(`${crop.name} : ne se plante pas ${seasonLabel(sid)}.`);
    // (lot 3) Semis offert (visiteur du thème) : à la main seulement, sans payer.
    const freeSow = state.variety && by === 'player' && !tree && !heirloom ? freeSowKind(state, crop.id) : null;
    // (lot 4) Réserve de graines (foire aux graines) : tout semis de cette culture la prend d'abord, sans payer.
    const fromBank = !heirloom && !freeSow && !rare && !!state.cozy && (state.cozy.seedBank?.[crop.id] || 0) > 0;
    const cost = heirloom ? heirloom.cost : freeSow || fromBank ? 0 : seedCost(crop);
    if (state.money < cost) return fail(notEnough(cost - state.money));
    if (fromBank) takeFromSeedBank(state, crop.id);
    if (p.forage) {
      const f = takeForage(state, plotIndex);
      if (f) {
        earn('other', f.value);
        push('foragePicked', { plotIndex, kind: f.kind, amount: f.value, by });
      }
    }
    const fallowCancelled = p.fallow !== undefined;
    if (fallowCancelled) delete p.fallow;
    if (tree) setTree(state, p, crop.id);
    else {
      p.cropId = crop.id;
      p.growth = 0;
      p.fatigued = wouldFatigue(L(), p, crop.id);
      p.watered = !inGreenhouse(p) && weatherWaters(state.weather.today);
      p.insured = false;
      noteSown(state, plotIndex);
    }
    if (heirloom) p.variety = heirloom.id;
    addStat(state, 'cropsPlanted', 1);
    spend('seeds', cost);
    const sow = freeSow ? consumeSow(state, crop.id) : fromBank ? { fromBank: true, bankLeft: state.cozy.seedBank[crop.id] || 0 } : null;
    const vf = heirloom || fallowCancelled ? { ...(heirloom ? { variety: heirloom.id } : {}), ...(fallowCancelled ? { fallowCancelled: true } : {}) } : null;
    push('planted', { plotIndex, cropId: crop.id, amount: cost, fatigue: p.fatigued, watered: p.watered, by, ...(sow || {}), ...(vf || {}) });
    if (state.variety && !tree) {
      noteVariety(state, 'sown', 1, crop.id);
      if (by === 'player') autoKeepOrders(careerVarietyHost(api), crop.id, plotIndex);
      checkMedals(careerVarietyHost(api));
    }
    if (vf) return { ok: true, cost, fatigue: p.fatigued, ...(sow || {}), ...vf };
    return sow ? { ok: true, cost, fatigue: p.fatigued, ...sow } : { ok: true, cost, fatigue: p.fatigued };
  }

  function water(plotIndex, { by = 'player' } = {}) {
    if (!core.playing()) return fail(core.ENDED);
    if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
    const p = state.plots[plotIndex];
    if (!p.unlocked) return fail('Cette parcelle n\'est pas encore ouverte.');
    if (!p.cropId) return fail('Rien à arroser ici.');
    const crop = getCrop(p.cropId);
    if (isTreeCrop(crop)) return fail('Le pommier n\'a pas besoin d\'eau.');
    if (isMature(p)) return fail('Cette culture est mûre : récoltez-la !');
    if (!needsWaterToday(crop, inGreenhouse(p) ? 'sunny' : state.weather.today, L())) return fail('Pas besoin : elle pousse sans arrosage.');
    if (p.watered) return fail('Déjà arrosée aujourd\'hui.');
    p.watered = true;
    push('watered', { plotIndex, cropId: p.cropId, amount: 0, by });
    return { ok: true, cost: 0 };
  }

  /** Valeur de la récolte d'une parcelle pour `by` (avant ateliers / grenier / commandes). */
  function harvestAmount(p, by) {
    const unit = rawUnitPrice(state, L(), getCrop(p.cropId)) * yieldFactor(state, L(), p);
    // (Vallée vivante) Variété savoureuse : + 10 %.
    const vf = state.career.valley ? priceFactorOf(state, p) : 1;
    return Math.round(unit * vf * (by === 'player' ? handBonusOf(state) : 1) * (p.crowPenalty ? CROW_PENALTY : 1));
  }

  /** (lot 2) Valeur d'un géant récolté à la main : 6 × une parcelle (prime « à la main » comprise). */
  function giantValue(anchor) {
    const p = state.plots[anchor];
    if (!p || !p.cropId || !isMature(p)) return 0;
    // (lot 3) Concours du plus gros légume (année des géants) : + 50 % ce jour-là.
    const f = state.variety ? themeGiantValueFactor(state) : 1;
    return Math.round(harvestAmount(p, 'player') * GIANT.valueFactor * f);
  }

  /** (lot 2) Cueillette des champignons (à la main seulement). */
  function pickForage(plotIndex, by) {
    if (by !== 'player') return fail('Les champignons se cueillent à la main.');
    const f = takeForage(state, plotIndex);
    if (!f) return fail('Rien à cueillir ici.');
    earn('other', f.value);
    push('foragePicked', { plotIndex, kind: f.kind, amount: f.value, by });
    repayJoseph(f.value, 'harvest');
    return { ok: true, amount: f.value, forage: f.kind, plotIndex };
  }

  /**
   * (lot 2) Récolte d'un légume géant : vendu tout de suite, 4 parcelles vidées. À la main : 6 × une parcelle.
   * Salariés et machines : seulement après GIANT.handDays jours d'attente, sans la prime (4 × leur valeur).
   */
  function harvestGiant(plotIndex, by) {
    if (by !== 'player' && !giantOpenToHelpers(state, plotIndex)) return fail('Le légume géant attend d\'être récolté à la main.');
    const g = giantAt(state, plotIndex);
    const cropId = g.cropId;
    const giantVariety = state.career.valley ? state.plots[g.anchor].variety || null : null;
    const sid = seasonId(state);
    const amount = by === 'player' ? giantValue(g.anchor) : harvestAmount(state.plots[g.anchor], by) * g.plots.length;
    const life = c().lifetime;
    // (Vallée vivante) À la main, chaque parcelle d'un géant d'une variété compte comme une récolte à la main.
    const valleyEvents = [];
    let valleySeeds = 0;
    for (const k of g.plots) {
      const q = state.plots[k];
      if (q.variety && state.career.valley) {
        const vh = valleyHarvest(api, k, by);
        if (vh) {
          valleySeeds += vh.seeds;
          valleyEvents.push(...vh.events);
        }
      } else if (state.career.valley && q.lastVariety !== undefined) delete q.lastVariety;
      q.lastHarvested = cropId;
      clearPlot(q);
      q.crow = false;
      q.crowPenalty = false;
      addHarvest(state, cropId);
      life.harvests += 1;
      if (by === 'player') life.handPicked = (life.handPicked || 0) + 1;
      life.cropsInSeason = life.cropsInSeason || {};
      life.cropsInSeason[`${cropId}@${sid}`] = (life.cropsInSeason[`${cropId}@${sid}`] || 0) + 1;
    }
    addStat(state, 'harvestIncome', amount);
    noteSeasonHarvest(state);
    account('income', 'crops', amount);
    const ys = c().yearStats;
    ys.cropIncome = ys.cropIncome || {};
    ys.cropIncome[cropId] = (ys.cropIncome[cropId] || 0) + amount;
    changeMoney(amount);
    const part = repaymentFrom(state, L(), amount);
    const giant = { anchor: g.anchor, plots: [...g.plots], cropId };
    // (lot 3) À la main, un géant compte pour 4 unités (commandes, puis charrette ; le reste est vendu normalement).
    const preview = state.variety && by === 'player' ? claimPreview(state, cropId) : null;
    const res = {
      plotIndex, cropId, amount, fatigue: false, tree: false, processed: null, by, handPicked: by === 'player', stored: false, crowPenalty: false,
      quality: 'normal', qualityBonus: 0, qualityMultiplier: 1, giant, ...(preview ? { claimed: { kind: preview.kind, id: preview.id, label: preview.label } } : {}), ...(part > 0 ? { loanRepayment: part } : {}),
      ...(giantVariety ? { variety: giantVariety, seeds: valleySeeds } : {}),
    };
    push('harvested', res);
    push('giantHarvested', { ...giant, cropName: getCrop(cropId).name, amount, by });
    for (const [type, payload] of valleyEvents) push(type, payload);
    repayJoseph(amount, 'harvest');
    if (state.variety) {
      const host = careerVarietyHost(api);
      if (preview) claimUnits(host, { cropId, units: g.plots.length, by: 'player', plotIndex });
      noteHarvest(state, { cropId, amount, units: g.plots.length });
      checkMedals(host);
    }
    // (lot 4) Un géant : 4 récoltes (soignées à la main), tampon ◆ de l'album.
    if (state.cozy) noteCozyHarvest(state, { cropId, cared: true, by, units: g.plots.length, giant: by === 'player' });
    const { plotIndex: _i, by: _b, ...out } = res;
    return { ok: true, ...out };
  }

  function harvest(plotIndex, { by = 'player' } = {}) {
    if (!core.playing()) return fail(core.ENDED);
    if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
    const p = state.plots[plotIndex];
    if (!p.cropId && p.forage && state.surprises) return pickForage(plotIndex, by);
    if (!p.cropId) return fail('Rien à récolter ici.');
    const crop = getCrop(p.cropId);
    const tree = isTreeCrop(crop);
    if (!isMature(p)) return fail(tree ? 'Pas encore de fruits mûrs.' : 'Pas encore mûre.');
    if (p.giant !== undefined && state.surprises) return harvestGiant(plotIndex, by);
    const cropId = p.cropId;
    const sid = seasonId(state);
    const value = harvestAmount(p, by);
    // (lot 4, F1) Aubes passées depuis la maturité ; prime « à la main » (pièces comprises dans amount quand elle est payée).
    const waited = helpersOn(state) ? waitedDawns(state, plotIndex) : 0;
    const handPart = by === 'player' && helpersOn(state) ? value - Math.round(rawUnitPrice(state, L(), crop) * yieldFactor(state, L(), p) * (p.crowPenalty ? CROW_PENALTY : 1)) : 0;
    // (lot 2) Qualité : belle × 1,5 ; dorée × 2 seulement à la main (salariés, machines : belle au plus).
    // La prime est versée tout de suite, même si la récolte part au grenier, à l'atelier ou à une commande.
    const q = state.surprises ? rollQuality(state, p, by === 'player') : null;
    const qualityBonus = q ? Math.round(value * (q.multiplier - 1)) : 0;
    if (q) recordQuality(state, cropId, q.quality);
    const rawValue = harvestValue(state, L(), p);
    const yf = yieldFactor(state, L(), p);
    const fatigue = p.fatigued;
    const crowPenalty = p.crowPenalty;
    let diverted = null;
    for (const fn of hooksOf('harvest')) {
      const r = fn(api, { plotIndex, cropId, amount: value, by });
      if (r && r.divert) {
        diverted = r;
        break;
      }
    }
    // (lot 3) { divert, sell } : commande du tableau ou caisse de la charrette — vendue tout de suite (prime « à la
    // main » et qualité comprises), ni atelier ni grenier.
    const sold = !!diverted && !!diverted.sell;
    const careWatered = state.variety && !tree ? careOf(state, p).wateredEveryDay : false;
    const caredLot4 = state.cozy ? tree || careOf(state, p).wateredEveryDay : false;
    // (Vallée V2) Variété parfumée : le rendement de la place d'atelier × 1,15 (rien de nouveau dans les places).
    const processed = diverted ? null : tryProcessHarvest(state, cropId, rawValue, state.career.valley && p.variety ? yf * scentedFactorOf(state, p) : yf);
    let stored = false;
    // (Vallée vivante) Une variété ancienne ne va jamais au grenier (son trait ne se perd pas dans le stock) ; (V3) les fruits
    // du cerisier et du poirier non plus (cours fixe, hors de CROPS : le grenier ne les vendrait pas).
    if (!diverted && !processed && !p.variety && !isValleyTree(cropId) && wouldStore(state, cropId)) {
      addStock(state, cropId);
      stored = true;
    }
    // (lot 4, F1) La prime « à la main » est payée tout de suite, même si la récolte part au grenier, à l'atelier ou à
    // une commande (comme la prime de qualité) : récolter soi-même vaut toujours plus.
    const handBonus = Math.max(0, handPart);
    const amount = ((diverted && !sold) || processed || stored ? handBonus : value) + qualityBonus;
    // (Vallée vivante) Graines gardées à la main, fixation (avant clearPlot) ; lastVariety pour le plan « même culture ».
    const vh = p.variety && state.career.valley ? valleyHarvest(api, plotIndex, by) : null;
    if (!vh && !tree && state.career.valley && p.lastVariety !== undefined) delete p.lastVariety;
    if (tree) {
      p.fruit = 0;
      if (p.ripeAt !== undefined) delete p.ripeAt;
    } else {
      p.lastHarvested = cropId;
      clearPlot(p);
    }
    p.crow = false;
    p.crowPenalty = false;
    addStat(state, 'harvestIncome', amount);
    addHarvest(state, cropId);
    noteSeasonHarvest(state);
    account('income', 'crops', amount);
    const ys = c().yearStats;
    ys.cropIncome = ys.cropIncome || {};
    ys.cropIncome[cropId] = (ys.cropIncome[cropId] || 0) + amount;
    const life = c().lifetime;
    life.harvests += 1;
    if (by === 'player') life.handPicked = (life.handPicked || 0) + 1;
    life.cropsInSeason = life.cropsInSeason || {};
    life.cropsInSeason[`${cropId}@${sid}`] = (life.cropsInSeason[`${cropId}@${sid}`] || 0) + 1;
    changeMoney(amount);
    const part = repaymentFrom(state, L(), amount);
    const qf = q ? { quality: q.quality, qualityBonus, qualityMultiplier: q.multiplier } : {};
    const cf = diverted?.claimed ? { claimed: { ...diverted.claimed } } : {};
    push('harvested', {
      plotIndex, cropId, amount, fatigue, tree, processed, by, handPicked: by === 'player', stored, crowPenalty, ...qf,
      ...(diverted ? { diverted: diverted.label || true } : {}),
      ...cf,
      ...(part > 0 ? { loanRepayment: part } : {}),
      ...(helpersOn(state) ? { handBonus, waited } : {}),
      ...(vh ? { variety: vh.variety, seeds: vh.seeds } : {}),
    });
    if (vh) for (const [type, payload] of vh.events) push(type, payload);
    if (stored) push('stored', { cropId, n: 1, plotIndex });
    if (processed) push('processingStarted', { ...processed, input: cropId, source: 'harvest', plotIndex });
    repayJoseph(amount, 'harvest');
    if (diverted && typeof diverted.after === 'function') diverted.after();
    if (state.variety) {
      noteHarvest(state, { cropId, amount, quality: q ? q.quality : 'normal', care: careWatered, tree });
      checkMedals(careerVarietyHost(api));
    }
    if (state.cozy) noteCozyHarvest(state, { cropId, quality: q ? q.quality : 'normal', cared: caredLot4, by, handBonus });
    return { ok: true, amount, cropId, tree, processed, stored, handPicked: by === 'player', crowPenalty, ...qf, ...cf, ...(part > 0 ? { loanRepayment: part } : {}), ...(helpersOn(state) ? { handBonus, waited } : {}), ...(vh ? { variety: vh.variety, seeds: vh.seeds, fixed: vh.fixed } : {}) };
  }

  function unlockPlot(plotIndex) {
    if (!core.playing()) return fail(core.ENDED);
    if (!validPlot(plotIndex)) return fail('Parcelle inexistante.');
    const p = state.plots[plotIndex];
    if (p.unlocked) return fail('Cette parcelle est déjà ouverte.');
    if (p.lot !== 'start') return fail('Seules les parcelles du champ de départ s\'achètent une à une.');
    const cost = plotUnlockCost(state, L());
    if (cost === null) return fail('Le champ ne peut plus s\'agrandir.');
    if (state.money < cost) return fail(notEnough(cost - state.money));
    p.unlocked = true;
    state.plotsBought += 1;
    spend('develop', cost);
    push('plotUnlocked', { plotIndex, cost });
    checkRanks(api);
    return { ok: true, cost };
  }

  function buyInvestment(id) {
    if (!core.playing()) return fail(core.ENDED);
    const check = checkBuyCareer(state, L(), id);
    if (!check.ok) return check;
    const animal = check.inv.category === 'animal';
    state.investments[id] = (state.investments[id] || 0) + 1;
    spend(animal ? 'animals' : 'items', check.cost, { asset: animal ? 'animals' : 'buildings', log: animal ? { kind: 'animal', id } : null });
    core.refreshLevel();
    push('purchased', { investmentId: id, owned: state.investments[id], cost: check.cost });
    checkRanks(api);
    return { ok: true, owned: state.investments[id], cost: check.cost };
  }

  // ── Fin de journée : charges de saison, coups durs, fin d'année ──
  function rescueSale() {
    const sold = [];
    let total = 0;
    const log = c().assetLog;
    const share = HARDSHIP.rescueShare;
    // Animaux d'abord, du plus récent au plus ancien.
    for (let k = log.length - 1; k >= 0 && state.money < 0; k--) {
      const e = log[k];
      if (e.kind !== 'animal') continue;
      if ((state.investments[e.id] || 0) <= 0) {
        log.splice(k, 1);
        continue;
      }
      state.investments[e.id] -= 1;
      const amount = Math.round(e.price * share);
      c().paid.animals = Math.max(0, c().paid.animals - e.price);
      log.splice(k, 1);
      earn('rescue', amount);
      total += amount;
      sold.push({ kind: 'animal', id: e.id, amount });
    }
    // Puis les machines (une machine et ses améliorations partent ensemble).
    for (let k = log.length - 1; k >= 0 && state.money < 0; k--) {
      const e = log[k];
      if (!e || e.kind !== 'machine') continue;
      const key = e.key || e.id;
      const entries = log.filter((x) => x.kind === 'machine' && (x.key || x.id) === key);
      const price = entries.reduce((s, x) => s + x.price, 0);
      for (const x of entries) log.splice(log.indexOf(x), 1);
      k = log.length;
      if (!c().machines[key]) continue;
      const machineId = c().machines[key].id || e.id;
      delete c().machines[key];
      const amount = Math.round(price * share);
      c().paid.machines = Math.max(0, c().paid.machines - price);
      earn('rescue', amount);
      total += amount;
      sold.push({ kind: 'machine', id: machineId, key, amount });
    }
    if (sold.length) {
      core.refreshLevel();
      push('rescueSale', { sold, total });
    }
    return sold;
  }

  function bankrupt(charge, sid) {
    const p = patrimony(state);
    const archive = { farmName: c().farmName, years: state.time.year, rank: c().rank, patrimony: Math.max(p, c().bestPatrimony || 0), endedBy: 'bankrupt' };
    state.status = 'bankrupt';
    state.time.elapsed = DAY_SECONDS;
    state.result = { outcome: 'bankrupt', career: true, amountDue: charge, money: state.money, seasonId: sid, day: state.time.day, year: state.time.year, rank: c().rank, patrimony: p, archive };
    push('bankrupt', {
      career: true, amountDue: charge, money: state.money, seasonId: sid, year: state.time.year, rank: c().rank, patrimony: p, farmName: c().farmName, archive,
      neighbourDebt: 0, summary: buildSummary(state, sid, { amountDue: charge }),
    });
  }

  function paySeasonCharges() {
    const level = L();
    const sid = seasonId(state);
    const detail = seasonChargeDetail(state);
    const charge = detail.amount;
    if (state.money < charge) core.sellAllRaw('rent');
    if (state.money < charge) sellStockFor(api, charge, 'charges');
    if (willLend(state, level, charge)) {
      const missing = charge - state.money;
      const { amount, debt } = borrow(state, level, loanAmount(level, charge, state.money, false));
      changeMoney(amount);
      push('neighbourLoan', { amount, debt, missing, rent: charge, seasonId: sid, surcharge: debt - amount, repayShare: level.neighbourLoan.repayShare, career: true });
    }
    if (state.money < charge && careerDifficulty(state).gameOver) {
      bankrupt(charge, sid);
      return false;
    }
    const rescued = state.money < -charge && rescueSale().length > 0;
    spend('seasonCharges', charge);
    // (lot 3) « La ristourne de la coopérative » : une fois.
    if (detail.reduced && state.variety) state.variety.cards.pending.chargeFactor = 1;
    push('billPaid', { amount: charge, seasonId: sid, career: true, ...(detail.reduced ? { reduced: true } : {}), detail: { base: detail.base, perLot: detail.perLot, lots: detail.lots, scale: detail.scale }, summary: buildSummary(state, sid, { amount: charge }) });
    if (state.money < 0) {
      const h = c().hardship || (c().hardship = { stage: 'overdraft', since: { year: state.time.year, day: state.time.day } });
      if (rescued) h.stage = 'rescueSold';
      push('hardship', { stage: h.stage, money: state.money, since: { ...h.since } });
    } else if (rescued && c().hardship) {
      c().hardship.stage = 'rescueSold';
    }
    return true;
  }

  /** Bilan d'une année (en cours, ou tel qu'il sera au soir du dernier jour). */
  function yearReport() {
    const ys = c().yearStats;
    const income = Object.values(ys.incomeBy).reduce((a, b) => a + b, 0);
    const spent = Object.values(ys.spentBy).reduce((a, b) => a + b, 0);
    const harvested = state.stats.year.cropsHarvested;
    let bestCrop = null;
    for (const [cropId, amount] of Object.entries(ys.cropIncome || {})) {
      if (!bestCrop || amount > bestCrop.income) bestCrop = { cropId, name: getCrop(cropId)?.name ?? cropId, income: amount, count: harvested[cropId] || 0 };
    }
    const summary = rankSummary(state);
    return {
      year: state.time.year,
      net: income - spent,
      income,
      spent,
      incomeBy: { ...ys.incomeBy },
      spentBy: { ...ys.spentBy },
      bestCrop,
      harvests: Object.values(harvested).reduce((a, b) => a + b, 0),
      cropsHarvested: { ...harvested },
      productsSold: { ...state.stats.year.productsSold },
      rank: c().rank,
      rankName: summary.rankName,
      title: summary.title,
      patrimony: summary.patrimony,
      money: state.money,
      lotsBought: c().lotsBought,
      houseLevel: c().buildings.house?.level || 1,
      days: L().seasonLengths.reduce((a, b) => a + b, 0),
      debt: state.neighbourLoan ? state.neighbourLoan.debt : 0,
      // (lot 3) Variété : compteurs de l'année, thème de l'an prochain (annoncé au bilan).
      ...(state.variety ? { variety: careerVarietyYear(state), nextTheme: careerNextTheme(state) } : {}),
      // (lot 4) Fêtes, hiver, récoltes à la main de l'année (au bilan : + lanternes, extension cozy).
      ...(state.cozy ? { cozy: careerCozyYear(state) } : {}),
      // (Vallée vivante) Ce qui est venu cette année (au bilan : complété par l'extension).
      ...(state.career.valley ? { valley: careerValleyYear(state) } : {}),
    };
  }

  function endYear() {
    const report = yearReport();
    c().history.push({ year: report.year, net: report.net, incomeBy: report.incomeBy, spentBy: report.spentBy, rank: report.rank, patrimony: report.patrimony, bestCrop: report.bestCrop, harvests: report.harvests });
    for (const fn of hooksOf('yearEnd')) fn(api, { year: report.year, report });
    push('yearEnd', { year: report.year, report });
    state.time.year += 1;
    state.stats.year = createStats();
    c().yearStats = emptyYearStats();
  }

  function endOfDay() {
    const level = L();
    const lastDay = isLastDayOfSeason(state, level);
    const lastOfYear = lastDay && isLastSeason(state);
    for (const fn of hooksOf('evening')) fn(api, { seasonId: seasonId(state), lastDayOfSeason: lastDay, lastDayOfYear: lastOfYear });
    if (!core.playing() || !lastDay) return;
    if (!paySeasonCharges()) return;
    if (lastOfYear) endYear();
  }

  // ── Lot 2 : surprises de l'aube (carrière) ──
  function surprisesDawnStart(level) {
    const events = [];
    const tomorrowSi = tomorrowSeasonIndex(state, level) ?? state.time.seasonIndex;
    const sky = advanceSky(state, SEASONS[tomorrowSi]);
    expireEffects(state);
    expireForage(state);
    validateGiants(state);
    const g = tryGiant(state, level);
    if (g) events.push(['giant', { anchor: g.anchor, plots: [...g.plots], cropId: g.cropId, cropName: getCrop(g.cropId).name, value: giantValue(g.anchor) }]);
    if (sky.today) events.push(['specialWeather', specialInfo(sky.today)]);
    return { events, sky };
  }

  function surprisesDawnEnd(level, { events, sky }) {
    const surprise = dawnSurprise(state, { level, crops: core.getCrops(), earn: (amount) => earn('other', amount) });
    if (surprise) {
      events.push(['surprise', surprise]);
      if (surprise.kind === 'ring') events.push(['forage', { kind: 'ring', plots: [surprise.plotIndex], text: surprise.text }]);
    }
    if (sky.today === 'fog') {
      const f = fogForage(state, level, core.getCrops());
      if (f) events.push(['forage', { kind: 'mushroom', plots: f.plots, value: f.value, text: 'Des champignons ont poussé dans le brouillard : touchez-les pour les cueillir.' }]);
    }
    if (sky.yesterday === 'shootingstar' && !state.surprises.wish) {
      events.push(['wish', { ...newWish(state), text: 'Cette nuit, vous avez vu une étoile filante : faites un vœu !' }]);
    }
  }

  // ── Aube ──
  function dawn() {
    core.refreshLevel();
    const level = L();
    const moneyBefore = state.money;
    moneyBatch = true;
    const prevSeason = state.time.seasonIndex;
    const prevWeather = state.weather.today;
    const extraIncomes = [];

    // 1. Pousse (veille) ; (lot 2) soins des cultures, pousse en plus de la pluie chaude.
    const snap = growthSnapshot(state, level, prevWeather);
    growPlots(state, prevSeason, prevWeather, level);
    if (snap) applyGrowthCare(state, snap, skyGrowthFactor(state.surprises.sky.today));

    // 2. Nouveau jour, nouvelle saison, gel.
    const newSeason = advanceDay(state, level);
    const sid = seasonId(state);
    if (newSeason) {
      state.stats.season = createStats();
      push('seasonStart', { seasonId: sid, seasonIndex: state.time.seasonIndex, year: state.time.year });
      if (sid === 'winter') {
        const lost = applyFrost(state);
        addLost(state, 'frost', lost.length);
        push('frost', { lostPlots: lost.map((l) => l.plotIndex), lost, refund: 0 });
      }
      for (const fn of hooksOf('seasonStart')) fn(api, { seasonId: sid, seasonIndex: state.time.seasonIndex, year: state.time.year });
    }

    // 3. Météo ; 3 bis. événements des extensions.
    state.weather.today = state.weather.tomorrow;
    state.weather.tomorrow = drawWeather(state, level, tomorrowSeasonIndex(state, level) ?? state.time.seasonIndex);
    const today = state.weather.today;
    // (lot 2) Météo spéciale (aujourd'hui = prévision d'hier), effets passés, géants.
    const lot2 = state.surprises ? surprisesDawnStart(level) : null;
    for (const fn of hooksOf('dawnEvents')) fn(api, { seasonId: sid, weather: today });

    // 5. Pluie (hors serre) ; 6. marché.
    if (weatherWaters(today)) rainWater(state);
    updateCareerMarket(state);
    // (lot 2) Surprise de l'aube, champignons du brouillard, vœu de l'étoile filante.
    if (lot2) surprisesDawnEnd(level, lot2);

    // 7. Arrosage des machines ; (lot 3) arrosoir magique et arrosoir de cuivre ensuite.
    const sprinkled = [];
    for (const fn of hooksOf('water')) {
      const r = fn(api, { weather: today });
      if (Array.isArray(r)) sprinkled.push(...r);
    }
    const varietyWatered = state.variety ? varietyWater(careerVarietyHost(api), today) : null;

    // 8. Ateliers.
    let productSales = 0;
    for (const sale of advanceProcessing(state)) {
      productSales += sale.amount;
      addProductSold(state, sale.productId, sale.amount);
      account('income', 'products', sale.amount);
      c().lifetime.productsSold += 1;
      if (state.variety) noteVariety(state, 'products', 1);
      if (state.cozy) noteCozyProduct(state, sale.productId);
      extraIncomes.push({ source: sale.buildingId, amount: sale.amount, owned: state.investments[sale.buildingId] || 0, kind: 'processed', productId: sale.productId, key: 'products' });
      push('productSold', sale);
    }
    for (const fn of hooksOf('afterProcessing')) fn(api, {});

    // 9. Revenus ; le lait part à la fromagerie.
    const lastDay = isLastDayOfSeason(state, level);
    const incomes = careerIncomes(state, state.time.seasonIndex, today, lastDay);
    const milk = fillMilk(state, level, incomes, sid);
    for (const st of milk.started) push('processingStarted', st);
    for (const fn of hooksOf('incomes')) {
      const r = fn(api, { seasonId: sid, weather: today, lastDayOfSeason: lastDay, milkToDairy: milk.milkToDairy });
      if (Array.isArray(r)) for (const inc of r) if (inc && inc.amount > 0) incomes.push({ owned: 0, kind: 'daily', key: 'other', ...inc });
    }
    let investmentTotal = 0;
    for (const inc of incomes) {
      investmentTotal += inc.amount;
      account('income', inc.key || 'other', inc.amount);
    }
    const allIncomes = [...extraIncomes, ...incomes];
    const incomeTotal = allIncomes.reduce((s, i) => s + i.amount, 0);

    // 10. Charges quotidiennes (+ salaires et carburant : jamais si l'argent est négatif).
    const base = careerDailyCharges(state, level, state.time.seasonIndex);
    const negative = state.money + incomeTotal < 0;
    const extCharges = [];
    for (const fn of hooksOf('charges')) {
      const r = fn(api, { money: state.money, seasonId: sid, estimate: false });
      if (!Array.isArray(r)) continue;
      for (const ch of r) {
        if (!ch || !(ch.amount > 0)) continue;
        if (negative && (ch.source === 'wages' || ch.source === 'fuel')) continue;
        extCharges.push({ source: ch.source || 'other', amount: ch.amount });
      }
    }
    const extTotal = extCharges.reduce((s, ch) => s + ch.amount, 0);
    const neighbourPayment = repaymentFrom(state, level, productSales);
    const chargesDetail = [...base.detail, ...extCharges];
    if (neighbourPayment > 0) chargesDetail.push({ source: 'neighbour', amount: neighbourPayment });
    const charges = base.total + extTotal + neighbourPayment;

    addStat(state, 'investmentIncome', investmentTotal);
    addStat(state, 'charges', base.total + extTotal);
    account('spent', 'charges', base.fixed);
    if (base.heating > 0) account('spent', 'heating', base.heating);
    for (const ch of extCharges) account('spent', ['wages', 'fuel', 'heating'].includes(ch.source) ? ch.source : 'other', ch.amount);
    state.money += incomeTotal - charges;
    let neighbourDone = false;
    if (neighbourPayment > 0) neighbourDone = repay(state, neighbourPayment);

    // 11. Extensions, fin du coup dur, événements.
    for (const fn of hooksOf('dawn')) fn(api, { seasonId: sid, newSeason, incomes: allIncomes, charges });
    moneyBatch = false;
    const dawnInfo = {
      day: state.time.day,
      year: state.time.year,
      seasonId: sid,
      weather: today,
      incomes: allIncomes,
      charges,
      chargesDetail,
      sprinkled,
      net: incomeTotal - charges,
      milkToDairy: milk.milkToDairy,
      ...(varietyWatered ? { varietyWatered } : {}),
    };
    state.lastDawn = JSON.parse(JSON.stringify(dawnInfo));
    push('weather', lot2 ? { today, tomorrow: state.weather.tomorrow, special: { ...state.surprises.sky } } : { today, tomorrow: state.weather.tomorrow });
    push('dawn', dawnInfo);
    if (lot2) for (const [type, payload] of lot2.events) push(type, payload);
    if (neighbourPayment > 0) {
      push('loanRepayment', { amount: neighbourPayment, remaining: state.neighbourLoan.debt, source: 'product' });
      if (neighbourDone) push('loanRepaid', { total: state.neighbourLoan.repaid, borrowed: state.neighbourLoan.borrowed, loans: state.neighbourLoan.loans, source: 'product' });
    }
    if (state.money !== moneyBefore) push('moneyChanged', { money: state.money, delta: state.money - moneyBefore });
    checkRecovery();
    checkRanks(api);
    if (daysLeftInSeason(state, level) + 1 === WARNING_DAYS) {
      const next = SEASONS[(state.time.seasonIndex + 1) % SEASONS.length];
      push('seasonWarning', { nextSeasonId: next, daysLeft: WARNING_DAYS, frost: next === 'winter', yearEnd: isLastSeason(state) });
    }
  }

  // ── Temps ──
  function update(dt) {
    if (!core.playing() || !(dt > 0) || !Number.isFinite(dt) || state.speed === 0) return;
    let remaining = dt * state.speed;
    const ticks = hooksOf('tick');
    while (core.playing() && remaining > 0) {
      const from = state.time.elapsed;
      const toEnd = DAY_SECONDS - from;
      if (remaining + EPSILON >= toEnd) {
        remaining = Math.max(0, remaining - toEnd);
        state.time.elapsed = DAY_SECONDS;
        for (const fn of ticks) fn(api, from, DAY_SECONDS);
        core.flush();
        if (!core.playing()) break;
        state.time.elapsed = 0;
        endOfDay();
        if (core.playing()) dawn();
        // Option « pause chaque matin » : le nouveau jour commence en pause, sans enchaîner les suivants.
        if (core.playing() && autoPauseAfterDawn(state, push, seasonId(state))) remaining = 0;
        core.flush();
      } else {
        state.time.elapsed = from + remaining;
        remaining = 0;
        for (const fn of ticks) fn(api, from, state.time.elapsed);
      }
    }
    core.flush();
  }

  // ── API des extensions (CORE-B / CORE-C) ──
  const api = {
    mode: 'career',
    get state() {
      return state;
    },
    get level() {
      return L();
    },
    get crops() {
      return core.getCrops();
    },
    push,
    fail,
    notEnoughMoney: notEnough,
    changeMoney,
    earn,
    spend,
    account,
    repayJoseph,
    rng: (name) => stream(state.rng, name),
    seasonId: () => seasonId(state),
    playing: () => core.playing(),
    isPaused,
    seedCost: (cropId) => seedCost(getCrop(cropId)),
    plant: (i, cropId, opts) => plant(i, cropId, opts),
    water: (i, opts) => water(i, opts),
    harvest: (i, opts) => harvest(i, opts),
    harvestAmount: (i, by = 'staff') => (validPlot(i) && state.plots[i].cropId && isMature(state.plots[i]) ? harvestAmount(state.plots[i], by) : 0),
    lot: (lotId) => getLot(state, lotId),
    lotPlots: (lotId) => lotPlots(state, lotId),
    refreshLevel: () => core.refreshLevel(),
    checkRanks: () => checkRanks(api),
    patrimony: () => patrimony(state),
    staffCapacity: () => staffCapacity(state),
    storageCapacity: () => storageCapacity(state),
    shelterCapacity: (id) => shelterCapacity(state, id),
    wouldStore: (cropId) => wouldStore(state, cropId),
    addStock: (cropId, n = 1) => addStock(state, cropId, n),
    sellStock: (cropId, n, reason = 'seller') => sellStock(api, cropId, n, reason),
    stockUsed: () => stockUsed(state),
    offSeason: (cropId) => isOffSeason(state, getCrop(cropId)),
  };

  // ── Actions et requêtes de carrière (game.actions.career / game.query.career) ──
  function guard(fn) {
    return (...args) => {
      if (!core.playing()) return fail(core.ENDED);
      const res = fn(...args);
      if (res && res.ok) {
        core.refreshLevel();
        checkRanks(api);
        checkRecovery();
        // (lot 3) Défis : un ramassage, une vente… peut donner une médaille tout de suite.
        if (state.variety) checkMedals(careerVarietyHost(api));
      }
      return res;
    };
  }

  const careerActions = {
    buyLot: guard((lotId) => buyLot(api, lotId)),
    developLot: guard((lotId, type) => developLot(api, lotId, type)),
    build: guard((lotId, slot, buildingId) => buildOnSlot(api, lotId, slot, buildingId)),
    upgradeBuilding: guard((buildingId) => upgradeBuilding(api, buildingId)),
    setPlan: guard((lotId, sid, cropId) => setPlan(api, lotId, sid, cropId)),
    setStorageMode: guard((mode) => setStorageMode(api, mode)),
    sellStock: guard((cropId = null, n) => sellStock(api, cropId, n, 'player')),
    renameLot: guard((lotId, text) => {
      const lot = getLot(state, lotId);
      if (!lot) return fail('Terrain inconnu.');
      const t = typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim() : '';
      if (!t || [...t].length > FARM_NAME_MAX) return fail(`Nom invalide (1 à ${FARM_NAME_MAX} caractères).`);
      lot.name = t;
      return { ok: true, name: lot.name };
    }),
  };
  for (const name of PENDING_ACTIONS) careerActions[name] = () => fail('Bientôt disponible.');
  for (const ext of careerExtensions()) {
    if (typeof ext.actions !== 'function') continue;
    for (const [name, fn] of Object.entries(ext.actions(api) || {})) careerActions[name] = guard(fn);
  }

  function lotEntry(lot) {
    const plots = lotPlots(state, lot.id);
    return {
      id: lot.id,
      index: lot.index,
      col: lot.col,
      row: lot.row,
      fixed: lot.index < 3,
      type: lot.type,
      typeName: lotTypeName(lot.type),
      name: lot.name,
      owned: true,
      bought: true,
      forSale: false,
      buyable: false,
      canBuy: false,
      lockedReason: null,
      price: lot.pricePaid,
      developCost: lot.developPaid,
      lockedByRank: null,
      plots,
      slots: lot.slots ? lot.slots.map((b) => (b ? { buildingId: b, level: c().buildings[b]?.level || 0 } : null)) : [],
      buildings: Object.entries(c().buildings).filter(([, b]) => b.lotId === lot.id).map(([id]) => id),
      machines: Object.entries(c().machines).filter(([, m]) => m && m.lotId === lot.id).map(([key]) => key),
      staff: c().staff.filter((s) => s.lotId === lot.id).map((s) => s.id),
      plan: lot.plan ? { ...lot.plan } : null,
      special: lot.special || null,
      ...(state.career.valley ? { nature: lotNature(state, lot.id) } : {}),
    };
  }

  /** Terrain à vendre de la lisière (même forme qu'un terrain possédé, champs de vente en plus). */
  function saleEntry(next) {
    return {
      id: next.id, index: next.index, col: next.col, row: next.row, fixed: false, type: null, typeName: null, name: next.name,
      owned: false, bought: false, forSale: true, buyable: next.buyable, canBuy: next.canBuy, reason: next.reason, lockedReason: next.lockedReason,
      price: next.price, basePrice: next.basePrice, special: next.special, chargeIncrease: next.chargeIncrease, developCost: 0, lockedByRank: next.lockedByRank,
      plots: [], slots: [], buildings: [], machines: [], staff: [], plan: null,
    };
  }

  /** Libellés des postes de charges quotidiennes (query.career.charges().daily[].label). */
  const CHARGE_LABELS = { farm: 'Charges de la ferme', upkeep: 'Entretien (animaux, bâtiments, machines)', wages: 'Salaires', fuel: 'Carburant', heating: 'Chauffage de la serre', solar: 'Panneaux solaires', neighbour: 'Part de Joseph', other: 'Autres' };

  function chargesInfo() {
    const level = L();
    const base = careerDailyCharges(state, level, state.time.seasonIndex);
    const raw = [...base.detail];
    for (const fn of hooksOf('charges')) {
      const r = fn(api, { money: state.money, seasonId: seasonId(state), estimate: true });
      if (Array.isArray(r)) for (const ch of r) if (ch && ch.amount > 0) raw.push({ source: ch.source || 'other', amount: ch.amount });
    }
    const dailyTotal = raw.reduce((s, x) => s + x.amount, 0);
    // Une ligne par poste (l'entretien des machines rejoint celui des animaux et bâtiments) ; les
    // panneaux solaires sont une économie : montant POSITIF + credit: true (affiché « +5 », déduit du total).
    const daily = [];
    for (const ch of raw) {
      const credit = ch.amount < 0;
      const amount = Math.abs(ch.amount);
      const line = daily.find((d) => d.source === ch.source && !!d.credit === credit);
      if (line) line.amount += amount;
      else daily.push(credit ? { source: ch.source, amount, credit: true, label: CHARGE_LABELS[ch.source] || ch.source } : { source: ch.source, amount, label: CHARGE_LABELS[ch.source] || ch.source });
    }
    const season = seasonChargeDetail(state);
    return {
      daily,
      dailyTotal,
      season: { amount: season.amount, daysLeft: daysLeftInSeason(state, level), perLot: season.perLot, base: season.base, lots: season.lots, scale: season.scale, seasonId: seasonId(state) },
    };
  }

  function achievementContextCareer() {
    const report = yearReport();
    const maxStaffLevel = c().staff.reduce((m, s) => Math.max(m, s.level || 0), 0);
    return {
      rank: c().rank,
      lots: c().lotsBought,
      staffCount: c().staff.length,
      maxStaffLevel,
      machines: Object.values(c().machines).filter(Boolean).map((m) => m.id),
      species: careerInvestments().filter((i) => i.category === 'animal' && (state.investments[i.id] || 0) > 0).length,
      animals: animalCount(state),
      truffles: c().lifetime.truffles,
      hearts: c().joseph.hearts || 0,
      contestAll: c().lifetime.contestsWon > 0,
      year: state.time.year,
      stock: stockUsed(state),
      stockCapacity: storageCapacity(state),
      yearNet: report.net,
      bestYearNet: Math.max(report.net, ...c().history.map((h) => h.net)),
      cropsInSeason: Object.keys(c().lifetime.cropsInSeason || {}),
      houseLevel: c().buildings.house?.level || 1,
    };
  }

  const careerQueries = {
    summary() {
      const r = rankSummary(state);
      return {
        farmName: c().farmName,
        farmerGender: c().farmerGender,
        outfit: c().outfit,
        seasonLength: c().seasonLength,
        year: state.time.year,
        seasonId: seasonId(state),
        day: state.time.dayOfSeason,
        dayOfYear: state.time.day,
        money: state.money,
        ...r,
        difficulty: c().difficulty,
        hardship: c().hardship ? { ...c().hardship, paused: isPaused() } : null,
        paused: isPaused(),
      };
    },
    lots() {
      // Terrains possédés (ordre d'achat : maison, champ de départ, basse-cour, puis les achats), puis les terrains
      // à vendre de la lisière (carte 2D : cases libres qui touchent la ferme, achetables ou verrouillées par le rang).
      return [...c().lots.map(lotEntry), ...saleLots(state).map(saleEntry)];
    },
    lot(id) {
      const lot = getLot(state, id);
      if (lot) return lotEntry(lot);
      return careerQueries.lots().find((l) => l.id === id) || null;
    },
    grid() {
      return { ...gridInfo(state), lots: careerQueries.lots() };
    },
    // « Ce que fait ce bâtiment » : kind 'building' | 'machine' | 'animal' | 'item' | 'lotType' ; level : niveau
    // montré (par défaut le niveau possédé, sinon 1).
    about(kind, id, level) {
      let lv = level;
      if (lv === undefined) {
        if (kind === 'building') lv = c().buildings[id]?.level || 0;
        else if (kind === 'machine') lv = Math.max(0, ...Object.values(c().machines).filter((m) => m && m.id === id).map((m) => m.level));
        else lv = 1;
      }
      const d = describe(kind, id, lv);
      return d ? { ...d, level: lv } : null;
    },
    nextLot() {
      return nextLotInfo(state);
    },
    lotTypes(lotId) {
      return lotTypesFor(state, lotId);
    },
    buildings() {
      return BUILDINGS.filter((b) => c().buildings[b.id] || b.placement === 'home').map((b) => buildingInfo(state, b.id));
    },
    building(id) {
      return BUILDINGS_BY_ID[id] ? buildingInfo(state, id) : null;
    },
    buildOptions(lotId, slot) {
      return buildOptions(state, lotId, slot);
    },
    stock() {
      return stockInfo(state, L());
    },
    market() {
      return marketInfo(state, L().crops);
    },
    charges: chargesInfo,
    yearReport(year) {
      if (year === undefined || year === state.time.year) return yearReport();
      const h = c().history.find((x) => x.year === year);
      return h ? JSON.parse(JSON.stringify(h)) : null;
    },
    history() {
      return JSON.parse(JSON.stringify(c().history));
    },
    achievementContext: achievementContextCareer,
    // Valeurs par défaut des requêtes des lots CORE-B / CORE-C (remplacées quand ils sont enregistrés).
    machines: () => [],
    machineCatalog: () => [],
    staff: () => [],
    candidates: () => ({ list: [], nextInDays: null, capacity: Math.min(MAX_STAFF, staffCapacity(state)), count: c().staff.length, canHire: false, reason: 'Bientôt disponible.' }),
    events: () => ({ today: null, active: null, offers: [], calendar: [], contest: null }),
    quest: () => null,
    joseph: () => ({ hearts: c().joseph.hearts || 0, nextGift: null, loan: core.neighbourInfo() }),
    workPlan: () => [],
  };
  for (const ext of careerExtensions()) {
    if (typeof ext.queries !== 'function') continue;
    Object.assign(careerQueries, ext.queries(api) || {});
  }

  /** Champs en plus de query.plot(i) en carrière. */
  function plotExtras(i) {
    const p = state.plots[i];
    const lotType = getLot(state, p.lot)?.type;
    const cols = p.env === 'orchard' ? 3 : 4;
    const crop = p.cropId ? getCrop(p.cropId) : null;
    const mature = !!crop && isMature(p);
    return {
      lot: p.lot,
      lotType,
      env: p.env,
      cell: p.cell,
      col: p.cell % cols,
      row: Math.floor(p.cell / cols),
      crow: p.crow,
      crowPenalty: p.crowPenalty,
      handBonus: handBonusOf(state),
      storeTarget: mature ? wouldStore(state, crop.id) : false,
      offSeason: crop ? isOffSeason(state, crop) : false,
      marketMultiplier: crop ? state.market[crop.id] ?? 1 : null,
      handValue: mature ? (p.giant !== undefined && state.surprises ? giantValue(p.giant) : harvestAmount(p, 'player')) : null,
      // (lot 4, F1) Maturité, attente de l'équipe, valeur d'une récolte par l'équipe, désherbage.
      ...(helpersOn(state)
        ? {
            ripeAt: p.ripeAt ?? null,
            wait: waitInfo(state, i),
            helperValue: mature && p.giant === undefined ? harvestAmount(p, 'staff') : null,
            weeded: !!p.weeded,
            weededBy: p.weededBy ?? null,
          }
        : {}),
      // (Vallée vivante) Variété, planche d'essai, jachère, sol reposé ; une variété sobre n'a pas besoin d'eau (hors canicule).
      ...(state.career.valley ? valleyPlotExtras(api, i) : {}),
      ...(state.career.valley && crop && !mature && heirloomDryGrowth(state, p, crop, state.weather.today === 'heatwave') === 1 ? { needsWater: false, ...(p.watered ? {} : { action: null }) } : {}),
    };
  }

  /** Investissements de carrière pour l'onglet Acheter (animaux, ruches, panneaux), verrouillés compris. */
  function investmentsList() {
    const sid = seasonId(state);
    return careerInvestments().map((inv) => {
      const check = core.playing() ? checkBuyCareer(state, L(), inv.id) : fail(core.ENDED);
      const owned = state.investments[inv.id] || 0;
      const animal = inv.category === 'animal';
      const shelter = animal ? BUILDINGS_BY_ID[inv.shelter] : null;
      return {
        id: inv.id,
        name: inv.name,
        description: inv.description,
        kind: inv.kind,
        category: inv.category,
        owned,
        max: animal ? shelterCapacity(state, inv.shelter) : itemMax(state, inv),
        nextCost: careerNextCost(state, inv),
        canBuy: check.ok,
        reason: check.ok ? null : check.reason,
        rank: inv.rank ?? 1,
        lockedByRank: (inv.rank ?? 1) > c().rank ? inv.rank : null,
        income: inv.income?.[sid] || 0,
        incomeBySeason: { ...(inv.income || {}) },
        upkeep: inv.upkeep || 0,
        effects: JSON.parse(JSON.stringify(inv.effects || {})),
        shelter: shelter ? { id: shelter.id, name: shelter.name, built: !!c().buildings[shelter.id], level: c().buildings[shelter.id]?.level || 0, capacity: shelterCapacity(state, shelter.id) } : null,
        requiresAny: null,
        processing: null,
        collect: animal && careerFlag('collectAnimals'),
        ...aboutFields(animal ? 'animal' : 'item', inv.id),
      };
    });
  }

  return {
    api,
    update,
    endOfDay,
    dawn,
    plant,
    water,
    harvest,
    unlockPlot,
    buyInvestment,
    careerActions,
    careerQueries,
    plotExtras,
    investmentsList,
    chargesInfo,
    isPaused,
    incomesEstimate: () => careerIncomes(state, state.time.seasonIndex, null, false),
    giantValue,
    achievementContext: achievementContextCareer,
    yearReport,
  };
}

function notEnough(missing) {
  const m = Math.ceil(missing);
  return `Pas assez d'argent (il manque ${m} pièce${m > 1 ? 's' : ''}).`;
}

function seasonLabel(sid) {
  return { spring: 'au printemps', summer: 'en été', autumn: 'en automne', winter: 'en hiver' }[sid];
}
