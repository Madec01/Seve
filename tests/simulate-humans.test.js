// Joueurs humains simulés (tools/simulate.js : casual, novice, idle) : modèle déterministe et
// garde-fous de l'équilibre « détente » (retour du joueur : faillite quasi inévitable au niveau 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_PROFILES, createHuman, playOne } from '../tools/simulate.js';
import { LEVELS } from '../src/data/levels.js';

const winRate = (levelId, strategy, difficulty, seeds) => {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) if (playOne(levelId, seed, strategy, {}, difficulty).win) wins++;
  return wins / seeds;
};

test('joueurs humains : profils plausibles (arrosage partiel, gestes limités, retards)', () => {
  const { casual, novice } = HUMAN_PROFILES;
  for (const p of [casual, novice]) {
    assert.ok(p.water[0] >= 0 && p.water[1] < 1, 'jamais tout arrosé');
    assert.ok(p.taps[0] >= 3 && p.taps[1] <= 12, 'quelques gestes par jour');
    assert.ok(p.skipDay > 0 && p.harvestProb < 1 && p.plantProb < 1);
  }
  assert.ok(novice.water[1] < casual.water[0], 'le novice arrose moins');
  assert.ok(novice.rentAware === 0 && casual.rentAware > 0);
});

test('joueurs humains : déterministes, tirage propre (graine × niveau × stratégie)', () => {
  assert.deepEqual(playOne(3, 7, 'casual', {}, 'detente'), playOne(3, 7, 'casual', {}, 'detente'));
  assert.deepEqual(playOne(6, 2, 'novice', {}, 'classique'), playOne(6, 2, 'novice', {}, 'classique'));
  const a = createHuman('casual', 1, 1);
  const b = createHuman('casual', 1, 1);
  const c = createHuman('novice', 1, 1);
  const seqA = [a.rnd(), a.rnd(), a.rnd()];
  assert.deepEqual([b.rnd(), b.rnd(), b.rnd()], seqA);
  assert.notDeepEqual([c.rnd(), c.rnd(), c.rnd()], seqA);
  assert.equal(a.tutorial, 'plant', 'niveau 1 : le tutoriel');
  assert.equal(createHuman('casual', 2, 1).tutorial, null);
});

test('cause du retour joueur : en classique, le joueur tranquille fait faillite au niveau 1', () => {
  assert.ok(winRate(1, 'casual', 'classique', 20) <= 0.2);
  assert.ok(winRate(1, 'novice', 'classique', 20) <= 0.2);
});

test('détente : le joueur tranquille et le débutant gagnent presque toujours le niveau 1', () => {
  assert.ok(winRate(1, 'casual', 'detente', 30) >= 0.95);
  assert.ok(winRate(1, 'novice', 'detente', 30) >= 0.9);
});

test('détente : la faillite existe toujours — semer une fois puis ne plus rien faire ruine la ferme', () => {
  for (const level of LEVELS) {
    for (const seed of [1, 2]) assert.equal(playOne(level.id, seed, 'idle', {}, 'detente').win, false, `niveau ${level.id}`);
  }
});
