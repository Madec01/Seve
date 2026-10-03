// Lot 4 — carrière : fêtes du calendrier (foire aux graines, chasse, soupe, stand, paniers dès le rang 1), fêtes des
// années à thème, hiver vivant, lanternes du bilan annuel, serre et mare plus tôt, pêche (album).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careerFactor, FETE_REWARDS, SEED_FAIR } from '../src/data/cozy.js';
import { getCrop } from '../src/data/crops.js';
import { LOT_TYPES } from '../src/data/career/lots.js';
import { newCareer, nextDay, record, setRank, goTo, skipYear, withExtension } from './career-helpers.js';

const L = 7;
const dayOf = (si, d) => si * L + d;

function cozyCareer(opts = {}) {
  return newCareer({ cozy: true, ...opts });
}

test('calendrier : chasse (printemps j. 3), soupe, stand, paniers (dès le rang 1), foire aux graines (dernier jour d\'hiver)', () => {
  const g = cozyCareer();
  g.state.money = 100000;
  const ev = record(g);
  skipYear(g);
  assert.deepEqual(ev.of('feteStarted').map((e) => e.fete.id), ['springFete', 'villageFete', 'harvestFestival', 'christmasMarket', 'seedFair']);
  assert.deepEqual(ev.of('feteStarted').map((e) => e.fete.engine), ['chasse', 'marmite', 'etal', 'paniers', 'foire']);
  assert.equal(ev.of('feteEnded').length, 5);
  // Ordre du dernier soir d'hiver : feteEnded (foire) avant le bilan (lanternsLit, yearEnd).
  const types = ev.events.map((e) => e.type);
  assert.ok(types.lastIndexOf('feteEnded') < types.indexOf('lanternsLit'));
  assert.equal(types.indexOf('yearEnd'), types.indexOf('lanternsLit') + 1);
});

test('récompenses de carrière : pièces × (1 + 0,5 × (rang − 1)) ; poste « fetes » du bilan', () => {
  assert.equal(careerFactor(1), 1);
  assert.equal(careerFactor(6), 3.5);
  const g = cozyCareer();
  setRank(g, 3);
  goTo(g, 1, 3);
  const f = g.query.fete();
  assert.equal(f.engine, 'chasse');
  const egg = f.hidden.items.find((h) => !h.gold);
  const r = g.actions.feteFind(egg.index);
  assert.equal(r.amount, Math.round(FETE_REWARDS.chasse.found * careerFactor(3)));
  assert.equal(g.state.career.yearStats.incomeBy.fetes, r.amount);
});

test('foire aux graines : sachets à −25 % (8 semis), réserve prise d\'abord par tout semis (joueur, jardinier, semoir) ; plafonds', () => {
  const g = cozyCareer();
  g.state.money = 100000;
  goTo(g, 1, dayOf(3, L));
  const f = g.query.fete();
  assert.equal(f.engine, 'foire');
  const local = f.stalls.find((s) => s.id === 'local');
  const carrot = local.packs.find((p) => p.cropId === 'carrot');
  assert.equal(carrot.seeds, SEED_FAIR.pack);
  assert.equal(carrot.price, Math.round(getCrop('carrot').seedCost * SEED_FAIR.pack * (1 - SEED_FAIR.discount)));
  assert.ok(local.packs.every((p) => getCrop(p.cropId).seasons.includes('spring')));
  const money = g.state.money;
  const r = g.actions.buySeedPack('carrot');
  assert.deepEqual([r.ok, r.seeds, r.bank], [true, 8, 8]);
  assert.equal(g.state.money, money - carrot.price);
  for (let k = 0; k < 3; k++) assert.ok(g.actions.buySeedPack('carrot').ok);
  assert.equal(g.actions.buySeedPack('carrot').reason, '4 sachets au plus par culture.');
  assert.equal(g.actions.buySeedPack('pumpkin').reason, 'Ce sachet n\'est pas proposé.');
  assert.equal(g.query.cozy().seedBank[0].n, 32);
  // Printemps : le semis prend la réserve, sans payer.
  nextDay(g);
  assert.equal(g.query.plantableCrops(0).find((o) => o.id === 'carrot').bank, 32);
  const m2 = g.state.money;
  const ev = record(g);
  const p = g.actions.plant(0, 'carrot');
  assert.equal(p.ok, true);
  assert.equal(g.state.money, m2);
  assert.equal(ev.of('planted')[0].fromBank, true);
  assert.equal(ev.of('planted')[0].bankLeft, 31);
  // Un salarié (point d'accroche) sème aussi depuis la réserve.
  const ext = withExtension();
  try {
    const h = cozyCareer();
    h.state.cozy.seedBank = { turnip: 2 };
    const m3 = h.state.money;
    assert.ok(ext.api().plant(1, 'turnip', { by: 'staff' }).ok);
    assert.equal(h.state.money, m3);
    assert.equal(h.state.cozy.seedBank.turnip, 1);
  } finally {
    ext.off();
  }
});

