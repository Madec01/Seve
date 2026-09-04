// Texte animé. Règle du projet : aucun texte n'apparaît d'un bloc.

export class Typewriter {
  constructor(el, options = {}) {
    this.el = el;
    this.speed = options.speed || 34;      // caractères par seconde
    this.onChar = options.onChar || null;
    this.onDone = options.onDone || null;
    this.text = '';
    this.index = 0;
    this.acc = 0;
    this.done = true;
  }

  play(text) {
    this.text = text || '';
    this.index = 0;
    this.acc = 0;
    this.done = this.text.length === 0;
    this.el.textContent = '';
    this.el.classList.add('tw-active');
    if (this.done && this.onDone) this.onDone();
    return this;
  }

  update(dt) {
    if (this.done) return;
    this.acc += dt * this.speed;
    while (this.acc >= 1 && this.index < this.text.length) {
      this.acc -= 1;
      const ch = this.text[this.index];
      this.index++;
      // Les ponctuations font respirer la phrase.
      if (ch === ',') this.acc -= 3;
      if (ch === '.' || ch === '!' || ch === '?' || ch === '…') this.acc -= 7;
      if (this.onChar) this.onChar(ch, this.index);
    }
    this.el.textContent = this.text.slice(0, this.index);
    if (this.index >= this.text.length && !this.done) {
      this.done = true;
      this.el.classList.remove('tw-active');
      if (this.onDone) this.onDone();
    }
  }

  skip() {
    if (this.done) return false;
    this.index = this.text.length;
    this.el.textContent = this.text;
    this.done = true;
    this.el.classList.remove('tw-active');
    if (this.onDone) this.onDone();
    return true;
  }
}

// Titre lettre par lettre, chaque lettre ondulant à son propre rythme.
export function waveTitle(el, text, options = {}) {
  const { delay = 0.04, amplitude = 6 } = options;
  el.textContent = '';
  el.classList.add('wave-title');
  [...text].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? ' ' : ch;
    span.style.setProperty('--i', i);
    span.style.setProperty('--delay', `${i * delay}s`);
    span.style.setProperty('--amp', `${amplitude}px`);
    el.appendChild(span);
  });
  return el;
}

// Compteur qui roule : un nombre ne change jamais d'un coup non plus.
export function countTo(el, from, to, duration = 0.6, format = (v) => Math.round(v)) {
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / (duration * 1000));
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (to - from) * eased);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function pulse(el, className = 'pulse') {
  if (!el) return;
  el.classList.remove(className);
  // Force le navigateur à rejouer l'animation.
  void el.offsetWidth;
  el.classList.add(className);
}

export function fadeIn(el, delayIndex = 0) {
  if (!el) return;
  el.style.setProperty('--enter-delay', `${delayIndex * 0.06}s`);
  el.classList.add('enter');
}

export function formatSap(n) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}
