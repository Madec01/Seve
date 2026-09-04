// Tutoriel guidé. À chaque étape le jeu se met en pause, une carte explique
// quoi faire et pourquoi, puis un objectif chiffré s'affiche jusqu'à sa
// réussite. Tant qu'il dure, ni la Cendre ni le chrono n'avancent.

import { on } from '../core/events.js';

export const STEPS = [
  {
    id: 'bouger', title: 'Bouger',
    illus: null,
    explain: [
      'Bienvenue dans la Clairière. Ici, on plante des notes.',
      'Déplace-toi avec <b>ZQSD</b>, <b>WASD</b> ou les <b>flèches</b>. Sur téléphone, glisse ton doigt sur la moitié gauche de l’écran.',
      'La case sous tes pieds est toujours celle sur laquelle tu agis : le cadre clair te la montre.',
    ],
    objective: 'Marche un peu dans le champ',
    target: 1, progress: (t) => Math.min(1, Math.floor(t.moved / 220)),
  },
  {
    id: 'semer', title: 'Semer',
    illus: 'plantes',
    explain: [
      'En bas de l’écran, tes <b>graines</b>. Chacune porte un degré de gamme : I, II ou III pour l’instant. Choisis-en une avec les touches <b>1, 2, 3</b> ou en la touchant.',
      'Place-toi sur une case de terre libre et appuie sur <b>Espace</b> (ou <b>Agir</b>, ou clic gauche) pour semer.',
      'Sème une <b>Ancrine (1)</b> et une <b>Clairine (3)</b> <b>côte à côte</b> : tu en auras besoin dans un instant.',
    ],
    objective: 'Sème deux graines',
    target: 2, progress: (t) => t.sown,
  },
  {
    id: 'accorder', title: 'Faire pousser',
    illus: 'semer',
    explain: [
      'Les plantes poussent seules, lentement. <b>Accorder</b> (<b>E</b>, clic droit, ou le bouton vert) envoie une onde qui les fait pousser d’un coup autour de toi.',
      'Une plante du <b>même degré</b> que ta graine sélectionnée réagit deux fois plus fort.',
      'Tiens-toi près de tes semis et accorde plusieurs fois, jusqu’à ce qu’elles <b>brillent</b> : c’est le signe qu’elles sont mûres.',
    ],
    objective: 'Accorde trois fois',
    target: 3, progress: (t) => t.tuned,
  },
  {
    id: 'accord', title: 'Former un accord',
    illus: 'accord',
    explain: [
      'Deux plantes <b>mûres</b> et <b>voisines</b> de degrés différents forment un <b>accord</b>. Ancrine (I) + Clairine (III) = une <b>Tierce</b>.',
      'Place-toi sur l’une des deux et appuie sur <b>Agir</b> : <b>les deux</b> sont récoltées ensemble, la sève est multipliée, et une onde part du champ.',
      'C’est tout le jeu : composer des groupes de plantes mûres qui sonnent bien ensemble, puis les récolter d’un seul geste.',
    ],
    objective: 'Récolte un accord',
    target: 1, progress: (t) => t.chords,
    onEnter(run) {
      // Si le joueur n'a pas semé I et III côte à côte, on l'aide discrètement.
      const f = run.field;
      const ripe = f.tiles.filter((x) => x.plant && !x.plant.wilted);
      for (const x of ripe) { x.plant.growth = 1; x.plant.ripe = true; x.plant.pop = 1; }
      const hasI = ripe.some((x) => x.plant.degree === 'I');
      const hasIII = ripe.some((x) => x.plant.degree === 'III');
      if (!(hasI && hasIII) || !hasNeighbourPair(f, ripe)) {
        const c = run.player.col, r = run.player.row;
        for (const [dc, deg] of [[-1, 'I'], [0, 'III']]) {
          const t = f.at(c + dc, r + 1) || f.at(c + dc, r - 1) || f.at(c + dc, r);
          if (!t) continue;
          t.terrain = 'soil'; t.blight = 0; t.plant = null;
          const p = f.sow(t, deg);
          if (p) { p.growth = 1; p.ripe = true; p.pop = 1; }
        }
      }
    },
  },
  {
    id: 'juste', title: 'Jouer en rythme',
    illus: 'justesse',
    explain: [
      'Tu entends le petit <b>tic</b> ? C’est le Pouls du biome. L’<b>anneau</b> autour de toi se resserre à chaque pulsation.',
      'Agis (semer, accorder, récolter…) pile quand l’anneau rejoint le cercle : c’est <b>Juste</b>. « JUSTE » s’affiche, et ta <b>chaîne</b> monte : ×1,5, ×2, ×3, ×4.',
      'La chaîne multiplie la sève et accélère toute la pousse. Rater n’enlève rien : le rythme récompense, il ne punit pas.',
    ],
    objective: 'Réussis trois actions Justes',
    target: 3, progress: (t) => t.just,
  },
  {
    id: 'purifier', title: 'La Cendre',
    illus: 'cendre',
    explain: [
      'Le gris qui vient d’apparaître, c’est la <b>Cendre</b>. Elle sort des fissures et avance à chaque pulsation. Elle interdit les semis et tue les plantes.',
      'Marche sur une case grise et appuie sur <b>Agir</b> pour la purifier. <b>Accorder</b> la repousse aussi, et les ondes des accords bien plus vite.',
      'La jauge « Cendre » en haut à gauche te dit où tu en es. Au-delà de 65 %, le Cycle est perdu.',
    ],
    objective: 'Purifie une case',
    target: 1, progress: (t) => Math.min(1, Math.floor(t.purified / 0.5)),
    onEnter(run) {
      const f = run.field;
      for (const t of f.tilesInRadius(run.player.col, run.player.row, 1.6)) {
        if (!t.plant && t.terrain === 'soil') f.paintBlight(t, 0.7);
      }
    },
  },
  {
    id: 'souffle', title: 'Le Souffle',
    illus: null,
    explain: [
      '<b>Maj droit</b> ou <b>C</b> (bouton Souffle) : une esquive rapide dans la direction où tu vas. Elle disperse la Cendre fraîche sur ton passage.',
      'Pratique pour traverser le champ vite quand une plante brille à l’autre bout.',
    ],
    objective: 'Utilise le Souffle',
    target: 1, progress: (t) => t.dashed,
  },
  {
    id: 'fin', title: 'À toi de jouer',
    illus: null,
    explain: [
      'Tu sais tout. Voici ce qui se passe maintenant :',
      'Chaque <b>saison</b> te demande un objectif de <b>sève</b> — la barre dorée en haut. La barre claire sous le nom du biome est le temps qu’il reste.',
      'La Cendre va se mettre à avancer pour de bon. Repousse-la, compose des accords, joue en rythme. Le guide <b>?</b> en haut à droite reste disponible à tout moment.',
    ],
    objective: null,
    target: 0, progress: () => 0,
  },
];

