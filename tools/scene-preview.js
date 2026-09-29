// Aperçu de la scène pour la vérification visuelle (outil de développement).
// Ouvrir via un serveur HTTP à la racine du dépôt : /tools/scene-preview.html
//
// Paramètres d'URL (pour les captures automatiques) :
//   level=1..8  season=0..3  weather=sunny|cloudy|rain|storm|heatwave|snow  day=0..1
//   inv=all|none  crops=1  unlock=1  seed=123  panel=0 (masque le panneau)
// window.preview expose { game, scene, set(opts), buyAll(), fill(), … } pour les scripts.
//
// Cet outil modifie directement game.state (saison, météo, achats) : c'est volontaire, pour
// montrer tous les cas ; le jeu, lui, ne passe que par game.actions.

import { SHEETS, CROP_IDS } from '../src/render/atlas.js';
import { loadImages } from '../src/render/assets.js';
import { createScene } from '../src/render/scene.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const errBox = $('err');
window.addEventListener('error', (e) => { errBox.textContent += `${e.message}\n`; });

// ── Jeu réel si disponible, sinon maquette qui respecte le contrat de docs/ARCHITECTURE.md ──
let createGame = null;
let LEVELS = null;
let CROPS = null;
let INVESTMENTS = null;
try {
  ({ createGame } = await import('../src/core/game.js'));
  ({ LEVELS } = await import('../src/data/levels.js'));
  ({ CROPS } = await import('../src/data/crops.js'));
  ({ INVESTMENTS } = await import('../src/data/investments.js'));
} catch (e) {
  console.warn('Cœur de jeu indisponible, maquette utilisée :', e.message);
}

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const MOCK_INV = { chickenCoop: 3, beehive: 3, roadsideStand: 1, cow: 3, sheep: 3, sprinkler: 3, solarPanel: 2, guestHouse: 1 };

function mockGame(levelId) {
  const lvl = (LEVELS && LEVELS.find((l) => l.id === levelId)) || {
    id: levelId, gridCols: 6, gridRows: 4, availableInvestments: Object.keys(MOCK_INV), modifiers: {},
  };
  const n = lvl.gridCols * lvl.gridRows;
  const state = {
    time: { day: 1, seasonIndex: 0, dayOfSeason: 1, elapsed: 9 },
    weather: { today: 'sunny', tomorrow: 'sunny' },
    plots: Array.from({ length: n }, (_, i) => ({ unlocked: i % lvl.gridCols >= 1 && i % lvl.gridCols <= 4 && i < 18, cropId: null, growth: 0, watered: false })),
    investments: Object.fromEntries(Object.keys(MOCK_INV).map((k) => [k, 0])),
    stats: { year: { cropsHarvested: {} } },
    money: 1000,
    speed: 1,
  };
  const days = (id) => (CROPS ? CROPS.find((c) => c.id === id)?.growDays : 4) || 4;
  const handlers = new Map();
  return {
    state,
    level: lvl,
    on(type, h) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(h); return () => handlers.get(type).delete(h); },
    update() {},
    actions: {},
    query: {
      plot(i) {
        const p = state.plots[i];
        const g = p.cropId ? days(p.cropId) : 1;
        const mature = !!p.cropId && p.growth >= g;
        return { index: i, unlocked: p.unlocked, cropId: p.cropId, stage: mature ? 4 : Math.min(3, Math.floor((p.growth / g) * 4)), progress: p.growth / g, watered: p.watered, mature };
      },
      calendar() {
        return { day: state.time.day, dayOfSeason: 1, seasonIndex: state.time.seasonIndex, seasonId: SEASONS[state.time.seasonIndex], seasonLength: 7, dayProgress: state.time.elapsed / 20, totalDays: 28 };
      },
      investments() { return Object.keys(MOCK_INV).map((id) => ({ id, owned: state.investments[id], max: MOCK_INV[id] })); },
      forecast() { return state.weather; },
      finance() { return { money: state.money }; },
      level() { return lvl; },
    },
  };
}

function newGame(levelId, seed) {
  if (createGame) {
    try { return createGame({ levelId, seed }); } catch (e) { console.warn(e); }
  }
  return mockGame(levelId);
}

// ── Mise en place ─────────────────────────────────────────────────────────────────────
const images = await loadImages(SHEETS, { base: '../' });
const canvas = $('scene');
let seed = Number(params.get('seed')) || 7;
let game = newGame(Number(params.get('level')) || 1, seed);
const scene = createScene(canvas, images, game.level || game.query.level());
let unsub = null;

function wire() {
  if (unsub) unsub();
  unsub = game.on('*', (e) => scene.onEvent(e.type, e));
  game.state.money = 99999;
}
wire();

function fit() {
  scene.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
window.addEventListener('resize', fit);
fit();

// Options de niveau
const levelSel = $('level');
for (const l of LEVELS || [{ id: 1, name: 'Maquette' }]) {
  const o = document.createElement('option');
  o.value = l.id;
  o.textContent = `${l.id}. ${l.name}`;
  levelSel.append(o);
}
levelSel.value = String(game.state.levelId || 1);

// Pseudo-hasard reproductible pour l'outil
let rs = seed;
const rand = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };

function maxOf(id) {
  const inv = INVESTMENTS?.find((i) => i.id === id);
  return inv ? inv.costs.length : MOCK_INV[id] || 1;
}
function availableIds() {
  return game.query.investments().map((i) => i.id);
}

