// Accompagnement — l'ordonnanceur, les réglages, les rappels et la déduction (logique pure : src/ui/coach/scheduler.js,
// src/ui/coach/acquired.js ; docs/ACCOMPAGNEMENT.md § 14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREATH_MS, PER_DAY, canShow, displayMode, pickNext, priorityOf, reminderDue, createReminderMemo, noteReminderShown,
  noteReminderIgnored, noteReminderSeason, quietReminders, sayOf,
} from '../src/ui/coach/scheduler.js';
import { acquiredAtLoad, experienced, veteran, careerKnown } from '../src/ui/coach/acquired.js';
import { tutorialStepId, LEGACY_TUTORIAL_STEPS } from '../src/ui/coach/store.js';
import { LESSONS } from '../src/ui/coach/lessons/index.js';

const UI = { playing: true, menu: false, dialog: null, sheet: null, sheetCount: 1, fete: false, view: false, decor: false, placing: false, rotated: false, resume: false, sinceStartMs: 60000, wide: false };
const L = (id, extra = {}) => ({ id, chapter: 'basics', title: id, tier: 'E', steps: [{ id: 's', say: 'Bonjour.', target: null, done: { button: 'Compris' } }], ...extra });

test('canShow : partie en cours seulement, jamais sur une fenêtre, une fête, la vue, une visée, le décor, pendant la reprise', () => {
  const l = L('a');
  assert.equal(canShow(l, UI), true);
  for (const k of ['rotated', 'resume', 'fete', 'view', 'decor', 'placing']) assert.equal(canShow(l, { ...UI, [k]: true }), false, k);
  assert.equal(canShow(l, { ...UI, dialog: 'season-end' }), false);
  assert.equal(canShow(l, { ...UI, playing: false }), false);
  assert.equal(canShow(l, { ...UI, sinceStartMs: 1000 }), false, '3 s de grâce');
  assert.equal(canShow(L('c', { course: true }), { ...UI, sinceStartMs: 1500 }), true, 'un cours commence plus vite');
});

test('canShow : leçons propres à un écran (fête, vue, visée, fenêtre, menu, feuille)', () => {
  assert.equal(canShow(L('f', { where: 'fete' }), { ...UI, fete: true }), true);
  assert.equal(canShow(L('f', { where: 'fete' }), UI), false);
  assert.equal(canShow(L('v', { where: 'view' }), { ...UI, view: true }), true);
  assert.equal(canShow(L('p', { where: 'placing' }), { ...UI, placing: true }), true);
  assert.equal(canShow(L('d', { where: 'dialog:season-end' }), { ...UI, dialog: 'season-end' }), true);
  assert.equal(canShow(L('d', { where: 'dialog:season-end' }), { ...UI, dialog: 'pause' }), false);
  assert.equal(canShow(L('m', { where: 'menu' }), { ...UI, playing: false, menu: true, menuScreen: 'main-menu', dialog: null }), true);
  assert.equal(canShow(L('m', { where: 'menu' }), UI), false);
  // Feuille ouverte (téléphone) : seule une étape qui vise son contenu.
  assert.equal(canShow(L('a'), { ...UI, sheet: 'seeds' }), false);
  assert.equal(canShow(L('s', { where: 'sheet:seeds' }), { ...UI, sheet: 'seeds' }), true);
  const st = L('t', { steps: [{ id: 'x', say: 'Ici.', sheet: 'shop', target: { ui: '#x' } }] });
  assert.equal(canShow(st, { ...UI, sheet: 'shop' }), true);
  assert.equal(canShow(st, UI), false);
  assert.equal(canShow(L('g', { where: 'game' }), { ...UI, sheet: 'shop' }), true);
});

test('displayMode : Complet / Discret / Aucun (tableau du § 4.7)', () => {
  const E = L('e');
  const U = L('u', { tier: 'U' });
  const C = L('c', { course: true });
  const S = L('s', { tier: 'U', priority: 90 });
  assert.deepEqual(['full', 'quiet', 'off'].map((v) => displayMode(E, v)), ['full', 'pill', 'carnet']);
  assert.deepEqual(['full', 'quiet', 'off'].map((v) => displayMode(U, v)), ['full', 'carnet', 'carnet']);
  assert.deepEqual(['full', 'quiet', 'off'].map((v) => displayMode(C, v)), ['full', 'offer', 'carnet']);
  assert.equal(displayMode(S, 'quiet'), 'pill', 'sécurité : pastille en Discret');
  assert.equal(displayMode(L('a', { always: true }), 'off'), 'full');
});

