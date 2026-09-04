// Flore : le dessin détaillé des cinq espèces, en quatre stades.
// Tout est vectoriel et procédural : feuilles nervurées, bulbes, ombelles,
// frondes, clochettes. Chaque plante garde ses propres variations (inclinaison,
// phase de balancement, nombre de feuilles) pour que deux voisines diffèrent.

import { DEGREE_INFO } from '../game/scales.js';
import { clamp } from '../core/loop.js';

// --- Petits outils de dessin ---------------------------------------------------

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hexA, hexB, k) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
}

const LEAF_DARK = '#2f5a35';
const LEAF_MID = '#4f8a45';
const LEAF_LIGHT = '#8bc46a';
const STEM = '#3f6b3a';
const OUTLINE = 'rgba(20,28,16,0.55)';

// Une feuille : forme en amande, nervure centrale, fine bordure sombre.
function leaf(ctx, len, width, color, light, curl = 0) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -width * (1 + curl), len * 0.75, -width * (0.8 - curl * 0.3), len, 0);
  ctx.bezierCurveTo(len * 0.75, width * (0.8 + curl * 0.3), len * 0.25, width * (1 - curl), 0, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // Nervure.
  ctx.beginPath();
  ctx.moveTo(len * 0.05, 0);
  ctx.quadraticCurveTo(len * 0.5, -width * 0.12, len * 0.92, 0);
  ctx.strokeStyle = light;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function stem(ctx, h, lean, thickness, color = STEM) {
  ctx.lineCap = 'round';
  ctx.lineWidth = thickness + 1.6;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * h * 0.35, -h * 0.55, lean * h * 0.55, -h);
  ctx.stroke();
  ctx.lineWidth = thickness;
  ctx.strokeStyle = color;
  ctx.stroke();
}

// Point sur la tige courbée, pour y accrocher des feuilles.
function stemPoint(h, lean, k) {
  const p0 = [0, 0], p1 = [lean * h * 0.35, -h * 0.55], p2 = [lean * h * 0.55, -h];
  const u = 1 - k;
  return [
    u * u * p0[0] + 2 * u * k * p1[0] + k * k * p2[0],
    u * u * p0[1] + 2 * u * k * p1[1] + k * k * p2[1],
  ];
}

