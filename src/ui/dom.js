// Micro-outils DOM. Pas de framework : le jeu n'en a pas besoin.

export function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.innerHTML = content;
  return node;
}

export function button(label, onClick, className = 'btn') {
  const b = el('button', className);
  b.innerHTML = label;
  b.addEventListener('click', (e) => { e.preventDefault(); onClick(e); });
  return b;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function row(...children) {
  const r = el('div', 'row');
  for (const c of children) if (c) r.appendChild(c);
  return r;
}

export function slider(label, value, min, max, step, onInput) {
  const wrap = el('label', 'slider');
  wrap.innerHTML = `<span>${label}</span>`;
  const input = el('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  const out = el('output');
  out.textContent = Math.round(value * 100) + '%';
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = Math.round(v * 100) + '%';
    onInput(v);
  });
  wrap.appendChild(input);
  wrap.appendChild(out);
  return wrap;
}

export function toggle(label, value, onChange) {
  const wrap = el('label', 'toggle');
  wrap.innerHTML = `<span>${label}</span>`;
  const input = el('input');
  input.type = 'checkbox';
  input.checked = !!value;
  input.addEventListener('change', () => onChange(input.checked));
  const track = el('i', 'track');
  wrap.appendChild(input);
  wrap.appendChild(track);
  return wrap;
}

export function select(label, options, value, onChange) {
  const wrap = el('label', 'select');
  wrap.innerHTML = `<span>${label}</span>`;
  const s = el('select');
  for (const o of options) {
    const opt = el('option');
    opt.value = o.value; opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    s.appendChild(opt);
  }
  s.addEventListener('change', () => onChange(s.value));
  wrap.appendChild(s);
  return wrap;
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function toggleFullscreen(target = document.documentElement) {
  if (isFullscreen()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const fn = target.requestFullscreen || target.webkitRequestFullscreen;
    if (fn) fn.call(target).catch(() => { /* refusé par le navigateur */ });
  }
}

export function isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
