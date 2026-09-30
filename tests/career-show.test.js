// Mode Carrière — comice agricole (CORE-C) : annonce au 1er jour d'été (rang ≥ 2), 3 épreuves possibles et
// distinctes, progression depuis l'annonce, jugement le soir du dernier jour d'automne (avant les charges),
// prix 100 × rang par épreuve + autant pour les trois, × 2 au Domaine ; comices réussis (rang 6, succès).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCareer, loadCareer } from '../src/core/career/career.js';
import { CONTEST_GOAL_POOL } from '../src/data/career/events.js';
import { contestPrizePerGoal, eggsCountable } from '../src/core/career/events.js';
import { checkAchievements } from '../src/core/progression.js';
import { defaultProgress } from '../src/core/progression.js';
import { goTo, newCareer, nextDay, record, setRank, skipYear } from './career-helpers.js';

const L = 7;
const dayOf = (seasonIndex, d) => seasonIndex * L + d;

/** Remplace les épreuves du comice par des épreuves contrôlées (stock, récoltes). */
function setGoals(g, goals) {
  const k = g.state.career.contest;
  k.goals = goals.map((x) => ({ notified: false, base: 0, ...x }));
}

test('pas de comice au rang 1', () => {
  const g = newCareer();
  const ev = record(g);
  goTo(g, 1, dayOf(1, 1));
  assert.equal(g.state.career.contest, null);
  assert.equal(ev.of('contestAnnounced').length, 0);
  assert.equal(g.query.career.events().contest, null);
});

test('annonce au 1er jour d\'été : 3 épreuves distinctes et possibles, cibles selon le rang', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const g = createCareer({ seed });
    setRank(g, 2);
    const ev = record(g);
    goTo(g, 1, dayOf(1, 1));
    const a = ev.of('contestAnnounced')[0];
    assert.ok(a, 'annoncé');
    assert.equal(a.goals.length, 3);
    assert.equal(new Set(a.goals.map((x) => x.id)).size, 3, 'jamais deux fois la même');
    assert.equal(a.prizePerGoal, 200);
    for (const goal of a.goals) {
      const def = CONTEST_GOAL_POOL.find((x) => x.id === goal.id);
      assert.equal(goal.target, def.target.base + def.target.perRank * 2);
      // Une petite ferme sans grenier, cochons ni atelier : les épreuves toujours possibles (et les œufs
      // ramassés quand le ramassage des abris existe : lot CORE-B).
      assert.ok(['harvests', 'tomatoes', 'potatoes', ...(eggsCountable() ? ['eggs'] : [])].includes(goal.id), goal.id);
      assert.equal(goal.progress, 0);
    }
  }
});

test('progression comptée depuis l\'annonce ; jugement avant les charges ; 3 épreuves → prix + bonus, comice réussi', () => {
  const g = newCareer();
  setRank(g, 2);
  g.state.money = 10000;
  assert.ok(g.actions.career.upgradeBuilding('storage').ok);
  goTo(g, 1, dayOf(1, 1));
  const harvestsBase = g.state.career.lifetime.harvests;
  setGoals(g, [
    { id: 'stock', type: 'stock', label: '5 unités', target: 5 },
    { id: 'harvests', type: 'harvests', label: '2 récoltes', target: 2, base: harvestsBase },
    { id: 'potatoes', type: 'harvest', cropIds: ['potato'], label: '1 pomme de terre', target: 1, base: 0 },
  ]);
  // Récoltes pendant l'été.
  for (const i of [0, 1]) {
    const p = g.state.plots[i];
    p.cropId = 'potato';
    p.growth = 4;
  }
  const ev = record(g);
  assert.ok(g.actions.harvest(0).ok);
  assert.ok(g.actions.harvest(1).ok);
  const info = g.query.career.events().contest;
  assert.equal(info.goals.find((x) => x.id === 'harvests').progress, 2);
  assert.equal(info.goals.find((x) => x.id === 'potatoes').done, true);
  assert.equal(info.goals.find((x) => x.id === 'stock').done, false);
  assert.equal(info.maxPrize, 800);
  goTo(g, 1, dayOf(2, L));
  assert.equal(g.query.career.contest().daysLeft, 0);
  g.state.career.stock = { wheat: 5 };
  const money = g.state.money;
  ev.clear();
  nextDay(g);
  const types = ev.events.map((e) => e.type);
  const award = ev.of('contestAwarded')[0];
  assert.ok(award);
  assert.ok(types.indexOf('contestAwarded') < types.indexOf('billPaid'), 'jugé avant les charges');
  assert.equal(award.amount, 200 * 3 + 200);
  assert.equal(award.all, true);
  assert.equal(g.state.career.lifetime.contestsWon, 1);
  assert.equal(g.state.career.yearStats.incomeBy.contest, 800);
  assert.ok(g.state.money > money + 700);
  assert.equal(g.query.career.achievementContext().contestAll, true);
  const unlocked = checkAchievements(defaultProgress(), { career: g.query.career.achievementContext() });
  assert.ok(unlocked.includes('fairChampion'));
  // Déjà jugé : rien de plus, et l'objectif « comice » du rang 6 est rempli.
  assert.equal(g.state.career.contest.judged, true);
  g.state.career.rank = 5;
  g.refreshLevel();
  assert.equal(g.query.career.summary().nextRank.objectives.find((o) => o.id === 'contestAll').done, true);
});

