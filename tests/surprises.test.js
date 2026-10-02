// Lot 2 « Toucher & surprises » — niveaux : activation (Détente oui, Classique non), qualité des récoltes,
// soins, légumes géants, surprises de l'aube, météos spéciales, vœux, cueillette, sauvegarde et migration,
// déterminisme, fréquences (graines fixes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadGame } from '../src/core/game.js';
import { getCrop } from '../src/data/crops.js';
import { GIANT, QUALITY, SKY, SPECIAL_WEATHERS, SURPRISE_RULES, WISHES } from '../src/data/surprises.js';
import { checkSurprises, drawSpecial, giantCandidates, mergeGiant, qualityChances, rollQuality, tryGiant } from '../src/core/surprises.js';
import { COSMETICS_BY_ID } from '../src/data/cosmetics.js';
import { buyCosmetic, defaultProgress, unlockCosmetic } from '../src/core/progression.js';
import { DAY_SECONDS, newGame, nextDay, record, rich } from './helpers.js';

const detente = (levelId = 1, seed = 42) => newGame(levelId, seed, { difficulty: 'detente' });
/** Ciel neutre (pas de météo spéciale aujourd'hui ni demain). */
const calm = (g) => {
  g.state.surprises.sky = { today: null, tomorrow: null };
};
/** Carré 2 × 2 du bloc de départ du niveau 1 (grille 6 × 4, bloc 4 × 3 décalé d'une colonne). */
const SQUARE = [1, 2, 7, 8];

/** Sème et arrose une parcelle (test). */
function sowWater(g, i, cropId = 'carrot') {
  assert.equal(g.actions.plant(i, cropId).ok, true, `semis ${i}`);
  if (g.query.plot(i).action === 'water') g.actions.water(i);
}

// ── Activation ─────────────────────────────────────────────────────────────────────────

test('activation : Détente oui (flux nouveaux), Classique non (rien de neuf dans l\'état ni les événements)', () => {
  const d = createGame({ levelId: 1, seed: 3 });
  assert.ok(d.state.surprises);
  for (const k of ['quality', 'surprise', 'sky']) assert.ok(Number.isInteger(d.state.rng[k]), k);
  const c = createGame({ levelId: 1, seed: 3, difficulty: 'classique' });
  assert.equal(c.state.surprises, undefined);
  assert.deepEqual(Object.keys(c.state.rng), ['weather', 'market', 'rot']);
  assert.equal(c.query.surprises(), null);
  assert.equal(c.query.forecast().special, undefined);
  // game.surprises (booléen du contrat) : Détente oui, Classique non.
  assert.equal(d.surprises, true);
  assert.equal(c.surprises, false);
  // Mêmes flux d'origine dans les deux modes.
  for (const k of ['weather', 'market', 'rot']) assert.equal(d.state.rng[k], c.state.rng[k]);
  // Classique : la récolte n'a pas de qualité ; l'événement weather n'a pas de special.
  const g = newGame(1, 3);
  rich(g);
  const rec = record(g);
  g.actions.plant(1, 'carrot');
  g.actions.water(1);
  nextDay(g);
  g.actions.water(1);
  nextDay(g);
  const r = g.actions.harvest(1);
  assert.equal(r.ok, true);
  assert.equal(r.quality, undefined);
  assert.equal(rec.of('harvested')[0].quality, undefined);
  assert.ok(rec.of('weather').every((e) => e.special === undefined));
  assert.equal(g.query.plot(1).quality, undefined);
  // Option explicite : Classique avec surprises, Détente sans.
  assert.ok(createGame({ levelId: 1, seed: 3, difficulty: 'classique', surprises: true }).state.surprises);
  assert.equal(createGame({ levelId: 1, seed: 3, surprises: false }).state.surprises, null);
  assert.equal(createGame({ levelId: 1, seed: 3, surprises: false }).surprises, false);
});

// ── Qualité ────────────────────────────────────────────────────────────────────────────

