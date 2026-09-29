// Petits outils DOM partagés par l'interface.

/**
 * Crée un élément : el('div.card.is-open', { title: '…', onclick: fn, dataset: {…} }, enfants…)
 * Les enfants peuvent être des chaînes, des nœuds, des tableaux, null/false (ignorés).
 */
export function el(spec, attrs, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className += ` ${v}`;
      else if (k === 'html') node.innerHTML = v;
      else if (k in node && typeof v !== 'string') node[k] = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Nombre entier avec espace insécable pour les milliers (« 1 250 »). */
export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return v < 0 ? `−${s}` : s;
}

/** Montant signé (« +12 », « −5 »). */
export function signed(n) {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? `+${fmt(v)}` : fmt(v);
}

/** « 1 jour », « 3 jours ». */
export function plural(n, one, many = `${one}s`) {
  return `${fmt(n)} ${Math.abs(n) > 1 ? many : one}`;
}

/** Décimal à la française (« 1,4 »). */
export function dec(n, digits = 1) {
  return Number(n).toFixed(digits).replace('.', ',');
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/** Rectangle d'un élément dans la fenêtre. */
export function rectOf(node) {
  return node.getBoundingClientRect();
}

/**
 * Place un élément flottant (position: fixed) près d'un rectangle cible, sans sortir de l'écran.
 * @param prefer 'right' | 'left' | 'top' | 'bottom'
 */
export function placeNear(node, target, prefer = 'right', gap = 10) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = node.getBoundingClientRect();
  const w = r.width;
  const h = r.height;
  const order = {
    right: ['right', 'left', 'bottom', 'top'],
    left: ['left', 'right', 'bottom', 'top'],
    top: ['top', 'bottom', 'right', 'left'],
    bottom: ['bottom', 'top', 'right', 'left'],
  }[prefer];
  const fits = {
    right: target.right + gap + w <= vw - 8,
    left: target.left - gap - w >= 8,
    top: target.top - gap - h >= 8,
    bottom: target.bottom + gap + h <= vh - 8,
  };
  const side = order.find((s) => fits[s]) || prefer;
  let x;
  let y;
  if (side === 'right' || side === 'left') {
    x = side === 'right' ? target.right + gap : target.left - gap - w;
    y = target.top + target.height / 2 - h / 2;
  } else {
    x = target.left + target.width / 2 - w / 2;
    y = side === 'bottom' ? target.bottom + gap : target.top - gap - h;
  }
  x = clamp(x, 8, Math.max(8, vw - w - 8));
  y = clamp(y, 8, Math.max(8, vh - h - 8));
  node.style.left = `${Math.round(x)}px`;
  node.style.top = `${Math.round(y)}px`;
  node.dataset.side = side;
  return side;
}

/** Réduit les animations si le joueur l'a demandé (option ou préférence du système). */
export function reducedMotion() {
  return document.documentElement.classList.contains('reduced-motion');
}
