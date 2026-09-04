// Point d'entrée. Assemble le noyau, le jeu, l'interface et le son.

import { Loop, clamp } from './core/loop.js';
import { Input } from './core/input.js';
import { on, emit } from './core/events.js';
import { Rng, hashSeed } from './core/rng.js';
import {
  loadSettings, saveSettings, loadSlot, saveSlot, deleteSlot, emptySave,
} from './core/storage.js';
import { initAudio, resumeAudio, applySettings, audioReady } from './audio/audio.js';
import { wood, breath, pluck, rustle, earth } from './audio/synth.js';
import { Run, RUN_STATE } from './game/run.js';
import { Tutorial } from './game/tutorial.js';
import { derivedBonuses } from './game/progression.js';
import { checkAchievements } from './game/achievements.js';
import { todayChallenge, recordDaily } from './game/challenges.js';
import { nextEcho, actForSave } from './game/lore.js';
import { NPCS, npcBark } from './game/npcs.js';
import { TILE } from './game/constants.js';
import { BIOMES } from './game/biomes.js';
import { DEGREE_INFO } from './game/scales.js';
import { Renderer } from './ui/render.js';
import { drawPlayer, drawCursor, drawBeatRing, drawFloaters, drawChordFlash, Particles } from './ui/actors.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Hub } from './ui/hub.js';
import { Dialogue, Toasts } from './ui/dialogue.js';
import { TestMode } from './debug/testmode.js';
import { el, isTouchDevice, isLandscape, toggleFullscreen } from './ui/dom.js';

const STATE = { TITLE: 'titre', MENU: 'menu', HUB: 'verger', PLAYING: 'jeu', PAUSED: 'pause', OVER: 'bilan' };

