// Mode Test. Tout ce qu'il faut pour vérifier une mécanique en dix secondes,
// sans jouer une partie complète. Accessible par la touche T.

import { el, button, clear, slider, select } from '../ui/dom.js';
import { SPECIES_ORDER, SPECIES } from '../game/plants.js';
import { DEGREE_INFO, CHORDS } from '../game/scales.js';
import { BIOME_ORDER, BIOMES } from '../game/biomes.js';
import { EVENTS } from '../game/randomevents.js';
import { NPC_ORDER, NPCS } from '../game/npcs.js';
import { ACHIEVEMENTS } from '../game/achievements.js';
import { ECHOES } from '../game/lore.js';
import { SEASON } from '../game/constants.js';

export class TestMode {
  constructor(root, app) {
    this.app = app;
    this.open = false;
    this.showGrid = false;
    this.el = el('div', 'testmode hidden');
    root.appendChild(this.el);
    this.build();
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.open = true; this.el.classList.remove('hidden'); this.refresh(); }
  hide() { this.open = false; this.el.classList.add('hidden'); }

  build() {
    clear(this.el);
    const head = el('div', 'tm-head');
    head.innerHTML = '<strong>MODE TEST</strong><small>T pour fermer</small>';
    head.appendChild(button('✕', () => this.hide(), 'icon-btn'));
    this.el.appendChild(head);
    this.body = el('div', 'tm-body');
    this.el.appendChild(this.body);
  }

  section(title) {
    const s = el('section', 'tm-section');
    s.appendChild(el('h4', '', title));
    this.body.appendChild(s);
    return s;
  }

  refresh() {
    clear(this.body);
    const app = this.app;
    const run = app.run;

    // --- Diagnostics ---
    const diag = this.section('Diagnostics');
    this.diagEl = el('pre', 'tm-diag', '');
    diag.appendChild(this.diagEl);

    // --- Sans partie en cours ---
    if (!run) {
      const start = this.section('Démarrer');
      for (const id of BIOME_ORDER) {
        start.appendChild(button(BIOMES[id].name, () => {
          app.ensureSave();
          app.save.unlockedBiomes = [...BIOME_ORDER];
          app.save.unlockedSeeds = [...SPECIES_ORDER];
          app.startRun(id, { testMode: true });
          setTimeout(() => this.refresh(), 60);
        }, 'btn small'));
      }
      const save = this.section('Sauvegarde');
      save.appendChild(button('Tout débloquer + 50 000 sève', () => {
        app.ensureSave();
        app.save.unlockedBiomes = [...BIOME_ORDER];
        app.save.unlockedSeeds = [...SPECIES_ORDER];
        app.save.sap += 50000;
        app.save.echoes = ECHOES.map((e) => e.id);
        app.persist();
        app.toast('Mode Test', 'Tout est débloqué.', '#f6c453');
      }, 'btn small'));
      save.appendChild(button('Débloquer tous les succès', () => {
        app.ensureSave();
        for (const a of ACHIEVEMENTS) app.save.achievements[a.id] = Date.now();
        app.persist();
      }, 'btn small'));
      this.buildDialogueSection();
      return;
    }

    // --- Graines ---
    const seeds = this.section('Faire pousser');
    const seedRow = el('div', 'tm-row');
    for (const key of SPECIES_ORDER) {
      const b = button(`${SPECIES[key].name}`, () => this.spawnPlant(key, false), 'btn tiny');
      b.style.borderColor = DEGREE_INFO[key].color;
      seedRow.appendChild(b);
    }
    seeds.appendChild(seedRow);
    const ripeRow = el('div', 'tm-row');
    for (const key of SPECIES_ORDER) {
      const b = button(`${key} mûr`, () => this.spawnPlant(key, true), 'btn tiny');
      b.style.borderColor = DEGREE_INFO[key].color;
      ripeRow.appendChild(b);
    }
    seeds.appendChild(ripeRow);
    seeds.appendChild(button('Tout faire mûrir', () => {
      for (const t of run.field.tiles) {
        if (t.plant && !t.plant.wilted) { t.plant.growth = 1; t.plant.ripe = true; t.plant.pop = 1; }
      }
    }, 'btn small'));
    seeds.appendChild(button('Vider le champ', () => {
      for (const t of run.field.tiles) t.plant = null;
    }, 'btn small'));

    // --- Accords prêts à l'emploi ---
    const chords = this.section('Poser un accord');
    for (const chord of CHORDS) {
      chords.appendChild(button(chord.name, () => this.layChord(chord), 'btn tiny'));
    }

    // --- Cendre ---
    const blight = this.section('Cendre');
    blight.appendChild(button('Purifier tout', () => {
      for (const t of run.field.tiles) { t.blight = 0; t.fissure = false; }
    }, 'btn small'));
    blight.appendChild(button('Cendre +25 %', () => {
      for (const t of run.field.tiles) run.field.paintBlight(t, 0.25);
    }, 'btn small'));
    blight.appendChild(button('Cendre autour de moi', () => {
      for (const t of run.field.tilesInRadius(run.player.col, run.player.row, 2)) run.field.paintBlight(t, 0.6);
    }, 'btn small'));
    blight.appendChild(button('Nouvelle fissure', () => run.field.placeFissures(1), 'btn small'));

    // --- Rythme et progression ---
    const flow = this.section('Rythme & progression');
    flow.appendChild(slider('Tempo', run.conductor.bpm / 200, 0.3, 1, 0.01,
      (v) => run.conductor.setBpm(Math.round(v * 200))));
    flow.appendChild(button('+1000 sève', () => run.addSap(1000, 'test'), 'btn small'));
    flow.appendChild(button('Chaîne ×4', () => { run.chain = 12; run.chainMult = 4; }, 'btn small'));
    flow.appendChild(button('Fin de saison', () => run.endSeason(), 'btn small'));
    flow.appendChild(button('Gagner le Cycle', () => run.finish(true), 'btn small'));
    flow.appendChild(button('Perdre le Cycle', () => run.finish(false), 'btn small'));
    flow.appendChild(button(run.godMode ? 'Invincible : ON' : 'Invincible : OFF', () => {
      run.godMode = !run.godMode; this.refresh();
    }, 'btn small'));
    flow.appendChild(button(this.showGrid ? 'Grille : ON' : 'Grille : OFF', () => {
      this.showGrid = !this.showGrid; this.refresh();
    }, 'btn small'));

    // --- Évènements ---
    const evs = this.section('Évènements');
    for (const ev of EVENTS) {
      evs.appendChild(button(ev.name, () => run.director.trigger(ev.id), 'btn tiny'));
    }
    evs.appendChild(button('Arrêter l’évènement', () => run.director.stop(), 'btn tiny'));

    this.buildDialogueSection();
  }

