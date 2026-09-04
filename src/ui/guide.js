// Le guide « Comment jouer » : six pages illustrées, accessibles depuis le
// menu, la pause et le bouton ? en jeu. Les illustrations sont dessinées en
// direct avec les mêmes fonctions que le jeu : ce que tu vois ici est ce que
// tu verras dans le champ.

import { el, button, clear } from './dom.js';
import { waveTitle } from './text.js';
import { drawFloraIcon } from './flora.js';
import { DEGREE_INFO, CHORDS } from '../game/scales.js';
import { SPECIES } from '../game/plants.js';
import { wood } from '../audio/synth.js';

const TILE_COLOR = '#6b5138';

function tile(ctx, x, y, s, opts = {}) {
  ctx.fillStyle = opts.blight ? '#6f6a63' : TILE_COLOR;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.16);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,246,224,0.12)';
  ctx.fillRect(x + 3, y + 3, s - 6, s * 0.2);
  if (opts.blight) {
    ctx.fillStyle = '#3a3833';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x + 8 + ((i * 37) % (s - 16)), y + 8 + ((i * 53) % (s - 16)), 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function label(ctx, text, x, y, size = 13, color = '#f3e7cf', align = 'center') {
  ctx.font = `700 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function player(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.42, s * 0.3, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b3026';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.4); ctx.quadraticCurveTo(x + s * 0.32, y, x + s * 0.26, y + s * 0.36);
  ctx.quadraticCurveTo(x, y + s * 0.46, x - s * 0.26, y + s * 0.36); ctx.quadraticCurveTo(x - s * 0.32, y, x, y - s * 0.4);
  ctx.fill();
  ctx.fillStyle = '#f0a24a';
  ctx.beginPath(); ctx.moveTo(x - s * 0.22, y - s * 0.1); ctx.quadraticCurveTo(x, y, x + s * 0.22, y - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.1, x - s * 0.12, y + s * 0.08); ctx.fill();
  ctx.fillStyle = '#e8d5b5';
  ctx.beginPath(); ctx.arc(x, y - s * 0.48, s * 0.19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b7f4a';
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.62, s * 0.3, s * 0.11, 0, 0, Math.PI * 2); ctx.fill();
}

// --- Illustrations ------------------------------------------------------------

const ILLUS = {
  // Les cinq espèces, chacune avec son numéro et son degré.
  plantes(ctx, w, h, t) {
    const keys = ['I', 'II', 'III', 'V', 'VI'];
    const s = Math.min(72, w / 5.6);
    keys.forEach((k, i) => {
      const x = w / 2 + (i - 2) * s * 1.1;
      const y = h * 0.5;
      tile(ctx, x - s / 2, y - s / 2, s);
      ctx.save(); ctx.translate(x, y + s * 0.34); drawFloraIcon(ctx, k, s * 0.8, t); ctx.restore();
      label(ctx, `${i + 1}`, x - s / 2 + 9, y - s / 2 + 15, 12, 'rgba(255,255,255,0.6)');
      label(ctx, SPECIES[k].name, x, y + s * 0.78, 12, DEGREE_INFO[k].color);
      label(ctx, `${k} · ${DEGREE_INFO[k].name}`, x, y + s * 0.78 + 15, 11, '#b9ac93');
    });
  },

  // Semer puis récolter : le personnage sur une case, la flèche vers la plante mûre.
  semer(ctx, w, h, t) {
    const s = Math.min(76, h * 0.42);
    const y = h * 0.48;
    const xs = [w * 0.2, w * 0.5, w * 0.8];
    tile(ctx, xs[0] - s / 2, y - s / 2, s);
    player(ctx, xs[0], y + s * 0.05, s * 0.9);
    label(ctx, 'Agir : semer', xs[0], y + s * 0.85, 12);

    tile(ctx, xs[1] - s / 2, y - s / 2, s);
    ctx.save(); ctx.translate(xs[1], y + s * 0.34);
    drawFloraIcon(ctx, 'I', s * 0.5, t);
    ctx.restore();
    label(ctx, 'Accorder : ça pousse', xs[1], y + s * 0.85, 12);

    tile(ctx, xs[2] - s / 2, y - s / 2, s);
    ctx.save(); ctx.translate(xs[2], y + s * 0.34); drawFloraIcon(ctx, 'I', s * 0.82, t); ctx.restore();
    const pulse = 0.5 + Math.sin(t * 3) * 0.5;
    ctx.globalAlpha = 0.25 + pulse * 0.2; ctx.fillStyle = '#ffd79a';
    ctx.beginPath(); ctx.arc(xs[2], y - s * 0.1, s * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    label(ctx, 'Elle brille : Agir = récolte', xs[2], y + s * 0.85, 12, '#ffd79a');

    ctx.strokeStyle = 'rgba(243,231,207,0.5)'; ctx.lineWidth = 2;
    for (const [a, b] of [[xs[0], xs[1]], [xs[1], xs[2]]]) {
      ctx.beginPath(); ctx.moveTo(a + s * 0.58, y); ctx.lineTo(b - s * 0.6, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b - s * 0.6, y); ctx.lineTo(b - s * 0.7, y - 5); ctx.lineTo(b - s * 0.7, y + 5); ctx.closePath();
      ctx.fillStyle = 'rgba(243,231,207,0.5)'; ctx.fill();
    }
  },

  // Trois plantes mûres côte à côte = un accord ; l'onde qui en sort.
  accord(ctx, w, h, t) {
    const s = Math.min(70, h * 0.4);
    const y = h * 0.42;
    const chord = CHORDS.find((c) => c.id === 'majeur');
    const cx = w / 2;
    // Onde.
    const k = (t * 0.5) % 1;
    ctx.globalAlpha = (1 - k) * 0.6; ctx.strokeStyle = chord.color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, y, s * 0.6 + k * s * 2.4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    chord.need.forEach((d, i) => {
      const x = cx + (i - 1) * s * 1.06;
      tile(ctx, x - s / 2, y - s / 2, s);
      ctx.save(); ctx.translate(x, y + s * 0.34); drawFloraIcon(ctx, d, s * 0.8, t); ctx.restore();
      label(ctx, d, x, y - s / 2 - 6, 13, DEGREE_INFO[d].color);
    });
    // Accolade.
    ctx.strokeStyle = chord.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - s * 1.55, y + s * 0.62); ctx.lineTo(cx - s * 1.55, y + s * 0.72);
    ctx.lineTo(cx + s * 1.55, y + s * 0.72); ctx.lineTo(cx + s * 1.55, y + s * 0.62); ctx.stroke();
    label(ctx, `${chord.name} · sève ×${chord.mult}`, cx, y + s * 0.95, 14, chord.color);
    label(ctx, 'Récolte une seule plante : les trois partent ensemble', cx, y + s * 0.95 + 17, 11, '#b9ac93');
  },

  // L'anneau qui se contracte : trois instants, le bon est le dernier.
  justesse(ctx, w, h, t) {
    const s = Math.min(64, h * 0.36);
    const y = h * 0.46;
    const phases = [0.15, 0.55, 0.97];
    const labels = ['trop tôt', 'pas encore', 'JUSTE !'];
    phases.forEach((ph, i) => {
      const x = w * (0.2 + i * 0.3);
      player(ctx, x, y, s * 0.9);
      ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = i === 2 ? 0.95 : 0.45; ctx.lineWidth = i === 2 ? 4 : 2.4;
      ctx.strokeStyle = i === 2 ? '#ffe9b0' : '#dfe8d8';
      ctx.beginPath(); ctx.arc(x, y, s * 0.55 + (1 - ph) * s * 1.1, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      label(ctx, labels[i], x, y + s * 1.05, 13, i === 2 ? '#ffe9b0' : '#b9ac93');
    });
    label(ctx, 'L’anneau extérieur rejoint le cercle à chaque pulsation', w / 2, h * 0.92, 11, '#b9ac93');
  },

  // La Cendre qui gagne, et l'onde qui la repousse.
  cendre(ctx, w, h, t) {
    const s = Math.min(58, h * 0.3);
    const y = h * 0.42;
    const cols = 5;
    const x0 = w / 2 - (cols / 2) * s * 1.05;
    const spread = (Math.sin(t * 0.8) + 1) / 2;
    for (let i = 0; i < cols; i++) {
      const bl = i < 1 + spread * 2.4;
      tile(ctx, x0 + i * s * 1.05, y - s / 2, s, { blight: bl });
    }
    ctx.fillStyle = '#e0785e';
    ctx.beginPath(); ctx.arc(x0 + s / 2, y, 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'fissure', x0 + s / 2, y - s / 2 - 6, 11, '#e0785e');
    player(ctx, x0 + 4.5 * s * 1.05, y + 2, s * 0.85);
    label(ctx, 'Elle avance au rythme du Pouls. Purifie, accorde, forme des accords.', w / 2, y + s * 0.95, 12);
    label(ctx, 'À 65 % du champ recouvert, le Cycle est perdu.', w / 2, y + s * 0.95 + 17, 11, '#e0785e');
  },
};

// --- Pages ---------------------------------------------------------------------

export const PAGES = [
  {
    title: 'Le but du jeu',
    illus: 'plantes',
    text: [
      'Tu plantes des <b>notes</b>. Chaque graine porte un degré de gamme : I, II, III, V ou VI. Chaque numéro du clavier (1 à 5) choisit une graine.',
      'Tu dois récolter assez de <b>sève</b> avant la fin de chaque <b>saison</b> — la barre dorée en haut de l’écran. Un Cycle dure trois saisons.',
      'Pendant ce temps, la <b>Cendre</b> grise avance sur le champ. Si elle recouvre trop de cases, tu perds.',
    ],
  },
  {
    title: 'Semer, faire pousser, récolter',
    illus: 'semer',
    text: [
      'Place-toi sur une case de terre : la case sous tes pieds est <b>toujours</b> celle que tu vises. Appuie sur <b>Agir</b> (Espace ou clic) pour semer la graine sélectionnée.',
      '<b>Accorder</b> (E ou clic droit) envoie une onde qui fait pousser toutes les plantes autour de toi. Une plante du même degré que ta graine sélectionnée pousse deux fois plus.',
      'Quand une plante <b>brille</b>, elle est mûre. Reviens dessus et appuie sur Agir pour la récolter. Attends trop longtemps et elle fane.',
    ],
  },
  {
    title: 'Les accords — le cœur du jeu',
    illus: 'accord',
    text: [
      'Des plantes <b>mûres</b> placées <b>côte à côte</b> (pas en diagonale) forment un groupe. Si les degrés du groupe composent un accord, la récolte est multipliée.',
      'Récolter <b>une seule</b> plante du groupe récolte <b>tout le groupe</b> d’un coup, joue l’accord, et libère une onde qui repousse la Cendre.',
      '<b>Tierce</b> = I + III (×1,5). <b>Quinte</b> = I + V (×1,6). <b>Majeur</b> = I + III + V (×2,6). <b>Mineur</b> = VI + I + III (×2,8). Les cinq degrés ensemble : <b>Pentatonique</b>, ×5 et tout le champ purifié.',
    ],
  },
  {
    title: 'La Justesse — jouer en rythme',
    illus: 'justesse',
    text: [
      'Chaque biome a un <b>Pouls</b> : tu l’entends (petit tic de bois) et tu le vois (l’anneau qui se resserre autour de toi).',
      'Agis pile quand l’anneau extérieur rejoint le cercle : c’est <b>Juste</b>. Chaque Juste augmente ta <b>chaîne</b> (×1 → ×1,5 → ×2 → ×3 → ×4).',
      'La chaîne multiplie la sève <b>et</b> accélère la pousse de tout le champ. Trois pulsations sans Juste, et elle retombe. Tu peux ignorer le rythme au début : il ne punit pas, il récompense.',
    ],
  },
  {
    title: 'La Cendre',
    illus: 'cendre',
    text: [
      'Elle naît des <b>fissures</b> (points rouges) et gagne les cases voisines à chaque pulsation. Une case grise ne peut pas être semée et tue lentement sa plante.',
      'Pour la repousser : marcher dessus et <b>Agir</b> (lent), <b>Accorder</b> dessus, le <b>Souffle</b> (Maj droit ou C, une esquive rapide), la Clairine (III), et surtout les <b>ondes des accords</b>.',
      'La jauge « Cendre » en haut à gauche indique le danger. Au-delà de 65 %, le Cycle s’achève.',
    ],
  },
  {
    title: 'Lire l’écran',
    illus: null,
    hud: true,
    text: [
      '<b>Barre dorée</b> (haut, centre) : sève récoltée cette saison / objectif. <b>Barre claire</b> (sous le nom du biome) : temps restant de la saison.',
      '<b>❍ nombre</b> : ta sève totale. <b>×2</b> : ta chaîne de Justesse. <b>Cendre %</b> : la jauge de danger.',
      'Sous le champ : ce que fera <b>Agir</b> sur la case où tu es (« Semer I », « Récolter · Tierce », « Purifier »…) et, si tu es sur une plante mûre, l’accord qu’il te manque.',
      'Entre les Cycles, dépense ta sève au <b>Verger</b> : nouvelles graines, biomes, améliorations permanentes.',
    ],
  },
];

export class Guide {
  constructor(root) {
    this.el = el('div', 'guide hidden');
    root.appendChild(this.el);
    this.page = 0;
    this.open = false;
    this.onClose = null;
    this.t = 0;
    this.canvas = null;
  }

  isOpen() { return this.open; }

  show(onClose, startPage = 0) {
    this.open = true;
    this.onClose = onClose || null;
    this.page = startPage;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
    clear(this.el);
    const cb = this.onClose; this.onClose = null;
    if (cb) cb();
  }

  go(delta) {
    this.page = Math.max(0, Math.min(PAGES.length - 1, this.page + delta));
    wood({ freq: 380, gain: 0.14, decay: 0.06 });
    this.render();
  }

  render() {
    clear(this.el);
    const p = PAGES[this.page];
    const card = el('div', 'guide-card');
    const h = el('h2', 'panel-title');
    waveTitle(h, p.title, { delay: 0.02, amplitude: 3 });
    card.appendChild(h);
    card.appendChild(el('div', 'guide-pager', `${this.page + 1} / ${PAGES.length}`));

    if (p.illus) {
      this.canvas = el('canvas', 'guide-illus');
      this.canvas.width = 720; this.canvas.height = 260;
      card.appendChild(this.canvas);
    } else {
      this.canvas = null;
    }
    if (p.hud) {
      const legend = el('div', 'guide-legend');
      legend.innerHTML = `
        <div><i class="lg-goal"></i>objectif de sève de la saison</div>
        <div><i class="lg-time"></i>temps restant de la saison</div>
        <div><i class="lg-ash"></i>jauge de Cendre</div>
        <div><i class="lg-ring"></i>anneau de Justesse</div>`;
      card.appendChild(legend);
    }
    const body = el('div', 'guide-text');
    for (const line of p.text) body.appendChild(el('p', '', line));
    card.appendChild(body);

    const nav = el('div', 'guide-nav');
    nav.appendChild(button('← Précédent', () => this.go(-1), 'btn ghost' + (this.page === 0 ? ' disabled' : '')));
    const dots = el('div', 'guide-dots');
    PAGES.forEach((_, i) => {
      const d = button('', () => { this.page = i; this.render(); }, 'dot' + (i === this.page ? ' on' : ''));
      dots.appendChild(d);
    });
    nav.appendChild(dots);
    if (this.page < PAGES.length - 1) nav.appendChild(button('Suivant →', () => this.go(1), 'btn primary'));
    else nav.appendChild(button('J’ai compris', () => this.close(), 'btn primary'));
    card.appendChild(nav);
    card.appendChild(button('✕', () => this.close(), 'icon-btn guide-close'));
    this.el.appendChild(card);
    requestAnimationFrame(() => card.classList.add('in'));
  }

  update(dt) {
    if (!this.open) return;
    this.t += dt;
    if (!this.canvas) return;
    const p = PAGES[this.page];
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textBaseline = 'alphabetic';
    ILLUS[p.illus](ctx, this.canvas.width, this.canvas.height, this.t);
  }
}

// Une illustration seule, pour les cartes du tutoriel.
export function drawIllustration(canvas, name, t) {
  if (!ILLUS[name]) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ILLUS[name](ctx, canvas.width, canvas.height, t);
}
