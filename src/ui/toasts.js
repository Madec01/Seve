// Messages temporaires (toasts) et grand bandeau (changement de saison, avertissements).
//
// createToasts(stack, bannerNode) → { show(opts), banner(opts), hideBanner(), clearAll(), trim(), setLogger(fn),
//                                     setMoreHandler(fn) }
// Historique (lot 1 « confort », A9) : chaque message montré (et chaque bandeau) est aussi passé au
// journal des messages (`setLogger(fn)`, src/ui/messages.js), sauf `log: false` (refus d'une action :
// « Il manque 12 pièces »…). Les messages importants (alerte, gel, action à toucher, succès) restent au
// moins 5 secondes à l'écran.
// Téléphone (QA du lot 3) : au plus DEUX messages à la fois (MAX_VISIBLE). Quand d'autres arrivent en même temps
// (début de saison en carrière : comice, Joseph, charrette, abri plein…), les plus anciens — d'abord ceux qui ne
// proposent rien — s'effacent ; ils restent dans l'historique, et une pastille « +2 » (≥ 48 px) au-dessus des
// messages ouvre la feuille « Messages » (`setMoreHandler(fn)`). Les messages ne captent JAMAIS les touchers :
// seul le bouton d'un message qui propose une action (« Voir », `actionLabel`) et la pastille « +N » se touchent.
//
// Tri des messages (2026-10-03, retour joueur : « les notifs prennent beaucoup de place, on en reçoit beaucoup ») :
// chaque message est « important » (à lire maintenant : danger, refus, choix à faire, réponse à un geste) ou « info »
// (peut attendre). Réglage « Messages » (setMode) : 'all' (tous affichés), 'important' (par défaut : les infos vont
// directement dans l'historique et le résumé du matin, regroupées) ou 'none' (seuls les refus et les messages du
// système s'affichent). Rien n'est perdu : l'historique (cloche), la ligne « À faire » et le résumé du matin gardent
// tout. Classement (priorityOf) : `o.prio` ('important' | 'info' | 'always') s'il est donné ; sinon important si le
// message propose une action (onClick), reste touchable (keepTouch), est un refus (`log: false`) ou une alerte
// (error, warn, frost) ; info pour le reste (info, money, success, achievement, rot).
// Un message non affiché passe au journal (setLogger, `quiet: true`) et au résumé du matin (setDigest :
// `o.digest` = 'vente|ventes' regroupe les répétitions, « 3 ventes »). show() renvoie alors null.

import { el, clear, typo } from './dom.js';
import { icon } from './icons.js';

const KIND_ICON = { info: 'info', error: 'lock', success: 'star', warn: 'bill', money: 'coin', frost: 'winter', rot: 'rain' };
/** Messages visibles en même temps (les autres passent dans l'historique, pastille « +N »). */
export const MAX_VISIBLE = 2;
/** Durée de la pastille « +N » après le dernier message effacé faute de place. */
const MORE_MS = 7000;
/** Réglage « Messages » : tous · importants seulement (par défaut) · aucun (refus et système seulement). */
export const MESSAGE_MODES = Object.freeze(['all', 'important', 'none']);

/** 'always' (refus, système) · 'important' (à lire maintenant) · 'info' (peut attendre). */
export function priorityOf(o, kind = o.kind || 'info') {
  if (o.prio === 'always' || o.prio === 'important' || o.prio === 'info') return o.prio;
  if (o.keepTouch) return 'always';
  if (o.log === false && (kind === 'error' || o.onClick)) return 'always';
  if (o.onClick || o.log === false || ['error', 'warn', 'frost'].includes(kind)) return 'important';
  return 'info';
}

/** Le message s'affiche-t-il avec ce réglage ? */
export function visibleIn(mode, prio) {
  if (prio === 'always') return true;
  if (mode === 'all') return true;
  if (mode === 'none') return false;
  return prio === 'important';
}

