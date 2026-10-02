// Conseils « première fois » : une bulle courte (2 lignes au plus) avec « Compris », quand un
// système apparaît pour la première fois (atelier, pommier, chèvre, concours, grange, décor).
// Mémorisés dans la progression (hintsSeen) : jamais deux fois le même.
//
// createHints(app) → { maybe(id, target?), frame(), relayout(), clear(), active }
//   target : { selector } | { plot: index } | { investment: id } | { rect: () => rect de la page } | null
// Lot 1 « confort » : un conseil dont le sujet est déjà réglé (`relevant(app)` faux : « L'embauche » alors qu'un
// employé est déjà embauché) n'est jamais montré (et compte comme vu) ; pendant une feuille ouverte, un conseil
// n'attend que si sa cible est DANS la feuille (sinon il attend la fermeture : il ne couvre plus le haut de la
// feuille qu'on vient d'ouvrir) ; une cible dans la feuille peut être évitée en passant la bulle sur la feuille.
// Règles (comme le tutoriel) : partie en pause pendant la bulle ; jamais par-dessus sa cible (en
// haut ou en bas selon la place, flèche vers la cible) ; en partie, attend qu'aucune fenêtre ni le
// tutoriel ne soit affiché ; au menu, seulement sur le menu principal. Une bulle à la fois (file).

import { el, placeNear, setText } from './dom.js';
import { sprite, spriteAny } from './icons.js';

