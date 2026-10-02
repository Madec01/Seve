// « Jus » de la récolte et des gestes du potager (lot 2 « Toucher & surprises », B1 et B2 côté interface).
//
// createJuice(app) → app.juice
//   onEvent(ev, game)   à chaque événement du cœur (main.js, wire) : récolte, semis, arrosage du joueur
//   frame(dt)           à chaque image (main.js) : vol des pièces vers le compteur d'argent
//   swipeStart()        un glissé de série commence (gestures.js)
//   swipeEnd()          le doigt se lève : la série se termine bientôt (bulle du total)
//   reset()             nouvelle partie / retour au menu : plus rien en vol
//   stats()             { coins (en vol), combo, total } (mesures, débogage)
//
// Récolte du joueur :
//   - une NOTE qui monte (gamme pentatonique, src/audio/synth.js) à chaque parcelle d'une même série ;
//     la série retombe après ~1 s sans récolte ;
//   - 1 à 3 pièces (réserve de nœuds DOM réutilisés) volent en courbe de la parcelle jusqu'à l'icône du
//     compteur d'argent (au-dessus de la barre du haut) ; le compteur attend leur arrivée pour monter
//     (app.hud.holdMoney / releaseMoney) et fait un petit bond à chaque prise ;
//   - en fin de série (≥ 2 parcelles), une bulle « +46 » au-dessus de la dernière parcelle ;
//   - petite vibration (gestures.js) ; récolte dorée : motif un peu plus marqué.
// Récoltes belles / dorées (B2) : son propre (scintillement, clochette pour l'or), message pour la première
// récolte dorée de chaque culture.
// Mouvements réduits : pas de vol (le compteur monte tout de suite, un seul bond), la note et les sons restent.

import { el } from './dom.js';
import { icon, cropIcon } from './icons.js';
import { cropName } from './text.js';
import { qualityOf } from '../render/effects.js';

const COMBO_IDLE_MS = 1000; // la série retombe après 1 s sans récolte
const SWIPE_END_MS = 380; // après le lever du doigt, la bulle du total arrive vite
const POOL = 30; // pièces en vol au plus
const FIRSTS_KEY = 'une-annee-a-la-ferme.lot2.firsts';
const GOLD = '#ffe27a';

