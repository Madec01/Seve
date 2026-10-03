// Progression permanente (v3, pure) : étoiles, bonus, succès (un par un), écus, fin de partie, cosmétiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/core/progression.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';
import { COSMETICS, DECOR_SLOTS, DEFAULT_COSMETICS } from '../src/data/cosmetics.js';
import { CROPS } from '../src/data/crops.js';
import { PERKS } from '../src/data/perks.js';
import { createGame } from '../src/core/game.js';

const NOW = 1_800_000_000_000;

function withLevels(entries) {
  const p = P.defaultProgress();
  for (const [id, stars] of Object.entries(entries)) p.levels[id] = { stars, bestMoney: 100 * stars, completed: stars > 0, played: true };
  return p;
}

/** Contexte de partie minimal (forme de query.achievementContext()). */
function ctx(over = {}) {
  const year = { harvestIncome: 0, cropsHarvested: {}, cropsLost: { frost: 0, rot: 0 }, productsSold: {}, investmentsSpent: 0, minMoneyAfterRent: null, bestSeasonHarvestIncome: 0, ...(over.year || {}) };
  return {
    levelId: 3,
    status: 'playing',
    day: 5,
    seasonId: 'spring',
    money: 200,
    stars: 0,
    perksActive: false,
    investments: {},
    availableInvestments: ['chickenCoop'],
    adultTrees: 0,
    dailyCharges: 5,
    ...over,
    stats: { year, season: { harvestIncome: 0, ...(over.season || {}) } },
  };
}

const has = (p, c, id) => P.checkAchievements(p, c).includes(id);

test('données : 26 succès (8 donnent une étoile), catalogue et emplacements', () => {
  assert.equal(ACHIEVEMENTS.length, 26);
  assert.deepEqual(ACHIEVEMENTS.filter((a) => a.reward.stars === 1).map((a) => a.id), ['harvest100', 'harvest500', 'allCrops', 'artisan50', 'veteran', 'lifetime', 'risingStar', 'purist']);
  assert.equal(ACHIEVEMENTS.reduce((s, a) => s + a.reward.ecus, 0), 575);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 26);
  assert.equal(DECOR_SLOTS.length, 11);
  assert.deepEqual(DEFAULT_COSMETICS.owned, ['outfit.classic', 'path.dirt', 'fence.wood']);
  for (const c of COSMETICS) assert.ok(['small', 'large', 'path', 'fence', 'outfit'].includes(c.category), c.id);
});

test('progression vide et normalisation (v1, abîmée, références inconnues)', () => {
  const d = P.defaultProgress();
  assert.equal(d.schema, 2);
  assert.deepEqual(P.normalizeProgress(null), d);
  assert.deepEqual(P.normalizeProgress('texte'), d);
  const v1 = { levels: { 1: { stars: 2, bestMoney: 600, completed: true }, 2: { stars: 9 }, 99: { stars: 3, completed: true }, x: 1 } };
  const n = P.normalizeProgress(v1);
  assert.deepEqual(n.levels, { 1: { stars: 2, bestMoney: 600, completed: true, played: true }, 2: { stars: 3, bestMoney: null, completed: false, played: false } });
  assert.deepEqual(n.perks, {});
  assert.equal(n.ecus, 0);
  assert.deepEqual(n.cosmetics.owned, ['path.dirt', 'fence.wood', 'outfit.classic']);
  const messy = {
    schema: 2,
    levels: {},
    perks: { almanac: 1, startPurse: 7, dragon: 2, goodSeeds: 'x' },
    perksEnabled: 'non',
    achievements: { firstHarvest: { at: 5 }, ghost: { at: 1 }, harvest100: true },
    lifetime: { harvests: -4, cropsHarvested: { carrot: 3, banana: 9 }, productsSold: { bread: 2.7, caviar: 1 }, yearsWon: 'deux' },
    ecus: -10,
    cosmetics: { farmName: '   ', outfit: 'outfit.raincoat', path: 'path.stone', fence: 'fence.gold', owned: ['path.stone', 'nope'], decor: { 'porch.left': 'gnome', 'yard.1': 'path.stone', 'pond': 'pond', 'moon': 'bench' } },
    hintsSeen: ['tree', 'tree', 3, ''],
  };
  const m = P.normalizeProgress(messy);
  assert.deepEqual(m.perks, { almanac: 1, startPurse: 2 });
  assert.equal(m.perksEnabled, true);
  assert.deepEqual(m.achievements, { firstHarvest: { at: 5 }, harvest100: { at: null } });
  assert.deepEqual(m.lifetime, { harvests: 0, cropsHarvested: { carrot: 3 }, productsSold: { bread: 2 }, yearsWon: 0, yearsLost: 0, rentsPaid: 0, variety: { orders: 0, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 0 }, rare: {} }, cozy: { handPicked: 0, eggsAll: 0, ribbonsGold: 0, birds: {}, fetes: 0 } });
  assert.equal(m.ecus, 0);
  assert.equal(m.cosmetics.farmName, 'Ferme des Tilleuls');
  assert.equal(m.cosmetics.outfit, 'outfit.classic', 'tenue non possédée → défaut');
  assert.equal(m.cosmetics.path, 'path.stone');
  assert.equal(m.cosmetics.fence, 'fence.wood');
  assert.deepEqual(m.cosmetics.decor, {}, 'décors non possédés ou mauvais emplacement ignorés');
  assert.deepEqual(m.hintsSeen, ['tree']);
  // Idempotent.
  assert.deepEqual(P.normalizeProgress(m), m);
});

