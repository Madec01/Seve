// Moteur du paysage sonore de la Vallée vivante (lot V4) : joue ce que décide natureScape (src/audio/soundscape.js),
// entièrement en synthèse (Web Audio) : aucun fichier, aucune licence. Conception : docs/VALLEE.md § 18.8 ; contrat :
// docs/ARCHITECTURE.md, « Plan audio technique (paquet AUDIO) ».
//
//   const nature = createNature(ctx, destination, { detail })   ctx : AudioContext ou OfflineAudioContext
//   nature.set(scape)              paysage à jouer (natureScape) ; null = tout se tait (fondu)
//   nature.setListener({ y, h })   vue : centre de l'écran (px du monde) → gains et panoramiques (rien d'autre)
//   nature.setDetail(mode)         'full' | 'light' (4 voix, sans écho, couches allégées)
//   nature.play(id, opts)          (débogage) joue une phrase d'un chant, ou quelques secondes d'une couche
//   nature.stop()                  fondu court, puis tout est déconnecté et la minuterie arrêtée
//   nature.voices / nature.layers  voix ponctuelles en cours / couches qui tournent ; nature.stats()
//   nature.advance(t)              (mesures hors ligne, clock: 'manual') programme la fenêtre [t, t + 0,25 s]
//
// Chaîne : couches et voix → natureOut → [écho 0,18 s bouclé × 0,22 → passe-bas 2,5 kHz, « complets » et vue] →
// limiteur doux « filet de sécurité » (pic < 0,5) → destination (bus « Ambiance »). Un seul tampon de bruit rose (2 s, graine fixe),
// partagé. Programmateur à 250 ms (pas d'animation par image) ; couches réglées par setTargetAtTime ; tout départ et
// tout arrêt passe par un fondu (aucun craquement). Le hasard (Math.random) est permis ici : le son n'est pas la partie.

import { LAYER_IDS, MAX_VOICES, NATURE_SOURCES, SAME_SONG_GAP, spatial } from './soundscape.js';

const TICK = 0.25; // s : pas du programmateur
const LEAD = 0.05; // s : avance de programmation
const FADE_TC = 0.6; // constante de temps des fondus de couches (≈ 2 s pour 95 %)
const STOP_AFTER = 4; // s : une couche tombée à 0 est arrêtée (sources libérées) après ce délai
/** Gain d'une couche au niveau 1 (réglés au sonomètre : la vue complète ≈ 0,045 RMS, la ferme ≈ 0,02, à comparer au
 *  fichier « birds » existant : 0,055 RMS × 0,8 × 0,9 ≈ 0,04 avant le bus). */
const LAYER_GAIN = { brook: 0.75, mill: 1.5, leaves: 0.65, crickets: 0.12, frogs: 0.3 };
/** Volume d'un chant (pic de la phrase ≈ 0,1 à 0,25 avant le bus). Les lointains sont plus doux. */
const SONG_GAIN = {
  robin: 0.16, blackbird: 0.17, swallow: 0.12, tawnyOwl: 0.17, jay: 0.65, littleOwl: 0.13, blackWoodpecker: 1.3,
  skylark: 0.1, hoopoe: 0.15, kingfisher: 0.12, heron: 0.18, cuckoo: 0.13, whiteStork: 0.75, crane: 0.18,
  oriole: 0.16, redDeer: 0.17, beaver: 0.26,
};

