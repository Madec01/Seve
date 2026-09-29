// Petit émetteur d'événements synchrone.

export function createEmitter() {
  const handlers = new Map();

  function on(type, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler doit être une fonction');
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(handler);
    return () => handlers.get(type)?.delete(handler);
  }

  function emit(type, payload) {
    const set = handlers.get(type);
    if (set) {
      // Copie : un gestionnaire peut se désabonner pendant l'émission.
      for (const h of [...set]) h(payload);
    }
    const all = handlers.get('*');
    if (all) {
      for (const h of [...all]) h({ type, ...payload });
    }
  }

  return { on, emit };
}
