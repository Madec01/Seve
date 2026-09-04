// Le Verger : progression permanente entre les Cycles.
// Rien n'est aléatoire ici — le joueur choisit ce qu'il fait repousser.

import { BIOMES, BIOME_ORDER } from './biomes.js';
import { SPECIES } from './plants.js';

export const UPGRADES = {
  paume: {
    id: 'paume', name: 'Paume large', max: 4, baseCost: 260, step: 1.75,
    desc: 'Ta résonance porte plus loin (+0,5 case par palier).',
    icon: 'main',
  },
  souffle: {
    id: 'souffle', name: 'Souffle long', max: 3, baseCost: 320, step: 1.8,
    desc: 'Le Souffle se recharge plus vite et disperse davantage de Cendre.',
    icon: 'vent',
  },
  seve: {
    id: 'seve', name: 'Sève épaisse', max: 5, baseCost: 400, step: 1.9,
    desc: '+8 % de sève à chaque récolte, par palier.',
    icon: 'goutte',
  },
  racines: {
    id: 'racines', name: 'Racines profondes', max: 4, baseCost: 350, step: 1.85,
    desc: 'Les plantes poussent 10 % plus vite par palier.',
    icon: 'racine',
  },
  oreille: {
    id: 'oreille', name: 'Oreille absolue', max: 3, baseCost: 500, step: 2.0,
    desc: 'La fenêtre de Justesse s’élargit de 20 ms par palier.',
    icon: 'oreille',
  },
  besace: {
    id: 'besace', name: 'Besace tressée', max: 2, baseCost: 600, step: 2.2,
    desc: 'Une graine gratuite au début de chaque saison, et un semis plus rapide.',
    icon: 'sac',
  },
  ecorce: {
    id: 'ecorce', name: 'Écorce patiente', max: 3, baseCost: 450, step: 1.9,
    desc: 'Les plantes mûres tiennent 25 % plus longtemps avant de faner.',
    icon: 'ecorce',
  },
  memoire: {
    id: 'memoire', name: 'Mémoire du Chant', max: 3, baseCost: 700, step: 2.1,
    desc: 'La chaîne de Justesse tolère une pulsation ratée de plus par palier.',
    icon: 'note',
  },
};

export const UPGRADE_ORDER = ['paume', 'racines', 'seve', 'souffle', 'ecorce', 'oreille', 'memoire', 'besace'];

// I, II et III sont dans la besace dès le départ : c'est le minimum pour
// former une Tierce, donc pour que la mécanique d'accord existe.
export const SEED_UNLOCKS = [
  { key: 'V', cost: 700, name: SPECIES.V.name },
  { key: 'VI', cost: 1900, name: SPECIES.VI.name },
];

export function upgradeLevel(save, id) { return (save.upgrades && save.upgrades[id]) || 0; }

export function upgradeCost(save, id) {
  const up = UPGRADES[id];
  const lvl = upgradeLevel(save, id);
  if (lvl >= up.max) return null;
  return Math.round(up.baseCost * Math.pow(up.step, lvl));
}

export function buyUpgrade(save, id) {
  const cost = upgradeCost(save, id);
  if (cost === null || save.sap < cost) return false;
  save.sap -= cost;
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return true;
}

export function buySeed(save, key) {
  const entry = SEED_UNLOCKS.find((s) => s.key === key);
  if (!entry || save.unlockedSeeds.includes(key) || save.sap < entry.cost) return false;
  save.sap -= entry.cost;
  save.unlockedSeeds.push(key);
  return true;
}

export function buyBiome(save, id) {
  const biome = BIOMES[id];
  if (!biome || save.unlockedBiomes.includes(id) || save.sap < biome.cost) return false;
  save.sap -= biome.cost;
  save.unlockedBiomes.push(id);
  return true;
}

export function nextLockedBiome(save) {
  for (const id of BIOME_ORDER) {
    if (!save.unlockedBiomes.includes(id)) return BIOMES[id];
  }
  return null;
}

// Bonus dérivés : une seule fonction que tout le gameplay consulte.
export function derivedBonuses(save) {
  const lvl = (id) => upgradeLevel(save, id);
  return {
    reach: 1 + lvl('paume') * 0.5,
    dashCooldownMult: 1 - lvl('souffle') * 0.16,
    dashDisperse: 1 + lvl('souffle') * 0.5,
    sapMult: 1 + lvl('seve') * 0.08,
    growthMult: 1 + lvl('racines') * 0.10,
    beatWindowBonus: lvl('oreille') * 0.02,
    freeSeeds: lvl('besace'),
    sowSpeed: 1 + lvl('besace') * 0.35,
    wiltMult: 1 + lvl('ecorce') * 0.25,
    chainGrace: lvl('memoire'),
  };
}

// L'état du hub reverdit à mesure que le monde guérit : 0 → 1.
export function healingProgress(save) {
  const spent = Object.entries(save.upgrades || {}).reduce((a, [, v]) => a + v, 0);
  const biomes = save.unlockedBiomes.length - 1;
  const echoes = (save.echoes || []).length;
  return Math.min(1, (spent / 27) * 0.4 + (biomes / 4) * 0.35 + (echoes / 12) * 0.25);
}
