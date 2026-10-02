// Lot 2 « Toucher & surprises » — carrière : activation, dorée seulement à la main (salariés et machines : belle
// au plus), légume géant (récolte à la main), renard (pas de corbeaux), heure dorée, trouvailles au défrichage
// (coffre, pièces, bocal de graines, puits, statue, agneau), cueillette, sauvegarde, migration, déterminisme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer, checkCareerState } from '../src/core/career/career.js';
import { careerCropPrice } from '../src/core/career/market.js';
import { getCrop } from '../src/data/crops.js';
import { FINDS, GIANT, SKY } from '../src/data/surprises.js';
import { giantCandidates, mergeGiant } from '../src/core/surprises.js';
import { sowChoice } from '../src/core/career/crew.js';
import { lotFinds } from '../src/core/career/surprises.js';
import { DAY_SECONDS, nextDay, record, setRank, withExtension } from './career-helpers.js';

const career = (opts = {}) => {
  const g = createCareer({ seed: 7, ...opts });
  g.state.weather.today = 'sunny';
  if (g.state.surprises) g.state.surprises.sky = { today: null, tomorrow: null };
  return g;
};
const calm = (g) => {
  g.state.surprises.sky = { today: null, tomorrow: null };
};
/** Carré 2 × 2 du champ de départ (4 colonnes : cases 0, 1, 4, 5). */
const SQUARE = [0, 1, 4, 5];

test('carrière : surprises actives par défaut ; désactivées (null) restent désactivées à la reprise', () => {
  const g = createCareer({ seed: 1 });
  assert.ok(g.state.surprises);
  assert.deepEqual(g.state.career.heirlooms, []);
  assert.ok(g.query.surprises().enabled);
  const off = createCareer({ seed: 1, surprises: false });
  assert.equal(off.state.surprises, null);
  assert.equal(off.query.surprises(), null);
  const back = loadCareer(JSON.parse(JSON.stringify(off.serialize())));
  assert.equal(back.state.surprises, null);
  // Sans surprises : pas de qualité à la récolte.
  off.state.plots[0].cropId = 'carrot';
  off.state.plots[0].growth = 2;
  assert.equal(off.actions.harvest(0).quality, undefined);
});

test('carrière : dorée seulement à la main ; salariés et machines : belle au plus', () => {
  const ext = withExtension();
  try {
    const g = career();
    const api = ext.api();
    g.state.money = 1e6;
    g.state.surprises.luck = { until: 9999 };
    const count = { player: { normal: 0, fine: 0, gold: 0 }, staff: { normal: 0, fine: 0, gold: 0 }, machine: { normal: 0, fine: 0, gold: 0 } };
    for (let k = 0; k < 600; k++) {
      for (const by of ['player', 'staff', 'machine']) {
        const p = g.state.plots[0];
        p.cropId = 'carrot';
        p.growth = 2;
        p.care = { sown: 1, dry: 0, rotated: true, wetEnd: true };
        const r = by === 'player' ? g.actions.harvest(0) : api.harvest(0, { by });
        assert.equal(r.ok, true);
        count[by][r.quality]++;
      }
    }
    assert.ok(count.player.gold > 0, JSON.stringify(count));
    assert.equal(count.staff.gold, 0);
    assert.equal(count.machine.gold, 0);
    assert.ok(count.staff.fine > 0 && count.machine.fine > 0);
    // query.plot : chances à la main.
    g.state.plots[1].cropId = 'carrot';
    g.state.plots[1].growth = 0;
    assert.ok(g.query.plot(1).quality.gold > 0);
  } finally {
    ext.off();
  }
});

test('carrière : la prime de qualité est versée même si la récolte part au grenier', () => {
  const g = career();
  g.state.money = 1e5;
  g.state.surprises.luck = { until: 9999 };
  let saw = false;
  for (let k = 0; k < 400 && !saw; k++) {
    const p = g.state.plots[2];
    p.cropId = 'carrot';
    p.growth = 2;
    const value = g.query.plot(2).handValue;
    const r = g.actions.harvest(2);
    assert.equal(r.qualityBonus, Math.round(value * (r.qualityMultiplier - 1)));
    if (!r.stored) assert.equal(r.amount, value + r.qualityBonus);
    if (r.quality !== 'normal') saw = true;
  }
  assert.ok(saw);
});