test('pickNext : priorité, respiration de 20 s, 3 leçons par jour, une bulle par ouverture de feuille', () => {
  const lo = { id: 'lo', lesson: L('lo', { tier: 'U' }), at: 1 };
  const hi = { id: 'hi', lesson: L('hi', { priority: 90 }), at: 2 };
  assert.equal(pickNext([lo, hi], UI, 100000, {}).id, 'hi');
  assert.equal(priorityOf(L('c', { course: true })), 100);
  assert.equal(pickNext([lo], UI, 100000, { lastEndAt: 100000 - BREATH_MS + 10 }), null, 'respiration');
  assert.ok(pickNext([lo], UI, 100000, { lastEndAt: 100000 - BREATH_MS - 10 }));
  assert.equal(pickNext([lo], UI, 1e6, { perDay: PER_DAY, dayAbs: 5, shownDay: 5 }), null, '3 par jour');
  assert.ok(pickNext([lo], UI, 1e6, { perDay: PER_DAY, dayAbs: 6, shownDay: 5 }), 'nouveau jour');
  assert.ok(pickNext([{ ...lo, chained: true }], UI, 100000, { lastEndAt: 100000 }), 'cours, `next` : sans respiration');
  const inSheet = { id: 's', lesson: L('s', { where: 'sheet:seeds' }), at: 1 };
  const ui = { ...UI, sheet: 'seeds', sheetCount: 7 };
  assert.ok(pickNext([inSheet], ui, 1e6, { sheetShownCount: 6 }));
  assert.equal(pickNext([inSheet], ui, 1e6, { sheetShownCount: 7 }), null);
});

test('rappels : seuil d\'attente, ≤ 1 par jour, ≤ 4 par saison, jamais la même sorte deux jours de suite', () => {
  const memo = createReminderMemo();
  const rem = { id: 'harvest', when: () => ({ text: 'Vos récoltes sont mûres, quand vous voulez.' }), wait: 1 };
  const other = { id: 'sow', when: () => ({ text: 'On sème ?' }), wait: 0 };
  const ctx = (abs, season = '1-0') => ({ day: { abs, seasonKey: season }, mode: 'levels', off: {} });
  noteReminderSeason(memo, '1-0');
  assert.equal(reminderDue(rem, ctx(1001), memo), null, 'attente d\'un jour');
  const due = reminderDue(rem, ctx(1002), memo);
  assert.ok(due);
  noteReminderShown(memo, 'harvest', ctx(1002));
  assert.equal(reminderDue(other, ctx(1002), memo), null, '1 par jour');
  assert.ok(reminderDue(other, ctx(1003), memo));
  assert.equal(reminderDue(rem, ctx(1003), memo), null, 'pas deux jours de suite');
  noteReminderShown(memo, 'sow', ctx(1003));
  noteReminderShown(memo, 'harvest', ctx(1005));
  noteReminderShown(memo, 'sow', ctx(1007));
  assert.equal(reminderDue(rem, ctx(1009), memo), null, '4 par saison');
  noteReminderSeason(memo, '1-1');
  assert.ok(reminderDue(rem, ctx(1009, '1-1'), memo), 'nouvelle saison');
  assert.equal(reminderDue(rem, { ...ctx(1010, '1-1'), off: { harvest: true } }, memo), null, 'sorte coupée');
});

