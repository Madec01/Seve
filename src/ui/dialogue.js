// Boîte de dialogue : portrait animé, machine à écrire, voix de charabia.
// C'est le seul endroit du jeu où le temps s'arrête vraiment.

import { Typewriter } from './text.js';
import { drawNpcPortrait } from './portraits.js';
import { NPCS } from '../game/npcs.js';
import { speakChar, voiceSpeed } from '../audio/voice.js';
import { wood } from '../audio/synth.js';
import { emit } from '../core/events.js';

export class Dialogue {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'dialogue hidden';
    this.el.innerHTML = `
      <canvas class="portrait" width="180" height="180" aria-hidden="true"></canvas>
      <div class="bubble">
        <div class="dname"></div>
        <p class="dline" aria-live="polite"></p>
        <div class="dnext">▾</div>
      </div>`;
    root.appendChild(this.el);

    this.canvas = this.el.querySelector('.portrait');
    this.pctx = this.canvas.getContext('2d');
    this.nameEl = this.el.querySelector('.dname');
    this.lineEl = this.el.querySelector('.dline');
    this.nextEl = this.el.querySelector('.dnext');

    this.npcId = null;
    this.lines = [];
    this.index = 0;
    this.open = false;
    this.t = 0;
    this.talking = 0;
    this.onDone = null;
    this.tw = new Typewriter(this.lineEl, {
      onChar: (ch, i) => {
        speakChar(this.npcId, ch, i);
        this.talking = 1;
      },
      onDone: () => { this.nextEl.classList.add('ready'); },
    });

    this.el.addEventListener('click', () => this.advance());
  }

  isOpen() { return this.open; }

  show(npcId, lines, onDone) {
    this.npcId = npcId;
    this.lines = Array.isArray(lines) ? lines : [lines];
    this.index = 0;
    this.onDone = onDone || null;
    this.open = true;
    this.el.classList.remove('hidden');
    this.el.classList.add('opening');
    const npc = NPCS[npcId];
    this.nameEl.textContent = npc ? npc.name : '';
    this.el.style.setProperty('--npc-color', npc ? npc.color : '#f3e7cf');
    this.tw.speed = voiceSpeed(npcId) * 2.4;
    this.playCurrent();
    emit('dialogue:open', { npcId });
    setTimeout(() => this.el.classList.remove('opening'), 320);
  }

  playCurrent() {
    this.nextEl.classList.remove('ready');
    this.tw.play(this.lines[this.index] || '');
  }

  advance() {
    if (!this.open) return;
    if (this.tw.skip()) { wood({ freq: 380, gain: 0.12, decay: 0.05 }); return; }
    this.index++;
    wood({ freq: 300, gain: 0.14, decay: 0.06 });
    if (this.index >= this.lines.length) { this.close(); return; }
    this.playCurrent();
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
    emit('dialogue:close', { npcId: this.npcId });
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }

  update(dt) {
    this.t += dt;
    this.talking = Math.max(0, this.talking - dt * 6);
    if (!this.open) return;
    this.tw.update(dt);
    drawNpcPortrait(this.pctx, this.npcId, this.t, this.talking);
  }
}

// Bandeau de notification (succès, évènements, échos) : discret, animé, empilable.
export class Toasts {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'toasts';
    root.appendChild(this.el);
  }

  push(title, subtitle = '', color = '#f6c453', duration = 3.6) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.style.setProperty('--toast-color', color);
    item.innerHTML = `<strong></strong><span></span>`;
    item.querySelector('strong').textContent = title;
    item.querySelector('span').textContent = subtitle;
    this.el.appendChild(item);
    requestAnimationFrame(() => item.classList.add('in'));
    setTimeout(() => {
      item.classList.remove('in');
      setTimeout(() => item.remove(), 400);
    }, duration * 1000);
    while (this.el.children.length > 4) this.el.firstChild.remove();
  }
}
