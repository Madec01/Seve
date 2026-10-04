// Accompagnement — « Le carnet de Joseph » (docs/ACCOMPAGNEMENT.md § 9) : le Guide de la ferme et les leçons de Joseph
// fusionnés en un seul carnet (décision de l'utilisateur, 2026-10-04) : Leçons · Mots de la ferme · Rappels.
//
// openCarnet(app, { lessonId?, tab? }) → ouvre la feuille 'carnet' (tab : 'lessons' | 'words' | 'rules' | 'reminders').
// Leçons : chapitres repliables dans l'ordre du jeu ; seules les leçons vues (✓), à lire (●) ou passées (↷) sont listées,
// le reste est compté (« … et 6 leçons à venir ») ; page d'une leçon : ses étapes en texte, « Me montrer » (rejeu) et
// « Retour ». Mots de la ferme : glossaire et règles (GLOSSARY, GUIDE_SECTIONS de guide.js). Rappels : un interrupteur par
// sorte. En tête : le réglage Complet / Discret / Aucun.

import { el, setText } from '../dom.js';
import { icon } from '../icons.js';
import { joseph } from '../career/util.js';
import { GLOSSARY, GUIDE_SECTIONS } from '../guide.js';
import { CHAPTERS } from './lessons/index.js';
import { SIGNALS } from './signals.js';
import { sayOf } from './scheduler.js';

const TABS = [
  { id: 'lessons', label: 'Leçons' },
  { id: 'words', label: 'Mots de la ferme' },
  { id: 'reminders', label: 'Rappels' },
];
const LEVELS = [
  { id: 'full', label: 'Complet', sub: 'Je vous montre tout, pas à pas.' },
  { id: 'quiet', label: 'Discret', sub: 'Juste un mot quand c\'est nouveau.' },
  { id: 'off', label: 'Aucun', sub: 'Je vous laisse découvrir.' },
];

const openChapters = new Set(['basics']);