export function createToasts(stack, bannerNode) {
  const recent = new Map(); // texte → { node, timer }
  let bannerTimer = null;
  let logger = null;
  let digester = null;
  let mode = 'important';
  let modeActive = () => true; // le tri ne s'applique que pendant une partie (menu : tout s'affiche)
  let quietCount = 0;
  let moreHandler = null;
  let hidden = 0; // messages effacés faute de place depuis que la pastille est apparue
  let moreTimer = null;
  const moreCount = el('b.toast-more-n', '');
  const moreText = el('span.toast-more-text', 'messages');
  const more = el(
    'button.btn.btn--small.toast-more',
    {
      type: 'button',
      id: 'toast-more',
      hidden: true,
      onclick: () => {
        hideMore();
        try {
          moreHandler?.();
        } catch (err) {
          console.warn('Messages :', err);
        }
      },
    },
    moreCount,
    moreText,
  );

  function hideMore() {
    hidden = 0;
    clearTimeout(moreTimer);
    more.hidden = true;
    more.remove();
  }

  function showMore(n) {
    hidden += n;
    moreCount.textContent = `+${hidden}`;
    moreText.textContent = hidden > 1 ? 'messages' : 'message';
    more.setAttribute('aria-label', `${hidden} autre${hidden > 1 ? 's' : ''} message${hidden > 1 ? 's' : ''} : voir l'historique`);
    more.hidden = false;
    stack.append(more); // en haut de la pile (column-reverse : le dernier enfant est le plus haut)
    clearTimeout(moreTimer);
    moreTimer = setTimeout(hideMore, MORE_MS);
  }

  const isImportant = (n) => n.dataset.important === '1';
  const liveToasts = () => [...stack.children].filter((n) => n.classList.contains('toast') && !n.classList.contains('is-leaving'));

  /** Durée d'affichage : 5 s pour ce qui compte (alerte, action à toucher), 3 s pour une info (7 s au plus). */
  function durationOf(o, kind, prio) {
    const d = Math.min(7000, o.duration || 3000);
    const important = prio !== 'info' && (!!o.onClick || ['warn', 'frost', 'rot', 'achievement'].includes(kind) || (kind === 'error' && o.log !== false));
    return important ? Math.max(5000, d) : prio === 'info' ? Math.min(d, 4200) : d;
  }

  function log(o, kind, updated = false, quiet = false) {
    if (!logger || o.log === false) return;
    try {
      logger({ kind, title: o.title || '', text: o.text || '', key: o.key || null, onClick: o.onClick || null, updated, quiet });
    } catch (err) {
      console.warn('Journal des messages :', err);
    }
  }

  function dismiss(node) {
    if (!node.isConnected || node.classList.contains('is-leaving')) return;
    node.classList.add('is-leaving');
    setTimeout(() => {
      node.remove();
      // Plus aucun message : la pastille n'a plus de sens au-dessus du vide… sauf si elle vient d'apparaître.
      if (!liveToasts().length && !more.hidden && hidden > 0) {
        clearTimeout(moreTimer);
        moreTimer = setTimeout(hideMore, 2500);
      }
    }, 260);
  }

  /** Efface les plus anciens messages qui passeraient sous la barre du haut (le plus récent reste). */
  function trim() {
    const limit = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-top')) || 0;
    if (!more.hidden && more.getBoundingClientRect().top < limit + 2) hideMore();
    const live = liveToasts();
    for (const n of live.slice(1)) if (n.getBoundingClientRect().top < limit + 2) dismiss(n);
  }

  /**
   * @param opts { text, title?, kind = 'info', icon?, sprite? (nœud), duration = 3000, onClick?, actionLabel = 'Voir', key?,
   *               prio? ('important' | 'info' | 'always'), digest? ('vente|ventes'), digestN? }
   *   onClick : le message porte un bouton (actionLabel) ; seul ce bouton se touche (le reste laisse passer le doigt).
   *   key : un message déjà affiché avec la même clé est mis à jour (titre, texte) au lieu d'en
   *         empiler un nouveau (ex. remboursements successifs du voisin).
   */
  function show(opts) {
    const o = typeof opts === 'string' ? { text: opts } : opts;
    const kind = o.kind || 'info';
    const prio = priorityOf(o, kind);
    // Réglage « Messages » : une info (ou tout message en « aucun ») va directement à l'historique et au résumé du matin.
    if (!visibleIn(modeActive() ? mode : 'all', prio)) {
      quietCount += 1;
      log(o, kind, false, true);
      if (digester && o.log !== false) {
        try {
          digester({ kind, prio, title: o.title || '', text: o.text || '', digest: o.digest || null, n: o.digestN || 1 });
        } catch (err) {
          console.warn('Résumé des messages :', err);
        }
      }
      return null;
    }
    const key = o.key ? `key|${o.key}` : `${kind}|${o.title || ''}|${o.text}`;
    const prev = recent.get(key);
    const duration = durationOf(o, kind, prio);
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
    const go = o.onClick
      ? el(
          'button.btn.btn--small.btn--red.toast-go',
          {
            type: 'button',
            'aria-label': `${o.actionLabel || 'Voir'} : ${o.title || o.text}`,
            onclick: (e) => {
              e.stopPropagation();
              dismiss(node);
              try {
                o.onClick();
              } catch (err) {
                console.warn('Message :', err);
              }
            },
          },
          o.actionLabel || 'Voir',
        )
      : null;
    const node = el(
      `div.toast.toast--${kind}`,
      { role: kind === 'error' ? 'alert' : 'status' },
      o.sprite || icon(o.icon || KIND_ICON[kind] || 'info', 'md'),
      el('div.toast-body', o.title ? el('strong.toast-title', o.title) : null, el('span.toast-text', o.text)),
      go,
    );
    if (o.onClick) node.classList.add('is-action');
    node.dataset.prio = prio; // info : une ligne ; important : deux lignes au plus (style.css)
    if (o.keepTouch) node.classList.add('is-sticky'); // reste touchable même sur une feuille haute (mise à jour)
    if (duration >= 5000) node.dataset.important = '1';
    stack.prepend(node);
    // Au plus MAX_VISIBLE messages : on efface d'abord les plus anciens qui ne proposent rien d'important
    // (ils restent dans l'historique ; la pastille « +N » y mène).
    const items = liveToasts();
    let extra = items.length - MAX_VISIBLE;
    if (extra > 0) {
      const older = items.slice(1).reverse(); // du plus ancien au plus récent (le nouveau reste toujours)
      const victims = [...older.filter((n) => !isImportant(n)), ...older.filter(isImportant)].slice(0, extra);
      for (const v of victims) dismiss(v);
      extra = victims.length;
      showMore(extra);
    }
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
    hideMore();
    recent.clear();
    clearTimeout(bannerTimer);
    bannerNode.classList.remove('is-visible');
    clear(bannerNode);
  }

  return {
    show,
    /** Retire un message affiché (nœud renvoyé par show) : ex. l'annonce d'une fête quand on entre dans la fête. */
    hide(node) {
      if (node && node.nodeType === 1) dismiss(node);
    },
    banner,
    hideBanner,
    clearAll,
    trim,
    /** fn({ kind, title, text, key, onClick, updated, banner }) : appelé pour chaque message montré. */
    setLogger(fn) {
      logger = typeof fn === 'function' ? fn : null;
    },
    /** Réglage « Messages » ('all' | 'important' | 'none') ; active() : vrai pendant une partie (sinon tout s'affiche). */
    setMode(m, { active } = {}) {
      mode = MESSAGE_MODES.includes(m) ? m : 'important';
      if (typeof active === 'function') modeActive = active;
    },
    get mode() {
      return mode;
    },
    /** fn({ kind, prio, title, text, digest, n }) : message non affiché (résumé du matin, src/ui/todo.js). */
    setDigest(fn) {
      digester = typeof fn === 'function' ? fn : null;
    },
    /** fn() : la pastille « +N » est touchée (ouvre l'historique des messages). */
    setMoreHandler(fn) {
      moreHandler = typeof fn === 'function' ? fn : null;
    },
    /** Nombre de messages visibles, et de messages passés dans l'historique faute de place (mesures, tests). */
    stats: () => ({ visible: liveToasts().length, hidden: more.hidden ? 0 : hidden, quiet: quietCount, mode }),
  };
}