test('carrière : légume géant (grille du terrain), récolte à la main seulement, × 6 de la valeur à la main', () => {
  const ext = withExtension();
  const save = GIANT.chance;
  try {
    const g = career();
    const api = ext.api();
    g.state.money = 1e5;
    GIANT.chance = 0;
    for (const i of SQUARE) g.actions.plant(i, 'carrot');
    for (let d = 0; d < 2; d++) {
      calm(g);
      for (const i of SQUARE) if (g.query.plot(i).action === 'water') g.actions.water(i);
      nextDay(g);
    }
    assert.deepEqual(giantCandidates(g.state, g.level), [SQUARE]);
    GIANT.chance = 1;
    const rec = record(g);
    // Pas mûre de nouveau : il faut une aube avec le carré mûr → la fusion a lieu à l'aube suivante.
    calm(g);
    nextDay(g);
    assert.equal(rec.of('giant').length, 1);
    const one = g.query.plot(0).handValue / GIANT.valueFactor;
    assert.ok(g.query.plot(5).giant);
    // Salarié, machine : pas tout de suite (le géant attend le joueur GIANT.handDays jours).
    assert.equal(api.harvest(5, { by: 'staff' }).ok, false);
    assert.equal(api.harvest(5, { by: 'machine' }).ok, false);
    const r = g.actions.harvest(5);
    assert.equal(r.ok, true);
    assert.ok(Math.abs(r.amount - one * GIANT.valueFactor) <= 1);
    assert.equal(rec.of('giantHarvested')[0].by, 'player');
    for (const i of SQUARE) assert.equal(g.state.plots[i].cropId, null);
    assert.equal(g.state.career.lifetime.handPicked, 4);
    // Géant laissé aux machines : après 3 jours, elles le récoltent sans la prime (4 × leur valeur).
    const g2 = career();
    g2.state.money = 1e5;
    for (const i of SQUARE) {
      g2.state.plots[i].cropId = 'carrot';
      g2.state.plots[i].growth = 2;
    }
    mergeGiant(g2.state, SQUARE);
    const api2 = ext.api();
    assert.equal(api2.harvest(0, { by: 'machine' }).ok, false);
    g2.state.plots[0].giantSince -= GIANT.handDays;
    const one2 = api2.harvestAmount(0, 'machine');
    const r2 = api2.harvest(4, { by: 'machine' });
    assert.equal(r2.ok, true);
    assert.equal(r2.amount, one2 * 4);
    assert.equal(r2.handPicked, false);
    for (const i of SQUARE) assert.equal(g2.state.plots[i].cropId, null);
  } finally {
    GIANT.chance = save;
    ext.off();
  }
});

test('carrière : renard → plus de corbeaux jusqu\'à la fin de la saison ; hérisson jamais (pas de pourriture)', () => {
  const g = career();
  setRank(g, 2);
  g.state.money = 1e5;
  for (let i = 0; i < 12; i++) g.actions.plant(i, 'wheat');
  const fox = g.actions.triggerSurprise('fox');
  assert.equal(fox.ok, true);
  assert.equal(fox.surprise.until, g.state.career.seasonLength);
  assert.equal(g.actions.career.triggerEvent('crows').ok, false);
  assert.ok(g.query.surprises().fox);
  assert.equal(g.actions.triggerSurprise('hedgehog').ok, false);
  // Saison suivante : le renard est reparti, les corbeaux peuvent revenir.
  while (g.state.time.seasonIndex === 0) nextDay(g);
  assert.equal(g.state.surprises.fox, null);
  for (let i = 0; i < 12; i++) {
    if (g.query.plot(i).action === 'harvest') g.actions.harvest(i);
    if (!g.state.plots[i].cropId) g.actions.plant(i, 'wheat');
  }
  assert.equal(g.actions.career.triggerEvent('crows').ok, true);
});

