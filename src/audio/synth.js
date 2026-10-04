// Sons synthétisés (lot 2 « Toucher & surprises ») : notes douces façon marimba pour la récolte en série
// (gamme pentatonique qui monte à chaque parcelle d'un même glissé), scintillements des récoltes belles et
// dorées, petite fanfare du légume géant, bruit sourd du semis, éclaboussure de l'arrosoir, carillon des
// surprises de l'aube, souffle de l'étoile filante.
//
//   const synth = createSynth(ctx, destination)   ctx : AudioContext ou OfflineAudioContext
//   synth.note(step, { when, volume })            step 0, 1, 2… : note de la série (comboMidi)
//   synth.play(name, { when, volume })            'belle' | 'gold' | 'fanfare' | 'thud' | 'splash' | 'pop'
//                                                 | 'chime' | 'wish' | 'magic' | 'reveal' | 'chirp'
//                                                 | 'clatter' (V4 : cigognes qui claquent du bec)
//                                                 | 'legend' (V4 : une légende se réveille)
//   synth.voices                                  voix en cours (limite : MAX_VOICES)
//
// Tout passe par un compresseur doux (aucune saturation, même avec 12 notes qui se chevauchent) ; le volume
// final suit le bus des effets sonores du joueur (destination). Pas de fichier : rien à télécharger.

// Gamme pentatonique majeure (do ré mi sol la), à partir de mi 4 : douce, jamais criarde.
export const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_MIDI = 64; // mi 4
const BASE_DEGREE = 2; // mi = 3e degré de la gamme de do
export const COMBO_TOP = 11; // au-delà, la série reste sur les deux notes du haut (sol 6 au plus)
const MAX_VOICES = 42; // oscillateurs simultanés (une note de marimba en utilise 3)

/** Hauteur MIDI de la note n° step d'une série (0 = mi 4 ; monte d'un degré pentatonique à chaque fois). */
export function comboMidi(step) {
  let s = Math.max(0, Math.floor(step || 0));
  if (s > COMBO_TOP) s = COMBO_TOP - 1 + ((s - COMBO_TOP + 1) % 2); // alterne les deux notes du haut
  const d = BASE_DEGREE + s;
  const octave = Math.floor(d / PENTATONIC.length);
  const deg = d % PENTATONIC.length;
  return 60 + octave * 12 + PENTATONIC[deg] + (BASE_MIDI - 64);
}

