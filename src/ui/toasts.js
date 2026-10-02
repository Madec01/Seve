// Messages temporaires (toasts) et grand bandeau (changement de saison, avertissements).
//
// createToasts(stack, bannerNode) → { show(opts), banner(opts), hideBanner(), clearAll(), trim(), setLogger(fn) }
// Historique (lot 1 « confort », A9) : chaque message montré (et chaque bandeau) est aussi passé au
// journal des messages (`setLogger(fn)`, src/ui/messages.js), sauf `log: false` (refus d'une action :
// « Il manque 12 pièces »…). Les messages importants (alerte, gel, action à toucher, succès) restent au
// moins 5 secondes à l'écran.

import { el, clear, typo } from './dom.js';
import { icon } from './icons.js';

const KIND_ICON = { info: 'info', error: 'lock', success: 'star', warn: 'bill', money: 'coin', frost: 'winter', rot: 'rain' };

export function createToasts(stack, bannerNode) {
  const recent = new Map(); // texte → { node, timer }
  let bannerTimer = null;
  let logger = null;

  /** Durée d'affichage : au moins 5 s pour ce qui compte (alerte, action à toucher, succès). */
  function durationOf(o, kind) {
    const d = o.duration || 3200;
    const important = !!o.onClick || ['warn', 'frost', 'rot', 'achievement'].includes(kind) || (kind === 'error' && o.log !== false);
    return important ? Math.max(5000, d) : d;
  }

  function log(o, kind, updated = false) {
    if (!logger || o.log === false) return;
    try {
      logger({ kind, title: o.title || '', text: o.text || '', key: o.key || null, onClick: o.onClick || null, updated });
    } catch (err) {
      console.warn('Journal des messages :', err);
    }
  }

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
   * @param opts { text, title?, kind = 'info', icon?, sprite? (nœud), duration = 3200, onClick?, key? }
   *   key : un message déjà affiché avec la même clé est mis à jour (titre, texte) au lieu d'en
   *         empiler un nouveau (ex. remboursements successifs du voisin).
   */
  function show(opts) {
    const o = typeof opts === 'string' ? { text: opts } : opts;
    const kind = o.kind || 'info';
    const key = o.key ? `key|${o.key}` : `${kind}|${o.title || ''}|${o.text}`;
    const prev = recent.get(key);
    const duration = durationOf(o, kind);
    if (prev && prev.node.isConnected && !prev.node.classList.contains('is-leaving')) {
      if (o.key) log(o, kind, true);
      if (o.key) {
        const t = prev.node.querySelector('.toast-text');
        if (t) t.textContent = typo(o.text);
        const h = prev.node.querySelector('.toast-title');
        if (h && o.title) h.textContent = typo(o.title);
      }
      clearTimeout(prev.timer);
      prev.node.classList.remove('is-bump');
      void prev.node.offsetWidth; // relance l'animation
      prev.node.classList.add('is-bump');
      prev.timer = setTimeout(() => dismiss(prev.node), duration);
      clearTimeout(prev.forget);
      prev.forget = setTimeout(() => {
        if (recent.get(key) === prev) recent.delete(key);
      }, duration + 400);
      return prev.node;
    }
    log(o, kind);
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
    const entry = { node, timer: setTimeout(() => dismiss(node), duration) };
    recent.set(key, entry);
    entry.forget = setTimeout(() => {
      if (recent.get(key) === entry) recent.delete(key);
    }, duration + 400);
    return node;
  }

  /**
   * Grand bandeau en haut de la scène.
   * @param opts { title, text?, kind = 'season' | 'warn' | 'frost', icon?, duration = 4200 }
   */
  function banner(opts) {
    if (logger && opts.log !== false) {
      try {
        logger({ kind: opts.kind === 'frost' ? 'frost' : opts.kind === 'warn' ? 'warn' : 'season', title: opts.title || '', text: opts.text || '', key: null, onClick: null, banner: true });
      } catch (err) {
        console.warn('Journal des messages :', err);
      }
    }
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

  /** Tout effacer (changement de partie) : messages, et aussi le TEXTE du bandeau (pas seulement caché :
   *  « Hiver · Fermage de l'hiver » d'une partie de niveau restait dans le DOM au lancement d'une carrière). */
  function clearAll() {
    for (const n of [...stack.children]) n.remove();
    recent.clear();
    clearTimeout(bannerTimer);
    bannerNode.classList.remove('is-visible');
    clear(bannerNode);
  }

  return {
    show,
    banner,
    hideBanner,
    clearAll,
    trim,
    /** fn({ kind, title, text, key, onClick, updated, banner }) : appelé pour chaque message montré. */
    setLogger(fn) {
      logger = typeof fn === 'function' ? fn : null;
    },
  };
}