test('carrière : heure dorée → récoltes et grenier × 1,2 (fournisseur priceFactor), pas les produits', () => {
  const g = career();
  const crop = getCrop('carrot');
  const before = careerCropPrice(g.state, g.level, crop);
  g.state.surprises.sky.today = 'goldenhour';
  assert.ok(Math.abs(careerCropPrice(g.state, g.level, crop) - before * SKY.goldenPrice) < 1e-9);
  assert.ok(Math.abs(careerCropPrice(g.state, g.level, crop, 'stock') - before * SKY.goldenPrice) < 1e-9);
  // L'arc-en-ciel de carrière est montré comme météo spéciale.
  g.state.surprises.sky.today = null;
  g.state.career.events.active = { id: 'rainbow', kind: 'rainbow', day: 1, endDay: 1, data: { growthBonus: 0.1 } };
  assert.equal(g.query.forecast().special.today, 'rainbow');
});

test('trouvailles : à l\'achat d\'un terrain (1 ou 2), effets, puits qui arrose, une fois chacun pour puits/statue/agneau', () => {
  const kinds = {};
  let total = 0;
  let buys = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = createCareer({ seed });
    g.state.money = 1e6;
    setRank(g, 6);
    const rec = record(g);
    for (let k = 0; k < 6; k++) {
      const money = g.state.money;
      const r = g.actions.career.buyLot();
      assert.equal(r.ok, true);
      buys++;
      assert.ok(r.finds.length >= 1 && r.finds.length <= 2);
      const ev = rec.of('finds').at(-1);
      assert.equal(ev.lotId, r.lotId);
      assert.deepEqual(ev.finds.map((f) => f.kind), r.finds.map((f) => f.kind));
      let earned = 0;
      for (const f of r.finds) {
        kinds[f.kind] = (kinds[f.kind] || 0) + 1;
        total++;
        assert.ok(f.title && f.text && f.icon);
        if (f.amount) earned += f.amount;
      }
      assert.equal(g.state.money, money - r.cost + earned);
    }
    const s = g.state.surprises;
    for (const once of ['well', 'statue', 'lamb']) assert.ok((s.stats.finds[once] || 0) <= 1);
    assert.equal(g.state.career.heirlooms.length, s.stats.finds.seedjar || 0);
    assert.equal(checkCareerState(g.serialize()), null);
  }
  for (const f of FINDS) assert.ok(kinds[f.id] > 0, `${f.id} jamais trouvé`);
  assert.ok(total / buys > 1.2 && total / buys < 1.6);
});

test('trouvailles : puits (arrosage à l\'aube), bocal (graines anciennes), agneau (mouton si la bergerie a de la place)', () => {
  const ext = withExtension();
  try {
    const g = career();
    const api = ext.api();
    g.state.money = 1e6;
    setRank(g, 6);
    const r = g.actions.career.buyLot();
    const lotId = r.lotId;
    g.actions.career.developLot(lotId, 'field');
    g.state.surprises.wells = [lotId];
    const plots = g.state.plots.map((p, i) => (p.lot === lotId && p.unlocked ? i : -1)).filter((i) => i >= 0);
    for (const i of plots.slice(0, 4)) g.actions.plant(i, 'wheat');
    calm(g);
    nextDay(g, 'sunny');
    for (const i of plots.slice(0, 4)) assert.equal(g.state.plots[i].watered, true, `puits ${i}`);
    assert.ok(g.state.lastDawn.sprinkled.some((i) => plots.includes(i)));
    // Bocal et agneau : on les force en rejouant les trouvailles jusqu'à les obtenir.
    let jar = null;
    let lamb = null;
    for (let k = 0; k < 200 && (!jar || !lamb); k++) {
      g.state.surprises.stats.finds = {};
      g.state.career.buildings.sheepfold = g.state.career.buildings.sheepfold || null;
      for (const f of lotFinds(api, lotId)) {
        if (f.kind === 'seedjar') jar = f;
        if (f.kind === 'lamb') lamb = f;
      }
    }
    assert.ok(jar && getCrop(jar.cropId));
    assert.ok(g.state.career.heirlooms.some((h) => h.cropId === jar.cropId && h.lotId === lotId));
    // Pas de bergerie, poulailler plein ? Poule ou pièces ; sinon mouton.
    assert.ok(['hen', 'sheep'].includes(lamb.animal) || lamb.amount > 0);
  } finally {
    ext.off();
  }
});

