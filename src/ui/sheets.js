// Feuilles du bas (« bottom sheets ») : achats, bilan, choix des graines, fiches d'une parcelle,
// d'un bâtiment ou d'une information de la barre du haut.
//
// createSheets(layer, app) → { open(opts), close(reason), isOpen(id?), current, body, refit() }
//
// Une seule feuille à la fois : en ouvrir une autre remplace la précédente. Fermeture par le ✕,
// par un glissement vers le bas (poignée, en-tête, ou contenu déjà tout en haut), par un toucher
// sur le fond (la scène), ou par Échap. Sur grand écran en paysage (body.layout-wide), les feuilles
// « panneau » (achats, bilan) se rangent à droite, sans fond, et la scène reste utilisable.
//
// opts : { id, title, icon (nœud), content (nœud), kind: 'panel' | 'popup', tall: bool,
//          onClose(reason), className, pauses: bool (false : jamais de pause de lecture),
//          outsideClose: bool (false : un toucher sur la scène ne ferme pas la feuille) }
//
// Pause pendant la lecture (option d'accessibilité, activée par défaut en Détente) : tant qu'une
// feuille est ouverte, le temps s'arrête (raison de pause « sheet », qui s'ajoute aux autres :
// fenêtres, tutoriel, onglet caché…). Pas sur grand écran pour les panneaux rangés à droite (la
// scène reste jouable à côté). Toucher le bouton de vitesse lève cette pause (releasePause) jusqu'à
// la fermeture de la feuille.

import { clear, el } from './dom.js';
import { icon } from './icons.js';
import { pauseOnSheetActive } from './a11y.js';
import { SIGNALS } from './coach/signals.js';

/**
 * Glisser vers le bas pour fermer. `grab` : zones qui démarrent toujours le glissement (poignée,
 * en-tête) ; `scroller` : zone défilante qui ne le démarre que si elle est tout en haut.
 * @returns {() => void} fonction de nettoyage
 */
export function swipeToClose(box, { grab = [], scroller = null, onClose, canClose = () => true }) {
  let start = null; // { y, t, dy }
  const THRESHOLD = 90;

  const begin = (y) => {
    start = { y, t: performance.now(), dy: 0, moved: false };
    box.style.transition = 'none';
  };
  const move = (y) => {
    if (!start) return false;
    const dy = Math.max(0, y - start.y);
    start.dy = dy;
    if (dy > 4) start.moved = true;
    box.style.transform = dy ? `translateY(${Math.round(dy)}px)` : '';
    return start.moved;
  };
  const end = () => {
    if (!start) return;
    const { dy, t } = start;
    const v = dy / Math.max(1, performance.now() - t); // px/ms
    start = null;
    box.style.transition = '';
    if (canClose() && (dy > THRESHOLD || (dy > 30 && v > 0.6))) {
      box.style.transform = '';
      onClose('swipe');
    } else {
      box.style.transform = '';
    }
  };

  // Poignée / en-tête : événements de pointeur (souris et doigt), sans défilement du navigateur.
  const offs = [];
  for (const g of grab) {
    if (!g) continue;
    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return; // le ✕ reste un bouton
      begin(e.clientY);
      try {
        g.setPointerCapture(e.pointerId);
      } catch {
        /* rien */
      }
    };
    const mv = (e) => move(e.clientY);
    const up = () => end();
    g.addEventListener('pointerdown', down);
    g.addEventListener('pointermove', mv);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
    offs.push(() => {
      g.removeEventListener('pointerdown', down);
      g.removeEventListener('pointermove', mv);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
    });
  }

  // Contenu défilant : seulement quand il est déjà tout en haut et que le doigt descend.
  if (scroller) {
    let sy = null;
    let dragging = false;
    const ts = (e) => {
      if (e.touches.length !== 1) return;
      sy = e.touches[0].clientY;
      dragging = false;
    };
    const tm = (e) => {
      if (sy === null) return;
      const y = e.touches[0].clientY;
      if (!dragging) {
        if (scroller.scrollTop <= 0 && y - sy > 8) {
          dragging = true;
          begin(sy);
        } else if (Math.abs(y - sy) > 8) {
          sy = null; // défilement normal du contenu
          return;
        }
      }
      if (dragging) {
        e.preventDefault();
        move(y);
      }
    };
    const te = () => {
      if (dragging) end();
      sy = null;
      dragging = false;
    };
    scroller.addEventListener('touchstart', ts, { passive: true });
    scroller.addEventListener('touchmove', tm, { passive: false });
    scroller.addEventListener('touchend', te);
    scroller.addEventListener('touchcancel', te);
    offs.push(() => {
      scroller.removeEventListener('touchstart', ts);
      scroller.removeEventListener('touchmove', tm);
      scroller.removeEventListener('touchend', te);
      scroller.removeEventListener('touchcancel', te);
    });
  }
  return () => offs.forEach((f) => f());
}