/** Réglage Complet / Discret / Aucun (groupe radio), réutilisé dans les options et la fenêtre « Bienvenue ! ». */
export function guidancePicker(app, { idPrefix = 'carnet-level', onChange = null, rows = false, preselect = null } = {}) {
  const cur = () => preselect || app.settings?.guidance || 'full';
  const group = el(`div.coach-levels${rows ? '.is-rows' : ''}`, { role: 'radiogroup', 'aria-label': 'Accompagnement de Joseph', id: idPrefix });
  const items = LEVELS.map((l) =>
    el(
      'button.coach-level',
      {
        type: 'button',
        role: 'radio',
        id: `${idPrefix}-${l.id}`,
        'data-level': l.id,
        onclick: () => {
          app.audio?.play?.('toggle');
          preselect = null;
          if (app.coach) app.coach.setLevel(l.id);
          else app.updateSettings?.({ guidance: l.id, guidanceAsked: true });
          sync();
          onChange?.(l.id);
        },
      },
      el('b', l.label),
      rows ? el('small', l.sub) : null,
    ),
  );
  group.append(...items);
  const sync = () => {
    for (const b of items) {
      const on = b.dataset.level === cur();
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
  };
  sync();
  return group;
}

function stateOf(coach, id) {
  if (coach.unread().includes(id)) return 'unread';
  if (coach.passed(id)) return 'passed';
  return coach.seen(id) ? 'seen' : 'locked';
}
const STATE_MARK = { seen: '✓', unread: '●', passed: '↷' };
const STATE_TEXT = { seen: 'vue', unread: 'à lire', passed: 'passée' };

function stepTexts(app, lesson) {
  const g = app.game && !app.inMenu ? app.game : null;
  const ctx = {
    game: g,
    q: g?.query,
    state: g?.state || null,
    mode: g?.mode === 'career' ? 'career' : g ? 'levels' : null,
    level: g?.level || null,
    ui: { touch: !!app.isTouch },
    day: null,
    mem: {},
    seen: () => true,
    settings: app.settings,
    safe: (fn, fb) => {
      try {
        const v = fn();
        return v === undefined ? fb : v;
      } catch {
        return fb;
      }
    },
  };
  return lesson.steps
    .map((s) => sayOf(s, ctx) || (typeof s.say === 'string' ? s.say : ''))
    .filter(Boolean);
}

export function carnetContent(app, { lessonId = null, tab = 'lessons' } = {}) {
  const coach = app.coach;
  const root = el('div.carnet');
  let current = tab === 'rules' ? 'words' : TABS.some((t) => t.id === tab) ? tab : 'lessons';
  let page = lessonId;

  const head = el(
    'div.carnet-head',
    el('span.carnet-face', joseph('happy', 'sprite--avatar')),
    el('p.carnet-quote', '« Tout ce que je vous ai montré est noté ici. »'),
  );
  const level = el('div.carnet-level', el('span.opt-label', el('b', 'Accompagnement')), guidancePicker(app));
  const tabBar = el('div.seg.carnet-tabs', { role: 'tablist', 'aria-label': 'Le carnet de Joseph' });
  const body = el('div.carnet-body', { role: 'tabpanel' });
  const tabButtons = TABS.map((t) =>
    el('button.seg-btn.carnet-tab', { type: 'button', role: 'tab', id: `carnet-tab-${t.id}`, onclick: () => { app.audio?.play?.('page', { volume: 0.5 }); current = t.id; page = null; paint(); } }, el('span.seg-pct', t.label)),
  );
  tabBar.append(...tabButtons);
  root.append(head, level, tabBar, body);

  function paint() {
    for (const b of tabButtons) {
      const on = b.id === `carnet-tab-${current}`;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    body.replaceChildren(...(current === 'lessons' ? (page ? lessonPage(page) : lessonList()) : current === 'words' ? wordsTab() : remindersTab()).filter(Boolean));
    body.scrollTop = 0;
  }

  function lessonList() {
    if (!coach) return [el('p.sheet-empty', 'Le carnet arrive bientôt.')];
    const career = app.game?.mode === 'career';
    const all = coach.lessons().filter((l) => !l.hidden && !l.legacy);
    const out = [];
    let locked = 0;
    for (const ch of CHAPTERS) {
      const list = all.filter((l) => (l.chapter || 'basics') === ch.id);
      if (!list.length) continue;
      const shownList = list.filter((l) => stateOf(coach, l.id) !== 'locked');
      locked += list.length - shownList.length;
      if (!shownList.length) continue;
      const isOpen = openChapters.has(ch.id);
      const rows = el(
        'div.carnet-rows',
        { hidden: !isOpen },
        shownList.map((l) => {
          const st = stateOf(coach, l.id);
          return el(
            `button.carnet-row.is-${st}`,
            { type: 'button', id: `carnet-l-${l.id.replace(/\W/g, '-')}`, onclick: () => { app.audio?.play?.('page', { volume: 0.5 }); page = l.id; paint(); } },
            el('span.carnet-mark', { 'aria-hidden': 'true' }, STATE_MARK[st] || ''),
            el('span.carnet-row-title', l.title),
            el('span.carnet-row-state', STATE_TEXT[st] || ''),
            el('span.carnet-chev', { 'aria-hidden': 'true' }, '›'),
          );
        }),
      );
      const headBtn = el(
        'button.carnet-chapter',
        {
          type: 'button',
          'aria-expanded': isOpen ? 'true' : 'false',
          onclick: (e) => {
            const on = rows.hidden;
            rows.hidden = !on;
            e.currentTarget.setAttribute('aria-expanded', on ? 'true' : 'false');
            if (on) openChapters.add(ch.id);
            else openChapters.delete(ch.id);
            app.audio?.play?.('page', { volume: 0.5 });
          },
        },
        el('span.carnet-chapter-title', ch.title),
        el('span.carnet-count', `${shownList.length} / ${list.length}`),
        el('span.carnet-chev', { 'aria-hidden': 'true' }, '›'),
      );
      out.push(el('section.carnet-chapter-sec', headBtn, rows));
    }
    if (!out.length) out.push(el('p.sheet-empty', 'Rien encore : je vous montre en chemin !'));
    if (locked > 0) out.push(el('p.carnet-more', `… et ${locked} leçon${locked > 1 ? 's' : ''} à venir.`));
    void career;
    return out;
  }

  function lessonPage(id) {
    const l = coach?.lesson(id);
    if (!l) return lessonList();
    coach.markRead(id);
    const texts = stepTexts(app, l);
    const msg = el('p.carnet-why', { role: 'status' });
    const inGame = !!app.game && !app.inMenu;
    const show = el(
      `button.btn.btn--red${inGame ? '' : '.is-disabled'}`,
      {
        type: 'button',
        id: 'carnet-replay',
        'aria-disabled': inGame ? 'false' : 'true',
        onclick: () => {
          if (!inGame) {
            setText(msg, 'En partie seulement.');
            return;
          }
          const r = coach.replay(id);
          if (r?.ok) {
            app.audio?.play?.('click');
            app.sheets.close('silent');
          } else setText(msg, r?.text || 'Pas possible pour l\'instant.');
        },
      },
      'Me montrer',
    );
    const back = el('button.btn', { type: 'button', id: 'carnet-back', onclick: () => { app.audio?.play?.('page', { volume: 0.5 }); page = null; paint(); } }, 'Retour');
    return [
      el('h3.carnet-page-title', l.title),
      el('ol.carnet-steps', texts.map((t) => el('li', t))),
      inGame ? null : el('p.carnet-why', 'En partie seulement.'),
      msg,
      el('div.carnet-actions', back, show),
    ];
  }

  function wordsTab() {
    const career = app.game?.mode === 'career';
    const inGame = !!app.game && !app.inMenu;
    const fits = (m) => m === 'both' || !inGame || (career ? m === 'career' : m === 'levels');
    const words = el('dl.guide-words.carnet-words', GLOSSARY.filter((g) => fits(g.mode)).flatMap((g) => [el('dt', g.word), el('dd', g.text)]));
    const rules = GUIDE_SECTIONS.filter((s) => fits(s.mode)).map((s) =>
      el(
        'details.carnet-rule',
        { id: `carnet-rule-${s.id}` },
        el('summary', icon(s.icon || 'info', 'sm'), el('span', s.title)),
        el('ul.guide-lines', s.lines.map((t) => el('li', t))),
      ),
    );
    return [el('h3.carnet-sub', 'Les mots de la ferme'), words, el('h3.carnet-sub', 'Les règles'), ...rules];
  }

  function remindersTab() {
    if (!coach) return [];
    const rows = coach.reminderList().filter((r) => !r.modes || !app.game || r.modes.includes(app.game.mode === 'career' ? 'career' : 'levels'));
    return [
      el('p.sheet-hint', 'Joseph vous fait signe quand une chose utile attend. Coupez ici ce que vous ne voulez plus.'),
      ...rows.map((r) => {
        const on = () => !coach.reminderOff(r.id);
        const state = el('span.opt-state', { 'aria-hidden': 'true' });
        const b = el(
          'button.opt-toggle.carnet-rem',
          {
            type: 'button',
            role: 'switch',
            id: `carnet-rem-${r.id.replace(/\W/g, '-')}`,
            onclick: () => {
              app.audio?.play?.('toggle');
              coach.setReminderOff(r.id, on());
              sync();
            },
          },
          el('span.checkbox'),
          el('span.opt-label', el('b', r.title || r.id), el('small', r.example || '')),
          state,
        );
        const sync = () => {
          b.classList.toggle('is-on', on());
          b.setAttribute('aria-checked', on() ? 'true' : 'false');
          state.textContent = on() ? 'Oui' : 'Non';
        };
        sync();
        return b;
      }),
    ];
  }

  paint();
  return root;
}

export function openCarnet(app, { lessonId = null, tab = 'lessons' } = {}) {
  // Au menu principal (relire sans jouer) : une fenêtre par-dessus les options ; « Me montrer » y est grisé.
  if (app.inMenu || !app.game) {
    const node = app.dialogs.frame({
      title: 'Le carnet de Joseph',
      ribbon: 'ribbon',
      cls: 'dialog--carnet',
      body: carnetContent(app, { lessonId, tab }),
      actions: [app.dialogs.btn('Retour', () => app.dialogs.closeTop(), 'btn--red', { id: 'carnet-close', 'data-autofocus': '' })],
      onClose: () => app.dialogs.closeTop(),
    });
    app.coach?.signal?.(SIGNALS.carnetOpen);
    return app.dialogs.open(node, { id: 'carnet' });
  }
  if (app.dialogs?.isOpen?.()) app.dialogs.closeAll();
  app.sheets.open({ id: 'carnet', kind: 'panel', tall: true, title: 'Le carnet de Joseph', icon: icon('info', 'md'), content: carnetContent(app, { lessonId, tab }) });
  app.audio?.play?.('page', { volume: 0.5 });
  app.coach?.signal?.(SIGNALS.carnetOpen);
  return null;
}
