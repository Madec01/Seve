// Évènements aléatoires. Ils durent quelques pulsations et changent une règle :
// assez pour surprendre, jamais assez pour punir.

import { emit } from '../core/events.js';
import { TERRAIN } from './field.js';

export const EVENTS = [
  {
    id: 'pluie',
    name: 'Pluie de graines',
    line: 'Le ciel sème à ta place.',
    color: '#8fce6a', weight: 10, duration: 12,
    onStart(run) {
      const field = run.field;
      const spots = field.rng.shuffle(field.tiles.filter((t) => field.isSowable(t))).slice(0, 6);
      for (const t of spots) field.sow(t, field.rng.pick(run.availableSeeds));
    },
  },
  {
    id: 'lune',
    name: 'Nuit de lune',
    line: 'Tout pousse deux fois plus vite. Profites-en.',
    color: '#c3ccff', weight: 8, duration: 14,
    growthBonus: 2,
  },
  {
    id: 'vent',
    name: 'Vent de cendre',
    line: 'Elle avance. Tiens bon.',
    color: '#9a8f80', weight: 9, duration: 10,
    blightBonus: 2.1,
    onStart(run) {
      for (const t of run.field.tiles) {
        if (t.blight > 0.2) run.field.paintBlight(t, 0.12);
      }
    },
  },
  {
    id: 'silence',
    name: 'Silence',
    line: 'La musique s’éteint. Joue de mémoire.',
    color: '#e8dcc6', weight: 5, duration: 12,
    onStart(run) { run.score.silence(12); },
  },
  {
    id: 'maree',
    name: 'Marée vive',
    line: 'L’eau monte : tout est arrosé, tout est transposé.',
    color: '#4fc3b1', weight: 7, duration: 12,
    onStart(run) {
      for (const t of run.field.tiles) {
        if (t.terrain !== TERRAIN.VOID) t.moisture = 1;
      }
      run.transposeShift = 3;
    },
    onEnd(run) { run.transposeShift = 0; },
  },
  {
    id: 'bourdon',
    name: 'Passage du Bourdon',
    line: 'Il pose quelque chose et repart sans un mot.',
    color: '#f0a24a', weight: 6, duration: 8,
    onStart(run) { run.addSap(180, 'cadeau'); },
  },
  {
    id: 'accord_offert',
    name: 'Le Chant remonte',
    line: 'Une plante mûrit d’un coup, partout.',
    color: '#ffd79a', weight: 5, duration: 6,
    onStart(run) {
      let n = 0;
      for (const t of run.field.tiles) {
        if (t.plant && !t.plant.ripe && !t.plant.wilted && n < 6) {
          t.plant.growth = 1; t.plant.ripe = true; t.plant.pop = 1; n++;
        }
      }
    },
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export class EventDirector {
  constructor(run) {
    this.run = run;
    this.active = null;
    this.timer = 0;
    this.cooldown = 22;
  }

  update(dt) {
    if (this.active) {
      this.timer -= dt;
      if (this.timer <= 0) this.stop();
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = this.run.rng.range(26, 44);
      this.trigger();
    }
  }

  trigger(id) {
    const ev = id ? EVENT_BY_ID[id]
      : this.run.rng.pickWeighted(EVENTS.map((e) => ({ value: e, weight: e.weight })));
    if (!ev) return null;
    this.stop();
    this.active = ev;
    this.timer = ev.duration;
    if (ev.onStart) ev.onStart(this.run);
    emit('event:start', ev);
    return ev;
  }

  stop() {
    if (!this.active) return;
    if (this.active.onEnd) this.active.onEnd(this.run);
    emit('event:end', this.active);
    this.active = null;
    this.timer = 0;
  }

  growthBonus() { return this.active && this.active.growthBonus ? this.active.growthBonus : 1; }
  blightBonus() { return this.active && this.active.blightBonus ? this.active.blightBonus : 1; }
}
