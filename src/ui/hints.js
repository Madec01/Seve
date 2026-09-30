// Conseils « première fois » : une bulle courte (2 lignes au plus) avec « Compris », quand un
// système apparaît pour la première fois (atelier, pommier, chèvre, concours, grange, décor).
// Mémorisés dans la progression (hintsSeen) : jamais deux fois le même.
//
// createHints(app) → { maybe(id, target?), frame(), relayout(), clear(), active }
//   target : { selector } | { plot: index } | { investment: id } | null
// Règles (comme le tutoriel) : partie en pause pendant la bulle ; jamais par-dessus sa cible (en
// haut ou en bas selon la place, flèche vers la cible) ; en partie, attend qu'aucune fenêtre ni le
// tutoriel ne soit affiché ; au menu, seulement sur le menu principal. Une bulle à la fois (file).

import { el, placeNear, setText } from './dom.js';
import { sprite } from './icons.js';

export const HINTS = {
  processing: { title: 'Les ateliers', text: 'Nouveau : les ateliers transforment vos récoltes en produits plus chers, vendus tout seuls à l\'aube.', where: 'game' },
  processingBought: { title: 'Votre atelier', text: 'Interrupteur allumé : les récoltes compatibles y partent tant qu\'il reste une place. Sinon, elles se vendent comme d\'habitude.', where: 'game' },
  tree: { title: 'Le pommier', text: 'Le pommier reste toute l\'année : pas d\'arrosage, pas de gel, des pommes en été et en automne.', where: 'game' },
  goat: { title: 'Les chèvres', text: 'Les chèvres donnent du lait chaque jour ; avec une fromagerie, il devient du fromage.', where: 'game' },
  pollination: { title: 'Les abeilles', text: 'Sans abeilles, vos pommiers donnent moitié moins. Pensez à la ruche !', where: 'game' },
  contest: { title: 'Le concours', text: 'Concours le soir du 21ᵉ jour : 6 citrouilles, 12 produits, 3 fromages. Chaque épreuve rapporte 120.', where: 'game' },
  grange: { title: 'Vos étoiles', text: 'Vos étoiles achètent des bonus dans la grange aux souvenirs.', where: 'menu' },
  decor: { title: 'Vos écus', text: 'Vos écus décorent la ferme : Grange → Ma ferme.', where: 'menu' },
};