test('qualité : chances de base, soins (arrosage, ruche, rotation), Main verte, chance × 2, jamais dorée hors main', () => {
  const g = detente();
  rich(g);
  const p = g.state.plots[1];
  g.actions.plant(1, 'carrot');
  const base = QUALITY.base;
  // Semée sur un sol neuf : rotation (dernière récolte ≠ carotte), arrosée chaque jour pour l'instant.
  let ch = qualityChances(g.state, p);
  assert.deepEqual(g.query.plot(1).care, { wateredEveryDay: true, bees: false, rotation: true });
  assert.ok(Math.abs(ch.fine - (base.fine + QUALITY.watered.fine + QUALITY.rotation.fine)) < 1e-9);
  assert.ok(Math.abs(ch.gold - (base.gold + QUALITY.watered.gold + QUALITY.rotation.gold)) < 1e-9);
  // Un jour « à arroser » sans eau : plus de bonus d'arrosage.
  calm(g);
  nextDay(g);
  assert.equal(p.care.dry, 1);
  assert.equal(g.query.plot(1).care.wateredEveryDay, false);
  ch = qualityChances(g.state, p);
  assert.ok(Math.abs(ch.fine - (base.fine + QUALITY.rotation.fine)) < 1e-9);
  // Ruche : bonus.
  g.state.investments.beehive = 1;
  assert.ok(Math.abs(qualityChances(g.state, p).fine - (base.fine + QUALITY.rotation.fine + QUALITY.bees.fine)) < 1e-9);
  // Main verte.
  g.state.perks = { greenThumb: 1 };
  assert.ok(qualityChances(g.state, p).gold > qualityChances({ ...g.state, perks: {} }, p).gold);
  // Vœu « chance » : × 2.
  const before = qualityChances(g.state, p);
  g.state.surprises.luck = { until: g.state.time.day };
  const lucky = qualityChances(g.state, p);
  assert.ok(Math.abs(lucky.fine - before.fine * QUALITY.luckFactor) < 1e-3);
  // Pas à la main : jamais dorée.
  assert.equal(qualityChances(g.state, p, false).gold, 0);
  assert.equal(qualityChances(g.state, p, false).fine, lucky.fine);
  // Replantée après la même culture : pas de rotation.
  g.state.surprises.luck = null;
  p.growth = getCrop('carrot').growDays;
  g.actions.harvest(1);
  g.actions.plant(1, 'carrot');
  assert.equal(p.care.rotated, false);
  assert.equal(g.query.plot(1).care.rotation, false);
});

test('qualité : fréquences d\'après les chances (graine fixe, 40 000 tirages), un tirage par récolte', () => {
  const g = detente(1, 7);
  const p = { cropId: 'carrot', care: { sown: 1, dry: 0, rotated: true, wetEnd: true } };
  const ch = qualityChances(g.state, p);
  const n = 40000;
  const count = { normal: 0, fine: 0, gold: 0 };
  for (let k = 0; k < n; k++) {
    const before = g.state.rng.quality;
    const q = rollQuality(g.state, p, true);
    assert.notEqual(g.state.rng.quality, before);
    assert.equal(q.multiplier, QUALITY.multipliers[q.quality]);
    count[q.quality]++;
  }
  assert.ok(Math.abs(count.fine / n - ch.fine) < 0.006, `belles ${count.fine / n} / ${ch.fine}`);
  assert.ok(Math.abs(count.gold / n - ch.gold) < 0.003, `dorées ${count.gold / n} / ${ch.gold}`);
  // Hors main : aucune dorée.
  let gold = 0;
  for (let k = 0; k < 20000; k++) if (rollQuality(g.state, p, false).quality === 'gold') gold++;
  assert.equal(gold, 0);
});