const api = {
  get game() { return game; },
  scene,
  set(opts = {}) {
    if (opts.level !== undefined && Number(opts.level) !== (game.state.levelId || 1)) {
      game = newGame(Number(opts.level), seed);
      wire();
      levelSel.value = String(opts.level);
    }
    if (opts.season !== undefined) {
      game.state.time.seasonIndex = Number(opts.season);
      $('season').value = String(opts.season);
    }
    if (opts.weather !== undefined) {
      game.state.weather.today = opts.weather;
      $('weather').value = opts.weather;
    }
    if (opts.day !== undefined) {
      game.state.time.elapsed = Number(opts.day) * 20;
      $('day').value = String(opts.day);
    }
  },
  buyAll() {
    for (const id of availableIds()) game.state.investments[id] = maxOf(id);
  },
  buyOne() {
    for (const id of availableIds()) {
      if ((game.state.investments[id] || 0) < maxOf(id)) {
        if (game.actions.buyInvestment) {
          game.state.money = 99999;
          game.actions.buyInvestment(id);
        } else {
          game.state.investments[id] = (game.state.investments[id] || 0) + 1;
        }
        return id;
      }
    }
    return null;
  },
  sellAll() {
    for (const id of Object.keys(game.state.investments)) game.state.investments[id] = 0;
  },
  unlock() {
    for (const p of game.state.plots) p.unlocked = true;
  },
  fill() {
    const season = SEASONS[game.state.time.seasonIndex];
    const ids = CROPS ? CROPS.filter((c) => c.seasons.includes(season)).map((c) => c.id) : CROP_IDS;
    const pool = ids.length ? ids : CROP_IDS;
    for (const p of game.state.plots) {
      if (!p.unlocked) continue;
      if (rand() < 0.12) { p.cropId = null; p.growth = 0; p.watered = false; continue; }
      const id = pool[Math.floor(rand() * pool.length)];
      const days = CROPS ? CROPS.find((c) => c.id === id).growDays : 4;
      p.cropId = id;
      p.growth = Math.min(days, Math.floor(rand() * (days + 2)));
      p.watered = rand() < 0.5;
    }
  },
  empty() {
    for (const p of game.state.plots) { p.cropId = null; p.growth = 0; p.watered = false; }
  },
  dawn() {
    const incomes = availableIds().filter((id) => game.state.investments[id] > 0).map((id) => ({ source: id, amount: 5 + Math.floor(rand() * 20), owned: game.state.investments[id], kind: 'daily' }));
    scene.onEvent('dawn', { incomes, charges: 7 });
  },
  frost() {
    const lost = [];
    game.state.plots.forEach((p, i) => { if (p.cropId) { lost.push({ plotIndex: i, cropId: p.cropId }); p.cropId = null; p.growth = 0; } });
    scene.onEvent('frost', { lostPlots: lost.map((l) => l.plotIndex), lost });
  },
  harvestAll() {
    game.state.plots.forEach((p, i) => {
      const q = game.query.plot(i);
      if (q.mature) {
        if (game.actions.harvest) game.actions.harvest(i);
        else { p.cropId = null; scene.onEvent('harvested', { plotIndex: i, cropId: q.cropId, amount: 12 }); }
      }
    });
  },
};
window.preview = api;

// ── Contrôles ─────────────────────────────────────────────────────────────────────────
$('toggle').onclick = () => $('panel').classList.toggle('hidden');
levelSel.onchange = () => api.set({ level: levelSel.value });
$('season').onchange = () => api.set({ season: $('season').value });
$('weather').onchange = () => api.set({ weather: $('weather').value });
$('day').oninput = () => api.set({ day: $('day').value });
for (const k of ['buyAll', 'buyOne', 'sellAll', 'fill', 'unlock', 'empty', 'dawn', 'frost', 'harvestAll']) $(k).onclick = () => api[k]();

canvas.addEventListener('mousemove', (e) => scene.setHover(scene.hitTest(e.offsetX, e.offsetY)));
canvas.addEventListener('mouseleave', () => scene.setHover(null));
canvas.addEventListener('click', (e) => {
  const hit = scene.hitTest(e.offsetX, e.offsetY);
  if (!hit) return;
  game.state.money = 99999;
  if (hit.type === 'plot' && game.actions.plant) {
    const q = game.query.plot(hit.index);
    if (q.action === 'unlock') game.actions.unlockPlot(hit.index);
    else if (q.action === 'plant') {
      const list = game.query.plantableCrops();
      if (list.length) game.actions.plant(hit.index, list[Math.floor(rand() * list.length)].id);
    } else if (q.action === 'water') game.actions.water(hit.index);
    else if (q.action === 'harvest') game.actions.harvest(hit.index);
  } else if (hit.type === 'investment' && game.actions.buyInvestment) {
    game.actions.buyInvestment(hit.id);
  }
});

// ── État initial depuis l'URL ─────────────────────────────────────────────────────────
api.set({
  season: params.get('season') ?? 0,
  weather: params.get('weather') ?? 'sunny',
  day: params.get('day') ?? 0.45,
});
if (params.get('unlock') === '1') api.unlock();
if (params.get('inv') === 'all') api.buyAll();
if (params.get('crops') === '1') api.fill();
if (params.get('panel') === '0') $('panel').classList.add('hidden');

// ── Boucle ────────────────────────────────────────────────────────────────────────────
let last = performance.now();
let frames = 0;
let fpsT = 0;
let fps = 0;
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  if ($('run').checked) {
    if (game.state.speed === 0) game.state.speed = 1;
    game.update(dt);
    $('day').value = String(game.query.calendar().dayProgress);
  }
  const t0 = performance.now();
  scene.render(game, t);
  const cost = performance.now() - t0;
  frames++;
  fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  const cal = game.query.calendar();
  $('info').textContent = `zoom ×${scene.zoom}  ${fps} i/s  rendu ${cost.toFixed(1)} ms\n${cal.seasonId} jour ${cal.day}  ${game.state.weather.today}  ${(cal.dayProgress * 100) | 0} %`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.previewReady = true;