class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.overlay = document.getElementById('overlay');
    this.renderer = new Renderer(this.canvas);
    this.particles = new Particles();
    this.settings = loadSettings();
    this.state = STATE.TITLE;
    this.run = null;
    this.save = null;
    this.tutorial = null;
    this.dpr = 1;
    this.audioOn = false;
    this.lastInputKind = 'clavier';
    this.hintTimer = 0;
    this.tutorialBanner = null;
    this.idleBiome = null;

    this.hud = new Hud(this.overlay);
    this.screens = new Screens(this.overlay, this);
    this.hub = new Hub(this.overlay, this);
    this.dialogue = new Dialogue(this.overlay);
    this.toasts = new Toasts(this.overlay);
    this.testMode = new TestMode(this.overlay, this);
    this.buildTutorialBanner();
    this.buildOrientationNotice();

    Input.init(this.canvas);
    this.loop = new Loop((dt) => this.update(dt), (alpha, frame) => this.render(frame));

    this.bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));

    const wake = () => this.wakeAudio();
    window.addEventListener('pointerdown', wake, { once: false });
    window.addEventListener('keydown', wake, { once: false });
    window.addEventListener('touchstart', wake, { once: false });

    this.screens.title();
    this.idleBiome = this.pickIdleBiome();
    this.loop.start();
  }

  // --- Infrastructure ---------------------------------------------------------

  wakeAudio() {
    if (this.audioOn) { resumeAudio(); return; }
    const ctx = initAudio();
    if (!ctx) return;
    resumeAudio();
    applySettings(this.settings);
    this.audioOn = true;
    pluck(220, { dur: 2.2, gain: 0.18, damping: 0.998 });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    this.renderer.resize(w, h, this.dpr);
    if (this.run) this.renderer.fit(this.run.field);
    else if (this.idleBiome) this.renderer.fit({ cols: 9, rows: 7 });
    document.body.classList.toggle('portrait', !isLandscape() && isTouchDevice());
    document.body.classList.toggle('gaucher', this.settings.touchLayout === 'gaucher');
  }

  buildTutorialBanner() {
    this.tutorialBanner = el('div', 'tutorial-banner hidden');
    this.tutorialBanner.innerHTML = '<strong></strong><span></span>';
    this.overlay.appendChild(this.tutorialBanner);
  }

  buildOrientationNotice() {
    const n = el('div', 'orientation-notice',
      '<div><b>Tourne ton téléphone</b><p>SÈVE se joue en paysage.</p></div>');
    this.overlay.appendChild(n);
    const fs = el('button', 'fullscreen-btn', '⛶');
    fs.title = 'Plein écran';
    fs.addEventListener('click', () => { toggleFullscreen(); setTimeout(() => this.resize(), 250); });
    this.overlay.appendChild(fs);
  }

  setSetting(key, value) {
    this.settings[key] = value;
    saveSettings(this.settings);
    applySettings(this.settings);
    this.renderer.quality = this.settings.particles;
    if (key === 'touchLayout') this.resize();
  }

  toast(title, subtitle, color) { this.toasts.push(title, subtitle, color); }

  // --- Sauvegardes -------------------------------------------------------------

  readSlot(i) { return loadSlot(i); }
  eraseSlot(i) { deleteSlot(i); }

  ensureSave() {
    if (!this.save) {
      this.save = loadSlot(this.settings.lastSlot) || emptySave(this.settings.lastSlot);
    }
    return this.save;
  }

  persist() {
    if (!this.save) return;
    this.save.act = actForSave(this.save);
    saveSlot(this.save.slot, this.save);
    this.settings.lastSlot = this.save.slot;
    saveSettings(this.settings);
  }

  newGame(slot) {
    this.save = emptySave(slot);
    this.persist();
    this.screens.hide();
    this.state = STATE.HUB;
    this.dialogue.show('pepin', NPCS.pepin.intro, () => {
      this.hub.verger();
      this.toast('Bienvenue', 'Le Verger est ton point de départ.', '#8fce6a');
    });
  }

  loadGame(slot) {
    this.save = loadSlot(slot) || emptySave(slot);
    this.persist();
    this.screens.hide();
    this.state = STATE.HUB;
    this.hub.verger();
  }

  openSlots() { this.screens.slots(); }
  toTitle() {
    this.endRun(true);
    this.hub.hide();
    this.state = STATE.TITLE;
    this.screens.title();
  }

  openTestMode() {
    this.testMode.show();
  }

  // --- Parties ------------------------------------------------------------------

  startRun(biomeId, options = {}) {
    this.ensureSave();
    const save = this.save;
    const seed = options.seed || (Date.now() ^ hashSeed(biomeId));
    const config = {
      biomeId,
      seed,
      seeds: save.unlockedSeeds.slice(),
      bonuses: derivedBonuses(save),
      challenge: options.challenge || null,
      testMode: !!options.testMode,
      save,
    };
    this.run = new Run(config);
    this.run.start();
    this.renderer.fit(this.run.field);
    this.particles.clear();
    this.screens.hide();
    this.hub.hide();
    this.hud.show(this.run);
    this.hud.setTouch(isTouchDevice());
    this.state = STATE.PLAYING;
    this.currentChallenge = options.challenge || null;

    if (!save.tutorialDone && biomeId === 'clairiere' && !options.challenge) {
      this.startTutorial();
    }
    emit('app:runStart', this.run);
  }

  startDaily() {
    this.ensureSave();
    const daily = todayChallenge();
    this.currentChallenge = daily;
    this.startRun(daily.biome, { challenge: daily, seed: daily.config.seed });
    this.toast(daily.label, daily.modifiers.map((m) => m.name).join(' · '), '#f6c453');
  }

  startTutorial() {
    this.tutorial = new Tutorial(this.run, (step) => {
      if (step.bark) this.dialogue.show('pepin', [step.bark]);
      wood({ freq: 620, gain: 0.2, decay: 0.1 });
    });
    this.showTutorialStep();
    this.dialogue.show('pepin', [
      'Tu es là ! Tu es VRAIMENT là !',
      'Bon. Moi je sais rien faire pousser. Mais je sais regarder.',
      'Commence par marcher. Après on verra.',
    ]);
  }

  showTutorialStep() {
    if (!this.tutorial) return;
    const step = this.tutorial.current();
    if (!step) {
      this.tutorialBanner.classList.add('hidden');
      return;
    }
    this.tutorialBanner.classList.remove('hidden');
    this.tutorialBanner.querySelector('strong').textContent = step.title;
    this.tutorialBanner.querySelector('span').textContent = step.hint;
  }

  pauseRun() {
    if (this.state !== STATE.PLAYING || !this.run) return;
    this.run.pause();
    this.state = STATE.PAUSED;
    this.hud.hide();
    this.hub.pause(this.run);
  }

  resumeRun() {
    if (!this.run) { this.hub.verger(); return; }
    this.hub.hide();
    this.screens.hide();
    this.hud.show(this.run);
    if (this.run.state === RUN_STATE.SEASON_END) this.run.nextSeason();
    else this.run.resume();
    this.state = STATE.PLAYING;
  }

  abandonRun() {
    if (this.run) this.collectRun(this.run, false, true);
    this.endRun(true);
    this.hub.verger();
    this.state = STATE.HUB;
  }

  endRun(silent = false) {
    if (this.tutorial) { this.tutorial.dispose(); this.tutorial = null; }
    this.tutorialBanner.classList.add('hidden');
    this.run = null;
    this.hud.hide();
    this.hud.hideEvent();
    this.particles.clear();
  }

  // Transfert du Cycle vers la sauvegarde : sève, statistiques, succès, échos.
  collectRun(run, won, abandoned = false) {
    const save = this.ensureSave();
    const gains = { sap: run.sap, echo: run.lastEcho || null, achievements: [] };
    save.sap += run.sap;
    save.totalSap += run.sap;
    save.biome = run.biome.id;

    const s = save.stats;
    s.runs += abandoned ? 0 : 1;
    s.harvests += run.stats.harvests;
    s.chords += run.stats.chords;
    s.purified += Math.round(run.stats.purified);
    s.perfectBeats += run.stats.perfectBeats;
    s.seedsSown += run.stats.seedsSown;
    s.bestChain = Math.max(s.bestChain, run.bestChain);
    s.bestScore = Math.max(s.bestScore, run.points);
    s.chordCounts = s.chordCounts || {};
    for (const [id, n] of Object.entries(run.stats.chordCounts)) {
      s.chordCounts[id] = (s.chordCounts[id] || 0) + n;
    }
    if (won && run.stats.wilted === 0) s.flawlessRun = true;

    if (run.lastEcho && !save.echoes.includes(run.lastEcho.id)) save.echoes.push(run.lastEcho.id);
    if (this.tutorial && this.tutorial.done) save.tutorialDone = true;
    if (won) save.tutorialDone = true;

    if (this.currentChallenge) {
      if (recordDaily(save, this.currentChallenge, run.points)) {
        this.toast('Nouveau record', this.currentChallenge.label, '#f6c453');
      }
    }

    gains.achievements = checkAchievements(save);
    this.persist();
    return gains;
  }

  // --- Évènements du jeu --------------------------------------------------------

  bindEvents() {
    on('field:sow', ({ tile }) => {
      this.burst(tile, { count: 5, color: '#c9b18a', speed: 50, size: 2.4, life: 0.5 });
    });
    on('field:ripe', ({ tile, plant }) => {
      this.burst(tile, {
        count: 8, color: DEGREE_INFO[plant.degree].glow, speed: 55, size: 2.6, life: 0.8, gravity: -20,
      });
      pluck(200 + Math.random() * 40, { dur: 0.5, gain: 0.06 });
    });
    on('field:wilt', ({ tile }) => {
      if (this.run) this.run.stats.wilted++;
      this.burst(tile, { count: 6, color: '#8a7d6a', speed: 30, size: 2, life: 1.1, shape: 'feuille' });
      breath({ dur: 0.4, gain: 0.08, from: 700, to: 200 });
      if (this.run && Math.random() < 0.3) this.bark('pepin', 'wilt');
    });
    on('field:echo', ({ tile }) => {
      this.burst(tile, { count: 22, color: '#fff6e0', speed: 90, size: 3, life: 1.4, gravity: -30 });
    });
    on('run:chord', ({ chord, result }) => {
      const x = (result.center.col + 0.5) * TILE;
      const y = (result.center.row + 0.5) * TILE;
      this.particles.spawn(x, y, {
        count: 26, color: chord.color, speed: 190, size: 3.4, life: 1.2, gravity: 60,
      });
      this.particles.spawn(x, y, {
        count: 12, color: '#fff6e0', speed: 90, size: 2.2, life: 1.6, gravity: -20, shape: 'feuille',
      });
      if (chord.id === 'pentatonique') this.toast('PENTATONIQUE', chord.flavour, chord.color);
      if (this.save && !this.save.stats.chords) this.bark('pepin', 'firstChord');
    });
    on('run:chainUp', ({ mult }) => {
      if (mult >= 3) this.bark('pepin', 'goodChain');
    });
    on('run:echo', (echo) => {
      this.toast(`Écho — ${echo.title}`, echo.text, '#fff6e0');
      this.bark('ondine', 'echo');
    });
    on('achievement', (a) => this.toast(`Succès — ${a.name}`, a.desc, '#8fce6a'));
    on('event:start', (ev) => { this.hud.showEvent(ev); this.toast(ev.name, ev.line, ev.color); rustle(0.2); });
    on('event:end', () => this.hud.hideEvent());
    on('player:step', ({ x, y }) => {
      if (this.settings.particles !== 'aucun') {
        this.particles.spawn(x, y + 14, { count: 2, color: '#c9b18a', speed: 24, size: 1.6, life: 0.4 });
      }
      wood({ freq: 180 + Math.random() * 40, gain: 0.045, decay: 0.05, q: 3 });
    });
    on('player:dash', ({ x, y }) => {
      this.particles.spawn(x, y, { count: 14, color: '#e8dcc6', speed: 130, size: 2.6, life: 0.5 });
    });
    on('run:season', (payload) => {
      this.hud.hide();
      this.state = STATE.PAUSED;
      this.hub.seasonEnd(payload);
      if (payload.cleared) this.bark('pepin', 'seasonClear');
    });
    on('run:end', ({ run, won }) => {
      const gains = this.collectRun(run, won);
      this.hud.hide();
      this.state = STATE.OVER;
      this.hub.results(run, won, gains);
      this.endRun(true);
    });
  }

  bark(npcId, key) {
    const line = npcBark(npcId, key, new Rng(Date.now()));
    if (line) this.toast(NPCS[npcId].name, line, NPCS[npcId].color);
  }

  burst(tile, opts) {
    if (this.settings.particles === 'aucun') return;
    const scale = this.settings.particles === 'sobre' ? 0.4 : 1;
    this.particles.spawn((tile.c + 0.5) * TILE, (tile.r + 0.5) * TILE,
      Object.assign({}, opts, { count: Math.max(2, Math.round((opts.count || 6) * scale)) }));
  }

  // --- Boucle -------------------------------------------------------------------

  update(dt) {
    this.lastInputKind = Input.kind();
    this.renderer.t += dt;
    this.dialogue.update(dt);
    this.testMode.update();

    if (Input.pressed('debug')) this.testMode.toggle();

    if (this.dialogue.isOpen()) {
      if (Input.pressed('act') || Input.pressed('pause')) this.dialogue.advance();
      Input.endFrame();
      this.particles.update(dt);
      return;
    }

    if (Input.pressed('pause')) {
      if (this.state === STATE.PLAYING) this.pauseRun();
      else if (this.state === STATE.PAUSED && this.run) this.resumeRun();
    }

    if (this.state === STATE.PLAYING && this.run) {
      const input = {
        move: Input.moveVector(),
        act: Input.pressed('act'),
        tune: Input.pressed('tune'),
        dash: Input.pressed('dash'),
        cycleSeed: Input.pressed('cycleSeed'),
        seedRequest: Input.takeSeedRequest(),
      };
      this.run.update(dt, input);
      this.hud.update(this.run);
      if (this.tutorial) {
        const before = this.tutorial.index;
        this.tutorial.update(dt);
        if (this.tutorial.index !== before) this.showTutorialStep();
        if (this.tutorial.done) {
          this.tutorialBanner.classList.add('hidden');
          this.save.tutorialDone = true;
          this.persist();
          this.tutorial = null;
        }
      }
      if (this.settings.particles === 'plein') {
        this.particles.ambient(this.run.field, this.run.biome, dt);
      }
    }

    this.particles.update(dt);
    Input.endFrame();
  }

  render(frameDt) {
    const r = this.renderer;
    const biome = this.run ? this.run.biome : this.idleBiome;
    const heal = this.save ? Math.min(1, (this.save.echoes || []).length / 12) : 0;

    r.ctx.setTransform(1, 0, 0, 1, 0, 0);
    r.drawBackground(biome, heal);

    if (this.run) {
      const shake = this.settings.screenShake && !this.settings.reducedMotion ? this.run.shake : 0;
      if (shake > 0) {
        const a = shake * 9;
        r.ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
      r.drawField(this.run.field, this.run);
      if (this.testMode.showGrid) this.drawDebugGrid();
      drawCursor(r, this.run);
      if (this.settings.showBeatRing) drawBeatRing(r, this.run);
      drawPlayer(r, this.run);
      this.particles.draw(r);
      drawFloaters(r, this.run);
      drawChordFlash(r, this.run, frameDt || 1 / 60);
    } else {
      this.drawIdleScene();
    }

    r.ctx.setTransform(1, 0, 0, 1, 0, 0);
    r.vignette();
    if (this.run && Input.isTouch()) this.drawStick();
  }

  drawStick() {
    const s = Input.stick();
    if (!s.active) return;
    const { ctx } = this.renderer;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, 54 * this.dpr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.arc(s.ox + s.x * 54 * this.dpr, s.oy + s.y * 54 * this.dpr, 22 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDebugGrid() {
    const r = this.renderer;
    const { ctx } = r;
    const f = this.run.field;
    ctx.save();
    ctx.translate(r.cam.x, r.cam.y);
    ctx.scale(r.cam.scale, r.cam.scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const t of f.tiles) {
      ctx.strokeRect(t.c * TILE, t.r * TILE, TILE, TILE);
      ctx.fillText(`${t.c},${t.r}`, t.c * TILE + 4, t.r * TILE + 12);
      ctx.fillText(`b${t.blight.toFixed(1)} h${t.moisture.toFixed(1)}`, t.c * TILE + 4, t.r * TILE + 24);
    }
    ctx.restore();
  }

  // Décor animé derrière les menus : le jeu n'est jamais un écran mort.
  pickIdleBiome() {
    const ids = ['clairiere', 'marais', 'canopee'];
    return BIOMES[ids[Math.floor(Math.random() * ids.length)]];
  }

  drawIdleScene() {
    const r = this.renderer;
    const { ctx, canvas } = r;
    const t = r.t;
    ctx.save();
    // Quelques tiges qui ondulent au premier plan.
    const n = 14;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * canvas.width + Math.sin(t * 0.3 + i) * 10;
      const h = canvas.height * (0.18 + ((i * 37) % 10) / 40);
      const sway = Math.sin(t * 1.1 + i * 0.8) * 18;
      ctx.strokeStyle = 'rgba(60,90,60,0.55)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, canvas.height + 10);
      ctx.quadraticCurveTo(x + sway * 0.4, canvas.height - h * 0.6, x + sway, canvas.height - h);
      ctx.stroke();
      const deg = ['I', 'II', 'III', 'V', 'VI'][i % 5];
      ctx.fillStyle = DEGREE_INFO[deg].color;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2 + i);
      ctx.beginPath();
      ctx.arc(x + sway, canvas.height - h, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.SEVE = new App();
});