test('migrateProgress : v1 → succès de progression débloqués d’un coup (écus et étoiles offerts)', () => {
  const v1 = { levels: {} };
  for (let id = 1; id <= 8; id++) v1.levels[id] = { stars: 3, bestMoney: 900, completed: true };
  const res = P.migrateProgress(v1, NOW);
  assert.equal(res.migrated, true);
  assert.deepEqual(res.retroactive.sort(), ['firstYear', 'risingStar', 'veteran'].sort());
  assert.deepEqual(res.rewards, { stars: 2, ecus: 60 });
  assert.equal(res.progress.ecus, 60);
  assert.equal(res.progress.achievements.veteran.at, NOW);
  assert.equal(P.starsEarned(res.progress), 24 + 2);
  const again = P.migrateProgress(res.progress, NOW + 1);
  assert.equal(again.migrated, false);
  assert.deepEqual(again.retroactive, []);
  assert.deepEqual(again.progress, res.progress);
});

test('étoiles : gagnées (niveaux + succès), dépensées, disponibles', () => {
  let p = withLevels({ 1: 3, 2: 2, 3: 1, 4: 0 });
  assert.equal(P.starsEarned(p), 6);
  p.achievements.harvest100 = { at: 1 };
  p.achievements.firstHarvest = { at: 1 };
  assert.equal(P.starsEarned(p), 7);
  p.perks = { almanac: 1, startPurse: 2 };
  assert.equal(P.starsSpent(p), 1 + 2 + 3);
  assert.equal(P.starsAvailable(p), 1);
});