test('carrière : champignons cueillis à la main ; salariés et machines qui sèment là les ramassent pour vous', () => {
  const ext = withExtension();
  try {
    const g = career();
    const api = ext.api();
    g.state.money = 1e5;
    const ring = g.actions.triggerSurprise('ring');
    assert.equal(ring.ok, true);
    const i = ring.surprise.plotIndex;
    assert.equal(g.state.plots[i].env, 'field');
    assert.equal(api.harvest(i, { by: 'staff' }).ok, false);
    assert.equal(g.actions.plant(i, 'carrot').ok, false);
    const m = g.state.money;
    const r = g.actions.harvest(i);
    assert.equal(r.ok, true);
    assert.equal(g.state.money, m + ring.surprise.value);
    // Une machine qui sème sur des champignons les ramasse pour vous (payés) : jamais de champ bloqué.
    const again = g.actions.triggerSurprise('ring').surprise;
    const k = again.plotIndex;
    const rec = record(g);
    const m2 = g.state.money;
    const cost = api.seedCost('carrot');
    assert.equal(api.plant(k, 'carrot', { by: 'machine' }).ok, true);
    assert.equal(g.state.money, m2 + again.value - cost);
    g.update(0.01); // (les événements poussés par l'API des extensions partent au prochain update)
    assert.equal(rec.of('foragePicked')[0].by, 'machine');
    assert.equal(g.state.plots[k].forage, undefined);
    void sowChoice;
  } finally {
    ext.off();
  }
});

function playCareer(seed, saveAt = null, days = 60) {
  let g = createCareer({ seed });
  const events = [];
  const watch = (game) => game.on('*', (e) => {
    if (['surprise', 'giant', 'specialWeather', 'forage', 'wish', 'finds'].includes(e.type) || (e.type === 'harvested' && e.quality !== 'normal')) events.push(JSON.stringify(e));
  });
  watch(g);
  for (let d = 0; d < days; d++) {
    if (d === saveAt) {
      g = loadCareer(JSON.parse(JSON.stringify(g.serialize())));
      watch(g);
    }
    const wish = g.query.surprises().wish;
    if (wish) g.actions.makeWish(wish.options[0].id);
    if (d === 20) {
      g.state.money += 1000;
      g.actions.career.buyLot();
    }
    for (let i = 0; i < g.state.plots.length; i++) {
      const q = g.query.plot(i);
      if (q.action === 'harvest') g.actions.harvest(i);
      else if (q.action === 'plant') {
        const c = g.query.plantableCrops(i).find((x) => x.canAfford && !x.willFreeze);
        if (c) g.actions.plant(i, c.id);
      } else if (q.action === 'water') g.actions.water(i);
    }
    g.update(DAY_SECONDS * 0.5);
    g.update(DAY_SECONDS * 0.5);
  }
  return { events, state: g.serialize() };
}

test('carrière : déterminisme et sauvegarde en cours de partie (mêmes surprises, même état)', () => {
  const a = playCareer(11);
  const b = playCareer(11);
  assert.deepEqual(a.events, b.events);
  assert.ok(a.events.length > 3);
  const c = playCareer(11, 33);
  assert.deepEqual(c.events, a.events);
  assert.deepEqual(c.state, a.state);
});

test('carrière : migration d\'une sauvegarde d\'avant le lot 2 (surprises activées, graines anciennes vides)', () => {
  const g = createCareer({ seed: 4 });
  const old = JSON.parse(JSON.stringify(g.serialize()));
  delete old.surprises;
  delete old.career.heirlooms;
  for (const k of ['quality', 'surprise', 'sky']) delete old.rng[k];
  const back = loadCareer(old);
  assert.ok(back.state.surprises);
  assert.deepEqual(back.state.career.heirlooms, []);
  assert.ok(Number.isInteger(back.state.rng.quality));
  // Abîmée : refusée.
  const bad = JSON.parse(JSON.stringify(g.serialize()));
  bad.career.heirlooms = [{ cropId: 'licorne', lotId: 'lot3' }];
  assert.throws(() => loadCareer(bad), /invalide/);
  const bad2 = JSON.parse(JSON.stringify(g.serialize()));
  bad2.surprises.wells = ['lot99'];
  assert.throws(() => loadCareer(bad2), /invalide/);
});
