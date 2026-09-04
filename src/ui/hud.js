// Interface de jeu. En DOM (net sur tous les écrans, accessible au clavier),
// le canvas gardant les éléments qui doivent vivre dans le monde.

import { DEGREE_INFO } from '../game/scales.js';
import { SPECIES } from '../game/plants.js';
import { BLIGHT } from '../game/constants.js';
import { Input } from '../core/input.js';
import { pulse, formatSap } from './text.js';
import { drawFloraIcon } from './flora.js';

const TOUCH_BUTTONS = [
  { action: 'act', label: 'Agir', key: 'Espace' },
  { action: 'tune', label: 'Accorder', key: 'E' },
  { action: 'dash', label: 'Souffle', key: 'Maj' },
];

export class Hud {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'hud hidden';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <div class="biome-name"></div>
          <div class="season-line">
            <span class="season-label"></span>
            <div class="beat-bar"><i></i></div>
          </div>
        </div>
        <div class="hud-center">
          <div class="goal">
            <div class="goal-bar"><i></i><b></b></div>
            <div class="goal-text"></div>
          </div>
        </div>
        <div class="hud-right">
          <div class="sap-box"><span class="sap-icon">❍</span><span class="sap-value">0</span></div>
          <div class="chain-box"><span class="chain-mult">×1</span><span class="chain-count"></span></div>
          <button class="icon-btn pause-btn" title="Pause (Échap)" aria-label="Pause">‖</button>
        </div>
      </div>

      <div class="blight-gauge" title="Cendre">
        <i></i><span></span>
      </div>

      <div class="event-banner hidden"><strong></strong><span></span></div>

      <div class="context-hint"><span class="ctx-label"></span><span class="ctx-chord"></span></div>

      <div class="seed-bar" role="listbox" aria-label="Graines"></div>

