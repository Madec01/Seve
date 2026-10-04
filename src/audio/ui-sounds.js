// Sons « doux » de l'interface (réglage « Sons de l'interface : Doux », par défaut) : petits sons feutrés,
// graves-médiums, calculés une fois (aucun fichier à télécharger) à la place des sons Kenney d'interface, jugés
// stridents sur téléphone (retour joueur : « swiiip » aigus de l'ouverture / fermeture des fiches et des onglets).
//
//   renderUiSound(name, sampleRate) → Float32Array | null   (null : pas de son, ex. le survol)
//   UI_SOUND_NAMES                                          sons d'interface (clés de AUDIO.sfx)
//   UI_SOUND_MODES                                          'normal' · 'soft' · 'off'
//   SOFT_UI[name]                                           recette : { level (dB, RMS sur 50 ms), … }
//
// Logique pure (aucun accès au DOM ni à Web Audio) : testable sous Node (tests/ui-sounds.test.js).
// Chaque son : attaque arrondie (≥ 2 ms, pas de claquement), passe-bas 24 dB/oct à 2,4 kHz (presque rien au-dessus
// de 4 kHz), fin à zéro, niveau calé en RMS (bien plus bas que les sons du jeu : récolte ≈ −19 dB, ici −31 à −40 dB).
// Le bruit est pseudo-aléatoire à graine fixe : le même son à chaque partie ; la variation de hauteur (±3 %) est
// appliquée à la lecture (src/audio/audio.js).

/** Sons d'interface : boutons, bascules, fiches, onglets, erreurs, avertissements, survol. */
export const UI_SOUND_NAMES = Object.freeze(['click', 'hover', 'toggle', 'open', 'close', 'page', 'confirm', 'error', 'warning']);
/** Valeurs permises du réglage « Sons de l'interface ». */
export const UI_SOUND_MODES = Object.freeze(['normal', 'soft', 'off']);

const LOWPASS_HZ = 2400; // passe-bas final (deux biquads en cascade : 24 dB/oct)

/**
 * Recettes. level : niveau visé (dB FS, RMS sur la fenêtre de 50 ms la plus forte) ; dur : durée totale (s).
 * Repères (fichiers Kenney d'origine, même mesure, volume du catalogue compris) : clic −22 dB, ouverture −17 dB,
 * onglet −27 dB, validation −13 dB ; sons du jeu : récolte −19 dB, pièces −20 dB.
 */
export const SOFT_UI = Object.freeze({
  // Bouton : petit « toc » de bois (lame courte vers 620 Hz, partiel boisé, souffle bref très filtré).
  click: { level: -31, dur: 0.11 },
  // Survol (souris seulement) : rien.
  hover: null,
  // Bascule, vitesse : « pop » mat qui descend un peu (560 → 430 Hz).
  toggle: { level: -32, dur: 0.12 },
  // Onglet, fiche d'information : frottement de papier très doux.
  page: { level: -37, dur: 0.15 },
  // Ouverture d'une fiche ou d'une fenêtre : souffle grave qui s'ouvre à peine.
  open: { level: -39, dur: 0.2 },
  // Fermeture : souffle grave plus court, qui retombe.
  close: { level: -41, dur: 0.15 },
  // Validation : deux notes de marimba (sol 4 → do 5), chaudes et courtes.
  confirm: { level: -29, dur: 0.42 },
  // Action impossible : deux « tocs » qui descendent (la 4 → fa 4), sans buzz.
  error: { level: -30, dur: 0.3 },
  // Avertissement : une quinte de marimba (mi 4 + la 4), douce.
  warning: { level: -31, dur: 0.5 },
});

// ── Outils de synthèse ──────────────────────────────────────────────────────────────

/** Bruit blanc pseudo-aléatoire, graine fixe (même son à chaque fois). */
function noise(n, seed = 0x5eed) {
  const out = new Float32Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 0x80000000 - 1;
  }
  return out;
}

