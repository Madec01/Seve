// Voix des personnages : du charabia organique, jamais des mots.
// Chaque caractère révélé par la machine à écrire déclenche une syllabe dont la
// hauteur dépend de la lettre — le même texte sonne donc toujours pareil.

import { audioReady, audioCtx, bus, getNoise, panner, now } from './audio.js';
import { NPCS } from '../game/npcs.js';
import { pluck } from './synth.js';
import { degreeFreq } from '../game/scales.js';

const VOWELS = 'aeiouyàâéèêëîïôöùûü';

// Formants approximatifs : ce qui fait qu'une voyelle sonne « ah » ou « ii ».
const FORMANTS = {
  a: [720, 1200], e: [530, 1840], i: [320, 2500], o: [500, 900], u: [320, 800], y: [300, 1700],
};

function charPitch(ch) {
  const code = ch.toLowerCase().charCodeAt(0);
  return ((code * 7919) % 12) / 12;   // 0..1, déterministe
}

function formantFor(ch) {
  const c = ch.toLowerCase();
  if (FORMANTS[c]) return FORMANTS[c];
  const keys = Object.keys(FORMANTS);
  return FORMANTS[keys[Math.floor(charPitch(ch) * keys.length)]];
}

export function speakChar(npcId, ch, index = 0) {
  if (!audioReady()) return;
  const npc = NPCS[npcId];
  if (!npc || !ch || ch === ' ' || ch === '\n') return;

  const v = npc.voice;
  if (v.timbre === 'accord') {
    // Le Luthier ne parle pas : il pose des notes.
    if (index % 6 === 0) {
      const degs = ['I', 'III', 'V', 'VI'];
      pluck(degreeFreq(degs[index / 6 % degs.length], 0), { dur: 2.4, gain: 0.16, damping: 0.998, busName: 'voice' });
    }
    return;
  }

  // Ponctuation : une inflexion, pas une syllabe.
  const isVowel = VOWELS.includes(ch.toLowerCase());
  if (!isVowel && index % 2 !== 0) return;

  const ctx = audioCtx();
  const t = now();
  const dur = 0.055 + (isVowel ? 0.05 : 0.01);
  const step = charPitch(ch);
  const freq = v.base * Math.pow(2, (step - 0.5) * v.spread / 600);

  const osc = ctx.createOscillator();
  osc.type = v.timbre === 'rauque' ? 'sawtooth' : v.timbre === 'grave' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(freq * (v.timbre === 'liquide' ? 0.85 : 1), t);
  osc.frequency.linearRampToValueAtTime(freq * (1 + (step - 0.5) * v.wobble * 0.3), t + dur);

  const [f1, f2] = formantFor(ch);
  const bp1 = ctx.createBiquadFilter();
  bp1.type = 'bandpass'; bp1.frequency.value = f1; bp1.Q.value = 4;
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'peaking'; bp2.frequency.value = f2; bp2.Q.value = 6; bp2.gain.value = 8;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(isVowel ? 0.17 : 0.09, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(bp1); bp1.connect(bp2); bp2.connect(g);

  if (v.timbre === 'rauque') {
    const air = ctx.createBufferSource();
    air.buffer = getNoise(); air.loop = true;
    const ab = ctx.createBiquadFilter();
    ab.type = 'bandpass'; ab.frequency.value = 1400; ab.Q.value = 1.2;
    const ag = ctx.createGain(); ag.gain.value = 0.05;
    air.connect(ab); ab.connect(ag); ag.connect(g);
    air.start(t); air.stop(t + dur + 0.05);
  }

  const p = panner(0);
  if (p) { g.connect(p); p.connect(bus('voice')); } else g.connect(bus('voice'));
  osc.start(t); osc.stop(t + dur + 0.05);
}

// Petit cri d'attention quand un personnage apparaît.
export function speakHello(npcId) {
  const npc = NPCS[npcId];
  if (!npc) return;
  const word = npc.id.slice(0, 4);
  [...word].forEach((ch, i) => {
    setTimeout(() => speakChar(npcId, ch, i), i * (900 / npc.voice.speed));
  });
}

export function voiceSpeed(npcId) {
  const npc = NPCS[npcId];
  return npc ? npc.voice.speed : 12;
}
