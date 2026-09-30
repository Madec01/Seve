// Messages temporaires (toasts) et grand bandeau (changement de saison, avertissements).

import { el, clear } from './dom.js';
import { icon } from './icons.js';

const KIND_ICON = { info: 'info', error: 'lock', success: 'star', warn: 'bill', money: 'coin', frost: 'winter', rot: 'rain' };

export function createToasts(stack, bannerNode) {
  const recent = new Map(); // texte → { node, timer }
  let bannerTimer = null;

  function dismiss(node) {
    if (!node.isConnected || node.classList.contains('is-leaving')) return;
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 260);
  }

  /** Efface les plus anciens messages qui passeraient sous la barre du haut (le plus récent reste). */
  function trim() {
    const limit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top')) || 0;
    const live = [...stack.children].filter((n) => !n.classList.contains('is-leaving'));
    for (const n of live.slice(1)) if (n.getBoundingClientRect().top < limit + 2) dismiss(n);
  }

  /**
   * @param opts { text, title?, kind = 'info', icon?, sprite? (nœud), duration = 3200, onClick? }
   */
  function show(opts) {
    const o = typeof opts === 'string' ? { text: opts } : opts;
    const kind = o.kind || 'info';
    const key = `${kind}|${o.title || ''}|${o.text}`;
    const prev = recent.get(key);
    if (prev && prev.node.isConnected && !prev.node.classList.contains('is-leaving')) {
      clearTimeout(prev.timer);
      prev.node.classList.remove('is-bump');
      void prev.node.offsetWidth; // relance l'animation
      prev.node.classList.add('is-bump');
      prev.timer = setTimeout(() => dismiss(prev.node), o.duration || 3200);
      return prev.node;
    }
    const node = el(
      `div.toast.toast--${kind}`,
      { role: kind === 'error' ? 'alert' : 'status' },
      o.sprite || icon(o.icon || KIND_ICON[kind] || 'info', 'md'),
      el('div.toast-body', o.title ? el('strong.toast-title', o.title) : null, el('span.toast-text', o.text)),
    );
    node.addEventListener('click', () => {
      dismiss(node);
      o.onClick?.();
    });
    if (o.onClick) node.classList.add('is-action');
    stack.prepend(node);
    // Pas plus de 4 messages à la fois.
    const items = [...stack.children].filter((n) => !n.classList.contains('is-leaving'));
    for (const extra of items.slice(4)) dismiss(extra);
    // Place limitée (feuille haute ouverte) : les plus anciens qui passeraient sous la barre du
    // haut s'effacent (le plus récent reste toujours).
    // (vérifié deux fois : tout de suite, puis une fois l'animation d'entrée finie)
    requestAnimationFrame(trim);
    setTimeout(trim, 320);
    const entry = { node, timer: setTimeout(() => dismiss(node), o.duration || 3200) };
    recent.set(key, entry);
    setTimeout(() => {
      if (recent.get(key) === entry) recent.delete(key);
    }, (o.duration || 3200) + 400);
    return node;
  }

  /**
   * Grand bandeau en haut de la scène.
   * @param opts { title, text?, kind = 'season' | 'warn' | 'frost', icon?, duration = 4200 }
   */
  function banner(opts) {
    clearTimeout(bannerTimer);
    clear(bannerNode);
    bannerNode.className = `banner banner--${opts.kind || 'season'}`;
    bannerNode.append(
      el(
        'div.banner-ribbon',
        opts.icon ? icon(opts.icon, 'lg') : null,
        el('div.banner-titles', el('div.banner-title', opts.title), opts.text ? el('div.banner-text', opts.text) : null),
        opts.icon ? icon(opts.icon, 'lg') : null,
      ),
    );
    void bannerNode.offsetWidth;
    bannerNode.classList.add('is-visible');
    bannerTimer = setTimeout(() => bannerNode.classList.remove('is-visible'), opts.duration || 4200);
    bannerNode.onclick = () => bannerNode.classList.remove('is-visible');
  }

  /** Cache le bandeau tout de suite (ex. une bulle du tutoriel prend sa place en haut). */
  function hideBanner() {
    clearTimeout(bannerTimer);
    bannerNode.classList.remove('is-visible');
  }

  function clearAll() {
    for (const n of [...stack.children]) n.remove();
    recent.clear();
    clearTimeout(bannerTimer);
    bannerNode.classList.remove('is-visible');
  }

  return { show, banner, hideBanner, clearAll, trim };
}
