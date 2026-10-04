// Historique des messages (lot 1 « confort », A9) : chaque message (toast) et chaque bandeau montrés
// pendant la partie sont notés ici ; la feuille « Messages » montre les 50 derniers, du plus récent au
// plus ancien, avec l'heure et le jour de jeu. Un message qui proposait une action (« Touchez pour
// répondre ») garde son bouton tant que l'action a un sens (offre encore valable, quête…).
//
// createMessages(app) → {
//   add(entry), list(), unread, markRead(), clear(),
//   open(),                      feuille « Messages » (id 'messages')
//   modePicker()                 réglage « Messages à l'écran » : Tous · Importants (défaut) · Aucun (options, feuille)
//   onChange(fn)                 appelé quand la liste ou le nombre de non-lus change
// }
// Rien n'est enregistré : l'historique vit le temps de la session (il repart à zéro à chaque partie).

import { el, plural } from './dom.js';
import { icon } from './icons.js';
import { season } from './text.js';

const MAX = 50;
const KIND_ICON = { info: 'info', error: 'lock', success: 'star', warn: 'bill', money: 'coin', frost: 'winter', rot: 'rain', achievement: 'star', season: 'calendar' };

/** Petite cloche en pixels (SVG net, pas de flou) : icône des messages. */
export function bellIcon(cls = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('class', `bell-ico${cls ? ` ${cls}` : ''}`);
  // contour sombre, corps doré, reflet clair
  const rects = [
    ['#3f2631', 5, 0, 2, 1], ['#3f2631', 4, 1, 4, 1], ['#3f2631', 3, 2, 1, 5], ['#3f2631', 8, 2, 1, 5],
    ['#3f2631', 2, 7, 1, 2], ['#3f2631', 9, 7, 1, 2], ['#3f2631', 1, 9, 10, 1], ['#3f2631', 4, 10, 4, 1], ['#3f2631', 5, 11, 2, 1],
    ['#fddc00', 4, 2, 4, 5], ['#fddc00', 3, 7, 6, 2], ['#ffb600', 7, 3, 1, 4], ['#ffb600', 8, 7, 1, 2], ['#fff1d2', 4, 3, 1, 3], ['#b58300', 5, 10, 2, 1],
  ];
  for (const [fill, x, y, w, h] of rects) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', x);
    r.setAttribute('y', y);
    r.setAttribute('width', w);
    r.setAttribute('height', h);
    r.setAttribute('fill', fill);
    svg.append(r);
  }
  return svg;
}

