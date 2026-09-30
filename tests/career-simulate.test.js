// Mode Carrière — simulateur (CORE-C, tools/simulate-career.js) : déterministe, par l'API publique seulement ;
// un joueur tranquille atteint le rang 2 et ne fait pas faillite ; un joueur absent ne perd jamais sa ferme
// en Détente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playCareer, loadStaffHelper, paceSummary, STRATEGIES } from '../tools/simulate-career.js';

test('simulateur : déterministe (même graine, même stratégie → même carrière)', async () => {
  const helper = await loadStaffHelper();
  const a = playCareer({ seed: 5, strategy: 'casual', years: 2, helper: helper || null });
  const b = playCareer({ seed: 5, strategy: 'casual', years: 2, helper: helper || null });
  assert.deepEqual(a.years, b.years);
  assert.equal(a.years.length, 2);
  assert.ok(a.years[1].rank >= 2, 'rang 2 au plus tard à la fin de l\'année 2');
  assert.equal(a.bankrupt, false);
});

test('simulateur : toutes les stratégies jouent une année sans erreur ; « idle » ne fait jamais faillite en Détente', async () => {
  const helper = await loadStaffHelper();
  for (const strategy of STRATEGIES) {
    const r = playCareer({ seed: 2, strategy, years: strategy === 'idle' ? 3 : 1, helper: helper || null });
    assert.equal(r.bankrupt, false, strategy);
    assert.ok(r.years.length >= 1, strategy);
  }
});

test('simulateur : rythme tranquille (au plus une quête et une commande ouvertes ; quêtes acceptées presque toujours réussies)', async () => {
  const helper = await loadStaffHelper();
  const careers = [1, 2, 3].map((seed) => playCareer({ seed, strategy: 'casual', years: 3, helper: helper || null }));
  const pace = paceSummary(careers);
  assert.ok(pace.maxOpen <= 2, `ouvertes : ${pace.maxOpen}`);
  assert.ok(pace.asksPerWeek <= 1.6, `sollicitations par semaine : ${pace.asksPerWeek}`);
  assert.ok(pace.questsOfferedPerYear <= 2, `quêtes proposées par an : ${pace.questsOfferedPerYear}`);
  if (pace.questsAccepted >= 3) assert.ok(pace.questSuccess >= 75, `réussite : ${pace.questSuccess} %`);
});
