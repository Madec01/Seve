// Progression vue par l'interface (src/ui/progress.js) : chemin de fin de partie, succès vérifiés
// pendant / après une partie, succès des anciennes parties au démarrage. Sans DOM : l'interface est
// simulée (messages et sons ignorés), la logique vient de src/core/progression.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
const { createProgress } = await import('../src/ui/progress.js');
const { loadV3 } = await import('../src/ui/v3.js');
const { createGame } = await import('../src/core/game.js');
const { DAY_SECONDS } = await import('../src/data/balance.js');
const P = await import('../src/core/progression.js');
const { DECOR_SLOTS } = await import('../src/data/cosmetics.js');
await loadV3();

/** Stockage en mémoire avec la même interface que src/storage.js (ce qu'utilise progress.js). */
function memoryStorage(initial = null, migration = null) {
  let saved = initial;
  let pending = migration;
  return {
    loadProgress: () => P.normalizeProgress(saved),
    saveProgress: (p) => {
      saved = JSON.parse(JSON.stringify(p));
      return true;
    },
    progressMigration: () => {
      const m = pending;
      pending = null;
      return m;
    },
    saved: () => saved,
  };
}

/** Les messages de succès (différés, avec icônes DOM) ne sont pas affichés sous Node. */
function quiet(fn) {
  const real = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  try {
    return fn();
  } finally {
    globalThis.setTimeout = real;
  }
}

function fakeApp() {
  const toasts = [];
  return { toasts: { show: (t) => (toasts.push(t), null) }, audio: { play() {} }, shown: toasts };
}

/** Joue le niveau 1 jusqu'au bout avec un robot simple (carottes, arrosage, récolte). */
function playLevel1(seed = 3) {
  const g = createGame({ levelId: 1, seed });
  let end = null;
  g.on('victory', (e) => (end = e));
  g.on('bankrupt', (e) => (end = e));
  for (let d = 0; d < 80 && g.state.status === 'playing'; d++) {
    for (let i = 0; i < g.state.plots.length; i++) {
      const p = g.query.plot(i);
      if (p.action === 'harvest') g.actions.harvest(i);
    }
    for (let i = 0; i < g.state.plots.length; i++) {
      const p = g.query.plot(i);
      if (p.action !== 'plant') continue;
      const opt = g.query.plantableCrops(i).filter((o) => o.canAfford && !o.willFreeze && o.kind !== 'tree');
      if (opt.length && g.state.money > 20) g.actions.plant(i, opt.sort((a, b) => a.seedCost - b.seedCost)[0].id);
    }
    for (let i = 0; i < g.state.plots.length; i++) if (g.query.plot(i).action === 'water') g.actions.water(i);
    g.update(DAY_SECONDS);
  }
  return { g, end };
}

test('fin de partie : le contexte d’une partie terminée n’est jamais recompté (cumuls)', () => {
  const { g, end } = playLevel1();
  assert.equal(g.state.status, 'victory');
  const harvested = Object.values(g.query.achievementContext().stats.year.cropsHarvested).reduce((a, b) => a + b, 0);
  assert.ok(harvested > 20, `récoltes de la partie : ${harvested}`);
  assert.ok(harvested < 250);
  // Cumul de départ choisi pour que la partie comptée UNE fois reste sous 500 récoltes, mais que la
  // compter deux fois dépasse 500 (succès « Grenier plein » débloqué à tort).
  const start = P.normalizeProgress(null);
  start.lifetime.harvests = 500 - harvested - 1;
  start.lifetime.cropsHarvested = { turnip: 500 - harvested - 1 };
  const storage = memoryStorage(start);
  const prog = createProgress(fakeApp(), storage);
  prog.recordRunEnd({ levelId: 1, outcome: 'victory', stars: end.stars, money: end.money, summary: end.summary, perksActive: false });
  const after = prog.get();
  assert.equal(after.lifetime.harvests, 499);
  assert.ok(!after.achievements.harvest500);
  // Après la fin : aube / fermeture du mode décoration / file d’attente avec la partie terminée.
  assert.deepEqual(quiet(() => prog.checkGame(g)), []);
  assert.ok(!prog.get().achievements.harvest500, 'succès « Grenier plein » débloqué par un double comptage');
  assert.equal(prog.get().lifetime.harvests, 499);
});

test('succès vérifiés pendant la partie : le contexte de la partie en cours compte', () => {
  const start = P.normalizeProgress(null);
  const storage = memoryStorage(start);
  const app = fakeApp();
  const prog = createProgress(app, storage);
  const g = createGame({ levelId: 1, seed: 5 });
  const i = g.state.plots.findIndex((p) => p.unlocked);
  g.actions.plant(i, 'carrot');
  for (let d = 0; d < 8 && g.query.plot(i).action !== 'harvest'; d++) {
    if (g.query.plot(i).action === 'water') g.actions.water(i);
    g.update(DAY_SECONDS);
  }
  assert.equal(g.actions.harvest(i).ok, true);
  const ids = quiet(() => prog.checkGame(g));
  assert.ok(ids.includes('firstHarvest'));
  assert.ok(prog.get().achievements.firstHarvest);
  assert.deepEqual(storage.saved().achievements.firstHarvest, prog.get().achievements.firstHarvest);
});

test('sans partie (mode décoration depuis le menu) : les succès de la progression seule sont vérifiés', () => {
  const storage = memoryStorage(P.normalizeProgress(null));
  const prog = createProgress(fakeApp(), storage);
  // « Jolie ferme » : 10 décorations posées en même temps (ne dépend d'aucune partie).
  prog.commit({ ...prog.get(), ecus: 5000 });
  const small = prog.cosmeticsList('small').filter((c) => !c.isDefault);
  const slots = DECOR_SLOTS.filter((s) => s.kind === 'small').map((s) => s.id);
  assert.ok(slots.length >= 10);
  slots.forEach((slot, k) => {
    const item = small[k % small.length];
    if (!prog.owns(item.id)) assert.equal(prog.buyCosmetic(item.id).ok, true);
    assert.equal(prog.placeDecor(slot, item.id).ok, true);
  });
  assert.deepEqual(quiet(() => prog.checkGame(null)), ['prettyFarm']);
  assert.ok(prog.get().achievements.prettyFarm);
});

test('démarrage : les succès des anciennes parties (migration v1) sont annoncés une fois', () => {
  const levels = {};
  for (let id = 1; id <= 8; id++) levels[id] = { stars: 3, bestMoney: 600, completed: true };
  const mig = P.migrateProgress({ levels });
  assert.ok(mig.retroactive.length > 0);
  const storage = memoryStorage(mig.progress, { retroactive: mig.retroactive, rewards: mig.rewards });
  const prog = createProgress(fakeApp(), storage);
  const ids = prog.checkBoot();
  for (const id of mig.retroactive) assert.ok(ids.includes(id), `${id} manquant dans ${ids}`);
  assert.deepEqual(prog.checkBoot(), [], 'annoncés une seule fois');
});