test('qualité : la récolte paie × 1,5 / × 2 (prime arrondie), statistiques par culture, événement harvested', () => {
  const g = detente(1, 11);
  rich(g);
  calm(g);
  const rec = record(g);
  g.state.surprises.luck = { until: 999 }; // plus de belles et dorées
  const seen = new Set();
  for (let round = 0; round < 60 && seen.size < 3; round++) {
    for (const i of [1, 2, 3, 4, 7, 8, 9, 10]) {
      const p = g.state.plots[i];
      if (!p.cropId) g.actions.plant(i, 'carrot');
      p.growth = getCrop('carrot').growDays;
      delete p.giant;
      const value = g.query.plot(i).harvestValue;
      const r = g.actions.harvest(i);
      assert.equal(r.ok, true);
      assert.equal(r.qualityBonus, Math.round(value * (r.qualityMultiplier - 1)));
      assert.equal(r.amount, value + r.qualityBonus);
      seen.add(r.quality);
    }
  }
  assert.deepEqual([...seen].sort(), ['fine', 'gold', 'normal']);
  const ev = rec.of('harvested');
  assert.ok(ev.every((e) => ['normal', 'fine', 'gold'].includes(e.quality) && Number.isInteger(e.qualityBonus)));
  const stats = g.state.surprises.stats;
  assert.equal(stats.fine.carrot, ev.filter((e) => e.quality === 'fine').length);
  assert.equal(stats.gold.carrot, ev.filter((e) => e.quality === 'gold').length);
  assert.deepEqual(g.query.surprises().stats.gold, stats.gold);
});

// ── Légumes géants ─────────────────────────────────────────────────────────────────────

function growSquare(g, sq = SQUARE, cropId = 'carrot') {
  rich(g);
  calm(g);
  for (const i of sq) sowWater(g, i, cropId);
  for (let d = 0; d < getCrop(cropId).growDays; d++) {
    calm(g);
    for (const i of sq) if (g.query.plot(i).action === 'water') g.actions.water(i);
    nextDay(g);
  }
}

test('géant : un carré 2 × 2 de la même culture, semée le même jour, mûre et arrosée le dernier jour', () => {
  const g = detente(1, 5);
  const save = GIANT.chance;
  GIANT.chance = 0; // pas de fusion au hasard pendant la pousse
  try {
    growSquare(g);
    for (const i of SQUARE) {
      assert.equal(g.query.plot(i).mature, true);
      assert.equal(g.state.plots[i].care.wetEnd, true);
    }
    assert.deepEqual(giantCandidates(g.state, g.level), [SQUARE]);
    // Trois parcelles seulement, ou pas en carré : rien.
    const h = detente(1, 5);
    GIANT.chance = 0;
    growSquare(h, [1, 2, 3, 4]);
    assert.deepEqual(giantCandidates(h.state, h.level), []);
    // Pas arrosée le dernier jour : rien.
    const k = detente(1, 5);
    growSquare(k);
    k.state.plots[8].care.wetEnd = false;
    assert.deepEqual(giantCandidates(k.state, k.level), []);
    // Semées à plus d'un jour d'écart : rien.
    k.state.plots[8].care.wetEnd = true;
    k.state.plots[8].care.sown -= 2;
    assert.deepEqual(giantCandidates(k.state, k.level), []);
    // Cultures différentes : rien.
    k.state.plots[8].care.sown += 2;
    k.state.plots[8].cropId = 'turnip';
    k.state.plots[8].growth = getCrop('turnip').growDays;
    assert.deepEqual(giantCandidates(k.state, k.level), []);
  } finally {
    GIANT.chance = save;
  }
});

