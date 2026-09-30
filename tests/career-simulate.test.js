// Mode Carrière — simulateur (CORE-C, tools/simulate-career.js) : déterministe, par l'API publique seulement ;
// un joueur tranquille atteint le rang 2 et ne fait pas faillite ; un joueur absent ne perd jamais sa ferme
// en Détente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playCareer, loadStaffHelper, STRATEGIES } from '../tools/simulate-career.js';

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
