// Défis du jour : même graine pour tout le monde, règles tordues, score local.

import { Rng, dailySeed, hashSeed } from '../core/rng.js';
import { BIOME_ORDER } from './biomes.js';

export const MODIFIERS = [
  { id: 'sec', name: 'Sécheresse', desc: 'L’humidité s’évapore deux fois plus vite.', apply: (cfg) => { cfg.drought = 2.2; } },
  { id: 'presse', name: 'Pouls pressé', desc: 'Le tempo est augmenté de 20 %.', apply: (cfg) => { cfg.bpmMult = 1.2; } },
  { id: 'lent', name: 'Pouls lourd', desc: 'Le tempo est réduit de 15 %, la Cendre accélère.', apply: (cfg) => { cfg.bpmMult = 0.85; cfg.blightMult = 1.4; } },
  { id: 'deux_graines', name: 'Deux cordes', desc: 'Seulement deux graines disponibles.', apply: (cfg) => { cfg.seedLimit = 2; } },
  { id: 'sourd', name: 'Sourdine', desc: 'La musique se tait par moments.', apply: (cfg) => { cfg.silenceChance = 0.4; } },
  { id: 'fertile', name: 'Terre grasse', desc: 'Croissance ×1,5, mais la Cendre double.', apply: (cfg) => { cfg.growthMult = 1.5; cfg.blightMult = 2; } },
  { id: 'fragile', name: 'Fragile', desc: 'Les plantes fanent deux fois plus vite.', apply: (cfg) => { cfg.wiltMult = 0.5; } },
  { id: 'genereux', name: 'Généreux', desc: 'Sève ×1,5 sur les accords.', apply: (cfg) => { cfg.chordBonus = 1.5; } },
];

export function todayChallenge(date = new Date()) {
  const seedStr = dailySeed(date);
  const rng = new Rng(hashSeed('defi:' + seedStr));
  const biome = BIOME_ORDER[rng.int(0, Math.min(3, BIOME_ORDER.length - 1))];
  const mods = rng.shuffle(MODIFIERS).slice(0, 2);
  const cfg = { biome, seed: hashSeed(seedStr), bpmMult: 1, blightMult: 1, growthMult: 1, wiltMult: 1, chordBonus: 1 };
  for (const m of mods) m.apply(cfg);
  return {
    id: seedStr,
    date: seedStr,
    biome,
    modifiers: mods,
    config: cfg,
    label: `Défi du ${seedStr.split('-').reverse().join('/')}`,
  };
}

export function weekChallenges(date = new Date()) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(date.getTime() - i * 86400000);
    out.push(todayChallenge(d));
  }
  return out;
}

export function recordDaily(save, challenge, score) {
  if (!save.dailyBest) save.dailyBest = {};
  const prev = save.dailyBest[challenge.id] || 0;
  if (score > prev) { save.dailyBest[challenge.id] = score; return true; }
  return false;
}