test('géant : fusion à l\'aube (chance), récolte × 6, quatre parcelles vidées, géant protégé de la pourriture', () => {
  const save = GIANT.chance;
  try {
    GIANT.chance = 0;
    const g = detente(1, 5);
    growSquare(g);
    // Tirage : jamais avec une chance nulle, toujours avec une chance de 1.
    assert.equal(tryGiant(g.state, g.level), null);
    GIANT.chance = 1;
    const rec = record(g);
    calm(g);
    nextDay(g);
    const ev = rec.of('giant');
    assert.equal(ev.length, 1);
    assert.deepEqual(ev[0].plots, SQUARE);
    assert.equal(ev[0].anchor, 1);
    assert.equal(ev[0].cropId, 'carrot');
    const one = Math.round(g.query.plot(1).harvestValue / GIANT.valueFactor);
    for (const i of SQUARE) {
      const q = g.query.plot(i);
      assert.deepEqual(q.giant.plots, SQUARE);
      assert.equal(q.giant.isAnchor, i === 1);
      assert.equal(q.harvestValue, ev[0].value);
    }
    assert.equal(g.state.surprises.stats.giants.carrot, 1);
    assert.equal(g.query.surprises().giants.length, 1);
    // Récolte depuis n'importe quelle parcelle du géant.
    const money = g.state.money;
    const r = g.actions.harvest(8);
    assert.equal(r.ok, true);
    assert.deepEqual(r.giant.plots, SQUARE);
    assert.ok(Math.abs(r.amount - one * GIANT.valueFactor) <= GIANT.valueFactor);
    assert.equal(g.state.money, money + r.amount);
    for (const i of SQUARE) {
      assert.equal(g.state.plots[i].cropId, null);
      assert.equal(g.state.plots[i].giant, undefined);
      assert.equal(g.state.plots[i].lastHarvested, 'carrot');
    }
    assert.equal(rec.of('giantHarvested').length, 1);
    assert.equal(g.state.stats.year.cropsHarvested.carrot, 4);
    assert.equal(g.actions.harvest(1).ok, false);
    // Pourriture : un géant ne pourrit pas (niveau 3, aube pluvieuse, chance de maladie forcée).
    const h = detente(3, 5);
    rich(h);
    for (const i of h.state.plots.map((p, k) => (p.unlocked ? k : -1)).filter((k) => k >= 0).slice(0, 4)) {
      h.state.plots[i].cropId = 'carrot';
      h.state.plots[i].growth = 2;
    }
    const open = h.state.plots.map((p, k) => (p.unlocked ? k : -1)).filter((k) => k >= 0);
    mergeGiant(h.state, open.slice(0, 4));
    const lvl = h.level;
    const rot = lvl.modifiers.rotChance;
    lvl.modifiers.rotChance = 1;
    try {
      calm(h);
      h.state.surprises.hedgehog = null;
      nextDay(h, 'rain');
      for (const i of open.slice(0, 4)) assert.equal(h.state.plots[i].cropId, 'carrot');
    } finally {
      lvl.modifiers.rotChance = rot;
    }
  } finally {
    GIANT.chance = save;
  }
});

// ── Surprises de l'aube ────────────────────────────────────────────────────────────────

test('surprises : fée (carré 3 × 3 mûri), coffre (pièces ou écus), cercle de fées (cueillette), chouette (une fois)', () => {
  const g = detente(1, 9);
  rich(g, 1000);
  for (const i of [1, 2, 3, 7, 8, 9, 13, 14, 15]) g.actions.plant(i, 'wheat');
  const rec = record(g);
  const fairy = g.actions.triggerSurprise('fairy');
  assert.equal(fairy.ok, true);
  assert.equal(fairy.surprise.plots.length, 9);
  assert.equal(fairy.surprise.center, 8);
  for (const i of fairy.surprise.plots) assert.equal(g.query.plot(i).mature, true);
  assert.equal(rec.of('surprise')[0].kind, 'fairy');
  // Fée sans culture qui pousse : impossible.
  for (const i of fairy.surprise.plots) g.actions.harvest(i);
  assert.equal(g.actions.triggerSurprise('fairy').ok, false);
  // Coffre : pièces (versées) ou écus (pour l'interface).
  let coins = 0;
  let ecus = 0;
  for (let k = 0; k < 30; k++) {
    const m = g.state.money;
    const c = g.actions.triggerSurprise('chest').surprise;
    if (c.amount) {
      coins++;
      assert.equal(g.state.money, m + c.amount);
      assert.ok(c.amount >= 15 && c.amount <= 30);
    } else {
      ecus++;
      assert.ok(c.ecus >= 3 && c.ecus <= 6);
      assert.equal(g.state.money, m);
    }
  }
  assert.ok(coins > 0 && ecus > 0);
  assert.ok(g.state.stats.year.surpriseIncome > 0);
  assert.equal(g.query.summary().surpriseIncome, g.state.stats.year.surpriseIncome);
  // Cercle de fées : sur une parcelle vide, cueilli par la récolte.
  const ring = g.actions.triggerSurprise('ring').surprise;
  const i = ring.plotIndex;
  assert.equal(g.state.plots[i].cropId, null);
  const q = g.query.plot(i);
  assert.equal(q.action, 'harvest');
  assert.equal(q.forage.kind, 'ring');
  assert.equal(g.actions.plant(i, 'carrot').ok, false);
  const m = g.state.money;
  const pick = g.actions.harvest(i);
  assert.deepEqual([pick.ok, pick.forage, pick.amount], [true, 'ring', ring.value]);
  assert.equal(g.state.money, m + ring.value);
  assert.equal(rec.of('foragePicked').length, 1);
  assert.equal(g.query.plot(i).action, 'plant');
  // Chouette : une fois par partie, décor à débloquer.
  const owl = g.actions.triggerSurprise('owl').surprise;
  assert.equal(owl.cosmeticId, 'owl.carved');
  assert.ok(COSMETICS_BY_ID[owl.cosmeticId].found);
  assert.equal(g.actions.triggerSurprise('owl').ok, false);
  // Renard : seulement en carrière ; hérisson : seulement si les cultures peuvent pourrir.
  assert.equal(g.actions.triggerSurprise('fox').ok, false);
  assert.equal(g.actions.triggerSurprise('hedgehog').ok, false);
  assert.equal(g.actions.triggerSurprise('dragon').ok, false);
});

