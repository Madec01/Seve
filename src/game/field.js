// Le champ : la grille, son terrain, son humidité, sa Cendre.
// C'est l'objet le plus lourd du jeu ; il n'a aucune connaissance du rendu.

import { Rng } from '../core/rng.js';
import { emit } from '../core/events.js';
import { BLIGHT, GROWTH } from './constants.js';
import { createPlant, updatePlant, plantYield, SPECIES } from './plants.js';

export const TERRAIN = { SOIL: 'soil', GRASS: 'grass', WATER: 'water', STONE: 'stone', VOID: 'void' };

export class Field {
  constructor(biome, seed) {
    this.biome = biome;
    this.rng = new Rng(seed);
    this.cols = biome.cols;
    this.rows = biome.rows;
    this.tiles = [];
    this.waves = [];        // ondes de purification en cours
    this.tideT = 0;
    this.slowBlight = 0;    // secondes de ralentissement offertes par un Suspendu
    this.beatsSinceSpread = 0;
    this.generate();
  }

  index(c, r) { return r * this.cols + c; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  at(c, r) { return this.inBounds(c, r) ? this.tiles[this.index(c, r)] : null; }

  generate() {
    const rng = this.rng;
    this.tiles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.tiles.push({
          c, r,
          terrain: TERRAIN.SOIL,
          moisture: rng.range(0.45, 0.8),
          blight: 0,
          fissure: false,
          plant: null,
          echo: null,
          shade: 0,
          tint: rng.range(-0.05, 0.05),
          bump: 0,
          flash: 0,
        });
      }
    }

    // Bandes d'herbe et de pierre pour casser la régularité de la grille.
    const patches = rng.int(3, 6);
    for (let i = 0; i < patches; i++) {
      const cc = rng.int(0, this.cols - 1);
      const cr = rng.int(0, this.rows - 1);
      const rad = rng.range(0.9, 2.2);
      const kind = rng.pickWeighted([
        { value: TERRAIN.GRASS, weight: 5 },
        { value: TERRAIN.STONE, weight: 2 },
        { value: TERRAIN.WATER, weight: 3 },
      ]);
      for (const t of this.tiles) {
        if (Math.hypot(t.c - cc, t.r - cr) <= rad + rng.range(-0.3, 0.3)) {
          t.terrain = kind;
          if (kind === TERRAIN.WATER) t.moisture = 1;
        }
      }
    }

    // Îlots flottants de la Canopée.
    if (this.biome.voids) {
      for (const t of this.tiles) {
        const edge = Math.min(t.c, t.r, this.cols - 1 - t.c, this.rows - 1 - t.r);
        if (edge === 0 && rng.chance(this.biome.voids * 2)) t.terrain = TERRAIN.VOID;
        else if (rng.chance(this.biome.voids * 0.35)) t.terrain = TERRAIN.VOID;
      }
    }

