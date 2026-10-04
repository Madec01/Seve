// Accompagnement — cibles de Joseph (docs/ARCHITECTURE.md, « Accompagnement — contrats », Cibles).
//
// resolveTarget(desc, app) → { rects: [rect de la page], label, kind: 'ui' | 'scene', el? } | null
//   desc : { ui: '#sel' | () => Element, sheet? } · { plot } · { plots: [] } · { scene: hit } · { world: { x, y, w, h } }
//          · { view: hit } · { rect: () => rect } · { field: true } (le champ clôturé) · { center: true } (centre de la scène)
//          + label (lecteur d'écran), focus (défaut true)
// focusTarget(desc, app, { bottom }) : fait défiler la scène pour montrer la cible au-dessus de la bulle ; renvoie vrai si
//   la scène a dû bouger. ensureVisibleSize(rects, app) : demande le zoom tactile si la cible fait moins de 48 px.
// Tous les rectangles sont recalculés à chaque image (zoom, pincement, défilement, feuille qui monte).

const rectOf = (r) => (r ? { left: r.left, top: r.top, right: r.right ?? r.left + r.width, bottom: r.bottom ?? r.top + r.height, width: r.width ?? r.right - r.left, height: r.height ?? r.bottom - r.top } : null);

function visibleEl(n) {
  if (!n || !n.isConnected) return null;
  if (n.offsetParent === null && getComputedStyle(n).position !== 'fixed') return null;
  const r = n.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** Élément d'une cible d'interface (sélecteur ou fonction), ou null. */
export function targetElement(desc, app) {
  if (!desc || desc.ui === undefined) return null;
  if (desc.sheet && app.sheets?.current !== desc.sheet) return null;
  try {
    const n = typeof desc.ui === 'function' ? desc.ui() : document.querySelector(desc.ui);
    return n instanceof Element ? n : null;
  } catch {
    return null;
  }
}

/** La scène est-elle cachée (fenêtre, vue de la vallée) ? Une cible de la scène n'est alors pas montrée. */
function sceneHidden(app) {
  return !!app.valleyView?.active;
}

export function resolveTarget(desc, app) {
  if (!desc || typeof desc !== 'object') return null;
  const label = desc.label || '';
  try {
    if (desc.ui !== undefined) {
      const n = targetElement(desc, app);
      const r = visibleEl(n);
      return r ? { rects: [rectOf(r)], label, kind: 'ui', el: n } : null;
    }
    if (desc.rect) {
      const r = typeof desc.rect === 'function' ? desc.rect() : desc.rect;
      return r ? { rects: [rectOf(r)], label, kind: 'ui' } : null;
    }
    if (desc.view) {
      const r = app.valleyView?.targetPageRect?.(desc.view);
      return r ? { rects: [rectOf(r)], label, kind: 'scene' } : null;
    }
    if (sceneHidden(app)) return null;
    if (Number.isInteger(desc.plot)) {
      const r = app.plotPageRect?.(desc.plot);
      return r ? { rects: [rectOf(r)], label, kind: 'scene', plots: [desc.plot] } : null;
    }
    if (Array.isArray(desc.plots)) {
      const rects = desc.plots.map((i) => app.plotPageRect?.(i)).filter(Boolean).map(rectOf);
      return rects.length ? { rects, label, kind: 'scene', plots: desc.plots.slice() } : null;
    }
    if (desc.scene) {
      const w = app.scene?.targetRect?.(desc.scene);
      const r = w ? app.worldPageRect?.(w) : null;
      return r ? { rects: [rectOf(r)], label, kind: 'scene', world: w } : null;
    }
    if (desc.world) {
      const r = app.worldPageRect?.(desc.world);
      return r ? { rects: [rectOf(r)], label, kind: 'scene', world: desc.world } : null;
    }
    if (desc.field) {
      const r = app.fieldPageRect?.();
      return r ? { rects: [rectOf(r)], label, kind: 'scene' } : null;
    }
    if (desc.center) {
      const s = app.stageRect?.();
      if (!s) return null;
      const cx = s.left + s.width / 2;
      const cy = s.top + s.height / 2;
      return { rects: [rectOf({ left: cx - 40, top: cy - 40, width: 80, height: 80 })], label, kind: 'scene', center: true };
    }
  } catch {
    return null;
  }
  return null;
}

/** Union de rectangles (page). */
export function unionRect(rects) {
  if (!rects?.length) return null;
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const x of rects) {
    l = Math.min(l, x.left);
    t = Math.min(t, x.top);
    r = Math.max(r, x.right);
    b = Math.max(b, x.bottom);
  }
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}

/** Rectangle du monde (px) d'une cible de la scène (pour faire défiler), ou null. */
function worldRectOf(desc, app) {
  const s = app.scene;
  if (!s) return null;
  try {
    if (Number.isInteger(desc.plot)) return s.layout?.plotRect?.(desc.plot) || null;
    if (Array.isArray(desc.plots) && desc.plots.length) {
      const rs = desc.plots.map((i) => s.layout?.plotRect?.(i)).filter(Boolean);
      if (!rs.length) return null;
      const x = Math.min(...rs.map((r) => r.x));
      const y = Math.min(...rs.map((r) => r.y));
      return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
    }
    if (desc.scene) return s.targetRect?.(desc.scene) || null;
    if (desc.world) return desc.world;
  } catch {
    return null;
  }
  return null;
}

/**
 * Fait défiler la scène pour montrer la cible au-dessus de la bulle (opts.bottom : px couverts en bas en plus).
 * Cible d'interface dans une feuille : défilement de la feuille (scrollIntoView). Renvoie vrai si quelque chose a bougé.
 */
export function focusTarget(desc, app, opts = {}) {
  if (!desc || desc.focus === false) return false;
  if (desc.ui !== undefined) {
    const n = targetElement(desc, app);
    if (n && app.sheets?.box?.contains(n)) {
      try {
        n.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion?.() ? 'auto' : 'smooth' });
      } catch {
        /* rien */
      }
      return true;
    }
    return false;
  }
  const w = worldRectOf(desc, app);
  if (!w || typeof app.scene?.focusRect !== 'function') return false;
  try {
    app.scene.focusRect(w, { margin: 20, bottom: Math.max(0, opts.bottom || 0), animate: !app.reducedMotion?.() });
  } catch {
    return false;
  }
  return true;
}

/** Une cible de la scène fait moins de 48 px CSS au zoom courant : le zoom tactile (rendu à la fin de la leçon). */
export function needsTouchZoom(resolved) {
  if (!resolved || resolved.kind !== 'scene' || resolved.center) return false;
  return resolved.rects.some((r) => Math.min(r.width, r.height) < 47);
}