test('surprises : hérisson (niveau pluvieux) → aucune pourriture pendant 6 jours', () => {
  const g = detente(3, 4);
  rich(g);
  const r = g.actions.triggerSurprise('hedgehog');
  assert.equal(r.ok, true);
  assert.equal(r.surprise.days, 6);
  const open = g.state.plots.map((p, k) => (p.unlocked ? k : -1)).filter((k) => k >= 0);
  const rot = g.level.modifiers.rotChance;
  g.level.modifiers.rotChance = 1;
  try {
    for (const i of open) g.actions.plant(i, 'turnip');
    const rec = record(g);
    for (let d = 0; d < 4; d++) {
      calm(g);
      nextDay(g, 'rain');
    }
    assert.equal(rec.of('rot').length, 0);
    assert.ok(g.query.surprises().hedgehog);
    // Après son départ : la pluie peut de nouveau faire pourrir.
    g.state.surprises.hedgehog = { until: 1 };
    for (const i of open) if (!g.state.plots[i].cropId) g.actions.plant(i, 'turnip');
    calm(g);
    nextDay(g, 'rain');
    assert.ok(rec.of('rot').length > 0);
    assert.equal(g.state.surprises.hedgehog, null);
  } finally {
    g.level.modifiers.rotChance = rot;
  }
});

test('surprises : rares (≈ 1 tous les 10 à 20 jours), jamais pendant les premiers jours ni deux jours de suite', () => {
  let days = 0;
  let n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = createGame({ levelId: 1, seed });
    rich(g);
    let last = -99;
    g.on('surprise', () => {
      const d = g.state.time.day;
      assert.ok(d > SURPRISE_RULES.graceDays);
      assert.ok(d - last >= SURPRISE_RULES.minGap);
      last = d;
      n++;
    });
    while (g.state.status === 'playing') {
      for (let i = 0; i < g.state.plots.length; i++) {
        const q = g.query.plot(i);
        if (q.action === 'harvest') g.actions.harvest(i);
        else if (q.action === 'plant') {
          const c = g.query.plantableCrops(i)[0];
          if (c) g.actions.plant(i, c.id);
        }
      }
      g.update(DAY_SECONDS);
      days++;
    }
  }
  const every = days / n;
  assert.ok(every > 9 && every < 22, `une surprise tous les ${every.toFixed(1)} jours`);
});

// ── Météos spéciales ───────────────────────────────────────────────────────────────────

