// Aperçu de la scène pour la vérification visuelle (outil de développement).
// Ouvrir via un serveur HTTP à la racine du dépôt : /tools/scene-preview.html
//
// Paramètres d'URL (pour les captures automatiques) :
//   level=1..8  season=0..3  weather=sunny|cloudy|rain|storm|heatwave|snow  day=0..1
//   inv=all|none  crops=1  unlock=1  seed=123  panel=0 (masque le panneau)  grid=8x5 (maquette)
//   (v3) level=9..12  trees=1 (pommiers à toutes les étapes)  proc=1 (ateliers au travail)
//   decor=all (toutes les décorations posées)  outfit=0..3  fence=wood|picket|stone|hedge
//   path=dirt|stone  name=Nom%20de%20la%20ferme  decorMode=1  contest=1 (fanions + coupe)  off=1
//   (ateliers éteints)
//   Vue téléphone : w=412&h=915&dpr=2.625 (canvas de w × h px CSS, centré, densité imposée)
//   Bandeaux simulés : top=64&bottom=72 (px CSS couverts par la barre du haut et les onglets ;
//   par défaut 64 / 72 en vue téléphone, 0 sinon) ; mode=portrait|landscape|auto ; scroll=px
//   Au doigt ou à la souris : glisser = défiler, toucher bref = action sur la parcelle.
//   Mode Carrière : career=1 stage=start|1|3|8|12|manor event=… staff=N sim=s pets=1 pending=1|full
//   focus=<lotId>|house|field (voir tools/scene-preview-career.js)
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
const DECOR_ITEMS = ['flowers.red', 'bench', 'lamp', 'scarecrow', 'wheelbarrow', 'birdhouse', 'gnome', 'mailbox', 'hedge.bush', 'flowers.yellow', 'flowers.blue', 'flowers.pink', 'flowers.white'];
const OUTFITS = ['outfit.classic', 'outfit.checked', 'outfit.raincoat', 'outfit.gardener'];
const FENCES = ['fence.wood', 'fence.picket', 'fence.stone', 'fence.hedge'];
const PRODUCT_OF = { jamWorkshop: ['strawberryJam', 'appleJuice'], dairy: ['cowCheese', 'goatCheese'], mill: ['flour', 'bread'] };

