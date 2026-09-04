// Personnages, curseur, anneau de pulsation, particules, textes flottants.
// Séparé du décor : ce fichier ne dessine que ce qui bouge.

import { TILE } from '../game/constants.js';
import { DEGREE_INFO } from '../game/scales.js';
import { clamp, easeOut } from '../core/loop.js';

export function drawCursor(r, run) {
  const { ctx } = r;
  const t = run.player.targetTile();
  if (!t) return;
  const x = t.c * TILE, y = t.r * TILE;
  const pulse = 0.5 + Math.sin(r.t * 4) * 0.5;

  ctx.save();
  ctx.translate(r.cam.x, r.cam.y);
  ctx.scale(r.cam.scale, r.cam.scale);

  // Portée de la résonance : un cercle discret, la promesse du geste « Accorder ».
  ctx.globalAlpha = 0.10 + pulse * 0.05;
  ctx.strokeStyle = '#fff6e0';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.arc(run.player.x, run.player.y, (run.reach + 0.4) * TILE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.55 + pulse * 0.3;
  ctx.strokeStyle = '#fff6e0';
  ctx.lineWidth = 2.6;
  const m = 5 - pulse * 2;
  const corner = TILE * 0.28;
  const pts = [
    [x + m, y + m, 1, 1], [x + TILE - m, y + m, -1, 1],
    [x + m, y + TILE - m, 1, -1], [x + TILE - m, y + TILE - m, -1, -1],
  ];
  for (const [px, py, sx, sy] of pts) {
    ctx.beginPath();
    ctx.moveTo(px + sx * corner, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + sy * corner);
    ctx.stroke();
  }
  ctx.restore();
}

// L'anneau de Justesse : il se contracte à chaque pulsation. C'est l'horloge
// visible du jeu, et le seul élément d'interface posé sur le personnage.
export function drawBeatRing(r, run) {
  const { ctx } = r;
  const phase = run.conductor.phase();
  const near = Math.min(phase, 1 - phase);
  const hot = near < run.beatWindow / run.conductor.spb;

  ctx.save();
  ctx.translate(r.cam.x, r.cam.y);
  ctx.scale(r.cam.scale, r.cam.scale);

  const baseR = TILE * 0.55;
  const ringR = baseR + (1 - phase) * TILE * 1.15;
  ctx.globalAlpha = 0.18 + (1 - phase) * 0.35;
  ctx.strokeStyle = hot ? '#ffe9b0' : '#dfe8d8';
  ctx.lineWidth = hot ? 4 : 2.4;
  ctx.beginPath();
  ctx.arc(run.player.x, run.player.y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Cercle cible fixe.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ffe9b0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(run.player.x, run.player.y, baseR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawPlayer(r, run) {
  const { ctx } = r;
  const p = run.player;
  ctx.save();
  ctx.translate(r.cam.x, r.cam.y);
  ctx.scale(r.cam.scale, r.cam.scale);

  // Traînée du Souffle.
  for (const tr of p.trail) {
    const k = 1 - tr.t / 0.35;
    ctx.globalAlpha = k * 0.3;
    ctx.fillStyle = '#e8dcc6';
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, 14 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const bob = Math.sin(p.bob * 3) * 2.4;
  const act = p.actAnim;
  const tune = p.tuneAnim;

  // Ombre.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 15, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Onde d'accordage.
  if (tune > 0) {
    ctx.globalAlpha = tune * 0.5;
    ctx.strokeStyle = DEGREE_INFO[run.selectedSeed].glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (1 - tune) * run.reach * TILE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(p.x, p.y + bob - act * 3);

  // Cape / robe : une forme en goutte, penchée dans le sens du déplacement.
  const lean = clamp(p.vx / 300, -0.35, 0.35);
  ctx.rotate(lean * 0.35);
  ctx.fillStyle = '#3b3026';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.quadraticCurveTo(16, -6, 13, 16);
  ctx.quadraticCurveTo(0, 21, -13, 16);
  ctx.quadraticCurveTo(-16, -6, 0, -22);
  ctx.fill();

  // Écharpe de sève : la seule couleur vive du personnage, celle de la graine choisie.
  ctx.fillStyle = DEGREE_INFO[run.selectedSeed].color;
  ctx.beginPath();
  ctx.moveTo(-11, -6);
  ctx.quadraticCurveTo(0, -1, 11, -6);
  ctx.quadraticCurveTo(6 - p.vx * 0.02, 5, -6 - p.vx * 0.03, 4);
  ctx.fill();

  // Tête.
  ctx.fillStyle = '#e8d5b5';
  ctx.beginPath();
  ctx.arc(0, -25, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // Chapeau de feuille.
  ctx.fillStyle = '#5b7f4a';
  ctx.beginPath();
  ctx.ellipse(0, -32, 15, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(2, -37, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bras : il se tend vers la case quand on agit.
  ctx.strokeStyle = '#e8d5b5';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const reachY = 4 + act * 8;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.quadraticCurveTo(-12, 0, -6, reachY);
  ctx.moveTo(8, -10);
  ctx.quadraticCurveTo(12, 0, 6, reachY);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

export function drawFloaters(r, run) {
  const { ctx } = r;
  ctx.save();
  ctx.translate(r.cam.x, r.cam.y);
  ctx.scale(r.cam.scale, r.cam.scale);
  ctx.textAlign = 'center';
  for (const f of run.floaters) {
    const k = f.t / f.life;
    const rise = easeOut(k);
    ctx.globalAlpha = k < 0.12 ? k / 0.12 : 1 - Math.max(0, (k - 0.6) / 0.4);
    const scale = k < 0.16 ? 0.6 + (k / 0.16) * 0.5 : 1.05 - k * 0.08;
    ctx.font = `700 ${f.size * scale}px "Trebuchet MS", system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,16,12,0.65)';
    ctx.strokeText(f.text, f.x, f.y - rise * 30);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - rise * 30);
  }
  ctx.restore();
}

// Le nom de l'accord, en grand, au centre : le moment de gloire.
export function drawChordFlash(r, run, dt) {
  if (!run.flashChord) return;
  const f = run.flashChord;
  f.t += dt;
  if (f.t > 1.5) { run.flashChord = null; return; }
  const { ctx, canvas } = r;
  const k = f.t / 1.5;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.globalAlpha = k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.55) / 0.45);
  const scale = 1 + easeOut(Math.min(1, k * 4)) * 0.25;
  const size = Math.min(canvas.width * 0.075, 64) * scale;
  ctx.font = `800 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.lineWidth = size * 0.14;
  ctx.strokeStyle = 'rgba(20,16,12,0.7)';
  const y = canvas.height * 0.34;
  ctx.strokeText(f.chord.name, canvas.width / 2, y);
  ctx.fillStyle = f.chord.color;
  ctx.fillText(f.chord.name, canvas.width / 2, y);
  ctx.font = `400 ${size * 0.32}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.globalAlpha *= 0.8;
  ctx.fillStyle = '#f3e7cf';
  ctx.fillText(f.chord.flavour, canvas.width / 2, y + size * 0.55);
  ctx.restore();
}

// --- Particules ---------------------------------------------------------------

export class Particles {
  constructor() { this.items = []; }

  spawn(x, y, opts = {}) {
    const {
      count = 6, color = '#ffe9b0', speed = 60, life = 0.8,
      size = 3, gravity = 40, spread = Math.PI * 2, angle = 0, shape = 'rond',
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random());
      this.items.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * (0.7 + Math.random() * 0.6), t: 0,
        color, size: size * (0.7 + Math.random() * 0.6), gravity, shape,
        spin: (Math.random() - 0.5) * 8, rot: Math.random() * 6.3,
      });
    }
    if (this.items.length > 400) this.items.splice(0, this.items.length - 400);
  }

  // Poussière ambiante : pollen, spores, braises. Toujours présente, très lente.
  ambient(field, biome, dt) {
    if (Math.random() > dt * 6) return;
    const w = field.cols * TILE, h = field.rows * TILE;
    this.items.push({
      x: Math.random() * w, y: h + 10,
      vx: (Math.random() - 0.5) * 12 + (biome.wind ? 22 : 0),
      vy: -8 - Math.random() * 14,
      life: 5 + Math.random() * 4, t: 0,
      color: biome.palette.accent, size: 1.6 + Math.random() * 1.6,
      gravity: -1.5, shape: 'rond', spin: 0, rot: 0, ambient: true,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - dt * 1.2;
      p.rot += p.spin * dt;
      if (p.t >= p.life) this.items.splice(i, 1);
    }
  }

  draw(r) {
    const { ctx } = r;
    ctx.save();
    ctx.translate(r.cam.x, r.cam.y);
    ctx.scale(r.cam.scale, r.cam.scale);
    for (const p of this.items) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = p.ambient ? k * 0.4 : k;
      ctx.fillStyle = p.color;
      if (p.shape === 'feuille') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() { this.items.length = 0; }
}