test('météo spéciale : conditions (base, veille, saison), un seul tirage du flux « sky », prévision la veille', () => {
  const g = detente(1, 2);
  const s = g.state;
  // Pluie chaude seulement sur la pluie, brouillard sur un temps nuageux, jamais sur la neige.
  const seen = { rain: new Set(), cloudy: new Set(), sunny: new Set(), snow: new Set() };
  for (let k = 0; k < 4000; k++) {
    for (const base of Object.keys(seen)) {
      const before = s.rng.sky;
      const id = drawSpecial(s, base, 'rain', 'autumn');
      assert.notEqual(s.rng.sky, before);
      if (id) seen[base].add(id);
    }
  }
  assert.deepEqual([...seen.rain].sort(), ['warmrain']);
  assert.deepEqual([...seen.cloudy].sort(), ['fog', 'rainbow', 'shootingstar']);
  assert.deepEqual([...seen.sunny].sort(), ['goldenhour', 'rainbow', 'shootingstar']);
  assert.equal(seen.snow.size, 0);
  // Arc-en-ciel seulement après la pluie ; brouillard pas en été.
  for (let k = 0; k < 2000; k++) {
    assert.notEqual(drawSpecial(s, 'sunny', 'sunny', 'summer'), 'rainbow');
    assert.notEqual(drawSpecial(s, 'cloudy', 'rain', 'summer'), 'fog');
  }
  // Carrière : jamais d'arc-en-ciel (c'est un événement de carrière).
  const fake = { ...s, mode: 'career', rng: { ...s.rng } };
  for (let k = 0; k < 2000; k++) assert.notEqual(drawSpecial(fake, 'sunny', 'rain', 'spring'), 'rainbow');
  // Prévision : la météo spéciale de demain devient celle d'aujourd'hui à l'aube.
  s.surprises.sky = { today: null, tomorrow: 'goldenhour' };
  assert.equal(g.query.forecast().special.tomorrow, 'goldenhour');
  const rec = record(g);
  nextDay(g, 'sunny');
  assert.equal(s.surprises.sky.today, 'goldenhour');
  assert.equal(g.query.forecast().special.today, 'goldenhour');
  assert.equal(rec.of('specialWeather')[0].id, 'goldenhour');
  assert.equal(rec.of('specialWeather')[0].icon, 'icon.weather.goldenhour');
  assert.deepEqual(rec.of('weather')[0].special, { ...s.surprises.sky });
  assert.equal(s.surprises.stats.weathers.goldenhour, 1);
  assert.ok(SPECIAL_WEATHERS.every((w) => w.icon === `icon.weather.${w.id}`));
});

test('météo spéciale : heure dorée (× 1,2), pluie chaude (pousse × 1,5), arc-en-ciel (× 1,1), brouillard (champignons)', () => {
  const g = detente(1, 6);
  rich(g);
  calm(g);
  g.actions.plant(1, 'carrot');
  g.state.plots[1].growth = 2;
  const normal = g.query.plot(1).harvestValue;
  g.state.surprises.sky.today = 'goldenhour';
  assert.ok(Math.abs(g.query.plot(1).harvestValue - normal * SKY.goldenPrice) <= 1);
  // Pluie chaude : pousse du jour × 1,5 (blé : 4 jours).
  const h = detente(1, 6);
  rich(h);
  calm(h);
  h.actions.plant(1, 'wheat');
  h.actions.water(1);
  h.state.surprises.sky.today = 'warmrain';
  nextDay(h);
  assert.equal(h.state.plots[1].growth, SKY.warmrainGrowth);
  h.state.surprises.sky = { today: 'rainbow', tomorrow: null };
  h.actions.water(1);
  nextDay(h);
  assert.ok(Math.abs(h.state.plots[1].growth - (SKY.warmrainGrowth + SKY.rainbowGrowth)) < 1e-9);
  // Brouillard : champignons sur des parcelles vides, à cueillir (puis fanés au bout de 2 jours).
  const f = detente(1, 6);
  rich(f);
  f.state.surprises.sky = { today: null, tomorrow: 'fog' };
  const rec = record(f);
  nextDay(f, 'cloudy');
  const ev = rec.of('forage');
  assert.equal(ev.length, 1);
  assert.ok(ev[0].plots.length >= 2 && ev[0].plots.length <= 4);
  for (const i of ev[0].plots) assert.equal(f.query.plot(i).forage.kind, 'mushroom');
  const first = ev[0].plots[0];
  const pick = f.actions.harvest(first);
  assert.equal(pick.ok, true);
  assert.equal(pick.amount, ev[0].value);
  calm(f);
  nextDay(f);
  calm(f);
  nextDay(f);
  for (const i of ev[0].plots) assert.equal(f.state.plots[i].forage, undefined);
});

