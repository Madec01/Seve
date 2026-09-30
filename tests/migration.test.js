// Migration v1 → v2 de la partie en cours (sauvegardes réelles produites par le code v2) et
// aller-retour serialize → loadGame avec les nouveaux champs (arbres, ateliers, concours, bonus).
// Migration de la progression : voir tests/progression.test.js et tests/storage.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, loadGame, migrateState, STATE_VERSION } from '../src/core/game.js';
import { BOTS, lcg, projectState } from '../tools/capture-parity.js';
import { createHash } from 'node:crypto';
import { LEVELS } from '../src/data/levels.js';
import { PERKS } from '../src/data/perks.js';

// Sauvegardes v1 produites par le code v2 (commit c938af8), en pleine journée, et fin de leur partie en v2.
const V1 = JSON.parse(readFileSync(new URL('./fixtures/v1-saves.json', import.meta.url), 'utf8'));
const hash = (t) => createHash('sha256').update(t).digest('hex').slice(0, 16);

test('STATE_VERSION vaut 2', () => {
  assert.equal(STATE_VERSION, 2);
  assert.equal(createGame({ levelId: 1, seed: 1 , difficulty: 'classique' }).state.version, 2);
});

test('migrateState : v1 → v2 (champs vides), sans toucher à l’objet reçu', () => {
  const save = V1[0].saved;
  assert.equal(save.version, 1);
  const before = JSON.stringify(save);
  const m = migrateState(save);
  assert.equal(JSON.stringify(save), before);
  assert.equal(m.version, 2);
  assert.deepEqual(m.perks, {});
  assert.deepEqual(m.processing, {});
  assert.equal(m.contest, null);
  assert.ok(m.plots.every((p) => p.fruit === 0));
  for (const k of ['year', 'season']) {
    const st = m.stats[k];
    assert.equal(st.productIncome, 0);
    assert.deepEqual(st.productsSold, {});
    assert.equal(st.rawSales, 0);
    assert.equal(st.frostRefund, 0);
    assert.equal(st.contestPrize, 0);
    assert.equal(st.minMoneyAfterRent, null);
  }
  assert.equal(m.stats.year.bestSeasonHarvestIncome, save.stats.season.harvestIncome);
  // Une v2 est copiée telle quelle.
  const v2 = createGame({ levelId: 3, seed: 1 , difficulty: 'classique' }).serialize();
  assert.deepEqual(migrateState(v2), v2);
});

test('sauvegardes v1 réelles : chargées, puis la partie finit exactement comme en v2', () => {
  for (const c of V1) {
    const key = `${c.levelId}/${c.bot}/${c.seed}`;
    const g = loadGame(c.saved);
    assert.equal(g.state.version, 2, key);
    // Rejoue le début avec le code v3 (sans bonus) : même état qu'à la sauvegarde v1, et le tirage
    // du robot retrouve sa position.
    const fresh = createGame({ levelId: c.levelId, seed: c.seed , difficulty: 'classique' });
    const rnd = lcg(c.seed + c.levelId * 1000);
    while (fresh.state.status === 'playing' && fresh.state.time.day < c.stopDay) {
      BOTS[c.bot](fresh, rnd);
      fresh.update(20);
    }
    BOTS[c.bot](fresh, rnd); // comme à la capture, même si la partie est déjà finie
    fresh.update(7.3);
    assert.deepEqual(projectState(g.state), projectState(fresh.state), `${key} : état chargé`);
    // État complet identique à une partie v3 sans bonus, sauf deux repères que la v1 ne gardait pas
    // (argent le plus bas après un fermage, meilleure saison de l'année) : repris au mieux.
    const strip = (s) => {
      const c = JSON.parse(JSON.stringify(s));
      for (const k of ['year', 'season']) {
        delete c.stats[k].minMoneyAfterRent;
        delete c.stats[k].bestSeasonHarvestIncome;
      }
      return c;
    };
    assert.deepEqual(strip(g.state), strip(fresh.state), `${key} : état v2 complet`);
    assert.equal(g.state.stats.year.minMoneyAfterRent, null);
    for (let d = 0; d < 80 && g.state.status === 'playing'; d++) {
      BOTS[c.bot](g, rnd);
      g.update(20);
    }
    assert.equal(g.state.status, c.status, key);
    assert.equal(g.state.money, c.money, key);
    assert.equal(hash(JSON.stringify(projectState(g.state))), c.final, key);
  }
});

test('versions inconnues refusées ; v1 abîmée refusée', () => {
  const save = V1[0].saved;
  assert.throws(() => loadGame({ ...save, version: 3 }), /incompatible/);
  assert.throws(() => loadGame({ ...save, version: 0 }), /incompatible/);
  assert.throws(() => loadGame({ ...save, version: undefined }), /incompatible/);
  assert.throws(() => loadGame({ ...save, money: 'beaucoup' }), /Sauvegarde invalide/);
  assert.throws(() => loadGame({ ...save, plots: null }), /Sauvegarde invalide/);
  assert.throws(() => loadGame({ ...save, levelId: 9, version: 1 }), /Sauvegarde invalide/);
});