test('bonus : paliers (8 et 18 étoiles gagnées), achat, rangs, refus, remboursement, interrupteur', () => {
  let p = withLevels({ 1: 3, 2: 3 }); // 6 étoiles
  let list = P.perkList(p);
  assert.equal(list.length, 14);
  const almanac = list.find((x) => x.id === 'almanac');
  assert.deepEqual(almanac, { id: 'almanac', name: 'Almanach', description: almanac.description, tier: 1, rank: 0, maxRank: 1, nextCost: 1, unlocked: true, canBuy: true, reason: null, starsRequired: 0 });
  const thumb = list.find((x) => x.id === 'greenThumb');
  assert.equal(thumb.unlocked, false);
  assert.equal(thumb.reason, 'Il faut 8 étoiles gagnées (encore 2).');
  assert.equal(P.buyPerk(p, 'greenThumb').ok, false);
  const before = JSON.stringify(p);
  let r = P.buyPerk(p, 'startPurse');
  assert.equal(r.ok, true);
  assert.equal(JSON.stringify(p), before, 'l’entrée n’est jamais modifiée');
  p = r.progress;
  assert.deepEqual(p.perks, { startPurse: 1 });
  p = P.buyPerk(p, 'startPurse').progress; // rang 2 : 3 étoiles
  assert.deepEqual(p.perks, { startPurse: 2 });
  assert.equal(P.starsAvailable(p), 1);
  list = P.perkList(p);
  assert.equal(list.find((x) => x.id === 'startPurse').reason, 'Acquis.');
  assert.equal(list.find((x) => x.id === 'goodSeeds').reason, 'Il manque 1 étoile.');
  assert.equal(P.buyPerk(p, 'goodSeeds').reason, 'Il manque 1 étoile.');
  assert.equal(P.buyPerk(p, 'dragon').reason, 'Bonus inconnu.');
  p = P.buyPerk(p, 'almanac').progress;
  assert.deepEqual(Object.keys(p.perks), ['almanac', 'startPurse'], 'ordre stable');
  // Tier 2 et 3 selon les étoiles gagnées (pas disponibles).
  const rich = withLevels({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 }); // 18
  assert.ok(P.perkList(rich).every((x) => x.unlocked));
  // Remboursement libre.
  const refunded = P.refundPerks(p);
  assert.deepEqual(refunded.perks, {});
  assert.equal(P.starsAvailable(refunded), 6);
  // Interrupteur.
  assert.deepEqual(P.runPerks(p), { almanac: 1, startPurse: 2 });
  const off = P.setPerksEnabled(p, false);
  assert.deepEqual(P.runPerks(off), {});
  assert.equal(P.setPerksEnabled(off, true).perksEnabled, true);
  // Tout acheter coûte 41 étoiles.
  let all = withLevels(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 3])));
  for (let k = 0; k < 8; k++) all.achievements[['harvest100', 'harvest500', 'allCrops', 'artisan50', 'veteran', 'lifetime', 'risingStar', 'purist'][k]] = { at: 1 };
  assert.equal(P.starsEarned(all), 44);
  for (const perk of PERKS) for (let r2 = 0; r2 < perk.costs.length; r2++) all = P.buyPerk(all, perk.id).progress;
  assert.equal(P.starsSpent(all), 41);
  assert.equal(P.starsAvailable(all), 3);
});

test('niveaux débloqués', () => {
  const p = withLevels({ 1: 1, 2: 0 });
  assert.equal(P.isLevelUnlocked(p, 1), true);
  assert.equal(P.isLevelUnlocked(p, 2), true);
  assert.equal(P.isLevelUnlocked(p, 3), false);
  assert.equal(P.isLevelUnlocked(withLevels({ 8: 1 }), 9), true);
});