export function createMessages(app) {
  let items = []; // { id, at (ms), day: 'Jour 3 · printemps', kind, title, text, key, onClick, banner }
  let unread = 0;
  let nextId = 1;
  const listeners = new Set();

  const notify = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch (err) {
        console.warn('Messages :', err);
      }
    }
  };

  /** Jour de jeu en mots courts (« An 2 · été j3 », « Jour 12 · automne »). */
  function dayLabel() {
    const g = app.game;
    if (!g || app.inMenu) return '';
    try {
      const c = g.query.calendar();
      if (g.mode === 'career') return `An ${g.state.time.year} · ${season(c.seasonId).toLowerCase()} j${c.dayOfSeason}`;
      return `Jour ${c.day} · ${season(c.seasonId).toLowerCase()}`;
    } catch {
      return '';
    }
  }

  function add(e) {
    if (!e || (!e.text && !e.title)) return;
    if (app.inMenu || !app.game) return; // messages du menu (installation…) : pas d'historique de partie
    // Message mis à jour (même clé, encore affiché) : la ligne existante change, sans doublon.
    if (e.key) {
      const prev = items.find((x) => x.key === e.key && Date.now() - x.at < 15000);
      if (prev) {
        prev.title = e.title;
        prev.text = e.text;
        prev.at = Date.now();
        notify();
        return;
      }
    }
    // (2026-10-03) Répétitions : même titre (ou même texte sans titre) le même jour de jeu, dans les 5 dernières lignes
    // → une seule ligne « ×N » (« Récolte au grenier ×4 »), mise à jour et remontée en tête.
    const day = dayLabel();
    const same = !e.banner && !e.onClick && items.slice(0, 5).find((x) => !x.banner && !x.onClick && x.kind === (e.kind || 'info') && x.day === day && (e.title ? x.title === e.title : !x.title && x.text === e.text));
    if (same) {
      same.count = (same.count || 1) + 1;
      same.text = e.text || same.text;
      same.at = Date.now();
      items = [same, ...items.filter((x) => x !== same)];
      // (Deux touchers refusés de suite, même texte : comptés une fois.)
      if (app.sheets?.current === 'messages') refreshSheet();
      notify();
      return;
    }
    items.unshift({ id: nextId++, at: Date.now(), day, kind: e.kind || 'info', title: e.title || '', text: e.text || '', key: e.key || null, onClick: e.onClick || null, banner: !!e.banner, quiet: !!e.quiet, count: 1 });
    if (items.length > MAX) items.length = MAX;
    // Les bandeaux (saison) et les succès d'argent ordinaires ne comptent pas comme « non lus ».
    if (!e.banner && ['warn', 'frost', 'rot', 'error', 'achievement'].includes(e.kind || 'info')) unread += 1;
    else if (e.onClick) unread += 1;
    if (app.sheets?.current === 'messages') refreshSheet();
    notify();
  }

  function clear() {
    items = [];
    unread = 0;
    notify();
  }

  function markRead() {
    if (!unread) return;
    unread = 0;
    notify();
  }

  function timeText(at) {
    const s = Math.round((Date.now() - at) / 1000);
    if (s < 45) return 'à l\'instant';
    const m = Math.round(s / 60);
    if (m < 60) return `il y a ${plural(m, 'minute')}`;
    const d = new Date(at);
    return `à ${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function row(m) {
    const actionable = typeof m.onClick === 'function';
    return el(
      `li.msg-row.msg--${m.kind}${m.banner ? '.is-banner' : ''}`,
      el('span.msg-ico', icon(KIND_ICON[m.kind] || 'info', 'md')),
      el(
        'div.msg-main',
        m.title ? el('b.msg-title', m.count > 1 ? `${m.title} ×${m.count}` : m.title) : m.count > 1 ? el('b.msg-title', `×${m.count}`) : null,
        el('span.msg-text', m.text),
        el('small.msg-when', [m.day, timeText(m.at)].filter(Boolean).join(' · ')),
      ),
      actionable
        ? el('button.btn.btn--small.msg-go', {
            type: 'button',
            'aria-label': `Voir : ${m.title || m.text}`,
            onclick: () => {
              app.audio.play('click');
              try {
                m.onClick();
              } catch (err) {
                console.warn('Message :', err);
              }
            },
          }, 'Voir')
        : null,
    );
  }

  function content() {
    const intro = el('p.sheet-hint.msg-intro', 'Les derniers messages de la partie, du plus récent au plus ancien.');
    const morning = app.todo?.morningToggle?.() || null;
    const picker = modePicker();
    if (!items.length) return el('div.msg-sheet', intro, el('p.sheet-empty', 'Aucun message pour l\'instant.'), picker, morning);
    return el('div.msg-sheet', intro, el('ul.msg-list', items.map(row)), picker, morning);
  }

  /**
   * Réglage « Messages à l'écran » (options et feuille Messages) : Tous · Importants (par défaut) · Aucun.
   * Les choix et les alertes restent toujours ici, dans la ligne « À faire » et derrière la cloche.
   */
  function modePicker() {
    const choices = [
      ['all', 'Tous', 'tout s\'affiche'],
      ['important', 'Importants', 'conseillé'],
      ['none', 'Aucun', 'refus seuls'],
    ];
    const current = () => app.settings?.messages || 'important';
    const note = el('small.opt-sub');
    const group = el('div.seg.seg--3', { role: 'radiogroup', 'aria-label': 'Messages à l\'écran', id: 'opt-messages' });
    const buttons = choices.map(([id, label, sub]) =>
      el(
        'button.seg-btn',
        {
          type: 'button',
          role: 'radio',
          id: `opt-messages-${id}`,
          'data-mode': id,
          onclick: () => {
            if (current() === id) return;
            app.audio?.play('toggle');
            app.updateSettings?.({ messages: id });
            sync();
          },
        },
        el('span.seg-sample', label),
        el('span.seg-pct', sub),
      ),
    );
    group.append(...buttons);
    const NOTES = {
      all: 'Chaque nouvelle s\'affiche un instant en bas de l\'écran.',
      important: 'Seuls les messages à lire tout de suite s\'affichent (refus, alertes, choix à faire). Les autres nouvelles attendent derrière la cloche, regroupées dans le résumé du matin.',
      none: 'Rien ne s\'affiche, sauf les refus. Les alertes et les choix restent derrière la cloche et dans la ligne « À faire ».',
    };
    const sync = () => {
      for (const b of buttons) {
        const on = b.dataset.mode === current();
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      }
      note.textContent = NOTES[current()] || '';
    };
    group.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = Math.max(0, choices.findIndex((c) => c[0] === current()));
      const j = Math.min(choices.length - 1, Math.max(0, i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1)));
      buttons[j].click();
      buttons[j].focus();
    });
    sync();
    return el('div.opt-block.msg-mode', el('span.opt-label', el('b', 'Messages à l\'écran'), note), group);
  }

  function refreshSheet() {
    if (app.sheets.current !== 'messages') return;
    app.sheets.setContent(content(), true);
  }

  function open() {
    if (!app.game || app.inMenu) return;
    if (app.dialogs.isOpen()) app.dialogs.closeAll();
    app.sheets.open({ id: 'messages', kind: 'panel', tall: true, title: 'Messages', icon: bellIcon('bell-ico--md'), content: content() });
    app.audio.play('page', { volume: 0.5 });
    markRead();
    app.coach?.signal?.('messagesOpen');
  }

  return {
    add,
    list: () => items.slice(),
    get unread() {
      return unread;
    },
    markRead,
    clear,
    open,
    refresh: refreshSheet,
    modePicker,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