function hasNeighbourPair(field, tiles) {
  for (const t of tiles) {
    for (const n of field.neighbors(t.c, t.r)) {
      if (n.plant && n.plant.ripe && n.plant.degree !== t.plant.degree) return true;
    }
  }
  return false;
}

export class Tutorial {
  constructor(run) {
    this.run = run;
    this.index = 0;
    this.done = false;
    this.awaitingCard = true;     // la carte de l'étape courante n'a pas encore été lue
    this.t = { moved: 0, sown: 0, tuned: 0, harvested: 0, just: 0, chords: 0, purified: 0, dashed: 0 };
    this.lastX = run.player.x;
    this.lastY = run.player.y;
    this.disposers = [
      on('field:sow', () => { this.t.sown++; }),
      on('run:just', () => { this.t.just++; }),
      on('run:chord', () => { this.t.chords++; }),
      on('player:dash', () => { this.t.dashed++; }),
      on('resonance:harvest', (r) => { this.t.harvested += r.count; }),
      on('field:purify', (p) => { this.t.purified += p.amount; }),
    ];
    this.tunedWatcher = 0;
    run.tutorialMode = true;
  }

  dispose() { for (const d of this.disposers) d(); this.disposers = []; if (this.run) this.run.tutorialMode = false; }

  current() { return this.done ? null : STEPS[this.index]; }

  // Appelé quand le joueur ferme la carte de l'étape.
  cardRead() {
    this.awaitingCard = false;
    const step = this.current();
    if (step && step.onEnter) step.onEnter(this.run);
    if (step && !step.objective) this.finish();
  }

  progressText() {
    const step = this.current();
    if (!step || !step.objective) return '';
    const p = Math.min(step.target, step.progress(this.t));
    return `${step.objective} — ${p}/${step.target}`;
  }

  // Renvoie true quand une étape vient d'être validée (l'app affiche alors la suivante).
  update(dt) {
    if (this.done || this.awaitingCard) return false;
    const p = this.run.player;
    this.t.moved += Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x; this.lastY = p.y;
    if (p.tuneAnim > 0.98) this.tunedWatcher = 1;
    if (this.tunedWatcher && p.tuneAnim < 0.5) { this.t.tuned++; this.tunedWatcher = 0; }

    const step = STEPS[this.index];
    if (step && step.objective && step.progress(this.t) >= step.target) {
      this.index++;
      this.awaitingCard = true;
      if (this.index >= STEPS.length) this.finish();
      return true;
    }
    return false;
  }

  finish() {
    this.done = true;
    this.dispose();
  }
}