test('succès, un par un : cumuls et partie en cours', () => {
  const p = P.defaultProgress();
  // 1-3 : récoltes cumulées (cumul enregistré + partie en cours).
  assert.ok(!has(p, null, 'firstHarvest'));
  assert.ok(has(p, ctx({ year: { cropsHarvested: { carrot: 1 } } }), 'firstHarvest'));
  const p99 = { ...P.defaultProgress(), lifetime: { ...P.defaultProgress().lifetime, harvests: 99, cropsHarvested: { carrot: 99 } } };
  assert.ok(!has(p99, null, 'harvest100'));
  assert.ok(has(p99, ctx({ year: { cropsHarvested: { turnip: 1 } } }), 'harvest100'));
  assert.ok(!has(p99, ctx({ year: { cropsHarvested: { turnip: 1 } } }), 'harvest500'));
  const p499 = { ...P.defaultProgress(), lifetime: { ...P.defaultProgress().lifetime, cropsHarvested: { carrot: 499 } } };
  assert.ok(has(p499, ctx({ year: { cropsHarvested: { carrot: 1 } } }), 'harvest500'));
  // 4 : herbier complet.
  const all = Object.fromEntries(CROPS.map((c) => [c.id, 1]));
  const almost = { ...all };
  delete almost.apple;
  assert.ok(!has(p, ctx({ year: { cropsHarvested: almost } }), 'allCrops'));
  assert.ok(has(p, ctx({ year: { cropsHarvested: all } }), 'allCrops'));
  // 5 : saison dorée (saison en cours, ou meilleure saison de l'année).
  assert.ok(!has(p, ctx({ season: { harvestIncome: 499 } }), 'goldenSeason'));
  assert.ok(has(p, ctx({ season: { harvestIncome: 500 } }), 'goldenSeason'));
  assert.ok(has(p, ctx({ year: { bestSeasonHarvestIncome: 520 } }), 'goldenSeason'));
  // 6 : rien ne se perd.
  assert.ok(has(p, ctx({ status: 'victory', levelId: 2 }), 'noLoss'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 1 }), 'noLoss'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 2, year: { cropsLost: { frost: 1, rot: 0 } } }), 'noLoss'));
  assert.ok(!has(p, ctx({ status: 'playing', levelId: 2 }), 'noLoss'));
  // 7 : roi de la citrouille.
  assert.ok(!has(p, ctx({ year: { cropsHarvested: { pumpkin: 9 } } }), 'pumpkinKing'));
  assert.ok(has(p, ctx({ year: { cropsHarvested: { pumpkin: 10 } } }), 'pumpkinKing'));
  // 8 : verger.
  assert.ok(!has(p, ctx({ adultTrees: 5 }), 'orchard'));
  assert.ok(has(p, ctx({ adultTrees: 6 }), 'orchard'));
  // 9 : basse-cour ; 10 : troupeau ; 11 : ferme complète.
  assert.ok(has(p, ctx({ investments: { chickenCoop: 3 } }), 'henHouse'));
  assert.ok(!has(p, ctx({ investments: { chickenCoop: 2 } }), 'henHouse'));
  assert.ok(has(p, ctx({ investments: { cow: 1, sheep: 2, goat: 1 } }), 'herd'));
  assert.ok(!has(p, ctx({ investments: { cow: 1, sheep: 2 } }), 'herd'));
  assert.ok(has(p, ctx({ investments: { chickenCoop: 1, beehive: 1 }, availableInvestments: ['chickenCoop', 'beehive'] }), 'fullFarm'));
  assert.ok(!has(p, ctx({ investments: { chickenCoop: 1 }, availableInvestments: ['chickenCoop', 'beehive'] }), 'fullFarm'));
  // 12 : énergie verte.
  assert.ok(has(p, ctx({ dailyCharges: 0 }), 'greenEnergy'));
  assert.ok(!has(p, ctx({ dailyCharges: 1 }), 'greenEnergy'));
  // 13-16 : produits.
  assert.ok(!has(p, ctx(), 'firstProduct'));
  assert.ok(has(p, ctx({ year: { productsSold: { flour: 1 } } }), 'firstProduct'));
  assert.ok(!has(p, ctx({ year: { productsSold: { flour: 1 } } }), 'baker'));
  assert.ok(has(p, ctx({ year: { productsSold: { bread: 1 } } }), 'baker'));
  const p49 = { ...P.defaultProgress(), lifetime: { ...P.defaultProgress().lifetime, productsSold: { flour: 49 } } };
  assert.ok(!has(p49, null, 'artisan50'));
  assert.ok(has(p49, ctx({ year: { productsSold: { appleJuice: 1 } } }), 'artisan50'));
  assert.ok(has(p49, null, 'firstProduct'), 'cumul enregistré seul');
  assert.ok(!has(p, ctx({ year: { productsSold: { goatCheese: 9, cowCheese: 5 } } }), 'cheeseMaster'));
  assert.ok(has(p, ctx({ year: { productsSold: { goatCheese: 10 } } }), 'cheeseMaster'));
  // 22 : coffre-fort ; 23 : sur le fil.
  assert.ok(has(p, ctx({ status: 'victory', money: 1500 }), 'strongbox'));
  assert.ok(!has(p, ctx({ status: 'victory', money: 1499 }), 'strongbox'));
  assert.ok(!has(p, ctx({ status: 'playing', money: 5000 }), 'strongbox'));
  assert.ok(has(p, ctx({ year: { minMoneyAfterRent: 9 } }), 'closeCall'));
  assert.ok(has(p, ctx({ year: { minMoneyAfterRent: 0 } }), 'closeCall'));
  assert.ok(!has(p, ctx({ year: { minMoneyAfterRent: 10 } }), 'closeCall'));
  assert.ok(!has(p, ctx({ year: { minMoneyAfterRent: null } }), 'closeCall'));
  // 24 : pur et dur ; 25 : à la force des bras.
  assert.ok(has(p, ctx({ status: 'victory', levelId: 2, stars: 3, perksActive: false }), 'purist'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 2, stars: 3, perksActive: true }), 'purist'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 1, stars: 3 }), 'purist'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 4, stars: 2 }), 'purist'));
  assert.ok(has(p, ctx({ status: 'victory', levelId: 3 }), 'handmade'));
  assert.ok(!has(p, ctx({ status: 'victory', levelId: 3, year: { investmentsSpent: 70 } }), 'handmade'));
  assert.ok(!has(p, ctx({ status: 'bankrupt', levelId: 3 }), 'handmade'));
});