      <div class="touch-controls hidden">
        <div class="touch-buttons"></div>
      </div>`;
    root.appendChild(this.el);

    this.biomeName = this.el.querySelector('.biome-name');
    this.seasonLabel = this.el.querySelector('.season-label');
    this.beatBar = this.el.querySelector('.beat-bar i');
    this.goalBar = this.el.querySelector('.goal-bar i');
    this.goalGhost = this.el.querySelector('.goal-bar b');
    this.goalText = this.el.querySelector('.goal-text');
    this.sapValue = this.el.querySelector('.sap-value');
    this.chainMult = this.el.querySelector('.chain-mult');
    this.chainCount = this.el.querySelector('.chain-count');
    this.blightFill = this.el.querySelector('.blight-gauge i');
    this.blightText = this.el.querySelector('.blight-gauge span');
    this.eventBanner = this.el.querySelector('.event-banner');
    this.ctxLabel = this.el.querySelector('.ctx-label');
    this.ctxChord = this.el.querySelector('.ctx-chord');
    this.seedBar = this.el.querySelector('.seed-bar');
    this.touchWrap = this.el.querySelector('.touch-controls');
    this.touchButtons = this.el.querySelector('.touch-buttons');
    this.pauseBtn = this.el.querySelector('.pause-btn');

    this.buildTouchButtons();
    this.lastSap = 0;
    this.lastMult = 1;
    this.seedEls = [];
  }

  buildTouchButtons() {
    for (const b of TOUCH_BUTTONS) {
      const btn = document.createElement('button');
      btn.className = `tbtn tbtn-${b.action}`;
      btn.innerHTML = `<span>${b.label}</span>`;
      const press = (e) => { e.preventDefault(); Input.pressVirtual(b.action); btn.classList.add('down'); };
      const release = (e) => { e.preventDefault(); Input.releaseVirtual(b.action); btn.classList.remove('down'); };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
      this.touchButtons.appendChild(btn);
    }
  }

  buildSeedBar(run) {
    this.seedBar.innerHTML = '';
    this.seedEls = [];
    run.availableSeeds.forEach((key, i) => {
      const info = DEGREE_INFO[key];
      const sp = SPECIES[key];
      const el = document.createElement('button');
      el.className = 'seed';
      el.style.setProperty('--seed-color', info.color);
      el.innerHTML = `
        <span class="seed-key">${i + 1}</span>
        <canvas class="seed-icon" width="56" height="56" aria-hidden="true"></canvas>
        <span class="seed-text"><span class="seed-name">${sp.name}</span>
        <span class="seed-deg">${key} · ${info.name}</span></span>`;
      const ic = el.querySelector('.seed-icon').getContext('2d');
      ic.translate(28, 50);
      drawFloraIcon(ic, key, 48);
      el.title = sp.desc;
      el.addEventListener('click', () => { run.seedIndex = i; });
      el.addEventListener('touchstart', (e) => { e.preventDefault(); run.seedIndex = i; }, { passive: false });
      this.seedBar.appendChild(el);
      this.seedEls.push(el);
    });
  }

  show(run) {
    this.el.classList.remove('hidden');
    this.buildSeedBar(run);
    this.biomeName.textContent = run.biome.name;
  }

  hide() { this.el.classList.add('hidden'); }

  setTouch(visible) {
    this.touchWrap.classList.toggle('hidden', !visible);
  }

  showEvent(ev) {
    this.eventBanner.classList.remove('hidden');
    this.eventBanner.style.setProperty('--ev-color', ev.color);
    this.eventBanner.querySelector('strong').textContent = ev.name;
    this.eventBanner.querySelector('span').textContent = ev.line;
    pulse(this.eventBanner, 'flash');
  }

  hideEvent() { this.eventBanner.classList.add('hidden'); }

  update(run) {
    if (!run) return;
    this.seasonLabel.textContent = `Saison ${run.season + 1}/3`;
    this.beatBar.style.transform = `scaleX(${1 - run.seasonRatio()})`;

    const ratio = run.progressRatio();
    this.goalBar.style.transform = `scaleX(${ratio})`;
    this.goalGhost.style.transform = `scaleX(${Math.min(1, ratio + 0.02)})`;
    this.goalText.textContent = `${formatSap(run.seasonSap)} / ${formatSap(run.goal)} sève`;
    this.goalBar.parentElement.classList.toggle('full', ratio >= 1);

    if (run.sap !== this.lastSap) {
      this.sapValue.textContent = formatSap(run.sap);
      pulse(this.sapValue, 'bump');
      this.lastSap = run.sap;
    }

    this.chainMult.textContent = `×${run.chainMult % 1 === 0 ? run.chainMult : run.chainMult.toFixed(1)}`;
    this.chainCount.textContent = run.chain > 0 ? `${run.chain} justes` : '';
    this.el.querySelector('.chain-box').classList.toggle('hot', run.chainMult >= 2);
    if (run.chainMult !== this.lastMult) {
      pulse(this.chainMult, 'bump');
      this.lastMult = run.chainMult;
    }

    const blight = run.field.blightRatio() / BLIGHT.loseThreshold;
    this.blightFill.style.transform = `scaleX(${Math.min(1, blight)})`;
    this.blightText.textContent = `Cendre ${Math.round(Math.min(1, blight) * 100)}%`;
    this.el.querySelector('.blight-gauge').classList.toggle('danger', blight > 0.7);

    this.ctxLabel.textContent = run.contextLabel();
    const preview = run.preview();
    if (preview && preview.chord) {
      this.ctxChord.textContent = `${preview.chord.name} · ≈${preview.estimate} sève`;
      this.ctxChord.style.color = preview.chord.color;
    } else if (preview && preview.hint) {
      const missing = preview.hint.missing.join(' + ');
      this.ctxChord.textContent = `il manque ${missing} pour ${preview.hint.chord.name}`;
      this.ctxChord.style.color = '#c9bfa8';
    } else {
      this.ctxChord.textContent = '';
    }

    this.seedEls.forEach((el, i) => el.classList.toggle('active', i === run.seedIndex % this.seedEls.length));
  }
}
