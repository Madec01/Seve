// Rythme en temps réel et tri des messages (2026-10-03) : le jour dure plus longtemps à l'écran sans changer les
// règles par jour, et seuls les messages « importants » s'affichent par défaut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_SECONDS, REAL_DAY_SECONDS, GAME_SECONDS_PER_REAL_SECOND, SPEEDS } from '../src/data/balance.js';
import { priorityOf, visibleIn, MESSAGE_MODES } from '../src/ui/toasts.js';
import { DEFAULT_SETTINGS } from '../src/storage.js';
import { paceFactor } from '../src/render/career-actors.js';
import { createGame } from '../src/core/game.js';

test('rythme : un jour dure REAL_DAY_SECONDS réelles à ×1, entre 1,5 et 2 fois les 20 s d\'avant', () => {
  assert.equal(DAY_SECONDS, 20); // horloge du cœur inchangée (sauvegardes, simulateurs, parité)
  assert.ok(REAL_DAY_SECONDS >= 30 && REAL_DAY_SECONDS <= 40);
  assert.ok(Math.abs(GAME_SECONDS_PER_REAL_SECOND * REAL_DAY_SECONDS - DAY_SECONDS) < 1e-9);
  const real = (speed) => DAY_SECONDS / (GAME_SECONDS_PER_REAL_SECOND * speed);
  assert.deepEqual(SPEEDS.filter((s) => s > 0).map((s) => Math.round(real(s))), [72, 36, 18, 9]);
});

test('rythme : la boucle (dt réel × facteur) fait passer un jour en REAL_DAY_SECONDS secondes à ×1', () => {
  const g = createGame({ levelId: 2, seed: 7 });
  g.actions.setSpeed(1);
  const day0 = g.state.time.day;
  const frame = 1 / 60;
  let t = 0;
  while (g.state.time.day === day0 && t < 120) {
    g.update(frame * GAME_SECONDS_PER_REAL_SECOND);
    t += frame;
  }
  assert.ok(Math.abs(t - REAL_DAY_SECONDS) < 0.2, `jour en ${t.toFixed(2)} s`);
});

test('messages : classement important / info / toujours', () => {
  assert.equal(priorityOf({ kind: 'error', text: 'Il manque 12 pièces.', log: false }), 'always');
  assert.equal(priorityOf({ kind: 'info', text: 'Nouvelle version', keepTouch: true, onClick() {} }), 'always');
  assert.equal(priorityOf({ kind: 'info', text: 'Une offre', onClick() {} }), 'important');
  assert.equal(priorityOf({ kind: 'warn', text: 'Des corbeaux !' }), 'important');
  assert.equal(priorityOf({ kind: 'frost', text: 'Gel' }), 'important');
  assert.equal(priorityOf({ kind: 'money', text: '+12' }), 'info');
  assert.equal(priorityOf({ kind: 'success', text: 'Naissance' }), 'info');
  assert.equal(priorityOf({ kind: 'achievement', text: 'Succès' }), 'info');
  assert.equal(priorityOf({ kind: 'warn', text: 'Charges payées', prio: 'info' }), 'info');
  assert.equal(priorityOf({ kind: 'info', text: 'Fermage dans 2 jours', prio: 'important' }), 'important');
});

test('messages : réglage tous / importants (défaut) / aucun', () => {
  assert.deepEqual([...MESSAGE_MODES], ['all', 'important', 'none']);
  assert.equal(DEFAULT_SETTINGS.messages, 'important');
  for (const p of ['always', 'important', 'info']) assert.equal(visibleIn('all', p), true);
  assert.equal(visibleIn('important', 'important'), true);
  assert.equal(visibleIn('important', 'info'), false);
  assert.equal(visibleIn('none', 'important'), false);
  assert.equal(visibleIn('none', 'always'), true); // les refus restent visibles (réponse au toucher)
});

test('personnages : accélération modérée aux vitesses rapides (jamais ×4)', () => {
  assert.equal(paceFactor(0.5), 1);
  assert.equal(paceFactor(1), 1);
  assert.ok(paceFactor(2) > 1 && paceFactor(2) <= 1.3);
  assert.ok(paceFactor(4) > paceFactor(2) && paceFactor(4) <= 1.6);
});