test('succès, un par un : progression (niveaux, étoiles, décorations)', () => {
  assert.ok(has(withLevels({ 1: 1 }), null, 'firstYear'));
  const eight = withLevels({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 });
  assert.ok(has(eight, null, 'veteran'));
  assert.ok(!has(withLevels({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 }), null, 'veteran'));
  const twelve = withLevels(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 3])));
  assert.ok(has(twelve, null, 'lifetime'));
  assert.ok(!has(eight, null, 'lifetime'));
  assert.ok(has(withLevels({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }), null, 'risingStar'));
  assert.ok(!has(withLevels({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 }), null, 'risingStar'));
  assert.ok(has(twelve, null, 'modelFarm'));
  assert.ok(!has(withLevels({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 }), null, 'modelFarm'));
  let p = { ...P.defaultProgress(), ecus: 1000 };
  p = P.buyCosmetic(p, 'bench').progress;
  const smalls = DECOR_SLOTS.filter((s) => s.kind === 'small');
  for (const s of smalls.slice(0, 9)) p = P.placeDecor(p, s.id, 'bench').progress;
  assert.ok(!has(p, null, 'prettyFarm'));
  p = P.placeDecor(p, smalls[9].id, 'bench').progress;
  assert.ok(has(p, null, 'prettyFarm'));
  // Un succès débloqué n'est plus proposé.
  const unlocked = P.unlockAchievements(p, ['prettyFarm'], NOW).progress;
  assert.ok(!has(unlocked, null, 'prettyFarm'));
});

test('unlockAchievements : récompenses, horodatage, pas de doublon, inconnus ignorés', () => {
  const p = P.defaultProgress();
  const { progress, rewards } = P.unlockAchievements(p, ['firstHarvest', 'harvest100', 'ghost'], NOW);
  assert.deepEqual(rewards, { stars: 1, ecus: 15 });
  assert.equal(progress.ecus, 15);
  assert.deepEqual(progress.achievements, { firstHarvest: { at: NOW }, harvest100: { at: NOW } });
  assert.equal(P.starsEarned(progress), 1);
  const again = P.unlockAchievements(progress, ['firstHarvest'], NOW + 5);
  assert.deepEqual(again.rewards, { stars: 0, ecus: 0 });
  assert.equal(again.progress.achievements.firstHarvest.at, NOW);
  assert.deepEqual(p.achievements, {}, 'entrée intacte');
});

test('achievementList : fait / date, barres de progression des compteurs', () => {
  let p = { ...P.defaultProgress(), lifetime: { ...P.defaultProgress().lifetime, cropsHarvested: { carrot: 60 } } };
  p = P.unlockAchievements(p, ['firstHarvest'], NOW).progress;
  const list = P.achievementList(p, ctx({ year: { cropsHarvested: { carrot: 3 } } }));
  assert.equal(list.length, 26);
  const byId = Object.fromEntries(list.map((a) => [a.id, a]));
  assert.deepEqual(byId.firstHarvest, { id: 'firstHarvest', name: 'Premier panier', description: 'Récolter une culture.', reward: { stars: 0, ecus: 5 }, done: true, at: NOW, progress: null });
  assert.deepEqual(byId.harvest100.progress, { value: 63, target: 100 });
  assert.deepEqual(byId.allCrops.progress, { value: 1, target: 12 });
  assert.deepEqual(byId.veteran.progress, { value: 0, target: 8 });
  assert.deepEqual(byId.pumpkinKing.progress, { value: 0, target: 10 });
  assert.equal(byId.henHouse.progress, null);
  assert.equal(P.achievementList(p, null).find((a) => a.id === 'pumpkinKing').progress, null);
});

