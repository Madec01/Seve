// Barre d'onglets en bas de l'écran (à portée de pouce).
//   Niveaux  : Ferme · Acheter · Bilan · Menu
//   Carrière : Ferme · Acheter · Équipe · Carnet · Menu (src/ui/career/index.js, CAREER_TABS)
//
// createTabbar(root, app) → { refresh(), setBadge(id, on), setLocked(id, on), setTabs(list | null) }
// « Ferme » ferme la feuille ouverte et recentre la vue sur le champ (carrière : re-toucher → la carte) ;
// les autres ouvrent leur feuille (ou la ferment si elle est déjà ouverte) ; « Menu » ouvre la pause.

import { el } from './dom.js';
import { icon, spriteAny } from './icons.js';

const TABS = [
  { id: 'farm', label: 'Ferme', icon: 'seed', key: 'F' },
  { id: 'shop', label: 'Acheter', icon: 'coin', key: 'B' },
  { id: 'stats', label: 'Bilan', icon: 'bill', key: 'N' },
  { id: 'menu', label: 'Menu', icon: 'menu', key: 'Échap' },
];

export function createTabbar(root, app) {
  const buttons = new Map();
  let current = TABS;

  function build(list) {
    buttons.clear();
    root.replaceChildren();
    root.classList.toggle('is-five', list.length >= 5);
    for (const t of list) {
      const badge = el('span.tab-badge', { 'aria-hidden': 'true' });
      const lock = el('span.tab-lock', { 'aria-hidden': 'true' }, icon('lock', 'sm'));
      const ico = t.sprite ? spriteAny([t.sprite], 'sprite--tab', t.icon) : icon(t.icon, 'md');
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
        el('span.tabbar-ico', ico, badge, lock),
        el('span.tabbar-label', t.label),
      );
      buttons.set(t.id, { b, badge, lock });
      root.append(b);
    }
    refresh();
  }

  function refresh() {
    let active;
    if (app.careerUI?.active?.()) active = app.careerUI.activeTab();
    else {
      const sheet = app.sheets?.current || null;
      active = sheet === 'shop' ? 'shop' : sheet === 'stats' ? 'stats' : app.dialogs?.top() === 'pause' ? 'menu' : 'farm';
    }
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

  /** Onglet verrouillé (petit cadenas) : il reste touchable (sa feuille explique quoi faire). */
  function setLocked(id, on) {
    const t = buttons.get(id);
    if (!t) return;
    t.b.classList.toggle('is-locked', !!on);
    t.lock.classList.toggle('is-on', !!on);
  }

  /** Change la liste des onglets (null : ceux des niveaux). */
  function setTabs(list) {
    const next = list || TABS;
    if (next === current && buttons.size) return;
    current = next;
    build(next);
  }

  build(TABS);
  return { refresh, setBadge, setLocked, setTabs, el: root };
}