export function createHints(app) {
  const layer = el('div', { id: 'hints', 'aria-live': 'polite' });
  const bubble = el('div.tuto-bubble.hint-bubble', { role: 'dialog', 'aria-label': 'Conseil' });
  layer.append(bubble);
  document.body.append(layer);

  const queue = []; // { id, target }
  let shown = null; // { id, target, def }
  let lastKey = '';
  let textNode = null;

  const available = () => !!app.progression?.available();

  /** Demande un conseil ; renvoie true s'il sera montré (maintenant ou plus tard). */
  function maybe(id, target = null) {
    const def = HINTS[id];
    if (!def || !available()) return false;
    if (app.progression.hintSeen(id)) return false;
    if (shown?.id === id || queue.some((q) => q.id === id)) return true;
    queue.push({ id, target });
    pump();
    return true;
  }

  function contextOk(def) {
    if (def.where === 'menu') return app.inMenu && app.dialogs.top() === 'main-menu';
    return !!app.game && !app.inMenu && app.game.state.status === 'playing' && !app.dialogs.isOpen() && !app.tutorial.active && !app.decor?.active;
  }

  function pump() {
    if (shown) return;
    // Conseils d'un autre contexte (partie quittée, etc.) : oubliés, ils reviendront plus tard.
    for (let i = queue.length - 1; i >= 0; i--) {
      const d = HINTS[queue[i].id];
      if (d.where === 'game' && (app.inMenu || !app.game)) queue.splice(i, 1);
      if (d.where === 'menu' && !app.inMenu) queue.splice(i, 1);
    }
    const i = queue.findIndex((q) => contextOk(HINTS[q.id]));
    if (i === -1) return;
    const [q] = queue.splice(i, 1);
    show(q);
  }

  function show(q) {
    const def = HINTS[q.id];
    shown = { ...q, def };
    bubble.replaceChildren(
      el('div.tuto-avatar', sprite('farmer', 'sprite--avatar')),
      el(
        'div.tuto-content',
        el('div.tuto-name', 'Conseil'),
        el('div.tuto-title', def.title),
        (textNode = el('p.tuto-text', def.text)),
        el('div.tuto-actions', el('button.btn.btn--small.btn--red', { type: 'button', id: 'hint-ok', onclick: () => done() }, 'Compris')),
      ),
    );
    setText(textNode, def.text);
    if (def.where === 'game') app.pushPause('hint');
    app.toasts?.hideBanner?.();
    bubble.classList.remove('is-visible');
    void bubble.offsetWidth;
    bubble.classList.add('is-visible');
    layer.classList.add('is-active');
    lastKey = '';
    position(true);
    app.audio.play('warning', { volume: 0.5 });
    if (app.keyboardMode) bubble.querySelector('#hint-ok')?.focus({ preventScroll: true });
  }

  function done() {
    if (!shown) return;
    app.audio.play('click');
    app.progression.markHint(shown.id);
    hide();
    pump();
  }

  function hide() {
    if (!shown) return;
    const was = shown;
    shown = null;
    bubble.classList.remove('is-visible');
    layer.classList.remove('is-active');
    if (was.def.where === 'game') app.popPause('hint');
  }

  /** Tout oublier (changement de partie, retour au menu) : les conseils non lus reviendront. */
  function clear() {
    queue.length = 0;
    hide();
  }

  function targetRect(t) {
    if (!t) return null;
    if (t.selector) {
      const n = document.querySelector(t.selector);
      if (!n || n.offsetParent === null) return null;
      const r = n.getBoundingClientRect();
      return r.width && r.height ? r : null;
    }
    if (t.plot !== undefined) return app.plotPageRect?.(t.plot) || null;
    if (t.investment) {
      const p = app.investmentPageRect?.(t.investment);
      return p || null;
    }
    return null;
  }

  function position(force = false) {
    if (!shown) return;
    const rect = targetRect(shown.target);
    const key = `${rect ? [rect.left, rect.top, rect.width, rect.height].map(Math.round).join(',') : 'none'}|${innerWidth}x${innerHeight}|${app.sheets?.current || ''}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const wide = app.isWide();
    if (wide && rect) {
      bubble.classList.remove('is-docked');
      const side = placeNear(bubble, rect, 'bottom', 18);
      const b = bubble.getBoundingClientRect();
      bubble.style.setProperty('--ax', `${Math.round(Math.max(22, Math.min(b.width - 22, rect.left + rect.width / 2 - b.left)))}px`);
      bubble.style.setProperty('--ay', `${Math.round(Math.max(22, Math.min(b.height - 22, rect.top + rect.height / 2 - b.top)))}px`);
      bubble.dataset.side = side;
      return;
    }
    bubble.classList.add('is-docked');
    const vw = innerWidth;
    const inMenu = shown.def.where === 'menu';
    const top = (inMenu ? 0 : app.safeTop()) + 8;
    const bottom = (inMenu ? Math.round(window.visualViewport?.height || innerHeight) : app.safeBottom()) - 8;
    const b = bubble.getBoundingClientRect();
    const x = Math.round(Math.max(8, (vw - b.width) / 2));
    let y = bottom - b.height;
    let side = 'none';
    if (rect) {
      const roomTop = rect.top - 14 - top;
      const roomBottom = bottom - (rect.bottom + 14);
      const cy = rect.top + rect.height / 2;
      const preferTop = cy > (top + bottom) / 2;
      if ((preferTop && roomTop >= b.height) || (roomBottom < b.height && roomTop >= b.height)) {
        y = top;
        side = 'top';
      } else if (roomBottom >= b.height) {
        y = bottom - b.height;
        side = 'bottom';
      } else {
        y = roomTop > roomBottom ? top : bottom - b.height;
      }
    }
    bubble.style.left = `${x}px`;
    bubble.style.top = `${Math.round(y)}px`;
    if (rect && side !== 'none') {
      bubble.style.setProperty('--ax', `${Math.round(Math.max(22, Math.min(b.width - 22, rect.left + rect.width / 2 - x)))}px`);
      bubble.dataset.side = side === 'top' ? 'top' : 'bottom';
    } else bubble.dataset.side = 'none';
  }

  function frame() {
    if (!shown) {
      if (queue.length) pump();
      return;
    }
    // Une fenêtre s'ouvre par-dessus un conseil de partie (fin de saison…) : il attendra.
    if (!contextOk(shown.def)) {
      const q = { id: shown.id, target: shown.target };
      hide();
      if (q && HINTS[q.id].where === 'game' && app.game && !app.inMenu) queue.unshift(q);
      return;
    }
    position();
  }

  return {
    maybe,
    frame,
    clear,
    relayout: () => position(true),
    get active() {
      return !!shown;
    },
    get current() {
      return shown?.id || null;
    },
  };
}
