// Écrans hors partie : titre, sauvegardes, réglages, succès, journal.
// Un seul conteneur, un écran à la fois, toujours avec une transition.

import { el, button, clear, slider, toggle, select, toggleFullscreen, isFullscreen } from './dom.js';
import { waveTitle, fadeIn, formatSap } from './text.js';
import { GAME_TITLE, GAME_SUBTITLE } from '../game/constants.js';
import { ACHIEVEMENTS, achievementProgress } from '../game/achievements.js';
import { ECHOES } from '../game/lore.js';
import { SLOT_COUNT } from '../core/storage.js';
import { todayChallenge } from '../game/challenges.js';
import { BIOMES } from '../game/biomes.js';
import { wood, pluck } from '../audio/synth.js';
import { degreeFreq } from '../game/scales.js';

export class Screens {
  constructor(root, app) {
    this.app = app;
    this.el = el('div', 'screens hidden');
    root.appendChild(this.el);
    this.current = null;
  }

  hide() { this.el.classList.add('hidden'); this.current = null; clear(this.el); }

  panel(titleText, subtitleText = '') {
    clear(this.el);
    this.el.classList.remove('hidden');
    const wrap = el('div', 'panel');
    if (titleText) {
      const h = el('h2', 'panel-title');
      waveTitle(h, titleText, { delay: 0.03, amplitude: 4 });
      wrap.appendChild(h);
    }
    if (subtitleText) wrap.appendChild(el('p', 'panel-sub', subtitleText));
    const body = el('div', 'panel-body');
    wrap.appendChild(body);
    this.el.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    return body;
  }

  note(parent, text, cls = 'note') { parent.appendChild(el('p', cls, text)); return parent; }

  // --- Titre ------------------------------------------------------------------

  title() {
    this.current = 'titre';
    clear(this.el);
    this.el.classList.remove('hidden');
    const wrap = el('div', 'title-screen');

    const logo = el('h1', 'game-title');
    waveTitle(logo, GAME_TITLE, { delay: 0.09, amplitude: 10 });
    wrap.appendChild(logo);
    wrap.appendChild(el('p', 'game-sub', GAME_SUBTITLE));

    const menu = el('nav', 'main-menu');
    const items = [
      ['Jouer', () => this.app.openSlots()],
      ['Défi du jour', () => this.app.startDaily()],
      ['Succès', () => this.achievements()],
      ['Journal', () => this.journal()],
      ['Réglages', () => this.settings()],
      ['Mode Test', () => this.app.openTestMode()],
    ];
    items.forEach(([label, fn], i) => {
      const b = button(label, () => { wood({ freq: 340, gain: 0.2, decay: 0.09 }); fn(); }, 'btn menu-btn');
      fadeIn(b, i);
      b.addEventListener('mouseenter', () => pluckDegree(i));
      menu.appendChild(b);
    });
    wrap.appendChild(menu);

    wrap.appendChild(el('p', 'credits-line',
      'Un jeu d’arcade de culture et de résonance · ZQSD/flèches pour bouger · Espace pour agir'));
    this.el.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
  }

  // --- Emplacements de sauvegarde ---------------------------------------------

  slots() {
    this.current = 'sauvegardes';
    const body = this.panel('Emplacements', 'Trois jardins, trois histoires.');
    const list = el('div', 'slot-list');
    for (let i = 0; i < SLOT_COUNT; i++) {
      const data = this.app.readSlot(i);
      const card = el('div', 'slot-card' + (data ? '' : ' empty'));
      if (data) {
        const prog = achievementProgress(data);
        card.innerHTML = `
          <div class="slot-n">Jardin ${i + 1}</div>
          <div class="slot-main">
            <span class="slot-biome">${BIOMES[data.biome] ? BIOMES[data.biome].short : '—'}</span>
            <span class="slot-sap">${formatSap(data.sap)} sève</span>
          </div>
          <div class="slot-meta">
            ${data.stats.runs} cycle${data.stats.runs > 1 ? 's' : ''} ·
            ${prog.got}/${prog.total} succès ·
            ${(data.echoes || []).length}/12 échos
          </div>`;
        card.appendChild(button('Continuer', () => this.app.loadGame(i), 'btn small'));
        card.appendChild(button('Effacer', () => {
          if (confirm(`Effacer le Jardin ${i + 1} ? Ce geste est définitif.`)) {
            this.app.eraseSlot(i);
            this.slots();
          }
        }, 'btn small ghost'));
      } else {
        card.innerHTML = `<div class="slot-n">Jardin ${i + 1}</div><div class="slot-empty-label">Terre en friche</div>`;
        card.appendChild(button('Commencer', () => this.app.newGame(i), 'btn small'));
      }
      fadeIn(card, i);
      list.appendChild(card);
    }
    body.appendChild(list);
    body.appendChild(button('← Retour', () => this.title(), 'btn ghost'));
  }

  // --- Réglages ---------------------------------------------------------------