function glowDisc(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function groundShadow(ctx, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 2, w, w * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Motte de semis : un petit dôme de terre fendu, la graine qui pointe.
function seedMound(ctx, size, color, t, phase) {
  ctx.fillStyle = '#4a3624';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.1, size * 0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#5c4530';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.1, size * 0.85, size * 0.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#2b1e13';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-size * 0.35, -size * 0.05);
  ctx.quadraticCurveTo(0, -size * 0.45, size * 0.3, -size * 0.1);
  ctx.stroke();
  const pulse = 0.5 + Math.sin(t * 3 + phase) * 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.35, size * 0.16, size * 0.24, 0.3, 0, Math.PI * 2);
  ctx.fill();
  glowDisc(ctx, 0, -size * 0.35, size * 0.6, color, 0.18 + pulse * 0.14);
}

// Pousse : tige courte, deux cotylédons.
function sprout(ctx, h, lean, t, phase, color) {
  stem(ctx, h, lean, 2.2);
  const [tx, ty] = stemPoint(h, lean, 1);
  // Les cotylédons prennent déjà la teinte du degré : on reconnaît l'espèce tôt.
  const tint = mix(LEAF_MID, color, 0.35);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(s * (Math.PI * 0.38) - Math.PI / 2 + Math.sin(t * 1.7 + phase + s) * 0.06);
    leaf(ctx, h * 0.55, h * 0.16, tint, LEAF_LIGHT, 0.2);
    ctx.restore();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(tx, ty - 1, h * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

// Rosette de feuilles à la base, commune à plusieurs espèces.
function rosette(ctx, count, len, width, t, phase, colorA = LEAF_DARK, colorB = LEAF_MID) {
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (i / (count - 1)) * Math.PI;   // de gauche à droite, vers le haut
    const sway = Math.sin(t * 1.5 + phase + i * 0.9) * 0.05;
    ctx.save();
    ctx.rotate(a + sway);
    leaf(ctx, len * (0.8 + (i % 2) * 0.25), width, i % 2 ? colorA : colorB, LEAF_LIGHT, 0.15);
    ctx.restore();
  }
}

// --- Espèces -----------------------------------------------------------------

// I — Ancrine : plante à bulbe, feuilles larges, gros fruit ambré côtelé.
function ancrine(ctx, p, h, stage, t, color, glow) {
  const lean = p.lean * 0.4;
  rosette(ctx, 4 + (p.leaves % 2), h * 0.55, h * 0.16, t, p.phase);
  stem(ctx, h * 0.72, lean, 3.4);
  const [tx, ty] = stemPoint(h * 0.72, lean, 1);
  const r = h * (stage === 3 ? 0.30 : 0.19);

  // Bulbe côtelé.
  const g = ctx.createRadialGradient(tx - r * 0.35, ty - r * 0.35, r * 0.1, tx, ty, r * 1.15);
  g.addColorStop(0, glow);
  g.addColorStop(0.55, color);
  g.addColorStop(1, mix(color, '#3a2410', 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(tx, ty, r * 0.92, r * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(tx + k * r * 0.5, ty - r * 1.0);
    ctx.quadraticCurveTo(tx + k * r * 0.9, ty, tx + k * r * 0.5, ty + r * 1.0);
    ctx.stroke();
  }
  // Collerette de sépales.
  ctx.fillStyle = LEAF_DARK;
  for (let i = -1; i <= 1; i++) {
    ctx.save();
    ctx.translate(tx, ty - r * 0.95);
    ctx.rotate(-Math.PI / 2 + i * 0.55);
    leaf(ctx, r * 0.9, r * 0.22, LEAF_DARK, LEAF_MID, 0.3);
    ctx.restore();
  }
  if (stage === 3) {
    const pulse = 0.5 + Math.sin(t * 2.4 + p.phase) * 0.5;
    glowDisc(ctx, tx, ty, r * 2.1, glow, 0.16 + pulse * 0.12);
    // Reflet vernissé.
    ctx.fillStyle = 'rgba(255,250,230,0.55)';
    ctx.beginPath();
    ctx.ellipse(tx - r * 0.38, ty - r * 0.42, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// II — Hâtille : graminée fine, feuilles alternes, épi de graines.
function hatille(ctx, p, h, stage, t, color, glow) {
  const lean = p.lean * 0.9 + Math.sin(t * 1.8 + p.phase) * 0.12;
  const H = h * 1.05;
  stem(ctx, H, lean, 2);
  const n = 4 + (p.leaves % 3);
  for (let i = 0; i < n; i++) {
    const k = 0.12 + (i / n) * 0.72;
    const [x, y] = stemPoint(H, lean, k);
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * (Math.PI * 0.28) - Math.PI / 2 + lean * 0.5 + Math.sin(t * 2 + p.phase + i) * 0.08);
    leaf(ctx, H * (0.30 - i * 0.02), H * 0.055, i % 2 ? LEAF_MID : LEAF_LIGHT, '#d7f5b8', 0.05);
    ctx.restore();
  }
  if (stage >= 2) {
    // Épi : grains alternés, barbes fines.
    const [tx, ty] = stemPoint(H, lean, 1);
    const grains = stage === 3 ? 9 : 5;
    const gl = H * 0.32;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(lean * 0.8);
    for (let i = 0; i < grains; i++) {
      const k = i / grains;
      const y = -k * gl;
      const side = i % 2 ? 1 : -1;
      ctx.strokeStyle = 'rgba(215,245,184,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(side * 2, y);
      ctx.lineTo(side * H * 0.09, y - H * 0.16);
      ctx.stroke();
      ctx.fillStyle = stage === 3 ? glow : color;
      ctx.beginPath();
      ctx.ellipse(side * H * 0.035, y, H * 0.03, H * 0.05, side * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.restore();
    if (stage === 3) glowDisc(ctx, tx, ty - gl * 0.5, gl * 0.9, glow, 0.2);
  }
}

// III — Clairine : ombelle en rayons, fleurettes lumineuses.
function clairine(ctx, p, h, stage, t, color, glow) {
  const lean = p.lean * 0.5;
  rosette(ctx, 3, h * 0.42, h * 0.10, t, p.phase, LEAF_MID, LEAF_DARK);
  stem(ctx, h * 0.95, lean, 2.4);
  const [tx, ty] = stemPoint(h * 0.95, lean, 1);
  const rays = stage === 3 ? 9 : stage === 2 ? 6 : 3;
  const span = h * (stage === 3 ? 0.42 : 0.26);
  ctx.save();
  ctx.translate(tx, ty);
  for (let i = 0; i < rays; i++) {
    const a = -Math.PI + (i / (rays - 1)) * Math.PI;
    const wob = Math.sin(t * 2.2 + p.phase + i) * 0.04;
    const ex = Math.cos(a + wob) * span;
    const ey = Math.sin(a + wob) * span * 0.55 - span * 0.1;
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(ex * 0.5, ey - span * 0.25, ex, ey);
    ctx.stroke();
    // Bouquet de fleurettes au bout de chaque rayon.
    const petals = stage === 3 ? 5 : 3;
    for (let j = 0; j < petals; j++) {
      const pa = (j / petals) * Math.PI * 2;
      const pr = h * 0.045;
      ctx.fillStyle = stage === 3 ? glow : color;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(pa) * pr, ey + Math.sin(pa) * pr, h * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = stage === 3 ? '#fff6e0' : mix(color, '#ffffff', 0.4);
    ctx.beginPath();
    ctx.arc(ex, ey, h * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (stage === 3) {
    const pulse = 0.5 + Math.sin(t * 3 + p.phase) * 0.5;
    glowDisc(ctx, tx, ty - span * 0.2, span * 1.3, glow, 0.14 + pulse * 0.14);
    // Étincelles : la Clairine « éclaire ».
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3 + p.phase) % 1;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath();
      ctx.arc(tx + Math.sin(i * 2.1 + t) * span * 0.6, ty - span * 0.3 - k * h * 0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// V — Portante : fougère, frondes arquées à folioles, crosses enroulées.
function portante(ctx, p, h, stage, t, color, glow) {
  const fronds = stage === 3 ? 5 : stage === 2 ? 4 : 2;
  const ripeTint = stage === 3 ? mix(LEAF_MID, color, 0.35) : LEAF_MID;
  for (let f = 0; f < fronds; f++) {
    const side = f % 2 ? 1 : -1;
    const spread = 0.35 + (f / fronds) * 0.9;
    const angle = -Math.PI / 2 + side * spread * 0.8 + p.lean * 0.3;
    const len = h * (0.95 - f * 0.08);
    const sway = Math.sin(t * 1.4 + p.phase + f) * 0.05;
    ctx.save();
    ctx.rotate(angle + sway);
    // Rachis.
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -side * len * 0.12, len, -side * len * 0.35);
    ctx.stroke();
    // Folioles le long du rachis.
    const pinnae = 7;
    for (let i = 1; i <= pinnae; i++) {
      const k = i / (pinnae + 1);
      const u = 1 - k;
      const x = 2 * u * k * (len * 0.5) + k * k * len;
      const y = 2 * u * k * (-side * len * 0.12) + k * k * (-side * len * 0.35);
      const pl = len * 0.22 * Math.sin(k * Math.PI) + len * 0.05;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s * 1.05 - side * 0.2);
        leaf(ctx, pl, pl * 0.28, s > 0 ? ripeTint : LEAF_DARK, LEAF_LIGHT, 0.1);
        ctx.restore();
      }
    }
    // Sores : les points de spores, lumineux à maturité.
    if (stage === 3) {
      ctx.fillStyle = glow;
      for (let i = 2; i <= pinnae; i += 2) {
        const k = i / (pinnae + 1);
        const u = 1 - k;
        const x = 2 * u * k * (len * 0.5) + k * k * len;
        const y = 2 * u * k * (-side * len * 0.12) + k * k * (-side * len * 0.35);
        ctx.beginPath();
        ctx.arc(x, y + side * 3, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // Crosse centrale enroulée (le « fiddlehead »), plus haute à maturité.
  const ch = h * (stage === 3 ? 1.0 : 0.6);
  stem(ctx, ch, p.lean * 0.3, 2.4, stage === 3 ? mix(STEM, color, 0.4) : STEM);
  const [tx, ty] = stemPoint(ch, p.lean * 0.3, 1);
  ctx.strokeStyle = stage === 3 ? color : STEM;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const spiral = 2.6;
  for (let a = 0; a < spiral; a += 0.1) {
    const r = h * 0.05 * (spiral - a);
    const x = tx + Math.cos(a * 2.4) * r, y = ty - Math.sin(a * 2.4) * r - h * 0.04;
    if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (stage === 3) {
    const pulse = 0.5 + Math.sin(t * 2 + p.phase) * 0.5;
    glowDisc(ctx, tx, ty - h * 0.05, h * 0.5, glow, 0.12 + pulse * 0.1);
  }
}

// VI — Amplaire : campanule, tiges arquées, clochettes suspendues.
function amplaire(ctx, p, h, stage, t, color, glow) {
  rosette(ctx, 3, h * 0.4, h * 0.11, t, p.phase);
  const lean = p.lean * 0.6;
  const H = h * 1.0;
  stem(ctx, H, lean, 2.6);
  // Feuilles lancéolées le long de la tige.
  for (let i = 0; i < 3; i++) {
    const k = 0.25 + i * 0.22;
    const [x, y] = stemPoint(H, lean, k);
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(side * 1.1 - Math.PI / 2 + Math.sin(t * 1.6 + p.phase + i) * 0.06);
    leaf(ctx, H * 0.26, H * 0.06, LEAF_MID, LEAF_LIGHT, 0.1);
    ctx.restore();
  }
  const bells = stage === 3 ? 4 : stage === 2 ? 2 : 1;
  for (let i = 0; i < bells; i++) {
    const k = 0.55 + (i / Math.max(1, bells - 1)) * 0.45;
    const [x, y] = stemPoint(H, lean, Math.min(1, k));
    const side = i % 2 ? 1 : -1;
    const droop = Math.sin(t * 2.1 + p.phase + i * 1.3) * 0.08;
    const bw = h * (stage === 3 ? 0.13 : 0.09);
    const bh = bw * 1.55;
    ctx.save();
    ctx.translate(x, y);
    // Pédicelle.
    ctx.strokeStyle = STEM;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * bw * 1.2, bw * 0.2, side * bw * 1.6, bw * 0.9);
    ctx.stroke();
    ctx.translate(side * bw * 1.6, bw * 0.9);
    ctx.rotate(side * 0.35 + droop);
    // Clochette : corolle en cloche, lobes ondulés.
    const g = ctx.createLinearGradient(0, 0, 0, bh);
    g.addColorStop(0, mix(color, '#ffffff', 0.15));
    g.addColorStop(1, mix(color, '#2a1030', 0.45));
    ctx.fillStyle = stage === 1 ? mix(LEAF_MID, color, 0.4) : g;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.35, 0);
    ctx.bezierCurveTo(-bw * 1.05, bh * 0.45, -bw * 1.1, bh * 0.9, -bw * 0.9, bh);
    for (let l = 0; l < 4; l++) {
      const x0 = -bw * 0.9 + (l / 4) * bw * 1.8, x1 = x0 + bw * 0.45;
      ctx.quadraticCurveTo((x0 + x1) / 2, bh * 0.82, x1, bh);
    }
    ctx.bezierCurveTo(bw * 1.1, bh * 0.9, bw * 1.05, bh * 0.45, bw * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Calice.
    ctx.fillStyle = LEAF_DARK;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.42, bw * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    if (stage === 3) {
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, bh * 0.92, bw * 0.16, 0, Math.PI * 2);
      ctx.fill();
      glowDisc(ctx, 0, bh * 0.6, bw * 1.6, glow, 0.16);
    }
    ctx.restore();
  }
}

const DRAWERS = { I: ancrine, II: hatille, III: clairine, V: portante, VI: amplaire };

// Stade visuel : 0 graine · 1 pousse · 2 bourgeon · 3 mûre.
export function visualStage(plant) {
  if (plant.ripe) return 3;
  if (plant.growth < 0.18) return 0;
  if (plant.growth < 0.55) return 1;
  return 2;
}

// Dessine une plante, origine au pied, y vers le bas. `size` = hauteur cible.
export function drawFlora(ctx, plant, t, size) {
  const info = DEGREE_INFO[plant.degree];
  const stage = visualStage(plant);
  const color = plant.wilted ? '#8a7d6a' : info.color;
  const glow = plant.wilted ? '#a2947f' : info.glow;

  // Croissance continue à l'intérieur du stade, pour ne pas « sauter ».
  const within = stage === 0 ? plant.growth / 0.18
    : stage === 1 ? (plant.growth - 0.18) / 0.37
    : stage === 2 ? (plant.growth - 0.55) / 0.45 : 1;
  const pop = plant.pop > 0 ? 1 + Math.sin(plant.pop * Math.PI) * 0.16 : 1;

  ctx.save();
  if (plant.wilted) {
    ctx.globalAlpha = 0.5;
    ctx.rotate(0.5 + plant.lean);
    ctx.filter = 'saturate(0.2)';
  }
  const gentle = Math.sin(t * 1.3 + plant.phase) * 0.03;
  ctx.rotate(plant.lean * 0.25 + gentle);

  groundShadow(ctx, size * (stage === 0 ? 0.18 : 0.26 + within * 0.08) * plant.scale);

  if (stage === 0) {
    seedMound(ctx, size * 0.28 * pop, color, t, plant.phase);
  } else if (stage === 1) {
    sprout(ctx, size * (0.3 + within * 0.22) * plant.scale * pop, plant.lean, t, plant.phase, color);
  } else {
    const h = size * (stage === 2 ? 0.62 + within * 0.16 : 0.84) * plant.scale * pop;
    ctx.scale(1, 1);
    DRAWERS[plant.degree](ctx, plant, h, stage, t, color, glow);
  }

  // Flétrissure proche : un voile de cendre gagne la plante.
  if (plant.ripe && !plant.wilted) {
    const left = 1 - clamp(plant.ripeAge / plant.sp.wilt, 0, 1);
    if (left < 0.3) {
      ctx.globalAlpha = (0.3 - left) * 1.8;
      ctx.fillStyle = '#6f6a63';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.45, size * 0.38, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Vignette isolée (boutique, sélecteur de graines) : une plante mûre figée.
export function drawFloraIcon(ctx, degree, size, t = 0) {
  const fake = {
    degree, growth: 1, ripe: true, wilted: false, ripeAge: 0, pop: 0,
    lean: 0.05, phase: 0, leaves: 4, scale: 1, sp: { wilt: 100 },
  };
  drawFlora(ctx, fake, t, size);
}
