// Tutoriel interactif. Il n'explique rien qu'on ne puisse faire immédiatement,
// et Pépin commente chaque réussite.

import { on } from '../core/events.js';

export const STEPS = [
  {
    id: 'bouger', title: 'Marche',
    hint: 'ZQSD, flèches — ou le joystick à gauche de l’écran.',
    check: (t) => t.moved > 220,
  },
  {
    id: 'semer', title: 'Sème',
    hint: 'Place-toi sur une case de terre et appuie sur Espace (ou le bouton Agir).',
    check: (t) => t.sown >= 1,
    bark: 'UNE GRAINE ! Tu as mis une graine dans la terre !',
  },
  {
    id: 'accorder', title: 'Accorde',
    hint: 'E (ou le bouton Accorder) envoie une onde qui fait pousser autour de toi.',
    check: (t) => t.tuned >= 2,
    bark: 'Elles t’écoutent ! Tu as vu ? Elles t’écoutent !',
  },
  {
    id: 'recolter', title: 'Récolte',
    hint: 'Quand une plante brille, reviens dessus et appuie sur Agir.',
    check: (t) => t.harvested >= 1,
    bark: 'De la sève ! De la VRAIE sève !',
  },
  {
    id: 'juste', title: 'Joue sur le temps',
    hint: 'L’anneau se resserre à chaque pulsation. Agis pile quand il touche le cercle : c’est Juste.',
    check: (t) => t.just >= 3,
    bark: 'Tu es en rythme ! Ça multiplie tout !',
  },
  {
    id: 'accord', title: 'Compose un accord',
    hint: 'Deux plantes mûres côte à côte de degrés différents forment un accord. Récolte-en une : tout part ensemble.',
    check: (t) => t.chords >= 1,
    bark: 'C’ÉTAIT ÇA ! C’était ça un accord ! Je l’ai entendu jusque dans mes racines !',
  },
  {
    id: 'purifier', title: 'Repousse la Cendre',
    hint: 'Marche sur une case grise et appuie sur Agir. Les accords la repoussent bien plus vite.',
    check: (t) => t.purified > 0.6,
    bark: 'Le gris recule. Il recule !',
  },
  {
    id: 'souffle', title: 'Souffle',
    hint: 'Maj droit ou C : une esquive rapide qui disperse la Cendre fraîche.',
    check: (t) => t.dashed >= 1,
    bark: 'Voilà. Tu sais tout. Le reste, c’est de l’oreille.',
  },
];

export class Tutorial {
  constructor(run, onStep) {
    this.run = run;
    this.index = 0;
    this.done = false;
    this.onStep = onStep || (() => {});
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
  }

  dispose() { for (const d of this.disposers) d(); this.disposers = []; }

  current() { return this.done ? null : STEPS[this.index]; }

  update(dt) {
    if (this.done) return;
    const p = this.run.player;
    this.t.moved += Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x; this.lastY = p.y;
    if (p.tuneAnim > 0.98) this.tunedWatcher = 1;
    if (this.tunedWatcher && p.tuneAnim < 0.5) { this.t.tuned++; this.tunedWatcher = 0; }

    const step = STEPS[this.index];
    if (step && step.check(this.t)) {
      this.onStep(step, this.index);
      this.index++;
      if (this.index >= STEPS.length) { this.done = true; this.dispose(); }
    }
  }
}
