// Le Pouls et la musique générative.
// Le Conducteur est l'horloge maîtresse du jeu : la Justesse, la propagation de
// la Cendre et la partition partagent la même pulsation.

import { audioReady, audioCtx } from './audio.js';
import { pluck, flute, wood, breath, drop } from './synth.js';
import { Rng } from '../core/rng.js';
import { emit } from '../core/events.js';
import { DEGREES, DEGREE_INFO, degreeFreq } from '../game/scales.js';

function clockNow() {
  const ctx = audioCtx();
  return ctx ? ctx.currentTime : performance.now() / 1000;
}

export class Conductor {
  constructor(bpm = 96) {
    this.bpm = bpm;
    this.spb = 60 / bpm;
    this.startTime = clockNow();
    this.beat = 0;
    this.running = false;
    this.pausedAt = 0;
  }

  start(bpm) {
    if (bpm) { this.bpm = bpm; this.spb = 60 / bpm; }
    this.startTime = clockNow();
    this.beat = 0;
    this.running = true;
  }

  pause() { if (this.running) { this.pausedAt = clockNow(); this.running = false; } }
  resume() {
    if (!this.running && this.pausedAt) {
      this.startTime += clockNow() - this.pausedAt;
      this.running = true;
      this.pausedAt = 0;
    }
  }

  setBpm(bpm) {
    // On recale l'origine pour ne pas faire sauter la pulsation en cours.
    const elapsed = clockNow() - this.startTime;
    const beats = elapsed / this.spb;
    this.bpm = bpm;
    this.spb = 60 / bpm;
    this.startTime = clockNow() - beats * this.spb;
  }

  elapsed() { return (this.running ? clockNow() : this.pausedAt) - this.startTime; }
  beatFloat() { return this.elapsed() / this.spb; }
  phase() { const b = this.beatFloat(); return b - Math.floor(b); }

  // Écart signé à la pulsation la plus proche, en secondes. C'est la Justesse.
  offset() {
    const p = this.phase();
    return (p < 0.5 ? p : p - 1) * this.spb;
  }

  // Renvoie le nombre de pulsations franchies depuis le dernier appel.
  poll() {
    if (!this.running) return 0;
    const b = Math.floor(this.beatFloat());
    const passed = b - this.beat;
    if (passed > 0) this.beat = b;
    return passed > 8 ? 1 : passed;
  }
}

// --- Partition générative ---------------------------------------------------
// Pas de boucle enregistrée : à chaque pulsation, la musique décide quoi jouer
// selon le biome, la tension (Cendre) et l'élan du joueur (chaîne).

const PATTERNS = {
  bois:    { bass: [0, 4], arp: [0, 2, 4, 2], perc: [0, 2], flute: 0.14 },
  verre:   { bass: [0, 6], arp: [0, 3, 5, 3], perc: [2], flute: 0.22 },
  braise:  { bass: [0, 2, 4, 6], arp: [0, 1, 2, 3, 4, 5], perc: [0, 1, 2, 3], flute: 0.06 },
  souffle: { bass: [0, 4], arp: [0, 2, 3, 5], perc: [0, 3], flute: 0.18 },
  sourd:   { bass: [0], arp: [0, 4], perc: [0, 2, 4, 6], flute: 0.04 },
};

export class Score {
  constructor(conductor) {
    this.cond = conductor;
    this.rng = new Rng(1337);
    this.biome = null;
    this.intensity = 0.3;
    this.tension = 0;
    this.enabled = true;
    this.silenced = 0;
    this.bar = 0;
    this.melodyIdx = 0;
  }

  setBiome(biome) {
    this.biome = biome;
    this.pattern = PATTERNS[biome.ambience.pad] || PATTERNS.bois;
    this.rng = new Rng(biome.id + ':' + Math.floor(Math.random() * 1000));
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }
  setTension(v) { this.tension = Math.max(0, Math.min(1, v)); }
  silence(seconds) { this.silenced = seconds; }