test('étoile filante : vœu le lendemain matin (3 vœux sur 4), chaque vœu exaucé', () => {
  for (const boon of WISHES.map((w) => w.id)) {
    let g = null;
    for (let seed = 1; seed < 40 && !g; seed++) {
      const t = detente(1, seed);
      rich(t, 500);
      t.state.surprises.sky = { today: 'shootingstar', tomorrow: null };
      calm2(t);
      nextDay(t);
      if (t.query.surprises().wish.options.some((o) => o.id === boon)) g = t;
    }
    assert.ok(g, boon);
    const wish = g.query.surprises().wish;
    assert.equal(wish.options.length, 3);
    g.actions.plant(1, 'wheat');
    g.state.plots[1].watered = false;
    const before = { money: g.state.money, growth: g.state.plots[1].growth };
    const rec = record(g);
    const r = g.actions.makeWish(boon);
    assert.equal(r.ok, true, boon);
    assert.equal(rec.of('wishGranted')[0].id, boon);
    assert.equal(g.query.surprises().wish, null);
    assert.equal(g.actions.makeWish(boon).ok, false);
    if (boon === 'coins') assert.equal(g.state.money, before.money + r.amount);
    if (boon === 'growth') assert.equal(g.state.plots[1].growth, before.growth + 1);
    if (boon === 'water') assert.equal(g.state.plots[1].watered, true);
    if (boon === 'luck') assert.ok(g.query.surprises().luck.daysLeft >= 2);
  }
  function calm2(t) {
    // la prévision de demain ne compte pas ici
    t.state.surprises.sky.tomorrow = null;
  }
});

test('météo spéciale : fréquences raisonnables sur une année (graines fixes)', () => {
  const count = {};
  let days = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const g = createGame({ levelId: 1, seed });
    g.on('specialWeather', (e) => (count[e.id] = (count[e.id] || 0) + 1));
    while (g.state.status === 'playing' && g.state.time.day < 28) {
      rich(g, 1000);
      g.update(DAY_SECONDS);
      days++;
    }
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  assert.ok(total / days > 0.02 && total / days < 0.12, `${total} météos spéciales en ${days} jours`);
});

// ── Déterminisme, sauvegarde, migration ────────────────────────────────────────────────

function playScripted(seed, saveAt = null) {
  let g = createGame({ levelId: 1, seed });
  const events = [];
  const watch = (game) => game.on('*', (e) => {
    if (['surprise', 'giant', 'specialWeather', 'forage', 'wish', 'harvested'].includes(e.type)) events.push(JSON.stringify(e));
  });
  watch(g);
  for (let d = 0; d < 27 && g.state.status === 'playing'; d++) {
    if (d === saveAt) {
      g = loadGame(JSON.parse(JSON.stringify(g.serialize())));
      watch(g);
    }
    const wish = g.query.surprises().wish;
    if (wish) g.actions.makeWish(wish.options[0].id);
    for (let i = 0; i < g.state.plots.length; i++) {
      const q = g.query.plot(i);
      if (q.action === 'harvest') g.actions.harvest(i);
      else if (q.action === 'plant') {
        const c = g.query.plantableCrops(i).find((x) => x.canAfford && !x.willFreeze);
        if (c) g.actions.plant(i, c.id);
      } else if (q.action === 'water') g.actions.water(i);
    }
    g.update(DAY_SECONDS * 0.4);
    g.update(DAY_SECONDS * 0.6);
  }
  return { events, money: g.state.money, state: g.serialize() };
}