export function midiFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function createSynth(ctx, destination) {
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  // Compresseur « filet de sécurité » : n'agit que sur les pics (série rapide, fanfare).
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  out.connect(comp);
  comp.connect(destination);
  // Douceur : on coupe les aigus agressifs.
  let voices = 0;
  let noiseBuf = null;

  function track(node, end) {
    voices++;
    node.onended = () => {
      voices = Math.max(0, voices - 1);
    };
    node.stop(end);
  }

  /** Enveloppe percussive : montée très courte, puis décroissance exponentielle. */
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Une lame de marimba : fondamentale + partiel à ~3,9 × (bref) + octave douce, filtrée. */
  function mallet(freq, t, vol, decay = 0.55, dest = out, bright = 1) {
    if (voices + 3 > MAX_VOICES) return false;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, 2600 + freq * 1.6 * bright);
    lp.Q.value = 0.4;
    lp.connect(dest);
    const parts = [
      [1, 'sine', vol, decay],
      [3.93, 'sine', vol * 0.22 * bright, Math.min(0.12, decay * 0.25)],
      [2, 'triangle', vol * 0.07, decay * 0.5],
    ];
    const end = t + decay + 0.08;
    for (const [mult, type, v, d] of parts) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      env(g, t, v, 0.004, d);
      o.connect(g);
      g.connect(lp);
      o.start(t);
      track(o, end);
    }
    return true;
  }

  /** Clochette (carillon) : partiels inharmoniques doux, longue queue. */
  function bell(freq, t, vol, decay = 1.1) {
    if (voices >= MAX_VOICES) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    lp.connect(out);
    const end = t + decay + 0.1;
    for (const [mult, v, d] of [[1, vol, decay], [2.76, vol * 0.35, decay * 0.5], [5.4, vol * 0.12, decay * 0.25]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      const g = ctx.createGain();
      env(g, t, v, 0.003, d);
      o.connect(g);
      g.connect(lp);
      o.start(t);
      track(o, end);
    }
  }

  /** Cuivre doux (fanfare) : dent de scie très filtrée, attaque un peu lente. */
  function horn(freq, t, vol, dur) {
    if (voices >= MAX_VOICES) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 1.003;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1500 + freq, t + 0.06);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.035);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    g.connect(out);
    o.start(t);
    o2.start(t);
    track(o, t + dur + 0.15);
    track(o2, t + dur + 0.15);
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    const n = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    return noiseBuf;
  }

  /** Souffle filtré (éclaboussure, poussière, étoile filante). */
  function hiss(t, vol, dur, type, f0, f1, q = 0.8) {
    if (voices >= MAX_VOICES) return;
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    bp.Q.value = q;
    const g = ctx.createGain();
    env(g, t, vol, 0.01, dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(t);
    track(src, t + dur + 0.05);
  }

  /** Bruit sourd (semis) : sinus grave qui descend. */
  function thud(t, vol) {
    if (voices >= MAX_VOICES) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.14);
    const g = ctx.createGain();
    env(g, t, vol, 0.006, 0.17);
    o.connect(g);
    g.connect(out);
    o.start(t);
    track(o, t + 0.25);
    hiss(t, vol * 0.25, 0.08, 'lowpass', 900, 300, 0.5);
  }

  const SOUNDS = {
    // Récolte « belle » : deux petites notes claires, au-dessus de la note de la série.
    belle(t, v) {
      mallet(midiFreq(88), t + 0.05, 0.12 * v, 0.35);
      mallet(midiFreq(93), t + 0.12, 0.1 * v, 0.45);
    },
    // Récolte dorée : arpège scintillant + clochette.
    gold(t, v) {
      const notes = [84, 88, 91, 96];
      notes.forEach((m, i) => mallet(midiFreq(m), t + 0.06 + i * 0.055, 0.11 * v, 0.5, out, 1.4));
      bell(midiFreq(100), t + 0.3, 0.06 * v, 1.4);
    },
    // Légume géant : petite fanfare (do mi sol do, accord final).
    fanfare(t, v) {
      const seq = [[60, 0, 0.12], [64, 0.13, 0.12], [67, 0.26, 0.12], [72, 0.4, 0.55]];
      for (const [m, d, dur] of seq) horn(midiFreq(m), t + d, 0.09 * v, dur);
      horn(midiFreq(64 + 12), t + 0.4, 0.05 * v, 0.55);
      horn(midiFreq(67), t + 0.4, 0.05 * v, 0.55);
      [84, 88, 91].forEach((m, i) => mallet(midiFreq(m), t + 0.42 + i * 0.07, 0.07 * v, 0.6));
    },
    thud(t, v) {
      thud(t, 0.5 * v);
    },
    splash(t, v) {
      hiss(t, 0.32 * v, 0.22, 'bandpass', 2400, 900, 0.9);
      mallet(midiFreq(81), t + 0.02, 0.06 * v, 0.12);
    },
    pop(t, v) {
      if (voices >= MAX_VOICES) return;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(980, t + 0.06);
      const g = ctx.createGain();
      env(g, t, 0.22 * v, 0.004, 0.09);
      o.connect(g);
      g.connect(out);
      o.start(t);
      track(o, t + 0.15);
    },
    // Surprise de l'aube : carillon doux (sol do mi sol).
    chime(t, v) {
      [79, 84, 88, 91].forEach((m, i) => bell(midiFreq(m), t + i * 0.12, 0.07 * v, 1.2));
    },
    // Magie de la fée : glissando pentatonique rapide.
    magic(t, v) {
      for (let i = 0; i < 8; i++) mallet(midiFreq(comboMidi(4 + i)), t + i * 0.045, 0.06 * v, 0.4, out, 1.3);
      bell(midiFreq(96), t + 0.4, 0.05 * v, 1.6);
    },
    // Étoile filante : souffle qui descend + clochette.
    wish(t, v) {
      hiss(t, 0.08 * v, 0.7, 'bandpass', 5200, 1400, 2.5);
      bell(midiFreq(91), t + 0.45, 0.06 * v, 1.6);
      bell(midiFreq(96), t + 0.6, 0.04 * v, 1.6);
    },
    // (Lot 4) Gazouillis d'un oiseau de la mangeoire : trois notes aiguës brèves qui glissent vers le haut.
    chirp(t, v) {
      for (let i = 0; i < 3; i++) {
        if (voices >= MAX_VOICES) return;
        const t0 = t + i * 0.09 + (i === 2 ? 0.05 : 0);
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f0 = 2600 + i * 260;
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + 0.05);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.1, t0 + 0.08);
        const g = ctx.createGain();
        env(g, t0, 0.07 * v, 0.004, 0.07);
        o.connect(g);
        g.connect(out);
        o.start(t0);
        track(o, t0 + 0.12);
      }
    },
    // (V4) Cigognes : claquement de bec, clics de bois creux (bruit passe-bande 1,5 kHz + résonance 700 Hz) qui
    // accélèrent de 8 à 14 par seconde puis ralentissent, 1,5 s ; un tampon de bruit, un filtre, une enveloppe.
    clatter(t, v) {
      if (voices >= MAX_VOICES) return;
      const src = ctx.createBufferSource();
      src.buffer = noise();
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 2;
      const wood = ctx.createBiquadFilter();
      wood.type = 'peaking';
      wood.frequency.value = 700;
      wood.Q.value = 3;
      wood.gain.value = 6;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(bp);
      bp.connect(wood);
      wood.connect(g);
      g.connect(out);
      const dur = 1.5;
      let tt = t;
      let i = 0;
      while (tt < t + dur) {
        const k = (tt - t) / dur;
        const peak = (0.3 + 0.08 * Math.sin(i * 2.1)) * v; // bec gauche, bec droit : un peu inégal
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(peak, tt + 0.0008);
        g.gain.linearRampToValueAtTime(0, tt + 0.005);
        tt += 1 / (8 + 6 * Math.sin(Math.PI * k));
        i++;
      }
      src.start(t, (i * 0.137) % 0.4);
      track(src, tt + 0.02);
    },
    // (V4) Une légende se réveille : souffle doux qui monte, puis clochettes graves → aiguës (do mi sol la do) et une
    // note tenue chaude (marimba grave), comme une graine qui s'ouvre.
    legend(t, v) {
      hiss(t, 0.05 * v, 0.9, 'bandpass', 600, 3200, 1.6);
      mallet(midiFreq(60), t + 0.05, 0.12 * v, 1.4, out, 0.6);
      [72, 76, 79, 81, 84].forEach((m, i) => bell(midiFreq(m), t + 0.25 + i * 0.16, 0.055 * v, 1.3));
      bell(midiFreq(91), t + 1.15, 0.045 * v, 2);
    },
    // Trouvaille / coffre ouvert : arpège montant chaleureux.
    reveal(t, v) {
      [72, 76, 79, 84].forEach((m, i) => mallet(midiFreq(m), t + i * 0.08, 0.1 * v, 0.6));
      bell(midiFreq(88), t + 0.34, 0.05 * v, 1.2);
    },
  };

  return {
    /** Note n° step de la série de récolte (marimba). */
    note(step, opts = {}) {
      const t = Math.max(ctx.currentTime, opts.when ?? ctx.currentTime);
      const v = opts.volume ?? 1;
      return mallet(midiFreq(comboMidi(step)), t, 0.2 * v, 0.6);
    },
    play(name, opts = {}) {
      const fn = SOUNDS[name];
      if (!fn) return false;
      const t = Math.max(ctx.currentTime, opts.when ?? ctx.currentTime);
      fn(t, opts.volume ?? 1);
      return true;
    },
    get voices() {
      return voices;
    },
    names: Object.keys(SOUNDS),
    output: out,
  };
}
