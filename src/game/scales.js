// Le vocabulaire musical du jeu. Tout le gameplay parle cette langue :
// une plante est un degré, un champ est une partition, une récolte est un accord.

export const DEGREES = ['I', 'II', 'III', 'V', 'VI'];

export const DEGREE_INFO = {
  I:   { name: 'Do',  semitone: 0, color: '#f0a24a', glow: '#ffd79a', trait: 'racine',   desc: 'Stable. Nourrit ses voisines.' },
  II:  { name: 'Ré',  semitone: 2, color: '#8fce6a', glow: '#d7f5b8', trait: 'hâtive',   desc: 'Pousse vite, meurt vite.' },
  III: { name: 'Mi',  semitone: 4, color: '#4fc3b1', glow: '#b3f2e6', trait: 'claire',   desc: 'Repousse la Cendre autour d’elle.' },
  V:   { name: 'Sol', semitone: 7, color: '#7c8ce0', glow: '#c3ccff', trait: 'portante', desc: 'Étend la portée de ta résonance.' },
  VI:  { name: 'La',  semitone: 9, color: '#c884d8', glow: '#efc9f7', trait: 'ample',    desc: 'Rendement élevé, maturation lente.' },
};

// Fréquence d'un degré. `octave` 0 = registre médian, autour de 220 Hz.
export function degreeFreq(degree, octave = 0, transpose = 0) {
  const info = DEGREE_INFO[degree];
  if (!info) return 220;
  return 220 * Math.pow(2, (info.semitone + transpose) / 12 + octave);
}

export function semitoneFreq(semitone, octave = 0) {
  return 220 * Math.pow(2, semitone / 12 + octave);
}

// --- Accords ---------------------------------------------------------------
// `need` : l'ensemble de degrés qui doit être présent dans le groupe connecté.
// `minSize` : nombre minimal de plantes mûres dans le groupe.
// Trié du plus fort au plus faible : la reconnaissance retient le premier qui colle.

export const CHORDS = [
  {
    id: 'pentatonique', name: 'Pentatonique', need: ['I', 'II', 'III', 'V', 'VI'],
    minSize: 5, mult: 5.0, color: '#ffe9b0',
    effect: 'floraison', radius: 99,
    flavour: 'Le champ entier retient son souffle.',
  },
  {
    id: 'mineur', name: 'Accord mineur', need: ['VI', 'I', 'III'],
    minSize: 3, mult: 2.8, color: '#c884d8',
    effect: 'maturation', radius: 2.4,
    flavour: 'Une mélancolie qui fait mûrir.',
  },
  {
    id: 'majeur', name: 'Accord majeur', need: ['I', 'III', 'V'],
    minSize: 3, mult: 2.6, color: '#ffd79a',
    effect: 'onde', radius: 3.1,
    flavour: 'La lumière revient d’un coup.',
  },
  {
    id: 'suspendu', name: 'Suspendu', need: ['I', 'II', 'V'],
    minSize: 3, mult: 2.2, color: '#b3f2e6',
    effect: 'ralentir', radius: 2.0,
    flavour: 'Le temps hésite.',
  },
  {
    id: 'quinte', name: 'Quinte ouverte', need: ['I', 'V'],
    minSize: 2, mult: 1.6, color: '#c3ccff',
    effect: 'onde', radius: 1.6,
    flavour: 'Large, creux, ancien.',
  },
  {
    id: 'tierce', name: 'Tierce', need: ['I', 'III'],
    minSize: 2, mult: 1.5, color: '#a8e6cf',
    effect: 'onde', radius: 1.4,
    flavour: 'Deux voix se trouvent.',
  },
];

export const CHORD_BY_ID = Object.fromEntries(CHORDS.map((c) => [c.id, c]));

// Reconnaît le meilleur accord contenu dans un ensemble de degrés.
export function matchChord(degreeSet, size) {
  for (const chord of CHORDS) {
    if (size < chord.minSize) continue;
    if (chord.need.every((d) => degreeSet.has(d))) return chord;
  }
  return null;
}

// Les notes réellement jouées quand un accord se déclenche.
export function chordVoicing(chord, transpose = 0) {
  return chord.need.map((d, i) => degreeFreq(d, i === 0 ? -1 : 0, transpose));
}
