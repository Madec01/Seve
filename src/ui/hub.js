// Le Verger : le hub entre deux Cycles. Boutique, biomes, bilan, pause.
// Bourdon tient le comptoir ; l'écran reverdit à mesure que le monde guérit.

import { el, button, clear } from './dom.js';
import { waveTitle, fadeIn, countTo, formatSap } from './text.js';
import {
  UPGRADES, UPGRADE_ORDER, upgradeLevel, upgradeCost, buyUpgrade,
  SEED_UNLOCKS, buySeed, buyBiome, healingProgress,
} from '../game/progression.js';
import { BIOMES, BIOME_ORDER } from '../game/biomes.js';
import { SPECIES } from '../game/plants.js';
import { DEGREE_INFO } from '../game/scales.js';
import { ACT_TITLES, actForSave } from '../game/lore.js';
import { wood, pluck, earth } from '../audio/synth.js';
import { degreeFreq } from '../game/scales.js';
import { SEASON } from '../game/constants.js';
import { drawFloraIcon } from './flora.js';

export class Hub {
  constructor(root, app) {
    this.app = app;
    this.el = el('div', 'screens hub hidden');
    root.appendChild(this.el);
  }

  hide() { this.el.classList.add('hidden'); clear(this.el); }

  frame(titleText, subtitleText) {
    clear(this.el);
    this.el.classList.remove('hidden');
    const wrap = el('div', 'panel wide');
    const h = el('h2', 'panel-title');
    waveTitle(h, titleText, { delay: 0.03, amplitude: 4 });
    wrap.appendChild(h);
    if (subtitleText) wrap.appendChild(el('p', 'panel-sub', subtitleText));
    const body = el('div', 'panel-body');
    wrap.appendChild(body);
    this.el.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    return body;
  }

  // --- Le Verger ---------------------------------------------------------------