/** Bruit rose (filtre de Paul Kellet), 2 s, graine fixe, bouclage sans couture (fondu enchaîné de la fin sur le début). */
function pinkNoise(ctx) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 2);
  const x = Math.floor(sr * 0.05);
  const tmp = new Float32Array(n + x);
  let seed = 20261004;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let peak = 0;
  for (let i = 0; i < n + x; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const w = (seed / 0x7fffffff) * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    const v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    tmp[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = tmp[i];
  for (let i = 0; i < x; i++) {
    const k = i / x; // le début reprend en fondu la suite de la fin : la boucle ne craque pas
    d[i] = tmp[n + i] * (1 - k) + tmp[i] * k;
  }
  const norm = 0.9 / peak;
  for (let i = 0; i < n; i++) d[i] *= norm;
  return buf;
}

/** Courbe du limiteur doux : y = x jusqu'à 0,3, puis 0,3 + 0,18 × tanh((|x| − 0,3) / 0,18) (≤ 0,48). */
function softLimitCurve() {
  const n = 4097;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= 0.3 ? a : 0.3 + 0.18 * Math.tanh((a - 0.3) / 0.18);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

export function createNature(ctx, destination, opts = {}) {
  const rnd = opts.random || Math.random;
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  let detail = opts.detail === 'light' ? 'light' : 'full';
  const manual = opts.clock === 'manual';

  const noiseBuf = pinkNoise(ctx);
  const canPan = typeof ctx.createStereoPanner === 'function';

  // ── Sortie, écho, filet de sécurité ──
  const out = ctx.createGain();
  out.gain.value = 1;
  // Filet de sécurité : limiteur doux (WaveShaper, aucun gain de rattrapage, contrairement au compresseur de Web Audio) ;
  // linéaire jusqu'à 0,3 (le paysage vit vers 0,02 à 0,06 en RMS, pics de 0,1 à 0,3), puis courbe douce bornée à
  // 0,48 : le pic de sortie reste TOUJOURS sous 0,5, sans écrêtage dur.
  const comp = ctx.createWaveShaper();
  comp.curve = softLimitCurve();
  comp.oversample = 'none';
  const outFade = ctx.createGain(); // fondu général (arrêt sans craquement)
  outFade.gain.value = 1;
  out.connect(comp);
  comp.connect(outFade);
  outFade.connect(destination);
  let echo = null; // créé seulement s'il sert (« complets » dans la vue)
  let echoOn = false;
  function ensureEcho() {
    if (echo) return echo;
    const send = ctx.createGain();
    send.gain.value = 0;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.18;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    out.connect(send);
    send.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(comp);
    echo = { send, delay, lp, fb };
    return echo;
  }
  function applyEcho() {
    const want = echoOn && detail === 'full';
    if (!want && !echo) return;
    const e = ensureEcho();
    e.send.gain.setTargetAtTime(want ? 0.3 : 0, ctx.currentTime, 0.4);
  }

  // ── État ──
  let scape = null;
  let listener = { y: 216, h: 160 };
  let maxVoices = MAX_VOICES[detail];
  let voices = 0;
  let stopped = false;
  const lastEnd = new Map(); // chant → fin de sa dernière phrase (s)
  const layers = {}; // id → couche en cours

  const where = () => (scape && scape.where) || 'farm';

  // ── Petits outils ──
  function panner(p) {
    if (!canPan) return null;
    const n = ctx.createStereoPanner();
    n.pan.value = Math.max(-1, Math.min(1, p));
    return n;
  }
  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(t, rnd() * 1.9);
    if (dur != null) s.stop(t + dur);
    return s;
  }
  function filter(type, f, q = 0.7) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }
  /** Impulsion d'enveloppe sur un AudioParam de gain : 0 → pic (attaque) → 0 (relâche), sans saut. */
  function pulse(param, t, peak, attack, hold, release) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) param.setValueAtTime(peak, t + attack + hold);
    param.linearRampToValueAtTime(0, t + attack + hold + release);
    return t + attack + hold + release;
  }

  // ── Voix ponctuelles (chants) ──
  /** Ouvre une voix : gain → panoramique → sortie ; `end` (s) libère tout. */
  function openVoice(t, vol, pan, counted = true) {
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = panner(pan);
    if (p) {
      g.connect(p);
      p.connect(out);
    } else g.connect(out);
    if (counted) voices++;
    const sources = [];
    return {
      g,
      add(src, end) {
        sources.push([src, end]);
        return src;
      },
      close() {
        if (!sources.length) {
          if (counted) voices = Math.max(0, voices - 1);
          return t;
        }
        let last = sources[0];
        for (const s of sources) if (s[1] > last[1]) last = s;
        for (const [s, e] of sources) {
          try {
            s.stop(e);
          } catch {
            /* déjà programmée */
          }
        }
        last[0].onended = () => {
          if (counted) voices = Math.max(0, voices - 1);
          g.disconnect();
          if (p) p.disconnect();
        };
        return last[1];
      },
    };
  }
  /** Un oscillateur (créé une fois par phrase) dont la fréquence et le gain sont automatisés note par note. */
  function oscChain(v, t, type, f, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(dest || v.g);
    o.start(t);
    return { o, g, f: o.frequency, a: g.gain };
  }

  const SONGS = {
    robin(v, t) {
      const n = RI(6, 10);
      const c = oscChain(v, t, 'sine', 5000);
      let f = R(4800, 6000);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const d = R(0.04, 0.09);
        const f1 = f * R(0.85, 1.15);
        c.f.setValueAtTime(f, tt);
        c.f.exponentialRampToValueAtTime(Math.max(2400, f1), tt + d);
        pulse(c.a, tt, 1, 0.006, d * 0.5, d * 0.5 - 0.006);
        tt += d + R(0.02, 0.05);
        f = Math.max(2500, f * R(0.86, 0.97));
      }
      return v.add(c.o, tt + 0.02);
    },
    blackbird(v, t) {
      const n = RI(5, 7);
      const c = oscChain(v, t, 'sine', 2000);
      const vib = ctx.createOscillator();
      vib.frequency.value = 6;
      const vg = ctx.createGain();
      vg.gain.value = 20;
      vib.connect(vg);
      vg.connect(c.f);
      vib.start(t);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const d = R(0.12, 0.25);
        const f = R(1500, 2800);
        c.f.setValueAtTime(f, tt);
        c.f.linearRampToValueAtTime(f * R(0.92, 1.1), tt + d);
        pulse(c.a, tt, R(0.7, 1), 0.025, d * 0.4, d * 0.6 - 0.025);
        tt += d + R(0.05, 0.12);
      }
      for (let i = 0; i < 4; i++) {
        // petit gazouillis final, plus aigu et plus doux
        const f = R(3000, 4000);
        c.f.setValueAtTime(f, tt);
        c.f.exponentialRampToValueAtTime(f * 1.2, tt + 0.025);
        pulse(c.a, tt, 0.45, 0.004, 0.01, 0.014);
        tt += 0.045;
      }
      v.add(vib, tt + 0.02);
      return v.add(c.o, tt + 0.02);
    },
    swallow(v, t) {
      const n = RI(6, 12);
      const c = oscChain(v, t, 'sine', 4000);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = R(3000, 5000);
        c.f.setValueAtTime(f, tt);
        c.f.exponentialRampToValueAtTime(f * R(1.15, 1.3), tt + 0.03);
        pulse(c.a, tt, R(0.6, 1), 0.004, 0.012, 0.014);
        tt += 0.03 + R(0.03, 0.07);
      }
      return v.add(c.o, tt + 0.02);
    },
    tawnyOwl(v, t) {
      const c = oscChain(v, t, 'sine', 420);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5;
      const vg = ctx.createGain();
      vg.gain.value = 0;
      vib.connect(vg);
      vg.connect(c.f);
      vib.start(t);
      c.f.setValueAtTime(420, t);
      c.f.linearRampToValueAtTime(380, t + 0.5);
      pulse(c.a, t, 1, 0.06, 0.3, 0.14);
      const t2 = t + 0.5 + 1.2;
      c.f.setValueAtTime(400, t2);
      pulse(c.a, t2, 0.7, 0.03, 0.08, 0.06);
      c.f.setValueAtTime(410, t2 + 0.25);
      pulse(c.a, t2 + 0.25, 0.75, 0.03, 0.08, 0.06);
      const t3 = t2 + 0.55;
      c.f.setValueAtTime(420, t3);
      c.f.linearRampToValueAtTime(375, t3 + 1);
      vg.gain.setValueAtTime(0, t3);
      vg.gain.linearRampToValueAtTime(9, t3 + 0.3);
      pulse(c.a, t3, 1, 0.06, 0.6, 0.34);
      v.add(vib, t3 + 1.05);
      return v.add(c.o, t3 + 1.05);
    },
    littleOwl(v, t) {
      const c = oscChain(v, t, 'sine', 1600);
      let tt = t;
      const n = RI(1, 3);
      for (let i = 0; i < n; i++) {
        c.f.setValueAtTime(1600, tt);
        c.f.exponentialRampToValueAtTime(1100, tt + 0.3);
        pulse(c.a, tt, 1, 0.02, 0.1, 0.18);
        tt += 0.3 + R(0.5, 0.8);
      }
      return v.add(c.o, tt);
    },
    blackWoodpecker(v, t) {
      const s = noiseSrc(t);
      const bp = filter('bandpass', 800, 4);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(bp);
      bp.connect(g);
      g.connect(v.g);
      const n = RI(15, 20);
      let tt = t;
      for (let i = 0; i < n; i++) {
        pulse(g.gain, tt, 1 - (i / n) * 0.7, 0.0005, 0.0005, 0.003);
        tt += 1 / 18;
      }
      return v.add(s, tt + 0.02);
    },
    jay(v, t) {
      const n = RI(1, 2);
      const s = noiseSrc(t);
      const bp = filter('bandpass', 1800, 3);
      const am = ctx.createGain();
      am.gain.value = 0.5;
      const sq = ctx.createOscillator();
      sq.type = 'square';
      sq.frequency.value = 40;
      const sqg = ctx.createGain();
      sqg.gain.value = 0.5;
      sq.connect(sqg);
      sqg.connect(am.gain);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(bp);
      bp.connect(am);
      am.connect(g);
      g.connect(v.g);
      sq.start(t);
      let tt = t;
      for (let i = 0; i < n; i++) {
        bp.frequency.setValueAtTime(1500, tt);
        bp.frequency.linearRampToValueAtTime(2000, tt + 0.1);
        bp.frequency.linearRampToValueAtTime(1600, tt + 0.3);
        pulse(g.gain, tt, 1, 0.02, 0.18, 0.1);
        tt += 0.3 + R(0.25, 0.45);
      }
      v.add(sq, tt);
      return v.add(s, tt);
    },
    skylark(v, t) {
      const len = R(8, 15);
      const c = oscChain(v, t, 'sine', 3000);
      let tt = t;
      let base = R(3000, 3400);
      while (tt < t + len) {
        const k = (tt - t) / len;
        const d = R(0.03, 0.06);
        const f = base * (1 + 0.25 * k) * R(0.95, 1.35);
        c.f.setValueAtTime(Math.min(5200, f), tt);
        c.f.exponentialRampToValueAtTime(Math.min(5600, f * R(0.9, 1.15)), tt + d);
        pulse(c.a, tt, R(0.6, 1) * (1 - 0.6 * k), 0.004, d * 0.4, d * 0.6 - 0.004);
        tt += d + R(0.008, 0.03);
        if (rnd() < 0.04) tt += R(0.1, 0.25); // petite respiration
      }
      return v.add(c.o, tt + 0.02);
    },
    hoopoe(v, t) {
      const c = oscChain(v, t, 'sine', 500);
      const h = oscChain(v, t, 'sine', 1000);
      let tt = t;
      for (let i = 0; i < 3; i++) {
        pulse(c.a, tt, 1, 0.015, 0.04, 0.025);
        pulse(h.a, tt, 0.25, 0.015, 0.04, 0.025);
        tt += 0.08 + 0.12;
      }
      v.add(h.o, tt);
      return v.add(c.o, tt);
    },
    kingfisher(v, t) {
      const c = oscChain(v, t, 'sine', 3500);
      let tt = t;
      for (let i = 0; i < 2; i++) {
        c.f.setValueAtTime(3600, tt);
        c.f.linearRampToValueAtTime(3400, tt + 0.15);
        pulse(c.a, tt, 1, 0.01, 0.1, 0.04);
        tt += 0.15 + R(0.1, 0.16);
      }
      return v.add(c.o, tt);
    },
    heron(v, t) {
      const c = oscChain(v, t, 'sawtooth', 300, null);
      const bp = filter('bandpass', 900, 1.5);
      c.g.disconnect();
      c.g.connect(bp);
      bp.connect(v.g);
      c.f.setValueAtTime(300, t);
      c.f.linearRampToValueAtTime(250, t + 0.4);
      pulse(c.a, t, 1, 0.02, 0.22, 0.16);
      return v.add(c.o, t + 0.42);
    },
    cuckoo(v, t) {
      const c = oscChain(v, t, 'sine', 650);
      let tt = t;
      const pairs = RI(1, 3);
      for (let i = 0; i < pairs; i++) {
        c.f.setValueAtTime(650, tt);
        pulse(c.a, tt, 1, 0.03, 0.15, 0.07);
        c.f.setValueAtTime(545, tt + 0.33);
        pulse(c.a, tt + 0.33, 0.9, 0.03, 0.17, 0.1);
        tt += 0.33 + 0.3 + R(0.5, 0.7);
      }
      return v.add(c.o, tt);
    },
    whiteStork(v, t) {
      const s = noiseSrc(t);
      const bp = filter('bandpass', 1500, 2);
      const bp2 = filter('peaking', 700, 3);
      bp2.gain.value = 6; // le bois creux du bec
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(bp);
      bp.connect(bp2);
      bp2.connect(g);
      g.connect(v.g);
      const dur = R(1.3, 1.7);
      let tt = t;
      while (tt < t + dur) {
        const k = (tt - t) / dur;
        const rate = 8 + 6 * Math.sin(Math.PI * k); // 8 → 14 → 8 par seconde
        pulse(g.gain, tt, R(0.75, 1), 0.0008, 0.0012, 0.003);
        tt += 1 / rate;
      }
      return v.add(s, tt + 0.02);
    },
    crane(v, t) {
      const bp = filter('bandpass', 1100, 1.8);
      bp.connect(v.g);
      const vib = ctx.createOscillator();
      vib.frequency.value = 7;
      const vg = ctx.createGain();
      vg.gain.value = 9;
      vib.connect(vg);
      vib.start(t);
      const a = oscChain(v, t, 'sawtooth', 560, bp);
      const b = oscChain(v, t, 'sawtooth', 590, bp);
      vg.connect(a.f);
      vg.connect(b.f);
      const calls = RI(2, 4);
      let end = t;
      for (let i = 0; i < calls; i++) {
        const ta = t + i * 0.85 + R(0, 0.08);
        a.f.setValueAtTime(520, ta);
        a.f.linearRampToValueAtTime(565, ta + 0.08);
        end = Math.max(end, pulse(a.a, ta, 1, 0.04, 0.3, 0.16));
        if (i < calls - 1 || rnd() < 0.5) {
          const tb = ta + R(0.3, 0.45);
          b.f.setValueAtTime(545, tb);
          b.f.linearRampToValueAtTime(595, tb + 0.08);
          end = Math.max(end, pulse(b.a, tb, 0.85, 0.04, 0.3, 0.16));
        }
      }
      v.add(vib, end + 0.02);
      v.add(b.o, end + 0.02);
      return v.add(a.o, end + 0.02);
    },
    oriole(v, t) {
      const c = oscChain(v, t, 'sine', 1300);
      const notes = [[R(1250, 1400), R(1450, 1600), R(0.09, 0.12)], [R(1750, 1950), R(1700, 1900), R(0.09, 0.13)],
        [R(1450, 1600), R(1650, 1800), R(0.1, 0.14)], [R(1200, 1300), R(1150, 1250), R(0.14, 0.18)]];
      let tt = t;
      for (const [f0, f1, d] of notes) {
        c.f.setValueAtTime(f0, tt);
        c.f.linearRampToValueAtTime(f1, tt + d);
        pulse(c.a, tt, 1, 0.012, d * 0.55, d * 0.45 - 0.012);
        tt += d + 0.025;
      }
      return v.add(c.o, tt);
    },
    redDeer(v, t) {
      const c = oscChain(v, t, 'sawtooth', 140, null);
      // Passe-bas 600 Hz (lointain) et formant « ô » vers 480 Hz : les harmoniques portent le brame jusque dans un
      // haut-parleur de téléphone (qui ne rend rien sous 300 Hz).
      const lp = filter('lowpass', 600, 1.2);
      const formant = filter('peaking', 480, 2.5);
      formant.gain.value = 9;
      c.g.disconnect();
      c.g.connect(formant);
      formant.connect(lp);
      lp.connect(v.g);
      c.f.setValueAtTime(140, t);
      c.f.exponentialRampToValueAtTime(90, t + 1.2);
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.linearRampToValueAtTime(520, t + 1.2);
      pulse(c.a, t, 1, 0.18, 0.7, 0.32);
      return v.add(c.o, t + 1.22);
    },
    beaver(v, t) {
      const s = noiseSrc(t);
      const lp = filter('lowpass', 600, 0.8);
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(lp);
      lp.connect(g);
      g.connect(v.g);
      pulse(g.gain, t, 0.6, 0.004, 0.03, 0.17);
      // l'eau qui gicle : le même bruit, plus clair et plus bref (s'entend sur un téléphone)
      const bp = filter('bandpass', 1100, 0.9);
      const sg = ctx.createGain();
      sg.gain.value = 0;
      s.connect(bp);
      bp.connect(sg);
      sg.connect(v.g);
      pulse(sg.gain, t + 0.005, 1.2, 0.003, 0.02, 0.09);
      const c = oscChain(v, t, 'sine', 120);
      c.f.setValueAtTime(130, t);
      c.f.exponentialRampToValueAtTime(70, t + 0.2);
      pulse(c.a, t, 0.8, 0.004, 0.02, 0.18);
      // deux gouttes qui retombent
      const d = oscChain(v, t, 'sine', 1800);
      for (let i = 0; i < 2; i++) {
        const td = t + 0.22 + i * R(0.08, 0.16);
        const f = R(1500, 2400);
        d.f.setValueAtTime(f, td);
        d.f.exponentialRampToValueAtTime(f * 1.3, td + 0.025);
        pulse(d.a, td, 0.25, 0.002, 0.005, 0.018);
      }
      v.add(d.o, t + 0.6);
      v.add(c.o, t + 0.22);
      return v.add(s, t + 0.22);
    },
  };

  /** Place d'un chant : vue → spatial ; ferme → un peu partout autour (panoramique et distance au hasard). */
  function placeOf(b) {
    if (where() === 'view' && Number.isFinite(b.x)) {
      const s = spatial(b, listener);
      return { gain: s.gain, pan: s.pan };
    }
    return { gain: R(0.6, 1), pan: R(-0.45, 0.45) };
  }

  /** Joue une phrase du chant `id` à l'instant t. Renvoie l'instant de fin (ou 0 si refusé). */
  function sing(id, t, b = {}, { force = false, volume = 1 } = {}) {
    const fn = SONGS[id];
    if (!fn) return 0;
    if (!force && voices >= maxVoices) return 0;
    const p = force && !Number.isFinite(b.x) ? { gain: 1, pan: 0 } : placeOf(b);
    const v = openVoice(t, (SONG_GAIN[id] ?? 0.1) * p.gain * volume, p.pan);
    fn(v, t);
    const end = v.close();
    lastEnd.set(id, end);
    return end;
  }

  // ── Couches continues ──
  function layerTarget(id) {
    if (!scape || !scape.on || stopped) return 0;
    const lvl = (scape.layers && scape.layers[id]) || 0;
    if (lvl <= 0) return 0;
    let g = lvl * LAYER_GAIN[id];
    if (where() === 'view') g *= spatial(NATURE_SOURCES[id].view, listener).gain;
    return g;
  }
  function layerPan(id) {
    if (where() !== 'view') return id === 'brook' ? -0.15 : id === 'crickets' ? 0.2 : 0;
    return spatial(NATURE_SOURCES[id].view, listener).pan;
  }
  function brookCut() {
    const tone = scape && scape.brook;
    return tone === 'frozen' ? 700 : tone === 'far' ? 900 : 6000;
  }

  const BUILD = {
    brook(L, t) {
      const s = noiseSrc(t);
      const bp = filter('bandpass', 900, 0.6);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = ctx.createGain();
      lg.gain.value = 300;
      lfo.connect(lg);
      lg.connect(bp.frequency);
      lfo.start(t);
      const lp = filter('lowpass', brookCut(), 0.5);
      s.connect(bp);
      bp.connect(lp);
      lp.connect(L.g);
      L.lp = lp;
      L.sources.push(s, lfo);
      L.next = t;
    },
    mill(L, t) {
      L.next = t + 0.3;
    },
    leaves(L, t) {
      const s = noiseSrc(t);
      const hp = filter('highpass', 1200, 0.5);
      const lp = filter('lowpass', 5000, 0.5);
      const gust = ctx.createGain();
      gust.gain.value = 0.55;
      for (const [f, d] of [[0.07, 0.3], [0.19, 0.15]]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = d;
        o.connect(og);
        og.connect(gust.gain);
        o.start(t, 0);
        L.sources.push(o);
      }
      s.connect(hp);
      hp.connect(lp);
      lp.connect(gust);
      gust.connect(L.g);
      L.sources.push(s);
    },
    crickets(L, t) {
      const n = detail === 'light' ? 1 : 2;
      const am = ctx.createOscillator();
      am.type = 'square';
      am.frequency.value = 28;
      const amLp = filter('lowpass', 220, 0.5); // arrondit les fronts : des pulsations, pas des clics
      am.connect(amLp);
      am.start(t);
      L.sources.push(am);
      L.gates = [];
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator();
        o.frequency.value = i ? 5100 : 4200;
        const amg = ctx.createGain();
        amg.gain.value = 0.5;
        const depth = ctx.createGain();
        depth.gain.value = 0.5;
        amLp.connect(depth);
        depth.connect(amg.gain);
        const gate = ctx.createGain();
        gate.gain.value = 0;
        o.connect(amg);
        amg.connect(gate);
        gate.connect(L.g);
        o.start(t);
        L.sources.push(o);
        L.gates.push({ g: gate, next: t + R(0, 0.5) });
      }
    },
    frogs(L, t) {
      L.next = t + R(0, 0.5);
    },
  };

  /** Événements des couches dans la fenêtre [t0, t1[ (gouttes, tours du moulin, trains de grillons, croassements). */
  const EVENTS = {
    brook(L, t0, t1) {
      const lvl = (scape && scape.layers.brook) || 0;
      let rate = 2 + 4 * lvl;
      if (scape && scape.brook === 'frozen') rate /= 3;
      if (scape && scape.brook === 'far') rate = 0; // de loin : le murmure seul
      if (detail === 'light') rate /= 2;
      if (rate <= 0) return;
      while (L.next < t1) {
        if (L.next >= t0) {
          const td = L.next;
          const o = ctx.createOscillator();
          const f = R(1400, 3000);
          o.frequency.setValueAtTime(f, td);
          o.frequency.exponentialRampToValueAtTime(f * 1.3, td + 0.025);
          const g = ctx.createGain();
          g.gain.value = 0;
          pulse(g.gain, td, R(0.04, 0.1), 0.002, 0.006, 0.017);
          o.connect(g);
          g.connect(L.g);
          o.start(td);
          o.stop(td + 0.03);
          o.onended = () => g.disconnect();
        }
        L.next += -Math.log(1 - rnd() * 0.999) / rate;
      }
    },
    mill(L, t0, t1) {
      while (L.next < t1) {
        const tm = Math.max(L.next, t0);
        // grincement de l'axe
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(85 * R(0.97, 1.03), tm);
        o.frequency.linearRampToValueAtTime(80, tm + 0.45);
        const bp = filter('bandpass', 420, 4);
        const g = ctx.createGain();
        g.gain.value = 0;
        pulse(g.gain, tm, 0.6, 0.12, 0.13, 0.2);
        o.connect(bp);
        bp.connect(g);
        g.connect(L.g);
        o.start(tm);
        o.stop(tm + 0.47);
        o.onended = () => g.disconnect();
        // trois éclaboussures des aubes
        const s = noiseSrc(tm + 0.5, 2.2);
        const sb = filter('bandpass', 2200, 1.2);
        const sg = ctx.createGain();
        sg.gain.value = 0;
        for (let i = 0; i < 3; i++) pulse(sg.gain, tm + 0.6 + i * 0.6 + R(-0.05, 0.05), R(0.25, 0.4), 0.008, 0.02, 0.052);
        s.connect(sb);
        sb.connect(sg);
        sg.connect(L.g);
        s.onended = () => sg.disconnect();
        L.next = tm + 2.4;
      }
    },
    leaves() {},
    crickets(L, t0, t1) {
      for (const gate of L.gates || []) {
        while (gate.next < t1) {
          const tg = Math.max(gate.next, t0);
          pulse(gate.g.gain, tg, 1, 0.012, 0.28, 0.012);
          gate.next = tg + 0.3 + R(0.2, 1);
        }
      }
    },
    frogs(L, t0, t1) {
      const lvl = Math.min(1, (scape && scape.layers.frogs) || 0);
      let rate = 0.5 + 1.5 * lvl;
      if (detail === 'light') rate *= 0.6;
      while (L.next < t1) {
        L.ends = (L.ends || []).filter((e) => e > L.next);
        if (L.next >= t0 && L.ends.length < 2) {
          const tf = L.next;
          const k = R(0.85, 1.15); // chaque grenouille sa voix
          const g = ctx.createGain();
          g.gain.value = 0;
          g.connect(L.g);
          const n = RI(4, 6);
          let tt = tf;
          for (let i = 0; i < n; i++) {
            pulse(g.gain, tt, 1, 0.003, 0.009, 0.003);
            tt += 0.03;
          }
          const os = [];
          for (const [m, a] of [[1, 1], [2, 0.3]]) {
            const o = ctx.createOscillator();
            o.frequency.value = 380 * k * m;
            const og = ctx.createGain();
            og.gain.value = a;
            o.connect(og);
            og.connect(g);
            o.start(tf);
            o.stop(tt + 0.01);
            os.push(o);
          }
          L.ends.push(tt + 0.01); // au plus 2 croassements qui se chevauchent
          os[0].onended = () => g.disconnect();
        }
        L.next += -Math.log(1 - rnd() * 0.999) / rate;
      }
    },
  };

  function startLayer(id) {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0;
    const p = panner(layerPan(id));
    if (p) {
      g.connect(p);
      p.connect(out);
    } else g.connect(out);
    const L = { id, g, p, sources: [], stopAt: 0, next: t };
    BUILD[id](L, t + 0.01);
    layers[id] = L;
    return L;
  }
  function killLayer(L) {
    const t = ctx.currentTime;
    for (const s of L.sources) {
      try {
        s.stop(t + 0.05);
      } catch {
        /* déjà arrêtée */
      }
    }
    setTimer(() => {
      L.g.disconnect();
      if (L.p) L.p.disconnect();
    }, 150);
    delete layers[L.id];
  }

  /** Remet chaque couche à son niveau (fondu) : démarrage, réglage, arrêt différé. */
  function refreshLayers(tc = FADE_TC) {
    const t = ctx.currentTime;
    for (const id of LAYER_IDS) {
      const target = layerTarget(id);
      let L = layers[id];
      if (!L && target <= 0) continue;
      if (!L) L = startLayer(id);
      L.g.gain.setTargetAtTime(target, t, tc);
      if (L.p) L.p.pan.setTargetAtTime(layerPan(id), t, Math.min(tc, 0.3));
      if (id === 'brook' && L.lp) L.lp.frequency.setTargetAtTime(brookCut(), t, 1);
      L.stopAt = target <= 0 ? t + STOP_AFTER : 0;
    }
  }

  // ── Programmateur ──
  function advance(t0) {
    if (stopped) return;
    const t1 = t0 + TICK;
    for (const id of Object.keys(layers)) {
      const L = layers[id];
      if (L.stopAt && t0 >= L.stopAt) {
        killLayer(L);
        continue;
      }
      if (!L.stopAt) EVENTS[id](L, t0, t1);
    }
    if (!scape || !scape.on) return;
    for (const b of scape.birds || []) {
      if (!(rnd() < b.rate / 240)) continue;
      const ts = t0 + rnd() * TICK;
      if (ts < (lastEnd.get(b.id) || -Infinity) + SAME_SONG_GAP) continue;
      sing(b.id, ts, b);
    }
  }

  // Minuterie : 250 ms ; arrêtée quand l'application passe en arrière-plan (le contexte est suspendu par audio.js).
  let timer = null;
  const pendingTimers = new Set();
  function setTimer(fn, ms) {
    if (typeof setTimeout !== 'function') return fn();
    const id = setTimeout(() => {
      pendingTimers.delete(id);
      fn();
    }, ms);
    pendingTimers.add(id);
    return id;
  }
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  function tick() {
    if (stopped || hidden() || (ctx.state && ctx.state !== 'running')) return;
    advance(ctx.currentTime + LEAD);
  }
  function startTimer() {
    if (manual || timer || stopped || hidden()) return;
    timer = setInterval(tick, TICK * 1000);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }
  function onVisibility() {
    if (hidden()) stopTimer();
    else startTimer();
  }
  if (!manual && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  startTimer();

  return {
    /** Paysage à jouer (natureScape) ; null ou { on: false } : tout se tait en fondu. */
    set(next) {
      if (stopped) return;
      scape = next && next.on ? next : null;
      maxVoices = Math.min(scape ? scape.maxVoices || MAX_VOICES[detail] : 0, MAX_VOICES[detail]);
      echoOn = !!(scape && scape.echo);
      applyEcho();
      refreshLayers();
    },
    /** Vue : centre de l'écran (px du monde) ; ne change que des gains et des panoramiques. */
    setListener(l = {}) {
      if (stopped) return;
      listener = { y: Number.isFinite(l.y) ? l.y : listener.y, h: Number.isFinite(l.h) ? l.h : listener.h };
      if (where() === 'view') refreshLayers(0.12);
    },
    setDetail(mode) {
      const next = mode === 'light' ? 'light' : 'full';
      if (next === detail) return;
      detail = next;
      maxVoices = Math.min(scape ? scape.maxVoices || MAX_VOICES[detail] : 0, MAX_VOICES[detail]);
      applyEcho();
      // Les grillons changent de nombre de voix : on rebâtit la couche (fondu croisé court).
      const L = layers.crickets;
      if (L) {
        L.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        setTimer(() => killLayer(L), 500);
        delete layers.crickets;
      }
      refreshLayers();
    },
    /**
     * (Débogage) Joue un son de la vallée tout de suite, même s'il n'est pas dans le paysage : une phrase d'un chant,
     * ou `seconds` (6) d'une couche au niveau `level` (0,6). Renvoie true si quelque chose joue.
     */
    play(id, o = {}) {
      if (stopped) return false;
      const src = NATURE_SOURCES[id];
      if (!src) return false;
      const t = ctx.currentTime + LEAD;
      if (src.kind === 'song') return sing(id, t, {}, { force: true, volume: o.volume ?? 1 }) > 0;
      const prev = scape;
      const layersNow = { ...((prev && prev.layers) || {}), [id]: o.level ?? 0.6 };
      scape = { ...(prev || { on: true, where: 'farm', birds: [], maxVoices: MAX_VOICES[detail], echo: false, brook: 'open' }), on: true, layers: layersNow };
      if (id === 'brook' && !scape.brook) scape.brook = 'open';
      const temp = scape;
      refreshLayers(0.3);
      const seconds = o.seconds ?? 6;
      setTimer(() => {
        if (stopped || scape !== temp) return;
        scape = prev;
        refreshLayers(0.5);
      }, seconds * 1000);
      if (manual) for (let tt = ctx.currentTime; tt < ctx.currentTime + seconds; tt += TICK) advance(tt);
      return true;
    },
    /** Fondu court, puis tout est déconnecté et la minuterie arrêtée. */
    stop() {
      if (stopped) return;
      stopped = true;
      stopTimer();
      if (!manual && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      const t = ctx.currentTime;
      outFade.gain.cancelScheduledValues(t);
      outFade.gain.setValueAtTime(outFade.gain.value, t);
      outFade.gain.linearRampToValueAtTime(0, t + 0.25);
      const finish = () => {
        for (const L of Object.values(layers)) killLayer(L);
        try {
          outFade.disconnect();
        } catch {
          /* déjà fait */
        }
      };
      setTimer(finish, 350);
    },
    advance,
    get voices() {
      return voices;
    },
    get layers() {
      return Object.keys(layers).length;
    },
    get detail() {
      return detail;
    },
    get stopped() {
      return stopped;
    },
    stats() {
      return {
        detail,
        voices,
        maxVoices,
        layers: Object.fromEntries(Object.entries(layers).map(([id, L]) => [id, Math.round(L.g.gain.value * 1000) / 1000])),
        birds: scape ? scape.birds.map((b) => `${b.id} ${b.rate}/min`) : [],
        echo: echoOn && detail === 'full',
        where: where(),
        listener,
      };
    },
    /** Noms des chants synthétisés (débogage). */
    songs: Object.keys(SONGS),
    output: out,
  };
}