function mockGame(levelId, grid) {
  let lvl = (LEVELS && LEVELS.find((l) => l.id === levelId)) || {
    id: levelId, gridCols: 6, gridRows: 4, availableInvestments: Object.keys(MOCK_INV), modifiers: {},
  };
  if (grid) lvl = { ...lvl, gridCols: grid[0], gridRows: grid[1], availableInvestments: Object.keys(MOCK_INV), modifiers: {} };
  const n = lvl.gridCols * lvl.gridRows;
  const state = {
    levelId: lvl.id,
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

// grid=8x5 : maquette avec une grille imposée (taille maximale du champ)
const forcedGrid = params.get('grid') ? params.get('grid').split('x').map(Number) : null;

// (Carrière) career=1 : vraie carrière construite au stade voulu (tools/scene-preview-career.js).
const careerOn = params.get('career') === '1';
const CP = careerOn ? await import('./scene-preview-career.js') : null;

function newGame(levelId, seed) {
  if (CP) {
    return CP.buildCareerGame({
      seed,
      stage: params.get('stage') || 'start',
      season: params.get('season') ?? 0,
      staff: params.get('staff'),
      crops: params.get('crops') !== '0',
      female: params.get('female') === '1',
      farmName: params.get('name') || undefined,
    });
  }
  if (forcedGrid) return mockGame(levelId, forcedGrid);
  if (createGame) {
    try { return createGame({ levelId, seed }); } catch (e) { console.warn(e); }
  }
  return mockGame(levelId);
}

// ── Mise en place ─────────────────────────────────────────────────────────────────────
const images = await loadImages(SHEETS, { base: '../' });
try { await document.fonts.load('16px "Ferme"'); } catch (e) { /* police facultative */ }
const canvas = $('scene');
let seed = Number(params.get('seed')) || 7;
let game = newGame(Number(params.get('level')) || 1, seed);
const phone = params.get('w') && params.get('h') ? { w: Number(params.get('w')), h: Number(params.get('h')) } : null;
const forcedDpr = params.get('dpr') ? Number(params.get('dpr')) : null;
const insets = {
  top: Number(params.get('top') ?? (phone ? 64 : 0)),
  bottom: Number(params.get('bottom') ?? (phone ? 72 : 0)),
  left: 0,
  right: 0,
};
const scene = createScene(canvas, images, game.level || game.query.level(), { layoutMode: params.get('mode') || 'auto' });
const cos = {
  farmName: params.get('name') || 'Ferme des Tilleuls',
  outfit: OUTFITS[Number(params.get('outfit')) || 0] || 'outfit.classic',
  fence: params.get('fence') ? `fence.${params.get('fence')}` : 'fence.wood',
  path: params.get('path') ? `path.${params.get('path')}` : 'path.dirt',
  decor: {},
};
scene.setCosmetics(cos);
scene.setInsets(insets);
let unsub = null;

function wire() {
  if (unsub) unsub();
  unsub = game.on('*', (e) => scene.onEvent(e.type, e));
  game.state.money = 99999;
}
wire();

function fit() {
  const w = phone ? phone.w : window.innerWidth;
  const h = phone ? phone.h : window.innerHeight;
  if (phone) {
    canvas.style.left = `${Math.max(0, Math.round((window.innerWidth - w) / 2))}px`;
    canvas.style.top = `${Math.max(0, Math.round((window.innerHeight - h) / 2))}px`;
  }
  scene.resize(w, h, forcedDpr || window.devicePixelRatio || 1);
  // Bandeaux simulés (barre du haut, onglets)
  const r = canvas.getBoundingClientRect();
  const top = $('insetTop');
  const bottom = $('insetBottom');
  top.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${insets.top}px`;
  bottom.style.cssText = `left:${r.left}px;top:${r.bottom - insets.bottom}px;width:${r.width}px;height:${insets.bottom}px`;
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
    if (CP) return;
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
    if (CP) { CP.fillCrops(game); return; }
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
  // ── v3 ──
  /** Pommiers sur un tiers des parcelles ouvertes, à toutes les étapes (jeune plant → pommes mûres). */
  trees() {
    const steps = [[1, 0], [4, 0], [6, 0], [6, 1], [6, 2], [6, 3]];
    let k = 0;
    game.state.plots.forEach((p, i) => {
      if (!p.unlocked || (i % 3 !== 0 && !(game.level?.startTrees || []).includes(i))) return;
      const [g, f] = steps[k++ % steps.length];
      p.cropId = 'apple'; p.growth = g; p.fruit = f; p.watered = false;
    });
  },
  /** Ateliers possédés : places remplies (sauf une), interrupteurs allumés (ou éteints avec off=1). */
  proc(on = params.get('off') !== '1') {
    game.state.processing = game.state.processing || {};
    for (const id of Object.keys(PRODUCT_OF)) {
      const lvl = game.state.investments[id] || 0;
      if (!lvl) continue;
      const cap = (INVESTMENTS?.find((i) => i.id === id)?.effects?.processing?.places || [2, 3, 4])[lvl - 1] || 2;
      const prods = PRODUCT_OF[id].filter((pid) => (id !== 'mill' ? true : lvl >= 3 ? pid === 'bread' : pid === 'flour'));
      game.state.processing[id] = { on, places: Array.from({ length: cap }, (_, j) => (j === cap - 1 ? null : { productId: prods[j % prods.length], input: 'x', source: 'harvest', daysLeft: 1, rawValue: 10, yieldFactor: 1 })) };
    }
  },
  decorAll() {
    const slots = {};
    (scene.layout.decorSlots || []).forEach((d, j) => {
      if (d.kind === 'small') slots[d.id] = DECOR_ITEMS[j % DECOR_ITEMS.length];
      if (d.kind === 'large') slots[d.id] = 'pond';
    });
    cos.decor = slots;
    scene.setCosmetics(cos);
  },
  decorNone() { cos.decor = {}; scene.setCosmetics(cos); },
  nextOutfit() { cos.outfit = OUTFITS[(OUTFITS.indexOf(cos.outfit) + 1) % OUTFITS.length]; scene.setCosmetics(cos); return cos.outfit; },
  nextFence() { cos.fence = FENCES[(FENCES.indexOf(cos.fence) + 1) % FENCES.length]; scene.setCosmetics(cos); return cos.fence; },
  togglePath() { cos.path = cos.path === 'path.stone' ? 'path.dirt' : 'path.stone'; scene.setCosmetics(cos); return cos.path; },
  setCosmetics(c) { Object.assign(cos, c); scene.setCosmetics(cos); },
  toggleDecor() { scene.setDecorMode(!scene.decorMode); return scene.decorMode; },
  contest(on = true) {
    scene.setContestDay(on);
    if (on) game.state.contest = { awarded: true, result: { goalsMet: ['pumpkins', 'terroir', 'cheese'], amount: 480 } };
  },
  /** Aube v3 : produits vendus et fromage qui part à la fromagerie. */
  dawnV3() {
    let j = 0;
    for (const id of Object.keys(PRODUCT_OF)) {
      if (!(game.state.investments[id] > 0)) continue;
      scene.onEvent('productSold', { buildingId: id, productId: PRODUCT_OF[id][id === 'mill' && game.state.investments.mill >= 3 ? 1 : 0], amount: 44, placeIndex: j++ });
    }
    if (game.state.investments.dairy > 0) scene.onEvent('processingStarted', { buildingId: 'dairy', productId: 'goatCheese', input: 'goat', source: 'animal', placeIndex: 0 });
  },
  /** Récolte envoyée à l'atelier (vol de l'icône). */
  toWorkshop() {
    const i = game.state.plots.findIndex((p) => p.unlocked);
    const id = ['jamWorkshop', 'mill', 'dairy'].find((b) => game.state.investments[b] > 0);
    if (i < 0 || !id) return;
    scene.onEvent('harvested', { plotIndex: i, cropId: 'strawberry', amount: 0, processed: { buildingId: id, productId: PRODUCT_OF[id][0], placeIndex: 0 } });
  },
  removeTree() {
    const i = game.state.plots.findIndex((p) => p.cropId === 'apple');
    if (i < 0) return;
    scene.onEvent('treeRemoved', { plotIndex: i });
    const p = game.state.plots[i];
    p.cropId = null; p.growth = 0; p.fruit = 0;
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
for (const k of ['buyAll', 'buyOne', 'sellAll', 'fill', 'unlock', 'empty', 'dawn', 'frost', 'harvestAll', 'trees', 'proc', 'decorAll', 'decorNone', 'nextOutfit', 'nextFence', 'togglePath', 'toggleDecor', 'contest', 'dawnV3', 'toWorkshop', 'removeTree']) $(k).onclick = () => api[k]();

// Glisser pour défiler (avec élan), toucher bref pour agir.
let drag = null;
const local = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
canvas.addEventListener('pointerdown', (e) => {
  const p = local(e);
  drag = { id: e.pointerId, x: p.x, y: p.y, lastY: p.y, lastT: performance.now(), v: 0, moved: false, touch: e.pointerType !== 'mouse' };
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (!drag || drag.id !== e.pointerId) {
    if (e.pointerType === 'mouse') scene.setHover(scene.hitTest(p.x, p.y));
    return;
  }
  if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 8) drag.moved = true;
  if (drag.moved) {
    const now = performance.now();
    const dy = p.y - drag.lastY;
    scene.scrollBy(-dy);
    const dt = Math.max(1, now - drag.lastT) / 1000;
    drag.v = drag.v * 0.6 + (-dy / dt) * 0.4;
    drag.lastY = p.y;
    drag.lastT = now;
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = drag;
  drag = null;
  if (d.moved) {
    if (performance.now() - d.lastT < 80) scene.fling(d.v);
    return;
  }
  const p = local(e);
  const hit = scene.hitTest(p.x, p.y, { touch: d.touch });
  if (scene.decorMode) {
    if (hit) console.info('décor :', JSON.stringify(hit));
    lastDecorHit = hit;
    return;
  }
  act(hit);
});
let lastDecorHit = null;
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('mouseleave', () => scene.setHover(null));
canvas.addEventListener('wheel', (e) => { scene.scrollBy(e.deltaY); e.preventDefault(); }, { passive: false });

function act(hit) {
  scene.setHover(hit);
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
}

api.insets = insets;
api.setInsets = (ins) => { Object.assign(insets, ins); scene.setInsets(insets); fit(); };
api.act = act;
Object.defineProperty(api, 'lastDecorHit', { get: () => lastDecorHit });

// ── État initial depuis l'URL ─────────────────────────────────────────────────────────
api.set({
  season: params.get('season') ?? 0,
  weather: params.get('weather') ?? 'sunny',
  day: params.get('day') ?? 0.45,
});
if (params.get('unlock') === '1') api.unlock();
if (params.get('inv') === 'all') api.buyAll();
if (params.get('crops') === '1' && !CP) api.fill();
if (CP) {
  api.career = {
    stage(n) { game = CP.buildCareerGame({ seed, stage: String(n), season: game.state.time.seasonIndex }); wire(); return game; },
    event(id) { CP.applyEvent(game, id); },
    pending(full) { CP.fillPending(game, full); },
    sim(sec, from) { CP.simulate(game, Number(sec) || 1, from ?? null); },
    pets() { game.state.career.pets = { cat: true, dog: true }; },
    lots() { return scene.layout.lots; },
    focus(id, animate = false) {
      if (id === 'house') return scene.focusHouse({ animate });
      if (id === 'field') { scene.focusField(); return scene.getScroll(); }
      return scene.focusLot(id, { animate });
    },
    log: CP.careerLog,
  };
  for (const ev of (params.get('event') || '').split(',').filter(Boolean)) CP.applyEvent(game, ev);
  if (params.get('pets') === '1') api.career.pets();
  if (params.get('pending')) CP.fillPending(game, params.get('pending') === 'full');
  if (params.get('sim')) CP.simulate(game, Number(params.get('sim')), params.get('from') !== null ? Number(params.get('from')) : null);
  // Rendu une fois pour construire la disposition, puis cadrage demandé.
  scene.render(game, performance.now());
  const f = params.get('focus');
  if (f) api.career.focus(f);
}
if (params.get('trees') === '1') api.trees();
if (params.get('proc') === '1') api.proc();
if (params.get('decor') === 'all') api.decorAll();
if (params.get('decorMode') === '1') scene.setDecorMode(true);
if (params.get('contest') === '1') api.contest(true);
if (params.get('panel') === '0') $('panel').classList.add('hidden');
if (params.get('panel') === 'none') $('panel').style.display = 'none';
if (params.get('scroll') !== null) scene.setScroll(Number(params.get('scroll')));

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
  $('info').textContent = `${scene.layoutMode} zoom ×${scene.zoom}  défil. ${Math.round(scene.getScroll())}/${Math.round(scene.maxScroll())}\n${fps} i/s  rendu ${cost.toFixed(1)} ms\n${cal.seasonId} jour ${cal.day}  ${game.state.weather.today}  ${(cal.dayProgress * 100) | 0} %`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.previewReady = true;