test('v2 : champs abîmés refusés (fruits, bonus, statistiques v3)', () => {
  const g = createGame({ levelId: 10, seed: 4 , difficulty: 'classique' });
  g.update(45);
  const good = g.serialize();
  const broken = (patch) => {
    const s = JSON.parse(JSON.stringify(good));
    patch(s);
    return s;
  };
  const cases = {
    'fruits négatifs': (s) => (s.plots[0].fruit = -1),
    'fruits absents': (s) => delete s.plots[0].fruit,
    'fruits sans arbre': (s) => (s.plots[5].fruit = 2),
    'bonus absents': (s) => delete s.perks,
    'statistique v3 absente': (s) => delete s.stats.year.productIncome,
    'produits vendus invalides': (s) => (s.stats.season.productsSold = null),
    'argent après fermage invalide': (s) => (s.stats.year.minMoneyAfterRent = 'peu'),
  };
  for (const [name, patch] of Object.entries(cases)) assert.throws(() => loadGame(broken(patch)), /Sauvegarde invalide/, name);
  assert.deepEqual(loadGame(good).state, g.state);
});

test('aller-retour serialize → loadGame, niveaux 1 à 12, avec et sans bonus, à tout moment', () => {
  const all = Object.fromEntries(PERKS.map((p) => [p.id, p.costs.length]));
  let checked = 0;
  for (const level of LEVELS) {
    for (const perks of [{}, all]) {
      const g = createGame({ levelId: level.id, seed: level.id * 13, perks , difficulty: 'classique' });
      let r = level.id * 7919;
      const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let step = 0; step < 120 && g.state.status === 'playing'; step++) {
        for (const p of g.query.plots()) {
          if (p.action === 'harvest') g.actions.harvest(p.index);
          else if (p.action === 'plant' && rnd() < 0.8) {
            const crops = g.query.plantableCrops(p.index);
            if (crops.length) g.actions.plant(p.index, crops[Math.floor(rnd() * crops.length)].id);
          } else if (p.action === 'water' && rnd() < 0.7) g.actions.water(p.index);
          else if (p.action === 'unlock' && rnd() < 0.05) g.actions.unlockPlot(p.index);
          else if (p.kind === 'tree' && rnd() < 0.01) g.actions.removeTree(p.index);
        }
        const buyable = g.query.investments().filter((i) => i.canBuy);
        if (buyable.length && rnd() < 0.4) g.actions.buyInvestment(buyable[Math.floor(rnd() * buyable.length)].id);
        const proc = g.query.processing();
        if (proc.length && rnd() < 0.05) g.actions.setProcessing(proc[0].buildingId, !proc[0].on);
        if (proc.length && rnd() < 0.03) g.actions.sellProcessing(proc[proc.length - 1].buildingId);
        g.state.money += 45;
        g.update(20 * (0.3 + rnd() * 0.5));
        const h = loadGame(JSON.parse(JSON.stringify(g.serialize())));
        assert.deepEqual(h.state, g.state);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000);
});

test('une partie rechargée continue à l’identique (niveaux 9 à 12, événements compris)', () => {
  for (const levelId of [9, 10, 11, 12]) {
    const play = (g) => {
      for (const p of g.query.plots()) {
        if (p.action === 'harvest') g.actions.harvest(p.index);
        else if (p.action === 'plant') {
          const c = g.query.plantableCrops(p.index).filter((x) => x.canAfford && !x.willFreeze);
          if (c.length) g.actions.plant(p.index, c[p.index % c.length].id);
        } else if (p.action === 'water') g.actions.water(p.index);
      }
      for (const inv of g.query.investments()) if (inv.canBuy && g.state.money > inv.nextCost + 150) g.actions.buyInvestment(inv.id);
      g.state.money += 60;
    };
    const a = createGame({ levelId, seed: 77 , difficulty: 'classique' });
    for (let d = 0; d < 12; d++) {
      play(a);
      a.update(20);
    }
    a.update(9);
    const b = loadGame(a.serialize());
    const logA = [];
    const logB = [];
    a.on('*', (e) => logA.push(JSON.stringify(e)));
    b.on('*', (e) => logB.push(JSON.stringify(e)));
    for (let d = 0; d < 40 && a.state.status === 'playing'; d++) {
      play(a);
      play(b);
      a.update(20);
      b.update(20);
    }
    assert.deepEqual(b.state, a.state, `niveau ${levelId}`);
    assert.deepEqual(logB, logA);
    assert.notEqual(a.state.status, 'playing');
  }
});
