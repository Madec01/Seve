// Accompagnement — la bulle de Joseph, sa pastille, le doigt animé et l'anneau doré (docs/ACCOMPAGNEMENT.md § 4.6, § 11).
// Placement repris de l'ancien tutoriel (src/ui/tutorial.js : positionPortrait / positionWide / placePill) :
// téléphone en portrait → bulle pleine largeur, sous la barre du haut ou au-dessus des onglets / de la feuille, du côté
// où elle ne couvre pas sa cible (jamais sur sa cible) ; grand écran → à côté de la cible (placeNear).
//
// createBubble(layer, app) → {
//   show(model), hide(), setText(text), visible, el
//   place(resolved, opts) → 'ok' | 'crowded'   (chaque image ; opts : { inSheet, overDialog, scrollTried })
//   showPill({ title, text, onTap, onLongPress, kind, label }), hidePill(), pillVisible
//   pointAt(resolved, gesture), clearPoint(), nudge(), frame(now)
// }
// model : { title, text, face, label (cible, lecteur d'écran), buttons: [{ id, label, primary, onClick }],
//           skip: { label, onClick } | null, dots: { index, total } | null, onPortrait }

import { el, placeNear, setText as setNodeText } from '../dom.js';
import { hasSprite, sprite } from '../icons.js';
import { joseph } from '../career/util.js';
import { unionRect } from './targets.js';

const FACE_NAMES = { content: 'content', happy: 'happy', proud: 'proud' };
const SWIPE_MS = 1600;
const SWIPE_REST_MS = 600;

function josephFace(face, cls) {
  // Portrait « qui montre du doigt » (planche ART) s'il existe, sinon le portrait de Joseph de la carrière.
  if (face === 'point' && hasSprite('portrait.joseph.point')) return sprite('portrait.joseph.point', cls);
  return joseph(FACE_NAMES[face] || 'content', cls);
}

/** Main du doigt : sprite de la planche ART (coach.hand…) ou repli dessiné en CSS (css/coach.css). */
function handNode(kind = 'hand') {
  const name = kind === 'pinch' ? 'coach.hand.pinch' : kind === 'press' ? 'coach.hand.press' : 'coach.hand';
  if (hasSprite(name)) return sprite(name, 'sprite--coach-hand');
  return el(`span.coach-hand-css${kind === 'pinch' ? '.is-pinch' : ''}`, { 'aria-hidden': 'true' });
}

