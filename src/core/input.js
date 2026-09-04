// Entrées unifiées : clavier, souris, tactile. Le gameplay ne demande jamais
// « quelle touche ? » mais « quelle intention ? ».

const ACTIONS = {
  up: ['KeyW', 'KeyZ', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'KeyQ', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  act: ['Space', 'KeyJ', 'Enter'],
  tune: ['KeyK', 'KeyE', 'ShiftLeft'],
  dash: ['KeyL', 'ShiftRight', 'KeyC'],
  cycleSeed: ['Tab', 'KeyF'],
  pause: ['Escape', 'KeyP'],
  debug: ['KeyT'],
};

const SEED_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];

const state = {
  down: new Set(),
  pressedThisFrame: new Set(),
  releasedThisFrame: new Set(),
  virtual: new Set(),
  virtualPressed: new Set(),
  stick: { x: 0, y: 0, active: false, id: null, ox: 0, oy: 0, cx: 0, cy: 0 },
  pointer: { x: 0, y: 0, down: false, inside: false, moved: 0 },
  seedRequest: -1,
  lastInputKind: 'clavier',
};

let canvas = null;
let enabled = true;

function codeToActions(code) {
  const out = [];
  for (const [name, codes] of Object.entries(ACTIONS)) {
    if (codes.includes(code)) out.push(name);
  }
  return out;
}

function onKeyDown(e) {
  if (!enabled) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName || '')) return;
  const idx = SEED_KEYS.indexOf(e.code);
  if (idx >= 0) state.seedRequest = idx;
  const actions = codeToActions(e.code);
  if (actions.length || idx >= 0) e.preventDefault();
  state.lastInputKind = 'clavier';
  for (const a of actions) {
    if (!state.down.has(a)) state.pressedThisFrame.add(a);
    state.down.add(a);
  }
}

function onKeyUp(e) {
  for (const a of codeToActions(e.code)) {
    state.down.delete(a);
    state.releasedThisFrame.add(a);
  }
}

function canvasPoint(clientX, clientY) {
  if (!canvas) return { x: clientX, y: clientY };
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * canvas.width,
    y: ((clientY - r.top) / r.height) * canvas.height,
  };
}

function onMouseMove(e) {
  const p = canvasPoint(e.clientX, e.clientY);
  state.pointer.moved = Math.hypot(p.x - state.pointer.x, p.y - state.pointer.y);
  state.pointer.x = p.x;
  state.pointer.y = p.y;
  state.pointer.inside = true;
  if (state.pointer.moved > 1) state.lastInputKind = 'souris';
}

function onMouseDown(e) {
  if (!enabled) return;
  onMouseMove(e);
  state.pointer.down = true;
  const action = e.button === 2 ? 'tune' : 'act';
  if (!state.down.has(action)) state.pressedThisFrame.add(action);
  state.down.add(action);
}

function onMouseUp(e) {
  state.pointer.down = false;
  const action = e.button === 2 ? 'tune' : 'act';
  state.down.delete(action);
  state.releasedThisFrame.add(action);
}

function stickZoneLimit() {
  return canvas ? canvas.width * 0.5 : window.innerWidth * 0.5;
}

function onTouchStart(e) {
  if (!enabled) return;
  state.lastInputKind = 'tactile';
  for (const t of e.changedTouches) {
    const p = canvasPoint(t.clientX, t.clientY);
    if (!state.stick.active && p.x < stickZoneLimit()) {
      state.stick.active = true;
      state.stick.id = t.identifier;
      state.stick.ox = p.x; state.stick.oy = p.y;
      state.stick.cx = p.x; state.stick.cy = p.y;
    } else {
      state.pointer.x = p.x; state.pointer.y = p.y;
      state.pointer.inside = true;
    }
  }
  if (e.cancelable) e.preventDefault();
}

function onTouchMove(e) {
  for (const t of e.changedTouches) {
    const p = canvasPoint(t.clientX, t.clientY);
    if (state.stick.active && t.identifier === state.stick.id) {
      state.stick.cx = p.x; state.stick.cy = p.y;
      const dx = p.x - state.stick.ox;
      const dy = p.y - state.stick.oy;
      const max = (canvas ? canvas.height : 600) * 0.09;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / max);
      state.stick.x = (dx / d) * k;
      state.stick.y = (dy / d) * k;
    } else {
      state.pointer.x = p.x; state.pointer.y = p.y;
    }
  }
  if (e.cancelable) e.preventDefault();
}

function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (state.stick.active && t.identifier === state.stick.id) {
      state.stick.active = false;
      state.stick.id = null;
      state.stick.x = 0; state.stick.y = 0;
    }
  }
  if (e.cancelable) e.preventDefault();
}

export const Input = {
  init(canvasEl) {
    canvas = canvasEl;
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { state.down.clear(); state.virtual.clear(); });
    if (canvasEl) {
      canvasEl.addEventListener('mousemove', onMouseMove);
      canvasEl.addEventListener('mousedown', onMouseDown);
      canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
      canvasEl.addEventListener('mouseleave', () => { state.pointer.inside = false; });
      canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
      canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
      canvasEl.addEventListener('touchend', onTouchEnd, { passive: false });
      canvasEl.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }
    window.addEventListener('mouseup', onMouseUp);
  },

  setEnabled(v) { enabled = v; if (!v) { state.down.clear(); state.virtual.clear(); } },

  // Boutons tactiles à l'écran : le HUD appelle ces deux méthodes.
  pressVirtual(action) {
    if (!state.virtual.has(action)) state.virtualPressed.add(action);
    state.virtual.add(action);
    state.lastInputKind = 'tactile';
  },
  releaseVirtual(action) { state.virtual.delete(action); },

  held(action) { return state.down.has(action) || state.virtual.has(action); },
  pressed(action) {
    return state.pressedThisFrame.has(action) || state.virtualPressed.has(action);
  },
  released(action) { return state.releasedThisFrame.has(action); },

  takeSeedRequest() {
    const v = state.seedRequest;
    state.seedRequest = -1;
    return v;
  },

  moveVector() {
    let x = 0, y = 0;
    if (this.held('left')) x -= 1;
    if (this.held('right')) x += 1;
    if (this.held('up')) y -= 1;
    if (this.held('down')) y += 1;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    if (state.stick.active) { x += state.stick.x; y += state.stick.y; }
    const d2 = Math.hypot(x, y);
    if (d2 > 1) { x /= d2; y /= d2; }
    return { x, y };
  },

  stick() { return state.stick; },
  pointer() { return state.pointer; },
  kind() { return state.lastInputKind; },
  isTouch() { return state.lastInputKind === 'tactile'; },

  endFrame() {
    state.pressedThisFrame.clear();
    state.releasedThisFrame.clear();
    state.virtualPressed.clear();
    state.pointer.moved = 0;
  },
};
