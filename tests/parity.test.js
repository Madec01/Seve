// Parité v2 → v3 : sans bonus permanent, les niveaux 1 à 8 se jouent EXACTEMENT comme en v2
// (même graine → même météo, mêmes décisions, mêmes nombres, jour par jour).
// Référence : tests/fixtures/parity-v2.json, capturée par tools/capture-parity.js avant la v3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIXTURE, PARITY_CASES, PARITY_LEVELS, SIM_SEEDS, SIM_STRATEGIES, playParity, playSim } from '../tools/capture-parity.js';

const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));

test('parité : robots scriptés, niveaux 1 à 8, sans bonus (perks = {})', () => {
  assert.equal(Object.keys(fixture.cases).length, PARITY_CASES.length);
  for (const c of PARITY_CASES) {
    const key = `${c.levelId}/${c.bot}/${c.seed}`;
    const want = fixture.cases[key];
    const got = playParity({ ...c, perks: {} });
    const firstDiff = got.hashes.findIndex((h, i) => h !== want.hashes[i]);
    assert.equal(firstDiff, got.hashes.length === want.hashes.length ? -1 : firstDiff, `${key} : premier jour différent ${firstDiff + 1}`);
    assert.deepEqual(got, want, key);
  }
});

test('parité : createGame sans le champ perks équivaut à perks = {}', () => {
  for (const c of PARITY_CASES.filter((x) => x.seed === 42)) {
    assert.deepEqual(playParity(c), fixture.cases[`${c.levelId}/${c.bot}/${c.seed}`]);
  }
});

test('parité : robots de la simulation (tools/simulate.js), niveaux 1 à 8, sans bonus', async () => {
  for (const levelId of PARITY_LEVELS) {
    for (const strategy of SIM_STRATEGIES) {
      for (const seed of SIM_SEEDS) {
        const key = `${levelId}/${strategy}/${seed}`;
        assert.deepEqual(await playSim(levelId, seed, strategy), fixture.sim[key], key);
      }
    }
  }
});
