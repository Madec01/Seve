// Accompagnement — les rappels « ne pas oublier » (docs/ACCOMPAGNEMENT.md § 8).
//
// createReminders(app, { bubble, store, safe, isBusy }) → { setList(list), bind(game, mode), unbind(), notify(ev),
//   frame(now, ctx, { busy }), quietAfterResume(), stats(), pillShown }
// Complet : une pastille de Joseph (≤ 1 par jour de jeu, ≤ 4 par saison, jamais la même sorte deux jours de suite,
// silence jusqu'à la saison suivante après 3 pastilles ignorées) qui pointe la ligne « À faire » ; Discret : une ligne
// « Joseph : … » dans le résumé du matin seulement ; Aucun : rien (sauf le conseil « fermage en danger », qui reste un
// message important comme avant). Compteurs en mémoire seulement : jamais dans la partie.

import { absDay } from '../../core/surprises.js';
import {
  createReminderMemo,
  noteReminderIgnored,
  noteReminderSeason,
  noteReminderShown,
  noteReminderUsed,
  quietReminders,
  reminderDue,
} from './scheduler.js';

const EVAL_MS = 500;
const PILL_MS = 6000;

export function createReminders(app, { bubble, store, safe }) {
  let list = [];
  let memo = createReminderMemo();
  let game = null;
  let mode = null;
  let lastEval = 0;
  let pill = null; // { id, until, used }
  let lastDawnAbs = null;
  let morningDoneAbs = null;

  function setList(l) {
    list = l;
  }

  function bind(g, m) {
    game = g;
    mode = m;
    memo = createReminderMemo();
    pill = null;
    lastDawnAbs = null;
    morningDoneAbs = null;
  }

  function unbind() {
    game = null;
    mode = null;
    closePill(false);
  }

  function quietAfterResume() {
    const abs = game ? absDay(game.state) : 0;
    quietReminders(memo, abs + 1);
  }

  function remCtx(ctx) {
    return { ...ctx, off: store.remindersOff ? Object.fromEntries(Object.entries(store.remindersOff()).map(([k, v]) => [k, !!v?.off])) : {}, level: store.level() };
  }

  /** Identifiant de l'entrée « À faire » d'un rappel (existante, ou fournie par `todo(ctx)`). */
  const todoId = (rem, ctx) => (typeof rem.todo === 'string' ? rem.todo : typeof rem.todo === 'function' ? safe(() => rem.todo(ctx)?.id, null) : null);

  function goTo(rem, ctx) {
    if (typeof rem.go === 'function') {
      safe(() => rem.go(app), null);
      return;
    }
    const id = todoId(rem, ctx);
    const item = id ? safe(() => app.todo.rawItems().find((x) => x.id === id), null) : null;
    if (item?.go) safe(() => item.go(), null);
    else if (id === 'rent') safe(() => app.hud.openInfo?.('bill'), null);
  }

  function showPill(rem, due, ctx) {
    const text = due.text;
    pill = { id: rem.id, until: performance.now() + PILL_MS * ((app.settings?.textScale || 1) >= 1.3 ? 2 : 1), used: false };
    noteReminderShown(memo, rem.id, ctx, { safety: !!rem.safety });
    const tid = todoId(rem, ctx);
    if (tid) safe(() => app.todo?.pointAt?.(tid, PILL_MS), null);
    bubble.showPill({
      title: 'Joseph',
      text,
      kind: 'reminder',
      label: `Joseph : ${text} Toucher pour y aller. Appui long : ne plus me le rappeler.`,
      onTap: () => {
        if (!pill) return;
        pill.used = true;
        noteReminderUsed(memo, rem.id);
        app.audio?.play?.('click', { volume: 0.5 });
        closePill(true);
        goTo(rem, ctx);
      },
      onLongPress: () => {
        store.setReminderOff(rem.id, true);
        app.audio?.play?.('toggle', { volume: 0.5 });
        app.toasts?.show?.({ kind: 'info', icon: 'info', text: 'Joseph ne vous le rappellera plus. (Carnet de Joseph › Rappels)', log: false });
        if (pill) pill.used = true;
        closePill(true);
      },
    });
    app.audio?.play?.('pop', { volume: 0.3 });
  }

  function closePill(fromUser) {
    if (!pill) return;
    const p = pill;
    pill = null;
    if (!fromUser && !p.used && game) {
      const c = ctxNow();
      if (c) noteReminderIgnored(memo, p.id, c);
    }
    bubble.hidePill();
  }

  function ctxNow() {
    if (!game) return null;
    const t = game.state.time;
    return { day: { abs: absDay(game.state), seasonKey: `${t.year || 1}-${t.seasonIndex || 0}` } };
  }

  /** À l'aube : un rappel dû devient la dernière ligne du résumé du matin (Complet et Discret). */
  function morning(ctx) {
    const level = store.level();
    if (level === 'off' || !ctx?.day) return;
    if (morningDoneAbs === ctx.day.abs) return;
    morningDoneAbs = ctx.day.abs;
    const rc = remCtx(ctx);
    for (const rem of list) {
      if (rem.safety) continue;
      const s = memo.sorts[rem.id];
      if (s && s.lastDay !== null && ctx.day.abs - s.lastDay <= 1) continue; // déjà une pastille la veille
      const due = reminderDue(rem, rc, memo, { ignoreQuota: true });
      if (due) {
        safe(() => app.todo?.morningNote?.(`Joseph : ${lowerFirst(due.text)}`), null);
        return;
      }
    }
  }

  const lowerFirst = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);

  function notify(ev) {
    if (!game) return;
    if (ev.type === 'dawn') lastDawnAbs = null; // l'aube est traitée à l'image suivante (contexte à jour)
  }

  function frame(now, ctx, { busy = false } = {}) {
    if (!game || !ctx?.day || app.inMenu) {
      if (pill) closePill(false);
      return;
    }
    noteReminderSeason(memo, ctx.day.seasonKey);
    if (pill && now > pill.until) closePill(false);
    if (now - lastEval < EVAL_MS) return;
    lastEval = now;
    const ui = ctx.ui;
    if (lastDawnAbs !== ctx.day.abs) {
      lastDawnAbs = ctx.day.abs;
      morning(ctx);
    }
    const level = store.level();
    if (pill) return;
    const blocked = busy || !ui.playing || ui.dialog || ui.sheet || ui.fete || ui.view || ui.placing || ui.decor || ui.rotated || ui.resume || (ui.sinceStartMs ?? 0) < 3000;
    const rc = remCtx(ctx);
    for (const rem of list) {
      const due = reminderDue(rem, rc, memo);
      if (!due) continue;
      if (rem.safety) {
        // Sécurité : Complet et Discret → pastille ; Aucun → le message important d'aujourd'hui.
        if (level === 'off') {
          noteReminderShown(memo, rem.id, rc, { safety: true });
          app.toasts?.show?.({ prio: 'important', kind: 'info', icon: 'bill', title: mode === 'career' ? 'Charges bientôt' : 'Fermage bientôt', text: due.text, duration: 7000 });
          continue;
        }
        if (blocked) continue;
        showPill(rem, due, rc);
        return;
      }
      if (level !== 'full' || blocked) continue;
      showPill(rem, due, rc);
      return;
    }
  }

  return {
    setList,
    bind,
    unbind,
    notify,
    frame,
    quietAfterResume,
    stats: () => ({ ...Object.fromEntries(Object.entries(memo.sorts).map(([k, v]) => [k, { shown: v.shown, ignored: v.ignored, off: !!store.reminderOff(k), silent: v.silentSeason !== null }])), _day: memo.dayCount, _season: memo.seasonCount }),
    get pillShown() {
      return !!pill;
    },
  };
}