  verger() {
    const save = this.app.save;
    const act = ACT_TITLES[actForSave(save)];
    const heal = healingProgress(save);
    this.el.style.setProperty('--heal', heal.toFixed(2));

    const body = this.frame('Le Verger', act.line);

    const header = el('div', 'hub-header');
    header.innerHTML = `
      <div class="hub-sap"><span>❍</span><b>${formatSap(save.sap)}</b><small>sève</small></div>
      <div class="hub-act">${act.name}</div>
      <div class="hub-heal" title="Guérison du Réseau">
        <i style="transform:scaleX(${heal})"></i><span>${Math.round(heal * 100)} % du Réseau réaccordé</span>
      </div>`;
    body.appendChild(header);

    const cols = el('div', 'hub-cols');

    // Améliorations.
    const upWrap = el('section', 'hub-col');
    upWrap.appendChild(el('h3', '', 'Améliorations'));
    UPGRADE_ORDER.forEach((id, i) => {
      const up = UPGRADES[id];
      const lvl = upgradeLevel(save, id);
      const cost = upgradeCost(save, id);
      const card = el('div', 'shop-card' + (cost === null ? ' maxed' : ''));
      card.innerHTML = `
        <div class="shop-head"><strong>${up.name}</strong>
          <span class="pips">${'●'.repeat(lvl)}${'○'.repeat(up.max - lvl)}</span></div>
        <p>${up.desc}</p>`;
      if (cost === null) {
        card.appendChild(el('div', 'shop-max', 'Au maximum'));
      } else {
        const b = button(`${formatSap(cost)} ❍`, () => {
          if (buyUpgrade(save, id)) {
            earth({ gain: 0.22, freq: 120 });
            pluck(degreeFreq('V', 0), { dur: 1.4, gain: 0.2 });
            this.app.persist();
            this.verger();
          } else {
            wood({ freq: 150, gain: 0.2, decay: 0.12 });
            this.app.toast('Pas assez de sève', 'Bourdon hausse les épaules.', '#9a8f80');
          }
        }, 'btn small' + (save.sap >= cost ? '' : ' disabled'));
        card.appendChild(b);
      }
      fadeIn(card, i);
      upWrap.appendChild(card);
    });
    cols.appendChild(upWrap);

    // Graines et biomes.
    const right = el('section', 'hub-col');
    right.appendChild(el('h3', '', 'Graines'));
    for (const entry of SEED_UNLOCKS) {
      const owned = save.unlockedSeeds.includes(entry.key);
      const info = DEGREE_INFO[entry.key];
      const sp = SPECIES[entry.key];
      const card = el('div', 'shop-card seed-card' + (owned ? ' owned' : ''));
      card.style.setProperty('--seed-color', info.color);
      card.innerHTML = `
        <canvas class="shop-icon" width="72" height="72" aria-hidden="true"></canvas>
        <div class="shop-head"><strong>${sp.name}</strong><span class="deg">${entry.key} · ${info.name}</span></div>
        <p>${sp.desc}</p>`;
      const ic = card.querySelector('.shop-icon').getContext('2d');
      ic.translate(36, 66);
      drawFloraIcon(ic, entry.key, 62);
      if (owned) card.appendChild(el('div', 'shop-max', 'Dans ta besace'));
      else {
        card.appendChild(button(`${formatSap(entry.cost)} ❍`, () => {
          if (buySeed(save, entry.key)) {
            pluck(degreeFreq(entry.key, 0), { dur: 2.4, gain: 0.28, damping: 0.998 });
            this.app.persist();
            this.app.toast('Nouvelle graine', `${sp.name} rejoint ta besace.`, info.color);
            this.verger();
          } else this.app.toast('Pas assez de sève', '', '#9a8f80');
        }, 'btn small' + (save.sap >= entry.cost ? '' : ' disabled')));
      }
      right.appendChild(card);
    }

    right.appendChild(el('h3', '', 'Biomes'));
    for (const id of BIOME_ORDER) {
      const b = BIOMES[id];
      const owned = save.unlockedBiomes.includes(id);
      const card = el('div', 'shop-card biome-card' + (owned ? ' owned' : ''));
      card.style.setProperty('--biome-color', b.palette.accent);
      card.innerHTML = `
        <div class="shop-head"><strong>${b.name}</strong><span class="deg">${b.bpm} BPM</span></div>
        <p>${b.rule}</p>`;
      if (owned) card.appendChild(el('div', 'shop-max', 'Ouvert'));
      else {
        card.appendChild(button(`${formatSap(b.cost)} ❍`, () => {
          if (buyBiome(save, id)) {
            pluck(degreeFreq('I', -1), { dur: 3, gain: 0.3, damping: 0.999 });
            this.app.persist();
            this.app.toast('Un chemin s’ouvre', b.name, b.palette.accent);
            this.verger();
          } else this.app.toast('Pas assez de sève', '', '#9a8f80');
        }, 'btn small' + (save.sap >= b.cost ? '' : ' disabled')));
      }
      right.appendChild(card);
    }
    cols.appendChild(right);
    body.appendChild(cols);

    const actions = el('div', 'hub-actions');
    actions.appendChild(button('Partir en Cycle →', () => this.biomeSelect(), 'btn primary'));
    actions.appendChild(button('Journal', () => this.app.screens.journal(), 'btn ghost'));
    actions.appendChild(button('Réglages', () => this.app.screens.settings(), 'btn ghost'));
    actions.appendChild(button('Menu principal', () => this.app.toTitle(), 'btn ghost'));
    body.appendChild(actions);
  }

  // --- Choix du biome ----------------------------------------------------------

  biomeSelect() {
    const save = this.app.save;
    const body = this.frame('Où vas-tu semer ?', 'Chaque terre a son pouls et sa règle.');
    const list = el('div', 'biome-list');
    save.unlockedBiomes.forEach((id, i) => {
      const b = BIOMES[id];
      const card = el('div', 'biome-choice');
      card.style.setProperty('--biome-color', b.palette.accent);
      card.innerHTML = `
        <h4>${b.name}</h4>
        <div class="bpm">${b.bpm} BPM · ${b.cols}×${b.rows}</div>
        <p>${b.rule}</p>`;
      card.appendChild(button('Semer ici', () => this.app.startRun(id), 'btn small'));
      fadeIn(card, i);
      list.appendChild(card);
    });
    body.appendChild(list);
    body.appendChild(button('← Le Verger', () => this.verger(), 'btn ghost'));
  }

  // --- Interlude entre deux saisons -------------------------------------------

