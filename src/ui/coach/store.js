// Accompagnement — mémoire hors de l'état de partie (docs/ACCOMPAGNEMENT.md § 4.8).
//
// createCoachStore(app) → {
//   seen(id), mark(id)                 leçons vues : progression.hintsSeen (mêmes identifiants que les anciens conseils)
//   unread(), addUnread(id), markRead(id)        leçons « à lire » (vues sans être montrées) : préférences du guidage
//   passed(id), addPassed(id)          leçons passées (carnet : « ↷ passée »)
//   reminderOff(id), setReminderOff(id, on), remindersOff()
//   course(id) → { step } | null, saveCourse(id, data), endCourse(id)   reprise des cours (tutoriel du niveau 1, carrière)
//   level(), setLevel(v), asked(), setAsked()
// }
// Rien de tout cela n'entre dans game.state. Stockage indisponible : tout marche en mémoire pour la session.

import { readPrefs, writePrefs } from '../guide-prefs.js';
import * as storage from '../../storage.js';
import { LEVELS } from './scheduler.js';

// Ancien index de l'étape du tutoriel du niveau 1 (src/ui/tutorial.js) → identifiant d'étape du cours (§ 6).
export const LEGACY_TUTORIAL_STEPS = ['welcome', 'sowTap', 'water', 'time', 'harvest', 'bill', 'coopTab', 'todo'];

/** Étape du tutoriel retenue (texte) depuis la valeur enregistrée (index d'avant ou identifiant). null = fin du cours. */
export function tutorialStepId(step) {
  if (typeof step === 'string' && step) return step;
  if (Number.isInteger(step)) return step >= 0 && step < LEGACY_TUTORIAL_STEPS.length ? LEGACY_TUTORIAL_STEPS[step] : null;
  return null;
}

export function createCoachStore(app) {
  const memSeen = new Set();
  const uniq = (list) => [...new Set((list || []).filter((x) => typeof x === 'string'))];

  const prefs = () => readPrefs();
  const save = (patch) => writePrefs(patch);

  function seen(id) {
    if (memSeen.has(id)) return true;
    try {
      return !!app.progression?.hintSeen?.(id);
    } catch {
      return false;
    }
  }
  function mark(id) {
    if (!id) return;
    memSeen.add(id);
    try {
      if (!app.progression?.hintSeen?.(id)) app.progression?.markHint?.(id);
    } catch {
      /* progression indisponible : mémoire de la session */
    }
  }

  const unread = () => uniq(prefs().unread);
  function addUnread(id) {
    const u = unread();
    if (!u.includes(id)) save({ unread: [...u, id] });
  }
  function markRead(id) {
    const u = unread();
    if (u.includes(id)) save({ unread: u.filter((x) => x !== id) });
  }
  const passed = (id) => uniq(prefs().passed).includes(id);
  function addPassed(id) {
    const p = uniq(prefs().passed);
    if (!p.includes(id)) save({ passed: [...p, id] });
  }

  const remindersOff = () => {
    const r = prefs().reminders;
    return r && typeof r === 'object' ? r : {};
  };
  const reminderOff = (id) => !!remindersOff()[id]?.off;
  function setReminderOff(id, on) {
    const r = { ...remindersOff() };
    if (on) r[id] = { off: true };
    else delete r[id];
    save({ reminders: r });
  }

  /** Reprise d'un cours : levels.firstYear → clé « tutorial » (existante) ; career.firstSteps → guidance.firstSteps. */
  function course(id, key = null) {
    if (id === 'levels.firstYear') {
      const t = storage.loadTutorial();
      if (t.done) return { done: true, step: null };
      const step = tutorialStepId(t.step);
      return { done: false, step };
    }
    if (id === 'career.firstSteps') {
      const f = prefs().firstSteps;
      if (!f || typeof f !== 'object') return null;
      if (key !== null && f.key !== key) return null;
      return { done: !!f.done, step: typeof f.step === 'string' ? f.step : null };
    }
    const c = prefs().courses?.[id];
    return c && typeof c === 'object' ? { done: !!c.done, step: c.step ?? null } : null;
  }
  function saveCourse(id, { step = null, done = false, key = null } = {}) {
    if (id === 'levels.firstYear') {
      storage.saveTutorial({ done, step: done ? null : step });
      return;
    }
    if (id === 'career.firstSteps') {
      save({ firstSteps: { key, step: done ? null : step, done } });
      return;
    }
    const all = { ...(prefs().courses || {}) };
    all[id] = { step: done ? null : step, done };
    save({ courses: all });
  }

  const level = () => (LEVELS.includes(app.settings?.guidance) ? app.settings.guidance : 'full');
  function setLevel(v) {
    if (!LEVELS.includes(v)) return;
    app.updateSettings?.({ guidance: v, guidanceAsked: true });
  }
  const asked = () => !!app.settings?.guidanceAsked;
  const setAsked = () => app.updateSettings?.({ guidanceAsked: true });

  return { seen, mark, unread, addUnread, markRead, passed, addPassed, reminderOff, setReminderOff, remindersOff, course, saveCourse, level, setLevel, asked, setAsked };
}
