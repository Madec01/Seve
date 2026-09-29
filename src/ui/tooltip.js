// Infobulle unique (élément #tooltip) : survol des éléments [data-tip] de l'interface, et
// infobulles de la scène (parcelles, investissements) placées près du pointeur (souris).
// Au doigt, un toucher sur un élément explicatif (pas un bouton) montre son infobulle 2,6 s.

import { append, clear, el, placeNear } from './dom.js';

export function createTooltip(node) {
  let owner = null; // élément ou 'scene'
  let visible = false;

  function set(content) {
    clear(node);
    if (typeof content === 'string') node.append(el('div.tip-text', content));
    else append(node, [content]);
  }

  function showAt(content, rect, prefer = 'top') {
    set(content);
    node.classList.add('is-visible');
    visible = true;
    placeNear(node, rect, prefer, 8);
  }

  /** Infobulle près d'un point (pointeur), côté droit-bas par défaut. */
  function showAtPoint(content, x, y, who = 'scene') {
    owner = who;
    showAt(content, { left: x, right: x + 14, top: y, bottom: y + 18, width: 14, height: 18 }, 'right');
  }

  function hide(who) {
    if (who && owner !== who) return;
    owner = null;
    if (!visible) return;
    visible = false;
    node.classList.remove('is-visible');
  }

  // Délégation : tout élément portant data-tip (texte) ou _tip (fonction → texte ou nœud).
  function contentOf(target) {
    if (typeof target._tip === 'function') return target._tip();
    if (target._tip) return target._tip;
    return target.dataset.tip || null;
  }

  function onOver(e) {
    const t = e.target.closest?.('[data-tip], .has-tip');
    if (!t || t === owner) return;
    const content = contentOf(t);
    if (!content) return;
    owner = t;
    showAt(content, t.getBoundingClientRect(), t.dataset.tipSide || 'top');
  }

  function onOut(e) {
    if (!owner || owner === 'scene') return;
    const to = e.relatedTarget;
    if (to && owner.contains?.(to)) return;
    hide();
  }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    onOver(e);
  });
  document.addEventListener('pointerout', onOut);
  // Au clavier seulement : un toucher donne aussi le focus, et l'infobulle resterait affichée.
  document.addEventListener('focusin', (e) => {
    if (e.target.matches?.(':focus-visible')) onOver(e);
  });
  document.addEventListener('focusout', () => {
    if (owner && owner !== 'scene') hide();
  });
  document.addEventListener('pointerdown', (e) => {
    if (owner && owner !== 'scene' && !owner.contains?.(e.target)) hide();
  });
  // Au doigt : toucher un élément explicatif (pas un bouton) affiche son infobulle un instant.
  let touchTimer = null;
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const t = e.target.closest?.('[data-tip], .has-tip');
    if (!t || t.closest('button, .btn, a, input')) return;
    const content = contentOf(t);
    if (!content) return;
    owner = t;
    showAt(content, t.getBoundingClientRect(), t.dataset.tipSide || 'top');
    clearTimeout(touchTimer);
    touchTimer = setTimeout(() => hide(t), 2600);
  });

  return {
    showAt,
    showAtPoint,
    hide,
    /** Met à jour l'infobulle affichée pour un élément (si c'est bien lui qui l'a ouverte). */
    refresh(target) {
      if (owner !== target || !visible) return;
      const content = contentOf(target);
      if (!content) return hide();
      showAt(content, target.getBoundingClientRect(), target.dataset.tipSide || 'top');
    },
    get owner() {
      return owner;
    },
  };
}