  buildDialogueSection() {
    const dlg = this.section('Personnages');
    for (const id of NPC_ORDER) {
      dlg.appendChild(button(NPCS[id].name, () => {
        this.app.dialogue.show(id, NPCS[id].intro);
      }, 'btn tiny'));
    }
    const echo = this.section('Échos');
    echo.appendChild(select('Afficher', ECHOES.map((e) => ({ value: e.id, label: e.title })), ECHOES[0].id,
      (v) => {
        const e = ECHOES.find((x) => x.id === v);
        this.app.toast(e.title, e.text, '#fff6e0');
      }));
  }

  spawnPlant(key, ripe) {
    const run = this.app.run;
    if (!run) return;
    const t = run.player.targetTile();
    if (!t) return;
    t.plant = null;
    t.blight = 0;
    if (t.terrain === 'water' || t.terrain === 'void' || t.terrain === 'stone') t.terrain = 'soil';
    const p = run.field.sow(t, key);
    if (p && ripe) { p.growth = 1; p.ripe = true; p.pop = 1; }
  }

  // Pose un accord complet autour du joueur : un clic, un accord testable.
  layChord(chord) {
    const run = this.app.run;
    if (!run) return;
    const c0 = run.player.col, r0 = run.player.row;
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    chord.need.forEach((deg, i) => {
      const [dc, dr] = offsets[i % offsets.length];
      const t = run.field.at(c0 + dc, r0 + dr);
      if (!t) return;
      t.terrain = 'soil';
      t.blight = 0;
      t.plant = null;
      const p = run.field.sow(t, deg);
      if (p) { p.growth = 1; p.ripe = true; p.pop = 1; }
    });
  }

  update() {
    if (!this.open || !this.diagEl) return;
    const app = this.app;
    const run = app.run;
    const lines = [
      `fps        ${app.loop.fps}`,
      `écran      ${app.canvas.width}×${app.canvas.height} @${app.dpr.toFixed(2)}`,
      `entrée     ${app.lastInputKind}`,
      `audio      ${app.audioOn ? 'actif' : 'en attente d’un geste'}`,
    ];
    if (run) {
      lines.push(
        `biome      ${run.biome.id} · ${run.conductor.bpm} BPM`,
        `pulsation  ${run.conductor.beat} (phase ${run.conductor.phase().toFixed(2)})`,
        `saison     ${run.season + 1}/${SEASON.count} · ${run.seasonBeats}/${run.beatsThisSeason}`,
        `sève       ${run.sap} (saison ${run.seasonSap}/${run.goal})`,
        `chaîne     ${run.chain} → ×${run.chainMult}`,
        `cendre     ${(run.field.blightRatio() * 100).toFixed(1)} %`,
        `plantes    ${run.field.plants().length}`,
        `particules ${app.particles.items.length}`,
        `case       ${run.player.col},${run.player.row} — ${run.contextLabel()}`,
      );
    } else {
      lines.push('aucune partie en cours');
    }
    this.diagEl.textContent = lines.join('\n');
  }
}
