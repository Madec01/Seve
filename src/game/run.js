// Un Cycle : trois saisons, une pulsation, une Cendre qui monte.
// Cette classe est l'unique endroit où le rythme, le champ et le joueur se parlent.

import { Rng } from '../core/rng.js';
import { emit } from '../core/events.js';
import { Field, TERRAIN } from './field.js';
import { Player } from './player.js';
import { Conductor, Score, beatTick, fanfare, sadCadence } from '../audio/music.js';
import { harvestGroup, previewAt, groupAt } from './resonance.js';
import { EventDirector } from './randomevents.js';
import { degreeFreq, CHORDS } from './scales.js';
import { pluck, wood, pour, breath, earth, drop, rustle } from '../audio/synth.js';
import { SEASON, SCORE, BEAT_WINDOW, CHAIN_STEPS, CHAIN_GRACE_BEATS, BLIGHT, TILE, PLAYER } from './constants.js';
import { SPECIES_ORDER } from './plants.js';
import { getBiome } from './biomes.js';
import { nextEcho } from './lore.js';

export const RUN_STATE = { PLAYING: 'jeu', SEASON_END: 'saison', WON: 'floraison', LOST: 'etiolement' };

export class Run {
  constructor(config) {
    this.config = config;
    this.biome = getBiome(config.biomeId);
    this.seed = config.seed || Date.now();
    this.rng = new Rng(this.seed);
    this.bonuses = config.bonuses || {};
    this.challenge = config.challenge || null;
    this.testMode = !!config.testMode;

    this.field = new Field(this.biome, this.seed);
    if (this.challenge && this.challenge.config.drought) this.field.biome = Object.assign({}, this.biome, { drought: this.challenge.config.drought });
    this.player = new Player(this.field);

    const bpmMult = (this.challenge && this.challenge.config.bpmMult) || 1;
    this.conductor = new Conductor(Math.round(this.biome.bpm * bpmMult));
    this.score = new Score(this.conductor);
    this.score.setBiome(this.biome);
    this.director = new EventDirector(this);

    this.availableSeeds = (config.seeds || ['I', 'II', 'III']).filter((s) => SPECIES_ORDER.includes(s));
    if (this.challenge && this.challenge.config.seedLimit) {
      this.availableSeeds = this.availableSeeds.slice(0, this.challenge.config.seedLimit);
    }
    if (!this.availableSeeds.length) this.availableSeeds = ['I'];
    this.seedIndex = 0;

    this.state = RUN_STATE.PLAYING;
    this.season = 0;
    this.seasonBeats = 0;
    this.beatsThisSeason = SEASON.beatsPerSeason[0];
    this.goal = this.computeGoal(0);
    this.seasonSap = 0;

    this.sap = 0;
    this.points = 0;
    this.chain = 0;
    this.chainMissed = 0;
    this.chainMult = 1;
    this.bestChain = 0;
    this.transposeShift = 0;
    this.time = 0;
    this.actCooldown = 0;
    this.tuneCooldown = 0;
    this.paused = false;
    this.godMode = false;

    this.stats = {
      harvests: 0, chords: 0, purified: 0, perfectBeats: 0, seedsSown: 0,
      wilted: 0, bestChordId: null, chordCounts: {}, actions: 0,
    };
    this.floaters = [];
    this.shake = 0;
    this.flashChord = null;
    this.lastEcho = null;
    this.tutorial = null;
  }

  // --- Réglages dérivés ------------------------------------------------------

  get beatWindow() { return BEAT_WINDOW + (this.bonuses.beatWindowBonus || 0); }
  get reach() { return (this.bonuses.reach || 1) + this.portanteBonus(); }
  get selectedSeed() { return this.availableSeeds[this.seedIndex % this.availableSeeds.length]; }
  get transpose() { return (this.biome.transpose || 0) + this.transposeShift; }

  portanteBonus() {
    // Les Portantes (degré V) mûres étendent la résonance autour d'elles.
    let bonus = 0;
    const pc = this.player.col, pr = this.player.row;
    for (const t of this.field.tilesInRadius(pc, pr, 2.5)) {
      if (t.plant && t.plant.degree === 'V' && t.plant.ripe && !t.plant.wilted) bonus += 0.3;
    }
    return Math.min(1.2, bonus);
  }

