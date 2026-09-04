// Contexte audio, bus et réverbération. Rien n'est chargé depuis un fichier :
// la matière sonore du jeu est entièrement fabriquée à l'exécution.

let ctx = null;
let ready = false;
const buses = {};
let settings = { master: 0.8, music: 0.6, sfx: 0.9, voices: 0.8 };
let reverb = null;
let muted = false;

export function audioReady() { return ready; }
export function audioCtx() { return ctx; }
export function now() { return ctx ? ctx.currentTime : 0; }

// Une réverbération courte et boisée : le jeu doit sonner comme une pièce en
// bois, pas comme une cathédrale numérique.
function buildImpulse(seconds = 1.6, decay = 3.2) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, decay);
      // Un peu de coloration : moins d'aigus en fin de queue.
      data[i] = (Math.random() * 2 - 1) * env * (1 - t * 0.4);
    }
  }
  return buf;
}

export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { console.warn('[audio] WebAudio indisponible'); return null; }
  ctx = new AC();

  const master = ctx.createGain();
  master.gain.value = settings.master;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 22;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.006;
  comp.release.value = 0.22;

  // Léger adoucissement global : on coupe la dureté au-dessus de 12 kHz.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 12500;
  tone.Q.value = 0.4;

  master.connect(comp);
  comp.connect(tone);
  tone.connect(ctx.destination);

  reverb = ctx.createConvolver();
  reverb.buffer = buildImpulse();
  const wet = ctx.createGain();
  wet.gain.value = 0.34;
  reverb.connect(wet);
  wet.connect(master);

  for (const name of ['music', 'sfx', 'voice']) {
    const g = ctx.createGain();
    const send = ctx.createGain();
    g.connect(master);
    send.gain.value = name === 'music' ? 0.5 : 0.35;
    g.connect(send);
    send.connect(reverb);
    buses[name] = { gain: g, send };
  }
  buses.master = { gain: master };
  applySettings(settings);
  ready = true;
  return ctx;
}

export function resumeAudio() {
  if (!ctx) initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function bus(name) {
  if (!ready) return null;
  return buses[name] ? buses[name].gain : buses.sfx.gain;
}

export function applySettings(next) {
  settings = Object.assign(settings, next || {});
  if (!ready) return;
  const m = muted ? 0 : settings.master;
  buses.master.gain.gain.setTargetAtTime(m, ctx.currentTime, 0.05);
  buses.music.gain.gain.setTargetAtTime(settings.music, ctx.currentTime, 0.05);
  buses.sfx.gain.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.05);
  buses.voice.gain.gain.setTargetAtTime(settings.voices, ctx.currentTime, 0.05);
}

export function setMuted(v) { muted = v; applySettings({}); }
export function isMuted() { return muted; }

// Duck : baisse temporairement la musique pour laisser passer un moment fort.
export function duckMusic(amount = 0.4, duration = 0.9) {
  if (!ready) return;
  const g = buses.music.gain.gain;
  const t = ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(settings.music * amount, t + 0.05);
  g.linearRampToValueAtTime(settings.music, t + duration);
}

export function noiseBuffer(seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

let sharedNoise = null;
export function getNoise() {
  if (!sharedNoise) sharedNoise = noiseBuffer(2);
  return sharedNoise;
}

export function panner(pan = 0) {
  if (!ctx) return null;
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    return p;
  }
  return null;
}