test('fêtes des années à thème : mini-jeu du moteur (bal des grenouilles : chasse aux grenouilles)', () => {
  const g = newCareer({ cozy: true, variety: true });
  g.state.money = 100000;
  assert.ok(g.actions.triggerVariety('theme', 'frogs').ok);
  goTo(g, 1, 7);
  const f = g.query.fete();
  assert.equal(f.id, 'theme.frogs');
  assert.equal(f.engine, 'chasse');
  assert.equal(f.hidden.kind, 'frog');
  g.actions.feteFind(f.hidden.items[0].index);
  assert.equal(g.state.cozy.stats.themesPlayed.frogs, 1);
  // Débogage : n'importe quelle fête de thème.
  assert.ok(g.actions.triggerCozy('fete', 'theme.markets').ok);
  assert.equal(g.query.fete().max, 6, 'Grand marché : 6 cagettes');
});

test('hiver de carrière : trouvailles (× facteur du rang), seul le joueur ramasse ; tout s\'efface au printemps ; veillée au 3ᵉ jour', () => {
  const g = cozyCareer();
  g.state.money = 100000;
  goTo(g, 1, dayOf(3, 3));
  const w = g.query.winter();
  assert.equal(w.finds.length, 3);
  assert.equal(w.story.available, true);
  assert.ok(g.actions.fillFeeder().ok);
  goTo(g, 2, 1);
  const w2 = g.query.winter();
  assert.equal(w2.finds.length, 0);
  assert.equal(w2.feeder.here, false);
  assert.equal(w2.story.available, false);
});

test('bilan annuel : lanternsLit, report.cozy (lanternes, fêtes, hiver, à la main), historique, compteurs remis à zéro', () => {
  const g = cozyCareer();
  g.state.money = 100000;
  const ev = record(g);
  skipYear(g);
  const lit = ev.of('lanternsLit')[0];
  assert.equal(lit.year, 1);
  assert.equal(lit.values.length, 5);
  const rep = ev.of('yearEnd')[0].report;
  assert.ok(rep.cozy);
  assert.deepEqual(rep.cozy.lanterns.values, lit.values);
  assert.ok('handPicked' in rep.cozy && 'handBonus' in rep.cozy && rep.cozy.stats);
  assert.equal(g.state.cozy.lanterns.history.length, 1);
  assert.equal(g.state.cozy.year.harvests, 0);
  assert.equal(g.state.cozy.year.partial, false);
  assert.ok(g.state.cozy.year.patrimonyStart > 0);
  assert.equal(g.query.cozy().history.length, 1);
});

test('serre au rang 2 (500), mare au rang 3 (300) ; canards au rang 3 ; pêche notée pour l\'album (aussi l\'hiver)', () => {
  const byId = Object.fromEntries(LOT_TYPES.map((t) => [t.id, t]));
  assert.deepEqual([byId.greenhouse.rank, byId.greenhouse.cost, byId.greenhouse.phase], [2, 500, undefined]);
  assert.deepEqual([byId.pond.rank, byId.pond.cost, byId.pond.phase], [3, 300, undefined]);
  const g = cozyCareer();
  g.state.money = 100000;
  setRank(g, 3);
  const lot = g.actions.career.buyLot();
  assert.ok(g.actions.career.developLot(lot.lotId, 'pond').ok);
  assert.ok(g.actions.buyInvestment('duck').ok);
  goTo(g, 1, dayOf(3, 2));
  const r = g.actions.career.fish();
  assert.ok(r.ok, 'la pêche marche sous la glace');
  assert.equal(g.state.cozy.stats.fish[r.fishId], 1);
});