  computeGoal(season) {
    const base = SEASON.baseGoal[season] || SEASON.baseGoal[SEASON.baseGoal.length - 1];
    const biomeScale = 1 + (this.biome.cost > 0 ? Math.log10(this.biome.cost) / 6 : 0);
    return Math.round(base * biomeScale);
  }

  // --- Cycle de vie ----------------------------------------------------------

  start() {
    this.conductor.start();
    emit('run:start', this);
    this.grantFreeSeeds();
  }

  grantFreeSeeds() {
    const n = this.bonuses.freeSeeds || 0;
    for (let i = 0; i < n; i++) {
      const spots = this.field.tiles.filter((t) => this.field.isSowable(t));
      if (!spots.length) break;
      this.field.sow(this.rng.pick(spots), this.rng.pick(this.availableSeeds));
    }
  }

  pause() { this.paused = true; this.conductor.pause(); }
  resume() { this.paused = false; this.conductor.resume(); }

  update(dt, input) {
    if (this.paused || this.state !== RUN_STATE.PLAYING) return;
    this.time += dt;
    this.actCooldown = Math.max(0, this.actCooldown - dt);
    this.tuneCooldown = Math.max(0, this.tuneCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 3.5);
    this.score.update(dt);
    this.director.update(dt);

    const beats = this.conductor.poll();
    for (let i = 0; i < beats; i++) this.onBeat();

    if (input) this.handleInput(dt, input);

    this.player.update(dt, input ? input.move : { x: 0, y: 0 });
    this.field.update(dt, {
      chainMult: this.chainMult,
      growthBonus: (this.bonuses.growthMult || 1) * this.director.growthBonus()
        * ((this.challenge && this.challenge.config.growthMult) || 1),
    });

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y -= dt * 42;
      if (f.t > f.life) this.floaters.splice(i, 1);
    }