  settings() {
    this.current = 'reglages';
    const s = this.app.settings;
    const body = this.panel('Réglages', 'Le son est la moitié du jeu. Garde-le allumé.');

    const audio = el('div', 'settings-group');
    audio.appendChild(el('h3', '', 'Son'));
    audio.appendChild(slider('Volume général', s.master, 0, 1, 0.05, (v) => this.app.setSetting('master', v)));
    audio.appendChild(slider('Musique', s.music, 0, 1, 0.05, (v) => this.app.setSetting('music', v)));
    audio.appendChild(slider('Effets', s.sfx, 0, 1, 0.05, (v) => this.app.setSetting('sfx', v)));
    audio.appendChild(slider('Voix', s.voices, 0, 1, 0.05, (v) => this.app.setSetting('voices', v)));
    body.appendChild(audio);

    const video = el('div', 'settings-group');
    video.appendChild(el('h3', '', 'Image'));
    video.appendChild(toggle('Secousses d’écran', s.screenShake, (v) => this.app.setSetting('screenShake', v)));
    video.appendChild(toggle('Anneau de pulsation', s.showBeatRing, (v) => this.app.setSetting('showBeatRing', v)));
    video.appendChild(toggle('Mouvement réduit', s.reducedMotion, (v) => this.app.setSetting('reducedMotion', v)));
    video.appendChild(select('Particules', [
      { value: 'plein', label: 'Pleines' },
      { value: 'sobre', label: 'Sobres' },
      { value: 'aucun', label: 'Aucune' },
    ], s.particles, (v) => this.app.setSetting('particles', v)));
    video.appendChild(select('Boutons tactiles', [
      { value: 'droitier', label: 'À droite' },
      { value: 'gaucher', label: 'À gauche' },
    ], s.touchLayout, (v) => this.app.setSetting('touchLayout', v)));
    video.appendChild(button(isFullscreen() ? 'Quitter le plein écran' : 'Plein écran',
      (e) => { toggleFullscreen(); setTimeout(() => this.settings(), 120); }, 'btn small'));
    body.appendChild(video);

    const help = el('div', 'settings-group');
    help.appendChild(el('h3', '', 'Commandes'));
    help.appendChild(el('table', 'keys', `
      <tr><td>ZQSD / WASD / flèches</td><td>se déplacer</td></tr>
      <tr><td>Espace · clic gauche</td><td>agir (semer, récolter, purifier, arroser)</td></tr>
      <tr><td>E · clic droit</td><td>accorder — onde de résonance</td></tr>
      <tr><td>Maj droit · C</td><td>Souffle (esquive, disperse la Cendre)</td></tr>
      <tr><td>1…5 · Tab</td><td>changer de graine</td></tr>
      <tr><td>Échap · P</td><td>pause</td></tr>
      <tr><td>T</td><td>Mode Test</td></tr>`));
    body.appendChild(help);

    body.appendChild(button('← Retour', () => this.title(), 'btn ghost'));
  }

  // --- Succès -----------------------------------------------------------------

  achievements() {
    this.current = 'succes';
    const save = this.app.save || this.app.readSlot(this.app.settings.lastSlot) || { achievements: {} };
    const prog = achievementProgress(save);
    const body = this.panel('Succès', `${prog.got} sur ${prog.total}`);
    const grid = el('div', 'ach-grid');
    ACHIEVEMENTS.forEach((a, i) => {
      const got = !!save.achievements[a.id];
      const card = el('div', 'ach' + (got ? ' got' : ''));
      card.innerHTML = `<strong>${got ? a.name : '???'}</strong><span>${a.desc}</span>`;
      fadeIn(card, i % 12);
      grid.appendChild(card);
    });
    body.appendChild(grid);
    body.appendChild(button('← Retour', () => this.title(), 'btn ghost'));
  }

  // --- Journal (échos + défi du jour) -----------------------------------------

  journal() {
    this.current = 'journal';
    const save = this.app.save || this.app.readSlot(this.app.settings.lastSlot) || { echoes: [] };
    const found = new Set(save.echoes || []);
    const body = this.panel('Journal', `${found.size} écho${found.size > 1 ? 's' : ''} sur ${ECHOES.length} retrouvés`);

    const daily = todayChallenge();
    const box = el('div', 'daily-box');
    box.innerHTML = `<strong>${daily.label}</strong>
      <span>${BIOMES[daily.biome].name}</span>
      <em>${daily.modifiers.map((m) => m.name).join(' · ')}</em>
      <small>${daily.modifiers.map((m) => m.desc).join(' ')}</small>`;
    if (save.dailyBest && save.dailyBest[daily.id]) {
      box.appendChild(el('div', 'daily-best', `Meilleur : ${formatSap(save.dailyBest[daily.id])} pts`));
    }
    box.appendChild(button('Relever le défi', () => this.app.startDaily(), 'btn small'));
    body.appendChild(box);

    const list = el('div', 'echo-list');
    ECHOES.forEach((e, i) => {
      const got = found.has(e.id);
      const card = el('div', 'echo' + (got ? ' got' : ''));
      card.innerHTML = got
        ? `<strong>${e.title}</strong><p>${e.text}</p>`
        : `<strong>— recouvert —</strong><p>Purifie la case où il dort.</p>`;
      fadeIn(card, i % 8);
      list.appendChild(card);
    });
    body.appendChild(list);
    body.appendChild(button('← Retour', () => this.title(), 'btn ghost'));
  }
}

let pluckIdx = 0;
const MENU_DEGREES = ['I', 'II', 'III', 'V', 'VI'];
function pluckDegree(i) {
  pluckIdx = i;
  pluck(degreeFreq(MENU_DEGREES[i % MENU_DEGREES.length], 0), { dur: 1.1, gain: 0.12, damping: 0.994 });
}