/** Biquad (RBJ) appliqué en place ; f (Hz) peut varier : f(i) → fréquence. */
function biquad(x, sr, type, f, q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const freqAt = typeof f === 'function' ? f : () => f;
  let lastF = -1;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let i = 0; i < x.length; i++) {
    const fi = Math.min(sr * 0.45, Math.max(20, freqAt(i)));
    if (Math.abs(fi - lastF) > 0.5) {
      lastF = fi;
      const w = (2 * Math.PI * fi) / sr;
      const cos = Math.cos(w);
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      if (type === 'lowpass') {
        b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = b0;
      } else {
        // passe-bande (gain de crête 0 dB)
        b0 = alpha / a0; b1 = 0; b2 = -alpha / a0;
      }
      a1 = (-2 * cos) / a0;
      a2 = (1 - alpha) / a0;
    }
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

/**
 * Enveloppe : montée en cosinus (attack, s), puis décroissance exponentielle (tau, s) ; ou, avec hold, palier
 * arrondi (bruits). Commence à 0 (pas de claquement).
 */
function envAt(t, { attack, tau, hold = 0 }) {
  if (t < 0) return 0;
  if (t < attack) return 0.5 - 0.5 * Math.cos((Math.PI * t) / attack);
  const u = t - attack - hold;
  return u <= 0 ? 1 : Math.exp(-u / tau);
}

/** Ajoute un partiel sinusoïdal (glissando exponentiel f0 → f1 sur glide s) à partir de start (s). */
function addTone(out, sr, { start = 0, f0, f1 = f0, glide = 0.05, amp, attack, tau }) {
  let phase = 0;
  const i0 = Math.floor(start * sr);
  for (let i = i0; i < out.length; i++) {
    const t = (i - i0) / sr;
    const k = glide > 0 ? Math.min(1, t / glide) : 1;
    const f = f0 * (f1 / f0) ** k;
    phase += (2 * Math.PI * f) / sr;
    out[i] += amp * envAt(t, { attack, tau }) * Math.sin(phase);
  }
}

/** Note de marimba : fondamentale + partiel à ~3,9 × très bref (le « bois ») + octave discrète. */
function addMallet(out, sr, { start = 0, f, amp, tau = 0.12 }) {
  addTone(out, sr, { start, f0: f, amp, attack: 0.004, tau });
  addTone(out, sr, { start, f0: f * 3.93, amp: amp * 0.1, attack: 0.003, tau: Math.min(0.02, tau * 0.2) });
  addTone(out, sr, { start, f0: f * 2, amp: amp * 0.12, attack: 0.004, tau: tau * 0.45 });
}

/** Ajoute un souffle filtré (passe-bande ou passe-bas qui glisse de fa → fb) à partir de start (s). */
function addHiss(out, sr, { start = 0, type = 'bandpass', fa, fb = fa, q = 0.8, amp, attack, tau, hold = 0, seed }) {
  const i0 = Math.floor(start * sr);
  const n = out.length - i0;
  if (n <= 0) return;
  const len = Math.max(1, n - 1);
  const x = noise(n, seed);
  biquad(x, sr, type, (i) => fa * (fb / fa) ** (i / len), q);
  for (let i = 0; i < n; i++) out[i0 + i] += amp * envAt(i / sr, { attack, tau, hold }) * x[i];
}

/** Niveau RMS (linéaire) de la fenêtre de 50 ms la plus forte. */
export function rmsPeakWindow(x, sr) {
  const w = Math.max(1, Math.floor(sr * 0.05));
  let sum = 0;
  let best = 0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i] * x[i];
    if (i >= w) sum -= x[i - w] * x[i - w];
    if (i >= w - 1 || i === x.length - 1) best = Math.max(best, sum / Math.min(w, i + 1));
  }
  return Math.sqrt(Math.max(0, best));
}

// ── Recettes ────────────────────────────────────────────────────────────────────────

const RECIPES = {
  click(o, sr) {
    addTone(o, sr, { f0: 640, f1: 580, glide: 0.03, amp: 1, attack: 0.0025, tau: 0.024 });
    addTone(o, sr, { f0: 1490, amp: 0.22, attack: 0.002, tau: 0.01 });
    addHiss(o, sr, { fa: 1100, q: 1.2, amp: 0.5, attack: 0.002, tau: 0.006, seed: 11 });
  },
  toggle(o, sr) {
    addTone(o, sr, { f0: 560, f1: 430, glide: 0.06, amp: 1, attack: 0.004, tau: 0.032 });
    addTone(o, sr, { f0: 1120, f1: 860, glide: 0.06, amp: 0.2, attack: 0.004, tau: 0.016 });
  },
  page(o, sr) {
    addHiss(o, sr, { fa: 1300, fb: 800, q: 0.7, amp: 1, attack: 0.035, hold: 0.02, tau: 0.03, seed: 23 });
  },
  open(o, sr) {
    addHiss(o, sr, { type: 'lowpass', fa: 700, fb: 1300, q: 0.6, amp: 1, attack: 0.07, hold: 0.02, tau: 0.035, seed: 37 });
  },
  close(o, sr) {
    addHiss(o, sr, { type: 'lowpass', fa: 1200, fb: 600, q: 0.6, amp: 1, attack: 0.03, hold: 0.015, tau: 0.03, seed: 41 });
  },
  confirm(o, sr) {
    addMallet(o, sr, { f: 392, amp: 0.8, tau: 0.09 });
    addMallet(o, sr, { start: 0.075, f: 523.25, amp: 1, tau: 0.11 });
  },
  error(o, sr) {
    addTone(o, sr, { f0: 440, f1: 415, glide: 0.04, amp: 1, attack: 0.004, tau: 0.045 });
    addTone(o, sr, { f0: 880, amp: 0.15, attack: 0.004, tau: 0.02 });
    addTone(o, sr, { start: 0.11, f0: 349, f1: 330, glide: 0.04, amp: 1, attack: 0.004, tau: 0.055 });
    addTone(o, sr, { start: 0.11, f0: 698, amp: 0.15, attack: 0.004, tau: 0.025 });
  },
  warning(o, sr) {
    addMallet(o, sr, { f: 329.63, amp: 0.8, tau: 0.13 });
    addMallet(o, sr, { start: 0.012, f: 440, amp: 0.7, tau: 0.13 });
  },
};

/**
 * Calcule un son doux d'interface (mono, échantillons −1..1).
 * @returns {Float32Array|null} null si ce son est muet en mode « Doux » (survol) ou inconnu
 */
export function renderUiSound(name, sampleRate = 48000) {
  const spec = SOFT_UI[name];
  const recipe = RECIPES[name];
  if (!spec || !recipe) return null;
  const sr = sampleRate;
  const n = Math.ceil(spec.dur * sr);
  const out = new Float32Array(n);
  recipe(out, sr);
  // Passe-bas final (24 dB/oct) : rien de strident, même sur un haut-parleur de téléphone.
  biquad(out, sr, 'lowpass', LOWPASS_HZ, 0.6);
  biquad(out, sr, 'lowpass', LOWPASS_HZ, 0.6);
  // Fondu de sortie (15 ms) jusqu'à zéro exact ; premier échantillon à zéro.
  const fade = Math.min(n, Math.floor(0.015 * sr));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  out[0] = 0;
  // Niveau calé (RMS de la fenêtre de 50 ms la plus forte).
  const rms = rmsPeakWindow(out, sr);
  if (rms > 0) {
    const k = 10 ** (spec.level / 20) / rms;
    for (let i = 0; i < n; i++) out[i] *= k;
  }
  return out;
}