export function createSheets(layer, app) {
  let current = null; // { id, opts }
  let closeTimer = null;
  let paused = false; // raison de pause « sheet » posée par cette feuille
  let released = false; // le joueur a relancé le temps, feuille ouverte
  let openCount = 0; // (Vallée V3) nombre d'ouvertures : une seule bulle de conseil par ouverture (src/ui/hints.js)

  function syncPause() {
    const want = !!current && !released && current.opts.pauses !== false && pauseOnSheetActive(app) && !(current.opts.kind === 'panel' && document.body.classList.contains('layout-wide'));
    if (want && !paused) {
      paused = true;
      app.pushPause?.('sheet');
    } else if (!want && paused) {
      paused = false;
      app.popPause?.('sheet');
    }
  }

  const backdrop = el('div.sheet-backdrop', { 'aria-hidden': 'true' });
  // Poignée : zone de glissement (pas un bouton : le ✕ et Échap ferment la feuille).
  const grabBar = el('div.sheet-grab', { 'aria-hidden': 'true' }, el('span.sheet-grab-bar'));
  const headIcon = el('span.sheet-icon');
  const title = el('h2.sheet-title', { id: 'sheet-title' });
  const closeBtn = el('button.sheet-x', { type: 'button', 'aria-label': 'Fermer', id: 'sheet-close', onclick: () => close('button') }, icon('close', 'md'));
  const head = el('header.sheet-head', headIcon, title, closeBtn);
  const body = el('div.sheet-body');
  const box = el('section.sheet', { role: 'dialog', 'aria-labelledby': 'sheet-title', id: 'sheet' }, grabBar, head, body);
  layer.append(backdrop, box);

  // Toucher le fond (la scène au-dessus de la feuille) : la feuille se ferme, et ce toucher ne
  // fait rien d'autre (pas de plantation ou d'arrosage involontaire).
  backdrop.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Fenêtre à lire jusqu'au bout (boîte de Joseph, récits) : un toucher dehors ne la ferme pas, la feuille
    // tressaille pour montrer son bouton (✕, glissement et Échap restent).
    if (current?.opts.outsideClose === false) {
      box.classList.remove('is-nudge');
      void box.offsetWidth;
      box.classList.add('is-nudge');
      return;
    }
    close('outside');
  });

  swipeToClose(box, { grab: [grabBar, head], scroller: body, onClose: (r) => close(r) });

  // Hauteur de la feuille ouverte : les messages (toasts) se placent au-dessus.
  const ro = new ResizeObserver(() => publishHeight());
  ro.observe(box);
  function publishHeight() {
    const open = !!current && !document.body.classList.contains('layout-wide');
    const h = open ? Math.round(box.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--sheet-h', `${h}px`);
    app.onSheetChange?.();
  }

  function open(opts) {
    clearTimeout(closeTimer);
    const replacing = !!current;
    if (replacing && current.opts.onClose) {
      const prev = current.opts;
      current = null;
      prev.onClose('replace');
    }
    current = { id: opts.id, opts };
    openCount += 1;
    clear(headIcon);
    if (opts.icon) headIcon.append(opts.icon);
    title.textContent = opts.title || '';
    clear(body);
    if (opts.content) body.append(opts.content);
    body.scrollTop = 0;
    box.className = `sheet sheet--${opts.kind || 'popup'}${opts.tall ? ' is-tall' : ''}${opts.className ? ` ${opts.className}` : ''}`;
    box.dataset.sheet = opts.id;
    layer.classList.add('is-open');
    layer.classList.toggle('is-panel', opts.kind === 'panel');
    document.body.classList.add('has-sheet');
    document.body.classList.toggle('has-tall-sheet', !!opts.tall);
    document.body.dataset.sheet = opts.id;
    if (!replacing) app.audio.play('open', { volume: 0.7 });
    box.style.transform = '';
    const opened = current;
    requestAnimationFrame(() => {
      // Fermée (ou remplacée) entre-temps, par exemple par une fenêtre « Nouveau rang ! » : ne pas
      // réafficher une feuille vide (bug [42] de l'analyse).
      if (current !== opened) return;
      box.classList.add('is-visible');
      publishHeight();
    });
    app.tooltip?.hide();
    if (!replacing) released = false;
    syncPause();
    app.coach?.signal?.(SIGNALS.sheetOpen, { id: opts.id });
    app.coach?.signal?.(SIGNALS.sheetShown, { id: opts.id, by: opts.by || null });
    return { body, close };
  }

  function close(reason = 'close') {
    if (!current) return;
    const { opts } = current;
    current = null;
    box.classList.remove('is-visible');
    layer.classList.remove('is-open', 'is-panel');
    document.body.classList.remove('has-sheet', 'has-tall-sheet');
    delete document.body.dataset.sheet;
    if (reason !== 'silent') app.audio.play('close', { volume: 0.6 });
    closeTimer = setTimeout(() => {
      if (!current) clear(body);
    }, 260);
    released = false;
    syncPause();
    opts.onClose?.(reason);
    publishHeight();
    app.coach?.signal?.(SIGNALS.sheetClose, { id: opts.id || null, reason });
  }

  /** Le joueur relance le temps feuille ouverte : la pause de lecture est levée. true si elle l'était. */
  function releasePause() {
    if (!paused) return false;
    released = true;
    syncPause();
    return true;
  }

  function isOpen(id) {
    if (!current) return false;
    return id ? current.id === id : true;
  }

  return {
    open,
    close,
    isOpen,
    body,
    box,
    get current() {
      return current ? current.id : null;
    },
    /** Nombre d'ouvertures de feuille depuis le début (chaque ouverture, remplacement compris). */
    get openCount() {
      return openCount;
    },
    /** Remplace le contenu de la feuille ouverte (sans l'animation d'ouverture). */
    setContent(node, keepScroll = true) {
      if (!current) return;
      const top = body.scrollTop;
      clear(body);
      body.append(node);
      if (keepScroll) body.scrollTop = top;
    },
    setTitle(t) {
      title.textContent = t;
    },
    refit: publishHeight,
    releasePause,
    /** Réglage changé (options) : pose ou lève la pause de lecture de la feuille ouverte. */
    syncPause,
    isPausing: () => paused,
  };
}