export function createBubble(layer, app) {
  let uid = 0;
  const titleId = 'coach-title';
  const avatar = el('button.coach-avatar', { type: 'button', 'aria-label': 'Ouvrir le carnet de Joseph' });
  const name = el('div.coach-name', 'Joseph');
  const title = el('div.coach-title', { id: titleId });
  const text = el('p.coach-text');
  const actions = el('div.coach-actions');
  const dots = el('div.coach-dots', { 'aria-hidden': 'true' });
  const live = el('span.sr-only', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const body = el('div.coach-body', name, title, text, actions, dots);
  const bubble = el('div.coach-bubble', { role: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': 'coach-live' }, avatar, body, live);
  live.id = 'coach-live';

  const pillAvatar = el('span.coach-pill-avatar', { 'aria-hidden': 'true' });
  const pillTitle = el('b.coach-pill-title');
  const pillText = el('span.coach-pill-text');
  const pill = el('button.coach-pill', { type: 'button' }, pillAvatar, el('span.coach-pill-body', pillTitle, pillText), el('span.coach-pill-chev', { 'aria-hidden': 'true' }, '›'));

  const hand = el('div.coach-finger', { 'aria-hidden': 'true' });
  const trail = el('div.coach-trail', { 'aria-hidden': 'true' });
  const rings = el('div.coach-rings', { 'aria-hidden': 'true' });
  layer.append(rings, trail, hand, bubble, pill);

  let shown = false;
  let model = null;
  let pillHandlers = null;
  let point = null; // { resolved, gesture, start }
  let uiTarget = null;
  let lastKey = '';

  // ── Bulle ─────────────────────────────────────────────────────────────────────
  function show(m) {
    model = m;
    uid += 1;
    avatar.replaceChildren(josephFace(m.face, 'sprite--avatar'));
    avatar.onclick = () => m.onPortrait?.();
    setNodeText(title, m.title || 'Joseph');
    setNodeText(text, m.text || '');
    actions.replaceChildren(
      ...[
        ...(m.buttons || []).map((b) =>
        el(`button.btn.btn--small${b.primary ? '.btn--red' : ''}`, { type: 'button', id: b.id || null, onclick: (e) => { e.stopPropagation(); b.onClick(); } }, b.label),
      ),
        m.skip ? el('button.coach-skip', { type: 'button', id: 'coach-skip', onclick: (e) => { e.stopPropagation(); m.skip.onClick(); } }, m.skip.label) : null,
      ].filter(Boolean),
    );
    dots.replaceChildren(...(m.dots ? Array.from({ length: m.dots.total }, (_, i) => el(`span.coach-dot${i === m.dots.index ? '.is-on' : i < m.dots.index ? '.is-past' : ''}`)) : []));
    dots.hidden = !m.dots;
    setLive(m);
    if (!shown) {
      bubble.classList.remove('is-visible');
      void bubble.offsetWidth;
    }
    bubble.classList.add('is-visible');
    shown = true;
    lastKey = '';
  }

  function setLive(m) {
    const target = m.label ? ` Cible : ${m.label}.` : '';
    live.textContent = `Joseph : ${m.text || ''}${target}`;
  }

  function setText(t) {
    if (!model) return;
    model.text = t;
    setNodeText(text, t);
    setLive(model);
  }

  function hide() {
    if (bubble.contains(document.activeElement)) document.activeElement.blur();
    bubble.classList.remove('is-visible');
    shown = false;
    model = null;
    lastKey = '';
  }

  /**
   * Place la bulle loin de sa cible. Renvoie 'crowded' si elle ne tient ni au-dessus ni au-dessous sans la couvrir
   * (le moteur fait alors défiler la scène, puis réduit la bulle en pastille).
   */
  function place(resolved, opts = {}) {
    if (!shown) return 'ok';
    const rects = resolved?.rects || [];
    const target = unionRect(rects);
    const key = `${target ? [target.left, target.top, target.width, target.height].map(Math.round).join(',') : 'none'}|${innerWidth}x${innerHeight}|${app.sheets?.current || ''}|${Math.round(app.safeBottom?.() || 0)}|${opts.overDialog ? 1 : 0}|${uid}`;
    if (key === lastKey && !opts.force) return 'ok';
    lastKey = key;
    layer.classList.toggle('is-over-dialog', !!opts.overDialog);
    if (app.isWide?.() && !opts.overDialog) return placeWide(target);
    return placePortrait(target, rects, opts);
  }

  function placePortrait(target, rects, opts) {
    bubble.classList.add('is-docked');
    const vh = Math.round(window.visualViewport?.height || innerHeight);
    const vw = innerWidth;
    const top = (opts.overDialog ? 0 : app.safeTop?.() || 0) + 8;
    let bottom = (opts.overDialog ? vh : app.safeBottom?.() || vh) - 8;
    const b = bubble.getBoundingClientRect();
    const h = b.height;
    const w = b.width;
    // Cible dans la feuille ouverte et pas de place au-dessus d'elle : la bulle peut passer sur la feuille.
    if (opts.inSheet && bottom - top < h + 8) {
      const insetB = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inset-bottom')) || 0;
      bottom = vh - insetB - 8;
    }
    const x = Math.round(Math.max(8, (vw - w) / 2));
    const candidates = [top, bottom - h];
    const covers = (y) => rects.some((r) => !(y + h <= r.top - 6 || y >= r.bottom + 6 || x + w <= r.left || x >= r.right));
    let y = bottom - h;
    let side = 'none';
    let state = 'ok';
    if (target) {
      const free = candidates.filter((c) => !covers(c));
      const inBand = target.bottom > top && target.top < bottom; // cible dans la scène visible (pas une barre)
      const cy = target.top + target.height / 2;
      let pick;
      if (free.length === 2) {
        if (inBand) pick = cy > (top + bottom) / 2 ? free[0] : free[1];
        else pick = Math.abs(free[0] + h / 2 - cy) < Math.abs(free[1] + h / 2 - cy) ? free[0] : free[1];
      } else if (free.length === 1) pick = free[0];
      if (pick === undefined) {
        // Pas de place sans recouvrir : du côté le plus grand, et la scène défilera (ou la bulle se réduira).
        const roomTop = target.top - top;
        const roomBottom = bottom - target.bottom;
        pick = roomTop > roomBottom ? top : bottom - h;
        state = 'crowded';
      } else {
        side = pick + h / 2 < cy ? 'top' : 'bottom';
      }
      y = pick;
    }
    bubble.style.left = `${x}px`;
    bubble.style.top = `${Math.round(y)}px`;
    if (y < top + 80) app.toasts?.hideBanner?.();
    if (target && side !== 'none') {
      const cx = target.left + target.width / 2 - x;
      bubble.style.setProperty('--ax', `${Math.round(Math.max(22, Math.min(w - 22, cx)))}px`);
      bubble.dataset.side = side;
    } else bubble.dataset.side = 'none';
    return state;
  }

  function placeWide(target) {
    bubble.classList.remove('is-docked');
    if (target) {
      const side = placeNear(bubble, target, 'bottom', 18);
      const b = bubble.getBoundingClientRect();
      bubble.style.setProperty('--ax', `${Math.round(Math.max(22, Math.min(b.width - 22, target.left + target.width / 2 - b.left)))}px`);
      bubble.style.setProperty('--ay', `${Math.round(Math.max(22, Math.min(b.height - 22, target.top + target.height / 2 - b.top)))}px`);
      bubble.dataset.side = { bottom: 'bottom', top: 'top', left: 'left', right: 'right' }[side] || 'none';
    } else {
      const stage = app.stageRect?.() || { left: 0, width: innerWidth };
      const r = bubble.getBoundingClientRect();
      bubble.style.left = `${Math.round(stage.left + (stage.width - r.width) / 2)}px`;
      bubble.style.top = `${Math.round((app.safeBottom?.() || innerHeight) - r.height - 16)}px`;
      bubble.dataset.side = 'none';
    }
    return 'ok';
  }

  // ── Pastille (leçon réduite, étape qui attend, Discret, rappel) ──────────────────
  function showPill(p) {
    pillHandlers = p;
    if (!pillAvatar.firstChild) pillAvatar.append(joseph('content', 'sprite--xs'));
    setNodeText(pillTitle, p.title || 'Joseph');
    setNodeText(pillText, p.text || '');
    pill.classList.toggle('is-reminder', p.kind === 'reminder');
    pill.classList.toggle('is-static', !p.onTap);
    pill.setAttribute('aria-label', p.label || `Joseph : ${p.text}${p.onTap ? ' Toucher pour voir.' : ''}`);
    if (!pill.classList.contains('is-visible')) {
      pill.classList.add('is-visible');
      app.toasts?.hideBanner?.();
    }
    placePill(p.avoid || null);
  }
  function hidePill() {
    pillHandlers = null;
    pill.classList.remove('is-visible');
  }
  // Toucher bref : l'action ; appui long : « ne plus me le rappeler » (rappels).
  let pressTimer = null;
  let pressed = false;
  pill.addEventListener('pointerdown', () => {
    pressed = false;
    clearTimeout(pressTimer);
    if (pillHandlers?.onLongPress) {
      pressTimer = setTimeout(() => {
        pressed = true;
        pillHandlers?.onLongPress?.();
      }, 600);
    }
  });
  const cancelPress = () => clearTimeout(pressTimer);
  pill.addEventListener('pointerup', cancelPress);
  pill.addEventListener('pointercancel', cancelPress);
  pill.addEventListener('pointerleave', cancelPress);
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pressed) {
      pressed = false;
      return;
    }
    pillHandlers?.onTap?.();
  });
  pill.addEventListener('contextmenu', (e) => e.preventDefault());

  /** Sous la barre du haut, à gauche (en miroir pour un gaucher) ; en bas si elle couvrirait la cible. */
  function placePill(avoidRects = null) {
    const left = document.documentElement.classList.contains('left-handed');
    const top = (app.safeTop?.() || 0) + 8;
    pill.style.left = left ? 'auto' : '8px';
    pill.style.right = left ? '8px' : 'auto';
    pill.style.top = `${Math.round(top)}px`;
    const rects = avoidRects || point?.resolved?.rects || [];
    if (rects.length) {
      const p = pill.getBoundingClientRect();
      const covers = rects.some((r) => p.left < r.right && p.right > r.left && p.top < r.bottom && p.bottom > r.top);
      if (covers) pill.style.top = `${Math.round(Math.max(top, (app.safeBottom?.() || innerHeight) - p.height - 8))}px`;
    }
  }

  // ── Doigt et anneau ───────────────────────────────────────────────────────────
  function pointAt(resolved, gesture) {
    const kind = gesture || 'look';
    const prev = point;
    point = { resolved, gesture: kind, start: prev && prev.gesture === kind ? prev.start : performance.now() };
    if (!prev || prev.gesture !== kind) {
      hand.replaceChildren(kind === 'look' || kind === 'pinch' ? '' : handNode(kind));
      if (kind === 'pinch') hand.replaceChildren(handNode('pinch'), handNode('pinch'));
      hand.className = `coach-finger is-${kind}`;
    }
    // Liseré clair + sombre sur l'élément d'interface visé.
    const elt = resolved?.el || null;
    if (elt !== uiTarget) {
      uiTarget?.classList.remove('coach-target');
      uiTarget = elt;
      uiTarget?.classList.add('coach-target');
    }
  }

  function clearPoint() {
    point = null;
    hand.className = 'coach-finger';
    hand.replaceChildren();
    trail.className = 'coach-trail';
    rings.replaceChildren();
    uiTarget?.classList.remove('coach-target');
    uiTarget = null;
  }

  /** Patience : le doigt rejoue son geste (« Comme ça ! »). */
  function nudge() {
    if (!point) return;
    point.start = performance.now();
    hand.classList.remove('is-nudge');
    void hand.offsetWidth;
    hand.classList.add('is-nudge');
  }

  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  function paintRings(rects, covered) {
    const n = rings.children.length;
    for (let i = n; i < rects.length; i++) rings.append(el('span.coach-ring'));
    for (let i = rects.length; i < rings.children.length; i++) rings.children[i].hidden = true;
    rects.forEach((r, i) => {
      const s = rings.children[i];
      s.hidden = !!covered?.(r);
      const pad = 3;
      s.style.left = `${Math.round(r.left - pad)}px`;
      s.style.top = `${Math.round(r.top - pad)}px`;
      s.style.width = `${Math.round(r.width + pad * 2)}px`;
      s.style.height = `${Math.round(r.height + pad * 2)}px`;
    });
  }

  /** À chaque image : anneaux et doigt suivent la cible (zoom, défilement, feuille). */
  function frame(now = performance.now(), { covered = null, hidden = false } = {}) {
    if (!point || hidden || !point.resolved) {
      hand.style.visibility = 'hidden';
      trail.style.visibility = 'hidden';
      rings.style.visibility = 'hidden';
      return;
    }
    rings.style.visibility = '';
    const rects = point.resolved.rects || [];
    // Une cible de l'interface a déjà son liseré (.coach-target) : l'anneau ne double que la scène.
    paintRings(point.resolved.kind === 'ui' && point.resolved.el ? [] : point.resolved.center ? [] : rects, covered);
    const g = point.gesture;
    if (g === 'look' || !rects.length) {
      hand.style.visibility = 'hidden';
      trail.style.visibility = 'hidden';
      return;
    }
    const reduced = !!app.reducedMotion?.();
    const visibleRects = rects.filter((r) => !covered?.(r));
    if (!visibleRects.length) {
      hand.style.visibility = 'hidden';
      trail.style.visibility = 'hidden';
      return;
    }
    hand.style.visibility = 'visible';
    let p = centerOf(visibleRects[0]);
    if (g === 'swipe' && visibleRects.length > 1) {
      const pts = visibleRects.map(centerOf);
      if (reduced) {
        // Mouvement réduit : doigt posé sur la première parcelle, pointillés jusqu'à la dernière.
        const a = pts[0];
        const z = pts[pts.length - 1];
        trail.style.visibility = 'visible';
        trail.className = 'coach-trail is-on';
        trail.style.left = `${Math.round(a.x)}px`;
        trail.style.top = `${Math.round(a.y)}px`;
        trail.style.width = `${Math.round(Math.hypot(z.x - a.x, z.y - a.y))}px`;
        trail.style.transform = `rotate(${Math.atan2(z.y - a.y, z.x - a.x)}rad)`;
      } else {
        trail.style.visibility = 'hidden';
        const t = ((now - point.start) % (SWIPE_MS + SWIPE_REST_MS)) / SWIPE_MS;
        const k = Math.min(1, t) * (pts.length - 1);
        const i = Math.min(pts.length - 2, Math.floor(k));
        const f = k - i;
        p = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
        hand.classList.toggle('is-down', t <= 1);
      }
    } else trail.style.visibility = 'hidden';
    hand.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  }

  return {
    show,
    hide,
    setText,
    place,
    showPill,
    hidePill,
    placePill,
    pointAt,
    clearPoint,
    nudge,
    frame,
    get visible() {
      return shown;
    },
    get pillVisible() {
      return pill.classList.contains('is-visible');
    },
    get height() {
      return shown ? bubble.getBoundingClientRect().height : 0;
    },
    el: bubble,
    pill,
  };
}