  update(dt) { if (this.silenced > 0) this.silenced -= dt; }

  onBeat(beatIndex) {
    if (!this.enabled || !audioReady() || !this.biome) return;
    if (this.silenced > 0) return;

    const p = this.pattern;
    const step = beatIndex % 8;
    const transpose = this.biome.transpose || 0;
    const bar = Math.floor(beatIndex / 8);
    if (bar !== this.bar) { this.bar = bar; this.melodyIdx = 0; }

    // Bourdon grave : présent en permanence, plus sombre quand la Cendre monte.
    if (p.bass.includes(step)) {
      const root = DEGREES[0];
      flute(degreeFreq(root, -2, transpose), {
        dur: this.cond.spb * 2.4,
        gain: 0.075 + this.tension * 0.05,
        pan: -0.15,
      });
    }

    // Arpège de cordes : le squelette mélodique.
    if (p.arp.includes(step)) {
      const degIdx = this.rng.int(0, DEGREES.length - 1);
      const oct = this.rng.chance(0.25) ? 1 : 0;
      pluck(degreeFreq(DEGREES[degIdx], oct, transpose), {
        dur: this.cond.spb * 2.2,
        gain: 0.09 + this.intensity * 0.08,
        pan: this.rng.range(-0.5, 0.5),
        damping: 0.997,
        brightness: 0.4,
        busName: 'music',
      });
    }

    // Percussion boisée : très discrète, elle donne le tempo sans marteler.
    if (p.perc.includes(step)) {
      wood({ freq: 260 + this.rng.range(-40, 60), gain: 0.05 + this.intensity * 0.04, decay: 0.07, pan: this.rng.range(-0.3, 0.3) });
    }

    // Gouttes d'eau selon le biome.
    if (this.biome.ambience.water > 0 && this.rng.chance(this.biome.ambience.water * 0.25)) {
      drop({ freq: 800 + this.rng.range(0, 700), gain: 0.05, pan: this.rng.range(-0.8, 0.8) });
    }

    // Vent.
    if (this.rng.chance(this.biome.ambience.wind * 0.12)) {
      breath({ dur: 1.6, gain: 0.035, from: 400, to: 1800, q: 0.7, pan: this.rng.range(-0.7, 0.7) });
    }

    // Phrase de flûte, seulement quand le joueur va bien : la musique récompense.
    if (step === 0 && this.rng.chance(p.flute + this.intensity * 0.25)) {
      const phrase = this.rng.shuffle(DEGREES).slice(0, this.rng.int(2, 4));
      phrase.forEach((d, i) => {
        flute(degreeFreq(d, 0, transpose), {
          dur: this.cond.spb * 0.8,
          gain: 0.09,
          delay: i * this.cond.spb * 0.5,
          pan: 0.2,
        });
      });
    }
  }
}

// Un « tic » très doux sur chaque pulsation, pour que la Justesse s'apprenne
// à l'oreille avant de s'apprendre à l'œil.
export function beatTick(strong = false) {
  wood({ freq: strong ? 620 : 380, gain: strong ? 0.10 : 0.055, decay: 0.05, q: 9 });
}

export function fanfare(transpose = 0) {
  const seq = ['I', 'III', 'V', 'VI'];
  seq.forEach((d, i) => {
    pluck(degreeFreq(d, i > 2 ? 1 : 0, transpose), {
      dur: 2.2, gain: 0.3, delay: i * 0.11, damping: 0.998, brightness: 0.5,
    });
  });
}

export function sadCadence(transpose = 0) {
  ['VI', 'V', 'I'].forEach((d, i) => {
    pluck(degreeFreq(d, i === 2 ? -1 : 0, transpose), {
      dur: 2.6, gain: 0.24, delay: i * 0.28, damping: 0.9985, brightness: 0.3,
    });
  });
}

export const DEGREE_NAMES = Object.fromEntries(DEGREES.map((d) => [d, DEGREE_INFO[d].name]));
