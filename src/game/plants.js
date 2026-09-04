// Les espèces. Une graine = un degré de la gamme ; son tempérament musical
// décide de sa vitesse, de son rendement et de son effet sur le voisinage.

import { DEGREE_INFO } from './scales.js';
import { GROWTH } from './constants.js';

export const SPECIES = {
  I: {
    degree: 'I', key: 'I',
    name: 'Ancrine', latin: 'radix prima',
    growthTime: 7.5, yield: 12, wilt: 34,
    desc: 'La note qui tient. Accélère la croissance des plantes voisines.',
    shape: 'bulbe',
    aura: { type: 'nourrir', radius: 1, power: 0.28 },
  },
  II: {
    degree: 'II', key: 'II',
    name: 'Hâtille', latin: 'velox tenera',
    growthTime: 4.2, yield: 8, wilt: 15,
    desc: 'Pousse en un souffle et fane presque aussi vite.',
    shape: 'tige',
    aura: null,
  },
  III: {
    degree: 'III', key: 'III',
    name: 'Clairine', latin: 'lux minor',
    growthTime: 8.5, yield: 13, wilt: 30,
    desc: 'Repousse doucement la Cendre autour d’elle, même immature.',
    shape: 'ombelle',
    aura: { type: 'purifier', radius: 1, power: 0.09 },
  },
  V: {
    degree: 'V', key: 'V',
    name: 'Portante', latin: 'quinta longa',
    growthTime: 9.5, yield: 15, wilt: 32,
    desc: 'Étend la portée de ta résonance tant qu’elle est mûre.',
    shape: 'fougere',
    aura: { type: 'portee', radius: 2, power: 0.6 },
  },
  VI: {
    degree: 'VI', key: 'VI',
    name: 'Amplaire', latin: 'sexta ampla',
    growthTime: 13.0, yield: 26, wilt: 40,
    desc: 'Lente, généreuse, un peu triste.',
    shape: 'clochette',
    aura: null,
  },
};

export const SPECIES_ORDER = ['I', 'II', 'III', 'V', 'VI'];

export function speciesColor(key) { return DEGREE_INFO[key].color; }
export function speciesGlow(key) { return DEGREE_INFO[key].glow; }

let nextPlantId = 1;

export function createPlant(degree, col, row, rng) {
  const sp = SPECIES[degree];
  return {
    id: nextPlantId++,
    degree,
    col, row,
    growth: 0,
    age: 0,
    ripeAge: 0,
    ripe: false,
    dying: 0,          // 0..1, progression de la mort par Cendre
    wilted: false,
    // Petites variations pour que deux plantes ne soient jamais identiques.
    lean: rng ? rng.range(-0.28, 0.28) : 0,
    phase: rng ? rng.range(0, Math.PI * 2) : 0,
    leaves: rng ? rng.int(3, 5) : 4,
    scale: rng ? rng.range(0.9, 1.12) : 1,
    pop: 0,            // animation d'apparition / de passage de stade
    lastStage: 0,
    justRipened: false,
    sp,
  };
}

export function plantStage(plant) {
  if (plant.ripe) return 3;
  return Math.min(2, Math.floor(plant.growth * 3));
}

// Fait avancer une plante. `speed` agrège humidité, chaîne de justesse,
// auras voisines et multiplicateur de biome.
export function updatePlant(plant, dt, speed) {
  plant.age += dt;
  plant.pop = Math.max(0, plant.pop - dt * 3.2);
  plant.justRipened = false;

  if (plant.wilted) return;

  if (!plant.ripe) {
    const rate = 1 / (plant.sp.growthTime || 8);
    const before = plantStage(plant);
    plant.growth = Math.min(1, plant.growth + dt * rate * speed);
    const after = plantStage(plant);
    if (after !== before) plant.pop = 1;
    if (plant.growth >= 1) {
      plant.ripe = true;
      plant.ripeAge = 0;
      plant.pop = 1;
      plant.justRipened = true;
    }
  } else {
    plant.ripeAge += dt;
    const limit = plant.sp.wilt || GROWTH.wiltAfter;
    if (plant.ripeAge > limit) {
      plant.wilted = true;
      plant.pop = 1;
    }
  }
}

export function plantYield(plant) {
  if (plant.wilted) return 0;
  if (!plant.ripe) return Math.round(plant.sp.yield * 0.25 * plant.growth);
  // Récolter juste à maturité rapporte plus que laisser traîner.
  const freshness = 1 - Math.min(0.5, plant.ripeAge / (plant.sp.wilt * 2));
  return Math.round(plant.sp.yield * freshness);
}