test('déterminisme : même graine → mêmes surprises ; sauvegarde en cours de partie → même suite', () => {
  const a = playScripted(17);
  const b = playScripted(17);
  assert.deepEqual(a.events, b.events);
  assert.ok(a.events.some((e) => e.includes('"quality"')));
  const c = playScripted(17, 12);
  assert.deepEqual(c.events, a.events);
  assert.deepEqual(c.state, a.state);
});

test('sauvegarde : aller-retour avec géant, champignons, vœu, effets ; état abîmé refusé', () => {
  const g = detente(1, 21);
  rich(g);
  const save = GIANT.chance;
  GIANT.chance = 0;
  try {
    growSquare(g);
  } finally {
    GIANT.chance = save;
  }
  mergeGiant(g.state, SQUARE);
  g.actions.triggerSurprise('ring');
  g.state.surprises.wish = { day: g.state.time.day, options: ['coins', 'growth', 'luck'] };
  g.state.surprises.luck = { until: 30 };
  const s = JSON.parse(JSON.stringify(g.serialize()));
  const back = loadGame(s);
  assert.deepEqual(back.serialize(), g.serialize());
  assert.equal(back.query.plot(1).giant.plots.length, 4);
  assert.ok(back.query.surprises().wish);
  assert.equal(checkSurprises(back.state), null);
  // Abîmés : refusés.
  const bad = (fn) => {
    const x = JSON.parse(JSON.stringify(s));
    fn(x);
    assert.throws(() => loadGame(x), /Sauvegarde invalide/);
  };
  bad((x) => (x.surprises.sky.today = 'tornade'));
  bad((x) => (x.surprises.wish.options = ['pony']));
  bad((x) => (x.plots[2].giant = 99));
  bad((x) => (x.plots[1].care = { sown: 'hier' }));
  bad((x) => (x.surprises.stats.forage = -1));
  bad((x) => (x.plots[3].forage = { kind: 'truffe', value: 3, until: 9 }));
  bad((x) => (x.surprises.v = 9));
});

test('migration : une partie Détente d\'avant le lot 2 reçoit les surprises, une partie Classique non', () => {
  const g = createGame({ levelId: 1, seed: 8 });
  const old = JSON.parse(JSON.stringify(g.serialize()));
  delete old.surprises;
  delete old.rng.quality;
  delete old.rng.surprise;
  delete old.rng.sky;
  const back = loadGame(old);
  assert.ok(back.state.surprises);
  assert.ok(Number.isInteger(back.state.rng.sky));
  assert.equal(back.query.surprises().enabled, true);
  // Classique (et toute sauvegarde sans mode : classique) : rien.
  const c = createGame({ levelId: 1, seed: 8, difficulty: 'classique' });
  const cs = JSON.parse(JSON.stringify(c.serialize()));
  assert.equal(loadGame(cs).state.surprises, undefined);
  delete cs.difficulty;
  assert.equal(loadGame(cs).state.surprises, undefined);
  // Détente sans surprises (option) : rien non plus à la reprise.
  const off = createGame({ levelId: 1, seed: 8, surprises: false });
  assert.equal(loadGame(JSON.parse(JSON.stringify(off.serialize()))).state.surprises, null);
});

// ── Décors trouvés ─────────────────────────────────────────────────────────────────────

test('décors trouvés : unlockCosmetic (gratuit, already), buyCosmetic refuse les objets trouvés', () => {
  let p = defaultProgress();
  p.ecus = 100;
  assert.equal(buyCosmetic(p, 'owl.carved').ok, false);
  assert.match(buyCosmetic(p, 'statue.small').reason, /trouve à la ferme/);
  const r = unlockCosmetic(p, 'owl.carved');
  assert.deepEqual([r.ok, r.already], [true, false]);
  assert.ok(r.progress.cosmetics.owned.includes('owl.carved'));
  assert.equal(r.progress.ecus, 100);
  p = r.progress;
  assert.equal(unlockCosmetic(p, 'owl.carved').already, true);
  assert.equal(unlockCosmetic(p, 'licorne').ok, false);
});

