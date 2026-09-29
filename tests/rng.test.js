import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRngState, hashSeed, nextFloat, stream, weightedPick } from '../src/core/rng.js';

test('même graine → même suite de nombres', () => {
  const a = createRngState(123);
  const b = createRngState(123);
  const sa = Array.from({ length: 50 }, () => nextFloat(a, 'weather'));
  const sb = Array.from({ length: 50 }, () => nextFloat(b, 'weather'));
  assert.deepEqual(sa, sb);
});

test('graines différentes → suites différentes', () => {
  const a = createRngState(1);
  const b = createRngState(2);
  const sa = Array.from({ length: 10 }, () => nextFloat(a, 'weather'));
  const sb = Array.from({ length: 10 }, () => nextFloat(b, 'weather'));
  assert.notDeepEqual(sa, sb);
});

test('les flux sont indépendants', () => {
  const a = createRngState(7);
  const b = createRngState(7);
  // Tirer dans le flux « rot » ne change pas le flux « weather ».
  for (let i = 0; i < 20; i++) nextFloat(b, 'rot');
  assert.equal(nextFloat(a, 'weather'), nextFloat(b, 'weather'));
  assert.notEqual(a.weather, a.market);
});

test("l'état est sérialisable : une copie JSON continue à l'identique", () => {
  const a = createRngState('graine texte');
  for (let i = 0; i < 13; i++) nextFloat(a, 'market');
  const copy = JSON.parse(JSON.stringify(a));
  const next = Array.from({ length: 20 }, () => nextFloat(a, 'market'));
  const nextCopy = Array.from({ length: 20 }, () => nextFloat(copy, 'market'));
  assert.deepEqual(next, nextCopy);
  for (const v of Object.values(copy)) assert.ok(Number.isInteger(v) && v >= 0 && v < 2 ** 32);
});

test('les flottants sont dans [0, 1) et bien répartis', () => {
  const s = createRngState(99);
  let sum = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const x = nextFloat(s, 'weather');
    assert.ok(x >= 0 && x < 1);
    sum += x;
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.02);
});

test('int, chance et range respectent leurs bornes', () => {
  const holder = createRngState(5);
  const r = stream(holder, 'weather');
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(2, 5);
    assert.ok(v >= 2 && v <= 5 && Number.isInteger(v));
    seen.add(v);
    const f = r.range(0.5, 1.8);
    assert.ok(f >= 0.5 && f < 1.8);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
  assert.equal(r.chance(0), false);
  assert.equal(r.chance(1), true);
});

test('weightedPick respecte les poids et ignore les poids nuls', () => {
  assert.equal(weightedPick({ a: 0, b: 1 }, 0), 'b');
  assert.equal(weightedPick({ a: 1, b: 3 }, 0.2), 'a');
  assert.equal(weightedPick({ a: 1, b: 3 }, 0.3), 'b');
  assert.equal(weightedPick({ a: 1, b: 3 }, 0.999999), 'b');
  assert.throws(() => weightedPick({ a: 0 }, 0.5));
  const holder = createRngState(11);
  const r = stream(holder, 'weather');
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 30000; i++) counts[r.weighted({ a: 1, b: 2, c: 0, d: 0 }) ?? 'c']++;
  assert.equal(counts.c, 0);
  assert.ok(Math.abs(counts.b / counts.a - 2) < 0.15);
});

test('hashSeed accepte nombres et textes, jamais 0', () => {
  assert.equal(hashSeed(1, 'x'), hashSeed(1, 'x'));
  assert.notEqual(hashSeed(1, 'x'), hashSeed(1, 'y'));
  assert.notEqual(hashSeed('abc'), 0);
  assert.equal(typeof hashSeed('abc'), 'number');
});
