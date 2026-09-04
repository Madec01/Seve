// Bus d'évènements minimal. Découple gameplay, audio et interface :
// le champ ne connaît pas le synthétiseur, il annonce simplement ce qui arrive.

const listeners = new Map();

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn) {
  const set = listeners.get(name);
  if (set) set.delete(fn);
}

export function once(name, fn) {
  const dispose = on(name, (payload) => { dispose(); fn(payload); });
  return dispose;
}

export function emit(name, payload) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); }
    catch (err) { console.error(`[events] ${name}`, err); }
  }
}

export function clearAll() { listeners.clear(); }