test('rappels : silence jusqu\'à la saison suivante après 3 pastilles ignorées ; rien le jour qui suit « Où en étais-je ? »', () => {
  const memo = createReminderMemo();
  const rem = { id: 'water', when: () => ({ text: 'Un peu d\'eau ?' }), wait: 0 };
  const ctx = (abs, season = '1-0') => ({ day: { abs, seasonKey: season }, mode: 'levels', off: {} });
  noteReminderSeason(memo, '1-0');
  for (let i = 0; i < 3; i++) noteReminderIgnored(memo, 'water', ctx(1001));
  assert.equal(reminderDue(rem, ctx(1010), memo), null);
  noteReminderSeason(memo, '1-1');
  assert.ok(reminderDue(rem, ctx(1011, '1-1'), memo));
  quietReminders(memo, 1013);
  assert.equal(reminderDue(rem, ctx(1012, '1-1'), memo), null);
  assert.ok(reminderDue(rem, ctx(1013, '1-1'), memo));
  // Sécurité (fermage) : une fois par saison, hors quotas.
  const safety = { id: 'money.low', when: () => ({ text: 'Récoltez.' }), wait: 0, safety: true, oncePerSeason: true };
  assert.ok(reminderDue(safety, ctx(1013, '1-1'), memo));
  noteReminderShown(memo, 'money.low', ctx(1013, '1-1'), { safety: true });
  assert.equal(reminderDue(safety, ctx(1014, '1-1'), memo), null);
});

test('déduction : niveau 1 neuf, ancien joueur, carrière avancée (règles du § 10.3)', () => {
  const fresh = { progress: { levels: {} }, tutorialDone: false, careerSave: null, archives: 0, seen: () => false };
  assert.equal(experienced(fresh), false);
  assert.equal(veteran(fresh), false);
  assert.deepEqual(acquiredAtLoad(LESSONS, fresh), []);
  const won = { ...fresh, progress: { levels: { 1: { completed: true } } } };
  assert.equal(experienced(won), true);
  assert.equal(veteran(won), false);
  const ids = acquiredAtLoad(LESSONS, won);
  for (const id of ['basics.harvest', 'basics.sow', 'basics.water', 'basics.time', 'basics.buy']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('basics.todo'));
  assert.equal(experienced({ ...fresh, tutorialDone: true }), true);
  assert.equal(experienced({ ...fresh, progress: { lifetime: { harvests: 25 } } }), true);
  const old = { ...fresh, careerSave: { year: 6, day: 3, rank: 4 }, archives: 0 };
  assert.equal(experienced(old), true);
  assert.equal(veteran(old), true);
  assert.equal(careerKnown(old), true);
  const oldIds = acquiredAtLoad(LESSONS, old);
  assert.ok(oldIds.includes('basics.todo') && oldIds.includes('career.firstSteps'));
  // Une leçon déjà vue n'est pas renvoyée ; un prédicat qui lève une exception compte comme faux.
  assert.deepEqual(acquiredAtLoad([{ id: 'x', steps: [], acquired: () => { throw new Error('ancienne version'); } }], fresh), []);
  assert.deepEqual(acquiredAtLoad([{ id: 'y', steps: [], acquired: () => true }], { ...fresh, seen: () => true }), []);
});

test('reprise du tutoriel du niveau 1 : ancien index → identifiant d\'étape', () => {
  assert.deepEqual(LEGACY_TUTORIAL_STEPS, ['welcome', 'sowTap', 'water', 'time', 'harvest', 'bill', 'coopTab', 'todo']);
  assert.equal(tutorialStepId(0), 'welcome');
  assert.equal(tutorialStepId(2), 'water');
  assert.equal(tutorialStepId(6), 'coopTab');
  assert.equal(tutorialStepId(8), null, '8 et plus : cours terminé (le gel devient basics.frost)');
  assert.equal(tutorialStepId('harvest'), 'harvest');
  assert.equal(tutorialStepId(null), null);
  const fy = LESSONS.find((l) => l.id === 'levels.firstYear');
  for (const id of LEGACY_TUTORIAL_STEPS) assert.ok(fy.steps.some((s) => s.id === id), id);
});

test('sayOf : texte ou fonction, jamais d\'exception', () => {
  assert.equal(sayOf({ say: 'Bonjour.' }, {}), 'Bonjour.');
  assert.equal(sayOf({ say: (c) => `${c.n} !` }, { n: 3 }), '3 !');
  assert.equal(sayOf({ say: () => { throw new Error('x'); } }, {}), '');
});