test('épreuves en partie réussies : prix par épreuve, pas de comice réussi', () => {
  const g = newCareer();
  setRank(g, 3);
  goTo(g, 1, dayOf(1, 1));
  assert.equal(g.state.career.contest.prizePerGoal, 300);
  setGoals(g, [
    { id: 'harvests', type: 'harvests', label: '0 récolte', target: 0, base: g.state.career.lifetime.harvests },
    { id: 'tomatoes', type: 'harvest', cropIds: ['tomato'], label: '99 tomates', target: 99 },
    { id: 'potatoes', type: 'harvest', cropIds: ['potato'], label: '99 pommes de terre', target: 99 },
  ]);
  const ev = record(g);
  goTo(g, 1, dayOf(3, 1));
  const award = ev.of('contestAwarded')[0];
  assert.equal(award.amount, 300);
  assert.equal(award.all, false);
  assert.deepEqual(award.goalsMet, ['harvests']);
  assert.equal(g.state.career.lifetime.contestsWon, 0);
  assert.deepEqual(g.query.career.events().contest.result.goalsMet, ['harvests']);
});

test('comice régional au Domaine : prix doublés', () => {
  assert.equal(contestPrizePerGoal(2), 200);
  assert.equal(contestPrizePerGoal(5), 500);
  assert.equal(contestPrizePerGoal(6), 1200);
});

test('épreuves de la ferme : grenier, cochons, fromagerie, verger… tirées seulement si possibles', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const g = createCareer({ seed });
    setRank(g, 3);
    g.state.money = 100000;
    assert.ok(g.actions.career.upgradeBuilding('storage').ok);
    g.actions.career.upgradeBuilding('storage');
    g.state.career.buildings.storage.level = 2; // silo : 100 unités
    assert.ok(g.actions.career.buyLot().ok);
    assert.ok(g.actions.career.developLot('lot3', 'workshops').ok);
    assert.ok(g.actions.career.build('lot3', 0, 'jamWorkshop').ok);
    goTo(g, 1, dayOf(1, 1));
    for (const goal of g.state.career.contest.goals) seen.add(goal.id);
    assert.ok(!g.state.career.contest.goals.some((x) => ['truffles', 'cheeses', 'fruits'].includes(x.id)));
  }
  assert.ok(seen.has('stock'));
  assert.ok(seen.has('products'));
  assert.ok(seen.has('pumpkins'));
});

test('nouveau comice chaque été ; sauvegarde et reprise en cours de comice', () => {
  const g = newCareer();
  setRank(g, 2);
  goTo(g, 1, dayOf(1, 3));
  const saved = g.serialize();
  const g2 = loadCareer(saved);
  assert.deepEqual(g2.query.career.contest(), g.query.career.contest());
  const e1 = record(g);
  const e2 = record(g2);
  goTo(g, 1, dayOf(3, 1));
  goTo(g2, 1, dayOf(3, 1));
  assert.deepEqual(e1.of('contestAwarded'), e2.of('contestAwarded'));
  skipYear(g); // année 2, 1er jour d'hiver : le comice de l'année 2 a été annoncé puis jugé
  assert.equal(g.state.career.contest.year, 2);
  assert.equal(g.state.career.contest.judged, true);
  goTo(g, 3, dayOf(1, 1));
  assert.equal(g.state.career.contest.year, 3);
  assert.equal(g.state.career.contest.judged, false);
});