    if (!this.godMode && this.field.blightRatio() > BLIGHT.loseThreshold) this.finish(false);
  }

  onBeat() {
    const b = this.conductor.beat;
    this.score.onBeat(b);
    if (b % 4 === 0) beatTick(true); else beatTick(false);

    const blightMult = this.director.blightBonus()
      * ((this.challenge && this.challenge.config.blightMult) || 1);
    if (this.rng.chance(Math.min(1, 0.85 * blightMult))) this.field.spreadBlight();

    this.seasonBeats++;
    if (this.seasonBeats >= this.beatsThisSeason) this.endSeason();

    // Retombée de la chaîne : trois pulsations sans Justesse.
    this.chainMissed++;
    const grace = CHAIN_GRACE_BEATS + (this.bonuses.chainGrace || 0);
    if (this.chainMissed > grace && this.chain > 0) {
      this.chain = 0;
      this.chainMult = 1;
      emit('run:chainLost', this);
    }

    this.score.setTension(this.field.blightRatio() / BLIGHT.loseThreshold);
    this.score.setIntensity(Math.min(1, this.chainMult / 4));

    emit('run:beat', { beat: b, run: this });
  }

  // --- Entrées ---------------------------------------------------------------

  handleInput(dt, input) {
    if (input.seedRequest >= 0 && input.seedRequest < this.availableSeeds.length) {
      this.seedIndex = input.seedRequest;
      wood({ freq: 520, gain: 0.16, decay: 0.06 });
    }
    if (input.cycleSeed) {
      this.seedIndex = (this.seedIndex + 1) % this.availableSeeds.length;
      wood({ freq: 470 + this.seedIndex * 40, gain: 0.18, decay: 0.07 });
      emit('run:seedChange', this.selectedSeed);
    }
    if (input.act && this.actCooldown <= 0) this.doAct();
    if (input.tune && this.tuneCooldown <= 0) this.doTune();
    if (input.dash) this.doDash();
  }

  // La Justesse : ±130 ms autour de la pulsation.
  judge() {
    const off = Math.abs(this.conductor.offset());
    const just = off <= this.beatWindow;
    if (just) {
      this.chainMissed = 0;
      this.chain++;
      this.bestChain = Math.max(this.bestChain, this.chain);
      this.stats.perfectBeats++;
      const step = Math.min(CHAIN_STEPS.length - 1, Math.floor(this.chain / 3));
      const nextMult = CHAIN_STEPS[step];
      if (nextMult !== this.chainMult) {
        this.chainMult = nextMult;
        emit('run:chainUp', { chain: this.chain, mult: this.chainMult });
      }
    }
    return just;
  }

  panOf(col) { return (col / this.field.cols - 0.5) * 1.2; }

  doAct() {
    const tile = this.player.targetTile();
    if (!tile) return;
    this.actCooldown = 0.16 / (this.bonuses.sowSpeed || 1);
    this.player.actAnim = 1;
    this.stats.actions++;
    const just = this.judge();
    const pan = this.panOf(tile.c);

    // 1. Récolte (et donc accord).
    if (tile.plant && tile.plant.ripe && !tile.plant.wilted) {
      this.doHarvest(tile, just);
      return;
    }
    // 2. Plante fanée : on nettoie.
    if (tile.plant && tile.plant.wilted) {
      tile.plant = null;
      tile.bump = 1;
      breath({ dur: 0.3, gain: 0.12, pan, from: 900, to: 300 });
      this.addFloater(tile.c, tile.r, '…', '#9a8f80');
      return;
    }
    // 3. Cendre : purification manuelle, lente mais sûre.
    if (tile.blight > 0.04) {
      const amount = BLIGHT.purifyPerAction * (just ? 1.6 : 1) * this.chainMult * 0.5;
      const removed = this.field.purify(tile, amount);
      this.stats.purified += removed;
      this.addSap(Math.round(SCORE.sapPerPurify * removed * 3 * this.chainMult), 'purif', tile);
      breath({ dur: 0.36, gain: 0.16, pan, from: 2200, to: 500 });
      drop({ freq: 620, gain: 0.12, pan });
      if (just) this.markJust(tile);
      if (tile.echo && tile.echo.found && !this.lastEcho) this.collectEcho(tile);
      return;
    }
    // 4. Semis.
    if (this.field.isSowable(tile)) {
      const seed = this.selectedSeed;
      const plant = this.field.sow(tile, seed);
      if (plant) {
        this.stats.seedsSown++;
        wood({ freq: 300, gain: 0.26, decay: 0.13, pan });
        pluck(degreeFreq(seed, -1, this.transpose), { dur: 0.9, gain: 0.16, pan, damping: 0.992 });
        if (just) { this.markJust(tile); plant.growth = 0.12; }
        // Le vent de la Canopée déplace parfois la graine fraîche.
        if (this.biome.wind && this.rng.chance(0.22)) this.blowSeed(tile);
      }
      return;
    }
    // 5. Arrosage.
    if (tile.plant && !tile.plant.ripe) {
      this.field.water(tile, 0.55);
      pour(0.4, pan);
      if (just) { this.markJust(tile); tile.plant.growth = Math.min(1, tile.plant.growth + 0.06); }
      this.addFloater(tile.c, tile.r, 'eau', '#7ec8e3', 0.7);
      return;
    }
    // 6. Rien à faire : petit son de bois, pas de punition.
    wood({ freq: 200, gain: 0.09, decay: 0.05, pan });
  }

  blowSeed(tile) {
    const dirs = this.rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    for (const [dc, dr] of dirs) {
      const dest = this.field.at(tile.c + dc, tile.r + dr);
      if (dest && this.field.isSowable(dest) && tile.plant) {
        dest.plant = tile.plant;
        dest.plant.col = dest.c; dest.plant.row = dest.r;
        tile.plant = null;
        dest.bump = 1;
        rustle(0.14, this.panOf(dest.c));
        this.addFloater(dest.c, dest.r, 'vent', '#c3ccff', 0.7);
        return;
      }
    }
  }

  doHarvest(tile, just) {
    const result = harvestGroup(this.field, tile, {
      chainMult: this.chainMult,
      just,
      sapBonus: (this.bonuses.sapMult || 1)
        * ((this.challenge && this.challenge.config.chordBonus) || 1),
    });
    if (!result) return;

    this.stats.harvests += result.count;
    const pan = this.panOf(tile.c);

    if (result.chord) {
      const chord = result.chord;
      this.stats.chords++;
      this.stats.chordCounts[chord.id] = (this.stats.chordCounts[chord.id] || 0) + 1;
      const rank = CHORDS.findIndex((c) => c.id === chord.id);
      const bestRank = this.stats.bestChordId ? CHORDS.findIndex((c) => c.id === this.stats.bestChordId) : 99;
      if (rank < bestRank) this.stats.bestChordId = chord.id;

      // On joue littéralement l'accord.
      const freqs = chord.need.map((d, i) => degreeFreq(d, i === 0 ? -1 : 0, this.transpose));
      freqs.forEach((f, i) => pluck(f, {
        dur: 2.8, gain: 0.3 - i * 0.02, delay: i * 0.05,
        pan: pan + (i - freqs.length / 2) * 0.15, damping: 0.9978, brightness: 0.45,
      }));
      earth({ gain: 0.28, freq: 80, pan });
      this.shake = Math.min(1, 0.4 + chord.mult * 0.12);
      this.flashChord = { chord, t: 0, col: result.center.col, row: result.center.row };
      this.addFloater(result.center.col, result.center.row, chord.name, chord.color, 1.5, 26);
      emit('run:chord', { chord, result, run: this });
    } else {
      const deg = result.degrees[0] || 'I';
      pluck(degreeFreq(deg, 0, this.transpose), { dur: 1.6, gain: 0.26, pan });
      this.shake = Math.max(this.shake, 0.12);
    }

    if (just) this.markJust(tile);
    this.addSap(result.sap, 'recolte', tile);
    this.stats.purified += result.purified > 5 ? 5 : result.purified;
  }

  // Accorder : l'onde de résonance. Ne récolte pas, mais fait avancer le champ.
  doTune() {
    this.tuneCooldown = 0.42;
    this.player.tuneAnim = 1;
    this.stats.actions++;
    const just = this.judge();
    const radius = this.reach + 0.4 + (just ? 0.6 : 0);
    const pc = this.player.col, pr = this.player.row;
    const deg = this.selectedSeed;

    pluck(degreeFreq(deg, 0, this.transpose), {
      dur: 2.2, gain: 0.24, pan: this.panOf(pc), damping: 0.9975, brightness: 0.6,
    });
    breath({ dur: 0.5, gain: 0.1, from: 300, to: 2400, q: 0.9 });

    const tiles = [this.field.at(pc, pr), ...this.field.tilesInRadius(pc, pr, radius)].filter(Boolean);
    let touched = 0;
    let echoed = 0;
    for (const t of tiles) {
      const d = Math.hypot(t.c - pc, t.r - pr);
      const falloff = 1 - d / (radius + 0.4);
      if (t.blight > 0) {
        const removed = this.field.purify(t, 0.16 * falloff * this.chainMult * (just ? 1.5 : 1));
        this.stats.purified += removed;
      }
      const p = t.plant;
      if (p && !p.wilted) {
        touched++;
        if (!p.ripe) {
          // Une plante du même degré résonne bien plus fort : c'est l'accordage.
          const same = p.degree === deg ? 1.9 : 0.7;
          p.growth = Math.min(1, p.growth + 0.10 * falloff * same * (just ? 1.4 : 1) * this.chainMult);
          p.pop = Math.max(p.pop, 0.4);
          if (p.growth >= 1 && !p.ripe) { p.ripe = true; p.pop = 1; }
        } else if (echoed < 4) {
          // Les plantes mûres répondent : le champ devient un instrument.
          pluck(degreeFreq(p.degree, 0, this.transpose), {
            dur: 1.4, gain: 0.13, delay: 0.06 + echoed * 0.05, pan: this.panOf(t.c), damping: 0.995,
          });
          echoed++;
        }
      }
      t.flash = Math.max(t.flash, 0.5 * falloff);
    }
    this.field.waves.push({ col: pc + 0.5, row: pr + 0.5, radius, power: 0.6, color: '#ffe9b0', t: 0, life: 0.5 });
    if (just) this.markJust(this.field.at(pc, pr));
    if (touched === 0) this.addFloater(pc, pr, '~', '#e8dcc6', 0.6);
  }

  doDash() {
    if (!this.player.tryDash()) return;
    this.player.dashCd = PLAYER.dashCooldown * (this.bonuses.dashCooldownMult || 1);
    breath({ dur: 0.34, gain: 0.2, from: 600, to: 2800, q: 1.4 });
    const disperse = BLIGHT.dashDisperse * (this.bonuses.dashDisperse || 1);
    for (const t of this.field.tilesInRadius(this.player.col, this.player.row, 1.6)) {
      if (t.blight > 0) this.stats.purified += this.field.purify(t, disperse);
    }
  }

  markJust(tile) {
    const col = tile ? tile.c : this.player.col;
    const row = tile ? tile.r : this.player.row;
    this.addFloater(col, row - 0.4, 'JUSTE', '#ffe9b0', 0.8, 18);
    emit('run:just', { chain: this.chain, mult: this.chainMult });
  }

  collectEcho(tile) {
    const echo = nextEcho(this.config.save || { echoes: [], act: 1 });
    if (!echo) return;
    this.lastEcho = echo;
    this.addSap(SCORE.echoValue, 'echo', tile);
    emit('run:echo', echo);
  }

  addSap(amount, reason = '', tile = null) {
    if (amount <= 0) return;
    this.sap += amount;
    this.seasonSap += amount;
    this.points += amount;
    const col = tile ? tile.c : this.player.col;
    const row = tile ? tile.r : this.player.row;
    this.addFloater(col, row, `+${amount}`, '#f6c453', 1.1, reason === 'recolte' ? 22 : 16);
    emit('run:sap', { amount, reason, total: this.sap });
  }

  addFloater(col, row, text, color, life = 1, size = 16) {
    this.floaters.push({
      x: (col + 0.5) * TILE, y: (row + 0.2) * TILE,
      text, color, life, size, t: 0,
    });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  // --- Saisons ---------------------------------------------------------------

  endSeason() {
    const cleared = this.seasonSap >= this.goal;
    if (cleared) {
      this.points += SCORE.seasonClearBonus * (this.season + 1);
      fanfare(this.transpose);
    } else {
      sadCadence(this.transpose);
      // Échec : la Cendre gagne du terrain, mais le Cycle continue.
      for (const t of this.field.tiles) {
        if (t.fissure) {
          for (const n of this.field.neighbors(t.c, t.r)) this.field.paintBlight(n, 0.3);
        }
      }
      this.field.placeFissures(1);
    }
    emit('run:season', { season: this.season, cleared, sap: this.seasonSap, goal: this.goal, run: this });

    this.season++;
    if (this.season >= SEASON.count) { this.finish(true); return; }

    this.seasonBeats = 0;
    this.beatsThisSeason = SEASON.beatsPerSeason[this.season] || 96;
    this.goal = this.computeGoal(this.season);
    this.seasonSap = 0;
    this.field.placeEchoes(1);
    this.state = RUN_STATE.SEASON_END;
    this.pause();
  }

  nextSeason() {
    this.state = RUN_STATE.PLAYING;
    this.resume();
    this.grantFreeSeeds();
    emit('run:seasonStart', { season: this.season, run: this });
  }

  finish(won) {
    this.state = won ? RUN_STATE.WON : RUN_STATE.LOST;
    this.conductor.pause();
    if (won) fanfare(this.transpose); else sadCadence(this.transpose);
    emit('run:end', { run: this, won });
  }

  // --- Aide au HUD -----------------------------------------------------------

  preview() {
    const tile = this.player.targetTile();
    if (!tile) return null;
    return previewAt(this.field, tile, { chainMult: this.chainMult, chords: CHORDS });
  }

  contextLabel() {
    const t = this.player.targetTile();
    if (!t) return '';
    if (t.plant && t.plant.wilted) return 'Retirer';
    if (t.plant && t.plant.ripe) {
      const g = groupAt(this.field, t);
      return g && g.chord ? `Récolter · ${g.chord.name}` : 'Récolter';
    }
    if (t.blight > 0.04) return 'Purifier';
    if (this.field.isSowable(t)) return `Semer ${this.selectedSeed}`;
    if (t.plant) return 'Arroser';
    if (t.terrain === TERRAIN.WATER) return 'Eau';
    if (t.fissure) return 'Fissure';
    return '—';
  }

  progressRatio() { return Math.min(1, this.seasonSap / this.goal); }
  seasonRatio() { return this.seasonBeats / this.beatsThisSeason; }
}
