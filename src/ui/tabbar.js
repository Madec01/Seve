// Barre d'onglets en bas de l'écran (à portée de pouce) : Ferme · Acheter · Bilan · Menu.
//
// createTabbar(root, app) → { refresh(), setBadge(id, on) }
// « Ferme » ferme la feuille ouverte et recentre la vue sur le champ ; « Acheter » et « Bilan »
// ouvrent leur feuille (ou la ferment si elle est déjà ouverte) ; « Menu » ouvre la pause.

import { el } from './dom.js';
import { icon } from './icons.js';

const TABS = [
  { id: 'farm', label: 'Ferme', icon: 'seed', key: 'F' },
  { id: 'shop', label: 'Acheter', icon: 'coin', key: 'B' },
  { id: 'stats', label: 'Bilan', icon: 'bill', key: 'N' },
  { id: 'menu', label: 'Menu', icon: 'menu', key: 'Échap' },
];

export function createTabbar(root, app) {
  const buttons = new Map();
  for (const t of TABS) {
    const badge = el('span.tab-badge', { 'aria-hidden': 'true' });
    const b = el(
      'button.tabbar-btn',
      {
        type: 'button',
        id: `tab-${t.id}`,
        'data-tip': `${t.label} (${t.key})`,
        'data-tip-side': 'top',
        onclick: () => {
          app.vibrate?.(8);
          app.openTab(t.id, { fromUser: true });
        },
      },
      el('span.tabbar-ico', icon(t.icon, 'md'), badge),
      el('span.tabbar-label', t.label),
    );
    buttons.set(t.id, { b, badge });
    root.append(b);
  }

  function refresh() {
    const sheet = app.sheets?.current || null;
    const active = sheet === 'shop' ? 'shop' : sheet === 'stats' ? 'stats' : app.dialogs?.top() === 'pause' ? 'menu' : 'farm';
    for (const [id, { b }] of buttons) {
      const on = id === active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    }
  }

  function setBadge(id, on) {
    const t = buttons.get(id);
    if (t) t.badge.classList.toggle('is-on', !!on);
  }

  refresh();
  return { refresh, setBadge, el: root };
}