export const HINTS = {
  processing: { title: 'Les ateliers', text: 'Nouveau : les ateliers transforment vos récoltes en produits plus chers, vendus tout seuls à l\'aube.', where: 'game' },
  processingBought: { title: 'Votre atelier', text: 'Interrupteur allumé : les récoltes compatibles y partent tant qu\'il reste une place. Sinon, elles se vendent comme d\'habitude.', where: 'game' },
  tree: { title: 'Le pommier', text: 'Le pommier reste toute l\'année : pas d\'arrosage, pas de gel, des pommes en été et en automne.', where: 'game' },
  goat: { title: 'Les chèvres', text: 'Les chèvres donnent du lait chaque jour ; avec une fromagerie, il devient du fromage.', where: 'game' },
  pollination: { title: 'Les abeilles', text: 'Sans abeilles, vos pommiers donnent moitié moins. Pensez à la ruche !', where: 'game' },
  contest: { title: 'Le concours', text: 'Concours le soir du 21ᵉ jour : 6 citrouilles, 12 produits, 3 fromages. Chaque épreuve rapporte 120.', where: 'game' },
  grange: { title: 'Vos étoiles', text: 'Vos étoiles achètent des bonus dans la grange aux souvenirs.', where: 'menu' },
  decor: { title: 'Vos écus', text: 'Vos écus décorent la ferme : Grange → Ma ferme.', where: 'menu' },
  // Mode Carrière (docs/CARRIERE.md § 10.8)
  'career.start': { title: 'Votre ferme', text: 'Semez, arrosez, récoltez comme d\'habitude. Le Carnet montre les objectifs du prochain rang.', where: 'game', who: 'joseph' },
  'career.collect': { title: 'Les œufs', text: 'Les abris gardent leurs produits 3 jours : touchez le poulailler pour les ramasser.', where: 'game', who: 'joseph' },
  'career.lotForSale': { title: 'La forêt à vendre', text: 'Vous pouvez acheter un terrain de forêt, autour de la ferme : touchez « Acheter ». Chaque terrain ajoute un peu de charges de saison.', where: 'game', who: 'joseph', relevant: (app) => (app.game?.state.career?.lotsBought || 0) === 0 },
  'career.plan': { title: 'Le plan de culture', text: 'Chaque champ a un plan par saison : c\'est ce que sèment le semoir et les jardiniers.', where: 'game', who: 'joseph' },
  'career.hire': { title: 'L\'embauche', text: 'La maison peut loger des employés : ouvrez l\'onglet « Équipe » pour embaucher.', where: 'game', who: 'joseph', relevant: (app) => !(app.game?.state.career?.staff || []).length },
  'career.leave': { title: 'L\'hiver', text: 'En hiver, les champs sont vides : mettez l\'équipe en congé pour ne pas payer de salaires.', where: 'game', who: 'joseph', relevant: (app) => (app.game?.state.career?.staff || []).some((x) => !x.onLeave) },
  'career.collectAll': { title: 'Tout ramasser', text: 'Plusieurs abris attendent : le bouton « Tout ramasser », en bas, les vide d\'un coup. Vous pouvez aussi glisser le doigt d\'un abri à l\'autre.', where: 'game', who: 'joseph' },
  'career.machine': { title: 'Votre machine', text: 'Elle travaille seule chaque jour. Son interrupteur est dans la fiche du terrain.', where: 'game', who: 'joseph' },
  'career.storage': { title: 'Le grenier', text: 'Quand le cours est bas, la récolte attend au grenier. Vendez-la quand le cours remonte.', where: 'game', who: 'joseph' },
  'career.quest': { title: 'Les quêtes de Joseph', text: 'Rendez-moi service : je paie bien, et notre amitié grandit (♥).', where: 'game', who: 'joseph' },
  'career.crows': { title: 'Les corbeaux', text: 'Touchez une parcelle marquée d\'un corbeau pour le chasser, sinon la récolte vaudra moitié moins.', where: 'game', who: 'joseph' },
  'career.yearEnd': { title: 'Fin de l\'année', text: 'Au soir du dernier jour d\'hiver : le bilan de l\'année, puis l\'année suivante avec la même ferme.', where: 'game', who: 'joseph' },
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

  /** La cible est-elle dans la feuille ouverte (graines, fiche…) ? */
  function inSheet(t) {
    if (!t?.selector) return false;
    const n = document.querySelector(t.selector);
    return !!n && !!app.sheets?.box?.contains(n);
  }

  function contextOk(def, target = null) {
    if (def.where === 'menu') return app.inMenu && app.dialogs.top() === 'main-menu';
    if (!app.game || app.inMenu || app.game.state.status !== 'playing' || app.dialogs.isOpen() || app.tutorial.active || app.decor?.active) return false;
    // Feuille ouverte (téléphone) : seuls les conseils qui visent quelque chose dans la feuille passent.
    if (app.sheets?.isOpen() && !app.isWide() && !inSheet(target)) return false;
    return true;
  }

  function pump() {
    if (shown) return;
    // Conseils d'un autre contexte (partie quittée, etc.) : oubliés, ils reviendront plus tard.
    for (let i = queue.length - 1; i >= 0; i--) {
      const d = HINTS[queue[i].id];
      if (d.where === 'game' && (app.inMenu || !app.game)) queue.splice(i, 1);
      if (d.where === 'menu' && !app.inMenu) queue.splice(i, 1);
    }
    // Sujet déjà réglé (ex. un employé est déjà embauché) : le conseil ne sert plus, il compte comme vu.
    for (let k = queue.length - 1; k >= 0; k--) {
      const d = HINTS[queue[k].id];
      let ok = true;
      try {
        ok = !d.relevant || d.relevant(app);
      } catch {
        ok = true;
      }
      if (!ok) {
        app.progression.markHint(queue[k].id);
        queue.splice(k, 1);
      }
    }
    const i = queue.findIndex((q) => contextOk(HINTS[q.id], q.target));
    if (i === -1) return;
    const [q] = queue.splice(i, 1);
    show(q);
  }

  function show(q) {
    const def = HINTS[q.id];
    shown = { ...q, def };
    const face = def.who === 'joseph' ? spriteAny(['portrait.joseph', 'npc.joseph', 'farmer'], 'sprite--avatar', 'info') : sprite('farmer', 'sprite--avatar');
    bubble.replaceChildren(
      el('div.tuto-avatar', face),
      el(
        'div.tuto-content',
        el('div.tuto-name', def.who === 'joseph' ? 'Joseph' : 'Conseil'),
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
    if (typeof t.rect === 'function') {
      try {
        return t.rect() || null;
      } catch {
        return null;
      }
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
    let bottom = (inMenu ? Math.round(window.visualViewport?.height || innerHeight) : app.safeBottom()) - 8;
    const b = bubble.getBoundingClientRect();
    // Cible dans la feuille et pas de place au-dessus d'elle : la bulle peut passer sur la feuille (sans couvrir la cible).
    if (!inMenu && app.sheets?.isOpen() && inSheet(shown.target) && bottom - top < b.height + 8) {
      bottom = Math.round(window.visualViewport?.height || innerHeight) - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-bottom')) || 0) - 8;
    }
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
    // Une fenêtre (fin de saison…) ou une feuille s'ouvre par-dessus un conseil de partie : il attendra.
    if (!contextOk(shown.def, shown.target)) {
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
