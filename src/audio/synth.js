// Synthèse organique. Aucune onde carrée, aucun bip.
// Corde pincée (Karplus-Strong), bois, eau, souffle, flûte, terre.

import { audioReady, audioCtx, bus, getNoise, panner, now, duckMusic } from './audio.js';

const pluckCache = new Map();

// Karplus-Strong hors-ligne : bruit blanc dans une ligne à retard filtrée.
// C'est le timbre d'une corde de kora ou de harpe en bois — chaud, avec une
// attaque courte et une queue qui perd ses aigus.
function makePluckBuffer(freq, seconds, damping, brightness) {
  const ctx = audioCtx();
  const rate = ctx.sampleRate;
  const n = Math.max(2, Math.round(rate / freq));
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const out = buf.getChannelData(0);

  const line = new Float32Array(n);
  // Excitation : bruit filtré, pas de bruit brut — moins agressif.
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    prev = prev * (1 - brightness) + white * brightness;
    line[i] = prev;
  }

  let idx = 0;
  let last = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const nextIdx = (idx + 1) % n;
    const avg = (cur + line[nextIdx]) * 0.5;
    const filtered = avg * damping;
    line[idx] = filtered;
    idx = nextIdx;
    // Petit passe-bas de sortie pour arrondir encore.
    last = last * 0.55 + cur * 0.45;
    out[i] = last;
  }

  // Enveloppe de fin pour éviter tout clic.
  const fade = Math.floor(rate * 0.06);
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return buf;
}

function pluckBuffer(freq, seconds, damping, brightness) {
  const key = `${Math.round(freq)}|${seconds.toFixed(2)}|${damping.toFixed(3)}|${brightness.toFixed(2)}`;
  if (!pluckCache.has(key)) {
    if (pluckCache.size > 120) pluckCache.clear();
    pluckCache.set(key, makePluckBuffer(freq, seconds, damping, brightness));
  }
  return pluckCache.get(key);
}

// --- Corde pincée : la voix des plantes -------------------------------------
export function pluck(freq, opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const {
    dur = 1.4, gain = 0.32, pan = 0, delay = 0,
    damping = 0.9955, brightness = 0.55, busName = 'sfx',
  } = opts;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq, dur, damping, brightness);
  const t = now() + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.25);
  src.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus(busName)); } else g.connect(bus(busName));
  src.start(t);
  src.stop(t + dur + 0.1);
}

export function playChord(freqs, opts = {}) {
  if (!audioReady()) return;
  const { spread = 0.045, gain = 0.28, dur = 2.6, pan = 0 } = opts;
  duckMusic(0.5, 1.1);
  freqs.forEach((f, i) => {
    pluck(f, {
      dur, gain: gain * (1 - i * 0.06), pan: pan + (i - freqs.length / 2) * 0.12,
      delay: i * spread, damping: 0.9975, brightness: 0.45,
    });
  });
}

// --- Bois : clics, navigation, semis ---------------------------------------
export function wood(opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const { freq = 420, gain = 0.3, pan = 0, decay = 0.11, q = 6 } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4200;
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp); bp.connect(lp); lp.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
  src.start(t);
  src.stop(t + decay + 0.05);
}

// --- Eau : arrosage, gouttes ------------------------------------------------
export function drop(opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const { freq = 900, gain = 0.22, pan = 0, dur = 0.18 } = opts;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const t = now();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
  osc.start(t); osc.stop(t + dur + 0.05);
}

export function pour(duration = 0.5, pan = 0) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const src = ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2100;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.14, t + 0.04);
  g.gain.setTargetAtTime(0.0001, t + duration * 0.6, 0.12);
  src.connect(bp); bp.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
  src.start(t); src.stop(t + duration + 0.3);
  for (let i = 0; i < 3; i++) drop({ freq: 700 + Math.random() * 600, gain: 0.1, pan, dur: 0.14 });
}

// --- Souffle : dash, vent, Cendre -------------------------------------------
export function breath(opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const { dur = 0.45, gain = 0.2, pan = 0, from = 500, to = 2600, q = 1.1 } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  const t = now();
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
  src.start(t); src.stop(t + dur + 0.1);
}

// --- Flûte : mélodies, moments doux ----------------------------------------
export function flute(freq, opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const { dur = 0.9, gain = 0.16, pan = 0, delay = 0, busName = 'music' } = opts;
  const t = now() + delay;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 0.995, t);
  osc.frequency.linearRampToValueAtTime(freq, t + 0.09);

  // Vibrato léger : c'est ce qui empêche le son de paraître robotique.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.6 + Math.random();
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = freq * 0.006;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

  // Bruit de souffle mêlé à la sinusoïde.
  const air = ctx.createBufferSource();
  air.buffer = getNoise(); air.loop = true;
  const airBp = ctx.createBiquadFilter();
  airBp.type = 'bandpass'; airBp.frequency.value = freq * 2.1; airBp.Q.value = 2;
  const airGain = ctx.createGain(); airGain.gain.value = gain * 0.22;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.12);
  g.gain.setValueAtTime(gain, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g);
  air.connect(airBp); airBp.connect(airGain); airGain.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus(busName)); } else g.connect(bus(busName));
  osc.start(t); lfo.start(t); air.start(t);
  osc.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1); air.stop(t + dur + 0.1);
}

// --- Terre : impacts sourds -------------------------------------------------
export function earth(opts = {}) {
  if (!audioReady()) return;
  const ctx = audioCtx();
  const { gain = 0.4, pan = 0, freq = 96, dur = 0.34 } = opts;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const t = now();
  osc.frequency.setValueAtTime(freq * 1.6, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  const p = panner(pan);
  if (p) { g.connect(p); p.connect(bus('sfx')); } else g.connect(bus('sfx'));
  osc.start(t); osc.stop(t + dur + 0.05);
}

// --- Cendre : le son de l'ennemi -------------------------------------------
export function ashCrackle(intensity = 0.5, pan = 0) {
  if (!audioReady()) return;
  breath({ dur: 0.55 + intensity * 0.4, gain: 0.06 + intensity * 0.09, pan, from: 2400, to: 320, q: 0.8 });
}

export function rustle(gain = 0.1, pan = 0) {
  breath({ dur: 0.32, gain, pan, from: 1800, to: 5200, q: 2.4 });
}
