// Portraits des personnages, dessinés à la main dans un petit canvas.
// Ils respirent, clignent et bougent quand le personnage parle.

import { NPCS } from '../game/npcs.js';

export function drawNpcPortrait(ctx, npcId, t, talking = 0) {
  const npc = NPCS[npcId];
  if (!npc) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 + h * 0.06;
  const breathe = Math.sin(t * 1.8) * h * 0.012;
  const s = h * 0.34 * npc.size;

  ctx.save();
  ctx.translate(cx, cy + breathe);

  // Halo.
  const g = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.7);
  g.addColorStop(0, `${npc.accent}55`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.7, 0, Math.PI * 2);
  ctx.fill();

  switch (npcId) {
    case 'pepin': drawPepin(ctx, s, t, talking, npc); break;
    case 'bourdon': drawBourdon(ctx, s, t, talking, npc); break;
    case 'ondine': drawOndine(ctx, s, t, talking, npc); break;
    case 'cendre': drawCendre(ctx, s, t, talking, npc); break;
    default: drawLuthier(ctx, s, t, talking, npc);
  }
  ctx.restore();
}

function eyes(ctx, s, t, spacing = 0.3, size = 0.09) {
  const blink = (Math.sin(t * 0.9) > 0.985) ? 0.1 : 1;
  ctx.fillStyle = '#241d16';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * spacing, -s * 0.08, s * size, s * size * blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mouth(ctx, s, talking) {
  ctx.fillStyle = '#241d16';
  const open = 0.02 + talking * 0.07;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.22, s * 0.09, s * open, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPepin(ctx, s, t, talking, npc) {
  // Une graine qui germe, avec deux feuilles trop grandes pour elle.
  ctx.fillStyle = '#6b8f4a';
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.rotate(sx * (0.5 + Math.sin(t * 2 + sx) * 0.08));
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.95, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = npc.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.62, s * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = npc.accent;
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, -s * 0.25, s * 0.15, s * 0.19, -0.4, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, s, t, 0.26, 0.11);
  mouth(ctx, s, talking);
}

function drawBourdon(ctx, s, t, talking, npc) {
  // Un bourdon rond, aux ailes usées.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#dfe8f5';
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.rotate(sx * (0.6 + Math.sin(t * 14) * 0.12));
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.5, -s * 0.5, s * 0.45, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3b3026';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.75, s * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = npc.color;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(0, i * s * 0.28, s * 0.74 * Math.cos(i * 0.5), s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  eyes(ctx, s, t, 0.3, 0.1);
  mouth(ctx, s, talking);
}

function drawOndine(ctx, s, t, talking, npc) {
  // Une silhouette d'eau : ses contours ne tiennent jamais en place.
  ctx.strokeStyle = npc.color;
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const rad = s * (0.7 + Math.sin(a * 3 + t * 2) * 0.07 + Math.sin(a * 5 - t * 1.3) * 0.04);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = npc.accent;
  ctx.fill();
  ctx.globalAlpha = 1;
  eyes(ctx, s, t, 0.28, 0.07);
}

function drawCendre(ctx, s, t, talking, npc) {
  // Un gardien à moitié effacé : la moitié gauche est encore verte.
  ctx.fillStyle = '#5d574e';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.9);
  ctx.quadraticCurveTo(s * 0.85, -s * 0.2, s * 0.55, s * 0.8);
  ctx.lineTo(-s * 0.55, s * 0.8);
  ctx.quadraticCurveTo(-s * 0.85, -s * 0.2, 0, -s * 0.9);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-s, -s, s, s * 2);
  ctx.clip();
  ctx.fillStyle = '#5b7f4a';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.9);
  ctx.quadraticCurveTo(-s * 0.85, -s * 0.2, -s * 0.55, s * 0.8);
  ctx.lineTo(0, s * 0.8);
  ctx.fill();
  ctx.restore();
  // Cendre qui s'échappe.
  ctx.fillStyle = '#8a8378';
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.4 + i / 5) % 1;
    ctx.globalAlpha = (1 - k) * 0.5;
    ctx.beginPath();
    ctx.arc(Math.sin(i * 2 + t) * s * 0.4, -s * 0.9 - k * s * 0.7, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  eyes(ctx, s, t, 0.24, 0.06);
}

function drawLuthier(ctx, s, t, talking, npc) {
  // On ne voit jamais le Luthier : seulement des cordes qui vibrent.
  ctx.strokeStyle = npc.color;
  ctx.lineWidth = s * 0.035;
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * s * 0.28;
    const amp = s * 0.06 * Math.sin(t * (2 + i * 0.6));
    ctx.globalAlpha = 0.4 + 0.12 * Math.sin(t * 3 + i);
    ctx.beginPath();
    ctx.moveTo(x, -s * 1.1);
    ctx.quadraticCurveTo(x + amp, 0, x, s * 1.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
