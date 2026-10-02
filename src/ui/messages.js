// Historique des messages (lot 1 « confort », A9) : chaque message (toast) et chaque bandeau montrés
// pendant la partie sont notés ici ; la feuille « Messages » montre les 50 derniers, du plus récent au
// plus ancien, avec l'heure et le jour de jeu. Un message qui proposait une action (« Touchez pour
// répondre ») garde son bouton tant que l'action a un sens (offre encore valable, quête…).
//
// createMessages(app) → {
//   add(entry), list(), unread, markRead(), clear(),
//   open(),                      feuille « Messages » (id 'messages')
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
    // Même texte que le précédent il y a moins de 2 s (ex. deux toucher refusés) : une seule ligne.
    const last = items[0];
    if (last && last.text === e.text && last.title === e.title && Date.now() - last.at < 2000) return;
    items.unshift({ id: nextId++, at: Date.now(), day: dayLabel(), kind: e.kind || 'info', title: e.title || '', text: e.text || '', key: e.key || null, onClick: e.onClick || null, banner: !!e.banner });
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
        m.title ? el('b.msg-title', m.title) : null,
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
    if (!items.length) return el('div.msg-sheet', intro, el('p.sheet-empty', 'Aucun message pour l\'instant.'), morning);
    return el('div.msg-sheet', intro, el('ul.msg-list', items.map(row)), morning);
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
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
