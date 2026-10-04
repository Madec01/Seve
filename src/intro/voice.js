// Intro « MG studios » — le son (Web Audio). Vrais cris d'animaux (assets/audio/intro/*.mp3, Freesound CC0)
// et petite musique synthétisée aux timbres du jeu (marimba, clochette, nappe : comme src/audio/synth.js).
//
//   const v = createVoice(ctx, samples, volume);   // volume = effets du joueur (déjà au carré)
//   v.schedule(soundProgram(reduced), T0);         // programme de src/intro/timeline.js
//   v.applyGain(gainCurve(plan, skipFrom), T0);    // fondu final ou rapide : jamais de coupure sèche
//   v.release(afterSeconds);                       // débranche tout quand le fondu est fini
//
// Chaîne : sources → bus (volume) → compresseur doux → fader (fondus) → sortie.

import { SND_INFO, SND_MIX } from './timeline.js';

const mf = (m) => 440 * 2 ** ((m - 69) / 12);

export function createVoice(ctx, samples, volume = 1) {
  const bus = ctx.createGain();
  bus.gain.value = 0.85 * volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
  const fader = ctx.createGain();
  fader.gain.value = 1;
  bus.connect(comp); comp.connect(fader); fader.connect(ctx.destination);
  const sources = [];
  const track = (node, stopAt) => { sources.push(node); node.__stopAt = stopAt; return node; };

  const env = (gn, t, peak, a, d) => {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(peak, t + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  let noise = null;
  const noiseBuf = () => {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  };
  const osc = (type, freq, t, stop) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.start(t); o.stop(stop); return track(o, stop); };

  const A = {
    sample(name, t, pan = 0, vol = 1) {
      const buf = samples[name];
      if (!buf) return false;
      const mix = SND_MIX[name] || { vol: 1 };
      const src = ctx.createBufferSource(); src.buffer = buf;
      const gn = ctx.createGain(); gn.gain.value = mix.vol * vol;
      let node = src;
      if (mix.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mix.lp; lp.Q.value = 0.5; node.connect(lp); node = lp; }
      node.connect(gn); node = gn;
      if (pan && ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; node.connect(pn); node = pn; }
      node.connect(bus);
      // l'encodeur MP3 ajoute ~30 ms de silence en tête : on le saute pour rester calé sur l'image
      const pad = Math.min(0.05, Math.max(0, buf.duration - SND_INFO[name].dur));
      src.start(Math.max(t, ctx.currentTime), pad);
      track(src, t + buf.duration);
      return true;
    },
    mallet(freq, t, vol, decay = 0.55, bright = 1) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, 2600 + freq * 1.6 * bright); lp.Q.value = 0.4; lp.connect(bus);
      for (const [mult, type, v, d] of [[1, 'sine', vol, decay], [3.93, 'sine', vol * 0.22 * bright, Math.min(0.12, decay * 0.25)], [2, 'triangle', vol * 0.07, decay * 0.5]]) {
        const o = osc(type, freq * mult, t, t + decay + 0.1);
        const gn = ctx.createGain(); env(gn, t, v, 0.004, d); o.connect(gn); gn.connect(lp);
      }
    },
    bell(freq, t, vol, decay = 1.1) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.connect(bus);
      for (const [mult, v, d] of [[1, vol, decay], [2.76, vol * 0.35, decay * 0.5], [5.4, vol * 0.12, decay * 0.25]]) {
        const o = osc('sine', freq * mult, t, t + decay + 0.1);
        const gn = ctx.createGain(); env(gn, t, v, 0.003, d); o.connect(gn); gn.connect(lp);
      }
    },
    // nappe très douce (accord tenu, triangles filtrés) qui s'éteint d'elle-même
    pad(midis, t, dur, vol) {
      for (const m of midis) for (const det of [-4, 4]) {
        const o = osc('triangle', mf(m), t, t + dur + 0.05); o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.25); gn.gain.setValueAtTime(vol, t + dur * 0.5); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); lp.connect(gn); gn.connect(bus);
      }
    },
    hiss(t, vol, dur, type, f0, f1, q = 0.8) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf();
      const bp = ctx.createBiquadFilter(); bp.type = type; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + dur * 0.6); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(gn); gn.connect(bus); src.start(t); src.stop(t + dur + 0.02);
      track(src, t + dur + 0.02);
    },
    thud(t, v) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.14);
      const gn = ctx.createGain(); env(gn, t, 0.22 * v, 0.004, 0.2); o.connect(gn); gn.connect(bus); o.start(t); o.stop(t + 0.3);
      track(o, t + 0.3);
      A.hiss(t, 0.06 * v, 0.08, 'lowpass', 900, 300, 0.5);
    },
    knock(t, v) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 3;
      const gn = ctx.createGain(); env(gn, t, 0.3 * v, 0.002, 0.07);
      src.connect(bp); bp.connect(gn); gn.connect(bus); src.start(t); src.stop(t + 0.12);
      track(src, t + 0.12);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
      const g2 = ctx.createGain(); env(g2, t, 0.09 * v, 0.002, 0.1); o.connect(g2); g2.connect(bus); o.start(t); o.stop(t + 0.15);
      track(o, t + 0.15);
    },
  };

  /** Joue le programme sonore (événements de soundProgram) à partir de l'instant T0 du contexte. */
  function schedule(program, T0) {
    for (const e of program) {
      const t = T0 + e.at;
      try {
        if (e.kind === 'sample') A.sample(e.name, t, e.pan || 0, e.vol == null ? 1 : e.vol);
        else if (e.kind === 'mallet') A.mallet(mf(e.midi), t, e.vol, e.decay, e.bright || 1);
        else if (e.kind === 'bell') A.bell(mf(e.midi), t, e.vol, e.decay);
        else if (e.kind === 'pad') A.pad(e.midis, t, e.dur, e.vol);
        else if (e.kind === 'whoosh') A.hiss(t, e.vol, e.dur - 0.02, 'bandpass', 350, 1800, 1.2);
        else if (e.kind === 'thud') A.thud(t, e.vol);
        else if (e.kind === 'knock') A.knock(t, e.vol);
      } catch { /* un son qui échoue ne gêne pas l'image */ }
    }
  }

  /** Automation du fader : courbe [[t, gain], …] (rampes linéaires) à partir de T0. */
  function applyGain(curve, T0) {
    const p = fader.gain;
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    // la valeur courante d'abord (pas de saut), puis les points à venir
    const at = (tt) => {
      for (let i = 1; i < curve.length; i++) {
        const [t0, g0] = curve[i - 1], [t1, g1] = curve[i];
        if (tt <= t1) return t1 === t0 ? g1 : g0 + (g1 - g0) * Math.max(0, (tt - t0) / (t1 - t0));
      }
      return curve[curve.length - 1][1];
    };
    p.setValueAtTime(at(now - T0), now);
    for (const [t, v] of curve) if (T0 + t > now) p.linearRampToValueAtTime(v, T0 + t);
  }

  /** Débranche la chaîne (et arrête les sources encore programmées) `after` secondes plus tard. */
  let released = false;
  function release(after = 0) {
    if (released) return;
    released = true;
    setTimeout(() => {
      for (const s of sources) { try { s.stop(); } catch { /* déjà arrêtée */ } }
      try { fader.disconnect(); } catch { /* */ }
    }, Math.max(0, after * 1000) + 60);
  }

  return { schedule, applyGain, release, fader, bus };
}

/** Décode les cris (ArrayBuffer déjà téléchargés) ; un cri qui échoue est simplement absent. */
export function decodeSamples(ctx, raw) {
  const out = {};
  return Promise.all(Object.entries(raw).map(([name, data]) => new Promise((res) => {
    if (!data) { res(); return; }
    let done = false;
    const ok = (buf) => { if (!done) { done = true; out[name] = buf; res(); } };
    const ko = () => { if (!done) { done = true; res(); } };
    try {
      const p = ctx.decodeAudioData(data.slice(0), ok, ko);
      if (p && p.then) p.then(ok, ko);
    } catch { ko(); }
  }))).then(() => out);
}