test('écus d’une partie', () => {
  assert.equal(P.ecusForRun({ outcome: 'victory', stars: 1, money: 50 }), 15);
  assert.equal(P.ecusForRun({ outcome: 'victory', stars: 3, money: 950 }), 10 + 15 + 9);
  assert.equal(P.ecusForRun({ outcome: 'victory', stars: 2, money: 99999 }), 10 + 10 + 20);
  assert.equal(P.ecusForRun({ outcome: 'bankrupt', stars: 0, money: -5 }), 3);
  assert.equal(P.ecusForRun({ outcome: 'abandon' }), 0);
});

test('recordRunEnd : niveaux, cumuls, écus, succès (victoire, faillite, abandon)', () => {
  const g = createGame({ levelId: 1, seed: 1 , difficulty: 'classique' });
  const summary = { ...g.query.summary(), cropsHarvested: { carrot: 120, pumpkin: 3 }, productsSold: { flour: 2, caviar: 3 }, rentsPaid: 590, money: 950 };
  let p = P.defaultProgress();
  const r = P.recordRunEnd(p, { levelId: 1, outcome: 'victory', stars: 3, money: 950, summary, perksActive: false }, NOW);
  assert.deepEqual(r.progress.levels[1], { stars: 3, bestMoney: 950, completed: true, played: true });
  assert.equal(r.rewards.firstTime, true);
  assert.equal(r.rewards.newStars, true);
  assert.equal(r.rewards.newBest, true);
  assert.equal(r.rewards.ecus, 10 + 15 + 9);
  assert.deepEqual(r.progress.lifetime, { harvests: 123, cropsHarvested: { carrot: 120, pumpkin: 3 }, productsSold: { flour: 2 }, yearsWon: 1, yearsLost: 0, rentsPaid: 590, variety: { orders: 0, cartsFull: 0, medals: { bronze: 0, silver: 0, gold: 0 }, rare: {} }, cozy: { handPicked: 0, eggsAll: 0, ribbonsGold: 0, birds: {}, fetes: 0 } });
  assert.deepEqual(r.achievements.sort(), ['firstHarvest', 'firstProduct', 'firstYear', 'harvest100'].sort());
  assert.equal(r.rewards.achievementEcus, 5 + 5 + 10 + 10);
  assert.equal(r.rewards.achievementStars, 1);
  assert.equal(r.progress.ecus, 34 + 30);
  assert.equal(P.starsEarned(r.progress), 3 + 1);
  assert.deepEqual(p, P.defaultProgress(), 'entrée intacte');
  // Rejouer moins bien : étoiles et record gardés, écus quand même.
  p = r.progress;
  const r2 = P.recordRunEnd(p, { levelId: 1, outcome: 'victory', stars: 1, money: 100, summary: { ...summary, cropsHarvested: {}, productsSold: {} } }, NOW);
  assert.deepEqual(r2.progress.levels[1], { stars: 3, bestMoney: 950, completed: true, played: true });
  assert.equal(r2.rewards.newStars, false);
  assert.equal(r2.rewards.newBest, false);
  assert.equal(r2.rewards.firstTime, false);
  assert.equal(r2.rewards.ecus, 16);
  // Faillite : 3 écus, niveau joué mais pas terminé, cumul compté.
  const r3 = P.recordRunEnd(r2.progress, { levelId: 2, outcome: 'bankrupt', stars: 0, money: -3, summary: { ...summary, cropsHarvested: { tomato: 2 }, productsSold: {} } }, NOW);
  assert.deepEqual(r3.progress.levels[2], { stars: 0, bestMoney: null, completed: false, played: true });
  assert.equal(r3.rewards.ecus, 3);
  assert.equal(r3.progress.lifetime.yearsLost, 1);
  assert.equal(r3.progress.lifetime.cropsHarvested.tomato, 2);
  assert.equal(P.isLevelUnlocked(r3.progress, 3), false);
  // Abandon : 0 écu, cumul compté quand même.
  const r4 = P.recordRunEnd(r3.progress, { levelId: 2, outcome: 'abandon', money: 50, summary: { ...summary, cropsHarvested: { corn: 1 }, productsSold: {} } }, NOW);
  assert.equal(r4.rewards.ecus, 0);
  assert.equal(r4.progress.lifetime.cropsHarvested.corn, 1);
  assert.equal(r4.progress.lifetime.yearsWon, 2);
  // Les succès de fin de partie : ★★★ niveau ≥ 2 sans bonus, sans investissement, sans perte, 1 500 pièces.
  const clean = { ...summary, cropsHarvested: {}, productsSold: {}, investmentsSpent: 0, cropsLost: { frost: 0, rot: 0 } };
  const r5 = P.recordRunEnd(P.defaultProgress(), { levelId: 4, outcome: 'victory', stars: 3, money: 1600, summary: clean, perksActive: false }, NOW);
  assert.deepEqual(r5.achievements.sort(), ['handmade', 'noLoss', 'purist', 'strongbox'].sort());
  const r6 = P.recordRunEnd(P.defaultProgress(), { levelId: 4, outcome: 'victory', stars: 3, money: 1600, summary: clean, perksActive: true }, NOW);
  assert.ok(!r6.achievements.includes('purist'));
  // Pas de double comptage : la partie est déjà dans les cumuls.
  const r7 = P.recordRunEnd(P.defaultProgress(), { levelId: 1, outcome: 'abandon', summary: { ...summary, cropsHarvested: { carrot: 60 }, productsSold: {} } }, NOW);
  assert.ok(!r7.achievements.includes('harvest100'));
});