    // On garantit un cœur cultivable au centre : jamais de départ injouable.
    const midC = Math.floor(this.cols / 2), midR = Math.floor(this.rows / 2);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const t = this.at(midC + dc, midR + dr);
        if (t) { t.terrain = TERRAIN.SOIL; t.blight = 0; t.moisture = 0.7; }
      }
    }

    this.placeFissures(this.biome.fissures);
    this.placeEchoes(this.rng.int(1, 3));
  }

  placeFissures(count) {
    const candidates = this.tiles.filter(
      (t) => t.terrain !== TERRAIN.VOID && t.terrain !== TERRAIN.WATER && !t.fissure
        && (Math.abs(t.c - this.cols / 2) > 1.5 || Math.abs(t.r - this.rows / 2) > 1.5),
    );
    const chosen = this.rng.shuffle(candidates).slice(0, count);
    for (const t of chosen) {
      t.fissure = true;
      t.blight = Math.max(t.blight, 0.55);
      t.terrain = TERRAIN.STONE;
    }
  }

  placeEchoes(count) {
    const candidates = this.tiles.filter((t) => !t.fissure && t.terrain !== TERRAIN.VOID && !t.echo);
    for (const t of this.rng.shuffle(candidates).slice(0, count)) {
      t.echo = { found: false, pulse: 0 };
      t.blight = Math.max(t.blight, 0.35);
    }
  }

  // --- Requêtes --------------------------------------------------------------

  isSowable(t) {
    return !!t && !t.plant && t.blight < 0.2 && !t.fissure
      && (t.terrain === TERRAIN.SOIL || t.terrain === TERRAIN.GRASS);
  }

  blightRatio() {
    let sum = 0, n = 0;
    for (const t of this.tiles) {
      if (t.terrain === TERRAIN.VOID) continue;
      sum += t.blight; n++;
    }
    return n ? sum / n : 0;
  }

  plants() {
    const out = [];
    for (const t of this.tiles) if (t.plant) out.push(t.plant);
    return out;
  }

  neighbors(c, r) {
    return [this.at(c + 1, r), this.at(c - 1, r), this.at(c, r + 1), this.at(c, r - 1)]
      .filter(Boolean);
  }

  // --- Actions ---------------------------------------------------------------

  sow(t, degree) {
    if (!this.isSowable(t)) return null;
    const plant = createPlant(degree, t.c, t.r, this.rng);
    plant.pop = 1;
    t.plant = plant;
    t.bump = 1;
    emit('field:sow', { tile: t, plant });
    return plant;
  }

  water(t, amount = 0.5) {
    if (!t || t.terrain === TERRAIN.VOID) return false;
    const before = t.moisture;
    t.moisture = Math.min(1, t.moisture + amount);
    t.flash = Math.max(t.flash, 0.6);
    emit('field:water', { tile: t });
    return t.moisture > before + 0.01;
  }

  purify(t, amount = BLIGHT.purifyPerAction) {
    if (!t || t.blight <= 0.001) return 0;
    const removed = Math.min(t.blight, amount);
    t.blight -= removed;
    t.flash = 1;
    if (t.blight < 0.02) {
      t.blight = 0;
      if (t.echo && !t.echo.found) {
        t.echo.found = true;
        t.echo.pulse = 1;
        emit('field:echo', { tile: t });
      }
    }
    emit('field:purify', { tile: t, amount: removed });
    return removed;
  }

  harvestPlant(t) {
    if (!t || !t.plant) return null;
    const plant = t.plant;
    const gain = plantYield(plant);
    t.plant = null;
    t.bump = 1;
    t.moisture = Math.max(0, t.moisture - 0.12);
    return { plant, gain };
  }

  // Onde circulaire qui repousse la Cendre : le geste signature du jeu.
  addWave(col, row, radius, power = 1, color = '#ffe9b0') {
    this.waves.push({ col, row, radius, power, color, t: 0, life: 0.62 });
    for (const t of this.tiles) {
      const d = Math.hypot(t.c - col, t.r - row);
      if (d <= radius) {
        const falloff = 1 - d / (radius + 0.001);
        this.purify(t, 0.55 * power * falloff);
      }
    }
  }

  ripenAround(col, row, radius) {
    let n = 0;
    for (const t of this.tiles) {
      if (!t.plant || t.plant.ripe) continue;
      if (Math.hypot(t.c - col, t.r - row) <= radius) {
        t.plant.growth = 1;
        t.plant.ripe = true;
        t.plant.pop = 1;
        n++;
      }
    }
    return n;
  }

  // --- Simulation ------------------------------------------------------------

  update(dt, ctx) {
    const drought = this.biome.drought || 1;
    const growthMult = this.biome.growthMult || 1;
    this.slowBlight = Math.max(0, this.slowBlight - dt);

    if (this.biome.tide) {
      this.tideT += dt * 0.16;
    }

    // Auras : calculées avant la croissance pour que le voisinage compte.
    const boost = new Float32Array(this.tiles.length);
    for (const t of this.tiles) {
      const p = t.plant;
      if (!p || !p.sp.aura || p.wilted) continue;
      const aura = p.sp.aura;
      const strength = p.ripe ? 1 : 0.45;
      for (const n of this.tilesInRadius(t.c, t.r, aura.radius)) {
        if (aura.type === 'nourrir') boost[this.index(n.c, n.r)] += aura.power * strength;
        else if (aura.type === 'purifier') n.blight = Math.max(0, n.blight - aura.power * strength * dt);
      }
    }

    for (const t of this.tiles) {
      t.bump = Math.max(0, t.bump - dt * 3);
      t.flash = Math.max(0, t.flash - dt * 1.8);
      if (t.echo && t.echo.pulse > 0) t.echo.pulse = Math.max(0, t.echo.pulse - dt * 0.7);

      if (t.terrain === TERRAIN.WATER) t.moisture = 1;
      else if (t.terrain !== TERRAIN.VOID) {
        let loss = GROWTH.thirstRate * drought * dt;
        // Une case voisine d'eau se dessèche moins vite.
        for (const n of this.neighbors(t.c, t.r)) {
          if (n.terrain === TERRAIN.WATER) { loss *= 0.35; break; }
        }
        t.moisture = Math.max(0, t.moisture - loss);
      }

      // Marée : l'eau gagne et perd du terrain dans le marais.
      if (this.biome.tide) {
        const level = (Math.sin(this.tideT) + 1) * 0.5;
        t.submerged = t.terrain !== TERRAIN.VOID
          && (t.r / this.rows) > 0.98 - level * 0.55;
        if (t.submerged) t.moisture = 1;
      }

      const p = t.plant;
      if (p) {
        const wet = t.moisture > 0.25 ? 1 : GROWTH.dryPenalty;
        const boosted = 1 + boost[this.index(t.c, t.r)];
        const chain = ctx && ctx.chainMult ? 1 + (ctx.chainMult - 1) * 0.22 : 1;
        const speed = wet * boosted * growthMult * chain * (ctx && ctx.growthBonus ? ctx.growthBonus : 1);
        updatePlant(p, dt, speed);
        if (p.justRipened) emit('field:ripe', { tile: t, plant: p });

        if (t.blight > 0.25 && !p.wilted) {
          p.dying += dt * BLIGHT.damagePerSecond * t.blight * 4;
          if (p.dying >= 1) { p.wilted = true; emit('field:wilt', { tile: t, plant: p }); }
        }
        if (p.wilted) {
          p.age += dt;
          if (p.age > 60 || p.ripeAge > 90) t.plant = null;
        }
      }

      // Les fissures suintent en permanence.
      if (t.fissure) t.blight = Math.min(1, t.blight + dt * 0.06 * (this.biome.blightMult || 1));
    }

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      if (w.t >= w.life) this.waves.splice(i, 1);
    }
  }

  tilesInRadius(c, r, radius) {
    const out = [];
    const R = Math.ceil(radius);
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        if (dc === 0 && dr === 0) continue;
        if (Math.hypot(dc, dr) > radius + 0.001) continue;
        const t = this.at(c + dc, r + dr);
        if (t) out.push(t);
      }
    }
    return out;
  }

  // Propagation de la Cendre, cadencée par le pouls et non par le temps réel :
  // le joueur peut littéralement l'entendre venir.
  spreadBlight() {
    this.beatsSinceSpread++;
    const every = BLIGHT.spreadEveryBeats + (this.slowBlight > 0 ? 3 : 0);
    if (this.beatsSinceSpread < every) return 0;
    this.beatsSinceSpread = 0;

    const mult = this.biome.blightMult || 1;
    const additions = [];
    for (const t of this.tiles) {
      if (t.blight < 0.3) continue;
      for (const n of this.neighbors(t.c, t.r)) {
        if (n.terrain === TERRAIN.VOID) continue;
        if (n.blight >= t.blight) continue;
        if (this.rng.chance(BLIGHT.spreadChance * mult * t.blight)) {
          additions.push([n, 0.18 + this.rng.range(0, 0.2)]);
        }
      }
    }
    for (const [tile, amount] of additions) {
      tile.blight = Math.min(1, tile.blight + amount);
    }
    if (additions.length) emit('field:blight', { count: additions.length });
    return additions.length;
  }

  paintBlight(t, amount) {
    if (!t) return;
    t.blight = Math.max(0, Math.min(1, t.blight + amount));
  }
}