  seasonEnd(payload) {
    const { season, cleared, sap, goal, run } = payload;
    const body = this.frame(
      cleared ? `Saison ${season + 1} passée` : `Saison ${season + 1} manquée`,
      cleared ? 'Le champ tient. La Cendre recule d’un pas.'
        : 'La Cendre a gagné du terrain. Une fissure de plus s’est ouverte.',
    );
    const stats = el('div', 'season-stats');
    stats.innerHTML = `
      <div><b>${formatSap(sap)}</b><span>sève récoltée</span></div>
      <div><b>${formatSap(goal)}</b><span>objectif</span></div>
      <div><b>×${run.chainMult}</b><span>chaîne finale</span></div>
      <div><b>${run.stats.chords}</b><span>accords formés</span></div>`;
    body.appendChild(stats);

    if (run.season < SEASON.count) {
      body.appendChild(el('p', 'note', `Saison ${run.season + 1} : objectif ${formatSap(run.goal)} sève, ${run.beatsThisSeason} pulsations.`));
    }
    body.appendChild(button('Continuer', () => this.app.resumeRun(), 'btn primary'));
  }

  // --- Bilan de fin de Cycle ---------------------------------------------------

  results(run, won, gains) {
    const body = this.frame(won ? 'Floraison' : 'Étiolement',
      won ? 'Le Cycle est bouclé. Le Réseau a repris un peu de voix.'
        : 'La Cendre a tout recouvert. Ce que tu as récolté te reste.');

    const grid = el('div', 'result-grid');
    const rows = [
      ['Points', run.points],
      ['Sève rapportée', gains.sap],
      ['Récoltes', run.stats.harvests],
      ['Accords', run.stats.chords],
      ['Meilleure chaîne', run.bestChain],
      ['Actions justes', run.stats.perfectBeats],
      ['Cases purifiées', Math.round(run.stats.purified)],
      ['Plus bel accord', run.stats.bestChordId || '—'],
    ];
    rows.forEach(([label, value], i) => {
      const cell = el('div', 'result-cell');
      const b = el('b', '', typeof value === 'number' ? '0' : String(value));
      cell.appendChild(b);
      cell.appendChild(el('span', '', label));
      if (typeof value === 'number') countTo(b, 0, value, 0.7 + i * 0.05, (v) => formatSap(v));
      fadeIn(cell, i);
      grid.appendChild(cell);
    });
    body.appendChild(grid);

    if (gains.echo) {
      const e = el('div', 'echo-found');
      e.innerHTML = `<strong>Écho retrouvé — ${gains.echo.title}</strong><p>${gains.echo.text}</p>`;
      body.appendChild(e);
    }
    if (gains.achievements && gains.achievements.length) {
      const a = el('div', 'ach-found');
      a.innerHTML = `<strong>Succès débloqués</strong><p>${gains.achievements.map((x) => x.name).join(' · ')}</p>`;
      body.appendChild(a);
    }

    const actions = el('div', 'hub-actions');
    actions.appendChild(button('Retour au Verger', () => this.verger(), 'btn primary'));
    actions.appendChild(button('Rejouer ce biome', () => this.app.startRun(run.biome.id), 'btn'));
    body.appendChild(actions);
  }

  // --- Pause -------------------------------------------------------------------

  pause(run) {
    const body = this.frame('Pause', run ? run.biome.name : '');
    const actions = el('div', 'hub-actions column');
    actions.appendChild(button('Reprendre', () => this.app.resumeRun(), 'btn primary'));
    actions.appendChild(button('Réglages', () => this.app.screens.settings(), 'btn'));
    actions.appendChild(button('Mode Test', () => this.app.openTestMode(), 'btn ghost'));
    actions.appendChild(button('Abandonner le Cycle', () => {
      if (confirm('Abandonner ? La sève déjà récoltée est conservée.')) this.app.abandonRun();
    }, 'btn ghost'));
    body.appendChild(actions);
    if (run) {
      body.appendChild(el('p', 'note',
        `Saison ${run.season + 1}/3 · ${formatSap(run.seasonSap)}/${formatSap(run.goal)} sève · chaîne ×${run.chainMult}`));
    }
  }
}