test('recordRunEnd depuis une vraie partie (résumé de victory)', () => {
  const g = createGame({ levelId: 1, seed: 2 , difficulty: 'classique' });
  let victory = null;
  g.on('victory', (e) => (victory = e));
  for (let d = 0; d < 40 && g.state.status === 'playing'; d++) {
    g.state.money += 100;
    for (const q of g.query.plots()) {
      if (q.action === 'harvest') g.actions.harvest(q.index);
      else if (q.action === 'plant') {
        const c = g.query.plantableCrops(q.index).find((x) => !x.willFreeze && x.canAfford);
        if (c) g.actions.plant(q.index, c.id);
      } else if (q.action === 'water') g.actions.water(q.index);
    }
    g.update(20);
  }
  assert.ok(victory);
  const ctxEnd = g.query.achievementContext();
  const r = P.recordRunEnd(P.defaultProgress(), { levelId: 1, outcome: 'victory', stars: victory.stars, money: victory.money, summary: victory.summary, perksActive: ctxEnd.perksActive }, NOW);
  assert.equal(r.progress.lifetime.harvests, victory.summary.totalHarvested);
  assert.ok(r.achievements.includes('firstYear'));
  assert.ok(r.achievements.includes('firstHarvest'));
});

test('cosmétiques : acheter, poser, retirer, allées, clôture, tenue, nom, conseils', () => {
  let p = { ...P.defaultProgress(), ecus: 45 };
  assert.equal(P.buyCosmetic(p, 'pond').reason, 'Il manque 5 écus.');
  assert.equal(P.buyCosmetic(p, 'ghost').reason, 'Objet inconnu.');
  assert.equal(P.buyCosmetic(p, 'path.dirt').reason, 'Déjà débloqué.');
  assert.equal(P.placeDecor(p, 'porch.left', 'gnome').reason, 'Objet pas encore débloqué.');
  let r = P.buyCosmetic(p, 'gnome');
  assert.equal(r.ok, true);
  p = r.progress;
  assert.equal(p.ecus, 15);
  assert.ok(p.cosmetics.owned.includes('gnome'));
  assert.equal(P.buyCosmetic(p, 'gnome').reason, 'Déjà débloqué.');
  p = P.placeDecor(p, 'porch.left', 'gnome').progress;
  p = P.placeDecor(p, 'road.2', 'gnome').progress; // autant d'emplacements qu'on veut
  assert.deepEqual(p.cosmetics.decor, { 'porch.left': 'gnome', 'road.2': 'gnome' });
  assert.equal(P.placeDecor(p, 'pond', 'gnome').reason, 'Cet emplacement attend un grand décor.');
  assert.equal(P.placeDecor(p, 'moon', 'gnome').reason, 'Emplacement inconnu.');
  p = P.placeDecor(p, 'porch.left', null).progress;
  assert.deepEqual(p.cosmetics.decor, { 'road.2': 'gnome' });
  p = { ...p, ecus: 200 };
  p = P.buyCosmetic(p, 'pond').progress;
  assert.equal(P.placeDecor(p, 'yard.1', 'pond').reason, 'Cet emplacement attend un petit décor.');
  assert.equal(P.placeDecor(p, 'pond', 'pond').ok, true);
  assert.equal(P.setPath(p, 'path.stone').reason, 'Objet pas encore débloqué.');
  p = P.buyCosmetic(p, 'path.stone').progress;
  p = P.setPath(p, 'path.stone').progress;
  assert.equal(p.cosmetics.path, 'path.stone');
  assert.equal(P.setFence(p, 'path.stone').ok, false);
  p = P.buyCosmetic(p, 'fence.picket').progress;
  assert.equal(P.setFence(p, 'fence.picket').progress.cosmetics.fence, 'fence.picket');
  assert.equal(P.setOutfit(p, 'outfit.raincoat').ok, false);
  assert.equal(P.setOutfit(p, 'outfit.classic').ok, true);
  // Nom de la ferme.
  assert.equal(P.setFarmName(p, '  Les   Coquelicots ').cosmetics.farmName, 'Les Coquelicots');
  assert.equal(P.setFarmName(p, '').cosmetics.farmName, 'Ferme des Tilleuls');
  assert.equal(P.setFarmName(p, 'x'.repeat(19)).cosmetics.farmName, 'Ferme des Tilleuls');
  assert.equal(P.setFarmName(p, 'x'.repeat(18)).cosmetics.farmName, 'x'.repeat(18));
  assert.equal(P.setFarmName(p, 42).cosmetics.farmName, 'Ferme des Tilleuls');
  // Conseils.
  const h = P.markHint(P.markHint(p, 'tree'), 'tree');
  assert.deepEqual(h.hintsSeen, ['tree']);
  assert.deepEqual(p.hintsSeen, []);
  // Tout le catalogue : 545 écus (les succès en rapportent 575, une année gagnée 25 à 45).
  assert.equal(COSMETICS.reduce((s, c) => s + c.price, 0), 545);
});

test('achievementContext d’une partie : forme', () => {
  const g = createGame({ levelId: 10, seed: 1 , difficulty: 'classique' });
  const c = g.query.achievementContext();
  // (lot 4) + weather (tous les modes : l'album lit le temps du jour, sans rien changer à la partie).
  assert.deepEqual(Object.keys(c).sort(), ['adultTrees', 'availableInvestments', 'dailyCharges', 'day', 'investments', 'levelId', 'money', 'perksActive', 'seasonId', 'stars', 'stats', 'status', 'weather'].sort());
  assert.equal(c.adultTrees, 4);
  assert.equal(c.perksActive, false);
  assert.equal(createGame({ levelId: 10, seed: 1, perks: { almanac: 1 } }).query.achievementContext().perksActive, true);
  assert.deepEqual(c.availableInvestments, ['chickenCoop', 'beehive', 'roadsideStand', 'sheep', 'sprinkler', 'solarPanel', 'goat', 'jamWorkshop']);
  assert.equal(c.dailyCharges, 5);
  assert.deepEqual(P.checkAchievements(P.defaultProgress(), c), []);
});
