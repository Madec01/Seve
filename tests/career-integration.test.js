// Mode Carrière — corrections de l'intégration (2026-09-30) : écus des quêtes de Joseph, durée des saisons
// (seuils de patrimoine et objectifs comptés), listes d'animaux en cache, objectif « produits transformés ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/core/progression.js';
import { patrimonyScale, objectiveTargetFor, PATRIMONY_SCALE } from '../src/data/career/career.js';
import { RANKS } from '../src/data/career/ranks.js';
import { rankThreshold, objectiveTarget, objectiveLabel } from '../src/core/career/ranks.js';
import { careerAnimals, getCareerAnimal, registerCareerExtension } from '../src/core/career/registry.js';
import { careerInvestments, getCareerInvestment } from '../src/core/career/effects.js';
import { newCareer, nextDay } from './career-helpers.js';

test('écus d\'une quête de Joseph : versés tout de suite (recordCareerEcus), pas deux fois au bilan', () => {
  let p = P.normalizeProgress(null);
  const before = p.ecus;
  const res = P.recordCareerEcus(p, 3);
  assert.equal(res.rewards.ecus, 3);
  assert.equal(res.progress.ecus, before + 3);
  assert.equal(p.ecus, before, 'progression d\'origine intacte');
  p = res.progress;
  // Valeurs absurdes : rien, ou borné.
  assert.equal(P.recordCareerEcus(p, -5).progress.ecus, p.ecus);
  assert.equal(P.recordCareerEcus(p, 'x').progress.ecus, p.ecus);
  assert.equal(P.recordCareerEcus(p, 1e9).rewards.ecus, 1000);
  // Le bilan de l'année ne reverse pas les écus des quêtes (report.questEcus n'est qu'un rappel).
  const y = P.recordCareerYear(p, { year: 1, rank: 2, net: 0, report: { questEcus: 6, cropsHarvested: {}, productsSold: {} } });
  assert.equal(y.rewards.ecus, P.ecusForCareerYear({ rank: 2, net: 0 }));
  assert.equal(y.progress.ecus, p.ecus + y.rewards.ecus + (y.rewards.achievementEcus || 0));
});

test('durée des saisons : seuils de patrimoine × 1 / × 2 / × 3,5 (arrondis à la centaine)', () => {
  assert.deepEqual(PATRIMONY_SCALE, { 7: 1, 10: 2, 14: 3.5 });
  assert.equal(patrimonyScale(7), 1);
  for (const L of [7, 10, 14]) {
    const g = newCareer({ seasonLength: L });
    for (const r of RANKS.slice(1)) {
      const expected = L === 7 ? r.patrimony : Math.round((r.patrimony * PATRIMONY_SCALE[L]) / 100) * 100;
      assert.equal(rankThreshold(g.state, r.rank), expected, `rang ${r.rank}, ${L} j`);
    }
  }
  // Saisons de 7 jours : exactement les seuils des données (aucun arrondi).
  const g7 = newCareer();
  assert.deepEqual(RANKS.slice(1).map((r) => rankThreshold(g7.state, r.rank)), [1200, 4000, 12000, 30000, 100000]);
});

test('durée des saisons : objectifs comptés au fil des jours × durée / 7 (arrondi à 5), les autres inchangés', () => {
  const harvests = RANKS[1].objectives.find((o) => o.id === 'harvests');
  const products = RANKS[2].objectives.find((o) => o.id === 'products');
  const quests = RANKS[3].objectives.find((o) => o.id === 'quests3');
  const plots = RANKS[3].objectives.find((o) => o.id === 'plots48');
  assert.deepEqual([7, 10, 14].map((L) => objectiveTargetFor(harvests, L)), [60, 85, 120]);
  assert.deepEqual([7, 10, 14].map((L) => objectiveTargetFor(products, L)), [15, 20, 30]);
  assert.deepEqual([7, 10, 14].map((L) => objectiveTargetFor(quests, L)), [3, 3, 3], 'une quête par saison, quelle que soit la durée');
  assert.deepEqual([7, 10, 14].map((L) => objectiveTargetFor(plots, L)), [48, 48, 48]);
  const g = newCareer({ seasonLength: 14 });
  assert.equal(objectiveTarget(g.state, harvests), 120);
  assert.equal(objectiveLabel(g.state, harvests), 'Faire 120 récoltes');
  assert.equal(objectiveLabel(newCareer().state, products), 'Vendre 15 produits transformés');
  // L'objectif se remplit à la cible de la carrière, pas à celle des données.
  g.state.career.lifetime.harvests = 60;
  nextDay(g);
  assert.equal(g.state.career.objectives.harvests, undefined);
  g.state.career.lifetime.harvests = 120;
  nextDay(g);
  assert.equal(g.state.career.objectives.harvests, true);
  const o = g.query.career.summary().nextRank.objectives.find((x) => x.id === 'harvests');
  assert.deepEqual([o.done, o.progress, o.target, o.label], [true, 120, 120, 'Faire 120 récoltes']);
});

test('listes d\'animaux et d\'investissements : en cache, recalculées quand les extensions changent', () => {
  const a = careerAnimals();
  assert.equal(careerAnimals(), a, 'même tableau d\'un appel à l\'autre');
  assert.ok(Object.isFrozen(a));
  const inv = careerInvestments();
  assert.equal(careerInvestments(), inv);
  assert.equal(getCareerInvestment('hen'), inv.find((i) => i.id === 'hen'));
  assert.equal(getCareerInvestment('nope'), null);
  const llama = { id: 'llama', name: 'Lama', category: 'animal', costs: [99], effects: {} };
  const remove = registerCareerExtension({ id: 'test-llama', investments: [llama] });
  try {
    assert.notEqual(careerAnimals(), a, 'nouvelle extension : liste recalculée');
    assert.equal(getCareerAnimal('llama'), llama);
    assert.equal(getCareerInvestment('llama'), llama);
  } finally {
    remove();
  }
  assert.equal(getCareerAnimal('llama'), null, 'extension retirée : liste recalculée');
  assert.equal(getCareerInvestment('llama'), null);
});