function loadFirsts() {
  try {
    const v = JSON.parse(localStorage.getItem(FIRSTS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function createJuice(app) {
  const layer = el('div', { id: 'fx-layer', 'aria-hidden': 'true' });
  document.body.append(layer);

  // Réserve de pièces volantes (nœuds créés une fois).
  const coins = [];
  for (let i = 0; i < POOL; i++) {
    const node = el('span.fx-coin', icon('coin', 'md'));
    node.style.display = 'none';
    layer.append(node);
    coins.push({ node, alive: false, t: 0, life: 0.6, delay: 0, x0: 0, y0: 0, cx: 0, cy: 0, x1: 0, y1: 0, hold: null, last: false, shown: false });
  }

  const combo = { n: 0, total: 0, last: 0, plot: -1, timer: null, swiping: false };
  let firsts = loadFirsts();
  let target = null; // centre de l'icône du compteur (px de la page), relu au début de chaque vol
  let targetAt = 0;
  let flying = 0;
  let coinSoundAt = 0;

  const reduced = () => (typeof app.reducedMotion === 'function' ? app.reducedMotion() : false);

  function moneyTarget() {
    const now = performance.now();
    if (target && now - targetAt < 500) return target;
    const ico = document.querySelector('#hud-money .hud-line--big .ico') || document.querySelector('#hud-money');
    if (!ico) return null;
    const r = ico.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    targetAt = now;
    return target;
  }

  /** Centre d'une parcelle (px de la page), ou null si hors de la scène. */
  function plotPoint(i) {
    const r = app.plotPageRect?.(i);
    if (!r) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.3, w: r.width };
  }

  function playCoin() {
    const now = performance.now();
    if (now - coinSoundAt < 110) return;
    coinSoundAt = now;
    app.audio.play('coin', { volume: 0.55, throttle: 100 });
  }

  /** Lance n pièces de (x, y) vers le compteur ; amount est retenu par le compteur jusqu'à l'arrivée. */
  function launch(from, amount, n) {
    const to = moneyTarget();
    if (!to || !from) {
      playCoin();
      return;
    }
    const hold = { amount, left: n };
    app.hud.holdMoney?.(hold, 1400);
    for (let i = 0; i < n; i++) {
      const c = coins.find((x) => !x.alive);
      if (!c) {
        hold.left--;
        if (hold.left <= 0) app.hud.releaseMoney?.(hold);
        continue;
      }
      c.alive = true;
      c.shown = false;
      c.t = 0;
      c.delay = 0.12 + i * 0.07; // la plante saute d'abord, puis les pièces partent
      c.life = 0.55 + Math.random() * 0.12 + Math.min(0.2, Math.hypot(to.x - from.x, to.y - from.y) / 4000);
      c.x0 = from.x + (Math.random() * 2 - 1) * Math.min(14, from.w * 0.2);
      c.y0 = from.y + (Math.random() * 2 - 1) * 6;
      c.x1 = to.x;
      c.y1 = to.y;
      // Point de contrôle : la pièce saute d'abord vers le haut et sur le côté, puis file vers le compteur.
      const side = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 50);
      c.cx = c.x0 + side;
      c.cy = Math.min(c.y0, to.y) - 40 - Math.random() * 60;
      c.hold = hold;
      flying++;
    }
  }

  function land(c) {
    c.alive = false;
    c.node.style.display = 'none';
    flying = Math.max(0, flying - 1);
    const h = c.hold;
    c.hold = null;
    if (h) {
      h.left--;
      if (h.left <= 0) app.hud.releaseMoney?.(h);
    }
    app.hud.catchCoin?.();
    playCoin();
  }

  function frame(dt) {
    if (!flying) return;
    for (const c of coins) {
      if (!c.alive) continue;
      if (c.delay > 0) {
        c.delay -= dt;
        continue;
      }
      c.t += dt;
      const u = Math.min(1, c.t / c.life);
      if (u >= 1) {
        land(c);
        continue;
      }
      // Bézier quadratique, accélération vers la fin (la pièce est « aspirée » par le compteur).
      const e = u * u * (1.6 - 0.6 * u);
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const d = e * e;
      const x = a * c.x0 + b * c.cx + d * c.x1;
      const y = a * c.y0 + b * c.cy + d * c.y1;
      const s = u < 0.15 ? 0.45 + (u / 0.15) * 0.5 : 0.95 - (u - 0.15) * 0.3;
      if (!c.shown) {
        c.shown = true;
        c.node.style.display = '';
      }
      c.node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`;
    }
  }

  // ── Série de récoltes ──────────────────────────────────────────────────────────────
  function endCombo() {
    clearTimeout(combo.timer);
    combo.timer = null;
    if (combo.n >= 2 && combo.total > 0 && combo.plot >= 0) {
      const s = app.scene;
      const c = s?.layout?.plotCenter?.(combo.plot);
      if (c && s.effects) {
        const k = s.layout.plotScale || 1;
        s.effects.floatText(c.x, c.y - 20 * k, `+${combo.total}`, GOLD, { size: 1.4, pop: true, life: 2.3, icon: true, delay: 0.25 });
      }
      app.audio.tone?.('pop', { volume: 0.6, delay: 0.25 });
    }
    combo.n = 0;
    combo.total = 0;
    combo.plot = -1;
  }

  function armTimer(ms) {
    clearTimeout(combo.timer);
    combo.timer = setTimeout(endCombo, ms);
  }

  function firstGold(ev, game) {
    if (ev.firstGold === false) return false;
    const key = `${game?.mode === 'career' ? 'c' : 'l'}:${ev.cropId}`;
    if (ev.firstGold === true) return true;
    if (firsts[key]) return false;
    firsts[key] = 1;
    try {
      localStorage.setItem(FIRSTS_KEY, JSON.stringify(firsts));
    } catch {
      /* stockage indisponible */
    }
    return true;
  }

  function onHarvest(ev, game) {
    const now = performance.now();
    if (now - combo.last > COMBO_IDLE_MS) {
      if (combo.n) endCombo();
    }
    combo.last = now;
    const step = combo.n;
    combo.n++;
    combo.plot = ev.plotIndex;
    const q = qualityOf(ev);
    // Note de la série (plus douce si la récolte part à l'atelier ou au grenier).
    app.audio.note?.(step, { volume: ev.processed || ev.stored ? 0.7 : 1 });
    if (q === 'gold') {
      app.audio.tone?.('gold', { volume: 0.9, throttle: 120 });
      app.vibrate?.([14, 50, 22]);
    } else if (q === 'fine') {
      app.audio.tone?.('belle', { volume: 0.9, throttle: 90 });
    }
    if (q === 'gold' && ev.cropId && !ev.giant && firstGold(ev, game)) {
      app.toasts.show({
        kind: 'success',
        sprite: cropIcon(ev.cropId, 'sprite--sm'),
        title: 'Première récolte dorée !',
        text: `${cropName(ev.cropId)} dorée : elle vaut ${ev.qualityMultiplier && ev.qualityMultiplier !== 2 ? `×${String(ev.qualityMultiplier).replace('.', ',')}` : 'deux fois plus'} ! Arrosage régulier, ruches et rotation en font pousser davantage.`,
        duration: 4200,
      });
    }
    const amount = Math.round(ev.amount || 0);
    const money = amount > 0 && !ev.processed && !ev.stored && !ev.diverted;
    if (money) {
      combo.total += amount;
      if (reduced()) {
        app.hud.catchCoin?.();
        playCoin();
      } else {
        const n = ev.giant ? 6 : q === 'gold' ? 3 : amount >= 25 ? 3 : amount >= 10 ? 2 : 1;
        launch(plotPoint(ev.plotIndex), amount, n);
      }
    }
    armTimer(combo.swiping ? COMBO_IDLE_MS : COMBO_IDLE_MS);
  }

  function onEvent(ev, game) {
    const mine = !ev.by || ev.by === 'player';
    if (!mine) return;
    switch (ev.type) {
      case 'harvested':
        onHarvest(ev, game);
        break;
      case 'foragePicked':
        // (Lot 2) Cueillette des champignons : même plaisir qu'une récolte (note, pièces qui volent).
        onHarvest({ plotIndex: ev.plotIndex, amount: ev.amount, cropId: null }, game);
        break;
      case 'planted':
        app.audio.tone?.('thud', { volume: 0.8, throttle: 50 });
        break;
      case 'watered':
        app.audio.tone?.('splash', { volume: 0.8, delay: 0.1, throttle: 50 });
        break;
      default:
        break;
    }
  }

  function reset() {
    clearTimeout(combo.timer);
    combo.timer = null;
    combo.n = 0;
    combo.total = 0;
    combo.plot = -1;
    combo.swiping = false;
    for (const c of coins) {
      if (c.alive && c.hold) {
        c.hold.left = 0;
        app.hud.releaseMoney?.(c.hold);
      }
      c.alive = false;
      c.hold = null;
      c.node.style.display = 'none';
    }
    flying = 0;
    target = null;
  }

  return {
    onEvent,
    frame,
    reset,
    swipeStart() {
      combo.swiping = true;
    },
    swipeEnd() {
      combo.swiping = false;
      if (combo.n) armTimer(SWIPE_END_MS);
    },
    stats() {
      return { coins: flying, combo: combo.n, total: combo.total };
    },
    /** Oublie les « premières fois » (tests). */
    resetFirsts() {
      firsts = {};
      try {
        localStorage.removeItem(FIRSTS_KEY);
      } catch {
        /* rien */
      }
    },
  };
}
